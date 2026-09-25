/**
 * The dock's words, in one table (Tool Atlas §3.2, §3.5, §4.1). The strip,
 * the camp card and the Desk's Today read every sentence from here, so the
 * vocabulary fence has one place to look and the island and the Desk say the
 * same thing. Amounts are always written out (`engravedCents`: unknown is
 * "—", never "$0").
 */
import { monthKeyFromDateKey, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { engravedCents } from "../desk/engraved.ts";
import { dayMarkers, type LedgerDay } from "./dayLedger.ts";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const weekdayOf = (date: DateKey) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** "2026-09" → "September". */
export function monthWord(month: MonthKey): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

/** "2026-09-27" → "Saturday 27 September". */
export function longDay(date: DateKey): string {
  return `${WEEKDAYS[weekdayOf(date)]} ${Number(date.slice(8, 10))} ${monthWord(monthKeyFromDateKey(date))}`;
}

/** "2026-09-27" → "Sat 27". */
export function shortDay(date: DateKey): string {
  return `${SHORT_WEEKDAYS[weekdayOf(date)]} ${Number(date.slice(8, 10))}`;
}

/** "2026-10-03" → "Oct 3". */
export function monthDay(date: DateKey): string {
  return `${SHORT_MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

export const WORDS = Object.freeze({
  stripRegion: "Your month",
  cardRegion: "The camp card",
  whoseMoney: "Whose money",
  ours: "Ours",
  mine: "Mine",
  showing: (space: "ours" | "mine") => `Showing ${space === "ours" ? "Ours" : "Mine"}`,
  headingOurs: (month: MonthKey) => `Our month · ${monthWord(month)}`,
  headingMine: (month: MonthKey) => `My month · ${monthWord(month)}`,
  everydayNow: "Everyday · now",
  onTheClock: "On the clock",
  leavingNext: "Leaving next",
  thisWeek: (more: number) => `+${more} this week`,
  nothingLeaving: "Nothing dated this week",
  needsYou: "Needs you",
  sinceYouWereHere: "Since you were here",
  firstVisit: "Your month runs along the bottom. Drag to look around the island, and tap a place to open it.",
  firstVisitKeyboard: "Your month runs along the bottom. Drag to look around the island, and press + to look closer.",
  quiet: "Nothing needs you right now",
  openCard: "Open the full card",
  foldCard: "Fold the card down",
  pots: "Prepare · Protect · Build",
  seals: (month: string) => `${month} so far · posted`,
  sealsMine: (month: string) => `${month} so far · posted · mine`,
  herculesKicker: "Hercules",
  shiftTonight: "Shift tonight? Record it here.",
  herculesQuiet: "Nothing needs a nudge. He is curled up on the ledger.",
  talk: "Talk with Hercules",
  books: "Books",
  stepIn: "Step in",
  whatChanged: "What changed here",
  coveredTo: (date: DateKey) => `Covered to ${monthDay(date)}`,
  monthBack: (month: MonthKey) => `‹ ${monthWord(month)}`,
  monthForward: (month: MonthKey) => `${monthWord(month)} ›`,
  monthBackName: (month: MonthKey) => `${monthWord(month)}, one month back`,
  monthForwardName: (month: MonthKey) => `${monthWord(month)}, one month on`,
  stripName: (month: MonthKey) => `${monthWord(month)}, day by day. Enter opens a day in the Calendar.`,
  today: "Today",
  sinceAnnounce: (words: string) => `Since you were here: ${words}`,
  instruments: "My instruments",
  monthRunning: "How my month is running",
  streak: (count: number) => `Shift streak · ${count} ${count === 1 ? "shift" : "shifts"} in a row`,
  unknownFolio: "This folio could not be read on this device.",
});

/** One day's accessible name: its date, then every marker in words. */
export function dayName(day: LedgerDay): string {
  const parts: string[] = [];
  for (const kind of dayMarkers(day)) {
    if (kind === "sitdown") parts.push("the weekly Sitdown");
    if (kind === "slip") for (const slip of day.slips) parts.push(`${slip.name} bill, ${engravedCents(slip.amountCents)}, ${slip.overdue ? "due and not recorded" : "leaving"}`);
    if (kind === "pennant") for (const pennant of day.pennants) parts.push(pennant.amountCents === null ? `${pennant.name}, expected` : `${pennant.name}, ${engravedCents(pennant.amountCents)}, payday`);
    if (kind === "gate" && day.gate) parts.push(day.gate.state === "proposed" ? "a Chapter close waits for you" : day.gate.state === "overdue" ? "the Chapter is still open" : "the Chapter closes");
    if (kind === "coin") parts.push(`${day.coins.length} posted ${day.coins.length === 1 ? "entry" : "entries"}`);
  }
  const date = `${day.relation === "today" ? "Today, " : ""}${longDay(day.date)}`;
  return `${date}: ${parts.length ? parts.join("; ") : "nothing dated"}`;
}
