/**
 * The Water's Way species geometry (kit/plants/species.ts), in Mountain v2's card language: faceted card, flat shading,
 * a light top and a dark underside (0.58 → 1.12 up a crown, STYLE §1.1), cut sides dark at the foot, baked vertex
 * colours that the instance colour only varies by a few percent (STYLE §1.4.1 rule 5). One unit geometry per species,
 * variant, dressing, tier and season look (the planting rebuilds when the drawn look changes).
 *
 * Budget (triangles per instance, full / lite; the test prints the table): marsh clumps ≤ 12 (reed 12/4, cattail 11/5,
 * sedge 12/5), woodland cards 8/8, trees 30–95 / 20–50, palms 123 / 60 (fan) and 192 / 86 (canary). Ink shells (full
 * only, closed crowns only) repeat the crown parts pushed out along `aInk`.
 *
 * Seasons (STYLE §1.4.2): deciduous trees bud in April, colour in September–October (tamarack and willow gold, dogwood
 * purple-red, apple yellowing) and are bare from November or December to March (branch flats in twig colour; the
 * willow's twigs golden, the dogwood's stems red); conifers carry snow caps in winter; reeds and grasses go copper and
 * straw, cattail heads go to seed fluff; lilies are gone in winter; the warm coast (olive, cypress, stone pine, palms,
 * lemons, bougainvillea) stays green (bougainvillea keeps fewer bracts in winter).
 */
import * as THREE from 'three';
import { Writer, type PlantTier } from './geometry.ts';
import type { MountainArtPalette } from '../../../mountain/art/palette.ts';
import { mix, shade, type RGB } from '../../../art/cardKit.ts';
import type { PlantSeason } from './archetypes.ts';
import type { BloomStage } from './sets.ts';
import { SNOW, WW_SPEC, wwColours, type WWColours, type WWSpecies } from './species.ts';
import { oakGeometry } from './oak.ts';

export type V = readonly [number, number, number];
export type WWLook = { season: PlantSeason; month: number; stage: BloomStage };
export type WWGeometry = { body: THREE.BufferGeometry; shell: THREE.BufferGeometry | null };

/** aInk length for v2's 0.09 eu rim (the shader pushes by aInk × 0.07). */
export const INK_RIM = 0.09 / 0.07;
const TAU = Math.PI * 2;
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const hashRand = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const UP: V = [0, 1, 0];

/** Body and shell writers for one unit geometry. `crown` flags vertices that ride a palm's trunk stretch. */
export class Draw {
  readonly body = new Writer();
  readonly shell: Writer | null;
  crown = 0;
  constructor(readonly full: boolean, withShell: boolean) { this.shell = full && withShell ? new Writer() : null; }
  /** One triangle facing away from `centre` (or along `hint`), with an optional shell copy pushed out by `ink`. */
  tri(a: V, b: V, c: V, ca: RGB, cb: RGB, cc: RGB, centre: V | null, hint?: V, ink = 0) {
    const mid: V = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], h = hint ?? (centre ? sub(mid, centre) : undefined);
    this.body.tri(a, b, c, ca, cb, cc, h, { crown: this.crown });
    if (ink && this.shell && centre) {
      const d = (p: V): V => { const n = norm(sub(p, centre)); return [n[0] * ink, n[1] * ink, n[2] * ink]; };
      const k: RGB = [0, 0, 0]; this.shell.tri(a, b, c, k, k, k, h, { crown: this.crown, ink: [d(a), d(b), d(c)] });
    }
  }
  result(stretch: boolean): WWGeometry {
    return { body: this.body.geometry({ crown: stretch }), shell: this.shell && this.shell.p.length ? this.shell.geometry({ crown: stretch, ink: true }) : null };
  }
}

/** A crown gradient: dark under (lo) to lit top (hi) between y0 and y1. */
export const grad = (c: RGB, y0: number, y1: number, lo = 0.6, hi = 1.12) => (y: number): RGB => shade(c, lo + (hi - lo) * clamp01((y - y0) / (y1 - y0 || 1)));

/**
 * A faceted crown lump (v2's displaced icosphere in 4n triangles): a bottom apex, a lower ring, a narrower upper ring
 * offset half a step, a top apex. `snow` whitens the upper ring and apex.
 */
