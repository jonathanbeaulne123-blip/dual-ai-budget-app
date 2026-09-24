import type { PerspectiveCamera } from "three";
import { clampRoamCam, panDelta, wrapAngle, type RoamBounds, type RoamCam } from "../../path/world/roamCamera.ts";
import { clearFraction, createPullIn, type Blocked } from "./obstruction.ts";
import { FLIGHT_THRESHOLD, flightAt, planFlight, type FlightPlan } from "./flight.ts";
import {
  COURT_BOUNDS,
  holdPoseInRoom,
  lookPhiLimit,
  realizePose,
  type RoomHold,
  COURT_FOV,
  clampCourtPose,
  courtPose,
  poseEye,
  samePose,
  type Composition,
  type CourtAnchor,
  type CourtMode,
  type CourtPose,
  type Vec3,
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
 * - **The close hold** — `close(pose)` is the third hold (W7 a), a step
 *   beyond "object": the one thing this place is about, held until the same
 *   gesture lets it go. `close(null)` leaves it and puts the camera back
 *   where it stood before, so the hold can never strand you. Any explicit
 *   destination — `go`, `goTo`, `restore` — drops it, because asking to be
 *   somewhere else is the plainest way of saying you are done looking.
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
  /** Vertical field of view in degrees; defaults to `COURT_FOV`. A phone may take a wider field. */
  fov?: number;
  /**
   * Hearth Mountain v2 (C8): the open world under the Look camera. With it,
   * every drawn pose stands over the land (`realizePose`), the eye is pulled
   * in front of anything solid between it and its target, the tilt limit is
   * horizon-aware (`lookPhiLimit`), and long moves fly over the terrain.
   * A room's hold switches all of it off: a room is its own world.
   */
  terrain?: LookTerrain | null;
};
/** What the Look camera needs to know about the open world. */
export type LookTerrain = { ground: (x: number, z: number) => number; blocked?: Blocked };
/** The eye stands at least this far over the land. */
export const LOOK_CLEARANCE = 0.9;

/** A point in the Court, for a close look at something `poses.ts` has no name for (the slip, Hercules). */
export type CourtLook = { target: Vec3; r?: number; theta?: number; phi?: number };

