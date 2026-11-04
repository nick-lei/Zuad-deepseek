export const mcpHosts = ['mcp', 'codex', 'claude', 'cursor', 'gemini'] as const;
export type McpHost = typeof mcpHosts[number];

export function readHost(args: string[], fallback: McpHost = 'mcp'): McpHost {
  if (!args.length) return fallback;
  if (args.length !== 2 || args[0] !== '--host' || !mcpHosts.includes(args[1] as McpHost)) {
    throw new Error(`Usage: zuad-media-mcp [--host ${mcpHosts.join('|')}]`);
  }
  return args[1] as McpHost;
}
