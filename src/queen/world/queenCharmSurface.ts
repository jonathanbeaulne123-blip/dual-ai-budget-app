import type { QueenCharmPart, QueenCharmV1 } from "../../core/queenCharms.ts";
import type { QueenReservedChannel } from "./queenAuthoring.ts";

/**
 * Her surface, in numbers both paths share. A charm is stored as the part it
 * sits on and that part's uv — the same coordinates the studio's free-placed
 * stamps use and the same uv the raycaster returns — and everything else is
 * derived here: the 3D seat (position and normal in the body group's space),
 * the flat seat (a point on the drawn figure), which reserved channel a seat
 * would cover, and where a refused charm slides to. Pure; no three.js.
 *
 * The numbers below are her geometry: `queenSculpture.ts` builds the skirt
 * and the head from these same constants, so the maths cannot drift from the
 * mesh.
 */
export const QUEEN_SKIRT_PROFILE: readonly (readonly [r: number, y: number])[] = [[0.04, 0], [0.92, 0.04], [1.14, 0.42], [1.2, 0.92], [1.08, 1.42], [0.82, 1.72], [0.6, 1.86]];
export const QUEEN_SKIRT_PHI_START = Math.PI / 2;
export const QUEEN_HEAD = { radius: 0.52, position: [0, 2.78, 0.04] as const, scale: [1, 1.02, 0.96] as const, phiStart: -Math.PI / 2 } as const;
/** The three gold seam paths on the belly, in the belly's own space (belly width 1). Reserved corridors. */
export const QUEEN_SEAM_PATHS: readonly (readonly (readonly [number, number, number])[])[] = [
  [[-0.55, 0.06, 1.0], [-0.42, 0.7, 1.08], [-0.58, 1.1, 0.96], [-0.4, 1.5, 0.8]],
  [[0.72, 0.1, 0.92], [0.62, 0.62, 1.02], [0.74, 0.98, 0.9]],
  [[0.05, 0.05, 1.18], [0.12, 0.5, 1.16], [0.0, 0.86, 1.06]],
];
/** One charm at scale 1 spans about this many world units; the flat glyph is drawn in a 20-unit box. */
export const QUEEN_CHARM_UNIT = 0.38;
export const QUEEN_CHARM_GLYPH_BOX = 20;

export type Vec3 = readonly [number, number, number];
export type QueenSurfaceSeat = { position: Vec3; normal: Vec3 };
export type QueenCharmRefusal = QueenReservedChannel | "unseen";

const TAU = Math.PI * 2;
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const wrap = (u: number) => ((u % 1) + 1) % 1;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
/** Signed distance around the surface from the front centre, -0.5..0.5 in u. */
const FRONT: Record<QueenCharmPart, number> = { body: 0.75, head: 0.5 };
export const queenCharmDu = (part: QueenCharmPart, u: number): number => { const d = u - FRONT[part]; return d - Math.round(d); };

function skirtAt(v: number): { r: number; y: number; nr: number; ny: number } {
  const n = QUEEN_SKIRT_PROFILE.length - 1;
  const t = clamp01(v) * n;
  const j = Math.min(n - 1, Math.floor(t));
  const f = t - j;
  const [r0, y0] = QUEEN_SKIRT_PROFILE[j]!, [r1, y1] = QUEEN_SKIRT_PROFILE[j + 1]!;
  const dr = r1 - r0, dy = y1 - y0;
  const l = Math.hypot(dr, dy) || 1;
  return { r: r0 + dr * f, y: y0 + dy * f, nr: dy / l, ny: -dr / l };
}
/** Profile arc length, for turning a world distance into a step in v. */
const SKIRT_ARC = QUEEN_SKIRT_PROFILE.slice(1).reduce((sum, [r, y], i) => sum + Math.hypot(r - QUEEN_SKIRT_PROFILE[i]![0], y - QUEEN_SKIRT_PROFILE[i]![1]), 0);

