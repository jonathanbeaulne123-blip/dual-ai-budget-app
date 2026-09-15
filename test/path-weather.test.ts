import { describe, expect, it } from "vitest";
import { addRecurrence, catalogHousehold, configureHouseholdFund, financialAuditHash, setHouseholdFundMonthPlan } from "../src/core/index.ts";
import { monthObligations } from "../src/core/monthObligations.ts";
import { pathWeather, type PathWeather } from "../src/core/pathWeather.ts";
import type { Household } from "../src/core/types.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

const TODAY = "2026-09-15";
const CUSTODIAN = "MEM-001";

function fundBill(h: Household, input: { date: string; amount: string; note: string; subcategoryId?: string; accountId?: string; cadence?: "monthly" | "daily" }): Household {
  return addRecurrence(h, {
    cadence: input.cadence ?? "monthly", nextDate: input.date, type: "expense", amount: input.amount,
    accountId: input.accountId ?? "ACC-VISA", subcategoryId: input.subcategoryId ?? "SUB-HOUSING-ELECTRIC", note: input.note,
    fundingDefault: { fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;
}

function withPayClock(h: Household): Household {
  // 2026-09-18 is a Friday; a fictional biweekly clock for the Fund custodian.
  return {
    ...h,
    members: h.members.map((row) => row.id === CUSTODIAN
      ? { ...row, earningCadence: { cadence: "biweekly" as const, anchorDate: "2026-09-18", weekday: 5, monthDays: [], customDates: [], reminderTime: "09:00" } }
      : row),
  };
}

const events = (w: PathWeather) => w.days.filter((d) => d.kind !== "clear" && d.kind !== "sunlit");
const DATE = /\d{4}-\d{2}-\d{2}/g;

function expectNoMoney(w: PathWeather) {
  for (const text of [...w.days.flatMap((d) => [d.label, d.why]), ...w.mistWhy]) {
    expect(text).not.toContain("$");
    expect(text.replace(DATE, "")).not.toMatch(/\d{2,}/);
  }
}

describe("Our Path weather — the Calendar as island weather", () => {
  it("turns bills into clouds, with the heaviest one a storm, and never changes the books", async () => {
    const h = fundBill(planLifeFixture("household"), { date: "2026-09-25", amount: "100", note: "Fictional internet" });
    const before = await financialAuditHash(h);
    const w = pathWeather(h, TODAY);
    const bills = events(w).filter((d) => d.kind === "cloud" || d.kind === "storm");
    expect(bills.map((d) => [d.date, d.kind, d.label, d.weight])).toEqual([
      ["2026-09-20", "storm", "Fictional rent", 0.9],
      ["2026-09-25", "cloud", "Fictional internet", 0.1],
    ]);
    expect(bills.every((d) => d.date >= TODAY && d.date <= w.through)).toBe(true);
    expect(w.forecast).toBe("clear");
    expect(await financialAuditHash(h)).toBe(before);
    expectNoMoney(w);
    // Deterministic.
    expect(pathWeather(h, TODAY)).toEqual(w);
  });

  it("names a health bill only as a bill, and hides money-looking labels", () => {
    let h = fundBill(planLifeFixture("household"), { date: "2026-09-22", amount: "50", note: "Fictional therapy session", subcategoryId: "SUB-HEALTH-THERAPY" });
    h = fundBill(h, { date: "2026-09-23", amount: "50", note: "Gym $45 plan 2026" });
    const w = pathWeather(h, TODAY);
    const labels = events(w).map((d) => d.label);
    expect(labels.join(" ")).not.toMatch(/therapy|gym/i);
    expect(events(w).filter((d) => d.date === "2026-09-22" || d.date === "2026-09-23").map((d) => d.label)).toEqual(["A bill", "A bill"]);
    expectNoMoney(w);
  });

  it("makes a payday a sunrise from the Calendar's pay clock", () => {
    const w = pathWeather(withPayClock(planLifeFixture("household")), TODAY);
    const sunrises = events(w).filter((d) => d.kind === "sunrise");
    expect(sunrises.map((d) => d.date)).toEqual(["2026-09-18", "2026-10-02"]);
    expect(sunrises.every((d) => d.weight === 1 && d.label === "Payday")).toBe(true);
    expectNoMoney(w);
  });

  it("keeps covered stretches contiguous and inside the window, and one row per quiet day", () => {
    const w = pathWeather(planLifeFixture("household"), TODAY, { days: 10 });
    expect(w.through).toBe("2026-09-24");
    expect(w.covered).toEqual([{ from: TODAY, to: "2026-09-24" }]);
    for (const [index, range] of w.covered.entries()) {
      expect(range.from <= range.to).toBe(true);
      expect(range.from >= w.asOf && range.to <= w.through).toBe(true);
      if (index > 0) expect(range.from > w.covered[index - 1]!.to).toBe(true);
    }
    const quiet = w.days.filter((d) => d.kind === "sunlit" || d.kind === "clear");
    expect(quiet).toHaveLength(9);
    expect(quiet.every((d) => d.kind === "sunlit")).toBe(true);
    // Clamped to 31 days.
    expect(pathWeather(planLifeFixture("household"), TODAY, { days: 400 }).through).toBe("2026-10-15");
  });

  it("turns to mist below the cushion, with a signpost that names the bill and not the amount", () => {
    let h = planLifeFixture("household");
    h = setHouseholdFundMonthPlan(h, { memberId: CUSTODIAN, monthKey: "2026-09", target: "0", buffer: "3000" }).household;
    const w = pathWeather(h, TODAY);
    expect(w.forecast).toBe("mist");
    const mist = w.days.filter((d) => d.kind === "mist");
    expect(mist).toHaveLength(1);
    expect(mist[0]!.date).toBe("2026-09-20");
    expect(w.mistWhy.at(-1)).toContain("Fictional rent");
    expect(w.mistWhy.length).toBeGreaterThan(1);
    expect(w.covered).toEqual([{ from: TODAY, to: "2026-09-19" }, { from: "2026-10-01", to: "2026-10-15" }]);
    expect(w.days.some((d) => d.kind === "sunlit" && d.date === "2026-09-21")).toBe(false);
    expectNoMoney(w);
  });

  it("reports an unavailable horizon without throwing", () => {
    const h = fundBill(planLifeFixture("household"), { date: "2026-09-16", amount: "5", note: "Fictional daily coffee", cadence: "daily" });
    let w!: PathWeather;
    expect(() => { w = pathWeather(h, TODAY); }).not.toThrow();
    expect(w.forecast).toBe("unavailable");
    expect(w.covered).toEqual([]);
    expect(w.mistWhy).toEqual(["A daily Fund bill needs a complete recurrence review before a long Plan projection."]);
    expect(w.days.some((d) => d.kind === "mist" || d.kind === "sunlit")).toBe(false);

    const broken = pathWeather({ ...h, recurrences: null } as unknown as Household, TODAY);
    expect(broken.forecast).toBe("unavailable");
    expect(broken.mistWhy).toEqual(["The forecast isn't available yet."]);
    expect(pathWeather(h, "not-a-date").forecast).toBe("unavailable");
  });

  it("is all clear for a household with a Fund and no obligations", () => {
    let h = catalogHousehold();
    h = { ...h, recurrences: [] };
    h = configureHouseholdFund(h, { custodianMemberId: CUSTODIAN, openedOn: "2026-09-01", createdBy: CUSTODIAN }).household;
    const w = pathWeather(h, TODAY);
    expect(w.forecast).toBe("clear");
    expect(w.mistWhy).toEqual([]);
    expect(events(w)).toEqual([]);
    expect(w.days).toHaveLength(31);
  });

  it("never lets a personal-account obligation onto the island", () => {
    let h = planLifeFixture("household");
    h = { ...h, accounts: h.accounts.map((row) => row.id === "ACC-CASH" ? { ...row, scope: "personal" as const, ownerMemberId: "MEM-002" } : row) };
    h = fundBill(h, { date: "2026-09-21", amount: "40", note: "Fictional private surprise", accountId: "ACC-CASH" });
    // The Fund still reserves it (masked), so the filter here is what keeps it off the island.
    expect(monthObligations(h, "2026-09", TODAY).rows.some((row) => row.date === "2026-09-21")).toBe(true);
    const w = pathWeather(h, TODAY);
    expect(JSON.stringify(w)).not.toMatch(/private surprise/i);
    expect(events(w).some((d) => d.date === "2026-09-21")).toBe(false);
    expect(events(w).filter((d) => d.kind === "storm" || d.kind === "cloud").map((d) => d.label)).toEqual(["Fictional rent"]);
  });
});
