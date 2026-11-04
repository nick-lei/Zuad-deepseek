import { type ResourceName } from './catalog.js';
import type { Config } from './core/config.js';
export type Data = Record<string, any>;
export interface Query {
    filters?: string[];
    include?: string;
    order?: string;
    limit?: number;
    page?: number;
    shared?: boolean;
}
export interface Identity {
    uid: string;
    nickname: string;
    orgNum: string;
    deviceIds: string[];
    authMode: Config['authMode'];
}
export declare class ApiError extends Error {
    readonly uncertain: boolean;
    readonly status?: number | undefined;
    constructor(message: string, uncertain?: boolean, status?: number | undefined);
}
export declare class SignInRequiredError extends ApiError {
    readonly reason: 'not_signed_in' | 'expired' | 'credentials_rejected';
    constructor(reason: 'not_signed_in' | 'expired' | 'credentials_rejected', message: string, status?: number);
}
export declare const now: () => number;
export declare const oid: () => string;
export declare function records(value: unknown): Data[];
export declare class MediaClient {
    readonly config: Config;
    private readonly fetch;
    private identity;
    private loggingIn;
    private readonly cookies;
    private signCode;
    private verified;
    private readonly shutdown;
    constructor(config: Config, fetchImpl?: typeof globalThis.fetch);
    close(): void;
    logout(): Promise<void>;
    connectionStatus(): {
        uid?: string;
        nickname?: string;
        orgNum?: string;
        deviceIds?: string[];
        authMode: Config["authMode"];
        connected: boolean;
        baseUrl: string;
        username: string;
        hasPassword: boolean;
    };
    verifyConnection(signal?: AbortSignal): Promise<{
        verified: boolean;
        uid: string;
        nickname: string;
        orgNum: string;
        deviceIds: string[];
        authMode: Config["authMode"];
    }>;
    private signal;
    request(path: string, method?: string, body?: unknown, query?: Record<string, unknown>, signal?: AbortSignal, binary?: boolean, key?: boolean, gateway?: boolean): Promise<any>;
    login(signal?: AbortSignal): Promise<Identity>;
    private authenticate;
    actor(signal?: AbortSignal): Promise<Identity>;
    meta(signal?: AbortSignal): Promise<Data>;
    query(name: ResourceName, query?: Query, signal?: AbortSignal): Promise<{
        records: Data[];
        possiblyTruncated: boolean;
        page: number;
    }>;
    get(name: ResourceName, entityId: unknown, signal?: AbortSignal, shared?: boolean, include?: string): Promise<Data>;
    create(name: ResourceName, input: Data, signal?: AbortSignal): Promise<any>;
    update(name: ResourceName, entityId: unknown, input: Data, signal?: AbortSignal): Promise<any>;
    remove(name: ResourceName, entityId: unknown, signal?: AbortSignal): Promise<any>;
    private write;
    all(name: ResourceName, filters?: string[], signal?: AbortSignal): Promise<Data[]>;
}
