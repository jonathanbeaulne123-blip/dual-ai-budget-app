/**
 * Plan stops: shared Kitty Bank goals on their arrival date, and household planning steps (tasks) on their do/due
 * date. Fully backed is never bought (bought needs a recorded purchase, `goal.purchaseId`); a done task is a trace,
 * never a memory. A goal with no arrival date is not placed on a guessed day.
 */
import { dateKeyInZone, monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import { goalArrivalDate, goalSavedAsOf } from "../../core/goals.ts";
import { kittyBankBackingStep, kittyBanksInView } from "../../core/kittyBanks.ts";
import { taskVisibleTo, type Task } from "../../core/tasks.ts";
import { journeyIds, type PlanStop } from "../contracts.ts";
import { action, relationOf } from "./stopKit.ts";
import type { DeriveContext } from "./window.ts";

const isDateKey = (value: unknown): value is DateKey => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function goalStops(ctx: DeriveContext): PlanStop[] {
  if (!ctx.viewerActive) return [];
  const out: PlanStop[] = [];
  let goals: ReturnType<typeof kittyBanksInView> = [];
  try { goals = kittyBanksInView(ctx.household, "household", ctx.memberId); } catch { goals = []; }
  for (const goal of goals) {
    const arrival = goalArrivalDate(goal);
    if (!isDateKey(arrival)) continue;
    const chapterId = monthKeyFromDateKey(arrival);
    if (!ctx.monthSet.has(chapterId)) continue;
    const step = kittyBankBackingStep(ctx.household, goal, ctx.today);
    const status: "backing" | "fully-backed" | "bought" = goal.purchaseId ? "bought" : step >= 10 ? "fully-backed" : "backing";
    const id = journeyIds.planGoal(goal.id);
    out.push({
      kind: "plan", id, date: arrival, chapterId, label: goal.name,
      amountCents: goal.targetCents, amountBasis: "target", placeRef: { kind: "kittyPlaza" },
      sourceRefs: [{ kind: "goal", id: goal.id }], major: true, relation: relationOf(arrival, ctx.today),
      actions: [action(id, "kitty", "Open the Kitty Bank", { name: "openKitty", goalId: goal.id }, true)],
      planKind: "goal", goalId: goal.id, status, step,
      savedCents: goalSavedAsOf(ctx.household, goal.id, ctx.today), targetCents: goal.targetCents,
    });
  }
  return out;
}

/** Household planning steps the viewer may see. Partner-private steps never appear. */
export function visibleTasks(ctx: DeriveContext): Task[] {
  return (ctx.household.tasks ?? []).filter(task => !task.deleted && task.visibility === "household" && taskVisibleTo(task, ctx.memberId, "household"));
}

export function taskCompletedOn(task: Task, timeZone: string): DateKey | null {
  if (!task.completedAt) return null;
  const at = new Date(task.completedAt);
  return Number.isFinite(at.getTime()) ? dateKeyInZone(at, timeZone) : null;
}

export function taskStops(ctx: DeriveContext): PlanStop[] {
  if (!ctx.viewerActive) return [];
  const out: PlanStop[] = [];
  for (const task of visibleTasks(ctx)) {
    const date = task.doDate ?? task.dueDate;
    if (!isDateKey(date)) continue;
    const chapterId = monthKeyFromDateKey(date);
    if (!ctx.monthSet.has(chapterId)) continue;
    const id = journeyIds.planTask(task.id);
    out.push({
      kind: "plan", id, date, chapterId, label: task.title,
      ...(task.expectedAmountCents !== null && task.expectedAmountCents !== undefined ? { amountCents: task.expectedAmountCents, amountBasis: "scheduled" as const } : {}),
      sourceRefs: [{ kind: "task", id: task.id }, ...(task.planReference ? [{ kind: "planLine" as const, id: task.planReference.planLineId }] : [])],
      major: false, relation: relationOf(date, ctx.today),
      actions: [action(id, "planner", "Open the step", { name: "openPlace", target: "planner", object: `task/${task.id}` }, true)],
      planKind: "task", taskId: task.id, status: task.completedAt ? "done" : "open", planLineId: task.planReference?.planLineId ?? null,
    });
  }
  return out;
}