/** Where (part, u, v) sits in the body group's space. `bellyWidth` is the fill's scale of the belly (0.86..1). */
export function queenSurfaceSeat(part: QueenCharmPart, u: number, v: number, bellyWidth = 1): QueenSurfaceSeat {
  if (part === "body") {
    const phi = QUEEN_SKIRT_PHI_START + wrap(u) * TAU;
    const { r, y, nr, ny } = skirtAt(v);
    const s = Math.sin(phi), c = Math.cos(phi);
    return { position: [r * s * bellyWidth, y, r * c * bellyWidth], normal: norm([nr * s / bellyWidth, ny, nr * c / bellyWidth]) };
  }
  const theta = (1 - clamp01(v)) * Math.PI;
  const phi = QUEEN_HEAD.phiStart + wrap(u) * TAU;
  const dir: Vec3 = [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
  const [px, py, pz] = QUEEN_HEAD.position, [sx, sy, sz] = QUEEN_HEAD.scale, R = QUEEN_HEAD.radius;
  return { position: [px + dir[0] * R * sx, py + dir[1] * R * sy, pz + dir[2] * R * sz], normal: norm([dir[0] / sx, dir[1] / sy, dir[2] / sz]) };
}

/** The inverse, for tests and for keyboard seats: a body-space point → the nearest (u, v) on that part. */
export function queenSurfaceUv(part: QueenCharmPart, point: Vec3): { u: number; v: number } {
  if (part === "body") {
    const phi = Math.atan2(point[0], point[2]);
    const u = wrap((phi - QUEEN_SKIRT_PHI_START) / TAU);
    const n = QUEEN_SKIRT_PROFILE.length - 1;
    const y = point[1];
    let v = 1;
    for (let j = 0; j < n; j += 1) {
      const y0 = QUEEN_SKIRT_PROFILE[j]![1], y1 = QUEEN_SKIRT_PROFILE[j + 1]![1];
      if (y <= y1) { v = (j + clamp01((y - y0) / (y1 - y0))) / n; break; }
    }
    return { u, v: y < 0 ? 0 : v };
  }
  const [px, py, pz] = QUEEN_HEAD.position, [sx, sy, sz] = QUEEN_HEAD.scale;
  const d = norm([(point[0] - px) / sx, (point[1] - py) / sy, (point[2] - pz) / sz]);
  const theta = Math.acos(Math.max(-1, Math.min(1, d[1])));
  const phi = Math.atan2(d[2], -d[0]);
  return { u: wrap((phi - QUEEN_HEAD.phiStart) / TAU), v: 1 - theta / Math.PI };
}

// ---------------------------------------------------------------------------
// The reserved zones, in the surface's own coordinates.

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function segmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
  const t = clamp01((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2);
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
}
/** A seam corridor: the tube plus a charm's own reach. */
const SEAM_CORRIDOR = 0.16;

/**
 * Which reserved channel a charm at (part, u, v) would cover, or "unseen" when
 * the seat faces away from the fixed camera, or null when the seat is hers to
 * give. Posture and the glaze axis are not places — a charm can never touch
 * them because it rides the body group and carries no material axis — so they
 * are never returned here.
 */
export function queenCharmRefusal(part: QueenCharmPart, u: number, v: number): QueenCharmRefusal | null {
  const du = Math.abs(queenCharmDu(part, u));
  const seat = queenSurfaceSeat(part, u, v);
  if (part === "body") {
    if (v < 0.2) return "feet";
    if (v > 0.72 && du < 0.13) return "hands";
    for (const path of QUEEN_SEAM_PATHS) for (let i = 1; i < path.length; i += 1) if (segmentDistance(seat.position, path[i - 1]!, path[i]!) < SEAM_CORRIDOR) return "seams";
    if (du < 0.07 && v >= 0.2 && v <= 0.66) return "fill";
  } else {
    if (du > 0.25 && v > 0.58) return "vine";
    if (v > 0.75) return "crown";
    if (du < 0.14 && v >= 0.3 && v <= 0.75) return "eyes";
  }
  if (seat.normal[2] < 0.12) return "unseen";
  return null;
}
export const queenCharmAllowed = (part: QueenCharmPart, u: number, v: number): boolean => queenCharmRefusal(part, u, v) === null;

/** How far (in world units) a charm may slide before it will not take at all. */
export const QUEEN_CHARM_SLIDE = 0.3;

/**
 * The physical refusal: a charm pressed onto a reserved zone slides to the
 * nearest seat that is hers to give, the way a lidded bank leans away from a
 * coin; pressed too deep into one, it will not take and returns null. No
 * words, no dialog — the caller simply has a charm somewhere else, or none.
 */
export function queenCharmSettle(part: QueenCharmPart, u: number, v: number): { u: number; v: number } | null {
  if (queenCharmAllowed(part, u, v)) return { u: wrap(u), v: clamp01(v) };
  const origin = queenSurfaceSeat(part, u, v).position;
  const circumference = part === "body" ? TAU * Math.max(0.3, skirtAt(v).r) : TAU * QUEEN_HEAD.radius * Math.max(0.3, Math.sin((1 - clamp01(v)) * Math.PI));
  const along = part === "body" ? SKIRT_ARC : Math.PI * QUEEN_HEAD.radius;
  for (let ring = 1; ring * 0.03 <= QUEEN_CHARM_SLIDE; ring += 1) {
    const radius = ring * 0.03;
    let best: { u: number; v: number; d: number } | null = null;
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * TAU;
      const cu = wrap(u + (Math.cos(a) * radius) / circumference), cv = clamp01(v + (Math.sin(a) * radius) / along);
      if (!queenCharmAllowed(part, cu, cv)) continue;
      const d = dist(origin, queenSurfaceSeat(part, cu, cv).position);
      if (d <= QUEEN_CHARM_SLIDE && (!best || d < best.d)) best = { u: cu, v: cv, d };
    }
    if (best) return { u: best.u, v: best.v };
  }
  return null;
}

