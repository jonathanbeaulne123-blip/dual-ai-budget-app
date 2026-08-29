import { cloneHousehold } from "./household.ts";
import { formatInviteCode, normalizeInviteCode, randomHouseholdId, randomInviteCode } from "./ids.ts";
import { shapeSharing } from "./sharing.ts";
import { mergeGoogle, shapeGoogle } from "./google.ts";
import { mergeKitchen, shapeKitchen } from "./kitchen.ts";
import { shapeSitDownSessions } from "./sitDown.ts";
import { mergeCalendars, shapeCalendar, shapeRecurrence } from "./recurrence.ts";
import { applyGoalSavings, shapeGoalProgress, shapeGoalPurchases } from "./goals.ts";
import { shapeAppointments, shapeClaims } from "./appointments.ts";
import { shapeAccounts } from "./accountKinds.ts";
import { mergeDevices, shapeDevices } from "./devices.ts";
import { shapeTransactionLocation } from "./transactionLocation.ts";
import { DEFAULT_TIMEZONE, isValidIanaTimeZone } from "./calendar.ts";
import type {
  Activity,
  BudgetPlan,
  Category,
  Household,
  Member,
  PersonalEnvelope,
  HerculesProPermissions,
  Preset,
  SharedEnvelope,
  Shift,
  Tombstone,
  Transaction,
} from "./types.ts";
import { belongsToSharedLedger, isPersonalOnly, parseVisibility } from "./visibility.ts";
import { shapeLedgerNames } from "./ledgerNames.ts";
import { shapeWorkJobs } from "./work.ts";
import { shapeCoworkerAttendance, shapeCoworkers, shapeCoworkerSchedules } from "./coworkers.ts";
import { shapeSevenShiftsEvidenceBundle } from "./evidence.ts";
import { shapeSevenShiftsSchedules } from "./sevenShiftsCalendar.ts";
import { shapeShiftBible, shapeShiftBibles, shapeShiftEnvelopes } from "./shiftEnvelope.ts";
import type { ShiftBible } from "./shiftEnvelope.ts";
import { DEFAULT_SHIFT_SETTINGS } from "./shift.ts";
import {
  shapeHouseholdFundConfig,
  shapeHouseholdFundEvents,
  shapeHouseholdFundKittyAllocations,
  shapeHouseholdFundMonthPlans,
  shapeHouseholdFundPrivate,
  shapeHouseholdFundSettlementAllocations,
} from "./householdFund.ts";

export type { PersonalEnvelope, SharedEnvelope };

function withoutPrivateShiftBible(shift: Shift): Shift {
  if (!shift.shiftBible) return shift;
  const { shiftBible: _privateBible, ...sharedShift } = shift;
  return sharedShift;
}

function uniqueShiftBibles(rows: ShiftBible[]): ShiftBible[] {
  const byId = new Map<string, ShiftBible>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing || row.revision >= existing.revision) byId.set(row.id, row);
  }
  return [...byId.values()];
}

function personalShiftBibles(household: Household, memberId: string): ShiftBible[] {
  return uniqueShiftBibles([
    ...shapeShiftBibles(household.shiftBibles, memberId),
    ...household.shifts.flatMap((shift) => {
      const bible = shift.memberId === memberId ? shapeShiftBible(shift.shiftBible, memberId) : undefined;
      return bible ? [bible] : [];
    }),
  ]);
}

function attachPrivateShiftBibles(shifts: Shift[], bibles: ShiftBible[], memberId: string): Shift[] {
  const byShiftId = new Map(
    bibles
      .filter((bible) => bible.memberId === memberId && bible.linkedShiftId && !bible.correctedByBibleId)
      .sort((left, right) => left.revision - right.revision)
      .map((bible) => [bible.linkedShiftId as string, bible]),
  );
  return shifts.map((shift) => {
    const sharedSafe = withoutPrivateShiftBible(shift);
    const bible = shift.memberId === memberId ? byShiftId.get(shift.id) : undefined;
    return bible ? { ...sharedSafe, shiftBible: bible } : sharedSafe;
  });
}

