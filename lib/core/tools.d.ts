import { type Config } from './config.js';
import { MediaClient } from '../client.js';
export interface ToolParameters {
    [key: string]: unknown;
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties: false;
}
export interface SignageTool {
    name: string;
    description: string;
    parameters: ToolParameters;
    readOnly: boolean;
    execute(args: unknown, exec: {
        signal: AbortSignal;
    }): Promise<any>;
}
export declare class InvalidToolArgumentsError extends Error {
}
export declare function redact(value: any): any;
export declare function createTools(config: Config): {
    tools: SignageTool[];
    client: MediaClient;
    close(): Promise<void>;
};
/** Keep each invocation on one config snapshot, retiring old clients after their calls finish. */
export declare function createLiveTools(readConfig: () => Config): {
    tools: {
        execute(args: unknown, exec: Parameters<(args: unknown, exec: {
            signal: AbortSignal;
        }) => Promise<any>>[1]): Promise<any>;
        name: string;
        description: string;
        parameters: ToolParameters;
        readOnly: boolean;
    }[];
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
