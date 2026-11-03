import type { Data } from './client.js';
export declare const timelineColors: string[];
/** The packaged data and markup factories run in an inert DOM, without editor startup or script execution. */
export declare function compileLayout(content: Data | undefined, slides: {
    duration?: number;
    components: Data[];
}[] | undefined, width: number, height: number, backend: string, normalizeTables?: boolean): Promise<Data>;
