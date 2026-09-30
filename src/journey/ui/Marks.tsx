import { BRIDGE_GLYPHS } from '../land/bridgeGlyph';
/**
 * The board's DOM marks (T4): real `<button>`s over the aria-hidden canvas (or the flat SVG twin), one per piece,
 * month space, cluster, unclustered stop and crossroads, positioned at the anchors the stage reports each frame.
 *
 * - Hit area ≥ 44 × 44 px centred on the anchor; a label chip shows only where `placeLabels` found room (the
 *   button always carries its full words in `aria-label`, and the list carries everything).
 * - DOM (tab) order is chronological (date, then piece → month → kind), never screen position.
 * - A mark whose anchor is not drawn at this zoom or is off the stage is `hidden` (not tabbable); it is still in the list.
 * - Pressing a mark only SELECTS it (`onSelect`), which opens its panel: each mark says so with `aria-expanded` (its
 *   panel is the open one) and `aria-controls` (the board's panel slot), not `aria-pressed`. No mark runs an action.
 * - District names (`district:<id>` anchors, reported by the 3D scene at Sky and Region) are small, muted paper tags:
 *   `<span aria-hidden>`, never focusable, placed by `placeLabels` at the lowest priority (they yield to every mark).
 */
import type { CSSProperties } from "react";
import type { JourneyBoard, MarkAnchor, Stop } from "../contracts.ts";
import { isAttentionStop, labelRankFor, placeLabels, type LabelBox, type LabelCandidate } from "../board/index.ts";
import { districtName } from "../land/index.ts";
import { COPY, KIND_WORDS, shortDate } from "./copy.ts";

/** A mark id → a safe DOM id (`journey-mark-…`): every character outside [A-Za-z0-9-] becomes `_<hex>_`, so it is
 * unique, needs no CSS escaping and survives `querySelector('#…')`. */
