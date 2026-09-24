import {SKILL_BRANCHES,TOWN_RACE_ROAD,nearestOnRoute} from '../../mountain/definition.ts';
import {queryWorldSurface,WORLD_SURFACES} from '../../mountain/surfaces.ts';
import {overheadAt} from '../../body/overhead.ts';
/**
 * Tideline Skate Club v2 · world — the SkateField the sim rides on.
 *
 * `createSkateField(ground)` turns `layout.ts` into:
 *  - `sample(x, z)`: height, exact unit normal, surface kind, feature id and
 *    lip flag for any point on the island — the island's own ground, every
 *    spot's concrete pad and apron, and every ramp/bowl/stair/ledge top;
 *  - `grindables`: coping, ledges, hubbas, benches, curbs and rails as top
 *    polylines that sit exactly where `meshes.ts` draws them;
 *  - `solids`: the never-rideable things (posts, planters, lanterns);
 *  - `spots`: where each spot is and where a session starts.
 *
 * Composition rule: the surface is the MAX of the island ground, each pad
 * (a plane fitted over the ground, falling to the lawn through a C1 apron),
 * and each feature (pad plane + the feature's own profile). Rideable blocks
 * (ledges, manual pads, stair treads, platforms, funbox tops, bench seats)
 * are in the heightfield at their TOP; the sim treats a grounded upward step
 * over ~0.06 that is not a transition as a wall.
 *
 * Normals: analytic everywhere on skate surfaces. On open island ground they
 * are a central difference (h = 1e-3) of the injected ground function, which is
 * smooth, so they carry no sampling noise.
 *
 * Allocation: `sample()` returns a FRESH small object each call (plus a fresh
 * `lip` object on lips) so callers may keep it. Hot loops that sample many
 * times per step can call `sampleInto(x, z, out)` (writes into `out`, allocates
 * only a `lip` object on lip strips) or `heightAt(x, z)` (height only).
 */
import type { Grindable, GrindableKind, SkateField, SkateSolid, SkateSpot, SurfaceKind, SurfaceSample } from '../contract.ts';
import { HARBOUR_LAND, HARBOUR_LANES } from '../../village/world.ts';
import { composeFrame, frameToWorld, gradToWorld, roundRectLoop, sdRoundRect, wrapAngle, type Frame } from './profiles.ts';
import {
  BowlShape, BoxShape, COPE_TOP, FunboxShape, HubbaShape, MiniShape, QuarterShape, RAIL_RADIUS, isSurfaceDef, makeShape, newHit, planeAt,
  type LedgeSide, type Plane, type PlanterDef, type PostDef, type RailDef, type SurfaceShape,
} from './features.ts';
import { SPOTS, SPOT_LAYOUTS, type SpotLayout } from './layout.ts';

/** Pads sit this far over the ground they are fitted to (v1 used 0.035; lanes draw at 0.035). */
export const PAD_LIFT = 0.04;
/** What the fitted plane actually clears the ground by at its sample points (lift plus a hair for curvature between samples). */
export const PAD_FIT_LIFT = PAD_LIFT + 0.002;
/** Apron: the pad's edge falls to the lawn at this slope, through a fillet of this length. */
export const APRON_SLOPE = 0.35;
export const APRON_FILLET = 0.4;
/** Half-width of a lane ribbon (`village/lanes.ts`). */
export const LANE_HALF_WIDTH = 0.9;
/** tan 84°: the steepest surface the contract allows (ny ≥ ~0.1). */
const MAX_SLOPE = Math.tan(84 * Math.PI / 180);

export type SkateFieldOptions = { tier?: 'full' | 'lite' };

export type PadRuntime = {
  readonly layout: SpotLayout;
  readonly id: string;
  /** The pad's own frame (spot frame shifted to the pad centre). */
  readonly frame: Frame;
  readonly spotFrame: Frame;
  readonly plane: Plane;
  readonly half: readonly [number, number];
  readonly corner: number;
  /** Largest fill (plane − ground) along the pad edge, and how far the apron reaches before the lawn takes over. */
  readonly maxFill: number;
  readonly reach: number;
  readonly shapes: readonly SurfaceShape[];
  readonly rails: readonly RailRuntime[];
  readonly planters: readonly PlanterRuntime[];
  readonly posts: readonly PostRuntime[];
};
export type RailRuntime = { readonly def: RailDef; readonly spotId: string; readonly points: readonly (readonly [number, number, number])[]; readonly posts: readonly (readonly [number, number, number])[] };
export type PlanterRuntime = { readonly def: PlanterDef; readonly spotId: string; readonly frame: Frame; readonly plane: Plane };
export type PostRuntime = { readonly def: PostDef; readonly spotId: string; readonly x: number; readonly z: number; readonly base: number; readonly top: number };

