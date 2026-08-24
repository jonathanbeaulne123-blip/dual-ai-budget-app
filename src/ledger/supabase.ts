import { ensureHouseholdShape } from "../core/sync.ts";
import { inviteFromText } from "../core/invite.ts";
import { memberIdForGoogleIdentity, type GoogleIdentitySelector } from "../core/google.ts";
import { hostedTransportAllowed } from "../core/sharing.ts";
import type { Environment, Household } from "../core/types.ts";

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
};

export type DiscoveredHousehold = {
  household: Household;
  memberId: string;
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

function snapshotFromRow(row: { payload?: string | Household } | undefined): Household | null {
  if (!row?.payload) return null;
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) as Household : row.payload;
  return ensureHouseholdShape({ ...payload, linked: true });
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
 * Temporary Development discovery for D-112. Hosted rows are deliberately open
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
  const remote = await readRemoteSnapshot(config, snapshot.householdId);
  const expectedRevision = options?.expectedRevision ?? snapshot.baseRevision ?? 0;
  if (remote && remote.environment !== snapshot.environment) {
    return {
      ...probe,
      schema: true,
      conflict: true,
      remote,
      error: "That hosted snapshot is a different environment. Nothing was overwritten.",
    };
  }
  if (remote && remote.revision !== expectedRevision) {
    return {
      ...probe,
      schema: true,
      conflict: true,
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
  const snap = await rest(config, "household_snapshots?on_conflict=household_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      household_id: snapshot.householdId,
      invite_phrase: snapshot.inviteCode,
      environment: snapshot.environment,
      payload: JSON.stringify(snapshot),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!snap.ok) throw new Error(messageOf(snap.body));
  return { ...probe, schema: true, error: undefined, skipped: false, conflict: false };
}
