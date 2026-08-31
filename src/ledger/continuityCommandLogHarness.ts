import { financialAuditHash } from "../core/commandIdentity.ts";
import { ensureHouseholdShape } from "../core/sync.ts";
import type { Household } from "../core/types.ts";
import { receiptToCommandRef } from "./continuityCommandLog.ts";
import {
  applyCommandEventLocally,
  buildSnapshotFromEvents,
  catalogBaseFromSnapshot,
  commandEventVisibleToMember,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
} from "./materializeSnapshotFromEvents.ts";
import { householdCloudProjection } from "./supabase.ts";

export type MemoryCommandLogStore = {
  events: ContinuityCommandEvent[];
  tipRevision: number;
};

export type AppendHostedCommandResult =
  | { ok: true; duplicate?: boolean; resultRevision: number }
  | { ok: false; conflict: true; reason: string; tipRevision: number };

export function createMemoryCommandLogStore(tipRevision = 0): MemoryCommandLogStore {
  return { events: [], tipRevision };
}

function eventBodyMatches(existing: ContinuityCommandEvent, incoming: ContinuityCommandEvent): boolean {
  return existing.confirmation_id === incoming.confirmation_id
    && existing.identity_hash === incoming.identity_hash
    && existing.base_revision === incoming.base_revision
    && existing.result_revision === incoming.result_revision
    && existing.command_type === incoming.command_type;
}

/** In-memory append with Migration 013 idempotency + base_revision CAS semantics. */
export function appendHostedCommandEvent(
  store: MemoryCommandLogStore,
  event: ContinuityCommandEvent,
): AppendHostedCommandResult {
  const existing = store.events.find((row) => row.idempotency_key === event.idempotency_key);
  if (existing) {
    if (!eventBodyMatches(existing, event)) {
      return {
        ok: false,
        conflict: true,
        reason: "idempotency-key-reused",
        tipRevision: store.tipRevision,
      };
    }
    return { ok: true, duplicate: true, resultRevision: existing.result_revision };
  }
  if (event.base_revision !== store.tipRevision) {
    return {
      ok: false,
      conflict: true,
      reason: "stale-revision",
      tipRevision: store.tipRevision,
    };
  }
  if (event.result_revision <= event.base_revision) {
    return {
      ok: false,
      conflict: true,
      reason: "non-advancing-revision",
      tipRevision: store.tipRevision,
    };
  }
  store.events.push(event);
  store.tipRevision = event.result_revision;
  return { ok: true, resultRevision: event.result_revision };
}

export function buildCommandEventFromReceipt(input: {
  household: Household;
  confirmationId: string;
  baseRevision: number;
  memberId: string;
  createdAt?: string;
  eventId?: string;
}): ContinuityCommandEvent {
  const shaped = ensureHouseholdShape(input.household);
  const receipt = shaped.commandReceipts?.find((row) => row.confirmationId === input.confirmationId);
  if (!receipt) throw new Error(`missing receipt ${input.confirmationId}`);
  const ref = receiptToCommandRef({
    household: shaped,
    receipt,
    baseRevision: input.baseRevision,
  });
  return {
    id: input.eventId ?? `evt-${input.confirmationId}`,
    environment: shaped.environment,
    household_id: shaped.householdId,
    member_id: input.memberId,
    idempotency_key: input.confirmationId,
    confirmation_id: input.confirmationId,
    identity_hash: receipt.identityHash,
    base_revision: input.baseRevision,
    result_revision: shaped.revision,
    ledger_scope: ref.ledgerScope,
    command_type: ref.commandType,
    payload_json: {
      ...ref.commandPayload,
      materializationFacts: extractMaterializationFacts(shaped, receipt.postedIds, {
        acceptedAt: receipt.acceptedAt,
        ledgerScope: ref.ledgerScope,
        memberId: input.memberId,
        commandKind: ref.commandType,
      }),
    },
    created_at: input.createdAt ?? receipt.acceptedAt,
  };
}

/** Materialize the hosted tip from catalog base + event log (optionally member-scoped). */
export async function materializeCommandLogTip(
  catalog: Household,
  store: MemoryCommandLogStore,
  memberId?: string,
): Promise<Household> {
  const events = memberId
    ? store.events.filter((event) => commandEventVisibleToMember(event, memberId))
    : store.events;
  return buildSnapshotFromEvents(events, catalogBaseFromSnapshot(catalog));
}

/** Incrementally catch up one client from hosted events (Realtime / pull apply path). */
export async function catchUpClientFromCommandLog(input: {
  client: Household;
  store: MemoryCommandLogStore;
  memberId: string;
}): Promise<Household> {
  let current = ensureHouseholdShape(input.client);
  for (const event of [...input.store.events].sort((left, right) => (
    left.result_revision - right.result_revision
    || Date.parse(left.created_at) - Date.parse(right.created_at)
    || left.id.localeCompare(right.id)
  ))) {
    if (!commandEventVisibleToMember(event, input.memberId)) {
      current = {
        ...current,
        revision: Math.max(current.revision, event.result_revision),
      };
      continue;
    }
    const applied = await applyCommandEventLocally({
      local: current,
      event,
      memberId: input.memberId,
    });
    if (!applied.ok) {
      if (applied.fallback) {
        return materializeCommandLogTip(current, input.store, input.memberId);
      }
      continue;
    }
    if (!applied.duplicate) current = applied.household;
  }
  return current;
}

/** Canonical shared-books hash for convergence checks (cloud projection). */
export async function sharedConvergenceHash(
  household: Household,
  memberId: string,
): Promise<string> {
  return financialAuditHash(householdCloudProjection(household, memberId));
}

export function sharedTransactionIds(household: Household, memberId: string): string[] {
  return householdCloudProjection(household, memberId).transactions.map((row) => row.id).sort();
}
