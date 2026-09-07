import { supabase, type AuthEnv } from './ledgerSyncAuth.ts';
import type { Scope } from '../src/ledgerSync/protocol.ts';

export async function reservationDigest(scope: Pick<Scope, 'environment' | 'householdId'>, identity: string) {
  const normalized = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity) ? identity.toLowerCase() : identity;
  const bytes = new TextEncoder().encode(`ledger-reservation-v1\n${scope.environment}\n${scope.householdId}\n${normalized}`);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** One-time import. No hosted query on the command hot path. Missing 020 fails closed. */
export async function importReservationDigests(env: AuthEnv, scope: Scope, token: string, authorityInstance: string): Promise<string[]> {
  const digests: string[] = [];
  let cursor: string | null = null, manifestId: string | undefined, total: number | undefined, sourceRevision: number | undefined;
  do {
    const page = await supabase(env, '/rest/v1/rpc/ledger_sync_reservations_page', token, {
      p_environment: scope.environment, p_household_id: scope.householdId, p_member_id: scope.memberId,
      p_authority_instance: authorityInstance, p_after_digest: cursor, p_limit: 1000,
    });
    if (page?.version !== 1 || typeof page.manifestId !== 'string' || !page.manifestId
      || page.authorityInstance !== authorityInstance || !Number.isSafeInteger(page.sourceRevision) || page.sourceRevision < 0
      || !Number.isSafeInteger(page.total) || page.total < 0 || page.total > 100000
      || !Array.isArray(page.digests) || page.digests.length > 1000 || typeof page.complete !== 'boolean'
      || (manifestId !== undefined && (manifestId !== page.manifestId || total !== page.total || sourceRevision !== page.sourceRevision))) {
      throw new Error('INVALID_RESERVATION_MANIFEST');
    }
    manifestId = page.manifestId; total = page.total; sourceRevision = page.sourceRevision;
    for (const value of page.digests) {
      if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value) || (cursor !== null && value <= cursor)) throw new Error('INVALID_RESERVATION_ORDER');
      digests.push(value); cursor = value;
    }
    if (digests.length > total! || (page.complete && (page.next !== null || digests.length !== total))
      || (!page.complete && (!page.digests.length || page.next !== cursor))) throw new Error('INCOMPLETE_RESERVATION_MANIFEST');
    if (page.complete) return digests;
  } while (digests.length < 100000);
  throw new Error('RESERVATION_LIMIT');
}
