import {
  assembleHousehold,
  splitForSync,
} from "./core/sync.ts";
import { applyHearthPass, isHearthPass, parseHearthPass } from "./core/pass.ts";
import { inviteFromText, isValidInviteToken } from "./core/invite.ts";
import { markLinked, markSynchronized } from "./core/sharing.ts";
import { canAutoMergeConflict, recordConflict } from "./core/conflict.ts";
import type { Environment, Household } from "./core/types.ts";
import { probeSupabase, pullSupabaseHousehold } from "./ledger/supabase.ts";

export const UNPUBLISHED_PHRASE =
  "No household is published with that phrase. Check the three words, or on the other phone open Invite and tap Publish to the cloud.";

export async function cloudBooksLive(): Promise<boolean> {
  const hosted = await probeSupabase();
  return hosted.schema;
}

export async function createSharedHousehold(household: Household, _memberId: string): Promise<Household> {
  return markLinked(household);
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
  return household.linked ? household : markLinked(household);
}

export async function reconcileHousehold(local: Household, memberId: string): Promise<Household> {
  const remote = await pullSharedHousehold(local.inviteCode, memberId, local.environment);
  if (local.environment !== remote.environment) {
    throw new Error("That shared snapshot belongs to a different Development/Production pill.");
  }
  const localBase = local.baseRevision ?? 0;
  const remoteRevision = remote.revision ?? 0;
  const localRevision = local.revision ?? 0;
  if (remoteRevision === localBase && localRevision === localBase) {
    return markSynchronized({ ...local, linked: true });
  }
  if (remoteRevision > localBase && localRevision === localBase) {
    const remoteParts = splitForSync(remote, memberId);
    const localParts = splitForSync(local, memberId);
    const assembled = assembleHousehold(remoteParts.shared, localParts.personal, { linked: true });
    assembled.commandReceipts = [...(local.commandReceipts ?? []), ...(remote.commandReceipts ?? [])].filter(
      (row, index, rows) => rows.findIndex((item) => item.confirmationId === row.confirmationId) === index,
    );
    assembled.conflicts = [...(local.conflicts ?? []), ...(remote.conflicts ?? [])].filter(
      (row, index, rows) => rows.findIndex((item) => item.id === row.id) === index,
    );
    return markSynchronized(assembled);
  }
  if (remoteRevision === localBase && localRevision > localBase) {
    return local;
  }
  const auto = canAutoMergeConflict(local, remote);
  return recordConflict(local, remote, auto);
}

export function joinFromPastedSecret(
  raw: string,
  local: Household | null,
  memberId?: string,
  operatingEnvironment?: Environment,
): Household {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isHearthPass(parsed)) return applyHearthPass(local, parsed, memberId, operatingEnvironment);
    return applyHearthPass(local, parseHearthPass(trimmed), memberId, operatingEnvironment);
  }
  throw new Error("That paste is not a Hearth Pass.");
}

export function hostingHint(cloudLive: boolean): string {
  if (cloudLive) {
    return "Supabase Postgres is on. Publish is an explicit Confirm. A Hearth Pass or the three-word phrase is not encryption. Treat hosted rows as disclosed until Auth.";
  }
  return "This phone keeps local Postgres books. Shared join needs the Supabase tables; a Hearth Pass still works as a backup. Opening the kitchen does not publish.";
}
