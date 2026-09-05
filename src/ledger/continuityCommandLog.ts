import type { CommandReceipt, Household } from "../core/types.ts";
import { commandMaterializationFacts, commandReceiptEnvelopeHash, sha256Hex } from "../core/commandIdentity.ts";
import { mergeSubmissions } from "../core/onboarding/submissions.ts";
import { mergeOnboardingApprovals } from "../core/onboarding/approvals.ts";
import {
  extractMaterializationFacts,
  type ContinuityMaterializationFacts,
} from "./materializeSnapshotFromEvents.ts";
export function continuityCommandLogEnabled(): boolean {
  return String(import.meta.env.VITE_CONTINUITY_COMMAND_LOG || "") === "1";
}

/** Bounded hosted command receipt — never the full household journal. */
export type ContinuityCommandRef = {
  idempotencyKey: string;
  confirmationId: string;
  identityHash: string;
  baseRevision: number;
  resultRevision: number;
  ledgerScope: "shared" | "personal";
  commandType: string;
  commandPayload: {
    confirmationId: string;
    identityHash: string;
    commandKind: string;
    postedIds: string[];
    auditHash: string;
    revision: number;
    acceptedAt: string;
    materializationHash?: string;
    materializationFacts?: ContinuityMaterializationFacts;
  };
};

export type AppendCommandRpcResult = {
  ok: boolean;
  conflict: boolean;
  duplicate?: boolean;
  reason?: string;
  resultRevision?: number;
  eventId?: string;
  remotePayload?: string | null;
};

function inferLedgerScope(household: Household, postedIds: string[], commandKind: string): "shared" | "personal" {
  if (commandKind.endsWith("-personal")) return "personal";
  const posted = new Set(postedIds);
  const changesSharedFund = Boolean(
    (household.householdFund && posted.has(household.householdFund.id))
    || (household.fundMonthPlans ?? []).some((row) => posted.has(row.id))
    || (household.fundEvents ?? []).some((row) => posted.has(row.id))
    || (household.fundSettlementAllocations ?? []).some((row) => posted.has(row.id))
    || (household.fundKittyAllocations ?? []).some((row) => posted.has(row.id)),
  );
  if (changesSharedFund) return "shared";
  const rows = [
    ...household.transactions.filter((row) => posted.has(row.id)),
    ...household.shifts.filter((row) => posted.has(row.id)),
  ];
  if (!rows.length) return "shared";
  return rows.every((row) => row.visibility === "personal") ? "personal" : "shared";
}

export function receiptToCommandRef(input: {
  household: Household;
  receipt: CommandReceipt;
  baseRevision: number;
}): ContinuityCommandRef {
  const { household, receipt, baseRevision } = input;
  const ledgerScope = inferLedgerScope(household, receipt.postedIds, receipt.commandKind);
  return {
    idempotencyKey: receipt.confirmationId,
    confirmationId: receipt.confirmationId,
    identityHash: receipt.identityHash,
    baseRevision,
    resultRevision: household.revision,
    ledgerScope,
    commandType: receipt.commandKind,
    commandPayload: {
      confirmationId: receipt.confirmationId,
      identityHash: receipt.identityHash,
      commandKind: receipt.commandKind,
      postedIds: [...receipt.postedIds].sort(),
      auditHash: receipt.scopedAuditHashes?.[ledgerScope] ?? receipt.auditHash,
      revision: receipt.revision,
      acceptedAt: receipt.acceptedAt,
      materializationHash: receipt.materializationHash,
    },
  };
}

export function buildCommandRef(input: {
  household: Household;
  confirmationId: string;
  baseRevision: number;
}): ContinuityCommandRef | null {
  const receipt = input.household.commandReceipts?.find(
    (row) => row.confirmationId === input.confirmationId,
  );
  if (!receipt?.identityHash) return null;
  return receiptToCommandRef({
    household: input.household,
    receipt,
    baseRevision: input.baseRevision,
  });
}

/** Primary ref for a compacted tip: latest result revision wins. */
export function primaryCommandRef(refs: ContinuityCommandRef[]): ContinuityCommandRef {
  return [...refs].sort((left, right) => (
    right.resultRevision - left.resultRevision
    || right.baseRevision - left.baseRevision
    || right.confirmationId.localeCompare(left.confirmationId)
  ))[0]!;
}

