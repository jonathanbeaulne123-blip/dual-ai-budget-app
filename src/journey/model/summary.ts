/**
 * Where we are · what needs attention · what is next. From existing selectors
 * only: the camp card (`campCardModel`: Everyday · now, "Leaving next") read over the same day ledger the board
 * used, `readNeeds` (what waits on this reader), plus the board's own overdue / needs-review commitments and a
 * close-due Chapter. Direct access (Record, Calendar, Books, Plan) never depends on the map.
 */
import { addDays, monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import { campCardModel, readNeeds } from "../../harbour/glass/campCardModel.ts";
import { stripRange, type DayLedger } from "../../harbour/glass/dayLedger.ts";
import type { AttentionItem, ChapterId, Stop, StopAction } from "../contracts.ts";

/**
 * The model's own reading of where we are · what needs attention · what is next (internal: the board carries it as
 * `purse`, `digest` and `toCheck`; the route board's summary card that showed it whole was retired with it).
 */
export type BoardSummary = {
  chapterId: ChapterId;
  periodLabel: string;
  /** Everyday · now (`readSnapshot(...).now` via campCardModel); null when the Fund cannot say. */
  everyday: { cents: number | null; figure: string } | null;
  leavingWords: string;
  /** readNeeds + overdue/needs-review commitments + close-due chapter, most pressing first. */
  attention: AttentionItem[];
  /** Up to three next items from today on (stop ids), in date order. */
  next: string[];
  quickActions: StopAction[];
};
import { action } from "./stopKit.ts";
import { monthLabel, shortDate } from "./words.ts";
import type { DeriveContext } from "./window.ts";

/** The strip's own ledger for today's month (`stripRange`: the month, plus the coming week), from the day ledger's days. */
function stripSlice(ctx: DeriveContext): DayLedger | null {
  if (!ctx.viewerActive || !ctx.monthSet.has(ctx.current)) return null;
  const range = stripRange(ctx.current, ctx.today);
  const days = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) { const day = ctx.days.get(date); if (day) days.push(day); }
  return {
    space: "ours", today: ctx.today, monthKey: ctx.current, from: range.from, to: range.to, days,
    weekFrom: ctx.today, weekTo: addDays(ctx.today, 6), coveredTo: null, chapterClose: null, sitdownWeekday: ctx.sitdownWeekday,
  };
}

export function quickActions(ctx: DeriveContext, setup: boolean): StopAction[] {
  const id = "quick";
  if (setup) return [
    action(id, "books", "Set up our accounts in the Books", { name: "openBooks", ref: { kind: "register" } }, true),
    action(id, "plan", "Make our first plan", { name: "openPlace", target: "plan-studio" }),
    action(id, "calendar", "Open the Calendar", { name: "openCalendar", date: ctx.today }),
  ];
  return [
    action(id, "expense", "Record a purchase…", { name: "openRecord", mode: "expense" }, true),
    action(id, "bill", "Bill paid…", { name: "openRecord", mode: "bill" }),
    action(id, "income", "Record income…", { name: "openRecord", mode: "income" }),
    action(id, "calendar", "Open the Calendar", { name: "openCalendar", date: ctx.today }),
    action(id, "books", "Open the Books", { name: "openBooks", ref: { kind: "register" } }),
    action(id, "plan", "Open the kitchen table", { name: "openPlace", target: "plan-studio" }),
  ];
}

const primaryCall = (stop: Stop) => (stop.actions.find(row => row.primary) ?? stop.actions[0])?.call ?? null;

/** Stops still asking for something, from today on (a paid bill, a kept memory or a granted milestone is not "next"). */
export function unresolved(stop: Stop): boolean {
  switch (stop.kind) {
    case "commitment": return stop.status !== "paid";
    case "income": return stop.status === "expected";
    case "review": return stop.reviewKind === "weekly-sitdown" || (stop.status !== "closed" && stop.status !== "no-chapter");
    case "plan": return stop.planKind === "goal" ? stop.status !== "bought" : stop.status === "open";
    case "milestone": return stop.status === "ready-to-record";
    case "memory": return false;
  }
}

export function boardSummary(ctx: DeriveContext, stops: Stop[], setup: boolean): BoardSummary {
  let everyday: BoardSummary["everyday"] = null;
  let leavingWords = "Leaving next · nothing on the Calendar";
  const ledger = stripSlice(ctx);
  if (ledger && ctx.viewerActive) {
    try {
      const card = campCardModel({ household: ctx.household, memberId: ctx.memberId, space: "ours", today: ctx.today, ledger });
      everyday = card.everyday;
      leavingWords = card.leaving.words;
    } catch { /* the card cannot say; the board still can */ }
  }

  const attention: AttentionItem[] = [];
  const chapterItems = stops.filter(stop => stop.kind === "review" && stop.reviewKind === "chapter-close"
    && (stop.status === "close-due" || stop.status === "waiting-on-you" || (stop.status === "waiting-on-partner" && stop.chapterId < ctx.current)));
  for (const stop of chapterItems) {
    const call = primaryCall(stop);
    if (call) attention.push({ id: `attention:${stop.id}`, words: `${monthLabel(stop.chapterId)}’s Chapter, at the Campfire`, stopId: stop.id, call });
  }
  const commitments = stops.filter(stop => stop.kind === "commitment" && (stop.status === "needs-review" || stop.status === "overdue"))
    .sort((a, b) => (a.kind === "commitment" && a.status === "needs-review" ? 0 : 1) - (b.kind === "commitment" && b.status === "needs-review" ? 0 : 1) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const stop of commitments) {
    const call = primaryCall(stop);
    if (!call || stop.kind !== "commitment") continue;
    const words = stop.status === "needs-review" ? `${stop.label} · ${shortDate(stop.date)} · payment status needs review` : `${stop.label} · ${shortDate(stop.date)} · overdue, not recorded`;
    attention.push({ id: `attention:${stop.id}`, words, stopId: stop.id, call });
  }
  if (ctx.viewerActive) {
    let needs: ReturnType<typeof readNeeds>["items"] = [];
    try { needs = readNeeds({ household: ctx.household, memberId: ctx.memberId, today: ctx.today, space: "ours" }).items; } catch { needs = []; }
    for (const item of needs) {
      // The Campfire's own "the Chapter" line is the close-due stop above; say it once.
      if (item.source === "sitdown" && chapterItems.length) continue;
      attention.push({ id: `need:${item.id}`, words: item.words, stopId: null, call: { name: "openPlace", target: item.door.target, ...(item.door.object ? { object: item.door.object } : {}) } });
    }
  }

  const next = stops.filter(stop => stop.date >= ctx.today && unresolved(stop)).slice(0, 3).map(stop => stop.id);
  return {
    chapterId: monthKeyFromDateKey(ctx.today as DateKey), periodLabel: monthLabel(ctx.current),
    everyday, leavingWords, attention, next, quickActions: quickActions(ctx, setup),
  };
}
