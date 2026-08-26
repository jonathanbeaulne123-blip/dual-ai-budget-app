/**
 * Hercules Shift Oracle — deterministic tipped-income science (D-137).
 *
 * All outputs are projections. They never post, never invent journal rows, and
 * never claim CRA/IRS withholding truth. Confirm remains the only write path.
 */
import {
  addDays,
  calendarDaysBetween,
  hourInToronto,
  kitchenSeason,
  weekdaySunday0,
  type DateKey,
} from "./calendar.ts";
import { workShiftIsReversed, workWeekStart } from "./work.ts";
import type { Household, Shift } from "./types.ts";
import type { WeatherGlass } from "./weather.ts";

export type TipMeal = "lunch" | "dinner";

export type TipShiftObservation = {
  shiftId: string;
  date: DateKey;
  memberId: string;
  weekday: number;
  meal: TipMeal;
  hours: number;
  netTipsCents: number;
  tipPerHourCents: number;
  season: ReturnType<typeof kitchenSeason>;
};

export type TipOracleResult = {
  sampleShifts: number;
  iterations: number;
  seed: number;
  horizonDays: number;
  p10Cents: number;
  p50Cents: number;
  p90Cents: number;
  safeBaselineCents: number;
  emergencyReserveCents: number;
  longestDryWeeks: number;
  assumptions: string[];
};

export type ShiftOutlookResult = {
  date: DateKey;
  hours: number;
  meal: TipMeal;
  weatherGlass: WeatherGlass | "season";
  expectedTipCents: number;
  lowTipCents: number;
  highTipCents: number;
  tipPerHourCents: number;
  similarShifts: number;
  weatherFactor: number;
  assumptions: string[];
};

export type ScheduleSimShift = {
  date: DateKey;
  hours: number;
  meal?: TipMeal;
  weatherGlass?: WeatherGlass;
};

export type ScheduleSimRow = ShiftOutlookResult & {
  protectFloorScore: number;
  chaseSpikeScore: number;
  recommendation: "protect-floor" | "chase-spike" | "neutral";
};

export type ScheduleSimResult = {
  rows: ScheduleSimRow[];
  totalExpectedCents: number;
  totalLowCents: number;
  totalHighCents: number;
  assumptions: string[];
};

export type TaxMilkPlanResult = {
  tipCents: number;
  taxMilkCents: number;
  bufferCents: number;
  leftoverCents: number;
  taxRateBps: number;
  peak: boolean;
  assumptions: string[];
};

const DEFAULT_ITERATIONS = 2000;
const DEFAULT_TAX_BPS = 2500;
const MIN_BUCKET = 3;

