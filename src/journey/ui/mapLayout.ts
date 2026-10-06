/**
 * The map's marks (L4), pure: WHICH DOM buttons the map shows at a level, what each one covers, and — for the flat
 * fallback (no WebGL, a failed land, Simple view) — where it stands. The live scene (L3) reports screen anchors for the
 * same ids; the flat map projects these diorama positions itself. Nothing here reads the household or computes money.
 *
 * Mark ids (contracts `JOURNEY_MAP_MARKS`): a date ("2026-09-28") for a clock slot / Week tile, a chapter id
 * ("2026-09") for a Year mini, "hercules" (Month, today's chapter), "pile" (Week's overdue pile). A date mark COVERS
 * every stop and crossroads on that date; today's mark also covers "piece" (the bus stands on today's slot / tile, so
 * the two never stack as two buttons — axe target-size); the pile covers `week.pileStopIds`; a mini covers its
 * chapter's stops. A 3D anchor on any covered id is reachable through its mark.
 */
import { dioramaFrame } from "../land/diorama.ts";
import { JOURNEY_DIORAMA, JOURNEY_MAP_MARKS, isToCheck, type ChapterId, type DateKey, type JourneyBoard, type JourneyLandData, type JourneyLevel, type Point2, type Stop } from "../contracts.ts";
import { directionOf, isRecorded } from "../model/index.ts";
import { addDays, daysInMonth, lastDay } from "./copy.ts";

/** "piece" is kept for callers that still name it; `mapMarks` folds the bus into today's own mark. */
export type MapMarkKind = "day" | "piece" | "hercules" | "pile" | "chapter";
export type MapMark = {
  id: string;
  kind: MapMarkKind;
  /** The day (day / piece) or null. */
  date: DateKey | null;
  /** Every stop / crossroads id this mark opens (its own id is always covered too). */
  covers: string[];
  /** Diorama units (x east, y south) for the flat map. */
  at: Point2;
  /** Any covered stop `isToCheck` (the honey "!" ring, with words; never colour alone). */
  toCheck: boolean;
  /** Money on the mark, for the flat glyph: "in" / "out" / "both" / "none"; and whether all of it is recorded. */
  money: "in" | "out" | "both" | "none";
  recorded: boolean;
};

const { bezel, slots } = JOURNEY_DIORAMA;
/** The flat map's frame: the bezel's outer edge plus a margin, in diorama units. */
export const FLAT_EXTENT = bezel.outer + 0.5;
const YEAR_RING = bezel.inner * 0.98;

/** A clock slot: day 1 at north, clockwise, 31 slots (a short month leaves its last slots empty). */
export function slotAt(day: number): Point2 {
  const a = ((day - 1) / slots) * Math.PI * 2;
  return [bezel.road * Math.sin(a), -bezel.road * Math.cos(a)];
}

/** A Week tile on a diagonal trail, Monday at the bottom-left, Sunday at the top-right (plates never collide). */
export function weekTileAt(index: number): Point2 {
  const f = index / 6;
  return [(f - 0.5) * 7.2, (0.5 - f) * 7.2];
}

/** A Year mini on a ring, the window's first month at north, clockwise. */
export function yearMiniAt(index: number, count: number): Point2 {
  const a = (index / Math.max(1, count)) * Math.PI * 2;
  return [YEAR_RING * Math.sin(a), -YEAR_RING * Math.cos(a)];
}

function moneyOf(stops: readonly Stop[]): Pick<MapMark, "money" | "recorded" | "toCheck"> {
  let hasIn = false, hasOut = false, allRecorded = true;
  for (const s of stops) {
    const d = directionOf(s);
    if (d === "none") continue;
    if (d === "in") hasIn = true; else hasOut = true;
    if (!isRecorded(s)) allRecorded = false;
  }
  return { money: hasIn && hasOut ? "both" : hasIn ? "in" : hasOut ? "out" : "none", recorded: (hasIn || hasOut) && allRecorded, toCheck: stops.some(isToCheck) };
}

function byDate(board: JourneyBoard): Map<string, { stops: Stop[]; crossroads: string[] }> {
  const map = new Map<string, { stops: Stop[]; crossroads: string[] }>();
  const at = (date: string) => { let e = map.get(date); if (!e) { e = { stops: [], crossroads: [] }; map.set(date, e); } return e; };
  for (const s of board.stops) at(s.date).stops.push(s);
  for (const c of board.crossroads) at(c.date).crossroads.push(c.id);
  return map;
}

