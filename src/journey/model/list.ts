/**
 * `boardToList(board)` — the readable list equivalent: the same stops, the same crossroads and the SAME actions as
 * the map panel (each row's `actions` is the stop's own array), in chronological order (never screen position).
 * Older months first (traces only), then each chapter: its dates in order, a cluster row with its stops beneath,
 * crossroads on their date; kept memories with no date close the list.
 *
 * `listView(household, board, scope)` (Horizon Clock) — the same stops grouped for one map level, with a summary
 * strip. Rows carry each stop's own `actions`, `direction` and `toCheck`.
 */
import { monthSummary, projectedExpenseEffect, projectedIncomeEffect } from "../../core/budget.ts";
import { monthEndKey, monthKeyFromDateKey, monthStartKey, shiftMonthKey, type DateKey } from "../../core/calendar.ts";
import { booksPresentationFloor } from "../../core/ledgerExperience.ts";
import type { Household } from "../../core/types.ts";
import {
  isFundStop, isToCheck, type Chapter, type Crossroads, type JourneyBoard, type ListGroup, type ListRow,
  type ListScope, type ListStrip, type ListView, type ListViewOf, type Stop,
} from "../contracts.ts";
import { directionOf, isRecorded, knownCents } from "./money.ts";
import { amountText, dayLabel, kindLabel, MAP_WORDS, monthLabel, needsYouLabel, pinnedLabel, statusText, weekTitle, yearTitle } from "./words.ts";

function chapterStatus(chapter: Chapter): string {
  const when = chapter.state === "open" ? "This month" : chapter.state === "past" ? "Past" : "Upcoming";
  const record = chapter.record.kind === "own" ? chapter.record.recordState === "open" ? "Chapter open" : "Chapter closed"
    : chapter.record.kind === "still-open" ? "An earlier Chapter is still open" : "No Chapter kept";
  const attention = chapter.unresolved.attention > 0 ? ` · ${chapter.unresolved.attention} need${chapter.unresolved.attention === 1 ? "s" : ""} attention` : "";
  return `${when} · ${record}${attention}`;
}

/** One stop as a row: the stop's own `actions` (the map's), its money direction and whether it is "to check". */
export function stopRow(stop: Stop, depth: 1 | 2, dated = true): ListRow {
  return {
    id: stop.id, level: "stop", chapterId: stop.chapterId, date: dated ? stop.date : null,
    kindLabel: kindLabel(stop), label: stop.label, amountText: amountText(stop), statusText: statusText(stop),
    actions: stop.actions, depth, direction: directionOf(stop), toCheck: isToCheck(stop),
  };
}

export function crossroadsRow(item: Crossroads): ListRow {
  const waiting = item.waitingOn.length ? "Waiting on agreement" : "An open choice";
  return {
    id: item.id, level: "crossroads", chapterId: item.chapterId, date: item.date, kindLabel: "Crossroads", label: item.label,
    amountText: "", statusText: `${waiting} · nothing changes until you confirm`,
    actions: [{ id: `${item.id}#confirm`, label: item.confirm.label, call: item.confirm.call, primary: true }],
    depth: 1, direction: "none", toCheck: false,
  };
}

/** A chapter older than the window: its traces, as one chapter row (no stops are recomputed there). */
export function olderChapterRow(older: JourneyBoard["olderChapters"][number]): ListRow {
  return {
    id: older.id, level: "chapter", chapterId: older.id, date: null, kindLabel: "Chapter", label: monthLabel(older.id), amountText: "",
    statusText: `Past · ${older.traces.length} kept trace${older.traces.length === 1 ? "" : "s"}${older.unresolved.chapterCloseDue ? " · Chapter still open" : ""}`,
    actions: [], depth: 0, direction: "none", toCheck: false,
  };
}

export function chapterRow(chapter: Chapter): ListRow {
  return {
    id: chapter.id, level: "chapter", chapterId: chapter.id, date: null, kindLabel: "Chapter",
    label: chapter.record.title ? `${chapter.label} · ${chapter.record.title}` : chapter.label,
    amountText: "", statusText: chapterStatus(chapter), actions: [], depth: 0, direction: "none", toCheck: false,
  };
}

