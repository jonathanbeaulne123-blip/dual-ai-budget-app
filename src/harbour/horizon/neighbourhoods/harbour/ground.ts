/**
 * Little Harbour's ground paint (SPEC §7; STYLE §2.1 ground): the brick piazza with a travertine border and ten
 * travertine rays from the Queen's Court's porcelain inlay (Siena-style), the small green (red clover) round the bocce
 * court, cobble setts on the upper street, and the lanes' cobbled verges out to the façades. Every patch on a level pad
 * carries that pad's height as its `floor` (the slab the land draws), each layer a hair above the one under it; the verges
 * drape the ground and are set dressing (`fullOnly`: lite drops them). Paint never re-shapes ground.
 *
 * The runtime drapes paint in triangles no longer than 2.5 eu a side (runtime/dressingLayer.ts `paintEdge`), splitting the
 * longest edge until they are. A big rectangle or a long thin strip handed over whole splits into far more triangles
 * than it needs, so the paint here is pre-cut: pads into an equilateral lattice (edge `LATTICE`), strips into quads at
 * most `PIECE` long. Each piece is one `GroundPaint` (≤ 2 triangles), so the draped count is the minimum.
 */
import type { Point2 } from '../../world/definition.ts';
import type { DressingContext, GroundPaint } from '../types.ts';
import { pointInPolygon } from '../../world/geometry.ts';
import { COURT, GREEN, TOWN, tier, untouched } from './plan.ts';
import { FRONTAGE_BEDS } from './solver.ts';

export const LATTICE = 2.45, PIECE = 2.2;
/** A thin strip from a to b, `w` wide (≤ 1), cut into pieces ≤ PIECE long. */
export function strip(a: Point2, b: Point2, w: number): Point2[][] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L * w / 2, nz = (b[0] - a[0]) / L * w / 2, n = Math.max(1, Math.ceil(L / PIECE)), out: Point2[][] = [];
  for (let k = 0; k < n; k++) { const p = (t: number): Point2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], p0 = p(k / n), p1 = p((k + 1) / n); out.push([[p0[0] + nx, p0[1] + nz], [p1[0] + nx, p1[1] + nz], [p1[0] - nx, p1[1] - nz], [p0[0] - nx, p0[1] - nz]]); }
  return out;
}
/** A rectangle as an equilateral lattice of triangles (vertices clamped into it; slivers dropped). */
export function lattice(x0: number, z0: number, x1: number, z1: number, edge = LATTICE): Point2[][] {
  const h = edge * Math.sqrt(3) / 2, rows = Math.ceil((z1 - z0) / h), out: Point2[][] = [], C = (x: number, z: number): Point2 => [Math.min(x1, Math.max(x0, x)), Math.min(z1, Math.max(z0, z))];
  for (let r = 0; r < rows; r++) {
    const za = z0 + r * h, zb = za + h, shift = r % 2 ? edge / 2 : 0;
    for (let x = x0 - edge + shift; x < x1 + edge; x += edge) {
      for (const t of [[C(x, za), C(x + edge, za), C(x + edge / 2, zb)], [C(x + edge, za), C(x + edge * 1.5, zb), C(x + edge / 2, zb)]] as Point2[][]) {
        const area = Math.abs((t[1]![0] - t[0]![0]) * (t[2]![1] - t[0]![1]) - (t[2]![0] - t[0]![0]) * (t[1]![1] - t[0]![1])) / 2;
        if (area > 0.02) out.push(t);
      }
    }
  }
  return out;
}
/** A ring (annulus) as `n` quads. */
export function ring(c: Point2, r: number, w: number, n = 32): Point2[][] {
  const out: Point2[][] = [];
  for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, P = (a: number, rr: number): Point2 => [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]; out.push([P(a0, r - w / 2), P(a1, r - w / 2), P(a1, r + w / 2), P(a0, r + w / 2)]); }
  return out;
}

/** The ten rays' angles (SPEC §7: a/10 · 2π + 0.3). */
export const RAYS = Array.from({ length: 10 }, (_, a) => a / 10 * Math.PI * 2 + 0.3);
/** Each layer's height over its pad (brick under the green under the travertine under the inlay). */
export const LIFT = { brick: 0, green: 0.015, travertine: 0.02, inlay: 0.035 } as const;

