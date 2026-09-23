/**
 * Tideline Skate Club v2 · world — the park's geometry, as plain arrays.
 *
 * Built from the SAME shape instances `field.ts` rides on (`evalLocal`,
 * `planeAt`, the coping/rail polylines), so every top-surface vertex sits
 * exactly on `sample()`. No DOM, no materials: `parkScene.ts` turns these
 * buckets into a handful of merged meshes (one per material).
 *
 * Look: a model park cut from painted card under raking light.
 *  - Pads are poured in slabs: each slab its own tone, pencil joints between
 *    them (doubled at the expansion joints), separate pours for the
 *    transition court and the street section, a darker kerb band at the edge
 *    and an apron of setts that fades into the verge.
 *  - Features are card folded in facets: cut sides darken to their foot, a
 *    soft contact shade lies on the pad round every raised side, transition
 *    toes sit in a little shadow, and an ink line runs along every cut edge.
 *  - Lips carry a painted band and bright coping with a chalk glint; rails
 *    are painted dark with a chalk glint and a shadow on the ground.
 *  - Dressing round the edges and each spot's own marks live in
 *    `meshesDressing.ts`; the primitives in `meshesKit.ts`.
 */
import * as THREE from 'three';
import { apronDrop, type SkateWorldField, type PadRuntime } from './field.ts';
import {
  BankShape, BowlShape, BoxShape, COPE_RADIUS, FunboxShape, HubbaShape, KickerShape, LIP_BAND, MiniShape, QuarterShape, RAIL_RADIUS, StairsShape,
  newHit, type SurfaceShape, type Plane,
} from './features.ts';
import { arcHeight, frameToWorld, roundRectLoop, worldToFrame, type Frame } from './profiles.ts';
import type { SkatePalette } from './palette.ts';
import {
  ICON, INK_LIFT, clipConvex, clipSegment, emptyMeshData, hash2, lift, makeKit, mix, rgb, shade, uniq,
  type ParkMeshData, type RGB, type Tier, type V3,
} from './meshesKit.ts';
import { dressPark, type DressContext } from './meshesDressing.ts';

export type { Bucket, LineBucket, ParkMeshData, RenderCheck, ShadeBucket, Tier, DressingFootprint } from './meshesKit.ts';

/** Which pour a pad cell belongs to. */
export type PadZone = 'pad' | 'alt' | 'warm';
/** Slab size per spot (Tideline pours big slabs; the street spots are paved smaller). */
const SLAB: Record<string, number> = { tideline: 2.5 };
const SLAB_STREET = 1.25;
/** Width (in plan) of the painted stripe at the top of every lip band. */
const STRIPE = 0.06;
/** Separate pours, in each pad's own frame. */
export const PAD_ZONES: Record<string, (lx: number, lz: number) => PadZone> = {
  // The transition court (Kettle, Hob, Breadbin and their roll-ins) and the Lantern Steps' street corner.
  tideline: (lx, lz) => (lx < -2 ? 'warm' : lx > 6 && lz > 2 ? 'alt' : 'pad'),
  // A reading-room rug between the bookends.
  bookends: (lx, lz) => (Math.abs(lx) < 1.9 && Math.abs(lz) < 1.9 ? 'warm' : 'pad'),
  // The counting-house forecourt under the landing and its banks.
  fundsteps: lx => (lx > 1.25 ? 'alt' : 'pad'),
  // The slipway's wet end.
  drydock: (_lx, lz) => (lz < -3.2 ? 'alt' : 'pad'),
  // The culvert channel runs darker between the berms.
  orchard: (_lx, lz) => (Math.abs(lz) < 1.25 ? 'alt' : 'pad'),
  // A runway lane down the middle of the run.
  northlight: lx => (Math.abs(lx) < 1.25 ? 'alt' : 'pad'),
  // Sand-warm promenade.
  tidepools: () => 'warm',
};

