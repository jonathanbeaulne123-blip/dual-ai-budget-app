import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FUND_PLATE_IDS,
  HOUSEHOLD_FUND_ID,
  addRecurrence,
  buildDashboard,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  fundPlates,
  postEntry,
  proposeHouseholdFundContribution,
  setHouseholdFundMonthPlan,
  sharedPlates,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-12";
const source = readFileSync(new URL("../src/core/fundPlates.ts", import.meta.url), "utf8");

function fund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA, openedOn: "2026-08-01", createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, memberId: string, amount: string, date: string): Household {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId, contributorMemberId: memberId, amount, date,
  });
  return confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA, proposalEventId: proposed.postedIds[0]!,
  }).household;
}

function bill(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly", nextDate: date, type: "expense", amount,
    accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

function board(household: Household) {
  return fundPlates({ household, today: TODAY, memberId: BIANCA, findings: [] });
}

describe("the Fund's plates", () => {
  it("puts the eight Fund widgets on the shared floor, the Level first", () => {
    let household = fund();
    household = contribute(household, BIANCA, "980", "2026-09-02");
    const plates = board(household);

    expect(plates.map((plate) => plate.id)).toEqual([...FUND_PLATE_IDS]);
    expect(plates[0]!.id).toBe("fund-level");
    expect(plates[0]!.kicker).toBe("The Household Fund");
  });

  it("leads the Level with the dry date when there is one", () => {
    let household = fund();
    household = contribute(household, BIANCA, "300", "2026-09-02");
    household = bill(household, "900", "2026-09-20", "Rent · our share");
    household = setHouseholdFundMonthPlan(household, {
      memberId: BIANCA, monthKey: "2026-09", target: "1000", buffer: "400",
    }).household;

    const level = board(household)[0]!;
    expect(level.verdict).toMatch(/runs dry on the 20th/);
    expect(level.copperVerdict).toBe(true);
    expect(level.figure.primitive).toBe("spark");
  });

  it("never says the Fund runs dry before a contribution has landed", () => {
    let household = fund();
    household = bill(household, "900", "2026-09-20", "Rent · our share");
    const level = board(household)[0]!;

    expect(level.verdict).toBe("This is only the bills you've told me about. Nothing has actually happened yet.");
  });

  it("names the bill that breaks the month", () => {
    let household = fund();
    household = contribute(household, BIANCA, "300", "2026-09-02");
    household = bill(household, "200", "2026-09-18", "Insurance");
    household = bill(household, "400", "2026-09-24", "Vet · Marmalade");

    const nextOut = board(household).find((plate) => plate.id === "next-out")!;
    expect(nextOut.verdict).toMatch(/Insurance leaves on/);
    expect(nextOut.footing).toBe("Vet · Marmalade is the one that breaks the month.");
    expect(nextOut.copperVerdict).toBe(true);
  });

  it("counts what is waiting without treating a hold as a refusal", () => {
    let household = fund();
    household = contribute(household, BIANCA, "980", "2026-09-02");
    household = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN, contributorMemberId: JONATHAN, amount: "310", date: "2026-09-12",
    }).household;

    const waiting = board(household).find((plate) => plate.id === "waiting")!;
    expect(waiting.glance).toBe("1 to confirm");
    expect(waiting.verdict).toMatch(/waiting on a confirm/);
    expect(waiting.figure).toMatchObject({ primitive: "tally", count: 1 });
  });

  it("says the Fund owes an account, and never that a person owes", () => {
    let household = fund();
    household = contribute(household, BIANCA, "980", "2026-09-02");
    household = postEntry(household, {
      date: "2026-09-10", type: "expense", amount: "84.20",
      accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Groceries",
      createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 8420, destinationAccountId: "ACC-VISA" },
    }).household;

    const settle = board(household).find((plate) => plate.id === "settle")!;
    expect(settle.verdict).toMatch(/^The Fund owes /);
    expect(settle.verdict).not.toMatch(/\byou owe\b|\bowes you\b/i);
    expect(settle.footing).toMatch(/custody act/);
  });

  it("never puts an amount on a posted shift", () => {
    let household = fund();
    household = contribute(household, BIANCA, "980", "2026-09-02");
    const week = board(household).find((plate) => plate.id === "week")!;
    expect(week.footing).not.toMatch(/\$/);
  });

  it("keeps a partner's personal account off the board", () => {
    expect(source).toContain('account.ownerMemberId === memberId');
    expect(source).toContain('account.scope !== "personal"');
  });

  it("cannot post, settle, or move a cent", () => {
    expect(source).not.toMatch(/\b(postEntry|postTransfer|confirmHouseholdFundSettlement|commit)\s*\(/);
    expect(source).not.toMatch(/ratio|percent|rank/i);
  });

  it("leaves the original board alone until a Fund exists", () => {
    const household = catalogHousehold();
    const dashboard = buildDashboard(household, TODAY, new Date(`${TODAY}T16:00:00Z`));
    expect(fundPlates({ household, today: TODAY, memberId: BIANCA, findings: [] })).toEqual([]);
    expect(sharedPlates({ household, dashboard, today: TODAY, memberId: BIANCA, findings: [] }).length).toBe(6);
  });
});
