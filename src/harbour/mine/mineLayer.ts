/**
 * The Mine layer (Tool Atlas §3.5 "Mine", K4, decision D2): one island for both
 * spaces. In Mine, the signed-in member's private things are drawn on the
 * *household* harbour, and only on that member's own device and screen:
 *
 * - **footpaths** — the member's private tasks, exactly `core/pathFootpaths.ts`
 *   (the Journey map's private footpaths, D-264 step 6), walked or open;
 * - **steps** — the member's *open* private tasks, as small stakes at the
 *   Glasshouse (the Glasshouse holds "steps", §3.2);
 * - **banks** — the member's open private Kitty Banks (the member-personal nest,
 *   `projectKittyNest(..., "personal", ...)`), on the Loft's private shelf.
 *
 * The personal camp card's facts are not duplicated here: `mineCamp` is the
 * Desk's own `readPersonalToday` (`desk/personalModel.ts`), exposed so a Mine
 * surface reads one source.
 *
 * Trust boundary. Pure and derived on read: nothing here is stored, synced,
 * sent to a model, or written to `pathWorld`. Every row passes the one
 * owner-only guard in `core/pathFootpaths.ts` (`ownsPrivateTask`,
 * `ownsPrivateGoal`), so the layer **never** includes another member's private
 * rows — even when a full snapshot sits in memory — and never a household row.
 * No row carries an amount: labels, dates and states only (CONTRACT rules
 * 18–19, "nothing on the ground encodes money"). A member the household does
 * not know reads an empty layer. This module imports no command.
 */
import type { DateKey } from "../../core/calendar.ts";
import { projectKittyNest } from "../../core/kittyNest.ts";
import { ownsPrivateGoal, ownsPrivateTask, pathFootpaths, type PathFootpath } from "../../core/pathFootpaths.ts";
import { pathLabel, pathTaskDone } from "../../core/pathStones.ts";
import { taskIsFinancial, type Task } from "../../core/tasks.ts";
import type { Household } from "../../core/types.ts";
import type { HarbourPlaceId } from "../flag.ts";
import { readPersonalToday, type PersonalToday } from "../desk/personalModel.ts";

/** The two spaces, as the Ours | Mine pill names them (brief §3.2). The App's `view` is the source. */
export type MineSpace = "ours" | "mine";

/** The App's ledger view, read as a space: personal is Mine, everything else is Ours. */
export function spaceForView(view: string | null | undefined): MineSpace {
  return view === "personal" ? "mine" : "ours";
}

/** A private step: an open private task, drawn as a stake at the Glasshouse. Never an amount. */
export type MineStep = {
  id: string;
  /** At most 60 characters (`pathLabel`). */
  label: string;
  /** Do date, else due date; null when undated. */
  when: DateKey | null;
  /** True when `when` is before today. Words, never colour alone. */
  late: boolean;
  /** A money step completes by books evidence, never a tick (D-245). No amount travels with it. */
  money: boolean;
};

/** A private Kitty Bank on the Loft's private shelf. Name and date only: the bank's own room shows its money. */
export type MineBank = {
  /** The nest id (`goal:<goalId>`), the object the Loft opens as `bank/<id>`. */
  id: string;
  goalId: string;
  label: string;
  date: DateKey | null;
};

export type MineLayer = {
  memberId: string;
  footpaths: PathFootpath[];
  steps: MineStep[];
  banks: MineBank[];
  /** True when there is nothing private to draw. */
  empty: boolean;
};

/** Where each kind stands on the shared island. Hosts keep their meaning in both spaces. */
export const MINE_HOSTS: Readonly<Record<"footpaths" | "steps" | "banks", { place: HarbourPlaceId; words: string }>> = Object.freeze({
  footpaths: Object.freeze({ place: "court" as const, words: "the island" }),
  steps: Object.freeze({ place: "glasshouse" as const, words: "the Glasshouse" }),
  banks: Object.freeze({ place: "tower" as const, words: "the Loft's private shelf" }),
});

/**
 * The Fund bank is always the shared Fund. In Mine its panel must say so in
 * these words (it never becomes "my Fund"); the Loft shows private banks.
 */
export const MINE_FUND_WORDS = "the shared Fund";

export const MINE_STEP_LIMIT = 12;
export const MINE_BANK_LIMIT = 12;

const EMPTY = (memberId: string): MineLayer => ({ memberId, footpaths: [], steps: [], banks: [], empty: true });

function stepWhen(task: Pick<Task, "doDate" | "dueDate">): DateKey | null {
  return task.doDate ?? task.dueDate ?? null;
}

/**
 * The member's private things, placed on the shared island. `memberId` is the
 * signed-in member; nobody else's id may be passed on their behalf, and the
 * result is only ever drawn on that member's screen in Mine.
 */
export function mineLayer(household: Household, memberId: string, today: DateKey): MineLayer {
  if (!memberId || !household.members.some((member) => member.id === memberId)) return EMPTY(memberId);

  let footpaths: PathFootpath[] = [];
  try { footpaths = pathFootpaths(household, memberId, today); } catch { footpaths = []; }

  let steps: MineStep[] = [];
  try {
    steps = (household.tasks ?? [])
      .filter((task) => ownsPrivateTask(task, memberId) && task.parentId === null && !pathTaskDone(household, task))
      .sort((a, b) => {
        const aw = stepWhen(a), bw = stepWhen(b);
        if (aw !== bw) return aw === null ? 1 : bw === null ? -1 : aw.localeCompare(bw);
        return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
      })
      .slice(0, MINE_STEP_LIMIT)
      .map((task): MineStep => {
        const when = stepWhen(task);
        return {
          id: task.id,
          label: pathLabel(task.title),
          when,
          late: when !== null && when < today,
          money: taskIsFinancial(task),
        };
      });
  } catch { steps = []; }

  let banks: MineBank[] = [];
  try {
    banks = projectKittyNest(household, memberId, "personal", today).categories
      .flatMap((category) => category.children)
      // Re-check the projection row by row: a private bank is a goal this member owns, and nothing else.
      .filter((bank) => bank.tier === "goal" && bank.state === "open" && bank.goal !== undefined && ownsPrivateGoal(bank.goal, memberId))
      .slice(0, MINE_BANK_LIMIT)
      .map((bank): MineBank => ({ id: bank.id, goalId: bank.goal!.id, label: pathLabel(bank.name, "A Kitty Bank"), date: bank.date }));
  } catch { banks = []; }

  return { memberId, footpaths, steps, banks, empty: !footpaths.length && !steps.length && !banks.length };
}

/**
 * The personal camp card's facts, read once from the Desk's model. Not
 * duplicated: this is `readPersonalToday` itself (seals, plates, the month).
 */
export function mineCamp(household: Household, memberId: string, today: DateKey): PersonalToday {
  return readPersonalToday(household, memberId, today);
}