/** Grindable with the park track's extra facts (additive to the contract). */
export type SkateGrindable = Grindable & {
  /** Feature this top line belongs to. */
  featureId: string;
  /** Per-point face direction for curved coping (same meaning as `faceYaw`). */
  faceYaws?: readonly number[];
};

export type SkateWorldField = Omit<SkateField, 'grindables'> & {
  readonly tier: 'full' | 'lite';
  readonly ground: (x: number, z: number) => number;
  readonly pads: readonly PadRuntime[];
  readonly grindables: readonly SkateGrindable[];
  /** Invisible authored areas where the full ramp, gravity and landing model applies. */
  trickZoneAt(x:number,z:number):boolean;
  /** Height only (no normal): the cheapest query. */
  heightAt(x: number, z: number): number;
  /** Zero-allocation variant of `sample` (a `lip` object is allocated only on lips). */
  sampleInto(x: number, z: number, out: SurfaceSample): SurfaceSample;
};

/* ------------------------------------------------------------------ helpers */

export function apronDrop(e: number): number { return e < APRON_FILLET ? APRON_SLOPE * e * e / (2 * APRON_FILLET) : APRON_SLOPE * (e - APRON_FILLET / 2); }
function apronSlope(e: number): number { return e < APRON_FILLET ? APRON_SLOPE * e / APRON_FILLET : APRON_SLOPE; }

/** Least-squares plane over the pad (slope clamped), lifted so it clears the ground everywhere on the pad. */
function fitPlane(ground: (x: number, z: number) => number, frame: Frame, half: readonly [number, number], corner: number, maxSlope: number): { plane: Plane; maxFill: number } {
  const pts: [number, number, number][] = [];
  const sd = new Float64Array(3), step = 0.5;
  for (let lx = -half[0]; lx <= half[0] + 1e-9; lx += step) for (let lz = -half[1]; lz <= half[1] + 1e-9; lz += step) {
    sdRoundRect(lx, lz, half[0], half[1], corner, sd);
    if (sd[0]! > 1e-6) continue;
    const [x, z] = frameToWorld(frame, lx, lz);
    pts.push([x - frame.x, z - frame.z, ground(x, z)]);
  }
  // Also the exact edge loop, so corners are covered.
  for (const [lx, lz] of roundRectLoop(half[0], half[1], corner, 6)) { const [x, z] = frameToWorld(frame, lx, lz); pts.push([x - frame.x, z - frame.z, ground(x, z)]); }
  const n = pts.length;
  let mx = 0, mz = 0, mh = 0;
  for (const [x, z, h] of pts) { mx += x; mz += z; mh += h; }
  mx /= n; mz /= n; mh /= n;
  let sxx = 0, szz = 0, sxz = 0, sxh = 0, szh = 0;
  for (const [x0, z0, h0] of pts) { const x = x0 - mx, z = z0 - mz, h = h0 - mh; sxx += x * x; szz += z * z; sxz += x * z; sxh += x * h; szh += z * h; }
  const det = sxx * szz - sxz * sxz;
  let gx = det > 1e-9 ? (sxh * szz - szh * sxz) / det : 0, gz = det > 1e-9 ? (szh * sxx - sxh * sxz) / det : 0;
  const g = Math.hypot(gx, gz);
  if (g > maxSlope) { gx *= maxSlope / g; gz *= maxSlope / g; }
  let lift = -Infinity;
  for (const [x, z, h] of pts) lift = Math.max(lift, h - (gx * x + gz * z));
  const y0 = lift + PAD_FIT_LIFT;
  const plane: Plane = { x0: frame.x, z0: frame.z, y0, gx, gz };
  let maxFill = 0;
  for (const [lx, lz] of roundRectLoop(half[0], half[1], corner, 6)) { const [x, z] = frameToWorld(frame, lx, lz); maxFill = Math.max(maxFill, planeAt(plane, x, z) - ground(x, z)); }
  return { plane, maxFill };
}

