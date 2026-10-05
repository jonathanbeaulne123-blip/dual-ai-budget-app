/**
 * The Lookout kit (STORY: every lookout carries viewer(s), a bench, a panel and an open rail) and the island's linear
 * props: open timber rails, rural fences, dry-stone walls and sheep fanks.
 *
 * The viewer is the classic coin-op tower binocular — a pedestal, a yoke, a rounded head with twin barrels and a
 * hooded eyepiece pair — with a FREE LEVER where a coin box would be (approved: no slot, no currency marks; the lever
 * is what the hand pulls). Standing eyepiece 1.12 above the floor, seated/child 0.82 (Reach prototype kit).
 */
import type { RGB, V3 } from '../../../art/cardScene.ts';
import { L, beam, box, cone, ctxOf, disc, drum, line, lineOf, mix, post, quad, shade, shadow, stations, steel, tri, yawAlong, type Ctx } from './kit.ts';

/* ------------------------------------------------------------------------------------------------- viewers */

/** Named parts the viewer draws (the tests assert none is a coin, slot or currency mark). */
export const VIEWER_PARTS = ['foot', 'pedestal', 'collar', 'yoke', 'head', 'crown', 'barrels', 'lenses', 'eyecups', 'visor', 'leverBox', 'lever', 'leverKnob'] as const;

export function viewer(c: Ctx, seated: boolean) {
  const P = c.P, dy = seated ? -0.3 : 0, body = P.viewerBody, trim = P.viewerTrim, foot = P.viewerFoot, taylor = c.theme === 'taylor';
  // foot + pedestal + collar
  box(c, 0, 0, 0.22, 0.22, 0, 0.05, shade(foot, 1.05), foot);
  cone(c, 0, 0, 0.05, 0.78 + dy, 0.11, 0.07, shade(body, 0.82), c.full ? 8 : 6, taylor ? 'card' : 'steel');
  if (taylor && c.full) box(c, 0, 0, 0.1, 0.1, 0.38 + dy * 0.5, 0.46 + dy * 0.5, P.tape[1]!, P.tape[1]!, null, 0.4);
  cone(c, 0, 0, 0.78 + dy, 0.85 + dy, 0.1, 0.12, trim, c.full ? 8 : 6, 'steel');
  // yoke: a cross piece and two arms the head pivots between
  beam(c, [-0.2, 0.86 + dy, 0], [0.2, 0.86 + dy, 0], 0.07, 0.05, foot, 'steel', false);
  for (const sx of [-1, 1]) beam(c, [sx * 0.19, 0.84 + dy, 0], [sx * 0.19, 1.07 + dy, 0], 0.05, 0.06, foot, 'steel', false);
  // head: a body tilted a little up toward the view, a rounded crown on it
  const yh = 1.05 + dy;
  beam(c, [0, yh - 0.03, -0.17], [0, yh + 0.03, 0.17], 0.33, 0.24, body, taylor ? 'card' : 'steel');
  if (c.full) beam(c, [0, yh + 0.13, -0.15], [0, yh + 0.17, 0.13], 0.24, 0.07, shade(body, 1.08), taylor ? 'card' : 'steel', false);
  // twin barrels (brass in Classic) with dark lenses, toward the view (+z)
  for (const sx of [-1, 1]) drum(c, [sx * 0.08, yh + 0.03, 0.16], [sx * 0.08, yh + 0.07, 0.33], 0.058, c.full ? 7 : 5, trim, P.lens);
  // eyecups and the visor hood over them, at the back (where the eye goes: 1.12 / 0.82)
  for (const sx of [-1, 1]) drum(c, [sx * 0.07, 1.12 + dy, -0.17], [sx * 0.07, 1.12 + dy, -0.25], 0.042, c.full ? 6 : 4, foot, P.lens);
  box(c, 0, -0.235, 0.17, 0.045, 1.15 + dy, 1.2 + dy, P.visor, shade(P.visor, 0.8));
  // the FREE LEVER (where a coin box would be): a plain box on the head's right side and a lever arm with a knob.
  box(c, 0.215, 0, 0.045, 0.085, yh - 0.1, yh + 0.07, trim, shade(trim, 0.82));
  beam(c, [0.26, yh - 0.02, 0.03], [0.31, yh + 0.13, -0.06], 0.03, 0.03, foot, 'steel', false);
  const k = L(c, 0.31, yh + 0.14, -0.065); c.b.dome(k[0], k[1] - 0.02 * c.s, k[2], 0.035 * c.s, P.accent, 6, 2, 'steel');
  shadow(c, 0.35, 0.35, 0.24);
}

