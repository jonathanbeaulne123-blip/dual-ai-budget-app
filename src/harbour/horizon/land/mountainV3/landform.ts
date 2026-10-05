/**
 * Mountain V3 · The Highlands and the Falls (D-M11, Jonathan 2026-10-04): the one definition of the reshaped ring of
 * high ground around Mountain v2, in Horizon space. Everything V3 draws, cuts, waters, walks and audits derives from
 * the constants here and in ./water.ts; nothing else authors this ground.
 *
 * Applied by `land/terrain/index.ts baseHeight` after the D-M1/D-M2 Mountain v2 rule and before the shore, the Notch and
 * the named water. Inside v2's own land south of its summit line v2's ground stands untouched; north of that line the
 * higher ground wins (D-M2), which lets the glacier's col climb onto v2's north face. Beds, pads and water are cut after
 * this layer by the terrain solve as usual, so roads keep their benches and the tarns carve their own beds.
 *
 * Forms, large to small: the Glacier Peak horn and its cirque (the ice is terrain, painted snow), the highland benches
 * (uneven, never equal bands), the three gorges that carry the water off the ring, the Veil amphitheatre on the lake
 * face, and the knolls the places stand on. Walkable slopes stay ≤ 40° where a path or bench is meant to be walked.
 */
import type { XY } from '../interfaces';
import { clamp, contains, mix, polygonDistance, segmentPoint, smooth } from '../terrain/geometry';
import { mountainV2Rule } from '../mountainV2/ground';

/** Smooth max / min (differentiable blends the 5 m lattice can draw). */
export const smax = (a: number, b: number, k: number): number => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k / 4; };
export const smin = (a: number, b: number, k: number): number => -smax(-a, -b, k);

/** Crest line: [x, z, crest height, crest half-width]. */
export type Spine = readonly (readonly [number, number, number, number])[];
export interface Ridge { id: string; spine: Spine; slope: number }
export interface Bench { id: string; at: XY; radii: readonly [number, number]; yaw: number; level: number; bank: number; note: string }
export interface Gorge { id: string; floor: readonly (readonly [number, number, number])[]; width: number; wall: number; note: string }
export interface Knoll { id: string; at: XY; r: number; top: number }

/** Mountain v2's summit (its observatory) stays the island's highest point: nothing V3 raises reaches it. */
export const V2_SUMMIT_HEIGHT = 163, V3_CEILING = 157;

/**
 * Glacier Peak: a three-faced horn north-east of v2's summit dome (158 observatory, 163 ground). Its west face falls
 * into the cirque that holds the glacier; its north face is the Crown's north wall over the coast drive; its east face
 * stands over the Rim Bridge col.
 */
export const GLACIER_PEAK = { id: 'glacierPeak', at: [1402, 398] as XY, top: 156, note: 'the horn; Glacier Peak' } as const;
export const V3_RIDGES: readonly Ridge[] = [
  // The horn: a short steep crest, its summit slightly off-centre so the three faces differ.
  { id: 'glacierPeak.horn', slope: 1.05, spine: [[1394, 408, 149, 6], [1402, 398, GLACIER_PEAK.top, 5], [1412, 386, 148, 6]] },
  // Its north-east arête down toward the Rim Bridge col; the col itself (≈ 112) stays open for the Rim Walk.
  { id: 'glacierPeak.arete', slope: .8, spine: [[1412, 386, 148, 8], [1436, 392, 134, 10], [1458, 410, 118, 12]] },
  // The cirque's south rim: the ice is held by a moraine lip rising from v2's north face (D-M2: higher ground wins north of 470).
  { id: 'glacier.southRim', slope: .7, spine: [[1322, 438, 146, 10], [1348, 442, 147, 10], [1378, 436, 148, 9]] },
  // The north crest west of the Throat: the Rim Walk's spine from the Orchard Bench to Westwatch; uneven, never a wall.
  { id: 'rim.north', slope: .55, spine: [[1240, 342, 126, 14], [1200, 346, 121, 14], [1160, 352, 116, 14], [1120, 352, 112, 12], [1080, 348, 104, 12], [1048, 332, 92, 10]] },
  // The east rim between the bridge col and Split Wall: a rounded crest the ring path follows.
  { id: 'rim.east', slope: .6, spine: [[1458, 410, 118, 12], [1476, 450, 116, 14], [1486, 500, 114, 14], [1490, 540, 112, 14]] },
  // The Rim Bridge: a connecting ridge from the east rim over Horizon Drive (in its Rim Tunnel) to the Prow headland; the
  // Rim Steps descend it. 27° at its steepest: a walkable grassy shoulder, not a wall.
  { id: 'rim.bridge', slope: .5, spine: [[1522, 536, 104, 12], [1548, 544, 84, 12], [1570, 548, 72, 12], [1596, 552, 62, 12]] },
];
/** The cirque: an ice-scoured bowl between the horn and the summit dome. Floor at its deepest point; rises as a parabola. */
export const CIRQUE = { at: [1358, 412] as XY, radii: [34, 25] as const, yaw: -.35, floor: 135, rise: 10 } as const;
/**
 * The glacier: ice filling the cirque to a convex lens, its tongue flowing north-east and thinning to the snout. Terrain
 * (so the body stands on it) painted `snow`; a moraine of `scree` rings it. The snout melts into Glacier Springs (water.ts).
 */
