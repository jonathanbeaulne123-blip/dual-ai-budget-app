import { isValidDateKey } from "./calendar.ts";
import { reviewFundScenarioRequest, type FundScenarioRequest, type ScenarioBasis, type ScenarioRefusal } from "./fundScenario.ts";
import type { EarningsAvailability } from "./earningsAvailability.ts";
import type { Household } from "./types.ts";
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
  for (const election of [...request.elections].sort((a, b) => a.contributionOn.localeCompare(b.contributionOn) || a.id.localeCompare(b.id))) {
    if (election.kind !== "fixed") return refuse("forecast-model-unsupported", "This cash stage supports a fixed contribution choice.");
    for (const allocation of election.allocations) {
      const tranche = tranches.get(allocation.trancheId), group = tranche && groups.get(tranche.capacityGroupId);
      if (!tranche || !group) return refuse("source-not-accepted", "Choose a source from the current availability review.");
      if (typeof tranche.availableOn !== "string" || tranche.availableOn.length !== 10 || !isValidDateKey(tranche.availableOn) || tranche.availableOn > election.contributionOn || tranche.availableOn < liveBasis.asOf || tranche.availableOn > liveBasis.through) return refuse("availability-date-missing", "The contribution precedes its supported availability date.");
      if (allocation.cents > tranche.lower || allocation.cents > group.lower) return refuse("insufficient-lower-availability", "The fixed choice exceeds the remaining lower source capacity.");
      tranche.lower -= allocation.cents; tranche.expected -= allocation.cents;
      group.lower -= allocation.cents; group.expected -= allocation.cents;
    }
    if (election.chosenCents > 0) contributions.push({id: election.id, date: election.contributionOn, lowerCents: election.chosenCents, expectedCents: election.chosenCents, memberId: election.chosenByMemberId});
  }
  return {kind: "allocated", contributions};
}
