/**
 * Chapters (a chapter IS a calendar month, D-273): state by calendar against today's month, the month's Chapter
 * record (`chapterMonths`), honest unresolved counts, grounded traces, and every day of the month. A past chapter
 * with unresolved items stays readable; it is never marked ruined.
 */
import { addDays, monthEndKey, monthKeyFromDateKey, monthStartKey, type DateKey, type MonthKey } from "../../core/calendar.ts";
import { chapterMonth } from "../../core/chapters.ts";
import { isMonthClosed } from "../../core/statements.ts";
import { stationForMonth, type Chapter, type ChapterTrace, type Crossroads, type DayCell, type JourneyBoard, type Stop, type StopCluster, type UnresolvedCounts } from "../contracts.ts";
import { taskCompletedOn, visibleTasks } from "./plans.ts";
import { chapterReviewStatus, type ChapterRecordRow } from "./reviews.ts";
import { monthLabel } from "./words.ts";
import type { DeriveContext } from "./window.ts";

function counts(stops: Stop[], closeDue: 0 | 1): UnresolvedCounts {
  let overdue = 0, review = 0, expected = 0;
  for (const stop of stops) {
    if (stop.kind === "commitment" && stop.status === "overdue") overdue += 1;
    if (stop.kind === "commitment" && stop.status === "needs-review") review += 1;
    if (stop.kind === "income" && stop.status === "expected" && stop.relation === "past") expected += 1;
  }
  return { overdueCommitments: overdue, commitmentsNeedingReview: review, chapterCloseDue: closeDue, expectedIncomeNotRecorded: expected, attention: overdue + review + closeDue };
}

/** Traces a month keeps, each naming its source. Memories and milestones are passed in as their stops. */
function traces(ctx: DeriveContext, month: MonthKey, row: ChapterRecordRow | null, keptStops: Stop[], doneTasks: Map<MonthKey, string[]>): ChapterTrace[] {
  const out: ChapterTrace[] = [];
  if (row?.kind === "own" && row.record && row.record.state !== "open") out.push({ kind: "chapter-closed", outcome: row.record.state, sourceRefs: [{ kind: "chapter", id: row.record.id }] });
  let closed = false;
  try { closed = isMonthClosed(ctx.household, month); } catch { closed = false; }
  if (closed) out.push({ kind: "books-closed", sourceRefs: [] });
  const reflections = (ctx.household.planReflections ?? []).filter(row => row.scope === "household" && row.monthKey === month && row.reviewedByMemberIds.length > 0);
  if (reflections.length) out.push({ kind: "plan-reviewed", sourceRefs: reflections.map(row => ({ kind: "planVersion" as const, id: row.planVersionId })) });
  for (const taskId of doneTasks.get(month) ?? []) out.push({ kind: "task-done", taskId, sourceRefs: [{ kind: "task", id: taskId }] });
  for (const stop of keptStops) {
    if (stop.kind === "memory") out.push({ kind: "memory-kept", stopId: stop.id, sourceRefs: stop.sourceRefs });
    if (stop.kind === "milestone" && stop.status === "granted") out.push({ kind: "milestone", stopId: stop.id, sourceRefs: stop.sourceRefs });
  }
  return out;
}

export function doneTasksByMonth(ctx: DeriveContext): Map<MonthKey, string[]> {
  const out = new Map<MonthKey, string[]>();
  for (const task of visibleTasks(ctx)) {
    const on = taskCompletedOn(task, "America/Toronto");
    if (!on) continue;
    const month = monthKeyFromDateKey(on);
    out.set(month, [...(out.get(month) ?? []), task.id].sort());
  }
  return out;
}

export function buildChapters(ctx: DeriveContext, rows: ChapterRecordRow[], stops: Stop[], clusters: StopCluster[], crossroads: Crossroads[], doneTasks: Map<MonthKey, string[]>): Chapter[] {
  const byMonth = new Map<MonthKey, Stop[]>();
  for (const stop of stops) byMonth.set(stop.chapterId, [...(byMonth.get(stop.chapterId) ?? []), stop]);
  const clusterByDate = new Map(clusters.map(cluster => [cluster.date, cluster.id]));
  return rows.map((row): Chapter => {
    const month = row.month;
    const monthStops = byMonth.get(month) ?? [];
    const status = row.kind === "own" && row.record ? chapterReviewStatus(ctx, month, row.record) : null;
    const closeDue: 0 | 1 = row.kind === "own" && row.record?.state === "open" && month < ctx.current && status !== null ? 1 : 0;
    const days: DayCell[] = [];
    for (let date = monthStartKey(month) as DateKey; date <= monthEndKey(month); date = addDays(date, 1)) {
      const ledger = ctx.days.get(date);
      days.push({
        date, relation: date < ctx.today ? "past" : date === ctx.today ? "today" : "future",
        stopIds: monthStops.filter(stop => stop.date === date).map(stop => stop.id),
        clusterId: clusterByDate.get(date) ?? null,
        postedCount: ledger?.coins.length ?? 0,
        flagstone: ledger ? ledger.flagstone : new Date(`${date}T12:00:00Z`).getUTCDay() === 0,
        sitdown: ledger?.sitdown ?? false,
      });
    }
    return {
      id: month, stationId: stationForMonth(month), label: monthLabel(month),
      state: month < ctx.current ? "past" : month === ctx.current ? "open" : "upcoming",
      record: { chapterRecordId: row.record?.id ?? null, kind: row.kind, recordState: row.record?.state ?? null, title: row.record?.title ?? null },
      unresolved: counts(monthStops, closeDue),
      traces: traces(ctx, month, row, monthStops, doneTasks),
      days, stopIds: monthStops.map(stop => stop.id),
      crossroadsIds: crossroads.filter(item => item.chapterId === month).map(item => item.id),
    };
  });
}

/** Months before the window that kept something: traces only (list only). Commitments there are not recomputed. */
export function olderChapters(ctx: DeriveContext, olderStops: Stop[], doneTasks: Map<MonthKey, string[]>): JourneyBoard["olderChapters"] {
  const first = ctx.months[0]!;
  const months = new Set<MonthKey>();
  const ownRecords = new Map<MonthKey, NonNullable<ChapterRecordRow["record"]>>();
  for (const record of ctx.household.chapters ?? []) {
    let month: MonthKey;
    try { month = chapterMonth(record); } catch { continue; }
    if (month >= first) continue;
    months.add(month);
    const prior = ownRecords.get(month);
    if (!prior || record.openedAt > prior.openedAt) ownRecords.set(month, record);
  }
  for (const row of ctx.household.kitchen?.books?.closedMonths ?? []) if (row.monthKey < first) months.add(row.monthKey);
  for (const row of ctx.household.planReflections ?? []) if (row.scope === "household" && row.monthKey < first) months.add(row.monthKey);
  for (const month of doneTasks.keys()) if (month < first) months.add(month);
  for (const stop of olderStops) months.add(stop.chapterId);
  return [...months].sort().flatMap(month => {
    const record = ownRecords.get(month) ?? null;
    const row: ChapterRecordRow = { month, record, kind: record ? "own" : "none" };
    const kept = olderStops.filter(stop => stop.chapterId === month);
    const closeDue: 0 | 1 = record?.state === "open" ? 1 : 0;
    const monthTraces = traces(ctx, month, row, kept, doneTasks);
    if (!monthTraces.length && !closeDue) return [];
    return [{ id: month, unresolved: counts([], closeDue), traces: monthTraces }];
  });
}
