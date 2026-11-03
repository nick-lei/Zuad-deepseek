import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, readFile, realpath, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// Copy only distributable runtime files, then deny access to the development workspace.
const root = resolve('.'), isolated = await realpath(await mkdtemp(join(tmpdir(), 'zuad-runtime-')));
for (const directory of ['lib', 'assets']) await cp(join(root, directory), join(isolated, directory), { recursive: true });
await cp(join(root, 'package.json'), join(isolated, 'package.json'));
await symlink(join(root, 'node_modules'), join(isolated, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const fixture = JSON.parse(await readFile(join(root, 'docs/fixtures/real-layouts/373.json'), 'utf8'));
const script = `
import assert from 'node:assert/strict';
import { LayoutRenderer } from ${JSON.stringify(pathToFileURL(join(isolated, 'lib/layout.js')).href)};
import { MediaClient } from ${JSON.stringify(pathToFileURL(join(isolated, 'lib/client.js')).href)};
import { MediaFiles } from ${JSON.stringify(pathToFileURL(join(isolated, 'lib/files.js')).href)};
import { resolveConfig } from ${JSON.stringify(pathToFileURL(join(isolated, 'lib/config.js')).href)};
const client = new MediaClient(resolveConfig({ baseUrl: 'https://example.com', editorRoot: '/missing', browserExecutable: '/missing', fileRoot: ${JSON.stringify(isolated)} }));
const renderer = new LayoutRenderer(client, new MediaFiles(client));
try {
 const result = await renderer.execute({ operation: 'compile', content: ${JSON.stringify(fixture.content)}, previewPath: 'portable.png' });
 assert.equal(result.compiler, 'node'); assert.ok(result.generateHtml.includes('lush')); assert.equal(result.previewWarnings.length, 0);
 console.log(JSON.stringify({ passed: true, compiler: result.compiler, editorAccessible: false, childProcessesAllowed: false, systemFontsDisabled: true }));
} finally { await renderer.close(); client.close(); }
`;
const result = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${isolated}`, `--allow-fs-read=${join(root, 'node_modules')}`, `--allow-fs-write=${isolated}`, '--allow-addons', '--input-type=module', '-e', script],
  { cwd: isolated, encoding: 'utf8', env: { ...process.env, DISABLE_SYSTEM_FONTS_LOAD: '1' }, timeout: 30000 });
assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
const report = { ...JSON.parse(result.stdout.trim()), isolated, thumbnailBytes: (await readFile(join(isolated, 'portable.png'))).length };
assert.ok(report.thumbnailBytes > 3000);
await mkdir('test-results', { recursive: true });
await writeFile('test-results/portable-runtime.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
