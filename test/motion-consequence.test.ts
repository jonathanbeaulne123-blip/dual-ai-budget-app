// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WaitingStage } from "../src/WaitingStage.tsx";
import {
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  fundWalk,
  holdHouseholdFundContribution,
  HOUSEHOLD_FUND_ID,
  motionConsequence,
  postEntry,
  proposeHouseholdFundContribution,
  setHouseholdFundMonthPlan,
  shapeWorkJob,
  withdrawHouseholdFundContribution,
  type CommitResult,
  type Household,
  type WorkJob,
  type WorkPaySchedule,
} from "../src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const motionConsequenceSource = readFileSync(resolve(process.cwd(), "src/core/motionConsequence.ts"), "utf8");
const waitingStageSource = readFileSync(resolve(process.cwd(), "src/WaitingStage.tsx"), "utf8");

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA, openedOn: "2026-08-01", createdBy: BIANCA,
  }).household;
}
function contribute(household: Household, memberId: string, amount: string, date: string) {
  const proposed = proposeHouseholdFundContribution(household, { memberId, contributorMemberId: memberId, amount, date });
  const confirmed = confirmHouseholdFundContribution(proposed.household, { memberId: BIANCA, proposalEventId: proposed.postedIds[0]! });
  return { household: confirmed.household, eventId: confirmed.postedIds[0]! };
}
function propose(household: Household, memberId: string, amount: string, date: string) {
  const proposed = proposeHouseholdFundContribution(household, { memberId, contributorMemberId: memberId, amount, date });
  return { household: proposed.household, eventId: proposed.postedIds[0]! };
}
function fundedPurchase(household: Household, amount: string, date: string, note: string): Household {
  return postEntry(household, {
    date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note,
    createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
    funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: Math.round(Number(amount) * 100), destinationAccountId: "ACC-VISA" },
  }).household;
}
function settle(household: Household, amount: string, date: string): Household {
  return confirmHouseholdFundSettlement(household, { memberId: BIANCA, amount, destinationAccountId: "ACC-VISA", date }).household;
}
function bill(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly", nextDate: date, type: "expense", amount,
    accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}
function halifaxClaim(household: Household): Household {
  const goal = addGoal(household, { name: "Halifax", target: "300", shared: true, ownerMemberId: BIANCA });
  return addRecurrence(goal.household, {
    cadence: "monthly", nextDate: "2026-09-30", type: "transfer", amount: "300",
    accountId: "ACC-CHEQUING", transferToAccountId: "ACC-GOALS",
    goalId: goal.postedIds[0]!, note: "Standing · jar · Halifax",
  }).household;
}

