/**
 * Scholars' Edge (The Water's Way, story place 7, layout B): the one frame every part of the module reads. Positions
 * come from the land the bake already built (MANIFEST `structures.bightLookout`, `structures.scholarsTerrace`,
 * `walks.bightLookout`, the Library host) and from the approved prototype (protos/scholars SPEC: the sun window, the
 * glades, the golden-hour sun). Pure data and geometry: no scene imports.
 *
 * The Library frame: `u` along the long axis (north-east), `v` across it (south-east, the door face); `W(u, v)` is
 * world plan, `LOC(x, z)` the inverse. The building record's yaw is π/4 (local x = (cos, −sin), local z = (sin, cos)).
 */
import type { Point2 } from '../../world/definition.ts';
import { HORIZON_MANIFEST as M } from '../../world/manifest.ts';

/** The Library host's centre and floor (MANIFEST hosts `library`: xy [740, 400], h 48). */
const HOST = (M.hosts as unknown as { id: string; xy: number[]; h: number; roofH_eu: number; footprint_m: number[] }[]).find(h => h.id === 'library')!;
export const CEN: Point2 = [HOST.xy[0]!, HOST.xy[1]!];
export const FLOOR = HOST.h;
/** The host's baked shell: land/town/hosts.ts stands its walls to `roofH_eu − 0.35` and lays its roof slab at `roofH_eu`. */
export const SHELL_EAVE = HOST.roofH_eu - 0.35;
export const SHELL_ROOF = HOST.roofH_eu;
const R = Math.SQRT1_2;
export const EX: Point2 = [R, -R];
export const EZ: Point2 = [R, R];
export const YAW = Math.PI / 4;
export const W = (u: number, v: number): Point2 => [CEN[0] + EX[0] * u + EZ[0] * v, CEN[1] + EX[1] * u + EZ[1] * v];
export const LOC = (x: number, z: number): Point2 => { const dx = x - CEN[0], dz = z - CEN[1]; return [dx * EX[0] + dz * EX[1], dx * EZ[0] + dz * EZ[1]]; };

/** The prototype's centre of the woods (its planting and cover radii are measured from here). */
export const WOODS_C: Point2 = [760, 420];
/** The golden-hour sun (SPEC: elevation 10°, from the WNW, ~22° north of west), unit vector toward the sun. */
export const SUN: readonly [number, number, number] = (() => { const v = [-0.906, 0.174, -0.374], l = Math.hypot(...v); return v.map(c => c / l) as [number, number, number]; })();

/* ---------------------------------------------------------------- the courtyard terrace (D-WW88) */

type TerracePad = { xy: number[]; size_m: number[]; rot_deg: number; local: [number, number, number, number] };
const TERRACE = M.structures.scholarsTerrace as unknown as { h: number; pads: Record<string, TerracePad> };
/** The three terrace pads in the Library frame: [u0, u1, v0, v1]. Flags, furniture and the sun test live on them. */
export const TERRACE_RECTS: readonly (readonly [number, number, number, number])[] = Object.values(TERRACE.pads).map(p => p.local);
export const TERRACE_LEVEL = TERRACE.h;
export const onTerrace = (x: number, z: number, pad = 0) => { const [u, v] = LOC(x, z); return TERRACE_RECTS.some(([u0, u1, v0, v1]) => u > u0 - pad && u < u1 + pad && v > v0 - pad && v < v1 + pad); };
export const inLibrary = (x: number, z: number, pad = 0) => { const [u, v] = LOC(x, z); return Math.abs(u) < 21 + pad && Math.abs(v) < 15 + pad; };
/** A Library-frame rectangle as a world polygon (counter-clockwise in plan). */
export const rectPolygon = (u0: number, u1: number, v0: number, v1: number): Point2[] => [W(u0, v0), W(u1, v0), W(u1, v1), W(u0, v1)];

/* ---------------------------------------------------------------- the sun window (layout B) */

/** The courtyard's sun window: a glade cut toward the golden-hour sun from the terrace centre W(−30, 4), 140 m long,
 * 20.6 m wide at its near end widening to 34 m (SPEC "Sun-window glade (exact)"). No tree stands in it. */
