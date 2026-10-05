/**
 * The map's DOM marks (L4): one real `<button>` per `mapMarks()` entry over the aria-hidden canvas (live) or as the
 * flat map's own glyphs (no WebGL). Every hit area is ≥ 44 × 44 px; tab order is date order, never screen position.
 *
 * - Live: a mark stands at the scene's anchor for its own id, else at the first visible anchor of an id it covers
 *   (a stop on that day). A mark with no visible anchor is `hidden` (not tabbable) — it is still in the list.
 * - Flat: a mark stands where `mapLayout` puts it (`projectFlat`), and draws its slot / tile / mini as CSS.
 * - At most THREE callouts on the map (Today, the next leaving stop, the selection), placed clear of each other and of
 *   the chrome; every mark carries its full words in `aria-label` regardless. The Year's twelve minis carry their own
 *   small name plates, as the Week's tiles do.
 * - Pressing a mark only SELECTS it (`onSelect`). No mark runs an action.
 */
import type { CSSProperties } from "react";
import type { JourneyBoardV2, JourneyLevel, ListRow, MarkAnchor, YearChapter } from "../contracts.ts";
import { JOURNEY_MAP_MARKS } from "../contracts.ts";
import { MAP_WORDS, shortDate } from "../model/index.ts";
import { COPY, money, shortMonth } from "./copy.ts";
import type { MapMark } from "./mapLayout.ts";

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

/** The ≤ 3 callouts: Today, the next leaving stop, the selection (deduplicated; Today wins its own mark). */
export function callouts(board: JourneyBoardV2, marks: readonly MapMark[], rows: Map<string, ListRow>, selected: string | null, level: JourneyLevel): Callout[] {
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
  if (next && has(next.date) && next.date !== todayMark) {
    const row = rows.get(next.id);
    out.push({ id: next.date, kind: "next", title: `${COPY.leavingNext} · ${next.label}`, small: [row?.amountText.split(" · ")[0], shortDate(next.date), row?.statusText].filter(Boolean).join(" · ") });
  }
  const selMark = selected ? marks.find((x) => x.id === selected) : undefined;
  if (selMark && (selMark.kind === "day" || selMark.kind === "piece") && !out.some((c) => c.id === selected)) {
    const m = marks.find((x) => x.id === selected)!;
    const stops = board.stops.filter((s) => m.covers.includes(s.id));
    const first = stops[0];
    const title = stops.length > 1 ? `${m.date ? shortDate(m.date) : ""} · ${stops.length} things`.replace(/^ · /, "") : first ? first.label : m.date ? shortDate(m.date) : m.id;
    const small = stops.length === 1 && first ? [rows.get(first.id)?.amountText.split(" · ")[0], shortDate(first.date)].filter(Boolean).join(" · ") : stops.map((s) => s.label).join(" · ");
    out.push({ id: selMark.id, kind: "selected", title, small });
  }
  return out.slice(0, 3);
}

type Box = { x0: number; x1: number; y0: number; y1: number };
const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** Estimated callout box (px): reading layout per frame would thrash; the CSS keeps to this size. */
export function calloutSize(c: Callout): { width: number; height: number } {
  const longest = Math.max(c.title.length * 7.6, c.small.length * 6.2);
  return { width: Math.min(260, Math.max(96, Math.round(longest + 26))), height: c.small ? 44 : 30 };
}

/** Each callout above its mark, nudged up past earlier ones and chrome, clamped on stage. Pure. */
export function placeCallouts(list: readonly Callout[], at: Map<string, { x: number; y: number }>, stage: { width: number; height: number }, obstacles: readonly Box[] = []): { id: string; x: number; y: number }[] {
  const placed: Box[] = [];
  const out: { id: string; x: number; y: number }[] = [];
  for (const c of list) {
    const p = at.get(c.id);
    if (!p) continue;
    const { width, height } = calloutSize(c);
    let x = Math.min(Math.max(p.x, width / 2 + 8), stage.width - width / 2 - 8);
    let y = p.y - 30 - height / 2;
    for (let i = 0; i < 8; i += 1) {
      const box = { x0: x - width / 2, x1: x + width / 2, y0: y - height / 2, y1: y + height / 2 };
      const hit = [...placed, ...obstacles].find((b) => overlap(box, b));
      if (!hit) break;
      y = hit.y0 - height / 2 - 6;
      if (y - height / 2 < 4) { y = p.y + 30 + height / 2; x = Math.min(stage.width - width / 2 - 8, x + 12); }
    }
    y = Math.min(Math.max(y, height / 2 + 4), stage.height - height / 2 - 4);
    placed.push({ x0: x - width / 2, x1: x + width / 2, y0: y - height / 2, y1: y + height / 2 });
    out.push({ id: c.id, x, y });
  }
  return out;
}

