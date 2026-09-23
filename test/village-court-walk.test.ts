// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { COURT_ARRIVAL, createWalker } from "../src/harbour/body/walker.ts";
import { courtObstacles } from "../src/harbour/body/obstacles.ts";
import { groundHeightAt } from "../src/harbour/scene/ground.ts";
import { VILLAGE_SITES } from "../src/harbour/village/layout.ts";
import { crossedVillageDoor } from "../src/harbour/village/topology.ts";

function toWorld(site: typeof VILLAGE_SITES[keyof typeof VILLAGE_SITES], x: number, z: number): [number, number] {
  const yaw = Math.atan2(-site.spot[0], -site.spot[1]);
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  return [site.spot[0] + x * cos + z * sin, site.spot[1] + z * cos - x * sin];
}

describe("court tap routes reach every authored village door", () => {
  for (const [building, site] of Object.entries(VILLAGE_SITES)) {
    it(`${building}: routes from Court through its physical doorway`, () => {
      const walker = createWalker({ groundHeightAt, obstacles: courtObstacles("lite"), tier: "lite", trail: false, reduced: true, start: COURT_ARRIVAL });
      const goal = toWorld(site, site.door[0], site.half[1] - 0.55);
      walker.goTo(...goal);
      let previous = walker.state(), entered: string | null = null;
      for (let frame = 0; frame < 1800; frame += 1) {
        walker.step(1 / 60, frame / 60, 0);
        const next = walker.state();
        entered ??= crossedVillageDoor([previous.x, previous.z], [next.x, next.z], "court");
        previous = next;
      }
      expect(entered).toBe(site.entry);
      expect(Math.hypot(previous.x - goal[0], previous.z - goal[1])).toBeLessThan(0.75);
      walker.dispose();
    });
  }
});
