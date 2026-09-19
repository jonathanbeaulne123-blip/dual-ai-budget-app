/**
 * Free roam camera maths (D-286).
 *
 * The open world's camera is normally *latched*: it follows the two of you and flies where a focus asks. Free roam
 * unlatches it — the camera becomes yours, and this module is the part of that which can be reasoned about without a
 * canvas: the bounds it may not leave, how a key or a drag becomes motion, and how that motion decays.
 *
 * Everything here is pure. Nothing reads the DOM, three.js, time or money.
 *
 * ## Frame-rate independence
 *
 * Each axis is integrated with the *exact* solution of `v' = -k (v - target)`, so stepping one second in one step and
 * in sixty steps land in the same place (to floating-point noise). Never `v *= 0.9` per frame.
 */

/** Where the camera looks from: a target on the ground (`tx`,`tz`), a distance `r`, a heading `theta` and a tilt `phi` from vertical. */
export type RoamCam = { tx: number; tz: number; r: number; theta: number; phi: number };

/** How the camera is currently moving. `vr` is in log-radius per second (zoom is multiplicative). */
export type RoamMotion = { vx: number; vz: number; vr: number; vTheta: number; vPhi: number };

/** What the person is asking for this frame. Each axis is -1…1; `boost` is Shift. */
export type RoamInput = {
  /** Ahead (+1) / back (-1), relative to where the camera looks. */
  forward: number;
  /** Right (+1) / left (-1), relative to where the camera looks. */
  strafe: number;
  /** Turn right (+1) / left (-1). */
  turn: number;
  /** Rise (+1) / fall (-1): the camera climbs over the land or drops toward the horizon. */
  rise: number;
  boost: boolean;
};

/** How far the camera may roam, and how close or far it may sit. */
export type RoamBounds = { radius: number; minR: number; maxR: number; minPhi: number; maxPhi: number };

export const ZERO_INPUT: Readonly<RoamInput> = Object.freeze({ forward: 0, strafe: 0, turn: 0, rise: 0, boost: false });
export const ZERO_MOTION: Readonly<RoamMotion> = Object.freeze({ vx: 0, vz: 0, vr: 0, vTheta: 0, vPhi: 0 });

/** Closest the free camera may sit to its target, and how far out it may pull back beyond the latched cap. */
export const ROAM_MIN_R = 11;
export const ROAM_MAX_R_LIFT = 1.35;
/** A free camera may tilt flatter (a horizon view) and steeper (almost overhead) than a latched one. */
export const ROAM_MIN_PHI = 0.2;
export const ROAM_MAX_PHI = 1.44;
/** The roam ring is wider than the latched one, so the future era islands are reachable, not just visible. */
export const ROAM_MARGIN = 70;
export const ROAM_HOME_RADIUS = 130;

/** Ground speed at `r = 60`, in world units per second, and what Shift multiplies it by. */
export const ROAM_SPEED = 30;
export const ROAM_BOOST = 2.7;
/** Turning and rising, per second. */
export const ROAM_TURN_SPEED = 1.35;
export const ROAM_PHI_SPEED = 0.85;

/** How quickly a glide gives up its speed (per second). Higher is stickier. */
export const ROAM_DAMPING = 4.2;
export const ROAM_TURN_DAMPING = 8;
/** A glide below this (world units per second, radians per second) has stopped. */
export const ROAM_REST = 0.045;
/** The fastest a flick may throw the camera, so a stray swipe cannot launch it across the sea. */
export const ROAM_MAX_FLICK = 220;
/** The eye never comes closer than this to whatever is under it. */
export const ROAM_EYE_CLEAR = 2.4;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The ring the free camera's target may not leave. `eraExtent` is how far the farthest era island reaches (0 with no
 * journey); `latched` is the limit the latched camera uses, which the roam ring always contains.
 */
export function roamBounds(input: { eraExtent?: number; latched?: number; maxRadius?: number }): RoamBounds {
  const era = Math.max(0, input.eraExtent ?? 0);
  const latched = Math.max(0, input.latched ?? 0);
  const radius = Math.max(ROAM_HOME_RADIUS, latched, era > 0 ? era + ROAM_MARGIN : 0);
  const maxR = Math.max(ROAM_MIN_R + 1, (input.maxRadius ?? 200) * ROAM_MAX_R_LIFT);
  return { radius, minR: ROAM_MIN_R, maxR, minPhi: ROAM_MIN_PHI, maxPhi: ROAM_MAX_PHI };
}

/** Hold the camera inside its bounds. Anything a latched camera could reach passes through untouched. */
export function clampRoamCam(cam: RoamCam, bounds: RoamBounds): RoamCam {
  const next = { ...cam };
  const d = Math.hypot(next.tx, next.tz);
  if (d > bounds.radius && d > 0) { next.tx *= bounds.radius / d; next.tz *= bounds.radius / d; }
  next.r = clamp(next.r, bounds.minR, bounds.maxR);
  next.phi = clamp(next.phi, bounds.minPhi, bounds.maxPhi);
  next.theta = wrapAngle(next.theta);
  return next;
}

