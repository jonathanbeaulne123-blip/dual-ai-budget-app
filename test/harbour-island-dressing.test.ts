// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  ISLAND_KEEP_OUTS, PLANT_ATTEMPTS, SHRUB_COUNT, TREE_COUNT,
  keepOutHit, plantPlan, shrubClearance, treeClearance, trunkRadius,
  type KeepOut, type Plant,
} from "../src/harbour/scene/planting.ts";
import { ISLAND_BUILDINGS, treeRingObstacles } from "../src/harbour/body/obstacles.ts";
import { createGround } from "../src/harbour/scene/ground.ts";
import {
  PLACE_PLACEMENTS, PLACED_PLACE_IDS, SCENE_DRESSING, atThreshold, insidePlacement, placementDoor,
} from "../src/harbour/scene/place.ts";

/**
 * Little Harbour · the island's dressing.
 *
 * Two visible defects lived here. Trees grew **through** the buildings: the
 * ring is sown at radius 13–15.4 and the placed interiors reach out past it,
 * so conifers stood inside the Kiln and the Library. And the planting was
 * written twice — once in `scene/ground.ts` to draw it, once in
 * `body/obstacles.ts` to collide with it — which is a pair of loops that can
 * drift. Both now read one plan (`scene/planting.ts`), and the plan keeps the
 * buildings' footprints and doorways clear.
 */

const TIERS = ["full", "lite"] as const;

/** Is (x,z) inside a keep-out rect, ignoring any clearance? `slack` is float noise, not margin. */
function insideRect(keepOut: Extract<KeepOut, { kind: "rect" }>, x: number, z: number, slack = 1e-9): boolean {
  const cos = Math.cos(keepOut.yaw), sin = Math.sin(keepOut.yaw);
  const dx = x - keepOut.x, dz = z - keepOut.z;
  return Math.abs(dx * cos - dz * sin) <= keepOut.halfWidth + slack && Math.abs(dz * cos + dx * sin) <= keepOut.halfDepth + slack;
}

const rects = ISLAND_KEEP_OUTS.filter((k): k is Extract<KeepOut, { kind: "rect" }> => k.kind === "rect");
const circles = ISLAND_KEEP_OUTS.filter((k): k is Extract<KeepOut, { kind: "circle" }> => k.kind === "circle");

/* ── 1. The keep-outs are the island's own footprints, not a second opinion ── */

