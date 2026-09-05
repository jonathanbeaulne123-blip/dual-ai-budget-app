import {
  commandMaterializationFacts,
  financialAuditHash,
  financialAuditHashForScope,
  sha256Hex,
} from "../core/commandIdentity.ts";
import { rememberReceipt } from "../core/commandIdentity.ts";
import { shapeHouseholdCharter } from "../core/charter.ts";
import {
  actorMayApplyHouseholdOnboardingTransition,
  mergeHouseholdOnboarding,
  shapeHouseholdOnboarding,
  type HouseholdOnboarding,
} from "../core/onboarding/mode.ts";
import { ONBOARDING_REGISTRY_VERSION } from "../core/onboarding/registry.ts";
import {
  assertOnboardingSubmissionHistory,
  mergeSubmissions,
  shapeOnboardingSubmissions,
  type OnboardingSubmission,
} from "../core/onboarding/submissions.ts";
import { mergeMonthRehearsals, shapeMonthRehearsals } from "../core/monthRehearsal.ts";
import { advanceCadence } from "../core/recurrence.ts";
import { mergeWeeklyDocumentStamps, shapeWeeklyDocumentStamps } from "../core/weeklyDocumentStamp.ts";
import { ensureHouseholdShape, mergeTombstones } from "../core/sync.ts";
import type {
  Claim,
  CommandReceipt,
  GoalContribution,
  GoalPurchase,
  Household,
  HouseholdCharter,
  HouseholdFundConfig,
  HouseholdFundEvent,
  HouseholdFundKittyAllocation,
  HouseholdFundMonthPlan,
  HouseholdFundSettlementAllocation,
  MonthRehearsal,
  Recurrence,
  Shift,
  SitDownSession,
  Tombstone,
  Transaction,
  WeeklyDocumentStamp,
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
  recurrences?: Recurrence[];
  transactions?: Transaction[];
  shifts?: Shift[];
  claims?: Claim[];
  sitDownSessions?: SitDownSession[];
  goalContributions?: GoalContribution[];
  goalPurchases?: GoalPurchase[];
  householdOnboarding?: Household["householdOnboarding"];
  onboardingSubmissions?: OnboardingSubmission[];
  charter?: HouseholdCharter;
  householdFund?: HouseholdFundConfig;
  fundMonthPlans?: HouseholdFundMonthPlan[];
  fundEvents?: HouseholdFundEvent[];
  fundSettlementAllocations?: HouseholdFundSettlementAllocation[];
  fundKittyAllocations?: HouseholdFundKittyAllocation[];
  monthRehearsals?: MonthRehearsal[];
  weeklyDocumentStamps?: WeeklyDocumentStamp[];
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
    materializationHash?: string;
  }>;
};

type MoneyRow = { id: string };
const IMMUTABLE_ROW_DIVERGENCE = "immutable-row-divergence";

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
): T[] {
  if (!incoming?.length) return existing;
  const dead = new Set(tombstones.map((row) => row.id));
  const map = rowMapsTo(existing.filter((row) => !dead.has(row.id)));
  for (const row of incoming) {
    // Events reach this function in canonical hosted order. The later event is
    // therefore authoritative for a same-id row; distinct ids remain additive.
    map.set(row.id, row);
  }
  return [...map.values()];
}

function applyTransactions(
  existing: Transaction[],
  incoming: Transaction[] | undefined,
  tombstones: Tombstone[],
): Transaction[] {
  if (!incoming?.length) return existing;
  const reversedIds = new Set(
    [...existing, ...incoming]
      .map((row) => row.reversalOfId)
      .filter((id): id is string => Boolean(id)),
  );
  const protectedIncoming = incoming.filter((row) => {
    if (!reversedIds.has(row.id)) return true;
    const acceptedOriginal = existing.find((candidate) => candidate.id === row.id);
    if (acceptedOriginal && JSON.stringify(acceptedOriginal) !== JSON.stringify(row)) {
      throw new Error(IMMUTABLE_ROW_DIVERGENCE);
    }
    return true;
  });
  return applyMoneyCollection(existing, protectedIncoming, tombstones);
}

