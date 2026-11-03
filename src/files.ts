import { openAsBlob } from 'node:fs';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { MediaClient, type Data } from './client.js';
import { object, id } from './catalog.js';
import { requireWrite } from './service.js';

const imageMimeTypes: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
};

export async function localFile(root: string, path: string, output = false): Promise<string> {
  if (!root) throw new Error('Configure fileRoot / ZUAD_FILE_ROOT for local file access');
  await mkdir(root, { recursive: true });
  const base = await realpath(root);
  const candidate = resolve(base, path);
  const checked = output ? resolve(await realpath(resolve(candidate, '..')), basename(candidate)) : await realpath(candidate);
  const rel = relative(base, checked);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('File path must stay within fileRoot');
  return checked;
}

export class MediaFiles {
  constructor(private readonly client: MediaClient) {}
  private async file(path: string) {
    const filename = await localFile(this.client.config.fileRoot, path);
    const info = await stat(filename);
    if (!info.isFile() || info.size < 1) throw new Error('File is empty or not a regular file');
    return filename;
  }
  async execute(operation: string, input: Data, signal?: AbortSignal): Promise<any> {
    const user = await (['register_material', 'upload_material', 'upload_chunks', 'import_monitors'].includes(operation) ? this.client.actor(signal) : this.client.login(signal));
    if (operation === 'register_material') {
      if (input.folderId && String(input.folderId) !== '0') await this.client.get('folders', input.folderId, signal);
      return this.register({ resultData: [object(input.metadata, 'metadata')] }, input, String(input.metadata.sourceName ?? ''), signal);
    }
    if (operation === 'export_program' || operation === 'export_template') {
      await this.client.get(operation === 'export_program' ? 'programs' : 'templates', input.id, signal);
      const form = new FormData(); form.set('id', id(input.id)); form.set('org_num', user.orgNum);
      const value = await this.client.request(`/api.php/${operation === 'export_program' ? 'exportProgram' : 'exportTemplate'}`, 'POST', form, { database: 'media' }, signal);
      const path = object(value).resultData;
      if (typeof path !== 'string') throw new Error('Export did not return resultData path');
      const url = new URL(path.replace(/^\/+/, ''), `${this.client.config.baseUrl}/`);
      if (url.origin !== this.client.config.baseUrl) throw new Error('Unexpected export origin');
      return { ...value, downloadUrl: url.href };
    }
    if (operation === 'upload_html') {
      if (typeof input.htmlSource !== 'string' || !input.htmlSource.trim()) throw new Error('htmlSource is required');
      const form = new FormData(); form.set('htmlSource', input.htmlSource);
      if (input.fileUrl) form.set('fileUrl', String(input.fileUrl));
      return this.client.request('/api.php/uploadHtmlSource', 'POST', form, {}, signal);
    }
    const allowed = ['upload_material', 'upload_chunks', 'upload_attachment', 'import_program', 'import_template', 'import_monitors'];
    if (!allowed.includes(operation)) throw new Error('Unknown file operation');
    if (typeof input.path !== 'string') throw new Error('path is required');
    const filename = await this.file(input.path);
    const name = basename(filename);
    const mime = typeof input.mimeType === 'string' ? input.mimeType : imageMimeTypes[extname(name).toLowerCase()] ?? 'application/octet-stream';
    if (operation.startsWith('import_') && operation !== 'import_monitors' && extname(name).toLowerCase() !== '.zip') throw new Error('Program/template import requires a ZIP file');
    if (input.folderId && String(input.folderId) !== '0') await this.client.get('folders', input.folderId, signal);
    const blob = await openAsBlob(filename, { type: mime });
    let uploaded: any;
    if (operation === 'upload_chunks') {
      const chunkSize = 5 * 1024 ** 2, total = Math.ceil(blob.size / chunkSize);
      for (let index = 0; index < total; index++) {
        const form = new FormData();
        form.set('file_blob', blob.slice(index * chunkSize, (index + 1) * chunkSize, mime), name);
        form.set('file_info', JSON.stringify({ name, size: blob.size, type: mime, index, total }));
        uploaded = await this.client.request('/api.php/sliceUploadFile', 'POST', form, {}, signal);
      }
      if (Array.isArray(uploaded?.resultData) && uploaded.resultData.length) return { ...await this.register(uploaded, input, name, signal), chunks: total };
      return { result: uploaded, chunks: total, registered: false, note: 'Chunk endpoint returned no file metadata. Verify merge and use register_material with server-produced metadata.' };
    }
    const form = new FormData();
    const endpoint = operation === 'upload_material' ? '/api.php/uploadMaterialFile'
      : operation === 'upload_attachment' ? '/api.php/uploadValiCompFile'
      : operation === 'import_program' ? '/api.php/importProgram'
      : operation === 'import_template' ? '/api.php/importTemplate' : '/api/v5/monitor_model/importMonitor';
    const field = operation === 'upload_material' ? 'AllFile[]' : operation === 'import_monitors' ? 'importFile' : operation === 'upload_attachment' ? String(input.field ?? 'file') : 'file';
    if (!/^[\w\[\]]+$/.test(field)) throw new Error('Invalid multipart field');
    form.set(field, blob, name);
    if (operation === 'import_monitors') { form.set('orgNum', user.orgNum); form.set('uid', user.uid); }
    else if (operation.startsWith('import_')) form.set('org_num', user.orgNum);
    uploaded = await this.client.request(endpoint, 'POST', form, {}, signal);
    if (operation !== 'upload_material') return uploaded;
    return this.register(uploaded, input, name, signal);
  }
  private async register(uploaded: Data, input: Data, name: string, signal?: AbortSignal) {
    const user = await this.client.actor(signal);
    if (!Array.isArray(uploaded?.resultData) || !uploaded.resultData.length) throw new Error('Upload response is missing resultData; inspect upload before retrying');
    const results: Data[] = [];
    for (const value of uploaded.resultData) {
      const entry = object(value, 'upload result');
      try {
        if (!/^[a-f0-9]{32}$/i.test(String(entry.fileMd5)) || !Number.isFinite(Number(entry.fileSize)) || !entry.recordStart) throw new Error('Upload metadata is incomplete');
        const previous = (await this.client.query('materials', { filters: ['means_code,eq,1', `fileMd5,eq,${entry.fileMd5}`, `fileSize,eq,${entry.fileSize}`], limit: 1 }, signal)).records[0];
        const metadata: Data = {};
        for (const key of ['sourceName', 'encryptionName', 'recordStart', 'fileMd5', 'fileSize', 'fileSourceType', 'filePreview', 'page_size', 'duration']) if (entry[key] !== undefined) metadata[key] = entry[key];
        if (String(metadata.fileSourceType).startsWith('image/') && !metadata.filePreview) metadata.filePreview = metadata.recordStart;
        Object.assign(metadata, { uid: user.uid, last_time: Math.floor(Date.now() / 1000), grouping_id: input.folderId ?? 0,
          change: /\.(pdf|pptx?|docx?)$/i.test(name) ? 0 : 1 });
        const result = previous ? await this.client.update('materials', previous.id, metadata, signal)
          : await this.client.create('materials', { ...await this.client.meta(signal), ...metadata, means_code: 1 }, signal);
        requireWrite(result);
        results.push({ uploaded: true, registered: true, result, existingId: previous?.id ?? null, recordStart: entry.recordStart });
      } catch (error) {
        results.push({ uploaded: true, registered: false, metadata: entry, error: error instanceof Error ? error.message : String(error), note: 'Uploaded file remains on the server. Inspect before uploading again.' });
      }
    }
    return { results };
  }
  async savePreview(path: string, bytes: Uint8Array) {
    const filename = await localFile(this.client.config.fileRoot, path, true);
    await writeFile(filename, bytes, { flag: 'wx' });
    return filename;
  }
}
