import { cloneHousehold } from "./household.ts";
import { mergeRecords, mergeTombstones } from "./sync.ts";
import { applyGoalSavings } from "./goals.ts";
import { financialAuditHash } from "./commandIdentity.ts";
import { nextId } from "./ids.ts";
import { markConflicted } from "./sharing.ts";
import type {
  Claim,
  ConflictRecord,
  Goal,
  GoalPurchase,
  Household,
  Shift,
  SitDownSession,
  Tombstone,
  Transaction,
} from "./types.ts";

type MoneyCollections = {
  transactions: Transaction[];
  shifts: Shift[];
  claims: Claim[];
  sitDownSessions: SitDownSession[];
  goalPurchases?: GoalPurchase[];
};

function recordsMatch<T extends { id: string }>(left: T[] = [], right: T[] = []): boolean {
  if (left.length !== right.length) return false;
  const byId = new Map(right.map((row) => [row.id, row]));
  return left.every((row) => {
    const other = byId.get(row.id);
    return Boolean(other) && JSON.stringify(row) === JSON.stringify(other);
  });
}

function goalCatalogFacts(goal: Goal): Omit<Goal, "savedCents" | "updatedAt"> {
  const { savedCents: _savedCents, updatedAt: _updatedAt, ...facts } = goal;
  return facts;
}

function goalCatalogsMatch(left: Goal[], right: Goal[]): boolean {
  return recordsMatch(left.map(goalCatalogFacts), right.map(goalCatalogFacts));
}

export function moneyFactsChanged(left: MoneyCollections, right: MoneyCollections): boolean {
  if (left.transactions.length !== right.transactions.length) return true;
  if (left.shifts.length !== right.shifts.length) return true;
  if ((left.claims ?? []).length !== (right.claims ?? []).length) return true;
  if ((left.sitDownSessions ?? []).length !== (right.sitDownSessions ?? []).length) return true;
  if (!recordsMatch(left.transactions, right.transactions)) return true;
  if (!recordsMatch(left.shifts, right.shifts)) return true;
  if (!recordsMatch(left.claims ?? [], right.claims ?? [])) return true;
  if (!recordsMatch(left.sitDownSessions ?? [], right.sitDownSessions ?? [])) return true;
  return !recordsMatch(left.goalPurchases ?? [], right.goalPurchases ?? []);
}

export function canAutoMergeConflict(local: Household, remote: Household): boolean {
  if (local.householdId !== remote.householdId) return false;
  if (local.environment !== remote.environment) return false;
  if (!goalCatalogsMatch(local.goals, remote.goals)) return false;
  if (!recordsMatch<Tombstone>(local.tombstones ?? [], remote.tombstones ?? [])) return false;
  return !moneyFactsChanged(local, remote);
}

export function autoMergeSafe(local: Household, remote: Household): Household {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const goalContributions = mergeRecords(remote.goalContributions ?? [], local.goalContributions ?? [], tombstones);
  const goals = applyGoalSavings(local.goals, goalContributions);
  const revision = Math.max(local.revision, remote.revision);
  return {
    ...local,
    revision,
    baseRevision: Math.max(local.baseRevision ?? 0, remote.baseRevision ?? 0, remote.revision),
    goals,
    goalContributions,
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
