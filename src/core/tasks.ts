import type { Household, CommitResult, LedgerView, RecurrenceCadence } from "./types.ts";
import { ValidationError } from "./types.ts";
import { isValidDateKey, type DateKey } from "./calendar.ts";
import { advanceCadence } from "./recurrence.ts";
import { canonical } from "../ledgerSync/patch.ts";
import { captureCommand } from "../ledgerSync/capture.ts";
import { shapeSharedBoards } from "./sharedBoards.ts";
import { mergeTombstones } from "./sync.ts";

/**
 * The planner (feedback row 9, D-245). One Task object wears many faces: a life
 * errand, a money obligation, a decision, a Chapter Move, a Plan next-step.
 *
 * Doctrine: dates remind, Mark paid writes. A task never posts money. A
 * financial task (one that carries an expected amount or a money link) is never
 * ticked by hand — it completes by evidence that already exists in the books.
 * Private tasks are member-owned and split into the Personal envelope exactly
 * like native calendar events.
 */
export type TaskRepeat = "none" | RecurrenceCadence | "yearly";
export type TaskCue = "none" | "after-payday";
export type TaskMoneyLink =
  | { kind: "recurrence"; recurrenceId: string; date: DateKey }
  | { kind: "potential-expense"; potentialExpenseId: string }
  | { kind: "goal"; goalId: string };
export type TaskEvidence =
  | { kind: "transaction"; transactionId: string; amountCents: number; date: DateKey }
  | { kind: "goal-contribution"; contributionId: string; amountCents: number; date: DateKey };
export type Task = {
  version: 1;
  id: string;
  revision: number;
  createdBy: string;
  visibility: LedgerView;
  title: string;
  notes: string;
  listId: string | null;
  parentId: string | null;
  /** When you plan to do it. Things 3's most important distinction. */
  doDate: DateKey | null;
  /** When it has to be done by. */
  dueDate: DateKey | null;
  repeat: TaskRepeat;
  cue: TaskCue;
  assigneeId: string | null;
  backupId: string | null;
  /** Members who said "taking it". Assignment is never silent. */
  acknowledgedBy: string[];
  chapterId: string | null;
  planReference: { planVersionId: string; planLineId: string } | null;
  moneyLink: TaskMoneyLink | null;
  expectedAmountCents: number | null;
  completedAt: string | null;
  completedBy: string | null;
  completionEvidence: TaskEvidence | null;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};
export type TaskList = {
  version: 1;
  id: string;
  revision: number;
  createdBy: string;
  visibility: LedgerView;
  name: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};
export const TASK_COMMAND_KINDS = ["saveTask", "completeTask", "reopenTask", "acknowledgeTask", "saveTaskList", "adoptBoardTasks"];
export const TASK_LIMIT = 4000;
export const TASK_LIST_LIMIT = 200;
export const TASK_TITLE_LIMIT = 240;
export const TASK_NOTES_LIMIT = 2000;
const TASK_KEYS = ["version", "id", "revision", "createdBy", "visibility", "title", "notes", "listId", "parentId", "doDate", "dueDate", "repeat", "cue", "assigneeId", "backupId", "acknowledgedBy", "chapterId", "planReference", "moneyLink", "expectedAmountCents", "completedAt", "completedBy", "completionEvidence", "deleted", "createdAt", "updatedAt"];
const LIST_KEYS = ["version", "id", "revision", "createdBy", "visibility", "name", "deleted", "createdAt", "updatedAt"];
const REPEATS: TaskRepeat[] = ["none", "daily", "weekly", "biweekly", "monthly", "yearly"];
const CUES: TaskCue[] = ["none", "after-payday"];
function fail(message: string): never { throw new ValidationError(message); }
const isId = (value: unknown, prefix: string) => typeof value === "string" && new RegExp(`^${prefix}-[A-Za-z0-9_-]{1,80}$`).test(value);
const optionalId = (value: unknown) => value === null || (typeof value === "string" && value.length > 0 && value.length <= 120);
const optionalDate = (value: unknown) => value === null || (typeof value === "string" && isValidDateKey(value));
const iso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