/** Seeded PRNG — same seed + same sorted observations ⇒ same Monte Carlo path. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function inferTipMeal(shift: Pick<Shift, "startedAt" | "hours">): TipMeal {
  if (shift.startedAt) {
    const instant = new Date(shift.startedAt);
    if (!Number.isNaN(instant.getTime())) {
      return hourInToronto(instant) < 15 ? "lunch" : "dinner";
    }
  }
  // Short mid-day posts without punch metadata default to lunch; long ones dinner.
  return shift.hours > 0 && shift.hours < 5.5 ? "lunch" : "dinner";
}

export function activeTipShifts(household: Household, memberId?: string): Shift[] {
  return household.shifts
    .filter((shift) => {
      if (memberId && shift.memberId !== memberId) return false;
      if (workShiftIsReversed(household, shift)) return false;
      return shift.hours > 0;
    })
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function observeTipShifts(household: Household, memberId?: string): TipShiftObservation[] {
  return activeTipShifts(household, memberId).map((shift) => {
    const tipPerHourCents = Math.round(shift.netTipsCents / shift.hours);
    return {
      shiftId: shift.id,
      date: shift.date,
      memberId: shift.memberId,
      weekday: weekdaySunday0(shift.date),
      meal: inferTipMeal(shift),
      hours: shift.hours,
      netTipsCents: shift.netTipsCents,
      tipPerHourCents,
      season: kitchenSeason(shift.date),
    };
  });
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low]!;
  const weight = rank - low;
  return Math.round(sorted[low]! * (1 - weight) + sorted[high]! * weight);
}

function sortNumbers(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function pickSorted(values: number[], random: () => number): number {
  if (!values.length) return 0;
  return values[Math.floor(random() * values.length) % values.length]!;
}

export function weatherTipFactor(glass: WeatherGlass | "season" | undefined, season: ReturnType<typeof kitchenSeason>): number {
  // Soft priors only — labelled assumptions until Confirm stamps live weather.
  // Season and glass multiply so January rain is not treated as patio rain.
  let factor = 1;
  if (season === "patio") factor *= 1.04;
  else if (season === "ruff") factor *= 0.94;
  if (glass === "rain") factor *= season === "patio" ? 0.88 : 1.04;
  else if (glass === "snow") factor *= 0.9;
  else if (glass === "humid") factor *= 1.06;
  else if (glass === "night") factor *= 1.02;
  else if (glass === "clear") factor *= 1.05;
  return Math.round(factor * 1000) / 1000;
}

type RateCache = Map<string, number[]>;

function ratesForCached(
  observations: TipShiftObservation[],
  weekday: number,
  meal: TipMeal,
  cache: RateCache,
): number[] {
  const key = `${weekday}-${meal}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const exact = sortNumbers(
    observations.filter((row) => row.weekday === weekday && row.meal === meal).map((row) => row.tipPerHourCents),
  );
  if (exact.length >= MIN_BUCKET) {
    cache.set(key, exact);
    return exact;
  }
  const sameMeal = sortNumbers(
    observations.filter((row) => row.meal === meal).map((row) => row.tipPerHourCents),
  );
  if (sameMeal.length >= MIN_BUCKET) {
    cache.set(key, sameMeal);
    return sameMeal;
  }
  const all = sortNumbers(observations.map((row) => row.tipPerHourCents));
  const fallback = all.length ? all : [0];
  cache.set(key, fallback);
  return fallback;
}

/**
 * Typical weekly cadence: expected count of shifts for each weekday, scaled by
 * how often that weekday appeared across the full observation calendar span —
 * not across only the weeks that already contain that weekday.
 */
function hoursTemplate(observations: TipShiftObservation[]): Array<{ weekday: number; meal: TipMeal; hours: number }> {
  if (!observations.length) return [];
  const first = observations[0]!.date;
  const last = observations[observations.length - 1]!.date;
  const spanDays = Math.max(1, calendarDaysBetween(first, last) + 1);
  const spanWeeks = Math.max(1, spanDays / 7);

  const byWeekday = new Map<number, TipShiftObservation[]>();
  for (const row of observations) {
    const list = byWeekday.get(row.weekday) ?? [];
    list.push(row);
    byWeekday.set(row.weekday, list);
  }

  const template: Array<{ weekday: number; meal: TipMeal; hours: number }> = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const rows = byWeekday.get(weekday) ?? [];
    if (!rows.length) continue;
    const frequency = rows.length / spanWeeks;
    // Bernoulli per simulated week: include the weekday with probability = frequency,
    // represented here as an expected fractional slot rounded to 0/1 for the template,
    // plus a second slot only when history clearly shows doubles.
    const expected = Math.min(2, Math.round(frequency * 1000) / 1000);
    if (expected < 0.35) continue;
    const slots = expected >= 1.5 ? 2 : 1;
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.shiftId.localeCompare(b.shiftId));
    const medianHours = percentile(sortNumbers(sorted.map((row) => row.hours)), 0.5) || sorted[0]!.hours;
    const mealCounts = { lunch: 0, dinner: 0 };
    for (const row of sorted) mealCounts[row.meal] += 1;
    const meal: TipMeal = mealCounts.dinner >= mealCounts.lunch ? "dinner" : "lunch";
    for (let i = 0; i < slots; i += 1) {
      template.push({ weekday, meal, hours: medianHours });
    }
  }
  if (!template.length) {
    const sample = observations[observations.length - 1]!;
    template.push({ weekday: sample.weekday, meal: sample.meal, hours: sample.hours });
  }
  return template.sort((a, b) => a.weekday - b.weekday || a.meal.localeCompare(b.meal));
}

