import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SharedLedgerStory } from "../src/SharedLedgerStory.tsx";
import {
  HOUSEHOLD_FUND_ID,
  addAccount,
  addGoal,
  allocateHouseholdFundSurplus,
  bindHouseholdFundBackingAccount,
  buildPersonalLedgerStory,
  buildSharedLedgerStory,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  fundFlowDiagram,
  holdHouseholdFundContribution,
  HOUSEHOLD_FUND_HOLD_COPY,
  postEntry,
  projectHouseholdFund,
  projectLedgerExperience,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
  releaseHouseholdFundHold,
  sharedActionQueue,
  withdrawHouseholdFundContribution,
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
    createdBy: BIANCA,
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

describe("fundFlowDiagram", () => {
  it("matches the canonical September clearing example", () => {
    const { household } = fundedScenario();
    const projection = projectHouseholdFund(household, "2026-09-04");
    const flow = fundFlowDiagram(household, "2026-09-04");
    expect(projection).toMatchObject({
      operatingBalanceCents: 94000,
      transferDueCents: 2000,
      freeToSpendCents: 92000,
    });
    expect(flow.nodes.find((node) => node.id === "operating")?.cents).toBe(94000);
    expect(flow.nodes.find((node) => node.id === "due")?.cents).toBe(2000);
    expect(flow.nodes.find((node) => node.id === "freeToSpend")).toMatchObject({
      label: "Fund free-to-spend",
      cents: 92000,
    });
    expect(flow.conservationCents).toBe(projection.operatingBalanceCents + projection.kittyCents);
  });

  it("turns the last node into exact top-up without erasing the purchase", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "25",
      date: DATE,
    });
    household = confirmHouseholdFundContribution(proposal.household, {
      memberId: BIANCA,
      proposalEventId: proposal.postedIds[0]!,
    }).household;
    household = postEntry(household, {
      date: "2026-09-02",
      type: "expense",
      amount: "40",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" },
    }).household;
    const flow = fundFlowDiagram(household, "2026-09-02");
    expect(flow.nodes.find((node) => node.id === "purchases")?.cents).toBe(4000);
    expect(flow.nodes.find((node) => node.id === "freeToSpend")).toMatchObject({
      label: "Top-up needed",
      cents: 1500,
      state: "top-up",
    });
  });

  it("shows refund-after-settlement as a credit branch and conserves Kitty rollover", () => {
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
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    const flow = fundFlowDiagram(household, "2026-09-06");
    expect(flow.nodes.find((node) => node.id === "credit")?.cents).toBe(3000);
    expect(flow.edges.some((edge) => edge.direction === "credit")).toBe(true);
    const goal = addGoal(household, { name: "Emergency kitty", target: "1000", shared: true, ownerMemberId: BIANCA });
    household = goal.household;
    const before = fundFlowDiagram(household, "2026-09-30").conservationCents;
    household = allocateHouseholdFundSurplus(household, {
      memberId: BIANCA,
      date: "2026-09-30",
      allocations: [{ goalId: goal.postedIds[0]!, amount: "100" }],
    }).household;
    expect(fundFlowDiagram(household, "2026-09-30").conservationCents).toBe(before);
  });
});

describe("sharedActionQueue", () => {
  it("orders Health, top-up, due, then custodian confirmation without shame language", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "25",
      date: DATE,
    });
    household = proposal.household;
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
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 4000, destinationAccountId: "ACC-VISA" },
    }).household;
    const queue = sharedActionQueue(household, "2026-09-02", { integrityFindingCount: 1 });
    expect(queue.map((item) => item.kind).slice(0, 4)).toEqual([
      "books-health",
      "top-up",
      "transfer-due",
      "reconciliation",
    ]);
    expect(JSON.stringify(queue)).not.toMatch(/failed|should have|who spent more/i);
    expect(queue.find((item) => item.kind === "transfer-due")?.actorLabel).toBe("Bianca");
  });

  it("uses the sealed contribution motion state for Held and withdrawn proposals", () => {
    const proposal = proposeHouseholdFundContribution(configuredFund(), {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "25",
      date: DATE,
    });
    const proposalId = proposal.postedIds[0]!;
    let household = holdHouseholdFundContribution(proposal.household, {
      memberId: BIANCA,
      proposalEventId: proposalId,
      note: "Check the rent total first.",
      date: DATE,
    }).household;

    let story = buildSharedLedgerStory(household, "2026-09-02");
    expect(story.queue.find((item) => item.id === `confirm-${proposalId}`)?.amountCents).toBe(2500);
    expect(story.trust.pendingProposalCount).toBe(1);
    expect(story.weekly.find((event) => event.kind === "contribution-proposed")).toMatchObject({
      label: "Contribution proposed",
      recordOnly: true,
    });
    expect(story.weekly.find((event) => event.kind === "contribution-held")).toMatchObject({
      label: HOUSEHOLD_FUND_HOLD_COPY.status,
      recordOnly: true,
      actorLabel: "Bianca",
    });

    const activeHoldId = household.fundEvents?.find((event) => event.kind === "contribution-held")?.id;
    if (!activeHoldId) throw new Error("expected active Hold");
    household = releaseHouseholdFundHold(household, {
      memberId: BIANCA,
      holdEventId: activeHoldId,
      date: DATE,
    }).household;
    household = withdrawHouseholdFundContribution(household, {
      memberId: JONATHAN,
      proposalEventId: proposalId,
      date: DATE,
    }).household;

    story = buildSharedLedgerStory(household, "2026-09-02");
    expect(story.queue.some((item) => item.id === `confirm-${proposalId}`)).toBe(false);
    expect(story.trust.pendingProposalCount).toBe(0);
    expect(story.weekly.find((event) => event.kind === "contribution-hold-released")).toMatchObject({
      label: "Contribution Hold released",
      recordOnly: true,
      actorLabel: "Bianca",
    });
    expect(story.weekly.find((event) => event.kind === "contribution-withdrawn")).toMatchObject({
      label: "Contribution proposal withdrawn",
      recordOnly: true,
      actorLabel: "Jonathan",
    });
    const changeHtml = renderToStaticMarkup(createElement(SharedLedgerStory, {
      story,
      onOpenFund: () => undefined,
      onOpenHealth: () => undefined,
      panel: "change",
    }));
    expect(changeHtml).toContain("record only");
    expect(changeHtml).toContain("Held — let&#x27;s talk about this.");
    expect(changeHtml).not.toContain("$25.00");
    expect(changeHtml).not.toContain("contribution-held");
  });
});

