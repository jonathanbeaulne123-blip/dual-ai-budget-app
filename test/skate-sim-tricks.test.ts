import { describe, expect, it } from 'vitest';
import type { Grindable, GrindDef, SkatePresent } from '../src/harbour/skate/contract.ts';
import { block, blockEdge, kicker, makeField, quarterPipe, stairs } from '../src/harbour/skate/sim/fields.ts';
import { selectGrind, wantedContact } from '../src/harbour/skate/sim/grind.ts';
import { SKATE_TUNING } from '../src/harbour/skate/sim/tuning.ts';
import { all, first, GRINDS, intent, kick, kinds, makeSim, ride } from '../src/harbour/skate/sim/testKit.ts';
import { createSkateSim } from '../src/harbour/skate/sim/index.ts';
import { SKATE_FLIPS, SKATE_GRABS, SKATE_GRINDS } from '../src/harbour/skate/tricks/catalog.ts';
import type { SkateIntent } from '../src/harbour/skate/contract.ts';

const flat = makeField({});
const G = SKATE_TUNING.GRAVITY;

/** Roll at `v`, crouch for `wind` s, then pop. Returns the whole ride. */
function popTrial(o: { v?: number; crouch?: number; strength?: number; flipId?: string | null; from?: 'tail' | 'nose'; wind?: number; after?: (t: number, p: SkatePresent) => SkateIntent; seconds?: number; stance?: 'regular' | 'goofy'; field?: ReturnType<typeof makeField> }) {
  const sim = makeSim(o.field ?? flat, { stance: o.stance ?? 'regular' });
  kick(sim, { vz: o.v ?? 4 });
  const wind = o.wind ?? 0.3;
  let popped = false;
  const r = ride(sim, o.seconds ?? 1.6, (t, p) => {
    if (t < wind - 1e-9) return intent({ crouch: o.crouch ?? 0.8 });
    if (!popped) { popped = true; return intent({ pop: { from: o.from ?? 'tail', flipId: o.flipId ?? null, strength: o.strength ?? 0.5 } }); }
    return o.after ? o.after(t, p) : intent();
  }, 60, true);
  return { sim, ...r };
}

/** A stick controller that spins the air toward `target` radians (CCW +) and then holds still. */
function spinTo(target: number) {
  let rot = 0, prev: number | null = null;
  return (_t: number, p: SkatePresent): SkateIntent => {
    if (prev !== null && p.phase === 'air') rot += Math.atan2(Math.sin(p.boardYaw - prev), Math.cos(p.boardYaw - prev));
    prev = p.boardYaw;
    if (p.phase !== 'air') return intent();
    const w = Math.max(-9.5, Math.min(9.5, (target - rot) * 7));
    return intent({ steer: Math.max(-1, Math.min(1, -w / 9.5)) });
  };
}

describe('skate sim · pop', () => {
  it('a held Space pop carries farther at the same riding speed and gives time for a backflip',()=>{
    const trial=(charge:number,flip:boolean)=>{
      const sim=makeSim(flat);kick(sim,{vz:6});
      ride(sim,.15,intent({crouch:1}));
      const pop=ride(sim,1/60,intent({pop:{from:'tail',flipId:null,strength:.35+.65*charge,charge}}));
      expect(first(pop.events,'pop')).toBeDefined();
      let requested=false;
      const flight=ride(sim,1.8,(t,p)=>{
        if(flip&&p.phase==='air'&&!requested&&t>.1){requested=true;return intent({airFlip:1});}
        return intent();
      },60,true);
      return flight;
    };
    const tap=trial(0,false),held=trial(1,true);
    expect(first(held.events,'land')!.gap).toBeGreaterThan(first(tap.events,'land')!.gap+2);
    expect(Math.max(...held.frames.map(f=>f.p.y))).toBeGreaterThan(Math.max(...tap.frames.map(f=>f.p.y))+.7);
    expect(held.frames.some(f=>(f.p.airFlip??0)>Math.PI)).toBe(true);
    expect(first(held.events,'bail')).toBeUndefined();
    expect(first(held.events,'land')).toBeDefined();
    expect(first(held.events,'air-flip')).toMatchObject({direction:1});
  });

  it('spends a Space charge released after an unpopped ledge launch',()=>{
    const sim=makeSim(flat,{y:1});
    ride(sim,.12,intent());
    expect(sim.present().phase).toBe('air');
    const jump=ride(sim,1/60,intent({pop:{from:'tail',flipId:null,strength:1,charge:1}}));
    expect(first(jump.events,'pop')).toBeDefined();
    expect(jump.present.vy).toBeGreaterThan(0);
  });

  it('can complete a backflip from a short jump when started early',()=>{
    const sim=makeSim(flat);kick(sim,{vz:5});
    ride(sim,1/60,intent({pop:{from:'tail',flipId:null,strength:.35,charge:0}}));
    const flight=ride(sim,.9,(t,p)=>intent({airFlip:t<1/60&&p.phase==='air'?1:0}),60,true);
    expect(first(flight.events,'air-flip')).toMatchObject({direction:1});
    expect(first(flight.events,'land')).toBeDefined();
    expect(first(flight.events,'bail')).toBeUndefined();
  });
  it('a standard ollie clears ~0.35–0.45, a max pop ~0.55, and keeps its momentum', () => {
    const std = popTrial({ crouch: 0.7, strength: 0.5 });
    const apex = Math.max(...std.frames.map((f) => f.p.y));
    expect(apex).toBeGreaterThan(0.35);
    expect(apex).toBeLessThan(0.45);
    const pop = first(std.events, 'pop')!;
    expect(pop.height).toBeCloseTo(apex, 1);
    expect(pop.from).toBe('tail');
    expect(pop.flipId).toBeNull();
    const air = std.frames.filter((f) => f.p.phase === 'air');
    expect(air[0]!.p.vz).toBeGreaterThan(3.9);
    expect(air[air.length - 1]!.p.vz).toBeGreaterThan(3.9);
    const max = popTrial({ crouch: 1, strength: 1 });
    const top = Math.max(...max.frames.map((f) => f.p.y));
    expect(top).toBeGreaterThan(0.5);
    expect(top).toBeLessThan(0.6);
    const tap = popTrial({ crouch: 0, strength: 0.2, wind: 0 });
    expect(Math.max(...tap.frames.map((f) => f.p.y))).toBeLessThan(apex);
    expect(first(std.events, 'land')!.fakie).toBe(false);
  });

  it('pop from the nose is a nollie', () => {
    const r = popTrial({ from: 'nose' });
    expect(first(r.events, 'pop')!.from).toBe('nose');
    expect(first(r.events, 'land')).toBeDefined();
  });

  it('pops off a bank along its normal (blended with up), adding its height to the rise', () => {
    const qp = quarterPipe({ id: 'bank', x: 0, z: 1, yaw: 0, radius: 3, topDeg: 40, width: 4, vert: false });
    const sim = makeSim(makeField({ pieces: [qp.piece] }));
    kick(sim, { vz: 6 });
    ride(sim, 0.45, intent());
    const before = { ...sim.present() };
    expect(before.phase).not.toBe('air');
    expect(before.y).toBeGreaterThan(0.1);
    const r = ride(sim, 1 / 60, intent({ pop: { from: 'tail', flipId: null, strength: 0.6 } }));
    expect(r.present.phase).toBe('air');
    // The bank's normal leans back toward −z: popping off it bleeds some forward speed into lift.
    expect(r.present.vz).toBeLessThan(before.vz);
    // Already rising: the pop adds its height (energy), not its velocity (feel pass).
    const added = (r.present.vy ** 2 - before.vy ** 2) / (2 * G);
    expect(added).toBeGreaterThan(0.2);
    expect(added).toBeLessThan(0.6);
    expect(r.present.vy).toBeLessThan(before.vy + 2);
  });
});

