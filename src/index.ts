import type { Context } from '@deepseek-ai/cordis';
import { defineTool, type ParameterSchemaSpec } from '@deepseek-ai/dsh-tools';
import { Config, PluginConfig, readPluginConfig, resolveConfig } from './config.js';
import { MediaClient, ApiError, type Data, type Query } from './client.js';
import { resources, object, id, type ResourceName } from './catalog.js';
import { MediaService, commands, type Target, type ScheduleInput } from './service.js';
import { MediaFiles } from './files.js';
import { LayoutRenderer, type LayoutInput } from './layout.js';
import { SpecialOperations } from './special.js';

export { PluginConfig as Config };
export const name = 'zuad-media';
export const inject = ['tools'];

export function redact(value: any): any {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const result: Data = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = /password|passwd|secret|token|cookie|api.?key|sign.?code/i.test(key) || (key === 'value' && /password|secret|token|key/i.test(String(value.name))) ? '[redacted]' : redact(entry);
    }
    return result;
  }
  return value;
}

const targetSchema = { type: 'object', additionalProperties: false, required: true, properties: {
  kind: { type: 'string', enum: ['program', 'group'], required: true }, id: { type: 'string', required: true },
} } as const;
const deviceParams = {
  deviceIds: { type: 'array', items: { type: 'string' }, description: 'Database device IDs, not terminal serials' },
  deviceGroupIds: { type: 'array', items: { type: 'string' } },
} as const;
const recordData = { type: 'object', additionalProperties: true, description: 'Backend field names. Call zuad_catalog first. Identity and organization are injected.' } as const;

