/**
 * SIM · pure geometry: angles, grindable polylines and push-out collision.
 * No three.js, no allocation in the per-step queries (results go into
 * caller-owned scratch objects).
 */
import type { Grindable, GrindableKind, SkateSolid } from '../contract.ts';
import type { Obstacle } from '../../body/obstacles.ts';

export const TAU = Math.PI * 2;
export const wrap = (a: number): number => {
  if (!Number.isFinite(a)) return 0;
  a = a % TAU;
  if (a > Math.PI) a -= TAU; else if (a <= -Math.PI) a += TAU;
  return a;
};
export const clamp = (n: number, a: number, b: number): number => (n < a ? a : n > b ? b : Number.isFinite(n) ? n : 0);
export const fin = (n: unknown, fallback = 0): number => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);
/** Exponential approach factor for a rate per second over dt. */
export const ease = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
export const approach = (v: number, target: number, maxStep: number): number =>
  v < target ? Math.min(target, v + maxStep) : Math.max(target, v - maxStep);

/* ────────────────────────────────────────────────────────── grind lines */

export type GrindLine = {
  id: string; name: string; kind: GrindableKind; faceYaw: number | null;
  n: number;
  px: Float64Array; py: Float64Array; pz: Float64Array;
  /** Cumulative 3D arc length at each point. */
  cum: Float64Array;
  total: number;
  closed: boolean;
  minX: number; maxX: number; minZ: number; maxZ: number;
};

export function buildLines(grindables: readonly Grindable[]): GrindLine[] {
  const out: GrindLine[] = [];
  for (const g of grindables) {
    const pts = (g.points ?? []).filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]));
    // Drop consecutive duplicates so every segment has length.
    const keep: (readonly [number, number, number])[] = [];
    for (const p of pts) {
      const q = keep[keep.length - 1];
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 1e-4) keep.push(p);
    }
    if (keep.length < 2) continue;
    const n = keep.length;
    const px = new Float64Array(n), py = new Float64Array(n), pz = new Float64Array(n), cum = new Float64Array(n);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = keep[i]!;
      px[i] = p[0]; py[i] = p[1]; pz[i] = p[2];
      if (i > 0) cum[i] = cum[i - 1]! + Math.hypot(p[0] - px[i - 1]!, p[1] - py[i - 1]!, p[2] - pz[i - 1]!);
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
    }
    const closed = n > 2 && Math.hypot(px[0]! - px[n - 1]!, py[0]! - py[n - 1]!, pz[0]! - pz[n - 1]!) < 0.05;
    out.push({ id: g.id, name: g.name, kind: g.kind, faceYaw: g.faceYaw ?? null, n, px, py, pz, cum, total: cum[n - 1]!, closed, minX, maxX, minZ, maxZ });
  }
  return out;
}

/** Scratch result for line queries. */
export type LinePoint = { seg: number; s: number; x: number; y: number; z: number; d2: number; tx: number; ty: number; tz: number };
export const linePoint = (): LinePoint => ({ seg: 0, s: 0, x: 0, y: 0, z: 0, d2: Infinity, tx: 0, ty: 0, tz: 1 });

function segTangent(L: GrindLine, i: number, out: LinePoint): void {
  const dx = L.px[i + 1]! - L.px[i]!, dy = L.py[i + 1]! - L.py[i]!, dz = L.pz[i + 1]! - L.pz[i]!;
  const len = Math.hypot(dx, dy, dz) || 1;
  out.tx = dx / len; out.ty = dy / len; out.tz = dz / len;
}

/** Nearest point on the line in the xz plane (y read off the line there). */
export function nearestXZ(L: GrindLine, x: number, z: number, out: LinePoint): LinePoint {
  out.d2 = Infinity;
  for (let i = 0; i < L.n - 1; i++) {
    const ax = L.px[i]!, az = L.pz[i]!, bx = L.px[i + 1]!, bz = L.pz[i + 1]!;
    const dx = bx - ax, dz = bz - az, sq = dx * dx + dz * dz;
    let t = sq > 1e-12 ? ((x - ax) * dx + (z - az) * dz) / sq : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cz = az + dz * t, d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    if (d2 < out.d2) {
      out.d2 = d2; out.seg = i; out.x = cx; out.z = cz; out.y = L.py[i]! + (L.py[i + 1]! - L.py[i]!) * t;
      out.s = L.cum[i]! + (L.cum[i + 1]! - L.cum[i]!) * t;
    }
  }
  segTangent(L, out.seg, out);
  return out;
}

