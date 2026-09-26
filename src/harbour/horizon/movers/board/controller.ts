/**
 * The board's ModeController (RIDE §3–§6, §10): the ground kernel stepped at 1/120 s under a
 * profile, over the real contact adapter; the follow camera, the pace bubble, the pose and the
 * sound read the kernel's state and never write it. The bicycle is this controller with its
 * own profile and id (D45).
 *
 * The accumulator is the kernel's (`advanceGround`'s 0.1 s clamp and step), unrolled here so
 * the profile can be chosen per step (the Tideline park overlay: forgiving landings inside the
 * park's box) and so a headless caller can record every step (`onStep`, the ride log).
 *
 * Input (RIDE §10.5): W / pad up = push (forward > 0.3), S / pad down = slide (forward < −0.3),
 * A / D = steer; Space is held to charge (crouch 0..1 over 1 s) and the pop fires on release
 * with that charge; Shift = sprint. The physics never reads reduced motion, calm or the tier.
 */
import type {ModeController, ModeId, MoverBody, MoverFrame, MoverHud, MoverInput, MoverPose, MoverSound} from '../shared/mode.ts';
import type {MoverDeps} from '../shared/registry.ts';
import type {ThresholdOffer} from '../shared/threshold.ts';
import {GROUND_DT, NEUTRAL_INPUT, type ContactSample, type GroundEvent, type GroundInput, type GroundProfile, type GroundState, type XYZ} from '../shared/ground/types.ts';
import {createGroundState, groundSpeed, slipAngle, stepGround} from '../shared/ground/kernel.ts';
import {boardFrame} from '../shared/ground/tyre.ts';
import {createBoardContact, type BoardContact} from '../shared/ground/contact.ts';
import {BOARD_PROFILE, boardProfileAt, parkBox, type ParkBox} from './profile.ts';
import {createBoardCamera, type BoardCamera, type BoardCameraFlags} from './camera.ts';
import {hudFor} from './hud.ts';

/** Skate v2's bail and recover (RIDE §6.4): the rider is held, stopped, for 0.8 s + 0.48 s. */
export const BAIL_HOLD_S = 0.8 + 0.48;
/** The hold counted in kernel steps (154 at 1/120 s), so a bail costs the same steps at every frame rate. */
export const BAIL_HOLD_STEPS = Math.round(BAIL_HOLD_S / GROUND_DT);
/** How far inside a pad's edge `enter` keeps the board (RIDE §6.5: under the rider, at the pad). */
export const PAD_INSET = 0.3;
/** Space held this long is a full pop charge (RIDE §6.1: h 0.16 → 0.56). */
export const POP_CHARGE_S = 1;
/** Input thresholds on the Move pad / W–S axis. */
export const PUSH_FORWARD = 0.3, SLIDE_FORWARD = -0.3;
/** Pose limits (RIDE §10.1): lean ≤ 32°, deck roll ≤ 12° by the stick. */
export const POSE_LEAN_MAX = 32 * Math.PI / 180, POSE_ROLL_MAX = 12 * Math.PI / 180;
/** The frame clamp and accumulator epsilon of `advanceGround` (kernel.ts). */
const FRAME_CLAMP = 0.1, ACC_EPS = 1e-9;
/** Fade labels (the runtime shows them over its 300 ms fade). */
export const FADE_LABELS = Object.freeze({offbed: "the bed's edge", water: 'back to the line'} as const);

export interface BoardStart { x: number; z: number; heading: number; speed: number; y?: number }
export interface BoardControllerOptions {
  id?: ModeId;
  /** Called after every kernel step with the input that step used and its events (the ride log). */
  onStep?: (state: GroundState, input: GroundInput, events: readonly GroundEvent[]) => void;
  /** Shares one contact adapter between controllers (tests). */
  contact?: BoardContact;
}