/** Money meaning: a task with an amount or a link is financial. It completes by evidence, never by a tick. */
export function taskIsFinancial(task: Pick<Task, "expectedAmountCents" | "moneyLink">): boolean {
  return task.moneyLink !== null || (task.expectedAmountCents !== null && task.expectedAmountCents > 0);
}

export function validateTask(raw: Task): Task {
  if (!raw || typeof raw !== "object" || Object.keys(raw).some((key) => !TASK_KEYS.includes(key))) return fail("Unsupported task fields.");
  const row = structuredClone(raw);
  if (row.version !== 1 || !isId(row.id, "TASK") || !Number.isSafeInteger(row.revision) || row.revision < 1 || !["household", "personal"].includes(row.visibility) || typeof row.createdBy !== "string" || !row.createdBy) return fail("This task needs a valid owner and revision.");
  if (typeof row.title !== "string" || !row.title.trim() || row.title.length > TASK_TITLE_LIMIT || typeof row.notes !== "string" || row.notes.length > TASK_NOTES_LIMIT) return fail("Check the task title and notes.");
  if (!optionalId(row.listId) || !optionalId(row.parentId) || !optionalId(row.assigneeId) || !optionalId(row.backupId) || !optionalId(row.chapterId) || !optionalId(row.completedBy)) return fail("Check who and where this task belongs.");
  if (row.parentId === row.id) return fail("A task cannot be its own parent.");
  if (row.assigneeId !== null && row.assigneeId === row.backupId) return fail("Choose a different backup owner.");
  if (!optionalDate(row.doDate) || !optionalDate(row.dueDate)) return fail("Choose valid task dates.");
  if (row.doDate && row.dueDate && row.doDate > row.dueDate) return fail("Plan to do it on or before the deadline.");
  if (!REPEATS.includes(row.repeat) || !CUES.includes(row.cue)) return fail("Choose the task repeat and cue options.");
  if (row.repeat !== "none" && !row.doDate && !row.dueDate) return fail("A repeating task needs a date to repeat from.");
  if (!Array.isArray(row.acknowledgedBy) || row.acknowledgedBy.length > 16 || row.acknowledgedBy.some((id) => typeof id !== "string" || !id) || new Set(row.acknowledgedBy).size !== row.acknowledgedBy.length) return fail("Check who acknowledged this task.");
  if (row.planReference !== null && (!row.planReference || typeof row.planReference !== "object" || Object.keys(row.planReference).some((key) => !["planVersionId", "planLineId"].includes(key)) || typeof row.planReference.planVersionId !== "string" || typeof row.planReference.planLineId !== "string")) return fail("Check the Plan link on this task.");
  if (row.moneyLink !== null) {
    const link = row.moneyLink as Record<string, unknown>;
    const ok = link && typeof link === "object" && (
      (link.kind === "recurrence" && typeof link.recurrenceId === "string" && isValidDateKey(String(link.date)) && Object.keys(link).length === 3)
      || (link.kind === "potential-expense" && typeof link.potentialExpenseId === "string" && Object.keys(link).length === 2)
      || (link.kind === "goal" && typeof link.goalId === "string" && Object.keys(link).length === 2));
    if (!ok) return fail("Check the money link on this task.");
  }
  if (row.expectedAmountCents !== null && (!Number.isSafeInteger(row.expectedAmountCents) || row.expectedAmountCents < 0 || row.expectedAmountCents > 99_999_999)) return fail("Choose a whole-cent expected amount.");
  if ((row.completedAt === null) !== (row.completedBy === null) || (row.completedAt !== null && !iso(row.completedAt))) return fail("Check the task completion.");
  if (row.completionEvidence !== null) {
    const evidence = row.completionEvidence as Record<string, unknown>;
    const ok = evidence && typeof evidence === "object" && Number.isSafeInteger(evidence.amountCents) && isValidDateKey(String(evidence.date)) && (
      (evidence.kind === "transaction" && typeof evidence.transactionId === "string" && Object.keys(evidence).length === 4)
      || (evidence.kind === "goal-contribution" && typeof evidence.contributionId === "string" && Object.keys(evidence).length === 4));
    if (!ok) return fail("Check the completion evidence on this task.");
    if (row.completedAt === null) return fail("Evidence belongs to a completed task.");
  }
  if (row.completedAt !== null && taskIsFinancial(row) && row.completionEvidence === null) return fail("A money task completes by evidence, never by a tick.");
  if (typeof row.deleted !== "boolean" || !iso(row.createdAt) || !iso(row.updatedAt)) return fail("Check the task record.");
  row.title = row.title.trim();
  return row;
}
export function validateTaskList(raw: TaskList): TaskList {
  if (!raw || typeof raw !== "object" || Object.keys(raw).some((key) => !LIST_KEYS.includes(key))) return fail("Unsupported list fields.");
  const row = structuredClone(raw);
  if (row.version !== 1 || !isId(row.id, "LIST") || !Number.isSafeInteger(row.revision) || row.revision < 1 || !["household", "personal"].includes(row.visibility) || typeof row.createdBy !== "string" || !row.createdBy) return fail("This list needs a valid owner and revision.");
  if (typeof row.name !== "string" || !row.name.trim() || row.name.length > 80) return fail("Give the list a short name.");
  if (typeof row.deleted !== "boolean" || !iso(row.createdAt) || !iso(row.updatedAt)) return fail("Check the list record.");
  row.name = row.name.trim();
  return row;
}
export function shapeTasks(value: Task[] | undefined): Task[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > TASK_LIMIT) return fail("Too many tasks.");
  const rows = value.map(validateTask);
  if (new Set(rows.map((row) => row.id)).size !== rows.length) return fail("A task identity appears twice.");
  return rows;
}
export function shapeTaskLists(value: TaskList[] | undefined): TaskList[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > TASK_LIST_LIMIT) return fail("Too many lists.");
  const rows = value.map(validateTaskList);
  if (new Set(rows.map((row) => row.id)).size !== rows.length) return fail("A list identity appears twice.");
  return rows;
}
function mergeRevisioned<T extends { id: string; revision: number }>(rows: T[], noun: string): T[] {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const old = byId.get(row.id);
    if (old && old.revision === row.revision && canonical(old) !== canonical(row)) return fail(`This ${noun} changed in two places. Review its current version.`);
    if (!old || row.revision > old.revision) byId.set(row.id, row);
  }
  return [...byId.values()];
}
/** V2 authority owns revisions; conflicting equal revisions never silently merge. */
export function mergeTasks(a: Task[] | undefined, b: Task[] | undefined): Task[] { return mergeRevisioned([...shapeTasks(a), ...shapeTasks(b)], "task"); }
export function mergeTaskLists(a: TaskList[] | undefined, b: TaskList[] | undefined): TaskList[] { return mergeRevisioned([...shapeTaskLists(a), ...shapeTaskLists(b)], "list"); }

