import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import type { MiniJourney, MiniMonth } from "../src/path/mini/miniJourneyModel.ts";

/**
 * The simple view on "Our Story" (D-268's fictional sample household): the habitat is generated in a child
 * Node process (minutes of synchronous commands, as in habitat-story.test.ts) and the read-model runs there
 * too, so only the small model comes back. Fictional Development data only.
 */
const TODAY = "2026-09-16";
type Result = { alex: MiniJourney; sam: MiniJourney; october: MiniMonth; september: MiniMonth; taskCount: number; privateTitles: string[] };
const ready: Promise<Result> = (async () => {
  const dir = join(process.cwd(), "scripts/tmp");
  mkdirSync(dir, { recursive: true });
  const stamp = `${process.pid}-${Date.now()}`;
  const script = join(dir, `journey-mini-story-${stamp}.mjs`);
  const output = join(dir, `journey-mini-story-${stamp}.json`);
  const entry = `
    import { writeFileSync } from "node:fs";
    import { generateDemoSuite } from "./src/core/demoSuite.ts";
    import { miniJourney, miniMonth } from "./src/path/mini/miniJourneyModel.ts";
    const { household } = await generateDemoSuite({ today: "${TODAY}", seed: 41, profile: "habitat-story", numberStyle: "realistic", buildSha: "test" });
    const alex = miniJourney(household, { memberId: "MEM-001", today: "${TODAY}" });
    const sam = miniJourney(household, { memberId: "MEM-002", today: "${TODAY}" });
    const october = miniMonth(household, "2026-10", { memberId: "MEM-001", today: "${TODAY}", journey: alex });
    const september = miniMonth(household, "2025-09", { memberId: "MEM-001", today: "${TODAY}", journey: alex });
    const privateTitles = (household.tasks ?? []).filter((t) => t.visibility === "personal").map((t) => t.title + "|" + t.createdBy);
    writeFileSync(process.argv[2], JSON.stringify({ alex, sam, october, september, taskCount: (household.tasks ?? []).length, privateTitles }));
  `;
  try {
    await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, packages: "external", platform: "node", format: "esm", target: "node20", outfile: script, logLevel: "error" });
    await promisify(execFile)(process.execPath, ["--max-semi-space-size=64", script, output], { maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(readFileSync(output, "utf8")) as Result;
  } finally {
    rmSync(script, { force: true });
    rmSync(output, { force: true });
  }
})();
const LONG = 1_200_000;

describe("the simple view on Our Story", () => {
  it("reads four eras: Moving in crossed, Make it ours current, the house and retirement planned", async () => {
    const { alex } = await ready;
    expect(alex.eras.map((e) => [e.order, e.name, e.state])).toEqual([
      [1, "Moving in", "crossed"], [2, "Make it ours", "current"], [3, "Our first house", "future"], [4, "Retirement", "future"],
    ]);
    const current = alex.eras[1]!;
    expect(current).toMatchObject({ worldId: "era-home", from: "2025-09", to: "2027-08", monthCount: 24, finishKind: "banks", banksFull: 2 });
    expect(current.banks).toHaveLength(8);
    expect(current.banks.filter((b) => b.full).map((b) => b.name).sort()).toEqual(["Plant corner", "The sofa"]);
    expect(current.banks.find((b) => b.name === "The sofa")).toMatchObject({ bought: true, fill: 1 });
    expect(current.banks.every((b) => b.step >= 0 && b.step <= 10)).toBe(true);
    // Twelve Chapters behind us in this era closed at their Sitdowns, this month open, the rest ahead.
    expect(current.months.filter((m) => m.status === "closed")).toHaveLength(12);
    expect(current.months.find((m) => m.current)).toMatchObject({ key: "2026-09", status: "open", worldId: "month:12", lap: 12 });
    expect(current.months.filter((m) => m.status === "ahead")).toHaveLength(11);
    expect(alex.eras[0]!.months).toHaveLength(12);
    // Retirement is forty years: drawn as 36 laps, counted in full.
    expect(alex.eras[3]!.monthCount).toBeGreaterThan(400);
    expect(alex.eras[3]!.months).toHaveLength(36);
    expect(alex.eras[2]!.plans.some((p) => p.label === "Adopt a dog")).toBe(true);
  }, LONG);

  it("opens September inside Make Room for Joy with the Fund's own bills and contributions", async () => {
    const { alex } = await ready;
    expect(alex.month.chapter?.title).toBe("Make Room for Joy");
    expect(alex.month.fundReady).toBe(true);
    const rent = alex.month.days[0]!.items.find((i) => i.kind === "bill" && i.label === "Rent");
    expect(rent).toMatchObject({ amountCents: 215000, posted: true });
    const money = alex.month.days.flatMap((d) => d.items).filter((i) => i.kind === "contribution");
    expect(money.filter((i) => i.kind === "contribution" && !i.expected).map((i) => i.kind === "contribution" && i.who).sort()).toEqual(["Bianca", "Jonathan"]);
    expect(alex.month.inCents).toBe(money.reduce((s, i) => s + (i.kind === "contribution" ? i.amountCents : 0), 0));
    expect(alex.fund.ready).toBe(true);
    expect(alex.fund.lanes.protect.targetCents).not.toBeNull();
  }, LONG);

  it("keeps Jonathan's private to-do on his side only", async () => {
    const { alex, sam, privateTitles } = await ready;
    expect(privateTitles.some((t) => t.endsWith("|MEM-002"))).toBe(true);
    const title = privateTitles.find((t) => t.endsWith("|MEM-002"))!.split("|")[0]!;
    expect(JSON.stringify(alex)).not.toContain(title);
    const mine = sam.month.days.flatMap((d) => d.items).find((i) => i.kind === "task" && i.title === title);
    expect(mine).toMatchObject({ private: true });
  }, LONG);

  it("reads a month ahead and a month behind", async () => {
    const { october, september } = await ready;
    expect(october.status).toBe("ahead");
    expect(october.days.flatMap((d) => d.items).find((i) => i.kind === "bill" && i.label === "Rent")).toMatchObject({ date: "2026-10-01", posted: false });
    expect(september).toMatchObject({ status: "closed", worldId: "month:0", chapter: expect.objectContaining({ title: expect.any(String) }) });
  }, LONG);
});
