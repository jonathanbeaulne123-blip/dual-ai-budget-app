/**
 * The Water's Way (docs/horizon/STORY.md, D-303): the single source for the island's story.
 *
 * Seven places and one interlude follow the water downhill, then the coast clockwise (the ferry's direction). Each place is
 * one stage of the water and one hour of the day, and its lookout sees the next place's landmark. Every consumer derives
 * from this file: the sight-chain proofs (test/horizonStorySightChain.test.ts, world/storySight.ts), the evening relay
 * and the noon bells (PR 5), the neighbourhood modules' Landmark/Lookout records (PR 3/4, checked by
 * `validateStoryAgainstDressing`), the Sketchbook pages and the Journey map landmarks.
 *
 * Pure data: no scene, renderer or terrain imports. Units: engine units (1 eu = 1 m at scale 1.0); x east, z south, y up.
 * Positions are the canonical points ruled by the integrator on bake 9d13db2 (RULINGS, 2026-10-05); names are proposals
 * (CONTRACT §2.13). The app never calls these places "Chapters": a Chapter is a month at the Sitdown.
 */
import type { Point2, Point3 } from './definition.ts';
import type { Landmark, Lookout, NeighbourhoodId } from '../neighbourhoods/types.ts';

/* ---------------------------------------------------------------- places */

export type StoryPlaceId = 'highlands' | 'green' | 'reach' | 'harbour' | 'longSands' | 'flats' | 'scholars' | 'hollow';
/** The hour vocabulary of STYLE/LIGHT best hours (MANIFEST `views[*].bestHour`), plus the story's in-between hours. */
export type StoryHour = 'before dawn' | 'dawn' | 'morning' | 'late morning' | 'noon' | 'afternoon' | 'late afternoon' | 'golden hour' | 'sunset' | 'dusk' | 'night';

export interface StoryPlace {
  id: StoryPlaceId;
  /** 1–7 in story order; null for the interlude (the Hollow sits in the middle of the loop, between places 1, 2 and 7). */
  order: number | null;
  label: string;
  neighbourhood: NeighbourhoodId;
  /** MANIFEST district ids the place is dressed in. */
  districts: readonly string[];
  storyHour: { from: StoryHour; to: StoryHour };
  /** The stage of the water this place tells. */
  waterStage: string;
  /** Its hero vertical (STORY_LANDMARKS id); null for the interlude. */
  landmarkId: string | null;
  /** The eye (STORY_EYES id) from which it sees the next place's landmark; null for the interlude. */
  lookoutId: string | null;
}

export const STORY_PLACES: readonly StoryPlace[] = [
  { id: 'highlands', order: 1, label: 'The Highlands', neighbourhood: 'crown', districts: ['crown'], storyHour: { from: 'dawn', to: 'dawn' }, waterStage: 'snow, springs, tarns, six falls', landmarkId: 'westwatch', lookoutId: 'fallswatch' },
  { id: 'green', order: 2, label: 'The Green', neighbourhood: 'lakeside', districts: ['green', 'lakeside'], storyHour: { from: 'morning', to: 'noon' }, waterStage: "the Veil's pool, Stillwater, a still meadow", landmarkId: 'oak', lookoutId: 'oak' },
  { id: 'reach', order: 3, label: 'The Reach', neighbourhood: 'landing', districts: ['reach', 'notch'], storyHour: { from: 'late morning', to: 'late morning' }, waterStage: 'marsh, channels, the river mouth', landmarkId: 'osprey', lookoutId: 'springBay' },
  { id: 'harbour', order: 4, label: 'Little Harbour', neighbourhood: 'harbour', districts: ['harbour'], storyHour: { from: 'afternoon', to: 'golden hour' }, waterStage: 'the river meets the sea', landmarkId: 'campanile', lookoutId: 'belfry' },
  { id: 'longSands', order: 5, label: 'Long Sands', neighbourhood: 'landing', districts: ['landing'], storyHour: { from: 'late afternoon', to: 'sunset' }, waterStage: 'surf, the pier, the strand', landmarkId: 'wheel', lookoutId: 'wheelTop' },
  { id: 'flats', order: 6, label: 'The Flats & the Bight', neighbourhood: 'flats', districts: ['flats', 'bight'], storyHour: { from: 'golden hour', to: 'night' }, waterStage: 'the lagoon, the dry Wash, the sky', landmarkId: 'elevator', lookoutId: 'elevatorTop' },
  { id: 'scholars', order: 7, label: "Scholars' Edge", neighbourhood: 'scholars', districts: ['scholars'], storyHour: { from: 'night', to: 'before dawn' }, waterStage: 'fog, dew, rain in the canopy, the cove', landmarkId: 'library', lookoutId: 'bightLookout' },
  { id: 'hollow', order: null, label: 'The Hollow (interlude)', neighbourhood: 'hollow', districts: ['hollow'], storyHour: { from: 'noon', to: 'noon' }, waterStage: 'Rillcut Falls, the Hollow Tarn, the second stream into Orchard Brook', landmarkId: null, lookoutId: null },
];

