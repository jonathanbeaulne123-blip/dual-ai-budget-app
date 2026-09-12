import type { LedgerView } from "./types.ts";

/**
 * The adaptive action (Vision v2 §4.5, narrowed by feedback row 5).
 * One control in a stable position; + means add. Every verb opens an Add
 * flow that ends at Final Confirm; none of them navigate. Household verbs
 * are verb-first and reorder by destination; My Money keeps its direct four
 * in their known order. Shift stays available in Our Home because shared
 * income is often shift income; it sits last because Work is a My Money job.
 *
 * "Plan a cost" lives on the Calendar's own +, "Decide together" is the
 * Together tab, and "Plan the week" is the planner room (D-245): the +
 * stopped carrying a second route to any of them (row 5).
 */
export type FabAddMode = "shift" | "income" | "expense" | "transfer";

export type FabAction =
  | { id: string; kind: "add"; mode: FabAddMode; label: string; aria: string; money: true }
  | { id: string; kind: "go"; tab: "calendar" | "together" | "plan" | "ledger" | "planner"; label: string; aria: string; money: false };

export type FabActionTab = "home" | "calendar" | "shift" | "ledger" | "plan" | "together" | "more" | "planner" | string;

const PERSONAL: readonly FabAction[] = [
  { id: "shift", kind: "add", mode: "shift", label: "Shift", aria: "Add shift", money: true },
  { id: "income", kind: "add", mode: "income", label: "Income", aria: "Add income", money: true },
  { id: "expense", kind: "add", mode: "expense", label: "Expense", aria: "Add expense", money: true },
  { id: "transfer", kind: "add", mode: "transfer", label: "Transfer", aria: "Add transfer", money: true },
];

const RECORD: FabAction = { id: "record-expense", kind: "add", mode: "expense", label: "Record an expense", aria: "Add expense", money: true };
const ADD_INCOME: FabAction = { id: "add-income", kind: "add", mode: "income", label: "Add income", aria: "Add income", money: true };
const MOVE_MONEY: FabAction = { id: "move-money", kind: "add", mode: "transfer", label: "Move money", aria: "Add transfer", money: true };
const ADD_SHIFT: FabAction = { id: "add-shift", kind: "add", mode: "shift", label: "Add a shift", aria: "Add shift", money: true };
/** Ordered actions for the + control. Household order follows the destination's job. */
export function fabActionsFor(view: LedgerView, tab: FabActionTab): readonly FabAction[] {
  if (view !== "household") return PERSONAL;
  switch (tab) {
    case "ledger":
      return [RECORD, ADD_INCOME, MOVE_MONEY, ADD_SHIFT];
    case "plan":
      return [RECORD, MOVE_MONEY, ADD_INCOME, ADD_SHIFT];
    default:
      return [RECORD, ADD_INCOME, MOVE_MONEY, ADD_SHIFT];
  }
}

/** The closed control's name is the same in both spaces: it adds money. The space names the ledger before any verb. */
export function fabClosedLabel(view: LedgerView): string {
  void view;
  return "Add money";
}
