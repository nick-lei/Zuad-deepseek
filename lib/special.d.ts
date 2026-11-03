import { MediaClient, type Data } from './client.js';
import { MediaFiles } from './files.js';
export declare class SpecialOperations {
    private readonly client;
    private readonly files;
    constructor(client: MediaClient, files: MediaFiles);
    monitor(operation: string, input: Data, signal?: AbortSignal): Promise<any>;
    payment(orderId: string, signal?: AbortSignal): Promise<{
        created: boolean;
        result: any;
        note: string;
    }>;
}
