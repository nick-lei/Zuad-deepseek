import { MediaClient, type Data } from './client.js';
import { MediaFiles } from './files.js';
export interface LayoutInput {
    operation: 'describe' | 'compile' | 'save_program' | 'save_template';
    componentType?: string;
    name?: string;
    id?: string;
    sourceKind?: 'program' | 'template';
    sourceId?: string;
    content?: Data;
    width?: number;
    height?: number;
    slides?: {
        duration?: number;
        components: Data[];
    }[];
    patches?: {
        slide: number;
        index: number;
        changes: Data;
    }[];
    previewPath?: string;
    folderId?: string;
}
export declare class LayoutRenderer {
    private readonly client;
    private readonly files;
    private readonly shutdown;
    constructor(client: MediaClient, files: MediaFiles);
    close(): Promise<void>;
    execute(input: LayoutInput, signal?: AbortSignal): Promise<Data>;
}
