import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  confirmCharterAmendment,
  financialAuditHash,
  foundHouseholdCharter,
  linkGoogleIdentity,
  postEntry,
  proposeCharterAmendment,
  signHouseholdCharter,
} from "../src/core/index.ts";
import { undoLedgerConfirm } from "../src/core/confirmationUndo.ts";
import { financialAuditHashForScope } from "../src/core/commandIdentity.ts";
import {
  compactedCommandPayload,
  primaryCommandRef,
  receiptToCommandRef,
  type ContinuityCommandRef,
} from "../src/ledger/continuityCommandLog.ts";
import {
  applyCommandEventLocally,
  buildSnapshotFromEvents,
  catalogBaseFromSnapshot,
  extractMaterializationFacts,
  materializedHashMatchesSnapshot,
  type ContinuityCommandEvent,
  type ContinuityCommandEventPayload,
} from "../src/ledger/materializeSnapshotFromEvents.ts";
import { householdCloudProjection } from "../src/ledger/supabase.ts";
import type { CommitResult, Household } from "../src/core/types.ts";

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

function grocery(note: string, amount = "4.00", visibility: "household" | "personal" = "household") {
  return {
    date: "2026-08-24" as const,
    type: "expense" as const,
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy: identity.memberId,
    visibility,
    confirmDuplicate: true,
  };
}

function eventFromPost(input: {
  previous: ReturnType<typeof googleHousehold>;
  posted: ReturnType<typeof postEntry>;
  confirmationId: string;
  index: number;
}): ContinuityCommandEvent {
  const receipt = input.posted.household.commandReceipts?.find(
    (row) => row.confirmationId === input.confirmationId,
  );
  if (!receipt) throw new Error("missing receipt");
  const ref = receiptToCommandRef({
    household: input.posted.household,
    receipt,
    baseRevision: input.previous.revision,
  });
  return {
    id: `evt-${input.index}`,
    environment: input.posted.household.environment,
    household_id: input.posted.household.householdId,
    member_id: identity.memberId,
    idempotency_key: input.confirmationId,
    confirmation_id: input.confirmationId,
    identity_hash: receipt.identityHash,
    base_revision: input.previous.revision,
    result_revision: input.posted.household.revision,
    ledger_scope: ref.ledgerScope,
    command_type: ref.commandType,
    payload_json: {
      ...ref.commandPayload,
      materializationFacts: extractMaterializationFacts(input.posted.household, receipt.postedIds),
    },
    created_at: new Date(Date.parse("2026-08-26T12:00:00.000Z") + input.index * 1000).toISOString(),
  };
}

