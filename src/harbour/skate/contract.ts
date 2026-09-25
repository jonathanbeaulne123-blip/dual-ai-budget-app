/**
 * Tideline Skate Club v2 — the shared contract.
 *
 * Every track of the v2 rebuild (sim, tricks/input, park, look, camera/HUD)
 * codes against THESE types and nothing else of each other's. A track may add
 * fields it owns; it may not rename or remove a field another track reads.
 * Changing this file is an orchestrator decision.
 *
 * Conventions (inherited from the island, do not change):
 *  - World units are the island's: a person is BODY_HEIGHT = 1.25 tall; the
 *    board deck is ~0.55 long. Scale everything to that, not to real metres.
 *  - Heading/yaw: moving forward at yaw θ is x += sin θ·v, z += cos θ·v
 *    (atan2(dx, dz)). +y is up.
 *  - Deterministic fixed step (SKATE_DT). No Math.random in sim/scoring.
 *  - Recreational only: nothing here reads or writes household money.
 */

export const SKATE_DT = 1 / 120;

/* ------------------------------------------------------------------ world */

export type SurfaceKind = 'grass' | 'path' | 'sand' | 'cobble' | 'concrete' | 'wood' | 'metal';

/** One point of rideable ground, including every ramp/bowl/transition. */
export type SurfaceSample = {
  y: number;
  /** Unit normal, ny > 0. Transitions stop at ≤ 84° so ny ≥ ~0.1. */
  nx: number; ny: number; nz: number;
  kind: SurfaceKind;
  /** Feature id this point belongs to (ramp/bowl/ledge…), or null for open ground. */
  feature: string | null;
  /**
   * Set on the last strip of a transition that ends in open air (quarterpipe
   * coping, kicker lip, bowl edge): the sim launches here instead of following
   * the heightfield over the edge. `lipYaw` is the outward direction (xz) the
   * lip faces — for vert this is where "straight up and back in" is measured.
   */
  lip: null | { lipYaw: number; vert: boolean };
};

export type GrindableKind = 'round-rail' | 'ledge' | 'coping' | 'bench' | 'curb' | 'hubba' | 'kinked-rail';

/** Anything the trucks or deck can lock onto. The polyline is the TOP line. */
export type Grindable = {
  id: string;
  name: string;
  kind: GrindableKind;
  points: readonly (readonly [number, number, number])[];
  /** For ledges/coping/benches: the xz direction the vertical face looks toward (radians), so lipslides/smiths/feebles know which side is which. null for round rails. */
  faceYaw: number | null;
};

/** Solid things you can't ride through (ramp backs, stair risers, planters). Same shape as body obstacles. */
export type SkateSolid =
  | { kind: 'circle'; id: string; x: number; z: number; r: number; top: number; bottom?:number }
  | { kind: 'obox'; id: string; x: number; z: number; halfX: number; halfZ: number; yaw: number; top: number; bottom?:number };

export type SkateSpot = {
  id: string; name: string; words: string;
  x: number; z: number; halfWidth: number; halfDepth: number;
  start: readonly [number, number]; startYaw: number;
};

/** What the sim rides on. The park track implements it; the sim track only consumes it (tests use synthetic fields). */
export interface SkateField {
  /** Lowest overhead deck underside above these feet; Infinity means open air. */
  ceilingAt?(x:number,z:number,feet:number):number;
  sample(x: number, z: number, y?:number,supportId?:string|null): SurfaceSample;
  readonly grindables: readonly Grindable[];
  /** Park solids. The island's own obstacles (buildings, trees, shoreline) are merged in by integration. */
  readonly solids: readonly SkateSolid[];
  readonly spots: readonly SkateSpot[];
}

/* ------------------------------------------------------------------ tricks */

export type Stance = 'regular' | 'goofy';

/** Right-stick directions after stance normalisation: 'toe' = toward the rider's toes, 'heel' = heels, 'nose'/'tail' along the board. */
export type FlickDir = 'tail' | 'nose' | 'toe' | 'heel' | 'tail-toe' | 'tail-heel' | 'nose-toe' | 'nose-heel';

/** A gesture: the ordered directions the stick passed through between pull-back and release/flick. */
export type FlickGesture = readonly FlickDir[];

