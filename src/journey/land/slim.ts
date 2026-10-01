import { BRIDGE_GLYPHS } from './bridgeGlyph';
/**
 * The slim Journey land artefact (REVIEW M2): the `JourneyLandData` that `extract.ts` produces, baked by
 * `scripts/horizon/bake-terrain.mjs` from the SAME index and terrain it writes, as its own small static asset
 * (`/horizon/world/<revision>.journey.json.gz`, ≈ 21 KB gzip). The home screen reads this instead of downloading and
 * parsing the 5.7 MB Horizon index plus the 571 KB terrain; `load.ts` falls back to the index path when it is absent,
 * stale or unreadable.
 *
 * Pure and Node-safe (the bake imports it): no three, no React, no network, no DOM beyond TextDecoder.
 * The 20 m `journey` terrain lattice is embedded as signed centimetres + paint bytes — the terrain asset's own
 * quantisation — so decoding yields the same Float32Array/Uint8Array `decodeTerrainAsset(buf, "journey")` returns.
 */
import { gunzipSync } from "fflate";
import type { JourneyLandData } from "../contracts.ts";
import { STATION_IDS } from "../contracts.ts";
import { HORIZON_GEOGRAPHY } from "../../worldGeography.ts";

/** Where the bake writes the slim artefact (keyed by the geography revision, beside the index). */
export const JOURNEY_LAND_SLIM_URL = `/horizon/world/${HORIZON_GEOGRAPHY}.journey.json.gz`;
/**
 * Bumped when the payload shape changes; a loader that does not know the format falls back to the index.
 * 3 (bridge cast): optional landmark name, silhouette glyph and raised anchor on each bridge.
 * 2 (road pass, ROAD.md §7): `bridges` and `covers` always, `boulevards` when the index carries corridors.
 */
export const JOURNEY_LAND_SLIM_FORMAT = 3;

/** Which bake the payload came from: the sha256 of the index JSON (uncompressed) and of the terrain asset. */
export type JourneyLandSlimSource = { index: string; indexSha256: string; terrainSha256: string };
type SlimTerrain = { revision: string; width: number; depth: number; step: number; columns: number; rows: number; heightsCm: number[]; surfaces: number[] };
export type JourneyLandSlim = {
  id: "journey-land";
  format: number;
  revision: string;
  source: JourneyLandSlimSource;
  land: Omit<JourneyLandData, "terrain"> & { terrain: SlimTerrain };
};

/** `JourneyLandData` → the JSON-safe slim payload (bake side). */
export function encodeJourneyLandSlim(data: JourneyLandData, source: JourneyLandSlimSource): JourneyLandSlim {
  const { terrain, ...rest } = data;
  const heightsCm = Array.from(terrain.heights, (h) => Math.round(h * 100));
  for (const cm of heightsCm) if (!Number.isInteger(cm) || cm < -32768 || cm > 32767) throw new Error("A Journey terrain height is outside the centimetre range.");
  return {
    id: "journey-land",
    format: JOURNEY_LAND_SLIM_FORMAT,
    revision: data.revision,
    source,
    land: {
      ...rest,
      terrain: {
        revision: terrain.revision, width: terrain.width, depth: terrain.depth, step: terrain.step,
        columns: terrain.columns, rows: terrain.rows, heightsCm, surfaces: Array.from(terrain.surfaces),
      },
    },
  };
}

const isArray = Array.isArray;
const fail = (why: string): never => { throw new Error(`The slim Journey land is unusable: ${why}.`); };

/** The parsed slim payload → `JourneyLandData`. Throws on a different revision, an unknown format or a malformed lattice. */
export function decodeJourneyLandSlim(value: unknown, revision: string = HORIZON_GEOGRAPHY): JourneyLandData {
  const slim = value as Partial<JourneyLandSlim> | null;
  if (!slim || typeof slim !== "object" || slim.id !== "journey-land") fail("not a Journey land payload");
  if (slim!.format !== JOURNEY_LAND_SLIM_FORMAT) fail(`format ${String(slim!.format)}`);
  if (slim!.revision !== revision) fail(`revision ${String(slim!.revision)} is not ${revision}`);
  const land = slim!.land;
  if (!land || land.revision !== revision) fail("the land revision differs");
  const t = land!.terrain;
  if (!t || t.revision !== revision) fail("the terrain revision differs");
  const count = t!.columns * t!.rows;
  if (!(t!.columns >= 2 && t!.rows >= 2 && t!.step > 0) || !isArray(t!.heightsCm) || !isArray(t!.surfaces) || t!.heightsCm.length !== count || t!.surfaces.length !== count ||
      t!.width !== (t!.columns - 1) * t!.step || t!.depth !== (t!.rows - 1) * t!.step) fail("the terrain lattice is malformed");
  for (const key of ["coastline", "water", "landforms", "districts", "hosts", "reserves", "lines", "stations", "yearWalk", "homestead", "bridges", "covers"] as const) if (!isArray(land![key])) fail(`${key} is missing`);
  if (land!.boulevards !== undefined && !isArray(land!.boulevards)) fail("boulevards is malformed");
  const drawn = new Set(land!.lines.map((l) => l.id));
  for (const b of land!.bridges!) {
    if (!b || typeof b.id !== "string" || !isArray(b.axis) || b.axis.length < 2 || !(b.width > 0) || !isArray(b.lineIds) || !isArray(b.underIds)) fail(`bridge ${String(b?.id)} is malformed`);
    if(b.landmark && (typeof b.landmark.name!=='string'||!b.landmark.name.trim()||!(typeof b.landmark.glyph==='string'&&Object.hasOwn(BRIDGE_GLYPHS,b.landmark.glyph))||!Array.isArray(b.landmark.at)||b.landmark.at.length!==3||!b.landmark.at.every(Number.isFinite)))fail(`bridge ${b.id} landmark is malformed`);
    if (b.lineIds.some((id) => !drawn.has(id))) fail(`bridge ${b.id} carries a line the land does not draw`);
  }
  for (const c of [...land!.covers!, ...(land!.boulevards ?? [])]) if (!c || !drawn.has(c.lineId) || !isArray(c.points) || c.points.length < 2) fail(`${String(c?.id)} is malformed`);
  if (land!.stations.length !== STATION_IDS.length || land!.stations.some((s, i) => s.id !== STATION_IDS[i])) fail("the twelve stations are not jan…dec");
  const heights = new Float32Array(count), surfaces = new Uint8Array(count);
  for (let n = 0; n < count; n++) { heights[n] = t!.heightsCm[n]! / 100; surfaces[n] = t!.surfaces[n]!; }
  const { terrain: _slimTerrain, ...rest } = land!;
  return {
    ...rest,
    terrain: { revision: HORIZON_GEOGRAPHY, width: t!.width, depth: t!.depth, step: t!.step, columns: t!.columns, rows: t!.rows, heights, surfaces },
  };
}

/** Bytes as delivered (gzip, or already decoded by a server that sent Content-Encoding) → `JourneyLandData`. */
export function parseJourneyLandSlim(bytes: ArrayBuffer, revision: string = HORIZON_GEOGRAPHY): JourneyLandData {
  const encoded = new Uint8Array(bytes);
  const text = new TextDecoder().decode(encoded[0] === 0x1f && encoded[1] === 0x8b ? gunzipSync(encoded) : encoded);
  return decodeJourneyLandSlim(JSON.parse(text) as unknown, revision);
}