/** Which tasks a member may see in a view. Partner-private tasks never appear; household tasks appear in both views. */
export function taskVisibleTo(task: Pick<Task, "visibility" | "createdBy">, memberId: string, view: LedgerView): boolean {
  if (task.visibility === "household") return true;
  return task.createdBy === memberId && view === "personal";
}
export function taskInView(task: Pick<Task, "visibility" | "createdBy">, memberId: string, view: LedgerView): boolean {
  return view === "household" ? task.visibility === "household" : task.createdBy === memberId && task.visibility === "personal";
}
export function hasTaskData(household: Pick<Household, "tasks" | "taskLists">): boolean {
  return Boolean(household.tasks?.length || household.taskLists?.length);
}

export type TaskInput = {
  memberId: string;
  id: string;
  expectedRevision: number;
  task: Omit<Task, "version" | "id" | "revision" | "createdBy" | "createdAt" | "updatedAt" | "acknowledgedBy" | "completedAt" | "completedBy" | "completionEvidence"> & Partial<Pick<Task, "acknowledgedBy" | "completedAt" | "completedBy" | "completionEvidence">>;
};
function requireActor(h: Household, memberId: string) {
  if (!h.members.some((m) => m.id === memberId && m.active)) return fail("Sign in as an active member to change tasks.");
}
function requireCurrent(old: Task | undefined, input: { memberId: string; expectedRevision: number }) {
  if ((old?.revision ?? 0) !== input.expectedRevision || old?.deleted) return fail("This task changed. Review its latest version.");
  if (old?.visibility === "personal" && old.createdBy !== input.memberId) return fail("This is another person’s private task.");
}
function checkReferences(h: Household, row: Task) {
  const active = (id: string | null) => id === null || h.members.some((m) => m.id === id && m.active);
  if (!active(row.assigneeId) || !active(row.backupId)) return fail("Choose an active household member for this task.");
  if (row.visibility === "personal" && ((row.assigneeId && row.assigneeId !== row.createdBy) || row.backupId)) return fail("A private task stays with its owner.");
  if (row.listId && !(h.taskLists ?? []).some((list) => list.id === row.listId && !list.deleted && (list.visibility === "household" || list.createdBy === row.createdBy))) return fail("Choose one of your lists.");
  if (row.parentId && !(h.tasks ?? []).some((task) => task.id === row.parentId && !task.deleted && task.visibility === row.visibility && (task.visibility === "household" || task.createdBy === row.createdBy))) return fail("Choose a parent task you can see.");
  if (row.chapterId && !(h.chapters ?? []).some((chapter) => chapter.id === row.chapterId)) return fail("Choose a current Chapter.");
  if (row.planReference && !h.planVersions?.some((plan) => plan.id === row.planReference!.planVersionId && plan.scope === "household" && plan.state === "active" && plan.lines.some((line) => line.id === row.planReference!.planLineId))) return fail("Refresh the active Shared Plan before assigning its next step.");
  if (row.moneyLink?.kind === "recurrence" && !h.recurrences.some((r) => r.id === (row.moneyLink as { recurrenceId: string }).recurrenceId)) return fail("Choose a current recurring bill.");
  if (row.moneyLink?.kind === "potential-expense" && !(h.potentialExpenses ?? []).some((r) => r.id === (row.moneyLink as { potentialExpenseId: string }).potentialExpenseId)) return fail("Choose a current planned cost.");
  if (row.moneyLink?.kind === "goal" && !h.goals.some((g) => g.id === (row.moneyLink as { goalId: string }).goalId)) return fail("Choose a current goal.");
}
function undo(h: Household, row: { id: string }, label: string, commandKind: string): CommitResult["undo"] {
  return { id: crypto.randomUUID(), label, snapshot: h, postedIds: [row.id], commandKind };
}
function put(h: Household, row: Task): Household { return { ...h, tasks: [...(h.tasks ?? []).filter((r) => r.id !== row.id), row] }; }

