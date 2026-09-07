import { describe, expect, it } from "vitest";
import { syncScaleFixture } from "./fixtures/syncScaleFixture.ts";
import { assertAcceptableBooks } from "../src/core/commandRuntime.ts";

describe("sync scale fixture", () => {
  it("builds 5,056 balanced Development transactions with independent linked copies in under 2 seconds", () => {
    const started = performance.now();
    const household = syncScaleFixture();
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(household.environment).toBe("development");
    expect(household.transactions).toHaveLength(5_056);
    const ids = new Set(household.transactions.map(row => row.id));
    expect(ids.size).toBe(5_056);
    for (const row of household.transactions) {
      for (const ref of [row.transferPairId, row.reversalOfId, row.refundOfId]) {
        if (ref) {
          expect(ids.has(ref)).toBe(true);
          expect(ref.match(/-c\d+$/)?.[0]).toBe(row.id.match(/-c\d+$/)?.[0]);
        }
      }
    }
    for (const shift of household.shifts) {
      for (const ref of [shift.wagesTransactionId, shift.tipsTransactionId, shift.cashTipsTransactionId, shift.cardTipsTransactionId, shift.paidBreakTransactionId, ...(shift.transactionIds ?? []), ...(shift.tipOutTransactionIds ?? [])]) {
        if (ref) expect(ids.has(ref)).toBe(true);
      }
    }
    const books = assertAcceptableBooks(household);
    expect(books.entries).toHaveLength(4_608);
  });
});
