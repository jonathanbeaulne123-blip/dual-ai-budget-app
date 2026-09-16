import { addDays, daysInMonthKey, monthKeyFromDateKey, shiftMonthKey, weekdaySunday0, type DateKey } from "../../core/calendar.ts";
import { prepareFundInflows } from "../../core/fundWalk.ts";
import { activeHouseholdFundEvents, shapeHouseholdFundConfig } from "../../core/householdFund.ts";
import { kittyBankBackingStep } from "../../core/kittyBanks.ts";
import { projectKittyNest } from "../../core/kittyNest.ts";
import { monthObligations } from "../../core/monthObligations.ts";
import { pathEras, type PathEraView } from "../../core/pathEras.ts";
import { pathLand } from "../../core/pathLand.ts";
import { pathMonths } from "../../core/pathSignals.ts";
import { PATH_ERA_HOME_LABELS, type PathEraHome, type PathEraPlanKind } from "../../core/pathWorld.ts";
import { taskVisibleTo } from "../../core/tasks.ts";
import type { Household, LedgerView } from "../../core/types.ts";
import { pathSitdownFor, type PathSitdown } from "../together.ts";

/**
 * The journey's simple view, as data (D-284). Pure: accepted household facts in,
 * one small description of the journey out — days with their bills, Fund money
 * in and to-dos, weeks, months (Chapters), eras and the lane trackers.
 *
 * Nothing here posts, stores or moves money. Amounts are read from the same
 * selectors the Fund and the Kitty Nest already use (`monthObligations`,
 * `prepareFundInflows`, `projectKittyNest`); the lanes are a way of thinking
 * about one Fund, never separate bank accounts. Private rows follow the existing
 * visibility helpers: a partner's private to-do never reaches this model.
 *
 * Ids use the open world's pick vocabulary where one exists (`month:<index>`,
 * `era:<id>`, `era-home`, `goal:<id>`) so both views can point at the same thing;
 * mini-only ids are `bill:…`, `contribution:…` and `task:…`.
 */

export type MiniLane = "prepare" | "protect" | "build";
export const MINI_LANES: readonly MiniLane[] = ["prepare", "protect", "build"];
export const MINI_LANE_LABEL: Readonly<Record<MiniLane | "everyday", string>> = {
  prepare: "Prepare", protect: "Protect", build: "Build", everyday: "Everyday",
};

export type MiniBill = {
  kind: "bill";
  id: string;
  date: DateKey;
  label: string;
  amountCents: number;
  /** Which lane the plan draws it from: bills from Prepare, a Kitty Bank claim into Build. */
  lane: MiniLane;
  /** Already posted in the books (a receipt exists), or still ahead. */
  posted: boolean;
};
export type MiniContribution = {
  kind: "contribution";
  id: string;
  date: DateKey;
  memberId: string | null;
  who: string;
  amountCents: number;
  /** Confirmed by the Fund's custodian, or an expected amount from observed paydays (never a promise). */
  expected: boolean;
};
export type MiniTask = {
  kind: "task";
  id: string;
  date: DateKey;
  title: string;
  who: string;
  /** The assignee, or null for a joint to-do. */
  whoId: string | null;
  done: boolean;
  /** Only the signed-in member can see it (their own private to-do). */
  private: boolean;
};
export type MiniItem = MiniBill | MiniContribution | MiniTask;

