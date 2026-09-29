/**
 * Signposts (T3): a day with stops carries a post whose SHAPE says the kind (colour only reinforces it):
 *
 * | kind | post |
 * |---|---|
 * | commitment | a paper slip hanging from the post (paid: the slip rests in a tray at the foot; set aside: a jar at the foot) |
 * | income | a pennant — half-way up while expected, raised to the top once confirmed |
 * | review | two chairs facing each other (the Campfire / Sitdown) |
 * | plan | a surveyor's stake with a crossbar and a tie |
 * | milestone | a pavilion (`pavilion.ts`; frame only while "ready to record") |
 * | memory | a swallowtail flag |
 * | several on one date | one cluster tile (stacked slabs); the count is the DOM label's |
 * | crossroads | a fork post with two arms, on the other side of the route |
 *
 * Overdue / needs-review / close-due posts also carry a diamond cap. Posts stand beside the route (never on it),
 * all in one merged layer (two draw calls). At Sky only `skyPostIds` stand (≤ 8).
 */
import type { JourneyBoard, RouteSpace, Stop } from "../contracts.ts";
import type { FullBoardDressing } from "./dressing.ts";
import { createMarkLayer, mergedGeometry, type MarkLayer } from "./layers.ts";
import { isNear, type NearWindow } from "./spaces.ts";
import { boardMarks, isAttentionStop, POST_SCALE, skyPostIds } from "./marks.ts";
import { pavilionShape } from "./pavilion.ts";
import { box, merge, plate, prism, transform, type Shape } from "./shapes.ts";

const footing = (d: FullBoardDressing) => box({ w: 5, d: 5, y0: 0, y1: 1.4, paint: { color: d.signpost, shade: 0.7 } });
const post = (d: FullBoardDressing, h: number) => box({ w: 2.2, d: 2.2, y0: 0, y1: h, paint: { color: d.signpost } });
const attentionCap = (y: number) => merge(
  prism({ sides: 4, r0: 2.8, r1: 0, y0: y + 2.8, y1: y + 5.6, phase: 0, side: { tint: 1 }, top: null }),
  prism({ sides: 4, r0: 0, r1: 2.8, y0: y, y1: y + 2.8, phase: 0, side: { tint: 1 }, top: null }),
);

export function slipShape(d: FullBoardDressing, stop: Extract<Stop, { kind: "commitment" }>): { shape: Shape; color: string } {
  const paid = stop.status === "paid";
  const attention = stop.status === "overdue" || stop.status === "needs-review";
  const color = stop.status === "overdue" ? d.attention : stop.status === "due-today" ? d.spaceOpen : paid ? d.spacePast : d.paper;
  const parts: Shape[] = [footing(d), post(d, 24)];
  if (paid) {
    // Recorded: the slip rests flat in a tray at the post's foot.
    parts.push(box({ w: 11, d: 7, y0: 0, y1: 2.2, at: [7, 0], paint: { color: d.signpost, shade: 0.8 } }));
    parts.push(box({ w: 9, d: 5.4, y0: 2.2, y1: 2.8, at: [7, 0], paint: { tint: 1 } }));
  } else {
    parts.push(plate([[1.2, 11], [12.5, 11], [12.5, 20.5], [1.2, 20.5]], 0.9, { tint: 1 }));
    parts.push(box({ w: 11, d: 1, y0: 20.5, y1: 21.4, at: [6.8, 0], paint: { color: d.signpost } }));
  }
  if (stop.setAside && !paid) {
    // Set aside in a pot: a jar at the foot. Set aside is NOT paid (the slip still hangs).
    parts.push(transform(prism({ sides: 6, r0: 3, r1: 2.6, y0: 0, y1: 5, side: { color: d.spaceInset }, top: { color: d.spaceInset, shade: 0.9 } }), { at: [-6, 0, 0] }));
  }
  if (attention) parts.push(attentionCap(25));
  return { shape: merge(...parts), color };
}

export function pennantShape(d: FullBoardDressing, stop: Extract<Stop, { kind: "income" }>): { shape: Shape; color: string } {
  const confirmed = stop.status === "confirmed";
  const base = confirmed ? 19 : 9;
  return {
    shape: merge(footing(d), post(d, 27), plate([[1.2, base], [14, base + 3.8], [1.2, base + 7.6]], 0.9, { tint: 1 })),
    color: confirmed ? d.spaceOpen : d.paper,
  };
}

export function chairsShape(d: FullBoardDressing, stop: Extract<Stop, { kind: "review" }>): { shape: Shape; color: string } {
  const chair = (x: number, facing: 1 | -1) => merge(
    box({ w: 6, d: 6, y0: 0, y1: 5, at: [x, 0], paint: { color: d.signpost, shade: 0.85 }, top: { tint: 1 } }),
    box({ w: 1.4, d: 6, y0: 5, y1: 12, at: [x - facing * 2.3, 0], paint: { color: d.signpost } }),
  );
  const attention = stop.reviewKind === "chapter-close" && (stop.status === "close-due" || stop.status === "waiting-on-you");
  const color = attention ? d.attention
    : stop.reviewKind === "chapter-close" ? (stop.status === "closed" ? d.spacePast : stop.status === "open" ? d.spaceOpen : d.paper)
      : stop.status === "session-open" ? d.spaceOpen : d.paper;
  const parts = [chair(-5, 1), chair(5, -1), prism({ sides: 6, r0: 2, y0: 0, y1: 4, side: { color: d.signpost, shade: 0.8 }, top: { color: d.signpost } })];
  if (attention) parts.push(transform(attentionCap(0), { at: [0, 14, 0] }));
  const shape = merge(...parts);
  return { shape: stop.reviewKind === "weekly-sitdown" ? transform(shape, { scale: 0.8 }) : shape, color };
}

