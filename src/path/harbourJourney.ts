import { monthKeyFromDateKey, type DateKey } from "../core/calendar.ts";
import { chapterMonth, openChapterFor } from "../core/chapters.ts";
import type { Household, MonthKey } from "../core/types.ts";

/**
 * The one non-financial doorway between Our Path and Little Harbour.  It is
 * deliberately a view contract: resolving it neither writes a chapter nor
 * treats a remembered (past or future) month as a Harbour address.
 */
export type HarbourJourneyAnchor = {
  chapterId: string | null;
  month: MonthKey;
  /** The first Toronto civil day gives the map a stable month focus. */
  date: DateKey;
  source: "open-chapter" | "today";
};

export function harbourJourneyAnchor(household: Household, today: DateKey): HarbourJourneyAnchor {
  const chapter = openChapterFor(household);
  const month = chapter ? chapterMonth(chapter) : monthKeyFromDateKey(today);
  return { chapterId: chapter?.id ?? null, month, date: `${month}-01`, source: chapter ? "open-chapter" : "today" };
}

/** Only the actual current Chapter may enter Harbour; historical/future map exploration stays on Journey. */
export function isHarbourJourneyMonth(anchor: HarbourJourneyAnchor, date: DateKey): boolean {
  return monthKeyFromDateKey(date) === anchor.month;
}

/** One further intentional zoom-in from the closest map level is the doorway. */
export function entersHarbourFromJourneyZoom(level: number, direction: number, anchor: HarbourJourneyAnchor, date: DateKey): boolean {
  return level === 0 && direction < 0 && isHarbourJourneyMonth(anchor, date);
}
