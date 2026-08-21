import { cloneHousehold } from "./household.ts";
import { formatInviteCode, normalizeInviteCode, randomHouseholdId, randomInviteCode } from "./ids.ts";
import type { Household, PersonalEnvelope, SharedEnvelope, Shift, Tombstone, Transaction } from "./types.ts";
import { belongsToSharedLedger, isPersonalOnly, parseVisibility } from "./visibility.ts";

export type { PersonalEnvelope, SharedEnvelope };

export function recency(item: { updatedAt?: string; createdAt?: string }): string {
  return item.updatedAt || item.createdAt || "";
}

export function mergeTombstones(left: Tombstone[] = [], right: Tombstone[] = []): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const tombstone of [...left, ...right]) {
    const existing = map.get(tombstone.id);
    if (!existing || tombstone.deletedAt > existing.deletedAt) map.set(tombstone.id, tombstone);
  }
  return [...map.values()];
}

export function mergeRecords<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  server: T[],
  client: T[],
  tombstones: Tombstone[],
): T[] {
  const dead = new Set(tombstones.map((tombstone) => tombstone.id));
  const map = new Map<string, T>();
  for (const item of server) {
    if (!dead.has(item.id)) map.set(item.id, item);
  }
  for (const item of client) {
    if (dead.has(item.id)) continue;
    const existing = map.get(item.id);
    if (!existing || recency(item) >= recency(existing)) map.set(item.id, item);
  }
  return [...map.values()];
}

