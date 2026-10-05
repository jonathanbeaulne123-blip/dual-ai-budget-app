/**
 * Roadside flower and grass sets (ROAD.md §3–§5, STYLE §1.4.2–§1.4.4, §3.2). Pure data: no three.js objects.
 *
 * A `flowerBed` or `grassTuft` item's `tint` carries its SET in the integer part and a per-item variation in the
 * fraction: `tint = FLOWER_SET.shore + 0.37` is a Long Sands bed. Every other species reads only the fraction
 * (a 0…1 variation, as Mountain v2's `tint`); an absent `tint` is hashed from the item's position.
 *
 * Each set is three species in drifts (STYLE §1.4.1 rule 4: one species per drift, never confetti). A species is drawn
 * as a `head` (a five-petal card, the Grand Plan's flower icon) or a `spike` (lupine, foxglove, iris: stacked florets).
 * Newfoundland swaps species (STYLE §1.4.4: clover → lupine; the Flats add lupine at the strip edge; the Reach adds
 * bakeapple and pitcher plant); Taylor keeps the species and cuts them from paper in its palette (§1.3.4).
 */
import { mix, rgb, type RGB } from '../../../art/cardKit.ts';

export type PlantTheme = 'classic' | 'taylor' | 'newfoundland';
export type FlowerForm = 'head' | 'spike';
export type FlowerSpecies = { name: string; colour: RGB; form: FlowerForm };

/** The integer part of a bed's or tuft's `tint`. The plan track picks the set per reach. */
export const FLOWER_SET = Object.freeze({
  /** Long Sands, Tideline (STYLE §3.2 shore): beach rose, sea thrift, lupine. */
  shore: 0,
  /** The Flats (§3.2 dry prairie): purple coneflower, yarrow, wild bergamot; bluestem tufts. */
  prairie: 1,
  /** Town, the Green, Harbour Avenue (§3.2 open meadow): red clover, ox-eye daisy, black-eyed Susan. */
  meadow: 2,
  /** Scholars' Crest (§3.2 woodland): white trillium, wild columbine, foxglove. */
  woodland: 3,
  /** Lakeside / the Reach (§3.2 water): blue flag iris, marsh marigold, Joe-Pye weed. */
  water: 4,
  /** The Water's Way: the Highlands (§3.2 highland): fireweed, harebell, mountain avens (Newfoundland: partridgeberry). */
  highland: 5,
  /** The Water's Way: the warm coast, Little Harbour + Long Sands: red geranium, lavender, white jasmine. */
  warm: 6,
  /** The Water's Way: the Reach's bog margin: sheep laurel, Labrador tea, cranberry (Newfoundland: bakeapple, pitcher plant). */
  bog: 7,
});
export type FlowerSetId = (typeof FLOWER_SET)[keyof typeof FLOWER_SET];
const SET_COUNT = 8;

const s = (name: string, hex: string, form: FlowerForm = 'head'): FlowerSpecies => ({ name, colour: rgb(hex), form });
const CLASSIC: readonly (readonly FlowerSpecies[])[] = [
  [s('beach rose', '#c8467a'), s('sea thrift', '#e6a2bd'), s('lupine', '#6f68b8', 'spike')],
  [s('purple coneflower', '#b25a8e'), s('yarrow', '#efe6cc'), s('wild bergamot', '#b596cf')],
  [s('red clover', '#c44f5c'), s('ox-eye daisy', '#f4efe6'), s('black-eyed Susan', '#e5b53a')],
  [s('white trillium', '#f3eee6'), s('wild columbine', '#c9563d'), s('foxglove', '#b07ab8', 'spike')],
  [s('blue flag iris', '#6c78c2', 'spike'), s('marsh marigold', '#e9c46a'), s('Joe-Pye weed', '#c08aa6')],
  [s('fireweed', '#c65a9a', 'spike'), s('harebell', '#7f86c9'), s('mountain avens', '#f1ecdc')],
  [s('red geranium', '#c8433a'), s('lavender', '#8f7cc0', 'spike'), s('white jasmine', '#f6f1e6')],
  [s('sheep laurel', '#c45a8a'), s('Labrador tea', '#f2eee2'), s('cranberry', '#e2a3b0')],
];
/** Newfoundland: the species swaps of STYLE §1.4.4 / §3.2, in its brighter primaries. */
const NEWFOUNDLAND: readonly (readonly FlowerSpecies[])[] = [
  CLASSIC[0]!,
  [s('purple coneflower', '#b25a8e'), s('yarrow', '#f3f1ea'), s('lupine', '#7b6fb8', 'spike')],
  [s('lupine', '#7b6fb8', 'spike'), s('ox-eye daisy', '#f3f1ea'), s('black-eyed Susan', '#e7b53c')],
  CLASSIC[3]!,
  [s('blue flag iris', '#6c78c2', 'spike'), s('bakeapple', '#e8a14a'), s('pitcher plant', '#8a3b4a')],
  [s('fireweed', '#c8508e', 'spike'), s('harebell', '#7b6fb8'), s('partridgeberry', '#c8453a')],
  CLASSIC[6]!,
  [s('bakeapple', '#e8a14a'), s('pitcher plant', '#8a3b4a'), s('Labrador tea', '#f3f1ea')],
];

