import { TIMEZONE } from "./calendar.ts";
import { financialAuditHash } from "./commandIdentity.ts";
import { nextId } from "./ids.ts";
import { assembleHousehold, ensureHouseholdShape, splitForSync } from "./sync.ts";
import { unresolvedConflicts } from "./conflict.ts";
import { belongsToSharedLedger } from "./visibility.ts";
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

/**
 * Shared tip payload only — no Personal rows, no nested restore history.
 * Restore points travel inside the household snapshot; they must never smuggle
 * another member's personal ledger into the shared tip.
 */
export function sharedEnvelopeForRestorePoint(shared: SharedEnvelope): SharedEnvelope {
  const sharedGoals = (shared.goals ?? []).filter((goal) => goal.shared);
  const sharedGoalIds = new Set(sharedGoals.map((goal) => goal.id));
  return {
    ...shared,
    kind: "shared",
    transactions: (shared.transactions ?? []).filter((tx) => belongsToSharedLedger(tx)),
    shifts: (shared.shifts ?? []).filter((shift) => belongsToSharedLedger(shift)),
    goals: sharedGoals,
    goalContributions: (shared.goalContributions ?? []).filter((row) => sharedGoalIds.has(row.goalId)),
    goalPurchases: (shared.goalPurchases ?? []).filter((row) => sharedGoalIds.has(row.goalId)),
    restorePoints: undefined,
  };
}

/** Shared money fingerprint stored on each restore point. */
export async function sharedMoneyAuditHash(household: Household, memberId: string): Promise<string> {
  const { shared } = splitForSync(household, memberId);
  const projected = assembleHousehold(sharedEnvelopeForRestorePoint(shared), null, { linked: household.linked });
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
    shared: sharedEnvelopeForRestorePoint(shared),
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
  input: { isOwner: boolean } = { isOwner: true },
): Household {
  const gate = canRestorePoint(household, point, { isOwner: input.isOwner });
  if (!gate.ok) throw new ValidationError(gate.message);
  if (point.shared.householdId && point.shared.householdId !== household.householdId) {
    throw new ValidationError("That restore point belongs to a different household.");
  }
  if (point.shared.environment && point.shared.environment !== household.environment) {
    throw new ValidationError("That restore point belongs to a different Development/Production pill.");
  }

  const localParts = splitForSync(household, memberId);
  const pointShared: SharedEnvelope = {
    ...sharedEnvelopeForRestorePoint(point.shared),
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

export type RestorePointImpact = {
  sharedTxAfterCount: number;
  sharedShiftAfterCount: number;
  summary: string;
};

/** Blast radius for owner Restore confirm — shared rows only. */
export function restorePointImpact(household: Household, point: RestorePoint): RestorePointImpact {
  const tipTx = new Set((point.shared.transactions ?? []).map((row) => row.id));
  const tipShift = new Set((point.shared.shifts ?? []).map((row) => row.id));
  const sharedTxAfterCount = household.transactions
    .filter((tx) => belongsToSharedLedger(tx) && !tipTx.has(tx.id))
    .length;
  const sharedShiftAfterCount = household.shifts
    .filter((shift) => belongsToSharedLedger(shift) && !tipShift.has(shift.id))
    .length;
  const parts: string[] = [];
  if (sharedTxAfterCount) {
    parts.push(`${sharedTxAfterCount} shared transaction${sharedTxAfterCount === 1 ? "" : "s"}`);
  }
  if (sharedShiftAfterCount) {
    parts.push(`${sharedShiftAfterCount} shift${sharedShiftAfterCount === 1 ? "" : "s"}`);
  }
  const summary = parts.length
    ? `${parts.join(" and ")} posted after that tip leave the shared books.`
    : "No later shared money rows leave — this tip already matches today's shared tip.";
  return { sharedTxAfterCount, sharedShiftAfterCount, summary };
}

export function restoreConfirmBody(point: RestorePoint, household?: Household): string {
  const impact = household ? restorePointImpact(household, point).summary : null;
  const blast = impact
    ? ` ${impact}`
    : " Money posted after that time leaves the shared books.";
  return `Replace shared books with the copy from ${point.label}.${blast} Your Personal rows stay. This cannot use Undo — take a new sync after if you need another Restore point.`;
}
