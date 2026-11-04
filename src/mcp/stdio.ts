#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server.js';
import { SignageConnection } from './connection.js';
import { ConnectionStore } from './store.js';
import { readHost, type McpHost } from './host.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function runStdio(fallback: McpHost = 'mcp') {
  const host = readHost(process.argv.slice(2), fallback);
  const application = await createMcpServer(new SignageConnection(new ConnectionStore(undefined, host)));
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await application.close();
  }
  application.server.onclose = () => { void close(); };
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
  process.stdin.once('end', () => { void close(); });
  await application.server.connect(new StdioServerTransport());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runStdio();
