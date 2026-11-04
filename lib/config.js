import Schema from '@deepseek-ai/schemastery';
import { resolveConfig } from './core/config.js';
export { resolveConfig } from './core/config.js';
export const Config = Schema.object({
    baseUrl: Schema.string().default('').description('Backend origin; alternatively ZUAD_BASE_URL'),
    orgNum: Schema.string().default('').description('Organization; alternatively ZUAD_ORG_NUM'),
    authMode: Schema.union(['apiKey', 'session']).default('session').description('Account login by default; existing administrator-provisioned API-key deployments remain supported'),
    username: Schema.string().default(''),
    password: Schema.string().role('secret').default(''),
    sessionEnabled: Schema.boolean().default(true),
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
    'baseUrl', 'authMode', 'username', 'password', 'sessionEnabled', 'orgNum', 'actorUid', 'actorNickname',
    'timeoutMs',
];
// DSH removes secret-role fields from configuration responses.
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
//# sourceMappingURL=config.js.map