import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = resolve('.');
const hostRoot = resolve(process.env.ZUAD_DSH_HOST_ROOT || root);
const hostManifest = JSON.parse(await readFile(join(hostRoot, 'node_modules/@deepseek-ai/dsh-tools/package.json'), 'utf8'));
const protocolManifest = JSON.parse(await readFile(join(hostRoot, 'node_modules/@deepseek-ai/dsh-typert-protocol/package.json'), 'utf8'));
assert.equal(protocolManifest.version, hostManifest.version);
if (process.env.ZUAD_DSH_HOST_VERSION) assert.equal(hostManifest.version, process.env.ZUAD_DSH_HOST_VERSION);
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
assert.ok(metadata.engines.dsh.split(/\s*\|\|\s*/).includes(hostManifest.version), 'Each supported prerelease must have its own explicit engines.dsh branch');
for (const name of ['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-typert-protocol']) assert.equal(metadata.peerDependencies[name], metadata.engines.dsh);
const temporary = await mkdtemp(join(tmpdir(), 'zuad-dsh-bundle-'));
try {
  for (const name of ['package.json', 'lib', 'assets']) await cp(join(root, name), join(temporary, name), { recursive: true });
  await mkdir(join(temporary, 'node_modules'));
  for (const entry of await readdir(join(root, 'node_modules'), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
    const source = entry.name === '@deepseek-ai' ? hostRoot : root;
    await symlink(join(source, 'node_modules', entry.name), join(temporary, 'node_modules', entry.name), process.platform === 'win32' ? 'junction' : 'dir');
  }
  const fixture = JSON.parse(await readFile(join(root, 'docs/fixtures/real-layouts/373.json'), 'utf8'));
  const bundle = JSON.parse(await readFile(join(temporary, 'lib/dsh-bundle.json'), 'utf8'));
  assert.ok(bundle.inputs.some(path => path.endsWith('/punycode/punycode.js')), 'The userland punycode package must be bundled');
  const code = `
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';
import { Context } from ${JSON.stringify(pathToFileURL(join(hostRoot, 'node_modules/@deepseek-ai/cordis/lib/index.js')).href)};
import { ToolRuntime, ToolArgsError } from ${JSON.stringify(pathToFileURL(join(hostRoot, 'node_modules/@deepseek-ai/dsh-tools/lib/index.js')).href)};
// Reproduce the desktop resolver failure if this dependency escapes the bundle.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'punycode/') throw new TypeError('createRequire.resolve.paths is not iterable');
  return next(specifier, context);
} });
const plugin = await import(${JSON.stringify(pathToFileURL(join(temporary, 'lib/index.js')).href)});
const ctx = new Context();
ctx.provide('systemPrompt', { tools() {} });
const tools = new ToolRuntime(ctx);
const config = Object.fromEntries(Object.entries(plugin.Config.dict).map(([key, schema]) => [key, schema.meta?.default]));
config.fileRoot = ${JSON.stringify(join(temporary, 'files'))};
config.baseUrl = 'https://example.com';
config.sessionEnabled = false;
config.usernameEnv = 'ZUAD_DSH_TEST_USERNAME';
config.passwordEnv = 'ZUAD_DSH_TEST_PASSWORD';
for (const key of ['baseUrl', 'authMode', 'username', 'password', 'sessionEnabled', 'orgNum', 'actorUid', 'actorNickname', 'timeoutMs']) {
  const value = config[key]; config[key] = { get: () => value };
}
plugin.apply(ctx, config);
const registered = [...tools.view(undefined).visible.values()];
assert.equal(registered.length, 13);
assert.equal(tools.schemas(undefined).length, 13);
const call = (name, args) => registered.find(tool => tool.name === name).execute(args, { signal: new AbortController().signal });
assert.equal((await call('zuad_catalog', { resource: 'programs' })).ok, true);
assert.equal((await ctx.zuadMedia.status()).connected, false);
assert.equal((await ctx.zuadMedia.connect()).ok, false);
assert.equal((await ctx.zuadMedia.disconnect()).connected, false);
const signedOut = await call('zuad_query', { resource: 'programs' });
assert.equal(signedOut.code, 'AUTH_REQUIRED');
assert.equal(signedOut.recovery.action, 'open_plugin_settings');
await assert.rejects(call('zuad_publish', { target: { kind: 'program' } }), ToolArgsError);
const result = await call('zuad_layout', { operation: 'compile', content: ${JSON.stringify(fixture.content)}, previewPath: 'preview.png' });
assert.equal(result.ok, true, JSON.stringify(result));
assert.equal(result.data.compiler, 'node');
assert.equal(result.data.previewWarnings.length, 0);
assert.ok((await readFile(${JSON.stringify(join(temporary, 'files/preview.png'))})).length > 3000);
const grid = await call('zuad_layout', { operation: 'compile', width: 1920, height: 1080, slides: [{ duration: 10, components: Array.from({ length: 9 }, (_, index) => ({ type: 'block', left: index % 3 * 640 + 'px', top: Math.floor(index / 3) * 360 + 'px', width: '640px', height: '360px' })) }] });
assert.equal(grid.ok, true, JSON.stringify(grid));
assert.equal(Object.keys(JSON.parse(grid.data.content)['slide-container-1']).filter(key => /^\\d+$/.test(key)).length, 9);
console.log(JSON.stringify({ passed: true, hostVersion: ${JSON.stringify(hostManifest.version)}, toolsRegistered: registered.length, realToolRegistry: true, connectionRpc: true, signedOutRecovery: true, bundledPunycode: true, fixturePreview: true, compileGrid: true, backendWrites: 0 }));
`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: temporary, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
  console.log(result.stdout.trim());
} finally {
  await rm(temporary, { recursive: true, force: true });
}
