/**
 * Tideline Skate Club v2 · world — the painter's kit behind `meshes.ts`.
 *
 * Plain-array primitives (no DOM, no materials) that write into the park's
 * per-material buckets: flat-shaded card triangles with a touch of grain,
 * per-vertex colour gradients for cut sides (the stacked-shadow read of a
 * tunnel book), ink lines that carry their own colour (ink for cut edges,
 * pencil for slab joints, chalk for highlights), soft alpha "shade" quads for
 * contact shadows, stencil decals into a 3×3 atlas, tubes and posts.
 */
import * as THREE from 'three';
import { planeAt, type Plane } from './features.ts';
import { frameToWorld, type Frame } from './profiles.ts';

export type Tier = 'full' | 'lite';
export type Bucket = { positions: number[]; normals: number[]; colors: number[]; uvs: number[] };
/** Line segments with a colour per vertex (ink, pencil, chalk share one draw). */
export type LineBucket = { positions: number[]; colors: number[] };
/** Unlit, alpha-blended quads (RGBA per vertex): contact shadows, polish, rail shadows. */
export type ShadeBucket = { positions: number[]; colors: number[] };
export type RenderCheck = { id: string; x: number; y: number; z: number };
/** A non-colliding dressing footprint (world), for tests and for integration's collider list. */
export type DressingFootprint = {
  id: string; spot: string; x: number; z: number;
  /** Bounding radius; `box` (when given) is the tighter oriented footprint, in the frameToWorld yaw convention. */
  r: number; top: number;
  box?: { yaw: number; hx: number; hz: number };
};
export type ParkMeshData = {
  /** Pads and aprons: receive shadows only. */
  pad: Bucket;
  /** Every feature body (card and ply) and the dressing round the edges: casts and receives. */
  card: Bucket;
  /** Coping, rails, posts. */
  steel: Bucket;
  /** Painted strips and markings (drawn over tops). */
  paint: Bucket;
  wax: Bucket;
  /** Stencils: uv into a 3×3 atlas (see `ICON`). */
  decals: Bucket;
  /** Paper lanterns: unlit, warm. */
  glow: Bucket;
  /** Contact shadows and polish: unlit, alpha per vertex. */
  shade: ShadeBucket;
  ink: LineBucket;
  /** Top-surface vertices the renderer placed, per feature/pad id, for render == physics tests. */
  checks: RenderCheck[];
  /** Where parkScene hangs each spot's sign (world), facing `yaw`. */
  signs: { id: string; name: string; x: number; y: number; z: number; yaw: number; w: number; h: number }[];
  /** Decorative pieces standing off the pads (hedges, fences, lamps, bleachers…): none collide. */
  dressing: DressingFootprint[];
};

export const bucket = (): Bucket => ({ positions: [], normals: [], colors: [], uvs: [] });
export const emptyMeshData = (): ParkMeshData => ({
  pad: bucket(), card: bucket(), steel: bucket(), paint: bucket(), wax: bucket(), decals: bucket(), glow: bucket(),
  shade: { positions: [], colors: [] }, ink: { positions: [], colors: [] }, checks: [], signs: [], dressing: [],
});

export type V3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];

/** Stencil atlas icons (3×3; `parkScene.ts` draws them). */
export const ICON = { lantern: 0, hearth: 1, paw: 2, wave: 3, coin: 4, shell: 5, star: 6, arrow: 7, apple: 8 } as const;
export const ATLAS_GRID = 3;

export const UV_SCALE = 1 / 2.5;
export const INK_LIFT = 0.004;

/** Deterministic grain in [−1, 1]. */
export const grain = (x: number, z: number): number => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
/** Deterministic hash in [0, 1) of two integers (slab tones, scatter). */
export const hash2 = (i: number, j: number): number => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

export const rgb = (hex: string): RGB => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const lift = (p: V3, dy: number): V3 => [p[0], p[1] + dy, p[2]];