export type MiniDay = {
  date: DateKey;
  /** 1-based day of month. */
  day: number;
  weekday: string;
  today: boolean;
  past: boolean;
  items: MiniItem[];
  billCents: number;
  inCents: number;
};
export type MiniWeek = {
  /** First and last day of the week inside this month (Sunday-start weeks). */
  start: DateKey;
  end: DateKey;
  label: string;
  billCents: number;
  inCents: number;
  tasks: number;
  hasToday: boolean;
};
export type MiniMonthStatus = "closed" | "open" | "ahead";
export type MiniChapter = { id: string; title: string; state: string };
export type MiniMonthSummary = {
  key: string;
  label: string;
  shortLabel: string;
  /** The world's month index (`month:<index>`) when the world draws this month, else null. */
  worldIndex: number | null;
  /** The shared pick id for this month in the world's vocabulary. */
  worldId: string | null;
  eraId: string | null;
  /** 0-based position inside its era (its lap on the era island). */
  lap: number;
  status: MiniMonthStatus;
  sitdown: PathSitdown;
  booksClosed: boolean;
  current: boolean;
  chapter: MiniChapter | null;
};
export type MiniMonth = MiniMonthSummary & {
  days: MiniDay[];
  weeks: MiniWeek[];
  billCents: number;
  inCents: number;
  bills: number;
  contributions: number;
  tasks: number;
  /** The Fund is set up; without it there are no Fund bills or contributions to draw. */
  fundReady: boolean;
};

export type MiniBank = {
  goalId: string;
  /** The world's pick id for this Kitty Bank. */
  worldId: string;
  name: string;
  /** 0–10 backing steps (the world's words), and the same as a 0–1 fill. */
  step: number;
  fill: number;
  full: boolean;
  bought: boolean;
};
export type MiniEraPlan = { id: string; kind: PathEraPlanKind; label: string; sketched: boolean; bank: MiniBank | null; month: string | null };
export type MiniEraState = "crossed" | "current" | "future" | "sketched";
export type MiniEra = {
  id: string;
  /** `era-home` for the era we are in (the world's main island), else `era:<id>`. */
  worldId: string;
  order: number;
  name: string;
  finishLine: string;
  state: MiniEraState;
  from: string;
  /** Last month of the era: the crossing month − 1, the hoped-for `by`, or twelve months on when open-ended. */
  to: string;
  openEnded: boolean;
  home: PathEraHome;
  homeLabel: string;
  /** Months drawn as laps (capped; `monthCount` is the real length). */
  months: MiniMonthSummary[];
  monthCount: number;
  finishKind: "survive" | "banks" | "agree";
  /** Finish-line Kitty Banks (banks finish lines only). */
  banks: MiniBank[];
  banksFull: number;
  finishMet: boolean;
  finishWhy: string;
  plans: MiniEraPlan[];
};

export type MiniLaneTracker = { lane: MiniLane | "everyday"; label: string; amountCents: number; targetCents: number | null };
export type MiniFund = {
  ready: boolean;
  lanes: Record<MiniLane, MiniLaneTracker>;
  everyday: MiniLaneTracker;
  /** Where the numbers come from, in words. */
  source: string;
};

export type MiniJourney = {
  today: DateKey;
  memberId: string;
  view: LedgerView;
  nowMonth: string;
  eras: MiniEra[];
  currentEraId: string | null;
  /** Every month the simple view can travel to, oldest first. */
  months: MiniMonthSummary[];
  /** This month in full (days, weeks). */
  month: MiniMonth;
  fund: MiniFund;
  /** The whole span a date can travel (first and last day). */
  span: { from: DateKey; to: DateKey };
  memberNames: Record<string, string>;
};

