import type { MediaClient, Data } from './client.js';
/** Render the editable table's cells to the raster used by terminal playback. */
export declare function tableRaster(data: Data, width: number, height: number): Promise<Uint8Array>;
/** A static first-slide preview; executable web pages and dynamic PC controls are represented by their saved labels. */
export declare function layoutRaster(state: Data, client: MediaClient, signal: AbortSignal): Promise<{
    bytes: Uint8Array;
    warnings: string[];
}>;
