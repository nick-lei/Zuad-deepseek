import makeFetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { randomUUID } from 'node:crypto';
import { resource, object, id, ids } from './catalog.js';
export class ApiError extends Error {
    uncertain;
    status;
    constructor(message, uncertain = false, status) {
        super(message);
        this.uncertain = uncertain;
        this.status = status;
    }
}
export const now = () => Math.floor(Date.now() / 1000);
export const oid = () => randomUUID().replaceAll('-', '');
export function records(value) {
    const data = object(value, 'list response');
    if (!Array.isArray(data.records))
        throw new ApiError('Backend did not return a records array; check session, URL and database');
    return data.records.map(item => object(item, 'record'));
}
export class MediaClient {
    config;
    fetch;
    identity;
    loggingIn;
    shutdown = new AbortController();
    constructor(config, fetchImpl = globalThis.fetch) {
        this.config = config;
        this.fetch = config.authMode === 'session' ? makeFetchCookie(fetchImpl, new CookieJar()) : fetchImpl;
    }
    close() { this.shutdown.abort(); this.identity = undefined; }
    signal(signal) {
        return AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(this.config.timeoutMs), ...(signal ? [signal] : [])]);
    }
    async request(path, method = 'GET', body, query = {}, signal, binary = false, key = false, gateway = false) {
        if (!this.config.baseUrl)
            throw new Error('Configure baseUrl or ZUAD_BASE_URL');
        if (!path.startsWith('/') || path.startsWith('//'))
            throw new Error('Expected a local API path');
        if (!gateway && this.config.authMode === 'apiKey')
            path = path.replace(/^\/api\.php(?=\/|\?|$)/, '/apikey.php');
        const url = new URL(path, gateway ? this.config.ptzBaseUrl : this.config.baseUrl);
        for (const [name, value] of Object.entries(query)) {
            if (value === undefined)
                continue;
            if (Array.isArray(value))
                for (const entry of value)
                    url.searchParams.append(name === 'join' ? name : `${name}[]`, String(entry));
            else
                url.searchParams.set(name, String(value));
        }
        const headers = new Headers({ Accept: binary ? '*/*' : 'application/json' });
        if (path === '/api/v5/monitor_model/exportMonitor' && process.env[this.config.signCodeEnv])
            headers.set('Sign-Code', process.env[this.config.signCodeEnv]);
        const isMutation = method !== 'GET' || /\/(delPlan|gb28181)/.test(path);
        if (!gateway && (this.config.authMode === 'apiKey' || key || /^\/apikey\.php(?:\/|\?|$)/.test(path))) {
            const apiKey = process.env[this.config.apiKeyEnv];
            if (!apiKey)
                throw new Error(`Configure ${this.config.apiKeyEnv} for this API-key endpoint`);
            headers.set('x-api-key', apiKey);
        }
        let payload;
        if (body instanceof FormData)
            payload = body;
        else if (body !== undefined) {
            payload = JSON.stringify(body);
            headers.set('Content-Type', 'application/json');
        }
        const combinedSignal = this.signal(signal);
        combinedSignal.throwIfAborted();
        try {
            const response = await (gateway ? globalThis.fetch : this.fetch)(url, { method, headers, ...(payload === undefined ? {} : { body: payload }), signal: combinedSignal, redirect: 'error' });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403)
                    this.identity = undefined;
                throw new ApiError(`API ${method} ${url.pathname} returned HTTP ${response.status}`, isMutation && response.status >= 500, response.status);
            }
            if (binary) {
                if (/json|text\/html/i.test(response.headers.get('content-type') ?? ''))
                    throw new ApiError('Export returned JSON/HTML instead of a file');
                return new Uint8Array(await response.arrayBuffer());
            }
            const text = await response.text();
            let value;
            try {
                value = text ? JSON.parse(text) : null;
            }
            catch {
                throw new ApiError('API returned invalid JSON; verify authentication and backend origin', isMutation);
            }
            if (value && typeof value === 'object' && !Array.isArray(value) && (Number(value.code) >= 1000 || value.error))
                throw new ApiError(`Backend rejected request (code ${String(value.code ?? 'error')})`);
            return value;
        }
        catch (error) {
            if (error instanceof ApiError)
                throw error;
            throw new ApiError(`API ${method} ${url.pathname} ${combinedSignal.aborted ? 'cancelled or timed out' : 'transport failed'}. ${isMutation ? 'The server may have applied the operation; inspect records before retrying.' : ''}`, isMutation);
        }
    }
    async login(signal) {
        this.shutdown.signal.throwIfAborted();
        signal?.throwIfAborted();
        if (this.config.authMode === 'apiKey') {
            if (!this.config.orgNum)
                throw new Error('Configure orgNum or ZUAD_ORG_NUM');
            if (!process.env[this.config.apiKeyEnv])
                throw new Error(`Configure ${this.config.apiKeyEnv} in the Harness process environment`);
            return { uid: this.config.actorUid, nickname: this.config.actorNickname || 'API key', orgNum: this.config.orgNum, deviceIds: [], authMode: 'apiKey' };
        }
        if (this.identity)
            return this.identity;
        if (this.loggingIn)
            return this.loggingIn;
        this.loggingIn = this.authenticate(signal);
        try {
            return await this.loggingIn;
        }
        finally {
            this.loggingIn = undefined;
        }
    }
    async authenticate(signal) {
        if (!this.config.orgNum)
            throw new Error('Configure orgNum or ZUAD_ORG_NUM');
        const username = process.env[this.config.usernameEnv];
        const password = process.env[this.config.passwordEnv];
        if (!username || !password)
            throw new Error(`Configure ${this.config.usernameEnv} and ${this.config.passwordEnv} in the Harness process environment`);
        const data = object(await this.request('/api.php/login', 'POST', { username, password, orgNum: this.config.orgNum, orgNums: this.config.orgNum }, {}, signal), 'login response');
        if ('code' in data || data.status === 0 || !data.id || String(data.org_num) !== this.config.orgNum)
            throw new ApiError('Login rejected, disabled account, missing identity or organization mismatch');
        let deviceIds = data.device_rules ? ids(data.device_rules) : [];
        // The React login context obtains device_rules from the role as well as the user.
        if (data.groupid) {
            const roleRows = records(await this.request('/api.php/records/think_auth_group', 'GET', undefined, { database: 'zuad_common', filter: [`id,eq,${id(data.groupid)}`], size: 1 }, signal));
            const role = roleRows[0];
            if (!role || ![this.config.orgNum, '-1'].includes(String(role.org_num)))
                throw new ApiError('Cannot verify account role organization');
            if (role.device_rules) {
                const roleIds = ids(role.device_rules);
                deviceIds = deviceIds.length ? deviceIds.filter(v => roleIds.includes(v)) : roleIds;
                if (!deviceIds.length)
                    deviceIds = ['__none__'];
            }
        }
        return this.identity = { uid: id(data.id), nickname: String(data.real_name ?? data.nickname ?? username), orgNum: this.config.orgNum, deviceIds, authMode: 'session' };
    }
    async actor(signal) {
        const user = await this.login(signal);
        if (!user.uid)
            throw new Error('Configure actorUid or ZUAD_ACTOR_UID for writes requiring business attribution; API key authentication does not supply a user ID');
        return user;
    }
    async meta(signal) {
        const user = await this.actor(signal);
        return { org_num: user.orgNum, uid: user.uid, oid: oid(), create_time: now(), last_time: now() };
    }
    async query(name, query = {}, signal) {
        const spec = resource(name), user = await this.login(signal);
        const filters = [...(query.filters ?? [])];
        for (const filter of filters) {
            if (!/^[A-Za-z_][\w.]*,(eq|neq|cs|sw|ew|lt|le|ge|gt|bt|in|is),[^\r\n]*$/.test(filter))
                throw new Error(`Invalid filter: ${filter}`);
        }
        const limit = query.limit ?? 100;
        const page = query.page ?? 1;
        if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(page) || page < 1)
            throw new Error('Invalid limit/page');
        if (query.include && !/^[\w.,]+$/.test(query.include))
            throw new Error('Invalid include');
        if (query.order && !/^\w+,(asc|desc)$/.test(query.order))
            throw new Error('order must be field,asc or field,desc');
        filters.push(`${spec.scope},${query.shared && spec.shared ? `in,${user.orgNum},-1` : `eq,${user.orgNum}`}`);
        if (name === 'devices' && user.deviceIds.length)
            filters.push(`id,in,${user.deviceIds.join(',')}`);
        let terminalIds;
        if (['tasks', 'device_configs'].includes(name) && user.deviceIds.length) {
            const devices = await this.all('devices', [], signal);
            terminalIds = devices.map(row => id(row.device_id));
            filters.push(`device_id,in,${terminalIds.length ? terminalIds.join(',') : '__none__'}`);
        }
        const result = records(await this.request(`/api.php/records/${spec.table}`, 'GET', undefined, {
            database: spec.database, filter: filters, size: limit, page,
            ...(query.include ? { include: [...new Set([...query.include.split(','), 'id', spec.scope])].join(',') } : {}),
            ...(query.order ? { order: query.order } : {}),
            ...(spec.joins ? { join: spec.joins } : {}),
        }, signal));
        for (const row of result) {
            const allowed = [user.orgNum, ...(query.shared && spec.shared ? ['-1'] : [])];
            if (!allowed.includes(String(row[spec.scope])))
                throw new ApiError('Backend returned a record outside the configured organization');
            if (name === 'devices' && user.deviceIds.length && !user.deviceIds.includes(String(row.id)))
                throw new ApiError('Backend returned a device outside the account scope');
            if (terminalIds && !terminalIds.includes(String(row.device_id)))
                throw new ApiError('Backend returned a terminal outside the account scope');
        }
        // Some backends reduce page size, so a short page does not prove the list is complete.
        return { records: result, possiblyTruncated: result.length > 0, page };
    }
    async get(name, entityId, signal, shared = false, include) {
        const rows = await this.query(name, { filters: [`id,eq,${id(entityId)}`], limit: 1, shared, ...(include === undefined ? {} : { include }) }, signal);
        const row = rows.records[0];
        if (!row || String(row.id) !== String(entityId))
            throw new ApiError(`${name} ${String(entityId)} not found or not authorized`);
        return row;
    }
    async create(name, input, signal) {
        return this.write(name, 'create', undefined, input, signal);
    }
    async update(name, entityId, input, signal) {
        return this.write(name, 'update', entityId, input, signal);
    }
    async remove(name, entityId, signal) {
        return this.write(name, 'delete', entityId, undefined, signal);
    }
    async write(name, operation, entityId, input, signal) {
        const spec = resource(name), user = await this.login(signal);
        if (!spec.operations.split(',').includes(operation))
            throw new Error(`${name} does not support ${operation}; use its business tool`);
        if (entityId !== undefined)
            await this.get(name, entityId, signal);
        const writeScope = spec.writeScope ?? spec.scope;
        const body = input ? { ...object(input), [writeScope]: user.orgNum } : undefined;
        if (body) {
            if ('id' in body)
                throw new Error('Pass entity ID separately, not in data');
            for (const field of ['org_num', 'orgNum'])
                if (field !== writeScope && field in body && String(body[field]) !== user.orgNum)
                    throw new Error('Cannot change organization');
            if ('uid' in body)
                body.uid = (await this.actor(signal)).uid;
            if ('nickname' in body && name === 'tasks')
                body.nickname = user.nickname;
        }
        const key = operation === 'create' && spec.apiKeyCreate === true;
        return this.request(`/${key ? 'apikey' : 'api'}.php/records/${spec.table}${entityId === undefined ? '' : `/${id(entityId)}`}`, operation === 'create' ? 'POST' : operation === 'update' ? 'PUT' : 'DELETE', body, { database: spec.database }, signal, false, key);
    }
    async all(name, filters = [], signal) {
        const result = [];
        const seen = new Set();
        for (let page = 1;; page++) {
            const rows = await this.query(name, { filters, order: 'id,asc', page }, signal);
            if (!rows.records.length)
                return result;
            for (const row of rows.records) {
                const key = String(row.id);
                if (seen.has(key))
                    throw new ApiError('Backend pagination repeated records; refusing an incomplete operation');
                seen.add(key);
                result.push(row);
            }
        }
    }
}
//# sourceMappingURL=client.js.map