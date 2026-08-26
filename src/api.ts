import {
  assembleHousehold,
  splitForSync,
} from "./core/sync.ts";
import { applyHearthPass, isHearthPass, parseHearthPass } from "./core/pass.ts";
import { inviteFromText, isValidInviteToken } from "./core/invite.ts";
import { markLinked, markSynchronized } from "./core/sharing.ts";
import { canAutoMergeConflict, canAbsorbDisjointSharedMoney, absorbDisjointSharedMoney, recordConflict } from "./core/conflict.ts";
import type { Environment, Household } from "./core/types.ts";
import { probeSupabase, pullSupabaseHousehold } from "./ledger/supabase.ts";

export const UNPUBLISHED_PHRASE =
  "No household matches that phrase in the cloud. Prefer Continue with Google on both phones. Phrase join is Advanced recovery only; a Hearth Pass file also works offline.";

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
  return reconcileHouseholdSnapshots(local, remote, memberId);
}

export async function reconcileHouseholdSnapshots(
  local: Household,
  remote: Household,
  memberId: string,
): Promise<Household> {
  if (local.environment !== remote.environment) {
    throw new Error("That shared snapshot belongs to a different Development/Production pill.");
  }
  if (remote.householdId && local.householdId && remote.householdId !== local.householdId) {
    throw new Error("That shared snapshot belongs to a different household.");
  }
  if (remote.inviteCode && local.inviteCode && inviteFromText(remote.inviteCode) !== inviteFromText(local.inviteCode)) {
    throw new Error("That shared snapshot does not match this household invite.");
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
  if (canAbsorbDisjointSharedMoney(local, remote)) {
    return absorbDisjointSharedMoney(local, remote, memberId);
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
    return "Cloud continuity is on. After Google sign-in, accepted books share automatically. Phrase and Hearth Pass are Advanced recovery — not encryption.";
  }
  return "This phone keeps local Postgres books. Continue with Google for cross-device continuity. A Hearth Pass still works as an offline backup. Opening the kitchen does not upload.";
}
