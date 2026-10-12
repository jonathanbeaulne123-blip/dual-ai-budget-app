/**
 * The Highlands (crown) dressing: the shared site rules every part of the module uses. Pure: everything here reads the
 * bake-time world through `DressingContext` (the same world the bake validates against) and the V3 land's own definition
 * (`land/mountainV3`), never a scene or the renderer.
 *
 *  - `onV2Footprint`: Mountain v2's own placed footprint (the region draws it; D-M1/D-M2): no record ever stands on it.
 *  - `Site`: the context plus the module's own claims — every footprint, yard, clearing and sightline the module has
 *    already reserved — so later passes (fields, walls, planting, paint) fill only what is left (STYLE §1.4.1 rule 1).
 */
import type { Point2, Point3 } from '../../world/definition.ts';
import type { DressingContext, PropRecord } from '../types.ts';
import { mountainV2Rule } from '../../land/mountainV2/ground.ts';
import { insideV3Reach } from '../../land/mountainV3/landform.ts';

export const SHOULDER = 110;
export const rad = (d: number) => d * Math.PI / 180;
export const round = (n: number, k = 100) => Math.round(n * k) / k;
export const P3 = (x: number, y: number, z: number): Point3 => [round(x), round(y, 1000), round(z)];

/** Mountain v2's own ground (its massif, its harbour island, the Foot plain): the region draws it, nothing is dressed on it. */
export function onV2Footprint(x: number, z: number): boolean {
  const k = mountainV2Rule(x, z).kind;
  return k === 'land' || k === 'island' || k === 'foot';
}

/** A turned rectangle in plan: centre, half extents along its own x / z, yaw (the contract's frame). */
export interface Rect { x: number; z: number; hx: number; hz: number; yaw: number }
export const rectCorners = (r: Rect, grow = 0): Point2[] => {
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw), hx = r.hx + grow, hz = r.hz + grow;
  return ([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const).map(([lx, lz]) => [r.x + lx * c + lz * s, r.z + lz * c - lx * s] as Point2);
};
/** World point of a local offset in a frame (local +z = front = world (sin yaw, cos yaw)). */
export const local = (x: number, z: number, yaw: number, lx: number, lz: number): Point2 => {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x + lx * c + lz * s, z + lz * c - lx * s];
};
export function inRect(r: Rect, x: number, z: number, grow = 0): boolean {
  const c = Math.cos(r.yaw), s = Math.sin(r.yaw), dx = x - r.x, dz = z - r.z, u = dx * c - dz * s, v = dx * s + dz * c;
  return Math.abs(u) <= r.hx + grow && Math.abs(v) <= r.hz + grow;
}
/** Separating-axis overlap of two turned rectangles grown by `gap`. */
export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  const A = rectCorners(a, gap / 2), B = rectCorners(b, gap / 2);
  for (const poly of [A, B]) for (let i = 0; i < 4; i++) {
    const p = poly[i]!, q = poly[(i + 1) % 4]!, nx = -(q[1] - p[1]), nz = q[0] - p[0];
    const pa = A.map(v => v[0] * nx + v[1] * nz), pb = B.map(v => v[0] * nx + v[1] * nz);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}
export function segDist(x: number, z: number, a: Point2, b: Point2): { d: number; t: number } {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return { d: Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z), t };
}

/** A 3D sightline the module keeps clear (a lookout eye to its targets, the Bight lookout to the cote): anything whose top
 * stands within `half` m of it in plan and above `line − margin` is refused. */
export interface Sight { from: Point3; to: Point3; half: number; margin: number }

export interface Site {
  ctx: DressingContext;
  /** Footprints, yards and clearings already taken (plants, walls and paint keep off them). */
  claims: { rect: Rect; kind: 'building' | 'yard' | 'clearing' | 'stone' }[];
  sights: Sight[];
  h(x: number, z: number): number;
  slope(x: number, z: number, e?: number): number;
  /** Free ground: on V3's reach, off v2's footprint, `margin` clear of beds, pads, water and baked solids, off every claim. */
  free(x: number, z: number, margin?: number, claimGrow?: number): boolean;
  /** Nothing standing at (x, z) up to `top` crosses a kept sightline. */
  clearOfSights(x: number, z: number, top: number): boolean;
  claim(rect: Rect, kind: Site['claims'][number]['kind']): void;
  /** Whether (x, z) lies in a claim (grown by `grow`); `skipStones` ignores the stones' small claims (paint runs through them). */
  claimed(x: number, z: number, grow?: number, skipStones?: boolean): boolean;
  /** Nearest point on any of the named beds, with the segment's plan direction. */
  nearestBed(x: number, z: number, ids: readonly string[]): { d: number; at: Point2; dir: Point2 } | null;
  /** Lowest and highest ground under a rect (corners, edges and centre). */
  groundSpan(r: Rect): { min: number; max: number };
  /** Whether a rect's footprint (grown by `margin`) is all free ground (see `free`). */
  rectFree(r: Rect, margin: number): boolean;
}

