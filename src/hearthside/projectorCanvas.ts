import {memoryCaptionRows} from './winMemoryCaptions.ts';
import type { MemoryComposition } from './contracts.ts';
import { amountForMemory, assetNotice, authorLabel } from './projectorComposition.ts';
import type { PreparedProjector, ProjectorAsset } from './projectorTypes.ts';
export type ProjectorPage = { memory: MemoryComposition; asset?: ProjectorAsset; columns: { memberId: string|null; label: string; lines: string[] }[]; page: number; pages: number };
export const PROJECTOR_WIDTH = 1280, PROJECTOR_HEIGHT = 720;
const palettes = {
  classic: { paper: '#f5e8d0', ink: '#332d24', border: '#a88a57', light: '#fff6df', soft: '#e7d8bb' },
  taylor: { paper: '#f6e5df', ink: '#533345', border: '#ab728e', light: '#fff4ec', soft: '#e6cfd7' },
  newfoundland: { paper: '#e9e6d2', ink: '#294847', border: '#5e837b', light: '#f8f2dc', soft: '#d3ded2' },
};
/** Wrapping preserves the exact characters; only visual line boundaries are introduced. */
export function wrapProjectorText(text: string, width: number, measure: (text: string) => number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const char of Array.from(paragraph)) { if (line && measure(line + char) > width) { const boundary = line.lastIndexOf(' '); const at = boundary > 0 ? boundary + 1 : line.length; result.push(line.slice(0, at)); line = line.slice(at); } line += char; }
    result.push(line);
  }
  return result;
}
export function buildProjectorPages(prepared: PreparedProjector, measure: (text: string) => number): ProjectorPage[] {
  return prepared.selection.memories.flatMap(memory => {
    const captionPages: ProjectorPage['columns'][] = [];
    const captions=memoryCaptionRows(memory,id=>authorLabel(prepared.selection,id));
    for (let author = 0; author < captions.length; author += 2) {
      const pair = captions.slice(author, author + 2).map(row => ({ memberId: row.memberId, label: row.label, lines: wrapProjectorText(row.text, 548, measure) }));
      const count = Math.max(1, ...pair.map(row => Math.ceil(row.lines.length / 6)));
      for (let page = 0; page < count; page++) captionPages.push(pair.map(row => ({ ...row, lines: row.lines.slice(page * 6, (page + 1) * 6) })));
    }
    if (!captionPages.length) captionPages.push([]);
    const assets = prepared.assets.filter(asset => asset.memoryId === memory.id && asset.memoryRevision === memory.revision), pictures = assets.filter(asset => asset.kind !== 'audio'), audio = assets.filter(asset => asset.kind === 'audio');
    const count = Math.max(captionPages.length, pictures.length, 1), pages: ProjectorPage[] = [];
    for (let page = 0; page < count; page++) pages.push({ memory, asset: pictures[Math.min(page, pictures.length - 1)], columns: captionPages[Math.min(page, captionPages.length - 1)]!, page: page + 1, pages: count + audio.length });
    for (const asset of audio) pages.push({ memory, asset, columns: captionPages[0]!, page: pages.length + 1, pages: count + audio.length });
    return pages;
  });
}
function fillLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, height: number) { for (const [index, line] of lines.entries()) ctx.fillText(line, x, y + index * height); }
export async function paintProjectorPage(canvas: HTMLCanvasElement, page: ProjectorPage, prepared: PreparedProjector): Promise<void> {
  canvas.width = PROJECTOR_WIDTH; canvas.height = PROJECTOR_HEIGHT;
  const ctx = canvas.getContext('2d'); if (!ctx) throw Error('PROJECTOR_CANVAS_UNAVAILABLE');
  const palette = palettes[prepared.selection.options.theme], { memory, asset } = page;
  ctx.fillStyle = palette.paper; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.border; ctx.fillRect(0, 0, 13, canvas.height); ctx.fillRect(1267, 0, 13, canvas.height);
  for (let y = 22; y < 710; y += 38) { ctx.fillStyle = palette.paper; ctx.fillRect(3, y, 7, 17); ctx.fillRect(1270, y, 7, 17); }
  ctx.fillStyle = palette.ink; ctx.textBaseline = 'top'; ctx.font = 'bold 12px system-ui'; ctx.fillText('HEARTH · OUR THEATRE', 55, 25); ctx.textAlign = 'right'; ctx.fillText(`KEPT REVISION ${memory.revision} · ${page.page}/${page.pages}`, 1224, 25); ctx.textAlign = 'left';
  let titleSize = 38, titleLines: string[] = [];
  do { ctx.font = `${titleSize}px Georgia`; titleLines = wrapProjectorText(memory.title, 1164, text => ctx.measureText(text).width); if (titleLines.length <= 2 || titleSize <= 18) break; titleSize -= 2; } while (true);
  fillLines(ctx, titleLines, 55, 56, titleSize * 1.15); ctx.font = '14px system-ui'; ctx.fillText(memory.date ?? '', 56, 141);
  const x = 56, y = 174, w = 1168, h = 274; ctx.fillStyle = palette.soft; ctx.fillRect(x, y, w, h);
  if (asset?.status === 'available' && asset.blob && asset.kind !== 'audio') {
    const bitmap = await createImageBitmap(asset.blob);
    try { const scale = Math.min(w / bitmap.width, h / bitmap.height); ctx.drawImage(bitmap, x + (w - bitmap.width * scale) / 2, y + (h - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale); } finally { bitmap.close(); }
  } else {
    ctx.fillStyle = palette.ink; ctx.textAlign = 'center'; ctx.font = 'italic 24px Georgia';
    const label = !asset ? 'The moment, in our own words.' : asset.status !== 'available' ? assetNotice(asset) : 'A voice we chose to keep.';
    ctx.fillText(label, 640, 278); ctx.font = '14px system-ui';
    if (asset?.kind === 'audio' && asset.status === 'available') ctx.fillText('VOICE NOTE', 640, 320);
    ctx.textAlign = 'left';
  }
  if (asset?.kind === 'design') { ctx.fillStyle = palette.ink; ctx.font = '12px system-ui'; ctx.fillText(`Our saved piece · revision ${asset.reference.revision}`, 58, 453); }
  page.columns.forEach((column, index) => {
    const left = index ? 673 : 56; ctx.fillStyle = palette.border; ctx.fillRect(left, 487, 42, 2); ctx.fillStyle = palette.ink; ctx.font = 'bold 13px system-ui'; ctx.fillText(column.label, left, 470); ctx.font = '22px Georgia'; fillLines(ctx, column.lines, left, 501, 25);
  });
  const amount = amountForMemory(prepared.selection, memory);
  ctx.fillStyle = palette.ink; ctx.font = '12px system-ui'; ctx.textAlign = 'right';
  if (amount) ctx.fillText(`${new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount.amountCents / 100)} · snapshot ${amount.asOf}`, 1224, 687);
  else ctx.fillText('The things we chose to keep.', 1224, 687); ctx.textAlign = 'left';
}