describe('skate sim · flips are caught, not assumed', () => {
  it('kickflip: u runs from pop, the board is caught before touchdown, clean landing', () => {
    const r = popTrial({ crouch: 0.8, strength: 0.6, flipId: 'kickflip' });
    expect(first(r.events, 'pop')!.flipId).toBe('kickflip');
    const us = r.frames.filter((f) => f.p.trick).map((f) => f.p.trick!.u);
    expect(us.length).toBeGreaterThan(10);
    for (let i = 1; i < us.length; i++) expect(us[i]!).toBeGreaterThanOrEqual(us[i - 1]!);
    const caught = first(r.events, 'flip-caught')!;
    expect(caught.flipId).toBe('kickflip');
    expect(caught.quality).toBeGreaterThan(0.5);
    const land = first(r.events, 'land')!;
    expect(caught.t).toBeLessThan(land.t);
    expect(land.boardClean).toBeGreaterThan(0.9);
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(r.present.trick).toBeNull();
  });

  it('kickflip popped too low is not caught: bail', () => {
    const r = popTrial({ crouch: 0, strength: 0, wind: 0, flipId: 'kickflip' });
    expect(first(r.events, 'flip-caught')).toBeUndefined();
    expect(first(r.events, 'bail')!.reason).toBe('flip-not-caught');
    expect(first(r.events, 'land')).toBeUndefined();
    expect(r.frames.some((f) => f.p.phase === 'bail')).toBe(true);
  });

  it('a hard trick needs more height than an easy one', () => {
    const easy = popTrial({ crouch: 0.6, strength: 0.4, flipId: 'kickflip' });
    const hard = popTrial({ crouch: 0.6, strength: 0.4, flipId: '360-flip' });
    expect(first(easy.events, 'bail')).toBeUndefined();
    expect(first(hard.events, 'bail')!.reason).toBe('flip-not-caught');
    const big = popTrial({ crouch: 1, strength: 1, flipId: '360-flip' });
    expect(first(big.events, 'flip-caught')).toBeDefined();
    expect(first(big.events, 'bail')).toBeUndefined();
  });

  it('a pop shove-it turns the board under the feet and still rolls away regular', () => {
    const r = popTrial({ crouch: 0.8, strength: 0.6, flipId: 'pop-shuvit' });
    expect(first(r.events, 'flip-caught')).toBeDefined();
    // What the look track draws (rest yaw + overlay from trick.u) never jumps at the catch.
    const drawn = r.frames.map((f) => f.p.boardYaw + (f.p.trick ? Math.PI * f.p.trick.u : 0));
    for (let i = 1; i < drawn.length; i++) {
      const d = Math.atan2(Math.sin(drawn[i]! - drawn[i - 1]!), Math.cos(drawn[i]! - drawn[i - 1]!));
      // A nose/tail relabel (exactly π) is allowed; anything else must be smooth.
      expect(Math.min(Math.abs(d), Math.abs(Math.abs(d) - Math.PI))).toBeLessThan(0.3);
    }
    const land = first(r.events, 'land')!;
    expect(land.fakie).toBe(false);
    expect(land.switch).toBe(false);
    expect(r.present.vz).toBeGreaterThan(2);
  });

  it('late flip starts mid-air when nothing is flipping', () => {
    const r = popTrial({ crouch: 1, strength: 1, after: (t) => intent({ lateFlip: Math.abs(t - 0.35) < 1e-9 ? 'kickflip' : null }) });
    const late = first(r.events, 'late-flip')!;
    expect(late.flipId).toBe('kickflip');
    expect(first(r.events, 'flip-caught')).toBeDefined();
    expect(first(r.events, 'bail')).toBeUndefined();
  });

  it('flick-it upgrades: a double read after the pop keeps flipping from where the kickflip got to', () => {
    const real = { flips: SKATE_FLIPS, grinds: SKATE_GRINDS, grabs: SKATE_GRABS };
    // Off a 2.4 drop so there is air for a double.
    const field = makeField({ pieces: [block({ id: 'ledge', x: 0, z: -4, yaw: 0, halfX: 2, halfZ: 4, h: 2.4 })] });
    const run = (lateAt: number, lateId: string) => {
      const sim = createSkateSim(field, real, { x: 0, z: -1, yaw: 0, stance: 'regular' });
      kick(sim, { vz: 5, y: 2.4 });
      let u = -1;
      const r = ride(sim, 1.6, (t, p) => {
        if (Math.abs(t - lateAt) < 1e-9) u = p.trick?.u ?? -1;
        return intent({ pop: t === 0 ? { from: 'tail', flipId: 'kickflip', strength: 0.8 } : null, lateFlip: Math.abs(t - lateAt) < 1e-9 ? lateId : null, crouch: t > 0.5 ? 1 : 0 });
      }, 60, true);
      return { r, u };
    };
    const up = run(0.25, 'double-kickflip');
    const after = up.r.frames.find((f) => f.t > 0.25 + 1e-9 && f.p.trick)!;
    expect(after.p.trick!.flipId).toBe('double-kickflip');
    // Same board turns: half of a double where the kickflip had got to (plus a frame of flipping).
    expect(after.p.trick!.u).toBeGreaterThan(up.u / 2);
    expect(after.p.trick!.u).toBeLessThan(up.u / 2 + 0.05);
    expect(kinds(up.r.events).filter((k) => k === 'flip-caught')).toEqual(['flip-caught']);
    expect(all(up.r.events, 'flip-caught')[0]!.flipId).toBe('double-kickflip');
    expect(first(up.r.events, 'bail')).toBeUndefined();
    // Not a continuation, after the catch: a late flip of its own.
    const late = run(0.45, 'heelflip');
    expect(all(late.r.events, 'flip-caught').map((e) => e.flipId)).toEqual(['kickflip', 'heelflip']);
    // …unless it lands within FLIP_CORRECT_TIME (a corner corrected a beat late): replaced.
    const fix = run(0.1, 'heelflip');
    expect(all(fix.r.events, 'flip-caught').map((e) => e.flipId)).toEqual(['heelflip']);
  });

  it('a grab eases in, emits start/end, and slows the spin', () => {
    const k = kicker({ id: 'kick', x: 0, z: 2, yaw: 0, length: 1.6, lipDeg: 35, width: 3 });
    const field = makeField({ pieces: [k.piece] });
    const spinWith = (grab: string | null) => {
      const sim = makeSim(field);
      kick(sim, { vz: 7 });
      let peak = 0;
      const r = ride(sim, 2, (_t, p) => { if (p.phase === 'air') peak = Math.max(peak, Math.abs((p as SkatePresent).bodyTwist)); return intent({ grab: p.phase === 'air' && p.clearance > 0.3 ? grab : null, steer: p.phase === 'air' ? 1 : 0 }); }, 60, true);
      return { r, peak };
    };
    const plain = spinWith(null), grabbed = spinWith('indy');
    const gs = first(grabbed.r.events, 'grab-start')!, ge = first(grabbed.r.events, 'grab-end')!;
    expect(gs.grabId).toBe('indy');
    expect(ge.seconds).toBeGreaterThan(0.2);
    expect(Math.max(...grabbed.r.frames.map((f) => f.p.grab?.weight ?? 0))).toBeGreaterThan(0.8);
    expect(kinds(grabbed.r.events).indexOf('grab-end')).toBeLessThan(kinds(grabbed.r.events).lastIndexOf('land') === -1 ? Infinity : kinds(grabbed.r.events).lastIndexOf('land') + 1);
    expect(grabbed.peak).toBeLessThan(plain.peak);
  });
});

