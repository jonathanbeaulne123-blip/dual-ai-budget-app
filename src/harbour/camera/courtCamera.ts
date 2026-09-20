import type { PerspectiveCamera } from "three";
import { clampRoamCam, panDelta, wrapAngle, type RoamBounds, type RoamCam } from "../../path/world/roamCamera.ts";
import {
  COURT_BOUNDS,
  clampCourtPose,
  courtPose,
  poseEye,
  samePose,
  type Composition,
  type CourtAnchor,
  type CourtMode,
  type CourtPose,
} from "./poses.ts";

/**
 * Little Harbour · the Court's camera (BUILD_PLAN #19).
 *
 * One `RoamCam` (the island's camera maths, `roamCamera.ts`) with a lifted
 * target, driven toward the pose `poses.ts` names for the mode you asked for:
 *
 * - **Look** — `go("court")`, the three-quarter diorama; `go("sky")` pulls up
 *   and back to see the whole Court.
 * - **Close** — `go("object", anchor)` frames one thing: the Queen's
 *   portrait, a piece on its plinth, the sundial, the mailbox, the gate.
 * - **Walk** — not in this slice; `go` ignores nothing, there is simply no
 *   walking pose yet.
 *
 * A drag orbits (a desktop drag is exactly a phone swipe); wheel and pinch
 * move in log-radius so a notch feels the same close in and far out; a pan
 * slides the target over the ground with `panDelta`. Every axis is held
 * inside `clampRoamCam` bounds (r 3–22, tilt 0.25–1.2, target within 9 of
 * the Queen). Motion is one easing per key, `1 − e^(−7·dt)` — the house's
 * (`runtime.ts`) — so a slow frame and a fast one land on the same curve;
 * with reduced motion every move is a cut and `tick` settles at once.
 *
 * Nothing here reads the DOM, time or money: the runtime feeds `dt`, pointer
 * deltas and the stage's aspect.
 */

export type CourtCameraOptions = {
  camera: PerspectiveCamera;
  composition: Composition;
  reduced: boolean;
  /** Stage width ÷ height; defaults from the composition until `setAspect` is called. */
  aspect?: number;
};

export type CourtCamera = {
  /** Fly (or, with reduced motion, cut) to the pose for a mode. `anchor` only matters for `object` (default: the Queen). */
  go(mode: CourtMode, anchor?: CourtAnchor): void;
  /** Orbit by a pointer drag of `dx`,`dy` pixels: right swings the Court right under the eye, down tilts to look more from above. */
  drag(dx: number, dy: number): void;
  /** Slide the target over the ground by a drag of `dx`,`dy` pixels (two fingers, or a modifier drag). */
  pan(dx: number, dy: number): void;
  /** Move in log-radius: positive pulls back, negative comes closer. A wheel notch is about `deltaY × 0.0015`; a pinch is `−ln(scale)`. */
  zoom(delta: number): void;
  setComposition(composition: Composition): void;
  /** The stage's width ÷ height, so the diorama can fit the Court's width. */
  setAspect(aspect: number): void;
  setReduced(reduced: boolean): void;
  /** Advance by `dt` seconds and write the camera. Returns true while still moving (a frame is worth scheduling). */
  tick(dt: number): boolean;
  /** The pose the camera shows right now. */
  pose(): CourtPose;
  /** The pose it is heading for. */
  goal(): CourtPose;
  mode(): CourtMode;
  anchor(): CourtAnchor | undefined;
};

/** Radians of orbit per pixel of drag, and of tilt per pixel. */
export const ORBIT_GAIN = 0.0052;
export const TILT_GAIN = 0.0038;
/** The house's easing rate: `1 − e^(−EASE·dt)` of the remaining distance per second. */
export const EASE = 7;
/** Below this much remaining movement the camera is at rest and snaps to its goal. */
export const REST = 0.0015;

export const ROAM_COURT_BOUNDS: Readonly<RoamBounds> = Object.freeze({
  radius: COURT_BOUNDS.targetRadius,
  minR: COURT_BOUNDS.minR,
  maxR: COURT_BOUNDS.maxR,
  minPhi: COURT_BOUNDS.minPhi,
  maxPhi: COURT_BOUNDS.maxPhi,
});