describe("buildSharedLedgerStory", () => {
  it("answers now / change / attention / next / trust from Shared-safe facts only", () => {
    let { household } = fundedScenario();
    household = addAccount(household, {
      name: "Bianca savings backing",
      kind: "savings",
      ownerMemberId: BIANCA,
      scope: "personal",
      institution: "Private bank",
      last4: "1234",
    }).household;
    const backing = household.accounts.find((row) => row.name === "Bianca savings backing")!;
    household = bindHouseholdFundBackingAccount(household, { memberId: BIANCA, accountId: backing.id }).household;
    household = recordHouseholdFundReconciliation(household, {
      memberId: BIANCA,
      date: "2026-09-04",
      bankTotal: "2500",
      personalRemainder: "1560",
    }).household;
    const shared = projectLedgerExperience(household, JONATHAN, "household", "2026-09-04");
    if (!shared.ok) throw new Error("expected ok");
    const story = buildSharedLedgerStory(shared.scopedHousehold, "2026-09-04");
    expect(story.opening.headline).toBe("Together, right now");
    expect(story.opening.freeToSpendCents).toBe(92000);
    expect(story.trust.custodyDisclosure).toContain("Hearth cannot move it");
    expect(story.weekly.find((event) => event.kind === "contribution-confirmed")).toMatchObject({
      label: "Contribution confirmed",
      recordOnly: false,
    });
    expect(story.monthly.closingOperatingCents).toBe(94000);
    expect(JSON.stringify(story)).not.toContain("Private bank");
    expect(JSON.stringify(story)).not.toContain("bankTotalCents");
    expect(JSON.stringify(story)).not.toContain("1234");
    expect(JSON.stringify(story)).not.toContain(backing.id);
  });

  it("renders a $0.00 opening chapter before setup", () => {
    const story = buildSharedLedgerStory(catalogHousehold(), DATE);
    expect(story.opening.configured).toBe(false);
    expect(story.opening.operatingBalanceCents).toBe(0);
    expect(story.opening.body).toContain("The money remains in Bianca’s savings. Hearth cannot move it.");
    expect(story.opening.body).not.toContain("cannot hold, move, withdraw, or delete");
    expect(story.queue.some((item) => item.kind === "setup-fund")).toBe(true);
  });
});

describe("buildPersonalLedgerStory", () => {
  it("keeps partner Personal rows and Shared Fund flow out of Jonathan’s folio", () => {
    let { household } = fundedScenario();
    household = addAccount(household, {
      name: "Bianca savings backing",
      kind: "savings",
      ownerMemberId: BIANCA,
      scope: "personal",
      institution: "Private bank",
      last4: "1234",
    }).household;
    household = addAccount(household, {
      name: "Jonathan cash",
      kind: "other",
      ownerMemberId: JONATHAN,
      scope: "personal",
    }).household;
    const personal = projectLedgerExperience(household, JONATHAN, "personal", "2026-09-04");
    if (!personal.ok) throw new Error("expected ok");
    const folio = buildPersonalLedgerStory(personal.scopedHousehold, JONATHAN, "2026-09-04");
    expect(folio.position.map((row) => row.name)).toEqual(["Jonathan cash"]);
    expect(folio.contributionBridge.some((row) => row.status === "confirmed" && row.amountCents === 100000)).toBe(true);
    expect(JSON.stringify(folio)).not.toContain("Private bank");
    expect(JSON.stringify(folio)).not.toContain("Fund free-to-spend");
    expect(folio.privateReconciliationAvailable).toBe(false);
  });
});
