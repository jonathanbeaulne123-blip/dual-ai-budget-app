import { describe, expect, it } from "vitest";
import { addGoal, assembleHousehold, reversePostedMoney, bookBalanceAsOf, catalogHousehold, compileHousehold, contributeToGoal, fundGoal, postEntry, postTransfer, purchaseGoal, splitForSync, trialBalance, vaultSpendableCents } from "../src/core/index.ts";
const today = "2026-09-08", owner = "MEM-001";
function fixture() {
  let h = catalogHousehold();
  const source = h.accounts.find(a => a.id === "ACC-CHEQUING")!;
  h = { ...h, accounts: [...h.accounts, { ...source, id: "OWN-CASH", name: "Own cash", scope: "personal", ownerMemberId: owner }] };
  h = postEntry(h, { date: today, amount: 1000, type: "income", accountId: "ACC-GOALS", subcategoryId: "SUB-INCOME-WAGES", confirmDuplicate: true }).household;
  h = postEntry(h, { date: today, amount: 200, type: "income", accountId: "OWN-CASH", subcategoryId: "SUB-INCOME-WAGES", visibility: "personal", createdBy: owner, confirmDuplicate: true }).household;
  h = addGoal(h, { name: "PRIVATE GOAL CANARY", target: 100, shared: false, ownerMemberId: owner }).household;
  return h;
}
describe("goal funding privacy boundary", () => {
  it("refuses private goal funding from Shared cash instead of placing its name in Shared notes", () => {
    const h = fixture();
    expect(() => fundGoal(h, { goalId: h.goals[0]!.id, amount: 100, fromAccountId: "ACC-CHEQUING", createdBy: owner, date: today })).toThrow();
  });
  it("funds an owned private goal from own Personal cash and keeps the entire receipt private", () => {
    const h = fixture();
    const funded = fundGoal(h, { goalId: h.goals[0]!.id, amount: 100, fromAccountId: "OWN-CASH", createdBy: owner, visibility: "personal", date: today }).household;
    const { shared, personal } = splitForSync(funded, owner);
    expect(JSON.stringify(shared)).not.toContain("PRIVATE GOAL CANARY");
    expect(personal.transactions.filter(tx => tx.type === "transfer")).toHaveLength(2);
    expect(bookBalanceAsOf(funded, "OWN-CASH", today)).toBe(10000);
    expect(trialBalance(compileHousehold(funded)).inBalance).toBe(true);
  });
  it("cannot buy a private100 goal with Shared1000 of unallocated vault cash", () => {
    const h = fixture();
    // Compose the intended private funding through already-supported primitive commands.
    const moved = postTransfer(h, { date: today, amount: 100, fromAccountId: "OWN-CASH", toAccountId: "ACC-GOALS", visibility: "personal", createdBy: owner, confirmDuplicate: true });
    const funded = contributeToGoal(moved.household, h.goals[0]!.id, 100, { date: today, createdBy: owner, transferId: moved.postedIds[0], markFunded: true }).household;
    expect(vaultSpendableCents(funded, h.goals[0]!.id, today)).toBe(10000);
    expect(() => purchaseGoal(funded, { goalId: h.goals[0]!.id, amount: 1000, createdBy: owner, visibility: "personal", date: today })).toThrow();
  });
});

