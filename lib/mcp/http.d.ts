import type { SignageConnection } from './connection.js';
export declare function startConnectionPage(connection: SignageConnection): Promise<{
    origin: string;
    loginUrl: string;
    close(): Promise<void>;
}>;
