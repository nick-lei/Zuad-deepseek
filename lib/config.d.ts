import Schema from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
import { type Config as CoreConfig } from './core/config.js';
export { resolveConfig } from './core/config.js';
export type Config = CoreConfig;
export declare const Config: Schema<Config>;
export declare const editableConfigKeys: readonly ["baseUrl", "authMode", "username", "password", "sessionEnabled", "orgNum", "actorUid", "actorNickname", "timeoutMs"];
type EditableConfigKey = typeof editableConfigKeys[number];
export type PluginConfig = Omit<Config, EditableConfigKey> & {
    [K in EditableConfigKey]: Volatile<Config[K]>;
};
export declare const PluginConfig: Schema<PluginConfig>;
export declare function readPluginConfig(input: PluginConfig): Config;
