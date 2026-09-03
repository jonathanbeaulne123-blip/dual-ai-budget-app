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
  openClaim,
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
  return fundPlates({ household, today: TODAY, findings: [] });
}

describe("the Fund's plates", () => {
  it("puts the ten Fund widgets on the shared floor, the Level first", () => {
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
    if (level.figure.primitive === "spark") {
      expect(level.figure.actualCount).toBeGreaterThan(0);
      expect(level.figure.actualCount).toBeLessThan(level.figure.points.length);
    }
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

  it("never lets an open proposal make the Level say the month is covered", () => {
    let household = fund();
    household = contribute(household, BIANCA, "100", "2026-09-02");
    household = bill(household, "200", "2026-09-20", "Hydro");
    household = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN, contributorMemberId: JONATHAN, amount: "200", date: TODAY,
    }).household;

    const level = board(household).find((plate) => plate.id === "fund-level")!;
    expect(level.verdict).toMatch(/runs dry/);
    expect(level.verdict).not.toBe("This month is covered.");
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

  it("keeps Personal shift facts off the Shared week", () => {
    expect(source).not.toContain("postedShiftDates");
    expect(source).not.toMatch(/whose shift|shifts? posted/i);
  });

  it("keeps an incoming claim visible in the collapsed settlement glance", () => {
    let household = fund();
    household = postEntry(household, {
      date: "2026-09-10", type: "expense", amount: "47",
      accountId: "ACC-VISA", subcategoryId: "SUB-TRANSPORT-TRANSIT", note: "Client Uber",
      createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
    }).household;
    household = openClaim(household, {
      expenseTransactionId: household.transactions.at(-1)!.id,
      expectedRecovery: 47,
      claimKind: "employer",
      claimLabel: "Work expense",
      createdBy: BIANCA,
    }).household;

    const settle = board(household).find((plate) => plate.id === "settle")!;
    expect(settle.glance).toBe("House owed $47.00");
    expect(settle.glance).not.toBe("Settled");
  });

  it("keeps claims sourced from Personal expenses off the Shared settlement plate", () => {
    let household = fund();
    household = postEntry(household, {
      date: "2026-09-10", type: "expense", amount: "47",
      accountId: "ACC-VISA", subcategoryId: "SUB-TRANSPORT-TRANSIT", note: "Private ride",
      createdBy: BIANCA, visibility: "personal", confirmDuplicate: true,
    }).household;
    household = openClaim(household, {
      expenseTransactionId: household.transactions.at(-1)!.id,
      expectedRecovery: 47,
      claimKind: "employer",
      claimLabel: "Private work expense",
      createdBy: BIANCA,
    }).household;

    const settle = board(household).find((plate) => plate.id === "settle")!;
    expect(settle.glance).toBe("Settled");
    expect(settle.verdict).toBe("The Fund owes nothing right now.");
    expect(settle.empty).toBe("Nothing outstanding either way.");
    expect(JSON.stringify(settle)).not.toContain("47.00");
  });

  it("shows the highest-utilization shared card regardless of account order", () => {
    let household = fund();
    const visa = household.accounts.find((account) => account.id === "ACC-VISA")!;
    household.accounts.push({ ...structuredClone(visa), id: "ACC-HOT", name: "Hot card" });
    household = postEntry(household, {
      date: "2026-09-08", type: "expense", amount: "10",
      accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Visa item",
      createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-09-09", type: "expense", amount: "800",
      accountId: "ACC-HOT", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Hot item",
      createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
    }).household;

    const accounts = board(household).find((plate) => plate.id === "accounts")!;
    expect(accounts.verdict).toContain("Hot card is carrying $800.00");
    expect(accounts.figure).toMatchObject({ primitive: "gauge", label: "Hot card" });
  });

  it("keeps a projected tail after more than 24 actual Fund movements", () => {
    let household = fund();
    for (let index = 0; index < 25; index += 1) {
      household = contribute(household, BIANCA, "10", "2026-09-02");
    }
    household = bill(household, "20", "2026-09-20", "Hydro");

    const level = board(household).find((plate) => plate.id === "fund-level")!;
    expect(level.figure.primitive).toBe("spark");
    if (level.figure.primitive === "spark") {
      expect(level.figure.points).toHaveLength(13);
      expect(level.figure.actualCount).toBe(12);
      expect(level.figure.actualCount).toBeLessThan(level.figure.points.length);
    }
  });

  it("does not call unknown-only category history in shape", () => {
    let household = fund();
    household = postEntry(household, {
      date: "2026-09-10", type: "expense", amount: "45",
      accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", note: "Shop",
      createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
    }).household;

    const shape = board(household).find((plate) => plate.id === "shape")!;
    expect(shape.glance).toBe("Not enough yet");
    expect(shape.verdict).toBe("Not enough history yet to draw a shape for anything.");
  });

  it("describes an all-quiet month without calling it inside the band", () => {
    let household = fund();
    for (const month of ["06", "07", "08"]) {
      household = postEntry(household, {
        date: `2026-${month}-10`, type: "expense", amount: "100",
        accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", note: "Shop",
        createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
      }).household;
    }

    const shape = board(household).find((plate) => plate.id === "shape")!;
    expect(shape.glance).toBe("Nothing over shape");
    expect(shape.verdict).toBe("No category with enough history is above its own trailing shape.");
  });

  it("carries the shared week across month-end", () => {
    let household = fund();
    household = contribute(household, BIANCA, "980", "2026-09-02");
    household = bill(household, "125", "2026-10-01", "Hydro");

    const week = fundPlates({ household, today: "2026-09-28", findings: [] })
      .find((plate) => plate.id === "week")!;
    expect(week.glance).toBe("−$125.00");
    expect(week.verdict).toBe("This week $125.00 leaves the Fund.");
    expect(week.figure).toMatchObject({
      primitive: "track",
      days: 7,
      marks: [expect.objectContaining({ day: 4, label: "Hydro" })],
    });
  });

  it("keeps every personal account off the Shared board", () => {
    expect(source).toContain('account.scope !== "personal"');
    expect(source).not.toContain("account.ownerMemberId === memberId");
  });

  it("cannot post, settle, or move a cent", () => {
    expect(source).not.toMatch(/\b(postEntry|postTransfer|confirmHouseholdFundSettlement|commit)\s*\(/);
    expect(source).not.toMatch(/ratio|percent|rank/i);
  });

  it("leaves the original board alone until a Fund exists", () => {
    const household = catalogHousehold();
    const dashboard = buildDashboard(household, TODAY, new Date(`${TODAY}T16:00:00Z`));
    expect(fundPlates({ household, today: TODAY, findings: [] })).toEqual([]);
    expect(sharedPlates({ household, dashboard, today: TODAY, findings: [] }).length).toBe(6);
  });
});
