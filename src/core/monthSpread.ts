/**
 * The Month Spread — Course geometry.
 *
 * Pure, testable, and deliberately separate from the component: the one rule
 * this drawing exists to tell is that the operating pool above the baseline and
 * the Kitty below it are drawn at the SAME scale, so a rollover visibly takes
 * from one and gives to the other without changing the pair. That rule has to
 * be assertable by a test, not trusted to a render.
 */

import { addDays, monthEndKey, monthStartKey, type DateKey, type MonthKey } from "./calendar.ts";
import { shapeHouseholdFundConfig } from "./householdFund.ts";
import type { CoursePoint, SharedMonthCourse } from "./sharedLedgerStory.ts";
import type { Household } from "./types.ts";
import { nextWorkScheduleDate } from "./workSettlement.ts";

export const COURSE_VIEW = {
  width: 760,
  height: 400,
  left: 46,
  right: 726,
  baseline: 248,
  /** Room above the baseline for the operating pool. */
  topRoom: 176,
  /** Room below the baseline for the Kitty. */
  bottomRoom: 76,
  claimRule: 58,
  claimLabel: 26,
  weekLabel: 13,
  axisRule: 352,
  axisLabel: 368,
  monthLabel: 384,
} as const;

/**
 * One scale for both sides of the baseline. Never widen the Kitty on its own —
 * the mirrored heights are the whole argument.
 */
export function courseScale(peakOperatingCents: number, peakKittyCents: number): number {
  const top = peakOperatingCents > 0 ? COURSE_VIEW.topRoom / peakOperatingCents : Number.POSITIVE_INFINITY;
  const bottom = peakKittyCents > 0 ? COURSE_VIEW.bottomRoom / peakKittyCents : Number.POSITIVE_INFINITY;
  const scale = Math.min(top, bottom);
  return Number.isFinite(scale) ? scale : 0;
}

export function courseX(day: number, daysInMonth: number): number {
  const span = Math.max(1, daysInMonth - 1);
  const clamped = Math.min(Math.max(day, 1), daysInMonth);
  return COURSE_VIEW.left + (clamped - 1) * (COURSE_VIEW.right - COURSE_VIEW.left) / span;
}

export function dayOfDateKey(dateKey: string): number {
  return Number(dateKey.slice(8, 10)) || 1;
}

/** Operating rises above the baseline. */
export function courseTop(cents: number, scale: number): number {
  return COURSE_VIEW.baseline - Math.max(0, cents) * scale;
}

/** Kitty falls below the baseline, at the same scale. */
export function courseBottom(cents: number, scale: number): number {
  return COURSE_VIEW.baseline + Math.max(0, cents) * scale;
}

function stepPath(
  points: CoursePoint[],
  daysInMonth: number,
  endDay: number,
  y: (point: CoursePoint) => number,
): string {
  if (!points.length) return "";
  const first = points[0]!;
  let d = `M ${courseX(dayOfDateKey(first.date), daysInMonth)} ${y(first)}`;
  let previous = first;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    const x = courseX(dayOfDateKey(point.date), daysInMonth);
    d += ` L ${x} ${y(previous)} L ${x} ${y(point)}`;
    previous = point;
  }
  d += ` L ${courseX(endDay, daysInMonth)} ${y(previous)}`;
  return d;
}

export type CoursePaths = {
  scale: number;
  todayDay: number;
  operating: string;
  operatingArea: string;
  kitty: string;
  kittyArea: string;
  future: string;
  futureArea: string;
  futureKitty: string;
  reserveDay: number | null;
};

