import { describe, expect, it } from 'vitest';
import { SKATE_DT, type SkatePresent } from '../src/harbour/skate/contract.ts';
import { bowl, block, kicker, makeField, miniRamp, quarterPipe } from '../src/harbour/skate/sim/fields.ts';
import { SKATE_TUNING } from '../src/harbour/skate/sim/tuning.ts';
import { all, first, intent, kick, kinds, lcg, makeSim, ride } from '../src/harbour/skate/sim/testKit.ts';

const flat = makeField({});

describe('skate sim · pushing, rolling, carving', () => {
  it('pushes in strokes to a cruise, coasts, and foot-brakes to a stop', () => {
    const sim = makeSim(flat);
    const r = ride(sim, 4, intent({ push: true }), 60, true);
    const pushes = all(r.events, 'push');
    expect(pushes.length).toBeGreaterThanOrEqual(8);
    expect(pushes.length).toBeLessThanOrEqual(10);
    const gaps = pushes.slice(1).map((e, i) => e.t - pushes[i]!.t);
    for (const g of gaps) expect(g).toBeCloseTo(SKATE_TUNING.PUSH_PERIOD, 1);
    expect(r.frames.every((f) => f.p.pushPhase >= 0 && f.p.pushPhase <= 1)).toBe(true);
    expect(r.present.speed).toBeGreaterThan(5.5);
    expect(r.present.speed).toBeLessThan(SKATE_TUNING.PUSH_CAP);
    // Diminishing returns: the last second adds far less than the first.
    const at = (t: number) => r.frames[Math.round(t * 60) - 1]!.p.speed;
    expect(at(4) - at(3)).toBeLessThan((at(1) - at(0.1)) / 3);
    const cruise = r.present.speed;
    const coast = ride(sim, 1, intent());
    expect(coast.present.speed).toBeLessThan(cruise);
    expect(coast.present.speed).toBeGreaterThan(cruise - 0.6);
    const braked = ride(sim, 2, intent({ brake: true }));
    expect(braked.present.speed).toBeLessThan(0.01);
    expect(braked.present.phase).toBe('idle');
  });

  it('sprint pushes harder and faster', () => {
    const a = makeSim(flat), b = makeSim(flat);
    const ra = ride(a, 5, intent({ push: true })), rb = ride(b, 5, intent({ push: true, sprint: true }));
    expect(rb.present.speed).toBeGreaterThan(ra.present.speed + 0.8);
    expect(all(rb.events, 'push').length).toBeGreaterThan(all(ra.events, 'push').length);
  });

  it('grass and sand bog you down; wood, concrete and paths roll; cobbles are felt, not punishing', () => {
    const coast = (kind: 'grass' | 'sand' | 'cobble' | 'wood' | 'concrete' | 'path') => {
      const sim = makeSim(makeField({ ground: kind }));
      kick(sim, { vz: 6 });
      return ride(sim, 1.5, intent()).present.speed;
    };
    const push = (kind: 'cobble' | 'concrete' | 'path' | 'grass') => {
      const r = ride(makeSim(makeField({ ground: kind })), 6, intent({ push: true }), 60, true);
      return { cruise: r.present.speed, to5: r.frames.find((f) => f.p.speed >= 5)?.t ?? Infinity };
    };
    const wood = coast('wood'), concrete = coast('concrete'), path = coast('path'), cobble = coast('cobble'), grass = coast('grass'), sand = coast('sand');
    expect(wood).toBeGreaterThan(5.2);
    expect(concrete).toBeGreaterThan(5.2);
    expect(path).toBeGreaterThan(concrete - 0.1);
    expect(cobble).toBeLessThan(concrete - 0.3);
    expect(cobble).toBeGreaterThan(concrete - 0.8);
    expect(grass).toBeLessThan(3.5);
    expect(sand).toBeLessThan(grass);
    // Pushing: paths as fast as concrete, cobbles a little slower, grass a crawl you can still get out on.
    const c = push('concrete'), p = push('path'), cb = push('cobble'), g = push('grass');
    expect(p.cruise).toBeGreaterThan(c.cruise - 0.1);
    expect(cb.cruise).toBeGreaterThan(c.cruise - 0.6);
    expect(cb.to5).toBeLessThan(c.to5 + 0.8);
    expect(g.cruise).toBeGreaterThan(1.2);
    expect(g.cruise).toBeLessThan(3);
  });

  it('carves with a speed-dependent radius and exposes the toe/heel edge', () => {
    const turn = (v: number) => {
      const sim = makeSim(flat);
      kick(sim, { vz: v });
      const r = ride(sim, 0.5, intent({ steer: 1 }), 60, true);
      return { yaw: r.present.heading, carve: r.frames[20]!.p.carve, speed: r.present.speed };
    };
    const slow = turn(2), fast = turn(8);
    // Steering right turns clockwise (heading decreases).
    expect(slow.yaw).toBeLessThan(0);
    // Radius grows with speed: at 4× the speed the turn rate is lower per metre but the rider still turns.
    const rSlow = 2 / Math.abs(slow.yaw / 0.5), rFast = 8 / Math.abs(fast.yaw / 0.5);
    expect(rFast).toBeGreaterThan(rSlow * 1.5);
    // Regular stance, steering right = toe edge (+).
    expect(slow.carve).toBeGreaterThan(0.5);
    const goofy = makeSim(flat, { stance: 'goofy' });
    kick(goofy, { vz: 3 });
    expect(ride(goofy, 0.3, intent({ steer: 1 })).present.carve).toBeLessThan(-0.5);
  });
});

