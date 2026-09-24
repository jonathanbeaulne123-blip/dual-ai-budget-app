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
import { worldCollisionAt, WORLD_SOLIDS } from "../mountain/surfaces.ts";
import { mountainFoliageAt } from "../mountain/planting.ts";
import { insideVillageBuilding } from "../body/obstacles.ts";
import { BASIN, DISTRICTS, GONDOLA_STOPS, FUNICULAR_STOPS, RESERVED_PLOTS, RIVER, TRANSPORT_STOPS, nearestOnRoute, transportPoint, type Point3, type TransportKind } from "../mountain/definition.ts";
import { SUMMIT_OBSERVATORY } from "../mountain/artGeometry.ts";
import { MOUNTAIN_INTERACTIONS } from "../mountain/life.ts";
import { VILLAGE_SITES, VILLAGE_WATERFRONT } from "../village/layout.ts";
import { MOUNTAIN_COURSE_POINTS } from "../mountain/race.ts";

export type V3 = readonly [number, number, number];
/** An axis-aligned box the eye may not enter. */
export type CameraSolid = { id: string; min: V3; max: V3 };
/** A doorway on the island: where it is, and the way out of it (unit, horizontal). */
export type CameraDoor = { place: string; at: V3; out: readonly [number, number] };
/** An authored place to stand and look from: where, and at what. */
export type CameraOverlook = { id: string; at: V3; look: V3; kind: string };

/* ── Terrain ───────────────────────────────────────────────────────────── */
/** ADAPTER: geography's shared height query (terrain only; decks are solids). */
export const cameraGround = (x: number, z: number): number => groundHeightAt(x, z);

/* ── Landmarks ─────────────────────────────────────────────────────────── */
/** ADAPTER: the town square's centre (the fountain) and paving height. */
export const TOWN_SQUARE: V3 = Object.freeze([0, 0.4, 0]) as V3;
/**
 * ADAPTER: the dam crest — the middle of the glass arc's top edge, on the
 * face that looks at town. Today the arc is centred on +z of the basin
 * (`landscape.ts` CylinderGeometry from −angle/2 to +angle/2).
 */
export const DAM_CREST: V3 = Object.freeze([BASIN.x, BASIN.top, BASIN.z + BASIN.radius]) as V3;
/** ADAPTER: the dam's outward face normal (horizontal), toward town. */
export const DAM_FACE: readonly [number, number] = Object.freeze([0, 1]) as readonly [number, number];
/** ADAPTER: the middle of the Fund basin's water. */
export const BASIN_CENTRE: V3 = Object.freeze([BASIN.x, (BASIN.bottom + BASIN.top) / 2, BASIN.z]) as V3;
/** ADAPTER: the summit telescope/observatory. */
export const SUMMIT_TELESCOPE: V3 = Object.freeze([SUMMIT_OBSERVATORY.at[0], SUMMIT_OBSERVATORY.at[1] + 1.4, SUMMIT_OBSERVATORY.at[2]]) as V3;
/** ADAPTER: the quay (race finish run-out). */
export const QUAY: V3 = Object.freeze([VILLAGE_WATERFRONT.spot[0], 0.6, VILLAGE_WATERFRONT.spot[1] - 6]) as V3;
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
]));
/** Which building door a mountain district's "Visit" arrives at (its destination), when it has one. */
export const DISTRICT_DOOR: Readonly<Record<string, string>> = Object.freeze({ hearth: "kitchen", orchard: "cottage", library: "library", glasshouse: "glasshouse" });

/* ── Overlooks and small moments ───────────────────────────────────────── */
/**
 * ADAPTER: the authored overlooks with facings. Until geography's nodes land,
 * the current small moments stand in: an overlook or a bench looks at town
 * (the dam overlook at the dam), everything else looks at itself.
 */
export const CAMERA_MOMENTS: readonly CameraOverlook[] = Object.freeze(MOUNTAIN_INTERACTIONS.map((m) => {
  const at = m.at as V3;
  const look: V3 = m.id.endsWith("dam-view") ? DAM_CREST : m.kind === "overlook" || m.kind === "bench" ? TOWN_SQUARE : at;
  return { id: m.id, at, look, kind: m.kind };
}));

/* ── Transport ─────────────────────────────────────────────────────────── */
export type RideFrame = { at: V3; dir: V3 };
/**
 * ADAPTER: the transport spline and its orientation frame. Today the
 * alignment is `transportPoint`; the tangent is a central difference.
 */
export function rideFrame(kind: TransportKind, from: number, to: number, u: number): RideFrame {
  const t = Math.max(0, Math.min(1, u)), e = 0.004;
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
  let best: V3 = [0, 20, -100], gap = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = 0.3 + (i / 24) * 0.4, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
    const p = nearestOnRoute(x, z, RIVER);
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
  box("storefront:outfitters", [-15, 2.55, 16], [5.2, 5.1, 4.2]),
  box("storefront:potters-supply", [34, 2.55, 25], [5.2, 5.1, 4.2]),
  ...[-1, 1].map((side) => {
    const a = side * BASIN.angle / 2;
    return box(`dam:abutment:${side}`, [BASIN.x + Math.sin(a) * BASIN.radius, 80, BASIN.z + Math.cos(a) * BASIN.radius], [3.9, 19.4, 4.4]);
  }),
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
/** A moving cabin (funicular or gondola) the eye must stay out of. */
export type MovingSolid = { at: V3; half: V3 };
/**
 * Is the eye inside anything it must not enter? Terrain, decks, the world's
 * solids, the village buildings, the storefronts, the dam and a moving cabin.
 * `tier` picks the foliage density ('lite' skips the tree test).
 */
export function cameraBlocked(x: number, y: number, z: number, radius = 0.12, tier: "full" | "lite" = "lite", moving: MovingSolid | null = null): boolean {
  if (y < cameraGround(x, z) + 0.05) return true;
  if (moving && Math.abs(x - moving.at[0]) < moving.half[0] + radius && Math.abs(y - moving.at[1]) < moving.half[1] + radius && Math.abs(z - moving.at[2]) < moving.half[2] + radius) return true;
  for (const s of CAMERA_SOLIDS) if (x > s.min[0] - radius && x < s.max[0] + radius && y > s.min[1] - radius && y < s.max[1] + radius && z > s.min[2] - radius && z < s.max[2] + radius) return true;
  if (inDamGlass(x, y, z, radius)) return true;
  if (worldCollisionAt(x, y, z, radius)) return true;
  if (insideVillageBuilding(x, z, radius, y)) return true;
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
