import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  linkGoogleIdentity,
  postEntry,
} from "../src/core/index.ts";
import { receiptToCommandRef } from "../src/ledger/continuityCommandLog.ts";
import {
  applyCommandEventLocally,
  compareContinuityPayloadBytes,
  commandEventVisibleToMember,
  extractMaterializationFacts,
  parseContinuityCommandEventRow,
  type ContinuityCommandEvent,
} from "../src/ledger/materializeSnapshotFromEvents.ts";
import { encodeSharedSnapshotPayload } from "../src/ledger/snapshotPayload.ts";
import { householdCloudProjection } from "../src/ledger/supabase.ts";
import { markSynchronized } from "../src/core/sharing.ts";

const identity = { memberId: "MEM-001", email: "jonathan@example.com", subject: "google-sub-jonathan" };

function googleHousehold() {
  return linkGoogleIdentity(catalogHousehold(), {
    memberId: identity.memberId,
    email: identity.email,
    subject: identity.subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
}

function buildEvent(household: ReturnType<typeof googleHousehold>, confirmationId: string, baseRevision: number) {
  const receipt = household.commandReceipts?.find((row) => row.confirmationId === confirmationId)!;
  const ref = receiptToCommandRef({ household, receipt, baseRevision });
  return {
    id: `evt-${confirmationId}`,
    environment: household.environment,
    household_id: household.householdId,
    member_id: identity.memberId,
    idempotency_key: confirmationId,
    confirmation_id: confirmationId,
    identity_hash: receipt.identityHash,
    base_revision: baseRevision,
    result_revision: household.revision,
    ledger_scope: ref.ledgerScope,
    command_type: ref.commandType,
    payload_json: {
      ...ref.commandPayload,
      materializationFacts: extractMaterializationFacts(household, receipt.postedIds),
    },
    created_at: "2026-08-26T12:00:00.000Z",
  } satisfies ContinuityCommandEvent;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("T2-S4 command event apply", () => {
  it("applies a single Realtime INSERT locally when base revision matches", async () => {
    let previous = googleHousehold();
    const posted = postEntry(previous, {
      date: "2026-08-24",
      type: "expense",
      amount: "3.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Realtime milk",
      createdBy: identity.memberId,
      confirmDuplicate: true,
    });
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "rt-apply",
      postedIds: posted.postedIds,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    const event = buildEvent(accepted.household, "rt-apply", previous.revision);
    const applied = await applyCommandEventLocally({
      local: previous,
      event,
      memberId: identity.memberId,
    });
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.duplicate).toBe(false);
      expect(applied.household.transactions.some((row) => row.note === "Realtime milk")).toBe(true);
      const synchronized = markSynchronized(applied.household, event.payload_json.acceptedAt);
      expect(synchronized.baseRevision).toBe(event.result_revision);
      expect(synchronized.sharing?.mode).toBe("synchronized");
    }
  });

  it("falls back when audit hash does not match materialized books", async () => {
    let previous = googleHousehold();
    const posted = postEntry(previous, {
      date: "2026-08-24",
      type: "expense",
      amount: "2.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Bad hash",
      createdBy: identity.memberId,
      confirmDuplicate: true,
    });
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "rt-bad-hash",
      postedIds: posted.postedIds,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    const event = buildEvent(accepted.household, "rt-bad-hash", previous.revision);
    event.payload_json.auditHash = "deadbeef";
    const applied = await applyCommandEventLocally({
      local: previous,
      event,
      memberId: identity.memberId,
    });
    expect(applied.ok).toBe(false);
    if (!applied.ok) {
      expect(applied.fallback).toBe(true);
      expect(applied.reason).toBe("audit-hash-mismatch");
    }
  });

  it("hides partner personal events from the wrong member", () => {
    const event: ContinuityCommandEvent = {
      id: "evt-personal",
      environment: "development",
      household_id: "HH-DEMO",
      member_id: "MEM-002",
      idempotency_key: "personal-hidden",
      confirmation_id: "personal-hidden",
      identity_hash: "hash",
      base_revision: 0,
      result_revision: 1,
      ledger_scope: "personal",
      command_type: "postEntry",
      payload_json: {
        confirmationId: "personal-hidden",
        identityHash: "hash",
        commandKind: "postEntry",
        postedIds: [],
        auditHash: "",
        revision: 1,
        acceptedAt: "2026-08-26T12:00:00.000Z",
      },
      created_at: "2026-08-26T12:00:00.000Z",
    };
    expect(commandEventVisibleToMember(event, "MEM-001")).toBe(false);
    expect(commandEventVisibleToMember(event, "MEM-002")).toBe(true);
  });

  it("parses Realtime postgres_changes rows", () => {
    const parsed = parseContinuityCommandEventRow({
      id: "evt-parse",
      environment: "development",
      household_id: "HH-DEMO",
      member_id: "MEM-001",
      idempotency_key: "parse-me",
      confirmation_id: "parse-me",
      identity_hash: "hash",
      base_revision: 0,
      result_revision: 1,
      ledger_scope: "shared",
      command_type: "postEntry",
      payload_json: { confirmationId: "parse-me", postedIds: ["TXN-1"] },
      created_at: "2026-08-26T12:00:00.000Z",
    });
    expect(parsed?.idempotency_key).toBe("parse-me");
    expect(parseContinuityCommandEventRow(null)).toBeNull();
  });

  it("command event websocket payload is much smaller than a snapshot row", async () => {
    let household = googleHousehold();
    for (let index = 0; index < 50; index += 1) {
      household = postEntry(household, {
        date: "2026-08-24",
        type: "expense",
        amount: "9.99",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: `stress line ${index}`,
        createdBy: identity.memberId,
        confirmDuplicate: true,
      }).household;
    }
    const confirmationId = "size-compare";
    household = (await acceptHouseholdWrite({
      previous: household,
      candidate: household,
      confirmationId,
      postedIds: [household.transactions.at(-1)!.id],
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    })).household;
    const event = buildEvent(household, confirmationId, household.revision - 1);
    const cloud = householdCloudProjection(household, identity.memberId);
    const snapshotRow = {
      payload: await encodeSharedSnapshotPayload(cloud),
      revision: household.revision,
      snapshot_hash: household.booksAcceptedHash ?? undefined,
    };
    const sizes = compareContinuityPayloadBytes({ commandEvent: event, snapshotRow });
    expect(sizes.commandEventBytes).toBeLessThan(sizes.snapshotRowBytes / 10);
    expect(sizes.ratio).toBeLessThan(0.1);
  });
});
