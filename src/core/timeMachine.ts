import { monthSummary, type MonthSummary } from "./budget.ts";
import {
  formatMonthLabel,
  monthEndKey,
  monthKeyFromDateKey,
  monthStartKey,
  shiftMonthKey,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import { prepareFundHorizon } from "./fundHorizon.ts";
import { goalMonthMovements, goalSavedAsOf } from "./goals.ts";
import {
  fundLensForPeriod,
  projectHouseholdFundAsOf,
  type FundLens,
  type HouseholdFundProjection,
} from "./householdFund.ts";
import { closedMonthKeys, isMonthClosed } from "./statements.ts";
import type { Household } from "./types.ts";

/**
 * Three kinds of month, and they are not decorations.
 *
 * `behind` is closed and immutable — it reads as what happened and carries no
 * edit affordance. `now` is live. `ahead` is a projection where every figure is
 * expected rather than posted, which is the whole reason a future month must
 * never offer a posting control: a swipe forward that produces a postable
 * screen breaks Final Confirm with a gesture.
 */
export type MonthState = "behind" | "now" | "ahead";

export function monthState(period: MonthKey, today: DateKey): MonthState {
  const current = monthKeyFromDateKey(today);
  if (period < current) return "behind";
  if (period > current) return "ahead";
  return "now";
}

/** How a month went, in one word, for a bead a thumb can drag across. */
export type MonthSignal = "quiet" | "kept" | "tight" | "over" | "planned";

function signalFor(state: MonthState, summary: MonthSummary): MonthSignal {
  if (state === "ahead") return "planned";
  if (!summary.incomeActualCents && !summary.expenseActualCents) return "quiet";
  if (summary.netActualCents < 0) return "over";
  if (summary.expenseBudgetedCents && summary.expenseActualCents > summary.expenseBudgetedCents) return "tight";
  return "kept";
}

export type TimelineBead = {
  monthKey: MonthKey;
  label: string;
  /** "Sep" — what fits on a bead. */
  shortLabel: string;
  state: MonthState;
  closed: boolean;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** The Fund's operating balance where that month stands. `null` when no Fund is configured. */
  fundCents: number | null;
  goalAddedCents: number;
  signal: MonthSignal;
  memoryCount: number;
};

function shortMonthLabel(monthKey: MonthKey): string {
  return formatMonthLabel(monthKey).split(" ")[0]?.slice(0, 3) ?? monthKey.slice(5);
}

/** Every month a household has anything in, oldest first. */
export function activityMonths(household: Household): MonthKey[] {
  const months = new Set<MonthKey>();
  for (const row of household.transactions) months.add(monthKeyFromDateKey(row.date));
  for (const row of household.fundEvents ?? []) months.add(monthKeyFromDateKey(row.date as DateKey));
  for (const row of household.goalContributions ?? []) months.add(monthKeyFromDateKey(row.date));
  return [...months].sort();
}

/**
 * The default reach of the ribbon: back to the first month with anything in it
 * (a year at least, so a new household still has something to drag), and six
 * months forward, which is as far as the Fund horizon will honestly project.
 */
export function timelineRange(household: Household, today: DateKey): { from: MonthKey; to: MonthKey } {
  const current = monthKeyFromDateKey(today);
  const earliest = activityMonths(household)[0];
  const floor = shiftMonthKey(current, -11);
  return { from: earliest && earliest < floor ? earliest : floor, to: shiftMonthKey(current, 6) };
}

export function monthKeysBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const keys: MonthKey[] = [];
  for (let key = from; key <= to; key = shiftMonthKey(key, 1)) keys.push(key);
  return keys;
}

/** The ribbon. One bead per month, each carrying a signal of how that month went. */
export function timelineBeads(household: Household, today: DateKey, range?: { from: MonthKey; to: MonthKey }): TimelineBead[] {
  const span = range ?? timelineRange(household, today);
  const closed = new Set(closedMonthKeys(household));
  const fundConfigured = Boolean(household.householdFund);
  return monthKeysBetween(span.from, span.to).map((monthKey) => {
    const state = monthState(monthKey, today);
    const summary = monthSummary(household, monthKey);
    const lens = fundLensForPeriod(monthKey, today);
    const goalAddedCents = goalMonthMovements(household, monthKey).reduce((sum, row) => sum + row.addedCents, 0);
    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      shortLabel: shortMonthLabel(monthKey),
      state,
      closed: closed.has(monthKey),
      incomeCents: summary.incomeActualCents,
      expenseCents: summary.expenseActualCents,
      netCents: summary.netActualCents,
      fundCents: fundConfigured ? projectHouseholdFundAsOf(household, lens).operatingBalanceCents : null,
      goalAddedCents,
      signal: signalFor(state, summary),
      memoryCount: monthMemories(household, monthKey).length,
    };
  });
}

