import { addDays, calendarDaysBetween, monthKeyFromDateKey } from "./calendar.ts";
import { accumulateFundMovements, compareFundMovements, type FundMovement } from "./fundMovements.ts";
import type { FundHorizon } from "./fundHorizon.ts";
import type { WalkPoint } from "./fundWalk.ts";
import type { ScenarioRefusal } from "./fundScenario.ts";
import type { ElectedScenarioContribution } from "./scenarioAllocation.ts";

export type ScenarioPath = Readonly<{
  future: readonly WalkPoint[];
  endBalanceCents: number;
  terminalDeficitCents: number;
  /** Daily ending balances; monthly buffers are not silently deducted from the terminal. */
  underBufferDates: readonly string[];
}>;
type Refusal = Readonly<{kind: "unavailable"; reasons: readonly ScenarioRefusal[]}>;
const unavailable = (code: ScenarioRefusal["code"], message: string): Refusal => ({kind: "unavailable", reasons: [{code, message}]});

function path(horizon: FundHorizon, points: readonly WalkPoint[]): ScenarioPath {
  const endBalanceCents = points.at(-1)?.balanceCents ?? horizon.anchorCents;
  let balance = horizon.anchorCents, index = 0;
  const underBufferDates: string[] = [];
  for (let day = 0; day <= calendarDaysBetween(horizon.asOf, horizon.through); day++) {
    const date = addDays(horizon.asOf, day);
    while (index < points.length && points[index]!.date <= date) balance = points[index++]!.balanceCents;
    const buffer = horizon.monthlyBuffers.find(row => row.monthKey === monthKeyFromDateKey(date))?.bufferCents ?? 0;
    if (balance < buffer) underBufferDates.push(date);
  }
  return {future: points, endBalanceCents, terminalDeficitCents: Math.max(0, -endBalanceCents), underBufferDates};
}

/** Internal fold of already reviewed choices; public consumers use projectFundScenario. */
export function foldReviewedScenarioPaths(horizon: FundHorizon, contributions: readonly ElectedScenarioContribution[], removed: ReadonlySet<string>): Refusal | Readonly<{kind: "paths"; lower: ScenarioPath; expected: ScenarioPath}> {
  const rows: Array<{movement: FundMovement; lowerCents: number; expectedCents: number}> = horizon.movements.filter(row => !removed.has(row.sourceId!))
    .map(movement => ({movement, lowerCents: movement.deltaCents, expectedCents: movement.deltaCents}));
  const ids = new Set(horizon.movements.map(row => row.sourceId));
  for (const contribution of contributions) {
    const sourceId = `scenario:${contribution.id}`;
    if (ids.has(sourceId)) return unavailable("invalid-election", "The choice identity conflicts with a Fund source.");
    ids.add(sourceId);
    rows.push({movement: {sourceId, date: contribution.date, label: "Chosen contribution · scenario", kind: "contribution", estimated: true, memberId: contribution.memberId,
      // One shared structural slot. Zero in one path must not reorder that path.
      deltaCents: Math.max(contribution.lowerCents, contribution.expectedCents)}, lowerCents: contribution.lowerCents, expectedCents: contribution.expectedCents});
  }
  rows.sort((a, b) => compareFundMovements(a.movement, b.movement));
  const lower = accumulateFundMovements(horizon.anchorCents, rows.map(row => ({...row.movement, deltaCents: row.lowerCents}))).points;
  const expected = accumulateFundMovements(horizon.anchorCents, rows.map(row => ({...row.movement, deltaCents: row.expectedCents}))).points;
  if (lower.some((point, index) => !Number.isSafeInteger(point.balanceCents) || !Number.isSafeInteger(expected[index]!.balanceCents))) return unavailable("unsafe-cents", "The scenario balance exceeds supported cents.");
  if (lower.some((point, index) => point.balanceCents > expected[index]!.balanceCents)) return unavailable("forecast-model-unsupported", "These dated choices do not support ordered lower and expected paths.");
  return {kind: "paths", lower: path(horizon, lower), expected: path(horizon, expected)};
}