describe("goal vault correction and privacy partitions", () => {
  function funded() {
    const h = fixture();
    return fundGoal(h, { goalId: h.goals[0]!.id, amount: 100, fromAccountId: "OWN-CASH", createdBy: owner, date: today });
  }
  it("purchases privately and survives split and reassembly without moving Shared cash", () => {
    const h = funded().household, id = h.goals[0]!.id;
    const split = splitForSync(h, owner);
    const assembled = assembleHousehold(split.shared, split.personal);
    expect(vaultSpendableCents(assembled, id, today)).toBe(10000);
    const bought = purchaseGoal(assembled, { goalId: id, amount: 100, createdBy: owner, date: today }).household;
    const after = splitForSync(bought, owner);
    expect(JSON.stringify(after.shared)).not.toContain("PRIVATE GOAL CANARY");
    expect(after.personal.goalPurchases).toHaveLength(1);
    expect(after.personal.transactions.filter(tx => tx.type === "expense")).toHaveLength(1);
    expect(bookBalanceAsOf(assembleHousehold(after.shared, null), "ACC-GOALS", today)).toBe(100000);
    expect(trialBalance(compileHousehold(bought)).inBalance).toBe(true);
  });
  it("Shared goals cannot spend private cash and other private claims reserve only private cash", () => {
    let h = funded().household;
    h = addGoal(h, { name: "Shared example", target: 100, shared: true }).household;
    const sharedId = h.goals.find(goal => goal.shared)!.id;
    h = contributeToGoal(h, sharedId, 100, { markFunded: true, createdBy: owner, date: today }).household;
    expect(vaultSpendableCents(h, sharedId, today)).toBe(100000);
    expect(() => purchaseGoal(h, { goalId: sharedId, amount: 1050, createdBy: owner, date: today })).toThrow();
    h = addGoal(h, { name: "Another private", target: 50, shared: false, ownerMemberId: owner }).household;
    h = contributeToGoal(h, h.goals.at(-1)!.id, 50, { createdBy: owner, date: today }).household;
    expect(vaultSpendableCents(h, h.goals[0]!.id, today)).toBe(5000);
    expect(vaultSpendableCents(h, sharedId, today)).toBe(100000);
  });
  it("uses canonical reversal and reinstatement cash without rewriting recorded progress", () => {
    const f = funded(), id = f.household.goals[0]!.id;
    const reversed = reversePostedMoney(f.household, f.postedIds.find(id => id.startsWith("TXN"))!, { createdBy: owner, visibility: "personal", reversalDate: today });
    expect(vaultSpendableCents(reversed.household, id, today)).toBe(0);
    expect(reversed.household.goals[0]!.savedCents).toBe(10000);
    const restored = reversePostedMoney(reversed.household, reversed.postedIds[0]!, { createdBy: owner, visibility: "personal", reversalDate: today });
    expect(vaultSpendableCents(restored.household, id, today)).toBe(10000);
  });
  it("refuses both directions of cross-scope correction before filtering the books", () => {
    const f = funded(), id = f.household.goals[0]!.id;
    const sharedExpense = postEntry(f.household, { date: today, amount: 300, type: "expense", accountId: "ACC-GOALS", subcategoryId: "SUB-LIFE-FUN", createdBy: owner, confirmDuplicate: true });
    const cross = reversePostedMoney(sharedExpense.household, sharedExpense.postedIds[0]!, { createdBy: owner, visibility: "personal", reversalDate: today }).household;
    expect(vaultSpendableCents(cross, id, today)).toBe(0);
    expect(() => purchaseGoal(cross, { goalId: id, amount: 100, createdBy: owner, date: today })).toThrow(/cross-scope/);
  });
  it("refuses incomplete, mixed and duplicate-inconsistent pairs", () => {
    const f = funded(), id = f.household.goals[0]!.id;
    const pair = f.household.transactions.find(tx => tx.type === "transfer")!;
    for (const mutate of [
      (h: typeof f.household) => { h.transactions = h.transactions.filter(tx => tx.id !== pair.transferPairId); },
      (h: typeof f.household) => { h.transactions.find(tx => tx.id === pair.transferPairId)!.visibility = "household"; },
      (h: typeof f.household) => { h.transactions.find(tx => tx.id === pair.transferPairId)!.isDuplicate = true; },
    ]) {
      const h = structuredClone(f.household); mutate(h);
      expect(vaultSpendableCents(h, id, today)).toBe(0);
      expect(() => purchaseGoal(h, { goalId: id, amount: 100, createdBy: owner, date: today })).toThrow();
    }
  });
  it("rejects another owner's private goal and private cash funding a Shared goal", () => {
    const f = funded(), id = f.household.goals[0]!.id;
    expect(() => purchaseGoal(f.household, { goalId: id, amount: 100, createdBy: "MEM-002", date: today })).toThrow(/owner/);
    expect(() => fundGoal(f.household, { goalId: id, amount: 1, fromAccountId: "OWN-CASH", createdBy: "MEM-002", date: today })).toThrow(/owner/);
    const h = addGoal(f.household, { name: "Shared", shared: true, target: 100 }).household;
    expect(() => fundGoal(h, { goalId: h.goals.at(-1)!.id, amount: 1, fromAccountId: "OWN-CASH", createdBy: owner, date: today })).toThrow(/Shared cash/);
  });
});
