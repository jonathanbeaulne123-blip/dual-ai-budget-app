import { describe, expect, it } from "vitest";
import {
  ERA_AXIS, ERA_FUTURE_RADIUS, ERA_PAST_MAX, ERA_PAST_SCALE, ERA_RING, ERA_SKY_MAX, ERA_SKY_MIN,
  eraPastRadius, eraPastScale, eraRingSpot, eraSampleDims, eraSampleStep, eraSkyFrame, eraSkyTheta,
} from "../src/path/world/pathWorld3d.ts";

const at = (offset: number) => { const s = eraRingSpot(offset); return { x: Math.cos(s.a) * s.r, z: Math.sin(s.a) * s.r, r: s.r, a: s.a }; };
const dist = (p: { x: number; z: number }, q: { x: number; z: number }) => Math.hypot(p.x - q.x, p.z - q.z);

describe("Journey of Life era islands (D-268): ring placement", () => {
  it("puts the next era straight ahead on the journey axis and the last one straight behind", () => {
    const next = at(1), last = at(-1);
    expect(next.r).toBe(ERA_RING);
    expect(last.r).toBe(ERA_RING);
    expect(Math.cos(next.a - ERA_AXIS)).toBeCloseTo(1, 6);
    expect(Math.cos(last.a - ERA_AXIS)).toBeCloseTo(-1, 6);
    // Past and future lie on opposite sides of the main island: the journey reads as one line through it.
    expect(dist(next, last)).toBeCloseTo(ERA_RING * 2, 6);
  });

  it("keeps offsets −1 and +1 closest to the main island, then spirals outward in order", () => {
    for (const side of [1, -1]) {
      const radii = [1, 2, 3, 4, 5, 6].map((k) => at(side * k).r);
      for (let i = 1; i < radii.length; i++) expect(radii[i]!).toBeGreaterThan(radii[i - 1]!);
    }
  });

  it("never lets two islands (or an island and the biggest main coast) overlap, up to six eras each way", () => {
    const spots = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].map((k) => ({ k, ...at(k), size: k < 0 ? eraPastRadius(36) : ERA_FUTURE_RADIUS }));
    for (const s of spots) expect(s.r - s.size).toBeGreaterThan(30 + 36 * 1.45 + 5);
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i]!, b = spots[j]!;
      // Past islands are usually far smaller than a 36-month island; neighbours still keep clear of each other at that size.
      expect(dist(a, b), `${a.k} vs ${b.k}`).toBeGreaterThan(Math.min(a.size, b.size) * 2);
    }
    // Neighbouring past islands at a typical size (a year or so each) keep a real gap.
    expect(dist(at(-1), at(-2))).toBeGreaterThan(eraPastRadius(16) * 2 + 8);
  });

  it("shrinks long past eras so a past island is never wider than the cap", () => {
    expect(eraPastScale(0)).toBe(ERA_PAST_SCALE);
    expect(eraPastScale(36)).toBeLessThan(ERA_PAST_SCALE);
    for (const cur of [0, 6, 12, 24, 36, 120]) expect(eraPastRadius(cur)).toBeLessThanOrEqual(ERA_PAST_MAX + 1e-9);
    expect(eraPastRadius(12)).toBeGreaterThan(eraPastRadius(4));
  });

  it("treats a rounded zero offset as the main island", () => {
    expect(eraRingSpot(0)).toEqual({ a: ERA_AXIS, r: 0 });
    expect(eraRingSpot(0.2).r).toBe(0);
  });
});

describe("Journey of Life era islands: coarse sampling and Sky framing", () => {
  it("samples past islands every 3rd cell on Full (51×51) and every 5th on Lite (31×31)", () => {
    expect(eraSampleStep("full")).toBe(3);
    expect(eraSampleStep("lite")).toBe(5);
    expect(eraSampleDims(eraSampleStep("full"))).toBe(51);
    expect(eraSampleDims(eraSampleStep("lite"))).toBe(31);
    expect(eraSampleDims(1)).toBe(152);
  });

  it("frames every island inside the view, with a bounded camera distance", () => {
    const islands = [{ x: 0, z: 0, r: 50 }, ...[-2, -1, 1, 2, 3].map((k) => ({ ...at(k), r: k < 0 ? eraPastRadius(12) : ERA_FUTURE_RADIUS }))];
    for (const aspect of [390 / 600, 1, 1100 / 560]) {
      const theta = eraSkyTheta(aspect);
      const frame = eraSkyFrame(islands, aspect, theta);
      expect(frame.r).toBeGreaterThanOrEqual(ERA_SKY_MIN);
      expect(frame.r).toBeLessThanOrEqual(ERA_SKY_MAX);
      // The target sits between the islands, never out past them.
      expect(Math.hypot(frame.tx, frame.tz)).toBeLessThan(ERA_RING + 60);
    }
    // A wide screen looks across the journey, so it needs less distance than a phone looking down it would across.
    const wide = eraSkyFrame(islands, 2, eraSkyTheta(2)).r;
    const phoneAcross = eraSkyFrame(islands, 0.46, eraSkyTheta(2)).r;
    expect(wide).toBeLessThanOrEqual(phoneAcross);
  });

  it("turns phones down the journey and wide screens across it, future on the right", () => {
    expect(eraSkyTheta(0.46)).toBeCloseTo(0.7);
    const theta = eraSkyTheta(1.9);
    const right = { x: Math.cos(theta), z: -Math.sin(theta) };
    const future = at(1);
    expect(future.x * right.x + future.z * right.z).toBeGreaterThan(0);
  });

  it("falls back to a small frame with no islands", () => {
    expect(eraSkyFrame([], 1, 0.7)).toEqual({ tx: 0, tz: 0, r: ERA_SKY_MIN });
  });
});
