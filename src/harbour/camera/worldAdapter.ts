/**
 * Hearth Mountain v2 · the camera's view of the world (the ADAPTER).
 *
 * Every camera in the harbour — Look, Walk, Close, the ride camera, the skate
 * shots, the tour — reads the world through this one object and nothing else.
 * Today it is fed from the current geography (`mountain/definition.ts`,
 * `scene/ground.ts`, `mountain/surfaces.ts`, `village/layout.ts`). The
 * geography track is re-authoring that world (a sculpted heightfield, the dam
 * across a valley facing town, authored overlooks with facings, transport
 * splines with orientation frames). At integration each `ADAPTER:` line below
 * is pointed at the contract's export; no pose, flight or ride shot hard-codes
 * a position, so they all move with the world.
 *
 * Pure: no three.js, no DOM, no time.
 */
import type { HarbourPlaceId } from "../flag.ts";
import { groundHeightAt } from "../scene/ground.ts";
import { WORLD_SOLIDS, WORLD_SURFACES } from "../mountain/surfaces.ts";
import { STOREFRONT_SOLIDS } from "../mountain/townSquare.ts";
import { mountainFoliageAt } from "../mountain/planting.ts";
import { BASIN, DISTRICTS, WORLD_BOUNDS, GONDOLA_STOPS, FUNICULAR_STOPS, RESERVED_PLOTS, RIVER, TRANSPORT_STOPS, nearestOnRoute, transportPoint, type Point3, type TransportKind } from "../mountain/definition.ts";
import * as definition from "../mountain/definition.ts";
import { SUMMIT_OBSERVATORY } from "../mountain/artGeometry.ts";
import { MOUNTAIN_INTERACTIONS } from "../mountain/life.ts";
import { VILLAGE_SITES, VILLAGE_WATERFRONT } from "../village/layout.ts";
import { MOUNTAIN_COURSE_POINTS } from "../mountain/race.ts";

export type V3 = readonly [number, number, number];
/** An axis-aligned box the eye may not enter. */
/** An axis-aligned box; with `yaw`, the same extents turned about the box's centre (an obox, `body/obstacles.ts` frame). */
export type CameraSolid = { id: string; min: V3; max: V3; yaw?: number };
/** A doorway on the island: where it is, and the way out of it (unit, horizontal). */
export type CameraDoor = { place: string; at: V3; out: readonly [number, number] };
/** An authored place to stand and look from: where, and at what. */
export type CameraOverlook = { id: string; at: V3; look: V3; kind: string };

/* ── The geography contract (v2), read when it is there ───────────────────
 * The geography track's contract (`mountain/CONTRACT.md`) adds these
 * exports to `definition.ts`. Each is read *if present*, so at integration
 * the camera picks up the new dam, overlooks, door aprons, edge solids,
 * transport splines and race finish with no code change here; until then
 * every value below falls back to today's data.
 * ────────────────────────────────────────────────────────────────────────── */
type ContractV2 = {
  DAM: { centre: Point3; crest: number; foot: number; arc: readonly Point3[]; face: readonly [number, number]; abutments: readonly { at: Point3; size: Point3 }[] };
  OVERLOOKS: readonly { id: string; name?: string; at: Point3; facing: number; look: Point3 }[];
  DOOR_APRONS: readonly { site: string; door: Point3; facing: number; apron: { at: Point3; half: readonly [number, number] } }[];
  EDGE_SOLIDS: readonly { id: string; a: readonly [number, number]; b: readonly [number, number]; bottom: number; top: number; thickness: number }[];
  SUMMIT_OBSERVATORY_SITE: { at: Point3 };
  GORGE: { points: readonly Point3[] };
  RACE_FINISH: { at: Point3; heading: readonly [number, number] };
  transportSpline: (kind: TransportKind) => { at(s: number): { at: Point3; tangent: Point3 }; stations: readonly { s: number }[] };
};
const contract = definition as typeof definition & Partial<ContractV2>;
const finite = (p: readonly number[] | undefined): p is Point3 => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite);

