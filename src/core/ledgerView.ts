import type { Household, Transaction } from "./types.ts";

export type LedgerSection = "income" | "expenses" | "other";

export function ledgerSection(transaction: Transaction): LedgerSection {
  if (transaction.type === "income") return "income";
  if (transaction.type === "expense") return "expenses";
  return "other";
}

export function partitionLedger(transactions: Transaction[]): Record<LedgerSection, Transaction[]> {
  const grouped: Record<LedgerSection, Transaction[]> = { income: [], expenses: [], other: [] };
  const sorted = [...transactions].sort((left, right) => {
    if (left.date === right.date) return right.createdAt.localeCompare(left.createdAt);
    return right.date.localeCompare(left.date);
  });
  for (const transaction of sorted) {
    grouped[ledgerSection(transaction)].push(transaction);
  }
  return grouped;
}

export function categoryName(household: Household, subcategoryId: string | null): string {
  if (!subcategoryId) return transactionTypeLabel("transfer");
  return household.categories.find((category) => category.id === subcategoryId)?.name ?? subcategoryId;
}

export function accountName(household: Household, accountId: string): string {
  return household.accounts.find((account) => account.id === accountId)?.name ?? accountId;
}

export function partyName(household: Household, party: string): string {
  if (party === "joint") return "Joint";
  return household.members.find((member) => member.id === party)?.name ?? party;
}

export function transactionTypeLabel(type: Transaction["type"]): string {
  if (type === "expense") return "Expense";
  if (type === "income") return "Income";
  if (type === "refund") return "Refund";
  return "Transfer";
}

export function splitSummary(household: Household, transaction: Transaction): string {
  return transaction.splits
    .map((split) => `${partyName(household, split.party)} ${((split.amountCents / transaction.amountCents) * 100 || 0).toFixed(0)}%`)
    .join(" · ");
}