/** The board controller: a ModeController plus the headless seams tests and the situations use. */
export interface BoardController extends ModeController {
  readonly profile: GroundProfile;
  readonly contact: BoardContact;
  /** The live kernel state (read it; do not write it except through `place`). */
  state(): GroundState;
  /** Headless: put the board at a pose rolling at `speed` along the heading — on the topmost ground at (x, z), or at `y` when given (on the ground there if it is within 0.15 m, else airborne). */
  place(start: BoardStart): void;
  /** Seconds of bail hold left (0 when riding). */
  bailHold(): number;
  /** The kernel input the last frame latched. */
  lastInput(): GroundInput;
}

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The polyline tangent of a bed at segment `index`, as a heading (0 = +z). */
function tangentHeading(points: readonly (readonly number[])[], index: number): number {
  const i = clamp(index, 0, points.length - 2), a = points[i]!, b = points[i + 1]!;
  return Math.atan2(b[0]! - a[0]!, b[2]! - a[2]!);
}

/**
 * The heading a board faces when it is picked up at (x, z): along the bed under it, away from
 * the threshold when the pad is a line start or end, else down the line. Null when no bed is near.
 */
export function bedHeadingAt(contact: BoardContact, x: number, z: number, y?: number): number | null {
  const hit = contact.bedAt(x, z, y);
  if (!hit) return null;
  const pts = hit.bed.points, n = pts.length;
  const start = pts[0]!, end = pts[n - 1]!;
  const dStart = Math.hypot(x - start[0], z - start[2]), dEnd = Math.hypot(x - end[0], z - end[2]);
  const reach = 8;
  if (dEnd < reach && dEnd < dStart) return wrap(tangentHeading(pts, n - 2) + Math.PI);   // the line's end: face back up it
  return tangentHeading(pts, hit.index);
}

