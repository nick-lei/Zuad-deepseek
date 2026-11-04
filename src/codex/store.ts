import { ConnectionStore as McpConnectionStore, defaultDataDirectory as mcpDataDirectory } from '../mcp/store.js';

export const defaultDataDirectory = () => mcpDataDirectory('codex');
export class ConnectionStore extends McpConnectionStore {
  constructor(directory = defaultDataDirectory()) { super(directory, 'codex'); }
}
