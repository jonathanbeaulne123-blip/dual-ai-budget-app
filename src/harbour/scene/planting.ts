import { VILLAGE_SITES } from "../village/layout.ts";
/**
 * Little Harbour · where the island's plants stand.
 *
 * **One plan, two readers.** `scene/ground.ts` draws the tree ring and the
 * shrubs; `body/obstacles.ts` turns the same trunks into the circles a body
 * bumps into. Before this module they were two copies of one loop kept in step
 * by hand and a test, which is how the island came to have conifers standing
 * inside the Kiln that you could also walk through. Now `plantPlan` is the
 * only place a plant's position is decided, and both readers call it.
 *
 * Pure: no three.js, no DOM, no clock, no imports — so it can sit under both
 * the renderer and the collision without either one dragging the other in, and
 * a test can hold the whole island still.
 */

/* ── Keep-outs: the ground a plant may not stand on ───────────────────────── */

/** A rotated rectangle on the ground plane. `yaw` 0 is axis-aligned. */
export type KeepOutRect = { kind: "rect"; id: string; x: number; z: number; halfWidth: number; halfDepth: number; yaw: number };
/** A doorway: the ground in front of a door, which has to stay walkable. */
export type KeepOutCircle = { kind: "circle"; id: string; x: number; z: number; r: number };
export type KeepOut = KeepOutRect | KeepOutCircle;

const rect = (id: string, x: number, z: number, halfWidth: number, halfDepth: number, yaw: number): KeepOutRect =>
  ({ kind: "rect", id, x, z, halfWidth, halfDepth, yaw });

/**
 * Which way a building on the island turns to put its door toward the Court:
 * `CourtScene.ts`'s own `rotation.y = Math.atan2(-SPOT[0], -SPOT[1])`. A
 * rectangle is unchanged by half a turn, so a footprint does not care which
 * way round the shell is — a **doorway** does, which is why the door keep-outs
 * below carry the placement's own yaw rather than this.
 */
const courtFacing = (x: number, z: number): number => Math.atan2(-x, -z);

/**
 * A placed interior's doorway in island coordinates — `placementDoor` /
 * `placementToWorld` (`scene/place.ts`) with the lift dropped, because a
 * keep-out is flat.
 */
const doorway = (id: string, x: number, z: number, yaw: number, door: readonly [number, number], r: number): KeepOutCircle => {
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  return { kind: "circle", id, x: x + door[0] * cos + door[1] * sin, z: z + door[1] * cos - door[0] * sin, r };
};

/**
 * The approach to a shell that has no placed interior: the ground a stride out
 * from the building on its Court-facing side, which is the side every door is
 * on. Derived from the spot alone, so it cannot disagree with the yaw.
 */
/**
 * Where a plant may not be planted.
 *
 * Two kinds of thing, both of them the island's own data rather than a second
 * opinion, and `test/harbour-island-dressing.test.ts` proves each entry
 * against its source so the day a building moves the clearing moves with it:
 *
 * - **the exterior shells** the Court stands (`court/CourtScene.ts`'s spots,
 *   flattened in `body/obstacles.ts` `ISLAND_BUILDINGS`). Every shell's box
 *   is covered here, which the test checks corner by corner.
 * - **the placed interiors** (`scene/place.ts` `PLACE_PLACEMENTS`), which are
 *   roughly four times their shell and reach out past the tree ring's inner
 *   radius. These are what a conifer was standing in.
 *
 * Plus a doorway for each, because a door you cannot walk up to is not a door.
 */
export const ISLAND_KEEP_OUTS: readonly KeepOut[] = Object.freeze(Object.values(VILLAGE_SITES).flatMap(site=>{
  const [x,z]=site.spot,yaw=courtFacing(x,z);
  return [rect(site.entry,x,z,site.half[0]+.25,site.half[1]+.25,yaw),doorway(`${site.entry}-door`,x,z,yaw,site.door,1.7)];
}));

/**
 * Which keep-out a plant of `clearance` radius standing at (`x`,`z`) is in, or
 * null when the ground is free. The clearance is the plant's own spread, not
 * its trunk: a canopy that pokes through a wall is the defect, so the leaves
 * are what has to clear the building.
 */
export function keepOutHit(x: number, z: number, clearance: number, keepOuts: readonly KeepOut[] = ISLAND_KEEP_OUTS): string | null {
  for (const keepOut of keepOuts) {
    if (keepOut.kind === "circle") {
      if (Math.hypot(x - keepOut.x, z - keepOut.z) <= keepOut.r + clearance) return keepOut.id;
      continue;
    }
    const cos = Math.cos(keepOut.yaw), sin = Math.sin(keepOut.yaw);
    const dx = x - keepOut.x, dz = z - keepOut.z;
    const lx = dx * cos - dz * sin, lz = dz * cos + dx * sin;
    if (Math.abs(lx) <= keepOut.halfWidth + clearance && Math.abs(lz) <= keepOut.halfDepth + clearance) return keepOut.id;
  }
  return null;
}

/* ── The planting ─────────────────────────────────────────────────────────── */