describe('skate sim · transitions, pumping, lips', () => {
  const mr = miniRamp({ id: 'mini', x: 0, z: 0, yaw: 0, flat: 2.5, radius: 1.5, topDeg: 80, width: 4 });
  const mini = makeField({ pieces: [mr.piece], grindables: mr.copings });

  function wallPeaks(pump: boolean, seconds: number): number[] {
    const sim = makeSim(mini);
    kick(sim, { vz: 4.2 });
    const peaks: number[] = [];
    let peak = 0, side = 1;
    ride(sim, seconds, (_t, p) => {
      const s = Math.sign(p.z) || side;
      if (s !== side) { peaks.push(peak); peak = 0; side = s; }
      peak = Math.max(peak, p.y);
      // Crouch on the flat / in the air, stand tall through the curved transition.
      return intent({ crouch: pump && (p.phase === 'air' || Math.abs(p.z) < 1.25) ? 1 : 0 });
    });
    return peaks.slice(1);
  }

  it('carries you up one wall of a mini-ramp and back, rolling fakie then regular', () => {
    const sim = makeSim(mini);
    kick(sim, { vz: 4 });
    const r = ride(sim, 4, intent(), 60, true);
    const maxZ = Math.max(...r.frames.map((f) => f.p.z)), minZ = Math.min(...r.frames.map((f) => f.p.z));
    expect(maxZ).toBeGreaterThan(1.6);
    expect(minZ).toBeLessThan(-1.6);
    // Came back down the first wall backwards: fakie.
    const back = r.frames.find((f) => f.p.vz < -1 && f.p.z > 0)!;
    expect(back.p.fakie).toBe(true);
    // …and up and back down the other wall: regular again.
    const again = r.frames.find((f) => f.t > back.t && f.p.vz > 1 && f.p.z < 0)!;
    expect(again.p.fakie).toBe(false);
    expect(r.frames.every((f) => f.p.phase !== 'bail')).toBe(true);
    // Board pitch follows the wall (nose up going up = negative pitch).
    expect(Math.min(...r.frames.filter((f) => f.p.z > 0 && f.p.vz > 0).map((f) => f.p.boardPitch))).toBeLessThan(-0.8);
  });

  it('pumping gains height every wall; not pumping slowly loses it', () => {
    const lazy = wallPeaks(false, 12), pumped = wallPeaks(true, 12);
    expect(lazy.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < 5; i++) expect(lazy[i]!).toBeLessThan(lazy[i - 1]!);
    for (let i = 1; i < 5; i++) expect(pumped[i]!).toBeGreaterThan(pumped[i - 1]!);
    expect(pumped[4]! - pumped[0]!).toBeGreaterThan(0.25);
  });

  it('pumping levels off instead of launching to orbit', () => {
    const peaks = wallPeaks(true, 45);
    const top = Math.max(...peaks);
    expect(top).toBeLessThan(mr.height + 2);
    expect(top).toBeGreaterThan(mr.height + 0.4);
  });

  it('vert: launches straight up, comes back down into the transition, lands fakie and clean', () => {
    const qp = quarterPipe({ id: 'vert', x: 0, z: 4, yaw: 0, radius: 2.2, topDeg: 84, width: 5 });
    const field = makeField({ pieces: [qp.piece], grindables: [qp.coping] });
    const sim = makeSim(field);
    kick(sim, { vz: 10 });
    const r = ride(sim, 3, intent(), 60, true);
    const air = r.frames.filter((f) => f.p.phase === 'air');
    expect(air.length).toBeGreaterThan(20);
    const apex = Math.max(...air.map((f) => f.p.y));
    expect(apex - qp.height).toBeGreaterThan(0.5);
    expect(apex - qp.height).toBeLessThan(2);
    // Never drifted out over the deck.
    const lipZ = 4 + qp.lipDist;
    expect(Math.max(...air.map((f) => f.p.z))).toBeLessThan(lipZ + 0.02);
    const land = first(r.events, 'land')!;
    expect(land).toBeDefined();
    expect(land.fakie).toBe(true);
    expect(land.boardClean).toBeGreaterThan(0.9);
    expect(first(r.events, 'bail')).toBeUndefined();
    // Landed in the transition, fast and smooth, and rolled back out.
    expect(r.present.vz).toBeLessThan(-6);
    expect(r.present.z).toBeLessThan(4);
  });

  it('kicker lips launch along the tangent and carry you forward', () => {
    const k = kicker({ id: 'kick', x: 0, z: 2, yaw: 0, length: 1.4, lipDeg: 32, width: 2 });
    const sim = makeSim(makeField({ pieces: [k.piece] }));
    kick(sim, { vz: 7 });
    const r = ride(sim, 2, intent(), 60, true);
    const land = first(r.events, 'land')!;
    expect(land).toBeDefined();
    expect(land.gap).toBeGreaterThan(1.8);
    expect(land.fakie).toBe(false);
    const apex = Math.max(...r.frames.map((f) => f.p.y));
    expect(apex).toBeGreaterThan(k.height + 0.2);
    expect(r.present.z).toBeGreaterThan(5);
    expect(first(r.events, 'bail')).toBeUndefined();
  });

  it('rolling fakie up a bank and back down rides out regular; rolling up forward comes back fakie', () => {
    const qp = quarterPipe({ id: 'qp', x: 0, z: 2, yaw: 0, radius: 2, topDeg: 60, width: 4, vert: false });
    const sim = makeSim(makeField({ pieces: [qp.piece] }));
    kick(sim, { vz: 3 });
    let r = ride(sim, 3, intent());
    expect(r.present.vz).toBeLessThan(0);
    expect(r.present.fakie).toBe(true);
    const sim2 = makeSim(makeField({ pieces: [qp.piece] }), { yaw: Math.PI });
    kick(sim2, { vz: 3 }); // board faces −z, moving +z: fakie
    expect(ride(sim2, 0.05, intent()).present.fakie).toBe(true);
    r = ride(sim2, 3, intent());
    expect(r.present.vz).toBeLessThan(0);
    expect(r.present.fakie).toBe(false);
  });

  it('a round bowl carries a carve around the wall without leaving it', () => {
    const b = bowl({ id: 'bowl', x: 0, z: 0, r0: 2, radius: 1.8, topDeg: 80 });
    const sim = makeSim(makeField({ pieces: [b.piece], grindables: [b.coping] }), { x: 0, z: 0, yaw: Math.PI / 2 });
    kick(sim, { vx: 5 });
    const r = ride(sim, 6, (_t, p) => intent({ steer: p.y > 0.3 ? -0.4 : 0 }), 60, true);
    expect(r.frames.every((f) => Number.isFinite(f.p.y) && Math.hypot(f.p.x, f.p.z) < 2 + 1.8 + 1)).toBe(true);
    expect(Math.max(...r.frames.map((f) => f.p.y))).toBeGreaterThan(0.4);
  });
});

