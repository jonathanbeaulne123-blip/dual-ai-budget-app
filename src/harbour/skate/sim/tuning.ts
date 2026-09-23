/**
 * Tideline Skate Club v2 · SIM tuning table.
 *
 * Every number the ride "feels" through lives here, so playtest tuning is one
 * file. Units are island units (a person is 1.25 tall, the deck ~0.55 long),
 * seconds and radians. Speeds are u/s, accelerations u/s².
 *
 * Reference points at these values (flat concrete):
 *  - push cruise ≈ 6.3 u/s after ~3 s of strokes, sprint ≈ 7.8 u/s
 *  - standard ollie (strength .5, crouch .7) rises ≈ 0.39, max pop ≈ 0.56
 *  - ollie air time ≈ 0.47 s → a 180 is comfortable, a 360 needs a kicker
 *  - a 1.97-tall vert quarterpipe hit at ≈ 10 u/s airs ≈ 1.1 above coping
 */
export const SKATE_TUNING = {
  /* ── world ─────────────────────────────────────────────────────────── */
  /** Gravity. Heavier than true-scale (≈ 6.8) so airs read snappy, like Skate. */
  GRAVITY: 14,
  /** Hard cap on 3D speed (downhill, big transitions). */
  MAX_SPEED: 15,
  /** Collision radius of rider+board on the ground plane. */
  RADIUS: 0.22,

  /* ── pushing ───────────────────────────────────────────────────────── */
  /** Seconds per push stroke (normal / sprint). The kick is the middle of the stroke. */
  PUSH_PERIOD: 0.46,
  SPRINT_PERIOD: 0.38,
  /** Acceleration during the kick part of a stroke, before diminishing returns. */
  PUSH_ACCEL: 9.5,
  SPRINT_ACCEL: 12,
  /** Pushing fades toward zero as speed approaches these caps. */
  PUSH_CAP: 6.8,
  SPRINT_CAP: 8.4,
  /** Kick window inside a stroke (0..1 phase). */
  PUSH_KICK_FROM: 0.12,
  PUSH_KICK_TO: 0.55,
  /** Foot brake deceleration (brake held, not steering hard). */
  BRAKE_DECEL: 5.5,

  /* ── rolling resistance by surface (u/s² constant decel) ───────────── */
  ROLL: { concrete: 0.12, wood: 0.1, metal: 0.09, path: 0.35, cobble: 0.9, grass: 2.6, sand: 3.4 } as Record<string, number>,
  /** Extra per-surface multiplier on push effectiveness. */
  PUSH_GRIP: { concrete: 1, wood: 1, metal: 1, path: 0.95, cobble: 0.8, grass: 0.45, sand: 0.35 } as Record<string, number>,
  /** Quadratic air drag coefficient (decel = k·v²). */
  DRAG: 0.0045,

  /* ── carving ───────────────────────────────────────────────────────── */
  /** Turn radius = TURN_R0 + TURN_RV·speed (so turning tightens when slow). */
  TURN_R0: 0.75,
  TURN_RV: 0.3,
  /** Stationary pivot (kick-turn) rate below PIVOT_SPEED. */
  PIVOT_RATE: 2.6,
  PIVOT_SPEED: 0.7,
  /** Carve/lean smoothing (per second). */
  CARVE_RESPONSE: 9,
  LEAN_RESPONSE: 10,

  /* ── crouch / pump ─────────────────────────────────────────────────── */
  CROUCH_IN_RATE: 8,
  CROUCH_OUT_RATE: 9,
  /** How far the centre of mass travels crouch→stand (units). */
  CROUCH_DROP: 0.3,
  /**
   * Pump efficiency: extending by dh where the path curves (κ) adds
   * v²·κ·dh·PUMP_GAIN of specific kinetic energy (crouching there removes the
   * same; crouch on the flat or in the air, where κ≈0, is free). 1 = textbook.
   */
  PUMP_GAIN: 1.5,
  /**
   * Pumping saturates: v² is read as v²/(1 + v²/VREF²), so a slow rider can pump
   * up to speed but a fast one can't pump to orbit (per-wall gain levels off
   * around CROUCH_DROP·κ·VREF²).
   */
  PUMP_VREF: 4,

  /* ── pop ───────────────────────────────────────────────────────────── */
  /** Rise of the pop at quality 0 and 1 (quality = .6·strength + .4·crouch). */
  POP_H_MIN: 0.16,
  POP_H_MAX: 0.56,
  /** On a transition the pop goes along normal·blend + up·(1−blend). */
  POP_NORMAL_BLEND: 0.45,
  /** Coyote time after rolling off an edge during which a pop still counts. */
  POP_COYOTE: 0.09,
  /** A pop pressed this long before touching down fires on touchdown. */
  POP_BUFFER: 0.1,

  /* ── lips ──────────────────────────────────────────────────────────── */
  /** Horizontal drift back into the ramp over a whole vert air (units). */
  VERT_REENTRY: 0.07,
  /** Extra inward pull when a vert air drifts over the deck. */
  VERT_DECK_PULL: 1.1,
  /** Upward step while grounded (beyond what the slope predicts) that counts as a wall. */
  WALL_STEP: 0.06,
  /** The ground may fall away this much faster than free fall before you go airborne. */
  AIR_EPS: 0.004,

  /* ── air ───────────────────────────────────────────────────────────── */
  SPIN_MAX: 9.5,
  SPIN_RESPONSE: 9,
  /** Spin decay with the stick centred (momentum carries). */
  SPIN_DAMP: 0.6,
  /** Ground pre-wind: body twist (rad) at full steer+crouch and its spin gain. */
  PREWIND_MAX: 0.6,
  PREWIND_GAIN: 8,
  /** Fraction of the carve turn rate carried into the air as spin. */
  CARVE_CARRY: 0.8,
  /** Flip speed = (FLIP_RATE_BASE + FLIP_RATE_STRENGTH·strength)/duration. */
  FLIP_RATE_BASE: 0.85,
  FLIP_RATE_STRENGTH: 0.3,
  /** Late catch window in u (scaled by 1 − .6·difficulty). */
  CATCH_WINDOW: 0.12,
  GRAB_IN: 7,
  GRAB_OUT: 10,
  /** Spin-rate multiplier while a grab is held. */
  GRAB_SPIN: 0.8,

  /* ── landing ───────────────────────────────────────────────────────── */
  LAND_CLEAN_DEG: 25,
  LAND_SKETCHY_DEG: 50,
  /** Speed kept at the worst sketchy angle. */
  LAND_SKETCHY_KEEP: 0.62,
  /** Normal impact speed that bails without / with a crouch (≥ .45). */
  HARD_IMPACT: 7.6,
  HARD_IMPACT_CROUCHED: 11.5,
  /** Flat-landing speed loss per u/s of normal impact above 3. */
  LAND_FLAT_LOSS: 0.05,
  LAND_PHASE: 0.22,
  IMPACT_DECAY: 6,

  /* ── grinds ────────────────────────────────────────────────────────── */
  GRIND_REACH: 0.26,
  GRIND_REACH_ASSIST: 0.42,
  GRIND_ABOVE: 0.2,
  GRIND_BELOW: 0.12,
  /** |cos(travel, rail)| needed to auto-lock / with grindAssist. */
  GRIND_ALIGN: 0.55,
  GRIND_ALIGN_ASSIST: 0.25,
  /** Friction decel for truck grinds / slides (u/s²). */
  GRIND_FRICTION: 0.55,
  SLIDE_FRICTION: 1.5,
  GRIND_MIN_SPEED: 0.35,
  /** Balance: growth rate of the tip, extra per difficulty, wobble, steer authority. */
  GRIND_TIP: 0.9,
  GRIND_TIP_DIFF: 1.3,
  GRIND_WOBBLE: 0.35,
  GRIND_CONTROL: 2.6,
  /** Seconds before the same grindable can be relocked after leaving it. */
  GRIND_COOLDOWN: 0.3,
  /** Sideways speed an ollie out of a rail carries you off it with. */
  GRIND_EXIT_SIDE: 1.3,

  /* ── manuals ───────────────────────────────────────────────────────── */
  MANUAL_MIN_SPEED: 0.8,
  MANUAL_TIP: 0.8,
  MANUAL_WOBBLE: 0.28,
  MANUAL_CONTROL: 2.2,
  MANUAL_PITCH: 0.2,
  MANUAL_FRICTION: 0.25,

  /* ── powerslide / revert ───────────────────────────────────────────── */
  POWERSLIDE_MIN_SPEED: 2,
  BRAKE_SLIDE_SPEED: 3,
  POWERSLIDE_ROT: 11,
  /** Holding the stick hard into the slide rotates it past 90° toward 180°. */
  POWERSLIDE_OVER_RATE: 2.6,
  POWERSLIDE_SCRUB_MIN: 2.2,
  POWERSLIDE_SCRUB_MAX: 7.5,
  REVERT_RATE: 14,
  REVERT_WINDOW: 0.3,
  REVERT_MAX_SPEED: 4,
  REVERT_KEEP: 0.92,

  /* ── bails / world edges ───────────────────────────────────────────── */
  BAIL_TIME: 1.1,
  RECOVER_TIME: 0.35,
  /** Speed into a solid (normal component) that bails instead of stopping. */
  WALL_BAIL_SPEED: 4.2,
  WATER_BAIL_SPEED: 3.2,
  SAFE_EVERY: 0.3,
  /** Practice marker only when rolling slower than this on the ground. */
  MARKER_MAX_SPEED: 1,
} as const;

export type SkateTuning = typeof SKATE_TUNING;
