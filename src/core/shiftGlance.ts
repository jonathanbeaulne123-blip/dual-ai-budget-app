import {
  addDays,
  calendarDaysBetween,
  weekdaySunday0,
  WEEKDAY_SHORT,
  type DateKey,
} from "./calendar.ts";
import { formatCad } from "./money.ts";
import { previewClockSpan, type ShiftClockSpan } from "./analogClock.ts";
import { activeOpenShift } from "./shiftClock.ts";
import {
  inferTipMeal,
  observeTipShifts,
  planTaxMilk,
  runTipOracle,
  shiftOutlook,
  simulateTipSchedule,
  upcomingCadenceSchedule,
  type TipMeal,
  type TipOracleResult,
  type TaxMilkPlanResult,
} from "./tipScience.ts";
import type { WeatherGlass } from "./weather.ts";
import { workOwedFacts, workReportFacts, type WorkOwedFact } from "./workSettlement.ts";
import { workShiftIsReversed } from "./work.ts";
import type { Household } from "./types.ts";

export const SHIFT_CLIMATE_DAYS = 7;
export const SHIFT_SAUCER_DAYS = 28;
export const SHIFT_OFF_FREQUENCY = 0.35;
export const SHIFT_ORACLE_MIN_SHIFTS = 4;

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type ClimateTone = "hot" | "warm" | "cool" | "empty";

export type ShiftClimateSeal = {
  date: DateKey;
  weekdayShort: string;
  meal: TipMeal | null;
  mealMark: "L" | "D" | "—";
  sub: string;
  tone: ClimateTone;
  wet: boolean;
  hours: number;
  caption: string;
  lowCents: number | null;
  highCents: number | null;
};

export type ShiftSaucerDay = {
  date: DateKey;
  filled: boolean;
  latest: boolean;
};

export type ShiftSaucerBoard = {
  days: ShiftSaucerDay[];
  streakCount: number;
  latestDate: DateKey | null;
  pill: string;
};

export type ShiftLivePreview = {
  hours: number;
  caption: string;
  span: ShiftClockSpan;
};

export type ShiftReportGlance = {
  shifts: number;
  hours: number;
  takeHomeCents: number;
  protectWeekdays: string[];
  protectLabel: string;
  owed: WorkOwedFact[];
  oracle: TipOracleResult | null;
  taxMilk: TaxMilkPlanResult | null;
};

type WeekdayCadence = {
  frequency: number;
  meal: TipMeal;
  hours: number;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = (sorted.length - 1) / 2;
  const low = sorted[Math.floor(mid)]!;
  const high = sorted[Math.ceil(mid)]!;
  return (low + high) / 2;
}

/** Cadence by weekday from posted tip history — same idea as tipScience profiles, not a Monte Carlo fork. */
export function weekdayCadenceMap(household: Household, memberId?: string): Map<number, WeekdayCadence> {
  const observations = observeTipShifts(household, memberId);
  const map = new Map<number, WeekdayCadence>();
  if (!observations.length) return map;
  const spanDays = Math.max(1, calendarDaysBetween(observations[0]!.date, observations[observations.length - 1]!.date) + 1);
  const spanWeeks = Math.max(1, spanDays / 7);
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const rows = observations.filter((row) => row.weekday === weekday);
    if (!rows.length) continue;
    let lunch = 0;
    let dinner = 0;
    for (const row of rows) {
      if (row.meal === "lunch") lunch += 1;
      else dinner += 1;
    }
    map.set(weekday, {
      frequency: Math.min(2, rows.length / spanWeeks),
      meal: dinner >= lunch ? "dinner" : "lunch",
      hours: median(rows.map((row) => row.hours)) || rows[0]!.hours,
    });
  }
  return map;
}

function mealMark(meal: TipMeal | null): "L" | "D" | "—" {
  if (meal === "lunch") return "L";
  if (meal === "dinner") return "D";
  return "—";
}

function climateSub(input: {
  today: boolean;
  on: boolean;
  wet: boolean;
  tone: ClimateTone;
  meal: TipMeal | null;
}): string {
  if (!input.on) return "off";
  if (input.today && input.wet) return "rain";
  if (input.today) return "now";
  if (input.tone === "hot") return "busy";
  if (input.tone === "warm") return "ok";
  if (input.meal === "lunch") return "quiet";
  return "mid";
}

function climateTone(expected: number, typical: number, upside: number): ClimateTone {
  if (expected >= Math.max(1, upside) * 0.9) return "hot";
  if (expected >= typical) return "warm";
  return "cool";
}

export function postedShiftDates(household: Household, memberId?: string): DateKey[] {
  const dates = new Set<DateKey>();
  for (const shift of household.shifts) {
    if (memberId && shift.memberId !== memberId) continue;
    if (workShiftIsReversed(household, shift)) continue;
    if (shift.date) dates.add(shift.date);
  }
  return [...dates].sort();
}

