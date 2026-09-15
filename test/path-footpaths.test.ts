import { describe, expect, it } from "vitest";
import { assembleHousehold, catalogHousehold, postEntry, splitForSync } from "../src/core/index.ts";
import { completeTask, saveTask, type TaskInput } from "../src/core/tasks.ts";
import { PATH_FOOTPATH_LIMIT, pathFootpaths } from "../src/core/pathFootpaths.ts";
import { pathStones } from "../src/core/pathStones.ts";
import { householdForAiDisclosure } from "../src/core/visibility.ts";

const B = "MEM-001", J = "MEM-002";
const TODAY = "2026-09-15";
const draft = (patch: Partial<TaskInput["task"]> = {}): TaskInput["task"] => ({
  visibility: "personal", title: "Fictional: plan a surprise picnic", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none",
  assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
});
const input = (id: string, patch: Partial<TaskInput["task"]> = {}, memberId = B, expectedRevision = 0): TaskInput => ({ memberId, id: `TASK-${id}`, expectedRevision, task: draft(patch) });

describe("Our Path private footpaths", () => {
  it("never throws on an empty household and shows no footpaths", () => {
    expect(pathFootpaths(catalogHousehold(), B, TODAY)).toEqual([]);
    expect(pathFootpaths(catalogHousehold(), "", TODAY)).toEqual([]);
  });

  it("shows a personal task only to its owner, and never a household task", () => {
    let h = saveTask(catalogHousehold(), input("picnic", { dueDate: "2026-10-02" })).household;
    h = saveTask(h, input("theirs", { title: "Fictional: partner's own errand" }, J)).household;
    h = saveTask(h, input("shared", { visibility: "household", title: "Fictional: book the ferry" })).household;
    const mine = pathFootpaths(h, B, TODAY);
    expect(mine.map((f) => f.id)).toEqual(["TASK-picnic"]);
    expect(mine[0]).toMatchObject({ label: "Fictional: plan a surprise picnic", month: "2026-10", state: "open", money: false, lit: false });
    expect(mine[0]!.why).toContain("Only you can see this path");
    const theirs = pathFootpaths(h, J, TODAY);
    expect(theirs.map((f) => f.id)).toEqual(["TASK-theirs"]);
    expect(JSON.stringify(theirs)).not.toContain("picnic");
    // The household task is a stepping stone, not a footpath.
    expect(pathStones(h, B, TODAY).map((s) => s.id)).toEqual(["TASK-shared"]);
  });

  it("the partner's device never holds the private task, so nothing can be drawn there", () => {
    const h = saveTask(catalogHousehold(), input("picnic")).household;
    const partner = splitForSync(h, J);
    const device = assembleHousehold(partner.shared, partner.personal);
    expect(pathFootpaths(device, J, TODAY)).toEqual([]);
    expect(pathFootpaths(device, B, TODAY)).toEqual([]);
    const owner = splitForSync(h, B);
    expect(pathFootpaths(assembleHousehold(owner.shared, owner.personal), B, TODAY).map((f) => f.id)).toEqual(["TASK-picnic"]);
  });

  it("walks a plain footpath on a tick, and lights a money footpath only from books evidence, with no amounts", () => {
    let h = saveTask(catalogHousehold(), input("walk", { title: "Fictional: long walk" })).household;
    h = completeTask(h, { memberId: B, id: "TASK-walk", expectedRevision: 1 }).household;
    h = saveTask(h, input("gym", { title: "Fictional: pay the gym", expectedAmountCents: 4_500, dueDate: "2026-09-18" })).household;
    const before = pathFootpaths(h, B, TODAY);
    expect(before.find((f) => f.id === "TASK-walk")).toMatchObject({ state: "done", money: false, lit: false });
    expect(before.find((f) => f.id === "TASK-gym")).toMatchObject({ state: "open", money: true, lit: false });
    expect(before.find((f) => f.id === "TASK-gym")!.why).toContain("Lights when the money is confirmed");
    expect(() => completeTask(h, { memberId: B, id: "TASK-gym", expectedRevision: 1 })).toThrow(/evidence/);
    const posted = postEntry(h, { date: "2026-09-14", type: "expense", amount: 45.25, accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: B, note: "Fictional gym", visibility: "personal", confirmDuplicate: true }).household;
    const tx = posted.transactions.find((row) => row.note === "Fictional gym")!;
    const done = completeTask(posted, { memberId: B, id: "TASK-gym", expectedRevision: 1, evidence: { kind: "transaction", transactionId: tx.id, amountCents: tx.amountCents, date: tx.date } }).household;
    const lit = pathFootpaths(done, B, TODAY).find((f) => f.id === "TASK-gym")!;
    expect(lit).toMatchObject({ state: "done", money: true, lit: true });
    expect(JSON.stringify(pathFootpaths(done, B, TODAY))).not.toMatch(/4500|4525|45\.25|amount/i);
  });

  it("caps at 40, newest first, drops deleted tasks, and truncates long labels", () => {
    let h = catalogHousehold();
    for (let i = 0; i < PATH_FOOTPATH_LIMIT + 3; i += 1) {
      const next = saveTask(h, input(`n${String(i).padStart(2, "0")}`, { title: `Fictional errand ${i} that goes on and on about the lantern, the kettle and the map` })).household;
      const task = next.tasks!.at(-1)!;
      const at = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
      h = { ...next, tasks: [...next.tasks!.slice(0, -1), { ...task, createdAt: at, updatedAt: at }] };
    }
    h = saveTask(h, input("n42", { deleted: true }, B, 1)).household;
    const paths = pathFootpaths(h, B, TODAY);
    expect(paths).toHaveLength(PATH_FOOTPATH_LIMIT);
    expect(paths[0]!.id).toBe("TASK-n41");
    expect(paths.some((f) => f.id === "TASK-n42")).toBe(false);
    for (const f of paths) expect(f.label.length).toBeLessThanOrEqual(60);
  });

  it("adds nothing to the model disclosure: footpaths are derived, and no household field was added", () => {
    const h = saveTask(catalogHousehold(), input("picnic")).household;
    const keys = Object.keys(h).sort();
    const disclosed = householdForAiDisclosure(h, B, { view: "household" });
    expect(disclosed.pathWorld ?? []).toEqual([]);
    expect(disclosed.tasks).toBeUndefined();
    expect(JSON.stringify(disclosed)).not.toContain("surprise picnic");
    expect(Object.keys(disclosed).some((key) => /footpath|bridgeStage/i.test(key))).toBe(false);
    expect(pathFootpaths(h, B, TODAY)).toHaveLength(1);
    expect(Object.keys(h).sort()).toEqual(keys);
    expect(keys.some((key) => /footpath/i.test(key))).toBe(false);
  });
});
