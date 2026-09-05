import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  acceptHouseholdWrite,
  approvalsFor,
  approveOnboardingProposal,
  approveOnboardingReady,
  assembleHousehold,
  bothApproved,
  catalogHousehold,
  compileHousehold,
  emptyMemberOnboardingProgress,
  mergeOnboardingApprovals,
  mergeShared,
  onboardingCompletionDigest,
  resolveAction,
  shapeOnboardingApprovals,
  splitForSync,
  type Household,
} from "../src/core/index.ts";
import {
  commandMaterializationFacts,
  financialAuditHashForScope,
  sha256Hex,
} from "../src/core/commandIdentity.ts";
import {
  applyCommandEventLocally,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
} from "../src/ledger/materializeSnapshotFromEvents.ts";
import {
  compactedCommandPayload,
  type ContinuityCommandRef,
} from "../src/ledger/continuityCommandLog.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const PROPOSAL_A = `proposal-v1-${"a".repeat(64)}`;
const PROPOSAL_B = `proposal-v1-${"b".repeat(64)}`;
const READY_A = `ready-v1-${"c".repeat(64)}`;

function readyHousehold(): Household {
  const household = catalogHousehold("development");
  const at = "2026-09-05T02:00:00.000Z";
  household.householdOnboarding = {
    id: `ONBOARDING-${household.environment}-${household.householdId}`,
    environment: household.environment,
    householdId: household.householdId,
    registryVersion: 1,
    state: "active",
    proposedByMemberId: BIANCA,
    proposedAt: "2026-09-05T01:45:00.000Z",
    handshakeExpiresAt: at,
    confirmedByMemberIds: [BIANCA, JONATHAN],
    startedAt: at,
    stoppedAt: null,
    stoppedByMemberIds: [],
    stoppedSolo: false,
    forcedUnlock: false,
    completedAt: null,
    completionDigest: null,
    createdAt: "2026-09-05T01:45:00.000Z",
    updatedAt: at,
  };
  household.members = household.members.map((member) => {
    const progress = emptyMemberOnboardingProgress({
      environment: household.environment,
      householdId: household.householdId,
      memberId: member.id,
    });
    progress.rows = progress.rows.map((row) => ({ ...row, acknowledgedAt: at, lastSafeResumePoint: row.chapterId }));
    progress.updatedAt = at;
    return { ...member, onboardingProgress: progress };
  });
  return household;
}

function approveProposal(household: Household, memberId: string, digest = PROPOSAL_A) {
  return approveOnboardingProposal(household, { memberId, createdBy: memberId, digest });
}

async function approvalEvent(
  base: Household,
  saved: ReturnType<typeof approveOnboardingProposal>,
): Promise<ContinuityCommandEvent> {
  const facts = extractMaterializationFacts(saved.household, saved.postedIds, {
    ledgerScope: "shared",
    memberId: BIANCA,
    commandKind: "approveOnboardingProposal",
  });
  const auditHash = await financialAuditHashForScope(base, "shared", BIANCA);
  return {
    id: "EVT-APPROVAL",
    environment: "development",
    household_id: base.householdId,
    member_id: BIANCA,
    idempotency_key: "CONF-APPROVAL",
    confirmation_id: "CONF-APPROVAL",
    identity_hash: "identity",
    base_revision: base.revision,
    result_revision: base.revision + 1,
    ledger_scope: "shared",
    command_type: "approveOnboardingProposal",
    payload_json: {
      confirmationId: "CONF-APPROVAL",
      identityHash: "identity",
      commandKind: "approveOnboardingProposal",
      postedIds: saved.postedIds,
      auditHash,
      revision: base.revision + 1,
      acceptedAt: "2026-09-05T03:00:00.000Z",
      materializationFacts: facts,
      materializationHash: await sha256Hex(commandMaterializationFacts(facts)),
    },
    created_at: "2026-09-05T03:00:00.000Z",
  };
}

