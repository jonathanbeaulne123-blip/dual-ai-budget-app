/**
 * The prop kit's shared frame, palette and card helpers (kit/props). Pure card-kit drawing into a `CardBuilder`
 * (art/cardScene.ts): the island's look — flat card with grain, cut sides dark at the foot, ink on cut edges, steel
 * with a little sheen, glow cards for night lights (the 'glow' bucket; never point lights: LIGHT §3 pool untouched).
 *
 * Frame (neighbourhoods/types.ts): a prop's `at` is its base (y = its floor: the deck, the quay, the turf), `yaw`
 * turns local +z (the prop's FRONT: where a viewer looks, where a bench's sitter faces) to (sin yaw, cos yaw) in
 * plan — the `house()` frame of mountain/art/buildingArt.ts. `scale` (default 1) scales the prop uniformly except where
 * a kind documents otherwise (ringBench radius, swing rope height, geoglyph span, festoon/rail lines).
 */
import type { CardBuilder, RGB, V3 } from '../../../art/cardScene.ts';
import { mix, rgb, shade } from '../../../art/cardKit.ts';
import { roadKitPalette, type RoadKitPalette } from '../road/palette.ts';
import type { DressingTheme, PropRecord } from '../../neighbourhoods/types.ts';
import type { CollisionPart, CollisionRole } from './collision.ts';

export type Ground = (x: number, z: number) => number;
/** The lookout kit and prop colours per dressing (Reach prototype `_kit.mjs`, Green, Harbour, Scholars, Flats tables). */
export type PropPalette = RoadKitPalette & {
  wood: RGB; woodDark: RGB; stoneMid: RGB; stoneLow: RGB; stoneCope: RGB; gravelP: RGB; panelFace: RGB;
  viewerBody: RGB; viewerTrim: RGB; viewerFoot: RGB; lens: RGB; visor: RGB; hideRoof: RGB;
  copper: RGB; verdigris: RGB; bronze: RGB; chalkLine: RGB; ochre: RGB; concrete: RGB; terracottaP: RGB; travertine: RGB;
  hulls: readonly RGB[]; bands: readonly RGB[]; parasol: readonly RGB[]; sock: readonly [RGB, RGB]; glowLamp: RGB; signalRed: RGB; signalGreen: RGB; signalWhite: RGB; buoyRed: RGB;
};
const C = rgb;
const cache = new Map<DressingTheme, PropPalette>();
export function propPalette(theme: DressingTheme): PropPalette {
  const hit = cache.get(theme); if (hit) return hit;
  const r = roadKitPalette(theme);
  const shared = { glowLamp: C('#ffd98e'), signalRed: C('#ff5a4a'), signalGreen: C('#7dff9a'), signalWhite: C('#fff6e0'), concrete: C('#c9c2b4') };
  const p: PropPalette = theme === 'taylor' ? { ...r, ...shared,
    wood: C('#d9b8be'), woodDark: C('#b08a92'), stoneMid: C('#dcc8c4'), stoneLow: C('#c9b4b0'), stoneCope: C('#ffffff'), gravelP: C('#e9d8d4'), panelFace: C('#fff8f4'),
    viewerBody: C('#c3899f'), viewerTrim: C('#fff8f4'), viewerFoot: C('#8c6f93'), lens: C('#523349'), visor: C('#e8a6bd'), hideRoof: C('#8c6f93'),
    copper: C('#e2a98f'), verdigris: C('#9fd1c3'), bronze: C('#d9b26a'), chalkLine: C('#fff8f4'), ochre: C('#efc9a0'), terracottaP: C('#f0b4a8'), travertine: C('#f3e6e3'),
    hulls: [C('#a9c9dd'), C('#f3c4d2'), C('#c9e2d6'), C('#f2d38a'), C('#dcd3ec')], bands: [C('#e8a6bd'), C('#a9c9dd'), C('#f2d38a')], parasol: [C('#f3c4d2'), C('#fff4d8'), C('#a9c9dd'), C('#dcd3ec')],
    sock: [C('#e8a6bd'), C('#fff8f4')], buoyRed: C('#e8a6bd') }
  : theme === 'newfoundland' ? { ...r, ...shared,
    wood: C('#8f7d68'), woodDark: C('#6d4b36'), stoneMid: C('#8e9a9c'), stoneLow: C('#59656b'), stoneCope: C('#a7b0b2'), gravelP: C('#a7adae'), panelFace: C('#f5f3ea'),
    viewerBody: C('#2f5b63'), viewerTrim: C('#f5f3ea'), viewerFoot: C('#3d4449'), lens: C('#17262b'), visor: C('#24474e'), hideRoof: C('#3b4a52'),
    copper: C('#b07a52'), verdigris: C('#5f9e8f'), bronze: C('#b8863c'), chalkLine: C('#f3f1ea'), ochre: C('#c9944f'), terracottaP: C('#b85a3a'), travertine: C('#c9c6bc'),
    hulls: [C('#c8453a'), C('#e7b53c'), C('#2f8a96'), C('#3f6fb0'), C('#79a353')], bands: [C('#f5f3ea'), C('#c8453a'), C('#e7b53c')], parasol: [C('#c8453a'), C('#f5f3ea'), C('#3f6fb0'), C('#e7b53c')],
    sock: [C('#e6782f'), C('#f5f3ea')], buoyRed: C('#c8453a') }
  : { ...r, ...shared,
    wood: C('#9a7250'), woodDark: C('#6b4a32'), stoneMid: C('#d3bf99'), stoneLow: C('#a99270'), stoneCope: C('#e6d6b6'), gravelP: C('#cbbb98'), panelFace: C('#f2e6c8'),
    viewerBody: C('#35637f'), viewerTrim: C('#caa252'), viewerFoot: C('#3f3a33'), lens: C('#1f2a33'), visor: C('#2c4e64'), hideRoof: C('#4d664b'),
    copper: C('#b87333'), verdigris: C('#6fa89a'), bronze: C('#9a7a3c'), chalkLine: C('#efe8d6'), ochre: C('#d7ac6b'), terracottaP: C('#b8613f'), travertine: C('#e3d6bd'),
    hulls: [C('#2e6fa8'), C('#b8392f'), C('#3f7d4a'), C('#c9a227'), C('#f2ead8')], bands: [C('#2e6fa8'), C('#b8392f'), C('#c9a227')], parasol: [C('#f2ead8'), C('#e8806a'), C('#7fb8d8'), C('#f2d27a')],
    sock: [C('#d9772f'), C('#f4efe6')], buoyRed: C('#c9563d') };
  cache.set(theme, p); return p;
}

