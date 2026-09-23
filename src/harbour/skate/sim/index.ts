/**
 * Tideline Skate Club v2 · the deterministic skate simulation.
 *
 * SkateIntent + SkateField → SkatePresent + SkateSimEvent[], at a fixed
 * SKATE_DT. Pure: no three.js, no DOM, no clock, no Math.random.
 *
 * Model in one paragraph: the rider is a point on the field's surface with a
 * real 3D velocity. Grounded, velocity lives in the tangent plane of
 * `field.sample()`'s normal; gravity's tangential part speeds you down
 * transitions, and speed is re-derived from energy after every move so a
 * mini-ramp carries you up one wall and back without numeric gain or loss
 * (friction, drag and your own pumping are the only energy changes). Lips
 * launch (vert: straight up and back in; kickers: along the tangent). In the
 * air the body+board spin, flips run on normalised trick time, and landing
 * is JUDGED (catch, angle, impact). Grinds lock onto `field.grindables`
 * polylines and pick a catalog def from the approach.
 *
 * Conventions (see NOTES-sim.md):
 *  - yaw: forward at yaw θ is (sin θ, cos θ); +yaw is counter-clockwise seen from above.
 *  - boardPitch/boardRoll are three.js Euler 'YXZ' angles for a deck whose nose is +z:
 *    pitch > 0 = nose DOWN (so 5-0 tail-down is negative, as in GrindDef), roll > 0 = the
 *    deck's left edge (+x local) up.
 *  - spinDeg > 0 = frontside. Regular rider rolling forward: counter-clockwise from above
 *    is frontside; goofy mirrors, and so does riding with the non-natural foot leading
 *    (fakie or switch).
 *  - `present` and the `events` array are LIVE objects reused every step (no per-frame
 *    allocation); copy them if you need to keep a frame.
 */
import { SKATE_DT, type FlipTrickDef, type GrabDef, type GrindDef, type SkateField, type SkateIntent, type SkatePresent, type SkateSimEvent, type Stance, type SurfaceKind, type SurfaceSample } from '../contract.ts';
import type { Obstacle } from '../../body/obstacles.ts';
import { SKATE_TUNING as T } from './tuning.ts';
import { approach, buildLines, clamp, ease, fin, hit, linePoint, nearestXZ, pointAt, pushOutAll, wrap, type GrindLine } from './geometry.ts';
import { isSlide, selectGrind } from './grind.ts';

export { SKATE_TUNING } from './tuning.ts';
export { selectGrind, wantedContact, type GrindApproach } from './grind.ts';

export type SkateCatalogs = {
  flips: ReadonlyMap<string, FlipTrickDef>;
  grinds: ReadonlyMap<string, GrindDef>;
  grabs: ReadonlyMap<string, GrabDef>;
  /**
   * Optional grind namer (integration injects TRICKS' `resolveGrind`). Given the
   * approach measured at lock it returns a def id from `grinds`; when absent, or
   * when it names an id the catalog lacks, the sim falls back to `selectGrind`.
   */
  resolveGrind?: (a: GrindLockApproach) => string;
};
/**
 * The approach at the moment of lock, in the rider's frame (see NOTES-sim.md):
 *  - `deckYawToLine` signed angle of the front-foot end to the line, |·| ≤ π/2,
 *    + = that end is on the FAR side (away from where the rider came from);
 *  - `lean` −1 tail … +1 nose (front foot);
 *  - `overLine` the board's centre had already crossed the line by > 6 cm when
 *    it locked (popped over it): blunts;
 *  - `faceSide` always 0 here — the sign of `deckYawToLine` is already measured
 *    against the approach side;
 *  - `frontside` the rider's chest faced the grindable on the way in;
 *  - `push` the left stick sideways at contact, + = swinging the front-foot end over the line
 *    (toward the far side), − = back toward the approach side (feel pass: the stick picks the grind).
 */
export type GrindLockApproach = { deckYawToLine: number; lean: number; overLine: boolean; faceSide: -1 | 0 | 1; frontside: boolean; push: number };
export type SkateSimOptions = {
  x: number; z: number; yaw: number; stance: Stance; reducedAssist?: boolean;
  /** Island obstacles (buildings/trees) in body-obstacle form; injected by integration. */
  islandObstacles?: readonly Obstacle[];
  /** Shoreline clamp (e.g. body/obstacles.ts holdAshore); injected by integration. */
  shore?: (x: number, z: number) => { x: number; z: number; ashore: boolean };
};
export type SkateSim = {
  step(intent: SkateIntent, dt: number): { present: SkatePresent; events: readonly SkateSimEvent[] };
  present(): SkatePresent;
  reset(x: number, z: number, yaw: number): void;
  setStance(s: Stance): void;
  save(): unknown;
  load(saved: unknown): void;
  setMarker(): boolean;
  toMarker(): void;
};

/* ─────────────────────────────────────────────────────────── state */

type Mode = 'ground' | 'air' | 'grind' | 'bail' | 'recover';
type PopReq = { from: 'tail' | 'nose'; flipId: string | null; strength: number; age: number };
type TrickS = { flipId: string; u: number; rate: number; caught: boolean; difficulty: number; yawTurns: number; at: number };
type GrabS = { grabId: string; weight: number; seconds: number; on: boolean };
type GrindS = {
  li: number; s: number; dir: 1 | -1; speed: number; defId: string; gid: string; seconds: number; distance: number;
  faceSign: 1 | -1; yawOff: number; pitch: number; slide: boolean; difficulty: number; coping: boolean; inX: number; inZ: number; seed: number;
  /** The rider's chest faced the grindable on the way in (grind-start `frontside`). */
  fs: boolean;
};
type StallS = { id: 'rock-to-fakie' | 'axle-stall'; t: number; inX: number; inZ: number; feature: string };
/** On a wall: outward normal (nx,nz) of the face, which side of the rider it is on, what it is. */
type WallS = { id: string; nx: number; nz: number; side: 1 | -1; t: number; field: boolean };
type ManualS = { kind: 'manual' | 'nose-manual'; seconds: number; distance: number; seed: number };
type SlideS = { side: 1 | -1; over: number; seconds: number };
type Pose = { x: number; z: number; yaw: number };

type SimState = {
  ver: 2; t: number; acc: number; seq: number;
  mode: Mode;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  boardYaw: number; boardPitch: number; boardRoll: number; bodyTwist: number; slideAngle: number;
  lead: 1 | -1; feetSwapped: boolean; stance: Stance;
  crouch: number; crouchPeak: number; lean: number; carve: number; turnRate: number;
  pushPhase: number; stroke: boolean;
  gnx: number; gny: number; gnz: number; kind: SurfaceKind; feature: string | null; kappa: number; clearance: number;
  airTime: number; spin: number; spinRate: number; toX: number; toZ: number; toY: number; footSign: 1 | -1;
  /** +1 when the front-foot end led at take-off (the stick's "toward the rail" is read in its terms). */
  airFF: 1 | -1;
  vert: boolean; lipYaw: number; lipY: number; coyote: number; airFromPop: boolean; airLaunch: boolean;
  /** Heading of the line a vert air comes back down (NaN: square-on, nothing to turn). */
  vertAlign: number;
  trick: TrickS | null; grab: GrabS | null;
  pendPop: PopReq | null; pendLate: { id: string; age: number } | null; pendRevert: number;
  grind: GrindS | null; stall: StallS | null; wall: WallS | null; cooldownLine: number; cooldown: number; balance: number;
  manual: ManualS | null; manualResume: boolean;
  slide: SlideS | null;
  landTimer: number; sinceLand: number; impact: number;
  bail: { t: number; reason: string; dirX: number; dirZ: number } | null; recoverT: number;
  safe: Pose[]; safeT: number;
  marker: Pose | null; spawn: Pose;
};

type Sample = { y: number; nx: number; ny: number; nz: number; kind: SurfaceKind; feature: string | null; lip: SurfaceSample['lip'] };
const sampleScratch = (): Sample => ({ y: 0, nx: 0, ny: 1, nz: 0, kind: 'concrete', feature: null, lip: null });
const KINDS: ReadonlySet<string> = new Set(['grass', 'path', 'sand', 'cobble', 'concrete', 'wood', 'metal']);
const FALLBACK_GRIND: GrindDef = { id: '50-50', name: '50-50', contact: 'both-trucks', deckYaw: 0, deckPitch: 0, points: 0, difficulty: 0.2 };

/* ─────────────────────────────────────────────────────────── factory */

