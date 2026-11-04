import { type Config } from '../core/config.js';
import type { McpHost } from './host.js';
export declare function defaultDataDirectory(host?: McpHost): string;
export declare class ConnectionStore {
    readonly host: McpHost;
    readonly path: string;
    private cached;
    readonly directory: string;
    constructor(directory?: string, host?: McpHost);
    defaults(): Config;
    load(): Promise<Config>;
    save(config: Config): Promise<void>;
}
