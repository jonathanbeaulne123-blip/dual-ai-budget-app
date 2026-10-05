/**
 * Money on the map (Horizon Clock): which way a stop's money goes, and THE "to check" set.
 *
 * - `directionOf(stop)`: income → "in", commitment → "out", everything else → "none". A goal's figure is a target
 *   (basis "target"), not money moving: it is "none" and never gets a coin stack.
 * - `toCheckIds(stops)`: the ids `isToCheck` (contracts) accepts, in the stops' own order (board order = date order).
 *   One definition only: a commitment whose date passed and that is not recorded as paid. Expected income whose date
 *   passed unrecorded is never "to check" (D60, ruling 2).
 * - `knownCents(stop)`: the stop's figure when one is known; null when unknown (never 0).
 */
import { isFundStop, isToCheck, type DirectionOf, type MoneyDirection, type Stop } from "../contracts.ts";

export const directionOf: DirectionOf = (stop: Stop): MoneyDirection => {
  if (stop.kind === "income") return "in";
  if (stop.kind === "commitment") return "out";
  return "none";
};

export function toCheckIds(stops: readonly Stop[]): string[] {
  return stops.filter(isToCheck).map(stop => stop.id);
}

/** The figure a money stop carries, or null when it is unknown (`amountCents` null or basis "unknown"). Never 0 for unknown. */
export function knownCents(stop: Stop): number | null {
  if (stop.amountCents === null || stop.amountCents === undefined || !Number.isFinite(stop.amountCents)) return null;
  if (stop.amountBasis === "unknown" || stop.amountBasis === undefined) return null;
  return stop.amountCents;
}

/** Recorded = a commitment paid or an income stop confirmed. Everything else on the map is not recorded. */
export function isRecorded(stop: Stop): boolean {
  return (stop.kind === "commitment" && stop.status === "paid") || (stop.kind === "income" && stop.status === "confirmed");
}

export { isFundStop, isToCheck };
