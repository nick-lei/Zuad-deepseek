import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, open, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import { Config, editableConfigKeys, readPluginConfig, resolveConfig } from '../src/config.js';
import { MediaClient, ApiError, type Data } from '../src/client.js';
import { MediaService, scheduleIntervals } from '../src/service.js';
import { MediaFiles } from '../src/files.js';
import { LayoutRenderer } from '../src/layout.js';
import { resources } from '../src/catalog.js';
import * as plugin from '../src/index.js';

async function fixture(run: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>, authMode: 'apiKey' | 'session' = 'session') {
  const f = await setup(authMode);
  try { await run(f); } finally { f.client.close(); f.server.closeAllConnections(); await new Promise<void>(ok => f.server.close(() => ok())); await rm(f.directory, { recursive: true, force: true }); }
}
async function setup(authMode: 'apiKey' | 'session') {
  const directory = await mkdtemp(join(tmpdir(), 'zuad-plugin-test-'));
  process.env.ZUAD_TEST_USERNAME = 'mock-user'; process.env.ZUAD_TEST_PASSWORD = 'test-password-never-render';
  process.env.ZUAD_TEST_API_KEY = 'test-api-key-never-render';
  const db: Record<string, Data[]> = {};
  for (const spec of Object.values(resources)) db[`${spec.database}/${spec.table}`] = [];
  const table = (key: keyof typeof resources) => db[`${resources[key].database}/${resources[key].table}`]!;
  table('programs').push({ id: 11, org_num: '1001', layout: 'Promotion', content: '{}' });
  table('devices').push({ id: 21, org_num: '1001', device_id: 'SERIAL-A', device_name: 'Lobby', layout_id: 0 }, { id: 22, org_num: '1001', device_id: 'SERIAL-B', device_name: 'Shop', layout_id: 0 });
  table('device_groups').push({ id: 31, org_num: '1001', group_name: 'All', device_id: '21,22' });
  table('program_groups').push({ id: 41, org_num: '1001', group_name: 'Rotation', layout_id: '11' });
  const calls: { method: string; httpMethod: string; methodOverride: unknown; path: string; query: URLSearchParams; body: any; cookie: string; apiKey: string; signCode: string }[] = [];
  const options = { failDevice: '', failAudit: false, roleDevices: '', ignoreScope: false, badLogin: false, sessionStatus: 0, loginData: {} as Data, disconnectWrite: false, failRegister: false, pageSize: Infinity, repeatQueryPage: false, uploadMetadata: {} as Data, queryGate: undefined as Promise<void> | undefined };
  let nextId = 100;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks), text = bytes.toString('utf8');
    const url = new URL(req.url!, 'http://127.0.0.1');
    const method = String(req.headers['x-http-method-override'] ?? req.method);
    const body = String(req.headers['content-type']).includes('application/json') && text ? JSON.parse(text) : text;
    calls.push({ method, httpMethod: req.method!, methodOverride: req.headers['x-http-method-override'], path: url.pathname, query: url.searchParams, body, cookie: req.headers.cookie ?? '', apiKey: String(req.headers['x-api-key'] ?? ''), signCode: String(req.headers['sign-code'] ?? '') });
    const send = (value: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (url.pathname === '/api.php/login') {
      res.setHeader('Set-Cookie', 'sid=mock-session; Path=/; HttpOnly');
      send(options.badLogin ? { code: 1023 } : { id: 7, org_num: '1001', nickname: 'Operator', status: 1, device_rules: options.roleDevices, ...options.loginData }); return;
    }
    if (authMode === 'session' && options.sessionStatus) { send({ error: 'session access refused' }, options.sessionStatus); return; }
    if (url.pathname.startsWith('/apikey.php/') || authMode === 'apiKey') {
      if (req.headers['x-api-key'] !== 'test-api-key-never-render') { send({ error: 'invalid API key' }, 401); return; }
    } else if (!req.headers.cookie?.includes('sid=mock-session')) { send({ error: 'not authenticated' }, 401); return; }
    if (/^\/(api|apikey)\.php\/(uploadMaterialFile|sliceUploadFile)$/.test(url.pathname)) {
      send({ resultData: [{ sourceName: 'poster.png', encryptionName: 'hash.png', recordStart: 'uploads/hash.png', fileMd5: 'a'.repeat(32), fileSize: 12, fileSourceType: 1, ...options.uploadMetadata }] }); return;
    }
    if (/^\/(api|apikey)\.php\/export(Program|Template)$/.test(url.pathname)) { send({ resultData: 'exports/program.zip' }); return; }
    const match = /^\/(?:api|apikey)\.php\/records\/(\w+)(?:\/([^/]+))?$/.exec(url.pathname);
    if (!match) { send({ resultData: true }); return; }
    const key = `${url.searchParams.get('database')}/${match[1]}`;
    const rows = db[key];
    if (!rows) { send({ error: 'unknown table' }, 404); return; }
    if (method === 'GET') {
      await options.queryGate;
      let result = [...rows];
      if (!options.ignoreScope) for (const filter of url.searchParams.getAll('filter[]')) {
        const [field, op, ...values] = filter.split(',');
        result = result.filter(row => op === 'eq' ? String(row[field!]) === values.join(',') : op === 'in' ? values.includes(String(row[field!])) : op === 'cs' ? String(row[field!]).includes(values.join(',')) : true);
      }
      const size = Math.min(Number(url.searchParams.get('size') ?? 100), options.pageSize), page = options.repeatQueryPage ? 1 : Number(url.searchParams.get('page') ?? 1);
      if (url.searchParams.get('order')?.endsWith(',desc')) result.reverse();
      if (url.searchParams.get('include')) {
        const fields = url.searchParams.get('include')!.split(',');
        result = result.map(row => Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]])));
      }
      send({ records: result.slice((page - 1) * size, page * size) }); return;
    }
    if (options.disconnectWrite) { req.socket.destroy(); return; }
    if (key.endsWith('think_task') && options.failDevice && body.device_id === options.failDevice) { send({ error: 'task failure' }, 500); return; }
    if ((key.endsWith('think_operation_log') && options.failAudit) || (key.endsWith('think_media') && options.failRegister)) { send({ error: 'write failure' }, 500); return; }
    if (method === 'POST') { const value = ++nextId; rows.push({ ...body, id: value }); send(value); return; }
    const index = rows.findIndex(row => String(row.id) === match[2]);
    if (index < 0) { send(0); return; }
    if (method === 'PUT') rows[index] = { ...rows[index], ...body };
    if (method === 'DELETE') rows.splice(index, 1);
    send(1);
  });
  await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok));
  const address = server.address() as { port: number };
  const config = resolveConfig({ baseUrl: `http://127.0.0.1:${address.port}`, orgNum: '1001', authMode, actorUid: '7', actorNickname: 'API operator', apiKeyEnv: 'ZUAD_TEST_API_KEY', usernameEnv: 'ZUAD_TEST_USERNAME', passwordEnv: 'ZUAD_TEST_PASSWORD', fileRoot: directory });
  const client = new MediaClient(config), service = new MediaService(client), files = new MediaFiles(client);
  return { directory, server, config, client, service, files, table, calls, options };
}