export function createSite(ctx: DressingContext): Site {
  const claims: Site['claims'] = [], sights: Sight[] = [];
  const h = (x: number, z: number) => ctx.heightAt(x, z);
  const site: Site = {
    ctx, claims, sights, h,
    slope(x, z, e = 1.5) { return Math.hypot(h(x + e, z) - h(x - e, z), h(x, z + e) - h(x, z - e)) / (2 * e); },
    claimed(x, z, grow = 0, skipStones = false) { return claims.some(c => !(skipStones && c.kind === 'stone') && inRect(c.rect, x, z, grow)); },
    free(x, z, margin = 1, claimGrow = 0) {
      if (!insideV3Reach(x, z) || onV2Footprint(x, z)) return false;
      if (ctx.occupied(x, z, margin)) return false;
      return !site.claimed(x, z, claimGrow);
    },
    clearOfSights(x, z, top) {
      for (const s of sights) {
        const q = segDist(x, z, [s.from[0], s.from[2]], [s.to[0], s.to[2]]);
        if (q.d > s.half) continue;
        const y = s.from[1] + (s.to[1] - s.from[1]) * q.t;
        if (top > y - s.margin) return false;
      }
      return true;
    },
    claim(rect, kind) { claims.push({ rect, kind }); },
    nearestBed(x, z, ids) {
      let best: { d: number; at: Point2; dir: Point2 } | null = null;
      for (const b of ctx.beds) {
        if (!ids.includes(b.id)) continue;
        for (let i = 1; i < b.points.length; i++) {
          const a = b.points[i - 1]!, c = b.points[i]!, A: Point2 = [a[0], a[2]], C: Point2 = [c[0], c[2]], q = segDist(x, z, A, C);
          const d = q.d - (b.width ?? 0) / 2;
          if (!best || d < best.d) { const L = Math.hypot(C[0] - A[0], C[1] - A[1]) || 1; best = { d, at: [A[0] + (C[0] - A[0]) * q.t, A[1] + (C[1] - A[1]) * q.t], dir: [(C[0] - A[0]) / L, (C[1] - A[1]) / L] }; }
        }
      }
      return best;
    },
    groundSpan(r) {
      let min = Infinity, max = -Infinity;
      for (const u of [-1, -.5, 0, .5, 1]) for (const v of [-1, -.5, 0, .5, 1]) { const [x, z] = local(r.x, r.z, r.yaw, u * r.hx, v * r.hz), y = h(x, z); min = Math.min(min, y); max = Math.max(max, y); }
      return { min, max };
    },
    rectFree(r, margin) {
      const nx = Math.max(2, Math.ceil(r.hx / 1.5)), nz = Math.max(2, Math.ceil(r.hz / 1.5));
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
        const [x, z] = local(r.x, r.z, r.yaw, -r.hx + 2 * r.hx * i / nx, -r.hz + 2 * r.hz * j / nz);
        if (!site.free(x, z, margin)) return false;
      }
      return true;
    },
  };
  return site;
}

/** The steepest ground a wall or fence follows (rise per metre along its line). */
export const WALL_GRADE = .22;
/**
 * A linear wall or fence along `pts`, resampled every `step` m and cut into runs wherever the ground is not free (a lane, a
 * pad, water, a baked solid, a claimed footprint, a stretch steeper than `maxGrade`) — the gaps are the gates. Runs shorter than `minRun` are dropped. Heights
 * are the ground's (the prop kit stands walls and fences on the ground under their line).
 */