function applyAppendOnlyCollection<T extends MoneyRow>(
  existing: T[],
  incoming: T[] | undefined,
  tombstones: Tombstone[],
): T[] {
  if (!incoming?.length) return existing;
  const accepted = new Map(existing.map((row) => [row.id, row]));
  for (const row of incoming) {
    const acceptedRow = accepted.get(row.id);
    if (acceptedRow && JSON.stringify(acceptedRow) !== JSON.stringify(row)) {
      throw new Error(IMMUTABLE_ROW_DIVERGENCE);
    }
  }
  return applyMoneyCollection(
    existing,
    incoming,
    tombstones,
  );
}

function receiptFromPayload(payload: ContinuityCommandEventPayload): CommandReceipt {
  return {
    confirmationId: payload.confirmationId,
    identityHash: payload.identityHash,
    auditHash: payload.auditHash,
    materializationHash: payload.materializationHash,
    commandKind: payload.commandKind,
    postedIds: [...payload.postedIds],
    revision: payload.revision,
    acceptedAt: payload.acceptedAt,
  };
}

function eventDeclaresMonthRehearsalUpdate(event: ContinuityCommandEvent): boolean {
  if (event.payload_json.commandKind !== event.command_type) return false;
  return event.command_type === "updateMonthRehearsal"
    || event.payload_json.compactedCommands?.some(
      (row) => row.commandKind === "updateMonthRehearsal" && row.ledgerScope === "shared",
    ) === true;
}

function eventDeclaresAskGoalMove(event: ContinuityCommandEvent): boolean {
  if (event.payload_json.commandKind !== event.command_type) return false;
  return event.command_type === "moveAskGoalClaimToNextMonth"
    || event.payload_json.compactedCommands?.some(
      (row) => row.commandKind === "moveAskGoalClaimToNextMonth" && row.ledgerScope === "shared",
    ) === true;
}

function eventContainsOnboardingSubmissionCommand(event: ContinuityCommandEvent): boolean {
  const kinds = new Set(["submitOnboardingCategories", "submitOnboardingEstimates"]);
  return kinds.has(event.command_type)
    || event.payload_json.compactedCommands?.some(
      (row) => row.ledgerScope === "shared" && kinds.has(row.commandKind),
    ) === true;
}

function actorMayApplyOnboardingSubmissions(
  local: Household,
  event: ContinuityCommandEvent,
  incoming: OnboardingSubmission[],
): boolean {
  if (event.ledger_scope !== "shared") return false;
  if (!local.members.some((row) => row.active && row.id === event.member_id)) return false;
  if (event.payload_json.commandKind !== event.command_type) return false;
  const commands = event.payload_json.compactedCommands?.filter(
    (row) => row.ledgerScope === "shared"
      && (row.commandKind === "submitOnboardingCategories" || row.commandKind === "submitOnboardingEstimates"),
  ) ?? (event.command_type === "submitOnboardingCategories" || event.command_type === "submitOnboardingEstimates"
    ? [{
      confirmationId: event.confirmation_id,
      commandKind: event.command_type,
      postedIds: event.payload_json.postedIds,
      ledgerScope: "shared" as const,
      materializationHash: event.payload_json.materializationHash,
    }]
    : []);
  if (!commands.length) return false;
  try {
    const combined = mergeSubmissions(local.onboardingSubmissions, incoming);
    assertOnboardingSubmissionHistory(combined);
    const byId = new Map(combined.map((row) => [row.id, row]));
    const declared = new Set<string>();
    for (const command of commands) {
      const ids = [...new Set(command.postedIds)];
      const rows = ids.map((id) => byId.get(id));
      const kind = command.commandKind === "submitOnboardingCategories" ? "categories" : "estimates";
      if ((ids.length !== 1 && ids.length !== 2)
        || rows.some((row) => !row
          || row.householdId !== event.household_id
          || row.memberId !== event.member_id
          || row.kind !== kind)) return false;
      ids.forEach((id) => declared.add(id));
      const ordered = (rows as OnboardingSubmission[])
        .sort((left, right) => left.revision - right.revision || left.id.localeCompare(right.id));
      if (ordered.length === 1) {
        if (ordered[0]!.revision !== 1) return false;
      } else if (ordered[1]!.revision !== ordered[0]!.revision + 1
        || ordered[0]!.supersededBy !== ordered[1]!.id) return false;
    }
    if (!incoming.every((row) => declared.has(row.id))) return false;
    return true;
  } catch {
    return false;
  }
}

