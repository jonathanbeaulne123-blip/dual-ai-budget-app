import { cloneHousehold } from "./household.ts";
import { assembleHousehold, ensureHouseholdShape, mergeRecords, mergeTombstones, splitForSync } from "./sync.ts";
import { applyGoalSavings } from "./goals.ts";
import { financialAuditHash } from "./commandIdentity.ts";
import { nextId } from "./ids.ts";
import { markConflicted, markPendingTransport, markSynchronized } from "./sharing.ts";
import { belongsToSharedLedger } from "./visibility.ts";
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

function idContentConflict<T extends { id: string }>(left: T[] = [], right: T[] = []): boolean {
  const byId = new Map(right.map((row) => [row.id, row]));
  for (const row of left) {
    const other = byId.get(row.id);
    if (other && JSON.stringify(row) !== JSON.stringify(other)) return true;
  }
  return false;
}

/**
 * True when both sides only added different shared money rows (no same-id edits),
 * tombstones agree, and shared catalogs/budgets match. Safe to union without the
 * conflict sheet — never silent LWW on the same id.
 */
export function canAbsorbDisjointSharedMoney(local: Household, remote: Household): boolean {
  if (local.householdId !== remote.householdId) return false;
  if (local.environment !== remote.environment) return false;
  if (!goalCatalogsMatch(local.goals, remote.goals)) return false;
  if (!recordsMatch<Tombstone>(local.tombstones ?? [], remote.tombstones ?? [])) return false;
  if (!recordsMatch(local.budgetPlans ?? [], remote.budgetPlans ?? [])) return false;
  if (!recordsMatch(local.accounts ?? [], remote.accounts ?? [])) return false;
  if (!recordsMatch(local.categories ?? [], remote.categories ?? [])) return false;
  if (!recordsMatch(local.recurrences ?? [], remote.recurrences ?? [])) return false;
  if (!recordsMatch(local.workJobs ?? [], remote.workJobs ?? [])) return false;
  if (JSON.stringify(local.shiftSettings ?? null) !== JSON.stringify(remote.shiftSettings ?? null)) return false;
  if (idContentConflict(sharedTransactions(local), sharedTransactions(remote))) return false;
  if (idContentConflict(
    local.shifts.filter((shift) => belongsToSharedLedger(shift)),
    remote.shifts.filter((shift) => belongsToSharedLedger(shift)),
  )) return false;
  if (idContentConflict(local.claims ?? [], remote.claims ?? [])) return false;
  if (idContentConflict(local.sitDownSessions ?? [], remote.sitDownSessions ?? [])) return false;
  if (idContentConflict(local.goalPurchases ?? [], remote.goalPurchases ?? [])) return false;
  if (idContentConflict(local.goalContributions ?? [], remote.goalContributions ?? [])) return false;
  // Identical money → canAutoMergeConflict path; absorb still ok as a no-op union.
  return true;
}

/** Union disjoint shared money; keep this member's Personal from local. */
export function absorbDisjointSharedMoney(
  local: Household,
  remote: Household,
  memberId: string,
): Household {
  const localParts = splitForSync(local, memberId);
  const remoteParts = splitForSync(remote, memberId);
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const tip = Math.max(local.revision, remote.revision);
  const revision = tip + 1;
  const shared = {
    ...remoteParts.shared,
    revision,
    transactions: mergeRecords(remoteParts.shared.transactions, localParts.shared.transactions, tombstones),
    shifts: mergeRecords(remoteParts.shared.shifts, localParts.shared.shifts, tombstones),
    claims: mergeRecords(remoteParts.shared.claims ?? [], localParts.shared.claims ?? [], tombstones),
    sitDownSessions: mergeRecords(
      remoteParts.shared.sitDownSessions ?? [],
      localParts.shared.sitDownSessions ?? [],
      tombstones,
    ),
    goalPurchases: mergeRecords(
      remoteParts.shared.goalPurchases ?? [],
      localParts.shared.goalPurchases ?? [],
      tombstones,
    ),
    goalContributions: mergeRecords(
      remoteParts.shared.goalContributions ?? [],
      localParts.shared.goalContributions ?? [],
      tombstones,
    ),
    goals: applyGoalSavings(
      mergeRecords(remoteParts.shared.goals ?? [], localParts.shared.goals ?? [], tombstones),
      mergeRecords(
        remoteParts.shared.goalContributions ?? [],
        localParts.shared.goalContributions ?? [],
        tombstones,
      ),
    ),
    budgetPlans: mergeRecords(remoteParts.shared.budgetPlans ?? [], localParts.shared.budgetPlans ?? [], tombstones),
    workJobs: mergeRecords(remoteParts.shared.workJobs ?? [], localParts.shared.workJobs ?? [], tombstones),
    activity: mergeRecords(remote.activity ?? [], local.activity ?? [], []).slice(-200),
    devices: mergeRecords(remote.devices ?? [], local.devices ?? [], []),
    tombstones,
    commandReceipts: [...(local.commandReceipts ?? []), ...(remote.commandReceipts ?? [])].filter(
      (row, index, rows) => rows.findIndex((item) => item.confirmationId === row.confirmationId) === index,
    ),
    conflicts: [...(local.conflicts ?? []), ...(remote.conflicts ?? [])].filter(
      (row, index, rows) => rows.findIndex((item) => item.id === row.id) === index && row.resolved,
    ),
  };
  const assembled = assembleHousehold(shared, localParts.personal, { linked: true });
  // Pending until CAS acknowledges the union — never pretend cloud already has it.
  return markPendingTransport({
    ...assembled,
    revision,
    baseRevision: tip,
  });
}

