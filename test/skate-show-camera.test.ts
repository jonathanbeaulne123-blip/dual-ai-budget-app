import {describe, expect, it} from 'vitest';
import {createSkateCamera, projectToView, type SkateCameraFrame} from '../src/harbour/skate/camera/skateCamera.ts';
import {insideVillageBuilding} from '../src/harbour/body/obstacles.ts';
import {VILLAGE_SITES} from '../src/harbour/village/layout.ts';
import type {SkatePresent, SkateSimEvent} from '../src/harbour/skate/contract.ts';

const base: SkatePresent = {
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, heading: 0, boardYaw: 0, boardPitch: 0, boardRoll: 0, bodyTwist: 0,
  phase: 'roll', stance: 'regular', switch: false, fakie: false, crouch: 0, lean: 0, carve: 0, balance: 0, pushPhase: 0,
  airTime: 0, clearance: 0, trick: null, grab: null, grind: null, manual: null, bail: null, impact: 0, surface: 'concrete',
};
const at = (o: Partial<SkatePresent>): SkatePresent => {
  const p = {...base, ...o};
  if (o.speed === undefined) p.speed = Math.hypot(p.vx, p.vz);
  if (o.heading === undefined && (p.vx || p.vz)) p.heading = Math.atan2(p.vx, p.vz);
  return p;
};
const env = {aspect: 16 / 9};
const copy = (f: SkateCameraFrame) => ({position: [...f.position], target: [...f.target], fov: f.fov, roll: f.roll});
const finite = (f: SkateCameraFrame) => [...f.position, ...f.target, f.fov, f.roll].every(Number.isFinite);
/** Is world point P inside the frame's view frustum (with a small margin)? */
function inView(f: SkateCameraFrame, P: readonly number[], aspect = env.aspect): boolean {
  const [px, py, pz] = f.position, [tx, ty, tz] = f.target;
  let fx = tx - px, fy = ty - py, fz = tz - pz; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = f × up, up' = right × f
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const dx = P[0]! - px, dy = P[1]! - py, dz = P[2]! - pz, depth = dx * fx + dy * fy + dz * fz;
  if (depth <= 0.05) return false;
  const t = Math.tan(f.fov * Math.PI / 360) * 0.98;
  return Math.abs((dx * ux + dy * uy + dz * uz) / depth) <= t && Math.abs((dx * rx + dz * rz) / depth) <= t * aspect;
}

