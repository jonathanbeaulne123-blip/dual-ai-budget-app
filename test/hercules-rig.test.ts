import { describe, expect, it } from "vitest";
import { POSE_CLIPS, IDLE_CLIPS, registerRigClip, getRigClip, dispatchHerculesRig, createHerculesRigEngine, RIG_PARTS, expandRigMacro } from "../src/herculesRig/index.ts";
import { transformToCss } from "../src/herculesRig/transform.ts";

describe("Hercules rig engine", () => {
  it("exposes every controllable part id", () => {
    expect(RIG_PARTS).toEqual(expect.arrayContaining(["head", "tail", "legFront", "legBack"]));
    expect(RIG_PARTS.length).toBeGreaterThanOrEqual(13);
  });

  it("registers all pose clips", () => {
    for (const pose of Object.keys(POSE_CLIPS)) {
      expect(getRigClip(POSE_CLIPS[pose as keyof typeof POSE_CLIPS].id)).toBeDefined();
    }
  });

  it("plays walk and moves legs", () => {
    const engine = createHerculesRigEngine();
    engine.playPose("walk");
    engine.tick(100);
    const mid = engine.getState().parts.legFront.rotate;
    engine.tick(500);
    const later = engine.getState().parts.legFront.rotate;
    expect(mid).not.toBe(later);
    engine.destroy();
  });

  it("allows AI part overrides", () => {
    const engine = createHerculesRigEngine();
    engine.dispatch({ type: "setPart", part: "head", transform: { rotate: 33, translateY: -4 } });
    engine.tick(performance.now());
    expect(engine.getState().parts.head.rotate).toBeCloseTo(33, 1);
    engine.destroy();
  });

  it("supports custom clip registration", () => {
    registerRigClip({
      id: "demo-ear-twitch",
      durationMs: 200,
      loop: true,
      keyframes: [
        { t: 0, parts: { ears: { rotate: 0 } } },
        { t: 0.5, parts: { ears: { rotate: 12 } } },
        { t: 1, parts: { ears: { rotate: 0 } } },
      ],
    });
    expect(getRigClip("demo-ear-twitch")).toBeDefined();
  });

  it("serializes transforms to css", () => {
    expect(transformToCss({ rotate: 10, translateX: 2, translateY: -3, scaleX: 1, scaleY: 0.5 }))
      .toBe("translate(2px, -3px) rotate(10deg) scale(1, 0.5)");
  });

  it("returns false when dispatching without a bound engine", () => {
    expect(dispatchHerculesRig({ type: "playPose", pose: "loaf" })).toBe(false);
  });

  it("animates tail on loaf pose clip", () => {
    const engine = createHerculesRigEngine();
    engine.playPose("loaf");
    engine.tick(500);
    const early = engine.getState().parts.tail.rotate ?? 0;
    engine.tick(3500);
    const later = engine.getState().parts.tail.rotate ?? 0;
    expect(early).not.toBe(later);
    engine.destroy();
  });

  it("covers sit beg and bag pose clips", () => {
    for (const pose of ["sit", "beg", "bag"] as const) {
      expect(POSE_CLIPS[pose].keyframes.length).toBeGreaterThan(0);
    }
    expect(IDLE_CLIPS.blink.id).toBe("idle-blink");
  });

  it("maps wallet expand to a rig macro queue", () => {
    const macro = expandRigMacro("wallet");
    expect(macro.some((row) => row.type === "playPose" && row.pose === "perch")).toBe(true);
    expect(macro.some((row) => row.type === "setPart" && row.part === "legFront")).toBe(true);
  });
});
