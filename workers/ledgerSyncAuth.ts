import { canonical } from "../src/ledgerSync/patch.ts";
import type { Scope } from "../src/ledgerSync/protocol.ts";
import { decodeJsonPayload } from "../src/ledger/snapshotPayload.ts";
import {
  assembleHousehold,
  ensureHouseholdShape,
  personalEnvelopeFromPayload,
  splitForSync,
} from "../src/core/sync.ts";
import type { Household } from "../src/core/types.ts";
export type AuthEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  LEDGER_SYNC_LOCAL_AUTH?: string;
};
export async function supabase(
  env: AuthEnv,
  path: string,
  token: string,
  body?: unknown,
) {
  const response = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, "")}${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "UNAUTHENTICATED"
        : "CONTROL_PLANE_UNAVAILABLE",
    );
  return response.json() as Promise<any>;
}
export async function authorizeRequest(
  request: Request,
  env: AuthEnv,
  environment: string,
  householdId: string,
): Promise<{
  scope: Scope;
  token: string;
  roster?: Array<{ id: string; name: string; active: boolean }>;
}> {
  const authorizationStarted = Date.now();
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new Error("UNAUTHENTICATED");
  if (
    !["development", "production"].includes(environment) ||
    !/^HH-[a-zA-Z0-9_-]{1,96}$/.test(householdId)
  )
    throw new Error("INVALID_SCOPE");
  const local =
    env.LEDGER_SYNC_LOCAL_AUTH === "true" &&
    environment === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname);
  if (local && /^local:MEM-[A-Za-z0-9_-]+$/.test(token))
    return {
      scope: {
        environment,
        householdId,
        memberId: token.slice(6),
        subject: token,
        role: "owner",
        expires: Date.now() + 60_000,
        aclEpoch: authorizationStarted,
      },
      token,
    };
  const value = await supabase(env, "/rest/v1/rpc/ledger_sync_scope", token, {
    p_environment: environment,
    p_household_id: householdId,
  });
  if (!value?.subject || !value.memberId || !Array.isArray(value.members))
    throw new Error("FORBIDDEN");
  return {
    scope: {
      environment: environment as Scope["environment"],
      householdId,
      memberId: value.memberId,
      subject: value.subject,
      identity: value.identity,
      role: value.role === "owner" ? "owner" : "member",
      expires: Date.now() + 60_000,
      aclEpoch: authorizationStarted,
    },
    token,
    roster: value.members,
  };
}
export async function importLegacy(
  env: AuthEnv,
  scope: Scope,
  token: string,
  authorityInstance: string,
  normalization?: (differences: string[]) => void,
): Promise<Household> {
  // This RPC takes the legacy snapshot row lock and permanently fences old writers.
  // No unfenced read/import fallback is permitted.
  const record = await supabase(
    env,
    "/rest/v1/rpc/claim_ledger_sync_v2",
    token,
    {
      p_environment: scope.environment,
      p_household_id: scope.householdId,
      p_member_id: scope.memberId,
      p_authority_instance: authorityInstance,
    },
  );
  if (!record?.shared) throw new Error("IMPORT_SOURCE_MISSING");
  const rawShared = await decodeJsonPayload(record.shared) as Household;
  const shared = ensureHouseholdShape(rawShared);
  const rawPersonal = record.personal ? await decodeJsonPayload(record.personal) : null;
  if (
    shared.environment !== scope.environment ||
    shared.householdId !== scope.householdId
  )
    throw new Error("IMPORT_SCOPE_MISMATCH");
  const personal = record.personal
    ? personalEnvelopeFromPayload(
        rawPersonal,
        scope.memberId,
      )
    : splitForSync(shared, scope.memberId).personal;
  if (record.personal && !personal) throw new Error("INVALID_PERSONAL_IMPORT");
  const changes: string[] = [];
  for (const [label, raw, shaped] of [["shared", rawShared, shared], ["personal", rawPersonal, personal]] as const) {
    if(!raw || !shaped) continue;
    for(const [field, value] of Object.entries(raw)) {
      // Envelope markers and absent legacy defaults are explicit schema changes.
      if(["kind", "linked", "baseRevision", "booksAcceptedHash", "sharing"].includes(field)) continue;
      const next=(shaped as any)[field];
      const emptyCollectionDefault=value===null&&Array.isArray(next)&&next.length===0;
      if(!emptyCollectionDefault && canonical(value) !== canonical(next)) changes.push(`${label}.${field}`);
    }
  }
  const sharedProjection=splitForSync(shared,scope.memberId).shared;
  for(const field of ['transactions','shifts'] as const) {
    // A raw legacy whole-household payload can already contain caller Personal
    // rows, but neither individual envelope nor assembled scope may collide.
    for(const rows of [shared[field],personal?.[field]??[],[...sharedProjection[field],...(personal?.[field]??[])]])
      if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('IMPORT_ROW_ID_COLLISION');
  }
  const assembled = assembleHousehold(
    sharedProjection,
    personal,
    { linked: true },
  );
  // These collections are intentionally projected to Shared + caller Personal;
  // their exact wire sets are checked separately by the parity comparator.
  const scopedFields=new Set(['nativeEvents','members','accounts','transactions','shifts','goals','goalContributions','goalPurchases','activity','tombstones','companionProfile', 'fundPrivate','herculesProPermissions','sevenShiftsSchedules','coworkers','coworkerAttendance','coworkerSchedules','shiftEnvelopes','shiftBibles']);
  for(const [field,value] of Object.entries(shared)) {
    if(scopedFields.has(field)||['kind','linked','baseRevision','booksAcceptedHash','sharing'].includes(field))continue;
    if(canonical(value)!==canonical((assembled as any)[field]))changes.push(`assembled.${field}`);
  }
  const finalPersonal=splitForSync(assembled,scope.memberId).personal;
  for(const [field,value] of Object.entries(personal??{})) {
    const next=(finalPersonal as any)[field];
    if(field==='lastCommittedAt')continue; // Replica transport clock is the assembled tip.
    if(value===null&&next===undefined&&['glanceAccountId','fundCardAccountId'].includes(field))continue;
    if(canonical(value)!==canonical(next))changes.push(`personalRoundTrip.${field}`);
  }
  normalization?.([...new Set(changes)]);
  return assembled;
}
