import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Config as DshConfig } from '../src/config.js';
import { resolveConfig } from '../src/core/config.js';
import { createTools, InvalidToolArgumentsError } from '../src/core/tools.js';
import { asDshTool } from '../src/tools.js';
import { createMcpServer } from '../src/mcp/server.js';
import { SignageConnection } from '../src/mcp/connection.js';
import { ConnectionStore, defaultDataDirectory } from '../src/mcp/store.js';
import { ConnectionStore as CodexStore } from '../src/codex/store.js';
import { readHost, mcpHosts } from '../src/mcp/host.js';

test('plain configuration preserves DSH defaults and rejects invalid deployment inputs', () => {
  assert.deepEqual(resolveConfig(), resolveConfig(DshConfig({})));
  for (const input of [{ timeoutMs: NaN }, { timeoutMs: 0 }, { timeoutMs: 300001 }, { baseUrl: 'https://example.com/path' }, { baseUrl: 'https://user:secret@example.com' }, { orgNum: '../other' }, { actorUid: '1,2' }]) {
    assert.throws(() => resolveConfig(input));
  }
  assert.throws(() => resolveConfig({ sessionEnabled: 'yes' } as any));
  assert.throws(() => resolveConfig({ authMode: 'other' } as any));
});

test('host profiles isolate account directories while the Codex alias keeps its original path', () => {
  const saved = { ...process.env };
  try {
    process.env.ZUAD_DATA_DIR = join(tmpdir(), 'zuad-profile-parent');
    process.env.ZUAD_CODEX_DATA_DIR = join(tmpdir(), 'zuad-existing-codex');
    process.env.CODEX_HOME = join(tmpdir(), 'zuad-codex-home');
    for (const host of mcpHosts.filter(host => host !== 'codex')) {
      const store = new ConnectionStore(undefined, host);
      assert.equal(store.directory, join(process.env.ZUAD_DATA_DIR, host));
      assert.equal(store.defaults().passwordEnv, `ZUAD_${host.toUpperCase()}_PASSWORD`);
      assert.equal(store.defaults().sessionEnabled, false);
    }
    assert.equal(new CodexStore().directory, process.env.ZUAD_CODEX_DATA_DIR);
    assert.equal(new CodexStore().defaults().passwordEnv, 'ZUAD_CODEX_PASSWORD');
    delete process.env.ZUAD_CODEX_DATA_DIR;
    assert.equal(defaultDataDirectory('codex'), join(process.env.CODEX_HOME, 'zuad-media'));
    delete process.env.CODEX_HOME;
    assert.equal(defaultDataDirectory('codex'), join(homedir(), '.codex', 'zuad-media'));
  } finally {
    for (const key of ['ZUAD_DATA_DIR', 'ZUAD_CODEX_DATA_DIR', 'CODEX_HOME']) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});

test('MCP host arguments are explicit and cannot become storage paths', () => {
  assert.equal(readHost([]), 'mcp');
  assert.equal(readHost([], 'codex'), 'codex');
  for (const host of mcpHosts) assert.equal(readHost(['--host', host]), host);
  for (const args of [['--host', '../codex'], ['--host'], ['--host', 'claude', 'extra'], ['--unknown']]) assert.throws(() => readHost(args), /Usage/);
});

test('shared definitions and DSH use identical schemas, enforce nested fields and separate login presentation', async () => {
  const runtime = createTools(resolveConfig({ sessionEnabled: false }));
  try {
    for (const definition of runtime.tools) {
      const dsh = asDshTool(definition);
      assert.deepEqual(dsh.parameters, definition.parameters);
      assert.equal(dsh.isConcurrencySafe!({}), definition.readOnly);
    }
    const signal = new AbortController().signal;
    const publish = runtime.tools.find(tool => tool.name === 'zuad_publish')!;
    await assert.rejects(publish.execute({ target: { kind: 'program' } }, { signal }), InvalidToolArgumentsError);
    const layout = runtime.tools.find(tool => tool.name === 'zuad_layout')!;
    await assert.rejects(layout.execute({ operation: 'compile', slides: [{}] }, { signal }), /components/);
    await assert.rejects(layout.execute({ operation: 'compile', patches: [{ slide: 1, index: 0 }] }, { signal }), /changes/);
    const query = runtime.tools.find(tool => tool.name === 'zuad_query')!;
    await assert.rejects(query.execute({ resource: 'programs', password: 'must-not-be-accepted' }, { signal }), /additional/);
    const result = await query.execute({ resource: 'programs' }, { signal });
    assert.equal(result.code, 'AUTH_REQUIRED');
    assert.doesNotMatch(JSON.stringify(result), /DSH|Codex|open_plugin_settings/);
    const native = await asDshTool(query).execute({ resource: 'programs' }, { signal } as any) as any;
    assert.equal(native.recovery.action, 'open_plugin_settings');
  } finally { await runtime.close(); }
});

test('generic MCP publishes the shared schema without requiring a Codex account', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zuad-generic-test-'));
  const app = await createMcpServer(new SignageConnection(new ConnectionStore(directory, 'claude')));
  const client = new Client({ name: 'generic-signage-test', version: '1.0.0' });
  const core = createTools(resolveConfig({ sessionEnabled: false }));
  try {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await app.server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    for (const tool of core.tools) assert.deepEqual(tools.find(entry => entry.name === tool.name)!.inputSchema, tool.parameters);
    const result = await client.callTool({ name: 'zuad_connection', arguments: { action: 'status' } });
    const value = JSON.parse((result.content as { text: string }[])[0]!.text);
    assert.equal(value.data.fileRoot, join(directory, 'files'));
    assert.equal(value.data.connected, false);
  } finally { await client.close(); await app.close(); await core.close(); await rm(directory, { recursive: true, force: true }); }
});
