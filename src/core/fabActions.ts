import type { LedgerView } from "./types.ts";

/**
 * The adaptive action (Vision v2 §4.5). One control in a stable position whose
 * verb set changes with the space and destination.
 *
 * Rules kept from the original speed dial: actions open a flow, they never
 * post; every financial verb still ends at Final Confirm; the active ledger is
 * named by the space before any money verb. Household verbs are verb-first and
 * reorder by destination; My Money keeps its direct four in their known order.
 * Shift stays available in Our Home because shared income is often shift income;
 * it sits last because Work itself is a My Money job.
 */
export type FabAddMode = "shift" | "income" | "expense" | "transfer";

export type FabAction =
  | { id: string; kind: "add"; mode: FabAddMode; label: string; aria: string; money: true }
  | { id: string; kind: "go"; tab: "calendar" | "together" | "plan" | "ledger"; label: string; aria: string; money: false };

export type FabActionTab = "home" | "calendar" | "shift" | "ledger" | "plan" | "together" | "more" | string;

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
const PLAN_COST: FabAction = { id: "plan-cost", kind: "go", tab: "calendar", label: "Plan a cost", aria: "Plan an upcoming cost", money: false };
const DECIDE: FabAction = { id: "decide-together", kind: "go", tab: "together", label: "Decide together", aria: "Open what needs us together", money: false };

/** Ordered actions for the + control. Household order follows the destination's job. */
export function fabActionsFor(view: LedgerView, tab: FabActionTab): readonly FabAction[] {
  if (view !== "household") return PERSONAL;
  switch (tab) {
    case "together":
      return [DECIDE, RECORD, PLAN_COST, ADD_INCOME, MOVE_MONEY, ADD_SHIFT];
    case "plan":
      return [PLAN_COST, RECORD, DECIDE, ADD_INCOME, MOVE_MONEY, ADD_SHIFT];
    case "ledger":
      return [RECORD, ADD_INCOME, MOVE_MONEY, PLAN_COST, DECIDE, ADD_SHIFT];
    default:
      return [RECORD, PLAN_COST, DECIDE, ADD_INCOME, MOVE_MONEY, ADD_SHIFT];
  }
}

/** The closed control's name: "Add money" in My Money, the question itself in Our Home. */
export function fabClosedLabel(view: LedgerView): string {
  return view === "household" ? "What can we do?" : "Add money";
}
