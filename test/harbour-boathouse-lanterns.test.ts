// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BOATHOUSE_NEW_DAYS, EMPTY_BOATHOUSE_READING, buildBoathouseReading } from "../src/harbour/data/reading.ts";
import { BOATHOUSE_DRESSING } from "../src/harbour/boathouse/dressing.ts";
import { BOATHOUSE_LAYOUT, LANTERN_SWAY, createBoathouse, lanternSway, lanternWords } from "../src/harbour/boathouse/BoathouseScene.ts";
import { PLACE_HOLDS } from "../src/harbour/scene/place.ts";
import { holdPoseInRoom, poseEye } from "../src/harbour/camera/poses.ts";

/**
 * The lantern-lighting flow in the Boathouse (W6 #3). An unlit lantern by the
 * door is how a wish is made — a door, never a write. The newest lantern burns
 * warmer and sways while a wish has just gone up, and the room says so in
 * counts: "a new wish was hung this week", never a word of what it is.
 */

const today = "2026-09-20";
const wish = (over: Record<string, unknown> = {}) => ({ id: "EXP-1", title: "Iceland in February", ...over });
const boathouse = (experiences: unknown[], at = today) =>
  buildBoathouseReading({ hearthside: { experiences, memories: [], notes: [], encounters: [] } }, at);

describe("the newly-hung reading", () => {
  it("counts a wish stamped inside the window, and nothing outside it", () => {
    const rows = [
      wish({ id: "today", createdAt: `${today}T09:00:00.000Z` }),
      wish({ id: "edge", createdAt: "2026-09-17T09:00:00.000Z" }), // three days back: still new
      wish({ id: "older", createdAt: "2026-09-16T09:00:00.000Z" }), // four: hung and settled
    ];
    expect(BOATHOUSE_NEW_DAYS).toBe(3);
    expect(boathouse(rows).hung).toBe(2);
    expect(boathouse(rows).wishes).toBe(3);
    // A later day walks the window forward with it.
    expect(boathouse(rows, "2026-09-22").hung).toBe(1);
    expect(boathouse(rows, "2026-10-01").hung).toBe(0);
  });

  it("hangs nothing new off a row that keeps no stamp, a bad one, or no `today` at all", () => {
    // This is every shared wish today: the record admits no creation stamp, so
    // the lantern stays as it was rather than glowing on a guess.
    expect(boathouse([wish(), wish({ id: "b" })]).hung).toBe(0);
    expect(boathouse([wish({ createdAt: 17 }), wish({ id: "b", createdAt: "yesterday" }), wish({ id: "c", createdAt: null })]).hung).toBe(0);
    expect(buildBoathouseReading({ hearthside: { experiences: [wish({ createdAt: `${today}T09:00:00.000Z` })] } }).hung).toBe(0);
    expect(buildBoathouseReading({})).toEqual(EMPTY_BOATHOUSE_READING);
    expect(EMPTY_BOATHOUSE_READING.hung).toBe(0);
  });

  it("carries no wish's words, only how many", () => {
    const reading = boathouse([wish({ createdAt: `${today}T09:00:00.000Z` })]);
    expect(JSON.stringify(reading)).not.toContain("Iceland");
    expect(lanternWords(reading.wishes, reading.hung)).toBe("The lanterns — 1 idea in the light; a new wish was hung this week");
    expect(lanternWords(4, 0)).toBe("The lanterns — 4 ideas in the light");
    expect(lanternWords(0, 0)).toBe("The lanterns — nothing yet");
  });
});

