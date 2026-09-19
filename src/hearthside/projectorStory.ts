import {memoryCaptionRows,memoryForStoryFile} from './winMemoryCaptions.ts';
import { amountForMemory, assetNotice, authorLabel, checkProjectorCurrent } from './projectorComposition.ts';
import type { PreparedProjector, ProjectorGuard, ProjectorFile } from './projectorTypes.ts';
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function projectorManifest(prepared: PreparedProjector) {
  const { selection, assets } = prepared;
  return {
    format: 'hearth-kept-story', version: 1, theme: selection.options.theme,
    secondsPerPage: selection.options.secondsPerPage,
    compositions: selection.memories.map(memoryForStoryFile),
    voices: Object.fromEntries(selection.memories.flatMap(memory => memory.recollections.map(row => [row.memberId, authorLabel(selection, row.memberId)]))),
    // Hidden or unrelated snapshot amounts never enter the downloadable payload.
    amountSnapshots: selection.memories.flatMap(memory => { const amount = amountForMemory(selection, memory); return amount ? [amount] : []; }),
    assets: assets.map(({ blob: _blob, ...asset }) => asset),
    rendering: 'Approved source words and revisions; still image views. No generated personal memorabilia.',
  };
}
async function dataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
export async function createProjectorStory(prepared: PreparedProjector, guard: ProjectorGuard): Promise<ProjectorFile> {
  const { selection, assets } = prepared, sections: string[] = [];
  for (const memory of selection.memories) {
    checkProjectorCurrent(guard); const pictures: string[] = [];
    for (const asset of assets.filter(asset => asset.memoryId === memory.id && asset.memoryRevision === memory.revision)) {
      if (asset.status !== 'available' || !asset.blob) { pictures.push(`<p class="missing">${assetNotice(asset)}</p>`); continue; }
      const url = await dataUrl(asset.blob); checkProjectorCurrent(guard);
      const caption = asset.kind === 'design' ? `Our piece, exactly at revision ${asset.reference.revision}` : 'alt' in asset.reference ? asset.reference.alt : '';
      pictures.push(`<figure>${asset.kind === 'audio' ? `<audio controls preload="none" src="${escape(url)}"></audio>` : `<img alt="${escape(caption)}" src="${escape(url)}">`}<figcaption>${escape(caption)}</figcaption></figure>`);
    }
    const amount = amountForMemory(selection, memory);
    sections.push(`<article><header><small>KEPT TOGETHER · REVISION ${memory.revision}</small><h2>${escape(memory.title)}</h2>${memory.date ? `<time>${escape(memory.date)}</time>` : ''}</header><div class="pictures">${pictures.join('')}</div><div class="voices">${memoryCaptionRows(memory,id=>authorLabel(selection,id)).map(row => `<section><h3>${escape(row.label)}</h3><p>${escape(row.text || 'No caption was added to this kept version.')}</p></section>`).join('')}</div>${amount ? `<aside>${escape(new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount.amountCents / 100))} · snapshot as of ${escape(amount.asOf)}<br>${escape(amount.provenance)}</aside>` : ''}</article>`);
  }
  const manifest = JSON.stringify(projectorManifest(prepared), null, 2);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'"><title>Our kept story</title><style>body{margin:0;background:#ece5d6;color:#332e26;font:18px/1.6 Georgia,serif}main{max-width:1000px;margin:auto;padding:clamp(20px,5vw,70px)}h1{font-weight:400;font-size:clamp(36px,7vw,66px)}h2{font-size:32px;font-weight:400}small{font:12px system-ui;letter-spacing:.12em}article{margin:45px 0;padding:clamp(20px,4vw,44px);background:#fff7e8;border-top:6px double #9d865e;box-shadow:0 8px 30px #49351915}header{border-bottom:1px solid #bfa983;padding-bottom:20px}.voices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:28px}.voices p{white-space:pre-wrap;overflow-wrap:anywhere}.voices h3{font:600 13px system-ui;letter-spacing:.08em}.pictures{display:flex;flex-wrap:wrap;gap:18px;margin:26px 0}.pictures figure{margin:0;flex:1;min-width:min(100%,280px)}img{max-width:100%;max-height:600px;object-fit:contain}audio{max-width:100%}figcaption,.missing,aside{font:14px/1.6 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 monospace}body[data-theme=taylor]{background:#e9d8d6;color:#543547}body[data-theme=taylor] article{background:#fff0e7;border-color:#b28699;box-shadow:7px 7px 0 #a777891c}body[data-theme=newfoundland]{background:#d9e1d8;color:#294748}body[data-theme=newfoundland] article{background:#f5f0dd;border-color:#718a7b}button,a{min-height:44px}@media print{article{break-inside:avoid;box-shadow:none}details{display:none}}</style></head><body data-theme="${escape(selection.options.theme)}"><main><small>HEARTH · OUR THEATRE</small><h1>Our kept story</h1><p>This readable story file contains the selected kept versions, in your chosen order. It is not a video.</p>${sections.join('')}<details><summary>Exact compositions and asset records</summary><pre>${escape(manifest)}</pre></details></main></body></html>`;
  checkProjectorCurrent(guard); const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return { blob, filename: 'our-kept-story.html', kind: 'story', mimeType: blob.type };
}