/* ------------------------------------------------------------------------------------------------- seating */

const woodOf = (c: Ctx): RGB => (c.theme === 'taylor' ? c.P.walls[0]! : c.theme === 'newfoundland' ? c.P.walls[2]! : c.P.plank);
const endOf = (c: Ctx): RGB => (c.theme === 'classic' ? c.P.iron : c.theme === 'taylor' ? c.P.paperEdge : c.P.trim);

/** A park bench 1.8 long (local x), its sitter facing +z: seat 0.45, back 0.85. */
export function bench(c: Ctx) {
  const wood = woodOf(c), end = endOf(c);
  for (const lx of [-0.82, 0.82]) {
    box(c, lx, 0, 0.04, 0.24, 0, 0.42, end, shade(end, 0.8), null);
    beam(c, [lx, 0.4, -0.2], [lx, 0.86, -0.29], 0.07, 0.06, end, c.theme === 'classic' ? 'steel' : 'card', false);
  }
  for (let k = 0; k < 3; k++) box(c, 0, -0.14 + k * 0.14, 0.92, 0.06, 0.39, 0.45, shade(wood, 1 + k * 0.02), shade(wood, 0.8));
  for (const y of [0.58, 0.74]) beam(c, [-0.92, y, -0.255 - (y - 0.5) * 0.12], [0.92, y + 0.0, -0.255 - (y - 0.5) * 0.12], 0.04, 0.1, wood, 'card', c.full);
  if (c.theme === 'taylor' && c.full) for (const lx of [-0.6, 0.6]) box(c, lx, -0.29, 0.1, 0.012, 0.66, 0.72, c.P.tape[0]!, c.P.tape[0]!, null);
  shadow(c, 1.1, 0.4, 0.26);
}
/** The ring bench round a trunk: 16 segments at radius 6.2 × scale (heights unscaled), sitters facing out. */
export function ringBench(c0: Ctx) {
  const c: Ctx = { ...c0, s: 1 }, R = 6.2 * c0.s, n = 16, chord = 2 * R * Math.sin(Math.PI / n), stone = c.P.stoneMid, wood = c.theme === 'classic' ? c.P.timberLight : woodOf(c);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, out: [number, number] = [Math.sin(a), Math.cos(a)];
    const seg: Ctx = { ...c, x: c.x + out[0] * R, z: c.z + out[1] * R, yaw: a, cy: Math.cos(a), sy: Math.sin(a) };
    // local +z points out from the trunk: legs, seat slab, the backrest 0.28 inboard
    if (c.full) for (const lx of [-chord * 0.32, chord * 0.32]) box(seg, lx, 0, 0.1, 0.2, 0, 0.4, shade(stone, 1.02), stone);
    else box(seg, 0, 0, chord * 0.36, 0.18, 0, 0.4, shade(stone, 1.02), stone);
    box(seg, 0, 0.02, chord * 0.5, 0.25, 0.39, 0.45, shade(wood, 1.04), shade(wood, 0.82));
    box(seg, 0, -0.28, chord * 0.5, 0.035, 0.47, 0.85, wood, shade(wood, 0.8));
  }
}
/** A picnic table (local x along its 1.9 length): top 0.78, benches 0.45 either side. */
export function picnicTable(c: Ctx) {
  const wood = c.theme === 'classic' ? c.P.timberLight : woodOf(c), frame = c.theme === 'classic' ? c.P.timber : shade(wood, 0.8);
  for (let k = 0; k < 4; k++) box(c, 0, -0.3 + k * 0.2, 0.95, 0.09, 0.72, 0.78, shade(wood, 1 + (k % 2) * 0.04), shade(wood, 0.8));
  for (const z of [-0.75, 0.75]) box(c, 0, z, 0.95, 0.14, 0.4, 0.45, wood, shade(wood, 0.8));
  for (const x of [-0.7, 0.7]) {
    beam(c, [x, 0, -0.8], [x, 0.72, -0.05], 0.08, 0.06, frame, 'card', false); beam(c, [x, 0, 0.8], [x, 0.72, 0.05], 0.08, 0.06, frame, 'card', false);
    beam(c, [x, 0.38, -0.9], [x, 0.38, 0.9], 0.07, 0.07, frame, 'card', false);
  }
  shadow(c, 1.3, 1.1, 0.28);
}

