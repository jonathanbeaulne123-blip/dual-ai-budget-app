import { HOUSE_WORLD_ENABLED } from "../house/navigation.ts";
import type { HouseLevel, HouseRoom, HouseRoute } from "../hearthside/houseRoutes.ts";
import type { LedgerView } from "../core/types.ts";

/**
 * Little Harbour (BUILD_PLAN §0 #2). The only file under `src/harbour/` that
 * reads `import.meta.env`. The harbour needs the whole-house flag because the
 * shared renderer lease is keyed on it (`rendererOwner.ts`).
 */
export const HARBOUR_ENABLED = HOUSE_WORLD_ENABLED && import.meta.env.VITE_HEARTH_HARBOUR === "1";

/** Slice 2: one room, three places — one per level (BUILD_PLAN_SLICE2 §0). */
export type HarbourPlaceId = "court" | "tower" | "cellar";

/**
 * Rooms the harbour owns, by house room **and level**. Slice 1 gave `home` one
 * place for all three levels; slice 2 gives it the Rook's Tower above, the
 * Court in the middle and the Cellar below. Later slices add rows — a room
 * with one place simply names it on all three levels.
 */
export const HARBOUR_ROOMS: Readonly<Partial<Record<HouseRoom, Readonly<Record<HouseLevel, HarbourPlaceId>>>>> = Object.freeze({
  home: Object.freeze({ above: "tower", middle: "court", below: "cellar" }),
});

/** The place's own name, as the door strip and the twins say it ("← Put it back in the Tower"). */
export const HARBOUR_PLACE_NAMES: Readonly<Record<HarbourPlaceId, string>> = Object.freeze({
  court: "the Court", tower: "the Tower", cellar: "the Cellar",
});

/** Which level of its room a place stands on: the stair's destination, and the route a door tap navigates to. */
export const HARBOUR_PLACE_LEVELS: Readonly<Record<HarbourPlaceId, HouseLevel>> = Object.freeze({
  court: "middle", tower: "above", cellar: "below",
});

/**
 * Household scope × a room in the table (every level and every Home surface).
 * Every other room, and the whole Personal scope, keeps Codex's `HouseWorld`.
 * Unchanged in meaning from slice 1: still room-keyed, still household-only.
 * `enabled` is a test seam; production reads the flag.
 */
export function harbourOwnsRoute(route: Pick<HouseRoute, "room"> | null | undefined, view: LedgerView, enabled: boolean = HARBOUR_ENABLED): boolean {
  if (!enabled || !route || view !== "household") return false;
  return HARBOUR_ROOMS[route.room] !== undefined;
}

/** The place a harbour route lands in — the room's place for that route's level — or null when the house owns it. */
export function harbourPlaceFor(route: Pick<HouseRoute, "room" | "level"> | null | undefined, view: LedgerView, enabled: boolean = HARBOUR_ENABLED): HarbourPlaceId | null {
  if (!harbourOwnsRoute(route, view, enabled) || !route) return null;
  return HARBOUR_ROOMS[route.room]?.[route.level] ?? null;
}

/** The Court: the first screen after sign-in (LITTLE_HARBOUR_v2 §1). */
export function COURT_ROUTE(householdId: string): HouseRoute {
  return { room: "home", level: "middle", householdId, scope: "household" };
}
