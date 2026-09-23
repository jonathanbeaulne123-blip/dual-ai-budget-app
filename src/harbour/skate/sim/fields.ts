/**
 * SIM · synthetic SkateFields.
 *
 * Analytic little parks for the sim's tests (and a worked reference for the
 * PARK track of what the sim expects from `SkateField`): exact normals, lip
 * strips on the last 0.1 of every transition that ends at coping or a kicker
 * lip, coping grindables with `faceYaw` pointing into the transition.
 *
 * Local frames: a piece at (x, z, yaw) has local +lz along the yaw heading
 * (sin yaw, cos yaw) and local +lx 90° clockwise from it seen from above
 * (i.e. world (cos yaw, −sin yaw)).
 */
import type { Grindable, SkateField, SkateSolid, SkateSpot, SurfaceKind, SurfaceSample } from '../contract.ts';

export type Piece = (x: number, z: number) => SurfaceSample | null;

const LIP_STRIP = 0.1;

function local(x0: number, z0: number, yaw: number, x: number, z: number): [number, number] {
  const dx = x - x0, dz = z - z0, c = Math.cos(yaw), s = Math.sin(yaw);
  return [dx * c - dz * s, dz * c + dx * s];
}
function world(x0: number, z0: number, yaw: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x0 + lx * c + lz * s, z0 + lz * c - lx * s];
}
/** A local-frame normal (nlx, ny, nlz) turned into world axes, normalised. */
function sampleOf(yaw: number, y: number, nlx: number, ny: number, nlz: number, kind: SurfaceKind, feature: string | null, lip: SurfaceSample['lip']): SurfaceSample {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let nx = nlx * c + nlz * s, nz = nlz * c - nlx * s;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; nz /= l;
  return { y, nx, ny: ny / l, nz, kind, feature, lip };
}

/** Circular transition: height and slope at distance u from its start, radius R. */
function tranny(u: number, R: number): { y: number; slope: number } {
  const q = Math.sqrt(Math.max(1e-9, R * R - u * u));
  return { y: R - q, slope: u / q };
}

/** `vert` (default true) marks the coping lip as vert: straight up and back in. Kickers/banks use false. */
export type QuarterPipe = { id: string; x: number; z: number; yaw: number; radius: number; topDeg: number; width: number; deck?: number; kind?: SurfaceKind; vert?: boolean };

/** A quarterpipe whose transition starts at (x,z) and rises along +lz (yaw = the way you ride into it). */
export function quarterPipe(q: QuarterPipe): { piece: Piece; coping: Grindable; height: number; lipDist: number } {
  const top = (q.topDeg * Math.PI) / 180, uMax = q.radius * Math.sin(top), H = q.radius * (1 - Math.cos(top));
  const deck = q.deck ?? 0.8, kind = q.kind ?? 'concrete', vert = q.vert ?? true;
  const piece: Piece = (x, z) => {
    const [lx, lz] = local(q.x, q.z, q.yaw, x, z);
    if (Math.abs(lx) > q.width / 2 || lz < 0 || lz > uMax + deck) return null;
    if (lz > uMax) return sampleOf(q.yaw, H, 0, 1, 0, kind, q.id, null);
    const t = tranny(lz, q.radius);
    return sampleOf(q.yaw, t.y, 0, 1, -t.slope, kind, q.id, lz >= uMax - LIP_STRIP ? { lipYaw: q.yaw, vert } : null);
  };
  const a = world(q.x, q.z, q.yaw, -q.width / 2, uMax), b = world(q.x, q.z, q.yaw, q.width / 2, uMax);
  const coping: Grindable = { id: `${q.id}-coping`, name: 'Coping', kind: 'coping', points: [[a[0], H, a[1]], [b[0], H, b[1]]], faceYaw: q.yaw + Math.PI };
  return { piece, coping, height: H, lipDist: uMax };
}

/** Two quarterpipes facing each other across a flat bottom of `flat` (centre at x,z; walls along ±lz). */
export function miniRamp(m: { id: string; x: number; z: number; yaw: number; flat: number; radius: number; topDeg: number; width: number; deck?: number; kind?: SurfaceKind; vert?: boolean }) {
  const [ax, az] = world(m.x, m.z, m.yaw, 0, m.flat / 2), [bx, bz] = world(m.x, m.z, m.yaw, 0, -m.flat / 2);
  const front = quarterPipe({ ...m, x: ax, z: az, yaw: m.yaw });
  const back = quarterPipe({ ...m, x: bx, z: bz, yaw: m.yaw + Math.PI });
  const kind = m.kind ?? 'concrete';
  const piece: Piece = (x, z) => {
    const [lx, lz] = local(m.x, m.z, m.yaw, x, z);
    if (Math.abs(lx) > m.width / 2) return null;
    if (Math.abs(lz) <= m.flat / 2) return { y: 0, nx: 0, ny: 1, nz: 0, kind, feature: m.id, lip: null };
    return lz > 0 ? front.piece(x, z) : back.piece(x, z);
  };
  return { piece, copings: [front.coping, back.coping], height: front.height };
}

