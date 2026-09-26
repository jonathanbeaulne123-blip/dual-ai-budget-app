/**
 * The legs (RIDE §4): the only thing that adds energy on the ground. Push stroke, foot
 * brake, pump and the boost (charge → clean exit → window → W → burst → cooldown), all
 * along one seam: an acceleration along the board axis (lead-corrected), or along the
 * travel for the brake and the pump. Pure over the kernel state.
 */
import type {GroundEvent, GroundInput, GroundProfile, GroundState, XYZ} from './types.ts';
import {SLIDE_GRIP, clamp, fromHome, type BoardFrame} from './tyre.ts';

const RAD = Math.PI / 180;
/** Skate v2's kick window and its sin-shape normaliser (mean of sin over the window = 1). */
const KICK_FROM = 0.14, KICK_TO = 0.44, KICK_NORM = 1.57;
/** Skate v2 CROUCH_DROP: metres the hips travel from stand to full crouch (pump energy). */
const CROUCH_DROP = 0.3;
/** Charging needs a real slide; the unclaimed arc empties over 1 s. */
const CHARGE_GRIP = 0.3, EBB_RATE = 1;

/**
 * Charge, exit, window and release (§4.3). Runs after the grip step (it needs the grip
 * crossing). `pushEdge` is W pressed this step.
 */
export function boostStep(state: GroundState, input: GroundInput, p: GroundProfile, c: { s: number; beta: number; gripPrev: number; pushEdge: boolean; dt: number }, ev: GroundEvent[]): void {
  const L = state.legs, P = p.legs, {s, beta, dt} = c;
  const sliding = state.grip < CHARGE_GRIP;
  state.slideFor = sliding ? state.slideFor + dt : 0;
  if (L.boost > 0) {
    L.boost = Math.max(0, L.boost - dt);
    if (L.boost === 0) { state.latch.boostAccel = 0; L.cooldown = P.boostCooldown; }
  } else if (L.cooldown > 0) L.cooldown = state.grip > SLIDE_GRIP ? Math.max(0, L.cooldown - dt) : P.boostCooldown;
  const blocked = L.boost > 0 || L.cooldown > 0;
  if (sliding && !blocked && state.slideFor - dt >= P.setDelay - 1e-9 && s >= P.chargeMinSpeed && P.boostPeak > 0) {
    const rate = (Math.abs(Math.sin(beta)) / Math.SQRT1_2) * Math.min(1, s / 6) / P.chargeTime;
    L.charge = Math.min(1, L.charge + rate * dt);
  }
  // Grip returns: a clean exit opens the window, a dirty one lets the arc empty.
  if (c.gripPrev < SLIDE_GRIP && state.grip >= SLIDE_GRIP && L.charge > 0 && !blocked) {
    if (fromHome(beta) < P.cleanExitDeg * RAD && s >= P.chargeMinSpeed) { L.window = P.releaseWindow; ev.push({kind: 'boostReady', step: state.step, data: {charge: L.charge}}); }
    else ev.push({kind: 'boostLost', step: state.step, data: {charge: L.charge, reason: 'dirty'}});
  }
  if (L.window > 0) {
    if (c.pushEdge) {
      state.latch.boostAccel = P.boostPeak * L.charge / P.boostTime;
      L.boost = P.boostTime;
      ev.push({kind: 'boost', step: state.step, data: {charge: L.charge}});
      L.charge = 0; L.window = 0;
    } else {
      L.window = Math.max(0, L.window - dt);
      if (L.window === 0) ev.push({kind: 'boostLost', step: state.step, data: {charge: L.charge, reason: 'window'}});
    }
  } else if (!sliding && L.charge > 0) L.charge = Math.max(0, L.charge - EBB_RATE * dt);
  L.crouch = Math.max(clamp(input.crouch, 0, 1), L.charge);
}

export interface LegsContext { f: BoardFrame; s: number; pushGrip: number; slope: number; dt: number }

/**
 * The legs' accelerations for one step (after gravity, roll and drag; before the tyre).
 * Mutates `v`. Push along the axis inside the kick window; foot brake along −t̂; the boost
 * along the axis; the pump along t̂ from the player's crouch change × curvature.
 */
export function legsStep(state: GroundState, input: GroundInput, p: GroundProfile, c: LegsContext, v: XYZ): void {
  const L = state.legs, P = p.legs, {f, dt} = c;
  let s = c.s;
  // Push stroke (Skate v2's stroke; blocked while sliding, crouched, on steep ground, or boosting).
  const canPush = state.grip >= SLIDE_GRIP && !input.slide && input.crouch < 0.5 && c.slope <= P.pushSlopeMax && L.boost === 0;
  let along = 0;
  if (L.stroke >= 0) {
    L.stroke += dt / (input.sprint ? P.sprintPeriod : P.period);
    if (L.stroke >= 1) L.stroke = input.push && canPush ? L.stroke - 1 : -1;
  } else if (input.push && canPush) L.stroke = 0;
  if (L.stroke >= KICK_FROM && L.stroke <= KICK_TO && input.push && canPush) {
    const cap = input.sprint ? P.sprintCap : P.pushCap, acc = input.sprint ? P.sprintAccel : P.pushAccel;
    const w = (L.stroke - KICK_FROM) / (KICK_TO - KICK_FROM);
    along += acc * c.pushGrip * Math.pow(Math.max(0, 1 - s / cap), 0.8) * Math.sin(Math.PI * w) * KICK_NORM;
  }
  along += state.latch.boostAccel;
  if (along !== 0) { v[0] += f.a[0] * along * dt; v[1] += f.a[1] * along * dt; v[2] += f.a[2] * along * dt; s = Math.hypot(v[0], v[1], v[2]); }
  // Foot brake (§3.3 low speed; the bicycle brakes at any speed: brakeSpeedMax Infinity).
  if (input.slide && s > 0 && s < P.brakeSpeedMax) scaleSpeed(v, Math.max(0, s - P.footBrake * dt) / s);
  // Pump (§4.2): extending where the path curves adds energy; crouching there costs it.
  const dCrouch = clamp(input.crouch, 0, 1) - state.latch.prevCrouch, kappa = state.latch.kappa;
  s = Math.hypot(v[0], v[1], v[2]);
  if (dCrouch !== 0 && kappa !== 0 && s > 0.3) {
    const v2 = s * s, eff = v2 / (1 + v2 / (P.pumpVref * P.pumpVref));
    const dE = -dCrouch * CROUCH_DROP * eff * kappa * P.pumpGain;
    scaleSpeed(v, Math.sqrt(Math.max(0.01, v2 + 2 * dE)) / s);
  }
}

function scaleSpeed(v: XYZ, k: number): void { v[0] *= k; v[1] *= k; v[2] *= k; }