describe('skate chase camera', () => {
  it('keeps the chase eye outside a building when a ride starts beside its wall', () => {
    const [bankX,bankZ]=VILLAGE_SITES.bank.spot;
    const rider = at({x: bankX+6.5, y: 1.01, z: bankZ, heading: 1.52, phase: 'idle'});
    expect(insideVillageBuilding(rider.x, rider.z, .12)).toBe(false);
    expect(insideVillageBuilding(bankX, bankZ, .12)).toBe(true);
    const cam = createSkateCamera();
    cam.snap(rider);
    const envAtWall = {
      aspect: 390 / 768,
      blocked: (x: number, y: number, z: number) => y < 6 && insideVillageBuilding(x, z, .12),
    };
    let frame!: SkateCameraFrame;
    for (let i = 0; i < 120; i++) frame = cam.update(rider, [], 1 / 60, envAtWall);
    expect(insideVillageBuilding(frame.position[0], frame.position[2], .12)).toBe(false);
    expect(frame.fov).toBeGreaterThan(70); // the wall pulled the eye in; keep the full rider framed
    expect(inView(frame, [rider.x, rider.y + 0.7, rider.z], 390 / 768)).toBe(true);
    expect(projectToView(frame, [rider.x, rider.y + 1.18, rider.z], 390 / 768)![1]).toBeGreaterThan(.14);
  });
  it('settles low behind the direction of travel, widening with speed', () => {
    const cam = createSkateCamera();
    let f!: SkateCameraFrame, z = 0;
    for (let i = 0; i < 600; i++) { z += 8 / 60; f = cam.update(at({z, vz: 8}), [], 1 / 60, env); }
    expect(finite(f)).toBe(true);
    expect(f.position[2]).toBeLessThan(z - 2); // behind
    expect(Math.abs(f.position[0])).toBeLessThan(1e-6); // straight behind
    expect(f.position[1]).toBeGreaterThan(0.5); expect(f.position[1]).toBeLessThan(2.5); // low
    expect(f.target[2]).toBeGreaterThan(z); // looks ahead along velocity
    const fast = f.fov, before = copy(f);
    const next = cam.update(at({z: z + 8 / 60, vz: 8}), [], 1 / 60, env);
    expect(next.position[2] - before.position[2]!).toBeCloseTo(8 / 60, 2); // settled: moves with the rider, no drift
    const slow = createSkateCamera();
    let g!: SkateCameraFrame; for (let i = 0; i < 300; i++) g = slow.update(at({vz: 0.5}), [], 1 / 60, env);
    expect(g.fov).toBeGreaterThanOrEqual(53.9); expect(fast).toBeGreaterThan(g.fov + 8); expect(fast).toBeLessThanOrEqual(75.1);
  });

  it('never produces NaN, even from a broken present', () => {
    const cam = createSkateCamera();
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const phases: SkatePresent['phase'][] = ['roll', 'air', 'grind', 'manual', 'powerslide', 'bail', 'recover', 'idle'];
    for (let i = 0; i < 2000; i++) {
      const bad = i % 97 === 0;
      const p = at({x: rnd() * 50, y: rnd() * 3, z: rnd() * 50, vx: bad ? NaN : rnd() * 12, vy: rnd() * 6, vz: bad ? Infinity : rnd() * 12,
        phase: phases[i % phases.length]!, clearance: Math.abs(rnd()), carve: rnd(), grind: i % 8 === 2 ? {grindId: '50-50', grindableId: 'r', faceSign: -1} : null});
      const ev: SkateSimEvent[] = i % 50 === 0 ? [{t: i, kind: 'land', spinDeg: 0, boardClean: 1, fakie: false, switch: false, airTime: 0.8, gap: 2, onFeature: null, revert: false}] : [];
      const f = cam.update(p, ev, [0, 1 / 30, 1 / 144, 0.5, NaN][i % 5]!, {aspect: i % 3 ? 0.5 : 2, reducedMotion: i % 2 === 0, blocked: i % 4 ? undefined : () => i % 8 === 0});
      expect(finite(f)).toBe(true);
    }
  });

  it('rolling fakie does not swing the camera round (it follows travel, not the nose)', () => {
    const a = createSkateCamera(), b = createSkateCamera();
    let z = 0, fa!: SkateCameraFrame, fb!: SkateCameraFrame;
    for (let i = 0; i < 300; i++) {
      z += 5 / 60;
      fa = a.update(at({z, vz: 5}), [], 1 / 60, env);
      // Same travel, but the board nose points backwards (fakie) from halfway.
      fb = b.update(at({z, vz: 5, boardYaw: i > 150 ? Math.PI : 0, fakie: i > 150, heading: 0}), [], 1 / 60, env);
    }
    for (let k = 0; k < 3; k++) { expect(fb.position[k]).toBeCloseTo(fa.position[k]!, 6); expect(fb.target[k]).toBeCloseTo(fa.target[k]!, 6); }
    expect(fb.position[2]).toBeLessThan(z);
  });

  it('keeps the rider and the predicted landing in frame through an air', () => {
    const g = 14, cam = createSkateCamera({gravity: g});
    let z = 0, f!: SkateCameraFrame;
    for (let i = 0; i < 240; i++) { z += 7 / 60; f = cam.update(at({z, vz: 7}), [], 1 / 60, env); }
    // Pop: ballistic from ground level.
    let y = 0, vy = 5.2; const dt = 1 / 60;
    const tLand = 2 * 5.2 / g, landingZ = z + 7 * tLand;
    const events: SkateSimEvent[] = [{t: 0, kind: 'pop', from: 'tail', switch: false, fakie: false, height: 1, flipId: 'kickflip', fromFeature: null}];
    let t = 0;
    while (true) {
      t += dt; y += vy * dt - g * dt * dt / 2; vy -= g * dt; z += 7 * dt;
      if (y <= 0) break;
      f = cam.update(at({z, y, vz: 7, vy, phase: 'air', clearance: y, airTime: t}), t < dt * 1.5 ? events : [], dt, env);
      expect(inView(f, [0, y + 0.6, z])).toBe(true);
      expect(inView(f, [0, 0, landingZ])).toBe(true);
      // Target sits above the landing surface and not past the landing point.
      expect(f.target[1]).toBeGreaterThanOrEqual(0);
      expect(f.target[2]).toBeLessThanOrEqual(landingZ + 1e-6);
      expect(cam.mode()).toBe('air');
    }
  });

  it('goes side-on for a vert launch and comes back behind the new direction', () => {
    const cam = createSkateCamera();
    let f!: SkateCameraFrame, z = 0;
    for (let i = 0; i < 240; i++) { z += 6 / 60; f = cam.update(at({z, vz: 6}), [], 1 / 60, env); }
    // Up the quarterpipe: straight up, barely any horizontal speed.
    let y = 1.8, vy = 6; const g = 14, dt = 1 / 60;
    for (let i = 0; i < 50; i++) { y += vy * dt; vy -= g * dt; f = cam.update(at({z, y, vy, vz: 0.2, phase: 'air', clearance: y - 1.8, heading: 0}), [], dt, env); }
    expect(cam.mode()).toBe('vert');
    const sideAngle = Math.abs(Math.atan2(f.position[0] - z * 0, f.position[2] - z));
    expect(Math.abs(f.position[0])).toBeGreaterThan(0.5); // swung round to the side
    expect(sideAngle).toBeGreaterThan(0.3);
    // Back down fakie: travelling −z now.
    for (let i = 0; i < 360; i++) { z -= 6 / 60; f = cam.update(at({z, vz: -6, fakie: true, boardYaw: 0}), [], 1 / 60, env); }
    expect(f.position[2]).toBeGreaterThan(z + 1.5); // behind the new travel direction
  });

  it('drifts to the side on a grind and sits lower in a manual', () => {
    const roll = createSkateCamera(), grind = createSkateCamera(), manual = createSkateCamera();
    let a!: SkateCameraFrame, b!: SkateCameraFrame, c!: SkateCameraFrame, z = 0;
    for (let i = 0; i < 400; i++) {
      z += 4 / 60;
      a = roll.update(at({z, vz: 4}), [], 1 / 60, env);
      b = grind.update(at({z, vz: 4, phase: 'grind', grind: {grindId: '50-50', grindableId: 'r', faceSign: 1}}), [], 1 / 60, env);
      c = manual.update(at({z, vz: 4, phase: 'manual', manual: 'manual'}), [], 1 / 60, env);
    }
    expect(Math.abs(b.position[0])).toBeGreaterThan(0.4);
    expect(c.position[1]).toBeLessThan(a.position[1] - 0.1);
  });

  it('slows down and orbits gently around a bail, then snaps on respawn', () => {
    const cam = createSkateCamera();
    let f!: SkateCameraFrame, z = 0;
    for (let i = 0; i < 240; i++) { z += 6 / 60; f = cam.update(at({z, vz: 6}), [], 1 / 60, env); }
    const before = Math.atan2(f.position[0] - 0, f.position[2] - z);
    f = cam.update(at({z, vz: 3, phase: 'bail', bail: {t: 0, reason: 'balance', dirX: 0, dirZ: 1}}), [{t: 0, kind: 'bail', reason: 'balance'}], 1 / 60, env);
    for (let i = 0; i < 180; i++) f = cam.update(at({z, phase: 'bail'}), [], 1 / 60, env);
    expect(cam.mode()).toBe('bail');
    expect(inView(f, [0, 0.3, z])).toBe(true);
    const after = Math.atan2(f.position[0], f.position[2] - z);
    expect(Math.abs(after - before)).toBeGreaterThan(0.1); // it moved round
    // Respawn somewhere else: a cut, no easing.
    cam.snap(at({x: 40, z: -10, vx: 0, vz: 0, heading: Math.PI / 2}));
    const s = cam.frame();
    expect(Math.hypot(s.target[0] - 40, s.target[2] + 10)).toBeLessThan(0.1);
    expect(s.position[0]).toBeLessThan(40 - 2); // behind a +x heading
  });

  it('pulls in instead of clipping behind a solid wall', () => {
    const cam = createSkateCamera();
    const wall = (_x: number, _y: number, z: number) => z < -1.2;
    let f!: SkateCameraFrame;
    for (let i = 0; i < 200; i++) f = cam.update(at({vz: 0.8}), [], 1 / 60, {...env, blocked: wall});
    expect(f.position[2]).toBeGreaterThanOrEqual(-1.25);
    const open = createSkateCamera();
    let g!: SkateCameraFrame; for (let i = 0; i < 200; i++) g = open.update(at({vz: 0.8}), [], 1 / 60, env);
    expect(g.position[2]).toBeLessThan(-2);
  });

  it('is frame-rate independent', () => {
    const run = (hz: number) => {
      const cam = createSkateCamera(); const dt = 1 / hz; let f!: SkateCameraFrame;
      for (let t = 0; t < 3 - 1e-9; t += dt) {
        const T = t + dt, turn = Math.min(1, T / 1.5) * 1.2, v = 3 + T * 2;
        f = cam.update(at({x: Math.sin(turn) * T * 3, z: Math.cos(turn) * T * 3, vx: Math.sin(turn) * v, vz: Math.cos(turn) * v, carve: T > 1 ? 0.5 : 0}), [], dt, env);
      }
      return copy(f);
    };
    const a = run(30), b = run(60), c = run(144);
    for (let k = 0; k < 3; k++) { expect(Math.abs(a.position[k]! - c.position[k]!)).toBeLessThan(0.08); expect(Math.abs(b.position[k]! - c.position[k]!)).toBeLessThan(0.04); }
    expect(Math.abs(a.fov - c.fov)).toBeLessThan(0.5);
  });

  it('honours reduced motion: no FOV kick, no roll', () => {
    const cam = createSkateCamera(); const r = {aspect: 16 / 9, reducedMotion: true};
    let f!: SkateCameraFrame; const fovs: number[] = [];
    for (let i = 0; i < 400; i++) { f = cam.update(at({vz: 1 + i * 0.03, carve: 1, phase: 'roll'}), i === 200 ? [{t: 0, kind: 'land', spinDeg: 0, boardClean: 1, fakie: false, switch: false, airTime: 1.4, gap: 3, onFeature: null, revert: false}] : [], 1 / 60, r); fovs.push(f.fov); }
    expect(f.roll).toBe(0);
    expect(Math.max(...fovs) - Math.min(...fovs)).toBeLessThan(0.01);
    const lively = createSkateCamera();
    let g!: SkateCameraFrame; for (let i = 0; i < 200; i++) g = lively.update(at({vz: 10, carve: 1}), [], 1 / 60, env);
    expect(Math.abs(g.roll)).toBeGreaterThan(0.01);
  });

  it('far distance sits further back than near', () => {
    const near = createSkateCamera({distance: 'near'}), far = createSkateCamera({distance: 'near'});
    far.setDistance('far');
    let a!: SkateCameraFrame, b!: SkateCameraFrame;
    for (let i = 0; i < 300; i++) { a = near.update(at({vz: 0.01}), [], 1 / 60, env); b = far.update(at({vz: 0.01}), [], 1 / 60, env); }
    expect(b.position[2]).toBeLessThan(a.position[2] - 0.5);
  });
});

