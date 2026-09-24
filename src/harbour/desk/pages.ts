/**
 * The Desk's pages (SIMPLE_VIEW_DESK S2–S5). One entry per line, in chip
 * order: the id, the chip's word, its door-sign subtitle, and the page. A
 * later slice adds or replaces its own line and touches nothing else.
 *
 * Subtitles reuse the door-sign sentences (`nav/doorSigns.ts`) so a chip on
 * the Desk and a door in the Harbour say the same thing.
 */
import type { ComponentType } from "react";
import { placeSigns, shortDate } from "../nav/doorSigns.ts";
import { DeskAccounts } from "./DeskAccounts.tsx";
import { DeskLeaving } from "./DeskLeaving.tsx";
import { DeskToday } from "./DeskToday.tsx";
import type { DeskPageProps, DeskSignContext } from "./types.ts";
import { DeskCalendar } from "./DeskCalendar.tsx";
import { DeskBooks } from "./DeskBooks.tsx";

export type DeskPage = {
  id: string;
  chip: string;
  subtitle: (context: DeskSignContext) => string;
  Page: ComponentType<DeskPageProps>;
};

/** A door sign read tolerantly: a reading that has not arrived yet is a plain line, never a throw. */
function sign(place: "court" | "cellar" | "library", fallback: string) {
  return ({ reading }: DeskSignContext) => {
    if (!reading) return fallback;
    try { return placeSigns(reading)[place].line; } catch { return fallback; }
  };
}
const calendarSign = ({ reading }: DeskSignContext) => reading?.next ? `Next · ${reading.next.label} ${shortDate(reading.next.date)}` : "Nothing dated";

/**
 * The household reads the harbour's door signs; personal scope has no harbour
 * (and no Fund), so my folio's chips say what its own pages hold (S7).
 */
function scoped(household: (context: DeskSignContext) => string, personal: string) {
  return (context: DeskSignContext) => context.scope === "personal" ? personal : household(context);
}

export const DESK_PAGES: readonly DeskPage[] = [
  { id: "today", chip: "Today", subtitle: scoped(sign("court", "The Fund, this month"), "My folio, this month"), Page: DeskToday },
  { id: "leaving", chip: "Leaving", subtitle: scoped(sign("cellar", "What leaves next"), "What leaves next, from my Calendar"), Page: DeskLeaving },
  { id: "accounts", chip: "Accounts", subtitle: scoped(() => "Every account, as the books hold it", "My own accounts, as Personal Books hold them"), Page: DeskAccounts },
  { id: "calendar", chip: "Calendar", subtitle: scoped(calendarSign, "My days, this week and this month"), Page: DeskCalendar },
  { id: "books", chip: "Books", subtitle: scoped(sign("library", "The standing books"), "My books, as Personal Books keep them"), Page: DeskBooks },
];
