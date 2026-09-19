import { describe, expect, it } from "vitest";
import { HOUSE_WALK_GRAPH, findPath, interpolateTravel, nearestNode } from "../src/house/world/walkPaths.ts";

describe("house walking paths", () => {
  it("keeps four room doors and three authored stairwells in one bounded graph", () => {
    expect(HOUSE_WALK_GRAPH.nodes.filter(node => node.kind === "door").map(node => node.id)).toEqual(["door:home", "door:study", "door:kitchen-table", "door:together"]);
    expect(new Set(HOUSE_WALK_GRAPH.nodes.filter(node => node.kind === "stair").map(node => node.room))).toEqual(new Set(["home", "study", "together"]));
    const path = findPath("room:home:middle", "island:lookout");
    expect(path?.[0]?.id).toBe("room:home:middle");
    expect(path?.at(-1)?.id).toBe("island:lookout");
    expect(path?.some(node => node.id === "stairs:study:above")).toBe(true);
    expect(path?.some(node => node.id === "island:trailhead")).toBe(true);
  });

  it("uses an authored pottery threshold and never interpolates a wall shortcut", () => {
    const path = findPath("room:together:middle", "pottery:threshold");
    expect(path?.map(node => node.id)).toEqual(["room:together:middle", "pottery:threshold"]);
    const travel = interpolateTravel(path!, 0.3);
    expect(travel.at(-1)?.nodeId).toBe("pottery:threshold");
    for (let index = 1; index < travel.length; index += 1) {
      const a = travel[index - 1]!.point, b = travel[index]!.point;
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThanOrEqual(0.300001);
    }
    expect(() => interpolateTravel([HOUSE_WALK_GRAPH.nodes[0]!, HOUSE_WALK_GRAPH.nodes.at(-1)!])).toThrow("WALK_EDGE_REQUIRED");
  });

  it("resolves a tap to the nearest reachable authored node", () => {
    const home = HOUSE_WALK_GRAPH.nodes.find(node => node.id === "room:home:middle")!;
    expect(nearestNode({ x: 10.75, y: 3.05, z: -1.15 }, home.id)?.id).toBe("pottery:threshold");
    expect(nearestNode({ x: 0, y: 0, z: 0 }, "missing-node")).toBeNull();
  });
});
