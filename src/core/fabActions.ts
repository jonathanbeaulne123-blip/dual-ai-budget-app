import type { LedgerView } from "./types.ts";

/**
 * The Record speed dial (Tool Atlas brief §3.3; Vision v2 §4.5; D-164, D-246).
 *
 * One control in a stable position. + means add and nothing navigates: every
 * verb opens an Add flow, and only that flow's Final Confirm posts. Five verbs,
 * in one order for both people and both spaces — money out, then money in,
 * then the row that is neither — nearest the thumb first:
 * Purchase · Shift · Income · Bill paid · Move money.
 *
 * Shift shows only for a member with a job set up; the other partner's dial is
 * a stable four. The per-tab reorder and the navigation ("go") verbs are gone.
 */

/**
 * The Add flows the App's `openAddFor` opens today. Kept at four so the
 * harbour bar's `CompassFab.onPick` (and App's `openAddFor`) stay exact; the
 * dial's fifth verb, Bill paid, is `FabVerbMode` and reaches the App through
 * `FabSpeedDial`'s `onBillPaid`.
 */
export type FabAddMode = "shift" | "income" | "expense" | "transfer";
/** Every verb on the dial: the four Add flows plus Bill paid (§3.3 "`FabAddMode` gains `bill`"). */
export type FabVerbMode = FabAddMode | "bill";

/** The stroke icon each verb carries (24-grid, drawn in `FabSpeedDial.tsx`). */
export type FabIcon = "receipt" | "clock-tray" | "hand-coin" | "slip-stamp" | "two-arrows";

export type FabAction = {
  id: "purchase" | "shift" | "income" | "bill-paid" | "move-money";
  kind: "add";
  mode: FabVerbMode;
  /** The visible word. Never hidden: money verbs are never icon-only (§4.2). */
  label: string;
  /** The accessible name. Starts with the visible label (WCAG 2.5.3). */
  aria: string;
  icon: FabIcon;
  money: true;
};

/** @deprecated Tabs are no longer an input to the dial: the order is the same everywhere. Accepted and ignored for one release. */
export type FabActionTab = string;

export type FabActionOptions = {
  /** Does the signed-in member have an active job (`WorkJobs`)? `false` hides Shift; unknown keeps it. */
  memberHasJob?: boolean;
};

export const FAB_VERBS: readonly FabAction[] = [
  { id: "purchase", kind: "add", mode: "expense", label: "Purchase", aria: "Purchase: record one", icon: "receipt", money: true },
  { id: "shift", kind: "add", mode: "shift", label: "Shift", aria: "Shift: clock in, clock out, or record one", icon: "clock-tray", money: true },
  { id: "income", kind: "add", mode: "income", label: "Income", aria: "Income: record it", icon: "hand-coin", money: true },
  { id: "bill-paid", kind: "add", mode: "bill", label: "Bill paid", aria: "Bill paid: record a bill as paid", icon: "slip-stamp", money: true },
  { id: "move-money", kind: "add", mode: "transfer", label: "Move money", aria: "Move money between accounts", icon: "two-arrows", money: true },
];
const WITHOUT_SHIFT: readonly FabAction[] = FAB_VERBS.filter((action) => action.id !== "shift");

/**
 * The dial's verbs, nearest the thumb first. The same list in both spaces;
 * the Add flow's first slide names the ledger, so the space never decides
 * where money goes on its own (D1).
 *
 * The second argument used to be the current tab; a string is still accepted
 * and ignored so existing call sites compile for one release.
 */
export function fabActionsFor(view: LedgerView, options?: FabActionOptions | FabActionTab): readonly FabAction[] {
  void view;
  const memberHasJob = typeof options === "object" && options ? options.memberHasJob : undefined;
  return memberHasJob === false ? WITHOUT_SHIFT : FAB_VERBS;
}

/** The closed control's word, the same in both spaces. */
export function fabClosedLabel(view: LedgerView): string {
  void view;
  return "Record";
}

/** The closed control's description (`aria-describedby`). */
export const FAB_CLOSED_DESCRIPTION = "Purchase, shift, income, bill paid, or move money";