export function buildParkMeshData(field: SkateWorldField, palette: SkatePalette, tier: Tier = field.tier): ParkMeshData {
  const out = emptyMeshData();
  const full = tier === 'full';
  const ARC_SEG = full ? 14 : 7, CORNER_SEG = full ? 10 : 5, RAIL_SIDES = full ? 8 : 6;
  const C = {
    pad: rgb(palette.pad), padAlt: rgb(palette.padAlt), padWarm: rgb(palette.padWarm),
    apron: rgb(palette.apron), kerb: rgb(palette.kerb), verge: rgb(palette.verge),
    concrete: rgb(palette.concrete), bowl: rgb(palette.bowl), bowlDeck: rgb(palette.bowlDeck), wall: rgb(palette.wall),
    wood: rgb(palette.wood), woodAlt: rgb(palette.woodAlt), woodDeck: rgb(palette.woodDeck), woodSide: rgb(palette.woodSide),
    coping: rgb(palette.coping), rail: rgb(palette.rail), steel: rgb(palette.steel),
    ink: rgb(palette.ink), pencil: rgb(palette.pencil), chalk: rgb(palette.chalk), shadow: rgb(palette.shadow),
    paint: rgb(palette.paint), curb: rgb(palette.curb), wax: rgb(palette.wax), stencil: rgb(palette.stencil),
    planter: rgb(palette.planter), soil: rgb(palette.soil), leaf: rgb(palette.leaf), bloom: rgb(palette.bloom),
    hedge: rgb(palette.hedge), fence: rgb(palette.fence), fenceAlt: rgb(palette.fenceAlt), lantern: rgb(palette.lantern), post: rgb(palette.post),
  };
  const K = makeKit(out, C.ink);
  const { tri, quad, side, line, W, check } = K;
  const hit = newHit();
  const hAt = (s: SurfaceShape, lx: number, lz: number): number => (s.evalLocal(lx, lz, hit) ? hit.h : 0);
  /** Pencil, a touch of ink in the pad's own colour: slab joints and feet. */
  const pencil = mix(C.pencil, C.pad, 0.2);
  /** Slab joints are drawn lighter still: a pencil line, not a grid. */
  const jointC = mix(C.pencil, C.pad, 0.5), expC = mix(C.ink, C.pad, 0.55);

  /* ---------------------------------------------------------------- contact shade */
  /** Is world (x, z) on a feature's footprint (or a planter) of pad `p`? */
  const bounds = new Map<object, [number, number, number]>();
  const boundOf = (key: object, frame: Frame, minX: number, maxX: number, minZ: number, maxZ: number): [number, number, number] => {
    let b = bounds.get(key);
    if (!b) { const [cx, cz] = frameToWorld(frame, (minX + maxX) / 2, (minZ + maxZ) / 2); b = [cx, cz, Math.hypot(maxX - minX, maxZ - minZ) / 2]; bounds.set(key, b); }
    return b;
  };
  function onFeature(p: PadRuntime, x: number, z: number, pad = 0.02): boolean {
    for (const s of p.shapes) {
      const bb = boundOf(s, s.frame, s.minX, s.maxX, s.minZ, s.maxZ); if (Math.hypot(x - bb[0], z - bb[1]) > bb[2] + pad) continue;
      const [lx, lz] = worldToFrame(s.frame, x, z); if (lx > s.minX - pad && lx < s.maxX + pad && lz > s.minZ - pad && lz < s.maxZ + pad) return true; }
    for (const q of p.planters) { const [lx, lz] = worldToFrame(q.frame, x, z); if (Math.abs(lx) < q.def.half[0] + pad && Math.abs(lz) < q.def.half[1] + pad) return true; }
    return false;
  }
  /** Is local (lx, lz) of pad `p` on the pad top (inside its rounded rectangle)? */
  const onPad = (p: PadRuntime, x: number, z: number): boolean => {
    const [lx, lz] = worldToFrame(p.frame, x, z), [hx, hz] = p.half, r = p.corner;
    const qx = Math.abs(lx) - (hx - r), qz = Math.abs(lz) - (hz - r);
    return (qx > 0 && qz > 0 ? Math.hypot(qx, qz) - r : Math.max(qx, qz) - r) < -0.02;
  };
  let curPad: PadRuntime | null = null;
  /**
   * Soft contact shade on the pad along a raised edge: from local a→b of a
   * frame (at the pad plane), `width` outward along the outward normal `(ox, oz)` (local).
   */
  function skirt(frame: Frame, plane: Plane, a: readonly [number, number], b: readonly [number, number], ox: number, oz: number, width: number, alpha: number): void {
    const p = curPad; if (!p) return;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / (full ? 0.5 : 1.1)));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const ax = a[0] + (b[0] - a[0]) * t0, az = a[1] + (b[1] - a[1]) * t0, bx = a[0] + (b[0] - a[0]) * t1, bz = a[1] + (b[1] - a[1]) * t1;
      const inner0 = W(frame, plane, ax, az, 0), inner1 = W(frame, plane, bx, bz, 0);
      const outer0 = W(frame, plane, ax + ox * width, az + oz * width, 0), outer1 = W(frame, plane, bx + ox * width, bz + oz * width, 0);
      const mid: [number, number] = [(outer0[0] + outer1[0]) / 2, (outer0[2] + outer1[2]) / 2];
      if (!onPad(p, mid[0], mid[1]) || !onPad(p, outer0[0], outer0[2]) || !onPad(p, outer1[0], outer1[2])) continue;
      K.shadeQuad(lift(inner0, 0.006), lift(inner1, 0.006), lift(outer1, 0.006), lift(outer0, 0.006), C.shadow, alpha, 0);
    }
  }
  /** Shade and pencil feet round a shape's rectangle wherever a side stands proud of the pad. */
  function feet(s: SurfaceShape): void {
    const sides: [readonly [number, number], readonly [number, number], number, number][] = [
      [[s.minX, s.minZ], [s.maxX, s.minZ], 0, -1], [[s.maxX, s.minZ], [s.maxX, s.maxZ], 1, 0],
      [[s.maxX, s.maxZ], [s.minX, s.maxZ], 0, 1], [[s.minX, s.maxZ], [s.minX, s.minZ], -1, 0],
    ];
    for (const [a, b, ox, oz] of sides) {
      // Walk the edge; keep the runs where the side is taller than a curb's lip.
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(len / 0.25));
      let run: number | null = null, peak = 0;
      const flush = (t1: number) => {
        if (run === null) return;
        const p0: [number, number] = [a[0] + (b[0] - a[0]) * run, a[1] + (b[1] - a[1]) * run], p1: [number, number] = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
        const w = Math.min(0.42, 0.14 + peak * 0.3), al = Math.min(0.34, 0.12 + peak * 0.22);
        skirt(s.frame, s.plane, p0, p1, ox, oz, w, al);
        if (full) line(W(s.frame, s.plane, p0[0], p0[1], INK_LIFT * 0.5), W(s.frame, s.plane, p1[0], p1[1], INK_LIFT * 0.5), pencil);
        run = null; peak = 0;
      };
      for (let i = 0; i <= n; i++) {
        const t = i / n, lx = a[0] + (b[0] - a[0]) * t - ox * 1e-4, lz = a[1] + (b[1] - a[1]) * t - oz * 1e-4, h = hAt(s, lx, lz);
        if (h > 0.05) { if (run === null) run = t; peak = Math.max(peak, h); } else flush(t);
      }
      flush(1);
    }
  }

  /* ---------------------------------------------------------------- body helpers */
  /** A box-ish body with flat top, cut sides and inked edges (local rect on a frame/plane). */
  function slab(frame: Frame, plane: Plane, x0: number, x1: number, z0: number, z1: number, h0: number, h1: number, top: RGB, sideC: RGB, id: string | null, ink = true): void {
    const P = (lx: number, lz: number, h: number) => W(frame, plane, lx, lz, h);
    const t00 = P(x0, z0, h1), t10 = P(x1, z0, h1), t11 = P(x1, z1, h1), t01 = P(x0, z1, h1);
    const b00 = P(x0, z0, h0), b10 = P(x1, z0, h0), b11 = P(x1, z1, h0), b01 = P(x0, z1, h0);
    quad(out.card, t00, t10, t11, t01, top);
    if (id) for (const p of [t00, t10, t11, t01]) check(id, p);
    const foot = h0 < 1e-6 ? 0.72 : 0.88;
    side(out.card, b00, b10, t10, t00, sideC, foot); side(out.card, b10, b11, t11, t10, sideC, foot); side(out.card, b11, b01, t01, t11, sideC, foot); side(out.card, b01, b00, t00, t01, sideC, foot);
    if (ink) { line(lift(t00, INK_LIFT), lift(t10, INK_LIFT)); line(lift(t10, INK_LIFT), lift(t11, INK_LIFT)); line(lift(t11, INK_LIFT), lift(t01, INK_LIFT)); line(lift(t01, INK_LIFT), lift(t00, INK_LIFT)); }
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
      side(out.card, ba, bb, tb, ta, color);
      if (inkTop) line(lift(ta, INK_LIFT), lift(tb, INK_LIFT));
    }
  }
  const rectEdges = (s: SurfaceShape, xs: number[], zs: number[]) => ({
    nz: xs.map(x => [x, s.minZ] as [number, number]), pz: xs.map(x => [x, s.maxZ] as [number, number]),
    nx: zs.map(z => [s.minX, z] as [number, number]), px: zs.map(z => [s.maxX, z] as [number, number]),
  });
  const corners = (s: SurfaceShape) => { for (const [lx, lz] of [[s.minX, s.minZ], [s.maxX, s.minZ], [s.maxX, s.maxZ], [s.minX, s.maxZ]] as const) { const h = hAt(s, lx, lz); if (h > 0.02) line(W(s.frame, s.plane, lx, lz, h + INK_LIFT), W(s.frame, s.plane, lx, lz, 0)); } };
  const arcStops = (T: number, n: number): number[] => { const a: number[] = []; for (let i = 0; i <= n; i++) a.push(T * Math.sin((i / n) * Math.PI / 2)); a.push(T - LIP_BAND, T - STRIPE); return uniq(a); };
  /** The lip band (where the sim flags a lip) reads as a darker tide mark under a crisp painted stripe. */
  const lipColour = (d: number, T: number, base: RGB): RGB | null => (d > T - STRIPE ? C.paint : d > T - LIP_BAND ? shade(base, 0.84) : null);
  const bankStops = (run: number, f: number): number[] => uniq([0, f / 2, f, run / 2, run - f, run - f / 2, run]);
  const across = (min: number, max: number) => { const n = Math.max(1, Math.round((max - min) / 1.2)); return Array.from({ length: n + 1 }, (_, i) => min + (max - min) * i / n); };
  /** A transition's toe sits in a little shadow (the crease between two sheets of card). */
  const toe = (d: number, T: number) => (d < T * 0.1 ? 0.88 : d < T * 0.28 ? 0.94 : 1);
  function wallStencil(s: SurfaceShape, sideName: '+x' | '-x' | '+z' | '-z', t: number, h: number, r: number, icon: number): void {
    const c = Math.cos(s.frame.yaw), sn = Math.sin(s.frame.yaw);
    const ex: V3 = [c, 0, -sn], ez: V3 = [sn, 0, c];
    let lx = 0, lz = 0, n: V3, right: V3;
    if (sideName === '+x') { lx = s.maxX; lz = s.minZ + (s.maxZ - s.minZ) * t; n = ex; right = [-ez[0], 0, -ez[2]]; }
    else if (sideName === '-x') { lx = s.minX; lz = s.minZ + (s.maxZ - s.minZ) * t; n = [-ex[0], 0, -ex[2]]; right = ez; }
    else if (sideName === '+z') { lz = s.maxZ; lx = s.minX + (s.maxX - s.minX) * t; n = ez; right = ex; }
    else { lz = s.minZ; lx = s.minX + (s.maxX - s.minX) * t; n = [-ez[0], 0, -ez[2]]; right = [-ex[0], 0, -ex[2]]; }
    K.decal(W(s.frame, s.plane, lx, lz, h), [-right[0], 0, -right[2]], [0, 1, 0], r, icon, [n[0] * 0.006, 0, n[2] * 0.006], C.stencil, n);
  }

  /* ---------------------------------------------------------------- pads */
  function pad(p: PadRuntime): void {
    const f = p.frame, pl = p.plane, [hx, hz] = p.half, r = p.corner;
    const S = SLAB[p.id] ?? SLAB_STREET, zone = PAD_ZONES[p.id] ?? (() => 'pad' as PadZone);
    const nSide = (len: number) => Math.max(1, Math.round(len / S));
    const loop = denseLoop(hx, hz, r, CORNER_SEG, nSide(2 * (hx - r)), nSide(2 * (hz - r)));
    // Top: slabs on an S grid centred on the pad, clipped to its rounded rectangle. Each slab
    // has its own tone; the pours (zones) follow the joints like a real pour would.
    const zoneC = { pad: C.pad, alt: C.padAlt, warm: C.padWarm };
    const ni = Math.ceil(hx / S), nj = Math.ceil(hz / S);
    for (let i = -ni; i < ni; i++) for (let j = -nj; j < nj; j++) {
      const x0 = i * S, x1 = (i + 1) * S, z0 = j * S, z1 = (j + 1) * S;
      // Cells clear of the rounded corners are whole; only the corner cells need clipping.
      const whole = Math.max(Math.abs(x0), Math.abs(x1)) <= hx && Math.max(Math.abs(z0), Math.abs(z1)) <= hz && (Math.max(Math.abs(x0), Math.abs(x1)) <= hx - r || Math.max(Math.abs(z0), Math.abs(z1)) <= hz - r);
      const cell: [number, number][] = whole ? [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] : clipConvex([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], loop);
      if (cell.length < 3) continue;
      const tone = 1 + (hash2(i + 31 * p.id.length, j) - 0.5) * 0.085;
      const base = zoneC[zone((x0 + x1) / 2, (z0 + z1) / 2)];
      const color = shade(base, tone);
      const pts = cell.map(([lx, lz]) => W(f, pl, lx, lz, 0));
      for (let k = 1; k < pts.length - 1; k++) tri(out.pad, pts[0]!, pts[k]!, pts[k + 1]!, color, 0.02);
      for (const q of pts) if (!onFeature(p, q[0], q[2], 0.01)) check(p.id, q);
    }
    // Joints: pencil at every slab edge, doubled in ink at the expansion joints; skipped under features.
    const joint = (a: [number, number], b: [number, number], expansion: boolean) => {
      const seg = clipSegment(a, b, loop); if (!seg) return;
      const [s0, s1] = seg, len = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]), n = Math.max(1, Math.ceil(len / 0.2));
      const dx = (s1[0] - s0[0]) / len, dz = (s1[1] - s0[1]) / len;
      const draw = (from: number, to: number) => {
        const A = (t: number, off: number): V3 => lift(W(f, pl, s0[0] + (s1[0] - s0[0]) * t - dz * off, s0[1] + (s1[1] - s0[1]) * t + dx * off, 0), INK_LIFT * 0.6);
        if (expansion && full) { line(A(from, 0.035), A(to, 0.035), expC); line(A(from, -0.035), A(to, -0.035), expC); }
        else line(A(from, 0), A(to, 0), expansion ? expC : jointC);
      };
      let start: number | null = null;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, mx = s0[0] + (s1[0] - s0[0]) * (t0 + t1) / 2, mz = s0[1] + (s1[1] - s0[1]) * (t0 + t1) / 2;
        const [wx, wz] = frameToWorld(f, mx, mz), blocked = onFeature(p, wx, wz, 0.04);
        if (!blocked && start === null) start = t0;
        if (blocked && start !== null) { draw(start, t0); start = null; }
      }
      if (start !== null) draw(start, 1);
    };
    const every = full ? 1 : 2, EXP = 3;
    for (let i = -ni + 1; i < ni; i++) { if (i % every) continue; joint([i * S, -hz - 1], [i * S, hz + 1], i % EXP === 0); }
    for (let j = -nj + 1; j < nj; j++) { if (j % every) continue; joint([-hx - 1, j * S], [hx + 1, j * S], j % EXP === 0); }

    // Apron: a kerb band at the pad's edge, then setts falling to the lawn and fading into the verge.
    if (p.reach > 0.06) {
      const KERB = 0.16;
      const steps = (full ? [KERB, 0.34, 0.6, 0.9, 1.25, 1.65, 2.1, 2.6, 3.2, 4.0] : [KERB, 0.6, 1.25, 2.1, 3.2]).filter(e => e <= p.reach + 0.6);
      if (steps[steps.length - 1]! < p.reach) steps.push(p.reach);
      let inner = loop.map(([lx, lz]) => W(f, pl, lx, lz, 0)), innerE = 0;
      const span = Math.max(0.6, p.reach);
      steps.forEach((e, k) => {
        const ringL = denseLoop(hx + e, hz + e, r + e, CORNER_SEG, nSide(2 * (hx - r)), nSide(2 * (hz - r))), drop = apronDrop(e);
        const ring = ringL.map(([lx, lz]) => W(f, pl, lx, lz, -drop));
        const t = Math.min(1, (innerE + e) / 2 / span);
        for (let i = 0; i < ring.length; i++) {
          const c = k === 0 ? C.kerb : shade(mix(C.apron, C.verge, Math.min(0.6, 0.06 + 0.7 * t ** 1.4)), 1 + (hash2(i, k) - 0.5) * 0.09);
          quad(out.pad, inner[i]!, inner[(i + 1) % ring.length]!, ring[(i + 1) % ring.length]!, ring[i]!, c, 0.02);
        }
        for (const q of ring) if (q[1] >= field.ground(q[0], q[2]) + 1e-3) check(`${p.id}-apron`, q);
        if (k === 0) for (let i = 0; i < ring.length; i++) line(lift(ring[i]!, INK_LIFT), lift(ring[(i + 1) % ring.length]!, INK_LIFT), pencil);
        inner = ring; innerE = e;
      });
    }
    // The pad's cut edge, in ink.
    const edge = loop.map(([lx, lz]) => W(f, pl, lx, lz, INK_LIFT));
    for (let i = 0; i < edge.length; i++) line(edge[i]!, edge[(i + 1) % edge.length]!);
  }

  /* ---------------------------------------------------------------- features */
  const woodFor = (s: SurfaceShape) => (s.def.kind === 'wood' || s.def.type === 'quarter' || s.def.type === 'mini' || s.def.type === 'kicker');
  let woodIndex = 0;
  function shape(s: SurfaceShape): void {
    const wood = woodFor(s), top = wood ? (woodIndex++ % 2 === 0 ? C.wood : C.woodAlt) : C.concrete, sideC = wood ? C.woodSide : C.wall, deck = wood ? C.woodDeck : C.concrete;
    if (s instanceof QuarterShape) {
      const a = s.arc, xs = across(s.minX, s.maxX), zs = uniq([...arcStops(a.T, ARC_SEG), a.T, s.maxZ]);
      surf(s, xs, zs, (_x, lz) => (lz > a.T ? deck : lipColour(lz, a.T, top) ?? shade(top, toe(lz, a.T))));
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, sideC); curtain(s, e.px, sideC); if (s.def.deck > 0) { curtain(s, e.pz, sideC); corners(s); }
      lineAt(s, a.T - LIP_BAND); lineAt(s, a.T); lineAt(s, 0, mix(C.ink, top, 0.35));
      if (s.def.height > 1.5) wallStencil(s, '+z', 0.5, a.H * 0.6, 0.45, ICON.hearth);
    } else if (s instanceof MiniShape) {
      const a = s.arc, F = s.def.flat / 2, st = arcStops(a.T, ARC_SEG);
      const zs = uniq([s.minZ, ...st.map(t => -(F + t)).reverse(), -F, F, ...st.map(t => F + t), s.maxZ].sort((p, q) => p - q));
      const xs = across(s.minX, s.maxX);
      surf(s, xs, zs, (_x, lz) => { const d = Math.abs(lz) - F; return d > a.T ? deck : d < 0 ? shade(top, 0.9) : lipColour(d, a.T, top) ?? shade(top, toe(d, a.T)); });
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, sideC); curtain(s, e.px, sideC); curtain(s, e.nz, sideC); curtain(s, e.pz, sideC); corners(s);
      lineAt(s, -F, mix(C.ink, top, 0.35)); lineAt(s, F, mix(C.ink, top, 0.35));
      // Plank seams down the flat bottom (a timber mini).
      if (full) for (let k = 1; k < 4; k++) { const lz = -F + (2 * F) * k / 4; lineAt(s, lz, mix(C.ink, top, 0.55)); }
      wallStencil(s, '-x', 0.5, a.H * 0.55, 0.32, ICON.lantern); wallStencil(s, '+x', 0.5, a.H * 0.55, 0.32, ICON.lantern);
    } else if (s instanceof KickerShape) {
      const a = s.arc, xs = across(s.minX, s.maxX), zs = uniq([...arcStops(a.T, ARC_SEG), a.T]);
      surf(s, xs, zs, (_x, lz) => (lz > a.T - LIP_BAND ? C.coping : top));
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, sideC); curtain(s, e.px, sideC); curtain(s, e.pz, sideC); corners(s); lineAt(s, 0); lineAt(s, a.T - LIP_BAND);
    } else if (s instanceof BankShape) {
      const b = s.bank, xs = across(s.minX, s.maxX), zs = bankStops(b.run, b.f);
      surf(s, xs, zs, (_x, lz) => (wood ? top : lz < b.f * 0.6 ? shade(C.concrete, 0.93) : C.concrete));
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, sideC); curtain(s, e.px, sideC); curtain(s, e.pz, sideC); lineAt(s, 0, mix(C.ink, C.concrete, 0.3));
      // The top edge of a bank is a lip too: paint it.
      K.strip(out.paint, s.frame, s.plane, [s.minX + 0.02, s.maxZ - 0.05], [s.maxX - 0.02, s.maxZ - 0.05], b.rise, 0.08, C.paint);
    } else if (s instanceof BoxShape) {
      const d = s.def, role = d.role;
      if (role === 'bench') bench(s);
      else {
        const topC = role === 'curb' ? C.curb : wood ? C.woodDeck : role === 'ledge' || role === 'manual' ? shade(C.concrete, 1.02) : C.concrete;
        slab(s.frame, s.plane, s.minX, s.maxX, s.minZ, s.maxZ, 0, d.height, topC, wood ? C.woodSide : C.wall, s.id);
        corners(s);
        if (role === 'deck' && wood) planks(s);
        // Ledges and manual pads get a painted arris so their edges read at speed.
        if (role === 'ledge' || role === 'manual' || role === 'landing') for (const l of d.ledges ?? [{ side: '+z' as const }, { side: '-z' as const }]) arris(s, l.side, d.height);
      }
    } else if (s instanceof StairsShape) {
      const d = s.def;
      for (let k = 1; k < d.steps; k++) {
        const z0 = (k - 1) * d.run, z1 = Math.min(s.maxZ, k * d.run), h = s.tread(k);
        slab(s.frame, s.plane, s.minX, s.maxX, z0, z1, 0, h, C.concrete, C.wall, s.id, false);
        K.strip(out.paint, s.frame, s.plane, [s.minX, z0 + 0.03], [s.maxX, z0 + 0.03], h, 0.06, C.paint);
        line(W(s.frame, s.plane, s.minX, z0, h + INK_LIFT), W(s.frame, s.plane, s.maxX, z0, h + INK_LIFT));
        // The riser's foot, in pencil: the stacked read of a flight of card steps.
        if (full) line(W(s.frame, s.plane, s.minX, z0 - 0.002, h - d.rise + INK_LIFT), W(s.frame, s.plane, s.maxX, z0 - 0.002, h - d.rise + INK_LIFT), pencil);
      }
      line(W(s.frame, s.plane, s.minX, s.maxZ, s.tread(d.steps - 1) + INK_LIFT), W(s.frame, s.plane, s.maxX, s.maxZ, s.tread(d.steps - 1) + INK_LIFT));
      K.strip(out.paint, s.frame, s.plane, [s.minX, -0.03], [s.maxX, -0.03], s.tread(0), 0.06, C.paint);
    } else if (s instanceof HubbaShape) {
      const zs = s.def.profile.map(p => p[0]), xs = [s.minX, s.maxX];
      surf(s, xs, zs, () => C.concrete);
      const e = rectEdges(s, xs, zs);
      curtain(s, e.nx, C.wall); curtain(s, e.px, C.wall); curtain(s, e.nz, C.wall); curtain(s, e.pz, C.wall); corners(s);
      // Painted arrises down both grind edges.
      for (const sx of [s.minX + 0.035, s.maxX - 0.035]) for (let i = 1; i < zs.length; i++) {
        const z0 = zs[i - 1]!, z1 = zs[i]!;
        quad(out.paint, lift(W(s.frame, s.plane, sx - 0.03, z0, hAt(s, sx, z0 + 1e-4)), 0.0025), lift(W(s.frame, s.plane, sx + 0.03, z0, hAt(s, sx, z0 + 1e-4)), 0.0025),
          lift(W(s.frame, s.plane, sx + 0.03, z1, hAt(s, sx, z1 - 1e-4)), 0.0025), lift(W(s.frame, s.plane, sx - 0.03, z1, hAt(s, sx, z1 - 1e-4)), 0.0025), C.curb, 0.01);
      }
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
      // The orchard's berms are grass-stained (the rain found this line first).
      const conc = s.id.startsWith('orchard-berm') ? mix(C.concrete, C.verge, 0.38) : C.concrete;
      surf(s, xStops, zStops, (_lx, _lz, h) => (h >= d.height - 1e-6 ? conc : h < d.height * 0.25 ? shade(conc, 0.9) : shade(conc, 0.96)), (lx, lz) => lx * lz > 0);
      const e = rectEdges(s, xStops, zStops);
      curtain(s, e.nx, C.wall); curtain(s, e.px, C.wall); curtain(s, e.nz, C.wall); curtain(s, e.pz, C.wall); corners(s);
      const T = (lx: number, lz: number) => W(s.frame, s.plane, lx, lz, d.height + INK_LIFT);
      line(T(-d.half[0], -d.half[1]), T(d.half[0], -d.half[1])); line(T(d.half[0], -d.half[1]), T(d.half[0], d.half[1])); line(T(d.half[0], d.half[1]), T(-d.half[0], d.half[1])); line(T(-d.half[0], d.half[1]), T(-d.half[0], -d.half[1]));
      const B = (lx: number, lz: number) => W(s.frame, s.plane, lx, lz, INK_LIFT);
      const soft = mix(C.ink, C.concrete, 0.3);
      if (nx) line(B(s.minX, s.minZ), B(s.minX, s.maxZ), soft); if (px) line(B(s.maxX, s.minZ), B(s.maxX, s.maxZ), soft);
      if (nz) line(B(s.minX, s.minZ), B(s.maxX, s.minZ), soft); if (pz) line(B(s.minX, s.maxZ), B(s.maxX, s.maxZ), soft);
      for (const l of d.ledges ?? []) arris(s, l.side, d.height);
    } else if (s instanceof BowlShape) {
      bowl(s);
    }
    feet(s);
  }
  /** Ink across a shape at local lz (full width). */
  function lineAt(s: SurfaceShape, lz: number, c?: RGB): void { const h = hAt(s, s.minX, lz); line(W(s.frame, s.plane, s.minX, lz, h + INK_LIFT), W(s.frame, s.plane, s.maxX, lz, h + INK_LIFT), c); }
  /** A painted band just inside a box's grind edge. */
  function arris(s: SurfaceShape, sideName: '+x' | '-x' | '+z' | '-z', h: number): void {
    const inset = 0.04, w = 0.05;
    const [a, b]: [[number, number], [number, number]] =
      sideName === '+x' ? [[s.maxX - inset, s.minZ], [s.maxX - inset, s.maxZ]] : sideName === '-x' ? [[s.minX + inset, s.minZ], [s.minX + inset, s.maxZ]]
        : sideName === '+z' ? [[s.minX, s.maxZ - inset], [s.maxX, s.maxZ - inset]] : [[s.minX, s.minZ + inset], [s.maxX, s.minZ + inset]];
    K.strip(out.paint, s.frame, s.plane, a, b, h, w, C.curb);
  }

  function bench(s: BoxShape): void {
    const d = s.def, t = 0.07, seat = C.woodDeck, leg = C.woodSide;
    slab(s.frame, s.plane, s.minX, s.maxX, s.minZ, s.maxZ, d.height - t, d.height, seat, leg, s.id);
    const alongX = d.half[0] >= d.half[1];
    // Seat slats.
    if (full) { const n = 3; for (let k = 1; k < n; k++) { const u = -1 + 2 * k / n; const a: [number, number] = alongX ? [s.minX, u * d.half[1]] : [u * d.half[0], s.minZ], b: [number, number] = alongX ? [s.maxX, u * d.half[1]] : [u * d.half[0], s.maxZ]; line(W(s.frame, s.plane, a[0], a[1], d.height + INK_LIFT), W(s.frame, s.plane, b[0], b[1], d.height + INK_LIFT), mix(C.ink, seat, 0.4)); } }
    const legs: [number, number][] = alongX ? [[s.minX + 0.15, 0], [s.maxX - 0.15, 0]] : [[0, s.minZ + 0.15], [0, s.maxZ - 0.15]];
    for (const [lx, lz] of legs) {
      const hw = alongX ? 0.05 : Math.min(d.half[0], d.half[1]) - 0.03, hd = alongX ? Math.min(d.half[0], d.half[1]) - 0.03 : 0.05;
      slab(s.frame, s.plane, lx - (alongX ? 0.05 : hw), lx + (alongX ? 0.05 : hw), lz - (alongX ? hd : 0.05), lz + (alongX ? hd : 0.05), 0, d.height - t, leg, leg, null, false);
    }
    // A shadow under the seat.
    const e = 0.05;
    const P = (lx: number, lz: number) => lift(W(s.frame, s.plane, lx, lz, 0), 0.006);
    K.shadeQuad(P(s.minX + e, s.minZ + e), P(s.maxX - e, s.minZ + e), P(s.maxX - e, s.maxZ - e), P(s.minX + e, s.maxZ - e), C.shadow, 0.3, 0.3);
    for (const [ox, oz, a, b] of [[0, -1, [s.minX, s.minZ], [s.maxX, s.minZ]], [0, 1, [s.maxX, s.maxZ], [s.minX, s.maxZ]], [-1, 0, [s.minX, s.maxZ], [s.minX, s.minZ]], [1, 0, [s.maxX, s.minZ], [s.maxX, s.maxZ]]] as const)
      skirt(s.frame, s.plane, a as [number, number], b as [number, number], ox, oz, 0.22, 0.3);
  }
  function planks(s: BoxShape): void {
    const alongZ = s.maxZ - s.minZ > s.maxX - s.minX;
    const n = Math.floor((alongZ ? s.maxZ - s.minZ : s.maxX - s.minX) / 0.3);
    for (let i = 1; i < n; i++) {
      const t = (alongZ ? s.minZ : s.minX) + i * 0.3;
      const a = alongZ ? W(s.frame, s.plane, s.minX, t, s.def.height + INK_LIFT) : W(s.frame, s.plane, t, s.minZ, s.def.height + INK_LIFT);
      const b = alongZ ? W(s.frame, s.plane, s.maxX, t, s.def.height + INK_LIFT) : W(s.frame, s.plane, t, s.maxZ, s.def.height + INK_LIFT);
      line(a, b, mix(C.ink, C.woodDeck, 0.3));
    }
  }

  function bowl(s: BowlShape): void {
    const d = s.def, a = s.arc, fr = s.frame, pl = s.plane;
    const dStops = uniq([0, ...arcStops(a.T, ARC_SEG)]);
    const ringAt = (dd: number) => closedLoop(d.floor[0] + dd, d.floor[1] + dd, d.corner + dd, CORNER_SEG).map(([lx, lz]) => ({ lx, lz, p: W(fr, pl, lx, lz, dd <= 0 ? 0 : arcHeight(a, Math.min(dd, a.T))) }));
    // Floor: fan, darker toward its edge (the bowl's own shadow), a hearth stencil in the middle.
    const floor = ringAt(0), mid = W(fr, pl, 0, 0, 0);
    const inner = closedLoop(d.floor[0] * 0.55, d.floor[1] * 0.55, d.corner * 0.55, CORNER_SEG).map(([lx, lz]) => W(fr, pl, lx, lz, 0));
    for (let i = 0; i < floor.length; i++) {
      const j = (i + 1) % floor.length;
      tri(out.card, mid, inner[i]!, inner[j]!, shade(C.bowl, 0.97));
      K.quadV(out.card, inner[i]!, inner[j]!, floor[j]!.p, floor[i]!.p, shade(C.bowl, 0.97), shade(C.bowl, 0.97), shade(C.bowl, 0.86), shade(C.bowl, 0.86));
    }
    check(s.id, mid);
    K.topStencil(fr, pl, 0, 0, 0, Math.min(d.floor[1], 0.9) * 0.8, ICON.hearth, C.stencil);
    let prev = floor;
    for (let k = 1; k < dStops.length; k++) {
      const dd = dStops[k]!, ring = ringAt(dd), mid = (dStops[k - 1]! + dd) / 2, color = lipColour(mid, a.T, C.bowl) ?? shade(C.bowl, toe(dd, a.T));
      for (let i = 0; i < ring.length; i++) quad(out.card, prev[i]!.p, prev[(i + 1) % ring.length]!.p, ring[(i + 1) % ring.length]!.p, ring[i]!.p, color);
      for (const q of ring) check(s.id, q.p);
      prev = ring;
    }
    // Deck: the block's rectangle with the coping loop cut out, painted (the Kettle has a coloured deck).
    const lip = prev, bx = d.block[0], bz = d.block[1];
    const contour: [number, number][] = [[-bx, -bz], [bx, -bz], [bx, bz], [-bx, bz]];
    const faces = triangulate(contour, lip.map(q => [q.lx, q.lz] as [number, number]));
    const all = [...contour, ...lip.map(q => [q.lx, q.lz] as [number, number])].map(([x, z]) => W(fr, pl, x, z, a.H));
    for (const fc of faces) tri(out.card, all[fc[0]]!, all[fc[1]]!, all[fc[2]]!, C.bowlDeck);
    for (const q of all) check(s.id, q);
    // A pencil border round the deck, just inside its edge (the pour's trowelled margin).
    const m = 0.14, B = (lx: number, lz: number) => W(fr, pl, lx, lz, a.H + INK_LIFT);
    if (full) for (const [p, q] of [[[-bx + m, -bz + m], [bx - m, -bz + m]], [[bx - m, -bz + m], [bx - m, bz - m]], [[bx - m, bz - m], [-bx + m, bz - m]], [[-bx + m, bz - m], [-bx + m, -bz + m]]] as const) line(B(p[0], p[1]), B(q[0], q[1]), mix(C.ink, C.bowlDeck, 0.45));
    // Block sides and their ink.
    const corner = (lx: number, lz: number, h: number) => W(fr, pl, lx, lz, h);
    const cs = [[-bx, -bz], [bx, -bz], [bx, bz], [-bx, bz]] as const;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = cs[i]!, [cx, cz] = cs[(i + 1) % 4]!;
      side(out.card, corner(ax, az, 0), corner(cx, cz, 0), corner(cx, cz, a.H), corner(ax, az, a.H), C.wall);
      line(corner(ax, az, a.H + INK_LIFT), corner(cx, cz, a.H + INK_LIFT));
      line(corner(ax, az, a.H + INK_LIFT), corner(ax, az, 0));
    }
    for (const ring of [floor, ringAt(a.T - LIP_BAND)]) for (let i = 0; i < ring.length; i++) { const p = ring[i]!.p, q = ring[(i + 1) % ring.length]!.p; line(lift(p, INK_LIFT), lift(q, INK_LIFT)); }
    wallStencil(s, '-z', 0.3, a.H * 0.55, 0.35, ICON.lantern); wallStencil(s, '-z', 0.7, a.H * 0.55, 0.35, ICON.lantern); wallStencil(s, '-x', 0.5, a.H * 0.5, 0.35, ICON.paw);
  }

  function planter(p: PadRuntime['planters'][number]): void {
    const d = p.def, [hx, hz] = d.half, rim = 0.07;
    slab(p.frame, p.plane, -hx, hx, -hz, hz, 0, d.height, C.planter, shade(C.planter, 0.82), null);
    slab(p.frame, p.plane, -hx + rim, hx - rim, -hz + rim, hz - rim, d.height - 0.06, d.height + 0.002, C.soil, C.soil, null, false);
    const n = Math.max(3, Math.round(hx * hz * (full ? 6 : 3.5)));
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, lx = (-hx + rim + 0.08) + (2 * (hx - rim - 0.08)) * u, lz = ((i * 0.61803) % 1 - 0.5) * 2 * (hz - rim - 0.1);
      const base = W(p.frame, p.plane, lx, lz, d.height), s = 0.09 + 0.05 * ((i * 0.37) % 1);
      const tip: V3 = [base[0], base[1] + s * 2.2, base[2]];
      for (let k = 0; k < 3; k++) { const a0 = k * 2.094 + i, a1 = a0 + 2.094; tri(out.card, [base[0] + Math.cos(a0) * s, base[1], base[2] + Math.sin(a0) * s], [base[0] + Math.cos(a1) * s, base[1], base[2] + Math.sin(a1) * s], tip, i % 3 === 0 ? C.bloom : C.leaf); }
    }
    const sides: [readonly [number, number], readonly [number, number], number, number][] = [[[-hx, -hz], [hx, -hz], 0, -1], [[hx, -hz], [hx, hz], 1, 0], [[hx, hz], [-hx, hz], 0, 1], [[-hx, hz], [-hx, -hz], -1, 0]];
    for (const [a, b, ox, oz] of sides) skirt(p.frame, p.plane, a, b, ox, oz, 0.3, 0.3);
  }
  function post(p: PadRuntime['posts'][number]): void {
    const d = p.def;
    if (d.look === 'lantern') lanternPost(p.x, p.z, p.base, p.top);
    else if (d.look === 'bollard') {
      K.cylinder(out.card, p.x, p.z, p.base - 0.1, p.top, d.r, C.post, 8);
      K.cylinder(out.steel, p.x, p.z, p.top - 0.08, p.top + 0.01, d.r * 1.12, C.steel, 8);
    } else K.cylinder(out.card, p.x, p.z, p.base - 0.1, p.top, d.r, C.post);
    if (curPad && onPad(curPad, p.x, p.z)) K.shadeQuad(...discQuad(p.x, p.z, p.base, 0.28), C.shadow, 0.28, 0.28);
  }
  /** A cut-paper lantern on a post (also used by the dressing). */
  function lanternPost(x: number, z: number, base: number, top: number): void {
    K.cylinder(out.card, x, z, base - 0.2, top - 0.3, 0.045, C.post);
    const y0 = top - 0.36, y1 = top - 0.02, r = 0.13;
    const box = (b: typeof out.card, x0: number, x1: number, z0: number, z1: number, ya: number, yb: number, c: RGB) => {
      const q = (px: number, y: number, pz: number): V3 => [x + px, y, z + pz];
      quad(b, q(x0, ya, z0), q(x1, ya, z0), q(x1, yb, z0), q(x0, yb, z0), c); quad(b, q(x1, ya, z0), q(x1, ya, z1), q(x1, yb, z1), q(x1, yb, z0), c);
      quad(b, q(x1, ya, z1), q(x0, ya, z1), q(x0, yb, z1), q(x1, yb, z1), c); quad(b, q(x0, ya, z1), q(x0, ya, z0), q(x0, yb, z0), q(x0, yb, z1), c);
      quad(b, q(x0, yb, z0), q(x1, yb, z0), q(x1, yb, z1), q(x0, yb, z1), c);
    };
    box(out.glow, -r, r, -r, r, y0, y1 - 0.05, C.lantern);
    box(out.card, -r - 0.02, r + 0.02, -r - 0.02, r + 0.02, y1 - 0.05, y1, C.post);
    for (const [px, pz] of [[-r, -r], [r, -r], [r, r], [-r, r]] as const) line([x + px * 1.01, y0, z + pz * 1.01], [x + px * 1.01, y1 - 0.05, z + pz * 1.01]);
  }
  const discQuad = (x: number, z: number, y: number, r: number): [V3, V3, V3, V3] => [[x - r, y + 0.006, z - r], [x + r, y + 0.006, z - r], [x + r, y + 0.006, z + r], [x - r, y + 0.006, z + r]];

  /* ---------------------------------------------------------------- build */
  const glint = mix(C.chalk, C.coping, 0.2);
  for (const p of field.pads) {
    curPad = p;
    pad(p);
    for (const s of p.shapes) shape(s);
    for (const pl of p.planters) planter(pl);
    for (const po of p.posts) post(po);
    for (const r of p.rails) {
      K.tube(out.steel, r.points.map(q => [q[0], q[1] - RAIL_RADIUS, q[2]] as V3), RAIL_RADIUS, C.rail, RAIL_SIDES);
      for (const [x, top, z] of r.posts) {
        K.cylinder(out.steel, x, z, field.heightAt(x, z) - 0.02, top - RAIL_RADIUS, 0.026, shade(C.rail, 0.85));
        // A foot plate, in ink round its edge, so the post reads as bolted down.
        const y = field.heightAt(x, z);
        K.shadeQuad(...discQuad(x, z, y, 0.11), C.shadow, 0.35, 0.35);
      }
      // A chalk glint along the rail's top, and its shadow on the ground straight below.
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1]!, b = r.points[i]!;
        line([a[0], a[1] + 0.002, a[2]], [b[0], b[1] + 0.002, b[2]], glint);
        const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 0.07, nz = dx / l * 0.07;
        const n = Math.max(1, Math.round(l / (full ? 0.5 : 1.2)));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const P = (t: number, o: number): V3 => { const x = a[0] + dx * t + nx * o, z = a[2] + dz * t + nz * o; return [x, field.heightAt(x, z) + 0.007, z]; };
          K.shadeQuad(P(t0, 0), P(t1, 0), P(t1, 1), P(t0, 1), C.shadow, 0.3, 0);
          K.shadeQuad(P(t0, 0), P(t1, 0), P(t1, -1), P(t0, -1), C.shadow, 0.3, 0);
        }
      }
    }
    // The sign, on the village side of each spot.
    const L = p.layout, [sx, sz] = frameToWorld(L.frame, L.sign.at[0], L.sign.at[1]), sy = field.heightAt(sx, sz), yaw = L.frame.yaw + L.sign.yaw;
    const big = L.id === 'tideline', w = big ? 4 : 2.7, h = big ? 0.82 : 0.6;
    out.signs.push({ id: L.id, name: L.name, x: sx, y: sy, z: sz, yaw, w, h });
    for (const dx of [-w / 2 + 0.25, w / 2 - 0.25]) { const px = sx + Math.cos(yaw) * dx, pz = sz - Math.sin(yaw) * dx; K.cylinder(out.card, px, pz, field.heightAt(px, pz) - 0.1, sy + 1.05 + h / 2 - 0.04, 0.05, C.post); }
  }
  curPad = null;
  // Coping on every lip (bright, with a chalk glint along its top), wax on every ledge-ish edge.
  for (const g of field.grindables) {
    if (g.kind === 'coping') {
      K.tube(out.steel, g.points.map(q => [q[0], q[1] - COPE_RADIUS, q[2]] as V3), COPE_RADIUS, C.coping, RAIL_SIDES);
      for (let i = 1; i < g.points.length; i++) { const a = g.points[i - 1]!, b = g.points[i]!; line([a[0], a[1] + 0.002, a[2]], [b[0], b[1] + 0.002, b[2]], glint); }
      continue;
    }
    if (g.kind === 'round-rail' || g.kind === 'kinked-rail') continue;
    if (!full) continue;
    const face = g.faceYaw ?? 0, inX = -Math.sin(face) * 0.05, inZ = -Math.cos(face) * 0.05;
    for (let i = 1; i < g.points.length; i++) {
      const a = g.points[i - 1]!, b = g.points[i]!;
      const pa: V3 = [a[0] + inX, a[1] + 0.004, a[2] + inZ], pb: V3 = [b[0] + inX, b[1] + 0.004, b[2] + inZ];
      const dx = pb[0] - pa[0], dz = pb[2] - pa[2], l = Math.hypot(dx, dz) || 1, wx = -dz / l * 0.045, wz = dx / l * 0.045;
      // Wax goes on in smears, not a stripe.
      const n = Math.max(1, Math.round(l / 0.35));
      for (let k = 0; k < n; k++) {
        if (hash2(i * 17 + k, Math.round(pa[0] * 10)) < 0.3) continue;
        const t0 = k / n + 0.02, t1 = (k + 1) / n - 0.02, P = (t: number, s: number): V3 => [pa[0] + (pb[0] - pa[0]) * t + wx * s, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t + wz * s];
        quad(out.wax, P(t0, 1), P(t0, -1), P(t1, -1), P(t1, 1), C.wax, 0.2);
      }
    }
  }
  const ctx: DressContext = { out, K, C, field, full, onFeature, lanternPost };
  dressPark(ctx);
  return out;
}