/** A plant's spot and shape, in island coordinates. `spin` is its turn about y. */
export type Plant = { x: number; z: number; r: number; angle: number; size: number; spin: number };
export type PlantPlan = { trees: Plant[]; shrubs: Plant[] };

/** How many of each the island sows. The tier buys trees, never clearings. */
export const TREE_COUNT = Object.freeze({ full: 18, lite: 14 });
export const SHRUB_COUNT = 16;

/**
 * How many places one plant may try before the island gives up on it.
 *
 * The four draws happen **once** per plant, in the order and at the moment
 * `ground.ts` has always made them, so the sequence is untouched and every
 * plant that was never standing in a building keeps its exact old spot. What a
 * retry changes is only the plant's place *along the ring*: it steps sideways
 * by `SLOT_STEP`, alternating either way and widening, until it finds open
 * ground. A rejected plant therefore slides out of the clearing rather than
 * being re-rolled somewhere else, which is why the ring still reads as a ring.
 */
export const PLANT_ATTEMPTS = 32;
const SLOT_STEP = 0.16;

/** 0, +0.16, −0.16, +0.32, −0.32, … — deterministic, and 0 on the first try. */
const slotNudge = (attempt: number): number =>
  attempt === 0 ? 0 : (attempt % 2 === 1 ? 1 : -1) * SLOT_STEP * Math.ceil(attempt / 2);

/**
 * The sector the ring is sown in: the gate side (+z) stays open so the trees
 * frame the Court rather than hide it. A slot's jitter is ±`TREE_JITTER`, so
 * that much either side of the sector is ground the ring already reaches and a
 * step sideways may use; beyond it lies the gate's own gap, which stays empty.
 */
const SECTOR_FROM = Math.PI * 0.62, SECTOR_SPAN = Math.PI * 1.76, TREE_JITTER = 0.07;

/** A canopy is a `ConeGeometry(1, …)` scaled by `size`, so its spread *is* `size`. */
export const treeClearance = (size: number): number => size;
/** A shrub is an `IcosahedronGeometry(0.55)` scaled by `size`. */
export const shrubClearance = (size: number): number => 0.55 * size;
/** The trunk a body bumps into (`body/obstacles.ts`). */
export const trunkRadius = (size: number): number => 0.16 * (0.8 + size);

/**
 * Sow the island. Deterministic: one LCG seeded `0x7a11`, four draws per
 * attempt, in the order `ground.ts` has always drawn them — the angle's
 * jitter, the radius, the size, the spin — trees first, then shrubs.
 *
 * A plant whose draw lands in a keep-out is **re-drawn**, not dropped, so the
 * ring keeps its density and still reads as a ring with clearings in it. The
 * returned arrays are the plan: `ground.ts` draws exactly these and nothing
 * else, and `body/obstacles.ts` collides with exactly these trunks.
 */
export function plantPlan(tier: "full" | "lite", keepOuts: readonly KeepOut[] = ISLAND_KEEP_OUTS): PlantPlan {
  const trees: Plant[] = [], shrubs: Plant[] = [];
  const treeSlots = TREE_COUNT[tier];
  let seed = 0x7a11;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  /**
   * Two plants pushed out of the same clearing must not end up in each other.
   * Today's ring never comes closer than 2.9 units, so this rejects nothing
   * the island already draws; it only stops a displaced plant from landing in
   * the lap of the one it slid toward.
   */
  const crowded = (placed: readonly Plant[], x: number, z: number, clearance: number, spread: (size: number) => number): boolean =>
    placed.some((plant) => Math.hypot(plant.x - x, plant.z - z) < clearance + spread(plant.size));

  for (let i = 0; i < treeSlots; i += 1) {
    const base = SECTOR_FROM + (i / treeSlots) * SECTOR_SPAN + (rand() - 0.5) * 0.14;
    const r = 13 + rand() * 2.4, size = 0.5 + rand() * 0.38, spin = rand() * Math.PI;
    for (let attempt = 0; attempt < PLANT_ATTEMPTS; attempt += 1) {
      const angle = base + slotNudge(attempt);
      // A step sideways never opens the gate's gap.
      if (angle < SECTOR_FROM - TREE_JITTER || angle > SECTOR_FROM + SECTOR_SPAN + TREE_JITTER) continue;
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      if (keepOutHit(x, z, treeClearance(size), keepOuts)) continue;
      if (crowded(trees, x, z, treeClearance(size), treeClearance)) continue;
      trees.push({ x, z, r, angle, size, spin });
      break;
    }
  }

  for (let i = 0; i < SHRUB_COUNT; i += 1) {
    const base = (i / SHRUB_COUNT) * Math.PI * 2 + rand() * 0.3;
    const r = 10.6 + rand() * 1.8, size = 0.6 + rand() * 0.7, spin = rand() * Math.PI;
    for (let attempt = 0; attempt < PLANT_ATTEMPTS; attempt += 1) {
      const angle = base + slotNudge(attempt);
      const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
      if (keepOutHit(x, z, shrubClearance(size), keepOuts)) continue;
      if (crowded(shrubs, x, z, shrubClearance(size), shrubClearance)) continue;
      shrubs.push({ x, z, r, angle, size, spin });
      break;
    }
  }

  return { trees, shrubs };
}
