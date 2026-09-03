import { monthEndKey, type DateKey } from "./calendar.ts";
import type { FundWalk } from "./fundWalk.ts";
import type { ObligationSource } from "./monthObligations.ts";

/**
 * What leaves the Fund next, and what it leaves behind — folded straight out
 * of `FundWalk.points`, the one place the Fund's running balance is decided.
 * Neither function here computes a balance of its own; both only read one.
 */

export type NextOutRow = {
  id: string;
  label: string;
  date: DateKey;
  amountCents: number;
  /** Parsed from the walk's own point id. Absent only for a shape the walk never produces. */
  source: ObligationSource | null;
  leavesCents: number;
  underBuffer: boolean;
  breaks: boolean;
};

export type NextOutTable = {
  rows: NextOutRow[];
  breakRow: NextOutRow | null;
  totalCents: number;
};

export type SpokenFor = {
  /** Balance today. Never negative — a Fund that's already dry has nothing left to speak for. */
  poolCents: number;
  /** What's due at or before `throughDate`. */
  claimedCents: number;
  freeCents: number;
  overCents: number;
  /** The next projected inflow of any kind, or the month's last day. */
  throughDate: DateKey;
  /** Whether that horizon is confirmed, observed-but-unconfirmed, or month end. */
  throughConfidence: "confirmed" | "observed" | "month-end";
};

function obligationSource(sourceId: string | null): ObligationSource | null {
  if (!sourceId) return null;
  if (sourceId.startsWith("recurrence:")) return "recurrence";
  if (sourceId.startsWith("goal-claim:")) return "goal-claim";
  if (sourceId.startsWith("posted:")) return "posted";
  return null;
}

/** Every obligation the walk still has to pay this month, in the order the walk pays them. */
export function nextOut(walk: FundWalk): NextOutTable {
  const points = walk.points.filter((point) => !point.actual && point.kind === "obligation");
  let broken = false;
  const rows: NextOutRow[] = points.map((point) => {
    const leavesCents = point.balanceCents;
    const breaks = !broken && leavesCents < 0;
    if (breaks) broken = true;
    return {
      id: point.sourceId ?? `obligation:${point.date}:${point.label}`,
      label: point.label,
      date: point.date,
      amountCents: Math.abs(point.deltaCents),
      source: obligationSource(point.sourceId),
      leavesCents,
      underBuffer: walk.bufferCents > 0 && leavesCents < walk.bufferCents,
      breaks,
    };
  });
  return {
    rows,
    breakRow: rows.find((row) => row.breaks) ?? null,
    totalCents: rows.reduce((sum, row) => sum + row.amountCents, 0),
  };
}

/** What's already spoken for before the next money lands, read off the same walk. */
export function spokenFor(walk: FundWalk, today: DateKey): SpokenFor {
  const monthEnd = monthEndKey(walk.monthKey);
  const nextInflow = walk.points.find((point) => !point.actual && point.deltaCents > 0) ?? null;
  const throughDate = nextInflow?.date ?? (today > monthEnd ? today : monthEnd);
  const throughConfidence = nextInflow
    ? nextInflow.estimated ? "observed" : "confirmed"
    : "month-end";
  const poolCents = Math.max(0, walk.todayBalanceCents);
  const claimedCents = walk.points
    .filter((point) => !point.actual && point.kind === "obligation" && point.date <= throughDate)
    .reduce((sum, point) => sum + Math.abs(point.deltaCents), 0);
  const freeCents = Math.max(0, poolCents - claimedCents);
  const overCents = Math.max(0, claimedCents - poolCents);
  return { poolCents, claimedCents, freeCents, overCents, throughDate, throughConfidence };
}
