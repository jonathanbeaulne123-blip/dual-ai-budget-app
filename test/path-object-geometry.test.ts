import { describe, expect, it } from "vitest";
import type { GrownIsland } from "../src/path/grow.ts";
import { charterSpot, cottageSpot } from "../src/path/together.ts";
import {
  PATH_ERA_GATE_RADIUS,
  PATH_GOAL_RING,
  PATH_OBJECT_GEOMETRY_VERSION,
  pathObjectGeometryHash,
  pathObjectNearAnchor,
  pathObjectOnAuthoredRing,
  pathPointOnAuthoredRing,
  type PathObjectAnchor,
} from "../src/path/world/pathGeometry.ts";

const MONTH: PathObjectAnchor = { x: 11.25, z: -4.5, a: 0.72 };
const MEMORY_PLACEMENT = { turn: -1.2, angleSpread: 0.4, distance: 3.6, distanceSpread: 2.8 } as const;

function memorySpots(ids: string[], anchor = MONTH) {
  return new Map(ids.map((id) => [id, pathObjectNearAnchor("memory", id, anchor, MEMORY_PLACEMENT)]));
}

describe("stable path object geography", () => {
  it("pins the geometry algorithm to an explicit version", () => {
    expect(PATH_OBJECT_GEOMETRY_VERSION).toBe("v1");
    expect(pathObjectGeometryHash("memory", "memory:alpha", 0)).toBe(664044948);
    expect(pathObjectGeometryHash("memory", "memory:alpha", 4)).toBe(1796213423);
  });

  it("does not move surviving objects when siblings reorder, append, or disappear", () => {
    const original = memorySpots(["memory:removed", "memory:kept", "memory:other"]);
    const reordered = memorySpots(["memory:other", "memory:kept", "memory:removed"]);
    const corrected = memorySpots(["memory:new", "memory:kept"]);
    const appended = memorySpots(["memory:removed", "memory:kept", "memory:other", "memory:later"]);

    expect(reordered.get("memory:kept")).toEqual(original.get("memory:kept"));
    expect(corrected.get("memory:kept")).toEqual(original.get("memory:kept"));
    expect(appended.get("memory:kept")).toEqual(original.get("memory:kept"));
  });

  it("keeps identity variation relative to the object's semantic month anchor", () => {
    const firstMonth = memorySpots(["memory:kept"]).get("memory:kept")!;
    const nextMonth = memorySpots(["memory:kept"], { x: -7, z: 18, a: 2.1 }).get("memory:kept")!;

    expect(nextMonth.geometry).toEqual(firstMonth.geometry);
    expect({ x: nextMonth.x, z: nextMonth.z, a: nextMonth.a }).not.toEqual({ x: firstMonth.x, z: firstMonth.z, a: firstMonth.a });
  });

  it("keeps durable goal and gate coordinates independent of corrected terrain", () => {
    const beforeRadiusAt = (a: number) => 29 + Math.sin(a) * 2;
    const correctedRadiusAt = (a: number) => 71 + Math.cos(a * 3) * 9;
    const goal = pathObjectOnAuthoredRing("goal", "goal:kept", PATH_GOAL_RING);
    const gate = pathPointOnAuthoredRing(1.12, PATH_ERA_GATE_RADIUS);

    expect(beforeRadiusAt(goal.a)).not.toBe(correctedRadiusAt(goal.a));
    expect(beforeRadiusAt(gate.a)).not.toBe(correctedRadiusAt(gate.a));
    expect(pathObjectOnAuthoredRing("goal", "goal:kept", PATH_GOAL_RING)).toEqual(goal);
    expect(pathPointOnAuthoredRing(1.12, PATH_ERA_GATE_RADIUS)).toEqual(gate);
  });

  it("keeps Charter and cottage positions independent of unrelated blockers", () => {
    const island = { spot: () => MONTH } as unknown as GrownIsland;
    const unrelated = [{ x: 50, z: 50, r: 8 }, { x: -20, z: 3, r: 5 }];

    expect(charterSpot(island, unrelated)).toEqual(charterSpot(island));
    expect(cottageSpot(island, unrelated, true)).toEqual(cottageSpot(island));
  });
});
