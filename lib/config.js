import Schema from '@deepseek-ai/schemastery';
import { homedir } from 'node:os';
import { join } from 'node:path';
export const Config = Schema.object({
    baseUrl: Schema.string().default('').description('Backend origin; alternatively ZUAD_BASE_URL'),
    orgNum: Schema.string().default('').description('Organization; alternatively ZUAD_ORG_NUM'),
    authMode: Schema.union(['apiKey', 'session']).default('apiKey').description('API key uses /apikey.php without password login; session is legacy cookie authentication'),
    actorUid: Schema.string().default('').description('Business attribution UID; alternatively ZUAD_ACTOR_UID. Required when a write includes uid'),
    actorNickname: Schema.string().default('').description('Business attribution name; alternatively ZUAD_ACTOR_NICKNAME'),
    usernameEnv: Schema.string().default('ZUAD_USERNAME'),
    passwordEnv: Schema.string().default('ZUAD_PASSWORD'),
    apiKeyEnv: Schema.string().default('ZUAD_API_KEY'),
    timeoutMs: Schema.number().min(1000).max(300000).default(30000),
    fileRoot: Schema.string().default('').description('Optional deployment override for the automatic working files directory; ZUAD_FILE_ROOT'),
    editorRoot: Schema.string().default('').description('Deprecated, ignored; program compilation is bundled'),
    browserExecutable: Schema.string().default('').description('Deprecated, ignored; program compilation does not launch a browser'),
    ptzBaseUrl: Schema.string().default('').description('Optional trusted PTZ gateway origin'),
    paymentGateway: Schema.string().default('').description('Optional trusted ProxyPayment domain_interface'),
    signCodeEnv: Schema.string().default('ZUAD_SIGN_CODE'),
});
export const editableConfigKeys = [
    'baseUrl', 'orgNum', 'actorUid', 'actorNickname',
    'timeoutMs',
];
// Credential references remain deployment-owned and are absent from the settings namespace.
export const PluginConfig = Schema.object({
    ...Config.dict,
    ...Object.fromEntries(editableConfigKeys.map(key => [key, Config.dict[key].volatile()])),
});
export function readPluginConfig(input) {
    const plain = { ...input };
    for (const key of editableConfigKeys)
        plain[key] = input[key].get();
    return resolveConfig(plain);
}
export function resolveConfig(input = {}) {
    const config = Config(input);
    config.baseUrl ||= process.env.ZUAD_BASE_URL ?? '';
    config.orgNum ||= process.env.ZUAD_ORG_NUM ?? '';
    config.actorUid ||= process.env.ZUAD_ACTOR_UID ?? '';
    config.actorNickname ||= process.env.ZUAD_ACTOR_NICKNAME ?? '';
    config.fileRoot ||= process.env.ZUAD_FILE_ROOT || join(homedir(), '.dsh', 'data', 'zuad-media', 'files');
    if (config.baseUrl) {
        const url = new URL(config.baseUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/')
            throw new Error('baseUrl must be an HTTP(S) origin without credentials, path, query or fragment');
        config.baseUrl = url.origin;
    }
    if (config.orgNum && !/^[A-Za-z0-9_-]+$/.test(config.orgNum))
        throw new Error('Invalid orgNum');
    if (config.actorUid && !/^[A-Za-z0-9_-]+$/.test(config.actorUid))
        throw new Error('Invalid actorUid');
    if (config.ptzBaseUrl) {
        const url = new URL(config.ptzBaseUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/')
            throw new Error('ptzBaseUrl must be an HTTP(S) origin');
        config.ptzBaseUrl = url.origin;
    }
    if (config.paymentGateway && !/^https?:\/\//.test(config.paymentGateway))
        throw new Error('paymentGateway must be HTTP(S)');
    return config;
}
//# sourceMappingURL=config.js.map