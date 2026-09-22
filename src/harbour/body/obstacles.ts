/**
 * Little Harbour · what a body cannot walk through.
 *
 * Pure. Nothing here reads three.js, the DOM, time or money — it is circles
 * and axis-aligned boxes on the island's ground plane, and the arithmetic that
 * pushes a walker out of them.
 *
 * The volumes are *derived*, never invented: the Court's own layout constants
 * (`court/CourtScene.ts` `COURT_LAYOUT`, `STAIRHEAD`) say where the Queen, the
 * pieces, the sundial, the mailbox, the gate and the stairhead stand, the
 * place's `Region` boxes say how wide each building is, and `scene/planting.ts`
 * says where the tree ring was planted. A body is a circle of
 * `BODY_RADIUS`; a push-out is perpendicular, so walking into a wall slides
 * along it instead of stopping dead.
 */

// The one import here, and the whole of this lane's change to this file: the
// tree ring is no longer replanted below from a copy of `ground.ts`'s loop —
// renderer and collision now read the same plan. `scene/planting.ts` imports
// nothing itself, so this file stays free of three.js, the DOM and the clock.
import { plantPlan, trunkRadius } from "../scene/planting.ts";

export type Circle = { kind: "circle"; x: number; z: number; r: number; id: string };
export type Box = { kind: "box"; minX: number; minZ: number; maxX: number; maxZ: number; id: string };
/**
 * A box that does not stand square to the island (walk-everywhere).
 *
 * The island's own furniture is axis-aligned, so `Box` was enough for the
 * Court. A **placed** room is not: the Library stands at the yaw the Court
 * gave its shell, and its lectern is a box in the *room's* axes. Turning that
 * box into an island-aligned one would fatten it by a third, so the room's
 * yaw is carried instead and the push-out is done in the room's own frame —
 * exact, and the same arithmetic as `Box` once the point is rotated in.
 */
export type OrientedBox = { kind: "obox"; id: string; x: number; z: number; halfX: number; halfZ: number; yaw: number };
export type Obstacle = Circle | Box | OrientedBox;

/** A point in a frame's own coordinates, read in the island's. Matches `scene/place.ts` `placementToWorld`. */
const intoWorld = (frame: { x: number; z: number; yaw: number }, lx: number, lz: number): { x: number; z: number } => {
  const cos = Math.cos(frame.yaw), sin = Math.sin(frame.yaw);
  return { x: frame.x + lx * cos + lz * sin, z: frame.z + lz * cos - lx * sin };
};
/** A point on the island, read in a frame's own coordinates. The exact inverse of `intoWorld`. */
const intoLocal = (frame: { x: number; z: number; yaw: number }, x: number, z: number): { x: number; z: number } => {
  const cos = Math.cos(frame.yaw), sin = Math.sin(frame.yaw);
  const dx = x - frame.x, dz = z - frame.z;
  return { x: dx * cos - dz * sin, z: dz * cos + dx * sin };
};

/** A person in this model village: the Queen (a plant) is 2.05 tall, so a body is about 0.58. */
export const BODY_HEIGHT = 0.58;
/** How wide the body is on the ground — a shoulder's worth, so doorways and the gap between plinths stay walkable. */
export const BODY_RADIUS = 0.17;

/**
 * How far out a body may walk. `scene/ground.ts` falls quadratically from the
 * lawn's edge (r 16) to the sea: the waterline — where the island's height
 * meets `SEA_LEVEL` = −0.45 — is at r ≈ 20.8. The walk stops a stride short of
 * it, so the shore itself is the edge: you stand where the sand goes dark and
 * the sea stops you, rather than hitting an invisible fence in the grass.
 */
export const SHORE_RADIUS = 20.2;

const circle = (id: string, x: number, z: number, r: number): Circle => ({ kind: "circle", id, x, z, r });
const box = (id: string, x: number, z: number, halfX: number, halfZ: number): Box =>
  ({ kind: "box", id, minX: x - halfX, minZ: z - halfZ, maxX: x + halfX, maxZ: z + halfZ });

/**
 * The Court's own furniture, from `COURT_LAYOUT`. The Queen's spot is the
 * widest: she stands in a pot on the flagstone terrace and her leaves reach
 * past it, so a body walks around her rather than through her skirts.
 */
