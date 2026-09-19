import { describe, expect, it } from "vitest";
import { addRecurrence, catalogHousehold, postEntry } from "../src/core/index.ts";
import { acknowledgeTask, completeTask, saveTask, type TaskInput } from "../src/core/tasks.ts";
import { PATH_STONE_LIMIT, pathStones, pathTaskDone } from "../src/core/pathStones.ts";

const B = "MEM-001", J = "MEM-002";
const TODAY = "2026-09-15";
const draft = (patch: Partial<TaskInput["task"]> = {}): TaskInput["task"] => ({
  visibility: "household", title: "Water the fern", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none",
  assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
});
const input = (id: string, patch: Partial<TaskInput["task"]> = {}, memberId = B, expectedRevision = 0): TaskInput => ({ memberId, id: `TASK-${id}`, expectedRevision, task: draft(patch) });

describe("Our Path stepping stones (planner tasks)", () => {
  it("never throws on an empty household and shows no stones", () => {
    expect(pathStones(catalogHousehold(), B, TODAY)).toEqual([]);
  });

  it("never shows a personal task, to its owner or the partner", () => {
    let h = saveTask(catalogHousehold(), input("secret", { visibility: "personal", title: "Surprise picnic" })).household;
    h = saveTask(h, input("shared", { title: "Book the ferry" })).household;
    for (const member of [B, J]) {
      const stones = pathStones(h, member, TODAY);
      expect(stones.map((s) => s.id)).toEqual(["TASK-shared"]);
      expect(JSON.stringify(stones)).not.toContain("Surprise");
    }
  });

  it("names owner and backup footprints and truncates long labels", () => {
    const long = "Pack the lantern, the blanket, the map of the islands and the little red kettle for the trip";
    const h = saveTask(catalogHousehold(), input("owned", { title: long, assigneeId: B, backupId: J, dueDate: "2026-10-03" })).household;
    const [stone] = pathStones(h, J, TODAY);
    expect(stone).toMatchObject({ owner: "Bianca", backup: "Jonathan", money: false, lit: false, state: "open", month: "2026-10", chapterId: null });
    expect(stone!.why).toContain("Owned by Bianca, Jonathan as backup");
    expect(stone!.label.length).toBeLessThanOrEqual(60);
    expect(stone!.label.endsWith("…")).toBe(true);
    const free = saveTask(catalogHousehold(), input("free")).household;
    const unowned = pathStones(free, B, TODAY)[0]!;
    expect(unowned).toMatchObject({ owner: null, backup: null });
    expect(unowned.month).toBe(free.tasks![0]!.createdAt.slice(0, 7));
  });

  it("marks a plain task done on a tick, but never lights it", () => {
    let h = saveTask(catalogHousehold(), input("vet", { title: "Call the vet", dueDate: "2026-09-14" })).household;
    h = acknowledgeTask(h, { memberId: J, id: "TASK-vet", expectedRevision: 1 }).household;
    h = completeTask(h, { memberId: J, id: "TASK-vet", expectedRevision: 2 }).household;
    const [stone] = pathStones(h, B, TODAY);
    expect(stone).toMatchObject({ state: "done", money: false, lit: false, month: "2026-09" });
    expect(stone!.why).toContain("Done");
  });

  it("keeps a money task waiting and unlit until the books hold its evidence", () => {
    let h = saveTask(catalogHousehold(), input("hydro", { title: "Pay hydro", expectedAmountCents: 14_000, dueDate: "2026-09-18", assigneeId: J })).household;
    h = acknowledgeTask(h, { memberId: J, id: "TASK-hydro", expectedRevision: 1 }).household;
    const waiting = pathStones(h, B, TODAY)[0]!;
    expect(waiting).toMatchObject({ state: "waiting", money: true, lit: false, owner: "Jonathan" });
    expect(waiting.why).toContain("Lights when the money is confirmed in the books");
    // A tick is refused: the stone stays dark.
    expect(() => completeTask(h, { memberId: J, id: "TASK-hydro", expectedRevision: 2 })).toThrow(/evidence/);
    expect(pathStones(h, B, TODAY)[0]!.lit).toBe(false);
    // Posted in the books but not yet attached: still dark.
    const posted = postEntry(h, { date: "2026-09-17", type: "expense", amount: 140.5, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", createdBy: B, note: "Hydro", confirmDuplicate: true });
    expect(pathStones(posted.household, B, TODAY)[0]!.lit).toBe(false);
    const tx = posted.household.transactions.find((row) => row.note === "Hydro")!;
    const done = completeTask(posted.household, { memberId: J, id: "TASK-hydro", expectedRevision: 2, evidence: { kind: "transaction", transactionId: tx.id, amountCents: tx.amountCents, date: tx.date } }).household;
    const lit = pathStones(done, B, TODAY)[0]!;
    expect(lit).toMatchObject({ state: "done", money: true, lit: true });
    expect(lit.why).toContain("confirmed in the books");
    expect(JSON.stringify(lit)).not.toMatch(/14050|14000|140\.5/);
  });

  it("lights a household money stone only from shared books evidence, never from someone's personal transaction", () => {
    let h = addRecurrence(catalogHousehold(), { cadence: "monthly", nextDate: "2026-09-25", type: "expense", amount: "100", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Fictional internet" }).household;
    const recurrenceId = h.recurrences.at(-1)!.id;
    h = saveTask(h, input("net", { title: "Fictional: internet bill", dueDate: "2026-09-25", moneyLink: { kind: "recurrence", recurrenceId, date: "2026-09-25" } })).household;
    const withPayment = (visibility: "personal" | "household") => {
      const posted = postEntry(h, { date: "2026-09-25", type: "expense", amount: 100, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", createdBy: B, note: `Fictional ${visibility} internet`, visibility, confirmDuplicate: true }).household;
      return { ...posted, transactions: posted.transactions.map((row) => row.note === `Fictional ${visibility} internet` ? { ...row, source: "recurring", sourceId: recurrenceId } : row) } as typeof posted;
    };
    expect(pathStones(h, B, TODAY)[0]).toMatchObject({ money: true, lit: false, state: "waiting" });
    // The owner's device holds their personal row, but the stone must look the same on both phones.
    for (const member of [B, J]) expect(pathStones(withPayment("personal"), member, TODAY)[0]).toMatchObject({ money: true, lit: false, state: "waiting" });
    for (const member of [B, J]) expect(pathStones(withPayment("household"), member, TODAY)[0]).toMatchObject({ money: true, lit: true, state: "done" });
    // A private footpath may still read its owner's own rows (pathTaskDone without the shared flag).
    const task = withPayment("personal").tasks!.find((row) => row.id === "TASK-net")!;
    expect(pathTaskDone(withPayment("personal"), task)).toBe(true);
    expect(pathTaskDone(withPayment("personal"), task, true)).toBe(false);
  });

  it("caps at 40 stones, newest first, and drops deleted tasks", () => {
    let h = catalogHousehold();
    for (let i = 0; i < PATH_STONE_LIMIT + 5; i += 1) {
      const next = saveTask(h, input(`n${String(i).padStart(2, "0")}`, { title: `Chore ${i}` })).household;
      const task = next.tasks!.at(-1)!;
      const at = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
      h = { ...next, tasks: [...next.tasks!.slice(0, -1), { ...task, createdAt: at, updatedAt: at }] };
    }
    h = saveTask(h, input("n44", { title: "Chore 44", deleted: true }, B, 1)).household;
    const stones = pathStones(h, B, TODAY);
    expect(stones).toHaveLength(PATH_STONE_LIMIT);
    expect(stones[0]!.id).toBe("TASK-n43");
    expect(stones.some((s) => s.id === "TASK-n44")).toBe(false);
    expect(stones.at(-1)!.id).toBe("TASK-n04");
  });
});
