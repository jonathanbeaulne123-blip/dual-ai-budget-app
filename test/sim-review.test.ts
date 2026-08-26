import { describe, expect, it } from "vitest";
import {
  executeHerculesReadToolPlan,
  runCashCinema,
  runTipOracle,
  runWhatIfDesk,
  runYearReview,
  seedDemoHousehold,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("Hercules Sim + Review packs (D-142)", () => {
  it("projects a cash cinema ribbon with oracle-horizon tip scaling", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const cinema = runCashCinema(household, today, { weeks: 13 });
    expect(cinema.weeks).toHaveLength(13);
    expect(cinema.weeks[0]!.weekStart).toBe(today);
    expect(cinema.weeks[0]!.openingCashCents).toBe(cinema.openingCashCents);
    expect(cinema.lowestCashCents).toBeLessThanOrEqual(cinema.openingCashCents);
    expect(cinema.oracleHorizonDays).toBeLessThanOrEqual(62);
    const oracle = runTipOracle(household, {
      today,
      horizonDays: 13 * 7,
      iterations: 800,
      seed: 211,
    });
    expect(oracle).not.toBeNull();
    expect(cinema.weeks[0]!.tipTypicalCents).toBe(Math.round((oracle!.p50Cents * 7) / oracle!.horizonDays));
    expect(cinema.weeks[0]!.tipFloorCents).toBe(Math.round((oracle!.p10Cents * 7) / oracle!.horizonDays));
    expect(cinema.assumptions.some((line) => /Monte Carlo|oracle/i.test(line))).toBe(true);
    expect(household).toEqual(before);
  });

  it("runs named what-if scenarios as unposted projections", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const cut = runWhatIfDesk(household, today, { scenario: "cut_one_dinner_shift" });
    expect("error" in cut).toBe(false);
    if (!("error" in cut)) {
      expect(cut.deltaCashCents).toBeLessThan(0);
      expect(cut.label).toMatch(/dinner/i);
      expect(cut.fits === true || cut.fits === false).toBe(true);
    }
    const buy = runWhatIfDesk(household, today, { scenario: "purchase", amountCents: 50_000 });
    expect("error" in buy).toBe(false);
    if (!("error" in buy)) {
      expect(buy.afterCashCents).toBe(buy.beforeCashCents - 50_000);
      expect(buy.assumptions.some((line) => /not posted/i.test(line))).toBe(true);
    }
    expect(household).toEqual(before);
  });

  it("replays tip months and member-scoped actuals for year review", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const review = runYearReview(household, today, { months: 6 });
    expect(review.tipMonths).toHaveLength(6);
    expect(review.totalTipsCents).toBeGreaterThan(0);
    expect(review.shiftCount).toBeGreaterThan(0);
    expect(review.memberScoped).toBe(false);
    expect(review.assumptions.some((line) => /non-reversed|monthSummary|budget tools/i.test(line))).toBe(true);

    const member = household.members[0]!.id;
    const scoped = runYearReview(household, today, { months: 6, memberId: member });
    expect(scoped.memberScoped).toBe(true);
    expect(scoped.totalTipsCents).toBeLessThanOrEqual(review.totalTipsCents);
  });

  it("exposes the three packs through Hercules read tools as projections", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const run = executeHerculesReadToolPlan(household, {
      calls: [
        { name: "cash_cinema", args: { weeks: 6 } },
        { name: "what_if_desk", args: { scenario: "extra_card_pay", amountCents: 25_000 } },
        { name: "year_review", args: { months: 4 } },
        { name: "post_entry", args: { amountCents: 1 } },
      ],
    }, today, { memberId: "MEM-001", view: "household" });
    expect(household).toEqual(before);
    expect(run.results.map((result) => result.name)).toEqual([
      "cash_cinema", "what_if_desk", "year_review",
    ]);
    expect(run.results.every((result) => result.status === "ok")).toBe(true);
    expect(run.results[0]?.facts.every((fact) => fact.basis === "projection")).toBe(true);
    expect(run.results[1]?.facts.every((fact) => fact.basis === "projection")).toBe(true);
    expect(run.results[2]?.facts.find((fact) => fact.label === "Budget misses")?.basis).toBe("projection");
    expect(run.results[2]?.facts.find((fact) => fact.label === "Total tips")?.basis).toBe("journal");

    const missing = executeHerculesReadToolPlan(household, {
      calls: [{ name: "what_if_desk", args: { scenario: "nope" } }],
    }, today, { memberId: "MEM-001", view: "household" });
    expect(missing.results[0]?.status).toBe("empty");
  });

  it("keeps partner-personal tip canaries out of household cinema facts", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const partner = household.members.find((row) => row.id !== "MEM-001")?.id ?? "MEM-002";
    const canaryNote = "PARTNER-PERSONAL-CANARY-99999";
    const poisoned = {
      ...household,
      shifts: [
        ...household.shifts,
        {
          ...household.shifts[0]!,
          id: "SHIFT-CANARY-PERSONAL",
          memberId: partner,
          netTipsCents: 9_999_900,
          note: canaryNote,
          visibility: "personal" as const,
        },
      ],
    };
    const run = executeHerculesReadToolPlan(poisoned, {
      calls: [
        { name: "cash_cinema", args: { weeks: 4 } },
        { name: "what_if_desk", args: { scenario: "purchase", amountCents: 1000 } },
        { name: "year_review", args: { months: 3 } },
      ],
    }, today, { memberId: "MEM-001", view: "personal" });
    const blob = JSON.stringify(run.results);
    expect(blob).not.toContain(canaryNote);
    expect(blob).not.toContain("9999900");
    expect(blob).not.toContain("$99,999.00");
  });
});
