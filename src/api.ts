import {
  assembleHousehold,
  mergePersonal,
  mergeShared,
  splitForSync,
} from "./core/sync.ts";
import { applyHearthPass, isHearthPass, parseHearthPass } from "./core/pass.ts";
import { inviteFromText, isValidInviteToken } from "./core/invite.ts";
import type { Household } from "./core/types.ts";
import { probeSupabase, pullSupabaseHousehold, pushSupabaseHousehold } from "./ledger/supabase.ts";

export function apiUrl(): string {
  return import.meta.env.VITE_HEARTH_API || "/.netlify/functions/hearth";
}

export async function probeHearthApi(): Promise<boolean> {
  const hosted = await probeSupabase();
  if (hosted.schema) return true;
  try {
    const response = await fetch(apiUrl(), { method: "GET" });
    if (!response.ok) return false;
    const data = await response.json() as { ok?: boolean; service?: string };
    return data.ok === true && data.service === "hearth";
  } catch {
    return false;
  }
}

async function post(body: unknown): Promise<Household> {
  const response = await fetch(apiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: { error?: string; household?: Household } = {};
  try {
    data = await response.json() as { error?: string; household?: Household };
  } catch {
    throw new Error("The shared household server is not on this host yet. Send a Hearth Pass instead.");
  }
  if (!response.ok || !data.household) {
    throw new Error(data.error || "Could not reach the shared household.");
  }
  return data.household;
}

export async function createSharedHousehold(household: Household, memberId: string): Promise<Household> {
  const hosted = await pushSupabaseHousehold(household);
  if (hosted.schema) return { ...household, linked: true };
  try {
    return await post({ action: "create", household, memberId, inviteCode: inviteFromText(household.inviteCode) });
  } catch {
    throw new Error(hosted.error || "Could not publish the shared household.");
  }
}

export async function joinSharedHousehold(inviteCode: string, memberId?: string): Promise<Household> {
  const token = inviteFromText(inviteCode);
  if (!isValidInviteToken(token)) {
    throw new Error("Use the three-word phrase, the join link, or a Hearth Pass file.");
  }
  const fromSupabase = await pullSupabaseHousehold(token);
  if (fromSupabase) return fromSupabase;
  const hosted = await probeSupabase();
  if (hosted.schema) {
    throw new Error("That phrase is right, but no household has been published to Supabase yet. On the other phone open Invite and wait until it says the shared books are live.");
  }
  if (hosted.reachable && !hosted.schema) {
    throw new Error("Supabase is on, but the books tables are not created yet. Paste supabase/migrations/001_hearth_books.sql into the SQL Editor and Run, or send the real Postgres password from Connect (not [YOUR-PASSWORD]). It never goes in the phone app.");
  }
  try {
    return await post({ action: "join", inviteCode: token, memberId });
  } catch (caught) {
    throw caught instanceof Error ? caught : new Error(String(caught));
  }
}

export async function pullSharedHousehold(inviteCode: string, memberId: string): Promise<Household> {
  return post({ action: "pull", inviteCode: inviteFromText(inviteCode), memberId });
}

export async function pushSharedHousehold(household: Household, memberId: string): Promise<Household> {
  const hosted = await pushSupabaseHousehold(household);
  const next = { ...household, linked: hosted.schema || household.linked };
  try {
    return await post({
      action: "push",
      inviteCode: inviteFromText(household.inviteCode),
      memberId,
      household: next,
    });
  } catch {
    if (hosted.schema) return next;
    throw new Error(hosted.error || "Could not publish the shared household.");
  }
}

export async function reconcileHousehold(local: Household, memberId: string): Promise<Household> {
  const remote = await pullSharedHousehold(local.inviteCode, memberId);
  const localParts = splitForSync(local, memberId);
  const remoteParts = splitForSync(remote, memberId);
  return assembleHousehold(
    mergeShared(remoteParts.shared, localParts.shared),
    mergePersonal(remoteParts.personal, localParts.personal),
  );
}

export function joinFromPastedSecret(raw: string, local: Household | null, memberId?: string): Household {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isHearthPass(parsed)) return applyHearthPass(local, parsed, memberId);
    return applyHearthPass(local, parseHearthPass(trimmed), memberId);
  }
  throw new Error("That paste is not a Hearth Pass.");
}

export function hostingHint(cloudLive: boolean): string {
  if (cloudLive) {
    return "Supabase Postgres is on. The three-word phrase opens the shared books.";
  }
  return "This phone keeps local Postgres books. Shared join needs the Supabase tables; a Hearth Pass still works as a backup.";
}
