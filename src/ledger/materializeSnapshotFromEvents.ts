import { financialAuditHash } from "../core/commandIdentity.ts";
import { recordConflict } from "../core/conflict.ts";
import { rememberReceipt } from "../core/commandIdentity.ts";
import { ensureHouseholdShape, mergeTombstones } from "../core/sync.ts";
import type {
  Claim,
  CommandReceipt,
  GoalContribution,
  GoalPurchase,
  Household,
  Shift,
  SitDownSession,
  Tombstone,
  Transaction,
} from "../core/types.ts";
import type { ContinuityCommandRef } from "./continuityCommandLog.ts";

/** Hosted continuity_command_events row (Migration 013). */
export type ContinuityCommandEvent = {
  id: string;
  environment: Household["environment"];
  household_id: string;
  member_id: string;
  idempotency_key: string;
  confirmation_id: string;
  identity_hash: string;
  base_revision: number;
  result_revision: number;
  ledger_scope: "shared" | "personal";
  command_type: string;
  payload_json: ContinuityCommandEventPayload;
  created_at: string;
};

export type ContinuityMaterializationFacts = {
  transactions?: Transaction[];
  shifts?: Shift[];
  claims?: Claim[];
  sitDownSessions?: SitDownSession[];
  goalContributions?: GoalContribution[];
  goalPurchases?: GoalPurchase[];
  tombstones?: Tombstone[];
};

export type ContinuityCommandEventPayload = ContinuityCommandRef["commandPayload"] & {
  materializationFacts?: ContinuityMaterializationFacts;
  compactedConfirmationIds?: string[];
  compactedCommands?: Array<{
    confirmationId: string;
    commandKind: string;
    postedIds: string[];
    ledgerScope: "shared" | "personal";
  }>;
};

type MoneyRow = { id: string };

function sortEvents(events: ContinuityCommandEvent[]): ContinuityCommandEvent[] {
  return [...events].sort((left, right) => (
    left.result_revision - right.result_revision
    || Date.parse(left.created_at) - Date.parse(right.created_at)
    || left.id.localeCompare(right.id)
  ));
}

function rowMapsTo<T extends MoneyRow>(rows: T[] = []): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

function applyMoneyCollection<T extends MoneyRow>(
  existing: T[],
  incoming: T[] | undefined,
  tombstones: Tombstone[],
): { rows: T[]; sameIdConflict: boolean } {
  if (!incoming?.length) return { rows: existing, sameIdConflict: false };
  const dead = new Set(tombstones.map((row) => row.id));
  const map = rowMapsTo(existing.filter((row) => !dead.has(row.id)));
  for (const row of incoming) {
    const previous = map.get(row.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) {
      return { rows: existing, sameIdConflict: true };
    }
    if (!previous) map.set(row.id, row);
  }
  return { rows: [...map.values()], sameIdConflict: false };
}

function receiptFromPayload(payload: ContinuityCommandEventPayload): CommandReceipt {
  return {
    confirmationId: payload.confirmationId,
    identityHash: payload.identityHash,
    auditHash: payload.auditHash,
    commandKind: payload.commandKind,
    postedIds: [...payload.postedIds],
    revision: payload.revision,
    acceptedAt: payload.acceptedAt,
  };
}

function alreadyApplied(snapshot: Household, event: ContinuityCommandEvent): boolean {
  return (snapshot.commandReceipts ?? []).some(
    (row) => row.confirmationId === event.confirmation_id && row.identityHash === event.identity_hash,
  );
}

function scopeAllowsRow(
  event: ContinuityCommandEvent,
  row: { visibility?: string; createdBy?: string },
): boolean {
  if (event.ledger_scope === "shared") {
    return row.visibility !== "personal";
  }
  return row.visibility === "personal" && row.createdBy === event.member_id;
}

