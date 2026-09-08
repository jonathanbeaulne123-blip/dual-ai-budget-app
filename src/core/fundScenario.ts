import { calendarDaysBetween, isValidDateKey, type DateKey } from "./calendar.ts";
import { askBelongsOnDesk } from "./askView.ts";
import type { Environment, Household } from "./types.ts";

export const SCENARIO_MAX_DAYS = 31;
export type ScenarioScope = Readonly<{
  environment: Environment;
  householdId: string;
  memberId: string;
  subject: string;
  viewerRoom: "household" | "personal";
  /** Personal can host the instrument; its target is still explicitly the Shared Fund. */
  targetRoom: "household";
  fundId: string;
  authorityGeneration: string;
}>;
export type ScenarioBasis = Readonly<{
  scope: ScenarioScope;
  acceptedRevision: number;
  acceptedStateId: string;
  sharedFactsDigest: string;
  ownSourceFactsDigest: string;
  asOf: DateKey;
  through: DateKey;
}>;
export type ScenarioRefusalCode =
  | "scope-mismatch" | "baseline-stale" | "baseline-untied" | "fund-missing" | "member-ineligible"
  | "source-not-accepted" | "source-not-owned" | "source-remaining-unknown" | "source-overallocated"
  | "cash-card-split-missing" | "availability-date-missing" | "tipout-timing-missing" | "forecast-model-unsupported"
  | "insufficient-lower-availability" | "replacement-missing" | "replacement-not-observed"
  | "replacement-scope-mismatch" | "replacement-duplicated" | "zero-election-replacement"
  | "outside-horizon" | "unsafe-cents" | "invalid-election" | "route-unavailable";
export type ScenarioRefusal = Readonly<{ code: ScenarioRefusalCode; message: string; sourceId?: string }>;
export type EstimateReplacement = Readonly<{ id: string; factsDigest: string }>;
type ElectionBase = Readonly<{
  id: string;
  chosenByMemberId: string;
  contributionOn: DateKey;
  replaces: readonly EstimateReplacement[];
}>;
export type FixedContributionElection = ElectionBase & Readonly<{
  kind: "fixed";
  chosenCents: number;
  allocations: readonly Readonly<{ trancheId: string; cents: number }>[];
}>;
/** Explicit optional policy: contribute available cents up to a chosen CAD cap, never an inferred default. */
export type AvailableContributionElection = ElectionBase & Readonly<{
  kind: "available-up-to";
  maximumCents: number;
  allocations: readonly Readonly<{ trancheId: string; maximumCents: number }>[];
}>;
export type ContributionElection = FixedContributionElection | AvailableContributionElection;
export type FundScenarioRequest = Readonly<{ version: 1; basis: ScenarioBasis; elections: readonly ContributionElection[] }>;
export type ScenarioRequestReview =
  | Readonly<{ kind: "refused"; reasons: readonly ScenarioRefusal[] }>
  | Readonly<{ kind: "request-reviewed"; request: FundScenarioRequest }>;

const text = (value: unknown): value is string => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= 512;
const date = (value: unknown): value is string => typeof value === "string" && value.length === 10 && isValidDateKey(value);
const cents = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const refuse = (code: ScenarioRefusalCode, message: string): ScenarioRequestReview => ({ kind: "refused", reasons: [{ code, message }] });
const scopeFields = ["environment", "householdId", "memberId", "subject", "viewerRoom", "targetRoom", "fundId", "authorityGeneration"] as const;
const basisFields = ["acceptedRevision", "acceptedStateId", "sharedFactsDigest", "ownSourceFactsDigest", "asOf", "through"] as const;

/**
 * Reviews the shape, scope and intent of an in-memory request, not its source availability.
 * liveBasis belongs to the accepted-state adapter. This result is NOT a Fund projection,
 * proof of available money, or permission to post. The source resolver and shared fold follow.
 */
