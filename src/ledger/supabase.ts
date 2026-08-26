import { financialAuditHash } from "../core/commandIdentity.ts";
import {
  assertHouseholdBinding,
  assertPersonalEnvelopeBinding,
} from "../core/environmentIsolation.ts";
import { ValidationError, type Environment, type Household, type PersonalEnvelope } from "../core/types.ts";
import { assembleHousehold, ensureHouseholdShape, overlayPersonalReplica, personalEnvelopeFromPayload, personalReplicaForMember, splitForSync } from "../core/sync.ts";
import { inviteFromText } from "../core/invite.ts";
import { memberIdForGoogleIdentity, type GoogleIdentitySelector } from "../core/google.ts";
import { hostedTransportAllowed } from "../core/sharing.ts";
import { hostedContinuityAllowed, legacyLinkedPublishAllowed } from "./continuityPolicy.ts";
import { decodeJsonPayload, encodeHouseholdPayload, encodeSharedSnapshotPayload } from "./snapshotPayload.ts";
import type { SnapshotCasConflict, SnapshotCasResult } from "./snapshotCas.ts";

export {
  hostedContinuityAllowed,
  legacyLinkedPublishAllowed,
  productionContinuityEnabled,
} from "./continuityPolicy.ts";
export {
  decodeHouseholdPayload,
  decodeJsonPayload,
  encodeHouseholdPayload,
  encodeJsonPayload,
  encodeSharedSnapshotPayload,
  isSnapshotPayloadEnvelope,
} from "./snapshotPayload.ts";

