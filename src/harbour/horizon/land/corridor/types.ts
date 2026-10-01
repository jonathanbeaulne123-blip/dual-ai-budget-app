/**
 * The Horizon road corridor (docs/horizon/ROAD.md): ONE road definition that the visible surface, the physical
 * driving surface, the edges and every piece of roadside furniture are derived from.
 *
 * A corridor is computed at bake time from a road bed's FINAL points (after the land settles: `settleBedEdges`,
 * junction aprons, span pins) and from the final ground. Nothing downstream re-derives a road line by hand:
 * the deck ribbon, kerbs, sidewalks, guard colliders, the visible rail kit, markings, lamps and planting all read
 * the same stations.
 *
 * Conventions
 * - Engine units (eu). `s` is arc length along the bed's point order, from its first point.
 * - Lateral offset `o` is measured from the centreline; `o > 0` is the RIGHT-hand side when facing increasing `s`:
 *   right(t) = (-t.z, t.x) for a unit tangent t = (t.x, t.z) in the xz plane, y up. Traffic keeps right (Canada),
 *   so a two-lane road's right lane is 0 < o < half.
 * - Heights are world y. `at[1]` of a station is the finished road surface on the centreline.
 * This module contains types and constants only: no scene, terrain or renderer imports (CONTRACT §4).
 */
import type { Point2, Point3 } from '../../world/definition.ts';

/** What the road passes through (ROAD.md §3). Chosen per station, grouped into reaches. */
export type CorridorContext =
  | 'developed'   // town, destinations, developed waterfront: kerbs, continuous sidewalks, crossings, lamps, deliberate planting
  | 'boulevard'   // broad open stretch chosen for a boulevard: planted verges / flower beds, occasional median, palms where coastal
  | 'coastal'     // open views to the water: selective planting, low guards, restrained infrastructure
  | 'mountain'    // mountain / forest / cliff: terrain-sensitive edges, stone guards where needed, framed trees, no urban dressing
  | 'structure'   // bridges, the gallery, tunnels, the dam: clean approaches, the structure's own rails and lamps
  | 'open';       // quiet rural stretch: shoulders, sparse framing, no dressing

/** What stands at the edge of the carriageway on one side. */
export type CorridorEdge =
  | 'shoulder'    // flush paved shoulder into verge or batter
  | 'kerb'        // raised kerb (KERB_RISE) with nothing behind it but verge
  | 'sidewalk'    // raised kerb + a continuous footway
  | 'yearWalk'    // the Year Walk footway already runs here: it IS the footway; connect, never duplicate
  | 'structure';  // a bridge / gallery / tunnel edge owned by the structure

/** The guard family (ROAD.md §4.3). One style per context; never mixed within a run. */
export type GuardKind =
  | 'none'
  | 'stoneParapet' // mountain / cliff: coursed stone, coping, piers (STYLE K3 parapet), Mountain v2 look
  | 'postRail'     // coastal / open drops: low timber-and-steel post-and-rail that keeps the view
  | 'bridgeRail'   // bridges and the gallery: the structure's own rail, one per deck edge (no double rails)
  | 'retaining';   // a retaining wall is the edge (the road is in a cutting on this side)

/** Why a guard, kerb or planting run is interrupted. Gaps are real openings: no collider crosses them. */
export type CorridorGapKind = 'junction' | 'entrance' | 'crossing' | 'viewpoint' | 'threshold' | 'layby';

export interface CorridorSide {
  edge: CorridorEdge;
  guard: GuardKind;
  /** Ground drop (positive = down) measured 1.5 eu beyond the outer edge of this side. */
  drop: number;
  /** Distance to open water on this side within 80 eu, else null. */
  waterEu: number | null;
  /** Outer offset of the paved carriageway incl. shoulder on this side (always positive). */
  paved: number;
  /** Actual source-owned rail offset, when it differs from the Horizon kit's setback. */
  guardOffset?: number;
  /** Footway band on this side (sidewalk or Year Walk), absolute offsets from the centreline. */
  footway?: { inner: number; outer: number; height: number; bedId?: string };
  /** Planting band allowed on this side (ROAD.md §5), absolute offsets; absent = nothing grows here. `maxHeight` (optional,
   * L2): the tallest thing allowed in the band here (a junction's sight triangle 0.6, the Green's protected centre 0.85,
   * the sea side of a coastal reach 0.9); absent = no height limit beyond ROAD.md §5. */
  planting?: { inner: number; outer: number; maxHeight?: number };
  gap?: CorridorGapKind;
  /** Road main: a structure owns the road here (its deck) but has no rail of its own on this side over a drop that needs
   * one (the Bight spur trestle, a bridge's last deck metres before its parapet): the corridor guards this side itself. */
  bare?: boolean;
}

export interface CorridorStation {
  s: number;
  at: Point3;
  /** Unit tangent in xz. */
  tangent: Point2;
  /** Longitudinal grade (rise / run) at this station. */
  grade: number;
  context: CorridorContext;
  reachId: string;
  /** Half width of the driven carriageway (lanes only, without shoulders). */
  half: number;
  left: CorridorSide;
  right: CorridorSide;
  /** Planted median, absolute offsets either side of the centreline (a boulevard with a median splits the lanes). */
  median?: { half: number };
  /** Set when the station lies on a structure deck that owns the road here. */
  structureId?: string;
}

