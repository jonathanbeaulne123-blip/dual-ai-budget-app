/**
 * The map's DOM marks (L4): one real `<button>` per `mapMarks()` entry over the aria-hidden canvas (live) or as the
 * flat map's own glyphs (no WebGL). Every hit area is ≥ 44 × 44 px; tab order is date order, never screen position.
 *
 * - Live: a mark stands at the scene's anchor for its own id, else at the first visible anchor of an id it covers
 *   (a stop on that day). A mark with no visible anchor is `hidden` (not tabbable) — it is still in the list.
 * - Flat: a mark stands where `mapLayout` puts it (`projectFlat`), and draws its slot / tile / mini as CSS.
 * - Callouts (UX #4, the prototype's rule): Month shows Today and the next stop leaving (or being set aside) plus the
 *   selection; Week shows Today ONLY at rest — the next stop's callout appears when its day is selected. They are
 *   placed by a search around the mark, clear of each other, the chrome and the other marks, with a leader line, and
 *   are never cut mid-word (the line is shortened instead). Every mark carries its full words in `aria-label`.
 * - Plates: the Week prints each day's tag ON its tile ("WED 30 · $300") at the scene's `face:<date>` anchor; the
 *   Year's twelve minis carry two-line plates (month + to-check count, then what is on the map), the open month
 *   outlined (`is-focused`).
 * - Hit areas: 44 px, shrunk to the spacing between neighbouring day marks where the clock is tighter (never below
 *   24 px, WCAG 2.5.8), so no two day buttons overlap; where flat marks still overlap a press asks "Which one?".
 * - Pressing a mark only SELECTS it (`onSelect`). No mark runs an action.
 */
import type { CSSProperties, MouseEvent } from "react";
import type { JourneyBoard, JourneyLevel, ListRow, MarkAnchor, Stop, YearChapter } from "../contracts.ts";
import { JOURNEY_MAP_MARKS } from "../contracts.ts";
import { knownCents, MAP_WORDS, shortDate } from "../model/index.ts";
import { COPY, money, shortMonth } from "./copy.ts";
import type { MapMark } from "./mapLayout.ts";
import { isSettingAside, SHIM_WORDS } from "./mergeShim.ts";