export const COURT_FURNITURE: readonly Obstacle[] = Object.freeze([
  circle("queen", 0, 0, 0.95),
  circle("rook", 4.2, -3.0, 0.62),
  circle("knight", -4.2, -3.0, 0.62),
  circle("bishop", 0, 4.6, 0.62),
  circle("sundial", 4.0, 3.2, 0.5),
  circle("mailbox", -1.2, 5.4, 0.34),
  circle("cistern", -5.2, -1.6, 0.8),
  // The gate is a pair of posts with a low rail between them: a wall two units
  // wide with a gap on either side, not a ring.
  box("gate", 0, 6.2, 1.25, 0.16),
  // The way down to the Cellar. A hole in the paving is a thing to walk round,
  // and tapping it is still how you go down.
  box("cellar-stair", 1.75, 4.15, 0.62, 0.52),
  // The props around the terrace edge (`COURT_LAYOUT.props`): pots and lanterns.
  circle("prop-0", -4.6, 2.6, 0.42),
  circle("prop-1", 4.9, 0.6, 0.42),
  circle("prop-2", -5.0, -0.4, 0.42),
  circle("prop-3", 2.6, -4.8, 0.42),
  circle("prop-4", -2.4, -4.9, 0.42),
]);

/**
 * The buildings on the island, as the Court's own `Region` boxes draw them
 * (`court/CourtScene.ts` `regionList`), flattened to the ground plane and
 * given a hand's breadth of eaves. Each one keeps its region's id, so a
 * push-out can be traced back to the thing that did it.
 */
export const ISLAND_BUILDINGS: readonly Obstacle[] = Object.freeze([
  { kind: "box", id: "boathouse", minX: 4.3, maxX: 6.9, minZ: -12.1, maxZ: -9.7 },
  { kind: "box", id: "library-hall", minX: -6.2, maxX: -3.2, minZ: -12.6, maxZ: -10.6 },
  { kind: "box", id: "glasshouse-shed", minX: -9.2, maxX: -7.2, minZ: -10.2, maxZ: -8.6 },
  { kind: "box", id: "kitchen-cottage", minX: -12.2, maxX: -10.2, minZ: -4.3, maxZ: -2.5 },
  { kind: "box", id: "hercules-cottage", minX: 8.8, maxX: 10.8, minZ: 4.6, maxZ: 6.6 },
  { kind: "box", id: "kiln-house", minX: 9.5, maxX: 11.7, minZ: -5.3, maxZ: -3.5 },
] as const);

/**
 * The tree ring, **read** from the plan `scene/ground.ts` draws.
 *
 * This used to be a second copy of `ground.ts`'s planting loop, kept in step
 * by hand and by `test/harbour-body.test.ts` checking it against the real
 * `InstancedMesh` matrices. It is now the same `plantPlan` the renderer calls
 * — one seed, one keep-out list, one answer — so a tree cannot be drawn in a
 * place you can walk through, or stand in your way while not being there. That
 * test still checks the two against each other, and now it can only fail if
 * one of them stops reading the plan.
 *
 * Only the trunks collide. A shrub is knee-high in this village and you walk
 * through the leaves, which is what walking past a shrub feels like.
 */
export function treeRingObstacles(tier: "full" | "lite"): Obstacle[] {
  return plantPlan(tier).trees.map((tree, i) => circle(`tree-${i}`, tree.x, tree.z, trunkRadius(tree.size)));
}

/** Everything a body standing in the Court may bump into. */
export function courtObstacles(tier: "full" | "lite"): Obstacle[] {
  return [...COURT_FURNITURE, ...ISLAND_BUILDINGS, ...treeRingObstacles(tier)];
}

/**
 * The same volumes, taken from a live place's regions instead of the table
 * above, so a place that grows a building gets collision for it without this
 * file being edited. Regions whose id is in `solid` become ground-plane boxes.
 */
