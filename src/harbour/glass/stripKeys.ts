/**
 * The strip's keyboard model (Tool Atlas §4.1 "The strip is one control",
 * A20). Pure: given the key, the day that holds focus and the ledger the band
 * is drawing, say what happens. One Tab stop; focus roves across the stones:
 *
 *   ← / →        a day            ⇧← / ⇧→   a week
 *   PgUp / PgDn  a month          Home      today       End  the month's last stone
 *   Enter        opens that day in the Calendar; on the Sitdown's flagstone, opens the Sitdown
 *
 * Moving past the band's first or last stone, or a month away, asks the band
 * for another month (never past the current one) and lands on the same day.
 */
import { addDays, daysInMonthKey, monthEndKey, monthKeyFromDateKey, shiftMonthKey, type DateKey, type MonthKey } from "../../core/calendar.ts";
import type { DayLedger } from "./dayLedger.ts";

export type StripKey = { key: string; shiftKey?: boolean };

export type StripMove =
  | { kind: "focus"; date: DateKey }
  | { kind: "month"; month: MonthKey; date: DateKey }
  | { kind: "open"; date: DateKey }
  | { kind: "sitdown"; date: DateKey };

/** The same day of the month in another month, clamped to its length. */
export function sameDayIn(month: MonthKey, date: DateKey): DateKey {
  const day = Math.min(Number(date.slice(8, 10)), daysInMonthKey(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

function moveTo(target: DateKey, ledger: DayLedger, currentMonth: MonthKey): StripMove | null {
  if (target >= ledger.from && target <= ledger.to) return { kind: "focus", date: target };
  const month = monthKeyFromDateKey(target);
  if (target < ledger.from) return { kind: "month", month, date: target };
  // Forward past the band: another month only up to the current one; otherwise stay on the last stone.
  if (month <= currentMonth && month !== ledger.monthKey) return { kind: "month", month, date: target };
  return { kind: "focus", date: ledger.to };
}

export function stripKey(event: StripKey, focused: DateKey, ledger: DayLedger): StripMove | null {
  const currentMonth = monthKeyFromDateKey(ledger.today);
  const step = event.shiftKey ? 7 : 1;
  switch (event.key) {
    case "ArrowLeft": return moveTo(addDays(focused, -step), ledger, currentMonth);
    case "ArrowRight": return moveTo(addDays(focused, step), ledger, currentMonth);
    case "PageUp": {
      const month = shiftMonthKey(ledger.monthKey, -1);
      return { kind: "month", month, date: sameDayIn(month, focused) };
    }
    case "PageDown": {
      if (ledger.monthKey >= currentMonth) return null;
      const month = shiftMonthKey(ledger.monthKey, 1);
      return { kind: "month", month, date: sameDayIn(month, focused) };
    }
    case "Home":
      return ledger.today >= ledger.from && ledger.today <= ledger.to
        ? { kind: "focus", date: ledger.today }
        : { kind: "month", month: currentMonth, date: ledger.today };
    case "End": return { kind: "focus", date: monthEndKey(ledger.monthKey) };
    case "Enter": {
      const day = ledger.days.find(row => row.date === focused);
      return day?.sitdown ? { kind: "sitdown", date: focused } : { kind: "open", date: focused };
    }
    default: return null;
  }
}
