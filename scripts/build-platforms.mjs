import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { platformFiles, platforms } from '../adapters/platforms.mjs';
import { npm } from './npm.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const writeJson = (path, data) => writeFile(path, JSON.stringify(data, null, 2) + '\n');
const modules = ['catalog', 'client', 'compiler', 'connect', 'files', 'layout', 'layout-controls.generated', 'mcp', 'raster', 'service', 'special', 'version'];

export async function prepareRuntime(destination) {
  const metadata = await json(join(root, 'package.json'));
  const codex = await json(join(root, 'codex/.codex-plugin/plugin.json'));
  await mkdir(join(destination, 'lib'), { recursive: true });
  for (const name of modules) for (const extension of ['js', 'd.ts', 'js.map']) {
    await cp(join(root, 'lib', `${name}.${extension}`), join(destination, 'lib', `${name}.${extension}`));
  }
  for (const name of ['core', 'mcp', 'codex']) await cp(join(root, 'lib', name), join(destination, 'lib', name), { recursive: true });
  for (const name of ['assets', 'skills']) await cp(join(root, name), join(destination, name), { recursive: true });
  await cp(join(root, 'codex/assets/zuad-icon.png'), join(destination, 'assets/zuad-icon.png'));
  await cp(join(root, 'LICENSE'), join(destination, 'LICENSE'));
  await cp(join(root, 'docs/platforms.md'), join(destination, 'README.md'));
  const manifest = {
    name: 'zuad-media-mcp', version: metadata.version, private: true, type: 'module',
    description: metadata.description, license: metadata.license, repository: metadata.repository,
    engines: { node: metadata.engines.node },
    bin: { 'zuad-signage-mcp': './lib/mcp/stdio.js', 'zuad-signage-connect': './lib/mcp/connect.js' },
    scripts: { start: 'node lib/mcp/stdio.js', connect: 'node lib/mcp/connect.js' },
    dependencies: Object.fromEntries(Object.entries(metadata.dependencies).filter(([name]) => !name.startsWith('@deepseek-ai/'))),
  };
  await writeJson(join(destination, 'package.json'), manifest);
  // Let npm prune the original lock graph instead of duplicating dependency resolution.
  const locked = await cp(join(root, 'package-lock.json'), join(destination, 'package-lock.json')).then(() => true, error => { if (error.code !== 'ENOENT') throw error; return false; });
  await npm(['install', '--package-lock-only', '--ignore-scripts', ...(locked ? ['--offline'] : []), '--no-audit', '--no-fund'], destination);
  const lock = await json(join(destination, 'package-lock.json'));
  assert.ok(!Object.keys(lock.packages).some(name => name.includes('@deepseek-ai/')), 'MCP runtime must not depend on DSH');
  assert.ok(!Object.values(lock.packages).some(entry => entry.dev), 'MCP runtime must not include development dependencies');
  return { metadata, codex };
}

export async function preparePlatform(destination, platform, template) {
  if (!platforms.includes(platform)) throw new Error(`Unknown platform: ${platform}`);
  let temporary;
  if (!template) {
    temporary = await mkdtemp(join(tmpdir(), 'zuad-runtime-'));
    try { await prepareRuntime(temporary); }
    catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
    template = temporary;
  }
  try {
    await cp(template, destination, { recursive: true });
    const metadata = await json(join(root, 'package.json'));
    const codex = await json(join(root, 'codex/.codex-plugin/plugin.json'));
    const manifest = await json(join(destination, 'package.json'));
    const host = platform === 'agent' ? 'mcp' : platform;
    manifest.scripts = { start: `node lib/mcp/stdio.js --host ${host}`, connect: `node lib/mcp/connect.js --host ${host}` };
    await writeJson(join(destination, 'package.json'), manifest);
    for (const [path, data] of Object.entries(platformFiles(platform, metadata, codex))) {
      await mkdir(dirname(join(destination, path)), { recursive: true });
      await writeJson(join(destination, path), data);
    }
    await writeJson(join(destination, '.zuad-distribution.json'), { platform, version: metadata.version });
    return { platform, version: metadata.version, directory: destination };
  } finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
}

export async function buildPlatforms(destination = join(root, 'dist')) {
  await mkdir(destination, { recursive: true });
  const stage = await mkdtemp(join(destination, '.zuad-stage-'));
  const result = [];
  try {
    const template = join(stage, 'runtime');
    await prepareRuntime(template);
    for (const platform of platforms) {
      const directory = join(destination, platform);
      const prepared = await preparePlatform(join(stage, platform), platform, template);
      if (await stat(directory).catch(error => { if (error.code !== 'ENOENT') throw error; return null; })) {
        assert.equal((await json(join(directory, '.zuad-distribution.json'))).platform, platform, `Refusing to replace an unrecognized directory: ${directory}`);
        await rm(directory, { recursive: true });
      }
      await rename(prepared.directory, directory);
      result.push({ ...prepared, directory });
    }
    await writeJson(join(destination, 'platforms.json'), result.map(({ platform, version }) => ({ platform, version, directory: `./${platform}` })));
    return result;
  } finally { await rm(stage, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildPlatforms(), null, 2));