describe("the planting's keep-outs", () => {
  it("covers every exterior shell the Court stands, corner to corner", () => {
    // `ISLAND_BUILDINGS` is `CourtScene.ts`'s own region box for each shell.
    // Every square inch of every one of them has to be a clearing, whether the
    // keep-out that covers it is the shell's or the interior placed in it.
    for (const building of ISLAND_BUILDINGS) {
      if (building.kind !== "box") throw new Error("unreachable");
      const uncovered: [number, number][] = [];
      for (let i = 0; i <= 12; i += 1) {
        for (let j = 0; j <= 12; j += 1) {
          const x = building.minX + (i / 12) * (building.maxX - building.minX);
          const z = building.minZ + (j / 12) * (building.maxZ - building.minZ);
          if (!rects.some((rect) => insideRect(rect, x, z))) uncovered.push([x, z]);
        }
      }
      expect(uncovered, `${building.id} is a clearing`).toEqual([]);
    }
  });

  it("takes every placed interior's footprint and doorway from its own placement", () => {
    for (const id of PLACED_PLACE_IDS) {
      const placement = PLACE_PLACEMENTS[id]!;
      const rect = rects.find((r) => r.id === id);
      expect(rect, `${id} has a footprint keep-out`).toBeDefined();
      expect([rect!.x, rect!.z]).toEqual([...placement.spot]);
      expect(rect!.halfWidth).toBe(placement.halfWidth);
      expect(rect!.halfDepth).toBe(placement.halfDepth);
      // A rectangle is unchanged by half a turn, so the keep-out's yaw has only
      // to agree with the placement's modulo π — and it must, or a rotated
      // room would be kept clear of the wrong ground.
      const twist = Math.abs(((rect!.yaw - placement.yaw) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2);
      expect(twist, `${id}'s keep-out lies along its placement`).toBeLessThan(1e-9);
      // The doorway is the room's own threshold, read back through `placementDoor`.
      const door = placementDoor(placement);
      const circle = circles.find((c) => c.id === `${id}-door`);
      expect(circle, `${id} has a doorway keep-out`).toBeDefined();
      expect(Math.hypot(circle!.x - door[0], circle!.z - door[2]), `${id}'s doorway is where its door is`).toBeLessThan(1e-9);
      expect(circle!.r).toBeGreaterThanOrEqual(placement.doorRadius);
    }
  });

  it("puts a doorstep on the Court-facing side of the shells with no interior yet", () => {
    for (const id of ["glasshouse-shed", "kitchen-cottage", "boathouse"] as const) {
      const shell = rects.find((r) => r.id === id)!;
      const step = circles.find((c) => c.id === `${id}-door`)!;
      // Nearer the Court than the building, and on the line between the two.
      expect(Math.hypot(step.x, step.z)).toBeLessThan(Math.hypot(shell.x, shell.z));
      const cross = shell.x * step.z - shell.z * step.x;
      expect(Math.abs(cross), `${id}'s doorstep is on the line to the Court`).toBeLessThan(1e-9);
    }
  });
});

/* ── 2. Nothing is planted in a building or in its doorway ─────────────────── */

describe("the tree ring keeps out of the buildings", () => {
  for (const tier of TIERS) {
    it(`plants nothing inside a footprint or a doorway (${tier})`, () => {
      const plan = plantPlan(tier);
      const offenders: string[] = [];
      for (const [kind, plants, clearance] of [
        ["tree", plan.trees, treeClearance], ["shrub", plan.shrubs, shrubClearance],
      ] as const) {
        plants.forEach((plant, i) => {
          const hit = keepOutHit(plant.x, plant.z, clearance(plant.size));
          if (hit) offenders.push(`${kind}-${i} in ${hit}`);
          // Not only the keep-out table: the placements' own predicates.
          for (const id of PLACED_PLACE_IDS) {
            const placement = PLACE_PLACEMENTS[id]!;
            if (insidePlacement(placement, plant.x, plant.z)) offenders.push(`${kind}-${i} inside ${id}`);
            if (atThreshold(placement, plant.x, plant.z)) offenders.push(`${kind}-${i} in ${id}'s doorway`);
          }
          // And not inside an exterior shell's box either.
          for (const building of ISLAND_BUILDINGS) {
            if (building.kind !== "box") continue;
            if (plant.x >= building.minX && plant.x <= building.maxX && plant.z >= building.minZ && plant.z <= building.maxZ) {
              offenders.push(`${kind}-${i} inside ${building.id}`);
            }
          }
        });
      }
      expect(offenders).toEqual([]);
    });
  }

  it("is the fix for a ring that used to grow through the Kiln and the Library", () => {
    // The loop as it stood before the clearings existed, character for
    // character. It is here so the defect stays described rather than
    // remembered: these are plants that stood inside a building.
    const before = (tier: "full" | "lite"): Plant[] => {
      const TREES = tier === "full" ? 18 : 14;
      let seed = 0x7a11;
      const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const trees: Plant[] = [];
      for (let i = 0; i < TREES; i += 1) {
        const angle = Math.PI * 0.62 + (i / TREES) * Math.PI * 1.76 + (rand() - 0.5) * 0.14;
        const r = 13 + rand() * 2.4, size = 0.5 + rand() * 0.38, spin = rand() * Math.PI;
        trees.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r, r, angle, size, spin });
      }
      return trees;
    };
    const blocked = before("full").map((t) => keepOutHit(t.x, t.z, treeClearance(t.size))).filter(Boolean);
    expect(blocked).toContain("kiln");
    expect(blocked).toContain("library");
    expect(blocked.length).toBeGreaterThanOrEqual(4);
    // And the same draws, run through the plan, keep none of them.
    expect(plantPlan("full").trees.filter((t) => keepOutHit(t.x, t.z, treeClearance(t.size)))).toEqual([]);
  });
});

/* ── 3. The island is not left bare, and still reads as a ring ─────────────── */

