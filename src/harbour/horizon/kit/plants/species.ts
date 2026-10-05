/**
 * The Water's Way plant species (neighbourhoods/types.ts `DressingSpecies`, land/corridor/types.ts `PlantSpecies`): the
 * table the planting machinery (`runtime/corridorPlanting.ts`) reads to draw them — layer family (far radius), lite
 * share, wind, shadow casting, ink shells, double-sided cards, the palms' trunk stretch, the contact shadow — and each
 * species' colours per dressing. Geometry is `wwGeometry.ts` (and `oak.ts` for the Old Oak).
 *
 * Conventions (as the rest of the corridor kit): `at` is the root on the final ground (a lily's root is the water
 * surface), `scale` uniform (1 = the unit archetype below), `yaw` about +y, `lean` tilts trees toward local +x.
 * `tint`'s fraction is the 0…1 variation (hashed from the position when absent).
 *
 * Variants by rule (STYLE §1.4.4 and the prototypes), never by a second species id:
 * - Newfoundland `spruce` is black spruce (narrow, drooping, clubbed top); at scale ≤ 0.7 it is tuckamore (wind-clipped,
 *   flat-topped mats; the Crown's dwarf spruce → tuckamore swap). Classic/Taylor `spruce` is white spruce.
 * - Newfoundland `tamarack`: every third (variation < 1/3) is drawn as a black spruce (the Reach prototype rule).
 * - `woodlandCard`: variation < 0.5 is a conifer-spire card, else a broadleaf card; Newfoundland's are all spires
 *   (black spruce and balsam replace the maples, STYLE §2 Scholars).
 * - `fanPalm` / `canaryPalm`: the variation picks the trunk height (17–24 m and 6.5–8 m at scale 1) by stretching the
 *   trunk only, as the corridor palm does.
 */
import type { PlantSpecies } from '../../land/corridor/types.ts';
import type { MountainArtPalette } from '../../../mountain/art/palette.ts';
import { mix, rgb, shade, type RGB } from '../../../art/cardKit.ts';
import type { LayerFamily } from './archetypes.ts';

export const WW_SPECIES = [
  'reed', 'cattail', 'sedge', 'lily', 'willow', 'tamarack', 'spruce', 'balsam', 'oakGiant',
  'cypress', 'olive', 'stonePine', 'juniper', 'cedar', 'prairieGrass', 'fanPalm', 'canaryPalm',
  'fern', 'woodlandCard', 'iceplant', 'bougainvillea', 'lemonPot', 'dogwood', 'apple',
] as const satisfies readonly PlantSpecies[];
export type WWSpecies = (typeof WW_SPECIES)[number];
export const isWW = (s: PlantSpecies): s is WWSpecies => (WW_SPECIES as readonly string[]).includes(s);