/** Laps drawn on one era island at most; longer eras are summarised. */
export const MINI_MAX_LAPS = 36;
const MAX_MONTHS = 600;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function miniMonthLabel(key: string, long = true): string {
  const m = Number(key.slice(5, 7)) - 1;
  return `${(long ? MONTHS_LONG : MONTHS)[m] ?? key} ${key.slice(0, 4)}`;
}
export function miniDateLabel(date: DateKey, withWeekday = true): string {
  const m = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  return `${withWeekday ? `${WEEKDAY[weekdaySunday0(date)]} ` : ""}${MONTHS[m] ?? ""} ${d}`;
}
export function miniCad(cents: number, sign = false): string {
  const abs = Math.abs(Math.round(cents));
  const whole = abs % 100 === 0;
  const text = (abs / 100).toLocaleString("en-CA", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  return `${sign ? (cents < 0 ? "−" : "+") : cents < 0 ? "−" : ""}$${text}`;
}

function monthsBetween(first: string, last: string, cap = MAX_MONTHS): string[] {
  const out: string[] = [];
  let key = first;
  while (key <= last && out.length < cap) { out.push(key); key = shiftMonthKey(key, 1); }
  return out;
}

type Context = {
  household: Household;
  memberId: string;
  view: LedgerView;
  today: DateKey;
  nowMonth: string;
  worldIndex: Map<string, number>;
  eraOf: (key: string) => { id: string; lap: number } | null;
  currentEraId: string | null;
  land: ReturnType<typeof pathLand>;
  names: Record<string, string>;
};

function chapterFor(household: Household, key: string): MiniChapter | null {
  const rows = (household.chapters ?? [])
    .filter((row) => row.openedAt.slice(0, 7) <= key && (!row.closedAt || row.closedAt.slice(0, 7) >= key))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const row = rows[0];
  return row ? { id: row.id, title: row.title, state: row.state } : null;
}

function summary(ctx: Context, key: string): MiniMonthSummary {
  const worldIndex = ctx.worldIndex.get(key) ?? null;
  const era = ctx.eraOf(key);
  const sitdown = pathSitdownFor(ctx.household, key, key, ctx.today);
  const booksClosed = Boolean(ctx.land[key]?.closed);
  const current = key === ctx.nowMonth;
  const status: MiniMonthStatus = key > ctx.nowMonth ? "ahead" : !current && (sitdown === "closed" || booksClosed) ? "closed" : "open";
  return {
    key, label: miniMonthLabel(key), shortLabel: miniMonthLabel(key, false), worldIndex,
    // The world's main island draws its months as `month:<index>`; another era's month is found on that era's island.
    worldId: worldIndex !== null ? `month:${worldIndex}` : era ? (era.id === ctx.currentEraId ? "era-home" : `era:${era.id}`) : null,
    eraId: era?.id ?? null, lap: era?.lap ?? 0, status, sitdown, booksClosed, current, chapter: chapterFor(ctx.household, key),
  };
}

function eraState(state: PathEraView["state"]): MiniEraState {
  return state === "past" ? "crossed" : state;
}

function bankOf(household: Household, goalId: string, today: DateKey): MiniBank | null {
  const goal = household.goals.find((row) => row.id === goalId && row.shared);
  if (!goal) return null;
  const bought = Boolean(goal.purchaseId);
  const step = bought ? 10 : Math.max(0, Math.min(10, kittyBankBackingStep(household, goal, today)));
  return { goalId, worldId: `goal:${goalId}`, name: goal.name, step, fill: step / 10, full: step >= 10, bought };
}

/** The month-level detail: days, weeks and what each day holds. */
export function miniMonth(household: Household, monthKey: string, options: {
  memberId: string;
  view?: LedgerView;
  today: DateKey;
  journey?: Pick<MiniJourney, "months">;
  /** Show the signed-in member's own private to-dos (default true; never the partner's). */
  includeMine?: boolean;
}): MiniMonth {
  const view = options.view ?? "household";
  const { memberId, today } = options;
  const nowMonth = monthKeyFromDateKey(today);
  const names = Object.fromEntries(household.members.map((row) => [row.id, row.name]));
  const known = options.journey?.months.find((row) => row.key === monthKey);
  const head: MiniMonthSummary = known ?? summary({
    household, memberId, view, today, nowMonth, worldIndex: new Map(), eraOf: () => null, currentEraId: null, land: safe(() => pathLand(household, today), {}), names,
  }, monthKey);
  const dim = daysInMonthKey(monthKey);
  const start = `${monthKey}-01`;
  const end = `${monthKey}-${String(dim).padStart(2, "0")}`;
  const items: MiniItem[] = [];
  const fund = shapeHouseholdFundConfig(household.householdFund);

  // Bills: what the Household Fund owes this month (posted receipts and the planned rest), read exactly as the Fund reads them.
  if (fund) {
    const anchor = monthKey === nowMonth ? today : start;
    const rows = safe(() => monthObligations(household, monthKey, anchor).rows, []);
    for (const row of rows) {
      if (row.date < start || row.date > end || row.amountCents <= 0) continue;
      items.push({
        kind: "bill", id: `bill:${row.id}@${row.date}`, date: row.date,
        label: row.source === "goal-claim" ? row.label.replace(/ · goal claim$/, "") : row.label,
        amountCents: row.amountCents, lane: row.source === "goal-claim" ? "build" : "prepare", posted: row.source === "posted",
      });
    }
    // Money in: confirmed contributions, and (from today on) the Fund's own observed estimates.
    const events = safe(() => activeHouseholdFundEvents(household, fund.id), []);
    for (const event of events) {
      if (event.kind !== "contribution-confirmed" || event.date < start || event.date > end) continue;
      const who = event.contributorMemberId ? names[event.contributorMemberId] ?? "One of us" : "Together";
      items.push({ kind: "contribution", id: `contribution:${event.id}@${event.date}`, date: event.date, memberId: event.contributorMemberId ?? null, who, amountCents: event.amountCents, expected: false });
    }
    if (end >= today) {
      const from = start > today ? addDays(start, -1) : today;
      const ahead = safe(() => prepareFundInflows(household, events, from, end), []);
      for (const row of ahead) {
        if (!row.estimated || row.date < start || row.date > end) continue;
        const who = row.memberId ? names[row.memberId] ?? "One of us" : "Together";
        items.push({ kind: "contribution", id: `contribution:${row.sourceId ?? `estimate:${row.date}`}@${row.date}`, date: row.date, memberId: row.memberId, who, amountCents: row.amountCents, expected: true });
      }
    }
  }

  // To-dos: only what this member may see. Shared to-dos, plus (on this member's own device) their own private ones,
  // marked as such; a partner's private to-do never arrives.
  for (const task of household.tasks ?? []) {
    if (task.deleted || !(taskVisibleTo(task, memberId, view) || (options.includeMine !== false && taskVisibleTo(task, memberId, "personal")))) continue;
    const date = task.doDate ?? task.dueDate;
    if (!date || date < start || date > end) continue;
    const who = task.assigneeId ? names[task.assigneeId] ?? "One of us" : "Together";
    items.push({ kind: "task", id: `task:${task.id}`, date, title: task.title, who, whoId: task.assigneeId ?? null, done: Boolean(task.completedAt), private: task.visibility === "personal" });
  }

  const order = { contribution: 0, bill: 1, task: 2 } as const;
  items.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind] || a.id.localeCompare(b.id));
  const days: MiniDay[] = [];
  for (let d = 1; d <= dim; d += 1) {
    const date = `${monthKey}-${String(d).padStart(2, "0")}`;
    const mine = items.filter((row) => row.date === date);
    days.push({
      date, day: d, weekday: WEEKDAY[weekdaySunday0(date)]!, today: date === today, past: date < today, items: mine,
      billCents: mine.reduce((sum, row) => sum + (row.kind === "bill" ? row.amountCents : 0), 0),
      inCents: mine.reduce((sum, row) => sum + (row.kind === "contribution" ? row.amountCents : 0), 0),
    });
  }
  const weeks: MiniWeek[] = [];
  for (const day of days) {
    if (day.day === 1 || weekdaySunday0(day.date) === 0) weeks.push({ start: day.date, end: day.date, label: "", billCents: 0, inCents: 0, tasks: 0, hasToday: false });
    const week = weeks[weeks.length - 1]!;
    week.end = day.date;
    week.billCents += day.billCents;
    week.inCents += day.inCents;
    week.tasks += day.items.filter((row) => row.kind === "task").length;
    week.hasToday ||= day.today;
  }
  for (const week of weeks) week.label = week.start === week.end ? miniDateLabel(week.start, false) : `${miniDateLabel(week.start, false)}–${Number(week.end.slice(8, 10))}`;
  return {
    ...head, days, weeks,
    billCents: days.reduce((sum, row) => sum + row.billCents, 0),
    inCents: days.reduce((sum, row) => sum + row.inCents, 0),
    bills: items.filter((row) => row.kind === "bill").length,
    contributions: items.filter((row) => row.kind === "contribution").length,
    tasks: items.filter((row) => row.kind === "task").length,
    fundReady: Boolean(fund),
  };
}

