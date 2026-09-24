/**
 * Tideline Skate Club v2 · SIM tuning table.
 *
 * Every number the ride "feels" through lives here, so playtest tuning is one
 * file. Units are island units (a person is 1.25 tall, the deck ~0.55 long),
 * seconds and radians. Speeds are u/s, accelerations u/s².
 *
 * Reference points at these values (checked by test/skate-sim*.test.ts and, on the real
 * park, test/skate-int-feel.test.ts; feel pass wave 3 2026-09-23 — each changed constant says why):
 *  - push cruise ≈ 6.5 u/s (0→5 in 2 s); sprint ~8; cobbles 6.2 (0→5 in 2.5 s)
 *  - standard ollie (strength .5, crouch .7) rises ≈ 0.39, max pop ≈ 0.56
 *  - ollie air ≈ 0.5 s → a 180 is comfortable, a 360 is out of reach on flat; a 360 lands off
 *    the Hatch at 8–9 u/s (0.9–1.4 above the lip)
 *  - 1.97-tall vert quarterpipe entered at 10 / 11.5 u/s → ≈ 1.0 / 1.2 s of air
 *  - the Breadbin (0.85 mini): a good pumper clears the coping by wall 3 and levels off ~1.1
 *    above it, centred for as long as you pump
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
  /**
   * Acceleration during the kick part of a stroke, before diminishing returns. Feel pass: a
   * shorter, harder kick (window .12–.55 → .14–.44, accel 9.5/12 → 13/16, same impulse) so each
   * stroke lands as a surge (+1.6 u/s in 0.14 s from rest) with the same cadence and top speed.
   */
  PUSH_ACCEL: 13,
  SPRINT_ACCEL: 16,
  /** Pushing fades toward zero as speed approaches these caps. */
  PUSH_CAP: 6.8,
  SPRINT_CAP: 8.4,
  /** Kick window inside a stroke (0..1 phase). */
  PUSH_KICK_FROM: 0.14,
  PUSH_KICK_TO: 0.44,
  /** Foot brake deceleration (brake held, not steering hard). */
  BRAKE_DECEL: 5.5,

  /* ── rolling resistance by surface (u/s² constant decel) ───────────── */
  /**
   * Feel pass: path .35 → .16 (lanes ride like concrete), cobble .9 → .42 (felt, not punishing:
   * cruise 5.2 → 6.2, 0→5 u/s in 2.5 s instead of 5.3), grass 2.6 → 1.9 and sand 3.4 → 2.6 so a
   * rider who rolls off can still crawl back to a path (was stuck at 0.3 u/s).
   */
  ROLL: { concrete: 0.12, wood: 0.1, metal: 0.09, path: 0.16, cobble: 0.42, grass: 1.9, sand: 2.6 } as Record<string, number>,
  /** Extra per-surface multiplier on push effectiveness (feel pass: path 1, cobble .95, grass .62, sand .55). */
  PUSH_GRIP: { concrete: 1, wood: 1, metal: 1, path: 1, cobble: 0.95, grass: 0.62, sand: 0.55 } as Record<string, number>,
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
  PUMP_GAIN: 2.2,
  /**
   * Pumping saturates: v² is read as v²/(1 + v²/VREF²), so a slow rider can pump
   * up to speed but a fast one can't pump to orbit (per-wall gain levels off
   * around CROUCH_DROP·κ·VREF²).
   */
  PUMP_VREF: 2.8,

  /* ── pop ───────────────────────────────────────────────────────────── */
  /** Rise of the pop at quality 0 and 1 (quality = .6·strength + .4·crouch). */
  POP_H_MIN: 0.16,
  POP_H_MAX: 0.56,
  /** On a transition the pop goes along normal·blend + up·(1−blend). */
  POP_NORMAL_BLEND: 0.45,
  /**
   * A pop while already rising (kicker/bank lip, coyote after a launch) adds
   * this × its own height to the launch height (energy add) instead of adding
   * velocities. New in the feel pass: kicker airs are ≈ 0.8–1.3 above the lip
   * at 7–9 u/s instead of 2–2.5, so flips off the Hatch are landable.
   */
  POP_ON_RISE: 1.15,
  /** Coyote time after rolling off an edge during which a pop still counts. */
  POP_COYOTE: 0.09,
  /** A pop pressed this long before touching down fires on touchdown. */
  POP_BUFFER: 0.1,

  /* ── lips ──────────────────────────────────────────────────────────── */
  /** Horizontal drift back into the ramp over a whole vert air (units). */
  VERT_REENTRY: 0.07,
  /**
   * Fraction of the along-coping velocity a vert air keeps when you are not
   * carving (carving into the lip keeps all of it). Feel pass 2026-09-23: 1 → .1
   * so un-steered airs come straight back in, as in Skate.
   */
  VERT_CARRY: 0.1,
  /**
   * An angled vert air with the stick centred turns the board (rad/s, not counted as spin) to
   * meet the line it comes back down, so it lands fakie instead of 40–80° across. Feel pass.
   */
  VERT_ALIGN_RATE: 4,
  /** Extra inward pull when a vert air drifts over the deck. */
  VERT_DECK_PULL: 1.1,
  /** Upward step while grounded (beyond what the slope predicts) that counts as a wall. */
  WALL_STEP: 0.06,
  /** The ground may fall away this much faster than free fall before you go airborne. */
  AIR_EPS: 0.004,

  /* ── air ───────────────────────────────────────────────────────────── */
  SPIN_MAX: 9.5,
  SPIN_RESPONSE: 9,
  /**
   * Spin decay with the stick centred. Feel pass .6 → 5: letting go of the stick all but stops
   * the spin (≈ 100° more from full rate, was ~900°), so a person can stop on a 180.
   */
  SPIN_DAMP: 5,
  /**
   * Stick centred and within SPIN_SETTLE_WINDOW of a board line (0°/180° to travel), the spin
   * eases the board onto it (rate = gain × error), like a skater squaring up to land. Feel pass.
   */
  SPIN_SETTLE_GAIN: 7,
  SPIN_SETTLE_WINDOW: 1.1,
  /** Ground pre-wind: body twist (rad) at full steer+crouch and its spin gain. */
  PREWIND_MAX: 0.6,
  PREWIND_GAIN: 8,
  /** Fraction of the carve turn rate carried into the air as spin. */
  CARVE_CARRY: 0.8,
  /** Flip speed = (FLIP_RATE_BASE + FLIP_RATE_STRENGTH·strength)/duration. */
  FLIP_RATE_BASE: 0.85,
  FLIP_RATE_STRENGTH: 0.3,
  /**
   * Flick-it pops when the flick lands, not on release; a flip that lands within this of the
   * pop replaces the popped one (a corner corrected a beat late). A flip whose gesture carries
   * on from the popped one (double, triple) replaces it any time before the catch. Feel pass.
   */
  FLIP_CORRECT_TIME: 0.15,
  /**
   * Late catch window in u, scaled by 1 − CATCH_DIFFICULTY·difficulty. Feel pass .12/.6 → .2/.7:
   * a kickflip may touch down at 84 % of its flip (was 90 %), a triple still needs 92 %.
   */
  CATCH_WINDOW: 0.2,
  CATCH_DIFFICULTY: 0.7,
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
  /**
   * The tightest turn gravity can steer a rolling board through (sideways force on a tilted deck
   * turns the trucks toward the fall line). Feel pass, replacing WHEEL_GRIP_SPEED (full grip
   * below 2.2 u/s, none above — a jump in behaviour at 2.2): slow at a wall's peak the board keeps
   * its line and rolls back fakie; at speed an angled line carves round as before.
   */
  SELF_STEER_RADIUS: 0.9,
  /**
   * Sideways slip the wheels cancel at any speed (u/s²); the cancelling fades
   * out by twice this. New in the feel pass: ≈ 6° of cross-slope, so a pad's
   * drainage fall (1.4°, ≈0.35 u/s²) no longer walks you off the Breadbin
   * (0.35 → 0.002 per wall), while a genuine angle up a wall (≥ 3 u/s²
   * sideways) turns you exactly as before.
   */
  LATERAL_GRIP: 1.5,
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
  /**
   * Balance: growth rate of the tip, extra per difficulty, its growth per second held, wobble,
   * steer authority. Feel pass (.9/1.3/0/.35 → .6/1.8/.1/.3): an easy grind drifts gently (a
   * 50-50 left alone falls in ~1.5 s, was 1.2) and a hard one fast (a noseblunt in ~0.8 s); the
   * longer you hold one, the livelier it gets.
   */
  GRIND_TIP: 0.6,
  GRIND_TIP_DIFF: 1.8,
  GRIND_TIP_GROWTH: 0.1,
  GRIND_WOBBLE: 0.3,
  GRIND_CONTROL: 2.6,
  /** Seconds before the same grindable can be relocked after leaving it. */
  GRIND_COOLDOWN: 0.3,
  /** Sideways speed an ollie out of a rail carries you off it with. */
  GRIND_EXIT_SIDE: 1.3,

  /* ── manuals ───────────────────────────────────────────────────────── */
  MANUAL_MIN_SPEED: 0.8,
  MANUAL_TIP: 0.8,
  /**
   * The tip grows this much per second of manual (feel pass, was 0): balanceable, not trivial —
   * a person reacting in ~0.2 s holds one for 6–10 s, not forever.
   */
  MANUAL_TIP_GROWTH: 0.15,
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

  /* ── wallride ──────────────────────────────────────────────────────── */
  /** Popped into a tall face travelling along it at least this fast (and within WALLRIDE_ANGLE of it). */
  WALLRIDE_MIN_SPEED: 3.5,
  WALLRIDE_ANGLE: 0.7,
  /** Face must stand this far above the board. */
  WALLRIDE_MIN_HEIGHT: 0.6,
  /** Gravity fraction while on the wall, max time, speed lost per second. */
  WALLRIDE_GRAVITY: 0.35,
  WALLRIDE_MAX_TIME: 0.8,
  WALLRIDE_FRICTION: 1.2,
  WALLRIDE_EXIT_PUSH: 1.4,

  /* ── bails / world edges ───────────────────────────────────────────── */
  /** Feel pass 1.1/.35 → .8/.25: back on the board a little over a second after a slam. */
  BAIL_TIME: 0.8,
  /**
   * Integration (wave 3) .25 → .48: the get-up. Control comes back as the look's
   * get-up (look/boardRig.ts RIG.recoverSeconds .6) stamps the board under the
   * feet, so a rider never rolls away while still lying on the ground.
   */
  RECOVER_TIME: 0.48,
  /** Getting up in place (integration): the board's footprint must be this flat (normal y) … */
  GET_UP_MIN_NY: 0.93,
  /** … with no step, stair edge or rail higher than this under it; otherwise relocate to a safe pose. */
  GET_UP_STEP: 0.06,
  /** Speed into a solid (normal component) that bails instead of stopping. */
  WALL_BAIL_SPEED: 4.2,
  /** Soft solids (the park's dressing, \`extraSolids\`) never bail: the speed into one is absorbed and this share of the rest is kept. */
  SOFT_BUMP_KEEP: 0.8,
  WATER_BAIL_SPEED: 3.2,
  SAFE_EVERY: 0.3,
  /** Practice marker only when rolling slower than this on the ground. */
  MARKER_MAX_SPEED: 1,
} as const;

export type SkateTuning = typeof SKATE_TUNING;
