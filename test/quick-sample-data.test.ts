import { describe, it, expect } from "vitest";
import { addAccount, catalogHousehold, postEntry, splitForSync, assertAcceptableBooks } from "../src/core/index.ts";
import { addQuickSampleData, previewQuickSampleData, type QuickSampleInput } from "../src/core/quickSampleData.ts";
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