/** Keep a heading in -π…π so it never drifts into large numbers over a long roam. */
export function wrapAngle(theta: number): number {
  return Math.atan2(Math.sin(theta), Math.cos(theta));
}

/**
 * Taking the camera keeps the exact view you had: the widened bounds contain everything the latched camera could
 * reach, so this is the identity for any view you can arrive in.
 */
export function adoptRoam(cam: RoamCam, bounds: RoamBounds): RoamCam {
  return clampRoamCam(cam, bounds);
}

/** Unit vectors on the ground for "ahead" and "right", as the camera sees them. */
export function roamAxes(theta: number): { fx: number; fz: number; rx: number; rz: number } {
  // The eye sits at (+sin θ, +cos θ) from the target, so "ahead" walks the target away from the eye.
  const fx = -Math.sin(theta), fz = -Math.cos(theta);
  return { fx, fz, rx: -fz, rz: fx };
}

/** How fast the camera walks at this distance: close in it creeps, far out it covers ground. */
export function roamSpeed(r: number, boost = false): number {
  return ROAM_SPEED * clamp(r / 60, 0.34, 2.3) * (boost ? ROAM_BOOST : 1);
}

/** A drag of `dx`,`dy` screen pixels, as a move of the camera's target across the ground. */
export function panDelta(dx: number, dy: number, r: number, theta: number): { dx: number; dz: number } {
  const k = r * 0.0018;
  return {
    dx: (-dx * Math.cos(theta) - dy * Math.sin(theta)) * k,
    dz: (dx * Math.sin(theta) - dy * Math.cos(theta)) * k,
  };
}

/** The speed a released drag leaves behind, capped so a flick cannot launch the camera. */
export function flickVelocity(dx: number, dz: number, dt: number): { vx: number; vz: number } {
  if (!(dt > 0)) return { vx: 0, vz: 0 };
  let vx = dx / dt, vz = dz / dt;
  const speed = Math.hypot(vx, vz);
  if (speed > ROAM_MAX_FLICK) { const k = ROAM_MAX_FLICK / speed; vx *= k; vz *= k; }
  return { vx, vz };
}

/** The exact solution of `v' = -k (v - target)` over `dt`: the new speed, and the distance covered. */
function axisOf(v0: number, target: number, k: number, dt: number): { v: number; d: number } {
  if (!(dt > 0)) return { v: v0, d: 0 };
  if (!(k > 0)) return { v: target, d: target * dt };
  const e = Math.exp(-k * dt);
  return { v: target + (v0 - target) * e, d: target * dt + ((v0 - target) * (1 - e)) / k };
}

export type RoamStep = { cam: RoamCam; motion: RoamMotion; moving: boolean };

/**
 * One step of the free camera.
 *
 * With `reduced` (the person asked for less motion) there is no inertia: the camera moves exactly while a key is held
 * and stops the instant it is let go.
 */
export function stepRoam(
  cam: RoamCam,
  motion: RoamMotion,
  input: RoamInput,
  dt: number,
  bounds: RoamBounds,
  reduced = false,
): RoamStep {
  const step = Math.max(0, Math.min(0.05, dt)) || 0;
  const speed = roamSpeed(cam.r, input.boost);
  const targetTurn = input.turn * ROAM_TURN_SPEED * (input.boost ? 1.7 : 1);
  // Running and turning at once: aim along the heading the step passes *through*, not the one it starts at, so a
  // slow frame curves the same arc as a fast one.
  const turnStep = reduced
    ? { v: targetTurn, d: targetTurn * step }
    : axisOf(motion.vTheta, targetTurn, ROAM_TURN_DAMPING, step);
  const { fx, fz, rx, rz } = roamAxes(cam.theta + turnStep.d / 2);
  const drive = Math.hypot(input.forward, input.strafe);
  const scale = drive > 1 ? 1 / drive : 1;
  const targetVx = (input.forward * fx + input.strafe * rx) * speed * scale;
  const targetVz = (input.forward * fz + input.strafe * rz) * speed * scale;
  // Rising lifts the eye over the land, which is a *smaller* tilt from vertical.
  const targetPhi = -input.rise * ROAM_PHI_SPEED;
  const targetR = 0;

  if (reduced) {
    const next = clampRoamCam({
      tx: cam.tx + targetVx * step,
      tz: cam.tz + targetVz * step,
      r: cam.r * Math.exp(targetR * step),
      theta: cam.theta + turnStep.d,
      phi: cam.phi + targetPhi * step,
    }, bounds);
    const held = Boolean(targetVx || targetVz || targetTurn || targetPhi);
    return { cam: next, motion: { ...ZERO_MOTION }, moving: held };
  }

  const x = axisOf(motion.vx, targetVx, ROAM_DAMPING, step);
  const z = axisOf(motion.vz, targetVz, ROAM_DAMPING, step);
  const t = turnStep;
  const p = axisOf(motion.vPhi, targetPhi, ROAM_TURN_DAMPING, step);
  const rr = axisOf(motion.vr, targetR, ROAM_TURN_DAMPING, step);

  const next = clampRoamCam({
    tx: cam.tx + x.d,
    tz: cam.tz + z.d,
    r: cam.r * Math.exp(rr.d),
    theta: cam.theta + t.d,
    phi: cam.phi + p.d,
  }, bounds);

  const motionNext: RoamMotion = { vx: x.v, vz: z.v, vr: rr.v, vTheta: t.v, vPhi: p.v };
  // A camera pressed against its ring keeps no speed into the wall: it would sit there buzzing forever.
  if (Math.hypot(next.tx, next.tz) >= bounds.radius - 1e-6 && Math.hypot(cam.tx, cam.tz) >= bounds.radius - 1e-6) {
    const out = (motionNext.vx * next.tx + motionNext.vz * next.tz) / (bounds.radius || 1);
    if (out > 0) { motionNext.vx -= (out * next.tx) / bounds.radius; motionNext.vz -= (out * next.tz) / bounds.radius; }
  }
  return { cam: next, motion: motionNext, moving: roamMoving(motionNext) };
}

