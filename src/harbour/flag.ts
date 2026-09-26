import { placeAtLocation } from './village/placeAtLocation.ts';
import type { VillageLocation } from '../house/villageLocation.ts';
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
export type HarbourPlaceId = "court" | "bank" | "tower" | "cellar" | "glasshouse" | "kitchen" | "boathouse" | "library" | "cottage" | "kiln" | "campfire" | "atlas";

/**
 * Rooms the harbour owns, by house room **and level**. Slice 1 gave `home` one
 * place for all three levels; slice 2 gives it the Rook's Tower above, the
 * Court in the middle and the Cellar below. Later slices add rows — a room
 * with one place simply names it on all three levels.
 */
export const HARBOUR_ROOMS: Readonly<Partial<Record<HouseRoom, Readonly<Partial<Record<HouseLevel, HarbourPlaceId>>>>>> = Object.freeze({
  home: Object.freeze({ above: "tower", middle: "court", below: "cellar" }),
  // The Study: the Glasshouse stands behind the Library and is the planner and
  // the calendar as one object (LITTLE_HARBOUR_v2 §3) — the room's `above`
  // (the Master Planner) and `below` (the Calendar) both open onto it. The
  // Standing Book (`middle`) stays the house's own until the Library is built,
  // so a room row may now leave a level out and the house keeps that level.
  study: Object.freeze({ above: "glasshouse", middle: "library", below: "glasshouse" }),
  // The Kitchen (LITTLE_HARBOUR_v2 §4): the conversation folio and the Plan
  // Studio open onto one warm room. Journey (`above`) is the Atlas up the
  // kitchen stair — the map room the whole Journey is seen from. The world
  // itself is not a room of this one: the island on the Atlas's stand is a
  // **door** onto it (`onOpen("journey")`), which is the same route with its
  // own surface in front, so stepping into Journey is still stepping out.
  "kitchen-table": Object.freeze({ above: "atlas", middle: "kitchen", below: "kitchen" }),
  // The Boathouse (§5): the whole Together room, tucked into one small
  // building on the shore — Conservatory above, common room, Theatre below.
  together: Object.freeze({ above: "boathouse", middle: "boathouse", below: "boathouse" }),
  // Making (§2): the district the compass already names (`nav/Compass.tsx`
  // `MAKING_SURFACES`) becomes a room of its own so its buildings can stand.
  // Hercules's Cottage is its middle — his room, his door. The Kiln is its
  // `above`, the slot `HOUSE_PLACES.making.above` has always called "The Kiln":
  // `houseTargetRoute` sends the `pottery` target here, so the kitty studio's
  // own route stands the building the studio lives in. Together keeps all
  // three of the Boathouse's levels, exactly as it had them.
  // The Campfire (§6) is an outdoor place, not a room of the Making lawn: it
  // stands on the shore in front of the Boathouse. It is keyed at the one free
  // room×level slot the harbour has left (`making/below`) so it can be a full
  // place with its own chunk, its own hold and its own flat edition; the
  // compass reads that slot as **Together**, which is where the fire belongs.
  making: Object.freeze({ above: "kiln", middle: "cottage", below: "campfire" }),
});

/**
 * The place's own name, as the door strip and the twins say it ("← Put it back in the Loft").
 * Tool Atlas §3.2 vocabulary: the square is **the square** (not "Town square" / "The Court"),
 * and the Fund's building is **the Fund bank** — the same names in Ours and in Mine.
 */
export const HARBOUR_PLACE_NAMES: Readonly<Record<HarbourPlaceId, string>> = Object.freeze({
  court: "the square", bank: "the Fund bank", tower: "the Loft", cellar: "the Cellar", glasshouse: "the Glasshouse",
  kitchen: "the Kitchen", boathouse: "the Boathouse", library: "the Library", cottage: "the Cottage", kiln: "the Kiln",
  campfire: "the Campfire", atlas: "the Atlas",
});

/** Which level of its room a place stands on: the stair's destination, and the route a door tap navigates to. */
export const HARBOUR_PLACE_LEVELS: Readonly<Record<HarbourPlaceId, HouseLevel>> = Object.freeze({
  court: "middle", bank: "middle", tower: "above", cellar: "below", glasshouse: "above",
  kitchen: "middle", boathouse: "middle", library: "middle", cottage: "middle", kiln: "above", campfire: "below", atlas: "above",
});

/** Which room a place belongs to, so a way out of one room can name a place in another. */
export const HARBOUR_PLACE_ROOMS: Readonly<Record<HarbourPlaceId, HouseRoom>> = Object.freeze({
  court: "home", bank: "home", tower: "home", cellar: "home", glasshouse: "study",
  kitchen: "kitchen-table", boathouse: "together", library: "study", cottage: "making", kiln: "making", campfire: "making", atlas: "kitchen-table",
});

/**
 * The island walk (LITTLE_HARBOUR_v2 §1): buildings standing on the Court's
 * island whose doors are whole rooms. Tapping one — or its twin — walks there.
 * These are routes, not places of the `home` room, so they live beside the
 * ways rather than inside them; `HarbourWorld.activate` checks them after.
 */