describe('skate sim · spins and landing judgement', () => {
  it('a backside 180 ollie lands fakie and rolls away fakie; frontside is + and goofy mirrors', () => {
    const r = popTrial({ crouch: 0.9, strength: 0.8, after: spinTo(-Math.PI) });
    const land = first(r.events, 'land')!;
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(land.fakie).toBe(true);
    // Regular, rolling forward, clockwise from above = backside = negative.
    expect(land.spinDeg).toBeLessThan(-150);
    expect(land.spinDeg).toBeGreaterThan(-215);
    const z = r.present.z;
    const on = ride(r.sim, 0.5, intent());
    expect(on.present.fakie).toBe(true);
    expect(on.present.z).toBeGreaterThan(z + 1);
    const fs = popTrial({ crouch: 0.9, strength: 0.8, after: spinTo(Math.PI) });
    expect(first(fs.events, 'land')!.spinDeg).toBeGreaterThan(150);
    const goofy = popTrial({ crouch: 0.9, strength: 0.8, after: spinTo(-Math.PI), stance: 'goofy' });
    expect(first(goofy.events, 'land')!.spinDeg).toBeGreaterThan(150);
    // From fakie, a half-cab comes back to regular and the sign mirrors again.
    const back = popTrial({ crouch: 0.9, strength: 0.8, after: spinTo(-Math.PI) });
    const cab = ride(back.sim, 1.2, (() => { let popped = false; const spin = spinTo(-Math.PI); return (t: number, p: SkatePresent) => {
      if (t < 0.25) return intent({ crouch: 0.9 });
      if (!popped) { popped = true; return intent({ pop: { from: 'tail', flipId: null, strength: 0.8 } }); }
      return spin(t, p);
    }; })());
    const cabLand = first(cab.events, 'land')!;
    expect(first(cab.events, 'pop')!.fakie).toBe(true);
    expect(cabLand.fakie).toBe(false);
    expect(cabLand.spinDeg).toBeGreaterThan(150);
  });

  it('a 360 is out of reach on a flat ollie but lands off a big vert air', () => {
    const flatTry = popTrial({ crouch: 1, strength: 1, after: spinTo(-2 * Math.PI) });
    const l = first(flatTry.events, 'land');
    expect(l === undefined || Math.abs(l.spinDeg) < 300).toBe(true);
    const qp = quarterPipe({ id: 'vert', x: 0, z: 4, yaw: 0, radius: 2.2, topDeg: 84, width: 5 });
    const vert = makeField({ pieces: [qp.piece], grindables: [qp.coping] });
    for (const [target, deg, fakie] of [[-2 * Math.PI, 360, true], [-3 * Math.PI, 540, false]] as const) {
      const sim = makeSim(vert);
      kick(sim, { vz: 11.5 });
      const r = ride(sim, 3, spinTo(target));
      const land = first(r.events, 'land')!;
      expect(first(r.events, 'bail')).toBeUndefined();
      expect(Math.abs(land.spinDeg)).toBeGreaterThan(deg - 35);
      expect(Math.abs(land.spinDeg)).toBeLessThan(deg + 35);
      expect(land.fakie).toBe(fakie);
    }
  });

  it('board angle at touchdown: clean ≤25°, sketchy to 50° (speed and cleanliness cost), bail beyond', () => {
    const angleTrial = (deg: number) => {
      const sim = makeSim(flat);
      kick(sim, { vz: 5 });
      ride(sim, 1 / 60, intent({ pop: { from: 'tail', flipId: null, strength: 0.8 } }));
      kick(sim, { yaw: (deg * Math.PI) / 180 });
      return ride(sim, 1, intent());
    };
    const clean = angleTrial(10), sketchy = angleTrial(38), bad = angleTrial(70), fakie = angleTrial(170);
    const lc = first(clean.events, 'land')!, ls = first(sketchy.events, 'land')!;
    expect(lc.boardClean).toBeGreaterThan(0.8);
    expect(ls.boardClean).toBeLessThan(0.5);
    expect(sketchy.present.speed).toBeLessThan(clean.present.speed - 0.5);
    expect(first(bad.events, 'bail')!.reason).toBe('bad-angle');
    expect(first(fakie.events, 'land')!.fakie).toBe(true);
  });

  it('a big flat drop needs a crouch: bare legs bail, bent knees ride away slower', () => {
    const tower = makeField({ pieces: [block({ id: 'tower', x: 0, z: 0, yaw: 0, halfX: 2, halfZ: 2, h: 2.6 })] });
    const drop = (crouch: number) => {
      const sim = makeSim(tower, { z: 1.5 });
      kick(sim, { vz: 3 });
      return ride(sim, 2, intent({ crouch }));
    };
    const bare = drop(0), bent = drop(0.8);
    expect(first(bare.events, 'bail')!.reason).toBe('hard-impact');
    expect(first(bent.events, 'bail')).toBeUndefined();
    const land = first(bent.events, 'land')!;
    expect(land.airTime).toBeGreaterThan(Math.sqrt((2 * 2.6) / G) - 0.05);
    expect(bent.present.speed).toBeLessThan(3);
    expect(bent.present.speed).toBeGreaterThan(1);
  });

  it('landing into a downhill transition turns the drop into speed', () => {
    // A long bank rising toward −z; drop onto it from 1.0 above while moving down it (+z).
    const qp = quarterPipe({ id: 'bank', x: 0, z: 0, yaw: Math.PI, radius: 6, topDeg: 40, width: 6, deck: 2, vert: false });
    const onBank = () => { const sim = makeSim(makeField({ pieces: [qp.piece] }), { z: -3.5 }); kick(sim, { vz: 3, y: sim.present().y + 1 }); return sim; };
    const r = ride(onBank(), 0.8, intent(), 60, true);
    const land = first(r.events, 'land')!;
    expect(land).toBeDefined();
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(land.onFeature).toBe('bank');
    expect(land.boardClean).toBeGreaterThan(0.9);
    const after = r.frames.find((f) => f.t > land.t + 1e-9)!;
    expect(after.p.speed).toBeGreaterThan(4.3);
    // The same drop onto flat keeps only the horizontal speed (minus a little).
    const flatDrop = makeSim(flat);
    kick(flatDrop, { vz: 3, y: 1 });
    const rf = ride(flatDrop, 0.8, intent(), 60, true);
    const lf = first(rf.events, 'land')!;
    expect(rf.frames.find((f) => f.t > lf.t + 1e-9)!.p.speed).toBeLessThan(3.05);
  });
});

