/**
 * The diorama (Horizon Clock, L2): where the real island sits inside the clay clock, and the clay surface the land is
 * drawn as. PURE — no three, no React, no IO — so the frame, the smoothed coast and the clay heights are testable and
 * usable by the flat twin.
 *
 * `dioramaFrame(land)` is computed from the baked coastline: its smallest enclosing circle gives the centre (concept
 * metres at the diorama origin) and the radius; `scale` fits that circle to `JOURNEY_DIORAMA.islandUnits`. Nothing
 * here is a constant island coordinate: move the coast in the bake and the frame follows
 * (test/journey-land.test.ts, test/journey-map-geometry-source.test.ts).
 *
 * The clay surface (`createClaySurface`) ports the approved prototype's island (horizon-clock.html): the coast is a
 * centripetal Catmull–Rom ring through the baked points; the 20 m `journey` lattice is softened (two 3×3 passes) and
 * lifted for the toy look (`compressHeight · toyLift`), easing to the slab over the first 70 m inland so the island
 * reads as one rounded clay piece; lattice nodes outside the coast drop just under the sea, inside the slab.
 */
import type { DioramaFrame, JourneyLandData, Point2, Polygon } from "../contracts.ts";
import { compressHeight, JOURNEY_DIORAMA } from "../contracts.ts";
import { closedRing, pointInPolygon } from "./simplify.ts";

/** The clay slab's own proportions (du), from the prototype. Heights only; never island coordinates. */
export const CLAY = {
  /** The terrain sits this far above the slab top where it meets the coast. */
  terrainSkin: 0.006,
  /** Lattice nodes outside the coast drop this far under the sea (hidden inside the slab). */
  underSea: 0.03,
  /** Concept metres inland over which the toy lift eases in from the slab. */
  coastEaseM: 70,
  /** Blur passes over the lattice (3×3, centre weight 2). */
  blurPasses: 2,
} as const;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Smoothstep from a to b. */
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------------------------------------
// The frame

type Circle = { c: Point2; r: number };
const inCircle = (k: Circle, p: Point2) => Math.hypot(p[0] - k.c[0], p[1] - k.c[1]) <= k.r * (1 + 1e-12) + 1e-9;
const circle2 = (a: Point2, b: Point2): Circle => { const c: Point2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return { c, r: Math.hypot(a[0] - c[0], a[1] - c[1]) }; };
function circle3(a: Point2, b: Point2, c: Point2): Circle {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-12) {
    // Collinear: the widest pair.
    const pairs = [circle2(a, b), circle2(b, c), circle2(a, c)];
    return pairs.reduce((m, k) => (k.r > m.r ? k : m));
  }
  const a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
  const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { c: [ux, uy], r: Math.hypot(a[0] - ux, a[1] - uy) };
}

/**
 * The smallest circle enclosing every point (incremental Welzl, on a fixed pseudo-shuffle so it is deterministic and
 * expected-linear).
 */
export function enclosingCircle(points: readonly Point2[]): Circle {
  if (!points.length) throw new Error("No points to enclose.");
  const p = points.slice();
  let seed = 0x2545f491;
  for (let i = p.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) >>> 0; const j = seed % (i + 1); [p[i], p[j]] = [p[j]!, p[i]!]; }
  let k: Circle = { c: p[0]!, r: 0 };
  for (let i = 1; i < p.length; i++) {
    if (inCircle(k, p[i]!)) continue;
    k = { c: p[i]!, r: 0 };
    for (let j = 0; j < i; j++) {
      if (inCircle(k, p[j]!)) continue;
      k = circle2(p[i]!, p[j]!);
      for (let m = 0; m < j; m++) if (!inCircle(k, p[m]!)) k = circle3(p[i]!, p[j]!, p[m]!);
    }
  }
  return k;
}

const frames = new WeakMap<Polygon, DioramaFrame>();
/**
 * Where concept metres sit in the diorama, from the land's baked coastline only (smallest enclosing circle): `centre`
 * concept (x, y) at the diorama origin, `radius` metres, `scale = islandUnits / radius` du per metre.
 */
export function dioramaFrame(land: Pick<JourneyLandData, "coastline">): DioramaFrame {
  const cached = frames.get(land.coastline);
  if (cached) return cached;
  const ring = closedRing(land.coastline);
  if (ring.length < 3) throw new Error("The Journey land has no coastline to frame.");
  const { c, r } = enclosingCircle(ring);
  if (!(r > 0)) throw new Error("The Journey coastline has no extent.");
  const frame: DioramaFrame = { centre: [c[0], c[1]], radius: r, scale: JOURNEY_DIORAMA.islandUnits / r };
  frames.set(land.coastline, frame);
  return frame;
}

