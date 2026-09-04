import type { Environment, Household } from "./core/types.ts";

export const CLOUD_LEDGER_OFFLINE_MESSAGE =
  "Cloud-backed books are read-only while this device is offline. Reconnect, then Confirm again.";
export const CLOUD_LEDGER_AUTH_MESSAGE =
  "Continue with Google before changing these cloud-backed books. Nothing was posted.";
export const CLOUD_LEDGER_CLOUD_MESSAGE =
  "The cloud did not accept that change. The previous books are still live; retry with the same Confirm.";
export const CLOUD_LEDGER_PENDING_MESSAGE =
  "Hearth is finishing an earlier cloud-backed change. Wait for Up to date, then Confirm.";
export const CLOUD_LEDGER_REFRESH_MESSAGE =
  "Hearth is refreshing both Shared and Personal books. Wait for Up to date, then Confirm.";

/**
 * Launch safety mode. It is intentionally Development-only until the separate
 * Production continuity gate is authorized and proven.
 */
export function cloudLedgerOnlineRequiredEnabled(
  environment: Environment,
  configured?: string,
): boolean {
  const resolved = configured
    ?? String(
      import.meta.env.VITE_CLOUD_LEDGER_ONLINE_REQUIRED
      ?? import.meta.env.VITE_SHARED_ONLINE_REQUIRED
      ?? "",
    );
  return environment === "development" && resolved === "1";
}

/** Exact authority tuple proven by the last complete Shared + Personal cloud read. */
export function onlineRequiredReplicaKey(input: {
  environment: Environment;
  householdId: string;
  memberId: string;
  revision: number;
}): string {
  return [input.environment, input.householdId, input.memberId, input.revision].join(":");
}

export type ReplicaAdoptionScope = {
  generation: number;
  environment: Environment;
  householdId: string | null;
  memberId: string | null;
};

/** Prevent an awaited cloud projection install from crossing a ledger/member/environment switch. */
export function replicaAdoptionScopeMatches(
  expected: ReplicaAdoptionScope,
  current: ReplicaAdoptionScope,
): boolean {
  return expected.generation === current.generation
    && expected.environment === current.environment
    && expected.householdId === current.householdId
    && expected.memberId === current.memberId;
}

/** Revision-only dedupe is unsafe when the paired Shared or Personal facts differ. */
export function revisionDedupeMaySkipPairedAdoption(
  pairedFactsDiffer: boolean,
  revisionDuplicate: boolean,
): boolean {
  return !pairedFactsDiffer && revisionDuplicate;
}

/** A lagging paired read may block readiness, but it can never replace newer accepted books. */
export function pairedCloudRevisionGate(input: {
  remoteRevision: number;
  localRevision: number;
  localBaseRevision: number;
}): { mayAdopt: boolean; readinessRevision: number | null } {
  const mayAdopt = input.remoteRevision >= input.localBaseRevision;
  return {
    mayAdopt,
    readinessRevision: mayAdopt
      && input.remoteRevision === input.localRevision
      && input.remoteRevision === input.localBaseRevision
      ? input.remoteRevision
      : null,
  };
}

export type CloudLedgerWriteGateInput = {
  environment: Environment;
  /** True when this household has cloud authority for either Personal or Shared books. */
  cloudBackedHousehold: boolean;
  online: boolean;
  authEnabled: boolean;
  authSessionPresent: boolean;
  membershipMatches: boolean;
  completeReplicaReady?: boolean;
  pendingOutboxCount?: number;
  hasUnacknowledgedSnapshot?: boolean;
  configured?: string;
};

