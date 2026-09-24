import type { PerspectiveCamera } from "three";
import { runFraction } from "../body/bodyModel.ts";
import { holdPoseInRoom, poseFrom, realizePose, type Composition, type CourtPose, type RoomHold, type Vec3 } from "./poses.ts";
import { clearFraction, createPullIn } from "./obstruction.ts";

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
 * - A drag turns the view. Manual W A S D keeps that view fixed while the
 *   character faces any of the eight directions; a selected walking route
 *   may still settle the camera behind its travel.
 * - A desktop drag is exactly a phone swipe: the same `ORBIT_GAIN` per pixel
 *   in both, no modifier, no second gesture. A standing product rule.
 * - Wheel and pinch both move in log-radius, so a notch feels the same close
 *   in and far out — the Court's own rule, kept.
 *
 * ## Speed
 *
 * A camera that sits at the same distance whatever you are doing makes a
 * sprint look like a walk played fast. So above a walk — and only above it,
 * `runFraction` is zero at and below `WALK_SPEED` — three things happen
 * together, all of them eased and all of them given back the moment you stop:
 *
 * - the eye **dollies out** by up to `FOLLOW_SPRINT_DOLLY`, so there is road
 *   ahead of you rather than the back of your own head;
 * - the lens **widens** by up to `FOLLOW_SPRINT_FOV` degrees, which is what
 *   actually makes the island whip past the edges of the frame;
 * - the look-at point **lags**, because its ease drops by
 *   `FOLLOW_SPRINT_LAG`, so the body pulls slightly ahead of the frame's
 *   centre instead of being nailed to it.
 *
 * Indoors none of it applies. A room is six units across and its own hold
 * (`setHold`) is the last word on where the eye may be; a camera shoving
 * itself against that clamp every time you jog across the Library is worse
 * than a camera that simply stands still indoors.
 *
 * Reduced motion: every easing becomes a cut, and the speed dolly, the widen
 * and the lag are all off. The body still walks (that is the app); the camera
 * stops swinging after it.
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

/* ── The open world (Hearth Mountain v2, C2 / C12) ─────────────────────────
 * The walking camera outdoors is an open-world camera: it stands 4.5 behind
 * (4.0 on a phone), about 12° above the look-at point, and looks at a point
 * 1.2 above the feet — so the top of the frame is well above the horizon and
 * the mountain, the dam and the road ahead are in the shot. Rooms keep their
 * close, higher pitch (`followInRoom`), selected by the place's indoor flag.
 * ────────────────────────────────────────────────────────────────────────── */
/** How far behind the camera stands outdoors, per composition. */
export const FOLLOW_DISTANCE: Readonly<Record<Composition, number>> = Object.freeze({ phone: 4.0, desktop: 4.5 });
export const FOLLOW_MIN_R = 1.4, FOLLOW_MAX_R = 11;
/** 12° down (φ is from vertical); a hand may tilt from steeply down to 17° above the horizon (the eye is lifted over the land, the direction kept). */
export const FOLLOW_PHI = Math.PI / 2 - (12 * Math.PI) / 180, FOLLOW_MIN_PHI = 0.35, FOLLOW_MAX_PHI = Math.PI / 2 + 0.3;
/** Outdoors the camera looks at a point this far above the feet. */
export const FOLLOW_LOOK_HEIGHT = 1.2;
/** The eye never dips below this above the ground under it: a follow camera must not swim. */
export const FOLLOW_MIN_LIFT = 0.22;
/**
 * The look-at point's height follows the body more slowly than its ground
 * position (per second), so a switchback's ups and downs do not bob the view.
 * Outdoors only; a room's floor is flat.
 */
export const FOLLOW_Y_EASE = 3.2;
/**
 * Walking recentres the view gently behind the body — on a tapped route at
 * `RECENTRE`, under the keys at `RECENTRE_KEYS` and only while the body is
 * heading into the view (within `RECENTRE_CONE` of straight ahead), so W with
 * A or D steers round a bend but a plain sidestep does not start circling.
 * A hand on the view (a drag, Q/E) holds all of it off for `RECENTRE_HOLD`.
 */
export const RECENTRE_KEYS = 0.55, RECENTRE_CONE = 1.05, RECENTRE_HOLD = 1.8;
/** How quickly a change of lens is eased in (per second): a mode change blends, never cuts. */
export const FOV_EASE = 4;
/** A Look pose whose target is further than this from the body is not a place to walk from: Walk starts behind the body instead. */
export const SEED_REACH = 10;

