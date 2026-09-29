/**
 * The Journey Board's UI words (T4). Plain, neutral, explicit: no judgement words ("late", "failed", "behind",
 * "winning"). Stop amounts and statuses come from the model's own words (`boardToList` rows: "Overdue · not
 * recorded", "Set aside in Prepare · not paid", "Expected · not recorded", "Fully backed · not bought"), so the map
 * panel and the list can never say different things; the words the UI itself adds live here.
 */
import type { ActionCall, CameraTier, Chapter, CrossroadsPreview, DateKey, StopKind } from "../contracts.ts";

export const COPY = {
  boardLabel: "Journey",
  mapLabel: "Journey map",
  mapHelp: "Arrow keys move a day (a month from the Sky), Page Up and Page Down move a month, Home goes back to now, plus and minus zoom, Enter opens what is on that day, Escape closes it.",
  listLabel: "Journey list",
  showMap: "Map",
  showList: "List",
  mapOrList: "Show the journey as",
  backToNow: "Back to now",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  enterHorizon: "Enter Horizon here",
  enterHorizonOverWater: "Move the view onto land to enter Horizon here",
  close: "Close",
  weAreHere: "We are here",
  loadingMap: "Drawing the island… everything is already in the list and the summary.",
  mapUnavailable: "The island map could not be drawn on this device right now. Every stop and action is in the list.",
  previewBanner: "Preview — nothing has changed",
  returnWithoutChanging: "Return without changing",
  previewPrefix: "Preview",
  currentChoice: "As things stand",
  noDifferences: "Nothing would change.",
  summaryWhere: "Where we are",
  summaryAttention: "Needs attention",
  summaryNext: "Coming next",
  summaryActions: "Do something now",
  summaryNothingNext: "Nothing dated is coming up.",
  summaryNoAttention: "Nothing needs attention.",
  everydayNow: "Everyday · now",
  everydayUnknown: "Everyday · the Fund cannot say right now",
  showSummary: "Show the summary",
  hideSummary: "Hide the summary",
  emptyTitle: "Nothing is on the journey yet",
  emptyBody: "When you record money, set up a bill or make a plan, it appears here on its day. Nothing is invented for you.",
  pieceTitle: "Our piece",
  pieceLookLegend: "How our piece looks on this device",
  pieceLookNote: "Saved on this device only.",
  clusterStops: "On this day",
  backToCluster: "Back to this day",
  chapterStops: "In this chapter",
  chapterNothing: "Nothing dated in this chapter.",
  limitationsTitle: "What this board cannot show yet",
  undatedMemories: "Kept memories with no date",
  olderChapters: "Earlier chapters",
  listOpenMonth: "This month",
  keptTraces: "Kept",
  /** Said when "Enter Horizon here" is pressed while a cloud passage is already under way (nothing happens). */
  enterHorizonBusy: "Already on the way · Enter Horizon here waits until this passage ends",
} as const;

/** The App's due reminders as the first "Needs attention" item (review B1). */
export function dueReviewWords(count: number): string {
  return `Repeating reminders · ${count} to review`;
}

export const PIECE_LOOK_WORDS: Record<"lantern" | "cat" | "boat" | "kettle", string> = {
  lantern: "Lantern",
  cat: "Cat",
  boat: "Little boat",
  kettle: "Kettle",
};

export const TIER_WORDS: Record<CameraTier, string> = { sky: "the whole island", region: "this stretch", stop: "a few days" };

export const CHAPTER_STATE_WORDS: Record<Chapter["state"], string> = { past: "Past", open: "Now", upcoming: "Ahead" };

export const KIND_WORDS: Record<StopKind, string> = {
  income: "Income", commitment: "Bill", review: "Review", plan: "Plan", milestone: "Milestone", memory: "Memory",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function weekday(date: DateKey): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "Tuesday 15 September 2026". */
export function longDate(date: DateKey): string {
  return `${WEEKDAYS[weekday(date)]} ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}
/** "Tue 15 Sep". */
export function shortDate(date: DateKey): string {
  return `${WEEKDAYS[weekday(date)]!.slice(0, 3)} ${Number(date.slice(8, 10))} ${MONTHS_SHORT[Number(date.slice(5, 7)) - 1]}`;
}
/** "Sep" for "2026-09". */
export function shortMonth(month: string): string {
  return MONTHS_SHORT[Number(month.slice(5, 7)) - 1] ?? month;
}
/** "September 2026". */
export function monthWords(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(0, 4)}`;
}

/** Same shape as the model's amounts (`formatCad`): "$1850.00". Presentation of an existing figure only. */
export function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Words for a call when nothing else names it (an attention item without a stop). Ends in "…" when a Confirm follows. */
export function callWords(call: ActionCall): string {
  switch (call.name) {
    case "openRecord": return call.mode === "income" ? "Record income…" : call.mode === "bill" ? "Bill paid…" : "Record it…";
    case "openBillPaid": return "Mark paid…";
    case "openDueReview": return "Review…";
    case "openPlace": return "Open it";
    case "openCampfire": return "Open the Campfire";
    case "openWeeklySitdown": return "Open the weekly Sitdown";
    case "openHomeBook": return "Open the HomeBook";
    case "openEraPlanner": return "Open the Era planner";
    case "openKitty": return "Open the Kitty Bank";
    case "openCalendar": return "Open the Calendar";
    case "openBooks": return call.ref.kind === "fund" ? "Open the Fund" : "Open the Books";
    case "enterHorizon": return COPY.enterHorizon;
    case "back": return "Back";
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

export function attentionCount(n: number): string {
  return n === 0 ? COPY.summaryNoAttention : `${n} need${n === 1 ? "s" : ""} attention`;
}
