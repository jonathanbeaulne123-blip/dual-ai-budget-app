// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { clampCourtPose, COURT_BOUNDS } from "../src/harbour/camera/poses.ts";
import { clampPose } from "../src/harbour/camera/courtCamera.ts";
import { PLACE_PLACEMENTS } from "../src/harbour/scene/place.ts";
import { localBodyFromPose } from "../src/ledgerSync/worldPresenceMount.tsx";

/**
 * The three wiring jobs no single lane could do — body, space and presence
 * only mean something together, and each of these asserts the join rather
 * than either side of it.
 */

describe("the camera can look at a place that stands somewhere else (wiring 1)", () => {
  it("clamps to the origin without a centre, and around the place with one", () => {
    // A point out where a placed building stands, well past the Court's own radius.
    const far = { target: [14, 0.5, -3] as const, r: 4, theta: 0.3, phi: 1.0 };
    const atOrigin = clampCourtPose(far);
    expect(Math.hypot(atOrigin.target[0], atOrigin.target[2])).toBeCloseTo(COURT_BOUNDS.targetRadius, 6);
    // …which is the bug: the target has been dragged back to the middle of the
    // island, so the camera is looking at the Queen's lawn, not the building.
    expect(Math.hypot(atOrigin.target[0] - 14, atOrigin.target[2] + 3)).toBeGreaterThan(4);

    // Given the room's own centre, the same point is legal and untouched.
    const centre = [14, 0, -3] as const;
    const held = clampCourtPose(far, centre);
    expect(held.target[0]).toBeCloseTo(14, 9);
    expect(held.target[2]).toBeCloseTo(-3, 9);
    expect(clampPose(held, centre).target[0]).toBeCloseTo(14, 6);
  });

  it("leaves the open Court exactly as it was", () => {
    for (const target of [[0, 0.5, 0], [3, 0.5, -4], [8.9, 0.5, 0]] as const) {
      const pose = { target, r: 5, theta: 0.7, phi: 1.1 };
      expect(clampCourtPose(pose)).toEqual(clampCourtPose(pose, [0, 0, 0]));
      expect(clampPose(pose)).toEqual(clampPose(pose, [0, 0, 0]));
    }
  });

  it("frees the walking body too: a point at island radius 16 survives around its own centre", () => {
    // Same root cause as the placed interior — the follow camera's target is
    // the body, and a body that walks out to the rim was being hauled back.
    const out = { target: [16, 0.4, 0] as const, r: 3, theta: 0, phi: 1.0 };
    expect(clampCourtPose(out).target[0]).toBeCloseTo(COURT_BOUNDS.targetRadius, 6);
    expect(clampCourtPose(out, [16, 0, 0]).target[0]).toBeCloseTo(16, 9);
  });

  it("every placed interior stands outside the un-centred clamp, which is why it was needed", () => {
    const placed = Object.entries(PLACE_PLACEMENTS ?? {});
    expect(placed.length).toBeGreaterThan(0);
    for (const [id, placement] of placed) {
      const [x, z] = (placement as { spot: readonly [number, number] }).spot;
      expect(Math.hypot(x, z), `${id} stands out on the island`).toBeGreaterThan(COURT_BOUNDS.targetRadius);
    }
  });
});

describe("the partner wears the real character (wiring 2)", () => {
  it("registers the character factory when the body module is imported", async () => {
    const seam = await import("../src/harbour/presence/walker.ts");
    expect(seam.walkerFactoryIsPlaceholder()).toBe(true);
    await import("../src/harbour/body/characterWalker.ts");
    expect(seam.walkerFactoryIsPlaceholder(), "the character module claims the seam at import time").toBe(false);

    const walker = seam.createWalker({ tint: "#4d6f7e", skin: "#e8c39b", groundHeightAt: () => 0.25, height: 0.46 });
    // The real character, not the capsule: the placeholder is three meshes, the
    // figure is a jointed body.
    let meshes = 0;
    walker.group.traverse((node) => { if ((node as THREE.Mesh).isMesh) meshes++; });
    expect(meshes, "a jointed figure, not a capsule and a ball").toBeGreaterThan(6);

    // The contract the seam states, honoured: origin at the feet on the ground…
    walker.setPose(2, -3, 0);
    expect(walker.group.position.x).toBeCloseTo(2, 9);
    expect(walker.group.position.z).toBeCloseTo(-3, 9);
    expect(walker.group.position.y, "feet stand on the ground it was given").toBeCloseTo(0.25, 9);
    // …and yaw 0 looking along +z, the same sense the local body uses.
    expect(walker.group.rotation.y).toBeCloseTo(0, 9);
    const facing = new THREE.Vector3(0, 0, 1).applyEuler(walker.group.rotation);
    expect(facing.z).toBeCloseTo(1, 6);
    walker.setPose(2, -3, Math.PI / 2);
    const turned = new THREE.Vector3(0, 0, 1).applyEuler(walker.group.rotation);
    expect(turned.x, "a quarter turn looks along +x").toBeCloseTo(1, 6);

    walker.setOpacity(0);
    expect(walker.group.visible).toBe(false);
    walker.setOpacity(1);
    expect(walker.group.visible).toBe(true);
    walker.animate(0, 1 / 60);
    walker.dispose();
  });
});

describe("what the wire carries is the body (wiring 3)", () => {
  it("prefers the character's own feet and yaw over the camera's", () => {
    const body = localBodyFromPose({ target: [9, 0, -9], theta: 0.4, body: { x: 1.5, z: 4.25, yaw: -2 } });
    expect(body).toEqual({ x: 1.5, z: 4.25, yaw: -2 });
  });

  it("falls back to the camera where no body stands, as an interior does", () => {
    const camera = localBodyFromPose({ target: [3, 0, -1], theta: 0 });
    expect(camera.x).toBe(3);
    expect(camera.z).toBe(-1);
    expect(camera.yaw).toBeCloseTo(Math.PI, 9);
    expect(localBodyFromPose({ target: [0, 0, 0], theta: 0, body: null }).yaw).toBeCloseTo(Math.PI, 9);
  });

  it("wraps a yaw into the range the wire validates", () => {
    for (const yaw of [Math.PI * 3, -Math.PI * 3, 7, -7]) {
      const out = localBodyFromPose({ target: [0, 0, 0], theta: 0, body: { x: 0, z: 0, yaw } }).yaw;
      expect(out).toBeGreaterThan(-Math.PI - 1e-9);
      expect(out).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });
});
