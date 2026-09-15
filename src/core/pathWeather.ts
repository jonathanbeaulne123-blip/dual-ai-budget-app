import { addDays, isValidDateKey, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { HEALTH_GROUP_ID } from "./appointments.ts";
import { prepareFundHorizon } from "./fundHorizon.ts";
import { monthObligations, type MonthObligation } from "./monthObligations.ts";
import { paydayTicks } from "./monthSpread.ts";
import { projectCadence } from "./recurrence.ts";
import type { Household } from "./types.ts";

/**
 * Our Path weather read-model. Pure: the Calendar's household-scope bills and
 * paydays, and the Fund horizon's covered and misty stretches, become weather
 * for the island. Weights are 0–1 shapes, never cents; labels and reasons never
 * carry an amount. It reads accepted facts only and never throws.
 *
 * Sources, reused rather than invented:
 * - Bills: `monthObligations` rows dated today or later — the same rows the
 *   island's weather layer reads today.
 * - Paydays: `paydayTicks` (the Fund custodian's pay clock, as the Calendar
 *   metronome and `agenda.nextPayday` household view read it) plus active
 *   `paycheck` recurrences on non-personal accounts (as `agenda.nextPayday`).
 * - Covered and mist: `prepareFundHorizon(..., { purpose: "plan" })`.
 */

export type PathWeatherKind = "cloud" | "storm" | "sunrise" | "sunlit" | "mist" | "clear";
export type PathWeatherDay = {
  date: DateKey;
  kind: PathWeatherKind;
  label: string;
  why: string;
  /** 0–1 shape only, never cents. */
  weight: number;
  sourceId?: string;
};
export type PathWeather = {
  asOf: DateKey;
  through: DateKey;
  days: PathWeatherDay[];
  forecast: "clear" | "mist" | "unavailable";
  mistWhy: string[];
  covered: { from: DateKey; to: DateKey }[];
};

export const PATH_WEATHER_MAX_DAYS = 31;
export const PATH_WEATHER_STORM_SHARE = 0.4;
const NOT_READY = "The forecast isn't available yet.";
const GENERIC_BILL = "A bill";
const KIND_ORDER: Record<PathWeatherKind, number> = { sunrise: 0, mist: 1, storm: 2, cloud: 3, sunlit: 4, clear: 5 };
const shape = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

/** A label may never carry money: no `$`, no digit runs. Fall back to a plain name. */
function safeLabel(text: string | null | undefined, fallback = GENERIC_BILL): string {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || /\$|\d{2,}/.test(trimmed)) return fallback;
  return trimmed.slice(0, 60);
}

function isHealthCategory(household: Household, subcategoryId: string | null | undefined): boolean {
  if (!subcategoryId) return false;
  const category = household.categories.find((row) => row.id === subcategoryId);
  return Boolean(category && (category.id === HEALTH_GROUP_ID || category.parentId === HEALTH_GROUP_ID));
}

type SafeRow = MonthObligation & { safeLabel: string };

/** Household-scope rows only; personal rows never surface, health rows stay unnamed. */
function shareableRow(household: Household, row: MonthObligation): SafeRow | null {
  if (row.recurrenceId) {
    const recurrence = household.recurrences.find((item) => item.id === row.recurrenceId);
    const account = recurrence ? household.accounts.find((item) => item.id === recurrence.accountId) : undefined;
    if (account?.scope === "personal") return null;
    if (recurrence && isHealthCategory(household, recurrence.subcategoryId)) return { ...row, safeLabel: GENERIC_BILL };
  }
  if (row.transactionId) {
    const transaction = household.transactions.find((item) => item.id === row.transactionId);
    if (transaction?.visibility === "personal") return null;
    if (transaction && isHealthCategory(household, transaction.subcategoryId)) return { ...row, safeLabel: GENERIC_BILL };
    if (!transaction && row.source === "posted") return null;
  }
  return { ...row, safeLabel: safeLabel(row.label) };
}

function monthKeysBetween(from: DateKey, through: DateKey): string[] {
  const keys = new Set<string>();
  for (let date = from; date <= through; date = addDays(date, 1)) keys.add(monthKeyFromDateKey(date));
  return [...keys];
}

function paydayDates(household: Household, from: DateKey, through: DateKey, monthKeys: string[]): Map<DateKey, string> {
  const dates = new Map<DateKey, string>();
  for (const key of monthKeys) {
    for (const tick of paydayTicks(household, key)) {
      if (tick.date >= from && tick.date <= through && !dates.has(tick.date)) dates.set(tick.date, `payday:${tick.date}`);
    }
  }
  for (const row of household.recurrences) {
    if (!row.active || row.kind !== "paycheck") continue;
    const account = household.accounts.find((item) => item.id === row.accountId);
    if (!account || account.scope === "personal") continue;
    for (const date of projectCadence(row.nextDate, row.cadence, from, through)) {
      if (!dates.has(date)) dates.set(date, `payday:${row.id}:${date}`);
    }
  }
  return dates;
}

function unavailable(asOf: DateKey, through: DateKey, days: PathWeatherDay[], mistWhy: string[]): PathWeather {
  return { asOf, through, days, forecast: "unavailable", mistWhy, covered: [] };
}

