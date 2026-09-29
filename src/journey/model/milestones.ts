/**
 * Milestone stops and member homes. The only milestone evaluator is `src/home/progression.ts` (per member; it
 * unlocks home blueprint families). The board never grants: a `granted` stop is an award already in the viewer's
 * saved `HomeState.awards`; `ready-to-record` is `homeProgress(...).eligible && !earned` (recorded at the next home
 * save, inside `acceptHome`). A partner's home lives in their private envelope and is not on this device.
 */
import { monthKeyFromDateKey, type DateKey } from "../../core/calendar.ts";
import { decodeHome, type HomeState } from "../../home/model.ts";
import { HOME_MILESTONES, homeProgress } from "../../home/progression.ts";
import { HOME_RESERVE_ID } from "../../home/site.ts";
import { journeyIds, type JourneyHome, type MilestoneStop } from "../contracts.ts";
import { action, relationOf } from "./stopKit.ts";
import type { DeriveContext } from "./window.ts";

export type ViewerHome = { home: HomeState; saved: boolean; plotId: string } | { home: null; reason: "not-on-device" | "unreadable" };

/** The viewer's own home: saved (`personalLife.home`), or the starter home they have not saved yet. */
export function readViewerHome(ctx: DeriveContext): ViewerHome {
  const life = ctx.household.personalLife;
  if (life && life.ownerMemberId !== ctx.memberId) return { home: null, reason: "not-on-device" };
  const plotId = ctx.household.hearthside?.homePlots?.find(claim => claim.memberId === ctx.memberId)?.plotId ?? HOME_RESERVE_ID;
  try {
    return { home: decodeHome(life?.home), saved: life?.home !== undefined, plotId };
  } catch {
    return { home: null, reason: "unreadable" };
  }
}

const isDateKey = (value: string): value is DateKey => /^\d{4}-\d{2}-\d{2}$/.test(value);

export function milestoneStops(ctx: DeriveContext, viewer: ViewerHome): { stops: MilestoneStop[]; older: MilestoneStop[] } {
  if (!ctx.viewerActive || viewer.home === null) return { stops: [], older: [] };
  const home = viewer.home;
  const names = new Map(HOME_MILESTONES.map(row => [row.id, row.name]));
  const all: MilestoneStop[] = [];
  const make = (awardId: string, date: DateKey, status: MilestoneStop["status"]): MilestoneStop => {
    const id = journeyIds.milestone(ctx.memberId, awardId);
    return {
      kind: "milestone", id, date, chapterId: monthKeyFromDateKey(date),
      label: names.get(awardId as never) ?? awardId,
      placeRef: { kind: "reserve", id: viewer.home !== null ? viewer.plotId : HOME_RESERVE_ID },
      sourceRefs: [{ kind: "homeAward", memberId: ctx.memberId, id: awardId }],
      major: true, relation: relationOf(date, ctx.today),
      actions: [action(id, "homebook", "Open the HomeBook", { name: "openHomeBook", memberId: ctx.memberId }, true)],
      memberId: ctx.memberId, awardId, status, unlocks: awardId,
    };
  };
  for (const award of home.awards) {
    const date = award.grantedAt.slice(0, 10);
    if (isDateKey(date)) all.push(make(award.id, date, "granted"));
  }
  let progress: ReturnType<typeof homeProgress> = [];
  try { progress = homeProgress(ctx.household, ctx.memberId, home, ctx.today); } catch { progress = []; }
  for (const row of progress) if (row.eligible && !row.earned) all.push(make(row.milestone.id, ctx.today, "ready-to-record"));
  return { stops: all.filter(stop => ctx.monthSet.has(stop.chapterId)), older: all.filter(stop => stop.chapterId < ctx.months[0]!) };
}

/** Committed homes the board can draw: the viewer's own saved layout (never the draft, never `future`). */
export function journeyHomes(viewer: ViewerHome, memberId: string): JourneyHome[] {
  if (viewer.home === null || !viewer.saved) return [];
  return [{ memberId, plotId: viewer.plotId, layout: viewer.home.layout }];
}
