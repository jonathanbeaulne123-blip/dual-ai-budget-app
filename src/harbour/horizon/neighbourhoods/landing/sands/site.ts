/**
 * Long Sands' site: the numbers every solver shares (STYLE §2.5 Direction B, protos/long-sands SPEC, RULINGS 9, D-WW74–76,
 * D-WW90) and the clearings the dressing keeps before anything is placed (STYLE §1.4.1 rule 1). Pure data and pure
 * functions of the context.
 */
import type { Point2 } from '../../../world/definition.ts';
import type { DressingContext } from '../../types.ts';
import { bedLine, xLine, type XLine } from './frame.ts';

export const SANDS = {
  /** The promenade's drawn extent (protos §1): x 795 → 1245 (the land pass laid it to 1245). */
  x0: 795, x1: 1245,
  /** Bed ids the land pass built (D-WW74, D-WW76). */
  beds: { promenade: 'walk promenade', strand: 'walk strand', drive: 'V01', pier: 'structure.longSandsPier', dune: 'walk dune' },
  /** Promenade cross-section offsets along the seaward normal (protos §2, fitted to the built 7.5 m promenade and the
   *  Strand at +5.6 ± 1.6): the inland palm row 1.25 off the promenade's edge; the seaward row 1.6 past the Strand. */
  palmInland: -5.0, palmSeaward: 8.8,
  /** Storefronts (protos §5): front face 1.4 porch + 1.4 eu behind the inland palm row; 9 deep. */
  store: { porch: 1.4, front: -7.8, depth: 9, widths: [10, 12, 14] as const, low: 4.4, high: 7.6, highShare: 0.4, gapEvery3: 3, minDriveGap: 5, step: 4 },
  /** The pier (MANIFEST structures.longSandsPier): axis x 1020, deck 3.6, 12 wide, ramp from the Tideline slab (3.0) at
   *  z 1434.6 to 1448.6, to z 1490, the platform x 1002–1034 × z 1490–1520 for the wheel. */
  pier: { x: 1020, deck: 3.6, half: 6, rampFrom: 1434.6, rampTo: 1448.6, slab: 3.0, to: 1490, platform: { x0: 1002, x1: 1034, z0: 1490, z1: 1520 } },
  /** The Ferris wheel (story landmark `wheel`, D-WW74): hub on the registry's [1010, 19.6, 1509], r 13, facing north-east
   *  turned 0.15 rad toward the belfry (so all four footings stand ≥ 0.3 inside the platform's edge); its footings are plates
   *  on the pier platform (`params.onDeck`), the pier's piles carry it (D-WW152). */
  wheel: { hub: [1010, 19.6, 1509] as const, r: 13, gondolas: 16, yaw: 3 * Math.PI / 4 - 0.15 },
  /** The glider's `sands` landing field (MANIFEST sky.landings.sands, D-WW90): nothing tall within r + 10. */
  glider: { at: [1185, 1355] as Point2, r: 35, keep: 10 },
  /** Page D (MANIFEST views D): its eye and the foreground the prototype cleared (22 eu). */
  pageD: { eye: [1185, 1445] as Point2, clear: 22 },
  /** The pier plaza: no promenade palm within 12 eu of the pier axis (the Canary palms frame it). */
  plaza: 12,
  /** Palms only where the island is Long Sands (district `landing`), never in the Reach, west of the Quay Bridge. */
  quayBridgeX: 1300,
  /** The existing corridor palm groves on the Drive's verge (land/corridor/plan/planting.ts R10/R11, baked into
   *  `corridors[*].planting`; test/horizonNeighbourhoodLongSands checks this list against the bake). */
  corridorPalms: [[844.4, 1340.5], [898.5, 1346.5], [906.2, 1351.2], [908.1, 1348.1], [1013.6, 1378.5], [1016.4, 1378.5], [1017.4, 1375.4], [1022.1, 1379.3], [1025.4, 1375.4], [1028.3, 1378.5],
    [1069.9, 1407.2], [1070.1, 1411.3], [1074, 1410.7], [1076.4, 1408.9], [1081.9, 1408.8], [1123.7, 1414.2], [1127.2, 1410.9], [1131.7, 1412.3]] as Point2[],
  /** The Campfire place (MANIFEST places.campfire) and its slab. */
  campfire: [1200, 1430] as Point2,
  /** The seafood shack at the pier's foot, east of the ramp on the sand (on the platform its stone footing reached the sea
   *  bed under the deck and hid page D's surf): centre, size along x and z, door to the north (the plaza). */
  shack: { at: [1032.5, 1455] as Point2, wx: 7, dz: 8 },
  /** The Tideline bowl (MANIFEST structures.tidelineBowl): rim 3.0, coping r 7.0. */
  bowl: { at: [1000, 1456] as Point2, rim: 3.0, coping: 7.0 },
  /** The Wreck on its reef (MANIFEST offshore wreck [250,1150]; land/offshore: the reef's flat top 0.7–1.4 over x 222–275,
   *  z 1118–1178, its two ridges x 230–247 × z 1136–1153 (to 4) and x 254–268 × z 1149–1162 (to 3.2)). The hull lies on the
   *  reef's top south of the ridges, broadside to the south-east (the ferry's side). */
  wreck: [250, 1150] as Point2,
  wreckHull: { at: [244, 1166] as Point2, y: 1.15, yaw: 1.35, scale: 3.6 },
  /** A fire's light bead sits low in its ring, among the logs (the anchor's head; roadLights draws it); the Campfire's just
   *  over its ring of log seats (0.47 tall), so the glow shows from the beach over the seats. */
  fireBead: 0.3, campfireBead: 0.6,
  /** The Boathouse host (MANIFEST hosts boathouse): baked footprint x 1275–1295, z 1308–1322, floor 3, walls to 9.65. */
  boathouse: 'boathouse',
} as const;

