import Schema from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
export interface Config {
    baseUrl: string;
    orgNum: string;
    authMode: 'apiKey' | 'session';
    actorUid: string;
    actorNickname: string;
    usernameEnv: string;
    passwordEnv: string;
    apiKeyEnv: string;
    timeoutMs: number;
    fileRoot: string;
    editorRoot: string;
    browserExecutable: string;
    ptzBaseUrl: string;
    paymentGateway: string;
    signCodeEnv: string;
}
export declare const Config: Schema<Config>;
export declare const editableConfigKeys: readonly ["baseUrl", "orgNum", "actorUid", "actorNickname", "timeoutMs"];
type EditableConfigKey = typeof editableConfigKeys[number];
export type PluginConfig = Omit<Config, EditableConfigKey> & {
    [K in EditableConfigKey]: Volatile<Config[K]>;
};
export declare const PluginConfig: Schema<PluginConfig>;
export declare function readPluginConfig(input: PluginConfig): Config;
export declare function resolveConfig(input?: Partial<Config>): Config;
export {};
