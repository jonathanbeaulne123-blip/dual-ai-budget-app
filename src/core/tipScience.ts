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
  monthKeyFromDateKey,
  shiftMonthKey,
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
  wagesCents: number;
  wagePerHourCents: number;
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
  frequency: number;
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

export type ShiftYearMonthRow = {
  monthKey: string;
  tipsP10Cents: number;
  tipsP50Cents: number;
  tipsP90Cents: number;
  wagesP10Cents: number;
  wagesP50Cents: number;
  wagesP90Cents: number;
  hoursP50: number;
};

export type ShiftYearSimulationResult = {
  sampleShifts: number;
  months: number;
  iterations: number;
  seed: number;
  tipsP10Cents: number;
  tipsP50Cents: number;
  tipsP90Cents: number;
  wagesP10Cents: number;
  wagesP50Cents: number;
  wagesP90Cents: number;
  totalP10Cents: number;
  totalP50Cents: number;
  totalP90Cents: number;
  byMonth: ShiftYearMonthRow[];
  assumptions: string[];
};

export type ShiftYearExplainResult = {
  sampleShifts: number;
  method: string[];
  limitations: string[];
  humanNextStep: string;
  assumptions: string[];
};

const DEFAULT_ITERATIONS = 2000;
const DEFAULT_TAX_BPS = 2500;
const MIN_BUCKET = 3;
const DEFAULT_YEAR_ITERATIONS = 800;

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
    const wagePerHourCents = Math.round(shift.wagesCents / shift.hours);
    return {
      shiftId: shift.id,
      date: shift.date,
      memberId: shift.memberId,
      weekday: weekdaySunday0(shift.date),
      meal: inferTipMeal(shift),
      hours: shift.hours,
      netTipsCents: shift.netTipsCents,
      tipPerHourCents,
      wagesCents: shift.wagesCents,
      wagePerHourCents,
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

type WeekdayProfile = {
  weekday: number;
  frequency: number;
  meal: TipMeal;
  hours: number;
};

function ratesForCached(
  observations: TipShiftObservation[],
  weekday: number,
  meal: TipMeal,
  cache: RateCache,
  field: "tipPerHourCents" | "wagePerHourCents" = "tipPerHourCents",
): number[] {
  const key = `${field}-${weekday}-${meal}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const exact = sortNumbers(
    observations.filter((row) => row.weekday === weekday && row.meal === meal).map((row) => row[field]),
  );
  if (exact.length >= MIN_BUCKET) {
    cache.set(key, exact);
    return exact;
  }
  const sameMeal = sortNumbers(
    observations.filter((row) => row.meal === meal).map((row) => row[field]),
  );
  if (sameMeal.length >= MIN_BUCKET) {
    cache.set(key, sameMeal);
    return sameMeal;
  }
  const all = sortNumbers(observations.map((row) => row[field]));
  const fallback = all.length ? all : [0];
  cache.set(key, fallback);
  return fallback;
}

function weekdayProfiles(observations: TipShiftObservation[]): WeekdayProfile[] {
  if (!observations.length) return [];
  const first = observations[0]!.date;
  const last = observations[observations.length - 1]!.date;
  const spanDays = Math.max(1, calendarDaysBetween(first, last) + 1);
  const spanWeeks = Math.max(1, spanDays / 7);
  const profiles: WeekdayProfile[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const rows = observations.filter((row) => row.weekday === weekday);
    if (!rows.length) continue;
    const mealCounts = { lunch: 0, dinner: 0 };
    for (const row of rows) mealCounts[row.meal] += 1;
    profiles.push({
      weekday,
      frequency: Math.min(2, rows.length / spanWeeks),
      meal: mealCounts.dinner >= mealCounts.lunch ? "dinner" : "lunch",
      hours: percentile(sortNumbers(rows.map((row) => row.hours)), 0.5) || rows[0]!.hours,
    });
  }
  return profiles.sort((a, b) => a.weekday - b.weekday);
}

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
  const today = options?.today ?? observations[observations.length - 1]!.date;
  const profiles = weekdayProfiles(observations);
  const rateCache: RateCache = new Map();
  const random = mulberry32(seed);
  const totals: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    let total = 0;
    for (let offset = 1; offset <= horizonDays; offset += 1) {
      const date = addDays(today, offset);
      const weekday = weekdaySunday0(date);
      const profile = profiles.find((row) => row.weekday === weekday);
      if (!profile) continue;
      // Frequency is per-week; convert to per-day chance for this exact weekday occurrence.
      const perDayChance = Math.min(1, profile.frequency);
      if (random() >= perDayChance) continue;
      // Occasional doubles on the same weekday historically (frequency > 1).
      const doubles = profile.frequency > 1 && random() < (profile.frequency - 1) ? 2 : 1;
      for (let n = 0; n < doubles; n += 1) {
        const rates = ratesForCached(observations, profile.weekday, profile.meal, rateCache);
        total += Math.round(pickSorted(rates, random) * profile.hours);
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
      "Monte Carlo walks each civil day from today and Bernoulli-samples whether that weekday works from historical frequency.",
      "Tip/hour is resampled from posted shifts by weekday and lunch/dinner; shift count varies across iterations.",
      "Corrected/reversed shifts are excluded; negative tip-out shifts remain in the sample.",
      "p10 is the simulated floor for the exact horizon — not a promise and not posted income.",
      "Emergency reserve covers the worst payroll-week streak of sub-p25 tip weeks, including empty weeks.",
      "Independent draws do not model correlated slow seasons; treat the band as a planning aid.",
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
  const similarExact = observations.filter((row) => row.weekday === weekday && row.meal === meal).length;
  const similarMeal = observations.filter((row) => row.meal === meal).length;
  const similar = similarExact >= MIN_BUCKET ? similarExact : similarMeal >= MIN_BUCKET ? similarMeal : observations.length;
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
  const observations = observeTipShifts(household, options?.memberId);
  const profiles = weekdayProfiles(observations);
  const frequencyByWeekday = new Map(profiles.map((row) => [row.weekday, row.frequency]));
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
    const frequency = Math.min(1, frequencyByWeekday.get(weekdaySunday0(slot.date)) ?? 0);
    const spread = Math.max(1, outlook.highTipCents - outlook.lowTipCents);
    const midGap = outlook.expectedTipCents - outlook.lowTipCents;
    const upGap = outlook.highTipCents - outlook.expectedTipCents;
    const protectFloorScore = Math.round((midGap / spread) * 100);
    const chaseSpikeScore = Math.round((upGap / spread) * 100);
    let recommendation: ScheduleSimRow["recommendation"] = "neutral";
    if (protectFloorScore >= chaseSpikeScore + 15) recommendation = "protect-floor";
    else if (chaseSpikeScore >= protectFloorScore + 15) recommendation = "chase-spike";
    rows.push({ ...outlook, frequency, protectFloorScore, chaseSpikeScore, recommendation });
  }
  if (!rows.length) return null;
  // Weight by historical weekday frequency so a once-a-month day does not count as certain.
  const weight = (row: ScheduleSimRow) => row.frequency;
  return {
    rows,
    totalExpectedCents: Math.round(rows.reduce((sum, row) => sum + row.expectedTipCents * weight(row), 0)),
    totalLowCents: Math.round(rows.reduce((sum, row) => sum + row.lowTipCents * weight(row), 0)),
    totalHighCents: Math.round(rows.reduce((sum, row) => sum + row.highTipCents * weight(row), 0)),
    assumptions: [
      "Schedule totals are probability-weighted by historical weekday frequency — not a guarantee those shifts happen.",
      "protect-floor vs chase-spike compares downside depth to upside depth inside each tip range.",
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
  if (tipCents <= 0) {
    return {
      error: `Net tips are ${tipCents < 0 ? "negative after tip-out" : "zero"}, so there is no tax milk (tip tax set-aside) to park.`,
    };
  }
  if (!observations.length) {
    return { error: "I need posted tip history before I can split tax milk — tip tax set-aside — and a buffer." };
  }
  const taxRateBps = Math.min(5000, Math.max(0, Math.round(input.taxRateBps ?? DEFAULT_TAX_BPS)));
  if (!Number.isFinite(tipCents) || !Number.isInteger(tipCents)) {
    return { error: "Tip amount must be whole CAD cents." };
  }
  const rates = sortNumbers(observations.map((row) => row.netTipsCents));
  const p50 = percentile(rates, 0.5);
  const p75 = percentile(rates, 0.75);
  const peak = tipCents >= p75;
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
      `Tax milk — tip tax set-aside — uses an educational ${(taxRateBps / 100).toFixed(0)}% rate — not CRA withholding or a filed return.`,
      "Buffer only appears on peak shifts (at/above historical tip p75) to smooth dry weeks.",
      "All three buckets are projections. Transfer drafts still require Confirm in Hearth.",
    ],
  };
}

/**
 * Near-term schedule preview: only weekdays that historically appear at least
 * ~every other week (frequency ≥ 0.5). Totals are still probability-weighted.
 */
export function upcomingCadenceSchedule(
  household: Household,
  today: DateKey,
  options?: { memberId?: string; days?: number },
): ScheduleSimShift[] {
  const observations = observeTipShifts(household, options?.memberId);
  const days = Math.min(14, Math.max(3, Math.round(options?.days ?? 7)));
  const profiles = weekdayProfiles(observations);
  const byWeekday = new Map(profiles.map((row) => [row.weekday, row]));
  const schedule: ScheduleSimShift[] = [];
  for (let offset = 1; offset <= days; offset += 1) {
    const date = addDays(today, offset);
    const profile = byWeekday.get(weekdaySunday0(date));
    if (!profile || profile.frequency < 0.35) continue;
    schedule.push({ date, hours: profile.hours, meal: profile.meal });
    if (profile.frequency >= 1.5) {
      schedule.push({ date, hours: profile.hours, meal: profile.meal });
    }
  }
  return schedule;
}

function monthKeyOf(date: DateKey): string {
  return monthKeyFromDateKey(date);
}

function forwardMonthKeys(today: DateKey, months: number): string[] {
  const first = monthKeyOf(addDays(today, 1));
  return Array.from({ length: months }, (_, index) => shiftMonthKey(first, index));
}

function daysInForwardMonths(today: DateKey, months: number): number {
  const keys = forwardMonthKeys(today, months);
  const last = keys[keys.length - 1]!;
  const endExclusive = `${shiftMonthKey(last, 1)}-01` as DateKey;
  return Math.max(1, calendarDaysBetween(addDays(today, 1), endExclusive));
}

/**
 * Seeded Monte Carlo for the next 6–12 civil months of tips + wages.
 * Same household + seed ⇒ same result. Never posts.
 */
export function runShiftYearSimulation(
  household: Household,
  options?: {
    memberId?: string;
    today?: DateKey;
    months?: number;
    iterations?: number;
    seed?: number;
  },
): ShiftYearSimulationResult | null {
  const observations = observeTipShifts(household, options?.memberId);
  if (observations.length < 4) return null;
  const months = Math.min(12, Math.max(6, Math.round(options?.months ?? 12)));
  const iterations = Math.min(2000, Math.max(200, Math.round(options?.iterations ?? DEFAULT_YEAR_ITERATIONS)));
  const seed = (options?.seed ?? 137) >>> 0;
  const today = options?.today ?? observations[observations.length - 1]!.date;
  const horizonDays = daysInForwardMonths(today, months);
  const profiles = weekdayProfiles(observations);
  if (!profiles.length) return null;
  const tipCache: RateCache = new Map();
  const wageCache: RateCache = new Map();
  const random = mulberry32(seed);

  const yearTips: number[] = [];
  const yearWages: number[] = [];
  const yearTotals: number[] = [];
  const monthTips = new Map<string, number[]>();
  const monthWages = new Map<string, number[]>();
  const monthHours = new Map<string, number[]>();

  for (let i = 0; i < iterations; i += 1) {
    let tipsTotal = 0;
    let wagesTotal = 0;
    const tipsByMonth = new Map<string, number>();
    const wagesByMonth = new Map<string, number>();
    const hoursByMonth = new Map<string, number>();

    for (let offset = 1; offset <= horizonDays; offset += 1) {
      const date = addDays(today, offset);
      const weekday = weekdaySunday0(date);
      const profile = profiles.find((row) => row.weekday === weekday);
      if (!profile) continue;
      const perDayChance = Math.min(1, profile.frequency);
      if (random() >= perDayChance) continue;
      const doubles = profile.frequency > 1 && random() < (profile.frequency - 1) ? 2 : 1;
      const month = monthKeyOf(date);
      for (let n = 0; n < doubles; n += 1) {
        const tipRates = ratesForCached(observations, profile.weekday, profile.meal, tipCache, "tipPerHourCents");
        const wageRates = ratesForCached(observations, profile.weekday, profile.meal, wageCache, "wagePerHourCents");
        const tips = Math.round(pickSorted(tipRates, random) * profile.hours);
        const wages = Math.round(pickSorted(wageRates, random) * profile.hours);
        tipsTotal += tips;
        wagesTotal += wages;
        tipsByMonth.set(month, (tipsByMonth.get(month) ?? 0) + tips);
        wagesByMonth.set(month, (wagesByMonth.get(month) ?? 0) + wages);
        hoursByMonth.set(month, (hoursByMonth.get(month) ?? 0) + profile.hours);
      }
    }

    yearTips.push(tipsTotal);
    yearWages.push(wagesTotal);
    yearTotals.push(tipsTotal + wagesTotal);
    for (const [month, cents] of tipsByMonth) {
      const bucket = monthTips.get(month) ?? [];
      bucket.push(cents);
      monthTips.set(month, bucket);
    }
    for (const [month, cents] of wagesByMonth) {
      const bucket = monthWages.get(month) ?? [];
      bucket.push(cents);
      monthWages.set(month, bucket);
    }
    for (const [month, hours] of hoursByMonth) {
      const bucket = monthHours.get(month) ?? [];
      bucket.push(hours);
      monthHours.set(month, bucket);
    }
  }

  const sortedTips = sortNumbers(yearTips);
  const sortedWages = sortNumbers(yearWages);
  const sortedTotals = sortNumbers(yearTotals);
  const monthKeys = forwardMonthKeys(today, months);
  const byMonth: ShiftYearMonthRow[] = monthKeys.map((monthKey) => {
    const tipsRaw = monthTips.get(monthKey) ?? [];
    const wagesRaw = monthWages.get(monthKey) ?? [];
    const hoursRaw = monthHours.get(monthKey) ?? [];
    const tips = sortNumbers([...tipsRaw, ...Array.from({ length: Math.max(0, iterations - tipsRaw.length) }, () => 0)]);
    const wages = sortNumbers([...wagesRaw, ...Array.from({ length: Math.max(0, iterations - wagesRaw.length) }, () => 0)]);
    const hours = sortNumbers([...hoursRaw, ...Array.from({ length: Math.max(0, iterations - hoursRaw.length) }, () => 0)]);
    return {
      monthKey,
      tipsP10Cents: percentile(tips, 0.1),
      tipsP50Cents: percentile(tips, 0.5),
      tipsP90Cents: percentile(tips, 0.9),
      wagesP10Cents: percentile(wages, 0.1),
      wagesP50Cents: percentile(wages, 0.5),
      wagesP90Cents: percentile(wages, 0.9),
      hoursP50: Math.round(percentile(hours, 0.5) * 4) / 4,
    };
  });

  return {
    sampleShifts: observations.length,
    months,
    iterations,
    seed,
    tipsP10Cents: percentile(sortedTips, 0.1),
    tipsP50Cents: percentile(sortedTips, 0.5),
    tipsP90Cents: percentile(sortedTips, 0.9),
    wagesP10Cents: percentile(sortedWages, 0.1),
    wagesP50Cents: percentile(sortedWages, 0.5),
    wagesP90Cents: percentile(sortedWages, 0.9),
    totalP10Cents: percentile(sortedTotals, 0.1),
    totalP50Cents: percentile(sortedTotals, 0.5),
    totalP90Cents: percentile(sortedTotals, 0.9),
    byMonth,
    assumptions: [
      `Monte Carlo walks the next ${months} civil months day by day and Bernoulli-samples whether each weekday works from historical frequency.`,
      "Tips and wages resample tip/hour and wage/hour independently from posted shifts by weekday × lunch/dinner.",
      "Wages use posted take-home wagesCents ÷ hours, not a second payroll engine.",
      "Corrected/reversed shifts are excluded; negative tip-out shifts remain in the sample.",
      "Season is not re-drawn month by month; correlated slow winters are under-modelled.",
      "p10/p50/p90 are simulation percentiles — not posted income, not CRA, not a promise.",
      "Confirm remains the only write path. This tool never posts shifts or transfers.",
    ],
  };
}

/** Teaching companion for the year sim — method, limits, next step. Never posts. */
export function explainShiftYearSimulation(
  household: Household,
  options?: { memberId?: string },
): ShiftYearExplainResult | null {
  const observations = observeTipShifts(household, options?.memberId);
  if (observations.length < 4) return null;
  const profiles = weekdayProfiles(observations);
  const weekdays = profiles.map((row) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][row.weekday]).join(", ");
  return {
    sampleShifts: observations.length,
    method: [
      "Fit weekday work frequency and typical hours from posted tip shifts.",
      "For each simulated day, decide whether that weekday works, then resample tip/hour and wage/hour from similar weekday × meal history.",
      "Sum tips and wages across 6–12 months; report p10/p50/p90 bands and monthly midpoints.",
      "Same household, seed, months, and iterations always reproduce the same numbers.",
    ],
    limitations: [
      "Independent daily draws do not fully model vacation blocks, illness, or a slow winter streak.",
      "Weather stamps improve outlook tools; the year sim uses cadence history, not live forecasts.",
      "Wage rates follow posted take-home history and ignore future raise/role changes unless those shifts are posted.",
      "A Python sandbox is gated for later open-ended science; this engine stays deterministic TypeScript.",
    ],
    humanNextStep: "Ask shift_year_simulation for the numbers, then decide in Hearth whether any budget or jar plan should change — Confirm still posts.",
    assumptions: [
      `${observations.length} posted shifts across weekdays ${weekdays || "none"} power the fit.`,
      "All outputs are projections. Nothing writes the journal.",
    ],
  };
}
