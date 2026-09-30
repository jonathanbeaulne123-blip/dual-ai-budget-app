/**
 * Pure extraction (T2): the parsed Horizon index + the `journey` terrain LOD → `JourneyLandData`.
 *
 * Copies ONLY the fields `JourneyLandData` names, as fresh arrays, so the parsed world (pathGraph ≈ 3 MB, collision,
 * crossings, proofs, beds, views…) goes out of scope once `load.ts` returns. Nothing here reads MANIFEST.json.
 */
import type { JourneyLandData, JourneyLandLine, LandLineKind, Point2, Point3, StationId } from "../contracts.ts";
import { JOURNEY_LOD, STATION_IDS } from "../contracts.ts";
import type { Anchor, WorldDefinition } from "../../harbour/horizon/world/definition.ts";
import type { Corridor } from "../../harbour/horizon/land/corridor/types.ts";
import type { TerrainField } from "../../harbour/horizon/land/interfaces.ts";
import { districtName } from "./names.ts";
import { arcOf, closedRing, projectOnSegment, round, simplifyLine, simplifyLine3, simplifyRing, sliceByArc } from "./simplify.ts";

/** Douglas–Peucker tolerances (eu) for the two tiers (PLAN §B T2). The data carries the full-tier lines. */
export const LINE_TOLERANCE = { full: 4, lite: 8 } as const;

/** Index `Line.mode` → the board's line kind. Unlisted modes are not drawn. */
const MODE_KIND: Readonly<Record<string, LandLineKind>> = {
  bicycle: "road", board: "skate", walk: "walk", gondola: "cable", zip: "cable", cart: "rail", ferry: "ferry", row: "row",
};
/** Lines that are part of another structure or a test strip, never map lines. */
const SKIPPED_LINES = new Set(["strip", "dam.apron.level"]);
/** Water bodies that are not drawn on the surface: the open sea (the sea plane) and underground water (the Deep). */
const HIDDEN_WATER_KINDS = new Set(["sea", "deep"]);
/** Landforms that are not surface relief (the Undercroft is the cave system under the Crown). */
const HIDDEN_LANDFORMS = new Set(["undercroft"]);

/** Spurs and plot service roads: drawn from Region inward, hidden at Sky. */
export function isMinorLine(id: string): boolean {
  return id.startsWith("spur ") || id.endsWith(".service") || id.endsWith(".siding");
}

const xyOf = (anchor: Anchor): Point2 | null => ("xy" in anchor ? [anchor.xy[0], anchor.xy[1]] : null);
const heightOf = (anchor: Anchor): number => ("xy" in anchor ? anchor.height ?? 0 : 0);
const copyRing = (ring: readonly Point2[]): Point2[] => closedRing(ring).map((p) => [round(p[0]), round(p[1])] as const);
const isStationId = (id: string): id is StationId => (STATION_IDS as readonly string[]).includes(id);

