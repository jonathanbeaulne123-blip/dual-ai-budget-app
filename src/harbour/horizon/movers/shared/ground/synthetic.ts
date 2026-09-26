/**
 * Test-only ground: a deterministic ContactQuery over a plane, and the board's RIDE §8.1
 * values as a profile the board track starts from. Heading 0 faces +z; a positive grade
 * descends toward +z; a positive bank rises toward +x (gravity pulls to −x).
 */
import {NEUTRAL_INPUT, type ContactQuery, type ContactSample, type GroundEvent, type GroundInput, type GroundProfile, type GroundState, type Pace, type XYZ} from './types.ts';
import {createGroundState, stepGround} from './kernel.ts';
import {boardFrame} from './tyre.ts';

/** RIDE §8.1, the board column. The board's own profile (movers/board/profile.ts) starts from this. */
export const BOARD_TEST_PROFILE: GroundProfile = {
  g: 12,
  pop: true,
  beds: ['skate', 'park', 'pad'],
  contact: {wheelbase: 0.44, stepMax: 0.12, width: 0.31},
  roll: {fast: 0.12, flow: 0.25, slow: 0.6, threshold: 1.8, skate: 0.03, offbed: 6.0},
  drag: 0.0092,
  grip: {roll: 8, slide: 4.5, steerLimit: 0.9, kickOut: 8, kickYaw: 2.2, holdAngle: 40, bite: 5, align: 6, catch: 1.5, slideEntrySpeed: 2.5, holdDeepen: 15, twistAfter: 1.8, twistRate: 120, pendulumSwing: 12, pendulumAngle: 70},
  steer: {radius0: 1.0, radiusV: 0.9, yawResponse: 14, yawDamping: 3.5, yawMax: 4, pivotSpeed: 0.7, pivotRate: 2.6},
  legs: {
    pushAccel: 13, pushCap: 7.0, sprintAccel: 16, sprintCap: 8.4, period: 0.46, sprintPeriod: 0.38, pushSlopeMax: 35,
    pumpGain: 2.2, pumpVref: 2.8, footBrake: 4.0, brakeSpeedMax: 2.5,
    chargeMinSpeed: 3, setDelay: 0.35, chargeTime: 1.2, cleanExitDeg: 25, releaseWindow: 0.5, boostPeak: 2.5, boostTime: 0.6, boostCooldown: 0.4,
  },
  landing: {impactLoss: 0.05, hardImpact: 7.6, hardImpactCrouched: 11.5, forgiveness: 0, wallBail: 4.2},
};

/** MANIFEST v1.7 paces (§8.3): rolling resistance and push grip. */
export const SYNTHETIC_PACES: Record<Pace, { roll: number; pushGrip: number }> = {
  fast: {roll: 0.12, pushGrip: 1}, flow: {roll: 0.25, pushGrip: 0.9}, slow: {roll: 0.6, pushGrip: 0.8},
  threshold: {roll: 1.8, pushGrip: 0.5}, skate: {roll: 0.03, pushGrip: 1}, offbed: {roll: 6.0, pushGrip: 0},
};

export interface SyntheticOptions {
  /** Grade in percent, descending toward +z (15 = S1's average). */
  gradePct?: number;
  /** Bank in degrees, rising toward +x. */
  bankDeg?: number;
  /** Legal bed strip |x| ≤ bedWidth/2; outside is `offbed` (terrain). Default: everywhere legal. */
  bedWidth?: number;
  /** A kerb: the ground steps up by `height` for z ≥ z0. */
  kerb?: { z0: number; height: number };
  /** Water for z ≥ waterBeyond. */
  waterBeyond?: number;
  /** A solid wall for z ≥ wallZ (answered by `blocked`). */
  wallZ?: number;
  /** The bed's pace, surface id and lateral grip (defaults: fast, paved, 1.0). */
  pace?: Pace; material?: string; grip?: number;
  /** A second pace for z ≥ from (a run-out, a pad). */
  paceFrom?: { z: number; pace: Pace; material?: string; grip?: number };
  /**
   * Hairline seams across the deck (R2-05): for |z − seam.z| < width/2 the sample reads the terrain `depth`
   * (default 0.25 m) below the deck: off the bed, grass. A gap is a wide seam.
   */
  seams?: readonly { z: number; width: number; depth?: number }[];
}

