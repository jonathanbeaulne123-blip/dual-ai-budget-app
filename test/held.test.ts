import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_HOLD_COPY,
  acceptHouseholdWrite,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  financialAuditHash,
  holdHouseholdFundContribution,
  householdFundContributionMotions,
  projectHouseholdFund,
  proposeHouseholdFundContribution,
  releaseHouseholdFundHold,
  withdrawHouseholdFundContribution,
  type CommitResult,
  type Household,
} from "../src/core/index.ts";
import { compileHousehold } from "../src/ledger/index.ts";
import {
  compactedCommandPayload,
  primaryCommandRef,
  receiptToCommandRef,
  type ContinuityCommandRef,
} from "../src/ledger/continuityCommandLog.ts";
import {
  applyCommandEventLocally,
  catalogBaseFromSnapshot,
  type ContinuityCommandEvent,
  type ContinuityCommandEventPayload,
} from "../src/ledger/materializeSnapshotFromEvents.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    createdBy: BIANCA,
    openedOn: DATE,
  }).household;
}

function proposal(household: Household, memberId = JONATHAN): CommitResult {
  return proposeHouseholdFundContribution(household, {
    memberId,
    contributorMemberId: memberId,
    amount: "310",
    date: DATE,
    purpose: "for the rent",
  });
}

