import { describe, expect, it } from "vitest";
import { catalogHousehold, nameHouseholdLedgers } from "../src/core/index.ts";
import { FUND_DEFAULT_LABEL, MY_MONEY_LABEL, OUR_HOME_LABEL, fundDisplayName, spaceLabel } from "../src/core/spaceNames.ts";
import { fabActionsFor, fabClosedLabel } from "../src/core/fabActions.ts";
import { deriveFundPulseInput, fundPulse, type FundPulseInput } from "../src/core/fundPulse.ts";
import { FAB_ADD_ACTIONS } from "../src/FabSpeedDial.tsx";
import { householdHomeV2Enabled } from "../src/core/planFeature.ts";

const base: FundPulseInput = {
  configured: true,
  freshness: "current",
  reconciliationTied: true,
  criticalDrift: 0,
  attentionDrift: 0,
  awaitingMe: 0,
  awaitingPartner: 0,
  topUpNeededCents: 0,
  activeChapter: false,
};

describe("Vision v2 slice 1 — space names (Decision 1 and 10)", () => {
  it("presents legacy default ledger names as My Money and Our Home without rewriting them", () => {
    const household = catalogHousehold();
    expect(spaceLabel(household, "MEM-002", "household")).toBe(OUR_HOME_LABEL);
    expect(spaceLabel(household, "MEM-002", "personal")).toBe(MY_MONEY_LABEL);
    expect(spaceLabel(household, "MEM-001", "personal")).toBe(MY_MONEY_LABEL);
    // Stored defaults are untouched: presentation only.
    expect(household.ledgerNames.shared).toBe("Household Ledger");
  });

  it("keeps names the couple chose themselves", () => {
    const named = nameHouseholdLedgers(catalogHousehold(), {
      householdName: "The North House",
      sharedLedgerName: "Kitchen Books",
      personalLedgerName: "Jonathan's Quiet Books",
      personalMemberId: "MEM-002",
    });
    expect(spaceLabel(named, "MEM-002", "household")).toBe("Kitchen Books");
    expect(spaceLabel(named, "MEM-002", "personal")).toBe("Jonathan's Quiet Books");
    expect(spaceLabel(named, "MEM-001", "personal")).toBe(MY_MONEY_LABEL);
  });

  it("labels the household truth destination with the Fund's name, defaulting to The Fund", () => {
    const household = catalogHousehold();
    expect(fundDisplayName(household)).toBe(FUND_DEFAULT_LABEL);
    const renamed = {
      ...household,
      householdFund: household.householdFund ? { ...household.householdFund, name: "The Kitchen Jar" } : household.householdFund,
    };
    expect(fundDisplayName(renamed)).toBe(household.householdFund ? "The Kitchen Jar" : FUND_DEFAULT_LABEL);
  });
});

describe("Vision v2 slice 1 — adaptive action", () => {
  it("keeps My Money's direct four in their known order", () => {
    expect(fabActionsFor("personal", "home").map((row) => row.id)).toEqual(["shift", "income", "expense", "transfer"]);
    expect(fabActionsFor("personal", "calendar")).toBe(fabActionsFor("personal", "home"));
    expect(FAB_ADD_ACTIONS.map((row) => row.mode)).toEqual(["shift", "income", "expense", "transfer"]);
    expect(fabClosedLabel("personal")).toBe("Add money");
  });

  it("keeps Our Home's + on four money verbs, reordered by destination, and never a navigation verb (row 5)", () => {
    expect(fabActionsFor("household", "home")[0]!.id).toBe("record-expense");
    expect(fabActionsFor("household", "plan").slice(0, 2).map((row) => row.id)).toEqual(["record-expense", "move-money"]);
    expect(fabActionsFor("household", "ledger").slice(0, 3).map((row) => row.id)).toEqual(["record-expense", "add-income", "move-money"]);
    for (const tab of ["home", "ledger", "plan", "together", "planner", "timeMachine"]) {
      const actions = fabActionsFor("household", tab);
      expect(actions).toHaveLength(4);
      expect(actions.every((row) => row.kind === "add" && row.money)).toBe(true);
    }
    expect(fabClosedLabel("household")).toBe("Add money");
  });

  it("keeps every money verb on an Add mode and marks navigation verbs as non-money", () => {
    for (const tab of ["home", "ledger", "plan", "together", "planner", "timeMachine"]) {
      for (const action of fabActionsFor("household", tab)) {
        if (action.kind === "add") expect(action.money).toBe(true);
        else expect(action.money).toBe(false);
      }
      expect(fabActionsFor("household", tab).some((row) => row.kind === "add" && row.mode === "shift")).toBe(true);
    }
  });
});

describe("Vision v2 slice 1 — the Fund pulse", () => {
  it("never speaks confidently over stale or offline evidence", () => {
    expect(fundPulse({ ...base, freshness: "stale" }).state).toBe("checking");
    expect(fundPulse({ ...base, freshness: "offline" }).destination).toBe("status");
    expect(fundPulse({ ...base, reconciliationTied: false }).state).toBe("checking");
    expect(fundPulse({ ...base, reconciliationTied: null })).toMatchObject({ state: "checking", destination: "fund" });
  });

  it("orders reset above needs-us above covered", () => {
    expect(fundPulse({ ...base, criticalDrift: 1, awaitingMe: 2 }).state).toBe("reset");
    expect(fundPulse({ ...base, awaitingPartner: 1 }).state).toBe("needs-us");
    expect(fundPulse({ ...base, topUpNeededCents: 18_000 })).toMatchObject({ state: "needs-us", amountCents: 18_000, destination: "fund" });
    expect(fundPulse(base).state).toBe("covered");
    expect(fundPulse({ ...base, activeChapter: true }).state).toBe("building");
  });

  it("describes the plan, never the people, and never totals contributions", () => {
    const text = Object.values(fundPulse({ ...base, awaitingMe: 1, awaitingPartner: 1 })).join(" ");
    expect(text).not.toMatch(/owes|behind|failed|score|streak/i);
    expect(fundPulse({ ...base, awaitingMe: 1, awaitingPartner: 1 }).headline).toBe("A few things need us.");
    expect(fundPulse({ ...base, awaitingMe: 1 }).detail).toBe("One item is waiting for you to review.");
  });

  it("derives its input from accepted books without posting anything", () => {
    const household = catalogHousehold();
    const before = JSON.stringify(household);
    const input = deriveFundPulseInput(household, { memberId: "MEM-002", today: "2026-09-12", freshness: "current" });
    expect(JSON.stringify(household)).toBe(before);
    expect(typeof input.configured).toBe("boolean");
    expect(input.awaitingMe).toBeGreaterThanOrEqual(0);
    expect(input.awaitingPartner).toBeGreaterThanOrEqual(0);
    expect(input.topUpNeededCents).toBeGreaterThanOrEqual(0);
    const pulse = fundPulse(input);
    expect(["checking", "reset", "needs-us", "covered", "building"]).toContain(pulse.state);
    expect(pulse.headline.length).toBeGreaterThan(0);
  });
});

describe("Vision v2 feature family", () => {
  it("never exposes Household Home without the Plan V2 room it links to", () => {
    expect(householdHomeV2Enabled(undefined, undefined)).toBe(false);
    expect(householdHomeV2Enabled("1", "0")).toBe(false);
    expect(householdHomeV2Enabled("0", "1")).toBe(false);
    expect(householdHomeV2Enabled("1", "1")).toBe(true);
  });
});
