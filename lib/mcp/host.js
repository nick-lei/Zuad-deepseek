export const mcpHosts = ['mcp', 'codex', 'claude', 'cursor', 'gemini'];
export function readHost(args, fallback = 'mcp') {
    if (!args.length)
        return fallback;
    if (args.length !== 2 || args[0] !== '--host' || !mcpHosts.includes(args[1])) {
        throw new Error(`Usage: zuad-media-mcp [--host ${mcpHosts.join('|')}]`);
    }
    return args[1];
}
//# sourceMappingURL=host.js.map