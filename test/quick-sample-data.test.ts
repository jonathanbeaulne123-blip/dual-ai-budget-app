import { describe, it, expect } from "vitest";
import { addAccount, catalogHousehold, postEntry, splitForSync, assertAcceptableBooks, financialAuditHash, buildMonthBoard, removePotentialExpense } from "../src/core/index.ts";
import { addQuickSampleData, previewQuickSampleData, addQuickSampleScenario, previewQuickSampleScenario, type QuickSampleInput } from "../src/core/quickSampleData.ts";
import { capturedIntent, clearCapturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";

const input: QuickSampleInput = { today: "2026-09-11", months: 3, seed: 81, memberId: "MEM-001", accountId: "ACC-CHEQUING", visibility: "household" };
function fixture() {
  const h = catalogHousehold();
  const one = splitForSync(h, "MEM-001"), two = splitForSync(h, "MEM-002");
  const state: AuthorityState = { sequence: h.revision, shared: one.shared, personal: new Map([["MEM-001", one.personal], ["MEM-002", two.personal]]) };
  const scope: Scope = { environment: "development", householdId: h.householdId, memberId: "MEM-001", subject: "sample-test", role: "owner", expires: Date.now() + 60000, aclEpoch: 1 };
  return { h, state, scope };
}

describe("lightweight fictional data", () => {
  it.each([3, 4, 5, 6])("bounds %i months and preserves current books and setup", months => {
    const original = postEntry(catalogHousehold(), { date: input.today, type: "expense", amount: 9, accountId: input.accountId, subcategoryId: "SUB-FOOD-GROCERIES", createdBy: input.memberId }).household;
    const before = structuredClone(original);
    const result = addQuickSampleData(original, { ...input, months });
    expect(original).toEqual(before);
    expect(result.household.householdId).toBe(original.householdId);
    expect(result.household.accounts).toEqual(original.accounts);
    expect(result.household.members).toEqual(original.members);
    expect(result.household.kitchen).toEqual(original.kitchen);
    expect(result.household.transactions[0]).toEqual(original.transactions[0]);
    expect(result.postedIds).toHaveLength(months * 16);
    const rows = result.household.transactions.slice(1);
    expect(new Set(rows.map(r => r.date.slice(0, 7))).size).toBe(months);
    expect(rows.every(r => r.date <= input.today && r.note.startsWith("Fictional sample"))).toBe(true);
    expect(capturedIntent(result.household)?.steps).toHaveLength(2); // existing unaccepted post plus this one bounded action
    expect(() => assertAcceptableBooks(result.household)).not.toThrow();
  });
  it("is deterministic, varies seeds, and refuses stacking, Production, bad scopes and closed periods", () => {
    const { h } = fixture();
    expect(previewQuickSampleData(h, input)).toEqual(previewQuickSampleData(h, input));
    expect(previewQuickSampleData(h, input).rows).not.toEqual(previewQuickSampleData(h, { ...input, seed: 82 }).rows);
    expect(() => addQuickSampleData({ ...h, environment: "production" }, input)).toThrow("Development-only");
    expect(() => addQuickSampleData(h, { ...input, months: 7 })).toThrow("3–6");
    expect(() => addQuickSampleData(h, { ...input, visibility: "personal" })).toThrow("cash account");
    const result = addQuickSampleData(h, input);
    expect(() => addQuickSampleData(result.household, { ...input, seed: 7 })).toThrow("already has");
    h.kitchen.books.closedMonths.push({ id: "closed", monthKey: "2026-08", closedAt: "2026-09-01T00:00:00Z", closedBy: input.memberId });
    expect(() => addQuickSampleData(h, input)).toThrow("closed books");
  });
  it("keeps all dates historical at January and leap-month boundaries", () => {
    for (const today of ["2026-01-01", "2024-02-29"]) {
      const rows = previewQuickSampleData(catalogHousehold(), { ...input, today, months: 6 }).rows;
      expect(rows).toHaveLength(96);
      expect(rows.every(r => r.date <= today && !Number.isNaN(Date.parse(r.date)))).toBe(true);
    }
  });
  it("replays as one authority command and rejects a forged actor", async () => {
    const { h, state, scope } = fixture();
    const result = addQuickSampleData(h, input);
    const capture = capturedIntent(result.household)!;
    expect(capture.steps).toHaveLength(1);
    const command = await commandFromCapture(capture, scope, crypto.randomUUID());
    const accepted = await prepareCommand(state, command, scope, () => {});
    expect(accepted.shared.transactions).toHaveLength(48);
    expect(accepted.receipt.postedIds).toHaveLength(48);
    const forged = { ...command, id: crypto.randomUUID(), steps: [{ ...command.steps[0]!, args: [{ ...input, memberId: "MEM-002" }] }] };
    await expect(prepareCommand(state, forged, scope, () => {})).rejects.toThrow("ACTOR_MISMATCH");
    const after = { ...state, sequence: accepted.receipt.sequence, shared: accepted.shared, personal: new Map(state.personal).set(input.memberId, accepted.personal) };
    const undone = await prepareCommand(after, { ...command, id: crypto.randomUUID(), observedSequence: accepted.receipt.sequence,
      steps: [{ kind: "undoConfirm", args: [command.id], previewIds: [], reviewed: [], resources: [] }] }, scope, () => {}, () => accepted.receipt);
    expect(undone.household.transactions).toHaveLength(0);
  });
  it("keeps Personal samples out of Shared replay and refuses another member's account", async () => {
    let { h, state, scope } = fixture();
    h = addAccount(h, { name: "Sample personal cash", kind: "chequing", scope: "personal", ownerMemberId: input.memberId }).household;
    clearCapturedIntent(h);
    const accountId = h.accounts.at(-1)!.id;
    const own = splitForSync(h, input.memberId);
    state = { ...state, shared: own.shared, personal: new Map(state.personal).set(input.memberId, own.personal) };
    const personal = { ...input, accountId, visibility: "personal" as const };
    expect(() => previewQuickSampleData(h, { ...personal, memberId: "MEM-002" })).toThrow("cash account");
    const command = await commandFromCapture(capturedIntent(addQuickSampleData(h, personal).household)!, scope, crypto.randomUUID());
    const accepted = await prepareCommand(state, command, scope, () => {});
    expect(accepted.shared.transactions).toHaveLength(0);
    expect(accepted.personal.transactions).toHaveLength(48);
    expect(accepted.personal.transactions.every(t => t.createdBy === input.memberId && t.visibility === "personal")).toBe(true);
  });
  it("measures the largest sample on a populated ledger", () => {
    const h = catalogHousehold();
    const tx = postEntry(h, { date: input.today, type: "income", amount: 1, accountId: input.accountId, subcategoryId: "SUB-INCOME-BIANCA", createdBy: input.memberId }).household.transactions[0]!;
    h.transactions = Array.from({ length: 500 }, (_, i) => ({ ...tx, id: `existing-${i}` }));
    const start = performance.now();
    const result = addQuickSampleData(h, { ...input, months: 6 });
    const elapsed = performance.now() - start;
    console.info(`Quick sample: 96 rows on 500 existing rows in ${elapsed.toFixed(1)}ms`);
    expect(result.household.transactions).toHaveLength(596);
    // Wall time varies under the concurrent quick gate. The browser proof measures
    // interaction frames while this work runs in its dedicated worker.
    expect(h.transactions).toHaveLength(500);
    expect(() => previewQuickSampleData({ ...h, transactions: Array(2001).fill(tx) }, input)).toThrow("plenty of history");
  });
});


describe("quick sample history and upcoming plans", () => {
  it.each([3, 4, 5, 6])("keeps %i months on scheduled dates and future expenses out of posted history", months => {
    const h = catalogHousehold();
    const preview = previewQuickSampleScenario(h, { ...input, months });
    const september = preview.rows.filter(r => r.date.startsWith("2026-09"));
    expect(september.filter(r => r.type === "income").map(r => r.date)).toEqual(["2026-09-01"]);
    expect(september.filter(r => r.date === input.today).map(r => r.note)).toEqual(["Fictional sample · Coffee & lunch"]);
    expect(preview.rows.every(r => r.date <= input.today)).toBe(true);
    expect(preview.plans).toHaveLength(months * 14);
    expect(preview.plans.every(p => p.date > input.today && p.date <= preview.futureEnd)).toBe(true);
    expect(preview.plans.some(p => p.date === "2026-09-17" && p.title.endsWith("Groceries"))).toBe(true);
    expect(new Set(preview.plans.map(p => `${p.date}:${p.title}`)).size).toBe(preview.plans.length);
    const result = addQuickSampleScenario(h, { ...input, months });
    expect(result.household.transactions).toHaveLength(preview.rows.length);
    expect(result.household.potentialExpenses).toHaveLength(preview.plans.length);
    expect(result.household.potentialExpenses.every(p => p.status === "planned" && p.transactionId === null)).toBe(true);
    expect(() => assertAcceptableBooks(result.household)).not.toThrow();
    expect(() => addQuickSampleScenario(result.household, input)).toThrow("already has");
  });
  it("supplements old sample history without changing or duplicating any posted row", async () => {
    const legacy = addQuickSampleData(catalogHousehold(), input).household;
    const before = structuredClone(legacy);
    const preview = previewQuickSampleScenario(legacy, input);
    expect(preview.existing).toBe(true);
    expect(preview.rows).toHaveLength(0);
    expect(preview.incomeCents).toBe(0);
    expect(preview.expenseCents).toBe(0);
    const result = addQuickSampleScenario(legacy, input);
    expect(result.household.transactions).toEqual(before.transactions);
    expect(legacy).toEqual(before);
    expect(result.household.potentialExpenses).toHaveLength(42);
    expect(await financialAuditHash(result.household)).toBe(await financialAuditHash(before));
    const october = buildMonthBoard(result.household, "2026-10", input.today);
    expect(october.days.flatMap(day => day.items).filter(item => item.potentialExpenseId)).toHaveLength(14);
    let removed = result.household;
    for (const plan of result.household.potentialExpenses) removed = removePotentialExpense(removed, { id: plan.id, createdBy: input.memberId }).household;
    expect(previewQuickSampleScenario(removed, input).plans).toHaveLength(42);
    expect(previewQuickSampleScenario(removed, input).rows).toHaveLength(0);
  });
  it.each(["2026-01-01", "2024-02-29", "2026-08-31", "2026-12-31"])("handles rolling calendar month boundaries from %s", today => {
    const preview = previewQuickSampleScenario(catalogHousehold(), { ...input, today });
    expect(preview.rows.every(r => r.date <= today)).toBe(true);
    expect(preview.plans.every(p => p.date > today && p.date <= preview.futureEnd)).toBe(true);
    expect(preview.plans).toHaveLength(42);
    if (today === "2026-08-31") expect(preview.futureEnd).toBe("2026-11-30");
  });
  it("replays both history and plans as one reviewed command and undoes its untouched records", async () => {
    const { h, state, scope } = fixture();
    const result = addQuickSampleScenario(h, input);
    const capture = capturedIntent(result.household)!;
    expect(capture.steps).toHaveLength(1);
    const command = await commandFromCapture(capture, scope, crypto.randomUUID());
    const accepted = await prepareCommand(state, command, scope, () => {});
    expect(accepted.household.transactions).toHaveLength(40);
    expect(accepted.household.potentialExpenses).toHaveLength(42);
    const after = { ...state, sequence: accepted.receipt.sequence, shared: accepted.shared, personal: new Map(state.personal).set(input.memberId, accepted.personal) };
    const undone = await prepareCommand(after, { ...command, id: crypto.randomUUID(), observedSequence: accepted.receipt.sequence,
      steps: [{ kind: "undoConfirm", args: [command.id], previewIds: [], reviewed: [], resources: [] }] }, scope, () => {}, () => accepted.receipt);
    expect(undone.household.transactions).toHaveLength(0);
    expect(undone.household.potentialExpenses).toHaveLength(0);
    const forged = { ...command, id: crypto.randomUUID(), steps: [{ ...command.steps[0]!, args: [{ ...input, memberId: "MEM-002" }] }] };
    await expect(prepareCommand(state, forged, scope, () => {})).rejects.toThrow("ACTOR_MISMATCH");
  });
  it("keeps personal future plans private during authority replay", async () => {
    let { h, state, scope } = fixture();
    h = addAccount(h, { name: "Personal samples", kind: "chequing", scope: "personal", ownerMemberId: input.memberId }).household;
    clearCapturedIntent(h);
    const personal = { ...input, visibility: "personal" as const, accountId: h.accounts.at(-1)!.id };
    const own = splitForSync(h, input.memberId);
    state = { ...state, shared: own.shared, personal: new Map(state.personal).set(input.memberId, own.personal) };
    const command = await commandFromCapture(capturedIntent(addQuickSampleScenario(h, personal).household)!, scope, crypto.randomUUID());
    const accepted = await prepareCommand(state, command, scope, () => {});
    expect(accepted.shared.transactions).toHaveLength(0);
    expect(accepted.shared.potentialExpenses).toHaveLength(0);
    expect(accepted.personal.transactions).toHaveLength(40);
    expect(accepted.personal.potentialExpenses).toHaveLength(42);
    expect((accepted.personal.potentialExpenses ?? []).every(p => p.createdBy === input.memberId && p.visibility === "personal")).toBe(true);
  });
  it("does not undo plans that have been changed or posted", async () => {
    const { undoLedgerConfirm } = await import("../src/core/confirmationUndo.ts");
    const result = addQuickSampleScenario(catalogHousehold(), input);
    result.household.potentialExpenses[0]!.status = "posted";
    expect(() => undoLedgerConfirm(result.household, result.undo)).toThrow("changed or posted");
    result.household.potentialExpenses[0]!.status = "planned";
    result.household.potentialExpenses[0]!.updatedAt = "2030-01-01T00:00:00Z";
    expect(() => undoLedgerConfirm(result.household, result.undo)).toThrow("changed or posted");
  });
});
