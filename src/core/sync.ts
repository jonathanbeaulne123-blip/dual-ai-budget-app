import { cloneHousehold } from "./household.ts";
import { formatInviteCode, normalizeInviteCode, randomHouseholdId, randomInviteCode } from "./ids.ts";
import { mergeGoogle, shapeGoogle } from "./google.ts";
import { mergeKitchen, shapeKitchen } from "./kitchen.ts";
import { mergeCalendars, shapeCalendar, shapeRecurrence } from "./recurrence.ts";
import { applyGoalSavings, shapeGoalProgress } from "./goals.ts";
import { shapeAppointments, shapeClaims } from "./appointments.ts";
import { shapeAccounts } from "./accountKinds.ts";
import type {
  Activity,
  BudgetPlan,
  Category,
  Household,
  Member,
  PersonalEnvelope,
  Preset,
  SharedEnvelope,
  Shift,
  Tombstone,
  Transaction,
} from "./types.ts";
import { belongsToSharedLedger, isPersonalOnly, parseVisibility } from "./visibility.ts";

export type { PersonalEnvelope, SharedEnvelope };

/** Missing catalog timestamps must be stable across two split() calls, not `new Date()`. */
const MISSING_ISO = "1970-01-01T00:00:00.000Z";

export function recency(item: { updatedAt: string; createdAt?: string }): string {
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

export function mergeRecords<T extends { id: string; updatedAt: string }>(
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

function shapeMembers(list: Member[] | undefined, fallbackIso: string): Member[] {
  return (list ?? []).map((member) => ({
    ...member,
    updatedAt: member.updatedAt || fallbackIso,
  }));
}

function shapeCategories(list: Category[] | undefined, fallbackIso: string): Category[] {
  return (list ?? []).map((category) => {
    const createdAt = category.createdAt || fallbackIso;
    return {
      ...category,
      createdAt,
      updatedAt: category.updatedAt || createdAt,
    };
  });
}

function shapeBudgetPlans(list: BudgetPlan[] | undefined, fallbackIso: string): BudgetPlan[] {
  return (list ?? []).map((plan) => {
    const createdAt = plan.createdAt || fallbackIso;
    return {
      ...plan,
      createdAt,
      updatedAt: plan.updatedAt || createdAt,
    };
  });
}

function shapeActivity(list: Activity[] | undefined): Activity[] {
  return (list ?? []).map((item) => ({
    ...item,
    updatedAt: item.updatedAt || item.at,
  }));
}

function shapePresets(list: Preset[] | undefined, fallbackIso: string): Preset[] {
  return (list ?? []).map((item) => {
    const createdAt = item.createdAt || fallbackIso;
    return {
      ...item,
      place: item.place ?? "",
      splits: item.splits ?? [],
      visibility: parseVisibility(item.visibility),
      sortOrder: item.sortOrder ?? 0,
      origin: item.origin === "detected" ? "detected" : "manual",
      detectionKey: item.detectionKey ?? null,
      active: item.active !== false,
      amountCents: item.amountCents ?? 0,
      createdAt,
      updatedAt: item.updatedAt || createdAt,
    };
  });
}

export function ensureHouseholdShape(household: Household): Household {
  const fallback = household.members.find((member) => member.active)?.id ?? household.members[0]?.id ?? "";
  const fallbackIso = household.lastCommittedAt || MISSING_ISO;
  const progress = shapeGoalProgress(household.goals, household.goalContributions, fallbackIso, fallback);
  return {
    ...household,
    householdId: household.householdId || randomHouseholdId(),
    inviteCode: normalizeInviteCode(household.inviteCode) || randomInviteCode(),
    linked: Boolean(household.linked),
    revision: household.revision ?? 0,
    tombstones: household.tombstones ?? [],
    recurrences: (household.recurrences ?? []).map((item) => shapeRecurrence(item, fallbackIso)),
    appointments: shapeAppointments(household.appointments, fallbackIso),
    claims: shapeClaims(household.claims, fallbackIso),
    presets: shapePresets(household.presets, fallbackIso),
    calendar: shapeCalendar(household.calendar),
    kitchen: shapeKitchen(household.kitchen),
    google: shapeGoogle(household.google),
    members: shapeMembers(household.members, fallbackIso),
    accounts: shapeAccounts(household.accounts, fallbackIso),
    categories: shapeCategories(household.categories, fallbackIso),
    budgetPlans: shapeBudgetPlans(household.budgetPlans, fallbackIso),
    activity: shapeActivity(household.activity),
    goals: progress.goals,
    goalContributions: progress.goalContributions,
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
  const personalTx = shaped.transactions.filter((tx) => isPersonalOnly(tx));
  const sharedShifts = shaped.shifts.filter((shift) => belongsToSharedLedger(shift));
  const personalShifts = shaped.shifts.filter((shift) => isPersonalOnly(shift));
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
    appointments: shaped.appointments,
    claims: shaped.claims,
    presets: shaped.presets,
    calendar: shaped.calendar,
    kitchen: shaped.kitchen,
    google: shaped.google,
    goals: shaped.goals,
    goalContributions: shaped.goalContributions,
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
    appointments: shared.appointments ?? [],
    claims: shared.claims ?? [],
    presets: shared.presets ?? [],
    calendar: shared.calendar,
    kitchen: shared.kitchen,
    google: shared.google,
    goals: shared.goals,
    goalContributions: shared.goalContributions ?? [],
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
  const goalContributions = mergeRecords(server.goalContributions ?? [], client.goalContributions ?? [], tombstones);
  const goals = applyGoalSavings(mergeRecords(server.goals, client.goals, tombstones), goalContributions);
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
    appointments: mergeRecords(server.appointments ?? [], client.appointments ?? [], tombstones),
    claims: mergeRecords(server.claims ?? [], client.claims ?? [], tombstones),
    presets: mergeRecords(server.presets ?? [], client.presets ?? [], tombstones),
    calendar: mergeCalendars(server.calendar, client.calendar),
    kitchen: mergeKitchen(server.kitchen, client.kitchen, tombstones),
    google: mergeGoogle(server.google, client.google, tombstones),
    goals,
    goalContributions,
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