export type FlipTrickDef = {
  id: string;            // 'kickflip'
  name: string;          // 'Kickflip'
  gesture: FlickGesture; // e.g. ['tail','nose-heel'] for regular — the input track owns the table
  /** Board motion over normalised trick time u∈[0,1], in board space: */
  roll: number;          // full turns about the nose–tail axis (+ = toeside→heelside, kickflip = +1)
  yaw: number;           // half turns about the board's up axis (shuvit = ±1, 360 shuv = ±2)
  pitch: number;         // full turns about the width axis (impossible/nollie-impossible = ±1)
  /** Seconds the board needs in the air at a standard pop before it can be caught. */
  duration: number;
  points: number;
  /** 0 easy … 1 hard; scales catch window strictness. */
  difficulty: number;
};

export type GrabDef = { id: string; name: string; hand: 'front' | 'back'; edge: 'toe' | 'heel' | 'nose' | 'tail'; points: number };

/** Grinds and slides. `deckYaw` is the board angle to the grindable (0 = parallel, truck grinds; π/2 = boardslide/lipslide). */
export type GrindDef = {
  id: string; name: string;
  contact: 'both-trucks' | 'back-truck' | 'front-truck' | 'deck' | 'nose' | 'tail';
  deckYaw: number;
  /** Board pitch while locked (5-0 tail down = negative, nosegrind = positive). */
  deckPitch: number;
  points: number;
  /** Balance difficulty 0..1. */
  difficulty: number;
};

/* ------------------------------------------------------------------ input */

/**
 * What the player MEANS this step, produced by the input track from
 * keyboard / pointer drag / touch pads / Gamepad, stance-normalised, and
 * consumed by the sim. One-shot fields are true/non-null for exactly one step.
 */
export type SkateIntent = {
  /** Left stick. steer −1 left … +1 right; lean −1 back (tail weight) … +1 forward (nose weight). */
  steer: number;
  lean: number;
  push: boolean;          // held (A / W / push pad)
  brake: boolean;         // held — foot brake on flat; powerslide when also steering at speed
  powerslide: boolean;    // held
  /** Right-stick pulled toward tail (or nose for nollie) = crouch, 0..1. Held. */
  crouch: number;
  crouchEnd: 'tail' | 'nose' | null;
  /** One-shot: a completed flick. flipId null = plain ollie/nollie. strength 0..1 from flick speed. */
  pop: null | { from: 'tail' | 'nose'; flipId: string | null; strength: number; charge?: number };
  /** One-shot: a flick done while already airborne (late flip). */
  lateFlip: string | null;
  /** One-shot body somersault while airborne: +1 backflip, -1 frontflip. */
  airFlip?: -1 | 0 | 1;
  /** Held grab (bumper/trigger or grab key); null if none. */
  grab: GrabDef['id'] | null;
  /** Right stick held gently toward tail/nose while rolling = manual/nose manual (held). */
  manual: 'manual' | 'nose-manual' | null;
  /** One-shot revert on landing / in transition. */
  revert: boolean;
  /** Held. Pressed near a grindable while airborne to lock on (auto-lock also allowed when aligned). */
  grindAssist: boolean;
  /** One-shots. */
  respawn: boolean;
  marker: boolean;
  /** Held: skitch/fast push (Shift / R-stick click). */
  sprint: boolean;
};

export const SKATE_NO_INTENT: Readonly<SkateIntent> = Object.freeze({
  steer: 0, lean: 0, push: false, brake: false, powerslide: false, crouch: 0, crouchEnd: null,
  pop: null, lateFlip: null, grab: null, manual: null, revert: false, grindAssist: false,
  respawn: false, marker: false, sprint: false,
});

/* ------------------------------------------------------------------ sim → everyone */

export type SkatePhase =
  | 'idle' | 'push' | 'roll' | 'crouch' | 'air' | 'grind' | 'manual' | 'powerslide' | 'land' | 'bail' | 'recover';

/**
 * Facts the sim emits, in order, each step. Scoring turns these into trick
 * names and points; audio/FX/HUD react to them. The sim never names tricks.
 */