describe('skate sim · powerslide, revert, stance', () => {
  it('powerslide turns the board ~90°, scrubs speed at a controllable rate, and emits on exit', () => {
    const run = (steer: number) => {
      const sim = makeSim(flat);
      kick(sim, { vz: 7 });
      const r = ride(sim, 0.6, intent({ powerslide: true, steer }), 60, true);
      return { sim, r };
    };
    const gentle = run(0.3), hard = run(0.8);
    const mid = hard.r.frames[30]!.p;
    expect(mid.phase).toBe('powerslide');
    const rel = Math.abs(Math.atan2(Math.sin(mid.boardYaw - mid.heading), Math.cos(mid.boardYaw - mid.heading)));
    expect(rel).toBeGreaterThan(1.2);
    expect(rel).toBeLessThan(1.9);
    expect(hard.r.present.speed).toBeLessThan(gentle.r.present.speed - 0.5);
    expect(gentle.r.present.speed).toBeLessThan(6.5);
    const out = ride(hard.sim, 0.4, intent());
    const ps = first(out.events, 'powerslide')!;
    expect(ps.seconds).toBeGreaterThan(0.5);
    expect(out.present.fakie).toBe(false);
    expect(first(out.events, 'revert')).toBeUndefined();
    const rel2 = Math.abs(Math.atan2(Math.sin(out.present.boardYaw - out.present.heading), Math.cos(out.present.boardYaw - out.present.heading)));
    expect(rel2).toBeLessThan(0.1);
  });

  it('brake + steer at speed is a powerslide too', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 6 });
    const r = ride(sim, 0.3, intent({ brake: true, steer: -1 }));
    expect(r.present.phase).toBe('powerslide');
  });

  it('a 180 powerslide comes out fakie with a revert', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 8 });
    ride(sim, 0.5, intent({ powerslide: true, steer: 1 }));
    const out = ride(sim, 0.5, intent());
    expect(kinds(out.events)).toEqual(expect.arrayContaining(['powerslide', 'revert']));
    expect(out.present.fakie).toBe(true);
    expect(out.present.speed).toBeGreaterThan(0.5);
  });

  it('revert spins the board 180 on the ground at low speed: regular → fakie → regular', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 2.5 });
    let r = ride(sim, 0.5, (t) => intent({ revert: t === 0 }), 60, true);
    expect(first(r.events, 'revert')).toBeDefined();
    expect(r.frames[3]!.p.phase).toBe('powerslide');
    expect(r.present.fakie).toBe(true);
    expect(r.present.vz).toBeGreaterThan(1.5);
    r = ride(sim, 0.5, (t) => intent({ revert: t === 0 }));
    expect(r.present.fakie).toBe(false);
  });

  it('a revert at speed on flat ground (not just landed) is ignored', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 7 });
    const r = ride(sim, 0.3, (t) => intent({ revert: t === 0 }));
    expect(first(r.events, 'revert')).toBeUndefined();
  });
});