/** The site lines: the promenade, the Strand and the Drive as x-functions, and the shore. */
export type Site = { prom: XLine; drive: XLine; strandHalf: number; promHalf: number; strandOffset: number };
export function siteOf(ctx: DressingContext): Site {
  const prom = bedLine(ctx, SANDS.beds.promenade), strand = bedLine(ctx, SANDS.beds.strand), drive = bedLine(ctx, SANDS.beds.drive);
  const promLine = xLine(prom.points);
  // The Drive's Long Sands stretch: V01's points south of the Green and east of the Bight (protos §1 roadZ).
  const driveLine = xLine(drive.points.filter(p => p[0] > 630 && p[0] < 1330 && p[2] > 1150));
  // The Strand's offset along the promenade's normal, measured at mid-promenade (D-WW76 lays it at 5.6).
  const f = promLine.frameAt(1100); let best = Infinity, off = 5.6;
  for (const p of strand.points) { const dx = p[0] - f.x, dz = p[2] - f.z, along = dx * f.tx + dz * f.tz; if (Math.abs(along) < best) { best = Math.abs(along); off = dx * f.nx + dz * f.nz; } }
  return { prom: promLine, drive: driveLine, promHalf: prom.width / 2, strandHalf: strand.width / 2, strandOffset: off };
}

/** Plan distance from a point to a segment. */
export function segDist(px: number, pz: number, a: Point2, b: Point2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz);
}

/** Where a palm may stand at all (STYLE §2.5 amended): Long Sands' own district, west of the Quay Bridge, off the glider
 *  field and the existing corridor groves. */
export function palmCountry(ctx: DressingContext, x: number, z: number): boolean {
  if (ctx.districtAt(x, z) !== 'landing' || x >= SANDS.quayBridgeX) return false;
  if (Math.hypot(x - SANDS.glider.at[0], z - SANDS.glider.at[1]) < SANDS.glider.r + SANDS.glider.keep) return false;
  return SANDS.corridorPalms.every(p => Math.hypot(p[0] - x, p[1] - z) >= 5);
}

/** A ledger of what this module has already put down (circles), so later solvers keep off earlier ones. */
export class Claims {
  private items: { x: number; z: number; r: number; tag: string }[] = [];
  add(x: number, z: number, r: number, tag: string) { this.items.push({ x, z, r, tag }); }
  addPoints(points: readonly Point2[], r: number, tag: string) { for (const p of points) this.add(p[0], p[1], r, tag); }
  free(x: number, z: number, r: number, ignore?: (tag: string) => boolean): boolean {
    return this.items.every(c => (ignore?.(c.tag) ?? false) || Math.hypot(c.x - x, c.z - z) >= c.r + r);
  }
  near(x: number, z: number, r: number, tag: string): boolean { return this.items.some(c => c.tag === tag && Math.hypot(c.x - x, c.z - z) < c.r + r); }
}
