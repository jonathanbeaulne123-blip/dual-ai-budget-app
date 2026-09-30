/** Horizon's data contract. This module contains no scene, terrain, or renderer imports. */
import type { BedCut, PadCut, MouthMask, WaterCut, StructureSolid, LandDiagnostic, DistrictBounds } from '../land/interfaces.ts';
import type { HorizonPathGraph, JourneyMeasurement } from './pathGraph.ts';
import type { CrossingProof, Intersection } from './crossings.ts';
import type { ViewProof } from './views.ts';
import type { SkyProof } from './sky.ts';
import type { Corridor } from '../land/corridor/types.ts';
export type Point2 = readonly [number, number];
export type Point3 = readonly [number, number, number];
export type Polygon = readonly Point2[];
export type Anchor = { id: string; xy: Point2; height?: number } | { id: string; empty: true };

export type HeightfieldRef =
  | { kind: 'empty'; revision: string }
  | { kind: 'baked'; revision: string; url: string; bytes: number; step: number };
export interface WaterBody { id: string; outline: Polygon; level: number; kind: string }
export interface Landform { id: string; outline: Polygon; minHeight: number; maxHeight: number }
export interface District { id: string; neighbourhood: string | null; outline: Polygon; childOf?: string; bounds?: DistrictBounds; children?: District[]; solidIds?: string[]; bedIds?: string[]; triangles?: { full: number; lite: number };
  /** Meshes the runtime CardBuilder makes for the district (terrain + solids per 256-eu card cell). */
  drawCalls?: number;
  /** The district's Voronoi heart (engine units): the single source of the streaming partition. */
  heart?: Point2;
  /** Offshore only: rock sites, the island box outside which the rocks stream, and the radius that puts them first. */
  offshore?: { sites: Point2[]; islandBox: [Point2, Point2]; arriveRadius: number } }
export interface Host { id: string; placeIds: string[]; door: Anchor; apron: Polygon; arrivalThresholds: string[]; height?: number; roofHeight?: number; footprint?: Polygon; solidIds?: string[]; padId?: string; facing?: number; returnAt?: Point3; arrivalEye?: Point3; arrivalTarget?: Point3; toolPlaceId?: string }
export interface OutdoorPlace { id: string; anchor: Anchor; districtId: string }
export interface Bed { id: string; profile: string; surface: string; points: Point3[]; districtIds: string[]; kind?: BedCut['kind']; width?: number; clearHeight?: number; structureIds?: string[]; surfaceSegments?: BedCut['surfaceSegments'] }
export interface Line { id: string; bedIds: string[]; mode: string; points: Point3[]; waterBodyIds?: string[] }
export interface Structure { id: string; kind: string; footprint: Polygon; bedIds: string[]; geometryId?: string; districtId?: string; role?: StructureSolid['role']; bounds?: { min: Point3; max: Point3 } }
export interface Crossing { a: string; b: string; at: Point2; resolution: 'over' | 'under' | 'threshold'; structure?: string; id?: string; proof?: CrossingProof }
/** A `carried` threshold has no pad or marker: a vehicle (the plane's door) supplies its place each frame; `at` is [NaN, NaN] in the definition. */
export interface Threshold { /** Named through carriageways retain their own surface pace at this crossing. */ throughBedIds?: readonly string[]; id: string; at: Point2; modes: readonly `${string}→${string}`[]; action: string; height?: number; padId?: string; markerId?: string; kerbGap?: boolean; sourceId?: string; built?: boolean; carried?: string; minAgl?: number }
export interface Reserve { id: string; placeId: string; outline: Polygon; door: Anchor; rotationDegrees: number }
export interface FlightVolume { id: string; kind: 'gate' | 'thermal' | 'ridge' | 'sink' | 'landing'; centre: Point3; halfSize: Point3; yaw: number; radius?: number; hours?: readonly number[]; modes?: string[]; aperture?: Point2; waterBodyId?: string }
/** [airspeed m/s, still-air sink m/s], bar pushed out full → pulled in full (FLIGHT.md §2.2). */
export type PolarPoint = readonly [number, number];
export interface ParachuteSpec { forward: number; sink: number; freefallCap: number; autoPullAgl: number; minBailAgl: number; canopy: Point2 }
/** The Throat as a corridor dive (FLIGHT.md §2.5): gate 12's mouth down the chute to the level run over the Deep. */
export interface CorridorSpec { gateId: string; mouth: Point3; to: Point3; waterHeight: number; slopeDegrees: number; levelLength: number; splashHeight: number; coneDegrees: number; maxBankDegrees: number; modes: string[] }
export interface DropZoneSpec { xy: Point2; height: number; rings: number[] }
export interface FlightEnvelope { ceiling: number; launches: Anchor[]; landings: Anchor[]; gates: Anchor[]; volumes?: FlightVolume[]; launchPads?: { id: string; padId?: string; edge: Point3[]; graded: boolean }[]; glider?: { speed: number; sink: number }; proofs?: SkyProof; gliderPolar?: PolarPoint[]; parachute?: ParachuteSpec; corridors?: { throat?: CorridorSpec }; dropZone?: DropZoneSpec }
export interface UndercroftDef { doors: Anchor[]; rooms: Polygon[]; waterBodyId?: string; skylight?: Anchor; roomVolumes?: { id: string; outline: Polygon; floor: number; ceiling: number; solidIds: string[] }[] }
/** `kind` 'door' | 'threshold' (derived) | a corridor LampKind (ROAD.md §4.4: roadLantern, bridgeLantern, tunnelLamp, bollard).
 * Corridor lamps also carry their head, the point their light lands on and its radius. */
