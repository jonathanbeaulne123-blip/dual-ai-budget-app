/**
 * Mountain V3 water (D-M11): the glacier-fed network that carved the ring. One definition: Glacier Springs at the snout,
 * a west branch (the Crown Rill → Twin Tarns → the Rillcut → Rillcut Falls; Spur Tarn → Veil Falls and Spur Falls) and an
 * east branch (the Col Rill → Split Wall Gorge → Stair Falls → Shieling Beck → the mountain brook → Stillwater).
 *
 * Reaches and basins become ordinary `WaterCut`s (land/water buildWaterCuts appends them): the bake carves their beds and
 * banks, collision reads their level, boats float on the pools. Falls are `FallCut`s: a lip line at its height falling to
 * a foot; the renderer draws the curtain and the foam, the bake checks that each lip stands on ground and each foot lands
 * in a pool or stream. Nothing here reads household state; every level is authored (CONTRACT §2.2: nature never encodes
 * money). The reservoir inside Mountain v2 is not part of this network.
 */
import type { FallCut, WaterCut, XY, XYZ } from '../interfaces';
import { ellipse, lineOutline } from '../terrain/geometry';
import { poolSteps } from '../water';

/** A graded reach: plan points with the surface level at each. */
export interface Reach { id: string; kind: WaterCut['kind']; pts: readonly (readonly [number, number, number])[]; width: number; depth: number; bank?: number; note: string }
export interface Basin { id: string; at: XY; radii: readonly [number, number]; level: number; depth: number; bank?: number; note: string }
export interface Fall { id: string; label: string; lip: readonly XY[]; top: number; foot: number; outward: XY; pool: string; lean?: number; note: string }

