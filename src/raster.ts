import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import QRCode from 'qrcode';
import { JSDOM } from 'jsdom';
import type { MediaClient, Data } from './client.js';

if (!GlobalFonts.registerFromPath(fileURLToPath(new URL('../assets/fonts/NotoSansCJKsc-Regular.otf', import.meta.url)), 'Zuad Sans')) throw new Error('Bundled CJK font could not be loaded');
const pixels = (value: unknown, base: number, fallback = 0) => {
  const text = String(value ?? '');
  const number = Number.parseFloat(text);
  return Number.isFinite(number) ? number * (text.endsWith('%') ? base / 100 : 1) : fallback;
};
const font = (data: Data, size = pixels(data.fontsize, 1, 50)) => `${data.fontweight || 'normal'} ${size}px "${String(data.fontfamily || 'Zuad Sans').replaceAll('"', '')}", "Zuad Sans", sans-serif`;

function text(ctx: SKRSContext2D, value: string, width: number, height: number, data: Data) {
  const size = pixels(data.fontsize, 1, 50), lineHeight = pixels(data.lineHeight, 1, size);
  ctx.font = font(data, size); ctx.fillStyle = data.clase || '#001827'; ctx.textBaseline = 'top';
  const lines: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const character of paragraph) {
      if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = ''; }
      line += character;
    }
    lines.push(line);
  }
  const totalHeight = lines.length * lineHeight;
  let y = data.verticalAlign === 'bottom' ? height - totalHeight : data.verticalAlign === 'middle' ? (height - totalHeight) / 2 : 0;
  for (const line of lines) {
    const measured = ctx.measureText(line).width;
    const x = data.alignment === 'right' ? width - measured : data.alignment === 'center' ? (width - measured) / 2 : 0;
    ctx.fillText(line, Math.max(0, x), y); y += lineHeight;
  }
}

/** Render the editable table's cells to the raster used by terminal playback. */
export async function tableRaster(data: Data, width: number, height: number): Promise<Uint8Array> {
  const dom = new JSDOM(data.htmlText || '<table><tr><td></td></tr></table>');
  const table = dom.window.document.querySelector('table');
  if (!table?.rows.length) { dom.window.close(); throw new Error('table.htmlText must contain a non-empty table'); }
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  try {
    const rows = [...table.rows];
    if (rows.length > 50) throw new Error('Table supports at most 50 rows and 20 columns');
    const occupied = new Set<string>();
    const placements: { cell: HTMLTableCellElement; row: HTMLTableRowElement; r: number; c: number; rs: number; cs: number }[] = [];
    let columns = 0;
    for (const [r, row] of rows.entries()) {
      let c = 0;
      for (const cell of row.cells) {
        while (occupied.has(`${r}:${c}`)) c++;
        const cs = cell.colSpan, rs = cell.rowSpan === 0 ? rows.length - r : Math.min(cell.rowSpan, rows.length - r);
        if (c + cs > 20) throw new Error('Table supports at most 50 rows and 20 columns');
        placements.push({ cell, row, r, c, rs, cs });
        for (let y = 0; y < rs; y++) for (let x = 0; x < cs; x++) {
          const key = `${r + y}:${c + x}`;
          if (occupied.has(key)) throw new Error('Overlapping table spans');
          occupied.add(key);
        }
        columns = Math.max(columns, c + cs); c += cs;
      }
    }
    if (!columns) throw new Error('table.htmlText must contain at least one cell');
    const colSizes = Array<number>(columns).fill(0), rowSizes = Array<number>(rows.length).fill(0);
    for (const [index, col] of [...table.querySelectorAll('col')].entries()) if (index < columns) colSizes[index] = pixels(col.style.width || col.getAttribute('width'), width);
    for (const { cell, row, r, c, cs, rs } of placements) {
      if (cs === 1 && !colSizes[c]) colSizes[c] = pixels(cell.style.width || cell.getAttribute('width'), width);
      if (rs === 1 && !rowSizes[r]) rowSizes[r] = pixels(row.style.height || cell.style.height || cell.getAttribute('height'), height);
    }
    const tracks = (sizes: number[], total: number) => {
      const used = sizes.reduce((sum, value) => sum + value, 0), missing = sizes.filter(value => !value).length;
      const result = sizes.map(value => value || (used < total ? (total - used) / Math.max(1, missing) : total / sizes.length));
      const sum = result.reduce((sum, value) => sum + value, 0);
      return result.map(value => value * total / sum);
    };
    const widths = tracks(colSizes, width), heights = tracks(rowSizes, height);
    const scale = pixels(data.fontsize, 1, 50) / pixels(table.style.fontSize, 1, pixels(data.fontsize, 1, 50));
    for (const { cell, row, r, c, rs, cs } of placements) {
        const sum = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
        const w = sum(widths.slice(c, c + cs)), h = sum(heights.slice(r, r + rs));
        const x = sum(widths.slice(0, c)), y = sum(heights.slice(0, r));
        const style = dom.window.getComputedStyle(cell);
        ctx.fillStyle = cell.style.backgroundColor || row.style.backgroundColor || table.style.backgroundColor || data.backgroundColor || '#AFAFAF';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = cell.style.borderColor || '#808080'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
        const body = cell.cloneNode(true) as HTMLTableCellElement;
        for (const br of body.querySelectorAll('br')) br.replaceWith('\n');
        const padding = pixels(style.padding, w, 1);
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x + padding, y + padding);
        text(ctx, body.textContent ?? '', Math.max(1, w - padding * 2), Math.max(1, h - padding * 2), {
          ...data, fontsize: cell.style.fontSize ? pixels(cell.style.fontSize, 1) * scale : data.fontsize,
          fontfamily: cell.style.fontFamily || data.fontfamily, fontweight: cell.style.fontWeight || data.fontweight,
          clase: cell.style.color || data.clase, alignment: cell.style.textAlign || row.style.textAlign || table.style.textAlign || 'center', verticalAlign: cell.style.verticalAlign || 'middle',
        });
        ctx.restore();
    }
    return new Uint8Array(await canvas.encode('png'));
  } finally { dom.window.close(); }
}

