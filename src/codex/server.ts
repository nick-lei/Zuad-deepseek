import { createMcpServer } from '../mcp/server.js';
import { CodexConnection } from './connection.js';

export const createCodexServer = (connection = new CodexConnection()) => createMcpServer(connection);