test('login uses cookies, pins organization, serializes filters and paginates', () => fixture(async f => {
  await f.client.query('devices', { filters: ['device_name,cs,o'], include: 'device_name', limit: 1 });
  assert.equal(f.client.connectionStatus().connected, true);
  const query = f.calls.at(-1)!;
  assert.match(query.cookie, /sid=mock-session/);
  assert.deepEqual(query.query.getAll('filter[]'), ['device_name,cs,o', 'org_num,eq,1001']);
  assert.equal(query.query.get('include'), 'device_name,id,org_num');
  assert.deepEqual(query.query.getAll('join'), ['think_default_play']);
  const rows = await f.client.all('devices');
  assert.equal(rows.length, 2);
  assert.equal(f.calls.filter(v => v.path === '/api.php/login').length, 1);
  await assert.rejects(f.client.query('devices', { filters: ['bad filter'] }));
  await assert.rejects(f.client.update('devices', '21,22', {}));
}));

test('account login discovers organization and identity without deployment credentials', () => fixture(async f => {
  Object.assign(f.config, { orgNum: '', actorUid: '', username: 'ordinary-user', password: 'mock-account-password',
    usernameEnv: 'UNSET_ACCOUNT_USER', passwordEnv: 'UNSET_ACCOUNT_PASSWORD', apiKeyEnv: 'UNSET_ACCOUNT_KEY' });
  assert.equal(f.client.connectionStatus().connected, false);
  const identity = await f.client.verifyConnection();
  assert.equal(identity.orgNum, '1001'); assert.equal(identity.uid, '7');
  const login = f.calls.find(call => call.path === '/api.php/login')!;
  assert.deepEqual(login.body, { username: 'ordinary-user', password: 'mock-account-password', orgNum: '', orgNums: '' });
  const query = f.calls.at(-1)!;
  assert.equal(query.path, '/api.php/records/think_layout');
  assert.deepEqual(query.query.getAll('filter[]'), ['org_num,eq,1001']);
  assert.equal(query.apiKey, ''); assert.match(query.cookie, /sid=mock-session/);
  const status = f.client.connectionStatus();
  assert.equal(status.connected, true); assert.equal(status.hasPassword, true);
  assert.doesNotMatch(JSON.stringify(status), /mock-account-password|mock-session/);
  await f.client.logout();
  assert.equal(f.client.connectionStatus().connected, false);
}));

test('sign-out blocks automatic login even when deployment credentials exist', () => fixture(async f => {
  f.config.sessionEnabled = false;
  await assert.rejects(f.client.verifyConnection(), /sign in/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.client.connectionStatus().connected, false);
}));

test('a configured account never borrows the deployment password', () => fixture(async f => {
  Object.assign(f.config, { username: 'another-user', password: '' });
  await assert.rejects(f.client.verifyConnection(), /account and password/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.client.connectionStatus().hasPassword, false);
}));

test('account Sign-Code is used for backend requests and omitted from connection facts', () => fixture(async f => {
  f.options.loginData = { sign_id: 'mock-account-sign-code' };
  await f.client.verifyConnection();
  assert.equal(f.calls.at(-1)!.signCode, 'mock-account-sign-code');
  assert.doesNotMatch(JSON.stringify(f.client.connectionStatus()), /mock-account-sign-code/);
  await f.client.logout();
  assert.equal(f.client.connectionStatus().connected, false);
}));

test('account roles retain device restrictions after automatic organization discovery', () => fixture(async f => {
  f.config.orgNum = '';
  f.options.loginData = { groupid: 3 };
  f.table('roles').push({ id: 3, org_num: '1001', device_rules: '21' });
  await f.client.verifyConnection();
  const devices = await f.client.all('devices');
  assert.deepEqual(devices.map(device => device.id), [21]);
  await assert.rejects(f.client.get('devices', '22'), /not authorized/);
  f.options.ignoreScope = true;
  await assert.rejects(f.client.query('devices'), /outside the account scope/);
}));

test('failed or disabled account login leaves no connected state', () => fixture(async f => {
  f.config.orgNum = '';
  f.options.badLogin = true;
  await assert.rejects(f.client.verifyConnection(), /Backend rejected/);
  assert.equal(f.client.connectionStatus().connected, false);
  assert.equal(f.calls.length, 1);
  f.options.badLogin = false;
  f.options.loginData = { status: 0 };
  await assert.rejects(f.client.verifyConnection(), /Login rejected/);
  assert.equal(f.calls.length, 2);
}));

test('signed-out tools return a login action without exposing credentials or contacting the backend', () => fixture(async f => {
  const active = plugin.createTools({ ...f.config, sessionEnabled: false });
  const exec = { signal: new AbortController().signal } as any;
  try {
    const query = await active.tools.find(tool => tool.name === 'zuad_query')!.execute({ resource: 'programs' }, exec);
    assert.equal(query.code, 'AUTH_REQUIRED'); assert.equal(query.reason, 'not_signed_in');
    assert.equal(query.recovery.action, 'open_plugin_settings');
    assert.equal(query.recovery.package, 'dsh-plugin-zuad-media');
    const write = await active.tools.find(tool => tool.name === 'zuad_record')!.execute({ operation: 'create', resource: 'regions', data: { name: 'Unwritten' } }, exec);
    assert.equal(write.code, 'AUTH_REQUIRED'); assert.equal(write.uncertain, false);
    assert.equal(f.calls.length, 0);
    assert.doesNotMatch(JSON.stringify([query, write]), /test-password-never-render|test-api-key-never-render/);
  } finally { await active.close(); }
}));

test('an expired account session offers login without replaying the failed operation', () => fixture(async f => {
  const active = plugin.createTools(f.config);
  try {
    await active.client.verifyConnection();
    f.options.sessionStatus = 401;
    const before = f.calls.length;
    const result = await active.tools.find(tool => tool.name === 'zuad_query')!.execute({ resource: 'programs' }, { signal: new AbortController().signal } as any);
    assert.equal(result.code, 'AUTH_REQUIRED'); assert.equal(result.reason, 'expired');
    assert.equal(f.calls.length, before + 1);
    assert.equal(active.client.connectionStatus().connected, false);
    assert.equal(f.calls.filter(call => call.path === '/api.php/login').length, 1);
  } finally { await active.close(); }
}));

