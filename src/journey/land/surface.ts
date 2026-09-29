/**
 * Pure land queries (T2) on `JourneyLandData`: baked height (bilinear on the 20 m `journey` lattice), the compressed
 * board height, water levels and "is this land". No three. Used by `build.ts` (the handle), `lines.ts` (draping) and
 * tests; T3 reaches them through the handle.
 */
import type { JourneyLandData } from "../contracts.ts";
import { compressHeight } from "../contracts.ts";
import type { TerrainField } from "../../harbour/horizon/land/interfaces.ts";
import { pointInPolygon } from "./simplify.ts";

/** Seabed deeper than this (m) is fully "sea" coloured; terrain quads with every corner deeper are not drawn. */
export const DEEP_CUT = -6;
/** Water bodies that hold a level surface (drawn flat at their level). Others (river, brook, dry wash) are graded. */
export const LEVEL_WATER_KINDS = new Set(["lake", "lagoon"]);
/** Water that is not land for `isLand` (a dry wash is walkable ground). */
const WET_KINDS = new Set(["lake", "lagoon", "river", "brook", "sea"]);

export type TerrainSampler = { rawHeightAt(x: number, y: number): number; paintAt(x: number, y: number): number };

/** Bilinear height on the lattice, clamped to the island extent. */
export function createTerrainSampler(field: TerrainField): TerrainSampler {
  const { columns, rows, step, heights, surfaces } = field;
  const cell = (x: number, y: number) => {
    const fx = Math.min(Math.max(x / step, 0), columns - 1), fy = Math.min(Math.max(y / step, 0), rows - 1);
    const i = Math.min(Math.floor(fx), columns - 2), j = Math.min(Math.floor(fy), rows - 2);
    return { i, j, u: fx - i, v: fy - j };
  };
  return {
    rawHeightAt(x, y) {
      const { i, j, u, v } = cell(x, y), a = j * columns + i;
      const h00 = heights[a]!, h10 = heights[a + 1]!, h01 = heights[a + columns]!, h11 = heights[a + columns + 1]!;
      return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
    },
    paintAt(x, y) {
      const { i, j, u, v } = cell(x, y);
      return surfaces[(j + (v > 0.5 ? 1 : 0)) * columns + i + (u > 0.5 ? 1 : 0)]!;
    },
  };
}

export type LandSurface = {
  rawHeightAt(x: number, y: number): number;
  /** Compressed ground height (board space). */
  heightAt(x: number, y: number): number;
  /** The drawn surface: compressed ground, or the level water / sea on top of it. */
  surfaceAt(x: number, y: number): number;
  isLand(x: number, y: number): boolean;
  /** The first wet water body containing (x, y), or null. */
  waterAt(x: number, y: number): JourneyLandData["water"][number] | null;
};

export function createLandSurface(data: JourneyLandData): LandSurface {
  const sampler = createTerrainSampler(data.terrain);
  const wet = data.water.filter((w) => WET_KINDS.has(w.kind));
  const waterAt = (x: number, y: number) => wet.find((w) => pointInPolygon(x, y, w.outline)) ?? null;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= data.extent.w && y <= data.extent.h;
  const heightAt = (x: number, y: number) => compressHeight(sampler.rawHeightAt(x, y));
  return {
    rawHeightAt: sampler.rawHeightAt,
    heightAt,
    surfaceAt(x, y) {
      let top = Math.max(heightAt(x, y), compressHeight(data.seaLevel));
      const w = waterAt(x, y);
      if (w && LEVEL_WATER_KINDS.has(w.kind)) top = Math.max(top, compressHeight(w.level));
      return top;
    },
    isLand(x, y) {
      if (!inside(x, y) || !pointInPolygon(x, y, data.coastline)) return false;
      if (sampler.rawHeightAt(x, y) <= data.seaLevel) return false;
      return waterAt(x, y) === null;
    },
    waterAt,
  };
}
