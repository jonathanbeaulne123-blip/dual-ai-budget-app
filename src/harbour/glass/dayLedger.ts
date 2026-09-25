/**
 * The day ledger (Tool Atlas §3.5, §4.1; CONTRACT rule 19): one pure read of
 * what each civil day holds, for the strip band, the camp card's "Leaving
 * next" line and the Calendar sheet. It is a *view* over selectors that
 * already ship — nothing here posts, schedules, moves or re-adds money, and
 * nothing here computes a balance:
 *
 * - posted entries (coins) and scheduled things: the Calendar's own pipeline,
 *   `calendarPresentation` → `buildMonthBoard` → `calendarWeight`, exactly as
 *   the Desk's Leaving rail (`desk/leavingModel.ts` `readRail`) reads it, for
 *   any month, so the strip and the Calendar sheet say the same thing;
 * - bills (slips): the board's own `isOutgoingBill`, still unposted on that
 *   day (`calendarWeight` drops an occurrence once it is posted); the pot is
 *   read from `fundSnapshot` (a Prepare bill jar, or a Build goal transfer);
 * - paydays (pennants): scheduled money in on the board, plus the Fund
 *   custodian's own pay dates (`paydayTicks`, the ticks the Level draws);
 * - the weekly Sitdown (two chairs on the flagstone): the Charter's weekly
 *   cadence, read exactly as `fundWeek` reads it; shared space only;
 * - the Chapter close (the station's gate): the open Chapter
 *   (`openChapterFor`, `chapterMonth`, `chapterReminder`,
 *   `pendingChapterClosure`); shared space only;
 * - "Covered to": the Fund horizon's own last covered day
 *   (`monthForecast` over `prepareFundHorizon`, the Time Machine's read),
 *   shared space only, and absent — never guessed — when the horizon refuses.
 *
 * Civil dates are `America/Toronto` DateKeys (D-126); the caller passes
 * `today`. Unknown amounts stay `null`.
 */
