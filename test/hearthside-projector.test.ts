import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MemoryComposition } from '../src/hearthside/contracts.ts';
import { amountForMemory, awaitProjector, captureProjectorSelection, keptCompositions, memoryKey, prepareProjector, projectorDownloadProof, validateProjectorDownload } from '../src/hearthside/projectorComposition.ts';
import { buildProjectorPages, wrapProjectorText } from '../src/hearthside/projectorCanvas.ts';
import { PROJECTOR_MAX_ENCODED_BYTES, projectorWait, recordProjectorFilm, supportedProjectorMime } from '../src/hearthside/projectorFilm.ts';
import { createProjectorStory, projectorManifest } from '../src/hearthside/projectorStory.ts';
import { TheatreProjector } from '../src/hearthside/TheatreProjector.tsx';
import type { ProjectorLoaders } from '../src/hearthside/projectorTypes.ts';
const memory = (id = 'memory-1'): MemoryComposition => ({ version: 1, id, revision: 3, title: 'An ordinary afternoon', date: '2026-09-12', experienceId: null, media: [], designs: [], recollections: [{ memberId: 'a', text: 'My own exact words.\nA second line.' }, { memberId: 'b', text: 'Your separate words.' }], hideAmounts: true, approvals: [{ memberId: 'a', revision: 3 }, { memberId: 'b', revision: 3 }], withdrawn: false });
const members = ['a', 'b'], options = { theme: 'classic' as const, secondsPerPage: 1, showAmounts: false };
const guard = () => ({ signal: new AbortController().signal, isCurrent: () => true });
const loaders: ProjectorLoaders = { resolveMedia: async () => ({ status: 'unavailable' }), loadDesignSnapshot: async () => ({ status: 'unavailable' }) };
const select = (rows = [memory()], extra = {}) => captureProjectorSelection(rows, members, rows.map(memoryKey), { ...options, ...extra });
describe('Theatre Projector composition integrity', () => {
  it('requires two distinct active members, exact approvals and no withdrawal', () => {
    expect(keptCompositions([memory()], ['a', 'a'])).toEqual([]); expect(keptCompositions([memory()], ['a'])).toEqual([]); expect(keptCompositions([memory(), { ...memory(), withdrawn: true }], members)).toEqual([]);
    expect(keptCompositions([{ ...memory(), withdrawn: true }, { ...memory('stale'), revision: 4 }], members)).toEqual([]);
    expect(() => captureProjectorSelection([memory()], members, [memoryKey(memory()), memoryKey(memory())], options)).toThrow('PROJECTOR_SELECTION_CHANGED');
    expect(() => captureProjectorSelection([{ ...memory(), withdrawn: true }], members, [memoryKey(memory())], options)).toThrow('PROJECTOR_SELECTION_CHANGED');
  });
  it('captures the selected order and immutable exact author text without changing the source', () => {
    const source = [memory(), memory('second')], snapshot = captureProjectorSelection(source, members, [memoryKey(source[1]!), memoryKey(source[0]!)], options);
    expect(snapshot.memories.map(row => row.id)).toEqual(['second', 'memory-1']); source[0]!.recollections[0]!.text = 'Edited later';
    expect(snapshot.memories[1]!.recollections[0]!.text).toBe('My own exact words.\nA second line.'); expect(Object.isFrozen(snapshot.memories[0]!.recollections[0])).toBe(true);
  });
  it('rejects accessor-backed canonical input without reading its contents', () => {
    const getter = vi.fn(() => 'forged'); const source = { ...memory() }; Object.defineProperty(source, 'title', { get: getter }); expect(keptCompositions([source], members)).toEqual([]); expect(getter).not.toHaveBeenCalled();
  });
  it('wraps and paginates all authored caption characters without a truncation substitute', () => {
    const words = 'One exact word after another '.repeat(80); const rows = [{ ...memory(), recollections: [{ memberId: 'a', text: words }, { memberId: 'b', text: 'Kept separately.' }] }];
    const pages = buildProjectorPages({ selection: select(rows), assets: [] }, text => text.length * 11);
    expect(pages.length).toBeGreaterThan(1); expect(pages.flatMap(page => page.columns[0]!.lines).join('')).toBe(words); expect(wrapProjectorText('First\n\nThird', 100, text => text.length)).toEqual(['First', '', 'Third']);
  });
  it('does not put hidden, unrelated, or provenance-free amounts into the downloadable manifest', () => {
    const row = memory(), amount = { memoryId: row.id, memoryRevision: 3, amountCents: 999900, currency: 'CAD' as const, asOf: '2026-09-12', provenance: 'Explicit saved snapshot' };
    const hidden = select([row], { showAmounts: true, amountSnapshots: [amount] }); expect(amountForMemory(hidden, row)).toBeNull(); expect(JSON.stringify(projectorManifest({ selection: hidden, assets: [] }))).not.toContain('999900');
    const visible = { ...row, hideAmounts: false }, accepted = select([visible], { showAmounts: true, amountSnapshots: [amount] }); expect(amountForMemory(accepted, visible)?.amountCents).toBe(999900);
    expect(amountForMemory(select([visible], { amountSnapshots: [amount] }), visible)).toBeNull(); expect(amountForMemory(select([visible], { showAmounts: true, amountSnapshots: [{ ...amount, provenance: '' }] }), visible)).toBeNull();
  });
  it('binds media and design loading to the exact chosen reference and reviewed publication', async () => {
    const row = { ...memory(), media: [{ version: 1 as const, contentId: 'image-1', revision: 2, kind: 'image' as const, alt: 'Our actual image' }], designs: [{ version: 1 as const, documentId: 'design-1', pieceId: 'piece-1', revision: 7 }] };
    const media = vi.fn(async (reference, scope) => { expect(scope.memoryRevision).toBe(3); expect(scope.scopeKey).toBe('household:member:epoch'); return { status: 'available' as const, reference: { ...reference, revision: 99 }, publication: { id: 'pub', revision: 1, manifestDigest: 'a'.repeat(64) }, blob: new Blob(['image'], { type: 'image/png' }) }; });
    const design = vi.fn(async reference => ({ status: 'available' as const, reference, blob: new Blob(['png'], { type: 'image/png' }), rendering: 'authored-flat' as const }));
    const value = await prepareProjector(select([row]), 'household:member:epoch', { resolveMedia: media, loadDesignSnapshot: design }, guard()); expect(value.assets[0]!.status).toBe('unavailable'); expect(value.assets[0]!.blob).toBeUndefined(); expect(value.assets[1]!.status).toBe('available'); expect(value.assets[1]!.sha256).toMatch(/^[a-f0-9]{64}$/); expect(design.mock.calls[0]![0].revision).toBe(7);
  });
  it('discards a result arriving after the selected composition is revoked', async () => {
    const controller = new AbortController(), row = { ...memory(), media: [{ version: 1 as const, contentId: 'image-1', revision: 1, kind: 'image' as const, alt: '' }] };
    await expect(prepareProjector(select([row]), 'scope', { ...loaders, resolveMedia: async () => { controller.abort(); return { status: 'withdrawn' }; } }, { signal: controller.signal, isCurrent: () => true })).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('exports a labelled script-free readable story with exact escaped captions and unavailable states', async () => {
    const row = { ...memory(), title: '<script>bad()</script>', recollections: [{ memberId: 'a', text: '<img onerror=alert(1)>\nExact words' }, { memberId: 'b', text: 'Kept separately' }], media: [{ version: 1 as const, contentId: 'gone', revision: 1, kind: 'image' as const, alt: '' }] };
    const value = await prepareProjector(select([row]), 'scope', { ...loaders, resolveMedia: async () => ({ status: 'withdrawn' }) }, guard()); const file = await createProjectorStory(value, guard()), html = await file.blob.text();
    expect(file.kind).toBe('story'); expect(file.filename).toMatch(/\.html$/); expect(html).toContain('It is not a video.'); expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>bad'); expect(html).toContain('This media was withdrawn.'); expect(html).toContain('default-src'); expect(html).toContain('&lt;img onerror=alert(1)&gt;\nExact words');
  });
  it('probes supported real encoder MIME and cancels timers promptly', async () => {
    expect(supportedProjectorMime({ isTypeSupported: mime => mime === 'video/mp4' })).toBe('video/mp4'); expect(supportedProjectorMime({ isTypeSupported: () => false })).toBeNull(); const controller = new AbortController(), waiting = projectorWait(10000, controller.signal); controller.abort(); await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('settles a cancelled host loader even when its promise never resolves', async () => {
    const controller = new AbortController(), row = { ...memory(), media: [{ version: 1 as const, contentId: 'image-1', revision: 1, kind: 'image' as const, alt: '' }] };
    const pending = prepareProjector(select([row]), 'scope', { ...loaders, resolveMedia: () => new Promise(() => {}) }, { signal: controller.signal, isCurrent: () => true }); controller.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('freshly denies download after access changes without any new composition props, including caption-only files', async () => {
    const prepared = await prepareProjector(select(), 'scope', loaders, guard()), proof = await projectorDownloadProof(prepared, guard()); let hasAccess = true;
    const validate = vi.fn(async (submitted, context) => { expect(context.scopeKey).toBe('scope'); expect(submitted.memories[0]).toEqual({ id: 'memory-1', revision: 3, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }); return hasAccess; });
    await expect(validateProjectorDownload(proof, 'scope', validate, guard())).resolves.toBeUndefined(); hasAccess = false;
    await expect(validateProjectorDownload(proof, 'scope', validate, guard())).rejects.toThrow('PROJECTOR_DOWNLOAD_DENIED'); expect(validate).toHaveBeenCalledTimes(2); expect(proof.assets).toEqual([]);
    const changed = await projectorDownloadProof({ ...prepared, selection: select([{ ...memory(), title: 'Changed without incrementing revision' }]) }, guard()); expect(changed.memories[0]!.sha256).not.toBe(proof.memories[0]!.sha256);
  });
  it('bounds a stalled async phase and remains abort-responsive', async () => {
    vi.useFakeTimers(); try { const controller = new AbortController(), pending = awaitProjector(new Promise(() => {}), controller.signal, 80); const rejected = expect(pending).rejects.toThrow('PROJECTOR_WAIT_TIMEOUT'); await vi.advanceTimersByTimeAsync(81); await rejected; const cancelled = awaitProjector(new Promise(() => {}), controller.signal, 8000); controller.abort(); await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' }); expect(vi.getTimerCount()).toBe(0); } finally { vi.useRealTimers(); }
  });
  it('rejects oversized encoded output before retaining its chunk and stops all recording resources', async () => {
    const trackStop = vi.fn(), recorderStop = vi.fn(); let instance: { ondataavailable?: ((event: { data: Blob }) => void) | null; onerror?: unknown } | undefined;
    const context = { measureText: (text: string) => ({ width: text.length * 10 }), fillRect: vi.fn(), fillText: vi.fn(), drawImage: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ width: 1280, height: 720, getContext: () => context, captureStream: () => ({ getTracks: () => [{ stop: trackStop }], addTrack: vi.fn() }) }) });
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } state = 'inactive'; ondataavailable: ((event: { data: Blob }) => void) | null = null; constructor() { instance = this; } start() { this.state = 'recording'; this.ondataavailable?.({ data: { size: PROJECTOR_MAX_ENCODED_BYTES + 1 } as Blob }); } stop() { this.state = 'inactive'; recorderStop(); } });
    try { await expect(recordProjectorFilm({ selection: select(), assets: [] }, guard())).rejects.toThrow('PROJECTOR_ENCODED_BYTE_LIMIT'); expect(trackStop).toHaveBeenCalledTimes(1); expect(recorderStop).toHaveBeenCalledTimes(1); expect(instance?.ondataavailable).toBeNull(); expect(instance?.onerror).toBeNull(); } finally { vi.unstubAllGlobals(); }
  });
  for (const phase of ['resume', 'decode'] as const) it(`cancels a stalled audio ${phase} and closes the dedicated context`, async () => {
    const controller = new AbortController(), close = vi.fn(async () => {}), ctx = { measureText: (text: string) => ({ width: text.length * 10 }), fillRect: vi.fn(), fillText: vi.fn(), drawImage: vi.fn() };
    const stall = () => { queueMicrotask(() => controller.abort()); return new Promise<never>(() => {}); };
    const audio = { state: 'running', resume: phase === 'resume' ? stall : async () => {}, decodeAudioData: stall, close } as unknown as AudioContext;
    vi.stubGlobal('document', { createElement: () => ({ width: 1280, height: 720, getContext: () => ctx, captureStream: vi.fn() }) }); vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } });
    try { await expect(recordProjectorFilm({ selection: select(), assets: [{ key: 'voice', memoryId: 'memory-1', memoryRevision: 3, reference: { version: 1, contentId: 'audio-1', revision: 1, kind: 'audio', alt: '' }, kind: 'audio', status: 'available', blob: new Blob(['audio'], { type: 'audio/wav' }) }] }, { signal: controller.signal, isCurrent: () => true }, undefined, audio)).rejects.toMatchObject({ name: 'AbortError' }); expect(close).toHaveBeenCalledTimes(1); } finally { vi.unstubAllGlobals(); }
  });
  it('stops acquired canvas tracks when the supported encoder constructor fails', async () => {
    const stop = vi.fn(), context = { measureText: (text: string) => ({ width: text.length * 10 }), fillRect: vi.fn(), fillText: vi.fn(), drawImage: vi.fn() };
    const stream = { getTracks: () => [{ stop }], addTrack: vi.fn() }; const canvases: Array<{ width: number; height: number }> = [];
    vi.stubGlobal('document', { createElement: () => { const canvas = { width: 1280, height: 720, getContext: () => context, captureStream: () => stream }; canvases.push(canvas); return canvas; } });
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } constructor() { throw Error('Encoder failed'); } });
    try { await expect(recordProjectorFilm({ selection: select(), assets: [] }, guard())).rejects.toThrow('Encoder failed'); expect(stop).toHaveBeenCalledTimes(1); expect(canvases.every(canvas => canvas.width === 0)).toBe(true); } finally { vi.unstubAllGlobals(); }
  });
  it('cancels active recording and removes handlers without returning partial bytes', async () => {
    const controller = new AbortController(), trackStop = vi.fn(), recorderStop = vi.fn(); let instance: { ondataavailable?: unknown; onerror?: unknown } | undefined;
    const context = { measureText: (text: string) => ({ width: text.length * 10 }), fillRect: vi.fn(), fillText: vi.fn(), drawImage: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ width: 1280, height: 720, getContext: () => context, captureStream: () => ({ getTracks: () => [{ stop: trackStop }], addTrack: vi.fn() }) }) });
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } state = 'inactive'; ondataavailable: unknown; onerror: unknown; constructor() { instance = this; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; recorderStop(); } });
    try { await expect(recordProjectorFilm({ selection: select(), assets: [] }, { signal: controller.signal, isCurrent: () => true }, () => controller.abort())).rejects.toMatchObject({ name: 'AbortError' }); expect(trackStop).toHaveBeenCalledTimes(1); expect(recorderStop).toHaveBeenCalledTimes(1); expect(instance?.ondataavailable).toBeNull(); expect(instance?.onerror).toBeNull(); } finally { vi.unstubAllGlobals(); }
  });
  it('cancels a recorder whose final stop event never arrives and releases its tracks', async () => {
    const controller = new AbortController(), trackStop = vi.fn(); const context = { measureText: (text: string) => ({ width: text.length * 10 }), fillRect: vi.fn(), fillText: vi.fn(), drawImage: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ width: 1280, height: 720, getContext: () => context, captureStream: () => ({ getTracks: () => [{ stop: trackStop }], addTrack: vi.fn() }) }) });
    vi.stubGlobal('MediaRecorder', class { static isTypeSupported() { return true; } state = 'inactive'; start() { this.state = 'recording'; } stop() { this.state = 'inactive'; queueMicrotask(() => controller.abort()); } });
    try { await expect(recordProjectorFilm({ selection: select(), assets: [] }, { signal: controller.signal, isCurrent: () => true })).rejects.toMatchObject({ name: 'AbortError' }); expect(trackStop).toHaveBeenCalledTimes(1); } finally { vi.unstubAllGlobals(); }
  });
  for (const theme of ['classic', 'taylor', 'newfoundland'] as const) it(`renders an accessible ${theme} theatre without unkept data or fabricated memories`, () => {
    const html = renderToStaticMarkup(createElement(TheatreProjector, { memories: [{ ...memory(), withdrawn: true }], activeMemberIds: members, theme, scopeKey: 'scope', ...loaders, validateDownload: async () => true, onClose: () => {} })); expect(html).toContain('Our little theatre'); expect(html).toContain('no mutually kept versions'); expect(html).not.toContain('An ordinary afternoon'); expect(html).not.toContain('data:image');
  });
});