export type WWSpec = {
  family: LayerFamily;
  /** Wind amplitude (the v2 formula: bend above 0.6 local × amp). */
  wind: number;
  /** Casts into the shadow map on the full tier. */
  cast: boolean;
  /** Has a back-face ink shell on the full tier (closed crowns only). */
  shell: boolean;
  /** Drawn double-sided (cards: blades, fronds, curtains, pads); back faces darken to 0.62 or show Taylor's paper backing. */
  double: boolean;
  /** Palms: the unit trunk top (eu) the material stretches; crown vertices carry `aCrown`. */
  stretchTop?: number;
  /** Contact shadow radius at scale 1 (0 = none). */
  contact: number;
  /** Back-face value (double-sided cards; default STYLE §1.1's 0.62): thin blades and fronds are lit through, ~0.85. */
  back?: number;
};
const tree = (wind: number, contact: number, shell = true, double = false): WWSpec => ({ family: 'tree', wind, cast: true, shell, double, contact });
export const WW_SPEC: Readonly<Record<WWSpecies, WWSpec>> = Object.freeze({
  reed: { family: 'reed', wind: 0.05, cast: false, shell: false, double: true, back: 0.88, contact: 0 },
  cattail: { family: 'reed', wind: 0.045, cast: false, shell: false, double: true, back: 0.88, contact: 0 },
  sedge: { family: 'reed', wind: 0.06, cast: false, shell: false, double: true, back: 0.88, contact: 0 },
  lily: { family: 'bed', wind: 0, cast: false, shell: false, double: true, contact: 0 },
  willow: { ...tree(0.02, 4, true, true), back: 0.8 },
  tamarack: tree(0.012, 2),
  spruce: tree(0.01, 2),
  balsam: tree(0.01, 1.8),
  oakGiant: { family: 'landmark', wind: 0.0015, cast: true, shell: true, double: false, contact: 26 },
  cypress: tree(0.008, 1.3),
  olive: tree(0.016, 3),
  stonePine: tree(0.006, 6),
  juniper: { family: 'shrub', wind: 0.01, cast: true, shell: true, double: false, contact: 1.4 },
  cedar: tree(0.01, 1.8),
  prairieGrass: { family: 'shrub', wind: 0.07, cast: false, shell: false, double: true, back: 0.88, contact: 0 },
  fanPalm: { family: 'palm', wind: 0.003, cast: true, shell: false, double: true, stretchTop: 17.6, back: 0.8, contact: 1.6 },
  canaryPalm: { family: 'palm', wind: 0.006, cast: true, shell: false, double: true, stretchTop: 7.2, back: 0.8, contact: 3.2 },
  fern: { family: 'bed', wind: 0.03, cast: false, shell: false, double: true, back: 0.8, contact: 0 },
  woodlandCard: { family: 'canopy', wind: 0.004, cast: true, shell: false, double: true, back: 0.85, contact: 0 },
  iceplant: { family: 'bed', wind: 0, cast: false, shell: false, double: false, contact: 0 },
  bougainvillea: { family: 'shrub', wind: 0.01, cast: true, shell: false, double: true, back: 0.8, contact: 0 },
  lemonPot: { family: 'shrub', wind: 0.01, cast: true, shell: false, double: false, contact: 0.5 },
  dogwood: { family: 'shrub', wind: 0.014, cast: true, shell: false, double: true, back: 0.85, contact: 0.9 },
  apple: tree(0.018, 2.8),
});

/** The layer variant an item is drawn as (see the header). `null` = the species' own unit. */
export function wwVariant(species: WWSpecies, theme: 'classic' | 'taylor' | 'newfoundland', scale: number, variation: number): { species: WWSpecies; variant: string | null } {
  if (species === 'spruce') return { species, variant: theme === 'newfoundland' ? (scale <= 0.7 ? 'tuck' : 'black') : null };
  if (species === 'tamarack' && theme === 'newfoundland' && variation < 1 / 3) return { species: 'spruce', variant: 'black' };
  if (species === 'woodlandCard') return { species, variant: theme === 'newfoundland' || variation < 0.5 ? 'spire' : 'round' };
  return { species, variant: null };
}
/** The palms' trunk stretch from the variation: fan palm 17–24 m (unit 19), canary 6.5–8 m trunk (unit 7.2). */
export function wwStretch(species: WWSpecies, variation: number): number {
  if (species === 'fanPalm') return 0.92 + variation * 0.34;
  if (species === 'canaryPalm') return 0.9 + variation * 0.21;
  return 1;
}

/* ------------------------------------------------------------------------------------------------------ colours */

const C = rgb, SNOW: RGB = C('#f1f1ec');
export { SNOW };
const pastel = (c: RGB): RGB => mix(c, [1, 1, 1], 0.3);
const nfTone = (c: RGB): RGB => shade(mix(c, C('#3c5a4a'), 0.1), 0.94);
/** One colour per dressing from a Classic base (Taylor's paper stock is a pastel of it, Newfoundland a cooler, deeper one) unless given. */
const by = (theme: MountainArtPalette['theme'], classic: string | RGB, taylor?: string | RGB, nf?: string | RGB): RGB => {
  const c = typeof classic === 'string' ? C(classic) : classic;
  if (theme === 'taylor') return taylor ? (typeof taylor === 'string' ? C(taylor) : taylor) : pastel(c);
  if (theme === 'newfoundland') return nf ? (typeof nf === 'string' ? C(nf) : nf) : nfTone(c);
  return c;
};
const list = (theme: MountainArtPalette['theme'], classic: string[], taylor?: string[], nf?: string[]): RGB[] =>
  classic.map((c, i) => by(theme, c, taylor?.[i], nf?.[i]));