describe('skate sim · walls, water, respawn', () => {
  it('slow into an island obstacle stops; fast is a wall bail, then recover somewhere safe facing away', () => {
    const wall = { kind: 'box' as const, id: 'shed', minX: -3, maxX: 3, minZ: 5, maxZ: 5.08 };
    const slow = makeSim(flat, { islandObstacles: [wall] });
    kick(slow, { vz: 2 });
    let r = ride(slow, 3, intent());
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(r.present.z).toBeLessThan(5 - SKATE_TUNING.RADIUS + 0.01);
    const fast = makeSim(flat, { islandObstacles: [wall] });
    kick(fast, { vz: 11 });
    r = ride(fast, 2, intent(), 60, true);
    const b = first(r.events, 'bail')!;
    expect(b.reason).toBe('wall');
    expect(Math.max(...r.frames.map((f) => f.p.z))).toBeLessThan(5);
    const rec = first(r.events, 'recovered')!;
    expect(rec.t - b.t).toBeCloseTo(SKATE_TUNING.BAIL_TIME, 1);
    expect(r.frames.some((f) => f.p.phase === 'bail' && f.p.bail !== null)).toBe(true);
    // Facing away from the wall, clear of it.
    expect(Math.cos(r.present.boardYaw)).toBeLessThan(-0.9);
    expect(r.present.z).toBeLessThan(4.5);
  });

  it('never tunnels through a thin park solid at top speed', () => {
    const field = makeField({ solids: [{ kind: 'obox', id: 'plank', x: 0, z: 3, halfX: 3, halfZ: 0.02, yaw: 0, top: 1 }] });
    const sim = makeSim(field);
    kick(sim, { vz: SKATE_TUNING.MAX_SPEED });
    const r = ride(sim, 1, intent(), 30, true);
    expect(Math.max(...r.frames.map((f) => f.p.z))).toBeLessThan(3);
  });

  it('the shoreline stops you gently when slow and bails you into the water when fast', () => {
    const shore = (x: number, z: number) => { const d = Math.hypot(x, z); return d <= 10 ? { x, z, ashore: true } : { x: (x * 10) / d, z: (z * 10) / d, ashore: false }; };
    const slow = makeSim(flat, { shore, z: 8 });
    kick(slow, { vz: 2 });
    let r = ride(slow, 3, intent());
    expect(first(r.events, 'bail')).toBeUndefined();
    expect(Math.hypot(r.present.x, r.present.z)).toBeLessThanOrEqual(10 + 1e-6);
    const fast = makeSim(flat, { shore, z: 5 });
    kick(fast, { vz: 8 });
    r = ride(fast, 1, intent());
    expect(first(r.events, 'bail')!.reason).toBe('water');
    expect(Math.hypot(r.present.x, r.present.z)).toBeLessThanOrEqual(10 + 1e-6);
  });

  it('steep rises you ride into are walls (ramp sides), not launch pads', () => {
    const field = makeField({ pieces: [block({ id: 'box', x: 0, z: 3, yaw: 0, halfX: 2, halfZ: 1, h: 0.5 })] });
    const sim = makeSim(field);
    kick(sim, { vz: 3 });
    const r = ride(sim, 2, intent(), 60, true);
    expect(Math.max(...r.frames.map((f) => f.p.y))).toBeLessThan(0.01);
    expect(r.present.z).toBeLessThan(2);
    const fast = makeSim(field);
    kick(fast, { vz: 9 });
    expect(first(ride(fast, 1, intent()).events, 'bail')!.reason).toBe('wall');
  });

  it('practice marker only sets when slow on the ground; respawn returns there', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 5 });
    expect(sim.setMarker()).toBe(false);
    ride(sim, 2, intent({ brake: true }));
    expect(sim.setMarker()).toBe(true);
    const at = { ...sim.present() };
    kick(sim, { vz: 5 });
    ride(sim, 1, intent({ steer: 0.5 }));
    expect(Math.hypot(sim.present().x - at.x, sim.present().z - at.z)).toBeGreaterThan(2);
    ride(sim, 1 / 60, intent({ respawn: true }));
    expect(sim.present().x).toBeCloseTo(at.x, 5);
    expect(sim.present().z).toBeCloseTo(at.z, 5);
    expect(sim.present().speed).toBeLessThan(1e-6);
  });
});