/** A static first-slide preview; executable web pages and dynamic PC controls are represented by their saved labels. */
export async function layoutRaster(state: Data, client: MediaClient, signal: AbortSignal): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const width = Number(state.ss.width), height = Number(state.ss.height);
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d'), warnings: string[] = [];
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
  async function image(path: string) {
    signal.throwIfAborted();
    if (path.startsWith('lib/builder/img/')) return loadImage(fileURLToPath(new URL(`../assets/images/${basename(path)}`, import.meta.url)));
    if (/^data:image\//.test(path)) return loadImage(path);
    const url = new URL(path, client.config.baseUrl);
    if (url.origin !== client.config.baseUrl || !/^\/(archive|uploads)\//.test(url.pathname)) throw new Error('Preview assets must be backend files');
    const bytes = await client.request(url.pathname + url.search, 'GET', undefined, {}, signal, true);
    return loadImage(Buffer.from(bytes));
  }
  const background = state.bg ?? {};
  const backgroundPath = String(background.src64 || background.src || '').trim();
  if (backgroundPath) {
    try { ctx.drawImage(await image(backgroundPath), 0, 0, width, height); }
    catch { warnings.push(backgroundPath); }
  }
  const slideKey = Object.keys(state).filter(key => /^slide-container-\d+$/.test(key)).sort((a, b) => Number(a.split('-').at(-1)) - Number(b.split('-').at(-1)))[0];
  const components: Data[] = Object.keys(state[slideKey!] ?? {}).filter(key => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b)).map(key => state[slideKey!][key].itemData);
  for (const data of components) {
    signal.throwIfAborted();
    const w = Math.max(1, pixels(data.width, width, 960)), h = Math.max(1, pixels(data.height, height, 540));
    ctx.save();
    try {
      ctx.translate(pixels(data.left, width), pixels(data.top, height));
      ctx.beginPath(); ctx.roundRect(0, 0, w, h, Math.max(0, Math.min(pixels(data.roundSize, w), w / 2, h / 2))); ctx.clip();
      ctx.globalAlpha = Number.isFinite(Number(data.opacity)) ? Math.max(0, Math.min(1, Number(data.opacity))) : 1;
      if (data.type === 'block') { ctx.fillStyle = data.backgroundColor; ctx.fillRect(0, 0, w, h); }
      else if (data.type === 'table') ctx.drawImage(await loadImage(Buffer.from(await tableRaster(data, Math.ceil(w), Math.ceil(h)))), 0, 0, w, h);
      else if (['text', 'marquee', 'printtext', 'clock'].includes(data.type)) {
        let value = String(data.content ?? '');
        if (data.type === 'clock') {
          const now = new Date();
          const values: Record<string, string> = { yyyy: String(now.getFullYear()), MM: String(now.getMonth() + 1).padStart(2, '0'), dd: String(now.getDate()).padStart(2, '0'), HH: String(now.getHours()).padStart(2, '0'), mm: String(now.getMinutes()).padStart(2, '0'), ss: String(now.getSeconds()).padStart(2, '0') };
          value = String(data.timeformat).replace(/yyyy|MM|dd|HH|mm|ss/g, token => values[token]!);
        }
        text(ctx, value, w, h, data);
      } else if (data.type === 'qrcode') {
        const buffer = await QRCode.toBuffer(String(data.qrcodecontent || data.content), { width: Math.max(16, Math.ceil(Math.min(w, h))), margin: 0, errorCorrectionLevel: 'M' });
        ctx.drawImage(await loadImage(buffer), 0, 0, w, h);
      } else if (['image', 'grid', 'webMixed', 'video', 'audio', 'pdf', 'word', 'ppt'].includes(data.type)) {
        const item = data.queueList?.[0];
        let path = item?.fileType === 'IMAGE' ? item.recordStart : item?.filePreview;
        if (item && ['PDF', 'PPT', 'WORD'].includes(item.fileType)) path = item.recordStart.replace(/\.[^.]+$/, '/0.jpg');
        if (data.type === 'audio') path = 'lib/builder/img/audio.jpg';
        if (path) {
          try { ctx.drawImage(await image(path), 0, 0, w, h); }
          catch { warnings.push(path); ctx.fillStyle = '#eeeeee'; ctx.fillRect(0, 0, w, h); text(ctx, '[Media]', w, h, { fontsize: 24, alignment: 'center', verticalAlign: 'middle' }); }
        }
      } else if (data.type === 'exitClient') {
        ctx.fillStyle = data.backgroundColor; ctx.fillRect(0, 0, w, h); text(ctx, '退出', w, h, { ...data, clase: '#ffffff', alignment: 'center', verticalAlign: 'middle' });
      } else {
        ctx.fillStyle = data.backgroundColor || '#f2f2f2'; ctx.fillRect(0, 0, w, h);
        text(ctx, String(data.webbrowserName || data.webbrowserhref || data.type), w, h, { ...data, fontsize: 24, alignment: 'center', verticalAlign: 'middle' });
      }
    } finally { ctx.restore(); }
  }
  signal.throwIfAborted();
  return { bytes: new Uint8Array(await canvas.encode('png')), warnings: [...new Set(warnings)] };
}
