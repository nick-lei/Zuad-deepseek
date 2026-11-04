import { ToolArgsError } from '@deepseek-ai/dsh-tools';
import { createTools as createCoreTools, createLiveTools as createCoreLiveTools, InvalidToolArgumentsError } from './core/tools.js';
export { redact } from './core/tools.js';
export function asDshTool(tool) {
    return {
        name: tool.name, description: tool.description,
        parameters: tool.parameters,
        output: { schema: {}, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
        isConcurrencySafe: () => tool.readOnly,
        async execute(args, exec) {
            let result;
            try {
                result = await tool.execute(args, exec);
            }
            catch (error) {
                if (error instanceof InvalidToolArgumentsError)
                    throw new ToolArgsError([error.message]);
                throw error;
            }
            if (result.code !== 'AUTH_REQUIRED')
                return result;
            return { ...result,
                error: result.reason === 'expired' ? '信发系统登录已失效，请点击本条回复下方的“登录信发系统”。'
                    : result.reason === 'credentials_rejected' ? '后台拒绝了登录信息，请点击本条回复下方的“登录信发系统”重新填写。'
                        : '尚未登录信发系统，请点击本条回复下方的“登录信发系统”。',
                recovery: { action: 'open_plugin_settings', package: 'dsh-plugin-zuad-media',
                    instruction: 'Pause signage operations and direct the user to the sign-in button below this reply. Do not ask for credentials in chat. Do not describe not_signed_in as an expired session. After the user signs in, check the session and inspect existing records before resuming writes.' },
            };
        },
    };
}
export function createTools(config) {
    const runtime = createCoreTools(config);
    return { ...runtime, tools: runtime.tools.map(asDshTool) };
}
export function createLiveTools(readConfig) {
    const runtime = createCoreLiveTools(readConfig);
    return { ...runtime, tools: runtime.tools.map(asDshTool) };
}
//# sourceMappingURL=tools.js.map