/* ───────────────────────────────────────────────────────── grinds */

const rail = (id: string, pts: [number, number, number][], kind: Grindable['kind'] = 'round-rail', faceYaw: number | null = null): Grindable => ({ id, name: id, kind, points: pts, faceYaw });

/**
 * Approach a grindable along +z from the −x side, pop, optionally turn the
 * board in the air (a test shortcut for "the rider turned it"), hold lean.
 */
function grindTrial(o: { grindables: Grindable[]; pieces?: ReturnType<typeof block>[]; x?: number; vx?: number; v?: number; boardYaw?: number; lean?: number; steer?: (t: number, p: SkatePresent) => number; seconds?: number; assist?: boolean }) {
  const sim = makeSim(makeField({ pieces: o.pieces ?? [], grindables: o.grindables }), { x: o.x ?? -0.35, z: 0 });
  kick(sim, { vz: o.v ?? 5, vx: o.vx ?? 0.9 });
  ride(sim, 0.1, intent({ crouch: 1 }));
  ride(sim, 1 / 60, intent({ pop: { from: 'tail', flipId: null, strength: 0.9 }, lean: o.lean ?? 0 }));
  if (o.boardYaw !== undefined) kick(sim, { yaw: o.boardYaw });
  const r = ride(sim, o.seconds ?? 2, (t, p) => intent({ lean: o.lean ?? 0, steer: o.steer ? o.steer(t, p) : 0, grindAssist: o.assist ?? false }), 60, true);
  return { sim, ...r };
}
/** Keep your balance: steer against the drift. */
const balancer = (_t: number, p: SkatePresent) => (p.phase === 'grind' ? Math.max(-1, Math.min(1, -p.balance * 3)) : 0);