function fillAndSort(days: PathWeatherDay[], from: DateKey, through: DateKey, covered: { from: DateKey; to: DateKey }[]): PathWeatherDay[] {
  const busy = new Set(days.map((day) => day.date));
  const out = [...days];
  for (let date = from; date <= through; date = addDays(date, 1)) {
    if (busy.has(date)) continue;
    const sunlit = covered.some((range) => date >= range.from && date <= range.to);
    out.push(sunlit
      ? { date, kind: "sunlit", label: "Covered", why: "Everything due by here is already covered.", weight: 1 }
      : { date, kind: "clear", label: "Clear", why: "Nothing is due on this day.", weight: 0 });
  }
  return out.sort((left, right) => left.date.localeCompare(right.date)
    || KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
    || (left.sourceId ?? "").localeCompare(right.sourceId ?? ""));
}

export function pathWeather(household: Household, today: DateKey, options?: { days?: number }): PathWeather {
  const requested = Math.floor(Number(options?.days ?? PATH_WEATHER_MAX_DAYS));
  const span = Number.isFinite(requested) ? Math.min(PATH_WEATHER_MAX_DAYS, Math.max(1, requested)) : PATH_WEATHER_MAX_DAYS;
  if (typeof today !== "string" || !isValidDateKey(today)) return unavailable(today, today, [], [NOT_READY]);
  const through = addDays(today, span - 1);

  let rows: SafeRow[];
  let paydays: Map<DateKey, string>;
  try {
    const monthKeys = monthKeysBetween(today, through);
    const seen = new Set<string>();
    rows = monthKeys
      .flatMap((key) => monthObligations(household, key, today).rows)
      .filter((row) => row.date >= today && row.date <= through && !seen.has(row.id) && seen.add(row.id))
      .flatMap((row) => shareableRow(household, row) ?? []);
    paydays = paydayDates(household, today, through, monthKeys);
  } catch {
    return unavailable(today, through, [], [NOT_READY]);
  }

  const days: PathWeatherDay[] = [];
  const totalCents = rows.reduce((sum, row) => sum + Math.max(0, row.amountCents), 0);
  for (const row of rows) {
    const weight = totalCents > 0 ? shape(Math.max(0, row.amountCents) / totalCents) : 0;
    const storm = weight >= PATH_WEATHER_STORM_SHARE;
    days.push({
      date: row.date,
      kind: storm ? "storm" : "cloud",
      label: row.safeLabel,
      why: storm
        ? `${row.safeLabel} is one of the heaviest things due in this stretch.`
        : `${row.safeLabel} is due.`,
      weight,
      sourceId: row.id,
    });
  }
  for (const [date, sourceId] of paydays) {
    days.push({ date, kind: "sunrise", label: "Payday", why: "A payday is on the calendar — the sun comes up.", weight: 1, sourceId });
  }

  let horizon: ReturnType<typeof prepareFundHorizon>;
  try {
    horizon = prepareFundHorizon(household, today, through, { purpose: "plan" });
  } catch {
    return unavailable(today, through, fillAndSort(days, today, through, []), [NOT_READY]);
  }
  if (horizon.kind === "unavailable") {
    const reasons = horizon.reasons.map((reason) => reason.message).filter(Boolean);
    return unavailable(today, through, fillAndSort(days, today, through, []), reasons.length ? reasons : [NOT_READY]);
  }

  const buffers = new Map(horizon.monthlyBuffers.map((row) => [row.monthKey, row.bufferCents]));
  const bufferFor = (date: DateKey) => buffers.get(monthKeyFromDateKey(date)) ?? 0;
  const byDate = new Map<DateKey, typeof horizon.future[number][]>();
  for (const point of horizon.future) {
    const list = byDate.get(point.date) ?? [];
    list.push(point);
    byDate.set(point.date, list);
  }

  const covered: { from: DateKey; to: DateKey }[] = [];
  const misty: { from: DateKey; to: DateKey }[] = [];
  let balance = horizon.anchorCents;
  let firstDip: typeof horizon.future[number] | null = null;
  for (let date = today; date <= through; date = addDays(date, 1)) {
    const points = byDate.get(date) ?? [];
    if (points.length) balance = points[points.length - 1]!.balanceCents;
    const buffer = bufferFor(date);
    const target = balance >= buffer ? covered : misty;
    const last = target[target.length - 1];
    if (last && last.to === addDays(date, -1)) last.to = date;
    else target.push({ from: date, to: date });
    if (balance < buffer && !firstDip) {
      firstDip = points.find((point) => point.kind === "obligation" && point.balanceCents < buffer) ?? null;
    }
  }

  if (!misty.length) {
    return { asOf: today, through, days: fillAndSort(days, today, through, covered), forecast: "clear", mistWhy: [], covered };
  }

  const firstRun = misty[0]!;
  const labels = new Map(rows.map((row) => [row.id, row.safeLabel]));
  const dipLabel = firstDip?.sourceId ? labels.get(firstDip.sourceId) ?? GENERIC_BILL : null;
  const dipSentence = dipLabel
    ? `The forecast turns misty when ${dipLabel} is due and the Fund dips below its cushion.`
    : "The Fund already sits below its cushion today.";
  const mistDays = misty.reduce((sum, run) => sum + Math.round((Date.parse(`${run.to}T00:00:00Z`) - Date.parse(`${run.from}T00:00:00Z`)) / 86_400_000) + 1, 0);
  days.push({
    date: firstRun.from,
    kind: "mist",
    label: "Mist ahead",
    why: dipSentence,
    weight: shape(mistDays / span),
    sourceId: firstDip?.sourceId ?? undefined,
  });
  return {
    asOf: today,
    through,
    days: fillAndSort(days, today, through, covered),
    forecast: "mist",
    mistWhy: [...horizon.assumptions, dipSentence],
    covered,
  };
}