/** Create or edit. Visibility is fixed at creation; deletion is `deleted: true` so the other phone learns it. */
export const saveTask = captureCommand("saveTask", (h: Household, input: TaskInput): CommitResult => {
  requireActor(h, input.memberId);
  const old = h.tasks?.find((r) => r.id === input.id);
  requireCurrent(old, input);
  if (old && old.visibility !== input.task.visibility) return fail("Keep an existing task in its original space.");
  const now = new Date().toISOString();
  const draft = validateTask({
    ...input.task,
    acknowledgedBy: old?.acknowledgedBy ?? [],
    completedAt: old?.completedAt ?? null, completedBy: old?.completedBy ?? null, completionEvidence: old?.completionEvidence ?? null,
    version: 1, id: input.id, revision: input.expectedRevision + 1, createdBy: old?.createdBy ?? input.memberId, createdAt: old?.createdAt ?? now, updatedAt: now,
  });
  // A reassignment is a new ask: only the people who still hold it keep their acknowledgement.
  const row: Task = { ...draft, acknowledgedBy: draft.acknowledgedBy.filter((id) => id === draft.assigneeId || id === draft.backupId) };
  checkReferences(h, row);
  if (!old && (h.tasks ?? []).filter((r) => !r.deleted).length >= TASK_LIMIT) return fail("Finish or remove some tasks before adding another.");
  return { household: put(h, row), postedIds: [row.id], warnings: [], undo: undo(h, row, row.deleted ? "Remove task" : old ? "Edit task" : "Add task", "planner-task") };
});