export function lump(d: Draw, c: V, rx: number, ry: number, rz: number, n: number, col: (y: number) => RGB, o: { spin?: number; seed?: number; snow?: number; ink?: number; flat?: number; /** Turns the lump's x/z axes about y. */ rot?: number } = {}) {
  const r = hashRand(o.seed ?? 7), spin = o.spin ?? 0, A: V[] = [], B: V[] = [], cr = Math.cos(o.rot ?? 0), sr = Math.sin(o.rot ?? 0);
  const at = (x: number, y: number, z: number): V => [c[0] + x * cr - z * sr, y, c[2] + x * sr + z * cr];
  for (let k = 0; k < n; k++) {
    const a = spin + (k / n) * TAU, ja = 0.86 + r() * 0.28, b = a + Math.PI / n, jb = 0.86 + r() * 0.28;
    A.push(at(Math.cos(a) * rx * ja, c[1] - 0.1 * ry, Math.sin(a) * rz * ja));
    B.push(at(Math.cos(b) * rx * 0.66 * jb, c[1] + 0.5 * ry, Math.sin(b) * rz * 0.66 * jb));
  }
  const T: V = [c[0], c[1] + ry, c[2]], Bt: V = [c[0], c[1] - (o.flat ?? 0.6) * ry, c[2]], snow = o.snow ?? 0;
  const col2 = (p: V, top: boolean): RGB => (snow && top ? mix(col(p[1]), SNOW, snow) : col(p[1]));
  const ink = o.ink ?? INK_RIM;
  for (let k = 0; k < n; k++) {
    const a0 = A[k]!, a1 = A[(k + 1) % n]!, b0 = B[k]!, b1 = B[(k + 1) % n]!;
    d.tri(Bt, a1, a0, shade(col(Bt[1]), 0.85), col(a1[1]), col(a0[1]), c, undefined, ink);
    d.tri(a0, a1, b0, col(a0[1]), col(a1[1]), col2(b0, true), c, undefined, ink);
    d.tri(a1, b1, b0, col(a1[1]), col2(b1, true), col2(b0, true), c, undefined, ink);
    d.tri(b0, b1, T, col2(b0, true), col2(b1, true), col2(T, true), c, undefined, ink);
  }
}
/** A flattened lens (an umbrella pine's disc, a lily-like pad mass): a ring between a raised top apex and a low bottom apex (2n). */
export function lens(d: Draw, c: V, r: number, h: number, n: number, col: (y: number) => RGB, o: { seed?: number; snow?: number; ink?: number; rz?: number } = {}) {
  const rnd = hashRand(o.seed ?? 3), R: V[] = [], rz = o.rz ?? r;
  for (let k = 0; k < n; k++) { const a = (k / n) * TAU + rnd() * 0.3, j = 0.85 + rnd() * 0.3; R.push([c[0] + Math.cos(a) * r * j, c[1] + (rnd() - 0.5) * h * 0.3, c[2] + Math.sin(a) * rz * j]); }
  const T: V = [c[0], c[1] + h * 0.62, c[2]], B: V = [c[0], c[1] - h * 0.38, c[2]], ink = o.ink ?? INK_RIM, top = o.snow ? mix(col(T[1]), SNOW, o.snow) : col(T[1]);
  for (let k = 0; k < n; k++) { const a = R[k]!, b = R[(k + 1) % n]!;
    d.tri(a, b, T, col(a[1]), col(b[1]), top, c, undefined, ink);
    d.tri(b, a, B, shade(col(b[1]), 0.8), shade(col(a[1]), 0.8), shade(col(B[1]), 0.62), c, undefined, ink); }
}
/** A cone tier (a conifer's skirt): n sides to an apex, its underside capped (n − 2) and dark. `jag` drops alternate rim points. */
export function cone(d: Draw, base: V, r: number, h: number, n: number, col: (y: number) => RGB, o: { spin?: number; cap?: boolean; snow?: number; jag?: number; lean?: number; rz?: number; ink?: number; seed?: number } = {}) {
  const spin = o.spin ?? 0, rz = o.rz ?? r, ring: V[] = [], rnd = hashRand(o.seed ?? 11);
  for (let k = 0; k < n; k++) { const a = spin + (k / n) * TAU, j = 0.9 + rnd() * 0.2; ring.push([base[0] + Math.cos(a) * r * j, base[1] - (o.jag && k % 2 ? o.jag : 0), base[2] + Math.sin(a) * rz * j]); }
  const apex: V = [base[0] + (o.lean ?? 0), base[1] + h, base[2]], ink = o.ink ?? INK_RIM, centre: V = [base[0], base[1] + h * 0.3, base[2]];
  const ac = o.snow ? mix(col(apex[1]), SNOW, o.snow) : col(apex[1]), rc = (p: V) => (o.snow ? mix(col(p[1]), SNOW, o.snow * 0.12) : col(p[1]));
  for (let k = 0; k < n; k++) { const a = ring[k]!, b = ring[(k + 1) % n]!; d.tri(a, b, apex, rc(a), rc(b), ac, centre, undefined, ink); }
  if (o.cap !== false) for (let k = 1; k < n - 1; k++) d.tri(ring[0]!, ring[k + 1]!, ring[k]!, shade(col(base[1]), 0.55), shade(col(base[1]), 0.55), shade(col(base[1]), 0.55), null, [0, -1, 0], ink);
}
/** A spindle (a cypress flame, a cedar column): rings of (y, r) closed by a bottom cap and a top apex. */
export function spindle(d: Draw, rings: readonly (readonly [number, number])[], apex: V, n: number, col: (y: number) => RGB, o: { seed?: number; twist?: number; ink?: number; snow?: number; x?: number; z?: number } = {}) {
  const rnd = hashRand(o.seed ?? 5), ox = o.x ?? 0, oz = o.z ?? 0, R: V[][] = rings.map(([y, r], i) => Array.from({ length: n }, (_, k) => { const a = (k / n) * TAU + i * (o.twist ?? 0.3), j = 0.88 + rnd() * 0.24; return [ox + Math.cos(a) * r * j, y, oz + Math.sin(a) * r * j] as V; }));
  const ink = o.ink ?? INK_RIM, centre: V = [ox, (rings[0]![0] + apex[1]) / 2, oz], top = (p: V) => (o.snow && p[1] > centre[1] ? mix(col(p[1]), SNOW, o.snow * clamp01((p[1] - centre[1]) / (apex[1] - centre[1]))) : col(p[1]));
  const b = R[0]!; for (let k = 1; k < n - 1; k++) d.tri(b[0]!, b[k + 1]!, b[k]!, shade(col(b[0]![1]), 0.55), shade(col(b[0]![1]), 0.55), shade(col(b[0]![1]), 0.55), null, [0, -1, 0], ink);
  for (let i = 1; i < R.length; i++) for (let k = 0; k < n; k++) { const a0 = R[i - 1]![k]!, a1 = R[i - 1]![(k + 1) % n]!, b0 = R[i]![k]!, b1 = R[i]![(k + 1) % n]!;
    d.tri(a0, a1, b1, top(a0), top(a1), top(b1), centre, undefined, ink); d.tri(a0, b1, b0, top(a0), top(b1), top(b0), centre, undefined, ink); }
  const L = R[R.length - 1]!; for (let k = 0; k < n; k++) d.tri(L[k]!, L[(k + 1) % n]!, apex, top(L[k]!), top(L[(k + 1) % n]!), top(apex), centre, undefined, ink);
}
/** A tapered tube (a trunk, a limb) from a to b: 2n triangles, the upper side lit (limbs read from below and above). */
export function tube(d: Draw, a: V, b: V, ra: number, rb: number, n: number, ca: RGB, cb: RGB, o: { spin?: number; lit?: number } = {}) {
  const t = norm(sub(b, a)); let s = cross(t, UP); if (Math.hypot(s[0], s[1], s[2]) < 1e-4) s = [1, 0, 0]; s = norm(s); const u = norm(cross(s, t));
  const lit = o.lit ?? 0.28, spin = o.spin ?? 0.3;
  const ring = (p: V, r: number) => Array.from({ length: n }, (_, k) => { const ang = spin + (k / n) * TAU, dir = addv([s[0] * Math.cos(ang), s[1] * Math.cos(ang), s[2] * Math.cos(ang)], u, Math.sin(ang)); return { p: addv(p, dir, r), up: dir[1] }; });
  const A = ring(a, ra), B = ring(b, rb), tone = (c: RGB, up: number) => shade(c, 0.9 + lit * up);
  for (let k = 0; k < n; k++) { const a0 = A[k]!, a1 = A[(k + 1) % n]!, b0 = B[k]!, b1 = B[(k + 1) % n]!, mid = addv(a, b, 1);
    const centre: V = [mid[0] / 2, mid[1] / 2, mid[2] / 2];
    d.tri(a0.p, a1.p, b1.p, tone(ca, a0.up), tone(ca, a1.up), tone(cb, b1.up), centre);
    d.tri(a0.p, b1.p, b0.p, tone(ca, a0.up), tone(cb, b1.up), tone(cb, b0.up), centre); }
}
/**
 * A strap blade from `base` toward azimuth `az`: 1 triangle (a spike), 2 (bent on one edge) or 3 (bent on both edges).
 * Cards: the material is double-sided.
 */
