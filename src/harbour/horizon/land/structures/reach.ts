import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { bed } from '../beds/profiles';
import { pier } from './foundations';
import { box, districtAt, nearestOnPath, prism, slab, solid } from './mesh';
import { OPEN_RAIL, OPEN_RAIL_KIND, openRail, pointAlong } from './openRail';

/**
 * The Water's Way — the Reach lookouts' land (reach LAND-ASKS R3–R5, D-WW20; MANIFEST structures.notchBluff / sunsetRail /
 * channelHide; numbers measured on the bake by the prototype, reach SPEC §2).
 *
 * - Notch Bluff and Sunset Rail: a stone pad 7.4 × 5.4 facing its view, its top at the authored height (max ground + 0.12),
 *   a plinth to the ground, a 0.35 sitting kerb (coping 0.52) on the front and both sides, the open rail 1.05 over the pad on
 *   the kerb, and a 1.8 gravel stub from the pad's back edge to the road's paved edge (step-free: ≤ 8 %).
 * - The Channel Hide: a 4.6 × 5.0 timber bay on six piles off the boardwalk's west rail at s 56.2 (S1's deck), a 2.3 blind
 *   (slotted west and south walls, solid north wall, open to the boardwalk), a roof; its connector opens the boardwalk's west
 *   rail over s 54.4–58.0 (the ordinary kerb-gap rule), and a 0.2 timber sill across that gap is the skate guard: a wheel
 *   (board stepMax 0.12, bicycle 0.10) cannot roll over it, a walker steps it (≤ 0.48).
 * Dressing (viewers, benches, panels, number posts, the blind's bench) is PR 3.
 */
export interface LookoutPadSpec { kind: 'lookoutPad'; xy: number[]; face: number[]; size_m: number[]; top_h: number; stub: { to: number[]; road: string; width_m: number }; label?: string }
export interface ChannelHideSpec { kind: 'hide'; on: string; s: number; offset_m: number; size_m: number[]; floor_h: number; thick_m: number; blind_h: number; sill_h: number; label?: string }
const S = M.structures as unknown as Record<string, unknown>;
export const LOOKOUT_PADS: readonly (LookoutPadSpec & { id: string })[] = ['notchBluff', 'sunsetRail'].flatMap(id => S[id] ? [{ id, ...(S[id] as LookoutPadSpec) }] : []);
export const CHANNEL_HIDE: ChannelHideSpec | undefined = S.channelHide as ChannelHideSpec | undefined;
/** A lookout pad's frame: f toward the face, r = the pad's u axis; W(u, v) in plan. */
export function padFrame(p: LookoutPadSpec): { f: XY; r: XY; yaw: number; W: (u: number, v: number) => XY } {
  const at = p.xy as unknown as XY, yaw = Math.atan2(p.face[0]! - at[0], p.face[1]! - at[1]), f: XY = [Math.sin(yaw), Math.cos(yaw)], r: XY = [-f[1], f[0]];
  return { f, r, yaw, W: (u, v) => [at[0] + r[0] * u + f[0] * v, at[1] + r[1] * u + f[1] * v] };
}
const KERB = { height: .29, coping: .06, copingWidth: .52, thick: .45 } as const;
/** The step-free limit for a lookout's stub (walk profile: a stair's step-free twin keeps ≤ 8 %). */
export const STUB_MAX_GRADE = .08;
/** A four-corner prism with the corners wound as `box` winds them (negative plan shoelace), whatever order they come in. */
function windCorners<T>(c: readonly T[], at: (p: T) => XY): number[] { let a = 0; for (let i = 0; i < c.length; i++) { const p = at(c[i]!), q = at(c[(i + 1) % c.length]!); a += p[0] * q[1] - q[0] * p[1]; } return a > 0 ? [3, 2, 1, 0] : [0, 1, 2, 3]; }
const quad = (out: StructureSolid, c: readonly XY[], top: number | readonly number[], bottom: number | readonly number[]) => {
  const o = windCorners(c, p => p);
  prism(out, o.map(i => [c[i]![0], typeof top === 'number' ? top : top[i]!, c[i]![1]] as XYZ), typeof bottom === 'number' ? bottom : o.map(i => bottom[i]!));
};