describe('skate sim · grinds and slides', () => {
  const flatbar = rail('flatbar', [[0, 0.32, 1], [0, 0.32, 9]]);

  it('truck grinds by lean: 50-50 centred, 5-0 on the tail, nosegrind on the nose', () => {
    for (const [lean, id, pitchSign] of [[0, '50-50', 0], [-1, '5-0', -1], [1, 'nosegrind', 1]] as const) {
      const r = grindTrial({ grindables: [flatbar], lean, steer: balancer, seconds: 1 });
      const gs = first(r.events, 'grind-start')!;
      expect(gs, id).toBeDefined();
      expect(gs.grindId).toBe(id);
      expect(gs.grindableId).toBe('flatbar');
      expect(gs.kind2).toBe('round-rail');
      const g = r.frames.find((f) => f.p.phase === 'grind' && f.t > gs.t + 0.2)!;
      expect(g.p.grind!.grindId).toBe(id);
      expect(g.p.y).toBeCloseTo(0.32, 5);
      expect(Math.abs(g.p.x)).toBeLessThan(1e-6);
      if (pitchSign) expect(Math.sign(g.p.boardPitch)).toBe(pitchSign);
      // Approached from −x: the near side is the rider's right (+1) travelling +z.
      expect(g.p.grind!.faceSign).toBe(1);
    }
  });

  it('boardslide at ~90° with the nose over; lipslide with the tail over', () => {
    const board = grindTrial({ grindables: [flatbar], boardYaw: Math.PI / 2 - 0.2, steer: balancer, seconds: 1 });
    expect(first(board.events, 'grind-start')!.grindId).toBe('boardslide');
    const g = board.frames.find((f) => f.p.phase === 'grind' && f.t > 0.4)!;
    expect(Math.abs(Math.cos(g.p.boardYaw))).toBeLessThan(0.1); // settled square across the rail
    const lip = grindTrial({ grindables: [flatbar], boardYaw: -Math.PI / 2 + 0.2, steer: balancer, seconds: 1 });
    expect(first(lip.events, 'grind-start')!.grindId).toBe('lipslide');
    // Slides scrub more than grinds.
    const truck = grindTrial({ grindables: [flatbar], steer: balancer, seconds: 1 });
    const endSpeed = (r: typeof truck) => r.frames.filter((f) => f.p.phase === 'grind').at(-1)!.p.speed;
    expect(endSpeed(board)).toBeLessThan(endSpeed(truck) - 0.4);
  });

  it('turning the board 90° in the air by hand also becomes a slide', () => {
    let turned = 0, prev: number | null = null;
    const r = grindTrial({
      grindables: [flatbar], seconds: 1.2,
      steer: (_t, p) => {
        if (prev !== null && p.phase === 'air') turned += Math.atan2(Math.sin(p.boardYaw - prev), Math.cos(p.boardYaw - prev));
        prev = p.boardYaw;
        if (p.phase === 'grind') return balancer(0, p);
        return turned > -1.4 ? 1 : 0;
      },
    });
    const gs = first(r.events, 'grind-start')!;
    expect(['boardslide', 'lipslide']).toContain(gs.grindId);
  });

  it('ledges: smith with the nose dipped to the face, feeble with it over the top, tailslide/noseslide by lean at 90°', () => {
    const box = { id: 'ledge', x: 0.45, z: 5, yaw: 0, halfX: 0.35, halfZ: 4, h: 0.32 };
    const edge = blockEdge(box, -1);
    const piece = block(box);
    const trial = (boardYaw: number, lean: number) => first(grindTrial({ grindables: [edge], pieces: [piece], boardYaw, lean, steer: balancer, seconds: 0.8 }).events, 'grind-start')?.grindId;
    expect(edge.faceYaw).toBeCloseTo(-Math.PI / 2, 6);
    expect(trial(-0.45, -1)).toBe('smith');
    expect(trial(0.45, -1)).toBe('feeble');
    expect(trial(0.3, 1)).toBe('crooked');
    expect(trial(-0.3, 1)).toBe('overcrook');
    expect(trial(Math.PI / 2, -1)).toBe('tailslide');
    expect(trial(-Math.PI / 2, 1)).toBe('noseslide');
  });

  it('balance drifts: no correction bails, steering against it holds to the end of the rail', () => {
    const long = rail('long', [[0, 0.32, 1], [0, 0.32, 30]]);
    const lazy = grindTrial({ grindables: [long], v: 9, seconds: 4 });
    const b = first(lazy.events, 'bail')!;
    expect(b.reason).toBe('balance');
    const ge = first(lazy.events, 'grind-end')!;
    expect(ge.exit).toBe('bail');
    expect(ge.t).toBeLessThanOrEqual(b.t);
    const held = grindTrial({ grindables: [long], v: 9, seconds: 5, steer: balancer });
    expect(first(held.events, 'bail')).toBeUndefined();
    const end = first(held.events, 'grind-end')!;
    expect(end.exit).toBe('roll');
    expect(end.distance).toBeGreaterThan(25);
    // Harder defs drift faster.
    const easy = grindTrial({ grindables: [long], v: 9, seconds: 4 });
    const hard = grindTrial({ grindables: [long], v: 9, seconds: 4, boardYaw: -0.45, lean: -1 });
    expect(first(hard.events, 'grind-start')!.grindId).toBe('smith');
    expect(first(hard.events, 'bail')!.t).toBeLessThan(first(easy.events, 'bail')!.t);
  });

  it('follows a kinked, descending rail as one grind and speeds up on the down', () => {
    const kinked = rail('kinked', [[0, 0.32, 1], [0, 0.32, 4], [0, -0.68, 7], [0, -0.68, 10]], 'kinked-rail');
    const groundY = (_x: number, z: number) => (z < 4 ? 0 : z > 7 ? -1 : -(z - 4) / 3);
    const sim = makeSim(makeField({ grindables: [kinked], groundY }), { x: -0.35 });
    kick(sim, { vz: 4.5, vx: 0.9 });
    ride(sim, 0.1, intent({ crouch: 1 }));
    ride(sim, 1 / 60, intent({ pop: { from: 'tail', flipId: null, strength: 0.9 } }));
    const r = ride(sim, 3, (t, p) => intent({ steer: balancer(t, p) }), 60, true);
    expect(all(r.events, 'grind-start').length).toBe(1);
    const end = first(r.events, 'grind-end')!;
    expect(end.exit).toBe('roll');
    expect(end.distance).toBeGreaterThan(7.5);
    const onFlat = r.frames.find((f) => f.p.phase === 'grind' && f.p.z > 2.5 && f.p.z < 3.5)!;
    const onDown = r.frames.find((f) => f.p.phase === 'grind' && f.p.z > 6.5)!;
    expect(onDown.p.speed).toBeGreaterThan(onFlat.p.speed + 1);
    expect(onDown.p.boardPitch).toBeGreaterThan(0.1); // nose down on the down-rail
    expect(first(r.events, 'land')).toBeDefined();
    expect(first(r.events, 'bail')).toBeUndefined();
  });

  it('pops out of a grind (flip out too) and carries on to a transfer', () => {
    const a = rail('a', [[0, 0.32, 1], [0, 0.32, 5]]), b = rail('b', [[0, 0.32, 5], [0, 0.32, 9]]);
    const r = grindTrial({ grindables: [a, b], seconds: 2.2, steer: balancer });
    const ends = all(r.events, 'grind-end'), starts = all(r.events, 'grind-start');
    expect(ends[0]!.exit).toBe('transfer');
    expect(starts[1]!.grindableId).toBe('b');
    const sim3 = makeSim(makeField({ grindables: [rail('d', [[0, 0.32, 1], [0, 0.32, 12]])] }), { x: -0.35 });
    kick(sim3, { vz: 5, vx: 0.9 });
    ride(sim3, 0.1, intent({ crouch: 1 }));
    ride(sim3, 1 / 60, intent({ pop: { from: 'tail', flipId: null, strength: 0.9 } }));
    ride(sim3, 0.6, (t, p) => intent({ steer: balancer(t, p) }));
    expect(sim3.present().phase).toBe('grind');
    const out = ride(sim3, 1.5, (t, p) => (t === 0 ? intent({ pop: { from: 'tail', flipId: 'kickflip', strength: 0.8 } }) : intent({ steer: balancer(t, p) })));
    expect(kinds(out.events).slice(0, 2)).toEqual(['grind-end', 'pop']);
    expect(first(out.events, 'grind-end')!.exit).toBe('ollie');
    expect(first(out.events, 'pop')!.flipId).toBe('kickflip');
    expect(first(out.events, 'flip-caught')).toBeDefined();
    expect(first(out.events, 'land')).toBeDefined();
    expect(first(out.events, 'bail')).toBeUndefined();
    // Came off to the side, not back onto the same rail.
    expect(all(out.events, 'grind-start').length).toBe(0);
  });

  it('crossing a rail square-on does not lock; grindAssist widens reach', () => {
    const cross = rail('cross', [[-3, 0.25, 2], [3, 0.25, 2]]);
    const sim = makeSim(makeField({ grindables: [cross] }));
    kick(sim, { vz: 5 });
    ride(sim, 0.1, intent({ crouch: 1 }));
    const r = ride(sim, 1, (t) => intent({ pop: t === 0 ? { from: 'tail', flipId: null, strength: 0.9 } : null }));
    expect(first(r.events, 'grind-start')).toBeUndefined();
    expect(first(r.events, 'land')).toBeDefined();
    const far = grindTrial({ grindables: [flatbar], x: -0.8, vx: 0.9, seconds: 1 });
    expect(first(far.events, 'grind-start')).toBeUndefined();
    const assisted = grindTrial({ grindables: [flatbar], x: -0.8, vx: 0.9, seconds: 1, assist: true, steer: balancer });
    expect(first(assisted.events, 'grind-start')).toBeDefined();
  });

  it('a flip that is not caught cannot lock onto a rail', () => {
    const sim = makeSim(makeField({ grindables: [flatbar] }), { x: -0.35 });
    kick(sim, { vz: 5, vx: 0.9 });
    ride(sim, 0.1, intent({ crouch: 1 }));
    const r = ride(sim, 1.2, (t) => intent({ pop: t === 0 ? { from: 'tail', flipId: '360-flip', strength: 0.3 } : null }));
    expect(first(r.events, 'grind-start')).toBeUndefined();
  });

  it('coping: an angled low air locks along the coping and exits back into the transition', () => {
    const qp = quarterPipe({ id: 'qp', x: 0, z: 3, yaw: 0, radius: 1.6, topDeg: 82, width: 7 });
    const sim = makeSim(makeField({ pieces: [qp.piece], grindables: [qp.coping] }), { x: -3, z: 2 });
    // Carve up the wall at an angle: mostly along the coping.
    kick(sim, { vz: 6.6, vx: 3, yaw: Math.atan2(3, 6.6) });
    let popped = false;
    const r = ride(sim, 3, (_t, p) => {
      // Grind a little, then ollie out.
      const pop = p.phase === 'grind' && !popped && p.x > 1 ? (popped = true) : false;
      return intent({ grindAssist: p.phase === 'air', steer: balancer(0, p), pop: pop ? { from: 'tail', flipId: null, strength: 0.5 } : null });
    }, 60, true);
    const gs = first(r.events, 'grind-start')!;
    expect(gs).toBeDefined();
    expect(gs.kind2).toBe('coping');
    expect(gs.grindableId).toBe('qp-coping');
    const ge = first(r.events, 'grind-end')!;
    expect(ge.exit).toBe('ollie');
    expect(ge.distance).toBeGreaterThan(1);
    // Back into the transition, never out over the deck.
    const after = r.frames.filter((f) => f.t > ge.t);
    expect(Math.max(...after.map((f) => f.p.z))).toBeLessThan(3 + qp.lipDist + 0.05);
    const land = first(r.events, 'land')!;
    expect(land.onFeature).toBe('qp');
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(r.present.vz).toBeLessThan(-1);
  });

  it('slow at the coping with weight forward: rock to fakie', () => {
    const qp = quarterPipe({ id: 'qp', x: 0, z: 1, yaw: 0, radius: 1.6, topDeg: 82, width: 4 });
    const sim = makeSim(makeField({ pieces: [qp.piece], grindables: [qp.coping] }));
    // Just enough speed to reach the coping.
    const H = qp.height;
    kick(sim, { vz: Math.sqrt(2 * G * H) + 0.15 });
    const r = ride(sim, 3, intent({ lean: 1 }), 60, true);
    expect(first(r.events, 'lip-trick')!.id).toBe('rock-to-fakie');
    expect(r.frames.some((f) => f.p.grind?.grindId === 'rock-to-fakie')).toBe(true);
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(r.present.vz).toBeLessThan(-1);
    expect(r.present.fakie).toBe(true);
  });
});

