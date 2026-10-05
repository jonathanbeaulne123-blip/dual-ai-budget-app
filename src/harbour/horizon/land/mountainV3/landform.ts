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
 * Forms, large to small (V3.1, D-WW50…59, 2026-10-05): one ridge system — the crest from Westwatch to the horn, spurs falling
 * south off it with rill gullies between them, and the benches as shelves on the spurs; the Glacier Peak horn (its top 30 m
 * at ~55° between two arêtes) over the cirque's headwall (the ice is terrain, painted snow); the gorges that carry the water
 * off the ring; the Veil's one curved amphitheatre on the lake face; the knolls the places stand on; and stepped strata on
 * every cliff (3.2 m beds, in the definition: `V3_STRATA`). Walkable slopes stay ≤ 40° where a path or bench is meant to be
 * walked.
 */
import type { XY } from '../interfaces';
import { clamp, contains, mix, polygonDistance, segmentPoint, smooth } from '../terrain/geometry';
import { mountainV2Rule } from '../mountainV2/ground';
import { V3_FALLS } from './water';

/** Smooth max / min (differentiable blends the 5 m lattice can draw). */
export const smax = (a: number, b: number, k: number): number => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k / 4; };
export const smin = (a: number, b: number, k: number): number => -smax(-a, -b, k);

/** Crest line: [x, z, crest height, crest half-width]. */
export type Spine = readonly (readonly [number, number, number, number])[];
/** `blend`: the smooth-max width it joins the ground with (default 12 m; the horn's arêtes stand sharp at 3). */
export interface Ridge { id: string; spine: Spine; slope: number; blend?: number }
/** A bench: a level (or gently graded) shelf. `shape` is the superellipse exponent of its outline (2 an ellipse, 4 a rounded
 * rectangle: a shelf); `grade` tilts its level along its own u / v axes (rise per metre; |grade| ≤ 0.08 keeps it a shelf). */
export interface Bench { id: string; at: XY; radii: readonly [number, number]; yaw: number; level: number; bank: number; note: string; shape?: number; grade?: readonly [number, number] }
export interface Gorge { id: string; floor: readonly (readonly [number, number, number])[]; width: number; wall: number; note: string }
export interface Knoll { id: string; at: XY; r: number; top: number }

/** Mountain v2's summit (its observatory) stays the island's highest point: nothing V3 raises reaches it. */
export const V2_SUMMIT_HEIGHT = 163, V3_CEILING = 157;

/**
 * Glacier Peak: the horn north-east of v2's summit dome (158 observatory, 163 ground). V3.1: its top 30 m (126 → 156) stand at
 * `face` (rise/run 1.43, ≈ 55°) as a cone round the summit, and two arêtes stand proud of the cone: the east arête (to the Rim
 * Bridge col; the north crest joins it at its shoulder [1412,386]) and the south-west arête down to the glacier's east lip. The
 * cirque lies between them on the west: the horn's west face is the cirque's headwall over the ice.
 */
