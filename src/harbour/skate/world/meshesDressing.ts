/**
 * Tideline Skate Club v2 · world — what stands round the parks, and each
 * spot's own marks.
 *
 * Two kinds of thing, both purely visual:
 *  - MARKS lie ON the pads (painted rings and dashes, chalk tallies and
 *    scuffs, polish where people ride, stencils). They are paint: nothing to
 *    collide with, and they never cover a lip or an edge.
 *  - DRESSING stands OFF the pads, past the foot of each apron and inside the
 *    spot's keep-out (no trees there): hedges, cut-paper picket flats,
 *    lanterns, bleachers, bunting, a gateway at Tideline, lobster pots at the
 *    pier, an apple crate at the orchard, a rope edge on the promenade. None
 *    of it is in `field.solids`; every piece is listed in `out.dressing` so
 *    integration can give the upright ones colliders if it wants them.
 *
 * Placement is authored per spot as runs along a pad side; each piece finds
 * where the apron meets the lawn and stands a little beyond it, and a piece
 * that would land on a lane, a route, the sea or past the keep-out is simply
 * left out. `test/skate-world-mesh.test.ts` proves the rest.
 */
import type { SkateWorldField, PadRuntime } from './field.ts';
import { LANE_HALF_WIDTH } from './field.ts';
import { ROUTES } from './layout.ts';
import { frameToWorld } from './profiles.ts';
import { HARBOUR_LAND, HARBOUR_LANES, distanceToTrail } from '../../village/world.ts';
import { ICON, INK_LIFT, hash2, lift, mix, shade, type Kit, type ParkMeshData, type RGB, type V3 } from './meshesKit.ts';

export type DressColours = Record<
  'pad' | 'padAlt' | 'padWarm' | 'concrete' | 'wall' | 'wood' | 'woodAlt' | 'woodDeck' | 'woodSide' | 'coping' | 'rail' | 'steel' | 'ink' | 'pencil' | 'chalk' | 'shadow'
  | 'paint' | 'curb' | 'stencil' | 'planter' | 'soil' | 'leaf' | 'bloom' | 'hedge' | 'fence' | 'fenceAlt' | 'lantern' | 'post', RGB>;
export type DressContext = {
  out: ParkMeshData; K: Kit; C: DressColours; field: SkateWorldField; full: boolean;
  onFeature(p: PadRuntime, x: number, z: number, pad?: number): boolean;
  lanternPost(x: number, z: number, base: number, top: number): void;
};

type Side = '+x' | '-x' | '+z' | '-z';
/**
 * How far past the pad edge dressing may stand. The keep-out allowance is 2.2 and trees keep
 * their own clearance beyond it; the test checks every piece against both planting tiers.
 */
const MAX_OUT = 3.2;

