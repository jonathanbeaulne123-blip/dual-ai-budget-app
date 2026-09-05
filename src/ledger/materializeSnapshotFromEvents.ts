import {
  commandIdentityHash,
  commandMaterializationFacts,
  commandReceiptEnvelopeHash,
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
import { assertOnboardingEstimateSubmissionScope } from "../core/onboarding/estimates.ts";
import {
  assertOnboardingCategoryCollections,
  assertOnboardingCategoryMergeTransition,
  mergeOnboardingCategoryMerges,
  mergeOnboardingCategoryProposals,
  shapeOnboardingCategoryMerges,
  shapeOnboardingCategoryProposals,
  type OnboardingCategoryMerge,
  type OnboardingCategoryProposal,
} from "../core/onboarding/categories.ts";
import {
  mergeOnboardingApprovals,
  shapeOnboardingApprovals,
  type OnboardingApproval,
  type OnboardingApprovalScope,
} from "../core/onboarding/approvals.ts";
import {
  assertOnboardingAdoptionPlans,
  ONBOARDING_ADOPTION_COMMAND_KIND,
} from "../core/onboarding/adoption.ts";
import { mergeMonthRehearsals, shapeMonthRehearsals } from "../core/monthRehearsal.ts";
import { advanceCadence } from "../core/recurrence.ts";
import { dateKeyInZone, parseMonthKey, type DateKey } from "../core/calendar.ts";
import { mergeWeeklyDocumentStamps, shapeWeeklyDocumentStamps } from "../core/weeklyDocumentStamp.ts";
import { ensureHouseholdShape, mergeTombstones } from "../core/sync.ts";
import type {
  Claim,
  BudgetPlan,
  Category,
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
  onboardingCategoryProposals?: OnboardingCategoryProposal[];
  onboardingCategoryMerges?: OnboardingCategoryMerge[];
  onboardingApprovals?: OnboardingApproval[];
  categories?: Category[];
  budgetPlans?: BudgetPlan[];
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
    auditHash?: string;
    identityHash?: string;
    revision?: number;
    acceptedAt?: string;
    receiptHash?: string;
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

function readableCompactedCommands(
  event: ContinuityCommandEvent,
): NonNullable<ContinuityCommandEventPayload["compactedCommands"]> {
  const value: unknown = event.payload_json.compactedCommands;
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is NonNullable<ContinuityCommandEventPayload["compactedCommands"]>[number] => (
    Boolean(row) && typeof row === "object" && !Array.isArray(row)
  ));
}

function shapeOnboardingAdoptionPlans(value: unknown): BudgetPlan[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const expectedKeys = [
    "active", "amountCents", "createdAt", "essential", "id", "incomeStability", "monthKey", "subcategoryId", "updatedAt",
  ];
  const plans: BudgetPlan[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const row = candidate as Partial<BudgetPlan>;
    if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(expectedKeys)
      || typeof row.id !== "string" || !row.id || row.id.trim() !== row.id
      || typeof row.subcategoryId !== "string" || !row.subcategoryId || row.subcategoryId.trim() !== row.subcategoryId
      || !Number.isSafeInteger(row.amountCents) || row.amountCents! < 0
      || typeof row.essential !== "boolean"
      || (row.incomeStability !== null && row.incomeStability !== "fixed" && row.incomeStability !== "variable")
      || typeof row.active !== "boolean"
      || typeof row.createdAt !== "string" || Number.isNaN(Date.parse(row.createdAt))
      || new Date(row.createdAt).toISOString() !== row.createdAt
      || typeof row.updatedAt !== "string" || Number.isNaN(Date.parse(row.updatedAt))
      || new Date(row.updatedAt).toISOString() !== row.updatedAt) return null;
    try {
      parseMonthKey(row.monthKey!);
    } catch {
      return null;
    }
    plans.push(row as BudgetPlan);
  }
  if (new Set(plans.map((row) => row.id)).size !== plans.length) return null;
  return plans;
}