export function paintGround(ctx: DressingContext): GroundPaint[] {
  const out: GroundPaint[] = [], sq = tier('square'), y = sq.y;
  // The campo's brick is the warm Siena tone (protos/harbour BRICK #c4906a): the paint table's `ochre`, lightened; `brick`
  // (#a8664f) read maroon in the square's golden-hour shade.
  // The campo is laid in ten fans between the travertine rays (Siena), alternate fans a shade apart, so the 56 m of brick
  // reads as laid courses rather than one plain (no triangles added: the lattice's own pieces carry the tone).
  for (const t of lattice(sq.x0, sq.z0, sq.x1, sq.z1)) for (const piece of campoPieces(t)) { const fan = campoFan(piece); out.push({ polygon: piece, surface: fan === 1 ? 'brick' : 'ochre', tone: fan === 1 ? 1 : 0.75, floor: y + LIFT.brick }); }
  // The small green: from the square's north edge south to 0.3 eu short of the bank approach (the bocce court wholly on it).
  const bank = ctx.beds.find(b => b.id === 'host.bank.approach'), half = (bank?.width ?? 2.5) / 2;
  const edgeZ = (x: number) => { let best = Infinity; const P = bank?.points ?? []; for (let i = 1; i < P.length; i++) { const a = P[i - 1]!, b = P[i]!; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) { const t = (x - a[0]) / (b[0] - a[0]); best = Math.min(best, a[2] + (b[2] - a[2]) * t); } } return best - half - 0.3; };
  const gx0 = GREEN.centre[0] - GREEN.size[0] / 2 + 0.6, gx1 = GREEN.centre[0] + GREEN.size[0] / 2 - 0.5, gz0 = sq.z0 + 0.1;
  const south = (x: number) => Math.min(GREEN.centre[1] + GREEN.size[1] / 2, edgeZ(x));
  for (let k = 0; k < 8; k++) { const xa = gx0 + (gx1 - gx0) * k / 8, xb = gx0 + (gx1 - gx0) * (k + 1) / 8; out.push({ polygon: [[xa, gz0], [xb, gz0], [xb, south(xb)], [xa, south(xa)]], surface: 'mown', tone: 0.35, floor: y + LIFT.green }); }
  // The travertine border (1.0 wide, inset 0.6) and the ten rays from r 6.6 to the border.
  const i0 = 0.6 + 0.5, bx0 = sq.x0 + i0, bx1 = sq.x1 - i0, bz0 = sq.z0 + i0, bz1 = sq.z1 - i0;
  for (const [a, b] of [[[bx0, bz0], [bx1, bz0]], [[bx1, bz0], [bx1, bz1]], [[bx1, bz1], [bx0, bz1]], [[bx0, bz1], [bx0, bz0]]] as [Point2, Point2][]) for (const q of strip(a, b, 1.0)) out.push({ polygon: q, surface: 'travertine', floor: y + LIFT.travertine });
  for (const t of RAYS) {
    const dx = Math.cos(t), dz = Math.sin(t), reach = Math.min(dx > 0 ? (bx1 - COURT[0]) / dx : dx < 0 ? (bx0 - COURT[0]) / dx : 99, dz > 0 ? (bz1 - COURT[1]) / dz : dz < 0 ? (bz0 - COURT[1]) / dz : 99);
    for (const q of strip([COURT[0] + dx * 6.6, COURT[1] + dz * 6.6], [COURT[0] + dx * reach, COURT[1] + dz * reach], 0.5)) out.push({ polygon: q, surface: 'travertine', floor: y + LIFT.travertine });
  }
  // The Court's porcelain inlay: rings r 6.5, 4.6 and 1.4 and eight spokes (the lightest travertine tone).
  for (const [r, w] of [[6.5, 0.6], [4.6, 0.22], [1.4, 0.4]] as const) for (const q of ring(COURT, r, w, r > 2 ? 32 : 12)) out.push({ polygon: q, surface: 'travertine', tone: 1, floor: y + LIFT.inlay });
  for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; for (const q of strip([COURT[0] + Math.cos(t) * 1.6, COURT[1] + Math.sin(t) * 1.6], [COURT[0] + Math.cos(t) * 4.4, COURT[1] + Math.sin(t) * 4.4], 0.22)) out.push({ polygon: q, surface: 'travertine', tone: 1, floor: y + LIFT.inlay }); }
  // Cobble setts on the upper street (the lane and the quay keep the land's stone slab: the lite budget).
  { const t = tier('upperStreet'); for (const q of lattice(t.x0, t.z0, t.x1, t.z1)) out.push({ polygon: q, surface: 'cobble', tone: 0.55, floor: t.y }); }
  out.push(...laneVerges(ctx));
  return out;
}

/** Clip a convex polygon to the half-plane left of the line from COURT along angle `a` (cross ≥ 0). */
function clipHalf(P: readonly Point2[], a: number, keepLeft: boolean): Point2[] {
  const dx = Math.cos(a), dz = Math.sin(a), side = (p: Point2) => (dx * (p[1] - COURT[1]) - dz * (p[0] - COURT[0])) * (keepLeft ? 1 : -1), out: Point2[] = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i]!, q = P[(i + 1) % P.length]!, sp = side(p), sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
