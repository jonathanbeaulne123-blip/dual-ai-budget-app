/**
 * Little Harbour, "cobblestone Italy" (STYLE §2.1 as amended, D-303; protos/harbour SPEC): the town's fixed plan — the
 * places the solver and the dressing read. Every number here is either derived from a world definition (the MANIFEST's
 * page-A dam line, the land's town tiers, the story registry) or is the approved prototype's (SPEC section in the note).
 * Pure data; no scene imports.
 */
import type { Point2, Point3 } from '../../world/definition.ts';
import { HORIZON_MANIFEST } from '../../world/manifest.ts';
import { TOWN_TIERS } from '../../land/town/build.ts';
import { storyEye, storyLandmark } from '../../world/story.ts';

/** The town the solver packs (SPEC §1 `TOWN`): the slope from the upper street down to the quay, west to the river link. */
export const TOWN: readonly Point2[] = [[1385, 1040], [1545, 1035], [1585, 1160], [1525, 1290], [1440, 1335], [1405, 1325], [1365, 1190]];
/** The hillside the olive terraces and the blend band reach (SPEC §9). */
export const HILLSIDE: readonly Point2[] = [[1360, 1035], [1560, 1030], [1590, 1150], [1525, 1290], [1440, 1340], [1395, 1330], [1355, 1190]];

/** Page A's dam line (MANIFEST `views[A].damLine`, D-WW71): the square's west edge to Mountain v2's glass dam. */
export interface DamLine { from: Point2; to: Point2; halfWidth: number; maxHeight: number }
export const DAM_LINE: DamLine = (() => {
  const a = HORIZON_MANIFEST.views.find(v => v.id === 'A') as unknown as { damLine: { from: Point2; to: Point2; halfWidth_m: number; maxHeight_eu: number } };
  return { from: a.damLine.from, to: a.damLine.to, halfWidth: a.damLine.halfWidth_m, maxHeight: a.damLine.maxHeight_eu };
})();
/** Distance across the dam line's strip (the land test's measure: along ∈ [0, len]), or Infinity off its ends. */
export function damAcross(x: number, z: number, line: DamLine = DAM_LINE): number {
  const [a, b] = [line.from, line.to], len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len] as const;
  const dx = x - a[0], dz = z - a[1], along = dx * u[0] + dz * u[1];
  return along < 0 || along > len ? Infinity : Math.abs(dx * u[1] - dz * u[0]);
}
/** Whether a plan point lies in the dam corridor (with `grow` eu of margin). */
export const inDamCorridor = (x: number, z: number, grow = 0) => damAcross(x, z) <= DAM_LINE.halfWidth + grow;

/**
 * Left untouched (the brief: dress around them): the Kitty plaza (MANIFEST journey.kittyPlaza; its pad is 18 × 12 in
 * land/town/build.ts) — it overlaps the square's slab, so `onPad` may name the square there — and the homestead sites
 * (their own `homestead.*` pads, which `onPad` names).
 */
export const KITTY_PLAZA: { centre: Point2; size: Point2 } = { centre: (HORIZON_MANIFEST.journey as unknown as { kittyPlaza: { xy: Point2 } }).kittyPlaza.xy, size: [18, 12] };
export function untouched(x: number, z: number, grow = 0.3, padAt?: (x: number, z: number, m: number) => string | null): boolean {
  const k = KITTY_PLAZA;
  if (Math.abs(x - k.centre[0]) <= k.size[0] / 2 + grow && Math.abs(z - k.centre[1]) <= k.size[1] / 2 + grow) return true;
  return padAt?.(x, z, grow)?.startsWith('homestead.') ?? false;
}
/**
 * Page L's clearing (passes/03: each neighbourhood keeps its pages' subjects clear): from the page's eye at the quay's east
 * end along Lantern Row to the Boathouse across the water (MANIFEST `views[L]`, the Boathouse host's footprint), grown 1 eu.
 * No house stands in it (a 13 px subject at 200 m; the town's west-end houses on the quay took all of it).
 */
