import { describe, expect, it } from "vitest";
import {
  addPotentialExpense,
  assembleHousehold,
  buildMonthBoard,
  catalogHousehold,
  composeNotices,
  dismissPotentialExpenseNotice,
  financialAuditHash,
  ensureHouseholdShape,
  householdForView,
  mergePersonal,
  movePotentialExpense,
  postPotentialExpense,
  removePotentialExpense,
  splitForSync,
  updatePotentialExpense,
  undoLedgerConfirm,
} from "../src/core/index.ts";

const baseInput = {
  date: "2026-09-29",
  title: "Wedding travel and gift",
  amount: "600",
  accountId: "ACC-CHEQUING",
  subcategoryId: "SUB-LIFE-FUN",
  createdBy: "MEM-001",
  visibility: "household" as const,
};

describe("potential Calendar expenses", () => {
  it("creates planning state without changing the accepted money hash", async () => {
    const household = catalogHousehold();
    const before = await financialAuditHash(household);
    const result = addPotentialExpense(household, baseInput);
    const plan = result.household.potentialExpenses[0]!;
    expect(plan).toMatchObject({
      date: "2026-09-29",
      title: "Wedding travel and gift",
      expectedAmountCents: 60_000,
      visibility: "household",
      status: "planned",
      transactionId: null,
    });
    expect(result.household.transactions).toEqual(household.transactions);
    expect(await financialAuditHash(result.household)).toBe(before);
  });

  it("edits, moves, and soft-removes an open plan without posting", () => {
    let household = addPotentialExpense(catalogHousehold(), baseInput).household;
    const id = household.potentialExpenses[0]!.id;
    household = updatePotentialExpense(household, { ...baseInput, id, amount: "625", title: "Wedding weekend", createdBy: "MEM-001" }).household;
    expect(household.potentialExpenses[0]).toMatchObject({ title: "Wedding weekend", expectedAmountCents: 62_500 });
    household = movePotentialExpense(household, { id, date: "2026-10-03", createdBy: "MEM-001" }).household;
    expect(household.potentialExpenses[0]!.date).toBe("2026-10-03");
    household = removePotentialExpense(household, { id, createdBy: "MEM-001" }).household;
    expect(household.potentialExpenses[0]).toMatchObject({ status: "removed", transactionId: null });
    expect(household.transactions).toHaveLength(catalogHousehold().transactions.length);
    expect(() => movePotentialExpense(household, { id, date: "2026-10-04", createdBy: "MEM-001" })).toThrow(/no longer open/i);
  });

  it("posts through one expense transaction and resolves the plan atomically", () => {
    const planned = addPotentialExpense(catalogHousehold(), baseInput).household;
    const id = planned.potentialExpenses[0]!.id;
    const projected = buildMonthBoard(planned, "2026-09", "2026-09-29");
    expect(projected.days.flatMap((day) => day.items).find((row) => row.potentialExpenseId === id)).toMatchObject({ amountCents: 60_000, direction: "out", due: true });
    const result = postPotentialExpense(planned, { id, createdBy: "MEM-002" });
    const plan = result.household.potentialExpenses.find((row) => row.id === id)!;
    const transaction = result.household.transactions.find((row) => row.id === plan.transactionId)!;
    expect(plan.status).toBe("posted");
    expect(transaction).toMatchObject({
      date: "2026-09-29",
      type: "expense",
      amountCents: 60_000,
      source: "calendar",
      sourceId: id,
      visibility: "household",
      createdBy: "MEM-002",
    });
    expect(() => postPotentialExpense(result.household, { id, createdBy: "MEM-002" })).toThrow(/already resolved/i);
    expect(buildMonthBoard(result.household, "2026-09", "2026-09-29").days.flatMap((day) => day.items).some((row) => row.potentialExpenseId === id)).toBe(false);
    const undone = undoLedgerConfirm(result.household, result.undo).household;
    expect(undone.potentialExpenses.find((row) => row.id === id)?.status).toBe("planned");
    expect(undone.transactions.some((row) => row.sourceId === id)).toBe(false);
  });

  it("keeps Only-me plans in the owner's Personal envelope and out of partner projections", () => {
    const planned = addPotentialExpense(catalogHousehold(), { ...baseInput, visibility: "personal" }).household;
    const { shared, personal } = splitForSync(planned, "MEM-001");
    expect(shared.potentialExpenses).toEqual([]);
    expect(personal.potentialExpenses).toHaveLength(1);
    expect(householdForView(planned, "MEM-002", "personal").potentialExpenses).toEqual([]);
    expect(householdForView(planned, "MEM-001", "personal").potentialExpenses).toHaveLength(1);
    expect(householdForView(planned, "MEM-001", "household").potentialExpenses).toEqual([]);
    expect(() => removePotentialExpense(planned, { id: planned.potentialExpenses[0]!.id, createdBy: "MEM-002" })).toThrow(/only the owner/i);
    const posted = postPotentialExpense(planned, { id: planned.potentialExpenses[0]!.id, createdBy: "MEM-001" });
    expect(posted).toMatchObject({ persistenceScope: "member-personal", personalMemberId: "MEM-001" });
  });

  it("round-trips Shared and Both plans while shaping legacy snapshots to an empty collection", () => {
    const legacy: Partial<ReturnType<typeof catalogHousehold>> = catalogHousehold();
    delete legacy.potentialExpenses;
    expect(ensureHouseholdShape(legacy as ReturnType<typeof catalogHousehold>).potentialExpenses).toEqual([]);
    let household = addPotentialExpense(catalogHousehold(), baseInput).household;
    household = addPotentialExpense(household, { ...baseInput, title: "Both desks", visibility: "both" }).household;
    const envelopes = splitForSync(household, "MEM-001");
    expect(envelopes.shared.potentialExpenses?.map((row) => row.visibility).sort()).toEqual(["both", "household"]);
    expect(envelopes.personal.potentialExpenses).toEqual([]);
    expect(assembleHousehold(envelopes.shared, envelopes.personal).potentialExpenses).toHaveLength(2);
  });

  it("keeps a dismissed Personal nudge private and makes a moved date eligible again", () => {
    let household = addPotentialExpense(catalogHousehold(), { ...baseInput, date: "2026-09-01", visibility: "personal" }).household;
    const id = household.potentialExpenses[0]!.id;
    expect(composeNotices(householdForView(household, "MEM-001", "personal"), "2026-09-10").some((row) => row.potentialExpenseId === id)).toBe(true);
    household = dismissPotentialExpenseNotice(household, { id, date: "2026-09-01", createdBy: "MEM-001" }).household;
    expect(composeNotices(householdForView(household, "MEM-001", "personal"), "2026-09-10").some((row) => row.potentialExpenseId === id)).toBe(false);
    expect(splitForSync(household, "MEM-001").shared.potentialExpenses).toEqual([]);
    household = movePotentialExpense(household, { id, date: "2026-09-02", createdBy: "MEM-001" }).household;
    expect(composeNotices(householdForView(household, "MEM-001", "personal"), "2026-09-10").some((row) => row.potentialExpenseId === id)).toBe(true);
  });

  it("merges a later soft removal so an offline plan cannot reappear", () => {
    const planned = addPotentialExpense(catalogHousehold(), { ...baseInput, visibility: "personal" }).household;
    const id = planned.potentialExpenses[0]!.id;
    const first = splitForSync(planned, "MEM-001").personal;
    const removed = splitForSync(removePotentialExpense(planned, { id, createdBy: "MEM-001" }).household, "MEM-001").personal;
    const merged = mergePersonal(first, removed);
    expect(merged.potentialExpenses?.find((row) => row.id === id)?.status).toBe("removed");
  });
});