// ---------------------------------------------------------------------------------------------------------------------
// Rings and lines (concept metres)

/**
 * A closed centripetal Catmull–Rom ring through `ring`, resampled to `count` points evenly spaced by arc length (no
 * repeated closing point). The curve passes through every baked point; it only rounds the corners between them.
 */
export function smoothRing(ring: Polygon, count: number): Point2[] {
  const pts = closedRing(ring);
  const n = pts.length;
  if (n < 3) return pts.slice();
  const dense: Point2[] = [];
  const SUB = 8;
  const knot = (a: Point2, b: Point2) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    for (let s = 0; s < SUB; s++) {
      const t = t1 + ((t2 - t1) * s) / SUB;
      const lerp = (a: Point2, b: Point2, ta: number, tb: number): Point2 => {
        const u = (t - ta) / (tb - ta);
        return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      };
      const a1 = lerp(p0, p1, t0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, t0, t2), b2 = lerp(a2, a3, t1, t3);
      dense.push(lerp(b1, b2, t1, t2));
    }
  }
  return resampleClosed(dense, count);
}

/** A closed ring resampled to `count` points evenly spaced by arc length. */
export function resampleClosed(ring: readonly Point2[], count: number): Point2[] {
  const n = ring.length, cum = [0];
  for (let i = 1; i <= n; i++) { const a = ring[i - 1]!, b = ring[i % n]!; cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[n]!, out: Point2[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const s = (total * k) / count;
    while (seg < n - 1 && cum[seg + 1]! < s) seg++;
    const a = ring[seg]!, b = ring[(seg + 1) % n]!, len = cum[seg + 1]! - cum[seg]!, u = len > 0 ? (s - cum[seg]!) / len : 0;
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

/** An open polyline resampled every `step` metres (both ends kept). */
export function resampleLine(points: readonly Point2[], step: number): Point2[] {
  if (points.length < 2) return points.slice();
  const out: Point2[] = [points[0]!];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = step - carry;
    while (s < len) { out.push([a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len]); s += step; }
    carry = len - (s - step);
  }
  const last = points[points.length - 1]!, tail = out[out.length - 1]!;
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}

/** The ring offset outward (away from its interior) by `metres`, per-vertex along the neighbours' normal. */
export function offsetRing(ring: readonly Point2[], metres: number): Point2[] {
  const n = ring.length;
  const shift = (sign: number) => ring.map((p, i) => {
    const q = ring[(i + 1) % n]!, o = ring[(i - 1 + n) % n]!;
    const nx = q[1] - o[1], ny = -(q[0] - o[0]), l = Math.hypot(nx, ny) || 1;
    return [p[0] + (sign * nx * metres) / l, p[1] + (sign * ny * metres) / l] as Point2;
  });
  // Pick the side that leaves the interior: test the offset of the ring's point farthest from its centroid.
  const cx = ring.reduce((s, p) => s + p[0], 0) / n, cy = ring.reduce((s, p) => s + p[1], 0) / n;
  let far = 0, best = -1;
  ring.forEach((p, i) => { const d = Math.hypot(p[0] - cx, p[1] - cy); if (d > best) { best = d; far = i; } });
  const out = shift(1);
  return pointInPolygon(out[far]![0], out[far]![1], ring) ? shift(-1) : out;
}

/** The nearest point on a closed ring to (x, y). */
export function nearestOnRing(ring: readonly Point2[], x: number, y: number): Point2 {
  let best = Infinity, bx = x, by = y;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!, b = ring[(i + 1) % n]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1) : 0;
    const px = a[0] + dx * t, py = a[1] + dy * t, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < best) { best = d; bx = px; by = py; }
  }
  return [bx, by];
}

/** Distance from (x, y) to a polyline (closed: back to the first point too). */
export function distanceToLine(points: readonly Point2[], x: number, y: number, closed: boolean): number {
  let best = Infinity;
  const n = points.length, last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i]!, b = points[(i + 1) % n]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1) : 0;
    const ex = a[0] + dx * t - x, ey = a[1] + dy * t - y, d = ex * ex + ey * ey;
    if (d < best) best = d;
  }
  if (n === 1) best = (points[0]![0] - x) ** 2 + (points[0]![1] - y) ** 2;
  return Math.sqrt(best);
}

// ---------------------------------------------------------------------------------------------------------------------
// The clay surface