export interface CorridorReach { id: string; label: string; from: number; to: number; context: CorridorContext; note?: string }

export type MarkingKind = 'centreDash' | 'centreSolid' | 'edgeLine' | 'giveWay' | 'zebra' | 'stopBar';
/** A painted run on the deck. `offset` is the line's centre; zebra and giveWay carry their across extent in `span`. */
export interface MarkingRun { id: string; kind: MarkingKind; from: number; to: number; offset: number; width: number; dash?: readonly [on: number, off: number]; span?: readonly [inner: number, outer: number] }

export type GuardEnd = 'flare' | 'buried' | 'pier' | 'abutment' | 'continues';
/** A guard run: the visible rail kit and its collider are both built from `line` (the rail's centre at ground). */
export interface GuardRun { id: string; side: 'left' | 'right'; kind: GuardKind; from: number; to: number; offset: number; height: number; line: Point3[]; ends: readonly [GuardEnd, GuardEnd]; colliderId: string; owner?: 'region' }

export type LampKind = 'roadLantern' | 'bridgeLantern' | 'tunnelLamp' | 'bollard';
/** A streetlight. `at` is the base on the ground/footway; `head` is the lamp head; `pool` is where its light lands. */
export interface LampSpot { id: string; kind: LampKind; at: Point3; head: Point3; pool: Point3; poolRadius: number; yaw: number; side: 'left' | 'right'; reachId: string }

export type PlantSpecies =
  | 'round' | 'fruit' | 'birch' | 'pine' | 'poplar' | 'alpine'          // Mountain v2 tree archetypes
  | 'shrub' | 'flowering' | 'hedge' | 'heath'                         // Mountain v2 shrub archetypes
  | 'palm' | 'flowerBed' | 'grassTuft';                               // corridor additions in the same card kit
export type PlantingKind = 'avenue' | 'palmGrove' | 'flowerBed' | 'hedgerow' | 'framingTrees' | 'shrubCluster' | 'median';
export interface PlantItem {
  species: PlantSpecies; at: Point3; scale: number; yaw: number; tint?: number;
  /** Optional wind lean (radians, toward local +x after `yaw`). A `pine` with lean ≥ 0.15 is drawn as a wind-bent
   * (wind-clipped) pine (STYLE §3.2 shore: "wind-bent pine, leaning"); other trees tilt by it. Absent = upright. */
  lean?: number;
}
/** A composed group (never a spline scatter): its items are placed together under one rule. */
export interface PlantingGroup { id: string; kind: PlantingKind; reachId: string; side: 'left' | 'right' | 'median'; items: PlantItem[] }

/** A scenic stopping place: a usable pull-off or viewpoint joined to the road and, where there is one, a walk. */
export interface ScenicStop { id: string; label: string; at: Point3; outline: Point2[]; facing: number; connectsTo?: string[]; existingFloor?: boolean }

export interface Corridor {
  /** The road bed id (V01, VG, V03, VBS, spur.*). */
  id: string;
  closed: boolean;
  /** Station spacing used for `stations` (eu). */
  step: number;
  stations: CorridorStation[];
  reaches: CorridorReach[];
  markings: MarkingRun[];
  guards: GuardRun[];
  lamps: LampSpot[];
  /** IDs retained on lite; other whole lamps are omitted. Retained lamps keep their authored shape. */
  liteLampIds?: string[];
  planting: PlantingGroup[];
  stops: ScenicStop[];
  /** Furniture/map adapter over a source-owned road; no second deck or guard is emitted. */
  source?: 'mountain-v2';
  sourceBridges?: {id:string;name:string;axis:Point3[];width:number}[];
}

/** Shared section dimensions (engine units). Widths come from MANIFEST profiles (CONTRACT §3); these are the kit's. */
export const CORRIDOR = Object.freeze({
  step: 2,
  kerbRise: 0.15,
  kerbWidth: 0.25,
  sidewalkWidth: 2.2,
  /** A dropped kerb at crossings and entrances: flush within this, ramped ≤ 8 % either side. */
  droppedKerbLength: 3,
  /** Guard offsets: rail centre this far beyond the paved edge. */
  guardSetback: 0.35,
  stoneParapetHeight: 0.95,
  postRailHeight: 0.85,
  /** A drop beyond the edge above this needs a guard (profiles.road parapet_on_drop; land already uses 1.25). */
  guardDrop: 1.25,
  lampHeight: 5.2,
  lampSetback: 0.9,
  /** Lamp pools overlap so the road never alternates bright and dark. */
  lampSpacing: { developed: 24, structure: 30, boulevard: 28, junction: 0 } as const,
  lampPoolRadius: 12,
  /** Nothing taller than this within a junction's sight triangle. */
  sightlineMaxHeight: 0.6,
  sightlineReach: 35,
  /** Clearance kept above the carriageway (profiles.road clear_m). */
  headroom: 5,
  /** Planting never nearer the paved edge than this; canopies never over the carriageway. */
  plantingSetback: 1.2,
});
