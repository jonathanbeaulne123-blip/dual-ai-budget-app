import { shapeNativeEvents, mergeNativeEvents } from "./nativeEvents.ts";
import { shapeTasks, mergeTasks, shapeTaskLists, mergeTaskLists } from "./tasks.ts";
import {decodeCompanionGallery} from './herculesCompanionContracts.ts';
import { decodeCompanionProfile } from "./herculesCompanionContracts.ts";
import { shapeFundSourceClaims } from "./fundContributionSources.ts";
import { shapeOnboardingAttestationInvalidations, mergeOnboardingAttestationInvalidations, shapeOnboardingAttestations, mergeOnboardingAttestations } from "./onboarding/attestations.ts";
import { shapeAcceptedStarterPlans, mergeAcceptedStarterPlans } from "./onboarding/planAcceptance.ts";
import {
  cloneHousehold,
  isLandingSurface,
  memberWithoutLandingSurface,
} from "./household.ts";
import { shapeMemberRail } from "./fundRail.ts";
import { formatInviteCode, normalizeInviteCode, randomHouseholdId, randomInviteCode } from "./ids.ts";
import { shapeSharing } from "./sharing.ts";
import { mergeGoogle, shapeGoogle } from "./google.ts";
import { mergeKitchen, shapeKitchen } from "./kitchen.ts";
import { shapeSitDownSessions } from "./sitDown.ts";
import { mergeCalendars, shapeCalendar, shapeRecurrence } from "./recurrence.ts";
import { mergePotentialExpenses, shapePotentialExpenses } from "./potentialExpenses.ts";
import { applyGoalSavings, shapeGoalProgress, shapeGoalPurchases } from "./goals.ts";
import { shapeAppointments, shapeClaims } from "./appointments.ts";
import { shapeAccounts } from "./accountKinds.ts";
import { mergeDevices, shapeDevices } from "./devices.ts";
import { shapeTransactionLocation } from "./transactionLocation.ts";
import { DEFAULT_TIMEZONE, isValidIanaTimeZone, type DateKey } from "./calendar.ts";
import type {
  Activity,
  BudgetPlan,
  Category,
  CommandReceipt,
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
import { ValidationError } from "./types.ts";
import { belongsToSharedLedger, isPersonalOnly, parseVisibility } from "./visibility.ts";
import { shapeLedgerNames } from "./ledgerNames.ts";
import { shapeWorkJobs, shapeWorkSchedule, workPayScheduleIsValid } from "./work.ts";
import { shapeCoworkerAttendance, shapeCoworkers, shapeCoworkerSchedules } from "./coworkers.ts";
import { shapeSevenShiftsEvidenceBundle } from "./evidence.ts";
import { shapeSevenShiftsSchedules } from "./sevenShiftsCalendar.ts";
import { shapeShiftBible, shapeShiftBibles, shapeShiftEnvelopes } from "./shiftEnvelope.ts";
import type { ShiftBible } from "./shiftEnvelope.ts";
import { DEFAULT_SHIFT_SETTINGS } from "./shift.ts";
import {
  shapeHouseholdFundConfig,
  mergeHouseholdFundConfigs,
  shapeHouseholdFundEvents,
  shapeHouseholdFundKittyAllocations,
  shapeHouseholdFundMonthPlans,
  shapeHouseholdFundPrivate,
  shapeHouseholdFundSettlementAllocations,
} from "./householdFund.ts";
import { mergeMonthRehearsals, shapeMonthRehearsals } from "./monthRehearsal.ts";
import { mergeChapters, mergeMoves, mergeRituals, mergeWins, shapeChapters, shapeMoves, shapeRituals, shapeWins } from "./chapters.ts";
import { mergeWeeklyDocumentStamps, shapeWeeklyDocumentStamps } from "./weeklyDocumentStamp.ts";
import { mergeHouseholdCharters, shapeHouseholdCharter } from "./charter.ts";
import { mergeHouseholdOnboarding, shapeHouseholdOnboarding } from "./onboarding/mode.ts";
import { mergeSubmissions, shapeOnboardingSubmissions } from "./onboarding/submissions.ts";
import {
  mergeOnboardingCategoryMerges,
  mergeOnboardingCategoryProposals,
  shapeOnboardingCategoryMerges,
  shapeOnboardingCategoryProposals,
} from "./onboarding/categories.ts";
import {
  mergeMemberProgress,
  shapeMemberOnboardingProgress,
} from "./onboarding/progress.ts";
import { mergeOnboardingApprovals, shapeOnboardingApprovals } from "./onboarding/approvals.ts";
import {
  mergePlanRecords,
  shapePlanActivationJobs,
  shapePlanAcknowledgements,
  shapePlanBridgeDrafts,
  shapePlanBridgeDecisions,
  shapePlanCoachingPreferences,
  shapePlanDrafts,
  shapePlanHerculesSessions,
  shapePlanLearningProgress,
  shapePlanReflections,
  shapePlanScenarios,
  shapePlanVersions,
} from "./planSystem.ts";

export type { PersonalEnvelope, SharedEnvelope };

function assertSyntheticFixtureEnvironment(value: {
  environment: Household["environment"];
  syntheticFixture?: Household["syntheticFixture"];
}): void {
  if (value.syntheticFixture && value.environment !== "development") {
    throw new ValidationError("Synthetic Demo Suite provenance is valid only in Development.");
  }
}

function mergeSyntheticFixture(server: SharedEnvelope, client: SharedEnvelope): Household["syntheticFixture"] {
  assertSyntheticFixtureEnvironment(server);
  assertSyntheticFixtureEnvironment(client);
  const left = server.syntheticFixture ?? null;
  const right = client.syntheticFixture ?? null;
  if (!left) return right;
  if (!right) return left;
  const leftKey = `${left.generatedAt}|${left.version}|${left.seed}`;
  const rightKey = `${right.generatedAt}|${right.version}|${right.seed}`;
  return rightKey >= leftKey ? right : left;
}

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

function shapeGlanceAccountId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

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

function mergeCommandReceipts(server: CommandReceipt[] = [], client: CommandReceipt[] = []): CommandReceipt[] {
  const rows = new Map<string, CommandReceipt>();
  for (const receipt of [...server, ...client]) {
    const existing = rows.get(receipt.confirmationId);
    if (!existing
      || receipt.revision > existing.revision
      || (receipt.revision === existing.revision && receipt.acceptedAt > existing.acceptedAt)
      || (receipt.revision === existing.revision && receipt.acceptedAt === existing.acceptedAt && JSON.stringify(receipt) > JSON.stringify(existing))) {
      rows.set(receipt.confirmationId, receipt);
    }
  }
  return [...rows.values()].sort((left, right) => left.confirmationId.localeCompare(right.confirmationId));
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

function shapeMembers(
  list: Member[] | undefined,
  fallbackIso: string,
  context: Pick<Household, "environment" | "householdId">,
): Member[] {
  return (list ?? []).map((member) => {
    const {
      earningCadence: _unshapedEarningCadence,
      earningCadenceUpdatedAt: _unshapedEarningCadenceUpdatedAt,
      earningDetailSkippedAt: _unshapedEarningDetailSkippedAt,
      ...shared
    } = memberWithoutLandingSurface(member);
    const fundRail = shapeMemberRail(member.fundRail, member.id);
    const onboardingProgress = shapeMemberOnboardingProgress(member.onboardingProgress, {
      ...context,
      memberId: member.id,
    });
    const glanceAccountId = shapeGlanceAccountId(member.glanceAccountId);
    const fundCardAccountId = shapeGlanceAccountId(member.fundCardAccountId);
    const shapedEarningCadence = workPayScheduleIsValid(member.earningCadence)
      ? shapeWorkSchedule(member.earningCadence, MISSING_ISO.slice(0, 10) as DateKey)
      : null;
    const earningCadence = shapedEarningCadence;
    const earningCadenceUpdatedAt = earningCadence && typeof member.earningCadenceUpdatedAt === "string"
      && !Number.isNaN(Date.parse(member.earningCadenceUpdatedAt))
      ? new Date(member.earningCadenceUpdatedAt).toISOString()
      : null;
    const earningDetailSkippedAt = earningCadence && typeof member.earningDetailSkippedAt === "string"
      && !Number.isNaN(Date.parse(member.earningDetailSkippedAt))
      ? new Date(member.earningDetailSkippedAt).toISOString()
      : null;
    return {
      ...shared,
      ...(isLandingSurface(member.landingSurface)
        ? {
            landingSurface: member.landingSurface,
            ...(typeof member.landingSurfaceUpdatedAt === "string" && member.landingSurfaceUpdatedAt
              ? { landingSurfaceUpdatedAt: member.landingSurfaceUpdatedAt }
              : {}),
          }
        : {}),
      ...(fundRail ? { fundRail } : {}),
      ...(onboardingProgress ? { onboardingProgress } : {}),
      ...(glanceAccountId
        ? {
            glanceAccountId,
            ...(typeof member.glanceAccountUpdatedAt === "string" && member.glanceAccountUpdatedAt
              ? { glanceAccountUpdatedAt: member.glanceAccountUpdatedAt }
              : {}),
          }
        : {}),
      ...(fundCardAccountId
        ? {
            fundCardAccountId,
            ...(typeof member.fundCardAccountUpdatedAt === "string" && member.fundCardAccountUpdatedAt
              ? { fundCardAccountUpdatedAt: member.fundCardAccountUpdatedAt }
              : {}),
          }
        : {}),
      ...(earningCadence && earningCadenceUpdatedAt
        ? {
            earningCadence,
            earningCadenceUpdatedAt,
            ...(earningDetailSkippedAt ? { earningDetailSkippedAt } : {}),
          }
        : {}),
      updatedAt: member.updatedAt || fallbackIso,
    };
  });
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

function scopedCompanion(profile: Household["companionProfile"], household: Pick<Household, "environment" | "householdId">, memberId?: string) {
  return profile === undefined ? undefined : decodeCompanionProfile(profile, {
    environment: household.environment, householdId: household.householdId,
    memberId: memberId ?? profile.scope.memberId,
  });
}

export function ensureHouseholdShape(household: Household): Household {
  assertSyntheticFixtureEnvironment(household);
  const fallback = household.members.find((member) => member.active)?.id ?? household.members[0]?.id ?? "";
  const fallbackIso = household.lastCommittedAt || MISSING_ISO;
  const progress = shapeGoalProgress(household.goals, household.goalContributions, fallbackIso, fallback);
  const members = shapeMembers(household.members, fallbackIso, household);
  const householdFund = shapeHouseholdFundConfig(household.householdFund);
  const activeMemberIds = members.filter((member) => member.active).map((member) => member.id);
  const planVersions = shapePlanVersions(household.planVersions);
  return {
    ...household,
    companionProfile: scopedCompanion(household.companionProfile, household),
    ...(household.companionGallery!==undefined?{companionGallery:decodeCompanionGallery(household.companionGallery,household)}:{}),
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
    nativeEvents:shapeNativeEvents(household.nativeEvents),
    tasks:shapeTasks(household.tasks),
    taskLists:shapeTaskLists(household.taskLists),
    potentialExpenses: shapePotentialExpenses(household.potentialExpenses, fallbackIso),
    appointments: shapeAppointments(household.appointments, fallbackIso),
    claims: shapeClaims(household.claims, fallbackIso),
    presets: shapePresets(household.presets, fallbackIso),
    calendar: shapeCalendar(household.calendar),
    kitchen: shapeKitchen(household.kitchen),
    google: shapeGoogle(household.google),
    members,
    accounts: shapeAccounts(household.accounts, fallbackIso),
    categories: shapeCategories(household.categories, fallbackIso),
    budgetPlans: shapeBudgetPlans(household.budgetPlans, fallbackIso),
    sitDownSessions: shapeSitDownSessions(household.sitDownSessions),
    planDrafts: shapePlanDrafts(household.planDrafts),
    planVersions,
    planAcknowledgements: shapePlanAcknowledgements(household.planAcknowledgements, planVersions, activeMemberIds),
    planScenarios: shapePlanScenarios(household.planScenarios),
    planReflections: shapePlanReflections(household.planReflections),
    planLearningProgress: shapePlanLearningProgress(household.planLearningProgress),
    planCoachingPreferences: shapePlanCoachingPreferences(household.planCoachingPreferences),
    planBridgeDrafts: shapePlanBridgeDrafts(household.planBridgeDrafts),
    planBridgeDecisions: shapePlanBridgeDecisions(household.planBridgeDecisions, activeMemberIds),
    planHerculesSessions: shapePlanHerculesSessions(household.planHerculesSessions, activeMemberIds),
    planActivationJobs: shapePlanActivationJobs(household.planActivationJobs, planVersions),
    activity: shapeActivity(household.activity),
    devices: shapeDevices(household.devices, fallbackIso),
    workJobs: shapeWorkJobs(household.workJobs, fallbackIso),
    goals: progress.goals,
    goalContributions: progress.goalContributions,
    goalPurchases: shapeGoalPurchases(household.goalPurchases, fallbackIso, fallback),
    householdOnboarding: shapeHouseholdOnboarding(household.householdOnboarding),
    onboardingSubmissions: shapeOnboardingSubmissions(household.onboardingSubmissions, household.householdId),
    onboardingCategoryProposals: shapeOnboardingCategoryProposals(household.onboardingCategoryProposals, household.householdId),
    onboardingCategoryMerges: shapeOnboardingCategoryMerges(household.onboardingCategoryMerges, household.householdId),
    onboardingApprovals: shapeOnboardingApprovals(household.onboardingApprovals, household.householdId),
    onboardingAttestationInvalidations: shapeOnboardingAttestationInvalidations(household.onboardingAttestationInvalidations),
    onboardingAttestations: shapeOnboardingAttestations(household.onboardingAttestations, household.householdId),
    acceptedStarterPlans: shapeAcceptedStarterPlans(household.acceptedStarterPlans),
    charter: shapeHouseholdCharter(household.charter, { members, householdFund }),
    householdFund,
    fundMonthPlans: shapeHouseholdFundMonthPlans(household.fundMonthPlans),
    fundEvents: shapeHouseholdFundEvents(household.fundEvents),
    fundSettlementAllocations: shapeHouseholdFundSettlementAllocations(household.fundSettlementAllocations),
    fundKittyAllocations: shapeHouseholdFundKittyAllocations(household.fundKittyAllocations),
    fundPrivate: shapeHouseholdFundPrivate(household.fundPrivate),
    fundContributionSourceClaims: shapeFundSourceClaims(household.fundContributionSourceClaims),
    monthRehearsals: shapeMonthRehearsals(household.monthRehearsals),
    weeklyDocumentStamps: shapeWeeklyDocumentStamps(household.weeklyDocumentStamps, members),
    chapters: shapeChapters(household.chapters),
    rituals: shapeRituals(household.rituals),
    moves: shapeMoves(household.moves),
    wins: shapeWins(household.wins),
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
    syntheticFixture: household.syntheticFixture ?? null,
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
    nativeEvents:[],
    tasks:[],
    taskLists:[],
    potentialExpenses: [],
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
  const personalTx = shaped.transactions.filter((tx) => isPersonalOnly(tx) && tx.createdBy === memberId);
  const sharedPotentialExpenses = shaped.potentialExpenses.filter((row) => !isPersonalOnly(row));
  const personalPotentialExpenses = shaped.potentialExpenses.filter((row) => isPersonalOnly(row) && row.createdBy === memberId);
  const sharedShifts = shaped.shifts.filter((shift) => belongsToSharedLedger(shift)).map(withoutPrivateShiftBible);
  const personalShifts = shaped.shifts.filter((shift) => isPersonalOnly(shift) && shift.createdBy === memberId).map(withoutPrivateShiftBible);
  const memberShiftBibles = personalShiftBibles(shaped, memberId);
  const sharedGoals = shaped.goals.filter((goal) => goal.shared);
  const personalGoals = shaped.goals.filter((goal) => !goal.shared && goal.ownerMemberId === memberId);
  const sharedGoalIds = new Set(sharedGoals.map((goal) => goal.id));
  const personalGoalIds = new Set(personalGoals.map((goal) => goal.id));
  const sharedAccounts = shaped.accounts.filter((account) => account.scope !== "personal");
  const personalAccounts = shaped.accounts.filter((account) => account.scope === "personal" && account.ownerMemberId === memberId);
  const privateActivityTokens = [
    ...shaped.transactions.filter(isPersonalOnly).map((row) => row.id),
    ...shaped.potentialExpenses.filter(isPersonalOnly).flatMap((row) => [row.id, row.title]),
    ...(shaped.tasks ?? []).filter((row) => row.visibility === "personal").flatMap((row) => [row.id, row.title, row.notes]),
    ...(shaped.taskLists ?? []).filter((row) => row.visibility === "personal").flatMap((row) => [row.id, row.name]),
    ...shaped.accounts.filter((row) => row.scope === "personal").flatMap((row) => [row.id, row.name]),
    ...shaped.goals.filter((row) => !row.shared).flatMap((row) => [row.id, row.name]),
    ...(shaped.sevenShiftsSchedules ?? []).flatMap((row) => [row.id, row.provenanceId]),
    ...(shaped.shiftEnvelopes ?? []).flatMap((row) => [row.id, row.canonicalShiftKey]),
    ...(shaped.shiftBibles ?? []).map((row) => row.id),
    ...(shaped.fundContributionSourceClaims ?? []).flatMap(row => [row.id, row.sourceTransactionId]),
    ...(shaped.fundPrivate?.bankBindings ?? []).map((row) => row.id),
    ...(shaped.fundPrivate?.reconciliations ?? []).map((row) => row.id),
  ].filter((token) => token.length >= 4);
  const sharedActivity = shaped.activity.filter((row) => !privateActivityTokens.some((token) => row.summary.includes(token)));
  const activeMemberIds = shaped.members.filter((member) => member.active).map((member) => member.id);
  const sharedPlanVersions = shapePlanVersions(shaped.planVersions, { scope: "household" });
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
    members: shaped.members.map(memberWithoutLandingSurface),
    accounts: sharedAccounts,
    categories: shaped.categories,
    recurrences: shaped.recurrences,
    nativeEvents:shapeNativeEvents(shaped.nativeEvents).filter(r=>r.visibility==='household'),
    tasks:shapeTasks(shaped.tasks).filter(r=>r.visibility==='household'),
    taskLists:shapeTaskLists(shaped.taskLists).filter(r=>r.visibility==='household'),
    potentialExpenses: sharedPotentialExpenses,
    appointments: shaped.appointments,
    claims: shaped.claims,
    presets: shaped.presets,
    calendar: shaped.calendar,
    ...(shaped.companionGallery!==undefined?{companionGallery:shaped.companionGallery}:{}),
    kitchen: shaped.kitchen,
    google: shaped.google,
    goals: sharedGoals,
    goalContributions: shaped.goalContributions.filter((row) => sharedGoalIds.has(row.goalId)),
    goalPurchases: shaped.goalPurchases.filter((row) => sharedGoalIds.has(row.goalId)),
    householdOnboarding: shaped.householdOnboarding ?? null,
    onboardingSubmissions: shaped.onboardingSubmissions ?? [],
    onboardingCategoryProposals: shaped.onboardingCategoryProposals ?? [],
    onboardingCategoryMerges: shaped.onboardingCategoryMerges ?? [],
    onboardingApprovals: shaped.onboardingApprovals ?? [],
    onboardingAttestationInvalidations: shaped.onboardingAttestationInvalidations ?? [],
    onboardingAttestations: shaped.onboardingAttestations ?? [],
    acceptedStarterPlans: shaped.acceptedStarterPlans ?? [],
    charter: shaped.charter ?? null,
    householdFund: shaped.householdFund ?? null,
    fundMonthPlans: shaped.fundMonthPlans ?? [],
    fundEvents: shaped.fundEvents ?? [],
    fundSettlementAllocations: shaped.fundSettlementAllocations ?? [],
    fundKittyAllocations: shaped.fundKittyAllocations ?? [],
    monthRehearsals: shaped.monthRehearsals ?? [],
    weeklyDocumentStamps: shaped.weeklyDocumentStamps ?? [],
    chapters: shaped.chapters ?? [],
    rituals: shaped.rituals ?? [],
    moves: shaped.moves ?? [],
    wins: shaped.wins ?? [],
    budgetPlans: shaped.budgetPlans,
    sitDownSessions: shaped.sitDownSessions,
    planVersions: sharedPlanVersions,
    planAcknowledgements: shapePlanAcknowledgements(shaped.planAcknowledgements, sharedPlanVersions, activeMemberIds),
    planReflections: shapePlanReflections(shaped.planReflections, { scope: "household" }),
    planBridgeDecisions: shapePlanBridgeDecisions(shaped.planBridgeDecisions, activeMemberIds),
    planHerculesSessions: shapePlanHerculesSessions(shaped.planHerculesSessions, activeMemberIds),
    planActivationJobs: shapePlanActivationJobs(shaped.planActivationJobs, sharedPlanVersions),
    activity: sharedActivity,
    devices: shaped.devices,
    workJobs: shaped.workJobs,
    shiftSettings: shaped.shiftSettings,
    lastCommittedAt: shaped.lastCommittedAt,
    accountOpeningCheckpoints: (shaped.accountOpeningCheckpoints ?? []).filter(r => r.visibility === "household"),
    accountHistoryReviews: (shaped.accountHistoryReviews ?? []).filter(r => r.visibility === "household"),
    accountHistoryApprovals: (shaped.accountHistoryApprovals ?? []).filter(r => r.visibility === "household"),
    transactions: sharedTx,
    shifts: sharedShifts,
    tombstones: shaped.tombstones,
    commandReceipts: shaped.commandReceipts,
    restorePoints: shaped.restorePoints ?? [],
    syntheticFixture: shaped.syntheticFixture ?? null,
  };
  const personalMember = shaped.members.find((member) => member.id === memberId);
  const onboardingProgress = shapeMemberOnboardingProgress(personalMember?.onboardingProgress, {
    environment: shaped.environment,
    householdId: shaped.householdId,
    memberId,
  });
  const personal: PersonalEnvelope = {
    ...(shaped.companionProfile?.scope.memberId === memberId ? { companionProfile: scopedCompanion(shaped.companionProfile, shaped, memberId) } : {}),
    kind: "personal",
    memberId,
    planDrafts: shapePlanDrafts(shaped.planDrafts, memberId),
    planVersions: shapePlanVersions(shaped.planVersions, { scope: "personal", ownerMemberId: memberId }),
    planScenarios: shapePlanScenarios(shaped.planScenarios, memberId),
    planReflections: shapePlanReflections(shaped.planReflections, { scope: "personal", ownerMemberId: memberId }),
    planLearningProgress: shapePlanLearningProgress(shaped.planLearningProgress, memberId),
    planCoachingPreferences: shapePlanCoachingPreferences(shaped.planCoachingPreferences, memberId),
    planBridgeDrafts: shapePlanBridgeDrafts(shaped.planBridgeDrafts, memberId),
    ...(isLandingSurface(personalMember?.landingSurface)
      ? {
          landingSurface: personalMember.landingSurface,
          ...(personalMember.landingSurfaceUpdatedAt
            ? { landingSurfaceUpdatedAt: personalMember.landingSurfaceUpdatedAt }
            : {}),
        }
      : {}),
    ...(shapeMemberRail(personalMember?.fundRail, memberId)
      ? { fundRail: shapeMemberRail(personalMember?.fundRail, memberId)! }
      : {}),
    ...(onboardingProgress ? { onboardingProgress } : {}),
    ...(shapeGlanceAccountId(personalMember?.glanceAccountId)
      ? {
          glanceAccountId: shapeGlanceAccountId(personalMember?.glanceAccountId),
          ...(personalMember?.glanceAccountUpdatedAt
            ? { glanceAccountUpdatedAt: personalMember.glanceAccountUpdatedAt }
            : {}),
        }
      : {}),
    ...(shapeGlanceAccountId(personalMember?.fundCardAccountId)
      ? {
          fundCardAccountId: shapeGlanceAccountId(personalMember?.fundCardAccountId),
          ...(personalMember?.fundCardAccountUpdatedAt
            ? { fundCardAccountUpdatedAt: personalMember.fundCardAccountUpdatedAt }
            : {}),
        }
      : {}),
    accounts: personalAccounts,
    lastCommittedAt: shaped.lastCommittedAt,
    accountOpeningCheckpoints: (shaped.accountOpeningCheckpoints ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === memberId),
    accountHistoryReviews: (shaped.accountHistoryReviews ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === memberId),
    accountHistoryApprovals: (shaped.accountHistoryApprovals ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === memberId),
    transactions: personalTx,
    nativeEvents:shapeNativeEvents(shaped.nativeEvents).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    tasks:shapeTasks(shaped.tasks).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    taskLists:shapeTaskLists(shaped.taskLists).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    potentialExpenses: personalPotentialExpenses,
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
    fundContributionSourceClaims: shapeFundSourceClaims(shaped.fundContributionSourceClaims, memberId),
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
    nativeEvents:shapeNativeEvents(personal.nativeEvents).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    tasks:shapeTasks(personal.tasks).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    taskLists:shapeTaskLists(personal.taskLists).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    potentialExpenses: (personal.potentialExpenses ?? []).filter((row) => row.createdBy === memberId && row.visibility === "personal"),
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
    fundContributionSourceClaims: shapeFundSourceClaims(personal.fundContributionSourceClaims, memberId),
    planDrafts: shapePlanDrafts(personal.planDrafts, memberId),
    planVersions: shapePlanVersions(personal.planVersions, { scope: "personal", ownerMemberId: memberId }),
    planScenarios: shapePlanScenarios(personal.planScenarios, memberId),
    planReflections: shapePlanReflections(personal.planReflections, { scope: "personal", ownerMemberId: memberId }),
    planLearningProgress: shapePlanLearningProgress(personal.planLearningProgress, memberId),
    planCoachingPreferences: shapePlanCoachingPreferences(personal.planCoachingPreferences, memberId),
    planBridgeDrafts: shapePlanBridgeDrafts(personal.planBridgeDrafts, memberId),
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
    companionProfile: row.companionProfile === undefined ? undefined : decodeCompanionProfile(row.companionProfile, { ...row.companionProfile.scope, memberId }),
    ...(isLandingSurface(row.landingSurface)
      ? {
          landingSurface: row.landingSurface,
          ...(typeof row.landingSurfaceUpdatedAt === "string" && row.landingSurfaceUpdatedAt
            ? { landingSurfaceUpdatedAt: row.landingSurfaceUpdatedAt }
            : { landingSurfaceUpdatedAt: undefined }),
        }
      : { landingSurface: undefined, landingSurfaceUpdatedAt: undefined }),
    fundRail: shapeMemberRail(row.fundRail, memberId) ?? undefined,
    onboardingProgress: shapeMemberOnboardingProgress(row.onboardingProgress, { memberId }) ?? undefined,
    glanceAccountId: shapeGlanceAccountId(row.glanceAccountId),
    glanceAccountUpdatedAt: shapeGlanceAccountId(row.glanceAccountId)
      && typeof row.glanceAccountUpdatedAt === "string"
      && row.glanceAccountUpdatedAt
      ? row.glanceAccountUpdatedAt
      : undefined,
    fundCardAccountId: shapeGlanceAccountId(row.fundCardAccountId),
    fundCardAccountUpdatedAt: shapeGlanceAccountId(row.fundCardAccountId)
      && typeof row.fundCardAccountUpdatedAt === "string"
      && row.fundCardAccountUpdatedAt
      ? row.fundCardAccountUpdatedAt
      : undefined,
    accounts,
    accountOpeningCheckpoints: (row.accountOpeningCheckpoints ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === memberId),
    accountHistoryReviews: (row.accountHistoryReviews ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === memberId),
    accountHistoryApprovals: (row.accountHistoryApprovals ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === memberId),
    transactions: Array.isArray(row.transactions)
      ? row.transactions.filter((item) => item.createdBy === memberId && item.visibility === "personal")
      : [],
    nativeEvents:shapeNativeEvents(row.nativeEvents).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    tasks:shapeTasks(row.tasks).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    taskLists:shapeTaskLists(row.taskLists).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    potentialExpenses: shapePotentialExpenses(row.potentialExpenses, row.lastCommittedAt ?? MISSING_ISO)
      .filter((item) => item.createdBy === memberId && item.visibility === "personal"),
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
    fundContributionSourceClaims: shapeFundSourceClaims(row.fundContributionSourceClaims, memberId),
    planDrafts: shapePlanDrafts(row.planDrafts, memberId),
    planVersions: shapePlanVersions(row.planVersions, { scope: "personal", ownerMemberId: memberId }),
    planScenarios: shapePlanScenarios(row.planScenarios, memberId),
    planReflections: shapePlanReflections(row.planReflections, { scope: "personal", ownerMemberId: memberId }),
    planLearningProgress: shapePlanLearningProgress(row.planLearningProgress, memberId),
    planCoachingPreferences: shapePlanCoachingPreferences(row.planCoachingPreferences, memberId),
    planBridgeDrafts: shapePlanBridgeDrafts(row.planBridgeDrafts, memberId),
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
  if (!personal || personal.kind !== "personal" || personal.memberId !== memberId) return { ...household, companionProfile: undefined };
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
    companionProfile: scopedCompanion(personal.companionProfile, household, memberId),
    members: household.members.map((member) => {
      if (member.id !== memberId) return memberWithoutLandingSurface(member);
      const fundRail = shapeMemberRail(personal.fundRail, memberId);
      const onboardingProgress = shapeMemberOnboardingProgress(personal.onboardingProgress, {
        environment: household.environment,
        householdId: household.householdId,
        memberId,
      });
      const glanceAccountId = shapeGlanceAccountId(personal.glanceAccountId);
      const fundCardAccountId = shapeGlanceAccountId(personal.fundCardAccountId);
      return {
        ...memberWithoutLandingSurface(member),
        ...(isLandingSurface(personal.landingSurface)
          ? {
              landingSurface: personal.landingSurface,
              ...(personal.landingSurfaceUpdatedAt ? { landingSurfaceUpdatedAt: personal.landingSurfaceUpdatedAt } : {}),
            }
          : {}),
        ...(fundRail ? { fundRail } : {}),
        ...(onboardingProgress ? { onboardingProgress } : {}),
        ...(glanceAccountId
          ? {
              glanceAccountId,
              ...(personal.glanceAccountUpdatedAt
                ? { glanceAccountUpdatedAt: personal.glanceAccountUpdatedAt }
                : {}),
            }
          : {}),
        ...(fundCardAccountId
          ? {
              fundCardAccountId,
              ...(personal.fundCardAccountUpdatedAt
                ? { fundCardAccountUpdatedAt: personal.fundCardAccountUpdatedAt }
                : {}),
            }
          : {}),
      };
    }),
    accountOpeningCheckpoints: [...(household.accountOpeningCheckpoints ?? []).filter(r => !(r.visibility === "personal" && r.ownerMemberId === memberId)), ...(personal.accountOpeningCheckpoints ?? [])],
    accountHistoryReviews: [...(household.accountHistoryReviews ?? []).filter(r => !(r.visibility === "personal" && r.ownerMemberId === memberId)), ...(personal.accountHistoryReviews ?? [])],
    accountHistoryApprovals: [...(household.accountHistoryApprovals ?? []).filter(r => !(r.visibility === "personal" && r.ownerMemberId === memberId)), ...(personal.accountHistoryApprovals ?? [])],
    transactions: [
      ...household.transactions.filter((item) => !(
        (item.visibility === "personal" && item.createdBy === memberId) || personalTransactionIds.has(item.id)
      )),
      ...personal.transactions,
    ],
    nativeEvents:mergeNativeEvents((household.nativeEvents??[]).filter(r=>r.visibility!=='personal'||r.createdBy!==memberId),personal.nativeEvents),
    tasks:mergeTasks((household.tasks??[]).filter(r=>r.visibility!=='personal'||r.createdBy!==memberId),personal.tasks),
    taskLists:mergeTaskLists((household.taskLists??[]).filter(r=>r.visibility!=='personal'||r.createdBy!==memberId),personal.taskLists),
    potentialExpenses: mergePotentialExpenses(
      household.potentialExpenses.filter((item) => !(item.visibility === "personal" && item.createdBy === memberId)),
      personal.potentialExpenses,
      personal.lastCommittedAt ?? household.lastCommittedAt ?? MISSING_ISO,
    ),
    accounts: [
      ...household.accounts.filter((item) => !(item.scope === "personal" && item.ownerMemberId === memberId)),
      ...(personal.accounts ?? []),
    ],
    planDrafts: shapePlanDrafts(personal.planDrafts, memberId),
    planVersions: [
      ...(household.planVersions ?? []).filter((row) => row.scope !== "personal" || row.ownerMemberId !== memberId),
      ...shapePlanVersions(personal.planVersions, { scope: "personal", ownerMemberId: memberId }),
    ],
    planScenarios: shapePlanScenarios(personal.planScenarios, memberId),
    planReflections: [
      ...(household.planReflections ?? []).filter((row) => row.scope !== "personal" || row.ownerMemberId !== memberId),
      ...shapePlanReflections(personal.planReflections, { scope: "personal", ownerMemberId: memberId }),
    ],
    planLearningProgress: shapePlanLearningProgress(personal.planLearningProgress, memberId),
    planCoachingPreferences: shapePlanCoachingPreferences(personal.planCoachingPreferences, memberId),
    planBridgeDrafts: shapePlanBridgeDrafts(personal.planBridgeDrafts, memberId),
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
    fundContributionSourceClaims: shapeFundSourceClaims(personal.fundContributionSourceClaims, memberId),
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
    accountOpeningCheckpoints: [...(shared.accountOpeningCheckpoints ?? []).filter(r => r.visibility === "household"), ...(personal?.accountOpeningCheckpoints ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === personal?.memberId)],
    accountHistoryReviews: [...(shared.accountHistoryReviews ?? []).filter(r => r.visibility === "household"), ...(personal?.accountHistoryReviews ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === personal?.memberId)],
    accountHistoryApprovals: [...(shared.accountHistoryApprovals ?? []).filter(r => r.visibility === "household"), ...(personal?.accountHistoryApprovals ?? []).filter(r => r.visibility === "personal" && r.ownerMemberId === personal?.memberId)],
    commandReceipts: shared.commandReceipts ?? [],
    sharing: shapeSharing({ linked: options?.linked === true }),
    conflicts: shared.conflicts ?? [],
    restorePoints: shared.restorePoints ?? [],
    syntheticFixture: shared.syntheticFixture ?? null,
    tombstones: mergeTombstones(shared.tombstones, personal?.tombstones ?? []),
    name: shared.name,
    ledgerNames: shapeLedgerNames(shared.ledgerNames, shared.members),
    timezone: shared.timezone,
    currency: shared.currency,
    environment: shared.environment,
    members: shared.members.map((member) => {
      if (member.id !== personal?.memberId) return memberWithoutLandingSurface(member);
      const fundRail = shapeMemberRail(personal?.fundRail, member.id);
      const onboardingProgress = shapeMemberOnboardingProgress(personal?.onboardingProgress, {
        environment: shared.environment,
        householdId: shared.householdId,
        memberId: member.id,
      });
      const glanceAccountId = shapeGlanceAccountId(personal?.glanceAccountId);
      const fundCardAccountId = shapeGlanceAccountId(personal?.fundCardAccountId);
      return {
        ...memberWithoutLandingSurface(member),
        ...(isLandingSurface(personal?.landingSurface)
          ? {
              landingSurface: personal.landingSurface,
              ...(personal.landingSurfaceUpdatedAt ? { landingSurfaceUpdatedAt: personal.landingSurfaceUpdatedAt } : {}),
            }
          : {}),
        ...(fundRail ? { fundRail } : {}),
        ...(onboardingProgress ? { onboardingProgress } : {}),
        ...(glanceAccountId
          ? {
              glanceAccountId,
              ...(personal?.glanceAccountUpdatedAt
                ? { glanceAccountUpdatedAt: personal.glanceAccountUpdatedAt }
                : {}),
            }
          : {}),
        ...(fundCardAccountId
          ? {
              fundCardAccountId,
              ...(personal?.fundCardAccountUpdatedAt
                ? { fundCardAccountUpdatedAt: personal.fundCardAccountUpdatedAt }
                : {}),
            }
          : {}),
      };
    }),
    accounts: [...shared.accounts, ...personalAccounts],
    categories: shared.categories,
    recurrences: shared.recurrences,
    nativeEvents:mergeNativeEvents(shared.nativeEvents,personal?.nativeEvents),
    tasks:mergeTasks(shared.tasks,personal?.tasks),
    taskLists:mergeTaskLists(shared.taskLists,personal?.taskLists),
    potentialExpenses: mergePotentialExpenses(
      shared.potentialExpenses,
      personal?.potentialExpenses,
      personal?.lastCommittedAt ?? shared.lastCommittedAt ?? MISSING_ISO,
    ),
    appointments: shared.appointments ?? [],
    claims: shared.claims ?? [],
    presets: shared.presets ?? [],
    calendar: shared.calendar,
    ...(shared.companionGallery!==undefined?{companionGallery:decodeCompanionGallery(shared.companionGallery,shared)}:{}),
    kitchen: shared.kitchen,
    google: shared.google,
    goals: [...shared.goals, ...personalGoals],
    goalContributions: [...(shared.goalContributions ?? []), ...personalGoalContributions],
    goalPurchases: [...(shared.goalPurchases ?? []), ...personalGoalPurchases],
    householdOnboarding: shared.householdOnboarding ?? null,
    onboardingSubmissions: shapeOnboardingSubmissions(shared.onboardingSubmissions, shared.householdId),
    onboardingCategoryProposals: shapeOnboardingCategoryProposals(shared.onboardingCategoryProposals, shared.householdId),
    onboardingCategoryMerges: shapeOnboardingCategoryMerges(shared.onboardingCategoryMerges, shared.householdId),
    onboardingApprovals: shapeOnboardingApprovals(shared.onboardingApprovals, shared.householdId),
    onboardingAttestationInvalidations: shapeOnboardingAttestationInvalidations(shared.onboardingAttestationInvalidations),
    onboardingAttestations: shapeOnboardingAttestations(shared.onboardingAttestations, shared.householdId),
    acceptedStarterPlans: shapeAcceptedStarterPlans(shared.acceptedStarterPlans),
    charter: shared.charter ?? null,
    householdFund: shared.householdFund ?? null,
    fundMonthPlans: shared.fundMonthPlans ?? [],
    fundEvents: shared.fundEvents ?? [],
    fundSettlementAllocations: shared.fundSettlementAllocations ?? [],
    fundKittyAllocations: shared.fundKittyAllocations ?? [],
    monthRehearsals: shapeMonthRehearsals(shared.monthRehearsals),
    weeklyDocumentStamps: shapeWeeklyDocumentStamps(shared.weeklyDocumentStamps, shared.members),
    chapters: shapeChapters(shared.chapters),
    rituals: shapeRituals(shared.rituals),
    moves: shapeMoves(shared.moves),
    wins: shapeWins(shared.wins),
    companionProfile: scopedCompanion(personal?.companionProfile, shared, personal?.memberId),
    fundPrivate: shapeHouseholdFundPrivate(personal?.fundPrivate, personal?.memberId),
    fundContributionSourceClaims: shapeFundSourceClaims(personal?.fundContributionSourceClaims, personal?.memberId),
    budgetPlans: shared.budgetPlans,
    sitDownSessions: shared.sitDownSessions ?? [],
    planDrafts: shapePlanDrafts(personal?.planDrafts, personal?.memberId),
    planVersions: [
      ...shapePlanVersions(shared.planVersions, { scope: "household" }),
      ...shapePlanVersions(personal?.planVersions, { scope: "personal", ownerMemberId: personal?.memberId }),
    ],
    planAcknowledgements: shapePlanAcknowledgements(
      shared.planAcknowledgements,
      shapePlanVersions(shared.planVersions, { scope: "household" }),
      shared.members.filter((member) => member.active).map((member) => member.id),
    ),
    planScenarios: shapePlanScenarios(personal?.planScenarios, personal?.memberId),
    planReflections: [
      ...shapePlanReflections(shared.planReflections, { scope: "household" }),
      ...shapePlanReflections(personal?.planReflections, { scope: "personal", ownerMemberId: personal?.memberId }),
    ],
    planLearningProgress: shapePlanLearningProgress(personal?.planLearningProgress, personal?.memberId),
    planCoachingPreferences: shapePlanCoachingPreferences(personal?.planCoachingPreferences, personal?.memberId),
    planBridgeDrafts: shapePlanBridgeDrafts(personal?.planBridgeDrafts, personal?.memberId),
    planBridgeDecisions: shapePlanBridgeDecisions(shared.planBridgeDecisions, shared.members.filter((member) => member.active).map((member) => member.id)),
    planHerculesSessions: shapePlanHerculesSessions(shared.planHerculesSessions, shared.members.filter((member) => member.active).map((member) => member.id)),
    planActivationJobs: shapePlanActivationJobs(shared.planActivationJobs, shapePlanVersions(shared.planVersions, { scope: "household" })),
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
  assertSyntheticFixtureEnvironment(server);
  assertSyntheticFixtureEnvironment(client);
  const tombstones = mergeTombstones(server.tombstones, client.tombstones);
  const newer = laterEnvelope(server, client);
  const goalContributions = mergeRecords(server.goalContributions ?? [], client.goalContributions ?? [], tombstones);
  const goalPurchases = mergeRecords(server.goalPurchases ?? [], client.goalPurchases ?? [], tombstones);
  const goals = applyGoalSavings(mergeRecords(server.goals, client.goals, tombstones), goalContributions);
  const members = mergeRecords(server.members, client.members, []).map(memberWithoutLandingSurface);
  const householdFund = mergeHouseholdFundConfigs(server.householdFund, client.householdFund);
  const householdOnboarding = mergeHouseholdOnboarding(server.householdOnboarding, client.householdOnboarding, {
    householdId: server.householdId || client.householdId,
    environment: newer.environment,
    members,
  });
  const onboardingSubmissions = mergeSubmissions(server.onboardingSubmissions, client.onboardingSubmissions)
    .filter((row) => row.householdId === (server.householdId || client.householdId));
  const onboardingCategoryProposals = mergeOnboardingCategoryProposals(
    server.onboardingCategoryProposals,
    client.onboardingCategoryProposals,
  ).filter((row) => row.householdId === (server.householdId || client.householdId));
  const onboardingCategoryMerges = mergeOnboardingCategoryMerges(
    server.onboardingCategoryMerges,
    client.onboardingCategoryMerges,
  ).filter((row) => row.householdId === (server.householdId || client.householdId));
  const onboardingApprovals = mergeOnboardingApprovals(
    server.onboardingApprovals,
    client.onboardingApprovals,
  ).filter((row) => row.householdId === (server.householdId || client.householdId));
  const charter = mergeHouseholdCharters(server.charter, client.charter, { members, householdFund });
  const activeMemberIds = members.filter((member) => member.active).map((member) => member.id);
  const mergedPlanVersions = mergePlanRecords(
    shapePlanVersions(server.planVersions, { scope: "household" }),
    shapePlanVersions(client.planVersions, { scope: "household" }),
    (row) => `${String(row.sequence).padStart(8, "0")}|${row.createdAt}`,
  );
  const mergedPlanAcknowledgements = shapePlanAcknowledgements(
    [...(server.planAcknowledgements ?? []), ...(client.planAcknowledgements ?? [])],
    mergedPlanVersions,
    activeMemberIds,
  );
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
    members,
    accounts: mergeRecords(server.accounts, client.accounts, []),
    categories: mergeRecords(server.categories, client.categories, []),
    recurrences: mergeRecords(server.recurrences, client.recurrences, tombstones),
    nativeEvents:mergeNativeEvents(server.nativeEvents,client.nativeEvents),
    tasks:mergeTasks(server.tasks,client.tasks),
    taskLists:mergeTaskLists(server.taskLists,client.taskLists),
    potentialExpenses: mergePotentialExpenses(server.potentialExpenses, client.potentialExpenses, newer.lastCommittedAt ?? MISSING_ISO),
    appointments: mergeRecords(server.appointments ?? [], client.appointments ?? [], tombstones),
    claims: mergeRecords(server.claims ?? [], client.claims ?? [], tombstones),
    presets: mergeRecords(server.presets ?? [], client.presets ?? [], tombstones),
    calendar: mergeCalendars(server.calendar, client.calendar),
    ...mergeCompanionGallery(server,client),
    kitchen: mergeKitchen(server.kitchen, client.kitchen, tombstones),
    google: mergeGoogle(server.google, client.google, tombstones),
    goals,
    goalContributions,
    goalPurchases,
    householdOnboarding,
    onboardingSubmissions,
    onboardingCategoryProposals,
    onboardingCategoryMerges,
    onboardingApprovals,
    onboardingAttestationInvalidations: mergeOnboardingAttestationInvalidations(server.onboardingAttestationInvalidations, client.onboardingAttestationInvalidations),
    onboardingAttestations: mergeOnboardingAttestations(server.onboardingAttestations, client.onboardingAttestations),
    acceptedStarterPlans: mergeAcceptedStarterPlans(server.acceptedStarterPlans, client.acceptedStarterPlans),
    charter,
    householdFund,
    fundMonthPlans: mergeRecords(server.fundMonthPlans ?? [], client.fundMonthPlans ?? [], tombstones),
    fundEvents: mergeRecords(server.fundEvents ?? [], client.fundEvents ?? [], tombstones),
    fundSettlementAllocations: mergeRecords(server.fundSettlementAllocations ?? [], client.fundSettlementAllocations ?? [], tombstones),
    fundKittyAllocations: mergeRecords(server.fundKittyAllocations ?? [], client.fundKittyAllocations ?? [], tombstones),
    monthRehearsals: mergeMonthRehearsals(
      shapeMonthRehearsals(server.monthRehearsals),
      shapeMonthRehearsals(client.monthRehearsals),
    ),
    chapters: mergeChapters(shapeChapters(server.chapters), shapeChapters(client.chapters)),
    rituals: mergeRituals(shapeRituals(server.rituals), shapeRituals(client.rituals)),
    moves: mergeMoves(shapeMoves(server.moves), shapeMoves(client.moves)),
    wins: mergeWins(shapeWins(server.wins), shapeWins(client.wins)),
    weeklyDocumentStamps: mergeWeeklyDocumentStamps(
      server.weeklyDocumentStamps,
      client.weeklyDocumentStamps,
      members,
    ),
    budgetPlans: mergeRecords(server.budgetPlans, client.budgetPlans, tombstones),
    sitDownSessions: mergeRecords(shapeSitDownSessions(server.sitDownSessions), shapeSitDownSessions(client.sitDownSessions), tombstones),
    planVersions: mergedPlanVersions,
    planAcknowledgements: mergedPlanAcknowledgements,
    planReflections: mergePlanRecords(shapePlanReflections(server.planReflections, { scope: "household" }), shapePlanReflections(client.planReflections, { scope: "household" }), (row) => row.updatedAt),
    planBridgeDecisions: mergePlanRecords(shapePlanBridgeDecisions(server.planBridgeDecisions, activeMemberIds), shapePlanBridgeDecisions(client.planBridgeDecisions, activeMemberIds), (row) => row.updatedAt),
    planHerculesSessions: mergePlanRecords(shapePlanHerculesSessions(server.planHerculesSessions, activeMemberIds), shapePlanHerculesSessions(client.planHerculesSessions, activeMemberIds), (row) => row.updatedAt),
    planActivationJobs: mergePlanRecords(shapePlanActivationJobs(server.planActivationJobs, mergedPlanVersions), shapePlanActivationJobs(client.planActivationJobs, mergedPlanVersions), (row) => row.updatedAt),
    activity: mergeRecords(server.activity, client.activity, []).sort((left, right) => left.at.localeCompare(right.at)).slice(-200),
    devices: mergeDevices(server.devices ?? [], client.devices ?? []),
    workJobs: mergeRecords(
      shapeWorkJobs(server.workJobs, server.lastCommittedAt || MISSING_ISO),
      shapeWorkJobs(client.workJobs, client.lastCommittedAt || MISSING_ISO),
      tombstones,
    ),
    shiftSettings: newer.shiftSettings,
    lastCommittedAt: newer.lastCommittedAt,
    accountOpeningCheckpoints: mergeRecords(server.accountOpeningCheckpoints ?? [], client.accountOpeningCheckpoints ?? [], tombstones),
    accountHistoryReviews: mergeRecords(server.accountHistoryReviews ?? [], client.accountHistoryReviews ?? [], tombstones),
    accountHistoryApprovals: mergeRecords(server.accountHistoryApprovals ?? [], client.accountHistoryApprovals ?? [], tombstones),
    transactions: mergeRecords(server.transactions, client.transactions, tombstones),
    shifts: mergeRecords(server.shifts, client.shifts, tombstones),
    tombstones,
    syntheticFixture: mergeSyntheticFixture(server, client),
    commandReceipts: mergeCommandReceipts(server.commandReceipts, client.commandReceipts),
  };
}

export function mergePersonal(server: PersonalEnvelope, client: PersonalEnvelope): PersonalEnvelope {
  // Companion mutations belong exclusively to the serialized v2 authority.
  // Legacy reconciliation may preserve identical state, never choose by clock.
  if ((server.companionProfile || client.companionProfile) && JSON.stringify(server.companionProfile) !== JSON.stringify(client.companionProfile)) {
    throw new Error("COMPANION_REQUIRES_AUTHORITY_REFRESH");
  }
  const tombstones = mergeTombstones(server.tombstones, client.tombstones);
  const newer = laterEnvelope(server, client);
  const memberId = client.memberId || server.memberId;
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
  const serverLandingClock = isLandingSurface(server.landingSurface)
    ? server.landingSurfaceUpdatedAt || server.lastCommittedAt || ""
    : "";
  const clientLandingClock = isLandingSurface(client.landingSurface)
    ? client.landingSurfaceUpdatedAt || client.lastCommittedAt || ""
    : "";
  const serverLandingSurface = isLandingSurface(server.landingSurface) ? server.landingSurface : "";
  const clientLandingSurface = isLandingSurface(client.landingSurface) ? client.landingSurface : "";
  const landingSource = clientLandingClock > serverLandingClock
    ? client
    : serverLandingClock > clientLandingClock
      ? server
      : clientLandingSurface > serverLandingSurface
        ? client
        : server;
  const landingSurface = isLandingSurface(landingSource.landingSurface) ? landingSource.landingSurface : undefined;
  const serverFundRail = shapeMemberRail(server.fundRail, server.memberId);
  const clientFundRail = shapeMemberRail(client.fundRail, client.memberId);
  const fundRail = !serverFundRail ? clientFundRail
    : !clientFundRail ? serverFundRail
      : clientFundRail.updatedAt > serverFundRail.updatedAt ? clientFundRail
        : serverFundRail.updatedAt > clientFundRail.updatedAt ? serverFundRail
          : JSON.stringify(clientFundRail.slots) > JSON.stringify(serverFundRail.slots) ? clientFundRail : serverFundRail;
  const serverOnboarding = shapeMemberOnboardingProgress(server.onboardingProgress, { memberId });
  const clientOnboarding = shapeMemberOnboardingProgress(client.onboardingProgress, { memberId });
  const onboardingProgress = serverOnboarding && clientOnboarding
    ? mergeMemberProgress(serverOnboarding, clientOnboarding)
    : serverOnboarding ?? clientOnboarding;
  const serverGlanceAccountId = shapeGlanceAccountId(server.glanceAccountId);
  const clientGlanceAccountId = shapeGlanceAccountId(client.glanceAccountId);
  const serverGlanceClock = server.glanceAccountUpdatedAt || server.lastCommittedAt || "";
  const clientGlanceClock = client.glanceAccountUpdatedAt || client.lastCommittedAt || "";
  const glanceSource = !serverGlanceAccountId ? client
    : !clientGlanceAccountId ? server
      : clientGlanceClock > serverGlanceClock ? client
        : serverGlanceClock > clientGlanceClock ? server
          : clientGlanceAccountId > serverGlanceAccountId ? client : server;
  const glanceAccountId = shapeGlanceAccountId(glanceSource.glanceAccountId);
  const serverFundCardAccountId = shapeGlanceAccountId(server.fundCardAccountId);
  const clientFundCardAccountId = shapeGlanceAccountId(client.fundCardAccountId);
  const serverFundCardClock = server.fundCardAccountUpdatedAt || server.lastCommittedAt || "";
  const clientFundCardClock = client.fundCardAccountUpdatedAt || client.lastCommittedAt || "";
  const fundCardSource = !serverFundCardAccountId ? client
    : !clientFundCardAccountId ? server
      : clientFundCardClock > serverFundCardClock ? client
        : serverFundCardClock > clientFundCardClock ? server
          : clientFundCardAccountId > serverFundCardAccountId ? client : server;
  const fundCardAccountId = shapeGlanceAccountId(fundCardSource.fundCardAccountId);
  return {
    kind: "personal",
    ...(server.companionProfile ? { companionProfile: structuredClone(server.companionProfile) } : {}),
    memberId,
    ...(landingSurface
      ? {
          landingSurface,
          ...((landingSource.landingSurfaceUpdatedAt || landingSource.lastCommittedAt)
            ? { landingSurfaceUpdatedAt: landingSource.landingSurfaceUpdatedAt || landingSource.lastCommittedAt || undefined }
            : {}),
        }
      : {}),
    ...(fundRail ? { fundRail } : {}),
    ...(onboardingProgress ? { onboardingProgress } : {}),
    ...(glanceAccountId
      ? {
          glanceAccountId,
          ...((glanceSource.glanceAccountUpdatedAt || glanceSource.lastCommittedAt)
            ? { glanceAccountUpdatedAt: glanceSource.glanceAccountUpdatedAt || glanceSource.lastCommittedAt || undefined }
            : {}),
        }
      : {}),
    ...(fundCardAccountId
      ? {
          fundCardAccountId,
          ...((fundCardSource.fundCardAccountUpdatedAt || fundCardSource.lastCommittedAt)
            ? { fundCardAccountUpdatedAt: fundCardSource.fundCardAccountUpdatedAt || fundCardSource.lastCommittedAt || undefined }
            : {}),
        }
      : {}),
    lastCommittedAt: newer.lastCommittedAt,
    accountOpeningCheckpoints: mergeRecords(server.accountOpeningCheckpoints ?? [], client.accountOpeningCheckpoints ?? [], tombstones),
    accountHistoryReviews: mergeRecords(server.accountHistoryReviews ?? [], client.accountHistoryReviews ?? [], tombstones),
    accountHistoryApprovals: mergeRecords(server.accountHistoryApprovals ?? [], client.accountHistoryApprovals ?? [], tombstones),
    transactions: mergeRecords(server.transactions, client.transactions, tombstones),
    nativeEvents:mergeNativeEvents(server.nativeEvents,client.nativeEvents).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    tasks:mergeTasks(server.tasks,client.tasks).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    taskLists:mergeTaskLists(server.taskLists,client.taskLists).filter(r=>r.visibility==='personal'&&r.createdBy===memberId),
    potentialExpenses: mergePotentialExpenses(server.potentialExpenses, client.potentialExpenses, newer.lastCommittedAt ?? MISSING_ISO)
      .filter((row) => row.createdBy === memberId && row.visibility === "personal"),
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
    planDrafts: mergePlanRecords(shapePlanDrafts(server.planDrafts, memberId), shapePlanDrafts(client.planDrafts, memberId), (row) => row.updatedAt),
    planVersions: mergePlanRecords(shapePlanVersions(server.planVersions, { scope: "personal", ownerMemberId: memberId }), shapePlanVersions(client.planVersions, { scope: "personal", ownerMemberId: memberId }), (row) => `${String(row.sequence).padStart(8, "0")}|${row.createdAt}`),
    planScenarios: mergePlanRecords(shapePlanScenarios(server.planScenarios, memberId), shapePlanScenarios(client.planScenarios, memberId), (row) => row.updatedAt),
    planReflections: mergePlanRecords(shapePlanReflections(server.planReflections, { scope: "personal", ownerMemberId: memberId }), shapePlanReflections(client.planReflections, { scope: "personal", ownerMemberId: memberId }), (row) => row.updatedAt),
    planLearningProgress: mergePlanRecords(shapePlanLearningProgress(server.planLearningProgress, memberId), shapePlanLearningProgress(client.planLearningProgress, memberId), (row) => row.updatedAt),
    planCoachingPreferences: mergePlanRecords(shapePlanCoachingPreferences(server.planCoachingPreferences, memberId), shapePlanCoachingPreferences(client.planCoachingPreferences, memberId), (row) => row.updatedAt),
    planBridgeDrafts: mergePlanRecords(shapePlanBridgeDrafts(server.planBridgeDrafts, memberId), shapePlanBridgeDrafts(client.planBridgeDrafts, memberId), (row) => row.updatedAt),
    fundContributionSourceClaims: mergeRecords(server.fundContributionSourceClaims ?? [], client.fundContributionSourceClaims ?? [], tombstones),
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

function mergeCompanionGallery(server:SharedEnvelope,client:SharedEnvelope):Pick<SharedEnvelope,'companionGallery'>{
 if(JSON.stringify(server.companionGallery??[])!==JSON.stringify(client.companionGallery??[]))throw new Error('COMPANION_GALLERY_REQUIRES_AUTHORITY');
 return server.companionGallery!==undefined?{companionGallery:decodeCompanionGallery(server.companionGallery,server)}:{};
}