describe("Held contribution motions", () => {
  it("holds an open proposal without changing the Fund projection or journal, then confirms it", async () => {
    const proposed = proposal(configuredFund());
    const beforeProjection = projectHouseholdFund(proposed.household, DATE);
    const beforeJournal = compileHousehold(proposed.household).entries;
    const beforeAudit = await financialAuditHash(proposed.household);

    const held = holdHouseholdFundContribution(proposed.household, {
      memberId: BIANCA,
      proposalEventId: proposed.postedIds[0]!,
      note: "Can we check the rent total first?",
      date: "2026-09-02",
    });
    const motion = householdFundContributionMotions(held.household)[0]!;
    expect(motion).toMatchObject({
      status: "held",
      proposal: { id: proposed.postedIds[0] },
      activeHold: {
        id: held.postedIds[0],
        kind: "contribution-held",
        createdBy: BIANCA,
        note: "Can we check the rent total first?",
      },
    });
    expect(projectHouseholdFund(held.household, DATE)).toEqual(beforeProjection);
    expect(compileHousehold(held.household).entries).toEqual(beforeJournal);
    expect(await financialAuditHash(held.household)).not.toBe(beforeAudit);

    const confirmed = confirmHouseholdFundContribution(held.household, {
      memberId: BIANCA,
      proposalEventId: proposed.postedIds[0]!,
      date: "2026-09-03",
    }).household;
    expect(householdFundContributionMotions(confirmed)[0]).toMatchObject({ status: "confirmed" });
    expect(projectHouseholdFund(confirmed, "2026-09-03")).toMatchObject({
      pendingContributionsCents: 0,
      confirmedContributionsCents: 31_000,
      operatingBalanceCents: 31_000,
    });
    expect(confirmed.fundEvents?.some((event) => event.kind === "contribution-held")).toBe(true);
  });

  it("enforces custodian, holder, and proposer authority while withdrawal closes only the proposal", () => {
    const proposed = proposal(configuredFund());
    expect(() => holdHouseholdFundContribution(proposed.household, {
      memberId: JONATHAN,
      proposalEventId: proposed.postedIds[0]!,
    })).toThrow(/custodian/i);

    const custodianProposal = proposal(proposed.household, BIANCA);
    expect(() => holdHouseholdFundContribution(custodianProposal.household, {
      memberId: BIANCA,
      proposalEventId: custodianProposal.postedIds[0]!,
    })).toThrow("You cannot hold your own contribution motion.");

    const held = holdHouseholdFundContribution(proposed.household, {
      memberId: BIANCA,
      proposalEventId: proposed.postedIds[0]!,
      date: "2026-09-02",
    });
    expect(() => releaseHouseholdFundHold(held.household, {
      memberId: JONATHAN,
      holdEventId: held.postedIds[0]!,
    })).toThrow("Only the person who held this may release it.");
    expect(() => withdrawHouseholdFundContribution(held.household, {
      memberId: BIANCA,
      proposalEventId: proposed.postedIds[0]!,
    })).toThrow("Only the proposer may withdraw this contribution motion.");

    const released = releaseHouseholdFundHold(held.household, {
      memberId: BIANCA,
      holdEventId: held.postedIds[0]!,
      date: "2026-09-03",
    });
    expect(householdFundContributionMotions(released.household)[0]).toMatchObject({ status: "open", activeHold: null });
    expect(() => releaseHouseholdFundHold(released.household, {
      memberId: BIANCA,
      holdEventId: held.postedIds[0]!,
    })).toThrow("That contribution Hold is no longer active.");

    const withdrawn = withdrawHouseholdFundContribution(released.household, {
      memberId: JONATHAN,
      proposalEventId: proposed.postedIds[0]!,
      date: "2026-09-04",
    }).household;
    expect(householdFundContributionMotions(withdrawn)[0]).toMatchObject({ status: "withdrawn" });
    expect(projectHouseholdFund(withdrawn, "2026-09-04")).toMatchObject({
      pendingContributionsCents: 0,
      confirmedContributionsCents: 0,
      operatingBalanceCents: 0,
    });
    expect(() => confirmHouseholdFundContribution(withdrawn, {
      memberId: BIANCA,
      proposalEventId: proposed.postedIds[0]!,
    })).toThrow("That contribution motion was withdrawn.");

    const confirmed = confirmHouseholdFundContribution(proposed.household, {
      memberId: BIANCA,
      proposalEventId: proposed.postedIds[0]!,
    }).household;
    expect(() => withdrawHouseholdFundContribution(confirmed, {
      memberId: JONATHAN,
      proposalEventId: proposed.postedIds[0]!,
    })).toThrow("A confirmed contribution cannot be withdrawn. Reverse it instead.");
  });

  it("rejects forged Hold authority before books ingest or persistence", async () => {
    const proposed = proposal(configuredFund());
    const held = holdHouseholdFundContribution(proposed.household, {
      memberId: BIANCA,
      proposalEventId: proposed.postedIds[0]!,
      date: "2026-09-02",
    });
    const forged = {
      ...held.household,
      fundEvents: held.household.fundEvents?.map((event) => event.id === held.postedIds[0]
        ? { ...event, createdBy: JONATHAN }
        : event),
    };
    let ingests = 0;
    let persists = 0;
    const rejected = await acceptHouseholdWrite({
      previous: proposed.household,
      candidate: forged,
      confirmationId: "forged-hold-authority",
      postedIds: held.postedIds,
      commandKind: "holdHouseholdFundContribution",
      adapters: {
        ingest: async () => { ingests += 1; return { ok: true }; },
        persist: async () => { persists += 1; },
      },
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.userMessage).toMatch(/custodian may hold/i);
    expect({ ingests, persists }).toEqual({ ingests: 0, persists: 0 });
  });

  it("keeps the exact calm copy in one core contract", () => {
    expect(HOUSEHOLD_FUND_HOLD_COPY).toEqual({
      action: "Hold",
      status: "Held — let's talk about this.",
      notePlaceholder: "What would you want to know first?",
    });
    const source = readFileSync(new URL("../src/core/householdFund.ts", import.meta.url), "utf8");
    expect(source).toContain("Held — let's talk about this.");
    expect(source).not.toMatch(/denied|rejected|declined/i);
  });

  it("survives compacted Shared command-log replay with notes and final motion states", async () => {
    let current = catalogHousehold();
    const refs: ContinuityCommandRef[] = [];
    let index = 0;
    const accept = async (commandKind: string, committed: CommitResult, memberId: string): Promise<void> => {
      const previous = current;
      const confirmationId = `held-${++index}`;
      const accepted = await acceptHouseholdWrite({
        previous,
        candidate: committed.household,
        confirmationId,
        postedIds: committed.postedIds,
        commandKind,
        adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
      });
      expect(accepted.ok).toBe(true);
      current = accepted.household;
      const receipt = current.commandReceipts.find((row) => row.confirmationId === confirmationId)!;
      const ref = receiptToCommandRef({ household: current, receipt, baseRevision: previous.revision });
      expect(ref.ledgerScope).toBe("shared");
      refs.push(ref);
      expect(current.members.some((row) => row.id === memberId)).toBe(true);
    };

    await accept("configureHouseholdFund", configureHouseholdFund(current, {
      custodianMemberId: BIANCA,
      createdBy: BIANCA,
      openedOn: DATE,
    }), BIANCA);
    const first = proposal(current);
    await accept("proposeHouseholdFundContribution", first, JONATHAN);
    const firstHold = holdHouseholdFundContribution(current, {
      memberId: BIANCA,
      proposalEventId: first.postedIds[0]!,
      note: "Can we compare this with the lease?",
      date: "2026-09-02",
    });
    await accept("holdHouseholdFundContribution", firstHold, BIANCA);
    await accept("confirmHouseholdFundContribution", confirmHouseholdFundContribution(current, {
      memberId: BIANCA,
      proposalEventId: first.postedIds[0]!,
      date: "2026-09-03",
    }), BIANCA);

    const second = proposal(current);
    await accept("proposeHouseholdFundContribution", second, JONATHAN);
    const secondHold = holdHouseholdFundContribution(current, {
      memberId: BIANCA,
      proposalEventId: second.postedIds[0]!,
      note: "Which bill is this for?",
      date: "2026-09-04",
    });
    await accept("holdHouseholdFundContribution", secondHold, BIANCA);
    await accept("releaseHouseholdFundHold", releaseHouseholdFundHold(current, {
      memberId: BIANCA,
      holdEventId: secondHold.postedIds[0]!,
      date: "2026-09-05",
    }), BIANCA);
    await accept("withdrawHouseholdFundContribution", withdrawHouseholdFundContribution(current, {
      memberId: JONATHAN,
      proposalEventId: second.postedIds[0]!,
      date: "2026-09-06",
    }), JONATHAN);

    const tip = current;
    const primary = primaryCommandRef(refs);
    const payload = await compactedCommandPayload(
      { confirmationIds: refs.map((ref) => ref.confirmationId), commandRefs: refs },
      primary,
      tip,
      BIANCA,
    ) as ContinuityCommandEventPayload;
    expect(payload.materializationFacts?.fundEvents?.map((event) => event.kind)).toEqual(expect.arrayContaining([
      "contribution-proposed",
      "contribution-held",
      "contribution-hold-released",
      "contribution-withdrawn",
      "contribution-confirmed",
    ]));
    expect(payload.materializationFacts?.fundEvents?.find((event) => event.id === firstHold.postedIds[0])?.note)
      .toBe("Can we compare this with the lease?");

    const compactedEvent: ContinuityCommandEvent = {
      id: "held-compacted",
      environment: tip.environment,
      household_id: tip.householdId,
      member_id: BIANCA,
      idempotency_key: primary.idempotencyKey,
      confirmation_id: primary.confirmationId,
      identity_hash: primary.identityHash,
      base_revision: 0,
      result_revision: tip.revision,
      ledger_scope: "shared",
      command_type: primary.commandType,
      payload_json: payload,
      created_at: primary.commandPayload.acceptedAt,
    };
    const replayed = await applyCommandEventLocally({
      local: catalogBaseFromSnapshot(tip),
      event: compactedEvent,
      memberId: JONATHAN,
    });
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) throw new Error(replayed.reason);
    expect(householdFundContributionMotions(replayed.household).map((motion) => motion.status).sort())
      .toEqual(["confirmed", "withdrawn"]);
    expect(await financialAuditHash(replayed.household)).toBe(await financialAuditHash(tip));
  });
});
