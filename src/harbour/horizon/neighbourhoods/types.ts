/**
 * The Water's Way (docs/horizon/STORY.md): the neighbourhood dressing contract.
 *
 * One definition per neighbourhood. A neighbourhood module is a pure, deterministic function of the bake-time world
 * (`DressingContext`) that returns `NeighbourhoodDressing` records. The bake runs every module once and writes the
 * records into the world definition, per district; every consumer derives from those records:
 *  - collision: building records with `collide` become baked `StructureSolid`s (kind `dressing`), so walking,
 *    chunk streaming, ray casts, view proofs, lite and the per-district budget all see them;
 *  - art: the runtime dressing layer draws buildings with the building grammar (`kit/buildings`), plants with the
 *    plant kit's instancing, props with the prop kit, ground paint, life and lights;
 *  - the Journey map: buildings above `JOURNEY_MIN_HEIGHT` and every landmark appear in the slim land;
 *  - the story: landmarks and lookouts feed the sight-chain proofs, the evening relay and the bells (`world/story.ts`).
 *
 * This module contains no scene, renderer or terrain imports. Records are plain JSON (they are baked).
 * Units: engine units (1 eu = 1 m at scale 1.0); x east, z south, y up; yaw in radians, 0 = local +z faces south
 * (world +z), increasing counter-clockwise seen from above (the `house()` frame in mountain/art/buildingArt.ts).
 */
import type { Point2, Point3, LightAnchor } from '../world/definition.ts';

export type DressingTheme = 'classic' | 'taylor' | 'newfoundland';
export type NeighbourhoodId = 'harbour' | 'hollow' | 'scholars' | 'flats' | 'landing' | 'lakeside' | 'crown';

/* ---------------------------------------------------------------- buildings */

export type BuildingKind =
  // Little Harbour (Ligurian)
  | 'rowHouse' | 'villa' | 'palazzo' | 'campanile' | 'loggia' | 'kiosk'
  // the Highlands
  | 'croft' | 'chapel' | 'longhouse' | 'barn' | 'shieling' | 'liftStation' | 'liftTower'
  // the Hollow
  | 'kiln' | 'cottage' | 'studio' | 'coveredBridge'
  // Scholars' Edge
  | 'library'
  // the Landing & Long Sands
  | 'boathouse' | 'storefront' | 'lifeguardTower' | 'shack' | 'ferrisWheel'
  // the Flats
  | 'quonset' | 'elevator' | 'station' | 'observatory' | 'arch' | 'hoodoo'
  // shared
  | 'pavilion' | 'hide' | 'deck' | 'platform' | 'windpump' | 'shed' | 'gate' | 'wall';

export type RoofForm = 'gable' | 'hip' | 'flat' | 'barrel' | 'shed' | 'pyramid' | 'cone' | 'none';
export interface RoofSpec { form: RoofForm; /** degrees */ pitch: number; overhang: number; /** material token, resolved per dressing by the grammar */ material: string }
export type Face = 'front' | 'back' | 'left' | 'right';

export interface BuildingRecord {
  id: string;
  districtId: string;
  kind: BuildingKind;
  /** The neighbourhood style sheet the grammar uses for palettes and details, e.g. 'harbour.ligurian', 'landing.boardwalk'. */
  style: string;
  /** Base centre; y = finished floor (the grammar sinks a plinth to the lowest ground under the footprint). */
  at: Point3;
  yaw: number;
  /** Plan size along local x (w) and z (d); h = eave height above `at[1]`. */
  size: { w: number; d: number; h: number };
  roof: RoofSpec;
  storeys?: number;
  door?: { face: Face; u: number };
  /** Index into the style's paint list (stucco colour, clapboard colour …); deterministic from the solver. */
  paint?: number;
  /** Free per-kind parameters (arcades: number, altana: boolean, awningStripe: number, belfryOpen: boolean …). */
  params?: Record<string, number | string | boolean>;
  /** Whether the bake emits collision solids for it (most buildings yes; distant hoodoos, ornaments no). */
  collide: boolean;
  /** Re-dresses a host master on its baked footprint (home, bank, library, boathouse, glasshouse, studio, cottage). */
  hostId?: string;
  /** A landmark this building carries (see `Landmark.id`). */
  landmarkId?: string;
}

/* ---------------------------------------------------------------- planting */