export type CompleteTaskInput = { memberId: string; id: string; expectedRevision: number; evidence?: TaskEvidence | null; completedAt?: string };
/** A tick is for the vet. A money task needs evidence that already exists in accepted books. */
export const completeTask = captureCommand("completeTask", (h: Household, input: CompleteTaskInput): CommitResult => {
  requireActor(h, input.memberId);
  const old = h.tasks?.find((r) => r.id === input.id);
  requireCurrent(old, input);
  if (!old) return fail("This task is not here any more.");
  if (old.completedAt) return fail("This task is already done.");
  const evidence = input.evidence ?? null;
  if (taskIsFinancial(old) && !evidence) return fail("A money task completes by evidence, never by a tick. Record the payment, then attach it.");
  if (evidence) {
    if (evidence.kind === "transaction") {
      const tx = h.transactions.find((row) => row.id === evidence.transactionId && !row.isDuplicate && (row.visibility !== "personal" || row.createdBy === input.memberId));
      if (!tx || tx.amountCents !== evidence.amountCents || tx.date !== evidence.date) return fail("That receipt is not in the books as described.");
    } else {
      const contribution = (h.goalContributions ?? []).find((row) => row.id === evidence.contributionId);
      if (!contribution || contribution.amountCents !== evidence.amountCents || contribution.date !== evidence.date) return fail("That contribution is not in the books as described.");
    }
  }
  const now = input.completedAt && iso(input.completedAt) ? input.completedAt : new Date().toISOString();
  const row = validateTask({ ...old, revision: old.revision + 1, completedAt: now, completedBy: input.memberId, completionEvidence: evidence, updatedAt: new Date().toISOString() });
  let next = put(h, row);
  // A repeating task keeps its history: this occurrence stays in the logbook and the next one opens on its own date.
  const following = nextTaskDates(old);
  if (following) {
    const nextId = `${old.id}-r${(following.doDate ?? following.dueDate)!.replace(/-/g, "")}`;
    if (!(next.tasks ?? []).some((r) => r.id === nextId)) next = put(next, validateTask({ ...old, id: nextId, revision: 1, ...following, acknowledgedBy: [], completedAt: null, completedBy: null, completionEvidence: null, createdAt: now, updatedAt: now }));
  }
  return { household: next, postedIds: [row.id], warnings: [], undo: undo(h, row, "Complete task", "planner-task") };
});
/** Where a repeating task goes after one occurrence is done. Yearly keeps the day; the rest follow the recurrence engine. */
export function nextTaskDates(task: Task): { doDate: DateKey | null; dueDate: DateKey | null } | null {
  if (task.repeat === "none") return null;
  const shift = (date: DateKey | null) => date === null ? null : task.repeat === "yearly" ? `${Number(date.slice(0, 4)) + 1}${date.slice(4)}` : advanceCadence(date, task.repeat as RecurrenceCadence);
  return { doDate: shift(task.doDate), dueDate: shift(task.dueDate) };
}

export type TaskEditInput = { memberId: string; id: string; expectedRevision: number };
export const reopenTask = captureCommand("reopenTask", (h: Household, input: TaskEditInput): CommitResult => {
  requireActor(h, input.memberId);
  const old = h.tasks?.find((r) => r.id === input.id);
  requireCurrent(old, input);
  if (!old?.completedAt) return fail("This task is still open.");
  const row = validateTask({ ...old, revision: old.revision + 1, completedAt: null, completedBy: null, completionEvidence: null, updatedAt: new Date().toISOString() });
  return { household: put(h, row), postedIds: [row.id], warnings: [], undo: undo(h, row, "Reopen task", "planner-task") };
});

/** "Taking it" is a real act. Only the assignee or the backup can acknowledge; nobody acknowledges for someone else. */
export const acknowledgeTask = captureCommand("acknowledgeTask", (h: Household, input: TaskEditInput): CommitResult => {
  requireActor(h, input.memberId);
  const old = h.tasks?.find((r) => r.id === input.id);
  requireCurrent(old, input);
  if (!old) return fail("This task is not here any more.");
  if (old.assigneeId !== input.memberId && old.backupId !== input.memberId) return fail("Only the person holding this task can take it.");
  if (old.acknowledgedBy.includes(input.memberId)) return fail("You already have this one.");
  const row = validateTask({ ...old, revision: old.revision + 1, acknowledgedBy: [...old.acknowledgedBy, input.memberId], updatedAt: new Date().toISOString() });
  return { household: put(h, row), postedIds: [row.id], warnings: [], undo: undo(h, row, "Take task", "planner-task") };
});