/** Every Water's Way species' colours in one dressing (the prototypes' tables: Reach, Long Sands, Harbour, Scholars, Flats). */
export function wwColours(pal: MountainArtPalette) {
  const t = pal.theme;
  return {
    reed: list(t, ['#7f9050', '#8d9a58', '#9aa060', '#6f8446', '#a3a465'], ['#9cc5a1', '#b5d6b2', '#a8c79a', '#c3dcb4', '#8fbf9a'], ['#7a8a4c', '#8a9454', '#96995c', '#6c7e44', '#a09c62']),
    straw: by(t, '#c2ac6e', '#ecdcc0', '#b9a46a'),
    cattailHead: by(t, '#6b4a32', '#b0828a', '#5e3f2a'),
    seedFluff: by(t, '#d8cbb0', '#fff4ea', '#d2c6ae'),
    sedge: list(t, ['#8a9258', '#9a9a62', '#7d8a50'], ['#c8dcb4', '#b8d0a4', '#d6e6c2'], ['#7d8650', '#8e8e5a', '#727e4a']),
    copper: by(t, '#c89a5b', '#e8c49a', '#b98c55'),
    willow: list(t, ['#8aa060', '#9bb06a', '#7f9a56'], ['#b5d6b2', '#a8c79a', '#c3dcb4'], ['#7f965a', '#8ea062', '#76904f']),
    willowTrunk: by(t, '#5a4a3a', '#b08a92', '#5a4a3a'),
    willowTwig: by(t, '#c9a24e', '#ecd09a', '#b8964a'),
    autumnGold: by(t, '#e3b92e', '#f2d38a', '#e7b53c'),
    tamarack: list(t, ['#8fa865', '#9bb36d', '#86a05e'], ['#9cc5a1', '#c3dcb4', '#8fbf9a'], ['#86a05e', '#93a866', '#7e9858']),
    twig: by(t, '#8a7a66', '#cdb6bb', '#7a6a58'),
    bark: by(t, '#5a4334', pal.timber, '#4a3a2e'),
    spruce: list(t, ['#3f5c3e', '#36513a'], ['#8fb59b', '#7fa58e'], ['#445f3c', '#3a5236']),
    spruceTrunk: by(t, '#4b3a2c', '#b08a92', '#3b2c22'),
    balsam: list(t, ['#3a5a4a', '#33503f'], ['#8ab0a8', '#7ea69c'], ['#355a48', '#2f4f40']),
    cypress: list(t, ['#44583a', '#3c5034'], ['#94b28e', '#8aa884'], ['#3d5236', '#34492f']),
    olive: list(t, ['#8c9a6e', '#9aa67c', '#7f8e64'], ['#c3cfae', '#cdd6ba', '#b6c4a2']),
    oliveTrunk: by(t, '#6b5a48', '#c4a9a8', '#5d4e40'),
    stonePine: list(t, ['#4c6a3c', '#557344'], ['#9cc09a', '#a8c8a2']),
    stonePineTrunk: by(t, '#8a5a3e', '#d0a69a', '#7a4f38'),
    juniper: list(t, ['#4b5e3f', '#55684a'], ['#a3bba0', '#adc3aa']),
    cedar: list(t, ['#5a7744', '#4f6c3e'], ['#a8c79a', '#9cbd90']),
    cedarWinter: by(t, '#7a6a3e', '#d9c9a0', '#6d5f3a'),
    cedarTrunk: by(t, '#6a4334', '#c9a0a0', '#5a3a2e'),
    bluestem: by(t, '#8f9c7c', '#c6d3bb', '#86937a'),
    bluestemTip: by(t, '#a8906a', '#e2c8b0', '#9d8664'),
    fanTrunk: by(t, '#9d8d78', '#e3d1cc', '#8d8476'),
    fanSkirt: by(t, '#b0946a', '#ead7b8', '#a08a66'),
    fanFrond: list(t, ['#5f8a3e', '#6d9746', '#557d38', '#7a9a4c'], ['#a4c98e', '#b2d39a', '#9cc286', '#bcd6a2'], ['#4f7f3a', '#5c8a40', '#477333', '#688c46']),
    canaryTrunk: by(t, '#8a7559', '#dcc4bc', '#7d6c56'),
    canaryBall: by(t, '#4f7a36', '#a2c98e', '#466f31'),
    canaryFrond: list(t, ['#557f3a', '#4a7034'], ['#a4c98e', '#98bf84'], ['#4c7634', '#42682f']),
    fern: list(t, ['#5d7d3b', '#6f9046'], ['#a6c98e', '#b4d39c']),
    fernRust: by(t, '#a8743a', '#e6c39a', '#9a6c38'),
    canopy: list(t, ['#4f6b3a', '#5f7f45', '#45633f', '#6d8c4c'], ['#a4bf8b', '#b3c79a', '#8fb07e', '#c0d4a8'], ['#445f3c', '#3a5236', '#4a6b42', '#355a48']),
    canopyAutumn: list(t, ['#c4553a', '#d98a3a', '#b8743a', '#e3b92e'], ['#f0b4a8', '#f2d38a', '#e8c49a', '#f3c4d2'], ['#c8453a', '#d9772f', '#a8573a', '#e7b53c']),
    iceplant: by(t, '#7f9a56', '#b8d4a0', '#6f8c4c'),
    iceplantWinter: by(t, '#9a6a52', '#e0b8b0', '#8a5e4a'),
    iceFlower: list(t, ['#c8467a', '#e9c46a'], ['#f3c4d2', '#f2d38a'], ['#c8453a', '#e7b53c']),
    bract: list(t, ['#c2307a', '#d6409a'], ['#f3a6c8', '#f7bcd6'], ['#c8306e', '#d84a90']),
    bracts: by(t, '#5e7d3e', '#a8c98e', '#567434'),
    terracotta: by(t, '#b8613f', pal.walls[2]!, '#a95638'),
    lemonLeaf: by(t, '#4f6e3a', '#9cc286', '#466534'),
    lemon: by(t, '#f2d02e', '#f6e08a', '#f0c92a'),
    dogwoodStem: by(t, '#a8452f', '#e39a9a', '#b0402c'),
    dogwoodLeaf: by(t, '#5f7f45', '#a6c98e', '#557a4a'),
    dogwoodAutumn: by(t, '#8a3a4a', '#d9a0b0', '#86354a'),
    appleLeaf: list(t, ['#5f7f45', '#6f8d4d'], ['#a4bf8b', '#b3c79a'], ['#557a4a', '#638a55']),
    blossom: pal.blossom,
    fruit: pal.fruit,
    lily: by(t, '#5f7f45', '#9cc5a1', '#5a7842'),
    lilyFlower: by(t, '#f4efe6', '#e8a6bd', '#f5f3ea'),
    oakLeaf: { top: list(t, ['#6a8a4a', '#64844a', '#5f8046'], ['#b4cf98', '#aeca94', '#a8c490'], ['#5f7f45', '#5a7a42', '#557540']),
      mid: list(t, ['#5a7a42', '#557540', '#50703c'], ['#a4c08a', '#9ebb86', '#98b580'], ['#506f3c', '#4b6a3a', '#466536']),
      low: list(t, ['#46613a', '#4a6536'], ['#90ad80', '#94b07c'], ['#3f5a36', '#435e33']),
      autumn: list(t, ['#b8743a', '#a8643a', '#c4893f'], ['#e8c49a', '#e2b892', '#f0d0a2'], ['#a8573a', '#b8693a', '#c47f3a']) },
    oakBark: by(t, '#4a3526', '#b9989c', '#3e3026'),
    paper: pal.paperEdge,
  };
}
export type WWColours = ReturnType<typeof wwColours>;