export function boardToList(board: JourneyBoard): ListRow[] {
  const rows: ListRow[] = [];
  const stops = new Map(board.stops.map(stop => [stop.id, stop]));
  const clusters = new Map(board.clusters.map(cluster => [cluster.id, cluster]));
  for (const older of board.olderChapters) rows.push(olderChapterRow(older));
  for (const chapter of board.chapters) {
    rows.push(chapterRow(chapter));
    const crossroads = board.crossroads.filter(item => item.chapterId === chapter.id);
    for (const day of chapter.days) {
      const cluster = day.clusterId ? clusters.get(day.clusterId) : undefined;
      if (cluster) {
        rows.push({ id: cluster.id, level: "cluster", chapterId: chapter.id, date: cluster.date, kindLabel: "Several on one day", label: cluster.label, amountText: "", statusText: "", actions: [], depth: 1, direction: "none", toCheck: false });
        for (const id of cluster.stopIds) { const stop = stops.get(id); if (stop) rows.push(stopRow(stop, 2)); }
      } else {
        for (const id of day.stopIds) { const stop = stops.get(id); if (stop) rows.push(stopRow(stop, 1)); }
      }
      for (const item of crossroads) if (item.date === day.date) rows.push(crossroadsRow(item));
    }
  }
  for (const memory of board.undatedMemories) rows.push(stopRow(memory, 1, false));
  return rows;
}

// ---------------------------------------------------------------------------
// Horizon Clock: `listView(household, board, scope)` — the Map/List toggle's readable list for one scope.

/**
 * Books actuals between two dates (inclusive), from the Books' own pure selector. A whole month is read with
 * `monthSummary` itself; a part of a month (the Week runs Monday–Sunday and may straddle two months) uses the same
 * projection `monthSummary` uses — `projectedIncomeEffect` / `projectedExpenseEffect` over active categories, by the
 * category's own transaction type — so a part summed over a whole month equals `monthSummary` exactly (held by test).
 * Recorded money only. Transfers (a Fund move, a card paydown) are never income or spending here.
 */
export function booksActualsBetween(books: Household, from: DateKey, to: DateKey): { inCents: number; outCents: number } {
  let inCents = 0, outCents = 0;
  if (from > to) return { inCents, outCents };
  const byId = new Map(books.transactions.map(tx => [tx.id, tx]));
  const categories = new Map(books.categories.filter(row => row.recordType === "category" && row.active).map(row => [row.id, row]));
  for (let month = monthKeyFromDateKey(from); month <= monthKeyFromDateKey(to); month = shiftMonthKey(month, 1)) {
    const lo = monthStartKey(month) > from ? monthStartKey(month) : from;
    const hi = monthEndKey(month) < to ? monthEndKey(month) : to;
    if (lo === monthStartKey(month) && hi === monthEndKey(month)) {
      const summary = monthSummary(books, month);
      inCents += summary.incomeActualCents;
      outCents += summary.expenseActualCents;
      continue;
    }
    for (const tx of books.transactions) {
      if (tx.date < lo || tx.date > hi || !tx.subcategoryId) continue;
      const category = categories.get(tx.subcategoryId);
      if (!category) continue;
      if (category.transactionType === "expense") outCents += projectedExpenseEffect(tx, byId);
      else inCents += projectedIncomeEffect(tx, byId);
    }
  }
  return { inCents, outCents };
}

type ScopeRead = { stops: Stop[]; from: DateKey; to: DateKey; title: string };

function scopeRead(board: JourneyBoard, scope: ListScope): ScopeRead {
  if (scope.level === "week") {
    const pile = new Set(board.week.pileStopIds);
    return {
      stops: board.stops.filter(stop => pile.has(stop.id) || (stop.date >= board.week.from && stop.date <= board.week.to)),
      from: board.week.from, to: board.week.to, title: weekTitle(board.week.from, board.week.to),
    };
  }
  if (scope.level === "month") {
    return { stops: board.stops.filter(stop => stop.chapterId === scope.chapterId), from: monthStartKey(scope.chapterId), to: monthEndKey(scope.chapterId), title: monthLabel(scope.chapterId) };
  }
  return { stops: [...board.stops], from: monthStartKey(board.window.from), to: monthEndKey(board.window.to), title: yearTitle(board.window.from, board.window.to) };
}

/**
 * The strip (ruling 3): each figure separate, none a balance, none summed with another.
 * - In / Out: Books actuals for the scope's dates (`booksActualsBetween` over the Books' household view).
 * - To the Fund: recorded Fund contributions on the map in scope (ruling 4) — never part of In.
 * - Still to come: unrecorded stops from today on with a scheduled figure (commitments → out; non-Fund income → in);
 *   estimates apart; unknown amounts counted, never summed as 0.
 * - Needs you: the scope's "to check" stops.
 */