export function extractJourneyLand(world: WorldDefinition, terrain: TerrainField): JourneyLandData {
  if (world.id !== "horizon") throw new Error("The Journey land needs the Horizon index.");
  if (terrain.revision !== world.geographyRevision) throw new Error("The Journey terrain and the Horizon index are different revisions.");

  const coastSource = world.coastline;
  if (!coastSource || coastSource.length < 3) throw new Error("The Horizon index has no coastline.");
  const coastline = simplifyRing(coastSource, 0, JOURNEY_LOD.coastVertices);

  const water = world.water
    .filter((w) => !HIDDEN_WATER_KINDS.has(w.kind) && w.outline.length >= 3)
    .map((w) => ({ id: w.id, kind: w.kind, level: w.level, outline: copyRing(w.outline) }));

  const landforms = world.landforms
    .filter((l) => !HIDDEN_LANDFORMS.has(l.id) && l.outline.length >= 3)
    .map((l) => ({ id: l.id, outline: copyRing(l.outline), minHeight: l.minHeight, maxHeight: l.maxHeight }));

  const districts = world.districts.map((d) => ({
    id: d.id, neighbourhood: d.neighbourhood ?? null, heart: d.heart ? ([d.heart[0], d.heart[1]] as const) : null, label: districtName(d.id),
  }));

  const hosts = world.hosts.flatMap((h) => {
    const door = xyOf(h.door);
    if (!door) return [];
    return [{
      id: h.id, door, doorHeight: heightOf(h.door),
      footprint: h.footprint && h.footprint.length >= 3 ? copyRing(h.footprint) : null,
      /** The host pad's baked ground elevation (index `Host.height`). */
      height: h.height ?? heightOf(h.door),
      /** The building's roof height above its pad (index `Host.roofHeight`). */
      roofHeight: h.roofHeight ?? null,
    }];
  });

  const reserves = world.reserves.flatMap((r) => {
    const door = xyOf(r.door);
    return door && r.outline.length >= 3 ? [{ id: r.id, outline: copyRing(r.outline), door }] : [];
  });

  // A line carried wholly by cave beds runs underground (the Deep's rowing run): not on the bird's-eye map.
  const caveBeds = new Set(world.beds.filter((b) => b.kind === "cave").map((b) => b.id));
  const underground = (bedIds: readonly string[]) => bedIds.length > 0 && bedIds.every((id) => caveBeds.has(id));
  const lines: JourneyLandLine[] = [];
  for (const line of world.lines) {
    const kind = MODE_KIND[line.mode];
    if (!kind || SKIPPED_LINES.has(line.id) || line.points.length < 2 || underground(line.bedIds)) continue;
    const plan = simplifyLine(line.points.map((p) => [p[0], p[2]] as const), LINE_TOLERANCE.full);
    if (plan.length >= 2) lines.push({ id: line.id, kind, points: plan });
  }

  const stations: JourneyLandData["stations"] = [];
  const yearWalk: JourneyLandData["yearWalk"] = [];
  for (const s of world.journey.stations) {
    const anchor = xyOf(s.anchor);
    if (!isStationId(s.id) || !anchor) throw new Error(`The Horizon index has an unknown Journey station ${s.id}.`);
    stations.push({ id: s.id, month: s.month, anchor, height: heightOf(s.anchor), footprint: s.footprint && s.footprint.length >= 3 ? copyRing(s.footprint) : null });
    if (s.stretch && isStationId(s.stretch.from) && s.stretch.points.length >= 2) {
      yearWalk.push({ stationId: s.id, fromStationId: s.stretch.from, lengthEu: round(s.stretch.lengthEu), points: simplifyLine3(s.stretch.points as Point3[], LINE_TOLERANCE.full) });
    }
  }
  stations.sort((a, b) => a.month - b.month);
  if (stations.length !== 12 || stations.some((s, i) => s.id !== STATION_IDS[i])) throw new Error("The Horizon index must carry the twelve Journey stations.");

  const homestead = world.journey.homestead.flatMap((h) => {
    const anchor = xyOf(h.anchor);
    return anchor ? [{ id: h.id, anchor, height: heightOf(h.anchor), footprint: copyRing(h.footprint) }] : [];
  });
  const kittyXy = xyOf(world.journey.kittyPlaza);
  const bridges = extractBridges(world, lines);
  const covers = extractCovers(world, lines);
  const boulevards = world.corridors ? extractBoulevards(world.corridors, lines) : null;

  return {
    revision: world.geographyRevision,
    extent: { w: world.extent.w, h: world.extent.h },
    seaLevel: world.seaLevel,
    coastline,
    water,
    landforms,
    districts,
    hosts,
    reserves,
    lines,
    stations,
    yearWalk,
    homestead,
    kittyPlaza: { xy: kittyXy ?? [world.extent.w / 2, world.extent.h / 2], height: heightOf(world.journey.kittyPlaza) },
    terrain,
    lod: { l0Triangles: world.journey.lod.l0Triangles, l0DrawCalls: world.journey.lod.l0DrawCalls, l1Triangles: world.journey.lod.l1Triangles },
    bridges,
    covers,
    ...(boulevards ? { boulevards } : {}),
  };
}

// ---------------------------------------------------------------------------
// The road at map scale (ROAD.md §7): bridges, covered stretches, boulevard reaches. All read from the index the
// bake wrote (structures, beds, collision mouths, corridors), never from MANIFEST.

