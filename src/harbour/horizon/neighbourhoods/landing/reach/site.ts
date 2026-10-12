/**
 * The Reach and the Greenway: the place's fixed points (the land's as built, MANIFEST + D-WW60…69; the prototype's measured
 * numbers, reach SPEC §1–5) and the one placement rule every planted thing passes (`Site.plantOk`): off beds and pads and
 * baked solids, in water only when aquatic and shallow, out of the clearings, the view corridors and the story sightlines.
 */
import { PROTECTED_MAX_HEIGHT, type DressingContext } from '../../types.ts';
import { greenwayLine, type GreenwayLine } from '../../../land/structures/greenway.ts';
import { HORIZON_MANIFEST as M } from '../../../world/manifest.ts';
import { aimPoint, storyEye, storyLandmark } from '../../../world/story.ts';
import { blocksSight, frame, inCorridor, inPoly, polyDist, polyEdgeDist, segDist, WaterEdge, yawTo, type Corridor, type Sightline, type XY, type XYZ } from './geom.ts';

/** MANIFEST landforms.reach: the conservation marsh's outline. */
export const REACH_POLY: readonly XY[] = [[1180, 1180], [1320, 1180], [1370, 1300], [1300, 1360], [1200, 1340], [1160, 1260]];
export const SPRING = { c: [1250, 1184] as XY, r: [4.5, 3] as XY, rock: [1245.4, 1180.2] as XY };
export const HERON: XY = [1268.6, 1204];
export const OSPREY: XY = [1292, 1268];
/** The Reach meadow's landing field (kept clear of all planting) and the glider's Sands field moved here by D-WW90. */
export const MEADOW = { c: [1195, 1205] as XY, r: 40 };
export const SANDS_FIELD = { c: [1185, 1355] as XY, r: 35 };
export const BOATHOUSE: readonly XY[] = [[1275, 1308], [1295, 1308], [1295, 1322], [1275, 1322]];
/** Page I (D-WW64): the boardwalk's north end looking at the spring's source rock. */
export const PAGE_I = { eye: [1247.5, 5.98, 1218] as XYZ, target: [1250, 5.7, 1184] as XYZ };

export type LookoutKind = 'pad' | 'deck' | 'hide';
export interface ReachLookout { id: string; n: number; label: string; at: XY; kind: LookoutKind; floor: number; face: XY; front: number; hour: string; subject: string }
const pad = (id: string) => (M.structures as unknown as Record<string, { top_h: number }>)[id]!.top_h;
/** The six lookouts (reach SPEC §2; the pads' tops as built, D-WW62). */
export const LOOKOUTS: readonly ReachLookout[] = [
  { id: 'notchBluff', n: 1, label: 'Notch Bluff', at: [1188, 1112], kind: 'pad', floor: pad('notchBluff'), face: [1290, 1290], front: 1.95, hour: 'golden hour', subject: 'osprey' },
  { id: 'highSpanOverlook', n: 2, label: 'High Span Overlook', at: [1268, 1145], kind: 'deck', floor: 10, face: [1290, 1250], front: 1.9, hour: 'morning', subject: 'osprey' },
  { id: 'springBay', n: 3, label: 'Spring Bay', at: [1246.4, 1199.5], kind: 'deck', floor: 5, face: HERON, front: 1.9, hour: 'morning', subject: 'heron' },
  { id: 'channelHide', n: 4, label: 'the Channel Hide', at: [1250.89, 1252.26], kind: 'hide', floor: 5, face: [1236, 1292], front: 0, hour: 'dawn', subject: 'ducks' },
  { id: 'sunsetRail', n: 5, label: 'Sunset Rail', at: [1356, 1236], kind: 'pad', floor: pad('sunsetRail'), face: [1250, 1210], front: 1.95, hour: 'golden hour', subject: 'highSpan' },
  { id: 'harbourBellLanding', n: 6, label: 'Harbour Bell Landing', at: [1325.8, 1382.2], kind: 'deck', floor: 9, face: [1150, 1340], front: 2.2, hour: 'dusk', subject: 'lamp' },
];

/** The beds a reed may grow right up to (open decks on piles): the boardwalk, the footbridge, the hides, the Greenway. */
export const DECK_PREFIXES = ['structure.reachBoardwalk', 'structure.reachFootbridge', 'structure.channelHide', 'structure.greenway', 'S1'] as const;
const DECK_BEDS = [...DECK_PREFIXES];

export interface Keep { c: XY; r: number; maxH: number }
/** The bake's context carries three more probes (neighbourhoods/bake.ts `DressingContextImpl`); a test double may not. */
export type Impl = DressingContext & {
  inSolid?: (x: number, z: number, margin?: number, ignore?: (id: string) => boolean) => string | null;
  onPad?: (x: number, z: number, margin?: number) => string | null;
  floorAt?: (x: number, z: number, near: number, window?: number) => number | null;
};

