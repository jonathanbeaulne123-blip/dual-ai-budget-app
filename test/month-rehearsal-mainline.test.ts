import { describe, expect, it } from "vitest";
import {
  buildCommandRef,
  compactedCommandPayload,
  primaryCommandRef,
  type ContinuityCommandRef,
} from "../src/ledger/continuityCommandLog.ts";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  financialAuditHash,
  startMonthRehearsal,
  startRehearsalTask,
} from "../src/core/index.ts";
import { buildCommandEventFromReceipt } from "../src/ledger/continuityCommandLogHarness.ts";
import {
  applyCommandEventLocally,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
  type ContinuityCommandEventPayload,
} from "../src/ledger/materializeSnapshotFromEvents.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

async function acceptRehearsalUpdate(input: {
  previous: ReturnType<typeof catalogHousehold>;
  result: ReturnType<typeof startMonthRehearsal> | ReturnType<typeof startRehearsalTask>;
  confirmationId: string;
}) {
  return acceptHouseholdWrite({
    previous: input.previous,
    candidate: input.result.household,
    confirmationId: input.confirmationId,
    commandKind: input.result.undo.commandKind ?? "updateMonthRehearsal",
    postedIds: input.result.postedIds,
    adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
  });
}

describe("Bianca Month mainline contract", () => {
  it("moves shared rehearsal progress through the current command-log path without turning it into money", async () => {
    const deviceA = catalogHousehold("development");
    const deviceB = structuredClone(deviceA);
    const beforeHash = await financialAuditHash(deviceA);
    const started = startMonthRehearsal(deviceA, {
      monthKey: "2026-09",
      biancaParticipantId: BIANCA,
      jonathanPartnerId: JONATHAN,
      startedByMemberId: BIANCA,
      now: "2026-09-01T12:00:00.000Z",
    });
    expect(started.postedIds).toEqual([]);
    expect(started.undo.commandKind).toBe("updateMonthRehearsal");
    const acceptedStart = await acceptRehearsalUpdate({
      previous: deviceA,
      result: started,
      confirmationId: "bianca-month-start",
    });
    const startRef = buildCommandRef({
      household: acceptedStart.household,
      confirmationId: "bianca-month-start",
      baseRevision: deviceA.revision,
    });
    expect(startRef?.commandPayload.materializationHash).toMatch(/^[a-f0-9]{64}$/);
    const startEvent = buildCommandEventFromReceipt({
      household: acceptedStart.household,
      confirmationId: "bianca-month-start",
      baseRevision: deviceA.revision,
      memberId: BIANCA,
    });
    expect(startEvent.payload_json.materializationFacts?.monthRehearsals).toHaveLength(1);
    const replayedStart = await applyCommandEventLocally({ local: deviceB, event: startEvent, memberId: JONATHAN });
    expect(replayedStart.ok).toBe(true);
    if (!replayedStart.ok) throw new Error(replayedStart.reason);
    expect(replayedStart.household.monthRehearsals).toHaveLength(1);
    expect(await financialAuditHash(replayedStart.household)).toBe(beforeHash);

    const rehearsalId = acceptedStart.household.monthRehearsals![0]!.id;
    const beganIncome = startRehearsalTask(acceptedStart.household, {
      rehearsalId,
      taskId: "income",
      memberId: BIANCA,
      today: "2026-09-01",
      now: "2026-09-01T12:05:00.000Z",
    });
    const acceptedIncome = await acceptRehearsalUpdate({
      previous: acceptedStart.household,
      result: beganIncome,
      confirmationId: "bianca-month-income-start",
    });
    const incomeRef = buildCommandRef({
      household: acceptedIncome.household,
      confirmationId: "bianca-month-income-start",
      baseRevision: acceptedStart.household.revision,
    });
    if (!startRef || !incomeRef) throw new Error("Missing rehearsal command refs");
    const incomeEvent = buildCommandEventFromReceipt({
      household: acceptedIncome.household,
      confirmationId: "bianca-month-income-start",
      baseRevision: acceptedStart.household.revision,
      memberId: BIANCA,
    });
    const replayedIncome = await applyCommandEventLocally({
      local: replayedStart.household,
      event: incomeEvent,
      memberId: JONATHAN,
    });
    expect(replayedIncome.ok).toBe(true);
    if (!replayedIncome.ok) throw new Error(replayedIncome.reason);
    const income = replayedIncome.household.monthRehearsals![0]!.weeks[0]!.tasks
      .find((task) => task.taskId === "income");
    expect(income?.status).toBe("in-progress");
    expect(income?.attempts).toHaveLength(1);
    expect(await financialAuditHash(replayedIncome.household)).toBe(beforeHash);

    const refs: ContinuityCommandRef[] = [startRef, incomeRef];
    const primary = primaryCommandRef(refs);
    const compactedPayload = compactedCommandPayload(
      { confirmationIds: refs.map((row) => row.confirmationId), commandRefs: refs },
      primary,
      acceptedIncome.household,
      BIANCA,
    ) as ContinuityCommandEventPayload;
    const compactedEvent: ContinuityCommandEvent = {
      ...incomeEvent,
      base_revision: deviceB.revision,
      result_revision: acceptedIncome.household.revision,
      command_type: primary.commandType,
      payload_json: compactedPayload,
    };
    const compactedReplay = await applyCommandEventLocally({
      local: deviceB,
      event: compactedEvent,
      memberId: JONATHAN,
    });
    expect(compactedReplay.ok).toBe(true);
    if (!compactedReplay.ok) throw new Error(compactedReplay.reason);
    expect(compactedReplay.household.monthRehearsals![0]!.weeks[0]!.tasks
      .find((task) => task.taskId === "income")?.status).toBe("in-progress");

    const personalFacts = extractMaterializationFacts(acceptedIncome.household, [], {
      ledgerScope: "personal",
      memberId: BIANCA,
      commandKind: "updateMonthRehearsal",
    });
    expect(personalFacts.monthRehearsals).toBeUndefined();

    const wrongKindEvent = structuredClone(startEvent);
    wrongKindEvent.command_type = "postEntry";
    wrongKindEvent.payload_json.commandKind = "postEntry";
    const wrongKind = await applyCommandEventLocally({ local: deviceB, event: wrongKindEvent, memberId: JONATHAN });
    expect(wrongKind).toEqual({ ok: false, reason: "month-rehearsal-authority-mismatch", fallback: true });

    const tamperedEvent = structuredClone(startEvent);
    tamperedEvent.payload_json.materializationFacts!.monthRehearsals![0]!.monthKey = "2026-10";
    const tampered = await applyCommandEventLocally({ local: deviceB, event: tamperedEvent, memberId: JONATHAN });
    expect(tampered).toEqual({ ok: false, reason: "materialization-hash-mismatch", fallback: true });
  });
});