function actorMayApplyAskGoalRecurrences(
  local: Household,
  event: ContinuityCommandEvent,
  incoming: Recurrence[],
): boolean {
  if (event.ledger_scope !== "shared" || !eventDeclaresAskGoalMove(event)) return false;
  const actor = local.members.find((row) => row.id === event.member_id && row.active);
  if (!actor || local.householdFund?.custodianMemberId === actor.id) return false;
  const posted = new Set([
    ...event.payload_json.postedIds,
    ...(event.payload_json.compactedCommands ?? [])
      .filter((row) => row.commandKind === "moveAskGoalClaimToNextMonth" && row.ledgerScope === "shared")
      .flatMap((row) => row.postedIds),
  ]);
  for (const recurrence of incoming) {
    const existing = local.recurrences.find((row) => row.id === recurrence.id);
    const goal = local.goals.find((row) => row.id === recurrence.goalId);
    if (!posted.has(recurrence.id)
      || !existing
      || !goal?.shared
      || goal.status === "retired"
      || Boolean(goal.retiredAt)
      || !existing.active
      || existing.type !== "transfer"
      || existing.cadence !== "monthly"
      || existing.goalId !== goal.id
      || recurrence.nextDate !== advanceCadence(existing.nextDate, existing.cadence)) return false;
    const { nextDate: _existingDate, updatedAt: _existingUpdatedAt, ...existingMeaning } = existing;
    const { nextDate: _incomingDate, updatedAt: _incomingUpdatedAt, ...incomingMeaning } = recurrence;
    if (JSON.stringify(existingMeaning) !== JSON.stringify(incomingMeaning)) return false;
  }
  return true;
}

function actorMayApplyMonthRehearsals(
  local: Household,
  event: ContinuityCommandEvent,
  incoming: MonthRehearsal[],
): boolean {
  if (event.environment !== "development" || event.ledger_scope !== "shared") return false;
  if (!eventDeclaresMonthRehearsalUpdate(event)) return false;
  const memberIds = new Set(local.members.filter((row) => row.active).map((row) => row.id));
  const existingById = new Map((local.monthRehearsals ?? []).map((row) => [row.id, row]));
  for (const rehearsal of incoming) {
    const existing = existingById.get(rehearsal.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(rehearsal)) continue;
    if (existing) {
      if (existing.biancaParticipantId !== rehearsal.biancaParticipantId
        || existing.jonathanPartnerId !== rehearsal.jonathanPartnerId) return false;
      if (event.member_id !== existing.biancaParticipantId
        && event.member_id !== existing.jonathanPartnerId) return false;
      continue;
    }
    if (rehearsal.biancaParticipantId === rehearsal.jonathanPartnerId
      || !memberIds.has(rehearsal.biancaParticipantId)
      || !memberIds.has(rehearsal.jonathanPartnerId)
      || rehearsal.startedByMemberId !== event.member_id
      || (event.member_id !== rehearsal.biancaParticipantId
        && event.member_id !== rehearsal.jonathanPartnerId)) return false;
  }
  return true;
}

function actorMayApplyHouseholdOnboarding(
  local: Household,
  event: ContinuityCommandEvent,
  incoming: HouseholdOnboarding,
): boolean {
  if (event.ledger_scope !== "shared"
    || event.payload_json.commandKind !== event.command_type
    || !event.payload_json.postedIds.includes(incoming.id)
    || incoming.registryVersion !== ONBOARDING_REGISTRY_VERSION) return false;
  const commandKinds = [
    event.command_type,
    ...(event.payload_json.compactedCommands ?? [])
      .filter((row) => row.ledgerScope === "shared" && row.postedIds.includes(incoming.id))
      .map((row) => row.commandKind),
  ];
  return commandKinds.some((commandKind) => actorMayApplyHouseholdOnboardingTransition({
    household: local,
    incoming,
    commandKind,
    actingMemberId: event.member_id,
  }));
}