test('a forbidden operation stays a permission error and retains a verified account session', () => fixture(async f => {
  const active = plugin.createTools(f.config);
  try {
    await active.client.verifyConnection();
    f.options.sessionStatus = 403;
    const result = await active.tools.find(tool => tool.name === 'zuad_query')!.execute({ resource: 'programs' }, { signal: new AbortController().signal } as any);
    assert.equal(result.ok, false); assert.equal(result.code, undefined);
    assert.match(result.error, /HTTP 403/);
    assert.equal(active.client.connectionStatus().connected, true);
  } finally { await active.close(); }
}));

test('rejected saved credentials offer account correction rather than reporting an expired session', () => fixture(async f => {
  const active = plugin.createTools(f.config);
  f.options.badLogin = true;
  try {
    const result = await active.tools.find(tool => tool.name === 'zuad_session')!.execute({}, { signal: new AbortController().signal } as any);
    assert.equal(result.code, 'AUTH_REQUIRED'); assert.equal(result.reason, 'credentials_rejected');
    assert.equal(f.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /test-password-never-render/);
  } finally { await active.close(); }
}));

test('API key queries need no password or actor UID and preserve filters and pagination', () => fixture(async f => {
  f.config.usernameEnv = 'ZUAD_UNCONFIGURED_USERNAME'; f.config.passwordEnv = 'ZUAD_UNCONFIGURED_PASSWORD';
  f.config.actorUid = '';
  const result = await f.client.query('devices', { filters: ['device_name,cs,o'], include: 'device_name', order: 'id,asc', limit: 1, page: 1 });
  assert.equal(result.records.length, 1);
  const query = f.calls.at(-1)!;
  assert.equal(query.path, '/apikey.php/records/think_device');
  assert.equal(query.apiKey, 'test-api-key-never-render'); assert.equal(query.cookie, '');
  assert.deepEqual(query.query.getAll('filter[]'), ['device_name,cs,o', 'org_num,eq,1001']);
  assert.equal(query.query.get('include'), 'device_name,id,org_num'); assert.equal(query.query.get('order'), 'id,asc');
  assert.equal(query.query.get('size'), '1'); assert.equal(query.query.get('page'), '1');
  assert.equal(f.calls.some(call => call.path.endsWith('/login')), false);
  f.table('programs').push({ id: 99, org_num: '2002', layout: 'Other organization' });
  f.options.ignoreScope = true;
  await assert.rejects(f.client.query('programs'), /outside the configured organization/);
}, 'apiKey'));

test('API key writes preserve actor metadata and native HTTP methods and resource routes', () => fixture(async f => {
  Object.assign(f.config, { methodOverride: true });
  await f.service.crud('create', 'regions', { name: 'API lobby', pid: 0 });
  const row = f.table('regions')[0]!;
  assert.equal(row.uid, '7'); assert.equal(row.org_num, '1001');
  await f.client.update('regions', row.id, { name: 'Updated lobby', uid: '999' });
  await f.client.remove('regions', row.id);
  await f.client.create('events', { name: 'Error' });
  assert.ok(f.calls.some(call => call.path === `/apikey.php/records/think_region/${row.id}` && call.method === 'PUT' && call.body.uid === '7'));
  assert.ok(f.calls.some(call => call.path === `/apikey.php/records/think_region/${row.id}` && call.method === 'DELETE'));
  assert.ok(f.calls.some(call => call.path === '/apikey.php/records/think_event'));
  assert.ok(f.calls.every(call => call.method === call.httpMethod && call.methodOverride === undefined));
  assert.ok(f.calls.every(call => call.apiKey === 'test-api-key-never-render' && !call.cookie && !call.path.endsWith('/login')));
}, 'apiKey'));

