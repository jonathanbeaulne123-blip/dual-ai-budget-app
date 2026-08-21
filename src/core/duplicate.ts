import type { Transaction, TransactionType } from "./types.ts";
import { calendarDaysBetween, type DateKey } from "./calendar.ts";

export const SIMILARITY_WINDOW_DAYS = 5;

const STOPWORDS = new Set(["a", "an", "the", "and", "or", "of", "at", "to", "for", "in", "on", "with", "from"]);

export function normalizeNote(note: string): string {
  return note.trim().toLowerCase().replace(/\s+/g, " ");
}

export function duplicateKey(input: {
  date: DateKey;
  amountCents: number;
  accountId: string;
  type: TransactionType;
  note: string;
  place?: string;
}): string {
  const amount = (input.amountCents / 100).toFixed(2);
  return [
    input.date.replace(/-/g, ""),
    amount,
    input.accountId,
    input.type,
    normalizeNote(input.note),
    normalizeNote(input.place ?? ""),
  ].join("|").toLowerCase();
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

export type SimilarityMatch = {
  transaction: Transaction;
  score: number;
  reasons: string[];
};

export function contextTokens(...parts: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const part of parts) {
    for (const token of normalizeNote(part).split(/[^a-z0-9]+/)) {
      if (token.length < 3 || STOPWORDS.has(token)) continue;
      tokens.add(token);
    }
  }
  return tokens;
}

function notesRelated(left: string, right: string): boolean {
  const a = normalizeNote(left);
  const b = normalizeNote(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const leftTokens = contextTokens(a);
  const rightTokens = contextTokens(b);
  for (const token of leftTokens) {
    if (rightTokens.has(token)) return true;
  }
  return false;
}

export function scoreSimilarity(candidate: {
  date: DateKey;
  amountCents: number;
  accountId: string;
  type: TransactionType;
  note: string;
  place?: string;
  subcategoryId?: string | null;
  source?: string;
  sourceId?: string;
}, existing: Transaction): SimilarityMatch | null {
  if (existing.type !== candidate.type) return null;
  if (existing.amountCents !== candidate.amountCents) return null;
  const days = calendarDaysBetween(existing.date, candidate.date);
  if (Math.abs(days) > SIMILARITY_WINDOW_DAYS) return null;

  const reasons: string[] = [];
  let score = 1;
  const when = days === 0
    ? "same day"
    : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ${days > 0 ? "later" : "earlier"}`;
  reasons.push(`same ${formatDollars(candidate.amountCents)}, ${when}`);

  if (notesRelated(candidate.note, existing.note)) {
    score += 4;
    reasons.push("matching notes");
  }
  if (notesRelated(candidate.place ?? "", existing.place ?? "")) {
    score += 4;
    reasons.push("matching place");
  }
  if (candidate.subcategoryId && existing.subcategoryId && candidate.subcategoryId === existing.subcategoryId) {
    score += 2;
    reasons.push("same category");
  }
  if (candidate.accountId === existing.accountId) {
    score += 1;
    reasons.push("same account");
  }
  if (candidate.sourceId && existing.sourceId && candidate.sourceId === existing.sourceId) {
    score += 3;
    reasons.push("same source");
  } else if (candidate.source && existing.source && candidate.source === existing.source) {
    score += 1;
  }

  const hasContext = reasons.includes("matching notes")
    || reasons.includes("matching place")
    || reasons.includes("same category")
    || reasons.includes("same source");
  if (!hasContext) return null;
  return { transaction: existing, score, reasons };
}

function formatDollars(amountCents: number): string {
  return `$${(Math.abs(amountCents) / 100).toFixed(2)}`;
}

export function findSimilarTransactions(
  transactions: Transaction[],
  candidate: Parameters<typeof scoreSimilarity>[0],
  exceptId?: string,
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = [];
  for (const transaction of transactions) {
    if (transaction.id && transaction.id === exceptId) continue;
    const match = scoreSimilarity(candidate, transaction);
    if (match) matches.push(match);
  }
  return matches.sort((left, right) => right.score - left.score);
}

export function refreshDuplicateFlags(transactions: Transaction[]): Transaction[] {
  const flags = transactions.map(() => false);
  const buckets = new Map<string, number[]>();
  transactions.forEach((transaction, index) => {
    const bucket = `${transaction.type}|${transaction.amountCents}`;
    const list = buckets.get(bucket) ?? [];
    list.push(index);
    buckets.set(bucket, list);
  });
  for (const indexes of buckets.values()) {
    for (let i = 0; i < indexes.length; i += 1) {
      const leftIndex = indexes[i]!;
      const left = transactions[leftIndex]!;
      for (let j = i + 1; j < indexes.length; j += 1) {
        const rightIndex = indexes[j]!;
        const right = transactions[rightIndex]!;
        if (scoreSimilarity(left, right) || scoreSimilarity(right, left)) {
          flags[leftIndex] = true;
          flags[rightIndex] = true;
        }
      }
    }
  }
  return transactions.map((transaction, index) => ({
    ...transaction,
    potentialDuplicate: flags[index] ?? false,
  }));
}

export function findDuplicateMatches(transactions: Transaction[], key: string, exceptId?: string): Transaction[] {
  if (!key) return [];
  return transactions.filter((tx) => tx.duplicateKey === key && tx.id !== exceptId);
}

export function describeSimilarMatches(matches: SimilarityMatch[]): string {
  if (!matches.length) return "";
  const top = matches[0]!;
  const extra = matches.length > 1 ? ` and ${matches.length - 1} more` : "";
  return `This looks like ${top.transaction.note || top.transaction.type} on ${top.transaction.date} (${top.reasons.join("; ")})${extra}. Add anyway?`;
}
