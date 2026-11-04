export const loginPage = String.raw `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zuad 信发助手 · 账号连接</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#202124;background:#fff;font-size:14px;letter-spacing:0}*{box-sizing:border-box}body{margin:0}main{width:100%;max-width:608px;margin:48px auto;padding:0 24px 40px}header{display:flex;align-items:center;gap:12px;border-bottom:1px solid #e5e7eb;padding-bottom:24px;margin-bottom:28px}h1{font-size:22px;font-weight:650;margin:0}header span{color:#64748b;font-size:12px}h2{font-size:16px;margin:0 0 24px}.status{display:flex;gap:9px;align-items:center;margin:0 0 24px;font-weight:600;min-height:22px}.dot{width:7px;height:7px;background:#9ca3af;border-radius:50%;flex-shrink:0}.connected .dot{background:#16a36a}.fields{display:grid;gap:18px}label{display:block;font-size:13px;margin-bottom:8px}input{font:inherit;width:100%;height:40px;padding:8px 11px;border:1px solid #d3d7de;border-radius:6px;color:inherit;background:transparent;min-width:0}input:focus{outline:2px solid #69758c;outline-offset:2px}input:disabled,button:disabled{opacity:.55}dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px 24px;font-size:13px;line-height:1.6;margin:0}dt{color:#677181}dd{margin:0;overflow-wrap:anywhere}.account{font-size:12px;color:#677181;margin-top:2px}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}button{font:inherit;height:38px;padding:0 14px;border:1px solid #d3d7de;border-radius:6px;color:inherit;background:transparent;cursor:pointer;white-space:nowrap}button:hover:not(:disabled){background:#f3f4f6}.primary{background:#24272d;color:#fff;border-color:#24272d}.primary:hover:not(:disabled){background:#41454d}.quiet{border-color:transparent;color:#677181}details{border-top:1px solid #e5e7eb;margin-top:24px;padding-top:18px}summary{cursor:pointer;font-size:13px}details label{margin-top:18px}#timeout{width:128px}#error{color:#b42318;font-size:13px;line-height:1.6;overflow-wrap:anywhere;margin:18px 0 0}#error:empty{display:none}[hidden]{display:none!important}@media(max-width:480px){main{margin:24px auto;padding:0 20px 32px}header{gap:8px}h1{font-size:20px}dl{gap:16px 20px}}@media(prefers-color-scheme:dark){:root{color:#e6e7ea;background:#18191c}header,details{border-color:#35373d}input,button{border-color:#51545c}.primary{color:#202124;background:#e6e7ea;border-color:#e6e7ea}.primary:hover:not(:disabled){background:#cfd2d8}button:hover:not(:disabled){background:#303238}dt,.account,header span,.quiet{color:#a7afbe}#error{color:#fda29b}}
</style></head><body><main>
<header><h1>Zuad 信发助手</h1><span>账号连接</span></header><h2>连接信发系统</h2>
<div id="status" class="status" role="status" aria-live="polite"><span class="dot"></span><span id="statusText">正在读取连接状态</span></div>
<dl id="overview" hidden><dt>后台地址</dt><dd id="address"></dd><dt>当前用户</dt><dd><div id="displayName"></div><div class="account" id="accountName"></div></dd><dt>所属组织</dt><dd id="organization"></dd></dl>
<form id="login" hidden><div class="fields"><div><label for="baseUrl">后台地址</label><input id="baseUrl" type="url" autocomplete="url" placeholder="https://your-signage.example.com" required></div><div><label for="username">账号</label><input id="username" autocomplete="username" required></div><div><label for="password">密码</label><input id="password" type="password" autocomplete="current-password"></div></div><div class="actions"><button class="primary" type="submit">登录并连接</button><button id="cancel" type="button" hidden>取消</button></div></form>
<p id="error" role="alert"></p><div id="connectedActions" class="actions" hidden><button id="reconnect" type="button">重新连接</button><button id="switch" type="button">切换账号</button><button id="logout" class="quiet" type="button">退出登录</button></div>
<details><summary>高级配置</summary><label for="timeout">请求超时（秒）</label><input id="timeout" type="number" min="1" max="300" value="30" form="login"> <button id="saveSettings" type="button" hidden>保存配置</button></details>
</main><script src="/app.js" defer></script></body></html>`;
export const loginScript = String.raw `'use strict';
const byId = id => document.getElementById(id);
let current = null, editing = false, busy = false;
async function request(path, body) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Zuad-Request': '1' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || '连接未成功，请稍后重试。');
  return result.data;
}
function render() {
  const connected = Boolean(current && current.connected);
  byId('status').classList.toggle('connected', connected);
  byId('statusText').textContent = busy ? '正在处理' : connected ? '已连接' : '未连接';
  byId('overview').hidden = !connected || editing;
  byId('login').hidden = connected && !editing;
  byId('cancel').hidden = !editing;
  byId('connectedActions').hidden = editing || !current || (!connected && !current.hasPassword);
  if (current) {
    byId('address').textContent = current.baseUrl || '';
    byId('displayName').textContent = current.nickname || current.username || '';
    byId('accountName').textContent = current.nickname !== current.username ? current.username || '' : '';
    byId('organization').textContent = current.orgNum || '';
  }
  for (const control of document.querySelectorAll('input,button')) control.disabled = busy;
  byId('saveSettings').hidden = !current || editing || Number(byId('timeout').value) === (current.timeoutMs || 30000) / 1000;
}
function resetDraft() {
  byId('baseUrl').value = current && current.baseUrl || '';
  byId('username').value = current && current.username || '';
  byId('password').value = '';
  byId('password').placeholder = current && current.hasPassword ? '已保存，留空保持不变' : '请输入后台登录密码';
  byId('timeout').value = current && current.timeoutMs ? current.timeoutMs / 1000 : 30;
}
async function perform(action) {
  if (busy) return;
  busy = true; byId('error').textContent = ''; render();
  try { await action(); editing = false; resetDraft(); }
  catch (error) { byId('error').textContent = error.message; current = await request('/api/status').catch(() => current); }
  finally { busy = false; render(); }
}
byId('login').addEventListener('submit', event => {
  event.preventDefault();
  const values = { baseUrl: byId('baseUrl').value, username: byId('username').value, password: byId('password').value, timeoutSeconds: Number(byId('timeout').value) };
  byId('password').value = '';
  perform(async () => { current = await request('/api/login', values); });
});
byId('switch').addEventListener('click', () => { editing = true; resetDraft(); byId('error').textContent = ''; render(); byId('username').focus(); });
byId('cancel').addEventListener('click', () => { editing = false; resetDraft(); byId('error').textContent = ''; render(); byId('switch').focus(); });
byId('reconnect').addEventListener('click', () => perform(async () => { current = await request('/api/connect', {}); }));
byId('logout').addEventListener('click', () => perform(async () => { current = await request('/api/logout', {}); }));
byId('timeout').addEventListener('input', render);
byId('saveSettings').addEventListener('click', () => {
  if (!byId('timeout').reportValidity()) return;
  perform(async () => { current = await request('/api/settings', { timeoutSeconds: Number(byId('timeout').value) }); });
});
request('/api/status').then(data => { current = data; resetDraft(); render(); }).catch(error => { byId('error').textContent = error.message; render(); });
`;
//# sourceMappingURL=login-page.js.map