/** A mark id → a safe DOM id (`journey-mark-…`): every character outside [A-Za-z0-9-] becomes `_<hex>_`. */
export function journeyMarkDomId(id: string): string {
  return `journey-mark-${cssSafe(id)}`;
}
export function cssSafe(id: string): string {
  return id.replace(/[^A-Za-z0-9-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`);
}

export type PlacedMark = { mark: MapMark; x: number; y: number; visible: boolean };

/** Where each mark stands this frame. `flatAt` gives the flat position; live marks follow the scene's anchors. */
export function placeMarks(marks: readonly MapMark[], anchors: readonly MarkAnchor[] | null, flatAt: (m: MapMark) => { x: number; y: number }): PlacedMark[] {
  if (!anchors) return marks.map((mark) => ({ mark, ...flatAt(mark), visible: true }));
  const byId = new Map(anchors.map((a) => [a.id, a] as const));
  return marks.map((mark) => {
    const own = byId.get(mark.id);
    const a = own && own.visible ? own : mark.covers.map((id) => byId.get(id)).find((x) => x && x.visible) ?? own;
    return a ? { mark, x: a.x, y: a.y, visible: a.visible } : { mark, x: 0, y: 0, visible: false };
  });
}

export type Callout = { id: string; kind: "today" | "next" | "selected"; title: string; small: string };

/** "$1,850" for whole dollars, "$79.55" otherwise: a printed figure, never rounded (face tags, plates). */
export function tagMoney(cents: number): string {
  const abs = Math.abs(cents) / 100;
  const body = (Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${cents < 0 ? "−" : ""}$${body}`;
}
/** The subject of a stop's label for a callout ("Standing · jar · Winter reserve" → "Winter reserve"); aria keeps it all. */
export const subjectOf = (label: string) => label.split(" · ").at(-1) ?? label;
const amountOf = (stop: Stop | undefined, rows: Map<string, ListRow>) => (stop ? rows.get(stop.id)?.amountText.split(" · ")[0] ?? "" : "");

function nextCallout(rows: Map<string, ListRow>, next: Stop): Callout {
  const word = isSettingAside(next) ? SHIM_WORDS.settingAsideNext : COPY.leavingNext;
  return { id: next.date, kind: "next", title: `${word} · ${subjectOf(next.label)}`, small: [amountOf(next, rows), shortDate(next.date)].filter(Boolean).join(" · ") };
}

/**
 * The callouts: Today; the next stop leaving / being set aside (Month at rest; Week only when its day is selected);
 * the selection. Deduplicated (Today wins its own mark); at most three.
 */
export function callouts(board: JourneyBoard, marks: readonly MapMark[], rows: Map<string, ListRow>, selected: string | null, level: JourneyLevel): Callout[] {
  if (level === "year") return [];
  const out: Callout[] = [];
  const has = (id: string) => marks.some((m) => m.id === id);
  const todayMark = has(board.today) ? board.today : null;
  if (todayMark) {
    const n = board.stops.filter((s) => s.date === board.today).length;
    const pay = board.purse.expectedToday.length ? "pay expected · " : "";
    out.push({ id: todayMark, kind: "today", title: `${COPY.today} · ${shortDate(board.today)}`, small: n ? `${pay}${n === 1 ? "1 thing" : `${n} things`}` : MAP_WORDS.nothingOnThisDay });
  }
  const next = board.digest.nextLeavingStopId ? board.stops.find((s) => s.id === board.digest.nextLeavingStopId) : undefined;
  const selMark = selected ? marks.find((x) => x.id === selected || (x.kind === "day" && x.covers.includes(selected))) : undefined;
  const nextSelected = Boolean(next && selMark && selMark.date === next.date);
  if (next && has(next.date) && next.date !== todayMark && (level === "month" || nextSelected)) out.push(nextCallout(rows, next));
  if (selMark && (selMark.kind === "day" || selMark.kind === "piece") && !out.some((c) => c.id === selMark.id)) {
    const stops = board.stops.filter((s) => selMark.covers.includes(s.id));
    const first = stops[0];
    const title = stops.length > 1 ? `${selMark.date ? shortDate(selMark.date) : ""} · ${stops.length} things`.replace(/^ · /, "") : first ? subjectOf(first.label) : selMark.date ? shortDate(selMark.date) : selMark.id;
    const small = stops.length === 1 && first ? [amountOf(first, rows), shortDate(first.date)].filter(Boolean).join(" · ") : stops.map((s) => subjectOf(s.label)).join(" · ");
    out.push({ id: selMark.id, kind: "selected", title, small });
  }
  return out.slice(0, 3);
}

type Box = { x0: number; x1: number; y0: number; y1: number };
const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
/** Estimated callout box (px): reading layout per frame would thrash; the CSS keeps to this size (nowrap, no ellipsis). */
export function calloutSize(c: Callout, narrow = false): { width: number; height: number } {
  const longest = narrow ? Math.max(c.title.length * 6.7, c.small.length * 5.6) : Math.max(c.title.length * 7.4, c.small.length * 6.1);
  return { width: Math.max(90, Math.round(longest + (narrow ? 20 : 26))), height: c.small ? (narrow ? 40 : 44) : 30 };
}

export type CalloutSpot = { id: string; x: number; y: number; ax: number; ay: number };
/**
 * Each callout near its mark (the prototype's search: 24 directions × 7 distances), scored by overlap with the chrome,
 * earlier callouts and the other marks, by leaving the stage, by distance, and a small bias for "above". Pure.
 */
export function placeCallouts(list: readonly Callout[], at: Map<string, { x: number; y: number }>, stage: { width: number; height: number }, obstacles: readonly Box[] = [], marks: readonly Box[] = [], tags: readonly Box[] = []): CalloutSpot[] {
  const busy: Box[] = [...obstacles];
  const placedCallouts: Box[] = [];
  const out: CalloutSpot[] = [];
  const narrow = stage.width < 360;
  for (const c of list) {
    const p = at.get(c.id);
    if (!p) continue;
    const { width, height } = calloutSize(c, narrow);
    const own = (b: Box) => !(p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1);
    const others = marks.filter(own);
    let best: { pen: number; x: number; y: number } | null = null;
    for (let k = 0; k < 24; k += 1) {
      const ang = (k / 24) * Math.PI * 2;
      for (const dist of [40, 64, 96, 136, 190, 260, 330]) {
        const x = p.x + Math.cos(ang) * (width / 2 + dist * 0.5), y = p.y + Math.sin(ang) * (height / 2 + dist * 0.45) - 10;
        const R = { x0: x - width / 2 - 4, x1: x + width / 2 + 4, y0: y - height / 2 - 4, y1: y + height / 2 + 4 };
        let pen = 0;
        // Chrome (header, purse, bubble, dock) is never covered when the map has room: weigh it above the island.
        for (const o of busy) pen += area(R, o) * 4;
        // Two callouts never cover each other; a printed tag (a Week tile's face) is not covered either.
        for (const o of placedCallouts) pen += area(R, o) * 30;
        for (const o of tags) pen += area(R, o) * 3;
        for (const o of others) pen += area(R, o) * 0.6;
        if (R.x0 < 6) pen += (6 - R.x0) * 400;
        if (R.x1 > stage.width - 6) pen += (R.x1 - stage.width + 6) * 400;
        if (R.y0 < 4) pen += (4 - R.y0) * 400;
        if (R.y1 > stage.height - 4) pen += (R.y1 - stage.height + 4) * 400;
        pen += dist * 3 + (Math.sin(ang) > 0.2 ? 40 : 0);
        if (!best || pen < best.pen) best = { pen, x, y };
      }
    }
    const b = best!;
    placedCallouts.push({ x0: b.x - width / 2 - 4, x1: b.x + width / 2 + 4, y0: b.y - height / 2 - 4, y1: b.y + height / 2 + 4 });
    out.push({ id: c.id, x: b.x, y: b.y, ax: p.x, ay: p.y });
  }
  return out;
}

/** A plate is centred under its mark; near the stage's edge, shift it (by its estimated width) so its words stay on screen. */
function plateNudge(plate: string, small: string | null, x: number, width: number): CSSProperties | undefined {
  const half = Math.min(180, Math.max(plate.length * 7, (small?.length ?? 0) * 6) + 20) / 2;
  const dx = Math.max(0, half + 6 - x) - Math.max(0, x + half + 6 - width);
  return dx ? ({ "--plate-dx": `${Math.round(dx)}px` } as CSSProperties) : undefined;
}

/** The words a mark says to a screen reader (and the Year / Week name plates). */
export function markWords(board: JourneyBoard, mark: MapMark, rows: Map<string, ListRow>, year?: YearChapter, focusChapter?: string): { aria: string; plate: string | null; plateSmall: string | null } {
  const stops = board.stops.filter((s) => mark.covers.includes(s.id));
  const stopWords = stops.map((s) => [s.label, rows.get(s.id)?.amountText, rows.get(s.id)?.statusText].filter(Boolean).join(" · ")).join("; ");
  const cross = board.crossroads.filter((c) => mark.covers.includes(c.id)).map((c) => `${COPY.crossroads} · ${c.label}`);
  const all = [stopWords, ...cross].filter(Boolean).join("; ");
  switch (mark.kind) {
    case "piece": return { aria: `${COPY.today} · ${shortDate(board.today)}${all ? `: ${all}` : ` · ${MAP_WORDS.nothingOnThisDay}`}`, plate: null, plateSmall: null };
    case "hercules": return { aria: `Hercules · ${COPY.herculesList} · ${MAP_WORDS.toCheckCount(board.toCheck.length)}`, plate: null, plateSmall: null };
    case "pile": return { aria: `${MAP_WORDS.checklist.toCheck} · ${board.week.pileStopIds.length} · ${MAP_WORDS.checklist.pinnedNote}`, plate: `${board.week.pileStopIds.length} !`, plateSmall: null };
    case "chapter": {
      const y = year;
      const name = shortMonth(mark.id);
      const parts = y ? [
        y.outRecordedCents ? `Out ${money(y.outRecordedCents)} · ${MAP_WORDS.stack.solid}` : null,
        y.outOpenCents ? `Out ${money(y.outOpenCents)} · ${MAP_WORDS.stack.seeThrough}` : null,
        y.inRecordedCents ? `In +${money(y.inRecordedCents)} · ${MAP_WORDS.stack.solid}` : null,
        y.inOpenCents ? `In +${money(y.inOpenCents)} · ${MAP_WORDS.stack.seeThrough}` : null,
        y.unknownAmounts ? MAP_WORDS.strip.stillToComeUnknown(y.unknownAmounts) : null,
      ].filter((p): p is string => Boolean(p)) : [];
      // Two lines on every plate (B2, UX #9): the month and its to-check count, then the stack's figures — the bills on
      // the map that month, recorded (●) and not recorded (○) printed apart, never summed; the Year caption keys the
      // glyphs in words, and the open month spells them out — or that nothing is on the map.
      const open = mark.id === focusChapter;
      const small = !stops.length ? COPY.plateNothing : y ? [
        y.outRecordedCents ? (open ? `${tagMoney(y.outRecordedCents)} ${MAP_WORDS.stack.solid}` : `● ${tagMoney(y.outRecordedCents)}`) : null,
        y.outOpenCents ? (open ? `${tagMoney(y.outOpenCents)} ${MAP_WORDS.stack.seeThrough}` : `○ ${tagMoney(y.outOpenCents)}`) : null,
      ].filter(Boolean).join(open ? " · " : "  ") || null : null;
      return {
        aria: [`${name} ${mark.id.slice(0, 4)}`, y?.toCheck ? MAP_WORDS.toCheckCount(y.toCheck) : null, ...(stops.length ? parts : [MAP_WORDS.nothingOnTheMap]), y?.kept ? "Chapter kept" : null].filter(Boolean).join(" · "),
        plate: y && y.toCheck ? `${name} · ${MAP_WORDS.toCheckCount(y.toCheck)}` : name, plateSmall: small,
      };
    }
    case "day": {
      const date = mark.date!;
      const cents = stops.map((s) => knownCents(s)).filter((c): c is number => c !== null && c !== 0);
      const dayWords = `${shortDate(date).slice(0, 6).trim()}`.toUpperCase();
      // The face tag printed on the tile (Week): "MON 28 · TODAY", "WED 30 · $300"; an empty day is just its day.
      const face = date === board.today ? `${dayWords} · ${COPY.today.toUpperCase()}` : cents.length === 1 ? `${dayWords} · ${tagMoney(cents[0]!)}` : stops.length > 1 ? `${dayWords} · ${stops.length}` : dayWords;
      return {
        aria: `${shortDate(date)}${date === board.today ? ` · ${COPY.today}` : ""}${mark.toCheck ? ` · ${MAP_WORDS.checklist.toCheck}` : ""}: ${all || MAP_WORDS.nothingOnThisDay}`,
        plate: face,
        plateSmall: null,
      };
    }
  }
}

export type MarksProps = {
  board: JourneyBoard;
  level: JourneyLevel;
  placed: readonly PlacedMark[];
  rows: Map<string, ListRow>;
  selectedId: string | null;
  focusedDate: string | null;
  /** The chapter the map is on (Year: the open mini is outlined, UX #8). */
  chapterId?: string;
  flat: boolean;
  /** px per diorama unit on the flat map (sizes the glyphs). */
  unit: number;
  stage: { width: number; height: number };
  obstacles?: readonly Box[];
  /** Decorative anchors from the scene (`face:<date>`: where a Week tile's face tag is printed). */
  decor?: ReadonlyMap<string, { x: number; y: number }>;
  /** The keyboard's focused day where no mark stands (live): a ring is drawn there (UX #13). */
  focusAnchor?: { x: number; y: number } | null;
  sheetId?: string;
  onSelect(id: string, from: HTMLElement): void;
  /** A flat press over overlapping marks: every id under the press (the view asks "Which one?"). */
  onPickMany?(ids: string[], at: { x: number; y: number }): void;
};

const MARK_MAX = 44, MARK_MIN = 24;
/**
 * Each day mark's hit size (UX #12): 44 px unless that would overlap a neighbour's box, then shrunk to fit — never
 * below 24 px (WCAG 2.5.8). Greedy by importance (today, then days with stops, then empty days), so today and money
 * days keep their full size and stepping stones give way.
 */
export function markSizes(placed: readonly PlacedMark[]): Map<string, number> {
  const rank = (p: PlacedMark) => (p.mark.covers.includes(JOURNEY_MAP_MARKS.piece) ? 0 : p.mark.covers.length ? 1 : 2);
  const days = placed.filter((p) => p.visible && p.mark.kind === "day").sort((a, b) => rank(a) - rank(b));
  const out = new Map<string, number>();
  const done: { x: number; y: number; half: number }[] = [];
  for (const a of days) {
    let half = MARK_MAX / 2;
    for (const b of done) {
      const gap = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      half = Math.min(half, gap - b.half);
    }
    const size = Math.round(Math.max(MARK_MIN, Math.min(MARK_MAX, half * 2)));
    out.set(a.mark.id, size);
    done.push({ x: a.x, y: a.y, half: size / 2 });
  }
  return out;
}

export function Marks({ board, level, placed, rows, selectedId, focusedDate, focusAnchor, chapterId, flat, stage, obstacles, decor, sheetId, onSelect, onPickMany }: MarksProps) {
  const visible = placed.filter((p) => p.visible);
  const visibleMarks = visible.map((p) => p.mark);
  const list = callouts(board, visibleMarks, rows, selectedId, level);
  const at = new Map(visible.map((p) => [p.mark.id, { x: p.x, y: p.y }] as const));
  const sizes = markSizes(placed);
  const sizeOf = (p: PlacedMark) => (p.mark.kind === "day" ? sizes.get(p.mark.id) ?? MARK_MAX : p.mark.kind === "chapter" && !flat ? 64 : MARK_MAX);
  // Other marks' footprints the callouts keep clear of (a Week tile reaches below its anchor).
  const markBoxes: Box[] = visible.map((p) => level === "week" && p.mark.kind === "day"
    ? { x0: p.x - (p.mark.covers.length ? 46 : 22), x1: p.x + (p.mark.covers.length ? 46 : 22), y0: p.y - 14, y1: p.y + (p.mark.covers.length ? 58 : 24) }
    : { x0: p.x - 20, x1: p.x + 20, y0: p.y - 20, y1: p.y + 20 });
  // Week face tags, as printed boxes the callouts keep off.
  const tagBoxes: Box[] = level === "week" && decor ? visible.flatMap((p) => {
    const f = p.mark.date ? decor.get(`face:${p.mark.date}`) : undefined;
    if (!f) return [];
    const w = (markWords(board, p.mark, rows).plate?.length ?? 6) * 7 + 16;
    return [{ x0: f.x - w / 2, x1: f.x + w / 2, y0: f.y - 11, y1: f.y + 11 }];
  }) : [];
  const spots = new Map(placeCallouts(list, at, stage, obstacles, markBoxes, tagBoxes).map((s) => [s.id, s] as const));
  const yearById = new Map(board.year.map((y) => [y.chapterId, y] as const));
  // Year plates stand centred on their mini's anchor; on a phone they lean out from the ring's centre (the prototype).
  const minis = visible.filter((p) => p.mark.kind === "chapter");
  const ring = minis.length ? { x: minis.reduce((a, p) => a + p.x, 0) / minis.length, y: minis.reduce((a, p) => a + p.y, 0) / minis.length } : null;
  /** Where a Year plate stands: phone = the prototype's lean outward from the ring's centre; always clamped on stage. */
  const yearPlace = (p: PlacedMark, plate: string, small: string | null): CSSProperties => {
    const c = decor?.get(`centre:${p.mark.id}`);
    let tx = p.x, ty = p.y;
    if (ring && stage.width < 720 && c) {
      const dx = c.x - ring.x, dy = c.y - ring.y, d = Math.hypot(dx, dy) || 1;
      tx = c.x + (dx / d) * 34; ty = c.y + (dy / d) * 30 + 14;
    }
    const half = Math.max(plate.length * 6.6, (small?.length ?? 0) * 5.4) / 2 + 10;
    tx = Math.min(Math.max(tx, half + 6), stage.width - half - 6);
    return { "--plate-x": `${(tx - p.x).toFixed(1)}px`, "--plate-y": `${(ty - p.y).toFixed(1)}px` } as CSSProperties;
  };
  const press = (p: PlacedMark, e: MouseEvent<HTMLButtonElement>) => {
    // Flat marks whose boxes still overlap under the press: ask which one (never guess the topmost).
    if (flat && onPickMany && e.clientX && e.clientY) {
      const host = e.currentTarget.parentElement?.getBoundingClientRect();
      const x = e.clientX - (host?.left ?? 0), y = e.clientY - (host?.top ?? 0);
      const under = visible.filter((q) => { const h = sizeOf(q) / 2; return Math.abs(q.x - x) <= h && Math.abs(q.y - y) <= h; });
      if (under.length > 1) { onPickMany(under.map((q) => q.mark.id), { x, y }); return; }
    }
    onSelect(p.mark.id, e.currentTarget);
  };
  return (
    <div className={["journey-marks", flat ? "journey-marks--flat" : "journey-marks--live", `journey-marks--${level}`].join(" ")} data-mark-count={placed.length}>
      {focusAnchor && !visible.some((p) => p.mark.date === focusedDate) ? (
        <span className="journey-focus-ring" aria-hidden="true" data-focus-ring="" style={{ transform: `translate(${focusAnchor.x.toFixed(1)}px, ${focusAnchor.y.toFixed(1)}px)` }} />
      ) : null}
      {list.length ? (
        <svg className="journey-leaders" width={stage.width} height={stage.height} aria-hidden="true">
          {list.map((c) => {
            const sp = spots.get(c.id);
            return sp ? <g key={c.id}><line x1={sp.ax} y1={sp.ay} x2={sp.x} y2={sp.y} /><circle cx={sp.ax} cy={sp.ay} r={3.5} /></g> : null;
          })}
        </svg>
      ) : null}
      {placed.map((p) => {
        const { mark, x, y, visible: shown } = p;
        const words = markWords(board, mark, rows, yearById.get(mark.id), chapterId);
        const size = sizeOf(p);
        const style = { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, ...(size !== MARK_MAX && mark.kind === "day" ? { "--mark": `${size}px` } : {}) } as CSSProperties;
        const weekDay = level === "week" && mark.kind === "day";
        const showPlate = level === "year" || weekDay || (flat && mark.kind === "pile");
        // Week: the tag stands on the tile's face (the scene's `face:<date>` anchor); flat: under the disc.
        const face = weekDay && mark.date ? decor?.get(`face:${mark.date}`) : undefined;
        const yearPlate = level === "year" && mark.kind === "chapter";
        const plateStyle: CSSProperties | undefined = face
          ? ({ "--plate-x": `${(face.x - x).toFixed(1)}px`, "--plate-y": `${(face.y - y).toFixed(1)}px` } as CSSProperties)
          : yearPlate ? yearPlace(p, words.plate ?? "", words.plateSmall)
          : plateNudge(words.plate ?? "", words.plateSmall, x, stage.width);
        const ring = mark.toCheck && mark.kind !== "hercules" ? (mark.kind === "pile" ? `${mark.covers.length} !` : "!") : null;
        return (
          <button
            key={mark.id}
            type="button"
            id={journeyMarkDomId(mark.id)}
            className={[
              "journey-mark", `journey-mark--${mark.kind}`, `journey-mark--money-${mark.money}`,
              mark.recorded ? "journey-mark--recorded" : "", mark.toCheck ? "journey-mark--check" : "",
              mark.date === board.today ? "journey-mark--today" : "", mark.id === selectedId ? "is-selected" : "",
              mark.date && mark.date === focusedDate ? "is-focused" : "", mark.covers.length === 0 && mark.kind === "day" ? "journey-mark--quiet" : "",
              mark.kind === "chapter" && mark.id === board.currentChapterId ? "journey-mark--current" : "",
              mark.kind === "chapter" && mark.id === chapterId ? "is-focused journey-mark--open" : "",
              mark.kind === "chapter" && !mark.covers.length ? "journey-mark--empty" : "",
              weekDay && !mark.covers.length ? "journey-mark--stone" : "",
            ].filter(Boolean).join(" ")}
            data-mark-id={mark.id}
            data-mark-kind={mark.kind}
            hidden={!shown}
            aria-label={words.aria}
            aria-expanded={mark.id === selectedId}
            aria-controls={sheetId}
            style={style}
            onClick={(e) => press(p, e)}
          >
            <span className="journey-mark__hit" aria-hidden="true" />
            {ring ? <span className="journey-mark__ring" aria-hidden="true">{ring}</span> : null}
            {showPlate && words.plate ? (
              <span className={["journey-mark__plate", face ? "journey-mark__plate--face" : "", yearPlate ? "journey-mark__plate--year" : ""].filter(Boolean).join(" ")} aria-hidden="true" data-plate={mark.id} style={plateStyle}>{words.plate}{words.plateSmall ? <small>{words.plateSmall}</small> : null}</span>
            ) : null}
          </button>
        );
      })}
      {list.map((c) => {
        const s = spots.get(c.id);
        if (!s) return null;
        return (
          <span key={`callout-${c.id}`} className={`journey-callout journey-callout--${c.kind}`} data-callout={c.kind} aria-hidden="true" style={{ transform: `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -50%)` }}>
            {c.title}{c.small ? <small>{c.small}</small> : null}
          </span>
        );
      })}
    </div>
  );
}

export { JOURNEY_MAP_MARKS };