export const GLACIER = { at: [1356, 410] as XY, radii: [31, 22] as const, yaw: -.35, crown: 143, tongue: { to: [1388, 374] as XY, half: 9, snout: 128 } } as const;

/** The highland benches: terraces of unequal size and height; each carries a place or a stretch of the ring path. */
export const V3_BENCHES: readonly Bench[] = [
  { id: 'bench.hamlet', at: [1086, 418], radii: [42, 30], yaw: .2, level: 104, bank: 14, note: 'Bench Hamlet: the west plateau as farmed high pasture' },
  { id: 'bench.hamlet.lower', at: [1052, 452], radii: [22, 16], yaw: .5, level: 96, bank: 10, note: 'the hamlet\'s lower field, a step down toward the Rillcut' },
  { id: 'bench.westLedge', at: [1046, 400], radii: [11, 44], yaw: .05, level: 80, bank: 8, note: 'the mid ledge on the west wall the Couloir switchbacks use' },
  { id: 'bench.orchard', at: [1200, 358], radii: [30, 16], yaw: .1, level: 117, bank: 10, note: 'Orchard Bench: fruit trees beside the rill' },
  { id: 'bench.tarns', at: [1128, 392], radii: [34, 22], yaw: .15, level: 106, bank: 10, note: 'the Twin Tarns shelf' },
  { id: 'bench.spurCrown', at: [1112, 650], radii: [26, 26], yaw: 0, level: 96, bank: 9, note: 'the spur crown: Spur Tarn and Fallswatch' },
  { id: 'bench.ranch', at: [1436, 694], radii: [20, 13], yaw: .1, level: 61.5, bank: 8, note: 'High Shieling Ranch: the shieling in the east valley\'s mouth at the foot of Stair Falls, beside Shieling Pool and the beck' },
  { id: 'bench.col', at: [1462, 420], radii: [20, 14], yaw: .6, level: 114, bank: 8, note: 'the Rim Bridge col, where the east rim walk begins' },
  { id: 'bench.westwatch', at: [1036, 318], radii: [14, 12], yaw: 0, level: 90, bank: 8, note: 'Westwatch Chapel\'s knoll top' },
];
/** Knolls places stand on (raise-only, a rounded dome). */
export const V3_KNOLLS: readonly Knoll[] = [
  { id: 'knoll.westwatch', at: [1036, 318], r: 26, top: 90 },
];
/** The gorges: a floor polyline [x, z, floor height], a floor width and a wall slope (rise per metre beyond the floor). A gorge
 * that carries a reach keeps its floor 0.2–0.4 above the water (the brook cuts its own bed; the banks must stand above it). */
