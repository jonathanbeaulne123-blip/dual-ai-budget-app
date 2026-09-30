/**
 * `placeLabels()` (T3, pure): collision-aware placement for the board's DOM labels (PLAN §A "DOM labels").
 *
 * Priority: the piece ("We are here", ALWAYS placed — clamped inside the stage if its anchor is off it) → the
 * selection → overdue / needs-review → crossroads → chapter review → the next three → other commitments (added: a
 * bill outranks decoration) → milestone → income → plan → memory → month labels → district labels. A label that would overlap one already placed, or hang off the stage,
 * waits for a closer zoom (the list still carries it). Ties: nearer the camera first, then id (deterministic).
 * Placement never decides DOM/tab order — that stays chronological in the UI.
 */
import type { JourneyBoard } from "../contracts.ts";
import { isAttentionStop } from "./marks.ts";

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
};

const overlaps = (a: LabelBox, b: LabelBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const rankOrder = (r: LabelRank) => LABEL_PRIORITY.indexOf(r);

export function placeLabels(candidates: readonly LabelCandidate[], options: PlaceLabelsOptions): PlacedLabel[] {
  const { width, height } = options, lift = options.lift ?? 6, pad = options.pad ?? 2;
  const sorted = [...candidates].sort((a, b) =>
    rankOrder(a.rank) - rankOrder(b.rank) || (a.depth ?? 0) - (b.depth ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const taken: LabelBox[] = [...(options.obstacles ?? [])];
  const out = new Map<string, PlacedLabel>();
  for (const c of sorted) {
    const w = Math.min(c.width, width), h = Math.min(c.height, height);
    let box: LabelBox = { x0: c.x - w / 2 - pad, x1: c.x + w / 2 + pad, y0: c.y - lift - h - pad, y1: c.y - lift + pad };
    if (c.rank === "piece") {
      // Always placed: clamp inside the stage (pointing toward an off-stage piece), then take the space.
      const dx = box.x0 < 0 ? -box.x0 : box.x1 > width ? width - box.x1 : 0;
      const dy = box.y0 < 0 ? -box.y0 : box.y1 > height ? height - box.y1 : 0;
      box = { x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy };
      taken.push(box);
      out.set(c.id, { id: c.id, placed: true, box, rank: c.rank });
      continue;
    }
    const offStage = box.x0 < 0 || box.y0 < 0 || box.x1 > width || box.y1 > height;
    if (c.visible === false || offStage || taken.some((t) => overlaps(t, box))) {
      out.set(c.id, { id: c.id, placed: false, box: null, rank: c.rank });
      continue;
    }
    taken.push(box);
    out.set(c.id, { id: c.id, placed: true, box, rank: c.rank });
  }
  // Same order as the input (callers keep their own DOM order).
  return candidates.map((c) => out.get(c.id)!);
}


/**
 * The rank of a mark id on this board (piece, month ids, cluster / stop / crossroads ids, `district:<id>`, day dates).
 * A cluster takes the highest rank of its stops.
 */
export function labelRankFor(board: JourneyBoard, id: string, selectedId: string | null): LabelRank {
  if (id === "piece") return "piece";
  if (selectedId !== null && id === selectedId) return "selected";
  if (id.startsWith("district:")) return "district";
  if (board.chapters.some((c) => c.id === id)) return "month";
  if (board.crossroads.some((c) => c.id === id)) return "crossroads";
  const cluster = board.clusters.find((c) => c.id === id);
  const stops = cluster ? board.stops.filter((s) => cluster.stopIds.includes(s.id)) : board.stops.filter((s) => s.id === id);
  if (!stops.length) return "other";
  const ranks = stops.map((stop): LabelRank => {
    if (isAttentionStop(stop)) return "attention";
    if (stop.kind === "review" && stop.reviewKind === "chapter-close") return "chapter-review";
    if (board.summary.next.includes(stop.id)) return "next";
    if (stop.kind === "commitment") return "commitment";
    if (stop.kind === "milestone") return "milestone";
    if (stop.kind === "income") return "income";
    if (stop.kind === "plan") return "plan";
    if (stop.kind === "memory") return "memory";
    return "other";
  });
  return ranks.sort((a, b) => rankOrder(a) - rankOrder(b))[0]!;
}
