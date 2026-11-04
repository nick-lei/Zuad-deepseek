import { type Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
export interface ConnectionActions {
    status(): Promise<unknown>;
    connect(): Promise<unknown>;
    disconnect(): Promise<unknown>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        zuadMedia: ConnectionController;
    }
}
/** Only connection facts cross this RPC; credentials use DSH's redacted settings. */
export declare class ConnectionController extends TypertRemoteService {
    private readonly actions;
    constructor(ctx: Context, actions: ConnectionActions);
    status(): Promise<unknown>;
    connect(): Promise<{
        ok: boolean;
        data: unknown;
        error?: never;
    } | {
        ok: boolean;
        error: string;
        data?: never;
    }>;
    disconnect(): Promise<unknown>;
}
