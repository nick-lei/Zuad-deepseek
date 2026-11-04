import { ConnectionStore } from './store.js';
import { MediaClient } from '../client.js';
import { resolveConfig } from '../core/config.js';
import { createLiveTools } from '../core/tools.js';
export class SignageConnection {
    store;
    config;
    runtime;
    changes = Promise.resolve();
    constructor(store = new ConnectionStore()) {
        this.store = store;
        this.config = store.defaults();
        this.runtime = createLiveTools(() => this.config);
    }
    serialize(action) {
        const pending = this.changes.then(action, action);
        this.changes = pending.catch(() => { });
        return pending;
    }
    refresh() { return this.serialize(async () => { this.config = await this.store.load(); }); }
    async status() {
        await this.refresh();
        return { ...await this.runtime.status(), fileRoot: this.config.fileRoot, credentialProtection: process.platform === 'win32' ? 'windows-account' : 'file-permissions' };
    }
    signIn(input) {
        return this.serialize(async () => {
            const saved = await this.store.load().catch(() => this.store.defaults());
            const baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim() : '';
            const username = typeof input.username === 'string' ? input.username.trim() : '';
            if (!username)
                throw new Error('请输入后台登录账号。');
            const sameAccount = baseUrl.replace(/\/$/, '') === saved.baseUrl && username === saved.username;
            const password = typeof input.password === 'string' && input.password ? input.password : sameAccount ? saved.password : '';
            if (!password)
                throw new Error('请输入后台登录密码。');
            const timeout = input.timeoutSeconds === undefined ? saved.timeoutMs / 1000 : Number(input.timeoutSeconds);
            if (!Number.isFinite(timeout) || timeout < 1 || timeout > 300)
                throw new Error('请求超时应为 1 到 300 秒。');
            const candidate = resolveConfig({ ...saved, baseUrl, username, password, sessionEnabled: true, orgNum: '', timeoutMs: Math.round(timeout * 1000) });
            if (!candidate.baseUrl)
                throw new Error('请输入有效的后台地址。');
            const check = new MediaClient(candidate);
            try {
                await check.verifyConnection();
            }
            finally {
                check.close();
            }
            await this.store.save(candidate);
            this.config = candidate;
            return this.runtime.connect();
        });
    }
    signOut() {
        return this.serialize(async () => {
            const config = { ...await this.store.load().catch(() => this.store.defaults()), password: '', sessionEnabled: false };
            await this.store.save(config);
            this.config = config;
            return this.runtime.disconnect();
        });
    }
    reconnect() { return this.serialize(async () => { this.config = await this.store.load(); return this.runtime.connect(); }); }
    setTimeout(seconds) {
        return this.serialize(async () => {
            const value = Number(seconds);
            if (!Number.isFinite(value) || value < 1 || value > 300)
                throw new Error('请求超时应为 1 到 300 秒。');
            const config = { ...await this.store.load(), timeoutMs: Math.round(value * 1000) };
            await this.store.save(config);
            this.config = config;
            if (config.sessionEnabled && config.password)
                return this.runtime.connect();
            return this.runtime.status();
        });
    }
    async close() { await this.changes; await this.runtime.close(); }
}
//# sourceMappingURL=connection.js.map