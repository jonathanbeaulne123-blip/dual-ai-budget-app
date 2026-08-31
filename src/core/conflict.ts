import { cloneHousehold } from "./household.ts";
import { assembleHousehold, ensureHouseholdShape, mergeRecords, mergeShared, mergeTombstones, splitForSync } from "./sync.ts";
import { applyGoalSavings } from "./goals.ts";
import { financialAuditHash } from "./commandIdentity.ts";
import { nextId } from "./ids.ts";
import { markConflicted, markPendingTransport, markSynchronized } from "./sharing.ts";
import { belongsToSharedLedger } from "./visibility.ts";
import { mergeDevices } from "./devices.ts";
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
 * tombstones agree, and shared catalogs/budgets match. This fast path can union
 * immediately; same-id rows use the ordered reconciliation path below.
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
    devices: mergeDevices(remote.devices ?? [], local.devices ?? []),
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

/**
 * Reconcile two accepted replicas at record granularity. The caller identifies
 * which side is later in the canonical command order; `updatedAt` decides each
 * same-id row and that later side wins an exact timestamp tie. Distinct ids are
 * always retained. This is the snapshot recovery equivalent of applying ordered
 * command events and must still pass acceptHouseholdWrite/PGlite before adoption.
 */
export function mergeSharedLastEntryWins(
  local: Household,
  remote: Household,
  memberId: string,
  prefer: "local" | "remote",
): Household {
  if (local.householdId !== remote.householdId) {
    throw new Error("Those books belong to different households.");
  }
  if (local.environment !== remote.environment) {
    throw new Error("Those books belong to different Development/Production environments.");
  }
  const localParts = splitForSync(local, memberId);
  const remoteParts = splitForSync(remote, memberId);
  const shared = prefer === "local"
    ? mergeShared(remoteParts.shared, localParts.shared)
    : mergeShared(localParts.shared, remoteParts.shared);
  const tip = Math.max(local.revision, remote.revision);
  const resolvedConflicts = [...(local.conflicts ?? []), ...(remote.conflicts ?? [])]
    .map((row) => ({ ...row, resolved: true }))
    .filter((row, index, rows) => rows.findIndex((item) => item.id === row.id) === index)
    .slice(-20);
  const assembled = assembleHousehold(
    { ...shared, revision: tip + 1 },
    localParts.personal,
    { linked: local.linked === true || remote.linked === true },
  );
  const receiptOrderedTransactions = applyReceiptOrder(
    assembled.transactions,
    localParts.shared.transactions,
    remoteParts.shared.transactions,
    local,
    remote,
    prefer,
    shared.tombstones,
  );
  return markPendingTransport(ensureHouseholdShape({
    ...assembled,
    revision: tip + 1,
    baseRevision: remote.revision,
    transactions: preserveReversedOriginals(
      receiptOrderedTransactions,
      localParts.shared.transactions,
      remoteParts.shared.transactions,
      prefer,
      shared.tombstones,
    ),
    shifts: applyReceiptOrder(
      assembled.shifts,
      localParts.shared.shifts,
      remoteParts.shared.shifts,
      local,
      remote,
      prefer,
      shared.tombstones,
    ),
    claims: applyReceiptOrder(
      assembled.claims ?? [],
      localParts.shared.claims ?? [],
      remoteParts.shared.claims ?? [],
      local,
      remote,
      prefer,
      shared.tombstones,
    ),
    sitDownSessions: applyReceiptOrder(
      assembled.sitDownSessions ?? [],
      localParts.shared.sitDownSessions ?? [],
      remoteParts.shared.sitDownSessions ?? [],
      local,
      remote,
      prefer,
      shared.tombstones,
    ),
    goalContributions: preserveHostedImmutableRows(
      assembled.goalContributions ?? [],
      remoteParts.shared.goalContributions ?? [],
      shared.tombstones,
    ),
    goalPurchases: preserveHostedImmutableRows(
      assembled.goalPurchases ?? [],
      remoteParts.shared.goalPurchases ?? [],
      shared.tombstones,
    ),
    fundEvents: preserveHostedImmutableRows(
      assembled.fundEvents ?? [],
      remoteParts.shared.fundEvents ?? [],
      shared.tombstones,
    ),
    fundSettlementAllocations: preserveHostedImmutableRows(
      assembled.fundSettlementAllocations ?? [],
      remoteParts.shared.fundSettlementAllocations ?? [],
      shared.tombstones,
    ),
    fundKittyAllocations: preserveHostedImmutableRows(
      assembled.fundKittyAllocations ?? [],
      remoteParts.shared.fundKittyAllocations ?? [],
      shared.tombstones,
    ),
    conflicts: resolvedConflicts,
    commandReceipts: mergeReceipts(local, remote),
  }));
}