import { addDays, monthEndKey, monthKeyFromDateKey, monthStartKey, shiftMonthKey, weekdaySunday0, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { buildMonthBoard, isOutgoingBill, type BoardKind } from "../../core/board.ts";
import { calendarWeight } from "../../core/calendarWeight.ts";
import { cashFlowDelta } from "../../core/cashFlowRows.ts";
import { chapterMonth, chapterReminder, openChapterFor, pendingChapterClosure } from "../../core/chapters.ts";
import { calendarPresentation } from "../../core/ledgerExperience.ts";
import { paydayTicks } from "../../core/monthSpread.ts";
import { monthForecast } from "../../core/timeMachine.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import { readSnapshot } from "../desk/todayModel.ts";

/** The two spaces on screen (§3.2): Ours is the household ledger, Mine the member's own. */
export type LedgerSpace = "ours" | "mine";

export const viewForSpace = (space: LedgerSpace): LedgerView => space === "ours" ? "household" : "personal";
export const spaceForView = (view: LedgerView): LedgerSpace => view === "household" ? "ours" : "mine";

/** A posted entry. The strip draws a coin; the amount is there for whoever asks for it. */
export type LedgerCoin = { id: string; title: string; amountCents: number; direction: "out" | "in" | "other" };

/** A scheduled bill still to be paid on this day: a paper slip on a post. */
export type LedgerSlip = {
  id: string;
  name: string;
  /** Null is unknown, never zero. */
  amountCents: number | null;
  /** Which pot the bill is set aside in, when the books say so. */
  pot: "prepare" | "build" | null;
  recurrenceId: string | null;
  kind: BoardKind;
  /** Its day has passed and it is still not recorded. */
  overdue: boolean;
};

/** A payday: a pennant. `amountCents` is null for an expected pay date with no known figure. */
export type LedgerPennant = { id: string; name: string; amountCents: number | null; memberId: string | null };

/** The Chapter's station gate. */
export type ChapterGate = {
  monthKey: MonthKey;
  /** The station: the Chapter month's last day. */
  date: DateKey;
  /** `due`: the month is still running; `overdue`: it ended and no Sitdown has closed it; `proposed`: a close waits on this reader. */
  state: "due" | "overdue" | "proposed";
};

export type LedgerDay = {
  date: DateKey;
  /** Day of the month, 1–31. */
  day: number;
  /** Sunday = 0 … Saturday = 6. */
  weekday: number;
  monthKey: MonthKey;
  relation: "past" | "today" | "future";
  /** Inside the next seven days (today and the six after). */
  inWeek: boolean;
  coins: LedgerCoin[];
  slips: LedgerSlip[];
  pennants: LedgerPennant[];
  /** The week's broader stone: the last day of a Monday-to-Sunday week. */
  flagstone: boolean;
  /** The Charter's weekly Sitdown falls on this day (two chairs). */
  sitdown: boolean;
  /** The Chapter's station gate stands on this day. */
  gate: ChapterGate | null;
  /** The month's last stone. */
  station: boolean;
};

export type CoveredTo = { date: DateKey; /** True when nothing on the horizon runs short: "covered to" is the horizon's end. */ horizonEnd: boolean };

export type DayLedger = {
  space: LedgerSpace;
  today: DateKey;
  /** The month the ledger is about (the strip's month). */
  monthKey: MonthKey;
  from: DateKey;
  to: DateKey;
  days: LedgerDay[];
  /** Today and the six days after it — the strip's markers. */
  weekFrom: DateKey;
  weekTo: DateKey;
  coveredTo: CoveredTo | null;
  chapterClose: ChapterGate | null;
  /** The Charter's weekly Sitdown weekday, when it has one. Shared space only. */
  sitdownWeekday: number | null;
};

export type DayLedgerInput = {
  household: Household;
  memberId: string;
  space: LedgerSpace;
  today: DateKey;
  from: DateKey;
  to: DateKey;
};

const WEEK = 7;
/** The longest range a caller may ask for: a month plus its trailing week, twice over. */
export const DAY_LEDGER_MAX_DAYS = 93;

function datesBetween(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let date = from; date <= to && out.length < DAY_LEDGER_MAX_DAYS; date = addDays(date, 1)) out.push(date);
  return out;
}

function monthsBetween(from: DateKey, to: DateKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let month = monthKeyFromDateKey(from); month <= monthKeyFromDateKey(to) && out.length < 5; month = shiftMonthKey(month, 1)) out.push(month);
  return out;
}

type DayFacts = { coins: LedgerCoin[]; slips: LedgerSlip[]; pennants: LedgerPennant[] };

/**
 * One month of the Calendar's own read: the scoped household the Calendar
 * page shows, its board and its weight. A member the ledger does not know, or
 * a board that cannot be read, gives no facts rather than a throw.
 */
function monthFacts(presented: Household, monthKey: MonthKey, today: DateKey, pots: Map<string, "prepare" | "build">): Map<DateKey, DayFacts> {
  const out = new Map<DateKey, DayFacts>();
  let weight;
  try {
    const board = buildMonthBoard(presented, monthKey, today);
    weight = calendarWeight(presented, board, today);
  } catch {
    return out;
  }
  for (const day of weight) {
    if (monthKeyFromDateKey(day.date) !== monthKey) continue;
    const facts: DayFacts = { coins: [], slips: [], pennants: [] };
    const seen = new Set<string>();
    for (const row of day.posted) {
      if (seen.has(row.transactionId)) continue;
      seen.add(row.transactionId);
      const delta = cashFlowDelta(row);
      facts.coins.push({ id: row.transactionId, title: row.title, amountCents: Math.abs(delta) || row.amountCents, direction: delta < 0 ? "out" : delta > 0 ? "in" : "other" });
    }
    for (const { item } of day.scheduled) {
      const amountCents = Number.isFinite(item.amountCents) ? item.amountCents : null;
      if (isOutgoingBill(item)) {
        const recurrenceId = item.recurrenceId ?? null;
        facts.slips.push({
          id: item.id, name: item.title, amountCents, recurrenceId, kind: item.kind,
          pot: recurrenceId ? pots.get(recurrenceId) ?? null : null,
          overdue: item.date < today,
        });
      } else if (item.direction === "in") {
        facts.pennants.push({ id: item.id, name: item.title, amountCents, memberId: item.memberId ?? null });
      }
    }
    out.set(day.date, facts);
  }
  return out;
}

