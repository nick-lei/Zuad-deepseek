import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { loginPage, loginScript } from './login-page.js';
import { SignInRequiredError } from '../client.js';
export async function startConnectionPage(connection) {
    const token = randomBytes(32).toString('hex');
    let origin = '', cookieName = '';
    const equalToken = (candidate) => { const bytes = Buffer.from(candidate); return bytes.length === token.length && timingSafeEqual(bytes, Buffer.from(token)); };
    const send = (response, status, data) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(data)); };
    async function body(request) {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
            size += chunk.length;
            if (size > 16384)
                throw new Error('请求内容过大。');
            chunks.push(Buffer.from(chunk));
        }
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new Error('无效的请求内容。');
        return value;
    }
    const server = createServer(async (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
        if (request.headers.host !== origin.slice('http://'.length)) {
            send(response, 403, { ok: false, error: 'Invalid host' });
            return;
        }
        const url = new URL(request.url || '/', origin);
        if (request.method === 'GET' && url.pathname === '/' && equalToken(url.searchParams.get('token') || '')) {
            response.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict`);
            response.writeHead(303, { Location: '/' });
            response.end();
            return;
        }
        const cookie = (request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
        if (!equalToken(cookie)) {
            send(response, 403, { ok: false, error: '请在助手中重新获取信发系统登录入口。' });
            return;
        }
        try {
            if (request.method === 'GET' && ['/', '/app.js'].includes(url.pathname)) {
                response.writeHead(200, { 'Content-Type': url.pathname === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' });
                response.end(url.pathname === '/' ? loginPage : loginScript);
                return;
            }
            if (request.method === 'GET' && url.pathname === '/api/status') {
                const status = await connection.status();
                send(response, 200, { ok: true, data: { ...status, timeoutMs: (await connection.store.load()).timeoutMs } });
                return;
            }
            if (request.method !== 'POST') {
                send(response, 404, { ok: false, error: 'Not found' });
                return;
            }
            if (request.headers.origin !== origin || request.headers['x-zuad-request'] !== '1' || !request.headers['content-type']?.startsWith('application/json')) {
                send(response, 403, { ok: false, error: 'Invalid request origin' });
                return;
            }
            const input = await body(request);
            let data;
            if (url.pathname === '/api/login')
                data = await connection.signIn(input);
            else if (url.pathname === '/api/connect')
                data = await connection.reconnect();
            else if (url.pathname === '/api/logout')
                data = await connection.signOut();
            else if (url.pathname === '/api/settings')
                data = await connection.setTimeout(input.timeoutSeconds);
            else {
                send(response, 404, { ok: false, error: 'Not found' });
                return;
            }
            send(response, 200, { ok: true, data: { ...data, timeoutMs: (await connection.store.load()).timeoutMs } });
        }
        catch (error) {
            const message = error instanceof SignInRequiredError ? '登录失败，请核对账号和密码。'
                : error instanceof Error && (/^[\u3400-\u9fff]/.test(error.message)) ? error.message
                    : '连接未成功，请检查后台地址、账号权限和网络。';
            send(response, 400, { ok: false, error: message });
        }
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    origin = `http://127.0.0.1:${address.port}`;
    cookieName = `zuad_local_${address.port}`;
    return { origin, loginUrl: `${origin}/?token=${token}`, async close() { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
//# sourceMappingURL=http.js.map