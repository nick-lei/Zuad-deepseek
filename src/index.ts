import type { Context } from '@deepseek-ai/cordis';
import { PluginConfig, readPluginConfig } from './config.js';
import { ConnectionController } from './connection.js';
import { createLiveTools } from './tools.js';

export { PluginConfig as Config };
export { createTools, createLiveTools, redact } from './tools.js';
export const name = 'zuad-media';
export const inject = ['tools'];

export function apply(ctx: Context, config: PluginConfig) {
  const plugin = createLiveTools(() => readPluginConfig(config));
  new ConnectionController(ctx, plugin);
  for (const tool of plugin.tools) ctx.tools.register(tool);
  ctx.effect(() => () => plugin.close());
}
