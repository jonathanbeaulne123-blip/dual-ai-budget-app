/**
 * Plain words for the board model: amounts, statuses and kind labels. Kept here so the map panel (T4), the list
 * (`boardToList`) and the summary say exactly the same thing. No judgement words ("late", "failed", "behind").
 */
import { formatMonthLabel, weekdaySunday0, WEEKDAY_SHORT, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { formatCad } from "../../core/money.ts";
import type { AmountBasis, ChapterReviewStatus, CommitmentStop, Stop } from "../contracts.ts";

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
