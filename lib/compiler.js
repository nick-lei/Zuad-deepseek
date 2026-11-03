import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import jquery from 'jquery';
import { createPlayback } from '../assets/playback.mjs';
import { layoutControls } from './layout-controls.generated.js';
export const timelineColors = ['#37658f', '#32735b', '#8a4f70', '#8a5c24', '#6355a0', '#287983', '#994e3e', '#56652b', '#61586e'];
const mediaTypes = ['image', 'grid', 'webMixed', 'video', 'audio', 'pdf', 'word', 'ppt'];
const locale = JSON.parse(await readFile(new URL('../assets/locale.json', import.meta.url), 'utf8'));
/** The packaged data and markup factories run in an inert DOM, without editor startup or script execution. */
export async function compileLayout(content, slides, width, height, backend, normalizeTables = false) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: backend || 'https://signage.invalid' });
    // jQuery's Node entry accepts a Window, while its declarations describe the browser export.
    const factory = jquery;
    const $ = factory(dom.window);
    const runtime = createPlayback({ $, window: dom.window, langCode: locale, serverAddress: backend, width, height,
        background: content?.bg, fullwidth: content?.fw, flexslider: content?.fs });
    const prepare = (data) => {
        if (Array.isArray(data.queueList))
            for (const [index, entry] of data.queueList.entries()) {
                if (typeof entry.color !== 'string' || !entry.color.trim())
                    entry.color = timelineColors[index % timelineColors.length];
            }
        if (mediaTypes.includes(data.type)) {
            if (!Array.isArray(data.queueList))
                throw new Error('Media queueList must be an array');
            const list = dom.window.document.createElement('ul');
            data.pagesize = 0;
            for (const entry of data.queueList) {
                if (entry.fileType === 'IMAGE') {
                    entry.filePreview ||= entry.recordStart;
                    data.src = entry.recordStart;
                }
                const preview = runtime.getPreviewImageFun2(entry, data).previewImage;
                let name = String(entry.sourceName ?? '');
                try {
                    name = decodeURIComponent(name);
                }
                catch { /* Legacy names are not always URI encoded. */ }
                const li = dom.window.document.createElement('li');
                li.style.padding = '5px';
                li.setAttribute('data-ppt', String(entry.recordStart ?? ''));
                li.setAttribute('data-base', String(entry.fileMd5 ?? ''));
                const image = dom.window.document.createElement('img');
                image.setAttribute('data-name', name);
                image.style.height = '50px';
                image.style.width = '100px';
                image.setAttribute('src', /^(?:lib\/|data:)/.test(preview ?? '') ? preview : new URL(preview || '', (backend || 'https://signage.invalid') + '/').href);
                const remove = dom.window.document.createElement('span');
                remove.className = 'btn deletePpt';
                remove.style.marginLeft = '5px';
                remove.textContent = 'Delete';
                const caption = dom.window.document.createElement('p');
                caption.textContent = name;
                li.append(image, remove, caption);
                list.append(li);
                data.pagesize += entry.fileType === 'IMAGE' ? 1 : ['PDF', 'PPT', 'WORD'].includes(entry.fileType) ? Number(entry.pageSize) || 0 : 0;
            }
            data.uploadingMoreThanOnePictureFile = list.innerHTML;
        }
        if (data.type === 'table') {
            if (data.cells !== undefined) {
                const cells = data.cells;
                if (!Array.isArray(cells) || !cells.length || cells.length > 50 || !Array.isArray(cells[0]) || !cells[0].length || cells[0].length > 20 || cells.some(row => !Array.isArray(row) || row.length !== cells[0].length || row.some(cell => typeof cell !== 'string')))
                    throw new Error('table.cells must be a rectangular string array with at most 50 rows and 20 columns');
                data.horizontal = cells.length;
                data.vertical = cells[0].length;
                const table = dom.window.document.createElement('table');
                table.setAttribute('border', '1');
                table.className = 'table-code';
                table.style.cssText = `width:100%;height:100%;border-collapse:collapse;font-size:${Number.parseFloat(data.fontsize) / 2}px;line-height:${Number.parseFloat(data.fontsize) / 2}px;font-family:Microsoft YaHei`;
                const tbody = table.createTBody();
                for (const row of cells) {
                    const tr = tbody.insertRow();
                    for (const text of row) {
                        const td = tr.insertCell();
                        td.className = 'table-td-baox';
                        td.setAttribute('data-oid', randomUUID());
                        td.style.textAlign = 'center';
                        for (const [index, line] of text.split('\n').entries()) {
                            if (index)
                                td.append(dom.window.document.createElement('br'));
                            td.append(line);
                        }
                    }
                }
                data.htmlText = table.outerHTML;
                delete data.cells;
            }
            if (normalizeTables && data.htmlText) {
                const fragment = dom.window.document.createElement('template');
                fragment.innerHTML = data.htmlText;
                const table = fragment.content.querySelector('table');
                if (!table)
                    throw new Error('table.htmlText must contain a table');
                Object.assign(table.style, { fontSize: `${Number.parseFloat(data.fontsize) / 2}px`, lineHeight: `${Number.parseFloat(data.fontsize) / 2}px`,
                    fontFamily: data.fontfamily, fontWeight: data.fontweight, color: data.clase, background: data.backgroundColor });
                data.htmlText = table.outerHTML;
            }
        }
        return data;
    };
    try {
        const keys = content ? Object.keys(content).filter(key => /^slide-container-\d+$/.test(key)).sort((a, b) => Number(a.split('-').at(-1)) - Number(b.split('-').at(-1))) : (slides ?? []).map((_, index) => `slide-container-${index + 1}`);
        if (!keys.length)
            throw new Error('content has no slides');
        for (const [index, key] of keys.entries()) {
            const original = content?.[key];
            const slide = original?.slide ?? { ...runtime.newSlide(), deadtime: slides?.[index]?.duration ?? 10 };
            runtime.addSlide(slide, index + 1);
            const components = original ? Object.keys(original).filter(key => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b)).map(key => original[key].itemData) : slides[index].components;
            for (const component of components) {
                if (!component || typeof component.type !== 'string' || !Object.hasOwn(runtime.ItemCreate, component.type) || component.type === 'init')
                    throw new Error(`Unknown component type: ${component?.type}`);
                const data = prepare(Object.assign(runtime.newItem(component.type), component));
                const element = await runtime.ItemCreate[data.type](data);
                if (data.type === 'table' && !data.htmlText) {
                    const table = element.children('table')[0];
                    table.style.fontSize = `${Number.parseFloat(data.fontsize) / 2}px`;
                    table.style.lineHeight = `${Number.parseFloat(data.fontsize) / 2}px`;
                    data.htmlText = table.outerHTML;
                }
            }
        }
        const state = runtime.getData();
        state['globally-locked'] = content?.['globally-locked'] ?? 0;
        return { content: JSON.stringify(state), generateHtml: runtime.generateMarkup(true), generateScript: runtime.generateJS(), pageWidth: width, pageHeight: height,
            componentTypes: layoutControls.controls.map(control => control.type), compiler: 'node' };
    }
    finally {
        dom.window.close();
    }
}
//# sourceMappingURL=compiler.js.map