export function shapeHerculesProPermissions(value: unknown): HerculesProPermissions {
  const input = value && typeof value === "object" ? value as Partial<HerculesProPermissions> : {};
  const updatedAt = typeof input.updatedAt === "string" && !Number.isNaN(Date.parse(input.updatedAt))
    ? new Date(input.updatedAt).toISOString()
    : null;
  return {
    personalWrite: input.personalWrite === true,
    householdWrite: input.householdWrite === true,
    updatedAt,
  };
}

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
    baseRevision: household.baseRevision ?? 0,
    booksAcceptedHash: household.booksAcceptedHash ?? null,
    tombstones: household.tombstones ?? [],
    timezone: isValidIanaTimeZone(household.timezone) ? household.timezone.trim() : DEFAULT_TIMEZONE,
    ledgerNames: shapeLedgerNames(household.ledgerNames, household.members),
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
    sitDownSessions: shapeSitDownSessions(household.sitDownSessions),
    activity: shapeActivity(household.activity),
    devices: shapeDevices(household.devices, fallbackIso),
    workJobs: shapeWorkJobs(household.workJobs, fallbackIso),
    goals: progress.goals,
    goalContributions: progress.goalContributions,
    goalPurchases: shapeGoalPurchases(household.goalPurchases, fallbackIso, fallback),
    householdFund: shapeHouseholdFundConfig(household.householdFund),
    fundMonthPlans: shapeHouseholdFundMonthPlans(household.fundMonthPlans),
    fundEvents: shapeHouseholdFundEvents(household.fundEvents),
    fundSettlementAllocations: shapeHouseholdFundSettlementAllocations(household.fundSettlementAllocations),
    fundKittyAllocations: shapeHouseholdFundKittyAllocations(household.fundKittyAllocations),
    fundPrivate: shapeHouseholdFundPrivate(household.fundPrivate),
    transactions: household.transactions.map((tx) => ({
      ...tx,
      place: tx.place ?? "",
      location: shapeTransactionLocation(tx.location),
      occurredAt:
        typeof tx.occurredAt === "string" && tx.occurredAt.trim() && !Number.isNaN(Date.parse(tx.occurredAt))
          ? new Date(tx.occurredAt).toISOString()
          : undefined,
      visibility: parseVisibility(tx.visibility),
      funding: tx.funding && Number.isInteger(tx.funding.fundedCents) && tx.funding.fundedCents > 0
        ? {
            fundId: String(tx.funding.fundId),
            fundedCents: tx.funding.fundedCents,
            destinationAccountId: String(tx.funding.destinationAccountId),
            ...(typeof tx.funding.positionId === "string" && tx.funding.positionId ? { positionId: tx.funding.positionId } : {}),
            ...(tx.funding.directDebit === true ? { directDebit: true } : {}),
          }
        : undefined,
      createdBy: tx.createdBy || fallback,
      updatedAt: tx.updatedAt ?? tx.createdAt,
    })),
    shifts: household.shifts.map((shift) => {
      const { shiftBible: rawBible, sevenShiftsEvidenceBundle: rawEvidence, ...rest } = shift;
      const shiftBible = shapeShiftBible(rawBible, shift.memberId);
      return {
        ...rest,
        visibility: parseVisibility(shift.visibility),
        createdBy: shift.createdBy || shift.memberId || fallback,
        updatedAt: shift.updatedAt ?? shift.createdAt,
        ...(rawEvidence ? { sevenShiftsEvidenceBundle: shapeSevenShiftsEvidenceBundle(rawEvidence) } : {}),
        ...(shiftBible ? { shiftBible } : {}),
      };
    }),
    sevenShiftsSchedules: shapeSevenShiftsSchedules(household.sevenShiftsSchedules),
    coworkers: shapeCoworkers(household.coworkers, fallbackIso),
    coworkerAttendance: shapeCoworkerAttendance(household.coworkerAttendance, fallbackIso),
    shiftSettings: household.shiftSettings && typeof household.shiftSettings === "object"
      ? household.shiftSettings
      : { ...DEFAULT_SHIFT_SETTINGS },
    coworkerSchedules: shapeCoworkerSchedules(household.coworkerSchedules, fallbackIso),
    shiftEnvelopes: shapeShiftEnvelopes(household.shiftEnvelopes),
    shiftBibles: shapeShiftBibles(household.shiftBibles),
    commandReceipts: household.commandReceipts ?? [],
    sharing: shapeSharing(household),
    conflicts: household.conflicts ?? [],
    restorePoints: household.restorePoints ?? [],
    ...(household.herculesProPermissions
      ? { herculesProPermissions: shapeHerculesProPermissions(household.herculesProPermissions) }
      : {}),
  };
}