/** Payroll-week tip totals including empty weeks inside the observation span. */
function weeklyTotals(observations: TipShiftObservation[]): Array<{ weekStart: DateKey; cents: number }> {
  if (!observations.length) return [];
  const first = workWeekStart(observations[0]!.date);
  const last = workWeekStart(observations[observations.length - 1]!.date);
  const weeks = new Map<string, number>();
  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 7)) {
    weeks.set(cursor, 0);
  }
  for (const row of observations) {
    const start = workWeekStart(row.date);
    weeks.set(start, (weeks.get(start) ?? 0) + row.netTipsCents);
  }
  return [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, cents]) => ({ weekStart: weekStart as DateKey, cents }));
}

function dryStreakReserve(weekly: Array<{ cents: number }>, weeklyP50: number): { reserveCents: number; longestDryWeeks: number } {
  if (!weekly.length) return { reserveCents: 0, longestDryWeeks: 0 };
  const floor = percentile(sortNumbers(weekly.map((row) => row.cents)), 0.25);
  let longest = 0;
  let current = 0;
  let worstShortfall = 0;
  let running = 0;
  for (const week of weekly) {
    if (week.cents <= floor) {
      current += 1;
      running += Math.max(0, weeklyP50 - week.cents);
      longest = Math.max(longest, current);
      worstShortfall = Math.max(worstShortfall, running);
    } else {
      current = 0;
      running = 0;
    }
  }
  return { reserveCents: worstShortfall, longestDryWeeks: longest };
}

export function runTipOracle(
  household: Household,
  options?: {
    memberId?: string;
    today?: DateKey;
    iterations?: number;
    seed?: number;
    horizonDays?: number;
  },
): TipOracleResult | null {
  const observations = observeTipShifts(household, options?.memberId);
  if (observations.length < 4) return null;
  const iterations = Math.min(5000, Math.max(200, Math.round(options?.iterations ?? DEFAULT_ITERATIONS)));
  const seed = (options?.seed ?? 137) >>> 0;
  const horizonDays = Math.min(62, Math.max(14, Math.round(options?.horizonDays ?? 28)));
  // Exact day count via floor(days/7) weeks + remaining day fraction of a typical week.
  const fullWeeks = Math.floor(horizonDays / 7);
  const remainderDays = horizonDays % 7;
  const template = hoursTemplate(observations);
  const rateCache: RateCache = new Map();
  const random = mulberry32(seed);
  const totals: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    let total = 0;
    for (let week = 0; week < fullWeeks; week += 1) {
      for (const slot of template) {
        const rates = ratesForCached(observations, slot.weekday, slot.meal, rateCache);
        total += Math.round(pickSorted(rates, random) * slot.hours);
      }
    }
    if (remainderDays > 0) {
      const partial = template.filter((slot) => slot.weekday < remainderDays);
      for (const slot of partial) {
        const rates = ratesForCached(observations, slot.weekday, slot.meal, rateCache);
        total += Math.round(pickSorted(rates, random) * slot.hours);
      }
    }
    totals.push(total);
  }

  const sorted = sortNumbers(totals);
  const p10 = percentile(sorted, 0.1);
  const p50 = percentile(sorted, 0.5);
  const p90 = percentile(sorted, 0.9);
  const weekly = weeklyTotals(observations);
  const weeklyP50 = percentile(sortNumbers(weekly.map((row) => row.cents)), 0.5);
  const dry = dryStreakReserve(weekly, weeklyP50);
  return {
    sampleShifts: observations.length,
    iterations,
    seed,
    horizonDays,
    p10Cents: p10,
    p50Cents: p50,
    p90Cents: p90,
    safeBaselineCents: p10,
    emergencyReserveCents: dry.reserveCents,
    longestDryWeeks: dry.longestDryWeeks,
    assumptions: [
      "Monte Carlo resamples tip/hour from posted shifts by weekday and lunch/dinner.",
      "Corrected/reversed shifts are excluded; negative tip-out shifts remain in the sample.",
      "Cadence uses each weekday's frequency across the full observation span, not only weeks that already contain it.",
      "p10 is the simulated floor for the exact horizon day count — not a promise and not posted income.",
      "Emergency reserve covers the worst payroll-week streak of sub-p25 tip weeks, including empty weeks.",
      "Independent draws narrow the band; correlated slow seasons are not yet modelled.",
      "No weather stamp is required for the month oracle; season/weather enter shift outlook only.",
    ],
  };
}