export type Kit = ReturnType<typeof makeKit>;

/** Primitives bound to one `ParkMeshData`. `inkColour` is the default line colour. */
export function makeKit(out: ParkMeshData, inkColour: RGB) {
  function tri(b: Bucket, a: V3, c1: V3, c2: V3, color: RGB, grainAmp = 0.035, vc?: readonly [RGB, RGB, RGB]): void {
    /* c1, c2 and vc may be swapped below */
    const ux = c1[0] - a[0], uy = c1[1] - a[1], uz = c1[2] - a[2], vx = c2[0] - a[0], vy = c2[1] - a[1], vz = c2[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    // Tops always face up. Flip the winding with the normal, so a DoubleSide, smooth-shaded
    // material (paint, decals) sees a front face from above and does not turn the normal down.
    if (ny < -0.2) { nx = -nx; ny = -ny; nz = -nz; const t = c1; c1 = c2; c2 = t; if (vc) vc = [vc[0], vc[2], vc[1]]; }
    const cx = (a[0] + c1[0] + c2[0]) / 3, cz = (a[2] + c1[2] + c2[2]) / 3, g = 1 + grainAmp * grain(cx, cz);
    const top = Math.abs(ny) > 0.5, alongZ = Math.abs(nx) > Math.abs(nz);
    const P = b.positions, N = b.normals, Co = b.colors, U = b.uvs;
    const ca = vc ? vc[0] : color, cb = vc ? vc[1] : color, cc = vc ? vc[2] : color;
    P.push(a[0], a[1], a[2], c1[0], c1[1], c1[2], c2[0], c2[1], c2[2]);
    N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    Co.push(ca[0] * g, ca[1] * g, ca[2] * g, cb[0] * g, cb[1] * g, cb[2] * g, cc[0] * g, cc[1] * g, cc[2] * g);
    if (top) U.push(a[0] * UV_SCALE, a[2] * UV_SCALE, c1[0] * UV_SCALE, c1[2] * UV_SCALE, c2[0] * UV_SCALE, c2[2] * UV_SCALE);
    else if (alongZ) U.push(a[2] * UV_SCALE, a[1] * UV_SCALE, c1[2] * UV_SCALE, c1[1] * UV_SCALE, c2[2] * UV_SCALE, c2[1] * UV_SCALE);
    else U.push(a[0] * UV_SCALE, a[1] * UV_SCALE, c1[0] * UV_SCALE, c1[1] * UV_SCALE, c2[0] * UV_SCALE, c2[1] * UV_SCALE);
  }
  const quad = (b: Bucket, p0: V3, p1: V3, p2: V3, p3: V3, color: RGB, grainAmp?: number) => { tri(b, p0, p1, p2, color, grainAmp); tri(b, p0, p2, p3, color, grainAmp); };
  /** A quad with a colour per corner (p0,p1 bottom → c0; p2,p3 top → c1 when used for cut sides). */
  const quadV = (b: Bucket, p0: V3, p1: V3, p2: V3, p3: V3, c0: RGB, c1: RGB, c2: RGB, c3: RGB, grainAmp?: number) => {
    tri(b, p0, p1, p2, c0, grainAmp, [c0, c1, c2]); tri(b, p0, p2, p3, c0, grainAmp, [c0, c2, c3]);
  };
  /** A vertical cut side from a bottom edge (a0→a1) to a top edge (b1→b0), darker at its foot. */
  const side = (b: Bucket, a0: V3, a1: V3, b1: V3, b0: V3, color: RGB, foot = 0.72) => {
    const f = shade(color, foot);
    quadV(b, a0, a1, b1, b0, f, f, color, color);
  };
  const line = (a: V3, b: V3, c: RGB = inkColour) => { out.ink.positions.push(a[0], a[1], a[2], b[0], b[1], b[2]); out.ink.colors.push(c[0], c[1], c[2], c[0], c[1], c[2]); };
  const W = (frame: Frame, plane: Plane, lx: number, lz: number, h: number): V3 => { const [x, z] = frameToWorld(frame, lx, lz); return [x, planeAt(plane, x, z) + h, z]; };
  const check = (id: string, p: V3) => { out.checks.push({ id, x: p[0], y: p[1], z: p[2] }); };

  /** One shade quad: p0,p1 carry alpha a0; p2,p3 carry a1 (RGB c). */
  function shadeQuad(p0: V3, p1: V3, p2: V3, p3: V3, c: RGB, a0: number, a1: number): void {
    const s = out.shade;
    const put = (p: V3, a: number) => { s.positions.push(p[0], p[1], p[2]); s.colors.push(c[0], c[1], c[2], a); };
    put(p0, a0); put(p1, a0); put(p2, a1); put(p0, a0); put(p2, a1); put(p3, a1);
  }

  /** A stencil quad centred at `c` spanning ±r·right and ±r·up. */
  function decal(c: V3, right: V3, up: V3, r: number, icon: number, liftBy: V3, color: RGB, normal?: V3): void {
    const g = 1 / ATLAS_GRID, u0 = (icon % ATLAS_GRID) * g, v0 = Math.floor(icon / ATLAS_GRID) * g;
    const p = (sx: number, sy: number): V3 => [c[0] + (right[0] * sx + up[0] * sy) * r + liftBy[0], c[1] + (right[1] * sx + up[1] * sy) * r + liftBy[1], c[2] + (right[2] * sx + up[2] * sy) * r + liftBy[2]];
    const q = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)] as const, uv = [[u0, v0], [u0 + g, v0], [u0 + g, v0 + g], [u0, v0 + g]] as const;
    // Face normal: the one given, else up × right. Wind the triangles to match it (a lit front face).
    let nx = normal ? normal[0] : up[1] * right[2] - up[2] * right[1], ny = normal ? normal[1] : up[2] * right[0] - up[0] * right[2], nz = normal ? normal[2] : up[0] * right[1] - up[1] * right[0];
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const wx = right[1] * up[2] - right[2] * up[1], wy = right[2] * up[0] - right[0] * up[2], wz = right[0] * up[1] - right[1] * up[0];
    const order = wx * nx + wy * ny + wz * nz >= 0 ? [[0, 1, 2], [0, 2, 3]] as const : [[0, 2, 1], [0, 3, 2]] as const;
    for (const [i, j, k] of order) for (const n of [i, j, k]) {
      const pp = q[n]!, t = uv[n]!;
      out.decals.positions.push(pp[0], pp[1], pp[2]); out.decals.normals.push(nx, ny, nz); out.decals.colors.push(color[0], color[1], color[2]); out.decals.uvs.push(t[0], t[1]);
    }
  }
  /** A stencil lying on a plane at local (lx, lz, h), turned by `rot` from the frame. */
  function topStencil(frame: Frame, plane: Plane, lx: number, lz: number, h: number, r: number, icon: number, color: RGB, rot = 0): void {
    const p = W(frame, plane, lx, lz, h), y = frame.yaw + rot, c = Math.cos(y), sn = Math.sin(y);
    const right: V3 = [c, plane.gx * c - plane.gz * sn, -sn], up: V3 = [sn, plane.gx * sn + plane.gz * c, c];
    decal(p, right, up, r, icon, [0, 0.003, 0], color);
  }
  /** A thin strip lying on a plane between two local points. */
  function strip(b: Bucket, frame: Frame, plane: Plane, a: readonly [number, number], c: readonly [number, number], h: number, width: number, color: RGB, liftBy = 0.0025): void {
    const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * width / 2, nz = dx / l * width / 2;
    const p = (x: number, z: number): V3 => lift(W(frame, plane, x, z, h), liftBy);
    quad(b, p(a[0] + nx, a[1] + nz), p(a[0] - nx, a[1] - nz), p(c[0] - nx, c[1] - nz), p(c[0] + nx, c[1] + nz), color, 0.01);
  }
  /** A painted ring (annulus) on a plane, centred at local (lx, lz). */
  function ring(b: Bucket, frame: Frame, plane: Plane, lx: number, lz: number, r: number, width: number, color: RGB, seg = 40, from = 0, to = Math.PI * 2): void {
    for (let i = 0; i < seg; i++) {
      const a0 = from + (to - from) * i / seg, a1 = from + (to - from) * (i + 1) / seg;
      const P = (a: number, rr: number) => lift(W(frame, plane, lx + Math.cos(a) * rr, lz + Math.sin(a) * rr, 0), 0.0025);
      quad(b, P(a0, r - width / 2), P(a1, r - width / 2), P(a1, r + width / 2), P(a0, r + width / 2), color, 0.01);
    }
  }

  function tube(b: Bucket, pts: readonly V3[], radius: number, color: RGB, sides: number): void {
    if (pts.length < 2) return;
    const rings: V3[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, prev = pts[Math.max(0, i - 1)]!, next = pts[Math.min(pts.length - 1, i + 1)]!;
      let tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let sx = -tz, sy = 0, sz = tx;
      const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      const ux = sy * tz - sz * ty, uy = sz * tx - sx * tz, uz = sx * ty - sy * tx;
      const r: V3[] = [];
      for (let k = 0; k < sides; k++) { const a = (k / sides) * Math.PI * 2, cs = Math.cos(a) * radius, sn = Math.sin(a) * radius; r.push([p[0] + sx * cs + ux * sn, p[1] + sy * cs + uy * sn, p[2] + sz * cs + uz * sn]); }
      rings.push(r);
    }
    for (let i = 1; i < rings.length; i++) for (let k = 0; k < sides; k++) {
      const a = rings[i - 1]![k]!, b2 = rings[i - 1]![(k + 1) % sides]!, c = rings[i]![(k + 1) % sides]!, d = rings[i]![k]!;
      quad(b, a, b2, c, d, color, 0.01);
    }
  }
  function cylinder(b: Bucket, x: number, z: number, y0: number, y1: number, r: number, color: RGB, sides = 6, cap = true): void {
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
      const p0: V3 = [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], p1: V3 = [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r];
      quad(b, p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], color, 0.01);
      if (cap) tri(b, [x, y1, z], [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], color, 0.01);
    }
  }
  /**
   * A world box turned by `yaw` about y (centre x,z; half extents hx, hz; y0..y1),
   * top `top`, sides `side` darkening to the foot, top edges inked when `ink`.
   */
  function box(b: Bucket, x: number, z: number, yaw: number, hx: number, hz: number, y0: number, y1: number, top: RGB, sideC: RGB, ink: RGB | null = inkColour, foot = 0.75): void {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (lx: number, lz: number, y: number): V3 => [x + lx * c + lz * s, y, z + lz * c - lx * s];
    const t = [P(-hx, -hz, y1), P(hx, -hz, y1), P(hx, hz, y1), P(-hx, hz, y1)], d = [P(-hx, -hz, y0), P(hx, -hz, y0), P(hx, hz, y0), P(-hx, hz, y0)];
    quad(b, t[0]!, t[1]!, t[2]!, t[3]!, top);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; side(b, d[i]!, d[j]!, t[j]!, t[i]!, sideC, foot); }
    if (ink) for (let i = 0; i < 4; i++) line(lift(t[i]!, INK_LIFT), lift(t[(i + 1) % 4]!, INK_LIFT), ink);
  }
  /**
   * A flat cut-paper panel standing on the ground: a polygon outline in the
   * panel's own (u along, v up) coordinates, placed from world a to world b
   * (the panel's baseline), each end at its own ground height. Inked round.
   */
  function flat(b: Bucket, outline: readonly (readonly [number, number])[], a: V3, bEnd: V3, color: RGB, ink: RGB | null = inkColour, inkBase = false): void {
    const len = Math.hypot(bEnd[0] - a[0], bEnd[2] - a[2]) || 1;
    const P = (u: number, v: number): V3 => { const t = u / len; return [a[0] + (bEnd[0] - a[0]) * t, a[1] + (bEnd[1] - a[1]) * t + v, a[2] + (bEnd[2] - a[2]) * t]; };
    const contour = outline.map(([u, v]) => new THREE.Vector2(u, v));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const pts = outline.map(([u, v]) => P(u, v));
    for (const f of faces) tri(b, pts[f[0]!]!, pts[f[1]!]!, pts[f[2]!]!, color, 0.02);
    if (ink) for (let i = 0; i < pts.length; i++) {
      const p = outline[i]!, q = outline[(i + 1) % outline.length]!;
      if (!inkBase && p[1] < 1e-6 && q[1] < 1e-6) continue;
      line(pts[i]!, pts[(i + 1) % pts.length]!, ink);
    }
  }

  return { tri, quad, quadV, side, line, W, check, shadeQuad, decal, topStencil, strip, ring, tube, cylinder, box, flat };
}