/**
 * A month is a memory, not a report. These are the things that happened in it
 * that a person would actually scroll back for: a bank that filled, a Win, a
 * Sitdown, a month closed honestly. Every row is read from a dated record —
 * nothing here is inferred, and nothing here is money meaning.
 */
export type MonthMemoryKind =
  | "goal-reached"
  | "bank-opened"
  | "bank-retired"
  | "win"
  | "sitdown"
  | "month-closed";

export type MonthMemory = {
  id: string;
  kind: MonthMemoryKind;
  title: string;
  detail: string;
  date: DateKey;
};

export function monthMemories(household: Household, period: MonthKey): MonthMemory[] {
  const start = monthStartKey(period);
  const end = monthEndKey(period);
  const inMonth = (date: string | null | undefined): boolean => Boolean(date && date.slice(0, 10) >= start && date.slice(0, 10) <= end);
  const memories: MonthMemory[] = [];

  for (const goal of household.goals ?? []) {
    const endCents = goalSavedAsOf(household, goal.id, end);
    const beforeCents = goalSavedAsOf(household, goal.id, monthEndKey(shiftMonthKey(period, -1)));
    if (goal.targetCents > 0 && beforeCents < goal.targetCents && endCents >= goal.targetCents) {
      memories.push({
        id: `goal-reached:${goal.id}`,
        kind: "goal-reached",
        title: `${goal.name} filled`,
        detail: "The bank reached what it was for.",
        date: end,
      });
    }
    if (inMonth(goal.createdAt)) {
      memories.push({
        id: `bank-opened:${goal.id}`,
        kind: "bank-opened",
        title: `${goal.name} started`,
        detail: "A new bank on the shelf.",
        date: goal.createdAt.slice(0, 10) as DateKey,
      });
    }
    if (inMonth(goal.retiredAt)) {
      memories.push({
        id: `bank-retired:${goal.id}`,
        kind: "bank-retired",
        title: `${goal.name} was spent`,
        detail: "The thing it was saved for actually happened.",
        date: (goal.retiredAt ?? end).slice(0, 10) as DateKey,
      });
    }
  }

  for (const win of household.wins ?? []) {
    if (!inMonth(win.shownAt)) continue;
    memories.push({
      id: `win:${win.id}`,
      kind: "win",
      title: win.title,
      detail: win.authoredNote || "A Win, kept.",
      date: win.shownAt.slice(0, 10) as DateKey,
    });
  }

  for (const session of household.sitDownSessions ?? []) {
    if (session.targetMonth !== period || session.status !== "closed") continue;
    memories.push({
      id: `sitdown:${session.id}`,
      kind: "sitdown",
      title: "You sat down together",
      detail: "Leftover money was given a job on purpose.",
      date: session.updatedAt.slice(0, 10) as DateKey,
    });
  }

  if (isMonthClosed(household, period)) {
    memories.push({
      id: `closed:${period}`,
      kind: "month-closed",
      title: "The month was closed",
      detail: "Counted, tied and put away.",
      date: end,
    });
  }

  return memories.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

/**
 * One period, one page. Everything a month view renders comes from here so the
 * ribbon can never leave half the screen standing in a different month.
 */
export type MonthView = {
  monthKey: MonthKey;
  label: string;
  state: MonthState;
  closed: boolean;
  lens: FundLens;
  summary: MonthSummary;
  fund: HouseholdFundProjection;
  fundConfigured: boolean;
  goals: ReturnType<typeof goalMonthMovements>;
  memories: MonthMemory[];
  /** Copy for the month's own state; a month ahead never says "spent". */
  stateLine: string;
};

const STATE_LINE: Record<MonthState, string> = {
  behind: "What happened. Closed months can be read, not rewritten.",
  now: "This month, as it stands today.",
  ahead: "Expected, not posted. Nothing here has been recorded yet.",
};

export function monthView(household: Household, period: MonthKey, today: DateKey): MonthView {
  const lens = fundLensForPeriod(period, today);
  return {
    monthKey: period,
    label: formatMonthLabel(period),
    state: monthState(period, today),
    closed: isMonthClosed(household, period),
    lens,
    summary: monthSummary(household, period),
    fund: projectHouseholdFundAsOf(household, lens),
    fundConfigured: Boolean(household.householdFund),
    goals: goalMonthMovements(household, period),
    memories: monthMemories(household, period),
    stateLine: STATE_LINE[monthState(period, today)],
  };
}

/** Two months side by side: not just totals, but what changed, what's new, what stopped. */
export type ComparisonChange = "new" | "stopped" | "more" | "less" | "same";

export type ComparisonLine = {
  id: string;
  name: string;
  type: "income" | "expense";
  leftCents: number;
  rightCents: number;
  deltaCents: number;
  change: ComparisonChange;
};

export type MonthComparison = {
  left: MonthKey;
  right: MonthKey;
  leftLabel: string;
  rightLabel: string;
  lines: ComparisonLine[];
  incomeDeltaCents: number;
  expenseDeltaCents: number;
  netDeltaCents: number;
  /** The three biggest movements, which is what a person actually reads. */
  headlines: ComparisonLine[];
};

function changeFor(leftCents: number, rightCents: number): ComparisonChange {
  if (!leftCents && rightCents) return "new";
  if (leftCents && !rightCents) return "stopped";
  if (rightCents > leftCents) return "more";
  if (rightCents < leftCents) return "less";
  return "same";
}

export function compareMonths(household: Household, left: MonthKey, right: MonthKey): MonthComparison {
  const leftMonth = monthSummary(household, left);
  const rightMonth = monthSummary(household, right);
  const byId = new Map<string, ComparisonLine>();
  for (const row of leftMonth.categories) {
    byId.set(row.subcategoryId, {
      id: row.subcategoryId,
      name: row.name,
      type: row.type,
      leftCents: row.actualCents,
      rightCents: 0,
      deltaCents: -row.actualCents,
      change: "stopped",
    });
  }
  for (const row of rightMonth.categories) {
    const existing = byId.get(row.subcategoryId);
    const leftCents = existing?.leftCents ?? 0;
    byId.set(row.subcategoryId, {
      id: row.subcategoryId,
      name: row.name,
      type: row.type,
      leftCents,
      rightCents: row.actualCents,
      deltaCents: row.actualCents - leftCents,
      change: changeFor(leftCents, row.actualCents),
    });
  }
  const lines = [...byId.values()]
    .filter((row) => row.leftCents || row.rightCents)
    .sort((a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents) || a.name.localeCompare(b.name));
  return {
    left,
    right,
    leftLabel: formatMonthLabel(left),
    rightLabel: formatMonthLabel(right),
    lines,
    incomeDeltaCents: rightMonth.incomeActualCents - leftMonth.incomeActualCents,
    expenseDeltaCents: rightMonth.expenseActualCents - leftMonth.expenseActualCents,
    netDeltaCents: rightMonth.netActualCents - leftMonth.netActualCents,
    headlines: lines.filter((row) => row.deltaCents !== 0).slice(0, 3),
  };
}

/**
 * Scroll forward and see what is known. Every cent of this comes from
 * `prepareFundHorizon`, the reviewed Fund projection, including its refusals —
 * a time machine that lies is worthless, so when the Fund cannot honestly
 * project, this says so instead of drawing a line anyway.
 */
export type ForecastMonth = {
  monthKey: MonthKey;
  label: string;
  expectedInCents: number;
  expectedOutCents: number;
  endBalanceCents: number;
  lowestCents: number;
  lowestDate: DateKey;
};

export type Forecast =
  | {
    kind: "forecast";
    asOf: DateKey;
    through: DateKey;
    months: ForecastMonth[];
    /** The last day the Fund stays above zero on what is known today. */
    coveredThrough: DateKey | null;
    /** The first day it does not, when there is one. */
    shortFrom: DateKey | null;
    assumptions: readonly string[];
  }
  | { kind: "unavailable"; reasons: readonly { code: string; message: string }[] };

export function monthForecast(household: Household, today: DateKey, months = 6): Forecast {
  const through = monthEndKey(shiftMonthKey(monthKeyFromDateKey(today), Math.max(1, months)));
  const horizon = prepareFundHorizon(household, today, through, { purpose: "plan" });
  if (horizon.kind !== "horizon") return { kind: "unavailable", reasons: horizon.reasons };
  const rows: ForecastMonth[] = [];
  // A month with nothing dated in it is still a month: it carries the balance
  // forward rather than falling out of the ribbon.
  let carriedCents = horizon.anchorCents;
  for (const monthKey of monthKeysBetween(monthKeyFromDateKey(today), monthKeyFromDateKey(through))) {
    const points = horizon.future.filter((point) => monthKeyFromDateKey(point.date) === monthKey);
    const lowest = points.reduce<{ balanceCents: number; date: DateKey }>(
      (low, point) => (point.balanceCents < low.balanceCents ? point : low),
      { balanceCents: carriedCents, date: monthKey === monthKeyFromDateKey(today) ? today : monthStartKey(monthKey) },
    );
    carriedCents = points.at(-1)?.balanceCents ?? carriedCents;
    rows.push({
      monthKey,
      label: formatMonthLabel(monthKey),
      expectedInCents: points.filter((point) => point.deltaCents > 0).reduce((sum, point) => sum + point.deltaCents, 0),
      expectedOutCents: points.filter((point) => point.deltaCents < 0).reduce((sum, point) => sum - point.deltaCents, 0),
      endBalanceCents: carriedCents,
      lowestCents: lowest.balanceCents,
      lowestDate: lowest.date,
    });
  }
  const short = horizon.future.find((point) => point.balanceCents < 0) ?? null;
  const covered = short
    ? horizon.future.filter((point) => point.date < short.date).at(-1)?.date ?? null
    : horizon.anchorCents >= 0 ? through : null;
  return {
    kind: "forecast",
    asOf: today,
    through,
    months: rows,
    coveredThrough: covered,
    shortFrom: short?.date ?? null,
    assumptions: horizon.assumptions,
  };
}

/** Twelve months at a glance. Seasonal shape, so December stops being a surprise. */
export type YearMonth = {
  monthKey: MonthKey;
  shortLabel: string;
  state: MonthState;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export type YearShape = {
  year: number;
  months: YearMonth[];
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** The month that took the most, and the one that took the least, among months that happened. */
  hardestMonthKey: MonthKey | null;
  kindestMonthKey: MonthKey | null;
};

export function yearShape(household: Household, year: number, today: DateKey): YearShape {
  const months: YearMonth[] = [];
  for (let month = 1; month <= 12; month++) {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const summary = monthSummary(household, monthKey);
    months.push({
      monthKey,
      shortLabel: shortMonthLabel(monthKey),
      state: monthState(monthKey, today),
      incomeCents: summary.incomeActualCents,
      expenseCents: summary.expenseActualCents,
      netCents: summary.netActualCents,
    });
  }
  const happened = months.filter((row) => row.state !== "ahead" && (row.incomeCents || row.expenseCents));
  const hardest = happened.reduce<YearMonth | null>((worst, row) => (!worst || row.expenseCents > worst.expenseCents ? row : worst), null);
  const kindest = happened.reduce<YearMonth | null>((best, row) => (!best || row.expenseCents < best.expenseCents ? row : best), null);
  return {
    year,
    months,
    incomeCents: months.reduce((sum, row) => sum + row.incomeCents, 0),
    expenseCents: months.reduce((sum, row) => sum + row.expenseCents, 0),
    netCents: months.reduce((sum, row) => sum + row.netCents, 0),
    hardestMonthKey: hardest?.monthKey ?? null,
    kindestMonthKey: kindest?.monthKey ?? null,
  };
}

/** Unprompted and warm: the same month, a year ago, and what it cost then. */
export type LastYearLine = { id: string; name: string; thenCents: number; nowCents: number };

export type ThisTimeLastYear = {
  monthKey: MonthKey;
  label: string;
  lastYearKey: MonthKey;
  lastYearLabel: string;
  expenseThenCents: number;
  expenseNowCents: number;
  lines: LastYearLine[];
} | null;

export function thisTimeLastYear(household: Household, today: DateKey): ThisTimeLastYear {
  const monthKey = monthKeyFromDateKey(today);
  const lastYearKey = shiftMonthKey(monthKey, -12);
  const then = monthSummary(household, lastYearKey);
  if (!then.expenseActualCents && !then.incomeActualCents) return null;
  const now = monthSummary(household, monthKey);
  const nowById = new Map(now.categories.map((row) => [row.subcategoryId, row.actualCents]));
  const lines = then.categories
    .filter((row) => row.type === "expense" && row.actualCents > 0)
    .map((row) => ({
      id: row.subcategoryId,
      name: row.name,
      thenCents: row.actualCents,
      nowCents: nowById.get(row.subcategoryId) ?? 0,
    }))
    .sort((a, b) => b.thenCents - a.thenCents)
    .slice(0, 4);
  return {
    monthKey,
    label: formatMonthLabel(monthKey),
    lastYearKey,
    lastYearLabel: formatMonthLabel(lastYearKey),
    expenseThenCents: then.expenseActualCents,
    expenseNowCents: now.expenseActualCents,
    lines,
  };
}