export function journeyMarkDomId(id: string): string {
  return `journey-mark-${cssSafe(id)}`;
}
export function cssSafe(id: string): string {
  return id.replace(/[^A-Za-z0-9-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`);
}

export type MarkKind = "piece" | "month" | "cluster" | "stop" | "crossroads";
export type MarkEntry = { id: string; kind: MarkKind; date: string; order: number; label: string; aria: string; attention: boolean; stop?: Stop };

const KIND_ORDER: Record<MarkKind, number> = { piece: 0, month: 1, cluster: 2, stop: 3, crossroads: 4 };

const lastDay = (month: string) => {
  const n = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return `${month}-${String(n).padStart(2, "0")}`;
};


/**
 * The marks that get a button, in chronological DOM order. `words(id)` gives the list row's amount + status words
 * for a stop (the same words the panel and the list print).
 */
export function markEntries(board: JourneyBoard, words: (id: string) => { amount: string; status: string } | undefined): MarkEntry[] {
  const out: MarkEntry[] = [];
  const clustered = new Set(board.clusters.flatMap((c) => c.stopIds));
  const stopById = new Map(board.stops.map((s) => [s.id, s]));
  out.push({
    id: "piece", kind: "piece", date: board.piece.atDate, order: 0, label: COPY.weAreHere,
    aria: `${COPY.weAreHere} · ${shortDate(board.piece.atDate)} · ${board.summary.periodLabel}`, attention: false,
  });
  for (const c of board.chapters) {
    const attention = c.unresolved.attention;
    out.push({
      id: c.id, kind: "month", date: lastDay(c.id), order: 0, label: c.label.split(" ")[0] ?? c.label,
      aria: `${c.label} · ${c.state === "open" ? "this month" : c.state === "past" ? "past" : "upcoming"}${attention ? ` · ${attention} need${attention === 1 ? "s" : ""} attention` : ""}`,
      attention: attention > 0,
    });
  }
  for (const c of board.clusters) {
    const stops = c.stopIds.map((id) => stopById.get(id)).filter((s): s is Stop => Boolean(s));
    out.push({
      id: c.id, kind: "cluster", date: c.date, order: 0, label: c.label,
      aria: `${c.label}: ${stops.map((s) => s.label).join(", ")}`, attention: stops.some(isAttentionStop),
    });
  }
  for (const s of board.stops) {
    if (clustered.has(s.id)) continue;
    const w = words(s.id);
    const amount = w?.amount ? w.amount.split(" · ")[0] : "";
    out.push({
      id: s.id, kind: "stop", date: s.date, order: 0, stop: s,
      label: amount ? `${s.label} · ${amount}` : s.label,
      aria: [KIND_WORDS[s.kind], s.label, shortDate(s.date), w?.amount, w?.status].filter(Boolean).join(" · "),
      attention: isAttentionStop(s),
    });
  }
  for (const x of board.crossroads) {
    out.push({ id: x.id, kind: "crossroads", date: x.date, order: 0, label: x.label, aria: `Crossroads · ${x.label} · ${shortDate(x.date)}`, attention: false });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  out.forEach((e, i) => { e.order = i; });
  return out;
}

const clamp = (v: number, lo: number, hi: number) => (hi < lo ? v : Math.min(hi, Math.max(lo, v)));

/** Estimated chip size (px): layout reads per frame would thrash; the chip's CSS keeps to this box. */
export function chipSize(label: string): { width: number; height: number } {
  return { width: Math.min(222, Math.max(44, Math.round(label.length * 7.4 + 22))), height: 26 };
}

/** A district tag's box (px): 11 px type, lighter than a mark's chip. */
export function districtChipSize(label: string): { width: number; height: number } {
  return { width: Math.min(200, Math.round(label.length * 6.6 + 16)), height: 20 };
}
const DISTRICT_PREFIX = "district:";
/** The gap `placeLabels` leaves between an anchor and its label (a district tag is centred on its anchor instead). */
const LABEL_LIFT = 18;

export type MarksProps = {
  board: JourneyBoard;
  entries: MarkEntry[];
  anchors: readonly MarkAnchor[];
  size: { width: number; height: number };
  selectedId: string | null;
  /** Stage regions covered by chrome (summary card, toolbar, panel). */
  obstacles?: readonly LabelBox[];
  onSelect(id: string): void;
  /** Where the "Preview" tag stands while a crossroads alternative is previewed (3D only). */
  previewTag?: string | null;
  /** The DOM id of the board's panel slot (each mark opens its panel there). */
  panelId?: string;
};

export function Marks({ board, entries, anchors, size, selectedId, obstacles, onSelect, previewTag, panelId }: MarksProps) {
  const byId = new Map(anchors.map((a) => [a.id, a] as const));
  const candidates: LabelCandidate[] = [];
  for (const e of entries) {
    const a = byId.get(e.id);
    if (!a || !a.visible) continue;
    const chip = chipSize(e.label);
    candidates.push({ id: e.id, x: a.x, y: a.y, width: chip.width, height: chip.height, depth: a.depth, visible: a.visible, rank: labelRankFor(board, e.id, selectedId) });
  }
  // District names: centred on the district's heart (the candidate's anchor is dropped by the lift + half a tag).
  const districts: { id: string; label: string; x: number; y: number }[] = [];
  for (const a of anchors) {
    if (!a.id.startsWith(DISTRICT_PREFIX) || !a.visible) continue;
    const label = districtName(a.id.slice(DISTRICT_PREFIX.length));
    const chip = districtChipSize(label);
    districts.push({ id: a.id, label, x: a.x, y: a.y });
    candidates.push({ id: a.id, x: a.x, y: a.y + LABEL_LIFT + chip.height / 2, width: chip.width, height: chip.height, depth: a.depth, visible: true, rank: "district" });
  }
  const bridges=anchors.filter(a=>a.bridge&&a.visible);
  for(const a of bridges){const chip=chipSize(a.bridge!.name);candidates.push({id:a.id,x:a.x,y:a.y,width:chip.width+30,height:30,depth:a.depth,visible:true,rank:"bridge"});}
  const placed = new Map(placeLabels(candidates, { width: size.width, height: size.height, obstacles, lift: LABEL_LIFT }).map((p) => [p.id, p] as const));
  const preview = previewTag ? byId.get(previewTag) : undefined;
  return (
    <div className="journey-marks" data-mark-count={entries.length}>
      {entries.map((e) => {
        const a = byId.get(e.id);
        const shown = Boolean(a && (a.visible || e.id === "piece"));
        const labelled = Boolean(placed.get(e.id)?.placed);
        // The piece never leaves the stage: off-stage it waits at the nearest edge, pointing the way back.
        const x = a ? (e.id === "piece" ? clamp(a.x, 24, size.width - 24) : a.x) : 0;
        const y = a ? (e.id === "piece" ? clamp(a.y, 24, size.height - 24) : a.y) : 0;
        const style: CSSProperties | undefined = a ? { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, zIndex: e.id === selectedId ? 3000 : e.kind === "piece" ? 2500 : Math.max(1, 2000 - Math.round(a.depth / 4)) } : undefined;
        return (
          <button
            key={e.id}
            type="button"
            id={journeyMarkDomId(e.id)}
            className={[
              "journey-mark", `journey-mark--${e.kind}`, e.stop ? `journey-mark--${e.stop.kind}` : "",
              e.attention ? "journey-mark--attention" : "", labelled ? "journey-mark--labelled" : "", e.id === selectedId ? "is-selected" : "",
              a && !a.visible ? "journey-mark--offstage" : "",
            ].filter(Boolean).join(" ")}
            data-mark-id={e.id}
            data-mark-kind={e.kind}
            hidden={!shown}
            aria-label={e.aria}
            aria-expanded={e.id === selectedId}
            aria-controls={panelId}
            style={style}
            onClick={() => onSelect(e.id)}
          >
            <span className="journey-mark__hit" aria-hidden="true" />
            {labelled ? <span className="journey-mark__label" aria-hidden="true">{e.label}</span> : null}
          </button>
        );
      })}
      {bridges.map(a=>placed.get(a.id)?.placed?<span key={a.id} className="journey-bridge-label" data-bridge-id={a.id.slice(7)} style={{transform:`translate(${a.x}px, ${a.y-LABEL_LIFT}px) translate(-50%,-100%)`}}>
        <svg viewBox="0 0 64 32" aria-hidden="true"><path d={BRIDGE_GLYPHS[a.bridge!.glyph]}/></svg>{a.bridge!.name}
      </span>:null)}
      {districts.map((d) => placed.get(d.id)?.placed ? (
        <span key={d.id} className="journey-district" data-district-id={d.id.slice(DISTRICT_PREFIX.length)} aria-hidden="true" style={{ transform: `translate(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px) translate(-50%, -50%)` }}>{d.label}</span>
      ) : null)}
      {preview ? (
        <span className="journey-mark__preview-tag" aria-hidden="true" style={{ transform: `translate(${preview.x.toFixed(1)}px, ${preview.y.toFixed(1)}px)` }}>{COPY.previewPrefix}</span>
      ) : null}
    </div>
  );
}