export type SkateSimEvent =
  | { t: number; kind: 'push' }
  | { t: number; kind: 'pop'; from: 'tail' | 'nose'; switch: boolean; fakie: boolean; height: number; flipId: string | null; fromFeature: string | null }
  | { t: number; kind: 'late-flip'; flipId: string }
  | { t: number; kind: 'air-flip'; direction: -1 | 1 }
  | { t: number; kind: 'flip-caught'; flipId: string; quality: number /* 0..1 how close to ideal catch */ }
  | { t: number; kind: 'grab-start' | 'grab-end'; grabId: string; seconds: number }
  | { t: number; kind: 'land'; spinDeg: number /* signed body rotation, frontside +, backside − */; boardClean: number /* 0..1 */; fakie: boolean; switch: boolean; airTime: number; gap: number /* xz distance travelled in air */; onFeature: string | null; revert: boolean }
  /**
   * `frontside` (optional, SIM-owned; approved amendment 2026-09-23): the
   * rider's chest faced the grindable on the way in (regular rolling forward:
   * the grindable on the right of travel). Scoring names "Frontside/Backside
   * Smith Grind" from it; absent = no side word.
   */
  | { t: number; kind: 'grind-start'; grindId: string; grindableId: string; kind2: GrindableKind; switch: boolean; fakie: boolean; frontside?: boolean }
  | { t: number; kind: 'grind-end'; grindId: string; grindableId: string; distance: number; seconds: number; exit: 'ollie' | 'roll' | 'bail' | 'transfer' }
  | { t: number; kind: 'manual-start' | 'manual-end'; manual: 'manual' | 'nose-manual'; distance: number; seconds: number }
  | { t: number; kind: 'powerslide'; seconds: number }
  | { t: number; kind: 'revert' }
  | { t: number; kind: 'lip-trick'; id: 'rock-to-fakie' | 'axle-stall' | 'disaster' }
  | { t: number; kind: 'wallride'; seconds: number }
  | { t: number; kind: 'bail'; reason: 'flip-not-caught' | 'bad-angle' | 'hard-impact' | 'balance' | 'wall' | 'water' }
  | { t: number; kind: 'recovered'; /** True when the sim relocated the rider to a safe pose (the bail spot was not safe to stand on): cameras cut. */ moved?: boolean };

/**
 * Everything the look/camera/presence layers need to draw one frame. Pure data.
 * Orientation is given as the board's rest frame; the look track overlays the
 * active flip-trick rotation itself from `trick` + the FlipTrickDef.
 */
export type SkatePresent = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  speed: number;
  /** Direction of travel in xz. */
  heading: number;
  /** Board yaw (nose direction) and its tilt to match the surface/transition. */
  boardYaw: number; boardPitch: number; boardRoll: number;
  /** Cosmetic whole-rider somersault in radians, zero when upright. */
  airFlip?: number;
  /** Rider shoulder yaw offset from board yaw (pre-wind for spins, look-forward when riding). */
  bodyTwist: number;
  phase: SkatePhase;
  stance: Stance;
  switch: boolean;   // riding with the non-natural foot forward
  fakie: boolean;    // rolling backwards in natural stance
  crouch: number;    // 0..1
  lean: number;      // −1..1 fore/aft weight
  carve: number;     // −1..1 heel/toe edge
  balance: number;   // −1..1 manual/grind balance (0 centred)
  pushPhase: number; // 0..1 through one push stroke
  airTime: number;
  /** Height above the surface directly underneath. */
  clearance: number;
  trick: null | { flipId: string; u: number /* 0..1+, >1 = caught late */ };
  grab: null | { grabId: string; weight: number /* 0..1 ease */ };
  grind: null | { grindId: string; grindableId: string; faceSign: -1 | 1 };
  manual: null | 'manual' | 'nose-manual';
  bail: null | { t: number; reason: string; dirX: number; dirZ: number };
  /** Landing compression this frame 0..1 (decays). */
  impact: number;
  surface: SurfaceKind;
};

/* ------------------------------------------------------------------ scoring → HUD */

export type ScoredTrick = { label: string; points: number };

export type ScoreLine = {
  active: boolean;
  tricks: readonly ScoredTrick[];
  base: number;
  multiplier: number;
  /** 0..1 time left before the line banks on its own while rolling clean. */
  keepAlive: number;
  /** The newest trick label (for the big ticker), e.g. "Nollie Backside 180 Heelflip". */
  latest: string | null;
};

export type ScoreOutcome =
  | { kind: 'banked'; points: number; tricks: readonly string[] }
  | { kind: 'lost'; points: number; reason: string };
