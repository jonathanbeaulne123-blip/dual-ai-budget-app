import {
  assembleHousehold,
  mergePersonal,
  mergeShared,
  splitForSync,
} from "./core/sync.ts";
import { applyHearthPass, isHearthPass, parseHearthPass } from "./core/pass.ts";
import { inviteFromText, isValidInviteToken } from "./core/invite.ts";
import type { Environment, Household } from "./core/types.ts";
import { probeSupabase, pullSupabaseHousehold, pushSupabaseHousehold } from "./ledger/supabase.ts";

export const UNPUBLISHED_PHRASE =
  "No household is published with that phrase. Check the three words, or on the other phone open Invite and tap Publish to the cloud.";

export async function cloudBooksLive(): Promise<boolean> {
  const hosted = await probeSupabase();
  return hosted.schema;
}

function publishError(hosted: { schema: boolean; error?: string }): Error {
  if (hosted.error) return new Error(hosted.error);
  return new Error("Could not publish the shared household.");
}

export async function createSharedHousehold(household: Household, _memberId: string): Promise<Household> {
  const hosted = await pushSupabaseHousehold(household);
  if (hosted.schema) return { ...household, linked: true };
  throw publishError(hosted);
}

export async function joinSharedHousehold(
  inviteCode: string,
  _memberId?: string,
  environment: Environment = "development",
): Promise<Household> {
  const token = inviteFromText(inviteCode);
  if (!isValidInviteToken(token)) {
    throw new Error("Use the three-word phrase, the join link, or a Hearth Pass file.");
  }
  const fromSupabase = await pullSupabaseHousehold(token, undefined, environment);
  if (fromSupabase) return fromSupabase;
  const hosted = await probeSupabase();
  if (hosted.schema) {
    throw new Error(UNPUBLISHED_PHRASE);
  }
  if (hosted.reachable && !hosted.schema) {
    throw new Error("Supabase is on, but the books tables are not in the API yet. Re-run supabase/migrations/001_hearth_books.sql in the SQL Editor.");
  }
  throw new Error(hosted.error || UNPUBLISHED_PHRASE);
}

export async function pullSharedHousehold(
  inviteCode: string,
  _memberId: string,
  environment: Environment = "development",
): Promise<Household> {
  const fromSupabase = await pullSupabaseHousehold(inviteFromText(inviteCode), undefined, environment);
  if (fromSupabase) return fromSupabase;
  throw new Error(UNPUBLISHED_PHRASE);
}

export async function pushSharedHousehold(household: Household, _memberId: string): Promise<Household> {
  const hosted = await pushSupabaseHousehold(household);
  if (hosted.schema) return { ...household, linked: true };
  throw publishError(hosted);
}

export async function reconcileHousehold(local: Household, memberId: string): Promise<Household> {
  const remote = await pullSharedHousehold(local.inviteCode, memberId, local.environment);
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
