/**
 * Pure helpers for the Kitty Bank landmarks on the Our Path island (D-262).
 * No money moves here: these only read dates and the steps the page already computed.
 */

const DAY_MS = 86_400_000;
/** A bank fired within this many days keeps the kiln warm. */
export const KILN_WARM_DAYS = 30;
/** At most this many coins fly at once. */
export const COIN_POOL = 12;

/** The civil date a shown month is read "as of": its last day, or today for the month that holds today (or a later one). */
export function pathMonthAsOf(monthKey: string, today: string): string {
  if (monthKey >= today.slice(0, 7)) return today;
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKey}-${String(last).padStart(2, "0")}`;
}

/** True when a firing happened on or before `asOf` and no more than {@link KILN_WARM_DAYS} days before it. */
export function firedRecently(firedAt: string | null | undefined, asOf: string): boolean {
  if (!firedAt) return false;
  const fired = firedAt.slice(0, 10);
  if (fired > asOf) return false;
  const gap = (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${fired}T00:00:00Z`)) / DAY_MS;
  return Number.isFinite(gap) && gap <= KILN_WARM_DAYS;
}

/**
 * How a landmark's step changed between two scenes: `n` coins flying in (`up`) or out (`down`).
 * A bank seen for the first time, or an unchanged one, sends nothing. Never more than {@link COIN_POOL}.
 */
export function landmarkStepChange(previous: number | undefined, next: number): { dir: "up" | "down"; n: number } | null {
  if (previous === undefined || previous === next) return null;
  return { dir: next > previous ? "up" : "down", n: Math.min(COIN_POOL, Math.abs(next - previous)) };
}
