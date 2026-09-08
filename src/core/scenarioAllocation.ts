import { isValidDateKey } from "./calendar.ts";
import { reviewFundScenarioRequest, type FundScenarioRequest, type ScenarioBasis, type ScenarioRefusal } from "./fundScenario.ts";
import type { EarningsAvailability } from "./earningsAvailability.ts";
import type { Household } from "./types.ts";
/** Increments for two cumulative paths; a later increment can narrow their earlier gap. */
export type ElectedScenarioContribution = Readonly<{id: string; date: string; lowerCents: number; expectedCents: number; memberId: string}>;
export type ScenarioAllocationReview = Readonly<{kind: "refused"; reasons: readonly ScenarioRefusal[]}> | Readonly<{kind: "allocated"; contributions: readonly ElectedScenarioContribution[]}>;
const refuse = (code: ScenarioRefusal["code"], message: string): ScenarioAllocationReview => ({kind: "refused", reasons: [{code, message}]});

/** Internal model stage. Public composition must resolve availability afresh from accepted sources. */
export function reviewScenarioAllocations(household: Household, liveBasis: ScenarioBasis, request: FundScenarioRequest, availability: EarningsAvailability): ScenarioAllocationReview {
  const reviewed = reviewFundScenarioRequest(household, liveBasis, request);
  if (reviewed.kind === "refused") return reviewed;
  if (availability.kind === "unavailable") return {kind: "refused", reasons: availability.reasons};
  if (reviewFundScenarioRequest(household, liveBasis, {...request, basis: availability.basis}).kind === "refused") return refuse("baseline-stale", "Source availability belongs to an earlier review.");
  const tranches = new Map(availability.tranches.map(row => [row.id, {...row, lower: row.lowerCents, expected: row.expectedCents}]));
  const groups = new Map(availability.capacityGroups.map(row => [row.id, {lower: row.lowerCents, expected: row.expectedCents}]));
  if (tranches.size !== availability.tranches.length || groups.size !== availability.capacityGroups.length) return refuse("source-overallocated", "Source capacity identities must be distinct.");
  const amountsValid = (lower: number, expected: number) => Number.isSafeInteger(lower) && Number.isSafeInteger(expected) && lower >= 0 && expected >= lower;
  if ([...tranches.values()].some(row => !amountsValid(row.lower, row.expected) || row.source.ownerMemberId !== liveBasis.scope.memberId || !row.source.factsDigest)
    || [...groups.values()].some(row => !amountsValid(row.lower, row.expected))) return refuse("source-not-owned", "Source availability needs a supported owned amount and basis.");
  const contributions: ElectedScenarioContribution[] = [];
  for (const election of [...reviewed.request.elections].sort((a, b) => a.contributionOn.localeCompare(b.contributionOn) || a.id.localeCompare(b.id))) {
    let lowerCents = 0, expectedCents = 0;
    const allocations = election.kind === "fixed" ? election.allocations.map(row => ({trancheId: row.trancheId, cap: row.cents})) : election.allocations.map(row => ({trancheId: row.trancheId, cap: row.maximumCents}));
    for (const allocation of allocations.sort((a, b) => a.trancheId.localeCompare(b.trancheId))) {
      const tranche = tranches.get(allocation.trancheId), group = tranche && groups.get(tranche.capacityGroupId);
      if (!tranche || !group) return refuse("source-not-accepted", "Choose a source from the current availability review.");
      if (typeof tranche.availableOn !== "string" || tranche.availableOn.length !== 10 || !isValidDateKey(tranche.availableOn) || tranche.availableOn > election.contributionOn || tranche.availableOn < liveBasis.asOf || tranche.availableOn > liveBasis.through) return refuse("availability-date-missing", "The contribution precedes its supported availability date.");
      // Up-to consumption can leave expected residuals below lower residuals.
      // A later fixed choice must fit both; initial bound ordering is not enough.
      if (election.kind === "fixed" && allocation.cap > Math.min(tranche.lower, tranche.expected, group.lower, group.expected)) return refuse("insufficient-lower-availability", "The fixed choice exceeds the remaining capacity on one of the reviewed paths.");
      const lower = Math.min(allocation.cap, tranche.lower, group.lower), expected = Math.min(allocation.cap, tranche.expected, group.expected);
      tranche.lower -= lower; tranche.expected -= expected; group.lower -= lower; group.expected -= expected;
      lowerCents += lower; expectedCents += expected;
      if (![tranche.lower, tranche.expected, group.lower, group.expected, lowerCents, expectedCents].every(value => Number.isSafeInteger(value) && value >= 0)) return refuse("unsafe-cents", "The remaining source amounts exceed supported cents.");
    }
    if (lowerCents || expectedCents) contributions.push({id: election.id, date: election.contributionOn, lowerCents, expectedCents, memberId: election.chosenByMemberId});
  }
  return {kind: "allocated", contributions};
}