export async function compactedCommandPayload(
  item: { confirmationIds: string[]; commandRefs: ContinuityCommandRef[] },
  primary: ContinuityCommandRef,
  household: Household,
  memberId?: string,
): Promise<Record<string, unknown>> {
  const mergedFacts = mergeMaterializationFacts(item.commandRefs, household, primary.ledgerScope, memberId);
  const charterPostedIds = mergedFacts?.charter
    ? [...new Set(item.commandRefs
      .filter((ref) => ref.ledgerScope === "shared")
      .flatMap((ref) => ref.commandPayload.postedIds)
      .filter((id) => id.startsWith("CHARTER-")))]
    : [];
  const scopedPostedIds = [
    ...(mergedFacts?.recurrences ?? []).map((row) => row.id),
    ...(mergedFacts?.transactions ?? []).map((row) => row.id),
    ...(mergedFacts?.shifts ?? []).map((row) => row.id),
    ...(mergedFacts?.claims ?? []).map((row) => row.id),
    ...(mergedFacts?.sitDownSessions ?? []).map((row) => row.id),
    ...(mergedFacts?.goalContributions ?? []).map((row) => row.id),
    ...(mergedFacts?.goalPurchases ?? []).map((row) => row.id),
    ...(mergedFacts?.householdOnboarding ? [mergedFacts.householdOnboarding.id] : []),
    ...(mergedFacts?.onboardingSubmissions ?? []).map((row) => row.id),
    ...(mergedFacts?.onboardingCategoryProposals ?? []).map((row) => row.id),
    ...(mergedFacts?.onboardingCategoryMerges ?? []).map((row) => row.id),
    ...(mergedFacts?.onboardingApprovals ?? []).map((row) => row.id),
    ...(mergedFacts?.categories ?? []).map((row) => row.id),
    ...(mergedFacts?.budgetPlans ?? []).map((row) => row.id),
    ...charterPostedIds,
    ...(mergedFacts?.householdFund ? [mergedFacts.householdFund.id] : []),
    ...(mergedFacts?.fundMonthPlans ?? []).map((row) => row.id),
    ...(mergedFacts?.fundEvents ?? []).map((row) => row.id),
    ...(mergedFacts?.fundSettlementAllocations ?? []).map((row) => row.id),
    ...(mergedFacts?.fundKittyAllocations ?? []).map((row) => row.id),
    ...(mergedFacts?.weeklyDocumentStamps ?? []).map((row) => row.id),
    ...(mergedFacts?.tombstones ?? []).map((row) => row.id),
  ].sort();
  const compactedCommands = await Promise.all(item.commandRefs
    .filter((ref) => ref.ledgerScope === primary.ledgerScope)
    .map(async (ref) => {
      const descriptor = {
        confirmationId: ref.confirmationId,
        commandKind: ref.commandType,
        postedIds: ref.commandPayload.postedIds,
        ledgerScope: ref.ledgerScope,
        materializationHash: ref.commandPayload.materializationHash,
        auditHash: ref.commandPayload.auditHash,
        identityHash: ref.commandPayload.identityHash,
        revision: ref.commandPayload.revision,
        acceptedAt: ref.commandPayload.acceptedAt,
      };
      return { ...descriptor, receiptHash: await commandReceiptEnvelopeHash(descriptor) };
    }));
  return {
    ...primary.commandPayload,
    materializationHash: mergedFacts?.monthRehearsals?.length
      || mergedFacts?.recurrences?.length
      || mergedFacts?.householdOnboarding
      || mergedFacts?.onboardingSubmissions?.length
      || mergedFacts?.onboardingCategoryProposals?.length
      || mergedFacts?.onboardingCategoryMerges?.length
      || mergedFacts?.onboardingApprovals?.length
      || mergedFacts?.categories?.length
      || mergedFacts?.budgetPlans?.length
      ? await sha256Hex(commandMaterializationFacts({
        monthRehearsals: mergedFacts.monthRehearsals,
        recurrences: mergedFacts.recurrences,
        householdOnboarding: mergedFacts.householdOnboarding,
        onboardingSubmissions: mergedFacts.onboardingSubmissions,
        onboardingCategoryProposals: mergedFacts.onboardingCategoryProposals,
        onboardingCategoryMerges: mergedFacts.onboardingCategoryMerges,
        onboardingApprovals: mergedFacts.onboardingApprovals,
        categories: mergedFacts.categories,
        budgetPlans: mergedFacts.budgetPlans,
      }))
      : primary.commandPayload.materializationHash,
    postedIds: scopedPostedIds.length ? scopedPostedIds : primary.commandPayload.postedIds.filter((id) => {
      const tx = household.transactions.find((row) => row.id === id);
      const shift = household.shifts.find((row) => row.id === id);
      const row = tx ?? shift;
      if (!row) return primary.ledgerScope === "shared";
      if (primary.ledgerScope === "shared") return row.visibility !== "personal";
      return row.visibility === "personal" && (!memberId || row.createdBy === memberId);
    }),
    materializationFacts: mergedFacts,
    compactedConfirmationIds: item.confirmationIds,
    compactedCommands,
  };
}