test('queries accept page sizes above former caps and read beyond 100 server-limited pages', () => fixture(async f => {
  Object.assign(f.config, { maxResults: 1 });
  const rows = f.table('programs');
  rows.splice(0, rows.length, ...Array.from({ length: 102 }, (_, index) => ({ id: index + 1, org_num: '1001' })));
  const single = await f.client.query('programs', { limit: 10000 });
  assert.equal(single.records.length, 102);
  assert.equal(f.calls.at(-1)!.query.get('size'), '10000');
  f.options.pageSize = 1;
  const first = await f.client.query('programs');
  assert.equal(first.records.length, 1);
  assert.equal(first.possiblyTruncated, true);
  const all = await f.client.all('programs');
  assert.deepEqual(all.map(row => row.id), rows.map(row => row.id));
  assert.equal(f.calls.at(-1)!.query.get('page'), '103');
  assert.equal(f.calls.at(-1)!.query.get('order'), 'id,asc');
  assert.equal((await f.client.query('programs', { page: 103 })).possiblyTruncated, false);
  for (const limit of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(f.client.query('programs', { limit }), /Invalid limit/);
  for (const page of [0, -1, 1.5, Infinity]) await assert.rejects(f.client.query('programs', { page }), /Invalid limit\/page/);
}, 'apiKey'));

test('unbounded pagination still rejects repeating pages and stops on cancellation', () => fixture(async f => {
  f.options.pageSize = 1;
  f.options.repeatQueryPage = true;
  await assert.rejects(f.client.all('devices'), /pagination repeated records/);
  assert.equal(f.calls.length, 2);
  f.options.repeatQueryPage = false;
  const controller = new AbortController();
  const client = new MediaClient(f.config, async (url, init) => {
    const response = await fetch(url, init);
    controller.abort();
    return response;
  });
  try {
    const before = f.calls.length;
    await assert.rejects(client.all('devices', [], controller.signal));
    assert.equal(f.calls.length, before + 1);
  } finally { client.close(); }
}, 'apiKey'));

test('missing actor UID rejects dependent workflows before any mutation', () => fixture(async f => {
  f.config.actorUid = '';
  await assert.rejects(f.service.publish({ kind: 'program', id: '11' }, ['21']), /ZUAD_ACTOR_UID/);
  await assert.rejects(f.service.command('reboot_device', ['21']), /ZUAD_ACTOR_UID/);
  await assert.rejects(f.service.crud('create', 'regions', { name: 'Missing actor' }), /ZUAD_ACTOR_UID/);
  await assert.rejects(f.service.crud('delete', 'regions', {}, '1'), /ZUAD_ACTOR_UID/);
  assert.equal(f.calls.length, 0);
}, 'apiKey'));

test('API key covers multipart and legacy paths without rewriting non-PHP entry points', () => fixture(async f => {
  await writeFile(join(f.directory, 'poster.png'), 'image-bytes');
  const result = await f.files.execute('upload_material', { path: 'poster.png' });
  assert.equal(result.results[0].registered, true);
  assert.match(f.calls.find(call => call.path === '/apikey.php/uploadMaterialFile')!.body, /name="AllFile\[\]"/);
  const exported = await f.files.execute('export_program', { id: '11' });
  assert.equal(exported.downloadUrl, `${f.config.baseUrl}/exports/program.zip`);
  const body = { orgNum: '1001', uid: '7', id: 'test-plan' };
  await f.client.request('/api/v5/plan_model/startUpPlan', 'POST', body);
  assert.deepEqual(f.calls.at(-1)!.body, body);
  assert.equal(f.calls.at(-1)!.path, '/api/v5/plan_model/startUpPlan');
  assert.ok(f.calls.every(call => call.apiKey === 'test-api-key-never-render' && !call.cookie));
}, 'apiKey'));

test('image uploads infer MIME by extension and preserve explicit MIME overrides', () => fixture(async f => {
  for (const [name, mimeType, expected] of [
    ['poster.png', undefined, 'image/png'],
    ['photo.JPG', undefined, 'image/jpeg'],
    ['asset.bin', undefined, 'application/octet-stream'],
    ['custom.png', 'application/x-custom-image', 'application/x-custom-image'],
  ] as const) {
    await writeFile(join(f.directory, name), 'file-bytes');
    await f.files.execute('upload_material', { path: name, ...(mimeType ? { mimeType } : {}) });
    const upload = f.calls.filter(call => call.path === '/apikey.php/uploadMaterialFile').at(-1)!;
    assert.ok(upload.body.includes(`Content-Type: ${expected}\r\n`), `${name}: ${expected}`);
  }
}, 'apiKey'));

test('uploads accept files above 200 MiB without buffering the entire file', () => fixture(async f => {
  Object.assign(f.config, { maxUploadMiB: 1 });
  const size = 201 * 1024 ** 2;
  const handle = await open(join(f.directory, 'large.png'), 'w');
  try {
    await handle.truncate(size);
    await handle.write(Buffer.from('file-end'), 0, 8, size - 8);
  } finally { await handle.close(); }
  let uploads = 0;
  const client = new MediaClient(f.config, async (url, init) => {
    if (String(url).endsWith('/uploadMaterialFile')) {
      assert.ok(init?.body instanceof FormData);
      const file = init.body.get('AllFile[]');
      assert.ok(file instanceof Blob);
      assert.equal(file.size, size); assert.equal(file.type, 'image/png');
      assert.equal(await file.slice(size - 8).text(), 'file-end');
      uploads++;
      return Response.json({ resultData: [{ sourceName: 'large.png', encryptionName: 'large.png', recordStart: 'uploads/large.png', fileSize: size, fileMd5: 'c'.repeat(32), fileSourceType: 1 }] });
    }
    return fetch(url, init);
  });
  try {
    const result = await new MediaFiles(client).execute('upload_material', { path: 'large.png' });
    assert.equal(uploads, 1); assert.equal(result.results[0].registered, true);
    assert.equal(f.table('materials')[0]!.fileSize, size);
    await writeFile(join(f.directory, 'empty.png'), '');
    await assert.rejects(new MediaFiles(client).execute('upload_material', { path: 'empty.png' }), /empty or not a regular file/);
  } finally { client.close(); }
}, 'apiKey'));

test('file-backed chunk uploads retain boundaries, metadata and material registration', () => fixture(async f => {
  const size = 5 * 1024 ** 2 + 13;
  const bytes = Buffer.alloc(size, 'x'); bytes.write('end-of-upload', size - 13);
  await writeFile(join(f.directory, 'chunked.png'), bytes);
  const result = await f.files.execute('upload_chunks', { path: 'chunked.png' });
  assert.equal(result.chunks, 2); assert.equal(result.results[0].registered, true);
  const calls = f.calls.filter(call => call.path.endsWith('/sliceUploadFile'));
  assert.equal(calls.length, 2);
  for (let index = 0; index < calls.length; index++) {
    assert.ok(calls[index]!.body.includes(JSON.stringify({ name: 'chunked.png', size, type: 'image/png', index, total: 2 })));
    assert.match(calls[index]!.body, /Content-Type: image\/png/);
  }
  assert.match(calls[1]!.body, /end-of-upload/);
  assert.equal(f.table('materials').length, 1);
}, 'apiKey'));

test('invalid or missing API key fails without login fallback or write retry', () => fixture(async f => {
  process.env.ZUAD_TEST_BAD_API_KEY = 'invalid-key-never-render';
  f.config.apiKeyEnv = 'ZUAD_TEST_BAD_API_KEY';
  try {
    await assert.rejects(f.client.query('programs'), error => error instanceof ApiError && error.status === 401 && !error.message.includes('invalid-key-never-render'));
    await assert.rejects(f.client.create('regions', { name: 'Denied' }), error => error instanceof ApiError && error.status === 401 && !error.uncertain);
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls.some(call => call.path.endsWith('/login')), false);
    delete process.env.ZUAD_TEST_BAD_API_KEY;
    await assert.rejects(f.client.query('programs'), /ZUAD_TEST_BAD_API_KEY/);
    assert.equal(f.calls.length, 2);
  } finally { delete process.env.ZUAD_TEST_BAD_API_KEY; }
}, 'apiKey'));

test('API key is not forwarded to the separately configured PTZ gateway', () => fixture(async f => {
  let forwarded: unknown;
  const gateway = createServer((req, res) => { forwarded = req.headers['x-api-key']; res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); });
  await new Promise<void>(ok => gateway.listen(0, '127.0.0.1', ok));
  try {
    f.config.ptzBaseUrl = `http://127.0.0.1:${(gateway.address() as { port: number }).port}`;
    await f.client.request('/api/v1/gb28181', 'GET', undefined, { action: 'sip_ptz' }, undefined, false, false, true);
    assert.equal(forwarded, undefined);
  } finally { gateway.closeAllConnections(); await new Promise<void>(ok => gateway.close(() => ok())); }
}, 'apiKey'));

test('failed login, wrong tenant and out-of-role devices fail before mutation', () => fixture(async f => {
  f.options.badLogin = true;
  await assert.rejects(f.client.login());
  f.options.badLogin = false; f.options.roleDevices = '21';
  await assert.rejects(f.service.publish({ kind: 'program', id: '11' }, ['22']));
  assert.equal(f.calls.filter(v => v.method !== 'GET' && v.path !== '/api.php/login').length, 0);
  f.table('tasks').push({ id: 9, org_num: '1001', device_id: 'SERIAL-B', condition: 0 });
  await assert.rejects(f.client.remove('tasks', '9'), /not found/);
  f.table('devices').push({ id: 99, org_num: '2002', device_id: 'OTHER', device_name: 'Other' });
  f.options.ignoreScope = true;
  await assert.rejects(f.client.query('devices'), /outside/);
}));

