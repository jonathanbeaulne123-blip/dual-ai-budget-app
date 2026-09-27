import {beforeAll, describe, expect, it} from 'vitest';
import {groundGuard, groundSpeed, slipAngle, stepGround} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {BOARD_TEST_PROFILE as P, rideStart, runScript, syntheticQuery, type RideScript} from '../src/harbour/horizon/movers/shared/ground/synthetic.ts';
import {boardFrame} from '../src/harbour/horizon/movers/shared/ground/tyre.ts';
import {NEUTRAL_INPUT, type GroundEvent, type GroundState, type XYZ} from '../src/harbour/horizon/movers/shared/ground/types.ts';

const DEG = Math.PI / 180;
beforeAll(() => { groundGuard.strict = true; });

function forceSlip(st: GroundState, beta: number, s: number): void {
  const f = boardFrame(st.heading, st.lead, st.contact.n);
  st.v = [0, 1, 2].map((k) => s * (Math.cos(beta) * f.a[k]! + Math.sin(beta) * f.l[k]!)) as XYZ;
}
/** Hold a slide at a fixed angle and speed (S held so grip stays loose); returns the time charge first reaches 1. */
function chargeTimeAt(betaDeg: number, speed: number, seconds = 2.5): { full: number; at: (t: number) => number } {
  const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, speed);
  st.grip = 0; forceSlip(st, betaDeg * DEG, speed);
  const trace: number[] = [];
  let full = -1;
  runScript(st, q, P, () => ({slide: true}), seconds, (s, _e, t) => {
    forceSlip(s, betaDeg * DEG, speed); s.yawRate = 0;
    trace.push(s.legs.charge);
    if (full < 0 && s.legs.charge >= 1) full = t;
  });
  return {full, at: (t) => trace[Math.round(t * 120) - 1] ?? 0};
}
/** S held for `hold` s (stick `steer`), then countersteer until grip returns; W pressed `wDelay` s after grip crosses 0.7 (or never). */
function exitScript(hold: number, steer: number, wDelay: number | null): RideScript {
  let crossed = -1;
  return (t, s) => {
    if (t < hold) return {slide: true, steer};
    if (crossed < 0 && s.grip >= 0.7) crossed = t;
    const w = wDelay !== null && crossed >= 0 && t >= crossed + wDelay && t < crossed + wDelay + 0.05;
    return {steer: s.grip < 0.7 ? (slipAngle(s) > 0 ? -1 : 1) : 0, push: w};
  };
}
function traced(v0: number, grade: number, script: RideScript, seconds: number) {
  const q = syntheticQuery({gradePct: grade}), st = rideStart(q, 0, 0, 0, v0);
  const speed: number[] = [];
  const ev = runScript(st, q, P, script, seconds, (s) => speed.push(groundSpeed(s)));
  const stepOf = (kind: GroundEvent['kind']) => ev.find((e) => e.kind === kind)?.step ?? -1;
  return {st, ev, speed, stepOf};
}

