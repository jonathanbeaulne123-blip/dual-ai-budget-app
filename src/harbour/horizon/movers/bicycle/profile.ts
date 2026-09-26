/**
 * The bicycle's GroundProfile (RIDE §8.1, the bicycle column; D45): the same kernel as the
 * board, a different machine. Roads, spurs and trails; grip 6 / 4.8 (a skid, not a drift: S
 * tails out ≤ 20°); no twist, no charge, no boost, no pop; both brakes at any speed.
 *
 * The pedal: RIDE asks for a continuous 2.5 m/s² to a 6.0 cap (`speeds_ms.bicycle`). The
 * kernel's legs only know Skate v2's stroke (a sin-shaped kick in 0.14–0.44 of each period,
 * mean over the period = 0.3 × pushAccel × (1 − s/cap)^0.8), so the pedal is that stroke with
 * a 0.2 s period (5 Hz: continuous to the eye and the camera) and pushAccel = 2.5 / 0.3.
 * Sprint is the same pedal (a bicycle has no Shift).
 */
import type {GroundProfile} from '../shared/ground/types.ts';
import {BOARD_PROFILE} from '../board/profile.ts';

/** The pedal's mean acceleration from a standstill (RIDE §8.1) and its stroke period. */
export const BICYCLE_PEDAL = Object.freeze({accel: 2.5, cap: 6.0, period: 0.2, windowShare: 0.3});

const pedalAccel = BICYCLE_PEDAL.accel / BICYCLE_PEDAL.windowShare;

export const BICYCLE_PROFILE: GroundProfile = Object.freeze({
  ...BOARD_PROFILE,
  pop: false,
  beds: Object.freeze(['road', 'trail', 'pad']),
  contact: Object.freeze({wheelbase: 1.05, stepMax: 0.10, width: 0.5}),
  grip: Object.freeze({
    ...BOARD_PROFILE.grip,
    // RIDE's 20° is the skid's ceiling; the kernel's hold servo overshoots its target by ~0.6° after the kick, so it aims at 19°.
    roll: 6.0, slide: 4.8, holdAngle: 19, kickYaw: 0.4,
    // The skid never deepens with the stick and never commits to a twist.
    holdDeepen: 0, twistAfter: Infinity,
    // No pendulum: the skid is one-sided, and its pendulumAngle (the board's 70°) is never used.
    pendulumSwing: Infinity,
  }),
  steer: Object.freeze({...BOARD_PROFILE.steer, radius0: 2.0, radiusV: 1.4, yawMax: 2}),
  legs: Object.freeze({
    ...BOARD_PROFILE.legs,
    pushAccel: pedalAccel, pushCap: BICYCLE_PEDAL.cap, sprintAccel: pedalAccel, sprintCap: BICYCLE_PEDAL.cap,
    period: BICYCLE_PEDAL.period, sprintPeriod: BICYCLE_PEDAL.period,
    footBrake: 4.0, brakeSpeedMax: Infinity,
    boostPeak: 0,
  }),
});
