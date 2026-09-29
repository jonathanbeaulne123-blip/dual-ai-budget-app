import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createNativeSkate, NATIVE_SKATE_RADIUS, toNative } from "../src/harbour/horizon/skate/nativeSkate.ts";
import { MOUNTAIN_V2_OFFSET as O } from "../src/harbour/horizon/regions/mountainV2/placement.ts";
import { createBodyFigure } from "../src/harbour/body/figure.ts";
import { groundHeightAt } from "../src/harbour/scene/ground.ts";

/**
 * The old Tideline skate on the Horizon (Jonathan 2026-09-29): it runs in native Mountain space on Mountain v2's town
 * island, and only the body and the camera are translated by MOUNTAIN_V2_OFFSET.
 */
const TIDELINE = { x: 18.6 + O.x, z: -38.3 + O.z };

function mount() {
  const scene = new THREE.Scene(), figure = createBodyFigure(), frames: unknown[] = [];
  scene.add(figure.group);
  const skate = createNativeSkate({ scene, figure, tier: "lite", reducedMotion: () => true, onSkate: frame => frames.push(frame) });
  return { scene, figure, skate, frames };
}

describe("the old skate on Mountain v2's town island", () => {
  it("offers the board on the island and nowhere else", () => {
    const { skate } = mount();
    expect(skate.canStart(TIDELINE.x, TIDELINE.z)).toBe(true);
    expect(skate.canStart(O.x + NATIVE_SKATE_RADIUS + 1, O.z)).toBe(false);
    expect(skate.canStart(1470, 1180)).toBe(false); // Little Harbour, the Horizon's own town
    expect(skate.start({ x: 1470, y: 12, z: 1180, yaw: 0 })).toBe(false);
  });

  it("rides in native space and the Horizon body is the ride plus the offset", () => {
    const { skate } = mount();
    const y = groundHeightAt(TIDELINE.x - O.x, TIDELINE.z - O.z) + O.y;
    expect(skate.start({ x: TIDELINE.x, y, z: TIDELINE.z, yaw: 0 })).toBe(true);
    expect(skate.controls.active()).toBe(true);
    let frame = null;
    for (let i = 0; i < 60; i++) frame = skate.step(1 / 60);
    const present = skate.controls.present()!;
    expect(frame!.body.x).toBeCloseTo(present.x + O.x, 6);
    expect(frame!.body.y).toBeCloseTo(present.y + O.y, 6);
    expect(frame!.body.z).toBeCloseTo(present.z + O.z, 6);
    const native = toNative(frame!.body.x, frame!.body.y, frame!.body.z);
    expect(Math.hypot(native.x - 18.6, native.z + 38.3)).toBeLessThan(3);
  });

  it("frames the chase camera around the rider in Horizon space", () => {
    const { skate } = mount();
    skate.start({ x: TIDELINE.x, y: O.y, z: TIDELINE.z, yaw: 0 });
    const body = skate.step(1 / 60)!.body, shot = skate.camera(1 / 60, 1.6, true)!;
    expect(Math.hypot(shot.target[0] - body.x, shot.target[2] - body.z)).toBeLessThan(4);
    expect(Math.hypot(shot.eye[0] - body.x, shot.eye[2] - body.z)).toBeLessThan(20);
    expect(shot.eye[1]).toBeGreaterThan(body.y);
  });

  it("stepping off hands back a Horizon pose and the figure", () => {
    const { skate, figure, scene } = mount();
    skate.start({ x: TIDELINE.x, y: O.y, z: TIDELINE.z, yaw: 1 });
    skate.step(1 / 60);
    const at = skate.stop()!;
    expect(skate.controls.active()).toBe(false);
    expect(Math.hypot(at.x - TIDELINE.x, at.z - TIDELINE.z)).toBeLessThan(3);
    expect(figure.group.parent).toBe(scene);
    expect(skate.stop()).toBeNull();
  });

  it("publishes the old HUD model while riding and clears it after", () => {
    const { skate, frames } = mount();
    skate.start({ x: TIDELINE.x, y: O.y, z: TIDELINE.z, yaw: 0 });
    skate.step(1 / 60); skate.publish(1000, true);
    expect(frames.at(-1)).toMatchObject({ model: expect.any(Object), progress: expect.any(Object) });
    skate.stop(); skate.publish(2000);
    expect(frames.at(-1)).toBeNull();
  });
});
