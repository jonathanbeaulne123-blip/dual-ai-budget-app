/**
 * Crossroads preview (T3): while an alternative is previewed the board draws it PROVISIONALLY — a dashed ring round
 * the crossroads and a dashed branch leaving the route toward the alternative (in the dressing's `provisional`
 * colour; the UI adds the "Preview — nothing has changed" words). A home-blueprint alternative also shows its layout
 * on the member's plot, translucent (`land.setHomes(..., provisional: true)`). Returning (`null`) removes all of it
 * and restores the committed homes. Nothing here is stored or sent anywhere.
 */
import type { Crossroads, JourneyBoard, JourneyHome, Point2 } from "../contracts.ts";
import { box, merge, transform, type Shape } from "./shapes.ts";

export type PreviewSelection = { crossroadsId: string; alternativeId: string };

/** Dashes around a circle (design units). */
export function dashedRing(radius: number, dashes = 14): Shape {
  const parts: Shape[] = [];
  const arc = (Math.PI * 2 * radius) / dashes;
  for (let i = 0; i < dashes; i += 1) {
    const a = (i / dashes) * Math.PI * 2;
    parts.push(transform(box({ w: arc * 0.55, d: 2, y0: 0.4, y1: 1.6, paint: { tint: 1 } }), { at: [Math.cos(a) * radius, 0, Math.sin(a) * radius], yaw: -a - Math.PI / 2 }));
  }
  return merge(...parts);
}

/**
 * A dashed branch leaving the route: starts at the crossroads space, bends away from the route's direction by
 * `bend` radians on the post side, `length` design units long.
 */
export function dashedBranch(tangent: Point2, side: Point2, length = 90, dashes = 8): Shape {
  const parts: Shape[] = [];
  for (let i = 0; i < dashes; i += 1) {
    const t = (i + 0.5) / dashes;
    // Quadratic curve: along the tangent, easing out toward the side.
    const along = length * t, out = length * 0.55 * t * t;
    const x = tangent[0] * along + side[0] * out, z = tangent[1] * along + side[1] * out;
    const dx = tangent[0] + side[0] * 1.1 * t, dz = tangent[1] + side[1] * 1.1 * t;
    parts.push(transform(box({ w: (length / dashes) * 0.55, d: 3, y0: 0.6, y1: 1.8, paint: { tint: 1 } }), { at: [x, 0, z], yaw: -Math.atan2(dz, dx) }));
  }
  // An arrow tip at the end.
  const endAlong = length, endOut = length * 0.55;
  parts.push(transform(box({ w: 5, d: 5, y0: 0.6, y1: 2.2, paint: { tint: 1 } }), {
    at: [tangent[0] * endAlong + side[0] * endOut, 0, tangent[1] * endAlong + side[1] * endOut], yaw: Math.PI / 4,
  }));
  return merge(...parts);
}

export function findAlternative(board: JourneyBoard, preview: PreviewSelection | null): { crossroads: Crossroads; alternative: Crossroads["alternatives"][number] } | null {
  if (!preview) return null;
  const crossroads = board.crossroads.find((c) => c.id === preview.crossroadsId);
  const alternative = crossroads?.alternatives.find((a) => a.id === preview.alternativeId);
  return crossroads && alternative ? { crossroads, alternative } : null;
}

/** The homes to draw while previewing (a home alternative replaces that member's layout, provisionally), or null for "no change". */
export function previewHomes(board: JourneyBoard, preview: PreviewSelection | null): JourneyHome[] | null {
  const found = findAlternative(board, preview);
  if (!found || found.alternative.isCurrent || found.alternative.preview.kind !== "home") return null;
  const memberId = found.crossroads.id.startsWith("crossroads:home:") ? found.crossroads.id.slice("crossroads:home:".length) : board.memberId;
  const layout = found.alternative.preview.layout;
  const current = board.homes.find((h) => h.memberId === memberId);
  const others = board.homes.filter((h) => h.memberId !== memberId);
  // No committed home on this device: the preview has no plot to stand on (the land skips an unknown plot).
  return [...others, { memberId, plotId: current?.plotId ?? "", layout, provisional: true }];
}