export interface Site {
  ctx: Impl;
  L: GreenwayLine;
  edge: WaterEdge;
  /** The boardwalk (S1's deck): its centreline ends, length, unit direction and left normal (west). */
  bw: { a: XY; b: XY; len: number; dir: XY; n: XY; y: number; at: (s: number, off: number) => XY;
    /** S1's own deck line along the boardwalk (the rails stand ±1.875 off it, D-WW61) and a point on a rail there. */
    deck: XY[]; dist: (x: number, z: number) => number; rail: (s: number, side: number, off?: number) => XY };
  lines: Sightline[];
  corridors: Corridor[];
  keeps: Keep[];
  /** True when a plant of drawn height `h` and crown radius `r` may stand at (x, z); `aquatic` plants may stand in shallow fresh water. */
  plantOk(x: number, z: number, h: number, r: number, o?: { aquatic?: boolean; tree?: boolean; deckGap?: number }): boolean;
  /** Distance (plan) to the Greenway's centreline and the arc there. */
  gw(x: number, z: number): { d: number; s: number };
}

export function createSite(ctx: Impl): Site {
  const L = greenwayLine();
  const board = ctx.beds.find(b => b.id === 'structure.reachBoardwalk');
  const a: XY = board ? [board.points[0]![0], board.points[0]![2]] : [1241.02, 1196.77], b: XY = board ? [board.points.at(-1)![0], board.points.at(-1)![2]] : [1268.98, 1305.23];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), dir: XY = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], n: XY = [dir[1], -dir[0]];
  const at = (s: number, off: number): XY => [a[0] + dir[0] * s + n[0] * off, a[1] + dir[1] * s + n[1] * off];
  // S1's deck line where it runs on the boardwalk (its points within 6 m of the bed's straight line, s −8 … len + 12).
  const s1 = ctx.beds.find(q => q.id === 'S1'), deck: XY[] = (s1?.points ?? []).map(p => [p[0], p[2]] as XY).filter(p => { const q = segDist(p[0], p[1], a, b); return q.d < 6 && q.t * len > -8 && q.t * len < len + 12; });
  const line: XY[] = deck.length >= 2 ? deck : [a, b];
  const rail = (s: number, side: number, off = 1.88): XY => {
    // The straight line's point at s, onto S1's line, then out along S1's own normal.
    const p = at(s, 0); let best = { d: Infinity, i: 1, t: 0 }; for (let i = 1; i < line.length; i++) { const q = segDist(p[0], p[1], line[i - 1]!, line[i]!); if (q.d < best.d) best = { d: q.d, i, t: q.t }; }
    const u = line[best.i - 1]!, v = line[best.i]!, l = Math.hypot(v[0] - u[0], v[1] - u[1]) || 1, d: XY = [(v[0] - u[0]) / l, (v[1] - u[1]) / l], c: XY = [u[0] + (v[0] - u[0]) * best.t, u[1] + (v[1] - u[1]) * best.t];
    return [c[0] + d[1] * off * side, c[1] - d[0] * off * side];
  };
  const bw = { a, b, len, dir, n, y: board ? board.points[0]![1] : 5, at, deck: line, dist: (x: number, z: number) => polyDist(x, z, line).d, rail };
  // The marsh's water edge: the Reach box and a 56 m band either side of the Greenway's land stretches.
  const pts = L.full.map(p => [p[0], p[2]] as XY), BOX: [number, number, number, number] = [600, 1392, 688, 1392], bx = BOX[1] - BOX[0] + 1, band = new Uint8Array(bx * (BOX[3] - BOX[2] + 1));
  // The band: every 2 m sample of the land stretches stamps a 56 m disc (cheap; the water edge samples only marked cells).
  L.full.forEach((p, i) => { const s = L.arcs[i]!; if (s >= 625 && s <= 945) return; const R = 56;
    for (let z = Math.max(BOX[2], Math.ceil(p[2] - R)); z <= Math.min(BOX[3], Math.floor(p[2] + R)); z++) for (let x = Math.max(BOX[0], Math.ceil(p[0] - R)); x <= Math.min(BOX[1], Math.floor(p[0] + R)); x++) if (Math.hypot(x - p[0], z - p[2]) < R) band[(z - BOX[2]) * bx + (x - BOX[0])] = 1; });
  const inReachBox = (x: number, z: number) => x > 1140 && x < 1392 && z > 1150 && z < 1392;
  const edge = new WaterEdge(ctx, BOX, (x, z) => inReachBox(x, z) || band[(z - BOX[2]) * bx + (x - BOX[0])] === 1);
  // ---- the story's sightlines and the lookouts' binocular lines (the planting stays ≥ 0.5 under each) ----
  const eyeOf = (id: string): XYZ => { const e = storyEye(id); return [e.at[0], e.y ?? ctx.heightAt(e.at[0], e.at[1]) + (e.lift ?? 1.6), e.at[1]]; };
  const aim = (id: string): XYZ => aimPoint(storyLandmark(id)) as XYZ;
  const lines: Sightline[] = [
    { id: 'springBay→campanile', eye: eyeOf('springBay'), aim: aim('campanile'), pad: 0.6, clear: 0.6, from: 3.5 },
    { id: 'oak→osprey', eye: eyeOf('oak'), aim: aim('osprey'), pad: 0.6, clear: 0.6, from: 1 },
    ...['springBay', 'notchBluff', 'highSpanOverlook', 'sunsetRail', 'harbourBellLanding'].map(id => ({ id: `${id}→osprey`, eye: eyeOf(id), aim: aim('osprey'), pad: 0.5, clear: 0.5, from: 3.5 })),
    ...['springBay', 'notchBluff', 'highSpanOverlook', 'sunsetRail', 'harbourBellLanding'].map(id => ({ id: `${id}→lamp`, eye: eyeOf(id), aim: aim('lamp'), pad: 0.5, clear: 0.5, from: 3.5 })),
  ];
  // ---- view corridors (planting taller than maxH stays out) ----
  const corridors: Corridor[] = [
    // Page I: the eye on the boardwalk's north end to the spring's source rock (the prototype's EYE_BW corridor).
    { from: [PAGE_I.eye[0], PAGE_I.eye[2]], to: SPRING.rock, w0: 1.0, k: 0.07, start: 6, maxH: 0.9 },
    // Spring Bay to the heron (s 2.5–22) and the Channel Hide's south slot down the channel.
    { from: [1248.2, 1200.2], to: HERON, w0: 0.9, k: 0.08, start: 2.5, end: 22, maxH: 0.5 },
    { from: [1250.3, 1254.5], to: [1238, 1292], w0: 1.4, k: 0.12, start: 3, maxH: 0.5 },
  ];
  // ---- clearings: the lookouts' near fields, the osprey's footing, the spring, the meadow and the Sands field ----
  const keeps: Keep[] = [
    { c: [1188, 1112], r: 9, maxH: 0 }, { c: [1356, 1236], r: 8, maxH: 0 }, { c: OSPREY, r: 9, maxH: 0.9 }, { c: HERON, r: 1.6, maxH: 0 },
    { c: MEADOW.c, r: MEADOW.r, maxH: 0 }, { c: SANDS_FIELD.c, r: SANDS_FIELD.r, maxH: 0.9 },
  ];
  const gw = (x: number, z: number) => polyDist(x, z, pts);
  const solidOf = (x: number, z: number, m: number) => ctx.inSolid?.(x, z, m, id => id.startsWith('dressing.')) ?? null;
  const plantOk: Site['plantOk'] = (x, z, h, r, o = {}) => {
    // Beds: a reed grows to an open deck's edge (0.35); anything else keeps 1.4 off a path, a tree 5.
    const all = ctx.bedClearance(x, z), deck = ctx.bedClearance(x, z, DECK_BEDS), nearDeck = deck <= all + 1e-6;
    const need = o.tree ? (nearDeck ? 4 : 5) : nearDeck ? (o.deckGap ?? 0.35) : h > 1 ? 1.4 : 0.8;
    if (all < need) return false;
    if (ctx.onPad?.(x, z, o.tree ? 3 : 0.4)) return false;
    if (solidOf(x, z, o.tree ? Math.max(1, r * 0.6) : 0.15)) return false;
    const lvl = ctx.waterLevelAt(x, z);
    if (lvl !== null) { if (!o.aquatic || lvl <= 0.6 || lvl - ctx.heightAt(x, z) > 0.9) return false; }
    for (const k of keeps) if (h > k.maxH && Math.hypot(x - k.c[0], z - k.c[1]) < k.r + (o.tree ? r : 0)) return false;
    if (Math.hypot((x - SPRING.c[0]) / SPRING.r[0], (z - SPRING.c[1]) / SPRING.r[1]) < 1.45 && h > 0.9) return false;
    if (h > 0.5 && (inPoly(x, z, BOATHOUSE) || polyEdgeDist(x, z, BOATHOUSE) < 4)) return false;
    if (h > PROTECTED_MAX_HEIGHT && ctx.protectedAreas.some(p => inPoly(x, z, p.outline) || polyEdgeDist(x, z, p.outline) < r)) return false;
    if (inCorridor(corridors, x, z, h)) return false;
    if (blocksSight(lines, x, z, ctx.heightAt(x, z) + h, r)) return false;
    return true;
  };
  return { ctx, L, edge, bw, lines, corridors, keeps, plantOk, gw };
}

/** A lookout's frame (u across, v toward its view). */
export const lookoutFrame = (l: ReachLookout) => frame(l.at, yawTo(l.at, l.face));
export { segDist };
