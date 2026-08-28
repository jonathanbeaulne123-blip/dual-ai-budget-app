import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  activateHouseholdFundConnection,
  addAccount,
  addGoal,
  addRecurrence,
  assembleHousehold,
  allocateHouseholdFundSurplus,
  bindHouseholdFundBackingAccount,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  householdForAiDisclosure,
  matchHouseholdFundBankEvidence,
  postEntry,
  postHouseholdFundDirectDebit,
  projectHouseholdFund,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
  recordHouseholdFundBankVerification,
  reverseHouseholdFundEvent,
  reversePostedMoney,
  splitForSync,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const DATE = "2026-09-01";

function configuredFund() {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: DATE,
    createdBy: BIANCA,
  }).household;
}

function fundedScenario() {
  let household = configuredFund();
  const proposal = proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "1000",
    date: DATE,
  });
  household = proposal.household;
  household = confirmHouseholdFundContribution(household, {
    memberId: BIANCA,
    proposalEventId: proposal.postedIds[0]!,
  }).household;
  const purchase = postEntry(household, {
    date: "2026-09-02",
    type: "expense",
    amount: "100",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy: JONATHAN,
    visibility: "household",
    confirmDuplicate: true,
    funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 10000, destinationAccountId: "ACC-VISA" },
  });
  household = purchase.household;
  household = confirmHouseholdFundSettlement(household, {
    memberId: BIANCA,
    amount: "60",
    destinationAccountId: "ACC-VISA",
    date: "2026-09-03",
  }).household;
  household = postEntry(household, {
    date: "2026-09-04",
    type: "refund",
    amount: "20",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    refundOfId: purchase.postedIds[0],
    createdBy: JONATHAN,
    visibility: "household",
    confirmDuplicate: true,
  }).household;
  return { household, purchaseId: purchase.postedIds[0]! };
}

