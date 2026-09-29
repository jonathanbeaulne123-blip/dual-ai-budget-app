/**
 * Pure extraction (T2): the parsed Horizon index + the `journey` terrain LOD → `JourneyLandData`.
 *
 * Copies ONLY the fields `JourneyLandData` names, as fresh arrays, so the parsed world (pathGraph ≈ 3 MB, collision,
 * crossings, proofs, beds, views…) goes out of scope once `load.ts` returns. Nothing here reads MANIFEST.json.
 */
import type { JourneyLandData, JourneyLandLine, LandLineKind, Point2, Point3, StationId } from "../contracts.ts";
import { JOURNEY_LOD, STATION_IDS } from "../contracts.ts";
import type { Anchor, WorldDefinition } from "../../harbour/horizon/world/definition.ts";
import type { TerrainField } from "../../harbour/horizon/land/interfaces.ts";
import { districtName } from "./names.ts";
import { closedRing, round, simplifyLine, simplifyLine3, simplifyRing } from "./simplify.ts";

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
  };
}