export type SupabaseConfig = {
  url: string;
  key: string;
  /** Supabase Auth user JWT; absent means the disclosed Development anon bridge. */
  accessToken?: string;
  /** auth.users.id from the same verified session. */
  authUserId?: string;
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
  auth_user_id?: string;
  role?: string;
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

function headers(config: SupabaseConfig): HeadersInit {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.accessToken || config.key}`,
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
    headers: { ...headers(config), ...(init.headers || {}) },
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

async function remoteFromCasPayload(payload: string | null | undefined): Promise<Household | null> {
  if (!payload) return null;
  try {
    const parsed = await decodeJsonPayload(payload);
    if (!parsed || typeof parsed !== "object") return null;
    return ensureHouseholdShape({ ...(parsed as Household), linked: true });
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
      || reasonRaw === "missing-snapshot"
      || reasonRaw === "non-advancing-revision"
      || reasonRaw === "not-member"
      || reasonRaw === "personal-data-in-shared-payload"
      || reasonRaw === "invalid-create"
      || reasonRaw === "payload-identity-mismatch"
      || reasonRaw === "google-identity-required"
      || reasonRaw === "household-already-exists"
      || reasonRaw === "invalid-household"
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
    case "missing-snapshot":
      return "The cloud household exists but its books snapshot is missing. Nothing was overwritten.";
    case "non-advancing-revision":
      return "This upload did not advance beyond its cloud base. Nothing was overwritten.";
    case "not-member":
      return "This Google account is not an active member of that household. Nothing was overwritten.";
    case "personal-data-in-shared-payload":
      return "Personal ledger rows were refused from the shared cloud snapshot. Nothing was overwritten.";
    case "google-identity-required":
      return "Reconnect with Google through Hearth before creating cloud books.";
    case "payload-identity-mismatch":
    case "invalid-create":
    case "invalid-household":
      return "The cloud snapshot identity was invalid. Nothing was overwritten.";
    default:
      return "Another phone posted a newer household snapshot. Nothing was overwritten.";
  }
}

async function snapshotFromRow(row: { payload?: string | Household | Record<string, unknown> } | undefined): Promise<Household | null> {
  if (!row?.payload) return null;
  try {
    const payload = await decodeJsonPayload(row.payload as string | object);
    if (!payload || typeof payload !== "object") return null;
    return ensureHouseholdShape({ ...(payload as Household), linked: true });
  } catch {
    return null;
  }
}

async function personalFromRow(
  row: { payload?: string | PersonalEnvelope | Record<string, unknown> } | undefined,
  memberId: string,
): Promise<PersonalEnvelope | null> {
  if (!row?.payload) return null;
  try {
    const payload = await decodeJsonPayload(row.payload as string | object);
    return personalEnvelopeFromPayload(payload, memberId);
  } catch {
    return null;
  }
}

/** Shared cloud payload plus exactly-once receipts; no member-owned Personal rows. */
export function householdCloudProjection(household: Household, memberId: string): Household {
  const shaped = ensureHouseholdShape(household);
  const { shared } = splitForSync(shaped, memberId);
  return {
    ...assembleHousehold(shared, null, { linked: true }),
    linked: shaped.linked,
    revision: shaped.revision,
    baseRevision: shaped.baseRevision,
    lastCommittedAt: shaped.lastCommittedAt,
    commandReceipts: shaped.commandReceipts,
  };
}

async function continuityMembershipRows(
  config: SupabaseConfig,
  identity: GoogleIdentitySelector,
  environment: Environment,
): Promise<ContinuityMembershipRow[] | null> {
  const subject = identity.subject.trim();
  const email = identity.email.trim().toLowerCase();
  const select = "select=household_id,member_id,google_subject,google_email,auth_user_id,role&active=eq.true&limit=500";
  if (config.authUserId) {
    const byAuthUser = await rest(
      config,
      `continuity_memberships?environment=eq.${encodeURIComponent(environment)}&auth_user_id=eq.${encodeURIComponent(config.authUserId)}&${select}`,
      { method: "GET", headers: { Prefer: "return=representation" } },
    );
    if (isMissingTable(byAuthUser.body)) return null;
    if (!byAuthUser.ok) throw new Error(messageOf(byAuthUser.body));
    return Array.isArray(byAuthUser.body)
      ? (byAuthUser.body as ContinuityMembershipRow[]).filter((row) => (
          row.auth_user_id === config.authUserId && Boolean(row.household_id) && Boolean(row.member_id)
        ))
      : [];
  }
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
  return await personalFromRow(rows[0], row.member_id);
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
    const household = await snapshotFromRow(snapshotRows[0]);
    if (!household || household.environment !== environment) continue;
    if (household.householdId !== membership.household_id) continue;
    try {
      assertHouseholdBinding(
        household,
        {
          environment,
          householdId: membership.household_id,
          memberId: membership.member_id,
          googleSubject: identity.subject,
          googleEmail: identity.email,
        },
        "pull",
      );
    } catch {
      continue;
    }
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

  // Production membership INSERT stays privileged until Auth/RLS cutover. Never hand
  // anon clients the ability to mint Production membership rows with the publishable key.
  if (snapshot.environment === "production") {
    const existing = await continuityMembershipRows(config, identity, "production");
    const match = (existing ?? []).find((row) => (
      row.household_id === snapshot.householdId && row.member_id === memberId
    ));
    if (!match) {
      throw new Error(
        "Production continuity membership is missing. Seed the owner row with a reviewed migration before cloud writes.",
      );
    }
  } else if (!config.authUserId) {
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
  }
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
        payload: await encodeHouseholdPayload(personal),
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
  const pulled = await snapshotFromRow(rows[0]);
  if (!pulled) return null;
  return assertHouseholdBinding(
    { ...pulled, linked: true, baseRevision: pulled.revision },
    { environment, inviteCode: phrase },
    "pull",
  );
}

/**
 * Google-account discovery for hosted continuity. Development may fall back to a
 * bounded snapshot scan while membership tables are missing. Production is
 * membership-scoped only and stays off unless VITE_PRODUCTION_CONTINUITY=1.
 */
export async function discoverSupabaseHouseholdsByGoogleIdentity(
  identity: GoogleIdentitySelector,
  config = readSupabaseConfig(),
  environment: Environment = "development",
): Promise<DiscoveredHousehold[]> {
  if (!config || !hostedContinuityAllowed(environment)) return [];
  const fromMemberships = await discoverFromContinuityMemberships(config, identity, environment);
  if (fromMemberships !== null) return fromMemberships;
  // Never bulk-scan Production snapshots with the publishable key.
  if (environment !== "development") return [];
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
      const household = await snapshotFromRow(row);
      if (!household || household.environment !== environment || found.has(household.householdId)) continue;
      const memberId = memberIdForGoogleIdentity(household, identity);
      if (!memberId) continue;
      assertHouseholdBinding(
        household,
        {
          environment,
          householdId: household.householdId,
          memberId,
          googleSubject: identity.subject,
          googleEmail: identity.email,
        },
        "pull",
      );
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

/** Active membership role for owner Restore gate. Null if unknown / offline. */
export async function fetchContinuityMembershipRole(input: {
  householdId: string;
  memberId: string;
  identity: GoogleIdentitySelector;
  environment?: Environment;
  config?: SupabaseConfig | null;
}): Promise<"owner" | "member" | null> {
  const environment = input.environment ?? "development";
  const config = input.config === undefined ? readSupabaseConfig() : input.config;
  if (!config || !hostedContinuityAllowed(environment)) return null;
  const rows = await continuityMembershipRows(config, input.identity, environment);
  if (!rows) return null;
  const match = rows.find((row) => (
    row.household_id === input.householdId && row.member_id === input.memberId
  ));
  if (!match) return null;
  if (match.role === "owner") return "owner";
  if (match.role === "member") return "member";
  return null;
}

async function readRemoteSnapshot(
  config: SupabaseConfig,
  householdId: string,
  environment: Environment,
): Promise<Household | null> {
  const result = await rest(
    config,
    `household_snapshots?household_id=eq.${encodeURIComponent(householdId)}&environment=eq.${encodeURIComponent(environment)}&select=payload&limit=1`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (!result.ok) {
    if (isMissingTable(result.body)) return null;
    throw new Error(messageOf(result.body));
  }
  const rows = Array.isArray(result.body) ? result.body as { payload: string | Household }[] : [];
  const pulled = await snapshotFromRow(rows[0]);
  if (!pulled) return null;
  return assertHouseholdBinding(pulled, { environment, householdId }, "pull");
}

/** Membership-scoped live pull: one row by household id + environment (Auth JWT). */
export async function pullHouseholdSnapshotById(
  householdId: string,
  environment: Environment = "development",
  config = readSupabaseConfig(),
  continuityIdentity?: GoogleIdentitySelector | null,
): Promise<Household | null> {
  if (!config || !hostedContinuityAllowed(environment)) return null;
  const result = await rest(
    config,
    `household_snapshots?household_id=eq.${encodeURIComponent(householdId)}&environment=eq.${encodeURIComponent(environment)}&select=payload&limit=1`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (!result.ok) {
    if (isMissingTable(result.body)) return null;
    throw new Error(messageOf(result.body));
  }
  const rows = Array.isArray(result.body) ? result.body as { payload: string | Household }[] : [];
  const pulled = await snapshotFromRow(rows[0]);
  if (!pulled) return null;
  const binding: {
    environment: Environment;
    householdId: string;
    googleSubject?: string;
    googleEmail?: string;
    memberId?: string;
  } = { environment, householdId };
  if (continuityIdentity && (continuityIdentity.subject.trim() || continuityIdentity.email.trim())) {
    binding.googleSubject = continuityIdentity.subject;
    binding.googleEmail = continuityIdentity.email;
    const memberId = memberIdForGoogleIdentity(pulled, continuityIdentity);
    if (!memberId) {
      throw new ValidationError("That cloud household is not linked to this Google account. Nothing was imported.");
    }
    binding.memberId = memberId;
  }
  return assertHouseholdBinding(
    { ...pulled, linked: true, baseRevision: pulled.revision },
    binding,
    "pull",
  );
}

/** Same-member second-device personal tip (Auth JWT). */
export async function pullPersonalSnapshotById(
  householdId: string,
  memberId: string,
  environment: Environment = "development",
  config = readSupabaseConfig(),
): Promise<PersonalEnvelope | null> {
  if (!config || !hostedContinuityAllowed(environment)) return null;
  const result = await rest(
    config,
    `continuity_personal_snapshots?environment=eq.${encodeURIComponent(environment)}&household_id=eq.${encodeURIComponent(householdId)}&member_id=eq.${encodeURIComponent(memberId)}&select=payload&limit=1`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (isMissingTable(result.body)) return null;
  if (!result.ok) throw new Error(messageOf(result.body));
  const rows = Array.isArray(result.body) ? result.body as { payload?: string | PersonalEnvelope }[] : [];
  const personal = await personalFromRow(rows[0], memberId);
  if (!personal) return null;
  assertPersonalEnvelopeBinding(personal, { environment, householdId, memberId });
  return personal;
}

export async function pushSupabaseHousehold(
  household: Household,
  config = readSupabaseConfig(),
  options?: {
    expectedRevision?: number;
    continuityIdentity?: GoogleIdentitySelector;
    /** Development-only recovery when Auth is off (D-143). Never set from automatic commits. */
    legacyLinkedPublish?: boolean;
  },
): Promise<PushHouseholdResult> {
  const continuityMemberId = hostedContinuityAllowed(household.environment) && options?.continuityIdentity
    ? memberIdForGoogleIdentity(household, options.continuityIdentity)
    : null;
  if (household.environment === "production" && options?.continuityIdentity && !continuityMemberId) {
    return {
      configured: Boolean(config),
      reachable: false,
      schema: false,
      skipped: true,
      error: "This Google account is not a member of that Production household.",
    };
  }
  // Production never publishes an unprojected full snapshot through the phrase/`linked` path.
  if (household.environment === "production" && !continuityMemberId) {
    return { configured: Boolean(config), reachable: false, schema: false, skipped: true };
  }
  const legacyLinked =
    Boolean(options?.legacyLinkedPublish) &&
    legacyLinkedPublishAllowed(household.environment) &&
    hostedTransportAllowed(household);
  // D-143: automatic continuity requires a resolved membership identity.
  // linked alone is no longer enough unless an explicit legacy publish opts in.
  if (!continuityMemberId && !legacyLinked) {
    return { configured: Boolean(config), reachable: false, schema: false, skipped: true };
  }
  const probe = await probeSupabase(config);
  if (!config || !probe.schema) return { ...probe, skipped: false };
  const snapshot = ensureHouseholdShape(household);
  if (!snapshot.linked && !continuityMemberId) {
    return { ...probe, skipped: true };
  }
  const expectedRevision = options?.expectedRevision ?? snapshot.baseRevision ?? 0;
  const cloudSnapshot = continuityMemberId
    ? householdCloudProjection(snapshot, continuityMemberId)
    : snapshot;
  const snapshotHash = await financialAuditHash(cloudSnapshot);
  const payload = await encodeSharedSnapshotPayload(cloudSnapshot);
  const identity = options?.continuityIdentity;
  // Personal-before-CAS only when the household row already exists (FK on memberships).
  // First create still publishes scope after the household write.
  const publishScopeBeforeCas = Boolean(continuityMemberId && identity && expectedRevision > 0);
  if (publishScopeBeforeCas && continuityMemberId && identity) {
    await publishContinuityMemberScope(config, snapshot, continuityMemberId, identity);
  }

  if (config.authUserId && continuityMemberId && identity && expectedRevision === 0) {
    const member = snapshot.members.find((item) => item.id === continuityMemberId);
    const create = await rest(config, "rpc/hearth_create_household", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        p_household_id: snapshot.householdId,
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
        p_member_id: continuityMemberId,
        p_display_name: member?.name ?? "",
      }),
    });
    if (create.ok) {
      const created = parseCasRpcBody(create.body);
      if (created?.ok) {
        try {
          await publishContinuityMemberScope(config, snapshot, continuityMemberId, identity);
        } catch (caught) {
          return {
            ...probe,
            schema: true,
            skipped: true,
            conflict: false,
            duplicate: created.duplicate === true,
            usedCasRpc: true,
            error: caught instanceof Error
              ? `Household created in the cloud, but Personal scope failed: ${caught.message}`
              : "Household created in the cloud, but Personal scope failed.",
          };
        }
        return {
          ...probe,
          schema: true,
          error: undefined,
          skipped: false,
          conflict: false,
          duplicate: created.duplicate === true,
          usedCasRpc: true,
        };
      }
      if (created && !created.ok && created.reason !== "household-already-exists") {
        return {
          ...probe,
          schema: true,
          conflict: true,
          usedCasRpc: true,
          remote: (await remoteFromCasPayload(created.remotePayload)) ?? undefined,
          error: conflictMessage(created.reason),
        };
      }
    } else if (!isMissingRpc(create.body)) {
      throw new Error(messageOf(create.body));
    }
  }

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
      if (!publishScopeBeforeCas && continuityMemberId && identity) {
        try {
          await publishContinuityMemberScope(config, snapshot, continuityMemberId, identity);
        } catch (caught) {
          // Shared CAS already committed. Keep the outbox pending so Personal can retry.
          return {
            ...probe,
            schema: true,
            skipped: true,
            conflict: false,
            duplicate: cas.duplicate === true,
            usedCasRpc: true,
            error: caught instanceof Error
              ? `Shared books reached the cloud, but Personal scope failed: ${caught.message}`
              : "Shared books reached the cloud, but Personal scope failed.",
          };
        }
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
        remote: (await remoteFromCasPayload(cas.remotePayload)) ?? undefined,
        error: conflictMessage(cas.reason),
      };
    }
  } else if (!isMissingRpc(rpc.body)) {
    throw new Error(messageOf(rpc.body));
  }

  // Automatic continuity must not fall through to the racy GET-compare-POST path.
  // Legacy publish remains only for explicit Auth-off recovery (`legacyLinkedPublish`).
  if (continuityMemberId || config.authUserId) {
    return {
      ...probe,
      schema: true,
      skipped: true,
      conflict: false,
      usedCasRpc: false,
      error: "Hosted CAS RPC is unavailable. Automatic sharing stopped instead of racing a legacy upsert. Retry after the kitchen recovers, or use Advanced recovery only while Auth is off.",
    };
  }

  // Migration 002 not applied: keep the legacy client CAS path (still racy under load).
  return pushSupabaseHouseholdLegacy(
    config,
    probe,
    snapshot,
    cloudSnapshot,
    expectedRevision,
    continuityMemberId,
    identity,
    publishScopeBeforeCas,
  );
}

async function pushSupabaseHouseholdLegacy(
  config: SupabaseConfig,
  probe: SupabaseProbe,
  snapshot: Household,
  cloudSnapshot: Household,
  expectedRevision: number,
  continuityMemberId: string | null,
  continuityIdentity: GoogleIdentitySelector | undefined,
  personalAlreadyPublished: boolean,
): Promise<PushHouseholdResult> {
  let remote: Household | null = null;
  try {
    remote = await readRemoteSnapshot(config, snapshot.householdId, snapshot.environment);
  } catch (caught) {
    // Fail closed: mismatched identity never posts; surface as conflict so outbox stays blocked.
    if (caught instanceof ValidationError) {
      return {
        ...probe,
        schema: true,
        conflict: true,
        usedCasRpc: false,
        error: caught.message,
      };
    }
    throw caught;
  }
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
  if (!personalAlreadyPublished && continuityMemberId && continuityIdentity) {
    await publishContinuityMemberScope(config, snapshot, continuityMemberId, continuityIdentity);
  }
  const snap = await rest(config, "household_snapshots?on_conflict=household_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      household_id: snapshot.householdId,
      invite_phrase: snapshot.inviteCode,
      environment: snapshot.environment,
      payload: await encodeSharedSnapshotPayload(cloudSnapshot),
      updated_at: new Date().toISOString(),
      revision: snapshot.revision,
      snapshot_hash: await financialAuditHash(cloudSnapshot),
    }),
  });
  if (!snap.ok) throw new Error(messageOf(snap.body));
  return { ...probe, schema: true, error: undefined, skipped: false, conflict: false, usedCasRpc: false };
}
