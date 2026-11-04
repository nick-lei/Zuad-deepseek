import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { platforms, platformFiles } from '../adapters/platforms.mjs';
import { createTools } from '../lib/tools.js';
import { resolveConfig } from '../lib/core/config.js';
import { npm } from './npm.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const codex = JSON.parse(await readFile(join(root, 'codex/.codex-plugin/plugin.json'), 'utf8'));
const temporary = await mkdtemp(join(tmpdir(), 'zuad-isolated-platforms-'));
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const runtime = createTools(resolveConfig({ sessionEnabled: false }));
const checked = [];
async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) result.push(...(await filesUnder(join(directory, entry.name))).map(path => `${entry.name}/${path}`));
    else result.push(entry.name);
  }
  return result;
}
try {
  // Install once outside the source tree so Node cannot resolve workstation DSH dependencies.
  for (const name of ['package.json', 'package-lock.json']) await cp(join(root, 'dist/mcp', name), join(temporary, name));
  await npm(['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], temporary);
  const installed = JSON.parse(await npm(['ls', '--all', '--omit=dev', '--json'], temporary));
  assert.doesNotMatch(JSON.stringify(installed), /@deepseek-ai|typescript|playwright-core|"tsx"/);
  for (const platform of platforms) {
    const source = join(root, 'dist', platform);
    const directory = join(temporary, platform);
    const expected = platformFiles(platform, metadata, codex);
    for (const [path, data] of Object.entries(expected)) assert.deepEqual(await json(join(source, path)), data);
    const lock = await json(join(source, 'package-lock.json'));
    assert.equal(lock.packages[''].version, metadata.version);
    const manifest = await json(join(source, 'package.json'));
    const profile = platform === 'agent' ? 'mcp' : platform;
    assert.match(manifest.scripts.start, new RegExp(`--host ${profile}$`));
    assert.match(manifest.scripts.connect, new RegExp(`--host ${profile}$`));
    assert.doesNotMatch(JSON.stringify(lock), /@deepseek-ai|typescript|playwright-core|"tsx"/);
    const files = await filesUnder(source);
    assert.ok(!files.some(path => /(^|\/)(node_modules|connection\.json|\.env[^/]*|files|test-results|tests|src)(\/|$)/.test(path)), 'Distribution contains private or development files');
    assert.ok(!files.includes('lib/index.js') && !files.includes('lib/tools.js') && !files.includes('lib/config.js'), 'MCP package contains DSH entry points');
    await cp(source, directory, { recursive: true });
    const configFile = Object.keys(expected).find(path => /(?:\.mcp|^mcp(?:\.example)?|gemini-extension)\.json$/.test(path));
    const server = expected[configFile].mcpServers['zuad-media'];
    const expand = value => value.replace(/\$\{(?:CLAUDE_PLUGIN_ROOT|CURSOR_PLUGIN_ROOT|extensionPath|PLUGIN_ROOT)\}|\/absolute\/path\/to\/zuad-media/g, () => directory);
    const client = new Client({ name: `zuad-${platform}-verification`, version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath, args: server.args.map(expand), cwd: resolve(directory, expand(server.cwd)), stderr: 'pipe', env: {
      ...process.env, ZUAD_DATA_DIR: join(temporary, 'accounts'), CODEX_HOME: join(temporary, 'codex-home'), ZUAD_CODEX_DATA_DIR: join(temporary, 'accounts/codex'),
    } });
    let stderr = '';
    transport.stderr?.on('data', data => { stderr += data; });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      assert.equal(tools.length, 14);
      for (const tool of runtime.tools) assert.deepEqual(tools.find(entry => entry.name === tool.name).inputSchema, tool.parameters);
      const call = async (name, args) => {
        const result = await client.callTool({ name, arguments: args });
        return JSON.parse(result.content[0].text);
      };
      assert.equal((await call('zuad_catalog', { resource: 'programs' })).ok, true);
      assert.equal((await call('zuad_layout', { operation: 'describe', componentType: 'grid' })).ok, true);
      const compiled = await call('zuad_layout', { operation: 'compile', width: 1920, height: 1080, slides: [{ duration: 10, components: Array.from({ length: 9 }, (_, index) => ({ type: 'block', left: `${index % 3 * 640}px`, top: `${Math.floor(index / 3) * 360}px`, width: '640px', height: '360px' })) }] });
      assert.equal(compiled.ok, true);
      const slide = JSON.parse(compiled.data.content)['slide-container-1'];
      assert.equal(Object.keys(slide).filter(key => /^\d+$/.test(key)).length, 9);
      const status = await call('zuad_connection', { action: 'login' });
      const host = platform === 'agent' ? 'mcp' : platform;
      assert.equal(status.data.fileRoot, join(temporary, 'accounts', host, 'files'));
      assert.equal(status.data.connected, false);
      assert.equal((await fetch(status.data.loginUrl, { redirect: 'manual' })).status, 303);
      const signedOut = await call('zuad_query', { resource: 'programs' });
      assert.equal(signedOut.code, 'AUTH_REQUIRED');
      assert.equal(signedOut.recovery.loginUrl, status.data.loginUrl);
      assert.doesNotMatch(JSON.stringify(signedOut), /open_plugin_settings/);
      await assert.rejects(client.callTool({ name: 'zuad_publish', arguments: { target: { kind: 'program' } } }), /id/);
      assert.doesNotMatch(stderr, /token=|password/i);
      checked.push({ platform, tools: tools.length, schemasMatchDsh: true, isolatedRuntime: true, compileGrid: true, localLogin: true });
    } finally { await client.close(); await transport.close(); }
  }
  console.log(JSON.stringify({ passed: true, checked, backendWrites: 0 }, null, 2));
} finally { await runtime.close(); await rm(temporary, { recursive: true, force: true }); }