function stampCommands(event: ContinuityCommandEvent): Array<{
  postedIds: string[];
  materializationHash?: string;
}> {
  if (event.payload_json.commandKind !== event.command_type) return [];
  const compacted = event.payload_json.compactedCommands?.filter(
    (row) => row.commandKind === "stampWeeklyDocument" && row.ledgerScope === "shared",
  ) ?? [];
  if (compacted.length) return compacted;
  if (event.command_type !== "stampWeeklyDocument") return [];
  return [{
    postedIds: event.payload_json.postedIds,
    materializationHash: event.payload_json.materializationHash,
  }];
}

async function actorMayApplyWeeklyDocumentStamps(
  local: Household,
  event: ContinuityCommandEvent,
  incoming: WeeklyDocumentStamp[],
): Promise<boolean> {
  if (event.ledger_scope !== "shared") return false;
  const actor = local.members.find((member) => member.id === event.member_id);
  if (!actor || (!actor.active && event.created_at >= actor.updatedAt)) return false;
  const commands = stampCommands(event);
  if (!commands.length || incoming.some((stamp) => stamp.memberId !== event.member_id)) return false;
  const incomingIds = new Set(incoming.map((stamp) => stamp.id));
  const declaredIds = new Set(commands.flatMap((command) => command.postedIds));
  if ([...incomingIds].some((id) => !declaredIds.has(id))) return false;
  for (const command of commands) {
    const commandStamps = incoming.filter((stamp) => command.postedIds.includes(stamp.id));
    if (!commandStamps.length
      || !command.materializationHash
      || await sha256Hex(commandStamps) !== command.materializationHash) return false;
  }
  return true;
}

function alreadyApplied(snapshot: Household, event: ContinuityCommandEvent): boolean {
  return (snapshot.commandReceipts ?? []).some(
    (row) => row.confirmationId === event.confirmation_id && row.identityHash === event.identity_hash,
  );
}

