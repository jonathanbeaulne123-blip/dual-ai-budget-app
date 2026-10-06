/**
 * The rest of the island's props, by place: water and shore (boats, buoys, quay bollards, nets, crates, life rings,
 * rod holders, nest boxes, the osprey pole, snags), meadow and beach (umbrellas, towels, fire rings, the volleyball net,
 * the skate bowl's rim, kites, the oak's swing, bocce, the chalk geoglyph, hives, hay, cairns, month stones, the sundial)
 * and town and library (laundry, stalls, café tables, the fountain, planters, bike racks, reading tables, the book cart,
 * the bird feeder). Card-kit drawings in three dressings; no lettering, no prices anywhere.
 */
import type { RGB, V3 } from '../../../art/cardScene.ts';
import { L, beam, box, cone, disc, dome, drum, glowOrb, line, lineOf, mix, post, quad, shade, shadow, stations, steel, tri, yawAlong, type Ctx } from './kit.ts';

const hash = (k: number, x: number) => { const v = Math.sin(k * 127.1 + x * 0.311) * 43758.5453; return v - Math.floor(v); };

/* -------------------------------------------------------------------------------------------- water and shore */

/** A hull along local z (bow +z): `transom` cuts the stern square; `stems` raises both ends (the gozzo's). */
function hull(c: Ctx, len: number, beamW: number, depth: number, col: RGB, band: RGB, inner: RGB, o: { transom?: boolean; stems?: number; deck?: boolean; y?: number } = {}) {
  const n = c.full ? 8 : 5, y0 = o.y ?? 0, prof = (t: number) => { const u = Math.abs(t * 2 - 1); return o.transom && t < 0.5 ? Math.max(0.62, Math.pow(1 - Math.pow(u, 2.2), 0.6)) : Math.pow(Math.max(0, 1 - Math.pow(u, 2)), 0.62); };
  const sheer = (t: number) => y0 + depth + (o.stems ?? 0.08) * Math.pow(Math.abs(t * 2 - 1), 2.2);
  // a little rocker: the keel rises toward both ends, so the hull's side reads curved
  const sec = (t: number) => { const w = beamW / 2 * prof(t), z = -len / 2 + len * t, top = sheer(t), k = y0 + depth * 0.35 * Math.pow(Math.abs(t * 2 - 1), 2.4); return { z, w, top, pts: [[-w, top], [-w * 0.86, k + (top - k) * 0.42], [0, k], [w * 0.86, k + (top - k) * 0.42], [w, top]] as [number, number][] }; };
  const S = Array.from({ length: n + 1 }, (_, i) => sec(i / n));
  for (let i = 1; i <= n; i++) {
    const A = S[i - 1]!, B = S[i]!;
    for (let k = 0; k < 4; k++) { const upper = k === 0 || k === 3, cc = upper ? col : shade(col, 0.82);
      quad(c, [A.pts[k]![0], A.pts[k]![1], A.z], [B.pts[k]![0], B.pts[k]![1], B.z], [B.pts[k + 1]![0], B.pts[k + 1]![1], B.z], [A.pts[k + 1]![0], A.pts[k + 1]![1], A.z], cc); }
    // the sheer band (a coloured strake under the gunwale) and the gunwale ink
    for (const s of [-1, 1]) { quad(c, [s * A.w * 1.004, A.top - 0.02, A.z], [s * B.w * 1.004, B.top - 0.02, B.z], [s * B.w * 0.99, B.top - 0.11, B.z], [s * A.w * 0.99, A.top - 0.11, A.z], band); if (c.full) line(c, [s * A.w, A.top, A.z], [s * B.w, B.top, B.z]); }
    if (o.deck) { tri(c, [-A.w, A.top, A.z], [A.w, A.top, A.z], [B.w, B.top, B.z], inner); tri(c, [-A.w, A.top, A.z], [B.w, B.top, B.z], [-B.w, B.top, B.z], inner); }
  }
  if (o.transom) { const A = S[0]!; for (let k = 1; k < 4; k++) tri(c, [A.pts[0]![0], A.pts[0]![1], A.z], [A.pts[k]![0], A.pts[k]![1], A.z], [A.pts[k + 1]![0], A.pts[k + 1]![1], A.z], shade(col, 0.9)); }
  if (!o.deck) { // floorboards and thwarts inside an open boat
    quad(c, [-beamW * 0.25, y0 + depth * 0.28, -len * 0.34], [beamW * 0.25, y0 + depth * 0.28, -len * 0.34], [beamW * 0.25, y0 + depth * 0.28, len * 0.3], [-beamW * 0.25, y0 + depth * 0.28, len * 0.3], inner);
    for (const t of [0.35, 0.62]) { const s = sec(t); box(c, 0, s.z, s.w * 0.95, 0.1, s.top - 0.16 - y0 + y0, s.top - 0.1, inner, shade(inner, 0.8), null); }
  }
  if (o.stems) for (const t of [0, 1]) { const s = sec(t); beam(c, [0, y0 + depth * 0.2, s.z], [0, s.top + 0.06, s.z + (t ? 0.06 : -0.06)], 0.07, 0.07, band, 'card', false); }
}
export function kayak(c: Ctx) {
  const col = c.P.hulls[(c.rec.variant ?? 0) % c.P.hulls.length]!; hull(c, 3.6, 0.62, 0.3, col, shade(col, 0.85), shade(col, 1.08), { deck: true, stems: 0.05 });
  disc(c, 0, 0.31, -0.1, 0.24, 8, [0.15, 0.13, 0.12], 'card', 0.4);
  if (c.full) { const p = L(c, 0.4, 0.33, 0.2); c.b.beam(p, L(c, -0.5, 0.36, -0.8), 0.04 * c.s, 0.03 * c.s, c.P.iron, null, 'steel'); }
  shadow(c, 0.5, 1.9, 0.24);
}
export function rowboat(c: Ctx) {
  const P = c.P, col = c.theme === 'classic' ? P.plank : P.hulls[(c.rec.variant ?? 0) % P.hulls.length]!, band = c.theme === 'newfoundland' ? P.trim : c.theme === 'taylor' ? P.paperEdge : P.timber;
  hull(c, 3.8, 1.35, 0.55, col, band, shade(P.plank, 1.1), { transom: true, stems: 0.1 });
  if (c.full) for (const s of [-1, 1]) beam(c, [s * 0.5, 0.6, -0.5], [s * 0.2, 0.32, 1.2], 0.05, 0.04, P.timberLight, 'card', false);
  shadow(c, 0.9, 2.0, 0.24);
}
/** The Ligurian gozzo: white hull, a coloured sheer band, pointed both ends with raised stems. */
export function gozzo(c: Ctx) {
  const P = c.P, band = P.hulls[(c.rec.variant ?? 0) % P.hulls.length]!, white = c.theme === 'taylor' ? P.paperEdge : C_WHITE;
  hull(c, 5.6, 1.9, 0.75, white, band, shade(P.plank, 1.05), { stems: 0.45 });
  shadow(c, 1.0, 2.8, 0.24);
}
const C_WHITE: RGB = [0.95, 0.94, 0.9];
/** A buoy floating at `at` (its water): variant 0 white with a red flag (the Giro's start), else red / the dressing's. */
export function buoy(c: Ctx) {
  const v = c.rec.variant ?? 1, col = v === 0 ? C_WHITE : v % 2 ? c.P.buoyRed : c.P.hulls[v % c.P.hulls.length]!;
  drum(c, [0, -0.35, 0], [0, 0.45, 0], 0.38, c.full ? 10 : 7, col, shade(col, 1.05));
  cone(c, 0, 0, 0.45, 0.9, 0.36, 0.06, col, c.full ? 10 : 7);
  if (c.full) for (const y of [0.05, 0.3]) cone(c, 0, 0, y, y + 0.06, 0.39, 0.39, shade(col, 0.7), 10);
  post(c, 0, 0, 0.88, 1.6, 0.025, c.P.iron, 4, 'steel');
  if (v === 0) quad(c, [0, 1.58, 0.02], [0, 1.58, 0.5], [0, 1.3, 0.5], [0, 1.3, 0.02], c.P.signalRed);
  else dome(c, 0, 1.55, 0, 0.1, col, 6, 2);
}
/** A quay mooring bollard: an iron mushroom (painted in Newfoundland). */
export function bollardQuay(c: Ctx) {
  const col = c.theme === 'newfoundland' ? c.P.walls[0]! : c.theme === 'taylor' ? c.P.walls[1]! : c.P.iron;
  cone(c, 0, 0, 0, 0.12, 0.3, 0.26, shade(col, 0.9), 8, 'steel'); post(c, 0, 0, 0.12, 0.48, 0.18, col, 8, 'steel');
  cone(c, 0, 0, 0.48, 0.56, 0.18, 0.27, col, 8, 'steel'); dome(c, 0, 0.56, 0, 0.27, col, 8, 2, 'steel');
  shadow(c, 0.35, 0.35, 0.26);
}
/** A fishing net heaped on the quay, its float line round it. */
export function net(c: Ctx) {
  const P = c.P, netC = c.theme === 'newfoundland' ? [0.35, 0.48, 0.42] as RGB : c.theme === 'taylor' ? P.tape[1]! : [0.62, 0.55, 0.4] as RGB;
  cone(c, 0, 0, 0, 0.22, 0.95, 0.7, netC, 9); cone(c, 0.1, 0.05, 0.22, 0.42, 0.7, 0.2, shade(netC, 1.08), 9);
  if (c.full) for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; line(c, [Math.cos(a) * 0.95, 0.01, Math.sin(a) * 0.95], [0.1 + Math.cos(a + 0.4) * 0.2, 0.42, 0.05 + Math.sin(a + 0.4) * 0.2], shade(netC, 0.6)); }
  for (let k = 0; k < (c.full ? 7 : 3); k++) { const a = (k / 7) * Math.PI * 2 + 0.3; dome(c, Math.cos(a) * 0.9, 0.05, Math.sin(a) * 0.9, 0.09, c.theme === 'taylor' ? P.tape[0]! : [0.9, 0.5, 0.2], 6, 2); }
  shadow(c, 1.0, 1.0, 0.22);
}
/** A slatted crate (variant 1: two stacked). */
export function crate(c: Ctx) {
  const wood = c.theme === 'taylor' ? c.P.timberLight : c.P.plank, n = (c.rec.variant ?? 0) === 1 ? 2 : 1;
  for (let k = 0; k < n; k++) { const y = k * 0.6, t = k * 0.35;
    box(c, 0, 0, 0.3, 0.3, y, y + 0.58, shade(wood, 1.04), wood, undefined, t);
    if (c.full) for (const h of [0.2, 0.4]) { for (const s of [-1, 1]) { line(c, [-0.3, y + h, s * 0.301], [0.3, y + h, s * 0.301], shade(wood, 0.6)); } } }
  shadow(c, 0.45, 0.45, 0.24);
}
/** A life ring on a post under a little board roof (orange and white quarters). */
export function lifeRing(c: Ctx) {
  const P = c.P, wood = P.woodDark, orange: RGB = c.theme === 'taylor' ? P.tape[0]! : [0.9, 0.42, 0.18];
  box(c, 0, 0, 0.06, 0.06, 0, 1.55, shade(wood, 1.05), wood); box(c, 0, 0.07, 0.36, 0.02, 0.6, 1.5, P.panelFace, shade(P.panelFace, 0.85));
  box(c, 0, 0.02, 0.42, 0.14, 1.5, 1.56, P.hideRoof, shade(P.hideRoof, 0.85));
  const R = 0.3, n = c.full ? 16 : 8, cy = 1.05;
  for (let q = 0; q < 4; q++) { const pts: V3[] = []; for (let k = 0; k <= n / 4; k++) { const a = (q / 4 + k / n) * Math.PI * 2; pts.push(L(c, Math.cos(a) * R, cy + Math.sin(a) * R, 0.15)); } c.b.tube(pts, 0.07 * c.s, q % 2 ? C_WHITE : orange, c.full ? 6 : 4); }
  shadow(c, 0.3, 0.25, 0.2);
}
/** A rod holder in the rail or bank with a rod bending out over the water (+z) and its line. */
export function rodHolder(c: Ctx) {
  const P = c.P; post(c, 0, 0, 0, 0.55, 0.04, P.iron, 5, 'steel');
  const rod: V3[] = [[0, 0.4, -0.15], [0, 1.4, 0.35], [0, 2.2, 1.1], [0, 2.55, 1.9]]; for (let k = 1; k < rod.length; k++) beam(c, rod[k - 1]!, rod[k]!, 0.025 - k * 0.005, 0.025 - k * 0.005, k === 1 ? P.timber : P.iron, 'steel', false);
  line(c, rod[3]!, [0, 0, 3.4], [0.9, 0.9, 0.85]);
}
/** A nest box on a post (wood duck 1.9 eu post; scale 0.8 for a swallow box). */
export function duckBox(c: Ctx) {
  const P = c.P, wood = c.theme === 'taylor' ? P.walls[2]! : P.timberLight;
  box(c, 0, 0, 0.05, 0.05, 0, 1.9, shade(P.timber, 1.05), P.timber);
  box(c, 0, 0, 0.17, 0.17, 1.9, 2.35, wood, shade(wood, 0.82));
  quad(c, [-0.24, 2.33, -0.24], [0.24, 2.33, -0.24], [0.24, 2.45, 0.26], [-0.24, 2.45, 0.26], P.hideRoof);
  const h = L(c, 0, 2.18, 0.172); for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, r = 0.06 * c.s, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    c.b.tri(h, [h[0] + Math.cos(a0) * r * cy, h[1] + Math.sin(a0) * r, h[2] - Math.cos(a0) * r * sy], [h[0] + Math.cos(a1) * r * cy, h[1] + Math.sin(a1) * r, h[2] - Math.cos(a1) * r * sy], [0.12, 0.1, 0.09]); }
}
/** The osprey pole (the Reach's shared binocular target): an 11.8 eu pole from 0.3 below the floor, cross-arms, a nest
 * platform with its drum of sticks (top ≈ 11.5 + 0.55 above the floor). */