/** The Fund's lanes as trackers. */
export function miniFund(household: Household, memberId: string, today: DateKey): MiniFund {
  // TODO(fundModel): the unmerged money-model branch replaces the Kitty Nest categories with the Fund's own lanes;
  // swap this read for that selector when it lands. Today's lanes are the nest's categories on main.
  const nest = safe(() => projectKittyNest(household, memberId, "household", today), null);
  const pick = (lane: MiniLane | "everyday"): MiniLaneTracker => {
    const row = nest?.categories.find((bank) => bank.category === lane);
    const target = row && row.targetCents > 0 ? row.targetCents : null;
    return { lane, label: MINI_LANE_LABEL[lane], amountCents: row?.amountCents ?? 0, targetCents: lane === "protect" ? target : null };
  };
  return {
    ready: Boolean(shapeHouseholdFundConfig(household.householdFund) && nest),
    lanes: { prepare: pick("prepare"), protect: pick("protect"), build: pick("build") },
    everyday: pick("everyday"),
    source: nest?.sourceLabel ?? "Whole Household Fund",
  };
}

export function miniJourney(household: Household, options: { memberId: string; view?: LedgerView; today: DateKey }): MiniJourney {
  const view = options.view ?? "household";
  const { memberId, today } = options;
  const nowMonth = monthKeyFromDateKey(today);
  const names = Object.fromEntries(household.members.map((row) => [row.id, row.name]));
  // Agreed eras only: a suggestion one of us has not agreed to yet stays in the Era planner, not on the map.
  const eraViews = safe(() => pathEras(household, today).filter((era) => era.state !== "sketched"), []);
  const current = eraViews.find((era) => era.state === "current") ?? null;
  // The world's month indices: the same window the world grows its main island from.
  const eraFrom = current?.months[0] ?? null;
  const worldKeys = safe(() => pathMonths(household, today, eraFrom ? { from: eraFrom, through: nowMonth } : undefined).map((row) => row.key), [nowMonth]);
  const worldIndex = new Map(worldKeys.map((key, index) => [key, index]));
  const land = safe(() => pathLand(household, today), {});

  const agreed = eraViews;
  const ranges = agreed.map((era, index) => {
    const from = era.state === "current" || era.state === "past" ? era.months[0] ?? era.spec.from : era.spec.from;
    const nextFrom = agreed[index + 1]?.spec.from ?? null;
    let to: string;
    let openEnded = false;
    if (era.state === "past") to = era.months.at(-1) ?? from;
    else if (era.spec.by) to = era.spec.by < nowMonth && era.state === "current" ? nowMonth : era.spec.by;
    else { openEnded = true; to = shiftMonthKey(era.state === "current" ? nowMonth : from, 11); }
    if (nextFrom && era.state !== "past" && to >= nextFrom && nextFrom > from) to = shiftMonthKey(nextFrom, -1);
    if (to < from) to = from;
    return { era, from, to, openEnded };
  });
  const eraOf = (key: string) => {
    for (const range of ranges) if (key >= range.from && key <= range.to) {
      const all = monthsBetween(range.from, range.to);
      const lap = all.length > MINI_MAX_LAPS ? Math.round(all.indexOf(key) / (all.length - 1) * (MINI_MAX_LAPS - 1)) : all.indexOf(key);
      return { id: range.era.id, lap: Math.max(0, lap) };
    }
    return null;
  };
  const ctx: Context = { household, memberId, view, today, nowMonth, worldIndex, eraOf, currentEraId: current?.id ?? null, land, names };

  const eras: MiniEra[] = ranges.map(({ era, from, to, openEnded }) => {
    const keys = monthsBetween(from, to);
    const shown = keys.length > MINI_MAX_LAPS ? Array.from({ length: MINI_MAX_LAPS }, (_, i) => keys[Math.round(i / (MINI_MAX_LAPS - 1) * (keys.length - 1))]!) : keys;
    const finish = era.spec.finish;
    const banks = finish.kind === "banks" ? finish.goalIds.map((goalId) => bankOf(household, goalId, today)).filter((row): row is MiniBank => row !== null) : [];
    const plans: MiniEraPlan[] = era.plans.map((plan) => ({
      id: plan.id, kind: plan.kind, label: plan.label, sketched: plan.sketched, month: plan.month ?? null,
      bank: plan.kind === "bank" && plan.goalId ? bankOf(household, plan.goalId, today) : null,
    }));
    return {
      id: era.id, worldId: era.state === "current" ? "era-home" : `era:${era.id}`, order: era.spec.order, name: era.spec.name,
      finishLine: era.spec.finishLine, state: eraState(era.state), from, to, openEnded, home: era.spec.home,
      homeLabel: PATH_ERA_HOME_LABELS[era.spec.home] ?? "home",
      months: shown.map((key) => summary(ctx, key)), monthCount: keys.length,
      finishKind: finish.kind, banks, banksFull: banks.filter((row) => row.full).length,
      finishMet: era.progress.met, finishWhy: era.progress.why[0] ?? "", plans,
    };
  });

  // Travel span: every era's months, or a year either side of today without a journey.
  const first = eras[0]?.from ?? shiftMonthKey(nowMonth, -12);
  const lastEra = eras.at(-1);
  const last = lastEra ? (lastEra.to > nowMonth ? lastEra.to : shiftMonthKey(nowMonth, 12)) : shiftMonthKey(nowMonth, 12);
  const earliest = worldKeys[0] && worldKeys[0] < first ? worldKeys[0] : first;
  const monthKeys = monthsBetween(earliest, last);
  const months = monthKeys.map((key) => summary(ctx, key));
  const month = miniMonth(household, nowMonth, { memberId, view, today, journey: { months } });
  return {
    today, memberId, view, nowMonth, eras, currentEraId: current?.id ?? null, months, month,
    fund: miniFund(household, memberId, today),
    span: { from: `${monthKeys[0]}-01`, to: `${monthKeys.at(-1)}-${String(daysInMonthKey(monthKeys.at(-1)!)).padStart(2, "0")}` },
    memberNames: names,
  };
}

/** The era a month belongs to (by key), or null between eras. */
export function miniEraFor(journey: Pick<MiniJourney, "eras">, monthKey: string): MiniEra | null {
  return journey.eras.find((era) => monthKey >= era.from && monthKey <= era.to) ?? null;
}

/** Plain words for one item (cards and the list say the same thing). */
export function miniItemWords(item: MiniItem): string {
  if (item.kind === "bill") {
    return item.lane === "build"
      ? `${item.label} · ${miniCad(item.amountCents)} set aside for a Kitty Bank (in the plan only)`
      : `${item.label} · ${miniCad(-item.amountCents)} · ${item.posted ? "recorded in the books" : "planned from Prepare"}`;
  }
  if (item.kind === "contribution") return `${item.who} · ${miniCad(item.amountCents, true)} into the Fund · ${item.expected ? "expected, not yet confirmed" : "confirmed"}`;
  return `To-do: ${item.title} · ${item.who}${item.done ? " · done" : ""}${item.private ? " · only you see this" : ""}`;
}

function safe<T>(read: () => T, fallback: T): T {
  try { return read(); } catch { return fallback; }
}
