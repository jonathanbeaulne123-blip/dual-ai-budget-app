/**
 * Desk-plate drawing primitives.
 *
 * Six figures, one grammar. An instrument taking a mosaic slot later picks one
 * of these and feeds it rows. Until then the tile falls back to a sentence.
 * Pure so each rule is assertable: one scale, never-zero track marks, fill that
 * cannot overflow, tally that never rounds, a gauge threshold that is drawn.
 */

export const PLATE_VIEW = {
  width: 210,
  left: 6,
  right: 204,
} as const;

export type PlatePrimitive = "track" | "pair" | "fill" | "spark" | "tally" | "gauge";

/** Clamp a day onto the rail. Day 1 sits on `left`; the last day sits on `right`. */
export function trackX(day: number, days: number): number {
  const span = Math.max(1, days - 1);
  const clamped = Math.min(Math.max(day, 1), Math.max(1, days));
  return PLATE_VIEW.left + (clamped - 1) * (PLATE_VIEW.right - PLATE_VIEW.left) / span;
}

/**
 * Track marks are never zero height. A zero-cent day still leaves a 4-unit
 * tick so the rail reads as furniture, not a missing day.
 */
export function trackMarkHeight(cents: number, maxCents: number, room: number): number {
  const safeRoom = Math.max(4, room);
  if (maxCents <= 0) return 4;
  const amount = Math.max(0, cents);
  return 4 + (amount / maxCents) * (safeRoom - 4);
}

/**
 * One scale for the pair. Cash above the rail and cards below it share `s`,
 * the same conservation argument the Month Spread Course makes at month scale.
 */
export function pairScale(upCents: number, downCents: number, room: number): number {
  const peak = Math.max(Math.abs(upCents), Math.abs(downCents));
  if (peak <= 0 || room <= 0) return 0;
  return room / peak;
}

/** Fill never overflows the well. */
export function fillLevel(savedCents: number, targetCents: number): number {
  if (targetCents <= 0) return 0;
  const ratio = Math.max(0, savedCents) / targetCents;
  return Math.min(1, ratio);
}

/** Spark heights scale to the series' own peak. Empty or all-zero series is a flat rail. */
export function sparkHeights(points: readonly number[], room: number): number[] {
  if (!points.length || room <= 0) return points.map(() => 0);
  const peak = Math.max(0, ...points.map((point) => Math.abs(point)));
  if (peak <= 0) return points.map(() => 0);
  return points.map((point) => (Math.abs(point) / peak) * room);
}

/** Tally is a count of days or findings, never a rounded money figure. */
export function tallyIsCountable(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

export function gaugeIsOver(pct: number, threshold: number): boolean {
  return pct > threshold;
}

export function gaugeFillWidth(pct: number, rail = PLATE_VIEW.right - PLATE_VIEW.left): number {
  const clamped = Math.min(1, Math.max(0, pct));
  return clamped * rail;
}

export function gaugeThresholdX(threshold: number): number {
  const clamped = Math.min(1, Math.max(0, threshold));
  return PLATE_VIEW.left + clamped * (PLATE_VIEW.right - PLATE_VIEW.left);
}
