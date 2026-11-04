import { ConnectionStore } from './store.js';
import { type Data } from '../client.js';
import { type Config } from '../core/config.js';
import { createLiveTools } from '../core/tools.js';
export declare class SignageConnection {
    readonly store: ConnectionStore;
    private config;
    readonly runtime: ReturnType<typeof createLiveTools>;
    private changes;
    constructor(store?: ConnectionStore);
    private serialize;
    refresh(): Promise<void>;
    status(): Promise<{
        fileRoot: string;
        credentialProtection: string;
    }>;
    signIn(input: Data): Promise<{
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
    signOut(): Promise<{
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
    reconnect(): Promise<{
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
    setTimeout(seconds: unknown): Promise<{
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
}
