import type { DateKey } from "./calendar.ts";
import type { InstrumentId } from "./officeLayout.ts";
import type { LedgerView, Transaction } from "./types.ts";

export type HerculesSourceRoute = "home" | "plan" | "calendar" | "ledger" | "more";

/**
 * A number shown by Hercules is clickable only when the books code supplies one
 * of these records. UI code must never infer a source by scanning arbitrary
 * prose for digits or currency symbols.
 */
export type HerculesNumberSource = {
  route: HerculesSourceRoute;
  view: LedgerView;
  label: string;
  surface?: InstrumentId | "window";
  memberId?: string;
  accountId?: string;
  categoryId?: string;
  transactionId?: string;
  journalEntryId?: string;
  transactionTypes?: Transaction["type"][];
  recurrenceId?: string;
  claimId?: string;
  goalId?: string;
  shiftId?: string;
  from?: DateKey;
  to?: DateKey;
};

export type HerculesGroundedFact = {
  id: string;
  label: string;
  value: string;
  source: HerculesNumberSource;
  basis: "journal" | "projection";
};

export function herculesFactId(label: string, value: string, index: number): string {
  return `${index}:${label}:${value}`;
}

/** Applies the structured source contract; arbitrary Hercules prose never filters books. */
export function transactionsForHerculesSource(
  transactions: Transaction[],
  source: HerculesNumberSource | null,
): Transaction[] {
  if (!source || source.route !== "ledger") return transactions;
  return transactions.filter((tx) => {
    if (source.transactionId && tx.id !== source.transactionId) return false;
    if (source.transactionTypes?.length && !source.transactionTypes.includes(tx.type)) return false;
    if (source.accountId && tx.accountId !== source.accountId) return false;
    if (source.categoryId && tx.subcategoryId !== source.categoryId) return false;
    if (source.memberId && tx.createdBy !== source.memberId) return false;
    if (source.from && tx.date < source.from) return false;
    if (source.to && tx.date > source.to) return false;
    return true;
  });
}

export function herculesLedgerSourcePane(source: HerculesNumberSource): "wallet" | "register" {
  const rowInvestigation = Boolean(
    source.transactionId
    || source.categoryId
    || source.memberId
    || source.from
    || (source.to && !source.accountId),
  );
  return rowInvestigation ? "register" : "wallet";
}
