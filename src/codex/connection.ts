import { SignageConnection } from '../mcp/connection.js';
import { ConnectionStore } from './store.js';

export class CodexConnection extends SignageConnection {
  constructor(store = new ConnectionStore()) { super(store); }
}
