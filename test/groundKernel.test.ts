import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {advanceGround, groundGuard, groundSpeed, isGroundStateFinite, slipAngle, stepGround} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {recordRide, replayRide, type RideLogRow} from '../src/harbour/horizon/movers/shared/ground/log.ts';
import {BOARD_TEST_PROFILE as P, rideStart, runScript, syntheticQuery, type SyntheticOptions} from '../src/harbour/horizon/movers/shared/ground/synthetic.ts';
import {GROUND_DT, GROUND_MAX_SPEED, NEUTRAL_INPUT, type GroundEvent, type GroundInput, type GroundState} from '../src/harbour/horizon/movers/shared/ground/types.ts';

const DEG = Math.PI / 180;
beforeEach(() => { groundGuard.strict = true; });
afterEach(() => { groundGuard.strict = true; });

/** An 8 s ride touching every system; inputs change only on 0.5 s boundaries (exact at 30/60/120/144 fps). */
function script(t: number): GroundInput {
  const i = (o: Partial<GroundInput>): GroundInput => ({...NEUTRAL_INPUT, ...o});
  if (t < 1) return i({push: true});
  if (t < 2) return i({push: true, steer: 0.6, sprint: true});
  if (t < 3.5) return i({slide: true, steer: -1});
  if (t < 4) return i({steer: 1});
  if (t < 5) return i({push: true, crouch: 0.3});
  if (t < 5.5) return i({pop: true, crouch: 0.6});
  if (t < 7) return i({slide: true});
  return i({steer: -0.4, push: true});
}
const RIDE: SyntheticOptions = {gradePct: 8, bankDeg: 4, bedWidth: 30};
function rideAt(fps: number): GroundState {
  const q = syntheticQuery(RIDE), st = rideStart(q, 0, 0, 0, 5), acc = {t: 0}, dt = 1 / fps;
  for (let k = 0; k < 8 * fps; k++) advanceGround(st, script(k / fps), q, P, dt, acc);
  return st;
}
const worst = (a: GroundState, b: GroundState): number => Math.max(
  ...a.p.map((x, k) => Math.abs(x - b.p[k]!)), ...a.v.map((x, k) => Math.abs(x - b.v[k]!)),
  Math.abs(a.heading - b.heading), Math.abs(a.grip - b.grip));

