import {beforeAll, describe, expect, it} from 'vitest';
import {createGroundState, groundGuard, groundSpeed, slipAngle, stepGround} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {BOARD_TEST_PROFILE as P, rideStart, runScript, syntheticQuery} from '../src/harbour/horizon/movers/shared/ground/synthetic.ts';
import {boardFrame, gripStep, travelHeading, yawTorques} from '../src/harbour/horizon/movers/shared/ground/tyre.ts';
import {NEUTRAL_INPUT, type GroundInput, type GroundState, type XYZ} from '../src/harbour/horizon/movers/shared/ground/types.ts';

const DEG = Math.PI / 180, DT = 1 / 120;
const ONE_SIDED = {...P, grip: {...P.grip, pendulumSwing: Infinity}};
beforeAll(() => { groundGuard.strict = true; });

function forceSlip(st: GroundState, beta: number, s: number): void {
  const f = boardFrame(st.heading, st.lead, st.contact.n);
  st.v = [0, 1, 2].map((k) => s * (Math.cos(beta) * f.a[k]! + Math.sin(beta) * f.l[k]!)) as XYZ;
}
const input = (o: Partial<GroundInput>): GroundInput => ({...NEUTRAL_INPUT, ...o});

describe('ground kernel · S — enter, hold, release (RIDE §3.3)', () => {
  it('S at 2.4 m/s is the foot brake: no kick, speed falls at ~4 m/s² (+ roll)', () => {
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 2.4);
    const ev = runScript(st, q, P, () => ({slide: true}), 0.3);
    expect(ev.some((e) => e.kind === 'slideStart')).toBe(false);
    expect(Math.abs(st.yawRate)).toBeLessThan(1e-9);
    const decel = (2.4 - groundSpeed(st)) / 0.3;
    expect(decel).toBeGreaterThan(P.legs.footBrake);
    expect(decel).toBeLessThan(P.legs.footBrake + P.roll.fast + 0.1);
    runScript(st, q, P, () => ({slide: true}), 1);
    expect(groundSpeed(st)).toBeLessThan(0.01);                         // to a stop
  });

  it('S at 2.6 m/s kicks: one slideStart and a kickYaw impulse, then grip goes loose in ~0.15 s', () => {
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 2.6);
    const ev = stepGround(st, input({slide: true}), q, P);
    expect(ev.filter((e) => e.kind === 'slideStart')).toHaveLength(1);
    expect(Math.abs(st.yawRate)).toBeGreaterThan(P.grip.kickYaw * 0.9);
    const later = runScript(st, q, P, () => ({slide: true}), 0.15);
    expect(later.some((e) => e.kind === 'slideStart')).toBe(false);     // one kick per press
    expect(st.grip).toBe(0);
  });

  it('kick sense: by the stick, else by the current yawRate, else heelside — nose in, tail out', () => {
    const kick = (steer: number, yawRate: number): number => {
      const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 6);
      st.yawRate = yawRate;
      stepGround(st, input({slide: true, steer}), q, P);
      return st.yawRate - yawRate;
    };
    expect(kick(1, 0)).toBeLessThan(-1.5);      // D: turning right → yaw negative, the nose goes further right
    expect(kick(-1, 0)).toBeGreaterThan(1.5);   // A
    expect(kick(0, 0.5)).toBeGreaterThan(1.5);  // centred, already turning left
    expect(kick(0, -0.5)).toBeLessThan(-1.5);   // centred, already turning right
    expect(kick(0, 0)).toBeGreaterThan(1.5);    // straight: heelside (+1)
    // Nose in: after a D kick the board has turned right past its travel line (β > 0).
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 8);
    runScript(st, q, P, () => ({slide: true, steer: 1}), 0.2);
    expect(slipAngle(st)).toBeGreaterThan(20 * DEG);
  });

  it('one-sided hold (pendulumSwing Infinity), S held, stick centred, on a 15 % slope from 10 m/s: settles at 40° ± 3° within 0.6 s, holds, sheds ≥ 1.8 m/s² net', () => {
    // Fix round: with the board's pendulum (12°) a centred hold swings side to side (next test); this is the one-sided hold it replaces, still the bicycle's.
    const q = syntheticQuery({gradePct: 15}), st = rideStart(q, 0, 0, 0, 10);
    const beta: number[] = [], speed: number[] = [];
    runScript(st, q, ONE_SIDED, () => ({slide: true}), 2.4, (s) => { beta.push(Math.abs(slipAngle(s))); speed.push(groundSpeed(s)); });
    for (let i = Math.round(0.6 * 120); i < beta.length; i++) expect(Math.abs(beta[i]! - 40 * DEG)).toBeLessThan(3 * DEG);
    const net = (speed[60]! - speed[240]!) / 1.5;                          // 0.5 s → 2.0 s
    expect(net).toBeGreaterThanOrEqual(1.8);
    // Until released: then it lets go of 40°.
    runScript(st, q, ONE_SIDED, () => ({}), 1);
    expect(Math.abs(slipAngle(st))).toBeLessThan(5 * DEG);
  });

  it('the pendulum: S held with the stick centred on a 15 % slope from 10 m/s swings side to side and keeps the line', () => {
    const q = syntheticQuery({gradePct: 15}), st = rideStart(q, 0, 0, 0, 10);
    let worstHeading = 0, worstX = 0, changes = 0, lastSign = 0, maxGrip = 0;
    const ev = runScript(st, q, P, () => ({slide: true}), 3, (s, _e, t) => {
      worstHeading = Math.max(worstHeading, Math.abs(travelHeading(s.v)));   // the start heading is 0
      worstX = Math.max(worstX, Math.abs(s.p[0]));
      const b = slipAngle(s);
      if (Math.abs(b) > 5 * DEG) { const sg = Math.sign(b); if (lastSign && sg !== lastSign) changes++; lastSign = sg; }
      if (t > 0.3) maxGrip = Math.max(maxGrip, s.grip);
    });
    expect(worstHeading).toBeLessThan(16 * DEG);                            // measured 12.7°
    expect(worstX).toBeLessThan(1);                                         // measured 0.53 m: stays on a 4 m bed
    expect(changes).toBeGreaterThanOrEqual(2);                              // measured 3 (the first swing is half a swing)
    expect(maxGrip).toBeLessThan(0.05);                                     // S keeps the wheels loose through every swing (no re-kick, no re-grip)
    expect(ev.filter((e) => e.kind === 'slideStart')).toHaveLength(1);
    expect(ev.some((e) => e.kind === 'slideEnd' || e.kind === 'twist' || e.kind === 'bail')).toBe(false);
    // Net shed (gravity included) at the pendulum's 70° (pendulumAngle): measured 1.84 m/s².
    expect((10 - groundSpeed(st)) / 3).toBeGreaterThanOrEqual(1.7);
  });

  it('the pendulum is off while the stick is held (a carving slide steers the line) and with pendulumSwing Infinity', () => {
    for (const [profile, steer, seconds] of [[P, -1, 1.7], [P, -0.5, 3], [P, 0.5, 3], [ONE_SIDED, 0, 3]] as const) {
      const q = syntheticQuery({gradePct: 15}), st = rideStart(q, 0, 0, 0, 10);
      const sides = new Set<number>(), dir = steer ? -Math.sign(steer) : 1;   // A (−) turns the line left (heading grows)
      let prev = 0, monotonic = true, changes = 0, lastSign = 0;
      runScript(st, q, profile, () => ({slide: true, steer}), seconds, (s) => {
        sides.add(s.latch.side);
        const h = travelHeading(s.v);
        if ((h - prev) * dir < -1e-12) monotonic = false;
        prev = h;
        const b = slipAngle(s);
        if (Math.abs(b) > 5 * DEG) { const sg = Math.sign(b); if (lastSign && sg !== lastSign) changes++; lastSign = sg; }
      });
      expect(sides.size).toBe(1);
      expect(changes).toBe(0);
      expect(monotonic).toBe(true);
      expect(Math.abs(travelHeading(st.v))).toBeGreaterThan(25 * DEG);      // one-sided: the line keeps turning toward the nose
    }
  });

  it('countersteer assist (×catch) only when a stick torque points home while sliding', () => {
    const at = (beta: number, grip: number, steer: number, slide: boolean) => {
      const st = createGroundState([0, 0, 0], 0);
      st.grip = grip; st.latch.kicked = slide; forceSlip(st, beta, 8);
      return yawTorques(st, input({steer, slide}), P, {s: 8, beta, G: 4.5, removal: 4.5 * Math.sin(Math.abs(beta)), dt: DT});
    };
    // β > 0: home is yaw > 0 (steer A, −1). Loose wheels, released:
    expect(at(30 * DEG, 0.1, -1, false).catchApplied).toBe(true);
    expect(at(30 * DEG, 0.1, 1, false).catchApplied).toBe(false);          // into the rotation
    expect(at(30 * DEG, 0.1, 0, false).catchApplied).toBe(false);          // centred: never
    expect(at(30 * DEG, 1, -1, false).catchApplied).toBe(false);           // gripped: a carve, not a catch
    expect(at(-30 * DEG, 0.1, 1, false).catchApplied).toBe(true);          // mirrored
    expect(at(30 * DEG, 0, -1, true).catchApplied).toBe(true);             // under the hold, shallowing
    expect(at(30 * DEG, 0, 1, true).catchApplied).toBe(false);
    const withCatch = at(30 * DEG, 0.1, -1, false), home = withCatch.rider;
    expect(home).toBeGreaterThan(0);                                        // it points home
  });

  it('bite ∝ cos²β: grip returns at bite·cos²β per second', () => {
    for (const b of [0, 30, 45, 60, 80]) {
      const st = createGroundState([0, 0, 0], 0);
      st.grip = 0.2;
      gripStep(st, NEUTRAL_INPUT, P, 8, b * DEG, DT, []);
      expect((st.grip - 0.2) / DT).toBeCloseTo(P.grip.bite * Math.cos(b * DEG) ** 2, 9);
    }
  });

  it('no snap on release: grip never moves more than 0.15 in a step; yawRate never exceeds yawMax', () => {
    const scripts: Array<(t: number) => Partial<GroundInput>> = [
      (t) => (t < 1 ? {slide: true} : {}),
      (t) => (t < 0.6 ? {slide: true, steer: 1} : t < 1.2 ? {steer: -1} : {}),
      (t) => (t < 3 ? {slide: true, steer: -1} : {}),                   // through the twist
      (t) => ({steer: Math.sin(t * 7) > 0 ? 1 : -1, slide: Math.sin(t * 3) > 0.3}),
    ];
    for (const script of scripts) {
      const q = syntheticQuery({gradePct: 12}), st = rideStart(q, 0, 0, 0, 11);
      let g = st.grip, maxJump = 0, maxYaw = 0;
      runScript(st, q, P, script, 4, (s) => { maxJump = Math.max(maxJump, Math.abs(s.grip - g)); g = s.grip; maxYaw = Math.max(maxYaw, Math.abs(s.yawRate)); });
      expect(maxJump).toBeLessThanOrEqual(0.15);
      expect(maxYaw).toBeLessThanOrEqual(P.steer.yawMax + 1e-12);
    }
  });

  it('S + stick into deepens the hold (≈ holdAngle + holdDeepen); countersteer brings β under 10° and grip crosses 0.7 once', () => {
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 13);
    const beta: number[] = [];
    const ev = runScript(st, q, P, (t) => (t < 0.5 ? {slide: true, steer: 1} : t < 1 ? {steer: -1} : {}), 1.6, (s) => beta.push(Math.abs(slipAngle(s))));
    expect(beta[59]! / DEG).toBeGreaterThan(55); expect(beta[59]! / DEG).toBeLessThan(65);
    const back = beta.findIndex((b, i) => i > 60 && b < 10 * DEG);
    expect((back - 60) / 120).toBeGreaterThan(0.3); expect((back - 60) / 120).toBeLessThan(1.0);
    expect(ev.filter((e) => e.kind === 'slideEnd')).toHaveLength(1);
    expect(ev.some((e) => e.kind === 'twist' || e.kind === 'bail')).toBe(false);
  });

  it('holding S with the stick into past twistAfter commits the twist: the lead flips once, and the slide carries on fakie', () => {
    const q = syntheticQuery({gradePct: 15}), st = rideStart(q, 0, 0, 0, 12);
    const ev = runScript(st, q, P, (t) => (t < 3 ? {slide: true, steer: 1} : {}), 4);
    expect(ev.filter((e) => e.kind === 'twist')).toHaveLength(1);
    expect(st.lead).toBe(-1);
    expect(st.grip).toBeGreaterThan(0.95);
    expect(Math.abs(slipAngle(st))).toBeLessThan(5 * DEG);
  });
});
