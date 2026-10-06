/**
 * The Green (STORY place 2, module `lakeside`): the plan's fixed points and the pure geometry every part derives from
 * (prototype /protos/green SPEC.md v2, RULINGS 1–2, D-WW110…119). Positions are island [x, z] (x east, z south); bearings
 * are compass degrees (0 = north = −z, 90 = east). No scene, no terrain: the context answers heights.
 */
import type { Point2 } from '../../world/definition.ts';
import { oakSwing } from '../../kit/plants/oak.ts';

/** The protected Green (MANIFEST `protected.green`): nothing over 0.85 eu inside r 160 but the oak and what it carries. */
export const CENTRE: Point2 = [1040, 1065];
export const PROTECT_R = 160;
/** The Old Oak (story landmark `oak`): base, height, crown radius. */
export const OAK_AT: Point2 = [1125, 1165];
export const OAK_HEIGHT = 36, OAK_CROWN = 30;
/** The Drop Zone target after D-WW (10 m ESE; `sky.dropZone.xy`) and its landing field radius. */
export const DROP_ZONE: Point2 = [1037.2, 1115.8];
export const FIELD_R = 60;
/** The turf labyrinth: 7 circuits, 31 m across. */
export const LABYRINTH: Point2 = [1090, 1005];
export const LAB_RINGS = [3, 5, 7, 9, 11, 13, 15] as const;
export const LAB_R = 15.5, LAB_PATH = 1.15, LAB_GAP = 0.16;
/** The apiary (six hives in the clover), the kites' station (Year Walk April), the rim fixtures. */
export const APIARY: Point2 = [962, 1158];
export const APRIL: Point2 = [951, 976];
export const WINDSOCK: Point2 = [1028, 1240];
export const WINDPUMP: Point2 = [908, 1245];
export const PAVILION: Point2 = [848, 1060];
export const BALES: Point2 = [992, 1253];
/** The Glasshouse stair-and-ramp's foot landing on the Green (PR 2 land, `glasshouseRamp.foot`). */
export const STAIR_FOOT: Point2 = [1006.5, 951.5];
/** The Glasshouse (host footprint x 995–1020, z 781–799) and its no-tree view east over Stillwater (bearings 40°–140°). */
export const GLASSHOUSE: Point2 = [1007.5, 790];
export const GLASSHOUSE_VIEW = { from: 40, to: 140, reach: 170 } as const;
/** Stillwater (lake, level 50): its centre for the loons. */
export const STILLWATER: Point2 = [1130, 820];
/** The Oak Clock's ring radius (crown + 8) and the Lantern Ring (walk r 172, posts r 173.6, 28 slots). */
export const CLOCK_R = OAK_CROWN + 8;
export const RING_WALK_R = 172, RING_POST_R = 173.6, RING_SLOTS = 28, RING_STONE_CLEAR = 8;
/** The nine baskets (MANIFEST pastimeData.nineBaskets after D-WW77); 1–8 ring the Green. Fixtures keep 4 m clear of them. */
export const BASKETS: readonly Point2[] = [[1189, 1151], [1118, 1218], [1022, 1236], [925.4, 1199.2], [876, 1118], [866.1, 1022.5], [907.5, 929.0], [939.1, 905.2]];
/** The Green's meadow (prototype GREEN_POLY): drifts and tufts stay in it or in the protected circle. */
export const MEADOW: readonly Point2[] = [[1000, 900], [1150, 960], [1250, 1040], [1300, 1180], [1150, 1200], [950, 1200], [820, 1100], [830, 960]];

/* ------------------------------------------------------------------------------------------------- geometry */

export const TAU = Math.PI * 2;
export const deg = (d: number) => (d * Math.PI) / 180;
/** The plan direction of a compass bearing (degrees). */
export const bearingDir = (b: number): Point2 => [Math.sin(deg(b)), -Math.cos(deg(b))];
/** The compass bearing (degrees, 0–360) from a to b. */
export const bearing = (a: Point2, b: Point2) => ((Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI + 360) % 360;
export const polar = (c: Point2, b: number, r: number): Point2 => { const d = bearingDir(b); return [c[0] + d[0] * r, c[1] + d[1] * r]; };
export const dist = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** A record's yaw (types.ts: local +z → (sin yaw, cos yaw)) that points local +z along a compass bearing. */
export const yawToward = (b: number) => { const d = bearingDir(b); return Math.atan2(d[0], d[1]); };
export function inPolygon(x: number, z: number, poly: readonly Point2[]): boolean {
  let k = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) k = !k; }
  return k;
}

