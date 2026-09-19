import { decodeMemory, decodeMediaReference, decodeDesignReference, memoryKeptByEveryone, type MemoryComposition } from './contracts.ts';
import type { PreparedProjector, ProjectorAsset, ProjectorGuard, ProjectorLoaders, ProjectorOptions, ProjectorSelection, ProjectorDownloadProof, ProjectorDownloadValidator, ProjectorMediaResult, ProjectorDesignResult } from './projectorTypes.ts';

export const memoryKey = (memory: Pick<MemoryComposition, 'id' | 'revision'>) => JSON.stringify([memory.id, memory.revision]);
export function keptCompositions(memories: MemoryComposition[], activeMemberIds: string[]): MemoryComposition[] {
  const members = [...new Set(activeMemberIds)];
  if (members.length < 2 || members.length !== activeMemberIds.length) return [];
  const decoded = memories.flatMap(input => { try { return [decodeMemory(input)]; } catch { return []; } });
  const counts = new Map<string, number>(); decoded.forEach(memory => counts.set(memory.id, (counts.get(memory.id) ?? 0) + 1));
  return decoded.filter(memory => counts.get(memory.id) === 1 && memoryKeptByEveryone(memory, members));
}
export function captureProjectorSelection(memories: MemoryComposition[], activeMemberIds: string[], order: string[], options: ProjectorOptions): ProjectorSelection {
  const eligible = new Map(keptCompositions(memories, activeMemberIds).map(memory => [memoryKey(memory), memory]));
  if (!order.length || new Set(order).size !== order.length || order.some(key => !eligible.has(key))) throw Error('PROJECTOR_SELECTION_CHANGED');
  if (!Number.isFinite(options.secondsPerPage) || options.secondsPerPage < 1 || options.secondsPerPage > 30) throw Error('PROJECTOR_INVALID_DURATION');
  const selection: ProjectorSelection = structuredClone({ version: 1, memories: order.map(key => eligible.get(key)!), activeMemberIds, options });
  // The approved composition is a value snapshot. UI ordering never mutates the host's records or partner's words.
  const freeze = (value: unknown): void => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } }; freeze(selection);
  return selection;
}
export function checkProjectorCurrent(guard: ProjectorGuard): void {
  if (guard.signal.aborted || !guard.isCurrent()) throw new DOMException('The selected composition or its access changed.', 'AbortError');
}
/** Cancellation settles even when a host loader neglects its AbortSignal. */
export function awaitProjector<T>(pending: Promise<T>, signal: AbortSignal, timeoutMs = 30000): Promise<T> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => { if (timer) clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    if (signal.aborted) { void pending.catch(() => {}); abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { cleanup(); reject(Error('PROJECTOR_WAIT_TIMEOUT')); }, timeoutMs);
    pending.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}
export async function projectorDownloadProof(prepared: PreparedProjector, guard: ProjectorGuard): Promise<ProjectorDownloadProof> {
  const memories = [];
  for (const memory of prepared.selection.memories) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(memory))); checkProjectorCurrent(guard);
    memories.push({ id: memory.id, revision: memory.revision, sha256: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') });
  }
  return { version: 1, memories, assets: prepared.assets.map(({ blob: _blob, ...asset }) => structuredClone(asset)) };
}
export async function validateProjectorDownload(proof: ProjectorDownloadProof, scopeKey: string, validate: ProjectorDownloadValidator, guard: ProjectorGuard): Promise<void> {
  checkProjectorCurrent(guard);
  const valid = await awaitProjector(validate(structuredClone(proof), { scopeKey, signal: guard.signal }), guard.signal, 15000);
  checkProjectorCurrent(guard); if (valid !== true) throw Error('PROJECTOR_DOWNLOAD_DENIED');
}

