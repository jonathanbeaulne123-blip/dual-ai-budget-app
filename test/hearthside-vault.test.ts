import { describe, expect, it } from 'vitest';
import { HearthsideVaultStore, type VaultStorage } from '../workers/hearthsideVaultStore.ts';
import { vaultPublicationInput, type VaultPrincipal, type VaultScope } from '../src/hearthside/vaultContracts.ts';

const alice: VaultScope = { environment: 'development', householdId: 'HH-VAULT', memberId: 'MEM-A', subject: 'google-a', expires: 10_000_000 };
const bob: VaultScope = { ...alice, memberId: 'MEM-B', subject: 'google-b' };
const stranger: VaultScope = { ...alice, memberId: 'MEM-C', subject: 'google-c' };
const p = (scope: VaultScope): VaultPrincipal => ({ memberId: scope.memberId, subject: scope.subject });
function fixture() {
  let now = 1000; let records = new Map<string, unknown>();
  const storage: VaultStorage = {
    get: <T>(key: string) => structuredClone(records.get(key)) as T | undefined,
    put: (key, value) => { records.set(key, structuredClone(value)); },
    list: <T>(prefix: string) => [...records.entries()].filter(([key]) => key.startsWith(prefix)).map(([, v]) => structuredClone(v) as T),
    transaction: action => { const before = structuredClone(records); try { return action(); } catch (e) { records = before; throw e; } },
  };
  const store = new HearthsideVaultStore(storage, () => now);
  const draft = () => store.saveDraft(alice, { id: 'draft-one', expectedRevision: 0, content: { title: 'An evening', text: 'Just us', mediaIds: [] } });
  const input = (kind = 'letter', releaseAt: number | null = null) => ({ id: 'pub-one', draftId: 'draft-one', draftRevision: 1, kind, recipientMemberIds: [bob.memberId], releaseAt });
  const prepare = async (kind = 'letter', releaseAt: number | null = null) => {
    draft(); return store.preparePublication(alice, input(kind, releaseAt), { recipients: [p(bob)], approvers: kind === 'shared-memory' || kind === 'guest' ? [p(alice), p(bob)] : [p(alice)] });
  };
  const activate = (id: string, digest: string) => {
    store.approve(alice, id, digest);
    const pub = store.readyForAcceptance(alice, id);
    store.markAccepted(alice, id, { ...store.reference(alice, pub), receiptId: 'receipt-one', acceptedAt: now });
    return store.activate(alice, id);
  };
  return { store, storage, draft, input, prepare, activate, now: (value: number) => { now = value; } };
}
describe('Hearthside private Vault authority', () => {
  it('isolates drafts by both member and authenticated identity, household and environment', () => {
    const f = fixture(); f.draft();
    expect(f.store.listDrafts(bob)).toEqual([]);
    expect(() => f.store.readDraft(bob, 'draft-one')).toThrow('NOT_FOUND');
    expect(() => f.store.readDraft({ ...alice, subject: 'reassigned-account' }, 'draft-one')).toThrow('NOT_FOUND');
    expect(() => f.store.readDraft({ ...alice, householdId: 'HH-OTHER' }, 'draft-one')).toThrow('FORBIDDEN');
    expect(() => f.store.readDraft({ ...alice, environment: 'production' }, 'draft-one')).toThrow('ENVIRONMENT_DISABLED');
    expect(() => f.store.readDraft({ ...alice, expires: 1000 }, 'draft-one')).toThrow('UNAUTHENTICATED');
  });
  it('keeps an uncertain draft retry stable and rejects a competing revision', () => {
    const f = fixture(); expect(f.draft()).toEqual(f.draft());
    expect(() => f.store.saveDraft(alice, { id: 'draft-one', expectedRevision: 0, content: { title: '', text: 'Changed on another device', mediaIds: [] } })).toThrow('DRAFT_CHANGED');
  });
  it('requires uploaded immutable media and denies a partner access to unshared bytes', async () => {
    const f = fixture();
    f.store.prepareMedia(alice, { id: 'media-one', byteLength: 10, sha256: 'a'.repeat(64), contentType: 'audio/ogg' });
    f.store.saveDraft(alice, { id: 'draft-one', expectedRevision: 0, content: { title: '', text: '', mediaIds: ['media-one'] } });
    await expect(f.store.preparePublication(alice, f.input(), { recipients: [p(bob)], approvers: [p(alice)] })).rejects.toThrow('MEDIA_PENDING');
    expect(() => f.store.readMedia(bob, 'media-one', null)).toThrow('NOT_FOUND');
    expect(() => f.store.completeMedia(alice, 'media-one', 'b'.repeat(64), 10)).toThrow('MEDIA_BYTES_CHANGED');
    const receipt = f.store.completeMedia(alice, 'media-one', 'a'.repeat(64), 10);
    expect(f.store.completeMedia(alice, 'media-one', 'a'.repeat(64), 10)).toEqual(receipt);
    expect(() => f.store.prepareMedia(alice, { id: 'media-one', byteLength: 11, sha256: 'a'.repeat(64), contentType: 'audio/ogg' })).toThrow('MEDIA_ID_REUSED');
  });
  it('does not grant recipients access until exact approval, durable acceptance and activation', async () => {
    const f = fixture(), publication = await f.prepare();
    expect(() => f.store.readPublication(bob, publication.id)).toThrow('NOT_FOUND');
    expect(() => f.store.readyForAcceptance(alice, publication.id)).toThrow('APPROVAL_REQUIRED');
    expect(() => f.store.approve(alice, publication.id, 'wrong')).toThrow('COMPOSITION_CHANGED');
    f.store.approve(alice, publication.id, publication.digest);
    expect(() => f.store.activate(alice, publication.id)).toThrow('ACCEPTANCE_REQUIRED');
    f.activate(publication.id, publication.digest);
    expect(f.store.readPublication(bob, publication.id).content.text).toBe('Just us');
    expect(() => f.store.readPublication(stranger, publication.id)).toThrow('NOT_FOUND');
    expect(() => f.store.readPublication({ ...bob, subject: 'changed-account' }, publication.id)).toThrow('NOT_FOUND');
  });
  it('requires both people to approve the exact shared memory composition', async () => {
    const f = fixture(), publication = await f.prepare('shared-memory');
    f.store.approve(alice, publication.id, publication.digest);
    expect(() => f.store.readyForAcceptance(alice, publication.id)).toThrow('APPROVAL_REQUIRED');
    f.store.approve(bob, publication.id, publication.digest);
    f.activate(publication.id, publication.digest);
    f.store.saveDraft(alice, { id: 'draft-one', expectedRevision: 1, content: { title: 'Changed caption', text: 'A new memory', mediaIds: [] } });
    const revised = await f.store.preparePublication(alice, { ...f.input('shared-memory'), id: 'pub-two', draftRevision: 2 }, { recipients: [p(bob)], approvers: [p(alice), p(bob)] });
    expect(revised.approvals).toEqual([]); expect(revised.digest).not.toBe(publication.digest);
    expect(f.store.readPublication(bob, publication.id).content.text).toBe('Just us');
  });
  it('cannot omit the partner from a shared memory or guest approval policy', async () => {
    const f = fixture(); f.draft();
    await expect(f.store.preparePublication(alice, f.input('guest'), { recipients: [p(bob)], approvers: [p(alice)] })).rejects.toThrow('MUTUAL_APPROVAL_REQUIRED');
  });
  it('enforces sealed release with server time even for the sender', async () => {
    const f = fixture(), pub = await f.prepare('capsule', 2000); f.activate(pub.id, pub.digest);
    expect(() => f.store.readPublication(bob, pub.id)).toThrow('SEALED');
    expect(() => f.store.readPublication(alice, pub.id)).toThrow('SEALED');
    f.now(1999); expect(() => f.store.readPublication(bob, pub.id)).toThrow('SEALED');
    f.now(2000); expect(f.store.readPublication(bob, pub.id).content.text).toBe('Just us');
    expect(() => vaultPublicationInput({ ...f.input('capsule', 2000), now: 2001 })).toThrow('INVALID_INPUT');
  });
  it('retains publication identity across prepare, acceptance and activation retries', async () => {
    const f = fixture(), pub = await f.prepare();
    const first = f.activate(pub.id, pub.digest);
    f.now(1500);
    expect(await f.store.preparePublication(alice, f.input(), { recipients: [p(bob)], approvers: [p(alice)] })).toMatchObject({ id: pub.id, digest: pub.digest, state: 'active' });
    expect(f.store.activate(alice, pub.id)).toEqual(first);
    expect(f.store.listReceipts(alice)).toHaveLength(1);
    await expect(f.store.preparePublication(alice, { ...f.input(), recipientMemberIds: [stranger.memberId] }, { recipients: [p(stranger)], approvers: [p(alice)] })).rejects.toThrow('PUBLICATION_ID_REUSED');
  });
  it('rejects mismatched acceptance receipts and never resurrects revoked publications', async () => {
    const f = fixture(), pub = await f.prepare(); f.store.approve(alice, pub.id, pub.digest);
    const reference = f.store.reference(alice, pub);
    expect(() => f.store.markAccepted(alice, pub.id, { ...reference, digest: 'forged', receiptId: 'receipt-one', acceptedAt: 1000 })).toThrow('INVALID_ACCEPTANCE');
    f.store.withdraw(alice, pub.id);
    expect(() => f.store.markAccepted(alice, pub.id, { ...reference, receiptId: 'receipt-one', acceptedAt: 1000 })).toThrow('PUBLICATION_REVOKED');
    expect(() => f.store.activate(alice, pub.id)).toThrow('PUBLICATION_REVOKED');
    expect(() => f.store.readPublication(bob, pub.id)).toThrow('NOT_FOUND');
  });
  it('lets either shared approver withdraw and keeps the revocation through restart', async () => {
    const f = fixture(), pub = await f.prepare('shared-memory');
    f.store.approve(bob, pub.id, pub.digest); f.activate(pub.id, pub.digest);
    f.store.withdraw(bob, pub.id);
    const restarted = new HearthsideVaultStore(f.storage, () => 1100);
    expect(() => restarted.readPublication(alice, pub.id)).toThrow('NOT_FOUND');
    expect(restarted.listReceipts(alice)[0]?.state).toBe('revoked');
  });
  it('does not include content, audience or media capabilities in household publication receipts', async () => {
    const f = fixture(), pub = await f.prepare(); f.activate(pub.id, pub.digest);
    const serialized = JSON.stringify(f.store.listReceipts(alice));
    for (const forbidden of ['Just us', 'google-a', 'google-b', 'mediaIds', 'draft-one', 'https:', 'Bearer']) expect(serialized).not.toContain(forbidden);
  });
  it('refuses cleanup until all private and live publication references are removed', async () => {
    const f = fixture();
    f.store.prepareMedia(alice, { id: 'photo', byteLength: 10, sha256: 'a'.repeat(64), contentType: 'image/jpeg' });
    f.store.completeMedia(alice, 'photo', 'a'.repeat(64), 10);
    f.store.saveDraft(alice, { id: 'draft-one', expectedRevision: 0, content: { title: '', text: '', mediaIds: ['photo'] } });
    const pub = await f.store.preparePublication(alice, f.input(), { recipients: [p(bob)], approvers: [p(alice)] });
    f.activate(pub.id, pub.digest);
    f.store.saveDraft(alice, { id: 'draft-one', expectedRevision: 1, content: { title: '', text: '', mediaIds: [] } });
    expect(() => f.store.cleanupCandidate(alice, 'photo')).toThrow('MEDIA_REFERENCED');
    f.store.withdraw(alice, pub.id); f.store.tombstoneMedia(alice, 'photo');
    expect(() => f.store.readMedia(alice, 'photo', null)).toThrow('MEDIA_UNAVAILABLE');
    expect(() => f.store.completeMedia(alice, 'photo', 'a'.repeat(64), 10)).toThrow('MEDIA_UNAVAILABLE');
  });
  it('rechecks draft version after digest work before preparing its immutable copy', async () => {
    const f = fixture(); f.draft();
    const pending = f.store.preparePublication(alice, f.input(), { recipients: [p(bob)], approvers: [p(alice)] });
    f.store.saveDraft(alice, { id: 'draft-one', expectedRevision: 1, content: { title: '', text: 'Steered', mediaIds: [] } });
    await expect(pending).rejects.toThrow('DRAFT_CHANGED');
  });
  it('deleting a private source preserves its deliberate shared copy and fences old draft retries', async () => {
    const f = fixture(), pub = await f.prepare(); f.activate(pub.id, pub.digest);
    f.store.deleteDraft(alice, { id: 'draft-one', expectedRevision: 1 });
    expect(f.store.listDrafts(alice)).toEqual([]);
    expect(() => f.store.readDraft(alice, 'draft-one')).toThrow('NOT_FOUND');
    expect(() => f.draft()).toThrow('DRAFT_REMOVED');
    expect(f.store.readPublication(bob, pub.id).content.text).toBe('Just us');
    f.store.withdraw(alice, pub.id);
    expect(() => f.store.readPublication(bob, pub.id)).toThrow('NOT_FOUND');
  });
});
