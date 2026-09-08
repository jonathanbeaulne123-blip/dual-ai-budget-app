import { formatCad } from "./money.ts";
import { formatDateLabel } from "./calendar.ts";
import { spokenFor } from "./nextOut.ts";
import type { FundWalk } from "./fundWalk.ts";

/** Packet figures retain the existing exact cents and add thousands separators. */
const plateCad = (cents: number) => formatCad(cents).replace(/(\d)(?=(\d{3})+\.)/g, "$1,");

/** A reading of the canonical Fund; the bar is a proportion, never a balance. */
export function fundLedgeReading(walk: FundWalk) {
  if (!walk.tiesToProjection) return {
    figure: "—", sentence: "The Fund needs review. Open its record.", claimedPercent: 0, refused: true,
  };
  const spoken = spokenFor(walk, walk.today);
  return {
    figure: plateCad(walk.todayBalanceCents),
    sentence: `${plateCad(spoken.claimedCents)} spoken for through ${formatDateLabel(spoken.throughDate)}.`,
    claimedPercent: spoken.poolCents > 0 ? Math.min(100, spoken.claimedCents / spoken.poolCents * 100) : spoken.claimedCents > 0 ? 100 : 0,
    refused: false,
  };
}

export type LedgeDetent = "rest" | "half" | "full";
export function ledgeHeights(viewportHeight: number, navHeight: number, rest = 84): Record<LedgeDetent, number> {
  const full = Math.max(rest, viewportHeight - navHeight);
  return { rest, half: Math.max(rest, Math.min(full, Math.round(viewportHeight * .55))), full };
}
export function nearestLedgeDetent(height: number, heights: Record<LedgeDetent, number>): LedgeDetent {
  return (["rest", "half", "full"] as const).reduce((best, candidate) => Math.abs(height - heights[candidate]) < Math.abs(height - heights[best]) ? candidate : best, "rest");
}