describe('skate camera hand-back', () => {
  it('describes its frame as an orbit pose that poseEye maps back to the same eye', async () => {
    const {poseEye} = await import('../src/harbour/camera/poses.ts');
    const {skateCameraPose} = await import('../src/harbour/skate/camera/skateCamera.ts');
    const cam = createSkateCamera(); let f!: SkateCameraFrame;
    for (let i = 0; i < 120; i++) f = cam.update(at({x: 3, z: 4, vx: 2, vz: -3}), [], 1 / 60, env);
    const eye = poseEye(skateCameraPose(f));
    for (let k = 0; k < 3; k++) expect(eye[k]).toBeCloseTo(f.position[k]!, 9);
  });
});

describe('skate camera · companions and hand-back', () => {
  it('the cat waits just outside the pad, on his own side, while you skate', async () => {
    const {skateWatchPoint, WATCH_MARGIN} = await import('../src/harbour/skate/camera/companion.ts');
    const {SKATE_KEEP_OUTS, parkPoint} = await import('../src/harbour/skate/world/layout.ts');
    const pad = SKATE_KEEP_OUTS.find(r => r.id === 'skate-tideline')!;
    const [rx, rz] = parkPoint('tideline', 2, 1);
    const inside = (p: {x: number; z: number}, grow: number) => {
      // Local frame of the pad, measured the way the helper does.
      const [ox, oz] = parkPoint('tideline', 0, 0), [ax, az] = parkPoint('tideline', 1, 0), [bx, bz] = parkPoint('tideline', 0, 1);
      const l = (x: number, z: number) => [(x - ox) * (ax - ox) + (z - oz) * (az - oz), (x - ox) * (bx - ox) + (z - oz) * (bz - oz)];
      const [cx, cz] = l(pad.x, pad.z), [px, pz] = l(p.x, p.z);
      return Math.abs(px! - cx!) < pad.halfWidth + grow && Math.abs(pz! - cz!) < pad.halfDepth + grow;
    };
    for (const [lx, lz] of [[0, 0], [10, 3], [-12, -6], [30, 0], [0, -25]] as const) {
      const [cx, cz] = parkPoint('tideline', lx, lz);
      const w = skateWatchPoint({x: rx, z: rz}, {x: cx, z: cz});
      expect(inside(w, WATCH_MARGIN - 0.4)).toBe(false); // off the pad (parkPoint rounds to 1 cm, so allow a little)
      expect(inside(w, WATCH_MARGIN + 0.4)).toBe(true); // but right at its edge
    }
  });

  it('putting the board away beside a ramp hands the walking camera a heading whose eye is clear', async () => {
    const {skateWalkPose} = await import('../src/harbour/skate/camera/companion.ts');
    // A ramp rises behind the rider (−z); the chase camera was looking along +z.
    const ground = (_x: number, z: number) => (z < -0.5 ? 2.5 : 0);
    const f: SkateCameraFrame = {position: [0, 0.9, -2.4], target: [0, 0.8, 0.2], fov: 60, roll: 0};
    const pose = skateWalkPose(f, {x: 0, y: 1, z: 0}, ground, {r: 3.4, phi: 1.06, lookHeight: 0});
    const ex = Math.sin(pose.theta) * Math.sin(pose.phi) * pose.r, ez = Math.cos(pose.theta) * Math.sin(pose.phi) * pose.r;
    expect(ground(ex, ez)).toBe(0); // swung round off the ramp
    expect(pose.phi).toBeCloseTo(1.06, 6); expect(pose.r).toBe(3.4);
    // Open ground: keeps the chase camera's own side.
    const open = skateWalkPose(f, {x: 0, y: 1, z: 0}, () => 0, {r: 3.4, phi: 1.06, lookHeight: 0});
    expect(Math.abs(open.theta - Math.PI)).toBeLessThan(0.3);
  });
});
