import { homedir } from 'node:os';
import { join } from 'node:path';

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

export const configDefaults: Readonly<Config> = Object.freeze({
  baseUrl: '', orgNum: '', authMode: 'session', username: '', password: '', sessionEnabled: true,
  actorUid: '', actorNickname: '', usernameEnv: 'ZUAD_USERNAME', passwordEnv: 'ZUAD_PASSWORD',
  apiKeyEnv: 'ZUAD_API_KEY', timeoutMs: 30000, fileRoot: '', editorRoot: '', browserExecutable: '',
  ptzBaseUrl: '', paymentGateway: '', signCodeEnv: 'ZUAD_SIGN_CODE',
});

export function resolveConfig(input: Partial<Config> = {}): Config {
  const config = { ...configDefaults };
  for (const key of Object.keys(configDefaults) as (keyof Config)[]) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== typeof configDefaults[key]) throw new Error(`Invalid ${key}`);
    Object.assign(config, { [key]: value });
  }
  if (!['apiKey', 'session'].includes(config.authMode)) throw new Error('Invalid authMode');
  if (!Number.isFinite(config.timeoutMs) || config.timeoutMs < 1000 || config.timeoutMs > 300000) throw new Error('Invalid timeoutMs');
  config.baseUrl ||= process.env.ZUAD_BASE_URL ?? '';
  if (!config.username) config.orgNum ||= process.env.ZUAD_ORG_NUM ?? '';
  config.actorUid ||= process.env.ZUAD_ACTOR_UID ?? '';
  config.actorNickname ||= process.env.ZUAD_ACTOR_NICKNAME ?? '';
  config.fileRoot ||= process.env.ZUAD_FILE_ROOT || join(homedir(), '.dsh', 'data', 'zuad-media', 'files');
  if (config.baseUrl) {
    const url = new URL(config.baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/')
      throw new Error('baseUrl must be an HTTP(S) origin without credentials, path, query or fragment');
    config.baseUrl = url.origin;
  }
  if (config.orgNum && !/^[A-Za-z0-9_-]+$/.test(config.orgNum)) throw new Error('Invalid orgNum');
  if (config.actorUid && !/^[A-Za-z0-9_-]+$/.test(config.actorUid)) throw new Error('Invalid actorUid');
  if (config.ptzBaseUrl) {
    const url = new URL(config.ptzBaseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('ptzBaseUrl must be an HTTP(S) origin');
    config.ptzBaseUrl = url.origin;
  }
  if (config.paymentGateway && !/^https?:\/\//.test(config.paymentGateway)) throw new Error('paymentGateway must be HTTP(S)');
  return config;
}