describe('ground kernel · determinism (RIDE §2.2, §9)', () => {
  it('frame-rate identity: the same 8 s ride at 30, 60, 120 and 144 fps ends within 1e-6', () => {
    const ref = rideAt(120);
    expect(ref.step).toBe(960);
    for (const fps of [30, 60, 144]) {
      const r = rideAt(fps);
      expect(r.step).toBe(960);
      expect(worst(r, ref)).toBeLessThan(1e-6);
    }
    expect(Math.hypot(ref.p[0], ref.p[2])).toBeGreaterThan(20);               // it really rode
  });

  it('two runs are identical', () => {
    expect(rideAt(60)).toEqual(rideAt(60));
  });

  it('a frame of 30 s advances only 0.1 s (12 steps); negative and NaN dt advance nothing', () => {
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 3), acc = {t: 0};
    advanceGround(st, NEUTRAL_INPUT, q, P, 30, acc);
    expect(st.step).toBe(12);
    advanceGround(st, NEUTRAL_INPUT, q, P, -1, acc);
    advanceGround(st, NEUTRAL_INPUT, q, P, Number.NaN, acc);
    expect(st.step).toBe(12);
    expect(GROUND_DT).toBe(1 / 120);
  });

  it('NaN guard: strict (tests) throws; production restores the step\'s starting state, stopped', () => {
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 5);
    runScript(st, q, P, () => ({}), 0.1);
    const broken = {...q, sample: (x: number, z: number, y: number) => ({...q.sample(x, z, y)!, y: Number.NaN})};
    expect(() => stepGround(st, NEUTRAL_INPUT, broken, P)).toThrow(/non-finite/);
    groundGuard.strict = false;
    const s2 = rideStart(q, 0, 0, 0, 5);
    runScript(s2, q, P, () => ({}), 0.1);
    const before = [...s2.p];
    stepGround(s2, NEUTRAL_INPUT, broken, P);
    expect(isGroundStateFinite(s2)).toBe(true);
    expect(s2.p).toEqual(before);
    expect(s2.v).toEqual([0, 0, 0]);
  });

  it('the ride log replays to identity, and a tampered row is caught', () => {
    const q = syntheticQuery(RIDE), st = rideStart(q, 0, 0, 0, 5);
    const rows: RideLogRow[] = [recordRide(st, NEUTRAL_INPUT, [])];
    for (let i = 0; i < 8 * 120; i++) {
      const input = script(i / 120), ev = stepGround(st, input, q, P);
      rows.push(recordRide(st, input, ev));
    }
    expect(rows.some((r) => r.event?.includes('slideStart'))).toBe(true);
    const end = replayRide(rows, q, P);
    expect(worst(end, st)).toBeLessThan(1e-6);
    expect(worst(replayRide(JSON.parse(JSON.stringify(rows)) as RideLogRow[], q, P), st)).toBeLessThan(1e-6);   // plain JSON, as evidence/rides/*.json
    const bad = rows.map((r) => ({...r}));
    bad[300] = {...bad[300]!, heading: bad[300]!.heading + 1e-3};
    expect(() => replayRide(bad, q, P)).toThrow(/step 300/);
  });

  it('|v| never exceeds the 15 m/s safety clamp, even on a 60 % wall of a slope', () => {
    const q = syntheticQuery({gradePct: 60}), st = rideStart(q, 0, 0, 0, 10);
    let m = 0;
    runScript(st, q, P, () => ({}), 5, (s) => { m = Math.max(m, Math.hypot(...s.v)); });
    expect(m).toBeLessThanOrEqual(GROUND_MAX_SPEED + 1e-9);
  });
});

