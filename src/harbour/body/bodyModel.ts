/**
 * Little Harbour · how a body moves over the island.
 *
 * Pure. Nothing here reads three.js, the DOM, time or money: it takes a state,
 * an input and a `dt`, and hands back the next state. `body/walker.ts` gives
 * it a mesh, `scene/runtime.ts` gives it a clock.
 *
 * ## Scale and speed
 *
 * The Queen is 2.05 units tall and she is a plant, so a person is 0.58 —
 * a model village, not a metre. The island is 48 units across.
 * `WALK_SPEED` is **2.1 units per second**: the whole island end to end in
 * about 23 seconds, the Court's terrace (12 across) in six. It used to be
 * 1.5, which crossed the island in half a minute — honest, and a stroll.
 * Going somewhere should feel brisk, so the baseline is a *purposeful* walk
 * and Shift is a real run at 4.0 — the island in twelve seconds, nearly
 * twice the walk, which is the ratio that makes a run read as a run rather
 * than as a walk with the fast-forward on.
 *
 * ## Weight
 *
 * A body with mass does not reach its speed instantly and does not give it
 * up instantly either, and it does not do the two at the same rate.
 * `ACCELERATION` is the shove off the mark — quick, because waiting for your
 * own legs is not fun — and `BRAKING` is deliberately slower, so pulling up
 * from a run is a settle and a skid rather than a wall.
 *
 * Two lagged signals come out of that and are what makes the figure read as
 * a body rather than a puppet on rails (`body/figure.ts` reads both, and
 * nothing else does):
 *
 * - **`lean`** follows the body's own acceleration, eased. It pitches hard
 *   forward on the first frames of a start and, because it lags, keeps
 *   pitching after the speed has settled and then eases back — the overshoot
 *   you feel in your knees. Braking makes it negative: the skid.
 * - **`bank`** follows the *heading error* — where you have asked to go minus
 *   where you are facing — so it is anticipation, not report: the body rolls
 *   into a turn on the frame you ask for it, before it has turned at all.
 *
 * ## Frame-rate independence
 *
 * Speed, heading, lean and bank are integrated with the exact solution of
 * `v' = −k(v − target)`, so one step of a second and sixty steps of a
 * sixtieth land in the same place. Never `v *= 0.9` per frame.
 */

import { BODY_HEIGHT, BODY_RADIUS, SHORE_RADIUS, holdAshore, holdInRoom, pushOut, type Obstacle, type RoomBounds } from "./obstacles.ts";

export { BODY_HEIGHT, BODY_RADIUS, SHORE_RADIUS };

/** Units per second at a full push of the stick or a held key. */
export const WALK_SPEED = 2.1;
/** Shift, or a stick pushed past its ring: a real run, nearly twice the walk. */
export const RUN_SPEED = 4.0;
/** How quickly the body gets up to speed (per second). Snappy: the shove off the mark. */
export const ACCELERATION = 13;
/** How quickly it gives speed up (per second). Slower than the shove, so stopping is a settle. */
export const BRAKING = 5.5;
/** How quickly the body turns to face where it is going (per second). */
export const TURN_RATE = 11;
/** How far the body travels per step of the gait at a walk, in units. Sets the leg cadence. */
export const STRIDE = 0.6;
/**
 * How much longer the stride gets at a full run, as a fraction. A run is not
 * a walk with the cadence turned up: the legs reach further, so the feet do
 * not blur. Exactly zero at and below `WALK_SPEED`, so the walk's cadence is
 * the number it always was.
 */
export const STRIDE_STRETCH = 0.45;
/** The acceleration, in units per second squared, that a full `lean` stands for. */
export const LEAN_REFERENCE = 12;
/** The heading error, in radians, that a full `bank` stands for. */
export const BANK_REFERENCE = 1.15;
/** How quickly `lean` and `bank` follow what asked for them (per second). */
export const LEAN_EASE = 9, BANK_EASE = 8;
/** Below this, a lean or a bank is nothing: the signals must reach rest so the frame policy can. */
export const POSE_REST = 0.01;
/** A tap-to-walk arrives when it is this close to the point tapped. */
export const ARRIVAL = 0.22;
/**
 * A tap-to-walk gives up after this many seconds of getting nowhere. Walking
 * is a straight line with a slide, not a path-finder: a body sent behind a
 * building will press against the wall, and pressing forever is worse than
 * stopping and letting you tap again.
 */