function lookoutPad(cuts: LandCuts, p: LookoutPadSpec & { id: string }, base: HeightQuery): void {
  const { W } = padFrame(p), hu = p.size_m[0]! / 2, hv = p.size_m[1]! / 2, top = p.top_h, district = districtAt(p.xy[0]!, p.xy[1]!), own = [p.id];
  const deck = solid(`${p.id}.pad`, 'lookoutPad', 'stone', 'deck', own, district), plinth = solid(`${p.id}.plinth`, 'abutment', 'stone', 'support', own, district);
  const kerbs = solid(`${p.id}.kerbs`, 'kerb', 'stone', 'wall', own, district), rails = solid(`${p.id}.rails`, OPEN_RAIL_KIND, 'timber', 'rail', own, district);
  const corners: XY[] = [W(-hu, -hv), W(-hu, hv), W(hu, hv), W(hu, -hv)];
  // The walking slab (0.35), then a plinth whose foot corners settle to the final ground (settleFoundations CORNER_KINDS).
  quad(deck, corners, top, top - .35);
  quad(plinth, corners, top - .35, corners.map(c => Math.min(top - 1, base(c[0], c[1]) - .4)));
  // Sitting kerb: the front (toward the view) and both sides, coping on top.
  const kerb = (a: XY, b: XY, c: XY, d: XY) => { quad(kerbs, [a, b, c, d], top + KERB.height, top - .05); };
  const t = KERB.thick, cw = KERB.copingWidth, back = -hv + .55;
  kerb(W(-hu, hv - t), W(-hu, hv), W(hu, hv), W(hu, hv - t));
  kerb(W(-hu, back), W(-hu, hv - t), W(-hu + t, hv - t), W(-hu + t, back));
  kerb(W(hu - t, back), W(hu - t, hv - t), W(hu, hv - t), W(hu, back));
  const coping = (a: XY, b: XY, c: XY, d: XY) => quad(kerbs, [a, b, c, d], top + KERB.height + KERB.coping, top + KERB.height);
  coping(W(-hu - .035, hv - cw + .035), W(-hu - .035, hv + .035), W(hu + .035, hv + .035), W(hu + .035, hv - cw + .035));
  coping(W(-hu - .035, back), W(-hu - .035, hv - cw + .035), W(-hu + cw - .035, hv - cw + .035), W(-hu + cw - .035, back));
  coping(W(hu - cw + .035, back), W(hu - cw + .035, hv - cw + .035), W(hu + .035, hv - cw + .035), W(hu + .035, back));
  // Open rail on the kerb, 1.05 over the pad: W(±3.6, −2.1) → W(±3.6, 2.5) round the front.
  const rl = (u: number, v: number): XYZ => { const q = W(u, v); return [q[0], top, q[1]]; };
  const railStyle = { from: KERB.height + KERB.coping, bars: [OPEN_RAIL.mid.at - KERB.height - KERB.coping] } as const;
  for (const line of [[rl(-hu + .1, -hv + .6), rl(-hu + .1, hv - .2)], [rl(-hu + .1, hv - .2), rl(hu - .1, hv - .2)], [rl(hu - .1, hv - .2), rl(hu - .1, -hv + .6)]]) openRail(rails, line, 0, railStyle);
  cuts.solids.push(deck, plinth, kerbs, rails);
  // The pad's own bed (a walk over the slab, so the path graph and the crossings know it) and the gravel stub to the road.
  const padBed = bed(`structure.${p.id}`, 'walk', [rl(0, -hv), rl(0, hv - .6)], false); padBed.width = 2 * hu - 2 * t; padBed.structureIds = [p.id]; cuts.beds.push(padBed);
  const road = cuts.beds.find(b => b.id === p.stub.road);
  if (!road) { cuts.diagnostics.push({ id: `structures.${p.id}.stub`, severity: 'conflict', message: `${p.id}: no road ${p.stub.road} for the stub`, at: p.xy as unknown as XY }); return; }
  const verge = p.stub.to as unknown as XY, hit = nearestOnPath(verge, road.points), along: XY = [verge[0] - hit.at[0], verge[1] - hit.at[2]], d = Math.hypot(...along) || 1;
  // The stub ends on the road's paved edge (half-width − 0.05) at the road's height: the path graph's tee joins it to the road.
  const edge = road.width / 2 - .05, end: XYZ = [hit.at[0] + along[0] / d * edge, hit.at[1], hit.at[2] + along[1] / d * edge];
  const start = rl(0, -hv), plan = Math.hypot(end[0] - start[0], end[2] - start[2]), grade = Math.abs(end[1] - start[1]) / (plan || 1);
  // The stub is an ordinary walk bed (the bed geometry draws its 0.35 gravel deck; the corridor opens its kerb where it meets
  // the road's edge band); its own skirt carries it down to the ground (corner-settled), so no terrain is cut on the bluff.
  const skirt = solid(`${p.id}.stub.skirt`, 'abutment', 'stone', 'support', [`${p.id}.stub`], district);
  const n = Math.max(2, Math.ceil(plan / 1.5)), pts: XYZ[] = [];
  for (let k = 0; k <= n; k++) { const q = k / n; pts.push([start[0] + (end[0] - start[0]) * q, start[1] + (end[1] - start[1]) * q, start[2] + (end[2] - start[2]) * q]); }
  for (let k = 1; k < pts.length; k++) { const a = pts[k - 1]!, b = pts[k]!, l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, nx = -(b[2] - a[2]) / l, nz = (b[0] - a[0]) / l, w = p.stub.width_m / 2;
    const c: XY[] = [[a[0] - nx * w, a[2] - nz * w], [a[0] + nx * w, a[2] + nz * w], [b[0] + nx * w, b[2] + nz * w], [b[0] - nx * w, b[2] - nz * w]];
    quad(skirt, c, [a[1] - .35, a[1] - .35, b[1] - .35, b[1] - .35], c.map(q => Math.min(Math.min(a[1], b[1]) - .6, base(q[0], q[1]) - .4))); }
  cuts.solids.push(skirt);
  const stubBed = bed(`${p.id}.stub`, 'walk', pts, false); stubBed.width = p.stub.width_m; stubBed.maxGrade = STUB_MAX_GRADE; stubBed.surface = 'gravel'; cuts.beds.push(stubBed);
  cuts.diagnostics.push({ id: `structures.${p.id}.stub`, severity: grade > STUB_MAX_GRADE + 1e-6 ? 'conflict' : 'info', message: `${p.id}: a ${p.stub.width_m} eu gravel stub, ${plan.toFixed(1)} eu from the pad (${top.toFixed(2)}) to ${p.stub.road}'s paved edge (${end[1].toFixed(2)}), ${(grade * 100).toFixed(1)} % (step-free ≤ ${STUB_MAX_GRADE * 100} %)`, at: [Number(end[0].toFixed(2)), Number(end[2].toFixed(2))], measured: grade, required: STUB_MAX_GRADE });
}