/* ── Speed ─────────────────────────────────────────────────────────────── */
/** How far the eye pulls back at a full run, in units, on top of wherever it was. */
export const FOLLOW_SPRINT_DOLLY = 0.62;
/** How much wider the lens opens at a full run, in degrees. */
export const FOLLOW_SPRINT_FOV = 5.5;
/** How much of the look-at ease a full run takes away: the lag that makes the world whip past. */
export const FOLLOW_SPRINT_LAG = 3.6;
/**
 * How much slower the look-at point climbs than it follows along the ground,
 * while the body is in the air. A camera that tracked a jump one-for-one
 * would show a body that never left the middle of the screen; at a third of
 * the rate the body rises in frame and settles back as it lands.
 */
export const FOLLOW_AIR_LAG = 0.33;
/** How quickly the dolly opens out and comes back in (per second). Out eagerly, back unhurried. */
export const SPRINT_OUT = 3.2, SPRINT_IN = 2.1;

/* ── Indoors (walk-everywhere) ──────────────────────────────────────────────
 * A room is about six units across. Three and a half units of follow distance
 * puts the eye a foot outside the shell, and the shell has one-sided walls and
 * an open ceiling — so the view from there is a doll's box, not a room.
 *
 * Two things fix it together, and they are different jobs. **This** is the one
 * that keeps the camera comfortable: indoors the eye stands closer and a
 * little higher, so it clears the furniture and sees over the near wall
 * without being shoved there. The other is the room's own hold
 * (`setHold`), which is a hard containment and the last word — but a camera
 * that is *always* against its clamp feels stuck, so the goal distance comes
 * in to meet it rather than leaving the clamp to do all the work.
 * ────────────────────────────────────────────────────────────────────────── */
/** How much of the room's own smaller half-width the eye stands back by. */
export const FOLLOW_ROOM_SHARE = 0.85;
/** And never nearer than this, however small the room: closer and you are inside your own coat. */
export const FOLLOW_ROOM_MIN_R = 1.6;
/** Indoors the eye stands a little more above: `phi` is measured from vertical, so a smaller number looks down more. */
export const FOLLOW_ROOM_PHI = 0.92;

/**
 * Where the eye stands in a room whose smaller half-width is `reach`. Pure,
 * so a test can walk every place's own bounds through it.
 */
/** Indoors the eye never stands further back than the rooms were tuned for, however large the open world's distance grows. */
export const FOLLOW_ROOM_MAX_R: Readonly<Record<Composition, number>> = Object.freeze({ phone: 2.9, desktop: 3.4 });
export function followInRoom(reach: number, composition: Composition): { r: number; phi: number } {
  const open = Math.min(FOLLOW_DISTANCE[composition], FOLLOW_ROOM_MAX_R[composition]);
  const r = clamp(reach * FOLLOW_ROOM_SHARE, Math.min(FOLLOW_ROOM_MIN_R, open), open);
  return { r, phi: FOLLOW_ROOM_PHI };
}

/** Where the camera is following: the body's shoulders, and which way it faces. */
export type FollowSubject = {
  x: number; y: number; z: number; yaw: number; speed: number;
  /**
   * How far off the ground the body is, in units. The eye keeps its own
   * height and lets the body rise *within* the frame rather than riding up
   * with it — which is the difference between watching a jump and being
   * carried by one. Left out, it is nothing, and the camera is what it was.
   */
  air?: number;
};

export type FollowCameraOptions = {
  camera: PerspectiveCamera;
  composition: Composition;
  reduced: boolean;
  /** The island's height under a point, so the eye can be kept above the shore. */
  groundHeightAt?: (x: number, z: number) => number;
  blocked?: (x:number,y:number,z:number)=>boolean;
  /** The lens this place is shot on, in degrees. The sprint widen is measured from it. */
  fov?: number;
};

