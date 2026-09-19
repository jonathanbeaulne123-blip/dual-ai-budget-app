import type { Scope } from '../src/ledgerSync/protocol.ts';
import {
  vaultAssert, vaultId, vaultObject, vaultPrincipals, vaultPublicationInput,
  type VaultAcceptance, type VaultAudiencePolicy, type VaultPrincipal, type VaultPublicationInput, type VaultReference,
} from '../src/hearthside/vaultContracts.ts';

export type VaultAudienceEnv = {
  SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string;
  HEARTHSIDE_VAULT_AUTHORITY_KEY_ID?: string;
  /** Dedicated 32-byte HMAC key encoded as lower-case hex. Never VITE or a service-role key. */
  HEARTHSIDE_VAULT_AUTHORITY_KEY?: string;
};
export interface VaultReferenceAuthority {
  accept(scope: Scope, reference: VaultReference, authorization: string): Promise<VaultAcceptance>;
  isReferenced(scope: Scope, mediaId: string): Promise<boolean>;
}
export type VaultAudienceOptions = {
  fetch?: typeof fetch; now?: () => number;
  /** A separate trusted guest namespace resolves recipient-bound invitation grants. */
  guestRecipients?: (scope: Scope, input: VaultPublicationInput, authorization: string) => Promise<VaultPrincipal[]>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const encode = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
function checkedAuthorization(scope: Scope, token: unknown, now: number): string {
  vaultAssert(scope.environment === 'development', 'ENVIRONMENT_DISABLED');
  vaultAssert(scope.expires > now && /^HH-[A-Za-z0-9_-]{1,96}$/.test(scope.householdId) && uuid.test(scope.subject), 'UNAUTHENTICATED');
  vaultId(scope.memberId);
  vaultAssert(typeof token === 'string' && /^[A-Za-z0-9._~-]{1,8192}$/.test(token), 'UNAUTHENTICATED');
  return token;
}
/** Only called inside the service; signatures and credentials never enter a receipt. */
export async function vaultAudienceRequest(env: VaultAudienceEnv, scope: Scope, authorization: string, issuedAt = Date.now()) {
  const token = checkedAuthorization(scope, authorization, issuedAt);
  vaultAssert(typeof env.HEARTHSIDE_VAULT_AUTHORITY_KEY === 'string' && /^[0-9a-f]{64}$/.test(env.HEARTHSIDE_VAULT_AUTHORITY_KEY) && env.HEARTHSIDE_VAULT_AUTHORITY_KEY_ID, 'PUBLICATION_DISABLED');
  const keyId = vaultId(env.HEARTHSIDE_VAULT_AUTHORITY_KEY_ID), issued = Math.floor(issuedAt / 1000);
  const tokenHash = encode(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  const material = ['hearthside-vault-audience-v1', keyId, scope.environment, scope.householdId, scope.memberId, scope.subject, String(issued), tokenHash].join('\n');
  const bytes = Uint8Array.from(env.HEARTHSIDE_VAULT_AUTHORITY_KEY.match(/.{2}/g)!, value => parseInt(value, 16));
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  bytes.fill(0);
  const signature = encode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(material)));
  return { p_environment: scope.environment, p_household_id: scope.householdId, p_member_id: scope.memberId,
    p_subject: scope.subject, p_key_id: keyId, p_issued_at: issued, p_token_sha256: tokenHash, p_signature: signature };
}
async function boundedJson(response: Response): Promise<unknown> {
  vaultAssert(response.body, 'VAULT_AUTHORITY_UNAVAILABLE');
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      length += item.value.byteLength;
      if (length > 16_384) { await reader.cancel(); throw new Error('VAULT_AUTHORITY_UNAVAILABLE'); }
      chunks.push(item.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { reader.releaseLock(); }
}
/** Fresh control-plane principals on every call. No roster or credential cache. */
export async function resolveVaultAudience(env: VaultAudienceEnv, scope: Scope, raw: VaultPublicationInput,
  authorization: string, options: VaultAudienceOptions = {}): Promise<VaultAudiencePolicy> {
  const now = options.now ?? Date.now, input = vaultPublicationInput(raw);
  checkedAuthorization(scope, authorization, now());
  let guestRecipients: VaultPrincipal[] | null = null;
  if (input.kind === 'guest') {
    vaultAssert(options.guestRecipients, 'GUEST_AUTHORITY_REQUIRED');
    guestRecipients = vaultPrincipals(await options.guestRecipients(scope, input, authorization));
    vaultAssert(guestRecipients.every(person => uuid.test(person.subject)) &&
      new Set(guestRecipients.map(person => person.subject)).size === guestRecipients.length &&
      JSON.stringify(guestRecipients.map(p => p.memberId).sort()) === JSON.stringify(input.recipientMemberIds), 'AUDIENCE_CHANGED');
  }
  // Resolve current host principals after any guest-grant await as well.
  const request = await vaultAudienceRequest(env, scope, authorization, now()), endpoint = new URL(env.SUPABASE_URL);
  vaultAssert(endpoint.protocol === 'https:' && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && endpoint.pathname === '/', 'PUBLICATION_DISABLED');
  endpoint.pathname = '/rest/v1/rpc/hearthside_vault_audience';
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 8000);
  let value: unknown;
  try {
    const response = await (options.fetch ?? globalThis.fetch.bind(globalThis))(endpoint, { method: 'POST', redirect: 'manual', signal: abort.signal,
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${authorization}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(request) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 401 || response.status === 403 ? 'UNAUTHENTICATED' : 'VAULT_AUTHORITY_UNAVAILABLE'); }
    value = await boundedJson(response);
  } catch (error) {
    // Do not forward provider bodies, request details, URLs or credential-bearing errors.
    throw new Error(error instanceof Error && error.message === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'VAULT_AUTHORITY_UNAVAILABLE');
  } finally { clearTimeout(timeout); }
  checkedAuthorization(scope, authorization, now());
  const result = vaultObject(value, ['version', 'environment', 'householdId', 'memberId', 'subject', 'checkedAt', 'principals']);
  vaultAssert(result.version === 1 && result.environment === scope.environment && result.householdId === scope.householdId &&
    result.memberId === scope.memberId && result.subject === scope.subject && typeof result.checkedAt === 'number' &&
    Number.isSafeInteger(result.checkedAt) && result.checkedAt >= now() - 30_000 && result.checkedAt <= now() + 5000, 'AUDIENCE_CHANGED');
  const principals = vaultPrincipals(result.principals as VaultPrincipal[]);
  vaultAssert(principals.every(person => uuid.test(person.subject)) && new Set(principals.map(person => person.subject)).size === principals.length, 'AUDIENCE_CHANGED');
  const author = principals.find(person => person.memberId === scope.memberId && person.subject === scope.subject);
  vaultAssert(author, 'AUDIENCE_CHANGED');
  const recipients = guestRecipients ?? input.recipientMemberIds.map(memberId => {
    const person = principals.find(candidate => candidate.memberId === memberId); vaultAssert(person, 'AUDIENCE_CHANGED'); return person;
  });
  const joint = input.kind === 'shared-memory' || input.kind === 'guest';
  vaultAssert(!joint || principals.length >= 2, 'MUTUAL_APPROVAL_REQUIRED');
  return { recipients: vaultPrincipals(recipients), approvers: joint ? principals : [author] };
}
/** Compose a real canonical reference writer; there is no fabricated acceptance fallback. */
export function createVaultPublicationAuthority(env: VaultAudienceEnv, writer: VaultReferenceAuthority, options: VaultAudienceOptions = {}) {
  return {
    policy: (scope: Scope, input: VaultPublicationInput, authorization?: string) => resolveVaultAudience(env, scope, input, authorization ?? '', options),
    accept: async (scope: Scope, reference: VaultReference, authorization?: string) => writer.accept(scope, reference,
      checkedAuthorization(scope, authorization, (options.now ?? Date.now)())),
    isReferenced: (scope: Scope, mediaId: string) => writer.isReferenced(scope, vaultId(mediaId)),
  };
}