export function emptyPersonal(memberId: string): PersonalEnvelope {
  return {
    kind: "personal",
    memberId,
    lastCommittedAt: null,
    transactions: [],
    accounts: [],
    shifts: [],
    sevenShiftsSchedules: [],
    coworkers: [],
    coworkerAttendance: [],
    coworkerSchedules: [],
    shiftEnvelopes: [],
    shiftBibles: [],
    goals: [],
    goalContributions: [],
    goalPurchases: [],
    fundPrivate: { bankBindings: [], reconciliations: [] },
    tombstones: [],
    herculesProPermissions: {
      personalWrite: false,
      householdWrite: false,
      updatedAt: null,
    },
  };
}

export function splitForSync(household: Household, memberId: string): { shared: SharedEnvelope; personal: PersonalEnvelope } {
  const shaped = ensureHouseholdShape(household);
  const sharedTx = shaped.transactions.filter((tx) => belongsToSharedLedger(tx));
  const personalTx = shaped.transactions.filter((tx) => isPersonalOnly(tx));
  const sharedShifts = shaped.shifts.filter((shift) => belongsToSharedLedger(shift)).map(withoutPrivateShiftBible);
  const personalShifts = shaped.shifts.filter((shift) => isPersonalOnly(shift)).map(withoutPrivateShiftBible);
  const memberShiftBibles = personalShiftBibles(shaped, memberId);
  const sharedGoals = shaped.goals.filter((goal) => goal.shared);
  const personalGoals = shaped.goals.filter((goal) => !goal.shared && goal.ownerMemberId === memberId);
  const sharedGoalIds = new Set(sharedGoals.map((goal) => goal.id));
  const personalGoalIds = new Set(personalGoals.map((goal) => goal.id));
  const sharedAccounts = shaped.accounts.filter((account) => account.scope !== "personal");
  const personalAccounts = shaped.accounts.filter((account) => account.scope === "personal" && account.ownerMemberId === memberId);
  const shared: SharedEnvelope = {
    kind: "shared",
    revision: shaped.revision,
    householdId: shaped.householdId,
    inviteCode: shaped.inviteCode,
    name: shaped.name,
    ledgerNames: shaped.ledgerNames,
    timezone: shaped.timezone,
    currency: shaped.currency,
    environment: shaped.environment,
    members: shaped.members,
    accounts: sharedAccounts,
    categories: shaped.categories,
    recurrences: shaped.recurrences,
    appointments: shaped.appointments,
    claims: shaped.claims,
    presets: shaped.presets,
    calendar: shaped.calendar,
    kitchen: shaped.kitchen,
    google: shaped.google,
    goals: sharedGoals,
    goalContributions: shaped.goalContributions.filter((row) => sharedGoalIds.has(row.goalId)),
    goalPurchases: shaped.goalPurchases.filter((row) => sharedGoalIds.has(row.goalId)),
    householdFund: shaped.householdFund ?? null,
    fundMonthPlans: shaped.fundMonthPlans ?? [],
    fundEvents: shaped.fundEvents ?? [],
    fundSettlementAllocations: shaped.fundSettlementAllocations ?? [],
    fundKittyAllocations: shaped.fundKittyAllocations ?? [],
    budgetPlans: shaped.budgetPlans,
    sitDownSessions: shaped.sitDownSessions,
    activity: shaped.activity,
    devices: shaped.devices,
    workJobs: shaped.workJobs,
    shiftSettings: shaped.shiftSettings,
    lastCommittedAt: shaped.lastCommittedAt,
    transactions: sharedTx,
    shifts: sharedShifts,
    tombstones: shaped.tombstones,
    commandReceipts: shaped.commandReceipts,
    restorePoints: shaped.restorePoints ?? [],
  };
  const personal: PersonalEnvelope = {
    kind: "personal",
    memberId,
    accounts: personalAccounts,
    lastCommittedAt: shaped.lastCommittedAt,
    transactions: personalTx,
    shifts: personalShifts,
    sevenShiftsSchedules: shaped.sevenShiftsSchedules?.filter((row) => row.memberId === memberId) ?? [],
    coworkers: shapeCoworkers(shaped.coworkers, shaped.lastCommittedAt ?? MISSING_ISO, memberId),
    coworkerAttendance: shapeCoworkerAttendance(shaped.coworkerAttendance, shaped.lastCommittedAt ?? MISSING_ISO, memberId),
    coworkerSchedules: shapeCoworkerSchedules(shaped.coworkerSchedules, shaped.lastCommittedAt ?? MISSING_ISO, memberId),
    shiftEnvelopes: shapeShiftEnvelopes(shaped.shiftEnvelopes, memberId),
    shiftBibles: memberShiftBibles,
    goals: personalGoals,
    goalContributions: shaped.goalContributions.filter((row) => personalGoalIds.has(row.goalId)),
    goalPurchases: shaped.goalPurchases.filter((row) => personalGoalIds.has(row.goalId)),
    fundPrivate: shaped.householdFund?.custodianMemberId === memberId
      ? shapeHouseholdFundPrivate(shaped.fundPrivate, memberId)
      : { bankBindings: [], reconciliations: [] },
    tombstones: shaped.tombstones,
    herculesProPermissions: shaped.herculesProPermissions
      ? shapeHerculesProPermissions(shaped.herculesProPermissions)
      : undefined,
  };
  return { shared, personal };
}

