import { ApiError, now, oid } from './client.js';
import { id, ids, resources, resource, createMetadata } from './catalog.js';
export const commands = ['update_app', 'upload_screenshot', 'upload_device_info', 'reboot_device', 'sleep', 'wake', 'remove_file', 'start_debug', 'stop_debug', 'restore_factory', 'del_device', 'reg_device'];
const errorInfo = (error) => ({ error: error instanceof Error ? error.message : String(error), uncertain: error instanceof ApiError && error.uncertain });
export function requireWrite(result) {
    if ((typeof result !== 'number' && typeof result !== 'string') || !/^[1-9]\d*$/.test(String(result)))
        throw new ApiError('Mutation response was not a positive ID/count; inspect backend records before proceeding', true);
    return result;
}
export class MediaService {
    client;
    mutations = Promise.resolve();
    constructor(client) {
        this.client = client;
    }
    serialize(fn) {
        const next = this.mutations.then(fn, fn);
        this.mutations = next.catch(() => { });
        return next;
    }
    catalog(name) {
        return name ? { resource: name, ...resource(name), generatedOnCreate: createMetadata[name] ?? '', fieldsAreExamples: true } : {
            resources, generatedOnCreate: createMetadata, workflows: ['zuad_publish', 'zuad_device_command', 'zuad_schedule', 'zuad_default_playback', 'zuad_layout', 'zuad_file', 'zuad_plan', 'zuad_monitor'],
            note: 'Resource fields are observed frontend fields, not a backend schema. IDs are database IDs. For mutations use specialized workflows when available. Organization and configured actor attribution are injected. API-key permissions are enforced by the backend; actor UID is not login identity.',
        };
    }
    async target(target, signal) {
        if (!['program', 'group'].includes(target.kind))
            throw new Error('target.kind must be program or group');
        const record = await this.client.get(target.kind === 'group' ? 'program_groups' : 'programs', target.id, signal);
        const programIds = target.kind === 'group' ? ids(record.layout_id) : [id(record.id)];
        if (target.kind === 'group')
            for (const programId of programIds)
                await this.client.get('programs', programId, signal);
        return { record, programIds, fields: { layout_id: target.kind === 'program' ? record.id : 0, layout_group_id: target.kind === 'group' ? record.id : 0, layout_name: target.kind === 'program' ? record.layout : record.group_name, play_id: programIds.join(',') } };
    }
    async devices(deviceIds, groupIds = [], signal) {
        const values = [...deviceIds];
        for (const groupId of groupIds)
            values.push(...ids((await this.client.get('device_groups', groupId, signal)).device_id));
        return Promise.all(ids(values).map(v => this.client.get('devices', v, signal)));
    }
    async audit(description, signal) {
        try {
            const meta = await this.client.meta(signal);
            delete meta.last_time;
            requireWrite(await this.client.create('operation_logs', { ...meta, system_id: 1, is_state: 1, describe: description }, signal));
            return undefined;
        }
        catch (error) {
            return `Operation completed but audit log failed: ${errorInfo(error).error}`;
        }
    }
    async clearPending(device, taskName, steps, signal) {
        const pending = await this.client.all('tasks', [`device_id,eq,${id(device.device_id)}`, `task_name,eq,${taskName}`, 'condition,eq,0'], signal);
        for (const task of pending) {
            if (Number(task.condition) !== 0 || task.task_name !== taskName || String(task.device_id) !== String(device.device_id))
                throw new Error('Pending task query returned mismatched records');
            requireWrite(await this.client.remove('tasks', task.id, signal));
            steps.push({ action: 'cancel_pending_task', id: task.id });
        }
    }
    async perDevice(devices, operation, signal) {
        const results = [];
        for (const device of devices) {
            if (signal?.aborted)
                break;
            const steps = [];
            try {
                results.push({ deviceId: device.id, terminalId: device.device_id, ok: true, ...(await operation(device, steps)), steps });
            }
            catch (error) {
                results.push({ deviceId: device.id, terminalId: device.device_id, ok: false, ...errorInfo(error), steps });
            }
        }
        return { results, unprocessedDeviceIds: devices.slice(results.length).map(d => d.id), note: 'Task creation is not terminal execution. Query tasks.condition to verify. Multi-request workflows are not atomic.' };
    }
    async publish(target, deviceIds, groupIds = [], signal) {
        await this.client.actor(signal);
        const selection = await this.target(target, signal);
        const devices = await this.devices(deviceIds, groupIds, signal);
        return this.perDevice(devices, async (device, steps) => {
            await this.clearPending(device, 'update_layout', steps, signal);
            const last = (await this.client.query('tasks', { filters: [`device_id,eq,${id(device.device_id)}`, 'task_name,eq,update_layout'], order: 'last_time,desc', limit: 1 }, signal)).records[0];
            if (last && (device.layout_id || device.layout_group_id)) {
                requireWrite(await this.client.create('play_history', { ...await this.client.meta(signal), device_id: device.id, device_name: device.device_name,
                    layout_id: device.layout_group_id || device.layout_id, layout_code: device.layout_group_id ? 1 : 0,
                    layout_name: last.layout_name ?? '', play_duration: Math.max(0, now() - Number(last.play_time || now())) }, signal));
                steps.push({ action: 'record_previous_playback' });
            }
            requireWrite(await this.client.update('devices', device.id, { layout_id: selection.fields.layout_id, layout_group_id: selection.fields.layout_group_id, last_time: now() }, signal));
            steps.push({ action: 'update_device_program' });
            const user = await this.client.login(signal);
            const taskId = requireWrite(await this.client.create('tasks', { ...await this.client.meta(signal), ...selection.fields,
                device_id: device.device_id, device_name: device.device_name, nickname: user.nickname, org_name: '', task_name: 'update_layout', play_time: now() }, signal));
            steps.push({ action: 'create_task', id: taskId });
            const warning = await this.audit(`AI publish ${selection.fields.layout_name} to ${device.device_name}`, signal);
            return { taskId, state: 'submitted', ...(warning ? { warning } : {}) };
        }, signal);
    }
    async command(command, deviceIds, groupIds = [], packageId, signal) {
        if (!commands.includes(command))
            throw new Error('Unknown device command');
        await this.client.actor(signal);
        if (command === 'update_app') {
            if (!packageId)
                throw new Error('update_app requires packageId');
            await this.client.get('packages', packageId, signal, true);
        }
        const devices = await this.devices(deviceIds, groupIds, signal);
        return this.perDevice(devices, async (device, steps) => {
            await this.clearPending(device, command, steps, signal);
            const user = await this.client.login(signal);
            const taskId = requireWrite(await this.client.create('tasks', { ...await this.client.meta(signal), device_id: device.device_id,
                device_name: device.device_name, nickname: user.nickname, org_name: '', task_name: command, code: command === 'upload_screenshot' ? 1 : 0,
                ...(command === 'update_app' ? { package_id: packageId } : {}) }, signal));
            steps.push({ action: 'create_task', id: taskId });
            if (command === 'restore_factory') {
                requireWrite(await this.client.update('devices', device.id, { layout_id: 0, layout_group_id: 0, last_time: now() }, signal));
                steps.push({ action: 'clear_device_program' });
            }
            if (command === 'del_device') {
                requireWrite(await this.client.remove('devices', device.id, signal));
                steps.push({ action: 'delete_device_record' });
            }
            if (command === 'reboot_device') {
                requireWrite(await this.client.update('devices', device.id, { is_state: 1, last_time: now() }, signal));
                steps.push({ action: 'mark_device_rebooting' });
            }
            const warning = await this.audit(`AI ${command}: ${device.device_name}`, signal);
            return { taskId, state: 'submitted', ...(warning ? { warning } : {}) };
        }, signal);
    }
    async defaultPlayback(target, deviceIds, groupIds = [], signal) {
        await this.target(target, signal);
        const devices = await this.devices(deviceIds, groupIds, signal);
        return this.perDevice(devices, async (device, steps) => {
            const result = await this.client.update('devices', device.id, { default_layout_id: target.id, default_type_code: target.kind === 'group' ? 1 : 0 }, signal);
            requireWrite(result);
            steps.push({ action: 'set_default_program' });
            return { result };
        }, signal);
    }
    async schedule(input, signal) {
        if (!['schedule', 'insertion'].includes(input.kind) || !['device', 'group'].includes(input.deviceKind))
            throw new Error('Invalid schedule/device kind');
        if (!input.name?.trim() || !Number.isSafeInteger(input.startTime) || !Number.isSafeInteger(input.endTime) || input.endTime <= input.startTime)
            throw new Error('Name and increasing Unix timestamps in seconds are required');
        const selection = await this.target(input.target, signal);
        const devices = await this.devices(input.deviceKind === 'device' ? [input.deviceId] : [], input.deviceKind === 'group' ? [input.deviceId] : [], signal);
        const name = input.kind === 'schedule' ? 'schedules' : 'insertions';
        const body = { ...(input.id ? { last_time: now(), condition: 0 } : await this.client.meta(signal)),
            [input.kind === 'schedule' ? 'schedule_name' : 'insertion_name']: input.name,
            layout_id: input.target.id, layout_code: input.target.kind === 'group' ? 1 : 0,
            device_id: input.deviceId, device_code: input.deviceKind === 'group' ? 1 : 0,
            play_id: devices.map(d => d.id).join(','), layout_play_id: selection.programIds.join(','), start_time: input.startTime, end_time: input.endTime,
        };
        if (name === 'schedules') {
            body.time_frame = input.dates?.length ? 'next_week' : 'custom';
            body.appoint_date = JSON.stringify(input.dates ?? []);
            body.color = input.color ?? '#16856b';
        }
        else if (input.dates?.length)
            throw new Error('Specified dates apply to schedules only');
        const intervals = scheduleIntervals(body);
        if (intervals.some(v => v[0] < now()))
            throw new Error('Schedule start time is in the past');
        const existing = await this.client.all(name, [], signal);
        const conflicts = existing.filter(row => String(row.id) !== String(input.id ?? '') &&
            ids(row.play_id).some(v => devices.some(d => String(d.id) === v)) &&
            scheduleIntervals(row).some(a => intervals.some(b => a[0] < b[1] && b[0] < a[1]))).map(v => v.id);
        if (conflicts.length)
            return { saved: false, conflicts, reason: 'Overlapping time and device membership; edit/delete existing entries first' };
        const result = input.id ? await this.client.update(name, input.id, body, signal) : await this.client.create(name, body, signal);
        requireWrite(result);
        return { saved: true, result, warning: 'Conflict check is client-side; concurrent changes from other clients require backend enforcement.' };
    }
    async plan(operation, input, signal) {
        const user = await this.client.actor(signal);
        const endpoints = { create: 'addPlan', update: 'editPlan', delete: 'delPlan', start: 'startUpPlan' };
        const endpoint = endpoints[operation];
        if (!endpoint)
            throw new Error('Invalid plan operation');
        if (operation !== 'create')
            await this.client.get('plans', input.id, signal);
        if (['create', 'update'].includes(operation)) {
            if (!input.planName || ![0, 1].includes(input.layoutCode))
                throw new Error('planName and layoutCode 0/1 required');
            await this.target({ kind: input.layoutCode === 1 ? 'group' : 'program', id: id(input.layoutId) }, signal);
            if (input.regionId)
                await this.client.get('regions', input.regionId, signal);
        }
        const body = { ...input, id: operation === 'create' ? oid() : id(input.id), orgNum: user.orgNum, uid: user.uid };
        return this.client.request(`/api/v5/plan_model/${endpoint}`, operation === 'delete' ? 'GET' : 'POST', operation === 'delete' ? undefined : body, operation === 'delete' ? body : {}, signal);
    }
    async crud(operation, name, input, entityId, signal) {
        resource(name);
        await this.client.actor(signal);
        if (operation === 'create' || operation === 'update') {
            if (!Object.keys(input).length)
                throw new Error('Nonempty data is required');
            // These resources carry invariants implemented by their dedicated workflows.
            if (['tasks', 'schedules', 'insertions', 'programs', 'templates'].includes(name))
                throw new Error(`Use the specialized business tool to write ${name}`);
            if (name === 'materials' && operation === 'create')
                throw new Error('Use zuad_file upload_material to register uploaded assets');
            if (name === 'program_groups')
                for (const key of ids(input.layout_id))
                    await this.client.get('programs', key, signal);
            if (name === 'device_groups')
                for (const key of ids(input.device_id))
                    await this.client.get('devices', key, signal);
            if (name === 'devices' && ['layout_id', 'layout_group_id', 'default_layout_id'].some(key => key in input))
                throw new Error('Use publish/default playback to change device programs');
        }
        if (operation === 'delete' && name === 'materials') {
            const material = await this.client.get('materials', entityId, signal);
            for (const source of ['programs', 'templates']) {
                const rows = await this.client.all(source, [], signal);
                if (material.recordStart && rows.some(row => String(row.generateHtml ?? '').includes(String(material.recordStart)) || String(row.file_list ?? '').includes(String(material.recordStart))))
                    throw new Error(`Material is referenced by ${source}; remove references first`);
            }
        }
        if (operation === 'create' && createMetadata[name]) {
            const user = await this.client.actor(signal);
            const generated = { oid: oid(), uid: user.uid, create_time: now(), last_time: now(), update_time: now(), creation_time: now(), system_code: 1, system_id: 1 };
            input = { ...input };
            for (const key of createMetadata[name].split(','))
                input[key] = generated[key];
        }
        const result = operation === 'create' ? await this.client.create(name, input, signal)
            : operation === 'update' ? await this.client.update(name, id(entityId), input, signal)
                : operation === 'delete' ? await this.client.remove(name, id(entityId), signal) : (() => { throw new Error('Invalid CRUD operation'); })();
        return { result, warning: await this.audit(`AI ${operation} ${name} ${entityId ?? ''}`, signal) ?? null };
    }
}
export function scheduleIntervals(row) {
    const start = Number(row.start_time), end = Number(row.end_time);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start)
        throw new Error('Existing schedule has invalid interval; inspect before writing');
    if (row.time_frame !== 'next_week')
        return [[start, end]];
    const dates = typeof row.appoint_date === 'string' ? JSON.parse(row.appoint_date) : row.appoint_date;
    if (!Array.isArray(dates) || !dates.length || dates.length > 3660)
        throw new Error('Specified-date schedule must contain 1-3660 dates');
    const offset = 8 * 3600;
    const startSeconds = ((start + offset) % 86400 + 86400) % 86400;
    const endSeconds = ((end + offset) % 86400 + 86400) % 86400;
    if (endSeconds <= startSeconds)
        throw new Error('Specified-date daily interval must end after it starts (Asia/Shanghai)');
    return dates.map(value => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
            throw new Error('dates must contain YYYY-MM-DD strings');
        const base = Date.parse(`${value}T00:00:00+08:00`) / 1000;
        if (!Number.isFinite(base) || new Date((base + offset) * 1000).toISOString().slice(0, 10) !== value)
            throw new Error('Invalid specified date');
        return [base + startSeconds, base + endSeconds];
    });
}
//# sourceMappingURL=service.js.map