describe('skate sim · robustness', () => {
  function scenario(hz: number): { p: SkatePresent; ev: string[] } {
    const k = kicker({ id: 'kick', x: 0, z: 9, yaw: 0, length: 1.4, lipDeg: 30, width: 3 });
    const sim = makeSim(makeField({ pieces: [k.piece] }));
    const ev: string[] = [];
    const n = Math.round(4 * hz);
    for (let i = 0; i < n; i++) {
      const t = i / hz;
      const r = sim.step(intent({
        // Changes only on 1/6 s boundaries, which every tested frame rate hits exactly.
        push: t < 1.5 - 1e-9, steer: t > 1.5 - 1e-9 && t < 2 - 1e-9 ? 0.2 : 0, crouch: t > 5 / 6 - 1e-9 && t < 1 - 1e-9 ? 1 : 0,
        pop: Math.abs(t - 1) < 1e-9 ? { from: 'tail', flipId: 'kickflip', strength: 0.6 } : null,
      }), 1 / hz);
      for (const e of r.events) ev.push(`${e.kind}@${e.t.toFixed(4)}`);
    }
    return { p: { ...sim.present() }, ev };
  }

  it('gives the same ride at 30, 60, 120 and 144 fps', () => {
    const base = scenario(120);
    expect(base.ev.some((e) => e.startsWith('pop'))).toBe(true);
    expect(base.ev.some((e) => e.startsWith('flip-caught'))).toBe(true);
    for (const hz of [30, 60, 144]) {
      const o = scenario(hz);
      expect(o.ev).toEqual(base.ev);
      for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'boardYaw', 'boardPitch'] as const) expect(o.p[k]).toBeCloseTo(base.p[k], 6);
    }
  });

  it('clamps a stalled frame and sanitises nonsense input', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 5 });
    sim.step(intent(), 30);
    expect(sim.present().z).toBeLessThan(0.51);
    const r = sim.step({ ...intent(), steer: NaN, lean: Infinity, crouch: -Infinity, pop: { from: 'tail', flipId: null, strength: NaN } } as never, NaN);
    const p = r.present;
    for (const v of [p.x, p.y, p.z, p.vx, p.vy, p.vz, p.boardYaw, p.carve, p.lean, p.crouch]) expect(Number.isFinite(v)).toBe(true);
    sim.step(undefined as never, 1 / 60);
    expect(Number.isFinite(sim.present().x)).toBe(true);
  });

  it('60 s of seeded random input stays finite, on the island and out of the solids', () => {
    const mr = miniRamp({ id: 'mini', x: 6, z: 0, yaw: 0, flat: 2, radius: 1.4, topDeg: 82, width: 4 });
    const k = kicker({ id: 'kick', x: -5, z: -4, yaw: 0.4, length: 1.3, lipDeg: 30, width: 2 });
    const b = bowl({ id: 'bowl', x: -6, z: 7, r0: 1.5, radius: 1.5, topDeg: 78 });
    const field = makeField({
      pieces: [mr.piece, k.piece, b.piece, block({ id: 'ledge', x: 0, z: -7, yaw: 0.2, halfX: 0.3, halfZ: 2, h: 0.4 })],
      grindables: [...mr.copings, b.coping, { id: 'rail', name: 'Rail', kind: 'round-rail', points: [[0, 0.45, 2], [0, 0.45, 7], [1, -0.2, 10]], faceYaw: null }],
      solids: [{ kind: 'circle', id: 'planter', x: 3, z: -3, r: 0.6, top: 0.5 }],
    });
    const shore = (x: number, z: number) => { const d = Math.hypot(x, z); return d <= 14 ? { x, z, ashore: true } : { x: (x * 14) / d, z: (z * 14) / d, ashore: false }; };
    const trees = [{ kind: 'circle' as const, id: 'tree', x: -2, z: 3, r: 0.3 }];
    const flips = ['kickflip', 'heelflip', 'pop-shuvit', '360-flip', null, 'nope'];
    for (const seed of [1, 7, 42]) {
      const rnd = lcg(seed);
      const sim = makeSim(field, { shore, islandObstacles: trees });
      let held = intent();
      let t = 0;
      while (t < 60) {
        const dt = 0.004 + rnd() * 0.05;
        t += dt;
        if (rnd() < 0.08) held = intent({
          steer: rnd() * 2 - 1, lean: rnd() * 2 - 1, push: rnd() < 0.6, brake: rnd() < 0.1, powerslide: rnd() < 0.08, crouch: rnd() < 0.3 ? rnd() : 0,
          grab: rnd() < 0.2 ? 'indy' : null, manual: rnd() < 0.1 ? 'manual' : rnd() < 0.05 ? 'nose-manual' : null, grindAssist: rnd() < 0.3, sprint: rnd() < 0.3,
        });
        const oneShot = intent({
          ...held,
          pop: rnd() < 0.03 ? { from: rnd() < 0.8 ? 'tail' : 'nose', flipId: flips[Math.floor(rnd() * flips.length)]!, strength: rnd() } : null,
          lateFlip: rnd() < 0.01 ? 'kickflip' : null, revert: rnd() < 0.01, respawn: rnd() < 0.002, marker: rnd() < 0.01,
        });
        const { present: p } = sim.step(oneShot, dt);
        for (const v of [p.x, p.y, p.z, p.vx, p.vy, p.vz, p.speed, p.heading, p.boardYaw, p.boardPitch, p.boardRoll, p.bodyTwist, p.crouch, p.lean, p.carve, p.balance, p.pushPhase, p.airTime, p.clearance, p.impact]) {
          expect(Number.isFinite(v)).toBe(true);
        }
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(14 + 1e-6);
        expect(p.y).toBeGreaterThan(-1);
        expect(p.y).toBeLessThan(12);
        expect(p.speed).toBeLessThanOrEqual(SKATE_TUNING.MAX_SPEED + 1e-6);
        if (p.phase !== 'air') expect(Math.hypot(p.x - 3, p.z + 3) > 0.6 + SKATE_TUNING.RADIUS - 0.02 || p.y >= 0.47).toBe(true);
      }
    }
  });

  it('save/load round-trips exactly (structuredClone-able) mid-air, mid-grind and mid-bail', () => {
    const mr = miniRamp({ id: 'mini', x: 0, z: 0, yaw: 0, flat: 2.5, radius: 1.5, topDeg: 80, width: 4 });
    const field = makeField({ pieces: [mr.piece], grindables: [...mr.copings, { id: 'rail', name: 'Rail', kind: 'round-rail', points: [[0, 0.4, -1], [0, 0.4, 1]], faceYaw: null }] });
    const drive = (t: number) => intent({ push: t < 1, crouch: t > 1.2 && t < 1.4 ? 1 : 0, steer: Math.sin(t * 3) * 0.5, pop: Math.abs(t - 1.4) < 1e-9 ? { from: 'tail', flipId: 'kickflip', strength: 0.8 } : null });
    for (const at of [0.5, 1.5, 2.5, 3.5]) {
      const sim = makeSim(field);
      let t = 0;
      for (; t < at - 1e-9; t += 1 / 60) sim.step(drive(t), 1 / 60);
      const snap = sim.save();
      const clone = structuredClone(snap);
      const tape = (s: typeof sim) => { const out: unknown[] = []; for (let u = t; u < t + 2; u += 1 / 60) { const r = s.step(drive(u), 1 / 60); out.push(JSON.parse(JSON.stringify({ p: r.present, e: r.events }))); } return out; };
      const a = tape(sim);
      const other = makeSim(field, { x: 3, z: 3 });
      other.load(clone);
      expect(tape(other)).toEqual(a);
    }
  });

  it('load ignores garbage', () => {
    const sim = makeSim(flat, { x: 1, z: 2 });
    sim.load(null); sim.load({ ver: 1 }); sim.load({ ver: 2, x: NaN });
    expect(sim.present().x).toBe(1);
    expect(sim.present().z).toBe(2);
  });

  it('runs at the fixed SKATE_DT', () => {
    const sim = makeSim(flat);
    kick(sim, { vz: 1 });
    const r = sim.step(intent({ push: true }), SKATE_DT * 3);
    expect(r.events.length).toBe(1);
    expect(r.events[0]!.t).toBeCloseTo(SKATE_DT, 9);
  });
});
