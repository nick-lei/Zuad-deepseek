import { access, cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { preparePlatform } from './build-platforms.mjs';
import { codexMarketplace } from '../adapters/platforms.mjs';
import { npm } from './npm.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const marketplaceName = 'zuad-local';
const pluginName = 'zuad-media';
const selector = `${pluginName}@${marketplaceName}`;

export async function preparePlugin(destination, node = process.execPath) {
  for (const file of ['lib/mcp/stdio.js', 'assets/fonts/NotoSansCJKsc-Regular.otf']) {
    await access(join(root, file)).catch(() => { throw new Error('Run npm install and npm run build before installing the Codex plugin.'); });
  }
  const plugin = join(destination, 'plugins', pluginName);
  await mkdir(join(destination, '.agents', 'plugins'), { recursive: true });
  await preparePlatform(plugin, 'codex');
  await npm(['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], plugin);
  const manifestPath = join(plugin, '.codex-plugin', 'plugin.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const mcpPath = join(plugin, '.mcp.json');
  const mcp = JSON.parse(await readFile(mcpPath, 'utf8'));
  mcp.mcpServers[pluginName].command = node;
  await writeFile(mcpPath, JSON.stringify(mcp, null, 2) + '\n');
  await writeFile(join(destination, '.agents', 'plugins', 'marketplace.json'), JSON.stringify(codexMarketplace(), null, 2) + '\n');
  return { plugin, version: manifest.version, selector };
}

async function install() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 15)) throw new Error('Use Node.js 24.15 or newer to install and run this plugin.');
  const codexHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex'));
  const command = process.env.CODEX_CLI_PATH || 'codex';
  const cli = args => {
    const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    if (result.error) throw new Error('Codex CLI was not found. Set CODEX_CLI_PATH to its executable.');
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Codex plugin installation failed.');
    return JSON.parse(result.stdout);
  };
  cli(['plugin', 'marketplace', 'list', '--json']);
  await mkdir(codexHome, { recursive: true });
  const config = join(codexHome, 'config.toml');
  try { await cp(config, join(codexHome, `config.before-zuad-plugin-${Date.now()}.toml`), { errorOnExist: true, force: false }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const sources = join(codexHome, 'plugin-sources');
  await mkdir(sources, { recursive: true });
  const stage = await mkdtemp(join(sources, '.zuad-stage-'));
  const destination = join(sources, marketplaceName);
  const previous = join(sources, `.zuad-previous-${Date.now()}`);
  let replaced = false;
  let promoted = false;
  try {
    console.log('Preparing Zuad native plugin, tools and runtime dependencies...');
    const prepared = await preparePlugin(stage);
    if (await stat(destination).catch(error => { if (error.code !== 'ENOENT') throw error; return null; })) {
      await rename(destination, previous);
      replaced = true;
    }
    await rename(stage, destination);
    promoted = true;
    cli(['plugin', 'marketplace', 'add', destination, '--json']);
    cli(['plugin', 'add', selector, '--json']);
    const listing = cli(['plugin', 'list', '--json']);
    const installed = listing.installed.find(item => item.pluginId === selector);
    if (!installed?.enabled || installed.version !== prepared.version) throw new Error('Codex did not confirm the expected plugin version as installed and enabled.');
    if (replaced) await rm(previous, { recursive: true, force: true });
    console.log(`Installed and enabled ${selector} (${prepared.version}). Open Customization > Plugins and search for Zuad. Reopen the page or restart Codex if needed.`);
  } catch (error) {
    if (promoted) await rm(destination, { recursive: true, force: true });
    if (replaced) await rename(previous, destination);
    throw error;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await install();
}
