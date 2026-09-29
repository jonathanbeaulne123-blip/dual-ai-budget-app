/**
 * `deriveJourneyBoard(h, memberId, today, options)` — the whole board, derived on read. PURE: no clock (today comes
 * from the App), no storage, no writes, no memo (the UI memoizes on revision + member + today). The input is never
 * mutated. Every id comes from `journeyIds` over a source record id, so re-reading, reloading, importing an older
 * record or correcting another record never re-keys an unrelated stop.
 */
import { monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import type { Household } from "../../core/types.ts";
import { DEFAULT_PIECE_LOOK, stationForMonth, type DeriveJourneyBoard, type DeriveJourneyBoardOptions, type JourneyBoard, type Stop } from "../contracts.ts";
import { buildChapters, doneTasksByMonth, olderChapters } from "./chapters.ts";
import { clusterStops } from "./clusters.ts";
import { commitmentStops } from "./commitments.ts";
import { crossroadsFor } from "./crossroads.ts";
import { incomeStops } from "./income.ts";
import { memoryStops } from "./memories.ts";
import { journeyHomes, milestoneStops, readViewerHome } from "./milestones.ts";
import { goalStops, taskStops } from "./plans.ts";
import { readChapterRows, reviewStops, waitingChapterMonth } from "./reviews.ts";
import { compareStops } from "./stopKit.ts";
import { boardSummary } from "./summary.ts";
import { readContext } from "./window.ts";

export const deriveJourneyBoard: DeriveJourneyBoard = (household: Household, memberId: string, today: DateKey, options?: DeriveJourneyBoardOptions): JourneyBoard => {
  const ctx = readContext(household, memberId, today, options);
  const rows = readChapterRows(ctx);
  const viewer = readViewerHome(ctx);
  const memories = memoryStops(ctx);
  const milestones = milestoneStops(ctx, viewer);

  const stops: Stop[] = [
    ...commitmentStops(ctx),
    ...incomeStops(ctx),
    ...reviewStops(ctx, rows),
    ...goalStops(ctx),
    ...taskStops(ctx),
    ...milestones.stops,
    ...memories.stops,
  ].filter(stop => ctx.monthSet.has(stop.chapterId)).sort(compareStops);

  const clusters = clusterStops(stops);
  const crossroads = crossroadsFor(ctx, viewer);
  const doneTasks = doneTasksByMonth(ctx);
  const chapters = buildChapters(ctx, rows, stops, clusters, crossroads, doneTasks);
  const older = olderChapters(ctx, [...memories.older, ...milestones.older], doneTasks);
  const hasPosted = (ctx.presented?.transactions.length ?? 0) > 0;
  const empty = stops.length === 0 && crossroads.length === 0 && memories.undated.length === 0 && older.length === 0 && !hasPosted;

  const limitations: string[] = [];
  const partners = household.members.filter(member => member.active && member.id !== memberId);
  if (viewer.home === null && viewer.reason === "not-on-device") limitations.push("This device holds another member’s private home, so homes and milestones are not shown here.");
  else if (viewer.home === null) limitations.push("Your saved home could not be read on this version of Hearth; your saved original is kept.");
  if (partners.length) limitations.push(`${partners.map(member => member.name).join(" and ")}’s home and milestones are private to their own device.`);
  if (ctx.sitdownWeekday !== null) limitations.push("Weekly Sitdowns show for this month only: Hearth keeps no record of which past weeks were held.");
  if (ctx.recognised.some(row => row.tx.type === "income" && row.tx.source === "shift")) limitations.push("Shift earnings are counted on their day, not drawn as separate stops; Shifts and the Books list each one.");
  if (older.length) limitations.push("Months before this board show their traces in the list; their bills are in the Books.");
  // Standing gaps the board does not pretend to cover (review MINOR 4 / MINOR 5, D64).
  limitations.push("The island on the board is always drawn in summer; Horizon follows the real season.");
  limitations.push("The yacht and the boats are not shown on the board: they are kept on this device, inside Horizon.");
  limitations.push("“Open the Calendar” opens the Calendar on this month, not on the stop’s day.");
  limitations.push("The Campfire opens on the Chapter that is still open, not on a month chosen on the board.");

  const current = monthKeyFromDateKey(today);
  return {
    version: 1, householdId: household.householdId, memberId, today, currentChapterId: current,
    window: { from: ctx.months[0]!, to: ctx.months.at(-1)! },
    chapters, stops, clusters, crossroads,
    piece: { anchorChapterId: current, atStationId: stationForMonth(current), atDate: today, waitingChapterId: waitingChapterMonth(ctx), lookId: DEFAULT_PIECE_LOOK },
    summary: boardSummary(ctx, stops, empty),
    homes: journeyHomes(viewer, memberId),
    undatedMemories: memories.undated,
    olderChapters: older,
    empty,
    limitations,
  };
};
