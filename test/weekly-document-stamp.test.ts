import { describe, expect, it } from "vitest";
import {
  acceptHouseholdWrite,
  assembleHousehold,
  catalogHousehold,
  financialAuditHash,
  householdForHerculesContext,
  linkGoogleIdentity,
  mergeShared,
  shapeWeeklyDocumentStamps,
  splitForSync,
  stampWeeklyDocument,
  weeklyDocumentIsComplete,
  weeklyDocumentStampLines,
  type Household,
} from "../src/core/index.ts";
import {
  createMemoryContinuityStore,
  enqueueContinuitySnapshot,
  setContinuityStore,
} from "../src/continuity.ts";
import {
  compactedCommandPayload,
  primaryCommandRef,
  receiptToCommandRef,
  type ContinuityCommandRef,
} from "../src/ledger/continuityCommandLog.ts";
import { buildCommandEventFromReceipt } from "../src/ledger/continuityCommandLogHarness.ts";
import {
  applyCommandEventLocally,
  catalogBaseFromSnapshot,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
  type ContinuityCommandEventPayload,
} from "../src/ledger/materializeSnapshotFromEvents.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

async function acceptStamp(input: {
  previous: Household;
  today: string;
  memberId: string;
  confirmationId: string;
  now: string;
}) {
  const result = stampWeeklyDocument(input.previous, {
    memberId: input.memberId,
    today: input.today,
    now: input.now,
  });
  return acceptHouseholdWrite({
    previous: input.previous,
    candidate: result.household,
    confirmationId: input.confirmationId,
    commandKind: result.undo.commandKind ?? "stampWeeklyDocument",
    postedIds: result.postedIds,
    actingMemberId: input.memberId,
    adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
  });
}