/** The marks the map shows at `level` (chapter `chapterId` for Month). DOM (tab) order = date order. */
export function mapMarks(board: JourneyBoard, level: JourneyLevel, chapterId: ChapterId): MapMark[] {
  const dates = byDate(board);
  const day = (date: DateKey, at: Point2, kind: MapMarkKind = "day", id: string = date, bus = false): MapMark => {
    const e = dates.get(date) ?? { stops: [], crossroads: [] };
    return { id, kind, date, covers: [...e.stops.map((s) => s.id), ...e.crossroads, ...(bus ? [JOURNEY_MAP_MARKS.piece] : [])], at, ...moneyOf(e.stops) };
  };
  if (level === "year") {
    return board.year.map((y, i) => {
      const stops = board.stops.filter((s) => s.chapterId === y.chapterId);
      return { id: y.chapterId, kind: "chapter", date: null, covers: stops.map((s) => s.id), at: yearMiniAt(i, board.year.length), ...moneyOf(stops), toCheck: y.toCheck > 0 };
    });
  }
  if (level === "week") {
    const out: MapMark[] = [];
    if (board.week.pileStopIds.length) {
      const pile = board.stops.filter((s) => board.week.pileStopIds.includes(s.id));
      const first = weekTileAt(0);
      out.push({ id: JOURNEY_MAP_MARKS.pile, kind: "pile", date: null, covers: [...board.week.pileStopIds], at: [first[0] + 1.8, first[1] + 0.3], ...moneyOf(pile), toCheck: true });
    }
    board.week.days.forEach((d, i) => out.push(day(d.date, weekTileAt(i), "day", d.date, d.date === board.today)));
    return out;
  }
  const out: MapMark[] = [];
  const n = daysInMonth(chapterId);
  for (let d = 1; d <= n; d += 1) {
    const date = `${chapterId}-${String(d).padStart(2, "0")}` as DateKey;
    if (dates.has(date) || date === board.today) out.push(day(date, slotAt(d), "day", date, date === board.today));
  }
  if (chapterId === board.currentChapterId) {
    out.push({ id: JOURNEY_MAP_MARKS.hercules, kind: "hercules", date: null, covers: [], at: [0, 0], money: "none", recorded: false, toCheck: board.toCheck.length > 0 });
  }
  return out;
}

/** Every id a set of marks can reach (its own ids + everything they cover). */
export function coveredIds(marks: readonly MapMark[]): Set<string> {
  return new Set(marks.flatMap((m) => [m.id, ...m.covers]));
}

export type FlatInset = { top: number; bottom: number; left?: number; right?: number };
/** Diorama units → stage px for the flat map (the frame fits the stage's uncovered rect, centred in it). */
export function projectFlat(at: Point2, size: { width: number; height: number }, inset: FlatInset = { top: 0, bottom: 0 }): { x: number; y: number } {
  const left = inset.left ?? 0, right = inset.right ?? 0;
  const w = Math.max(1, size.width - left - right), h = Math.max(1, size.height - inset.top - inset.bottom);
  const scale = Math.min(w, h) / (2 * FLAT_EXTENT);
  return { x: left + w / 2 + at[0] * scale, y: inset.top + h / 2 + at[1] * scale };
}
export function flatScale(size: { width: number; height: number }, inset: FlatInset = { top: 0, bottom: 0 }): number {
  const w = Math.max(1, size.width - (inset.left ?? 0) - (inset.right ?? 0));
  return Math.min(w, Math.max(1, size.height - inset.top - inset.bottom)) / (2 * FLAT_EXTENT);
}

/** Where the island's concept metres sit inside the flat clock: L2's `dioramaFrame` (the same frame as the clay). */
export function flatIslandFrame(land: Pick<JourneyLandData, "coastline">): { centre: Point2; radius: number; scale: number } | null {
  try { return land.coastline.length ? dioramaFrame(land) : null; } catch { return null; }
}

/** The days of a month a keyboard can visit (every day, not only the ones with stops). */
export function clampToChapter(date: DateKey, chapterId: ChapterId): DateKey {
  const first = `${chapterId}-01` as DateKey, last = lastDay(chapterId);
  return date < first ? first : date > last ? last : date;
}
export { addDays };
