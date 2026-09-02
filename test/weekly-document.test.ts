import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  acceptHouseholdWrite,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  foundHouseholdCharter,
  householdFundContributionMotions,
  proposeCharterAmendment,
  proposeHouseholdFundContribution,
  stampWeeklyDocument,
  weeklyDocument,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const WEDNESDAY = "2026-09-02";
const SUNDAY = "2026-08-30";

function withCharter(household: Household, cadence: "weekly" | "biweekly" | "monthly" | "none", weekday = 3): Household {
  return foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady.",
    splitRule: "remainder",
    splitNote: "Bianca's pay covers what it covers.",
    ceilingKind: "none",
    cadence,
    cadenceWeekday: weekday,
    date: "2026-09-01",
  }).household;
}

function funded(): Household {
  return configureHouseholdFund(catalogHousehold("development"), {
    custodianMemberId: BIANCA,
    openedOn: "2026-09-01",
    createdBy: BIANCA,
  }).household;
}

function halifaxAsk(household: Household): Household {
  const bill = addRecurrence(household, {
    cadence: "monthly",
    nextDate: "2026-09-20",
    type: "expense",
    amount: "40",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note: "Phone",
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
  const goal = addGoal(bill, { name: "Halifax", target: "300", shared: true, ownerMemberId: BIANCA });
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

function openContribution(household: Household): Household {
  return proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: "40",
    date: WEDNESDAY,
  }).household;
}

describe("weekly document viewer projection", () => {
  it("offers the weekly on the Charter weekday and withholds other cadences", () => {
    const weekly = withCharter(funded(), "weekly", 3);
    const sundayWeekly = withCharter(funded(), "weekly", 0);
    const none = withCharter(funded(), "none");
    const biweekly = withCharter(funded(), "biweekly", 3);
    const monthly = withCharter(funded(), "monthly");

    expect(weeklyDocument(weekly, { viewerMemberId: JONATHAN, today: WEDNESDAY }).offered).toBe(true);
    expect(weeklyDocument(weekly, { viewerMemberId: JONATHAN, today: SUNDAY }).offerReason).toBe("wrong-weekday");
    expect(weeklyDocument(none, { viewerMemberId: JONATHAN, today: WEDNESDAY })).toMatchObject({
      offered: false,
      offerReason: "cadence-none",
    });
    expect(weeklyDocument(biweekly, { viewerMemberId: JONATHAN, today: WEDNESDAY }).offerReason).toBe("unsupported-cadence");
    expect(weeklyDocument(monthly, { viewerMemberId: JONATHAN, today: WEDNESDAY }).offerReason).toBe("unsupported-cadence");
    expect(weeklyDocument(sundayWeekly, { viewerMemberId: JONATHAN, today: SUNDAY, hour: 10 }).kettleSunday).toBe(true);
    expect(weeklyDocument(weekly, { viewerMemberId: JONATHAN, today: WEDNESDAY, hour: 10 }).kettleSunday).toBe(false);
    expect(weeklyDocument(catalogHousehold("development"), { viewerMemberId: JONATHAN, today: WEDNESDAY }).offerReason).toBe("no-charter");
  });

  it("gives routes only to the unique active non-custodian and keeps the other door for both", () => {
    const household = halifaxAsk(withCharter(funded(), "weekly", 3));
    const owner = weeklyDocument(household, { viewerMemberId: JONATHAN, today: WEDNESDAY });
    const custodian = weeklyDocument(household, { viewerMemberId: BIANCA, today: WEDNESDAY });

    expect(owner.askOwnerMemberId).toBe(JONATHAN);
    expect(owner.ask?.askCents).toBe(owner.register.unfundedCents);
    expect(owner.otherDoors[0]?.copy).toBe("Or move Halifax to next month, and the ask is $40.00.");
    expect(owner.routes?.kind).toBe("not-enough-data");
    expect(custodian.otherDoors[0]?.copy).toBe(owner.otherDoors[0]?.copy);
    expect(custodian).not.toHaveProperty("routes");
    expect(JSON.stringify(custodian)).not.toMatch(/watchedShifts|safeCents|expectedCents|"hours"|\"meal\"/);
  });

  it("lets one viewer complete the weekly while the other line stays blank", async () => {
    const household = withCharter(funded(), "weekly", 3);
    const before = weeklyDocument(household, { viewerMemberId: JONATHAN, today: WEDNESDAY });
    expect(before.canStampOwnLine).toBe(true);
    expect(before.complete).toBe(false);

    const stamped = stampWeeklyDocument(household, {
      memberId: JONATHAN,
      today: WEDNESDAY,
      now: "2026-09-02T16:00:00.000Z",
    });
    const accepted = await acceptHouseholdWrite({
      previous: household,
      candidate: stamped.household,
      confirmationId: "weekly-jonathan",
      commandKind: "stampWeeklyDocument",
      postedIds: stamped.postedIds,
      actingMemberId: JONATHAN,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    const after = weeklyDocument(accepted.household, { viewerMemberId: JONATHAN, today: WEDNESDAY });
    const partner = weeklyDocument(accepted.household, { viewerMemberId: BIANCA, today: WEDNESDAY });

    expect(after.complete).toBe(true);
    expect(after.canStampOwnLine).toBe(false);
    expect(partner.canStampOwnLine).toBe(true);
    expect(partner.stampLines.find((line) => line.memberId === BIANCA)?.stamp).toBeNull();
  });

  it("lists exact Fund and Charter motion ids without changing them on stamp", () => {
    let household = openContribution(withCharter(funded(), "weekly", 3));
    household = proposeCharterAmendment(household, {
      memberId: JONATHAN,
      field: "purpose",
      toText: "Keep the lights on.",
    }).household;
    const fundId = householdFundContributionMotions(household)[0]!.proposal.id;
    const charterId = household.charter!.amendments[0]!.id;
    const before = weeklyDocument(household, { viewerMemberId: JONATHAN, today: WEDNESDAY });
    const stamped = stampWeeklyDocument(household, {
      memberId: JONATHAN,
      today: WEDNESDAY,
      now: "2026-09-02T16:00:00.000Z",
    }).household;
    const after = weeklyDocument(stamped, { viewerMemberId: JONATHAN, today: WEDNESDAY });

    expect(before.motions.map((motion) => `${motion.kind}:${motion.id}:${motion.status}`).sort()).toEqual(
      [`charter:${charterId}:open`, `fund:${fundId}:open`].sort(),
    );
    expect(after.motions).toEqual(before.motions);
    expect(stamped.fundEvents).toEqual(household.fundEvents);
    expect(stamped.charter?.amendments).toEqual(household.charter?.amendments);
  });

  it("withholds routes when there is not exactly one active non-custodian", () => {
    const household = withCharter(funded(), "weekly", 3);
    household.members = household.members.map((member) => (
      member.id === JONATHAN ? { ...member, active: false } : member
    ));
    const view = weeklyDocument(household, { viewerMemberId: BIANCA, today: WEDNESDAY });
    expect(view.askOwnerMemberId).toBeNull();
    expect(view).not.toHaveProperty("routes");
  });

  it("keeps Clerk, register, and Ask math in their sealed modules", () => {
    const source = readFileSync(new URL("../src/core/weeklyDocument.ts", import.meta.url), "utf8");
    expect(source).toContain("clerkReading(");
    expect(source).toContain("contributionRegister(");
    expect(source).toContain("householdAsk(");
    expect(source).toContain("askAlternatives(");
    expect(source).toContain("askRoutes(");
    expect(source).toContain("householdFundContributionMotions(");
    expect(source).not.toMatch(/\bpercent\b|\bratio\b|\bshare\b/i);
    expect(source).not.toContain("SitDownSession");
    expect(source).not.toContain("saveSitDownSession");
    expect(source).not.toContain("moveAskGoalClaimToNextMonth");
  });
});
