import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry } from 'three';
import { newKittyPiece } from '../src/core/kittyStudio.ts';
import { DesignExportJob, type ExportJobDependencies, type ExportWorkerPort } from '../src/hearthside/DesignExportJob.ts';
import { finishKittyExport, prepareKittyExport } from '../src/hearthside/exportKitty.ts';
import { jsonBytes, type ExportCapture, type ExportPackage, type ExportSelection } from '../src/hearthside/exportTypes.ts';
import type { ExportWorkerRequest } from '../src/hearthside/exportWorker.ts';
import type { DesignSurfaceSelection } from '../src/hearthside/designSurfaceContracts.ts';
import { hearthsideNativePlugin, nativeBytesBase64, nativeSceneFromDesign } from '../src/hearthside/nativeBridge.ts';

const selection = (): DesignSurfaceSelection => ({ identity: { environment: 'development', householdId: 'house-a', memberId: 'alice', designId: 'design-a', pieceId: 'piece-a', revision: 12 }, piece: newKittyPiece('piece-a', '2026-09-12T12:00:00Z') });
function cube(height = 160): ExportCapture {
  const g = new BoxGeometry(80, height, 60); g.translate(0, height / 2, 0);
  const mesh = { name: 'body', material: 0, positions: Array.from(g.getAttribute('position').array), uv: Array.from(g.getAttribute('uv').array), indices: Array.from(g.index!.array) }; g.dispose();
  return { source: 'authored-kitty-sculpture-v1', meshes: [mesh], materials: [{ name: 'clay', color: [.8, .7, .6, 1] }], crownY: height, baseY: 0, crownCenter: [0, 0], baseCenter: [0, 0] };
}
class Port implements ExportWorkerPort {
  onmessage: ExportWorkerPort['onmessage'] = null;
  onerror: ExportWorkerPort['onerror'] = null;
  postMessage = vi.fn<(request: ExportWorkerRequest) => void>();
  terminate = vi.fn();
  emit(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
  get request() { return this.postMessage.mock.calls.at(-1)![0]; }
}
function harness(overrides: Partial<ExportJobDependencies> = {}) {
  const workers: Port[] = [], changed = vi.fn();
  const deps = { worker: vi.fn(() => { const worker = new Port(); workers.push(worker); return worker; }), capture: vi.fn((s: ExportSelection) => cube(s.heightMm)), pack: vi.fn(async () => new Uint8Array([1, 2, 3])), createURL: vi.fn(() => 'blob:synthetic-package'), revokeURL: vi.fn(), ...overrides };
  const job = new DesignExportJob(selection(), changed, deps);
  const prepare = async (construction: 'solid' | 'hollow' = 'solid') => {
    await job.prepare({ heightMm: 160, construction, ...(construction === 'hollow' ? { hollow: { wallMm: 3, coinSlotWidthMm: 28, coinSlotDepthMm: 4, baseOpeningDiameterMm: 32 } } : {}) });
    const worker = workers.at(-1)!, request = worker.request;
    if (request.type !== 'prepare') throw Error('prepare required');
    const prepared = await prepareKittyExport(request.selection, request.capture);
    worker.emit({ type: 'prepared', requestId: request.requestId, token: prepared.proposal.digest, selection: prepared.selection, proposal: prepared.proposal, report: prepared.report });
    return { worker, prepared };
  };
  const complete = (worker: Port, output: ExportPackage) => worker.emit({ type: 'complete', requestId: worker.request.requestId, manifest: output.manifest, files: [...output.files] });
  return { job, deps, workers, changed, prepare, complete };
}
afterEach(() => vi.useRealTimers());

describe('selected design export review and cancellation', () => {
  it('captures only the chosen authored revision and waits for explicit limitations review', async () => {
    const h = harness(), { worker, prepared } = await h.prepare();
    expect(worker.request).toMatchObject({ type: 'prepare', selection: { documentId: 'design-a', revision: 12, heightMm: 160, construction: 'solid' } });
    expect(JSON.stringify(worker.request)).not.toMatch(/house-a|alice|backing|savedCents/);
    expect(h.job.state.phase).toBe('review'); expect(h.deps.pack).not.toHaveBeenCalled(); expect(h.deps.createURL).not.toHaveBeenCalled();
    expect(() => h.job.finish({ limitationsReviewed: false })).toThrow('EXPORT_REVIEW_REQUIRED');
    h.job.finish({ limitationsReviewed: true }); h.complete(worker, await finishKittyExport(prepared));
    await vi.waitFor(() => expect(h.job.state.phase).toBe('ready'));
    expect(h.deps.pack).toHaveBeenCalledOnce(); expect(h.deps.createURL).toHaveBeenCalledOnce();
    expect(h.job.state).toMatchObject({ manifest: { heightMm: 160, designRevision: 12, sourceChanged: false, repair: null } });
    h.job.dispose(); expect(h.deps.revokeURL).toHaveBeenCalledWith('blob:synthetic-package');
  });
  it('requires the exact repair digest for a hollow copy and never silently chooses repairs', async () => {
    const h = harness(), { worker, prepared } = await h.prepare('hollow');
    expect(() => h.job.finish({ limitationsReviewed: true })).toThrow('EXPORT_HOLLOW_REVIEW_REQUIRED');
    expect(() => h.job.finish({ limitationsReviewed: true, approvedRepairDigest: 'wrong' })).toThrow('EXPORT_REPAIR_REVIEW_CHANGED');
    h.job.finish({ limitationsReviewed: true, approvedRepairDigest: prepared.proposal.digest });
    expect(worker.request).toMatchObject({ type: 'finish', token: prepared.proposal.digest, approvedRepairDigest: prepared.proposal.digest }); h.job.dispose();
  });
  it('invalidates the review on a dimension change and ignores terminated worker replies', async () => {
    const h = harness(), { worker, prepared } = await h.prepare();
    await h.job.prepare({ heightMm: 80, construction: 'solid' }); expect(worker.terminate).toHaveBeenCalledOnce();
    worker.emit({ type: 'prepared', requestId: worker.request.requestId, ...prepared, token: prepared.proposal.digest });
    expect(h.job.state.phase).toBe('preparing'); expect(() => h.job.finish({ limitationsReviewed: true })).toThrow('EXPORT_REVIEW_REQUIRED');
    expect(h.workers.at(-1)!.request).toMatchObject({ selection: { heightMm: 80 } }); h.job.dispose();
  });
  it('invalidates a review when the supplied manufacturing profile changes and rejects a forged completion profile', async () => {
    const h = harness(), { worker } = await h.prepare();
    await h.job.prepare({ heightMm: 160, construction: 'solid', manufacturingProfile: 'PLA profile A' }); expect(worker.terminate).toHaveBeenCalledOnce();
    expect(h.workers.at(-1)!.request).toMatchObject({ selection: { manufacturingProfile: 'PLA profile A' } });
    const latest = h.workers.at(-1)!, request = latest.request; if (request.type !== 'prepare') throw Error();
    const reviewed = await prepareKittyExport(request.selection, request.capture);
    latest.emit({ type: 'prepared', requestId: request.requestId, token: reviewed.proposal.digest, selection: reviewed.selection, proposal: reviewed.proposal, report: reviewed.report });
    const output = await finishKittyExport(reviewed);
    h.job.finish({ limitationsReviewed: true });
    latest.emit({ type: 'complete', requestId: latest.request.requestId, manifest: { ...output.manifest, manufacturingProfile: 'forged profile' }, files: [...output.files] });
    await vi.waitFor(() => expect(h.job.state.phase).toBe('error')); h.job.dispose();
  });
  it('rejects changed source content or hollow measurements in a preparation reply', async () => {
    const h = harness(); await h.job.prepare({ heightMm: 160, construction: 'solid' });
    const worker = h.workers[0]!, request = worker.request; if (request.type !== 'prepare') throw Error();
    const p = await prepareKittyExport(request.selection, request.capture); p.selection.piece.paint.base = '#ff0000';
    worker.emit({ type: 'prepared', requestId: request.requestId, token: p.proposal.digest, ...p });
    expect(h.job.state.phase).toBe('error'); expect(h.deps.pack).not.toHaveBeenCalled(); h.job.dispose();
  });
  it.each(['bytes', 'manifest', 'missing', 'traversal', 'parent-directory'])('refuses a %s-corrupted package before compression', async corruption => {
    const h = harness(), { worker, prepared } = await h.prepare(), output = await finishKittyExport(prepared);
    h.job.finish({ limitationsReviewed: true });
    if (corruption === 'bytes') output.files.get('kitty.stl')![90] = output.files.get('kitty.stl')![90]! ^ 1;
    if (corruption === 'manifest') output.files.set('manifest.json', jsonBytes({ ...output.manifest, heightMm: 999 }));
    if (corruption === 'missing') output.files.delete('geometry-sheet.pdf');
    if (corruption === 'traversal') output.files.set('../private.json', jsonBytes({}));
    if (corruption === 'parent-directory') output.files.set('paint/..', jsonBytes({}));
    h.complete(worker, output); await vi.waitFor(() => expect(h.job.state.phase).toBe('error')); expect(h.deps.pack).not.toHaveBeenCalled(); expect(h.deps.createURL).not.toHaveBeenCalled(); h.job.dispose();
  });
  it('consumes duplicate completion messages once and discards late packing after a scope departure', async () => {
    let finishPacking!: (bytes: Uint8Array) => void;
    const h = harness({ pack: vi.fn(() => new Promise<Uint8Array>(resolve => { finishPacking = resolve; })) }), { worker, prepared } = await h.prepare(), output = await finishKittyExport(prepared);
    h.job.finish({ limitationsReviewed: true }); h.complete(worker, output); h.complete(worker, output);
    await vi.waitFor(() => expect(h.deps.pack).toHaveBeenCalledOnce()); h.job.dispose(); finishPacking(new Uint8Array([1]));
    await Promise.resolve(); expect(h.deps.createURL).not.toHaveBeenCalled(); expect(h.job.state.phase).toBe('idle');
  });
  it('bounds a worker that stops replying and can be deliberately retried', async () => {
    vi.useFakeTimers(); const h = harness({ timeoutMs: 30 });
    const preparing = h.job.prepare({ heightMm: 160, construction: 'solid' }); await vi.advanceTimersByTimeAsync(1); await preparing;
    expect(h.job.state.phase).toBe('preparing'); await vi.advanceTimersByTimeAsync(31);
    expect(h.job.state).toMatchObject({ phase: 'error', message: expect.stringContaining('too long') }); expect(h.workers[0]!.terminate).toHaveBeenCalledOnce(); h.job.dispose();
  });
});

describe('canonical native scene producer', () => {
  it('keeps authored metres, UVs and GLB bytes identical across all backing states', () => {
    const capture = vi.fn((s: ExportSelection) => cube(s.heightMm)), source = selection(), before = JSON.stringify(source);
    const empty = nativeSceneFromDesign(source, { status: 'available', step: 0 }, '/hearthside/studio/piece-a', capture);
    const full = nativeSceneFromDesign(source, { status: 'available', step: 10 }, '/hearthside/studio/piece-a', capture);
    const unavailable = nativeSceneFromDesign(source, { status: 'unavailable' }, '/hearthside/studio/piece-a', capture);
    expect(empty.meshes).toEqual(full.meshes); expect(full.meshes).toEqual(unavailable.meshes); expect(full.glbBase64).toBe(empty.glbBase64); expect(unavailable.glbBase64).toBe(full.glbBase64);
    expect(Math.max(...empty.meshes[0]!.positions.filter((_, i) => i % 3 === 1))).toBe(.16);
    expect(empty.meshes[0]!.uvs).toEqual(cube().meshes[0]!.uv.map((v, i) => i % 2 ? 1 - v : v));
    expect(capture.mock.calls[0]![0]).toMatchObject({ heightMm: 160, revision: 12, construction: 'solid' }); expect(JSON.stringify(capture.mock.calls[0])).not.toMatch(/house-a|alice|backing/); expect(JSON.stringify(source)).toBe(before);
    const glb = Uint8Array.from(atob(full.glbBase64), c => c.charCodeAt(0)), size = new DataView(glb.buffer).getUint32(12, true), json = JSON.parse(new TextDecoder().decode(glb.slice(20, 20 + size)));
    expect(json.accessors[0].max[1]).toBeCloseTo(.16); expect(json.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
  });
  it('preserves painted textures and does not register a native plugin in a web browser', () => {
    const capture = cube(); capture.materials[0]!.png = new Uint8Array([137, 80, 78, 71]);
    expect(nativeSceneFromDesign(selection(), { status: 'unavailable' }, '/hearthside', () => capture).meshes[0]!.texturePng).toBe('iVBORw==');
    expect(hearthsideNativePlugin()).toBeNull();
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => i % 256); expect(Buffer.from(atob(nativeBytesBase64(bytes)), 'binary').equals(Buffer.from(bytes))).toBe(true);
  });
  it('rejects cross-piece selection and non-Hearthside return addresses', () => {
    const wrong = selection(); wrong.piece.id = 'different'; expect(() => nativeSceneFromDesign(wrong, { status: 'unavailable' }, '/hearthside', () => cube())).toThrow('IDENTITY_MISMATCH');
    expect(() => nativeSceneFromDesign(selection(), { status: 'unavailable' }, 'https://example.invalid', () => cube())).toThrow('inside Hearthside');
  });
});
