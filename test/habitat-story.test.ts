import { movesForChapter, ritualsForChapter } from "../src/core/chapters.ts";
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { canonicalDemoFixtureHash, type DemoRunReport, type DemoSuiteManifest } from "../src/core/demoSuite.ts";
import { STORY_NAME } from "../src/core/habitat.ts";
import { runHealthCheck } from "../src/core/health.ts";
import { compileHousehold, trialBalance } from "../src/core/journal.ts";
import { pathEras, pathMonthBroke } from "../src/core/pathEras.ts";
import { pathMonthCharacter, pathMonths } from "../src/core/pathSignals.ts";
import { pathBridges } from "../src/core/pathBridges.ts";
import { pathFootpaths } from "../src/core/pathFootpaths.ts";
import { pathStones } from "../src/core/pathStones.ts";
import { guessCategorySignal, pathIslandName, pendingPathProposals, type PathEraSpec, type PathRecipeSpec } from "../src/core/pathWorld.ts";
import { seedStressHousehold, STRESS_TIP_SEASONS } from "../src/core/stressSeed.ts";
import { withSyntheticRuntime } from "../src/core/syntheticRuntime.ts";
import { shiftMonthKey } from "../src/core/calendar.ts";
import type { Household } from "../src/core/types.ts";

const TODAY = "2026-09-16" as const;
const M = "2026-09";
const at = (k: number) => shiftMonthKey(M, k);
const M1 = "MEM-001", M2 = "MEM-002";

/**
 * "Our Story" (D-268): generated and verified once for the whole file. Twenty-five months through the
 * ordinary commands take minutes of synchronous work — longer than a Vitest worker can stay silent — so
 * the Demo Suite's own `generateDemoSuite` and `verifyDemoSuite` run in a child Node process built from
 * the same sources, and the household comes back as JSON for the reads below.
 */
type Generated = { household: Household; manifest: DemoSuiteManifest; report: DemoRunReport; generatedMs: number; verifiedMs: number };
const ready: Promise<Generated> = (async () => {
  const dir = join(process.cwd(), "scripts/tmp");
  mkdirSync(dir, { recursive: true });
  const stamp = `${process.pid}-${Date.now()}`;
  const script = join(dir, `habitat-story-${stamp}.mjs`);
  const output = join(dir, `habitat-story-${stamp}.json`);
  const entry = `
    import { writeFileSync } from "node:fs";
    import { generateDemoSuite, verifyDemoSuite } from "./src/core/demoSuite.ts";
    const started = Date.now();
    const { household, manifest } = await generateDemoSuite({ today: "${TODAY}", seed: 41, profile: "habitat-story", numberStyle: "realistic", buildSha: "test" });
    const generatedMs = Date.now() - started;
    const report = await verifyDemoSuite(household, manifest);
    writeFileSync(process.argv[2], JSON.stringify({ household, manifest, report, generatedMs, verifiedMs: Date.now() - started - generatedMs }));
  `;
  try {
    await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, packages: "external", platform: "node", format: "esm", target: "node20", outfile: script, logLevel: "error" });
    await promisify(execFile)(process.execPath, ["--max-semi-space-size=64", script, output], { maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(readFileSync(output, "utf8")) as Generated;
  } finally {
    rmSync(script, { force: true });
    rmSync(output, { force: true });
  }
})();
let story: Household;
let fixtureHash = "";
const loaded = ready.then((result) => {
  story = result.household;
  fixtureHash = result.manifest.fixtureHashSha256;
  return result;
});
const verified = async () => (await loaded).report;

const LONG = 1_200_000;