function filterFactsForScope(
  event: ContinuityCommandEvent,
  facts: ContinuityMaterializationFacts,
): ContinuityMaterializationFacts {
  const scoped: ContinuityMaterializationFacts = {};
  if (facts.transactions?.length) {
    scoped.transactions = facts.transactions.filter((row) => scopeAllowsRow(event, row));
  }
  if (facts.shifts?.length) {
    scoped.shifts = facts.shifts.filter((row) => scopeAllowsRow(event, row));
  }
  if (facts.claims?.length) {
    scoped.claims = facts.claims.filter((row) => scopeAllowsRow(event, row));
  }
  if (facts.sitDownSessions?.length) {
    scoped.sitDownSessions = facts.sitDownSessions.filter((row) => scopeAllowsRow(event, row));
  }
  if (facts.goalContributions?.length) {
    scoped.goalContributions = facts.goalContributions.filter((row) => scopeAllowsRow(event, row));
  }
  if (facts.goalPurchases?.length) {
    scoped.goalPurchases = facts.goalPurchases.filter((row) => scopeAllowsRow(event, row));
  }
  if (facts.tombstones?.length) {
    scoped.tombstones = facts.tombstones;
  }
  return scoped;
}

/** Extract bounded money rows referenced by postedIds for hosted command-log replay. */
export function extractMaterializationFacts(
  household: Household,
  postedIds: string[],
  options?: { acceptedAt?: string },
): ContinuityMaterializationFacts {
  const posted = new Set(postedIds.filter(Boolean));
  const facts: ContinuityMaterializationFacts = {};
  const transactions = household.transactions.filter((row) => posted.has(row.id));
  if (transactions.length) facts.transactions = transactions;
  const shifts = household.shifts.filter((row) => posted.has(row.id));
  if (shifts.length) facts.shifts = shifts;
  const claims = (household.claims ?? []).filter((row) => posted.has(row.id));
  if (claims.length) facts.claims = claims;
  const sitDownSessions = (household.sitDownSessions ?? []).filter((row) => posted.has(row.id));
  if (sitDownSessions.length) facts.sitDownSessions = sitDownSessions;
  const goalContributions = (household.goalContributions ?? []).filter((row) => posted.has(row.id));
  if (goalContributions.length) facts.goalContributions = goalContributions;
  const goalPurchases = (household.goalPurchases ?? []).filter((row) => posted.has(row.id));
  if (goalPurchases.length) facts.goalPurchases = goalPurchases;
  let tombstones = (household.tombstones ?? []).filter((row) => posted.has(row.id));
  if (!tombstones.length && !posted.size) {
    const marker = household.lastCommittedAt ?? options?.acceptedAt ?? null;
    if (marker) {
      tombstones = (household.tombstones ?? []).filter((row) => row.deletedAt === marker);
    }
  }
  if (tombstones.length) facts.tombstones = tombstones;
  return facts;
}

