import type { DateKey } from "../../core/calendar.ts";
import type { CellarJarReading, CellarReadingView } from "../data/reading.ts";

/**
 * Scrubbing the rail through time (BUILD_PLAN_SLICE2 §3).
 *
 * Dragging along the rail, the ◀ ▶ twins and the arrow keys all come through
 * here. **This is a reading, not a change**: nothing in this file writes,
 * posts, proposes or recomputes money. It only says which day the rail is
 * standing on, what the water was on that day, and which jars are still ahead
 * of the line.
 */

/** Where a jar stands against the day in the gate. */
export type DayState = "behind" | "at" | "ahead";

/** A jar's state as the rail reads it on the scrubbed day: its own, or `"ahead"` when its day has not come yet. */
export type ScrubJarState = CellarJarReading["state"] | "ahead";

export type ScrubView = {
  levelCents: number;
  date: DateKey;
  jarStates: Record<string, ScrubJarState>;
};

const clampIndex = (index: number, days: number): number => {
  if (!Number.isFinite(index) || days <= 0) return 0;
  return Math.max(0, Math.min(days - 1, Math.round(index)));
};

/**
 * A point along the rail → a day index. `x` is the pointer's distance from the
 * rail's left end, `width` the rail's drawn length, `days` how many days the
 * month has. The ends are whole days, so the first and last day each get a
 * full slice of the rail instead of a half one.
 */
export function scrubIndex(x: number, width: number, days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 0;
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, x / width));
  return clampIndex(Math.floor(ratio * days), days);
}

/** The inverse: the middle of a day's slice along a rail of `width`. */
export function scrubOffset(index: number, width: number, days: number): number {
  if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(width) || width <= 0) return 0;
  return ((clampIndex(index, days) + 0.5) / days) * width;
}

/** Where a jar's day sits against the day in the gate. */
export function dayState(day: number, jar: number): DayState {
  if (!Number.isFinite(day) || !Number.isFinite(jar)) return "at";
  return jar < day ? "behind" : jar > day ? "ahead" : "at";
}

/** The index of a date in the reading's days, or −1 when it is not on this rail. */
export function dayIndexOf(cellar: Pick<CellarReadingView, "days">, date: DateKey | null): number {
  if (!date) return -1;
  return cellar.days.findIndex((day) => day.date === date);
}

/**
 * The whole rail at one day. The water is that day's balance; a jar whose due
 * date is later than the day in the gate is `"ahead"` (the scene greys it), and
 * every other jar keeps the state the reading gave it. A jar with no date is
 * never ahead of anything, so it keeps its state at every point on the rail.
 *
 * The reading carries today's states only, so "behind" cannot be re-derived
 * into a past state the books never recorded — the rail shows what is known,
 * and never invents a history.
 */
export function scrubReading(cellar: CellarReadingView, index: number): ScrubView {
  const days = cellar.days;
  if (days.length === 0) return { levelCents: 0, date: "", jarStates: {} };
  const at = clampIndex(index, days.length);
  const day = days[at]!;
  const jarStates: Record<string, ScrubJarState> = {};
  for (const jar of cellar.jars) {
    const due = dayIndexOf(cellar, jar.due);
    jarStates[jar.key] = due >= 0 && dayState(at, due) === "ahead" ? "ahead" : jar.state;
  }
  return { levelCents: day.balanceCents, date: day.date, jarStates };
}

/** One step along the rail, clamped. The ◀ ▶ twins and the arrow keys both use it. */
export function scrubStep(cellar: Pick<CellarReadingView, "days">, index: number, delta: number): number {
  return clampIndex(index + (Number.isFinite(delta) ? delta : 0), cellar.days.length);
}

/** Back to today — one tap. Falls back to the first day when the reading has no today. */
export function scrubToday(cellar: Pick<CellarReadingView, "days" | "todayIndex">): number {
  const marked = cellar.days.findIndex((day) => day.today);
  if (marked >= 0) return marked;
  return clampIndex(cellar.todayIndex, cellar.days.length);
}

/** The date plate's words: "Sep 14" style, and "—" when the rail is empty. */
export function scrubDateWords(date: DateKey | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = months[Number(date.slice(5, 7)) - 1];
  return month ? `${month.slice(0, 3)} ${Number(date.slice(8, 10))}` : "—";
}
