import type { HarbourPlaceId } from "../flag.ts";
import type { RoomHold, Vec3 } from "../camera/poses.ts";
import {skateSurface} from '../skate/park.ts';
import { groundHeightAt } from "../scene/ground.ts";
import { PLACE_HOLDS, placementLift, placementOf, placementToWorld, type Anchor, type Region } from "../scene/place.ts";
import { BODY_HEIGHT, BODY_RADIUS, courtObstacles, obstaclesFromRegions, type Obstacle, type RoomBounds } from "./obstacles.ts";

/**
 * Little Harbour · **where a body may stand, in every place** (walk-everywhere).
 *
 * The character shipped Court-only. Not because a room could not hold one —
 * because nothing said, per place, three things: what the floor is, what the
 * walls are, and where you come in. This file says them, once, for all eleven,
 * and it says them by **reading each place's own numbers** rather than by
 * inventing a second set beside them:
 *
 * - the floor is the island's analytic profile outdoors (`scene/ground.ts`),
 *   and one flat plane indoors — at the height that room built its floor at,
 *   lifted onto the island for a placed building (`placementLift`);
 * - the walls are the room's own hold (`PLACE_HOLDS`) for a room at the
 *   origin, and the building's own footprint (`PLACE_PLACEMENTS`) for a placed
 *   one, so nothing here is a per-room number typed by hand;
 * - what you cannot walk through is the place's own `Region` list, filtered to
 *   the things that actually reach the floor and stand tall enough to be in
 *   the way, plus the walls.
 *
 * Pure. Nothing here reads three.js, the DOM, time or money.
 */

/**
 * The height each interior built its own floor at, in the place's own
 * coordinates — `null` for a place whose floor **is** the island.
 *
 * Every interior in the harbour happens to lay its floor at y = 0 (the
 * `<place>-floor` plane, the Glasshouse's gravel bed, the Boathouse's deck
 * course, the Tower's landing — "floor 0 at y = 0"). That is a fact about
 * those rooms, not an assumption this file is allowed to make, so it is
 * written down per place and `test/harbour-walk-everywhere.test.ts` raycasts
 * each room's real geometry to prove the number still matches the floor you
 * would land on.
 */
export const PLACE_FLOOR: Readonly<Record<HarbourPlaceId, number | null>> = Object.freeze({
  /** The Court is the island: a sloped analytic surface, never a plane. */
  court: null,
  bank: 0.06,
  tower: 0.07,
  cellar: 0,
  glasshouse: 0,
  kitchen: 0,
  boathouse: 0,
  library: 0,
  cottage: 0,
  kiln: 0,
  atlas: 0,
  /** The shore's own swept apron, over the island rather than instead of it. */
  campfire: 0,
});

/**
 * Places that are outdoors but lay a floor of their own. The Campfire is a
 * swept apron of sand on the shore: its logs, its ring and its path of months
 * all stand on that apron, so the body stands on it too — and follows the
 * island up again anywhere the island is the higher of the two.
 */
export const OPEN_AIR: ReadonlySet<HarbourPlaceId> = new Set<HarbourPlaceId>(["campfire"]);

/**
 * Is this place a room, with a ceiling over it? The Court is the island and
 * the Campfire is the shore in front of the Boathouse: both are open sky, and
 * a camera under open sky stands back as far as it likes. Indoors it does not.
 */
export const walksIndoors = (place: HarbourPlaceId): boolean => place !== "court" && !OPEN_AIR.has(place);

/** The floor under a point, for the place that is standing. Pure and total. */
export function placeGround(place: HarbourPlaceId): (x: number, z: number) => number {
  const floor = PLACE_FLOOR[place];
  if (floor === null) return (x,z)=>skateSurface(x,z,groundHeightAt).y;
  const placement = placementOf(place);
  if (placement) {
    // A placed room's floor is one plane, lifted clear of the island under it.
    const level = placementLift(placement) + floor;
    if (placement.outdoor) return (x, z) => {
      const terrain = groundHeightAt(x, z);
      return Math.hypot(x - placement.spot[0], z - placement.spot[1]) <= 4.2 ? Math.max(terrain, level) : terrain;
    };
    return () => level;
  }
  if (OPEN_AIR.has(place)) return (x, z) => Math.max(groundHeightAt(x, z), floor);
  return () => floor;
}