/** Seats a keyboard user gets without a pointer: hers to give, spread over her flanks and cheeks, nearest-first to what is free. */
export const QUEEN_CHARM_KEYBOARD_SEATS: readonly { part: QueenCharmPart; u: number; v: number }[] = [
  { part: "body", u: 0.62, v: 0.45 }, { part: "body", u: 0.88, v: 0.45 }, { part: "body", u: 0.6, v: 0.28 }, { part: "body", u: 0.9, v: 0.28 },
  { part: "head", u: 0.3, v: 0.5 }, { part: "head", u: 0.7, v: 0.5 }, { part: "body", u: 0.64, v: 0.62 }, { part: "body", u: 0.86, v: 0.62 },
  { part: "body", u: 0.55, v: 0.22 }, { part: "body", u: 0.95, v: 0.22 }, { part: "head", u: 0.31, v: 0.32 }, { part: "head", u: 0.69, v: 0.32 },
  { part: "body", u: 0.66, v: 0.2 }, { part: "body", u: 0.84, v: 0.2 }, { part: "head", u: 0.5, v: 0.16 }, { part: "body", u: 0.75, v: 0.72 },
];
export function queenCharmFreeSeat(placed: readonly Pick<QueenCharmV1, "part" | "u" | "v">[]): { part: QueenCharmPart; u: number; v: number } {
  const taken = placed.map((row) => queenSurfaceSeat(row.part, row.u, row.v).position);
  for (const seat of QUEEN_CHARM_KEYBOARD_SEATS) {
    const settled = queenCharmSettle(seat.part, seat.u, seat.v);
    if (!settled) continue;
    const position = queenSurfaceSeat(seat.part, settled.u, settled.v).position;
    if (taken.every((p) => dist(p, position) > QUEEN_CHARM_UNIT * 0.7)) return { part: seat.part, ...settled };
  }
  const first = QUEEN_CHARM_KEYBOARD_SEATS[0]!;
  return { part: first.part, ...(queenCharmSettle(first.part, first.u, first.v) ?? { u: first.u, v: first.v }) };
}
/** A nudge in world units becomes a step on the surface; the result settles so it never lands on a reserved zone. */
export function queenCharmNudge(charm: Pick<QueenCharmV1, "part" | "u" | "v">, dx: number, dy: number): { u: number; v: number } {
  const circumference = charm.part === "body" ? TAU * Math.max(0.3, skirtAt(charm.v).r) : TAU * QUEEN_HEAD.radius * Math.max(0.3, Math.sin((1 - clamp01(charm.v)) * Math.PI));
  const along = charm.part === "body" ? SKIRT_ARC : Math.PI * QUEEN_HEAD.radius;
  // Screen right is +x, and on both parts u grows to the right of the front centre (x = r·sin φ on the skirt; x = −R·cos φ·sin θ on the head).
  const du = dx / circumference;
  const next = { u: wrap(charm.u + du), v: clamp01(charm.v + dy / along) };
  return queenCharmSettle(charm.part, next.u, next.v) ?? { u: charm.u, v: charm.v };
}

