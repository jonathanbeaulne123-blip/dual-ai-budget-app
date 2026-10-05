/**
 * What Hercules says and what the checklist opens with (ruling 1; nothing that used to be visible disappears):
 * - `weekStopIds`: this week's stops still asking for something (`unresolved`), date order, WITHOUT the "to check"
 *   ones and the Chapter items — those are their own sections, so the checklist never lists a stop twice;
 * - `nextLeavingStopId`: the next commitment from today on that is neither recorded as paid nor "to check";
 * - `nextIsSettingAside`: that commitment is a standing move into a Build jar (set aside, not leaving);
 * - `toCheckIds`: exactly `board.toCheck`;
 * - `waitingOnYou`: the readNeeds items waiting on this viewer; `chapter`: the close-due Chapter item(s).
 */
import { isToCheck, type AttentionItem, type Digest, type JourneyWeek, type Stop } from "../contracts.ts";
import { unresolved } from "./summary.ts";

export function digestOf(input: {
  stops: readonly Stop[]; week: JourneyWeek; today: string; toCheck: string[];
  waitingOnYou: AttentionItem[]; chapter: AttentionItem[];
}): Digest {
  const { stops, week, today } = input;
  const chapterStops = new Set(input.chapter.map(item => item.stopId).filter((id): id is string => id !== null));
  const weekStopIds = stops.filter(stop => stop.date >= week.from && stop.date <= week.to && unresolved(stop) && !isToCheck(stop) && !chapterStops.has(stop.id)).map(stop => stop.id);
  const next = stops.find(stop => stop.kind === "commitment" && stop.status !== "paid" && !isToCheck(stop) && stop.date >= today) ?? null;
  return {
    weekStopIds,
    nextLeavingStopId: next?.id ?? null,
    nextIsSettingAside: next?.kind === "commitment" && next.setAside === "build",
    toCheckIds: [...input.toCheck],
    waitingOnYou: input.waitingOnYou.map(item => ({ ...item })),
    chapter: input.chapter.map(item => ({ ...item })),
  };
}