export function obstaclesFromRegions(
  regions: readonly { id: string; box?: { min: { x: number; z: number }; max: { x: number; z: number } } }[],
  solid: ReadonlySet<string>,
  /**
   * Where the place those regions belong to stands, when it stands somewhere
   * (`scene/place.ts` `PLACE_PLACEMENTS`). A region's box is written in the
   * place's own coordinates; with a frame it comes back as an oriented box on
   * the island, and without one — every unplaced place, and the Court — it
   * comes back byte-for-byte the axis-aligned box it always did.
   */
  frame?: { x: number; z: number; yaw: number } | null,
): Obstacle[] {
  const found: Obstacle[] = [];
  for (const region of regions) {
    if (!solid.has(region.id) || !region.box) continue;
    const { min, max } = region.box;
    if (!(max.x > min.x) || !(max.z > min.z)) continue;
    if (!frame) { found.push({ kind: "box", id: region.id, minX: min.x, minZ: min.z, maxX: max.x, maxZ: max.z }); continue; }
    const centre = intoWorld(frame, (min.x + max.x) / 2, (min.z + max.z) / 2);
    found.push({ kind: "obox", id: region.id, x: centre.x, z: centre.z, halfX: (max.x - min.x) / 2, halfZ: (max.z - min.z) / 2, yaw: frame.yaw });
  }
  return found;
}

/** Which of the Court's regions are solid: every building, and nothing you are meant to stand on. */
export const SOLID_COURT_REGIONS: ReadonlySet<string> = new Set(ISLAND_BUILDINGS.map((o) => o.id));

export type PushOut = { x: number; z: number; hit: string | null };

/**
 * Push a circle of `radius` at (`x`,`z`) out of everything it overlaps.
 *
 * Perpendicular, shortest-way-out, and run twice so a body wedged into a
 * corner leaves by both faces rather than shuttling between them. The result
 * is a slide: the component of the move along a wall survives, the component
 * into it does not. Never a bounce, never a teleport.
 */
export function pushOut(x: number, z: number, radius: number, obstacles: readonly Obstacle[]): PushOut {
  let px = x, pz = z, hit: string | null = null;
  for (let pass = 0; pass < 2; pass += 1) {
    let moved = false;
    for (const obstacle of obstacles) {
      if (obstacle.kind === "circle") {
        const dx = px - obstacle.x, dz = pz - obstacle.z;
        const reach = obstacle.r + radius;
        const d = Math.hypot(dx, dz);
        if (d >= reach) continue;
        // Dead centre: leave along +x rather than divide by zero.
        const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
        px = obstacle.x + nx * reach; pz = obstacle.z + nz * reach;
        hit = obstacle.id; moved = true;
      } else if (obstacle.kind === "obox") {
        // The same nearest-face push, done in the box's own frame.
        const local = intoLocal(obstacle, px, pz);
        const hx = obstacle.halfX + radius, hz = obstacle.halfZ + radius;
        if (Math.abs(local.x) >= hx || Math.abs(local.z) >= hz) continue;
        const left = local.x + hx, right = hx - local.x, back = local.z + hz, front = hz - local.z;
        const least = Math.min(left, right, back, front);
        let lx = local.x, lz = local.z;
        if (least === left) lx = -hx;
        else if (least === right) lx = hx;
        else if (least === back) lz = -hz;
        else lz = hz;
        const out = intoWorld(obstacle, lx, lz);
        px = out.x; pz = out.z;
        hit = obstacle.id; moved = true;
      } else {
        const minX = obstacle.minX - radius, maxX = obstacle.maxX + radius;
        const minZ = obstacle.minZ - radius, maxZ = obstacle.maxZ + radius;
        if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ) continue;
        // Out by the nearest face: the least penetration wins, so a body
        // brushing a long wall slides along it instead of popping round it.
        const left = px - minX, right = maxX - px, back = pz - minZ, front = maxZ - pz;
        const least = Math.min(left, right, back, front);
        if (least === left) px = minX;
        else if (least === right) px = maxX;
        else if (least === back) pz = minZ;
        else pz = maxZ;
        hit = obstacle.id; moved = true;
      }
    }
    if (!moved) break;
  }
  return { x: px, z: pz, hit };
}

/** Is a circle of `radius` at (`x`,`z`) clear of everything? */
export function isClear(x: number, z: number, radius: number, obstacles: readonly Obstacle[]): boolean {
  const out = pushOut(x, z, radius, obstacles);
  return Math.abs(out.x - x) < 1e-9 && Math.abs(out.z - z) < 1e-9;
}

