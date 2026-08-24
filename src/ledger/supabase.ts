import { financialAuditHash } from "../core/commandIdentity.ts";
import { ensureHouseholdShape, personalReplicaForMember } from "../core/sync.ts";
import { inviteFromText } from "../core/invite.ts";
import { memberIdForGoogleIdentity, type GoogleIdentitySelector } from "../core/google.ts";
import { hostedTransportAllowed } from "../core/sharing.ts";
import type { Environment, Household, PersonalEnvelope } from "../core/types.ts";
import type { SnapshotCasConflict, SnapshotCasResult } from "./snapshotCas.ts";

export type SupabaseConfig = {
  url: string;
  key: string;
};

export type SupabaseProbe = {
  configured: boolean;
  reachable: boolean;
  schema: boolean;
  project?: string;
  error?: string;
};

export type PushHouseholdResult = SupabaseProbe & {
  skipped?: boolean;
  conflict?: boolean;
  remote?: Household;
  /** True when the hosted CAS RPC acknowledged an already-applied duplicate. */
  duplicate?: boolean;
  /** True when the write used publish_household_snapshot; false for legacy GET/POST. */
  usedCasRpc?: boolean;
};

export type DiscoveredHousehold = {
  household: Household;
  memberId: string;
};

type ContinuityMembershipRow = {
  household_id: string;
  member_id: string;
  google_subject: string;
  google_email: string;
};

const DEFAULT_URL = "https://tykhocwacaxwquhynkok.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS";

/** Live bundled defaults, including under Vitest. Use this when proving zero-network skip. */
export function bundledSupabaseConfig(): SupabaseConfig {
  return { url: DEFAULT_URL, key: DEFAULT_PUBLISHABLE_KEY };
}

export function readSupabaseConfig(): SupabaseConfig | null {
  if (import.meta.env.VITEST && import.meta.env.VITE_SUPABASE_LIVE !== "1") return null;
  const url = String(import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL).replace(/\/$/, "");
  const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY);
  if (!url || !key) return null;
  return { url, key };
}

export { hostedTransportAllowed };

function projectRef(url: string): string {
  try {
    return new URL(url).hostname.split(".")[0] || "supabase";
  } catch {
    return "supabase";
  }
}

function headers(key: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

async function rest(
  config: SupabaseConfig,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(config.key), ...(init.headers || {}) },
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: response.ok, status: response.status, body };
}

function messageOf(body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    return String((body as { message: string }).message);
  }
  return String(body || "Supabase request failed.");
}

export function isMissingTable(body: unknown): boolean {
  return Boolean(
    body &&
    typeof body === "object" &&
    "code" in body &&
    (body as { code: string }).code === "PGRST205",
  );
}

/** PostgREST: RPC name/signature not in the schema cache (migration 002 not applied). */
export function isMissingRpc(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const code = "code" in body ? String((body as { code: unknown }).code) : "";
  const message = "message" in body ? String((body as { message: unknown }).message) : "";
  if (code === "PGRST202" || code === "PGRST203") return true;
  return /could not find the function|schema cache/i.test(message)
    && /publish_household_snapshot/i.test(message);
}

function remoteFromCasPayload(payload: string | null | undefined): Household | null {
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload) as Household;
    return ensureHouseholdShape({ ...parsed, linked: true });
  } catch {
    return null;
  }
}

function parseCasRpcBody(body: unknown): SnapshotCasResult | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.ok === true && row.conflict === false) {
    return {
      ok: true,
      conflict: false,
      revision: Number(row.revision ?? 0),
      duplicate: row.duplicate === true,
    };
  }
  if (row.ok === false || row.conflict === true) {
    const reasonRaw = typeof row.reason === "string" ? row.reason : "stale-revision";
    const reason: SnapshotCasConflict["reason"] =
      reasonRaw === "environment-mismatch"
      || reasonRaw === "revision-hash-mismatch"
      || reasonRaw === "missing-base"
      || reasonRaw === "stale-revision"
        ? reasonRaw
        : "stale-revision";
    return {
      ok: false,
      conflict: true,
      remoteRevision: row.remote_revision == null ? null : Number(row.remote_revision),
      remotePayload: typeof row.remote_payload === "string" ? row.remote_payload : null,
      reason,
    };
  }
  return null;
}