/* ------------------------------------------------------------------------------------------------- boards */

/** A pictogram (no words): 0 a heron, 1 hills and a sun, 2 a wave and a boat, 3 a tree, drawn on a board plane. */
function pictogram(c: Ctx, kind: number, at: (u: number, v: number) => V3, ink: RGB, accent: RGB, water: RGB) {
  const T = (pts: [number, number][], col: RGB) => { for (let k = 1; k < pts.length - 1; k++) c.b.tri(at(...pts[0]!), at(...pts[k]!), at(...pts[k + 1]!), col, 'paint'); };
  switch (((kind % 4) + 4) % 4) {
    case 0: T([[-0.05, -0.3], [0.05, -0.3], [0.02, 0.05]], ink); T([[-0.18, 0.0], [0.12, -0.05], [0.18, 0.12], [-0.05, 0.12]], ink); T([[0.1, 0.1], [0.14, 0.3], [0.08, 0.3]], ink); T([[0.08, 0.28], [0.28, 0.24], [0.1, 0.32]], accent); break;
    case 1: T([[-0.35, -0.25], [-0.05, 0.15], [0.2, -0.25]], ink); T([[-0.05, -0.25], [0.18, 0.05], [0.38, -0.25]], shade(ink, 1.3)); T([[0.22, 0.22], [0.32, 0.2], [0.27, 0.3]], accent); T([[0.22, 0.22], [0.27, 0.14], [0.32, 0.2]], accent); break;
    case 2: T([[-0.36, -0.28], [0.36, -0.28], [0.36, -0.12], [0.1, -0.06], [-0.12, -0.16], [-0.36, -0.08]], water); T([[-0.12, -0.05], [0.16, -0.05], [0.1, 0.02], [-0.08, 0.02]], ink); T([[0.0, 0.03], [0.0, 0.3], [0.14, 0.05]], accent); break;
    default: T([[-0.03, -0.3], [0.03, -0.3], [0.03, -0.1], [-0.03, -0.1]], ink); T([[-0.22, -0.12], [0.22, -0.12], [0, 0.32]], shade(ink, 1.25)); break;
  }
}
/** A lectern panel on a post, its sloped face toward the reader (−z), a pictogram on it (no text). */
export function panel(c: Ctx) {
  const P = c.P, wood = P.woodDark, face = P.panelFace;
  box(c, 0, 0, 0.06, 0.06, 0, 0.88, shade(wood, 1.06), wood);
  const corner = (u: number, v: number): V3 => [u * 0.42, 0.9 + (v + 0.5) * 0.22, -0.1 + (v + 0.5) * 0.24];
  beam(c, [0, 0.88, -0.08], [0, 0.98, 0.12], 0.6, 0.06, wood, 'card', false);
  quad(c, corner(-1, -0.5), corner(1, -0.5), corner(1, 0.5), corner(-1, 0.5), face);
  if (c.full) for (const [a, b2] of [[[-1, -0.5], [1, -0.5]], [[1, -0.5], [1, 0.5]], [[1, 0.5], [-1, 0.5]], [[-1, 0.5], [-1, -0.5]]] as const) line(c, corner(a[0], a[1]), corner(b2[0], b2[1]));
  // The pictogram lies a hair off the face, toward the reader (the face's normal is (0, 0.74, −0.67) in the frame).
  pictogram(c, c.rec.variant ?? 0, (u, v) => { const p = corner(u / 0.42, v / 0.64); return L(c, p[0], p[1] + 0.003, p[2] - 0.0027); }, shade(P.timber, 0.9), P.accent, mix(P.glass, [0.3, 0.5, 0.7], 0.4));
  shadow(c, 0.4, 0.35, 0.22);
}
/** A map board: a framed board on two posts under a little roof, the island drawn as a pictogram (no words). */
export function mapBoard(c: Ctx) {
  const P = c.P, wood = P.woodDark, roof = c.theme === 'newfoundland' ? P.roofAlt : P.hideRoof;
  for (const x of [-0.85, 0.85]) box(c, x, 0, 0.06, 0.06, 0, 2.15, shade(wood, 1.05), wood);
  box(c, 0, 0, 0.82, 0.04, 0.85, 1.95, wood, shade(wood, 0.85));
  const at = (u: number, v: number): V3 => L(c, u, 1.4 + v, 0.045);
  // the sea, the island blob, a dotted walk and a "you are here" dot
  c.b.quad(at(-0.74, -0.48), at(0.74, -0.48), at(0.74, 0.48), at(-0.74, 0.48), mix(P.glass, [0.4, 0.6, 0.75], 0.5), 'paint');
  const isle: [number, number][] = [[-0.5, -0.1], [-0.3, -0.36], [0.1, -0.4], [0.48, -0.22], [0.56, 0.12], [0.3, 0.38], [-0.12, 0.36], [-0.46, 0.22]];
  for (let k = 1; k < isle.length - 1; k++) c.b.tri(at(...isle[0]!), at(...isle[k]!), at(...isle[k + 1]!), mix(P.verge, [0.55, 0.65, 0.4], 0.5), 'paint');
  if (c.full) { const walk: [number, number][] = [[-0.36, -0.05], [-0.1, 0.12], [0.18, 0.02], [0.4, 0.1]]; for (let k = 1; k < walk.length; k++) c.b.line(at(walk[k - 1]![0], walk[k - 1]![1]), at(walk[k]![0], walk[k]![1]), P.timber); }
  const d = at(0.18, 0.02); c.b.dome(d[0], d[1], d[2], 0.035 * c.s, P.accent, 6, 2);
  // the roof: two slopes over the board
  const r0 = L(c, -1.0, 2.15, -0.3), r1 = L(c, 1.0, 2.15, -0.3), r2 = L(c, 1.0, 2.35, 0), r3 = L(c, -1.0, 2.35, 0), r4 = L(c, 1.0, 2.15, 0.3), r5 = L(c, -1.0, 2.15, 0.3);
  c.b.quad(r0, r1, r2, r3, roof); c.b.quad(r3, r2, r4, r5, shade(roof, 1.08));
  shadow(c, 1.0, 0.35, 0.24);
}