export const GLACIER_PEAK = { id: 'glacierPeak', at: [1402, 398] as XY, top: 156, note: 'the horn; Glacier Peak' } as const;
/** The horn's cone: flat within `cap` m of the summit, `face` (rise per metre) through its top `band` m, then `foot` below. */
export const HORN = { cap: 1, face: 1.6, band: 30, foot: .9 } as const;
export const V3_RIDGES: readonly Ridge[] = [
  // The east arête, from the summit over its north-east shoulder (where the crest joins) down to the Rim Bridge col; the col
  // itself (≈ 112) stays open for the Rim Walk. Its crest is narrow (half-width 1.5 at the summit) and its flanks steep.
  { id: 'glacierPeak.arete', slope: 1.55, blend: 3, spine: [[GLACIER_PEAK.at[0], GLACIER_PEAK.at[1], GLACIER_PEAK.top, 1.5], [1412, 386, 148, 2.5], [1436, 392, 134, 6], [1458, 410, 118, 10]] },
  // The south-west arête (second arête, D-WW52): from the summit down to the glacier's east lip, where the Col Rill leaves the
  // ice (gorge.eastLip notches it); beyond the notch the cirque's south rim carries it on west. It stands across the line of
  // sight from both the Rim Walk (the horn bears SSE) and the east rim (it bears NNW), so the horn shows two skylines from each.
  { id: 'glacierPeak.southWest', slope: 1.55, blend: 3, spine: [[GLACIER_PEAK.at[0], GLACIER_PEAK.at[1], GLACIER_PEAK.top, 1.5], [1393, 409, 147, 2.5], [1386, 418, 139.5, 3]] },
  // The cirque's south rim: the ice is held by a moraine lip rising from v2's north face (D-M2: higher ground wins north of 470).
  { id: 'glacier.southRim', slope: .7, spine: [[1322, 438, 146, 10], [1348, 442, 147, 10], [1378, 436, 148, 9]] },
  // The crest (V3.1, D-WW50): one ridge from Westwatch Chapel to the horn. West of the Throat it is the Rim Walk's spine; past the
  // Throat buttress it keeps up over the col north of Glacier Springs and climbs the horn's north ridge to the east arête.
  { id: 'rim.north', slope: .55, spine: [[1048, 332, 92, 10], [1080, 348, 104, 12], [1120, 352, 112, 12], [1160, 352, 116, 14], [1200, 346, 121, 14], [1240, 342, 126, 14]] },
  // East of the Orchard Bench the crest runs on over the Throat's head and the col north of Glacier Springs: a narrower ridge with
  // steeper sides (it must not lift the north face over the coast drive's cutting, nor the Crown Rill's bank south of it).
  { id: 'rim.col', slope: 1, blend: 6, spine: [[1240, 342, 126, 8], [1280, 346, 129, 6], [1320, 348, 131, 6], [1352, 350, 128, 5], [1380, 352, 128, 4], [1398, 357, 132, 3]] },
  // …and its last pitch up the horn's north ridge to the east arête's shoulder: narrow and steep-sided, like the arêtes.
  { id: 'glacierPeak.north', slope: 1.5, blend: 3, spine: [[1398, 357, 132, 3], [1408, 370, 141, 2.5], [1412, 386, 148, 2]] },
  // The east rim between the bridge col and Split Wall: a rounded crest the ring path follows.
  { id: 'rim.east', slope: .6, spine: [[1458, 410, 118, 12], [1476, 450, 116, 14], [1486, 500, 114, 14], [1490, 540, 112, 14]] },
  // The Rim Bridge: a connecting ridge from the east rim over Horizon Drive (in its Rim Tunnel) to the Prow headland; the
  // Rim Steps descend it. 27° at its steepest: a walkable grassy shoulder, not a wall.
  { id: 'rim.bridge', slope: .5, spine: [[1522, 536, 104, 12], [1548, 544, 84, 12], [1570, 548, 72, 12], [1596, 552, 62, 12]] },
];
/**
 * The spurs (V3.1, D-WW50): rounded ridges falling south off the crest; the benches are shelves on them. Raise-only, gentle
 * (their crests stand 1–2 m over the flanks): the west spur carries Westwatch's knoll and the west wall's ledges, the long
 * hamlet spur carries Bench Hamlet, the Twin Tarns shelf on its east flank and the spur crown over the Veil, and the orchard
 * spur carries Orchard Bench onto v2's apron.
 */
export const V3_SPURS: readonly Ridge[] = [
  { id: 'spur.westwatch', slope: .45, spine: [[1048, 332, 92, 6], [1040, 318, 90, 8], [1032, 300, 82, 6]] },
  { id: 'spur.hamlet', slope: .35, spine: [[1080, 348, 104, 8], [1076, 384, 103, 8], [1082, 420, 104, 10], [1106, 462, 105.5, 8], [1117, 520, 103, 7], [1120, 580, 97.5, 7], [1116, 616, 96, 7]] },
  { id: 'spur.orchard', slope: .4, spine: [[1200, 346, 121, 10], [1200, 360, 117.5, 10], [1204, 386, 119, 8]] },
];
/** The rill gullies (V3.1, D-WW50): dry V cuts down the crest's north flank and the west wall between the spurs, where no route
 * runs. Floor polyline [x, z, floor], floor width, wall slope; lower only (a gorge with no water). */