export const STUCK_SECONDS = 1.1;

/** What the body is being asked for this frame, in camera space: +forward is away from the eye, +strafe is to the right. */
export type BodyInput = { forward: number; strafe: number; run?: boolean };
export const NO_INPUT: Readonly<BodyInput> = Object.freeze({ forward: 0, strafe: 0, run: false });

/** Where a body is and what it is doing. Plain data: a second body is a second one of these. */
export type BodyState = {
  x: number;
  z: number;
  /** The ground under the feet, from `groundHeightAt`. */
  y: number;
  /** Facing, radians, in three.js's `rotation.y` sense: the body looks along (sin yaw, 0, cos yaw). */
  yaw: number;
  /** Units per second, along the heading it is actually travelling. */
  speed: number;
  /** The gait's phase in radians; one step per π. */
  phase: number;
  /** Where a tap asked it to go, or null. */
  goal: { x: number; z: number } | null;
  /** How long the walk has been making no progress, in seconds. */
  stalled: number;
  /** What it last pushed out of, for a test and for a footfall that should not be dropped in a wall. */
  contact: string | null;
  /**
   * Forward pitch, −1…1: the body's own acceleration, eased. Positive is
   * taking off, negative is pulling up. The figure reads it; nothing else does.
   */
  lean: number;
  /**
   * Roll into the turn, −1…1, from the heading *error* rather than the turn
   * achieved: the body banks on the frame you ask for a new direction.
   * Positive rolls toward the body's right.
   */
  bank: number;
};

export type BodyWorld = {
  /**
   * The height of the floor under a point. Outdoors this is the island's own
   * profile (`scene/ground.ts` `groundHeightAt`); indoors it is the room's
   * floor, which is one flat plane at the height that room was built at
   * (`body/places.ts`).
   */
  groundHeightAt: (x: number, z: number) => number;
  obstacles: readonly Obstacle[];
  /** How far out the shore lets you walk. */
  shore?: number;
  /**
   * The walls, where there are walls (walk-everywhere). A room holds the body
   * inside itself the way the shore holds it outdoors, with a gap where the
   * doorway is; `null` — the Court — is open sky and the shore alone.
   */
  room?: RoomBounds | null;
};

/** Hold a point where this world lets a body stand: inside the shore, and inside the walls. */
function holdInWorld(x: number, z: number, world: BodyWorld): { x: number; z: number; contact: string | null } {
  const ashore = holdAshore(x, z, world.shore ?? SHORE_RADIUS);
  if (!world.room) return { x: ashore.x, z: ashore.z, contact: ashore.ashore ? null : "shore" };
  const held = holdInRoom(ashore.x, ashore.z, BODY_RADIUS, world.room);
  return { x: held.x, z: held.z, contact: held.wall ?? (ashore.ashore ? null : "shore") };
}

export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * How far into a run this speed is, 0…1. Zero at and below a walk, one at a
 * full run. The stride, the dust, the camera's dolly and the figure's swing
 * all hang off this one number, so "faster" means the same thing everywhere.
 */
