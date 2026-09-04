import type { Environment, Household } from "../types.ts";

export type HouseholdScopeFailure =
  | "missing-auth"
  | "missing-partner-membership"
  | "ambiguous-household-scope"
  | "revoked-membership"
  | "offline-cached-identity"
  | "probe-failed"
  | "scope-changed";

export type HouseholdScopeRef = {
  environment: Environment;
  householdId: string | null;
  memberId: string;
};

/**
 * Sanitized, transient output from the browser/Auth adapter. This value may be
 * passed into pure core projectors, but it is never persisted on Household.
 */
export type HouseholdScopeObservation =
  | { kind: "checking"; scope: HouseholdScopeRef }
  | { kind: "blocked"; scope: HouseholdScopeRef; reason: HouseholdScopeFailure }
  | {
    kind: "resolved";
    scope: HouseholdScopeRef & { householdId: string };
    currentMemberId: string;
    seatMemberIds: string[];
    observedAt: string;
  };

export type ValidatedHouseholdScope = {
  kind: "accepted";
  memberIds: string[];
  observedAt: string;
};

export type HouseholdScopeValidation =
  | { kind: "checking" }
  | ValidatedHouseholdScope
  | { kind: "blocked"; reason: HouseholdScopeFailure };

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function householdScopeRef(
  household: Household,
  memberId: string,
  householdId: string | null = household.householdId,
): HouseholdScopeRef {
  return { environment: household.environment, householdId, memberId };
}

/** Pure Chapter 2 gate. Live I/O belongs in src/onboardingHouseholdScope.ts. */
export function validateHouseholdScopeObservation(
  household: Household,
  viewerMemberId: string,
  observation?: HouseholdScopeObservation | null,
): HouseholdScopeValidation {
  if (!observation || observation.kind === "checking") {
    return { kind: "checking" };
  }
  if (observation.kind === "blocked") return observation;

  const { scope } = observation;
  if (
    scope.environment !== household.environment
    || scope.householdId !== household.householdId
    || scope.memberId !== viewerMemberId
    || observation.currentMemberId !== viewerMemberId
  ) {
    return { kind: "blocked", reason: "scope-changed" };
  }
  if (!scope.householdId) return { kind: "blocked", reason: "ambiguous-household-scope" };
  if (!observation.observedAt.trim() || Number.isNaN(Date.parse(observation.observedAt))) {
    return { kind: "blocked", reason: "scope-changed" };
  }

  const localMemberIds = uniqueSorted(household.members
    .filter((member) => member.active)
    .map((member) => member.id));
  const liveMemberIds = uniqueSorted(observation.seatMemberIds);
  if (
    localMemberIds.length !== 2
    || liveMemberIds.length !== 2
    || localMemberIds.some((memberId, index) => memberId !== liveMemberIds[index])
  ) {
    return { kind: "blocked", reason: "missing-partner-membership" };
  }

  return {
    kind: "accepted",
    memberIds: liveMemberIds,
    observedAt: new Date(observation.observedAt).toISOString(),
  };
}