export function createTools(config: Config) {
  const client = new MediaClient(resolveConfig(config));
  const service = new MediaService(client), files = new MediaFiles(client), renderer = new LayoutRenderer(client, files), special = new SpecialOperations(client, files);
  const tool = (toolName: string, description: string, parameters: ParameterSchemaSpec, write: boolean, execute: (args: Data, signal: AbortSignal) => Promise<any>) => defineTool({
    name: toolName, description, parameters,
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
    isConcurrencySafe: () => !write,
    async execute(args, exec) {
      const run = async () => {
        exec.signal.throwIfAborted();
        try { return JSON.parse(JSON.stringify(redact({ ok: true, data: await execute(args, exec.signal) }))); }
        catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error), uncertain: error instanceof ApiError && error.uncertain }; }
      };
      return write ? service.serialize(run) : run();
    },
  });
  const tools = [
    tool('zuad_catalog', 'Discover all signage resources, field examples and supported operations. Start here. Field examples are not required-field declarations.', { resource: { type: 'string', enum: Object.keys(resources) } }, false, async a => service.catalog(a.resource)),
    tool('zuad_session', 'Check configured authentication. API-key mode verifies access with a one-record program query and needs no password login; actor UID is configured business attribution, not an authenticated user. Legacy session mode logs in with environment credentials. Never request secrets as tool arguments.', {}, false, async (_a, signal) => {
      const identity = await client.login(signal);
      if (identity.authMode === 'apiKey') await client.query('programs', { include: 'id', limit: 1 }, signal);
      return { ...identity, verified: true };
    }),
    tool('zuad_query', 'Query any catalog resource, including programs, devices, tasks, statistics, logs and system administration. Scoped to configured organization. No plugin cap on page size or total pages. Advance page until possiblyTruncated is false (an empty page); backend page sizes may be smaller than requested.', {
      resource: { type: 'string', enum: Object.keys(resources), required: true },
      id: { type: 'string', description: 'Fetch one database record by ID' },
      filters: { type: 'array', items: { type: 'string' }, description: 'AND conditions: field,eq,value; field,cs,text; field,in,1,2; field,ge,123' },
      include: { type: 'string' }, order: { type: 'string', description: 'field,asc or field,desc' }, limit: { type: 'integer', description: 'Requested page size, default 100; positive integer with no plugin cap' }, page: { type: 'integer' }, shared: { type: 'boolean', description: 'Include shared org=-1 records when resource supports them' },
    }, false, async (a, signal) => a.id ? client.get(a.resource as ResourceName, a.id, signal, a.shared === true, a.include) : client.query(a.resource as ResourceName, a as Query, signal)),
    tool('zuad_record', 'Create/update/delete catalog records: groups, regions, screens, seats, power timers, cameras, products, packages, users, departments, roles, menus, organizations, settings, authorization, orders and logs. Use specialized tools for layouts, schedules, publishing, device commands and file upload. Deletion changes backend records immediately.', {
      operation: { type: 'string', enum: ['create', 'update', 'delete'], required: true }, resource: { type: 'string', enum: Object.keys(resources), required: true }, id: { type: 'string' }, data: recordData,
    }, true, async (a, signal) => service.crud(a.operation, a.resource, a.data ? object(a.data) : {}, a.id, signal)),
    tool('zuad_publish', 'Publish a program or program group to devices/groups. Resolves terminal IDs, clears pending duplicates, records playback history, updates device program and creates update_layout tasks. Returns per-device progress. Query task states afterward.', { target: targetSchema, ...deviceParams }, true, async (a, signal) => service.publish(a.target as Target, a.deviceIds ?? [], a.deviceGroupIds ?? [], signal)),
    tool('zuad_device_command', 'Create device command tasks. restore_factory clears program configuration; del_device also deletes device records. Execution on terminals is asynchronous. Query task states and device_configs for screenshot/device-info results.', {
      command: { type: 'string', enum: commands, required: true }, ...deviceParams, packageId: { type: 'string', description: 'Required for update_app' },
    }, true, async (a, signal) => service.command(a.command, a.deviceIds ?? [], a.deviceGroupIds ?? [], a.packageId, signal)),
    tool('zuad_default_playback', 'Set default program/group on devices or device groups.', { target: targetSchema, ...deviceParams }, true, async (a, signal) => service.defaultPlayback(a.target as Target, a.deviceIds ?? [], a.deviceGroupIds ?? [], signal)),
    tool('zuad_schedule', 'Create/update schedule or urgent insertion, resolving groups and checking conflicts. Unix times are seconds. For dates, daily clock times are interpreted in Asia/Shanghai. Delete through zuad_record.', {
      kind: { type: 'string', enum: ['schedule', 'insertion'], required: true }, name: { type: 'string', required: true }, target: targetSchema,
      deviceKind: { type: 'string', enum: ['device', 'group'], required: true }, deviceId: { type: 'string', required: true },
      startTime: { type: 'integer', required: true }, endTime: { type: 'integer', required: true }, dates: { type: 'array', items: { type: 'string' } }, color: { type: 'string' }, id: { type: 'string', description: 'Existing schedule/insertion ID for update' },
    }, true, async (a, signal) => service.schedule(a as ScheduleInput, signal)),
    tool('zuad_layout', 'Describe control fields/enums, compile or save program/template with the bundled Node compiler. No local editor or browser required. Start with describe and optional componentType. Supply sourceKind/sourceId with patches, raw content, or slides. Coordinates use original canvas px. QR uses content. Media use queueList. Upload/register new materials through zuad_file first. table accepts rectangular string cells and regenerates/registers its image when saving. Thumbnails are static first-slide previews; dynamic web/PC controls use labels. compile returns payload; save writes backend records.', {
      operation: { type: 'string', enum: ['describe', 'compile', 'save_program', 'save_template'], required: true }, componentType: { type: 'string', description: 'For describe: e.g. image, grid, webMixed, text, marquee, clock, qrcode, table' }, name: { type: 'string' }, id: { type: 'string' }, sourceKind: { type: 'string', enum: ['program', 'template'] }, sourceId: { type: 'string' },
      content: recordData, width: { type: 'integer' }, height: { type: 'integer' },
      slides: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { duration: { type: 'number' }, components: { type: 'array', items: recordData, required: true } } } },
      patches: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { slide: { type: 'integer', required: true }, index: { type: 'integer', required: true }, changes: { ...recordData, required: true } } } },
      previewPath: { type: 'string', description: 'Optional new PNG path under fileRoot, never overwrites' }, folderId: { type: 'string' },
    }, true, async (a, signal) => renderer.execute(a as LayoutInput, signal)),
    tool('zuad_file', 'Upload/register materials, upload 5 MiB chunks, upload attachments/HTML, import ZIP programs/templates, export ZIP links, or import monitors. Local paths must stay under fileRoot (automatically created at ~/.dsh/data/zuad-media/files unless deployment overrides it). Normal material upload automatically registers/deduplicates material metadata.', {
      operation: { type: 'string', enum: ['upload_material', 'upload_chunks', 'register_material', 'upload_attachment', 'upload_html', 'import_program', 'import_template', 'export_program', 'export_template', 'import_monitors'], required: true },
      path: { type: 'string' }, id: { type: 'string' }, folderId: { type: 'string' }, mimeType: { type: 'string', description: 'Multipart MIME type; common image extensions are inferred when omitted, otherwise application/octet-stream' }, field: { type: 'string', description: 'Multipart attachment field, default file' }, htmlSource: { type: 'string' }, fileUrl: { type: 'string' },
      metadata: { ...recordData, description: 'register_material only: server-produced sourceName,encryptionName,recordStart,fileMd5,fileSize,fileSourceType and optional filePreview,page_size,duration after successful chunk merge or an upload whose registration failed' },
    }, true, async (a, signal) => files.execute(a.operation, a, signal)),
    tool('zuad_plan', 'Create/update/delete/start a plan through existing v5 endpoints. Query plans through zuad_query. Backend v5 routing must be enabled.', {
      operation: { type: 'string', enum: ['create', 'update', 'delete', 'start'], required: true }, data: { ...recordData, required: true, description: 'id for existing plans; create/update: planName, layoutId, layoutCode 0/1, remark, regionId' },
    }, true, async (a, signal) => service.plan(a.operation, object(a.data), signal)),
    tool('zuad_monitor', 'Start legacy monitor WebRTC, export monitors to a local file, or issue PTZ commands to the configured gateway. Camera records use zuad_record. Streaming video display requires a browser/player.', {
      operation: { type: 'string', enum: ['start_webrtc', 'export', 'ptz'], required: true }, id: { type: 'string' }, command: { type: 'string' }, outputPath: { type: 'string' },
    }, true, async (a, signal) => special.monitor(a.operation, a, signal)),
    tool('zuad_payment', 'Generate the payment QR/order for an existing scoped order using its recorded price and configured payment gateway. This does not confirm payment completion.', { orderId: { type: 'string', required: true } }, true, async (a, signal) => special.payment(id(a.orderId), signal)),
  ];
  return { tools, client, async close() { client.close(); await renderer.close(); } };
}