describe('ground kernel · forces and contact (RIDE §2.3–2.4, §6)', () => {
  const ride = (opts: SyntheticOptions, v0: number, s: (t: number, st: GroundState) => Partial<GroundInput>, seconds: number, heading = 0, x = 0) => {
    const q = syntheticQuery(opts), st = rideStart(q, x, 0, heading, v0);
    const ev = runScript(st, q, P, s, seconds);
    return {st, ev, kinds: ev.map((e) => e.kind)};
  };

  it('drag, not a clamp, sets top speed: ~13.4 m/s on 15 % paving (fast), slower on slow pace', () => {
    const fast = ride({gradePct: 15}, 12, () => ({}), 30).st;
    expect(groundSpeed(fast)).toBeGreaterThan(12.9); expect(groundSpeed(fast)).toBeLessThan(13.9);
    const slow = ride({gradePct: 15, pace: 'slow'}, 11, () => ({}), 30).st;
    expect(groundSpeed(slow)).toBeGreaterThan(10.8); expect(groundSpeed(slow)).toBeLessThan(11.8);
  });

  it('a threshold pad stops a board arriving at 4.5 m/s within 6 m', () => {
    const {st} = ride({paceFrom: {z: 0, pace: 'threshold', material: 'stone'}}, 4.5, () => ({}), 4);
    expect(groundSpeed(st)).toBeLessThan(0.01);
    expect(st.p[2]).toBeLessThan(6);
    expect(st.contact.pace).toBe('threshold');
  });

  it('a kerb taller than stepMax is a wall for the wheels (lip), a bail above wallBail; a lower bump is ridden', () => {
    const slow = ride({kerb: {z0: 3, height: 0.15}}, 3, () => ({}), 2);
    expect(slow.kinds).toContain('lip'); expect(slow.kinds).not.toContain('bail');
    expect(slow.st.p[2]).toBeLessThan(3); expect(groundSpeed(slow.st)).toBeLessThan(0.2);
    const fast = ride({kerb: {z0: 3, height: 0.15}}, 5, () => ({}), 1.5);
    expect(fast.kinds).toContain('bail');
    const bump = ride({kerb: {z0: 3, height: 0.1}}, 3, () => ({}), 2);
    expect(bump.kinds).not.toContain('lip'); expect(bump.st.p[2]).toBeGreaterThan(5);
  });

  it('solids remove the into-component; faster than wallBail is a bail', () => {
    const soft = ride({wallZ: 4}, 3, () => ({}), 2);
    expect(soft.kinds).toContain('lip'); expect(soft.kinds).not.toContain('bail'); expect(soft.st.p[2]).toBeLessThan(4);
    const hard = ride({wallZ: 4}, 5, () => ({}), 2);
    expect(hard.kinds).toContain('bail');
  });

  it('a drop-off launches with the velocity intact and lands by the one rule; a hard impact bails unless crouched', () => {
    const drop = ride({kerb: {z0: 2, height: -0.5}}, 5, () => ({}), 0.8);
    expect(drop.kinds.slice(0, 2)).toEqual(['airborne', 'land']);
    const land = drop.ev.find((e) => e.kind === 'land')!;
    expect(Number(land.data!.impact)).toBeCloseTo(Math.sqrt(2 * 12 * 0.5), 0);
    expect(groundSpeed(drop.st)).toBeGreaterThan(4.5);
    const big = ride({kerb: {z0: 2, height: -3}}, 5, () => ({}), 2);
    expect(big.kinds).toContain('bail');
    const crouched = ride({kerb: {z0: 2, height: -3}}, 5, () => ({crouch: 1}), 2);
    expect(crouched.kinds).toContain('land'); expect(crouched.kinds).not.toContain('bail');
  });

  it('a sideways landing is a slide, not a bail: grip = cos²β at touchdown; past 90° it lands fakie', () => {
    for (const [deg, lead] of [[45, 1], [120, -1]] as const) {
      const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 0);
      st.contact.kind = 'air'; st.contact.on = false; st.p[1] = 0.3;
      st.v = [6 * Math.sin(deg * DEG), 0, 6 * Math.cos(deg * DEG)];
      const ev: GroundEvent[] = [];
      while (st.contact.kind === 'air') stepGround(st, NEUTRAL_INPUT, q, P, ev);
      expect(ev.map((e) => e.kind)).toContain('land'); expect(ev.map((e) => e.kind)).not.toContain('bail');
      expect(st.lead).toBe(lead);
      expect(st.grip).toBeCloseTo(Math.cos(deg * DEG) ** 2, 1);
    }
  });

  it('a landing never re-grips a slide: grip = min(grip, cos²β) (a deck micro-hop mid-slide)', () => {
    for (const slide of [true, false]) {
      const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 0);
      st.contact.kind = 'air'; st.contact.on = false; st.p[1] = 0.004; st.grip = 0.1;
      st.latch.sliding = true; st.latch.kicked = slide;
      st.v = [8 * Math.sin(20 * DEG), 0, 8 * Math.cos(20 * DEG)];            // travel 20° left of the nose: β = 20°
      const ev: GroundEvent[] = [];
      let steps = 0;
      while (st.contact.kind === 'air' && steps < 10) { stepGround(st, {...NEUTRAL_INPUT, slide}, q, P, ev); steps++; }
      expect(steps).toBe(3);
      expect(ev.map((e) => e.kind)).toEqual(['land']);                     // no slideEnd, no boostReady
      expect(slipAngle(st)).toBeCloseTo(20 * DEG, 2);
      expect(st.grip).toBeLessThanOrEqual(0.1);                            // was cos²20° = 0.88
    }
  });

  it('pop: √(2gh) with h = 0.16 + 0.4·crouch; coyote 0.09 s after rolling off; a pop pressed just before landing fires on touchdown', () => {
    const q = syntheticQuery(), st = rideStart(q, 0, 0, 0, 4);
    let apex = 0;
    const ev = runScript(st, q, P, (t) => ({pop: t < 0.05}), 1, (s) => { apex = Math.max(apex, s.p[1]); });
    expect(ev.map((e) => e.kind)).toEqual(['airborne', 'land']);
    expect(apex).toBeGreaterThan(0.15); expect(apex).toBeLessThan(0.17);
    // Coyote: roll off a 1 m drop, press 0.05 s later: the pop still fires.
    const qc = syntheticQuery({kerb: {z0: 1, height: -1}});
    let offAt = -1;
    const coy = rideStart(qc, 0, 0, 0, 5), vy: number[] = [];
    runScript(coy, qc, P, (t, s) => { if (offAt < 0 && s.contact.kind === 'air') offAt = t; return {pop: offAt >= 0 && t >= offAt + 0.05 && t < offAt + 0.1}; }, 0.3, (s) => vy.push(s.v[1]));
    expect(Math.max(...vy.slice(Math.round((offAt + 0.05) * 120)))).toBeGreaterThan(0.5);
    // Buffer: pressed 0.06 s before touchdown.
    const b = rideStart(q, 0, 0, 0, 4), kinds: string[] = [];
    b.contact.kind = 'air'; b.contact.on = false; b.p[1] = 0.5;             // falls for ~0.29 s
    runScript(b, q, P, (t) => ({pop: t > 0.23 && t < 0.25}), 0.5, (_s, e) => kinds.push(...e.map((x) => x.kind)));
    expect(kinds.slice(0, 2)).toEqual(['land', 'airborne']);
  });

  it('water is not a bail: the fade back puts the board on the bed, stopped and gripped', () => {
    const {st, kinds} = ride({waterBeyond: 5}, 4, () => ({}), 2);
    expect(kinds).toEqual(['water', 'fadeBack']);
    expect(st.p[2]).toBeLessThanOrEqual(4); expect(st.v).toEqual([0, 0, 0]); expect(st.grip).toBe(1);
  });

  it('off the bed the wheels dig in (roll 6, no push) and 0.6 s at a standstill fades back to the bed', () => {
    const q0 = syntheticQuery({bedWidth: 4}), st = rideStart(q0, 0, 0, 90 * DEG, 6);
    let at: number[] = [];
    const ev = runScript(st, q0, P, () => ({push: true}), 4, (s, e) => { if (e.some((x) => x.kind === 'fadeBack')) at = [...s.p, ...s.v, s.grip]; });
    const fade = ev.find((e) => e.kind === 'fadeBack');
    expect(fade?.data?.reason).toBe('offbed');
    expect(at[0]).toBeLessThanOrEqual(2); expect(at.slice(3, 6)).toEqual([0, 0, 0]); expect(at[6]).toBe(1);
    // The dig-in: from 6 m/s the board stops within ~3–4 m past the edge.
    const q = syntheticQuery({bedWidth: 4}), d = rideStart(q, 0, 0, 90 * DEG, 6);
    let far = 0;
    runScript(d, q, P, () => ({}), 1.5, (s) => { if (s.contact.pace === 'offbed') far = Math.max(far, s.p[0] - 2); });
    expect(far).toBeGreaterThan(2); expect(far).toBeLessThan(4.5);
  });

  it('gravity on a bank pulls to its inside; the tyre holds the line against it', () => {
    const {st} = ride({bankDeg: 10}, 6, () => ({}), 2);
    expect(Math.abs(slipAngle(st))).toBeLessThan(2 * DEG);
    expect(st.p[0]).toBeLessThanOrEqual(0);                                  // drawn to the inside (−x), never up the bank
    expect(st.p[0]).toBeGreaterThan(-3);
  });
});

