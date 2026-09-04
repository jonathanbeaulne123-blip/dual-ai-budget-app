import type { Household } from "../core/types.ts";
import { financialAuditFacts, financialAuditHash } from "../core/commandIdentity.ts";
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

export type AcceptedSnapshotRebuildCheck =
  | { ok: true; auditHash: string }
  | { ok: false; message: string };

/**
 * A receipt-gated local projection recovery may rebuild only from a snapshot that
 * still proves the canonical posted-money facts covered by the accepted receipt.
 * This never inspects cloud state and never weakens the normal PGlite gate.
 */
export async function acceptedSnapshotRebuildCheck(
  household: Household,
): Promise<AcceptedSnapshotRebuildCheck> {
  const acceptedHash = household.booksAcceptedHash?.trim();
  if (!acceptedHash) {
    return {
      ok: false,
      message: "The saved snapshot has no accepted-books receipt, so Hearth did not rebuild PGlite automatically. Recovery is available.",
    };
  }
  const actualHash = await financialAuditHash(household);
  if (actualHash !== acceptedHash) {
    return {
      ok: false,
      message: "The saved snapshot's receipt-covered money facts changed after acceptance, so Hearth did not rebuild PGlite automatically. Recovery is available.",
    };
  }
  return { ok: true, auditHash: acceptedHash };
}

export function knownMetadataUpdateAllowed(
  current: Household,
  next: Household,
  expectedCurrentRevision = next.revision,
): boolean {
  if (
    current.environment !== next.environment
    || current.householdId !== next.householdId
    || current.revision !== expectedCurrentRevision
    || JSON.stringify(current.herculesProPermissions) !== JSON.stringify(next.herculesProPermissions)
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