describe('ground kernel · the legs: push, charge, boost (RIDE §4)', () => {
  it('push on the flat: 8–10 strokes in 4 s and a cruise of 5.5–7.0; coasting 1 s from 6 loses < 0.6', () => {
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 0);
    let strokes = 0, prev = -1;
    runScript(st, q, P, () => ({push: true}), 4, (s) => { if (s.legs.stroke >= 0 && (prev < 0 || s.legs.stroke < prev)) strokes++; prev = s.legs.stroke; });
    expect(strokes).toBeGreaterThanOrEqual(8); expect(strokes).toBeLessThanOrEqual(10);
    expect(groundSpeed(st)).toBeGreaterThanOrEqual(5.5); expect(groundSpeed(st)).toBeLessThanOrEqual(7.0);
    const c = rideStart(q, 0, 0, 0, 6);
    runScript(c, q, P, () => ({}), 1);
    expect(6 - groundSpeed(c)).toBeLessThan(0.6);
  });

  it('pushing is blocked while sliding, crouched past 0.5, on ground steeper than pushSlopeMax, and off the bed', () => {
    const gain = (opts: Parameters<typeof syntheticQuery>[0], o: object, x = 0) => {
      const q = syntheticQuery(opts), st = rideStart(q, x, 0, 0, 1), s0 = groundSpeed(st);
      runScript(st, q, P, () => ({push: true, ...o}), 0.5);
      return groundSpeed(st) - s0;
    };
    expect(gain({}, {})).toBeGreaterThan(1);
    expect(gain({}, {crouch: 0.6})).toBeLessThan(0);
    expect(gain({bedWidth: 4}, {}, 10)).toBeLessThan(0);                 // offbed: pushGrip 0, the wheels dig in
    expect(gain({bankDeg: 40}, {})).toBeLessThan(0.2);                     // steeper than 35°: no stroke (the bank pulls sideways)
  });

  it('no charge under the 0.35 s set delay or under 3 m/s; full at ~1.55 s of a 45° slide at ≥ 6 m/s; never sooner than 1.2 s broadside', () => {
    const at45 = chargeTimeAt(45, 7);
    expect(at45.at(0.34)).toBe(0);
    expect(at45.full).toBeGreaterThan(1.4); expect(at45.full).toBeLessThan(1.7);
    expect(chargeTimeAt(45, 2.8).at(1.5)).toBe(0);
    const broad = chargeTimeAt(90, 8);
    expect(broad.full).toBeGreaterThanOrEqual(1.2 - 1e-9);
    expect(broad.full).toBeLessThan(1.3);
    expect(chargeTimeAt(25, 8).at(1.55)).toBeGreaterThan(0.45);          // a speed check earns about half
    expect(chargeTimeAt(25, 8).at(1.55)).toBeLessThan(0.65);
    expect(chargeTimeAt(45, 3).at(1.55)).toBeLessThan(0.55);              // slow slides fill slowly
  });

  it('the charge is pose-only: legs.crouch shows it, the kernel never reads it as crouch', () => {
    const r = chargeTimeAt(45, 7, 1.2);
    expect(r.at(1.2)).toBeGreaterThan(0.5);
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 7);
    st.grip = 0; forceSlip(st, 45 * DEG, 7); st.legs.charge = 0.9;
    stepGround(st, {...NEUTRAL_INPUT, slide: true}, q, P);
    expect(st.legs.crouch).toBeCloseTo(0.9, 2);
    expect(st.latch.prevCrouch).toBe(0);                                   // the pump and the landing read input.crouch
  });

  it('a clean exit opens the window; W inside it releases the boost: +1.6–2.4 m/s within 0.7 s from a ≥ 0.85 charge (RIDE §9; measured +2.13)', () => {
    const w = traced(11, 4, exitScript(1.6, -1, 0.1), 3.2);
    const ready = w.ev.find((e) => e.kind === 'boostReady'), boost = w.ev.find((e) => e.kind === 'boost');
    expect(ready).toBeDefined(); expect(boost).toBeDefined();
    expect(Number(boost!.data!.charge)).toBeGreaterThanOrEqual(0.85);
    const i0 = boost!.step - 1, rise = Math.max(...w.speed.slice(i0, i0 + 84)) - w.speed[i0]!;
    const n = traced(11, 4, exitScript(1.6, -1, null), 3.2);                // the same without W
    const nRise = Math.max(...n.speed.slice(i0, i0 + 84)) - n.speed[i0]!;
    expect(n.ev.some((e) => e.kind === 'boost')).toBe(false);
    expect(rise - nRise).toBeGreaterThanOrEqual(1.6); expect(rise).toBeLessThanOrEqual(2.4);
  });

  it('a late W (0.6 s after the window opens) does nothing; the arc empties with boostLost', () => {
    const late = traced(11, 4, exitScript(1.6, -1, 0.6), 3.2);
    expect(late.ev.some((e) => e.kind === 'boostReady')).toBe(true);
    expect(late.ev.some((e) => e.kind === 'boost')).toBe(false);
    expect(late.ev.some((e) => e.kind === 'boostLost')).toBe(true);
    expect(late.st.legs.charge).toBeLessThan(0.5);
  });

  it('a dirty exit (|β| > 25° when grip crosses 0.7) never opens the window, and W then only pushes', () => {
    const q = syntheticQuery({gradePct: 15}), st = rideStart(q, 0, 0, 0, 10);
    const ev = runScript(st, q, P, (t) => (t < 1.8 ? {slide: true} : {push: t > 1.9}), 3);  // released with the stick centred at 40°
    const lost = ev.find((e) => e.kind === 'boostLost');
    expect(lost?.data?.reason).toBe('dirty');
    expect(ev.some((e) => e.kind === 'boostReady' || e.kind === 'boost')).toBe(false);
  });

  it('cooldown: after a boost, charging waits until grip has been above 0.7 for boostCooldown (0.4 s)', () => {
    const q = syntheticQuery({gradePct: 4}), st = rideStart(q, 0, 0, 0, 11);
    const script = exitScript(1.6, -1, 0.1);
    let tBoostEnd = -1;
    runScript(st, q, P, script, 2.6, (s, _e, t) => { if (tBoostEnd < 0 && s.legs.cooldown > 0) tBoostEnd = t; });
    expect(tBoostEnd).toBeGreaterThan(0);
    expect(st.legs.cooldown).toBeGreaterThan(0);
    // Slide again at once: grip drops under 0.7, the cooldown re-arms and nothing charges.
    st.v = st.v.map((x) => x * 8 / groundSpeed(st)) as XYZ;
    runScript(st, q, P, () => ({slide: true}), 1.2);
    expect(st.legs.charge).toBe(0);
    // Ride on until grip has been back above 0.7 for 0.4 s, and the next slide charges.
    let gripped = 0;
    runScript(st, q, P, (_t, s) => ({steer: s.grip < 0.7 ? (slipAngle(s) > 0 ? -1 : 1) : 0}), 1.5, (s) => { gripped = s.grip > 0.7 ? gripped + 1 / 120 : 0; if (gripped < 0.39) expect(s.legs.cooldown).toBeGreaterThan(0); });
    expect(st.legs.cooldown).toBe(0);
    st.v = st.v.map((x) => x * 8 / groundSpeed(st)) as XYZ;
    runScript(st, q, P, () => ({slide: true}), 1);
    expect(st.legs.charge).toBeGreaterThan(0);
  });

  it('flat slide-then-boost never gains: a 1.55 s slide from 10 m/s and a boost ends slower than 10', () => {
    for (const steer of [0, 0.25]) {                                         // the 40° hold, and 45° with a touch of stick into
      const r = traced(10, 0, exitScript(1.55, steer, 0.05), 4);
      expect(r.ev.some((e) => e.kind === 'boost')).toBe(true);
      expect(Math.max(...r.speed.slice(Math.round(1.55 * 120)))).toBeLessThan(10);
    }
  });
});
