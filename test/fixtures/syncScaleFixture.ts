import { seedDemoHousehold } from "../../src/core/seed.ts";
import type { Household } from "../../src/core/types.ts";

/** Synthetic Development fixture: 158 demo transactions duplicated into 32 independent copies. */
export function syncScaleFixture(): Household {
  const base = seedDemoHousehold({ today: "2026-08-21" });
  if (base.transactions.length !== 158) throw new Error(`Demo fixture drift: expected 158 transactions, got ${base.transactions.length}`);
  const transactionIds = new Set(base.transactions.map(row => row.id));
  const shiftIds = new Set(base.shifts.map(row => row.id));
  const household = structuredClone(base);
  household.transactions = [];
  household.shifts = [];
  for (let k = 0; k < 32; k += 1) {
    const suffix = (id: string) => `${id}-c${k}`;
    const transactionRef = (id: string | undefined) => id && transactionIds.has(id) ? suffix(id) : id;
    for (const original of base.transactions) {
      const row = structuredClone(original);
      row.id = suffix(row.id);
      row.transferPairId = transactionRef(row.transferPairId);
      row.reversalOfId = transactionRef(row.reversalOfId);
      row.refundOfId = transactionRef(row.refundOfId);
      if (row.sourceId && (transactionIds.has(row.sourceId) || shiftIds.has(row.sourceId))) row.sourceId = suffix(row.sourceId);
      household.transactions.push(row);
    }
    for (const original of base.shifts) {
      const row = structuredClone(original);
      row.id = suffix(row.id);
      row.wagesTransactionId = transactionRef(row.wagesTransactionId)!;
      row.tipsTransactionId = transactionRef(row.tipsTransactionId)!;
      row.cashTipsTransactionId = transactionRef(row.cashTipsTransactionId);
      row.cardTipsTransactionId = transactionRef(row.cardTipsTransactionId);
      row.paidBreakTransactionId = transactionRef(row.paidBreakTransactionId);
      row.transactionIds = row.transactionIds?.map(id => transactionRef(id)!);
      row.tipOutTransactionIds = row.tipOutTransactionIds?.map(id => transactionRef(id)!);
      household.shifts.push(row);
    }
  }
  return household;
}
