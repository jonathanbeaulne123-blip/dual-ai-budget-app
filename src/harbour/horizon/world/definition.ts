/** Horizon's data contract. This module contains no scene, terrain, or renderer imports. */
import type { BedCut, PadCut, MouthMask, WaterCut, StructureSolid, LandDiagnostic, DistrictBounds } from '../land/interfaces.ts';
import type { HorizonPathGraph, JourneyMeasurement } from './pathGraph.ts';
import type { CrossingProof, Intersection } from './crossings.ts';
import type { ViewProof } from './views.ts';
import type { SkyProof } from './sky.ts';
export type Point2 = readonly [number, number];
export type Point3 = readonly [number, number, number];
export type Polygon = readonly Point2[];
export type Anchor = { id: string; xy: Point2; height?: number } | { id: string; empty: true };

export type HeightfieldRef =
  | { kind: 'empty'; revision: string }
  | { kind: 'baked'; revision: string; url: string; bytes: number; step: number };
export interface WaterBody { id: string; outline: Polygon; level: number; kind: string }
export interface Landform { id: string; outline: Polygon; minHeight: number; maxHeight: number }
export interface District { id: string; neighbourhood: string | null; outline: Polygon; childOf?: string; bounds?: DistrictBounds; children?: District[]; solidIds?: string[]; bedIds?: string[]; triangles?: { full: number; lite: number }; drawCalls?: number }
export interface Host { id: string; placeIds: string[]; door: Anchor; apron: Polygon; arrivalThresholds: string[]; height?: number; roofHeight?: number; footprint?: Polygon; solidIds?: string[]; padId?: string; facing?: number; returnAt?: Point3; arrivalEye?: Point3; arrivalTarget?: Point3; toolPlaceId?: string }
export interface OutdoorPlace { id: string; anchor: Anchor; districtId: string }
export interface Bed { id: string; profile: string; surface: string; points: Point3[]; districtIds: string[]; kind?: BedCut['kind']; width?: number; clearHeight?: number; structureIds?: string[]; surfaceSegments?: BedCut['surfaceSegments'] }
export interface Line { id: string; bedIds: string[]; mode: string; points: Point3[]; waterBodyIds?: string[] }
export interface Structure { id: string; kind: string; footprint: Polygon; bedIds: string[]; geometryId?: string; districtId?: string; role?: StructureSolid['role']; bounds?: { min: Point3; max: Point3 } }
export interface Crossing { a: string; b: string; at: Point2; resolution: 'over' | 'under' | 'threshold'; structure?: string; id?: string; proof?: CrossingProof }
export interface Threshold { id: string; at: Point2; modes: readonly `${string}→${string}`[]; action: string; height?: number; padId?: string; markerId?: string; kerbGap?: boolean; sourceId?: string; built?: boolean }
export interface Reserve { id: string; placeId: string; outline: Polygon; door: Anchor; rotationDegrees: number }
export interface FlightVolume { id: string; kind: 'gate' | 'thermal' | 'ridge' | 'sink' | 'landing'; centre: Point3; halfSize: Point3; yaw: number; radius?: number; hours?: readonly number[]; modes?: string[]; aperture?: Point2 }
export interface FlightEnvelope { ceiling: number; launches: Anchor[]; landings: Anchor[]; gates: Anchor[]; volumes?: FlightVolume[]; launchPads?: { id: string; padId?: string; edge: Point3[]; graded: boolean }[]; glider?: { speed: number; sink: number }; proofs?: SkyProof }
export interface UndercroftDef { doors: Anchor[]; rooms: Polygon[]; waterBodyId?: string; skylight?: Anchor; roomVolumes?: { id: string; outline: Polygon; floor: number; ceiling: number; solidIds: string[] }[] }
export interface LightAnchor { id: string; at: Point3; kind: string; bestHour?: string }
export interface SketchbookPose { id: string; eye: Point3; target: Point3; fovDegrees: number; radius: number; bestHour?: string; also?: string; label?: string; aspect?: number; subjectIds?: string[]; floor?: number; underground?: boolean; proof?: ViewProof }
export interface LanternSpot { id: string; at: Point3; districtId: string }
export interface ProtectedArea { id: string; outline: Polygon; reason: string }
export interface Station { id: string; month: number; anchor: Anchor; bedIds: string[]; padId?: string; footprint?: Polygon; bedPositions?: { yearIndex: number; at: Point3; size: Point2 }[]; stretch?: { from: string; lengthEu: number; lengthM: number; spacing: { days: number; eu: number }[]; points: Point3[] } }
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
  /** Serialized meshes are the same indexed solids used by rendering, ray casts and proofs. */
  geometry?: { solids: StructureSolid[]; sourceMap?: Record<string, string[]>; simplification?: {
    method: 'meshopt' | 'prism-chain'; requestedErrorEu: number; targetIndexRatio: number; inputTriangles: number; outputTriangles: number; changedSolids: number; maxReportedErrorEu: number; fullCollisionUnchanged: true; maximumMergedPrisms?: number; minWidthRatio?: number;
    solids: { id: string; inputTriangles: number; outputTriangles: number; reportedErrorEu: number; boundsDeviationEu: number; accepted: boolean; reason?: string }[];
  } };
  collision?: { beds: BedCut[]; pads: PadCut[]; mouths: MouthMask[]; waters: WaterCut[]; walkableSlopeDegrees: number; lipStepMax: number };
  pathGraph?: HorizonPathGraph;
  diagnostics?: LandDiagnostic[];
  crossingProofs?: CrossingProof[];
  rawIntersections?: Intersection[];
  journeyMeasurements?: JourneyMeasurement[];
  scaleFactor?: number;
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
