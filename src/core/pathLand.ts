import { addDays, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import type { Household } from "./types.ts";
import { shapeWeeklyDocumentStamps } from "./weeklyDocumentStamp.ts";

/**
 * Our Path permanent land (Jonathan's step 10). Pure: household-scope Books closes
 * and weekly page stamps (D-194) in, one row per month out. Months with closed
 * books become permanent land; each stamped week lights a lamp. Never amounts.
 *
 * A week belongs to the month its Sunday start falls in (the week the stamp
 * names), so every Toronto Sunday-start week is counted in exactly one month.
 */

export type PathLandMonth = {
  key: string;
  closed: boolean;
  closedAt: string | null;
  /** Sunday-start Toronto weeks (their `weekStart` dates) in this month with at least one stamp. */
  stampedWeeks: string[];
  /** 0–1: stamped weeks / weeks in month. */
  stampShape: number;
  why: string;
};

const clamp = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;

/** Sunday-start weeks whose start falls in `monthKey`. */
function weeksInMonth(monthKey: string): number {
  let day = `${monthKey}-01`;
  let count = 0;
  while (day.startsWith(monthKey)) {
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 0) count += 1;
    day = addDays(day, 1);
  }
  return count;
}

export function pathLand(household: Household, today: DateKey): Record<string, PathLandMonth> {
  const nowMonth = monthKeyFromDateKey(today);
  const closes = new Map<string, string>();
  for (const row of household.kitchen?.books?.closedMonths ?? []) {
    if (!row || typeof row.monthKey !== "string" || !/^\d{4}-\d{2}$/.test(row.monthKey) || row.monthKey > nowMonth) continue;
    const old = closes.get(row.monthKey);
    if (old === undefined || row.closedAt < old) closes.set(row.monthKey, row.closedAt);
  }
  const stamped = new Map<string, Set<string>>();
  let stamps: ReturnType<typeof shapeWeeklyDocumentStamps> = [];
  try { stamps = shapeWeeklyDocumentStamps(household.weeklyDocumentStamps, household.members); } catch { stamps = []; }
  for (const stamp of stamps) {
    if (stamp.weekStart > today) continue;
    const key = stamp.weekStart.slice(0, 7);
    stamped.set(key, (stamped.get(key) ?? new Set()).add(stamp.weekStart));
  }

  const out: Record<string, PathLandMonth> = {};
  for (const key of [...new Set([...closes.keys(), ...stamped.keys()])].sort()) {
    const closedAt = closes.get(key) ?? null;
    const weeks = [...(stamped.get(key) ?? [])].sort();
    const total = weeksInMonth(key);
    const why: string[] = [];
    if (closedAt) why.push("Books closed");
    if (weeks.length) why.push(`Stamped ${weeks.length} of ${total} week${total === 1 ? "" : "s"}`);
    out[key] = {
      key,
      closed: closedAt !== null,
      closedAt,
      stampedWeeks: weeks,
      stampShape: total ? clamp(weeks.length / total) : 0,
      why: why.join(" · "),
    };
  }
  return out;
}