describe("Our Story — the sample household for the Journey of Life", () => {
  it("is a Development-only synthetic habitat with twenty-five months behind it", async () => {
    await loaded;
    expect(story.environment).toBe("development");
    expect(story.syntheticFixture?.profile).toBe("habitat-story");
    expect(story.name).toBe(STORY_NAME);
    const months = new Set(story.transactions.map((row) => row.date.slice(0, 7)));
    expect([...months].sort()).toEqual(Array.from({ length: 25 }, (_, i) => at(i - 24)));
    // Nothing from the investor rig, and none of the seed's sample goals.
    expect(story.transactions.some((row) => /CANARY/.test(row.note ?? ""))).toBe(false);
    expect(story.goals.some((row) => row.name === "Weekend in Montréal" || /pottery wheel/.test(row.name))).toBe(false);
  }, LONG);

  it("keeps balanced books, a clean health check, and replays byte-for-byte from its seed", async () => {
    await loaded;
    expect(trialBalance(compileHousehold(story), { recognizedOnly: true }).inBalance).toBe(true);
    expect(runHealthCheck(story)).toEqual([]);
    expect(await canonicalDemoFixtureHash(story)).toBe(fixtureHash);
    const result = await verified();
    expect(result.checks.filter((row) => row.status === "fail")).toEqual([]);
    expect(result.checks.find((row) => row.id === "replay")?.status).toBe("pass");
    expect(result.checks.find((row) => row.id === "desk-seals")?.status).toBe("pass");
    expect(result.status).toBe("ready");
    const { generatedMs, verifiedMs } = await loaded;
    console.info(`Our Story: generated in ${(generatedMs / 1000).toFixed(1)}s, verified (with replay) in ${(verifiedMs / 1000).toFixed(1)}s`);
  }, LONG);

  it("walks the journey: moved in and crossed, making it ours with two lanterns lit, a house and retirement ahead", async () => {
    await loaded;
    const eras = pathEras(story, TODAY);
    expect(eras.map((era) => [era.spec.name, era.state])).toEqual([
      ["Moving in", "past"], ["Make it ours", "current"], ["Our first house", "future"], ["Retirement", "future"],
    ]);
    const [first, second, third, fourth] = eras as [typeof eras[number], typeof eras[number], typeof eras[number], typeof eras[number]];
    expect(first.spec.crossedOn).toBe(at(-12));
    expect(first.spec.finish).toEqual({ kind: "survive", months: 12 });
    expect(first.progress.met).toBe(true);
    expect(first.months).toHaveLength(12);
    expect(second.spec.from).toBe(at(-12));
    expect(second.progress.lanterns).toHaveLength(8);
    expect(second.progress.lanterns.filter((row) => row.lit).map((row) => row.label)).toEqual(["The sofa · bought", "Plant corner · full"]);
    expect(second.plans.map((row) => row.label)).toEqual(expect.arrayContaining(["Tofino trip", "Emergency buffer", "Make Room for Joy"]));
    expect(third.spec.home).toBe("house");
    expect(third.spec.finish.kind).toBe("banks");
    expect(third.plans.filter((row) => row.sketched).map((row) => row.label)).toEqual(["Adopt a dog"]);
    expect(third.pendingBy).toBe(M1);
    expect(fourth.spec).toMatchObject({ home: "porch", finish: { kind: "agree" }, from: at(96), by: at(575) });
    // No month of the first year ended with the Fund or shared cash below zero — nor any month since.
    for (let k = -24; k <= -1; k += 1) expect(pathMonthBroke(story, at(k))).toBeNull();
    // Words only on the journey.
    for (const era of eras) expect(JSON.stringify(era.spec)).not.toMatch(/\$\d/);
  }, LONG);

  it("grows the island from the months: lean winters, a storm, milestones and three trips", async () => {
    await loaded;
    const months = pathMonths(story, TODAY);
    expect(months).toHaveLength(25);
    const character = new Map(months.map((row) => [row.key, pathMonthCharacter(row)]));
    const winters = months.filter((row) => /-(01|02)$/.test(row.key) && row.key !== at(-19));
    expect(winters.length).toBeGreaterThanOrEqual(3);
    // The lean months inside the money Ritual have no accepted buffer receipts.
    // Their dated Tasks stay open, so the island must not invent a held rhythm.
    for (const row of winters) expect(character.get(row.key)).toBe([at(-8), at(-7)].includes(row.key) ? "paused" : "uphill");
    expect(character.get(at(-19))).toBe("storm");
    expect(months.find((row) => row.key === at(-18))?.scores.saved).toBeGreaterThan(0);
    expect([...character.values()].filter((row) => row === "milestone").length).toBeGreaterThanOrEqual(3);
    expect(months.filter((row) => row.trip).map((row) => [row.key, row.trip!.type])).toEqual([[at(-14), "sea"], [at(-11), "city"], [at(-2), "sea"]]);
    for (const signal of ["home", "garden", "pets", "fitness", "generosity", "celebration", "creative", "social", "travel", "joy", "rhythm", "together", "learning"] as const) {
      expect(months.some((row) => row.scores[signal] > 0), signal).toBe(true);
    }
    // Something new: the coffee-bean club's category has no island word yet.
    expect(guessCategorySignal("Roaster club", "Pantry")).toBeNull();
    const fresh = months.filter((row) => row.unmappedCategories.some((cat) => cat.name === "Roaster club")).map((row) => row.key);
    expect(fresh[0]).toBe(at(-1));
    expect(months.flatMap((row) => row.unmappedCategories).map((row) => row.name).filter((name) => name !== "Roaster club")).toEqual([]);
  }, LONG);

  it("never lets a Personal row reach the island", async () => {
    await loaded;
    const personal = story.transactions.filter((row) => row.visibility === "personal");
    expect(personal.map((row) => row.note)).toEqual(expect.arrayContaining(["Haircut", "Jonathan's running gear"]));
    const without = { ...story, transactions: story.transactions.filter((row) => row.visibility !== "personal") };
    expect(pathMonths(without, TODAY)).toEqual(pathMonths(story, TODAY));
  }, LONG);

  it("tells the together story: Charter, name, six Chapters, a kept Memory and things still waiting", async () => {
    await loaded;
    expect(story.charter?.foundedOn).toBe(`${at(-24)}-02`);
    expect(story.charter?.signatures.every((row) => row.signedAt)).toBe(true);
    expect(pathIslandName(story)).toBe("Harbour Light");
    const chapters = story.chapters ?? [];
    expect(chapters.map((row) => [row.foundationId, row.state])).toEqual([
      ["see-our-shared-life", "established"], ["handle-a-surprise-together", "established"], ["make-rent-boring", "established"],
      ["build-breathing-room", "established"], ["share-the-mental-load", "still-forming"], ["make-room-for-joy", "open"],
    ]);
    const joy = chapters.at(-1)!;
    expect(joy.openedAt.slice(0, 7)).toBe(at(-1));
    expect(ritualsForChapter(story, joy.id)[0]?.heldOn).toHaveLength(3);
    const rent = ritualsForChapter(story, chapters[2]!.id)[0]!;
    expect(rent.heldOn.length).toBeGreaterThanOrEqual(12);
    const buffer = ritualsForChapter(story, chapters[3]!.id)[0]!;
    const occurrences = story.tasks!.filter(row => row.chapterSource?.sourceId === buffer.id);
    expect(buffer.requiresMoneyEvidence).toBe(true);
    expect(buffer.heldOn.length).toBeGreaterThan(0);
    expect(buffer.heldOn.length).toBeLessThan(12);
    expect(occurrences).toHaveLength(12);
    expect(occurrences.some(row => row.completedAt === null)).toBe(true);
    for (const occurrence of occurrences.filter(row => row.completedAt)) {
      expect(occurrence.completionEvidence?.kind).toBe("goal-contribution");
      expect(occurrence.completionEvidence?.date).toBe(occurrence.chapterSource?.onDate);
    }
    const waiting = movesForChapter(story, joy.id).filter((row) => row.state === "offered" && row.needsAcknowledgment);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.acknowledgedByMemberIds).toEqual([M2]);
    const memory = (story.wins ?? []).find((row) => row.title === "The sofa is home")!;
    expect(memory.keptByMemberIds.sort()).toEqual([M1, M2]);
    expect(memory.shownAt.slice(0, 7)).toBe(at(-3));
    const pending = pendingPathProposals(story);
    expect(pending.map((row) => [row.kind, row.pendingBy])).toEqual(expect.arrayContaining([["recipe", M1], ["era", M1]]));
    const recipe = pending.find((row) => row.kind === "recipe")!.pending as PathRecipeSpec;
    expect(recipe).toMatchObject({ name: "Movie nights hang lanterns", brush: "lanterns" });
    expect((pending.find((row) => row.kind === "era")!.pending as PathEraSpec).name).toBe("Our first house");
    // Shared Sitdowns closed every month from the first one, and every month's Fund plan agreed by both.
    expect((story.planHerculesSessions ?? []).filter((row) => row.state === "closed")).toHaveLength(24);
    expect(story.fundMonthPlans).toHaveLength(25);
    expect(story.fundMonthPlans!.every((row) => row.agreedByMemberIds.length === 2)).toBe(true);
    // The Fund dipped into the cushion once, for Hercules.
    const released = (story.fundEvents ?? []).filter((row) => row.kind === "kitty-released");
    expect(released.map((row) => [row.date.slice(0, 7), row.amountCents])).toEqual([[at(-19), 60_000]]);
  }, LONG);

  it("keeps one of every bill on the rail, paid on its day, with the meal kit cancelled", async () => {
    await loaded;
    expect(story.recurrences.length).toBeGreaterThanOrEqual(18);
    expect(story.recurrences.filter((row) => row.type === "expense" && row.subcategoryId === "SUB-HOUSING-RENT")).toHaveLength(1);
    expect(story.recurrences.find((row) => row.note === "Meal kit")?.active).toBe(false);
    const rentByMonth = new Map<string, number>();
    for (const row of story.transactions) if (row.type === "expense" && row.subcategoryId === "SUB-HOUSING-RENT") rentByMonth.set(row.date.slice(0, 7), (rentByMonth.get(row.date.slice(0, 7)) ?? 0) + 1);
    expect(rentByMonth.size).toBe(25);
    expect([...rentByMonth.values()].every((count) => count === 1)).toBe(true);
    for (const note of ["Rent", "Toronto Hydro", "Enbridge Gas", "Mobile phones", "Pottery studio", "Coffee beans"]) {
      const rec = story.recurrences.find((row) => row.note === note)!;
      expect(story.transactions.some((row) => row.source === "recurring" && row.sourceId === rec.id), note).toBe(true);
    }
    expect(story.recurrences.filter((row) => row.fundingDefault).map((row) => row.note).sort()).toEqual(["Enbridge Gas", "Internet", "Mobile phones", "Rent", "Tenant insurance", "Toronto Hydro", "Transit passes"]);
  }, LONG);

  it("lays stepping stones, a private footpath and a bridge", async () => {
    await loaded;
    const stones = pathStones(story, M1, TODAY);
    expect(stones.length).toBeGreaterThanOrEqual(5);
    expect(stones.some((row) => row.money && row.lit)).toBe(true);
    expect(stones.some((row) => row.state === "open")).toBe(true);
    expect(pathFootpaths(story, M2, TODAY).map((row) => row.label)).toEqual(["Price out bed frames"]);
    expect(pathFootpaths(story, M1, TODAY)).toEqual([]);
    expect(pathBridges(story, M1, TODAY).map((row) => [row.label, row.stage])).toEqual([["Dining table sooner", 2]]);
    expect((story.nativeEvents ?? []).map((row) => row.title)).toEqual(["Cottage weekend with friends", "Weekend in Montréal", "Tofino trip"]);
  }, LONG);
});

describe("seedStressHousehold options", () => {
  it("defaults are exactly the twelve-month seed", async () => {
    const run = (options: Partial<Parameters<typeof seedStressHousehold>[0]>) => withSyntheticRuntime(7, `${TODAY}T12:00:00.000Z`, () => JSON.stringify(seedStressHousehold({ today: "2026-02-10", seed: 99, ...options })));
    const plain = run({});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(plain).toBe(run({ months: 12, tipSeasons: false, fixedBills: true, sampleGoals: true }));
  }, LONG);

  it("scales harbour tips by season only when asked, and refuses more than three years", () => {
    const tips = (tipSeasons: boolean) => withSyntheticRuntime(7, "2026-01-31T12:00:00.000Z", () => seedStressHousehold({ today: "2026-01-31", seed: 5, months: 1, tipSeasons }))
      .shifts.reduce((sum, row) => sum + (row.cashTipsCents ?? 0), 0);
    expect(STRESS_TIP_SEASONS[0]).toBe(0.62);
    expect(tips(true)).toBeLessThan(tips(false) * 0.75);
    expect(() => seedStressHousehold({ today: TODAY, months: 37 })).toThrow(/1–36 months/);
  }, LONG);
});