test('publishing resolves group membership, removes pending duplicates and returns partial progress', () => fixture(async f => {
  f.table('tasks').push({ id: 51, org_num: '1001', device_id: 'SERIAL-A', task_name: 'update_layout', condition: 0 },
    { id: 52, org_num: '1001', device_id: 'SERIAL-A', task_name: 'update_layout', condition: 2, play_time: 1, layout_name: 'Old' });
  f.table('devices')[0]!.layout_id = 9;
  f.options.failDevice = 'SERIAL-B';
  const result = await f.service.publish({ kind: 'group', id: '41' }, [], ['31']);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0]!.ok, true); assert.equal(result.results[1]!.ok, false);
  assert.equal(result.results[1]!.uncertain, true);
  assert.equal(f.table('tasks').some(v => v.id === 51), false);
  assert.equal(f.table('tasks').some(v => v.id === 52), true);
  const task = f.table('tasks').find(v => v.id !== 52)!;
  assert.equal(task.device_id, 'SERIAL-A'); assert.equal(task.layout_group_id, 41); assert.equal(task.play_id, '11');
  assert.equal(f.table('play_history')[0]!.device_id, 21);
  assert.equal(f.table('play_history')[0]!.layout_id, 9);
  assert.equal(f.table('devices')[1]!.layout_group_id, 41);
  assert.deepEqual(result.results[1]!.steps.map((v: Data) => v.action), ['update_device_program']);
  assert.equal(f.calls.filter(v => v.method === 'POST' && v.path.endsWith('think_task')).length, 2);
}));

test('audit failure preserves successful task status; screenshot code and update package validation', () => fixture(async f => {
  f.options.failAudit = true;
  const result = await f.service.command('upload_screenshot', ['21']);
  assert.equal(result.results[0]!.ok, true); assert.match(result.results[0]!.warning, /audit log failed/);
  assert.equal(f.table('tasks')[0]!.code, 1);
  await assert.rejects(f.service.command('update_app', ['21']), /packageId/);
  await assert.rejects(f.service.command('arbitrary_command', ['21']));
}));

test('transport failure on a write is not retried; cancellation prevents dispatch', () => fixture(async f => {
  await f.client.login(); f.options.disconnectWrite = true;
  await assert.rejects(f.client.create('products', { commodity: 'A' }), error => error instanceof ApiError && error.uncertain);
  assert.equal(f.calls.filter(v => v.path.endsWith('think_commodity') && v.method === 'POST').length, 1);
  const abort = new AbortController(); abort.abort();
  const count = f.calls.length;
  await assert.rejects(f.service.publish({ kind: 'program', id: '11' }, ['21'], [], abort.signal));
  assert.equal(f.calls.length, count);
}));

test('native HTTP administration updates preserve identity', () => fixture(async f => {
  f.table('users').push({ id: 61, org_num: '1001', username: 'bob' });
  await f.service.crud('update', 'users', { nickname: 'Bob', org_num: '9999', uid: '9999' }, '61');
  assert.equal(f.table('users')[0]!.org_num, '1001'); assert.equal(f.table('users')[0]!.uid, '7');
  assert.equal(f.calls.find(v => v.path.endsWith('/61') && v.method === 'PUT')?.body.nickname, 'Bob');
  await assert.rejects(f.service.crud('create', 'tasks', { task_name: 'x' }), /specialized/);
  await assert.rejects(f.service.crud('update', 'devices', { layout_id: 11 }, '21'), /publish/);
  f.table('seats').push({ id: 62, org_num: '1001', name: 'Seat' });
  await f.client.update('seats', '62', { seatsName: 'Updated' });
  assert.equal(f.calls.find(v => v.path.endsWith('/62') && v.method === 'PUT')!.body.orgNum, '1001');
  assert.equal(f.calls.find(v => v.path.endsWith('/62') && v.method === 'GET'), undefined);
  await f.client.create('events', { name: 'Error' });
  assert.ok(f.calls.some(v => v.path === '/apikey.php/records/think_event'));
  assert.ok(f.calls.every(call => call.method === call.httpMethod && call.methodOverride === undefined));
}));

test('schedule conflict checks resolve device groups and accept adjacent intervals', () => fixture(async f => {
  const start = Math.floor(Date.now() / 1000) + 3600;
  f.table('schedules').push({ id: 71, org_num: '1001', play_id: '21', start_time: start, end_time: start + 60, time_frame: 'custom' });
  const input = { kind: 'schedule', name: 'Morning', target: { kind: 'program', id: '11' }, deviceKind: 'group', deviceId: '31', startTime: start + 30, endTime: start + 90 } as const;
  const conflict = await f.service.schedule(input); assert.equal(conflict.saved, false); assert.deepEqual(conflict.conflicts, [71]);
  const saved = await f.service.schedule({ ...input, startTime: start + 60 }); assert.equal(saved.saved, true);
  assert.equal(f.table('schedules').at(-1)!.play_id, '21,22');
  const intervals = scheduleIntervals({ start_time: Date.parse('2030-01-01T09:00:00+08:00') / 1000, end_time: Date.parse('2030-01-02T10:00:00+08:00') / 1000, time_frame: 'next_week', appoint_date: '["2030-02-01","2030-02-03"]' });
  assert.equal(intervals.length, 2); assert.equal(intervals[0]![1] - intervals[0]![0], 3600);
  assert.throws(() => scheduleIntervals({ start_time: 1, end_time: 2, time_frame: 'next_week', appoint_date: '["2030-02-31"]' }));
}));

test('multipart upload registers/deduplicates assets and preserves upload evidence on registration failure', () => fixture(async f => {
  await writeFile(join(f.directory, 'poster.png'), 'image-bytes');
  const result = await f.files.execute('upload_material', { path: 'poster.png' });
  assert.equal(result.results[0].registered, true);
  assert.match(f.calls.find(v => v.path === '/api.php/uploadMaterialFile')!.body, /name="AllFile\[\]"/);
  assert.equal(f.table('materials').length, 1);
  await f.files.execute('upload_material', { path: 'poster.png' });
  assert.equal(f.table('materials').length, 1);
  f.options.failRegister = true;
  const failed = await f.files.execute('upload_material', { path: 'poster.png' });
  assert.equal(failed.results[0].uploaded, true); assert.equal(failed.results[0].registered, false);
  await assert.rejects(f.files.execute('upload_material', { path: '../outside.txt' }));
  const exported = await f.files.execute('export_program', { id: '11' });
  assert.equal(exported.downloadUrl, `${f.config.baseUrl}/exports/program.zip`);
}));

test('resource catalog routes match the extracted source tables', async () => {
  const inventory = JSON.parse(await readFile(new URL('../docs/media-api-inventory.json', import.meta.url), 'utf8'));
  const observed = inventory.endpoints.flatMap((endpoint: Data) => endpoint.requests.map((r: Data) => r.url));
  for (const spec of Object.values(resources)) assert.ok(observed.some((url: string) => url.includes(`/records/${spec.table}`)), `Unobserved table ${spec.table}`);
});