export function shiftClimateSeals(
  household: Household,
  today: DateKey,
  options?: {
    memberId?: string;
    weatherGlass?: WeatherGlass;
    onClock?: boolean;
  },
): ShiftClimateSeal[] {
  const memberId = options?.memberId;
  const cadence = weekdayCadenceMap(household, memberId);
  const typicalTips = median(observeTipShifts(household, memberId).map((row) => row.netTipsCents));
  const seals: ShiftClimateSeal[] = [];
  for (let offset = 0; offset < SHIFT_CLIMATE_DAYS; offset += 1) {
    const date = addDays(today, offset);
    const weekday = weekdaySunday0(date);
    const profile = cadence.get(weekday);
    const todayRow = offset === 0;
    const forcedOn = todayRow && options?.onClock === true;
    const on = forcedOn || Boolean(profile && profile.frequency >= SHIFT_OFF_FREQUENCY);
    const meal = on ? (profile?.meal ?? (forcedOn ? inferTipMeal({ hours: profile?.hours ?? 6 }) : null)) : null;
    const hours = on ? (profile?.hours || 6) : 0;
    const wet = todayRow && on && options?.weatherGlass === "rain";
    const outlook = on && hours > 0
      ? shiftOutlook(household, {
        date,
        hours,
        meal: meal ?? undefined,
        weatherGlass: todayRow ? options?.weatherGlass : undefined,
        memberId,
      })
      : null;
    const expected = outlook?.expectedTipCents ?? 0;
    const upside = outlook?.highTipCents ?? expected;
    const tone: ClimateTone = on ? climateTone(expected, typicalTips || expected, upside) : "empty";
    const weekdayName = WEEKDAY_LONG[weekday] ?? WEEKDAY_SHORT[weekday] ?? "Day";
    const caption = outlook
      ? `${weekdayName} ${meal}, nights like this ${formatCad(outlook.lowTipCents)}–${formatCad(outlook.highTipCents)} · projection`
      : on
        ? `${weekdayName} · not enough nights yet · projection`
        : `${weekdayName} off · days off are not a broken streak`;
    seals.push({
      date,
      weekdayShort: WEEKDAY_SHORT[weekday] ?? "Day",
      meal,
      mealMark: mealMark(meal),
      sub: climateSub({ today: todayRow, on, wet, tone, meal }),
      tone,
      wet,
      hours,
      caption,
      lowCents: outlook?.lowTipCents ?? null,
      highCents: outlook?.highTipCents ?? null,
    });
  }
  return seals;
}

export function shiftSaucerBoard(
  household: Household,
  today: DateKey,
  memberId?: string,
): ShiftSaucerBoard {
  const posted = postedShiftDates(household, memberId);
  const postedSet = new Set(posted);
  const latestDate = posted[posted.length - 1] ?? null;
  let streakCount = 0;
  if (latestDate) {
    let cursor = latestDate;
    while (postedSet.has(cursor)) {
      streakCount += 1;
      cursor = addDays(cursor, -1);
    }
  }
  const start = addDays(today, -(SHIFT_SAUCER_DAYS - 1));
  const days: ShiftSaucerDay[] = [];
  for (let offset = 0; offset < SHIFT_SAUCER_DAYS; offset += 1) {
    const date = addDays(start, offset);
    days.push({
      date,
      filled: postedSet.has(date),
      latest: latestDate === date,
    });
  }
  return {
    days,
    streakCount,
    latestDate,
    pill: streakCount > 0 ? `${streakCount} on the counter` : "none",
  };
}

export function shiftLivePreview(
  household: Household,
  today: DateKey,
  options?: {
    memberId?: string;
    weatherGlass?: WeatherGlass;
    now?: Date;
  },
): ShiftLivePreview | null {
  const memberId = options?.memberId;
  const punch = activeOpenShift(household.kitchen, memberId);
  if (!punch || punch.status === "cleared") return null;
  const cadence = weekdayCadenceMap(household, memberId).get(weekdaySunday0(today));
  const hours = cadence?.hours && cadence.hours > 0 ? cadence.hours : 6;
  const meal = inferTipMeal({ startedAt: punch.startedAt, hours });
  const span = previewClockSpan(punch.startedAt, hours);
  if (!span) return null;
  const outlook = shiftOutlook(household, {
    date: today,
    hours,
    meal,
    weatherGlass: options?.weatherGlass,
    memberId,
  });
  const range = outlook
    ? `${formatCad(outlook.lowTipCents)}–${formatCad(outlook.highTipCents)}`
    : "nights like this";
  return {
    hours,
    span,
    caption: `Nights like this · ${range} · projection, not posted`,
  };
}

