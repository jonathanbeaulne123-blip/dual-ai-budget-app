import { describe, expect, it } from "vitest";
import {
  PLACED_PLACE_IDS, PLACE_HOLDS, PLACE_PLACEMENTS, atThreshold, insidePlacement,
  placedFootprintHold, placementDoor, placementLift, placementOf, placementToWorld,
  streamInRadius, streamOutRadius, streamPlaces,
} from "../src/harbour/scene/place.ts";
import { groundHeightAt } from "../src/harbour/scene/ground.ts";
import { HARBOUR_PLACE_NAMES, type HarbourPlaceId } from "../src/harbour/flag.ts";
import { VILLAGE_SITES } from "../src/harbour/village/layout.ts";
import { crossedVillageDoor, villageExteriorCutaway } from "../src/harbour/village/topology.ts";

const places = Object.keys(HARBOUR_PLACE_NAMES) as HarbourPlaceId[];

describe("village world space", () => {
  it("places every village room on its authored exterior site", () => {
    expect(PLACED_PLACE_IDS).toHaveLength(10);
    for (const id of PLACED_PLACE_IDS) {
      const placement = PLACE_PLACEMENTS[id]!;
      const site = VILLAGE_SITES[placement.building];
      expect(placement.spot).toEqual(site.spot);
      expect(placement.exterior).toBe(site.exterior);
      expect(placementLift(placement)).toBeGreaterThan(-3);
      expect(insidePlacement(placement, placement.spot[0], placement.spot[1])).toBe(true);
    }
  });

  it("turns doors and local points into the same physical village coordinates", () => {
    for (const id of PLACED_PLACE_IDS.filter(id => !PLACE_PLACEMENTS[id]!.internal)) {
      const placement = PLACE_PLACEMENTS[id]!;
      const door = placementDoor(placement);
      expect(atThreshold(placement, door[0], door[2])).toBe(true);
      const world = placementToWorld(placement, [0, 0, 0]);
      expect(world[0]).toBeCloseTo(placement.spot[0], 9);
      expect(world[2]).toBeCloseTo(placement.spot[1], 9);
    }
  });

  it("streams nearby buildings with hysteresis and retains the active room", () => {
    for (const id of PLACED_PLACE_IDS) {
      const placement = PLACE_PLACEMENTS[id]!;
      const near = streamPlaces(placement.spot, [], [id]);
      expect(near.some(step => step.id === id && step.action === "raise"), id).toBe(true);
      expect(streamOutRadius(placement)).toBeGreaterThan(streamInRadius(placement));
    }
  });

  it("uses a world-space footprint hold for every placed indoor room", () => {
    for (const id of PLACED_PLACE_IDS) {
      const hold = placedFootprintHold(PLACE_HOLDS[id] ?? null, placementOf(id));
      if (!hold) continue;
      const placement = placementOf(id)!;
      expect(hold.eye.min[0]).toBeLessThan(placement.spot[0]);
      expect(hold.eye.max[0]).toBeGreaterThan(placement.spot[0]);
      expect(hold.eye.min[2]).toBeLessThan(placement.spot[1]);
      expect(hold.eye.max[2]).toBeGreaterThan(placement.spot[1]);
    }
  });

  it("cuts away only the active building and crosses physical doors once", () => {
    for (const [building, site] of Object.entries(VILLAGE_SITES)) {
      const id = site.entry as HarbourPlaceId;
      expect(villageExteriorCutaway(id, site.exterior)).toBe(true);
      const yaw = Math.atan2(-site.spot[0], -site.spot[1]);
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const point = (z: number): [number, number] => [site.spot[0] + site.door[0] * cos + z * sin, site.spot[1] + z * cos - site.door[0] * sin];
      expect(crossedVillageDoor(point(site.half[1] + .2), point(site.half[1] - .2), "court"), building).toBe(id);
      expect(crossedVillageDoor(point(site.half[1] - .2), point(site.half[1] + .2), id)).toBe("court");
    }
    expect(places).toContain("bank");
  });

  it("raises and releases at hysteresis boundaries without oscillation", () => {
    const p = PLACE_PLACEMENTS.library!, inside = [p.spot[0] + streamInRadius(p) - .01, p.spot[1]] as const, outside = [p.spot[0] + streamOutRadius(p) + .01, p.spot[1]] as const;
    expect(streamPlaces(inside, [], []).some(step => step.id === "library" && step.action === "raise")).toBe(true);
    expect(streamPlaces(inside, ["library"], []).some(step => step.id === "library" && step.action === "release")).toBe(false);
    expect(streamPlaces(outside, ["library"], []).some(step => step.id === "library" && step.action === "release")).toBe(true);
    expect(streamPlaces(outside, ["library"], ["library"]).some(step => step.id === "library" && step.action === "release")).toBe(false);
  });

  it("lifts footprint corners clear of the terrain", () => {
    for (const id of PLACED_PLACE_IDS) { const p = PLACE_PLACEMENTS[id]!, lift = placementLift(p); for (const [x,z] of [[0,0],[-p.halfWidth,-p.halfDepth],[p.halfWidth,p.halfDepth]] as const) { const point=placementToWorld(p,[x,0,z],0); if ((p.floorY ?? 0) < 0) expect(lift).toBeLessThan(groundHeightAt(point[0],point[2])); else expect(lift-groundHeightAt(point[0],point[2]),id).toBeGreaterThanOrEqual(.06-1e-8); } }
  });});