/* ---------------------------------------------------------------- the evening relay and the noon bells */

/**
 * At civil dusk the landmarks light in story order, each visible from the one before (LIGHT §7's "one by one").
 * Emissive cards only: the 6 full / 2 lite light pool is untouched; lite keeps every relay card (they are the story).
 * Reduced motion: each card switches on without its fade; the order and timing stay.
 */
export const EVENING_RELAY = {
  start: 'civilDusk' as const,
  order: ['westwatch', 'fallswatch', 'oak', 'osprey', 'campanile', 'wheel', 'elevator', 'library'] as const,
  /** Seconds between one landmark's switch-on and the next. */
  spacingSeconds: 5.5,
  /** Each card's fade-in. 7 × 5.5 + 1.5 = 40 s from civil dusk to the Library windows. */
  fadeSeconds: 1.5,
  /** What lights at each: the chapel lantern, the Fallswatch deck lamp, the Lantern Ring, the osprey-pole lamp, the belfry, the wheel, the elevator beacon, the Library windows. */
  light: 'emissive card' as const,
};
export const RELAY_TOTAL_SECONDS = (EVENING_RELAY.order.length - 1) * EVENING_RELAY.spacingSeconds + EVENING_RELAY.fadeSeconds;
/** Seconds after civil dusk at which a landmark's relay card starts to light (null if it doesn't join). */
export function relayStartSeconds(landmarkId: string): number | null {
  const i = (EVENING_RELAY.order as readonly string[]).indexOf(landmarkId);
  return i < 0 ? null : i * EVENING_RELAY.spacingSeconds;
}

/**
 * At solar noon Westwatch rings, the summit bell answers, then the harbour campanile (extends LIGHT §7's harbour bell and
 * the planned summit-and-harbour answer to three bells across the story). Once a day, respects mute, never on a timer the
 * player can farm; sunrise and sunset ring nothing.
 */
export const NOON_BELLS = {
  at: 'solarNoon' as const,
  beatSeconds: 2.4,
  chain: [
    { id: 'westwatch' as const, landmarkId: 'westwatch', bell: [1038, 95.4, 313.2] as Point3, beat: 0, gain: 1 },
    // The summit bell at L02 (MANIFEST places.L02, the observatory's bell, h 158).
    { id: 'summit' as const, landmarkId: null, bell: [1310, 159.5, 470] as Point3, beat: 1, gain: .85 },
    { id: 'campanile' as const, landmarkId: 'campanile', bell: [1423, 34.3, 1187] as Point3, beat: 2, gain: .7 },
  ],
};

/* ---------------------------------------------------------------- landmarks */

