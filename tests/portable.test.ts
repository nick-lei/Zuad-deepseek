import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { compileLayout } from '../src/compiler.js';
import { tableRaster } from '../src/raster.js';
import { localFile, MediaFiles } from '../src/files.js';
import { MediaClient } from '../src/client.js';
import { resolveConfig, editableConfigKeys } from '../src/config.js';

test('table raster respects merged cells and unequal column widths', async () => {
  const png = await tableRaster({ fontsize: 24, htmlText: '<table><tr><td rowspan="2" style="width:25%;background:red"></td><td colspan="2" style="background:blue"></td></tr><tr><td style="width:25%;background:green"></td><td style="width:50%;background:yellow"></td></tr></table>' }, 400, 200);
  const canvas = createCanvas(400, 200), ctx = canvas.getContext('2d');
  ctx.drawImage(await loadImage(Buffer.from(png)), 0, 0);
  const pixel = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
  assert.deepEqual(pixel(50, 150), [255, 0, 0, 255]);
  assert.deepEqual(pixel(150, 150), [0, 128, 0, 255]);
  assert.deepEqual(pixel(300, 150), [255, 255, 0, 255]);
  assert.deepEqual(pixel(300, 50), [0, 0, 255, 255]);
  await assert.rejects(tableRaster({ htmlText: '<table><tr><td colspan="21"></td></tr></table>' }, 400, 200), /20 columns/);
});

test('saving a table synchronizes its patched typography with editable HTML', async () => {
  const compiled = await compileLayout(undefined, [{ components: [{ type: 'table', fontsize: 60, fontweight: 'bold', clase: '#ff0000', backgroundColor: '#ffffff',
    htmlText: '<table style="font-size:18px;line-height:18px"><tr><td>更新后的中文</td></tr></table>' }] }], 800, 450, 'https://example.com', true);
  const table = JSON.parse(compiled.content)['slide-container-1']['0'].itemData;
  assert.match(table.htmlText, /font-size: 30px/);
  assert.match(table.htmlText, /line-height: 30px/);
  assert.match(table.htmlText, /font-weight: bold/);
  assert.match(table.htmlText, /color: rgb\(255, 0, 0\)/);
  assert.ok(GlobalFonts.has('Zuad Sans'), 'CJK font must be included in the plugin');
  const raster = await loadImage(Buffer.from(await tableRaster(table, 800, 450)));
  assert.equal(raster.width, 800); assert.equal(raster.height, 450);
});

test('working files are created automatically and retain containment and no-overwrite rules', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zuad-portable-'));
  const root = join(directory, 'not-created', 'files');
  const client = new MediaClient(resolveConfig({ fileRoot: root }));
  const files = new MediaFiles(client);
  try {
    const saved = await files.savePreview('preview.png', new Uint8Array([1, 2, 3]));
    assert.equal(saved, join(await realpath(root), 'preview.png'));
    assert.deepEqual([...await readFile(join(root, 'preview.png'))], [1, 2, 3]);
    await assert.rejects(files.savePreview('preview.png', new Uint8Array([4])), /EEXIST/);
    await assert.rejects(localFile(root, '../escape.png', true), /within fileRoot/);
    assert.match(resolveConfig().fileRoot.replaceAll('\\', '/'), /\/\.dsh\/data\/zuad-media\/files$/);
    for (const key of ['fileRoot', 'editorRoot', 'browserExecutable', 'ptzBaseUrl', 'paymentGateway']) assert.ok(!(editableConfigKeys as readonly string[]).includes(key));
  } finally { client.close(); await rm(directory, { recursive: true, force: true }); }
});