export function personalReplicaForMember(household: Household, memberId: string): PersonalEnvelope {
  const personal = splitForSync(household, memberId).personal;
  return {
    ...personal,
    transactions: personal.transactions.filter((tx) => tx.createdBy === memberId),
    shifts: personal.shifts.filter((shift) => shift.createdBy === memberId),
    sevenShiftsSchedules: shapeSevenShiftsSchedules(personal.sevenShiftsSchedules, memberId),
    coworkers: shapeCoworkers(personal.coworkers, personal.lastCommittedAt ?? MISSING_ISO, memberId),
    coworkerAttendance: shapeCoworkerAttendance(personal.coworkerAttendance, personal.lastCommittedAt ?? MISSING_ISO, memberId),
    coworkerSchedules: shapeCoworkerSchedules(personal.coworkerSchedules, personal.lastCommittedAt ?? MISSING_ISO, memberId),
    shiftEnvelopes: shapeShiftEnvelopes(personal.shiftEnvelopes, memberId),
    shiftBibles: shapeShiftBibles(personal.shiftBibles, memberId),
    goals: (personal.goals ?? []).filter((goal) => goal.ownerMemberId === memberId),
    accounts: shapeAccounts(personal.accounts, personal.lastCommittedAt ?? MISSING_ISO)
      .filter((account) => account.scope === "personal" && account.ownerMemberId === memberId),
    goalContributions: personal.goalContributions ?? [],
    goalPurchases: personal.goalPurchases ?? [],
    fundPrivate: shapeHouseholdFundPrivate(personal.fundPrivate, memberId),
  };
}

