import type { PerspectiveCamera } from "three";
import { poseEye, type Composition, type CourtPose, type Vec3 } from "./poses.ts";

/**
 * Little Harbour · the camera that walks with you.
 *
 * `courtCamera.ts` and `path/world/roamCamera.ts` are both *target-orbit*
 * cameras: something in the world is the subject and the eye swings around
 * it. A follow camera is a different animal — the subject moves, the eye is
 * dragged after it, and the person's drag is an offset *relative to the way
 * the body is facing*, not an absolute heading. This is that camera, and it
 * is deliberately a separate model rather than a mode bolted onto the Court's:
 * the Court's bounds hold its target within 9 units of the Queen, and a body
 * that can reach the shore is 20 units out.
 *
 * ## The model
 *
 * - The camera looks at the body's shoulders, `target`, eased toward it.
 * - It stands `r` behind and `phi` above, in the same spherical language every
 *   other pose in this app is written in (`poses.ts`).
 * - **Behind** means `bodyYaw + π`: the body looks along `(sin yaw, cos yaw)`,
 *   the eye sits at `target + r·(sin θ, …, cos θ)`, so the eye is behind the
 *   body when `θ = yaw + π`.
 * - A drag turns `offset`, which is added to that. Let go and, *while you are
 *   walking*, the offset decays back to zero, so the camera settles behind you
 *   again; stand still and it stays exactly where you put it. That is the
 *   difference between a camera that fights you and one that follows you.
 * - A desktop drag is exactly a phone swipe: the same `ORBIT_GAIN` per pixel
 *   in both, no modifier, no second gesture. A standing product rule.
 * - Wheel and pinch both move in log-radius, so a notch feels the same close
 *   in and far out — the Court's own rule, kept.
 *
 * Reduced motion: every easing becomes a cut. The body still walks (that is
 * the app); the camera stops swinging after it.
 *
 * Nothing here reads the DOM, time or money.
 */

/** Radians of orbit per pixel of drag, and of tilt per pixel — the Court's numbers, so the two cameras feel alike. */
export const FOLLOW_ORBIT_GAIN = 0.0052;
export const FOLLOW_TILT_GAIN = 0.0038;
/** How quickly the eye catches up with the body, and how quickly the look-at point does (per second). */
export const FOLLOW_EASE = 6;
export const LOOK_EASE = 9;
/** How quickly a drag's offset gives itself back while you walk (per second). Unhurried: a deliberate look is not undone in a blink. */
export const RECENTRE = 1.6;
/** Under this much walking the camera does not recentre at all — standing still, the view is yours. */
export const RECENTRE_SPEED = 0.25;

/** How far behind and how high the camera stands, per composition. A phone's narrow column comes in a little closer. */
export const FOLLOW_DISTANCE: Readonly<Record<Composition, number>> = Object.freeze({ phone: 2.9, desktop: 3.4 });
export const FOLLOW_MIN_R = 1.4, FOLLOW_MAX_R = 9;
export const FOLLOW_PHI = 1.06, FOLLOW_MIN_PHI = 0.35, FOLLOW_MAX_PHI = 1.42;
/** The eye never dips below this above the ground under it: a follow camera must not swim. */
export const FOLLOW_MIN_LIFT = 0.22;

/** Where the camera is following: the body's shoulders, and which way it faces. */
export type FollowSubject = { x: number; y: number; z: number; yaw: number; speed: number };

export type FollowCameraOptions = {
  camera: PerspectiveCamera;
  composition: Composition;
  reduced: boolean;
  /** The island's height under a point, so the eye can be kept above the shore. */
  groundHeightAt?: (x: number, z: number) => number;
};

