import type { Household, LedgerView } from "../core/index.ts";
import type { TaskInput } from "../core/tasks.ts";

export type PlannerEditor = TaskInput & { expectedAmount: string };
export type PlannerDraftIdentity = { environment: string; householdId: string; memberId: string; view: LedgerView };
export type PlannerDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type CaptureDraft = { version: 1; identity: PlannerDraftIdentity; taskId: "capture"; value: string };
type EditorDraft = { version: 1; identity: PlannerDraftIdentity; taskId: string; editor: PlannerEditor };
type NavigationDraft = { version: 1; identity: PlannerDraftIdentity; taskId: string };

const PREFIX = "hearth:planner-draft:v1";
const MAX_DRAFT = 96 * 1024;
const part = (value: string) => encodeURIComponent(value);
const sameIdentity = (left: PlannerDraftIdentity, right: PlannerDraftIdentity) => left.environment === right.environment && left.householdId === right.householdId && left.memberId === right.memberId && left.view === right.view;

export function plannerDraftIdentity(household: Pick<Household, "environment" | "householdId">, memberId: string, view: LedgerView): PlannerDraftIdentity {
  return { environment: household.environment, householdId: household.householdId, memberId, view };
}

export function plannerDraftKey(identity: PlannerDraftIdentity, taskId: string): string {
  return [PREFIX, identity.environment, identity.householdId, identity.memberId, identity.view, taskId].map(part).join(":");
}

function navigationKey(identity: PlannerDraftIdentity): string {
  return [PREFIX, "active", identity.environment, identity.householdId, identity.memberId, identity.view].map(part).join(":");
}

function readJson(storage: PlannerDraftStorage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  if (raw.length > MAX_DRAFT) throw new Error("PLANNER_DRAFT_TOO_LARGE");
  return JSON.parse(raw);
}

function decodeIdentity(value: unknown): PlannerDraftIdentity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.environment !== "string" || typeof row.householdId !== "string" || typeof row.memberId !== "string" || (row.view !== "personal" && row.view !== "household")) return null;
  if (!row.environment || !row.householdId || !row.memberId || row.environment.length > 80 || row.householdId.length > 160 || row.memberId.length > 160) return null;
  return { environment: row.environment, householdId: row.householdId, memberId: row.memberId, view: row.view };
}

function validEditor(value: unknown, expectedTaskId: string, expectedMemberId: string): value is PlannerEditor {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>, task = row.task as Record<string, unknown> | null;
  if (row.id !== expectedTaskId || row.memberId !== expectedMemberId || !Number.isSafeInteger(row.expectedRevision) || typeof row.expectedAmount !== "string" || row.expectedAmount.length > 80 || !task) return false;
  return (task.visibility === "personal" || task.visibility === "household") && typeof task.title === "string" && task.title.length <= 240 && typeof task.notes === "string" && task.notes.length <= 2000;
}

export function readPlannerCapture(storage: PlannerDraftStorage, expected: PlannerDraftIdentity): string {
  const value = readJson(storage, plannerDraftKey(expected, "capture"));
  if (value === null) return "";
  if (!value || typeof value !== "object") throw new Error("PLANNER_CAPTURE_INVALID");
  const row = value as Partial<CaptureDraft>, savedIdentity = decodeIdentity(row.identity);
  if (row.version !== 1 || row.taskId !== "capture" || !savedIdentity || !sameIdentity(savedIdentity, expected) || typeof row.value !== "string" || row.value.length > 4000) throw new Error("PLANNER_CAPTURE_INVALID");
  return row.value;
}

export function savePlannerCapture(storage: PlannerDraftStorage, identity: PlannerDraftIdentity, value: string): void {
  if (value.length > 4000) throw new Error("PLANNER_CAPTURE_INVALID");
  const draft: CaptureDraft = { version: 1, identity, taskId: "capture", value };
  if (value) storage.setItem(plannerDraftKey(identity, "capture"), JSON.stringify(draft));
  else storage.removeItem(plannerDraftKey(identity, "capture"));
}

export function readPlannerEditor(storage: PlannerDraftStorage, expected: PlannerDraftIdentity): PlannerEditor | null {
  const navigation = readJson(storage, navigationKey(expected));
  if (navigation === null) return null;
  if (!navigation || typeof navigation !== "object") throw new Error("PLANNER_NAVIGATION_INVALID");
  const nav = navigation as Partial<NavigationDraft>, savedIdentity = decodeIdentity(nav.identity);
  if (nav.version !== 1 || !savedIdentity || !sameIdentity(savedIdentity, expected) || typeof nav.taskId !== "string" || !nav.taskId || nav.taskId.length > 160) throw new Error("PLANNER_NAVIGATION_INVALID");
  const value = readJson(storage, plannerDraftKey(expected, nav.taskId));
  if (!value || typeof value !== "object") throw new Error("PLANNER_EDITOR_INVALID");
  const row = value as Partial<EditorDraft>, editorIdentity = decodeIdentity(row.identity);
  if (row.version !== 1 || row.taskId !== nav.taskId || !editorIdentity || !sameIdentity(editorIdentity, expected) || !validEditor(row.editor, nav.taskId, expected.memberId)) throw new Error("PLANNER_EDITOR_INVALID");
  if (expected.view === "personal" && row.editor.task.visibility !== "personal") throw new Error("PLANNER_EDITOR_SCOPE_MISMATCH");
  return row.editor;
}

export function savePlannerEditor(storage: PlannerDraftStorage, identity: PlannerDraftIdentity, editor: PlannerEditor): void {
  if (!validEditor(editor, editor.id, identity.memberId)) throw new Error("PLANNER_EDITOR_INVALID");
  const draft: EditorDraft = { version: 1, identity, taskId: editor.id, editor };
  const navigation: NavigationDraft = { version: 1, identity, taskId: editor.id };
  storage.setItem(plannerDraftKey(identity, editor.id), JSON.stringify(draft));
  storage.setItem(navigationKey(identity), JSON.stringify(navigation));
}

export function clearPlannerEditor(storage: PlannerDraftStorage, identity: PlannerDraftIdentity, taskId: string): void {
  storage.removeItem(plannerDraftKey(identity, taskId));
  const navigation = readJson(storage, navigationKey(identity));
  if (!navigation || typeof navigation !== "object") return;
  const row = navigation as Partial<NavigationDraft>, savedIdentity = decodeIdentity(row.identity);
  if (row.version === 1 && savedIdentity && sameIdentity(savedIdentity, identity) && row.taskId === taskId) storage.removeItem(navigationKey(identity));
}