/** Species the dressing layer can draw. The first block is the existing kit (land/corridor/types.ts PlantSpecies). */
export type DressingSpecies =
  | 'round' | 'fruit' | 'birch' | 'pine' | 'poplar' | 'alpine'
  | 'shrub' | 'flowering' | 'hedge' | 'heath' | 'palm' | 'flowerBed' | 'grassTuft'
  // The Water's Way additions (kit/plants)
  | 'reed' | 'cattail' | 'sedge' | 'lily' | 'willow' | 'tamarack' | 'spruce' | 'balsam' | 'oakGiant'
  | 'cypress' | 'olive' | 'stonePine' | 'juniper' | 'cedar' | 'prairieGrass' | 'fanPalm' | 'canaryPalm'
  | 'fern' | 'woodlandCard' | 'iceplant' | 'bougainvillea' | 'lemonPot' | 'dogwood' | 'apple';

export interface PlantRecord {
  species: DressingSpecies;
  at: Point3;
  scale: number;
  yaw: number;
  /** Integer part selects a flower set (kit/plants/sets FLOWER_SET), the fraction varies the tone. */
  tint?: number;
  lean?: number;
  /** Lite keeps a deterministic share per species; `keep` forces it onto lite (landmark trees, page framers). */
  keep?: boolean;
}

/* ---------------------------------------------------------------- props */

export type PropKind =
  | 'viewer' | 'viewerSeated' | 'bench' | 'ringBench' | 'picnicTable' | 'panel' | 'lantern' | 'lanternLow' | 'bollard'
  | 'railOpen' | 'fence' | 'drystoneWall' | 'hive' | 'hayBale' | 'kayak' | 'rowboat' | 'gozzo' | 'umbrella' | 'towel'
  | 'laundryLine' | 'stall' | 'cafeTable' | 'fountain' | 'planter' | 'bikeRack' | 'mapBoard' | 'sundial' | 'monthStone'
  | 'kite' | 'swing' | 'windsock' | 'beacon' | 'fireRing' | 'volleyNet' | 'lifeRing' | 'rodHolder' | 'duckBox'
  | 'ospreyPole' | 'snag' | 'buoy' | 'bollardQuay' | 'net' | 'crate' | 'cairn' | 'sheepFank' | 'festoon' | 'flag'
  | 'bocceCourt' | 'skateBowl' | 'geoglyph' | 'readingTable' | 'bookCart' | 'birdFeeder' | 'bell';

export interface PropRecord {
  id?: string;
  kind: PropKind;
  at: Point3;
  yaw: number;
  scale?: number;
  variant?: number;
  /** Linear props (fences, walls, laundry lines, festoons, open rails): the polyline they follow, ground-snapped. */
  line?: Point3[];
  /** A pastime fixture (pass 4 plays it): its pastime id. */
  fixture?: string;
  collide?: boolean;
}

/* ---------------------------------------------------------------- ground, life */

/** Paint only: colours/textures the terrain inside the polygon by surface token. Never re-shapes ground. */
export interface GroundPaint { polygon: Point2[]; surface: 'cobble' | 'brick' | 'travertine' | 'gravel' | 'sand' | 'duff' | 'sedge' | 'mown' | 'meadow' | 'prairie' | 'ochre' | 'scree' | 'snow' | 'mud' | 'pasture' | 'concrete'; tone?: number }
/** Shallow standing water drawn as a surface (marsh pools, the Reed Maze channels); its ground is the land pass's. */
export interface PoolRecord { id: string; outline: Point2[]; level: number }

export type CreatureKind = 'heron' | 'egret' | 'osprey' | 'duck' | 'blackbird' | 'turtle' | 'monarch' | 'gull' | 'cat' | 'sheep'
  | 'raven' | 'loon' | 'dragonfly' | 'swallow' | 'hawk' | 'chickadee' | 'moth' | 'firefly' | 'bee' | 'butterfly';
export interface LifeSpawn { kind: CreatureKind; at: Point3; radius: number; count: number; months?: number[]; hours?: [number, number] }

/* ---------------------------------------------------------------- the story */

/** A place's one hero vertical: it must read from the previous place's lookout (STORY.md sight chain). */
export interface Landmark {
  id: string;
  label: string;
  neighbourhood: NeighbourhoodId;
  /** Base and the sighted top (the point the sight-chain proofs aim at). */
  at: Point3;
  top: Point3;
  /** Its place in the evening relay (1 = first lit at civil dusk); absent if it doesn't join. */
  relayOrder?: number;
  /** Rings in the noon bell chain (STORY.md through-line 5). */
  bell?: 'westwatch' | 'summit' | 'campanile';
}