export function freeRuns(site: Site, pts: readonly Point2[], o: { step?: number; margin?: number; minRun?: number; claimGrow?: number; closed?: boolean; maxGrade?: number; ok?: (x: number, z: number) => boolean } = {}): Point3[][] {
  const step = o.step ?? 1, margin = o.margin ?? 1, minRun = o.minRun ?? 3, maxGrade = o.maxGrade ?? WALL_GRADE, ring = o.closed ? [...pts, pts[0]!] : [...pts];
  const samples: Point2[] = [];
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]!, b = ring[i]!, n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) samples.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  samples.push(ring[ring.length - 1]!);
  const runs: Point3[][] = []; let run: Point2[] = [];
  const flush = () => {
    if (run.length >= 2) {
      let len = 0; for (let i = 1; i < run.length; i++) len += Math.hypot(run[i]![0] - run[i - 1]![0], run[i]![1] - run[i - 1]![1]);
      // Keep corners only (collinear samples dropped), so a run is a few segments, each ground-snapped by the kit.
      if (len >= minRun) runs.push(simplify(run).map(([x, z]) => P3(x, site.h(x, z), z)));
    }
    run = [];
  };
  // A wall never climbs a ledge: where the ground along the line is steeper than `maxGrade`, the run ends (the kit stands
  // each 3 m stretch from its low end's foot to its high end + 1.1, so a steep stretch would stand as a tall slab).
  for (const [x, z] of samples) {
    if (!(site.free(x, z, margin, o.claimGrow ?? 0) && (o.ok?.(x, z) ?? true))) { flush(); continue; }
    const prev = run[run.length - 1];
    if (prev) { const d = Math.hypot(x - prev[0], z - prev[1]); if (d > 1e-6 && Math.abs(site.h(x, z) - site.h(prev[0], prev[1])) / d > maxGrade) flush(); }
    run.push([x, z]);
  }
  flush();
  return runs;
}
function simplify(pts: readonly Point2[]): Point2[] {
  if (pts.length <= 2) return [...pts];
  const out: Point2[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1]!, b = pts[i]!, c = pts[i + 1]!, cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) > 1e-6 || Math.hypot(b[0] - a[0], b[1] - a[1]) > 9) out.push(b);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}
/** Linear prop records (walls, fences) from runs. */
export function linear(kind: PropRecord['kind'], id: string, runs: readonly Point3[][], collide = true): PropRecord[] {
  return runs.map((line, i) => ({ id: `${id}.${i}`, kind, at: line[0]!, yaw: 0, line, collide }));
}

/**
 * The best free, flat site for a `w × d` building near `around`: its front (local +z) toward the nearest of `lanes` (or a
 * fixed `yaw`), its front wall `front[0]…front[1]` m off that lane's edge, the ground under it within `maxSpan`, the whole
 * footprint grown by `margin` free (see `Site.free`), never within `gap` of the rects in `avoid`. Deterministic: candidates
 * on a `step` grid, best score first, ties broken by position.
 */
export function findSite(site: Site, o: { around: Point2; radius: number; step?: number; w: number; d: number; lanes?: readonly string[]; front?: readonly [number, number]; yaw?: number; maxSpan: number; margin: number; avoid?: readonly Rect[]; gap?: number; level?: readonly [number, number]; prefer?: (x: number, z: number) => number }): { rect: Rect; floor: number; lane: number } | null {
  let best: { rect: Rect; floor: number; lane: number; s: number } | null = null; const step = o.step ?? 1;
  for (let x = o.around[0] - o.radius; x <= o.around[0] + o.radius; x += step) for (let z = o.around[1] - o.radius; z <= o.around[1] + o.radius; z += step) {
    if (Math.hypot(x - o.around[0], z - o.around[1]) > o.radius) continue;
    let yaw = o.yaw ?? 0, laneGap = 0;
    if (o.lanes) {
      const lane = site.nearestBed(x, z, o.lanes); if (!lane) continue;
      laneGap = lane.d - o.d / 2; if (o.front && (laneGap < o.front[0] || laneGap > o.front[1])) continue;
      if (o.yaw === undefined) { const dx = lane.at[0] - x, dz = lane.at[1] - z, L = Math.hypot(dx, dz); if (L < .5) continue; yaw = Math.atan2(dx / L, dz / L); }
    }
    const rect: Rect = { x, z, hx: o.w / 2, hz: o.d / 2, yaw };
    if (o.avoid?.some(a => rectsOverlap(a, rect, o.gap ?? 2))) continue;
    const span = site.groundSpan(rect); if (span.max - span.min > o.maxSpan) continue;
    if (o.level && (span.min < o.level[0] || span.max > o.level[1])) continue;
    if (!site.rectFree({ ...rect, hx: rect.hx + o.margin, hz: rect.hz + o.margin }, .2)) continue;
    const s = -(span.max - span.min) * 2 - Math.hypot(x - o.around[0], z - o.around[1]) * .05 + (o.prefer?.(x, z) ?? 0);
    if (!best || s > best.s + 1e-9) best = { rect, floor: span.max + .06, lane: laneGap, s };
  }
  return best ? { rect: best.rect, floor: best.floor, lane: best.lane } : null;
}