export type StoryLandmarkKind = 'landmark' | 'lookout' | 'feature' | 'compass';
export interface StoryLandmark {
  id: string;
  label: string;
  kind: StoryLandmarkKind;
  /** 'offshore' for the Lamp (MANIFEST district `offshore`). */
  neighbourhood: NeighbourhoodId | 'offshore';
  /** Base [x, ground, z] on bake 9d13db2 (a landmark on a plinth sinks to the lowest ground under it). */
  at: Point3;
  /** The sighted top: the point the sight-chain proofs aim at, less `aimDrop`. */
  top: Point3;
  /** Proofs aim at top − aimDrop (default 2 m: the top must show, not just its tip). */
  aimDrop?: number;
  /** Derived from EVENING_RELAY / NOON_BELLS (one definition). */
  relayOrder?: number;
  bell?: 'westwatch' | 'summit' | 'campanile';
  /** Where the land or the dressing that makes it true is still owed. */
  owed?: string;
}

type LandmarkSource = Omit<StoryLandmark, 'relayOrder' | 'bell'>;
const LANDMARK_SOURCE: readonly LandmarkSource[] = [
  // Westwatch Chapel's bell cote (north gable, "to the sea"), in the Library's verdigris; cote top 96–98.
  { id: 'westwatch', label: 'Westwatch Chapel', kind: 'landmark', neighbourhood: 'crown', at: [1036, 86, 318], top: [1038, 97, 313.2], owed: 'cote height ≥ 96 (PR 3 Highlands)' },
  // The Fallswatch deck on the V3.1 west buttress (PR 2 L1, D-WW54): its 10 × 5 pad on the buttress's cover ridge at 95.8, the
  // eye at its south-east corner over the amphitheatre; a lookout that also lights second in the relay (its deck lamp).
  { id: 'fallswatch', label: 'Fallswatch', kind: 'lookout', neighbourhood: 'crown', at: [1086, 95.8, 694.3], top: [1086, 98.1, 694.3], aimDrop: 0 },
  // The Veil's lip: what Fallswatch must see (not a relay light).
  { id: 'veilLip', label: 'the Veil lip', kind: 'feature', neighbourhood: 'crown', at: [1111, 92, 699], top: [1111, 92, 699], aimDrop: 0 },
  { id: 'oak', label: 'the Old Oak', kind: 'landmark', neighbourhood: 'lakeside', at: [1125, 16.1, 1165], top: [1125, 52, 1165] },
  { id: 'osprey', label: 'the osprey pole', kind: 'landmark', neighbourhood: 'landing', at: [1292, 4.1, 1268], top: [1292, 15.6, 1268] },
  // Apex 42.3 (belfry cornice 38); the shaft stands on a plinth to the lowest ground (10.06).
  { id: 'campanile', label: 'the campanile', kind: 'landmark', neighbourhood: 'harbour', at: [1423, 10.06, 1187], top: [1423, 42.3, 1187] },
  // Hub [1010, 19.6, 1648], r 13, facing NE; at = the pier deck under the hub.
  { id: 'wheel', label: 'the Ferris wheel', kind: 'landmark', neighbourhood: 'landing', at: [1010, 3.6, 1648], top: [1010, 32.6, 1648], owed: 'the pier (PR 2 land)' },
  // On the airport tower footprint: ground 35.5 + 28 m, green-and-white beacon. Side clearance vs the runway owed.
  { id: 'elevator', label: 'the grain elevator', kind: 'landmark', neighbourhood: 'flats', at: [395, 35.5, 706], top: [395, 63.5, 706], owed: 'side clearance vs the strip (PR 4 Flats)' },
  // The Library host (pad 48, greybox roof 62 today); the dressed ridge (verdigris) at 64.
  { id: 'library', label: 'the Library', kind: 'landmark', neighbourhood: 'scholars', at: [740, 48, 400], top: [740, 64, 400] },
  // The baked lighthouse gallery (offshore lamp island); every binocular's shared target.
  { id: 'lamp', label: 'the Lamp', kind: 'compass', neighbourhood: 'offshore', at: [540, 0, 1195], top: [540, 25, 1195] },
];

