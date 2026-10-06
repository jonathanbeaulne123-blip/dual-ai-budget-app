/**
 * The corridor plant archetype table: far radii, lite keep shares, and the v2 colour rules restated from
 * `mountain/art/plantArt.ts` (its `leafFor`, trunk and shrub colours are inline there, so they are restated here
 * verbatim rather than re-invented). Geometry comes from `geometry.ts` and from v2's own `crownGeometry` /
 * `trunkGeometry` / `crownOf`.
 */
import type { TreeKind } from '../../../mountain/planting.ts';
import type { MountainArtPalette } from '../../../mountain/art/palette.ts';
import { mix, shade, type RGB } from '../../../art/cardKit.ts';
import type { PlantSpecies } from '../../land/corridor/types.ts';

export type PlantSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export const TREE_KINDS: readonly TreeKind[] = ['round', 'fruit', 'birch', 'pine', 'alpine', 'poplar'];
export const isTree = (s: PlantSpecies): s is TreeKind => (TREE_KINDS as readonly string[]).includes(s);

/**
 * Far radius (eu, camera to instance in xz) per layer family and tier. An instance scales in over the last FADE_BAND
 * (25 eu) inside its own far radius; per-instance radii thin a family progressively between `far × thin` and `far`
 * (each instance fading on its own), and never below NEAR_FLOOR. So everything is at full size within
 * NEAR_FLOOR − FADE_BAND = 85 eu of the camera: 70 eu ahead of a rider is at most 70 + 5.4 (the activity camera's
 * trail) from the camera (ROAD §8: nothing visibly disappears in front of the rider).
 * Ink shells stop at 160 (inside STYLE §1.2 rule 7's 180); lite has no shells.
 */
export const FAR = Object.freeze({
  tree: { full: 380, lite: 260, thin: 0.5 },
  // Ink shells end at 160 (fading from 135): STYLE §1.2 rule 7 has ink at zero by 180; a 1-px outline beyond ~135 eu
  // on a 4 eu crown is sub-pixel, and the corridor's reach budget (ROAD §8) needs the saving on long avenues.
  shell: { full: 160, lite: 0, thin: 1 },
  palm: { full: 380, lite: 260, thin: 0.8 },
  shrub: { full: 200, lite: 150, thin: 0.65 },
  bed: { full: 160, lite: 125, thin: 0.8 },
  // A 0.2 eu flower head is < 2 px beyond ~90 eu (fov 58, 900 px): blooms and tufts end at the floor.
  bloom: { full: 110, lite: 110, thin: 1 },
  tuft: { full: 110, lite: 110, thin: 1 },
  contact: { full: 150, lite: 115, thin: 1 },
  dots: { full: 120, lite: 110, thin: 1 },
  // The Water's Way (kit/plants/species.ts). Marsh clumps (reed, cattail, sedge): a 2 m clump is still a few pixels at
  // 200 eu and the Reach's lookouts look across the marsh; thinned from 0.55 so the 4,400-clump district stays cheap.
  reed: { full: 220, lite: 150, thin: 0.55 },
  // Back-row woodland cards: the canopy seen across a valley (Scholars from the elevator top, the Greenway's bluff).
  canopy: { full: 700, lite: 450, thin: 0.7 },
  // A landmark tree (the Old Oak): seen from the previous place's lookout (Fallswatch → oak ≈ 475 eu, STORY sight chain).
  landmark: { full: 2400, lite: 2400, thin: 1 },
});
export type LayerFamily = keyof typeof FAR;
export const NEAR_FLOOR = 110;
/** A far radius for one instance: its family's far, thinned by a stable per-item rank (0…1), floored. */
export function farOf(family: LayerFamily, tier: 'full' | 'lite', rank: number): number {
  const f = FAR[family], far = f[tier];
  if (far <= 0) return 0;
  return Math.max(Math.min(NEAR_FLOOR, far), far * (f.thin + (1 - f.thin) * rank));
}
/** Lite keeps this share of each group's items of a species (its first, last and largest are always kept). */
export const LITE_KEEP: Record<PlantSpecies, number> = {
  round: 0.7, fruit: 0.7, birch: 0.7, pine: 0.7, poplar: 0.7, alpine: 0.7, palm: 0.75,
  shrub: 0.55, flowering: 0.55, hedge: 0.75, heath: 0.5, flowerBed: 1, grassTuft: 0.4,
  // The Water's Way: dense ground layers keep little on lite (the drift's first, last and largest still stay), trees
  // most of their groves, the authored and few-of-a-kind trees everything. Woodland cards 0.45: Scholars' Edge's
  // 60–70 % canopy (≈ 1,455 back-row cards) fits the 60k lite district budget with its trees (test/horizonDressingLayer).
  reed: 0.3, cattail: 0.3, sedge: 0.25, lily: 0.4, prairieGrass: 0.3, fern: 0.35, iceplant: 0.4, woodlandCard: 0.45,
  willow: 0.7, tamarack: 0.6, spruce: 0.55, balsam: 0.55, oakGiant: 1, cypress: 0.7, olive: 0.6, stonePine: 1,
  juniper: 0.5, cedar: 0.55, fanPalm: 0.75, canaryPalm: 1, bougainvillea: 0.6, lemonPot: 0.5, dogwood: 0.5, apple: 0.6,
};

/** Mountain v2's leaf colour (plantArt `leafFor`): autumn tint on round, birch and poplar; pines keep their green. */
export function leafColour(pal: MountainArtPalette, kind: TreeKind, tint: number, season: PlantSeason): RGB {
  const L = pal.leaf, base = kind === 'pine' || kind === 'alpine' ? pal.pine[Math.floor(tint * pal.pine.length) % pal.pine.length]! : L[Math.floor(tint * L.length) % L.length]!;
  const autumn = season === 'autumn' && (kind === 'round' || kind === 'birch' || kind === 'poplar') ? mix(base, tint > 0.5 ? [0.78, 0.52, 0.22] : [0.72, 0.62, 0.25], 0.2 + tint * 0.25) : base;
  return shade(mix(autumn, kind === 'birch' ? [0.75, 0.85, 0.55] : autumn, 0.25), 0.92 + tint * 0.16);
}
/** v2's trunk colour: birch white, the rest bark brown. */
export const trunkColour = (pal: MountainArtPalette, kind: TreeKind, tint: number): RGB => (kind === 'birch' ? pal.birch : shade(pal.timber, 0.9 + tint * 0.25));
/** v2's shrub colours (heath, hedge, bush). */
export const shrubColour = (pal: MountainArtPalette, kind: 'shrub' | 'flowering' | 'hedge' | 'heath', tint: number): RGB =>
  kind === 'heath' ? shade(mix(pal.heath, pal.leaf[0]!, tint * 0.4), 0.9 + tint * 0.15) : kind === 'hedge' ? shade(pal.pine[0]!, 1.05 + tint * 0.1) : shade(pal.leaf[Math.floor(tint * pal.leaf.length) % pal.leaf.length]!, 0.85 + tint * 0.2);
/** A clipped hedge segment's length at scale 1 (v2's avenue hedges: `stretch` 2.6, drawn at size 0.8 → 2.08 eu). */
export const HEDGE_STRETCH = 2.6;