function stripFor(books: Household | null, read: ScopeRead, today: DateKey): ListStrip | null {
  if (!read.stops.length || !books) return null;
  const actuals = booksActualsBetween(books, read.from, read.to);
  const strip: ListStrip = {
    inBooksCents: actuals.inCents, outBooksCents: actuals.outCents, toFundCents: 0,
    stillToComeOutCents: 0, stillToComeInCents: 0, stillToComeEstimateCents: 0, stillToComeUnknown: 0, needsYou: 0,
  };
  for (const stop of read.stops) {
    if (isToCheck(stop)) strip.needsYou += 1;
    const direction = directionOf(stop);
    if (direction === "none") continue;
    const cents = knownCents(stop);
    if (isRecorded(stop)) {
      if (isFundStop(stop) && stop.date >= read.from && stop.date <= read.to && cents !== null) strip.toFundCents += cents;
      continue;
    }
    if (stop.date < today) continue;
    if (cents === null) { strip.stillToComeUnknown += 1; continue; }
    if (stop.amountBasis === "estimate") { strip.stillToComeEstimateCents += cents; continue; }
    if (stop.amountBasis !== "scheduled") continue;
    if (direction === "out") strip.stillToComeOutCents += cents;
    else if (!isFundStop(stop)) strip.stillToComeInCents += cents;
  }
  return strip;
}

function readBooks(household: Household, memberId: string): Household | null {
  if (!household.members.some(member => member.active && member.id === memberId)) return null;
  try { return booksPresentationFloor(household, memberId, "household"); } catch { return null; }
}

export const listView: ListViewOf = (household: Household, board: JourneyBoard, scope: ListScope): ListView => {
  const read = scopeRead(board, scope);
  const today = board.today;
  const need = read.stops.filter(isToCheck);
  const rest = read.stops.filter(stop => !isToCheck(stop));
  const crossroads = board.crossroads.filter(item => item.date >= read.from && item.date <= read.to);
  const groups: ListGroup[] = [];

  if (need.length) {
    const pinnedOnly = scope.level === "week" && need.every(stop => stop.date < board.week.from);
    groups.push({
      id: "needs-you", kind: "needs-you", date: null, today: false, emptyText: null,
      label: pinnedOnly ? pinnedLabel(need.length, board.week.from) : needsYouLabel(need.length),
      rows: need.map(stop => stopRow(stop, 1)),
    });
  }

  const dayGroup = (date: DateKey, onDay: Stop[]): ListGroup => {
    const rows = [...onDay.map(stop => stopRow(stop, 1)), ...crossroads.filter(item => item.date === date).map(crossroadsRow)];
    return { id: `day:${date}`, kind: "day", date, label: dayLabel(date, today), today: date === today, rows, emptyText: rows.length ? null : MAP_WORDS.nothingOnThisDay };
  };

  if (scope.level === "week") {
    for (const day of board.week.days) groups.push(dayGroup(day.date, rest.filter(stop => stop.date === day.date)));
  } else if (scope.level === "month") {
    const dates = [...new Set([...rest.map(stop => stop.date), ...crossroads.map(item => item.date)])].sort();
    for (const date of dates) groups.push(dayGroup(date, rest.filter(stop => stop.date === date)));
  } else {
    for (const older of board.olderChapters) {
      groups.push({ id: `chapter:${older.id}`, kind: "chapter", date: null, label: monthLabel(older.id), today: false, rows: [olderChapterRow(older)], emptyText: null });
    }
    for (const chapter of board.chapters) {
      const rows: ListRow[] = [];
      for (const stop of rest.filter(row => row.chapterId === chapter.id)) {
        for (const item of crossroads) if (item.chapterId === chapter.id && item.date < stop.date && !rows.some(row => row.id === item.id)) rows.push(crossroadsRow(item));
        rows.push(stopRow(stop, 1));
      }
      for (const item of crossroads) if (item.chapterId === chapter.id && !rows.some(row => row.id === item.id)) rows.push(crossroadsRow(item));
      groups.push({
        id: `chapter:${chapter.id}`, kind: "chapter", date: null, label: chapter.record.title ? `${chapter.label} · ${chapter.record.title}` : chapter.label,
        today: chapter.id === board.currentChapterId, rows, emptyText: rows.length ? null : MAP_WORDS.nothingOnTheMap,
      });
    }
    if (board.undatedMemories.length) {
      groups.push({ id: "undated", kind: "undated", date: null, label: MAP_WORDS.undated, today: false, rows: board.undatedMemories.map(memory => stopRow(memory, 1, false)), emptyText: null });
    }
  }

  const nothing = !read.stops.length && !crossroads.length && (scope.level !== "year" || !board.undatedMemories.length);
  return {
    scope: { ...scope },
    title: read.title,
    strip: stripFor(readBooks(household, board.memberId), read, today),
    groups,
    emptyText: nothing && scope.level !== "week" ? scope.level === "month" ? MAP_WORDS.emptyMonth : MAP_WORDS.emptyYear : null,
    limitations: [...board.limitations],
  };
};
