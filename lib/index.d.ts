import type { Context } from '@deepseek-ai/cordis';
import { Config, PluginConfig } from './config.js';
import { MediaClient, type Data } from './client.js';
export { PluginConfig as Config };
export declare const name = "zuad-media";
export declare const inject: string[];
export declare function redact(value: any): any;
export declare function createTools(config: Config): {
    tools: import("@deepseek-ai/dsh-tools").ToolDefinition[];
    client: MediaClient;
    close(): Promise<void>;
};
/** Keep each invocation on one config snapshot, retiring old clients after their calls finish. */
export declare function createLiveTools(readConfig: () => Config): {
    tools: {
        execute(args: Data, exec: Parameters<(args: unknown, exec: import("@deepseek-ai/dsh-tools").ToolRunContext) => Promise<unknown>>[1]): Promise<unknown>;
        output: import("@deepseek-ai/dsh-tools").ToolOutputDefinition;
        projectContent?(exec: Readonly<import("@deepseek-ai/dsh-tools").ToolExecution>, result: Readonly<import("@deepseek-ai/dsh-tools").ToolExecutionResult>): import("@deepseek-ai/dsh-llm").ContentBlock[] | undefined;
        finalizeContent?(exec: Readonly<import("@deepseek-ai/dsh-tools").ToolExecution>, result: Readonly<import("@deepseek-ai/dsh-tools").ToolExecutionResult>): import("@deepseek-ai/dsh-llm").ContentBlock[] | undefined;
        timeoutMs?: number;
        isConcurrencySafe?(args: unknown): boolean;
        presentCall?(args: unknown): import("@deepseek-ai/dsh-tools").ToolCallView | undefined;
        presentResult?(args: unknown, result: import("@deepseek-ai/dsh-tools").ToolResult): import("@deepseek-ai/dsh-tools").ToolResultView | undefined;
        deferLoading?: true;
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    }[];
    close(): Promise<void>;
};
export declare function apply(ctx: Context, config: PluginConfig): void;