export const PAGE_L_WEDGE: readonly Point2[] = (() => {
  const v = HORIZON_MANIFEST.views.find(q => q.id === 'L') as unknown as { xy: Point2 }, h = HORIZON_MANIFEST.hosts.find(q => q.id === 'boathouse') as unknown as { xy: Point2; footprint_m: Point2 };
  const [bx, bz] = h.xy, [w, d] = h.footprint_m, e = v.xy, g = 1;
  return [[e[0] + g, e[1]], [bx - w / 2 - g, bz - d / 2 - g], [bx - w / 2 - g, bz + d / 2 + g]];
})();
/** The town's level tiers (land/town/build.ts `TOWN_TIERS`): centre, height and size of each pad. */
export type TierId = (typeof TOWN_TIERS)[number][0];
export function tier(id: TierId): { centre: Point2; y: number; size: Point2; x0: number; x1: number; z0: number; z1: number } {
  const t = TOWN_TIERS.find(q => q[0] === id)!, c = t[1] as unknown as Point2, s = t[3] as unknown as Point2;
  return { centre: c, y: t[2], size: s, x0: c[0] - s[0] / 2, x1: c[0] + s[0] / 2, z0: c[1] - s[1] / 2, z1: c[1] + s[1] / 2 };
}
/** The Queen's Court: the porcelain inlay at the square's centre (SPEC §7). */
export const COURT: Point2 = tier('square').centre;

/**
 * The campanile (story registry; SPEC §6): 5.4 eu shaft on a plinth to the lowest ground, its door to the square (east)
 * at the square's side of the slope (floor 11.75), a 4.4 belfry with a walkable floor, a 0.4 cornice and a steep pyramid
 * cap to the registry's apex 42.3. The cap rises 4.8 (the prototype's 4.2 + 0.6) so the belfry floor sits at 32.7 and its
 * standing eye at 34.3 (the registry's 34.4); the belfry's spandrels then stop at 37.1, 2.6 under Spring Bay's aim line
 * (top − 2) where it crosses them, so the line clears the belfry by more than the proofs' search step.
 */
export const CAMPANILE = (() => {
  const l = storyLandmark('campanile'), e = storyEye('belfry');
  return { at: [l.at[0], l.at[2]] as Point2, base: l.at[1], apex: l.top[1], side: 5.4, eye: e.y!, floor: 11.75, belfryH: 4.4, capRise: 4.8 };
})();
/** The belfry's floor (the shaft's top): apex − cap − cornice − belfry. */
export const belfryFloor = () => CAMPANILE.apex - CAMPANILE.capRise - 0.4 - CAMPANILE.belfryH;
/** The bank and Our home: the two hosts the town re-dresses (their baked shells; the kit's palazzo and villa). */
export const HOSTS = { bank: { kind: 'palazzo' as const }, home: { kind: 'villa' as const } };

/* ------------------------------------------------------------------ the square (SPEC §7, §8, §11) */

/**
 * The square's west frame (SPEC §13 "square in warm shade at golden hour", measured 60–80 % at sun 6–10°): the houses that
 * front the square's west side within this box keep to two storeys, so the low sun still finds the square through them.
 */
export const WEST_FRAME = { x0: 1405, x1: 1427, z0: 1150, z1: 1206, storeys: 2 } as const;
/** The small green on the square (red clover) and the bocce court wholly on it (RULINGS 10: shifted south off the pad edge). */
export const GREEN = { centre: [1459.5, 1150.6] as Point2, size: [18, 6.8] as Point2 };
/** 15 × 3.6 E–W (SPEC §11.1), 1.5 east of the prototype so its west end clears the bank approach by ≥ 0.9 on the square. */
export const BOCCE = { centre: [1459.5, 1149.3] as Point2, size: [15, 3.6] as Point2 };
export const FOUNTAIN: Point2 = [1470, 1192];
export const SUNDIAL: Point2 = [1478, 1157];
/** Benches on the square's west edge facing the dam. */
export const DAM_BENCHES: readonly Point2[] = [[1430.5, 1172], [1430.5, 1178]];
export const CAFE: readonly Point2[] = [[1449, 1199.8], [1453.5, 1200.2], [1458, 1199.5], [1462.5, 1200.5]];
/** The Court's four lanterns (the island lantern; the first has the pool). */
export const COURT_LANTERNS: readonly Point2[] = [[1446, 1167], [1464, 1167], [1446, 1185], [1464, 1185]];
/** Market stalls on the storefront lane (no prices, no lettering). */
export const STALLS: readonly Point2[] = [[1478, 1216.5], [1486, 1216.5], [1494, 1216.5]];

