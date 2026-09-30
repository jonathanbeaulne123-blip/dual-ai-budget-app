/** Shared Pass 1 cuts. All positions, dimensions and heights are engine units.
 * Pure data: the offline builder produces these; renderers never solve terrain at import.
 * Track owners read this file; the integrator owns changes to this contract.
 */
export type XY = readonly [number, number];
export type XYZ = readonly [number, number, number];
export type HeightQuery = (x: number, z: number) => number;

export interface BedCut {
  id: string;
  kind: 'road' | 'skate' | 'walk' | 'trail' | 'boardwalk' | 'stair' | 'rail' | 'cable' | 'cave';
  profile: string;
  surface: string;
  surfaceSegments?: { from: number; to: number; surface: string; pace: string; bankDegrees: number }[];
  points: XYZ[];
  width: number;
  shoulder: number;
  blend: number;
  clearHeight: number;
  maxGrade: number;
  /** A bridge/cable/cave must not pull the heightfield up to its deck or down to its floor. */
  terrainCut: boolean;
  /** Exclude terrain fill beneath spans; open spans also cap intruding banks, while tunnel roofs stay intact. */
  /** `terrainAt`/`terrainRadius` (road tunnels): the terrain keeps its natural roof cover only inside this circle, so the
   * road cut reaches through a portal mouth (R2-03); `at`/`radius` still govern carried shares and reports. */
  terrainExclusions?: { at: XY; radius: number; openSpan?: boolean; terrainAt?: XY; terrainRadius?: number }[];
  structureIds: string[];
  districtIds: string[];
}
export interface PadCut {
  id: string;
  kind: 'host' | 'reserve' | 'threshold' | 'station' | 'homestead' | 'landing' | 'place';
  centre: XYZ;
  size: XY;
  rotationDegrees: number;
  margin: number;
  blend: number;
  placeId?: string;
  door?: XYZ;
  serviceBedId?: string;
  /** Underground pads cut the cave floor, never the surface heightfield. */
  underground?: boolean;
}
export interface MouthMask {
  id: string;
  outline: XY[];
  floor: number;
  ceiling: number;
  kind: 'portal' | 'skylight';
}
export interface WaterCut {
  id: string;
  kind: 'sea' | 'lake' | 'river' | 'brook' | 'lagoon' | 'deep' | 'dry';
  outline: XY[];
  /** Graded channels carry a centreline; a level body carries level. */
  points: XYZ[];
  level: number;
  width: number;
  depth: number;
  bank: number;
  underground?: boolean;
}
export interface StructureSolid {
  id: string;
  /** Original logical solid when its indexed triangles are partitioned for streaming. */
  sourceId?: string;
  kind: string;
  /** Indexed, outward-facing solid geometry including sides and underside. */
  positions: number[];
  indices: number[];
  /** Offline simplified rendering; collision retains the full indices. */
  liteIndices?: number[];
  litePositions?: number[];
  liteErrorEu?: number;
  surface: string;
  districtId: string;
  bedIds: string[];
  walkable: boolean;
  /** Excludes threshold paint/markers from structural-clearance measurements. */
  role: 'deck' | 'support' | 'wall' | 'rail' | 'roof' | 'floor' | 'marker' | 'rock';
}
export interface DistrictBounds {
  id: string;
  neighbourhood: string | null;
  outline: XY[];
  min: XYZ;
  max: XYZ;
  childOf?: string;
}
export interface LandDiagnostic {
  id: string;
  severity: 'info' | 'conflict';
  message: string;
  at?: XY;
  measured?: number;
  required?: number;
}
export interface LandCuts {
  bridges?: import('./bridges/types').BridgeDefinition[];
  bridgeMeetingSeeds?: Record<string, XYZ>;
  bridgeBearingSeeds?: Record<string, {stations:number[];offsets:number[]}>;
  bridgeLightSeeds?: Record<string, XYZ[]>;
  beds: BedCut[];
  pads: PadCut[];
  mouths: MouthMask[];
  waters: WaterCut[];
  solids: StructureSolid[];
  diagnostics: LandDiagnostic[];
}
export interface TerrainField {
  revision: 'horizon-geo-1';
  width: number;
  depth: number;
  step: number;
  columns: number;
  rows: number;
  heights: Float32Array;
  /** One paint byte per sample: bits 0–4 the ground palette index, bits 5–6 the strata set
   * (`packTerrainPaint` / `terrainPaintGround` / `terrainPaintRockSet` in land/terrain). */
  surfaces: Uint8Array;
}
// --- T2 additions ---
/** A plan stretch of one bed where its side facing `other` is shared with that bed:
 * the two form one surface at the same height, so neither emits a kerb, parapet or
 * retaining wall on that side (MANIFEST journey.yearWalk.sharesRule). */
export interface SharedEdge { other: string; at: XY[] }
export interface BedCut {
  /** Stretches whose inner side is shared with another bed at the same height. */
  sharedEdges?: SharedEdge[];
  /** Plan stretches carried inside another bed's own structure (a bridge or tunnel
   * section, or a trail it walks on at offset 0): this bed emits no deck, edge or
   * terrain override there. */
  carried?: XY[][];
}
export interface PadCut {
  /** The pad is carried by what is under it, and never shapes the terrain heightfield:
   * a raised deck (a tower top, a lookout run-off, a jetty over water) on its structure's
   * supports, or an at-grade junction where two graded beds meet flush. */
  deck?: boolean;
}
