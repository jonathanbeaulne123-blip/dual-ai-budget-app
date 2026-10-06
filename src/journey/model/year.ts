/**
 * The Year ring's twelve minis: one entry per chapter in the window, in window order. Figures are the MAP's
 * commitments and income only (ruling 5: "bills and planned costs on the map, not all spending"), never the Books.
 * Recorded and open are separate figures; Fund contributions are never in `in*` (ruling 4); an unknown amount adds
 * nothing to any figure and is counted in `unknownAmounts` instead (never as 0).
 */
import { isFundStop, isToCheck, type Chapter, type Stop, type YearChapter } from "../contracts.ts";
import { directionOf, isRecorded, knownCents } from "./money.ts";

export function yearOf(chapters: readonly Chapter[], stops: readonly Stop[]): YearChapter[] {
  return chapters.map((chapter): YearChapter => {
    const row: YearChapter = {
      chapterId: chapter.id, outRecordedCents: 0, outOpenCents: 0, inRecordedCents: 0, inOpenCents: 0,
      unknownAmounts: 0, toCheck: 0,
      kept: chapter.record.kind === "own" && chapter.record.recordState !== null && chapter.record.recordState !== "open",
    };
    for (const stop of stops) {
      if (stop.chapterId !== chapter.id) continue;
      if (isToCheck(stop)) row.toCheck += 1;
      const direction = directionOf(stop);
      if (direction === "none") continue;
      const cents = knownCents(stop);
      if (cents === null) { row.unknownAmounts += 1; continue; }
      if (direction === "out") {
        if (isRecorded(stop)) row.outRecordedCents += cents; else row.outOpenCents += cents;
      } else if (!isFundStop(stop)) {
        if (isRecorded(stop)) row.inRecordedCents += cents; else row.inOpenCents += cents;
      }
    }
    return row;
  });
}