/** Normalize a hosted personal envelope row before overlaying it onto shared books. */
export function personalEnvelopeFromPayload(
  payload: unknown,
  memberId: string,
): PersonalEnvelope | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as PersonalEnvelope;
  if (row.kind !== "personal" || row.memberId !== memberId) return null;
  const goals = Array.isArray(row.goals)
    ? row.goals.filter((item) => !item.shared && item.ownerMemberId === memberId)
    : [];
  const goalIds = new Set(goals.map((item) => item.id));
  const accounts = shapeAccounts(row.accounts, row.lastCommittedAt ?? MISSING_ISO)
    .filter((item) => item.scope === "personal" && item.ownerMemberId === memberId);
  return {
    ...row,
    accounts,
    transactions: Array.isArray(row.transactions)
      ? row.transactions.filter((item) => item.createdBy === memberId && item.visibility === "personal")
      : [],
    shifts: Array.isArray(row.shifts)
      ? row.shifts.filter((item) => item.createdBy === memberId && item.visibility === "personal")
      : [],
    sevenShiftsSchedules: shapeSevenShiftsSchedules(row.sevenShiftsSchedules, memberId),
    coworkers: shapeCoworkers(row.coworkers, row.lastCommittedAt ?? MISSING_ISO, memberId),
    coworkerAttendance: shapeCoworkerAttendance(row.coworkerAttendance, row.lastCommittedAt ?? MISSING_ISO, memberId),
    coworkerSchedules: shapeCoworkerSchedules(row.coworkerSchedules, row.lastCommittedAt ?? MISSING_ISO, memberId),
    shiftEnvelopes: shapeShiftEnvelopes(row.shiftEnvelopes, memberId),
    shiftBibles: shapeShiftBibles(row.shiftBibles, memberId),
    goals,
    goalContributions: Array.isArray(row.goalContributions)
      ? row.goalContributions.filter((item) => goalIds.has(item.goalId))
      : [],
    goalPurchases: Array.isArray(row.goalPurchases)
      ? row.goalPurchases.filter((item) => goalIds.has(item.goalId))
      : [],
    tombstones: Array.isArray(row.tombstones) ? row.tombstones : [],
    fundPrivate: shapeHouseholdFundPrivate(row.fundPrivate, memberId),
    ...(row.herculesProPermissions
      ? { herculesProPermissions: shapeHerculesProPermissions(row.herculesProPermissions) }
      : {}),
  };
}

/** Merge one member's hosted personal replica onto the shared cloud snapshot. */
export function overlayPersonalReplica(
  household: Household,
  personal: PersonalEnvelope | null | undefined,
  memberId: string,
): Household {
  if (!personal || personal.kind !== "personal" || personal.memberId !== memberId) return household;
  const personalTransactionIds = new Set(personal.transactions.map((item) => item.id));
  const personalShiftIds = new Set(personal.shifts.map((item) => item.id));
  const personalScheduleIds = new Set((personal.sevenShiftsSchedules ?? []).map((item) => item.id));
  const personalGoals = personal.goals ?? [];
  const personalGoalIds = new Set(personalGoals.map((item) => item.id));
  const tombstones = new Map(household.tombstones.map((item) => [item.id, item]));
  for (const item of personal.tombstones) {
    const existing = tombstones.get(item.id);
    if (!existing || item.deletedAt >= existing.deletedAt) tombstones.set(item.id, item);
  }
  const memberBibles = shapeShiftBibles(personal.shiftBibles, memberId);
  const overlaidShifts = attachPrivateShiftBibles([
    ...household.shifts.filter((item) => !(
      (item.visibility === "personal" && item.createdBy === memberId) || personalShiftIds.has(item.id)
    )),
    ...personal.shifts,
  ], memberBibles, memberId);
  return ensureHouseholdShape({
    ...household,
    transactions: [
      ...household.transactions.filter((item) => !(
        (item.visibility === "personal" && item.createdBy === memberId) || personalTransactionIds.has(item.id)
      )),
      ...personal.transactions,
    ],
    accounts: [
      ...household.accounts.filter((item) => !(item.scope === "personal" && item.ownerMemberId === memberId)),
      ...(personal.accounts ?? []),
    ],
    shifts: overlaidShifts,
    sevenShiftsSchedules: [
      ...(household.sevenShiftsSchedules ?? []).filter((item) => item.memberId !== memberId && !personalScheduleIds.has(item.id)),
      ...shapeSevenShiftsSchedules(personal.sevenShiftsSchedules, memberId),
    ],
    coworkers: [
      ...shapeCoworkers(household.coworkers, household.lastCommittedAt ?? MISSING_ISO).filter((item) => item.ownerMemberId !== memberId),
      ...shapeCoworkers(personal.coworkers, personal.lastCommittedAt ?? MISSING_ISO, memberId),
    ],
    coworkerAttendance: [
      ...shapeCoworkerAttendance(household.coworkerAttendance, household.lastCommittedAt ?? MISSING_ISO).filter((item) => item.ownerMemberId !== memberId),
      ...shapeCoworkerAttendance(personal.coworkerAttendance, personal.lastCommittedAt ?? MISSING_ISO, memberId),
    ],
    coworkerSchedules: [
      ...shapeCoworkerSchedules(household.coworkerSchedules, household.lastCommittedAt ?? MISSING_ISO).filter((item) => item.ownerMemberId !== memberId),
      ...shapeCoworkerSchedules(personal.coworkerSchedules, personal.lastCommittedAt ?? MISSING_ISO, memberId),
    ],
    shiftEnvelopes: [
      ...shapeShiftEnvelopes(household.shiftEnvelopes).filter((item) => item.memberId !== memberId),
      ...shapeShiftEnvelopes(personal.shiftEnvelopes, memberId),
    ],
    shiftBibles: [
      ...shapeShiftBibles(household.shiftBibles).filter((item) => item.memberId !== memberId),
      ...memberBibles.filter((item) => !item.linkedShiftId || Boolean(item.correctedByBibleId)),
    ],
    goals: [
      ...household.goals.filter((item) => !personalGoalIds.has(item.id) && (item.shared || item.ownerMemberId !== memberId)),
      ...personalGoals,
    ],
    goalContributions: [
      ...household.goalContributions.filter((item) => !personalGoalIds.has(item.goalId)),
      ...(personal.goalContributions ?? []),
    ],
    goalPurchases: [
      ...household.goalPurchases.filter((item) => !personalGoalIds.has(item.goalId)),
      ...(personal.goalPurchases ?? []),
    ],
    fundPrivate: shapeHouseholdFundPrivate(personal.fundPrivate, memberId),
    tombstones: [...tombstones.values()],
    ...(personal.herculesProPermissions
      ? { herculesProPermissions: shapeHerculesProPermissions(personal.herculesProPermissions) }
      : {}),
    lastCommittedAt: (personal.lastCommittedAt ?? "") > (household.lastCommittedAt ?? "")
      ? personal.lastCommittedAt
      : household.lastCommittedAt,
  });
}

