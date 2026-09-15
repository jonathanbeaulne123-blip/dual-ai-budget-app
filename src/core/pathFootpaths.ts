import type { DateKey } from "./calendar.ts";
import { pathLabel, pathTaskDone } from "./pathStones.ts";
import { taskInView, taskIsFinancial } from "./tasks.ts";
import type { Household } from "./types.ts";

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

export function pathFootpaths(household: Household, memberId: string, today: DateKey): PathFootpath[] {
  void today;
  if (!memberId) return [];
  return (household.tasks ?? [])
    .filter((task) => !task.deleted && task.visibility === "personal" && task.createdBy === memberId && taskInView(task, memberId, "personal"))
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