/** Keep each invocation on one config snapshot, retiring old clients after their calls finish. */
export function createLiveTools(readConfig: () => Config) {
  const generations = new Set<ReturnType<typeof generation>>();
  function generation(config: Config) {
    return { key: JSON.stringify(config), plugin: createTools(config), active: 0 };
  }
  let current = generation(readConfig()), closed = false;
  generations.add(current);
  let writes: Promise<unknown> = Promise.resolve();
  const tools = current.plugin.tools.map((definition, index) => ({
    ...definition,
    async execute(args: Data, exec: Parameters<typeof definition.execute>[1]) {
      const run = async () => {
        exec.signal.throwIfAborted();
        if (closed) throw new Error('Plugin is closed');
        const config = readConfig();
        let retired: typeof current | undefined;
        if (JSON.stringify(config) !== current.key) {
          const previous = current;
          current = generation(config);
          generations.add(current);
          if (!previous.active) { generations.delete(previous); retired = previous; }
        }
        const selected = current;
        selected.active++;
        try {
          await retired?.plugin.close();
          return await selected.plugin.tools[index]!.execute(args, exec);
        }
        finally {
          selected.active--;
          if (selected !== current && !selected.active && generations.delete(selected)) await selected.plugin.close();
        }
      };
      if (['zuad_catalog', 'zuad_session', 'zuad_query'].includes(definition.name)) return run();
      const result = writes.then(run, run);
      writes = result.catch(() => {});
      return result;
    },
  }));
  return { tools, async close() { closed = true; await Promise.all([...generations].map(item => item.plugin.close())); generations.clear(); } };
}

export function apply(ctx: Context, config: PluginConfig) {
  const plugin = createLiveTools(() => readPluginConfig(config));
  for (const tool of plugin.tools) ctx.tools.register(tool);
  ctx.effect(() => () => plugin.close());
}
