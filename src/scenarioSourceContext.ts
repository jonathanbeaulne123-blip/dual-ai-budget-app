import type { Household, Environment } from "./core/types.ts";
import type { ScenarioAcceptedSource } from "./core/scenarioSources.ts";
import type { ScenarioScope } from "./core/fundScenario.ts";

/** App-issued source. A child may simulate only while this exact accepted context is current. */
export type ScenarioSourceContext = Readonly<{
  household: Household;
  accepted: ScenarioAcceptedSource;
  isCurrent: () => boolean;
}>;
export type ScenarioAuthIdentity = Readonly<{userId: string; sessionId: string; googleSubject: string}>;
export function scenarioAuthIdentityKey(environment: Environment, auth: ScenarioAuthIdentity | null): string {
  return JSON.stringify([environment, auth?.userId ?? null, auth?.sessionId ?? null, auth?.googleSubject ?? null]);
}
export type ScenarioPairScope = Readonly<{
  environment: Environment; householdId: string; memberId: string; subject: string;
  authIdentityKey: string; authorityMode: "v2" | "legacy"; pairEpoch: number;
}>;
export function scenarioPairScopeKey(scope: ScenarioPairScope): string {
  return JSON.stringify([scope.environment, scope.householdId, scope.memberId, scope.subject, scope.authIdentityKey, scope.authorityMode, scope.pairEpoch]);
}
export type ScenarioPairLease = Readonly<{household: Household; scopeKey: string; acceptedStateId: string; acceptanceEpoch: number}>;

/** Called only at App's proven complete Shared + own Personal acceptance points. */
export function acceptedScenarioPair(household: Household, scope: ScenarioPairScope, acceptanceEpoch: number): ScenarioPairLease | null {
  if (household.environment !== scope.environment || household.householdId !== scope.householdId || !scope.subject
    || !household.members.some(row => row.id === scope.memberId && row.active) || !Number.isSafeInteger(household.revision)
    || typeof household.booksAcceptedHash !== "string" || !household.booksAcceptedHash
    || !Number.isSafeInteger(acceptanceEpoch) || acceptanceEpoch < 0) return null;
  const scopeKey = scenarioPairScopeKey(scope);
  return {household, scopeKey, acceptanceEpoch, acceptedStateId: JSON.stringify(["scenario-accepted-1", household.revision, household.booksAcceptedHash, acceptanceEpoch])};
}

/** A matching validated Shared cache alone never establishes Personal completeness. */
export function issueScenarioSource(input: {
  household: Household | null;
  scope: ScenarioPairScope | null;
  viewerRoom: "household" | "personal";
  roomGeneration: number;
  booksReady: boolean;
  lease: ScenarioPairLease | null;
  isCurrent: () => boolean;
}): ScenarioSourceContext | null {
  const {household: h, scope, lease} = input;
  if (!h || !h.householdFund || !scope || !input.booksReady || h.environment !== scope.environment
    || h.householdId !== scope.householdId || !scope.subject || !h.booksAcceptedHash) return null;
  const ownReady = lease?.household === h && lease.scopeKey === scenarioPairScopeKey(scope);
  const scenarioScope: ScenarioScope = {environment: scope.environment, householdId: scope.householdId, memberId: scope.memberId,
    subject: scope.subject, viewerRoom: input.viewerRoom, targetRoom: "household", fundId: h.householdFund.id,
    authorityGeneration: `${scope.pairEpoch}:${input.roomGeneration}:${lease?.acceptanceEpoch ?? "unavailable"}`};
  const acceptedStateId = ownReady ? lease.acceptedStateId : JSON.stringify(["scenario-shared-only-1", h.householdId, h.revision, h.booksAcceptedHash, scope.pairEpoch]);
  return {household: h, accepted: {kind: "accepted", scope: scenarioScope, acceptedRevision: h.revision, acceptedStateId, ownBooks: ownReady ? "ready" : "unavailable"}, isCurrent: input.isCurrent};
}