/** One prop being drawn: the builder, its palette, frame and tier. */
export type Ctx = { b: CardBuilder; P: PropPalette; theme: DressingTheme; full: boolean; ground: Ground; rec: PropRecord; x: number; y: number; z: number; yaw: number; s: number; cy: number; sy: number };
export function ctxOf(b: CardBuilder, rec: PropRecord, theme: DressingTheme, ground: Ground, tier: 'full' | 'lite'): Ctx {
  return { b, P: propPalette(theme), theme, full: tier === 'full', ground, rec, x: rec.at[0], y: rec.at[1], z: rec.at[2], yaw: rec.yaw, s: rec.scale ?? 1, cy: Math.cos(rec.yaw), sy: Math.sin(rec.yaw) };
}
/** Local (x across, y up, z forward; metres × scale) to world. */
export const L = (c: Ctx, lx: number, ly: number, lz: number): V3 => [c.x + (lx * c.cy + lz * c.sy) * c.s, c.y + ly * c.s, c.z + (lz * c.cy - lx * c.sy) * c.s];
/** A box in the prop frame (half extents along local x and z), turned by `turn` more. */
export function box(c: Ctx, lx: number, lz: number, hx: number, hz: number, y0: number, y1: number, top: RGB, side: RGB = shade(top, 0.86), ink: RGB | null | undefined = undefined, turn = 0) {
  const p = L(c, lx, 0, lz); c.b.box(p[0], p[2], c.yaw + turn, hx * c.s, hz * c.s, c.y + y0 * c.s, c.y + y1 * c.s, top, side, ink === undefined ? (c.full ? c.b.ink : null) : ink);
}
export function steel(c: Ctx, lx: number, lz: number, hx: number, hz: number, y0: number, y1: number, col: RGB, turn = 0) {
  const p = L(c, lx, 0, lz); c.b.steelBox(p[0], p[2], c.yaw + turn, hx * c.s, hz * c.s, c.y + y0 * c.s, c.y + y1 * c.s, col);
}
export function post(c: Ctx, lx: number, lz: number, y0: number, y1: number, r: number, col: RGB, sides = 6, bucket: 'card' | 'steel' = 'card') {
  const p = L(c, lx, 0, lz); c.b.post(p[0], p[2], c.y + y0 * c.s, c.y + y1 * c.s, r * c.s, col, sides, bucket);
}
export function beam(c: Ctx, a: V3, b2: V3, w: number, h: number, col: RGB, bucket: 'card' | 'steel' = 'card', ink: boolean = c.full) {
  c.b.beam(L(c, a[0], a[1], a[2]), L(c, b2[0], b2[1], b2[2]), w * c.s, h * c.s, col, ink ? c.b.ink : null, bucket);
}
export function cone(c: Ctx, lx: number, lz: number, y0: number, y1: number, r0: number, r1: number, col: RGB, sides = 8, bucket: 'card' | 'steel' = 'card') {
  const p = L(c, lx, 0, lz); c.b.cone(p[0], p[2], c.y + y0 * c.s, c.y + y1 * c.s, r0 * c.s, r1 * c.s, col, sides, bucket);
}
export function dome(c: Ctx, lx: number, ly: number, lz: number, r: number, col: RGB, sides = 8, rings = 3, bucket: 'card' | 'steel' = 'card') {
  const p = L(c, lx, ly, lz); c.b.dome(p[0], p[1], p[2], r * c.s, col, sides, rings, bucket);
}
export function tri(c: Ctx, a: V3, b2: V3, d: V3, col: RGB, bucket: 'card' | 'steel' | 'paint' | 'glow' | 'flat' = 'card') { c.b.tri(L(c, ...a), L(c, ...b2), L(c, ...d), col, bucket); }
export function quad(c: Ctx, a: V3, b2: V3, d: V3, e: V3, col: RGB, bucket: 'card' | 'steel' | 'paint' | 'glow' | 'flat' = 'card') { c.b.quad(L(c, ...a), L(c, ...b2), L(c, ...d), L(c, ...e), col, bucket); }
export function line(c: Ctx, a: V3, b2: V3, col?: RGB) { c.b.line(L(c, ...a), L(c, ...b2), col ?? c.b.ink); }
/** A glow pane box (a lantern's glass): four lit quads round a local centre. */
export function glowBox(c: Ctx, lx: number, ly: number, lz: number, hw: number, hh: number, col: RGB) {
  const p = (u: number, v: number, y: number): V3 => [lx + u, ly + y, lz + v];
  for (const [a, d] of [[[-hw, -hw], [hw, -hw]], [[hw, -hw], [hw, hw]], [[hw, hw], [-hw, hw]], [[-hw, hw], [-hw, -hw]]] as const) quad(c, p(a[0], a[1], -hh), p(d[0], d[1], -hh), p(d[0], d[1], hh), p(a[0], a[1], hh), col, 'glow');
}
/** A small glow orb (a festoon bulb, a beacon lens): an octahedron of glow triangles. */
export function glowOrb(c: Ctx, at: V3, r: number, col: RGB) {
  const P = [[r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r]] as const;
  for (let k = 0; k < 4; k++) { const a = P[k]!, d = P[(k + 1) % 4]!; for (const y of [r, -r]) tri(c, [at[0] + a[0], at[1], at[2] + a[2]], [at[0] + d[0], at[1], at[2] + d[2]], [at[0], at[1] + y, at[2]], col, 'glow'); }
}
/** A horizontal disc (fan of triangles) facing up, in a bucket. */
export function disc(c: Ctx, lx: number, ly: number, lz: number, r: number, n: number, col: RGB, bucket: 'card' | 'steel' | 'flat' | 'paint' | 'glow' = 'card', rz = r) {
  for (let k = 0; k < n; k++) { const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2; tri(c, [lx, ly, lz], [lx + Math.cos(a0) * r, ly, lz + Math.sin(a0) * rz], [lx + Math.cos(a1) * r, ly, lz + Math.sin(a1) * rz], col, bucket); }
}
/** A closed drum (a hay bale, a buoy, a barrel) between two local points. */
export function drum(c: Ctx, a: V3, d: V3, r: number, n: number, side: RGB, cap: RGB) {
  const A = L(c, ...a), D = L(c, ...d), t = [D[0] - A[0], D[1] - A[1], D[2] - A[2]], tl = Math.hypot(t[0]!, t[1]!, t[2]!) || 1, tn = [t[0]! / tl, t[1]! / tl, t[2]! / tl];
  let u = [-tn[2]!, 0, tn[0]!]; if (Math.hypot(u[0]!, u[2]!) < 1e-4) u = [1, 0, 0]; const ul = Math.hypot(u[0]!, u[1]!, u[2]!); u = u.map(v => v / ul);
  const w = [tn[1]! * u[2]! - tn[2]! * u[1]!, tn[2]! * u[0]! - tn[0]! * u[2]!, tn[0]! * u[1]! - tn[1]! * u[0]!], R = r * c.s;
  const ring = (o: V3) => Array.from({ length: n }, (_, k) => { const g = (k / n) * Math.PI * 2; return [o[0] + (u[0]! * Math.cos(g) + w[0]! * Math.sin(g)) * R, o[1] + (u[1]! * Math.cos(g) + w[1]! * Math.sin(g)) * R, o[2] + (u[2]! * Math.cos(g) + w[2]! * Math.sin(g)) * R] as V3; });
  const ra = ring(A), rd = ring(D);
  for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, up = (ra[k]![1] + ra[k2]![1]) / 2 - A[1]; c.b.quad(ra[k]!, ra[k2]!, rd[k2]!, rd[k]!, shade(side, 0.85 + 0.25 * Math.max(-0.4, up / R)));
    c.b.tri(A, ra[k2]!, ra[k]!, cap); c.b.tri(D, rd[k]!, rd[k2]!, shade(cap, 0.92)); }
}
/** A soft contact shadow under the prop (on its floor). */
export function shadow(c: Ctx, rx: number, rz: number, alpha = 0.26, lx = 0, lz = 0) {
  if (!c.full && alpha < 0.2) return; const p = L(c, lx, 0, lz), y = c.y; c.b.shadow(p[0], p[2], rx * c.s, rz * c.s, c.yaw, () => y, alpha);
}

