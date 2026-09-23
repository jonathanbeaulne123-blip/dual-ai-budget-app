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
 * ## Moves
 *
 * Walking is the floor, not the ceiling. Three things sit on top of it and
 * all three are *here*, in the pure model, so they can be stepped a
 * thousandth of a second at a time in a test with no renderer in the room:
 *
 * - **A jump.** `air` is the height above the ground *under the feet*, never
 *   an absolute height — which is the whole reason landing on a slope works:
 *   the ground is re-sampled every frame while you are in the air, so coming
 *   down on the lawn's hump lands on the hump. It is bought with an
 *   anticipation crouch (`charge`), it arcs under `GRAVITY`, it goes further
 *   out of a run, and there is a second one in the air for the asking.
 * - **A slide.** The reward for sprinting: it only starts above a walk, it
 *   keeps the momentum it started with and gives it up to `SLIDE_DRAG` rather
 *   than to the brake, and it stands up on its own.
 * - **Emotes.** A named pose with a clock. They never gate movement — asking
 *   to walk simply ends one — which is the difference between a flourish and
 *   a cutscene.
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

/* ── Jump ───────────────────────────────────────────────────────────────── */
/** Down, per second squared. Tuned with `JUMP_SPEED` for an arc of about half a second. */
export const GRAVITY = 9.2;
/** The push off the ground from a standstill, in units per second. Apex ≈ 0.30 — half a body. */
export const JUMP_SPEED = 2.35;
/** How much more of that push a full run buys. A running hop clears about a body's height. */
export const JUMP_RUN_BONUS = 0.42;
/** The second jump, taken in the air. Weaker: it is a save, not a ladder. */
export const DOUBLE_JUMP_SPEED = 1.95;
/** How many pushes there are before the feet have to touch the ground again. */
export const JUMP_COUNT = 2;
/**
 * The anticipation. A body that leaves the ground on the frame the key went
 * down reads as a teleport; a body that dips for ninety milliseconds first
 * reads as a jump. It is bought honestly — the take-off really is that late.
 */
export const JUMP_CROUCH = 0.09;
/** How quickly the crouch (anticipation, and the squash after a landing) gives itself back. */
export const CROUCH_EASE = 9;
/** The downward speed a full-force landing stands for: the squash and the dust ring scale on it. */
export const LANDING_REFERENCE = 3.6;
/**
 * How much of the ground's grip the air has. Enough to steer an arc, not
 * enough to fly — and it is only ever asked about while a direction is *held*:
 * a body that lets go in mid-flight keeps exactly what it took off with,
 * because there is nothing up there to brake against.
 */
export const AIR_CONTROL = 0.34;

/* ── Slide ──────────────────────────────────────────────────────────────── */
/** A slide only starts above this — it is the reward for sprinting, not a second walk. */
export const SLIDE_MIN_SPEED = WALK_SPEED * 1.15;
/** How long one lasts at most, in seconds. */
export const SLIDE_SECONDS = 0.72;
/** The kick on the way in: dropping into a crouch trades height for a little speed. */
export const SLIDE_BOOST = 1.12;
/** How much speed a slide gives up per second. Linear, because a skid is friction and not a brake. */
export const SLIDE_DRAG = 2.9;
/** Below this the slide is over and the body stands up, whatever the clock says. */
export const SLIDE_EXIT_SPEED = 0.95;
/**
 * How much of the turn rate is left while sliding. Small on purpose: this is
 * a lean, not a pivot. A slide that could be steered like a walk would be a
 * walk with the body lying down, and the whole point of it is that you
 * committed to the direction you were already going.
 */
export const SLIDE_STEER = 0.14;

/* ── Emotes ─────────────────────────────────────────────────────────────── */
/** The whole set. Six poses with something to say, and no more. */
export const EMOTE_IDS = ["wave", "dance", "sit", "cheer", "laugh", "point"] as const;
export type EmoteId = (typeof EMOTE_IDS)[number];
export const isEmoteId = (value: unknown): value is EmoteId =>
  typeof value === "string" && (EMOTE_IDS as readonly string[]).includes(value);
/**
 * How long each runs, in seconds, and whether it comes round again. `sit` and
 * `dance` hold until you move or ask for something else; the rest say their
 * piece and hand the body back.
 */