/** Point at arc length s (clamped, or wrapped when the line is closed). */
export function pointAt(L: GrindLine, s: number, out: LinePoint): LinePoint {
  if (L.closed) { s = s % L.total; if (s < 0) s += L.total; }
  s = s < 0 ? 0 : s > L.total ? L.total : s;
  let i = 0;
  while (i < L.n - 2 && L.cum[i + 1]! < s) i++;
  const len = L.cum[i + 1]! - L.cum[i]!, t = len > 1e-9 ? (s - L.cum[i]!) / len : 0;
  out.seg = i; out.s = s;
  out.x = L.px[i]! + (L.px[i + 1]! - L.px[i]!) * t;
  out.y = L.py[i]! + (L.py[i + 1]! - L.py[i]!) * t;
  out.z = L.pz[i]! + (L.pz[i + 1]! - L.pz[i]!) * t;
  segTangent(L, i, out);
  return out;
}

/* ────────────────────────────────────────────────────────── collision */

/** `top` is the height of what was hit (Infinity for island obstacles, which have no top). */
export type Hit = { x: number; z: number; nx: number; nz: number; id: string | null; top: number };
export const hit = (): Hit => ({ x: 0, z: 0, nx: 0, nz: 0, id: null, top: Infinity });

function intoLocal(fx: number, fz: number, yaw: number, x: number, z: number, out: { lx: number; lz: number }): void {
  const c = Math.cos(yaw), s = Math.sin(yaw), dx = x - fx, dz = z - fz;
  out.lx = dx * c - dz * s; out.lz = dz * c + dx * s;
}
const LOCAL = { lx: 0, lz: 0 };

/**
 * Push a circle of `r` out of every island obstacle and every park solid
 * whose top is above the rider's feet. Same nearest-face rule as
 * `body/obstacles.ts` pushOut (a slide, never a bounce), but allocation-free,
 * height-aware for park solids, and it reports the push direction as a normal.
 */
export function pushOutAll(x: number, z: number, y: number, r: number, obstacles: readonly Obstacle[], solids: readonly SkateSolid[], out: Hit): Hit {
  let px = x, pz = z;
  out.id = null; out.top = Infinity;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (let k = 0; k < obstacles.length + solids.length; k++) {
      const o = (k < obstacles.length ? obstacles[k] : solids[k - obstacles.length])!;
      const top = k >= obstacles.length ? (o as SkateSolid).top : Infinity;
      if (y >= top - 0.03) continue;
      if (o.kind === 'circle') {
        const dx = px - o.x, dz = pz - o.z, reach = o.r + r, d = Math.hypot(dx, dz);
        if (d >= reach) continue;
        const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
        px = o.x + nx * reach; pz = o.z + nz * reach; out.id = o.id; out.top = top; moved = true;
      } else if (o.kind === 'obox') {
        intoLocal(o.x, o.z, o.yaw, px, pz, LOCAL);
        const hx = o.halfX + r, hz = o.halfZ + r;
        if (Math.abs(LOCAL.lx) >= hx || Math.abs(LOCAL.lz) >= hz) continue;
        const left = LOCAL.lx + hx, right = hx - LOCAL.lx, back = LOCAL.lz + hz, front = hz - LOCAL.lz;
        const least = Math.min(left, right, back, front);
        let lx = LOCAL.lx, lz = LOCAL.lz;
        if (least === left) lx = -hx; else if (least === right) lx = hx; else if (least === back) lz = -hz; else lz = hz;
        const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
        px = o.x + lx * c + lz * s; pz = o.z + lz * c - lx * s; out.id = o.id; out.top = top; moved = true;
      } else {
        const minX = o.minX - r, maxX = o.maxX + r, minZ = o.minZ - r, maxZ = o.maxZ + r;
        if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ) continue;
        const left = px - minX, right = maxX - px, back = pz - minZ, front = maxZ - pz;
        const least = Math.min(left, right, back, front);
        if (least === left) px = minX; else if (least === right) px = maxX; else if (least === back) pz = minZ; else pz = maxZ;
        out.id = o.id; out.top = top; moved = true;
      }
    }
    if (!moved) break;
  }
  const dx = px - x, dz = pz - z, d = Math.hypot(dx, dz);
  out.x = px; out.z = pz;
  if (d > 1e-9) { out.nx = dx / d; out.nz = dz / d; } else { out.nx = 0; out.nz = 0; }
  return out;
}