export const HARBOUR_LANDMARKS: Readonly<Record<string, { room: HouseRoom; level: HouseLevel }>> = Object.freeze({
  boathouse: { room: "together", level: "middle" },
  "library-hall": { room: "study", level: "middle" },
  "glasshouse-shed": { room: "study", level: "above" },
  "kitchen-cottage": { room: "kitchen-table", level: "middle" },
  /** Hercules's Cottage on the east lawn: his room, with its own door and his own. */
  "hercules-cottage": { room: "making", level: "middle" },
  /** The Kiln on the Making lawn: the pottery studio's own building. */
  "kiln-house": { room: "making", level: "above" },
  /** The Campfire on the shore in front of the Boathouse: where the month closes. */
  campfire: { room: "making", level: "below" },
  /** The Library's own back door into the garden behind it. */
  "glasshouse-way": { room: "study", level: "above" },
  /** The atlas up the kitchen stair: the map room the Journey is entered from. */
  atlas: { room: "kitchen-table", level: "above" },
});

/**
 * A room in the table, in **either space** (Tool Atlas D2, "one island for
 * both spaces"): the harbour now owns Household *and* Personal routes, so the
 * same `HarbourWorld` mounts in My Money and draws the owner-only Mine layer
 * (`harbour/mine/`) on the household map. `view` is kept in the signature for
 * callers and for the day a space-only room exists; it no longer refuses.
 *
 * Consequence (read before wiring App.tsx): every App branch that used
 * `!harbourOwnsRoute(route, "personal")` to reach Codex's `HouseWorld` (the
 * personal illustrated house, T63) or the personal flat Desk now sees `true`
 * for the same rooms — the personal house is no longer reachable through this
 * predicate, and the App must pass `space` / `mineHousehold` / `onOpenMine`
 * to `HarbourWorld` (see `docs/claude/tool-atlas/HANDOFF-mine.md`, "Wiring"). The harbour's reading
 * stays the household's in both spaces (`data/useHarbourReading.ts` is keyed
 * `scope: "household"`), so hosts keep their meaning: the Fund bank is always
 * the shared Fund. World presence publishes nothing from a personal view
 * (`softPresenceWorld.ts` gate), so standing in Mine shares no position.
 *
 * Journey is still a full Path surface reached through the Atlas, not the
 * Atlas room itself, in both spaces. `enabled` is a test seam; production
 * reads the flag.
 */
export function harbourOwnsRoute(route: Pick<HouseRoute, "room" | "level" | "surface"> | null | undefined, view: LedgerView, enabled: boolean = HARBOUR_ENABLED): boolean {
  void view;
  if (!enabled || !route) return false;
  // Journey is a full Path surface reached through the Atlas, not the Atlas room itself.
  if (route.surface === "journey") return false;
  // By room **and level** since the Glasshouse: a room row may leave a level to
  // the house (the Study's Standing Book keeps Codex's presentation for now).
  return HARBOUR_ROOMS[route.room]?.[route.level] !== undefined;
}

/** The two spaces' names on screen (brief §3.2): the pill says Ours | Mine; the house stays "Our home". */
export const HARBOUR_SPACE_NAMES = Object.freeze({ household: "Ours", personal: "Mine" } as const);

/** The place a harbour route lands in — the room's place for that route's level — or null when the house owns it. */
export function harbourPlaceFor(route: Pick<HouseRoute, "room" | "level"> & {village?:VillageLocation;surface?:string} | null | undefined, view: LedgerView, enabled: boolean = HARBOUR_ENABLED): HarbourPlaceId | null {
  if (!harbourOwnsRoute(route, view, enabled) || !route) return null;
  if (route.village) return placeAtLocation(route.village);
  if (route.surface === "queen") return "bank";
  return HARBOUR_ROOMS[route.room]?.[route.level] ?? null;
}

/**
 * Anchors that are a **way into another place of the room**, not a door onto
 * an HTML surface (BUILD_PLAN_SLICE2 §0 "Enter, then Open"). Tapping the Rook
 * climbs the tower; tapping the Bishop or the stairhead goes down to the
 * cellar; a stair in either of them comes back up to the Court. The Knight is
 * not here: he still opens Protect, through the cistern.
 */
export const HARBOUR_WAYS: Readonly<Record<string, HarbourPlaceId>> = Object.freeze({
  rook: "tower",
  "tower-stair": "tower",
  bishop: "cellar",
  "cellar-stair": "cellar",
  hatch: "cellar",
  stair: "court",
  /** The Atlas is the Kitchen's own loft: its stair goes back down into the Kitchen, not to the Court. */
  "kitchen-stair": "kitchen",
});

/**
 * Where an anchor leads, or null when it is not a way at all. An anchor the
 * table does not name but whose zone is `stair` comes back to the Court, so a
 * place may add a stair without amending this table.
 */
export function harbourWayFor(anchorId: string, zone?: string): HarbourPlaceId | null {
  return HARBOUR_WAYS[anchorId] ?? (zone === "stair" ? "court" : null);
}

/** The Court: the first screen after sign-in (LITTLE_HARBOUR_v2 §1). */
export function COURT_ROUTE(householdId: string): HouseRoute {
  return { room: "home", level: "middle", householdId, scope: "household" };
}