export const V3_REACHES: readonly Reach[] = [
  // The Crown Rill: from Glacier Springs west along the north bench, past the Orchard Bench, into the Upper Tarn.
  { id: 'water.v3.crownRill', kind: 'brook', width: 3, depth: .6, bank: .5, note: 'the Crown Rill: glacier melt west along the north bench to the Twin Tarns', pts: [[1386, 374, 126.6], [1366, 366, 125.5], [1344, 361, 124.5], [1318, 356, 122.5], [1292, 356, 120.5], [1266, 358, 119], [1240, 361, 117.4], [1214, 365, 116.2], [1190, 371, 113.5], [1178, 377, 109.8], [1166, 381, 106.4]] },
  // The tarn link: the Upper Tarn spills to the Lower over a short cascade.
  { id: 'water.v3.tarnLink', kind: 'brook', width: 2.4, depth: .5, bank: .4, note: 'the Upper Tarn\'s spill to the Lower Tarn', pts: [[1143, 385, 105.3], [1136, 389, 104.7], [1129, 393, 104], [1122, 398, 102.8]] },
  // The Rillcut: the Lower Tarn's outlet across the hamlet's lower field to the west wall's lip.
  // The Long Beck: the Rillcut splits on a gravel bar at [1082,456]; the south branch runs down the hamlet's lower field in a cut
  // channel (the plateau stands 100.6–102 beside it) to the west wall's lip at the Long Cut, the island's longest fall.
  { id: 'water.v3.longBeck', kind: 'brook', width: 2.4, depth: .6, bank: .5, note: 'the Long Beck: the Rillcut\'s south branch to Long Falls', pts: [[1082, 456, 99.2], [1088, 476, 99], [1093, 500, 98.6], [1095, 526, 98.2], [1097, 550, 97.8], [1098.5, 564, 97.5]] },
  { id: 'water.v3.rillcut', kind: 'brook', width: 3, depth: .7, bank: .5, note: 'the Rillcut: the Lower Tarn\'s outlet to Rillcut Falls', pts: [[1103, 406, 102.2], [1092, 428, 100.6], [1082, 456, 99.2], [1076, 484, 98], [1072, 505, 97.2]] },
  // Rillcut Falls' plunge pool drains under the Year Walk into the Hollow and on to the brook.
  { id: 'water.v3.hollowRill', kind: 'brook', width: 2.6, depth: .6, bank: .5, note: 'the Hollow Rill: from the Rillcut pool west under the Year Walk into the Hollow Tarn', pts: [[1050, 520, 45.9], [1032, 516, 45.4], [1012, 510, 44.8], [988, 506, 44.3]] },
  // Spur Tarn's two outlets: south over the Veil lip, west through the Spur cut.
  { id: 'water.v3.veilOutlet', kind: 'brook', width: 3.2, depth: .5, bank: .4, note: 'Spur Tarn to the Veil lip', pts: [[1112, 664, 95], [1111, 680, 94.7], [1111, 696, 94.3]] },
  { id: 'water.v3.spurSpill', kind: 'brook', width: 2.2, depth: .5, bank: .4, note: 'Spur Tarn\'s west spill to Spur Falls', pts: [[1102, 652, 94.9], [1096, 658, 94.4], [1089, 654, 93.6], [1085, 646, 92.3]] },
  // Spur Falls' pool is a talus pool: it soaks away under the scree (no surface outlet). Veil Pool drains under the walks to the lake.
  { id: 'water.v3.veilOut', kind: 'brook', width: 4, depth: .6, bank: .4, note: 'Veil Pool over its sill, under the lakerim walks, into Stillwater', pts: [[1124, 715, 53.2], [1124, 720, 52.3], [1124, 727, 51.2], [1124, 740, 50.1]] },
  // The Col Rill: Glacier Springs east round the horn's north foot to the Rim Bridge col, then down into Split Wall Gorge.
  { id: 'water.v3.colRill', kind: 'brook', width: 3, depth: .6, bank: .5, note: 'the Col Rill: the glacier\'s east lip, down the horn\'s south-east flank to the Rim Bridge col', pts: [[1386, 419, 136.3], [1396, 426, 134.3], [1408, 436, 130.8], [1422, 446, 125.8], [1438, 452, 120.3], [1452, 456, 115.3]] },
  { id: 'water.v3.splitWall', kind: 'brook', width: 4, depth: .7, bank: .6, note: 'Split Wall Gorge: the east branch down the east rim\'s west flank; the gorge floor is the stream', pts: [[1452, 456, 115.3], [1468, 464, 111.8], [1478, 476, 108.8], [1484, 490, 106.6], [1490, 520, 103], [1492, 548, 100.6], [1492, 576, 98.2], [1492, 604, 96], [1496, 630, 93.8], [1500, 646, 92.4]] },
  // The Shieling Beck: from the foot of Stair Falls west across the apron and the Foot's edge to the mountain brook.
  { id: 'water.v3.shielingBeck', kind: 'brook', width: 3.2, depth: .6, bank: .5, note: 'the Shieling Beck: Shieling Pool west past the ranch into the Shieling Mere at the valley\'s mouth', pts: [[1464, 690, 61.8], [1456, 704, 60.8], [1444, 712, 59.8], [1432, 716, 58.6], [1430, 718, 57.2]] },
];
export const V3_BASINS: readonly Basin[] = [
  { id: 'water.v3.glacierSprings', at: [1388, 375], radii: [8, 5.5], level: 126.8, depth: 1.6, bank: .4, note: 'Glacier Springs: the melt pool at the snout' },
  { id: 'water.v3.upperTarn', at: [1154, 381], radii: [11, 8], level: 105.6, depth: 3, bank: .6, note: 'the Upper Tarn' },
  { id: 'water.v3.lowerTarn', at: [1112, 400], radii: [10, 7.5], level: 102.4, depth: 3, bank: .6, note: 'the Lower Tarn' },
  { id: 'water.v3.rillcutPool', at: [1056, 519], radii: [6, 6], level: 46.2, depth: 2.6, bank: .5, note: 'Rillcut Falls\' plunge pool' },
  { id: 'water.v3.hollowTarn', at: [975, 506], radii: [10, 7], level: 44, depth: 2.4, bank: .5, note: 'the Hollow Tarn: the Rillcut\'s water gathers in the Hollow\'s north bowl and soaks away' },
  { id: 'water.v3.spurTarn', at: [1112, 654], radii: [11, 8], level: 95.2, depth: 2.8, bank: .6, note: 'Spur Tarn on the spur crown' },
  { id: 'water.v3.longPool', at: [1083, 568], radii: [8, 6], level: 45.5, depth: 2.2, bank: .5, note: 'Long Falls\' plunge pool on the Long Cut\'s floor' },
  { id: 'water.v3.spurPool', at: [1069, 650], radii: [8, 6], level: 55.8, depth: 2.2, bank: .5, note: 'Spur Falls\' pool' },
  { id: 'water.v3.veilPool', at: [1111, 711], radii: [21, 4], level: 53.5, depth: 2.6, bank: .5, note: 'Veil Pool: the plunge pool under the Veil' },
  { id: 'water.v3.stairPool', at: [1492, 661], radii: [5, 4], level: 78, depth: 1.6, bank: .4, note: 'Stair Falls: the step pool between the two drops' },
  { id: 'water.v3.shielingMere', at: [1416, 722], radii: [15, 9], level: 56.4, depth: 2.4, bank: .5, note: 'the Shieling Mere: the east valley\'s water gathers in a shallow mere over the Foot and soaks away' },
  { id: 'water.v3.shielingPool', at: [1470, 683], radii: [9, 6], level: 62, depth: 2.2, bank: .5, note: 'Shieling Pool: the foot of Stair Falls' },
];
/** The falls. `outward` is the unit plan direction the curtain faces (away from the rock). */
export const V3_FALLS: readonly Fall[] = [
  { id: 'fall.veil', label: 'Veil Falls', lip: [[1088, 699], [1096, 699.5], [1104, 699.8], [1112, 700], [1120, 699.8], [1128, 699.5], [1136, 699]], top: 94.3, foot: 53.5, outward: [0, 1], pool: 'water.v3.veilPool', note: 'the hero: a 40 m curtain off the Shoulder\'s lake face into Veil Pool and Stillwater' },
  { id: 'fall.rillcut', label: 'Rillcut Falls', lip: [[1067, 503], [1067.5, 507], [1068, 511]], top: 97.2, foot: 46.2, outward: [-1, .15], pool: 'water.v3.rillcutPool', note: 'a 51 m ribbon off the west wall into the Hollow; the brook\'s last reach runs below the plateau edge so its west bank stands above it' },
  { id: 'fall.long', label: 'Long Falls', lip: [[1099, 564], [1099.5, 568], [1099, 572]], top: 97.4, foot: 45.5, outward: [-1, 0], pool: 'water.v3.longPool', lean: 9, note: 'a 52 m fall into the Long Cut, the west wall\'s second curtain' },
  { id: 'fall.spur', label: 'Spur Falls', lip: [[1083, 642], [1083, 645], [1083, 648]], top: 92.2, foot: 55.8, outward: [-1, .1], pool: 'water.v3.spurPool', note: 'a 36 m ribbon off the spur\'s west face' },
  { id: 'fall.stair.upper', label: 'Stair Falls', lip: [[1504, 647], [1502, 649], [1500, 651]], top: 92.4, foot: 78, outward: [-.7, .7], pool: 'water.v3.stairPool', note: 'the upper drop, off Split Wall\'s mouth' },
  { id: 'fall.stair.lower', label: 'Stair Falls', lip: [[1489, 663], [1487, 665], [1485, 667]], top: 78, foot: 62, outward: [-.7, .7], pool: 'water.v3.shielingPool', note: 'the lower drop, into Shieling Pool' },
];
/** Which V3 water a reach or fall hands its water to (for the map and the no-orphan test). */
export const V3_FLOW: readonly (readonly [string, string])[] = [
  ['water.v3.glacierSprings', 'water.v3.crownRill'],  ['water.v3.crownRill', 'water.v3.upperTarn'], ['water.v3.upperTarn', 'water.v3.tarnLink'],
  ['water.v3.tarnLink', 'water.v3.lowerTarn'], ['water.v3.lowerTarn', 'water.v3.rillcut'], ['water.v3.rillcut', 'fall.rillcut'], ['fall.rillcut', 'water.v3.rillcutPool'], ['water.v3.rillcutPool', 'water.v3.hollowRill'], ['water.v3.hollowRill', 'water.v3.hollowTarn'],
  ['water.v3.spurTarn', 'water.v3.veilOutlet'], ['water.v3.veilOutlet', 'fall.veil'], ['fall.veil', 'water.v3.veilPool'], ['water.v3.veilPool', 'water.v3.veilOut'], ['water.v3.veilOut', 'water.stillwater'],
  ['water.v3.rillcut', 'water.v3.longBeck'], ['water.v3.longBeck', 'fall.long'], ['fall.long', 'water.v3.longPool'],
  ['water.v3.spurTarn', 'water.v3.spurSpill'], ['water.v3.spurSpill', 'fall.spur'], ['fall.spur', 'water.v3.spurPool'],
  ['water.v3.colRill', 'water.v3.splitWall'], ['water.v3.splitWall', 'fall.stair.upper'], ['fall.stair.upper', 'water.v3.stairPool'], ['water.v3.stairPool', 'fall.stair.lower'], ['fall.stair.lower', 'water.v3.shielingPool'], ['water.v3.shielingPool', 'water.v3.shielingBeck'], ['water.v3.shielingBeck', 'water.v3.shielingMere'],
];
/** The Col Rill leaves the glacier itself at its east lip (no pool). Spur Tarn feeds the Spur crown from the Twin Tarns' shelf by a hidden seep (the spur's rock holds the shelf's water): no surface reach is drawn between them. */
export const V3_SEEPS: readonly { from: string; to: string; note: string }[] = [{ from: 'water.v3.lowerTarn', to: 'water.v3.spurTarn', note: 'the Spur Tarn is spring-fed from the tarn shelf through the spur\'s rock' }];