/* ── Terrain ───────────────────────────────────────────────────────────── */
/** ADAPTER: geography's shared height query (terrain only; decks are solids). */
export const cameraGround = (x: number, z: number): number => groundHeightAt(x, z);
/**
 * The same land, read from a lazily filled 1-unit grid (bilinear) for the
 * line tests that sample it dozens of times a frame. Each cell is asked of
 * the exact query once. The eye's own floor always uses `cameraGround`.
 */
const GRID = 1, GX0 = WORLD_BOUNDS.minX - 4, GZ0 = WORLD_BOUNDS.minZ - 4;
const GW = Math.ceil((WORLD_BOUNDS.maxX + 4 - GX0) / GRID) + 2, GD = Math.ceil((WORLD_BOUNDS.maxZ + 90 - GZ0) / GRID) + 2;
let grid: Float32Array | null = null;
const cell = (i: number, j: number): number => {
  grid ??= new Float32Array(GW * GD).fill(Number.NaN);
  const k = j * GW + i;
  let v = grid[k]!;
  if (Number.isNaN(v)) { v = groundHeightAt(GX0 + i * GRID, GZ0 + j * GRID); grid[k] = v; }
  return v;
};
export function cameraGroundFast(x: number, z: number): number {
  const fx = (x - GX0) / GRID, fz = (z - GZ0) / GRID;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (!(i >= 0 && j >= 0 && i < GW - 1 && j < GD - 1)) return groundHeightAt(x, z);
  const u = fx - i, v = fz - j;
  const a = cell(i, j), b = cell(i + 1, j), c = cell(i, j + 1), d = cell(i + 1, j + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/* ── Landmarks ─────────────────────────────────────────────────────────── */
/** ADAPTER: the town square's centre (the fountain) and paving height. */
export const TOWN_SQUARE: V3 = Object.freeze([0, 0.4, 0]) as V3;
/**
 * ADAPTER: the dam crest — the middle of the glass arc's top edge, on the
 * face that looks at town. Today the arc is centred on +z of the basin
 * (`landscape.ts` CylinderGeometry from −angle/2 to +angle/2).
 */
export const DAM_CREST: V3 = Object.freeze((() => {
  const dam = contract.DAM;
  if (dam && dam.arc?.length && Number.isFinite(dam.crest)) { const mid = dam.arc[Math.floor(dam.arc.length / 2)]!; if (finite(mid)) return [mid[0], dam.crest, mid[2]]; }
  return [BASIN.x, BASIN.top, BASIN.z + BASIN.radius];
})()) as V3;
/** ADAPTER: the dam's outward face normal (horizontal), toward town. */
export const DAM_FACE: readonly [number, number] = Object.freeze((() => {
  const face = contract.DAM?.face;
  if (face && Number.isFinite(face[0]) && Number.isFinite(face[1]) && Math.hypot(face[0], face[1]) > 1e-6) { const l = Math.hypot(face[0], face[1]); return [face[0] / l, face[1] / l]; }
  return [0, 1];
})()) as readonly [number, number];
/** ADAPTER: the middle of the Fund basin's water. */
export const BASIN_CENTRE: V3 = Object.freeze([BASIN.x, (BASIN.bottom + BASIN.top) / 2, BASIN.z]) as V3;
/** ADAPTER: the summit telescope/observatory. */
export const SUMMIT_TELESCOPE: V3 = Object.freeze((() => {
  const at = finite(contract.SUMMIT_OBSERVATORY_SITE?.at) ? contract.SUMMIT_OBSERVATORY_SITE!.at : SUMMIT_OBSERVATORY.at;
  return [at[0], at[1] + 1.4, at[2]];
})()) as V3;
/** ADAPTER: the quay (race finish run-out). */
export const QUAY: V3 = Object.freeze(finite(contract.RACE_FINISH?.at) ? [contract.RACE_FINISH!.at[0], contract.RACE_FINISH!.at[1] + 0.2, contract.RACE_FINISH!.at[2]] : [VILLAGE_WATERFRONT.spot[0], 0.6, VILLAGE_WATERFRONT.spot[1] - 6]) as V3;
/** ADAPTER: the district centres, in uphill order. */
export const CAMERA_DISTRICTS: readonly { id: string; name: string; at: V3; radius: number; destination: string }[] =
  Object.freeze(DISTRICTS.map((d) => ({ id: d.id, name: d.name, at: d.at as V3, radius: d.radius, destination: d.destination })));
export const CAMERA_PLOTS: readonly { id: string; at: V3 }[] = Object.freeze(RESERVED_PLOTS.map((p) => ({ id: p.id, at: p.at as V3 })));

/* ── Doors ─────────────────────────────────────────────────────────────── */
const siteYaw = (spot: readonly [number, number]) => Math.atan2(-spot[0], -spot[1]);
/**
 * ADAPTER: every island building door (the contract's door-facing aprons).
 * A building's local +z is its front; `out` points from the door into the
 * open. Keyed by the place you enter through it.
 */
export const CAMERA_DOORS: Readonly<Record<string, CameraDoor>> = Object.freeze(Object.fromEntries([
  ...Object.values(VILLAGE_SITES).map((site) => {
    const yaw = siteYaw(site.spot), c = Math.cos(yaw), s = Math.sin(yaw);
    const [lx, lz] = site.door;
    const x = site.spot[0] + lx * c + lz * s, z = site.spot[1] + lz * c - lx * s;
    return [site.entry, { place: site.entry, at: [x, groundHeightAt(x, z), z] as V3, out: [s, c] as const }];
  }),
  ["campfire", (() => {
    const [x, z] = VILLAGE_WATERFRONT.spot, yaw = VILLAGE_WATERFRONT.yaw;
    const dz = VILLAGE_WATERFRONT.door[1];
    const at: V3 = [x + dz * Math.sin(yaw), groundHeightAt(x, z), z + dz * Math.cos(yaw)];
    return { place: "campfire", at, out: [Math.sin(yaw), Math.cos(yaw)] as const };
  })()],
  // The contract's door aprons, where they are authored: the way out is from the door to its apron.
  ...(contract.DOOR_APRONS ?? []).flatMap((apron) => {
    const site = (VILLAGE_SITES as Record<string, { entry: string } | undefined>)[apron.site];
    if (!site || !finite(apron.door) || !finite(apron.apron?.at)) return [];
    let ox = apron.apron.at[0] - apron.door[0], oz = apron.apron.at[2] - apron.door[2];
    if (Math.hypot(ox, oz) < 1e-3) { ox = Math.sin(apron.facing); oz = Math.cos(apron.facing); }
    const l = Math.hypot(ox, oz) || 1;
    return [[site.entry, { place: site.entry, at: apron.door as V3, out: [ox / l, oz / l] as const }]];
  }),
]));
/** Which building door a mountain district's "Visit" arrives at (its destination), when it has one. */
export const DISTRICT_DOOR: Readonly<Record<string, string>> = Object.freeze({ hearth: "kitchen", orchard: "cottage", library: "library", glasshouse: "glasshouse" });

/* ── Overlooks and small moments ───────────────────────────────────────── */
/**
 * ADAPTER: the authored overlooks with facings. Until geography's nodes land,
 * the current small moments stand in: an overlook or a bench looks at town
 * (the dam overlook at the dam), everything else looks at itself.
 */
export const CAMERA_MOMENTS: readonly CameraOverlook[] = Object.freeze([
  ...MOUNTAIN_INTERACTIONS.map((m) => {
    const at = m.at as V3;
    const look: V3 = m.id.endsWith("dam-view") ? DAM_CREST : m.kind === "overlook" || m.kind === "bench" ? TOWN_SQUARE : at;
    return { id: m.id, at, look, kind: m.kind };
  }),
  // The contract's authored overlooks, each with its own look target.
  ...(contract.OVERLOOKS ?? []).filter((o) => finite(o.at) && finite(o.look)).map((o) => ({ id: o.id, at: o.at as V3, look: o.look as V3, kind: "overlook" })),
]);

/* ── Transport ─────────────────────────────────────────────────────────── */
export type RideFrame = { at: V3; dir: V3 };
/**
 * ADAPTER: the transport spline and its orientation frame. Today the
 * alignment is `transportPoint`; the tangent is a central difference.
 */
export function rideFrame(kind: TransportKind, from: number, to: number, u: number): RideFrame {
  const t = Math.max(0, Math.min(1, u)), e = 0.004;
  // The contract's arc-length spline (constant cruise), when it is there.
  const spline = contract.transportSpline?.(kind);
  const s0 = spline?.stations?.[from]?.s, s1 = spline?.stations?.[to]?.s;
  if (spline && Number.isFinite(s0) && Number.isFinite(s1)) {
    const f = spline.at(s0! + (s1! - s0!) * t), dir = s1! >= s0! ? 1 : -1;
    const n = Math.hypot(f.tangent[0], f.tangent[1], f.tangent[2]) || 1;
    if (finite(f.at)) return { at: f.at as V3, dir: [f.tangent[0] / n * dir, f.tangent[1] / n * dir, f.tangent[2] / n * dir] };
  }
  const at = transportPoint(kind, from, to, t);
  const a = transportPoint(kind, from, to, Math.max(0, t - e)), b = transportPoint(kind, from, to, Math.min(1, t + e));
  let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const l = Math.hypot(dx, dy, dz);
  if (l < 1e-6) {
    const s0 = TRANSPORT_STOPS[kind][from]!.at, s1 = TRANSPORT_STOPS[kind][to]!.at;
    dx = s1[0] - s0[0]; dy = s1[1] - s0[1]; dz = s1[2] - s0[2];
  }
  const n = Math.hypot(dx, dy, dz) || 1;
  return { at: at as V3, dir: [dx / n, dy / n, dz / n] };
}
/** ADAPTER: a transport stop's platform. */
export const stopAt = (kind: TransportKind, index: number): V3 => (TRANSPORT_STOPS[kind][index]?.at ?? TOWN_SQUARE) as V3;
/**
 * ADAPTER: where the gondola cable crosses the gorge — the reveal. Today the
 * cable is one straight line; the reveal is the point on the river nearest
 * the cable's middle third (the contract names it `GORGE_CROSSING`).
 */
export const GORGE_REVEAL: V3 = (() => {
  const a = GONDOLA_STOPS[0]!.at, b = GONDOLA_STOPS[1]!.at;
  const river = contract.GORGE?.points?.length ? contract.GORGE.points : RIVER;
  let best: V3 = [0, 20, -100], gap = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = 0.3 + (i / 24) * 0.4, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
    const p = nearestOnRoute(x, z, river);
    if (p.distance < gap) { gap = p.distance; best = p.point as V3; }
  }
  return best;
})();
export const FUNICULAR_COUNT = FUNICULAR_STOPS.length;

/* ── Race ──────────────────────────────────────────────────────────────── */
/** ADAPTER: the race corridor, start first (named segments when the contract lands). */
export const RACE_LINE: readonly V3[] = MOUNTAIN_COURSE_POINTS as readonly V3[];
/** ADAPTER: the Fund bank's front door (the finish's "Open the Fund"). */
export const FUND_DOOR: V3 = CAMERA_DOORS.bank?.at ?? [8, 0, -22];

/* ── Camera solids ─────────────────────────────────────────────────────── */
const box = (id: string, c: V3, size: V3): CameraSolid => ({ id, min: [c[0] - size[0] / 2, c[1] - size[1] / 2, c[2] - size[2] / 2], max: [c[0] + size[0] / 2, c[1] + size[1] / 2, c[2] + size[2] / 2] });
/**
 * ADAPTER: geography's camera volumes. Until they land: the two town
 * storefronts (with their roofs), the dam's stone abutments, and every
 * transport pillar — the things the dissection found the eye passing through.
 */
export const CAMERA_SOLIDS: readonly CameraSolid[] = Object.freeze([
  // The two town storefronts (the geography's oriented footprints, with their roofs).
  ...STOREFRONT_SOLIDS.map((f): CameraSolid => {
    const base = groundHeightAt(f.x, f.z), hx = f.halfX + 0.1, hz = f.halfZ + 0.1;
    return { id: f.id, min: [f.x - hx, base - 0.2, f.z - hz], max: [f.x + hx, base + 5.1, f.z + hz], yaw: f.yaw };
  }),
  ...(contract.DAM?.abutments?.length
    ? contract.DAM.abutments.map((a, i) => box(`dam:abutment:${i}`, a.at as V3, [a.size[0] + 0.4, a.size[1] + 0.4, a.size[2] + 0.4]))
    : [-1, 1].map((side) => {
      const a = side * BASIN.angle / 2;
      return box(`dam:abutment:${side}`, [BASIN.x + Math.sin(a) * BASIN.radius, 80, BASIN.z + Math.cos(a) * BASIN.radius], [3.9, 19.4, 4.4]);
    })),
  ...(["funicular", "gondola"] as const).flatMap((kind) => {
    const stops = TRANSPORT_STOPS[kind], out: CameraSolid[] = [];
    for (let i = 1; i < stops.length; i++) for (let k = 8; k <= 48; k += 8) {
      const b = transportPoint(kind, i - 1, i, k / 48), y = groundHeightAt(b[0], b[2]);
      if (b[1] > y + 1) out.push({ id: `${kind}:pillar:${i}:${k}`, min: [b[0] - 0.4, Math.max(0, y) - 1, b[2] - 0.4], max: [b[0] + 0.4, b[1] + 3.2, b[2] + 0.4] });
    }
    return out;
  }),
]);
/** The glass dam's curved face is a camera solid too: the eye never passes through the glass. */
function inDamGlass(x: number, y: number, z: number, r: number): boolean {
  if (y < BASIN.bottom - 1 || y > BASIN.top + 0.6) return false;
  const dx = x - BASIN.x, dz = z - BASIN.z, d = Math.hypot(dx, dz);
  if (Math.abs(d - BASIN.radius) > 0.5 + r) return false;
  const a = Math.atan2(dx, dz);
  return Math.abs(a) <= BASIN.angle / 2 + 0.05;
}
/** The village buildings, each read once: centre, frame and ground (the fast twin of `insideVillageBuilding`). */
const BUILDINGS = Object.values(VILLAGE_SITES).map((site) => {
  const yaw = siteYaw(site.spot);
  return { x: site.spot[0], z: site.spot[1], c: Math.cos(yaw), s: Math.sin(yaw), hx: site.half[0], hz: site.half[1], base: groundHeightAt(site.spot[0], site.spot[1]) };
});
function inBuilding(x: number, y: number, z: number, margin: number): boolean {
  for (const b of BUILDINGS) {
    if (y < b.base || y > b.base + 6) continue;
    const dx = x - b.x, dz = z - b.z;
    if (Math.abs(dx * b.c - dz * b.s) < b.hx + margin && Math.abs(dx * b.s + dz * b.c) < b.hz + margin) return true;
  }
  return false;
}
/** Every walkable deck (roads, paths, platforms, branches) with its bounds, so a far one is skipped without a search. */
const DECKS = WORLD_SURFACES.map((surface) => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of surface.points) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]); }
  return { surface, minX, maxX, minZ, maxZ, minY, maxY };
});
/** A deck's slab (from 0.28 under its surface to 0.08 over it), as `worldCollisionAt` has it. */
function inDeck(x: number, y: number, z: number, r: number): boolean {
  for (const d of DECKS) {
    const w = d.surface.halfWidth + r;
    if (x < d.minX - w || x > d.maxX + w || z < d.minZ - w || z > d.maxZ + w || y < d.minY - 0.3 || y > d.maxY + 0.1) continue;
    const p = nearestOnRoute(x, z, d.surface.points);
    if (p.distance < w && y > p.point[1] - 0.28 && y < p.point[1] + 0.08) return true;
  }
  return false;
}
function inBoxes(boxes: readonly CameraSolid[] | readonly { min: readonly number[]; max: readonly number[]; yaw?: number }[], x: number, y: number, z: number, r: number): boolean {
  for (const s of boxes) {
    if (s.yaw !== undefined) {
      if (y <= s.min[1]! - r || y >= s.max[1]! + r) continue;
      const cx = (s.min[0]! + s.max[0]!) / 2, cz = (s.min[2]! + s.max[2]!) / 2, c = Math.cos(s.yaw), n = Math.sin(s.yaw), dx = x - cx, dz = z - cz;
      if (Math.abs(dx * c - dz * n) < (s.max[0]! - s.min[0]!) / 2 + r && Math.abs(dz * c + dx * n) < (s.max[2]! - s.min[2]!) / 2 + r) return true;
      continue;
    }
    if (x > s.min[0]! - r && x < s.max[0]! + r && y > s.min[1]! - r && y < s.max[1]! + r && z > s.min[2]! - r && z < s.max[2]! + r) return true;
  }
  return false;
}
/** The contract's parapets, walls and bridge rails (oriented segments), when they are there. */
const EDGES = (contract.EDGE_SOLIDS ?? []).map((e) => ({ ...e, minX: Math.min(e.a[0], e.b[0]), maxX: Math.max(e.a[0], e.b[0]), minZ: Math.min(e.a[1], e.b[1]), maxZ: Math.max(e.a[1], e.b[1]) }));
function inEdge(x: number, y: number, z: number, r: number): boolean {
  for (const e of EDGES) {
    const w = e.thickness / 2 + r;
    if (y < e.bottom - r || y > e.top + r || x < e.minX - w || x > e.maxX + w || z < e.minZ - w || z > e.maxZ + w) continue;
    const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1], l = dx * dx + dz * dz;
    const t = l > 0 ? Math.max(0, Math.min(1, ((x - e.a[0]) * dx + (z - e.a[1]) * dz) / l)) : 0;
    if (Math.hypot(x - e.a[0] - dx * t, z - e.a[1] - dz * t) < w) return true;
  }
  return false;
}
/** A moving cabin (funicular or gondola) the eye must stay out of. */
export type MovingSolid = { at: V3; half: V3 };
/**
 * Is the eye inside anything it must not enter? Terrain, decks, the world's
 * solids, the village buildings, the storefronts, the dam and a moving cabin.
 * `tier` picks the foliage density ('lite' skips the tree test).
 */
