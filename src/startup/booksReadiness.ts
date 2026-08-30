import type { Household } from "../core/types.ts";
import { financialAuditFacts } from "../core/commandIdentity.ts";
import type { BooksRecoveryIssue, BooksStatus } from "../ledger/engine.ts";

export type BooksReadinessPhase = "loading-cache" | "validating" | "ready" | "blocked";

export type BooksReadiness = {
  phase: BooksReadinessPhase;
  generation: number;
  environment?: Household["environment"];
  householdId?: string;
  revision?: number;
  status?: BooksStatus;
  issue?: BooksRecoveryIssue;
  message?: string;
};

export type BooksWriteGate = {
  ready: boolean;
  reason: string | null;
};

export function knownMetadataUpdateAllowed(
  current: Household,
  next: Household,
  expectedCurrentRevision = next.revision,
): boolean {
  if (
    current.environment !== next.environment
    || current.householdId !== next.householdId
    || current.revision !== expectedCurrentRevision
  ) return false;
  return JSON.stringify(financialAuditFacts(current)) === JSON.stringify(financialAuditFacts(next));
}

export function readinessForHousehold(
  phase: Exclude<BooksReadinessPhase, "loading-cache">,
  generation: number,
  household: Household,
  details: Pick<BooksReadiness, "status" | "issue" | "message"> = {},
): BooksReadiness {
  return {
    phase,
    generation,
    environment: household.environment,
    householdId: household.householdId,
    revision: household.revision,
    ...details,
  };
}

export function readinessMatches(readiness: BooksReadiness, household: Household | null): boolean {
  return Boolean(
    household
    && readiness.environment === household.environment
    && readiness.householdId === household.householdId
    && readiness.revision === household.revision,
  );
}

export function booksWriteGate(readiness: BooksReadiness, household: Household | null): BooksWriteGate {
  if (readiness.phase === "ready" && readinessMatches(readiness, household)) {
    return { ready: true, reason: null };
  }
  if (readiness.phase === "blocked" && readinessMatches(readiness, household)) {
    return {
      ready: false,
      reason: readiness.message || "These cached books need attention before anything can be changed.",
    };
  }
  return {
    ready: false,
    reason: "Hearth is validating the local journal. You can look around, but Confirm stays locked for a moment.",
  };
}