/** The three species of a set in a dressing. Taylor: the same species in pastel paper (a quarter toward white). */
export function flowerSet(theme: PlantTheme, tint: number | undefined): readonly FlowerSpecies[] {
  const id = setOf(tint);
  if (theme === 'newfoundland') return NEWFOUNDLAND[id]!;
  if (theme === 'taylor') return CLASSIC[id]!.map(f => ({ ...f, colour: mix(f.colour, [1, 1, 1], 0.26) }));
  return CLASSIC[id]!;
}
/** The set id of a `tint` (integer part, clamped). */
export function setOf(tint: number | undefined): FlowerSetId {
  const id = Math.floor(tint ?? 0);
  return (Number.isFinite(id) ? Math.max(0, Math.min(SET_COUNT - 1, id)) : 0) as FlowerSetId;
}
/** The 0…1 variation of a `tint` (its fraction), or a stable hash of the position when absent. */
export function variationOf(tint: number | undefined, x: number, z: number): number {
  if (tint !== undefined && Number.isFinite(tint)) return tint - Math.floor(tint);
  const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v);
}

/** Grass by set and season: bluestem on the prairie (copper in fall and winter, STYLE §1.4.2), marram on the shore. */
export function grassColour(set: FlowerSetId, stage: BloomStage, leaf: RGB, variation: number): RGB {
  const summer: RGB = set === FLOWER_SET.prairie ? rgb('#8f9c7c') : set === FLOWER_SET.shore ? rgb('#aeb07a') : mix(leaf, rgb('#b8b27a'), 0.18 + variation * 0.12);
  const fall: RGB = set === FLOWER_SET.prairie ? rgb('#c89a5b') : rgb('#c2ac6e');
  if (stage === 'mulch') return mix(fall, rgb('#d9c9a0'), 0.45);
  if (stage === 'fade' || stage === 'leaf') return mix(summer, fall, stage === 'fade' ? 0.55 : 0.8);
  if (stage === 'bud') return mix(summer, rgb('#9fb46e'), 0.25);
  return summer;
}

/** The drawn bloom stage (STYLE §1.4.2) by month: flowers bloom May–Sep, beds are mulched (snow-dusted) Dec–Mar. */
export type BloomStage = 'mulch' | 'bud' | 'bloom' | 'fade' | 'leaf';
export function bloomStage(month: number): BloomStage {
  const m = ((Math.round(month) - 1) % 12 + 12) % 12 + 1;
  return m === 12 || m <= 3 ? 'mulch' : m === 4 ? 'bud' : m <= 9 ? 'bloom' : m === 10 ? 'fade' : 'leaf';
}
/** The month drawn when only a season is known (the runtime's `seasonOf` quarters: Dec–Feb, Mar–May, Jun–Aug, Sep–Nov):
 * their middle month — winter Jan (mulch), spring Apr (bud), summer Jul (bloom), autumn Oct (fade). Pass the real month. */
export const SEASON_MONTH = Object.freeze({ winter: 1, spring: 4, summer: 7, autumn: 10 } as const);
