import makeFetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { randomUUID } from 'node:crypto';
import { resource, object, id, ids, type ResourceName } from './catalog.js';
import type { Config } from './core/config.js';

export type Data = Record<string, any>;
export interface Query { filters?: string[]; include?: string; order?: string; limit?: number; page?: number; shared?: boolean }
export interface Identity { uid: string; nickname: string; orgNum: string; deviceIds: string[]; authMode: Config['authMode'] }
export class ApiError extends Error {
  constructor(message: string, public readonly uncertain = false, public readonly status?: number) { super(message); }
}
export class SignInRequiredError extends ApiError {
  constructor(public readonly reason: 'not_signed_in' | 'expired' | 'credentials_rejected', message: string, status?: number) {
    super(message, false, status);
  }
}
export const now = () => Math.floor(Date.now() / 1000);
export const oid = () => randomUUID().replaceAll('-', '');
export function records(value: unknown): Data[] {
  const data = object(value, 'list response');
  if (!Array.isArray(data.records)) throw new ApiError('Backend did not return a records array; check session, URL and database');
  return data.records.map(item => object(item, 'record'));
}

export class MediaClient {
  private readonly fetch: typeof globalThis.fetch;
  private identity: Identity | undefined;
  private loggingIn: Promise<Identity> | undefined;
  private readonly cookies = new CookieJar();
  private signCode = '';
  private verified = false;
  private readonly shutdown = new AbortController();
  constructor(public readonly config: Config, fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = config.authMode === 'session' ? makeFetchCookie(fetchImpl, this.cookies) as typeof globalThis.fetch : fetchImpl;
  }
  close() { this.shutdown.abort(); this.identity = undefined; this.signCode = ''; this.verified = false; }
  async logout() {
    this.identity = undefined;
    this.signCode = '';
    this.verified = false;
    await this.cookies.removeAllCookies();
  }
  connectionStatus() {
    return {
      connected: this.verified, baseUrl: this.config.baseUrl, authMode: this.config.authMode,
      username: this.config.username || process.env[this.config.usernameEnv] || '',
      hasPassword: Boolean(this.config.username ? this.config.password : process.env[this.config.passwordEnv]),
      ...(this.verified && this.identity ? { ...this.identity } : {}),
    };
  }
  async verifyConnection(signal?: AbortSignal) {
    try {
      const identity = await this.login(signal);
      await this.query('programs', { include: 'id', limit: 1 }, signal);
      this.identity = identity;
      this.verified = true;
      return { ...identity, verified: true };
    } catch (error) { await this.logout(); throw error; }
  }
  private signal(signal?: AbortSignal) {
    return AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(this.config.timeoutMs), ...(signal ? [signal] : [])]);
  }
  async request(path: string, method = 'GET', body?: unknown, query: Record<string, unknown> = {}, signal?: AbortSignal, binary = false, key = false, gateway = false): Promise<any> {
    if (!this.config.baseUrl) throw new Error('Configure baseUrl or ZUAD_BASE_URL');
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected a local API path');
    if (!gateway && this.config.authMode === 'apiKey') path = path.replace(/^\/api\.php(?=\/|\?|$)/, '/apikey.php');
    const url = new URL(path, gateway ? this.config.ptzBaseUrl : this.config.baseUrl);
    for (const [name, value] of Object.entries(query)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) for (const entry of value) url.searchParams.append(name === 'join' ? name : `${name}[]`, String(entry));
      else url.searchParams.set(name, String(value));
    }
    const headers = new Headers({ Accept: binary ? '*/*' : 'application/json' });
    if (!gateway && this.config.authMode === 'session' && this.signCode) headers.set('Sign-Code', this.signCode);
    if (path === '/api/v5/monitor_model/exportMonitor' && process.env[this.config.signCodeEnv]) headers.set('Sign-Code', process.env[this.config.signCodeEnv]!);
    const isMutation = method !== 'GET' || /\/(delPlan|gb28181)/.test(path);
    if (!gateway && (this.config.authMode === 'apiKey' || key || /^\/apikey\.php(?:\/|\?|$)/.test(path))) {
      const apiKey = process.env[this.config.apiKeyEnv];
      if (!apiKey) throw new Error(`Configure ${this.config.apiKeyEnv} for this API-key endpoint`);
      headers.set('x-api-key', apiKey);
    }
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { payload = JSON.stringify(body); headers.set('Content-Type', 'application/json'); }
    const combinedSignal = this.signal(signal);
    combinedSignal.throwIfAborted();
    try {
      const response = await (gateway ? globalThis.fetch : this.fetch)(url, { method, headers, ...(payload === undefined ? {} : { body: payload }), signal: combinedSignal, redirect: 'error' });
      if (!response.ok) {
        if (!gateway && response.status === 401 && this.config.authMode === 'session') {
          await this.logout();
          throw new SignInRequiredError(path === '/api.php/login' ? 'credentials_rejected' : 'expired',
            path === '/api.php/login' ? 'Login rejected; please sign in again in the plugin details.' : 'Your signage session has expired; please sign in again in the plugin details.', 401);
        }
        throw new ApiError(`API ${method} ${url.pathname} returned HTTP ${response.status}`, isMutation && response.status >= 500, response.status);
      }
      if (binary) {
        if (/json|text\/html/i.test(response.headers.get('content-type') ?? '')) throw new ApiError('Export returned JSON/HTML instead of a file');
        return new Uint8Array(await response.arrayBuffer());
      }
      const text = await response.text();
      let value: any;
      try { value = text ? JSON.parse(text) : null; }
      catch { throw new ApiError('API returned invalid JSON; verify authentication and backend origin', isMutation); }
      if (value && typeof value === 'object' && !Array.isArray(value) && (Number(value.code) >= 1000 || value.error)) {
        if (path === '/api.php/login') throw new SignInRequiredError('credentials_rejected', `Backend rejected login (code ${String(value.code ?? 'error')})`);
        throw new ApiError(`Backend rejected request (code ${String(value.code ?? 'error')})`);
      }
      return value;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`API ${method} ${url.pathname} ${combinedSignal.aborted ? 'cancelled or timed out' : 'transport failed'}. ${isMutation ? 'The server may have applied the operation; inspect records before retrying.' : ''}`, isMutation);
    }
  }
  async login(signal?: AbortSignal): Promise<Identity> {
    this.shutdown.signal.throwIfAborted();
    signal?.throwIfAborted();
    if (this.config.authMode === 'apiKey') {
      if (!this.config.orgNum) throw new Error('Configure orgNum or ZUAD_ORG_NUM');
      if (!process.env[this.config.apiKeyEnv]) throw new Error(`Configure ${this.config.apiKeyEnv} in the Harness process environment`);
      return { uid: this.config.actorUid, nickname: this.config.actorNickname || 'API key', orgNum: this.config.orgNum, deviceIds: [], authMode: 'apiKey' };
    }
    if (!this.config.sessionEnabled) throw new SignInRequiredError('not_signed_in', 'Please sign in to the signage system in the plugin details.');
    if (this.identity) return this.identity;
    if (this.loggingIn) return this.loggingIn;
    this.loggingIn = this.authenticate(signal);
    try { return await this.loggingIn; }
    catch (error) { await this.logout(); throw error; }
    finally { this.loggingIn = undefined; }
  }
  private async authenticate(signal?: AbortSignal): Promise<Identity> {
    const username = this.config.username || process.env[this.config.usernameEnv];
    const password = this.config.username ? this.config.password : process.env[this.config.passwordEnv];
    if (!username || !password) throw new SignInRequiredError('not_signed_in', 'Please enter your account and password in the plugin details.');
    const data = object(await this.request('/api.php/login', 'POST', { username, password, orgNum: this.config.orgNum, orgNums: this.config.orgNum }, {}, signal), 'login response');
    if ('code' in data || data.status === 0 || !data.id || !data.org_num || (this.config.orgNum && String(data.org_num) !== this.config.orgNum))
      throw new SignInRequiredError('credentials_rejected', 'Login rejected, disabled account, missing identity or organization mismatch');
    const orgNum = id(data.org_num);
    this.signCode = typeof data.sign_id === 'string' ? data.sign_id : '';
    let deviceIds = data.device_rules ? ids(data.device_rules) : [];
    // The React login context obtains device_rules from the role as well as the user.
    if (data.groupid) {
      const roleRows = records(await this.request('/api.php/records/think_auth_group', 'GET', undefined,
        { database: 'zuad_common', filter: [`id,eq,${id(data.groupid)}`], size: 1 }, signal));
      const role = roleRows[0];
      if (!role || ![orgNum, '-1'].includes(String(role.org_num))) throw new ApiError('Cannot verify account role organization');
      if (role.device_rules) {
        const roleIds = ids(role.device_rules);
        deviceIds = deviceIds.length ? deviceIds.filter(v => roleIds.includes(v)) : roleIds;
        if (!deviceIds.length) deviceIds = ['__none__'];
      }
    }
    return this.identity = { uid: id(data.id), nickname: String(data.real_name || data.nickname || username), orgNum, deviceIds, authMode: 'session' };
  }
  async actor(signal?: AbortSignal): Promise<Identity> {
    const user = await this.login(signal);
    if (!user.uid) throw new Error('Configure actorUid or ZUAD_ACTOR_UID for writes requiring business attribution; API key authentication does not supply a user ID');
    return user;
  }
  async meta(signal?: AbortSignal): Promise<Data> {
    const user = await this.actor(signal);
    return { org_num: user.orgNum, uid: user.uid, oid: oid(), create_time: now(), last_time: now() };
  }
  async query(name: ResourceName, query: Query = {}, signal?: AbortSignal): Promise<{ records: Data[]; possiblyTruncated: boolean; page: number }> {
    const spec = resource(name), user = await this.login(signal);
    const filters = [...(query.filters ?? [])];
    for (const filter of filters) {
      if (!/^[A-Za-z_][\w.]*,(eq|neq|cs|sw|ew|lt|le|ge|gt|bt|in|is),[^\r\n]*$/.test(filter)) throw new Error(`Invalid filter: ${filter}`);
    }
    const limit = query.limit ?? 100;
    const page = query.page ?? 1;
    if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(page) || page < 1) throw new Error('Invalid limit/page');
    if (query.include && !/^[\w.,]+$/.test(query.include)) throw new Error('Invalid include');
    if (query.order && !/^\w+,(asc|desc)$/.test(query.order)) throw new Error('order must be field,asc or field,desc');
    filters.push(`${spec.scope},${query.shared && spec.shared ? `in,${user.orgNum},-1` : `eq,${user.orgNum}`}`);
    if (name === 'devices' && user.deviceIds.length) filters.push(`id,in,${user.deviceIds.join(',')}`);
    let terminalIds: string[] | undefined;
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
      if (!allowed.includes(String(row[spec.scope]))) throw new ApiError('Backend returned a record outside the configured organization');
      if (name === 'devices' && user.deviceIds.length && !user.deviceIds.includes(String(row.id))) throw new ApiError('Backend returned a device outside the account scope');
      if (terminalIds && !terminalIds.includes(String(row.device_id))) throw new ApiError('Backend returned a terminal outside the account scope');
    }
    // Some backends reduce page size, so a short page does not prove the list is complete.
    this.identity = user;
    this.verified = true;
    return { records: result, possiblyTruncated: result.length > 0, page };
  }
  async get(name: ResourceName, entityId: unknown, signal?: AbortSignal, shared = false, include?: string): Promise<Data> {
    const rows = await this.query(name, { filters: [`id,eq,${id(entityId)}`], limit: 1, shared, ...(include === undefined ? {} : { include }) }, signal);
    const row = rows.records[0];
    if (!row || String(row.id) !== String(entityId)) throw new ApiError(`${name} ${String(entityId)} not found or not authorized`);
    return row;
  }
  async create(name: ResourceName, input: Data, signal?: AbortSignal): Promise<any> {
    return this.write(name, 'create', undefined, input, signal);
  }
  async update(name: ResourceName, entityId: unknown, input: Data, signal?: AbortSignal): Promise<any> {
    return this.write(name, 'update', entityId, input, signal);
  }
  async remove(name: ResourceName, entityId: unknown, signal?: AbortSignal): Promise<any> {
    return this.write(name, 'delete', entityId, undefined, signal);
  }
  private async write(name: ResourceName, operation: string, entityId: unknown, input?: Data, signal?: AbortSignal): Promise<any> {
    const spec = resource(name), user = await this.login(signal);
    if (!spec.operations.split(',').includes(operation)) throw new Error(`${name} does not support ${operation}; use its business tool`);
    if (entityId !== undefined) await this.get(name, entityId, signal);
    const writeScope = spec.writeScope ?? spec.scope;
    const body = input ? { ...object(input), [writeScope]: user.orgNum } : undefined;
    if (body) {
      if ('id' in body) throw new Error('Pass entity ID separately, not in data');
      for (const field of ['org_num', 'orgNum']) if (field !== writeScope && field in body && String(body[field]) !== user.orgNum) throw new Error('Cannot change organization');
      if ('uid' in body) body.uid = (await this.actor(signal)).uid;
      if ('nickname' in body && name === 'tasks') body.nickname = user.nickname;
    }
    const key = operation === 'create' && spec.apiKeyCreate === true;
    return this.request(`/${key ? 'apikey' : 'api'}.php/records/${spec.table}${entityId === undefined ? '' : `/${id(entityId)}`}`,
      operation === 'create' ? 'POST' : operation === 'update' ? 'PUT' : 'DELETE', body, { database: spec.database }, signal, false, key);
  }
  async all(name: ResourceName, filters: string[] = [], signal?: AbortSignal): Promise<Data[]> {
    const result: Data[] = [];
    const seen = new Set<string>();
    for (let page = 1; ; page++) {
      const rows = await this.query(name, { filters, order: 'id,asc', page }, signal);
      if (!rows.records.length) return result;
      for (const row of rows.records) {
        const key = String(row.id);
        if (seen.has(key)) throw new ApiError('Backend pagination repeated records; refusing an incomplete operation');
        seen.add(key);
        result.push(row);
      }
    }
  }
}
