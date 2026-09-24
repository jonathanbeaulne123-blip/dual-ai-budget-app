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
import { deskComing } from "./DeskComing.tsx";
import { DeskLeaving } from "./DeskLeaving.tsx";
import { DeskToday } from "./DeskToday.tsx";
import type { DeskPageProps, DeskSignContext } from "./types.ts";

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

export const DESK_PAGES: readonly DeskPage[] = [
  { id: "today", chip: "Today", subtitle: sign("court", "The Fund, this month"), Page: DeskToday },
  { id: "leaving", chip: "Leaving", subtitle: sign("cellar", "What leaves next"), Page: DeskLeaving },
  { id: "accounts", chip: "Accounts", subtitle: () => "Every account, as the books hold it", Page: DeskAccounts },
  { id: "calendar", chip: "Calendar", subtitle: calendarSign, Page: deskComing("Calendar", { target: "calendar", words: "Unfold the Calendar" }) },
  { id: "books", chip: "Books", subtitle: sign("library", "The standing books"), Page: deskComing("Books", { target: "books", words: "Open the books" }) },
];