/* ---------------------------------------------------------------- helpers */

/** A rounded-rectangle loop without its closing duplicate, as [lx, lz]. */
function closedLoop(a: number, b: number, r: number, perCorner: number): [number, number][] {
  const loop = roundRectLoop(a, b, r, perCorner).map(([x, z]) => [x, z] as [number, number]);
  const f = loop[0]!, l = loop[loop.length - 1]!;
  if (Math.abs(f[0] - l[0]) < 1e-9 && Math.abs(f[1] - l[1]) < 1e-9) loop.pop();
  return loop;
}
/**
 * The same loop with its straight sides split into a fixed number of pieces
 * (`nx` along ±lz sides spanning x, `nz` along ±lx sides spanning z), so
 * concentric apron rings pair up vertex for vertex and setts have joints.
 */
function denseLoop(a: number, b: number, r: number, perCorner: number, nx: number, nz: number): [number, number][] {
  const base = closedLoop(a, b, r, perCorner), outL: [number, number][] = [];
  for (let i = 0; i < base.length; i++) {
    const p = base[i]!, q = base[(i + 1) % base.length]!;
    outL.push(p);
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len < 1e-9 || r > 0 && len < r * 0.9) continue;
    // A straight side: parallel to x (|dz| ≈ 0) or to z.
    const n = Math.abs(q[1] - p[1]) < 1e-9 ? nx : Math.abs(q[0] - p[0]) < 1e-9 ? nz : 1;
    for (let k = 1; k < n; k++) outL.push([p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]);
  }
  return outL;
}
/** Triangulate a contour with one hole. */
function triangulate(contour: [number, number][], hole: [number, number][]): [number, number, number][] {
  const faces = THREE.ShapeUtils.triangulateShape(contour.map(([x, z]) => new THREE.Vector2(x, z)), [hole.map(([x, z]) => new THREE.Vector2(x, z))]);
  return faces.map(f => [f[0]!, f[1]!, f[2]!] as [number, number, number]);
}
