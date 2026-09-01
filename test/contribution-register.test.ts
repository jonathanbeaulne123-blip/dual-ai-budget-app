import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addGoal,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  contributionRegister,
  allocateHouseholdFundSurplus,
  postEntry,
  postOneRecurrence,
  projectHouseholdFundOperatingBalanceBefore,
  proposeHouseholdFundContribution,
  releaseHouseholdFundKitty,
  reverseHouseholdFundEvent,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA,
    openedOn: "2026-08-01",
    createdBy: BIANCA,
  }).household;
}

function contribute(household: Household, contributorMemberId: string, amount: string, date: string) {
  const proposed = proposeHouseholdFundContribution(household, {
    memberId: contributorMemberId,
    contributorMemberId,
    amount,
    date,
  });
  const confirmed = confirmHouseholdFundContribution(proposed.household, {
    memberId: BIANCA,
    proposalEventId: proposed.postedIds[0]!,
  });
  return { household: confirmed.household, eventId: confirmed.postedIds[0]! };
}

function addExpenseRecurrence(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly",
    nextDate: date,
    type: "expense",
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

describe("contribution register", () => {
  it("allocates the canonical September sources FIFO and preserves the exact shortage", () => {
    let household = configuredFund();
    household = contribute(household, BIANCA, "240", "2026-08-31").household;
    const biancaFirst = contribute(household, BIANCA, "980", "2026-09-04");
    household = biancaFirst.household;
    const jonathanFirst = contribute(household, JONATHAN, "310", "2026-09-06");
    household = jonathanFirst.household;
    const jonathanSecond = contribute(household, JONATHAN, "225", "2026-09-11");
    household = jonathanSecond.household;
    const biancaSecond = contribute(household, BIANCA, "980", "2026-09-18");
    household = biancaSecond.household;

    for (const posted of [
      { date: "2026-09-04", amount: "128", note: "Hydro" },
      { date: "2026-09-05", amount: "1450", note: "Rent · our share" },
      { date: "2026-09-10", amount: "186", note: "Insurance" },
    ]) household = postEntry(household, {
      date: posted.date,
      type: "expense",
      amount: posted.amount,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: posted.note,
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: Math.round(Number(posted.amount) * 100), destinationAccountId: "ACC-VISA" },
    }).household;
    household = addExpenseRecurrence(household, "520", "2026-09-15", "Groceries · planned");
    household = addExpenseRecurrence(household, "92", "2026-09-20", "Internet");
    household = addExpenseRecurrence(household, "74", "2026-09-22", "Gas");
    household = addExpenseRecurrence(household, "110", "2026-09-25", "Phone");
    household = addExpenseRecurrence(household, "215", "2026-09-26", "Vet · Marmalade");
    const goal = addGoal(household, { name: "Winter reserve", target: "300", shared: true, ownerMemberId: BIANCA });
    household = addRecurrence(goal.household, {
      cadence: "monthly",
      nextDate: "2026-09-30",
      type: "transfer",
      amount: "300",
      accountId: "ACC-CHEQUING",
      transferToAccountId: "ACC-GOALS",
      goalId: goal.postedIds[0]!,
      note: "Standing · jar · Winter reserve",
    }).household;

    const result = contributionRegister(household, "2026-09", "2026-09-12");

    expect(result.tiesToProjection).toBe(true);
    expect(result).toMatchObject({
      carriedCents: 24000,
      byMember: [
        { memberId: BIANCA, amountCents: 196000 },
        { memberId: JONATHAN, amountCents: 53500 },
      ],
      owedCents: 307500,
      unfundedCents: 34000,
    });
    expect(result.sources).toMatchObject([
      { kind: "carried", eventId: null, memberId: null, date: "2026-09-01", amountCents: 24000 },
      { kind: "contribution", eventId: biancaFirst.eventId, memberId: BIANCA, amountCents: 98000 },
      { kind: "contribution", eventId: jonathanFirst.eventId, memberId: JONATHAN, amountCents: 31000 },
      { kind: "contribution", eventId: jonathanSecond.eventId, memberId: JONATHAN, amountCents: 22500 },
      { kind: "contribution", eventId: biancaSecond.eventId, memberId: BIANCA, amountCents: 98000 },
    ]);
    expect(result.rows.map((row) => row.segments)).toEqual([
      [{ sourceIndex: 0, amountCents: 12800 }],
      [
        { sourceIndex: 0, amountCents: 11200 },
        { sourceIndex: 1, amountCents: 98000 },
        { sourceIndex: 2, amountCents: 31000 },
        { sourceIndex: 3, amountCents: 4800 },
      ],
      [{ sourceIndex: 3, amountCents: 17700 }, { sourceIndex: 4, amountCents: 900 }],
      [{ sourceIndex: 4, amountCents: 52000 }],
      [{ sourceIndex: 4, amountCents: 9200 }],
      [{ sourceIndex: 4, amountCents: 7400 }],
      [{ sourceIndex: 4, amountCents: 11000 }],
      [{ sourceIndex: 4, amountCents: 17500 }],
      [],
    ]);
    expect(result.rows.map((row) => row.label)).toEqual([
      "Hydro",
      "Rent · our share",
      "Insurance",
      "Groceries · planned",
      "Internet",
      "Gas",
      "Phone",
      "Vet · Marmalade",
      "Winter reserve · goal claim",
    ]);
    expect(result.rows.map((row) => row.unfundedCents)).toEqual([0, 0, 0, 0, 0, 0, 0, 4000, 30000]);
    for (const row of result.rows) {
      expect(row.segments.reduce((sum, segment) => sum + segment.amountCents, 0) + row.unfundedCents).toBe(row.amountCents);
    }
    for (const [sourceIndex, source] of result.sources.entries()) {
      const drawn = result.rows.flatMap((row) => row.segments)
        .filter((segment) => segment.sourceIndex === sourceIndex)
        .reduce((sum, segment) => sum + segment.amountCents, 0);
      expect(drawn).toBeLessThanOrEqual(source.amountCents);
    }
    expect(result.rows.reduce((sum, row) => sum + row.amountCents, 0)).toBe(result.owedCents);
    expect(result.rows.reduce((sum, row) => sum + row.unfundedCents, 0)).toBe(result.unfundedCents);
    expect(result.carriedCents
      + result.sources.filter((source) => source.kind === "contribution").reduce((sum, source) => sum + source.amountCents, 0)
      + result.unfundedCents).toBe(result.owedCents);
  });

  it("keeps a surplus source whole and tied while leaving the excess undrawn", () => {
    let household = contribute(configuredFund(), BIANCA, "500", "2026-09-01").household;
    household = addExpenseRecurrence(household, "100", "2026-09-10", "Phone");

    const result = contributionRegister(household, "2026-09", "2026-09-01");

    expect(result.tiesToProjection).toBe(true);
    expect(result.carriedCents).toBe(0);
    expect(result.sources[1]?.amountCents).toBe(50000);
    expect(result.byMember).toEqual([{ memberId: BIANCA, amountCents: 50000 }]);
    expect(result.rows[0]?.segments).toEqual([{ sourceIndex: 1, amountCents: 10000 }]);
    expect(result.unfundedCents).toBe(0);
  });

  it("excludes proposals and reversed confirmations", () => {
    let household = configuredFund();
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: JONATHAN,
      contributorMemberId: JONATHAN,
      amount: "75",
      date: "2026-09-03",
    });
    household = proposal.household;
    const confirmed = contribute(household, BIANCA, "50", "2026-09-04");
    household = reverseHouseholdFundEvent(confirmed.household, {
      memberId: BIANCA,
      eventId: confirmed.eventId,
      date: "2026-09-05",
      reason: "Correction",
    }).household;
    household = addExpenseRecurrence(household, "100", "2026-09-10", "Phone");

    const result = contributionRegister(household, "2026-09", "2026-09-01");

    expect(result.tiesToProjection).toBe(true);
    expect(result.sources).toEqual([expect.objectContaining({ kind: "carried", amountCents: 0 })]);
    expect(result.byMember).toEqual([]);
    expect(result.unfundedCents).toBe(10000);
  });

  it("orders same-day confirmed contributions by creation time then id", () => {
    let household = configuredFund();
    const first = contribute(household, JONATHAN, "10", "2026-09-05");
    const second = contribute(first.household, BIANCA, "20", "2026-09-05");
    household = { ...second.household, fundEvents: [...(second.household.fundEvents ?? [])].reverse() };

    const result = contributionRegister(household, "2026-09", "2026-09-01");

    expect(result.sources.slice(1).map((source) => source.eventId)).toEqual([first.eventId, second.eventId]);

    const sameCreatedAt = {
      ...household,
      fundEvents: household.fundEvents?.map((event) => (
        event.id === first.eventId || event.id === second.eventId
          ? { ...event, createdAt: "2026-09-05T12:00:00.000Z" }
          : event
      )).reverse(),
    };
    expect(contributionRegister(sameCreatedAt, "2026-09", "2026-09-01").sources.slice(1).map((source) => source.eventId))
      .toEqual([first.eventId, second.eventId].sort());
  });

  it("carries every operating Fund movement strictly before month start", () => {
    let household = contribute(configuredFund(), BIANCA, "500", "2026-08-01").household;
    const purchase = postEntry(household, {
      date: "2026-08-02",
      type: "expense",
      amount: "100",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: JONATHAN,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: 10000, destinationAccountId: "ACC-VISA" },
    });
    household = confirmHouseholdFundSettlement(purchase.household, {
      memberId: BIANCA,
      amount: "60",
      destinationAccountId: "ACC-VISA",
      date: "2026-08-03",
    }).household;
    const goal = addGoal(household, { name: "Emergency", target: "1000", shared: true, ownerMemberId: BIANCA });
    household = allocateHouseholdFundSurplus(goal.household, {
      memberId: BIANCA,
      date: "2026-08-04",
      allocations: [{ goalId: goal.postedIds[0]!, amount: "100" }],
    }).household;
    household = releaseHouseholdFundKitty(household, {
      memberId: BIANCA,
      date: "2026-08-05",
      amount: "40",
    }).household;
    household = contribute(household, JONATHAN, "20", "2026-09-01").household;

    expect(projectHouseholdFundOperatingBalanceBefore(household, "2026-09-01")).toBe(38000);
    const result = contributionRegister(household, "2026-09", "2026-09-01");
    expect(result.carriedCents).toBe(38000);
    expect(result.sources[1]).toMatchObject({ kind: "contribution", memberId: JONATHAN, amountCents: 2000 });
  });

  it("does not carry a reversed pre-month contribution", () => {
    const confirmed = contribute(configuredFund(), BIANCA, "100", "2026-08-20");
    const household = reverseHouseholdFundEvent(confirmed.household, {
      memberId: BIANCA,
      eventId: confirmed.eventId,
      date: "2026-08-21",
      reason: "Correction",
    }).household;

    expect(projectHouseholdFundOperatingBalanceBefore(household, "2026-09-01")).toBe(0);
  });

  it("rejects a confirmed contribution attributed to an unknown member", () => {
    const confirmed = contribute(configuredFund(), BIANCA, "100", "2026-09-05");
    const household = {
      ...confirmed.household,
      fundEvents: confirmed.household.fundEvents?.map((event) => (
        event.id === confirmed.eventId ? { ...event, contributorMemberId: "MEM-UNKNOWN" } : event
      )),
    };

    const result = contributionRegister(household, "2026-09", "2026-09-01");
    expect(result.tiesToProjection).toBe(false);
    expect(result.sources).toEqual([expect.objectContaining({ kind: "carried", amountCents: 0 })]);
    expect(result.byMember).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("MEM-UNKNOWN");
  });

  it("fails closed with fully unfunded rows when Slice 1 does not tie", () => {
    let household = contribute(configuredFund(), BIANCA, "100", "2026-08-31").household;
    const added = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-10",
      type: "expense",
      amount: "25",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Phone",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    });
    const recurrenceId = added.postedIds[0]!;
    household = postOneRecurrence(added.household, recurrenceId, "2026-09-10").household;
    household = {
      ...household,
      recurrences: household.recurrences.map((row) => row.id === recurrenceId ? { ...row, nextDate: "2026-09-10" } : row),
    };

    const result = contributionRegister(household, "2026-09", "2026-09-10");

    expect(result.tiesToProjection).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ amountCents: 2500, segments: [], unfundedCents: 2500 });
  });

  it("stays on shared Fund facts and contains no ratio vocabulary", () => {
    const source = readFileSync(new URL("../src/core/contributionRegister.ts", import.meta.url), "utf8");
    expect(source).toContain("monthObligations");
    expect(source).toContain("projectHouseholdFundOperatingBalanceBefore");
    expect(source).toContain("activeHouseholdFundEvents");
    expect(source).not.toMatch(/fundPrivate|bankBindings|reconciliations/);
    expect(source).not.toMatch(/ratio|share|percentage|percent|ranking/i);
    expect(source).not.toContain("/ total");
  });
});