export function ospreyPole(c: Ctx) {
  const pole: RGB = [0.435, 0.384, 0.322], arm: RGB = [0.365, 0.29, 0.22], nest: RGB = [0.54, 0.435, 0.31], top = 11.5;
  cone(c, 0, 0, -0.3, top, 0.18, 0.13, pole, 7);
  beam(c, [-1.1, top - 0.12, 0], [1.1, top - 0.12, 0], 0.12, 0.12, arm); beam(c, [0, top - 0.12, -1.1], [0, top - 0.12, 1.1], 0.12, 0.12, arm);
  cone(c, 0, 0, top, top + 0.55, 1.0, 1.25, nest, c.full ? 10 : 7);
  cone(c, 0, 0, top + 0.55, top + 0.62, 1.25, 0.9, shade(nest, 0.8), c.full ? 10 : 7);
  if (c.full) for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2 + hash(k, 3) * 0.3, r0 = 0.9, r1 = 1.45 + hash(k, 5) * 0.25, y = top + 0.15 + hash(k, 7) * 0.4;
    beam(c, [Math.cos(a) * r0, y, Math.sin(a) * r0], [Math.cos(a + 0.35) * r1, y + (hash(k, 9) - 0.5) * 0.3, Math.sin(a + 0.35) * r1], 0.06, 0.06, shade(nest, 0.85 + hash(k, 11) * 0.3), 'card', false); }
  shadow(c, 0.5, 0.5, 0.22);
}
/** A snag: a dead standing trunk 7.5 tall, three bare branches, a broken top. */
export function snag(c: Ctx) {
  const col: RGB = [0.557, 0.53, 0.482];
  cone(c, 0, 0, -0.2, 7.5, 0.36, 0.12, col, c.full ? 7 : 5);
  for (const [y, a, l] of [[3.2, 0.4, 2.2], [4.6, 2.6, 1.8], [5.8, 4.4, 1.4]] as const) beam(c, [Math.cos(a) * 0.2, y, Math.sin(a) * 0.2], [Math.cos(a) * l, y + l * 0.6, Math.sin(a) * l], 0.12, 0.12, shade(col, 1.06), 'card', false);
  shadow(c, 0.6, 0.6, 0.22);
}