/* ------------------------------------------------------------------------------------------------- linear */

/** Open rail along `line` (on its floor: a deck, a bay): posts every 2 eu, a top rail at 1.05 and a mid rail; light timber
 * with a brass cap in Classic. `variant` 1: steel pickets. */
export function railOpen(c: Ctx) {
  const P = c.P, steelRail = (c.rec.variant ?? 0) === 1, pts = lineOf(c), st = stations(pts, 2), H = 1.05;
  const postC = steelRail ? P.iron : P.woodDark, railC = steelRail ? P.iron : P.wood, cap = c.theme === 'classic' ? P.brass : c.theme === 'taylor' ? P.paperEdge : P.galvanised;
  const b = c.b, ink = c.full ? b.ink : null;
  for (const s of st) b.box(s.p[0], s.p[2], yawAlong(s.dir), 0.05, 0.05, s.p[1] - 0.05, s.p[1] + H, shade(postC, 1.06), postC, ink);
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1]!.p, d = st[i]!.p;
    if (steelRail) { b.beam([a[0], a[1] + H, a[2]], [d[0], d[1] + H, d[2]], 0.05, 0.04, railC, null, 'steel');
      const n = c.full ? 12 : 6; for (let k = 1; k < n; k++) { const t = k / n, p: V3 = [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t, a[2] + (d[2] - a[2]) * t]; b.beam([p[0], p[1] + 0.05, p[2]], [p[0], p[1] + H, p[2]], 0.018, 0.018, railC, null, 'steel'); }
      b.beam([a[0], a[1] + 0.08, a[2]], [d[0], d[1] + 0.08, d[2]], 0.04, 0.03, railC, null, 'steel');
      continue; }
    b.beam([a[0], a[1] + H - 0.03, a[2]], [d[0], d[1] + H - 0.03, d[2]], 0.12, 0.06, railC, ink);
    if (c.theme === 'classic' && c.full) b.beam([a[0], a[1] + H + 0.005, a[2]], [d[0], d[1] + H + 0.005, d[2]], 0.05, 0.02, cap, null, 'steel');
    b.beam([a[0], a[1] + 0.52, a[2]], [d[0], d[1] + 0.52, d[2]], 0.06, 0.06, c.theme === 'taylor' ? P.paperEdge : railC, ink);
  }
}
/** A rural fence along `line` on the ground: Classic split rails, Taylor paper pickets, Newfoundland white palings. */
export function fence(c: Ctx) {
  const P = c.P, pts = lineOf(c), st = stations(pts, 2.4), g = (p: V3) => c.ground(p[0], p[2]), b = c.b;
  const postC = c.theme === 'classic' ? P.timber : c.theme === 'taylor' ? P.paperEdge : P.trim, railC = c.theme === 'classic' ? P.timberLight : postC;
  for (const s of st) b.box(s.p[0], s.p[2], yawAlong(s.dir), 0.06, 0.06, g(s.p) - 0.05, g(s.p) + 1.15, shade(postC, 1.05), postC, c.full ? b.ink : null);
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1]!.p, d = st[i]!.p, ga = g(a), gd = g(d);
    if (c.theme === 'classic') { for (const h of [0.45, 0.92]) b.beam([a[0], ga + h, a[2]], [d[0], gd + h, d[2]], 0.09, 0.08, shade(railC, 0.95 + h * 0.05), c.full ? b.ink : null); continue; }
    b.beam([a[0], ga + 0.85, a[2]], [d[0], gd + 0.85, d[2]], 0.06, 0.07, railC, null); b.beam([a[0], ga + 0.3, a[2]], [d[0], gd + 0.3, d[2]], 0.06, 0.07, railC, null);
    const n = c.full ? 10 : 5, dir = st[i]!.dir, nx = -dir[1] * 0.04, nz = dir[0] * 0.04;
    for (let k = 1; k < n; k++) {
      const t = k / n, x = a[0] + (d[0] - a[0]) * t, z = a[2] + (d[2] - a[2]) * t, y = ga + (gd - ga) * t, w = 0.045, h = 1.05 + (c.theme === 'taylor' ? (k % 2) * 0.06 : 0);
      const l0: V3 = [x - dir[0] * w + nx, y, z - dir[1] * w + nz], r0: V3 = [x + dir[0] * w + nx, y, z + dir[1] * w + nz], l1: V3 = [l0[0], y + h, l0[2]], r1: V3 = [r0[0], y + h, r0[2]], tip: V3 = [x + nx, y + h + 0.1, z + nz];
      const col = c.theme === 'taylor' && k % 3 === 0 ? P.tape[(k / 3) % P.tape.length | 0]! : postC;
      b.quad(l0, r0, r1, l1, col); b.tri(l1, r1, tip, col);
    }
  }
}
/** A dry-stone wall along `line` on the ground (battered: 0.7 at the foot, 0.42 at the top; `height` above the higher
 * end of each 3 eu course, its foot 0.2 below the lower), coursing pencil lines and a cope. */