export const STORY_LANDMARKS: readonly StoryLandmark[] = LANDMARK_SOURCE.map(l => {
  const relay = relayStartSeconds(l.id) === null ? undefined : (EVENING_RELAY.order as readonly string[]).indexOf(l.id) + 1;
  const bell = NOON_BELLS.chain.find(b => b.landmarkId === l.id)?.id;
  return { ...l, ...(relay ? { relayOrder: relay } : {}), ...(bell ? { bell } : {}) };
});
export function storyLandmark(id: string): StoryLandmark {
  const l = STORY_LANDMARKS.find(q => q.id === id);
  if (!l) throw new Error(`Unknown story landmark ${id}`);
  return l;
}
/** The point a proof aims at: the sighted top less its aim drop. */
export function aimPoint(l: StoryLandmark): Point3 { return [l.top[0], l.top[1] - (l.aimDrop ?? 2), l.top[2]]; }

/* ---------------------------------------------------------------- eyes (lookouts) */

export interface StoryEye {
  id: string;
  label: string;
  /** Plan position. */
  at: Point2;
  /** Absolute eye height where the eye stands on a structure not yet in the bake (belfry, wheel cabin, raised deck)… */
  y?: number;
  /** …or the lift above the baked floor (ground or walkable solid) where it stands on what is baked today. */
  lift?: number;
  /** Landmark ids its binoculars find; the first is its story target. Every lookout's binoculars also find the Lamp. */
  targets: readonly string[];
  /** True for a Lookout kit set (viewer, bench, panel, open rail); false for an eye that is a ride or a room. */
  lookout: boolean;
  owed?: string;
}

export const STORY_EYES: readonly StoryEye[] = [
  // Highlands. Fallswatch on the V3.1 west buttress: eye = deck + 1.6 (≈ 97.4) at the deck's south-east corner, south of its
  // lane, so the line to the lip runs over the amphitheatre; sees the Veil lip and the oak.
  { id: 'fallswatch', label: 'Fallswatch (west buttress)', at: [1086, 694.3], lift: 1.6, targets: ['oak', 'veilLip', 'lamp'], lookout: true },
  // Green. Under the oak, at the trunk (the ring bench is at r 6.2; the oak is seen from every spot within 20 m).
  { id: 'oak', label: 'under the Old Oak', at: [1125, 1165], lift: 1.6, targets: ['osprey', 'lamp'], lookout: false },
  // Reach: Spring Bay (deck 5.0, eye 6.6) and the other five Reach lookouts (binocular eyes, reach SPEC §2).
  { id: 'springBay', label: 'Spring Bay', at: [1246.4, 1199.5], y: 6.6, targets: ['campanile', 'osprey', 'lamp'], lookout: true },
  { id: 'notchBluff', label: 'Notch Bluff', at: [1188.51, 1114.3], y: 24.8, targets: ['osprey', 'lamp'], lookout: true, owed: 'stone pad (PR 2 land)' },
  { id: 'highSpanOverlook', label: 'High Span Overlook', at: [1267.77, 1147.3], y: 11.3, targets: ['osprey', 'lamp'], lookout: true },
  { id: 'sunsetRail', label: 'Sunset Rail', at: [1353.98, 1234.78], y: 12.39, targets: ['osprey', 'lamp'], lookout: true, owed: 'stone pad (PR 2 land)' },
  { id: 'harbourBellLanding', label: 'Harbour Bell Landing', at: [1323.53, 1380.94], y: 10.3, targets: ['lamp', 'osprey'], lookout: true },
  // Harbour: the belfry (eye ≈ 34.4, cornice 38).
  { id: 'belfry', label: 'the belfry', at: [1423, 1187], y: 34.4, targets: ['wheel', 'oak', 'lamp'], lookout: true, owed: 'the campanile (PR 3 Harbour)' },
  // Long Sands: the top cabin of the wheel (rim top 32.6; seated eye ≈ 31).
  { id: 'wheelTop', label: 'the top of the wheel', at: [1010, 1648], y: 31, targets: ['elevator', 'oak', 'lamp'], lookout: false, owed: 'the pier and wheel (PR 2 / PR 4)' },
  // Flats: the elevator's head-house gallery (top 63.5).
  { id: 'elevatorTop', label: 'the elevator gallery', at: [395, 706], y: 62, targets: ['library', 'oak', 'lamp'], lookout: false, owed: 'the elevator (PR 4 Flats)' },
  // Scholars: the Bight lookout deck, raised ~2 m (ground 50.0 → deck 52.0, eye 53.6).
  { id: 'bightLookout', label: 'the Bight lookout', at: [744, 511], y: 53.6, targets: ['westwatch', 'oak', 'lamp'], lookout: true, owed: 'the spur and raised deck (PR 2 land, PR 4 Scholars)' },
];
export function storyEye(id: string): StoryEye {
  const e = STORY_EYES.find(q => q.id === id);
  if (!e) throw new Error(`Unknown story eye ${id}`);
  return e;
}