/* -------------------------------------------------------------------------------------------- meadow and beach */

export function umbrella(c: Ctx) {
  const P = c.P, cols = P.parasol, k0 = (c.rec.variant ?? 0) % cols.length, H = 2.3, R = 1.35, n = c.full ? 8 : 6;
  post(c, 0, 0, -0.2, H + 0.2, 0.025, C_WHITE, 4, 'steel');
  for (let k = 0; k < n; k++) { const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, col = k % 2 ? cols[k0]! : cols[(k0 + 1) % cols.length]!;
    tri(c, [Math.cos(a0) * R, H - 0.25, Math.sin(a0) * R], [Math.cos(a1) * R, H - 0.25, Math.sin(a1) * R], [0, H + 0.2, 0], shade(col, 0.92 + 0.1 * Math.cos((a0 + a1) / 2 - 2.6))); }
  if (c.full) dome(c, 0, H + 0.2, 0, 0.05, C_WHITE, 6, 2);
  shadow(c, 1.3, 1.3, 0.24, 0.3, -0.3);
}
export function towel(c: Ctx) {
  const P = c.P, cols = P.parasol, k0 = (c.rec.variant ?? 0) % cols.length;
  for (let j = 0; j < 3; j++) { const z0 = -0.9 + j * 0.6, z1 = z0 + 0.6; quad(c, [-0.45, 0.025, z0], [0.45, 0.025, z0], [0.45, 0.025, z1], [-0.45, 0.025, z1], j === 1 ? C_WHITE : cols[k0]!, 'flat'); }
}
/** A fire ring: a concrete ring (r 1.3) with a few logs inside (the fire and its light are the night track's). */
export function fireRing(c: Ctx) {
  const P = c.P, n = c.full ? 12 : 8, R = 1.3;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, seg: Ctx = { ...c, x: c.x + Math.sin(a) * R * c.s, z: c.z + Math.cos(a) * R * c.s, yaw: a, cy: Math.cos(a), sy: Math.sin(a) };
    box(seg, 0, 0, Math.PI * R / n * 1.02, 0.1, 0, 0.3, shade(P.concrete, 1.04 - (k % 2) * 0.05), P.concrete, null); }
  disc(c, 0, 0.02, 0, 1.15, 8, [0.3, 0.27, 0.24], 'flat');
  for (const [a, l] of [[0.3, 0.9], [2.2, 0.8], [4.1, 0.85]] as const) beam(c, [Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55], [Math.cos(a + 2.7) * l * 0.2, 0.32, Math.sin(a + 2.7) * l * 0.2], 0.14, 0.14, P.timber, 'card', false);
}
/** The volleyball net (local x across the court): posts at ±5 (2.6), net 10 × 0.9 (top 2.45), the 9 × 16 court lines. */
export function volleyNet(c: Ctx) {
  const P = c.P, postC = P.iron, lineC = c.theme === 'taylor' ? P.tape[1]! : [0.18, 0.44, 0.6] as RGB;
  for (const x of [-5, 5]) post(c, x, 0, 0, 2.6, 0.05, postC, 6, 'steel');
  quad(c, [-5, 2.37, 0], [5, 2.37, 0], [5, 2.45, 0], [-5, 2.45, 0], C_WHITE);
  if (c.full) { for (let k = 0; k <= 20; k++) line(c, [-5 + k * 0.5, 1.55, 0], [-5 + k * 0.5, 2.37, 0], [0.25, 0.25, 0.25]); for (const y of [1.55, 1.82, 2.1]) line(c, [-5, y, 0], [5, y, 0], [0.25, 0.25, 0.25]);
    const strip = (a: [number, number], d: [number, number]) => { const dx = d[0] - a[0], dz = d[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l * 0.03, nz = dx / l * 0.03; quad(c, [a[0] + nx, 0.02, a[1] + nz], [d[0] + nx, 0.02, d[1] + nz], [d[0] - nx, 0.02, d[1] - nz], [a[0] - nx, 0.02, a[1] - nz], lineC, 'flat'); };
    strip([-4.5, -8], [4.5, -8]); strip([4.5, -8], [4.5, 8]); strip([4.5, 8], [-4.5, 8]); strip([-4.5, 8], [-4.5, -8]); strip([-4.5, 0], [4.5, 0]); }
}
/** The skate bowl's visible rim (the bowl itself is the land pass's): a concrete deck ring and a steel coping pipe; radius 6.5 × scale. */
export function skateBowl(c: Ctx) {
  const P = c.P, n = c.full ? 24 : 14, r0 = 5.6, r1 = 6.5;
  for (let k = 0; k < n; k++) { const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    quad(c, [Math.cos(a0) * r0, 0.03, Math.sin(a0) * r0], [Math.cos(a1) * r0, 0.03, Math.sin(a1) * r0], [Math.cos(a1) * r1, 0.03, Math.sin(a1) * r1], [Math.cos(a0) * r1, 0.03, Math.sin(a0) * r1], shade(P.concrete, 1 + (k % 2) * 0.03), 'flat'); }
  if (c.full) { const ring: V3[] = []; for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; ring.push(L(c, Math.cos(a) * r0, 0.06, Math.sin(a) * r0)); } c.b.tube(ring, 0.05 * c.s, c.theme === 'taylor' ? P.tape[1]! : [0.7, 0.72, 0.74], 5); }
}
/** A kite on a 0.5 stake: `line[1]` (if given) is where it flies, else 19 up and 18 downwind (+z); a diamond, its spars and a bowed tail. */
export function kite(c: Ctx) {
  const P = c.P, colour = c.theme === 'taylor' ? P.tape[(c.rec.variant ?? 0) % P.tape.length]! : (c.rec.variant ?? 0) % 2 ? P.chalkLine : P.terracottaP;
  post(c, 0, 0, 0, 0.5, 0.025, P.timber, 4);
  const stake = L(c, 0, 0.5, 0), K = c.rec.line && c.rec.line.length >= 2 ? c.rec.line[1]! as V3 : L(c, 0, 19, 18), b = c.b;
  const seg = 6; for (let k = 0; k < seg; k++) { const t0 = k / seg, t1 = (k + 1) / seg, sag = (t: number) => -Math.sin(Math.PI * t) * 1.2; b.line([stake[0] + (K[0] - stake[0]) * t0, stake[1] + (K[1] - stake[1]) * t0 + sag(t0), stake[2] + (K[2] - stake[2]) * t0], [stake[0] + (K[0] - stake[0]) * t1, stake[1] + (K[1] - stake[1]) * t1 + sag(t1), stake[2] + (K[2] - stake[2]) * t1], P.iron); }
  // the diamond, pitched back 0.7 rad, facing the flier
  const d = [K[0] - stake[0], K[2] - stake[2]], dl = Math.hypot(d[0]!, d[1]!) || 1, f: V3 = [d[0]! / dl, 0, d[1]! / dl], side: V3 = [-f[2], 0, f[0]], up: V3 = [f[0] * Math.sin(0.7), Math.cos(0.7), f[2] * Math.sin(0.7)];
  const P0 = (u: number, v: number): V3 => [K[0] + side[0] * u + up[0] * v, K[1] + up[1] * v, K[2] + side[2] * u + up[2] * v];
  b.tri(P0(0, 0.6), P0(-0.5, 0.1), P0(0, -0.4), colour); b.tri(P0(0, 0.6), P0(0, -0.4), P0(0.5, 0.1), shade(colour, 0.9));
  if (c.full) { b.line(P0(0, 0.6), P0(0, -0.4), P.iron); b.line(P0(-0.5, 0.1), P0(0.5, 0.1), P.iron); }
  for (let k = 0; k < 4; k++) { const v = -0.6 - k * 0.45, p = P0(Math.sin(k * 1.4) * 0.15, v), col = k % 2 ? P.chalkLine : P.accent; b.line(P0(Math.sin((k - 1) * 1.4) * 0.15, v + 0.45), p, P.iron); b.tri([p[0] - side[0] * 0.12, p[1] + 0.05, p[2] - side[2] * 0.12], [p[0] + side[0] * 0.12, p[1] + 0.05, p[2] + side[2] * 0.12], [p[0], p[1] - 0.07, p[2]], col); }
}
/** The rope swing: ropes from `scale` eu above `at` (the limb) to a seat board 0.5 above the floor (scale = rope top height; default 2.6). */
export function swing(c0: Ctx) {
  const c: Ctx = { ...c0, s: 1 }, H = c0.rec.scale ?? 2.6, rope: RGB = [0.8, 0.73, 0.6], wood = c.theme === 'taylor' ? c.P.walls[0]! : c.P.timberLight;
  for (const x of [-0.4, 0.4]) beam(c, [x, H, 0], [x, 0.53, 0], 0.035, 0.035, rope, 'card', false);
  box(c, 0, 0, 0.475, 0.15, 0.47, 0.53, wood, shade(wood, 0.82));
  shadow(c, 0.5, 0.25, 0.2);
}
/** A bocce court (local x along its 15): packed gravel 15 × 3.6 inside 0.22 × 0.3 timber kerbs, balls and the jack. */
export function bocceCourt(c: Ctx) {
  const P = c.P, gravel: RGB = c.theme === 'taylor' ? P.gravelP : [0.85, 0.79, 0.65], kerb: RGB = c.theme === 'classic' ? [0.48, 0.35, 0.24] : P.woodDark;
  for (let k = 0; k < 5; k++) quad(c, [-7.5 + k * 3, 0.03, -1.8], [-4.5 + k * 3, 0.03, -1.8], [-4.5 + k * 3, 0.03, 1.8], [-7.5 + k * 3, 0.03, 1.8], shade(gravel, 1 - (k % 2) * 0.025), 'flat');
  box(c, 0, -1.91, 7.72, 0.11, -0.05, 0.3, kerb); box(c, 0, 1.91, 7.72, 0.11, -0.05, 0.3, kerb);
  box(c, -7.61, 0, 0.11, 1.8, -0.05, 0.3, kerb); box(c, 7.61, 0, 0.11, 1.8, -0.05, 0.3, kerb);
  if (c.full) { const balls: [number, number, RGB][] = [[3.2, 0.3, P.accent], [3.6, -0.4, P.accent], [2.8, -0.1, P.second], [4.1, 0.6, P.second]]; for (const [x, z, col] of balls) dome(c, x, 0.03, z, 0.055, col, 6, 2, 'steel'); dome(c, 3.5, 0.03, 0.1, 0.025, C_WHITE, 5, 1); }
}
/** The chalk bush-plane geoglyph (the Flats' north approach): white chalk outline and ochre fill flat on the turf (≤ 0.2
 * above the ground everywhere), wingspan 63 × scale, nose toward local +z. Shape only — no letters. */