export function stakeShape(d: FullBoardDressing, stop: Extract<Stop, { kind: "plan" }>): { shape: Shape; color: string } {
  const task = stop.planKind === "task";
  const h = task ? 22 : 30;
  const color = stop.planKind === "goal"
    ? (stop.status === "bought" ? d.spacePast : stop.status === "fully-backed" ? d.spaceOpen : d.paper)
    : (stop.status === "done" ? d.spacePast : d.paper);
  return {
    shape: merge(
      footing(d),
      prism({ sides: 4, r0: 1.5, r1: 0.9, y0: 0, y1: h, phase: Math.PI / 4, side: { color: d.stakes } }),
      box({ w: 9, d: 1.3, y0: h - 8, y1: h - 6.8, paint: { color: d.stakes } }),
      plate([[0.9, h - 5], [8, h - 3.5], [6.5, h - 2], [8, h - 0.5], [0.9, h - 2]], 0.8, { tint: 1 }),
    ),
    color,
  };
}

export function flagShape(d: FullBoardDressing): { shape: Shape; color: string } {
  return {
    shape: merge(footing(d), post(d, 27), plate([[1.2, 17], [14, 17], [11, 21.5], [14, 26], [1.2, 26]], 0.9, { tint: 1 })),
    color: d.ribbonEdge,
  };
}

export function clusterShape(d: FullBoardDressing, attention: boolean): { shape: Shape; color: string } {
  const parts = [
    box({ w: 13, d: 13, y0: 0, y1: 2.6, paint: { tint: 1, shade: 0.75 }, top: { tint: 1 } }),
    transform(box({ w: 12, d: 12, y0: 2.6, y1: 5.2, paint: { tint: 1, shade: 0.8 }, top: { tint: 1 } }), { yaw: 0.22 }),
    transform(box({ w: 11, d: 11, y0: 5.2, y1: 7.8, paint: { tint: 1, shade: 0.85 }, top: { color: d.paper } }), { yaw: -0.18 }),
  ];
  if (attention) parts.push(attentionCap(8.6));
  return { shape: merge(...parts), color: d.clusterBase };
}

export function crossroadsShape(d: FullBoardDressing): { shape: Shape; color: string } {
  const arm = (y: number, yaw: number, flip: 1 | -1) => {
    const outline: [number, number][] = [[0, 0], [11 * flip, 0], [13.5 * flip, 1.7], [11 * flip, 3.4], [0, 3.4]];
    return transform(plate(flip > 0 ? outline : outline.reverse(), 0.9, { tint: 1 }), { at: [0, y, 0], yaw });
  };
  return {
    shape: merge(footing(d), post(d, 30), arm(23, 0.35, 1), arm(17.5, -0.35, -1), prism({ sides: 4, r0: 1.8, r1: 0, y0: 30, y1: 33, phase: Math.PI / 4, side: { color: d.signpost }, top: null })),
    color: d.paper,
  };
}

function postFor(d: FullBoardDressing, stop: Stop): { shape: Shape; color: string } {
  switch (stop.kind) {
    case "commitment": return slipShape(d, stop);
    case "income": return pennantShape(d, stop);
    case "review": return chairsShape(d, stop);
    case "plan": return stakeShape(d, stop);
    case "milestone": return { shape: pavilionShape(stop.status, { post: d.signpost, roof: d.pavilion, platform: d.pavilion }), color: d.pavilion };
    case "memory": return flagShape(d);
  }
}


export type SignpostLayer = {
  layer: MarkLayer;
  /** Rebuild for a tier (Sky shows ≤ 8 posts). */
  build(route: RouteSpace, board: JourneyBoard, dressing: FullBoardDressing, tier: "sky" | "region" | "stop", near?: NearWindow | null): void;
  dispose(): void;
};

export function createSignposts(): SignpostLayer {
  const layer = createMarkLayer("signposts");
  return {
    layer,
    build(route, board, d, tier, near = null) {
      const sky = tier === "sky" ? skyPostIds(board) : null;
      const byId = new Map(board.stops.map((s) => [s.id, s]));
      const entries: Parameters<typeof mergedGeometry>[0][number][] = [];
      const indexOf = new Map<string, number>();
      const marks = boardMarks(board, route);
      const add = (ids: string[], base: readonly [number, number, number], offset: readonly [number, number], made: { shape: Shape; color: string }) => {
        const index = entries.length;
        entries.push({ shape: transform(made.shape, { scale: POST_SCALE, at: [offset[0], 0, offset[1]] }), item: { anchor: base, color: made.color }, index });
        for (const id of ids) indexOf.set(id, index);
      };
      for (const m of marks) {
        if (near && !isNear(near, m.base)) continue;
        if (m.kind === "cluster") {
          if (sky && !sky.has(m.id)) continue;
          const cluster = board.clusters.find((c) => c.id === m.id)!;
          const attention = cluster.stopIds.some((id) => { const s = byId.get(id); return s ? isAttentionStop(s) : false; });
          add([m.id, ...cluster.stopIds], m.base, m.offset, clusterShape(d, attention));
        } else if (m.kind === "stop") {
          const inCluster = board.clusters.some((c) => c.stopIds.includes(m.id));
          if (inCluster || (sky && !sky.has(m.id))) continue;
          add([m.id], m.base, m.offset, postFor(d, byId.get(m.id)!));
        } else if (m.kind === "crossroads") {
          if (sky && !sky.has(m.id)) continue;
          add([m.id], m.base, m.offset, crossroadsShape(d));
        }
      }
      layer.setGeometry(entries.length ? mergedGeometry(entries) : null, indexOf);
    },
    dispose() { layer.dispose(); },
  };
}
