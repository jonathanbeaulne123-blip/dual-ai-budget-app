// The Level — the Fund's face, drawn. One rule carries the whole thing:
// actual is solid, projected is dashed. Fact and forecast never share a stroke.
//
// Geometry is assertable, the same discipline as registerView.ts: every date
// on this drawing uses the same day-of-month scale, and the balance line uses
// one shared cents-to-pixel scale for its whole height, above and below zero.
// No second allocator, no second scale, lives here.

import {
  addDays,
  calendarDaysBetween,
  daysInMonthKey,
  formatMonthLabel,
  monthEndKey,
  monthStartKey,
  parseDateKey,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import type { FundWalk } from "./fundWalk.ts";
import { formatCad } from "./money.ts";
import { spokenFor } from "./nextOut.ts";

export const LEVEL_VIEW = {
  width: 700,
  height: 236,
  left: 40,
  right: 660,
  top: 30,
  axisY: 214,
  labelY: 234,
  actualStroke: 2.25,
  projectedStroke: 1.75,
  projectedDash: "5 4",
  projectedOpacity: 0.72,
  bandOpacity: 0.07,
  todayOpacity: 0.32,
  markRadius: 4,
} as const;

/**
 * A below-buffer run shorter than this doesn't earn a headline rung or a
 * shaded band — one bar, reused for both, so the drawing and the sentence
 * can never disagree about which run is worth naming.
 */
export const LEVEL_BAND_MIN_DAYS = 3;

export type LevelPresentation = "ready" | "day-one" | "untied" | "loading" | "error" | "offline";

export type LevelDrawing = {
  presentation: LevelPresentation;
  pxPerCent: number;
  zeroY: number;
  bufferY: number;
  todayX: number;
  actualPath: string;
  projectedPath: string;
  bands: Array<{ x: number; width: number }>;
  marks: Array<{ x: number; y: number; label: string; estimated: boolean }>;
  dryMark: { x: number; y: number } | null;
  paydayTicks: Array<{ x: number }>;
};

export const LEVEL_UNTIED_LINE =
  "This month's numbers don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing.";
export const LEVEL_DAY_ONE_LINE =
  "This is only the bills you've told me about. Nothing has actually happened yet.";

function dayOfMonth(date: DateKey): number {
  return parseDateKey(date).day;
}

function ordinal(date: DateKey): string {
  const day = dayOfMonth(date);
  const rest = day % 100;
  const suffix = rest >= 11 && rest <= 13 ? "th"
    : day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

function monthNameOnly(monthKey: MonthKey): string {
  return formatMonthLabel(monthKey).replace(/\s\d{4}$/, "");
}

/**
 * Cents-to-pixel-x is one scale for the whole month, shared by the balance
 * line, the bands, the marks, and the payday ticks. Exported so a payday
 * tick — which needs the household `levelDrawing` never sees — can be
 * placed with the exact same ruler rather than a second, drifting one.
 */
export function levelX(date: DateKey, monthKey: MonthKey): number {
  const days = daysInMonthKey(monthKey);
  const span = Math.max(1, days - 1);
  // A day-of-month digit alone misreads a date one day past month end (the
  // band-to-month-end case) as day 1 of THIS month. Count from the month's
  // own start instead, then clamp — a date a day into next month lands on
  // the same x as this month's last day, which is exactly where it belongs.
  const offset = calendarDaysBetween(monthStartKey(monthKey), date);
  const clamped = Math.min(Math.max(offset, 0), days - 1);
  return LEVEL_VIEW.left + (clamped * (LEVEL_VIEW.right - LEVEL_VIEW.left)) / span;
}

/** A step, never a curve: flat at the previous balance until the new x, then a vertical jump. */
function stepPath(points: Array<{ x: number; y: number }>, startX: number, startY: number, endX: number): string {
  let d = `M ${startX} ${startY}`;
  let previousY = startY;
  for (const point of points) {
    d += ` L ${point.x} ${previousY} L ${point.x} ${point.y}`;
    previousY = point.y;
  }
  d += ` L ${endX} ${previousY}`;
  return d;
}

function corePresentation(walk: FundWalk): "ready" | "day-one" | "untied" {
  if (!walk.tiesToProjection) return "untied";
  if (!walk.hasConfirmedContribution) return "day-one";
  return "ready";
}

/** The walk, drawn. Pure geometry — nothing here posts, mutates, or assumes an amount. */
export function levelDrawing(walk: FundWalk): LevelDrawing {
  const presentation = corePresentation(walk);
  const monthKey = walk.monthKey;
  const todayX = levelX(walk.today, monthKey);

  const balances = walk.points.map((point) => point.balanceCents);
  const peakCents = Math.max(0, ...balances);
  const troughCents = Math.min(0, ...balances);
  const range = peakCents - troughCents;
  const room = LEVEL_VIEW.axisY - LEVEL_VIEW.top;
  const pxPerCent = range > 0 ? room / range : 0;
  const zeroY = pxPerCent > 0 ? LEVEL_VIEW.top + peakCents * pxPerCent : LEVEL_VIEW.axisY;
  const y = (cents: number) => zeroY - cents * pxPerCent;
  const bufferY = walk.bufferCents > 0 ? y(walk.bufferCents) : zeroY;

  // Untied still shows the axes and the buffer rule — it just cannot show a
  // line it does not trust. Day-one shows the dashed forecast, all of it;
  // only the solid, actual stroke is empty, because nothing has moved yet.
  const showLine = presentation === "ready" || presentation === "day-one";

  let actualPath = "";
  if (showLine && presentation !== "day-one") {
    const actualPoints = walk.points.filter((point) => point.actual);
    if (actualPoints.length > 0) {
      const first = actualPoints[0]!;
      actualPath = stepPath(
        actualPoints.slice(1).map((point) => ({ x: levelX(point.date, monthKey), y: y(point.balanceCents) })),
        levelX(first.date, monthKey),
        y(first.balanceCents),
        todayX,
      );
    }
  }

  let projectedPath = "";
  if (showLine) {
    const projectedPoints = walk.points.filter((point) => !point.actual);
    const monthEndX = levelX(monthEndKey(monthKey), monthKey);
    projectedPath = stepPath(
      projectedPoints.map((point) => ({ x: levelX(point.date, monthKey), y: y(point.balanceCents) })),
      todayX,
      y(walk.todayBalanceCents),
      monthEndX,
    );
  }

  const bands = showLine
    ? walk.belowBufferRuns
      .filter((run) => run.days >= LEVEL_BAND_MIN_DAYS)
      .map((run) => {
        const x = levelX(run.fromDate, monthKey);
        return { x, width: levelX(addDays(run.toDate, 1), monthKey) - x };
      })
    : [];

  const marks = showLine
    ? walk.points
      .filter((point) => point.kind === "contribution")
      .map((point) => ({
        x: levelX(point.date, monthKey),
        y: y(point.balanceCents),
        label: `+${formatCad(point.deltaCents)}`,
        estimated: point.estimated,
      }))
    : [];

  const dryMark = showLine && walk.dryDate ? { x: levelX(walk.dryDate, monthKey), y: zeroY } : null;

  return {
    presentation, pxPerCent, zeroY, bufferY, todayX,
    actualPath, projectedPath, bands, marks, dryMark,
    // Ticks need the household's own pay schedules, which this function
    // never receives on purpose (its signature is the walk alone) — the
    // component supplies them, positioned with the same `levelX` ruler.
    paydayTicks: [],
  };
}

/** Highest true statement wins. Never more than two; the covered case never manufactures a worry. */
function ladderRungs(walk: FundWalk): string[] {
  const rungs: string[] = [];
  if (walk.dryDate) {
    rungs.push(`At this pace the Fund runs dry on the ${ordinal(walk.dryDate)}.`);
  }
  const run = walk.belowBufferRuns.find((row) => row.days >= LEVEL_BAND_MIN_DAYS);
  if (run) {
    rungs.push(
      `Under the buffer from the ${ordinal(run.fromDate)} to the ${ordinal(run.toDate)} — `
      + `${run.days} days on ${formatCad(run.lowCents)}.`,
    );
  }
  const spoken = spokenFor(walk, walk.today);
  if (spoken.overCents > 0) {
    rungs.push(
      `${formatCad(spoken.claimedCents)} of the ${formatCad(spoken.poolCents)} in the pool `
      + `is spoken for before the ${ordinal(spoken.throughDate)}.`,
    );
  }
  if (walk.inflowConfidence === "observed" && walk.shortfallCents > 0) {
    rungs.push(
      `The register is still short ${formatCad(walk.shortfallCents)}. `
      + "The dashed contribution is observed, not confirmed.",
    );
  }
  if (rungs.length === 0) rungs.push(`${monthNameOnly(walk.monthKey)} is covered.`);
  return rungs;
}

// Named `levelStageHeadline`, not the frozen manual's bare `levelHeadline` —
// `fundPlates.ts` (already shipped, slice 0/3) already exports a
// `levelHeadline(walk, findings)` for the compact rail plate's own verdict
// line. That is a different, narrower ladder for a different surface (the
// small tile, not this full stage) and is out of this slice's scope to
// touch or rename. See APPLY_FUND_LEVEL.md for the full disclosure.
export function levelStageHeadline(walk: FundWalk): string {
  if (!walk.tiesToProjection) return LEVEL_UNTIED_LINE;
  if (!walk.hasConfirmedContribution) return LEVEL_DAY_ONE_LINE;
  return ladderRungs(walk)[0]!;
}

export function levelSecondary(walk: FundWalk): string | null {
  if (!walk.tiesToProjection) return null;
  if (!walk.hasConfirmedContribution) return null;
  return ladderRungs(walk)[1] ?? null;
}

export function levelAria(walk: FundWalk): string {
  const parts = [`${monthNameOnly(walk.monthKey)} balance ${formatCad(walk.todayBalanceCents)} today`];
  if (walk.dryDate) parts.push(`running dry on the ${ordinal(walk.dryDate)}`);
  if (walk.bufferCents > 0) parts.push(`buffer set at ${formatCad(walk.bufferCents)}`);
  return `${parts.join(", ")}.`;
}