export function geoglyph(c: Ctx) {
  const P = c.P, S = c.s * 63 / 63;
  // the plane in metres (span 63): fuselage, high wing, tailplane, fin line, two floats
  const shapes: [number, number][][] = [
    [[-3, 20], [3, 20], [3.4, 8], [2.4, -6], [1.2, -18], [-1.2, -18], [-2.4, -6], [-3.4, 8]],
    [[-31.5, 8], [31.5, 8], [31.5, 1.5], [30, -1], [-30, -1], [-31.5, 1.5]],
    [[-10, -12.5], [10, -12.5], [10, -16.5], [-10, -16.5]],
    [[-7.2, 18], [-4.8, 18], [-4.8, -5], [-6, -7], [-7.2, -5]], [[4.8, 18], [7.2, 18], [7.2, -5], [6, -7], [4.8, -5]],
  ];
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), W = (u: number, v: number, lift: number): V3 => { const x = c.x + (u * cy + v * sy) * S, z = c.z + (v * cy - u * sy) * S; return [x, Math.min(c.ground(x, z) + lift, c.ground(x, z) + 0.2), z]; };
  const inside = (u: number, v: number) => shapes.some(poly => { let k = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, d = poly[j]!; if ((a[1] > v) !== (d[1] > v) && u < ((d[0] - a[0]) * (v - a[1])) / (d[1] - a[1]) + a[0]) k = !k; } return k; });
  // ochre fill on a 3 eu grid (cells inside the plane), draped on the turf
  const cell = c.full ? 2.5 : 4.5;
  for (let u = -32; u < 32; u += cell) for (let v = -19; v < 21; v += cell) { if (!inside(u + cell / 2, v + cell / 2)) continue;
    c.b.quad(W(u, v, 0.05), W(u + cell, v, 0.05), W(u + cell, v + cell, 0.05), W(u, v + cell, 0.05), shade(P.ochre, 0.96 + hash(Math.round(u * 7 + v), 2) * 0.08), 'flat'); }
  // chalk outlines, 1.2 wide, in 3 eu pieces
  for (const poly of shapes) for (let i = 0; i < poly.length; i++) { const a = poly[i]!, d = poly[(i + 1) % poly.length]!, len = Math.hypot(d[0] - a[0], d[1] - a[1]), n = Math.max(1, Math.ceil(len / 3)), nx = -(d[1] - a[1]) / len * 0.6, nz = (d[0] - a[0]) / len * 0.6;
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, p0 = [a[0] + (d[0] - a[0]) * t0, a[1] + (d[1] - a[1]) * t0], p1 = [a[0] + (d[0] - a[0]) * t1, a[1] + (d[1] - a[1]) * t1];
      c.b.quad(W(p0[0]! + nx, p0[1]! + nz, 0.1), W(p1[0]! + nx, p1[1]! + nz, 0.1), W(p1[0]! - nx, p1[1]! - nz, 0.1), W(p0[0]! - nx, p0[1]! - nz, 0.1), P.chalkLine, 'flat'); } }
}
/** A beehive (the Green's apiary): body, super and slate lid; lid top 0.83. */
export function hive(c: Ctx) {
  const P = c.P, v = c.rec.variant ?? 0, body: RGB = c.theme === 'taylor' ? P.walls[v % P.walls.length]! : c.theme === 'newfoundland' ? P.walls[v % P.walls.length]! : v % 2 ? [0.91, 0.83, 0.64] : [0.94, 0.89, 0.78];
  const sup: RGB = c.theme === 'classic' ? (v % 3 === 2 ? [0.85, 0.54, 0.37] : [0.96, 0.94, 0.9]) : P.trim, lid: RGB = c.theme === 'classic' ? [0.37, 0.44, 0.47] : P.roofTile;
  box(c, 0, 0, 0.27, 0.27, 0, 0.08, P.timber, shade(P.timber, 0.8), null);
  box(c, 0, 0, 0.25, 0.22, 0.08, 0.52, body, shade(body, 0.86)); box(c, 0, 0, 0.25, 0.22, 0.52, 0.74, sup, shade(sup, 0.86));
  box(c, 0, 0, 0.29, 0.26, 0.76, 0.83, lid, shade(lid, 0.8));
  if (c.full) box(c, 0, 0.225, 0.12, 0.01, 0.1, 0.13, [0.15, 0.12, 0.1], [0.15, 0.12, 0.1], null);
  shadow(c, 0.35, 0.32, 0.24);
}
/** A round hay bale lying on its side (local x its axis), wrap lines on full. */
export function hayBale(c: Ctx) {
  const straw: RGB = c.theme === 'taylor' ? [0.96, 0.88, 0.7] : [0.84, 0.72, 0.42];
  drum(c, [-0.6, 0.75, 0], [0.6, 0.75, 0], 0.75, c.full ? 10 : 7, straw, shade(straw, 1.08));
  if (c.full) for (const x of [-0.3, 0.3]) { const ring: V3[] = []; for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI * 2; ring.push(L(c, x, 0.75 + Math.sin(a) * 0.76, Math.cos(a) * 0.76)); } c.b.tube(ring, 0.012 * c.s, shade(straw, 0.6), 3); }
  shadow(c, 0.8, 0.75, 0.26);
}
/** A cairn: flat stones stacked to ~1.8 (× scale), each turned and offset a little, a pointed stone on top. */
export function cairn(c: Ctx) {
  let y = 0; const stone = c.P.stoneMid, n = c.full ? 7 : 4;
  for (let k = 0; k < n; k++) {
    const t = k / n, w = 0.75 - t * 0.5, h = (c.full ? 0.24 : 0.4) - t * 0.06, off = (hash(k, c.x) - 0.5) * 0.18, off2 = (hash(k, c.z) - 0.5) * 0.18, tone = shade(mix(stone, c.P.stoneLow, hash(k, 5)), 0.85 + hash(k, 3) * 0.25);
    box(c, off, off2, w * (0.9 + hash(k, 7) * 0.25), w * (0.75 + hash(k, 9) * 0.25), y, y + h, shade(tone, 1.05), tone, undefined, hash(k, 11) * 3);
    y += h * 0.96;
  }
  cone(c, 0.02, -0.02, y, y + 0.3, 0.2, 0.04, shade(stone, 0.95), 5);
  shadow(c, 0.9, 0.8, 0.26);
}
/** A month stone (the Oak Clock): a block 0.6 wide, 0.38 deep, a cap to 0.65; every third (variant % 3 == 0) the paler face. */
export function monthStone(c: Ctx) {
  const P = c.P, v = c.rec.variant ?? 0, face = v % 3 === 0 ? P.stoneCope : P.stoneMid, cap = P.stoneLow;
  box(c, 0, 0, 0.3, 0.19, -0.05, 0.6, face, shade(face, 0.86));
  box(c, 0, 0, 0.33, 0.22, 0.6, 0.65, cap, shade(cap, 0.85));
  // the month as a pictogram of notches on the face toward the trunk (local +z): 1–12 short marks, no numerals
  if (c.full) { const n = (((v % 12) + 12) % 12) + 1; for (let k = 0; k < n; k++) { const x = -0.22 + (k % 6) * 0.088, y = 0.42 - Math.floor(k / 6) * 0.14; quad(c, [x, y, 0.192], [x + 0.03, y, 0.192], [x + 0.03, y + 0.1, 0.192], [x, y + 0.1, 0.192], shade(face, 0.62), 'paint'); } }
  shadow(c, 0.38, 0.3, 0.24);
}
/** The sundial: a stone pedestal, a dial plate with hour ticks (no numerals), a brass gnomon. */
export function sundial(c: Ctx) {
  const P = c.P, stone = c.theme === 'taylor' ? P.stoneCope : c.theme === 'newfoundland' ? P.stoneMid : P.travertine, gnomon = c.theme === 'taylor' ? P.tape[2]! : P.brass;
  box(c, 0, 0, 0.32, 0.32, 0, 0.12, P.stoneLow, shade(P.stoneLow, 0.85)); box(c, 0, 0, 0.18, 0.18, 0.12, 0.92, stone, shade(stone, 0.86));
  cone(c, 0, 0, 0.92, 1.0, 0.36, 0.36, shade(stone, 1.05), 12);
  if (c.full) for (let k = 0; k < 12; k++) { const a = -Math.PI / 2 + ((k - 5.5) / 11) * Math.PI * 1.2; line(c, [Math.cos(a) * 0.24, 1.004, Math.sin(a) * 0.24], [Math.cos(a) * 0.32, 1.004, Math.sin(a) * 0.32], shade(stone, 0.5)); }
  tri(c, [0, 1.0, 0.18], [0, 1.0, -0.2], [0, 1.22, 0.18], gnomon, 'steel');
  shadow(c, 0.4, 0.4, 0.24);
}