export function blade(d: Draw, base: V, az: number, h: number, w: number, lean: number, foot: RGB, tip: RGB, tris: 1 | 2 | 3) {
  const dir: V = [Math.cos(az), 0, Math.sin(az)], perp: V = [-dir[2], 0, dir[0]];
  const bl = addv(base, perp, -w / 2), br = addv(base, perp, w / 2), T = addv(addv(base, dir, lean * h), UP, h);
  const midC = addv(addv(base, dir, lean * h * 0.3), UP, h * 0.58), mr = addv(midC, perp, w * 0.32), ml = addv(midC, perp, -w * 0.32), mc = mix(foot, tip, 0.55);
  const hint = cross(perp, sub(T, base));
  if (tris === 1) { d.tri(bl, br, T, foot, foot, tip, null, hint); return; }
  d.tri(bl, br, mr, foot, foot, mc, null, hint); d.tri(bl, mr, T, foot, mc, tip, null, hint);
  if (tris === 3) d.tri(bl, T, ml, foot, tip, mc, null, hint);
}
/** A flat low mound on the ground (iceplant, a lily-pad mass): an apex over a six-point ring (6 triangles). */
function mound(d: Draw, c: V, rx: number, rz: number, h: number, col: RGB, spin: number, n = 6) {
  const apex: V = [c[0], c[1] + h, c[2]];
  for (let k = 0; k < n; k++) { const a0 = spin + (k / n) * TAU, a1 = spin + ((k + 1) / n) * TAU, j0 = 0.85 + ((k * 5) % 3) * 0.1, j1 = 0.85 + (((k + 1) * 5) % 3) * 0.1;
    const p0: V = [c[0] + Math.cos(a0) * rx * j0, c[1] + h * 0.1, c[2] + Math.sin(a0) * rz * j0], p1: V = [c[0] + Math.cos(a1) * rx * j1, c[1] + h * 0.1, c[2] + Math.sin(a1) * rz * j1];
    d.tri(apex, p0, p1, shade(col, 1.08), shade(col, 0.7), shade(col, 0.7), null, UP); }
}
/** A small faceted dot (an apple, a lemon, a blossom): a tetrahedron (4 triangles). */
function dot(d: Draw, c: V, r: number, col: RGB) {
  const p: V[] = [[c[0], c[1] + r, c[2]], [c[0] + r * 0.94, c[1] - r * 0.33, c[2]], [c[0] - r * 0.47, c[1] - r * 0.33, c[2] + r * 0.82], [c[0] - r * 0.47, c[1] - r * 0.33, c[2] - r * 0.82]];
  for (const [i, j, k] of [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]] as const) d.tri(p[i]!, p[j]!, p[k]!, shade(col, p[i]![1] > c[1] ? 1.1 : 0.8), shade(col, 0.85), shade(col, 0.85), c);
}
/** A flat polygon card in the plane spanned by `u` (across) and `up`, at `o` (local outline in metres), y-graded colours. */
function card(d: Draw, o: V, u: V, outline: readonly (readonly [number, number])[], col: (y: number) => RGB) {
  const P = outline.map(([x, y]) => addv(addv(o, u, x), UP, y)), faces = THREE.ShapeUtils.triangulateShape(outline.map(([x, y]) => new THREE.Vector2(x, y)), []), n = cross(u, UP);
  for (const f of faces) { const a = P[f[0]!]!, b = P[f[1]!]!, c = P[f[2]!]!; d.tri(a, b, c, col(a[1]), col(b[1]), col(c[1]), null, n); }
}

/* ------------------------------------------------------------------------------------------- season helpers */

/** Deciduous foliage state by month: bud (Apr), leaf (May–Aug), colour (Sep 0.4, Oct 1), bare (Nov–Mar). */
function leafState(month: number): { bare: boolean; fresh: number; fall: number } {
  const m = ((Math.round(month) - 1) % 12 + 12) % 12 + 1;
  return { bare: m >= 11 || m <= 3, fresh: m === 4 ? 0.55 : m === 5 ? 0.25 : 0, fall: m === 9 ? 0.4 : m === 10 ? 1 : 0 };
}
const FRESH: RGB = [0.72, 0.8, 0.42];
const pick = (l: readonly RGB[], i: number) => l[((i % l.length) + l.length) % l.length]!;

/* ------------------------------------------------------------------------------------------------ species */

type Build = (d: Draw, C: WWColours, look: WWLook, pal: MountainArtPalette, variant: string | null) => void;
const winterOf = (look: WWLook) => look.season === 'winter';