/** The oak's yaw: its swing limb (local +z) points at the Drop Zone (bearing ≈ 299°, WNW over the meadow). */
export const OAK_BEARING_TO_FIELD = bearing(OAK_AT, DROP_ZONE);
export const OAK_YAW = yawToward(OAK_BEARING_TO_FIELD);
/** A point of the oak's unit frame (kit/plants/oak.ts) in the world plan. */
export function oakFrame(p: readonly [number, number, number]): Point2 {
  const c = Math.cos(OAK_YAW), s = Math.sin(OAK_YAW);
  return [OAK_AT[0] + p[0] * c + p[2] * s, OAK_AT[1] + p[2] * c - p[0] * s];
}
/** Where the rope swing's seat hangs (plan) and its rope top above the oak's base. */
export function swingPlan(): { at: Point2; ropeTop: number } { const s = oakSwing(); return { at: oakFrame(s.at), ropeTop: s.at[1] }; }

/** The twelve month stones: m = 0 (January) due north of the trunk, clockwise, every 30°, on the clock ring. */
export function monthStones(): { month: number; at: Point2; bearing: number }[] {
  return Array.from({ length: 12 }, (_, m) => ({ month: m, bearing: m * 30, at: polar(OAK_AT, m * 30, CLOCK_R) }));
}
/** The labyrinth's entrance bearing: toward the Year Walk at [984,1040] (≈ 252°, WSW). */
export const LAB_ENTRANCE = bearing(LABYRINTH, [984, 1040]);

/* ------------------------------------------------------------------------------------------------- paint shapes */

/** A band of width w along a polyline (a simple polygon: the left edge out, the right edge back). */
export function strip(points: readonly Point2[], w: number): Point2[] {
  const n = points.length, left: Point2[] = [], right: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]!, b = points[Math.min(n - 1, i + 1)]!, dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2, p = points[i]!;
    left.push([p[0] + nx, p[1] + nz]); right.push([p[0] - nx, p[1] - nz]);
  }
  return [...left, ...right.reverse()];
}
/** Resamples a polyline every ~`step` eu (both ends kept). */
export function resample(points: readonly Point2[], step: number): Point2[] {
  const out: Point2[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, n = Math.max(1, Math.round(dist(a, b) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}
/**
 * A band of width w along a polyline as a run of quads (one paint polygon each, sharing their edges exactly). The
 * dressing layer drapes every paint polygon in triangles of ≤ 2.5 eu edges; a long band as ONE polygon triangulates in
 * fans that subdivide into ~12–20 triangles per metre, a run of ≤ 2 × 2 quads into ~1–2 (D-WW114).
 */
export function quadStrip(points: readonly Point2[], w: number, step = 1.6): Point2[][] {
  const pts = resample(points, step), n = pts.length, L: Point2[] = [], R: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(n - 1, i + 1)]!, dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2, p = pts[i]!;
    L.push([p[0] + nx, p[1] + nz]); R.push([p[0] - nx, p[1] - nz]);
  }
  return Array.from({ length: n - 1 }, (_, i) => [L[i]!, L[i + 1]!, R[i + 1]!, R[i]!]);
}
/** An arc band as quads (see `quadStrip`): around c from bearing b0 to b1 (clockwise), radius r, width w. */
export function arcQuads(c: Point2, r: number, w: number, b0: number, b1: number, step = 1.6): Point2[][] {
  const n = Math.max(2, Math.ceil((Math.abs(b1 - b0) * Math.PI / 180 * r) / step));
  return quadStrip(Array.from({ length: n + 1 }, (_, k) => polar(c, b0 + ((b1 - b0) * k) / n, r)), w, step * 2);
}
/** An arc band around c between bearings b0 → b1 (clockwise), radius r, width w. */
export function arcBand(c: Point2, r: number, w: number, b0: number, b1: number, step = 6): Point2[] {
  const n = Math.max(2, Math.ceil(Math.abs(b1 - b0) / step)), pts: Point2[] = [];
  for (let k = 0; k <= n; k++) pts.push(polar(c, b0 + ((b1 - b0) * k) / n, r));
  return strip(pts, w);
}
/** A closed disc (n sides). */
export const disc = (c: Point2, r: number, n = 20): Point2[] => Array.from({ length: n }, (_, k) => polar(c, (k / n) * 360, r));
/** A quadratic bend from a to b (bend × length sideways at the middle), sampled every ~2 eu. */
export function bend(a: Point2, b: Point2, k: number): Point2[] {
  const L = dist(a, b), n = Math.max(4, Math.ceil(L / 2)), mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * k, mz = (a[1] + b[1]) / 2 + (b[0] - a[0]) * k;
  return Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * mz + t * t * b[1]] as Point2; });
}
