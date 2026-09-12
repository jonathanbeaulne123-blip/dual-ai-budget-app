import { zip } from 'fflate';
import { captureAuthoredKitty } from './exportCapture.ts';
import { normalizeExportSelection } from './exportKitty.ts';
import { sha256, stable, type ExportCapture, type ExportManifest, type ExportSelection, type GeometryReport, type RepairProposal } from './exportTypes.ts';
import { validateNativeIdentity } from './native.ts';
import type { DesignSurfaceSelection } from './designSurfaceContracts.ts';
import type { ExportWorkerRequest } from './exportWorker.ts';

export type ExportOptions = Pick<ExportSelection, 'heightMm' | 'construction' | 'hollow'>;
export type ExportReview = { token: string; selection: ExportSelection; proposal: RepairProposal; report: GeometryReport };
export type ExportJobState = { phase: 'idle' | 'capturing' | 'preparing' | 'finishing' | 'packing' | 'error'; message?: string }
  | { phase: 'review'; review: ExportReview }
  | { phase: 'ready'; manifest: ExportManifest; url: string; bytes: number };
export type ExportWorkerPort = { postMessage(message: ExportWorkerRequest): void; terminate(): void; onmessage: ((event: MessageEvent) => void) | null; onerror: ((event: ErrorEvent) => void) | null };
export type ExportJobDependencies = {
  worker: () => ExportWorkerPort;
  capture: (selection: ExportSelection) => ExportCapture;
  pack: (files: Map<string, Uint8Array>, signal: AbortSignal) => Promise<Uint8Array>;
  createURL: (blob: Blob) => string; revokeURL: (url: string) => void;
  timeoutMs: number;
};
function packFiles(files: Map<string, Uint8Array>, signal: AbortSignal) {
  return new Promise<Uint8Array>((resolve, reject) => {
    if (signal.aborted) { reject(new Error('EXPORT_CANCELLED')); return; }
    const abort = () => { stop(); reject(new Error('EXPORT_CANCELLED')); };
    const stop = zip(Object.fromEntries(files), { level: 6, mtime: new Date(1980, 0, 1) }, (error, bytes) => {
      signal.removeEventListener('abort', abort); if (signal.aborted) return;
      if (error) reject(error); else resolve(bytes);
    });
    signal.addEventListener('abort', abort, { once: true });
  });
}
const defaults: ExportJobDependencies = {
  worker: () => new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' }),
  capture: captureAuthoredKitty, pack: packFiles,
  createURL: blob => URL.createObjectURL(blob), revokeURL: url => URL.revokeObjectURL(url),
  timeoutMs: 120_000,
};
export function exportFailureText(code: string) {
  if (code.includes('HEIGHT_RANGE')) return 'Choose a physical height from 30 to 1,000 mm.';
  if (code.includes('HOLLOW_DIMENSIONS')) return 'Check the wall, slot and base-opening dimensions against the selected height.';
  if (code.includes('CANCELLED')) return 'The preparation was cancelled. Your chosen design is unchanged.';
  if (code.includes('TIMED_OUT')) return 'This preparation took too long and was stopped. Try a smaller design or prepare again.';
  if (/CAVITY|OPENING|DERIVATIVE|REPAIR/.test(code)) return 'Those production changes could not be verified. Adjust the dimensions or prepare a solid source copy.';
  if (/TOO_LARGE|LIMIT/.test(code)) return 'This design exceeds the current local export limit. Its original artwork is still kept.';
  return 'The files could not be verified. Your original design is still kept; prepare the package again.';
}
/** One private, cancellable worker job. It never persists or changes the selected design. */
export class DesignExportJob {
  state: ExportJobState = { phase: 'idle' };
  private worker: ExportWorkerPort | null = null;
  private requestId = '';
  private generation = 0;
  private url: string | null = null;
  private abort = new AbortController();
  private selection: ExportSelection | null = null;
  private repairDigest: string | undefined;
  private prepared: ExportReview | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private deps: ExportJobDependencies;
  private source: DesignSurfaceSelection;
  constructor(source: DesignSurfaceSelection, private changed: (state: ExportJobState) => void, dependencies: Partial<ExportJobDependencies> = {}) {
    validateNativeIdentity(source.identity);
    if (source.piece.id !== source.identity.pieceId) throw Error('EXPORT_SELECTION_CHANGED');
    this.source = structuredClone(source); this.deps = { ...defaults, ...dependencies };
  }
  private set(state: ExportJobState) { this.state = state; this.changed(state); }
  private clearTimer() { clearTimeout(this.timer); this.timer = undefined; }
  private deadline() { this.clearTimer(); this.timer = setTimeout(() => this.fail('EXPORT_TIMED_OUT'), this.deps.timeoutMs); }
  cancel() {
    this.clearTimer();
    ++this.generation; this.abort.abort(); this.abort = new AbortController();
    this.worker?.terminate(); this.worker = null; this.selection = null; this.repairDigest = undefined; this.prepared = null;
    if (this.url) this.deps.revokeURL(this.url); this.url = null; this.set({ phase: 'idle' });
  }
  dispose() { this.changed = () => {}; this.cancel(); }
  async prepare(options: ExportOptions) {
    this.cancel(); const generation = this.generation;
    this.set({ phase: 'capturing' });
    // Give the browser a frame to paint the progress and Cancel controls first.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (generation !== this.generation) return;
    try {
      const selection = normalizeExportSelection({ version: 1, documentId: this.source.identity.designId, revision: this.source.identity.revision, piece: this.source.piece, ...options });
      const capture = this.deps.capture(selection);
      if (generation !== this.generation) return;
      this.selection = selection; this.requestId = crypto.randomUUID();
      const worker = this.deps.worker(); this.worker = worker;
      worker.onmessage = event => { if (this.worker === worker && generation === this.generation) void this.receive(event.data, generation); };
      worker.onerror = () => { if (this.worker === worker) this.fail('EXPORT_WORKER_FAILED'); };
      this.set({ phase: 'preparing' }); this.deadline(); worker.postMessage({ type: 'prepare', requestId: this.requestId, selection, capture });
    } catch (error) { if (generation === this.generation) this.fail(error instanceof Error ? error.message : 'EXPORT_FAILED'); }
  }
  finish(input: { limitationsReviewed: boolean; approvedRepairDigest?: string }) {
    if (this.state.phase !== 'review' || !this.worker || !input.limitationsReviewed) throw Error('EXPORT_REVIEW_REQUIRED');
    const { review } = this.state;
    if (input.approvedRepairDigest !== undefined && (input.approvedRepairDigest !== review.proposal.digest || review.proposal.blockers.length)) throw Error('EXPORT_REPAIR_REVIEW_CHANGED');
    if (review.selection.construction === 'hollow' && input.approvedRepairDigest !== review.proposal.digest) throw Error('EXPORT_HOLLOW_REVIEW_REQUIRED');
    this.repairDigest = input.approvedRepairDigest;
    this.requestId = crypto.randomUUID(); this.set({ phase: 'finishing' }); this.deadline();
    this.worker.postMessage({ type: 'finish', requestId: this.requestId, token: review.token, ...(input.approvedRepairDigest ? { approvedRepairDigest: input.approvedRepairDigest } : {}) });
  }
  private fail(code: string) { ++this.generation; this.clearTimer(); this.abort.abort(); this.worker?.terminate(); this.worker = null; this.set({ phase: 'error', message: exportFailureText(code) }); }
  private async receive(raw: unknown, generation: number) {
    try {
      if (!raw || typeof raw !== 'object') throw Error('EXPORT_RESPONSE_INVALID');
      const value = raw as Record<string, unknown>;
      if (value.requestId !== this.requestId) return;
      if (value.type === 'error') { this.fail(String(value.code)); return; }
      if (value.type === 'prepared' && this.state.phase === 'preparing') {
        const review = value as unknown as ExportReview;
        if (!this.selection || stable(review.selection) !== stable(this.selection) || review.token !== review.proposal.digest || !/^[a-f0-9]{64}$/.test(review.token)) throw Error('EXPORT_SELECTION_CHANGED');
        this.prepared = structuredClone(review);
        this.clearTimer(); this.set({ phase: 'review', review: structuredClone(review) }); return;
      }
      if (value.type === 'complete' && (this.state.phase === 'packing' || this.state.phase === 'ready')) return;
      if (value.type !== 'complete' || this.state.phase !== 'finishing') throw Error('EXPORT_RESPONSE_INVALID');
      // Consume a completion before awaiting digests so duplicate messages cannot
      // start another compression job or revoke a valid in-flight completion.
      this.set({ phase: 'packing' });
      const manifest = value.manifest as ExportManifest;
      if (!this.selection || !this.prepared || manifest.documentId !== this.selection.documentId || manifest.designRevision !== this.selection.revision || manifest.pieceId !== this.selection.piece.id || manifest.heightMm !== this.selection.heightMm || manifest.construction !== this.selection.construction || manifest.selectionDigest !== this.prepared.proposal.selectionDigest || manifest.sourceGeometryDigest !== this.prepared.proposal.sourceGeometryDigest || (manifest.repair?.digest ?? undefined) !== this.repairDigest || !Array.isArray(value.files) || value.files.length > 320) throw Error('EXPORT_SELECTION_CHANGED');
      const files = new Map(value.files as [string, Uint8Array][]);
      if (files.size !== value.files.length || [...files].some(([name, bytes]) => !/^(?:paint\/)?[a-zA-Z0-9._-]+$/.test(name) || name.split('/').some(part => part === '.' || part === '..') || !(bytes instanceof Uint8Array)) || [...files.values()].reduce((n, bytes) => n + bytes.length, 0) > 64 * 1024 * 1024) throw Error('EXPORT_PACKAGE_TOO_LARGE');
      const required = ['kitty.stl', 'kitty.3mf', 'kitty.glb', 'source-design.json', 'paint/source-paint.json', 'geometry-report.json', 'geometry-sheet.pdf', 'manifest.json'];
      if (manifest.repair) required.push('source-authored.glb');
      if (required.some(name => !files.has(name)) || manifest.files.length !== files.size - 1 || new Set(manifest.files.map(file => file.name)).size !== manifest.files.length || manifest.files.some(file => file.name === 'manifest.json')) throw Error('EXPORT_PACKAGE_INCOMPLETE');
      if (stable(JSON.parse(new TextDecoder().decode(files.get('manifest.json')))) !== stable(manifest)) throw Error('EXPORT_PACKAGE_CHECKSUM');
      for (const file of manifest.files) { const bytes = files.get(file.name); if (!bytes || file.bytes !== bytes.length || await sha256(bytes) !== file.sha256) throw Error('EXPORT_PACKAGE_CHECKSUM'); }
      if (generation !== this.generation) return;
      this.worker?.terminate(); this.worker = null;
      const packed = await this.deps.pack(files, this.abort.signal);
      if (generation !== this.generation) return;
      this.clearTimer();
      this.url = this.deps.createURL(new Blob([new Uint8Array(packed).buffer], { type: 'application/zip' }));
      this.set({ phase: 'ready', manifest, url: this.url, bytes: packed.length });
    } catch (error) { if (generation === this.generation) this.fail(error instanceof Error ? error.message : 'EXPORT_FAILED'); }
  }
}
