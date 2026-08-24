import { cloneHousehold } from "./household.ts";
import { mergeRecords, mergeTombstones } from "./sync.ts";
import { applyGoalSavings } from "./goals.ts";
import { financialAuditHash } from "./commandIdentity.ts";
import { nextId } from "./ids.ts";
import { markConflicted } from "./sharing.ts";
import type { ConflictRecord, Household, Transaction } from "./types.ts";

function moneyFactsChanged(left: Household, right: Household): boolean {
  if (left.transactions.length !== right.transactions.length) return true;
  if (left.shifts.length !== right.shifts.length) return true;
  const byId = new Map(right.transactions.map((row) => [row.id, row]));
  for (const tx of left.transactions) {
    const other = byId.get(tx.id);
    if (!other) return true;
    if (moneyTransactionConflict(tx, other)) return true;
  }
  const shiftById = new Map(right.shifts.map((row) => [row.id, row]));
  for (const shift of left.shifts) {
    const other = shiftById.get(shift.id);
    if (!other) return true;
    if (
      shift.wagesCents !== other.wagesCents ||
      shift.netTipsCents !== other.netTipsCents ||
      shift.date !== other.date ||
      shift.memberId !== other.memberId
    ) {
      return true;
    }
  }
  return false;
}

function moneyTransactionConflict(left: Transaction, right: Transaction): boolean {
  return (
    left.amountCents !== right.amountCents ||
    left.date !== right.date ||
    left.accountId !== right.accountId ||
    left.type !== right.type ||
    left.subcategoryId !== right.subcategoryId ||
    left.reversalOfId !== right.reversalOfId ||
    JSON.stringify(left.splits) !== JSON.stringify(right.splits)
  );
}

export function canAutoMergeConflict(local: Household, remote: Household): boolean {
  if (local.householdId !== remote.householdId) return false;
  if (local.environment !== remote.environment) return false;
  return !moneyFactsChanged(local, remote);
}

export function autoMergeSafe(local: Household, remote: Household): Household {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const goalContributions = mergeRecords(remote.goalContributions ?? [], local.goalContributions ?? [], tombstones);
  const goals = applyGoalSavings(mergeRecords(remote.goals, local.goals, tombstones), goalContributions);
  const revision = Math.max(local.revision, remote.revision);
  return {
    ...local,
    revision,
    baseRevision: Math.max(local.baseRevision ?? 0, remote.baseRevision ?? 0, remote.revision),
    goals,
    goalContributions,
    goalPurchases: mergeRecords(remote.goalPurchases ?? [], local.goalPurchases ?? [], tombstones),
    tombstones,
    activity: mergeRecords(remote.activity ?? [], local.activity ?? [], []).slice(-200),
    devices: mergeRecords(remote.devices ?? [], local.devices ?? [], []),
  };
}

export async function recordConflict(local: Household, remote: Household, autoMerged: boolean): Promise<Household> {
  const conflict: ConflictRecord = {
    id: nextId("CONF-", (local.conflicts ?? []).map((row) => row.id), 4),
    detectedAt: new Date().toISOString(),
    environment: local.environment,
    localRevision: local.revision,
    remoteRevision: remote.revision,
    localHash: await financialAuditHash(local),
    remoteHash: await financialAuditHash(remote),
    localSnapshot: cloneHousehold(local),
    remoteSnapshot: cloneHousehold(remote),
    autoMerged,
    resolved: autoMerged,
  };
  const next = autoMerged ? autoMergeSafe(local, remote) : markConflicted(local);
  return {
    ...next,
    conflicts: [...(local.conflicts ?? []).filter((row) => !row.resolved), conflict].slice(-20),
  };
}

export function unresolvedConflicts(household: Household): ConflictRecord[] {
  return (household.conflicts ?? []).filter((row) => !row.resolved);
}