/** How wide a doorway's gap in the wall is, as a fraction of the door's own arrival radius, and never narrower than this. */
export const DOOR_HALF_MIN = 0.45;
/** How far past an exit anchor the floor is allowed to reach, so the door is a place you can actually stand. */
export const EXIT_PAD = BODY_RADIUS + 0.25;
/** How near an exit anchor counts as having walked out through it. */
export const EXIT_REACH = 0.7;
/**
 * How far inside a placed building's shell its floor stops.
 *
 * A placement's footprint is the **outer** wall line; the room's own hold is
 * the shell less the thickness of the stone. The floor stops a hand's breadth
 * inside even that, and the reason is the camera: the eye stands behind the
 * body and the hold will not let it through a wall, so a body allowed to press
 * its nose against the plaster leaves the camera nowhere at all to stand.
 */
export const ROOM_INSET = 0.5;
/** How far inside the door a body is stood when it arrives in a room: well clear of `EXIT_REACH`, so arriving is not leaving. */
export const ARRIVAL_STEP = 1.25;

/** The anchors that are a way out of a place: the stair, the door, the footpath up the shore. */
export function exitAnchors(anchors: readonly Anchor[]): Anchor[] {
  return anchors.filter((anchor) => anchor.zone === "stair" || anchor.zone === "portal");
}

/**
 * The walls, for the place that is standing — `null` for the Court, which is
 * open sky and held by the shore alone.
 *
 * A **placed** building's floor is its own footprint, turned by the yaw the
 * Court stood it at, with its doorway as the gap. An unplaced room's floor is
 * its camera hold's target box — the volume the room already says the eye may
 * look inside — grown just far enough to put the doorway underfoot and then
 * held back inside the hold's eye box, which is the room's shell. So a room
 * that moves, or one that is added, brings its own floor with it.
 */
export function placeRoom(place: HarbourPlaceId, anchors: readonly Anchor[] = []): RoomBounds | null {
  const placement = placementOf(place);
  if (placement?.outdoor) return null;
  const hold = PLACE_HOLDS[place];
  if (placement) {
    // The footprint, held inside the room's own shell (its hold, written in
    // the room's own coordinates) and then inside that by a hand's breadth.

    return {
      x: placement.spot[0], z: placement.spot[1],
      halfX: Math.max(BODY_RADIUS * 2, placement.halfWidth - .2),
      halfZ: Math.max(BODY_RADIUS * 2, placement.halfDepth - .2),
      yaw: placement.yaw,
      door: placement.internal ? null : { x: placement.door[0], z: placement.door[2], half: .55 },
    };
  }
  if (!hold) return null;
  let minX = hold.target.min[0], maxX = hold.target.max[0];
  let minZ = hold.target.min[2], maxZ = hold.target.max[2];
  for (const exit of exitAnchors(anchors)) {
    const [ax, , az] = exit.position;
    if (!Number.isFinite(ax) || !Number.isFinite(az)) continue;
    minX = Math.min(minX, ax - EXIT_PAD); maxX = Math.max(maxX, ax + EXIT_PAD);
    minZ = Math.min(minZ, az - EXIT_PAD); maxZ = Math.max(maxZ, az + EXIT_PAD);
  }
  // Never past the room's own shell, however far out a door was hung.
  minX = Math.max(minX, hold.eye.min[0]); maxX = Math.min(maxX, hold.eye.max[0]);
  minZ = Math.max(minZ, hold.eye.min[2]); maxZ = Math.min(maxZ, hold.eye.max[2]);
  return {
    x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
    halfX: Math.max(BODY_RADIUS * 2, (maxX - minX) / 2),
    halfZ: Math.max(BODY_RADIUS * 2, (maxZ - minZ) / 2),
    yaw: 0,
    door: null,
  };
}

