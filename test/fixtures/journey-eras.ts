import { addGoal, openChapter, postEntry, type Household } from "../../src/core/index.ts";
import { agreePathProposal, pendingPathProposals, shapePathWorld, type PathEraRow, type PathEraSpec } from "../../src/core/pathWorld.ts";
import { crossPathEra, currentPathEra, proposePathEra } from "../../src/core/pathEras.ts";
import { saveTask, type TaskInput } from "../../src/core/tasks.ts";
import { migrateFundModel } from "../../src/core/fundModelCommands.ts";
import { planLifeFixture } from "./plan-life.ts";

/** A fictional household with a Journey of Life (a crossed era, the current one, a planned one), a Chapter, a shared bank and to-dos. */
const ME = "MEM-001", PARTNER = "MEM-002", AT = "2026-07-02T12:00:00.000Z";
const era = (over: Partial<PathEraSpec> = {}): Omit<PathEraSpec, "crossedOn" | "retired"> => ({
  order: 1, name: "Fictional moving in", finishLine: "Survive our first months", from: "2026-03", by: "2026-06",
  home: "flat", finish: { kind: "agree" }, plans: [], ...over,
});
function agreeAll(h: Household): Household {
  let next = h;
  for (const row of pendingPathProposals(next)) {
    if (row.kind !== "era") continue;
    for (const memberId of [ME, PARTNER]) {
      const fresh = shapePathWorld(next.pathWorld).find((r) => r.id === row.id) as PathEraRow;
      if (fresh.pending && !fresh.agreedByMemberIds.includes(memberId)) next = agreePathProposal(next, { memberId, rowId: fresh.id, revision: fresh.pendingRevision, at: AT }).household;
    }
  }
  return next;
}
const task = (patch: Partial<TaskInput["task"]>): TaskInput["task"] => ({
  visibility: "household", title: "", notes: "", listId: null, parentId: null, doDate: null, dueDate: null, repeat: "none", cue: "none",
  assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false, ...patch,
});

export function journeyHousehold(options: { fundModel?: 1 | 2 } = {}): Household {
  let h = planLifeFixture("household", options);
  h = openChapter(h, { memberId: ME, foundationId: "make-rent-boring", at: "2026-04-01T12:00:00.000Z" }).household;
  h = addGoal(h, { name: "Fictional down payment", target: "2000", shared: true, ownerMemberId: ME }).household;
  for (const date of ["2026-04-12", "2026-07-12", "2026-08-12"]) {
    h = postEntry(h, { type: "expense", date, amount: "80", accountId: "ACC-VISA", subcategoryId: "SUB-LIFE-FUN", note: "Fictional concert", createdBy: ME, visibility: "household", confirmDuplicate: true }).household;
  }
  const goalId = h.goals.find((g) => g.name === "Fictional down payment")!.id;
  h = proposePathEra(h, { memberId: ME, spec: era(), at: AT }).household;
  h = proposePathEra(h, { memberId: ME, spec: era({ order: 2, name: "Fictional making it ours", from: "2026-07", by: "2027-06", home: "furnished" }), at: AT }).household;
  h = proposePathEra(h, { memberId: ME, spec: era({ order: 3, name: "Fictional first house", from: "2027-07", by: null, home: "house", plans: [{ id: "PLAN-DOWN", kind: "bank", label: "The down payment", goalId, month: null }] }), at: AT }).household;
  h = agreeAll(h);
  h = crossPathEra(h, { memberId: ME, rowId: currentPathEra(h, "2026-07-15")!.id, today: "2026-07-15", at: AT }).household;
  h = agreeAll(h);
  h = saveTask(h, { memberId: ME, id: "TASK-IT-VET", expectedRevision: 0, task: task({ title: "Fictional: book the vet", assigneeId: PARTNER, dueDate: "2026-09-17" }) }).household;
  h = saveTask(h, { memberId: ME, id: "TASK-IT-MINE", expectedRevision: 0, task: task({ visibility: "personal", title: "Fictional: my quiet surprise", dueDate: "2026-09-18" }) }).household;
  return options.fundModel === 2 ? migrateFundModel(h, { memberId: ME, at: "2026-09-15T12:00:00.000Z" }).household : h;
}
