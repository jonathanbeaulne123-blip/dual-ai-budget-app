import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shapeAccounts } from "../src/core/accountKinds.ts";
import type { CommitResult, Household, MonthRehearsalTaskId, MonthRehearsalReceiptKind } from "../src/core/types.ts";
import {
  BIANCA_APPROVAL_STATEMENT,
  HOUSEHOLD_FUND_ID,
  JONATHAN_COUNTERSIGNATURE,
  acceptHouseholdWrite,
  acknowledgeRehearsalWeek,
  assembleHousehold,
  approveMonthRehearsal,
  booksEquation,
  closeBooksMonth,
  compileHousehold,
  completeRehearsalCorrectionPractice,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  emptyHousehold,
  evaluateRehearsalCheckpoint,
  financialAuditHash,
  linkRehearsalReceipt,
  mergeShared,
  postEntry,
  postOpeningBalances,
  postTransfer,
  projectHouseholdFund,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
  recordReconciliation,
  recordRehearsalOutcome,
  rehearsalCheckpointIsCurrent,
  reopenBooksMonth,
  reversePostedMoney,
  startMonthRehearsal,
  startRehearsalTask,
  splitForSync,
  trialBalance,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function goldenHousehold(): Household {
  const household = emptyHousehold("development");
  const at = "2026-01-01T00:00:00.000Z";
  household.timezone = "America/Toronto";
  household.members = [
    { id: BIANCA, name: "Bianca", color: "#c45c26", active: true, updatedAt: at },
    { id: JONATHAN, name: "Jonathan", color: "#2f6b4f", active: true, updatedAt: at },
  ];
  household.accounts = shapeAccounts([
    { id: "ACC-CHEQUING", name: "Chequing", kind: "chequing", currency: "CAD", active: true, ownerMemberId: "joint", sortOrder: 10 },
    { id: "ACC-BIANCA-SAVINGS", name: "Bianca Savings", kind: "savings", currency: "CAD", active: true, ownerMemberId: "joint", sortOrder: 20 },
    { id: "ACC-VISA", name: "Visa", kind: "credit", currency: "CAD", active: true, ownerMemberId: "joint", sortOrder: 30 },
  ], at);
  household.categories = [
    { id: "CAT-INCOME", parentId: null, recordType: "group", name: "Income", transactionType: "income", essential: false, incomeStability: null, active: true, sortOrder: 10, createdAt: at, updatedAt: at },
    { id: "SUB-INCOME", parentId: "CAT-INCOME", recordType: "category", name: "Pay", transactionType: "income", essential: false, incomeStability: "fixed", active: true, sortOrder: 11, createdAt: at, updatedAt: at },
    { id: "CAT-FOOD", parentId: null, recordType: "group", name: "Food", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 20, createdAt: at, updatedAt: at },
    { id: "SUB-GROCERIES", parentId: "CAT-FOOD", recordType: "category", name: "Groceries", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 21, createdAt: at, updatedAt: at },
    { id: "CAT-BILLS", parentId: null, recordType: "group", name: "Bills", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 30, createdAt: at, updatedAt: at },
    { id: "SUB-BILL", parentId: "CAT-BILLS", recordType: "category", name: "Monthly bill", transactionType: "expense", essential: true, incomeStability: "fixed", active: true, sortOrder: 31, createdAt: at, updatedAt: at },
  ];
  return household;
}

async function accept(previous: Household, result: CommitResult, confirmationId: string, commandKind: string): Promise<Household> {
  const outcome = await acceptHouseholdWrite({
    previous,
    candidate: result.household,
    confirmationId,
    commandKind,
    postedIds: result.postedIds,
    adapters: {
      ingest: async () => ({ ok: true }),
      persist: async () => undefined,
    },
  });
  expect(outcome.ok).toBe(true);
  return outcome.household;
}

function beginTask(household: Household, rehearsalId: string, taskId: MonthRehearsalTaskId, memberId: string, today: string, now: string) {
  const next = startRehearsalTask(household, { rehearsalId, taskId, memberId, today, now }).household;
  const attempt = next.monthRehearsals![0]!.weeks.flatMap((week) => week.tasks).find((task) => task.taskId === taskId)!.attempts.at(-1)!;
  return { household: next, attemptId: attempt.id };
}

function finishLinkedTask(household: Household, input: {
  rehearsalId: string;
  taskId: MonthRehearsalTaskId;
  attemptId: string;
  memberId: string;
  today: string;
  now: string;
  kind: MonthRehearsalReceiptKind;
  receiptId: string;
  postedIds?: string[];
}) {
  const linked = linkRehearsalReceipt(household, input).household;
  return recordRehearsalOutcome(linked, {
    rehearsalId: input.rehearsalId,
    taskId: input.taskId,
    attemptId: input.attemptId,
    memberId: input.memberId,
    outcome: "clear",
    now: input.now,
  }).household;
}

async function greenWeek(household: Household, rehearsalId: string, week: 1 | 2 | 3 | 4, today: string, now: string) {
  const checkpointed = (await evaluateRehearsalCheckpoint(household, { rehearsalId, week, memberId: BIANCA, today, now })).household;
  const checkpoint = checkpointed.monthRehearsals![0]!.weeks[week - 1]!.checkpoint!;
  expect(checkpoint.status).toBe("tied");
  await expect(acknowledgeRehearsalWeek(checkpointed, { rehearsalId, week, actorMemberId: BIANCA, memberId: JONATHAN, now })).rejects.toThrow(/cannot acknowledge/);
  const biancaPhone = (await acknowledgeRehearsalWeek(checkpointed, { rehearsalId, week, actorMemberId: BIANCA, memberId: BIANCA, now })).household;
  const jonathanPhone = (await acknowledgeRehearsalWeek(checkpointed, { rehearsalId, week, actorMemberId: JONATHAN, memberId: JONATHAN, now })).household;
  const biancaParts = splitForSync(biancaPhone, BIANCA);
  const jonathanParts = splitForSync(jonathanPhone, JONATHAN);
  const merged = assembleHousehold(mergeShared(biancaParts.shared, jonathanParts.shared), biancaParts.personal, { linked: true });
  expect(new Set(merged.monthRehearsals![0]!.weeks[week - 1]!.acknowledgements.map((row) => row.memberId))).toEqual(new Set([BIANCA, JONATHAN]));
  return merged;
}

describe("fictional September 2026 golden month", () => {
  let cryptoCounter = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
    cryptoCounter = 0;
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(((array: ArrayBufferView) => {
      cryptoCounter += 1;
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      bytes.forEach((_value, index) => { bytes[index] = (cryptoCounter * 17 + index * 29) % 256; });
      return array;
    }) as Crypto["getRandomValues"]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("freezes every weekly balance, journal total, receipt identity, and audit hash", async () => {
    let household = goldenHousehold();
    household = startMonthRehearsal(household, {
      monthKey: "2026-09", biancaParticipantId: BIANCA, jonathanPartnerId: JONATHAN, startedByMemberId: BIANCA,
      now: "2026-08-28T16:00:00.000Z",
    }).household;
    const rehearsalId = household.monthRehearsals![0]!.id;
    const weeklyFinancialHashes: string[] = [];

    let task = beginTask(household, rehearsalId, "opening-truth", BIANCA, "2026-09-01", "2026-09-01T12:00:00Z");
    household = task.household;
    const opening = postOpeningBalances(household, {
      asOfDate: "2026-09-01", createdBy: BIANCA, confirmationId: "C-OPENING",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 3000_00 },
        { accountId: "ACC-BIANCA-SAVINGS", amountCents: 5000_00 },
        { accountId: "ACC-VISA", amountCents: 400_00 },
      ],
    });
    household = await accept(household, opening, "C-OPENING", "postOpeningBalances");
    household = finishLinkedTask(household, { rehearsalId, taskId: "opening-truth", attemptId: task.attemptId, memberId: BIANCA, today: "2026-09-01", now: "2026-09-01T12:01:00Z", kind: "command", receiptId: "C-OPENING" });

    task = beginTask(household, rehearsalId, "income", BIANCA, "2026-09-02", "2026-09-02T12:00:00Z"); household = task.household;
    const income = postEntry(household, { date: "2026-09-02", type: "income", amount: 2000, accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME", createdBy: BIANCA, visibility: "household", confirmDuplicate: true });
    household = await accept(household, income, "C-INCOME", "postEntry");
    household = finishLinkedTask(household, { rehearsalId, taskId: "income", attemptId: task.attemptId, memberId: BIANCA, today: "2026-09-02", now: "2026-09-02T12:01:00Z", kind: "command", receiptId: "C-INCOME" });

    task = beginTask(household, rehearsalId, "groceries", JONATHAN, "2026-09-03", "2026-09-03T12:00:00Z"); household = task.household;
    const groceries = postEntry(household, { date: "2026-09-03", type: "expense", amount: 100, accountId: "ACC-VISA", subcategoryId: "SUB-GROCERIES", createdBy: JONATHAN, visibility: "household", confirmDuplicate: true });
    household = await accept(household, groceries, "C-GROCERIES", "postEntry");
    household = finishLinkedTask(household, { rehearsalId, taskId: "groceries", attemptId: task.attemptId, memberId: JONATHAN, today: "2026-09-03", now: "2026-09-03T12:01:00Z", kind: "command", receiptId: "C-GROCERIES" });

    task = beginTask(household, rehearsalId, "fund-setup", BIANCA, "2026-09-04", "2026-09-04T12:00:00Z"); household = task.household;
    const fundSetup = configureHouseholdFund(household, { custodianMemberId: BIANCA, openedOn: "2026-09-04", createdBy: BIANCA });
    household = await accept(household, fundSetup, "C-FUND-SETUP", "configureHouseholdFund");
    household = finishLinkedTask(household, { rehearsalId, taskId: "fund-setup", attemptId: task.attemptId, memberId: BIANCA, today: "2026-09-04", now: "2026-09-04T12:01:00Z", kind: "command", receiptId: "C-FUND-SETUP" });

    task = beginTask(household, rehearsalId, "fund-contribution", JONATHAN, "2026-09-05", "2026-09-05T12:00:00Z"); household = task.household;
    let fundCommand = proposeHouseholdFundContribution(household, { memberId: JONATHAN, contributorMemberId: JONATHAN, amount: 1000, date: "2026-09-05" });
    household = await accept(household, fundCommand, "C-FUND-PROPOSAL", "proposeHouseholdFundContribution");
    fundCommand = confirmHouseholdFundContribution(household, { memberId: BIANCA, proposalEventId: fundCommand.postedIds[0]!, date: "2026-09-05" });
    household = await accept(household, fundCommand, "C-FUND-CONTRIBUTION", "confirmHouseholdFundContribution");
    const contributionEventId = fundCommand.postedIds[0]!;
    household = finishLinkedTask(household, { rehearsalId, taskId: "fund-contribution", attemptId: task.attemptId, memberId: JONATHAN, today: "2026-09-05", now: "2026-09-05T12:02:00Z", kind: "fund-event", receiptId: contributionEventId });

    task = beginTask(household, rehearsalId, "shared-fund-purchase", JONATHAN, "2026-09-06", "2026-09-06T12:00:00Z"); household = task.household;
    const purchase = postEntry(household, { date: "2026-09-06", type: "expense", amount: 100, accountId: "ACC-VISA", subcategoryId: "SUB-GROCERIES", createdBy: BIANCA, visibility: "household", confirmDuplicate: true, funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 100_00, destinationAccountId: "ACC-VISA" } });
    household = await accept(household, purchase, "C-FUND-PURCHASE", "postEntry");
    const purchaseTransactionId = purchase.postedIds.find((id) => id.startsWith("TXN-"))!;
    const purchaseEventId = purchase.postedIds.find((id) => id.startsWith("FUND-EVT-"))!;
    household = finishLinkedTask(household, { rehearsalId, taskId: "shared-fund-purchase", attemptId: task.attemptId, memberId: JONATHAN, today: "2026-09-06", now: "2026-09-06T12:01:00Z", kind: "fund-event", receiptId: purchaseEventId });

    household = await greenWeek(household, rehearsalId, 1, "2026-09-07", "2026-09-07T20:00:00Z");
    let checkpoint = household.monthRehearsals![0]!.weeks[0]!.checkpoint!;
    expect(checkpoint).toMatchObject({
      accountBalancesCents: { "ACC-CHEQUING": 5000_00, "ACC-BIANCA-SAVINGS": 5000_00, "ACC-VISA": 600_00 },
      assetCents: 10000_00, liabilityCents: 600_00, openingEquityCents: 7600_00, netIncomeCents: 1800_00,
      journalEntryCount: 6, totalDebitCents: 10200_00, totalCreditCents: 10200_00,
      fundOperatingCents: 1000_00, fundDueCents: 100_00, fundFreeCents: 900_00,
    });
    weeklyFinancialHashes.push(await financialAuditHash(household));

    task = beginTask(household, rehearsalId, "bills", BIANCA, "2026-09-08", "2026-09-08T12:00:00Z"); household = task.household;
    const bill = postEntry(household, { date: "2026-09-08", type: "expense", amount: 1200, accountId: "ACC-CHEQUING", subcategoryId: "SUB-BILL", createdBy: BIANCA, visibility: "household", confirmDuplicate: true });
    household = await accept(household, bill, "C-BILL", "postEntry");
    household = finishLinkedTask(household, { rehearsalId, taskId: "bills", attemptId: task.attemptId, memberId: BIANCA, today: "2026-09-08", now: "2026-09-08T12:01:00Z", kind: "command", receiptId: "C-BILL" });

    task = beginTask(household, rehearsalId, "card-payment", JONATHAN, "2026-09-09", "2026-09-09T12:00:00Z"); household = task.household;
    const card = postTransfer(household, { date: "2026-09-09", amount: 400, fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-VISA", createdBy: JONATHAN, visibility: "household", confirmDuplicate: true, note: "Visa payment" });
    household = await accept(household, card, "C-CARD-PAYMENT", "postTransfer");
    household = finishLinkedTask(household, { rehearsalId, taskId: "card-payment", attemptId: task.attemptId, memberId: JONATHAN, today: "2026-09-09", now: "2026-09-09T12:01:00Z", kind: "command", receiptId: "C-CARD-PAYMENT" });

    task = beginTask(household, rehearsalId, "fund-partial-settlement", BIANCA, "2026-09-10", "2026-09-10T12:00:00Z"); household = task.household;
    fundCommand = confirmHouseholdFundSettlement(household, { memberId: BIANCA, amount: 60, destinationAccountId: "ACC-VISA", date: "2026-09-10", allocations: [{ transactionId: purchaseTransactionId, amount: 60 }] });
    household = await accept(household, fundCommand, "C-FUND-PARTIAL", "confirmHouseholdFundSettlement");
    const partialEventId = fundCommand.postedIds.find((id) => id.startsWith("FUND-EVT-"))!;
    household = finishLinkedTask(household, { rehearsalId, taskId: "fund-partial-settlement", attemptId: task.attemptId, memberId: BIANCA, today: "2026-09-10", now: "2026-09-10T12:01:00Z", kind: "fund-event", receiptId: partialEventId });

    household = await greenWeek(household, rehearsalId, 2, "2026-09-14", "2026-09-14T20:00:00Z");
    checkpoint = household.monthRehearsals![0]!.weeks[1]!.checkpoint!;
    expect(checkpoint).toMatchObject({
      accountBalancesCents: { "ACC-CHEQUING": 3400_00, "ACC-BIANCA-SAVINGS": 5000_00, "ACC-VISA": 200_00 },
      assetCents: 8400_00, liabilityCents: 200_00, openingEquityCents: 7600_00, netIncomeCents: 600_00,
      journalEntryCount: 8, totalDebitCents: 9800_00, totalCreditCents: 9800_00,
      fundOperatingCents: 940_00, fundDueCents: 40_00, fundFreeCents: 900_00,
    });
    weeklyFinancialHashes.push(await financialAuditHash(household));

    task = beginTask(household, rehearsalId, "refund", JONATHAN, "2026-09-15", "2026-09-15T12:00:00Z"); household = task.household;
    const refund = postEntry(household, { date: "2026-09-15", type: "refund", amount: 20, accountId: "ACC-VISA", subcategoryId: "SUB-GROCERIES", refundOfId: purchaseTransactionId, createdBy: JONATHAN, visibility: "household", confirmDuplicate: true });
    household = await accept(household, refund, "C-REFUND", "postEntry");
    household = finishLinkedTask(household, { rehearsalId, taskId: "refund", attemptId: task.attemptId, memberId: JONATHAN, today: "2026-09-15", now: "2026-09-15T12:01:00Z", kind: "command", receiptId: "C-REFUND" });

    task = beginTask(household, rehearsalId, "correction-practice", BIANCA, "2026-09-16", "2026-09-16T12:00:00Z"); household = task.household;
    household = (await completeRehearsalCorrectionPractice(household, { rehearsalId, memberId: BIANCA, today: "2026-09-16", now: "2026-09-16T12:01:00Z" })).household;
    household = recordRehearsalOutcome(household, { rehearsalId, taskId: "correction-practice", attemptId: task.attemptId, memberId: BIANCA, outcome: "clear", now: "2026-09-16T12:02:00Z" }).household;

    task = beginTask(household, rehearsalId, "account-reconciliation", BIANCA, "2026-09-21", "2026-09-21T12:00:00Z"); household = task.household;
    const reconciliationIds: string[] = [];
    for (const [accountId, amount] of [["ACC-CHEQUING", 3400], ["ACC-BIANCA-SAVINGS", 5000], ["ACC-VISA", 180]] as const) {
      const result = recordReconciliation(household, { accountId, statementDate: "2026-09-21", statementAmount: amount, createdBy: BIANCA });
      reconciliationIds.push(result.household.kitchen.books.reconciliations.at(-1)!.id);
      household = await accept(household, result, `C-REC-${accountId}`, "recordReconciliation");
    }
    household = finishLinkedTask(household, { rehearsalId, taskId: "account-reconciliation", attemptId: task.attemptId, memberId: BIANCA, today: "2026-09-21", now: "2026-09-21T12:03:00Z", kind: "reconciliation", receiptId: reconciliationIds[0]!, postedIds: reconciliationIds });

    household = await greenWeek(household, rehearsalId, 3, "2026-09-21", "2026-09-21T20:00:00Z");
    checkpoint = household.monthRehearsals![0]!.weeks[2]!.checkpoint!;
    expect(checkpoint).toMatchObject({
      accountBalancesCents: { "ACC-CHEQUING": 3400_00, "ACC-BIANCA-SAVINGS": 5000_00, "ACC-VISA": 180_00 },
      assetCents: 8400_00, liabilityCents: 180_00, openingEquityCents: 7600_00, netIncomeCents: 620_00,
      journalEntryCount: 9, totalDebitCents: 9780_00, totalCreditCents: 9780_00,
      fundOperatingCents: 940_00, fundDueCents: 20_00, fundFreeCents: 920_00,
    });
    weeklyFinancialHashes.push(await financialAuditHash(household));

    task = beginTask(household, rehearsalId, "fund-final-settlement", BIANCA, "2026-09-22", "2026-09-22T12:00:00Z"); household = task.household;
    fundCommand = confirmHouseholdFundSettlement(household, { memberId: BIANCA, amount: 20, destinationAccountId: "ACC-VISA", date: "2026-09-22", allocations: [{ transactionId: purchaseTransactionId, amount: 20 }] });
    household = await accept(household, fundCommand, "C-FUND-FINAL", "confirmHouseholdFundSettlement");
    const finalSettlementEventId = fundCommand.postedIds.find((id) => id.startsWith("FUND-EVT-"))!;
    household = finishLinkedTask(household, { rehearsalId, taskId: "fund-final-settlement", attemptId: task.attemptId, memberId: BIANCA, today: "2026-09-22", now: "2026-09-22T12:01:00Z", kind: "fund-event", receiptId: finalSettlementEventId });

    task = beginTask(household, rehearsalId, "fund-reconciliation", BIANCA, "2026-09-23", "2026-09-23T12:00:00Z"); household = task.household;
    fundCommand = recordHouseholdFundReconciliation(household, { memberId: BIANCA, date: "2026-09-23", bankTotal: 920, personalRemainder: 0 });
    household = await accept(household, fundCommand, "C-FUND-RECONCILIATION", "recordHouseholdFundReconciliation");
    const fundReconciliationEventId = fundCommand.postedIds.find((id) => id.startsWith("FUND-EVT-"))!;
    household = finishLinkedTask(household, { rehearsalId, taskId: "fund-reconciliation", attemptId: task.attemptId, memberId: BIANCA, today: "2026-09-23", now: "2026-09-23T12:01:00Z", kind: "fund-event", receiptId: fundReconciliationEventId });

    task = beginTask(household, rehearsalId, "month-review", JONATHAN, "2026-09-29", "2026-09-29T12:00:00Z"); household = task.household;
    household = finishLinkedTask(household, { rehearsalId, taskId: "month-review", attemptId: task.attemptId, memberId: JONATHAN, today: "2026-09-29", now: "2026-09-29T12:10:00Z", kind: "review", receiptId: "REVIEW-2026-09-TOGETHER" });

    task = beginTask(household, rehearsalId, "month-close", JONATHAN, "2026-09-30", "2026-09-30T12:00:00Z"); household = task.household;
    const closed = closeBooksMonth(household, { monthKey: "2026-09", createdBy: JONATHAN });
    household = await accept(household, closed, "C-MONTH-CLOSE", "closeBooksMonth");
    const closedPeriodId = household.kitchen.books.closedMonths.find((row) => row.monthKey === "2026-09")!.id;
    household = finishLinkedTask(household, { rehearsalId, taskId: "month-close", attemptId: task.attemptId, memberId: JONATHAN, today: "2026-09-30", now: "2026-09-30T12:01:00Z", kind: "month-close", receiptId: closedPeriodId });

    household = await greenWeek(household, rehearsalId, 4, "2026-09-30", "2026-09-30T20:00:00Z");
    checkpoint = household.monthRehearsals![0]!.weeks[3]!.checkpoint!;
    expect(checkpoint).toMatchObject({
      accountBalancesCents: { "ACC-CHEQUING": 3400_00, "ACC-BIANCA-SAVINGS": 5000_00, "ACC-VISA": 180_00 },
      assetCents: 8400_00, liabilityCents: 180_00, openingEquityCents: 7600_00, netIncomeCents: 620_00,
      journalEntryCount: 9, totalDebitCents: 9780_00, totalCreditCents: 9780_00,
      fundOperatingCents: 920_00, fundDueCents: 0, fundFreeCents: 920_00,
    });
    weeklyFinancialHashes.push(await financialAuditHash(household));

    const books = compileHousehold(household);
    expect(trialBalance(books)).toMatchObject({ totalDebitCents: 9780_00, totalCreditCents: 9780_00, inBalance: true });
    expect(booksEquation(books)).toMatchObject({ assetCents: 8400_00, liabilityCents: 180_00, openingEquityCents: 7600_00, netIncomeCents: 620_00, holds: true });
    expect(projectHouseholdFund(household, "2026-09-30")).toMatchObject({ operatingBalanceCents: 920_00, transferDueCents: 0, freeToSpendCents: 920_00 });
    expect(household.kitchen.books.closedMonths.map((row) => row.monthKey)).toContain("2026-09");

    household = (await approveMonthRehearsal(household, { rehearsalId, actorMemberId: BIANCA, memberId: BIANCA, statement: BIANCA_APPROVAL_STATEMENT, now: "2026-09-30T20:05:00Z" })).household;
    household = (await approveMonthRehearsal(household, { rehearsalId, actorMemberId: JONATHAN, memberId: JONATHAN, statement: JONATHAN_COUNTERSIGNATURE, now: "2026-09-30T20:06:00Z" })).household;
    expect(household.monthRehearsals![0]).toMatchObject({ status: "archived", approvedAt: "2026-09-30T20:06:00.000Z", archivedAt: "2026-09-30T20:06:00.000Z" });

    const reopened = reopenBooksMonth(household, "2026-09").household;
    const corrected = reversePostedMoney(reopened, groceries.postedIds[0]!, { createdBy: JONATHAN, reversalDate: "2026-09-30" }).household;
    expect(await rehearsalCheckpointIsCurrent(corrected, corrected.monthRehearsals![0]!, 1)).toBe(false);

    const checkpointHashes = household.monthRehearsals![0]!.weeks.map((week) => week.checkpoint!.financialAuditHash);
    const receiptIdentities = household.monthRehearsals![0]!.weeks.map((week) => week.checkpoint!.linkedReceiptIds);
    expect(checkpointHashes).toEqual([
      "b00e980663d611c21f329b9f89161372d22a5da2efb7d8a16e4243fac6ed1f52",
      "77cc62e2415f745f6fcf6f044734cfa83cc47adb4874973d7afe5b77a24eb81f",
      "47301fd25fca8516855feb6dfbddbfa6c62c49cacc0d224a1597a8a3af232311",
      "f0a5c80a4f4d68ec79ffc8ee562db1b61abbd370ffdf38a50aa32cc8e8cc5c73",
    ]);
    expect(weeklyFinancialHashes).toEqual([
      "209aef186df6aac92d25bbd804ee098748c911f81a10f0c1112134e152d8607b",
      "8a4422e12d44d726be23adba196542c2de5c6f926d334d553fa7ea58ee4b5239",
      "308beca9acf4d323faedbbe2866dfba953dd9bcad2c5d7ba9a17d17f9869f2c2",
      "3101c983285b819031dd2ffaa66071c9d4bda25adfaded998f98469f7f34e097",
    ]);
    expect(receiptIdentities).toEqual([
      ["C-FUND-SETUP", "C-GROCERIES", "C-INCOME", "C-OPENING", "FUND-EVT-53708daac7", "FUND-EVT-cae704213e", "FUND-HOUSEHOLD", "TXN-EX-7693b0cdea", "TXN-IN-102d4a6784", "TXN-OP-88a5c2dffc", "TXN-OP-99b6d3f00d", "TXN-OP-aac7e4011e"],
      ["C-BILL", "C-CARD-PAYMENT", "FUND-EVT-405d7a97b4", "TXN-EX-63809dbad7", "TXN-TR-c9e603203d", "TXN-TR-daf714314e"],
      ["C-REFUND", "FUND-EVT-ea0724415e", "PRACTICE-C77D15203121DD62664C", "REC-2d4a6784a1", "REC-4f6c89a6c3", "REC-718eabc8e5", "TXN-RF-d9f613304d"],
      ["CLOSE-2026-09", "FUND-EVT-0a2744617e", "FUND-EVT-708daac7e4", "REVIEW-2026-09-TOGETHER"],
    ]);
  }, 20_000);
});