export function dressPark(ctx: DressContext): void {
  const { out, K, C, field, full } = ctx;
  const pads = new Map(field.pads.map(p => [p.id, p] as const));
  const inkSoft = (c: RGB, k = 0.35) => mix(C.ink, c, k);

  /* ---------------------------------------------------------------- placement */
  const sideAxes = (p: PadRuntime, side: Side, t: number) => {
    const [hx, hz] = p.half;
    return side === '+z' ? { lx: t, lz: hz, ox: 0, oz: 1 } : side === '-z' ? { lx: t, lz: -hz, ox: 0, oz: -1 }
      : side === '+x' ? { lx: hx, lz: t, ox: 1, oz: 0 } : { lx: -hx, lz: t, ox: -1, oz: 0 };
  };
  /** Distance past the pad edge where the apron has met the lawn. */
  const footAt = (p: PadRuntime, lx: number, lz: number, ox: number, oz: number): number => {
    const off = (e: number) => { const [x, z] = frameToWorld(p.frame, lx + ox * e, lz + oz * e); return field.heightAt(x, z) <= field.ground(x, z) + 1e-4; };
    let lo = 0, hi = -1;
    for (let e = 0.2; e < 3.6; e += 0.2) { if (off(e)) { hi = e; break; } lo = e; }
    if (hi < 0) return 3.6;
    for (let k = 0; k < 5; k++) { const m = (lo + hi) / 2; if (off(m)) hi = m; else lo = m; }
    return hi;
  };
  const segDist = (x: number, z: number, a: readonly number[], b: readonly number[]) => {
    const dx = b[0]! - a[0]!, dz = b[1]! - a[1]!, l = dx * dx + dz * dz; let t = l ? ((x - a[0]!) * dx + (z - a[1]!) * dz) / l : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - a[0]! - t * dx, z - a[1]! - t * dz);
  };
  /** Off every pad and apron, the lanes, the routes and the sea. */
  const clear = (x: number, z: number, r: number): boolean => {
    if (Math.hypot(x, z) > HARBOUR_LAND.shore - 1.2 - r) return false;
    for (const l of HARBOUR_LANES) if (distanceToTrail(x, z, l.points) < LANE_HALF_WIDTH + r + 0.3) return false;
    for (const route of ROUTES) for (let i = 1; i < route.points.length; i++) if (segDist(x, z, route.points[i - 1]!, route.points[i]!) < 1.1 + r) return false;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (field.heightAt(px, pz) > field.ground(px, pz) + 1e-4) return false; }
    return field.heightAt(x, z) <= field.ground(x, z) + 1e-4;
  };
  /**
   * A dressing spot `extra` past the apron's foot on `side` at `t` (local, along the side),
   * with footprint radius `r` and a `depth` behind it; null when it would not be clear.
   */
  const spotAt = (p: PadRuntime, side: Side, t: number, extra: number, r: number, depth = 0) => {
    const { lx, lz, ox, oz } = sideAxes(p, side, t);
    const e = footAt(p, lx, lz, ox, oz) + extra;
    if (e + depth > MAX_OUT) return null;
    const [x, z] = frameToWorld(p.frame, lx + ox * e, lz + oz * e);
    if (!clear(x, z, r)) return null;
    const yaw = p.frame.yaw + (side === '+x' || side === '-x' ? Math.PI / 2 : 0);
    return { x, z, y: field.ground(x, z), e, yaw, ox, oz };
  };
  const note = (id: string, spot: string, x: number, z: number, r: number, top: number) => out.dressing.push({ id, spot, x, z, r, top });
  const along = (p: PadRuntime, side: Side, t0: number, t1: number, step: number, fn: (t: number, i: number) => void) => {
    const [hx, hz] = p.half, lim = (side === '+z' || side === '-z' ? hx : hz) - p.corner;
    const a = Math.max(t0, -lim), b = Math.min(t1, lim), n = Math.max(1, Math.floor((b - a) / step));
    for (let i = 0; i < n; i++) fn(a + (b - a) * (i + 0.5) / n, i);
  };

  /* ---------------------------------------------------------------- pieces */
  /** A clipped hedge: a run of leafy card blocks, lighter on top, flecked with blooms. */
  function hedge(p: PadRuntime, side: Side, t0: number, t1: number, extra = 0.45): void {
    along(p, side, t0, t1, 0.85, (t, i) => {
      const s = spotAt(p, side, t, extra, 0.26, 0.25); if (!s) return;
      const h = 0.44 + 0.12 * hash2(i, t * 10 | 0), top = mix(C.hedge, C.leaf, 0.2), sideC = shade(C.hedge, 0.82);
      const alongX = side === '+z' || side === '-z';
      K.box(out.card, s.x, s.z, p.frame.yaw, alongX ? 0.41 : 0.24, alongX ? 0.24 : 0.41, s.y - 0.08, s.y + h, shade(top, 1.08), sideC, inkSoft(C.hedge, 0.45), 0.62);
      // Blooms: little card pyramids on top.
      const nb = full ? 3 : 1;
      for (let k = 0; k < nb; k++) {
        const u = (hash2(i * 7 + k, 3) - 0.5) * 0.66, v = (hash2(i * 7 + k, 9) - 0.5) * 0.3;
        const c = Math.cos(p.frame.yaw), sn = Math.sin(p.frame.yaw);
        const lx = alongX ? u : v, lz = alongX ? v : u, bx = s.x + lx * c + lz * sn, bz = s.z + lz * c - lx * sn, by = s.y + h;
        const r = 0.06, tip: V3 = [bx, by + 0.09, bz];
        for (let q = 0; q < 3; q++) { const a0 = q * 2.094 + k, a1 = a0 + 2.094; K.tri(out.card, [bx + Math.cos(a0) * r, by, bz + Math.sin(a0) * r], [bx + Math.cos(a1) * r, by, bz + Math.sin(a1) * r], tip, (i + k) % 2 ? C.bloom : mix(C.bloom, C.chalk, 0.4)); }
      }
      K.shadeQuad(...ground4(s.x, s.z, p.frame.yaw, alongX ? 0.55 : 0.36, alongX ? 0.36 : 0.55), C.shadow, 0.22, 0.22);
      note(`${p.id}-hedge-${side}-${i}`, p.id, s.x, s.z, 0.42, s.y + h);
    });
  }
  /** Picket flats: a cut-paper fence, a panel per piece, inked round its silhouette. */
  function fence(p: PadRuntime, side: Side, t0: number, t1: number, extra = 0.3, alt = false): void {
    const L = 1.5;
    along(p, side, t0, t1, L + 0.05, (t, i) => {
      const { ox, oz } = sideAxes(p, side, t);
      const tx = side === '+z' || side === '-z' ? 1 : 0, tz = 1 - tx; // along-side direction in local
      const a = spotAt(p, side, t - (L / 2) * (tx + tz), extra, 0.08), b = spotAt(p, side, t + (L / 2) * (tx + tz), extra, 0.08), m = spotAt(p, side, t, extra, 0.12);
      if (!a || !b || !m) return;
      void ox; void oz;
      const outline: [number, number][] = [[0, 0], [L, 0]];
      // Walk back along the top: posts at the ends, pickets between, a rail line at 0.2.
      const pickets: [number, number][] = [];
      const pw = 0.09, gap = 0.07, n = Math.floor((L - 0.28) / (pw + gap));
      const x0 = (L - (n * (pw + gap) - gap)) / 2;
      pickets.push([L, 0.66], [L - 0.07, 0.72], [L - 0.14, 0.66], [L - 0.14, 0.22]);
      for (let k = n - 1; k >= 0; k--) {
        const u0 = x0 + k * (pw + gap), u1 = u0 + pw, hgt = 0.5 + 0.035 * Math.sin((k / Math.max(1, n - 1)) * Math.PI);
        pickets.push([u1, 0.22], [u1, hgt], [(u0 + u1) / 2, hgt + 0.06], [u0, hgt], [u0, 0.22]);
      }
      pickets.push([0.14, 0.22], [0.14, 0.66], [0.07, 0.72], [0, 0.66]);
      const outlineAll = [...outline, ...pickets.filter(([u]) => u <= L + 1e-9 && u >= -1e-9)];
      const colour = alt && i % 2 ? C.fenceAlt : C.fence;
      K.flat(out.card, outlineAll, [a.x, a.y - 0.04, a.z], [b.x, b.y - 0.04, b.z], colour, inkSoft(colour, 0.25));
      // Its rail, a darker board across the pickets' backs.
      K.shadeQuad([a.x, a.y + 0.004, a.z], [b.x, b.y + 0.004, b.z], [b.x + (m.ox * Math.cos(p.frame.yaw) + m.oz * Math.sin(p.frame.yaw)) * 0.35, b.y + 0.004, b.z + (m.oz * Math.cos(p.frame.yaw) - m.ox * Math.sin(p.frame.yaw)) * 0.35], [a.x + (m.ox * Math.cos(p.frame.yaw) + m.oz * Math.sin(p.frame.yaw)) * 0.35, a.y + 0.004, a.z + (m.oz * Math.cos(p.frame.yaw) - m.ox * Math.sin(p.frame.yaw)) * 0.35], C.shadow, 0.2, 0);
      note(`${p.id}-fence-${side}-${i}`, p.id, m.x, m.z, L / 2, m.y + 0.72);
    });
  }
  function lamp(p: PadRuntime, side: Side, t: number, extra = 0.35): void {
    const s = spotAt(p, side, t, extra, 0.25); if (!s) return;
    ctx.lanternPost(s.x, s.z, s.y, s.y + 1.75);
    K.shadeQuad(...ground4(s.x, s.z, 0, 0.2, 0.2), C.shadow, 0.3, 0.3);
    note(`${p.id}-lamp-${side}-${Math.round(t * 10)}`, p.id, s.x, s.z, 0.18, s.y + 1.75);
  }
  /** Three timber tiers facing the pad (the spectators' bench). */
  function bleachers(p: PadRuntime, side: Side, t: number, length = 3.4): void {
    const s = spotAt(p, side, t, 0.35, 0.3, 1.1); if (!s) return;
    const ends = [spotAt(p, side, t - length / 2, 0.35, 0.3, 1.1), spotAt(p, side, t + length / 2, 0.35, 0.3, 1.1)];
    if (!ends[0] || !ends[1]) return;
    const yaw = p.frame.yaw, alongX = side === '+z' || side === '-z';
    const c = Math.cos(yaw), sn = Math.sin(yaw), oxw = s.ox * c + s.oz * sn, ozw = s.oz * c - s.ox * sn;
    const base = Math.min(s.y, ends[0].y, ends[1].y) - 0.06;
    for (let k = 0; k < 3; k++) {
      const d = 0.2 + k * 0.4, x = s.x + oxw * d, z = s.z + ozw * d, h = base + 0.34 + k * 0.28;
      K.box(out.card, x, z, yaw, alongX ? length / 2 : 0.21, alongX ? 0.21 : length / 2, base, h, k % 2 ? C.woodAlt : C.wood, C.woodSide, inkSoft(C.woodSide, 0.2), 0.7);
      if (full) { const q = (u: number): V3 => { const lx = alongX ? u : 0, lz = alongX ? 0 : u; return [x + lx * c + lz * sn, h + INK_LIFT, z + lz * c - lx * sn]; }; K.line(q(-length / 2), q(length / 2), inkSoft(C.wood, 0.5)); }
    }
    note(`${p.id}-bleachers`, p.id, s.x + oxw * 0.6, s.z + ozw * 0.6, length / 2, base + 0.9);
  }
  /** Paper flags on a string between world points (sagging), colours cycling. */
  function bunting(points: V3[], sag = 0.3): void {
    const cols = [C.paint, C.curb, C.fence, C.fenceAlt];
    let flag = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!, len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(2, Math.round(len / 0.3));
      const at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * Math.min(1, len / 10) * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
      for (let k = 0; k < n; k++) {
        const p0 = at(k / n), p1 = at((k + 1) / n);
        K.line(p0, p1, inkSoft(C.post, 0.2));
        if (k % 2 === 0 && (full || k % 4 === 0)) {
          const q0 = at((k + 0.15) / n), q1 = at((k + 0.85) / n), mid: V3 = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2 - 0.2, (q0[2] + q1[2]) / 2];
          K.tri(out.card, q0, q1, mid, cols[flag++ % cols.length]!, 0.02);
        }
      }
    }
  }
  const ground4 = (x: number, z: number, yaw: number, hx: number, hz: number): [V3, V3, V3, V3] => {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx: number, lz: number): V3 => { const px = x + lx * c + lz * s, pz = z + lz * c - lx * s; return [px, field.ground(px, pz) + 0.012, pz]; };
    return [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
  };

  /* ---------------------------------------------------------------- marks on the pads */
  const Wp = (p: PadRuntime, lx: number, lz: number, h = 0): V3 => K.W(p.frame, p.plane, lx, lz, h);
  /** A soft band of polish (lighter) along a line people ride, off the features. */
  function polish(p: PadRuntime, a: [number, number], b: [number, number], width: number, alpha: number): void {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 0.5)), nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, P = (t: number, o: number) => lift(Wp(p, a[0] + (b[0] - a[0]) * t + nx * o * width / 2, a[1] + (b[1] - a[1]) * t + nz * o * width / 2), 0.005);
      const mid = Wp(p, a[0] + (b[0] - a[0]) * (t0 + t1) / 2, a[1] + (b[1] - a[1]) * (t0 + t1) / 2);
      if (ctx.onFeature(p, mid[0], mid[2], 0.1)) continue;
      const fade = Math.sin(Math.PI * (t0 + t1) / 2) * alpha;
      K.shadeQuad(P(t0, 0), P(t1, 0), P(t1, 1), P(t0, 1), C.chalk, fade, 0);
      K.shadeQuad(P(t0, 0), P(t1, 0), P(t1, -1), P(t0, -1), C.chalk, fade, 0);
    }
  }
  /** Chalk strokes: a list of local polylines on the pad. */
  function chalk(p: PadRuntime, strokes: readonly (readonly [number, number])[][], h = 0): void {
    const c = mix(C.chalk, C.pad, 0.12);
    for (const s of strokes) for (let i = 1; i < s.length; i++) K.line(lift(Wp(p, s[i - 1]![0], s[i - 1]![1], h), 0.0045), lift(Wp(p, s[i]![0], s[i]![1], h), 0.0045), c);
  }
  /** Scuffs: short skids of chalk-pale rubber-free marks scattered round a point. */
  function scuffs(p: PadRuntime, cx: number, cz: number, spread: number, n: number, heading: number, seed: number): void {
    const strokes: [number, number][][] = [];
    for (let k = 0; k < n; k++) {
      const x = cx + (hash2(seed, k) - 0.5) * spread * 2, z = cz + (hash2(k, seed) - 0.5) * spread, a = heading + (hash2(seed + k, 5) - 0.5) * 0.5, l = 0.25 + hash2(k, seed + 2) * 0.35;
      const [wx, wz] = frameToWorld(p.frame, x, z);
      if (ctx.onFeature(p, wx, wz, 0.2)) continue;
      strokes.push([[x, z], [x + Math.cos(a) * l * 0.5, z + Math.sin(a) * l * 0.5 + 0.01], [x + Math.cos(a) * l, z + Math.sin(a) * l]]);
    }
    chalk(p, strokes);
  }
  /** Tally marks (a gate of five and the rest), chalked at local (x, z) along +x. */
  function tally(p: PadRuntime, x: number, z: number, count: number, h = 0): void {
    const strokes: [number, number][][] = [];
    for (let k = 0; k < count; k++) {
      const g = Math.floor(k / 5), i = k % 5, gx = x + g * 0.62;
      if (i < 4) strokes.push([[gx + i * 0.1, z - 0.18], [gx + i * 0.1 + 0.015, z + 0.18]]);
      else strokes.push([[gx - 0.06, z - 0.12], [gx + 0.37, z + 0.1]]);
    }
    chalk(p, strokes, h);
  }
  const stencil = (p: PadRuntime, lx: number, lz: number, r: number, icon: number, color: RGB, rot = 0, h = 0) => K.topStencil(p.frame, p.plane, lx, lz, h, r, icon, color, rot);
  const dashes = (p: PadRuntime, a: [number, number], b: [number, number], dash: number, gapL: number, width: number, color: RGB) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
    for (let s = 0; s + dash <= len + 1e-9; s += dash + gapL) K.strip(out.paint, p.frame, p.plane, [a[0] + ux * s, a[1] + uz * s], [a[0] + ux * (s + dash), a[1] + uz * (s + dash)], 0, width, color);
  };

  /* ================================================================ Tideline */
  const tide = pads.get('tideline');
  if (tide) {
    // The painted round where every session starts (a year in the round), a hearth at its heart.
    K.ring(out.paint, tide.frame, tide.plane, -1.6, 0.4, 1.7, 0.09, C.paint, full ? 48 : 28);
    K.ring(out.paint, tide.frame, tide.plane, -1.6, 0.4, 1.5, 0.03, C.paint, full ? 48 : 28);
    stencil(tide, -1.6, 0.4, 0.62, ICON.hearth, C.paint, Math.PI);
    // …ticked for the twelve months round its rim (the year in the round).
    for (let m = 0; m < 12; m++) {
      const a = m / 12 * Math.PI * 2, r0 = m % 3 === 0 ? 1.28 : 1.36, r1 = 1.47;
      K.strip(out.paint, tide.frame, tide.plane, [-1.6 + Math.cos(a) * r0, 0.4 + Math.sin(a) * r0], [-1.6 + Math.cos(a) * r1, 0.4 + Math.sin(a) * r1], 0, m % 3 === 0 ? 0.07 : 0.045, C.paint);
    }
    // A trail of kitty paws out of the ring (the cat has been skating too).
    for (let i = 0; i < 6; i++) stencil(tide, -0.4 + i * 0.55, 4.6 + (i % 2) * 0.22, 0.11, ICON.paw, C.stencil, -Math.PI / 2);
    // The runway to the Chimney and the long lane under the Lantern Steps are ridden smooth.
    if (full) {
      polish(tide, [-2.4, -6.5], [10.3, -6.5], 1.3, 0.16);
      polish(tide, [7.0, 5.6], [-2.2, 5.6], 1.0, 0.12);
      polish(tide, [11.8, -0.3], [11.8, 2.4], 0.9, 0.1);
      scuffs(tide, 9.9, -6.4, 0.6, 9, 0, 11);
      scuffs(tide, -0.5, 2.5, 0.8, 7, Math.PI, 23);
      // Somebody counted their kickflips on the Hatch.
      tally(tide, 4.6, 4.3, 7);
    }
    // Chalk arrows for the lines: toward the Chimney, and round to the Hatch.
    stencil(tide, 0.6, -5.1, 0.34, ICON.arrow, mix(C.chalk, C.pad, 0.15), 0);
    stencil(tide, 10.2, 2.6, 0.3, ICON.arrow, mix(C.chalk, C.pad, 0.15), Math.PI);
    stencil(tide, -0.2, 8.4, 0.3, ICON.star, C.stencil, 0.3);

    // Round the edge: fence flats and a hedge along the shore side with bleachers between,
    // a hedge on the Northlight end, fence on the village side either side of the gate.
    fence(tide, '+z', -12.8, -2.6, 0.3, false);
    fence(tide, '+z', 3.6, 12.8, 0.3, false);
    hedge(tide, '+z', -12.8, -2.6, 1.05);
    hedge(tide, '+z', 3.6, 12.8, 1.05);
    bleachers(tide, '+z', 0.5, 3.6);
    hedge(tide, '+x', -5.6, 8.4, 0.4);
    fence(tide, '-z', -12.8, -2.4, 0.3, true);
    fence(tide, '-z', 6.4, 12.8, 0.3, true);
    for (const t of [-7.7, 8.1]) lamp(tide, '+z', t, 0.35);
    lamp(tide, '+x', 2, 1.1);
    for (const t of [-8, 10.4]) lamp(tide, '-z', t, 0.35);

    // The gateway: the sign's posts rise into a proscenium with a cut-paper valance and lantern finials;
    // bunting runs from its finials out to two masts, high over the village-side walk (well above a chase camera).
    const sign = out.signs.find(s => s.id === 'tideline');
    if (sign) {
      const fin = gateway(sign.x, sign.y, sign.z, sign.yaw, sign.w);
      for (const [t, k] of [[-7.4, 0], [11.2, 1]] as const) {
        const m = spotAt(tide, '-z', t, 0.4, 0.12); if (!m) continue;
        K.cylinder(out.card, m.x, m.z, m.y - 0.1, m.y + 3.3, 0.05, C.post, 6);
        K.tri(out.card, [m.x, m.y + 3.3, m.z], [m.x, m.y + 3.02, m.z], [m.x + 0.36 * Math.cos(sign.yaw), m.y + 3.16, m.z - 0.36 * Math.sin(sign.yaw)], C.paint, 0.02);
        note(`tideline-mast-${k}`, 'tideline', m.x, m.z, 0.08, m.y + 3.3);
        const near = fin.reduce((a, b) => (Math.hypot(b[0] - m.x, b[2] - m.z) < Math.hypot(a[0] - m.x, a[2] - m.z) ? b : a));
        bunting([[m.x, m.y + 3.1, m.z], near], 0.35);
      }
    }
  }
  /** Builds the gateway; returns its two finial tops (left, right) for the bunting. */
  function gateway(x: number, y: number, z: number, yaw: number, w: number): V3[] {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (u: number, v: number, d = 0): V3 => [x + c * u + s * d, y + v, z - s * u + c * d];
    const half = w / 2 - 0.25, top = 2.3;
    for (const u of [-half, half]) {
      const [px, , pz] = P(u, 0);
      K.cylinder(out.card, px, pz, y + 1.3, y + top, 0.055, C.post, 6);
      ctx.lanternPost(px, pz, y + top - 0.05, y + top + 0.42);
    }
    // Beam and valance (scalloped, a theatre's pelmet cut from card).
    const beam0 = P(-half - 0.3, top - 0.16), beam1 = P(half + 0.3, top - 0.16);
    K.box(out.card, (beam0[0] + beam1[0]) / 2, (beam0[2] + beam1[2]) / 2, yaw, half + 0.3, 0.09, y + top - 0.2, y + top, C.woodDeck, C.woodSide, inkSoft(C.woodDeck, 0.3));
    const L = 2 * half + 0.4, nS = 7, sw = L / nS;
    const sc: [number, number][] = [[0, 0.24], [L, 0.24], [L, 0.12]];
    for (let k = nS - 1; k >= 0; k--) for (let q = 1; q <= 4; q++) sc.push([(k + 1) * sw - q / 4 * sw, 0.12 - 0.12 * Math.sin(Math.PI * q / 4)]);
    sc.pop(); // (0, 0.12) closes onto (0, 0.24)
    sc.push([0, 0.12]);
    const v0 = P(-half - 0.2, top - 0.44, -0.1), v1 = P(half + 0.2, top - 0.44, -0.1);
    K.flat(out.card, sc, v0, v1, C.fenceAlt, inkSoft(C.fenceAlt, 0.25), true);
    for (const u of [-half, half]) { const [px, , pz] = P(u, 0); K.shadeQuad(...ground4(px, pz, yaw, 0.25, 0.25), C.shadow, 0.28, 0.28); }
    const [gx, , gz] = P(0, 0);
    note('tideline-gateway', 'tideline', gx, gz, half + 0.3, y + top + 0.42);
    return [-half, half].map(u => { const q = P(u, top + 0.3); return q; });
  }

  /* ================================================================ street spots */
  const bookends = pads.get('bookends');
  if (bookends) {
    // Book spines painted down the bookends' long faces.
    const spineCols = [C.paint, C.curb, C.stencil, C.fenceAlt, C.fence];
    for (const pl of bookends.planters) {
      const [hx, hz] = pl.def.half, h = pl.def.height;
      for (const sz of [-1, 1]) {
        const n = full ? 9 : 5, w = (2 * hx - 0.3) / n;
        for (let k = 0; k < n; k++) {
          const u0 = -hx + 0.15 + k * w + 0.02, u1 = u0 + w - 0.04, top = h - 0.06 - 0.05 * hash2(k, sz + 5);
          const P = (u: number, v: number): V3 => { const q = K.W(pl.frame, pl.plane, u, sz * (hz + 0.006), v); return q; };
          K.quad(out.paint, P(u0, 0.06), P(u1, 0.06), P(u1, top), P(u0, top), spineCols[(k + (sz > 0 ? 2 : 0)) % spineCols.length]!, 0.03);
          if (full) K.line(P((u0 + u1) / 2 - 0.03, top - 0.08), P((u0 + u1) / 2 + 0.03, top - 0.08), inkSoft(C.fence, 0.3));
        }
      }
    }
    stencil(bookends, 0, 0, 0.45, ICON.star, C.stencil, 0.2);
    if (full) scuffs(bookends, 0, 0.1, 1.2, 6, 0, 41);
    hedge(bookends, '-x', -2.6, 2.6, 0.35);
    hedge(bookends, '-z', -4.0, -0.9, 0.35);
    lamp(bookends, '+x', 0.5, 0.35);
  }
  const fund = pads.get('fundsteps');
  if (fund) {
    // Coins stamped in the counting-house landing, six chalk tallies at the foot of the Six.
    for (const [lx, lz] of [[3.2, -1.1], [3.8, 0.3], [2.6, 1.2]] as const) stencil(fund, lx, lz, 0.26, ICON.coin, C.curb, lx, 0.72);
    tally(fund, -1.6, -0.6, 6);
    if (full) scuffs(fund, -1.2, 0.3, 0.7, 6, Math.PI, 57);
    hedge(fund, '+x', -3.6, 3.6, 0.35);
    fence(fund, '+z', -4.2, 1.8, 0.3, true);
    lamp(fund, '+z', 3.2, 0.3);
  }
  const dock = pads.get('drydock');
  if (dock) {
    stencil(dock, 0, -6.2, 0.4, ICON.wave, C.stencil);
    stencil(dock, -1.6, 2.5, 0.22, ICON.shell, C.stencil, 0.6);
    // Lobster pots and a stack of buoys on the shore beside the pier.
    for (const [t, k] of [[3.0, 0], [4.1, 1]] as const) {
      const s = spotAt(dock, '-x', t, 0.5, 0.35); if (!s) continue;
      const yaw = dock.frame.yaw + k * 0.4;
      K.box(out.card, s.x, s.z, yaw, 0.32, 0.22, s.y - 0.04, s.y + 0.34, mix(C.woodDeck, C.fence, 0.25), C.woodSide, inkSoft(C.woodSide, 0.1));
      // Its hoops, in ink.
      for (const u of [-0.2, 0, 0.2]) { const c = Math.cos(yaw), sn = Math.sin(yaw), P = (lz: number, v: number): V3 => [s.x + u * c + lz * sn, s.y + v, s.z + lz * c - u * sn]; K.line(P(-0.22, 0.345), P(0.22, 0.345), C.ink); }
      note(`drydock-pot-${k}`, 'drydock', s.x, s.z, 0.35, s.y + 0.34);
    }
    const b = spotAt(dock, '-x', 1.6, 0.45, 0.3);
    if (b) {
      for (const [dx, dz, col] of [[0, 0, C.fenceAlt], [0.26, 0.1, C.curb], [0.1, 0.26, C.fence]] as const) {
        K.cylinder(out.card, b.x + dx, b.z + dz, b.y - 0.03, b.y + 0.3, 0.12, col, 8);
        K.cylinder(out.card, b.x + dx, b.z + dz, b.y + 0.3, b.y + 0.38, 0.05, C.post, 6);
      }
      note('drydock-buoys', 'drydock', b.x + 0.12, b.z + 0.12, 0.35, b.y + 0.38);
    }
    lamp(dock, '+x', -4.2, 0.3);
  }
  const orchard = pads.get('orchard');
  if (orchard) {
    for (const lx of [-4.6, 4.6]) stencil(orchard, lx, 0, 0.2, ICON.apple, C.bloom, lx);
    hedge(orchard, '+z', -5.2, 5.2, 0.35);
    // An apple crate and a few windfalls on the grass at the culvert's mouth.
    const s = spotAt(orchard, '-z', 3.4, 0.5, 0.4);
    if (s) {
      K.box(out.card, s.x, s.z, orchard.frame.yaw + 0.25, 0.34, 0.24, s.y - 0.04, s.y + 0.32, C.soil, C.woodDeck, inkSoft(C.woodDeck, 0.2));
      for (let k = 0; k < (full ? 7 : 3); k++) {
        const ax = s.x + (hash2(k, 71) - 0.5) * 0.5, az = s.z + (hash2(71, k) - 0.5) * 0.34;
        K.box(out.card, ax, az, k, 0.055, 0.055, s.y + 0.3, s.y + 0.39, C.bloom, shade(C.bloom, 0.8), null);
      }
      for (let k = 0; k < (full ? 5 : 2); k++) {
        const ax = s.x + (hash2(k, 13) - 0.2) * 1.6, az = s.z + (hash2(13, k) - 0.5) * 1.2, gy = field.ground(ax, az);
        if (field.heightAt(ax, az) > gy + 1e-4) continue;
        K.box(out.card, ax, az, k, 0.05, 0.05, gy - 0.01, gy + 0.08, C.bloom, shade(C.bloom, 0.8), null);
      }
      note('orchard-crate', 'orchard', s.x, s.z, 0.4, s.y + 0.39);
    }
  }
  const north = pads.get('northlight');
  if (north) {
    // A runway down the run, the light's star at the top.
    dashes(north, [0, 3.0], [0, -5.4], 0.45, 0.35, 0.09, C.paint);
    stencil(north, 0, 6.2, 0.4, ICON.star, C.paint);
    if (full) scuffs(north, 0.2, -1, 0.5, 6, Math.PI / 2, 83);
    fence(north, '-x', -6.4, 6.4, 0.3, true);
    lamp(north, '-x', 7.0, 0.3);
  }
  const pools = pads.get('tidepools');
  if (pools) {
    for (const [lx, lz, r] of [[0.1, -3.6, 0.2], [-0.4, 3.9, 0.17], [0.6, 1.7, 0.14], [-0.2, -1.6, 0.15]] as const) stencil(pools, lx, lz, r, ICON.shell, C.stencil, lx * 5);
    stencil(pools, 0.1, 4.6, 0.3, ICON.wave, C.stencil);
    // A rope-and-post edge on the sea side.
    const posts: V3[] = [];
    along(pools, '-x', -4.4, 4.4, 1.45, t => { const s = spotAt(pools, '-x', t, 0.35, 0.1); if (!s) return; K.cylinder(out.card, s.x, s.z, s.y - 0.05, s.y + 0.62, 0.05, C.post, 6); posts.push([s.x, s.y + 0.52, s.z]); note(`tidepools-rope-${posts.length}`, 'tidepools', s.x, s.z, 0.08, s.y + 0.62); });
    for (let i = 1; i < posts.length; i++) {
      const a = posts[i - 1]!, b = posts[i]!, n = 6;
      for (let k = 0; k < n; k++) { const P = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 0.12 * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; K.line(P(k / n), P((k + 1) / n), mix(C.woodDeck, C.curb, 0.4)); }
    }
  }
}