function payJob(memberId: string, paySchedule: WorkPaySchedule): WorkJob {
  return shapeWorkJob({
    id: "JOB-OBSERVED",
    memberId,
    name: "Observed pay clock",
    color: "#31594a",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: false,
    roles: [],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: false,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [],
    salesFields: [],
    paySchedule,
    tipSchedule: paySchedule,
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "personal",
      cashTipsVisibility: "personal",
      cardTipsVisibility: "personal",
      tipOutVisibility: "personal",
      wagesDepositAccountId: "ACC-CHEQUING",
      cashTipsAccountId: "ACC-CASH",
      cardTipsDepositAccountId: "ACC-CHEQUING",
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

/** The already-shipped canonical month from `fund-walk.test.ts` — the settled scenario. */
function settledScenario(): Household {
  let household = configuredFund();
  household = contribute(household, BIANCA, "240", "2026-08-31").household;
  household = contribute(household, BIANCA, "980", "2026-09-02").household;
  household = fundedPurchase(household, "128", "2026-09-04", "Hydro");
  household = settle(household, "128", "2026-09-04");
  household = contribute(household, JONATHAN, "535", "2026-09-05").household;
  household = fundedPurchase(household, "1450", "2026-09-06", "Rent · our share");
  household = settle(household, "1450", "2026-09-06");
  household = contribute(household, BIANCA, "980", "2026-09-18").household;
  household = bill(household, "186", "2026-09-18", "Insurance");
  household = bill(household, "520", "2026-09-19", "Groceries · planned");
  household = bill(household, "92", "2026-09-20", "Internet");
  household = bill(household, "74", "2026-09-22", "Gas");
  household = bill(household, "110", "2026-09-25", "Phone");
  household = bill(household, "215", "2026-09-26", "Vet · Marmalade");
  household = halifaxClaim(household);
  return setHouseholdFundMonthPlan(household, {
    memberId: BIANCA, monthKey: "2026-09", target: "3400", buffer: "400",
  }).household;
}

describe("motionConsequence", () => {
  it("moves the dry date and the shortfall for the canonical $310 motion", () => {
    let household = settledScenario();
    const raised = propose(household, JONATHAN, "310", "2026-09-12");
    household = raised.household;

    const result = motionConsequence(household, "2026-09", "2026-09-12", raised.eventId);

    expect(result).toEqual({
      eventId: raised.eventId,
      balanceAfterCents: 48700,
      dryDateBefore: "2026-09-26",
      dryDateAfter: "2026-09-30",
      shortfallBeforeCents: 34000,
      shortfallAfterCents: 3000,
      copy: "Confirming this puts the Fund at $487.00 and moves the dry date from the 26th to the 30th. "
        + "It would leave the month $30.00 short instead of $340.00.",
    });
  });

  it("uses the clears-the-month copy when confirming erases the dry date entirely", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "50", "2026-09-01").household;
    household = bill(household, "100", "2026-09-10", "Rent");
    const raised = propose(household, JONATHAN, "200", "2026-09-01");
    household = raised.household;

    expect(motionConsequence(household, "2026-09", "2026-09-01", raised.eventId)).toEqual({
      eventId: raised.eventId,
      balanceAfterCents: 25000,
      dryDateBefore: "2026-09-10",
      dryDateAfter: null,
      shortfallBeforeCents: 5000,
      shortfallAfterCents: 0,
      copy: "Confirming this puts the Fund at $250.00 and clears the month.",
    });
  });

  it("uses the nothing-changes copy when there was never a dry date either way", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "500", "2026-09-01").household;
    const raised = propose(household, JONATHAN, "50", "2026-09-01");
    household = raised.household;

    expect(motionConsequence(household, "2026-09", "2026-09-01", raised.eventId)).toEqual({
      eventId: raised.eventId,
      balanceAfterCents: 55000,
      dryDateBefore: null,
      dryDateAfter: null,
      shortfallBeforeCents: 0,
      shortfallAfterCents: 0,
      copy: "Confirming this puts the Fund at $550.00. It doesn't change what the month needs.",
    });
  });

  it("still previews a held motion", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "50", "2026-09-01").household;
    household = bill(household, "100", "2026-09-10", "Rent");
    const raised = propose(household, JONATHAN, "200", "2026-09-01");
    household = holdHouseholdFundContribution(raised.household, {
      memberId: BIANCA, proposalEventId: raised.eventId, note: "Checking something first",
    }).household;

    const result = motionConsequence(household, "2026-09", "2026-09-01", raised.eventId);
    expect(result?.dryDateAfter).toBeNull();
    expect(result?.copy).toContain("clears the month");
  });

  it("replaces a matching observed pay-date estimate instead of counting it twice", () => {
    let household = configuredFund();
    household = contribute(household, JONATHAN, "100", "2026-08-01").household;
    household = contribute(household, JONATHAN, "100", "2026-08-15").household;
    household = contribute(household, JONATHAN, "100", "2026-08-29").household;
    const schedule: WorkPaySchedule = {
      cadence: "biweekly",
      anchorDate: "2026-09-26",
      weekday: 6,
      monthDays: [15, 30],
      customDates: [],
      reminderTime: "09:00",
    };
    household.workJobs = [payJob(JONATHAN, schedule)];
    household = bill(household, "450", "2026-09-30", "Month end bill");
    const raised = propose(household, JONATHAN, "100", "2026-09-26");
    household = raised.household;

    const preview = motionConsequence(household, "2026-09", "2026-09-12", raised.eventId);
    const confirmed = confirmHouseholdFundContribution(household, {
      memberId: BIANCA,
      proposalEventId: raised.eventId,
    }).household;
    const actual = fundWalk(confirmed, "2026-09", "2026-09-12");

    expect(preview?.dryDateAfter).toBe(actual.dryDate);
    expect(preview?.shortfallAfterCents).toBe(actual.shortfallCents);
    expect(preview?.balanceAfterCents).toBe(actual.todayBalanceCents);
    expect(preview?.copy).not.toContain("clears the month");
  });

  it("returns null for a confirmed motion, a withdrawn motion, and an unknown id", () => {
    const confirmed = contribute(configuredFund(), BIANCA, "50", "2026-09-01");
    expect(motionConsequence(confirmed.household, "2026-09", "2026-09-01", confirmed.eventId)).toBeNull();

    const raised = propose(configuredFund(), JONATHAN, "50", "2026-09-01");
    const withdrawn = withdrawHouseholdFundContribution(raised.household, {
      memberId: JONATHAN, proposalEventId: raised.eventId,
    }).household;
    expect(motionConsequence(withdrawn, "2026-09", "2026-09-01", raised.eventId)).toBeNull();

    expect(motionConsequence(configuredFund(), "2026-09", "2026-09-01", "FUND-EVT-NOPE")).toBeNull();
  });
});