describe("weekly document durable stamps", () => {
  it("creates only the acting member's nonfinancial stamp and one stamp completes the week", async () => {
    const household = catalogHousehold("development");
    const beforeAudit = await financialAuditHash(household);
    const accepted = await acceptStamp({
      previous: household,
      today: "2026-09-02",
      memberId: BIANCA,
      confirmationId: "weekly-bianca",
      now: "2026-09-02T14:00:00.000Z",
    });

    expect(accepted.ok).toBe(true);
    expect(accepted.postedIds).toHaveLength(1);
    expect(accepted.postedIds[0]).toMatch(/^WSTAMP-/);
    expect(accepted.household.weeklyDocumentStamps).toEqual([{
      id: accepted.postedIds[0],
      weekStart: "2026-08-30",
      memberId: BIANCA,
      stampedAt: "2026-09-02T14:00:00.000Z",
      createdAt: "2026-09-02T14:00:00.000Z",
      updatedAt: "2026-09-02T14:00:00.000Z",
    }]);
    expect(weeklyDocumentIsComplete(accepted.household, "2026-09-02")).toBe(true);
    expect(weeklyDocumentStampLines(accepted.household, "2026-09-02")).toEqual([
      expect.objectContaining({ memberId: BIANCA, stamp: expect.objectContaining({ memberId: BIANCA }) }),
      expect.objectContaining({ memberId: JONATHAN, stamp: null }),
    ]);
    expect(await financialAuditHash(accepted.household)).toBe(beforeAudit);
    expect(accepted.household.commandReceipts.at(-1)).toMatchObject({
      commandKind: "stampWeeklyDocument",
      materializationHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });

    expect(() => stampWeeklyDocument(accepted.household, {
      memberId: BIANCA,
      today: "2026-09-02",
    })).toThrow("You already stamped this weekly page.");
    expect(() => stampWeeklyDocument(household, {
      memberId: "MEM-NOT-HERE",
      today: "2026-09-02",
    })).toThrow("That active household member is not available.");

    const wrongActorResult = stampWeeklyDocument(household, {
      memberId: BIANCA,
      today: "2026-09-02",
      now: "2026-09-02T14:00:00.000Z",
    });
    const wrongActor = await acceptHouseholdWrite({
      previous: household,
      candidate: wrongActorResult.household,
      confirmationId: "weekly-wrong-actor",
      commandKind: "stampWeeklyDocument",
      postedIds: wrongActorResult.postedIds,
      actingMemberId: JONATHAN,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(wrongActor.ok).toBe(false);
    expect(wrongActor.userMessage).toBe("You can stamp only your own weekly line. Nothing changed.");

    const extraCandidate = structuredClone(wrongActorResult.household);
    extraCandidate.weeklyDocumentStamps!.push({
      ...extraCandidate.weeklyDocumentStamps![0]!,
      id: "WSTAMP-EXTRA",
      memberId: JONATHAN,
    });
    const extraUnposted = await acceptHouseholdWrite({
      previous: household,
      candidate: extraCandidate,
      confirmationId: "weekly-extra-unposted",
      commandKind: "stampWeeklyDocument",
      postedIds: wrongActorResult.postedIds,
      actingMemberId: BIANCA,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(extraUnposted.ok).toBe(false);

    const householdWithPrior = structuredClone(accepted.household);
    const nextWeek = stampWeeklyDocument(householdWithPrior, {
      memberId: BIANCA,
      today: "2026-09-07",
      now: "2026-09-07T14:00:00.000Z",
    });
    nextWeek.household.weeklyDocumentStamps![0]!.stampedAt = "2026-09-02T13:59:00.000Z";
    const rewrittenPrior = await acceptHouseholdWrite({
      previous: householdWithPrior,
      candidate: nextWeek.household,
      confirmationId: "weekly-rewritten-prior",
      commandKind: "stampWeeklyDocument",
      postedIds: nextWeek.postedIds,
      actingMemberId: BIANCA,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(rewrittenPrior.ok).toBe(false);

    expect(() => stampWeeklyDocument(household, {
      memberId: BIANCA,
      today: "2026-09-03",
      now: "2026-09-02T14:00:00.000Z",
    })).toThrow("The weekly page must be stamped on today's Toronto date.");
  });

  it("keeps independent two-phone stamps through Shared convergence and assembly", () => {
    const base = catalogHousehold("development");
    const bianca = stampWeeklyDocument(structuredClone(base), {
      memberId: BIANCA,
      today: "2026-09-02",
      now: "2026-09-02T14:00:00.000Z",
    }).household;
    const jonathan = stampWeeklyDocument(structuredClone(base), {
      memberId: JONATHAN,
      today: "2026-09-02",
      now: "2026-09-02T15:00:00.000Z",
    }).household;
    const biancaSplit = splitForSync(bianca, BIANCA);
    const jonathanSplit = splitForSync(jonathan, JONATHAN);

    expect(biancaSplit.personal).not.toHaveProperty("weeklyDocumentStamps");
    const merged = mergeShared(biancaSplit.shared, jonathanSplit.shared);
    expect(merged.weeklyDocumentStamps?.map((row) => row.memberId).sort()).toEqual([BIANCA, JONATHAN]);
    const assembled = assembleHousehold(merged, biancaSplit.personal);
    expect(weeklyDocumentStampLines(assembled, "2026-09-02").every((line) => line.stamp)).toBe(true);

    const rewritten = structuredClone(biancaSplit.shared);
    rewritten.weeklyDocumentStamps![0]!.memberId = JONATHAN;
    expect(() => mergeShared(biancaSplit.shared, rewritten))
      .toThrow("A weekly stamp changed after it was accepted.");
  });

  it("fails malformed facts closed while preserving concurrent unique facts", () => {
    const household = catalogHousehold("development");
    const valid = stampWeeklyDocument(household, {
      memberId: BIANCA,
      today: "2026-09-02",
      now: "2026-09-02T14:00:00.000Z",
    }).household.weeklyDocumentStamps![0]!;
    const concurrent = { ...valid, id: "WSTAMP-CONCURRENT", stampedAt: "2026-09-02T13:00:00.000Z" };
    const shaped = shapeWeeklyDocumentStamps([
      valid,
      concurrent,
      { ...valid, id: "BAD", memberId: JONATHAN },
      { ...valid, id: "WSTAMP-WRONG-DAY", weekStart: "2026-09-01" },
      { ...valid, id: "WSTAMP-UNKNOWN", memberId: "MEM-NOT-HERE" },
    ], household.members);
    expect(shaped).toHaveLength(2);
    const withConcurrent = { ...household, weeklyDocumentStamps: shaped };
    expect(weeklyDocumentStampLines(withConcurrent, "2026-09-02")[0]?.stamp?.id).toBe("WSTAMP-CONCURRENT");
    expect(() => shapeWeeklyDocumentStamps([
      valid,
      { ...valid, memberId: JONATHAN },
    ], household.members)).toThrow("A weekly stamp changed after it was accepted.");
  });

  it("replays the bounded Shared fact and rejects wrong actor, kind, hash, and malformed rows", async () => {
    const deviceA = catalogHousehold("development");
    const deviceB = structuredClone(deviceA);
    const accepted = await acceptStamp({
      previous: deviceA,
      today: "2026-09-02",
      memberId: BIANCA,
      confirmationId: "weekly-replay",
      now: "2026-09-02T14:00:00.000Z",
    });
    const event = buildCommandEventFromReceipt({
      household: accepted.household,
      confirmationId: "weekly-replay",
      baseRevision: deviceA.revision,
      memberId: BIANCA,
    });
    expect(event.ledger_scope).toBe("shared");
    expect(event.payload_json.materializationFacts?.weeklyDocumentStamps).toHaveLength(1);
    const replayed = await applyCommandEventLocally({ local: deviceB, event, memberId: JONATHAN });
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) throw new Error(replayed.reason);
    expect(replayed.household.weeklyDocumentStamps).toHaveLength(1);

    const historicalEvent = { ...event, created_at: "2026-09-02T14:05:00.000Z" };
    const afterDeactivation = structuredClone(deviceB);
    const historicalActor = afterDeactivation.members.find((member) => member.id === BIANCA)!;
    historicalActor.active = false;
    historicalActor.updatedAt = "2026-09-03T12:00:00.000Z";
    const historicalReplay = await applyCommandEventLocally({
      local: afterDeactivation,
      event: historicalEvent,
      memberId: JONATHAN,
    });
    expect(historicalReplay.ok).toBe(true);

    const personalFacts = extractMaterializationFacts(accepted.household, accepted.postedIds, {
      ledgerScope: "personal",
      memberId: BIANCA,
      commandKind: "stampWeeklyDocument",
    });
    expect(personalFacts.weeklyDocumentStamps).toBeUndefined();

    const wrongActor = structuredClone(event);
    wrongActor.member_id = JONATHAN;
    expect(await applyCommandEventLocally({ local: deviceB, event: wrongActor, memberId: JONATHAN }))
      .toEqual({ ok: false, reason: "weekly-stamp-authority-or-hash-mismatch", fallback: true });

    const wrongKind = structuredClone(event);
    wrongKind.command_type = "postEntry";
    wrongKind.payload_json.commandKind = "postEntry";
    expect(await applyCommandEventLocally({ local: deviceB, event: wrongKind, memberId: JONATHAN }))
      .toEqual({ ok: false, reason: "weekly-stamp-authority-or-hash-mismatch", fallback: true });

    const tampered = structuredClone(event);
    tampered.payload_json.materializationFacts!.weeklyDocumentStamps![0]!.weekStart = "2026-09-06";
    expect(await applyCommandEventLocally({ local: deviceB, event: tampered, memberId: JONATHAN }))
      .toEqual({ ok: false, reason: "weekly-stamp-authority-or-hash-mismatch", fallback: true });

    const malformed = structuredClone(event);
    malformed.payload_json.materializationFacts!.weeklyDocumentStamps![0]!.weekStart = "2026-09-01";
    expect(await applyCommandEventLocally({ local: deviceB, event: malformed, memberId: JONATHAN }))
      .toEqual({ ok: false, reason: "weekly-stamp-invalid", fallback: true });
  });

  it("retains multiple stamp commands in compacted replay and keeps stamps out of Hercules", async () => {
    const base = catalogHousehold("development");
    const first = await acceptStamp({
      previous: base,
      today: "2026-09-02",
      memberId: BIANCA,
      confirmationId: "weekly-one",
      now: "2026-09-02T14:00:00.000Z",
    });
    const second = await acceptStamp({
      previous: first.household,
      today: "2026-09-07",
      memberId: BIANCA,
      confirmationId: "weekly-two",
      now: "2026-09-07T14:00:00.000Z",
    });
    const refs: ContinuityCommandRef[] = [
      receiptToCommandRef({
        household: first.household,
        receipt: first.household.commandReceipts.find((row) => row.confirmationId === "weekly-one")!,
        baseRevision: base.revision,
      }),
      receiptToCommandRef({
        household: second.household,
        receipt: second.household.commandReceipts.find((row) => row.confirmationId === "weekly-two")!,
        baseRevision: first.household.revision,
      }),
    ];
    const primary = primaryCommandRef(refs);
    const direct = buildCommandEventFromReceipt({
      household: second.household,
      confirmationId: "weekly-two",
      baseRevision: first.household.revision,
      memberId: BIANCA,
    });
    const payload = compactedCommandPayload(
      { confirmationIds: refs.map((row) => row.confirmationId), commandRefs: refs },
      primary,
      second.household,
      BIANCA,
    ) as ContinuityCommandEventPayload;
    const compacted: ContinuityCommandEvent = {
      ...direct,
      base_revision: base.revision,
      result_revision: second.household.revision,
      command_type: primary.commandType,
      payload_json: payload,
    };
    const replayed = await applyCommandEventLocally({ local: base, event: compacted, memberId: JONATHAN });
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) throw new Error(replayed.reason);
    expect(replayed.household.weeklyDocumentStamps).toHaveLength(2);

    const catalog = catalogBaseFromSnapshot(second.household);
    expect(catalog.weeklyDocumentStamps).toEqual([]);
    expect(householdForHerculesContext(second.household, BIANCA, "household").weeklyDocumentStamps).toEqual([]);
  });

  it("binds outbox transport to the signed-in continuity member", async () => {
    const identity = { email: "bianca@example.com", subject: "google-sub-bianca" };
    const linked = linkGoogleIdentity(catalogHousehold("development"), {
      memberId: BIANCA,
      email: identity.email,
      subject: identity.subject,
      displayName: "Bianca",
      grantedScopes: ["openid", "email"],
    }).household;
    const accepted = await acceptStamp({
      previous: linked,
      today: "2026-09-02",
      memberId: JONATHAN,
      confirmationId: "weekly-wrong-google-member",
      now: "2026-09-02T14:00:00.000Z",
    });
    setContinuityStore(createMemoryContinuityStore());
    try {
      expect(() => enqueueContinuitySnapshot({
        household: accepted.household,
        identity,
        expectedRevision: linked.revision,
        confirmationId: "weekly-wrong-google-member",
      })).toThrow("This Google member can share only their own weekly stamp.");
    } finally {
      setContinuityStore(null);
    }
  });
});