function validCommandEnvelope(event: ContinuityCommandEvent): boolean {
  const postedIds: unknown = event.payload_json.postedIds;
  if (!Array.isArray(postedIds)
    || postedIds.some((id) => typeof id !== "string" || !id || id.trim() !== id)
    || new Set(postedIds).size !== postedIds.length) return false;
  const commands: unknown = event.payload_json.compactedCommands;
  const confirmations: unknown = event.payload_json.compactedConfirmationIds;
  if (commands === undefined && confirmations === undefined) return true;
  if (!Array.isArray(commands) || !Array.isArray(confirmations)) return false;
  const allowedDescriptorKeys = new Set([
    "acceptedAt", "auditHash", "confirmationId", "commandKind", "identityHash", "ledgerScope", "materializationHash", "postedIds", "receiptHash", "revision",
  ]);
  const validDescriptors = commands.every((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const row = candidate as Record<string, unknown>;
    return Object.keys(row).every((key) => allowedDescriptorKeys.has(key))
      && typeof row.confirmationId === "string"
      && typeof row.commandKind === "string"
      && (row.ledgerScope === "shared" || row.ledgerScope === "personal")
      && Array.isArray(row.postedIds)
      && row.postedIds.every((id) => typeof id === "string" && Boolean(id) && id.trim() === id)
      && (row.materializationHash === undefined || typeof row.materializationHash === "string")
      && (row.auditHash === undefined || typeof row.auditHash === "string")
      && (row.identityHash === undefined || typeof row.identityHash === "string")
      && (row.revision === undefined || Number.isSafeInteger(row.revision))
      && (row.acceptedAt === undefined || typeof row.acceptedAt === "string")
      && (row.receiptHash === undefined || typeof row.receiptHash === "string");
  }) && confirmations.every(
    (id) => typeof id === "string" && Boolean(id) && id.trim() === id,
  );
  return validDescriptors;
}

function eventDeclaresMonthRehearsalUpdate(event: ContinuityCommandEvent): boolean {
  if (event.payload_json.commandKind !== event.command_type) return false;
  return event.command_type === "updateMonthRehearsal"
    || readableCompactedCommands(event).some(
      (row) => row.commandKind === "updateMonthRehearsal" && row.ledgerScope === "shared",
    );
}

function eventDeclaresAskGoalMove(event: ContinuityCommandEvent): boolean {
  if (event.payload_json.commandKind !== event.command_type) return false;
  return event.command_type === "moveAskGoalClaimToNextMonth"
    || readableCompactedCommands(event).some(
      (row) => row.commandKind === "moveAskGoalClaimToNextMonth" && row.ledgerScope === "shared",
    );
}

function eventContainsOnboardingSubmissionCommand(event: ContinuityCommandEvent): boolean {
  const kinds = new Set(["submitOnboardingCategories", "submitOnboardingEstimates"]);
  return kinds.has(event.command_type)
    || readableCompactedCommands(event).some(
      (row) => row.ledgerScope === "shared" && kinds.has(row.commandKind),
    );
}

function eventContainsOnboardingCategoryMerge(event: ContinuityCommandEvent): boolean {
  return event.command_type === "mergeOnboardingCategories"
    || readableCompactedCommands(event).some(
      (row) => row.ledgerScope === "shared" && row.commandKind === "mergeOnboardingCategories",
    );
}

function onboardingApprovalScope(commandKind: string): OnboardingApprovalScope | null {
  return commandKind === "approveOnboardingProposal"
    ? "proposal"
    : commandKind === "approveOnboardingReady"
      ? "ready"
      : null;
}

function eventContainsOnboardingApproval(event: ContinuityCommandEvent): boolean {
  return onboardingApprovalScope(event.command_type) !== null
    || readableCompactedCommands(event).some(
      (row) => Boolean(row)
        && typeof row === "object"
        && row.ledgerScope === "shared"
        && onboardingApprovalScope(row.commandKind) !== null,
    );
}

