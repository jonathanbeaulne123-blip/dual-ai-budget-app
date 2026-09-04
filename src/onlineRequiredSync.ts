import type { Environment, Household } from "./core/types.ts";

export const ONLINE_REQUIRED_OFFLINE_MESSAGE =
  "Shared books are read-only while this device is offline. Reconnect, then Confirm again.";
export const ONLINE_REQUIRED_AUTH_MESSAGE =
  "Continue with Google before changing the shared books. Nothing was posted.";
export const ONLINE_REQUIRED_CLOUD_MESSAGE =
  "The shared cloud did not accept that change. The previous books are still live; retry with the same Confirm.";
export const ONLINE_REQUIRED_PENDING_MESSAGE =
  "Hearth is finishing an earlier shared change. Wait for Up to date, then Confirm.";

/**
 * Launch safety mode. Development defaults to online-required so a missing
 * build variable cannot silently restore local-first shared writes. An explicit
 * `0` remains a rollback switch. Production stays outside this policy until its
 * separate continuity gate is authorized and proven.
 */
export function onlineRequiredSharedSyncEnabled(
  environment: Environment,
  configured = String(import.meta.env.VITE_SHARED_ONLINE_REQUIRED ?? "1"),
): boolean {
  return environment === "development" && configured === "1";
}

export type OnlineRequiredWriteGateInput = {
  environment: Environment;
  /** True for a membership-scoped shared write, including first household creation. */
  sharedScope: boolean;
  online: boolean;
  authEnabled: boolean;
  authSessionPresent: boolean;
  membershipMatches: boolean;
  pendingOutboxCount?: number;
  hasUnacknowledgedSnapshot?: boolean;
  configured?: string;
};

export function onlineRequiredWriteGate(input: OnlineRequiredWriteGateInput): {
  required: boolean;
  allowed: boolean;
  reason: string | null;
} {
  const required = input.sharedScope
    && onlineRequiredSharedSyncEnabled(input.environment, input.configured);
  if (!required) return { required: false, allowed: true, reason: null };
  if (!input.online) return { required, allowed: false, reason: ONLINE_REQUIRED_OFFLINE_MESSAGE };
  if ((input.pendingOutboxCount ?? 0) > 0 || input.hasUnacknowledgedSnapshot) {
    return { required, allowed: false, reason: ONLINE_REQUIRED_PENDING_MESSAGE };
  }
  if (!input.authEnabled || !input.authSessionPresent || !input.membershipMatches) {
    return { required, allowed: false, reason: ONLINE_REQUIRED_AUTH_MESSAGE };
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
