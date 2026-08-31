import { monthEndKey, parseDateKey, parseMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { sha256Hex } from "./commandIdentity.ts";
import { cloneHousehold } from "./household.ts";
import { nextId, nowIso } from "./ids.ts";
import { booksEquation, compileHousehold, trialBalance } from "./journal.ts";
import { projectHouseholdFund, shapeHouseholdFundEvents } from "./householdFund.ts";
import { bookBalanceAsOf, isMonthClosed } from "./statements.ts";
import { runMonthRehearsalCorrectionPractice } from "./monthRehearsalPractice.ts";
import type {
  CommitResult,
  Household,
  MonthRehearsal,
  MonthRehearsalAcknowledgement,
  MonthRehearsalCheckpointSnapshot,
  MonthRehearsalFrictionOutcome,
  MonthRehearsalMemberApproval,
  MonthRehearsalReceiptKind,
  MonthRehearsalTaskId,
  MonthRehearsalTaskProgress,
  MonthRehearsalWeekProgress,
  Transaction,
} from "./types.ts";
import { ValidationError } from "./types.ts";

export const BIANCA_APPROVAL_STATEMENT = "I understand it, trust it, and want to use it next month.";
export const JONATHAN_COUNTERSIGNATURE = "We reviewed this month together.";
export const BIANCA_PLAYTEST_CARD = [
  "Start the action you would normally do.",
  "Link the Confirm you recognize.",
  "Open See why if a number surprises you.",
  "Tell us where you paused, needed help, or stopped.",
] as const;

type WeekNumber = 1 | 2 | 3 | 4;

export type RehearsalTaskDefinition = {
  id: MonthRehearsalTaskId;
  week: WeekNumber;
  title: string;
  hercules: string;
  required: boolean;
  allowDidNotHappen: boolean;
  receiptKinds: MonthRehearsalReceiptKind[];
};

export const MONTH_REHEARSAL_TASKS: readonly RehearsalTaskDefinition[] = [
  { id: "opening-truth", week: 1, title: "Begin with today's truth", hercules: "Let's put the balances you already have on the books. Nothing here is income or spending.", required: true, allowDidNotHappen: false, receiptKinds: ["command"] },
  { id: "income", week: 1, title: "Add income that arrived", hercules: "If income arrived this week, open the ordinary Add flow and confirm it there.", required: false, allowDidNotHappen: true, receiptKinds: ["command"] },
  { id: "groceries", week: 1, title: "Add groceries you bought", hercules: "Use a real grocery purchase, or say it did not happen this week.", required: false, allowDidNotHappen: true, receiptKinds: ["command"] },
  { id: "fund-setup", week: 1, title: "Set up our Fund", hercules: "Open the Household Fund and agree who keeps its real bank balance.", required: true, allowDidNotHappen: false, receiptKinds: ["command"] },
  { id: "fund-contribution", week: 1, title: "Confirm one Fund contribution", hercules: "Use the real Fund confirmation. This card cannot move the money for you.", required: true, allowDidNotHappen: false, receiptKinds: ["fund-event"] },
  { id: "shared-fund-purchase", week: 1, title: "Make one shared Fund purchase", hercules: "Post one purchase through the ordinary Confirm and link its Fund receipt here.", required: true, allowDidNotHappen: false, receiptKinds: ["fund-event", "command"] },
  { id: "bills", week: 2, title: "Post bills that were due", hercules: "Post actual bills in Add, or say none happened this week.", required: false, allowDidNotHappen: true, receiptKinds: ["command"] },
  { id: "card-payment", week: 2, title: "Make the card payment", hercules: "If a payment was due, use the normal transfer Confirm. Otherwise record that it did not happen.", required: false, allowDidNotHappen: true, receiptKinds: ["command"] },
  { id: "fund-partial-settlement", week: 2, title: "Partly settle the shared purchase", hercules: "Settle part of what the Fund owes through its real confirmation.", required: true, allowDidNotHappen: false, receiptKinds: ["fund-event"] },
  { id: "refund", week: 3, title: "Link a refund that occurred", hercules: "If money came back, link its ordinary refund Confirm. If not, say it did not happen.", required: false, allowDidNotHappen: true, receiptKinds: ["command", "fund-event"] },
  { id: "correction-practice", week: 3, title: "Practice one correction", hercules: "We'll make and reverse a fictional mistake in a practice copy. Your real books will not change.", required: true, allowDidNotHappen: false, receiptKinds: ["practice"] },
  { id: "account-reconciliation", week: 3, title: "Reconcile the shared accounts", hercules: "Compare the statement number with Hearth and keep going only when the relevant accounts tie.", required: true, allowDidNotHappen: false, receiptKinds: ["reconciliation"] },
  { id: "fund-final-settlement", week: 4, title: "Finish the Fund settlement", hercules: "Bring the shared purchase due to zero with the real Fund control.", required: true, allowDidNotHappen: false, receiptKinds: ["fund-event"] },
  { id: "fund-reconciliation", week: 4, title: "Bianca reconciles the Fund", hercules: "Bianca compares the Fund's real bank total. Only a tied Fund reconciliation completes this step.", required: true, allowDidNotHappen: false, receiptKinds: ["fund-event"] },
  { id: "month-review", week: 4, title: "Review the month together", hercules: "Read the four weekly proofs together and open See why anywhere a number feels surprising.", required: true, allowDidNotHappen: false, receiptKinds: ["review"] },
  { id: "month-close", week: 4, title: "Close the month", hercules: "Use the existing Books close after every red checkpoint is resolved.", required: true, allowDidNotHappen: false, receiptKinds: ["month-close"] },
] as const;

const OUTCOMES = new Set<MonthRehearsalFrictionOutcome>(["clear", "hesitated", "needed-help", "distrusted-number", "stopped"]);
const FINANCIAL_TASKS = new Set<MonthRehearsalTaskId>([
  "opening-truth", "income", "groceries", "fund-setup", "fund-contribution", "shared-fund-purchase",
  "bills", "card-payment", "fund-partial-settlement", "refund", "fund-final-settlement", "fund-reconciliation",
]);

function validIso(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

function commandTime(value?: string): string {
  if (!value) return nowIso();
  if (Number.isNaN(Date.parse(value))) throw new ValidationError("Rehearsal time must be an ISO timestamp.");
  return new Date(value).toISOString();
}

function requireDevelopment(household: Household): void {
  if (household.environment !== "development") throw new ValidationError("Our month is Development only.");
  if (household.timezone !== "America/Toronto") throw new ValidationError("Our month follows Toronto book dates.");
}

function requireMember(household: Household, memberId: string): void {
  if (!household.members.some((member) => member.id === memberId && member.active)) {
    throw new ValidationError("That active household member is not available.");
  }
}

function taskDefinition(taskId: MonthRehearsalTaskId): RehearsalTaskDefinition {
  const definition = MONTH_REHEARSAL_TASKS.find((task) => task.id === taskId);
  if (!definition) throw new ValidationError("That month action is not part of this rehearsal.");
  return definition;
}

export function monthRehearsalWeekBounds(monthKey: MonthKey, week: WeekNumber): { startsOn: DateKey; endsOn: DateKey } {
  parseMonthKey(monthKey);
  const starts = [1, 8, 15, 22] as const;
  const ends = [7, 14, 21, Number(monthEndKey(monthKey).slice(8))] as const;
  return {
    startsOn: `${monthKey}-${String(starts[week - 1]).padStart(2, "0")}`,
    endsOn: `${monthKey}-${String(ends[week - 1]).padStart(2, "0")}`,
  };
}

export function rehearsalWeekAvailability(monthKey: MonthKey, week: WeekNumber, today: DateKey): "future" | "available" | "past" {
  parseDateKey(today);
  const bounds = monthRehearsalWeekBounds(monthKey, week);
  if (today < bounds.startsOn) return "future";
  if (today > bounds.endsOn) return "past";
  return "available";
}

function newTask(rehearsalId: string, definition: RehearsalTaskDefinition, at: string): MonthRehearsalTaskProgress {
  return {
    id: `${rehearsalId}-TASK-${definition.id}`,
    taskId: definition.id,
    week: definition.week,
    required: definition.required,
    allowDidNotHappen: definition.allowDidNotHappen,
    status: "not-started",
    receipt: null,
    skip: null,
    attempts: [],
    updatedAt: at,
  };
}

function newWeeks(rehearsalId: string, monthKey: MonthKey, at: string): MonthRehearsalWeekProgress[] {
  return ([1, 2, 3, 4] as const).map((week) => {
    const bounds = monthRehearsalWeekBounds(monthKey, week);
    return {
      id: `${rehearsalId}-W${week}`,
      week,
      ...bounds,
      tasks: MONTH_REHEARSAL_TASKS.filter((task) => task.week === week).map((task) => newTask(rehearsalId, task, at)),
      checkpoint: null,
      acknowledgements: [],
      updatedAt: at,
    };
  });
}

function nonMoneyCommit(previous: Household, next: Household, label: string, at: string): CommitResult {
  next.lastCommittedAt = at;
  return {
    household: next,
    warnings: [],
    postedIds: [],
    undo: {
      id: nextId("UNDO-REHEARSAL-", []),
      label,
      snapshot: previous,
      postedIds: [],
      commandKind: "updateMonthRehearsal",
    },
  };
}

function findRehearsal(household: Household, rehearsalId: string): MonthRehearsal {
  const rehearsal = (household.monthRehearsals ?? []).find((row) => row.id === rehearsalId);
  if (!rehearsal) throw new ValidationError("That month rehearsal is no longer available.");
  return rehearsal;
}

function getRehearsal(household: Household, rehearsalId: string): MonthRehearsal {
  const rehearsal = findRehearsal(household, rehearsalId);
  const competing = (household.monthRehearsals ?? []).filter((row) =>
    row.status === "active" && row.monthKey === rehearsal.monthKey && row.id !== rehearsal.id,
  );
  if (rehearsal.status === "active" && competing.length) {
    throw new ValidationError("Two phones started different versions of this month. Resolve the shared rehearsal conflict before continuing.");
  }
  return rehearsal;
}

function getWeek(rehearsal: MonthRehearsal, week: WeekNumber): MonthRehearsalWeekProgress {
  const progress = rehearsal.weeks.find((row) => row.week === week);
  if (!progress) throw new ValidationError("That rehearsal week is missing.");
  return progress;
}

function getTask(rehearsal: MonthRehearsal, taskId: MonthRehearsalTaskId): MonthRehearsalTaskProgress {
  const definition = taskDefinition(taskId);
  const task = getWeek(rehearsal, definition.week).tasks.find((row) => row.taskId === taskId);
  if (!task) throw new ValidationError("That month action is missing.");
  return task;
}

function assertParticipant(rehearsal: MonthRehearsal, memberId: string): void {
  if (memberId !== rehearsal.biancaParticipantId && memberId !== rehearsal.jonathanPartnerId) {
    throw new ValidationError("Only the two rehearsal participants can record this.");
  }
}

function assertEditable(rehearsal: MonthRehearsal): void {
  if (rehearsal.status !== "active") throw new ValidationError("That rehearsal is read-only.");
}

function assertWeekStarted(rehearsal: MonthRehearsal, week: WeekNumber, today: DateKey): void {
  if (rehearsalWeekAvailability(rehearsal.monthKey, week, today) === "future") {
    throw new ValidationError("That week is a read-only preview until its Toronto start date.");
  }
}

function deriveTaskStatus(task: MonthRehearsalTaskProgress): MonthRehearsalTaskProgress["status"] {
  if (task.skip) return "skipped";
  const finished = task.attempts.some((attempt) => attempt.finishedAt && attempt.outcome !== "stopped");
  if (task.receipt && finished) return "complete";
  if (task.receipt) return "linked";
  if (task.attempts.some((attempt) => !attempt.finishedAt)) return "in-progress";
  return "not-started";
}

function touchRehearsal(rehearsal: MonthRehearsal, week: MonthRehearsalWeekProgress, at: string): void {
  week.updatedAt = at;
  rehearsal.updatedAt = at;
  rehearsal.biancaApproval = null;
  rehearsal.jonathanCountersignature = null;
  rehearsal.approvedAt = null;
}

export function startMonthRehearsal(household: Household, input: {
  monthKey: MonthKey;
  biancaParticipantId: string;
  jonathanPartnerId: string;
  startedByMemberId: string;
  now?: string;
}): CommitResult {
  requireDevelopment(household);
  parseMonthKey(input.monthKey);
  requireMember(household, input.biancaParticipantId);
  requireMember(household, input.jonathanPartnerId);
  requireMember(household, input.startedByMemberId);
  if (input.biancaParticipantId === input.jonathanPartnerId) throw new ValidationError("Our month needs two different members.");
  if (input.startedByMemberId !== input.biancaParticipantId && input.startedByMemberId !== input.jonathanPartnerId) {
    throw new ValidationError("Only a participant can start Our month.");
  }
  if ((household.monthRehearsals ?? []).some((row) => row.status === "active")) {
    throw new ValidationError("Resume the active month before starting another one.");
  }
  const at = commandTime(input.now);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const baseId = `REHEARSAL-${input.monthKey}-${encodeURIComponent(input.biancaParticipantId)}-${encodeURIComponent(input.jonathanPartnerId)}`;
  const generation = (next.monthRehearsals ?? []).filter((row) => row.id === baseId || row.id.startsWith(`${baseId}-R`)).length + 1;
  const id = `${baseId}-R${generation}`;
  next.monthRehearsals = [...(next.monthRehearsals ?? []), {
    version: 1,
    id,
    monthKey: input.monthKey,
    biancaParticipantId: input.biancaParticipantId,
    jonathanPartnerId: input.jonathanPartnerId,
    status: "active",
    weeks: newWeeks(id, input.monthKey, at),
    biancaApproval: null,
    jonathanCountersignature: null,
    startedAt: at,
    startedByMemberId: input.startedByMemberId,
    approvedAt: null,
    archivedAt: null,
    updatedAt: at,
  }];
  return nonMoneyCommit(previous, next, `Started Our month for ${input.monthKey}`, at);
}

export function startRehearsalTask(household: Household, input: {
  rehearsalId: string;
  taskId: MonthRehearsalTaskId;
  memberId: string;
  today: DateKey;
  now?: string;
}): CommitResult {
  requireDevelopment(household);
  requireMember(household, input.memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const rehearsal = getRehearsal(next, input.rehearsalId);
  assertEditable(rehearsal);
  assertParticipant(rehearsal, input.memberId);
  const task = getTask(rehearsal, input.taskId);
  assertWeekStarted(rehearsal, task.week, input.today);
  if (task.skip || task.status === "complete") throw new ValidationError("That action is already resolved.");
  const unfinished = task.attempts.find((attempt) => !attempt.finishedAt);
  if (unfinished) return nonMoneyCommit(previous, next, "Continued an unfinished month action", unfinished.updatedAt);
  const at = commandTime(input.now);
  task.attempts.push({
    id: nextId("REHEARSAL-TRY-", task.attempts.map((attempt) => attempt.id)),
    taskId: task.taskId,
    startedByMemberId: input.memberId,
    startedAt: at,
    finishedAt: null,
    elapsedSeconds: null,
    outcome: null,
    note: "",
    updatedAt: at,
  });
  task.status = deriveTaskStatus(task);
  task.updatedAt = at;
  const week = getWeek(rehearsal, task.week);
  touchRehearsal(rehearsal, week, at);
  return nonMoneyCommit(previous, next, `Started ${task.taskId}`, at);
}

export function recordRehearsalOutcome(household: Household, input: {
  rehearsalId: string;
  taskId: MonthRehearsalTaskId;
  attemptId: string;
  memberId: string;
  outcome: MonthRehearsalFrictionOutcome;
  note?: string;
  didNotHappen?: boolean;
  now?: string;
}): CommitResult {
  requireDevelopment(household);
  requireMember(household, input.memberId);
  if (!OUTCOMES.has(input.outcome)) throw new ValidationError("Choose one clear friction response.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const rehearsal = getRehearsal(next, input.rehearsalId);
  assertEditable(rehearsal);
  assertParticipant(rehearsal, input.memberId);
  const task = getTask(rehearsal, input.taskId);
  const attempt = task.attempts.find((row) => row.id === input.attemptId);
  if (!attempt) throw new ValidationError("That action attempt is missing.");
  if (attempt.startedByMemberId !== input.memberId) throw new ValidationError("A member can finish only their own attempt.");
  if (attempt.finishedAt) throw new ValidationError("That action already has a friction response.");
  const at = commandTime(input.now);
  const elapsedSeconds = Math.max(0, Math.round((Date.parse(at) - Date.parse(attempt.startedAt)) / 1000));
  attempt.finishedAt = at;
  attempt.elapsedSeconds = elapsedSeconds;
  attempt.outcome = input.outcome;
  attempt.note = String(input.note ?? "").trim().slice(0, 240);
  attempt.updatedAt = at;
  if (input.didNotHappen) {
    if (!task.allowDidNotHappen) throw new ValidationError("This core experience cannot be skipped.");
    if (input.outcome === "stopped") throw new ValidationError("Stopped and Did not happen are different responses.");
    task.skip = { memberId: input.memberId, reason: "did-not-happen", recordedAt: at, updatedAt: at };
    task.receipt = null;
  }
  task.status = deriveTaskStatus(task);
  task.updatedAt = at;
  const week = getWeek(rehearsal, task.week);
  touchRehearsal(rehearsal, week, at);
  return nonMoneyCommit(previous, next, `Recorded ${task.taskId} clarity`, at);
}

function requireReceiptArtifact(household: Household, rehearsal: MonthRehearsal, task: MonthRehearsalTaskProgress, input: {
  kind: MonthRehearsalReceiptKind;
  receiptId: string;
  postedIds?: string[];
}): { postedIds: string[]; auditHash: string | null } {
  const definition = taskDefinition(task.taskId);
  const week = getWeek(rehearsal, task.week);
  const inWeek = (date: string) => date >= week.startsOn && date <= week.endsOn;
  if (!definition.receiptKinds.includes(input.kind)) throw new ValidationError("That receipt kind does not prove this action.");
  const postedIds = [...new Set((input.postedIds ?? []).filter(Boolean))].sort();
  const receipt = household.commandReceipts.find((row) => row.confirmationId === input.receiptId);
  if (input.kind === "command") {
    if (!receipt) throw new ValidationError("Link an accepted Confirm receipt from the real books.");
    const expectedCommandKind = task.taskId === "opening-truth" ? "postOpeningBalances"
      : task.taskId === "fund-setup" ? "configureHouseholdFund"
        : task.taskId === "card-payment" ? "postTransfer"
          : ["income", "groceries", "bills", "refund", "shared-fund-purchase"].includes(task.taskId) ? "postEntry"
            : null;
    if (expectedCommandKind && receipt.commandKind !== expectedCommandKind) {
      throw new ValidationError("That Confirm was accepted for a different kind of action.");
    }
    const ids = receipt.postedIds;
    const transactions = household.transactions.filter((row) => ids.includes(row.id));
    if (task.taskId === "opening-truth" && !transactions.some((row) => row.type === "opening" && row.source === "opening")) {
      throw new ValidationError("That Confirm is not an opening-truth batch.");
    }
    if (task.taskId === "income" && !transactions.some((row) => row.type === "income")) throw new ValidationError("That Confirm is not income.");
    const categoryWords = (transaction: Transaction) => {
      const subcategory = household.categories.find((row) => row.id === transaction.subcategoryId);
      const group = household.categories.find((row) => row.id === subcategory?.parentId);
      return `${subcategory?.name ?? ""} ${group?.name ?? ""}`.toLowerCase();
    };
    if (task.taskId === "groceries" && !transactions.some((row) => row.type === "expense" && /grocer|supermarket|food market/.test(categoryWords(row)))) {
      throw new ValidationError("That Confirm is not categorized as groceries.");
    }
    if (task.taskId === "bills" && !transactions.some((row) => row.type === "expense" && /bill|rent|hydro|utilit|electric|gas|internet|phone|subscription|insurance/.test(categoryWords(row)))) {
      throw new ValidationError("That Confirm is not categorized as a household bill.");
    }
    if (task.taskId === "card-payment" && !transactions.some((row) =>
      row.type === "transfer"
      && Boolean(row.transferToAccountId)
      && household.accounts.find((account) => account.id === row.transferToAccountId)?.kind === "credit",
    )) throw new ValidationError("That Confirm is not a payment into a credit account.");
    if (task.taskId === "refund" && !transactions.some((row) =>
      row.type === "refund"
      && Boolean(row.refundOfId)
      && household.transactions.some((original) => original.id === row.refundOfId && original.type === "expense"),
    )) throw new ValidationError("That Confirm is not linked to its original expense.");
    if (task.taskId === "shared-fund-purchase" && !transactions.some((row) => row.type === "expense" && row.funding)) throw new ValidationError("That Confirm is not a Fund-backed purchase.");
    if (task.taskId !== "fund-setup" && !transactions.some((row) => inWeek(row.date))) {
      throw new ValidationError("That Confirm belongs to a different rehearsal week.");
    }
    if (task.taskId === "fund-setup" && (!household.householdFund || !receipt.postedIds.includes(household.householdFund.id) || !inWeek(household.householdFund.openedOn))) {
      throw new ValidationError("The Fund setup belongs to a different rehearsal week.");
    }
    return { postedIds: [...ids].sort(), auditHash: receipt.auditHash || null };
  }
  if (input.kind === "fund-event") {
    const event = shapeHouseholdFundEvents(household.fundEvents).find((row) => row.id === input.receiptId);
    if (!event) throw new ValidationError("That Household Fund receipt is missing.");
    const acceptedReceipt = household.commandReceipts.find((row) => row.postedIds.includes(event.id));
    if (!acceptedReceipt) throw new ValidationError("Link a Fund event from an accepted real Confirm.");
    const expected = task.taskId === "fund-contribution" ? "contribution-confirmed"
      : task.taskId === "shared-fund-purchase" ? "purchase-funded"
        : task.taskId === "refund" ? "refund-funded"
          : task.taskId === "fund-reconciliation" ? "reconciliation-recorded"
            : task.taskId === "fund-partial-settlement" || task.taskId === "fund-final-settlement" ? "settlement-confirmed"
              : null;
    if (expected && event.kind !== expected) throw new ValidationError("That Fund receipt proves a different action.");
    const expectedCommandKind = event.kind === "contribution-confirmed" ? "confirmHouseholdFundContribution"
      : event.kind === "settlement-confirmed" ? "confirmHouseholdFundSettlement"
        : event.kind === "reconciliation-recorded" ? "recordHouseholdFundReconciliation"
          : event.kind === "purchase-funded" || event.kind === "refund-funded" ? "postEntry"
            : null;
    const directDebitAlsoValid = acceptedReceipt.commandKind === "postHouseholdFundDirectDebit"
      && (event.kind === "purchase-funded" || event.kind === "settlement-confirmed");
    if (expectedCommandKind && acceptedReceipt.commandKind !== expectedCommandKind && !directDebitAlsoValid) {
      throw new ValidationError("That Fund receipt was accepted for a different kind of action.");
    }
    if (task.taskId === "fund-reconciliation" && event.reconciliationTied !== true) throw new ValidationError("The Fund reconciliation must tie.");
    if (!inWeek(event.date)) throw new ValidationError("That Fund receipt belongs to a different rehearsal week.");
    return { postedIds: [event.id], auditHash: acceptedReceipt.auditHash || null };
  }
  if (input.kind === "reconciliation") {
    const proofIds = new Set([input.receiptId, ...postedIds]);
    const tied = household.kitchen.books.reconciliations.filter((item) =>
      proofIds.has(item.id)
      && item.status === "tied"
      && item.statementDate >= `${rehearsal.monthKey}-01`
      && item.statementDate <= week.endsOn,
    );
    if (!tied.length) throw new ValidationError("Link a tied account reconciliation.");
    const activeAccountIds = new Set(household.transactions
      .filter((transaction) => transaction.date <= week.endsOn && transaction.visibility !== "personal")
      .map((transaction) => transaction.accountId));
    const requiredAccountIds = household.accounts
      .filter((account) => account.active && account.scope !== "personal" && activeAccountIds.has(account.id))
      .map((account) => account.id);
    const tiedAccountIds = new Set(tied.map((row) => row.accountId));
    if (requiredAccountIds.some((accountId) => !tiedAccountIds.has(accountId))) {
      throw new ValidationError("Reconcile every active shared account used in the month so far.");
    }
    const acceptedReceipts = tied.map((row) => household.commandReceipts.find((candidate) =>
      candidate.commandKind === "recordReconciliation" && candidate.postedIds.includes(row.id),
    ));
    if (acceptedReceipts.some((candidate) => !candidate)) {
      throw new ValidationError("Link reconciliations from their accepted real Confirms.");
    }
    const selectedReceipt = acceptedReceipts.find((candidate) => candidate?.postedIds.includes(input.receiptId)) ?? acceptedReceipts[0];
    return { postedIds: tied.map((row) => row.id).sort(), auditHash: selectedReceipt?.auditHash || null };
  }
  if (input.kind === "month-close") {
    const row = household.kitchen.books.closedMonths.find((item) => item.id === input.receiptId && item.monthKey === rehearsal.monthKey);
    if (!row) throw new ValidationError("Link the closed rehearsal month.");
    const acceptedReceipt = household.commandReceipts.find((candidate) =>
      candidate.commandKind === "closeBooksMonth" && candidate.postedIds.includes(row.id),
    );
    if (!acceptedReceipt) throw new ValidationError("Link the month close from its accepted real Confirm.");
    return { postedIds: [row.id], auditHash: acceptedReceipt.auditHash || null };
  }
  if (input.kind === "practice") throw new ValidationError("Run the isolated correction practice from this rehearsal so Hearth can verify it.");
  if (input.kind === "review" && input.receiptId !== `REVIEW-${rehearsal.monthKey}-TOGETHER`) throw new ValidationError("Finish the human month review first.");
  return { postedIds, auditHash: receipt?.auditHash ?? null };
}

export function linkRehearsalReceipt(household: Household, input: {
  rehearsalId: string;
  taskId: MonthRehearsalTaskId;
  memberId: string;
  today: DateKey;
  kind: MonthRehearsalReceiptKind;
  receiptId: string;
  postedIds?: string[];
  now?: string;
}): CommitResult {
  requireDevelopment(household);
  requireMember(household, input.memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const rehearsal = getRehearsal(next, input.rehearsalId);
  assertEditable(rehearsal);
  assertParticipant(rehearsal, input.memberId);
  const task = getTask(rehearsal, input.taskId);
  assertWeekStarted(rehearsal, task.week, input.today);
  const receiptId = input.receiptId.trim();
  if (!receiptId) throw new ValidationError("Choose the real receipt that proves this action.");
  const proof = requireReceiptArtifact(next, rehearsal, task, { ...input, receiptId });
  const at = commandTime(input.now);
  task.receipt = {
    id: `${task.id}-RECEIPT`,
    taskId: task.taskId,
    kind: input.kind,
    receiptId,
    postedIds: proof.postedIds,
    financialAuditHash: proof.auditHash,
    linkedByMemberId: input.memberId,
    linkedAt: at,
    updatedAt: at,
  };
  task.skip = null;
  task.status = deriveTaskStatus(task);
  task.updatedAt = at;
  const week = getWeek(rehearsal, task.week);
  touchRehearsal(rehearsal, week, at);
  return nonMoneyCommit(previous, next, `Linked proof for ${task.taskId}`, at);
}

/** Runs the real fictional post/reversal recipe, discards it, then stores only its exact non-money proof. */
export async function completeRehearsalCorrectionPractice(household: Household, input: {
  rehearsalId: string;
  memberId: string;
  today: DateKey;
  now?: string;
}): Promise<CommitResult> {
  requireDevelopment(household);
  requireMember(household, input.memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const rehearsal = getRehearsal(next, input.rehearsalId);
  assertEditable(rehearsal);
  assertParticipant(rehearsal, input.memberId);
  const task = getTask(rehearsal, "correction-practice");
  assertWeekStarted(rehearsal, task.week, input.today);
  const proof = await runMonthRehearsalCorrectionPractice({ date: input.today, memberId: input.memberId });
  if (proof.version !== 1 || proof.memberId !== input.memberId || !proof.fictional || !proof.discarded || proof.persistedIds.length || !proof.trialInBalance || !proof.equationHolds || proof.netIncomeCents !== 0 || proof.mistakeEntryCount !== 1 || proof.reversalEntryCount !== 2) {
    throw new ValidationError("The isolated correction practice did not produce its exact tied proof.");
  }
  const at = commandTime(input.now);
  task.receipt = {
    id: `${task.id}-RECEIPT`, taskId: task.taskId, kind: "practice", receiptId: proof.receiptId,
    postedIds: [], financialAuditHash: null, linkedByMemberId: input.memberId, linkedAt: at, updatedAt: at,
  };
  task.skip = null;
  task.status = deriveTaskStatus(task);
  task.updatedAt = at;
  touchRehearsal(rehearsal, getWeek(rehearsal, task.week), at);
  return nonMoneyCommit(previous, next, "Completed isolated correction practice", at);
}

export type MonthRehearsalReceiptSuggestion = {
  kind: MonthRehearsalReceiptKind;
  receiptId: string;
  postedIds: string[];
  summary: string;
  date: DateKey | null;
  amountCents: number | null;
  accountName: string;
};

/** Unused real proofs that pass the same validator as Link, newest first. */
export function rehearsalReceiptSuggestions(household: Household, input: {
  rehearsalId: string;
  taskId: MonthRehearsalTaskId;
}): MonthRehearsalReceiptSuggestion[] {
  const rehearsal = getRehearsal(household, input.rehearsalId);
  const task = getTask(rehearsal, input.taskId);
  const definition = taskDefinition(task.taskId);
  const used = new Set(rehearsal.weeks.flatMap((week) => week.tasks.flatMap((row) => row.receipt ? [row.receipt.receiptId] : [])));
  const candidates: MonthRehearsalReceiptSuggestion[] = [];
  if (definition.receiptKinds.includes("command")) {
    for (const receipt of [...household.commandReceipts].sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt))) {
      if (!used.has(receipt.confirmationId)) {
        const rows = household.transactions.filter((row) => receipt.postedIds.includes(row.id));
        const row = rows[0];
        const fund = receipt.postedIds.includes(household.householdFund?.id ?? "") ? household.householdFund : null;
        candidates.push({
          kind: "command", receiptId: receipt.confirmationId, postedIds: receipt.postedIds,
          summary: fund ? `Household Fund opened with ${household.members.find((member) => member.id === fund.custodianMemberId)?.name ?? "its custodian"}` : row?.note || receipt.commandKind,
          date: (row?.date ?? fund?.openedOn ?? null) as DateKey | null,
          amountCents: row?.amountCents ?? null,
          accountName: row ? household.accounts.find((account) => account.id === row.accountId)?.name ?? "Account" : "Household Fund",
        });
      }
    }
  }
  if (definition.receiptKinds.includes("fund-event")) {
    for (const event of [...shapeHouseholdFundEvents(household.fundEvents)].sort((left, right) => right.createdAt.localeCompare(left.createdAt))) {
      if (!used.has(event.id)) candidates.push({
        kind: "fund-event", receiptId: event.id, postedIds: [event.id], summary: event.note || event.kind.replaceAll("-", " "),
        date: event.date, amountCents: event.amountCents, accountName: "Household Fund",
      });
    }
  }
  if (definition.receiptKinds.includes("reconciliation")) {
    const tied = [...household.kitchen.books.reconciliations]
      .filter((row) => row.status === "tied")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    if (tied.length) candidates.push({ kind: "reconciliation", receiptId: tied[0]!.id, postedIds: tied.map((row) => row.id), summary: "Tied shared-account reconciliation", date: tied[0]!.statementDate, amountCents: tied[0]!.statementCents, accountName: "Shared accounts" });
  }
  if (definition.receiptKinds.includes("month-close")) {
    const closed = household.kitchen.books.closedMonths.find((row) => row.monthKey === rehearsal.monthKey);
    if (closed) candidates.push({ kind: "month-close", receiptId: closed.id, postedIds: [closed.id], summary: `${rehearsal.monthKey} closed`, date: closed.closedAt.slice(0, 10) as DateKey, amountCents: null, accountName: "Books" });
  }
  const valid: MonthRehearsalReceiptSuggestion[] = [];
  for (const candidate of candidates) {
    try {
      requireReceiptArtifact(household, rehearsal, task, candidate);
      valid.push(candidate);
    } catch {
      // Keep searching; invalid evidence must never become progress.
    }
  }
  return valid;
}

/** Most recent unused real proof that passes the same validator as Link. */
export function suggestRehearsalReceipt(household: Household, input: {
  rehearsalId: string;
  taskId: MonthRehearsalTaskId;
}): MonthRehearsalReceiptSuggestion | null {
  return rehearsalReceiptSuggestions(household, input)[0] ?? null;
}

function transactionIsInCheckpoint(transaction: Transaction, household: Household, end: DateKey): boolean {
  if (transaction.date <= end) return true;
  if (!transaction.reversalOfId) return false;
  const original = household.transactions.find((row) => row.id === transaction.reversalOfId);
  return Boolean(original && original.date <= end);
}

function checkpointHousehold(household: Household, end: DateKey): Household {
  const transactions = household.transactions.filter((row) => transactionIsInCheckpoint(row, household, end));
  const transactionIds = new Set(transactions.map((row) => row.id));
  const events = shapeHouseholdFundEvents(household.fundEvents);
  const selectedEventIds = new Set(events.filter((event) => event.date <= end).map((event) => event.id));
  for (const event of events) {
    if (event.kind === "reversal" && event.relatedEventId && selectedEventIds.has(event.relatedEventId)) selectedEventIds.add(event.id);
  }
  return {
    ...cloneHousehold(household),
    transactions,
    shifts: household.shifts.filter((shift) => shift.date <= end || (shift.correctionOfShiftId && transactionIds.has(shift.correctionOfShiftId))),
    fundEvents: events.filter((event) => selectedEventIds.has(event.id)),
    fundSettlementAllocations: (household.fundSettlementAllocations ?? []).filter((row) => selectedEventIds.has(row.eventId)),
    fundKittyAllocations: (household.fundKittyAllocations ?? []).filter((row) => selectedEventIds.has(row.eventId)),
    fundPrivate: { bankBindings: [], reconciliations: [] },
    kitchen: {
      ...household.kitchen,
      books: {
        reconciliations: household.kitchen.books.reconciliations.filter((row) => row.statementDate <= end),
        closedMonths: household.kitchen.books.closedMonths.filter((row) => monthEndKey(row.monthKey) <= end),
      },
    },
  };
}

async function checkpointProjection(household: Household, rehearsal: MonthRehearsal, week: WeekNumber) {
  const progress = getWeek(rehearsal, week);
  const scoped = checkpointHousehold(household, progress.endsOn);
  const books = compileHousehold(scoped);
  const trial = trialBalance(books, { recognizedOnly: true });
  const equation = booksEquation(books);
  const fund = projectHouseholdFund(scoped, progress.endsOn);
  const accountBalancesCents = Object.fromEntries(scoped.accounts
    .filter((account) => account.scope !== "personal")
    .map((account) => [account.id, bookBalanceAsOf(scoped, account.id, progress.endsOn)]));
  const linkedReceiptIds = [...new Set(progress.tasks.flatMap((task) => task.receipt
    ? [task.receipt.receiptId, ...task.receipt.postedIds]
    : []))].sort();
  const facts = {
    householdId: scoped.householdId,
    monthKey: rehearsal.monthKey,
    week,
    end: progress.endsOn,
    transactions: scoped.transactions.map((row) => ({
      id: row.id, date: row.date, type: row.type, amountCents: row.amountCents, accountId: row.accountId,
      categoryId: row.categoryId, subcategoryId: row.subcategoryId, splits: row.splits, transferPairId: row.transferPairId ?? null,
      refundOfId: row.refundOfId ?? null, reversalOfId: row.reversalOfId ?? null, source: row.source, sourceId: row.sourceId ?? null,
      funding: row.funding ?? null, visibility: row.visibility, createdBy: row.createdBy,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    fund: {
      config: scoped.householdFund ?? null,
      events: shapeHouseholdFundEvents(scoped.fundEvents),
      settlements: [...(scoped.fundSettlementAllocations ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    },
    reconciliations: [...scoped.kitchen.books.reconciliations].sort((left, right) => left.id.localeCompare(right.id)),
    closedMonths: [...scoped.kitchen.books.closedMonths].sort((left, right) => left.id.localeCompare(right.id)),
  };
  return {
    progress,
    scoped,
    books,
    trial,
    equation,
    fund,
    accountBalancesCents,
    linkedReceiptIds,
    financialAuditHash: await sha256Hex(facts),
  };
}

function tasksResolved(progress: MonthRehearsalWeekProgress): boolean {
  return progress.tasks.every((task) => task.status === "complete" || (!task.required && task.status === "skipped"));
}

export async function evaluateRehearsalCheckpoint(household: Household, input: {
  rehearsalId: string;
  week: WeekNumber;
  memberId: string;
  today: DateKey;
  now?: string;
}): Promise<CommitResult> {
  requireDevelopment(household);
  requireMember(household, input.memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const rehearsal = getRehearsal(next, input.rehearsalId);
  assertEditable(rehearsal);
  assertParticipant(rehearsal, input.memberId);
  assertWeekStarted(rehearsal, input.week, input.today);
  const projection = await checkpointProjection(next, rehearsal, input.week);
  const reasons: string[] = [];
  if (!projection.trial.inBalance) reasons.push("The trial balance does not tie.");
  if (!projection.equation.holds) reasons.push("The accounting equation does not hold.");
  if (!tasksResolved(projection.progress)) reasons.push("Finish or honestly resolve every action for this week.");
  if (input.week === 4 && projection.fund.transferDueCents !== 0) reasons.push("The Household Fund still has an unsettled amount.");
  const at = commandTime(input.now);
  const checkpoint: MonthRehearsalCheckpointSnapshot = {
    id: `${projection.progress.id}-CHECKPOINT-${at.replace(/\D/g, "")}`,
    week: input.week,
    periodStart: projection.progress.startsOn,
    periodEnd: projection.progress.endsOn,
    status: reasons.length ? "needs-attention" : "tied",
    reasons,
    accountBalancesCents: projection.accountBalancesCents,
    assetCents: projection.equation.assetCents,
    liabilityCents: projection.equation.liabilityCents,
    openingEquityCents: projection.equation.openingEquityCents,
    netIncomeCents: projection.equation.netIncomeCents,
    journalEntryCount: projection.books.entries.filter((entry) => entry.recognized).length,
    totalDebitCents: projection.trial.totalDebitCents,
    totalCreditCents: projection.trial.totalCreditCents,
    fundOperatingCents: projection.fund.operatingBalanceCents,
    fundDueCents: projection.fund.transferDueCents,
    fundFreeCents: projection.fund.freeToSpendCents,
    linkedReceiptIds: projection.linkedReceiptIds,
    financialAuditHash: projection.financialAuditHash,
    evaluatedAt: at,
    updatedAt: at,
  };
  projection.progress.checkpoint = checkpoint;
  projection.progress.acknowledgements = [];
  touchRehearsal(rehearsal, projection.progress, at);
  return nonMoneyCommit(previous, next, `Checked week ${input.week}: ${checkpoint.status}`, at);
}

export async function rehearsalCheckpointIsCurrent(household: Household, rehearsal: MonthRehearsal, week: WeekNumber): Promise<boolean> {
  const progress = getWeek(rehearsal, week);
  if (!progress.checkpoint) return false;
  const projection = await checkpointProjection(household, rehearsal, week);
  return progress.checkpoint.financialAuditHash === projection.financialAuditHash
    && JSON.stringify(progress.checkpoint.linkedReceiptIds) === JSON.stringify(projection.linkedReceiptIds);
}

export async function acknowledgeRehearsalWeek(household: Household, input: {
  rehearsalId: string;
  week: WeekNumber;
  actorMemberId: string;
  memberId: string;
  now?: string;
}): Promise<CommitResult> {
  requireDevelopment(household);
  requireMember(household, input.actorMemberId);
  requireMember(household, input.memberId);
  if (input.actorMemberId !== input.memberId) throw new ValidationError("A member cannot acknowledge for someone else.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const rehearsal = getRehearsal(next, input.rehearsalId);
  assertEditable(rehearsal);
  assertParticipant(rehearsal, input.memberId);
  const week = getWeek(rehearsal, input.week);
  if (!week.checkpoint || week.checkpoint.status !== "tied") throw new ValidationError("Resolve this week's checkpoint before acknowledging it.");
  if (!await rehearsalCheckpointIsCurrent(next, rehearsal, input.week)) throw new ValidationError("The week changed. Run its checkpoint again.");
  const at = commandTime(input.now);
  const acknowledgement: MonthRehearsalAcknowledgement = {
    id: `${week.id}-ACK-${input.memberId}`,
    week: input.week,
    memberId: input.memberId,
    checkpointId: week.checkpoint.id,
    checkpointFinancialAuditHash: week.checkpoint.financialAuditHash,
    acknowledgedAt: at,
    updatedAt: at,
  };
  week.acknowledgements = [...week.acknowledgements.filter((row) => row.memberId !== input.memberId), acknowledgement];
  touchRehearsal(rehearsal, week, at);
  return nonMoneyCommit(previous, next, `Acknowledged week ${input.week}`, at);
}

async function approvalBlockers(household: Household, rehearsal: MonthRehearsal): Promise<string[]> {
  const blockers: string[] = [];
  for (const week of rehearsal.weeks) {
    if (!tasksResolved(week)) blockers.push(`Week ${week.week} still has unresolved actions.`);
    if (!week.checkpoint || week.checkpoint.status !== "tied" || !await rehearsalCheckpointIsCurrent(household, rehearsal, week.week)) {
      blockers.push(`Week ${week.week} needs a current green checkpoint.`);
      continue;
    }
    const acknowledged = new Set(week.acknowledgements
      .filter((row) => row.checkpointFinancialAuditHash === week.checkpoint?.financialAuditHash)
      .map((row) => row.memberId));
    if (!acknowledged.has(rehearsal.biancaParticipantId) || !acknowledged.has(rehearsal.jonathanPartnerId)) {
      blockers.push(`Both members must acknowledge week ${week.week}.`);
    }
  }
  if (!isMonthClosed(household, rehearsal.monthKey)) blockers.push("The rehearsal month is not closed.");
  const fund = projectHouseholdFund(household, monthEndKey(rehearsal.monthKey));
  if (fund.transferDueCents !== 0) blockers.push("The Household Fund still has an unsettled amount.");
  return blockers;
}

export async function approveMonthRehearsal(household: Household, input: {
  rehearsalId: string;
  actorMemberId: string;
  memberId: string;
  statement: string;
  now?: string;
}): Promise<CommitResult> {
  requireDevelopment(household);
  requireMember(household, input.actorMemberId);
  requireMember(household, input.memberId);
  if (input.actorMemberId !== input.memberId) throw new ValidationError("A member cannot sign for someone else.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  const rehearsal = getRehearsal(next, input.rehearsalId);
  assertEditable(rehearsal);
  assertParticipant(rehearsal, input.memberId);
  const blockers = await approvalBlockers(next, rehearsal);
  if (blockers.length) throw new ValidationError(blockers[0] ?? "Our month is not ready for approval.");
  const at = commandTime(input.now);
  const signature: MonthRehearsalMemberApproval = { memberId: input.memberId, statement: input.statement, signedAt: at, updatedAt: at };
  if (input.memberId === rehearsal.biancaParticipantId) {
    if (input.statement !== BIANCA_APPROVAL_STATEMENT) throw new ValidationError("Bianca must confirm the full approval statement.");
    rehearsal.biancaApproval = signature;
  } else {
    if (input.statement !== JONATHAN_COUNTERSIGNATURE) throw new ValidationError("Jonathan must countersign the shared review.");
    rehearsal.jonathanCountersignature = signature;
  }
  rehearsal.updatedAt = at;
  if (rehearsal.biancaApproval && rehearsal.jonathanCountersignature) {
    rehearsal.status = "archived";
    rehearsal.approvedAt = at;
    rehearsal.archivedAt = at;
  }
  return nonMoneyCommit(previous, next, rehearsal.status === "archived" ? "Approved and archived Our month" : "Recorded one month approval", at);
}

export function archiveMonthRehearsal(household: Household, input: {
  rehearsalId: string;
  memberId: string;
  now?: string;
}): CommitResult {
  requireDevelopment(household);
  requireMember(household, input.memberId);
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  // Archiving is the deliberate escape hatch for a concurrent-start conflict.
  const rehearsal = findRehearsal(next, input.rehearsalId);
  assertParticipant(rehearsal, input.memberId);
  if (rehearsal.status === "archived") return nonMoneyCommit(previous, next, "Our month is already archived", rehearsal.updatedAt);
  const at = commandTime(input.now);
  rehearsal.status = "archived";
  rehearsal.archivedAt = at;
  rehearsal.updatedAt = at;
  return nonMoneyCommit(previous, next, "Archived Our month without changing money", at);
}

function newer<T extends { updatedAt: string }>(left: T | null, right: T | null): T | null {
  if (!left) return right;
  if (!right) return left;
  if (right.updatedAt !== left.updatedAt) return right.updatedAt > left.updatedAt ? right : left;
  return JSON.stringify(right) > JSON.stringify(left) ? right : left;
}

function mergeRows<T extends { id: string; updatedAt: string }>(left: T[], right: T[]): T[] {
  const rows = new Map<string, T>();
  for (const row of [...left, ...right]) rows.set(row.id, newer(rows.get(row.id) ?? null, row) ?? row);
  return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function mergeTasks(left: MonthRehearsalTaskProgress, right: MonthRehearsalTaskProgress): MonthRehearsalTaskProgress {
  const newest = newer(left, right) ?? left;
  const merged: MonthRehearsalTaskProgress = {
    ...newest,
    attempts: mergeRows(left.attempts, right.attempts),
    receipt: newer(left.receipt, right.receipt),
    skip: newer(left.skip, right.skip),
    updatedAt: left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt,
  };
  if (merged.receipt && merged.skip) {
    if (merged.receipt.updatedAt >= merged.skip.updatedAt) merged.skip = null;
    else merged.receipt = null;
  }
  merged.status = deriveTaskStatus(merged);
  return merged;
}

function mergeWeeks(left: MonthRehearsalWeekProgress, right: MonthRehearsalWeekProgress): MonthRehearsalWeekProgress {
  const tasks = new Map(left.tasks.map((task) => [task.id, task]));
  for (const task of right.tasks) tasks.set(task.id, tasks.has(task.id) ? mergeTasks(tasks.get(task.id)!, task) : task);
  return {
    ...(newer(left, right) ?? left),
    tasks: [...tasks.values()].sort((a, b) => a.taskId.localeCompare(b.taskId)),
    checkpoint: newer(left.checkpoint, right.checkpoint),
    acknowledgements: mergeRows(left.acknowledgements, right.acknowledgements),
    updatedAt: left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt,
  };
}

export function mergeMonthRehearsals(left: MonthRehearsal[] = [], right: MonthRehearsal[] = []): MonthRehearsal[] {
  const rows = new Map(left.map((row) => [row.id, row]));
  for (const incoming of right) {
    const existing = rows.get(incoming.id);
    if (!existing) {
      rows.set(incoming.id, incoming);
      continue;
    }
    const weeks = new Map(existing.weeks.map((week) => [week.id, week]));
    for (const week of incoming.weeks) weeks.set(week.id, weeks.has(week.id) ? mergeWeeks(weeks.get(week.id)!, week) : week);
    const newest = newer(existing, incoming) ?? existing;
    rows.set(incoming.id, {
      ...newest,
      weeks: [...weeks.values()].sort((a, b) => a.week - b.week),
      biancaApproval: newer(existing.biancaApproval, incoming.biancaApproval),
      jonathanCountersignature: newer(existing.jonathanCountersignature, incoming.jonathanCountersignature),
      approvedAt: existing.approvedAt && incoming.approvedAt ? (existing.approvedAt > incoming.approvedAt ? existing.approvedAt : incoming.approvedAt) : existing.approvedAt ?? incoming.approvedAt,
      archivedAt: existing.archivedAt && incoming.archivedAt ? (existing.archivedAt > incoming.archivedAt ? existing.archivedAt : incoming.archivedAt) : existing.archivedAt ?? incoming.archivedAt,
      status: existing.status === "archived" || incoming.status === "archived" ? "archived" : existing.status === "approved" || incoming.status === "approved" ? "approved" : "active",
      updatedAt: existing.updatedAt > incoming.updatedAt ? existing.updatedAt : incoming.updatedAt,
    });
  }
  return [...rows.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
}

/** Legacy/invalid rehearsal payloads fail closed to an empty metadata collection. */
export function shapeMonthRehearsals(value: unknown): MonthRehearsal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<MonthRehearsal>;
    if (row.version !== 1 || !row.id || !row.monthKey || !row.biancaParticipantId || !row.jonathanPartnerId) return [];
    try { parseMonthKey(row.monthKey); } catch { return []; }
    if (!Array.isArray(row.weeks) || row.weeks.length !== 4) return [];
    const startedAt = validIso(row.startedAt, "1970-01-01T00:00:00.000Z");
    return [{
      ...(row as MonthRehearsal),
      status: row.status === "approved" || row.status === "archived" ? row.status : "active",
      startedAt,
      approvedAt: row.approvedAt ? validIso(row.approvedAt, startedAt) : null,
      archivedAt: row.archivedAt ? validIso(row.archivedAt, startedAt) : null,
      updatedAt: validIso(row.updatedAt, startedAt),
      weeks: row.weeks as MonthRehearsalWeekProgress[],
    }];
  });
}

export function monthRehearsalReport(household: Household, rehearsalId: string, memberId: string): { human: string; json: string } {
  requireDevelopment(household);
  requireMember(household, memberId);
  const rehearsal = getRehearsal(household, rehearsalId);
  assertParticipant(rehearsal, memberId);
  const lines = [
    `Our month - ${rehearsal.monthKey}`,
    `Status: ${rehearsal.status}`,
    "Friction notes are shared with the two Development household participants.",
  ];
  for (const week of rehearsal.weeks) {
    lines.push(`Week ${week.week}: ${week.checkpoint?.status === "tied" ? "Tied" : "Needs attention"}`);
    for (const task of week.tasks) {
      const latest = [...task.attempts].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      lines.push(`- ${taskDefinition(task.taskId).title}: ${task.status}${latest?.outcome ? `; ${latest.outcome}` : ""}${latest?.note ? `; ${latest.note}` : ""}`);
    }
  }
  return { human: lines.join("\n"), json: JSON.stringify(rehearsal, null, 2) };
}

export function taskRequiresFinancialReceipt(taskId: MonthRehearsalTaskId): boolean {
  return FINANCIAL_TASKS.has(taskId);
}
