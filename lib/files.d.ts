import { MediaClient, type Data } from './client.js';
export declare function localFile(root: string, path: string, output?: boolean): Promise<string>;
export declare class MediaFiles {
    private readonly client;
    constructor(client: MediaClient);
    private file;
    execute(operation: string, input: Data, signal?: AbortSignal): Promise<any>;
    private register;
    savePreview(path: string, bytes: Uint8Array): Promise<string>;
}
