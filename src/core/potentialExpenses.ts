import { isValidDateKey, type DateKey } from "./calendar.ts";
import { parseVisibility, isVisibleInView } from "./visibility.ts";
import type { LedgerView, PotentialExpenseCalendarLink, PotentialExpensePlan, Split } from "./types.ts";

export const POTENTIAL_EXPENSE_TITLE_LIMIT = 120;

const CALENDAR_LINK_SOURCES = new Set<PotentialExpenseCalendarLink["source"]>([
  "recurrence", "rhythm", "shift", "shift-envelope", "google", "appointment", "claim", "work-settlement",
]);

export function shapePotentialExpenseCalendarLink(value: unknown): PotentialExpenseCalendarLink | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<PotentialExpenseCalendarLink>;
  if (!row.source || !CALENDAR_LINK_SOURCES.has(row.source) || typeof row.id !== "string" || !row.id.trim()) return null;
  if (typeof row.title !== "string" || !row.title.trim()) return null;
  return { source: row.source, id: row.id.trim(), title: row.title.trim().slice(0, POTENTIAL_EXPENSE_TITLE_LIMIT) };
}

export function resizePotentialExpenseSplits(existing: Split[], oldAmountCents: number, amountCents: number): Split[] {
  if (oldAmountCents === amountCents) return existing;
  let assigned = 0;
  return existing.map((split, index) => {
    const next = index === existing.length - 1
      ? amountCents - assigned
      : Math.round(amountCents * split.amountCents / oldAmountCents);
    assigned += next;
    return { ...split, amountCents: next };
  });
}

function validIso(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : fallback;
}

export function shapePotentialExpenses(
  input: PotentialExpensePlan[] | undefined,
  fallbackIso: string,
): PotentialExpensePlan[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((row) => {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id) return [];
    if (!isValidDateKey(row.date) || !Number.isInteger(row.expectedAmountCents) || row.expectedAmountCents <= 0) return [];
    if (typeof row.accountId !== "string" || !row.accountId || typeof row.subcategoryId !== "string" || !row.subcategoryId) return [];
    if (typeof row.createdBy !== "string" || !row.createdBy) return [];
    const createdAt = validIso(row.createdAt, fallbackIso);
    const updatedAt = validIso(row.updatedAt, createdAt);
    const status = row.status === "posted" || row.status === "removed" ? row.status : "planned";
    return [{
      id: row.id,
      date: row.date,
      title: String(row.title ?? "").trim().slice(0, POTENTIAL_EXPENSE_TITLE_LIMIT) || "Potential expense",
      expectedAmountCents: row.expectedAmountCents,
      accountId: row.accountId,
      subcategoryId: row.subcategoryId,
      splits: Array.isArray(row.splits) ? row.splits : [],
      linkedCalendarItem: shapePotentialExpenseCalendarLink(row.linkedCalendarItem),
      visibility: parseVisibility(row.visibility),
      createdBy: row.createdBy,
      status,
      transactionId: status === "posted" && typeof row.transactionId === "string" ? row.transactionId : null,
      postedAt: status === "posted" ? validIso(row.postedAt, updatedAt) : null,
      removedAt: status === "removed" ? validIso(row.removedAt, updatedAt) : null,
      dismissedNoticeDate: typeof row.dismissedNoticeDate === "string" && isValidDateKey(row.dismissedNoticeDate) ? row.dismissedNoticeDate : null,
      createdAt,
      updatedAt,
    }];
  });
}

export function mergePotentialExpenses(
  left: PotentialExpensePlan[] | undefined,
  right: PotentialExpensePlan[] | undefined,
  fallbackIso: string,
): PotentialExpensePlan[] {
  const merged = new Map<string, PotentialExpensePlan>();
  for (const row of [...shapePotentialExpenses(left, fallbackIso), ...shapePotentialExpenses(right, fallbackIso)]) {
    const current = merged.get(row.id);
    if (!current || row.updatedAt >= current.updatedAt) merged.set(row.id, row);
  }
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function potentialExpensesForView(
  rows: PotentialExpensePlan[] | undefined,
  memberId: string,
  view: LedgerView,
): PotentialExpensePlan[] {
  return (rows ?? []).filter((row) => isVisibleInView(row, memberId, view));
}

export function duePotentialExpenses(
  rows: PotentialExpensePlan[] | undefined,
  today: DateKey,
): PotentialExpensePlan[] {
  return (rows ?? [])
    .filter((row) => row.status === "planned" && row.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