/** The Channel Hide's frame on the boardwalk: P(s) on its deck line, f along the deck, n its left normal (west). */
export function hideFrame(board: Pick<BedCut, 'points'>, h: ChannelHideSpec): { P: XYZ; f: XY; n: XY; W: (along: number, west: number) => XY } {
  const { p, dir } = pointAlong(board.points, h.s), n: XY = [-dir[1], dir[0]], c: XY = [p[0] + n[0] * -h.offset_m, p[2] + n[1] * -h.offset_m];
  return { P: p, f: dir, n, W: (along, west) => [c[0] + dir[0] * along + n[0] * west, c[1] + dir[1] * along + n[1] * west] };
}
function channelHide(cuts: LandCuts, h: ChannelHideSpec, base: HeightQuery): void {
  const board = cuts.beds.find(b => b.id === `structure.${h.on}`);
  if (!board) { cuts.diagnostics.push({ id: 'structures.channelHide', severity: 'conflict', message: `channelHide: no ${h.on} deck`, at: [0, 0] }); return; }
  const { P, n, W } = hideFrame(board, h), y = h.floor_h, ha = h.size_m[0]! / 2, hw = h.size_m[1]! / 2, district = districtAt(P[0], P[2]), own = ['channelHide'];
  const floor = solid('channelHide.floor', 'hideFloor', 'boardwalk', 'deck', own, district), piles = solid('channelHide.piles', 'pile', 'timber', 'support', own, district);
  const walls = solid('channelHide.blind', 'hideWall', 'timber', 'wall', own, district), roof = solid('channelHide.roof', 'roof', 'timber', 'roof', own, district), sill = solid('channelHide.sill', 'thresholdSill', 'timber', 'floor', own, district);
  quad(floor, [W(-ha, -hw), W(-ha, hw), W(ha, hw), W(ha, -hw)], y, y - h.thick_m);
  for (const a of [-2.1, 0, 2.1]) for (const w of [2.2, -.6]) pier(piles, W(a, w), y - h.thick_m, base, [.26, .26], [.5, .5]);
  // Blind: 2.3 tall. West wall (far side) slotted 0.78–1.24 with an elbow shelf at 0.74; south wall slotted; north wall solid.
  const wall = (a: XY, b: XY, from: number, to: number) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * .05, nz = (b[0] - a[0]) / l * .05; quad(walls, [[a[0] - nx, a[1] - nz], [a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz]], y + to, y + from); };
  const slotted = (a: XY, b: XY) => { wall(a, b, 0, .78); wall(a, b, 1.24, h.blind_h); };
  slotted(W(-ha + .05, hw - .05), W(ha - .05, hw - .05));                               // west, along the deck
  slotted(W(ha - .05, hw - .05), W(ha - .05, hw - 2.95));                               // south (down the channel), 2.9
  wall(W(-ha + .05, hw - .05), W(-ha + .05, hw - 2.95), 0, h.blind_h);                // north, solid
  { const a = W(-ha + .1, hw - .3), b = W(ha - .1, hw - .3), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * .21, nz = (b[0] - a[0]) / l * .21;
    quad(walls, [[a[0] - nx, a[1] - nz], [a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz]], y + .78, y + .74); }   // elbow shelf, 0.42 deep
  // Roof 3.4 (across) × 4.9 (along) over the blind, pitched 0.12 rad down to the west.
  { const a = W(0, hw + .2), b = W(0, hw - 3.2), rise = Math.tan(.12) * 3.4;
    slab(roof, [a[0], y + h.blind_h, a[1]], [b[0], y + h.blind_h + rise, b[1]], 4.9, .12); }
  // Posts carrying the roof's open (east) edge.
  for (const a of [-ha + .1, ha - .1]) { const q = W(a, hw - 3.15); box(walls, q, y + h.blind_h + Math.tan(.12) * 3.4 * .95, [.12, .12], y); }
  // The skate guard: a 0.2 timber sill across the rail gap on the rail's line (±1.875 from the deck's centreline).
  { const rail = 4 / 2 - .125, s0 = h.s - 1.8, s1 = h.s + 1.8, a = pointAlong(board.points, s0).p, b = pointAlong(board.points, s1).p;
    slab(sill, a, b, .3, .25, rail, h.sill_h); }
  cuts.solids.push(floor, piles, walls, roof, sill);
  // The hide's bed: from inside the deck's west edge (S1's deck, the path graph's tee) across the sill into the bay; it opens the
  // boardwalk's west rail (lineGaps). It never meets S1's centreline, where the west channel crosses under the deck.
  const from: XY = [P[0] + n[0] * 1.6, P[2] + n[1] * 1.6], b = bed('structure.channelHide', 'walk', [[from[0], y, from[1]], [W(0, 0)[0], y, W(0, 0)[1]]], false); b.width = 2.4; b.structureIds = ['channelHide']; cuts.beds.push(b);
}
/** Builds the Reach lookouts' land (before the rails wait for every route: the hide's connector opens its rail gap). */
export function buildReachLookouts(cuts: LandCuts, base: HeightQuery): void {
  for (const p of LOOKOUT_PADS) lookoutPad(cuts, p, base);
  if (CHANNEL_HIDE) channelHide(cuts, CHANNEL_HIDE, base);
}