export function shiftFloorOracle(
  household: Household,
  today: DateKey,
  memberId?: string,
): TipOracleResult | null {
  return runTipOracle(household, { memberId, today, horizonDays: SHIFT_SAUCER_DAYS, iterations: 400, seed: 137 });
}

export function shiftReportGlance(
  household: Household,
  today: DateKey,
  memberId: string,
  period: "month" | "all" = "month",
): ShiftReportGlance {
  const from = period === "month" ? `${today.slice(0, 7)}-01` : "1970-01-01" as DateKey;
  const report = workReportFacts(household, memberId, from, today);
  const owed = workOwedFacts(household, today, memberId);
  const oracle = shiftFloorOracle(household, today, memberId);
  const schedule = upcomingCadenceSchedule(household, today, { memberId, days: 7 });
  const sim = simulateTipSchedule(household, schedule, { memberId });
  const protectWeekdays = [...new Set(
    (sim?.rows ?? [])
      .filter((row) => row.recommendation === "protect-floor")
      .map((row) => WEEKDAY_SHORT[weekdaySunday0(row.date)] ?? "Day"),
  )];
  const milkRaw = oracle
    ? planTaxMilk(household, { tipCents: oracle.p50Cents, memberId, taxRateBps: 2500 })
    : null;
  const taxMilk = milkRaw && !("error" in milkRaw) ? milkRaw : null;
  return {
    shifts: report.count,
    hours: report.hours,
    takeHomeCents: report.takeHomeWagesCents + report.netTipsCents,
    protectWeekdays,
    protectLabel: protectWeekdays.length ? protectWeekdays.join(" · ") : "Even week",
    owed,
    oracle,
    taxMilk,
  };
}

export function shiftOracleChipTalk(
  household: Household,
  question: string,
  today: DateKey,
  memberId?: string,
  weatherGlass?: WeatherGlass,
): { spoken: string; lesson: string; fact: { label: string; value: string } | null } | null {
  const q = question.trim().toLowerCase().replace(/['’?]/g, "");
  if (!q) return null;
  const lesson = "Projection only. Confirm still posts. I never write the shift.";
  if (q === "tonight" || q.startsWith("tonight ")) {
    const seals = shiftClimateSeals(household, today, { memberId, weatherGlass, onClock: Boolean(activeOpenShift(household.kitchen, memberId)) });
    const todaySeal = seals[0];
    if (!todaySeal || todaySeal.tone === "empty") {
      return { spoken: "Tonight looks off the cadence. A day off is not a broken streak.", lesson, fact: null };
    }
    if (todaySeal.lowCents == null || todaySeal.highCents == null) {
      return { spoken: "Not enough posted nights yet for a tonight range.", lesson, fact: null };
    }
    return {
      spoken: `${todaySeal.caption}. Not posted.`,
      lesson,
      fact: { label: "Tonight · projection", value: `${formatCad(todaySeal.lowCents)}–${formatCad(todaySeal.highCents)}` },
    };
  }
  if (/protect or chase/.test(q) || /^protect\??$/.test(q) || /^chase\??$/.test(q)) {
    const glance = shiftReportGlance(household, today, memberId ?? household.members[0]?.id ?? "");
    const sim = simulateTipSchedule(
      household,
      upcomingCadenceSchedule(household, today, { memberId, days: 7 }),
      { memberId },
    );
    const chase = [...new Set((sim?.rows ?? []).filter((row) => row.recommendation === "chase-spike").map((row) => WEEKDAY_SHORT[weekdaySunday0(row.date)] ?? "Day"))];
    const spoken = chase.length && glance.protectWeekdays.length
      ? `Protect ${glance.protectLabel}. Chase ${chase.join(" · ")}. Advice, not a post.`
      : glance.protectWeekdays.length
        ? `Protect floor ${glance.protectLabel}. Advice from cadence, not a promise.`
        : chase.length
          ? `Chase ${chase.join(" · ")}. Advice, not a post.`
          : "This week looks even. Protect and chase are a spread, not a command.";
    return {
      spoken,
      lesson,
      fact: { label: "Protect floor · advice", value: glance.protectLabel },
    };
  }
  if (/tax milk/.test(q)) {
    const glance = shiftReportGlance(household, today, memberId ?? household.members[0]?.id ?? "");
    if (!glance.taxMilk) {
      return { spoken: "Not enough posted nights for tax milk. Educational set-aside, not CRA.", lesson, fact: null };
    }
    return {
      spoken: `On ${formatCad(glance.taxMilk.tipCents)} typical, set aside ${formatCad(glance.taxMilk.taxMilkCents)} tax milk — educational tip tax set-aside, not CRA.`,
      lesson,
      fact: { label: "Tax milk · educational", value: formatCad(glance.taxMilk.taxMilkCents) },
    };
  }
  return null;
}