function scopeAllowsRow(
  event: ContinuityCommandEvent,
  row: object,
): boolean {
  const record = row as { visibility?: string; createdBy?: string; memberId?: string };
  if (event.ledger_scope === "shared") {
    return record.visibility !== "personal";
  }
  if (record.visibility === "personal") {
    return record.createdBy === event.member_id;
  }
  if (record.memberId) {
    return record.memberId === event.member_id;
  }
  // Claims / sit-downs / similar rows lack visibility — postedIds already bound the set.
  return true;
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
  if (event.ledger_scope === "shared") {
    if (facts.recurrences?.length) scoped.recurrences = facts.recurrences;
    if (facts.householdOnboarding) scoped.householdOnboarding = facts.householdOnboarding;
    if (facts.onboardingSubmissions?.length) {
      scoped.onboardingSubmissions = shapeOnboardingSubmissions(facts.onboardingSubmissions)
        .filter((row) => row.householdId === event.household_id && row.memberId === event.member_id);
    }
    if (facts.charter) scoped.charter = facts.charter;
    if (facts.householdFund) scoped.householdFund = facts.householdFund;
    if (facts.fundMonthPlans?.length) scoped.fundMonthPlans = facts.fundMonthPlans;
    if (facts.fundEvents?.length) scoped.fundEvents = facts.fundEvents;
    if (facts.fundSettlementAllocations?.length) scoped.fundSettlementAllocations = facts.fundSettlementAllocations;
    if (facts.fundKittyAllocations?.length) scoped.fundKittyAllocations = facts.fundKittyAllocations;
    if (facts.monthRehearsals?.length) scoped.monthRehearsals = shapeMonthRehearsals(facts.monthRehearsals);
    if (facts.weeklyDocumentStamps?.length) {
      scoped.weeklyDocumentStamps = shapeWeeklyDocumentStamps(facts.weeklyDocumentStamps);
    }
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
  options?: {
    acceptedAt?: string;
    ledgerScope?: "shared" | "personal";
    memberId?: string;
    commandKind?: string;
  },
): ContinuityMaterializationFacts {
  const posted = new Set(postedIds.filter(Boolean));
  const scope = options?.ledgerScope;
  const memberId = options?.memberId;
  const allows = (row: object): boolean => {
    if (!scope) return true;
    const record = row as { visibility?: string; createdBy?: string; memberId?: string };
    if (scope === "shared") return record.visibility !== "personal";
    if (record.visibility === "personal") {
      return !memberId || record.createdBy === memberId;
    }
    if (record.memberId) return record.memberId === memberId;
    return false;
  };
  const facts: ContinuityMaterializationFacts = {};
  if (scope !== "personal" && options?.commandKind === "moveAskGoalClaimToNextMonth") {
    const recurrences = household.recurrences.filter((row) => posted.has(row.id));
    if (recurrences.length) facts.recurrences = recurrences;
  }
  const transactions = household.transactions.filter((row) => posted.has(row.id) && allows(row));
  if (transactions.length) facts.transactions = transactions;
  const shifts = household.shifts.filter((row) => posted.has(row.id) && allows(row));
  if (shifts.length) facts.shifts = shifts;
  const claims = (household.claims ?? []).filter((row) => posted.has(row.id) && allows(row));
  if (claims.length) facts.claims = claims;
  const sitDownSessions = (household.sitDownSessions ?? []).filter((row) => posted.has(row.id) && allows(row));
  if (sitDownSessions.length) facts.sitDownSessions = sitDownSessions;
  const goalContributions = (household.goalContributions ?? []).filter((row) => posted.has(row.id) && allows(row));
  if (goalContributions.length) facts.goalContributions = goalContributions;
  const goalPurchases = (household.goalPurchases ?? []).filter((row) => posted.has(row.id) && allows(row));
  if (goalPurchases.length) facts.goalPurchases = goalPurchases;
  if (scope !== "personal") {
    if (household.householdOnboarding && posted.has(household.householdOnboarding.id)) {
      facts.householdOnboarding = household.householdOnboarding;
    }
    const onboardingSubmissions = shapeOnboardingSubmissions(
      household.onboardingSubmissions,
      household.householdId,
    )
      .filter((row) => posted.has(row.id) && (!memberId || row.memberId === memberId))
      .map((row) => row.supersededBy && !posted.has(row.supersededBy)
        ? { ...row, supersededBy: null }
        : row);
    if (onboardingSubmissions.length) facts.onboardingSubmissions = onboardingSubmissions;
    if (household.charter && postedIds.some((id) => id.startsWith("CHARTER-"))) {
      facts.charter = household.charter;
    }
    if (household.householdFund && posted.has(household.householdFund.id)) facts.householdFund = household.householdFund;
    const fundMonthPlans = (household.fundMonthPlans ?? []).filter((row) => posted.has(row.id));
    if (fundMonthPlans.length) facts.fundMonthPlans = fundMonthPlans;
    const fundEvents = (household.fundEvents ?? []).filter((row) => posted.has(row.id));
    if (fundEvents.length) facts.fundEvents = fundEvents;
    const fundSettlementAllocations = (household.fundSettlementAllocations ?? []).filter((row) => posted.has(row.id));
    if (fundSettlementAllocations.length) facts.fundSettlementAllocations = fundSettlementAllocations;
    const fundKittyAllocations = (household.fundKittyAllocations ?? []).filter((row) => posted.has(row.id));
    if (fundKittyAllocations.length) facts.fundKittyAllocations = fundKittyAllocations;
    if (options?.commandKind === "updateMonthRehearsal") {
      facts.monthRehearsals = shapeMonthRehearsals(household.monthRehearsals);
    }
    const weeklyDocumentStamps = shapeWeeklyDocumentStamps(
      household.weeklyDocumentStamps,
      household.members,
    ).filter((row) => posted.has(row.id));
    if (weeklyDocumentStamps.length) facts.weeklyDocumentStamps = weeklyDocumentStamps;
  }
  let tombstones = (household.tombstones ?? []).filter((row) => posted.has(row.id));
  if (!tombstones.length && !posted.size) {
    const marker = household.lastCommittedAt ?? options?.acceptedAt ?? null;
    if (marker) {
      tombstones = (household.tombstones ?? []).filter((row) => row.deletedAt === marker);
    }
  }
  if (scope === "shared") {
    const personalIds = new Set([
      ...household.transactions.filter((row) => row.visibility === "personal").map((row) => row.id),
      ...household.shifts.filter((row) => row.visibility === "personal").map((row) => row.id),
    ]);
    tombstones = tombstones.filter((row) => !personalIds.has(row.id));
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

  // Reversals are immutable audit facts. Once one has been accepted, a delayed
  // same-id edit cannot rewrite the original amount that the reversal cancels.
  const transactions = applyTransactions(snapshot.transactions, facts.transactions, mergedTombstones);
  const shifts = applyMoneyCollection(snapshot.shifts, facts.shifts, mergedTombstones);
  const claims = applyMoneyCollection(snapshot.claims ?? [], facts.claims, mergedTombstones);
  const sitDownSessions = applyMoneyCollection(snapshot.sitDownSessions ?? [], facts.sitDownSessions, mergedTombstones);
  const goalContributions = applyAppendOnlyCollection(snapshot.goalContributions ?? [], facts.goalContributions, mergedTombstones);
  const goalPurchases = applyAppendOnlyCollection(snapshot.goalPurchases ?? [], facts.goalPurchases, mergedTombstones);
  const recurrences = applyMoneyCollection(snapshot.recurrences, facts.recurrences, mergedTombstones);
  const fundEvents = applyAppendOnlyCollection(snapshot.fundEvents ?? [], facts.fundEvents, mergedTombstones);
  const fundSettlementAllocations = applyAppendOnlyCollection(snapshot.fundSettlementAllocations ?? [], facts.fundSettlementAllocations, mergedTombstones);
  const fundKittyAllocations = applyAppendOnlyCollection(snapshot.fundKittyAllocations ?? [], facts.fundKittyAllocations, mergedTombstones);
  const weeklyDocumentStamps = applyAppendOnlyCollection(
    shapeWeeklyDocumentStamps(snapshot.weeklyDocumentStamps, snapshot.members),
    shapeWeeklyDocumentStamps(facts.weeklyDocumentStamps),
    mergedTombstones,
  );
  const planMap = rowMapsTo(snapshot.fundMonthPlans ?? []);
  for (const plan of facts.fundMonthPlans ?? []) planMap.set(plan.id, plan);
  const householdFund = facts.householdFund ?? snapshot.householdFund;
  const householdOnboarding = mergeHouseholdOnboarding(snapshot.householdOnboarding, facts.householdOnboarding, {
    householdId: snapshot.householdId,
    environment: snapshot.environment,
    members: snapshot.members,
  });
  const onboardingSubmissions = mergeSubmissions(snapshot.onboardingSubmissions, facts.onboardingSubmissions)
    .filter((row) => row.householdId === snapshot.householdId);
  const charter = facts.charter
    ? shapeHouseholdCharter(facts.charter, { members: snapshot.members, householdFund })
    : snapshot.charter;

  let next: Household = {
    ...snapshot,
    revision: event.result_revision,
    baseRevision: Math.max(snapshot.baseRevision ?? 0, event.base_revision),
    lastCommittedAt: payload.acceptedAt || snapshot.lastCommittedAt,
    transactions: transactions.filter((row) => !dead.has(row.id)),
    shifts: shifts.filter((row) => !dead.has(row.id)),
    claims: claims.filter((row) => !dead.has(row.id)),
    sitDownSessions: sitDownSessions.filter((row) => !dead.has(row.id)),
    goalContributions: goalContributions.filter((row) => !dead.has(row.id)),
    goalPurchases: goalPurchases.filter((row) => !dead.has(row.id)),
    recurrences: recurrences.filter((row) => !dead.has(row.id)),
    householdOnboarding,
    onboardingSubmissions,
    charter,
    householdFund,
    fundMonthPlans: [...planMap.values()],
    fundEvents: fundEvents.filter((row) => !dead.has(row.id)),
    fundSettlementAllocations: fundSettlementAllocations.filter((row) => !dead.has(row.id)),
    fundKittyAllocations: fundKittyAllocations.filter((row) => !dead.has(row.id)),
    monthRehearsals: mergeMonthRehearsals(
      shapeMonthRehearsals(snapshot.monthRehearsals),
      shapeMonthRehearsals(facts.monthRehearsals),
    ),
    weeklyDocumentStamps: mergeWeeklyDocumentStamps(
      snapshot.weeklyDocumentStamps,
      weeklyDocumentStamps,
      snapshot.members,
    ),
    tombstones: mergedTombstones,
  };
  next = rememberReceipt(next, receiptFromPayload(payload));
  next.booksAcceptedHash = await financialAuditHash(next);
  return next;
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
    householdOnboarding: null,
    onboardingSubmissions: [],
    charter: null,
    householdFund: null,
    fundMonthPlans: [],
    fundEvents: [],
    fundSettlementAllocations: [],
    fundKittyAllocations: [],
    weeklyDocumentStamps: [],
    tombstones: [],
    commandReceipts: [],
    conflicts: [],
    booksAcceptedHash: null,
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

export type ApplyCommandEventResult =
  | { ok: true; household: Household; duplicate: boolean }
  | { ok: false; reason: string; fallback: boolean };

/** True when this member may observe the hosted command event over Realtime. */
export function commandEventVisibleToMember(event: ContinuityCommandEvent, memberId: string): boolean {
  if (event.ledger_scope === "shared") return true;
  return event.member_id === memberId;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

/** Parse a Realtime postgres_changes `new` row into a hosted command event. */
export function parseContinuityCommandEventRow(row: unknown): ContinuityCommandEvent | null {
  if (!row || typeof row !== "object") return null;
  const input = row as Record<string, unknown>;
  const environment = input.environment;
  const householdId = asString(input.household_id);
  const memberId = asString(input.member_id);
  const idempotencyKey = asString(input.idempotency_key);
  const commandType = asString(input.command_type);
  const ledgerScope = input.ledger_scope;
  const baseRevision = asNumber(input.base_revision);
  const resultRevision = asNumber(input.result_revision);
  const payloadJson = input.payload_json;
  if (
    (environment !== "development" && environment !== "production")
    || !householdId
    || !memberId
    || !idempotencyKey
    || !commandType
    || (ledgerScope !== "shared" && ledgerScope !== "personal")
    || !Number.isFinite(baseRevision)
    || !Number.isFinite(resultRevision)
    || !payloadJson
    || typeof payloadJson !== "object"
  ) {
    return null;
  }
  return {
    id: asString(input.id) || idempotencyKey,
    environment,
    household_id: householdId,
    member_id: memberId,
    idempotency_key: idempotencyKey,
    confirmation_id: asString(input.confirmation_id),
    identity_hash: asString(input.identity_hash),
    base_revision: baseRevision,
    result_revision: resultRevision,
    ledger_scope: ledgerScope,
    command_type: commandType,
    payload_json: payloadJson as ContinuityCommandEventPayload,
    created_at: asString(input.created_at) || new Date(0).toISOString(),
  };
}

/** Apply one hosted command event onto the current local books (no full snapshot pull). */
export async function applyCommandEventLocally(input: {
  local: Household;
  event: ContinuityCommandEvent;
  memberId: string;
}): Promise<ApplyCommandEventResult> {
  const local = ensureHouseholdShape(input.local);
  const { event } = input;
  if (event.household_id !== local.householdId) {
    return { ok: false, reason: "household-mismatch", fallback: true };
  }
  if (event.environment !== local.environment) {
    return { ok: false, reason: "environment-mismatch", fallback: true };
  }
  if (!commandEventVisibleToMember(event, input.memberId)) {
    return { ok: false, reason: "personal-scope-hidden", fallback: false };
  }
  if (alreadyApplied(local, event)) {
    return { ok: true, household: local, duplicate: true };
  }
  if (event.result_revision <= local.revision) {
    return { ok: true, household: local, duplicate: true };
  }
  if (event.base_revision !== local.revision) {
    return { ok: false, reason: "revision-gap", fallback: true };
  }
  if (!event.payload_json.materializationFacts) {
    return { ok: false, reason: "missing-materialization-facts", fallback: true };
  }
  const incomingRehearsals = shapeMonthRehearsals(
    event.payload_json.materializationFacts.monthRehearsals,
  );
  const incomingRecurrences = event.payload_json.materializationFacts.recurrences ?? [];
  const rawIncomingOnboarding = event.payload_json.materializationFacts.householdOnboarding;
  const incomingOnboarding = shapeHouseholdOnboarding(rawIncomingOnboarding);
  const rawIncomingSubmissions = event.payload_json.materializationFacts.onboardingSubmissions;
  let incomingSubmissions: OnboardingSubmission[];
  try {
    incomingSubmissions = shapeOnboardingSubmissions(rawIncomingSubmissions);
  } catch {
    return { ok: false, reason: "onboarding-submission-invalid", fallback: true };
  }
  if (rawIncomingOnboarding && !incomingOnboarding) {
    return { ok: false, reason: "onboarding-mode-invalid", fallback: true };
  }
  if (rawIncomingSubmissions && (!Array.isArray(rawIncomingSubmissions)
    || incomingSubmissions.length !== rawIncomingSubmissions.length)) {
    return { ok: false, reason: "onboarding-submission-invalid", fallback: true };
  }
  if (eventContainsOnboardingSubmissionCommand(event) && incomingSubmissions.length === 0) {
    return { ok: false, reason: "onboarding-submission-missing", fallback: true };
  }
  if (incomingRehearsals.length) {
    if (!actorMayApplyMonthRehearsals(local, event, incomingRehearsals)) {
      return { ok: false, reason: "month-rehearsal-authority-mismatch", fallback: true };
    }
  }
  if (incomingRecurrences.length
    && !actorMayApplyAskGoalRecurrences(local, event, incomingRecurrences)) {
    return { ok: false, reason: "ask-goal-move-authority-mismatch", fallback: true };
  }
  if (incomingSubmissions.length
    && !actorMayApplyOnboardingSubmissions(local, event, incomingSubmissions)) {
    return { ok: false, reason: "onboarding-submission-authority-mismatch", fallback: true };
  }
  if (incomingRehearsals.length || incomingRecurrences.length || incomingOnboarding || incomingSubmissions.length) {
    const expected = await sha256Hex(commandMaterializationFacts({
      monthRehearsals: incomingRehearsals,
      recurrences: incomingRecurrences,
      householdOnboarding: incomingOnboarding,
      onboardingSubmissions: incomingSubmissions,
    }));
    const legacyRehearsalHash = incomingRehearsals.length && !incomingRecurrences.length
      ? await sha256Hex(incomingRehearsals)
      : null;
    if (!event.payload_json.materializationHash
      || (event.payload_json.materializationHash !== expected
        && event.payload_json.materializationHash !== legacyRehearsalHash)) {
      return { ok: false, reason: "materialization-hash-mismatch", fallback: true };
    }
  }
  if (incomingOnboarding && !actorMayApplyHouseholdOnboarding(local, event, incomingOnboarding)) {
    return { ok: false, reason: "onboarding-mode-authority-mismatch", fallback: true };
  }
  const rawIncomingStamps = event.payload_json.materializationFacts.weeklyDocumentStamps ?? [];
  const incomingStamps = shapeWeeklyDocumentStamps(rawIncomingStamps);
  if (rawIncomingStamps.length !== incomingStamps.length) {
    return { ok: false, reason: "weekly-stamp-invalid", fallback: true };
  }
  if (incomingStamps.length && !await actorMayApplyWeeklyDocumentStamps(local, event, incomingStamps)) {
    return { ok: false, reason: "weekly-stamp-authority-or-hash-mismatch", fallback: true };
  }

  let candidate: Household;
  try {
    candidate = await buildSnapshotFromEvents([event], local);
  } catch (error) {
    if (error instanceof Error && error.message === IMMUTABLE_ROW_DIVERGENCE) {
      return { ok: false, reason: IMMUTABLE_ROW_DIVERGENCE, fallback: true };
    }
    throw error;
  }
  const auditHash = event.payload_json.auditHash;
  if (auditHash) {
    const recomputed = await financialAuditHashForScope(candidate, event.ledger_scope, event.member_id);
    if (recomputed !== auditHash) {
      return { ok: false, reason: "audit-hash-mismatch", fallback: true };
    }
  }
  return { ok: true, household: candidate, duplicate: false };
}

/** Compare websocket payload sizes for handoff evidence (command event vs snapshot row). */
export function compareContinuityPayloadBytes(input: {
  commandEvent: ContinuityCommandEvent;
  snapshotRow: { payload: unknown; revision?: number; snapshot_hash?: string };
}): { commandEventBytes: number; snapshotRowBytes: number; ratio: number } {
  const commandEventBytes = Buffer.byteLength(JSON.stringify(input.commandEvent));
  const snapshotRowBytes = Buffer.byteLength(JSON.stringify(input.snapshotRow));
  return {
    commandEventBytes,
    snapshotRowBytes,
    ratio: snapshotRowBytes > 0 ? commandEventBytes / snapshotRowBytes : 0,
  };
}
