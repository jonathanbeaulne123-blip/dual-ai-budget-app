import { projectedCountable, transactionProjection } from "./budget.ts";
import { isCashLikeKind, isCreditKind, isInvestmentKind, isReceivableKind } from "./accountKinds.ts";
import type { AccountKind, Household, Transaction } from "./types.ts";

export type CashFlowComponent = "operatingInCents" | "operatingOutCents" | "cardSpendCents" | "debtPaydownCents" | "investingInCents" | "investingOutCents";
export type CashFlowClass = CashFlowComponent | "other-transfer";
export type CashFlowRow = Readonly<{
  transactionId: string; rootId: string; date: string; component: CashFlowClass;
  amountCents: number; title: string; accountId: string;
  source: Transaction["source"]; sourceId: string | null;
}>;

/** The existing statement's account-kind classification, shared with scheduled readings. */
export function cashFlowClass(type: Transaction["type"], account: AccountKind, destination?: AccountKind): CashFlowClass | null {
  if (type === "income") return isCashLikeKind(account) ? "operatingInCents" : null;
  if (type === "expense") return isCashLikeKind(account) ? "operatingOutCents" : isCreditKind(account) ? "cardSpendCents" : null;
  if (type === "refund") return isCashLikeKind(account) ? "operatingInCents" : isCreditKind(account) ? "cardSpendCents" : null;
  if (type !== "transfer" || !destination) return null;
  if (isCashLikeKind(account) && isCreditKind(destination)) return "debtPaydownCents";
  if (isCashLikeKind(account) && isInvestmentKind(destination)) return "investingOutCents";
  if (isInvestmentKind(account) && isCashLikeKind(destination)) return "investingInCents";
  if (isReceivableKind(account) && isCashLikeKind(destination)) return "operatingInCents";
  if (isCashLikeKind(account) && isReceivableKind(destination)) return "operatingOutCents";
  return "other-transfer";
}
export function isOutgoingCash(component: CashFlowClass | null): boolean {
  return component === "operatingOutCents" || component === "debtPaydownCents" || component === "investingOutCents";
}

/** Dated decomposition of cashFlowStatement, preserving full-map reversal and pair rules. */
export function cashFlowRows(household: Household, fromDate: string, throughDate: string): CashFlowRow[] {
  const byId = new Map(household.accounts.map(account => [account.id, account]));
  const transactionById = new Map(household.transactions.map(tx => [tx.id, tx]));
  const seen = new Set<string>(), rows: CashFlowRow[] = [];
  for (const tx of household.transactions) {
    if (!projectedCountable(tx, transactionById) || tx.date < fromDate || tx.date > throughDate) continue;
    const { root, multiplier } = transactionProjection(tx, transactionById);
    const account = byId.get(root.accountId);
    if (!account) continue;
    let from = account, destination;
    if (root.type === "transfer") {
      const pairId = tx.transferPairId || tx.id;
      if (seen.has(pairId) || seen.has(tx.id)) continue;
      seen.add(tx.id);
      if (tx.transferPairId) seen.add(tx.transferPairId);
      const transferFrom = byId.get(root.transferFromAccountId || root.accountId);
      destination = byId.get(root.transferToAccountId || "");
      if (!transferFrom || !destination) continue;
      from = transferFrom;
    }
    const component = cashFlowClass(root.type, from.kind, destination?.kind);
    const sign = root.type === "refund" && component === "cardSpendCents" ? -1 : 1;
    if (component) rows.push({
      transactionId: tx.id, rootId: root.id, date: tx.date, component,
      amountCents: root.amountCents * multiplier * sign,
      title: root.note || household.categories.find(c => c.id === root.subcategoryId)?.name || account.name,
      accountId: root.accountId, source: root.source, sourceId: root.sourceId ?? null,
    });
  }
  return rows;
}

/** Signed change to cash; non-cash card activity and other transfers are context only. */
export function cashFlowDelta(row: Pick<CashFlowRow, "component" | "amountCents">): number {
  if (isOutgoingCash(row.component)) return -row.amountCents;
  if (row.component === "operatingInCents" || row.component === "investingInCents") return row.amountCents;
  return 0;
}
