/**
 * `boardToList(board)` — the readable list equivalent: the same stops, the same crossroads and the SAME actions as
 * the map panel (each row's `actions` is the stop's own array), in chronological order (never screen position).
 * Older months first (traces only), then each chapter: its dates in order, a cluster row with its stops beneath,
 * crossroads on their date; kept memories with no date close the list.
 */
import type { Chapter, Crossroads, JourneyBoard, ListRow, Stop } from "../contracts.ts";
import { amountText, kindLabel, monthLabel, statusText } from "./words.ts";

function chapterStatus(chapter: Chapter): string {
  const when = chapter.state === "open" ? "This month" : chapter.state === "past" ? "Past" : "Upcoming";
  const record = chapter.record.kind === "own" ? chapter.record.recordState === "open" ? "Chapter open" : "Chapter closed"
    : chapter.record.kind === "still-open" ? "An earlier Chapter is still open" : "No Chapter kept";
  const attention = chapter.unresolved.attention > 0 ? ` · ${chapter.unresolved.attention} need${chapter.unresolved.attention === 1 ? "s" : ""} attention` : "";
  return `${when} · ${record}${attention}`;
}

function stopRow(stop: Stop, depth: 1 | 2, dated = true): ListRow {
  return {
    id: stop.id, level: "stop", chapterId: stop.chapterId, date: dated ? stop.date : null,
    kindLabel: kindLabel(stop), label: stop.label, amountText: amountText(stop), statusText: statusText(stop),
    actions: stop.actions, depth,
  };
}

function crossroadsRow(item: Crossroads): ListRow {
  const waiting = item.waitingOn.length ? "Waiting on agreement" : "An open choice";
  return {
    id: item.id, level: "crossroads", chapterId: item.chapterId, date: item.date, kindLabel: "Crossroads", label: item.label,
    amountText: "", statusText: `${waiting} · nothing changes until you confirm`,
    actions: [{ id: `${item.id}#confirm`, label: item.confirm.label, call: item.confirm.call, primary: true }],
    depth: 1,
  };
}

export function boardToList(board: JourneyBoard): ListRow[] {
  const rows: ListRow[] = [];
  const stops = new Map(board.stops.map(stop => [stop.id, stop]));
  const clusters = new Map(board.clusters.map(cluster => [cluster.id, cluster]));
  for (const older of board.olderChapters) {
    rows.push({
      id: older.id, level: "chapter", chapterId: older.id, date: null, kindLabel: "Chapter", label: monthLabel(older.id), amountText: "",
      statusText: `Past · ${older.traces.length} kept trace${older.traces.length === 1 ? "" : "s"}${older.unresolved.chapterCloseDue ? " · Chapter still open" : ""}`,
      actions: [], depth: 0,
    });
  }
  for (const chapter of board.chapters) {
    rows.push({
      id: chapter.id, level: "chapter", chapterId: chapter.id, date: null, kindLabel: "Chapter",
      label: chapter.record.title ? `${chapter.label} · ${chapter.record.title}` : chapter.label,
      amountText: "", statusText: chapterStatus(chapter), actions: [], depth: 0,
    });
    const crossroads = board.crossroads.filter(item => item.chapterId === chapter.id);
    for (const day of chapter.days) {
      const cluster = day.clusterId ? clusters.get(day.clusterId) : undefined;
      if (cluster) {
        rows.push({ id: cluster.id, level: "cluster", chapterId: chapter.id, date: cluster.date, kindLabel: "Several on one day", label: cluster.label, amountText: "", statusText: "", actions: [], depth: 1 });
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
