#!/usr/bin/env node
import { SignageConnection } from './connection.js';
import { ConnectionStore } from './store.js';
import { startConnectionPage } from './http.js';
import { readHost, type McpHost } from './host.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function runConnectionPage(fallback: McpHost = 'mcp') {
  const connection = new SignageConnection(new ConnectionStore(undefined, readHost(process.argv.slice(2), fallback)));
  const page = await startConnectionPage(connection);
  process.stdout.write(JSON.stringify({ loginUrl: page.loginUrl }) + '\n');
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await page.close(); await connection.close();
  }
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runConnectionPage();