export function cloudLedgerWriteGate(input: CloudLedgerWriteGateInput): {
  required: boolean;
  allowed: boolean;
  reason: string | null;
} {
  const required = input.cloudBackedHousehold
    && cloudLedgerOnlineRequiredEnabled(input.environment, input.configured);
  if (!required) return { required: false, allowed: true, reason: null };
  if (!input.online) return { required, allowed: false, reason: CLOUD_LEDGER_OFFLINE_MESSAGE };
  if ((input.pendingOutboxCount ?? 0) > 0 || input.hasUnacknowledgedSnapshot) {
    return { required, allowed: false, reason: CLOUD_LEDGER_PENDING_MESSAGE };
  }
  if (!input.authEnabled || !input.authSessionPresent || !input.membershipMatches) {
    return { required, allowed: false, reason: CLOUD_LEDGER_AUTH_MESSAGE };
  }
  if (input.completeReplicaReady === false) {
    return { required, allowed: false, reason: CLOUD_LEDGER_REFRESH_MESSAGE };
  }
  return { required, allowed: true, reason: null };
}

/**
 * A derived PGlite projection may be replaced automatically only from a cloud
 * snapshot whose receipt still proves its financial facts. Pending local work
 * and conflicts always keep recovery fail-closed.
 */
export function canRepairProjectionFromAcknowledgedCache(input: {
  snapshot: Household;
  pendingOutboxCount: number;
  hasOpenConflict: boolean;
}): { allowed: boolean; reason: string | null } {
  if (input.pendingOutboxCount > 0) {
    return { allowed: false, reason: "This device still has an unacknowledged shared change." };
  }
  if (input.hasOpenConflict) {
    return { allowed: false, reason: "This household still has a continuity conflict." };
  }
  if (input.snapshot.sharing?.mode !== "synchronized") {
    return { allowed: false, reason: "The cached snapshot is not cloud-acknowledged." };
  }
  if ((input.snapshot.baseRevision ?? 0) !== input.snapshot.revision) {
    return { allowed: false, reason: "The cached snapshot is ahead of its cloud acknowledgement." };
  }
  if (!input.snapshot.booksAcceptedHash?.trim()) {
    return { allowed: false, reason: "The acknowledged snapshot has no accepted-books receipt." };
  }
  return { allowed: true, reason: null };
}

type BoundOutboxTip = {
  householdId: string;
  memberId: string;
  environment: Environment;
  expectedRevision: number;
  tipRevision: number;
  confirmationIds: string[];
  blockedByConflict: boolean;
};

/**
 * Upgrade bridge for a pre-launch durable tip. The derived projection may be
 * restored to the exact accepted JSON on either side of the old crash window;
 * the still-durable idempotency marker then resolves against cloud normally.
 */
export function canRepairProjectionWithBoundOutbox(input: {
  snapshot: Household;
  items: BoundOutboxTip[];
  hasOpenConflict: boolean;
}): { allowed: boolean; reason: string | null } {
  if (input.hasOpenConflict) {
    return { allowed: false, reason: "This household still has a continuity conflict." };
  }
  if (!input.snapshot.booksAcceptedHash?.trim()) {
    return { allowed: false, reason: "The cached snapshot has no accepted-books receipt." };
  }
  const matching = input.items.filter((item) =>
    item.householdId === input.snapshot.householdId
    && item.environment === input.snapshot.environment
    && input.snapshot.members.some((member) => member.id === item.memberId && member.active),
  );
  if (matching.length !== 1 || matching[0]!.blockedByConflict) {
    return { allowed: false, reason: "The in-flight shared change is not uniquely bound to these books." };
  }
  const item = matching[0]!;
  const snapshotRevision = input.snapshot.revision ?? 0;
  const baseRevision = input.snapshot.baseRevision ?? 0;
  if (snapshotRevision === item.expectedRevision && baseRevision === snapshotRevision && item.tipRevision > snapshotRevision) {
    return { allowed: true, reason: null };
  }
  if (
    snapshotRevision === item.tipRevision
    && baseRevision === item.expectedRevision
    && item.confirmationIds.length > 0
    && item.confirmationIds.every((id) => input.snapshot.commandReceipts.some((receipt) => receipt.confirmationId === id))
  ) {
    return { allowed: true, reason: null };
  }
  return { allowed: false, reason: "The in-flight shared change does not match this accepted snapshot revision." };
}
