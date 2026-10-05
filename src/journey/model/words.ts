/**
 * Plain words for the board model: amounts, statuses and kind labels. Kept here so the map panel (T4), the list
 * (`boardToList`) and the summary say exactly the same thing. No judgement words ("late", "failed", "behind").
 */
import { formatMonthLabel, weekdaySunday0, WEEKDAY_SHORT, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { formatCadGrouped as formatCad } from "../../core/money.ts";
import { ringsFor, STACK_RULER, type AmountBasis, type Chapter, type ChapterReviewStatus, type CommitmentStop, type JourneyLevel, type Stop } from "../contracts.ts";

export const monthLabel = (month: MonthKey): string => formatMonthLabel(month);
/** "Tue 15 Sep". */
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export function shortDate(date: DateKey): string {
  return `${WEEKDAY_SHORT[weekdaySunday0(date)]} ${Number(date.slice(8, 10))} ${MONTH_SHORT[Number(date.slice(5, 7)) - 1] ?? ""}`.trim();
}

const BASIS_WORDS: Record<Exclude<AmountBasis, "unknown">, string> = {
  scheduled: "scheduled",
  estimate: "estimate",
  recorded: "recorded",
  target: "target",
};

/** "$142.00 · scheduled", "Unknown amount", "" when the stop has no amount by nature. */
export function amountText(stop: Stop): string {
  if (stop.kind === "plan" && stop.planKind === "goal") return `${formatCad(Math.max(0, stop.savedCents))} of ${formatCad(stop.targetCents)} · target`;
  if (stop.kind === "memory" && stop.hideAmounts) return "";
  if (stop.amountCents === undefined) return "";
  if (stop.amountCents === null || stop.amountBasis === "unknown" || stop.amountBasis === undefined) return "Unknown amount";
  return `${formatCad(stop.amountCents)} · ${BASIS_WORDS[stop.amountBasis]}`;
}

function setAsideWords(stop: CommitmentStop): string | null {
  if (stop.setAside === "prepare") return "Set aside in Prepare · not paid";
  if (stop.setAside === "build") return "Set aside in Build · not paid";
  return null;
}

const CHAPTER_REVIEW_WORDS: Record<ChapterReviewStatus, string> = {
  upcoming: "Later · nothing to do yet",
  open: "Open · closes at the Campfire when we choose",
  "close-due": "Close due · the Chapter is still open",
  "waiting-on-you": "A close is waiting on you",
  "waiting-on-partner": "A close is waiting on your partner",
  closed: "Closed at a Sitdown",
  "no-chapter": "No Chapter kept this month",
};

/** How many posted transactions a stop stands for (more than one = a duplicate for the Books to settle). */
export function postingCount(stop: Stop): number {
  return stop.sourceRefs.filter(ref => ref.kind === "transaction").length;
}

/** The status line: always separates expected from confirmed, due from paid, set aside from paid. */
export function statusText(stop: Stop): string {
  const postings = postingCount(stop);
  switch (stop.kind) {
    case "commitment": {
      if (stop.status === "paid") return postings > 1 ? `Paid · ${postings} postings · review in the Books` : `Paid · recorded ${shortDate(stop.date)}`;
      if (stop.status === "needs-review") return "Payment status needs review · not counted as paid";
      if (stop.status === "overdue") return "Overdue · not recorded";
      const aside = setAsideWords(stop);
      if (stop.status === "due-today") return aside ? `Due today · ${aside}` : "Due today · not recorded";
      return aside ?? "Upcoming · not recorded";
    }
    case "income":
      if (stop.status === "confirmed") return postings > 1 ? `Received · ${postings} postings · review in the Books` : `Received · recorded ${shortDate(stop.date)}`;
      if (stop.origin === "fund-estimate") return "Estimate · not recorded";
      return stop.relation === "past" ? "Expected · not recorded" : "Expected";
    case "review":
      if (stop.reviewKind === "weekly-sitdown") return stop.status === "session-open" ? "Sitdown started · not finished" : "Weekly Sitdown";
      return CHAPTER_REVIEW_WORDS[stop.status];
    case "plan":
      if (stop.planKind === "goal") {
        if (stop.status === "bought") return "Bought · purchase recorded";
        if (stop.status === "fully-backed") return "Fully backed · not bought";
        return stop.relation === "past" ? `Backing ${stop.step * 10}% · arrival date passed` : `Backing ${stop.step * 10}%`;
      }
      return stop.status === "done" ? "Done · a planning step, not a memory" : "Open step";
    case "milestone":
      return stop.status === "granted" ? "Unlocked" : "Ready · recorded the next time you save your home";
    case "memory":
      return "Kept by everyone";
  }
}

export function kindLabel(stop: Stop): string {
  switch (stop.kind) {
    case "commitment": return stop.boardKind === "visit" ? "Visit" : stop.boardKind === "potential-expense" ? "Planned expense" : "Bill";
    case "income": return stop.status === "confirmed" ? "Income · confirmed" : stop.origin === "fund-estimate" ? "Income · estimate" : "Income · expected";
    case "review": return stop.reviewKind === "weekly-sitdown" ? "Review · weekly" : "Review · Chapter";
    case "plan": return stop.planKind === "goal" ? "Plan · goal" : "Plan · step";
    case "milestone": return "Milestone";
    case "memory": return "Memory";
  }
}

// ---------------------------------------------------------------------------
// Horizon Clock (the Journey Map) words. Every map / list / sheet string that states a status or a figure's meaning
// comes from here (ruling 10). Each one is held to the data it describes in test/journey-map-model.test.ts.

/** "Mon 28 Sep – Sun 4 Oct". */
export function dateRangeLabel(from: DateKey, to: DateKey): string {
  return `${shortDate(from)} – ${shortDate(to)}`;
}
/** A day heading: "Today · Mon 28 Sep" or "Tue 29 Sep". */
export function dayLabel(date: DateKey, today: DateKey): string {
  return date === today ? `Today · ${shortDate(date)}` : shortDate(date);
}
/** "This week · Mon 28 Sep – Sun 4 Oct". */
export function weekTitle(from: DateKey, to: DateKey): string {
  return `This week · ${dateRangeLabel(from, to)}`;
}
/** "January 2026 – December 2026". */
export function yearTitle(from: MonthKey, to: MonthKey): string {
  return `${monthLabel(from)} – ${monthLabel(to)}`;
}
/** "Needs you · 8". */
export function needsYouLabel(count: number): string {
  return `Needs you · ${count}`;
}
/** The Week pile's heading: "Needs you · 5 pinned to Mon". Pinned is not paid. */
export function pinnedLabel(count: number, monday: DateKey): string {
  return `Needs you · ${count} pinned to ${WEEKDAY_SHORT[weekdaySunday0(monday)]}`;
}

export const MAP_WORDS = {
  /** A Week / list day with no stops. */
  nothingOnThisDay: "Nothing on this day.",
  /** A month with no stops on the map (posted shift earnings or purchases may still be in the Books). */
  emptyMonth: "Nothing on the map this month. Anything recorded is in the Books.",
  /** A Year chapter with no stops on the map. */
  nothingOnTheMap: "Nothing on the map this month.",
  /** The whole window has no stops. */
  emptyYear: "Nothing on the map yet. Bills, pay and plans appear here once they are kept.",
  /** The undated group: kept memories with no date (never placed on a guessed day). */
  undated: "Kept, no date",
  /** ListStrip labels. "In the Books" / "Out in the Books" are recorded money only (Books actuals). */
  strip: {
    inBooks: "In · in the Books",
    outBooks: "Out · in the Books",
    toFund: "To the Fund · recorded",
    stillToCome: "Still to come · not recorded",
    stillToComeIn: "expected in",
    /** Every "estimate" stop on the map today is an expected Fund contribution (the Fund's lower-median estimate). */
    stillToComeEstimate: "Fund estimate · not recorded",
    stillToComeUnknown: (count: number) => `${count} with no amount yet`,
    needsYou: "Needs you",
  },
  /** The purse chip. Expected pay is printed beside Everyday, never added to it. */
  purse: {
    everyday: "Everyday · now",
    everydayUnknown: "Everyday · the Fund can’t say right now",
    notCounted: "expected pay isn’t counted until it’s in",
    /** Trust M3: the schedule's date is today and nothing is recorded for it — not a claim that the money has not arrived. */
    expectedToday: (label: string) => `${label} expected today · not recorded on its schedule`,
    /** Trust M3: a confirmed (non-Fund) pay already stands on the same day. Printed with the line; nothing is de-duplicated. */
    alreadyRecorded: "A pay is already recorded today · check the Books before recording this one",
  },
  /** The purse's gloss under Everyday: what the figure is (the Fund's "now"), not a balance of everything. */
  purseGloss: "money here now",
  /** The next commitment is a standing move into a Build jar (`digest.nextIsSettingAside`): set aside, not leaving. */
  settingAsideNext: "Setting aside next",
  /** The next commitment leaves (a bill, a planned cost). */
  leavingNext: "Leaving next",
  /** The Year view's standing caption (ruling 5; Year ruler $1,000 a ring). */
  yearCaption: "Each stack = bills on the map that month · ring = $1,000 · not all spending",
  /** The Key at a level drawn flat (no stacks): how the marks read instead. */
  flatKey: "No stacks in this view: solid = recorded, dashed = not recorded, mint in, gold out",
  /** The Key's lines (moved from ui/copy.ts, trust minor 3). */
  key: {
    height: "Height is the amount.",
    mintGold: "Mint = coming in · Gold = going out.",
    mintGoldMore: "Income stands on the island side of the ring, bills on the sea side.",
    honey: "Honey ring with “!” — needs you: overdue and not recorded, or a payment whose status needs review. Neither is counted as paid.",
  },
  /** The map legend's samples (moved from ui/copy.ts). `inExpected` = an expected income sample (trust minor 5). */
  legend: {
    recorded: "recorded",
    needsYou: "needs you",
    expected: "expected / plan",
    in: "coming in",
    inExpected: "coming in · not recorded",
  },
  /** The App's repeating reminders: their own section and count, never folded into "to check" (moved from ui/copy.ts). */
  reminders: {
    count: (n: number) => `${n} repeating reminder${n === 1 ? "" : "s"} to review`,
    sub: "A separate list · reviewing it records nothing",
  },
  /** The Year ring's legend (ruling 5). */
  yearLegend: "bills and planned costs on the map, not all spending",
  /** Stack labels: solid = recorded, see-through = not recorded. Never colour alone. */
  stack: { solid: "recorded", seeThrough: "not recorded", unknown: "Unknown amount" },
  /** Hercules's checklist. */
  checklist: {
    thisWeek: "This week",
    toCheck: "To check",
    toCheckNote: "Overdue, or the payment needs review · not counted as paid.",
    pinnedNote: "Outside this week: overdue, or a payment that needs review. None of them is counted as paid.",
    /** The checklist sheet's title (moved from ui/copy.ts). */
    title: (toCheck: number) => (toCheck ? `This week, then ${toCheck} to check` : "This week"),
    waitingOnYou: "Waiting on you",
    chapter: "Chapter",
    reminders: "Repeating reminders",
    looking: "Looking through this list doesn’t post anything.",
  },
  /** "8 to check". */
  toCheckCount: (count: number) => `${count} to check`,
  /**
   * A chapter's needs, each its own words (trust minor 4): "5 to check · Chapter close due", "5 to check",
   * "Chapter close due", or "" when nothing waits. The two are never added into one number.
   */
  chapterNeeds: (toCheck: number, closeDue: boolean) => [toCheck ? `${toCheck} to check` : "", closeDue ? "Chapter close due" : ""].filter(Boolean).join(" · "),
} as const;

/**
 * A figure with its direction from its own sign (trust minor 2): "+$2,100.00", "−$12.00" (U+2212), "$0.00" for zero.
 * The sign is read from the value, never from what kind of row prints it.
 */
/** Every unsigned figure on the map (purse, plates, Key, list strip, sheets): Hearth's grouped CAD, "$4,716.80". */
export function mapMoney(cents: number): string {
  return formatCad(cents);
}

export function signedMoney(cents: number): string {
  if (!Number.isFinite(cents) || cents === 0) return formatCad(0);
  return `${cents < 0 ? "−" : "+"}${formatCad(Math.abs(cents))}`;
}

/** The house places a stop or a need opens, by name: "Open the kitchen table", never "Open it". */
const PLACE_NAMES: Record<string, string> = {
  "plan-studio": "the kitchen table", "cellar-bills": "the bill jars", planner: "the planner", memories: "our memories",
  "loft-banks": "the Kitty Bank", calendar: "the Calendar", books: "the Books", queen: "the Fund", shift: "Shifts",
};
/** "Open the kitchen table" for `openPlace("plan-studio")`; an unknown target still names itself. */
export function openPlaceWords(target: string): string {
  return `Open ${PLACE_NAMES[target] ?? `the ${target.replace(/[-_/]+/g, " ").trim()}`}`;
}

/**
 * A chapter row's status (moved from list.ts, trust minor 3): when · its Chapter record · its needs, each in its own
 * words ("This month · Chapter open · 5 to check · Chapter close due"). "to check" counts `isToCheck` stops only.
 */
export function chapterStatusText(chapter: Chapter): string {
  const when = chapter.state === "open" ? "This month" : chapter.state === "past" ? "Past" : "Upcoming";
  const record = chapter.record.kind === "own" ? chapter.record.recordState === "open" ? "Chapter open" : "Chapter closed"
    : chapter.record.kind === "still-open" ? "An earlier Chapter is still open" : "No Chapter kept";
  const u = chapter.unresolved;
  const needs = MAP_WORDS.chapterNeeds(u.overdueCommitments + u.commitmentsNeedingReview, u.chapterCloseDue === 1);
  return `${when} · ${record}${needs ? ` · ${needs}` : ""}`;
}

/** Where a stop's coin stack stands on the level's ruler (moved from ui/StopPanel.tsx; null amount → no stack, said in words). */
export function rulerWords(stop: Stop, level: JourneyLevel): string | null {
  const direction = stop.kind === "income" ? "in" : stop.kind === "commitment" ? "out" : "none";
  if (direction === "none") return null;
  const known = stop.amountCents === null || stop.amountCents === undefined || stop.amountBasis === "unknown" || stop.amountBasis === undefined ? null : stop.amountCents;
  const rings = ringsFor(known, level);
  const side = direction === "in" ? "mint, coming in" : "gold, going out";
  if (!rings) return `On the ruler: ${side} · ${MAP_WORDS.stack.unknown} · no stack.`;
  const recorded = (stop.kind === "commitment" && stop.status === "paid") || (stop.kind === "income" && stop.status === "confirmed");
  const tall = rings.rings < 0.2 ? "a single thin coin" : `${rings.drawnRings.toFixed(1)} rings tall${rings.capped ? " (capped, the figure is printed)" : ""}`;
  return `On the ruler: ${side} · ${tall} (${formatCad(STACK_RULER[level].centsPerRing)} a ring) · ${recorded ? `solid — ${MAP_WORDS.stack.solid}` : `see-through — ${MAP_WORDS.stack.seeThrough}`}.`;
}
