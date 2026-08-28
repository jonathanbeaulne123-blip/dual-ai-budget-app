import { describe, expect, it } from "vitest";
import {
  archiveMonthRehearsal,
  assembleHousehold,
  catalogHousehold,
  completeRehearsalCorrectionPractice,
  financialAuditHash,
  householdForAiDisclosure,
  linkRehearsalReceipt,
  mergeShared,
  monthRehearsalReport,
  postEntry,
  postTransfer,
  recordRehearsalOutcome,
  runMonthRehearsalCorrectionPractice,
  splitForSync,
  startMonthRehearsal,
  startRehearsalTask,
  taskRequiresFinancialReceipt,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function started() {
  const result = startMonthRehearsal(catalogHousehold("development"), {
    monthKey: "2026-09",
    biancaParticipantId: BIANCA,
    jonathanPartnerId: JONATHAN,
    startedByMemberId: BIANCA,
    now: "2026-08-28T16:00:00.000Z",
  });
  return { household: result.household, rehearsalId: result.household.monthRehearsals![0]!.id };
}

describe("Bianca month rehearsal core", () => {
  it("is Development-only, non-money, and absent from financial hashes and Hercules context", async () => {
    const production = catalogHousehold("production");
    expect(() => startMonthRehearsal(production, {
      monthKey: "2026-09", biancaParticipantId: BIANCA, jonathanPartnerId: JONATHAN, startedByMemberId: BIANCA,
    })).toThrow(/Development only/);

    const household = catalogHousehold("development");
    const beforeHash = await financialAuditHash(household);
    const result = startMonthRehearsal(household, {
      monthKey: "2026-09", biancaParticipantId: BIANCA, jonathanPartnerId: JONATHAN, startedByMemberId: BIANCA,
      now: "2026-08-28T16:00:00.000Z",
    });
    expect(result.postedIds).toEqual([]);
    expect(await financialAuditHash(result.household)).toBe(beforeHash);
    expect(householdForAiDisclosure(result.household, BIANCA)).toMatchObject({ monthRehearsals: [] });
  });

  it("keeps future weeks read-only and distinguishes unfinished from stopped", () => {
    let { household, rehearsalId } = started();
    expect(() => startRehearsalTask(household, {
      rehearsalId, taskId: "bills", memberId: BIANCA, today: "2026-09-07",
    })).toThrow(/read-only preview/);

    household = startRehearsalTask(household, {
      rehearsalId, taskId: "income", memberId: BIANCA, today: "2026-09-01", now: "2026-09-01T22:00:00.000Z",
    }).household;
    const task = household.monthRehearsals![0]!.weeks[0]!.tasks.find((row) => row.taskId === "income")!;
    expect(task.status).toBe("in-progress");
    const continued = startRehearsalTask(household, {
      rehearsalId, taskId: "income", memberId: BIANCA, today: "2026-09-02", now: "2026-09-02T22:00:00.000Z",
    }).household;
    expect(continued.monthRehearsals![0]!.weeks[0]!.tasks.find((row) => row.taskId === "income")!.attempts).toHaveLength(1);
    household = recordRehearsalOutcome(continued, {
      rehearsalId, taskId: "income", attemptId: task.attempts[0]!.id, memberId: BIANCA,
      outcome: "stopped", note: "I was not sure which pay line to use.", now: "2026-09-02T22:01:00.000Z",
    }).household;
    const stopped = household.monthRehearsals![0]!.weeks[0]!.tasks.find((row) => row.taskId === "income")!;
    expect(stopped.status).toBe("not-started");
    expect(stopped.skip).toBeNull();
    expect(stopped.attempts[0]).toMatchObject({ outcome: "stopped", elapsedSeconds: 86460 });
  });

  it("permits Did not happen only for ordinary optional events", () => {
    let { household, rehearsalId } = started();
    household = startRehearsalTask(household, { rehearsalId, taskId: "income", memberId: BIANCA, today: "2026-09-01", now: "2026-09-01T10:00:00Z" }).household;
    const incomeAttempt = household.monthRehearsals![0]!.weeks[0]!.tasks.find((row) => row.taskId === "income")!.attempts[0]!;
    household = recordRehearsalOutcome(household, {
      rehearsalId, taskId: "income", attemptId: incomeAttempt.id, memberId: BIANCA,
      outcome: "clear", didNotHappen: true, now: "2026-09-01T10:00:30Z",
    }).household;
    expect(household.monthRehearsals![0]!.weeks[0]!.tasks.find((row) => row.taskId === "income")!.status).toBe("skipped");

    household = startRehearsalTask(household, { rehearsalId, taskId: "opening-truth", memberId: BIANCA, today: "2026-09-01", now: "2026-09-01T10:01:00Z" }).household;
    const openingAttempt = household.monthRehearsals![0]!.weeks[0]!.tasks.find((row) => row.taskId === "opening-truth")!.attempts[0]!;
    expect(() => recordRehearsalOutcome(household, {
      rehearsalId, taskId: "opening-truth", attemptId: openingAttempt.id, memberId: BIANCA,
      outcome: "clear", didNotHappen: true, now: "2026-09-01T10:01:30Z",
    })).toThrow(/cannot be skipped/);
  });

  it("runs correction practice in a discarded fictional copy and links only its proof", async () => {
    let { household, rehearsalId } = started();
    household = startRehearsalTask(household, {
      rehearsalId, taskId: "correction-practice", memberId: BIANCA, today: "2026-09-15", now: "2026-09-15T20:00:00Z",
    }).household;
    const beforeTransactions = household.transactions.length;
    const proof = await runMonthRehearsalCorrectionPractice({ date: "2026-09-15", memberId: BIANCA });
    expect(proof).toMatchObject({ fictional: true, discarded: true, mistakeCents: 4500, mistakeEntryCount: 1, reversalEntryCount: 2, trialInBalance: true, equationHolds: true, netIncomeCents: 0, persistedIds: [] });
    expect(() => linkRehearsalReceipt(household, {
      rehearsalId, taskId: "correction-practice", memberId: BIANCA, today: "2026-09-15",
      kind: "practice", receiptId: "PRACTICE-FORGED", now: "2026-09-15T20:01:00Z",
    })).toThrow(/isolated correction practice/i);
    household = (await completeRehearsalCorrectionPractice(household, {
      rehearsalId, memberId: BIANCA, today: "2026-09-15", now: "2026-09-15T20:01:00Z",
    })).household;
    const task = household.monthRehearsals![0]!.weeks[2]!.tasks.find((row) => row.taskId === "correction-practice")!;
    household = recordRehearsalOutcome(household, {
      rehearsalId, taskId: "correction-practice", attemptId: task.attempts[0]!.id, memberId: BIANCA,
      outcome: "clear", now: "2026-09-15T20:02:00Z",
    }).household;
    expect(household.transactions).toHaveLength(beforeTransactions);
    expect(household.monthRehearsals![0]!.weeks[2]!.tasks.find((row) => row.taskId === "correction-practice")!.status).toBe("complete");
  });

  it("merges concurrent two-phone progress without one task erasing another", () => {
    const { household, rehearsalId } = started();
    household.commandReceipts = [{ confirmationId: "C-BASE", identityHash: "I-BASE", auditHash: "A-BASE", commandKind: "postEntry", postedIds: [], revision: 1, acceptedAt: "2026-09-01T09:00:00Z" }];
    const bianca = startRehearsalTask(household, {
      rehearsalId, taskId: "income", memberId: BIANCA, today: "2026-09-01", now: "2026-09-01T10:00:00Z",
    }).household;
    const jonathan = startRehearsalTask(household, {
      rehearsalId, taskId: "groceries", memberId: JONATHAN, today: "2026-09-01", now: "2026-09-01T10:00:01Z",
    }).household;
    const biancaParts = splitForSync(bianca, BIANCA);
    const jonathanParts = splitForSync(jonathan, JONATHAN);
    const merged = assembleHousehold(mergeShared(biancaParts.shared, jonathanParts.shared), biancaParts.personal, { linked: true });
    const week = merged.monthRehearsals![0]!.weeks[0]!;
    expect(week.tasks.find((row) => row.taskId === "income")!.attempts).toHaveLength(1);
    expect(week.tasks.find((row) => row.taskId === "groceries")!.attempts).toHaveLength(1);
    expect(merged.commandReceipts.map((row) => row.confirmationId)).toContain("C-BASE");
    const otherAttempt = week.tasks.find((row) => row.taskId === "groceries")!.attempts[0]!;
    expect(() => recordRehearsalOutcome(merged, {
      rehearsalId, taskId: "groceries", attemptId: otherAttempt.id, memberId: BIANCA,
      outcome: "clear", now: "2026-09-01T10:01:00Z",
    })).toThrow(/own attempt/);
  });

  it("archives/reset metadata without changing money", async () => {
    const { household, rehearsalId } = started();
    const before = await financialAuditHash(household);
    const archived = archiveMonthRehearsal(household, { rehearsalId, memberId: BIANCA, now: "2026-09-01T10:00:00Z" });
    expect(archived.postedIds).toEqual([]);
    expect(archived.household.monthRehearsals![0]!.status).toBe("archived");
    expect(await financialAuditHash(archived.household)).toBe(before);
  });

  it("limits friction reports to the two named participants", () => {
    const { household, rehearsalId } = started();
    household.members.push({ id: "MEM-003", name: "Guest", color: "#555555", active: true, updatedAt: "2026-01-01T00:00:00.000Z" });
    expect(monthRehearsalReport(household, rehearsalId, BIANCA).human).toContain("Friction notes");
    expect(() => monthRehearsalReport(household, rehearsalId, "MEM-003")).toThrow(/two rehearsal participants/i);
  });

  it("uses one deterministic rehearsal identity for simultaneous two-phone starts and blocks conflicting active records", () => {
    const base = catalogHousehold("development");
    const biancaStart = startMonthRehearsal(base, { monthKey: "2026-09", biancaParticipantId: BIANCA, jonathanPartnerId: JONATHAN, startedByMemberId: BIANCA, now: "2026-08-28T10:00:00Z" }).household;
    const jonathanStart = startMonthRehearsal(base, { monthKey: "2026-09", biancaParticipantId: BIANCA, jonathanPartnerId: JONATHAN, startedByMemberId: JONATHAN, now: "2026-08-28T10:00:01Z" }).household;
    const biancaParts = splitForSync(biancaStart, BIANCA);
    const jonathanParts = splitForSync(jonathanStart, JONATHAN);
    const merged = assembleHousehold(mergeShared(biancaParts.shared, jonathanParts.shared), biancaParts.personal, { linked: true });
    expect(merged.monthRehearsals).toHaveLength(1);

    const conflicted = structuredClone(merged);
    conflicted.monthRehearsals!.push({ ...structuredClone(conflicted.monthRehearsals![0]!), id: "REHEARSAL-CONFLICT", startedByMemberId: JONATHAN });
    expect(() => startRehearsalTask(conflicted, { rehearsalId: conflicted.monthRehearsals![0]!.id, taskId: "income", memberId: BIANCA, today: "2026-09-01" })).toThrow(/two phones started different versions/i);
    const resolved = archiveMonthRehearsal(conflicted, { rehearsalId: "REHEARSAL-CONFLICT", memberId: JONATHAN, now: "2026-08-28T10:01:00Z" }).household;
    expect(startRehearsalTask(resolved, { rehearsalId: resolved.monthRehearsals![0]!.id, taskId: "income", memberId: BIANCA, today: "2026-09-01" }).household.monthRehearsals![0]!.weeks[0]!.tasks.find((row) => row.taskId === "income")!.status).toBe("in-progress");
  });

  it("runs correction practice for real participant identities that are not fixture member IDs", async () => {
    const household = catalogHousehold("development");
    household.members.push(
      { id: "GOOGLE-BIANCA-SUBJECT", name: "Bianca", color: "#123456", active: true, updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "GOOGLE-JONATHAN-SUBJECT", name: "Jonathan", color: "#654321", active: true, updatedAt: "2026-01-01T00:00:00.000Z" },
    );
    let next = startMonthRehearsal(household, { monthKey: "2026-09", biancaParticipantId: "GOOGLE-BIANCA-SUBJECT", jonathanPartnerId: "GOOGLE-JONATHAN-SUBJECT", startedByMemberId: "GOOGLE-BIANCA-SUBJECT", now: "2026-08-28T10:00:00Z" }).household;
    const rehearsalId = next.monthRehearsals![0]!.id;
    next = startRehearsalTask(next, { rehearsalId, taskId: "correction-practice", memberId: "GOOGLE-BIANCA-SUBJECT", today: "2026-09-15", now: "2026-09-15T10:00:00Z" }).household;
    next = (await completeRehearsalCorrectionPractice(next, { rehearsalId, memberId: "GOOGLE-BIANCA-SUBJECT", today: "2026-09-15", now: "2026-09-15T10:01:00Z" })).household;
    expect(next.monthRehearsals![0]!.weeks[2]!.tasks.find((row) => row.taskId === "correction-practice")!.receipt!.receiptId).toMatch(/^PRACTICE-/);
  });

  it("rejects hostile receipts that have the wrong command, category, or transfer destination", () => {
    let { household, rehearsalId } = started();
    const receipt = (confirmationId: string, commandKind: string, postedIds: string[]) => ({
      confirmationId, commandKind, postedIds, identityHash: `IDENTITY-${confirmationId}`,
      auditHash: `AUDIT-${confirmationId}`, revision: 1, acceptedAt: "2026-09-03T12:00:00.000Z",
    });

    const coffee = postEntry(household, { date: "2026-09-03", type: "expense", amount: 12.34, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-COFFEE", createdBy: BIANCA, confirmDuplicate: true });
    expect(coffee.undo.commandKind).toBe("postEntry");
    household = coffee.household;
    household.commandReceipts.push(receipt("C-COFFEE", "postEntry", coffee.postedIds));
    expect(() => linkRehearsalReceipt(household, { rehearsalId, taskId: "groceries", memberId: BIANCA, today: "2026-09-03", kind: "command", receiptId: "C-COFFEE" })).toThrow(/categorized as groceries/i);

    const grocery = postEntry(household, { date: "2026-09-03", type: "expense", amount: 45.67, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: BIANCA, confirmDuplicate: true });
    household = grocery.household;
    household.commandReceipts.push(receipt("C-GROCERY-WRONG-KIND", "postTransfer", grocery.postedIds));
    expect(() => linkRehearsalReceipt(household, { rehearsalId, taskId: "groceries", memberId: BIANCA, today: "2026-09-03", kind: "command", receiptId: "C-GROCERY-WRONG-KIND" })).toThrow(/different kind of action/i);

    const savingsTransfer = postTransfer(household, { date: "2026-09-09", amount: 20, fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-SAVINGS", createdBy: BIANCA, confirmDuplicate: true });
    expect(savingsTransfer.undo.commandKind).toBe("postTransfer");
    household = savingsTransfer.household;
    household.commandReceipts.push(receipt("C-SAVINGS-TRANSFER", "postTransfer", savingsTransfer.postedIds));
    expect(() => linkRehearsalReceipt(household, { rehearsalId, taskId: "card-payment", memberId: BIANCA, today: "2026-09-09", kind: "command", receiptId: "C-SAVINGS-TRANSFER" })).toThrow(/credit account/i);
  });

  it("identifies every money-affecting task as receipt-bound", () => {
    expect(taskRequiresFinancialReceipt("opening-truth")).toBe(true);
    expect(taskRequiresFinancialReceipt("fund-contribution")).toBe(true);
    expect(taskRequiresFinancialReceipt("refund")).toBe(true);
    expect(taskRequiresFinancialReceipt("correction-practice")).toBe(false);
    expect(taskRequiresFinancialReceipt("month-review")).toBe(false);
  });
});