export const V3_RILLS: readonly Gorge[] = [
  { id: 'rill.north.1', width: 2, wall: .9, note: 'a dry rill down the crest\'s north flank west of the hamlet spur', floor: [[1092, 327, 103.8], [1090, 316, 96], [1088, 305, 85.8], [1086, 296, 73.4]] },
  { id: 'rill.north.2', width: 2, wall: .9, note: 'a dry rill down the crest\'s north flank north of the Twin Tarns', floor: [[1146, 330, 110.5], [1150, 318, 106], [1153, 306, 95.5], [1155, 297, 88.5]] },
  { id: 'rill.north.3', width: 2, wall: .9, note: 'a dry rill down the crest\'s north flank north of Orchard Bench', floor: [[1178, 312, 108.5], [1179, 303, 94], [1180, 295, 88]] },
  { id: 'rill.west.1', width: 2, wall: .9, note: 'a dry rill down the west wall between Westwatch\'s knoll and the west ledge', floor: [[1052, 356, 102.1], [1042, 357, 80.4], [1032, 358, 79.2], [1020, 359, 65]] },
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
  { id: 'bench.tarns', at: [1128, 392], radii: [34, 22], yaw: .15, level: 106, bank: 10, note: 'the Twin Tarns shelf, on the hamlet spur\'s east flank' },
  // V3.1 (D-WW53): Bench Hamlet is a shelf, a rounded rectangle 72 × 44 m (it holds a 60 × 35 m rectangle) graded 4 % down to the
  // north so the hamlet lane from Westwatch arrives on it nearly at grade; its long axis runs NNW–SSE along the lane and the
  // Fallswatch lane's first stretch, the Rillcut on its east edge, the west ledge below its west edge.
  { id: 'bench.hamlet', at: [1078, 416], radii: [36, 22], yaw: -1.45, level: 104, bank: 10, shape: 4, grade: [.04, 0], note: 'Bench Hamlet: the west shelf as farmed high pasture, room for nine crofts beside the lane' },
  { id: 'bench.hamlet.lower', at: [1040, 462], radii: [15, 8], yaw: .2, level: 96, bank: 8, note: 'the hamlet\'s lower field, a step down on the west rim above the Hollow' },
  { id: 'bench.westLedge', at: [1040, 402], radii: [6, 40], yaw: .05, level: 80, bank: 6, note: 'the mid ledge on the west wall below the hamlet shelf' },
  { id: 'bench.orchard', at: [1200, 358], radii: [30, 16], yaw: .1, level: 117, bank: 10, note: 'Orchard Bench: fruit trees beside the rill, on the orchard spur' },
  // V3.1 (D-WW54): the spur crown pulled 15 m north, clear of the Veil amphitheatre.
  { id: 'bench.spurCrown', at: [1108, 635], radii: [20, 24], yaw: 0, level: 96, bank: 9, note: 'the spur crown: Spur Tarn (narrowed on the east so it never fills the valley under the spur)' },
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
  // V3.1 (D-WW53): it runs down the hamlet shelf's east edge (not across it), then west to its lip.
  { id: 'gorge.rillcut', width: 5, wall: 1.2, note: 'the Rillcut: the Lower Tarn\'s outlet cuts the west bench to its lip', floor: [[1103, 407, 102.5], [1103.5, 428, 101.5], [1101, 450, 100.5], [1094, 466, 99.5], [1083, 486, 98.4], [1071, 508, 97.5]] },
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
 * The Veil amphitheatre (V3.1, D-WW54): one curved bowl on the Shoulder's lake face at z ≈ 700 (the Stillwater tunnel runs
 * inside it at y 50–59 and keeps its cover; its west portal trench stays). Behind the lip a shallow upper bowl gathers the
 * outlet to the lip; below it a U of rock — the back wall under the lip and the two buttresses' inner faces — rounds the pool,
 * open to the lake on the south. The west buttress is a flat-topped block (Fallswatch stands on it) set west of the lip, its
 * east face the bowl's west wall; the east buttress is the knife-edge over v2's Foot (V3 may not cut v2's ground).
 */
export const VEIL = {
  lip: { x: [1086, 1136] as const, z: 699, height: 94.6 },
  /** The upper bowl behind the lip (lower only, to lip − 1.2 at its centre). */
  bowl: { at: [1111, 688] as XY, radii: [26, 12] as const },
  /** The U below the lip (superellipse, power 3): inside it, south of the back wall's foot, the ground falls to the pool's rim. */
  amphitheatre: { at: [1111, 712] as XY, radii: [25, 13] as const, power: 3, floor: 55, face: [699.5, 702.5] as const },
  /** West buttress: a rounded block (superellipse power 4), flat at `top` to e 0.75, falling to `foot` by e 1.2. */
  west: { at: [1072, 697] as XY, radii: [14, 13] as const, top: 97, foot: 56 },
  east: { at: [1148, 700] as XY, r: 9, top: 92, foot: 56 },
} as const;

/** Stepped strata (V3.1, D-WW51; STYLE §2.7, §3.3 Crown set): on every V3 cliff the ground steps in 3.2 m beds — a riser over
 * most of each bed, a lit ledge at its top. Applied in the definition to V3's own ground (never v2's footprint), weighted by the
 * local slope (none below `minSlope`, `mix` at `fullSlope` and over), clear of the falls' lips. */
export const V3_STRATA = { band: 3.2, minSlope: .55, fullSlope: 1, mix: .55, minHeight: 40, step: 2.5, clearOfLips: 8 } as const;
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

/** The spurs lift at most this much, within this distance beyond their crest's half-width (m). */
export const SPUR_LIFT = 2.5, SPUR_REACH = 10;
/** The nearest point of a spine: its crest height, half-width and the plan distance to it. */
function spineAt(r: Ridge, x: number, z: number): { h: number; w: number; d: number } {
  let best = { h: 0, w: 0, d: Infinity };
  for (let i = 1; i < r.spine.length; i++) {
    const a = r.spine[i - 1]!, b = r.spine[i]!, q = segmentPoint(x, z, [a[0], a[1]], [b[0], b[1]]);
    if (q.distance < best.d) best = { h: mix(a[2], b[2], q.t), w: mix(a[3], b[3], q.t), d: q.distance };
  }
  return best;
}
function ridgeHeight(r: Ridge, x: number, z: number): number {
  let best = -Infinity;
  for (let i = 1; i < r.spine.length; i++) {
    const a = r.spine[i - 1]!, b = r.spine[i]!, q = segmentPoint(x, z, [a[0], a[1]], [b[0], b[1]]);
    const h = mix(a[2], b[2], q.t), w = mix(a[3], b[3], q.t);
    best = Math.max(best, h - r.slope * (Math.sqrt(q.distance * q.distance + w * w) - w));
  }
  return best;
}
function benchLocal(at: XY, yaw: number, x: number, z: number): { u: number; v: number } {
  const c = Math.cos(yaw), s = Math.sin(yaw), dx = x - at[0], dz = z - at[1];
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}
function ellipseFraction(at: XY, radii: readonly [number, number], yaw: number, x: number, z: number, power = 2): number {
  const { u, v } = benchLocal(at, yaw, x, z);
  return power === 2 ? Math.hypot(u / radii[0], v / radii[1]) : (Math.abs(u / radii[0]) ** power + Math.abs(v / radii[1]) ** power) ** (1 / power);
}
export function benchWeight(b: Bench, x: number, z: number): number {
  const e = ellipseFraction(b.at, b.radii, b.yaw, x, z, b.shape ?? 2);
  if (e <= 1) return 1;
  return 1 - smooth((e - 1) * Math.min(b.radii[0], b.radii[1]) / b.bank);
}
/** A bench's level at (x, z): its `level` at the centre, tilted by `grade` along its own axes. */
export function benchLevel(b: Bench, x: number, z: number): number {
  if (!b.grade) return b.level;
  const { u, v } = benchLocal(b.at, b.yaw, x, z);
  return b.level + b.grade[0] * u + b.grade[1] * v;
}
/** The horn's cone height at (x, z): flat over the cap, `HORN.face` through the top band, `HORN.foot` below it. */
export function hornHeight(x: number, z: number): number {
  const r = Math.hypot(x - GLACIER_PEAK.at[0], z - GLACIER_PEAK.at[1]), band = HORN.cap + HORN.band / HORN.face;
  return r <= band ? GLACIER_PEAK.top - HORN.face * Math.max(0, r - HORN.cap) : GLACIER_PEAK.top - HORN.band - HORN.foot * (r - band);
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
/** The V3 target ground at (x, z) given the Horizon's height there (after the v2 rule), before freedom, the v2 blend and strata. */
export function v3Target(x: number, z: number, h0: number): number {
  let h = h0;
  for (const r of V3_RIDGES) { const ridge = ridgeHeight(r, x, z), k = r.blend ?? 12; if (ridge > h - k) h = smax(h, ridge, k); }
  // A spur rounds its own crest only: it lifts the ground by at most SPUR_LIFT within a few metres of its spine (never a mound
  // over the flanks below it, which belong to the gorges, the Hollow and the lake face).
  for (const r of V3_SPURS) { const q = spineAt(r, x, z); if (q.d < q.w + SPUR_REACH) h += clamp(q.h - h, 0, SPUR_LIFT) * (1 - smooth((q.d - q.w) / SPUR_REACH)); }
  { const horn = hornHeight(x, z); if (horn > h - 4) h = smax(h, horn, 2); }
  for (const k of V3_KNOLLS) { const d = Math.hypot(x - k.at[0], z - k.at[1]) / k.r; if (d < 1) h = Math.max(h, k.top - (k.top - h0) * (1 - (1 - d * d) * (1 - d * d))); }
  // The cirque is scooped out of the horn's and the summit dome's shared flank, then the ice fills it.
  { const e = ellipseFraction(CIRQUE.at, CIRQUE.radii, CIRQUE.yaw, x, z); if (e < 1.6) { const bowl = CIRQUE.floor + CIRQUE.rise * e * e; h = e < 1 ? smin(h, bowl, 6) : mix(smin(h, bowl, 6), h, smooth((e - 1) / .6)); } }
  { const ice = glacierSurface(x, z); if (ice !== null) h = smax(h, ice, 3); }
  for (const b of V3_BENCHES) { const w = benchWeight(b, x, z); if (w > 0) h = mix(h, benchLevel(b, x, z), w); }
  // A gorge cuts down to its profile; where the rim it runs along falls away (Split Wall's west flank, the Rillcut at the
  // plateau edge) it also carries a 6 m rock shoulder 0.6 above its floor, so the stream never runs along a brink: a cut
  // stream has two banks (the water test reads both at 4.5 m beyond the water's edge).
  for (const g of V3_GORGES) { const p = gorgeProfile(g, x, z); if (p.d < 40) { h = smin(h, p.profile, 3); const shoulder = g.width / 2 + 6; if (p.d < shoulder) h = Math.max(h, p.floor + .6 * smooth((shoulder - p.d) / 3)); } }
  // The rill gullies: dry V cuts (lower only), faded out over their first and last floor points' ends by the floor itself.
  for (const g of V3_RILLS) { const p = gorgeProfile(g, x, z); if (p.d < 12) h = Math.min(h, smin(h, p.profile, 1.5)); }
  // The Veil (one amphitheatre): the upper bowl behind the lip (lower only, to lip − 1.2 along a shallow dish), the buttresses
  // (raise only), then the U below the lip: south of the back wall's face the ground inside the U falls to the pool's rim.
  { const e = ellipseFraction(VEIL.bowl.at, VEIL.bowl.radii, 0, x, z); if (e < 1.5) { const dish = VEIL.lip.height - 1.2 * (1 - Math.min(1, e * e)); h = mix(Math.min(h, dish), h, smooth((e - 1) / .5)); } }
  { const w = VEIL.west, e = ellipseFraction(w.at, w.radii, 0, x, z, 4); if (e < 1.2) h = Math.max(h, w.top - (w.top - w.foot) * smooth((e - .75) / .45)); }
  { const b = VEIL.east, d = Math.hypot(x - b.at[0], z - b.at[1]) / b.r; if (d < 1) h = Math.max(h, b.top - (b.top - b.foot) * d * d * d); }
  { const a = VEIL.amphitheatre, e = ellipseFraction(a.at, a.radii, 0, x, z, a.power);
    if (e < 1.15 && z > a.face[0] - 1) { const fall = smooth((z - a.face[0]) / (a.face[1] - a.face[0])), wall = smooth((1.15 - e) / .15); h = mix(h, Math.min(h, mix(VEIL.lip.height - 1.2, a.floor, fall)), wall); } }
  // Nothing V3 raises stands over the horn's summit (156; V3_CEILING 157 is the hard limit under v2's summit).
  return Math.min(h, GLACIER_PEAK.top, V3_CEILING);
}
/** The terraced height for the strata rule: each 3.2 m bed is a riser over its middle 70 % and a ledge at its top. */
export function strataStep(h: number): number {
  const band = V3_STRATA.band, k = Math.floor(h / band), f = h / band - k, t = clamp((f - .15) / .7);
  return (k + t * t * (3 - 2 * t)) * band;
}
const LIPS = V3_FALLS.map(f => f.lip);
function nearLip(x: number, z: number, r: number): boolean {
  for (const lip of LIPS) for (let i = 1; i < lip.length; i++) if (segmentPoint(x, z, lip[i - 1]!, lip[i]!).distance < r) return true;
  for (const lip of LIPS) if (Math.hypot(x - lip[0]![0], z - lip[0]![1]) < r) return true;
  return false;
}
/**
 * The layer: the Horizon's ground after the v2 rule becomes V3's target where V3 is free to act. Inside v2's land south of
 * its summit line the rule's own ground stands; north of it the higher wins (D-M2), and at v2's land edge the change
 * feathers over 24 m so no step is left along the footprint. `pre` samples the Horizon's ground before V3 at another point
 * (terrain/index.ts passes it); with it the strata rule reads the local slope of V3's ground. Without it (probes) no strata.
 */
export function mountainV3Height(x: number, z: number, h: number, pre?: (x: number, z: number) => number): number {
  const out = v3Layer(x, z, h);
  if (!pre || out === h && v3Freedom(x, z) <= 0) return out;
  // Stepped strata: V3's own cliffs (off v2's footprint, clear of the falls' lips) terrace in 3.2 m beds by local slope.
  if (out < V3_STRATA.minHeight) return out;
  const rule = mountainV2Rule(x, z);
  if (rule.kind === 'land' || rule.kind === 'island' || rule.kind === 'foot') return out;
  const f = v3Freedom(x, z);
  if (f <= 0 || nearLip(x, z, V3_STRATA.clearOfLips)) return out;
  const e = V3_STRATA.step, gx = (v3Layer(x + e, z, pre(x + e, z)) - out) / e, gz = (v3Layer(x, z + e, pre(x, z + e)) - out) / e, slope = Math.hypot(gx, gz);
  if (slope <= V3_STRATA.minSlope) return out;
  const w = V3_STRATA.mix * smooth((slope - V3_STRATA.minSlope) / (V3_STRATA.fullSlope - V3_STRATA.minSlope)) * f;
  return mix(out, strataStep(out), w);
}
/** V3's ground before strata: the target where V3 is free to act, blended with v2's rule (below). */
function v3Layer(x: number, z: number, h: number): number {
  const f = v3Freedom(x, z);
  if (f <= 0) return h;
  const target = v3Target(x, z, h), rule = mountainV2Rule(x, z);
  if (rule.kind === 'land' || rule.kind === 'island' || rule.kind === 'foot') {
    if (!rule.north) return h;
    return Math.max(h, mix(h, target, f));
  }
  // On v2's apron V3 acts gently (a quarter at the footprint edge) so the seam stays smooth, except on a bench: a bench is a
  // place to stand (High Shieling Ranch at 61.5 sits on the apron 45 m from v2's edge) and holds its level fully.
  // V3.1: the horn stands across v2's north apron edge (its summit is on the line): within 40 m of the summit the apron takes V3
  // in full, as v2's north land beside it does, so the horn is one form, not cut at the footprint line.
  if (rule.kind === 'apron') { const bench = Math.max(0, ...V3_BENCHES.map(b => benchWeight(b, x, z))), horn = rule.north ? 1 - smooth((Math.hypot(x - GLACIER_PEAK.at[0], z - GLACIER_PEAK.at[1]) - 40) / 20) : 0; const w = Math.max(mix(.25, 1, rule.apronWeight), bench, horn); return mix(h, target, f * w); }
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
  benchHamlet: [1080, 440] as XY, westwatchChapel: [1036, 318] as XY, orchardBench: [1200, 356] as XY, fallswatch: [1082, 692.5] as XY,
  rimBridge: [1566, 545] as XY, rimLookout: [1516, 548] as XY, highShieling: [1436, 694] as XY, splitWall: [1492, 576] as XY, stairFalls: [1490, 660] as XY,
  veilFalls: [1111, 699] as XY, rillcutFalls: [1068, 512] as XY, longFalls: [1099, 568] as XY, spurFalls: [1082, 645] as XY,
} as const;
export const insideV3Reach = (x: number, z: number): boolean => contains(V3_REACH, x, z);
export { clamp };