describe('ground kernel · the wheel footprint (R2-05: S1 166 m, a 1–2 cm deck seam read as a 0.18 m lip)', () => {
  /** Rolls with no input from a start on the seamless deck; dip = the worst the ride line fell below that deck. */
  const roll = (opts: SyntheticOptions, x: number, z: number, heading: number, v0: number, seconds: number) => {
    const q = syntheticQuery(opts), deck = syntheticQuery({...opts, seams: undefined}), st = rideStart(deck, x, z, heading, v0);
    let dip = 0, offbed = false;
    const ev = runScript(st, q, P, () => ({}), seconds, (s) => {
      dip = Math.max(dip, deck.sample(s.p[0], s.p[2], s.p[1])!.y - s.p[1]);
      offbed ||= s.contact.pace === 'offbed';
    });
    return {st, kinds: ev.map((e) => e.kind), dip, offbed};
  };
  const phases = (from: number, step: number, n: number) => Array.from({length: n}, (_, k) => from + k * step);

  it('a 2 cm seam with terrain 0.25 m below is rolled over at 8.5 m/s: square, diagonal and along it, on the flat and on 8 %', () => {
    // 15 phases 5 mm apart cover a whole 7.1 mm·120 step, so the centre, each truck and each wheel all land in the seam.
    for (const gradePct of [0, 8]) {
      for (const [deg, z0] of [[0, 2], [30, 2]] as const) {
        for (const z of phases(z0, 0.005, 15)) {
          const r = roll({gradePct, seams: [{z, width: 0.02}]}, 0, 0, deg * DEG, 8.5, 0.6);
          const tag = `${gradePct} %, heading ${deg}°, seam at z ${z.toFixed(3)}`;
          expect(r.kinds, tag).toEqual([]);                                 // no lip, no bail, not even a hop
          expect(r.dip, tag).toBeLessThan(0.01);
          expect(r.offbed, tag).toBe(false);
          expect(r.st.p[2], tag).toBeGreaterThan(z + 2);
        }
      }
      // Along the seam: the centre line sits in it the whole way; the median and the wheels ride the deck.
      const along = roll({gradePct, seams: [{z: 0, width: 0.02}]}, 0, 0, 90 * DEG, 8.5, 0.6);
      expect(along.kinds).toEqual([]); expect(along.dip).toBeLessThan(0.01); expect(along.offbed).toBe(false);
      expect(along.st.p[0]).toBeGreaterThan(4.5);
    }
    // Slowly too (the centre then sits in the seam for a step or two).
    for (const z of phases(2, 0.004, 5)) {
      const slow = roll({seams: [{z, width: 0.02}]}, 0, 0, 0, 2, 1.5);
      expect(slow.kinds).toEqual([]); expect(slow.dip).toBeLessThan(0.01); expect(slow.st.p[2]).toBeGreaterThan(z + 0.5);
    }
  });

  it('a 0.2 m gap (wider than a wheel) at 8.5 m/s still reads as a drop: airborne, then it lands on the far deck', () => {
    for (const z of phases(2, 0.02, 4)) {
      const r = roll({seams: [{z, width: 0.2}]}, 0, 0, 0, 8.5, 0.6);
      expect(r.kinds, `gap at z ${z}`).toEqual(['airborne', 'land']);
      expect(r.st.contact.kind).toBe('ground');
      expect(r.st.p[2]).toBeGreaterThan(z + 2);
    }
  });

  it('a 0.15 m kerb still stops the board (lip; a bail above wallBail), and a steep bank is not a lip', () => {
    const slow = roll({kerb: {z0: 3, height: 0.15}}, 0, 0, 0, 3, 2);
    expect(slow.kinds).toContain('lip'); expect(slow.kinds).not.toContain('bail');
    expect(slow.st.p[2]).toBeLessThan(3); expect(groundSpeed(slow.st)).toBeLessThan(0.2);
    const fast = roll({kerb: {z0: 3, height: 0.15}}, 0, 0, 0, 8.5, 1);
    expect(fast.kinds).toContain('lip'); expect(fast.kinds).toContain('bail'); expect(fast.st.p[2]).toBeLessThan(3);
    // On a 40° bank the uphill wheel stands 0.13 m above the centre line: measured against the bank's plane, it is ground.
    const bank = roll({bankDeg: 40}, 0, 0, 0, 6, 0.3);
    expect(bank.kinds).not.toContain('lip');
  });
});
