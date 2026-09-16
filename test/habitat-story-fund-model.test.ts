// @vitest-environment jsdom
import { execFile, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, describe, expect, it, vi } from "vitest";
import { householdPlanGuard, migrateFundModel } from "../src/core/fundModelCommands.ts";
import { fundModelMode } from "../src/core/fundRules.ts";
import { fundSnapshot } from "../src/core/fundModel.ts";
import { pathEras } from "../src/core/pathEras.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { missingSubscriptions } from "../src/core/missingSubscriptions.ts";
import { cellarIncomeJars } from "../src/core/cellarIncomeJars.ts";
import { queenRibbons } from "../src/core/queenPresentation.ts";
import { fundModelSnapshot, planStudioV3Model } from "../src/plan-v3/model.ts";
import PlanStudioV3 from "../src/plan-v3/PlanStudioV3.tsx";
import { QueenCellar } from "../src/queen/QueenCellar.tsx";
import type { CommitResult, Household } from "../src/core/types.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * D-282 with main's Our Story habitat (#497, D-268): the twenty-five-month fictional household sorts
 * cleanly under the money model, and the Plan Studio v3 and the cellar v3 render against it.
 * Generated once in a child Node process, as `habitat-story.test.ts` does.
 */
const TODAY = "2026-09-16" as const;
const M1 = "MEM-001";
const LONG = 1_200_000;
const ready: Promise<Household> = (async () => {
  const dir = join(process.cwd(), "scripts/tmp");
  mkdirSync(dir, { recursive: true });
  const stamp = `${process.pid}-${Date.now()}`;
  const script = join(dir, `story-fund-${stamp}.mjs`);
  const output = join(dir, `story-fund-${stamp}.json`);
  const entry = `
    import { writeFileSync } from "node:fs";
    import { generateDemoSuite } from "./src/core/demoSuite.ts";
    const { household } = await generateDemoSuite({ today: "${TODAY}", seed: 41, profile: "habitat-story", numberStyle: "realistic", buildSha: "test", fundModel: 2 });
    writeFileSync(process.argv[2], JSON.stringify(household));
  `;
  try {
    // The esbuild CLI, not its API: the API refuses to run under jsdom's TextEncoder.
    const bundled = spawnSync(join(process.cwd(), "node_modules/.bin/esbuild"), ["--bundle", "--packages=external", "--platform=node", "--format=esm", "--target=node20", "--loader=ts", `--sourcefile=${join(process.cwd(), "story-entry.ts")}`, `--outfile=${script}`, "--log-level=error"], { input: entry, cwd: process.cwd() });
    if (bundled.status !== 0) throw new Error(String(bundled.stderr));
    await promisify(execFile)(process.execPath, ["--max-semi-space-size=64", script, output], { maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(readFileSync(output, "utf8")) as Household;
  } finally {
    rmSync(script, { force: true });
    rmSync(output, { force: true });
  }
})();
let story: Household;
let sorted: Household;
const loaded = ready.then((household) => {
  story = household;
  sorted = migrateFundModel(household, { memberId: M1, at: `${TODAY}T13:00:00.000Z` }).household;
});
afterAll(() => { vi.unstubAllEnvs(); });

describe("Our Story under the money model", () => {
  it("sorts cleanly: nothing refuses it, bills live in Prepare, and the parts add up to the King", async () => {
    await loaded;
    expect(householdPlanGuard(story)).toBeNull();
    expect(fundModelMode(sorted)).toBe(2);
    const snap = fundSnapshot(sorted, { memberId: M1, view: "household", today: TODAY });
    expect(snap.prepare.bills.length).toBeGreaterThan(0);
    expect(snap.prepare.bills.map((row) => row.name)).toEqual(expect.arrayContaining(["Rent"]));
    expect(snap.owedBackCents + snap.prepare.amountCents + snap.protect.amountCents + snap.build.amountCents + snap.everyday.amountCents).toBe(snap.kingCents);
    // Its bills are paid from cards and accounts, not the Fund: nothing is called short.
    expect(snap.prepare.shortOn).toBeUndefined();
    // No household bill design is still filed under Protect.
    expect((sorted.kittyNestDesigns ?? []).filter((row) => row.visibility === "household" && row.category === "protect" && /^(recurrence|potential|task|plan-line|appointment):/.test(row.bankKey))).toEqual([]);
    // Posted money is untouched.
    expect(sorted.transactions).toEqual(story.transactions);
  }, LONG);

  it("keeps the journey: the same eras, and the island shapes gain umbrellas without losing a month", async () => {
    await loaded;
    expect(pathEras(sorted, TODAY).map((era) => [era.spec.name, era.state])).toEqual(pathEras(story, TODAY).map((era) => [era.spec.name, era.state]));
    const before = pathMonths(story, TODAY), after = pathMonths(sorted, TODAY);
    expect(after.map((row) => row.key)).toEqual(before.map((row) => row.key));
    expect(before.every((row) => row.umbrellas === undefined)).toBe(true);
    expect(after.some((row) => Object.keys(row.umbrellas ?? {}).length > 0)).toBe(true);
  }, LONG);

  it("reads the Plan Studio v3 and the cellar v3 selectors without surprises", async () => {
    await loaded;
    const model = planStudioV3Model(sorted, { memberId: M1, view: "household", today: TODAY, source: fundModelSnapshot });
    expect(model.snapshot.mode).toBe(2);
    expect(model.sentence.length).toBeGreaterThan(0);
    expect(model.snapshot.flow?.days).toHaveLength(30);
    const missing = missingSubscriptions(sorted, { today: TODAY, memberId: M1 });
    expect(missing.open.every((row) => row.differenceCents > 0)).toBe(true);
    expect(() => cellarIncomeJars(sorted, { today: TODAY, memberId: M1 })).not.toThrow();
  }, LONG);

  it("renders the rest screen and the cellar against the story household (both flags on)", async () => {
    await loaded;
    vi.stubEnv("VITE_CELLAR_V3", "1");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onCommand = async (fn: (current: Household) => CommitResult) => ({ ...fn(sorted), ok: true });
    try {
      await act(async () => root.render(createElement(PlanStudioV3, { household: sorted, view: "household", memberId: M1, today: TODAY, busy: false, onCommand, snapshotSource: fundModelSnapshot })));
      expect(host.querySelectorAll(".pv3-fund")).toHaveLength(3);
      expect(host.querySelector("h1")?.textContent).toBe("September");
      await act(async () => root.render(createElement(QueenCellar, {
        ribbons: queenRibbons(sorted, TODAY), open: true, stairRef: createRef<HTMLButtonElement>(), onExit: () => {}, onOpenBanks: () => {}, world: "flat",
        household: sorted, memberId: M1, today: TODAY, busy: false, onCommand,
      })));
      expect(host.querySelector(".queen-cellar-rail")).not.toBeNull();
      expect(host.querySelector(".queen-cellar-rail")!.textContent).not.toMatch(/\$\d/);
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  }, LONG);
});