/**
 * A thing is in the way when it stands **where the body is**: its box has to
 * reach down into the body's own height band (the floor to `BODY_HEIGHT`) and
 * up past a shin. So the Library's lectern and the Boathouse's workbench are
 * walked around, the bill rail and the jars on it and the reading balcony and
 * the lanterns in the rafters are walked under, and a stone laid flat on the
 * shore's path is still a step and not a wall.
 *
 * "Reaches the floor" was the first rule and it was wrong: a bench whose box
 * starts at 0.4 floats clear of the floor and is still chest-high on a body
 * 0.58 tall, so the body walked straight through it.
 */
export const SOLID_RISE = 0.22;

/**
 * Which of a place's regions a body cannot walk through: the ones that reach
 * the floor and stand high enough to stop a shin. A region whose box floats
 * clear of the floor — the bill rail, the jars on it, the reading balcony, the
 * lanterns in the rafters — is walked under, which is what walking under them
 * feels like. The way out is never solid: you have to be able to reach the
 * door you are leaving through.
 */
export function solidRegionIds(place: HarbourPlaceId, regions: readonly Region[], anchors: readonly Anchor[] = []): Set<string> {
  const floor = PLACE_FLOOR[place] ?? 0;
  const ways = new Set(exitAnchors(anchors).map((anchor) => anchor.id));
  const solid = new Set<string>();
  for (const region of regions) {
    if (!region.box || region.box.isEmpty?.() || ways.has(region.id)) continue;
    const { min, max } = region.box;
    // Above the body's own head: walked under.
    if (min.y > floor + BODY_HEIGHT) continue;
    // Below a shin: walked over.
    if (max.y < floor + SOLID_RISE) continue;
    solid.add(region.id);
  }
  return solid;
}

/**
 * What a place's own geometry does not say but a body would walk into.
 *
 * The Boathouse's slip is a hole in the deck with water in it: the rowboat
 * floating in it is a region, the open water beside the boat is not. The
 * numbers mirror `BOATHOUSE_LAYOUT.slip`, which lives inside the Boathouse's
 * own lazy chunk — importing it here would pull that chunk into the runtime
 * every reader downloads, so it is written once more and
 * `test/harbour-walk-everywhere.test.ts` holds the two together.
 */
export const PLACE_HAZARDS: Readonly<Partial<Record<HarbourPlaceId, readonly Obstacle[]>>> = Object.freeze({
  boathouse: Object.freeze<Obstacle[]>([{ kind: "box", id: "slip", minX: -0.85, maxX: 0.85, minZ: -0.4, maxZ: 2.9 }]),
});

/** Everything a body standing in `place` may bump into, in island coordinates. */
export function placeObstacles(place: HarbourPlaceId, regions: readonly Region[], anchors: readonly Anchor[] = [], tier: "full" | "lite" = "full"): Obstacle[] {
  if (place === "court") return courtObstacles(tier);
  const placement = placementOf(place);
  const frame = placement ? { x: placement.spot[0], z: placement.spot[1], yaw: placement.yaw } : null;
  const own = obstaclesFromRegions(regions, solidRegionIds(place, regions, anchors), frame);
  const hazards = PLACE_HAZARDS[place] ?? [];
  return [...own, ...obstaclesFromRegions(hazards.flatMap(boxRegion), new Set(hazards.map((o) => o.id)), frame)];
}

/** A hazard box read as a region, so one code path turns both onto the island. */
function boxRegion(hazard: Obstacle): { id: string; box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } }[] {
  if (hazard.kind !== "box") return [];
  return [{ id: hazard.id, box: { min: { x: hazard.minX, y: 0, z: hazard.minZ }, max: { x: hazard.maxX, y: 1, z: hazard.maxZ } } }];
}