/** Which pot each recurrence is set aside in: Prepare's bill jars, or a Build goal transfer. */
function potsFor(household: Household, memberId: string, view: LedgerView, today: DateKey): Map<string, "prepare" | "build"> {
  const pots = new Map<string, "prepare" | "build">();
  for (const recurrence of household.recurrences) if (recurrence.goalId) pots.set(recurrence.id, "build");
  const snapshot = readSnapshot(household, memberId, view, today);
  for (const bill of snapshot?.prepare.bills ?? []) {
    const match = /^recurrence:(.+)$/.exec(bill.designKey);
    if (match) pots.set(match[1]!, "prepare");
  }
  return pots;
}

/** The open Chapter's station gate, shared space only. */
export function readChapterGate(household: Household, memberId: string, today: DateKey): ChapterGate | null {
  try {
    const open = openChapterFor(household);
    if (!open) return null;
    const monthKey = chapterMonth(open);
    const pending = pendingChapterClosure(open);
    const state: ChapterGate["state"] = pending && !pending.approvals.some(row => row.memberId === memberId) ? "proposed"
      : chapterReminder(household, { today }) ? "overdue" : "due";
    return { monthKey, date: monthEndKey(monthKey), state };
  } catch {
    return null;
  }
}

/**
 * "Covered to": the Fund horizon's last covered day (the Time Machine's
 * `monthForecast`, which reads `prepareFundHorizon`), across this month and
 * the next. Null when there is no Fund, or the horizon refuses to project.
 */
export function readCoveredTo(household: Household, today: DateKey): CoveredTo | null {
  if (!household.householdFund) return null;
  try {
    const forecast = monthForecast(household, today, 1);
    if (forecast.kind !== "forecast" || !forecast.coveredThrough) return null;
    return { date: forecast.coveredThrough, horizonEnd: forecast.shortFrom === null };
  } catch {
    return null;
  }
}

/** The Charter's weekly Sitdown weekday — `fundWeek`'s own reading of the Charter. */
export function readSitdownWeekday(household: Household): number | null {
  const charter = household.charter ?? null;
  return charter && charter.cadence === "weekly" && Number.isInteger(charter.cadenceWeekday) ? charter.cadenceWeekday : null;
}

