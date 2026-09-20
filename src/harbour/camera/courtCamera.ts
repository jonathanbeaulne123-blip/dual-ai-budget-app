// WRITER C REPLACES this file (BUILD_PLAN #19). Placeholder so `scene/runtime.ts`
// compiles and the frame test runs: the same interface, minimal poses, no
// RoamCam maths. Keep `CourtCamera`'s shape when replacing it.
import * as THREE from "three";
import type { Anchor, Composition, Pose, PoseKey } from "../scene/place.ts";
import { poseFor, type Vec3 } from "../scene/place.ts";

export type CourtCameraMode = "sky" | "court" | "object";

export type CourtCameraOptions = {
  camera: THREE.PerspectiveCamera;
  composition: Composition;
  reduced: boolean;
  /** The active place's poses and anchors, read on every `go`. */
  poses?: () => Record<PoseKey, Pose>;
  anchors?: () => Anchor[];
};

export type CourtCamera = {
  go(mode: CourtCameraMode, anchor?: string): void;
  /** Pointer drag in pixels: orbit. */
  drag(dx: number, dy: number): void;
  /** Log-radius delta: positive pulls back. Wheel and pinch both arrive here. */
  zoom(delta: number): void;
  /** Advances the easing; returns true while still moving. */
  tick(dt: number): boolean;
  pose(): Pose;
  /** A return record's camera position; the target stays where the mode left it. */
  restore(position: Vec3): void;
  setComposition(composition: Composition): void;
  setReduced(reduced: boolean): void;
};

export const COURT_BOUNDS = Object.freeze({ minR: 3, maxR: 22, minPhi: 0.25, maxPhi: 1.2, targetRadius: 9 });

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function defaultPose(mode: CourtCameraMode, composition: Composition, anchor?: Anchor): Pose {
  if (mode === "sky") return { target: [0, 0, 0], r: composition === "phone" ? 22 : 19, theta: -0.6, phi: 0.42 };
  if (mode === "object" && anchor) {
    const [x, y, z] = anchor.position;
    const theta = Math.atan2(x, z) || -0.4;
    return { target: [x, y + 0.9, z], r: composition === "phone" ? 5.2 : 4.4, theta, phi: 1.05 };
  }
  return { target: [0, 1.1, 0], r: composition === "phone" ? 11 : 9.5, theta: -0.55, phi: composition === "phone" ? 1.02 : 0.98 };
}

function place(camera: THREE.PerspectiveCamera, pose: Pose): void {
  const [tx, ty, tz] = pose.target;
  camera.position.set(tx + pose.r * Math.sin(pose.phi) * Math.sin(pose.theta), ty + pose.r * Math.cos(pose.phi), tz + pose.r * Math.sin(pose.phi) * Math.cos(pose.theta));
  camera.lookAt(tx, ty, tz);
}

export function createCourtCamera(options: CourtCameraOptions): CourtCamera {
  const { camera } = options;
  let composition = options.composition, reduced = options.reduced;
  let mode: CourtCameraMode = "court", anchorId: string | undefined;
  let current: Pose = defaultPose("court", composition);
  let goal: Pose = { ...current, target: [...current.target] as [number, number, number] };
  place(camera, current);

  const boundGoal = () => {
    goal = { ...goal, r: clamp(goal.r, COURT_BOUNDS.minR, COURT_BOUNDS.maxR), phi: clamp(goal.phi, COURT_BOUNDS.minPhi, COURT_BOUNDS.maxPhi) };
  };
  const settle = () => { current = { ...goal, target: [...goal.target] as [number, number, number] }; place(camera, current); };
  const resolve = (): Pose => {
    const anchor = anchorId ? options.anchors?.().find(a => a.id === anchorId) : undefined;
    const key: PoseKey = mode === "object" && anchorId ? `object:${anchorId}` : mode;
    return options.poses ? poseFor(options.poses(), key, composition) ?? defaultPose(mode, composition, anchor) : defaultPose(mode, composition, anchor);
  };

  const go = (nextMode: CourtCameraMode, anchor?: string) => {
    mode = nextMode; anchorId = nextMode === "object" ? anchor : undefined;
    const next = resolve();
    goal = { ...next, target: [...next.target] as [number, number, number] };
    boundGoal();
    if (reduced) settle();
  };

  return {
    go,
    drag(dx, dy) {
      goal = { ...goal, theta: goal.theta - dx * 0.006, phi: goal.phi - dy * 0.005 };
      boundGoal();
      if (reduced) settle();
    },
    zoom(delta) {
      goal = { ...goal, r: goal.r * Math.exp(delta) };
      boundGoal();
      if (reduced) settle();
    },
    tick(dt) {
      const gap = Math.abs(current.r - goal.r) + Math.abs(current.theta - goal.theta) + Math.abs(current.phi - goal.phi)
        + Math.abs(current.target[0] - goal.target[0]) + Math.abs(current.target[1] - goal.target[1]) + Math.abs(current.target[2] - goal.target[2]);
      if (reduced || gap < 0.002) { if (gap > 0) settle(); return false; }
      const k = 1 - Math.exp(-dt * 7);
      current = {
        r: current.r + (goal.r - current.r) * k,
        theta: current.theta + (goal.theta - current.theta) * k,
        phi: current.phi + (goal.phi - current.phi) * k,
        target: [0, 1, 2].map(i => (current.target[i] ?? 0) + ((goal.target[i] ?? 0) - (current.target[i] ?? 0)) * k) as [number, number, number],
      };
      place(camera, current);
      return true;
    },
    pose: () => ({ ...current, target: [...current.target] as [number, number, number] }),
    restore(position) {
      const [tx, ty, tz] = goal.target;
      const dx = position[0] - tx, dy = position[1] - ty, dz = position[2] - tz;
      const r = Math.hypot(dx, dy, dz);
      if (!Number.isFinite(r) || r < 0.01) return;
      goal = { target: [tx, ty, tz], r, theta: Math.atan2(dx, dz), phi: Math.acos(clamp(dy / r, -1, 1)) };
      boundGoal(); settle();
    },
    setComposition(next) { if (next !== composition) { composition = next; go(mode, anchorId); } },
    setReduced(next) { reduced = next; if (reduced) settle(); },
  };
}