const area2 = (P: readonly Point2[]) => Math.abs(P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]!; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
/**
 * A lattice piece cut along the travertine rays, so each brick fan ends exactly on its ray (not in a sawtooth of whole
 * lattice triangles). A piece no ray crosses is returned whole; one a ray crosses becomes one piece per fan it touches
 * (each fan is a 36° wedge from the Court: the intersection of two half-planes). Slivers under 0.02 m² are dropped.
 */
export function campoPieces(t: readonly Point2[]): Point2[][] {
  // A piece by the Court's centre may span fans none of its corners lie in: try all ten there.
  const fans = t.some(p => Math.hypot(p[0] - COURT[0], p[1] - COURT[1]) < 3) ? new Set(Array.from({ length: 10 }, (_, k) => k)) : new Set(t.map(p => fanOfPoint(p)));
  if (fans.size === 1) return [t as Point2[]];
  const out: Point2[][] = [];
  for (const k of fans) {
    const a0 = RAYS[0]! + k * Math.PI / 5, a1 = a0 + Math.PI / 5;
    const piece = clipHalf(clipHalf(t, a0, true), a1, false);
    if (piece.length >= 3 && area2(piece) > 0.02) out.push(piece);
  }
  return out;
}
/** The fan (0…9, between ray k and ray k + 1) a point lies in, by its bearing from the Court. */
export function fanOfPoint(p: Point2): number {
  return Math.floor((((Math.atan2(p[1] - COURT[1], p[0] - COURT[0]) - RAYS[0]!) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 5)) % 10;
}

/**
 * Which brick a campo piece is laid in: by the fan (between two rays) its centroid lies in — the warm `ochre` brick in
 * alternate fans (0), the deeper `brick` in the others (1); the fans run in to the Court's centre under its inlay. One tone of brick over
 * 56 m read as bare earth at golden hour (the square sits in warm shade, D-WW135); two bricks read as laid fans.
 */
export function campoFan(t: readonly Point2[]): 0 | 1 {
  const c: Point2 = [t.reduce((a, p) => a + p[0], 0) / t.length, t.reduce((a, p) => a + p[1], 0) / t.length];
  return fanOfPoint(c) % 2 ? 1 : 0;
}

/**
 * The lanes' verges (SPEC §5.1: the town's ground is cobble near every road and walk): a band of setts from each frontage
 * bed's edge out to the façade line (the solver's 1.3 setback), so a vicolo is stone wall to wall, not a path between two
 * strips of lawn. Cut into pieces ≤ PIECE long (2 triangles each); a piece is kept only where all its corners are inside
 * the town, dry, off every other bed, pad and baked solid and off the untouched sites. Set dressing: lite drops it whole.
 */
export const VERGE = { from: 0.08, to: 1.35 } as const;
export function laneVerges(ctx: DressingContext): GroundPaint[] {
  const out: GroundPaint[] = [], wanted = new Set<string>(FRONTAGE_BEDS);
  const ok = (p: Point2) => pointInPolygon(p[0], p[1], TOWN as Point2[]) && ctx.waterLevelAt(p[0], p[1]) === null && ctx.heightAt(p[0], p[1]) >= 1.5
    && ctx.bedClearance(p[0], p[1]) >= -0.06 && (ctx.onPad?.(p[0], p[1], 0.1) ?? null) === null && !ctx.occupied(p[0], p[1], 0) && !untouched(p[0], p[1], 0.3, ctx.onPad);
  for (const b of ctx.beds) {
    if (!wanted.has(b.id)) continue;
    const half = (b.width ?? 0) / 2, P = b.points.map(q => [q[0], q[2]] as Point2);
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1]!, c = P[i]!, L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
      const u: Point2 = [(c[0] - a[0]) / L, (c[1] - a[1]) / L], n: Point2 = [-u[1], u[0]], k = Math.max(1, Math.ceil(L / PIECE));
      for (let j = 0; j < k; j++) for (const side of [1, -1]) {
        const s0 = L * j / k, s1 = L * (j + 1) / k, at = (s: number, o: number): Point2 => [a[0] + u[0] * s + n[0] * o * side, a[1] + u[1] * s + n[1] * o * side];
        const q = [at(s0, half + VERGE.from), at(s1, half + VERGE.from), at(s1, half + VERGE.to), at(s0, half + VERGE.to)];
        if (q.every(ok)) out.push({ polygon: side > 0 ? q : [...q].reverse(), surface: 'cobble', tone: 0.35 + 0.3 * (((i * 7 + j * 3) % 5) / 4), fullOnly: true });
      }
    }
  }
  return out;
}