/** Kicker rising along +lz to a lip at `length`, circular profile ending at `lipDeg`. */
export function kicker(k: { id: string; x: number; z: number; yaw: number; length: number; lipDeg: number; width: number; kind?: SurfaceKind }) {
  const th = (k.lipDeg * Math.PI) / 180, R = k.length / Math.sin(th), kind = k.kind ?? 'wood';
  const piece: Piece = (x, z) => {
    const [lx, lz] = local(k.x, k.z, k.yaw, x, z);
    if (Math.abs(lx) > k.width / 2 || lz < 0 || lz > k.length) return null;
    const t = tranny(lz, R);
    return sampleOf(k.yaw, t.y, 0, 1, -t.slope, kind, k.id, lz >= k.length - LIP_STRIP ? { lipYaw: k.yaw, vert: false } : null);
  };
  return { piece, height: R * (1 - Math.cos(th)) };
}

/** A round bowl: flat bottom radius r0, transition radius R to `topDeg`, deck ring outside. */
export function bowl(b: { id: string; x: number; z: number; r0: number; radius: number; topDeg: number; deck?: number; kind?: SurfaceKind; copingSegments?: number }) {
  const top = (b.topDeg * Math.PI) / 180, uMax = b.radius * Math.sin(top), H = b.radius * (1 - Math.cos(top));
  const deck = b.deck ?? 1, kind = b.kind ?? 'concrete', vert = true;
  const piece: Piece = (x, z) => {
    const dx = x - b.x, dz = z - b.z, r = Math.hypot(dx, dz);
    if (r > b.r0 + uMax + deck) return null;
    if (r <= b.r0) return { y: 0, nx: 0, ny: 1, nz: 0, kind, feature: b.id, lip: null };
    const u = r - b.r0, ox = dx / r, oz = dz / r, yaw = Math.atan2(ox, oz);
    if (u > uMax) return { y: H, nx: 0, ny: 1, nz: 0, kind, feature: b.id, lip: null };
    const t = tranny(u, b.radius), l = Math.hypot(t.slope, 1);
    return { y: t.y, nx: (-t.slope * ox) / l, ny: 1 / l, nz: (-t.slope * oz) / l, kind, feature: b.id, lip: u >= uMax - LIP_STRIP ? { lipYaw: yaw, vert } : null };
  };
  const n = b.copingSegments ?? 48, rr = b.r0 + uMax, pts: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push([b.x + Math.sin(a) * rr, H, b.z + Math.cos(a) * rr]); }
  const coping: Grindable = { id: `${b.id}-coping`, name: 'Bowl coping', kind: 'coping', points: pts, faceYaw: null };
  return { piece, coping, height: H };
}

/** An oriented flat-topped block (ledge, manual pad, box). Its sides are sheer. */
export function block(o: { id: string; x: number; z: number; yaw: number; halfX: number; halfZ: number; h: number; kind?: SurfaceKind }): Piece {
  const kind = o.kind ?? 'concrete';
  return (x, z) => {
    const [lx, lz] = local(o.x, o.z, o.yaw, x, z);
    if (Math.abs(lx) > o.halfX || Math.abs(lz) > o.halfZ) return null;
    return { y: o.h, nx: 0, ny: 1, nz: 0, kind, feature: o.id, lip: null };
  };
}

/** Top edge of a block on its −lx side as a ledge grindable, face looking along −lx. */
export function blockEdge(o: { id: string; x: number; z: number; yaw: number; halfX: number; halfZ: number; h: number }, side: -1 | 1 = -1): Grindable {
  const a = world(o.x, o.z, o.yaw, side * o.halfX, -o.halfZ), b = world(o.x, o.z, o.yaw, side * o.halfX, o.halfZ);
  // Local ±lx in world: (cos yaw, −sin yaw)·side → yaw of that direction.
  const faceYaw = Math.atan2(Math.cos(o.yaw) * side, -Math.sin(o.yaw) * side);
  return { id: `${o.id}-edge`, name: 'Ledge', kind: 'ledge', points: [[a[0], o.h, a[1]], [b[0], o.h, b[1]]], faceYaw };
}

/** Stairs going DOWN along +lz: top landing for lz < 0, then `steps` treads. */
export function stairs(s: { id: string; x: number; z: number; yaw: number; steps: number; rise: number; tread: number; width: number; landing?: number }): Piece {
  const landing = s.landing ?? 3;
  return (x, z) => {
    const [lx, lz] = local(s.x, s.z, s.yaw, x, z);
    if (Math.abs(lx) > s.width / 2 || lz < -landing || lz >= s.steps * s.tread) return null;
    const k = lz < 0 ? -1 : Math.floor(lz / s.tread);
    return { y: (s.steps - 1 - k) * s.rise, nx: 0, ny: 1, nz: 0, kind: 'concrete', feature: s.id, lip: null };
  };
}

export function makeField(opts: { pieces?: readonly Piece[]; grindables?: readonly Grindable[]; solids?: readonly SkateSolid[]; spots?: readonly SkateSpot[]; ground?: SurfaceKind; groundY?: (x: number, z: number) => number }): SkateField {
  const pieces = opts.pieces ?? [], kind = opts.ground ?? 'concrete';
  return {
    sample(x, z) {
      for (const p of pieces) { const s = p(x, z); if (s) return s; }
      return { y: opts.groundY ? opts.groundY(x, z) : 0, nx: 0, ny: 1, nz: 0, kind, feature: null, lip: null };
    },
    grindables: opts.grindables ?? [],
    solids: opts.solids ?? [],
    spots: opts.spots ?? [],
  };
}