export const EMOTE_SECONDS: Readonly<Record<EmoteId, number>> = Object.freeze({
  wave: 1.8, dance: 2.4, sit: 6, cheer: 1.6, laugh: 1.9, point: 1.5,
});
export const EMOTE_LOOPS: Readonly<Record<EmoteId, boolean>> = Object.freeze({
  wave: false, dance: true, sit: true, cheer: false, laugh: false, point: false,
});
/** However long you hold one, it lets go here: a body is not a statue. */
export const EMOTE_MAX_SECONDS = 12;

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

  /* ── The moves ─────────────────────────────────────────────────────────── */
  /**
   * Height above the ground *under the feet*, in units. Zero is standing.
   * Relative, never absolute: the ground is sampled again every frame of the
   * arc, so a jump that takes off on the flat and comes down on the hump
   * lands on the hump.
   */
  air: number;
  /** Vertical speed, units a second. Positive is rising. */
  vy: number;
  /** Pushes used since the feet last touched the ground (`JUMP_COUNT` is the limit). */
  jumps: number;
  /** Seconds left of the anticipation crouch before a take-off; 0 when not charging. */
  charge: number;
  /** 0…1 — the dip before a jump and the squash after a landing. The figure reads it. */
  crouch: number;
  /** Seconds of slide left, 0 when upright. */
  slide: number;
  /** The emote playing, or null. */
  emote: EmoteId | null;
  /** How far into it, in seconds. */
  emoteAt: number;
  /** A jump has been asked for and not yet taken. Set by `requestJump`, consumed by `stepBody`. */
  wantJump: boolean;
  /** A slide has been asked for and not yet started. */
  wantSlide: boolean;
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
  return {
    x: clear.x, z: clear.z, y: world.groundHeightAt(clear.x, clear.z), yaw,
    speed: 0, phase: 0, goal: null, stalled: 0, contact: null, lean: 0, bank: 0,
    air: 0, vy: 0, jumps: 0, charge: 0, crouch: 0, slide: 0, emote: null, emoteAt: 0,
    wantJump: false, wantSlide: false,
  };
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
  /** The feet left the ground this frame. `force` is 0…1 of a full running hop; `second` is the double jump. */
  jumped: { x: number; z: number; y: number; force: number; second: boolean } | null;
  /** The feet came back down this frame. `force` is 0…1 on `LANDING_REFERENCE` — the ring and the squash. */
  landing: { x: number; z: number; y: number; force: number } | null;
  /** True on every frame of a slide, so the ground lane can lay a skid mark and a plume. */
  sliding: boolean;
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

  // ── The moves: jump, slide, emote ────────────────────────────────────────
  // All of it decided before a foot moves, because what the body is *doing*
  // changes how the next few lines read its speed and its heading.
  let air = state.air, vy = state.vy, jumps = state.jumps, charge = state.charge;
  let crouch = state.crouch < POSE_REST ? 0 : state.crouch * Math.exp(-CROUCH_EASE * step);
  let slide = state.slide;
  let emote = state.emote, emoteAt = state.emoteAt;
  let launched: { force: number; second: boolean } | null = null;
  const airborneIn = state.air > 1e-5 || state.vy > 0;

  // An emote stops the moment you move. It never stopped you moving: asking
  // for a direction, a destination, a jump or a slide simply ends it, on the
  // same frame, with nothing to wait for.
  if (emote && (pushed > 1e-3 || goal !== null || state.wantJump || state.wantSlide || state.speed > 0.02)) {
    emote = null; emoteAt = 0;
  } else if (emote) {
    emoteAt += step;
    const life = EMOTE_SECONDS[emote];
    if ((!EMOTE_LOOPS[emote] && emoteAt >= life) || emoteAt >= EMOTE_MAX_SECONDS) { emote = null; emoteAt = 0; }
  }

  // The reward for sprinting: a slide starts only from a real run, and only
  // with both feet on the ground.
  const entering = state.wantSlide && !airborneIn && slide <= 0 && state.speed >= SLIDE_MIN_SPEED;
  if (entering) slide = SLIDE_SECONDS;

  if (state.wantJump) {
    if (slide > 0) {
      // A slide-jump. The crouch is already paid for — you are in it.
      const force = runFraction(state.speed);
      slide = 0; charge = 0; jumps = 1;
      vy = JUMP_SPEED * (1 + JUMP_RUN_BONUS * force);
      launched = { force, second: false };
    } else if (!airborneIn && charge <= 0 && jumps === 0) {
      charge = JUMP_CROUCH;
    } else if (airborneIn && jumps < JUMP_COUNT) {
      vy = DOUBLE_JUMP_SPEED; jumps += 1;
      launched = { force: 0.5, second: true };
    }
  }
  if (charge > 0) {
    crouch = 1;
    charge -= step;
    if (charge <= 0) {
      charge = 0;
      const force = runFraction(state.speed);
      vy = JUMP_SPEED * (1 + JUMP_RUN_BONUS * force);
      jumps = 1;
      launched = { force, second: false };
    }
  }

  const sliding = slide > 0;
  const airborne = air > 1e-5 || vy > 0;

  let wanted = 0, speed: number;
  if (sliding) {
    // A slide keeps what it came in with and gives it up to *friction* rather
    // than to the brake — which is exactly why it carries you further than
    // simply letting go would.
    speed = Math.max(0, (entering ? state.speed * SLIDE_BOOST : state.speed) - SLIDE_DRAG * step);
  } else {
    const top = input.run ? RUN_SPEED : WALK_SPEED;
    // In the air with nothing held, the speed you want is the speed you have:
    // there is no ground to push off and none to brake against, so a running
    // jump carries you, which is the whole reason to take one.
    wanted = airborne && wish <= 1e-3 ? state.speed : wish * top;
    // Quick to gather speed, slower to give it up: that asymmetry is the whole
    // difference between a body with mass and a value that tracks a target.
    // In the air both are scaled right down: enough to steer an arc, not
    // enough to change your mind about it.
    const rate = (wanted > state.speed ? ACCELERATION : BRAKING) * (airborne ? AIR_CONTROL : 1);
    const ease = 1 - Math.exp(-rate * step);
    speed = state.speed + (wanted - state.speed) * ease;
  }

  // ── Where that puts the feet ─────────────────────────────────────────────
  // A slide travels where the body is *pointed*, not where the stick is: that
  // is the momentum it is keeping. A body in the air with nothing held does
  // the same — it carries on the way it was facing when it left the ground
  // rather than dropping out of the sky on the spot. Everything else goes
  // where it was asked.
  const carried = sliding || (airborne && wish <= 1e-3 && speed > 0.01);
  const moveX = carried ? Math.sin(state.yaw) : wishX;
  const moveZ = carried ? Math.cos(state.yaw) : wishZ;
  let x = state.x, z = state.z, contact: string | null = null;
  const travel = speed * step;
  if (travel > 1e-6 && (moveX !== 0 || moveZ !== 0)) {
    const held = holdInWorld(state.x + moveX * travel, state.z + moveZ * travel, world);
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
    // A slide can be leaned; it cannot be pivoted.
    yaw = wrapAngle(yaw + error * (1 - Math.exp(-TURN_RATE * (sliding ? SLIDE_STEER : 1) * step)));
  }

  // ── The gait, and the feet it leaves ─────────────────────────────────────
  // Feet that are not on the ground do not take strides: the gait freezes
  // through a jump and through a slide, and picks up exactly where it left.
  const stride = !airborne && !sliding;
  const force = runFraction(speed);
  const before = state.phase;
  const phase = stride ? before + (walked / strideAt(speed)) * Math.PI : before;
  let footfall: BodyStep["footfall"] = null;
  const crossed = Math.floor(phase / Math.PI) - Math.floor(before / Math.PI);
  if (stride && crossed > 0 && walked > 1e-4) {
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
  // A slide is its own thing and has its own mark; it is not also a skid.
  const skid = !sliding && accel < -BRAKING * 0.5 && state.speed > WALK_SPEED * 0.9;

  // ── The arc ──────────────────────────────────────────────────────────────
  // `air` is measured from the ground *under the new x and z*, which is the
  // whole of why a jump follows a slope: the ground is re-read every frame of
  // the flight, so coming down on the hump lands on the hump and coming down
  // off a step lands a little later.
  const ground = world.groundHeightAt(x, z);
  let landing: BodyStep["landing"] = null;
  if (vy !== 0 || air > 0) {
    vy -= GRAVITY * step;
    air += vy * step;
    if (air <= 0) {
      const hit = clamp(-vy / LANDING_REFERENCE, 0, 1);
      air = 0; vy = 0; jumps = 0; crouch = 1;
      landing = { x, z, y: ground, force: hit };
    }
  }
  const jumped: BodyStep["jumped"] = launched ? { x, z, y: ground, force: launched.force, second: launched.second } : null;

  // The slide's clock, and the two ways out of it: time, or running out of
  // the speed that earned it. Either way the body stands up by itself.
  if (slide > 0) {
    slide -= step;
    if (slide <= 0 || speed < SLIDE_EXIT_SPEED) slide = 0;
  }

  // ── Getting nowhere ──────────────────────────────────────────────────────
  let stalled = state.stalled;
  if (goal) {
    stalled = walked < travel * 0.35 ? stalled + step : 0;
    if (stalled >= STUCK_SECONDS) { goal = null; stalled = 0; }
  } else stalled = 0;

  const next: BodyState = {
    x, z,
    // The feet, which is the ground plus whatever of the jump is left.
    y: ground + air,
    yaw,
    // Below a whisper the body is standing still, not creeping.
    speed: speed < 0.01 && wanted === 0 && !sliding ? 0 : speed,
    phase,
    goal,
    stalled,
    contact,
    lean,
    bank,
    air, vy, jumps, charge,
    crouch: crouch < POSE_REST ? 0 : crouch,
    slide,
    emote, emoteAt,
    // Both asks are one-shot and both have now been answered.
    wantJump: false,
    wantSlide: false,
  };
  // A body still settling out of a lean is still moving, and the frame policy
  // has to keep painting until it has. Both signals snap to zero below
  // `POSE_REST`, so this is a promise that can actually be kept.
  const moving = next.speed > 0.01 || walked > 1e-5 || Math.abs(wrapAngle(yaw - state.yaw)) > 1e-4
    || lean !== 0 || bank !== 0
    // A body in the air, dipping into a jump, squashing out of one, sliding or
    // playing an emote is a body that is changing pixels — and every one of
    // these reaches exactly zero on its own, which is the promise the frame
    // policy is owed.
    || next.air > 0 || next.vy !== 0 || next.charge > 0 || next.crouch !== 0
    || next.slide > 0 || next.emote !== null;
  return { state: next, moving, footfall, skid, jumped, landing, sliding };
}

