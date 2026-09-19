import { knownCents } from "./fixtures/knownCents.ts";
import { describe, expect, it } from "vitest";
import { generateDemoSuite } from "../src/core/index.ts";
import { householdPlanGuard, migrateFundModel } from "../src/core/fundModelCommands.ts";
import { fundModelMode } from "../src/core/fundRules.ts";
import { fundSnapshot } from "../src/core/fundModel.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

/** D-282: fictional seeds a money-model build can sort. Synthetic data only. */
const TODAY = "2026-08-29" as const;

describe("fictional seeds sort under the money model (D-282)", () => {
  it("the investor Demo Suite stays as it was by default, and files bills under Prepare for a money-model build", async () => {
    const v1 = await generateDemoSuite({ today: TODAY, seed: 8675309, buildSha: "test-sha" });
    const v1Bills = v1.household.planVersions!.flatMap(row => row.lines).filter(line => line.kind === "obligation");
    expect(v1Bills.length).toBeGreaterThan(0);
    expect(v1Bills.every(line => line.lens === "protect")).toBe(true);
    expect(householdPlanGuard(v1.household)).toMatch(/still keeps bills in Protect/);

    const v2 = await generateDemoSuite({ today: TODAY, seed: 8675309, buildSha: "test-sha", fundModel: 2 });
    const v2Bills = v2.household.planVersions!.flatMap(row => row.lines).filter(line => line.kind === "obligation");
    expect(v2Bills.map(line => line.id)).toEqual(v1Bills.map(line => line.id));
    expect(v2Bills.every(line => line.lens === "prepare")).toBe(true);
    expect(householdPlanGuard(v2.household)).toBeNull();
    const sorted = migrateFundModel(v2.household, { memberId: "MEM-002", at: `${TODAY}T13:00:00.000Z` }).household;
    expect(fundModelMode(sorted)).toBe(2);
    const snap = fundSnapshot(sorted, { memberId: "MEM-002", view: "household", today: TODAY });
    expect(snap.owedBackCents + knownCents(snap.prepare.amountCents) + knownCents(snap.protect.amountCents) + knownCents(snap.build.amountCents) + knownCents(snap.everyday.amountCents)).toBe(snap.kingCents);
    // Replay of the money-model seed is still exact.
    const again = await generateDemoSuite({ today: TODAY, seed: 8675309, buildSha: "test-sha", fundModel: 2 });
    expect(again.household.syntheticFixture?.fixtureHashSha256).toBe(v2.household.syntheticFixture?.fixtureHashSha256);
  }, 600_000);

  it("the habitats already sort", async () => {
    const habitat = await generateDemoSuite({ today: TODAY, seed: 4242, profile: "habitat-hard" });
    expect(householdPlanGuard(habitat.household)).toBeNull();
    expect(fundModelMode(migrateFundModel(habitat.household, { memberId: "MEM-001", at: `${TODAY}T13:00:00.000Z` }).household)).toBe(2);
  }, 300_000);

  it("the plan-life fixture sorts when written for the money model", () => {
    expect(() => migrateFundModel(planLifeFixture("household"), { memberId: "MEM-001" })).toThrow(/still keeps bills in Protect/);
    const sorted = migrateFundModel(planLifeFixture("household", { fundModel: 2 }), { memberId: "MEM-001" }).household;
    expect(fundModelMode(sorted)).toBe(2);
  });
});
