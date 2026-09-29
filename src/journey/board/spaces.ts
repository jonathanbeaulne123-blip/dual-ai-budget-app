/**
 * Board spaces (T3), instanced. Month spaces are raised pads with inset tops at the stations; day spaces are inset
 * discs along each month's stretch, with a flagstone at each week's end. States read by SHAPE as well as colour:
 *
 * - past: worn solid (sandstone pads and discs);
 * - open (today's month): bright; today's space raised; days still ahead this month are fresh paper discs;
 * - upcoming months: stakes and string only — a staked ring for the month, a stake per day, no fill.
 *
 * Day N stands on the station, so it is the month pad (no second disc there). At Sky only the month pads show.
 */
import type { JourneyBoard, RouteSpace } from "../contracts.ts";
import type { FullBoardDressing } from "./dressing.ts";
import { createMarkLayer, instancedGeometry, type MarkItem, type MarkLayer } from "./layers.ts";
import { box, cap, merge, prism, ring, transform, type Shape } from "./shapes.ts";

const SIDE = 0.72;

export function padShape(inset: string): Shape {
  return merge(
    prism({ sides: 8, r0: 17, r1: 16, y0: 0, y1: 3.6, side: { tint: 1, shade: SIDE }, top: null }),
    ring({ sides: 8, rIn: 11.5, rOut: 16, y: 3.6, innerY: 2.2, top: { tint: 1 }, innerWall: { tint: 1, shade: 0.8 } }),
    cap({ sides: 8, r: 11.5, y: 2.2, paint: { color: inset } }),
  );
}

/** The upcoming month: a staked string ring, no fill. */
export function padRingShape(): Shape {
  const stakes: Shape[] = [];
  for (let i = 0; i < 8; i += 1) {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    stakes.push(box({ w: 1.8, d: 1.8, y0: 0, y1: 7, at: [Math.cos(a) * 16, Math.sin(a) * 16], paint: { tint: 1, shade: 0.85 }, top: { tint: 1 } }));
  }
  return merge(ring({ sides: 8, rIn: 14.6, rOut: 16, y: 1.4, y0: 0, top: { tint: 1 }, wall: { tint: 1, shade: SIDE } }), ...stakes);
}

export function dayShape(inset: string): Shape {
  return merge(
    prism({ sides: 6, r0: 8.4, r1: 8, y0: 0, y1: 2.4, side: { tint: 1, shade: SIDE }, top: null }),
    ring({ sides: 6, rIn: 5.2, rOut: 8, y: 2.4, innerY: 1.5, top: { tint: 1 }, innerWall: { tint: 1, shade: 0.8 } }),
    cap({ sides: 6, r: 5.2, y: 1.5, paint: { color: inset } }),
  );
}

/** Week's end: a longer flagstone laid along the route (local +x = route direction). */
export function flagstoneShape(inset: string): Shape {
  return merge(
    box({ w: 19, d: 13, y0: 0, y1: 2.6, paint: { tint: 1, shade: SIDE }, top: { tint: 1 } }),
    transform(cap({ sides: 4, r: 1, y: 2.65, phase: Math.PI / 4, paint: { color: inset } }), { scale: [8.5, 1, 5] }),
  );
}

export function stakeShape(tall: boolean): Shape {
  const h = tall ? 10 : 7;
  return merge(
    box({ w: 1.8, d: 1.8, y0: 0, y1: h, paint: { tint: 1, shade: 0.85 }, top: { tint: 1 } }),
    box({ w: 3, d: 3, y0: h, y1: h + 1.2, paint: { tint: 1 } }),
  );
}

/**
 * Boardwalk piles (T7): a pair of posts under the route where it crosses water, one pair per item (local +x = the
 * route's direction, the posts at the path's edges). They hang from the deck down into the water.
 */
export function pileShape(): Shape {
  // Each pile stands a little proud of the deck (a bollard at the path's edge) and runs down into the water.
  return merge(
    box({ w: 2.4, d: 2.4, y0: -9, y1: 2.4, at: [0, 5.6], paint: { tint: 1, shade: 0.62 }, top: { tint: 1, shade: 1.2 } }),
    box({ w: 2.4, d: 2.4, y0: -9, y1: 2.4, at: [0, -5.6], paint: { tint: 1, shade: 0.62 }, top: { tint: 1, shade: 1.2 } }),
    box({ w: 1.2, d: 12.4, y0: -2.8, y1: -1.7, paint: { tint: 1, shade: 0.7 } }),
  );
}