export function shiftOutlook(
  household: Household,
  input: {
    date: DateKey;
    hours: number;
    meal?: TipMeal;
    weatherGlass?: WeatherGlass;
    memberId?: string;
  },
): ShiftOutlookResult | null {
  const observations = observeTipShifts(household, input.memberId);
  if (!observations.length || !(input.hours > 0)) return null;
  const meal = input.meal ?? (input.hours < 5.5 ? "lunch" : "dinner");
  const weekday = weekdaySunday0(input.date);
  const rateCache: RateCache = new Map();
  const rates = ratesForCached(observations, weekday, meal, rateCache);
  const season = kitchenSeason(input.date);
  const weatherGlass = input.weatherGlass ?? "season";
  const factor = weatherTipFactor(weatherGlass === "season" ? undefined : weatherGlass, season);
  const tipPerHour = Math.round(percentile(rates, 0.5) * factor);
  const lowPerHour = Math.round(percentile(rates, 0.1) * factor);
  const highPerHour = Math.round(percentile(rates, 0.9) * factor);
  const similar = observations.filter((row) => row.weekday === weekday && row.meal === meal).length
    || observations.filter((row) => row.meal === meal).length
    || observations.length;
  return {
    date: input.date,
    hours: input.hours,
    meal,
    weatherGlass,
    expectedTipCents: Math.round(tipPerHour * input.hours),
    lowTipCents: Math.round(lowPerHour * input.hours),
    highTipCents: Math.round(highPerHour * input.hours),
    tipPerHourCents: tipPerHour,
    similarShifts: similar,
    weatherFactor: factor,
    assumptions: [
      "Outlook resamples tip/hour from similar posted weekday × meal shifts.",
      `Weather/season factor ${factor.toFixed(2)} multiplies soft priors; Confirm weather stamps are a follow-up.`,
      "Hours means worked hours on the timesheet, not paid-break hours.",
      "Ranges are projections, not booked income.",
    ],
  };
}

export function simulateTipSchedule(
  household: Household,
  schedule: ScheduleSimShift[],
  options?: { memberId?: string },
): ScheduleSimResult | null {
  if (!schedule.length) return null;
  const rows: ScheduleSimRow[] = [];
  for (const slot of schedule.slice(0, 14)) {
    const outlook = shiftOutlook(household, {
      date: slot.date,
      hours: slot.hours,
      meal: slot.meal,
      weatherGlass: slot.weatherGlass,
      memberId: options?.memberId,
    });
    if (!outlook) continue;
    // Both scores are within-spread shares so they are comparable.
    const spread = Math.max(1, outlook.highTipCents - outlook.lowTipCents);
    const midGap = outlook.expectedTipCents - outlook.lowTipCents;
    const upGap = outlook.highTipCents - outlook.expectedTipCents;
    const protectFloorScore = Math.round((midGap / spread) * 100);
    const chaseSpikeScore = Math.round((upGap / spread) * 100);
    let recommendation: ScheduleSimRow["recommendation"] = "neutral";
    if (protectFloorScore >= chaseSpikeScore + 15) recommendation = "protect-floor";
    else if (chaseSpikeScore >= protectFloorScore + 15) recommendation = "chase-spike";
    rows.push({ ...outlook, protectFloorScore, chaseSpikeScore, recommendation });
  }
  if (!rows.length) return null;
  return {
    rows,
    totalExpectedCents: rows.reduce((sum, row) => sum + row.expectedTipCents, 0),
    totalLowCents: rows.reduce((sum, row) => sum + row.lowTipCents, 0),
    totalHighCents: rows.reduce((sum, row) => sum + row.highTipCents, 0),
    assumptions: [
      "Schedule simulation ranks advice only — it never books or declines a shift.",
      "protect-floor vs chase-spike compares downside depth to upside depth inside the tip range.",
      ...rows[0]!.assumptions,
    ],
  };
}

