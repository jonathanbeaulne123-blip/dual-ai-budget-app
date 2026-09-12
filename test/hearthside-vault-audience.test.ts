import { expect, it, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import type { Scope } from '../src/ledgerSync/protocol.ts';
import type { VaultPublicationInput } from '../src/hearthside/vaultContracts.ts';
import { createVaultPublicationAuthority, resolveVaultAudience, vaultAudienceRequest, type VaultAudienceEnv } from '../workers/hearthsideVaultAudience.ts';
const time = 1_900_000_000_000, token = 'synthetic.user.jwt';
const scope: Scope = { environment: 'development', householdId: 'HH-AUDIENCE', memberId: 'MEM-A',
  subject: '11111111-1111-4111-a111-111111111111', role: 'owner', expires: time + 60_000, aclEpoch: 1 };
const bob = { memberId: 'MEM-B', subject: '22222222-2222-4222-a222-222222222222' };
const alice = { memberId: scope.memberId, subject: scope.subject };
const env: VaultAudienceEnv = { SUPABASE_URL: 'https://synthetic.supabase.test', SUPABASE_PUBLISHABLE_KEY: 'synthetic-public',
  HEARTHSIDE_VAULT_AUTHORITY_KEY_ID: 'synthetic-key', HEARTHSIDE_VAULT_AUTHORITY_KEY: '12'.repeat(32) };
const input: VaultPublicationInput = { id: 'publication', draftId: 'draft', draftRevision: 1, kind: 'letter', recipientMemberIds: [bob.memberId], releaseAt: null };
const result = (principals = [alice, bob]) => ({ version: 1, environment: scope.environment, householdId: scope.householdId,
  memberId: scope.memberId, subject: scope.subject, checkedAt: time, principals });
const options = (body: unknown = result()) => ({ now: () => time, fetch: vi.fn<typeof fetch>(async () => Response.json(body)) });
it('binds the server MAC to the exact token, identity, household and timestamp', async () => {
  const request = await vaultAudienceRequest(env, scope, token, time);
  const digest = createHash('sha256').update(token).digest('hex');
  const material = ['hearthside-vault-audience-v1', 'synthetic-key', 'development', 'HH-AUDIENCE', scope.memberId, scope.subject, String(time / 1000), digest].join('\n');
  expect(request.p_signature).toBe(createHmac('sha256', Buffer.from(env.HEARTHSIDE_VAULT_AUTHORITY_KEY!, 'hex')).update(material).digest('hex'));
  expect(JSON.stringify(request)).not.toContain(token);
  expect((await vaultAudienceRequest(env, scope, 'changed.jwt', time)).p_signature).not.toBe(request.p_signature);
  expect((await vaultAudienceRequest(env, { ...scope, householdId: 'HH-OTHER' }, token, time)).p_signature).not.toBe(request.p_signature);
});
it('resolves only the explicit recipient and author, without caching canonical bindings', async () => {
  const opts = options();
  const policy = await resolveVaultAudience(env, scope, input, token, opts);
  expect(policy).toEqual({ recipients: [bob], approvers: [alice] });
  const fetchCall = opts.fetch.mock.calls[0]!;
  expect(String(fetchCall[0])).toBe('https://synthetic.supabase.test/rest/v1/rpc/hearthside_vault_audience');
  expect(fetchCall[1]).toMatchObject({ redirect: 'manual', headers: { Authorization: `Bearer ${token}`, apikey: 'synthetic-public' } });
  expect(JSON.stringify(policy)).not.toContain(token);
  opts.fetch.mockImplementation(async () => Response.json(result([alice])));
  await expect(resolveVaultAudience(env, scope, input, token, opts)).rejects.toThrow('AUDIENCE_CHANGED');
  expect(opts.fetch).toHaveBeenCalledTimes(2);
});
it('requires every current bound household author for a joint memory, with no display-name inference', async () => {
  const policy = await resolveVaultAudience(env, scope, { ...input, kind: 'shared-memory' }, token, options());
  expect(policy.approvers).toEqual([alice, bob]);
  await expect(resolveVaultAudience(env, scope, { ...input, kind: 'shared-memory', recipientMemberIds: [alice.memberId] }, token, options(result([alice])))).rejects.toThrow('MUTUAL_APPROVAL_REQUIRED');
  await expect(resolveVaultAudience(env, scope, input, token, options(result([{ ...alice }, { ...bob, subject: alice.subject }])))).rejects.toThrow('AUDIENCE_CHANGED');
});
it('denies guest publication without an independent recipient grant resolver', async () => {
  await expect(resolveVaultAudience(env, scope, { ...input, kind: 'guest' }, token, options())).rejects.toThrow('GUEST_AUTHORITY_REQUIRED');
  const guest = { memberId: 'GUEST-A', subject: '33333333-3333-4333-a333-333333333333' };
  const policy = await resolveVaultAudience(env, scope, { ...input, kind: 'guest', recipientMemberIds: [guest.memberId] }, token,
    { ...options(), guestRecipients: async () => [guest] });
  expect(policy).toEqual({ recipients: [guest], approvers: [alice, bob] });
});
it('rejects stale or mismatched responses, expired scope and missing configuration', async () => {
  for (const body of [{ ...result(), subject: bob.subject }, { ...result(), householdId: 'HH-OTHER' }, { ...result(), checkedAt: time - 31_000 }]) {
    await expect(resolveVaultAudience(env, scope, input, token, options(body))).rejects.toThrow('AUDIENCE_CHANGED');
  }
  await expect(resolveVaultAudience(env, { ...scope, expires: time }, input, token, options())).rejects.toThrow('UNAUTHENTICATED');
  await expect(resolveVaultAudience({ ...env, HEARTHSIDE_VAULT_AUTHORITY_KEY: undefined }, scope, input, token, options())).rejects.toThrow('PUBLICATION_DISABLED');
  await expect(resolveVaultAudience(env, { ...scope, environment: 'production' }, input, token, options())).rejects.toThrow('ENVIRONMENT_DISABLED');
});
it('bounds responses and suppresses upstream errors, headers and credential details', async () => {
  const redirected = vi.fn(async () => new Response('Redirect refused', { status: 302, headers: { Location: 'https://different.invalid/' } }));
  await expect(resolveVaultAudience(env, scope, input, token, { now: () => time, fetch: redirected })).rejects.toThrow('VAULT_AUTHORITY_UNAVAILABLE');
  expect(redirected).toHaveBeenCalledTimes(1);
  await expect(resolveVaultAudience(env, scope, input, token, { now: () => time, fetch: vi.fn(async () => new Response('x'.repeat(16_385))) })).rejects.toThrow('VAULT_AUTHORITY_UNAVAILABLE');
  await expect(resolveVaultAudience(env, scope, input, token, { now: () => time, fetch: vi.fn(async () => { throw new Error(`secret ${token}`); }) })).rejects.toThrow(/^VAULT_AUTHORITY_UNAVAILABLE$/);
  await expect(resolveVaultAudience(env, scope, input, token, { now: () => time, fetch: vi.fn(async () => new Response(`secret ${token}`, { status: 403 })) })).rejects.toThrow(/^UNAUTHENTICATED$/);
});
it('delegates immutable receipt acceptance to the real writer without a local fallback', async () => {
  const reference = { version: 1 as const, publicationId: input.id, digest: 'a'.repeat(64), kind: input.kind, environment: scope.environment, householdId: scope.householdId };
  const accepted = { ...reference, receiptId: 'canonical-receipt', acceptedAt: time };
  const writer = { accept: vi.fn(async () => accepted), isReferenced: vi.fn(async () => true) };
  const adapter = createVaultPublicationAuthority(env, writer, options());
  expect(await adapter.accept(scope, reference, token)).toEqual(accepted);
  expect(writer.accept).toHaveBeenCalledWith(scope, reference, token);
  await expect(adapter.accept(scope, reference)).rejects.toThrow('UNAUTHENTICATED');
  expect(await adapter.isReferenced(scope, 'media')).toBe(true);
});
