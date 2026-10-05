/**
 * `placeLabels()` (pure): collision-aware placement for the map's DOM callouts, at most `MAP_LABEL_LIMIT` (today, the
 * next leaving, the selection — `mapLabels`). The piece ("We are here") is ALWAYS placed, clamped inside the stage;
 * a label that would overlap one already placed, or hang off the stage, is left out (the list still carries it).
 * Ties: rank, then nearer the camera, then id (deterministic). Placement never decides DOM/tab order.
 */
import type { JourneyBoard } from "../contracts.ts";

export type LabelRank =
  | "piece" | "selected" | "attention" | "crossroads" | "chapter-review" | "next" | "commitment" | "milestone" | "income" | "plan" | "memory"
  | "month" | "bridge" | "district" | "other";
export const LABEL_PRIORITY: readonly LabelRank[] = [
  "piece", "selected", "attention", "crossroads", "chapter-review", "next", "commitment", "milestone", "income", "plan", "memory", "month", "bridge", "district", "other",
];

export type LabelBox = { x0: number; y0: number; x1: number; y1: number };
export type LabelCandidate = {
  id: string;
  /** Anchor in stage px (the label sits centred above it). */
  x: number;
  y: number;
  width: number;
  height: number;
  rank: LabelRank;
  /** Camera distance; nearer wins a tie. */
  depth?: number;
  /** False = the anchor is not drawn at this tier / is behind the camera; only the piece is placed anyway. */
  visible?: boolean;
};
export type PlacedLabel = { id: string; placed: boolean; box: LabelBox | null; rank: LabelRank };
export type PlaceLabelsOptions = {
  width: number;
  height: number;
  /** Stage regions already taken (summary card, chapter strip, panel): no label may overlap them. */
  obstacles?: readonly LabelBox[];
  /** Gap between the anchor and the label's bottom edge (px). */
  lift?: number;
  /** Padding kept around every label (px). */
  pad?: number;
  /**
   * Horizon Clock: at most this many labels are placed (the piece always counts first). The map passes
   * `MAP_LABEL_LIMIT` (3: today, next leaving, selected); omitted = no limit.
   */
  limit?: number;
};

const overlaps = (a: LabelBox, b: LabelBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const rankOrder = (r: LabelRank) => LABEL_PRIORITY.indexOf(r);

export function placeLabels(candidates: readonly LabelCandidate[], options: PlaceLabelsOptions): PlacedLabel[] {
  const { width, height } = options, lift = options.lift ?? 6, pad = options.pad ?? 2;
  const sorted = [...candidates].sort((a, b) =>
    rankOrder(a.rank) - rankOrder(b.rank) || (a.depth ?? 0) - (b.depth ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const taken: LabelBox[] = [...(options.obstacles ?? [])];
  const out = new Map<string, PlacedLabel>();
  const limit = options.limit ?? Infinity;
  let count = 0;
  for (const c of sorted) {
    if (count >= limit) { out.set(c.id, { id: c.id, placed: false, box: null, rank: c.rank }); continue; }
    const w = Math.min(c.width, width), h = Math.min(c.height, height);
    let box: LabelBox = { x0: c.x - w / 2 - pad, x1: c.x + w / 2 + pad, y0: c.y - lift - h - pad, y1: c.y - lift + pad };
    if (c.rank === "piece") {
      // Always placed: clamp inside the stage (pointing toward an off-stage piece), then take the space.
      const dx = box.x0 < 0 ? -box.x0 : box.x1 > width ? width - box.x1 : 0;
      const dy = box.y0 < 0 ? -box.y0 : box.y1 > height ? height - box.y1 : 0;
      box = { x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy };
      taken.push(box);
      count += 1;
      out.set(c.id, { id: c.id, placed: true, box, rank: c.rank });
      continue;
    }
    const offStage = box.x0 < 0 || box.y0 < 0 || box.x1 > width || box.y1 > height;
    if (c.visible === false || offStage || taken.some((t) => overlaps(t, box))) {
      out.set(c.id, { id: c.id, placed: false, box: null, rank: c.rank });
      continue;
    }
    taken.push(box);
    count += 1;
    out.set(c.id, { id: c.id, placed: true, box, rank: c.rank });
  }
  // Same order as the input (callers keep their own DOM order).
  return candidates.map((c) => out.get(c.id)!);
}


// ---------------------------------------------------------------------------------------------------------------------
// Horizon Clock: the map's callouts. Max three, as in the approved prototype: today, the next leaving, the selected.
// Everything else is printed on the tiles / carried by the list; the canvas never draws text.

export const MAP_LABEL_LIMIT = 3;
export type MapLabelRole = "today" | "next" | "selected";
export type MapLabel = { id: string; role: MapLabelRole; rank: LabelRank };

/**
 * The (≤ 3) mark ids that get a callout at a level, in priority order. Month: the bus ("piece", today's chapter only),
 * the next leaving stop (`digest.nextLeavingStopId`, today's chapter only), the selection. Week: today's tile (its
 * date), the next leaving stop's tile, the selection. Year: none (each mini's own button carries its words).
 * Pure; it reads the board only and never selects or opens anything.
 */
export function mapLabels(board: JourneyBoard, level: "year" | "month" | "week", chapterId: string, selectedId: string | null): MapLabel[] {
  if (level === "year") return [];
  const out: MapLabel[] = [];
  const push = (id: string | null | undefined, role: MapLabelRole, rank: LabelRank) => {
    if (id && !out.some((l) => l.id === id) && out.length < MAP_LABEL_LIMIT) out.push({ id, role, rank });
  };
  const next = board.digest?.nextLeavingStopId ?? null;
  if (level === "month") {
    const own = chapterId === board.currentChapterId;
    if (own) push("piece", "today", "piece");
    if (own && next) push(next, "next", "next");
  } else {
    push(board.today, "today", "piece");
    const nextDay = next ? board.week?.days.find((d) => d.stopIds.includes(next))?.date : undefined;
    if (nextDay && nextDay !== board.today) push(nextDay, "next", "next");
  }
  push(selectedId, "selected", "selected");
  return out;
}