async function applyEvent(
  snapshot: Household,
  event: ContinuityCommandEvent,
): Promise<Household> {
  const payload = event.payload_json;
  const facts = filterFactsForScope(event, payload.materializationFacts ?? {});
  const mergedTombstones = mergeTombstones(snapshot.tombstones, facts.tombstones);
  const dead = new Set(mergedTombstones.map((row) => row.id));

  const txResult = applyMoneyCollection(snapshot.transactions, facts.transactions, mergedTombstones);
  if (txResult.sameIdConflict) {
    const remote = {
      ...snapshot,
      transactions: mergeRow(snapshot.transactions, facts.transactions),
      revision: event.result_revision,
    };
    return recordConflict(snapshot, remote, false);
  }
  const shiftResult = applyMoneyCollection(snapshot.shifts, facts.shifts, mergedTombstones);
  if (shiftResult.sameIdConflict) {
    const remote = { ...snapshot, shifts: mergeRow(snapshot.shifts, facts.shifts), revision: event.result_revision };
    return recordConflict(snapshot, remote, false);
  }
  const claimResult = applyMoneyCollection(snapshot.claims ?? [], facts.claims, mergedTombstones);
  if (claimResult.sameIdConflict) {
    const remote = { ...snapshot, claims: mergeRow(snapshot.claims ?? [], facts.claims), revision: event.result_revision };
    return recordConflict(snapshot, remote, false);
  }
  const sitDownResult = applyMoneyCollection(snapshot.sitDownSessions ?? [], facts.sitDownSessions, mergedTombstones);
  if (sitDownResult.sameIdConflict) {
    const remote = {
      ...snapshot,
      sitDownSessions: mergeRow(snapshot.sitDownSessions ?? [], facts.sitDownSessions),
      revision: event.result_revision,
    };
    return recordConflict(snapshot, remote, false);
  }
  const contributionResult = applyMoneyCollection(snapshot.goalContributions ?? [], facts.goalContributions, mergedTombstones);
  if (contributionResult.sameIdConflict) {
    const remote = {
      ...snapshot,
      goalContributions: mergeRow(snapshot.goalContributions ?? [], facts.goalContributions),
      revision: event.result_revision,
    };
    return recordConflict(snapshot, remote, false);
  }
  const purchaseResult = applyMoneyCollection(snapshot.goalPurchases ?? [], facts.goalPurchases, mergedTombstones);
  if (purchaseResult.sameIdConflict) {
    const remote = {
      ...snapshot,
      goalPurchases: mergeRow(snapshot.goalPurchases ?? [], facts.goalPurchases),
      revision: event.result_revision,
    };
    return recordConflict(snapshot, remote, false);
  }

  let next: Household = {
    ...snapshot,
    revision: event.result_revision,
    baseRevision: Math.max(snapshot.baseRevision ?? 0, event.base_revision),
    lastCommittedAt: payload.acceptedAt || snapshot.lastCommittedAt,
    transactions: txResult.rows.filter((row) => !dead.has(row.id)),
    shifts: shiftResult.rows.filter((row) => !dead.has(row.id)),
    claims: claimResult.rows.filter((row) => !dead.has(row.id)),
    sitDownSessions: sitDownResult.rows.filter((row) => !dead.has(row.id)),
    goalContributions: contributionResult.rows.filter((row) => !dead.has(row.id)),
    goalPurchases: purchaseResult.rows.filter((row) => !dead.has(row.id)),
    tombstones: mergedTombstones,
  };
  next = rememberReceipt(next, receiptFromPayload(payload));
  next.booksAcceptedHash = payload.auditHash || next.booksAcceptedHash;
  return next;
}

function mergeRow<T extends MoneyRow>(existing: T[], incoming: T[] | undefined): T[] {
  const map = rowMapsTo(existing);
  for (const row of incoming ?? []) map.set(row.id, row);
  return [...map.values()];
}

/**
 * Strip money facts so ordered command events can replay from catalog metadata.
 * Keeps accounts, categories, members, and other shared catalog rows.
 */
export function catalogBaseFromSnapshot(tip: Household): Household {
  const shaped = ensureHouseholdShape(tip);
  return {
    ...shaped,
    revision: 0,
    baseRevision: 0,
    lastCommittedAt: null,
    transactions: [],
    shifts: [],
    claims: [],
    sitDownSessions: [],
    goalContributions: [],
    goalPurchases: [],
    tombstones: [],
    commandReceipts: [],
    conflicts: [],
    booksAcceptedHash: undefined,
    sharing: shaped.sharing,
  };
}

/** Rebuild a household by applying hosted command events in canonical order. */
export async function buildSnapshotFromEvents(
  events: ContinuityCommandEvent[],
  baseSnapshot: Household,
): Promise<Household> {
  let snapshot = ensureHouseholdShape(baseSnapshot);
  for (const event of sortEvents(events)) {
    if (event.household_id && snapshot.householdId && event.household_id !== snapshot.householdId) {
      throw new Error("Command event household mismatch during materialization.");
    }
    if (alreadyApplied(snapshot, event)) continue;
    snapshot = await applyEvent(snapshot, event);
  }
  return snapshot;
}

/** True when materialized cloud projection hash matches the hosted snapshot tip. */
export async function materializedHashMatchesSnapshot(input: {
  materialized: Household;
  snapshotTip: Household;
  memberId: string;
  project: (household: Household, memberId: string) => Household;
}): Promise<boolean> {
  const materializedHash = await financialAuditHash(input.project(input.materialized, input.memberId));
  const snapshotHash = await financialAuditHash(input.project(input.snapshotTip, input.memberId));
  return materializedHash === snapshotHash;
}
