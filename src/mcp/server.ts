import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, type Tool } from '@modelcontextprotocol/sdk/types.js';
import { SignageConnection } from './connection.js';
import { startConnectionPage } from './http.js';
import { redact } from '../core/tools.js';
import type { Data } from '../client.js';
import { version } from '../version.js';

export async function createMcpServer(connection = new SignageConnection()) {
  const page = await startConnectionPage(connection);
  const server = new Server({ name: 'zuad-media', version }, {
    capabilities: { tools: {} },
    instructions: 'Manage Zuad signage through the provided tools. Start with zuad_connection status and zuad_catalog. Use zuad_connection login for a local sign-in link; never request credentials in chat. Upload/register materials before adding them to program media queues. Saving a program does not publish it. Respect the requested device targets and check asynchronous task results. After an uncertain write, inspect records before retrying.',
  });
  const definitions: Tool[] = connection.runtime.tools.map(tool => ({ name: tool.name, description: tool.description,
    inputSchema: tool.parameters as Tool['inputSchema'], annotations: { readOnlyHint: tool.readOnly, destructiveHint: !tool.readOnly, idempotentHint: tool.readOnly, openWorldHint: true } }));
  definitions.unshift({ name: 'zuad_connection', description: 'Inspect the signage connection or get a local browser sign-in link. login does not accept credentials; the user signs in on the local page. logout clears saved credentials. status returns the working files directory for uploads.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['status', 'login', 'logout'] } }, required: ['action'], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } });
  const validator = new AjvJsonSchemaValidator();
  const validators = new Map(definitions.map(tool => [tool.name, validator.getValidator(tool.inputSchema as Parameters<AjvJsonSchemaValidator['getValidator']>[0])]));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: definitions }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args = {} } = request.params;
    const validate = validators.get(name);
    if (!validate) throw new McpError(ErrorCode.InvalidParams, 'Unknown signage tool');
    const validation = validate(args);
    if (!validation.valid) throw new McpError(ErrorCode.InvalidParams, validation.errorMessage || 'Invalid tool arguments');
    let value: Data;
    try {
      extra.signal.throwIfAborted();
      if (name === 'zuad_connection') {
        const data = args.action === 'logout' ? await connection.signOut() : await connection.status();
        value = { ok: true, data: { ...data as object, ...(args.action !== 'logout' ? { loginUrl: page.loginUrl } : {}) } };
      } else {
        await connection.refresh();
        const tool = connection.runtime.tools.find(tool => tool.name === name)!;
        value = await tool.execute(args, { signal: extra.signal }) as Data;
        if (value.code === 'AUTH_REQUIRED') value = { ...value, error: '请在本地连接页面登录信发系统后继续。', recovery: { action: 'open_login_page', loginUrl: page.loginUrl, instruction: 'Show this local login link to the user. Never request credentials in chat. After sign-in, inspect existing records before resuming writes.' } };
      }
    } catch {
      value = { ok: false, error: '信发操作未完成。请检查连接状态；涉及写入时，先核对后台记录再重试。', recovery: { action: 'open_login_page', loginUrl: page.loginUrl } };
    }
    const output = redact(value);
    return { content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }], structuredContent: output, isError: output.ok === false };
  });
  return { server, connection, page, async close() { await server.close(); await page.close(); await connection.close(); } };
}
