import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveConfig } from '../core/config.js';
export function defaultDataDirectory(host = 'mcp') {
    if (host === 'codex')
        return process.env.ZUAD_CODEX_DATA_DIR || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'zuad-media');
    return join(process.env.ZUAD_DATA_DIR || join(homedir(), '.zuad-media'), host);
}
async function dpapi(value, decrypt) {
    const script = `$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Security
$text = [Console]::In.ReadToEnd()
$bytes = ${decrypt ? '[Convert]::FromBase64String($text)' : '[Text.Encoding]::UTF8.GetBytes($text)'}
$result = [Security.Cryptography.ProtectedData]::${decrypt ? 'Unprotect' : 'Protect'}($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Console]::Out.Write(${decrypt ? '[Text.Encoding]::UTF8.GetString($result)' : '[Convert]::ToBase64String($result)'})`;
    return new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let output = '';
        const timer = setTimeout(() => child.kill(), 15000);
        child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
        child.stderr.resume();
        child.on('error', () => { clearTimeout(timer); reject(new Error('Local credential protection is unavailable')); });
        child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error('Cannot protect or read local credentials')); });
        child.stdin.on('error', () => { });
        child.stdin.end(value);
    });
}
export class ConnectionStore {
    host;
    path;
    cached;
    directory;
    constructor(directory, host = 'mcp') {
        this.host = host;
        this.directory = directory ?? defaultDataDirectory(host);
        this.path = join(this.directory, 'connection.json');
    }
    defaults() {
        return resolveConfig({ authMode: 'session', sessionEnabled: false, fileRoot: join(this.directory, 'files'), usernameEnv: `ZUAD_${this.host.toUpperCase()}_USERNAME`, passwordEnv: `ZUAD_${this.host.toUpperCase()}_PASSWORD` });
    }
    async load() {
        let text;
        try {
            text = await readFile(this.path, 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return this.defaults();
            throw new Error('Cannot read local connection settings');
        }
        if (this.cached?.text === text)
            return { ...this.cached.config };
        try {
            const data = JSON.parse(text);
            if (data.version !== 1 || !['dpapi', 'file'].includes(data.protection))
                throw new Error('format');
            const password = data.protection === 'dpapi' ? data.credential ? await dpapi(data.credential, true) : '' : data.credential;
            const config = resolveConfig({ ...this.defaults(), baseUrl: data.baseUrl, username: data.username, password, timeoutMs: data.timeoutMs, sessionEnabled: data.sessionEnabled, orgNum: '' });
            this.cached = { text, config };
            return { ...config };
        }
        catch {
            throw new Error('Cannot read saved connection. Open the connection page and sign in again.');
        }
    }
    async save(config) {
        const protection = process.platform === 'win32' ? 'dpapi' : 'file';
        const credential = config.password && protection === 'dpapi' ? await dpapi(config.password, false) : config.password;
        const data = { version: 1, protection, baseUrl: config.baseUrl, username: config.username, timeoutMs: config.timeoutMs, sessionEnabled: config.sessionEnabled, credential };
        const text = JSON.stringify(data, null, 2) + '\n';
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const temporary = join(this.directory, `.connection-${randomUUID()}.tmp`);
        try {
            await writeFile(temporary, text, { mode: 0o600, flag: 'wx' });
            await rename(temporary, this.path);
            this.cached = { text, config: { ...config } };
        }
        finally {
            await rm(temporary, { force: true });
        }
    }
}
//# sourceMappingURL=store.js.map