/**
 * Ask for a jump. One-shot: the flag lives on the state until the very next
 * `stepBody` takes it, so a key pressed between two frames is never dropped
 * and never fires twice.
 */
export function requestJump(state: BodyState): BodyState {
  return { ...state, wantJump: true };
}

/** Ask for a slide. Taken only if the body is fast enough and on the ground when the frame comes. */
export function requestSlide(state: BodyState): BodyState {
  return { ...state, wantSlide: true };
}

/**
 * Play an emote, or stop the one playing (`null`). Asking for the one already
 * playing stops it, so the same key is on and off — the way the close hold is.
 * An emote never touches position, speed or heading: walking away is always
 * available, and is what ends it.
 */
export function requestEmote(state: BodyState, id: EmoteId | null): BodyState {
  if (id === null || state.emote === id) return { ...state, emote: null, emoteAt: 0 };
  return { ...state, emote: id, emoteAt: 0 };
}

/** How far through the emote, jump or slide the body is, 0…1 — what the wire carries. */
export function actionOf(state: BodyState): { act: EmoteId | "jump" | "slide"; p: number } | null {
  if (state.slide > 0) return { act: "slide", p: 1 - state.slide / SLIDE_SECONDS };
  // A charge is the first act of a jump, so the partner sees the dip too.
  if (state.air > 0 || state.charge > 0 || state.vy > 0) {
    // Progress runs over the whole arc: the crouch, then up, then down.
    const rise = Math.max(0.1, (JUMP_SPEED * (1 + JUMP_RUN_BONUS)) / GRAVITY);
    const whole = JUMP_CROUCH + rise * 2;
    const done = state.charge > 0 ? JUMP_CROUCH - state.charge : JUMP_CROUCH + (rise - state.vy / GRAVITY);
    return { act: "jump", p: clamp(done / whole, 0, 1) };
  }
  if (state.emote) {
    const life = EMOTE_SECONDS[state.emote];
    const at = EMOTE_LOOPS[state.emote] ? state.emoteAt % life : Math.min(state.emoteAt, life);
    return { act: state.emote, p: clamp(at / life, 0, 1) };
  }
  return null;
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
