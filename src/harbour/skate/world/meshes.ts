/**
 * Tideline Skate Club v2 · world — the park's geometry, as plain arrays.
 *
 * Built from the SAME shape instances `field.ts` rides on (`evalLocal`,
 * `planeAt`, the coping/rail polylines), so every top-surface vertex sits
 * exactly on `sample()`. No DOM, no materials: `parkScene.ts` turns these
 * buckets into a handful of merged meshes (one per material).
 *
 * Look: painted card. Flat-shaded strips (a transition is card folded in
 * facets), cut sides a shade darker, lips and stair nosings painted, wax on
 * ledge edges, ink lines on every cut edge, small original Hearth stencils
 * (lantern, hearth, kitty paw, wave) instead of graffiti.
 */
import * as THREE from 'three';
import { apronDrop, type SkateWorldField, type PadRuntime } from './field.ts';
import {
  BankShape, BowlShape, BoxShape, COPE_RADIUS, FunboxShape, HubbaShape, KickerShape, LIP_BAND, MiniShape, QuarterShape, RAIL_RADIUS, StairsShape,
  newHit, planeAt, type SurfaceShape, type Plane,
} from './features.ts';
import { arcHeight, frameToWorld, roundRectLoop, type Frame } from './profiles.ts';
import type { SkatePalette } from './palette.ts';

export type Tier = 'full' | 'lite';
export type Bucket = { positions: number[]; normals: number[]; colors: number[]; uvs: number[] };
export type LineBucket = { positions: number[] };
export type RenderCheck = { id: string; x: number; y: number; z: number };
export type ParkMeshData = {
  /** Pads and aprons: receive shadows only. */
  pad: Bucket;
  /** Every feature body (card and ply): casts and receives. */
  card: Bucket;
  /** Coping, rails, posts. */
  steel: Bucket;
  /** Painted strips and wax (drawn over tops). */
  paint: Bucket;
  wax: Bucket;
  /** Stencils: uv into a 2×2 atlas (lantern, hearth, paw, wave). */
  decals: Bucket;
  /** Paper lanterns: unlit, warm. */
  glow: Bucket;
  ink: LineBucket;
  /** Top-surface vertices the renderer placed, per feature/pad id, for render == physics tests. */
  checks: RenderCheck[];
  /** Where parkScene hangs each spot's sign (world), facing `yaw`. */
  signs: { id: string; name: string; x: number; y: number; z: number; yaw: number; w: number; h: number }[];
};

const bucket = (): Bucket => ({ positions: [], normals: [], colors: [], uvs: [] });
type V3 = readonly [number, number, number];
type RGB = readonly [number, number, number];

const UV_SCALE = 1 / 2.5;
const INK_LIFT = 0.004;

/** Deterministic grain in [−1, 1]. */
const grain = (x: number, z: number): number => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };

export function buildParkMeshData(field: SkateWorldField, palette: SkatePalette, tier: Tier = field.tier): ParkMeshData {
  const out: ParkMeshData = { pad: bucket(), card: bucket(), steel: bucket(), paint: bucket(), wax: bucket(), decals: bucket(), glow: bucket(), ink: { positions: [] }, checks: [], signs: [] };
  const full = tier === 'full';
  const ARC_SEG = full ? 14 : 7, CORNER_SEG = full ? 10 : 5, RAIL_SIDES = full ? 8 : 6;
  const col = (hex: string): RGB => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const C = {
    pad: col(palette.pad), apron: col(palette.apron), concrete: col(palette.concrete), bowl: col(palette.bowl), wall: col(palette.wall),
    wood: col(palette.wood), woodAlt: col(palette.woodAlt), woodDeck: col(palette.woodDeck), woodSide: col(palette.woodSide),
    steel: col(palette.steel), paint: col(palette.paint), curb: col(palette.curb), wax: col(palette.wax), stencil: col(palette.stencil),
    planter: col(palette.planter), soil: col(palette.soil), leaf: col(palette.leaf), bloom: col(palette.bloom), lantern: col(palette.lantern), post: col(palette.post),
  };
  const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

  /* ---------------------------------------------------------------- primitives */
  function tri(b: Bucket, a: V3, c1: V3, c2: V3, color: RGB, grainAmp = 0.035): void {
    const ux = c1[0] - a[0], uy = c1[1] - a[1], uz = c1[2] - a[2], vx = c2[0] - a[0], vy = c2[1] - a[1], vz = c2[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    if (ny < -0.2) { nx = -nx; ny = -ny; nz = -nz; }
    const cx = (a[0] + c1[0] + c2[0]) / 3, cz = (a[2] + c1[2] + c2[2]) / 3, g = 1 + grainAmp * grain(cx, cz);
    const top = Math.abs(ny) > 0.5;
    for (const p of [a, c1, c2]) {
      b.positions.push(p[0], p[1], p[2]); b.normals.push(nx, ny, nz); b.colors.push(color[0] * g, color[1] * g, color[2] * g);
      if (top) b.uvs.push(p[0] * UV_SCALE, p[2] * UV_SCALE);
      else { const along = Math.abs(nx) > Math.abs(nz) ? p[2] : p[0]; b.uvs.push(along * UV_SCALE, p[1] * UV_SCALE); }
    }
  }
  const quad = (b: Bucket, p0: V3, p1: V3, p2: V3, p3: V3, color: RGB, grainAmp?: number) => { tri(b, p0, p1, p2, color, grainAmp); tri(b, p0, p2, p3, color, grainAmp); };
  const line = (a: V3, b: V3) => { out.ink.positions.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
  const W = (frame: Frame, plane: Plane, lx: number, lz: number, h: number): V3 => { const [x, z] = frameToWorld(frame, lx, lz); return [x, planeAt(plane, x, z) + h, z]; };
  const check = (id: string, p: V3) => { out.checks.push({ id, x: p[0], y: p[1], z: p[2] }); };
  const hit = newHit();
  const hAt = (s: SurfaceShape, lx: number, lz: number): number => (s.evalLocal(lx, lz, hit) ? hit.h : 0);

  /** A box-ish body with flat top, cut sides and inked edges (local rect on a frame/plane). */
  function slab(frame: Frame, plane: Plane, x0: number, x1: number, z0: number, z1: number, h0: number, h1: number, top: RGB, side: RGB, id: string | null, ink = true): void {
    const P = (lx: number, lz: number, h: number) => W(frame, plane, lx, lz, h);
    const t00 = P(x0, z0, h1), t10 = P(x1, z0, h1), t11 = P(x1, z1, h1), t01 = P(x0, z1, h1);
    const b00 = P(x0, z0, h0), b10 = P(x1, z0, h0), b11 = P(x1, z1, h0), b01 = P(x0, z1, h0);
    quad(out.card, t00, t10, t11, t01, top);
    if (id) for (const p of [t00, t10, t11, t01]) check(id, p);
    quad(out.card, b00, b10, t10, t00, side); quad(out.card, b10, b11, t11, t10, side); quad(out.card, b11, b01, t01, t11, side); quad(out.card, b01, b00, t00, t01, side);
    if (ink) { const up = (p: V3): V3 => [p[0], p[1] + INK_LIFT, p[2]]; line(up(t00), up(t10)); line(up(t10), up(t11)); line(up(t11), up(t01)); line(up(t01), up(t00)); }
  }

  /** Top surface of a rect-footprint shape over a breakpoint grid; one colour per cell (crisp painted bands). */
  function surf(s: SurfaceShape, xs: number[], zs: number[], color: (lx: number, lz: number, h: number) => RGB, diag?: (lx: number, lz: number) => boolean): void {
    const P = (lx: number, lz: number) => W(s.frame, s.plane, lx, lz, hAt(s, lx, lz));
    for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
      const x0 = xs[i - 1]!, x1 = xs[i]!, z0 = zs[j - 1]!, z1 = zs[j]!;
      const a = P(x0, z0), b = P(x1, z0), c = P(x1, z1), d = P(x0, z1);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, mh = hAt(s, mx, mz);
      const cc = color(mx, mz, mh);
      if (diag && diag(mx, mz)) { tri(out.card, a, b, c, cc); tri(out.card, a, c, d, cc); }
      else { tri(out.card, a, b, d, cc); tri(out.card, b, c, d, cc); }
      for (const p of [a, b, c, d]) check(s.id, p);
    }
  }
  /** Cut side of a shape along a local edge polyline, from its top down to the pad plane; inked along the top. */
  function curtain(s: SurfaceShape, pts: [number, number][], color: RGB, inkTop = true): void {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1]!, [bx, bz] = pts[i]!;
      const ha = hAt(s, ax, az), hb = hAt(s, bx, bz);
      if (ha < 1e-4 && hb < 1e-4) continue;
      const ta = W(s.frame, s.plane, ax, az, ha), tb = W(s.frame, s.plane, bx, bz, hb), ba = W(s.frame, s.plane, ax, az, 0), bb = W(s.frame, s.plane, bx, bz, 0);
      quad(out.card, ba, bb, tb, ta, color);
      if (inkTop) line([ta[0], ta[1] + INK_LIFT, ta[2]], [tb[0], tb[1] + INK_LIFT, tb[2]]);
    }
  }
  const rectEdges = (s: SurfaceShape, xs: number[], zs: number[]) => ({
    nz: xs.map(x => [x, s.minZ] as [number, number]), pz: xs.map(x => [x, s.maxZ] as [number, number]),
    nx: zs.map(z => [s.minX, z] as [number, number]), px: zs.map(z => [s.maxX, z] as [number, number]),
  });
  const corners = (s: SurfaceShape) => { for (const [lx, lz] of [[s.minX, s.minZ], [s.maxX, s.minZ], [s.maxX, s.maxZ], [s.minX, s.maxZ]] as const) { const h = hAt(s, lx, lz); if (h > 0.02) line(W(s.frame, s.plane, lx, lz, h + INK_LIFT), W(s.frame, s.plane, lx, lz, 0)); } };
  const arcStops = (T: number, n: number): number[] => { const a: number[] = []; for (let i = 0; i <= n; i++) a.push(T * Math.sin((i / n) * Math.PI / 2)); a.push(T - LIP_BAND); return uniq(a); };
  const bankStops = (run: number, f: number): number[] => uniq([0, f / 2, f, run / 2, run - f, run - f / 2, run]);
  const across = (min: number, max: number) => { const n = Math.max(1, Math.round((max - min) / 1.2)); return Array.from({ length: n + 1 }, (_, i) => min + (max - min) * i / n); };

  /* ---------------------------------------------------------------- decals */
  /** A stencil quad centred at `c` spanning ±r·right and ±r·up; icon 0 lantern, 1 hearth, 2 paw, 3 wave. */
  function decal(c: V3, right: V3, up: V3, r: number, icon: number, lift: V3): void {
    const u0 = (icon % 2) * 0.5, v0 = Math.floor(icon / 2) * 0.5;
    const p = (sx: number, sy: number): V3 => [c[0] + (right[0] * sx + up[0] * sy) * r + lift[0], c[1] + (right[1] * sx + up[1] * sy) * r + lift[1], c[2] + (right[2] * sx + up[2] * sy) * r + lift[2]];
    const q = [p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)] as const, uv = [[u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v0 + 0.5], [u0, v0 + 0.5]] as const;
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]] as const) for (const n of [i, j, k]) {
      const pp = q[n]!, t = uv[n]!;
      out.decals.positions.push(pp[0], pp[1], pp[2]); out.decals.normals.push(0, 1, 0); out.decals.colors.push(C.stencil[0], C.stencil[1], C.stencil[2]); out.decals.uvs.push(t[0], t[1]);
    }
  }
  /** Stencil on a shape's side wall: side '+x'|'-x'|'+z'|'-z', `t` 0..1 along it, at height `h`. */
  function wallStencil(s: SurfaceShape, side: '+x' | '-x' | '+z' | '-z', t: number, h: number, r: number, icon: number): void {
    const c = Math.cos(s.frame.yaw), sn = Math.sin(s.frame.yaw);
    const ex: V3 = [c, 0, -sn], ez: V3 = [sn, 0, c]; // local +lx and +lz in world
    let lx = 0, lz = 0, n: V3, right: V3;
    if (side === '+x') { lx = s.maxX; lz = s.minZ + (s.maxZ - s.minZ) * t; n = ex; right = [-ez[0], 0, -ez[2]]; }
    else if (side === '-x') { lx = s.minX; lz = s.minZ + (s.maxZ - s.minZ) * t; n = [-ex[0], 0, -ex[2]]; right = ez; }
    else if (side === '+z') { lz = s.maxZ; lx = s.minX + (s.maxX - s.minX) * t; n = ez; right = ex; }
    else { lz = s.minZ; lx = s.minX + (s.maxX - s.minX) * t; n = [-ez[0], 0, -ez[2]]; right = [-ex[0], 0, -ex[2]]; }
    const p = W(s.frame, s.plane, lx, lz, h);
    decal(p, right, [0, 1, 0], r, icon, [n[0] * 0.006, 0, n[2] * 0.006]);
  }
  function topStencil(frame: Frame, plane: Plane, lx: number, lz: number, h: number, r: number, icon: number, rot = 0): void {
    const p = W(frame, plane, lx, lz, h), y = frame.yaw + rot, c = Math.cos(y), sn = Math.sin(y);
    // Tilt with the plane so the stencil lies on it.
    const right: V3 = [c, plane.gx * c - plane.gz * sn, -sn], up: V3 = [sn, plane.gx * sn + plane.gz * c, c];
    decal(p, right, up, r, icon, [0, 0.003, 0]);
  }
  /** A thin painted/wax strip lying on a top surface between two local points. */
  function strip(b: Bucket, frame: Frame, plane: Plane, a: [number, number], c: [number, number], h: number, width: number, color: RGB, lift = 0.0025): void {
    const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * width / 2, nz = dx / l * width / 2;
    const p = (x: number, z: number): V3 => { const w = W(frame, plane, x, z, h); return [w[0], w[1] + lift, w[2]]; };
    quad(b, p(a[0] + nx, a[1] + nz), p(a[0] - nx, a[1] - nz), p(c[0] - nx, c[1] - nz), p(c[0] + nx, c[1] + nz), color, 0.01);
  }

  /* ---------------------------------------------------------------- tubes */
  function tube(b: Bucket, pts: readonly V3[], radius: number, color: RGB, sides = RAIL_SIDES): void {
    if (pts.length < 2) return;
    const rings: V3[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, prev = pts[Math.max(0, i - 1)]!, next = pts[Math.min(pts.length - 1, i + 1)]!;
      let tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // Frame: side = t × up, up' = side × t.
      let sx = ty * 0 - tz * 1, sy = tz * 0 - tx * 0, sz = tx * 1 - ty * 0;
      const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      const ux = sy * tz - sz * ty, uy = sz * tx - sx * tz, uz = sx * ty - sy * tx;
      const ring: V3[] = [];
      for (let k = 0; k < sides; k++) { const a = (k / sides) * Math.PI * 2, cs = Math.cos(a) * radius, sn = Math.sin(a) * radius; ring.push([p[0] + sx * cs + ux * sn, p[1] + sy * cs + uy * sn, p[2] + sz * cs + uz * sn]); }
      rings.push(ring);
    }
    for (let i = 1; i < rings.length; i++) for (let k = 0; k < sides; k++) {
      const a = rings[i - 1]![k]!, b2 = rings[i - 1]![(k + 1) % sides]!, c = rings[i]![(k + 1) % sides]!, d = rings[i]![k]!;
      quad(b, a, b2, c, d, color, 0.01);
    }
  }
  function cylinder(b: Bucket, x: number, z: number, y0: number, y1: number, r: number, color: RGB, sides = 6): void {
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
      const p0: V3 = [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], p1: V3 = [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r];
      quad(b, p0, p1, [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], color, 0.01);
      tri(b, [x, y1, z], [p1[0], y1, p1[2]], [p0[0], y1, p0[2]], color, 0.01);
    }
  }

  /* ---------------------------------------------------------------- pads */
  function pad(p: PadRuntime): void {
    const f = p.frame, pl = p.plane, [hx, hz] = p.half, r = p.corner;
    const loop = closedLoop(hx, hz, r, CORNER_SEG);
    const centre = W(f, pl, 0, 0, 0);
    // Top: a fan, plus a few inner rings so the grain and light have something to hold.
    const rings = [0.25, 0.55, 0.8, 1];
    let prev: V3[] | null = null;
    for (const k of rings) {
      const ring = loop.map(([lx, lz]) => W(f, pl, lx * k, lz * k, 0));
      if (!prev) for (let i = 0; i < ring.length; i++) tri(out.pad, centre, ring[i]!, ring[(i + 1) % ring.length]!, C.pad);
      else for (let i = 0; i < ring.length; i++) quad(out.pad, prev[i]!, prev[(i + 1) % ring.length]!, ring[(i + 1) % ring.length]!, ring[i]!, C.pad);
      prev = ring;
    }
    for (const q of prev!) check(p.id, q);
    // Apron rings: plane minus the apron drop; parts below the lawn stay hidden under it.
    if (p.reach > 0.06) {
      const steps = [0.1, 0.2, 0.4, 0.7, 1.0, 1.4, 1.9, 2.5, 3.2, 4.0].filter(e => e <= p.reach + 0.6);
      if (steps[steps.length - 1]! < p.reach) steps.push(p.reach);
      let inner = loop.map(([lx, lz]) => W(f, pl, lx, lz, 0)), innerE = 0;
      for (const e of steps) {
        const ringL = closedLoop(hx + e, hz + e, r + e, CORNER_SEG), drop = apronDrop(e);
        const ring = ringL.map(([lx, lz]) => W(f, pl, lx, lz, -drop));
        for (let i = 0; i < ring.length; i++) quad(out.pad, inner[i]!, inner[(i + 1) % ring.length]!, ring[(i + 1) % ring.length]!, ring[i]!, shade(C.apron, 1 - 0.08 * Math.min(1, (innerE + e) / 3)));
        for (const q of ring) if (q[1] >= field.ground(q[0], q[2]) + 1e-3) check(`${p.id}-apron`, q);
        inner = ring; innerE = e;
      }
    }
    // The pad's cut edge, in ink.
    const edge = loop.map(([lx, lz]) => W(f, pl, lx, lz, INK_LIFT));
    for (let i = 0; i < edge.length; i++) line(edge[i]!, edge[(i + 1) % edge.length]!);
  }

  /* ---------------------------------------------------------------- features */
  const woodFor = (s: SurfaceShape) => (s.def.kind === 'wood' || s.def.type === 'quarter' || s.def.type === 'mini' || s.def.type === 'kicker');
  let woodIndex = 0;
  function shape(s: SurfaceShape): void {
    const wood = woodFor(s), top = wood ? (woodIndex++ % 2 === 0 ? C.wood : C.woodAlt) : C.concrete, side = wood ? C.woodSide : C.wall, deck = wood ? C.woodDeck : C.concrete;
    if (s instanceof QuarterShape) {
      const a = s.arc, xs = across(s.minX, s.maxX), zs = uniq([...arcStops(a.T, ARC_SEG), a.T, s.maxZ]);
      surf(s, xs, zs, (_x, lz) => (lz > a.T ? deck : lz > a.T - LIP_BAND ? C.paint : top));
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, side); curtain(s, e.px, side); if (s.def.deck > 0) { curtain(s, e.pz, side); corners(s); }
      lineAt(s, a.T - LIP_BAND); lineAt(s, a.T); lineAt(s, 0);
      if (s.def.height > 1.5) wallStencil(s, '+z', 0.5, a.H * 0.6, 0.45, 1);
    } else if (s instanceof MiniShape) {
      const a = s.arc, F = s.def.flat / 2, st = arcStops(a.T, ARC_SEG);
      const zs = uniq([s.minZ, ...st.map(t => -(F + t)).reverse(), -F, F, ...st.map(t => F + t), s.maxZ].sort((p, q) => p - q));
      const xs = across(s.minX, s.maxX);
      surf(s, xs, zs, (_x, lz) => { const d = Math.abs(lz) - F; return d > a.T ? deck : d > a.T - LIP_BAND ? C.paint : top; });
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, side); curtain(s, e.px, side); curtain(s, e.nz, side); curtain(s, e.pz, side); corners(s);
      lineAt(s, -F); lineAt(s, F);
      wallStencil(s, '-x', 0.5, a.H * 0.55, 0.32, 0); wallStencil(s, '+x', 0.5, a.H * 0.55, 0.32, 0);
    } else if (s instanceof KickerShape) {
      const a = s.arc, xs = across(s.minX, s.maxX), zs = uniq([...arcStops(a.T, ARC_SEG), a.T]);
      surf(s, xs, zs, (_x, lz) => (lz > a.T - LIP_BAND ? C.steel : top));
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, side); curtain(s, e.px, side); curtain(s, e.pz, side); corners(s); lineAt(s, 0);
    } else if (s instanceof BankShape) {
      const b = s.bank, xs = across(s.minX, s.maxX), zs = bankStops(b.run, b.f);
      surf(s, xs, zs, () => (wood ? top : C.concrete));
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, side); curtain(s, e.px, side); curtain(s, e.pz, side); lineAt(s, 0);
    } else if (s instanceof BoxShape) {
      const d = s.def, role = d.role;
      if (role === 'bench') bench(s);
      else {
        const topC = role === 'curb' ? C.curb : wood ? C.woodDeck : C.concrete;
        slab(s.frame, s.plane, s.minX, s.maxX, s.minZ, s.maxZ, 0, d.height, topC, wood ? C.woodSide : C.wall, s.id);
        corners(s);
        if (role === 'deck' && wood) planks(s);
      }
    } else if (s instanceof StairsShape) {
      const d = s.def;
      for (let k = 1; k < d.steps; k++) {
        const z0 = (k - 1) * d.run, z1 = Math.min(s.maxZ, k * d.run), h = s.tread(k);
        slab(s.frame, s.plane, s.minX, s.maxX, z0, z1, 0, h, C.concrete, C.wall, s.id, false);
        strip(out.paint, s.frame, s.plane, [s.minX, z0 + 0.03], [s.maxX, z0 + 0.03], h, 0.06, C.paint);
        line(W(s.frame, s.plane, s.minX, z0, h + INK_LIFT), W(s.frame, s.plane, s.maxX, z0, h + INK_LIFT));
      }
      // Bottom nosing.
      line(W(s.frame, s.plane, s.minX, s.maxZ, s.tread(d.steps - 1) + INK_LIFT), W(s.frame, s.plane, s.maxX, s.maxZ, s.tread(d.steps - 1) + INK_LIFT));
      strip(out.paint, s.frame, s.plane, [s.minX, -0.03], [s.maxX, -0.03], s.tread(0), 0.06, C.paint);
    } else if (s instanceof HubbaShape) {
      const zs = s.def.profile.map(p => p[0]), xs = [s.minX, s.maxX];
      surf(s, xs, zs, () => C.concrete);
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, C.wall); curtain(s, e.px, C.wall); curtain(s, e.nz, C.wall); curtain(s, e.pz, C.wall); corners(s);
    } else if (s instanceof FunboxShape) {
      const { px, nx, pz, nz } = s.banks, d = s.def;
      const xStops = uniq([
        ...(nx ? bankStops(nx.run, nx.f).map(t => s.minX + t) : [s.minX]), ...across(-d.half[0], d.half[0]),
        ...(px ? bankStops(px.run, px.f).map(t => s.maxX - t) : [s.maxX]),
      ].sort((p, q) => p - q));
      const zStops = uniq([
        ...(nz ? bankStops(nz.run, nz.f).map(t => s.minZ + t) : [s.minZ]), -d.half[1], d.half[1],
        ...(pz ? bankStops(pz.run, pz.f).map(t => s.maxZ - t) : [s.maxZ]),
      ].sort((p, q) => p - q));
      // Hips: split the corner cells along the crease (same-sign quadrants run on the (1,1) diagonal).
      surf(s, xStops, zStops, (_lx, _lz, h) => (h >= d.height - 1e-6 ? C.concrete : shade(C.concrete, 0.97)), (lx, lz) => lx * lz > 0);
      const e = rectEdges(s, xStops, zStops);
      curtain(s, e.nx, C.wall); curtain(s, e.px, C.wall); curtain(s, e.nz, C.wall); curtain(s, e.pz, C.wall); corners(s);
      // Ink the top plateau's outline and the toes.
      const T = (lx: number, lz: number) => W(s.frame, s.plane, lx, lz, d.height + INK_LIFT);
      line(T(-d.half[0], -d.half[1]), T(d.half[0], -d.half[1])); line(T(d.half[0], -d.half[1]), T(d.half[0], d.half[1])); line(T(d.half[0], d.half[1]), T(-d.half[0], d.half[1])); line(T(-d.half[0], d.half[1]), T(-d.half[0], -d.half[1]));
      // …and where each bank meets the pad, so a low berm still reads as a cut shape.
      const B = (lx: number, lz: number) => W(s.frame, s.plane, lx, lz, INK_LIFT);
      if (nx) line(B(s.minX, s.minZ), B(s.minX, s.maxZ)); if (px) line(B(s.maxX, s.minZ), B(s.maxX, s.maxZ));
      if (nz) line(B(s.minX, s.minZ), B(s.maxX, s.minZ)); if (pz) line(B(s.minX, s.maxZ), B(s.maxX, s.maxZ));
    } else if (s instanceof BowlShape) {
      bowl(s);
    }
  }
  /** Ink across a shape at local lz (full width). */
  function lineAt(s: SurfaceShape, lz: number): void { const h = hAt(s, s.minX, lz); line(W(s.frame, s.plane, s.minX, lz, h + INK_LIFT), W(s.frame, s.plane, s.maxX, lz, h + INK_LIFT)); }

  function bench(s: BoxShape): void {
    const d = s.def, t = 0.07, seat = C.woodDeck, leg = C.woodSide;
    slab(s.frame, s.plane, s.minX, s.maxX, s.minZ, s.maxZ, d.height - t, d.height, seat, leg, s.id);
    const alongX = d.half[0] >= d.half[1];
    const legs: [number, number][] = alongX ? [[s.minX + 0.15, 0], [s.maxX - 0.15, 0]] : [[0, s.minZ + 0.15], [0, s.maxZ - 0.15]];
    for (const [lx, lz] of legs) {
      const hw = alongX ? 0.05 : Math.min(d.half[0], d.half[1]) - 0.03, hd = alongX ? Math.min(d.half[0], d.half[1]) - 0.03 : 0.05;
      slab(s.frame, s.plane, lx - (alongX ? 0.05 : hw), lx + (alongX ? 0.05 : hw), lz - (alongX ? hd : 0.05), lz + (alongX ? hd : 0.05), 0, d.height - t, leg, leg, null, false);
    }
  }
  function planks(s: BoxShape): void {
    // Plank seams across the deck (ink), every 0.3.
    const alongZ = s.maxZ - s.minZ > s.maxX - s.minX;
    const n = Math.floor((alongZ ? s.maxZ - s.minZ : s.maxX - s.minX) / 0.3);
    for (let i = 1; i < n; i++) {
      const t = (alongZ ? s.minZ : s.minX) + i * 0.3;
      const a = alongZ ? W(s.frame, s.plane, s.minX, t, s.def.height + INK_LIFT) : W(s.frame, s.plane, t, s.minZ, s.def.height + INK_LIFT);
      const b = alongZ ? W(s.frame, s.plane, s.maxX, t, s.def.height + INK_LIFT) : W(s.frame, s.plane, t, s.maxZ, s.def.height + INK_LIFT);
      line(a, b);
    }
  }

  function bowl(s: BowlShape): void {
    const d = s.def, a = s.arc, fr = s.frame, pl = s.plane;
    const dStops = uniq([0, ...arcStops(a.T, ARC_SEG)]);
    const ringAt = (dd: number) => closedLoop(d.floor[0] + dd, d.floor[1] + dd, d.corner + dd, CORNER_SEG).map(([lx, lz]) => ({ lx, lz, p: W(fr, pl, lx, lz, dd <= 0 ? 0 : arcHeight(a, Math.min(dd, a.T))) }));
    // Floor: fan, painted a shade deeper, with a hearth stencil in the middle.
    const floor = ringAt(0), mid = W(fr, pl, 0, 0, 0);
    for (let i = 0; i < floor.length; i++) tri(out.card, mid, floor[i]!.p, floor[(i + 1) % floor.length]!.p, shade(C.bowl, 0.96));
    check(s.id, mid);
    topStencil(fr, pl, 0, 0, 0, Math.min(d.floor[1], 0.9) * 0.8, 1);
    let prev = floor;
    for (let k = 1; k < dStops.length; k++) {
      const dd = dStops[k]!, ring = ringAt(dd), color = dd > a.T - LIP_BAND + 1e-9 ? C.paint : C.bowl;
      for (let i = 0; i < ring.length; i++) quad(out.card, prev[i]!.p, prev[(i + 1) % ring.length]!.p, ring[(i + 1) % ring.length]!.p, ring[i]!.p, color);
      for (const q of ring) check(s.id, q.p);
      prev = ring;
    }
    // Deck: the block's rectangle with the coping loop cut out.
    const lip = prev, bx = d.block[0], bz = d.block[1];
    const contour = [new THREE.Vector2(-bx, -bz), new THREE.Vector2(bx, -bz), new THREE.Vector2(bx, bz), new THREE.Vector2(-bx, bz)];
    const hole = lip.map(q => new THREE.Vector2(q.lx, q.lz));
    const faces = THREE.ShapeUtils.triangulateShape(contour, [hole]);
    const all = [...contour, ...hole].map(v => W(fr, pl, v.x, v.y, a.H));
    for (const f of faces) tri(out.card, all[f[0]!]!, all[f[1]!]!, all[f[2]!]!, C.concrete);
    for (const q of all) check(s.id, q);
    // Block sides and their ink.
    const corner = (lx: number, lz: number, h: number) => W(fr, pl, lx, lz, h);
    const cs = [[-bx, -bz], [bx, -bz], [bx, bz], [-bx, bz]] as const;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = cs[i]!, [cx, cz] = cs[(i + 1) % 4]!;
      quad(out.card, corner(ax, az, 0), corner(cx, cz, 0), corner(cx, cz, a.H), corner(ax, az, a.H), C.wall);
      line(corner(ax, az, a.H + INK_LIFT), corner(cx, cz, a.H + INK_LIFT));
      line(corner(ax, az, a.H + INK_LIFT), corner(ax, az, 0));
    }
    // Ink the floor edge and the lip band.
    for (const ring of [floor, ringAt(a.T - LIP_BAND)]) for (let i = 0; i < ring.length; i++) { const p = ring[i]!.p, q = ring[(i + 1) % ring.length]!.p; line([p[0], p[1] + INK_LIFT, p[2]], [q[0], q[1] + INK_LIFT, q[2]]); }
    wallStencil(s, '-z', 0.3, a.H * 0.55, 0.35, 0); wallStencil(s, '-z', 0.7, a.H * 0.55, 0.35, 0); wallStencil(s, '-x', 0.5, a.H * 0.5, 0.35, 2);
  }

  function planter(p: PadRuntime['planters'][number]): void {
    const d = p.def, [hx, hz] = d.half, rim = 0.07;
    slab(p.frame, p.plane, -hx, hx, -hz, hz, 0, d.height, C.planter, shade(C.planter, 0.82), null);
    // Soil sits a little under the rim; plants on top.
    slab(p.frame, p.plane, -hx + rim, hx - rim, -hz + rim, hz - rim, d.height - 0.06, d.height + 0.002, C.soil, C.soil, null, false);
    const n = Math.max(3, Math.round(hx * hz * 6));
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, lx = (-hx + rim + 0.08) + (2 * (hx - rim - 0.08)) * u, lz = ((i * 0.61803) % 1 - 0.5) * 2 * (hz - rim - 0.1);
      const base = W(p.frame, p.plane, lx, lz, d.height), s = 0.09 + 0.05 * ((i * 0.37) % 1);
      const tip: V3 = [base[0], base[1] + s * 2.2, base[2]];
      for (let k = 0; k < 3; k++) { const a0 = k * 2.094 + i, a1 = a0 + 2.094; tri(out.card, [base[0] + Math.cos(a0) * s, base[1], base[2] + Math.sin(a0) * s], [base[0] + Math.cos(a1) * s, base[1], base[2] + Math.sin(a1) * s], tip, i % 3 === 0 ? C.bloom : C.leaf); }
    }
  }
  function post(p: PadRuntime['posts'][number]): void {
    const d = p.def;
    if (d.look === 'lantern') {
      cylinder(out.card, p.x, p.z, p.base - 0.2, p.top - 0.3, 0.045, C.post);
      // A cut-paper lantern: a small box of glowing paper with a dark cap.
      const y0 = p.top - 0.36, y1 = p.top - 0.02, r = 0.13;
      const box = (b: Bucket, x0: number, x1: number, z0: number, z1: number, ya: number, yb: number, c: RGB) => {
        const q = (x: number, y: number, z: number): V3 => [p.x + x, y, p.z + z];
        quad(b, q(x0, ya, z0), q(x1, ya, z0), q(x1, yb, z0), q(x0, yb, z0), c); quad(b, q(x1, ya, z0), q(x1, ya, z1), q(x1, yb, z1), q(x1, yb, z0), c);
        quad(b, q(x1, ya, z1), q(x0, ya, z1), q(x0, yb, z1), q(x1, yb, z1), c); quad(b, q(x0, ya, z1), q(x0, ya, z0), q(x0, yb, z0), q(x0, yb, z1), c);
        quad(b, q(x0, yb, z0), q(x1, yb, z0), q(x1, yb, z1), q(x0, yb, z1), c);
      };
      box(out.glow, -r, r, -r, r, y0, y1 - 0.05, C.lantern);
      box(out.card, -r - 0.02, r + 0.02, -r - 0.02, r + 0.02, y1 - 0.05, y1, C.post);
      for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]] as const) line([p.x + x * 1.01, y0, p.z + z * 1.01], [p.x + x * 1.01, y1 - 0.05, p.z + z * 1.01]);
    } else if (d.look === 'bollard') {
      cylinder(out.card, p.x, p.z, p.base - 0.1, p.top, d.r, C.post, 8);
      cylinder(out.steel, p.x, p.z, p.top - 0.08, p.top + 0.01, d.r * 1.12, C.steel, 8);
    } else {
      cylinder(out.card, p.x, p.z, p.base - 0.1, p.top, d.r, C.post);
    }
  }

  /* ---------------------------------------------------------------- build */
  for (const p of field.pads) {
    pad(p);
    for (const s of p.shapes) shape(s);
    for (const pl of p.planters) planter(pl);
    for (const po of p.posts) post(po);
    for (const r of p.rails) {
      tube(out.steel, r.points.map(q => [q[0], q[1] - RAIL_RADIUS, q[2]] as V3), RAIL_RADIUS, C.steel);
      for (const [x, top, z] of r.posts) cylinder(out.steel, x, z, field.heightAt(x, z) - 0.02, top - RAIL_RADIUS, 0.026, shade(C.steel, 0.8));
      // Pencil highlight: an ink line along the rail's top.
      for (let i = 1; i < r.points.length; i++) { const a = r.points[i - 1]!, b = r.points[i]!; line([a[0], a[1] + 0.002, a[2]], [b[0], b[1] + 0.002, b[2]]); }
    }
    // The sign, on the village side of each spot.
    const L = p.layout, [sx, sz] = frameToWorld(L.frame, L.sign.at[0], L.sign.at[1]), sy = field.heightAt(sx, sz), yaw = L.frame.yaw + L.sign.yaw;
    const big = L.id === 'tideline', w = big ? 4 : 2.7, h = big ? 0.82 : 0.6;
    out.signs.push({ id: L.id, name: L.name, x: sx, y: sy, z: sz, yaw, w, h });
    // Its two posts go in the card mesh (no extra draw calls).
    for (const dx of [-w / 2 + 0.25, w / 2 - 0.25]) { const px = sx + Math.cos(yaw) * dx, pz = sz - Math.sin(yaw) * dx; cylinder(out.card, px, pz, field.heightAt(px, pz) - 0.1, sy + 1.05 + h / 2 - 0.04, 0.05, C.post); }
  }
  // Coping on every lip, wax on every ledge-ish edge.
  for (const g of field.grindables) {
    if (g.kind === 'coping') { tube(out.steel, g.points.map(q => [q[0], q[1] - COPE_RADIUS, q[2]] as V3), COPE_RADIUS, C.steel); continue; }
    if (g.kind === 'round-rail' || g.kind === 'kinked-rail') continue;
    if (!full) continue;
    const face = g.faceYaw ?? 0, inX = -Math.sin(face) * 0.05, inZ = -Math.cos(face) * 0.05;
    for (let i = 1; i < g.points.length; i++) {
      const a = g.points[i - 1]!, b = g.points[i]!;
      const pa: V3 = [a[0] + inX, a[1] + 0.003, a[2] + inZ], pb: V3 = [b[0] + inX, b[1] + 0.003, b[2] + inZ];
      const dx = pb[0] - pa[0], dz = pb[2] - pa[2], l = Math.hypot(dx, dz) || 1, wx = -dz / l * 0.045, wz = dx / l * 0.045;
      quad(out.wax, [pa[0] + wx, pa[1], pa[2] + wz], [pa[0] - wx, pa[1], pa[2] - wz], [pb[0] - wx, pb[1], pb[2] - wz], [pb[0] + wx, pb[1], pb[2] + wz], C.wax, 0.2);
    }
  }
  // A trail of kitty paws across Tideline (the cat has been skating too).
  const tide = field.pads.find(p => p.id === 'tideline');
  if (tide) for (let i = 0; i < 6; i++) topStencil(tide.frame, tide.plane, -0.4 + i * 0.55, 4.6 + (i % 2) * 0.22, 0, 0.11, 2, -Math.PI / 2);
  // Rain-run waves painted down the Orchard culvert.
  const culvert = field.pads.find(p => p.id === 'orchard');
  if (culvert) for (const lx of [-2.4, 0, 2.4]) topStencil(culvert.frame, culvert.plane, lx, 0, 0, 0.36, 3);
  const steps = field.pads.find(p => p.id === 'fundsteps')?.shapes.find(s => s.id === 'fundsteps-top');
  if (steps) wallStencil(steps, '+z', 0.5, 0.36, 0.26, 3);
  return out;
}

/* ---------------------------------------------------------------- helpers */

function uniq(a: number[]): number[] {
  const s = [...a].sort((p, q) => p - q), out: number[] = [];
  for (const v of s) if (!out.length || Math.abs(v - out[out.length - 1]!) > 1e-6) out.push(v);
  return out;
}
/** A rounded-rectangle loop without its closing duplicate, as [lx, lz]. */
function closedLoop(a: number, b: number, r: number, perCorner: number): [number, number][] {
  const loop = roundRectLoop(a, b, r, perCorner).map(([x, z]) => [x, z] as [number, number]);
  const f = loop[0]!, l = loop[loop.length - 1]!;
  if (Math.abs(f[0] - l[0]) < 1e-9 && Math.abs(f[1] - l[1]) < 1e-9) loop.pop();
  return loop;
}

