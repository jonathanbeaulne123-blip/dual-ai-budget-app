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
 * `WALK_SPEED` is **1.5 units per second**: the whole island end to end in
 * about 32 seconds, the Court's terrace (12 across) in eight, the Court to
 * the Library's door in nine. Slow enough to be a walk you watch; short
 * enough that going somewhere is not a chore. Shift runs at 2.6 — the island
 * in 18 seconds — for when you already know where you are going.
 *
 * ## Frame-rate independence
 *
 * Speed and heading are integrated with the exact solution of
 * `v' = −k(v − target)`, so one step of a second and sixty steps of a
 * sixtieth land in the same place. Never `v *= 0.9` per frame.
 */

import { BODY_HEIGHT, BODY_RADIUS, SHORE_RADIUS, holdAshore, holdInRoom, pushOut, type Obstacle, type RoomBounds } from "./obstacles.ts";

export { BODY_HEIGHT, BODY_RADIUS, SHORE_RADIUS };

/** Units per second at a full push of the stick or a held key. */
export const WALK_SPEED = 1.5;
/** Shift, or a stick pushed past its ring: the same walk, hurried. */
export const RUN_SPEED = 2.6;
/** How quickly the body reaches its speed, and gives it up (per second). */
export const ACCELERATION = 7;
/** How quickly the body turns to face where it is going (per second). */
export const TURN_RATE = 9;
/** How far the body travels per step of the gait, in units. Sets the leg cadence. */
export const STRIDE = 0.6;
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

/** A body standing at a point, facing the way it is put. */
export function createBodyState(x: number, z: number, yaw: number, world: BodyWorld): BodyState {
  const ashore = holdInWorld(x, z, world);
  const clear = pushOut(ashore.x, ashore.z, BODY_RADIUS, world.obstacles);
  return { x: clear.x, z: clear.z, y: world.groundHeightAt(clear.x, clear.z), yaw, speed: 0, phase: 0, goal: null, stalled: 0, contact: null };
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
  /** A foot landed this step: where, and which one. `null` most frames. */
  footfall: { x: number; z: number; y: number; yaw: number; left: boolean } | null;
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
    if (distance <= ARRIVAL) { goal = null; }
    else {
      wishX = dx / distance; wishZ = dz / distance;
      // Ease the last stride so a tap-to-walk arrives rather than stops dead.
      wish = Math.min(1, distance / (ARRIVAL * 4));
    }
  }

  const top = input.run ? RUN_SPEED : WALK_SPEED;
  const wanted = wish * top;
  const ease = 1 - Math.exp(-ACCELERATION * step);
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

  // ── Facing ───────────────────────────────────────────────────────────────
  let yaw = state.yaw;
  if (wish > 1e-3 && (wishX !== 0 || wishZ !== 0)) {
    const target = Math.atan2(wishX, wishZ);
    const turn = wrapAngle(target - yaw);
    yaw = wrapAngle(yaw + turn * (1 - Math.exp(-TURN_RATE * step)));
  }

  // ── The gait, and the feet it leaves ─────────────────────────────────────
  const before = state.phase;
  const phase = before + (walked / STRIDE) * Math.PI;
  let footfall: BodyStep["footfall"] = null;
  const crossed = Math.floor(phase / Math.PI) - Math.floor(before / Math.PI);
  if (crossed > 0 && walked > 1e-4) {
    const left = Math.floor(phase / Math.PI) % 2 === 0;
    footfall = { x, z, y: world.groundHeightAt(x, z), yaw, left };
  }

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
  };
  const moving = next.speed > 0.01 || walked > 1e-5 || Math.abs(wrapAngle(yaw - state.yaw)) > 1e-4;
  return { state: next, moving, footfall };
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
