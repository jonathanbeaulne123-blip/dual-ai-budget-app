/**
 * The Journey Map's own UI words (L4). Control names, hints and headings only: every word that states a STATUS or what
 * a figure means comes from model/words.ts (`statusText`, `amountText`, `MAP_WORDS`, ruling 10), so the map, the sheets
 * and the list can never say different things. No judgement words ("late", "failed", "behind", "winning").
 */
import type { ActionCall, CrossroadsPreview, DateKey, JourneyLevel } from "../contracts.ts";
import { mapMoney, openPlaceWords } from "../model/index.ts";

export const COPY = {
  boardLabel: "Journey",
  mapLabel: "Our island as a clock",
  /** The stage's name per level (UX #23): the clock is Month only. */
  mapLabels: { year: "The year as twelve islands", month: "Our island as a clock", week: "This week as a trail" } as Record<JourneyLevel, string>,
  mapHelp: "Left and right arrows move a day (a month in Year), Page Up and Page Down move a month, Home goes back to now, Enter opens what is on that day, Escape closes it.",
  listLabel: "Journey list",
  listKick: "List view · same data as the map",
  showMap: "Map",
  showList: "List",
  mapOrList: "View",
  prevMonth: "Previous month",
  nextMonth: "Next month",
  now: "now",
  earlier: "earlier",
  ahead: "ahead",
  theYear: "the year",
  open: "open",
  offline: "Offline · this device’s copy of the books",
  thisWeek: "This week",
  backToNow: "Back to now",
  about: "About this map",
  aboutBake: "Island drawn from the Horizon bake",
  aboutNotLoaded: "not drawn yet",
  aboutLimits: "What this map cannot show yet",
  aboutHeights: "Heights are lifted for the toy look; places sit at the bake’s own metres, north up.",
  theme: "Theme",
  close: "Close",
  enterHorizon: "Enter Horizon here",
  enterHorizonChip: "Enter Horizon",
  enterHorizonBusy: "Already on the way · Enter Horizon here waits until this passage ends",
  loadingMap: "Drawing the island… every stop and action is already in the list.",
  mapUnavailable: "The island could not be drawn on this device right now. The clock and the list still hold every stop and action.",
  emptyTitle: "Nothing is on the map yet",
  emptyBody: "When you record money, set up a bill or make a plan, it appears here on its day. Nothing is invented for you.",
  sheetNote: "Opening, zooming or turning the month never posts money. Only the labelled buttons do.",
  whichOne: "Which one?",
  thingsOnDay: (n: number) => `${n} things on this day`,
  thingsThisWeek: (n: number) => (n === 1 ? "1 thing this week" : `${n} things this week`),
  thisWeekShort: (n: number) => `${n} this week`,
  onTheMap: (n: number) => `${n} on the map`,
  today: "Today",
  herculesList: "Hercules’s list",
  add: "Add — record money",
  addLead: "Open",
  recordPurchase: "Record a purchase…",
  markPaid: "Mark paid…",
  recordIncome: "Record income…",
  chipCalendar: "Calendar",
  chipBooks: "Books",
  chipKitchen: "Kitchen table",
  chipSimple: "Simple view",
  chipAllTools: "All tools",
  pull: "Zoom: Year, Month or Week",
  key: "Key",
  keyTitle: "How to read the stacks",
  crossroads: "Crossroads",
  previewBanner: "Preview — nothing has changed",
  returnWithoutChanging: "Return without changing",
  previewPrefix: "Preview",
  currentChoice: "As things stand",
  noDifferences: "Nothing would change.",
  keptTraces: "Kept",
  chapterStops: "In this chapter",
  chapterNothing: "Nothing dated in this chapter.",
  clusterStops: "On this day",
  /** The bubble / pill chips beside "N to check" (counts only; the sheet says what each is). */
  waitingChip: (n: number) => `${n} waiting on you`,
  remindersChip: (n: number) => `${n} reminder${n === 1 ? "" : "s"}`,
  recordShift: "Record a shift…",
  moveMoney: "Move money…",
  /** A Year plate's second line for a month with nothing on the map (UI words; FIX-A may move them). */
  plateNothing: "nothing on the map",
} as const;

