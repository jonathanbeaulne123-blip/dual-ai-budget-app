import { householdAsk, type HouseholdAsk } from "./ask.ts";
import { sha256Hex } from "./commandIdentity.ts";
import { reviewFundScenarioRequest, type FundScenarioRequest, type ScenarioBasis, type ScenarioRefusal } from "./fundScenario.ts";
import { reviewScenarioSources, type ScenarioAcceptedSource } from "./scenarioSources.ts";
import { resolveCashAvailability } from "./cashAvailability.ts";
import { resolveForecastAvailability, type ForecastAvailabilityAssumption } from "./forecastAvailability.ts";
import { reviewScenarioAllocations, type ElectedScenarioContribution } from "./scenarioAllocation.ts";
import { foldReviewedScenarioPaths, type ScenarioPath } from "./scenarioPaths.ts";
import type { CashAvailabilityAssumption, EarningsAvailability } from "./earningsAvailability.ts";
import type { FundHorizon } from "./fundHorizon.ts";
import type { Household } from "./types.ts";

export type ReviewedScenarioEstimate = Readonly<{id: string; factsDigest: string; date: string; amountCents: number; memberId: string; label: string}>;
export type FundScenarioReview = Readonly<{kind: "scenario-review"; basis: ScenarioBasis; replacements: readonly ReviewedScenarioEstimate[]}> | Readonly<{kind: "unavailable"; reasons: readonly ScenarioRefusal[]}>;
export type FundScenarioResult = Readonly<{kind: "unavailable"; reasons: readonly ScenarioRefusal[]}> | Readonly<{
  kind: "scenario";
  basis: ScenarioBasis;
  currentAsk: HouseholdAsk;
  baseline: FundHorizon;
  baselineTerminalDeficitCents: number;
  lower: ScenarioPath;
  expected: ScenarioPath;
  contributions: readonly ElectedScenarioContribution[];
  replacedEstimates: readonly ReviewedScenarioEstimate[];
  assumptions: readonly string[];
}>;
export type ScenarioSourceAssumptions = Readonly<{cash: readonly CashAvailabilityAssumption[]; forecast: readonly ForecastAvailabilityAssumption[]}>;
const unavailable = (code: ScenarioRefusal["code"], message: string): Extract<FundScenarioResult, {kind: "unavailable"}> => ({kind: "unavailable", reasons: [{code, message}]});

async function estimates(basis: ScenarioBasis, horizon: FundHorizon): Promise<ReviewedScenarioEstimate[]> {
  return Promise.all(horizon.movements.filter(row => row.kind === "contribution" && row.estimated && row.deltaCents > 0
    && row.memberId === basis.scope.memberId && row.date > basis.asOf && row.sourceId === `estimate:${row.memberId}:${row.date}`)
    .map(async row => ({id: row.sourceId!, factsDigest: await sha256Hex({version: "scenario-replacement-1", basis, movement: row}), date: row.date, amountCents: row.deltaCents, memberId: row.memberId!, label: row.label})));
}

/** The view displays these exact amount/date associations before electing a replacement. */
export async function reviewFundScenario(household: Household, accepted: ScenarioAcceptedSource, asOf: string, through: string): Promise<FundScenarioReview> {
  const h = structuredClone(household), marker = structuredClone(accepted);
  if (!marker || marker.kind !== "accepted" || !marker.scope) return unavailable("source-not-accepted", "The accepted books are not available for this scenario yet.");
  const source = await reviewScenarioSources(h, marker, asOf, through);
  if (source.kind === "unavailable") return source;
  return {kind: "scenario-review", basis: source.basis, replacements: await estimates(source.basis, source.horizon)};
}