export const SUN_WINDOW = { origin: W(-30, 4), axis: [-0.924, -0.382] as Point2, near: 6, far: 140, half0: 10, widen: 0.05 };
export function sunWindowAt(x: number, z: number, pad = 0): boolean {
  const S = SUN_WINDOW, dx = x - S.origin[0], dz = z - S.origin[1], al = dx * S.axis[0] + dz * S.axis[1], ac = Math.abs(dx * -S.axis[1] + dz * S.axis[0]);
  return al > S.near - pad && al < S.far + pad && ac < S.half0 + S.widen * al + pad;
}
/** How far (m) (x, z) lies outside the sun window (≤ 0 inside): the larger of its along and across overshoots. */
export function sunWindowDistance(x: number, z: number): number {
  const S = SUN_WINDOW, dx = x - S.origin[0], dz = z - S.origin[1], al = dx * S.axis[0] + dz * S.axis[1], ac = Math.abs(dx * -S.axis[1] + dz * S.axis[0]);
  return Math.max(S.near - al, al - S.far, ac - (S.half0 + S.widen * Math.max(S.near, Math.min(S.far, al))));
}
/** How far (m) (x, z) lies outside a Library-frame rectangle (≤ 0 inside). */
export function rectDistance(x: number, z: number, [u0, u1, v0, v1]: readonly number[]): number {
  const [u, v] = LOC(x, z), du = Math.max(u0! - u, u - u1!, 0), dv = Math.max(v0! - v, v - v1!, 0);
  return du || dv ? Math.hypot(du, dv) : -Math.min(u - u0!, u1! - u, v - v0!, v1! - v);
}
export const terraceDistance = (x: number, z: number) => Math.min(...TERRACE_RECTS.map(r => rectDistance(x, z, r)));
export const libraryDistance = (x: number, z: number) => rectDistance(x, z, [-21, 21, -15, 15]);
export function sunWindowPolygon(): Point2[] {
  const S = SUN_WINDOW, n: Point2 = [-S.axis[1], S.axis[0]], P = (al: number, ac: number): Point2 => [S.origin[0] + S.axis[0] * al + n[0] * ac, S.origin[1] + S.axis[1] * al + n[1] * ac];
  return [P(S.near, -(S.half0 + S.widen * S.near)), P(S.far, -(S.half0 + S.widen * S.far)), P(S.far, S.half0 + S.widen * S.far), P(S.near, S.half0 + S.widen * S.near)];
}

/** The eight glades of the woods (SPEC: "a glade every 60–80 m"), [x, z, r]. */
export const GLADES: readonly (readonly [number, number, number])[] = [[688, 368, 12], [812, 378, 11], [842, 452, 12], [776, 482, 11], [652, 430, 12], [738, 330, 10], [880, 400, 10], [706, 498, 10]];
export const gladeDistance = (x: number, z: number) => GLADES.reduce((d, [gx, gz, r]) => Math.min(d, Math.hypot(x - gx, z - gz) - r), Infinity);

/* ---------------------------------------------------------------- the Bight lookout (D-WW87) */

const LOOK = M.structures.bightLookout as unknown as { ramp: number[][]; rampWidth_m: number; deck: { from: number[]; to: number[]; top: number }; eye: number[] };
const SPUR = M.walks.bightLookout as unknown as { pts: number[][]; surface_m: number };
/** The built deck: plan box and top (the ramp arrives on its north edge). */
export const DECK = { x0: LOOK.deck.from[0]!, z0: LOOK.deck.from[1]!, x1: LOOK.deck.to[0]!, z1: LOOK.deck.to[1]!, top: LOOK.deck.top };
/** The story eye on the deck (STORY_EYES `bightLookout`: deck + 1.6). */
export const LOOKOUT_EYE: readonly [number, number, number] = [LOOK.eye[0]!, LOOK.deck.top + 1.6, LOOK.eye[1]!];
/** The spur's centreline (gravel walk) then the ramp's (timber, on posts), from the Year Walk to the deck. */
export const SPUR_LINE: readonly Point2[] = [...SPUR.pts.map(p => [p[0]!, p[1]!] as Point2), ...LOOK.ramp.slice(1).map(p => [p[0]!, p[1]!] as Point2)];
export const SPUR_WIDTH = SPUR.surface_m;
/** The lookout's open water (protos/scholars `los.py`: water from bearing 55° to 175°, 0° = +x east, 90° = +z south),
 * kept clear of canopy from `frame` (the near trees that frame the view) out to `reach`. */
export const LOOKOUT_VIEW = { from: 55, to: 175, frame: 22, reach: 170 } as const;

export function polylineDistance(x: number, z: number, line: readonly Point2[]): number {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, b = line[i]!, dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    d = Math.min(d, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
  }
  return d;
}
