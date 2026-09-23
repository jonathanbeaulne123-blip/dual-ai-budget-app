import type { HarbourPlaceId } from "../flag.ts";
import { ROOM_PORTALS, SITE_FOR_PLACE, VILLAGE_SITES } from "./layout.ts";

type Point2 = readonly [number, number];
type Portal = { id: string; to: HarbourPlaceId; at: readonly [number, number, number]; label: string };

/** The doorway's half-width in local building coordinates. */
export const VILLAGE_DOOR_HALF_SPAN = 0.65;
/** A landing is this far past its reciprocal stair, toward the room centre. */
export const VILLAGE_PORTAL_LANDING_STEP = 1.1;

const finitePoint = (point: Point2): boolean => Number.isFinite(point[0]) && Number.isFinite(point[1]);
const yawForSite = (spot: readonly [number, number]): number => Math.atan2(-spot[0], -spot[1]);

function local(point: Point2, spot: readonly [number, number], yaw: number): [number, number] {
  const dx = point[0] - spot[0], dz = point[1] - spot[1];
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  return [dx * cos - dz * sin, dz * cos + dx * sin];
}

function crossedDoor(from: Point2, to: Point2, site: typeof VILLAGE_SITES[keyof typeof VILLAGE_SITES], entering: boolean): boolean {
  const yaw = yawForSite(site.spot), a = local(from, site.spot, yaw), b = local(to, site.spot, yaw);
  const plane = site.half[1], dz = b[1] - a[1];
  if (!Number.isFinite(dz) || Math.abs(dz) < 1e-9) return false;
  if (entering ? !(a[1] > plane && b[1] <= plane) : !(a[1] <= plane && b[1] > plane)) return false;
  const t = (plane - a[1]) / dz;
  if (t < 0 || t > 1) return false;
  const x = a[0] + (b[0] - a[0]) * t;
  return Math.abs(x - site.door[0]) <= VILLAGE_DOOR_HALF_SPAN;
}

/**
 * A single directed crossing through an exterior building door. The Court may
 * enter any exterior; an exterior entry room may only leave through its own
 * door. Floors inside the home have no outdoor crossing at all.
 */
export function crossedVillageDoor(from: Point2, to: Point2, active: HarbourPlaceId): HarbourPlaceId | null {
  if (!finitePoint(from) || !finitePoint(to) || active === "court" && from[0] === to[0] && from[1] === to[1]) return null;
  for (const site of Object.values(VILLAGE_SITES)) {
    const entry = site.entry as HarbourPlaceId;
    const isEntry = active === entry;
    if (active !== "court" && !isEntry) continue;
    if (crossedDoor(from, to, site, active === "court")) return active === "court" ? entry : "court";
  }
  return null;
}

const portalsFor = (place: HarbourPlaceId): readonly Portal[] => (ROOM_PORTALS[place] ?? []) as readonly Portal[];

/**
 * Resolve the other end of a listed stair and stand a stride into that room.
 * The coordinate is local to `to`; callers transform it through that room's
 * placement. A missing reciprocal portal fails closed.
 */
export function villagePortalArrival(from: HarbourPlaceId, to: HarbourPlaceId): { local: [number, number, number]; yaw: number } | null {
  if (from === to || !portalsFor(from).some(portal => portal.to === to)) return null;
  const reciprocal = portalsFor(to).find(portal => portal.to === from);
  if (!reciprocal) return null;
  const [x, y, z] = reciprocal.at;
  if (![x, y, z].every(Number.isFinite)) return null;
  const length = Math.hypot(x, z);
  const dx = length > 1e-8 ? -x / length : 0;
  const dz = length > 1e-8 ? -z / length : -1;
  const local: [number, number, number] = [x + dx * VILLAGE_PORTAL_LANDING_STEP, y, z + dz * VILLAGE_PORTAL_LANDING_STEP];
  return { local, yaw: Math.atan2(dx, dz) };
}

/** A streamed building only loses its shell for the active room inside it. */
export const villageExteriorCutaway = (active: HarbourPlaceId, exterior: string): boolean => {
  const building = SITE_FOR_PLACE[active];
  return building !== undefined && VILLAGE_SITES[building].exterior === exterior;
};
