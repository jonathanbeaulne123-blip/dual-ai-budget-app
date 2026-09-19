import type { HearthsideVaultClient, VaultClientScope } from './vaultClient.ts';
import { vaultAssert, vaultDigest, type VaultMedia, type VaultPublicationReceipt } from './vaultContracts.ts';
import { decodeMemoryPublicationBinding, memoryCompositionDigest, memoryPublicationProjection, type MemoryPublicationBinding, type MemoryPublicationCandidate, type VaultMemoryAuthorReview } from './memoryPublication.ts';

export type MemoryVaultClient = Pick<HearthsideVaultClient, 'command' | 'snapshot' | 'queueMedia' | 'resumeUploads'> & {
  media(id: string, publicationId?: string, mode?: 'active' | 'review'): Promise<Blob>;
};
export type MemoryCopySource = { mediaId: string; publicationId: string | null; contentType: VaultMedia['contentType']; sha256: string; byteLength: number; alt: string };
export type MemoryRecoveryEntry = {
  key: string; scope: string; memoryId: string; fingerprint: string; id: string;
  kind: 'publication' | 'copy'; source?: MemoryCopySource;
  publicationSourceId?: string | null;
};
export interface MemoryPublicationRecovery {
  reserve(scope: VaultClientScope, memoryId: string, kind: MemoryRecoveryEntry['kind'], fingerprint: string, source?: MemoryCopySource, publicationSourceId?: string | null): Promise<MemoryRecoveryEntry>;
  list(scope: VaultClientScope, memoryId: string): Promise<MemoryRecoveryEntry[]>;
  close?(): Promise<void>;
}
export const memoryPrivateScope = (scope: VaultClientScope) => JSON.stringify([scope.environment, scope.householdId, scope.memberId, scope.subject]);

/** Stable request identities are private and durable before any publication/copy request. */
export class IndexedDbMemoryPublicationRecovery implements MemoryPublicationRecovery {
  private db: Promise<IDBDatabase> | null = null;
  constructor(private readonly factory: IDBFactory = indexedDB) {}
  private open(): Promise<IDBDatabase> {
    return this.db ??= new Promise((resolve, reject) => {
      let failed = false; const request = this.factory.open('hearth-memory-review-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('intents', { keyPath: 'key' });
      request.onsuccess = () => { if (failed) request.result.close(); else resolve(request.result); };
      request.onerror = request.onblocked = () => { failed = true; reject(new Error('PRIVATE_STORAGE_UNAVAILABLE')); };
    });
  }
  async reserve(scope: VaultClientScope, memoryId: string, kind: MemoryRecoveryEntry['kind'], fingerprint: string, source?: MemoryCopySource, publicationSourceId?: string | null): Promise<MemoryRecoveryEntry> {
    const db = await this.open(), scopeKey = memoryPrivateScope(scope), key = JSON.stringify([scopeKey, memoryId, kind, fingerprint]);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('intents', 'readwrite'), store = tx.objectStore('intents'); let result: MemoryRecoveryEntry;
      const prior = store.get(key);
      prior.onsuccess = () => {
        if (prior.result) { result = prior.result as MemoryRecoveryEntry; return; }
        const count = store.count(); count.onsuccess = () => {
          if (count.result >= 500) { tx.abort(); return; }
          result = { key, scope: scopeKey, memoryId, kind, fingerprint, id: `memory-${kind}-${crypto.randomUUID()}`, ...(source ? { source } : {}), ...(kind === 'publication' ? { publicationSourceId: publicationSourceId ?? null } : {}) }; store.put(result);
        };
      };
      tx.oncomplete = () => resolve(result); tx.onerror = tx.onabort = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    });
  }
  async list(scope: VaultClientScope, memoryId: string): Promise<MemoryRecoveryEntry[]> {
    const db = await this.open(), key = memoryPrivateScope(scope);
    return new Promise((resolve, reject) => {
      const request = db.transaction('intents', 'readonly').objectStore('intents').getAll();
      request.onsuccess = () => resolve((request.result as MemoryRecoveryEntry[]).filter(entry => entry.scope === key && entry.memoryId === memoryId));
      request.onerror = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    });
  }
  async close(): Promise<void> { try { (await this.db)?.close(); } catch { /* No live connection. */ } }
}

