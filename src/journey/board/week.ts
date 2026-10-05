/**
 * `layoutWeek(board, land, frame)` (Horizon Clock Week, L3; PURE — no three, no DOM).
 *
 * The week as a Party Board on a paper trail along the REAL Year Walk (`land.yearWalk`, never hand-drawn): the
 * stretch that arrives at the Monday's month station, then the next two. Monday → Sunday (`board.week`), one tile per
 * day; where the week crosses into the next month the station sits between those two tiles (so the chapter turns where
 * the Year Walk turns). Sizes: today biggest, money days chunky, empty days small stepping stones. The "to check"
 * pile (`board.week.pileStopIds`) is ONE tile with a count badge, on the nearest dry, free ground beside Monday —
 * searched every bake, so a moved coast, lake or walk moves it.
 *
 * All positions are concept metres (x, y); the scene maps them with the diorama frame. Sizes are diorama units.
 */
import {
  STATION_IDS, isToCheck, type DateKey, type DioramaFrame, type JourneyBoard, type JourneyLandData, type Point2, type StationId,
  type Stop, type WeekDaySize,
} from "../contracts.ts";
import { directionOf, isRecorded } from "../model/money.ts";
import { clamp, distToLine, isDry, nearestArc, spacedCatmullRom, walkAt, walkOf, walkSlice, type Walk } from "./geo.ts";

/** Tile edge in diorama units (prototype `TILE`). */
export const WEEK_TILE_DU = 0.62;
export const WEEK_TILE_SCALE: Record<WeekDaySize, number> = { today: 1.4, money: 1.08, stone: 0.42 };
/** Gap between neighbouring tiles along the trail (metres). */
const TILE_GAP_M = 52;
/** Year Walk points this close to the station are dropped (the station pad sits there). */
const STATION_CLEAR_M = 45;
/** Room kept behind Monday for the faded past trail (metres). */
const PAST_TRAIL_M = 260;

export type WeekTileColour = "tin" | "tout" | "tjar" | "tcheck" | "tempty";

export type WeekTile = {
  /** The day's date: the tile's mark id. */
  date: DateKey;
  index: number;
  size: WeekDaySize;
  /** Tile edge, diorama units. */
  edgeDu: number;
  /** Centre, concept metres, on the trail. */
  at: Point2;
  /** Unit tangent of the trail (concept x, y). */
  tangent: Point2;
  /** Arc position on the trail (metres). */
  arc: number;
  relation: "past" | "today" | "future";
  stopIds: string[];
  /** Up to two stops stand as toys on coin stacks (the sheet lists every one). */
  toyIds: string[];
  colour: WeekTileColour;
  needsYou: boolean;
  /** The next unrecorded commitment from today on stands here (honey "›"). */
  next: boolean;
  /** The face tag's words come from the UI (model/words.ts); the tag stands here. */
  empty: boolean;
};

export type WeekPile = { at: Point2; edgeDu: number; stopIds: string[]; count: number } | null;

export type WeekLayout = {
  from: DateKey;
  to: DateKey;
  /** The Monday's month station: where the trail's stretches meet. */
  stationId: StationId;
  /** The smoothed trail (concept metres), arc-parametrised. */
  walk: Walk;
  /** Arc of the station on the trail. */
  stationArc: number;
  tiles: WeekTile[];
  pile: WeekPile;
  /** Faded past trail (behind Monday) and this week's trail (Monday on), concept metres. */
  pastTrail: Point2[];
  trail: Point2[];
  /** A short spur from Monday to the pile, when there is one. */
  spur: Point2[];
  /** The camera's yaw for this week (radians, diorama): wide looks across the trail, phone looks along it. */
  yaw: number;
};

export type LayoutWeekOptions = {
  /** "phone" (< 720 px) looks along the trail with Monday nearest; "wide" looks across it. Affects the pile search and yaw. */
  orientation?: "wide" | "phone";
};

function tileColour(stops: readonly Stop[]): WeekTileColour {
  if (!stops.length) return "tempty";
  if (stops.some(isToCheck)) return "tcheck";
  if (stops.some((s) => s.kind === "commitment" && s.setAside && !isRecorded(s))) return "tjar";
  const money = stops.filter((s) => directionOf(s) !== "none");
  if (money.length && money.every((s) => directionOf(s) === "in")) return "tin";
  if (money.length) return "tout";
  return "tempty";
}

const stationOfDate = (date: DateKey): StationId => STATION_IDS[Number(date.slice(5, 7)) - 1] ?? "jan";

/** The trail: the Year Walk stretch arriving at `station`, then the next two, smoothed, clear of the station pad. */
export function weekWalk(land: Pick<JourneyLandData, "yearWalk" | "stations">, station: StationId): { walk: Walk; stationArc: number } {
  const i = STATION_IDS.indexOf(station);
  const ids = [station, STATION_IDS[(i + 1) % 12]!, STATION_IDS[(i + 2) % 12]!];
  const anchor = land.stations.find((s) => s.id === station)?.anchor ?? null;
  let pts: Point2[] = ids.flatMap((id) => land.yearWalk.find((w) => w.stationId === id)?.points ?? []).map((p) => [p[0], p[2]] as Point2);
  if (anchor) pts = pts.filter((p) => Math.hypot(p[0] - anchor[0], p[1] - anchor[1]) > STATION_CLEAR_M);
  const kept: Point2[] = [];
  for (const p of pts) { const q = kept[kept.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 12) kept.push(p); }
  const walk = walkOf(kept.length >= 2 ? spacedCatmullRom(kept, 500) : kept);
  return { walk, stationArc: anchor ? nearestArc(walk, anchor[0], anchor[1]) : walk.length / 2 };
}

