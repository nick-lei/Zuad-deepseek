import { createHash, randomUUID } from 'node:crypto';
import { MediaClient, ApiError, type Data } from './client.js';
import { MediaFiles } from './files.js';
import { id, object } from './catalog.js';
import { requireWrite } from './service.js';
import { layoutControls } from './layout-controls.generated.js';
import { compileLayout, timelineColors } from './compiler.js';
import { layoutRaster, tableRaster } from './raster.js';

export interface LayoutInput {
  operation: 'describe' | 'compile' | 'save_program' | 'save_template';
  componentType?: string;
  name?: string;
  id?: string;
  sourceKind?: 'program' | 'template';
  sourceId?: string;
  content?: Data;
  width?: number;
  height?: number;
  slides?: { duration?: number; components: Data[] }[];
  patches?: { slide: number; index: number; changes: Data }[];
  previewPath?: string;
  folderId?: string;
}

export class LayoutRenderer {
  private readonly shutdown = new AbortController();
  constructor(private readonly client: MediaClient, private readonly files: MediaFiles) {}
  async close() { this.shutdown.abort(); }
  async execute(input: LayoutInput, signal?: AbortSignal): Promise<Data> {
    if (input.operation === 'describe') {
      const controls = layoutControls.controls.filter(control => !input.componentType || control.type === input.componentType);
      if (!controls.length) throw new Error(`Unknown component type: ${input.componentType}`);
      return { observedOn: layoutControls.observedOn, controls, commonFields: ['uuid', 'type', 'top', 'left', 'width', 'height', 'opacity', 'layoutLock', 'in', 'out'],
        notes: ['Coordinates and sizes use original canvas pixels; prefer px strings.', 'QR content uses content, not qrcodecontent.',
          'Media use queueList, with URI-encoded sourceName and uppercase fileType (IMAGE/VIDEO/AUDIO/PDF/WORD/PPT).',
          'Media thumbnail lists and page counts are rebuilt from queueList when compiling or saving; do not supply cached editor HTML.',
          'Missing queue entry colors are filled for readable editor timeline labels; existing colors, order and timing are preserved.',
          'table supports cells (a rectangular array of strings) or htmlText; horizontal is rows, vertical is columns. Saving regenerates and registers its image asset.',
          'Compilation is built into the plugin; no React source, editor directory or browser installation is needed.',
          'Thumbnails are static first-slide previews. Dynamic web/PC controls use labels; verify final playback on a compatible terminal.'] };
    }
    signal = AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(this.client.config.timeoutMs), ...(signal ? [signal] : [])]);
    signal.throwIfAborted();
    if (!['compile', 'save_program', 'save_template'].includes(input.operation)) throw new Error('Unknown layout operation');
    let source: Data | undefined;
    if (input.sourceId) {
      if (!input.sourceKind || !['program', 'template'].includes(input.sourceKind)) throw new Error('sourceKind is required');
      source = await this.client.get(input.sourceKind === 'program' ? 'programs' : 'templates', input.sourceId, signal, input.sourceKind === 'template');
    }
    if (input.content && input.slides) throw new Error('Provide content or slides, not both');
    if (source && (input.content || input.slides)) throw new Error('Use patches with a source, or provide a new content/slides layout');
    let content = input.content ?? (source?.content ? (typeof source.content === 'string' ? JSON.parse(source.content) : source.content) : undefined);
    if (content) {
      content = structuredClone(object(content, 'content'));
      for (const patch of input.patches ?? []) {
        const component = content[`slide-container-${patch.slide}`]?.[String(patch.index)];
        if (!component?.itemData) throw new Error(`Patch component not found: slide ${patch.slide}, index ${patch.index}`);
        Object.assign(component.itemData, object(patch.changes));
      }
    } else if (input.patches?.length) throw new Error('Patches require a source or content');
    if (!content && !input.slides?.length) throw new Error('Provide sourceId, content, or slides');
    const size = content?.ss ?? {};
    const width = Number(input.width ?? size.width ?? 1920), height = Number(input.height ?? size.height ?? 1080);
    if (![width, height].every(v => Number.isInteger(v) && v >= 16 && v <= 8192)) throw new Error('Layout dimensions must be integers between 16 and 8192');
    if (input.operation !== 'compile') {
      if (!input.name?.trim()) throw new Error('name is required when saving');
      await this.client.actor(signal);
      if (input.id) await this.client.get(input.operation === 'save_program' ? 'programs' : 'templates', id(input.id), signal);
      if (input.operation === 'save_template' && input.folderId && input.folderId !== '0') await this.client.get('folders', input.folderId, signal);
    }
    let compiled = await compileLayout(content, input.slides ? structuredClone(input.slides) : undefined, width, height, this.client.config.baseUrl, input.operation !== 'compile');
    let state = JSON.parse(compiled.content);
    const tableImages: string[] = [];
    if (input.operation !== 'compile') {
      // Tables play their uploaded raster. Regenerate and register it before saving the layout.
      for (const [key, slide] of Object.entries(state)) {
        if (!/^slide-container-\d+$/.test(key)) continue;
        for (const component of Object.values(object(slide))) {
          const data = component?.itemData;
          if (data?.type !== 'table') continue;
          signal.throwIfAborted();
          const dimension = (value: unknown, base: number) => Math.max(1, Math.ceil(Number.parseFloat(String(value)) * (String(value).endsWith('%') ? base / 100 : 1)));
          const w = dimension(data.width, width), h = dimension(data.height, height);
          if (![w, h].every(v => Number.isFinite(v) && v <= 8192)) throw new Error('Table dimensions must be between 1 and 8192');
          const png = await tableRaster(data, w, h);
          signal.throwIfAborted();
          const form = new FormData(); form.set('AllFile[]', new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' }), 'table.png');
          const uploaded = await this.client.request('/api.php/uploadMaterialFile', 'POST', form, {}, signal);
          const info = uploaded?.resultData?.[0];
          if (!info?.recordStart) throw new ApiError('Table image upload returned no recordStart; inspect uploaded files before retrying', true);
          tableImages.push(info.recordStart);
          const registration = await this.files.execute('register_material', { metadata: info }, signal);
          if (registration.results?.[0]?.registered !== true) throw new ApiError('Table image uploaded but material registration failed; inspect uploaded files before retrying', true);
          data.queueList = [{ fileUuid: randomUUID(), sourceName: encodeURIComponent(info.sourceName ?? 'table.png'), fileType: 'IMAGE', recordStart: info.recordStart, filePreview: info.filePreview || info.recordStart,
            duration: 5, pageSize: 1, fileMd5: info.fileMd5 ?? createHash('md5').update(png).digest('hex'), fileSize: Number(info.fileSize ?? png.length), durationSum: 5, color: timelineColors[0], videoMute: 0 }];
        }
      }
      if (tableImages.length) {
        compiled = await compileLayout(state, undefined, width, height, this.client.config.baseUrl, true);
        state = JSON.parse(compiled.content);
      }
    }
    let thumbnail: Uint8Array | undefined;
    compiled.previewWarnings = [];
    compiled.previewKind = 'static-first-slide';
    if (input.previewPath || input.operation !== 'compile') {
      const preview = await layoutRaster(state, this.client, signal);
      thumbnail = preview.bytes; compiled.previewWarnings = preview.warnings;
      if (input.previewPath) compiled.previewPath = await this.files.savePreview(input.previewPath, thumbnail);
    }
    signal.throwIfAborted();
    const assets: Data[] = [];
    for (const [key, slide] of Object.entries(state)) {
      if (!/^slide-container-\d+$/.test(key)) continue;
      for (const component of Object.values(object(slide))) if (component?.itemData?.queueList) assets.push(...component.itemData.queueList);
    }
    compiled.file_list = JSON.stringify(assets);
    compiled.size = assets.reduce((sum, entry) => sum + (Number(entry.fileSize) || 0), 0);
    if (input.operation === 'compile') return { ...compiled, saved: false, notes: ['Thumbnails are static first-slide previews. Saving regenerates and registers table raster assets.'] };
    const name = input.operation === 'save_program' ? 'programs' : 'templates';
    const body: Data = { ...compiled };
    for (const field of ['previewPath', 'componentTypes', 'previewWarnings', 'compiler', 'previewKind']) delete body[field];
    if (name === 'programs') { body.layout = input.name; body.template_id = input.sourceKind === 'template' ? input.sourceId : source?.template_id ?? 0; }
    else { body.template_name = input.name; body.template_size = body.size; delete body.size; body.status = 1; body.grouping_id = input.folderId ?? 0; }
    const meta = await this.client.meta(signal);
    if (input.id) { delete meta.oid; delete meta.create_time; }
    Object.assign(body, meta);
    if (!thumbnail) throw new Error('Layout thumbnail was not rendered');
    const form = new FormData(); form.set('AllFile[]', new Blob([thumbnail as Uint8Array<ArrayBuffer>], { type: 'image/png' }), 'layout-preview.png');
    const upload = await this.client.request('/api.php/uploadMaterialFile', 'POST', form, {}, signal);
    const imagePath = upload?.resultData?.[0]?.recordStart;
    if (typeof imagePath !== 'string' || !imagePath) throw new ApiError('Thumbnail upload returned no recordStart; inspect uploaded files before retrying', true);
    body.file_img = imagePath;
    try {
      const result = input.id ? await this.client.update(name, input.id, body, signal) : await this.client.create(name, body, signal);
      requireWrite(result);
      return { saved: true, result, file_img: imagePath, tableImages, previewPath: compiled.previewPath ?? null, previewWarnings: compiled.previewWarnings,
        pageWidth: width, pageHeight: height, compiler: 'node', previewKind: compiled.previewKind,
        warning: 'Static first-slide thumbnail; dynamic web and PC controls use labels. Verify playback on a compatible terminal before a wider rollout.' };
    } catch (error) {
      return { saved: error instanceof ApiError && error.uncertain ? null : false, thumbnailUploaded: true, file_img: imagePath,
        error: error instanceof Error ? error.message : String(error), uncertain: error instanceof ApiError && error.uncertain };
    }
  }
}