export type ClaySurface = {
  frame: DioramaFrame;
  /** The smoothed coast (concept metres) the slab, the shallows and "inside" use. */
  coast: Point2[];
  columns: number; rows: number; step: number;
  /** Softened baked heights (metres, ≥ 0) per lattice node. */
  heights: Float32Array;
  /** 1 = the node is inside the smoothed coast. */
  inside: Uint8Array;
  /** Distance (metres) from the node to the smoothed coast (inside nodes only; 0 outside). */
  coastDistance: Float32Array;
  /** The node's drawn diorama y. */
  y: Float32Array;
  /** The node's drawn plan position (concept metres): the lattice, except coast-edge nodes snapped onto the coast. */
  planX: Float32Array; planZ: Float32Array;
  /** Diorama y of the drawn clay at concept (x, y): the slab top at least on land, the sea outside the coast. */
  groundAt(x: number, y: number): number;
  insideCoast(x: number, y: number): boolean;
  /** Concept metres → diorama du (plan only). */
  toX(x: number): number;
  toZ(y: number): number;
};

/** The toy lift (du) of a baked height. */
export const clayLift = (height: number) => compressHeight(Math.max(0, height)) * JOURNEY_DIORAMA.toyLift;

export function createClaySurface(land: JourneyLandData, frame: DioramaFrame, coastSamples: number): ClaySurface {
  const { columns, rows, step, heights: raw } = land.terrain;
  const coast = smoothRing(land.coastline, coastSamples);
  const { top, sea } = JOURNEY_DIORAMA.slab;
  const count = columns * rows;
  // Soften the lattice (sea floor clamped to 0 first): two 3×3 passes, the centre weighted twice.
  let a = new Float32Array(count);
  for (let i = 0; i < count; i++) a[i] = Math.max(0, raw[i]!);
  for (let pass = 0; pass < CLAY.blurPasses; pass++) {
    const b = new Float32Array(count);
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
      let s = 0, w = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= columns) continue;
        const k = dr || dc ? 1 : 2;
        s += a[rr * columns + cc]! * k; w += k;
      }
      b[r * columns + c] = s / w;
    }
    a = b;
  }
  const inside = new Uint8Array(count), coastDistance = new Float32Array(count), y = new Float32Array(count);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const i = r * columns + c, x = c * step, z = r * step;
    inside[i] = pointInPolygon(x, z, coast) ? 1 : 0;
    coastDistance[i] = inside[i] ? distanceToLine(coast, x, z, true) : 0;
    y[i] = inside[i] ? top + CLAY.terrainSkin + clayLift(a[i]!) * smooth(0, CLAY.coastEaseM, coastDistance[i]!) : sea - CLAY.underSea;
  }
  // Plan position of each node as drawn: an outside node that shares a lattice cell with an inside one is pulled onto
  // the smoothed coast (at the slab top), so the terrain's edge IS the clay edge — no lattice sawtooth past the slab.
  const planX = new Float32Array(count), planZ = new Float32Array(count);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const i = r * columns + c;
    planX[i] = c * step; planZ[i] = r * step;
    if (inside[i]) continue;
    let near = false;
    // Within three cells, so a stride-2 or stride-3 lattice (the Year mini) gets the same clean edge.
    for (let dr = -3; dr <= 3 && !near; dr++) for (let dc = -3; dc <= 3; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < rows && cc < columns && inside[rr * columns + cc]) { near = true; break; }
    }
    if (!near) continue;
    const q = nearestOnRing(coast, c * step, r * step);
    planX[i] = q[0]; planZ[i] = q[1]; y[i] = top;
  }
  const insideCoast = (x: number, z: number) => pointInPolygon(x, z, coast);
  return {
    frame, coast, columns, rows, step, heights: a, inside, coastDistance, y, planX, planZ,
    insideCoast,
    groundAt(x, z) {
      if (!insideCoast(x, z)) return sea;
      const fx = clamp(x / step, 0, columns - 1.001), fz = clamp(z / step, 0, rows - 1.001);
      const c = Math.floor(fx), r = Math.floor(fz), u = fx - c, v = fz - r, i = r * columns + c;
      const h = (y[i]! * (1 - u) + y[i + 1]! * u) * (1 - v) + (y[i + columns]! * (1 - u) + y[i + columns + 1]! * u) * v;
      return Math.max(top, h);
    },
    toX: (x) => (x - frame.centre[0]) * frame.scale,
    toZ: (z) => (z - frame.centre[1]) * frame.scale,
  };
}