function conflictMessage(reason: SnapshotCasConflict["reason"] | undefined): string {
  switch (reason) {
    case "environment-mismatch":
      return "That hosted snapshot is a different environment. Nothing was overwritten.";
    case "revision-hash-mismatch":
      return "Hosted books at this revision disagree with this phone. Nothing was overwritten.";
    case "missing-base":
      return "Hosted books were missing the expected base revision. Nothing was overwritten.";
    default:
      return "Another phone posted a newer household snapshot. Nothing was overwritten.";
  }
}

function snapshotFromRow(row: { payload?: string | Household } | undefined): Household | null {
  if (!row?.payload) return null;
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) as Household : row.payload;
  return ensureHouseholdShape({ ...payload, linked: true });
}

function personalFromRow(row: { payload?: string | PersonalEnvelope } | undefined, memberId: string): PersonalEnvelope | null {
  if (!row?.payload) return null;
  try {
    const payload = typeof row.payload === "string" ? JSON.parse(row.payload) as PersonalEnvelope : row.payload;
    if (payload.kind !== "personal" || payload.memberId !== memberId) return null;
    return {
      ...payload,
      transactions: Array.isArray(payload.transactions)
        ? payload.transactions.filter((item) => item.createdBy === memberId && item.visibility === "personal")
        : [],
      shifts: Array.isArray(payload.shifts)
        ? payload.shifts.filter((item) => item.createdBy === memberId && item.visibility === "personal")
        : [],
      tombstones: Array.isArray(payload.tombstones) ? payload.tombstones : [],
    };
  } catch {
    return null;
  }
}

function overlayPersonalReplica(household: Household, personal: PersonalEnvelope | null, memberId: string): Household {
  if (!personal) return household;
  const personalTransactionIds = new Set(personal.transactions.map((item) => item.id));
  const personalShiftIds = new Set(personal.shifts.map((item) => item.id));
  const tombstones = new Map(household.tombstones.map((item) => [item.id, item]));
  for (const item of personal.tombstones) {
    const existing = tombstones.get(item.id);
    if (!existing || item.deletedAt >= existing.deletedAt) tombstones.set(item.id, item);
  }
  return ensureHouseholdShape({
    ...household,
    transactions: [
      ...household.transactions.filter((item) => !(
        (item.visibility === "personal" && item.createdBy === memberId) || personalTransactionIds.has(item.id)
      )),
      ...personal.transactions,
    ],
    shifts: [
      ...household.shifts.filter((item) => !(
        (item.visibility === "personal" && item.createdBy === memberId) || personalShiftIds.has(item.id)
      )),
      ...personal.shifts,
    ],
    tombstones: [...tombstones.values()],
    lastCommittedAt: (personal.lastCommittedAt ?? "") > (household.lastCommittedAt ?? "")
      ? personal.lastCommittedAt
      : household.lastCommittedAt,
  });
}

