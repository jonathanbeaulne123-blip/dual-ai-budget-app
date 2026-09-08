import { reviewFundScenarioRequest, type FundScenarioRequest, type ScenarioRefusal } from "./fundScenario.ts";
import { reviewScenarioSources, type ScenarioAcceptedSource } from "./scenarioSources.ts";
import type { CashAvailabilityAssumption, EarningsAvailability, AvailableTranche } from "./earningsAvailability.ts";
import type { Household } from "./types.ts";
const unavailable = (code: ScenarioRefusal["code"], message: string): EarningsAvailability => ({kind: "unavailable", reasons: [{code, message}]});

/** Re-resolve accepted records. Caller-supplied availability arrays never become authority. */
export async function resolveCashAvailability(household: Household, accepted: ScenarioAcceptedSource, request: FundScenarioRequest, assumptions: readonly CashAvailabilityAssumption[]): Promise<EarningsAvailability> {
  const h = structuredClone(household), marker = structuredClone(accepted), choice = structuredClone(request), inputs = structuredClone(assumptions);
  const sources = await reviewScenarioSources(h, marker, choice.basis.asOf, choice.basis.through);
  if (sources.kind === "unavailable") return sources;
  const reviewed = reviewFundScenarioRequest(h, sources.basis, choice);
  if (reviewed.kind === "refused") return {kind: "unavailable", reasons: reviewed.reasons};
  if (!Array.isArray(inputs) || inputs.length > 64) return unavailable("invalid-election", "Review the available cash assumptions.");
  const seen = new Set<string>(), tranches: AvailableTranche[] = [];
  let assumedTotal = 0;
  for (const assumption of inputs) {
    if (!assumption || typeof assumption.accountId !== "string") return unavailable("invalid-election", "Review the exact cash source.");
    if (assumption.chosenByMemberId !== marker.scope.memberId) return unavailable("source-not-owned", "Choose only your own cash source.");
    const account = sources.cashAccounts.find(account => account.accountId === assumption.accountId);
    if (!account) return unavailable("source-not-owned", "That cash account is not available in your accepted Personal books.");
    if (seen.has(account.accountId)) return unavailable("source-overallocated", "One cash account cannot create a second available allowance.");
    seen.add(account.accountId);
    if (assumption.reviewedFactsDigest !== account.factsDigest) return unavailable("baseline-stale", "That source changed. Review the cash assumption again.");
    if (assumption.acknowledgesUnattributedCommitments !== true) return unavailable("source-remaining-unknown", "State the amount you assume remains after earlier contributions and other commitments.");
    if (!Number.isSafeInteger(assumption.availableCents) || assumption.availableCents < 0 || !Number.isSafeInteger(assumedTotal + assumption.availableCents)) return unavailable("unsafe-cents", "Use a supported whole number of cents for the cash assumption.");
    assumedTotal += assumption.availableCents;
    if (assumption.availableCents > Math.max(0, account.recordedCapacityCents) || assumedTotal > sources.cashCapacityLimitCents) return unavailable("source-overallocated", "The assumption exceeds recorded cash capacity after known tip-out liabilities.");
    const id = `cash:${account.accountId}`;
    tranches.push({id, source: {kind: "member-assumption", id: account.accountId, ownerMemberId: marker.scope.memberId, factsDigest: account.factsDigest}, component: "cash", availableOn: sources.basis.asOf,
      lowerCents: assumption.availableCents, expectedCents: assumption.availableCents, capacityGroupId: id, evidence: "member-assumption", deductions: []});
  }
  return {kind: "available", basis: sources.basis, modelVersion: "cash-assumption-1", tranches,
    capacityGroups: tranches.map(tranche => ({id: tranche.capacityGroupId, lowerCents: tranche.lowerCents, expectedCents: tranche.expectedCents})),
    assumptions: inputs.length ? ["Available cash is your explicit assumption after earlier Fund contributions, spending, goals and other commitments; the books do not establish source-account attribution.",
      "Immediate and paid tip-outs are already in recorded account balances. Known unpaid deferred tip-outs reduce member-wide capacity once. Paid counters have no exact source allocation; their aggregate payment check does not verify available money.",
      ...(sources.timingComplete ? [] : ["Some older tip-out timing is unknown; the assumed available amount must also cover those commitments."])] : []};
}
