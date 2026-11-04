import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createCodexServer } from '../src/codex/server.js';
import { CodexConnection } from '../src/codex/connection.js';
import { ConnectionStore } from '../src/codex/store.js';

async function fixture(run: (context: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const context = await setup();
  try { await run(context); }
  finally { await context.client.close(); await context.app.close(); context.backend.closeAllConnections(); await new Promise<void>(resolve => context.backend.close(() => resolve())); await rm(context.directory, { recursive: true, force: true }); }
}
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'zuad-codex-'));
  const calls: { path: string; method: string }[] = [];
  const options = { rejected: false, status: 0, wrongScope: false };
  const backend = createServer(async (request, response) => {
    calls.push({ path: request.url!, method: request.method! });
    let body = '';
    for await (const chunk of request) body += chunk;
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api.php/login') {
      const data = JSON.parse(body);
      if (options.rejected || data.password !== 'mock-test-password') { response.end(JSON.stringify({ code: 1023 })); return; }
      response.setHeader('Set-Cookie', 'sid=test-signage-session; Path=/; HttpOnly');
      response.end(JSON.stringify({ id: 7, org_num: '1001', nickname: 'Operator', status: 1 })); return;
    }
    if (options.status || !request.headers.cookie?.includes('sid=test-signage-session')) {
      response.statusCode = options.status || 401; response.end(JSON.stringify({ error: 'refused' })); return;
    }
    response.end(JSON.stringify({ records: [{ id: 11, org_num: options.wrongScope ? '2002' : '1001', layout: 'Mock program' }] }));
  });
  await new Promise<void>(resolve => backend.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(backend.address() as { port: number }).port}`;
  const connection = new CodexConnection(new ConnectionStore(directory));
  const app = await createCodexServer(connection);
  const client = new Client({ name: 'signage-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await app.server.connect(serverTransport);
  await client.connect(clientTransport);
  const link = await fetch(app.page.loginUrl, { redirect: 'manual' });
  const cookie = link.headers.get('set-cookie')!.split(';')[0]!;
  const web = async (path: string, body?: unknown, headers: Record<string, string> = {}) => fetch(app.page.origin + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, ...(body === undefined ? {} : { Origin: app.page.origin, 'Content-Type': 'application/json', 'X-Zuad-Request': '1' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    return { ...result, value: JSON.parse((result.content as { text: string }[])[0]!.text) };
  };
  const signIn = () => web('/api/login', { baseUrl, username: 'test-user', password: 'mock-test-password' });
  return { directory, backend, baseUrl, calls, options, connection, app, client, cookie, web, call, signIn };
}

test('MCP handshake discovers every signage tool, schemas and read/write annotations', () => fixture(async f => {
  const { tools } = await f.client.listTools();
  assert.equal(tools.length, 14);
  assert.equal(tools.find(tool => tool.name === 'zuad_query')!.annotations!.readOnlyHint, true);
  assert.equal(tools.find(tool => tool.name === 'zuad_publish')!.annotations!.destructiveHint, true);
  const publish = tools.find(tool => tool.name === 'zuad_publish')!;
  assert.deepEqual(publish.inputSchema.required, ['target']);
  assert.deepEqual((publish.inputSchema.properties!.target as any).required, ['kind', 'id']);
  const catalog = await f.call('zuad_catalog', {});
  assert.equal(catalog.isError, false); assert.equal(catalog.value.ok, true);
  assert.equal(f.calls.length, 0);
}));

test('MCP validates nested arguments and rejects credential arguments before backend access', () => fixture(async f => {
  await assert.rejects(f.call('zuad_publish', { target: { kind: 'program' } }), /id/);
  await assert.rejects(f.call('zuad_query', { resource: 'unknown-resource' }), { code: -32602 });
  await assert.rejects(f.call('zuad_connection', { action: 'login', password: 'do-not-send' }), /additional/);
  assert.equal(f.calls.length, 0);
}));

test('signed-out MCP tools provide a usable local login link and structured errors', () => fixture(async f => {
  const result = await f.call('zuad_query', { resource: 'programs' });
  assert.equal(result.isError, true); assert.equal(result.value.code, 'AUTH_REQUIRED');
  assert.equal(result.value.recovery.loginUrl, f.app.page.loginUrl);
  assert.equal(result.value.recovery.action, 'open_login_page');
  assert.doesNotMatch(JSON.stringify(result), /open_plugin_settings|plugin details|mock-test-password/);
  assert.equal(f.calls.length, 0);
}));

test('local login server rejects missing tokens, forged hosts, cross-site writes and oversized bodies', () => fixture(async f => {
  assert.equal((await fetch(f.app.page.origin + '/api/status')).status, 403);
  assert.equal((await fetch(f.app.page.origin + '/?token=' + '界'.repeat(64))).status, 403);
  const forgedHostStatus = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(f.app.page.origin + '/api/status', { headers: { Host: 'evil.example', Cookie: f.cookie } }, response => { response.resume(); resolve(response.statusCode); });
    request.once('error', reject); request.end();
  });
  assert.equal(forgedHostStatus, 403);
  assert.equal((await f.web('/api/logout', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.web('/api/logout', {}, { 'X-Zuad-Request': '' })).status, 403);
  assert.equal((await f.web('/api/login', { extra: 'x'.repeat(17000) })).status, 400);
  const page = await f.web('/');
  assert.match(page.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(f.calls.length, 0);
}));

test('browser login persists locally protected credentials and MCP queries use account scope', () => fixture(async f => {
  assert.equal((await f.signIn()).status, 200);
  const result = await f.call('zuad_query', { resource: 'programs' });
  assert.equal(result.value.ok, true); assert.equal(result.value.data.records[0].id, 11);
  assert.match(f.calls.at(-1)!.path, /org_num%2Ceq%2C1001/);
  const status = await f.call('zuad_connection', { action: 'status' });
  assert.equal(status.value.data.connected, true); assert.equal(status.value.data.orgNum, '1001');
  assert.doesNotMatch(JSON.stringify(status), /mock-test-password|test-signage-session/);
  const disk = await readFile(f.connection.store.path, 'utf8');
  if (process.platform === 'win32') { assert.doesNotMatch(disk, /mock-test-password/); assert.equal(JSON.parse(disk).protection, 'dpapi'); }
  const restored = await new ConnectionStore(f.directory).load();
  assert.equal(restored.password, 'mock-test-password');
  assert.equal(restored.username, 'test-user');
}));

test('a rejected replacement account preserves the working connection and saved identity', () => fixture(async f => {
  await f.signIn();
  f.options.rejected = true;
  const failed = await f.web('/api/login', { baseUrl: f.baseUrl, username: 'wrong-user', password: 'wrong-secret' });
  assert.equal(failed.status, 400);
  assert.doesNotMatch(await failed.text(), /wrong-secret|mock-test-password/);
  assert.equal((await f.connection.store.load()).username, 'test-user');
  assert.equal((await f.connection.status()).connected, true);
}));

test('sign-out clears persisted credentials and blocks automatic tool login in another instance', () => fixture(async f => {
  await f.signIn();
  const other = new CodexConnection(new ConnectionStore(f.directory));
  try {
    await other.refresh();
    await other.runtime.connect();
    assert.equal((await other.status()).connected, true);
    await f.call('zuad_connection', { action: 'logout' });
    const before = f.calls.length;
    const status = await other.status();
    assert.equal(status.connected, false); assert.equal(status.hasPassword, false);
    const result = await f.call('zuad_query', { resource: 'programs' });
    assert.equal(result.value.code, 'AUTH_REQUIRED');
    assert.equal(f.calls.length, before);
    const disk = JSON.parse(await readFile(f.connection.store.path, 'utf8'));
    assert.equal(disk.credential, ''); assert.equal(disk.sessionEnabled, false);
  } finally { await other.close(); }
}));

test('expired MCP requests return login recovery without retrying or replaying the operation', () => fixture(async f => {
  await f.signIn();
  f.options.status = 401;
  const before = f.calls.length;
  const result = await f.call('zuad_query', { resource: 'programs' });
  assert.equal(result.value.reason, 'expired'); assert.equal(result.isError, true);
  assert.equal(f.calls.length, before + 1);
  assert.equal((await f.connection.status()).connected, false);
}));

test('MCP retains organization checks and reports out-of-scope responses as errors', () => fixture(async f => {
  await f.signIn();
  f.options.wrongScope = true;
  const result = await f.call('zuad_query', { resource: 'programs' });
  assert.equal(result.isError, true); assert.match(result.value.error, /outside the configured organization/);
}));

test('advanced timeout settings keep credentials and connection, and corrupt files can be replaced through sign-in', () => fixture(async f => {
  await f.signIn();
  assert.equal((await f.web('/api/settings', { timeoutSeconds: 45 })).status, 200);
  assert.equal((await f.connection.store.load()).timeoutMs, 45000);
  assert.equal((await f.connection.status()).connected, true);
  assert.equal((await f.web('/api/settings', { timeoutSeconds: 0 })).status, 400);
  assert.equal((await f.connection.store.load()).timeoutMs, 45000);
  await writeFile(f.connection.store.path, '{invalid');
  assert.equal((await f.signIn()).status, 200);
  assert.equal((await f.connection.status()).connected, true);
}));

test('persisted credentials preserve Unicode passwords across a fresh store instance', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zuad-unicode-'));
  try {
    const store = new ConnectionStore(directory);
    const password = 'test-\u5bc6\u7801-\u00e9';
    await store.save({ ...store.defaults(), baseUrl: 'https://example.com', username: 'test', password, sessionEnabled: true });
    assert.equal((await new ConnectionStore(directory).load()).password, password);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('standalone stdio MCP starts without DSH and serves discovery, layout controls and login recovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zuad-stdio-'));
  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', fileURLToPath(new URL('../src/mcp.ts', import.meta.url))], env: { ...env, ZUAD_CODEX_DATA_DIR: directory }, stderr: 'pipe' });
  const client = new Client({ name: 'stdio-test', version: '1.0.0' });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk; });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 14);
    const layout = await client.callTool({ name: 'zuad_layout', arguments: { operation: 'describe', componentType: 'grid' } });
    assert.equal(layout.isError, false);
    const result = await client.callTool({ name: 'zuad_connection', arguments: { action: 'login' } });
    const value = JSON.parse((result.content as { text: string }[])[0]!.text);
    assert.equal(value.data.connected, false);
    const response = await fetch(value.data.loginUrl, { redirect: 'manual' });
    assert.equal(response.status, 303);
    assert.doesNotMatch(stderr, /password|token=/i);
  } finally { await client.close(); await transport.close(); await rm(directory, { recursive: true, force: true }); }
});
