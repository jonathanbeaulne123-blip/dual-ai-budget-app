import type { BoardKind } from "../core/board.ts";
/** Stable meaning first; theme and ownership colour can never replace this label. */
export const CALENDAR_KINDS: Record<BoardKind, string> = {
  other: "○ Other",
  bill: "▣ Bill",
  subscription: "↻ Subscription",
  paycheck: "↓ Pay",
  detected: "? Suggested",
  "potential-expense": "◇ Planned cost",
  shift: "◷ Shift",
  "shift-envelope": "✉ Shift plan",
  google: "↗ Google event",
  claim: "↩ Owed",
  visit: "⌂ Visit",
  event: "○ Event",
  "work-pay": "↓ Pay",
  "work-tip": "↓ Tips",
  "work-tipout": "↑ Tip-out",
};
export const calendarKindLabel = (kind: string) =>
  CALENDAR_KINDS[kind as BoardKind] ?? "○ Event";
