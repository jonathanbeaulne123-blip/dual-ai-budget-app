// The two streams — six months of how this household actually earns.
// One stream is a clock, the other is a decision. Neither is measured
// against the other: this file is the most tempting place in the product
// to add a comparison between two members, so it is the one place that
// must never compute one. Every mark is a real confirmed contribution,
// read straight off the fund's own events. Nothing here infers an amount
// from a pay schedule, and nothing here sums the two streams into
// anything a person could read as a scoreboard.

import {
  calendarDaysBetween,
  monthKeyFromDateKey,
  monthStartKey,
  shiftMonthKey,
  weekdaySunday0,
  type DateKey,
} from "./calendar.ts";
import { activeHouseholdFundEvents, HOUSEHOLD_FUND_ID, shapeHouseholdFundConfig } from "./householdFund.ts";
import { ValidationError, type Household } from "./types.ts";

const REGULAR_MIN_MARKS = 3;
const REGULAR_TOLERANCE_DAYS = 3;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type StreamMark = { date: DateKey; amountCents: number; memberId: string };

export type MemberStream = {
  memberId: string;
  marks: StreamMark[];
  cadenceLabel: string;
  regular: boolean;
};

function distinctDateMarks(marks: readonly StreamMark[]): StreamMark[] {
  const seen = new Set<DateKey>();
  return marks.filter((mark) => {
    if (seen.has(mark.date)) return false;
    seen.add(mark.date);
    return true;
  });
}

function gapsInDays(marks: readonly StreamMark[]): number[] {
  const gaps: number[] = [];
  for (let index = 1; index < marks.length; index += 1) {
    gaps.push(calendarDaysBetween(marks[index - 1]!.date, marks[index]!.date));
  }
  return gaps;
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A rhythm, not a virtue — spacing consistency only, never how much or how often relative to anyone else. */
function isRegular(marks: readonly StreamMark[]): boolean {
  if (marks.length < REGULAR_MIN_MARKS) return false;
  const gaps = gapsInDays(marks);
  const median = medianOf(gaps);
  return gaps.every((gap) => Math.abs(gap - median) <= REGULAR_TOLERANCE_DAYS);
}

/** The weekday most of a member's own marks land on, if at least half agree. Never a claim about anyone else's. */
function dominantWeekday(marks: readonly StreamMark[]): number | null {
  const counts = new Map<number, number>();
  for (const mark of marks) {
    const weekday = weekdaySunday0(mark.date);
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [weekday, count] of counts) {
    if (count > bestCount) {
      best = weekday;
      bestCount = count;
    }
  }
  return best !== null && bestCount * 2 > marks.length ? best : null;
}

function cadenceLabelFor(marks: readonly StreamMark[], regular: boolean): string {
  if (marks.length < REGULAR_MIN_MARKS) return "not enough history yet";
  if (!regular) return "no fixed rhythm";
  const median = medianOf(gapsInDays(marks));
  const weekday = dominantWeekday(marks);
  const weekdayName = weekday !== null ? WEEKDAY_NAMES[weekday] : null;
  if (median >= 5 && median <= 9) return weekdayName ? `about once a week, usually ${weekdayName}` : "about once a week";
  if (median >= 12 && median <= 16) return weekdayName ? `about every two weeks, usually ${weekdayName}` : "about every two weeks";
  if (median >= 26 && median <= 32) return "about once a month";
  return `about every ${Math.round(median)} days`;
}

export function streamWindowStart(today: DateKey, months = 6): DateKey {
  if (!Number.isInteger(months) || months < 1) throw new ValidationError("Stream window months must be a positive integer.");
  return monthStartKey(shiftMonthKey(monthKeyFromDateKey(today), -(months - 1)));
}

/**
 * Six months (by default) of confirmed contributions, one stream per member
 * who actually made one — grouped, timed, and left otherwise untouched.
 */
export function twoStreams(household: Household, today: DateKey, months = 6): MemberStream[] {
  const config = shapeHouseholdFundConfig(household.householdFund);
  if (!config) return [];
  const fundId = config.id || HOUSEHOLD_FUND_ID;
  const windowStart = streamWindowStart(today, months);

  const byMember = new Map<string, StreamMark[]>();
  for (const event of activeHouseholdFundEvents(household, fundId)) {
    // An event with no recorded contributor has no member to stream it
    // under — this type has no room for an "unattributed" third stream,
    // so, unlike the grid on the week, that money is left out here rather
    // than invented a home.
    if (event.kind !== "contribution-confirmed" || !event.contributorMemberId) continue;
    if (event.date < windowStart || event.date > today) continue;
    const marks = byMember.get(event.contributorMemberId) ?? [];
    marks.push({ date: event.date, amountCents: event.amountCents, memberId: event.contributorMemberId });
    byMember.set(event.contributorMemberId, marks);
  }

  return [...byMember.entries()]
    .map(([memberId, marks]) => {
      const sorted = [...marks].sort((left, right) => left.date.localeCompare(right.date));
      // Multiple confirmed events on one civil date are one timing observation.
      // Keep every event in marks, but never let same-day gaps manufacture a rhythm.
      const timingMarks = distinctDateMarks(sorted);
      const regular = isRegular(timingMarks);
      return { memberId, marks: sorted, cadenceLabel: cadenceLabelFor(timingMarks, regular), regular };
    })
    .sort((left, right) => left.memberId.localeCompare(right.memberId));
}
