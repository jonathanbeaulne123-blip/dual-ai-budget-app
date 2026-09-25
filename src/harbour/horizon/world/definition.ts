/** Horizon's data contract. This module contains no scene, terrain, or renderer imports. */
export type Point2 = readonly [number, number];
export type Point3 = readonly [number, number, number];
export type Polygon = readonly Point2[];
export type Anchor = { id: string; xy: Point2; height?: number } | { id: string; empty: true };

export type HeightfieldRef =
  | { kind: 'empty'; revision: string }
  | { kind: 'baked'; revision: string; url: string; bytes: number; step: number };
export interface WaterBody { id: string; outline: Polygon; level: number; kind: string }
export interface Landform { id: string; outline: Polygon; minHeight: number; maxHeight: number }
export interface District { id: string; neighbourhood: string | null; outline: Polygon; childOf?: string }
export interface Host { id: string; placeIds: string[]; door: Anchor; apron: Polygon; arrivalThresholds: string[] }
export interface OutdoorPlace { id: string; anchor: Anchor; districtId: string }
export interface Bed { id: string; profile: string; surface: string; points: Point3[]; districtIds: string[] }
export interface Line { id: string; bedIds: string[]; mode: string; points: Point3[] }
export interface Structure { id: string; kind: string; footprint: Polygon; bedIds: string[] }
export interface Crossing { a: string; b: string; at: Point2; resolution: 'over' | 'under' | 'threshold'; structure?: string }
export interface Threshold { id: string; at: Point2; modes: readonly `${string}→${string}`[]; action: string }
export interface Reserve { id: string; placeId: string; outline: Polygon; door: Anchor; rotationDegrees: number }
export interface FlightEnvelope { ceiling: number; launches: Anchor[]; landings: Anchor[]; gates: Anchor[] }
export interface UndercroftDef { doors: Anchor[]; rooms: Polygon[]; waterBodyId?: string; skylight?: Anchor }
export interface LightAnchor { id: string; at: Point3; kind: string; bestHour?: string }
export interface SketchbookPose { id: string; eye: Point3; target: Point3; fovDegrees: number; radius: number; bestHour?: string }
export interface LanternSpot { id: string; at: Point3; districtId: string }
export interface ProtectedArea { id: string; outline: Polygon; reason: string }
export interface Station { id: string; month: number; anchor: Anchor; bedIds: string[] }
export interface HomesteadSite { id: string; anchor: Anchor; footprint: Polygon }
export interface LodBudgets { l0Triangles: number; l0DrawCalls: number; l1Triangles: number }

/** One authoritative geography, shared by the world and the Journey map. */
export interface WorldDefinition {
  id: 'horizon';
  geographyRevision: string;
  extent: { w: 2000; h: 1800 };
  seaLevel: 0;
  heightfield: HeightfieldRef;
  water: WaterBody[];
  landforms: Landform[];
  districts: District[];
  hosts: Host[];
  places: OutdoorPlace[];
  beds: Bed[];
  lines: Line[];
  structures: Structure[];
  crossings: Crossing[];
  thresholds: Threshold[];
  reserves: Reserve[];
  sky: FlightEnvelope;
  underground: UndercroftDef;
  lights: LightAnchor[];
  views: SketchbookPose[];
  lanterns: LanternSpot[];
  protected: ProtectedArea[];
  journey: {
    stations: Station[];
    yearWalk: Bed;
    homestead: HomesteadSite[];
    kittyPlaza: Anchor;
    lod: LodBudgets;
  };
}

export type FactId = string;
export interface Gate { id: string; stationId: string; factIds: FactId[] }
export interface Signpost { id: string; stationId: string; factIds: FactId[] }
export interface Flag { id: string; stationId: string; factIds: FactId[] }
export interface HomesteadState { sites: Record<string, { maturity: number; wear: string; factIds: FactId[] }> }
export interface ConditionWords { words: string[]; factIds: FactId[] }
export interface TimelineStrip { currentStationId: string; dayIds: string[] }
export interface Stake { id: string; stationId: string; factIds: FactId[] }
export interface Slip { id: string; stationId: string; factIds: FactId[] }

/** Derived on read from accepted facts; never persisted as a second authority. */
export interface WorldOverlay {
  beds: (Bed & { stationId: string; yearIndex: number; cards: string[]; factIds: FactId[] })[];
  camp: { station: string; bed: string; lit: true };
  eraGates: Gate[];
  kittySteps: number[];
  signposts: Signpost[];
  flags: Flag[];
  homestead: HomesteadState;
  foundLanterns: string[];
  condition: ConditionWords;
  timeline: TimelineStrip;
  stakes: Stake[];
  slips: Slip[];
  provenance: Record<string, FactId[]>;
}