export const V3_GORGES: readonly Gorge[] = [
  // The Rillcut: from the Lower Tarn's outlet across the hamlet's lower field to the west wall's lip (Rillcut Falls).
  { id: 'gorge.rillcut', width: 5, wall: 1.2, note: 'the Rillcut: the Lower Tarn\'s outlet cuts the west bench to its lip', floor: [[1100, 408, 102.3], [1088, 430, 100.8], [1080, 456, 99.5], [1075, 484, 98.3], [1071, 508, 97.5]] },
  // The Long Cut: a box notch in the west wall between Rillcut and Spur Falls (floor at the Hollow's 45), its back wall near
  // vertical (12 per m) so Long Falls hangs in air; the plateau behind it keeps its 100.6 (the Ore Line adit is 28 m north).
  { id: 'gorge.longCut', width: 12, wall: 12, note: 'the Long Cut: the notch Long Falls drops into, off the west wall into the Hollow', floor: [[1074, 568, 45.3], [1090, 568, 45.3]] },
  // The Spur cut: Spur Tarn's west outlet notches the spur's west rim (Spur Falls).
  { id: 'gorge.spurCut', width: 4, wall: 1.3, note: 'Spur Tarn\'s west spill to Spur Falls', floor: [[1100, 652, 95.3], [1096, 658, 94.8], [1089, 654, 94], [1084, 645, 92.6]] },
  // The east lip: the glacier's second outlet, a notch between the horn and the cirque's south rim, down the horn's south-east
  // flank to the Rim Bridge col (the Col Rill).
  { id: 'gorge.eastLip', width: 4, wall: 1.1, note: 'the glacier\'s east lip and the Col Rill\'s cut to the col', floor: [[1384, 418, 136.5], [1396, 426, 134.5], [1408, 436, 131], [1422, 446, 126], [1438, 452, 120.5], [1452, 456, 115.5]] },
  // Split Wall: the east rim split lengthwise by the east branch; its floor steps down to Stair Falls' lip.
  { id: 'gorge.splitWall', width: 7, wall: 1.1, note: 'Split Wall Gorge: the east branch cuts the east rim\'s west flank from the col to Stair Falls\' lip', floor: [[1452, 456, 115.5], [1468, 464, 112], [1478, 476, 109], [1484, 490, 106.8], [1490, 520, 103.2], [1492, 548, 100.8], [1492, 576, 98.4], [1492, 604, 96.2], [1496, 630, 94], [1500, 646, 92.6]] },
];
/**
 * The Veil amphitheatre: the Shoulder's lake face at z ≈ 700 (the Stillwater tunnel runs inside it at y 50–59) becomes a
 * bay: the lip is recessed and two buttresses stand forward either side, so the curtain hangs in a hollow of rock. The
 * tunnel keeps ≥ 30 m of rock over its roof.
 */
export const VEIL = { lip: { x: [1086, 1136] as const, z: 699, height: 94.6 }, bay: { at: [1111, 690] as XY, radii: [30, 14] as const }, buttresses: [{ at: [1070, 698] as XY, r: 11, top: 92 }, { at: [1152, 698] as XY, r: 11, top: 92 }] } as const;

/** Rock the Horizon's other rules own: V3 never moves it. [polygon, feather m]. */
export const V3_KEEP_OUT: readonly { id: string; poly: XY[]; feather: number }[] = [
  // The Throat (P25): its buttress and jambs keep ≥ 131 over the mouth at [1300,300] (land/terrain throatButtress).
  { id: 'throat', poly: [[1200, 240], [1400, 240], [1400, 336], [1200, 336]], feather: 18 },
  // The Deep's skylight saddle at [1300,400], rim 138: a hole in the ground the glacier must not cover.
  { id: 'skylight', poly: [[1268, 368], [1332, 368], [1332, 432], [1268, 432]], feather: 14 },
  // The Rim Bridge col's road: V01 runs through its tunnel here; the land bridge is the structure's, the cutting beyond it the bed's.
];
/** Where V3 may change ground at all (plan, Horizon m). Outside this polygon the island is untouched. */
export const V3_REACH: XY[] = [[1000, 290], [1130, 280], [1260, 300], [1400, 288], [1470, 330], [1540, 420], [1618, 500], [1620, 600], [1530, 700], [1500, 760], [1400, 770], [1300, 740], [1180, 745], [1150, 740], [1040, 740], [1000, 700], [985, 600], [995, 470], [1010, 380]];