/* ------------------------------------------------------------------------------------------------- lines */

/** A prop's polyline (ground-snapped by the module), or a default 4 eu run along local x through `at`. */
export function lineOf(c: Ctx): V3[] {
  const l = c.rec.line; if (l && l.length >= 2) return l.map(p => [p[0], p[1], p[2]] as V3);
  return [L(c, -2, 0, 0), L(c, 2, 0, 0)];
}
/** Points every `step` along a polyline (both ends included), with the unit direction of their segment. */
export function stations(line: readonly V3[], step: number): { p: V3; dir: [number, number]; s: number }[] {
  const out: { p: V3; dir: [number, number]; s: number }[] = []; let s0 = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, d = line[i]!, len = Math.hypot(d[0] - a[0], d[2] - a[2]); if (len < 1e-6) continue;
    const n = Math.max(1, Math.round(len / step)), dir: [number, number] = [(d[0] - a[0]) / len, (d[2] - a[2]) / len];
    for (let k = i === 1 ? 0 : 1; k <= n; k++) { const t = k / n; out.push({ p: [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t, a[2] + (d[2] - a[2]) * t], dir, s: s0 + len * t }); }
    s0 += len;
  }
  return out;
}
/** The yaw (contract frame) whose local +x runs along a plan direction. */
export const yawAlong = (dir: readonly [number, number]) => Math.atan2(-dir[1], dir[0]);
export const lerp3 = (a: V3, d: V3, t: number): V3 => [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t, a[2] + (d[2] - a[2]) * t];