describe('skate sim · more stance, stairs and stalls', () => {
  it('a revert pressed just before touchdown lands with revert: true and rides away fakie', () => {
    const r = popTrial({ crouch: 0.8, strength: 0.6, after: (_t, p) => intent({ revert: p.phase === 'air' && p.vy < 0 && p.clearance < 0.12 }) });
    const land = first(r.events, 'land')!;
    expect(land.revert).toBe(true);
    const i = kinds(r.events).indexOf('land');
    expect(kinds(r.events)[i + 1]).toBe('revert');
    expect(r.present.fakie).toBe(true);
    expect(first(r.events, 'bail')).toBeUndefined();
  });

  it('a fakie pop shove-it lands switch; switch is reported on the pop', () => {
    const sim = makeSim(flat, { yaw: Math.PI });
    kick(sim, { vz: 4 });
    ride(sim, 0.3, intent({ crouch: 0.8 }));
    expect(sim.present().fakie).toBe(true);
    const r = ride(sim, 1.2, (t) => intent({ pop: t === 0 ? { from: 'tail', flipId: 'pop-shuvit', strength: 0.6 } : null }));
    expect(first(r.events, 'pop')!.fakie).toBe(true);
    const land = first(r.events, 'land')!;
    expect(land.switch).toBe(true);
    expect(land.fakie).toBe(false);
    expect(r.present.switch).toBe(true);
    // Switch has the other foot forward: carving right is now the heel edge for a regular rider.
    expect(ride(sim, 0.3, intent({ steer: 1 })).present.carve).toBeLessThan(-0.5);
    const again = ride(sim, 1.2, (t) => intent({ pop: t === 0 ? { from: 'tail', flipId: null, strength: 0.6 } : null }));
    expect(first(again.events, 'pop')!.switch).toBe(true);
  });

  it('rolls down a set of stairs as a string of small drops, and ollies the whole set to a clean landing', () => {
    const set = stairs({ id: 'stairs', x: 0, z: 2, yaw: 0, steps: 5, rise: 0.14, tread: 0.3, width: 3, landing: 3 });
    const field = makeField({ pieces: [set], groundY: () => 0 });
    const roll = makeSim(field, { z: 1 });
    kick(roll, { vz: 3 });
    const rr = ride(roll, 1.5, intent(), 60, true);
    expect(first(rr.events, 'bail')).toBeUndefined();
    expect(rr.present.y).toBeCloseTo(0, 5);
    expect(rr.present.z).toBeGreaterThan(4);
    const ollie = makeSim(field, { z: 0.8 });
    kick(ollie, { vz: 5.5 });
    ride(ollie, 0.15, intent({ crouch: 1 }));
    const ro = ride(ollie, 1.5, (t) => intent({ pop: t === 0 ? { from: 'tail', flipId: null, strength: 0.8 } : null }), 60, true);
    const land = first(ro.events, 'land')!;
    expect(first(ro.events, 'bail')).toBeUndefined();
    expect(land.gap).toBeGreaterThan(2);
    expect(land.airTime).toBeGreaterThan(0.5);
    expect(ro.frames.find((f) => f.t >= land.t - 1e-9)!.p.z).toBeGreaterThan(2 + 5 * 0.3);
  });

  it('locks a rail at top speed without tunnelling past it', () => {
    const r = grindTrial({ grindables: [rail('fast', [[0, 0.32, 1], [0, 0.32, 20]])], v: 13, vx: 1.6, steer: balancer, seconds: 0.8 });
    expect(first(r.events, 'grind-start')).toBeDefined();
  });

  it('slow at the coping holding grind: axle stall, then rides back in regular', () => {
    const qp = quarterPipe({ id: 'qp', x: 0, z: 1, yaw: 0, radius: 1.6, topDeg: 82, width: 4 });
    const sim = makeSim(makeField({ pieces: [qp.piece], grindables: [qp.coping] }));
    kick(sim, { vz: Math.sqrt(2 * G * qp.height) + 0.15 });
    const r = ride(sim, 3, intent({ grindAssist: true }), 60, true);
    expect(first(r.events, 'lip-trick')!.id).toBe('axle-stall');
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(r.present.vz).toBeLessThan(-1);
    expect(r.present.fakie).toBe(false);
  });
});

