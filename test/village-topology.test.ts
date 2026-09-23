import { describe, expect, it } from "vitest";
import type { HarbourPlaceId } from "../src/harbour/flag.ts";
import { ROOM_PORTALS, VILLAGE_SITES } from "../src/harbour/village/layout.ts";
import { crossedVillageDoor, villageExteriorCutaway, villagePortalArrival } from "../src/harbour/village/topology.ts";

type Point = [number, number];
const yaw = (spot: readonly [number, number]) => Math.atan2(-spot[0], -spot[1]);
const world = (site: typeof VILLAGE_SITES[keyof typeof VILLAGE_SITES], x: number, z: number): Point => {
  const angle = yaw(site.spot), cos = Math.cos(angle), sin = Math.sin(angle);
  return [site.spot[0] + x * cos + z * sin, site.spot[1] + z * cos - x * sin];
};

describe("village topology", () => {
  it("recognises every exterior doorway once in each directed direction", () => {
    for (const site of Object.values(VILLAGE_SITES)) {
      const entry = site.entry as HarbourPlaceId;
      const outside = world(site, site.door[0], site.door[1] + 0.45);
      const inside = world(site, site.door[0], site.door[1] - 0.45);
      expect(crossedVillageDoor(outside, inside, "court"), site.name).toBe(entry);
      expect(crossedVillageDoor(inside, outside, entry), site.name).toBe("court");
    }
  });

  it("rejects side, back, stationary, and already-inside door samples", () => {
    const site = VILLAGE_SITES.library;
    const outside = world(site, site.door[0], site.door[1] + 0.45);
    const inside = world(site, site.door[0], site.door[1] - 0.45);
    expect(crossedVillageDoor(world(site, site.door[0] + 0.8, site.door[1] + 0.45), world(site, site.door[0] + 0.8, site.door[1] - 0.45), "court")).toBeNull();
    expect(crossedVillageDoor(world(site, 0, -site.half[1] - 0.5), world(site, 0, -site.half[1] + 0.2), "court")).toBeNull();
    expect(crossedVillageDoor(outside, outside, "court")).toBeNull();
    expect(crossedVillageDoor(inside, world(site, 0, 0), "court")).toBeNull();
  });

  it("never lets an internal home floor exit to the outdoors", () => {
    const site = VILLAGE_SITES.home;
    const outside = world(site, site.door[0], site.door[1] + 0.45);
    const inside = world(site, site.door[0], site.door[1] - 0.45);
    for (const floor of ["tower", "cellar", "atlas"] as HarbourPlaceId[]) expect(crossedVillageDoor(inside, outside, floor)).toBeNull();
  });

  it("lands reciprocal home portals a clear stride toward the room centre", () => {
    for (const [from, portals] of Object.entries(ROOM_PORTALS) as [HarbourPlaceId, NonNullable<typeof ROOM_PORTALS[HarbourPlaceId]>][]) {
      for (const portal of portals) {
        const arrival = villagePortalArrival(from, portal.to);
        expect(arrival, `${from} -> ${portal.to}`).not.toBeNull();
        const reciprocal = ROOM_PORTALS[portal.to]!.find(candidate => candidate.to === from)!;
        const distance = Math.hypot(arrival!.local[0] - reciprocal.at[0], arrival!.local[2] - reciprocal.at[2]);
        expect(distance).toBeGreaterThan(0.8);
        expect(Math.abs(arrival!.local[0])).toBeLessThan(4.5);
        expect(Math.abs(arrival!.local[2])).toBeLessThan(3.5);
      }
    }
  });

  it("fails closed for non-portal pairs and cuts away only the active building", () => {
    expect(villagePortalArrival("kitchen", "atlas")).toBeNull();
    expect(villageExteriorCutaway("kitchen", "village-home")).toBe(true);
    expect(villageExteriorCutaway("tower", "village-home")).toBe(true);
    expect(villageExteriorCutaway("tower", "village-bank")).toBe(false);
    expect(villageExteriorCutaway("court", "village-home")).toBe(false);
  });
});