describe("Hearth Household Fund", () => {
  it("keeps proposals out of balance and proves the September clearing example", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "1000",
      date: DATE,
    });
    expect(projectHouseholdFund(proposal.household, DATE)).toMatchObject({
      operatingBalanceCents: 0,
      pendingContributionsCents: 100000,
    });

    const { household: cleared } = fundedScenario();
    expect(projectHouseholdFund(cleared, "2026-09-04")).toMatchObject({
      operatingBalanceCents: 94000,
      transferDueCents: 2000,
      transferCreditCents: 0,
      upcomingReserveCents: 0,
      freeToSpendCents: 92000,
      topUpNeededCents: 0,
    });
  });

  it("enforces custodian confirmation and preserves truthful shortfalls", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "25",
      date: DATE,
    });
    household = proposal.household;
    expect(() => confirmHouseholdFundContribution(household, {
      memberId: JONATHAN,
      proposalEventId: proposal.postedIds[0]!,
    })).toThrow(/custodian/i);

    household = confirmHouseholdFundContribution(household, {
      memberId: BIANCA,
      proposalEventId: proposal.postedIds[0]!,
    }).household;
    household = postEntry(household, {
      date: "2026-09-02",
      type: "expense",
      amount: "40",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" },
    }).household;
    expect(projectHouseholdFund(household, "2026-09-02")).toMatchObject({
      operatingBalanceCents: 2500,
      transferDueCents: 4000,
      freeToSpendCents: -1500,
      topUpNeededCents: 1500,
    });
    expect(() => confirmHouseholdFundSettlement(household, {
      memberId: BIANCA,
      amount: "40",
      destinationAccountId: "ACC-VISA",
      date: "2026-09-03",
    })).toThrow(/confirmed Household Fund balance/i);
  });

  it("keeps Bianca's backing account and reconciliation in Personal only", () => {
    let household = configuredFund();
    household = addAccount(household, {
      name: "Bianca savings backing",
      kind: "savings",
      ownerMemberId: BIANCA,
      scope: "personal",
      institution: "Private bank",
      last4: "1234",
    }).household;
    const backing = household.accounts.find((row) => row.name === "Bianca savings backing")!;
    household = bindHouseholdFundBackingAccount(household, {
      memberId: BIANCA,
      accountId: backing.id,
    }).household;
    household = recordHouseholdFundReconciliation(household, {
      memberId: BIANCA,
      date: DATE,
      bankTotal: "2500",
      personalRemainder: "2500",
    }).household;

    const parts = splitForSync(household, BIANCA);
    expect(parts.shared.accounts.some((row) => row.id === backing.id)).toBe(false);
    expect(JSON.stringify(parts.shared)).not.toContain("Private bank");
    expect(JSON.stringify(parts.shared)).not.toContain("bankTotalCents");
    expect(parts.personal.accounts?.map((row) => row.id)).toContain(backing.id);
    expect(parts.personal.fundPrivate?.reconciliations[0]?.bankTotalCents).toBe(250000);

    const hercules = householdForAiDisclosure(household, JONATHAN, { view: "household" });
    expect(JSON.stringify(hercules)).not.toContain("Private bank");
    expect(JSON.stringify(hercules)).not.toContain("bankTotalCents");
    const biancaHercules = householdForAiDisclosure(household, BIANCA, { view: "personal" });
    expect(JSON.stringify(biancaHercules)).not.toContain("Private bank");
    expect(JSON.stringify(biancaHercules)).not.toContain("bankTotalCents");
  });

  it("moves safe operating surplus into existing Kitty Banks without changing the combined pool", () => {
    let { household } = fundedScenario();
    const goal = addGoal(household, { name: "Emergency kitty", target: "1000", shared: true, ownerMemberId: BIANCA });
    household = goal.household;
    const before = projectHouseholdFund(household, "2026-09-30");
    household = allocateHouseholdFundSurplus(household, {
      memberId: BIANCA,
      date: "2026-09-30",
      allocations: [{ goalId: goal.postedIds[0]!, amount: "100" }],
    }).household;
    const after = projectHouseholdFund(household, "2026-09-30");
    expect(after.operatingBalanceCents + after.kittyCents).toBe(before.operatingBalanceCents + before.kittyCents);
    expect(after.kittyCents).toBe(10000);
  });

  it("auto-verifies only one unique exact bank match and refuses competing or near evidence", () => {
    const { household } = fundedScenario();
    const exact = matchHouseholdFundBankEvidence({
      household,
      bindingAccountDigest: "bank-safe-digest",
      evidence: [{
        id: "BANK-1",
        digest: "row-digest-1",
        date: "2026-09-03",
        direction: "out",
        amountCents: 6000,
        accountDigest: "bank-safe-digest",
        destinationAccountId: "ACC-VISA",
      }],
    });
    expect(exact.kind).toBe("exact");

    const near = matchHouseholdFundBankEvidence({
      household,
      bindingAccountDigest: "bank-safe-digest",
      evidence: [{
        id: "BANK-2",
        digest: "row-digest-2",
        date: "2026-09-03",
        direction: "out",
        amountCents: 5900,
        accountDigest: "bank-safe-digest",
        destinationAccountId: "ACC-VISA",
      }],
    });
    expect(near.kind).toBe("near");

    const extraRow = matchHouseholdFundBankEvidence({
      household,
      bindingAccountDigest: "bank-safe-digest",
      evidence: [
        { id: "BANK-3", digest: "row-digest-3", date: "2026-09-03", direction: "out", amountCents: 6000, accountDigest: "bank-safe-digest", destinationAccountId: "ACC-VISA" },
        { id: "BANK-4", digest: "row-digest-4", date: "2026-09-03", direction: "out", amountCents: 1, accountDigest: "bank-safe-digest", destinationAccountId: "ACC-VISA" },
      ],
    });
    expect(extraRow.kind).not.toBe("exact");
  });

  it("stores digests only for bank rows selected into the exact read-only match", () => {
    let { household } = fundedScenario();
    household = addAccount(household, { name: "Connected savings", kind: "savings", scope: "personal", ownerMemberId: BIANCA }).household;
    const accountId = household.accounts.find((account) => account.name === "Connected savings")!.id;
    household = bindHouseholdFundBackingAccount(household, { memberId: BIANCA, accountId, provider: "flinks", accountDigest: "bound-digest", connected: true }).household;
    household = activateHouseholdFundConnection(household, { memberId: BIANCA }).household;
    household = recordHouseholdFundBankVerification(household, {
      memberId: BIANCA,
      evidence: [
        { id: "MATCHED", digest: "keep-this-digest", date: "2026-09-03", direction: "out", amountCents: 6000, accountDigest: "bound-digest", destinationAccountId: "ACC-VISA" },
        { id: "OTHER-ACCOUNT", digest: "drop-this-digest", date: "2026-09-03", direction: "out", amountCents: 1, accountDigest: "different-binding", destinationAccountId: "ACC-VISA" },
      ],
    }).household;
    const verification = household.fundEvents?.find((event) => event.kind === "bank-verified");
    expect(verification?.evidenceDigests).toEqual(["keep-this-digest"]);
    expect(JSON.stringify(verification)).not.toContain("drop-this-digest");
  });

  it("records a direct debit and its settlement behind one command result", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, { memberId: BIANCA, contributorMemberId: BIANCA, amount: "100", date: DATE });
    household = confirmHouseholdFundContribution(proposal.household, { memberId: BIANCA, proposalEventId: proposal.postedIds[0]! }).household;
    household = addAccount(household, { name: "Bianca debit savings", kind: "savings", scope: "personal", ownerMemberId: BIANCA }).household;
    const source = household.accounts.find((account) => account.name === "Bianca debit savings")!;
    const direct = postHouseholdFundDirectDebit(household, {
      memberId: BIANCA,
      date: "2026-09-05",
      amount: "25",
      accountId: source.id,
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Direct grocery debit",
      confirmDuplicate: true,
    });
    const projection = projectHouseholdFund(direct.household, "2026-09-05");
    expect(direct.postedIds.some((id) => id.startsWith("TXN-EX-"))).toBe(true);
    expect(direct.postedIds.some((id) => id.startsWith("FUND-EVT-"))).toBe(true);
    expect(projection).toMatchObject({ operatingBalanceCents: 7500, transferDueCents: 0, freeToSpendCents: 7500 });
    const shared = splitForSync(direct.household, BIANCA).shared;
    expect(JSON.stringify(shared)).not.toContain(source.id);
    expect(shared.transactions.some((tx) => tx.accountId === source.id)).toBe(false);
    expect(shared.fundEvents?.some((event) => event.kind === "purchase-funded" && event.amountCents === 2500)).toBe(true);
    expect(projectHouseholdFund(assembleHousehold(shared, null), "2026-09-05")).toMatchObject({ operatingBalanceCents: 7500, transferDueCents: 0 });
  });

  it("allows grouped verification only for an explicitly selected exact sum", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, { memberId: BIANCA, contributorMemberId: BIANCA, amount: "200", date: DATE });
    household = confirmHouseholdFundContribution(proposal.household, { memberId: BIANCA, proposalEventId: proposal.postedIds[0]! }).household;
    household = postEntry(household, { date: "2026-09-02", type: "expense", amount: "60", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: JONATHAN, visibility: "household", confirmDuplicate: true, funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 6000, destinationAccountId: "ACC-VISA" } }).household;
    const first = confirmHouseholdFundSettlement(household, { memberId: BIANCA, amount: "30", destinationAccountId: "ACC-VISA", date: "2026-09-03" });
    const second = confirmHouseholdFundSettlement(first.household, { memberId: BIANCA, amount: "30", destinationAccountId: "ACC-VISA", date: "2026-09-03" });
    const match = matchHouseholdFundBankEvidence({
      household: second.household,
      bindingAccountDigest: "binding",
      selectedEventIds: [first.postedIds[0]!, second.postedIds[0]!],
      evidence: [{ id: "row", digest: "digest", date: "2026-09-03", direction: "out", amountCents: 6000, accountDigest: "binding", destinationAccountId: "ACC-VISA" }],
    });
    expect(match).toMatchObject({ kind: "exact", amountCents: 6000 });
    expect(match.eventIds).toHaveLength(2);
  });

  it("keeps an after-settlement refund as a visible credit without silently increasing operating balance", () => {
    let { household, purchaseId } = fundedScenario();
    household = confirmHouseholdFundSettlement(household, {
      memberId: BIANCA,
      amount: "20",
      destinationAccountId: "ACC-VISA",
      date: "2026-09-05",
    }).household;
    household = postEntry(household, {
      date: "2026-09-06",
      type: "refund",
      amount: "30",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      refundOfId: purchaseId,
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
    }).household;

    expect(projectHouseholdFund(household, "2026-09-06")).toMatchObject({
      operatingBalanceCents: 92000,
      transferDueCents: 0,
      transferCreditCents: 3000,
      freeToSpendCents: 95000,
    });
  });

  it("supports partial funding and independent settlement destinations", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, { memberId: BIANCA, contributorMemberId: BIANCA, amount: "100", date: DATE });
    household = confirmHouseholdFundContribution(proposal.household, { memberId: BIANCA, proposalEventId: proposal.postedIds[0]! }).household;
    household = postEntry(household, {
      date: "2026-09-02", type: "expense", amount: "80", accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES", createdBy: JONATHAN, visibility: "personal", confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 3000, destinationAccountId: "ACC-VISA" },
    }).household;
    household = postEntry(household, {
      date: "2026-09-03", type: "expense", amount: "20", accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES", createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 1000, destinationAccountId: "ACC-CHEQUING" },
    }).household;

    const projection = projectHouseholdFund(household, "2026-09-03");
    expect(projection.transferDueCents).toBe(4000);
    expect(projection.destinationPositions).toEqual([
      { destinationAccountId: "ACC-CHEQUING", dueCents: 1000, creditCents: 0 },
      { destinationAccountId: "ACC-VISA", dueCents: 3000, creditCents: 0 },
    ]);
    const shared = splitForSync(household, JONATHAN).shared;
    expect(shared.transactions.some((tx) => tx.visibility === "personal")).toBe(false);
    expect(shared.fundEvents?.some((event) => event.kind === "purchase-funded" && event.amountCents === 3000)).toBe(true);
    expect(projectHouseholdFund(assembleHousehold(shared, null), "2026-09-03").transferDueCents).toBe(4000);
  });

  it("reserves due recurring bills and blocks only new planned commitments during a deficit", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, { memberId: BIANCA, contributorMemberId: BIANCA, amount: "100", date: DATE });
    household = confirmHouseholdFundContribution(proposal.household, { memberId: BIANCA, proposalEventId: proposal.postedIds[0]! }).household;
    household = addRecurrence(household, {
      cadence: "monthly", nextDate: "2026-09-20", type: "expense", amount: "25", accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "Fund-backed bill",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }).household;
    expect(projectHouseholdFund(household, "2026-09-10").upcomingReserveCents).toBe(2500);

    household = postEntry(household, {
      date: "2026-09-10", type: "expense", amount: "150", accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES", createdBy: JONATHAN, visibility: "household", confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 15000, destinationAccountId: "ACC-VISA" },
    }).household;
    expect(projectHouseholdFund(household, "2026-09-10").topUpNeededCents).toBe(7500);
    expect(() => addRecurrence(household, {
      cadence: "monthly", nextDate: "2026-09-25", type: "expense", amount: "10", accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES", note: "New commitment",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    })).toThrow(/before adding a new planned commitment/i);
  });

  it("reserves every weekly, biweekly, and monthly occurrence still due this month", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, { memberId: BIANCA, contributorMemberId: BIANCA, amount: "100", date: DATE });
    household = confirmHouseholdFundContribution(proposal.household, { memberId: BIANCA, proposalEventId: proposal.postedIds[0]! }).household;
    for (const [cadence, nextDate] of [["weekly", "2026-09-12"], ["biweekly", "2026-09-11"], ["monthly", "2026-09-20"]] as const) {
      household = addRecurrence(household, {
        cadence, nextDate, type: "expense", amount: "10", accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES", note: `${cadence} Fund bill`,
        fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
      }).household;
    }
    // Sep 12/19/26 + Sep 11/25 + Sep 20 = six still-unposted occurrences.
    expect(projectHouseholdFund(household, "2026-09-10").upcomingReserveCents).toBe(6000);
  });

  it("uses append-only reversal lineage and refuses a second reversal", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, { memberId: BIANCA, contributorMemberId: BIANCA, amount: "75", date: DATE });
    const confirmed = confirmHouseholdFundContribution(proposal.household, { memberId: BIANCA, proposalEventId: proposal.postedIds[0]! });
    household = confirmed.household;
    const reversed = reverseHouseholdFundEvent(household, {
      memberId: BIANCA, eventId: confirmed.postedIds[0]!, date: "2026-09-02", reason: "Duplicate receipt",
    });
    expect(projectHouseholdFund(reversed.household, "2026-09-02").operatingBalanceCents).toBe(0);
    expect(reversed.household.fundEvents?.at(-1)).toMatchObject({ kind: "reversal", relatedEventId: confirmed.postedIds[0] });
    expect(() => reverseHouseholdFundEvent(reversed.household, {
      memberId: BIANCA, eventId: confirmed.postedIds[0]!, date: "2026-09-02", reason: "Again",
    })).toThrow(/already reversed/i);
  });

  it("turns a funded transaction reversal into an append-only refund allocation", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, { memberId: BIANCA, contributorMemberId: BIANCA, amount: "100", date: DATE });
    household = confirmHouseholdFundContribution(proposal.household, { memberId: BIANCA, proposalEventId: proposal.postedIds[0]! }).household;
    const purchase = postEntry(household, {
      date: "2026-09-02", type: "expense", amount: "40", accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES", createdBy: JONATHAN, visibility: "household", confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" },
    });
    const reversed = reversePostedMoney(purchase.household, purchase.postedIds[0]!, { createdBy: JONATHAN, visibility: "household" });
    expect(projectHouseholdFund(reversed.household, "2026-09-03")).toMatchObject({ transferDueCents: 0, transferCreditCents: 0 });
    expect(reversed.household.fundEvents?.at(-1)).toMatchObject({ kind: "refund-funded", relatedEventId: purchase.postedIds[1] });
  });
});