export function buildMountainV3Waters(s = 1): WaterCut[] {
  const reaches = V3_REACHES.map((r): WaterCut => {
    const controls: XYZ[] = r.pts.map(p => [p[0] * s, p[2] * s, p[1] * s]);
    const points = poolSteps(controls, s);
    return { id: r.id, kind: r.kind, points, outline: lineOutline(points, r.width * s), level: controls[0]![1], width: r.width * s, depth: r.depth * s, bank: (r.bank ?? .6) * s };
  });
  const basins = V3_BASINS.map((b): WaterCut => ({ id: b.id, kind: 'lake', outline: ellipse(b.at[0] * s, b.at[1] * s, b.radii[0] * s, b.radii[1] * s, 32), points: [], level: b.level * s, width: b.radii[0] * 2 * s, depth: b.depth * s, bank: (b.bank ?? .6) * s }));
  return [...reaches, ...basins];
}
export function buildMountainV3Falls(s = 1): FallCut[] {
  return V3_FALLS.map((f): FallCut => ({ id: f.id, label: f.label, lip: f.lip.map((p): XY => [p[0] * s, p[1] * s]), top: f.top * s, foot: f.foot * s, outward: f.outward, poolId: f.pool, lean: f.lean === undefined ? undefined : f.lean * s, note: f.note }));
}
export const isMountainV3Water = (id: string): boolean => id.startsWith('water.v3.');