/* ------------------------------------------------------------------------------------------------ collision */

/** A box part in the prop frame (full sizes along local x/z, heights above the base). */
export function boxPart(rec: PropRecord, lx: number, lz: number, w: number, d: number, y0: number, y1: number, role: CollisionRole, surface: string, walkable = false, turn = 0): CollisionPart {
  const s = rec.scale ?? 1, c = Math.cos(rec.yaw), sn = Math.sin(rec.yaw);
  return { kind: 'box', centre: [rec.at[0] + (lx * c + lz * sn) * s, rec.at[2] + (lz * c - lx * sn) * s], size: [w * s, d * s], yaw: rec.yaw + turn, bottom: rec.at[1] + y0 * s, top: rec.at[1] + y1 * s, role, walkable, surface };
}
/** Box parts along a polyline: one per segment, `width` across, from each end's own floor (`ground` or the line's y). */
export function lineParts(line: readonly V3[], width: number, height: number, role: CollisionRole, surface: string, floor: (p: V3) => number): CollisionPart[] {
  const out: CollisionPart[] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, d = line[i]!, len = Math.hypot(d[0] - a[0], d[2] - a[2]); if (len < 0.05) continue;
    const fa = floor(a), fd = floor(d), mid = [(a[0] + d[0]) / 2, (a[2] + d[2]) / 2] as [number, number];
    out.push({ kind: 'box', centre: mid, size: [len, width], yaw: yawAlong([(d[0] - a[0]) / len, (d[2] - a[2]) / len]), bottom: Math.min(fa, fd) - 0.1, top: Math.max(fa, fd) + height, role, walkable: false, surface });
  }
  return out;
}
export { mix, shade };
