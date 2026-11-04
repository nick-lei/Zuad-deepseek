export interface Config {
    baseUrl: string;
    orgNum: string;
    authMode: 'apiKey' | 'session';
    username: string;
    password: string;
    sessionEnabled: boolean;
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
export declare const configDefaults: Readonly<Config>;
export declare function resolveConfig(input?: Partial<Config>): Config;