async function acceptedCharterEvent(input: {
  previous: Household;
  committed: CommitResult;
  confirmationId: string;
  commandKind: string;
  memberId: string;
  index: number;
}): Promise<{ household: Household; event: ContinuityCommandEvent; ref: ContinuityCommandRef }> {
  const accepted = await acceptHouseholdWrite({
    previous: input.previous,
    candidate: input.committed.household,
    confirmationId: input.confirmationId,
    postedIds: input.committed.postedIds,
    commandKind: input.commandKind,
    adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
  });
  if (!accepted.ok) throw new Error(`Charter command was not accepted: ${accepted.kind}`);
  const receipt = accepted.household.commandReceipts?.find(
    (row) => row.confirmationId === input.confirmationId,
  );
  if (!receipt) throw new Error("missing charter receipt");
  const ref = receiptToCommandRef({
    household: accepted.household,
    receipt,
    baseRevision: input.previous.revision,
  });
  return {
    household: accepted.household,
    ref,
    event: {
      id: `evt-charter-${input.index}`,
      environment: accepted.household.environment,
      household_id: accepted.household.householdId,
      member_id: input.memberId,
      idempotency_key: input.confirmationId,
      confirmation_id: input.confirmationId,
      identity_hash: receipt.identityHash,
      base_revision: input.previous.revision,
      result_revision: accepted.household.revision,
      ledger_scope: ref.ledgerScope,
      command_type: ref.commandType,
      payload_json: {
        ...ref.commandPayload,
        materializationFacts: extractMaterializationFacts(accepted.household, receipt.postedIds, {
          acceptedAt: receipt.acceptedAt,
          ledgerScope: ref.ledgerScope,
          memberId: input.memberId,
          commandKind: ref.commandType,
        }),
      },
      created_at: new Date(Date.parse("2026-09-01T12:00:00.000Z") + input.index * 1000).toISOString(),
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("T2-S3 materialized snapshot builder", () => {
  it("golden fixtures: 10 commands rebuild to the same financialAuditHash", async () => {
    let previous = googleHousehold();
    const events: ContinuityCommandEvent[] = [];
    const notes = [
      "milk", "bread", "eggs", "cheese", "apples",
      "coffee", "tea", "rice", "pasta", "yogurt",
    ];
    for (let index = 0; index < notes.length; index += 1) {
      const confirmationId = `golden-${index + 1}`;
      const posted = postEntry(previous, grocery(notes[index]!, `${(index + 1).toFixed(2)}`));
      const accepted = await acceptHouseholdWrite({
        previous,
        candidate: posted.household,
        confirmationId,
        postedIds: posted.postedIds,
        commandKind: "postEntry",
        adapters: {
          persist: async () => {},
          ingest: async () => ({ ok: true }),
        },
      });
      expect(accepted.ok).toBe(true);
      events.push(eventFromPost({ previous, posted: { ...posted, household: accepted.household }, confirmationId, index }));
      previous = accepted.household;
    }

    const expectedHash = await financialAuditHash(previous);
    const base = catalogBaseFromSnapshot(previous);
    const materialized = await buildSnapshotFromEvents(events, base);
    const materializedHash = await financialAuditHash(materialized);

    expect(materialized.transactions).toHaveLength(10);
    expect(materialized.revision).toBe(previous.revision);
    expect(materializedHash).toBe(expectedHash);
    expect(await materializedHashMatchesSnapshot({
      materialized,
      snapshotTip: previous,
      memberId: identity.memberId,
      project: householdCloudProjection,
    })).toBe(true);
  });

  it("post then undo materializes through flush-shaped facts with matching hash", async () => {
    let previous = googleHousehold();
    const posted = postEntry(previous, grocery("undo replay milk"));
    const postAccepted = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "flush-post",
      postedIds: posted.postedIds,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    previous = postAccepted.household;
    const undone = undoLedgerConfirm(previous, posted.undo!);
    const undoAccepted = await acceptHouseholdWrite({
      previous,
      candidate: undone.household,
      confirmationId: "flush-undo",
      postedIds: undone.postedIds,
      commandKind: "undoLedgerConfirm",
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    const tip = undoAccepted.household;
    const postReceipt = tip.commandReceipts?.find((row) => row.confirmationId === "flush-post")!;
    const undoReceipt = tip.commandReceipts?.find((row) => row.confirmationId === "flush-undo")!;
    const postRef = receiptToCommandRef({ household: previous, receipt: postReceipt, baseRevision: 0 });
    const undoRef = receiptToCommandRef({ household: tip, receipt: undoReceipt, baseRevision: previous.revision });
    const events: ContinuityCommandEvent[] = [
      {
        id: "evt-flush-post",
        environment: tip.environment,
        household_id: tip.householdId,
        member_id: identity.memberId,
        idempotency_key: "flush-post",
        confirmation_id: "flush-post",
        identity_hash: postReceipt.identityHash,
        base_revision: 0,
        result_revision: previous.revision,
        ledger_scope: postRef.ledgerScope,
        command_type: postRef.commandType,
        payload_json: {
          ...postRef.commandPayload,
          materializationFacts: extractMaterializationFacts(previous, postReceipt.postedIds, {
            acceptedAt: postReceipt.acceptedAt,
          }),
        },
        created_at: "2026-08-26T12:00:00.000Z",
      },
      {
        id: "evt-flush-undo",
        environment: tip.environment,
        household_id: tip.householdId,
        member_id: identity.memberId,
        idempotency_key: "flush-undo",
        confirmation_id: "flush-undo",
        identity_hash: undoReceipt.identityHash,
        base_revision: previous.revision,
        result_revision: tip.revision,
        ledger_scope: undoRef.ledgerScope,
        command_type: undoRef.commandType,
        payload_json: {
          ...undoRef.commandPayload,
          materializationFacts: extractMaterializationFacts(tip, undoReceipt.postedIds, {
            acceptedAt: undoReceipt.acceptedAt,
          }),
        },
        created_at: "2026-08-26T12:01:00.000Z",
      },
    ];
    const materialized = await buildSnapshotFromEvents(events, catalogBaseFromSnapshot(tip));
    expect(await financialAuditHash(materialized)).toBe(await financialAuditHash(tip));
    expect(materialized.tombstones?.some((row) => row.id === posted.postedIds[0])).toBe(true);
    expect(materialized.transactions.some((row) => row.id === posted.postedIds[0])).toBe(false);
  });

  it("applies the later ordered same-row event without opening a chooser", async () => {
    const previous = googleHousehold();
    const posted = postEntry(previous, grocery("conflict row", "8.00"));
    const txId = posted.postedIds[0]!;
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "conflict-base",
      postedIds: posted.postedIds,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    const baseEvent = eventFromPost({
      previous,
      posted: { ...posted, household: accepted.household },
      confirmationId: "conflict-base",
      index: 0,
    });

    const divergent = {
      ...posted.household.transactions.find((row) => row.id === txId)!,
      amountCents: 999,
      note: "different amount",
      splits: [{ party: "joint" as const, amountCents: 999 }],
    };
    const remoteAccepted = {
      ...accepted.household,
      revision: accepted.household.revision + 1,
      transactions: accepted.household.transactions.map((row) => (row.id === txId ? divergent : row)),
    };
    const remoteAuditHash = await financialAuditHashForScope(remoteAccepted, "shared", identity.memberId);
    expect(remoteAuditHash).not.toBe(
      await financialAuditHashForScope(accepted.household, "shared", identity.memberId),
    );
    const conflictEvent: ContinuityCommandEvent = {
      ...baseEvent,
      id: "evt-conflict",
      idempotency_key: "conflict-remote",
      confirmation_id: "conflict-remote",
      identity_hash: "remote-hash",
      base_revision: accepted.household.revision,
      result_revision: accepted.household.revision + 1,
      payload_json: {
        ...baseEvent.payload_json,
        confirmationId: "conflict-remote",
        identityHash: "remote-hash",
        auditHash: remoteAuditHash,
        revision: accepted.household.revision + 1,
        materializationFacts: { transactions: [divergent] },
      },
      created_at: "2026-08-26T12:02:00.000Z",
    };

    const materialized = await buildSnapshotFromEvents(
      [baseEvent, conflictEvent],
      catalogBaseFromSnapshot(previous),
    );
    expect(materialized.conflicts?.some((row) => !row.resolved)).toBe(false);
    expect(materialized.transactions.find((row) => row.id === txId)?.amountCents).toBe(999);

    const direct = await applyCommandEventLocally({
      local: accepted.household,
      event: conflictEvent,
      memberId: identity.memberId,
    });
    expect(direct.ok).toBe(true);
    if (!direct.ok) throw new Error("later same-row event should apply");
    expect(direct.duplicate).toBe(false);
    expect(direct.household.transactions.find((row) => row.id === txId)?.amountCents).toBe(999);
    expect(direct.household.conflicts?.some((row) => !row.resolved)).toBe(false);

    const forged = await applyCommandEventLocally({
      local: accepted.household,
      event: {
        ...conflictEvent,
        payload_json: { ...conflictEvent.payload_json, auditHash: "0".repeat(64) },
      },
      memberId: identity.memberId,
    });
    expect(forged).toEqual({ ok: false, reason: "audit-hash-mismatch", fallback: true });
  });

  it("requests snapshot fallback for a changed append-only id even without an audit hash", async () => {
    const local = googleHousehold();
    const contribution = {
      id: "GOAL-CONTRIB-IMMUTABLE",
      goalId: "GOAL-IMMUTABLE",
      memberId: identity.memberId,
      amountCents: 500,
      date: "2026-08-25" as const,
      transferId: null,
      createdAt: "2026-08-25T12:00:00.000Z",
      updatedAt: "2026-08-25T12:00:00.000Z",
    };
    const withContribution = { ...local, goalContributions: [contribution] };
    const event: ContinuityCommandEvent = {
      id: "evt-immutable-rewrite",
      environment: local.environment,
      household_id: local.householdId,
      member_id: identity.memberId,
      idempotency_key: "immutable-rewrite",
      confirmation_id: "immutable-rewrite",
      identity_hash: "immutable-rewrite",
      base_revision: local.revision,
      result_revision: local.revision + 1,
      ledger_scope: "shared",
      command_type: "postEntry",
      payload_json: {
        confirmationId: "immutable-rewrite",
        identityHash: "immutable-rewrite",
        commandKind: "postEntry",
        postedIds: [contribution.id],
        auditHash: "",
        revision: local.revision + 1,
        acceptedAt: "2026-08-25T12:01:00.000Z",
        materializationFacts: { goalContributions: [{ ...contribution, amountCents: 900 }] },
      },
      created_at: "2026-08-25T12:01:00.000Z",
    };

    const result = await applyCommandEventLocally({ local: withContribution, event, memberId: identity.memberId });
    expect(result).toEqual({ ok: false, reason: "immutable-row-divergence", fallback: true });
  });

  it("extractMaterializationFacts stays bounded to posted ids", () => {
    let household = googleHousehold();
    for (let index = 0; index < 5; index += 1) {
      household = postEntry(household, grocery(`extra ${index}`, "1.00")).household;
    }
    const target = postEntry(household, grocery("target", "2.50")).household;
    const postedId = target.transactions.at(-1)!.id;
    const facts = extractMaterializationFacts(target, [postedId]);
    expect(facts.transactions).toHaveLength(1);
    expect(facts.transactions?.[0]?.id).toBe(postedId);
    expect(JSON.stringify(facts)).not.toMatch(/extra 0/);
  });

  it("rebuilds founding, signing, and amendment commands from the shared command log", async () => {
    const events: ContinuityCommandEvent[] = [];
    const refs: ContinuityCommandRef[] = [];
    let previous = googleHousehold();

    const founded = await acceptedCharterEvent({
      previous,
      committed: foundHouseholdCharter(previous, {
        memberId: "MEM-002",
        custodianMemberId: "MEM-001",
        purpose: "Keep the household steady without overwork.",
        splitRule: "remainder",
        splitNote: "One income covers what it covers; the other closes the rest.",
        ceilingKind: "hours-per-week",
        ceilingValue: "24",
        cadence: "weekly",
        cadenceWeekday: 0,
        date: "2026-09-01",
      }),
      confirmationId: "charter-found",
      commandKind: "foundHouseholdCharter",
      memberId: "MEM-002",
      index: 0,
    });
    previous = founded.household;
    events.push(founded.event);
    refs.push(founded.ref);

    const signed = await acceptedCharterEvent({
      previous,
      committed: signHouseholdCharter(previous, { memberId: "MEM-001", at: "2026-09-01T12:01:00.000Z" }),
      confirmationId: "charter-sign",
      commandKind: "signHouseholdCharter",
      memberId: "MEM-001",
      index: 1,
    });
    previous = signed.household;
    events.push(signed.event);
    refs.push(signed.ref);

    const proposedCommit = proposeCharterAmendment(previous, {
      memberId: "MEM-002",
      field: "purpose",
      toText: "Keep a shared home and protect both people's time.",
    });
    const proposed = await acceptedCharterEvent({
      previous,
      committed: proposedCommit,
      confirmationId: "charter-propose",
      commandKind: "proposeCharterAmendment",
      memberId: "MEM-002",
      index: 2,
    });
    previous = proposed.household;
    events.push(proposed.event);
    refs.push(proposed.ref);

    const confirmed = await acceptedCharterEvent({
      previous,
      committed: confirmCharterAmendment(previous, {
        memberId: "MEM-001",
        amendmentId: proposedCommit.postedIds[0]!,
      }),
      confirmationId: "charter-confirm",
      commandKind: "confirmCharterAmendment",
      memberId: "MEM-001",
      index: 3,
    });
    const tip = confirmed.household;
    events.push(confirmed.event);
    refs.push(confirmed.ref);

    expect(events.every((event) => event.ledger_scope === "shared")).toBe(true);
    expect(events.every((event) => event.payload_json.materializationFacts?.charter)).toBe(true);
    const materialized = await buildSnapshotFromEvents(events, catalogBaseFromSnapshot(tip));
    expect(materialized.charter).toEqual(tip.charter);
    expect(await financialAuditHashForScope(materialized, "shared", "MEM-001"))
      .toBe(await financialAuditHashForScope(tip, "shared", "MEM-001"));

    const primary = primaryCommandRef(refs);
    const compactedPayload = compactedCommandPayload(
      { confirmationIds: refs.map((ref) => ref.confirmationId), commandRefs: refs },
      primary,
      tip,
      "MEM-001",
    ) as ContinuityCommandEventPayload;
    expect(compactedPayload.materializationFacts?.charter).toEqual(tip.charter);
    expect(compactedPayload.postedIds).toEqual(expect.arrayContaining([
      tip.charter!.id,
      "CHARTER-SIGN-MEM-001",
      proposedCommit.postedIds[0]!,
    ]));
    const compactedReplay = await applyCommandEventLocally({
      local: catalogBaseFromSnapshot(tip),
      event: {
        ...confirmed.event,
        base_revision: 0,
        result_revision: tip.revision,
        command_type: primary.commandType,
        payload_json: compactedPayload,
      },
      memberId: "MEM-001",
    });
    expect(compactedReplay.ok).toBe(true);
    if (!compactedReplay.ok) throw new Error(compactedReplay.reason);
    expect(compactedReplay.household.charter).toEqual(tip.charter);
  });
});