export type TaskListInput = { memberId: string; id: string; expectedRevision: number; list: Pick<TaskList, "name" | "visibility" | "deleted"> };
export const saveTaskList = captureCommand("saveTaskList", (h: Household, input: TaskListInput): CommitResult => {
  requireActor(h, input.memberId);
  const old = h.taskLists?.find((r) => r.id === input.id);
  if ((old?.revision ?? 0) !== input.expectedRevision || old?.deleted) return fail("This list changed. Review its latest version.");
  if (old?.visibility === "personal" && old.createdBy !== input.memberId) return fail("This is another person’s private list.");
  if (old && old.visibility !== input.list.visibility) return fail("Keep an existing list in its original space.");
  if (!old && (h.taskLists ?? []).filter((r) => !r.deleted).length >= TASK_LIST_LIMIT) return fail("Remove a list before adding another.");
  const now = new Date().toISOString();
  const row = validateTaskList({ ...input.list, version: 1, id: input.id, revision: input.expectedRevision + 1, createdBy: old?.createdBy ?? input.memberId, createdAt: old?.createdAt ?? now, updatedAt: now });
  const next: Household = { ...h, taskLists: [...(h.taskLists ?? []).filter((r) => r.id !== row.id), row] };
  if (row.deleted) next.tasks = (next.tasks ?? []).map((task) => task.listId === row.id ? { ...task, listId: null, revision: task.revision + 1, updatedAt: now } : task);
  return { household: next, postedIds: [row.id], warnings: [], undo: undo(h, row, row.deleted ? "Remove list" : "Save list", "planner-list") };
});

/** The board to-do list is the seed. Adopt its rows once; the carousel page then links to the planner. */
export const adoptBoardTasks = captureCommand("adoptBoardTasks", (h: Household, input: { memberId: string }): CommitResult => {
  requireActor(h, input.memberId);
  const boards = shapeSharedBoards(h.kitchen.boards);
  const existing = new Set((h.tasks ?? []).map((row) => row.id));
  const now = new Date().toISOString();
  const adopted: Task[] = boards.tasks.filter((row) => !existing.has(`TASK-board-${row.id.replace(/^BOARD-TASK-/, "")}`) && !h.tombstones.some((t) => t.id === row.id)).map((row) => validateTask({
    version: 1, id: `TASK-board-${row.id.replace(/^BOARD-TASK-/, "")}`, revision: 1, createdBy: row.createdBy, visibility: "household",
    title: row.title, notes: "", listId: null, parentId: null, doDate: null, dueDate: row.dueDate, repeat: "none", cue: "none",
    assigneeId: h.members.some((m) => m.id === row.assigneeId && m.active) ? row.assigneeId : null, backupId: null, acknowledgedBy: [],
    chapterId: null, planReference: row.planReference && h.planVersions?.some((plan) => plan.id === row.planReference!.planVersionId && plan.scope === "household" && plan.state === "active" && plan.lines.some((line) => line.id === row.planReference!.planLineId)) ? row.planReference : null,
    moneyLink: null, expectedAmountCents: null,
    completedAt: row.completed ? row.updatedAt : null, completedBy: row.completed ? row.createdBy : null, completionEvidence: null,
    deleted: false, createdAt: row.createdAt, updatedAt: now,
  }));
  if (!adopted.length) return fail("Every board to-do is already in the planner.");
  const next: Household = { ...h, tasks: [...(h.tasks ?? []), ...adopted], kitchen: { ...h.kitchen, boards: { ...boards, tasks: [] } }, tombstones: mergeTombstones(h.tombstones, boards.tasks.map((row) => ({ id: row.id, deletedAt: now }))) };
  return { household: next, postedIds: adopted.map((row) => row.id), warnings: [], undo: { id: crypto.randomUUID(), label: "Move to-dos into the planner", snapshot: h, postedIds: adopted.map((row) => row.id), commandKind: "planner-adopt" } };
});