describe("onboarding approval contract", () => {
  it("records only the active acting member's exact approval", () => {
    const household = catalogHousehold("development");
    expect(() => approveOnboardingProposal(household, {
      memberId: BIANCA,
      createdBy: JONATHAN,
      digest: PROPOSAL_A,
    })).toThrow("Only you can approve for yourself.");
    expect(() => approveOnboardingReady(household, {
      memberId: "MEM-GHOST",
      createdBy: "MEM-GHOST",
      digest: READY_A,
    })).toThrow("Only you can approve for yourself.");
    expect(() => approveOnboardingProposal(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      digest: "",
    })).toThrow("Review the current version before approving it.");

    const saved = approveProposal(household, BIANCA);
    expect(household.onboardingApprovals).toBeUndefined();
    expect(saved.undo.commandKind).toBe("approveOnboardingProposal");
    expect(saved.postedIds).toHaveLength(1);
    expect(saved.household.onboardingApprovals).toEqual([{
      id: saved.postedIds[0],
      householdId: household.householdId,
      memberId: BIANCA,
      scope: "proposal",
      digest: PROPOSAL_A,
      approvedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }]);
    expect(Object.keys(saved.household.onboardingApprovals![0]!).sort()).toEqual([
      "approvedAt", "digest", "householdId", "id", "memberId", "scope",
    ]);
  });

  it("keeps old approvals auditable when a meaning-bearing digest changes", () => {
    const first = approveProposal(catalogHousehold("development"), BIANCA, PROPOSAL_A);
    const edited = approveProposal(first.household, BIANCA, PROPOSAL_B);
    expect(edited.household.onboardingApprovals).toHaveLength(2);
    expect(approvalsFor(edited.household, "proposal", PROPOSAL_A)).toHaveLength(1);
    expect(approvalsFor(edited.household, "proposal", PROPOSAL_B)).toHaveLength(1);
    expect(bothApproved(edited.household, "proposal", PROPOSAL_A)).toBe(false);
    expect(bothApproved(edited.household, "proposal", PROPOSAL_B)).toBe(false);

    const agreed = approveProposal(edited.household, JONATHAN, PROPOSAL_B);
    expect(bothApproved(agreed.household, "proposal", PROPOSAL_B)).toBe(true);
    expect(bothApproved(agreed.household, "proposal", PROPOSAL_A)).toBe(false);
  });

  it("keeps proposal and Ready authority separate", () => {
    const household = readyHousehold();
    const digest = onboardingCompletionDigest(household);
    const bianca = approveOnboardingReady(household, {
      memberId: BIANCA,
      createdBy: BIANCA,
      digest,
    });
    const bothReady = approveOnboardingReady(bianca.household, {
      memberId: JONATHAN,
      createdBy: JONATHAN,
      digest,
    });
    expect(bothApproved(bothReady.household, "ready", digest)).toBe(true);
    expect(bothApproved(bothReady.household, "proposal", digest)).toBe(false);
    expect(bothApproved(bothReady.household, "ready", PROPOSAL_A)).toBe(false);
  });

  it("requires exactly the two active household seats", () => {
    const oneSeat = {
      ...catalogHousehold("development"),
      members: catalogHousehold("development").members.map((member) => (
        member.id === JONATHAN ? { ...member, active: false } : member
      )),
    };
    const approved = approveProposal(oneSeat, BIANCA);
    expect(approvalsFor(approved.household, "proposal", PROPOSAL_A)).toHaveLength(1);
    expect(bothApproved(approved.household, "proposal", PROPOSAL_A)).toBe(false);
  });

  it("merges simultaneous offline approvals without loss or order dependence", () => {
    const base = catalogHousehold("development");
    const bianca = approveProposal(base, BIANCA);
    const jonathan = approveProposal(base, JONATHAN);
    const biancaParts = splitForSync(bianca.household, BIANCA);
    const jonathanParts = splitForSync(jonathan.household, JONATHAN);
    expect("onboardingApprovals" in biancaParts.personal).toBe(false);

    const forward = mergeShared(biancaParts.shared, jonathanParts.shared);
    const reverse = mergeShared(jonathanParts.shared, biancaParts.shared);
    expect(forward.onboardingApprovals).toEqual(reverse.onboardingApprovals);
    expect(forward.onboardingApprovals).toHaveLength(2);
    expect(bothApproved(assembleHousehold(forward, biancaParts.personal), "proposal", PROPOSAL_A)).toBe(true);
  });

  it("rejects a same-id collision instead of choosing a member or digest", () => {
    const base = catalogHousehold("development");
    const saved = approveProposal(base, BIANCA);
    const row = saved.household.onboardingApprovals![0]!;
    expect(() => mergeOnboardingApprovals([row], [{ ...row, digest: PROPOSAL_B }]))
      .toThrow("Conflicting onboarding approval history.");
  });

  it("fails closed on malformed or over-broad approval records", () => {
    const household = catalogHousehold("development");
    const valid = approveProposal(household, BIANCA).household.onboardingApprovals![0]!;
    expect(shapeOnboardingApprovals([
      valid,
      { ...valid, id: "ONB-APP-BAD-SCOPE", scope: "fund-config" },
      { ...valid, id: "ONB-APP-EXTRA", note: "private source" },
      { ...valid, id: "ONB-APP-WRONG-HOUSE", householdId: "HH-WRONG" },
    ], household.householdId)).toEqual([valid]);
  });

  it("changes no accepted money, plan, journal, or Fund approval", async () => {
    const household = catalogHousehold("development");
    const beforeJournal = compileHousehold(household).entries;
    const beforeHash = await financialAuditHashForScope(household, "shared", BIANCA);
    const saved = approveProposal(household, BIANCA);
    expect(compileHousehold(saved.household).entries).toEqual(beforeJournal);
    expect(saved.household.budgetPlans).toEqual(household.budgetPlans);
    expect(saved.household.householdFund).toEqual(household.householdFund);
    expect(await financialAuditHashForScope(saved.household, "shared", BIANCA)).toBe(beforeHash);
  });

  it("keeps chat text outside approval authority", () => {
    const household = catalogHousehold("development");
    expect(resolveAction(household, {
      kind: "approve",
      chapterId: "ch-11-plan",
      memberId: BIANCA,
      revision: String(household.revision),
      origin: "affirmative",
      at: "2026-09-05T03:00:00.000Z",
    })).toEqual({ kind: "refused", reason: "Typed text cannot perform that action." });
    expect(resolveAction(household, {
      kind: "approve",
      chapterId: "ch-11-plan",
      memberId: BIANCA,
      revision: String(household.revision),
      origin: "button",
      at: "2026-09-05T03:00:00.000Z",
    })).toEqual({ kind: "command", command: "approve" });
  });

  it("accepts a bounded approval through the books boundary", async () => {
    const base = catalogHousehold("development");
    const saved = approveProposal(base, BIANCA);
    const beforeHash = await financialAuditHashForScope(base, "shared", BIANCA);
    const outcome = await acceptHouseholdWrite({
      previous: base,
      candidate: saved.household,
      confirmationId: "CONF-ACCEPT-APPROVAL",
      commandKind: saved.undo.commandKind,
      postedIds: saved.postedIds,
      actingMemberId: BIANCA,
      adapters: {
        persist: async () => undefined,
        ingest: async () => ({ ok: true }),
        validateCandidate: async () => ({ ok: true }),
        restoreIngest: async () => undefined,
      },
    });
    expect(outcome.ok).toBe(true);
    expect(await financialAuditHashForScope(outcome.household, "shared", BIANCA)).toBe(beforeHash);
    expect(outcome.household.commandReceipts.at(-1)).toMatchObject({
      confirmationId: "CONF-ACCEPT-APPROVAL",
      commandKind: "approveOnboardingProposal",
      postedIds: saved.postedIds,
      materializationHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("refuses a forged actor, disguised command, or bundled state change before persistence", async () => {
    const base = catalogHousehold("development");
    const saved = approveProposal(base, BIANCA);
    let persisted = false;
    const adapters = {
      persist: async () => { persisted = true; },
      ingest: async () => ({ ok: true }),
      validateCandidate: async () => ({ ok: true }),
      restoreIngest: async () => undefined,
    };
    const attempt = (candidate: Household, commandKind: string | undefined, actor?: string) => acceptHouseholdWrite({
      previous: base,
      candidate,
      confirmationId: `CONF-FORGED-${commandKind ?? "NONE"}-${actor ?? "NONE"}`,
      commandKind,
      postedIds: saved.postedIds,
      actingMemberId: actor,
      adapters,
    });
    const wrongActor = await attempt(saved.household, saved.undo.commandKind, JONATHAN);
    const missingActor = await attempt(saved.household, saved.undo.commandKind);
    const disguised = await attempt(saved.household, "commit", BIANCA);
    const bundled = await attempt({ ...saved.household, name: "Changed too" }, saved.undo.commandKind, BIANCA);
    const activityWithPrivateField: Household = {
      ...saved.household,
      activity: saved.household.activity.map((row, index) => (
        index === saved.household.activity.length - 1
          ? { ...row, privateNote: "must not sync" }
          : row
      )) as Household["activity"],
    };
    const smuggledActivity = await attempt(activityWithPrivateField, saved.undo.commandKind, BIANCA);
    for (const outcome of [wrongActor, missingActor, disguised, bundled, smuggledActivity]) {
      expect(outcome).toMatchObject({
        ok: false,
        postedNothing: true,
        userMessage: "Only you can approve for yourself.",
      });
    }
    const duplicatePostedId = await acceptHouseholdWrite({
      previous: base,
      candidate: saved.household,
      confirmationId: "CONF-DUPLICATE-POSTED-ID",
      commandKind: saved.undo.commandKind,
      postedIds: [saved.postedIds[0]!, saved.postedIds[0]!],
      actingMemberId: BIANCA,
      adapters,
    });
    expect(duplicatePostedId).toMatchObject({
      ok: false,
      postedNothing: true,
      userMessage: "Only you can approve for yourself.",
    });

    const partnerFirst = approveProposal(base, JONATHAN);
    const ownAfterPartner = approveProposal(partnerFirst.household, BIANCA);
    const partnerId = partnerFirst.postedIds[0]!;
    const replacedPartner: Household = {
      ...ownAfterPartner.household,
      onboardingApprovals: ownAfterPartner.household.onboardingApprovals!.map((row) => (
        row.id === partnerId ? { ...row, digest: PROPOSAL_B } : row
      )),
    };
    const removedPartner: Household = {
      ...ownAfterPartner.household,
      onboardingApprovals: ownAfterPartner.household.onboardingApprovals!.filter((row) => row.id !== partnerId),
    };
    for (const [index, candidate] of [replacedPartner, removedPartner].entries()) {
      const outcome = await acceptHouseholdWrite({
        previous: partnerFirst.household,
        candidate,
        confirmationId: `CONF-PARTNER-HISTORY-${index}`,
        commandKind: ownAfterPartner.undo.commandKind,
        postedIds: ownAfterPartner.postedIds,
        actingMemberId: BIANCA,
        adapters,
      });
      expect(outcome).toMatchObject({
        ok: false,
        postedNothing: true,
        userMessage: "Only you can approve for yourself.",
      });
    }
    expect(persisted).toBe(false);
  });

  it("replays an approval command event and rejects forged materialization", async () => {
    const base = catalogHousehold("development");
    const saved = approveProposal(base, BIANCA);
    const event = await approvalEvent(base, saved);
    const applied = await applyCommandEventLocally({ local: base, event, memberId: BIANCA });
    expect(applied).toEqual(expect.objectContaining({ ok: true, duplicate: false }));
    if (applied.ok) expect(approvalsFor(applied.household, "proposal", PROPOSAL_A)).toHaveLength(1);

    const wrongMember = await applyCommandEventLocally({
      local: base,
      event: { ...event, member_id: JONATHAN },
      memberId: JONATHAN,
    });
    expect(wrongMember).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });

    const missing = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        payload_json: {
          ...event.payload_json,
          materializationFacts: {},
          materializationHash: await sha256Hex(commandMaterializationFacts({})),
        },
      },
      memberId: BIANCA,
    });
    expect(missing).toEqual({ ok: false, reason: "onboarding-approval-missing", fallback: true });

    const extraRows = saved.household.onboardingApprovals!.map((row) => ({ ...row, sourceAccountId: "ACC-VISA" }));
    const extra = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        payload_json: {
          ...event.payload_json,
          materializationFacts: { onboardingApprovals: extraRows },
          materializationHash: await sha256Hex(commandMaterializationFacts({
            onboardingApprovals: saved.household.onboardingApprovals,
          })),
        },
      },
      memberId: BIANCA,
    });
    expect(extra).toEqual({ ok: false, reason: "onboarding-approval-invalid", fallback: true });

    const wrongScope = await applyCommandEventLocally({
      local: base,
      event: {
        ...event,
        command_type: "approveOnboardingReady",
        payload_json: { ...event.payload_json, commandKind: "approveOnboardingReady" },
      },
      memberId: BIANCA,
    });
    expect(wrongScope).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });

    const divergentLocal: Household = {
      ...base,
      onboardingApprovals: saved.household.onboardingApprovals!.map((row) => ({
        ...row,
        digest: PROPOSAL_B,
      })),
    };
    const historyConflict = await applyCommandEventLocally({
      local: divergentLocal,
      event,
      memberId: BIANCA,
    });
    expect(historyConflict).toEqual({
      ok: false,
      reason: "onboarding-approval-history-conflict",
      fallback: true,
    });

    const identicalLocal: Household = {
      ...base,
      onboardingApprovals: saved.household.onboardingApprovals,
    };
    const replayUnderNewConfirmation = await applyCommandEventLocally({
      local: identicalLocal,
      event: {
        ...event,
        confirmation_id: "CONF-DIFFERENT",
        idempotency_key: "CONF-DIFFERENT",
        identity_hash: "identity-different",
        payload_json: {
          ...event.payload_json,
          confirmationId: "CONF-DIFFERENT",
          identityHash: "identity-different",
        },
      },
      memberId: BIANCA,
    });
    expect(replayUnderNewConfirmation).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });
  });

  it("keeps every append-only approval in a compacted command payload", async () => {
    const base = catalogHousehold("development");
    const first = approveProposal(base, BIANCA, PROPOSAL_A);
    const second = approveProposal(first.household, BIANCA, PROPOSAL_B);
    const ref = async (
      confirmationId: string,
      postedIds: string[],
      baseRevision: number,
      resultRevision: number,
      approval: NonNullable<Household["onboardingApprovals"]>[number],
    ): Promise<ContinuityCommandRef> => ({
      idempotencyKey: confirmationId,
      confirmationId,
      identityHash: `identity-${confirmationId}`,
      baseRevision,
      resultRevision,
      ledgerScope: "shared",
      commandType: "approveOnboardingProposal",
      commandPayload: {
        confirmationId,
        identityHash: `identity-${confirmationId}`,
        commandKind: "approveOnboardingProposal",
        postedIds,
        auditHash: "audit",
        revision: resultRevision,
        acceptedAt: "2026-09-05T03:00:00.000Z",
        materializationHash: await sha256Hex(commandMaterializationFacts({ onboardingApprovals: [approval] })),
      },
    });
    const approvals = second.household.onboardingApprovals!;
    const firstRef = await ref("CONF-APP-FIRST", first.postedIds, 0, 1, approvals[0]!);
    const secondRef = await ref("CONF-APP-SECOND", second.postedIds, 1, 2, approvals[1]!);
    const payload = await compactedCommandPayload({
      confirmationIds: [firstRef.confirmationId, secondRef.confirmationId],
      commandRefs: [firstRef, secondRef],
    }, secondRef, second.household, BIANCA);
    const facts = payload.materializationFacts as { onboardingApprovals?: Household["onboardingApprovals"] };
    expect(facts.onboardingApprovals).toHaveLength(2);
    expect(facts.onboardingApprovals?.map((row) => row.digest).sort()).toEqual([PROPOSAL_A, PROPOSAL_B]);
    expect(payload.postedIds).toEqual(expect.arrayContaining([...first.postedIds, ...second.postedIds]));
    expect(payload.materializationHash).toMatch(/^[a-f0-9]{64}$/);

    const compactedEvent: ContinuityCommandEvent = {
      id: "EVT-APPROVAL-COMPACTED",
      environment: "development",
      household_id: base.householdId,
      member_id: BIANCA,
      idempotency_key: secondRef.idempotencyKey,
      confirmation_id: secondRef.confirmationId,
      identity_hash: secondRef.identityHash,
      base_revision: base.revision,
      result_revision: base.revision + 2,
      ledger_scope: "shared",
      command_type: secondRef.commandType,
      payload_json: {
        ...(payload as ContinuityCommandEvent["payload_json"]),
        auditHash: await financialAuditHashForScope(base, "shared", BIANCA),
      },
      created_at: "2026-09-05T03:00:00.000Z",
    };
    const applied = await applyCommandEventLocally({ local: base, event: compactedEvent, memberId: BIANCA });
    expect(applied).toEqual(expect.objectContaining({ ok: true, duplicate: false }));

    const commands = compactedEvent.payload_json.compactedCommands!;
    const tamperedHash = await applyCommandEventLocally({
      local: base,
      event: {
        ...compactedEvent,
        payload_json: {
          ...compactedEvent.payload_json,
          compactedCommands: commands.map((command, index) => (
            index === 0 ? { ...command, materializationHash: "0".repeat(64) } : command
          )),
        },
      },
      memberId: BIANCA,
    });
    expect(tamperedHash).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });

    const reusedId = await applyCommandEventLocally({
      local: base,
      event: {
        ...compactedEvent,
        payload_json: {
          ...compactedEvent.payload_json,
          compactedCommands: commands.map((command, index) => (
            index === 1 ? { ...command, postedIds: [...commands[0]!.postedIds] } : command
          )),
        },
      },
      memberId: BIANCA,
    });
    expect(reusedId).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });

    const duplicateIdWithinCommand = await applyCommandEventLocally({
      local: base,
      event: {
        ...compactedEvent,
        payload_json: {
          ...compactedEvent.payload_json,
          compactedCommands: commands.map((command, index) => (
            index === 0
              ? { ...command, postedIds: [command.postedIds[0]!, command.postedIds[0]!] }
              : command
          )),
        },
      },
      memberId: BIANCA,
    });
    expect(duplicateIdWithinCommand).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });

    const tamperedConfirmationList = await applyCommandEventLocally({
      local: base,
      event: {
        ...compactedEvent,
        payload_json: {
          ...compactedEvent.payload_json,
          compactedConfirmationIds: [secondRef.confirmationId],
        },
      },
      memberId: BIANCA,
    });
    expect(tamperedConfirmationList).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });

    const missingAggregatePostedId = await applyCommandEventLocally({
      local: base,
      event: {
        ...compactedEvent,
        payload_json: {
          ...compactedEvent.payload_json,
          postedIds: compactedEvent.payload_json.postedIds.filter((id) => id !== first.postedIds[0]),
        },
      },
      memberId: BIANCA,
    });
    expect(missingAggregatePostedId).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });

    const tamperedPayloadIdentity = await applyCommandEventLocally({
      local: base,
      event: {
        ...compactedEvent,
        payload_json: {
          ...compactedEvent.payload_json,
          identityHash: "different-payload-identity",
        },
      },
      memberId: BIANCA,
    });
    expect(tamperedPayloadIdentity).toEqual({
      ok: false,
      reason: "onboarding-approval-authority-mismatch",
      fallback: true,
    });

    for (const [index, malformed] of [
      { compactedCommands: {} },
      { compactedCommands: [null], compactedConfirmationIds: ["CONF-NULL"] },
      { compactedCommands: commands, compactedConfirmationIds: {} },
    ].entries()) {
      const malformedEnvelope = await applyCommandEventLocally({
        local: base,
        event: {
          ...compactedEvent,
          id: `EVT-MALFORMED-COMPACTED-${index}`,
          payload_json: {
            ...compactedEvent.payload_json,
            ...(malformed as unknown as Partial<ContinuityCommandEvent["payload_json"]>),
          },
        },
        memberId: BIANCA,
      });
      expect(malformedEnvelope).toEqual({
        ok: false,
        reason: "malformed-command-envelope",
        fallback: true,
      });
    }

    const bundledMalformedEnvelope = await applyCommandEventLocally({
      local: base,
      event: {
        ...compactedEvent,
        id: "EVT-MALFORMED-COMPACTED-BUNDLED",
        payload_json: {
          ...compactedEvent.payload_json,
          compactedCommands: {} as unknown as NonNullable<ContinuityCommandEvent["payload_json"]["compactedCommands"]>,
          materializationFacts: {
            ...compactedEvent.payload_json.materializationFacts,
            onboardingSubmissions: [{
              id: "ONB-SUB-BUNDLED",
              householdId: base.householdId,
              memberId: BIANCA,
              kind: "categories",
              revision: 1,
              categoryIds: [],
              estimates: [],
              submittedAt: "2026-09-05T03:00:00.000Z",
              supersededBy: null,
            }],
          },
        },
      },
      memberId: BIANCA,
    });
    expect(bundledMalformedEnvelope).toEqual({
      ok: false,
      reason: "malformed-command-envelope",
      fallback: true,
    });

    const directEvent = await approvalEvent(base, first);
    for (const [index, targetEvent] of [directEvent, compactedEvent].entries()) {
      for (const [caseIndex, malformedPostedIds] of [
        {} as unknown as string[],
        [targetEvent.payload_json.postedIds[0]!, targetEvent.payload_json.postedIds[0]!],
      ].entries()) {
        const malformedTopLevel = await applyCommandEventLocally({
          local: base,
          event: {
            ...targetEvent,
            id: `EVT-MALFORMED-POSTED-${index}-${caseIndex}`,
            payload_json: { ...targetEvent.payload_json, postedIds: malformedPostedIds },
          },
          memberId: BIANCA,
        });
        expect(malformedTopLevel).toEqual({
          ok: false,
          reason: "malformed-command-envelope",
          fallback: true,
        });
      }
    }
  });

  it("keeps the approval module free of chat, provider, money, and Fund configuration authority", () => {
    const source = readFileSync(new URL("../src/core/onboarding/approvals.ts", import.meta.url), "utf8");
    const actions = readFileSync(new URL("../src/core/onboarding/actions.ts", import.meta.url), "utf8");
    expect(source).toContain("bothApproved");
    expect(source).toContain("mergeOnboardingApprovals");
    expect(source).not.toMatch(/transaction|journal|budgetPlans|householdFund|fund-config|provider|document|window|\.tsx/i);
    expect(actions).toContain('if (action.origin === "affirmative" && !AFFIRMATIVE_ALLOWED.includes(action.kind))');
    expect(actions).not.toContain("approveOnboardingProposal");
    expect(actions).not.toContain("approveOnboardingReady");
  });
});
