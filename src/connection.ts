import { type Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';

export interface ConnectionActions {
  status(): Promise<unknown>;
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
}

declare module '@deepseek-ai/cordis' {
  interface Context { zuadMedia: ConnectionController }
}

/** Only connection facts cross this RPC; credentials use DSH's redacted settings. */
export class ConnectionController extends TypertRemoteService {
  constructor(ctx: Context, private readonly actions: ConnectionActions) { super(ctx, 'zuadMedia'); }

  @Remote
  status() { return this.actions.status(); }

  @Remote
  async connect() {
    try { return { ok: true, data: await this.actions.connect() }; }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Connection failed' }; }
  }

  @Remote
  disconnect() { return this.actions.disconnect(); }
}