test('material registration retains preview, document page count and media duration', () => fixture(async f => {
  f.options.uploadMetadata = { fileSourceType: 'video/mp4', filePreview: 'uploads/preview/clip.jpg', page_size: 3, duration: 90 };
  await writeFile(join(f.directory, 'clip.mp4'), 'video-bytes');
  const uploaded = await f.files.execute('upload_material', { path: 'clip.mp4', mimeType: 'video/mp4' });
  assert.equal(uploaded.results[0].registered, true);
  const material = f.table('materials')[0]!;
  assert.equal(material.filePreview, 'uploads/preview/clip.jpg');
  assert.equal(material.page_size, 3);
  assert.equal(material.duration, 90);
  assert.equal(material.means_code, 1);
}));

test('native Cordis/DSH registry validates schemas, executes tools and disposes registrations', () => fixture(async f => {
  const ctx = new Context();
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime, { mode: 'native' });
  const loaded = await ctx.plugin(plugin, f.config);
  try {
    assert.equal(ctx.tools.schemas().length, 13);
    const result = await ctx.tools.execute({ callId: 'test-call' as any, name: 'zuad_query', arguments: { resource: 'devices' }, signal: new AbortController().signal });
    assert.equal(result.isError, false);
    assert.equal((result as any).value.ok, true);
    assert.equal((result as any).value.data.records.length, 2);
    assert.doesNotMatch(JSON.stringify(result), /test-password-never-render/);
    const write = await ctx.tools.execute({ callId: 'test-create' as any, name: 'zuad_record', arguments: { operation: 'create', resource: 'regions', data: { name: 'Lobby', pid: 0 } }, signal: new AbortController().signal });
    assert.equal((write as any).value.ok, true);
    const region = f.table('regions')[0]!;
    assert.equal(region.org_num, '1001'); assert.equal(region.uid, '7'); assert.equal(region.oid.length, 32); assert.ok(region.create_time > 0);
    const invalid = await ctx.tools.execute({ callId: 'test-invalid' as any, name: 'zuad_query', arguments: { resource: 'arbitrary_table' }, signal: new AbortController().signal });
    assert.equal(invalid.isError, true);
  } finally { await loaded.dispose(); assert.equal(ctx.tools.schemas().length, 0); await ctx.fiber.dispose(); }
}));

test('native session tool verifies API key access without reporting secrets or logging in', () => fixture(async f => {
  const ctx = new Context();
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime, { mode: 'native' });
  const loaded = await ctx.plugin(plugin, f.config);
  try {
    const result = await ctx.tools.execute({ callId: 'key-check' as any, name: 'zuad_session', arguments: {}, signal: new AbortController().signal });
    assert.equal((result as any).value.ok, true);
    assert.equal((result as any).value.data.authMode, 'apiKey');
    assert.equal((result as any).value.data.verified, true);
    assert.doesNotMatch(JSON.stringify(result), /test-api-key-never-render/);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0]!.path, '/apikey.php/records/think_layout');
    assert.equal(f.calls[0]!.cookie, '');
  } finally { await loaded.dispose(); await ctx.fiber.dispose(); }
}, 'apiKey'));

test('native ID query forwards include and preserves identity and organization checks', () => fixture(async f => {
  const ctx = new Context();
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime, { mode: 'native' });
  const loaded = await ctx.plugin(plugin, f.config);
  try {
    const result = await ctx.tools.execute({ callId: 'id-query' as any, name: 'zuad_query', arguments: { resource: 'programs', id: '11', include: 'layout' }, signal: new AbortController().signal });
    assert.equal((result as any).value.ok, true);
    assert.deepEqual((result as any).value.data, { id: 11, layout: 'Promotion', org_num: '1001' });
    const query = f.calls.at(-1)!;
    assert.equal(query.query.get('include'), 'layout,id,org_num');
    assert.deepEqual(query.query.getAll('filter[]'), ['id,eq,11', 'org_num,eq,1001']);
    await assert.rejects(f.client.get('programs', '11', undefined, false, 'layout;bad'), /Invalid include/);
  } finally { await loaded.dispose(); await ctx.fiber.dispose(); }
}, 'apiKey'));

test('configuration and output redaction', () => {
  assert.ok(Config['~standard']);
  assert.equal(resolveConfig().authMode, 'session');
  assert.throws(() => resolveConfig({ baseUrl: 'https://example.com/api?x=1' }));
  assert.throws(() => resolveConfig({ orgNum: '1,2' }));
  assert.deepEqual(plugin.redact({ password: 'x', nested: { token: 'y' }, name: 'api_key', value: 'z' }), { password: '[redacted]', nested: { token: '[redacted]' }, name: 'api_key', value: '[redacted]' });
});

test('account settings mark the password secret and preserve administrator API-key configuration', () => {
  const live = plugin.Config({ baseUrl: 'https://example.com', orgNum: '1001', apiKeyEnv: 'DEPLOYMENT_KEY' });
  assert.equal(readPluginConfig(live).baseUrl, 'https://example.com');
  assert.equal(readPluginConfig(live).apiKeyEnv, 'DEPLOYMENT_KEY');
  for (const key of editableConfigKeys) assert.equal(plugin.Config.dict![key]!.meta.volatile, true);
  assert.deepEqual(editableConfigKeys, ['baseUrl', 'authMode', 'username', 'password', 'sessionEnabled', 'orgNum', 'actorUid', 'actorNickname', 'timeoutMs']);
  assert.equal(plugin.Config.dict!.password!.meta.role, 'secret');
  for (const key of ['maxResults', 'maxUploadMiB', 'methodOverride']) assert.equal(plugin.Config.dict![key], undefined);
  for (const key of ['apiKeyEnv', 'usernameEnv', 'passwordEnv', 'signCodeEnv']) assert.notEqual(plugin.Config.dict![key]!.meta.volatile, true);
  assert.equal(Config({ orgNum: '1001' }).orgNum, '1001');
});

test('live settings apply to new calls while an in-flight query keeps its original organization', () => fixture(async f => {
  f.table('programs').push({ id: 12, org_num: '1002', layout: 'Second organization', content: '{}' });
  let current = { ...f.config };
  const live = plugin.createLiveTools(() => current);
  const query = live.tools.find(tool => tool.name === 'zuad_query')!;
  const exec = { signal: new AbortController().signal } as Parameters<typeof query.execute>[1];
  let release!: () => void;
  f.options.queryGate = new Promise<void>(resolve => { release = resolve; });
  try {
    const first = query.execute({ resource: 'programs' }, exec);
    while (!f.calls.length) await new Promise(resolve => setTimeout(resolve, 5));
    f.options.queryGate = undefined;
    current = { ...current, orgNum: '1002', actorUid: '8' };
    const second = await query.execute({ resource: 'programs' }, exec);
    assert.equal(second.ok, true);
    assert.equal(second.data.records[0].id, 12);
    release();
    const original = await first;
    assert.equal(original.ok, true);
    assert.equal(original.data.records[0].id, 11);
    assert.equal(f.calls[0]!.query.getAll('filter[]').at(-1), 'org_num,eq,1001');
    assert.equal(f.calls[1]!.query.getAll('filter[]').at(-1), 'org_num,eq,1002');
    await live.close();
    await assert.rejects(query.execute({ resource: 'programs' }, exec), /closed/);
  } finally { release(); await live.close(); }
}, 'apiKey'));

