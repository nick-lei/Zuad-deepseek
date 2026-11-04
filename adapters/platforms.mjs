// Host discovery and path expansion differ; business logic and tool schemas do not.
export const platforms = ['mcp', 'codex', 'claude', 'cursor', 'gemini', 'agent'];

export function platformFiles(platform, metadata, codex) {
  if (!platforms.includes(platform)) throw new Error(`Unknown platform: ${platform}`);
  const host = platform === 'agent' ? 'mcp' : platform;
  const base = {
    name: 'zuad-media', version: metadata.version, description: metadata.description,
    author: codex.author, homepage: codex.homepage, repository: codex.repository,
    license: metadata.license, keywords: codex.keywords,
  };
  const server = root => ({ command: 'node', args: [`${root}/lib/mcp/stdio.js`, '--host', host], cwd: root });
  const config = root => ({ mcpServers: { 'zuad-media': server(root) } });
  switch (platform) {
    case 'codex': return {
      '.codex-plugin/plugin.json': { ...codex, version: metadata.version },
      '.mcp.json': { mcpServers: { 'zuad-media': { ...server('.'), startup_timeout_sec: 30, tool_timeout_sec: 300, env_vars: ['CODEX_HOME', 'ZUAD_CODEX_DATA_DIR'] } } },
    };
    case 'claude': return {
      '.claude-plugin/plugin.json': base,
      '.mcp.json': config('${CLAUDE_PLUGIN_ROOT}'),
    };
    case 'cursor': return {
      '.cursor-plugin/plugin.json': { ...base, displayName: codex.interface.displayName, logo: './assets/zuad-icon.png', skills: './skills/', mcpServers: './.mcp.json' },
      '.mcp.json': config('${CURSOR_PLUGIN_ROOT}'),
    };
    case 'gemini': return {
      'gemini-extension.json': { name: base.name, version: base.version, description: base.description, mcpServers: config('${extensionPath}').mcpServers },
    };
    case 'agent': return {
      'plugin.json': { $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', ...base },
      'mcp.json': config('${PLUGIN_ROOT}'),
    };
    default: return { 'mcp.example.json': config('/absolute/path/to/zuad-media') };
  }
}

export function codexMarketplace(path = './plugins/zuad-media') {
  return {
    name: 'zuad-local', interface: { displayName: 'Zuad 信发助手' },
    plugins: [{ name: 'zuad-media', source: { source: 'local', path }, policy: { installation: 'AVAILABLE', authentication: 'ON_USE' }, category: 'Productivity' }],
  };
}
