/**
 * Mountain v2 on the Horizon — the one placement every track shares.
 *
 * Mountain v2 (`src/harbour/mountain/**`, geography `hearth-mountain-geo-2`) is authored in its own
 * space: x east, y up, z south, the town square at the origin, the summit at (2, 104, −294).
 * On the Horizon it stands 1:1 with its summit on the Crown summit `[1310,470]` h 158 (D-M1):
 *
 *   horizon = native + OFFSET      native = horizon − OFFSET
 *
 * Only a translation. Nothing in v2's data is transformed; every v2 builder runs in native space and
 * its output group is parented under a host group at `OFFSET`. Runtime queries convert on the way in
 * and add the offset back on the way out. Pure module: no three.js, no terrain, no imports.
 */
export const MOUNTAIN_V2_OFFSET = { x: 1308, y: 54, z: 764 } as const;

/** Native v2 world bounds (`places.ts WORLD_BOUNDS`), repeated here so the bake needs no v2 import. */
export const MOUNTAIN_V2_NATIVE_BOUNDS = { minX: -180, maxX: 180, minZ: -310, maxZ: 84, minY: -8, maxY: 150 } as const;
/** Native bounds of v2's baked 1-unit ground grid (`terrainBase.ts TERRAIN_GRID_BOUNDS`). */
export const MOUNTAIN_V2_GRID_BOUNDS = { minX: -200, maxX: 200, minZ: -396, maxZ: -30 } as const;
/** v2's massif starts at native z < −48; z ≥ −48 is its flat town island (`ISLAND_RADIUS` 84). */
export const MOUNTAIN_V2_MASSIF_Z = -48;
export const MOUNTAIN_V2_ISLAND_RADIUS = 84;
/** The v2 summit line: north of it (native z < −294) the Crown's own north face wins where higher (D-M2). */
export const MOUNTAIN_V2_SUMMIT_Z = -294;
/** Feather (metres) over which v2's ground blends into the Horizon's around the footprint. */
export const MOUNTAIN_V2_FEATHER = 40;

export type XZ = readonly [number, number];
export type XYZ = readonly [number, number, number];

export const toHorizonXZ = (p: XZ): [number, number] => [p[0] + MOUNTAIN_V2_OFFSET.x, p[1] + MOUNTAIN_V2_OFFSET.z];
export const toNativeXZ = (p: XZ): [number, number] => [p[0] - MOUNTAIN_V2_OFFSET.x, p[1] - MOUNTAIN_V2_OFFSET.z];
export const toHorizonXYZ = (p: XYZ): [number, number, number] => [p[0] + MOUNTAIN_V2_OFFSET.x, p[1] + MOUNTAIN_V2_OFFSET.y, p[2] + MOUNTAIN_V2_OFFSET.z];
export const toNativeXYZ = (p: XYZ): [number, number, number] => [p[0] - MOUNTAIN_V2_OFFSET.x, p[1] - MOUNTAIN_V2_OFFSET.y, p[2] - MOUNTAIN_V2_OFFSET.z];
export const toHorizonY = (y: number): number => y + MOUNTAIN_V2_OFFSET.y;
export const toNativeY = (y: number): number => y - MOUNTAIN_V2_OFFSET.y;

/** Horizon-space axis-aligned footprint of v2's grid (the region the bake overrides, before the feather). */
export const MOUNTAIN_V2_FOOTPRINT = {
  minX: MOUNTAIN_V2_GRID_BOUNDS.minX + MOUNTAIN_V2_OFFSET.x, // 1108
  maxX: MOUNTAIN_V2_GRID_BOUNDS.maxX + MOUNTAIN_V2_OFFSET.x, // 1508
  minZ: MOUNTAIN_V2_GRID_BOUNDS.minZ + MOUNTAIN_V2_OFFSET.z, // 368
  maxZ: MOUNTAIN_V2_NATIVE_BOUNDS.maxZ + MOUNTAIN_V2_OFFSET.z, // 848 (the town island's south edge)
} as const;

/** True when a Horizon point lies inside v2's grid footprint (no feather). */
export function insideMountainV2(hx: number, hz: number): boolean {
  return hx >= MOUNTAIN_V2_FOOTPRINT.minX && hx <= MOUNTAIN_V2_FOOTPRINT.maxX && hz >= MOUNTAIN_V2_FOOTPRINT.minZ && hz <= MOUNTAIN_V2_FOOTPRINT.maxZ;
}