export function createSkateSim(field: SkateField, catalogs: SkateCatalogs, opts: SkateSimOptions): SkateSim {
  const G = T.GRAVITY, DT = SKATE_DT;
  const lines: GrindLine[] = buildLines(field.grindables ?? []);
  const island: readonly Obstacle[] = opts.islandObstacles ?? [];
  const solids = field.solids ?? [];
  const shore = opts.shore ?? null;
  const reduced = opts.reducedAssist === true;
  const flips = catalogs.flips, grinds = catalogs.grinds, grabs = catalogs.grabs, resolve = catalogs.resolveGrind ?? null;

  // Scratch (no per-step allocation).
  const S0 = sampleScratch(), S1 = sampleScratch(), SX = sampleScratch();
  const LP = linePoint(), LQ = linePoint(), H = hit();
  const events: SkateSimEvent[] = [];
  const I = { steer: 0, lean: 0, push: false, brake: false, powerslide: false, crouch: 0, grab: null as string | null, manual: null as 'manual' | 'nose-manual' | null, grindAssist: false, sprint: false };

  const P: SkatePresent = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, heading: 0, boardYaw: 0, boardPitch: 0, boardRoll: 0, bodyTwist: 0,
    phase: 'idle', stance: 'regular', switch: false, fakie: false, crouch: 0, lean: 0, carve: 0, balance: 0, pushPhase: 0,
    airTime: 0, clearance: 0, trick: null, grab: null, grind: null, manual: null, bail: null, impact: 0, surface: 'concrete',
  };
  const pTrick = { flipId: '', u: 0 }, pGrab = { grabId: '', weight: 0 };
  const pGrind: { grindId: string; grindableId: string; faceSign: -1 | 1 } = { grindId: '', grindableId: '', faceSign: 1 };
  const pBail = { t: 0, reason: '', dirX: 0, dirZ: 1 };

  function sample(x: number, z: number, out: Sample, fallbackY: number): Sample {
    let s: SurfaceSample | null = null;
    try { s = field.sample(x, z); } catch { s = null; }
    const y = s && Number.isFinite(s.y) ? s.y : fallbackY;
    let nx = fin(s?.nx), ny = fin(s?.ny, 1), nz = fin(s?.nz);
    if (ny < 0.08) ny = 0.08;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    out.y = y; out.nx = nx; out.ny = ny; out.nz = nz;
    out.kind = s && KINDS.has(s.kind) ? s.kind : 'concrete';
    out.feature = s && typeof s.feature === 'string' ? s.feature : null;
    out.lip = s && s.lip && Number.isFinite(s.lip.lipYaw) ? s.lip : null;
    return out;
  }

  function freshState(x: number, z: number, yaw: number, stance: Stance): SimState {
    x = fin(x); z = fin(z); yaw = wrap(fin(yaw));
    sample(x, z, S0, 0);
    return {
      ver: 2, t: 0, acc: 0, seq: 0, mode: 'ground',
      x, y: S0.y, z, vx: 0, vy: 0, vz: 0,
      boardYaw: yaw, boardPitch: 0, boardRoll: 0, bodyTwist: 0, slideAngle: 0,
      lead: 1, feetSwapped: false, stance: stance === 'goofy' ? 'goofy' : 'regular',
      crouch: 0, crouchPeak: 0, lean: 0, carve: 0, turnRate: 0, pushPhase: 0, stroke: false,
      gnx: S0.nx, gny: S0.ny, gnz: S0.nz, kind: S0.kind, feature: S0.feature, kappa: 0, clearance: 0,
      airTime: 0, spin: 0, spinRate: 0, toX: x, toZ: z, toY: S0.y, footSign: 1, airFF: 1, vert: false, vertAlign: NaN, lipYaw: 0, lipY: 0, coyote: 0, airFromPop: false, airLaunch: false,
      trick: null, grab: null, pendPop: null, pendLate: null, pendRevert: -1,
      grind: null, stall: null, wall: null, cooldownLine: -1, cooldown: 0, balance: 0,
      manual: null, manualResume: false, slide: null,
      landTimer: 0, sinceLand: 9, impact: 0, bail: null, recoverT: 0,
      safe: [{ x, z, yaw }], safeT: 0, marker: null, spawn: { x, z, yaw },
    };
  }

  let S = freshState(opts.x, opts.z, opts.yaw, opts.stance);
  /** Crouch before this substep's filter update (pump reads the change). */
  let pumpPrevCrouch = 0;
  /** Lip flag of the last grounded sample (so a thin lip strip is not stepped over). */
  let S0lip: SurfaceSample['lip'] = null;

  /* ─────────────────────────────── small helpers */

  const emit = (e: SkateSimEvent): void => { events.push(e); };
  const naturalLeads = (): boolean => (S.lead > 0) !== S.feetSwapped;
  const isFakie = (): boolean => S.lead < 0 && !S.feetSwapped;
  const isSwitch = (): boolean => S.lead > 0 && S.feetSwapped;
  const footSign = (): 1 | -1 => ((S.stance === 'regular' ? 1 : -1) * (naturalLeads() ? 1 : -1)) as 1 | -1;
  /** Fold "feet swapped AND tail leading" (= natural foot leading) back to plain regular riding. */
  function canonical(): void {
    if (S.feetSwapped && S.lead < 0) { S.feetSwapped = false; S.lead = 1; S.boardYaw = wrap(S.boardYaw + Math.PI); }
  }
  const hSpeed = (): number => Math.hypot(S.vx, S.vz);
  const speed3 = (): number => Math.hypot(S.vx, S.vy, S.vz);
  const travelYaw = (): number => (hSpeed() > 0.05 ? Math.atan2(S.vx, S.vz) : wrap(S.boardYaw - S.slideAngle + (S.lead < 0 ? Math.PI : 0)));
  function clampSpeed(): void {
    const s = speed3();
    if (s > T.MAX_SPEED) { const k = T.MAX_SPEED / s; S.vx *= k; S.vy *= k; S.vz *= k; }
  }
  /** Lift an xz direction onto the tangent plane (vertical projection), normalised. */
  function lift(dx: number, dz: number, nx: number, ny: number, nz: number, out: { x: number; y: number; z: number }): void {
    const dy = -(nx * dx + nz * dz) / ny;
    const l = Math.hypot(dx, dy, dz) || 1;
    out.x = dx / l; out.y = dy / l; out.z = dz / l;
  }
  const V3 = { x: 0, y: 0, z: 0 };
  /**
   * Heading of a tangent velocity with the surface unrolled flat: the uphill
   * component points along the fall line's xz direction, the across component
   * along the level line. On flat ground this is atan2(vx, vz); on a vert wall
   * going straight up it is the direction the wall faces away from (not
   * whatever tiny sideways drift the xz velocity happens to have). Writes the
   * unrolled speed to FH.m.
   */
  const FH = { m: 0 };
  /** Wheel-grip axis scratch (see stepGround). */
  const GA = { x: 0, y: 0, z: 1 };
  function flatHeading(vx: number, vy: number, vz: number, nx: number, ny: number, nz: number): number {
    const s = Math.hypot(nx, nz);
    if (s < 1e-3) { FH.m = Math.hypot(vx, vz); return Math.atan2(vx, vz); }
    const ux = -nx / s, uz = -nz / s;               // uphill, horizontal
    const up = -(vx * nx + vz * nz) / s * ny + vy * s; // v · (fall-line tangent, uphill)
    const across = vx * -uz + vz * ux;              // v · (level line)
    const fx = up * ux - across * uz, fz = up * uz + across * ux;
    FH.m = Math.hypot(fx, fz);
    return Math.atan2(fx, fz);
  }

  function orientToSurface(nx: number, ny: number, nz: number, dt: number, rate: number): void {
    const by = S.boardYaw, fx = Math.sin(by), fz = Math.cos(by), lx = Math.cos(by), lz = -Math.sin(by);
    const sf = -(nx * fx + nz * fz) / ny, sl = -(nx * lx + nz * lz) / ny;
    let pitch = -Math.atan(sf), roll = Math.atan(sl);
    // Manual lifts the rider's front-foot end (nose unless the feet are swapped); nose manual the other.
    if (S.manual) pitch += (S.manual.kind === 'manual' ? -1 : 1) * T.MANUAL_PITCH * (S.feetSwapped ? -1 : 1);
    // Carving leans the deck into the turn (toward the turn = the right edge down for a right turn).
    roll += clamp(-S.turnRate * 0.07, -0.3, 0.3) * (S.lead < 0 ? -1 : 1);
    const k = rate > 0 ? ease(rate, dt) : 1;
    S.boardPitch += (pitch - S.boardPitch) * k;
    S.boardRoll += (roll - S.boardRoll) * k;
  }

  function recordSafe(dt: number): void {
    S.safeT += dt;
    if (S.safeT < T.SAFE_EVERY) return;
    S.safeT = 0;
    if (S.gny < 0.93 || S.slide || S.manual) return;
    sample(S.x, S.z, SX, S.y);
    if (SX.lip) return;
    pushOutAll(S.x, S.z, S.y, T.RADIUS + 0.15, island, solids, H);
    if (H.id) return;
    const pose: Pose = { x: S.x, z: S.z, yaw: travelYaw() };
    S.safe.push(pose);
    if (S.safe.length > 5) S.safe.shift();
  }

  /* ─────────────────────────────── events that end states */

  function endManual(): void {
    if (!S.manual) return;
    emit({ t: S.t, kind: 'manual-end', manual: S.manual.kind, distance: S.manual.distance, seconds: S.manual.seconds });
    S.manual = null;
    S.balance = 0;
  }
  function endSlide(): void {
    if (!S.slide) return;
    const sec = S.slide.seconds;
    // Rotated past ~110°: the board comes round the rest of the way — a 180 powerslide/revert.
    if (Math.abs(S.slideAngle) > Math.PI / 2 + 0.35) {
      S.lead = (S.lead < 0 ? 1 : -1);
      S.slideAngle = wrap(S.slideAngle - Math.sign(S.slideAngle) * Math.PI);
      canonical();
      emit({ t: S.t, kind: 'powerslide', seconds: sec });
      emit({ t: S.t, kind: 'revert' });
    } else emit({ t: S.t, kind: 'powerslide', seconds: sec });
    S.slide = null;
  }
  function endGrab(): void {
    if (!S.grab) return;
    if (S.grab.on) emit({ t: S.t, kind: 'grab-end', grabId: S.grab.grabId, seconds: S.grab.seconds });
    S.grab = null;
  }
  function endGrind(exit: 'ollie' | 'roll' | 'bail' | 'transfer'): void {
    const g = S.grind;
    if (!g) return;
    emit({ t: S.t, kind: 'grind-end', grindId: g.defId, grindableId: g.gid, distance: g.distance, seconds: g.seconds, exit });
    S.cooldownLine = g.li; S.cooldown = T.GRIND_COOLDOWN;
    S.grind = null;
    S.balance = 0;
  }

  function bail(reason: 'flip-not-caught' | 'bad-angle' | 'hard-impact' | 'balance' | 'wall' | 'water'): void {
    if (S.grind) endGrind('bail');
    if (S.stall) S.stall = null;
    if (S.wall) endWall();
    endManual();
    if (S.slide) { emit({ t: S.t, kind: 'powerslide', seconds: S.slide.seconds }); S.slide = null; }
    endGrab();
    const h = hSpeed();
    const dx = h > 0.1 ? S.vx / h : Math.sin(S.boardYaw), dz = h > 0.1 ? S.vz / h : Math.cos(S.boardYaw);
    emit({ t: S.t, kind: 'bail', reason });
    S.mode = 'bail';
    S.bail = { t: 0, reason, dirX: dx, dirZ: dz };
    S.trick = null; S.pendPop = null; S.pendLate = null; S.pendRevert = -1;
    S.stroke = false; S.pushPhase = 0; S.balance = 0; S.slideAngle = 0; S.spinRate = 0; S.manualResume = false;
  }

  /* ─────────────────────────────── air entry */

  function enterAir(fromPop: boolean, launch: boolean): void {
    S.mode = 'air';
    S.airTime = 0; S.spin = 0;
    S.toX = S.x; S.toZ = S.z; S.toY = S.y;
    S.footSign = footSign();
    S.airFF = naturalLeads() ? 1 : -1;
    S.airFromPop = fromPop; S.airLaunch = launch;
    S.coyote = fromPop ? 0 : T.POP_COYOTE;
    S.vert = false;
    S.landTimer = 0;
    if (S.slide) endSlide();
    S.slideAngle = 0;
    S.stroke = false; S.pushPhase = 0;
  }

  function startTrick(flipId: string, strength: number): boolean {
    const def = flips.get(flipId);
    if (!def || !(def.duration > 0)) return false;
    S.trick = {
      flipId, u: 0, rate: (T.FLIP_RATE_BASE + T.FLIP_RATE_STRENGTH * clamp(strength, 0, 1)) / def.duration,
      caught: false, difficulty: clamp(fin(def.difficulty), 0, 1), yawTurns: Math.round(fin(def.yaw)), at: S.airTime,
    };
    return true;
  }

  /**
   * A late flip that is really the popped flip read further on: its gesture carries on from the
   * popped one (kickflip → double kickflip → triple, even just after the catch), or it lands
   * within FLIP_CORRECT_TIME of the last reading while still turning (a sloppy corner
   * corrected). Keyboard flick-it pops on the flick, not on the release.
   */
  function upgrades(tr: TrickS, toId: string): boolean {
    if (tr.flipId === toId) return false;
    if (!tr.caught && S.airTime - fin(tr.at, -9) <= T.FLIP_CORRECT_TIME) return true;
    const a = flips.get(tr.flipId)?.gesture, b = flips.get(toId)?.gesture;
    return !!a && !!b && a.length < b.length && a.every((d, i) => b[i] === d);
  }

  /** Apply a flip's board-yaw half turns to the rest frame when it is caught. */
  function catchTrick(quality: number): void {
    const tr = S.trick;
    if (!tr || tr.caught) return;
    tr.caught = true;
    if (tr.u < 1) tr.u = 1;
    emit({ t: S.t, kind: 'flip-caught', flipId: tr.flipId, quality: clamp(quality, 0, 1) });
    if (tr.yawTurns % 2 !== 0) { S.boardYaw = wrap(S.boardYaw + Math.PI * tr.yawTurns); S.feetSwapped = !S.feetSwapped; }
  }

  function doPop(req: PopReq, nx: number, ny: number, nz: number, fromGround: boolean): void {
    const q = clamp(0.6 * clamp(req.strength, 0, 1) + 0.4 * S.crouchPeak, 0, 1);
    const h = (T.POP_H_MIN + (T.POP_H_MAX - T.POP_H_MIN) * q) * (req.from === 'nose' ? 0.96 : 1);
    const vp = Math.sqrt(2 * G * h);
    let dx = 0, dy = 1, dz = 0;
    if (fromGround) {
      const b = T.POP_NORMAL_BLEND;
      dx = nx * b; dy = ny * b + (1 - b); dz = nz * b;
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    }
    // Already rising (a kicker lip, a bank, a vert launch in coyote time): the pop
    // adds its HEIGHT to the launch's instead of stacking velocities, so a flip
    // popped at the Hatch lip is ≈1 above it at 8 u/s, not 2.5 (feel pass).
    const pvy = dy * vp;
    S.vx += dx * vp; S.vz += dz * vp;
    S.vy = S.vy > 0 && pvy > 0 ? Math.sqrt(S.vy * S.vy + T.POP_ON_RISE * pvy * pvy) : S.vy + pvy;
    clampSpeed();
    endManual();
    const fromFeature = S.feature;
    const wasSwitch = isSwitch(), wasFakie = isFakie();
    // Carving momentum and ground pre-wind start the spin.
    S.spinRate = clamp(-S.bodyTwist * T.PREWIND_GAIN + S.turnRate * T.CARVE_CARRY, -T.SPIN_MAX, T.SPIN_MAX);
    enterAir(true, false);
    const flipId = req.flipId && startTrick(req.flipId, req.strength) ? req.flipId : null;
    if (!flipId) S.trick = null;
    emit({ t: S.t, kind: 'pop', from: req.from, switch: wasSwitch, fakie: wasFakie, height: Math.max(0, S.vy) ** 2 / (2 * G), flipId, fromFeature });
    S.crouchPeak = 0;
  }

  /* ─────────────────────────────── collisions (xz) */

  /**
   * Move from (x0,z0) toward (x1,z1) against island obstacles, park solids and
   * the shore, in sub-sweeps short enough that nothing thin is skipped. Writes
   * the resolved point to H and returns what stopped us.
   */
  function sweepXZ(x0: number, z0: number, x1: number, z1: number, y: number): 'clear' | 'solid' | 'shore' {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(d / 0.08));
    let px = x0, pz = z0, what: 'clear' | 'solid' | 'shore' = 'clear', nx = 0, nz = 0;
    const has = island.length + solids.length > 0;
    for (let i = 1; i <= n; i++) {
      const tx = x0 + ((x1 - x0) * i) / n, tz = z0 + ((z1 - z0) * i) / n;
      let rx = tx, rz = tz;
      if (has) {
        pushOutAll(tx, tz, y, T.RADIUS, island, solids, H);
        if (H.id) { rx = H.x; rz = H.z; what = 'solid'; nx = H.nx; nz = H.nz; }
      }
      if (shore) {
        let s: { x: number; z: number; ashore: boolean } | null = null;
        try { s = shore(rx, rz); } catch { s = null; }
        if (s && !s.ashore && Number.isFinite(s.x) && Number.isFinite(s.z)) {
          const ddx = s.x - rx, ddz = s.z - rz, dd = Math.hypot(ddx, ddz);
          if (dd > 1e-9) { nx = ddx / dd; nz = ddz / dd; } else { const r = Math.hypot(rx, rz) || 1; nx = -rx / r; nz = -rz / r; }
          rx = s.x; rz = s.z; what = 'shore';
        }
      }
      px = rx; pz = rz;
      if (what !== 'clear') break;
    }
    H.x = px; H.z = pz; H.nx = nx; H.nz = nz;
    return what;
  }

  /** Respond to hitting something with outward normal (nx,nz). Returns true if we bailed. */
  function hitWall(nx: number, nz: number, kind: 'solid' | 'shore' | 'step'): boolean {
    const into = -(S.vx * nx + S.vz * nz);
    if (kind === 'shore') {
      if (hSpeed() > T.WATER_BAIL_SPEED && into > 1) { bail('water'); return true; }
      if (into > 0) { S.vx += into * nx; S.vz += into * nz; }
      S.vx *= 0.9; S.vz *= 0.9;
      return false;
    }
    if (into > T.WALL_BAIL_SPEED) { bail('wall'); return true; }
    if (into > 0) { S.vx += into * nx; S.vz += into * nz; }
    return false;
  }

  /** Outward normal of an upward step at (x,z), from the height gradient. */
  function stepNormal(x0: number, z0: number, x1: number, z1: number, out: { x: number; z: number }): void {
    const e = 0.06;
    const hx = sample(x1 + e, z1, SX, 0).y - sample(x1 - e, z1, SX, 0).y;
    const hz = sample(x1, z1 + e, SX, 0).y - sample(x1, z1 - e, SX, 0).y;
    let nx = -hx, nz = -hz, l = Math.hypot(nx, nz);
    if (l < 1e-6) { nx = x0 - x1; nz = z0 - z1; l = Math.hypot(nx, nz); }
    if (l < 1e-9) { nx = -Math.sin(S.boardYaw); nz = -Math.cos(S.boardYaw); l = 1; }
    out.x = nx / l; out.z = nz / l;
  }
  const N2 = { x: 0, z: 0 };

  /* ─────────────────────────────── ground */

  function stepGround(dt: number): void {
    const n0x = S.gnx, n0y = S.gny, n0z = S.gnz, y0 = S.y, x0 = S.x, z0 = S.z;
    S.sinceLand += dt;
    S.landTimer = Math.max(0, S.landTimer - dt);
    if (S.recoverT > 0) return;

    // One-shots: pop beats everything; revert next.
    if (S.pendPop) { const p = S.pendPop; S.pendPop = null; doPop(p, n0x, n0y, n0z, true); return; }
    let speed = speed3();
    if (S.pendRevert >= 0 && !S.manual && !S.slide && (S.sinceLand < T.REVERT_WINDOW || speed < T.REVERT_MAX_SPEED || n0y < 0.95)) {
      S.pendRevert = -1; doRevert();
    }

    // Travel direction (tangent).
    let tx: number, ty: number, tz: number;
    if (speed > 1e-4) { tx = S.vx / speed; ty = S.vy / speed; tz = S.vz / speed; }
    else {
      const fy = S.boardYaw - S.slideAngle + (S.lead < 0 ? Math.PI : 0);
      lift(Math.sin(fy), Math.cos(fy), n0x, n0y, n0z, V3); tx = V3.x; ty = V3.y; tz = V3.z;
    }

    // Manual.
    if (S.manual && I.manual !== S.manual.kind) endManual();
    if (!S.manual && I.manual && speed > T.MANUAL_MIN_SPEED && !S.slide) startManual(I.manual);
    // Powerslide.
    const wantsSlide = (I.powerslide || (I.brake && Math.abs(I.steer) > 0.35 && speed > T.BRAKE_SLIDE_SPEED));
    if (S.slide && (!wantsSlide || speed < 0.6)) endSlide();
    else if (!S.slide && wantsSlide && speed > T.POWERSLIDE_MIN_SPEED && !S.manual) {
      const side: 1 | -1 = I.steer < -0.05 ? -1 : I.steer > 0.05 ? 1 : (S.carve < 0 ? -1 : 1);
      S.slide = { side, over: 0, seconds: 0 };
    }

    // Non-gravity decelerations.
    let decel = (T.ROLL[S.kind] ?? T.ROLL.concrete!) + T.DRAG * speed * speed;
    if (S.manual) decel += T.MANUAL_FRICTION;
    if (S.slide) {
      const ctrl = Math.max(Math.abs(I.steer), S.crouch, I.brake ? 0.6 : 0);
      decel += T.POWERSLIDE_SCRUB_MIN + (T.POWERSLIDE_SCRUB_MAX - T.POWERSLIDE_SCRUB_MIN) * ctrl;
    } else if (I.brake) decel += T.BRAKE_DECEL;

    // Push strokes.
    let pushAcc = 0;
    const canPush = !S.manual && !S.slide && S.crouch < 0.5 && !I.brake && n0y > 0.9;
    if (S.stroke) {
      const period = I.sprint ? T.SPRINT_PERIOD : T.PUSH_PERIOD;
      S.pushPhase += dt / period;
      if (S.pushPhase >= 1) {
        if (I.push && canPush) { S.pushPhase -= 1; emit({ t: S.t, kind: 'push' }); }
        else { S.stroke = false; S.pushPhase = 0; }
      }
    } else if (I.push && canPush) { S.stroke = true; S.pushPhase = 0; emit({ t: S.t, kind: 'push' }); }
    if (S.stroke && I.push && canPush && S.pushPhase >= T.PUSH_KICK_FROM && S.pushPhase <= T.PUSH_KICK_TO) {
      const cap = I.sprint ? T.SPRINT_CAP : T.PUSH_CAP, acc = I.sprint ? T.SPRINT_ACCEL : T.PUSH_ACCEL;
      const w = (S.pushPhase - T.PUSH_KICK_FROM) / (T.PUSH_KICK_TO - T.PUSH_KICK_FROM);
      const fade = Math.pow(Math.max(0, 1 - speed / cap), 0.8);
      pushAcc = acc * (T.PUSH_GRIP[S.kind] ?? 1) * fade * Math.sin(Math.PI * w) * 1.57;
    }
    if (!S.stroke) S.pushPhase = 0;

    let mag = Math.max(0, speed - decel * dt) + pushAcc * dt;

    // Pump: extending where the path curves adds energy, crouching there costs it.
    const dCrouch = S.crouch - pumpPrevCrouch;
    if (dCrouch !== 0 && S.kappa !== 0 && mag > 0.3) {
      const v2 = mag * mag, eff = v2 / (1 + v2 / (T.PUMP_VREF * T.PUMP_VREF));
      const dE = -dCrouch * T.CROUCH_DROP * eff * S.kappa * T.PUMP_GAIN;
      mag = Math.sqrt(Math.max(0.01, mag * mag + 2 * dE));
    }
    let vx = tx * mag, vy = ty * mag, vz = tz * mag;

    // The board's rolling axis: a tangent vector that turns with the carve (same
    // rotation as the velocity); the wheels hold travel to it at the end of the
    // step (see "Wheels" below). Not while powersliding/reverting (slideAngle ≠ 0).
    const grip = !S.slide && Math.abs(S.slideAngle) < 1e-3;
    {
      const by = S.boardYaw;
      lift(Math.sin(by), Math.cos(by), n0x, n0y, n0z, V3);
      GA.x = V3.x; GA.y = V3.y; GA.z = V3.z;
    }
    // Steering: carve about the surface normal; pivot when (nearly) stopped.
    const steer = S.carve;
    let omega = 0;
    if (mag > T.PIVOT_SPEED) omega = -steer * mag / (T.TURN_R0 + T.TURN_RV * mag);
    else {
      const pivot = -I.steer * T.PIVOT_RATE * (1 - mag / T.PIVOT_SPEED) + (-steer * mag / (T.TURN_R0 + T.TURN_RV * mag));
      omega = pivot;
    }
    if (S.slide) omega *= 0.3;
    if (S.manual) omega *= 0.7;
    S.turnRate = omega;
    if (omega !== 0) {
      const a = omega * dt, c = Math.cos(a), s = Math.sin(a);
      // v ⊥ n: rotate about n (Rodrigues without the parallel term).
      const cx = n0y * vz - n0z * vy, cy = n0z * vx - n0x * vz, cz = n0x * vy - n0y * vx;
      vx = vx * c + cx * s; vy = vy * c + cy * s; vz = vz * c + cz * s;
      if (grip) {
        const gx = n0y * GA.z - n0z * GA.y, gy = n0z * GA.x - n0x * GA.z, gz = n0x * GA.y - n0y * GA.x;
        GA.x = GA.x * c + gx * s; GA.y = GA.y * c + gy * s; GA.z = GA.z * c + gz * s;
      }
      if (mag < 0.25) S.boardYaw = wrap(S.boardYaw + a);
    }
    const ke = 0.5 * (vx * vx + vy * vy + vz * vz);

    // Gravity, tangential part.
    const gx = G * n0y * n0x, gy = G * (n0y * n0y - 1), gz = G * n0y * n0z;
    const vbx = vx, vby = vy, vbz = vz;
    vx += gx * dt; vy += gy * dt; vz += gz * dt;

    // Move in xz; walls first.
    let x1 = x0 + vx * dt, z1 = z0 + vz * dt;
    S.vx = vx; S.vy = vy; S.vz = vz;
    const w = sweepXZ(x0, z0, x1, z1, y0);
    if (w !== 'clear') {
      if (hitWall(H.nx, H.nz, w)) return;
      x1 = H.x; z1 = H.z; vx = S.vx; vz = S.vz;
    }
    sample(x1, z1, S1, y0);
    const dx = x1 - x0, dz = z1 - z0;
    const predOld = -(n0x * dx + n0z * dz) / n0y, predNew = -(S1.nx * dx + S1.nz * dz) / S1.ny;
    const rise = S1.y - y0;

    // An upward step the slope doesn't explain is a wall (ramp side, stair riser, curb).
    if (rise > Math.max(predOld, predNew) + T.WALL_STEP) {
      stepNormal(x0, z0, x1, z1, N2);
      S.x = x0; S.z = z0;
      if (hitWall(N2.x, N2.z, 'step')) return;
      S.vy = 0;
      S.vx *= 0.97; S.vz *= 0.97;
      return;
    }

    // Lips: ride the lip strip to its outer edge (so the strip's width never costs height),
    // then launch as you leave it moving out. Vert: straight up and back in. Kicker/bank/
    // table edge: along the tangent.
    const lipNow = S1.lip, lipPrev = S0lip;
    if (vy > 0 && lipPrev && !lipNow && vx * Math.sin(lipPrev.lipYaw) + vz * Math.cos(lipPrev.lipYaw) > 0.02) {
      S.x = x1; S.z = z1;
      if (lipPrev.vert) { S.y = Math.max(S1.y, y0 + vby * dt); S.vx = vx; S.vy = vy; S.vz = vz; launchLip(lipPrev.lipYaw, true, y0); }
      else { S.y = Math.max(S1.y, y0 + vby * dt); S.vx = vbx; S.vy = vby; S.vz = vbz; launchLip(lipPrev.lipYaw, false, y0); }
      return;
    }
    // Fallback lip for fields that miss a strip: leaving a steep face onto something flat, going up.
    if (n0y < 0.35 && S1.ny > 0.8 && vy > 0.5 && rise < predOld - 0.02) {
      S.x = x1; S.z = z1; S.y = y0 + vy * dt;
      S.vx = vx; S.vy = vy; S.vz = vz;
      launchLip(Math.atan2(-n0x, -n0z), true, S.y);
      return;
    }

    // Does the ground fall away faster than free fall? (crest, ledge, stair nose) → airborne, no impulse.
    const yFree = y0 + vby * dt - 0.5 * G * dt * dt;
    if (S1.y < yFree - T.AIR_EPS) {
      S.x = x1; S.z = z1; S.y = yFree;
      S.vx = vbx; S.vy = vby - G * dt; S.vz = vbz;
      const hadManual = S.manual !== null;
      endManual();
      S.manualResume = hadManual;
      enterAir(false, false);
      S.clearance = S.y - S1.y;
      return;
    }

    // Stay on the surface: project, then restore speed from energy (gravity by exact height change).
    const vn = vx * S1.nx + vy * S1.ny + vz * S1.nz;
    vx -= vn * S1.nx; vy -= vn * S1.ny; vz -= vn * S1.nz;
    const m = Math.hypot(vx, vy, vz);
    const target2 = 2 * ke - 2 * G * (S1.y - y0);
    if (target2 > 0 && m > 0.2) {
      const k = clamp(Math.sqrt(target2) / m, 0.5, 2);
      vx *= k; vy *= k; vz *= k;
    }
    // Curvature along the path (for pumping): concave > 0.
    const ds = Math.hypot(dx, S1.y - y0, dz);
    if (ds > 1e-5 && mag > 0.3) {
      const kap = -((S1.nx - n0x) * tx + (S1.ny - n0y) * ty + (S1.nz - n0z) * tz) / ds;
      S.kappa = clamp(kap, -6, 6);
    } else S.kappa = 0;

    S.x = x1; S.z = z1; S.y = S1.y;
    S.vx = vx; S.vy = vy; S.vz = vz;
    clampSpeed();
    S.gnx = S1.nx; S.gny = S1.ny; S.gnz = S1.nz; S.kind = S1.kind; S.feature = S1.feature; S.clearance = 0;
    S0lip = S1.lip;

    // Wheels (feel pass 2026-09-23). The board rolls along its axis (GA: turned with the carve,
    // re-seated on the new surface). What gravity or a wall adds sideways does not slide it:
    //  - a little of it (≤ LATERAL_GRIP, fading out by twice that) is simply held by the tyres,
    //    so a pad's drainage fall no longer walks a rider off the side of a mini;
    //  - the rest steers the board toward the fall line, as a tilted deck's trucks do
    //    (turn rate = sideways accel ÷ speed), but never tighter than SELF_STEER_RADIUS, so at a
    //    wall's peak or in a slow stall the board keeps its line and rolls back fakie, while at
    //    speed an angled line up a wall carves round exactly as before. One model at every speed
    //    (was: full grip below 2.2 u/s, free follow-travel above).
    // Powersliding and reverting (slideAngle ≠ 0) the board just follows travel.
    let held = false;
    if (grip) {
      // Re-seat the axis on the new surface: keeping its heading in plan where the ground is
      // gentle (a sheared pad must not bend a straight line), by 3D projection on steep faces
      // (a heading in plan is meaningless on a near-vert wall).
      let ax: number, ay: number, az: number;
      if (S.gny >= 0.5 && Math.hypot(GA.x, GA.z) > 1e-3) { lift(GA.x, GA.z, S.gnx, S.gny, S.gnz, V3); ax = V3.x; ay = V3.y; az = V3.z; }
      else { const dn = GA.x * S.gnx + GA.y * S.gny + GA.z * S.gnz; ax = GA.x - dn * S.gnx; ay = GA.y - dn * S.gny; az = GA.z - dn * S.gnz; }
      const al = Math.hypot(ax, ay, az);
      if (al > 1e-6 && Math.hypot(ax, az) > 1e-4) {
        ax /= al; ay /= al; az /= al;
        held = true;
        // Lateral axis in the tangent plane: n × a.
        const lx = S.gny * az - S.gnz * ay, ly = S.gnz * ax - S.gnx * az, lz = S.gnx * ay - S.gny * ax;
        const along = S.vx * ax + S.vy * ay + S.vz * az;
        let lat = S.vx * lx + S.vy * ly + S.vz * lz;
        lat -= lat * clamp(2 - Math.abs(lat) / (T.LATERAL_GRIP * dt), 0, 1);
        const full = Math.atan2(lat, Math.abs(along));
        const cap = (Math.max(Math.abs(along), 0.25) / T.SELF_STEER_RADIUS) * dt;
        const ta = clamp(full, -cap, cap) * (along >= 0 ? 1 : -1);
        const c = Math.cos(ta), sn = Math.sin(ta);
        const bx = ax * c + lx * sn, by = ay * c + ly * sn, bz = az * c + lz * sn;
        // Within the turn the speed carries round; past it the sideways part is scrubbed.
        const nv = Math.abs(full) <= cap ? Math.hypot(along, lat) * (along >= 0 ? 1 : -1) : S.vx * bx + S.vy * by + S.vz * bz;
        S.vx = bx * nv; S.vy = by * nv; S.vz = bz * nv;
        if (Math.hypot(bx, bz) > 1e-4) S.boardYaw = wrap(Math.atan2(bx, bz));
        if (Math.abs(nv) > 0.05) { S.lead = nv >= 0 ? 1 : -1; canonical(); }
      }
    }
    const sp = speed3();
    if (!held && sp > 0.25) {
      const hd = Math.atan2(S.vx, S.vz);
      if (hSpeed() > 0.03) {
        const base = wrap(S.boardYaw - S.slideAngle);
        S.lead = Math.abs(wrap(base - hd)) > Math.PI / 2 ? -1 : 1;
        canonical();
        S.boardYaw = wrap(hd + (S.lead < 0 ? Math.PI : 0) + S.slideAngle);
      }
    }
    // Slide angle: toward the powerslide target, otherwise home (reverts animate here).
    if (S.slide) {
      S.slide.seconds += dt;
      if (Math.abs(I.steer) > 0.85 && Math.sign(I.steer) === S.slide.side) S.slide.over = Math.min(Math.PI / 2, S.slide.over + T.POWERSLIDE_OVER_RATE * dt);
      const target = -S.slide.side * (Math.PI / 2 + S.slide.over);
      const prev = S.slideAngle;
      S.slideAngle = approach(S.slideAngle, target, T.POWERSLIDE_ROT * dt);
      S.boardYaw = wrap(S.boardYaw + S.slideAngle - prev);
    } else if (S.slideAngle !== 0) {
      const prev = S.slideAngle;
      S.slideAngle = approach(S.slideAngle, 0, T.REVERT_RATE * dt);
      S.boardYaw = wrap(S.boardYaw + S.slideAngle - prev);
    }

    // Manual balance.
    if (S.manual) {
      const m2 = S.manual;
      m2.seconds += dt; m2.distance += Math.hypot(dx, dz);
      const tip = T.MANUAL_TIP * (1 + T.MANUAL_TIP_GROWTH * m2.seconds) * (reduced ? 1.25 : 1);
      const wob = T.MANUAL_WOBBLE * (driftSign(m2.seed) + Math.sin(m2.seconds * 2.3 + m2.seed) + 0.5 * Math.sin(m2.seconds * 5.7 + 2 * m2.seed));
      const sign = m2.kind === 'manual' ? 1 : -1;
      // balance > 0 = rotating out the back of the manual; weight toward the other end pulls it back.
      S.balance += (tip * S.balance + wob - T.MANUAL_CONTROL * S.lean * sign) * dt;
      if (S.balance > 1) { bail('balance'); return; }
      if (S.balance < -1 || sp < 0.3) endManual();
    }

    orientToSurface(S.gnx, S.gny, S.gnz, dt, 22);
    recordSafe(dt);
  }

  /** Each grind/manual leans one way (by its seed) so an uncorrected balance always goes somewhere. */
  const driftSign = (seed: number): number => (Math.sin(seed * 7.13) >= 0 ? 1 : -1);

  function startManual(kind: 'manual' | 'nose-manual'): void {
    S.seq++;
    S.manual = { kind, seconds: 0, distance: 0, seed: (S.seq * 1.618) % 6.283 };
    S.balance = 0;
    S.stroke = false; S.pushPhase = 0;
    emit({ t: S.t, kind: 'manual-start', manual: kind, distance: 0, seconds: 0 });
  }

  function doRevert(): void {
    const cw = I.steer >= 0; // steer right (or nothing) → clockwise
    S.lead = S.lead < 0 ? 1 : -1;
    // Keep the board where it is this instant; the slide angle then animates it round.
    S.slideAngle = S.slideAngle + (cw ? Math.PI : -Math.PI);
    canonical();
    S.vx *= T.REVERT_KEEP; S.vy *= T.REVERT_KEEP; S.vz *= T.REVERT_KEEP;
    emit({ t: S.t, kind: 'revert' });
  }

  function launchLip(lipYaw: number, vert: boolean, lipY: number): void {
    const ox = Math.sin(lipYaw), oz = Math.cos(lipYaw);
    const hadManual = S.manual !== null;
    endManual();
    S.manualResume = hadManual;
    if (vert) {
      // The board's Euler yaw on a near-vert face is its xz projection, which
      // amplifies a few degrees off the fall line into tens; in the air the deck
      // levels out, so carry the UNROLLED heading (what it really was) instead.
      {
        const by = S.boardYaw;
        lift(Math.sin(by), Math.cos(by), S.gnx, S.gny, S.gnz, V3);
        S.boardYaw = wrap(flatHeading(V3.x, V3.y, V3.z, S.gnx, S.gny, S.gnz));
      }
      const out = S.vx * ox + S.vz * oz;
      // Along the coping: a square-on air comes straight back in (feel pass:
      // un-steered airs used to walk ~0.3 per wall); a line you aimed across the
      // wall (> ~12° off square) or are carving keeps its sideways speed.
      const ax0 = S.vx - out * ox, az0 = S.vz - out * oz;
      const skew = Math.atan2(Math.hypot(ax0, az0), Math.max(1e-6, Math.hypot(Math.max(0, S.vy), Math.max(0, out))));
      const aim = Math.max(clamp((skew - 0.12) / 0.2, 0, 1), clamp(Math.abs(S.carve) / 0.5, 0, 1));
      const carry = T.VERT_CARRY + (1 - T.VERT_CARRY) * aim;
      const ax = ax0 * carry, az = az0 * carry;
      // …and a square-on air squares the board up to the wall, so the next wall
      // starts on the same line instead of compounding a fraction of a degree.
      if (aim < 1) {
        const sq = Math.abs(wrap(S.boardYaw - lipYaw)) < Math.PI / 2 ? lipYaw : wrap(lipYaw + Math.PI);
        S.boardYaw = wrap(S.boardYaw + wrap(sq - S.boardYaw) * (1 - aim));
      }
      const up = Math.sqrt(Math.max(0, S.vy) ** 2 + Math.max(0, out) ** 2);
      // Slow at the coping: a lip trick instead of a tiny air.
      if (up < 1.6 && (I.grindAssist || S.lean > 0.45 || I.lean > 0.45)) { startStall(lipYaw, I.grindAssist ? 'axle-stall' : 'rock-to-fakie', lipY); return; }
      const airT = Math.max(0.3, (2 * up) / G);
      const bias = T.VERT_REENTRY / airT;
      S.vx = ax - ox * bias; S.vz = az - oz * bias; S.vy = up;
      // Where this air comes back down the wall (the same line, mirrored), in the wall's
      // unrolled frame: an un-steered angled air turns the board to meet it and lands fakie.
      const nh = Math.hypot(S.gnx, S.gnz);
      let align = NaN;
      if (nh > 1e-3 && aim > 0) {
        const ux = -S.gnx / nh, uz = -S.gnz / nh;
        const upc = -(S.vx * S.gnx + S.vz * S.gnz) / nh * S.gny + S.vy * nh, across = S.vx * -uz + S.vz * ux;
        align = Math.atan2(-upc * ux - across * uz, -upc * uz + across * ux);
      }
      enterAir(false, true);
      S.vert = true; S.lipYaw = lipYaw; S.lipY = lipY; S.vertAlign = align;
    } else enterAir(false, true);
  }

  function startStall(lipYaw: number, id: 'rock-to-fakie' | 'axle-stall', lipY: number): void {
    S.mode = 'grind';
    S.stall = { id, t: 0, inX: -Math.sin(lipYaw), inZ: -Math.cos(lipYaw), feature: S.feature ?? 'lip' };
    S.vx = 0; S.vy = 0; S.vz = 0; S.y = lipY;
    S.balance = 0;
    emit({ t: S.t, kind: 'lip-trick', id });
  }

  function stepStall(dt: number): void {
    const st = S.stall!;
    st.t += dt;
    const hold = st.id === 'axle-stall' ? 0.45 : 0.3;
    if (S.pendPop && st.t > 0.08) { S.pendPop = null; } // popping out of a stall just drops you in
    if (st.t < hold) return;
    // Drop back in.
    if (st.id === 'axle-stall') S.boardYaw = wrap(S.boardYaw + Math.PI); // turn back in: rides out regular
    S.stall = null;
    S.vx = st.inX * 1.2; S.vz = st.inZ * 1.2; S.vy = 0.2;
    S.x += st.inX * 0.04; S.z += st.inZ * 0.04;
    enterAir(false, false);
    S.coyote = 0;
  }

  /* ─────────────────────────────── air */

  function stepAir(dt: number): void {
    const x0 = S.x, y0 = S.y, z0 = S.z;
    S.airTime += dt;
    S.coyote = Math.max(0, S.coyote - dt);
    // A pop just after rolling off an edge / launching still counts.
    if (S.pendPop && S.coyote > 0 && !S.airFromPop) {
      const p = S.pendPop; S.pendPop = null;
      const keepVert = S.vert, lipYaw = S.lipYaw, lipY = S.lipY;
      doPop(p, 0, 1, 0, false);
      if (keepVert) { S.vert = true; S.lipYaw = lipYaw; S.lipY = lipY; }
    }
    if (S.pendLate && S.trick && !(S.grab && S.grab.on) && upgrades(S.trick, S.pendLate.id)) {
      // The flick went on after it popped (a double, a corner corrected a beat late): the board
      // keeps flipping as the longer trick from where it has got to (same turns so far).
      const tr = S.trick, from = flips.get(tr.flipId), id = S.pendLate.id; S.pendLate = null;
      const u = tr.caught ? 1 : tr.u;
      if (startTrick(id, 0.7)) {
        const to = flips.get(id)!, rf = Math.abs(fin(from?.roll)), rt = Math.abs(fin(to.roll));
        S.trick!.u = rf > 0 && rt > 0 ? clamp(u * rf / rt, 0, 0.95) : S.airTime <= T.FLIP_CORRECT_TIME ? u : 0;
        emit({ t: S.t, kind: 'late-flip', flipId: id });
      }
    } else if (S.pendLate && (!S.trick || S.trick.caught) && !(S.grab && S.grab.on)) {
      const id = S.pendLate.id; S.pendLate = null;
      if (startTrick(id, 0.7)) emit({ t: S.t, kind: 'late-flip', flipId: id });
    }

    // Spin: stick turns the body and board; momentum carries; pre-wind shows in bodyTwist.
    const grabbing = S.grab !== null && S.grab.on;
    if (Math.abs(I.steer) > 0.05) {
      const target = -I.steer * T.SPIN_MAX * (grabbing ? T.GRAB_SPIN : 1);
      S.spinRate += (target - S.spinRate) * ease(T.SPIN_RESPONSE, dt);
    } else {
      S.spinRate *= Math.exp(-T.SPIN_DAMP * dt);
      // Square up to land after a spin: near a board line (0°/180° to travel) it settles onto it.
      const hs = Math.hypot(S.vx, S.vz);
      if (!S.vert && hs > 0.5 && Math.abs(S.spin) > 0.35 && (!S.trick || S.trick.caught)) {
        const rel = wrap(S.boardYaw - Math.atan2(S.vx, S.vz)), e = wrap(rel - Math.round(rel / Math.PI) * Math.PI);
        if (Math.abs(e) < T.SPIN_SETTLE_WINDOW / 2 + 0.2) {
          const want = -e * T.SPIN_SETTLE_GAIN;
          // Only ever slows or reverses a spin that would overshoot; never adds a new one.
          if (Math.abs(want) < Math.abs(S.spinRate) || Math.sign(want) !== Math.sign(S.spinRate) || Math.abs(S.spinRate) < 0.3) S.spinRate += (want - S.spinRate) * ease(10, dt);
        }
      }
    }
    S.boardYaw = wrap(S.boardYaw + S.spinRate * dt);
    S.spin += S.spinRate * dt;
    // An angled vert air with the stick centred turns to come back down its own line (not a spin).
    if (S.vert && Number.isFinite(S.vertAlign) && Math.abs(I.steer) < 0.2 && Math.abs(S.spinRate) < 1) {
      const d0 = wrap(S.vertAlign - S.boardYaw), d = Math.abs(d0) > Math.PI / 2 ? wrap(d0 - Math.PI * Math.sign(d0)) : d0;
      S.boardYaw = wrap(S.boardYaw + clamp(d, -T.VERT_ALIGN_RATE * dt, T.VERT_ALIGN_RATE * dt));
    }
    S.bodyTwist += (S.spinRate * 0.07 - S.bodyTwist) * ease(10, dt);

    // Flip.
    const tr = S.trick;
    if (tr && !tr.caught) {
      tr.u += tr.rate * dt;
      if (tr.u >= 1) {
        // Quality: how much time is left to settle before touchdown (estimated ballistically).
        const below = S.clearance;
        const tLeft = (S.vy + Math.sqrt(Math.max(0, S.vy * S.vy + 2 * G * Math.max(0, below)))) / G;
        catchTrick(0.45 + 0.55 * clamp(tLeft / 0.18, 0, 1));
      }
    }
    // Grab.
    if (S.grab && (!I.grab || I.grab !== S.grab.grabId) && S.grab.on) {
      emit({ t: S.t, kind: 'grab-end', grabId: S.grab.grabId, seconds: S.grab.seconds });
      S.grab.on = false;
    }
    if (I.grab && (!S.grab || !S.grab.on) && grabs.has(I.grab) && (!S.trick || S.trick.caught) && S.airTime > 0.08 && S.clearance > 0.1) {
      S.grab = { grabId: I.grab, weight: S.grab && S.grab.grabId === I.grab ? S.grab.weight : 0, seconds: 0, on: true };
      emit({ t: S.t, kind: 'grab-start', grabId: I.grab, seconds: 0 });
    }
    if (S.grab) {
      if (S.grab.on) { S.grab.seconds += dt; S.grab.weight += (1 - S.grab.weight) * ease(T.GRAB_IN, dt); }
      else { S.grab.weight *= Math.exp(-T.GRAB_OUT * dt); if (S.grab.weight < 0.02) S.grab = null; }
    }

    // Ballistics.
    S.vy -= G * dt;
    if (S.vert) {
      // Vert air: over the deck behind the coping? steer gently back over the transition.
      sample(S.x, S.z, SX, S.y);
      if (SX.lip) S.lipYaw = SX.lip.lipYaw;
      else if (SX.ny > 0.9 && SX.y >= S.lipY - 0.05) {
        S.vx -= Math.sin(S.lipYaw) * T.VERT_DECK_PULL * dt; S.vz -= Math.cos(S.lipYaw) * T.VERT_DECK_PULL * dt;
      }
    }
    clampSpeed();
    let x1 = x0 + S.vx * dt, z1 = z0 + S.vz * dt;
    const y1 = y0 + S.vy * dt;
    const w = sweepXZ(x0, z0, x1, z1, y1);
    if (w !== 'clear') {
      if (w === 'solid' && H.top - y1 > T.WALLRIDE_MIN_HEIGHT && tryWallride(H.id ?? 'wall', H.nx, H.nz, H.x, H.z, y1, false)) return;
      if (hitWall(H.nx, H.nz, w)) return;
      x1 = H.x; z1 = H.z;
    }

    // Grinds (swept: lock tests the arrival point against the rail with vertical tolerance).
    if (tryLock(y0, x1, y1, z1)) return;

    sample(x1, z1, S1, y1);
    S.clearance = Math.max(0, y1 - S1.y);
    if (y1 <= S1.y) {
      const pen = S1.y - y1;
      const horiz = Math.hypot(x1 - x0, z1 - z0);
      const slope = Math.hypot(S1.nx, S1.nz) / S1.ny;
      // Already under the ground where we were (e.g. dropped off a grindable that dips below it)? Surface.
      const under = horiz < 1e-6 || sample(x0, z0, SX, y0).y > y0 - 0.02;
      if (under || pen <= horiz * slope + Math.abs(S.vy) * dt + 0.1) {
        S.x = x1; S.z = z1; S.y = S1.y;
        land();
        return;
      }
      // Flew into the side of something taller.
      stepNormal(x0, z0, x1, z1, N2);
      if (pen > T.WALLRIDE_MIN_HEIGHT && tryWallride(S1.feature ?? 'wall', N2.x, N2.z, x0, z0, y1, true)) return;
      if (hitWall(N2.x, N2.z, 'step')) return;
      S.y = y1;
      return;
    }
    S.x = x1; S.y = y1; S.z = z1;
    // Ease the deck toward the surface below as it comes up to meet you.
    if (S.clearance < 0.6) orientToSurface(S1.nx, S1.ny, S1.nz, dt, 6 * (1 - S.clearance / 0.6));
    else { S.boardPitch *= Math.exp(-3 * dt); S.boardRoll *= Math.exp(-3 * dt); }
  }

  /* ─────────────────────────────── landing */

  function land(): void {
    const nx = S1.nx, ny = S1.ny, nz = S1.nz;
    const vn = -(S.vx * nx + S.vy * ny + S.vz * nz);
    let vtx = S.vx + vn * nx, vty = S.vy + vn * ny, vtz = S.vz + vn * nz;
    if (vn < 0) { vtx = S.vx; vty = S.vy; vtz = S.vz; }
    const impact = Math.max(0, vn);
    const airTime = S.airTime, gap = Math.hypot(S.x - S.toX, S.z - S.toZ);
    const grabWeight = S.grab ? S.grab.weight : 0;
    endGrab();

    // Flip must be caught.
    const tr = S.trick;
    if (tr && !tr.caught) {
      const window = T.CATCH_WINDOW * (1 - T.CATCH_DIFFICULTY * tr.difficulty) * (reduced ? 0.7 : 1);
      if (tr.u >= 1 - window) catchTrick(0.3 * (1 - (1 - tr.u) / Math.max(1e-6, window)));
      else { toGround(); bail('flip-not-caught'); return; }
    }

    // Board vs travel (travel read in the unrolled landing surface, see flatHeading).
    const th = Math.hypot(vtx, vtz);
    lift(Math.sin(S.boardYaw), Math.cos(S.boardYaw), nx, ny, nz, V3);
    const boardU = flatHeading(V3.x, V3.y, V3.z, nx, ny, nz);
    const travU = flatHeading(vtx, vty, vtz, nx, ny, nz);
    const a = FH.m > 0.3 ? wrap(boardU - travU) : (S.lead < 0 ? Math.PI : 0);
    const k = Math.round(a / Math.PI);
    const dev = Math.abs(a - k * Math.PI) * 180 / Math.PI;
    if (dev > T.LAND_SKETCHY_DEG) { toGround(); bail('bad-angle'); return; }

    // Impact.
    const crouchEff = Math.max(S.crouch, I.crouch);
    const limit = crouchEff >= 0.45 ? T.HARD_IMPACT_CROUCHED : T.HARD_IMPACT;
    if (impact > limit) { toGround(); bail('hard-impact'); return; }

    let keep = clamp(1 - T.LAND_FLAT_LOSS * Math.max(0, impact - 3) * (crouchEff >= 0.45 ? 0.6 : 1), 0.45, 1);
    let clean = dev <= 8 ? 1 : dev <= T.LAND_CLEAN_DEG ? 1 - 0.45 * (dev - 8) / (T.LAND_CLEAN_DEG - 8) : 0.55 - 0.4 * (dev - T.LAND_CLEAN_DEG) / (T.LAND_SKETCHY_DEG - T.LAND_CLEAN_DEG);
    if (dev > T.LAND_CLEAN_DEG) keep *= 1 - (1 - T.LAND_SKETCHY_KEEP) * (dev - T.LAND_CLEAN_DEG) / (T.LAND_SKETCHY_DEG - T.LAND_CLEAN_DEG);
    if (grabWeight > 0.6) { clean *= 0.6; keep *= 0.85; }

    // Momentum goes where the board points (lose what the angle costs).
    S.lead = k % 2 === 0 ? 1 : -1;
    const bt = wrap(S.boardYaw + (S.lead < 0 ? Math.PI : 0));
    lift(Math.sin(bt), Math.cos(bt), nx, ny, nz, V3);
    let along = vtx * V3.x + vty * V3.y + vtz * V3.z;
    if (th <= 0.3) along = Math.hypot(vtx, vty, vtz) * Math.sign(along || 1);
    const mag = Math.max(0, along) * keep;
    S.vx = V3.x * mag; S.vy = V3.y * mag; S.vz = V3.z * mag;
    if (along < 0) { S.lead = S.lead < 0 ? 1 : -1; S.vx = -V3.x * -along * keep; S.vy = -V3.y * -along * keep; S.vz = -V3.z * -along * keep; }
    canonical();

    toGround();
    S.landTimer = T.LAND_PHASE; S.sinceLand = 0;
    S.impact = Math.max(S.impact, clamp(impact / 8, 0, 1));
    const bufferedRevert = S.pendRevert >= 0;
    const significant = S.airFromPop || S.airLaunch || airTime >= 0.15 || Math.abs(S.spin) > 0.3;
    if (significant) {
      emit({
        t: S.t, kind: 'land', spinDeg: S.footSign * S.spin * 180 / Math.PI, boardClean: clamp(clean, 0, 1),
        fakie: isFakie(), switch: isSwitch(), airTime, gap, onFeature: S1.feature, revert: bufferedRevert,
      });
    }
    S.trick = null;
    if (bufferedRevert) { S.pendRevert = -1; doRevert(); }
    if (I.manual && speed3() > T.MANUAL_MIN_SPEED) startManual(I.manual);
    S.manualResume = false;
  }

  function toGround(): void {
    S.mode = 'ground';
    S.y = S1.y;
    S.gnx = S1.nx; S.gny = S1.ny; S.gnz = S1.nz; S.kind = S1.kind; S.feature = S1.feature;
    S0lip = S1.lip;
    S.clearance = 0; S.vert = false; S.spinRate = 0; S.kappa = 0;
    S.bodyTwist = 0;
  }

  /* ─────────────────────────────── grinds */

  function tryLock(y0: number, x1: number, y1: number, z1: number): boolean {
    if (!lines.length || S.vy > 0.6) return false;
    // A vert air comes straight back down past its own coping: that is a
    // re-entry, not a grind. Coping grinds off vert need the assist held
    // (lip tricks have their own stall path at launch).
    if (S.vert && !I.grindAssist) return false;
    const reach = (I.grindAssist ? T.GRIND_REACH_ASSIST : T.GRIND_REACH) * (reduced ? 0.75 : 1);
    const need = I.grindAssist ? T.GRIND_ALIGN_ASSIST : T.GRIND_ALIGN;
    const hs = Math.hypot(S.vx, S.vz);
    let best = -1, bestScore = Infinity;
    for (let li = 0; li < lines.length; li++) {
      const L = lines[li]!;
      const m = reach + 0.1;
      if (x1 < L.minX - m || x1 > L.maxX + m || z1 < L.minZ - m || z1 > L.maxZ + m) continue;
      if (li === S.cooldownLine && S.cooldown > 0) continue;
      nearestXZ(L, x1, z1, LQ);
      if (LQ.d2 > reach * reach) continue;
      if (y1 > LQ.y + T.GRIND_ABOVE || y1 < LQ.y - T.GRIND_BELOW) continue;
      if (y0 < LQ.y - 0.05) continue; // came up from underneath
      const sx = LQ.tx, sz = LQ.tz, sl = Math.hypot(sx, sz) || 1;
      const c = hs > 0.3 ? Math.abs(S.vx * sx + S.vz * sz) / (hs * sl) : 0;
      if (c < need) continue;
      const score = Math.sqrt(LQ.d2) + Math.abs(y1 - LQ.y);
      if (score < bestScore) { bestScore = score; best = li; }
    }
    if (best < 0) return false;
    const L = lines[best]!;
    nearestXZ(L, x1, z1, LP);
    lockX = x1; lockZ = z1;
    return lockOn(best, L);
  }

  /** Where the board was (xz) on the substep it locked, before it is put on the line. */
  let lockX = NaN, lockZ = NaN;
  function lockOn(li: number, L: GrindLine): boolean {
    // Flip must be (nearly) caught to lock on.
    const tr = S.trick;
    if (tr && !tr.caught) {
      const window = T.CATCH_WINDOW * (1 - T.CATCH_DIFFICULTY * tr.difficulty) * (reduced ? 0.7 : 1);
      if (tr.u >= 1 - window) catchTrick(0.3 * (1 - (1 - tr.u) / Math.max(1e-6, window)));
      else return false;
    }
    endGrab();
    const segDot = S.vx * LP.tx + S.vy * LP.ty + S.vz * LP.tz;
    const dir: 1 | -1 = segDot >= 0 ? 1 : -1;
    const fx = LP.tx * dir, fz = LP.tz * dir, fl = Math.hypot(fx, fz) || 1;
    const psi = Math.atan2(fx / fl, fz / fl);
    const rx = -Math.cos(psi), rz = Math.sin(psi);
    // Which side did we come from?
    let lat = (S.toX - LP.x) * rx + (S.toZ - LP.z) * rz;
    let near: 1 | -1;
    if (Math.abs(lat) > 0.05) near = lat > 0 ? 1 : -1;
    else { lat = -(S.vx * rx + S.vz * rz); near = lat >= 0 ? 1 : -1; }
    S.lead = Math.abs(wrap(S.boardYaw - psi)) > Math.PI / 2 ? -1 : 1;
    canonical();
    // Approach in the rider's frame: the front-foot end is the nose unless the feet are swapped.
    const ff = S.boardYaw + (S.feetSwapped ? Math.PI : 0);
    const bfx = Math.sin(ff), bfz = Math.cos(ff);
    const along = bfx * Math.sin(psi) + bfz * Math.cos(psi), latb = bfx * rx + bfz * rz;
    const axis = Math.atan2(Math.abs(latb), Math.abs(along));
    const over: 1 | -1 = Math.sign(latb) === -near ? 1 : -1;
    // Frontside: the chest faces the grindable. The chest looks to the right of
    // travel when footSign() is +1 (regular, natural foot leading); the
    // grindable lies on the far side, −near.
    const frontside = footSign() === -near;
    const crossed = Number.isFinite(lockX) ? ((lockX - LP.x) * rx + (lockZ - LP.z) * rz) * near : 0;
    lockX = NaN; lockZ = NaN;
    let def: GrindDef | null = null;
    if (resolve) {
      try {
        // Steering right swings the end that led at take-off to the right; `push` is the stick
        // toward the far side in the front-foot end's terms (+ = over: feeble, boardslide, blunts).
        const push = clamp(I.steer * (S.airFF || 1) * -near, -1, 1);
        def = grinds.get(resolve({ deckYawToLine: axis * over, lean: Math.abs(I.lean) > Math.abs(S.lean) ? I.lean : S.lean, overLine: crossed < -0.06, faceSide: 0, frontside, push })) ?? null;
      } catch { def = null; }
    }
    def = def ?? selectGrind(grinds, { axis, over, lean: S.lean, kind: L.kind }) ?? FALLBACK_GRIND;
    // Board settles at the def's angle on the side it arrived.
    const rel = wrap(S.boardYaw - psi);
    const kk = Math.round(rel / Math.PI);
    const devSide = wrap(rel - kk * Math.PI);
    const yawOff = kk * Math.PI + (devSide >= 0 ? 1 : -1) * Math.min(Math.PI / 2, Math.abs(fin(def.deckYaw)));
    // Coping: which side is the transition (lower)?
    let inX = 0, inZ = 0;
    const coping = L.kind === 'coping';
    if (coping) {
      const a = sample(LP.x + rx * 0.35, LP.z + rz * 0.35, SX, LP.y).y;
      const b = sample(LP.x - rx * 0.35, LP.z - rz * 0.35, SX, LP.y).y;
      const s = a < b ? 1 : -1; inX = rx * s; inZ = rz * s;
    }
    const sp = Math.abs(segDot);
    S.seq++;
    S.grind = {
      li, s: LP.s, dir, speed: Math.max(sp, 0.5), defId: def.id, gid: L.id, seconds: 0, distance: 0, faceSign: near,
      yawOff: wrap(yawOff), pitch: fin(def.deckPitch) * (S.feetSwapped ? -1 : 1), slide: isSlide(def), difficulty: clamp(fin(def.difficulty), 0, 1),
      coping, inX, inZ, seed: (S.seq * 2.399) % 6.283, fs: frontside,
    };
    // A sloppy approach starts you off-balance.
    S.balance = clamp((Math.abs(axis) - Math.min(Math.PI / 2, Math.abs(fin(def.deckYaw)))) * 0.6 * (S.seq % 2 ? 1 : -1), -0.4, 0.4);
    S.mode = 'grind';
    S.x = LP.x; S.y = LP.y; S.z = LP.z;
    S.spinRate = 0; S.vert = false;
    S.boardYaw = wrap(S.boardYaw);
    emit({ t: S.t, kind: 'grind-start', grindId: def.id, grindableId: L.id, kind2: L.kind, switch: isSwitch(), fakie: isFakie(), frontside });
    return true;
  }

  function stepGrind(dt: number): void {
    if (S.stall) { stepStall(dt); return; }
    if (S.wall) { stepWall(dt); return; }
    const g = S.grind!;
    const L = lines[g.li]!;
    pointAt(L, g.s, LP);
    let tx = LP.tx * g.dir, ty = LP.ty * g.dir, tz = LP.tz * g.dir;

    if (S.pendPop) { const p = S.pendPop; S.pendPop = null; exitGrind(true, p); return; }

    const surf = L.kind === 'round-rail' || L.kind === 'kinked-rail' ? 0.85 : 1.15;
    const fr = (g.slide ? T.SLIDE_FRICTION : T.GRIND_FRICTION) * surf + (I.brake ? 2 : 0);
    g.speed += (-G * ty - fr) * dt;
    if (g.speed < T.GRIND_MIN_SPEED) { exitGrind(false, null); return; }
    g.speed = Math.min(g.speed, T.MAX_SPEED);
    let s = g.s + g.dir * g.speed * dt;
    if (!L.closed && (s < 0 || s > L.total)) {
      if (transferAtEnd(g, L, s < 0 ? 0 : L.total, tx, ty, tz)) return;
      g.s = s < 0 ? 0 : L.total;
      exitGrind(false, null);
      return;
    }
    if (L.closed) { s = s % L.total; if (s < 0) s += L.total; }
    g.s = s;
    g.seconds += dt; g.distance += g.speed * dt;

    // Balance: drifts away from centre; the stick pulls it back (balance>0 leans right → steer left).
    const tip = (T.GRIND_TIP + T.GRIND_TIP_DIFF * g.difficulty) * (1 + T.GRIND_TIP_GROWTH * g.seconds) * (reduced ? 1.25 : 1);
    const wob = T.GRIND_WOBBLE * (1 + g.difficulty) * (driftSign(g.seed) + Math.sin(g.seconds * 2.7 + g.seed) + 0.5 * Math.sin(g.seconds * 6.3 + 2 * g.seed));
    S.balance += (tip * S.balance + wob + I.steer * T.GRIND_CONTROL) * dt;
    if (Math.abs(S.balance) > 1) {
      S.vx = tx * g.speed; S.vy = ty * g.speed; S.vz = tz * g.speed;
      bail('balance'); return;
    }

    pointAt(L, g.s, LP);
    tx = LP.tx * g.dir; ty = LP.ty * g.dir; tz = LP.tz * g.dir;
    S.x = LP.x; S.y = LP.y; S.z = LP.z;
    S.vx = tx * g.speed; S.vy = ty * g.speed; S.vz = tz * g.speed;
    const hl = Math.hypot(tx, tz) || 1;
    const psi = Math.atan2(tx / hl, tz / hl);
    const target = wrap(psi + g.yawOff);
    S.boardYaw = wrap(S.boardYaw + wrap(target - S.boardYaw) * ease(18, dt));
    const railPitch = Math.atan2(-ty, hl) * (Math.abs(wrap(S.boardYaw - psi)) > Math.PI / 2 ? -1 : 1);
    S.boardPitch += (g.pitch + railPitch * Math.abs(Math.cos(g.yawOff)) - S.boardPitch) * ease(14, dt);
    S.boardRoll += (S.balance * 0.35 - S.boardRoll) * ease(10, dt);
    S.bodyTwist += (0 - S.bodyTwist) * ease(8, dt);
  }

  /** Coping around a bowl or a rail built from several pieces: carry straight on to the next. */
  function transferAtEnd(g: GrindS, L: GrindLine, sEnd: number, tx: number, ty: number, tz: number): boolean {
    pointAt(L, sEnd, LQ);
    const ex = LQ.x, ey = LQ.y, ez = LQ.z;
    for (let mi = 0; mi < lines.length; mi++) {
      if (mi === g.li) continue;
      const M = lines[mi]!;
      for (let end = 0; end < 2; end++) {
        const idx = end === 0 ? 0 : M.n - 1;
        if (Math.hypot(M.px[idx]! - ex, M.py[idx]! - ey, M.pz[idx]! - ez) > 0.12) continue;
        pointAt(M, end === 0 ? 0 : M.total, LQ);
        const dir: 1 | -1 = end === 0 ? 1 : -1;
        if (LQ.tx * dir * tx + LQ.ty * dir * ty + LQ.tz * dir * tz < 0.5) continue;
        const def = g.defId;
        endGrind('transfer');
        S.cooldown = 0;
        S.seq++;
        S.grind = { ...g, li: mi, s: end === 0 ? 0 : M.total, dir, gid: M.id, seconds: 0, distance: 0, seed: (S.seq * 2.399) % 6.283, coping: M.kind === 'coping' };
        emit({ t: S.t, kind: 'grind-start', grindId: def, grindableId: M.id, kind2: M.kind, switch: isSwitch(), fakie: isFakie(), frontside: g.fs });
        return true;
      }
    }
    return false;
  }

  function exitGrind(pop: boolean, req: PopReq | null): void {
    const g = S.grind!;
    const L = lines[g.li]!;
    pointAt(L, g.s, LP);
    const tx = LP.tx * g.dir, ty = LP.ty * g.dir, tz = LP.tz * g.dir;
    endGrind(pop ? 'ollie' : 'roll');
    const spd = Math.max(0, g.speed);
    S.vx = tx * spd; S.vy = ty * spd; S.vz = tz * spd;
    const hl = Math.hypot(tx, tz) || 1;
    const psi = Math.atan2(tx / hl, tz / hl);
    const rx = -Math.cos(psi), rz = Math.sin(psi);
    if (g.coping) {
      S.vx = S.vx * 0.6 + g.inX * 1.5; S.vz = S.vz * 0.6 + g.inZ * 1.5; S.vy = Math.max(S.vy, 0.3);
    } else {
      // Off to the side you steer toward, else back the way you came.
      const side = Math.abs(I.steer) > 0.3 ? (I.steer > 0 ? 1 : -1) : g.faceSign;
      const k = pop ? T.GRIND_EXIT_SIDE : (spd < T.GRIND_MIN_SPEED + 0.05 ? 0.9 : 0.25);
      S.vx += rx * side * k; S.vz += rz * side * k;
      if (!pop && spd < T.GRIND_MIN_SPEED + 0.05) S.vy = 0.2;
    }
    // The deck turns back in line with travel (slides come "out" to the nearest end).
    const hd = Math.atan2(S.vx, S.vz);
    const rel = wrap(S.boardYaw - hd);
    const kk = Math.round(rel / Math.PI);
    S.boardYaw = wrap(hd + kk * Math.PI);
    S.lead = kk % 2 === 0 ? 1 : -1;
    canonical();
    S.balance = 0;
    if (pop && req) doPop(req, 0, 1, 0, false);
    else { enterAir(false, false); S.coyote = T.POP_COYOTE; }
  }

  /* ─────────────────────────────── wallride */

  /** Popped into a tall face while travelling along it: ride it. */
  function tryWallride(id: string, nx: number, nz: number, x: number, z: number, y: number, field: boolean): boolean {
    if (!S.airFromPop || S.airTime > 0.9 || (S.trick && !S.trick.caught)) return false;
    const into = -(S.vx * nx + S.vz * nz);
    const ax = S.vx + into * nx, az = S.vz + into * nz, along = Math.hypot(ax, az);
    if (along < T.WALLRIDE_MIN_SPEED || Math.atan2(Math.max(0, into), along) > T.WALLRIDE_ANGLE) return false;
    endGrab();
    const hd = Math.atan2(ax, az), rx = -Math.cos(hd), rz = Math.sin(hd);
    // Wall is on the rider's right when its outward normal points left.
    const side: 1 | -1 = -(nx * rx + nz * rz) >= 0 ? 1 : -1;
    S.mode = 'grind';
    S.wall = { id, nx, nz, side, t: 0, field };
    S.x = x; S.z = z; S.y = y;
    S.vx = ax; S.vz = az; S.vy = Math.max(S.vy, 1);
    const rel = wrap(S.boardYaw - hd), kk = Math.round(rel / Math.PI);
    S.boardYaw = wrap(hd + kk * Math.PI);
    S.lead = kk % 2 === 0 ? 1 : -1;
    canonical();
    S.spinRate = 0;
    return true;
  }

  function wallStillThere(W: WallS, x: number, z: number, y: number): boolean {
    const px = x - W.nx * (T.RADIUS + 0.06), pz = z - W.nz * (T.RADIUS + 0.06);
    if (W.field) return sample(px, pz, SX, y).y > y + 0.3;
    pushOutAll(px, pz, y, 0.02, island, solids, H);
    return H.id !== null;
  }

  function endWall(): void {
    if (!S.wall) return;
    emit({ t: S.t, kind: 'wallride', seconds: S.wall.t });
    S.wall = null;
  }

  function stepWall(dt: number): void {
    const W = S.wall!;
    W.t += dt;
    const h = Math.hypot(S.vx, S.vz);
    const k = h > 1e-6 ? Math.max(0, h - T.WALLRIDE_FRICTION * dt) / h : 0;
    S.vx *= k; S.vz *= k;
    S.vy -= G * T.WALLRIDE_GRAVITY * dt;
    const x1 = S.x + S.vx * dt, z1 = S.z + S.vz * dt, y1 = S.y + S.vy * dt;
    const pop = S.pendPop;
    const off = pop !== null || W.t > T.WALLRIDE_MAX_TIME || h < 2 || !wallStillThere(W, x1, z1, y1);
    sample(x1, z1, S1, y1);
    if (y1 <= S1.y) { S.x = x1; S.z = z1; S.y = S1.y; endWall(); S.mode = 'air'; land(); return; }
    S.x = x1; S.y = y1; S.z = z1;
    S.boardRoll += (W.side * (Math.PI / 2 - 0.25) * (S.lead < 0 ? -1 : 1) - S.boardRoll) * ease(14, dt);
    S.boardPitch += (0 - S.boardPitch) * ease(10, dt);
    if (!off) return;
    endWall();
    S.vx += W.nx * T.WALLRIDE_EXIT_PUSH * (pop ? 1 : 0.5); S.vz += W.nz * T.WALLRIDE_EXIT_PUSH * (pop ? 1 : 0.5);
    S.x += W.nx * 0.03; S.z += W.nz * 0.03;
    if (pop) { S.pendPop = null; doPop(pop, 0, 1, 0, false); }
    else { enterAir(false, false); S.coyote = T.POP_COYOTE; }
  }

  /* ─────────────────────────────── bail / recover */

  function stepBail(dt: number): void {
    const b = S.bail!;
    b.t += dt;
    sample(S.x, S.z, S1, S.y);
    if (S.y > S1.y + 0.01) S.vy -= G * dt;
    else { S.vy = 0; S.y = S1.y; const k = Math.exp(-3.5 * dt); S.vx *= k; S.vz *= k; }
    const x1 = S.x + S.vx * dt, z1 = S.z + S.vz * dt;
    const w = sweepXZ(S.x, S.z, x1, z1, S.y);
    if (w !== 'clear') { S.vx = 0; S.vz = 0; }
    let nx = w !== 'clear' ? H.x : x1, nz = w !== 'clear' ? H.z : z1;
    sample(nx, nz, SX, S.y);
    if (SX.y > S.y + 0.15) { nx = S.x; nz = S.z; S.vx = 0; S.vz = 0; } // tumbling doesn't climb walls
    S.x = nx; S.z = nz;
    S.y = Math.max(S.y + S.vy * dt, sample(S.x, S.z, SX, S.y).y);
    S.boardPitch *= Math.exp(-4 * dt);
    if (b.t >= T.BAIL_TIME) recover();
  }

  function recover(): void {
    const b = S.bail;
    const bx = S.x, bz = S.z;
    let pick: Pose | null = null;
    for (let i = S.safe.length - 1; i >= 0; i--) {
      const p = S.safe[i]!;
      if (Math.hypot(p.x - bx, p.z - bz) < 0.8 && i > 0) continue;
      pushOutAll(p.x, p.z, sample(p.x, p.z, SX, S.y).y, T.RADIUS, island, solids, H);
      if (H.id || SX.lip || SX.ny < 0.9) continue;
      pick = p; break;
    }
    if (!pick) pick = S.marker ?? S.spawn;
    const hazard = b && (b.reason === 'wall' || b.reason === 'water');
    const yaw = hazard ? wrap(pick.yaw + Math.PI) : pick.yaw;
    placeAt(pick.x, pick.z, yaw);
    S.mode = 'recover';
    S.recoverT = T.RECOVER_TIME;
    S.safe = [{ x: pick.x, z: pick.z, yaw }];
    emit({ t: S.t, kind: 'recovered' });
  }

  function placeAt(x: number, z: number, yaw: number): void {
    sample(x, z, S1, S.y);
    S.x = x; S.z = z; S.y = S1.y;
    S.vx = 0; S.vy = 0; S.vz = 0;
    S.gnx = S1.nx; S.gny = S1.ny; S.gnz = S1.nz; S.kind = S1.kind; S.feature = S1.feature;
    S0lip = S1.lip;
    S.boardYaw = wrap(yaw); S.boardPitch = 0; S.boardRoll = 0; S.bodyTwist = 0; S.slideAngle = 0;
    S.lead = 1; S.feetSwapped = false;
    S.mode = 'ground'; S.bail = null; S.grind = null; S.stall = null; S.wall = null; S.manual = null; S.slide = null; S.trick = null; S.grab = null;
    S.pendPop = null; S.pendLate = null; S.pendRevert = -1; S.balance = 0; S.impact = 0; S.landTimer = 0; S.sinceLand = 9;
    S.stroke = false; S.pushPhase = 0; S.crouch = 0; S.crouchPeak = 0; S.spinRate = 0; S.spin = 0; S.airTime = 0; S.clearance = 0;
    S.kappa = 0; S.turnRate = 0; S.vert = false; S.cooldown = 0; S.cooldownLine = -1; S.manualResume = false;
  }

  /* ─────────────────────────────── one substep */

  function substep(): void {
    const dt = DT;
    S.t += dt;
    S.cooldown = Math.max(0, S.cooldown - dt);
    S.impact *= Math.exp(-T.IMPACT_DECAY * dt);
    // Filters.
    pumpPrevCrouch = S.crouch;
    const cr = S.mode === 'ground' || S.mode === 'air' ? I.crouch : 0;
    S.crouch = cr > S.crouch ? Math.min(cr, S.crouch + T.CROUCH_IN_RATE * dt) : Math.max(cr, S.crouch - T.CROUCH_OUT_RATE * dt);
    S.crouchPeak = Math.max(S.crouch, S.crouchPeak - 3 * dt);
    S.lean += (I.lean - S.lean) * ease(T.LEAN_RESPONSE, dt);
    S.carve += (I.steer - S.carve) * ease(T.CARVE_RESPONSE, dt);
    if (S.mode === 'ground') {
      const want = clamp(I.steer * S.crouch * T.PREWIND_MAX, -T.PREWIND_MAX, T.PREWIND_MAX);
      S.bodyTwist += (want - S.bodyTwist) * ease(9, dt);
    }

    switch (S.mode) {
      case 'ground': stepGround(dt); break;
      case 'air': stepAir(dt); break;
      case 'grind': stepGrind(dt); break;
      case 'bail': stepBail(dt); break;
      case 'recover':
        S.recoverT -= dt;
        if (S.recoverT <= 0) { S.recoverT = 0; S.mode = 'ground'; }
        break;
    }

    // Age the one-shot buffers.
    if (S.pendPop) { S.pendPop.age += dt; if (S.pendPop.age > T.POP_BUFFER) S.pendPop = null; }
    if (S.pendLate) { S.pendLate.age += dt; if (S.pendLate.age > T.POP_BUFFER) S.pendLate = null; }
    if (S.pendRevert >= 0) { S.pendRevert += dt; if (S.pendRevert > 0.15 && S.mode !== 'air') S.pendRevert = -1; else if (S.pendRevert > 0.4) S.pendRevert = -1; }

    // Never NaN: a poisoned state goes back to the last safe place.
    if (!(Number.isFinite(S.x) && Number.isFinite(S.y) && Number.isFinite(S.z) && Number.isFinite(S.vx) && Number.isFinite(S.vy) && Number.isFinite(S.vz) &&
      Number.isFinite(S.boardYaw) && Number.isFinite(S.boardPitch) && Number.isFinite(S.boardRoll) && Number.isFinite(S.balance))) {
      const p = S.safe[S.safe.length - 1] ?? S.spawn;
      placeAt(p.x, p.z, p.yaw);
    }
  }

  /* ─────────────────────────────── present */

  function writePresent(): SkatePresent {
    P.x = S.x; P.y = S.y; P.z = S.z; P.vx = S.vx; P.vy = S.vy; P.vz = S.vz;
    P.speed = speed3();
    P.heading = travelYaw();
    P.boardYaw = S.boardYaw; P.boardPitch = S.boardPitch; P.boardRoll = S.boardRoll; P.bodyTwist = S.bodyTwist;
    P.stance = S.stance; P.switch = isSwitch(); P.fakie = isFakie();
    P.crouch = S.crouch; P.lean = S.lean;
    P.carve = clamp(S.carve * footSign(), -1, 1);
    P.balance = clamp(S.balance, -1, 1);
    P.pushPhase = S.stroke ? S.pushPhase : 0;
    P.airTime = S.mode === 'air' ? S.airTime : 0;
    P.clearance = S.mode === 'air' ? S.clearance : 0;
    // Only while the board is flipping: once caught, its yaw half-turns are already in boardYaw.
    if (S.trick && !S.trick.caught) { pTrick.flipId = S.trick.flipId; pTrick.u = S.trick.u; P.trick = pTrick; } else P.trick = null;
    if (S.grab) { pGrab.grabId = S.grab.grabId; pGrab.weight = S.grab.weight; P.grab = pGrab; } else P.grab = null;
    if (S.grind) { pGrind.grindId = S.grind.defId; pGrind.grindableId = S.grind.gid; pGrind.faceSign = S.grind.faceSign; P.grind = pGrind; }
    else if (S.stall) { pGrind.grindId = S.stall.id; pGrind.grindableId = S.stall.feature; pGrind.faceSign = 1; P.grind = pGrind; }
    else if (S.wall) { pGrind.grindId = 'wallride'; pGrind.grindableId = S.wall.id; pGrind.faceSign = S.wall.side; P.grind = pGrind; }
    else P.grind = null;
    P.manual = S.manual ? S.manual.kind : null;
    if (S.bail) { pBail.t = S.bail.t; pBail.reason = S.bail.reason; pBail.dirX = S.bail.dirX; pBail.dirZ = S.bail.dirZ; P.bail = pBail; } else P.bail = null;
    P.impact = S.impact;
    P.surface = S.kind;
    P.phase =
      S.mode === 'bail' ? 'bail' :
      S.mode === 'recover' ? 'recover' :
      S.mode === 'air' ? 'air' :
      S.mode === 'grind' ? 'grind' :
      S.manual ? 'manual' :
      S.slide || Math.abs(S.slideAngle) > 0.5 ? 'powerslide' :
      S.landTimer > 0 ? 'land' :
      S.crouch > 0.35 ? 'crouch' :
      S.stroke ? 'push' :
      P.speed > 0.15 ? 'roll' : 'idle';
    return P;
  }

  /* ─────────────────────────────── intent intake */

  function readHeld(intent: SkateIntent): void {
    I.steer = clamp(fin(intent?.steer), -1, 1);
    I.lean = clamp(fin(intent?.lean), -1, 1);
    I.push = intent?.push === true;
    I.brake = intent?.brake === true;
    I.powerslide = intent?.powerslide === true;
    I.crouch = clamp(fin(intent?.crouch), 0, 1);
    I.grab = typeof intent?.grab === 'string' ? intent.grab : null;
    I.manual = intent?.manual === 'manual' || intent?.manual === 'nose-manual' ? intent.manual : null;
    I.grindAssist = intent?.grindAssist === true;
    I.sprint = intent?.sprint === true;
  }
  function readOneShots(intent: SkateIntent): void {
    const p = intent?.pop;
    if (p && typeof p === 'object' && S.mode !== 'bail' && S.mode !== 'recover') {
      S.pendPop = { from: p.from === 'nose' ? 'nose' : 'tail', flipId: typeof p.flipId === 'string' ? p.flipId : null, strength: clamp(fin(p.strength, 0.5), 0, 1), age: 0 };
    }
    if (typeof intent?.lateFlip === 'string' && S.mode === 'air') S.pendLate = { id: intent.lateFlip, age: 0 };
    if (intent?.revert === true && S.mode !== 'bail' && S.mode !== 'recover') S.pendRevert = 0;
  }

  /* ─────────────────────────────── API */

  function step(intent: SkateIntent, dt: number) {
    events.length = 0;
    readHeld(intent);
    if (intent?.respawn === true) sim.toMarker();
    if (intent?.marker === true) sim.setMarker();
    const d = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
    S.acc += d;
    let n = Math.floor((S.acc + 1e-9) / DT);
    S.acc = Math.max(0, S.acc - n * DT);
    // Sample-and-hold: this intent governs the interval being simulated, and
    // one-shots fire on its first substep (or wait for the next substep when
    // a >120 fps frame runs none), so the same input at 30/60/144 fps lands
    // at the same sim time.
    readOneShots(intent);
    while (n > 0) { substep(); n--; }
    return { present: writePresent(), events };
  }

  const sim: SkateSim = {
    step,
    present: () => writePresent(),
    reset(x, z, yaw) {
      const keepMarker = S.marker, stance = S.stance, t = S.t, seq = S.seq;
      S = freshState(x, z, yaw, stance);
      S.marker = keepMarker; S.t = t; S.seq = seq;
      S0lip = null;
      writePresent();
    },
    setStance(s) { S.stance = s === 'goofy' ? 'goofy' : 'regular'; },
    save() {
      return structuredClone({ ...S, s0lip: S0lip, pumpPrevCrouch });
    },
    load(saved) {
      if (!saved || typeof saved !== 'object') return;
      const o = saved as Partial<SimState> & { s0lip?: SurfaceSample['lip']; pumpPrevCrouch?: number };
      if (o.ver !== 2) return;
      const nums = ['t', 'acc', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'boardYaw', 'boardPitch', 'boardRoll'] as const;
      if (!nums.every((k) => Number.isFinite(o[k]))) return;
      if (!o.mode || !['ground', 'air', 'grind', 'bail', 'recover'].includes(o.mode)) return;
      if (o.mode === 'grind' && !o.stall && !o.wall && (!o.grind || !lines[o.grind.li])) return;
      const copy = structuredClone(o) as SimState & { s0lip?: SurfaceSample['lip']; pumpPrevCrouch?: number };
      S0lip = copy.s0lip ?? null;
      pumpPrevCrouch = fin(copy.pumpPrevCrouch);
      delete copy.s0lip; delete copy.pumpPrevCrouch;
      S = copy;
      if (!Array.isArray(S.safe) || !S.safe.length) S.safe = [{ x: S.x, z: S.z, yaw: S.boardYaw }];
      writePresent();
    },
    setMarker() {
      if (S.mode !== 'ground' || S.recoverT > 0 || speed3() > T.MARKER_MAX_SPEED || S.gny < 0.9) return false;
      sample(S.x, S.z, SX, S.y);
      if (SX.lip) return false;
      S.marker = { x: S.x, z: S.z, yaw: wrap(S.boardYaw - S.slideAngle + (S.lead < 0 ? Math.PI : 0)) };
      return true;
    },
    toMarker() {
      const p = S.marker ?? S.spawn;
      placeAt(p.x, p.z, p.yaw);
      S.safe = [{ x: p.x, z: p.z, yaw: p.yaw }];
      writePresent();
    },
  };
  writePresent();
  return sim;
}