export type FollowCamera = {
  /** Where the body is now. Called every frame the body moves. */
  setSubject(subject: FollowSubject): void;
  /** Put the camera behind the body at once, with no easing — a cut. */
  snap(): void;
  /**
   * Start from where another camera left off. Entering follow mode is then a
   * *move* — the eye eases from the Court's diorama round to behind you as you
   * take your first steps — instead of a cut that throws the view away.
   */
  seed(pose: CourtPose): void;
  /** A drag of `dx`,`dy` pixels: right swings the view right, down tilts to look more from above. Phone swipe and desktop drag are the same call. */
  drag(dx: number, dy: number): void;
  /** Log-radius: positive pulls back, negative comes closer. A wheel notch is `deltaY × 0.0015`; a pinch is `−ln(scale)`. */
  zoom(delta: number): void;
  setComposition(composition: Composition): void;
  setReduced(reduced: boolean): void;
  /** Advance by `dt` seconds and write the camera. True while it is still catching up. */
  tick(dt: number): boolean;
  /** The pose the camera shows right now, in the same language as every other pose in the app. */
  pose(): CourtPose;
  /** Where the eye stands. */
  eye(): Vec3;
  /** How far the view has been swung from directly behind the body, in radians. */
  offset(): number;
  /**
   * **The heading a direction key is read against**, which is not always the
   * heading the camera shows.
   *
   * Reading W against a camera that is itself swinging round to behind the
   * body is a feedback loop: the body turns to face its travel, the camera
   * turns to face the body, "forward" turns with it, and you walk in a slow
   * circle. So while a direction is held the basis is *latched* — you walk a
   * straight line while the camera settles in behind you — and the moment the
   * key comes up it is the camera's heading again, so the next press is
   * relative to what you can actually see. A drag moves both: steering is
   * exactly what a drag is for.
   */
  basis(): number;
  /** Whether a direction is being held right now. Latches the basis above. */
  setSteering(on: boolean): void;
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export function createFollowCamera(options: FollowCameraOptions): FollowCamera {
  const { camera } = options;
  let composition = options.composition;
  let reduced = options.reduced;
  const ground = options.groundHeightAt ?? (() => Number.NEGATIVE_INFINITY);
  let subject: FollowSubject = { x: 0, y: 0, z: 0, yaw: 0, speed: 0 };
  /** The look-at point, eased after the body's shoulders. */
  let look: [number, number, number] = [0, 0, 0];
  /** How far the view is swung from behind the body, and where it is heading. */
  let offset = 0;
  let r = FOLLOW_DISTANCE[composition], goalR = r;
  let phi = FOLLOW_PHI, goalPhi = phi;
  /** The heading the eye actually shows, eased toward `behind + offset`. */
  let theta = Math.PI;
  /** The heading a direction key is read against, and whether it is latched. */
  let basis = theta, steering = false;

  const behind = () => wrap(subject.yaw + Math.PI + offset);

  function poseNow(): CourtPose {
    return { target: [look[0], look[1], look[2]] as Vec3, r, theta, phi };
  }

  function apply(): void {
    let [ex, ey, ez] = poseEye(poseNow());
    // Never below the land: on the shore's slope, and inside the lawn's hump,
    // a low tilt would otherwise put the eye under the grass.
    const floor = ground(ex, ez) + FOLLOW_MIN_LIFT;
    if (Number.isFinite(floor) && ey < floor) ey = floor;
    camera.position.set(ex, ey, ez);
    camera.up.set(0, 1, 0);
    camera.lookAt(look[0], look[1], look[2]);
  }

  function cut(): void {
    look = [subject.x, subject.y, subject.z];
    theta = behind();
    if (!steering) basis = theta;
    r = goalR; phi = goalPhi;
    apply();
  }

  cut();

  return {
    setSubject(next) { subject = next; },
    snap() { offset = 0; cut(); },
    seed(pose) {
      look = [pose.target[0], pose.target[1], pose.target[2]];
      theta = wrap(pose.theta);
      r = clamp(pose.r, FOLLOW_MIN_R, FOLLOW_MAX_R);
      phi = clamp(pose.phi, FOLLOW_MIN_PHI, FOLLOW_MAX_PHI);
      goalR = FOLLOW_DISTANCE[composition];
      goalPhi = FOLLOW_PHI;
      // Where this heading stands relative to "behind the body", so the first
      // frame does not swing: walking is what brings it round.
      offset = wrap(theta - wrap(subject.yaw + Math.PI));
      basis = theta;
      if (reduced) cut(); else apply();
    },
    drag(dx, dy) {
      if (!dx && !dy) return;
      // A drag steers: it turns the view and what "forward" means together.
      basis = wrap(basis - dx * FOLLOW_ORBIT_GAIN);
      offset = wrap(offset - dx * FOLLOW_ORBIT_GAIN);
      goalPhi = clamp(goalPhi - dy * FOLLOW_TILT_GAIN, FOLLOW_MIN_PHI, FOLLOW_MAX_PHI);
      if (reduced) { phi = goalPhi; theta = behind(); apply(); }
    },
    zoom(delta) {
      if (!delta || !Number.isFinite(delta)) return;
      goalR = clamp(goalR * Math.exp(delta), FOLLOW_MIN_R, FOLLOW_MAX_R);
      if (reduced) { r = goalR; apply(); }
    },
    setComposition(next) {
      if (next === composition) return;
      // Keep the person's own zoom: only a camera still at the default distance takes the new one.
      if (Math.abs(goalR - FOLLOW_DISTANCE[composition]) < 1e-6) goalR = FOLLOW_DISTANCE[next];
      composition = next;
    },
    setReduced(next) {
      reduced = next;
      if (reduced) cut();
    },
    tick(dt) {
      const step = Math.max(0, Math.min(dt, 0.25));
      if (reduced || !(step > 0)) { cut(); return false; }
      // While walking, a drag's offset gives itself back and the camera settles behind you again.
      if (offset !== 0 && subject.speed > RECENTRE_SPEED) {
        const give = Math.exp(-RECENTRE * step);
        offset = Math.abs(offset) < 1e-3 ? 0 : offset * give;
      }
      const lookK = 1 - Math.exp(-LOOK_EASE * step);
      look = [
        look[0] + (subject.x - look[0]) * lookK,
        look[1] + (subject.y - look[1]) * lookK,
        look[2] + (subject.z - look[2]) * lookK,
      ];
      const k = 1 - Math.exp(-FOLLOW_EASE * step);
      const want = behind();
      theta = wrap(theta + wrap(want - theta) * k);
      // Latched while a direction is held; the camera's own heading otherwise.
      if (!steering) basis = theta;
      r += (goalR - r) * k;
      phi += (goalPhi - phi) * k;
      apply();
      const settled = Math.abs(wrap(want - theta)) < 1e-3
        && Math.abs(goalR - r) < 1e-3 && Math.abs(goalPhi - phi) < 1e-3
        && Math.hypot(subject.x - look[0], subject.y - look[1], subject.z - look[2]) < 1e-3;
      return !settled;
    },
    setSteering(on) { steering = on; if (!on) basis = theta; },
    pose: poseNow,
    eye: () => poseEye(poseNow()),
    offset: () => offset,
    basis: () => basis,
  };
}