/* -------------------------------------------------------------------------------------------- town and library */

/** A laundry line along `line`: on posts in a garden (the line at ground level) or strung between two walls (the line's
 * points above the ground are the fixings), garments hanging from it. */
export function laundryLine(c: Ctx) {
  const P = c.P, pts = lineOf(c), a0 = pts[0]!, d0 = pts[pts.length - 1]!, walls = a0[1] > c.ground(a0[0], a0[2]) + 1.5, b = c.b;
  const lift = walls ? 0 : 2.2, a: V3 = [a0[0], a0[1] + lift, a0[2]], d: V3 = [d0[0], d0[1] + lift, d0[2]];
  if (!walls) for (const q of [a0, d0]) { b.box(q[0], q[2], c.yaw, 0.06, 0.06, q[1] - 0.05, q[1] + lift + 0.1, shade(P.timber, 1.05), P.timber, null); }
  const len = Math.hypot(d[0] - a[0], d[2] - a[2]), sag = Math.min(0.5, len * 0.06), at = (t: number): V3 => [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (d[2] - a[2]) * t];
  for (let k = 0; k < 10; k++) b.line(at(k / 10), at((k + 1) / 10), P.iron);
  const cloth: RGB[] = c.theme === 'classic' ? [[1, 1, 1], [0.91, 0.76, 0.49], [0.62, 0.76, 0.85], [0.85, 0.46, 0.37], [0.73, 0.83, 0.64]] : [...P.cloth];
  const n = Math.max(2, Math.floor(len / (c.full ? 0.75 : 1.5))), dir = [(d[0] - a[0]) / (len || 1), (d[2] - a[2]) / (len || 1)];
  for (let k = 1; k < n; k++) { const p = at(k / n), w = 0.28 + hash(k, c.x) * 0.12, h = 0.5 + hash(k, c.z) * 0.25, col = cloth[k % cloth.length]!;
    b.quad([p[0] - dir[0]! * w, p[1], p[2] - dir[1]! * w], [p[0] + dir[0]! * w, p[1], p[2] + dir[1]! * w], [p[0] + dir[0]! * w, p[1] - h, p[2] + dir[1]! * w], [p[0] - dir[0]! * w, p[1] - h * 0.92, p[2] - dir[1]! * w], col); }
}
/** A market stall: four posts, a striped canopy tilted toward the front, a counter of produce (no prices). */
export function stall(c: Ctx) {
  const P = c.P, cols: RGB[] = c.theme === 'classic' ? [[0.94, 0.9, 0.82], [0.49, 0.23, 0.18]] : [P.bands[0]!, P.paperEdge], wood = P.woodDark;
  for (const [x, z] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]] as const) box(c, x, z, 0.05, 0.05, 0, z > 0 ? 2.15 : 2.45, shade(wood, 1.05), wood, null);
  for (let k = 0; k < 6; k++) { const x0 = -1.7 + k * (3.4 / 6), x1 = x0 + 3.4 / 6; quad(c, [x0, 2.47, -1.3], [x1, 2.47, -1.3], [x1, 2.12, 1.3], [x0, 2.12, 1.3], cols[k % 2]!); }
  if (c.full) for (let k = 0; k < 6; k++) { const x0 = -1.7 + k * (3.4 / 6), x1 = x0 + 3.4 / 6; tri(c, [x0, 2.12, 1.3], [x1, 2.12, 1.3], [(x0 + x1) / 2, 1.95, 1.32], cols[k % 2]!); }
  box(c, 0, 0.6, 1.45, 0.4, 0, 0.88, P.plank, shade(P.plank, 0.82));
  const produce: RGB[] = [[0.79, 0.34, 0.24], [0.9, 0.75, 0.3], [0.45, 0.6, 0.3], [0.6, 0.35, 0.5]];
  for (let k = 0; k < (c.full ? 4 : 2); k++) { box(c, -1.05 + k * 0.7, 0.6, 0.28, 0.3, 0.88, 0.98, P.timberLight, shade(P.timberLight, 0.8), null); for (let q = 0; q < (c.full ? 5 : 2); q++) dome(c, -1.2 + k * 0.7 + (q % 3) * 0.13, 0.98, 0.5 + Math.floor(q / 3) * 0.16, 0.07, produce[k]!, 5, 1); }
  shadow(c, 1.8, 1.4, 0.24);
}
/** A café table and two chairs (variant 1: under a parasol r 1.4). */
export function cafeTable(c: Ctx) {
  const P = c.P, metal = c.theme === 'taylor' ? P.paperEdge : P.iron, top: RGB = c.theme === 'classic' ? [0.95, 0.92, 0.85] : P.trim;
  post(c, 0, 0, 0, 0.72, 0.03, metal, 5, 'steel'); cone(c, 0, 0, 0, 0.04, 0.24, 0.24, metal, 6, 'steel'); cone(c, 0, 0, 0.72, 0.75, 0.4, 0.4, top, 10);
  for (const s of [-1, 1]) { const z = s * 0.62; box(c, 0, z, 0.2, 0.2, 0.42, 0.46, metal, shade(metal, 0.8), null); for (const [x, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]] as const) post(c, x, z + dz, 0, 0.42, 0.015, metal, 3, 'steel');
    beam(c, [-0.18, 0.46, z + s * 0.2], [0.18, 0.86, z + s * 0.22], 0.36, 0.03, metal, 'steel', false); }
  if ((c.rec.variant ?? 0) === 1) { const R = 1.4, H = 2.4, cols = P.parasol; post(c, 0, 0, 0.75, H, 0.025, C_WHITE, 4, 'steel'); for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2; tri(c, [Math.cos(a0) * R, H - 0.3, Math.sin(a0) * R], [Math.cos(a1) * R, H - 0.3, Math.sin(a1) * R], [0, H + 0.1, 0], k % 2 ? cols[0]! : shade(cols[0]!, 0.94)); } }
  shadow(c, 0.7, 0.9, 0.22);
}
/** The square's fountain: a travertine basin (r 2.3, 0.7 high) with water, a column and a top bowl. */
export function fountain(c: Ctx) {
  const P = c.P, stone = P.travertine, n = 8, R = 2.3, water: RGB = c.theme === 'taylor' ? [0.66, 0.79, 0.87] : c.theme === 'newfoundland' ? [0.31, 0.6, 0.67] : [0.44, 0.6, 0.65];
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + Math.PI / n, seg: Ctx = { ...c, x: c.x + Math.sin(a) * R * Math.cos(Math.PI / n) * c.s, z: c.z + Math.cos(a) * R * Math.cos(Math.PI / n) * c.s, yaw: a, cy: Math.cos(a), sy: Math.sin(a) };
    box(seg, 0, 0, R * Math.sin(Math.PI / n) + 0.02, 0.17, 0, 0.7, shade(stone, 1.04), stone); }
  disc(c, 0, 0.55, 0, R * 0.95, n * 2, water, 'card');
  post(c, 0, 0, 0.55, 1.6, 0.3, stone, 8); cone(c, 0, 0, 1.6, 1.85, 0.3, 0.8, shade(stone, 1.06), 10); disc(c, 0, 1.82, 0, 0.7, 10, water);
  post(c, 0, 0, 1.82, 2.2, 0.08, stone, 6); dome(c, 0, 2.2, 0, 0.12, stone, 6, 2);
  shadow(c, 2.6, 2.6, 0.22);
}
/** A planter box with flowers (Scholars' with ferns and foxgloves; the mountain's with blooms). */
export function planter(c: Ctx) {
  const P = c.P, box0: RGB = c.theme === 'newfoundland' ? P.walls[1]! : c.theme === 'taylor' ? P.walls[3]! : [0.545, 0.506, 0.447];
  box(c, 0, 0, 0.7, 0.7, 0, 0.55, box0, shade(box0, 0.8)); quad(c, [-0.62, 0.53, -0.62], [0.62, 0.53, -0.62], [0.62, 0.53, 0.62], [-0.62, 0.53, 0.62], [0.33, 0.25, 0.18]);
  for (let k = 0; k < (c.full ? 9 : 4); k++) { const x = (hash(k, 1) - 0.5) * 1.0, z = (hash(k, 2) - 0.5) * 1.0, h = 0.3 + hash(k, 3) * 0.35; cone(c, x, z, 0.53, 0.53 + h, 0.16, 0, k % 3 === 0 ? P.flowers[k % P.flowers.length]! : P.leaf[k % P.leaf.length]!, 5); }
}
/** A bike rack: a base rail and four hoops. */
export function bikeRack(c: Ctx) {
  const P = c.P, metal = c.theme === 'taylor' ? P.tape[1]! : c.theme === 'newfoundland' ? P.walls[0]! : P.iron;
  beam(c, [-1.3, 0.04, 0], [1.3, 0.04, 0], 0.08, 0.06, metal, 'steel', false);
  for (let h = 0; h < 4; h++) { const x = -0.95 + h * 0.63, pts: V3[] = []; for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; pts.push(L(c, x, 0.02 + Math.sin(a) * 0.75, Math.cos(a) * 0.32)); } c.b.tube(pts, 0.025 * c.s, metal, c.full ? 5 : 3); }
  shadow(c, 1.3, 0.4, 0.2);
}
/** A library reading table: a round top (r 0.78) on a pedestal, the green banker's lamp lit (glow), books, three chairs. */
export function readingTable(c: Ctx) {
  const P = c.P, wood: RGB = c.theme === 'taylor' ? P.timberLight : [0.353, 0.251, 0.188], legs: RGB = [0.227, 0.165, 0.118], shadeC: RGB = c.theme === 'taylor' ? [0.6, 0.82, 0.72] : [0.184, 0.353, 0.267];
  box(c, 0, 0, 0.08, 0.08, 0, 0.72, wood, shade(wood, 0.8)); cone(c, 0, 0, 0, 0.05, 0.4, 0.4, wood, 8); cone(c, 0, 0, 0.72, 0.76, 0.78, 0.78, shade(wood, 1.06), 14);
  // the banker's lamp: a copper stem, a green shade, its warm light under the shade
  post(c, 0.3, -0.1, 0.76, 1.16, 0.02, P.copper, 4, 'steel'); cone(c, 0.3, -0.1, 0.76, 0.79, 0.09, 0.09, P.copper, 6, 'steel');
  cone(c, 0.3, -0.1, 1.08, 1.2, 0.2, 0.08, shadeC, 8); disc(c, 0.3, 1.075, -0.1, 0.17, 8, [1, 0.81, 0.48], 'glow'); glowOrb(c, [0.3, 1.11, -0.1], 0.035, [1, 0.9, 0.62]);
  for (let k = 0; k < (c.full ? 3 : 1); k++) box(c, -0.25 + k * 0.03, 0.15 - k * 0.05, 0.16, 0.11, 0.76 + k * 0.035, 0.79 + k * 0.035, k % 2 ? [0.91, 0.886, 0.816] : [0.659, 0.278, 0.227], undefined, null, k * 0.2);
  for (const [x, z, a] of [[1.1, 0, -Math.PI / 2], [-1.1, 0, Math.PI / 2], [0, 1.1, Math.PI]] as const) {
    const ch: Ctx = { ...c, x: L(c, x, 0, z)[0], z: L(c, x, 0, z)[2], yaw: c.yaw + a, cy: Math.cos(c.yaw + a), sy: Math.sin(c.yaw + a) };
    box(ch, 0, 0, 0.22, 0.22, 0.42, 0.47, wood, shade(wood, 0.8), null);
    for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]] as const) box(ch, lx, lz, 0.025, 0.025, 0, 0.42, legs, legs, null);
    box(ch, 0, 0.2, 0.22, 0.025, 0.47, 0.97, wood, shade(wood, 0.8), null);
  }
  shadow(c, 1.3, 1.3, 0.22);
}
/** A library book cart: a body 1.1 × 0.9 × 0.5, two shelves of spines, four wheels, a handle. */
export function bookCart(c: Ctx) {
  const P = c.P, wood: RGB = c.theme === 'taylor' ? P.timberLight : [0.353, 0.251, 0.188], spines: RGB[] = [[0.549, 0.231, 0.18], [0.208, 0.388, 0.498], [0.373, 0.498, 0.271], [0.788, 0.639, 0.353], [0.427, 0.31, 0.227]];
  for (const x of [-0.55, 0.55]) box(c, x, 0, 0.025, 0.25, 0.15, 1.05, wood, shade(wood, 0.82));
  for (const y of [0.15, 0.55, 0.95]) box(c, 0, 0, 0.55, 0.25, y - 0.03, y, wood, shade(wood, 0.82));
  for (const y of [0.15, 0.55]) for (let k = 0; k < (c.full ? 9 : 4); k++) { const w = 0.04 + hash(k, y * 10) * 0.03, x = -0.48 + k * (c.full ? 0.11 : 0.24); box(c, x, 0.02, w, 0.17, y, y + 0.26 + hash(k, 3) * 0.08, spines[k % spines.length]!, undefined, null); }
  for (const [x, z] of [[-0.45, -0.18], [0.45, -0.18], [-0.45, 0.18], [0.45, 0.18]] as const) drum(c, [x - 0.02, 0.12, z], [x + 0.02, 0.12, z], 0.12, 8, [0.18, 0.165, 0.15], [0.3, 0.28, 0.26]);
  beam(c, [-0.55, 1.05, -0.3], [0.55, 1.05, -0.3], 0.03, 0.03, P.iron, 'steel', false);
  shadow(c, 0.7, 0.4, 0.22);
}
/** A bird feeder: a post, a seed box under a copper roof, two chickadees on full. */
export function birdFeeder(c: Ctx) {
  const P = c.P, wood: RGB = [0.478, 0.353, 0.251];
  box(c, 0, 0, 0.05, 0.05, 0, 1.6, shade(wood, 1.05), wood); box(c, 0, 0, 0.2, 0.15, 1.6, 1.9, wood, shade(wood, 0.82));
  const r = P.copper; quad(c, [-0.3, 1.9, -0.25], [0.3, 1.9, -0.25], [0.3, 2.08, 0], [-0.3, 2.08, 0], r); quad(c, [-0.3, 2.08, 0], [0.3, 2.08, 0], [0.3, 1.9, 0.25], [-0.3, 1.9, 0.25], shade(r, 1.08));
  if (c.full) for (const [x, z] of [[0.22, 0.12], [-0.18, -0.13]] as const) { dome(c, x, 1.6, z, 0.06, [0.42, 0.4, 0.38], 6, 2); dome(c, x + 0.04, 1.66, z, 0.035, [0.15, 0.14, 0.13], 5, 1); }
}
export { mix, steel, stations, yawAlong, glowOrb };