export function drystoneWall(c: Ctx, height = 1.1) {
  const P = c.P, pts = lineOf(c), st = stations(pts, 3), g = (p: V3) => c.ground(p[0], p[2]), b = c.b, rnd = (k: number) => { const v = Math.sin(k * 91.7 + c.x * 0.13) * 43758.5; return v - Math.floor(v); };
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1]!.p, d = st[i]!.p, dir = st[i]!.dir, n: [number, number] = [-dir[1], dir[0]], ga = g(a), gd = g(d), foot = Math.min(ga, gd) - 0.2, top = Math.max(ga, gd) + height;
    const stone = shade(mix(P.stoneMid, P.stoneLow, rnd(i) * 0.5), 0.94 + rnd(i + 7) * 0.12), cope = shade(P.stoneLow, 1.0 + rnd(i + 3) * 0.08);
    const W = (p: V3, s: number, w: number, y: number): V3 => [p[0] + n[0] * s * w, y, p[2] + n[1] * s * w];
    for (const s of [-1, 1]) b.side(W(a, s, 0.35, foot), W(d, s, 0.35, foot), W(d, s, 0.21, top), W(a, s, 0.21, top), stone, 0.72);
    b.quad(W(a, -1, 0.21, top), W(d, -1, 0.21, top), W(d, 1, 0.21, top), W(a, 1, 0.21, top), shade(stone, 1.06));
    if (i === 1) b.quad(W(a, -1, 0.35, foot), W(a, 1, 0.35, foot), W(a, 1, 0.21, top), W(a, -1, 0.21, top), shade(stone, 0.9));
    if (i === st.length - 1) b.quad(W(d, 1, 0.35, foot), W(d, -1, 0.35, foot), W(d, -1, 0.21, top), W(d, 1, 0.21, top), shade(stone, 0.9));
    // the cope: a row of tilted stones as a toothed band, and the coursing (full)
    b.beam([a[0], top + 0.08, a[2]], [d[0], top + 0.08, d[2]], 0.46, 0.16, cope, c.full ? b.ink : null);
    if (c.full) {
      // Dry stones: courses of irregular stones laid on each face (lighter and darker, never one length), so the wall
      // reads as stacked stone, not a rendered block; its foot is the ground's.
      const len = Math.hypot(d[0] - a[0], d[2] - a[2]), courses = 4;
      for (const s of [-1, 1]) for (let k = 0; k < courses; k++) {
        const h0 = 0.04 + (k / courses) * 0.92, h1 = h0 + 0.92 / courses - 0.03; let u = (k % 2) * 0.25 * rnd(i * 13 + k);
        for (let q = 0; u < len - 0.05 && q < 14; q++) {
          const l = 0.38 + rnd(i * 31 + k * 7 + q) * 0.5, u1 = Math.min(len - 0.03, u + l), tone = shade(mix(P.stoneMid, P.stoneLow, rnd(i * 17 + k * 5 + q * 3)), 0.88 + rnd(q * 11 + k + i) * 0.22);
          const at = (uu: number): V3 => [a[0] + dir[0] * uu, 0, a[2] + dir[1] * uu], gy = (uu: number) => g(at(uu)), y = (uu: number, h: number) => { const f = Math.min(ga, gd) - 0.2 + (gy(uu) - Math.min(ga, gd)), t2 = Math.max(ga, gd) + height; return f + (t2 - f) * h; };
          const off = (h: number) => 0.355 - 0.14 * h + 0.012;
          b.quad(W(at(u), s, off(h0), y(u, h0)), W(at(u1), s, off(h0), y(u1, h0)), W(at(u1), s, off(h1), y(u1, h1)), W(at(u), s, off(h1), y(u, h1)), tone, 'paint');
          u = u1 + 0.04;
        }
      }
    }
  }
}
export function sheepFank(c: Ctx) { drystoneWall(c, 1.0); }
export { ctxOf, steel, tri, disc, post };
