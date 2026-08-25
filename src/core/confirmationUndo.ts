import { cloneHousehold } from "./household.ts";
import { mergeTombstones } from "./sync.ts";
import { refreshDuplicateFlags } from "./duplicate.ts";
import { nextId } from "./ids.ts";
import { ValidationError, type CommitResult, type Household, type UndoToken } from "./types.ts";
import { isLedgerWrite } from "./writeKind.ts";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Fat-finger Undo: remove only this Confirm's posted ids from the current books.
 * Partner rows and later unrelated rows stay. Does not restore a whole snapshot.
 */
export function undoLedgerConfirm(current: Household, token: UndoToken): CommitResult {
  const postedIds = [...new Set((token.postedIds ?? []).filter(Boolean))];
  if (!postedIds.length) {
    throw new ValidationError("Nothing to undo for that change.");
  }
  if (!isLedgerWrite(token)) {
    throw new ValidationError("Kitchen changes do not use Undo.");
  }

  const previous = cloneHousehold(current);
  const next = cloneHousehold(current);
  const dead = new Set(postedIds);
  const at = nowIso();

  const beforeCount =
    next.transactions.length
    + next.shifts.length
    + (next.goalContributions ?? []).length
    + (next.goalPurchases ?? []).length
    + (next.claims ?? []).length;

  next.transactions = next.transactions.filter((tx) => !dead.has(tx.id));
  next.shifts = next.shifts.filter((shift) => !dead.has(shift.id));
  next.goalContributions = (next.goalContributions ?? []).filter((row) => !dead.has(row.id));
  next.goalPurchases = (next.goalPurchases ?? []).filter((row) => !dead.has(row.id));
  next.claims = (next.claims ?? []).filter((row) => !dead.has(row.id));
  next.sitDownSessions = (next.sitDownSessions ?? []).filter((row) => !dead.has(row.id));

  const afterCount =
    next.transactions.length
    + next.shifts.length
    + (next.goalContributions ?? []).length
    + (next.goalPurchases ?? []).length
    + (next.claims ?? []).length;
  if (afterCount === beforeCount) {
    throw new ValidationError("That change is already gone from the books.");
  }

  next.tombstones = mergeTombstones(
    next.tombstones ?? [],
    postedIds.map((id) => ({ id, deletedAt: at })),
  );
  next.transactions = refreshDuplicateFlags(next.transactions);
  next.lastCommittedAt = at;
  const activityId = nextId("ACT-", next.activity.map((item) => item.id), 6);
  next.activity = [
    ...next.activity,
    {
      id: activityId,
      at,
      action: "Undo",
      summary: `Undid: ${token.label}`,
      updatedAt: at,
    },
  ].slice(-200);

  return {
    household: next,
    warnings: [],
    postedIds: [],
    undo: {
      id: activityId,
      label: `Undid: ${token.label}`,
      snapshot: previous,
      postedIds: [],
      actorMemberId: token.actorMemberId,
    },
  };
}

/** Newest ledger Confirm for this member (LIFO). */
export function latestMemberLedgerToken(
  history: UndoToken[],
  memberId: string,
): UndoToken | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const token = history[index];
    if (!token || !isLedgerWrite(token)) continue;
    if (token.actorMemberId && token.actorMemberId !== memberId) continue;
    return token;
  }
  return null;
}

export function assertLatestMemberLedgerUndo(
  history: UndoToken[],
  memberId: string,
  token: UndoToken,
): void {
  const latest = latestMemberLedgerToken(history, memberId);
  if (!latest || latest.id !== token.id) {
    throw new ValidationError("Undo your latest money change first so the books stay in order.");
  }
}