const toRoam = (pose: CourtPose): RoamCam => ({ tx: pose.target[0], tz: pose.target[2], r: pose.r, theta: pose.theta, phi: pose.phi });
const fromRoam = (cam: RoamCam, ty: number): CourtPose => ({ target: [cam.tx, ty, cam.tz], r: cam.r, theta: cam.theta, phi: cam.phi });

/** Hold a pose inside the Court's bounds through the island's own clamp. */
export function clampPose(pose: CourtPose): CourtPose {
  return fromRoam(clampRoamCam(toRoam(pose), ROAM_COURT_BOUNDS), pose.target[1]);
}

const defaultAspect = (composition: Composition) => (composition === "phone" ? 390 / 844 : 1440 / 900);

export function createCourtCamera(options: CourtCameraOptions): CourtCamera {
  const { camera } = options;
  let composition = options.composition;
  let reduced = options.reduced;
  let aspect = options.aspect ?? defaultAspect(composition);
  let mode: CourtMode = "court";
  let anchor: CourtAnchor | undefined;
  let goal: CourtPose = clampPose(clampCourtPose(courtPose(mode, anchor, composition, aspect)));
  let current: CourtPose = goal;

  function apply(): void {
    const [x, y, z] = poseEye(current);
    camera.position.set(x, y, z);
    camera.up.set(0, 1, 0);
    camera.lookAt(current.target[0], current.target[1], current.target[2]);
  }

  function retarget(): void {
    goal = clampPose(clampCourtPose(courtPose(mode, anchor, composition, aspect)));
    if (reduced) { current = goal; apply(); }
  }

  /** A hand on the camera moves it directly: the goal follows so nothing eases back afterwards. */
  function take(next: CourtPose): void {
    current = clampPose(next);
    goal = current;
    apply();
  }

  const settled = () => current === goal || samePose(current, goal, 1e-9);

  apply();

  return {
    go(nextMode, nextAnchor) {
      mode = nextMode;
      anchor = nextMode === "object" ? nextAnchor ?? "queen" : undefined;
      retarget();
    },
    drag(dx, dy) {
      if (!dx && !dy) return;
      take({ ...current, theta: wrapAngle(current.theta - dx * ORBIT_GAIN), phi: current.phi - dy * TILT_GAIN });
    },
    pan(dx, dy) {
      if (!dx && !dy) return;
      const d = panDelta(dx, dy, current.r, current.theta);
      take({ ...current, target: [current.target[0] + d.dx, current.target[1], current.target[2] + d.dz] });
    },
    zoom(delta) {
      if (!delta || !Number.isFinite(delta)) return;
      take({ ...current, r: current.r * Math.exp(delta) });
    },
    setComposition(next) {
      if (next === composition) return;
      composition = next;
      retarget();
    },
    setAspect(next) {
      if (!(next > 0) || !Number.isFinite(next) || Math.abs(next - aspect) < 1e-4) return;
      aspect = next;
      retarget();
    },
    setReduced(next) {
      reduced = next;
      if (reduced && !settled()) { current = goal; apply(); }
    },
    tick(dt) {
      if (settled()) return false;
      if (reduced || !(dt > 0)) {
        if (reduced) { current = goal; apply(); }
        return !reduced;
      }
      const k = 1 - Math.exp(-EASE * Math.min(dt, 0.25));
      const dTheta = wrapAngle(goal.theta - current.theta);
      const next: CourtPose = {
        target: [
          current.target[0] + (goal.target[0] - current.target[0]) * k,
          current.target[1] + (goal.target[1] - current.target[1]) * k,
          current.target[2] + (goal.target[2] - current.target[2]) * k,
        ],
        r: current.r + (goal.r - current.r) * k,
        theta: wrapAngle(current.theta + dTheta * k),
        phi: current.phi + (goal.phi - current.phi) * k,
      };
      const remaining = Math.max(
        Math.abs(goal.r - next.r),
        Math.abs(wrapAngle(goal.theta - next.theta)),
        Math.abs(goal.phi - next.phi),
        Math.hypot(goal.target[0] - next.target[0], goal.target[1] - next.target[1], goal.target[2] - next.target[2]),
      );
      current = remaining < REST ? goal : next;
      apply();
      return current !== goal;
    },
    pose: () => current,
    goal: () => goal,
    mode: () => mode,
    anchor: () => anchor,
  };
}