/** Region / Stop draw only the day spaces and posts near the camera (the rest are off-stage anyway). */
export type NearWindow = { x: number; z: number; radius: number };
export const isNear = (w: NearWindow, at: readonly [number, number, number]) => Math.hypot(at[0] - w.x, at[2] - w.z) <= w.radius;

export type SpaceLayers = {
  pads: MarkLayer;
  padRings: MarkLayer;
  days: MarkLayer;
  flags: MarkLayer;
  stakes: MarkLayer;
  all: MarkLayer[];
  /** Rebuild from the route + board (data change, theme change). */
  build(route: RouteSpace, board: JourneyBoard, dressing: FullBoardDressing, near?: NearWindow | null): void;
  /** Day spaces show at Region and Stop only. */
  setTier(tier: "sky" | "region" | "stop"): void;
  dispose(): void;
};

export function createSpaces(): SpaceLayers {
  const pads = createMarkLayer("pads"), padRings = createMarkLayer("pad-rings"), days = createMarkLayer("days");
  const flags = createMarkLayer("flagstones"), stakes = createMarkLayer("stakes");
  const all = [pads, padRings, days, flags, stakes];
  return {
    pads, padRings, days, flags, stakes, all,
    build(route, board, d, near = null) {
      const padItems: MarkItem[] = [], padIds = new Map<string, number>();
      const ringItems: MarkItem[] = [], ringIds = new Map<string, number>();
      for (const m of route.months) {
        if (m.state === "upcoming") { ringIds.set(m.chapterId, ringItems.length); ringItems.push({ anchor: m.at, color: d.stakes }); continue; }
        padIds.set(m.chapterId, padItems.length);
        padItems.push({ anchor: m.at, color: m.state === "open" ? d.spaceOpen : d.spacePast, scale: m.state === "open" ? 1.12 : 1, lift: m.state === "open" ? 0.8 : 0 });
      }
      pads.setGeometry(instancedGeometry(padShape(d.spaceInset), padItems), padIds);
      padRings.setGeometry(instancedGeometry(padRingShape(), ringItems), ringIds);

      const stateOf = new Map(route.months.map((m) => [m.chapterId, m.state]));
      const dayItems: MarkItem[] = [], dayIds = new Map<string, number>();
      const flagItems: MarkItem[] = [], flagIds = new Map<string, number>();
      const stakeItems: MarkItem[] = [], stakeIds = new Map<string, number>();
      for (const s of route.stretches) {
        const monthState = stateOf.get(s.chapterId) ?? "open";
        for (const day of s.days) {
          if (day.index === s.days.length) continue; // day N is the month pad
          if (near && !isNear(near, day.at)) continue;
          if (monthState === "upcoming") {
            stakeIds.set(day.date, stakeItems.length);
            stakeItems.push({ anchor: day.at, dir: day.tangent, color: d.stakes, scale: day.flagstone ? 1.1 : 1 });
            continue;
          }
          const today = day.date === board.today;
          const color = today ? d.spaceOpen : day.relation === "future" ? d.spaceUpcoming : monthState === "open" ? d.spaceOpen : d.spacePast;
          const item: MarkItem = { anchor: day.at, dir: day.tangent, color, scale: today ? 1.25 : 1, lift: today ? 3 : 0 };
          if (day.flagstone) { flagIds.set(day.date, flagItems.length); flagItems.push(item); }
          else { dayIds.set(day.date, dayItems.length); dayItems.push(item); }
        }
      }
      days.setGeometry(instancedGeometry(dayShape(d.spaceInset), dayItems), dayIds);
      flags.setGeometry(instancedGeometry(flagstoneShape(d.spaceInset), flagItems), flagIds);
      stakes.setGeometry(instancedGeometry(stakeShape(false), stakeItems), stakeIds);
    },
    setTier(tier) {
      const close = tier !== "sky";
      days.setVisible(close); flags.setVisible(close); stakes.setVisible(close);
    },
    dispose() { for (const l of all) l.dispose(); },
  };
}
