import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import type {GroundEvent, GroundState} from '../src/harbour/horizon/movers/shared/ground/types.ts';
import {createGroundState, groundGuard} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import type {RideLogRow} from '../src/harbour/horizon/movers/shared/ground/log.ts';
import {BOARD_CAM, createBoardCamera, type BoardCameraFlags} from '../src/harbour/horizon/movers/board/camera.ts';
import {bedPath, moverInputOf, pointAt, runSituation} from '../src/harbour/horizon/movers/board/situations.ts';
import {createBoardController} from '../src/harbour/horizon/movers/board/controller.ts';

// The real baked world, loaded the way test/horizonBoardPace.test.ts loads it.
let deps: MoverDeps;
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const world = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
  const geography = createHorizonGeography(field, {...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics ?? []} as Parameters<typeof createHorizonGeography>[1]);
  deps = {world, geography, manifest: M, reducedMotion: false, calm: false, tier: 'full'};
  groundGuard.strict = true;
}, 120000);

const DT = 1 / 120;
const FULL: BoardCameraFlags = {reducedMotion: false, calm: false, tier: 'full'};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
/** A kernel state rebuilt from a ride-log row (what the camera reads: p, v, heading, lead). */
function stateOf(row: RideLogRow): GroundState {
  const st = createGroundState(row.p, row.heading);
  st.v = [...row.v]; st.lead = row.lead;
  return st;
}
/** Replays a ride log through a fresh camera, feeding each step's events. */
function replay(log: RideLogRow[], flags: BoardCameraFlags) {
  const cam = createBoardCamera((x, z) => deps.geography.ground(x, z)), out: {roll: number; yaw: number; fov: number; kick: number; eye: number[]; heading: number; travel: number; t: number; boosted: number}[] = [];
  cam.snap(stateOf(log[0]!), flags);
  let lastBoost = -Infinity;
  log.forEach((row, i) => {
    if (i === 0) return;
    const events: GroundEvent[] = (row.event ?? []).map(kind => ({kind: kind as GroundEvent['kind'], step: row.step}));
    if (events.some(e => e.kind === 'boost')) lastBoost = i * DT;
    const f = cam.update(stateOf(row), events, {dx: 0, dy: 0}, DT, flags);
    out.push({roll: f.roll, yaw: f.yaw, fov: f.fov, kick: f.kick, eye: [...f.eye], heading: row.heading + (row.lead === 1 ? 0 : Math.PI), travel: Math.atan2(row.v[0], row.v[2]), t: i * DT, boosted: i * DT - lastBoost});
  });
  return out;
}