describe("WaitingStage", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(household: Household, memberId: string, onKitchen: (fn: (current: Household) => CommitResult) => void = () => undefined) {
    act(() => {
      root.render(createElement(WaitingStage, { household, memberId, today: "2026-09-12", onKitchen }));
    });
  }

  function openMotionHousehold() {
    let household = settledScenario();
    const raised = propose(household, JONATHAN, "310", "2026-09-12");
    household = raised.household;
    return { household, eventId: raised.eventId };
  }

  it("shows the consequence on the confirmer's card, never on the raiser's", () => {
    const { household } = openMotionHousehold();

    render(household, BIANCA);
    expect(container.querySelector(".waiting-consequence")?.textContent).toContain("moves the dry date");

    render(household, JONATHAN);
    expect(container.querySelector(".waiting-consequence")).toBeNull();
    expect(container.querySelector(".fund-stage-heading")?.textContent).toBe("Contribution motions");
    // The raiser still sees their own card, just without the preview.
    expect(container.querySelector(".fund-motion-card")).not.toBeNull();
  });

  it("confirms through onKitchen only on a click, never from rendering", () => {
    const { household, eventId } = openMotionHousehold();
    const calls: Array<(current: Household) => CommitResult> = [];
    render(household, BIANCA, (fn) => calls.push(fn));

    expect(calls).toHaveLength(0);
    const confirmButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Confirm received");
    act(() => { confirmButton?.click(); });

    expect(calls).toHaveLength(1);
    const result = calls[0]!(household);
    expect(result.household.fundEvents?.some((event) => (
      event.kind === "contribution-confirmed" && event.relatedEventId === eventId
    ))).toBe(true);
  });

  it("keeps a held motion's card, still shows its preview, and offers Release", () => {
    const { household: opened, eventId } = openMotionHousehold();
    const household = holdHouseholdFundContribution(opened, {
      memberId: BIANCA, proposalEventId: eventId, note: "Let's talk first",
    }).household;

    render(household, BIANCA);
    expect(container.querySelector('[data-fund-motion-status="held"]')).not.toBeNull();
    expect(container.querySelector(".waiting-consequence")).not.toBeNull();
    expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent === "Release Hold")).toBe(true);
    expect(container.querySelector(".fund-motion-status")?.textContent).toBe("Held — let's talk about this.");
  });

  it("lists confirmed and withdrawn motions as read-only recent decisions", () => {
    let household = settledScenario();
    const confirmed = contribute(household, JONATHAN, "40", "2026-09-01");
    household = confirmed.household;
    const raised = propose(household, JONATHAN, "20", "2026-09-02");
    household = withdrawHouseholdFundContribution(raised.household, {
      memberId: JONATHAN, proposalEventId: raised.eventId,
    }).household;

    render(household, BIANCA);
    const decisions = Array.from(container.querySelectorAll(".waiting-decision"));
    expect(decisions.length).toBeGreaterThanOrEqual(2);
    expect(decisions.some((row) => row.textContent?.includes("Confirmed"))).toBe(true);
    expect(decisions.some((row) => row.textContent?.includes("Withdrawn"))).toBe(true);
    for (const row of decisions) expect(row.querySelector("button")).toBeNull();
  });

  it("shows 'Nothing has moved.' with no open or held motions", () => {
    render(configuredFund(), BIANCA);
    expect(container.querySelector(".desk-plate-empty")?.textContent).toBe("Nothing has moved.");
  });
});

describe("the motion-consequence fences", () => {
  it("reads the walk twice and never imports a command", () => {
    expect(motionConsequenceSource).toContain("fundWalkWith");
    expect(motionConsequenceSource).not.toContain('from "./commands.ts"');
    expect(waitingStageSource).not.toContain('from "./core/commands.ts"');
  });

  it("carries no pressure language", () => {
    for (const source of [motionConsequenceSource, waitingStageSource]) {
      expect(source).not.toMatch(/\bshould\b|\bneed to\b|\bplease\b|\bstill waiting\b/i);
    }
  });
});
