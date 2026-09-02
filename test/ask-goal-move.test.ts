import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  acceptHouseholdWrite,
  addGoal,
  addRecurrence,
  askAlternatives,
  catalogHousehold,
  configureHouseholdFund,
  householdAsk,
  moveAskGoalClaimToNextMonth,
  type Household,
} from "../src/core/index.ts";
import { financialAuditHashForScope } from "../src/core/commandIdentity.ts";
import { receiptToCommandRef } from "../src/ledger/continuityCommandLog.ts";
import {
  applyCommandEventLocally,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
} from "../src/ledger/materializeSnapshotFromEvents.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12" as const;

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

function addBill(household: Household): Household {
  return addRecurrence(household, {
    cadence: "monthly",
    nextDate: "2026-09-20",
    type: "expense",
    amount: "40",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note: "Phone",
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

function halifaxHousehold(): Household {
  const goal = addGoal(addBill(configuredFund()), {
    name: "Halifax",
    target: "300",
    shared: true,
    ownerMemberId: BIANCA,
  });
  return addRecurrence(goal.household, {
    cadence: "monthly",
    nextDate: "2026-09-30",
    type: "transfer",
    amount: "300",
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!,
    note: "Standing · jar · Halifax",
  }).household;
}

function currentHalifaxMove(household: Household) {
  const alternative = askAlternatives(householdAsk(household, TODAY))[0];
  if (!alternative) throw new Error("Expected Halifax alternative");
  return {
    today: TODAY,
    memberId: JONATHAN,
    goalId: alternative.goalId,
    recurrenceId: alternative.recurrenceId,
    claimDate: alternative.claimDate,
  };
}

describe("The Ask shared-goal move", () => {
  it("moves only the exact Halifax standing order to October and moves no money", () => {
    const household = halifaxHousehold();
    const move = currentHalifaxMove(household);
    const beforeTransactions = structuredClone(household.transactions);
    const beforeContributions = structuredClone(household.goalContributions);
    const beforeFundEvents = structuredClone(household.fundEvents);
    const beforeSaved = household.goals.find((row) => row.id === move.goalId)?.savedCents;

    const result = moveAskGoalClaimToNextMonth(household, move);

    expect(result.undo.commandKind).toBe("moveAskGoalClaimToNextMonth");
    expect(result.undo.label).toBe("Moved Halifax to next month");
    expect(result.postedIds).toEqual([move.recurrenceId]);
    expect(result.household.recurrences.find((row) => row.id === move.recurrenceId)?.nextDate).toBe("2026-10-30");
    expect(household.recurrences.find((row) => row.id === move.recurrenceId)?.nextDate).toBe("2026-09-30");
    expect(result.household.transactions).toEqual(beforeTransactions);
    expect(result.household.goalContributions).toEqual(beforeContributions);
    expect(result.household.fundEvents).toEqual(beforeFundEvents);
    expect(result.household.goals.find((row) => row.id === move.goalId)?.savedCents).toBe(beforeSaved);
    expect(householdAsk(result.household, TODAY).askCents).toBe(4_000);
  });

  it("fails closed when the offer is stale or points at the wrong recurrence", () => {
    const household = halifaxHousehold();
    const move = currentHalifaxMove(household);
    const moved = moveAskGoalClaimToNextMonth(household, move).household;
    const billId = household.recurrences.find((row) => row.type === "expense")!.id;

    expect(() => moveAskGoalClaimToNextMonth(moved, move)).toThrow(/out of date/i);
    expect(() => moveAskGoalClaimToNextMonth(household, { ...move, recurrenceId: billId })).toThrow(/out of date/i);
    expect(() => moveAskGoalClaimToNextMonth(household, { ...move, claimDate: "2026-09-29" })).toThrow(/out of date/i);
    expect(() => moveAskGoalClaimToNextMonth(household, { ...move, memberId: BIANCA })).toThrow(/member doing the work/i);
  });

  it("preserves the projector's exact earliest recurrence when one goal has two", () => {
    const household = halifaxHousehold();
    const goalId = household.goals.find((row) => row.name === "Halifax")!.id;
    const withSecond = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-29",
      type: "transfer",
      amount: "50",
      accountId: "ACC-CHEQUING",
      transferToAccountId: "ACC-GOALS",
      goalId,
      note: "Standing · second Halifax order",
    }).household;
    const alternative = askAlternatives(householdAsk(withSecond, TODAY))[0]!;

    expect(alternative.claimDate).toBe("2026-09-29");
    expect(alternative.recurrenceId).toBe(withSecond.recurrences.find((row) => row.note.includes("second"))!.id);
    const result = moveAskGoalClaimToNextMonth(withSecond, {
      today: TODAY,
      memberId: JONATHAN,
      goalId: alternative.goalId,
      recurrenceId: alternative.recurrenceId,
      claimDate: alternative.claimDate,
    });
    expect(result.household.recurrences.find((row) => row.id === alternative.recurrenceId)?.nextDate).toBe("2026-10-29");
    expect(result.household.recurrences.find((row) => row.note.includes("Standing · jar"))?.nextDate).toBe("2026-09-30");
  });

  it("uses one receipt and replays the moved date onto a second device", async () => {
    const previous = halifaxHousehold();
    const move = currentHalifaxMove(previous);
    const committed = moveAskGoalClaimToNextMonth(previous, move);
    const confirmationId = "confirm-halifax-next-month";
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate: committed.household,
      confirmationId,
      postedIds: committed.postedIds,
      commandKind: committed.undo.commandKind,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(accepted.ok).toBe(true);

    const duplicate = await acceptHouseholdWrite({
      previous: accepted.household,
      candidate: committed.household,
      confirmationId,
      postedIds: committed.postedIds,
      commandKind: committed.undo.commandKind,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(duplicate.duplicateOfReceiptId).toBe(confirmationId);
    expect(duplicate.household.recurrences.find((row) => row.id === move.recurrenceId)?.nextDate).toBe("2026-10-30");

    const receipt = accepted.household.commandReceipts.find((row) => row.confirmationId === confirmationId)!;
    const ref = receiptToCommandRef({ household: accepted.household, receipt, baseRevision: previous.revision });
    const facts = extractMaterializationFacts(accepted.household, receipt.postedIds, {
      ledgerScope: ref.ledgerScope,
      memberId: JONATHAN,
      commandKind: ref.commandType,
    });
    expect(facts.recurrences).toEqual([
      expect.objectContaining({ id: move.recurrenceId, nextDate: "2026-10-30" }),
    ]);
    const event: ContinuityCommandEvent = {
      id: "evt-halifax-next-month",
      environment: accepted.household.environment,
      household_id: accepted.household.householdId,
      member_id: JONATHAN,
      idempotency_key: confirmationId,
      confirmation_id: confirmationId,
      identity_hash: receipt.identityHash,
      base_revision: previous.revision,
      result_revision: accepted.household.revision,
      ledger_scope: ref.ledgerScope,
      command_type: ref.commandType,
      payload_json: { ...ref.commandPayload, materializationFacts: facts },
      created_at: "2026-09-12T12:00:00.000Z",
    };
    const remote = await applyCommandEventLocally({ local: previous, event, memberId: "MEM-002" });
    expect(remote.ok).toBe(true);
    if (!remote.ok) throw new Error(remote.reason);
    expect(remote.household.recurrences.find((row) => row.id === move.recurrenceId)?.nextDate).toBe("2026-10-30");
    expect(await financialAuditHashForScope(remote.household, "shared", JONATHAN))
      .toBe(await financialAuditHashForScope(accepted.household, "shared", JONATHAN));
  });

});