export interface LightAnchor { id: string; at: Point3; kind: string; bestHour?: string; head?: Point3; pool?: Point3; poolRadius?: number; corridorId?: string;
  /** Corridor lamps: the run they switch on with (`<corridor>:<reach>`) and their place along it (0 = first on at dusk; LIGHT §3). */
  line?: string; order?: number }
/** An emissive light card on a face (MANIFEST v2.0 `lights`, kind 'card'; D-A5): an unlit quad a hair in front of the face,
 * no dynamic light. `corners` run bottom-left, bottom-right, top-right, top-left seen from in front; `on` is the schedule. */
export interface FaceCard { id: string; anchor: string; corners: [Point3, Point3, Point3, Point3]; normal: Point3; on: 'goldenHourToDawn'; districtId: string }
/** A page's portrait lens (MANIFEST v1.7 viewRule.portrait): horizontal FOV held, never below 45°. */
export interface PortraitPose { eye: Point3; target: Point3; fovDegrees: number; frames: string[] }
export interface SketchbookPose { id: string; eye: Point3; target: Point3; fovDegrees: number; radius: number; bestHour?: string; also?: string; label?: string; aspect?: number; subjectIds?: string[]; floor?: number; underground?: boolean; portrait?: PortraitPose; deferred?: string[]; proof?: ViewProof; /** Wave 7 (R3-130): the page's dry ground point for Look → Walk, when its eye is not standing. */ ground?: Point3 }
export interface LanternSpot { id: string; at: Point3; districtId: string }
export interface ProtectedArea { id: string; outline: Polygon; reason: string }
export interface Station { id: string; month: number; anchor: Anchor; bedIds: string[]; padId?: string; footprint?: Polygon; bedPositions?: { yearIndex: number; at: Point3; size: Point2 }[]; stretch?: { from: string; lengthEu: number; lengthM: number; spacing: { days: number; eu: number }[]; points: Point3[] } }
export interface HomesteadSite { id: string; anchor: Anchor; footprint: Polygon }
export interface LodBudgets { l0Triangles: number; l0DrawCalls: number; l1Triangles: number }

/** Pass 5 (T2, CONTRACT §4 region fields): a world placed on the Horizon by translation only (Mountain v2: `mountainV2`).
 * `offset` maps its native space to engine space (engine = native + offset); `footprint` is its engine-space box. The runtime
 * mounts a placed region only when the definition lists it (a bake without the ground override has none). */
export interface RegionPlacement { id: string; kind: 'placedWorld'; offset: { x: number; y: number; z: number }; footprint: { minX: number; maxX: number; minZ: number; maxZ: number } }
/** One authoritative geography, shared by the world and the Journey map. */
export interface WorldDefinition {
  id: 'horizon';
  geographyRevision: string;
  extent: { w: 2000; h: 1800 };
  seaLevel: 0;
  heightfield: HeightfieldRef;
  /** The island outline (engine units, closed) the runtime tests the sea and lagoon against: one source with the bake. */
  coastline?: Polygon;
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
  /** v2.0 (D-A5): emissive face cards (the dam's glass face), on from golden hour to dawn. */
  faceCards?: FaceCard[];
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
  /** The road corridors (ROAD.md): one definition per road bed that the deck, collision, edges, markings, lamps and
   * planting are all derived from. Absent before a bake carries them. */
  corridors?: Corridor[];
  /** Continuous multi-owner routes, measured from the same source as their audit. */
  roadChains?: import('../land/corridor/chain').RoadChain[];

  bridges?: import('../land/bridges/types').BridgeDefinition[];
  /** Pass 5: placed worlds (MANIFEST `regions`), absent before the bake carries one. */
  regions?: RegionPlacement[];
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
