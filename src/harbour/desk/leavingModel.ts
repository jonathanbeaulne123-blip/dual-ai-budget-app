/**
 * The Desk's Leaving page, read (SIMPLE_VIEW_DESK S3 §2): what is leaving and
 * when. Pure functions over shipped selectors only — nothing here posts,
 * writes, defers or moves money, and nothing here computes a balance:
 *
 * - the next-out table and the spoken-for read: `nextOut` and `spokenFor`
 *   over the shared Fund's `fundWalk` (the same walk `NextOutStage` draws);
 * - the day-by-day rail: `calendarWeight` over the Calendar's own
 *   presentation household (`calendarPresentation`) and month board
 *   (`buildMonthBoard`) — the very rail the Calendar's board pane draws;
 * - the bill jars: the Cellar's own reading (`HarbourReading.cellar`, which is
 *   `buildCellarReading` → `cellarJars` + `jarState` + the missing-payment
 *   mark) — exactly what the Cellar's reading edition shows.
 *
 * Personal scope has no Fund: no walk, no pool to speak for, no cellar. It
 * reads the personal Calendar's rail and the outflows scheduled on it, and
 * says plainly that the Fund reads live in Shared. Unknown amounts stay
 * `null` and read "—" downstream.
 */
import { calendarDaysBetween, monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import { buildMonthBoard } from "../../core/board.ts";
import { cashFlowDelta } from "../../core/cashFlowRows.ts";
import { calendarWeight, type WeightDay } from "../../core/calendarWeight.ts";
import type { FundWalk } from "../../core/fundWalk.ts";
import { projectKittyNest } from "../../core/kittyNest.ts";
import { calendarPresentation } from "../../core/ledgerExperience.ts";
import { nextOut, spokenFor, type SpokenFor } from "../../core/nextOut.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import { buildCellarReading, type CellarJarReading, type HarbourReading } from "../data/reading.ts";
import { readWalk } from "./todayModel.ts";

/** One outflow still to come. `leavesCents` is the Fund's walked balance after it; null off the Fund. */
export type LeavingRow = {
  id: string;
  label: string;
  date: DateKey;
  /** Null is unknown, never zero. */
  amountCents: number | null;
  leavesCents: number | null;
  underBuffer: boolean;
  breaks: boolean;
};

export type LeavingTable = {
  /** "fund": `nextOut` over the Fund walk. "calendar": the rail's scheduled cash out, from today on. */
  source: "fund" | "calendar";
  rows: LeavingRow[];
  breakRow: LeavingRow | null;
  totalCents: number;
};

export type LeavingNext = LeavingRow & { daysAhead: number };

export type LeavingSpoken = SpokenFor & {
  /** 0–1: how much of the pool is claimed, for the bar. A claim against an empty pool fills it. */
  claimedShare: number;
};

export type LeavingRailItem = {
  id: string;
  title: string;
  /** Null is unknown, never zero. */
  cents: number | null;
  kind: "posted-out" | "posted-in" | "posted-other" | "scheduled-out" | "scheduled-other";
  note: string;
};

export type LeavingRailDay = {
  date: DateKey;
  day: number;
  today: boolean;
  postedOutCents: number;
  outstandingOutCents: number;
  postedInCents: number;
  weightCents: number;
  /** 0–1 of the rail's height, square-root scale — ink (posted) sits under copper (scheduled). */
  postedHeight: number;
  scheduledHeight: number;
  /** Some scheduled payment status needs review and is not plotted (the Calendar's own caveat). */
  needsReview: boolean;
  items: LeavingRailItem[];
};

export type LeavingRail = {
  days: LeavingRailDay[];
  todayIndex: number;
  postedOutCents: number;
  outstandingOutCents: number;
};

export type LeavingJarState = CellarJarReading["state"];

export type LeavingJar = {
  key: string;
  label: string;
  /** Null is unknown, never zero. */
  amountCents: number | null;
  state: LeavingJarState;
  /** A subscription whose last payment is missing (`missingSubscriptions`). */
  missing: boolean;
  due: DateKey | null;
};

/** The Cellar's own words for a jar's state, plus the missing mark. */
export const JAR_STATE_WORDS: Readonly<Record<LeavingJarState, string>> = Object.freeze({
  planned: "Planned", "set-aside": "Set aside", paid: "Paid", short: "Short",
});

/** The shared Fund's walk of the month — Today's own read (`readWalk`), so the two pages walk one month. */
export function readLeavingWalk(household: Household, scope: LedgerView, today: DateKey): FundWalk | null {
  return readWalk(household, scope, today);
}

/** The spoken-for read, with the bar's share — `NextOutStage`'s own rule. */
export function readSpoken(walk: FundWalk | null, today: DateKey): LeavingSpoken | null {
  if (!walk) return null;
  try {
    const claim = spokenFor(walk, today);
    const claimedShare = claim.poolCents > 0 ? Math.min(1, claim.claimedCents / claim.poolCents) : claim.claimedCents > 0 ? 1 : 0;
    return { ...claim, claimedShare };
  } catch {
    return null;
  }
}

/**
 * The day-by-day rail: the Calendar board's own `calendarWeight`, on the
 * Calendar's own presentation of this scope. Square-root heights exactly as
 * `src/CalendarWeight.tsx` draws them. Null when the rail cannot be read.
 */
export function readRail(household: Household, memberId: string, scope: LedgerView, today: DateKey): LeavingRail | null {
  let days: WeightDay[];
  try {
    const presented = calendarPresentation(household, memberId, scope);
    const board = buildMonthBoard(presented, monthKeyFromDateKey(today), today);
    days = calendarWeight(presented, board, today);
  } catch {
    return null;
  }
  if (days.length === 0) return null;
  const max = Math.max(1, ...days.map(day => day.weightCents));
  const railDays = days.map((day): LeavingRailDay => {
    const height = day.weightCents ? Math.max(0.03, Math.sqrt(day.weightCents / max)) : 0;
    const postedHeight = day.weightCents ? height * day.postedOutCents / day.weightCents : 0;
    return {
      date: day.date,
      day: Number(day.date.slice(8, 10)),
      today: day.date === today,
      postedOutCents: day.postedOutCents,
      outstandingOutCents: day.outstandingOutCents,
      postedInCents: day.postedInCents,
      weightCents: day.weightCents,
      postedHeight,
      scheduledHeight: height - postedHeight,
      needsReview: day.scheduled.some(row => !row.allowPost),
      items: [
        ...day.posted.map((row): LeavingRailItem => {
          const delta = cashFlowDelta(row);
          return {
            id: `posted:${row.transactionId}`,
            title: row.title,
            cents: Math.abs(delta) || row.amountCents,
            kind: delta < 0 ? "posted-out" : delta > 0 ? "posted-in" : "posted-other",
            note: delta < 0 ? "Posted · cash out" : delta > 0 ? "Posted · cash in or returned"
              : row.component === "cardSpendCents" ? "Posted card activity · not cash leaving" : "Posted transfer · within cash or non-cash accounts",
          };
        }),
        ...day.scheduled.map((row): LeavingRailItem => ({
          id: `scheduled:${row.item.id}`,
          title: row.item.title,
          cents: Number.isFinite(row.item.amountCents) ? row.item.amountCents : null,
          kind: row.outstandingOutCents > 0 ? "scheduled-out" : "scheduled-other",
          note: row.note,
        })),
      ],
    };
  });
  const found = railDays.findIndex(day => day.today);
  return {
    days: railDays,
    todayIndex: found < 0 ? 0 : found,
    postedOutCents: days.reduce((sum, day) => sum + day.postedOutCents, 0),
    outstandingOutCents: days.reduce((sum, day) => sum + day.outstandingOutCents, 0),
  };
}

/**
 * The next-out table. On the Fund it is `nextOut` over the walk, row for row.
 * Off the Fund (personal scope, or a household with no Fund yet) it is the
 * rail's scheduled cash out from today to month end — what the Calendar says
 * is still to leave — with no "leaves" column, because there is no pool.
 */
export function readLeavingTable(walk: FundWalk | null, rail: LeavingRail | null, today: DateKey): LeavingTable {
  if (walk) {
    try {
      const table = nextOut(walk);
      const rows = table.rows.map((row): LeavingRow => ({
        id: row.id, label: row.label, date: row.date, amountCents: row.amountCents,
        leavesCents: row.leavesCents, underBuffer: row.underBuffer, breaks: row.breaks,
      }));
      const breakRow = table.breakRow ? rows.find(row => row.id === table.breakRow!.id) ?? null : null;
      return { source: "fund", rows, breakRow, totalCents: table.totalCents };
    } catch { /* fall through to the Calendar's rail */ }
  }
  const rows: LeavingRow[] = (rail?.days ?? [])
    .filter(day => day.date >= today)
    .flatMap(day => day.items
      .filter(item => item.kind === "scheduled-out")
      .map((item): LeavingRow => ({ id: item.id, label: item.title, date: day.date, amountCents: item.cents, leavesCents: null, underBuffer: false, breaks: false })));
  const scheduledCents = (rail?.days ?? []).filter(day => day.date >= today).reduce((sum, day) => sum + day.outstandingOutCents, 0);
  return { source: "calendar", rows, breakRow: null, totalCents: scheduledCents };
}

/** The headline: the table's first row, with how many days away it is. */
export function readLeavingNext(table: LeavingTable, today: DateKey): LeavingNext | null {
  const row = table.rows[0];
  return row ? { ...row, daysAhead: Math.max(0, calendarDaysBetween(today, row.date)) } : null;
}

/**
 * The bill jars, exactly as the Cellar reads them. The harbour's reading
 * already carries them (`reading.cellar.jars`); before that reading arrives
 * the Desk asks `buildCellarReading` itself, the same function. Personal
 * scope has no cellar: null, and the page says so.
 */
export function readJars(household: Household, memberId: string, scope: LedgerView, today: DateKey, reading: HarbourReading | null): LeavingJar[] | null {
  if (scope !== "household") return null;
  let jars: CellarJarReading[];
  if (reading?.cellar) jars = reading.cellar.jars;
  else {
    try {
      jars = buildCellarReading(household, memberId, today, projectKittyNest(household, memberId, "household", today), null).jars;
    } catch {
      return [];
    }
  }
  return jars.map(jar => ({
    key: jar.key,
    label: jar.label,
    amountCents: Number.isFinite(jar.amountCents) ? jar.amountCents : null,
    state: jar.state,
    missing: jar.missingMark === true,
    due: jar.due,
  }));
}

export type DeskLeaving = {
  scope: LedgerView;
  /** True when the shared Fund's walk is read here. */
  fund: boolean;
  next: LeavingNext | null;
  table: LeavingTable;
  spoken: LeavingSpoken | null;
  rail: LeavingRail | null;
  /** Null: no cellar in this scope. */
  jars: LeavingJar[] | null;
};

/** The whole page's read, once. */
export function readLeaving(household: Household, memberId: string, scope: LedgerView, today: DateKey, reading: HarbourReading | null): DeskLeaving {
  const walk = readLeavingWalk(household, scope, today);
  const rail = readRail(household, memberId, scope, today);
  const table = readLeavingTable(walk, rail, today);
  return {
    scope,
    fund: table.source === "fund",
    next: readLeavingNext(table, today),
    table,
    spoken: readSpoken(walk, today),
    rail,
    jars: readJars(household, memberId, scope, today, reading),
  };
}
