import type { HouseRoute } from "../hearthside/houseRoutes.ts";

/**
 * The slot belongs to the thing being opened, not the room being left.
 * An addressed object therefore keeps its own way back when another object
 * is opened from the same surface.
 */
export function houseReturnSlot(route: Pick<HouseRoute, "surface" | "object">): string {
  const surface = route.surface?.trim();
  if (!surface) return "arrival";
  const object = route.object?.trim();
  return object ? `${surface}:${object}` : surface;
}

/** Camera state belongs to the room/time view, while the arrival record keeps its full route. */
export function houseCameraRoute(route: HouseRoute): HouseRoute {
  const { surface: _surface, object: _object, studioSelection: _studioSelection, ...camera } = route;
  return camera;
}

export const houseComposition = (width: number): "phone" | "desktop" => width < 720 ? "phone" : "desktop";

export function houseCameraSlot(route: HouseRoute, composition: "phone" | "desktop" = "desktop"): string {
  const camera = houseCameraRoute(route);
  return `camera:v2:${composition}:${camera.room}:${camera.level}:${camera.time ?? ""}`;
}

export function sameHouseCameraRoute(left: HouseRoute, right: HouseRoute): boolean {
  const leftCamera = houseCameraRoute(left), rightCamera = houseCameraRoute(right);
  return leftCamera.householdId === rightCamera.householdId
    && leftCamera.scope === rightCamera.scope
    && leftCamera.room === rightCamera.room
    && leftCamera.level === rightCamera.level
    && leftCamera.time === rightCamera.time;
}

/** Avoid replacing a saved origin when navigation stayed on the exact address. */
export function needsHouseReturnCapture(from: HouseRoute, to: HouseRoute): boolean {
  return houseReturnSlot(from) !== houseReturnSlot(to);
}