function onboardingAdoptionCommands(
  event: ContinuityCommandEvent,
): NonNullable<ContinuityCommandEventPayload["compactedCommands"]> | null {
  const readable = readableCompactedCommands(event);
  const compacted = readable.filter(
    (row) => row.ledgerScope === "shared" && row.commandKind === ONBOARDING_ADOPTION_COMMAND_KIND,
  );
  if (event.payload_json.compactedCommands !== undefined) {
    const confirmations = event.payload_json.compactedConfirmationIds;
    const descriptorIds = readable.map((row) => row.confirmationId);
    const aggregateIds = new Set(event.payload_json.postedIds);
    if (!Array.isArray(confirmations)
      || descriptorIds.length !== confirmations.length
      || new Set(descriptorIds).size !== descriptorIds.length
      || new Set(confirmations).size !== confirmations.length
      || descriptorIds.some((id) => !confirmations.includes(id))
      || !readable.some((row) => (
        row.confirmationId === event.confirmation_id
        && row.commandKind === event.command_type
        && row.ledgerScope === event.ledger_scope
      ))
      || compacted.some((row) => (
        new Set(row.postedIds).size !== row.postedIds.length
        || row.postedIds.some((id) => !aggregateIds.has(id))
        || typeof row.auditHash !== "string"
        || !/^[a-f0-9]{64}$/.test(row.auditHash)
        || typeof row.identityHash !== "string"
        || !row.identityHash
        || !Number.isSafeInteger(row.revision)
        || row.revision! < 1
        || typeof row.acceptedAt !== "string"
        || Number.isNaN(Date.parse(row.acceptedAt))
        || typeof row.receiptHash !== "string"
        || !/^[a-f0-9]{64}$/.test(row.receiptHash)
      ))) return null;
    return compacted;
  }
  return event.command_type === ONBOARDING_ADOPTION_COMMAND_KIND
    ? [{
        confirmationId: event.confirmation_id,
        commandKind: event.command_type,
        postedIds: event.payload_json.postedIds,
        ledgerScope: event.ledger_scope,
        materializationHash: event.payload_json.materializationHash,
        auditHash: event.payload_json.auditHash,
        identityHash: event.payload_json.identityHash,
        revision: event.payload_json.revision,
        acceptedAt: event.payload_json.acceptedAt,
      }]
    : [];
}

async function actorMayApplyOnboardingApprovals(
  local: Household,
  event: ContinuityCommandEvent,
  incoming: OnboardingApproval[],
): Promise<boolean> {
  if (event.ledger_scope !== "shared") return false;
  if (!local.members.some((row) => row.active && row.id === event.member_id)) return false;
  if (event.payload_json.commandKind !== event.command_type
    || event.payload_json.confirmationId !== event.confirmation_id
    || event.payload_json.identityHash !== event.identity_hash
    || event.payload_json.revision !== event.result_revision) return false;
  const rawCompactedCommands: unknown = event.payload_json.compactedCommands;
  const rawConfirmations: unknown = event.payload_json.compactedConfirmationIds;
  if (rawCompactedCommands !== undefined) {
    if (!Array.isArray(rawCompactedCommands) || !Array.isArray(rawConfirmations)) return false;
    const allowedDescriptorKeys = new Set([
      "acceptedAt", "auditHash", "confirmationId", "commandKind", "identityHash", "ledgerScope", "materializationHash", "postedIds", "receiptHash", "revision",
    ]);
    if (rawCompactedCommands.some((candidate) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return true;
      const row = candidate as Record<string, unknown>;
      return Object.keys(row).some((key) => !allowedDescriptorKeys.has(key))
        || typeof row.confirmationId !== "string"
        || typeof row.commandKind !== "string"
        || (row.ledgerScope !== "shared" && row.ledgerScope !== "personal")
        || !Array.isArray(row.postedIds)
        || row.postedIds.some((id) => typeof id !== "string" || !id || id.trim() !== id)
        || (row.materializationHash !== undefined && typeof row.materializationHash !== "string")
        || (row.auditHash !== undefined && typeof row.auditHash !== "string")
        || (row.identityHash !== undefined && typeof row.identityHash !== "string")
        || (row.revision !== undefined && !Number.isSafeInteger(row.revision))
        || (row.acceptedAt !== undefined && typeof row.acceptedAt !== "string")
        || (row.receiptHash !== undefined && typeof row.receiptHash !== "string");
    })) return false;
    const compactedCommands = rawCompactedCommands as NonNullable<ContinuityCommandEventPayload["compactedCommands"]>;
    const confirmations = rawConfirmations as string[];
    const descriptorIds = compactedCommands.map((row) => row.confirmationId);
    if (descriptorIds.some((id) => !id || id.trim() !== id)
      || confirmations.some((id) => typeof id !== "string" || !id || id.trim() !== id)
      || new Set(descriptorIds).size !== descriptorIds.length
      || new Set(confirmations).size !== confirmations.length
      || descriptorIds.length !== confirmations.length
      || descriptorIds.some((id) => !confirmations.includes(id))
      || !compactedCommands.some((row) => (
        row.confirmationId === event.confirmation_id
        && row.commandKind === event.command_type
        && row.ledgerScope === event.ledger_scope
      ))) return false;
  } else if (rawConfirmations !== undefined) {
    return false;
  }
  const compactedCommands = rawCompactedCommands as ContinuityCommandEventPayload["compactedCommands"];
  const commands = compactedCommands?.filter(
    (row) => row.ledgerScope === "shared" && onboardingApprovalScope(row.commandKind) !== null,
  ) ?? (onboardingApprovalScope(event.command_type)
    ? [{
        confirmationId: event.confirmation_id,
        commandKind: event.command_type,
        postedIds: event.payload_json.postedIds,
        ledgerScope: "shared" as const,
        materializationHash: event.payload_json.materializationHash,
      }]
    : []);
  if (!commands.length) return false;
  const byId = new Map(incoming.map((row) => [row.id, row]));
  const localIds = new Set(shapeOnboardingApprovals(
    local.onboardingApprovals,
    local.householdId,
  ).map((row) => row.id));
  if (incoming.some((row) => localIds.has(row.id))) return false;
  const declared = new Set<string>();
  for (const command of commands) {
    const scope = onboardingApprovalScope(command.commandKind);
    const ids = [...new Set(command.postedIds)];
    if (!scope || command.postedIds.length !== 1 || ids.length !== 1) return false;
    const row = byId.get(ids[0]!);
    if (!row
      || row.householdId !== event.household_id
      || row.memberId !== event.member_id
      || row.scope !== scope
      || declared.has(row.id)
      || !command.materializationHash
      || await sha256Hex(commandMaterializationFacts({ onboardingApprovals: [row] }))
        !== command.materializationHash) return false;
    declared.add(row.id);
  }
  const aggregatePostedIds = new Set(event.payload_json.postedIds);
  return incoming.length === declared.size
    && incoming.every((row) => declared.has(row.id) && aggregatePostedIds.has(row.id));
}

