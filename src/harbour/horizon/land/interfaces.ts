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
  /** Structural spans leave the basin or tunnel roof intact beneath the route. */
  terrainExclusions?: { at: XY; radius: number }[];
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
  /** One byte per sample; indexes the terrain module's exported surface palette. */
  surfaces: Uint8Array;
}
