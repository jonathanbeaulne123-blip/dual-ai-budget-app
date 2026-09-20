import { HOUSE_WORLD_ENABLED } from "../house/navigation.ts";
import type { HouseRoom, HouseRoute } from "../hearthside/houseRoutes.ts";
import type { LedgerView } from "../core/types.ts";

/**
 * Little Harbour (BUILD_PLAN §0 #2). The only file under `src/harbour/` that
 * reads `import.meta.env`. The harbour needs the whole-house flag because the
 * shared renderer lease is keyed on it (`rendererOwner.ts`).
 */
export const HARBOUR_ENABLED = HOUSE_WORLD_ENABLED && import.meta.env.VITE_HEARTH_HARBOUR === "1";

export type HarbourPlaceId = "court";

/** Rooms the harbour owns, by house room. Later slices add rows to this one table. */
export const HARBOUR_ROOMS: Readonly<Partial<Record<HouseRoom, HarbourPlaceId>>> = Object.freeze({ home: "court" });

/**
 * Slice 1: Household scope × room `home` (every level and every Home surface).
 * Every other room, and the whole Personal scope, keeps Codex's `HouseWorld`.
 * `enabled` is a test seam; production reads the flag.
 */
export function harbourOwnsRoute(route: Pick<HouseRoute, "room"> | null | undefined, view: LedgerView, enabled: boolean = HARBOUR_ENABLED): boolean {
  if (!enabled || !route || view !== "household") return false;
  return HARBOUR_ROOMS[route.room] !== undefined;
}

/** The place a harbour route lands in, or null when the house owns it. */
export function harbourPlaceFor(route: Pick<HouseRoute, "room"> | null | undefined, view: LedgerView, enabled: boolean = HARBOUR_ENABLED): HarbourPlaceId | null {
  if (!harbourOwnsRoute(route, view, enabled) || !route) return null;
  return HARBOUR_ROOMS[route.room] ?? null;
}

/** The Court: the first screen after sign-in (LITTLE_HARBOUR_v2 §1). */
export function COURT_ROUTE(householdId: string): HouseRoute {
  return { room: "home", level: "middle", householdId, scope: "household" };
}
