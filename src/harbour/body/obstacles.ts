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
export type Obstacle = Circle | Box;

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
): Obstacle[] {
  const found: Obstacle[] = [];
  for (const region of regions) {
    if (!solid.has(region.id) || !region.box) continue;
    const { min, max } = region.box;
    if (!(max.x > min.x) || !(max.z > min.z)) continue;
    found.push({ kind: "box", id: region.id, minX: min.x, minZ: min.z, maxX: max.x, maxZ: max.z });
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