describe('skate sim · wallride', () => {
  const wall = { kind: 'box' as const, id: 'boathouse', minX: 1, maxX: 1.3, minZ: 0, maxZ: 12 };
  function wallTrial(vx: number, pop: boolean) {
    const sim = makeSim(flat, { x: 0.3, z: 0.5, islandObstacles: [wall] });
    kick(sim, { vz: 6.5, vx, yaw: Math.atan2(vx, 6.5) });
    ride(sim, 0.1, intent({ crouch: 1 }));
    return ride(sim, 2, (t) => intent({ pop: pop && t === 0 ? { from: 'tail', flipId: null, strength: 0.8 } : null }), 60, true);
  }

  it('pop into a tall face while travelling along it: ride the wall, then drop off and roll away', () => {
    const r = wallTrial(1.4, true);
    const on = r.frames.filter((f) => f.p.grind?.grindId === 'wallride');
    expect(on.length).toBeGreaterThan(10);
    expect(on[0]!.p.phase).toBe('grind');
    expect(on[0]!.p.grind!.grindableId).toBe('boathouse');
    // Wall on the rider's left (travelling +z, wall at +x): faceSign −1, deck up on its edge.
    expect(on[0]!.p.grind!.faceSign).toBe(-1);
    expect(Math.abs(on.at(-1)!.p.boardRoll)).toBeGreaterThan(1);
    const wr = first(r.events, 'wallride')!;
    expect(wr.seconds).toBeGreaterThan(0.2);
    expect(first(r.events, 'land')).toBeDefined();
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(Math.max(...r.frames.map((f) => f.p.x))).toBeLessThan(1 - SKATE_TUNING.RADIUS + 0.01);
  });

  it('rolling into the same face without a pop just slides along it', () => {
    const r = wallTrial(1.4, false);
    expect(first(r.events, 'wallride')).toBeUndefined();
    expect(first(r.events, 'bail')).toBeUndefined();
  });
});

