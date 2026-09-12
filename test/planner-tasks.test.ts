import { describe, expect, it } from "vitest";
import { catalogHousehold, compileHousehold, postEntry, saveBoardTask, splitForSync, assembleHousehold, mergeShared, mergePersonal } from "../src/core/index.ts";
import { saveTask, completeTask, reopenTask, acknowledgeTask, saveTaskList, adoptBoardTasks, mergeTasks, shapeTasks, taskIsFinancial, hasTaskData, type Task, type TaskInput } from "../src/core/tasks.ts";
import { householdForView, householdForAiDisclosure } from "../src/core/visibility.ts";
import { executeIntent } from "../src/ledgerSync/registry.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, parseCommand, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
import { financialAuditFacts } from "../src/core/commandIdentity.ts";

const B = "MEM-001", J = "MEM-002";
const draft = (patch: Partial<TaskInput["task"]> = {}): TaskInput["task"] => ({
  visibility: "household", title: "Call the vet", notes: "", listId: null, parentId: null, doDate: "2026-09-14", dueDate: null, repeat: "none", cue: "none",
  assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
});
const input = (id: string, patch: Partial<TaskInput["task"]> = {}, memberId = B, expectedRevision = 0): TaskInput => ({ memberId, id: `TASK-${id}`, expectedRevision, task: draft(patch) });
const scope: Scope = { environment: "development", householdId: catalogHousehold().householdId, memberId: B, subject: "test-one" } as Scope;