const reed: Build = (d, C, look) => {
  const n = d.full ? 4 : 4, tris = d.full ? 3 : 1, winter = winterOf(look), fall = leafState(look.month).fall, r = hashRand(17);
  for (let k = 0; k < n; k++) {
    const az = (k / n) * TAU + r() * 0.8, h = 2.0 + r() * 0.35 - (k === 3 ? 0.4 : 0), base: V = [Math.cos(az) * 0.12, -0.05, Math.sin(az) * 0.12];
    let tip = pick(C.reed, k + 1), foot = shade(pick(C.reed, k), 0.55);
    if (winter) { tip = mix(C.straw, SNOW, 0.2); foot = shade(C.straw, 0.6); } else if (fall) { tip = mix(tip, C.straw, 0.6 * fall); foot = mix(foot, shade(C.straw, 0.6), 0.4 * fall); }
    blade(d, base, az, h, 0.16, 0.18 + r() * 0.1, foot, shade(tip, 1.06), tris);
  }
};
const cattail: Build = (d, C, look) => {
  const winter = winterOf(look), fall = leafState(look.month).fall, r = hashRand(23), nb = d.full ? 3 : 2;
  for (let k = 0; k < nb; k++) {
    const az = (k / nb) * TAU + 0.4 + r() * 0.5, h = 1.8 + r() * 0.4, tip = winter ? C.straw : mix(pick(C.reed, k + 2), C.straw, fall * 0.55);
    blade(d, [Math.cos(az) * 0.1, -0.05, Math.sin(az) * 0.1], az, h, 0.15, 0.22, shade(winter ? C.straw : pick(C.reed, k), 0.55), tip, d.full ? 2 : 1);
  }
  // One spike: a thin stem card and a head of two crossed cards (the brown "cat's tail"); seed fluff in winter, green in spring.
  const head = winter ? C.seedFluff : look.month <= 5 ? mix(pick(C.reed, 1), C.cattailHead, 0.25) : C.cattailHead, top = 2.15, stem = shade(winter ? C.straw : pick(C.reed, 3), 0.9);
  d.tri([-0.025, -0.05, 0], [0.025, -0.05, 0], [0.02, top + 0.2, 0.01], shade(stem, 0.6), shade(stem, 0.6), stem, null, [0, 0, 1]);
  const hw = winter ? 0.07 : 0.05, y0 = top - 0.46, y1 = top, ym = (y0 + y1) / 2;
  for (const [ax, az] of d.full ? [[1, 0], [0, 1]] as const : [[0.7, 0.7]] as const) {
    const p = (s: number, y: number): V => [0.01 + ax * s, y, 0.005 + az * s];
    d.tri(p(0, y0 - 0.03), p(hw, ym), p(0, y1 + 0.03), shade(head, 0.78), shade(head, 0.95), shade(head, 1.08), null, [-az, 0, ax]);
    d.tri(p(0, y0 - 0.03), p(0, y1 + 0.03), p(-hw, ym), shade(head, 0.78), shade(head, 1.08), shade(head, 0.9), null, [-az, 0, ax]);
  }
};
const sedge: Build = (d, C, look) => {
  const n = d.full ? 6 : 5, tris = d.full ? 2 : 1, winter = winterOf(look), fall = leafState(look.month).fall, r = hashRand(29);
  for (let k = 0; k < n; k++) {
    const az = (k / n) * TAU + r() * 0.5, h = 0.55 + r() * 0.3, c = pick(C.sedge, k);
    const tip = winter ? mix(C.straw, SNOW, 0.35) : mix(c, C.copper, fall * 0.65), foot = shade(winter ? C.straw : c, 0.55);
    blade(d, [0, -0.04, 0], az, h, 0.18, 0.55 + r() * 0.2, foot, shade(tip, 1.05), tris);
  }
};
const lily: Build = (d, C, look) => {
  const pads = d.full ? 3 : 2, seg = d.full ? 8 : 6, r = hashRand(31), fall = leafState(look.month).fall, young = look.month === 4 || look.month === 5;
  const pad = young ? mix(C.lily, [0.62, 0.42, 0.36], 0.25) : mix(C.lily, C.autumnGold, fall * 0.5);
  for (let p = 0; p < pads; p++) {
    const a = p * 2.3 + r(), rr = p === 0 ? 0 : 0.5 + r() * 0.3, c: V = [Math.cos(a) * rr, 0.015 + p * 0.004, Math.sin(a) * rr], R = (0.42 + r() * 0.22) * (young ? 0.75 : 1), notch = r() * TAU;
    for (let k = 0; k < seg - 1; k++) { const a0 = notch + 0.35 + (k / (seg - 1)) * (TAU - 0.7), a1 = notch + 0.35 + ((k + 1) / (seg - 1)) * (TAU - 0.7);
      d.tri(c, [c[0] + Math.cos(a0) * R, c[1], c[2] + Math.sin(a0) * R], [c[0] + Math.cos(a1) * R, c[1], c[2] + Math.sin(a1) * R], shade(pad, 0.86), shade(pad, 1.04 + (k % 2) * 0.04), shade(pad, 1.04 + (k % 2) * 0.04), null, UP); }
  }
  if (look.stage === 'bloom' && look.month >= 6 && look.month <= 8) {
    const c: V = [0.06, 0.03, -0.04], petals = d.full ? 5 : 3, f = C.lilyFlower;
    for (let k = 0; k < petals; k++) { const a = (k / petals) * TAU;
      d.tri([c[0] + Math.cos(a - 0.7) * 0.05, c[1], c[2] + Math.sin(a - 0.7) * 0.05], [c[0] + Math.cos(a + 0.7) * 0.05, c[1], c[2] + Math.sin(a + 0.7) * 0.05], [c[0] + Math.cos(a) * 0.2, c[1] + 0.12, c[2] + Math.sin(a) * 0.2], shade(f, 0.86), shade(f, 0.86), shade(f, 1.06), null, UP); }
    if (d.full) d.tri([c[0] - 0.04, c[1] + 0.05, c[2]], [c[0] + 0.04, c[1] + 0.05, c[2] - 0.02], [c[0], c[1] + 0.05, c[2] + 0.04], [0.91, 0.76, 0.35], [0.91, 0.76, 0.35], [0.95, 0.82, 0.4], null, UP);
  }
};
const willow: Build = (d, C, look) => {
  const ls = leafState(look.month), r = hashRand(37), full = d.full;
  const leaf = (i: number) => { let c = pick(C.willow, i); if (ls.bare) c = C.willowTwig; else { c = mix(c, FRESH, ls.fresh); c = mix(c, C.autumnGold, ls.fall * 0.65); } return c; };
  const bark = C.willowTrunk;
  tube(d, [0, -0.2, 0], [0.3, 2.8, 0.1], 0.46, 0.32, full ? 5 : 3, shade(bark, 0.75), bark);
  tube(d, [0.3, 2.8, 0.1], [-0.9, 5.2, 0.4], 0.28, 0.14, full ? 4 : 3, bark, bark);
  if (full) tube(d, [0.3, 2.8, 0.1], [1.3, 5.4, -0.5], 0.26, 0.13, 4, bark, bark);
  // A broad lumpy dome, and the weeping fringe: one continuous skirt from under the dome's rim flaring to a hem of
  // long and short strands nearly to the ground (the "round-weeping" archetype, STYLE §3.2), lit at its tips.
  const k = ls.bare ? 0.82 : 1, crownCol = grad(leaf(0), 4.5, 9.0, 0.66, 1.1);
  if (full) { lump(d, [-0.6, 7.0, 0.5], 2.6 * k, 1.7 * k, 2.4 * k, 5, crownCol, { seed: 41 }); lump(d, [1.0, 7.3, -0.5], 2.5 * k, 1.6 * k, 2.4 * k, 5, crownCol, { seed: 42 }); }
  else lump(d, [0.2, 7.1, 0], 3.3 * k, 1.8 * k, 3.1 * k, 5, crownCol, { seed: 41 });
  const n = full ? 10 : 7, top: V[] = [], hem: V[] = [];
  for (let j = 0; j < n; j++) { const a = (j / n) * TAU; top.push([0.2 + Math.cos(a) * 3.0 * k, 6.5 - r() * 0.3, Math.sin(a) * 2.9 * k]); }
  for (let j = 0; j < n * 2; j++) { const a = (j / (n * 2)) * TAU + 0.05, long = j % 2 === 0, rr = (long ? 4.3 : 3.9) * k * (0.94 + r() * 0.12); hem.push([0.2 + Math.cos(a) * rr, long ? 0.9 + r() * 0.9 : 2.9 + r() * 0.8, Math.sin(a) * rr * 0.97]); }
  const tc = (j: number) => shade(leaf(j), 0.7), hc = (j: number, long: boolean) => shade(leaf(j + 1), long ? 1.08 : 0.95);
  for (let j = 0; j < n; j++) {
    const t0 = top[j]!, t1 = top[(j + 1) % n]!, h0 = hem[2 * j]!, h1 = hem[2 * j + 1]!, h2 = hem[(2 * j + 2) % (2 * n)]!, a = ((j + 0.5) / n) * TAU, out: V = [Math.cos(a), 0, Math.sin(a)];
    d.tri(t0, h0, h1, tc(j), hc(j, true), hc(j, false), null, out); d.tri(t0, h1, t1, tc(j), hc(j, false), tc(j + 1), null, out); d.tri(t1, h1, h2, tc(j + 1), hc(j, false), hc(j + 1, true), null, out);
  }
};
const tamarack: Build = (d, C, look) => {
  const ls = leafState(look.month), full = d.full, winter = winterOf(look);
  let tone = pick(C.tamarack, 0); if (ls.bare) tone = C.twig; else { tone = mix(tone, FRESH, ls.fresh); tone = mix(tone, C.autumnGold, ls.fall * 0.9); }
  tube(d, [0, -0.15, 0], [0, 9.4, 0], 0.2, 0.04, full ? 5 : 3, shade(C.bark, 0.8), C.bark);
  const col = grad(tone, 1.2, 9.4, 0.62, 1.1), k = ls.bare ? 0.82 : 1;
  const tiers: [number, number, number][] = full ? [[1.3, 2.6, 2.2], [3.3, 2.4, 1.75], [5.2, 2.3, 1.3], [7.0, 2.4, 0.8]] : [[1.4, 3.2, 2.1], [4.2, 2.9, 1.45], [6.6, 2.9, 0.85]];
  tiers.forEach(([y, h, r], i) => cone(d, [0, y, 0], r * k, h, full ? 6 : 5, col, { spin: i * 0.7, jag: 0.25, snow: winter ? 0.45 : 0, seed: 50 + i }));
};
const spruce: Build = (d, C, look, _pal, variant) => {
  const full = d.full, snow = winterOf(look) ? 0.62 : 0;
  if (variant === 'tuck') {
    // Tuckamore: wind-clipped, flat-topped mats streaming downwind (+x), a stub of trunk under the lee edge.
    const col = grad(pick(C.spruce, 0), 0, 1.4, 0.6, 1.05);
    lump(d, [0, 0.55, 0], 1.9, 0.62, 1.5, full ? 6 : 5, col, { seed: 61, snow, flat: 0.9 });
    if (full) lump(d, [0.95, 0.72, 0.25], 1.3, 0.55, 1.1, 5, col, { seed: 62, snow, flat: 0.9 });
    return;
  }
  if (variant === 'black') {
    // Black spruce: narrow, short drooping tiers, a dense clubbed top.
    tube(d, [0, -0.15, 0], [0, 1.6, 0], 0.17, 0.12, full ? 4 : 3, shade(C.spruceTrunk, 0.8), C.spruceTrunk);
    const col = grad(pick(C.spruce, 0), 0.6, 9.4, 0.6, 1.1);
    const tiers: [number, number, number][] = full ? [[0.7, 2.6, 1.2], [2.3, 2.4, 1.0], [3.8, 2.3, 0.85], [5.3, 2.2, 0.65], [6.7, 1.8, 0.45]] : [[0.7, 3.2, 1.15], [3.2, 3.0, 0.85], [5.6, 2.8, 0.55]];
    tiers.forEach(([y, h, r], i) => cone(d, [0, y, 0], r, h, full ? 6 : 5, col, { spin: i * 0.9, jag: 0.35, snow, seed: 70 + i }));
    lump(d, [0.05, 8.5, 0], 0.55, 0.9, 0.5, full ? 4 : 3, col, { seed: 77, snow });
    return;
  }
  // White spruce: a dense cone to near the ground over a short visible trunk.
  tube(d, [0, -0.15, 0], [0, 1.8, 0], 0.22, 0.16, full ? 5 : 3, shade(C.spruceTrunk, 0.8), C.spruceTrunk);
  const col = grad(pick(C.spruce, 0), 0.8, 9.6, 0.6, 1.1);
  const tiers: [number, number, number][] = full ? [[0.8, 3.2, 2.1], [2.4, 3.0, 1.75], [4.0, 2.8, 1.4], [5.6, 2.5, 1.0], [7.1, 2.5, 0.6]] : [[0.8, 4.0, 2.0], [3.4, 3.6, 1.35], [6.0, 3.6, 0.75]];
  tiers.forEach(([y, h, r], i) => cone(d, [0, y, 0], r, h, full ? 7 : 5, col, { spin: i * 0.6, jag: 0.2, snow, seed: 80 + i }));
};
const balsam: Build = (d, C, look) => {
  const full = d.full, snow = winterOf(look) ? 0.62 : 0;
  tube(d, [0, -0.15, 0], [0, 1.3, 0], 0.2, 0.15, full ? 5 : 3, shade(C.spruceTrunk, 0.8), C.spruceTrunk);
  const col = grad(pick(C.balsam, 0), 0.8, 10.6, 0.58, 1.08);
  const tiers: [number, number, number][] = full ? [[0.8, 3.0, 1.8], [2.6, 2.9, 1.45], [4.4, 2.8, 1.1], [6.2, 2.8, 0.7]] : [[0.8, 3.8, 1.75], [3.6, 3.5, 1.2], [6.2, 3.2, 0.7]];
  tiers.forEach(([y, h, r], i) => cone(d, [0, y, 0], r, h, full ? 7 : 5, col, { spin: i * 0.45, snow, seed: 90 + i }));
  cone(d, [0, 8.6, 0], 0.22, 2.0, full ? 5 : 3, col, { cap: false, snow });
};
const cypress: Build = (d, C) => {
  const full = d.full, col = grad(pick(C.cypress, 0), 0.8, 14.2, 0.58, 1.1);
  tube(d, [0, -0.15, 0], [0, 1.1, 0], 0.2, 0.16, 3, shade(C.bark, 0.8), C.bark);
  spindle(d, [[0.8, 0.55], [4.5, 1.3], [9.5, 1.0]], [0.15, 14.2, 0.05], full ? 8 : 6, col, { seed: 101, twist: 0.35 });
};
const olive: Build = (d, C) => {
  const full = d.full, bark = C.oliveTrunk;
  tube(d, [0, -0.2, 0], [0.25, 1.4, 0.1], 0.4, 0.3, full ? 5 : 3, shade(bark, 0.75), bark, { spin: 0.9 });
  tube(d, [0.25, 1.4, 0.1], [-0.8, 2.7, 0.3], 0.24, 0.13, full ? 4 : 3, bark, bark);
  if (full) tube(d, [0.25, 1.4, 0.1], [1.0, 2.8, -0.4], 0.22, 0.12, 4, bark, bark);
  const silver: RGB = [0.8, 0.82, 0.74];
  const lumps: [V, number, number, number][] = full ? [[[-0.9, 3.6, 0.4], 1.7, 0.9, 1.5], [[1.1, 3.9, -0.5], 1.6, 0.85, 1.4], [[0.1, 4.6, 0.0], 1.5, 0.8, 1.4]] : [[[-0.6, 3.7, 0.3], 1.9, 1.0, 1.7], [[0.8, 4.3, -0.3], 1.7, 0.95, 1.5]];
  lumps.forEach(([c, rx, ry, rz], i) => lump(d, c, rx, ry, rz, full ? 5 : 4, (y: number) => mix(grad(pick(C.olive, i), 2.7, 5.5, 0.62, 1.08)(y), silver, clamp01((y - 3.6) / 2) * 0.22), { seed: 110 + i }));
};
const stonePine: Build = (d, C) => {
  const full = d.full, bark = C.stonePineTrunk;
  tube(d, [0, -0.2, 0], [0.6, 5.0, 0.2], 0.42, 0.32, full ? 5 : 4, shade(bark, 0.72), bark, { spin: 0.2 });
  tube(d, [0.6, 5.0, 0.2], [1.4, 9.6, 0.1], 0.32, 0.22, full ? 5 : 4, bark, shade(bark, 1.06));
  const top: V = [1.4, 9.6, 0.1];
  const discs: [V, number][] = full ? [[[-1.9, 12.1, 1.1], 3.4], [[4.1, 11.9, -1.3], 3.2], [[0.9, 12.6, -2.8], 3.1], [[1.3, 13.2, 0.7], 3.7]] : [[[-0.8, 12.2, 0.8], 3.7], [[3.4, 12.3, -1.2], 3.5], [[1.3, 13.1, -0.4], 3.4]];
  if (full) for (const [c] of discs.slice(0, 3)) tube(d, top, [c[0] * 0.8 + top[0] * 0.2, c[1] - 0.9, c[2] * 0.8 + top[2] * 0.2], 0.18, 0.09, 3, bark, bark);
  discs.forEach(([c, r], i) => lens(d, c, r, 1.15, full ? 7 : 5, grad(pick(C.stonePine, i), 11.2, 14.4, 0.6, 1.1), { seed: 120 + i }));
};
const juniper: Build = (d, C, look) => {
  const full = d.full, col = grad(pick(C.juniper, 0), 0, 2.6, 0.6, 1.08), snow = winterOf(look) ? 0.55 : 0;
  lump(d, [0, 0.9, 0], 1.4, 1.0, 1.25, full ? 6 : 5, col, { seed: 131, snow, flat: 0.85 });
  if (full) cone(d, [0.2, 1.3, 0.1], 0.8, 1.3, 6, col, { cap: false, snow, seed: 132 });
};
const cedar: Build = (d, C, look) => {
  const full = d.full, winter = winterOf(look), tone = winter ? mix(pick(C.cedar, 0), C.cedarWinter, 0.35) : pick(C.cedar, 0), col = grad(tone, 0.7, 9.8, 0.6, 1.1), snow = winter ? 0.4 : 0;
  tube(d, [0, -0.15, 0], [0, 1.4, 0], 0.2, 0.15, full ? 4 : 3, shade(C.cedarTrunk, 0.8), C.cedarTrunk);
  lump(d, [0, 1.75, 0], 1.8, 1.0, 1.7, full ? 6 : 4, col, { seed: 141, snow });
  cone(d, [0, 1.9, 0], 1.45, 7.9, full ? 7 : 5, col, { snow, seed: 142, jag: 0.15 });
};
const prairieGrass: Build = (d, C, look) => {
  const winter = winterOf(look), fall = leafState(look.month).fall, spring = look.month >= 3 && look.month <= 5, late = look.month === 8 || look.month === 9;
  const H = spring ? 0.7 : 1.2, n = 2;
  const body = winter ? C.straw : mix(C.bluestem, C.copper, fall), tip = winter ? mix(C.straw, SNOW, 0.5) : late ? C.bluestemTip : fall ? C.copper : mix(C.bluestem, FRESH, spring ? 0.4 : 0.1);
  // A fountain: narrow at the root, three tips fanning out (full), two (lite).
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI + 0.3 + k * 0.2, u: V = [Math.cos(a), 0, Math.sin(a)], col = (y: number) => mix(shade(body, 0.58), tip, clamp01(y / H) ** 0.8), h = H * (k ? 0.88 : 1);
    card(d, [0, -0.03, 0], u, d.full ? [[-0.15, 0], [0.15, 0], [0.52, h * 0.84], [0.12, h * 0.38], [0.03, h], [-0.1, h * 0.4], [-0.48, h * 0.76]] : [[-0.16, 0], [0.16, 0], [0.42, h], [-0.38, h * 0.85]], col);
  }
};
const fanPalm: Build = (d, C) => {
  const full = d.full, TT = WW_SPEC.fanPalm.stretchTop!, segs = full ? 3 : 2, n = full ? 6 : 5, lean = 0.4;
  const at = (t: number): V => [lean * t * t, TT * t, 0];
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs, r0 = i === 0 ? 0.46 : 0.34 - 0.14 * t0, r1 = 0.34 - 0.14 * t1;
    tube(d, at(t0), at(t1), r0, r1, n, shade(C.fanTrunk, i === 0 ? 0.72 : 0.94 + (i % 2) * 0.06), shade(C.fanTrunk, 1.02 - (i % 2) * 0.06), { lit: 0.12, spin: i * 0.5 });
  }
  d.crown = 1;
  const c = at(1);
  // The skirt of dead fronds under the crown, its hem ragged.
  const sk = full ? 6 : 5, rt = 0.42, rb = 0.66;
  for (let k = 0; k < sk; k++) {
    const a0 = (k / sk) * TAU, a1 = ((k + 1) / sk) * TAU, P = (a: number, r: number, y: number): V => [c[0] + Math.cos(a) * r, y, c[2] + Math.sin(a) * r];
    const hem0 = c[1] - 1.7 - (k % 2) * 0.25, hem1 = c[1] - 1.7 - ((k + 1) % 2) * 0.25, out: V = [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)];
    d.tri(P(a0, rb, hem0), P(a1, rb, hem1), P(a1, rt, c[1] + 0.1), shade(C.fanSkirt, 0.7), shade(C.fanSkirt, 0.7), C.fanSkirt, null, out);
    d.tri(P(a0, rb, hem0), P(a1, rt, c[1] + 0.1), P(a0, rt, c[1] + 0.1), shade(C.fanSkirt, 0.7), C.fanSkirt, C.fanSkirt, null, out);
  }
  // Fronds: a petiole and a palmate fan, every third upswept, the lowest drooping and browning.
  const F = full ? 15 : 10, top: V = [c[0], c[1] + 0.25, c[2]];
  for (let f = 0; f < F; f++) {
    const az = (f / F) * TAU + (f % 2) * 0.2, up3 = f % 3 === 0, old = !up3 && f % 4 === 1, dir: V = [Math.cos(az), 0, Math.sin(az)], side: V = [-dir[2], 0, dir[0]];
    const L = up3 ? 1.5 : 2.0, rise = up3 ? 1.3 : old ? -0.7 : 0.4, P1 = addv(addv(top, dir, L), UP, rise), R = up3 ? 1.25 : 1.5;
    // The fan opens up and out from the petiole's end, its face toward the outside (it reads from below as a bright fan).
    const g = old ? mix(pick(C.fanFrond, f), C.fanSkirt, 0.45) : shade(pick(C.fanFrond, f), 1.08), fwd = norm(addv(dir, UP, up3 ? 2.2 : old ? -1.4 : 0.9));
    d.tri(addv(top, side, -0.05), addv(top, side, 0.05), P1, shade(g, 0.7), shade(g, 0.7), shade(g, 0.85), null, UP);
    const angles = full ? [-1.3, -0.65, 0, 0.65, 1.3] : [-1.2, 0, 1.2];
    const arc = angles.map(p => addv(addv(P1, fwd, Math.cos(p) * R), side, Math.sin(p) * R * 1.05)).map((p, i) => (i === Math.floor(angles.length / 2) ? addv(p, UP, 0.12) : p));
    for (let k = 0; k < arc.length - 1; k++) d.tri(P1, arc[k]!, arc[k + 1]!, shade(g, 0.82), shade(g, 1.08 - (k % 2) * 0.08), shade(g, 1.0 + (k % 2) * 0.08), null, UP);
  }
  d.crown = 0;
};
const canaryPalm: Build = (d, C) => {
  const full = d.full, TT = WW_SPEC.canaryPalm.stretchTop!, segs = full ? 4 : 3, n = full ? 7 : 5;
  for (let i = 0; i < segs; i++) {
    const y0 = (i / segs) * TT, y1 = ((i + 1) / segs) * TT, r0 = i === 0 ? 0.88 : 0.75 - 0.13 * (i / segs), r1 = 0.75 - 0.13 * ((i + 1) / segs);
    // Leaf-base diamonds: each segment's ring turned half a facet from the last, alternate segments a shade apart.
    tube(d, [0, y0 - (i === 0 ? 0.15 : 0), 0], [0, y1, 0], r0, r1, n, shade(C.canaryTrunk, i === 0 ? 0.7 : 0.95 - (i % 2) * 0.08), shade(C.canaryTrunk, 1.05 - (i % 2) * 0.08), { spin: i * Math.PI / n, lit: 0.1 });
  }
  d.crown = 1;
  const ball: V = [0, TT + 0.35, 0];
  lump(d, ball, 1.2, 0.9, 1.2, full ? 6 : 4, grad(C.canaryBall, TT - 0.4, TT + 1.3, 0.62, 1.05), { seed: 151, ink: 0 });
  const F = full ? 14 : 10, stations = 2;
  for (let f = 0; f < F; f++) {
    const az = (f / F) * TAU + (f % 2) * 0.22, dir: V = [Math.cos(az), 0, Math.sin(az)], side: V = [-dir[2], 0, dir[0]], upper = f % 2 === 0;
    const L = 5.2 * (0.9 + ((f * 37) % 10) / 50), rise = upper ? 1.9 : 1.0, droop = upper ? 1.8 : 2.8, W = 0.62, fold = full ? 0.12 : 0;
    const at = (u: number): V => addv(addv(addv(ball, UP, 0.5), dir, 0.6 + L * u), UP, rise * u - droop * u * u);
    const width = (u: number) => Math.max(0.05, W * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.9)));
    const g = shade(pick(C.canaryFrond, f), 1.12);
    for (let j = 0; j < stations; j++) {
      const u0 = j / stations, u1 = (j + 1) / stations, p0 = at(u0), p1 = at(u1), w0 = width(u0), w1 = width(u1);
      const r0 = addv(p0, UP, fold), r1 = addv(p1, UP, fold), l0 = addv(p0, side, w0), l1 = addv(p1, side, w1), q0 = addv(p0, side, -w0), q1 = addv(p1, side, -w1);
      const g0 = shade(g, 0.84 + u0 * 0.3), g1 = shade(g, 0.84 + u1 * 0.3), rib0 = mix(g0, [0.92, 0.88, 0.62], 0.35), rib1 = mix(g1, [0.92, 0.88, 0.62], 0.35);
      if (full) { d.tri(r0, r1, l1, rib0, rib1, g1, null, UP); d.tri(r0, l1, l0, rib0, g1, g0, null, UP); d.tri(r0, q0, q1, rib0, g0, g1, null, UP); d.tri(r0, q1, r1, rib0, g1, rib1, null, UP); }
      else { d.tri(l0, l1, q1, g0, g1, g1, null, UP); d.tri(l0, q1, q0, g0, g1, g0, null, UP); }
    }
  }
  d.crown = 0;
};
const fern: Build = (d, C, look) => {
  // Ostrich fern: a vase of arching fronds, each a long diamond folded down its rib (pale rib, darker edges).
  const winter = winterOf(look), fall = leafState(look.month).fall, bud = look.month === 4;
  const n = d.full ? 6 : 4, rise = winter ? 0.32 : bud ? 0.55 : 1, r = hashRand(161);
  for (let k = 0; k < n; k++) {
    const az = (k / n) * TAU + r() * 0.5, dir: V = [Math.cos(az), 0, Math.sin(az)], perp: V = [-dir[2], 0, dir[0]];
    const g = winter ? C.fernRust : mix(shade(pick(C.fern, k), 1.08), C.fernRust, fall * 0.7), L = (1.0 + r() * 0.2) * rise, spread = winter ? 1.2 : 1;
    const base = addv([0, -0.02, 0], dir, 0.06), mid = addv(addv(base, dir, 0.4 * spread), UP, 0.7 * L), tip = addv(addv(base, dir, 0.95 * spread), UP, 0.62 * L), w = 0.21, hint = cross(perp, sub(tip, base));
    const rib = addv(mid, UP, 0.05), edgeL = addv(mid, perp, -w), edgeR = addv(mid, perp, w);
    d.tri(base, edgeR, tip, shade(g, 0.6), shade(g, 0.92), shade(g, 1.1), null, hint);
    d.tri(base, tip, edgeL, shade(g, 0.6), shade(g, 1.1), shade(g, 0.92), null, hint);
    void rib;
  }
};
const woodlandCard: Build = (d, C, look, _pal, variant) => {
  // Two crossed cards, each folded down its middle (so its halves catch the light differently): a back-row conifer
  // (low shoulders, a tall peak) or a broadleaf mass (high shoulders, a low crown peak). 8 triangles.
  const ls = leafState(look.month), spire = variant === 'spire', winter = winterOf(look);
  const shoulder = spire ? 5.2 : 8.6, peak = spire ? 14 : 12.6, half = spire ? 4.4 : 4.9, fold = 0.42;
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI / 2 + 0.3, u: V = [Math.cos(a), 0, Math.sin(a)], n: V = [-u[2], 0, u[0]];
    let tone = spire ? pick(C.spruce, k) : pick(C.canopy, k * 2 + 1);
    if (!spire) { if (ls.bare) tone = C.twig; else tone = mix(mix(tone, FRESH, ls.fresh * 0.6), pick(C.canopyAutumn, k), ls.fall * 0.8); }
    const col = (y: number, lit: number): RGB => { const c = shade(tone, (0.5 + 0.55 * clamp01((y - 1.5) / (peak - 1.5))) * lit); return winter && y > peak - 2.5 ? mix(c, SNOW, spire ? 0.45 : 0.25) : c; };
    const B: V = [0, 1.5, 0], T: V = [0, peak, 0];
    for (const s of [-1, 1] as const) {
      const out = addv([u[0] * s * half * Math.cos(fold), 0, u[2] * s * half * Math.cos(fold)], n, half * Math.sin(fold));
      const foot: V = [out[0], 1.8, out[2]], sh: V = [out[0] * (spire ? 0.82 : 1), shoulder + (s > 0 ? 0.6 : 0), out[2] * (spire ? 0.82 : 1)], lit = s > 0 ? 1.04 : 0.86;
      d.tri(B, foot, sh, col(B[1], lit), col(foot[1], lit), col(sh[1], lit), null, n);
      d.tri(B, sh, T, col(B[1], lit), col(sh[1], lit), col(T[1], lit), null, n);
    }
  }
};
const iceplant: Build = (d, C, look) => {
  const winter = winterOf(look), g = winter ? C.iceplantWinter : C.iceplant;
  mound(d, [0, -0.02, 0], 0.85, 0.6, 0.28, g, 0.2);
  if (d.full) mound(d, [0.55, -0.02, 0.3], 0.55, 0.45, 0.22, shade(g, 1.06), 1.1);
  if (look.stage === 'bloom' || look.stage === 'bud') {
    const r = hashRand(171), n = look.stage === 'bud' ? 2 : d.full ? 6 : 3;
    for (let k = 0; k < n; k++) { const a = r() * TAU, rr = 0.15 + r() * 0.5, c: V = [Math.cos(a) * rr, 0.24 + r() * 0.04, Math.sin(a) * rr * 0.8], f = pick(C.iceFlower, k % 3 === 2 ? 1 : 0), s = 0.11;
      d.tri([c[0] - s, c[1], c[2] - s * 0.6], [c[0] + s, c[1], c[2] - s * 0.6], [c[0], c[1] + 0.02, c[2] + s], f, shade(f, 0.92), shade(f, 1.06), null, UP); }
  }
};
const bougainvillea: Build = (d, C, look) => {
  // Local frame: the wall is the plane z = 0 behind the plant (local −z); the climber grows up +y and spreads along x.
  const winter = winterOf(look), r = hashRand(181), stem = shade(C.bark, 0.9);
  d.tri([-0.05, -0.05, 0.12], [0.07, -0.05, 0.12], [0.3, 2.7, 0.1], shade(stem, 0.7), shade(stem, 0.7), stem, null, [0, 0, 1]);
  if (d.full) d.tri([-0.05, -0.05, 0.12], [0.3, 2.7, 0.1], [0.16, 2.7, 0.1], shade(stem, 0.7), stem, stem, null, [0, 0, 1]);
  const blobs: [number, number, number][] = d.full ? [[0.2, 1.4, 0.6], [-0.5, 2.2, 0.7], [0.65, 2.6, 0.68], [-0.2, 3.2, 0.75], [0.7, 3.5, 0.6], [0.1, 3.95, 0.55]] : [[0.1, 1.6, 0.75], [-0.3, 2.6, 0.8], [0.55, 3.0, 0.75], [0.1, 3.8, 0.65]];
  blobs.forEach(([x, y, rr], i) => {
    const green = winter ? i !== 2 : i % 3 === 1, c0 = green ? C.bracts : pick(C.bract, i), apex: V = [x + (r() - 0.5) * 0.1, y + 0.05, 0.42 + r() * 0.1], seg = d.full ? 5 : 4;
    for (let k = 0; k < seg; k++) { const a0 = (k / seg) * TAU + i, a1 = ((k + 1) / seg) * TAU + i;
      const p0: V = [x + Math.cos(a0) * rr, y + Math.sin(a0) * rr * 0.85, 0.06], p1: V = [x + Math.cos(a1) * rr, y + Math.sin(a1) * rr * 0.85, 0.06], lit = 0.85 + 0.25 * Math.max(0, Math.sin((a0 + a1) / 2));
      d.tri(apex, p0, p1, shade(c0, 1.06), shade(c0, lit * 0.85), shade(c0, lit * 0.85), null, [0, 0, 1]); }
  });
};
const lemonPot: Build = (d, C) => {
  const full = d.full, n = full ? 6 : 5, pot = C.terracotta;
  const ring = (y: number, r: number, spin = 0) => Array.from({ length: n }, (_, k) => [Math.cos((k / n) * TAU + spin) * r, y, Math.sin((k / n) * TAU + spin) * r] as V);
  const rings = full ? [ring(0, 0.3), ring(0.52, 0.42), ring(0.62, 0.47)] : [ring(0, 0.3), ring(0.6, 0.45)];
  const cols = full ? [shade(pot, 0.72), shade(pot, 1.0), shade(pot, 1.12)] : [shade(pot, 0.72), shade(pot, 1.06)];
  for (let i = 1; i < rings.length; i++) for (let k = 0; k < n; k++) { const a0 = rings[i - 1]![k]!, a1 = rings[i - 1]![(k + 1) % n]!, b0 = rings[i]![k]!, b1 = rings[i]![(k + 1) % n]!;
    d.tri(a0, a1, b1, cols[i - 1]!, cols[i - 1]!, cols[i]!, [0, 0.3, 0]); d.tri(a0, b1, b0, cols[i - 1]!, cols[i]!, cols[i]!, [0, 0.3, 0]); }
  const soil = ring(full ? 0.58 : 0.56, 0.4); for (let k = 1; k < n - 1; k++) d.tri(soil[0]!, soil[k]!, soil[k + 1]!, [0.36, 0.27, 0.2], [0.36, 0.27, 0.2], [0.36, 0.27, 0.2], null, UP);
  d.tri([-0.03, 0.56, 0], [0.03, 0.56, 0], [0, 1.0, 0], shade(C.bark, 0.8), shade(C.bark, 0.8), C.bark, null, [0, 0, 1]);
  const crown: V = [0, 1.28, 0];
  lump(d, crown, 0.56, 0.48, 0.56, full ? 5 : 4, grad(C.lemonLeaf, 0.9, 1.8, 0.62, 1.08), { seed: 191, ink: 0 });
  const L = full ? 5 : 3; for (let k = 0; k < L; k++) { const a = k * 2.4 + 0.3, y = 1.15 + (k % 3) * 0.16; dot(d, [Math.cos(a) * 0.5, y, Math.sin(a) * 0.5], 0.075, C.lemon); }
};
const dogwood: Build = (d, C, look) => {
  const ls = leafState(look.month), r = hashRand(201), n = d.full ? 7 : 5, stem = ls.bare ? shade(C.dogwoodStem, 1.08) : C.dogwoodStem;
  for (let k = 0; k < n; k++) { const a = (k / n) * TAU + r() * 0.5, h = 1.5 + r() * 0.5, base: V = [Math.cos(a) * 0.1, -0.05, Math.sin(a) * 0.1], tip: V = [Math.cos(a) * (0.5 + r() * 0.3), h, Math.sin(a) * (0.5 + r() * 0.3)];
    d.tri(addv(base, [-Math.sin(a), 0, Math.cos(a)], -0.04), addv(base, [-Math.sin(a), 0, Math.cos(a)], 0.04), tip, shade(stem, 0.65), shade(stem, 0.65), shade(stem, 1.05), null, [Math.cos(a), 0, Math.sin(a)]); }
  if (ls.bare) return;
  const leaf = mix(mix(C.dogwoodLeaf, FRESH, ls.fresh), C.dogwoodAutumn, ls.fall);
  lump(d, [0, 1.25, 0], 1.0, 0.68, 0.92, d.full ? 6 : 4, grad(leaf, 0.6, 2.0, 0.62, 1.08), { seed: 203, ink: 0 });
  // Flat white flower clusters in late May–June, white berries in August–September.
  if ((look.month >= 5 && look.month <= 6) || (look.month >= 8 && look.month <= 9)) {
    const f: RGB = look.month <= 6 ? [0.96, 0.95, 0.9] : [0.9, 0.92, 0.95], k = d.full ? 4 : 2;
    for (let i = 0; i < k; i++) { const a = i * 1.7 + 0.4, c: V = [Math.cos(a) * 0.55, 1.62 + (i % 2) * 0.12, Math.sin(a) * 0.5];
      d.tri([c[0] - 0.14, c[1], c[2] - 0.08], [c[0] + 0.14, c[1], c[2] - 0.08], [c[0], c[1] + 0.03, c[2] + 0.15], f, shade(f, 0.9), shade(f, 1.04), null, UP); }
  }
};
const apple: Build = (d, C, look, pal) => {
  const full = d.full, ls = leafState(look.month), m = look.month, bark = pal.theme === 'taylor' ? pal.timberLight : shade(pal.timber, 1.05);
  tube(d, [0, -0.2, 0], [0.2, 1.5, 0.1], 0.27, 0.2, full ? 5 : 3, shade(bark, 0.75), bark, { spin: 0.6 });
  const limbs: V[] = ls.bare ? [[-1.3, 2.7, 0.5], [1.5, 2.8, -0.4], [0.3, 3.2, 1.4], [0.2, 3.6, -1.2], [-0.4, 3.9, 0.1]] : full ? [[-1.2, 2.6, 0.5], [1.4, 2.7, -0.4], [0.3, 3.0, 1.3]] : [[-1.0, 2.7, 0.4], [1.2, 2.8, -0.3]];
  for (const l of limbs) tube(d, [0.2, 1.5, 0.1], l, 0.14, 0.06, 3, bark, bark);
  if (ls.bare) return;
  const leaf = (i: number) => mix(mix(pick(C.appleLeaf, i), FRESH, ls.fresh), C.autumnGold, ls.fall * 0.35);
  const lumps: [V, number, number, number][] = full ? [[[-0.8, 2.8, 0.45], 1.6, 1.3, 1.45], [[1.05, 2.9, -0.35], 1.5, 1.25, 1.45], [[0.2, 3.65, 0.3], 1.6, 1.3, 1.5]] : [[[-0.5, 3.0, 0.3], 1.8, 1.4, 1.65], [[0.8, 3.4, -0.2], 1.7, 1.35, 1.55]];
  lumps.forEach(([c, rx, ry, rz], i) => lump(d, c, rx, ry, rz, full ? 5 : 4, grad(leaf(i), 2.4, 5.2, 0.62, 1.1), { seed: 211 + i }));
  // Blossom in April (buds, few) and May (full), apples August–October (STYLE §1.4.2; the Hollow's orchard).
  const blossom = m === 4 || m === 5, fruit = m >= 8 && m <= 10, n = !blossom && !fruit ? 0 : full ? (m === 4 ? 6 : 12) : 6, r = hashRand(219);
  for (let k = 0; k < n; k++) { const L = lumps[k % lumps.length]!, a = r() * TAU, yy = r() * 0.8 - 0.1, c: V = [L[0][0] + Math.cos(a) * L[1] * 0.9, L[0][1] + yy * L[2], L[0][2] + Math.sin(a) * L[3] * 0.9];
    dot(d, c, blossom ? (m === 4 ? 0.11 : 0.16) : 0.14, blossom ? pick(C.blossom, k) : k % 4 === 0 ? mix(C.fruit, [0.9, 0.75, 0.3], 0.4) : C.fruit); }
};

const BUILD: Record<Exclude<WWSpecies, 'oakGiant'>, Build> = {
  reed, cattail, sedge, lily, willow, tamarack, spruce, balsam, cypress, olive, stonePine, juniper, cedar, prairieGrass,
  fanPalm, canaryPalm, fern, woodlandCard, iceplant, bougainvillea, lemonPot, dogwood, apple,
};

/** Whether a species draws anything in a season look (lilies are gone in winter). */
export const wwDrawn = (species: WWSpecies, look: WWLook) => !(species === 'lily' && (look.season === 'winter' || look.month === 3 || look.month === 11));

/** The unit geometry of one species (variant) in a dressing, tier and season look; null when it draws nothing then. */
export function wwGeometry(species: WWSpecies, variant: string | null, pal: MountainArtPalette, tier: PlantTier, look: WWLook): WWGeometry | null {
  if (!wwDrawn(species, look)) return null;
  const spec = WW_SPEC[species];
  if (species === 'oakGiant') return oakGeometry(pal, tier, look);
  const d = new Draw(tier === 'full', spec.shell);
  BUILD[species](d, wwColours(pal), look, pal, variant);
  return d.result(spec.stretchTop !== undefined);
}
export { pick, leafState, clamp01, addv, sub, norm, cross };