export const projectorAssetKey = (memory: MemoryComposition, kind: string, reference: unknown) => JSON.stringify([memory.id, memory.revision, kind, reference]);
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']);
const audioTypes = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/flac']);
const blobType = (blob: Blob) => blob.type.split(';')[0]!.toLowerCase();
export async function prepareProjector(selection: ProjectorSelection, scopeKey: string, loaders: ProjectorLoaders, guard: ProjectorGuard): Promise<PreparedProjector> {
  const assets: ProjectorAsset[] = []; let totalBytes = 0;
  for (const memory of selection.memories) {
    const scope = { memoryId: memory.id, memoryRevision: memory.revision, scopeKey, signal: guard.signal };
    for (const reference of [...memory.media, ...memory.designs]) {
      checkProjectorCurrent(guard);
      const isMedia = 'contentId' in reference, kind = isMedia ? reference.kind : 'design';
      const asset: ProjectorAsset = { key: projectorAssetKey(memory, kind, reference), memoryId: memory.id, memoryRevision: memory.revision, kind, reference, status: 'unavailable' };
      try {
        const result = await awaitProjector<ProjectorMediaResult | ProjectorDesignResult>(isMedia ? loaders.resolveMedia(reference, scope) : loaders.loadDesignSnapshot(reference, scope), guard.signal);
        checkProjectorCurrent(guard);
        if (result.status !== 'available') { asset.status = result.status === 'withdrawn' ? 'withdrawn' : 'unavailable'; assets.push(asset); continue; }
        if (JSON.stringify(isMedia ? decodeMediaReference(result.reference) : decodeDesignReference(result.reference)) !== JSON.stringify(reference)) throw Error('PROJECTOR_REVISION_MISMATCH');
        if (!(result.blob instanceof Blob) || !result.blob.size || result.blob.size > 64 * 1024 * 1024) throw Error('PROJECTOR_MEDIA_LIMIT');
        if (!(kind === 'audio' ? audioTypes : imageTypes).has(blobType(result.blob))) throw Error('PROJECTOR_MEDIA_TYPE');
        if (isMedia) {
          if (!('publication' in result) || !result.publication.id || !Number.isSafeInteger(result.publication.revision) || result.publication.revision < 1 || !/^[a-f0-9]{64}$/.test(result.publication.manifestDigest)) throw Error('PROJECTOR_PUBLICATION_REQUIRED');
          asset.publication = { ...result.publication };
        } else if ('rendering' in result) asset.rendering = result.rendering;
        totalBytes += result.blob.size;
        if (totalBytes > 256 * 1024 * 1024) throw Error('PROJECTOR_TOTAL_MEDIA_LIMIT');
        const digest = await crypto.subtle.digest('SHA-256', await result.blob.arrayBuffer()); checkProjectorCurrent(guard);
        asset.sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        asset.blob = result.blob; asset.status = 'available';
      } catch (error) {
        checkProjectorCurrent(guard);
        if (error instanceof Error && error.message === 'PROJECTOR_TOTAL_MEDIA_LIMIT') throw error;
        // Server errors may contain private URLs or keys. Only the bounded state is displayed/exported.
        asset.status = 'unavailable';
      }
      assets.push(asset);
    }
  }
  checkProjectorCurrent(guard); return { selection, assets };
}
export function amountForMemory(selection: ProjectorSelection, memory: MemoryComposition) {
  if (!selection.options.showAmounts || memory.hideAmounts) return null;
  const rows = selection.options.amountSnapshots?.filter(row => row.memoryId === memory.id && row.memoryRevision === memory.revision) ?? [];
  const row = rows.length === 1 ? rows[0] : undefined;
  if (!row || !Number.isSafeInteger(row.amountCents) || row.currency !== 'CAD' || !/^\d{4}-\d{2}-\d{2}$/.test(row.asOf) || !row.provenance.trim()) return null;
  const date = new Date(`${row.asOf}T00:00:00.000Z`); if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.asOf) return null;
  return row;
}
export const authorLabel = (selection: ProjectorSelection, memberId: string) => selection.options.authorLabels?.[memberId] || `Voice ${Math.max(0, selection.memories.flatMap(m => m.recollections.map(r => r.memberId)).filter((id, i, all) => all.indexOf(id) === i).indexOf(memberId)) + 1}`;
export const assetNotice = (asset: ProjectorAsset) => asset.status === 'withdrawn' ? 'This media was withdrawn.' : 'This saved media is unavailable.';
