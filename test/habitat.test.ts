import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDemoSuite, verifyDemoSuite, HABITAT_NAMES } from "../src/core/index.ts";
import { deriveFundPulseInput, fundPulse } from "../src/core/fundPulse.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { cellarReading } from "../src/core/queenCellar.ts";
import { queenRibbons } from "../src/core/queenPresentation.ts";
import { runHealthCheck } from "../src/core/health.ts";
import { compileHousehold, trialBalance } from "../src/core/journal.ts";
import type { Household } from "../src/core/types.ts";

const TODAY = "2026-09-14" as const;
const M1 = "MEM-001";

/** Both habitats from one seed, generated once for the whole file: the generator is the slow part. */
let well: Household, hard: Household;
const ready = (async () => {
  well = (await generateDemoSuite({ today: TODAY, seed: 41, profile: "habitat-well", numberStyle: "realistic", buildSha: "test" })).household;
  hard = (await generateDemoSuite({ today: TODAY, seed: 41, profile: "habitat-hard", numberStyle: "realistic", buildSha: "test" })).household;
})();

const pulseOf = (h: Household) => fundPulse(deriveFundPulseInput(h, { memberId: M1, today: TODAY, freshness: "current", activeChapter: true }));
const cellarOf = (h: Household) => cellarReading(h, projectKittyNest(h, M1, "household", TODAY), TODAY);

describe("The Hercules habitats — two fictional years to walk around in", () => {
  it("are Development-only synthetic showcases with their own names and twelve months behind them", async () => {
    await ready;
    for (const [h, story] of [[well, "well"], [hard, "hard"]] as const) {
      expect(h.environment).toBe("development");
      expect(h.syntheticFixture?.kind).toBe("hearth-demo-suite");
      expect(h.syntheticFixture?.profile).toBe(`habitat-${story}`);
      expect(h.name).toBe(HABITAT_NAMES[story]);
      expect(h.transactions.length).toBeGreaterThan(500);
      expect(h.transactions.some((row) => row.date < "2026-01-01")).toBe(true);
      // Nothing in the investor showcase's test rig: no canaries, no duplicate review pair.
      expect(h.transactions.some((row) => /CANARY/.test(row.note ?? ""))).toBe(false);
      expect(h.goals.some((row) => /CANARY/.test(row.name))).toBe(false);
    }
  }, 120_000);

  it("keep balanced books and a clean health check, because every write went through a command", async () => {
    await ready;
    for (const h of [well, hard]) {
      expect(trialBalance(compileHousehold(h), { recognizedOnly: true }).inBalance).toBe(true);
      expect(runHealthCheck(h)).toEqual([]);
    }
  }, 120_000);

  it("doing well: the Queen reads building, the water stays above the mark, the bills are paid on their day", async () => {
    await ready;
    expect(pulseOf(well).state).toBe("building");
    const cellar = cellarOf(well);
    expect(cellar.walk.dryDate).toBeNull();
    expect(cellar.walk.belowBufferRuns).toEqual([]);
    expect(cellar.jars.filter((jar) => jar.paid).map((jar) => jar.label)).toEqual(expect.arrayContaining(["Rent", "Streaming", "Gym"]));
    expect(cellar.jars.some((jar) => jar.strike === "crack" || jar.strike === "hammer")).toBe(false);
    // Six months of rent on the ribbon, every one on its day.
    const rent = queenRibbons(well, TODAY).find((row) => row.label === "Rent");
    expect(rent?.posted).toBeGreaterThanOrEqual(6);
    // The Charter is signed by both; one Chapter closed established, one open with its ritual kept this month; a win.
    expect(well.charter?.signatures?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect((well.chapters ?? []).map((row) => row.state).sort()).toEqual(["established", "open"]);
    expect((well.wins ?? []).length).toBeGreaterThan(0);
    // Two months closed, every shared account reconciled.
    expect(well.kitchen.books.closedMonths.length).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it("doing badly: the Queen needs us, the water runs under the mark and dry, two bills are overdue, subscriptions crept in", async () => {
    await ready;
    expect(pulseOf(hard).state).toBe("needs-us");
    const cellar = cellarOf(hard);
    expect(cellar.walk.belowBufferRuns.length).toBeGreaterThan(0);
    expect(cellar.walk.dryDate).not.toBeNull();
    const overdue = cellar.jars.filter((jar) => jar.due && !jar.paid && jar.recurrenceId);
    expect(overdue.map((jar) => jar.label)).toEqual(expect.arrayContaining(["Toronto Hydro", "Gym"]));
    expect(cellar.jars.some((jar) => jar.strike === "crack")).toBe(true);
    expect(hard.recurrences.filter((row) => row.kind === "subscription").length).toBeGreaterThanOrEqual(5);
    // The vet came out of the Fund; a double charge was reversed.
    expect(hard.transactions.some((row) => /Emergency vet/.test(row.note ?? "") && row.funding)).toBe(true);
    expect(hard.transactions.some((row) => row.reversalOfId)).toBe(true);
    // The ritual lapsed and a Move was declined; nothing closed for two months.
    expect((hard.chapters ?? []).map((row) => row.state).sort()).toEqual(["open", "still-forming"]);
    expect(hard.kitchen.books.closedMonths.length).toBeLessThan(well.kitchen.books.closedMonths.length);
  }, 120_000);

  it("replay exactly from their seed, and the Demo Suite's own verification passes", async () => {
    await ready;
    const again = await generateDemoSuite({ today: TODAY, seed: 41, profile: "habitat-hard", numberStyle: "realistic", buildSha: "test" });
    expect(again.household.syntheticFixture?.fixtureHashSha256).toBe(hard.syntheticFixture?.fixtureHashSha256);
    expect(well.syntheticFixture?.fixtureHashSha256).not.toBe(hard.syntheticFixture?.fixtureHashSha256);
    const report = await verifyDemoSuite(hard);
    expect(report.checks.filter((check) => check.status === "fail").map((check) => check.id)).toEqual([]);
  }, 180_000);

  it("are one press each in the Development Demo Suite panel, through the same Confirm and the same persist path", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('data-testid="habitat-actions"');
    expect(app).toContain('profile: "habitat-well"');
    expect(app).toContain('profile: "habitat-hard"');
    expect(app).toContain("Habitat · doing well");
    expect(app).toContain("Habitat · doing badly");
    // The habitat rides the Demo Suite's own guard, confirm sheet and creation flow; nothing new posts or persists.
    expect(app).toContain('async function createOrReplayDemoSuite(seed: number, profile: DemoSuiteProfile = "investor")');
    expect(app).toContain("await createOrReplayDemoSuite(seed, profile);");
    expect(app).toContain("Create the Hercules habitat ${guard.profile === \"habitat-well\" ? \"doing well\" : \"doing badly\"}?");
  });
});