export function assembleHousehold(
  shared: SharedEnvelope,
  personal: PersonalEnvelope | null,
  options?: { linked?: boolean },
): Household {
  const personalTx = personal?.transactions ?? [];
  const personalShifts = personal?.shifts ?? [];
  const personalSchedules = shapeSevenShiftsSchedules(personal?.sevenShiftsSchedules, personal?.memberId);
  const personalCoworkers = shapeCoworkers(personal?.coworkers, personal?.lastCommittedAt ?? MISSING_ISO, personal?.memberId);
  const personalAttendance = shapeCoworkerAttendance(personal?.coworkerAttendance, personal?.lastCommittedAt ?? MISSING_ISO, personal?.memberId);
  const personalCoworkerSchedules = shapeCoworkerSchedules(personal?.coworkerSchedules, personal?.lastCommittedAt ?? MISSING_ISO, personal?.memberId);
  const personalShiftEnvelopes = shapeShiftEnvelopes(personal?.shiftEnvelopes, personal?.memberId);
  const personalShiftBibles = shapeShiftBibles(personal?.shiftBibles, personal?.memberId);
  const personalGoals = personal?.goals ?? [];
  const personalAccounts = personal?.accounts ?? [];
  const personalGoalContributions = personal?.goalContributions ?? [];
  const personalGoalPurchases = personal?.goalPurchases ?? [];
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
    linked: options?.linked === true,
    revision: shared.revision,
    baseRevision: shared.revision,
    booksAcceptedHash: null,
    commandReceipts: shared.commandReceipts ?? [],
    sharing: shapeSharing({ linked: options?.linked === true }),
    conflicts: shared.conflicts ?? [],
    restorePoints: shared.restorePoints ?? [],
    tombstones: mergeTombstones(shared.tombstones, personal?.tombstones ?? []),
    name: shared.name,
    ledgerNames: shapeLedgerNames(shared.ledgerNames, shared.members),
    timezone: shared.timezone,
    currency: shared.currency,
    environment: shared.environment,
    members: shared.members,
    accounts: [...shared.accounts, ...personalAccounts],
    categories: shared.categories,
    recurrences: shared.recurrences,
    appointments: shared.appointments ?? [],
    claims: shared.claims ?? [],
    presets: shared.presets ?? [],
    calendar: shared.calendar,
    kitchen: shared.kitchen,
    google: shared.google,
    goals: [...shared.goals, ...personalGoals],
    goalContributions: [...(shared.goalContributions ?? []), ...personalGoalContributions],
    goalPurchases: [...(shared.goalPurchases ?? []), ...personalGoalPurchases],
    householdFund: shared.householdFund ?? null,
    fundMonthPlans: shared.fundMonthPlans ?? [],
    fundEvents: shared.fundEvents ?? [],
    fundSettlementAllocations: shared.fundSettlementAllocations ?? [],
    fundKittyAllocations: shared.fundKittyAllocations ?? [],
    fundPrivate: shapeHouseholdFundPrivate(personal?.fundPrivate, personal?.memberId),
    budgetPlans: shared.budgetPlans,
    sitDownSessions: shared.sitDownSessions ?? [],
    activity: shared.activity,
    devices: shared.devices ?? [],
    workJobs: shapeWorkJobs(shared.workJobs, shared.lastCommittedAt || MISSING_ISO),
    shiftSettings: shared.shiftSettings,
    lastCommittedAt: laterIso(shared.lastCommittedAt, personal?.lastCommittedAt ?? null),
    transactions: [...txById.values()],
    shifts: personal?.memberId
      ? attachPrivateShiftBibles([...shiftById.values()], personalShiftBibles, personal.memberId)
      : [...shiftById.values()].map(withoutPrivateShiftBible),
    sevenShiftsSchedules: personalSchedules,
    coworkers: personalCoworkers,
    coworkerAttendance: personalAttendance,
    coworkerSchedules: personalCoworkerSchedules,
    shiftEnvelopes: personalShiftEnvelopes,
    shiftBibles: personalShiftBibles.filter((item) => !item.linkedShiftId || Boolean(item.correctedByBibleId)),
    ...(personal?.herculesProPermissions
      ? { herculesProPermissions: personal.herculesProPermissions }
      : {}),
  });
}

