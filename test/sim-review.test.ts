import { describe, expect, it } from "vitest";
import {
  executeHerculesReadToolPlan,
  runCashCinema,
  runWhatIfDesk,
  runYearReview,
  seedDemoHousehold,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("Hercules Sim + Review packs (D-138)", () => {
  it("projects a cash cinema ribbon without mutating the household", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const cinema = runCashCinema(household, today, { weeks: 8 });
    expect(cinema.weeks).toHaveLength(8);
    expect(cinema.weeks[0]!.openingCashCents).toBe(cinema.openingCashCents);
    expect(cinema.lowestCashCents).toBeLessThanOrEqual(cinema.openingCashCents);
    expect(cinema.assumptions.some((line) => /projection|Confirm/i.test(line))).toBe(true);
    expect(household).toEqual(before);
  });

  it("runs named what-if scenarios as unposted projections", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const cut = runWhatIfDesk(household, today, { scenario: "cut_one_dinner_shift" });
    expect(cut.deltaCashCents).toBeLessThan(0);
    expect(cut.label).toMatch(/dinner/i);
    const buy = runWhatIfDesk(household, today, { scenario: "purchase", amountCents: 50_000 });
    expect(buy.afterCashCents).toBe(buy.beforeCashCents - 50_000);
    expect(buy.assumptions.some((line) => /not posted/i.test(line))).toBe(true);
    expect(household).toEqual(before);
  });

  it("replays posted tip months for year review", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const review = runYearReview(household, today, { months: 6 });
    expect(review.tipMonths).toHaveLength(6);
    expect(review.totalTipsCents).toBeGreaterThan(0);
    expect(review.shiftCount).toBeGreaterThan(0);
    expect(review.assumptions.some((line) => /posted/i.test(line))).toBe(true);
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

    const missing = executeHerculesReadToolPlan(household, {
      calls: [{ name: "what_if_desk", args: { scenario: "nope" } }],
    }, today, { memberId: "MEM-001", view: "household" });
    expect(missing.results[0]?.status).toBe("empty");
  });
});
