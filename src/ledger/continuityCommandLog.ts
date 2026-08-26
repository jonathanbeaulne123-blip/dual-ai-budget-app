import type { CommandReceipt, Household } from "../core/types.ts";
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

function inferLedgerScope(household: Household, postedIds: string[]): "shared" | "personal" {
  const posted = new Set(postedIds);
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
  return {
    idempotencyKey: receipt.confirmationId,
    confirmationId: receipt.confirmationId,
    identityHash: receipt.identityHash,
    baseRevision,
    resultRevision: household.revision,
    ledgerScope: inferLedgerScope(household, receipt.postedIds),
    commandType: receipt.commandKind,
    commandPayload: {
      confirmationId: receipt.confirmationId,
      identityHash: receipt.identityHash,
      commandKind: receipt.commandKind,
      postedIds: [...receipt.postedIds].sort(),
      auditHash: receipt.auditHash,
      revision: receipt.revision,
      acceptedAt: receipt.acceptedAt,
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

export function compactedCommandPayload(
  item: { confirmationIds: string[]; commandRefs: ContinuityCommandRef[] },
  primary: ContinuityCommandRef,
  household: Household,
): Record<string, unknown> {
  const mergedFacts = mergeMaterializationFacts(item.commandRefs, household);
  return {
    ...primary.commandPayload,
    materializationFacts: mergedFacts,
    compactedConfirmationIds: item.confirmationIds,
    compactedCommands: item.commandRefs.map((ref) => ({
      confirmationId: ref.confirmationId,
      commandKind: ref.commandType,
      postedIds: ref.commandPayload.postedIds,
      ledgerScope: ref.ledgerScope,
    })),
  };
}

function mergeMaterializationFacts(
  refs: ContinuityCommandRef[],
  household: Household,
): ContinuityMaterializationFacts | undefined {
  const merged: ContinuityMaterializationFacts = {};
  for (const ref of refs) {
    const facts = extractMaterializationFacts(household, ref.commandPayload.postedIds, {
      acceptedAt: ref.commandPayload.acceptedAt,
    });
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
    if (facts.tombstones?.length) {
      merged.tombstones = [...(merged.tombstones ?? []), ...facts.tombstones];
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}