function mergeMaterializationFacts(
  refs: ContinuityCommandRef[],
  household: Household,
  ledgerScope: "shared" | "personal",
  memberId?: string,
): ContinuityMaterializationFacts | undefined {
  const merged: ContinuityMaterializationFacts = {};
  for (const ref of refs) {
    if (ref.ledgerScope !== ledgerScope) continue;
    const facts = extractMaterializationFacts(household, ref.commandPayload.postedIds, {
      acceptedAt: ref.commandPayload.acceptedAt,
      ledgerScope,
      memberId,
      commandKind: ref.commandType,
    });
    if (facts.recurrences?.length) {
      merged.recurrences = [...(merged.recurrences ?? []), ...facts.recurrences];
    }
    if (facts.transactions?.length) {
      merged.transactions = [...(merged.transactions ?? []), ...facts.transactions];
    }
    if (facts.shifts?.length) {
      merged.shifts = [...(merged.shifts ?? []), ...facts.shifts];
    }
    if (facts.claims?.length) {
      merged.claims = [...(merged.claims ?? []), ...facts.claims];
    }
    if (facts.sitDownSessions?.length) {
      merged.sitDownSessions = [...(merged.sitDownSessions ?? []), ...facts.sitDownSessions];
    }
    if (facts.goalContributions?.length) {
      merged.goalContributions = [...(merged.goalContributions ?? []), ...facts.goalContributions];
    }
    if (facts.goalPurchases?.length) {
      merged.goalPurchases = [...(merged.goalPurchases ?? []), ...facts.goalPurchases];
    }
    if (facts.charter) merged.charter = facts.charter;
    if (facts.householdOnboarding) merged.householdOnboarding = facts.householdOnboarding;
    if (facts.onboardingSubmissions?.length) {
      merged.onboardingSubmissions = mergeSubmissions(
        merged.onboardingSubmissions,
        facts.onboardingSubmissions,
      );
    }
    if (facts.onboardingCategoryProposals?.length) {
      merged.onboardingCategoryProposals = [
        ...(merged.onboardingCategoryProposals ?? []),
        ...facts.onboardingCategoryProposals,
      ];
    }
    if (facts.onboardingCategoryMerges?.length) {
      merged.onboardingCategoryMerges = [
        ...(merged.onboardingCategoryMerges ?? []),
        ...facts.onboardingCategoryMerges,
      ];
    }
    if (facts.onboardingApprovals?.length) {
      merged.onboardingApprovals = mergeOnboardingApprovals(
        merged.onboardingApprovals,
        facts.onboardingApprovals,
      );
    }
    if (facts.categories?.length) {
      merged.categories = [...(merged.categories ?? []), ...facts.categories];
    }
    if (facts.budgetPlans?.length) {
      const plans = new Map((merged.budgetPlans ?? []).map((row) => [row.id, row]));
      for (const row of facts.budgetPlans) plans.set(row.id, row);
      merged.budgetPlans = [...plans.values()];
    }
    if (facts.householdFund) merged.householdFund = facts.householdFund;
    if (facts.fundMonthPlans?.length) merged.fundMonthPlans = [...(merged.fundMonthPlans ?? []), ...facts.fundMonthPlans];
    if (facts.fundEvents?.length) merged.fundEvents = [...(merged.fundEvents ?? []), ...facts.fundEvents];
    if (facts.fundSettlementAllocations?.length) merged.fundSettlementAllocations = [...(merged.fundSettlementAllocations ?? []), ...facts.fundSettlementAllocations];
    if (facts.fundKittyAllocations?.length) merged.fundKittyAllocations = [...(merged.fundKittyAllocations ?? []), ...facts.fundKittyAllocations];
    if (facts.monthRehearsals?.length) merged.monthRehearsals = facts.monthRehearsals;
    if (facts.weeklyDocumentStamps?.length) {
      merged.weeklyDocumentStamps = [
        ...(merged.weeklyDocumentStamps ?? []),
        ...facts.weeklyDocumentStamps,
      ];
    }
    if (facts.tombstones?.length) {
      merged.tombstones = [...(merged.tombstones ?? []), ...facts.tombstones];
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}
