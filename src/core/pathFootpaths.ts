import type { DateKey } from "./calendar.ts";
import { pathLabel, pathTaskDone } from "./pathStones.ts";
import { taskInView, taskIsFinancial } from "./tasks.ts";
import type { Goal, Household } from "./types.ts";
import type { Task } from "./tasks.ts";

/**
 * Our Path private footpaths (Jonathan's step 6): "Each person has footpaths only
 * they can see." Pure and derived on read — nothing here is stored or synced.
 *
 * Privacy predicate (the whole point): a footpath is a task that is not deleted,
 * has `visibility: "personal"`, and `taskInView(task, memberId, "personal")`
 * (which is `createdBy === memberId && visibility === "personal"`). A device only
 * ever holds the signed-in member's own Personal envelope, and this filter keeps
 * the partner's personal rows out even when a full snapshot is in memory.
 *
 * A footpath never carries an amount. A money footpath lights by the same D-245
 * rule as a stepping stone (books evidence after Confirm; a tick never lights it).
 */

export type PathFootpath = {
  id: string;
  /** At most 60 characters. */
  label: string;
  /** YYYY-MM: due month, else created month. */
  month: string;
  state: "open" | "done";
  money: boolean;
  /** True only when the money task is complete by accepted-books evidence. */
  lit: boolean;
  why: string;
};

export const PATH_FOOTPATH_LIMIT = 40;

/**
 * The owner-only guard (the trust boundary, D-264 step 6; extended by the Mine
 * layer, Tool Atlas D2). One predicate for every private task a surface draws:
 * not deleted, `visibility: "personal"`, created by this member, and in the
 * member's personal view. A blank member owns nothing. The Mine layer
 * (`harbour/mine/mineLayer.ts`) reads footpaths *and* Glasshouse steps through
 * this one function, so there is a single place to review.
 */
export function ownsPrivateTask(task: Pick<Task, "deleted" | "visibility" | "createdBy">, memberId: string): boolean {
  return Boolean(memberId) && !task.deleted && task.visibility === "personal" && task.createdBy === memberId && taskInView(task, memberId, "personal");
}

/**
 * The same guard for a private Kitty Bank: a goal that is not shared and is
 * owned by this member (`visibility.ts` `goalVisibleInView(goal, memberId,
 * "personal")`, restated so the Mine layer can re-check a projection's output
 * row by row). A blank member, or a goal with no owner, is never private-mine.
 */
export function ownsPrivateGoal(goal: Pick<Goal, "shared" | "ownerMemberId">, memberId: string): boolean {
  return Boolean(memberId) && goal.shared === false && goal.ownerMemberId !== null && goal.ownerMemberId === memberId;
}

export function pathFootpaths(household: Household, memberId: string, today: DateKey): PathFootpath[] {
  void today;
  if (!memberId) return [];
  return (household.tasks ?? [])
    .filter((task) => ownsPrivateTask(task, memberId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, PATH_FOOTPATH_LIMIT)
    .map((task): PathFootpath => {
      const money = taskIsFinancial(task);
      const done = pathTaskDone(household, task);
      const lit = money && done;
      const why = ["Only you can see this path"];
      if (money) why.push(lit ? "Lit because the money is confirmed in your books" : "Lights when the money is confirmed in your books");
      else why.push(done ? "Done — walked" : "Still yours to walk");
      return {
        id: task.id,
        label: pathLabel(task.title),
        month: (task.dueDate ?? task.createdAt).slice(0, 7),
        state: done ? "done" : "open",
        money,
        lit,
        why: why.join(" · "),
      };
    });
}
