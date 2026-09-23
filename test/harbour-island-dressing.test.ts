import {HARBOUR_LANES,distanceToTrail} from "../src/harbour/village/world.ts";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  ISLAND_KEEP_OUTS, PLANT_ATTEMPTS, SHRUB_COUNT, TREE_COUNT,
  keepOutHit, plantPlan, shrubClearance, treeClearance, trunkRadius,
  type KeepOut, type Plant,
} from "../src/harbour/scene/planting.ts";
import { ISLAND_BUILDINGS, treeRingObstacles } from "../src/harbour/body/obstacles.ts";
import { VILLAGE_SITES } from "../src/harbour/village/layout.ts";
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
  it("keeps every authored village footprint clear", () => {
    for (const site of Object.values(VILLAGE_SITES)) {
      const yaw = Math.atan2(-site.spot[0], -site.spot[1]);
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      for (const [lx, lz] of [[0, 0], [-site.half[0], -site.half[1]], [site.half[0], site.half[1]]] as const) {
        const x = site.spot[0] + lx * cos + lz * sin, z = site.spot[1] + lz * cos - lx * sin;
        expect(rects.some(rect => insideRect(rect, x, z)), site.exterior).toBe(true);
      }
    }
    expect(ISLAND_BUILDINGS.filter(o => o.kind === "obox")).toHaveLength(Object.keys(VILLAGE_SITES).length * 5);
  });

  it("takes every placed interior's footprint and doorway from its own placement", () => {
    for (const id of PLACED_PLACE_IDS.filter(id => !PLACE_PLACEMENTS[id]!.internal)) {
      const placement = PLACE_PLACEMENTS[id]!;
      const rect = rects.find((r) => r.id === id);
      expect(rect, `${id} has a footprint keep-out`).toBeDefined();
      expect([rect!.x, rect!.z]).toEqual([...placement.spot]);
      expect(rect!.halfWidth).toBeGreaterThanOrEqual(placement.halfWidth);
      expect(rect!.halfDepth).toBeGreaterThanOrEqual(placement.halfDepth);
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

  it("keeps every placed doorway clear of planting", () => {
    for (const id of PLACED_PLACE_IDS.filter(id => !PLACE_PLACEMENTS[id]!.internal)) {
      const placement = PLACE_PLACEMENTS[id]!;
      const door = placementDoor(placement);
      expect(circles.some(circle => circle.id === `${id}-door` && Math.hypot(circle.x - door[0], circle.z - door[2]) < 1e-8), id).toBe(true);
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
          for (const id of PLACED_PLACE_IDS.filter(id => !PLACE_PLACEMENTS[id]!.internal)) {
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

});

describe("open-world grove density",()=>{
  for(const tier of TIERS){
    it(`fills the countryside while keeping paths clear (${tier})`,()=>{
      const plan=plantPlan(tier);
      expect(plan.trees).toHaveLength(TREE_COUNT[tier]);
      expect(plan.shrubs).toHaveLength(SHRUB_COUNT);
      expect(plan.trees.filter(tree=>tree.r>40).length).toBeGreaterThan(20);
      for(const tree of plan.trees){
        expect(tree.r).toBeGreaterThanOrEqual(14);
        expect(tree.r).toBeLessThanOrEqual(62);
        for(const lane of HARBOUR_LANES)expect(distanceToTrail(tree.x,tree.z,lane.points)).toBeGreaterThanOrEqual(1.25+treeClearance(tree.size));
      }
      const apart=(plants:Plant[],spread:(size:number)=>number)=>{
        for(let i=0;i<plants.length;i++)for(let j=i+1;j<plants.length;j++){
          const a=plants[i]!,b=plants[j]!;
          expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThanOrEqual(spread(a.size)+spread(b.size)-1e-9);
        }
      };
      apart(plan.trees,treeClearance);apart(plan.shrubs,shrubClearance);
    });
  }
  it('is deterministic and bounded',()=>{
    for(const tier of TIERS)expect(plantPlan(tier)).toEqual(plantPlan(tier));
    expect(PLANT_ATTEMPTS).toBeGreaterThan(1);expect(PLANT_ATTEMPTS).toBeLessThanOrEqual(64);
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
