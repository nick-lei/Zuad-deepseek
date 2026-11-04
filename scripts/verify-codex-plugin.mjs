import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const directory = await mkdtemp(join(tmpdir(), 'zuad-native-check-'));
const existing = process.argv.includes('--installed');
const codexHome = existing ? process.env.CODEX_HOME || join(homedir(), '.codex') : directory;
const env = { ...process.env, CODEX_HOME: codexHome, ZUAD_CODEX_DATA_DIR: join(directory, 'account') };
const cli = args => {
  const result = spawnSync(process.env.CODEX_CLI_PATH || 'codex', args, { env, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
let client;
let transport;
try {
  if (!existing) {
    const installation = spawnSync(process.execPath, ['scripts/install-codex.mjs'], { env, encoding: 'utf8', windowsHide: true });
    assert.equal(installation.status, 0, installation.stderr);
  }
  const installed = cli(['plugin', 'list', '--json']).installed.find(item => item.pluginId === 'zuad-media@zuad-local');
  assert.equal(installed?.enabled, true);
  const connection = cli(['mcp', 'get', 'zuad-media', '--json']);
  const { command, args, cwd } = connection.transport;
  assert.ok((await realpath(cwd)).startsWith(await realpath(join(codexHome, 'plugins', 'cache'))));
  const metadata = JSON.parse(await readFile(join(cwd, '.codex-plugin', 'plugin.json'), 'utf8'));
  assert.equal(metadata.interface.displayName, 'Zuad 信发助手');
  await readFile(join(cwd, metadata.interface.logo));
  await readFile(join(cwd, 'skills', 'zuad-signage', 'SKILL.md'));
  assert.deepEqual((await readdir(cwd)).sort(), ['.codex-plugin', '.mcp.json', '.zuad-distribution.json', 'LICENSE', 'README.md', 'assets', 'lib', 'node_modules', 'package-lock.json', 'package.json', 'skills'].sort());
  assert.equal(JSON.stringify(JSON.parse(await readFile(join(cwd, 'package-lock.json'), 'utf8'))).includes('@deepseek-ai/'), false);
  client = new Client({ name: 'native-plugin-check', version: '1.0.0' });
  transport = new StdioClientTransport({ command, args, cwd, env, stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', data => { stderr += data; });
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 14);
  const call = async (name, parameters) => {
    const result = await client.callTool({ name, arguments: parameters });
    return { ...result, value: JSON.parse(result.content[0].text) };
  };
  assert.equal((await call('zuad_catalog', { resource: 'programs' })).isError, false);
  assert.equal((await call('zuad_layout', { operation: 'describe', componentType: 'grid' })).isError, false);
  const status = await call('zuad_connection', { action: 'login' });
  assert.equal(status.value.data.connected, false);
  const page = await fetch(status.value.data.loginUrl, { redirect: 'manual' });
  assert.equal(page.status, 303);
  assert.equal((await call('zuad_query', { resource: 'programs' })).value.code, 'AUTH_REQUIRED');
  assert.doesNotMatch(stderr, /password|token=/i);
  console.log('PASS: Codex installed/enabled the native plugin, resolved its cached MCP runtime, discovered 14 tools, loaded catalog/layout resources and served the sign-in page. No account data was bundled.');
} finally {
  await client?.close();
  await transport?.close();
  await rm(directory, { recursive: true, force: true });
}
