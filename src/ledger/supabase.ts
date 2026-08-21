import { ensureHouseholdShape } from "../core/sync.ts";
import { inviteFromText } from "../core/invite.ts";
import type { Household } from "../core/types.ts";

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

const DEFAULT_URL = "https://tykhocwacaxwquhynkok.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS";

export function readSupabaseConfig(): SupabaseConfig | null {
  if (import.meta.env.VITEST && import.meta.env.VITE_SUPABASE_LIVE !== "1") return null;
  const url = String(import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL).replace(/\/$/, "");
  const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY);
  if (!url || !key) return null;
  return { url, key };
}

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

export async function pullSupabaseHousehold(invite: string, config = readSupabaseConfig()): Promise<Household | null> {
  if (!config) return null;
  const phrase = inviteFromText(invite);
  const result = await rest(
    config,
    `household_snapshots?invite_phrase=eq.${encodeURIComponent(phrase)}&select=payload&limit=1`,
    { method: "GET", headers: { Prefer: "return=representation" } },
  );
  if (!result.ok) {
    if (isMissingTable(result.body)) return null;
    throw new Error(messageOf(result.body));
  }
  const rows = Array.isArray(result.body) ? result.body as { payload: string | Household }[] : [];
  const row = rows[0];
  if (!row) return null;
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) as Household : row.payload;
  return ensureHouseholdShape({ ...payload, linked: true });
}

export async function pushSupabaseHousehold(household: Household, config = readSupabaseConfig()): Promise<SupabaseProbe> {
  const probe = await probeSupabase(config);
  if (!config || !probe.schema) return probe;
  const snapshot = ensureHouseholdShape({ ...household, linked: true });
  const del = await rest(config, `households?id=eq.${encodeURIComponent(snapshot.householdId)}`, { method: "DELETE" });
  if (!del.ok && !isMissingTable(del.body)) throw new Error(messageOf(del.body));
  const house = await rest(config, "households", {
    method: "POST",
    body: JSON.stringify({
      id: snapshot.householdId,
      name: snapshot.name,
      timezone: snapshot.timezone,
      currency: snapshot.currency,
      environment: snapshot.environment,
      invite_phrase: snapshot.inviteCode,
      linked: true,
      revision: snapshot.revision,
      last_committed_at: snapshot.lastCommittedAt,
    }),
  });
  if (!house.ok) throw new Error(messageOf(house.body));
  const snap = await rest(config, "household_snapshots", {
    method: "POST",
    body: JSON.stringify({
      household_id: snapshot.householdId,
      invite_phrase: snapshot.inviteCode,
      environment: snapshot.environment,
      payload: JSON.stringify(snapshot),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!snap.ok) throw new Error(messageOf(snap.body));
  return { ...probe, schema: true, error: undefined };
}
