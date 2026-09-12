import { supabase, type AuthEnv } from '../ledgerSyncAuth.ts';
import type { Scope } from '../../src/ledgerSync/protocol.ts';
import { HERCULES_READ_TOOL_NAMES } from '../../src/core/herculesTools.ts';
import { DEFAULT_RUN_BUDGET } from '../../src/workspace/runtime.ts';
export type PrivateRunGrant = { token: string; id: string; runId: string; projectId: string; expiresAt: string; localScope?: Scope };
export async function hashText(text: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function pendingGrant(runId: string, projectId: string): PrivateRunGrant {
  return { token: [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2, '0')).join(''), id: '', runId, projectId, expiresAt: new Date(Date.now() + 24 * 60 * 60_000 - 10000).toISOString() };
}
export async function issueGrant(env: AuthEnv, scope: Scope, authToken: string, grant: PrivateRunGrant): Promise<PrivateRunGrant> {
  if (scope.subject.startsWith('local:') && env.LEDGER_SYNC_LOCAL_AUTH === 'true') return { ...grant, id: grant.runId, localScope: scope };
  const value = await supabase(env, '/rest/v1/rpc/hercules_issue_run_grant', authToken, {
    p_environment: scope.environment, p_household_id: scope.householdId, p_run_id: grant.runId, p_project_id: grant.projectId,
    p_token_sha256: await hashText(grant.token), p_permitted_reads: HERCULES_READ_TOOL_NAMES,
    p_budget: DEFAULT_RUN_BUDGET, p_expires_at: grant.expiresAt });
  return { ...grant, id: value.grantId };
}
/** This restricted capability is never a browser token, model tool or command credential. */
export type WorkspaceLease = Scope & { permittedReads: string[]; budget: typeof DEFAULT_RUN_BUDGET };
export async function leaseGrant(env: AuthEnv, grant: PrivateRunGrant): Promise<WorkspaceLease> {
  if (Date.parse(grant.expiresAt) <= Date.now()) throw new Error('GRANT_EXPIRED');
  const started = Date.now();
  if (grant.localScope && env.LEDGER_SYNC_LOCAL_AUTH === 'true' && grant.localScope.environment === 'development') return { ...grant.localScope, expires: Date.now() + 60_000, aclEpoch: started, permittedReads: [...HERCULES_READ_TOOL_NAMES], budget: DEFAULT_RUN_BUDGET };
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/hercules_lease_run_grant`, { method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: grant.token, p_run_id: grant.runId, p_project_id: grant.projectId }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status >= 500 ? 'GRANT_SERVICE_UNAVAILABLE' : 'GRANT_REVOKED');
  const result = await response.json() as Record<string, unknown>;
  if (result.runId !== grant.runId || result.projectId !== grant.projectId || result.environment !== 'development') throw new Error('GRANT_SCOPE_MISMATCH');
  const expiry = Date.parse(String(result.leaseExpiresAt)), budget = result.budget as typeof DEFAULT_RUN_BUDGET;
  if (!Number.isFinite(expiry) || expiry <= started || !/^HH-[A-Za-z0-9_-]+$/.test(String(result.householdId)) || !/^MEM-[A-Za-z0-9_-]+$/.test(String(result.memberId))
    || typeof result.subject !== 'string' || !result.subject || !Array.isArray(result.permittedReads) || result.permittedReads.some(v => typeof v !== 'string' || !(HERCULES_READ_TOOL_NAMES as readonly string[]).includes(v))
    || !budget || Object.keys(DEFAULT_RUN_BUDGET).some(key => { const value = budget[key as keyof typeof budget]; return !Number.isSafeInteger(value) || value <= 0 || value > DEFAULT_RUN_BUDGET[key as keyof typeof budget]; })) throw new Error('INVALID_GRANT_LEASE');
  return { environment: 'development', householdId: String(result.householdId), memberId: String(result.memberId), subject: String(result.subject),
    role: result.role === 'owner' ? 'owner' : 'member', expires: Math.min(started + 60_000, expiry), aclEpoch: started,
    permittedReads: result.permittedReads as string[], budget };
}