describe('skate sim · manuals', () => {
  const keep = (_t: number, p: SkatePresent) => Math.max(-1, Math.min(1, p.balance * 3));

  it('holds a manual with balance, reports distance and time, and pitches the nose up', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 4 });
    const r = ride(sim, 2.5, (t, p) => intent({ manual: t < 2 ? 'manual' : null, lean: keep(t, p) }), 60, true);
    const s = first(r.events, 'manual-start')!, e = first(r.events, 'manual-end')!;
    expect(s.manual).toBe('manual');
    expect(e.seconds).toBeCloseTo(2, 1);
    expect(e.distance).toBeGreaterThan(5);
    const mid = r.frames[60]!.p;
    expect(mid.phase).toBe('manual');
    expect(mid.manual).toBe('manual');
    expect(mid.boardPitch).toBeLessThan(-0.1);
    expect(first(r.events, 'bail')).toBeUndefined();
    // Nose manual: nose down.
    const nose = makeSim(flat);
    kick(nose, { vz: 4 });
    const rn = ride(nose, 1, (t, p) => intent({ manual: 'nose-manual', lean: -keep(t, p) }), 60, true);
    expect(rn.frames[40]!.p.boardPitch).toBeGreaterThan(0.1);
  });

  it('an unbalanced manual either loops out (bail) or drops the wheels', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 4 });
    const r = ride(sim, 5, intent({ manual: 'manual' }));
    const b = first(r.events, 'bail');
    const e = first(r.events, 'manual-end')!;
    expect(e.seconds).toBeLessThan(4.5);
    if (b) expect(b.reason).toBe('balance');
  });

  it('manuals across a pad and off the end, then back into the held manual on landing', () => {
    const pad = block({ id: 'pad', x: 0, z: 4.5, yaw: 0, halfX: 1, halfZ: 1.5, h: 0.12 });
    const sim = makeSim(makeField({ pieces: [pad] }), { z: 3.2 });
    expect(sim.present().y).toBeCloseTo(0.12, 6);
    kick(sim, { vz: 4 });
    const r = ride(sim, 1.5, (t, p) => intent({ manual: 'manual', lean: keep(t, p) }), 60, true);
    const starts = all(r.events, 'manual-start'), ends = all(r.events, 'manual-end');
    expect(starts.length).toBeGreaterThanOrEqual(2);
    expect(ends[0]!.distance).toBeGreaterThan(2.5);
    expect(ends[0]!.distance).toBeLessThan(3.2);
    const offEnd = r.frames.find((f) => f.p.z > 6.05)!;
    expect(offEnd.p.phase).toBe('air');
    expect(kinds(r.events).indexOf('manual-end')).toBeLessThan(kinds(r.events).indexOf('manual-start', 1));
  });

  it('ollie into a held manual starts it on touchdown', () => {
    const r = popTrial({ crouch: 0.8, strength: 0.6, after: (_t, p) => intent({ manual: 'manual', lean: Math.max(-1, Math.min(1, p.balance * 3)) }) });
    const land = first(r.events, 'land')!, ms = first(r.events, 'manual-start')!;
    expect(ms.t).toBeCloseTo(land.t, 5);
  });
});

describe('skate sim · grind selection (pure)', () => {
  const pick = (axisDeg: number, over: 1 | -1, lean: number) => selectGrind(GRINDS, { axis: (axisDeg * Math.PI) / 180, over, lean, kind: 'ledge' })!.id;
  it('maps approach to the nearest catalog def', () => {
    expect(pick(3, 1, 0)).toBe('50-50');
    expect(pick(3, -1, -0.8)).toBe('5-0');
    expect(pick(3, 1, 0.8)).toBe('nosegrind');
    expect(pick(88, 1, 0)).toBe('boardslide');
    expect(pick(80, -1, 0)).toBe('lipslide');
    expect(pick(85, 1, -0.9)).toBe('tailslide');
    expect(pick(85, -1, 0.9)).toBe('noseslide');
    expect(pick(25, -1, -0.8)).toBe('smith');
    expect(pick(25, 1, -0.8)).toBe('feeble');
    expect(pick(18, 1, 0.8)).toBe('crooked');
    expect(pick(18, -1, 0.8)).toBe('overcrook');
    expect(wantedContact({ axis: 1.4, over: 1, lean: 0, kind: 'round-rail' })).toBe('deck');
  });
  it('works with an unsigned catalog by reading lip/smith/overcrook as the near side', () => {
    const unsigned = new Map<string, GrindDef>([...GRINDS.values()].map((d) => [d.id, { ...d, deckYaw: Math.abs(d.deckYaw) }]));
    expect(selectGrind(unsigned, { axis: 1.5, over: 1, lean: 0, kind: 'round-rail' })!.id).toBe('boardslide');
    expect(selectGrind(unsigned, { axis: 1.5, over: -1, lean: 0, kind: 'round-rail' })!.id).toBe('lipslide');
    expect(selectGrind(new Map(), { axis: 0, over: 1, lean: 0, kind: 'round-rail' })).toBeNull();
  });
});
