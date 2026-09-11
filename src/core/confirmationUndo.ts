import { reversePostedMoney } from "./commands.ts";
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
  if (token.commandKind === "acceptReviewedAccountHistory" || current.transactions.some(t => token.postedIds?.includes(t.id) && t.historyCorrectionId)) throw new ValidationError("Review a new atomic history correction; generic Undo cannot split this group.");
  const postedIds = [...new Set((token.postedIds ?? []).filter(Boolean))];
  if (!postedIds.length) {
    throw new ValidationError("Nothing to undo for that change.");
  }
  if (!isLedgerWrite(token)) {
    throw new ValidationError("Kitchen changes do not use Undo.");
  }

  if (token.commandKind === "addQuickSampleScenario") {
    for (const plan of current.potentialExpenses ?? []) {
      if (!postedIds.includes(plan.id)) continue;
      if (plan.createdBy !== token.actorMemberId || plan.status !== "planned" || plan.updatedAt !== plan.createdAt) {
        throw new ValidationError("A sample plan was changed or posted. Correct its history and plans individually instead of undoing the set.");
      }
    }
  }
  const previous = cloneHousehold(current);
  const next = cloneHousehold(current);
  const dead = new Set(postedIds);
  const partials=(current.goalPurchases??[]).filter(row=>row.envelopeUse&&dead.has(row.id));
  if(partials.length){
    if(partials.some(row=>row.memberId!==token.actorMemberId||row.transactionIds.some(id=>!dead.has(id))))throw new ValidationError("Undo the complete purchase from its original receipt.");
    let working=current;const reversedIds:string[]=[];
    for(const receipt of partials)for(const id of receipt.transactionIds){
      if(current.transactions.some(tx=>tx.reversalOfId===id||tx.refundOfId===id))throw new ValidationError("This purchase already has a correction or refund. Review its history.");
      const goal=current.goals.find(row=>row.id===receipt.goalId)!;
      const reversed=reversePostedMoney(working,id,{createdBy:receipt.memberId,visibility:goal.shared?"household":"personal",reversalDate:receipt.date});working=reversed.household;reversedIds.push(...reversed.postedIds);
    }
    return {household:working,postedIds:reversedIds,warnings:[],undo:{id:`undo-${token.id}`,label:"Reversed bank purchase; original receipt retained",snapshot:current,postedIds:reversedIds,commandKind:"undoConfirm"}};
  }
  const at = nowIso();
  const actor = token.actorMemberId;
  const reopenedPotentialIds = new Set(current.transactions
    .filter((tx) => dead.has(tx.id) && tx.source === "calendar" && tx.sourceId)
    .map((tx) => tx.sourceId!));
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
  if (token.commandKind === "addQuickSampleScenario") next.potentialExpenses = (next.potentialExpenses ?? []).filter(plan => !dead.has(plan.id));
  next.potentialExpenses = (next.potentialExpenses ?? []).map((plan) => (
    reopenedPotentialIds.has(plan.id) && plan.status === "posted" && plan.transactionId && dead.has(plan.transactionId)
      ? { ...plan, status: "planned" as const, transactionId: null, postedAt: null, updatedAt: at }
      : plan
  ));
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

const FUNDED_MONEY_REVERSAL_COMMANDS = new Set([
  "postEntry",
  "postPotentialExpense",
  "postHouseholdFundDirectDebit",
]);

/**
 * Return the current money rows that a supported funded Confirm must reverse.
 *
 * Funded facts are append-only, so confirmation-scoped deletion is not a safe
 * correction. Keep this decision command-kind-bound: a future command cannot
 * inherit reversal semantics merely by returning an id with a familiar prefix.
 */
export function fundedMoneyUndoTargets(current: Household, token: UndoToken): string[] {
  const postedIds = [...new Set((token.postedIds ?? []).filter(Boolean))];
  const currentFundEventIds = new Set((current.fundEvents ?? []).map((event) => event.id));
  const carriesFundFact = postedIds.some((id) => currentFundEventIds.has(id));
  if (!carriesFundFact) return [];

  if (!token.commandKind || !FUNDED_MONEY_REVERSAL_COMMANDS.has(token.commandKind)) {
    throw new ValidationError("That funded change needs its recorded correction path before it can be undone.");
  }

  const currentTransactionIds = postedIds.filter((id) => (
    current.transactions.some((transaction) => transaction.id === id)
  ));
  if (currentTransactionIds.length < 1 || currentTransactionIds.length > (["postEntry", "postPotentialExpense"].includes(token.commandKind) ? 2 : 1)) {
    throw new ValidationError("That funded change does not identify its current money rows to reverse.");
  }
  return currentTransactionIds;
}

/** Single-purchase callers retain their narrower contract. */
export function fundedMoneyUndoTarget(current: Household, token: UndoToken): string | null {
  const ids = fundedMoneyUndoTargets(current, token);
  if (ids.length > 1) throw new ValidationError("This split purchase has two category entries. Undo the complete confirmation.");
  return ids[0] ?? null;
}
