import type { DateKey } from "../../core/calendar.ts";
import type { ActionCall, Stop, StopAction } from "../contracts.ts";

/** `<stopId>#<verb>`: stable within its stop, so the panel and the list key the same control. */
export function action(stopId: string, verb: string, label: string, call: ActionCall, primary = false): StopAction {
  return { id: `${stopId}#${verb}`, label, call, ...(primary ? { primary: true } : {}) };
}

export function relationOf(date: DateKey, today: DateKey): Stop["relation"] {
  return date < today ? "past" : date === today ? "today" : "future";
}

/**
 * Board order on one date: needs attention (overdue / needs review) → other commitments → income → review → plan →
 * milestone → memory, then by id. The same order sorts `board.stops` within a date and every cluster.
 */
export function stopRank(stop: Stop): number {
  switch (stop.kind) {
    case "commitment": return stop.status === "overdue" || stop.status === "needs-review" ? 0 : 1;
    case "income": return 2;
    case "review": return 3;
    case "plan": return 4;
    case "milestone": return 5;
    case "memory": return 6;
  }
}

export function compareStops(a: Stop, b: Stop): number {
  return a.date.localeCompare(b.date) || stopRank(a) - stopRank(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
