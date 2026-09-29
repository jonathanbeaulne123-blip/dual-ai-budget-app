/**
 * Review stops: the Chapter close (at the month's station, `review:<month>`) and the Charter's weekly Sitdown for
 * the open month only (`review:week:<weekStart>`). Arriving at one completes nothing: every action opens the real
 * Campfire / Sitdown, which keeps its own Confirm. Past weeks are not stops: Hearth keeps no "held" record for them.
 */
import { monthEndKey, monthKeyFromDateKey, weekBounds, type MonthKey } from "../../core/calendar.ts";
import { chapterMonth, chapterMonths, openChapterFor, pendingChapterClosure, type Chapter as ChapterRecord } from "../../core/chapters.ts";
import { weeklySession } from "../../campfire/model.ts";
import { journeyIds, stationForMonth, type ChapterReviewStatus, type ReviewStop, type StopAction } from "../contracts.ts";
import { action, relationOf } from "./stopKit.ts";
import { monthLabel } from "./words.ts";
import type { DeriveContext } from "./window.ts";

export type ChapterRecordRow = { month: MonthKey; record: ChapterRecord | null; kind: "own" | "still-open" | "none" };

/** `chapterMonths` over the window, with each row's record. */
export function readChapterRows(ctx: DeriveContext): ChapterRecordRow[] {
  const records = new Map((ctx.household.chapters ?? []).map(row => [row.id, row]));
  let rows: ReturnType<typeof chapterMonths> = [];
  try { rows = chapterMonths(ctx.household, ctx.months[0]!, ctx.months.at(-1)!); } catch { rows = []; }
  const byMonth = new Map(rows.map(row => [row.month, row]));
  return ctx.months.map(month => {
    const row = byMonth.get(month);
    const record = row?.chapterId ? records.get(row.chapterId) ?? null : null;
    return { month, record, kind: record ? row!.kind : "none" };
  });
}

/** The status of a month's own Chapter record against today. */
export function chapterReviewStatus(ctx: DeriveContext, month: MonthKey, record: ChapterRecord): ChapterReviewStatus {
  if (record.state !== "open") return "closed";
  const pending = pendingChapterClosure(record);
  if (pending) return pending.approvals.some(row => row.memberId === ctx.memberId) ? "waiting-on-partner" : "waiting-on-you";
  if (month < ctx.current) return "close-due";
  return month === ctx.current ? "open" : "upcoming";
}

function chapterActions(id: string, status: ChapterReviewStatus, month: MonthKey): StopAction[] {
  if (status === "closed") return [action(id, "books", `Read ${monthLabel(month)} in the Books`, { name: "openBooks", ref: { kind: "month", monthKey: month } }, true)];
  if (status === "upcoming") return [action(id, "calendar", "Open the Calendar", { name: "openCalendar", date: monthEndKey(month) }, true)];
  return [
    action(id, "campfire", "Open the Campfire", { name: "openCampfire", chapterId: month }, true),
    action(id, "books", `Read ${monthLabel(month)} in the Books`, { name: "openBooks", ref: { kind: "month", monthKey: month } }),
  ];
}

export function reviewStops(ctx: DeriveContext, rows: ChapterRecordRow[]): ReviewStop[] {
  const out: ReviewStop[] = [];
  for (const row of rows) {
    // Only a month's OWN Chapter has a close; a month an earlier Chapter still spans shows that on its chapter record.
    if (row.kind !== "own" || !row.record) continue;
    const status = chapterReviewStatus(ctx, row.month, row.record);
    const id = journeyIds.review(row.month), date = monthEndKey(row.month);
    out.push({
      kind: "review", id, date, chapterId: row.month, label: `${monthLabel(row.month)} · ${row.record.title}`,
      placeRef: { kind: "station", id: stationForMonth(row.month) },
      sourceRefs: [{ kind: "chapter", id: row.record.id }],
      major: true, relation: relationOf(date, ctx.today), actions: chapterActions(id, status, row.month),
      reviewKind: "chapter-close", status, chapterRecordId: row.record.id,
    });
  }
  // The weekly Sitdown: the open month's sitdown days only (shared space; the Charter's cadence).
  for (const day of ctx.days.values()) {
    if (!day.sitdown || monthKeyFromDateKey(day.date) !== ctx.current) continue;
    const weekStart = weekBounds(day.date).start;
    const id = journeyIds.weeklyReview(weekStart);
    let open = false;
    try { open = weeklySession(ctx.household, day.date) !== null; } catch { open = false; }
    out.push({
      kind: "review", id, date: day.date, chapterId: ctx.current, label: "Weekly Sitdown",
      sourceRefs: [], major: false, relation: relationOf(day.date, ctx.today),
      actions: [action(id, "sitdown", "Open the weekly Sitdown", { name: "openWeeklySitdown" }, true)],
      reviewKind: "weekly-sitdown", status: open ? "session-open" : "scheduled", weekStart,
    });
  }
  return out;
}

/** An earlier month whose Chapter record is still open (close due): the piece's "gate ajar" hint. */
export function waitingChapterMonth(ctx: DeriveContext): MonthKey | null {
  try {
    const open = openChapterFor(ctx.household);
    if (!open) return null;
    const month = chapterMonth(open);
    return month < ctx.current ? month : null;
  } catch {
    return null;
  }
}