export function planTaxMilk(
  household: Household,
  input: {
    tipCents?: number;
    shiftId?: string;
    memberId?: string;
    taxRateBps?: number;
  },
): TaxMilkPlanResult | null | { error: string } {
  const observations = observeTipShifts(household, input.memberId);
  let tipCents = input.tipCents;
  if (input.shiftId) {
    const shift = activeTipShifts(household, input.memberId).find((row) => row.id === input.shiftId);
    if (!shift) return { error: `I cannot match shift “${input.shiftId}”.` };
    tipCents = shift.netTipsCents;
  }
  if (tipCents == null) {
    const latest = observations[observations.length - 1];
    tipCents = latest?.netTipsCents;
  }
  if (tipCents == null) return null;
  const taxRateBps = Math.min(5000, Math.max(0, Math.round(input.taxRateBps ?? DEFAULT_TAX_BPS)));
  const rates = sortNumbers(observations.map((row) => row.netTipsCents));
  const p50 = percentile(rates, 0.5);
  const p75 = percentile(rates, 0.75);
  const peak = tipCents >= p75 && tipCents > 0;
  const taxMilkCents = Math.round((tipCents * taxRateBps) / 10_000);
  const surplus = Math.max(0, tipCents - Math.max(p50, taxMilkCents));
  const bufferCents = peak ? Math.round(surplus * 0.5) : 0;
  const leftoverCents = Math.max(0, tipCents - taxMilkCents - bufferCents);
  return {
    tipCents,
    taxMilkCents,
    bufferCents,
    leftoverCents,
    taxRateBps,
    peak,
    assumptions: [
      `Tax milk uses an educational ${(taxRateBps / 100).toFixed(0)}% rate — not CRA withholding or a filed return.`,
      "Buffer only appears on peak shifts (at/above historical tip p75) to smooth dry weeks.",
      "All three buckets are projections. Transfer drafts still require Confirm in Hearth.",
    ],
  };
}

/** Build a near-term schedule from recent cadence when the caller does not supply dates. */
export function upcomingCadenceSchedule(
  household: Household,
  today: DateKey,
  options?: { memberId?: string; days?: number },
): ScheduleSimShift[] {
  const observations = observeTipShifts(household, options?.memberId);
  const days = Math.min(14, Math.max(3, Math.round(options?.days ?? 7)));
  const template = hoursTemplate(observations);
  const byWeekday = new Map<number, Array<{ meal: TipMeal; hours: number }>>();
  for (const slot of template) {
    const list = byWeekday.get(slot.weekday) ?? [];
    list.push({ meal: slot.meal, hours: slot.hours });
    byWeekday.set(slot.weekday, list);
  }
  const schedule: ScheduleSimShift[] = [];
  for (let offset = 1; offset <= days; offset += 1) {
    const date = addDays(today, offset);
    const weekday = weekdaySunday0(date);
    const slots = byWeekday.get(weekday) ?? [];
    for (const slot of slots.slice(0, 2)) {
      schedule.push({ date, hours: slot.hours, meal: slot.meal });
    }
  }
  return schedule;
}