/** A lookout: one Lookout kit set (viewer(s), bench, panel, open rail) and the targets its binoculars find. */
export interface Lookout {
  id: string;
  label: string;
  /** Standing eye (y = floor + 1.6). */
  eye: Point3;
  facing: number;
  /** Landmark ids (or 'lamp', 'osprey', 'dam') its binoculars snap to; the first is its story target. */
  targets: string[];
  viewer: 'standing' | 'seated' | 'both' | 'slots';
  bestHour: string;
}

/* ---------------------------------------------------------------- the module */

export interface NeighbourhoodDressing {
  id: NeighbourhoodId;
  /** Records carry their own position; the bake assigns each to `districtAt(x, z)`. */
  buildings: BuildingRecord[];
  plants: PlantRecord[];
  props: PropRecord[];
  ground: GroundPaint[];
  pools: PoolRecord[];
  life: LifeSpawn[];
  /** Night order as light anchors (LIGHT §3); `line` groups switch together, `order` sequences them. */
  lights: LightAnchor[];
  landmarks: Landmark[];
  lookouts: Lookout[];
  /**
   * E1 (additive): ids of this module's building and prop records allowed inside a protected area although taller than
   * `PROTECTED_MAX_HEIGHT` (the Green's swing and kites "count as tree/sky"). A plant standing at one of the module's own
   * landmarks' base (within 0.5 eu in plan) is that landmark (the Old Oak) and is allowed without listing.
   */
  allowInProtected?: string[];
}

/** What a module may read at bake time. Everything is the same world the bake and the tests build (horizon-create rule 2). */
export interface DressingContext {
  heightAt(x: number, z: number): number;
  /** Distance (eu, plan) from (x, z) to the nearest bed edge, optionally filtered by bed id prefix. */
  bedClearance(x: number, z: number, prefixes?: readonly string[]): number;
  /** True when (x, z) is on a bed, pad, apron, stair, platform, skate line, water, or inside a baked solid's footprint. */
  occupied(x: number, z: number, margin?: number): boolean;
  waterLevelAt(x: number, z: number): number | null;
  districtAt(x: number, z: number): string;
  beds: readonly { id: string; profile: string; points: readonly Point3[]; width?: number }[];
  hosts: readonly { id: string; footprint?: readonly Point2[]; door: { xy?: Point2 }; height?: number }[];
  protectedAreas: readonly { id: string; outline: readonly Point2[] }[];
  /** Deterministic PRNG for a named stream; same seed → same sequence on every machine. */
  rng(seed: string): () => number;
}

export interface NeighbourhoodModule { id: NeighbourhoodId; build(ctx: DressingContext): NeighbourhoodDressing }

/** Per-district baked payload (what a chunk carries). */
export interface DistrictDressing {
  districtId: string;
  buildings: BuildingRecord[];
  plants: PlantRecord[];
  props: PropRecord[];
  ground: GroundPaint[];
  pools: PoolRecord[];
  life: LifeSpawn[];
}

/** E1 (additive): a Journey-map building as the bake measures it with the grammar's `buildingJourneyShape` (index-borne). */
export interface JourneyDressingBuilding { id: string; districtId: string; footprint: Point2[]; base: number; height: number; roofHeight: number; landmarkId?: string }

/**
 * E1 (additive): the baked dressing in the world definition. The monolith carries every district; a served chunk carries its
 * own district's `DistrictDressing`; the index carries the whole-island parts only (landmarks, lookouts, the hosts a record
 * re-dresses, the Journey-map buildings) with `districts` empty, and the chunk loader appends each district as it lands.
 */
export interface WorldDressing {
  districts: DistrictDressing[];
  landmarks: Landmark[];
  lookouts: Lookout[];
  /** Hosts whose greybox walls/roof the cards no longer draw (their collision stays). Omitted when none. */
  redressedHosts?: string[];
  /** Buildings at or above `JOURNEY_MIN_HEIGHT` (and every landmark-carrying building), for the Journey map. Omitted when none. */
  journey?: JourneyDressingBuilding[];
}

/** Nothing taller than this (eu) stands inside a protected area (the Green), except what a module explicitly allows. */
export const PROTECTED_MAX_HEIGHT = 0.85;

/** Buildings at or above this eave height (eu) appear on the Journey map. */
export const JOURNEY_MIN_HEIGHT = 6;
