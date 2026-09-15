import { evidenceForTask } from "./agenda.ts";
import type { DateKey } from "./calendar.ts";
import { taskInView, taskIsFinancial, type Task } from "./tasks.ts";
import type { Household } from "./types.ts";

/**
 * Our Path stepping stones (Jonathan's step 5). Pure: household planner tasks in,
 * one stone per task out. A stone carries its owner and backup footprints and
 * never an amount. A money task lights only when the books already hold the
 * evidence that completes it (D-245) — a tick never lights a stone.
 *
 * Private (`visibility: "personal"`) tasks never appear here; they belong to
 * private footpaths.
 */

export type PathStone = {
  id: string;
  label: string;
  /** YYYY-MM the stone sits in: due month, else created month. */
  month: string;
  state: "open" | "done" | "waiting";
  owner: string | null;
  backup: string | null;
  money: boolean;
  /** True only when the money task is complete by accepted-books evidence (after Confirm). */
  lit: boolean;
  chapterId: string | null;
  why: string;
};

export const PATH_STONE_LIMIT = 40;
const LABEL_LIMIT = 60;

/** Shared with private footpaths: one line, at most 60 characters. */
export function pathLabel(title: string): string {
  const text = title.trim().replace(/\s+/g, " ");
  return text.length <= LABEL_LIMIT ? text : `${text.slice(0, LABEL_LIMIT - 1).trimEnd()}…`;
}

/**
 * The D-245 completion rule, exactly as the planner agenda reads it: a task is done
 * when it was completed (a money task can only be completed with evidence already
 * in the books), or when a money-linked task's evidence is found in the books.
 */
export function pathTaskDone(household: Household, task: Task): boolean {
  const evidence = task.completedAt ? task.completionEvidence : evidenceForTask(household, task);
  return Boolean(task.completedAt) || (evidence !== null && task.moneyLink !== null);
}

export function pathStones(household: Household, memberId: string, today: DateKey): PathStone[] {
  void today;
  const names = new Map(household.members.map((member) => [member.id, member.name]));
  const nameOf = (id: string | null) => (id === null ? null : names.get(id) ?? null);
  return (household.tasks ?? [])
    .filter((task) => !task.deleted && task.visibility === "household" && taskInView(task, memberId, "household"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, PATH_STONE_LIMIT)
    .map((task): PathStone => {
      const money = taskIsFinancial(task);
      const done = pathTaskDone(household, task);
      const lit = money && done;
      const state: PathStone["state"] = done ? "done" : money ? "waiting" : "open";
      const owner = nameOf(task.assigneeId);
      const backup = nameOf(task.backupId);
      const why: string[] = [];
      if (owner && backup) why.push(`Owned by ${owner}, ${backup} as backup`);
      else if (owner) why.push(`Owned by ${owner}`);
      else if (backup) why.push(`${backup} as backup`);
      else why.push("Shared by both of you");
      if (money) why.push(lit ? "Lit because the money is confirmed in the books" : "Lights when the money is confirmed in the books");
      else if (done) why.push("Done");
      return {
        id: task.id,
        label: pathLabel(task.title),
        month: (task.dueDate ?? task.createdAt).slice(0, 7),
        state,
        owner,
        backup,
        money,
        lit,
        chapterId: task.chapterId,
        why: why.join(" · "),
      };
    });
}
