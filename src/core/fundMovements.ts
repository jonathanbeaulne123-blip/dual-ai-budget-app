import type { WalkPoint } from "./fundWalk.ts";

export type FundMovement = Omit<WalkPoint, "balanceCents" | "actual">;

/** Existing canonical daily order. It does not establish intraday bank availability. */
export function compareFundMovements(left: FundMovement, right: FundMovement): number {
  return left.date.localeCompare(right.date)
    || Math.sign(right.deltaCents) - Math.sign(left.deltaCents)
    || (left.sourceId ?? "").localeCompare(right.sourceId ?? "");
}

/** One opening, one accumulation. Callers own validation; this preserves legacy walk output. */
export function foldFundMovements(openingCents: number, movements: readonly FundMovement[]): { points: WalkPoint[]; endBalanceCents: number } {
  return accumulateFundMovements(openingCents, [...movements].sort(compareFundMovements));
}

/** Accumulate a reviewed common order, including paired scenario zero placeholders. */
export function accumulateFundMovements(openingCents: number, orderedMovements: readonly FundMovement[]): { points: WalkPoint[]; endBalanceCents: number } {
  let balance = openingCents;
  const points = orderedMovements.map(row => {
    balance += row.deltaCents;
    return { ...row, balanceCents: balance, actual: false };
  });
  return { points, endBalanceCents: balance };
}