// ---------------------------------------------------------------------------
// The flat path: the same seat on the drawn figure (240 × 340 viewBox).

export type QueenCharmFlatSeat = { x: number; y: number; facing: number; size: number; part: QueenCharmPart };
const FLAT = { body: { cx: 120, hemY: 302, sx: 71.7, sy: 65.6 }, head: { cx: 120, cy: 112, sx: 76.9, sy: 73.6 } } as const;
/** A seat in the figure's viewBox. Body seats are in the belly group's unscaled space (the group's own `scaleX(fill)` widens them, as the belly does in 3D). */
export function queenCharmFlatSeat(charm: Pick<QueenCharmV1, "part" | "u" | "v" | "scale">): QueenCharmFlatSeat {
  const seat = queenSurfaceSeat(charm.part, charm.u, charm.v);
  const facing = Math.max(0, seat.normal[2]);
  const size = (charm.scale * QUEEN_CHARM_UNIT * FLAT.body.sy) / QUEEN_CHARM_GLYPH_BOX;
  if (charm.part === "body") return { part: "body", x: FLAT.body.cx + seat.position[0] * FLAT.body.sx, y: FLAT.body.hemY - seat.position[1] * FLAT.body.sy, facing, size };
  return { part: "head", x: FLAT.head.cx + seat.position[0] * FLAT.head.sx, y: FLAT.head.cy - (seat.position[1] - QUEEN_HEAD.position[1]) * FLAT.head.sy, facing, size };
}
/** The inverse for a pointer on the drawn figure: a viewBox point → the nearest (part, u, v), or null off her. */
export function queenCharmFlatPick(x: number, y: number): { part: QueenCharmPart; u: number; v: number } | null {
  const hx = (x - FLAT.head.cx) / FLAT.head.sx, hy = (FLAT.head.cy - y) / FLAT.head.sy;
  const hr = Math.hypot(hx / QUEEN_HEAD.scale[0], hy / QUEEN_HEAD.scale[1]);
  if (hr <= QUEEN_HEAD.radius * 1.02) {
    const inside = Math.min(1, hr / QUEEN_HEAD.radius);
    const z = Math.sqrt(Math.max(0, 1 - inside * inside)) * QUEEN_HEAD.radius * QUEEN_HEAD.scale[2];
    return { part: "head", ...queenSurfaceUv("head", [hx, QUEEN_HEAD.position[1] + hy, QUEEN_HEAD.position[2] + z]) };
  }
  const bx = (x - FLAT.body.cx) / FLAT.body.sx, by = (FLAT.body.hemY - y) / FLAT.body.sy;
  if (by < 0 || by > QUEEN_SKIRT_PROFILE[QUEEN_SKIRT_PROFILE.length - 1]![1]) return null;
  const { r } = skirtAt(queenSurfaceUv("body", [0, by, 1]).v);
  if (Math.abs(bx) > r * 1.04) return null;
  const inside = Math.min(1, Math.abs(bx) / r);
  const z = Math.sqrt(Math.max(0, 1 - inside * inside)) * r;
  return { part: "body", ...queenSurfaceUv("body", [Math.sign(bx) * Math.min(Math.abs(bx), r * 0.999), by, Math.max(z, 1e-4)]) };
}