describe("planner tasks (D-245)", () => {
  it("never changes money, audit facts, or the compiled journal", () => {
    const h = catalogHousehold(), before = compileHousehold(h), facts = JSON.stringify(financialAuditFacts(h));
    let next = saveTask(h, input("vet")).household;
    next = saveTask(next, input("tires", { title: "Tires", expectedAmountCents: 78_000, dueDate: "2026-09-18" })).household;
    next = saveTaskList(next, { memberId: B, id: "LIST-wedding", expectedRevision: 0, list: { name: "Wedding", visibility: "household", deleted: false } }).household;
    next = completeTask(next, { memberId: B, id: "TASK-vet", expectedRevision: 1 }).household;
    expect({ ...compileHousehold(next), activity: before.activity, lastCommittedAt: before.lastCommittedAt }).toEqual(before);
    expect(JSON.stringify(financialAuditFacts(next))).toBe(facts);
    expect(next.transactions).toEqual(h.transactions);
    expect(next.tasks).toHaveLength(2);
    expect(hasTaskData(next)).toBe(true);
  });
  it("keeps a money task off the tick and completes it only by evidence that exists in the books", () => {
    const h = saveTask(catalogHousehold(), input("hydro", { title: "Pay hydro", expectedAmountCents: 14_000, dueDate: "2026-09-18" })).household;
    expect(taskIsFinancial(h.tasks![0]!)).toBe(true);
    expect(() => completeTask(h, { memberId: B, id: "TASK-hydro", expectedRevision: 1 })).toThrow(/evidence/);
    expect(() => completeTask(h, { memberId: B, id: "TASK-hydro", expectedRevision: 1, evidence: { kind: "transaction", transactionId: "TX-missing", amountCents: 14_000, date: "2026-09-17" } })).toThrow(/not in the books/);
    const posted = postEntry(h, { date: "2026-09-17", type: "expense", amount: 140.5, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", createdBy: B, note: "Hydro", confirmDuplicate: true });
    const tx = posted.household.transactions.find((row) => row.note === "Hydro")!;
    expect(() => completeTask(posted.household, { memberId: B, id: "TASK-hydro", expectedRevision: 1, evidence: { kind: "transaction", transactionId: tx.id, amountCents: 14_000, date: tx.date } })).toThrow(/not in the books/);
    const done = completeTask(posted.household, { memberId: B, id: "TASK-hydro", expectedRevision: 1, evidence: { kind: "transaction", transactionId: tx.id, amountCents: tx.amountCents, date: tx.date } }).household;
    const task = done.tasks![0]!;
    expect(task.completedBy).toBe(B);
    expect(task.completionEvidence).toMatchObject({ kind: "transaction", transactionId: tx.id, amountCents: 14_050 });
    // The receipt keeps both the plan and the truth; reopening forgets neither the amount planned nor the transaction.
    const reopened = reopenTask(done, { memberId: B, id: "TASK-hydro", expectedRevision: 2 }).household;
    expect(reopened.tasks![0]).toMatchObject({ completedAt: null, completionEvidence: null, expectedAmountCents: 14_000, revision: 3 });
    expect(reopened.transactions).toHaveLength(posted.household.transactions.length);
  });
  it("requires current revisions, protects private ownership, and keeps a task in its original space", () => {
    const h = saveTask(catalogHousehold(), input("mine", { visibility: "personal", title: "Private errand" })).household;
    expect(() => saveTask(h, input("mine", { visibility: "personal" }, J, 1))).toThrow(/private/);
    expect(() => saveTask(h, input("mine", { visibility: "personal" }, B, 0))).toThrow(/changed/);
    expect(() => saveTask(h, input("mine", { visibility: "household" }, B, 1))).toThrow(/original space/);
    expect(() => saveTask(h, input("mine", { visibility: "personal", assigneeId: J }, B, 1))).toThrow(/stays with its owner/);
    expect(() => saveTask(h, input("two", { assigneeId: "MEM-999" }))).toThrow(/active household member/);
    expect(() => saveTask(h, input("two", { assigneeId: B, backupId: B }))).toThrow(/different backup/);
    expect(() => saveTask(h, input("two", { doDate: "2026-09-20", dueDate: "2026-09-19" }))).toThrow(/on or before/);
    const removed = saveTask(h, input("mine", { visibility: "personal", deleted: true }, B, 1)).household;
    expect(removed.tasks![0]).toMatchObject({ deleted: true, revision: 2 });
    expect(() => saveTask(removed, input("mine", { visibility: "personal" }, B, 2))).toThrow(/changed/);
  });
  it("round-trips private tasks and lists without leaking them to the partner's view, activity, or Hercules", () => {
    let h = saveTask(catalogHousehold(), input("shared", { title: "Book the hotel" })).household;
    h = saveTask(h, input("secret", { visibility: "personal", title: "Surprise gift for Jonathan", notes: "the blue one" })).household;
    h = saveTaskList(h, { memberId: B, id: "LIST-secret", expectedRevision: 0, list: { name: "Surprise plans", visibility: "personal", deleted: false } }).household;
    h = { ...h, activity: [...h.activity, { id: "ACT-leak", at: "2026-09-12T00:00:00.000Z", action: "task", summary: "Added Surprise gift for Jonathan", updatedAt: "2026-09-12T00:00:00.000Z" }] };
    const split = splitForSync(h, B);
    expect(split.shared.tasks?.map((row) => row.id)).toEqual(["TASK-shared"]);
    expect(split.shared.taskLists).toEqual([]);
    expect(split.personal.tasks?.map((row) => row.id)).toEqual(["TASK-secret"]);
    expect(split.personal.taskLists?.map((row) => row.id)).toEqual(["LIST-secret"]);
    expect(split.shared.activity.some((row) => row.summary.includes("Surprise gift"))).toBe(false);
    const restored = assembleHousehold(split.shared, split.personal);
    expect(restored.tasks).toHaveLength(2);
    expect(restored.taskLists).toHaveLength(1);
    const partner = splitForSync(h, J);
    expect(partner.personal.tasks).toEqual([]);
    expect(householdForView(restored, J, "household").tasks?.some((row) => row.id === "TASK-secret")).toBe(false);
    expect(householdForView(restored, J, "personal").tasks).toEqual([]);
    expect(householdForView(restored, B, "personal").tasks?.map((row) => row.id)).toEqual(["TASK-secret"]);
    expect(householdForAiDisclosure(restored, J, {}).tasks).toBeUndefined();
    expect(householdForAiDisclosure(restored, B, {}).taskLists).toBeUndefined();
    expect(JSON.stringify(householdForAiDisclosure(restored, J, {}))).not.toContain("Surprise");
  });
  it("merges by revision, refuses equal-revision divergence, and keeps deletions", () => {
    const h = saveTask(catalogHousehold(), input("one")).household, base = h.tasks![0]!;
    const a: Task = { ...base, revision: 2, title: "A" }, b: Task = { ...base, revision: 2, title: "B" };
    expect(() => mergeTasks([a], [b])).toThrow(/two places/);
    expect(mergeTasks([a], [{ ...base, revision: 3, deleted: true }])[0]).toMatchObject({ revision: 3, deleted: true });
    expect(mergeShared(splitForSync(h, B).shared, splitForSync(saveTask(h, input("two")).household, B).shared).tasks).toHaveLength(2);
    expect(mergePersonal(splitForSync(h, B).personal, splitForSync(saveTask(h, input("p", { visibility: "personal" })).household, B).personal).tasks?.map((r) => r.id)).toEqual(["TASK-p"]);
    expect(() => shapeTasks([base, base])).toThrow(/twice/);
    expect(() => shapeTasks([{ ...base, extra: 1 } as unknown as Task])).toThrow(/Unsupported/);
  });
  it("makes taking a task a real act and clears acknowledgements on reassignment", () => {
    let h = saveTask(catalogHousehold(), input("laundry", { assigneeId: J, backupId: B })).household;
    expect(() => acknowledgeTask(h, { memberId: "MEM-003", id: "TASK-laundry", expectedRevision: 1 })).toThrow(/active member/);
    h = acknowledgeTask(h, { memberId: J, id: "TASK-laundry", expectedRevision: 1 }).household;
    expect(h.tasks![0]!.acknowledgedBy).toEqual([J]);
    expect(() => acknowledgeTask(h, { memberId: J, id: "TASK-laundry", expectedRevision: 2 })).toThrow(/already/);
    h = saveTask(h, input("laundry", { assigneeId: B, backupId: null }, B, 2)).household;
    expect(h.tasks![0]!.acknowledgedBy).toEqual([]);
    h = saveTask(h, input("laundry", { assigneeId: B, backupId: J }, B, 3)).household;
    h = acknowledgeTask(h, { memberId: B, id: "TASK-laundry", expectedRevision: 4 }).household;
    h = acknowledgeTask(h, { memberId: J, id: "TASK-laundry", expectedRevision: 5 }).household;
    expect(h.tasks![0]!.acknowledgedBy).toEqual([B, J]);
  });
  it("adopts the board to-do list once, tombstones the board rows, and links Plan next-steps only while they are current", () => {
    let h = saveBoardTask(catalogHousehold(), { memberId: B, id: "BOARD-TASK-one", title: "Feed Hercules", assigneeId: J, dueDate: "2026-09-15", completed: false, expectedVersion: 0 }).household;
    h = saveBoardTask(h, { memberId: B, id: "BOARD-TASK-two", title: "Done thing", assigneeId: null, dueDate: null, completed: true, expectedVersion: 0 }).household;
    const adopted = adoptBoardTasks(h, { memberId: J }).household;
    expect(adopted.kitchen.boards?.tasks).toEqual([]);
    expect(adopted.tombstones.map((row) => row.id).sort()).toEqual(["BOARD-TASK-one", "BOARD-TASK-two"]);
    expect(adopted.tasks?.map((row) => [row.id, row.assigneeId, row.dueDate, Boolean(row.completedAt), row.createdBy])).toEqual([["TASK-board-one", J, "2026-09-15", false, B], ["TASK-board-two", null, null, true, B]]);
    expect(() => adoptBoardTasks(adopted, { memberId: J })).toThrow(/already/);
    expect(compileHousehold(adopted).transactions).toEqual(compileHousehold(h).transactions);
  });
  it("binds the actor, carries the planner capability, and refuses an old client once tasks exist", async () => {
    const h = catalogHousehold();
    expect(() => executeIntent(h, "saveTask", [input("x")], J, "test")).toThrow(/ACTOR_MISMATCH/);
    const one = splitForSync(h, B), two = splitForSync(h, J);
    const state: AuthorityState = { sequence: h.revision, shared: one.shared, personal: new Map([[B, one.personal], [J, two.personal]]) };
    const command = await commandFromCapture(capturedIntent(saveTask(h, input("x", { visibility: "personal" })).household)!, scope, crypto.randomUUID());
    expect(command.taskPlannerVersion).toBe(1);
    expect(() => parseCommand({ ...command, taskPlannerVersion: 2 })).toThrow();
    const accepted = await prepareCommand(state, command, scope, () => {});
    expect(accepted.shared.tasks).toEqual([]);
    expect(accepted.personal.tasks?.map((row) => row.id)).toEqual(["TASK-x"]);
    const next: AuthorityState = { sequence: accepted.receipt.sequence, shared: accepted.shared, personal: new Map([...state.personal, [B, accepted.personal]]) };
    const old = { ...(await commandFromCapture(capturedIntent(postEntry(assembleHousehold(accepted.shared, accepted.personal), { date: "2026-09-12", type: "expense", amount: 5, accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: B, note: "Coffee", confirmDuplicate: true }).household)!, scope, crypto.randomUUID())), observedSequence: accepted.receipt.sequence };
    delete (old as { taskPlannerVersion?: 1 }).taskPlannerVersion;
    await expect(prepareCommand(next, old, scope, () => {})).rejects.toThrow(/CLIENT_RELOAD_REQUIRED: Reload Hearth to preserve planner tasks/);
    await expect(prepareCommand(next, { ...old, taskPlannerVersion: 1 }, scope, () => {})).resolves.toBeTruthy();
  });
});