test('bundled compiler creates, patches and saves without an editor or browser', () => fixture(async f => {
  f.config.editorRoot = 'missing-editor'; f.config.browserExecutable = 'missing-browser';
  f.config.timeoutMs = 60000;
  const renderer = new LayoutRenderer(f.client, f.files);
  try {
    const compiled = await renderer.execute({ operation: 'compile', width: 960, height: 540, previewPath: 'preview.png', slides: [{ duration: 10, components: [{ type: 'text', content: 'Zuad Test Program', width: '900px', height: '180px', top: '100px', left: '30px', fontsize: 48, clase: '#162a24' }] }] });
    assert.match(compiled.generateHtml, /Zuad&nbspTest&nbspProgram/); assert.match(compiled.generateScript, /baseWidth: 960/);
    const state = JSON.parse(compiled.content); assert.equal(state.ss.width, 960); assert.equal(state['slide-container-1']['0'].itemData.content, 'Zuad Test Program');
    const png = await readFile(join(f.directory, 'preview.png')); assert.ok(png.length > 3000);
    const output = resolve('test-results'); await mkdir(output, { recursive: true }); await writeFile(join(output, 'layout-preview.png'), png);
    const saved = await renderer.execute({ operation: 'save_program', name: 'AI layout', content: state, patches: [{ slide: 1, index: 0, changes: { content: 'Changed program' } }] });
    assert.equal(saved.saved, true);
    assert.match(f.table('programs').at(-1)!.generateHtml, /Changed&nbspprogram/);
    assert.equal(f.table('programs').at(-1)!.file_img, 'uploads/hash.png');
    assert.equal(JSON.parse(f.table('programs').at(-1)!.content)['slide-container-1']['0'].id, '#pover-text');
  } finally { await renderer.close(); }
}));

test('real UI fixtures preserve all 19 visible controls when recompiled', () => fixture(async f => {
  f.config.timeoutMs = 60000;
  const renderer = new LayoutRenderer(f.client, f.files);
  const observedTypes = new Set<string>();
  try {
    for (const fixtureId of [373, 374, 375]) {
      const original = JSON.parse(await readFile(resolve(`docs/fixtures/real-layouts/${fixtureId}.json`), 'utf8'));
      const compiled = await renderer.execute({ operation: 'compile', content: original.content });
      const actual = JSON.parse(compiled.content);
      assert.equal(actual.ss.width, original.pageWidth);
      assert.equal(actual.ss.height, original.pageHeight);
      for (const key of Object.keys(original.content).filter(key => key.startsWith('slide-container-'))) {
        assert.equal(actual[key].slide.deadtime, original.content[key].slide.deadtime);
        for (const index of Object.keys(original.content[key]).filter(key => /^\d+$/.test(key))) {
          const expectedItem = original.content[key][index].itemData;
          const actualItem = actual[key][index].itemData;
          observedTypes.add(expectedItem.type);
          for (const field of ['type', 'uuid', 'top', 'left', 'width', 'height', 'content', 'fontsize', 'timeformat', 'queueList', 'htmlText', 'webMixedWebList']) {
            assert.deepEqual(actualItem[field], expectedItem[field], `${fixtureId}/${key}/${index}/${field}`);
          }
        }
      }
      assert.equal(JSON.parse(compiled.file_list).length, original.file_list.length);
      assert.equal(compiled.size, original.size);
    }
    assert.equal(observedTypes.size, 19);
  } finally { await renderer.close(); }
}));