/** Hold a point inside the shore ring. Returns the point unchanged when it is already ashore. */
export function holdAshore(x: number, z: number, limit = SHORE_RADIUS): { x: number; z: number; ashore: boolean } {
  const d = Math.hypot(x, z);
  if (d <= limit || d <= 0) return { x, z, ashore: true };
  const k = limit / d;
  return { x: x * k, z: z * k, ashore: false };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Walls (walk-everywhere)
 *
 * Outdoors the shore holds the body in: one radius, one clamp
 * (`holdAshore`). Indoors it is a room that holds it, and a room is not a
 * ring — it is four walls, about six units apart, with a doorway in one of
 * them. At that scale the walls matter far more than anything on the island
 * does: the body is 0.58 tall and 0.34 across, so half a stride of slop puts
 * it outside the shell, looking back at a doll's box with the ceiling missing.
 *
 * So a room is held the way the shore is — a clamp, not an obstacle. Four
 * wall boxes would work, but a clamp is exact at the corners, costs one
 * rotation, and says the true thing: *inside is where you are*.
 *
 * The doorway is a **gap in the clamp**, not a hole in a wall: step into it
 * and the wall on that side stops holding you, so you walk out. Once the
 * body's centre is past the wall the room has let go of it entirely — which
 * is what makes walking out of a placed building continuous, because the
 * threshold machinery in `scene/runtime.ts` is watching that very crossing.
 * ────────────────────────────────────────────────────────────────────────── */

/** A room's floor, in the room's own axes, standing at `x`,`z` on the island and turned by `yaw`. */
export type RoomBounds = {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  /** 0 for a room built at the island's origin; the building's own yaw for a placed one. */
  yaw: number;
  /** The doorway, in the room's own coordinates: a gap `half` wide in the wall it is nearest. */
  door?: { x: number; z: number; half: number } | null;
};

/** Which wall a doorway is in: the axis it is nearest, and which side of the room. */
export function doorWall(room: RoomBounds): { axis: "x" | "z"; side: 1 | -1 } | null {
  const door = room.door;
  if (!door) return null;
  const clearX = room.halfX - Math.abs(door.x), clearZ = room.halfZ - Math.abs(door.z);
  if (clearZ <= clearX) return { axis: "z", side: door.z >= 0 ? 1 : -1 };
  return { axis: "x", side: door.x >= 0 ? 1 : -1 };
}

/**
 * Hold a body of `radius` inside a room.
 *
 * `inside` is false when the body's centre is already past the walls — it
 * walked out through the doorway, and a room that grabbed it back would make
 * leaving impossible. Nothing is moved in that case.
 */
export function holdInRoom(x: number, z: number, radius: number, room: RoomBounds): { x: number; z: number; inside: boolean; wall: string | null } {
  const local = intoLocal(room, x, z);
  if (Math.abs(local.x) > room.halfX || Math.abs(local.z) > room.halfZ) return { x, z, inside: false, wall: null };
  const reachX = Math.max(0, room.halfX - radius), reachZ = Math.max(0, room.halfZ - radius);
  const gap = doorWall(room);
  const throughX = gap?.axis === "x" && room.door ? Math.abs(local.z - room.door.z) <= room.door.half && Math.sign(local.x) === gap.side : false;
  const throughZ = gap?.axis === "z" && room.door ? Math.abs(local.x - room.door.x) <= room.door.half && Math.sign(local.z) === gap.side : false;
  let lx = local.x, lz = local.z, wall: string | null = null;
  if (!throughX && Math.abs(lx) > reachX) { lx = Math.sign(lx) * reachX; wall = lx > 0 ? "wall+x" : "wall-x"; }
  if (!throughZ && Math.abs(lz) > reachZ) { lz = Math.sign(lz) * reachZ; wall = lz > 0 ? "wall+z" : "wall-z"; }
  if (!wall) return { x, z, inside: true, wall: null };
  const out = intoWorld(room, lx, lz);
  return { x: out.x, z: out.z, inside: true, wall };
}

/** Is a point inside a room's walls? The rotation is the room's own. */
export function inRoom(x: number, z: number, room: RoomBounds): boolean {
  const local = intoLocal(room, x, z);
  return Math.abs(local.x) <= room.halfX && Math.abs(local.z) <= room.halfZ;
}