export type CourtCamera = {
  /** Fly (or, with reduced motion, cut) to the pose for a mode. `anchor` only matters for `object` (default: the Queen). */
  go(mode: CourtMode, anchor?: CourtAnchor): void;
  /** Fly to a close look at any point: an "object" pose for a thing without a named anchor. */
  goTo(look: CourtLook): void;
  /**
   * The close hold: `close(pose)` frames that one pose and holds it;
   * `close(null)` lets it go and returns to the pose held before it. Both
   * pass through the room's hold like everything else.
   */
  close(pose: CourtPose | null): void;
  /** Is the close hold on? */
  closed(): boolean;
  /** A return record's eye position: the camera is set there at once (a cut), looking at its current target. */
  restore(eye: Vec3): void;
  /**
   * A hand-off (C3): the camera stands at `pose` at once and stays there —
   * the goal is the pose, nothing flies. Used when another camera gives the
   * view back (Walk → Look on a tool, the guide, a pause): the view you had is
   * the view you keep, re-aimed at whatever that camera was looking at.
   */
  hold(pose: CourtPose): void;
  /** The open world under the camera, or null in a room. */
  setTerrain(terrain: LookTerrain | null): void;
  /** Where the eye is really drawn from, and what it really looks at (after terrain and obstruction). */
  eye(): Vec3;
  look(): Vec3;
  /** Is a long move flying right now? */
  flying(): boolean;
  /** Change the vertical field of view (degrees); the pose for the current mode is recomputed. */
  setFov(fov: number): void;
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
  /** The standing room's hold on the camera (`holdPoseInRoom`); null in the open Court. Applied to every pose from then on, the current one included. */
  setHold(hold: RoomHold | null): void;
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

/** Hold a pose inside the Court's bounds through the island's own clamp, measured from `centre`. */
export function clampPose(pose: CourtPose, centre: Vec3 = [0, 0, 0]): CourtPose {
  const local = toRoam(pose);
  local.tx -= centre[0]; local.tz -= centre[2];
  const held = clampRoamCam(local, ROAM_COURT_BOUNDS);
  held.tx += centre[0]; held.tz += centre[2];
  return fromRoam(held, pose.target[1]);
}

const defaultAspect = (composition: Composition) => (composition === "phone" ? 390 / 844 : 1440 / 900);

export function createCourtCamera(options: CourtCameraOptions): CourtCamera {
  const { camera } = options;
  let composition = options.composition;
  let reduced = options.reduced;
  let aspect = options.aspect ?? defaultAspect(composition);
  let fov = options.fov ?? COURT_FOV;
  let mode: CourtMode = "court";
  let anchor: CourtAnchor | undefined;
  let look: CourtLook | null = null;
  /** The close hold's pose while it is on, and the pose to return to when it is let go. */
  let held: CourtPose | null = null;
  /**
   * Where the camera was when the close hold went on. The **pose** matters as
   * much as the mode: a camera a hand has dragged, zoomed or restored from a
   * return record has no named mode to go back to, and coming out of close
   * mode into the room's establishing pose would quietly throw that view away.
   */
  let before: { mode: CourtMode; anchor: CourtAnchor | undefined; look: CourtLook | null; pose: CourtPose } | null = null;
  /** The standing room's hold on the camera; null in the open Court. */
  let hold: RoomHold | null = null;
  /**
   * Where the Court's own radius bounds are measured from: the origin in the
   * open Court, the standing room's centre when the room stands out on the
   * island (`scene/place.ts` placements).
   */
  const centre = (): Vec3 => (hold
    ? [(hold.target.min[0] + hold.target.max[0]) / 2, 0, (hold.target.min[2] + hold.target.max[2]) / 2]
    : [0, 0, 0]);
  let terrain: LookTerrain | null = options.terrain ?? null;
  /** The open world applies only where no room holds the camera. */
  const open = (): LookTerrain | null => (hold ? null : terrain);
  const horizon = (pose: CourtPose): CourtPose => {
    const land = open();
    // No land under the camera (a room holds it, or nothing was told): the static bounds are the rule.
    if (!land) return pose;
    const g = land.ground(pose.target[0], pose.target[2]);
    const limit = lookPhiLimit(pose.r, Number.isFinite(g) ? pose.target[1] - g : 0);
    return pose.phi > limit ? { ...pose, phi: limit } : pose;
  };
  const legal = (pose: CourtPose): CourtPose => holdPoseInRoom(horizon(clampPose(clampCourtPose(pose, centre()), centre())), hold);
  let goal: CourtPose = legal(courtPose(mode, anchor, composition, aspect, fov));
  let current: CourtPose = goal;

  /** The flight in progress, and how far into it we are. */
  let flight: { plan: FlightPlan; t: number } | null = null;
  /** Fast in, slow out: how much of its distance the eye may stand at. */
  const pull = createPullIn();
  let drawnEye: Vec3 = poseEye(current), drawnLook: Vec3 = current.target;
  function apply(dt = 0): void {
    const land = open();
    let eye: Vec3, look: Vec3;
    if (flight && !reduced) {
      const f = flightAt(flight.plan, flight.t);
      eye = f.eye; look = f.look;
      if (land) { const floor = land.ground(eye[0], eye[2]) + LOOK_CLEARANCE; if (eye[1] < floor) { const k = floor - eye[1]; eye = [eye[0], eye[1] + k, eye[2]]; look = [look[0], look[1] + k, look[2]]; } }
    } else if (land) {
      const drawn = realizePose(current, land.ground, LOOK_CLEARANCE);
      eye = drawn.eye; look = drawn.look;
    } else { eye = poseEye(current); look = current.target; }
    if (land?.blocked) {
      const share = pull.update(clearFraction(look, eye, land.blocked, Math.max(0.25, current.r / 40)), dt, reduced);
      if (share < 1) eye = [look[0] + (eye[0] - look[0]) * share, look[1] + (eye[1] - look[1]) * share, look[2] + (eye[2] - look[2]) * share];
    } else pull.reset();
    drawnEye = eye; drawnLook = look;
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(look[0], look[1], look[2]);
  }
  /** Start flying from what is drawn to `goal` if it is a long way; otherwise the house's ease does it. */
  function launch(): void {
    if (reduced) { flight = null; return; }
    const from = current, to = goal;
    const a = poseEye(from), b = poseEye(to);
    const travel = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) + Math.hypot(from.target[0] - to.target[0], from.target[1] - to.target[1], from.target[2] - to.target[2]) * 0.25;
    flight = travel > FLIGHT_THRESHOLD ? { plan: planFlight(from, to, open()?.ground), t: 0 } : null;
  }

  function retarget(fly = true): void {
    goal = legal(held ? held : look
      ? { target: look.target, r: look.r ?? 3.2, theta: look.theta ?? Math.atan2(look.target[0], look.target[2] + 6) * 0.6, phi: look.phi ?? (composition === "phone" ? 1.0 : 1.05) }
      : courtPose(mode, anchor, composition, aspect, fov));
    if (reduced) { flight = null; current = goal; apply(); return; }
    if (fly) launch(); else flight = null;
  }

  /** A hand on the camera moves it directly: the goal follows so nothing eases back afterwards. */
  function take(next: CourtPose): void {
    // A hand during a flight takes the camera where the flight has it
    // (`current` is the flight's own pose on every frame of it).
    flight = null;
    current = legal(next);
    goal = current;
    apply();
  }

  const settled = () => !flight && (current === goal || samePose(current, goal, 1e-9));

  apply();

  return {
    go(nextMode, nextAnchor) {
      mode = nextMode;
      anchor = nextMode === "object" ? nextAnchor ?? "queen" : undefined;
      look = null;
      held = null; before = null;
      retarget();
    },
    goTo(next) {
      mode = "object"; anchor = undefined; look = next;
      held = null; before = null;
      retarget();
    },
    close(next) {
      if (next) {
        // Remember where we stood the first time in, so leaving puts it back
        // however many times the hold is re-aimed while it is on.
        if (!held) before = { mode, anchor, look, pose: goal };
        held = next;
      } else if (before) {
        held = null;
        mode = before.mode; anchor = before.anchor; look = before.look;
        const pose = before.pose;
        before = null;
        // Back to the exact view, not merely the mode: a hand-held camera is
        // a place too, and the same gesture that came close has to return it.
        goal = legal(pose);
        if (reduced) { current = goal; apply(); } else launch();
        return;
      } else {
        held = null;
      }
      retarget();
    },
    closed: () => held !== null,
    hold(pose) {
      held = null; before = null; flight = null;
      mode = "object"; anchor = undefined;
      look = { target: [pose.target[0], pose.target[1], pose.target[2]], r: pose.r, theta: pose.theta, phi: pose.phi };
      current = legal(pose);
      goal = current;
      pull.reset();
      apply();
    },
    setTerrain(next) { terrain = next; goal = legal(goal); current = legal(current); apply(); },
    eye: () => drawnEye,
    look: () => drawnLook,
    flying: () => flight !== null,
    restore(eye) {
      held = null; before = null; flight = null;
      const [tx, ty, tz] = goal.target;
      const dx = eye[0] - tx, dy = eye[1] - ty, dz = eye[2] - tz;
      const r = Math.hypot(dx, dy, dz);
      if (!Number.isFinite(r) || r < 1e-3) return;
      take({ target: [tx, ty, tz], r, theta: Math.atan2(dx, dz), phi: Math.acos(Math.max(-1, Math.min(1, dy / r))) });
    },
    setFov(next) {
      if (!(next > 0) || !Number.isFinite(next) || Math.abs(next - fov) < 1e-4) return;
      fov = next;
      retarget(false);
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
      retarget(false);
    },
    setAspect(next) {
      if (!(next > 0) || !Number.isFinite(next) || Math.abs(next - aspect) < 1e-4) return;
      aspect = next;
      retarget(false);
    },
    setHold(next) {
      hold = next;
      // The hold changed under the camera (a journey ended in another room):
      // both the goal and the standing pose must already obey it.
      goal = legal(goal);
      current = legal(current);
      if (flight) flight = { plan: planFlight(current, goal, open()?.ground), t: 0 };
      apply();
    },
    setReduced(next) {
      reduced = next;
      if (reduced && !settled()) { flight = null; current = goal; apply(); }
    },
    tick(dt) {
      if (settled()) {
        // Still settled, but the slow push-out of an obstruction may be giving the eye back.
        if (open()?.blocked && pull.value() < 1 && dt > 0) { apply(dt); return true; }
        return false;
      }
      if (reduced || !(dt > 0)) {
        if (reduced) { flight = null; current = goal; apply(); }
        return !reduced;
      }
      if (flight) {
        flight.t += Math.min(dt, 0.25);
        const f = flightAt(flight.plan, flight.t);
        if (f.done) { flight = null; current = goal; }
        else current = hold ? holdPoseInRoom(f.pose, hold) : f.pose;
        apply(dt);
        return current !== goal || flight !== null;
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
      // Two legal orbit endpoints do not guarantee that their spherical ease
      // stays inside a rotated room. Contain every visible intermediate pose.
      current = remaining < REST ? goal : legal(next);
      apply(dt);
      return current !== goal;
    },
    pose: () => current,
    goal: () => goal,
    mode: () => mode,
    anchor: () => anchor,
  };
}