const sideFace = (yaw: number, side: LedgeSide['side']): number => wrapAngle(yaw + (side === '+x' ? Math.PI / 2 : side === '-x' ? -Math.PI / 2 : side === '+z' ? 0 : Math.PI));

/** Top edge of a box-like side, in local coords: two end points. */
function sideEdge(hx: number, hz: number, l: LedgeSide): [[number, number], [number, number]] {
  const [a, b] = l.span ?? (l.side === '+x' || l.side === '-x' ? [-hz, hz] : [-hx, hx]);
  if (l.side === '+x') return [[hx, a], [hx, b]];
  if (l.side === '-x') return [[-hx, a], [-hx, b]];
  if (l.side === '+z') return [[a, hz], [b, hz]];
  return [[a, -hz], [b, -hz]];
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * A bowl's coping loop split into four runs by which way the wall faces
 * (+lx, +lz, −lx, −lz), each run sharing its end point with the next so the
 * loop is continuous. Points are [lx, lz, nx, nz] with the outward normal.
 */
export function copingRuns(a: number, b: number, r: number, perCorner = 8): [number, number, number, number][][] {
  const loop = roundRectLoop(a, b, r, perCorner);
  const first = loop[0]!, last = loop[loop.length - 1]!;
  if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) loop.pop();
  const quad = (p: [number, number, number, number]) => ((Math.round(Math.atan2(p[3], p[2]) / (Math.PI / 2) + 1e-9) % 4) + 4) % 4;
  // Rotate so the loop starts at the first point of a new quadrant.
  let start = 0;
  for (let i = 0; i < loop.length; i++) { if (quad(loop[i]!) !== quad(loop[(i - 1 + loop.length) % loop.length]!)) { start = i; break; } }
  const runs: [number, number, number, number][][] = [[], [], [], []];
  for (let k = 0; k < loop.length; k++) { const p = loop[(start + k) % loop.length]!; runs[quad(p)]!.push(p); }
  // Close each run onto the first point of the run that follows it round the loop.
  for (let k = 0; k < loop.length; k++) {
    const p = loop[(start + k) % loop.length]!, n = loop[(start + k + 1) % loop.length]!;
    if (quad(p) !== quad(n)) runs[quad(p)]!.push(n);
  }
  return runs;
}

/* ------------------------------------------------------------------ the field */