export function createBoardController(deps: MoverDeps, profile: GroundProfile = BOARD_PROFILE, options: BoardControllerOptions = {}): BoardController {
  const id: ModeId = options.id ?? 'board';
  const contact = options.contact ?? createBoardContact(deps.geography, deps.world, deps.manifest, profile);
  const park: ParkBox | null = profile.beds.includes('park') ? parkBox(deps.world, deps.manifest) : null;
  const flags: BoardCameraFlags = {reducedMotion: deps.reducedMotion, calm: deps.calm, tier: deps.tier};
  const camera: BoardCamera = createBoardCamera((x, z) => deps.geography.ground(x, z), deps.geography.cameraBlocked ? (a, b) => deps.geography.cameraBlocked(a, b) : undefined);
  let state: GroundState = createGroundState([0, 0, 0], 0);
  const acc = {t: 0};
  let holdSteps = 0, jumpHeld = 0, prevJump = false, travelYaw: number | null = null, lean = 0;
  let input: GroundInput = {...NEUTRAL_INPUT};

  function body(): MoverBody { return {x: state.p[0], y: state.p[1], z: state.p[2], yaw: state.heading}; }

  /** A fresh kernel state at p: on the ground found within `snap` of p's height, else airborne there. */
  function reset(p: XYZ, heading: number, speed: number, snap = 0.6): void {
    state = createGroundState(p, heading);
    const c = contact.sample(p[0], p[2], p[1] + 0.5);
    if (c && c.y > p[1] - snap) {   // the ground within `snap` below (or above: never start under the deck)
      state.p[1] = c.y; state.contact.n = [c.n[0], c.n[1], c.n[2]];
      state.contact.material = c.material; state.contact.pace = c.legal ? c.pace : 'offbed'; state.contact.legal = c.legal; state.contact.slope = c.slope;
    } else {
      state.contact.on = false; state.contact.kind = 'air'; state.contact.n = [0, 1, 0];
    }
    if (speed) { const f = boardFrame(heading, 1, state.contact.n); state.v = [f.a[0] * speed, f.a[1] * speed, f.a[2] * speed]; }
    acc.t = 0; holdSteps = 0; jumpHeld = 0; prevJump = false; travelYaw = null; lean = 0; input = {...NEUTRAL_INPUT};
    camera.snap(state, flags);
  }

  /** MoverInput → the kernel's input (Space: hold to charge, release to pop). */
  function groundInput(dt: number, m: MoverInput): GroundInput {
    const jump = !!m.jump;
    let pop = false, charge = 0;
    if (jump) { jumpHeld += Number.isFinite(dt) ? Math.max(0, dt) : 0; charge = Math.min(1, jumpHeld / POP_CHARGE_S); }
    else if (prevJump) { pop = true; charge = Math.min(1, jumpHeld / POP_CHARGE_S); jumpHeld = 0; }
    prevJump = jump;
    const gi = axes(m);
    return {...gi, pop: profile.pop && pop, crouch: Math.max(gi.crouch, charge)};
  }

  /** The stick, W / S, Shift and the crouch key, without Space (a frame that begins in the bail hold). */
  function axes(m: MoverInput): GroundInput {
    const steer = Number.isFinite(m.steer) ? clamp(m.steer, -1, 1) : 0, forward = Number.isFinite(m.forward) ? m.forward : 0;
    const crouch = Number.isFinite(m.crouch) ? clamp(m.crouch, 0, 1) : 0;
    return {steer, push: forward > PUSH_FORWARD, slide: forward < SLIDE_FORWARD, pop: false, sprint: !!m.sprint, crouch};
  }

  /**
   * The accumulator. A bail starts the hold, counted in kernel steps: each step of the hold is
   * consumed without stepping the kernel (the kernel's `bail()` already stopped the board and
   * gripped it; the controller only withholds input), and the remainder carries on, so the
   * steps after a bail are the same at every frame rate.
   */
  function stepFrame(dt: number, gi: GroundInput): GroundEvent[] {
    const events: GroundEvent[] = [];
    acc.t += Number.isFinite(dt) ? clamp(dt, 0, FRAME_CLAMP) : 0;
    while (acc.t >= GROUND_DT - ACC_EPS) {
      acc.t -= GROUND_DT;
      if (holdSteps > 0) { holdSteps--; continue; }
      const P = boardProfileAt(profile, park, state.p[0], state.p[2]);
      const from = events.length;
      stepGround(state, gi, contact, P, events);
      options.onStep?.(state, gi, events.slice(from));
      if (events.some((e, k) => k >= from && e.kind === 'bail')) holdSteps = BAIL_HOLD_STEPS;
    }
    return events;
  }

  function pose(dt: number, gi: GroundInput): MoverPose {
    const s = groundSpeed(state), v = state.v;
    // Lean by the lateral acceleration the wheels deliver: a_lat = s · (the travel's turn rate), over g.
    let aLat = 0;
    if (state.contact.on && Math.hypot(v[0], v[2]) > 0.5) {
      const ty = Math.atan2(v[0], v[2]);
      if (travelYaw !== null && dt > 0) aLat = s * wrap(ty - travelYaw) / dt;
      travelYaw = ty;
    } else travelYaw = null;
    const target = clamp(aLat / profile.g, -POSE_LEAN_MAX, POSE_LEAN_MAX);
    lean += (target - lean) * (1 - Math.exp(-12 * Math.max(0, dt)));   // a figure's hips, not a second physics: just smoothing the per-frame estimate
    return {
      lean, roll: clamp(gi.steer, -1, 1) * POSE_ROLL_MAX, pitch: state.contact.on ? state.contact.pitch : 0,
      crouch: Math.max(gi.crouch, state.legs.charge), slide: clamp(1 - state.grip, 0, 1), speed: s,
      // The travel minus the body's yaw (the nose heading), lead-corrected: ≈ ±π riding fakie, 0 when stopped.
      slip: s > 0.05 ? wrap(slipAngle(state) + (state.lead < 0 ? Math.PI : 0)) : 0,
    };
  }

  function sound(events: readonly GroundEvent[]): MoverSound {
    const s = groundSpeed(state), on = state.contact.on && state.contact.kind === 'ground';
    const slide = on && s > 0.5 && state.grip < 1 ? clamp(Math.abs(Math.sin(slipAngle(state))) / Math.SQRT1_2, 0, 1) : 0;
    return {
      slide, roll: on ? clamp(s / 14, 0, 1) : 0,
      bite: events.some(e => e.kind === 'slideEnd') && state.grip >= 0.7,
      boost: events.some(e => e.kind === 'boost'),
    };
  }

  function frame(dt: number, gi: GroundInput, events: GroundEvent[], look: {dx: number; dy: number}): MoverFrame {
    const fade = events.find(e => e.kind === 'fadeBack');
    const cam = fade ? camera.snap(state, flags) : camera.update(state, events, look, dt, flags);
    const sample: ContactSample | null = state.contact.on ? contact.sample(state.p[0], state.p[2], state.p[1] + 0.1) : null;
    const hud: MoverHud = hudFor(state, sample, events);
    return {
      body: body(),
      camera: {eye: [cam.eye[0], cam.eye[1], cam.eye[2]], target: [cam.target[0], cam.target[1], cam.target[2]], fov: cam.fov},
      pose: pose(dt, gi), hud, sound: sound(events),
      fade: fade ? {to: body(), label: fade.data?.reason === 'water' ? FADE_LABELS.water : FADE_LABELS.offbed} : null,
      events: events.map(e => e.kind),
    };
  }

  const controller: BoardController = {
    id, profile, contact,
    enter(offer: ThresholdOffer, from: MoverBody) {
      // RIDE §6.5: the board goes down under the rider, at the pad: the rider's (x, z) clamped into the pad
      // (PAD_INSET inside its edge), on the ground there; facing along the pad's bed. No hop to the pad's centre.
      const [ox, oy, oz] = offer.at;
      const pad = offer.padId ? deps.world.collision?.pads.find(p => p.id === offer.padId) : undefined;
      let x = ox, z = oz, y = oy;
      if (pad) {
        const a = pad.rotationDegrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        const rx = from.x - pad.centre[0], rz = from.z - pad.centre[2];
        const u = clamp(rx * c + rz * s, -Math.max(0, pad.size[0] / 2 - PAD_INSET), Math.max(0, pad.size[0] / 2 - PAD_INSET));
        const v = clamp(-rx * s + rz * c, -Math.max(0, pad.size[1] / 2 - PAD_INSET), Math.max(0, pad.size[1] / 2 - PAD_INSET));
        x = pad.centre[0] + u * c - v * s; z = pad.centre[2] + u * s + v * c;
        y = contact.sample(x, z, pad.centre[1] + 0.5)?.y ?? pad.centre[1];
      }
      const heading = bedHeadingAt(contact, ox, oz, oy) ?? bedHeadingAt(contact, x, z, y) ?? from.yaw;
      reset([x, y, z], heading, 0);
    },
    update(dt: number, m: MoverInput): MoverFrame {
      const look = m.look ?? {dx: 0, dy: 0};
      if (holdSteps > 0) {
        // The bail: the rider is down and the board is still (the kernel stopped it); Space held or released
        // through the hold neither charges nor pops. The hold ends inside stepFrame, on a kernel step.
        prevJump = !!m.jump; jumpHeld = 0;
        input = axes(m);
      } else input = groundInput(dt, m);
      const events = stepFrame(dt, input);
      return frame(dt, input, events, look);
    },
    exit(): MoverBody { return body(); },
    reducedMotion(on) { flags.reducedMotion = on; },
    calm(on) { flags.calm = on; },
    tier(t) { flags.tier = t; },
    dispose() { acc.t = 0; holdSteps = 0; },
    state: () => state,
    place(start) {
      // Without y: on the topmost ground there. With y: on the ground only if it is within 0.15 m, else airborne at y.
      const c = start.y === undefined ? contact.sample(start.x, start.z, 1e4) : null;
      reset([start.x, start.y ?? c?.y ?? 0, start.z], start.heading, start.speed, start.y === undefined ? 0.6 : 0.15);
    },
    bailHold: () => holdSteps * GROUND_DT,
    lastInput: () => input,
  };
  return controller;
}
