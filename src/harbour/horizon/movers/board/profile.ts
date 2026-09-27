/**
 * The board's GroundProfile (RIDE §8.1, the board column) and the Tideline park overlay.
 *
 * The values are the kernel's `BOARD_TEST_PROFILE` (synthetic.ts), copied rather than imported
 * because synthetic.ts is the kernel's test ground; `test/horizonBoardThresholds.test.ts`
 * asserts the two stay equal. Every field is fixed by RIDE; the eight knobs (§8.2) change by a
 * decision, never here by feel. No cast: a field the kernel adds that this object lacks is a type error.
 * The centred-stick S hold is the kernel's pendulum speed check (pendulumSwing 12°, pendulumAngle 70°):
 * the board swings ±70° across the travel, changing side every 12° of travel turn, so a straight S hold
 * brakes without walking off a 4 m bed. A stick-held S hold stays one-sided at holdAngle 40°.
 */
import type {GroundProfile} from '../shared/ground/types.ts';
import type {WorldDefinition} from '../../world/definition.ts';
import type {HORIZON_MANIFEST} from '../../world/manifest.ts';
import {HORIZON_G} from '../../runtime/geography.ts';

export const BOARD_PROFILE: GroundProfile = Object.freeze({
  g: HORIZON_G,   // one g for the walker, the ground kernel and the wings (RIDE §11 ask 7, D40)
  pop: true,
  beds: Object.freeze(['skate', 'park', 'pad']),
  contact: Object.freeze({wheelbase: 0.44, stepMax: 0.12, width: 0.31}),
  roll: Object.freeze({fast: 0.12, flow: 0.25, slow: 0.6, threshold: 1.8, skate: 0.03, offbed: 6.0}),
  drag: 0.0092,
  grip: Object.freeze({roll: 8, slide: 4.5, steerLimit: 0.9, kickOut: 8, kickYaw: 2.2, holdAngle: 40, bite: 5, align: 6, catch: 1.5, slideEntrySpeed: 2.5, holdDeepen: 15, twistAfter: 1.8, twistRate: 120, pendulumSwing: 12, pendulumAngle: 70}),
  steer: Object.freeze({radius0: 1.0, radiusV: 0.9, yawResponse: 14, yawDamping: 3.5, yawMax: 4, pivotSpeed: 0.7, pivotRate: 2.6}),
  legs: Object.freeze({
    pushAccel: 13, pushCap: 7.0, sprintAccel: 16, sprintCap: 8.4, period: 0.46, sprintPeriod: 0.38, pushSlopeMax: 35,
    pumpGain: 2.2, pumpVref: 2.8, footBrake: 4.0, brakeSpeedMax: 2.5,
    chargeMinSpeed: 3, setDelay: 0.35, chargeTime: 1.2, cleanExitDeg: 25, releaseWindow: 0.5, boostPeak: 2.5, boostTime: 0.6, boostCooldown: 0.4,
  }),
  landing: Object.freeze({impactLoss: 0.05, hardImpact: 7.6, hardImpactCrouched: 11.5, forgiveness: 0, wallBail: 4.2}),
});

/**
 * The Tideline park's forgiveness (RIDE §7, D40: "assist = forgiving landings only"). RIDE names
 * no number; 0.5 lifts the hard-impact limits by half and halves the impact loss inside the park.
 */
export const PARK_FORGIVENESS = 0.5;

/** The board inside the Tideline park: the same profile with forgiving landings. */
export const BOARD_PARK_PROFILE: GroundProfile = Object.freeze({
  ...BOARD_PROFILE,
  landing: Object.freeze({...BOARD_PROFILE.landing, forgiveness: PARK_FORGIVENESS}),
});

export interface ParkBox { x: number; z: number; hw: number; hd: number }

/** The park's plan box (manifest.skate.park, scaled like the contact adapter's). */
export function parkBox(world: Pick<WorldDefinition, 'scaleFactor'>, manifest: typeof HORIZON_MANIFEST): ParkBox {
  const s = world.scaleFactor ?? 1, p = manifest.skate.park;
  return {x: p.xy[0]! * s, z: p.xy[1]! * s, hw: p.size[0]! * s / 2, hd: p.size[1]! * s / 2};
}

export const inParkBox = (box: ParkBox, x: number, z: number): boolean => Math.abs(x - box.x) <= box.hw && Math.abs(z - box.z) <= box.hd;

/**
 * The profile the kernel steps with at (x, z): the park overlay inside the park's box, the
 * base profile elsewhere. A profile whose landing already forgives (or a non-board mover) is
 * returned unchanged outside the park.
 */
export function boardProfileAt(base: GroundProfile, box: ParkBox | null, x: number, z: number): GroundProfile {
  if (!box || !base.beds.includes('park') || !inParkBox(box, x, z)) return base;
  return parkOverlay(base);
}

const overlays = new WeakMap<GroundProfile, GroundProfile>([[BOARD_PROFILE, BOARD_PARK_PROFILE]]);
/** The park overlay of any profile (cached: the kernel reads it every step). */
export function parkOverlay(base: GroundProfile): GroundProfile {
  let o = overlays.get(base);
  if (!o) { o = {...base, landing: {...base.landing, forgiveness: Math.max(base.landing.forgiveness, PARK_FORGIVENESS)}}; overlays.set(base, o); }
  return o;
}
