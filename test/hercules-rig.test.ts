import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HUMAN_IDLE_FLY_CHASE_MS,
  IDLE_FLY_POUNCE_CLIP_ID,
  POSE_CLIPS,
  IDLE_CLIPS,
  registerRigClip,
  getRigClip,
  dispatchHerculesRig,
  createHerculesRigEngine,
  idleFlyPounceLanding,
  RIG_PARTS,
  expandRigMacro,
} from "../src/herculesRig/index.ts";
import { herculesOverFly } from "../src/HerculesFly.tsx";
import { transformToCss } from "../src/herculesRig/transform.ts";

afterEach(() => vi.useRealTimers());

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
    const startedAt = performance.now();
    engine.tick(startedAt + 100);
    const mid = engine.getState().parts.legFront.rotate;
    engine.tick(startedAt + 500);
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
    const startedAt = performance.now();
    engine.tick(startedAt + 500);
    const early = engine.getState().parts.tail.rotate ?? 0;
    engine.tick(startedAt + 3500);
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

  it("uses a sleeping mood-adaptive scheduler instead of a permanent 60 fps loop", async () => {
    vi.useFakeTimers();
    const engine = createHerculesRigEngine();
    engine.start();
    const started = engine.getDiagnostics().tickCount;
    await vi.advanceTimersByTimeAsync(1_000);
    const ambientTicks = engine.getDiagnostics().tickCount - started;
    expect(engine.getDiagnostics()).toMatchObject({ motionMode: "ambient", framesPerSecond: 8 });
    expect(ambientTicks).toBeGreaterThanOrEqual(6);
    expect(ambientTicks).toBeLessThanOrEqual(9);

    engine.setMood("restless");
    const restlessStart = engine.getDiagnostics().tickCount;
    await vi.advanceTimersByTimeAsync(1_000);
    const restlessTicks = engine.getDiagnostics().tickCount - restlessStart;
    expect(engine.getDiagnostics().framesPerSecond).toBe(12);
    expect(restlessTicks).toBeGreaterThan(ambientTicks);
    expect(restlessTicks).toBeLessThanOrEqual(13);
    engine.destroy();
  });

  it("pauses all scheduled work while hidden or reduced motion is active", async () => {
    vi.useFakeTimers();
    const engine = createHerculesRigEngine();
    engine.start();
    engine.setVisibilityProfile("hidden");
    const hiddenAt = engine.getDiagnostics().tickCount;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(engine.getDiagnostics()).toMatchObject({ motionMode: "paused", tickCount: hiddenAt });

    engine.setVisibilityProfile("full");
    engine.setReducedMotion(true);
    const reducedAt = engine.getDiagnostics().tickCount;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(engine.getDiagnostics()).toMatchObject({ motionMode: "paused", tickCount: reducedAt });
    engine.destroy();
  });

  it("uses a quiet compact baseline but still accelerates direct reactions", async () => {
    vi.useFakeTimers();
    const engine = createHerculesRigEngine();
    engine.setVisibilityProfile("compact");
    engine.start();
    const started = engine.getDiagnostics().tickCount;
    await vi.advanceTimersByTimeAsync(1_000);
    const compactTicks = engine.getDiagnostics().tickCount - started;
    expect(engine.getDiagnostics().framesPerSecond).toBe(2);
    expect(compactTicks).toBeGreaterThanOrEqual(1);
    expect(compactTicks).toBeLessThanOrEqual(3);

    engine.dispatch({ type: "playClip", clipId: IDLE_FLY_POUNCE_CLIP_ID, loop: false });
    expect(engine.getDiagnostics()).toMatchObject({ motionMode: "reaction", framesPerSecond: 24 });
    engine.destroy();
  });

  it("accelerates finite reactions then returns to the autonomous baseline", async () => {
    vi.useFakeTimers();
    const engine = createHerculesRigEngine();
    engine.start();
    engine.dispatch({ type: "playClip", clipId: IDLE_FLY_POUNCE_CLIP_ID, loop: false });
    expect(engine.getDiagnostics()).toMatchObject({ motionMode: "reaction", framesPerSecond: 24 });
    await vi.advanceTimersByTimeAsync(800);
    expect(engine.getDiagnostics()).toMatchObject({ motionMode: "ambient", framesPerSecond: 8 });
    expect(engine.getState().pose).toBe("loaf");
    engine.destroy();
  });

  it("bounds explicit looping reactions and restores the newest baseline", async () => {
    vi.useFakeTimers();
    const engine = createHerculesRigEngine();
    engine.start();
    engine.dispatch({ type: "playPose", pose: "pace", loop: true });
    engine.playPose("sleep");
    expect(engine.getDiagnostics().motionMode).toBe("reaction");
    await vi.advanceTimersByTimeAsync(8_200);
    expect(engine.getDiagnostics().motionMode).toBe("ambient");
    expect(engine.getState().pose).toBe("sleep");
    engine.destroy();
  });

  it("aims the ten-second idle pounce at a capturable fly landing", () => {
    expect(HUMAN_IDLE_FLY_CHASE_MS).toBe(10_000);
    expect(getRigClip(IDLE_FLY_POUNCE_CLIP_ID)?.durationMs).toBe(650);
    const fly = { x: 620, y: 310 };
    const landing = idleFlyPounceLanding({ x: 120, y: 500 }, fly, { w: 1_200, h: 800 });
    expect(herculesOverFly(landing, fly)).toBe(true);
  });
});
