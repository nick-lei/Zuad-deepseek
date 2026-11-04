import { Ajv } from 'ajv';
import { resolveConfig } from './config.js';
import { MediaClient, ApiError, SignInRequiredError } from '../client.js';
import { resources, object, id } from '../catalog.js';
import { MediaService, commands } from '../service.js';
import { MediaFiles } from '../files.js';
import { LayoutRenderer } from '../layout.js';
import { SpecialOperations } from '../special.js';
export class InvalidToolArgumentsError extends Error {
}
export function redact(value) {
    if (Array.isArray(value))
        return value.map(redact);
    if (value && typeof value === 'object') {
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            result[key] = /password|passwd|secret|token|cookie|api.?key|sign.?code/i.test(key) || (key === 'value' && /password|secret|token|key/i.test(String(value.name))) ? '[redacted]' : redact(entry);
        }
        return result;
    }
    return value;
}
const targetSchema = { type: 'object', additionalProperties: false, required: ['kind', 'id'], properties: {
        kind: { type: 'string', enum: ['program', 'group'] }, id: { type: 'string' },
    } };
const deviceParams = {
    deviceIds: { type: 'array', items: { type: 'string' }, description: 'Database device IDs, not terminal serials' },
    deviceGroupIds: { type: 'array', items: { type: 'string' } },
};
const recordData = { type: 'object', additionalProperties: true, description: 'Backend field names. Call zuad_catalog first. Identity and organization are injected.' };
export function createTools(config) {
    const validator = new Ajv({ allErrors: true, strict: true, ownProperties: true });
    const client = new MediaClient(resolveConfig(config));
    const service = new MediaService(client), files = new MediaFiles(client), renderer = new LayoutRenderer(client, files), special = new SpecialOperations(client, files);
    const tool = (toolName, description, properties, required, write, execute) => {
        const parameters = { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false };
        const validate = validator.compile(parameters);
        return { name: toolName, description, parameters, readOnly: !write,
            async execute(args, exec) {
                if (!validate(args))
                    throw new InvalidToolArgumentsError(validator.errorsText(validate.errors));
                const run = async () => {
                    exec.signal.throwIfAborted();
                    try {
                        return JSON.parse(JSON.stringify(redact({ ok: true, data: await execute(args, exec.signal) })));
                    }
                    catch (error) {
                        if (error instanceof SignInRequiredError)
                            return {
                                ok: false, code: 'AUTH_REQUIRED', reason: error.reason, uncertain: false,
                                error: error.reason === 'expired' ? '信发系统登录已失效。'
                                    : error.reason === 'credentials_rejected' ? '后台拒绝了登录信息。' : '尚未登录信发系统。',
                            };
                        return { ok: false, error: error instanceof Error ? error.message : String(error), uncertain: error instanceof ApiError && error.uncertain };
                    }
                };
                return write ? service.serialize(run) : run();
            },
        };
    };
    const tools = [
        tool('zuad_catalog', 'Discover all signage resources, field examples and supported operations. Start here. Field examples are not required-field declarations.', { resource: { type: 'string', enum: Object.keys(resources) } }, [], false, async (a) => service.catalog(a.resource)),
        tool('zuad_session', 'Verify the connected account and its program access. Account login automatically supplies organization and user identity. Administrator-provisioned API-key connections are also supported. Never request passwords or secrets in chat or tool arguments.', {}, [], false, async (_a, signal) => client.verifyConnection(signal)),
        tool('zuad_query', 'Query any catalog resource, including programs, devices, tasks, statistics, logs and system administration. Scoped to configured organization. No plugin cap on page size or total pages. Advance page until possiblyTruncated is false (an empty page); backend page sizes may be smaller than requested.', {
            resource: { type: 'string', enum: Object.keys(resources) },
            id: { type: 'string', description: 'Fetch one database record by ID' },
            filters: { type: 'array', items: { type: 'string' }, description: 'AND conditions: field,eq,value; field,cs,text; field,in,1,2; field,ge,123' },
            include: { type: 'string' }, order: { type: 'string', description: 'field,asc or field,desc' }, limit: { type: 'integer', description: 'Requested page size, default 100; positive integer with no plugin cap' }, page: { type: 'integer' }, shared: { type: 'boolean', description: 'Include shared org=-1 records when resource supports them' },
        }, ['resource'], false, async (a, signal) => a.id ? client.get(a.resource, a.id, signal, a.shared === true, a.include) : client.query(a.resource, a, signal)),
        tool('zuad_record', 'Create/update/delete catalog records: groups, regions, screens, seats, power timers, cameras, products, packages, users, departments, roles, menus, organizations, settings, authorization, orders and logs. Use specialized tools for layouts, schedules, publishing, device commands and file upload. Deletion changes backend records immediately.', {
            operation: { type: 'string', enum: ['create', 'update', 'delete'] }, resource: { type: 'string', enum: Object.keys(resources) }, id: { type: 'string' }, data: recordData,
        }, ['operation', 'resource'], true, async (a, signal) => service.crud(a.operation, a.resource, a.data ? object(a.data) : {}, a.id, signal)),
        tool('zuad_publish', 'Publish a program or program group to devices/groups. Resolves terminal IDs, clears pending duplicates, records playback history, updates device program and creates update_layout tasks. Returns per-device progress. Query task states afterward.', { target: targetSchema, ...deviceParams }, ['target'], true, async (a, signal) => service.publish(a.target, a.deviceIds ?? [], a.deviceGroupIds ?? [], signal)),
        tool('zuad_device_command', 'Create device command tasks. restore_factory clears program configuration; del_device also deletes device records. Execution on terminals is asynchronous. Query task states and device_configs for screenshot/device-info results.', {
            command: { type: 'string', enum: commands }, ...deviceParams, packageId: { type: 'string', description: 'Required for update_app' },
        }, ['command'], true, async (a, signal) => service.command(a.command, a.deviceIds ?? [], a.deviceGroupIds ?? [], a.packageId, signal)),
        tool('zuad_default_playback', 'Set default program/group on devices or device groups.', { target: targetSchema, ...deviceParams }, ['target'], true, async (a, signal) => service.defaultPlayback(a.target, a.deviceIds ?? [], a.deviceGroupIds ?? [], signal)),
        tool('zuad_schedule', 'Create/update schedule or urgent insertion, resolving groups and checking conflicts. Unix times are seconds. For dates, daily clock times are interpreted in Asia/Shanghai. Delete through zuad_record.', {
            kind: { type: 'string', enum: ['schedule', 'insertion'] }, name: { type: 'string' }, target: targetSchema,
            deviceKind: { type: 'string', enum: ['device', 'group'] }, deviceId: { type: 'string' },
            startTime: { type: 'integer' }, endTime: { type: 'integer' }, dates: { type: 'array', items: { type: 'string' } }, color: { type: 'string' }, id: { type: 'string', description: 'Existing schedule/insertion ID for update' },
        }, ['kind', 'name', 'target', 'deviceKind', 'deviceId', 'startTime', 'endTime'], true, async (a, signal) => service.schedule(a, signal)),
        tool('zuad_layout', 'Describe control fields/enums, compile or save program/template with the bundled Node compiler. No local editor or browser required. Start with describe and optional componentType. Supply sourceKind/sourceId with patches, raw content, or slides. Coordinates use original canvas px. QR uses content. Media use queueList. Upload/register new materials through zuad_file first. table accepts rectangular string cells and regenerates/registers its image when saving. Thumbnails are static first-slide previews; dynamic web/PC controls use labels. compile returns payload; save writes backend records.', {
            operation: { type: 'string', enum: ['describe', 'compile', 'save_program', 'save_template'] }, componentType: { type: 'string', description: 'For describe: e.g. image, grid, webMixed, text, marquee, clock, qrcode, table' }, name: { type: 'string' }, id: { type: 'string' }, sourceKind: { type: 'string', enum: ['program', 'template'] }, sourceId: { type: 'string' },
            content: recordData, width: { type: 'integer' }, height: { type: 'integer' },
            slides: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['components'], properties: { duration: { type: 'number' }, components: { type: 'array', items: recordData } } } },
            patches: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['slide', 'index', 'changes'], properties: { slide: { type: 'integer' }, index: { type: 'integer' }, changes: recordData } } },
            previewPath: { type: 'string', description: 'Optional new PNG path under fileRoot, never overwrites' }, folderId: { type: 'string' },
        }, ['operation'], true, async (a, signal) => renderer.execute(a, signal)),
        tool('zuad_file', 'Upload/register materials, upload 5 MiB chunks, upload attachments/HTML, import ZIP programs/templates, export ZIP links, or import monitors. Local paths must stay under the connection working files directory (fileRoot). Normal material upload automatically registers/deduplicates material metadata.', {
            operation: { type: 'string', enum: ['upload_material', 'upload_chunks', 'register_material', 'upload_attachment', 'upload_html', 'import_program', 'import_template', 'export_program', 'export_template', 'import_monitors'] },
            path: { type: 'string' }, id: { type: 'string' }, folderId: { type: 'string' }, mimeType: { type: 'string', description: 'Multipart MIME type; common image extensions are inferred when omitted, otherwise application/octet-stream' }, field: { type: 'string', description: 'Multipart attachment field, default file' }, htmlSource: { type: 'string' }, fileUrl: { type: 'string' },
            metadata: { ...recordData, description: 'register_material only: server-produced sourceName,encryptionName,recordStart,fileMd5,fileSize,fileSourceType and optional filePreview,page_size,duration after successful chunk merge or an upload whose registration failed' },
        }, ['operation'], true, async (a, signal) => files.execute(a.operation, a, signal)),
        tool('zuad_plan', 'Create/update/delete/start a plan through existing v5 endpoints. Query plans through zuad_query. Backend v5 routing must be enabled.', {
            operation: { type: 'string', enum: ['create', 'update', 'delete', 'start'] }, data: { ...recordData, description: 'id for existing plans; create/update: planName, layoutId, layoutCode 0/1, remark, regionId' },
        }, ['operation', 'data'], true, async (a, signal) => service.plan(a.operation, object(a.data), signal)),
        tool('zuad_monitor', 'Start legacy monitor WebRTC, export monitors to a local file, or issue PTZ commands to the configured gateway. Camera records use zuad_record. Streaming video display requires a browser/player.', {
            operation: { type: 'string', enum: ['start_webrtc', 'export', 'ptz'] }, id: { type: 'string' }, command: { type: 'string' }, outputPath: { type: 'string' },
        }, ['operation'], true, async (a, signal) => special.monitor(a.operation, a, signal)),
        tool('zuad_payment', 'Generate the payment QR/order for an existing scoped order using its recorded price and configured payment gateway. This does not confirm payment completion.', { orderId: { type: 'string' } }, ['orderId'], true, async (a, signal) => special.payment(id(a.orderId), signal)),
    ];
    return { tools, client, async close() { client.close(); await renderer.close(); } };
}
/** Keep each invocation on one config snapshot, retiring old clients after their calls finish. */
export function createLiveTools(readConfig) {
    const generations = new Set();
    function generation(config) {
        return { key: JSON.stringify(config), plugin: createTools(config), active: 0 };
    }
    let current = generation(readConfig()), closed = false;
    generations.add(current);
    let writes = Promise.resolve();
    async function useCurrent(action) {
        if (closed)
            throw new Error('Plugin is closed');
        const config = readConfig();
        let retired;
        if (JSON.stringify(config) !== current.key) {
            const previous = current;
            current = generation(config);
            generations.add(current);
            if (!previous.active) {
                generations.delete(previous);
                retired = previous;
            }
        }
        const selected = current;
        selected.active++;
        try {
            await retired?.plugin.close();
            return await action(selected.plugin);
        }
        finally {
            selected.active--;
            if (selected !== current && !selected.active && generations.delete(selected))
                await selected.plugin.close();
        }
    }
    const tools = current.plugin.tools.map((definition, index) => ({
        ...definition,
        async execute(args, exec) {
            const run = () => {
                exec.signal.throwIfAborted();
                return useCurrent(plugin => plugin.tools[index].execute(args, exec));
            };
            if (definition.readOnly)
                return run();
            const result = writes.then(run, run);
            writes = result.catch(() => { });
            return result;
        },
    }));
    return {
        tools,
        status: () => useCurrent(async (plugin) => plugin.client.connectionStatus()),
        connect: () => useCurrent(async (plugin) => { await plugin.client.verifyConnection(); return plugin.client.connectionStatus(); }),
        disconnect: () => useCurrent(async (plugin) => { await plugin.client.logout(); return plugin.client.connectionStatus(); }),
        async close() { closed = true; await Promise.all([...generations].map(item => item.plugin.close())); generations.clear(); },
    };
}
//# sourceMappingURL=tools.js.map