export function coursePaths(course: SharedMonthCourse): CoursePaths {
  const scale = courseScale(course.peakOperatingCents, course.peakKittyCents);
  const days = course.daysInMonth;
  const todayDay = Math.min(dayOfDateKey(course.today), days);
  const posted = course.points.slice(0, course.todayIndex + 1);
  const operating = stepPath(posted, days, todayDay, (point) => courseTop(point.operatingCents, scale));
  const kitty = stepPath(posted, days, todayDay, (point) => courseBottom(point.kittyCents, scale));
  const base = COURSE_VIEW.baseline;
  const x0 = courseX(1, days);
  const xToday = courseX(todayDay, days);
  const xEnd = courseX(days, days);
  const standing = posted[posted.length - 1]?.operatingCents ?? 0;
  const standingKitty = posted[posted.length - 1]?.kittyCents ?? 0;
  const reserveDay = course.upcomingReserveCents > 0 && todayDay < days
    ? Math.min(days, todayDay + 1)
    : null;
  const afterReserve = Math.max(0, standing - course.upcomingReserveCents);
  const future = reserveDay
    ? `M ${xToday} ${courseTop(standing, scale)} L ${courseX(reserveDay, days)} ${courseTop(standing, scale)}`
      + ` L ${courseX(reserveDay, days)} ${courseTop(afterReserve, scale)} L ${xEnd} ${courseTop(afterReserve, scale)}`
    : `M ${xToday} ${courseTop(standing, scale)} L ${xEnd} ${courseTop(standing, scale)}`;
  return {
    scale,
    todayDay,
    operating,
    operatingArea: operating ? `${operating} L ${xToday} ${base} L ${x0} ${base} Z` : "",
    kitty,
    kittyArea: kitty ? `${kitty} L ${xToday} ${base} L ${x0} ${base} Z` : "",
    future,
    futureArea: `${future} L ${xEnd} ${base} L ${xToday} ${base} Z`,
    futureKitty: `M ${xToday} ${courseBottom(standingKitty, scale)} L ${xEnd} ${courseBottom(standingKitty, scale)} L ${xEnd} ${base} L ${xToday} ${base} Z`,
    reserveDay,
  };
}

/** Claim ticks stay small on purpose: they are a lane, not a second chart. */
export function claimTickHeight(amountCents: number): number {
  return 5 + Math.min(24, (amountCents / 100) * 0.02);
}

export const COURSE_AXIS_DAYS = [1, 5, 10, 15, 20, 25] as const;

/**
 * Payday metronome geometry. Length is pixels below the axis, never cents.
 * Do not add an amount, height-for-value, or scale field here.
 */
export const PAYDAY_TICK_VIEW = {
  length: 8,
} as const;

/** Timing-only Course mark. The custodian's projected pay date, with no amount. */
export type PaydayTick = {
  date: DateKey;
};

function paydayOrdinal(day: number): string {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${day}th`;
  const suffix = day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

/**
 * Custodian pay dates in the month, from the same `nextWorkScheduleDate`
 * primitive `nextPaydayDate` uses. Union of active jobs; no assumed CAD.
 */
export function paydayTicks(household: Household, monthKey: MonthKey): PaydayTick[] {
  const fund = shapeHouseholdFundConfig(household.householdFund);
  if (!fund) return [];
  const start = monthStartKey(monthKey);
  const end = monthEndKey(monthKey);
  const dates = new Set<DateKey>();
  for (const job of household.workJobs ?? []) {
    if (!job.active || job.memberId !== fund.custodianMemberId) continue;
    let cursor = nextWorkScheduleDate(job.paySchedule, start);
    while (cursor && cursor <= end) {
      dates.add(cursor);
      cursor = nextWorkScheduleDate(job.paySchedule, addDays(cursor, 1));
    }
  }
  return [...dates].sort().map((date) => ({ date }));
}

/** Figure copy for the metronome: days only, never CAD. */
export function paydayTickAria(ticks: PaydayTick[]): string {
  if (!ticks.length) return "";
  const days = ticks.map((tick) => paydayOrdinal(Number(tick.date.slice(8, 10))));
  const listed = days.length === 1
    ? days[0]!
    : days.length === 2
      ? `${days[0]} and ${days[1]}`
      : `${days.slice(0, -1).join(", ")}, and ${days[days.length - 1]}`;
  return `Payday ticks on the ${listed}. Timing only, no amount.`;
}