export function cameraBlocked(x: number, y: number, z: number, radius = 0.12, tier: "full" | "lite" = "lite", moving: MovingSolid | null = null): boolean {
  // Cheapest first: boxes, the dam, the buildings, then the land and the decks.
  if (moving && Math.abs(x - moving.at[0]) < moving.half[0] + radius && Math.abs(y - moving.at[1]) < moving.half[1] + radius && Math.abs(z - moving.at[2]) < moving.half[2] + radius) return true;
  if (inBoxes(CAMERA_SOLIDS, x, y, z, radius) || inBoxes(WORLD_SOLIDS, x, y, z, radius)) return true;
  if (inDamGlass(x, y, z, radius)) return true;
  if (inBuilding(x, y, z, radius)) return true;
  if (y < cameraGroundFast(x, z) + 0.05) return true;
  if (inDeck(x, y, z, radius)) return true;
  if (inEdge(x, y, z, radius)) return true;
  return tier === "full" ? mountainFoliageAt(x, y, z, tier) : false;
}
/** How many solids the adapter carries (a test reads it: none of the named kinds may go missing). */
export const CAMERA_SOLID_COUNT = CAMERA_SOLIDS.length + WORLD_SOLIDS.length;

/** The place a district or reserved plot "Visit" lands on (unchanged from the guide's own numbers). */
export function visitPoint(id: string): V3 | null {
  const d = DISTRICTS.find((x) => x.id === id);
  if (d) return id === "reservoir" ? [25, 88, -220] : [d.at[0] - 7, d.at[1], d.at[2] + 6];
  const p = RESERVED_PLOTS.find((x) => x.id === id);
  return p ? (p.at as V3) : null;
}
export type { HarbourPlaceId, Point3, TransportKind };