function laterIso(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function laterEnvelope<T extends { lastCommittedAt: string | null }>(server: T, client: T): T {
  if (!server.lastCommittedAt) return client;
  if (!client.lastCommittedAt) return server;
  return client.lastCommittedAt >= server.lastCommittedAt ? client : server;
}

export function ensureHouseholdShape(household: Household): Household {
  const fallback = household.members.find((member) => member.active)?.id ?? household.members[0]?.id ?? "";
  return {
    ...household,
    householdId: household.householdId || randomHouseholdId(),
    inviteCode: normalizeInviteCode(household.inviteCode) || randomInviteCode(),
    linked: Boolean(household.linked),
    revision: household.revision ?? 0,
    tombstones: household.tombstones ?? [],
    transactions: household.transactions.map((tx) => ({
      ...tx,
      place: tx.place ?? "",
      visibility: parseVisibility(tx.visibility),
      createdBy: tx.createdBy || fallback,
      updatedAt: tx.updatedAt ?? tx.createdAt,
    })),
    shifts: household.shifts.map((shift) => ({
      ...shift,
      visibility: parseVisibility(shift.visibility),
      createdBy: shift.createdBy || shift.memberId || fallback,
      updatedAt: shift.updatedAt ?? shift.createdAt,
    })),
  };
}

export function emptyPersonal(memberId: string): PersonalEnvelope {
  return {
    kind: "personal",
    memberId,
    lastCommittedAt: null,
    transactions: [],
    shifts: [],
    tombstones: [],
  };
}

export function splitForSync(household: Household, memberId: string): { shared: SharedEnvelope; personal: PersonalEnvelope } {
  const shaped = ensureHouseholdShape(household);
  const sharedTx = shaped.transactions.filter((tx) => belongsToSharedLedger(tx));
  const personalTx = shaped.transactions.filter((tx) => isPersonalOnly(tx) && tx.createdBy === memberId);
  const sharedShifts = shaped.shifts.filter((shift) => belongsToSharedLedger(shift));
  const personalShifts = shaped.shifts.filter((shift) => isPersonalOnly(shift) && shift.createdBy === memberId);
  const shared: SharedEnvelope = {
    kind: "shared",
    revision: shaped.revision,
    householdId: shaped.householdId,
    inviteCode: shaped.inviteCode,
    name: shaped.name,
    timezone: shaped.timezone,
    currency: shaped.currency,
    environment: shaped.environment,
    members: shaped.members,
    accounts: shaped.accounts,
    categories: shaped.categories,
    recurrences: shaped.recurrences,
    goals: shaped.goals,
    budgetPlans: shaped.budgetPlans,
    activity: shaped.activity,
    shiftSettings: shaped.shiftSettings,
    lastCommittedAt: shaped.lastCommittedAt,
    transactions: sharedTx,
    shifts: sharedShifts,
    tombstones: shaped.tombstones,
  };
  const personal: PersonalEnvelope = {
    kind: "personal",
    memberId,
    lastCommittedAt: shaped.lastCommittedAt,
    transactions: personalTx,
    shifts: personalShifts,
    tombstones: shaped.tombstones,
  };
  return { shared, personal };
}

export function assembleHousehold(shared: SharedEnvelope, personal: PersonalEnvelope | null): Household {
  const personalTx = personal?.transactions ?? [];
  const personalShifts = personal?.shifts ?? [];
  const txById = new Map<string, Transaction>();
  const shiftById = new Map<string, Shift>();
  for (const tx of shared.transactions) txById.set(tx.id, tx);
  for (const tx of personalTx) {
    const existing = txById.get(tx.id);
    if (!existing || recency(tx) >= recency(existing)) txById.set(tx.id, tx);
  }
  for (const shift of shared.shifts) shiftById.set(shift.id, shift);
  for (const shift of personalShifts) {
    const existing = shiftById.get(shift.id);
    if (!existing || recency(shift) >= recency(existing)) shiftById.set(shift.id, shift);
  }
  return ensureHouseholdShape({
    version: 1,
    householdId: shared.householdId,
    inviteCode: shared.inviteCode,
    linked: true,
    revision: shared.revision,
    tombstones: mergeTombstones(shared.tombstones, personal?.tombstones ?? []),
    name: shared.name,
    timezone: shared.timezone,
    currency: shared.currency,
    environment: shared.environment,
    members: shared.members,
    accounts: shared.accounts,
    categories: shared.categories,
    recurrences: shared.recurrences,
    goals: shared.goals,
    budgetPlans: shared.budgetPlans,
    activity: shared.activity,
    shiftSettings: shared.shiftSettings,
    lastCommittedAt: laterIso(shared.lastCommittedAt, personal?.lastCommittedAt ?? null),
    transactions: [...txById.values()],
    shifts: [...shiftById.values()],
  });
}

export function mergeShared(server: SharedEnvelope, client: SharedEnvelope): SharedEnvelope {
  const tombstones = mergeTombstones(server.tombstones, client.tombstones);
  const newer = laterEnvelope(server, client);
  return {
    kind: "shared",
    revision: Math.max(server.revision ?? 0, client.revision ?? 0) + 1,
    householdId: server.householdId || client.householdId,
    inviteCode: normalizeInviteCode(server.inviteCode) || client.inviteCode,
    name: newer.name,
    timezone: newer.timezone,
    currency: newer.currency,
    environment: newer.environment,
    members: mergeRecords(server.members, client.members, []),
    accounts: mergeRecords(server.accounts, client.accounts, []),
    categories: mergeRecords(server.categories, client.categories, []),
    recurrences: mergeRecords(server.recurrences, client.recurrences, tombstones),
    goals: mergeRecords(server.goals, client.goals, tombstones),
    budgetPlans: mergeRecords(server.budgetPlans, client.budgetPlans, tombstones),
    activity: mergeRecords(server.activity, client.activity, []).sort((left, right) => left.at.localeCompare(right.at)).slice(-200),
    shiftSettings: newer.shiftSettings,
    lastCommittedAt: newer.lastCommittedAt,
    transactions: mergeRecords(server.transactions, client.transactions, tombstones),
    shifts: mergeRecords(server.shifts, client.shifts, tombstones),
    tombstones,
  };
}

export function mergePersonal(server: PersonalEnvelope, client: PersonalEnvelope): PersonalEnvelope {
  const tombstones = mergeTombstones(server.tombstones, client.tombstones);
  const newer = laterEnvelope(server, client);
  return {
    kind: "personal",
    memberId: client.memberId || server.memberId,
    lastCommittedAt: newer.lastCommittedAt,
    transactions: mergeRecords(server.transactions, client.transactions, tombstones),
    shifts: mergeRecords(server.shifts, client.shifts, tombstones),
    tombstones,
  };
}

export function displayInviteCode(household: Household): string {
  return formatInviteCode(household.inviteCode);
}

export function cloneAndShape(household: Household): Household {
  return ensureHouseholdShape(cloneHousehold(household));
}