/* ---------------------------------------------------------------- 2D helpers */

export function uniq(a: number[]): number[] {
  const s = [...a].sort((p, q) => p - q), o: number[] = [];
  for (const v of s) if (!o.length || Math.abs(v - o[o.length - 1]!) > 1e-6) o.push(v);
  return o;
}

/** Signed area ×2 of a 2D loop (positive = counter-clockwise in (x, z)). */
export const loopArea = (loop: readonly (readonly [number, number])[]): number => {
  let s = 0; for (let i = 0; i < loop.length; i++) { const p = loop[i]!, q = loop[(i + 1) % loop.length]!; s += p[0] * q[1] - q[0] * p[1]; } return s;
};

/** Sutherland–Hodgman: clip a convex-or-not polygon by a CONVEX clip loop. */
export function clipConvex(poly: readonly (readonly [number, number])[], clip: readonly (readonly [number, number])[]): [number, number][] {
  const orient = loopArea(clip) >= 0 ? 1 : -1;
  let outP: [number, number][] = poly.map(p => [p[0], p[1]]);
  for (let i = 0; i < clip.length && outP.length; i++) {
    const a = clip[i]!, b = clip[(i + 1) % clip.length]!;
    const inside = (p: readonly [number, number]) => orient * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-12;
    const cut = (p: readonly [number, number], q: readonly [number, number]): [number, number] => {
      const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
      const t = d1 / (d1 - d2); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    const inp = outP; outP = [];
    for (let k = 0; k < inp.length; k++) {
      const p = inp[k]!, q = inp[(k + 1) % inp.length]!, pin = inside(p), qin = inside(q);
      if (pin) { outP.push(p); if (!qin) outP.push(cut(p, q)); }
      else if (qin) outP.push(cut(p, q));
    }
  }
  return outP;
}

/** Clip a segment to a CONVEX loop (Cyrus–Beck); null when it misses. */
export function clipSegment(a: readonly [number, number], b: readonly [number, number], clip: readonly (readonly [number, number])[]): [[number, number], [number, number]] | null {
  const orient = loopArea(clip) >= 0 ? 1 : -1;
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  for (let i = 0; i < clip.length; i++) {
    const p = clip[i]!, q = clip[(i + 1) % clip.length]!;
    // Inward normal of edge p→q.
    const nx = -(q[1] - p[1]) * orient, nz = (q[0] - p[0]) * orient;
    const num = nx * (a[0] - p[0]) + nz * (a[1] - p[1]), den = nx * dx + nz * dz;
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue; }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [[a[0] + dx * t0, a[1] + dz * t0], [a[0] + dx * t1, a[1] + dz * t1]];
}
