import type { Transaction, TransactionType } from "./types.ts";
import type { DateKey } from "./calendar.ts";

export function normalizeNote(note: string): string {
  return note.trim().toLowerCase().replace(/\s+/g, " ");
}

export function duplicateKey(input: {
  date: DateKey;
  amountCents: number;
  accountId: string;
  type: TransactionType;
  note: string;
}): string {
  const amount = (input.amountCents / 100).toFixed(2);
  return `${input.date.replace(/-/g, "")}|${amount}|${input.accountId}|${input.type}|${normalizeNote(input.note)}`.toLowerCase();
}

export function calcPotentialDuplicateFlags(keys: string[]): {
  flags: boolean[];
  duplicateKeyCount: number;
  duplicateRowCount: number;
} {
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let duplicateKeyCount = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicateKeyCount += 1;
  }
  const flags = keys.map((key) => Boolean(key) && (counts.get(key) ?? 0) > 1);
  return {
    flags,
    duplicateKeyCount,
    duplicateRowCount: flags.filter(Boolean).length,
  };
}

export function refreshDuplicateFlags(transactions: Transaction[]): Transaction[] {
  const result = calcPotentialDuplicateFlags(transactions.map((tx) => tx.duplicateKey));
  return transactions.map((tx, index) => ({
    ...tx,
    potentialDuplicate: result.flags[index] ?? false,
  }));
}

export function findDuplicateMatches(transactions: Transaction[], key: string, exceptId?: string): Transaction[] {
  if (!key) return [];
  return transactions.filter((tx) => tx.duplicateKey === key && tx.id !== exceptId);
}
