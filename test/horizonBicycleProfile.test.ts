import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import type {GroundEvent} from '../src/harbour/horizon/movers/shared/ground/types.ts';
import {groundGuard, groundSpeed, slipAngle} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {rideStart, runScript, syntheticQuery} from '../src/harbour/horizon/movers/shared/ground/synthetic.ts';
import {BICYCLE_PEDAL, BICYCLE_PROFILE} from '../src/harbour/horizon/movers/bicycle/profile.ts';
import {createBicycleController} from '../src/harbour/horizon/movers/bicycle/controller.ts';
import type {BoardController} from '../src/harbour/horizon/movers/board/controller.ts';
import {bedPath, moverInputOf, pointAt, type BedPath} from '../src/harbour/horizon/movers/board/situations.ts';

// The real baked world, loaded the way test/horizonBoardPace.test.ts loads it.
let deps: MoverDeps, bike: BoardController, v01: BedPath;
const events: GroundEvent[] = [];
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const world = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
  const geography = createHorizonGeography(field, {...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics ?? []} as Parameters<typeof createHorizonGeography>[1]);
  deps = {world, geography, manifest: M, reducedMotion: false, calm: false, tier: 'full'};
  bike = createBicycleController(deps, {onStep: (_s, _i, ev) => events.push(...ev)});
  v01 = bedPath(world.beds.find(b => b.id === 'V01')!);
  groundGuard.strict = true;
}, 120000);

const DT = 1 / 120, DEG = Math.PI / 180;
/** V01 at 930 m: a straight, level, paved stretch of the ring road. */
const onV01 = (speed: number) => { const p = pointAt(v01, 930); bike.place({x: p.x, z: p.z, y: p.y, heading: p.heading, speed}); events.length = 0; };

describe('the bicycle is a profile of the same kernel (RIDE §8.1, D45)', () => {
  it('is the bicycle controller with the bicycle column', () => {
    expect(bike.id).toBe('bicycle');
    expect(bike.profile).toBe(BICYCLE_PROFILE);
    expect(BICYCLE_PROFILE).toMatchObject({
      pop: false, beds: ['road', 'trail', 'pad'], contact: {wheelbase: 1.05, stepMax: 0.10},
      grip: {roll: 6.0, slide: 4.8, kickYaw: 0.4, twistAfter: Infinity}, steer: {radius0: 2.0, radiusV: 1.4, yawMax: 2},
      legs: {pushCap: 6.0, footBrake: 4.0, brakeSpeedMax: Infinity, boostPeak: 0},
    });
    expect(BICYCLE_PROFILE.grip.holdAngle).toBeLessThanOrEqual(20);
  });

  it('skids on V01 with S, never more than 20° of slip, whatever the stick', () => {
    for (const steer of [0, 1, -1]) {
      onV01(6);
      let worst = 0;
      for (let t = 0; t < 1.5; t += DT) { bike.update(DT, moverInputOf({slide: true, steer}), t); worst = Math.max(worst, Math.abs(slipAngle(bike.state()))); }
      expect(worst / DEG, `steer ${steer}`).toBeLessThanOrEqual(20);
      expect(worst / DEG, `steer ${steer}`).toBeGreaterThan(10);
      expect(events.map(e => e.kind), `steer ${steer}`).not.toContain('twist');
      expect(events.map(e => e.kind), `steer ${steer}`).not.toContain('bail');
    }
  });

  it('brakes at any speed: from 6 m/s, S alone decelerates at least 3.5 m/s², and stops it', () => {
    onV01(6);
    for (let t = 0; t < 0.5; t += DT) bike.update(DT, moverInputOf({slide: true}), t);
    expect((6 - groundSpeed(bike.state())) / 0.5).toBeGreaterThanOrEqual(3.5);
    for (let t = 0; t < 2; t += DT) bike.update(DT, moverInputOf({slide: true}), t);
    expect(groundSpeed(bike.state())).toBeLessThan(0.05);
  });

  it('never charges and never boosts', () => {
    onV01(6);
    let charge = 0;
    const script = [{until: 1.6, input: {slide: true, steer: -1}}, {until: 1.9, input: {steer: 1}}, {until: 2.2, input: {push: true}}, {until: 3, input: {}}];
    for (let t = 0; t < 3; t += DT) { bike.update(DT, moverInputOf(script.find(s => t < s.until)!.input), t); charge = Math.max(charge, bike.state().legs.charge); }
    expect(charge).toBe(0);
    expect(events.map(e => e.kind)).not.toContain('boost');
    expect(events.map(e => e.kind)).not.toContain('boostReady');
    // And Space does nothing on a bicycle (no pop).
    onV01(4);
    bike.update(DT, {...moverInputOf({}), jump: true}, 0); bike.update(DT, moverInputOf({}), DT);
    expect(events.map(e => e.kind)).not.toContain('airborne');
  });

  it('pedals to ~5.4 m/s on the flat and ~3 m/s up a 10 % grade', () => {
    // RIDE §8.1's pedal (2.5 m/s² from a standstill to the 6.0 cap, as (1 − s/6)^0.8) against roll 0.12 and drag:
    // 5.4 on the flat; 3.1 up 10 % (1.19 of gravity). "~4 up 10 %" would need a 3.5 m/s² pedal (HANDOFF-notes/board.md).
    for (const [grade, lo, hi] of [[0, 5.2, 5.7], [10, 2.7, 3.5]] as const) {
      const q = syntheticQuery({gradePct: grade}), st = rideStart(q, 0, 0, Math.PI, 0);   // heading π climbs a positive grade
      runScript(st, q, BICYCLE_PROFILE, () => ({push: true}), 30);
      const settled = groundSpeed(st);
      runScript(st, q, BICYCLE_PROFILE, () => ({push: true}), 5);
      expect(settled, `${grade} %`).toBeGreaterThanOrEqual(lo);
      expect(settled, `${grade} %`).toBeLessThanOrEqual(hi);
      expect(Math.abs(groundSpeed(st) - settled), `${grade} % settles`).toBeLessThan(0.1);
      expect(settled).toBeLessThan(BICYCLE_PEDAL.cap);
    }
  });

  it('rides roads, not walks or skate lines: a walk and S1 are offbed', () => {
    const p = pointAt(v01, 930);
    expect(bike.contact.sample(p.x, p.z, p.y + 0.1)).toMatchObject({legal: true, bedId: 'V01'});
    const s1 = bedPath(deps.world.beds.find(b => b.id === 'S1')!), q = pointAt(s1, 60);
    expect(bike.contact.sample(q.x, q.z, q.y + 0.1)).toMatchObject({legal: false, pace: 'offbed', bedId: 'S1'});
    const walk = bedPath(deps.world.beds.find(b => b.kind === 'walk')!);
    let checked = 0;
    for (let d = 5; d < walk.length && checked < 3; d += 7) {
      const w = pointAt(walk, d), hit = bike.contact.bedAt(w.x, w.z, w.y);
      if (bike.contact.padAt(w.x, w.z, w.y) || (hit && hit.kind !== 'walk')) continue;
      expect(bike.contact.sample(w.x, w.z, w.y + 0.1), `${walk.bed.id} at ${d}`).toMatchObject({legal: false, pace: 'offbed'});
      checked++;
    }
    expect(checked).toBe(3);
  });
});
