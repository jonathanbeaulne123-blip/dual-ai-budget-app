import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  acceptHouseholdWrite,
  addAccount,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  financialAuditHash,
  projectHouseholdFund,
  postEntry,
  postHouseholdFundDirectDebit,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
  type CommitResult,
} from "../src/core/index.ts";
import { receiptToCommandRef } from "../src/ledger/continuityCommandLog.ts";
import {
  buildSnapshotFromEvents,
  applyCommandEventLocally,
  catalogBaseFromSnapshot,
  extractMaterializationFacts,
  type ContinuityCommandEvent,
} from "../src/ledger/materializeSnapshotFromEvents.ts";

describe("Household Fund command-log continuity", () => {
  it("rebuilds immutable fund events, funding, and settlement allocations with the exact audit hash", async () => {
    let current = catalogHousehold();
    const events: ContinuityCommandEvent[] = [];

    async function accept(kind: string, result: CommitResult, confirmationId: string) {
      const previous = current;
      const accepted = await acceptHouseholdWrite({
        previous,
        candidate: result.household,
        confirmationId,
        postedIds: result.postedIds,
        commandKind: kind,
        adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
      });
      expect(accepted.ok).toBe(true);
      current = accepted.household;
      const receipt = current.commandReceipts?.find((row) => row.confirmationId === confirmationId)!;
      const ref = receiptToCommandRef({ household: current, receipt, baseRevision: previous.revision });
      events.push({
        id: `event-${events.length + 1}`,
        environment: current.environment,
        household_id: current.householdId,
        member_id: "MEM-001",
        idempotency_key: confirmationId,
        confirmation_id: confirmationId,
        identity_hash: receipt.identityHash,
        base_revision: previous.revision,
        result_revision: current.revision,
        ledger_scope: "shared",
        command_type: kind,
        payload_json: { ...ref.commandPayload, materializationFacts: extractMaterializationFacts(current, receipt.postedIds, { ledgerScope: "shared", memberId: "MEM-001" }) },
        created_at: `2026-09-0${events.length + 1}T12:00:00.000Z`,
      });
    }

    await accept("configureHouseholdFund", configureHouseholdFund(current, { custodianMemberId: "MEM-001", createdBy: "MEM-001", openedOn: "2026-09-01" }), "fund-1");
    const proposed = proposeHouseholdFundContribution(current, { memberId: "MEM-002", contributorMemberId: "MEM-002", amount: "100", date: "2026-09-01" });
    const proposalId = proposed.postedIds[0]!;
    await accept("proposeHouseholdFundContribution", proposed, "fund-2");
    await accept("confirmHouseholdFundContribution", confirmHouseholdFundContribution(current, { memberId: "MEM-001", proposalEventId: proposalId }), "fund-3");
    await accept("postEntry", postEntry(current, { date: "2026-09-02", type: "expense", amount: "40", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: "MEM-002", visibility: "household", confirmDuplicate: true, funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" } }), "fund-4");
    await accept("confirmHouseholdFundSettlement", confirmHouseholdFundSettlement(current, { memberId: "MEM-001", amount: "20", destinationAccountId: "ACC-VISA", date: "2026-09-03" }), "fund-5");

    const materialized = await buildSnapshotFromEvents(events, catalogBaseFromSnapshot(current));
    expect(materialized.fundEvents).toHaveLength(current.fundEvents?.length ?? 0);
    expect(materialized.fundSettlementAllocations).toEqual(current.fundSettlementAllocations);
    expect(materialized.transactions[0]?.funding).toEqual(current.transactions[0]?.funding);
    expect(await financialAuditHash(materialized)).toBe(await financialAuditHash(current));
  });

  it("delivers a Personal Fund-backed purchase as shared Fund position without its Personal transaction", async () => {
    let previous = catalogHousehold();
    const configured = configureHouseholdFund(previous, { custodianMemberId: "MEM-001", createdBy: "MEM-001", openedOn: "2026-09-01" });
    let accepted = await acceptHouseholdWrite({ previous, candidate: configured.household, confirmationId: "private-fund-1", postedIds: configured.postedIds, adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) } });
    previous = accepted.household;
    const personal = postEntry(previous, { date: "2026-09-02", type: "expense", amount: "30", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: "MEM-001", visibility: "personal", confirmDuplicate: true, funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 3000, destinationAccountId: "ACC-VISA" } });
    accepted = await acceptHouseholdWrite({ previous, candidate: personal.household, confirmationId: "private-fund-2", postedIds: personal.postedIds, adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) } });
    const receipt = accepted.household.commandReceipts.find((row) => row.confirmationId === "private-fund-2")!;
    const ref = receiptToCommandRef({ household: accepted.household, receipt, baseRevision: previous.revision });
    expect(ref.ledgerScope).toBe("shared");
    const facts = extractMaterializationFacts(accepted.household, receipt.postedIds, { ledgerScope: ref.ledgerScope, memberId: "MEM-001" });
    expect(facts.transactions).toBeUndefined();
    expect(facts.fundEvents?.some((event) => event.kind === "purchase-funded")).toBe(true);
    expect(JSON.stringify(facts)).not.toContain("visibility\":\"personal");

    const event: ContinuityCommandEvent = {
      id: "private-fund-event", environment: accepted.household.environment, household_id: accepted.household.householdId,
      member_id: "MEM-001", idempotency_key: ref.idempotencyKey, confirmation_id: ref.confirmationId,
      identity_hash: ref.identityHash, base_revision: previous.revision, result_revision: accepted.household.revision,
      ledger_scope: ref.ledgerScope, command_type: ref.commandType, payload_json: { ...ref.commandPayload, materializationFacts: facts },
      created_at: receipt.acceptedAt,
    };
    const partner = { ...previous, revision: previous.revision, transactions: previous.transactions.filter((row) => row.visibility !== "personal") };
    const replayed = await applyCommandEventLocally({ local: partner, event, memberId: "MEM-002" });
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.household.transactions.some((row) => row.visibility === "personal")).toBe(false);
    expect(projectHouseholdFund(replayed.household, "2026-09-02").transferDueCents).toBe(3000);
  });

  it("replays a shared reconciliation without its private totals or a scoped-hash mismatch", async () => {
    let previous = configureHouseholdFund(catalogHousehold(), { custodianMemberId: "MEM-001", createdBy: "MEM-001", openedOn: "2026-09-01" }).household;
    const reconciled = recordHouseholdFundReconciliation(previous, { memberId: "MEM-001", date: "2026-09-07", bankTotal: "1234.56", personalRemainder: "1234.56" });
    const accepted = await acceptHouseholdWrite({ previous, candidate: reconciled.household, confirmationId: "reconcile-private", postedIds: reconciled.postedIds, adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) } });
    const receipt = accepted.household.commandReceipts.find((row) => row.confirmationId === "reconcile-private")!;
    const ref = receiptToCommandRef({ household: accepted.household, receipt, baseRevision: previous.revision });
    const facts = extractMaterializationFacts(accepted.household, receipt.postedIds, { ledgerScope: ref.ledgerScope, memberId: "MEM-001" });
    expect(JSON.stringify(facts)).not.toContain("bankTotalCents");
    expect(JSON.stringify(facts)).not.toContain("personalRemainderCents");
    const event: ContinuityCommandEvent = {
      id: "reconcile-event", environment: accepted.household.environment, household_id: accepted.household.householdId,
      member_id: "MEM-001", idempotency_key: ref.idempotencyKey, confirmation_id: ref.confirmationId,
      identity_hash: ref.identityHash, base_revision: previous.revision, result_revision: accepted.household.revision,
      ledger_scope: ref.ledgerScope, command_type: ref.commandType, payload_json: { ...ref.commandPayload, materializationFacts: facts },
      created_at: receipt.acceptedAt,
    };
    const partner = { ...previous, fundPrivate: { bankBindings: [], reconciliations: [] } };
    const replayed = await applyCommandEventLocally({ local: partner, event, memberId: "MEM-002" });
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.household.fundPrivate?.reconciliations).toEqual([]);
  });

  it("replays a direct debit as shared purchase and settlement facts without the Personal source", async () => {
    let previous = configureHouseholdFund(catalogHousehold(), { custodianMemberId: "MEM-001", createdBy: "MEM-001", openedOn: "2026-09-01" }).household;
    const proposal = proposeHouseholdFundContribution(previous, { memberId: "MEM-001", contributorMemberId: "MEM-001", amount: "100", date: "2026-09-01" });
    previous = confirmHouseholdFundContribution(proposal.household, { memberId: "MEM-001", proposalEventId: proposal.postedIds[0]! }).household;
    previous = addAccount(previous, { name: "Private debit source", kind: "savings", scope: "personal", ownerMemberId: "MEM-001" }).household;
    const sourceId = previous.accounts.find((account) => account.name === "Private debit source")!.id;
    const direct = postHouseholdFundDirectDebit(previous, { memberId: "MEM-001", date: "2026-09-04", amount: "25", accountId: sourceId, subcategoryId: "SUB-FOOD-GROCERIES", confirmDuplicate: true });
    const accepted = await acceptHouseholdWrite({ previous, candidate: direct.household, confirmationId: "direct-debit-shared", postedIds: direct.postedIds, adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) } });
    expect(accepted.ok).toBe(true);
    const receipt = accepted.household.commandReceipts.find((row) => row.confirmationId === "direct-debit-shared")!;
    const ref = receiptToCommandRef({ household: accepted.household, receipt, baseRevision: previous.revision });
    const facts = extractMaterializationFacts(accepted.household, receipt.postedIds, { ledgerScope: ref.ledgerScope, memberId: "MEM-001" });
    expect(ref.ledgerScope).toBe("shared");
    expect(facts.transactions).toBeUndefined();
    expect(facts.fundEvents?.map((event) => event.kind)).toEqual(expect.arrayContaining(["purchase-funded", "settlement-confirmed"]));
    expect(facts.fundSettlementAllocations).toHaveLength(1);
    expect(JSON.stringify(facts)).not.toContain(sourceId);

    const event: ContinuityCommandEvent = {
      id: "direct-debit-event", environment: accepted.household.environment, household_id: accepted.household.householdId,
      member_id: "MEM-001", idempotency_key: ref.idempotencyKey, confirmation_id: ref.confirmationId,
      identity_hash: ref.identityHash, base_revision: previous.revision, result_revision: accepted.household.revision,
      ledger_scope: ref.ledgerScope, command_type: ref.commandType, payload_json: { ...ref.commandPayload, materializationFacts: facts },
      created_at: receipt.acceptedAt,
    };
    const partner = { ...previous, accounts: previous.accounts.filter((account) => account.scope !== "personal"), transactions: previous.transactions.filter((row) => row.visibility !== "personal") };
    const replayed = await applyCommandEventLocally({ local: partner, event, memberId: "MEM-002" });
    expect(replayed.ok).toBe(true);
    if (replayed.ok) {
      expect(JSON.stringify(replayed.household)).not.toContain(sourceId);
      expect(projectHouseholdFund(replayed.household, "2026-09-04")).toMatchObject({ operatingBalanceCents: 7500, transferDueCents: 0 });
    }
  });

  it("rejects forged over-allocation before PGlite ingest or snapshot persistence", async () => {
    let previous = configureHouseholdFund(catalogHousehold(), { custodianMemberId: "MEM-001", createdBy: "MEM-001", openedOn: "2026-09-01" }).household;
    const proposed = proposeHouseholdFundContribution(previous, { memberId: "MEM-001", contributorMemberId: "MEM-001", amount: "100", date: "2026-09-01" });
    previous = confirmHouseholdFundContribution(proposed.household, { memberId: "MEM-001", proposalEventId: proposed.postedIds[0]! }).household;
    previous = postEntry(previous, { date: "2026-09-02", type: "expense", amount: "40", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: "MEM-001", visibility: "household", confirmDuplicate: true, funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" } }).household;
    const settlement = confirmHouseholdFundSettlement(previous, { memberId: "MEM-001", amount: "20", destinationAccountId: "ACC-VISA", date: "2026-09-03" });
    const settlementEventId = settlement.postedIds.find((id) => id.startsWith("FUND-EVT-"))!;
    const candidate = {
      ...settlement.household,
      fundEvents: settlement.household.fundEvents?.map((event) => event.id === settlementEventId ? { ...event, amountCents: 5000 } : event),
      fundSettlementAllocations: settlement.household.fundSettlementAllocations?.map((row) => row.eventId === settlementEventId ? { ...row, amountCents: 5000 } : row),
    };
    let ingests = 0;
    let persists = 0;
    const outcome = await acceptHouseholdWrite({
      previous, candidate, confirmationId: "forged-settlement", postedIds: settlement.postedIds,
      adapters: { ingest: async () => { ingests += 1; return { ok: true }; }, persist: async () => { persists += 1; } },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.userMessage).toMatch(/unsettled amount/i);
    expect({ ingests, persists }).toEqual({ ingests: 0, persists: 0 });
  });

  it("rejects a stale concurrent settlement instead of replacing the first device's allocation", async () => {
    let base = configureHouseholdFund(catalogHousehold(), { custodianMemberId: "MEM-001", createdBy: "MEM-001", openedOn: "2026-09-01" }).household;
    const proposed = proposeHouseholdFundContribution(base, { memberId: "MEM-001", contributorMemberId: "MEM-001", amount: "100", date: "2026-09-01" });
    base = confirmHouseholdFundContribution(proposed.household, { memberId: "MEM-001", proposalEventId: proposed.postedIds[0]! }).household;
    base = postEntry(base, { date: "2026-09-02", type: "expense", amount: "40", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: "MEM-001", visibility: "household", confirmDuplicate: true, funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" } }).household;
    const fromPhoneA = confirmHouseholdFundSettlement(base, { memberId: "MEM-001", amount: "25", destinationAccountId: "ACC-VISA", date: "2026-09-03" });
    const fromPhoneB = confirmHouseholdFundSettlement(base, { memberId: "MEM-001", amount: "20", destinationAccountId: "ACC-VISA", date: "2026-09-03" });
    const first = await acceptHouseholdWrite({ previous: base, candidate: fromPhoneA.household, confirmationId: "settle-phone-a", postedIds: fromPhoneA.postedIds, adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) } });
    expect(first.ok).toBe(true);
    let ingests = 0;
    let persists = 0;
    const stale = await acceptHouseholdWrite({
      previous: first.household, candidate: fromPhoneB.household, confirmationId: "settle-phone-b", postedIds: fromPhoneB.postedIds,
      adapters: { ingest: async () => { ingests += 1; return { ok: true }; }, persist: async () => { persists += 1; } },
    });
    expect(stale.ok).toBe(false);
    expect({ ingests, persists }).toEqual({ ingests: 0, persists: 0 });
  });
});