export type FollowCamera = {
  /** Where the body is now. Called every frame the body moves. */
  setSubject(subject: FollowSubject): void;
  /**
   * The room the eye may not leave (walk-everywhere), through the very same
   * `holdPoseInRoom` every named pose and every hand on the Look camera
   * already passes through. `null` is the Court: open sky, held by nothing.
   *
   * It is applied to the pose the camera *shows*, not to the pose it is
   * easing toward, so the eye is inside the walls on every frame of the ease
   * and not only once it has settled.
   */
  setHold(hold: RoomHold | null): void;
  /** How far the eye stands back by default in the place that is standing, and how high. */
  setPlan(plan: { r: number; phi: number } | null): void;
  /**
   * The lens the place is shot on. The sprint widen is added to this and
   * never replaces it, and handing the view back leaves the camera on exactly
   * this number.
   */
  setFov(fov: number): void;
  /** Put the camera behind the body at once, with no easing — a cut. `theta`, when given, is the heading to stand on instead of straight behind. */
  snap(theta?: number): void;
  /**
   * Start from where another camera left off. Entering follow mode is then a
   * *move* — the eye eases from the Court's diorama round to behind you as you
   * take your first steps — instead of a cut that throws the view away.
   */
  seed(pose: CourtPose): void;
  /**
   * The lens the camera was showing when this one took over: the base lens
   * eases from here to its own, so a hand-off never cuts the field of view.
   */
  lensFrom(fov: number): void;
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
  /** Where the eye is really drawn from (over the land, in front of anything solid). */
  eye(): Vec3;
  /** The pose really drawn: the drawn eye about the drawn look-at point. A hand-off to Look starts here. */
  shown(): CourtPose;
  /** How far the view has been swung from directly behind the body, in radians. */
  offset(): number;
  /** The visible camera heading used for manual WASD movement. */
  basis(): number;
  /** Manual keys keep the view fixed; a selected walking route may follow the body's heading. */
  setSteering(on: boolean, followingPath?: boolean): void;
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
  let plan: { r: number; phi: number } | null = null;
  const planR = () => plan?.r ?? FOLLOW_DISTANCE[composition];
  const planPhi = () => plan?.phi ?? FOLLOW_PHI;
  let r = planR(), goalR = r;
  let phi = planPhi(), goalPhi = phi;
  /** The room the eye may not leave. */
  let hold: RoomHold | null = null;
  /** The lens, and how far out of it the sprint has opened. */
  let baseFov = options.fov ?? camera.fov;
  /** How far the speed dolly has opened, in units, and the sprint it is chasing. */
  let dolly = 0;
  /** Nothing of the sprint applies indoors, where the room's own hold is the last word. */
  const sprint = (): number => (hold || reduced ? 0 : runFraction(subject.speed));
  /** The heading the eye actually shows, eased toward `behind + offset`. */
  let theta = Math.PI;
  /** The heading a direction key is read against, and whether it is latched. */
  let basis = theta, followingPath = false, steering = false;
  /** Seconds since a hand last turned the view (a drag or the orbit keys). */
  let sinceOrbit = Number.POSITIVE_INFINITY;
  /** The lens the place asks for, and the one shown while a change is eased in. */
  let goalFov = baseFov;
  /** Fast in, slow out, for whatever stands between the body and the eye. */
  const pull = createPullIn();
  let drawnEye: Vec3 = [0, 0, 0], drawnLook: Vec3 = [0, 0, 0];

  const behind = () => wrap(subject.yaw + Math.PI + offset);

  function poseNow(): CourtPose {
    // The dolly is added before the hold, never after: the room still has the
    // last word on where the eye may be, exactly as it always did.
    const reach = clamp(r + dolly, FOLLOW_MIN_R, FOLLOW_MAX_R + FOLLOW_SPRINT_DOLLY);
    return holdPoseInRoom({ target: [look[0], look[1], look[2]] as Vec3, r: reach, theta, phi }, hold);
  }

  /** Open the lens by however far the sprint has opened the dolly, and no further. */
  function lens(): void {
    // The sprint widen is indoor-proofed by the dolly (which is zero in a room).
    const widen = FOLLOW_SPRINT_DOLLY > 0 ? (dolly / FOLLOW_SPRINT_DOLLY) * FOLLOW_SPRINT_FOV : 0;
    const wanted = baseFov + widen;
    if (Math.abs(camera.fov - wanted) < 1e-3) return;
    camera.fov = wanted;
    camera.updateProjectionMatrix();
  }

  function apply(dt = 0): void {
    lens();
    const shown = poseNow();
    // Never below the land, and the direction kept: eye and look-at rise
    // together, so a hand that tilted up to see the dam still sees it.
    const drawn = realizePose(shown, (x, z) => ground(x, z), FOLLOW_MIN_LIFT);
    let [ex, ey, ez] = drawn.eye;
    const look = drawn.look;
    if (options.blocked && !hold) {
      // One line test, terrain and every camera solid; pulled in at once, given back slowly.
      const open = clearFraction(look, drawn.eye, options.blocked, 0.2, 40);
      const share = pull.update(open, dt, reduced);
      if (share < 1) { ex = look[0] + (ex - look[0]) * share; ey = look[1] + (ey - look[1]) * share; ez = look[2] + (ez - look[2]) * share; }
    } else pull.reset();
    // Pulled in over a slope or not, the eye is never under the land.
    { const floor = ground(ex, ez) + FOLLOW_MIN_LIFT * 0.5; if (Number.isFinite(floor) && ey < floor) ey = floor; }
    drawnEye = [ex, ey, ez]; drawnLook = look;
    camera.position.set(ex, ey, ez);
    camera.up.set(0, 1, 0);
    camera.lookAt(look[0], look[1], look[2]);
  }

  function cut(resetHeading = false): void {
    look = [subject.x, subject.y, subject.z];
    if (resetHeading || followingPath) theta = behind();
    else offset = wrap(theta - wrap(subject.yaw + Math.PI));
    basis = theta;
    r = goalR; phi = goalPhi;
    dolly = sprint() * FOLLOW_SPRINT_DOLLY;
    baseFov = goalFov;
    apply();
  }

  cut(true);

  return {
    setSubject(next) { subject = next; },
    setHold(next) {
      hold = next;
      // Walking into a room with the sprint dolly out would shove the eye
      // straight into the clamp: give it back on the threshold.
      if (hold) dolly = 0;
      apply();
    },
    setFov(next) {
      if (!(next > 0) || !Number.isFinite(next) || Math.abs(next - goalFov) < 1e-4) return;
      goalFov = next;
      // Reduced motion cuts the lens; otherwise `tick` eases it in.
      if (reduced) { baseFov = next; lens(); }
    },
    lensFrom(fov) {
      if (!(fov > 0) || !Number.isFinite(fov) || reduced) return;
      baseFov = fov;
      lens();
    },
    setPlan(next) {
      const wasDefault = Math.abs(goalR - planR()) < 1e-6, wasLevel = Math.abs(goalPhi - planPhi()) < 1e-6;
      plan = next;
      // Keep the person's own zoom and tilt; a camera still at the place's own default takes the new place's.
      if (wasDefault) goalR = planR();
      if (wasLevel) goalPhi = planPhi();
    },
    snap(heading) {
      offset = 0;
      if (heading !== undefined && Number.isFinite(heading)) {
        theta = wrap(heading); offset = wrap(theta - wrap(subject.yaw + Math.PI));
        const path = followingPath; followingPath = false; cut(false); followingPath = path;
      } else cut(true);
      pull.reset();
    },
    seed(pose) {
      // A Look pose aimed somewhere else entirely (the town, from the top of
      // the mountain) is no place to start walking from: stand behind the body
      // on the heading that view had, so the keys still mean what they meant.
      const gap = Math.hypot(pose.target[0] - subject.x, pose.target[2] - subject.z);
      if (!(gap <= SEED_REACH)) {
        theta = wrap(pose.theta); offset = wrap(theta - wrap(subject.yaw + Math.PI));
        goalR = planR(); goalPhi = planPhi();
        const path = followingPath; followingPath = false; cut(false); followingPath = path;
        pull.reset();
        return;
      }
      look = [pose.target[0], pose.target[1], pose.target[2]];
      theta = wrap(pose.theta);
      r = clamp(pose.r, FOLLOW_MIN_R, FOLLOW_MAX_R);
      phi = clamp(pose.phi, FOLLOW_MIN_PHI, FOLLOW_MAX_PHI);
      goalR = planR();
      goalPhi = planPhi();
      // Where this heading stands relative to "behind the body", so the first
      // frame does not swing: walking is what brings it round.
      offset = wrap(theta - wrap(subject.yaw + Math.PI));
      basis = theta;
      if (reduced) cut(); else apply();
    },
    drag(dx, dy) {
      if (!dx && !dy) return;
      sinceOrbit = 0;
      // A drag steers: the visible view and the WASD basis turn together.
      theta = wrap(theta - dx * FOLLOW_ORBIT_GAIN);
      basis = theta;
      offset = wrap(theta - wrap(subject.yaw + Math.PI));
      goalPhi = clamp(goalPhi - dy * FOLLOW_TILT_GAIN, FOLLOW_MIN_PHI, FOLLOW_MAX_PHI);
      if (reduced) { phi = goalPhi; apply(); }
      else apply();
    },
    zoom(delta) {
      if (!delta || !Number.isFinite(delta)) return;
      goalR = clamp(goalR * Math.exp(delta), FOLLOW_MIN_R, FOLLOW_MAX_R);
      if (reduced) { r = goalR; apply(); }
    },
    setComposition(next) {
      if (next === composition) return;
      // Keep the person's own zoom: only a camera still at the default distance takes the new one.
      const wasDefault = Math.abs(goalR - planR()) < 1e-6;
      composition = next;
      if (wasDefault) goalR = planR();
    },
    setReduced(next) {
      reduced = next;
      if (reduced) cut();
    },
    tick(dt) {
      const step = Math.max(0, Math.min(dt, 0.25));
      if (reduced || !(step > 0)) { cut(); return false; }
      sinceOrbit += step;
      // A change of lens (a mode change, a phone turned) eases in.
      const fovK = 1 - Math.exp(-FOV_EASE * step);
      if (Math.abs(goalFov - baseFov) > 1e-3) baseFov += (goalFov - baseFov) * fovK; else baseFov = goalFov;
      // A route may choose its camera heading. Manual keys and the idle view
      // keep what the person can see aligned with the direction the keys use.
      if (followingPath && offset !== 0 && subject.speed > RECENTRE_SPEED) {
        const give = Math.exp(-RECENTRE * step);
        offset = Math.abs(offset) < 1e-3 ? 0 : offset * give;
      }
      // How far into a run the camera is opening out for: the dolly eases out
      // eagerly and comes back in unhurried, so pulling up reads as a settle.
      const want = sprint() * FOLLOW_SPRINT_DOLLY;
      const sprintK = 1 - Math.exp(-(want > dolly ? SPRINT_OUT : SPRINT_IN) * step);
      dolly += (want - dolly) * sprintK;
      if (Math.abs(dolly - want) < 1e-4) dolly = want;
      // The look-at point lags with speed: the body pulls a little ahead of
      // the centre of the frame and the island whips past the edges.
      const lookK = 1 - Math.exp(-Math.max(1, LOOK_EASE - FOLLOW_SPRINT_LAG * sprint()) * step);
      // The vertical is eased separately: slower in the air (a jump rises in
      // the frame) and, outdoors, a little slower always (a switchback's rise
      // and fall does not bob the view).
      const airborne = (subject.air ?? 0) > 1e-4;
      const liftK = airborne && !reduced ? 1 - Math.exp(-Math.max(1, LOOK_EASE * FOLLOW_AIR_LAG) * step)
        : hold ? lookK : 1 - Math.exp(-FOLLOW_Y_EASE * step);
      look = [
        look[0] + (subject.x - look[0]) * lookK,
        look[1] + (subject.y - look[1]) * liftK,
        look[2] + (subject.z - look[2]) * lookK,
      ];
      const k = 1 - Math.exp(-FOLLOW_EASE * step);
      const heading = behind();
      if (followingPath) theta = wrap(theta + wrap(heading - theta) * k);
      else {
        // Under the keys: a gentle recentre while the body heads into the
        // view, held off after a hand turned it. The keys' basis is the view,
        // so both turn together and W always means "into the picture".
        const straight = wrap(subject.yaw + Math.PI);
        const off = wrap(straight - theta);
        if (steering && !hold && subject.speed > RECENTRE_SPEED && sinceOrbit > RECENTRE_HOLD && Math.abs(off) < RECENTRE_CONE) {
          theta = wrap(theta + off * (1 - Math.exp(-RECENTRE_KEYS * step)));
        }
        offset = wrap(theta - straight);
      }
      basis = theta;
      r += (goalR - r) * k;
      phi += (goalPhi - phi) * k;
      const pulled = pull.value();
      apply(step);
      // A pull-in still giving the eye back is motion; an eye held in front of a wall is at rest.
      const settled = (!followingPath || Math.abs(wrap(heading - theta)) < 1e-3)
        && Math.abs(goalR - r) < 1e-3 && Math.abs(goalPhi - phi) < 1e-3
        && dolly === want && baseFov === goalFov && Math.abs(pull.value() - pulled) < 1e-4
        && Math.hypot(subject.x - look[0], subject.y - look[1], subject.z - look[2]) < 1e-3;
      return !settled;
    },
    setSteering(on, path = false) { steering = on; followingPath = !on && path; basis = theta; },
    pose: poseNow,
    eye: () => drawnEye,
    shown: () => poseFrom(drawnEye, drawnLook),
    offset: () => offset,
    basis: () => basis,
  };
}