export function layoutWeek(board: JourneyBoard, land: JourneyLandData, frame: DioramaFrame, options: LayoutWeekOptions = {}): WeekLayout {
  const week = board.week ?? { from: board.today, to: board.today, days: [], pileStopIds: [] };
  const byId = new Map(board.stops.map((s) => [s.id, s] as const));
  const stationId = stationOfDate(week.from);
  const { walk, stationArc } = weekWalk(land, stationId);
  const days = week.days;
  const edge = days.map((d) => WEEK_TILE_DU * WEEK_TILE_SCALE[d.size]);
  /** Tile half-extent in metres (the prototype's `size · .56 / scale`). */
  const halfM = edge.map((e) => (e * 0.56) / frame.scale);
  const offs = [0];
  for (let i = 1; i < days.length; i += 1) offs.push(offs[i - 1]! + halfM[i - 1]! + halfM[i]! + TILE_GAP_M);
  // Where the month turns inside the week, the station sits between those two tiles; otherwise the week walks up to it.
  const turn = days.findIndex((d, i) => i > 0 && d.date.slice(0, 7) !== days[0]!.date.slice(0, 7));
  const last = offs.length - 1;
  let shift = turn > 0 ? stationArc - (offs[turn - 1]! + offs[turn]!) / 2 : stationArc - offs[last]! - halfM[last]! - TILE_GAP_M;
  const lo = 40 + (halfM[0] ?? 0) + PAST_TRAIL_M, hi = walk.length - 40 - (offs[last] ?? 0);
  shift = hi >= lo ? clamp(shift, lo, hi) : Math.max(0, (walk.length - (offs[last] ?? 0)) / 2);
  const nextId = board.digest?.nextLeavingStopId ?? null;
  const tiles: WeekTile[] = days.map((d, i) => {
    const arc = offs[i]! + shift;
    const p = walkAt(walk, arc);
    const stops = d.stopIds.map((id) => byId.get(id)).filter((s): s is Stop => !!s);
    const money = stops.filter((s) => directionOf(s) !== "none");
    return {
      date: d.date, index: i, size: d.size, edgeDu: edge[i]!, at: [p.x, p.y], tangent: [p.tx, p.ty], arc, relation: d.relation,
      stopIds: d.stopIds, toyIds: [...money, ...stops.filter((s) => directionOf(s) === "none")].slice(0, 2).map((s) => s.id),
      colour: tileColour(stops), needsYou: stops.some(isToCheck), next: !!nextId && d.stopIds.includes(nextId), empty: stops.length === 0,
    };
  });
  const a = tiles[0]?.at, b = tiles[tiles.length - 1]?.at;
  const ang = a && b ? Math.atan2(b[1] - a[1], b[0] - a[0]) : 0;
  const phone = options.orientation === "phone";
  const yaw = phone ? ang + Math.PI / 2 - 0.3 : ang;
  const pile = placePile(land, frame, walk, tiles, week.pileStopIds, yaw, phone);
  const s0 = tiles[0] ? tiles[0].arc : 0, s1 = tiles[tiles.length - 1] ? tiles[tiles.length - 1]!.arc + 90 : walk.length;
  return {
    from: week.from, to: week.to, stationId, walk, stationArc, tiles, pile,
    pastTrail: walkSlice(walk, Math.max(0, s0 - 220), s0), trail: walkSlice(walk, s0, Math.min(walk.length, s1)),
    spur: pile && tiles[0] ? [tiles[0].at, pile.at] : [], yaw,
  };
}

/** ONE pile beside Monday on the nearest dry, free ground (searched, so a Horizon change moves it). */
function placePile(land: JourneyLandData, frame: DioramaFrame, walk: Walk, tiles: readonly WeekTile[], ids: readonly string[], yaw: number, phone: boolean): WeekPile {
  if (!ids.length || !tiles.length) return null;
  const mon = tiles[0]!.at, cY = Math.cos(yaw), sY = Math.sin(yaw);
  const tileR = tiles.map((t) => (t.edgeDu * 0.56) / frame.scale);
  const ok = (x: number, y: number) => isDry(land, x, y, 24) && distToLine(land.coastline, x, y, true) >= 34
    && distToLine(walk.points, x, y, false) >= 90 && tiles.every((t, i) => Math.hypot(t.at[0] - x, t.at[1] - y) >= tileR[i]! + 70);
  let best: { x: number; y: number; score: number } | null = null;
  for (let dx = -300; dx <= 300; dx += 10) for (let dy = -300; dy <= 300; dy += 10) {
    const x = mon[0] + dx, y = mon[1] + dy;
    if (best && Math.hypot(dx, dy) > best.score) continue;
    if (!ok(x, y)) continue;
    const rz = -dx * sY + dy * cY, rx = dx * cY + dy * sY; // + rz = toward the camera
    const score = Math.hypot(dx, dy) + (phone ? Math.max(0, rz) * 3 : Math.abs(rz) * 1.2 + Math.max(0, rx) * 2);
    if (!best || score < best.score) best = { x, y, score };
  }
  const at: Point2 = best ? [best.x, best.y] : (() => { const p = walkAt(walk, tiles[0]!.arc - 108); return [p.x, p.y] as Point2; })();
  return { at, edgeDu: WEEK_TILE_DU * 0.95, stopIds: [...ids], count: ids.length };
}
