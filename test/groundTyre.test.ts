import {beforeAll, describe, expect, it} from 'vitest';
import {groundGuard, groundSpeed, slipAngle, stepGround} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {BOARD_TEST_PROFILE as P, rideStart, runScript, syntheticQuery} from '../src/harbour/horizon/movers/shared/ground/synthetic.ts';
import {boardFrame, lateralGrip, tyreStep} from '../src/harbour/horizon/movers/shared/ground/tyre.ts';
import {NEUTRAL_INPUT, type GroundState, type XYZ} from '../src/harbour/horizon/movers/shared/ground/types.ts';

const DEG = Math.PI / 180, DT = 1 / 120;
beforeAll(() => { groundGuard.strict = true; });

/** Put the board at slip β (rad) to its travel at speed s, on the state's current normal. */
function forceSlip(st: GroundState, beta: number, s: number): void {
  const f = boardFrame(st.heading, st.lead, st.contact.n);
  st.v = [0, 1, 2].map((k) => s * (Math.cos(beta) * f.a[k]! + Math.sin(beta) * f.l[k]!)) as XYZ;
}
/** Travel direction change per step × speed = the lateral acceleration the wheels delivered. */
function lateralAccel(before: XYZ, after: XYZ): number {
  const a0 = Math.atan2(before[0], before[2]), a1 = Math.atan2(after[0], after[2]);
  let d = a1 - a0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) / DT * Math.hypot(after[0], after[2]);
}

describe('ground kernel · the tyre (RIDE §3.2)', () => {
  it('a carve under the grip limit conserves speed within roll + drag and tracks the heading', () => {
    const q = syntheticQuery();
    const st = rideStart(q, 0, 0, 0, 6);
    let maxBeta = 0, expectedLoss = 0;
    runScript(st, q, P, () => ({steer: 0.6}), 3, (s) => {
      maxBeta = Math.max(maxBeta, Math.abs(slipAngle(s)));
      expectedLoss += (P.roll.fast + P.drag * groundSpeed(s) ** 2) * DT;
    });
    expect(maxBeta).toBeLessThan(3 * DEG);
    expect(6 - groundSpeed(st)).toBeLessThanOrEqual(expectedLoss * 1.03 + 1e-3);
    expect(Math.abs(st.heading)).toBeGreaterThan(90 * DEG);                  // it really turned
  });

  it('demand over grip leaves a remainder: full steer at 8 m/s skitters on cobble (0.7), not on paving', () => {
    const peak = (grip: number): number => {
      const q = syntheticQuery({grip, pace: 'slow'}), st = rideStart(q, 0, 0, 0, 8);
      let m = 0;
      runScript(st, q, P, () => ({steer: 1}), 0.8, (s) => { m = Math.max(m, Math.abs(slipAngle(s))); });
      return m;
    };
    expect(peak(1)).toBeLessThan(3 * DEG);
    expect(peak(0.7)).toBeGreaterThan(6 * DEG);
    expect(peak(0.6)).toBeGreaterThan(peak(0.7));                            // gravel skitters more
    expect(peak(0.7)).toBeLessThan(35 * DEG);                                 // a small slide, not a spin
  });

  it('scrub = G·sin β ± 3 % over one step of a forced slide', () => {
    for (const b of [15, 25, 45, 90]) {
      const n: XYZ = [0, 1, 0], f = boardFrame(0, 1, n), s = 8;
      const v: XYZ = [0, 1, 2].map((k) => s * (Math.cos(b * DEG) * f.a[k]! + Math.sin(b * DEG) * f.l[k]!)) as XYZ;
      const G = lateralGrip(1, 0, P);
      tyreStep(v, f, G, DT);
      const scrub = (s - Math.hypot(...v)) / DT;
      expect(scrub / (G * Math.sin(b * DEG))).toBeGreaterThan(0.97);
      expect(scrub / (G * Math.sin(b * DEG))).toBeLessThan(1.03);
    }
    // The same through a whole kernel step, roll and drag taken out.
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 8);
    st.grip = 0; forceSlip(st, 45 * DEG, 8);
    stepGround(st, {...NEUTRAL_INPUT, slide: true}, q, P);
    const other = P.roll.fast + P.drag * 64;
    const scrub = (8 - groundSpeed(st)) / DT - other;
    expect(scrub / (P.grip.slide * Math.sin(45 * DEG))).toBeGreaterThan(0.97);
    expect(scrub / (P.grip.slide * Math.sin(45 * DEG))).toBeLessThan(1.03);
  });

  it('A / D alone never exceed 0.9·rollGrip of lateral acceleration on grip 1.0', () => {
    for (const speed of [3, 6, 8, 10, 12, 14]) {
      const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, speed);
      let m = 0, prev: XYZ = [...st.v];
      runScript(st, q, P, (t) => ({steer: t < 1.5 ? 1 : -1}), 3, (s) => { m = Math.max(m, lateralAccel(prev, s.v)); prev = [...s.v]; });
      expect(m).toBeLessThanOrEqual(0.9 * P.grip.roll * 1.01);
    }
  });

  it('the self-aligning torque returns β < 8° from 45° in 0.5–1.2 s with no input', () => {
    // A released slide at 10 m/s on the flat (grip 0, the board 45° across).
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 10);
    st.grip = 0; forceSlip(st, 45 * DEG, 10);
    let tAt = -1;
    runScript(st, q, P, () => ({}), 2, (s, _e, t) => { if (tAt < 0 && Math.abs(slipAngle(s)) < 8 * DEG) tAt = t; });
    expect(tAt).toBeGreaterThanOrEqual(0.5);
    expect(tAt).toBeLessThanOrEqual(1.2);
  });

  it('90° is unstable: 88° comes back to straight, 92° comes round to fakie-straight and the lead flips exactly once', () => {
    const settle = (deg: number) => {
      const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 8);
      st.grip = 0; forceSlip(st, deg * DEG, 8);
      const ev = runScript(st, q, P, () => ({}), 3);
      return {st, twists: ev.filter((e) => e.kind === 'twist').length};
    };
    const a = settle(88), b = settle(92);
    expect(a.twists).toBe(0); expect(a.st.lead).toBe(1);
    expect(Math.abs(slipAngle(a.st))).toBeLessThan(3 * DEG);
    expect(b.twists).toBe(1); expect(b.st.lead).toBe(-1);
    expect(Math.abs(slipAngle(b.st))).toBeLessThan(3 * DEG);             // re-centred: riding fakie, gripped
    expect(b.st.grip).toBeGreaterThan(0.95);
  });
});