export function syntheticQuery(o: SyntheticOptions = {}): ContactQuery {
  const a = Math.tan(((o.bankDeg ?? 0) * Math.PI) / 180), b = -(o.gradePct ?? 0) / 100;
  const m = Math.hypot(a, 1, b), n: XYZ = [-a / m, 1 / m, -b / m];
  const slope = (Math.acos(n[1]) * 180) / Math.PI;
  const half = (o.bedWidth ?? Infinity) / 2;
  const height = (x: number, z: number): number => a * x + b * z + (o.kerb && z >= o.kerb.z0 ? o.kerb.height : 0);
  const legalAt = (x: number): boolean => Math.abs(x) <= half;
  const seamAt = (z: number) => o.seams?.find((s) => Math.abs(z - s.z) < s.width / 2);
  return {
    sample(x: number, z: number): ContactSample {
      const seam = seamAt(z);
      if (seam) {
        const row = SYNTHETIC_PACES.offbed;
        return {y: height(x, z) - (seam.depth ?? 0.25), n: [n[0], n[1], n[2]], slope, pace: 'offbed', legal: false, roll: row.roll, pushGrip: row.pushGrip, material: 'grass', grip: 0.6, bedId: null, padId: null};
      }
      const legal = legalAt(x), zone = o.paceFrom && z >= o.paceFrom.z ? o.paceFrom : null;
      const pace: Pace = legal ? zone?.pace ?? o.pace ?? 'fast' : 'offbed';
      const row = SYNTHETIC_PACES[pace];
      return {
        y: height(x, z), n: [n[0], n[1], n[2]], slope, pace, legal, roll: row.roll, pushGrip: row.pushGrip,
        material: legal ? zone?.material ?? o.material ?? 'paved' : 'grass', grip: legal ? zone?.grip ?? o.grip ?? 1 : 0.6,
        bedId: legal ? 'synthetic' : null, padId: null,
      };
    },
    submerged: (_x: number, z: number): boolean => o.waterBeyond !== undefined && z >= o.waterBeyond,
    blocked: (_x: number, z: number): boolean => o.wallZ !== undefined && z >= o.wallZ,
    nearestBedPoint(x: number, z: number): XYZ {
      const bx = Number.isFinite(half) ? Math.max(-half + 0.5, Math.min(half - 0.5, x)) : x;
      const bz = o.waterBeyond !== undefined ? Math.min(z, o.waterBeyond - 1) : z;
      return [bx, height(bx, bz), bz];
    },
  };
}

/** A state on the query's ground at (x, z), facing `heading`, rolling at `speed` along the board. */
export function rideStart(query: ContactQuery, x: number, z: number, heading: number, speed: number): GroundState {
  const c = query.sample(x, z, 0);
  const st = createGroundState([x, c ? c.y : 0, z], heading);
  if (c) st.contact.n = [c.n[0], c.n[1], c.n[2]];
  const f = boardFrame(heading, 1, st.contact.n);
  st.v = [f.a[0] * speed, f.a[1] * speed, f.a[2] * speed];
  return st;
}

export type RideScript = (t: number, state: GroundState) => Partial<GroundInput>;
/** Steps a script for `seconds` (t = the step's start time); `each` sees the state after every step. Returns all events. */
export function runScript(state: GroundState, query: ContactQuery, profile: GroundProfile, script: RideScript, seconds: number, each?: (state: GroundState, events: GroundEvent[], t: number) => void): GroundEvent[] {
  const all: GroundEvent[] = [], n = Math.round(seconds * 120);
  for (let i = 0; i < n; i++) {
    const ev = stepGround(state, {...NEUTRAL_INPUT, ...script(i / 120, state)}, query, profile);
    all.push(...ev);
    each?.(state, ev, (i + 1) / 120);
  }
  return all;
}