export const runFraction = (speed: number): number =>
  clamp((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);

/** The stride at a given speed: exactly `STRIDE` at a walk, reaching further into a run. */
export const strideAt = (speed: number): number => STRIDE * (1 + STRIDE_STRETCH * runFraction(speed));

/** A body standing at a point, facing the way it is put. */
export function createBodyState(x: number, z: number, yaw: number, world: BodyWorld): BodyState {
  const ashore = holdInWorld(x, z, world);
  const clear = pushOut(ashore.x, ashore.z, BODY_RADIUS, world.obstacles);
  return { x: clear.x, z: clear.z, y: world.groundHeightAt(clear.x, clear.z), yaw, speed: 0, phase: 0, goal: null, stalled: 0, contact: null, lean: 0, bank: 0 };
}

/**
 * The ground direction of "forward" for a camera swung `theta` radians from
 * +z. The eye sits at `target + r·(sin θ, …, cos θ)`, so it looks back along
 * `(−sin θ, −cos θ)` — which is where W goes.
 */
export function cameraBasis(theta: number): { fx: number; fz: number; rx: number; rz: number } {
  const fx = -Math.sin(theta), fz = -Math.cos(theta);
  // right = forward turned a quarter clockwise: (+z) → (+x).
  return { fx, fz, rx: fz, rz: -fx };
}

export type BodyStep = {
  state: BodyState;
  /** True while anything of the body's is still moving — what the frame policy asks about. */
  moving: boolean;
  /** A foot landed this step: where, which one, and how hard (0 at a walk, 1 at a full run). */
  footfall: { x: number; z: number; y: number; yaw: number; left: boolean; force: number } | null;
  /**
   * The body pulled up hard from above a walk this frame — a skid. The ground
   * lane scuffs and puffs on it; nothing about the movement depends on it.
   */
  skid: boolean;
};

/**
 * One frame of the body.
 *
 * `theta` is where the camera stands, so a push of the stick is read the way
 * it looks on the screen. A held key beats a tap-to-walk: asking for a
 * direction cancels the destination, which is what a hand on the keys means.
 */
export function stepBody(state: BodyState, input: BodyInput, theta: number, dt: number, world: BodyWorld): BodyStep {
  const step = Math.max(0, Math.min(dt, 0.08));
  const { fx, fz, rx, rz } = cameraBasis(theta);
  let goal = state.goal;

  // ── What direction is being asked for ────────────────────────────────────
  let wishX = 0, wishZ = 0, wish = 0;
  const pushed = Math.hypot(input.forward, input.strafe);
  if (pushed > 1e-3) {
    // A hand on the keys or the stick takes the walk back from the tap.
    goal = null;
    const k = pushed > 1 ? 1 / pushed : 1;
    wishX = (fx * input.forward + rx * input.strafe) * k;
    wishZ = (fz * input.forward + rz * input.strafe) * k;
    wish = Math.min(1, pushed);
  } else if (goal) {
    const dx = goal.x - state.x, dz = goal.z - state.z;
    const distance = Math.hypot(dx, dz);
    // Arrived when it is inside the arrival ring — or when this one frame
    // would carry it straight past, which is what a run into a tapped point
    // does on a slow frame. Without that it would circle the spot for ever.
    if (distance <= Math.max(ARRIVAL, state.speed * step * 1.1)) { goal = null; }
    else {
      wishX = dx / distance; wishZ = dz / distance;
      // Ease the last stride so a tap-to-walk arrives rather than stops dead.
      // From a run that easing *is* the skid: the brake is slower than the
      // shove, so the body slides the last little way in.
      wish = Math.min(1, distance / (ARRIVAL * 4));
    }
  }

  const top = input.run ? RUN_SPEED : WALK_SPEED;
  const wanted = wish * top;
  // Quick to gather speed, slower to give it up: that asymmetry is the whole
  // difference between a body with mass and a value that tracks a target.
  const rate = wanted > state.speed ? ACCELERATION : BRAKING;
  const ease = 1 - Math.exp(-rate * step);
  const speed = state.speed + (wanted - state.speed) * ease;

  // ── Where that puts the feet ─────────────────────────────────────────────
  let x = state.x, z = state.z, contact: string | null = null;
  const travel = speed * step;
  if (travel > 1e-6 && (wishX !== 0 || wishZ !== 0)) {
    const held = holdInWorld(state.x + wishX * travel, state.z + wishZ * travel, world);
    const clear = pushOut(held.x, held.z, BODY_RADIUS, world.obstacles);
    x = clear.x; z = clear.z;
    contact = clear.hit ?? held.contact;
  }
  const walked = Math.hypot(x - state.x, z - state.z);

  // ── Facing, and the bank that anticipates it ─────────────────────────────
  let yaw = state.yaw;
  // The heading error is read *before* the turn is applied: banking on where
  // you have asked to go, not on where you have got to, is what makes a turn
  // feel led rather than reported.
  let error = 0;
  if (wish > 1e-3 && (wishX !== 0 || wishZ !== 0)) {
    const target = Math.atan2(wishX, wishZ);
    error = wrapAngle(target - yaw);
    yaw = wrapAngle(yaw + error * (1 - Math.exp(-TURN_RATE * step)));
  }

  // ── The gait, and the feet it leaves ─────────────────────────────────────
  const force = runFraction(speed);
  const before = state.phase;
  const phase = before + (walked / strideAt(speed)) * Math.PI;
  let footfall: BodyStep["footfall"] = null;
  const crossed = Math.floor(phase / Math.PI) - Math.floor(before / Math.PI);
  if (crossed > 0 && walked > 1e-4) {
    const left = Math.floor(phase / Math.PI) % 2 === 0;
    footfall = { x, z, y: world.groundHeightAt(x, z), yaw, left, force };
  }

  // ── The two signals the figure leans on ──────────────────────────────────
  const accel = (speed - state.speed) / Math.max(step, 1e-4);
  const wantLean = clamp(accel / LEAN_REFERENCE, -1, 1);
  const leaned = state.lean + (wantLean - state.lean) * (1 - Math.exp(-LEAN_EASE * step));
  // A bank only means anything while the feet are moving; a standing body
  // swivelling on the spot does not roll.
  const wantBank = clamp(error / BANK_REFERENCE, -1, 1) * Math.min(1, speed / WALK_SPEED);
  const banked = state.bank + (wantBank - state.bank) * (1 - Math.exp(-BANK_EASE * step));
  const lean = Math.abs(leaned) < POSE_REST && Math.abs(wantLean) < POSE_REST ? 0 : leaned;
  const bank = Math.abs(banked) < POSE_REST && Math.abs(wantBank) < POSE_REST ? 0 : banked;
  // Pulling up hard, from something faster than a walk: scuff the ground.
  const skid = accel < -BRAKING * 0.5 && state.speed > WALK_SPEED * 0.9;

  // ── Getting nowhere ──────────────────────────────────────────────────────
  let stalled = state.stalled;
  if (goal) {
    stalled = walked < travel * 0.35 ? stalled + step : 0;
    if (stalled >= STUCK_SECONDS) { goal = null; stalled = 0; }
  } else stalled = 0;

  const next: BodyState = {
    x, z,
    y: world.groundHeightAt(x, z),
    yaw,
    // Below a whisper the body is standing still, not creeping.
    speed: speed < 0.01 && wanted === 0 ? 0 : speed,
    phase,
    goal,
    stalled,
    contact,
    lean,
    bank,
  };
  // A body still settling out of a lean is still moving, and the frame policy
  // has to keep painting until it has. Both signals snap to zero below
  // `POSE_REST`, so this is a promise that can actually be kept.
  const moving = next.speed > 0.01 || walked > 1e-5 || Math.abs(wrapAngle(yaw - state.yaw)) > 1e-4
    || lean !== 0 || bank !== 0;
  return { state: next, moving, footfall, skid };
}

/** Send the body to a point. The point is held ashore and out of anything solid first, so a tap on a wall walks to its foot. */
export function walkTo(state: BodyState, x: number, z: number, world: BodyWorld): BodyState {
  const ashore = holdInWorld(x, z, world);
  const clear = pushOut(ashore.x, ashore.z, BODY_RADIUS, world.obstacles);
  return { ...state, goal: { x: clear.x, z: clear.z }, stalled: 0 };
}

/** Put the body somewhere at once (arriving in the Court, a return record). */
export function placeBody(state: BodyState, x: number, z: number, world: BodyWorld, yaw = state.yaw): BodyState {
  const put = createBodyState(x, z, yaw, world);
  return { ...put, phase: state.phase };
}

/** How much of a full walk this is, 0…1 — what the gait's amplitude is scaled by. */
export const gaitOf = (state: BodyState): number => Math.min(1, state.speed / WALK_SPEED);

/** Where the eyes are: the point a follow camera looks at. */
export const eyeHeight = (state: BodyState): number => state.y + BODY_HEIGHT * 0.78;
