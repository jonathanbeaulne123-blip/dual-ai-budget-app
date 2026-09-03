// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  addRecurrence,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  fundWeek,
  postEntry,
  postShift,
  proposeHouseholdFundContribution,
  setHouseholdFundMonthPlan,
  type Household,
} from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";
const TODAY = "2026-09-17";
const MONTH = "2026-09";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA, openedOn: "2026-08-01", createdBy: BIANCA,
  }).household;
}
function contribute(household: Household, memberId: string, amount: string, date: string): Household {
  const proposed = proposeHouseholdFundContribution(household, { memberId, contributorMemberId: memberId, amount, date });
  return confirmHouseholdFundContribution(proposed.household, { memberId: BIANCA, proposalEventId: proposed.postedIds[0]! }).household;
}
function bill(household: Household, amount: string, date: string, note: string): Household {
  return addRecurrence(household, {
    cadence: "monthly", nextDate: date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note,
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}
function fundedPurchase(household: Household, amount: string, date: string, note: string): Household {
  return postEntry(household, {
    date, type: "expense", amount, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC",
    note, createdBy: BIANCA, visibility: "household", confirmDuplicate: true,
    funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: Math.round(Number(amount) * 100), destinationAccountId: "ACC-VISA" },
  }).household;
}
function settle(household: Household, amount: string, date: string): Household {
  return confirmHouseholdFundSettlement(household, { memberId: BIANCA, amount, destinationAccountId: "ACC-VISA", date }).household;
}
function shift(household: Household, memberId: string, date: string): Household {
  return postShift(household, {
    date, memberId, accountId: "ACC-CASH", sales: "400.00", cashTips: "20.00", ccTips: "40.00", hours: "6.00",
    customersServed: 40, staffingCount: 4,
  }).household;
}

/**
 * Mon 14 – Sun 20 Sep 2026, today the 17th — the workshop's own worked week.
 * Bianca contributes 8/31 and settles a posted Wednesday grocery run in
 * full, so it's off the outstanding total by the time the week is drawn;
 * Jonathan's contribution lands mid-week on the 18th, the same day
 * Insurance comes due; three of Jonathan's shifts land Tue/Fri/Sat.
 */
function canonicalWeek(): Household {
  let household = configuredFund();
  household = contribute(household, BIANCA, "980", "2026-08-31");
  household = contribute(household, JONATHAN, "980", "2026-09-18");
  household = fundedPurchase(household, "84.20", "2026-09-16", "Groceries");
  household = settle(household, "84.20", "2026-09-16");
  household = bill(household, "186", "2026-09-18", "Insurance");
  household = bill(household, "520", "2026-09-19", "Groceries · planned");
  household = bill(household, "92", "2026-09-20", "Internet");
  household = shift(household, JONATHAN, "2026-09-15");
  household = shift(household, JONATHAN, "2026-09-18");
  household = shift(household, JONATHAN, "2026-09-19");
  return setHouseholdFundMonthPlan(household, { memberId: BIANCA, monthKey: MONTH, target: "3400", buffer: "400" }).household;
}

describe("fundWeek", () => {
  it("is Monday-start, seven days, with today flagged once", () => {
    const week = fundWeek(canonicalWeek(), TODAY);
    expect(week.days).toHaveLength(7);
    expect(week.days[0]!.date).toBe("2026-09-14");
    expect(week.days[0]!.weekday).toBe(1);
    expect(week.days[6]!.date).toBe("2026-09-20");
    expect(week.days[6]!.weekday).toBe(0);
    expect(week.days.filter((day) => day.isToday)).toHaveLength(1);
    expect(week.days.find((day) => day.isToday)!.date).toBe(TODAY);
  });

  it("the canonical week's out, in, and shift count", () => {
    const week = fundWeek(canonicalWeek(), TODAY);
    expect(week.outCents).toBe(79800);
    expect(week.inCents).toBe(98000);
    expect(week.shiftCount).toBe(3);
  });

  it("keeps due and posted apart on their own days", () => {
    const week = fundWeek(canonicalWeek(), TODAY);
    const wed = week.days.find((day) => day.date === "2026-09-16")!;
    expect(wed.entries).toContainEqual({ kind: "posted", label: "Groceries", amountCents: 8420, memberId: null });
    const fri = week.days.find((day) => day.date === "2026-09-18")!;
    expect(fri.entries).toContainEqual({ kind: "due", label: "Insurance", amountCents: 18600, memberId: null });
  });

  it("attributes a confirmed contribution to whoever actually made it, never the custodian by default", () => {
    const week = fundWeek(canonicalWeek(), TODAY);
    const fri = week.days.find((day) => day.date === "2026-09-18")!;
    const payday = fri.entries.filter((entry) => entry.kind === "payday");
    expect(payday).toHaveLength(1);
    expect(payday[0]).toEqual({ kind: "payday", label: "Payday", amountCents: 98000, memberId: JONATHAN });
  });

  it("a shift entry's amountCents is null in every fixture, and it names who's on", () => {
    const week = fundWeek(canonicalWeek(), TODAY);
    const shiftEntries = week.days.flatMap((day) => day.entries).filter((entry) => entry.kind === "shift");
    expect(shiftEntries).toHaveLength(3);
    expect(shiftEntries.every((entry) => entry.amountCents === null)).toBe(true);
    expect(shiftEntries.every((entry) => entry.memberId === JONATHAN)).toBe(true);
  });

  it("a cadence: none charter produces no sitdown entry", () => {
    const week = fundWeek(canonicalWeek(), TODAY);
    expect(week.days.flatMap((day) => day.entries).some((entry) => entry.kind === "sitdown")).toBe(false);
  });

  it("a weekly cadence puts sitdown on its own weekday, and nowhere else", () => {
    let household = canonicalWeek();
    // Amend the charter to a weekly cadence landing on Sunday (weekday 0), same as the canonical week's own Sunday.
    household = {
      ...household,
      charter: {
        id: "CHARTER-1", purpose: "", custodianMemberId: BIANCA, splitRule: "even", splitNote: "",
        ceilingKind: "none", ceilingValue: 0, cadence: "weekly", cadenceWeekday: 0,
        clauses: [], permissions: [], signatures: [], amendments: [],
        foundedOn: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z", termsUpdatedAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    };
    const week = fundWeek(household, TODAY);
    const sitdownDays = week.days.filter((day) => day.entries.some((entry) => entry.kind === "sitdown"));
    expect(sitdownDays).toHaveLength(1);
    expect(sitdownDays[0]!.date).toBe("2026-09-20");
  });

  it("a biweekly or monthly cadence produces no sitdown entry either — there is no anchor date to say which week is theirs", () => {
    let household = canonicalWeek();
    household = {
      ...household,
      charter: {
        id: "CHARTER-1", purpose: "", custodianMemberId: BIANCA, splitRule: "even", splitNote: "",
        ceilingKind: "none", ceilingValue: 0, cadence: "biweekly", cadenceWeekday: 0,
        clauses: [], permissions: [], signatures: [], amendments: [],
        foundedOn: "2026-08-01", createdAt: "2026-08-01T00:00:00.000Z", termsUpdatedAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    };
    const week = fundWeek(household, TODAY);
    expect(week.days.flatMap((day) => day.entries).some((entry) => entry.kind === "sitdown")).toBe(false);
  });

  it("counts a contribution confirmed exactly on the week's Monday", () => {
    // fundWeekMovements' own lower bound is exclusive of its anchor date —
    // built for a "from tomorrow" rolling glance, not a calendar week — so
    // naively anchoring on the week's Monday would show the contribution in
    // the grid but silently drop it from inCents. It must land in both.
    let household = configuredFund();
    household = contribute(household, BIANCA, "500", "2026-09-14");
    const week = fundWeek(household, TODAY);
    expect(week.inCents).toBe(50000);
    const monday = week.days[0]!;
    expect(monday.date).toBe("2026-09-14");
    expect(monday.entries).toContainEqual({ kind: "payday", label: "Payday", amountCents: 50000, memberId: BIANCA });
  });

  it("never drops a confirmed contribution with no recorded contributor — it still lands in the grid and the total", () => {
    // Real fund events always carry a contributorMemberId — the command
    // layer requires one — but the field type is nullable, and legacy or
    // migrated rows can lack it. That gap must never make money disappear
    // from the header while it's still sitting in the grid below it.
    let household = contribute(configuredFund(), BIANCA, "500", "2026-09-15");
    household = {
      ...household,
      fundEvents: (household.fundEvents ?? []).map((event) =>
        event.kind === "contribution-confirmed" ? { ...event, contributorMemberId: null } : event,
      ),
    };
    const week = fundWeek(household, TODAY);
    expect(week.inCents).toBe(50000);
    const tue = week.days.find((day) => day.date === "2026-09-15")!;
    expect(tue.entries).toContainEqual({ kind: "payday", label: "Payday", amountCents: 50000, memberId: null });
  });

  it("a personal-visibility shift never appears, and never counts", () => {
    let household = configuredFund();
    household = postShift(household, {
      date: "2026-09-15", memberId: JONATHAN, accountId: "ACC-CASH", hours: "6.00", visibility: "personal",
    }).household;
    const week = fundWeek(household, TODAY);
    expect(week.shiftCount).toBe(0);
    expect(week.days.flatMap((day) => day.entries).some((entry) => entry.kind === "shift")).toBe(false);
  });
});

describe("keeps its fences", () => {
  const coreSource = readFileSync(resolve(process.cwd(), "src/core/fundWeek.ts"), "utf8");
  const stageSource = readFileSync(resolve(process.cwd(), "src/WeekStage.tsx"), "utf8");

  it("fundWeek.ts reads existing money surfaces and computes no balance of its own", () => {
    expect(coreSource).toContain("monthObligations");
    expect(coreSource).toContain("fundWeekMovements");
    expect(coreSource).not.toMatch(/Date\.now|Math\.random|toFixed/);
    expect(coreSource).not.toMatch(/from ".\/commands\.ts"/);
  });

  it("WeekStage.tsx is nothing you can tick off, and never writes", () => {
    expect(stageSource).not.toMatch(/checkbox/i);
    expect(stageSource).not.toMatch(/checked/i);
    expect(stageSource).not.toMatch(/complete/i);
    expect(stageSource).not.toContain("onKitchen");
    expect(stageSource).not.toMatch(/from ".\/core\/commands\.ts"/);
  });
});
