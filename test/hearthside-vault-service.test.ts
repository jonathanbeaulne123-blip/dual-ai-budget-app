import { expect, it, vi } from 'vitest';
import type { DurableObjectId } from '@cloudflare/workers-types';
vi.mock('cloudflare:workers', () => ({ DurableObject: class {} }));
vi.mock('../workers/ledgerSyncAuth.ts', () => ({ authorizeRequest: vi.fn() }));
import { authorizeRequest } from '../workers/ledgerSyncAuth.ts';
import { HearthsideVault, handleHearthsideVault, validateMediaSignature, vaultBoundedBody, type HearthsideVaultEnv, type VaultPublicationAuthority } from '../workers/hearthsideVault.ts';
import { HearthsideVaultStore, type VaultStorage } from '../workers/hearthsideVaultStore.ts';
import type { Scope } from '../src/ledgerSync/protocol.ts';
import type { VaultAcceptance, VaultAudiencePolicy } from '../src/hearthside/vaultContracts.ts';

const scope: Scope = { environment: 'development', householdId: 'HH-VAULT', memberId: 'MEM-A', subject: 'google-a', role: 'owner', expires: Date.now() + 100000, aclEpoch: 1 };
const bob: Scope = { ...scope, memberId: 'MEM-B', subject: 'google-b' };
const policy: VaultAudiencePolicy = { recipients: [{ memberId: bob.memberId, subject: bob.subject }], approvers: [{ memberId: scope.memberId, subject: scope.subject }] };
async function fixture(authority: VaultPublicationAuthority) {
  const values = new Map<string, unknown>();
  const storage: VaultStorage = {
    get: <T>(key: string) => structuredClone(values.get(key)) as T | undefined,
    put: (key, value) => { values.set(key, structuredClone(value)); },
    list: <T>(prefix: string) => [...values].filter(([key]) => key.startsWith(prefix)).map(([, value]) => structuredClone(value) as T),
    transaction: action => action(),
  };
  const store = new HearthsideVaultStore(storage);
  const service = Object.create(HearthsideVault.prototype) as HearthsideVault;
  Object.defineProperties(service, { store: { value: store }, archive: { value: { ready: async () => {}, flush: async () => {} } }, env: { value: { HEARTHSIDE_VAULT_AUTHORITY: authority } } });
  await service.commandFor(scope, { operation: 'save-draft', input: { id: 'draft', expectedRevision: 0, content: { title: 'For you', text: 'Private words', mediaIds: [] } } }, true);
  const publication = await store.preparePublication(scope, { id: 'publication', draftId: 'draft', draftRevision: 1, kind: 'letter', recipientMemberIds: [bob.memberId], releaseAt: null }, policy);
  store.approve(scope, publication.id, publication.digest);
  return { service, store, publication };
}
it('recovers the same canonical acceptance after a lost response without premature disclosure', async () => {
  let receipt: VaultAcceptance | null = null, accepts = 0;
  const f = await fixture({ policy: async () => policy, isReferenced: async () => false, accept: async (_s, reference) => {
    if (!receipt) { receipt = { ...reference, receiptId: 'receipt', acceptedAt: Date.now() }; accepts++; throw new Error('Response lost'); }
    return receipt;
  } });
  await expect(f.service.commandFor(scope, { operation: 'activate', id: 'publication' }, true)).rejects.toThrow('Response lost');
  expect(() => f.store.readPublication(bob, 'publication')).toThrow('NOT_FOUND');
  await f.service.commandFor(scope, { operation: 'activate', id: 'publication' }, true);
  expect(accepts).toBe(1);
  const disclosed = await f.service.commandFor(bob, { operation: 'read-publication', id: 'publication' }, false);
  const serialized = JSON.stringify(disclosed);
  expect(serialized).toContain('Private words');
  for (const field of ['draftId', 'subject', 'approvers', 'acceptance']) expect(serialized).not.toContain(field);
});
it('keeps authenticated principal bindings out of author prepare and recovery responses', async () => {
  const f = await fixture({ policy: async () => policy, isReferenced: async () => false, accept: vi.fn() });
  for (const result of [
    await f.service.commandFor(scope, { operation: 'prepare-publication', input: { id: 'second', draftId: 'draft', draftRevision: 1, kind: 'letter', recipientMemberIds: [bob.memberId], releaseAt: null } }, true),
    await f.service.commandFor(scope, { operation: 'resume-publication', id: 'publication' }, false),
  ]) {
    expect(result).toMatchObject({ content: { text: 'Private words' }, recipientMemberIds: [bob.memberId], ownerMemberId: scope.memberId });
    const encoded = JSON.stringify(result);
    for (const secret of ['subject', scope.subject, bob.subject, 'approvers', 'approvals']) expect(encoded).not.toContain(secret);
  }
  await expect(f.service.commandFor(bob, { operation: 'resume-publication', id: 'publication' }, false)).rejects.toThrow('NOT_FOUND');
});
it('does not reactivate content withdrawn while canonical acceptance was in flight', async () => {
  let finish!: (value: VaultAcceptance) => void;
  let started!: () => void;
  const pending = new Promise<void>(resolve => { started = resolve; });
  const f = await fixture({ policy: async () => policy, isReferenced: async () => false, accept: async (_s, ref) => {
    started(); return new Promise<VaultAcceptance>(resolve => { finish = () => resolve({ ...ref, receiptId: 'receipt', acceptedAt: Date.now() }); });
  } });
  const activation = f.service.commandFor(scope, { operation: 'activate', id: 'publication' }, true);
  await pending;
  await f.service.commandFor(scope, { operation: 'withdraw', id: 'publication' }, false);
  finish({ ...f.store.reference(scope, f.publication), receiptId: 'receipt', acceptedAt: Date.now() });
  await expect(activation).rejects.toThrow('PUBLICATION_REVOKED');
  expect(() => f.store.readPublication(bob, 'publication')).toThrow('NOT_FOUND');
});
it('rechecks current membership identity before accepting a prepared audience', async () => {
  const accept = vi.fn();
  const f = await fixture({ policy: async () => ({ ...policy, recipients: [{ ...policy.recipients[0]!, subject: 'replaced-subject' }] }), isReferenced: async () => false, accept });
  await expect(f.service.commandFor(scope, { operation: 'activate', id: 'publication' }, true)).rejects.toThrow('AUDIENCE_CHANGED');
  expect(accept).not.toHaveBeenCalled();
});
it('keeps an accepted reference sealed when the roster changes during acceptance, then recovers without another receipt', async () => {
  let changed = false;
  const policyCall = vi.fn(async () => changed ? { ...policy, recipients: [{ ...policy.recipients[0]!, subject: 'replacement' }] } : policy);
  const accept = vi.fn(async (_scope: Scope, ref: VaultAcceptance | Omit<VaultAcceptance, 'acceptedAt' | 'receiptId'>) => {
    changed = true; return { ...ref, receiptId: 'one-receipt', acceptedAt: Date.now() };
  });
  const f = await fixture({ policy: policyCall, accept, isReferenced: async () => false });
  await expect(f.service.commandFor(scope, { operation: 'activate', id: 'publication' }, true, 'transient-request-token')).rejects.toThrow('AUDIENCE_CHANGED');
  expect(f.store.resumeReview(scope, 'publication').state).toBe('accepted');
  expect(() => f.store.readPublication(bob, 'publication')).toThrow('NOT_FOUND');
  expect(JSON.stringify(f.store.resumeReview(scope, 'publication'))).not.toContain('transient-request-token');
  expect(policyCall).toHaveBeenCalledTimes(2);
  expect(policyCall).toHaveBeenLastCalledWith(scope, expect.objectContaining({ id: 'publication' }), 'transient-request-token');
  changed = false;
  await expect(f.service.commandFor(scope, { operation: 'activate', id: 'publication' }, true, 'fresh-request-token')).resolves.toMatchObject({ state: 'active', acceptedReceiptId: 'one-receipt' });
  expect(accept).toHaveBeenCalledTimes(1);
});
it('keeps withdrawal available while new publication is disabled', async () => {
  const f = await fixture({ policy: async () => policy, isReferenced: async () => false, accept: async (_s, ref) => ({ ...ref, receiptId: 'receipt', acceptedAt: Date.now() }) });
  await expect(f.service.commandFor(scope, { operation: 'activate', id: 'publication' }, false)).rejects.toThrow('PUBLICATION_DISABLED');
  expect(await f.service.commandFor(scope, { operation: 'withdraw', id: 'publication' }, false)).toMatchObject({ state: 'revoked' });
});
it('authenticates the exact requested scope and refuses stale UI identity headers', async () => {
  const snapshotFor = vi.fn(async () => ({ version: 1, drafts: [], publications: [], mail: [], serverTime: Date.now() }));
  const env: HearthsideVaultEnv = { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', HEARTHSIDE_VAULT_ENABLED: 'true',
    HEARTHSIDE_VAULTS: { idFromName: () => ({}) as DurableObjectId, get: () => ({ snapshotFor, commandFor: vi.fn(), uploadFor: vi.fn(), mediaFor: vi.fn() }) } };
  vi.mocked(authorizeRequest).mockResolvedValue({ scope, token: 'synthetic' });
  const response = await handleHearthsideVault(new Request('https://example.test/api/hearthside-vault/development/HH-VAULT', { headers: { 'X-Vault-Actor': scope.memberId, 'X-Vault-Identity': 'other-google-account' } }), env);
  expect(response?.status).toBe(403); expect(snapshotFor).not.toHaveBeenCalled();
  expect(authorizeRequest).toHaveBeenLastCalledWith(expect.any(Request), env, 'development', 'HH-VAULT');
});
it('fails closed without activation and rejects capability query strings', async () => {
  const env: HearthsideVaultEnv = { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' };
  expect((await handleHearthsideVault(new Request('https://example.test/api/hearthside-vault/development/HH-VAULT'), env))?.status).toBe(503);
  expect((await handleHearthsideVault(new Request('https://example.test/api/hearthside-vault/development/HH-VAULT?token=anything'), env))?.status).toBe(400);
});
it('forwards the fresh bearer token only on the internal command RPC, never its response', async () => {
  const receipt = { version: 1 as const, publicationId: 'publication', digest: 'a'.repeat(64), kind: 'letter' as const,
    environment: scope.environment, householdId: scope.householdId, state: 'active' as const,
    acceptedReceiptId: 'receipt', preparedAt: 1, activatedAt: 2, revokedAt: null };
  const commandFor = vi.fn(async () => receipt);
  const env: HearthsideVaultEnv = { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', HEARTHSIDE_VAULT_ENABLED: 'true', HEARTHSIDE_VAULT_PUBLICATION: 'true',
    HEARTHSIDE_VAULTS: { idFromName: () => ({}) as DurableObjectId, get: () => ({ snapshotFor: vi.fn(), commandFor, uploadFor: vi.fn(), mediaFor: vi.fn() }) } };
  vi.mocked(authorizeRequest).mockResolvedValue({ scope, token: 'transient-request-token' });
  const input = { operation: 'activate', id: 'publication' };
  const response = await handleHearthsideVault(new Request('https://example.test/api/hearthside-vault/development/HH-VAULT', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vault-Actor': scope.memberId, 'X-Vault-Identity': scope.subject }, body: JSON.stringify(input),
  }), env);
  expect(commandFor).toHaveBeenCalledWith(scope, input, true, 'transient-request-token');
  expect(await response?.json()).toEqual(receipt);
});
it('bounds streamed uploads even when Content-Length is missing', async () => {
  const request = new Request('https://example.test', { method: 'POST', body: new Uint8Array(20) });
  await expect(vaultBoundedBody(request, 10)).rejects.toThrow('INPUT_TOO_LARGE');
  expect(() => validateMediaSignature(new TextEncoder().encode('<html>bad</html>'), 'image/jpeg')).toThrow('INVALID_MEDIA_BYTES');
});