function ridgeHeight(r: Ridge, x: number, z: number): number {
  let best = -Infinity;
  for (let i = 1; i < r.spine.length; i++) {
    const a = r.spine[i - 1]!, b = r.spine[i]!, q = segmentPoint(x, z, [a[0], a[1]], [b[0], b[1]]);
    const h = mix(a[2], b[2], q.t), w = mix(a[3], b[3], q.t);
    best = Math.max(best, h - r.slope * (Math.sqrt(q.distance * q.distance + w * w) - w));
  }
  return best;
}
function ellipseFraction(at: XY, radii: readonly [number, number], yaw: number, x: number, z: number): number {
  const c = Math.cos(yaw), s = Math.sin(yaw), dx = x - at[0], dz = z - at[1], u = dx * c - dz * s, v = dx * s + dz * c;
  return Math.hypot(u / radii[0], v / radii[1]);
}
export function benchWeight(b: Bench, x: number, z: number): number {
  const e = ellipseFraction(b.at, b.radii, b.yaw, x, z);
  if (e <= 1) return 1;
  return 1 - smooth((e - 1) * Math.min(b.radii[0], b.radii[1]) / b.bank);
}
/** Gorge profile across its floor line: flat floor, then rock walls at `wall`, eased for 4 m so the lattice draws the lip. */
export function gorgeProfile(g: Gorge, x: number, z: number): { floor: number; profile: number; d: number } {
  let best = { d: Infinity, floor: 0 };
  for (let i = 1; i < g.floor.length; i++) {
    const a = g.floor[i - 1]!, b = g.floor[i]!, q = segmentPoint(x, z, [a[0], a[1]], [b[0], b[1]]);
    if (q.distance < best.d) best = { d: q.distance, floor: mix(a[2], b[2], q.t) };
  }
  const beyond = Math.max(0, best.d - g.width / 2);
  return { floor: best.floor, d: best.d, profile: best.floor + g.wall * beyond * smooth(beyond / 4 + .5) };
}
export function glacierSurface(x: number, z: number): number | null {
  const e = ellipseFraction(GLACIER.at, GLACIER.radii, GLACIER.yaw, x, z);
  const lens = e < 1 ? GLACIER.crown - (GLACIER.crown - CIRQUE.floor - 2) * e * e : -Infinity;
  // The tongue: a sloping ice ramp from the lens edge to the snout.
  const q = segmentPoint(x, z, GLACIER.at, GLACIER.tongue.to), across = Math.max(0, q.distance - GLACIER.tongue.half);
  const tongue = across < 10 && q.t > .3 ? mix(GLACIER.crown - 4, GLACIER.tongue.snout, smooth((q.t - .3) / .7)) - across * across * .35 : -Infinity;
  const ice = Math.max(lens, tongue);
  return Number.isFinite(ice) ? ice : null;
}
/** 1 where V3 may act, 0 where other rules own the rock; feathered. */
export function v3Freedom(x: number, z: number): number {
  const reach = polygonDistance(V3_REACH, x, z);
  if (reach <= 0) return 0;
  let f = smooth(reach / 30);
  for (const k of V3_KEEP_OUT) { const d = polygonDistance(k.poly, x, z); if (d > -k.feather) f *= smooth(-d / k.feather); }
  return f;
}
/** The V3 target ground at (x, z) given the Horizon's height there (after the v2 rule), before freedom and the v2 blend. */
export function v3Target(x: number, z: number, h0: number): number {
  let h = h0;
  for (const r of V3_RIDGES) { const ridge = ridgeHeight(r, x, z); if (ridge > h - 12) h = smax(h, ridge, 12); }
  for (const k of V3_KNOLLS) { const d = Math.hypot(x - k.at[0], z - k.at[1]) / k.r; if (d < 1) h = Math.max(h, k.top - (k.top - h0) * (1 - (1 - d * d) * (1 - d * d))); }
  // The cirque is scooped out of the horn's and the summit dome's shared flank, then the ice fills it.
  { const e = ellipseFraction(CIRQUE.at, CIRQUE.radii, CIRQUE.yaw, x, z); if (e < 1.6) { const bowl = CIRQUE.floor + CIRQUE.rise * e * e; h = e < 1 ? smin(h, bowl, 6) : mix(smin(h, bowl, 6), h, smooth((e - 1) / .6)); } }
  { const ice = glacierSurface(x, z); if (ice !== null) h = smax(h, ice, 3); }
  for (const b of V3_BENCHES) { const w = benchWeight(b, x, z); if (w > 0) h = mix(h, b.level, w); }
  // A gorge cuts down to its profile; where the rim it runs along falls away (Split Wall's west flank, the Rillcut at the
  // plateau edge) it also carries a 6 m rock shoulder 0.6 above its floor, so the stream never runs along a brink: a cut
  // stream has two banks (the water test reads both at 4.5 m beyond the water's edge).
  for (const g of V3_GORGES) { const p = gorgeProfile(g, x, z); if (p.d < 40) { h = smin(h, p.profile, 3); const shoulder = g.width / 2 + 6; if (p.d < shoulder) h = Math.max(h, p.floor + .6 * smooth((shoulder - p.d) / 3)); } }
  // The Veil: recess the bay (lower only, to the lip height along a shallow dish), and stand the buttresses forward.
  { const e = ellipseFraction(VEIL.bay.at, VEIL.bay.radii, 0, x, z); if (e < 1.5) { const dish = VEIL.lip.height - 1.2 * (1 - e * e); h = mix(Math.min(h, dish), h, smooth((e - 1) / .5)); } }
  for (const b of VEIL.buttresses) { const d = Math.hypot(x - b.at[0], z - b.at[1]) / b.r; if (d < 1) h = Math.max(h, b.top - (b.top - 56) * d * d * d); }
  return Math.min(h, V3_CEILING);
}
/**
 * The layer: the Horizon's ground after the v2 rule becomes V3's target where V3 is free to act. Inside v2's land south of
 * its summit line the rule's own ground stands; north of it the higher wins (D-M2), and at v2's land edge the change
 * feathers over 24 m so no step is left along the footprint.
 */
