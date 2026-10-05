/**
 * Expected size of each corridor plant at scale 1 (ROAD.md §4.6, §5). The plan checks every item against this
 * table (canopy over the carriageway, the 0.6 sight-triangle limit, the Green's 0.85 limit); the planting art
 * (`runtime/corridorPlanting.ts`) must draw each species no larger than this at the same `scale`.
 *
 * Trees follow Mountain v2's `crownOf` (`src/harbour/mountain/planting.ts`) with size = scale.
 */
import type { PlantSpecies } from '../types.ts';

export interface PlantForm {
  /** Top of the plant above its ground point, per unit scale. */
  height: number;
  /** Horizontal radius of the crown / bed (the lateral half-extent for a hedge segment), per unit scale. */
  canopy: number;
  /** Underside of the crown above the ground per unit scale (a crown below the 5 eu headroom never overhangs a footway). */
  base: number;
  /** A tree: crown clearance, occupancy and the ≥ 6 eu mountain setback apply. */
  tree: boolean;
}

export const PLANT_FORM: Readonly<Record<PlantSpecies, PlantForm>> = Object.freeze({
  round: { height: 5, canopy: 2.2, base: 1.6, tree: true },
  fruit: { height: 3.4, canopy: 1.9, base: 1.3, tree: true },
  birch: { height: 6.4, canopy: 1.3, base: 2.2, tree: true },
  pine: { height: 6.2, canopy: 1.9, base: 1.1, tree: true },
  poplar: { height: 7.2, canopy: 1.1, base: 1.4, tree: true },
  alpine: { height: 6.6, canopy: 1.3, base: 0.9, tree: true },
  palm: { height: 6.5, canopy: 2.2, base: 5.2, tree: true },
  shrub: { height: 1.1, canopy: 0.9, base: 0, tree: false },
  flowering: { height: 0.9, canopy: 0.8, base: 0, tree: false },
  /** A hedge segment is 2.6 × scale long along its yaw; `canopy` is its half thickness. */
  hedge: { height: 1.25, canopy: 0.5, base: 0, tree: false },
  heath: { height: 0.8, canopy: 0.8, base: 0, tree: false },
  /** A composed bed of 2–3 flower colours with an edging stone. */
  flowerBed: { height: 0.45, canopy: 1.2, base: 0, tree: false },
  grassTuft: { height: 0.5, canopy: 0.4, base: 0, tree: false },
  // The Water's Way species (kit/plants/species.ts draws each no larger than this at the same scale).
  reed: { height: 2.4, canopy: 0.65, base: 0, tree: false },
  cattail: { height: 2.4, canopy: 0.6, base: 0, tree: false },
  sedge: { height: 0.9, canopy: 0.6, base: 0, tree: false },
  /** Pads float on the water; `at` is the water surface. */
  lily: { height: 0.2, canopy: 1.15, base: 0, tree: false },
  willow: { height: 9.2, canopy: 4.6, base: 1.2, tree: true },
  tamarack: { height: 9.6, canopy: 2.3, base: 1.2, tree: true },
  spruce: { height: 9.6, canopy: 2.2, base: 0.8, tree: true },
  balsam: { height: 10.6, canopy: 1.95, base: 0.8, tree: true },
  /** The Old Oak (authored single tree, STORY: the Green's landmark): ~36 eu tall, ~60 eu crown at scale 1. */
  oakGiant: { height: 37, canopy: 32, base: 8, tree: true },
  cypress: { height: 14.2, canopy: 1.5, base: 0.6, tree: true },
  olive: { height: 5.6, canopy: 2.8, base: 1.6, tree: true },
  stonePine: { height: 14.4, canopy: 7.2, base: 9, tree: true },
  juniper: { height: 2.7, canopy: 1.6, base: 0, tree: false },
  cedar: { height: 9.8, canopy: 2, base: 0.7, tree: true },
  prairieGrass: { height: 1.3, canopy: 0.6, base: 0, tree: false },
  /** Mexican fan palm 17–24 eu (its trunk stretch carries the height variation; 25 is the tallest drawn). */
  fanPalm: { height: 25, canopy: 4, base: 16, tree: true },
  canaryPalm: { height: 9.6, canopy: 6.2, base: 6, tree: true },
  fern: { height: 1.2, canopy: 1.2, base: 0, tree: false },
  /** A back-row canopy card (dense woods): never planted near a road, it stands behind the front rows. */
  woodlandCard: { height: 14, canopy: 5, base: 2, tree: true },
  iceplant: { height: 0.35, canopy: 1.1, base: 0, tree: false },
  /** A wall climber: grows up its wall (local −z behind it). */
  bougainvillea: { height: 4.4, canopy: 1.4, base: 0, tree: false },
  lemonPot: { height: 1.8, canopy: 0.7, base: 0, tree: false },
  dogwood: { height: 2.1, canopy: 1.2, base: 0, tree: false },
  apple: { height: 5.4, canopy: 2.8, base: 1.4, tree: true },
});
/** Length of a hedge segment along its yaw, per unit scale (Mountain v2 hedges use stretch 2.6). */
export const HEDGE_LENGTH = 2.6;

export const heightOf = (species: PlantSpecies, scale: number): number => PLANT_FORM[species].height * scale;
export const canopyOf = (species: PlantSpecies, scale: number): number => PLANT_FORM[species].canopy * scale;

/**
 * Flower colour sets for `flowerBed` and `flowering` items: `tint` in [k/6, (k+1)/6) selects set k.
 * The coast beds (R10/R11) use 0–2, the prairie (R7) 3–5, the Green's verges 0, 2, 5.
 */
export const FLOWER_SETS = Object.freeze(['beachRose', 'seaThrift', 'lupine', 'coneflower', 'bluestem', 'yarrow'] as const);
export const flowerTint = (set: number, jitter: number): number => (Math.max(0, Math.min(5, set)) + 0.15 + 0.7 * jitter) / 6;
