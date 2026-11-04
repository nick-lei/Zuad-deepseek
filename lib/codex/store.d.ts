import { ConnectionStore as McpConnectionStore } from '../mcp/store.js';
export declare const defaultDataDirectory: () => string;
export declare class ConnectionStore extends McpConnectionStore {
    constructor(directory?: string);
}