/* ---------------------------------------------------------------- the sight chain */

export interface SightLink {
  from: string;
  to: string;
  /** The clearance measured by world/storySight.ts on bake 9d13db2 (m, baked solids included), for the book; the test re-measures. */
  measured: number;
  /** Set where the link depends on land or dressing not yet built; the proof still runs on today's bake. */
  dependsOn?: string;
  /**
   * Baked solids (source-id prefixes) that block the line today and that an approved, owed change replaces (the reason is
   * `dependsOn`). The proof passes only if these are the sole limit and the line clears with them opened; once the bake no
   * longer limits the line by them, the proof fails until this entry is removed (it cleans itself up).
   */
  owedOccluders?: readonly string[];
}

/** Each place's lookout sees the next place's landmark (≥ 0.5 m clear to top − 2 m, buildings and baked solids included). */
export const SIGHT_CHAIN: readonly SightLink[] = [
  // V3.1 (PR 2 L1): the eye at the deck's south-east corner on the west buttress's cover ridge (deck 95.8).
  { from: 'fallswatch', to: 'oak', measured: 6.51 },
  { from: 'oak', to: 'osprey', measured: 1.6 },
  // 2.89 m with the Reach Footbridge's rails open; on today's bake its 1.15 stone parapet (top 10.65) cuts the line (−0.06 m).
  { from: 'springBay', to: 'campanile', measured: 2.89, dependsOn: 'open timber rails on the Reach Footbridge, seen through by the ray caster (PR 2 land)', owedOccluders: ['reachFootbridge.rails'] },
  { from: 'belfry', to: 'wheel', measured: 22.9 },
  { from: 'wheelTop', to: 'elevator', measured: 18.6 },
  { from: 'elevatorTop', to: 'library', measured: 14 },
  { from: 'bightLookout', to: 'westwatch', measured: 3.2, dependsOn: 'the raised Bight lookout deck (PR 2 land, PR 4 Scholars)' },
];
/** Fallswatch must also see the fall it is named for. */
export const SIGHT_EXTRAS: readonly SightLink[] = [
  { from: 'fallswatch', to: 'veilLip', measured: 2.28 },
];
/** The proof's clearance contract (m). */
export const SIGHT_MIN_CLEARANCE = .5;
/** The Lamp must be in sight from at least this many story eyes. */
export const LAMP_MIN_LOOKOUTS = 6;

/* ---------------------------------------------------------------- every way round */

export interface StoryRoute {
  id: string;
  label: string;
  mode: 'foot' | 'board' | 'canoe' | 'foot+wheel' | 'ferry' | 'glider';
  /** The MANIFEST path that defines it (dot path from the manifest root); null where the route is new and owed. */
  manifest: string | null;
  /** Story places it runs through, in its own direction. */
  places: readonly StoryPlaceId[];
  owed?: string;
}

