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