describe("the Boathouse's lanterns", () => {
  const build = (reading: unknown, onAnimate?: () => void) => {
    const scene = new THREE.Scene();
    const handle = createBoathouse(scene, { dressing: BOATHOUSE_DRESSING.classic, reading, quality: "lite", ...(onAnimate ? { onAnimate } : {}) });
    return { scene, handle };
  };
  const lit = (handle: { group: THREE.Object3D }) => {
    const glows: number[] = [];
    handle.group.traverse((node) => {
      const material = (node as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if ((node as THREE.Mesh).isMesh && material && material.emissiveIntensity > 0 && material.emissive?.getHex() > 0) glows.push(material.emissiveIntensity);
    });
    return glows;
  };

  it("hangs the unlit lantern by the door whatever the reading says, and it is a door, never a write", () => {
    for (const reading of [null, { boathouse: boathouse([]) }, { boathouse: boathouse([wish({ createdAt: `${today}T09:00:00.000Z` })]) }]) {
      const { scene, handle } = build(reading);
      const made = handle.anchors().find((anchor) => anchor.id === "wish")!;
      expect(made.door).toEqual({ target: "wishes" });
      expect(made.label).toContain("make a wish");
      expect(made.position).toEqual([...BOATHOUSE_LAYOUT.wishLantern]);
      expect(handle.regions().some((region) => region.id === "wish" && region.box)).toBe(true);
      // It never lights of its own accord: no glowing material stands at its place.
      const cold = scene.getObjectByName("boathouse-wish-lantern")!;
      cold.traverse((node) => {
        const material = (node as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        expect(material?.emissive?.getHex() ?? 0).toBe(0);
      });
      handle.dispose();
    }
  });

  it("burns the newest lantern warmer only while one has just gone up", () => {
    const settled = build({ boathouse: boathouse([wish({ id: "a" }), wish({ id: "b" })]) });
    expect(lit(settled.handle).sort()).toEqual([0.7, 0.7]);
    settled.handle.dispose();
    const fresh = build({ boathouse: boathouse([wish({ id: "a", createdAt: `${today}T09:00:00.000Z` }), wish({ id: "b" })]) });
    const glows = lit(fresh.handle).sort();
    expect(glows.length).toBe(2);
    expect(glows[0]).toBe(0.7);
    expect(glows[1]).toBeGreaterThan(0.7);
    fresh.handle.dispose();
    // No wish at all: two unlit lanterns on the rafter and nothing warm.
    const empty = build({ boathouse: boathouse([]) });
    expect(lit(empty.handle)).toEqual([]);
    empty.handle.dispose();
  });

  it("sways the newest lantern on the frame policy's own clock, and nothing else, and stops when it settles", () => {
    let stirred = 0;
    const { handle } = build({ boathouse: boathouse([wish({ id: "a", createdAt: `${today}T09:00:00.000Z` })]) }, () => { stirred++; });
    // The room asked the runtime for animated frames; it never spins one itself.
    expect(stirred).toBe(1);
    expect(handle.animate(0, 0)).toBe(true);
    const zero = handle.group.children.map((child) => child.rotation.z);
    expect(handle.animate(LANTERN_SWAY.seconds / 4, 0.016)).toBe(true);
    const turned = handle.group.children.map((child) => child.rotation.z);
    // Exactly one thing in the room moved, and it moved no further than the draught allows.
    const moved = turned.filter((angle, index) => angle !== zero[index]);
    expect(moved.length).toBe(1);
    expect(Math.abs(moved[0]!)).toBeCloseTo(LANTERN_SWAY.radians, 6);
    expect(lanternSway(0)).toBeCloseTo(0, 9);
    expect(lanternSway(LANTERN_SWAY.seconds)).toBeCloseTo(0, 9);
    expect(Math.abs(lanternSway(LANTERN_SWAY.seconds * 0.75))).toBeCloseTo(LANTERN_SWAY.radians, 6);
    // The wish settles: the room goes still and asks for no more frames.
    handle.update({ boathouse: boathouse([wish({ id: "a", createdAt: `${today}T09:00:00.000Z` })], "2026-10-01") } as never);
    expect(handle.animate(1, 0.016)).toBe(false);
    expect(stirred).toBe(1);
    handle.dispose();
  });

  it("says it in counts, and keeps every pose inside the room's hold", () => {
    const { handle } = build({ boathouse: boathouse([wish({ createdAt: `${today}T09:00:00.000Z` })]) });
    const lanterns = handle.anchors().find((anchor) => anchor.id === "wishes")!;
    expect(lanterns.label).toContain("a new wish was hung this week");
    expect(lanterns.label).not.toContain("Iceland");
    const roomHold = PLACE_HOLDS.boathouse!;
    for (const [key, pose] of Object.entries(handle.poses())) {
      const eye = poseEye(holdPoseInRoom(pose, roomHold));
      for (let axis = 0; axis < 3; axis++) {
        expect(eye[axis]!, `${key} eye[${axis}]`).toBeGreaterThanOrEqual(roomHold.eye.min[axis]! - 1e-6);
        expect(eye[axis]!, `${key} eye[${axis}]`).toBeLessThanOrEqual(roomHold.eye.max[axis]! + 1e-6);
      }
    }
    let meshes = 0;
    handle.group.traverse((node) => { if ((node as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBeLessThanOrEqual(120);
    handle.dispose();
  });
});
