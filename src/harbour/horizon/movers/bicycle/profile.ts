/**
 * The bicycle's bed-legality GroundProfile (RIDE §8.1, the bicycle column; D45): which beds a
 * bicycle wheel may use (roads, spurs, trails and pads, never skate lines or walks) and its
 * contact footprint, grip and steer columns. Road-legality metadata tests and the Mountain
 * modes / bridge audits read it through the board kernel's contact layer.
 *
 * Since 2026-10-04 (Jonathan) it no longer drives the bicycle mover: the bicycle rides the
 * cruiser's sim and speeds (`./controller.ts`). The 6 m/s pedal (`BICYCLE_PEDAL`) that capped the
 * old board-kernel bicycle is removed; the legs here are the board's, with no boost.
 */
import type {GroundProfile} from '../shared/ground/types.ts';
import {BOARD_PROFILE} from '../board/profile.ts';

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
  legs: Object.freeze({...BOARD_PROFILE.legs, footBrake: 4.0, brakeSpeedMax: Infinity, boostPeak: 0}),
});
