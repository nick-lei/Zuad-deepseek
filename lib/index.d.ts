import type { Context } from '@deepseek-ai/cordis';
import { PluginConfig } from './config.js';
export { PluginConfig as Config };
export { createTools, createLiveTools, redact } from './tools.js';
export declare const name = "zuad-media";
export declare const inject: string[];
export declare function apply(ctx: Context, config: PluginConfig): void;
