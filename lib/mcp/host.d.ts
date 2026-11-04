export declare const mcpHosts: readonly ["mcp", "codex", "claude", "cursor", "gemini"];
export type McpHost = typeof mcpHosts[number];
export declare function readHost(args: string[], fallback?: McpHost): McpHost;