export function autoMergeSafe(local: Household, remote: Household): Household {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const goalContributions = mergeRecords(remote.goalContributions ?? [], local.goalContributions ?? [], tombstones);
  const goals = applyGoalSavings(local.goals, goalContributions);
  const revision = Math.max(local.revision, remote.revision);
  const workJobs = mergeRecords(remote.workJobs ?? [], local.workJobs ?? [], tombstones);
  return {
    ...local,
    revision,
    baseRevision: Math.max(local.baseRevision ?? 0, remote.baseRevision ?? 0, remote.revision),
    goals,
    goalContributions,
    workJobs,
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

function activeMemberId(household: Household): string {
  return household.members.find((member) => member.active)?.id ?? household.members[0]?.id ?? "MEM-001";
}

function sharedTransactions(household: Household): Transaction[] {
  return household.transactions.filter((tx) => belongsToSharedLedger(tx));
}

/** Shared-ledger rows only — partner personal amounts stay off the review screen. */
export function countDifferingSharedTransactionIds(local: Household, remote: Household): number {
  const localById = new Map(sharedTransactions(local).map((tx) => [tx.id, tx]));
  const remoteById = new Map(sharedTransactions(remote).map((tx) => [tx.id, tx]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  let count = 0;
  for (const id of ids) {
    const left = localById.get(id);
    const right = remoteById.get(id);
    if (!left || !right || JSON.stringify(left) !== JSON.stringify(right)) count += 1;
  }
  return count;
}

function resolveConflictRecord(conflicts: ConflictRecord[], conflictId: string): ConflictRecord[] {
  return (conflicts ?? []).map((row) => (row.id === conflictId ? { ...row, resolved: true } : row));
}

function mergeReceipts(local: Household, remote: Household): Household["commandReceipts"] {
  return [...(local.commandReceipts ?? []), ...(remote.commandReceipts ?? [])].filter(
    (row, index, rows) => rows.findIndex((item) => item.confirmationId === row.confirmationId) === index,
  );
}

/**
 * Apply an explicit conflict side. Caller must run acceptHouseholdWrite on the result
 * so journal validation is not skipped.
 */
export function resolveConflictChoice(
  household: Household,
  conflictId: string,
  side: "local" | "remote",
): Household {
  const open = (household.conflicts ?? []).find((row) => row.id === conflictId && !row.resolved);
  if (!open) {
    throw new Error("That conflict is not open on this household.");
  }

  const memberId = activeMemberId(household);
  const resolvedConflicts = resolveConflictRecord(household.conflicts ?? [], conflictId);

  if (side === "local") {
    const tip = Math.max(open.remoteRevision, open.localRevision, household.revision);
    const chosen = ensureHouseholdShape({
      ...open.localSnapshot,
      revision: tip + 1,
      baseRevision: open.remoteRevision,
      conflicts: resolvedConflicts,
      commandReceipts: mergeReceipts(household, open.localSnapshot),
    });
    const linked = household.linked === true || chosen.linked === true;
    const next = linked ? markPendingTransport(chosen) : chosen;
    return ensureHouseholdShape({
      ...next,
      linked,
      revision: tip + 1,
      baseRevision: open.remoteRevision,
    });
  }

  const remoteParts = splitForSync(open.remoteSnapshot, memberId);
  const localParts = splitForSync(household, memberId);
  const assembled = assembleHousehold(remoteParts.shared, localParts.personal, { linked: true });
  assembled.conflicts = resolvedConflicts;
  assembled.commandReceipts = mergeReceipts(household, open.remoteSnapshot);
  return markSynchronized(assembled);
}