describe("the ring's density", () => {
  for (const tier of TIERS) {
    it(`keeps every plant the island used to have (${tier})`, () => {
      const plan = plantPlan(tier);
      // The counts before the clearings: 18 trees at full, 14 at lite, 16
      // shrubs either way. A plant in a building is re-placed, never dropped,
      // so the band is not a band — it is the same number.
      expect(plan.trees).toHaveLength(TREE_COUNT[tier]);
      expect(plan.shrubs).toHaveLength(SHRUB_COUNT);
      expect(TREE_COUNT[tier]).toBe(tier === "full" ? 18 : 14);
      expect(SHRUB_COUNT).toBe(16);
      // Even if a future keep-out did strand a plant, the island may not go bare.
      expect(plan.trees.length).toBeGreaterThanOrEqual(Math.ceil(TREE_COUNT[tier] * 0.85));
    });

    it(`still reads as a ring: the same radii, the same open gate side (${tier})`, () => {
      const plan = plantPlan(tier);
      for (const tree of plan.trees) {
        expect(tree.r).toBeGreaterThanOrEqual(13);
        expect(tree.r).toBeLessThanOrEqual(15.4);
        // The gate's gap (+z, ahead of the camera) stays empty: the sector is
        // [0.62π, 2.38π] and a plant may only step a jitter's width past it.
        expect(tree.angle).toBeGreaterThanOrEqual(Math.PI * 0.62 - 0.07);
        expect(tree.angle).toBeLessThanOrEqual(Math.PI * 2.38 + 0.07);
      }
      for (const shrub of plan.shrubs) {
        expect(shrub.r).toBeGreaterThanOrEqual(10.6);
        expect(shrub.r).toBeLessThanOrEqual(12.4);
      }
      // No two canopies grow through each other, however far a plant slid.
      const apart = (plants: Plant[], spread: (size: number) => number) => {
        for (let i = 0; i < plants.length; i += 1) {
          for (let j = i + 1; j < plants.length; j += 1) {
            const a = plants[i]!, b = plants[j]!;
            expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(spread(a.size) + spread(b.size) - 1e-9);
          }
        }
      };
      apart(plan.trees, treeClearance);
      apart(plan.shrubs, shrubClearance);
    });
  }

  it("is deterministic: the same island every time, and a bounded search", () => {
    for (const tier of TIERS) expect(plantPlan(tier)).toEqual(plantPlan(tier));
    expect(PLANT_ATTEMPTS).toBeGreaterThan(1);
    expect(Number.isFinite(PLANT_ATTEMPTS)).toBe(true);
  });
});

/* ── 4. One plan: what is drawn is what you bump into ──────────────────────── */

describe("the collision table and the drawn instances", () => {
  it("are the same plan — position, count and trunk width", () => {
    const scene = new THREE.Scene();
    for (const tier of TIERS) {
      const ground = createGround(scene, SCENE_DRESSING.classic, tier);
      const canopies = ground.group.getObjectByName("trees") as THREE.InstancedMesh;
      const trunks = ground.group.getObjectByName("trunks") as THREE.InstancedMesh;
      const shrubs = ground.group.getObjectByName("shrubs") as THREE.InstancedMesh;
      const plan = plantPlan(tier);
      const table = treeRingObstacles(tier);

      expect(canopies.count).toBe(plan.trees.length);
      expect(trunks.count).toBe(plan.trees.length);
      expect(shrubs.count).toBe(plan.shrubs.length);
      expect(table).toHaveLength(canopies.count);

      const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), quaternion = new THREE.Quaternion();
      for (let i = 0; i < canopies.count; i += 1) {
        canopies.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);
        const circle = table[i]!;
        if (circle.kind !== "circle") throw new Error("unreachable");
        // The drawn canopy, the collision circle and the plan all agree.
        // An instance matrix is Float32, so five decimals is exact agreement here.
        expect(circle.x).toBeCloseTo(position.x, 5);
        expect(circle.z).toBeCloseTo(position.z, 5);
        expect(position.x).toBeCloseTo(plan.trees[i]!.x, 5);
        expect(position.z).toBeCloseTo(plan.trees[i]!.z, 5);
        // The circle's radius is the drawn tree's own size, not a guess at it.
        expect(scale.x).toBeCloseTo(plan.trees[i]!.size, 5);
        expect(circle.r).toBeCloseTo(trunkRadius(scale.x), 5);
      }
      for (let i = 0; i < shrubs.count; i += 1) {
        shrubs.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        expect(position.x).toBeCloseTo(plan.shrubs[i]!.x, 5);
        expect(position.z).toBeCloseTo(plan.shrubs[i]!.z, 5);
      }
      ground.dispose();
    }
  });

  it("reads the plan in both places rather than keeping two copies of the loop", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
    const ground = read("src/harbour/scene/ground.ts"), obstacles = read("src/harbour/body/obstacles.ts");
    for (const [name, source] of [["ground.ts", ground], ["obstacles.ts", obstacles]] as const) {
      expect(source, `${name} reads the plan`).toMatch(/plantPlan\(/);
      // The LCG the ring is sown with lives in `planting.ts` and nowhere else.
      // (`ground.ts` keeps one for the instance **tints**, which is a separate
      // sequence and never moves a plant — hence the seed alone is not enough.)
      expect(source, `${name} does not re-sow the ring`).not.toMatch(/Math\.PI \* 0\.62/);
      expect(source, `${name} does not re-sow the ring`).not.toMatch(/13 \+ rand\(\) \* 2\.4/);
    }
    expect(read("src/harbour/scene/planting.ts")).toMatch(/seed = 0x7a11/);
  });
});