export function createSkateField(ground: (x: number, z: number) => number, opts: SkateFieldOptions = {}): SkateWorldField {
  const tier = opts.tier ?? 'full';
  const pads: PadRuntime[] = [];
  const grindables: SkateGrindable[] = [];
  const solids: SkateSolid[] = [];
  const pt = (plane: Plane, frame: Frame, lx: number, lz: number, h: number): [number, number, number] => {
    const [x, z] = frameToWorld(frame, lx, lz);
    return [round6(x), round6(planeAt(plane, x, z) + h), round6(z)];
  };

  for (const layout of SPOT_LAYOUTS) {
    const padFrame = composeFrame(layout.frame, layout.pad.at[0], layout.pad.at[1], 0);
    const { plane, maxFill } = fitPlane(ground, padFrame, layout.pad.half, layout.pad.corner, layout.pad.maxSlope);
    const reach = maxFill > 0 ? APRON_FILLET + maxFill / APRON_SLOPE + 0.05 : 0.05;
    const shapes: SurfaceShape[] = [], rails: RailRuntime[] = [], planters: PlanterRuntime[] = [], posts: PostRuntime[] = [];
    for (const def of layout.features) {
      if (isSurfaceDef(def)) { shapes.push(makeShape(def, composeFrame(layout.frame, def.at[0], def.at[1], def.yaw ?? 0), plane)); continue; }
      if (def.type === 'planter') { planters.push({ def, spotId: layout.id, frame: composeFrame(layout.frame, def.at[0], def.at[1], def.yaw ?? 0), plane }); continue; }
      if (def.type === 'post') { const [x, z] = frameToWorld(layout.frame, def.at[0], def.at[1]); const base = Math.max(planeAt(plane, x, z), ground(x, z)); posts.push({ def, spotId: layout.id, x, z, base, top: planeAt(plane, x, z) + def.height }); continue; }
      const points = def.points.map(([lx, lz, h]) => pt(plane, layout.frame, lx, lz, h));
      rails.push({ def, spotId: layout.id, points, posts: [] });
    }
    pads.push({ layout, id: layout.id, frame: padFrame, spotFrame: layout.frame, plane, half: layout.pad.half, corner: layout.pad.corner, maxFill, reach, shapes, rails, planters, posts });
  }

  /* ---- spatial hash over pads and shapes */
  const CELL = 4, ORIGIN = -100, N = 50;
  type PadItem = { pad: PadRuntime; minX: number; maxX: number; minZ: number; maxZ: number; c: number; s: number };
  type ShapeItem = { shape: SurfaceShape; minX: number; maxX: number; minZ: number; maxZ: number; c: number; s: number };
  const padCells: PadItem[][] = Array.from({ length: N * N }, () => []);
  const shapeCells: ShapeItem[][] = Array.from({ length: N * N }, () => []);
  const insert = <T>(cells: T[][], item: T, minX: number, maxX: number, minZ: number, maxZ: number) => {
    const i0 = Math.max(0, Math.floor((minX - ORIGIN) / CELL)), i1 = Math.min(N - 1, Math.floor((maxX - ORIGIN) / CELL));
    const j0 = Math.max(0, Math.floor((minZ - ORIGIN) / CELL)), j1 = Math.min(N - 1, Math.floor((maxZ - ORIGIN) / CELL));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) cells[j * N + i]!.push(item);
  };
  const aabb = (frame: Frame, minX: number, maxX: number, minZ: number, maxZ: number) => {
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const [lx, lz] of [[minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ]] as const) { const [x, z] = frameToWorld(frame, lx, lz); a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); }
    return [a - 1e-6, b + 1e-6, c - 1e-6, d + 1e-6] as const;
  };
  for (const pad of pads) {
    const [a, b, c, d] = aabb(pad.frame, -pad.half[0] - pad.reach, pad.half[0] + pad.reach, -pad.half[1] - pad.reach, pad.half[1] + pad.reach);
    insert(padCells, { pad, minX: a, maxX: b, minZ: c, maxZ: d, c: Math.cos(pad.frame.yaw), s: Math.sin(pad.frame.yaw) }, a, b, c, d);
    for (const shape of pad.shapes) {
      const [e, f, g, h] = aabb(shape.frame, shape.minX, shape.maxX, shape.minZ, shape.maxZ);
      insert(shapeCells, { shape, minX: e, maxX: f, minZ: g, maxZ: h, c: Math.cos(shape.frame.yaw), s: Math.sin(shape.frame.yaw) }, e, f, g, h);
    }
  }
  /* ---- lanes, bucketed for the open-ground surface kind */
  type Seg = { ax: number; az: number; dx: number; dz: number; len2: number };
  const laneCells: Seg[][] = Array.from({ length: N * N }, () => []);
  for (const lane of HARBOUR_LANES) for (let i = 1; i < lane.points.length; i++) {
    const a = lane.points[i - 1]!, b = lane.points[i]!;
    if (Math.hypot(a[0], a[1]) < 3.8) continue;
    const seg: Seg = { ax: a[0], az: a[1], dx: b[0] - a[0], dz: b[1] - a[1], len2: (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 };
    insert(laneCells, seg, Math.min(a[0], b[0]) - LANE_HALF_WIDTH, Math.max(a[0], b[0]) + LANE_HALF_WIDTH, Math.min(a[1], b[1]) - LANE_HALF_WIDTH, Math.max(a[1], b[1]) + LANE_HALF_WIDTH);
  }
  const onLane = (x: number, z: number, cell: number): boolean => {
    for (const s of laneCells[cell]!) {
      const t = s.len2 ? Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.len2)) : 0;
      const ex = x - s.ax - s.dx * t, ez = z - s.az - s.dz * t;
      if (ex * ex + ez * ez <= LANE_HALF_WIDTH * LANE_HALF_WIDTH) return true;
    }
    return false;
  };
  const openKind = (x: number, z: number, cell: number): SurfaceKind => {
    const r = Math.hypot(x, z);
    if (r <= HARBOUR_LAND.terrace) return 'cobble';
    if (cell >= 0 && onLane(x, z, cell)) return 'path';
    return r > HARBOUR_LAND.lawn ? 'sand' : 'grass';
  };

  /* ---- the query */
  const hit = newHit(), sd = new Float64Array(3);
  // Winner scratch.
  let wy = 0, wgx = 0, wgz = 0, wkind: SurfaceKind = 'grass', wfeature: string | null = null, wlip = false, wlipYaw = 0, wvert = false;
  function core(x: number, z: number, withGradient: boolean): void {
    const i = Math.floor((x - ORIGIN) / CELL), j = Math.floor((z - ORIGIN) / CELL);
    const cell = i >= 0 && i < N && j >= 0 && j < N ? j * N + i : -1;
    let y = ground(x, z), open = true;
    wlip = false; wfeature = null;
    if (cell >= 0) {
      for (const it of padCells[cell]!) {
        if (x < it.minX || x > it.maxX || z < it.minZ || z > it.maxZ) continue;
        const p = it.pad, dx = x - p.frame.x, dz = z - p.frame.z, lx = dx * it.c - dz * it.s, lz = dz * it.c + dx * it.s;
        sdRoundRect(lx, lz, p.half[0], p.half[1], p.corner, sd);
        const e = sd[0]!;
        if (e > p.reach) continue;
        const base = planeAt(p.plane, x, z);
        const hy = e <= 0 ? base : base - apronDrop(e);
        if (hy > y) {
          y = hy; open = false; wkind = 'concrete'; wfeature = null; wlip = false;
          if (e <= 0) { wgx = p.plane.gx; wgz = p.plane.gz; }
          else { const k = apronSlope(e), [gx, gz] = gradToWorld(p.frame.yaw, sd[1]!, sd[2]!); wgx = p.plane.gx - k * gx; wgz = p.plane.gz - k * gz; }
        }
      }
      for (const it of shapeCells[cell]!) {
        if (x < it.minX || x > it.maxX || z < it.minZ || z > it.maxZ) continue;
        const s = it.shape, dx = x - s.frame.x, dz = z - s.frame.z, lx = dx * it.c - dz * it.s, lz = dz * it.c + dx * it.s;
        if (!s.evalLocal(lx, lz, hit)) continue;
        const hy = planeAt(s.plane, x, z) + hit.h;
        if (hy >= y - 1e-9) {
          y = hy; open = false; wkind = hit.kind; wfeature = s.id;
          wgx = s.plane.gx + hit.gx * it.c + hit.gz * it.s; wgz = s.plane.gz + hit.gz * it.c - hit.gx * it.s;
          wlip = hit.lip;
          if (hit.lip) { wlipYaw = wrapAngle(s.frame.yaw + Math.atan2(hit.lipX, hit.lipZ)); wvert = hit.vert; }
        }
      }
    }
    wy = y;
    if (open) {
      wkind = openKind(x, z, cell);
      if (withGradient) {
        const h = 1e-3; wgx = (ground(x + h, z) - ground(x - h, z)) / (2 * h); wgz = (ground(x, z + h) - ground(x, z - h)) / (2 * h);
        // The island's own ground has a real step where the land meets the sea floor; keep the contract's ny ≥ 0.1 there.
        const g = Math.hypot(wgx, wgz); if (g > MAX_SLOPE) { wgx *= MAX_SLOPE / g; wgz *= MAX_SLOPE / g; }
      }
    }
  }
  function write(out: SurfaceSample): SurfaceSample {
    const inv = 1 / Math.sqrt(wgx * wgx + wgz * wgz + 1);
    out.y = wy; out.nx = -wgx * inv; out.ny = inv; out.nz = -wgz * inv; out.kind = wkind; out.feature = wfeature;
    out.lip = wlip ? { lipYaw: wlipYaw, vert: wvert } : null;
    return out;
  }

  /* ---- grindables */
  const addG = (g: SkateGrindable) => { grindables.push(g); };
  for (const pad of pads) {
    for (const s of pad.shapes) {
      const P = (lx: number, lz: number, h: number) => pt(s.plane, s.frame, lx, lz, h);
      if (s instanceof QuarterShape) {
        const T = s.arc.T, H = s.arc.H + COPE_TOP;
        addG({ id: `${s.id}-coping`, name: `${s.def.name} coping`, kind: 'coping', featureId: s.id, points: [P(s.minX, T, H), P(s.maxX, T, H)], faceYaw: wrapAngle(s.frame.yaw + Math.PI) });
      } else if (s instanceof MiniShape) {
        const L = s.def.flat / 2 + s.arc.T, H = s.arc.H + COPE_TOP;
        addG({ id: `${s.id}-coping-a`, name: `${s.def.name} coping`, kind: 'coping', featureId: s.id, points: [P(s.minX, L, H), P(s.maxX, L, H)], faceYaw: wrapAngle(s.frame.yaw + Math.PI) });
        addG({ id: `${s.id}-coping-b`, name: `${s.def.name} coping`, kind: 'coping', featureId: s.id, points: [P(s.maxX, -L, H), P(s.minX, -L, H)], faceYaw: wrapAngle(s.frame.yaw) });
      } else if (s instanceof BowlShape) {
        const d = s.def, T = s.arc.T, H = s.arc.H + COPE_TOP;
        const runs = copingRuns(d.floor[0] + T, d.floor[1] + T, d.corner + T);
        const names = ['+x', '+z', '−x', '−z'];
        runs.forEach((run, r) => {
          if (run.length < 2) return;
          const faceYaws = run.map(([, , nx, nz]) => wrapAngle(s.frame.yaw + Math.atan2(-nx, -nz)));
          addG({ id: `${s.id}-coping-${r}`, name: `${d.name} coping (${names[r]})`, kind: 'coping', featureId: s.id, points: run.map(([lx, lz]) => P(lx, lz, H)), faceYaw: faceYaws[Math.floor(faceYaws.length / 2)]!, faceYaws });
        });
      } else if (s instanceof BoxShape && s.def.ledges) {
        const kind: GrindableKind = s.def.role === 'bench' ? 'bench' : s.def.role === 'curb' ? 'curb' : 'ledge';
        for (const l of s.def.ledges) {
          const [a, b] = sideEdge(s.def.half[0], s.def.half[1], l);
          addG({ id: `${s.id}-${l.side}`, name: l.name ?? s.def.name, kind: l.kind ?? kind, featureId: s.id, points: [P(a[0], a[1], s.def.height), P(b[0], b[1], s.def.height)], faceYaw: sideFace(s.frame.yaw, l.side) });
        }
      } else if (s instanceof FunboxShape && s.def.ledges) {
        for (const l of s.def.ledges) {
          const [a, b] = sideEdge(s.def.half[0], s.def.half[1], l);
          addG({ id: `${s.id}-${l.side}`, name: l.name ?? s.def.name, kind: l.kind ?? 'ledge', featureId: s.id, points: [P(a[0], a[1], s.def.height), P(b[0], b[1], s.def.height)], faceYaw: sideFace(s.frame.yaw, l.side) });
        }
      } else if (s instanceof HubbaShape && s.def.ledges) {
        for (const side of s.def.ledges) {
          const lx = side === '+x' ? s.maxX : s.minX;
          addG({ id: `${s.id}-${side}`, name: s.def.name, kind: 'hubba', featureId: s.id, points: s.def.profile.map(([lz, h]) => P(lx, lz, h)), faceYaw: sideFace(s.frame.yaw, side) });
        }
      }
    }
    for (const p of pad.planters) for (const l of p.def.ledges ?? []) {
      const [a, b] = sideEdge(p.def.half[0], p.def.half[1], l);
      addG({ id: `${p.def.id}-${l.side}`, name: l.name ?? p.def.name, kind: l.kind ?? 'ledge', featureId: p.def.id, points: [pt(p.plane, p.frame, a[0], a[1], p.def.height), pt(p.plane, p.frame, b[0], b[1], p.def.height)], faceYaw: sideFace(p.frame.yaw, l.side) });
    }
    for (const r of pad.rails) addG({ id: r.def.id, name: r.def.name, kind: r.def.kind, featureId: r.def.id, points: r.points, faceYaw: null });
  }

  /* ---- solids: planters, posts, rail posts */
  const heightAt = (x: number, z: number): number => { if(z<-40||nearestOnRoute(x,z,TOWN_RACE_ROAD).distance<3.5)return queryWorldSurface({x,z},ground).y; core(x, z, false); return wy; };
  for (const pad of pads) {
    for (const p of pad.planters) {
      // The pad may fall a little across a planter: its top is the highest rim corner.
      let top = -Infinity;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [x, z] = frameToWorld(p.frame, sx * p.def.half[0], sz * p.def.half[1]); top = Math.max(top, planeAt(p.plane, x, z) + p.def.height); }
      solids.push({ kind: 'obox', id: p.def.id, x: p.frame.x, z: p.frame.z, halfX: p.def.half[0], halfZ: p.def.half[1], yaw: p.frame.yaw, top });
    }
    for (const p of pad.posts) solids.push({ kind: 'circle', id: p.def.id, x: p.x, z: p.z, r: p.def.r, top: p.top });
    for (let ri = 0; ri < pad.rails.length; ri++) {
      const r = pad.rails[ri]!, posts: [number, number, number][] = [];
      for (let i = 0; i < r.points.length; i++) {
        const a = r.points[i]!;
        posts.push([a[0], a[1], a[2]]);
        const b = r.points[i + 1];
        if (!b) break;
        const len = Math.hypot(b[0] - a[0], b[2] - a[2]), extra = Math.floor(len / 2.2);
        for (let k = 1; k <= extra; k++) { const t = k / (extra + 1); posts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
      }
      // Posts stand a little inside the ends, like real rail feet.
      const inset = (p: [number, number, number], q: readonly [number, number, number]) => { const d = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1, t = Math.min(0.12, d / 3) / d; return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t] as [number, number, number]; };
      if (posts.length >= 2) { posts[0] = inset(posts[0]!, posts[1]!); posts[posts.length - 1] = inset(posts[posts.length - 1]!, posts[posts.length - 2]!); }
      (pad.rails as RailRuntime[])[ri] = { ...r, posts };
      posts.forEach(([x, top, z], k) => solids.push({ kind: 'circle', id: `${r.def.id}-post-${k}`, x, z, r: 0.03, top: top - RAIL_RADIUS * 2 }));
    }
  }

  const spots: readonly SkateSpot[] = SPOTS;

  for(const s of WORLD_SURFACES.filter(s=>!s.id.startsWith('path:')&&!s.id.startsWith('station:')&&s.id!=='mountain-road'&&s.id!=='town-race-road'))grindables.push({id:s.id,name:s.id.replaceAll('-',' '),kind:'round-rail',featureId:s.id,points:s.points.map(p=>[p[0],p[1]+.6,p[2]]),faceYaw:null});
  return {
    // The same overhead the walker reads: a ramp or path mouth rising off the road is never a roof.
    ceilingAt:(x,z,feet)=>z<-40?overheadAt(x,z,feet):Infinity,
    tier, ground, pads, grindables, solids, spots,
    trickZoneAt(x,z) {
      for(const pad of pads){
        const dx=x-pad.frame.x,dz=z-pad.frame.z,c=Math.cos(pad.frame.yaw),s=Math.sin(pad.frame.yaw);
        if(Math.abs(dx*c-dz*s)<=pad.half[0]+pad.reach+2&&Math.abs(dz*c+dx*s)<=pad.half[1]+pad.reach+2)return true;
      }
      return SKILL_BRANCHES.some(branch=>nearestOnRoute(x,z,branch.points).distance<branch.halfWidth+2);
    },
    sample(x, z, y, supportId) { if(z<-40||nearestOnRoute(x,z,TOWN_RACE_ROAD).distance<3.5){const s=queryWorldSurface({x,z,y,supportId},ground);return {y:s.y,nx:s.nx,ny:s.ny,nz:s.nz,kind:s.material,feature:s.id,lip:null};}core(x, z, true); return write({ y: 0, nx: 0, ny: 1, nz: 0, kind: 'grass', feature: null, lip: null }); },
    sampleInto(x, z, out) { if(z<-40||nearestOnRoute(x,z,TOWN_RACE_ROAD).distance<3.5){const s=queryWorldSurface({x,z},ground);return Object.assign(out,{y:s.y,nx:s.nx,ny:s.ny,nz:s.nz,kind:s.material,feature:s.id,lip:null});}core(x, z, true); return write(out); },
    heightAt,
  };
}

/** Compile-time proof that the world field is the contract's SkateField. */
export const asSkateField = (f: SkateWorldField): SkateField => f;
