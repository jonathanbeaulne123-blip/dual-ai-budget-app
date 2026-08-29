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
  const actor = token.actorMemberId;
  const undoneBibles = current.shifts
    .filter((shift) => dead.has(shift.id) && shift.shiftBible)
    .map((shift) => shift.shiftBible!);

  for (const id of postedIds) {
    if (current.transactions.some((row) => row.reversalOfId === id)) {
      throw new ValidationError("Already reversed. Undo cannot remove a row that has a reversal.");
    }
    const tx = current.transactions.find((row) => row.id === id);
    if (tx && actor && tx.createdBy && tx.createdBy !== actor) {
      throw new ValidationError("Undo cannot remove another person's money row.");
    }
    const shift = current.shifts.find((row) => row.id === id);
    if (shift && actor && shift.createdBy && shift.createdBy !== actor) {
      throw new ValidationError("Undo cannot remove another person's shift.");
    }
    if (shift) {
      const shiftTxIds = [
        ...(shift.transactionIds ?? []),
        shift.wagesTransactionId,
        shift.tipsTransactionId,
      ].filter((rowId): rowId is string => Boolean(rowId));
      if (shiftTxIds.some((txId) => current.transactions.some((row) => row.reversalOfId === txId))) {
        throw new ValidationError("Already reversed. Undo cannot remove a shift that has a reversal.");
      }
    }
  }

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
  // A visible Shift Confirm can also create private, non-financial workplace
  // sidecars. Remove those posted records in the same local Undo result so a
  // deleted shift never leaves attendance or a surprise helper orphaned until
  // the next replica merge applies the tombstones.
  next.coworkers = (next.coworkers ?? []).filter((row) => !dead.has(row.id));
  next.coworkerAttendance = (next.coworkerAttendance ?? []).filter((row) => !dead.has(row.id));
  next.coworkerSchedules = (next.coworkerSchedules ?? []).filter((row) => !dead.has(row.id));
  next.shiftBibles = (next.shiftBibles ?? []).filter((row) => !dead.has(row.id));
  const reopenedByEnvelope = new Map(undoneBibles.map((bible) => [bible.envelopeId, bible]));
  next.shiftEnvelopes = (next.shiftEnvelopes ?? []).map((envelope) => {
    const bible = reopenedByEnvelope.get(envelope.id);
    if (!bible || envelope.confirmedBibleId !== bible.id) return envelope;
    return {
      ...envelope,
      status: ["approved", "final"].includes(envelope.sourceFinality) ? "worked_ready" : "needs_review",
      confirmedBibleId: null,
      updatedAt: at,
    };
  });

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