/** The words a mark says to a screen reader (and the Year / Week name plates). */
export function markWords(board: JourneyBoardV2, mark: MapMark, rows: Map<string, ListRow>, year?: YearChapter): { aria: string; plate: string | null; plateSmall: string | null } {
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
      const check = y && y.toCheck ? ` · ${y.toCheck} !` : "";
      // Only the current chapter's plate carries a figure (the prototype's plates); every mini says it all in aria-label.
      const small = mark.id === board.currentChapterId && stops.length ? parts[0] ?? COPY.onTheMap(stops.length) : null;
      return {
        aria: [`${name} ${mark.id.slice(0, 4)}`, y?.toCheck ? MAP_WORDS.toCheckCount(y.toCheck) : null, ...(stops.length ? parts : [MAP_WORDS.nothingOnTheMap]), y?.kept ? "Chapter kept" : null].filter(Boolean).join(" · "),
        plate: `${name}${check}`, plateSmall: small,
      };
    }
    case "day": {
      const date = mark.date!;
      const amounts = stops.map((s) => rows.get(s.id)?.amountText.split(" · ")[0]).filter((a) => a && a.startsWith("$"));
      return {
        aria: `${shortDate(date)}${date === board.today ? ` · ${COPY.today}` : ""}${mark.toCheck ? ` · ${MAP_WORDS.checklist.toCheck}` : ""}: ${all || MAP_WORDS.nothingOnThisDay}`,
        plate: `${shortDate(date).slice(0, 6).trim()}${date === board.today ? ` · ${COPY.today}` : amounts.length === 1 ? ` · ${amounts[0]}` : ""}`,
        plateSmall: null,
      };
    }
  }
}

export type MarksProps = {
  board: JourneyBoardV2;
  level: JourneyLevel;
  placed: readonly PlacedMark[];
  rows: Map<string, ListRow>;
  selectedId: string | null;
  focusedDate: string | null;
  flat: boolean;
  /** px per diorama unit on the flat map (sizes the glyphs). */
  unit: number;
  stage: { width: number; height: number };
  obstacles?: readonly Box[];
  sheetId?: string;
  onSelect(id: string, from: HTMLElement): void;
};

export function Marks({ board, level, placed, rows, selectedId, focusedDate, flat, stage, obstacles, sheetId, onSelect }: MarksProps) {
  const visibleMarks = placed.filter((p) => p.visible).map((p) => p.mark);
  const list = callouts(board, visibleMarks, rows, selectedId, level);
  const at = new Map(placed.filter((p) => p.visible).map((p) => [p.mark.id, { x: p.x, y: p.y }] as const));
  const spots = new Map(placeCallouts(list, at, stage, obstacles).map((s) => [s.id, s] as const));
  const yearById = new Map(board.year.map((y) => [y.chapterId, y] as const));
  return (
    <div className={["journey-marks", flat ? "journey-marks--flat" : "journey-marks--live", `journey-marks--${level}`].join(" ")} data-mark-count={placed.length}>
      {placed.map(({ mark, x, y, visible }) => {
        const words = markWords(board, mark, rows, yearById.get(mark.id));
        const style: CSSProperties = { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` };
        const showPlate = level === "year" || (level === "week" && mark.kind === "day" && mark.date !== board.today) || (flat && mark.kind === "pile");
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
              mark.kind === "chapter" && !mark.covers.length ? "journey-mark--empty" : "",
            ].filter(Boolean).join(" ")}
            data-mark-id={mark.id}
            data-mark-kind={mark.kind}
            hidden={!visible}
            aria-label={words.aria}
            aria-expanded={mark.id === selectedId}
            aria-controls={sheetId}
            style={style}
            onClick={(e) => onSelect(mark.id, e.currentTarget)}
          >
            <span className="journey-mark__hit" aria-hidden="true" />
            {mark.toCheck && mark.kind !== "hercules" ? <span className="journey-mark__ring" aria-hidden="true">!</span> : null}
            {showPlate && words.plate ? (
              <span className="journey-mark__plate" aria-hidden="true">{words.plate}{words.plateSmall ? <small>{words.plateSmall}</small> : null}</span>
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