export const STORY_ROUTES: readonly StoryRoute[] = [
  { id: 'yearWalk', label: 'the Year Walk', mode: 'foot', manifest: 'journey.yearWalk', places: ['highlands', 'green', 'reach', 'harbour', 'longSands', 'flats', 'scholars', 'hollow'] },
  { id: 'S1', label: 'Summit to Sea', mode: 'board', manifest: 'skate.S1', places: ['highlands', 'green', 'reach'] },
  { id: 'RIVER_RUN', label: 'River Run', mode: 'canoe', manifest: 'water_routes.RIVER_RUN', places: ['green', 'reach', 'harbour'] },
  { id: 'greenway', label: 'the Greenway', mode: 'foot+wheel', manifest: null, places: ['reach', 'longSands', 'flats'], owed: 'the Greenway bed and its `greenway` profile (PR 2 land)' },
  // Clockwise from the Landing pier: west along Long Sands, into the Bight, up the west, along the north.
  { id: 'FERRY', label: 'the ferry (clockwise)', mode: 'ferry', manifest: 'water_routes.FERRY', places: ['harbour', 'longSands', 'flats', 'scholars'] },
  { id: 'damRun', label: 'Dam Run', mode: 'glider', manifest: 'sky.courses.damRun', places: ['highlands', 'green', 'reach'] },
  { id: 'lampHop', label: 'the Lamp Hop', mode: 'glider', manifest: 'sky.courses.lampHop', places: ['longSands', 'flats'] },
];

/* ---------------------------------------------------------------- module records vs the registry */

export interface StoryDressingView {
  dressing?: { landmarks?: readonly Pick<Landmark, 'id' | 'at' | 'top'>[]; lookouts?: readonly Pick<Lookout, 'id' | 'eye'>[] } | null;
}
export interface StoryDressingCheck { skipped: boolean; checked: number; problems: string[] }

/**
 * Neighbourhood modules (PR 3/4) emit Landmark and Lookout records with the registry's ids. This checks every emitted
 * landmark matches the registry within tolerance (plan and top height) and every emitted lookout whose id is a story eye
 * stands where the registry says. Records the registry doesn't know are reported; registry landmarks not yet emitted
 * are not (modules land one at a time). Skips gracefully when the world has no dressing yet.
 */
export function validateStoryAgainstDressing(def: StoryDressingView, tolerance: { plan?: number; height?: number } = {}): StoryDressingCheck {
  const plan = tolerance.plan ?? 3, height = tolerance.height ?? 1.5, problems: string[] = [];
  const d = def.dressing;
  if (!d) return { skipped: true, checked: 0, problems };
  let checked = 0;
  for (const m of d.landmarks ?? []) {
    const r = STORY_LANDMARKS.find(q => q.id === m.id);
    if (!r) { problems.push(`landmark ${m.id}: not in the story registry`); continue; }
    checked++;
    const dp = Math.hypot(m.top[0] - r.top[0], m.top[2] - r.top[2]), dh = m.top[1] - r.top[1];
    if (dp > plan) problems.push(`landmark ${m.id}: top ${dp.toFixed(2)} m off the registry in plan (> ${plan})`);
    if (Math.abs(dh) > height) problems.push(`landmark ${m.id}: top ${dh > 0 ? '+' : ''}${dh.toFixed(2)} m off the registry height ${r.top[1]} (> ±${height})`);
    if (Math.hypot(m.at[0] - r.at[0], m.at[2] - r.at[2]) > plan) problems.push(`landmark ${m.id}: base off the registry in plan (> ${plan})`);
  }
  for (const m of d.lookouts ?? []) {
    const r = STORY_EYES.find(q => q.id === m.id);
    if (!r) continue;
    checked++;
    const dp = Math.hypot(m.eye[0] - r.at[0], m.eye[2] - r.at[1]);
    if (dp > plan) problems.push(`lookout ${m.id}: eye ${dp.toFixed(2)} m off the registry in plan (> ${plan})`);
    if (r.y !== undefined && Math.abs(m.eye[1] - r.y) > height) problems.push(`lookout ${m.id}: eye height ${m.eye[1]} vs the registry ${r.y} (> ±${height})`);
  }
  return { skipped: false, checked, problems };
}