/** Pure local simulation. Every source is resolved again; no UI amount array becomes authority. */
export async function projectFundScenario(household: Household, accepted: ScenarioAcceptedSource, request: FundScenarioRequest, assumptions: ScenarioSourceAssumptions): Promise<FundScenarioResult> {
  const h = structuredClone(household), marker = structuredClone(accepted), choice = structuredClone(request), inputs = structuredClone(assumptions);
  if (!marker || marker.kind !== "accepted" || !marker.scope) return unavailable("source-not-accepted", "The accepted books are not available for this scenario yet.");
  if (!choice?.basis || !inputs || !Array.isArray(inputs.cash) || !Array.isArray(inputs.forecast)) return unavailable("invalid-election", "Review the scenario and its source assumptions.");
  const source = await reviewScenarioSources(h, marker, choice.basis.asOf, choice.basis.through);
  if (source.kind === "unavailable") return source;
  const reviewed = reviewFundScenarioRequest(h, source.basis, choice);
  if (reviewed.kind === "refused") return {kind: "unavailable", reasons: reviewed.reasons};
  const [cash, forecast] = await Promise.all([
    resolveCashAvailability(h, marker, choice, inputs.cash),
    inputs.forecast.length ? resolveForecastAvailability(h, marker, choice, inputs.forecast)
      : Promise.resolve<EarningsAvailability>({kind: "available", basis: source.basis, modelVersion: "no-forecast", tranches: [], capacityGroups: [], assumptions: []}),
  ]);
  if (cash.kind === "unavailable") return cash;
  if (forecast.kind === "unavailable") return forecast;
  const availability: EarningsAvailability = {kind: "available", basis: source.basis, modelVersion: "fund-scenario-1", tranches: [...cash.tranches, ...forecast.tranches], capacityGroups: [...cash.capacityGroups, ...forecast.capacityGroups], assumptions: [...cash.assumptions, ...forecast.assumptions]};
  const allocations = reviewScenarioAllocations(h, source.basis, choice, availability);
  if (allocations.kind === "refused") return {kind: "unavailable", reasons: allocations.reasons};
  const options = await estimates(source.basis, source.horizon);
  const replacedEstimates: ReviewedScenarioEstimate[] = [], removed = new Set<string>();
  for (const election of choice.elections) {
    const effective = allocations.contributions.find(row => row.id === election.id);
    if (election.replaces.length && (!effective || (effective.lowerCents === 0 && effective.expectedCents === 0))) return unavailable("zero-election-replacement", "A zero contribution leaves the baseline estimates in place.");
    for (const ref of election.replaces) {
      const row = source.horizon.movements.find(row => row.sourceId === ref.id);
      if (!row) return unavailable("replacement-missing", "That estimate is no longer on the reviewed horizon.");
      if (row.kind !== "contribution" || !row.estimated || row.deltaCents <= 0 || row.date <= source.basis.asOf) return unavailable("replacement-not-observed", "Only a future observed contribution estimate can be replaced.");
      if (row.memberId !== source.basis.scope.memberId) return unavailable("replacement-scope-mismatch", "Only your own future estimate can be replaced.");
      const option = options.find(option => option.id === ref.id);
      if (!option || option.factsDigest !== ref.factsDigest) return unavailable("baseline-stale", "Review the exact estimate amount and date again.");
      if (removed.has(ref.id)) return unavailable("replacement-duplicated", "An estimate can be replaced only once.");
      removed.add(ref.id); replacedEstimates.push(option);
    }
  }
  const paths = foldReviewedScenarioPaths(source.horizon, allocations.contributions, removed);
  if (paths.kind === "unavailable") return paths;
  return {kind: "scenario", basis: source.basis, currentAsk: householdAsk(h, source.basis.asOf), baseline: source.horizon,
    baselineTerminalDeficitCents: Math.max(0, -source.horizon.endBalanceCents),
    lower: paths.lower, expected: paths.expected, contributions: allocations.contributions,
    replacedEstimates: replacedEstimates.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    assumptions: [...source.horizon.assumptions, ...availability.assumptions, "These are chosen hypothetical contributions, not accepted Fund movements. The current Shared Ask is unchanged.", "An up-to choice contributes only the remaining modeled amount up to its explicit cap on each path. A fixed choice may produce coincident paths."]};
}
