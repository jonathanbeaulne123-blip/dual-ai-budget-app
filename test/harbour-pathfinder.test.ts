// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { BODY_RADIUS, type Obstacle, type RoomBounds } from "../src/harbour/body/obstacles.ts";
import { PATH_MAX_NODES, findPath, pathSegmentClear, type PathPoint, type PathWorld } from "../src/harbour/body/pathfinder.ts";
import { createWalker } from "../src/harbour/body/walker.ts";

const flat = () => 0;
const box = (minX: number, minZ: number, maxX: number, maxZ: number): Obstacle => ({ kind: "box", id: "wall", minX, minZ, maxX, maxZ });
const routeIsClear = (from: PathPoint, route: PathPoint[], world: PathWorld) => {
  let previous = from;
  for (const point of route) { expect(pathSegmentClear(previous, point, world)).toBe(true); previous = point; }
};

describe("Harbour's bounded walking pathfinder", () => {
  it("keeps the clear direct route as one waypoint", () => {
    const world: PathWorld = { obstacles: [] };
    expect(findPath({ x: -2, z: 0 }, { x: 2, z: 0 }, world)).toEqual([{ x: 2, z: 0 }]);
  });

  it("takes a deterministic route around a box without crossing it", () => {
    const world: PathWorld = { obstacles: [box(-0.6, -1, 0.6, 1)] };
    const route = findPath({ x: -3, z: 0 }, { x: 3, z: 0 }, world);
    expect(route).not.toBeNull();
    expect(route!.length).toBeGreaterThan(1);
    expect(route!.length).toBeLessThanOrEqual(PATH_MAX_NODES);
    routeIsClear({ x: -3, z: 0 }, route!, world);
    expect(findPath({ x: -3, z: 0 }, { x: 3, z: 0 }, world)).toEqual(route);
  });

  it("respects a turned wall's own axes", () => {
    const world: PathWorld = { obstacles: [{ kind: "obox", id: "turned", x: 0, z: 0, halfX: 1.7, halfZ: 0.35, yaw: Math.PI / 4 }] };
    const route = findPath({ x: -3, z: 0 }, { x: 3, z: 0 }, world);
    expect(route).not.toBeNull();
    routeIsClear({ x: -3, z: 0 }, route!, world);
  });

  it("returns null when a closed wall has no lawful route around it", () => {
    const room: RoomBounds = { x: 0, z: 0, halfX: 3, halfZ: 2, yaw: 0, door: null };
    const world: PathWorld = { room, obstacles: [box(-0.25, -2, 0.25, 2)] };
    expect(findPath({ x: -2, z: 0 }, { x: 2, z: 0 }, world)).toBeNull();
  });

  it("allows an authored doorway gap and never exits through a solid room wall", () => {
    const room: RoomBounds = { x: 0, z: 0, halfX: 2, halfZ: 2, yaw: 0, door: { x: 0, z: 2, half: 0.8 } };
    const world: PathWorld = { room, obstacles: [] };
    const route = findPath({ x: 0, z: 0 }, { x: 0, z: 3 }, world);
    expect(route).toEqual([{ x: 0, z: 3 }]);
    expect(pathSegmentClear({ x: -1, z: 0 }, { x: -3, z: 0 }, world)).toBe(false);
  });

  it("fails closed for malformed coordinates and preserves a finite body", () => {
    expect(findPath({ x: 0, z: 0 }, { x: Number.NaN, z: 0 }, { obstacles: [] })).toBeNull();
    expect(findPath({ x: 0, z: 0 }, { x: 1, z: 0 }, { obstacles: [{ kind: "circle", id: "bad", x: Infinity, z: 0, r: 1 }] as Obstacle[] })).toBeNull();
    const body = createWalker({ groundHeightAt: flat, obstacles: [], start: { x: 0, z: 0 } });
    body.goTo(Number.NaN, 1);
    expect(Number.isFinite(body.state().x)).toBe(true);
    expect(Number.isFinite(body.state().z)).toBe(true);
    expect(body.state().goal).toBeNull();
    body.dispose();
  });

  it("stops autopilot immediately for manual input, place, and a place-world change", () => {
    const obstacle = box(-0.5, -1.5, 0.5, 1.5);
    const walk = () => createWalker({ groundHeightAt: flat, obstacles: [obstacle], start: { x: -3, z: 0 }, trail: false });
    const step = (body: ReturnType<typeof walk>, frames: number) => { for (let index = 0; index < frames; index += 1) body.step(1 / 60, index / 60, 0); };

    const manual = walk(); manual.goTo(3, 0); step(manual, 20); manual.setInput({ forward: 1, strafe: 0 }); step(manual, 1); manual.setInput({ forward: 0, strafe: 0 }); const interrupted = manual.state(); step(manual, 180);
    expect(manual.state().x).toBeLessThan(1.2); expect(manual.state().x - interrupted.x).toBeLessThan(1.1); manual.dispose();

    const moved = walk(); moved.goTo(3, 0); moved.setWorld({ obstacles: [obstacle] }); step(moved, 240);
    expect(moved.state().x).toBeLessThan(0); moved.dispose();

    const placed = walk(); placed.goTo(3, 0); placed.place(-2, 1); step(placed, 240);
    expect(Math.hypot(placed.state().x + 2, placed.state().z - 1)).toBeLessThan(BODY_RADIUS + 0.15); placed.dispose();
  });
});