export function reviewFundScenarioRequest(household: Household, liveBasis: ScenarioBasis, request: FundScenarioRequest): ScenarioRequestReview {
  const live = liveBasis?.scope;
  if (!household.householdFund) return refuse("fund-missing", "The Shared Fund is not configured.");
  if (!live || live.environment !== household.environment || live.householdId !== household.householdId || live.fundId !== household.householdFund.id
    || !scopeFields.every(field => text(live[field])) || !["personal", "household"].includes(live.viewerRoom) || live.targetRoom !== "household") {
    return refuse("scope-mismatch", "Open the scenario again in your current room.");
  }
  if (!household.members.some(member => member.id === live.memberId && member.active)
    || !askBelongsOnDesk(live.memberId, household.householdFund.custodianMemberId)) return refuse("member-ineligible", "This scenario belongs to the contributing member.");
  if (request?.version !== 1 || !request.basis?.scope || !scopeFields.every(field => request.basis.scope[field] === live[field])) return refuse("scope-mismatch", "Open the scenario again in your current room.");
  if (!Number.isSafeInteger(liveBasis.acceptedRevision) || liveBasis.acceptedRevision !== household.revision
    || ![liveBasis.acceptedStateId, liveBasis.sharedFactsDigest, liveBasis.ownSourceFactsDigest].every(text)
    || !basisFields.every(field => request.basis[field] === liveBasis[field])) return refuse("baseline-stale", "The accepted books changed. Review this scenario again.");
  if (!date(liveBasis.asOf) || !date(liveBasis.through) || liveBasis.through < liveBasis.asOf
    || calendarDaysBetween(liveBasis.asOf, liveBasis.through) + 1 > SCENARIO_MAX_DAYS) return refuse("outside-horizon", "Choose an inclusive horizon of no more than 31 days.");
  if (!Array.isArray(request.elections) || request.elections.length > 64) return refuse("invalid-election", "Review the dated contribution choices.");
  const electionIds = new Set<string>(), replacementIds = new Set<string>();
  let combinedCents = 0;
  for (const election of request.elections) {
    if (!election || !text(election.id) || electionIds.has(election.id) || !["fixed", "available-up-to"].includes(election.kind)
      || !Array.isArray(election.allocations) || election.allocations.length > 64 || !Array.isArray(election.replaces) || election.replaces.length > 64) return refuse("invalid-election", "Each contribution choice needs one distinct identity and its source allocations.");
    electionIds.add(election.id);
    if (election.chosenByMemberId !== live.memberId) return refuse("source-not-owned", "Only your own contribution choices belong in this scenario.");
    if (!date(election.contributionOn) || election.contributionOn < liveBasis.asOf || election.contributionOn > liveBasis.through) return refuse("outside-horizon", "The chosen contribution date is outside this scenario.");
    const chosen = election.kind === "fixed" ? election.chosenCents : election.maximumCents;
    if (!cents(chosen) || !Number.isSafeInteger(combinedCents + chosen)) return refuse("unsafe-cents", "Use a supported nonnegative whole number of cents.");
    combinedCents += chosen;
    let total = 0;
    const trancheIds = new Set<string>();
    for (const allocation of election.allocations) {
      if (!allocation || !text(allocation.trancheId) || trancheIds.has(allocation.trancheId)) return refuse("invalid-election", "Use each source once within this choice.");
      trancheIds.add(allocation.trancheId);
      const amount = election.kind === "fixed" ? (allocation as FixedContributionElection["allocations"][number]).cents : (allocation as AvailableContributionElection["allocations"][number]).maximumCents;
      if (!cents(amount) || !Number.isSafeInteger(total + amount)) return refuse("unsafe-cents", "Source allocations exceed the supported cent range.");
      total += amount;
    }
    if (total !== chosen) return refuse("invalid-election", "The source allocations must equal the chosen amount or cap.");
    if (chosen === 0 && election.replaces.length) return refuse("zero-election-replacement", "Choosing zero leaves the baseline estimates in place.");
    for (const replacement of election.replaces) {
      if (!replacement || !text(replacement.id) || !text(replacement.factsDigest)) return refuse("replacement-missing", "Review the exact estimate before replacing it.");
      if (replacementIds.has(replacement.id)) return refuse("replacement-duplicated", "An estimate can be replaced only once.");
      replacementIds.add(replacement.id);
    }
  }
  return { kind: "request-reviewed", request: structuredClone(request) };
}