/** A line point this far (eu) beyond a deck's edge still counts as over it. */
const DECK_SIDE_SLACK = 1;
/** Within this height (eu) of the deck a line point rides on it; further below it passes under. */
const DECK_HEIGHT_SLACK = 2.5;
/** Boulevard reaches are simplified finer than lines: they are short and their ends are cut points. */
const BOULEVARD_TOLERANCE = 2;

/** `quayBridge.deck@reach` → `quayBridge` (a structure's parts share its id before the first dot). */
const baseId = (structureId: string) => structureId.split("@")[0]!.split(".")[0]!;

/**
 * The road's spans: a `bridge` deck structure whose own bed (`structure.<id>`, kind road) carries a drawn road line.
 * The axis is that bed's centreline (engine x, raw deck height, z); `lineIds` are the drawn lines with points on the
 * deck (within its width, at its height) — the road, and the skate lane or path that shares a wide deck.
 */
function extractBridges(world: WorldDefinition, lines: readonly JourneyLandLine[]): NonNullable<JourneyLandData["bridges"]> {
  const roadLines = new Set(lines.filter((l) => l.kind === "road").map((l) => l.id));
  const drawn = new Set(lines.map((l) => l.id));
  const beds = new Map(world.beds.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const out: NonNullable<JourneyLandData["bridges"]> = [];
  for (const s of world.structures) {
    const id = baseId(s.id);
    if (s.kind !== "bridge" || s.role !== "deck" || seen.has(id) || !s.bedIds.some((b) => roadLines.has(b))) continue;
    const bed = beds.get(`structure.${id}`);
    if (!bed || bed.kind !== "road" || bed.points.length < 2 || !(bed.width && bed.width > 0)) continue;
    seen.add(id);
    const axis = bed.points.map((p) => [round(p[0]), round(p[1]), round(p[2])] as const);
    const half = bed.width / 2 + DECK_SIDE_SLACK;
    const lineIds: string[] = [], underIds: string[] = [];
    for (const line of world.lines) {
      if (!drawn.has(line.id)) continue;
      let on = false, under = false;
      for (const p of line.points) {
        const d = deckDelta(p, axis, half);
        if (d === null) continue;
        if (Math.abs(d) <= DECK_HEIGHT_SLACK) on = true; else if (d < 0) under = true;
      }
      if (on) lineIds.push(line.id); else if (under) underIds.push(line.id);
    }
    out.push({ id, axis, width: round(bed.width), lineIds: lineIds.sort(), underIds: underIds.sort() });
  }
  for(const c of world.corridors??[])for(const b of c.sourceBridges??[]){
    if(seen.has(b.id))continue;seen.add(b.id);
    const axis=b.axis.map(p=>[round(p[0]),round(p[1]),round(p[2])] as const),lineIds:string[]=[],underIds:string[]=[];
    for(const line of world.lines){if(!drawn.has(line.id))continue;let on=false,under=false;
      for(const p of line.points){const d=deckDelta(p,axis,b.width/2+DECK_SIDE_SLACK);if(d===null)continue;if(Math.abs(d)<=DECK_HEIGHT_SLACK)on=true;else if(d<0)under=true;}
      if(on)lineIds.push(line.id);else if(under)underIds.push(line.id);
    }
    out.push({id:b.id,axis,width:round(b.width),lineIds:lineIds.sort(),underIds:underIds.sort()});
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** A 3D line point's height above the deck (negative = below) when it lies inside the deck's plan footprint, else null. */
function deckDelta(p: Point3, axis: readonly Point3[], half: number): number | null {
  for (let i = 1; i < axis.length; i++) {
    const a = axis[i - 1]!, b = axis[i]!, pr = projectOnSegment([p[0], p[2]], [a[0], a[2]], [b[0], b[2]]);
    if (pr.t < 0 || pr.t > 1 || Math.abs(pr.lateral) > half) continue;
    return p[1] - (a[1] + (b[1] - a[1]) * pr.t);
  }
  return null;
}

/**
 * Where a drawn road line runs under cover: a `tunnel` floor structure on that road's bed, portal to portal (the index's
 * collision mouths `<id>.portal.0|1`). A structure with a colonnade (the Prow) is the open gallery, not a bored tunnel.
 */
function extractCovers(world: WorldDefinition, lines: readonly JourneyLandLine[]): NonNullable<JourneyLandData["covers"]> {
  const roads = new Map(world.lines.filter((l) => lines.some((d) => d.id === l.id && d.kind === "road")).map((l) => [l.id, l]));
  const mouths = new Map((world.collision?.mouths ?? []).map((m) => [m.id, m]));
  const centre = (outline: readonly (readonly number[])[]): Point2 => {
    const n = outline.length || 1;
    return [outline.reduce((s, p) => s + p[0]!, 0) / n, outline.reduce((s, p) => s + p[1]!, 0) / n];
  };
  const seen = new Set<string>();
  const out: NonNullable<JourneyLandData["covers"]> = [];
  for (const s of world.structures) {
    const id = baseId(s.id);
    const isFloor = s.id.startsWith(`${id}.floor@`) || s.id === `${id}.floor`;
    if (s.kind !== "tunnel" || s.role !== "floor" || !isFloor || seen.has(id)) continue;
    const road = s.bedIds.map((b) => roads.get(b)).find(Boolean);
    const m0 = mouths.get(`${id}.portal.0`), m1 = mouths.get(`${id}.portal.1`);
    if (!road || !m0 || !m1) continue;
    seen.add(id);
    const plan = road.points.map((p) => [p[0], p[2]] as const);
    const a0 = arcOf(plan, centre(m0.outline)), a1 = arcOf(plan, centre(m1.outline));
    const piece = sliceByArc(plan, Math.min(a0, a1), Math.max(a0, a1));
    if (piece.length < 2) continue;
    const points = simplifyLine(piece, LINE_TOLERANCE.full);
    const gallery = world.structures.some((x) => x.id.startsWith(`${id}.colonnade`));
    out.push({ id, kind: gallery ? "gallery" : "tunnel", lineId: road.id, points, portals: [points[0]!, points[points.length - 1]!] });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Boulevard reaches: the stations of a corridor reach whose context is `boulevard` that are themselves classified
 * `boulevard` (a structure inside the reach, such as the dune culvert, breaks it), in contiguous runs (wrapping on a
 * closed corridor), as plan points. Read from the stations' own `reachId` and `context`, so nothing depends on how a
 * reach's `from` / `to` are expressed.
 */
function extractBoulevards(corridors: readonly Corridor[], lines: readonly JourneyLandLine[]): NonNullable<JourneyLandData["boulevards"]> {
  const out: NonNullable<JourneyLandData["boulevards"]> = [];
  for (const corridor of corridors) {
    const line = lines.find((l) => l.kind === "road" && l.id === corridor.id);
    const reachIds = new Set(corridor.reaches.filter((r) => r.context === "boulevard").map((r) => r.id));
    const st = corridor.stations;
    if (!line || !reachIds.size || st.length < 2) continue;
    const on = st.map((x) => reachIds.has(x.reachId) && x.context === "boulevard");
    // Start scanning just after a station that is off, so a run that wraps the loop's start stays whole.
    const first = corridor.closed ? on.findIndex((v) => !v) : 0;
    if (first < 0) { out.push(boulevard(corridor.id, st[0]!.reachId, 0, st)); continue; }
    let run: typeof st = [];
    const count = new Map<string, number>();
    const flush = () => {
      if (run.length >= 2) { const id = run[0]!.reachId, n = count.get(id) ?? 0; count.set(id, n + 1); out.push(boulevard(corridor.id, id, n, run)); }
      run = [];
    };
    for (let k = 0; k < st.length; k++) {
      const i = (first + k) % st.length;
      if (on[i] && (!run.length || run[run.length - 1]!.reachId === st[i]!.reachId)) run.push(st[i]!);
      else { flush(); if (on[i]) run.push(st[i]!); }
    }
    flush();
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

function boulevard(corridorId: string, reachId: string, n: number, stations: Corridor["stations"]): NonNullable<JourneyLandData["boulevards"]>[number] {
  return {
    id: `${corridorId}:${reachId}:${n}`, lineId: corridorId,
    points: simplifyLine(stations.map((x) => [x.at[0], x.at[2]] as const), BOULEVARD_TOLERANCE),
    median: stations.some((x) => !!x.median && x.median.half > 0),
  };
}
