import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import type {MoverInput} from '../src/harbour/horizon/movers/shared/mode.ts';
import {createBoardContact, type BoardContact} from '../src/harbour/horizon/movers/shared/ground/contact.ts';
import {BICYCLE_PROFILE} from '../src/harbour/horizon/movers/bicycle/profile.ts';
import {BICYCLE_RIDE_LABEL, createBicycleController} from '../src/harbour/horizon/movers/bicycle/controller.ts';
import {CRUISER} from '../src/harbour/horizon/movers/cruiser/tuning.ts';
import {cruiserSpeed} from '../src/harbour/horizon/movers/cruiser/sim.ts';
import {bedPath, pointAt, type BedPath} from '../src/harbour/horizon/movers/board/situations.ts';

/*
 * Rewritten 2026-10-04 (Jonathan: "incorporate the bike to go the speed of the vespa"): the bicycle is now a skin of
 * the cruiser vehicle (same sim, 32 m/s cruise, 48 m/s Shift boost; its own id, art and "Cycling" label). Removed, with reasons:
 * - "skids on V01 with S, never more than 20° of slip": the board kernel's one-sided skid no longer drives the bicycle; the
 *   cruiser sim has no skid (S brakes, grip redirects velocity), so slip is not a bicycle behaviour any more.
 * - "brakes at any speed ≥ 3.5 m/s² from 6 m/s": replaced by the cruiser brake (24 m/s²); stop distance at 48 m/s is in
 *   test/horizonCruiser.test.ts ("stops from a full 48 m/s boost within 50 m").
 * - "never charges and never boosts" and "Space does nothing": Jonathan asked for the bicycle to boost with Shift like the
 *   Vespa, and it hops like the cruiser.
 * - "pedals to ~5.4 m/s on the flat and ~3 m/s up 10 %" and the profile's pushCap 6.0: the 6 m/s pedal cap is removed.
 * Kept: the bicycle's bed-legality profile (roads, not walks or skate lines), now read through the contact layer directly.
 */
let deps: MoverDeps, contact: BoardContact, v01: BedPath;
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const world = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
  const geography = createHorizonGeography(field, {...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics ?? []} as Parameters<typeof createHorizonGeography>[1]);
  deps = {world, geography, manifest: M, reducedMotion: false, calm: false, tier: 'full'};
  contact = createBoardContact(geography, world, M, BICYCLE_PROFILE);
  v01 = bedPath(world.beds.find(b => b.id === 'V01')!);
}, 120000);

const input = (over: Partial<MoverInput>): MoverInput => ({forward: 0, steer: 0, jump: false, sprint: false, crouch: 0, accept: false, look: {dx: 0, dy: 0}, ...over});

describe('the bicycle is a skin of the cruiser vehicle (Jonathan, 2026-10-04)', () => {
  it('is the bicycle mode on the cruiser controller, with its own label', () => {
    const bike = createBicycleController(deps);
    expect(bike.id).toBe('bicycle');
    expect(BICYCLE_RIDE_LABEL).toBe('Cycling');
    expect(typeof bike.dismount).toBe('function');
    expect(typeof bike.recover).toBe('function');
    // The pedal and its 6 m/s cap are gone; the bed profile keeps no boost of its own.
    expect(BICYCLE_PROFILE.legs.boostPeak).toBe(0);
    expect(CRUISER.speed).toBe(32);
  });

  it('rides V01 past the old 6 m/s cap, grounded, and boosts with Shift', () => {
    const bike = createBicycleController(deps), p = pointAt(v01, 930);
    bike.enter({id: 'v01', thresholdId: 'v01', from: 'feet', to: 'bicycle', at: [p.x, p.y, p.z], action: 'Pick up', label: 'Pick up'}, {x: p.x, y: p.y, z: p.z, yaw: p.heading}, 0);
    bike.update(1 / 60, input({}), 0);
    let frame = bike.update(1 / 60, input({}), 0);
    for (let i = 0; i < 90; i++) frame = bike.update(1 / 60, input({forward: 1, sprint: true}), i / 60);
    const s = bike.state();
    expect(s.grounded).toBe(true);
    expect(cruiserSpeed(s)).toBeGreaterThan(12);
    expect(s.boost).toBe(1);
    expect(frame.hud.label).toBe('Boost');
  });

  it('rides roads, not walks or skate lines: a walk and S1 are offbed (bed-legality profile)', () => {
    const p = pointAt(v01, 930);
    expect(contact.sample(p.x, p.z, p.y + 0.1)).toMatchObject({legal: true, bedId: 'V01'});
    // v2.6: S1's first 60 m are v2's race course on v2's road (D-M5), where the bicycle rides mountainV2.road; the skate-only
    // check moves to S1's Horizon half (1500 m, the Notch shelf). Was: 60 m offbed on S1.
    const s1 = bedPath(deps.world.beds.find(b => b.id === 'S1')!), q = pointAt(s1, 1500);
    expect(contact.sample(q.x, q.z, q.y + 0.1)).toMatchObject({legal: false, pace: 'offbed', bedId: 'S1'});
    const walk = bedPath(deps.world.beds.find(b => b.kind === 'walk')!);
    let checked = 0;
    for (let d = 5; d < walk.length && checked < 3; d += 7) {
      const w = pointAt(walk, d), hit = contact.bedAt(w.x, w.z, w.y);
      if (contact.padAt(w.x, w.z, w.y) || (hit && hit.kind !== 'walk')) continue;
      expect(contact.sample(w.x, w.z, w.y + 0.1), `${walk.bed.id} at ${d}`).toMatchObject({legal: false, pace: 'offbed'});
      checked++;
    }
    expect(checked).toBe(3);
  });
});
