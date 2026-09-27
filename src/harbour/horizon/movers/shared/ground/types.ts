/**
 * The ground kernel's contract (RIDE §2, worksession 2026-09-26 "The kernel contract").
 * Pure types and constants: no three, no DOM, no clock, no RNG. Contact (C), the seams (I)
 * and the board (B) code against this file verbatim.
 */
export type XYZ = [number, number, number];
export type Pace = 'fast' | 'flow' | 'slow' | 'threshold' | 'skate' | 'offbed';
export type ContactKind = 'ground' | 'air' | 'rail' | 'wall';

/** One ground sample under a point. `legal` = this mover's wheels roll here (profile.beds or a pad). */
export interface ContactSample { y: number; n: XYZ; material: string; pace: Pace; legal: boolean; roll: number; grip: number; pushGrip: number; slope: number; bedId: string | null; padId: string | null }
export interface ContactQuery {
  sample(x: number, z: number, y: number): ContactSample | null;        // null = no ground (void)
  submerged(x: number, z: number, y: number): boolean;
  blocked(x: number, z: number, y: number, radius: number, travel: [number, number]): boolean;   // a solid the wheels cannot pass (a lip taller than stepMax is decided by the kernel from samples, not here)
  nearestBedPoint(x: number, z: number): XYZ | null;                     // for the fade back (RIDE §6.5)
}

/**
 * RIDE §8.1, every field. Angles named `*Deg`/`holdAngle`/`pushSlopeMax` are degrees; rates are
 * per second; accelerations m/s². Fields RIDE does not list are marked "kernel" and explained
 * in HANDOFF-notes/kernel.md. Profiles (with their values) belong to the movers, not here.
 */
export interface GroundProfile {
  /** kernel: one g for every Horizon mover (D40), 12. */
  g: number;
  /** kernel: whether this mover can pop (the bicycle cannot). */
  pop: boolean;
  /** Bed kinds this mover's wheels roll on; everything else is `offbed` (the contact adapter reads it). */
  beds: readonly string[];
  contact: { wheelbase: number; stepMax: number; width: number };
  /** Rolling resistance by pace (MANIFEST.paces) + the kernel's offbed class. */
  roll: Record<Pace, number>;
  drag: number;
  grip: {
    roll: number; slide: number; steerLimit: number; kickOut: number; kickYaw: number;
    holdAngle: number; bite: number; align: number; catch: number; slideEntrySpeed: number;
    /** kernel: degrees the S hold deepens (+) or shallows (−) at full stick into / against the rotation. */
    holdDeepen: number;
    /** kernel: seconds of S + stick held into the rotation before the hold commits to the twist (Infinity = never). */
    twistAfter: number;
    /** kernel: degrees per second the committed hold target keeps coming round. */
    twistRate: number;
    /**
     * kernel: the pendulum speed check. With S held and the stick centred, once the travel heading has
     * turned this many degrees (toward the nose) since the kick or the last swing, the hold swings through
     * to the other side. Board 12°; Infinity = one-sided hold (the bicycle).
     */
    pendulumSwing: number;
    /** kernel: |β| the centred-stick pendulum holds (board 70°; missing = holdAngle). The one-sided hold keeps holdAngle. */
    pendulumAngle?: number;
  };
  steer: {
    radius0: number; radiusV: number; yawResponse: number; yawDamping: number; yawMax: number; pivotSpeed: number;
    /** kernel: in-place pivot rate at a standstill (Skate v2 PIVOT_RATE 2.6). */
    pivotRate: number;
  };
  legs: {
    pushAccel: number; pushCap: number; sprintAccel: number; sprintCap: number; period: number; sprintPeriod: number; pushSlopeMax: number;
    pumpGain: number; pumpVref: number; footBrake: number; brakeSpeedMax: number;
    chargeMinSpeed: number; setDelay: number; chargeTime: number; cleanExitDeg: number; releaseWindow: number; boostPeak: number; boostTime: number; boostCooldown: number;
  };
  landing: { impactLoss: number; hardImpact: number; hardImpactCrouched: number; forgiveness: number; wallBail: number };
}

export interface GroundInput { steer: number /* -1..1, +1 = right (D) */; push: boolean; slide: boolean; pop: boolean; sprint: boolean; crouch: number /* 0..1 */ }

/** kernel: step-to-step memory the contract's fields do not carry (edges, buffers, the boost burst). Read-only for everyone else. */
export interface GroundLatch {
  prevPush: boolean; prevPop: boolean; prevCrouch: number;
  popBuffer: number; popped: boolean;
  /** side: the sign of β the S hold keeps (−kick sense), set by the kick; flips with the twist. */
  kicked: boolean; side: 1 | -1; sliding: boolean; intoFor: number;
  /** swingRef: the pendulum's reference travel heading (atan2(vx, vz)): half a swing behind the line at the kick, a landing, a twist or the last stick input under the hold; the travel at the last pendulum flip. */
  swingRef: number;
  boostAccel: number; kappa: number;
}

export interface GroundState {
  p: XYZ; v: XYZ; heading: number; yawRate: number; grip: number; lead: 1 | -1;
  contact: { on: boolean; kind: ContactKind; n: XYZ; material: string; pace: Pace; slope: number; legal: boolean; pitch: number };
  /** stroke: push phase 0..1 while stroking, −1 idle. crouch: pose only (max of player crouch and charge). window/boost/cooldown: seconds left. */
  legs: { stroke: number; crouch: number; charge: number; window: number; boost: number; cooldown: number };
  offbedFor: number; stopped: number; airborneFor: number; slideFor: number; step: number;
  latch: GroundLatch;
}
export type GroundEvent = { kind: 'slideStart' | 'slideEnd' | 'twist' | 'boostReady' | 'boost' | 'boostLost' | 'lip' | 'airborne' | 'land' | 'bail' | 'fadeBack' | 'water'; step: number; data?: Record<string, number | string> };

export const GROUND_DT = 1 / 120;
/** Safety only (RIDE §2.4): never reached by tuning. */
export const GROUND_MAX_SPEED = 15;
export const NEUTRAL_INPUT: Readonly<GroundInput> = Object.freeze({ steer: 0, push: false, slide: false, pop: false, sprint: false, crouch: 0 });
