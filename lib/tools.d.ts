import { type ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { Config } from './core/config.js';
import { type SignageTool } from './core/tools.js';
export { redact } from './core/tools.js';
export declare function asDshTool(tool: SignageTool): ToolDefinition;
export declare function createTools(config: Config): {
    tools: ToolDefinition[];
    client: import("./client.js").MediaClient;
    close(): Promise<void>;
};
export declare function createLiveTools(readConfig: () => Config): {
    tools: ToolDefinition[];
    status: () => Promise<{
        uid?: string;
        nickname?: string;
        orgNum?: string;
        deviceIds?: string[];
        authMode: Config["authMode"];
        connected: boolean;
        baseUrl: string;
        username: string;
        hasPassword: boolean;
    }>;
    connect: () => Promise<{
        uid?: string;
        nickname?: string;
        orgNum?: string;
        deviceIds?: string[];
        authMode: Config["authMode"];
        connected: boolean;
        baseUrl: string;
        username: string;
        hasPassword: boolean;
    }>;
    disconnect: () => Promise<{
        uid?: string;
        nickname?: string;
        orgNum?: string;
        deviceIds?: string[];
        authMode: Config["authMode"];
        connected: boolean;
        baseUrl: string;
        username: string;
        hasPassword: boolean;
    }>;
    close(): Promise<void>;
};