/** The whole range, day by day. Pure: the same household and inputs give the same ledger. */
export function dayLedger(input: DayLedgerInput): DayLedger {
  const { household, memberId, space, today } = input;
  const from = input.from <= input.to ? input.from : input.to;
  const to = input.from <= input.to ? input.to : input.from;
  const view = viewForSpace(space);
  const shared = space === "ours";
  const dates = datesBetween(from, to);
  const weekFrom = today;
  const weekTo = addDays(today, WEEK - 1);

  const active = household.members.some(member => member.id === memberId && member.active);
  let presented: Household | null = null;
  if (active) { try { presented = calendarPresentation(household, memberId, view); } catch { presented = null; } }
  const pots = presented ? potsFor(household, memberId, view, today) : new Map<string, "prepare" | "build">();
  const facts = new Map<DateKey, DayFacts>();
  if (presented) for (const monthKey of monthsBetween(from, to)) for (const [date, day] of monthFacts(presented, monthKey, today, pots)) facts.set(date, day);

  // The custodian's own pay dates: the Level's ticks. An expected date never doubles a scheduled pennant.
  const ticks = new Set<DateKey>();
  if (shared && active && household.householdFund) {
    try { for (const monthKey of monthsBetween(from, to)) for (const tick of paydayTicks(household, monthKey)) ticks.add(tick.date); } catch { /* no ticks */ }
  }
  const custodian = household.householdFund?.custodianMemberId ?? null;
  const custodianName = household.members.find(member => member.id === custodian)?.name ?? null;

  const sitdownWeekday = shared && active ? readSitdownWeekday(household) : null;
  const chapterClose = shared && active ? readChapterGate(household, memberId, today) : null;
  const coveredTo = shared && active ? readCoveredTo(household, today) : null;

  const days = dates.map((date): LedgerDay => {
    const found = facts.get(date) ?? { coins: [], slips: [], pennants: [] };
    const pennants = [...found.pennants];
    if (ticks.has(date) && pennants.length === 0) pennants.push({ id: `payday:${date}`, name: custodianName ? `${custodianName}’s payday` : "Payday", amountCents: null, memberId: custodian });
    const weekday = weekdaySunday0(date);
    const monthKey = monthKeyFromDateKey(date);
    return {
      date,
      day: Number(date.slice(8, 10)),
      weekday,
      monthKey,
      relation: date < today ? "past" : date === today ? "today" : "future",
      inWeek: date >= weekFrom && date <= weekTo,
      coins: found.coins,
      slips: found.slips,
      pennants,
      flagstone: weekday === 0,
      sitdown: sitdownWeekday !== null && weekday === sitdownWeekday,
      gate: chapterClose && chapterClose.date === date ? chapterClose : null,
      station: date === monthEndKey(monthKey),
    };
  });
  return { space, today, monthKey: monthKeyFromDateKey(from), from, to, days, weekFrom, weekTo, coveredTo, chapterClose, sitdownWeekday };
}

/**
 * The strip's range for a month: the whole month, and — for the current
 * month — on through the next seven days, so the band always carries a full
 * week of markers even on the 28th.
 */
export function stripRange(month: MonthKey, today: DateKey): { from: DateKey; to: DateKey } {
  const from = monthStartKey(month);
  const end = monthEndKey(month);
  const weekEnd = addDays(today, WEEK - 1);
  return { from, to: month === monthKeyFromDateKey(today) && weekEnd > end ? weekEnd : end };
}

/** The strip's ledger for a month: `dayLedger` over `stripRange`. */
export function stripLedger(input: Omit<DayLedgerInput, "from" | "to"> & { month?: MonthKey }): DayLedger {
  const month = input.month ?? monthKeyFromDateKey(input.today);
  const range = stripRange(month, input.today);
  const ledger = dayLedger({ ...input, ...range });
  return { ...ledger, monthKey: month };
}

export type LeavingNext = {
  slip: LedgerSlip;
  date: DateKey;
  /** Further bills in the next seven days, after this one. */
  moreThisWeek: number;
};

/**
 * "Leaving next": the first bill still to leave from today on, and how many
 * more follow it in the next seven days — read off the same slips the strip
 * draws, so the card's second line and the band can never disagree (A6).
 */
export function leavingNext(ledger: DayLedger): LeavingNext | null {
  const ahead = ledger.days.filter(day => day.date >= ledger.today).flatMap(day => day.slips.map(slip => ({ slip, date: day.date })));
  const first = ahead[0];
  if (!first) return null;
  const moreThisWeek = ahead.slice(1).filter(row => row.date <= ledger.weekTo).length;
  return { slip: first.slip, date: first.date, moreThisWeek };
}

/** A day's markers, in the order the strip draws them and the words say them. */
export type MarkerKind = "sitdown" | "slip" | "pennant" | "gate" | "coin";

export function dayMarkers(day: LedgerDay): MarkerKind[] {
  const out: MarkerKind[] = [];
  if (day.sitdown) out.push("sitdown");
  if (day.slips.length) out.push("slip");
  if (day.pennants.length) out.push("pennant");
  if (day.gate) out.push("gate");
  if (day.coins.length) out.push("coin");
  return out;
}