/** Is there still motion worth drawing a frame for? */
export function roamMoving(motion: RoamMotion): boolean {
  return Math.hypot(motion.vx, motion.vz) > ROAM_REST
    || Math.abs(motion.vTheta) > ROAM_REST
    || Math.abs(motion.vPhi) > ROAM_REST
    || Math.abs(motion.vr) > ROAM_REST / 10;
}

/** Stop dead (reduced motion, a release with no flick, the world going to sleep). */
export function restRoam(): RoamMotion { return { ...ZERO_MOTION }; }

/**
 * Where the eye stands and what it looks at. `ground` is the land under the eye, `targetGround` the land under the
 * target; the eye never sinks into either.
 */
export function roamEye(cam: RoamCam, ground: number, targetGround = ground): { x: number; y: number; z: number; lookY: number } {
  const y = cam.r * Math.cos(cam.phi), h = cam.r * Math.sin(cam.phi);
  return {
    x: cam.tx + h * Math.sin(cam.theta),
    y: Math.max(ground + ROAM_EYE_CLEAR, targetGround + ROAM_EYE_CLEAR, y + targetGround),
    z: cam.tz + h * Math.cos(cam.theta),
    lookY: targetGround + 1.5,
  };
}

/** Keys, as the open world reads them. Returns null for a key the world does not use. */
export function roamKeyAxis(key: string): { axis: "forward" | "strafe" | "turn" | "rise"; sign: 1 | -1 } | null {
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case "w": case "ArrowUp": return { axis: "forward", sign: 1 };
    case "s": case "ArrowDown": return { axis: "forward", sign: -1 };
    case "a": case "ArrowLeft": return { axis: "strafe", sign: -1 };
    case "d": case "ArrowRight": return { axis: "strafe", sign: 1 };
    case "q": return { axis: "turn", sign: -1 };
    case "e": return { axis: "turn", sign: 1 };
    case "r": case "+": case "=": return { axis: "rise", sign: 1 };
    case "f": case "-": case "_": return { axis: "rise", sign: -1 };
    default: return null;
  }
}

/** Turn the set of keys currently held into one input. */
export function roamInputFrom(held: Iterable<string>, boost: boolean): RoamInput {
  const input: RoamInput = { forward: 0, strafe: 0, turn: 0, rise: 0, boost };
  for (const key of held) {
    const hit = roamKeyAxis(key);
    if (!hit) continue;
    input[hit.axis] = clamp(input[hit.axis] + hit.sign, -1, 1);
  }
  return input;
}

/** Is any axis being asked for? */
export function roamInputActive(input: RoamInput): boolean {
  return Boolean(input.forward || input.strafe || input.turn || input.rise);
}

/**
 * What the minimap needs: where the camera stands on the ground, which way it faces, and how wide a cone it sees.
 * `aspect` is the stage's width ÷ height; the camera's vertical field of view is 40°.
 */
export function roamFacing(cam: RoamCam, aspect = 1.6): { x: number; z: number; heading: number; cone: number; reach: number } {
  const h = cam.r * Math.sin(cam.phi);
  const vfov = (40 * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.max(0.35, aspect));
  return {
    x: cam.tx + h * Math.sin(cam.theta),
    z: cam.tz + h * Math.cos(cam.theta),
    // Screen "up" points from the eye toward the target.
    heading: wrapAngle(cam.theta + Math.PI),
    cone: clamp(hfov, 0.3, 2.4),
    reach: Math.max(12, cam.r * 1.25),
  };
}