export function mergeShared(server: SharedEnvelope, client: SharedEnvelope): SharedEnvelope {
  const tombstones = mergeTombstones(server.tombstones, client.tombstones);
  const newer = laterEnvelope(server, client);
  const goalContributions = mergeRecords(server.goalContributions ?? [], client.goalContributions ?? [], tombstones);
  const goalPurchases = mergeRecords(server.goalPurchases ?? [], client.goalPurchases ?? [], tombstones);
  const goals = applyGoalSavings(mergeRecords(server.goals, client.goals, tombstones), goalContributions);
  return {
    kind: "shared",
    revision: Math.max(server.revision ?? 0, client.revision ?? 0) + 1,
    householdId: server.householdId || client.householdId,
    inviteCode: normalizeInviteCode(server.inviteCode) || client.inviteCode,
    name: newer.name,
    ledgerNames: shapeLedgerNames(newer.ledgerNames, newer.members),
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
    goalPurchases,
    householdFund: (() => {
      const left = shapeHouseholdFundConfig(server.householdFund);
      const right = shapeHouseholdFundConfig(client.householdFund);
      if (!left) return right;
      if (!right) return left;
      return right.updatedAt >= left.updatedAt ? right : left;
    })(),
    fundMonthPlans: mergeRecords(server.fundMonthPlans ?? [], client.fundMonthPlans ?? [], tombstones),
    fundEvents: mergeRecords(server.fundEvents ?? [], client.fundEvents ?? [], tombstones),
    fundSettlementAllocations: mergeRecords(server.fundSettlementAllocations ?? [], client.fundSettlementAllocations ?? [], tombstones),
    fundKittyAllocations: mergeRecords(server.fundKittyAllocations ?? [], client.fundKittyAllocations ?? [], tombstones),
    budgetPlans: mergeRecords(server.budgetPlans, client.budgetPlans, tombstones),
    sitDownSessions: mergeRecords(shapeSitDownSessions(server.sitDownSessions), shapeSitDownSessions(client.sitDownSessions), tombstones),
    activity: mergeRecords(server.activity, client.activity, []).sort((left, right) => left.at.localeCompare(right.at)).slice(-200),
    devices: mergeDevices(server.devices ?? [], client.devices ?? []),
    workJobs: mergeRecords(
      shapeWorkJobs(server.workJobs, server.lastCommittedAt || MISSING_ISO),
      shapeWorkJobs(client.workJobs, client.lastCommittedAt || MISSING_ISO),
      tombstones,
    ),
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
  const serverPermissionAt = server.herculesProPermissions?.updatedAt ?? "";
  const clientPermissionAt = client.herculesProPermissions?.updatedAt ?? "";
  const herculesProPermissions = clientPermissionAt >= serverPermissionAt
    ? client.herculesProPermissions ?? server.herculesProPermissions
    : server.herculesProPermissions ?? client.herculesProPermissions;
  const scheduleSource = Object.prototype.hasOwnProperty.call(newer, "sevenShiftsSchedules")
    ? newer.sevenShiftsSchedules
    : newer === client
      ? server.sevenShiftsSchedules
      : client.sevenShiftsSchedules;
  return {
    kind: "personal",
    memberId: client.memberId || server.memberId,
    lastCommittedAt: newer.lastCommittedAt,
    transactions: mergeRecords(server.transactions, client.transactions, tombstones),
    accounts: mergeRecords(server.accounts ?? [], client.accounts ?? [], tombstones),
    shifts: mergeRecords(server.shifts, client.shifts, tombstones),
    sevenShiftsSchedules: shapeSevenShiftsSchedules(scheduleSource, client.memberId || server.memberId),
    coworkers: mergeRecords(
      shapeCoworkers(server.coworkers, server.lastCommittedAt ?? MISSING_ISO, server.memberId),
      shapeCoworkers(client.coworkers, client.lastCommittedAt ?? MISSING_ISO, client.memberId),
      tombstones,
    ),
    coworkerAttendance: mergeRecords(
      shapeCoworkerAttendance(server.coworkerAttendance, server.lastCommittedAt ?? MISSING_ISO, server.memberId),
      shapeCoworkerAttendance(client.coworkerAttendance, client.lastCommittedAt ?? MISSING_ISO, client.memberId),
      tombstones,
    ),
    coworkerSchedules: mergeRecords(
      shapeCoworkerSchedules(server.coworkerSchedules, server.lastCommittedAt ?? MISSING_ISO, server.memberId),
      shapeCoworkerSchedules(client.coworkerSchedules, client.lastCommittedAt ?? MISSING_ISO, client.memberId),
      tombstones,
    ),
    shiftEnvelopes: mergeRecords(
      shapeShiftEnvelopes(server.shiftEnvelopes, server.memberId),
      shapeShiftEnvelopes(client.shiftEnvelopes, client.memberId),
      tombstones,
    ),
    shiftBibles: mergeRecords(
      shapeShiftBibles(server.shiftBibles, server.memberId),
      shapeShiftBibles(client.shiftBibles, client.memberId),
      tombstones,
    ),
    goals: mergeRecords(server.goals ?? [], client.goals ?? [], tombstones),
    goalContributions: mergeRecords(server.goalContributions ?? [], client.goalContributions ?? [], tombstones),
    goalPurchases: mergeRecords(server.goalPurchases ?? [], client.goalPurchases ?? [], tombstones),
    fundPrivate: {
      bankBindings: mergeRecords(server.fundPrivate?.bankBindings ?? [], client.fundPrivate?.bankBindings ?? [], tombstones),
      reconciliations: mergeRecords(server.fundPrivate?.reconciliations ?? [], client.fundPrivate?.reconciliations ?? [], tombstones),
    },
    tombstones,
    ...(herculesProPermissions ? { herculesProPermissions } : {}),
  };
}

export function displayInviteCode(household: Household): string {
  return formatInviteCode(household.inviteCode);
}

export function cloneAndShape(household: Household): Household {
  return ensureHouseholdShape(cloneHousehold(household));
}