function actorMayApplyOnboardingSubmissions(
  local: Household,
  event: ContinuityCommandEvent,
  incoming: OnboardingSubmission[],
  incomingProposals: OnboardingCategoryProposal[],
): boolean {
  if (event.ledger_scope !== "shared") return false;
  if (!local.members.some((row) => row.active && row.id === event.member_id)) return false;
  if (event.payload_json.commandKind !== event.command_type) return false;
  const hasCompactedCommands = event.payload_json.compactedCommands !== undefined;
  const commands = hasCompactedCommands
    ? readableCompactedCommands(event).filter(
      (row) => row.ledgerScope === "shared"
        && (row.commandKind === "submitOnboardingCategories" || row.commandKind === "submitOnboardingEstimates"),
    )
    : (event.command_type === "submitOnboardingCategories" || event.command_type === "submitOnboardingEstimates"
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
    const proposalById = new Map(incomingProposals.map((row) => [row.id, row]));
    const declared = new Set<string>();
    for (const command of commands) {
      const ids = [...new Set(command.postedIds)];
      const submissionIds = ids.filter((id) => byId.has(id));
      const proposalIds = ids.filter((id) => proposalById.has(id));
      if (submissionIds.length + proposalIds.length !== ids.length) return false;
      const rows = submissionIds.map((id) => byId.get(id));
      const kind = command.commandKind === "submitOnboardingCategories" ? "categories" : "estimates";
      if ((submissionIds.length !== 1 && submissionIds.length !== 2)
        || rows.some((row) => !row
          || row.householdId !== event.household_id
          || row.memberId !== event.member_id
          || row.kind !== kind)) return false;
      if (proposalIds.some((id) => {
        const proposal = proposalById.get(id)!;
        return kind !== "categories"
          || proposal.householdId !== event.household_id
          || proposal.memberId !== event.member_id
          || !submissionIds.includes(proposal.submissionId);
      })) return false;
      submissionIds.forEach((id) => declared.add(id));
      const ordered = (rows as OnboardingSubmission[])
        .sort((left, right) => left.revision - right.revision || left.id.localeCompare(right.id));
      if (ordered.length === 1) {
        if (ordered[0]!.revision !== 1) return false;
      } else if (ordered[1]!.revision !== ordered[0]!.revision + 1
        || ordered[0]!.supersededBy !== ordered[1]!.id) return false;
      if (kind === "estimates") {
        assertOnboardingEstimateSubmissionScope(local, ordered.at(-1)!);
      }
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
    ...readableCompactedCommands(event)
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
    ...readableCompactedCommands(event)
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
  const compacted = readableCompactedCommands(event).filter(
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
    if (facts.categories?.length) scoped.categories = facts.categories;
    if (facts.budgetPlans?.length) scoped.budgetPlans = facts.budgetPlans;
    if (facts.recurrences?.length) scoped.recurrences = facts.recurrences;
    if (facts.householdOnboarding) scoped.householdOnboarding = facts.householdOnboarding;
    if (facts.onboardingSubmissions?.length) {
      scoped.onboardingSubmissions = shapeOnboardingSubmissions(facts.onboardingSubmissions)
        .filter((row) => row.householdId === event.household_id && row.memberId === event.member_id);
    }
    if (facts.onboardingCategoryProposals?.length) {
      scoped.onboardingCategoryProposals = shapeOnboardingCategoryProposals(facts.onboardingCategoryProposals)
        .filter((row) => row.householdId === event.household_id && row.memberId === event.member_id);
    }
    if (facts.onboardingCategoryMerges?.length) {
      scoped.onboardingCategoryMerges = shapeOnboardingCategoryMerges(facts.onboardingCategoryMerges)
        .filter((row) => row.householdId === event.household_id && row.mergedByMemberId === event.member_id);
    }
    if (facts.onboardingApprovals?.length) {
      scoped.onboardingApprovals = shapeOnboardingApprovals(facts.onboardingApprovals)
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
    const categories = household.categories.filter((row) => posted.has(row.id));
    if (categories.length) facts.categories = categories;
    const budgetPlans = options?.commandKind === ONBOARDING_ADOPTION_COMMAND_KIND
      ? household.budgetPlans.filter((row) => posted.has(row.id))
      : [];
    if (budgetPlans.length) facts.budgetPlans = budgetPlans;
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
    const onboardingCategoryProposals = shapeOnboardingCategoryProposals(
      household.onboardingCategoryProposals,
      household.householdId,
    ).filter((row) => posted.has(row.id) && (!memberId || row.memberId === memberId));
    if (onboardingCategoryProposals.length) facts.onboardingCategoryProposals = onboardingCategoryProposals;
    const onboardingCategoryMerges = shapeOnboardingCategoryMerges(
      household.onboardingCategoryMerges,
      household.householdId,
    ).filter((row) => posted.has(row.id) && (!memberId || row.mergedByMemberId === memberId));
    if (onboardingCategoryMerges.length) facts.onboardingCategoryMerges = onboardingCategoryMerges;
    const onboardingApprovals = shapeOnboardingApprovals(
      household.onboardingApprovals,
      household.householdId,
    ).filter((row) => posted.has(row.id) && (!memberId || row.memberId === memberId));
    if (onboardingApprovals.length) facts.onboardingApprovals = onboardingApprovals;
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
  const categoryMap = rowMapsTo(snapshot.categories);
  for (const category of facts.categories ?? []) categoryMap.set(category.id, category);
  const budgetPlanMap = rowMapsTo(snapshot.budgetPlans);
  for (const budgetPlan of facts.budgetPlans ?? []) {
    const existing = budgetPlanMap.get(budgetPlan.id);
    if (!existing || budgetPlan.updatedAt >= existing.updatedAt) budgetPlanMap.set(budgetPlan.id, budgetPlan);
  }
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
  const onboardingCategoryProposals = mergeOnboardingCategoryProposals(
    snapshot.onboardingCategoryProposals,
    facts.onboardingCategoryProposals,
  ).filter((row) => row.householdId === snapshot.householdId);
  const onboardingCategoryMerges = mergeOnboardingCategoryMerges(
    snapshot.onboardingCategoryMerges,
    facts.onboardingCategoryMerges,
  ).filter((row) => row.householdId === snapshot.householdId);
  const onboardingApprovals = mergeOnboardingApprovals(
    snapshot.onboardingApprovals,
    facts.onboardingApprovals,
  ).filter((row) => row.householdId === snapshot.householdId);
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
    categories: [...categoryMap.values()],
    budgetPlans: [...budgetPlanMap.values()],
    householdOnboarding,
    onboardingSubmissions,
    onboardingCategoryProposals,
    onboardingCategoryMerges,
    onboardingApprovals,
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
  for (const command of onboardingAdoptionCommands(event) ?? []) {
    if (!command.identityHash || !command.auditHash || !command.revision || !command.acceptedAt) continue;
    next = rememberReceipt(next, {
      confirmationId: command.confirmationId,
      identityHash: command.identityHash,
      auditHash: command.auditHash,
      materializationHash: command.materializationHash,
      commandKind: command.commandKind,
      postedIds: [...command.postedIds],
      revision: command.revision,
      acceptedAt: command.acceptedAt,
    });
  }
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
    onboardingCategoryProposals: [],
    onboardingCategoryMerges: [],
    onboardingApprovals: [],
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
  if (!validCommandEnvelope(event)) {
    return { ok: false, reason: "malformed-command-envelope", fallback: true };
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
  const rawIncomingCategoryProposals = event.payload_json.materializationFacts.onboardingCategoryProposals;
  const rawIncomingCategoryMerges = event.payload_json.materializationFacts.onboardingCategoryMerges;
  const rawIncomingApprovals = event.payload_json.materializationFacts.onboardingApprovals;
  const rawIncomingCategories = event.payload_json.materializationFacts.categories;
  const incomingCategories = Array.isArray(rawIncomingCategories) ? rawIncomingCategories : [];
  const rawIncomingBudgetPlans = event.payload_json.materializationFacts.budgetPlans;
  const incomingBudgetPlans = shapeOnboardingAdoptionPlans(rawIncomingBudgetPlans);
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
  const incomingCategoryProposals = shapeOnboardingCategoryProposals(rawIncomingCategoryProposals);
  const incomingCategoryMerges = shapeOnboardingCategoryMerges(rawIncomingCategoryMerges);
  let incomingApprovals: OnboardingApproval[];
  try {
    incomingApprovals = shapeOnboardingApprovals(rawIncomingApprovals);
  } catch {
    return { ok: false, reason: "onboarding-approval-invalid", fallback: true };
  }
  if (rawIncomingCategoryProposals && (!Array.isArray(rawIncomingCategoryProposals)
    || incomingCategoryProposals.length !== rawIncomingCategoryProposals.length)) {
    return { ok: false, reason: "onboarding-category-proposal-invalid", fallback: true };
  }
  if (rawIncomingCategoryMerges && (!Array.isArray(rawIncomingCategoryMerges)
    || incomingCategoryMerges.length !== rawIncomingCategoryMerges.length)) {
    return { ok: false, reason: "onboarding-category-merge-invalid", fallback: true };
  }
  if (rawIncomingApprovals && (!Array.isArray(rawIncomingApprovals)
    || incomingApprovals.length !== rawIncomingApprovals.length)) {
    return { ok: false, reason: "onboarding-approval-invalid", fallback: true };
  }
  if (incomingApprovals.length) {
    try {
      mergeOnboardingApprovals(local.onboardingApprovals, incomingApprovals);
    } catch {
      return { ok: false, reason: "onboarding-approval-history-conflict", fallback: true };
    }
  }
  if (rawIncomingCategories && !Array.isArray(rawIncomingCategories)) {
    return { ok: false, reason: "onboarding-category-catalog-invalid", fallback: true };
  }
  if (!incomingBudgetPlans) {
    return { ok: false, reason: "onboarding-adoption-plan-invalid", fallback: true };
  }
  if (incomingCategoryProposals.length || incomingCategoryMerges.length) {
    try {
      assertOnboardingCategoryCollections({
        ...local,
        onboardingSubmissions: mergeSubmissions(local.onboardingSubmissions, incomingSubmissions),
        onboardingCategoryProposals: mergeOnboardingCategoryProposals(local.onboardingCategoryProposals, incomingCategoryProposals),
        onboardingCategoryMerges: mergeOnboardingCategoryMerges(local.onboardingCategoryMerges, incomingCategoryMerges),
      });
    } catch {
      return { ok: false, reason: "onboarding-category-history-invalid", fallback: true };
    }
  }
  if (incomingCategoryMerges.length) {
    if (!eventContainsOnboardingCategoryMerge(event)) {
      return { ok: false, reason: "onboarding-category-merge-authority-mismatch", fallback: true };
    }
    try {
      let staged: Household = {
        ...local,
        onboardingSubmissions: mergeSubmissions(local.onboardingSubmissions, incomingSubmissions),
        onboardingCategoryProposals: mergeOnboardingCategoryProposals(local.onboardingCategoryProposals, incomingCategoryProposals),
      };
      const incomingCategoryById = new Map(incomingCategories.map((row) => [row.id, row]));
      const allowedCategoryIds = new Set(incomingCategoryMerges.flatMap((row) => row.categoryIds));
      if (incomingCategories.some((row) => !allowedCategoryIds.has(row.id) || staged.categories.some((prior) => prior.id === row.id))) {
        throw new Error("Review the category merge again.");
      }
      for (const merge of incomingCategoryMerges) {
        const mergeCategories = [...incomingCategoryById.values()].filter((row) => merge.categoryIds.includes(row.id));
        const candidate: Household = {
          ...staged,
          categories: [...staged.categories, ...mergeCategories],
          onboardingCategoryMerges: [
            ...shapeOnboardingCategoryMerges(staged.onboardingCategoryMerges, staged.householdId),
            merge,
          ],
        };
        assertOnboardingCategoryMergeTransition(staged, candidate, {
          actorMemberId: event.member_id,
          commandKind: "mergeOnboardingCategories",
          postedIds: [merge.id, ...mergeCategories.map((row) => row.id)],
        });
        staged = candidate;
      }
    } catch {
      return { ok: false, reason: "onboarding-category-merge-authority-mismatch", fallback: true };
    }
  }
  if (eventContainsOnboardingSubmissionCommand(event) && incomingSubmissions.length === 0) {
    return { ok: false, reason: "onboarding-submission-missing", fallback: true };
  }
  if (eventContainsOnboardingApproval(event) && incomingApprovals.length === 0) {
    return { ok: false, reason: "onboarding-approval-missing", fallback: true };
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
    && !actorMayApplyOnboardingSubmissions(local, event, incomingSubmissions, incomingCategoryProposals)) {
    return { ok: false, reason: "onboarding-submission-authority-mismatch", fallback: true };
  }
  if (incomingApprovals.length && !await actorMayApplyOnboardingApprovals(local, event, incomingApprovals)) {
    return { ok: false, reason: "onboarding-approval-authority-mismatch", fallback: true };
  }
  const adoptionRelevant = incomingBudgetPlans.length > 0
    || event.command_type === ONBOARDING_ADOPTION_COMMAND_KIND
    || readableCompactedCommands(event).some((row) => row.commandKind === ONBOARDING_ADOPTION_COMMAND_KIND);
  const adoptionCommands = adoptionRelevant ? onboardingAdoptionCommands(event) : [];
  if (!adoptionCommands) {
    return { ok: false, reason: "onboarding-adoption-materialization-mismatch", fallback: true };
  }
  if ((incomingBudgetPlans.length > 0 || adoptionCommands.length > 0)
    && (incomingBudgetPlans.length === 0 || adoptionCommands.length !== 1)) {
    return { ok: false, reason: "onboarding-adoption-materialization-mismatch", fallback: true };
  }
  if (adoptionCommands.length === 1) {
    const command = adoptionCommands[0]!;
    const planIds = new Set(command.postedIds);
    const commandPlans = incomingBudgetPlans.filter((plan) => planIds.has(plan.id));
    if (event.ledger_scope !== "shared"
      || event.payload_json.commandKind !== event.command_type
      || event.payload_json.confirmationId !== event.confirmation_id
      || event.payload_json.identityHash !== event.identity_hash
      || event.payload_json.revision !== event.result_revision
      || commandPlans.length !== incomingBudgetPlans.length
      || command.postedIds.length !== incomingBudgetPlans.length
      || !command.materializationHash
      || await sha256Hex(commandMaterializationFacts({ budgetPlans: commandPlans })) !== command.materializationHash) {
      return { ok: false, reason: "onboarding-adoption-materialization-mismatch", fallback: true };
    }
    const categoryMap = new Map(local.categories.map((row) => [row.id, row]));
    for (const row of incomingCategories) categoryMap.set(row.id, row);
    const planMap = new Map(local.budgetPlans.map((row) => [row.id, row]));
    for (const row of incomingBudgetPlans) planMap.set(row.id, row);
    const staged: Household = {
      ...local,
      categories: [...categoryMap.values()],
      householdOnboarding: mergeHouseholdOnboarding(local.householdOnboarding, incomingOnboarding, {
        householdId: local.householdId,
        environment: local.environment,
        members: local.members,
      }),
      onboardingSubmissions: mergeSubmissions(local.onboardingSubmissions, incomingSubmissions),
      onboardingCategoryProposals: mergeOnboardingCategoryProposals(
        local.onboardingCategoryProposals,
        incomingCategoryProposals,
      ),
      onboardingCategoryMerges: mergeOnboardingCategoryMerges(
        local.onboardingCategoryMerges,
        incomingCategoryMerges,
      ),
      onboardingApprovals: mergeOnboardingApprovals(local.onboardingApprovals, incomingApprovals),
    };
    let observedOn: DateKey;
    try {
      if (!command.identityHash
        || !command.auditHash
        || !command.revision
        || command.revision <= event.base_revision
        || command.revision > event.result_revision
        || !command.acceptedAt
        || new Date(command.acceptedAt).toISOString() !== command.acceptedAt
        || Date.parse(command.acceptedAt) > Date.parse(event.payload_json.acceptedAt)) {
        throw new Error("The adoption receipt history is invalid.");
      }
      const candidate = { ...staged, budgetPlans: [...planMap.values()] };
      const identityPrevious = { ...staged, revision: command.revision - 1 };
      const receiptHash = await commandReceiptEnvelopeHash({
        confirmationId: command.confirmationId,
        commandKind: command.commandKind,
        postedIds: command.postedIds,
        ledgerScope: command.ledgerScope,
        materializationHash: command.materializationHash,
        identityHash: command.identityHash,
        auditHash: command.auditHash,
        revision: command.revision,
        acceptedAt: command.acceptedAt,
      });
      if ((event.payload_json.compactedCommands !== undefined && command.receiptHash !== receiptHash)
        || await commandIdentityHash(identityPrevious, candidate, command.postedIds) !== command.identityHash
        || await financialAuditHashForScope(local, "shared", event.member_id) !== command.auditHash) {
        throw new Error("The adoption receipt does not match its historical command.");
      }
      observedOn = dateKeyInZone(new Date(command.acceptedAt), local.timezone) as DateKey;
      assertOnboardingAdoptionPlans(staged, [...planMap.values()], {
        actorMemberId: event.member_id,
        confirmationId: command.confirmationId,
        postedIds: command.postedIds,
        observedOn,
      });
    } catch {
      return { ok: false, reason: "onboarding-adoption-authority-mismatch", fallback: true };
    }
  }
  if (incomingRehearsals.length || incomingRecurrences.length || incomingOnboarding || incomingSubmissions.length
    || incomingCategoryProposals.length || incomingCategoryMerges.length || incomingApprovals.length
    || incomingBudgetPlans.length) {
    const expected = await sha256Hex(commandMaterializationFacts({
      monthRehearsals: incomingRehearsals,
      recurrences: incomingRecurrences,
      householdOnboarding: incomingOnboarding,
      onboardingSubmissions: incomingSubmissions,
      onboardingCategoryProposals: incomingCategoryProposals,
      onboardingCategoryMerges: incomingCategoryMerges,
      onboardingApprovals: incomingApprovals,
      categories: incomingCategories,
      budgetPlans: incomingBudgetPlans,
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