export function mountainV3Height(x: number, z: number, h: number): number {
  const f = v3Freedom(x, z);
  if (f <= 0) return h;
  const target = v3Target(x, z, h), rule = mountainV2Rule(x, z);
  if (rule.kind === 'land' || rule.kind === 'island' || rule.kind === 'foot') {
    if (!rule.north) return h;
    return Math.max(h, mix(h, target, f));
  }
  // On v2's apron V3 acts gently (a quarter at the footprint edge) so the seam stays smooth, except on a bench: a bench is a
  // place to stand (High Shieling Ranch at 61.5 sits on the apron 45 m from v2's edge) and holds its level fully.
  if (rule.kind === 'apron') { const bench = Math.max(0, ...V3_BENCHES.map(b => benchWeight(b, x, z))); const w = Math.max(mix(.25, 1, rule.apronWeight), bench); return mix(h, target, f * w); }
  return mix(h, target, f);
}
/** Ground paint V3 owns: snow on the glacier, scree on its moraine; null elsewhere (the biome rule stands). */
export function v3Paint(x: number, z: number, height: number): 'snow' | 'scree' | null {
  const ice = glacierSurface(x, z);
  if (ice !== null && height >= ice - .6) return 'snow';
  const e = ellipseFraction(GLACIER.at, [GLACIER.radii[0] + 9, GLACIER.radii[1] + 9], GLACIER.yaw, x, z);
  if (e < 1 && v3Freedom(x, z) > .5) return 'scree';
  return null;
}
/** The named forms, for probes, tests and the Journey map. */
export const V3_PLACES = {
  glacierPeak: GLACIER_PEAK.at, glacierSprings: GLACIER.tongue.to, upperTarn: [1154, 381] as XY, lowerTarn: [1112, 400] as XY,
  benchHamlet: [1086, 418] as XY, westwatchChapel: [1036, 318] as XY, orchardBench: [1200, 356] as XY, fallswatch: [1112, 672] as XY,
  rimBridge: [1566, 545] as XY, rimLookout: [1516, 548] as XY, highShieling: [1436, 694] as XY, splitWall: [1492, 576] as XY, stairFalls: [1490, 660] as XY,
  veilFalls: [1111, 699] as XY, rillcutFalls: [1068, 512] as XY, longFalls: [1099, 568] as XY, spurFalls: [1082, 645] as XY,
} as const;
export const insideV3Reach = (x: number, z: number): boolean => contains(V3_REACH, x, z);
export { clamp };
