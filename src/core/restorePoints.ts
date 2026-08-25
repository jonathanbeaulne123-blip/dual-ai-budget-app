import { TIMEZONE } from "./calendar.ts";
import { financialAuditHash } from "./commandIdentity.ts";
import { nextId } from "./ids.ts";
import { assembleHousehold, ensureHouseholdShape, splitForSync } from "./sync.ts";
import { unresolvedConflicts } from "./conflict.ts";
import { ValidationError, type Household, type RestorePoint, type SharedEnvelope } from "./types.ts";

export const RESTORE_POINT_RETENTION_DAYS = 30;
export const RESTORE_POINT_MAX = 40;

function nowIso(): string {
  return new Date().toISOString();
}

function pruneRestorePoints(points: RestorePoint[], now = Date.now()): RestorePoint[] {
  const cutoff = now - RESTORE_POINT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return [...points]
    .filter((point) => Date.parse(point.createdAt) >= cutoff)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, RESTORE_POINT_MAX);
}

/** Shared money fingerprint stored on each restore point. */
export async function sharedMoneyAuditHash(household: Household, memberId: string): Promise<string> {
  const { shared } = splitForSync(household, memberId);
  const projected = assembleHousehold(shared, null, { linked: household.linked });
  return financialAuditHash(projected);
}

export function restorePointLabel(createdAt: string): string {
  try {
    const date = new Date(createdAt);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return createdAt.slice(0, 16).replace("T", " ");
  }
}

export async function appendRestorePoint(
  household: Household,
  memberId: string,
): Promise<Household> {
  const shaped = ensureHouseholdShape(household);
  const { shared } = splitForSync(shaped, memberId);
  const sharedMoneyHash = await sharedMoneyAuditHash(shaped, memberId);
  const existing = shaped.restorePoints ?? [];
  // Skip duplicate tip (same revision already recorded).
  if (existing.some((point) => point.sourceRevision === shaped.revision)) {
    return shaped;
  }
  const createdAt = nowIso();
  const point: RestorePoint = {
    id: nextId("RP-", existing.map((row) => row.id), 4),
    createdAt,
    sourceRevision: shaped.revision,
    createdByMemberId: memberId,
    label: restorePointLabel(createdAt),
    sharedMoneyHash,
    shared: {
      ...shared,
      // Never nest restore history inside a point.
      restorePoints: undefined,
    } as SharedEnvelope,
  };
  return {
    ...shaped,
    restorePoints: pruneRestorePoints([point, ...existing]),
  };
}

export type RestoreEligibility =
  | { ok: true }
  | {
    ok: false;
    code: "open-conflict" | "not-owner" | "missing" | "not-ready";
    message: string;
  };

/**
 * Q8 A: refuse Restore while dual-use is unresolved (open conflict / conflicted
 * sharing). Once synchronized, owner may Restore; later shared posts leave after Confirm.
 */
export function canRestorePoint(
  household: Household,
  point: RestorePoint | undefined,
  input: { isOwner: boolean },
): RestoreEligibility {
  if (!input.isOwner) {
    return {
      ok: false,
      code: "not-owner",
      message: "Only a household owner can Restore a sync point.",
    };
  }
  if (!point) {
    return { ok: false, code: "missing", message: "That restore point is gone." };
  }
  if (unresolvedConflicts(household).length > 0 || household.sharing?.mode === "conflicted") {
    return {
      ok: false,
      code: "open-conflict",
      message: "Finish the open conflict first, then Restore.",
    };
  }
  if (household.sharing?.mode === "pending-transport" || household.sharing?.pending) {
    return {
      ok: false,
      code: "not-ready",
      message: "Wait until sharing finishes, then Restore.",
    };
  }
  return { ok: true };
}

/** Apply shared tip from a restore point; keep this member's Personal. */
export function applyRestorePoint(
  household: Household,
  point: RestorePoint,
  memberId: string,
): Household {
  const gate = canRestorePoint(household, point, { isOwner: true });
  if (!gate.ok) throw new ValidationError(gate.message);

  const localParts = splitForSync(household, memberId);
  const pointShared: SharedEnvelope = {
    ...point.shared,
    householdId: household.householdId,
    environment: household.environment,
    inviteCode: household.inviteCode || point.shared.inviteCode,
    revision: household.revision,
    restorePoints: household.restorePoints,
    conflicts: (household.conflicts ?? []).map((row) => ({ ...row, resolved: true })),
    commandReceipts: household.commandReceipts ?? [],
  };
  const assembled = assembleHousehold(pointShared, localParts.personal, { linked: true });
  const at = nowIso();
  return ensureHouseholdShape({
    ...assembled,
    revision: household.revision,
    baseRevision: household.baseRevision,
    linked: true,
    restorePoints: household.restorePoints,
    activity: [
      ...(assembled.activity ?? []),
      {
        id: nextId("ACT-", (assembled.activity ?? []).map((item) => item.id), 6),
        at,
        action: "Restore",
        summary: `Restored shared books to ${point.label}`,
        updatedAt: at,
      },
    ].slice(-200),
    lastCommittedAt: at,
  });
}

export function listRestorePoints(household: Household): RestorePoint[] {
  return pruneRestorePoints(household.restorePoints ?? []);
}

export function restoreConfirmBody(point: RestorePoint): string {
  return `Replace shared books with the copy from ${point.label}. Money posted after that time leaves the shared books. Your Personal rows stay. This cannot use Undo — take a new sync after if you need another Restore point.`;
}
