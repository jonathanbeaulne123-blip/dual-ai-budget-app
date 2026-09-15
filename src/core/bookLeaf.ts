/**
 * The Standing Book's paper geometry.
 *
 * Presentation only. Every position here is read from a plate figure that
 * plates.ts already scaled; this file only says where on the page each piece
 * of paper stands or lies. Two rules from the book's grammar are enforced here
 * so a component cannot bend them: height is the only channel that carries a
 * magnitude (fold order, depth and pocket thickness carry order and count,
 * never a number), and nothing projected stands — a panel right of the corner
 * lies flat in pencil. Nothing here reads a household, computes a balance, or
 * touches a cent.
 */

import type { PlateEdge } from "./deskPlates.ts";
import { fillLevel, pairScale, PLATE_VIEW, sparkHeights, tallyIsCountable, trackX } from "./plates.ts";

/** The floor's near edge and the gate sit at the page's middle. */
export const BOOK_GATE_X = (PLATE_VIEW.left + PLATE_VIEW.right) / 2;

/** Bookmark reach along the fore-edge: 0 flush, 1 a finger out, 2 proud and dog-eared. */
export type BookmarkStance = { reach: 0 | 1 | 2; dogEar: boolean };

/** Geometry is state. Only attention stands proud and folds a corner; live shows a finger; quiet and clear sit flush. */
export function bookmarkStance(edge: PlateEdge): BookmarkStance {
  if (edge === "attention") return { reach: 2, dogEar: true };
  if (edge === "live") return { reach: 1, dogEar: false };
  return { reach: 0, dogEar: false };
}

/** Shut, the block says nothing when no bookmark reaches. Healthy is quiet. */
export function foreEdgeIsFlush(edges: readonly PlateEdge[]): boolean {
  return edges.every((edge) => bookmarkStance(edge).reach === 0);
}

/** The running head's state word, from the Level plate's edge. Never a number. */
export function bookHeadState(edge: PlateEdge): string {
  switch (edge) {
    case "attention": return "Needs a look";
    case "live": return "In motion";
    case "quiet": return "Findings to read";
    case "clear": return "Covered";
    default: {
      const never: never = edge;
      return never;
    }
  }
}

/** The concertina's page: a baseline with the same room above and below it, so a negative point folds down and never leaves the page. */
export function concertinaView(room: number): { height: number; base: number } {
  const safeRoom = Math.max(0, room);
  return { height: safeRoom * 2 + 12, base: safeRoom + 6 };
}

export type ConcertinaPanel = {
  x0: number; x1: number; y0: number; y1: number;
  /** Left of the corner: happened, ink, standing. Right: projected, pencil, flat. */
  standing: boolean;
  /** Alternating fold faces. Order only — never a magnitude. */
  fold: "a" | "b";
};

/**
 * One strip of paper folded once per point. Panel i joins point i-1 to point i
 * and stands only when both ends have happened (`i < actualCount`). Without an
 * `actualCount` every point is a fact and every panel stands; no corner is
 * invented for a figure that carries no boundary.
 */
export function concertinaPanels(points: readonly number[], room: number, actualCount?: number): ConcertinaPanel[] {
  const heights = sparkHeights(points, room);
  const count = points.length;
  if (count < 2) return [];
  const { base } = concertinaView(room);
  const gap = (PLATE_VIEW.right - PLATE_VIEW.left) / (count - 1);
  const boundary = Math.min(count, Math.max(0, actualCount ?? count));
  const y = (index: number) => (points[index] ?? 0) >= 0 ? base - (heights[index] ?? 0) : base + (heights[index] ?? 0);
  const panels: ConcertinaPanel[] = [];
  for (let index = 1; index < count; index += 1) {
    panels.push({
      x0: PLATE_VIEW.left + (index - 1) * gap,
      x1: PLATE_VIEW.left + index * gap,
      y0: y(index - 1),
      y1: y(index),
      standing: index < boundary,
      fold: index % 2 === 1 ? "a" : "b",
    });
  }
  return panels;
}

/** Where the corner falls: the last point that happened. Null when the figure carries no boundary. */
export function concertinaCornerX(count: number, actualCount?: number): number | null {
  if (actualCount === undefined || count < 1) return null;
  const boundary = Math.min(count, Math.max(0, actualCount));
  if (boundary < 1) return PLATE_VIEW.left;
  const gap = count > 1 ? (PLATE_VIEW.right - PLATE_VIEW.left) / (count - 1) : 0;
  return PLATE_VIEW.left + (boundary - 1) * gap;
}

/** The gate is fixed; the strip moves. Clamp a cursor onto the marks. */
export function gateIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(index)));
}

/** The strip's tallest mark, the one scale every mark on it shares. Zero when nothing stands. */
export function trackPeakCents(cents: readonly number[]): number {
  return Math.max(0, ...cents);
}

/** How far the strip slides so the mark on `day` stands in the gate. */
export function gateShift(day: number, days: number): number {
  return BOOK_GATE_X - trackX(day, days);
}

/** Wells sunk into the page, side by side; each a vessel, never a tower. */
export function wellColumns(count: number): { x: number; width: number }[] {
  if (count <= 0) return [];
  const gutter = 6;
  const width = (PLATE_VIEW.right - PLATE_VIEW.left - gutter * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => ({ x: PLATE_VIEW.left + index * (width + gutter), width }));
}

/** A well's water: the level as a share of the well's depth. Never overflows. */
export function wellWater(savedCents: number, targetCents: number, depth: number): number {
  return fillLevel(savedCents, targetCents) * Math.max(0, depth);
}

/** Cards standing in a pocket; thickness is the count. An uncountable tally shows an empty pocket. */
export function pocketCards(count: number): { x: number; y: number }[] {
  if (!tallyIsCountable(count)) return [];
  return Array.from({ length: count }, (_, index) => ({ x: PLATE_VIEW.left + 10 + index * 7, y: 10 - Math.min(index, 8) }));
}

/** Two ribbons entering from the page edges and meeting at the corner; height is the amount on one scale. */
export function ribbonHeights(upCents: number, downCents: number, room: number): { up: number; down: number } {
  const scale = pairScale(upCents, downCents, room);
  return { up: Math.max(0, upCents) * scale, down: Math.max(0, downCents) * scale };
}

/** Rulings printed across the floor band, evenly, so the eye reads the fill against ink and not against the perspective. */
export function floorRulings(count: number): number[] {
  if (count <= 0) return [];
  const gap = (PLATE_VIEW.right - PLATE_VIEW.left) / count;
  return Array.from({ length: count + 1 }, (_, index) => PLATE_VIEW.left + index * gap);
}
