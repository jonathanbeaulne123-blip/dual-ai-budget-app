import { expect, it, vi } from 'vitest';
import type { VaultClientScope } from '../src/hearthside/vaultClient.ts';
import { memoryCompositionDigest, type MemoryPublicationCandidate, type VaultMemoryAuthorReview } from '../src/hearthside/memoryPublication.ts';
import { activateMemoryReview, approveMemoryReview, copyMemoryMedia, memoryPrivateScope, prepareMemoryReview, withdrawMemoryReview,
  type MemoryCopySource, type MemoryPublicationRecovery, type MemoryRecoveryEntry, type MemoryVaultClient } from '../src/hearthside/memoryPublicationClient.ts';
const scope: VaultClientScope = { environment: 'development', householdId: 'HH-MEMORY', memberId: 'MEM-A', subject: 'alice' };
const memory = (): MemoryPublicationCandidate => ({ version: 1, id: 'memory', revision: 1, title: 'Our own ordinary day', date: null, experienceId: null,
  media: [{ version: 1, contentId: 'photo', revision: 1, kind: 'image', alt: 'A day we chose to keep' }], designs: [], recollections: [{ memberId: 'MEM-A', text: 'My words' }], hideAmounts: true, approvals: [], withdrawn: false });
function fixture() {
  const records = new Map<string, MemoryRecoveryEntry>(); let next = 0;
  const recovery: MemoryPublicationRecovery = {
    reserve: async (scope, memoryId, kind, fingerprint, source, publicationSourceId) => {
      const key = JSON.stringify([memoryPrivateScope(scope), memoryId, kind, fingerprint]);
      if (!records.has(key)) records.set(key, { key, scope: memoryPrivateScope(scope), memoryId, kind, fingerprint, id: `intent-${++next}`, source, publicationSourceId });
      return records.get(key)!;
    }, list: async (scope, memoryId) => [...records.values()].filter(r => r.scope === memoryPrivateScope(scope) && r.memoryId === memoryId),
  };
  const client: MemoryVaultClient = { command: vi.fn(), snapshot: vi.fn(), media: vi.fn(), queueMedia: vi.fn(), resumeUploads: vi.fn() };
  return { records, recovery, client };
}
it('reserves a durable identity before preparation and preserves the original source across a lost compose acknowledgement', async () => {
  const f = fixture(), value = memory(), compositionDigest = await memoryCompositionDigest(value), calls: unknown[] = [];
  let lose = true;
  f.client.command = vi.fn(async input => {
    expect(f.records.size).toBe(1); const v = input as { input: { id: string; candidate: MemoryPublicationCandidate; sourcePublicationId: string | null } }; calls.push(v.input);
    if (lose) { lose = false; throw Error('Lost prepare reply'); }
    return { version: 1, id: v.input.id, digest: 'a'.repeat(64), recipientMemberIds: ['MEM-A', 'MEM-B'],
      memory: { composition: v.input.candidate, compositionDigest, expectedRevision: 0 },
      binding: { version: 1, publicationId: v.input.id, publicationDigest: 'a'.repeat(64), memoryId: value.id, memoryRevision: 1, compositionDigest } };
  });
  await expect(prepareMemoryReview(f.client, f.recovery, scope, value, ['MEM-A', 'MEM-B'])).rejects.toThrow('Lost prepare reply');
  const first = await prepareMemoryReview(f.client, f.recovery, scope, value, ['MEM-A', 'MEM-B']);
  await prepareMemoryReview(f.client, f.recovery, scope, { ...value, publication: first.binding }, ['MEM-A', 'MEM-B']);
  expect(calls.map(v => (v as { id: string }).id)).toEqual(['intent-1', 'intent-1', 'intent-1']);
  expect(calls.map(v => (v as { sourcePublicationId: unknown }).sourcePublicationId)).toEqual([null, null, null]);
  expect(calls.every(v => !('publication' in (v as { candidate: object }).candidate))).toBe(true);
  const denied: MemoryPublicationRecovery = { reserve: async () => { throw Error('PRIVATE_STORAGE_UNAVAILABLE'); }, list: async () => [] };
  vi.mocked(f.client.command).mockClear();
  await expect(prepareMemoryReview(f.client, denied, scope, value, ['MEM-A', 'MEM-B'])).rejects.toThrow('PRIVATE_STORAGE_UNAVAILABLE');
  expect(f.client.command).not.toHaveBeenCalled();
});
it('keeps copy retries stable when a caption changes and never adds private source lineage to a shared media reference', async () => {
  const f = fixture(), source: MemoryCopySource = { mediaId: 'private-photo', publicationId: 'recipient-only-letter', contentType: 'image/jpeg', sha256: 'b'.repeat(64), byteLength: 100, alt: 'Our chosen photo' };
  const ids: string[] = []; let lose = true;
  f.client.command = async input => {
    const { id } = (input as { input: { id: string } }).input; ids.push(id);
    if (lose) { lose = false; throw Error('Lost copy reply'); }
    return { id, status: 'uploaded', sha256: source.sha256, byteLength: source.byteLength, contentType: source.contentType,
      owner: { memberId: scope.memberId, subject: scope.subject }, copySource: { publicationId: source.publicationId, mediaId: source.mediaId } };
  };
  await expect(copyMemoryMedia(f.client, f.recovery, scope, 'memory', source)).rejects.toThrow('Lost copy reply');
  const copy = await copyMemoryMedia(f.client, f.recovery, scope, 'memory', { ...source, alt: 'My revised caption' });
  expect(ids).toEqual(['intent-1', 'intent-1']); expect(copy).toEqual({ version: 1, contentId: 'intent-1', revision: 1, kind: 'image', alt: 'My revised caption' });
  expect(JSON.stringify(copy)).not.toContain('recipient-only-letter'); expect(JSON.stringify(copy)).not.toContain('alice');
  await copyMemoryMedia(f.client, f.recovery, { ...scope, subject: 'replacement-alice' }, 'memory', source);
  expect(ids[2]).toBe('intent-2');
});
it('orders exact approval before canonical keeping, preserves retry identity and revokes before shared withdrawal', async () => {
  const f = fixture(), value = memory(), digest = await memoryCompositionDigest(value);
  const review = { version: 1, id: 'pub', ownerMemberId: scope.memberId, recipientMemberIds: ['MEM-A', 'MEM-B'], digest: 'c'.repeat(64), state: 'prepared',
    binding: { version: 1, publicationId: 'pub', publicationDigest: 'c'.repeat(64), memoryId: value.id, memoryRevision: 1, compositionDigest: digest },
    memory: { composition: value, compositionDigest: digest, expectedRevision: 0 }, media: [], approvedMemberIds: [] } satisfies VaultMemoryAuthorReview;
  const order: string[] = [];
  f.client.command = async raw => {
    const input = raw as { operation: string; id: string; digest?: string }; order.push(input.operation);
    expect(input.id).toBe(review.id);
    if (input.operation === 'approve') expect(input.digest).toBe(review.digest);
    return { version: 1, publicationId: review.id, digest: review.digest, memory: review.binding, state: input.operation === 'withdraw' ? 'revoked' : 'active' };
  };
  await expect(approveMemoryReview(f.client, review, async () => { order.push('keep'); return false; })).rejects.toThrow('MEMORY_KEEP_UNCERTAIN');
  await approveMemoryReview(f.client, review, async () => { order.push('keep'); return true; });
  await activateMemoryReview(f.client, review);
  await expect(withdrawMemoryReview(f.client, review.binding, async () => { order.push('withdraw-canonical'); return false; })).rejects.toThrow('MEMORY_WITHDRAW_UNCERTAIN');
  expect(order).toEqual(['approve', 'keep', 'approve', 'keep', 'activate', 'withdraw', 'withdraw-canonical']);
});