export const LEVEL_WORDS: Record<JourneyLevel, string> = { year: "Year", month: "Month", week: "Week" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function utc(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10) as DateKey;
export const addDays = (date: string, n: number): DateKey => iso(utc(date) + n * 86_400_000);
export const daysInMonth = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
/** "2026-09" + n months. */
export function shiftMonth(month: string, n: number): string {
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)) - 1 + n;
  return `${y + Math.floor(m / 12)}-${String((((m % 12) + 12) % 12) + 1).padStart(2, "0")}`;
}
export const firstDay = (month: string) => `${month}-01` as DateKey;
export const lastDay = (month: string) => `${month}-${String(daysInMonth(month)).padStart(2, "0")}` as DateKey;

/** "Tuesday 15 September 2026". */
export function longDate(date: DateKey): string {
  return `${WEEKDAYS[new Date(utc(date)).getUTCDay()]} ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}
/** "September" for "2026-09". */
export function monthName(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}
/** "Sep" for "2026-09". */
export function shortMonth(month: string): string {
  return MONTHS_SHORT[Number(month.slice(5, 7)) - 1] ?? month;
}
/** "September 2026". */
export function monthWords(month: string): string {
  return `${monthName(month)} ${month.slice(0, 4)}`;
}

/** The model's `mapMoney` (Hearth's grouped CAD): "$1,850.00". Presentation of an existing figure only. */
export function money(cents: number): string {
  return mapMoney(cents);
}

/** Words for a call when nothing else names it (an attention item without a stop). Ends in "…" when a Confirm follows. */
export function callWords(call: ActionCall): string {
  switch (call.name) {
    case "openRecord": return call.mode === "income" ? "Record income…" : call.mode === "bill" ? "Mark paid…" : "Record it…";
    case "openBillPaid": return "Mark paid…";
    case "openDueReview": return "Review…";
    case "openPlace": return openPlaceWords(call.target);
    case "openCampfire": return "Open the Campfire";
    case "openWeeklySitdown": return "Open the weekly Sitdown";
    case "openHomeBook": return "Open the HomeBook";
    case "openEraPlanner": return "Open the Era planner";
    case "openKitty": return "Open the Kitty Bank";
    case "openCalendar": return "Open the Calendar";
    case "openBooks": return call.ref.kind === "fund" ? "Open the Fund" : "Open the Books";
    case "enterHorizon": return COPY.enterHorizon;
    case "enterHorizonCentre": return COPY.enterHorizonChip;
    case "back": return "Back";
    case "openAllTools": return COPY.chipAllTools;
    case "chooseSimpleView": return COPY.chipSimple;
  }
}

const ERA_FIELD_WORDS: Record<"name" | "finishLine" | "by" | "home" | "finish" | "plans", string> = {
  name: "Name", finishLine: "Finish line", by: "By", home: "Home", finish: "Finish", plans: "Plans",
};

/** One line per difference, read from the model's existing-calculation preview only. */
export function previewLines(preview: CrossroadsPreview): string[] {
  switch (preview.kind) {
    case "era":
      return preview.changes.map((c) => `${ERA_FIELD_WORDS[c.field]}: ${c.before ?? "none"} → ${c.after ?? "none"}`);
    case "home": {
      const lines: string[] = [];
      for (const room of preview.roomsAdded) lines.push(`Adds ${room}`);
      for (const room of preview.roomsRemoved) lines.push(`Removes ${room}`);
      if (preview.lockedFamilies.length) lines.push(`Still locked: ${preview.lockedFamilies.join(", ")}`);
      return lines;
    }
    case "plan": {
      const amount = (cents: number | null) => (cents === null ? "unknown amount" : money(cents));
      return [
        ...preview.added.map((a) => `Adds ${a.label} · ${amount(a.amountCents)}`),
        ...preview.removed.map((r) => `Removes ${r.label} · ${amount(r.amountCents)}`),
        ...preview.changed.map((c) => `${c.label} · ${c.field}: ${c.before} → ${c.after}`),
      ];
    }
  }
}
