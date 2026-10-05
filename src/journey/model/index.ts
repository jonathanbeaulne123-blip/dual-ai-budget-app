/**
 * The Journey Board model (T1 / Horizon Clock L1) — PURE derivation from one Household snapshot.
 * Public API: `deriveJourneyBoard` (a v2 board), `boardToList`, `listView`, `directionOf`, and the words.
 * No React, no three, no storage, no clock.
 */
export { deriveJourneyBoard, deriveJourneyBoardWithSummary } from "./derive.ts";
export type { BoardSummary } from "./summary.ts";
export { boardToList, booksActualsBetween, listView } from "./list.ts";
export { directionOf, isRecorded, knownCents, payAlreadyRecordedToday, toCheckIds } from "./money.ts";
export { mondayOf } from "./weeks.ts";
export {
  amountText, chapterStatusText, dayLabel, kindLabel, MAP_WORDS, monthLabel, needsYouLabel, openPlaceWords, pinnedLabel, rulerWords, shortDate,
  signedMoney, statusText, weekTitle, yearTitle,
} from "./words.ts";
