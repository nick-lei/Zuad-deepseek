import { readFile, writeFile } from 'node:fs/promises';
import { resources } from '../lib/catalog.js';

const inventory = JSON.parse(await readFile(new URL('../docs/media-api-inventory.json', import.meta.url), 'utf8'));
const special = {
  doLogin: 'zuad_session (API-key check by default; password login only in session mode)', uploadFile: 'zuad_file/upload_material', uploadMaterialFile: 'legacy v5 upload; zuad_file uses /apikey.php/uploadMaterialFile by default',
  sliceUploadFile: 'zuad_file/upload_chunks', exportProgram: 'zuad_file/export_program', exportTemplate: 'zuad_file/export_template',
  uploadHtmlSource: 'zuad_file/upload_html', addPlan: 'zuad_plan/create', editPlan: 'zuad_plan/update', delPlan: 'zuad_plan/delete', startUpPlan: 'zuad_plan/start',
  ImportMonitor: 'zuad_file/import_monitors', exportMonitor: 'zuad_monitor/export', startUpWebRtc: 'zuad_monitor/start_webrtc', monitorPtzControl: 'zuad_monitor/ptz',
  getProxyPayment: 'zuad_payment',
};
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const rows = inventory.endpoints.map(endpoint => {
  const request = endpoint.requests[0];
  const table = /records\/(think_\w+)/.exec(request.url)?.[1];
  const foreign = /database=(meeting_dingding|central_control|monitoring_analysis)/.test(request.url);
  const db = /database=(\w+)/.exec(request.url)?.[1];
  let mapping = special[endpoint.name];
  if (!mapping && table && !foreign) {
    const entries = Object.entries(resources).filter(([, spec]) => spec.table === table && (!db || spec.database === db));
    if (entries.length) {
      const write = /add|edit|del/.test(endpoint.name.slice(0, 4));
      mapping = entries.map(([key]) => key === 'plans' && write ? 'zuad_plan' : ['programs', 'templates'].includes(key) && /add|edit/.test(endpoint.name) ? `zuad_layout (${key})`
        : key === 'tasks' && /add/.test(endpoint.name) ? 'zuad_publish / zuad_device_command'
        : ['schedules', 'insertions'].includes(key) && /add|edit/.test(endpoint.name) ? 'zuad_schedule'
        : `zuad_${write ? 'record' : 'query'} (${key})`).join(', ');
      if (request.url.includes('/apikey.php/')) mapping += ' [API-key source variant; API-key authentication is the plugin default]';
      if (!db) mapping += ' [source omits database; deployment verification required]';
    }
  }
  if (foreign) mapping = 'Outside media data domain: separate system/database';
  if (!mapping) mapping = 'Not exposed: legacy/cross-system/account-verification helper; inspect source before adding';
  return `| ${escape(endpoint.module + ':' + endpoint.name)} | ${escape(request.method)} | ${escape(request.url)} | ${escape(mapping)} |`;
});
const lines = ['# Source Function Coverage', '', 'Generated from the static frontend inventory and the implemented resource catalog. Source URLs below retain the original frontend expressions. By default the plugin rewrites /api.php to /apikey.php and sends x-api-key, preserving method, query and body. Other routes retain their paths. This maps adapters, not proof that every deployed endpoint supports key authentication.', '',
  `Resources: ${Object.keys(resources).length}. Source HTTP functions: ${inventory.endpoints.length}. Harness tools: 13.`, '',
  '| Source Function | Method | Source URL Expression | Plugin Mapping / Boundary |', '| --- | --- | --- | --- |', ...rows, '',
  'Dedicated importProgram/importTemplate/uploadValiCompFile calls also exist directly in pages rather than exported API functions. They are implemented by zuad_file. Program thumbnails use /apikey.php/uploadMaterialFile in default API-key mode.', '',
  'All resource fields and exact required payloads remain subject to the deployed backend schema. See README.md for authentication, organization scope, testing and known legacy limitations.', ''];
await writeFile(new URL('../docs/plugin-coverage.md', import.meta.url), lines.join('\n'));
console.log(`Mapped ${rows.length} source functions across ${Object.keys(resources).length} resources.`);
