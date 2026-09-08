import { foldFundMovements } from "./fundMovements.ts";
import type { FundHorizon } from "./fundHorizon.ts";
import type { FundScenarioResult } from "./scenarioProjection.ts";
import type { ScenarioBasis } from "./fundScenario.ts";
import type { WalkPoint } from "./fundWalk.ts";
import type { Environment, LedgerView } from "./types.ts";

export type FundTrustLevel = "confirmed" | "observed" | "estimated";
export type TrustPath = Readonly<{ future: readonly WalkPoint[]; endBalanceCents: number; terminalDeficitCents: number }>;
export type FundTrustReading = Readonly<{
  kind: "trust-reading"; level: FundTrustLevel; asOf: string; windowThrough: string;
  /** Last included datum, never a completeness guarantee. */
  lastSourceDate: string; anchorCents: number; lower: TrustPath; expected: TrustPath;
  endWidthCents: number | null; observedExcluded: number; obligationCount: number;
}>;
export type FundTrustResult = FundTrustReading | Readonly<{ kind: "unavailable"; reason: string; caption: string }>;
export type TrustScenario = Readonly<{ scenario: Extract<FundScenarioResult, { kind: "scenario" }>; currentBasis: ScenarioBasis }>;
const refuse = (reason: string, caption = "Needs review"): FundTrustResult => ({ kind: "unavailable", reason, caption });
const lastSource = (asOf: string, paths: readonly TrustPath[]) => paths.flatMap(path => path.future)
  .filter(point => point.deltaCents !== 0).reduce((last, point) => point.date > last ? point.date : last, asOf);
const exactPath = (path: TrustPath, horizon: FundHorizon) => Number.isSafeInteger(path.endBalanceCents)
  && Number.isSafeInteger(path.terminalDeficitCents)
  && path.terminalDeficitCents === Math.max(0, -path.endBalanceCents)
  && path.future.every(point => Number.isSafeInteger(point.balanceCents) && Number.isSafeInteger(point.deltaCents)
    && point.date >= horizon.asOf && point.date <= horizon.through);

/** Presentation-only source inclusion. Canonical balances, current Ask and money never change. */
export function fundTrustReading(horizon: FundHorizon, level: FundTrustLevel, reviewed?: TrustScenario | null): FundTrustResult {
  if (!Number.isSafeInteger(horizon.anchorCents)) return refuse("The accepted Fund amount needs review.");
  let lower: TrustPath, expected: TrustPath;
  const observed = horizon.movements.filter(row => row.kind === "contribution" && row.estimated);
  const obligations = horizon.movements.filter(row => row.kind === "obligation");
  if (level === "observed" && !observed.length) return refuse("No observed contribution estimates are available in this window.", "No observations");
  if (level === "estimated") {
    if (!reviewed || !reviewed.scenario.contributions.some(row => row.lowerCents > 0 || row.expectedCents > 0)) {
      return refuse("An explicit contribution scenario has not been reviewed for this reading.", "No scenario");
    }
    const { scenario, currentBasis } = reviewed;
    if (JSON.stringify(scenario.basis) !== JSON.stringify(currentBasis)
      || currentBasis.asOf !== horizon.asOf || currentBasis.through !== horizon.through
      || JSON.stringify(scenario.baseline) !== JSON.stringify(horizon)) return refuse("The contribution scenario needs a current source review.");
    // Preserve paired common slots, including zero placeholders. Never independently sort them.
    lower = scenario.lower; expected = scenario.expected;
    if (lower.future.length !== expected.future.length || lower.future.some((point, index) => {
      const other = expected.future[index]!;
      return point.sourceId !== other.sourceId || point.date !== other.date || point.balanceCents > other.balanceCents;
    }) || lower.endBalanceCents > expected.endBalanceCents) return refuse("The reviewed paths do not support an ordered model range.");
  } else {
    const movements = level === "confirmed" ? horizon.movements.filter(row => !(row.kind === "contribution" && row.estimated)) : horizon.movements;
    const folded = foldFundMovements(horizon.anchorCents, movements);
    lower = { future: folded.points, endBalanceCents: folded.endBalanceCents, terminalDeficitCents: Math.max(0, -folded.endBalanceCents) };
    expected = lower;
  }
  if (!exactPath(lower, horizon) || !exactPath(expected, horizon)) return refuse("This source selection is outside the supported exact-cent range.");
  const width = expected.endBalanceCents - lower.endBalanceCents;
  if (!Number.isSafeInteger(width)) return refuse("The model range is outside the supported exact-cent range.");
  return { kind: "trust-reading", level, asOf: horizon.asOf, windowThrough: horizon.through, lastSourceDate: lastSource(horizon.asOf, [lower, expected]),
    anchorCents: horizon.anchorCents, lower, expected, endWidthCents: level === "estimated" ? width : null,
    observedExcluded: level === "confirmed" ? observed.length : 0, obligationCount: obligations.length };
}

export function fundTrustStorageKey(environment: Environment, householdId: string, memberId: string, view: LedgerView, today: string): string {
  return `hearth:fund-trust:${JSON.stringify([environment, householdId, memberId, view, today])}`;
}
export function storedFundTrust(key: string): FundTrustLevel {
  try { const saved = sessionStorage.getItem(key); return saved === "observed" || saved === "estimated" ? saved : "confirmed"; }
  catch { return "confirmed"; }
}
