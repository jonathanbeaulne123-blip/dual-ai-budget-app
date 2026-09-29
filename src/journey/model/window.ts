/**
 * The board's window and the one shared read context every part of the derivation uses. Everything is read ONCE
 * per derivation and only for months inside the window (a month outside it is never computed):
 * - the Calendar's own pipeline per month (`calendarPresentation` → `buildMonthBoard` → `calendarWeight`);
 * - the day ledger (`dayLedger`) for last / this / next month — one call; each call also reads the Fund horizon,
 *   so twelve calls would cost the board ~250 ms on the demo household (PLAN R7);
 * - the other window months' days from the same Calendar rows, read the way the day ledger reads them
 *   (`calendarDays`, held equal to `dayLedger` by test);
 * - the recognised posted roots (the Calendar's own "posted" recognition).
 */
import { buildMonthBoard, isOutgoingBill } from "../../core/board.ts";
import { projectedCountable, transactionProjection } from "../../core/budget.ts";
import { addDays, monthEndKey, monthKeyFromDateKey, monthStartKey, shiftMonthKey, weekdaySunday0, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { calendarWeight, type WeightDay, type WeightItem } from "../../core/calendarWeight.ts";
import { cashFlowDelta } from "../../core/cashFlowRows.ts";
import { calendarPresentation } from "../../core/ledgerExperience.ts";
import type { Household, Transaction } from "../../core/types.ts";
import { paydayTicks } from "../../core/monthSpread.ts";
import { dayLedger, readSitdownWeekday, type LedgerDay } from "../../harbour/glass/dayLedger.ts";
import type { DeriveJourneyBoardOptions } from "../contracts.ts";

export const DEFAULT_PAST_MONTHS = 8;
export const DEFAULT_AHEAD_MONTHS = 3;
/** One lap of the island: one chapter per station. */
export const MAX_WINDOW_MONTHS = 12;

/** The window's months, oldest first: `past` before today's month, today's month, `ahead` after (≤ 12 in all). */
export function windowMonths(today: DateKey, options: DeriveJourneyBoardOptions = {}): MonthKey[] {
  const clamp = (value: number | undefined, fallback: number) => Number.isInteger(value) && value! >= 0 ? value! : fallback;
  let ahead = Math.min(clamp(options.aheadMonths, DEFAULT_AHEAD_MONTHS), MAX_WINDOW_MONTHS - 1);
  let past = clamp(options.pastMonths, DEFAULT_PAST_MONTHS);
  if (past + 1 + ahead > MAX_WINDOW_MONTHS) past = MAX_WINDOW_MONTHS - 1 - ahead;
  ahead = Math.max(0, ahead);
  const current = monthKeyFromDateKey(today);
  const months: MonthKey[] = [];
  for (let offset = -past; offset <= ahead; offset += 1) months.push(shiftMonthKey(current, offset));
  return months;
}

/**
 * The months the day ledger reads directly: last month, this month and next (the camp card's strip range is a
 * slice of it). ≤ 3 months, ≤ 92 days: inside the day ledger's 93-day limit.
 */
export function ledgerMonths(months: readonly MonthKey[], current: MonthKey): MonthKey[] {
  return months.filter(month => month >= shiftMonthKey(current, -1) && month <= shiftMonthKey(current, 1));
}

export type RecognisedRoot = { tx: Transaction; date: DateKey };

export type DeriveContext = {
  household: Household;
  memberId: string;
  today: DateKey;
  current: MonthKey;
  months: MonthKey[];
  monthSet: Set<MonthKey>;
  from: DateKey;
  to: DateKey;
  activeMemberIds: string[];
  viewerActive: boolean;
  /** The Calendar's scoped household (`calendarPresentation`, household view), or null for an inactive viewer. */
  presented: Household | null;
  /**
   * One read per civil day, window only: the day ledger's own days for last / this / next month, and for the other
   * window months the same Calendar pipeline the day ledger reads (`calendarDays`, parity-tested against it).
   */
  days: Map<DateKey, LedgerDay>;
  /** The Charter's weekly Sitdown weekday (shared space), when it has one. */
  sitdownWeekday: number | null;
  /** The Calendar's own weight rows, by board item id + date (window only). */
  weight: Map<string, WeightItem & { date: DateKey }>;
  /** Posted expense/income roots whose projection is still live (the same recognition `calendarWeight` uses). */
  recognised: RecognisedRoot[];
};

export const weightKey = (itemId: string, date: DateKey) => `${itemId}|${date}`;

export function readContext(household: Household, memberId: string, today: DateKey, options?: DeriveJourneyBoardOptions): DeriveContext {
  const months = windowMonths(today, options);
  const current = monthKeyFromDateKey(today);
  const from = monthStartKey(months[0]!), to = monthEndKey(months.at(-1)!);
  const activeMemberIds = household.members.filter(member => member.active).map(member => member.id);
  const viewerActive = activeMemberIds.includes(memberId);
  let presented: Household | null = null;
  if (viewerActive) { try { presented = calendarPresentation(household, memberId, "household"); } catch { presented = null; } }

  const weight = new Map<string, WeightItem & { date: DateKey }>();
  const weightByMonth = new Map<MonthKey, WeightDay[]>();
  if (presented) {
    for (const month of months) {
      let rows: WeightDay[];
      try { rows = calendarWeight(presented, buildMonthBoard(presented, month, today), today); } catch { continue; }
      weightByMonth.set(month, rows);
      for (const day of rows) for (const row of day.scheduled) weight.set(weightKey(row.item.id, day.date), { ...row, date: day.date });
    }
  }

  const days = new Map<DateKey, LedgerDay>();
  const sitdownWeekday = viewerActive ? readSitdownWeekday(household) : null;
  const direct = viewerActive ? ledgerMonths(months, current) : [];
  const pots = new Map<string, "prepare" | "build">();
  for (const recurrence of household.recurrences) if (recurrence.goalId) pots.set(recurrence.id, "build");
  if (direct.length) {
    try {
      const ledger = dayLedger({ household, memberId, space: "ours", today, from: monthStartKey(direct[0]!), to: monthEndKey(direct.at(-1)!) });
      for (const day of ledger.days) {
        days.set(day.date, day);
        for (const slip of day.slips) if (slip.recurrenceId && slip.pot) pots.set(slip.recurrenceId, slip.pot);
      }
    } catch { /* the ledger cannot say; the Calendar's pipeline below still can */ }
  }
  for (const month of months) {
    if (direct.includes(month) && days.has(monthStartKey(month))) continue;
    for (const day of calendarDays(household, month, today, weightByMonth.get(month) ?? [], pots, sitdownWeekday, viewerActive)) days.set(day.date, day);
  }

  return { household, memberId, today, current, months, monthSet: new Set(months), from, to, activeMemberIds, viewerActive, presented, days, sitdownWeekday, weight, recognised: recognisedRoots(presented, from, to) };
}

/**
 * Posted expense/income roots inside the window whose net projection is still positive: a reversed or corrected
 * entry is not recognised, exactly as `calendarWeight` decides "posted" (`projectedCountable` / `transactionProjection`).
 */
function recognisedRoots(presented: Household | null, from: DateKey, to: DateKey): RecognisedRoot[] {
  if (!presented) return [];
  const byId = new Map(presented.transactions.map(tx => [tx.id, tx]));
  const live = new Map<string, number>();
  for (const tx of presented.transactions) {
    if (tx.date > to || !projectedCountable(tx, byId)) continue;
    const { root, multiplier } = transactionProjection(tx, byId);
    if (root.type === "expense" || root.type === "income") live.set(root.id, (live.get(root.id) ?? 0) + root.amountCents * multiplier);
  }
  const out: RecognisedRoot[] = [];
  for (const [id, amount] of live) {
    const tx = byId.get(id);
    if (!tx || amount <= 0 || tx.date < from || tx.date > to) continue;
    out.push({ tx, date: tx.date });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.tx.id.localeCompare(b.tx.id));
}

/** A board item id without its own trailing `:<date>` (so a one-off keys on its record, not twice on its date). */
export function baseItemId(itemId: string, date: DateKey): string {
  const suffix = `:${date}`;
  return itemId.endsWith(suffix) ? itemId.slice(0, -suffix.length) : itemId;
}

/**
 * A month's days read exactly as the day ledger reads them (`dayLedger` → `monthFacts`): coins are the Calendar's
 * posted rows, slips its still-unposted outgoing bills (`isOutgoingBill`), pennants its scheduled money in plus the
 * Fund custodian's pay ticks (`paydayTicks`) on a day with no other pennant. Used for window months outside the
 * three the day ledger reads directly; `test/journey-board-model.test.ts` holds it equal to `dayLedger`.
 */
export function calendarDays(household: Household, month: MonthKey, today: DateKey, weight: readonly WeightDay[], pots: ReadonlyMap<string, "prepare" | "build">, sitdownWeekday: number | null, active: boolean): LedgerDay[] {
  const byDate = new Map(weight.map(day => [day.date, day]));
  let ticks = new Set<DateKey>();
  if (active && household.householdFund) { try { ticks = new Set(paydayTicks(household, month).map(tick => tick.date)); } catch { ticks = new Set(); } }
  const custodian = household.householdFund?.custodianMemberId ?? null;
  const custodianName = household.members.find(member => member.id === custodian)?.name ?? null;
  const out: LedgerDay[] = [];
  const end = monthEndKey(month);
  for (let date = monthStartKey(month) as DateKey; date <= end; date = addDays(date, 1)) {
    const row = byDate.get(date);
    const coins: LedgerDay["coins"] = [], slips: LedgerDay["slips"] = [], pennants: LedgerDay["pennants"] = [];
    const seen = new Set<string>();
    for (const posted of row?.posted ?? []) {
      if (seen.has(posted.transactionId)) continue;
      seen.add(posted.transactionId);
      const delta = cashFlowDelta(posted);
      coins.push({ id: posted.transactionId, title: posted.title, amountCents: Math.abs(delta) || Math.abs(posted.amountCents), direction: delta < 0 ? "out" : delta > 0 ? "in" : "other" });
    }
    for (const { item } of row?.scheduled ?? []) {
      const amountCents = Number.isFinite(item.amountCents) ? item.amountCents : null;
      if (isOutgoingBill(item)) {
        const recurrenceId = item.recurrenceId ?? null;
        slips.push({ id: item.id, name: item.title, amountCents, recurrenceId, kind: item.kind, pot: recurrenceId ? pots.get(recurrenceId) ?? null : null, overdue: item.date < today });
      } else if (item.direction === "in") {
        pennants.push({ id: item.id, name: item.title, amountCents, memberId: item.memberId ?? null });
      }
    }
    if (ticks.has(date) && pennants.length === 0) pennants.push({ id: `payday:${date}`, name: custodianName ? `${custodianName}’s payday` : "Payday", amountCents: null, memberId: custodian });
    const weekday = weekdaySunday0(date);
    out.push({
      date, day: Number(date.slice(8, 10)), weekday, monthKey: month,
      relation: date < today ? "past" : date === today ? "today" : "future",
      inWeek: date >= today && date <= addDays(today, 6),
      coins, slips, pennants, flagstone: weekday === 0,
      sitdown: sitdownWeekday !== null && weekday === sitdownWeekday,
      gate: null, station: date === end,
    });
  }
  return out;
}
