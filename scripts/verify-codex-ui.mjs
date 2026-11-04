import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { CodexConnection } from '../lib/codex/connection.js';
import { ConnectionStore } from '../lib/codex/store.js';
import { startConnectionPage } from '../lib/codex/http.js';

const directory = await mkdtemp(join(tmpdir(), 'zuad-ui-'));
const backend = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/api.php/login') {
    const input = JSON.parse(body);
    if (input.password !== 'mock-ui-password') { response.end(JSON.stringify({ code: 1023 })); return; }
    response.setHeader('Set-Cookie', 'sid=ui-test; Path=/; HttpOnly');
    response.end(JSON.stringify({ id: 7, org_num: '1001', real_name: '测试操作员', status: 1 }));
  } else response.end(JSON.stringify({ records: [] }));
});
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${backend.address().port}`;
const connection = new CodexConnection(new ConnectionStore(directory));
const server = await startConnectionPage(connection);
const browser = await chromium.launch({ ...(process.env.ZUAD_TEST_CHROME ? { executablePath: process.env.ZUAD_TEST_CHROME } : process.platform === 'win32' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}), headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const status = page.locator('#statusText');
async function connected() { await page.getByText('已连接', { exact: true }).waitFor(); assert.equal(await page.locator('#password').isVisible(), false); }
async function noOverflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
await mkdir('test-results', { recursive: true });
try {
  await page.goto(server.loginUrl);
  await page.getByText('未连接', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, '', 'bootstrap token removed from location');
  await page.screenshot({ path: 'test-results/codex-login-desktop.png', fullPage: true });
  await page.locator('#baseUrl').fill(baseUrl);
  await page.locator('#username').fill('test-user');
  await page.locator('#password').fill('mock-ui-password');
  await page.getByRole('button', { name: '登录并连接', exact: true }).click();
  await connected();
  assert.equal(await page.locator('#password').inputValue(), '');
  assert.equal(await page.locator('#organization').innerText(), '1001');
  await page.screenshot({ path: 'test-results/codex-connected-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '切换账号', exact: true }).click();
  await page.locator('#username').fill('different-user');
  await page.locator('#password').fill('rejected-password');
  await page.getByRole('button', { name: '登录并连接', exact: true }).click();
  await page.getByText('登录失败，请核对账号和密码。', { exact: true }).waitFor();
  assert.equal(await page.locator('#password').inputValue(), '');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await connected();
  assert.equal(await page.locator('#username').inputValue(), 'test-user');
  await page.locator('summary').click();
  await page.locator('#timeout').fill('45');
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await connected();
  assert.equal((await connection.store.load()).timeoutMs, 45000);
  await page.locator('summary').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({ path: 'test-results/codex-connected-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '切换账号', exact: true }).click();
  await noOverflow();
  await page.screenshot({ path: 'test-results/codex-switch-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: 'test-results/codex-connected-dark.png', fullPage: true });
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await page.getByText('未连接', { exact: true }).waitFor();
  assert.equal((await connection.store.load()).password, '');
  assert.equal(await status.innerText(), '未连接');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ['token exchange', 'account login', 'password clearing', 'failed replacement retains prior account', 'cancel switch', 'timeout save', '390px layout', 'dark mode', 'sign out'], pageErrors: errors.length }));
} finally {
  await browser.close(); await server.close(); await connection.close(); backend.closeAllConnections();
  await new Promise(resolve => backend.close(resolve)); await rm(directory, { recursive: true, force: true });
}