/* ------------------------------------------------------------------ the quay (SPEC §10) */

/** Lantern Row: the town quay's line, west → east (MANIFEST structures.townQuay). */
export const QUAY: { from: Point2; to: Point2; y: number } = (() => {
  const q = HORIZON_MANIFEST.structures.townQuay as unknown as { from: Point2; to: Point2 };
  return { from: q.from, to: q.to, y: 3 };
})();
/** Gozzi hauled up on the quay and moored off it (SPEC §10): [x, z, yaw, hull band]. */
export const GOZZI_HAULED: readonly [number, number, number, number][] = [[1455, 1300.5, 0.83, 0], [1461, 1297.2, 0.83, 1], [1440.5, 1314, 0.83, 2]];
export const GOZZI_MOORED: readonly [number, number, number, number][] = [[1452, 1320, -0.8, 3], [1463, 1311, -0.75, 0], [1479, 1301, -0.8, 1], [1444, 1327, -0.9, 2]];
export const NETS: readonly Point2[] = [[1466, 1293], [1448, 1309], [1484, 1286]];
export const CRATES: readonly Point2[] = [[1458, 1301.5], [1459.3, 1302.6]];
/** Giro del Porto (SPEC §11.3; LAND-ASKS §4): six buoys, B0 the start (white, red flag), clear of the ferry, the floatplane and the moorings. */
export const GIRO: readonly Point2[] = [[1457, 1333], [1486, 1332], [1538, 1302], [1566, 1338], [1516, 1372], [1456, 1364]];

/* ------------------------------------------------------------------ pastimes (SPEC §11; data, PR 5 plays them) */

/** The fishing spot at the ferry pier's end (deck ≈ 1.0): the rod and the two quay cats that come and sit (SPEC §11.5). */
export const FISHING: { rod: Point3; cats: readonly Point3[] } = { rod: [1470.2, 1, 1349.6], cats: [[1471.4, 1, 1346.2], [1469.6, 1, 1345.6]] };
/**
 * Lantern Hunt, the harbour's six (MANIFEST pastimeData.lanternQuotas.harbour; SPEC §11.4): data only — PR 5 hangs and
 * lights them. L1 and L4 are re-derived from the built town (a vicolo bracket, the first quayfront altana's pergola).
 */
export type LanternSpotId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
export interface LanternSpotData { id: LanternSpotId; at: Point3; reach: 'foot' | 'air' | 'water' | 'stair or air'; where: string }
export const LANTERN_FIXED: Readonly<Record<'L2' | 'L3' | 'L5' | 'L6', LanternSpotData>> = {
  L2: { id: 'L2', at: [1443, 18, 1134.4], reach: 'foot', where: 'under the bank loggia' },
  L3: { id: 'L3', at: [1423, 34.6, 1189.4], reach: 'stair or air', where: 'the belfry arch' },
  L5: { id: 'L5', at: [1617.5, 3, 1359], reach: 'water', where: "the yacht's stern rail" },
  L6: { id: 'L6', at: [1472.6, 3.1, 1349.6], reach: 'foot', where: 'the pier-end post' },
};
/** "Where's Hercules" spots (SPEC §11.6): label points PR 5 places the host master at. */
export const HERCULES_SPOTS: readonly Point3[] = [[1404, 14, 1252], [1450, 13, 1200], [1489, 15, 1130]];

/* ------------------------------------------------------------------ planting (SPEC §9) */

export const STONE_PINES: readonly [number, number, number][] = [[1404, 1108, 1.0], [1395, 1125, 0.85], [1530, 1105, 0.95], [1392, 1222, 0.9]];
/** Cypress candidates; the two at [1412,1182] and [1413,1194] frame the campanile. */
export const CYPRESSES: readonly Point2[] = [[1412, 1182], [1413, 1194], [1488, 1110], [1520, 1135], [1523, 1125], [1400, 1160], [1546, 1215], [1551, 1205]];
/** Tree cover over unbuilt ground (STYLE §2.1: ≤ 5 %). */
export const TREE_COVER_MAX = 0.05;