test('media queues rebuild editable thumbnails and counts across save and reopen', () => fixture(async f => {
  f.config.timeoutMs = 60000;
  const renderer = new LayoutRenderer(f.client, f.files);
  const first = { fileUuid: 'first', sourceName: encodeURIComponent('新品 "<b>特惠</b>.png'), fileType: 'IMAGE', recordStart: 'uploads/first.png', filePreview: '', fileMd5: 'a'.repeat(32), fileSize: 10, pageSize: 1, duration: 4, durationSum: 4 };
  const second = { ...first, fileUuid: 'second', sourceName: 'second.png', recordStart: 'uploads/second.png', filePreview: 'uploads/second.png', fileMd5: 'b'.repeat(32), fileSize: 20, color: '#2b6598' };
  const pdf = { ...first, fileUuid: 'pdf', sourceName: 'menu.pdf', fileType: 'PDF', recordStart: 'uploads/menu.pdf', filePreview: 'uploads/menu/0.jpg', fileMd5: 'c'.repeat(32), pageSize: 3, color: ' ' };
  try {
    const saved = await renderer.execute({ operation: 'save_program', name: 'Editable media', width: 960, height: 540, slides: [{ components: [
      { type: 'image', width: '480px', height: '270px', queueList: [first, second] },
      { type: 'grid', left: '480px', width: '480px', height: '270px', queueList: [first, pdf] },
      { type: 'webMixed', width: '480px', height: '270px', queueList: [first, pdf], webMixedWebList: [{ oid: 'web-1', type: 'WEB', name: 'Example', url: 'https://example.com/' }] },
    ] }] });
    assert.equal(saved.saved, true);
    const record = f.table('programs').at(-1)!;
    const state = JSON.parse(record.content);
    const image = state['slide-container-1']['0'].itemData;
    assert.equal(image.pagesize, 2);
    assert.equal((image.uploadingMoreThanOnePictureFile.match(/<li\b/g) ?? []).length, 2);
    assert.match(image.uploadingMoreThanOnePictureFile, /data-base="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/);
    assert.match(image.uploadingMoreThanOnePictureFile, /data-ppt="uploads\/first.png"/);
    assert.match(image.uploadingMoreThanOnePictureFile, /&lt;b&gt;/);
    assert.doesNotMatch(image.uploadingMoreThanOnePictureFile, /<b>/);
    assert.equal(image.queueList[0].filePreview, 'uploads/first.png');
    assert.match(image.queueList[0].color, /^#[0-9a-f]{6}$/i);
    assert.equal(image.queueList[1].color, second.color);
    assert.deepEqual(image.queueList.map((entry: Data) => [entry.fileUuid, entry.duration]), [['first', 4], ['second', 4]]);
    assert.equal(state['slide-container-1']['1'].itemData.pagesize, 4);
    assert.match(state['slide-container-1']['1'].itemData.queueList[1].color, /^#[0-9a-f]{6}$/i);
    const webMixed = state['slide-container-1']['2'].itemData;
    assert.equal(webMixed.pagesize, 4);
    assert.equal(webMixed.src, first.recordStart);
    assert.equal((webMixed.uploadingMoreThanOnePictureFile.match(/<li\b/g) ?? []).length, 2);
    assert.deepEqual(webMixed.webMixedWebList, [{ oid: 'web-1', type: 'WEB', name: 'Example', url: 'https://example.com/' }]);
    assert.equal(JSON.parse(record.file_list)[0].color, image.queueList[0].color);
    const unchanged = JSON.parse((await renderer.execute({ operation: 'compile', content: state })).content);
    assert.deepEqual(unchanged['slide-container-1']['0'].itemData.queueList, image.queueList);
    const reopened = await renderer.execute({ operation: 'compile', content: state, patches: [{ slide: 1, index: 0, changes: { queueList: [second] } }, { slide: 1, index: 1, changes: { queueList: [] } }] });
    const actual = JSON.parse(reopened.content)['slide-container-1'];
    assert.equal(actual['0'].itemData.pagesize, 1);
    assert.equal((actual['0'].itemData.uploadingMoreThanOnePictureFile.match(/<li\b/g) ?? []).length, 1);
    assert.doesNotMatch(actual['0'].itemData.uploadingMoreThanOnePictureFile, /uploads\/first.png/);
    assert.equal(actual['1'].itemData.pagesize, 0);
    assert.equal(actual['1'].itemData.uploadingMoreThanOnePictureFile, '');
  } finally { await renderer.close(); }
}));

test('native backend image properties survive plugin creation and reopening', () => fixture(async f => {
  f.config.timeoutMs = 60000;
  const renderer = new LayoutRenderer(f.client, f.files);
  const native = JSON.parse(await readFile(resolve('docs/fixtures/real-layouts/385.json'), 'utf8'));
  const expected = native.content['slide-container-1']['0'].itemData;
  const supplied = structuredClone(expected);
  for (const field of ['content', 'signincontent', 'src', 'uploadingMoreThanOnePictureFile', 'pagesize']) delete supplied[field];
  for (const entry of supplied.queueList) delete entry.color;
  try {
    const result = await renderer.execute({ operation: 'save_program', name: 'Native image properties', width: native.pageWidth, height: native.pageHeight,
      slides: [{ duration: native.content['slide-container-1'].slide.deadtime, components: [supplied] }] });
    assert.equal(result.saved, true);
    const record = f.table('programs').at(-1)!;
    const state = JSON.parse(record.content);
    const actual = state['slide-container-1']['0'].itemData;
    assert.deepEqual(Object.keys(expected).filter(field => !Object.hasOwn(actual, field)), []);
    for (const field of Object.keys(expected).filter(field => !['content', 'signincontent', 'uploadingMoreThanOnePictureFile', 'queueList'].includes(field))) {
      assert.deepEqual(actual[field], expected[field], field);
    }
    assert.equal(typeof actual.content, 'string');
    assert.equal(typeof actual.signincontent, 'string');
    for (let i = 0; i < expected.queueList.length; i++) {
      assert.deepEqual(Object.keys(actual.queueList[i]).sort(), Object.keys(expected.queueList[i]).sort());
      for (const field of Object.keys(expected.queueList[i]).filter(field => field !== 'color')) assert.deepEqual(actual.queueList[i][field], expected.queueList[i][field]);
    }
    const reopened = JSON.parse((await renderer.execute({ operation: 'compile', content: state })).content)['slide-container-1']['0'].itemData;
    assert.deepEqual(reopened, actual);
  } finally { await renderer.close(); }
}));

test('layout describe exposes the observed controls without login or editor configuration', () => fixture(async f => {
  const renderer = new LayoutRenderer(f.client, f.files);
  const description = await renderer.execute({ operation: 'describe' });
  assert.equal(description.controls.filter((control: Data) => control.visibleInProgramMenu).length, 19);
  const clock = await renderer.execute({ operation: 'describe', componentType: 'clock' });
  assert.ok(clock.controls[0].fields.some((field: Data) => field.field === 'timeformat'));
  const web = await renderer.execute({ operation: 'describe', componentType: 'webbrowser' });
  assert.ok(web.controls[0].fields.some((field: Data) => field.field === 'bindControlOid' && field.event === 'input'));
  assert.equal(f.calls.length, 0);
  await assert.rejects(renderer.execute({ operation: 'describe', componentType: 'unknown' }), /Unknown component/);
}));

test('saving a structured table uploads a fresh raster and references it in playback', () => fixture(async f => {
  f.config.timeoutMs = 60000;
  f.options.uploadMetadata = { fileSourceType: 'image/png', filePreview: '', page_size: 1 };
  const renderer = new LayoutRenderer(f.client, f.files);
  try {
    const result = await renderer.execute({ operation: 'save_program', name: 'Table raster regression', width: 800, height: 450, slides: [{ components: [{ type: 'table', width: '800px', height: '450px', fontsize: 40, cells: [['Name', 'Value'], ['<A & B>', '42']] }] }] });
    assert.equal(result.saved, true);
    assert.deepEqual(result.tableImages, ['uploads/hash.png']);
    const record = f.table('programs').at(-1)!;
    const data = JSON.parse(record.content)['slide-container-1']['0'].itemData;
    assert.equal(data.horizontal, 2); assert.equal(data.vertical, 2);
    assert.match(data.htmlText, /&lt;A &amp; B&gt;/);
    assert.match(data.htmlText, /font-size: 20px/);
    assert.match(data.htmlText, /line-height: 20px/);
    assert.equal(data.queueList[0].recordStart, 'uploads/hash.png');
    assert.equal(data.queueList[0].filePreview, 'uploads/hash.png');
    assert.match(data.queueList[0].color, /^#[0-9a-f]{6}$/i);
    assert.equal(JSON.parse(record.file_list)[0].recordStart, 'uploads/hash.png');
    assert.match(record.generateHtml, /uploads\/hash\.png/);
    assert.equal(f.table('materials').length, 1);
    assert.equal(f.table('materials')[0]!.recordStart, data.queueList[0].recordStart);
    assert.equal(f.table('materials')[0]!.filePreview, 'uploads/hash.png');
    assert.equal(f.calls.filter(call => call.path === '/apikey.php/uploadMaterialFile').length, 2);
    assert.ok(f.calls.find(call => call.path === '/apikey.php/uploadMaterialFile')!.body.includes('table.png'));
    assert.ok(f.calls.every(call => call.apiKey === 'test-api-key-never-render' && !call.cookie && !call.path.endsWith('/login')));
    f.options.failRegister = true;
    await assert.rejects(renderer.execute({ operation: 'save_program', name: 'Must not save without registered table', width: 800, height: 450,
      slides: [{ components: [{ type: 'table', width: '800px', height: '450px', cells: [['Blocked']] }] }] }),
    error => error instanceof ApiError && error.uncertain && /material registration failed/.test(error.message));
    assert.equal(f.table('programs').length, 2);
  } finally { await renderer.close(); }
}, 'apiKey'));
