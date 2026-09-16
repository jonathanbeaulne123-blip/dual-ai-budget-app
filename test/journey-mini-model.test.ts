import { describe, expect, it } from "vitest";
import { openChapter, type Household } from "../src/core/index.ts";
import { projectKittyNest } from "../src/core/kittyNest.ts";
import { crossPathEra, currentPathEra, proposePathEra } from "../src/core/pathEras.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { agreePathProposal, pendingPathProposals, shapePathWorld, type PathEraSpec } from "../src/core/pathWorld.ts";
import { saveTask, type TaskInput } from "../src/core/tasks.ts";
import { miniCad, miniEraFor, miniItemWords, miniJourney, miniMonth } from "../src/path/mini/miniJourneyModel.ts";
import { miniLapRadius, miniLevelWeight } from "../src/path/mini/miniWorld3d.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";

const TODAY = "2026-09-15";

function task(patch: Partial<TaskInput["task"]>): TaskInput["task"] {
  return { visibility: "household", title: "", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none", assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch } as TaskInput["task"];
}

function household(): Household {
  let h = planLifeFixture("household");
  h = openChapter(h, { memberId: "MEM-001", foundationId: "make-rent-boring", at: "2026-07-01T12:00:00.000Z" }).household;
  h = saveTask(h, { memberId: "MEM-001", id: "TASK-MINI-VET", expectedRevision: 0, task: task({ title: "Fictional: book the vet", assigneeId: "MEM-002", dueDate: "2026-09-17" }) }).household;
  h = saveTask(h, { memberId: "MEM-002", id: "TASK-MINI-SECRET", expectedRevision: 0, task: task({ visibility: "personal", title: "Fictional: Sam's surprise", dueDate: "2026-09-16" }) }).household;
  return h;
}

const spec = (over: Partial<PathEraSpec>): Omit<PathEraSpec, "crossedOn" | "retired"> => ({ order: 1, name: "", finishLine: "", from: "2026-01", by: null, home: "flat", finish: { kind: "agree" }, plans: [], ...over });
function agreeAll(h: Household): Household {
  for (const row of pendingPathProposals(h)) {
    if (row.kind !== "era") continue;
    for (const memberId of ["MEM-001", "MEM-002"]) {
      const fresh = shapePathWorld(h.pathWorld).find((r) => r.id === row.id)!;
      if (fresh.pending && !fresh.agreedByMemberIds.includes(memberId)) h = agreePathProposal(h, { memberId, rowId: fresh.id, revision: fresh.pendingRevision, at: "2026-02-01T12:00:00.000Z" }).household;
    }
  }
  return h;
}
function withJourney(): Household {
  let h = household();
  const bank = h.goals.find((g) => g.name === "A slower week away")!.id;
  const at = "2026-02-01T12:00:00.000Z";
  h = proposePathEra(h, { memberId: "MEM-001", at, spec: spec({ order: 1, name: "Fictional first flat", from: "2025-10", by: "2026-02" }) }).household;
  h = proposePathEra(h, { memberId: "MEM-001", at, spec: spec({ order: 2, name: "Fictional making it ours", from: "2026-03", by: "2027-02", home: "furnished", finish: { kind: "banks", goalIds: [bank] }, plans: [{ id: "PLAN-WEEK", kind: "bank", label: "A slower week", goalId: bank, month: null }] }) }).household;
  h = proposePathEra(h, { memberId: "MEM-002", at, spec: spec({ order: 3, name: "Fictional first house", from: "2027-03", by: "2031-02", home: "house" }) }).household;
  h = agreeAll(h);
  h = crossPathEra(h, { memberId: "MEM-001", rowId: currentPathEra(h, "2026-03-05")!.id, today: "2026-03-05", at }).household;
  return agreeAll(h);
}

describe("miniJourney — the simple view as data (D-284)", () => {
  it("lays the month out day by day with the Fund's bills, money in and to-dos", () => {
    const h = household();
    const before = JSON.stringify(h);
    const j = miniJourney(h, { memberId: "MEM-001", today: TODAY });
    expect(JSON.stringify(h)).toBe(before);
    expect(j.nowMonth).toBe("2026-09");
    expect(j.month.days).toHaveLength(30);
    expect(j.month.days.filter((d) => d.today).map((d) => d.date)).toEqual([TODAY]);
    expect(j.month.days.find((d) => d.date === "2026-09-14")!.past).toBe(true);
    // The fictional rent is a Fund obligation on the 20th, planned from Prepare.
    const rent = j.month.days.find((d) => d.date === "2026-09-20")!.items.find((i) => i.kind === "bill");
    expect(rent).toMatchObject({ kind: "bill", label: "Fictional rent", amountCents: 90000, lane: "prepare", posted: false });
    expect(rent!.id).toMatch(/^bill:.+@2026-09-20$/);
    // The confirmed contribution lands on its day, with who put it in.
    const money = j.month.days.flatMap((d) => d.items).filter((i) => i.kind === "contribution");
    expect(money).toEqual([expect.objectContaining({ date: "2026-09-01", who: "Sam (fictional)", amountCents: 400000, expected: false })]);
    expect(j.month.inCents).toBe(400000);
    expect(j.month.billCents).toBe(j.month.days.reduce((s, d) => s + d.billCents, 0));
    expect(j.month.fundReady).toBe(true);
    // Weeks are Sunday-start and clipped to the month.
    expect(j.month.weeks[0]).toMatchObject({ start: "2026-09-01", end: "2026-09-05" });
    expect(j.month.weeks.find((w) => w.hasToday)).toMatchObject({ start: "2026-09-13", end: "2026-09-19", tasks: 1 });
    expect(j.month.weeks.reduce((s, w) => s + w.billCents, 0)).toBe(j.month.billCents);
  });

  it("never shows a partner's private to-do, and marks my own as only mine", () => {
    const h = household();
    const alex = miniJourney(h, { memberId: "MEM-001", today: TODAY });
    const alexTasks = alex.month.days.flatMap((d) => d.items).filter((i) => i.kind === "task");
    expect(alexTasks.map((t) => t.id)).toEqual(["task:TASK-MINI-VET"]);
    expect(JSON.stringify(alex)).not.toContain("surprise");
    expect(alexTasks[0]).toMatchObject({ who: "Sam (fictional)", whoId: "MEM-002", private: false });
    const sam = miniJourney(h, { memberId: "MEM-002", today: TODAY });
    const secret = sam.month.days.flatMap((d) => d.items).find((i) => i.id === "task:TASK-MINI-SECRET");
    expect(secret).toMatchObject({ kind: "task", private: true, who: "Together" });
    expect(miniItemWords(secret!)).toContain("only you see this");
    // Opting out of my own private to-dos leaves only the shared ones.
    expect(miniMonth(h, "2026-09", { memberId: "MEM-002", today: TODAY, includeMine: false }).days.flatMap((d) => d.items).some((i) => i.id === "task:TASK-MINI-SECRET")).toBe(false);
  });

  it("reads the lanes from the Kitty Nest exactly (the fundModel swap point)", () => {
    const h = household();
    const j = miniJourney(h, { memberId: "MEM-001", today: TODAY });
    const nest = projectKittyNest(h, "MEM-001", "household", TODAY);
    for (const lane of ["prepare", "protect", "build"] as const) expect(j.fund.lanes[lane].amountCents).toBe(nest.categories.find((c) => c.category === lane)!.amountCents);
    expect(j.fund.everyday.amountCents).toBe(nest.categories.find((c) => c.category === "everyday")!.amountCents);
    expect(j.fund.ready).toBe(true);
    // Only Protect carries a target ("… of …").
    expect(j.fund.lanes.prepare.targetCents).toBeNull();
    expect(j.fund.lanes.build.targetCents).toBeNull();
  });

  it("numbers months the way the world does and reads their Sitdown status", () => {
    const h = household();
    const j = miniJourney(h, { memberId: "MEM-001", today: TODAY });
    const world = pathMonths(h, TODAY).map((m) => m.key);
    for (const [index, key] of world.entries()) expect(j.months.find((m) => m.key === key)).toMatchObject({ worldIndex: index, worldId: `month:${index}` });
    const now = j.months.find((m) => m.key === "2026-09")!;
    expect(now).toMatchObject({ current: true, status: "open" });
    expect(now.chapter?.title).toBeTruthy();
    expect(j.months.find((m) => m.key === "2026-12")).toMatchObject({ status: "ahead", worldId: null });
    // Without a journey the model has no eras and travels a year either side.
    expect(j.eras).toEqual([]);
    expect(j.span).toEqual({ from: "2025-09-01", to: "2027-09-30" });
  });

  it("keeps a month ahead honest: planned bills, no invented money in", () => {
    const h = household();
    const oct = miniMonth(h, "2026-10", { memberId: "MEM-001", today: TODAY });
    expect(oct.status).toBe("ahead");
    expect(oct.days).toHaveLength(31);
    const rent = oct.days.flatMap((d) => d.items).find((i) => i.kind === "bill");
    expect(rent).toMatchObject({ date: "2026-10-20", amountCents: 90000, posted: false });
    // One confirmed contribution is below the observation threshold, so nothing is estimated.
    expect(oct.days.flatMap((d) => d.items).some((i) => i.kind === "contribution")).toBe(false);
  });

  it("without a Fund draws the days and to-dos only", () => {
    const h = { ...household(), householdFund: null } as Household;
    const j = miniJourney(h, { memberId: "MEM-001", today: TODAY });
    expect(j.month.fundReady).toBe(false);
    expect(j.month.days.flatMap((d) => d.items).every((i) => i.kind === "task")).toBe(true);
    expect(j.fund.ready).toBe(false);
  });

  it("turns the Journey of Life into eras: crossed, current and planned, with the finish-line banks", () => {
    const h = withJourney();
    const j = miniJourney(h, { memberId: "MEM-001", today: TODAY });
    expect(j.eras.map((e) => [e.name, e.state, e.worldId.startsWith("era") ? e.worldId.split(":")[0] : e.worldId])).toEqual([
      ["Fictional first flat", "crossed", "era"],
      ["Fictional making it ours", "current", "era-home"],
      ["Fictional first house", "future", "era"],
    ]);
    const current = j.eras[1]!;
    expect(j.currentEraId).toBe(current.id);
    expect(current.from).toBe("2026-03");
    expect(current.to).toBe("2027-02");
    expect(current.months.map((m) => m.key)).toHaveLength(12);
    expect(current.months.map((m) => m.lap)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(current.banks).toHaveLength(1);
    expect(current.banks[0]).toMatchObject({ name: "A slower week away", worldId: expect.stringMatching(/^goal:/), full: false, bought: false });
    expect(current.banks[0]!.fill).toBe(current.banks[0]!.step / 10);
    expect(current.finishKind).toBe("banks");
    // The world's main island is the current era's window: its first month is month:0.
    expect(j.months.find((m) => m.key === "2026-03")).toMatchObject({ worldIndex: 0, worldId: "month:0", eraId: current.id, lap: 0 });
    // A month on another island is found on that era's island.
    const past = j.months.find((m) => m.key === "2025-11")!;
    expect(past).toMatchObject({ worldIndex: null, worldId: `era:${j.eras[0]!.id}`, eraId: j.eras[0]!.id });
    const future = j.eras[2]!;
    expect(future.monthCount).toBe(48);
    expect(future.months).toHaveLength(36);
    expect(future.months.at(-1)!.key).toBe("2031-02");
    expect(miniEraFor(j, "2028-05")?.id).toBe(future.id);
    expect(miniEraFor(j, "2025-01")).toBeNull();
    expect(j.span).toEqual({ from: "2025-10-01", to: "2031-02-28" });
    // Nothing on an era says an amount.
    expect(JSON.stringify(j.eras)).not.toMatch(/Cents/);
  });

  it("formats money the way the cards say it", () => {
    expect(miniCad(215000)).toBe("$2,150");
    expect(miniCad(-1899)).toBe("−$18.99");
    expect(miniCad(140000, true)).toBe("+$1,400");
    expect(miniCad(-9642, true)).toBe("−$96.42");
    expect(miniLevelWeight(2, 2)).toBe(1);
    expect(miniLevelWeight(2, 4)).toBe(0);
    expect(miniLapRadius(0, 24)).toBeLessThan(miniLapRadius(23, 24));
    expect(miniLapRadius(23, 24)).toBeCloseTo(13.4, 6);
  });
});