export async function prepareMemoryReview(client: MemoryVaultClient, recovery: MemoryPublicationRecovery, scope: VaultClientScope,
  candidate: MemoryPublicationCandidate, memberIds: string[]): Promise<VaultMemoryAuthorReview> {
  const compositionDigest = await memoryCompositionDigest(candidate), recipients = [...memberIds].sort();
  const fingerprint = await vaultDigest({ compositionDigest, recipients });
  const intent = await recovery.reserve(scope, candidate.id, 'publication', fingerprint, undefined, candidate.publication?.publicationId ?? null);
  vaultAssert(intent.scope === memoryPrivateScope(scope) && intent.memoryId === candidate.id && intent.fingerprint === fingerprint, 'SCOPE_CHANGED');
  const composition = { ...memoryPublicationProjection(candidate), approvals: candidate.approvals, withdrawn: candidate.withdrawn };
  const review = await client.command({ operation: 'prepare-memory', input: { id: intent.id, candidate: composition,
    expectedRevision: candidate.revision - 1, recipientMemberIds: recipients, sourcePublicationId: intent.publicationSourceId ?? null } }) as VaultMemoryAuthorReview;
  const binding = decodeMemoryPublicationBinding(review.binding);
  vaultAssert(review.id === intent.id && review.digest === binding.publicationDigest && binding.compositionDigest === compositionDigest &&
    await memoryCompositionDigest(review.memory.composition) === compositionDigest && binding.memoryId === candidate.id && binding.memoryRevision === candidate.revision &&
    JSON.stringify([...review.recipientMemberIds].sort()) === JSON.stringify(recipients), 'COMPOSITION_CHANGED');
  return review;
}
export async function copyMemoryMedia(client: MemoryVaultClient, recovery: MemoryPublicationRecovery, scope: VaultClientScope,
  memoryId: string, source: MemoryCopySource): Promise<MemoryPublicationCandidate['media'][number]> {
  const identity = { mediaId: source.mediaId, publicationId: source.publicationId, contentType: source.contentType, sha256: source.sha256, byteLength: source.byteLength };
  const fingerprint = await vaultDigest(identity), intent = await recovery.reserve(scope, memoryId, 'copy', fingerprint, source);
  vaultAssert(intent.scope === memoryPrivateScope(scope) && intent.memoryId === memoryId && intent.fingerprint === fingerprint, 'SCOPE_CHANGED');
  const media = await client.command({ operation: 'copy-media', input: { id: intent.id, sourceMediaId: source.mediaId, sourcePublicationId: source.publicationId } }) as VaultMedia;
  vaultAssert(media.id === intent.id && media.status === 'uploaded' && media.sha256 === source.sha256 &&
    media.byteLength === source.byteLength && media.contentType === source.contentType, 'INVALID_UPLOAD_RECEIPT');
  // No private source publication, auth subject, URL or capability crosses this boundary.
  return { version: 1, contentId: media.id, revision: 1, kind: media.contentType.startsWith('image/') ? 'image' : 'audio', alt: source.alt };
}
export async function approveMemoryReview(client: MemoryVaultClient, review: VaultMemoryAuthorReview,
  keep: (binding: MemoryPublicationBinding) => Promise<boolean>): Promise<void> {
  await client.command({ operation: 'approve', id: review.id, digest: review.digest });
  vaultAssert(await keep(review.binding), 'MEMORY_KEEP_UNCERTAIN');
}
export async function activateMemoryReview(client: MemoryVaultClient, review: VaultMemoryAuthorReview): Promise<VaultPublicationReceipt> {
  const receipt = await client.command({ operation: 'activate', id: review.id }) as VaultPublicationReceipt;
  vaultAssert(receipt.publicationId === review.id && receipt.digest === review.digest && receipt.state === 'active' &&
    JSON.stringify(decodeMemoryPublicationBinding(receipt.memory)) === JSON.stringify(review.binding), 'INVALID_PUBLICATION_RECEIPT');
  return receipt;
}
export async function withdrawMemoryReview(client: MemoryVaultClient, binding: MemoryPublicationBinding,
  withdraw: (binding: MemoryPublicationBinding) => Promise<boolean>): Promise<void> {
  const receipt = await client.command({ operation: 'withdraw', id: binding.publicationId }) as VaultPublicationReceipt;
  vaultAssert(receipt.publicationId === binding.publicationId && receipt.digest === binding.publicationDigest && receipt.state === 'revoked', 'INVALID_PUBLICATION_RECEIPT');
  vaultAssert(await withdraw(binding), 'MEMORY_WITHDRAW_UNCERTAIN');
}