describe('the follow camera (RIDE §10.2)', () => {
  it('never rolls: roll is 0 in every frame of an R2 replay, and the mover frame carries no roll', () => {
    const run = runSituation(deps, 'R2', {keepFrames: true});
    for (const f of replay(run.log, FULL)) expect(f.roll).toBe(0);
    for (const frame of run.frames) expect(Object.keys(frame.camera!)).toEqual(['eye', 'target', 'fov']);
  });

  it('follows the velocity, not the board: in a ~55° slide the camera looks along the travel', () => {
    // R4: S + D swings the board ~55° across a 13 m/s travel line on the Notch shelf.
    const run = runSituation(deps, 'R4', {keepFrames: true});
    const i = run.metrics.beta.reduce((best, b, k) => (Math.abs(b) > Math.abs(run.metrics.beta[best]!) ? k : best), 0);
    expect(Math.abs(run.metrics.beta[i]!)).toBeGreaterThan(50 * DEG);
    const frame = run.frames[i - 1]!.camera!, camYaw = Math.atan2(frame.target[0] - frame.eye[0], frame.target[2] - frame.eye[2]);
    const row = run.log[i]!, heading = row.heading, travel = Math.atan2(row.v[0], row.v[2]);
    expect(Math.abs(wrap(camYaw - heading))).toBeGreaterThanOrEqual(40 * DEG);
    expect(Math.abs(wrap(camYaw - travel))).toBeLessThan(15 * DEG);
  });

  it('keeps the FOV at 54 under reduced motion, calm and lite, and widens it with speed at full tier', () => {
    const run = runSituation(deps, 'R5');
    for (const flags of [{...FULL, reducedMotion: true}, {...FULL, calm: true}, {...FULL, tier: 'lite' as const}]) {
      for (const f of replay(run.log, flags)) { expect(f.fov).toBe(BOARD_CAM.fovRest); expect(f.kick).toBe(0); }
    }
    const full = replay(run.log, FULL);
    expect(Math.max(...full.map(f => f.fov))).toBeGreaterThan(BOARD_CAM.fovRest + 5);
    expect(Math.max(...full.map(f => f.fov))).toBeLessThanOrEqual(BOARD_CAM.fovFast + BOARD_CAM.kickFov);
    // And the controller's own frames honour the flags live.
    const reduced = runSituation(deps, 'R5', {keepFrames: true, flags: {reducedMotion: true}});
    for (const frame of reduced.frames) expect(frame.camera!.fov).toBe(BOARD_CAM.fovRest);
  });

  it('kicks the FOV by at most 4° and only in the 0.3 s after a boost, at full tier', () => {
    const run = runSituation(deps, 'R5');
    expect(run.metrics.events.some(e => e.kind === 'boost')).toBe(true);
    const frames = replay(run.log, FULL);
    expect(Math.max(...frames.map(f => f.kick))).toBeGreaterThan(3);
    for (const f of frames) {
      expect(f.kick).toBeLessThanOrEqual(BOARD_CAM.kickFov);
      if (f.kick > 0) expect(f.boosted).toBeLessThanOrEqual(BOARD_CAM.kickTime + DT);
    }
    const noW = runSituation(deps, 'R5', {variant: 'noW'});
    for (const f of replay(noW.log, FULL)) expect(f.kick).toBe(0);
  });

  it('keeps the eye at least 0.6 above the ground in every situation', () => {
    for (const id of ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'] as const) {
      const run = runSituation(deps, id, {keepFrames: true});
      for (const frame of run.frames) {
        const [x, y, z] = frame.camera!.eye;
        expect(y, id).toBeGreaterThanOrEqual(deps.geography.ground(x, z) + BOARD_CAM.groundClearance - 1e-9);
      }
    }
  });

  it('pulls the eye in, not up, inside S4\'s Dune Culvert: the rider stays in sight under the dune (review R2-08)', () => {
    // 966–972 m: inside the culvert where it clears a rider (≥ 1.7 m). The ground clamp alone put the eye 0.6 above
    // the dune, with the dune between it and the rider.
    const s4 = bedPath(deps.world.beds.find(b => b.id === 'S4')!), board = createBoardController(deps);
    for (const d of [966, 968, 972]) {
      const p = pointAt(s4, d);
      board.place({x: p.x, z: p.z, y: p.y, heading: p.heading, speed: 3});
      const {eye, target} = board.update(DT, moverInputOf({}), 0).camera!;
      expect(eye[1], `${d} m: under the dune`).toBeLessThan(deps.geography.ground(eye[0], eye[2]));
      expect(deps.geography.cameraBlocked([target[0], target[1], target[2]], [eye[0], eye[1], eye[2]]), `${d} m: in sight`).toBe(false);
    }
  });

  it('springs free look back behind the rider over ~1.5 s', () => {
    const run = runSituation(deps, 'R2');
    const cam = createBoardCamera((x, z) => deps.geography.ground(x, z)), st = stateOf(run.log[0]!);
    const settled = cam.snap(st, FULL).yaw;
    cam.update(st, [], {dx: 1, dy: 0}, DT, FULL);
    const turned = cam.frame();
    const offset0 = Math.abs(wrap(Math.atan2(turned.target[0] - turned.eye[0], turned.target[2] - turned.eye[2]) - settled));
    expect(offset0).toBeGreaterThan(0.9);
    for (let t = 0; t < 1.5; t += DT) cam.update(st, [], {dx: 0, dy: 0}, DT, FULL);
    const back = cam.frame(), offset = Math.abs(wrap(Math.atan2(back.target[0] - back.eye[0], back.target[2] - back.eye[2]) - settled));
    expect(offset).toBeLessThan(0.1);
  });
});