/**
 * Where a body stands when it arrives in a place, and which way it faces: a
 * step inside the doorway, looking into the room. Derived from the way out —
 * a placed building's own door, an unplaced room's stair — so a room that
 * moves its door moves where you come in.
 */
export function placeArrival(place: HarbourPlaceId, anchors: readonly Anchor[] = []): { x: number; z: number; yaw: number } {
  const placement = placementOf(place);
  const room = placeRoom(place, anchors);
  if(placement?.internal){
    const portal=anchors.find(a=>a.zone==='portal');
    const [dx,,dz]=portal?.position??[0,0,1.5];const length=Math.hypot(dx,dz)||1;
    const [x,,z]=placementToWorld(placement,[dx-dx/length*ARRIVAL_STEP,0,dz-dz/length*ARRIVAL_STEP]);
    return {x,z,yaw:Math.atan2(-dx,-dz)+placement.yaw};
  }
  if (placement) {
    const [dx, , dz] = placement.door;
    const inward = Math.hypot(dx, dz) || 1;
    const local: [number, number, number] = [dx - (dx / inward) * ARRIVAL_STEP, 0, dz - (dz / inward) * ARRIVAL_STEP];
    const [wx, , wz] = placementToWorld(placement, local);
    // Facing the room: away from the door, turned with the building.
    return { x: wx, z: wz, yaw: Math.atan2(-dx / inward, -dz / inward) + placement.yaw };
  }
  const exit = exitAnchors(anchors)[0];
  const centre = { x: room?.x ?? 0, z: room?.z ?? 0 };
  if (!exit) return { x: centre.x, z: centre.z, yaw: Math.PI };
  const [ax, , az] = exit.position;
  const toward = Math.hypot(centre.x - ax, centre.z - az) || 1;
  const ux = (centre.x - ax) / toward, uz = (centre.z - az) / toward;
  return { x: ax + ux * ARRIVAL_STEP, z: az + uz * ARRIVAL_STEP, yaw: Math.atan2(ux, uz) };
}

/** The smaller half-extent of a room: what the follow camera has room for. */
export const roomReach = (room: RoomBounds | null): number | null => (room ? Math.min(room.halfX, room.halfZ) : null);

/**
 * The room's floor as an axis-aligned box on the island — the smallest one
 * that still contains the turned room, exactly as `placedHold` does it. The
 * follow camera's look-at is held inside this rather than inside the room's
 * written target box, because the thing it is looking at is your own body and
 * your own body may stand anywhere on this floor.
 */
export function roomFloorBox(room: RoomBounds): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const cos = Math.cos(room.yaw), sin = Math.sin(room.yaw);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const lx of [-room.halfX, room.halfX]) for (const lz of [-room.halfZ, room.halfZ]) {
    const x = room.x + lx * cos + lz * sin, z = room.z + lz * cos - lx * sin;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * The room the **follow camera's** eye may not leave: the place's own hold,
 * with its `target` box grown to this room's floor.
 *
 * The eye box is the place's own, untouched — "a room may never be seen from
 * the lawn" is the rule the rooms were given and this lane does not soften
 * it. The target box is a different promise: it is there so the look-at
 * cannot wander onto the lawn, and when the thing being looked at is your own
 * body standing on this room's floor, the floor is the honest bound. Without
 * it the camera stops looking at you in the corners of every placed room.
 */
export function followHoldIn(hold: RoomHold | null, room: RoomBounds | null): RoomHold | null {
  if (!hold || !room) return hold;
  const floor = roomFloorBox(room);
  return {
    ...hold,
    target: {
      min: [Math.min(hold.target.min[0], floor.minX), hold.target.min[1], Math.min(hold.target.min[2], floor.minZ)] as Vec3,
      max: [Math.max(hold.target.max[0], floor.maxX), hold.target.max[1], Math.max(hold.target.max[2], floor.maxZ)] as Vec3,
    },
  };
}