/** Upgrade an old persisted conflict record without reopening a chooser. */
export function resolveStoredConflictsLastEntryWins(
  household: Household,
  memberId: string,
): Household {
  const open = unresolvedConflicts(household)
    .sort((left, right) => left.detectedAt.localeCompare(right.detectedAt) || left.id.localeCompare(right.id));
  if (!open.length) return household;
  return open.reduce(
    (current, conflict) => mergeSharedLastEntryWins(current, conflict.remoteSnapshot, memberId, "local"),
    household,
  );
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
    devices: mergeDevices(remote.devices ?? [], local.devices ?? []),
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

export type SharedConflictImpact = {
  transactionCount: number;
  shiftCount: number;
  claimCount: number;
  sitDownCount: number;
  goalPurchaseCount: number;
  onlyOnPhoneCents: number;
  onlyOnCloudCents: number;
  summary: string;
};

function countIdDiffs<T extends { id: string }>(left: T[] = [], right: T[] = []): number {
  const leftById = new Map(left.map((row) => [row.id, row]));
  const rightById = new Map(right.map((row) => [row.id, row]));
  const ids = new Set([...leftById.keys(), ...rightById.keys()]);
  let count = 0;
  for (const id of ids) {
    const a = leftById.get(id);
    const b = rightById.get(id);
    if (!a || !b || JSON.stringify(a) !== JSON.stringify(b)) count += 1;
  }
  return count;
}

function onlySideCents(
  left: Transaction[],
  right: Transaction[],
): { onlyLeft: number; onlyRight: number } {
  const rightIds = new Set(right.map((row) => row.id));
  const leftIds = new Set(left.map((row) => row.id));
  let onlyLeft = 0;
  let onlyRight = 0;
  for (const tx of left) {
    if (!rightIds.has(tx.id)) onlyLeft += Math.abs(tx.amountCents);
  }
  for (const tx of right) {
    if (!leftIds.has(tx.id)) onlyRight += Math.abs(tx.amountCents);
  }
  return { onlyLeft, onlyRight };
}

/** Human-readable shared impact retained only for legacy local export (Personal excluded). */
export function describeSharedConflictImpact(local: Household, remote: Household): SharedConflictImpact {
  const localTx = sharedTransactions(local);
  const remoteTx = sharedTransactions(remote);
  const transactionCount = countDifferingSharedTransactionIds(local, remote);
  const shiftCount = countIdDiffs(
    local.shifts.filter((shift) => belongsToSharedLedger(shift)),
    remote.shifts.filter((shift) => belongsToSharedLedger(shift)),
  );
  const claimCount = countIdDiffs(local.claims ?? [], remote.claims ?? []);
  const sitDownCount = countIdDiffs(local.sitDownSessions ?? [], remote.sitDownSessions ?? []);
  const goalPurchaseCount = countIdDiffs(local.goalPurchases ?? [], remote.goalPurchases ?? []);
  const { onlyLeft, onlyRight } = onlySideCents(localTx, remoteTx);
  const parts: string[] = [];
  if (transactionCount) {
    parts.push(`${transactionCount} shared transaction${transactionCount === 1 ? "" : "s"}`);
  }
  if (shiftCount) parts.push(`${shiftCount} shift${shiftCount === 1 ? "" : "s"}`);
  if (claimCount) parts.push(`${claimCount} claim${claimCount === 1 ? "" : "s"}`);
  if (sitDownCount) parts.push(`${sitDownCount} sit-down${sitDownCount === 1 ? "" : "s"}`);
  if (goalPurchaseCount) {
    parts.push(`${goalPurchaseCount} goal purchase${goalPurchaseCount === 1 ? "" : "s"}`);
  }
  const summary = parts.length
    ? `${parts.join(", ")} differ between this phone and the cloud.`
    : "Shared money rows match, but other shared facts still need a choice.";
  return {
    transactionCount,
    shiftCount,
    claimCount,
    sitDownCount,
    goalPurchaseCount,
    onlyOnPhoneCents: onlyLeft,
    onlyOnCloudCents: onlyRight,
    summary,
  };
}

function resolveConflictRecord(conflicts: ConflictRecord[], conflictId: string): ConflictRecord[] {
  return (conflicts ?? []).map((row) => (row.id === conflictId ? { ...row, resolved: true } : row));
}

function mergeReceipts(local: Household, remote: Household): Household["commandReceipts"] {
  return [...(local.commandReceipts ?? []), ...(remote.commandReceipts ?? [])].filter(
    (row, index, rows) => rows.findIndex((item) => item.confirmationId === row.confirmationId) === index,
  );
}

/** Reconcile a stale shared write without blocking the household on a chooser. */
export async function autoResolveSharedConflict(
  local: Household,
  remote: Household,
  memberId: string,
  prefer: "local" | "remote" = "local",
): Promise<Household> {
  return mergeSharedLastEntryWins(local, remote, memberId, prefer);
}

function preserveReversedOriginals(
  merged: Transaction[],
  local: Transaction[],
  remote: Transaction[],
  prefer: "local" | "remote",
  tombstones: Tombstone[],
): Transaction[] {
  const byId = new Map(merged.map((row) => [row.id, row]));
  const dead = new Set(tombstones.map((row) => row.id));
  const candidates = prefer === "local" ? [...remote, ...local] : [...local, ...remote];
  for (const reversal of merged) {
    if (!reversal.reversalOfId) continue;
    if (dead.has(reversal.reversalOfId)) {
      byId.delete(reversal.reversalOfId);
      continue;
    }
    const eligible = candidates.filter((row) => (
      row.id === reversal.reversalOfId
      && row.updatedAt <= reversal.createdAt
    ));
    if (!eligible.length) continue;
    const original = eligible.reduce((winner, row) => (
      row.updatedAt >= winner.updatedAt ? row : winner
    ));
    byId.set(original.id, original);
  }
  return [...byId.values()];
}

function applyReceiptOrder<T extends { id: string; updatedAt: string }>(
  merged: T[],
  localRows: T[],
  remoteRows: T[],
  local: Household,
  remote: Household,
  prefer: "local" | "remote",
  tombstones: Tombstone[],
): T[] {
  const dead = new Set(tombstones.map((row) => row.id));
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const remoteById = new Map(remoteRows.map((row) => [row.id, row]));
  const localReceipts = new Set((local.commandReceipts ?? []).map((row) => row.confirmationId));
  const remoteReceipts = new Set((remote.commandReceipts ?? []).map((row) => row.confirmationId));
  const localPosted = new Set(
    (local.commandReceipts ?? [])
      .filter((row) => !remoteReceipts.has(row.confirmationId))
      .flatMap((row) => row.postedIds),
  );
  const remotePosted = new Set(
    (remote.commandReceipts ?? [])
      .filter((row) => !localReceipts.has(row.confirmationId))
      .flatMap((row) => row.postedIds),
  );
  const latestReceiptFor = (household: Household, otherReceipts: Set<string>, id: string) => (
    (household.commandReceipts ?? [])
      .filter((row) => !otherReceipts.has(row.confirmationId) && row.postedIds.includes(id))
      .sort((left, right) => (
        left.revision - right.revision
        || left.acceptedAt.localeCompare(right.acceptedAt)
        || left.confirmationId.localeCompare(right.confirmationId)
      ))
      .at(-1)
  );
  const byId = new Map(merged.filter((row) => !dead.has(row.id)).map((row) => [row.id, row]));
  for (const id of new Set([...localPosted, ...remotePosted])) {
    if (dead.has(id)) continue;
    const localRow = localById.get(id);
    const remoteRow = remoteById.get(id);
    if (!localRow || !remoteRow) continue;
    if (localPosted.has(id) && !remotePosted.has(id)) byId.set(id, localRow);
    else if (remotePosted.has(id) && !localPosted.has(id)) byId.set(id, remoteRow);
    else {
      const localReceipt = latestReceiptFor(local, remoteReceipts, id);
      const remoteReceipt = latestReceiptFor(remote, localReceipts, id);
      const receiptOrder = (localReceipt?.revision ?? -1) - (remoteReceipt?.revision ?? -1)
        || (localReceipt?.acceptedAt ?? "").localeCompare(remoteReceipt?.acceptedAt ?? "")
        || (localReceipt?.confirmationId ?? "").localeCompare(remoteReceipt?.confirmationId ?? "");
      byId.set(id, receiptOrder === 0
        ? (prefer === "local" ? localRow : remoteRow)
        : (receiptOrder > 0 ? localRow : remoteRow));
    }
  }
  return [...byId.values()];
}

function preserveHostedImmutableRows<T extends { id: string }>(
  merged: T[],
  remoteRows: T[],
  tombstones: Tombstone[],
): T[] {
  const dead = new Set(tombstones.map((row) => row.id));
  const byId = new Map(merged.filter((row) => !dead.has(row.id)).map((row) => [row.id, row]));
  for (const row of remoteRows) {
    if (!dead.has(row.id) && byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
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