async function continuityMembershipRows(
  config: SupabaseConfig,
  identity: GoogleIdentitySelector,
  environment: Environment,
): Promise<ContinuityMembershipRow[] | null> {
  const subject = identity.subject.trim();
  const email = identity.email.trim().toLowerCase();
  const select = "select=household_id,member_id,google_subject,google_email&active=eq.true&limit=500";
  if (subject) {
    const bySubject = await rest(
      config,
      `continuity_memberships?environment=eq.${encodeURIComponent(environment)}&google_subject=eq.${encodeURIComponent(subject)}&${select}`,
      { method: "GET", headers: { Prefer: "return=representation" } },
    );
    if (isMissingTable(bySubject.body)) return null;
    if (!bySubject.ok) throw new Error(messageOf(bySubject.body));
    const exact = Array.isArray(bySubject.body)
      ? (bySubject.body as ContinuityMembershipRow[]).filter((row) => (
          Boolean(row.household_id) && Boolean(row.member_id) && row.google_subject === subject
        ))
      : [];
    if (exact.length) return exact;
  }
  if (!email) return [];
  const byEmail = await rest(
    config,
    `continuity_memberships?environment=eq.${encodeURIComponent(environment)}&google_email=eq.${encodeURIComponent(email)}&${select}`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (isMissingTable(byEmail.body)) return null;
  if (!byEmail.ok) throw new Error(messageOf(byEmail.body));
  const rows = Array.isArray(byEmail.body) ? byEmail.body as ContinuityMembershipRow[] : [];
  return rows.filter((row) => (
    Boolean(row.household_id) &&
    Boolean(row.member_id) &&
    row.google_email === email &&
    (!subject || !row.google_subject || row.google_subject === subject)
  ));
}

async function personalSnapshotForMembership(
  config: SupabaseConfig,
  row: ContinuityMembershipRow,
  environment: Environment,
): Promise<PersonalEnvelope | null> {
  const result = await rest(
    config,
    `continuity_personal_snapshots?environment=eq.${encodeURIComponent(environment)}&household_id=eq.${encodeURIComponent(row.household_id)}&member_id=eq.${encodeURIComponent(row.member_id)}&select=payload&limit=1`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (isMissingTable(result.body)) return null;
  if (!result.ok) throw new Error(messageOf(result.body));
  const rows = Array.isArray(result.body) ? result.body as { payload?: string | PersonalEnvelope }[] : [];
  return personalFromRow(rows[0], row.member_id);
}

async function discoverFromContinuityMemberships(
  config: SupabaseConfig,
  identity: GoogleIdentitySelector,
  environment: Environment,
): Promise<DiscoveredHousehold[] | null> {
  const memberships = await continuityMembershipRows(config, identity, environment);
  if (memberships === null) return null;
  const found: DiscoveredHousehold[] = [];
  for (const membership of memberships) {
    const snapshotResult = await rest(
      config,
      `household_snapshots?environment=eq.${encodeURIComponent(environment)}&household_id=eq.${encodeURIComponent(membership.household_id)}&select=payload&limit=1`,
      { method: "GET", headers: { Prefer: "return=representation" } },
    );
    if (!snapshotResult.ok) {
      if (isMissingTable(snapshotResult.body)) continue;
      throw new Error(messageOf(snapshotResult.body));
    }
    const snapshotRows = Array.isArray(snapshotResult.body)
      ? snapshotResult.body as { payload?: string | Household }[]
      : [];
    const household = snapshotFromRow(snapshotRows[0]);
    if (!household || household.environment !== environment) continue;
    const personal = await personalSnapshotForMembership(config, membership, environment);
    found.push({
      household: {
        ...overlayPersonalReplica(household, personal, membership.member_id),
        baseRevision: household.revision,
      },
      memberId: membership.member_id,
    });
  }
  return found;
}

async function publishContinuityMemberScope(
  config: SupabaseConfig,
  snapshot: Household,
  memberId: string,
  identity: GoogleIdentitySelector,
): Promise<void> {
  const probe = await rest(config, "continuity_memberships?select=household_id&limit=1", {
    method: "GET",
    headers: { Prefer: "return=representation" },
  });
  if (isMissingTable(probe.body)) return;
  if (!probe.ok) throw new Error(messageOf(probe.body));
  const link = snapshot.google.links.find((item) => item.active && item.memberId === memberId);
  const membership = await rest(config, "continuity_memberships?on_conflict=environment,household_id,member_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      environment: snapshot.environment,
      household_id: snapshot.householdId,
      member_id: memberId,
      google_subject: identity.subject.trim() || link?.subject.trim() || "",
      google_email: identity.email.trim().toLowerCase() || link?.email.trim().toLowerCase() || "",
      display_name: link?.displayName || snapshot.members.find((item) => item.id === memberId)?.name || "",
      active: true,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!membership.ok) throw new Error(messageOf(membership.body));
  const personal = personalReplicaForMember(snapshot, memberId);
  const personalResult = await rest(
    config,
    "continuity_personal_snapshots?on_conflict=environment,household_id,member_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        environment: snapshot.environment,
        household_id: snapshot.householdId,
        member_id: memberId,
        revision: snapshot.revision,
        payload: JSON.stringify(personal),
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!personalResult.ok) throw new Error(messageOf(personalResult.body));
}

export async function probeSupabase(config = readSupabaseConfig()): Promise<SupabaseProbe> {
  if (!config) return { configured: false, reachable: false, schema: false };
  const project = projectRef(config.url);
  try {
    const result = await rest(config, "households?select=id&limit=1", { method: "GET", headers: { Prefer: "return=representation" } });
    if (isMissingTable(result.body)) {
      return {
        configured: true,
        reachable: true,
        schema: false,
        project,
        error: "Project is live, but public.households is not in the API yet. Re-run supabase/migrations/001_hearth_books.sql in the SQL Editor.",
      };
    }
    if (result.status === 401 || result.status === 403) {
      return { configured: true, reachable: true, schema: false, project, error: messageOf(result.body) };
    }
    if (!result.ok) {
      return { configured: true, reachable: true, schema: false, project, error: messageOf(result.body) };
    }
    return { configured: true, reachable: true, schema: true, project };
  } catch (caught) {
    return {
      configured: true,
      reachable: false,
      schema: false,
      project,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}

export async function pullSupabaseHousehold(
  invite: string,
  config = readSupabaseConfig(),
  environment: Environment = "development",
): Promise<Household | null> {
  if (!config) return null;
  const phrase = inviteFromText(invite);
  const result = await rest(
    config,
    `household_snapshots?invite_phrase=eq.${encodeURIComponent(phrase)}&environment=eq.${encodeURIComponent(environment)}&select=payload&order=updated_at.desc&limit=1`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (!result.ok) {
    if (isMissingTable(result.body)) return null;
    throw new Error(messageOf(result.body));
  }
  const rows = Array.isArray(result.body) ? result.body as { payload: string | Household }[] : [];
  const pulled = snapshotFromRow(rows[0]);
  if (!pulled) return null;
  if (pulled.environment !== environment) {
    throw new Error("That shared snapshot belongs to a different Development/Production pill.");
  }
  return { ...pulled, linked: true, baseRevision: pulled.revision };
}

/**
 * Temporary Development discovery for D-114. Hosted rows are deliberately open
 * during the disposable-data window, so the client can scan snapshots and keep
 * only exact Google memberships. Production stays blocked until Auth/RLS can do
 * this filtering on the server.
 */
export async function discoverSupabaseHouseholdsByGoogleIdentity(
  identity: GoogleIdentitySelector,
  config = readSupabaseConfig(),
  environment: Environment = "development",
): Promise<DiscoveredHousehold[]> {
  if (!config || environment !== "development") return [];
  const fromMemberships = await discoverFromContinuityMemberships(config, identity, environment);
  if (fromMemberships !== null) return fromMemberships;
  const result = await rest(
    config,
    `household_snapshots?environment=eq.${encodeURIComponent(environment)}&select=payload,updated_at&order=updated_at.desc&limit=500`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (!result.ok) {
    if (isMissingTable(result.body)) return [];
    throw new Error(messageOf(result.body));
  }
  const rows = Array.isArray(result.body)
    ? result.body as { payload?: string | Household; updated_at?: string }[]
    : [];
  const found = new Map<string, DiscoveredHousehold>();
  for (const row of rows) {
    try {
      const household = snapshotFromRow(row);
      if (!household || household.environment !== environment || found.has(household.householdId)) continue;
      const memberId = memberIdForGoogleIdentity(household, identity);
      if (!memberId) continue;
      found.set(household.householdId, {
        household: { ...household, baseRevision: household.revision },
        memberId,
      });
    } catch {
      // One malformed disposable Development row must not hide valid memberships.
    }
  }
  return [...found.values()];
}

async function readRemoteSnapshot(
  config: SupabaseConfig,
  householdId: string,
): Promise<Household | null> {
  const result = await rest(
    config,
    `household_snapshots?household_id=eq.${encodeURIComponent(householdId)}&select=payload&limit=1`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (!result.ok) {
    if (isMissingTable(result.body)) return null;
    throw new Error(messageOf(result.body));
  }
  const rows = Array.isArray(result.body) ? result.body as { payload: string | Household }[] : [];
  return snapshotFromRow(rows[0]);
}

export async function pushSupabaseHousehold(
  household: Household,
  config = readSupabaseConfig(),
  options?: { expectedRevision?: number; continuityIdentity?: GoogleIdentitySelector },
): Promise<PushHouseholdResult> {
  const continuityMemberId = household.environment === "development" && options?.continuityIdentity
    ? memberIdForGoogleIdentity(household, options.continuityIdentity)
    : null;
  if (!hostedTransportAllowed(household) && !continuityMemberId) {
    return { configured: Boolean(config), reachable: false, schema: false, skipped: true };
  }
  const probe = await probeSupabase(config);
  if (!config || !probe.schema) return { ...probe, skipped: false };
  const snapshot = ensureHouseholdShape(household);
  if (!snapshot.linked && !continuityMemberId) {
    return { ...probe, skipped: true };
  }
  const expectedRevision = options?.expectedRevision ?? snapshot.baseRevision ?? 0;
  const snapshotHash = await financialAuditHash(snapshot);
  const payload = JSON.stringify(snapshot);

  const rpc = await rest(config, "rpc/publish_household_snapshot", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_household_id: snapshot.householdId,
      p_expected_revision: expectedRevision,
      p_name: snapshot.name,
      p_timezone: snapshot.timezone,
      p_currency: snapshot.currency,
      p_environment: snapshot.environment,
      p_invite_phrase: snapshot.inviteCode,
      p_linked: snapshot.linked || Boolean(continuityMemberId),
      p_revision: snapshot.revision,
      p_last_committed_at: snapshot.lastCommittedAt,
      p_payload: payload,
      p_snapshot_hash: snapshotHash,
    }),
  });

  if (rpc.ok) {
    const cas = parseCasRpcBody(rpc.body);
    if (cas?.ok) {
      if (continuityMemberId && options?.continuityIdentity) {
        await publishContinuityMemberScope(config, snapshot, continuityMemberId, options.continuityIdentity);
      }
      return {
        ...probe,
        schema: true,
        error: undefined,
        skipped: false,
        conflict: false,
        duplicate: cas.duplicate === true,
        usedCasRpc: true,
      };
    }
    if (cas && !cas.ok) {
      return {
        ...probe,
        schema: true,
        conflict: true,
        usedCasRpc: true,
        remote: remoteFromCasPayload(cas.remotePayload) ?? undefined,
        error: conflictMessage(cas.reason),
      };
    }
  } else if (!isMissingRpc(rpc.body)) {
    throw new Error(messageOf(rpc.body));
  }

  // Migration 002 not applied: keep the legacy client CAS path (still racy under load).
  return pushSupabaseHouseholdLegacy(
    config,
    probe,
    snapshot,
    expectedRevision,
    continuityMemberId,
    options?.continuityIdentity,
  );
}

async function pushSupabaseHouseholdLegacy(
  config: SupabaseConfig,
  probe: SupabaseProbe,
  snapshot: Household,
  expectedRevision: number,
  continuityMemberId: string | null,
  continuityIdentity?: GoogleIdentitySelector,
): Promise<PushHouseholdResult> {
  const remote = await readRemoteSnapshot(config, snapshot.householdId);
  if (remote && remote.environment !== snapshot.environment) {
    return {
      ...probe,
      schema: true,
      conflict: true,
      usedCasRpc: false,
      remote,
      error: "That hosted snapshot is a different environment. Nothing was overwritten.",
    };
  }
  if (remote && remote.revision !== expectedRevision) {
    return {
      ...probe,
      schema: true,
      conflict: true,
      usedCasRpc: false,
      remote,
      error: "Another phone posted a newer household snapshot. Nothing was overwritten.",
    };
  }
  if (continuityMemberId && continuityIdentity) {
    await publishContinuityMemberScope(config, snapshot, continuityMemberId, continuityIdentity);
  }
  const houseBody = {
    id: snapshot.householdId,
    name: snapshot.name,
    timezone: snapshot.timezone,
    currency: snapshot.currency,
    environment: snapshot.environment,
    invite_phrase: snapshot.inviteCode,
    linked: snapshot.linked || Boolean(continuityMemberId),
    revision: snapshot.revision,
    last_committed_at: snapshot.lastCommittedAt,
  };
  const house = await rest(config, "households?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(houseBody),
  });
  if (!house.ok) throw new Error(messageOf(house.body));
  const snap = await rest(config, "household_snapshots?on_conflict=household_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      household_id: snapshot.householdId,
      invite_phrase: snapshot.inviteCode,
      environment: snapshot.environment,
      payload: JSON.stringify(snapshot),
      updated_at: new Date().toISOString(),
      revision: snapshot.revision,
      snapshot_hash: await financialAuditHash(snapshot),
    }),
  });
  if (!snap.ok) throw new Error(messageOf(snap.body));
  return { ...probe, schema: true, error: undefined, skipped: false, conflict: false, usedCasRpc: false };
}
