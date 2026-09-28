import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {env} from 'node:process';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import {groundGuard} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {replayRide} from '../src/harbour/horizon/movers/shared/ground/log.ts';
import {createBoardContact} from '../src/harbour/horizon/movers/shared/ground/contact.ts';
import {BOARD_PROFILE} from '../src/harbour/horizon/movers/board/profile.ts';
import {runSituation, SITUATIONS, type RideLogSink, type SituationId} from '../src/harbour/horizon/movers/board/situations.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import {createMountainV2Region} from '../src/harbour/horizon/regions/mountainV2/index.ts';

// The real baked world, loaded the way test/horizonBoardPace.test.ts loads it.
let deps: MoverDeps;
beforeAll(() => {
  const bytes = readFileSync('public/horizon/world/horizon-geo-1.json.gz'), terrain = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const world = parseHorizonDefinition(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const field = decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset, terrain.byteOffset + terrain.byteLength) as ArrayBuffer, 'full');
  const geography = createHorizonGeography(field, {...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics ?? []} as Parameters<typeof createHorizonGeography>[1]);
  // v2.6 (D-M1/D-M2): as mountHorizon does, the Mountain v2 region owns the ground and decks inside its footprint (R3 rides v2's road).
  geography.addDynamic(createMountainV2Region({horizonGround: (x, z) => sampleTerrain(field, x, z), terrainStep: field.step}).provider);
  deps = {world, geography, manifest: M, reducedMotion: false, calm: false, tier: 'full'};
  groundGuard.strict = true;
}, 120000);

/** Evidence files are written only on request (`RIDE_EVIDENCE=1`), so a plain test run never mutates evidence/ (review R2-18). */
const WRITE_EVIDENCE = env.RIDE_EVIDENCE === '1';
const sink = (name: string): RideLogSink | undefined => (WRITE_EVIDENCE ? {
  path: `evidence/rides/${name}.json`,
  write(path, text) { mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, text); },
} : undefined);

describe('the ride situations on the real beds (RIDE §9; each re-derived range says why in its check name or beside it in situations.ts)', () => {
  // v2.6: R1 is explicitly deferred (D-M5, below); was in this list.
  for (const id of ['R0', 'R2', 'R3', 'R4', 'R5'] as SituationId[]) {
    it(`${id} ${SITUATIONS[id].title}`, () => {
      const run = runSituation(deps, id, {sink: sink(`board_${id}`)});
      expect(run.failures).toEqual([]);
      // Every step on the bed, and the log replays through the kernel to 1e-6.
      expect(run.metrics.legal.every(Boolean)).toBe(true);
      const contact = createBoardContact(deps.geography, deps.world, deps.manifest, BOARD_PROFILE);
      expect(() => replayRide(run.log, contact, BOARD_PROFILE)).not.toThrow();
      if (WRITE_EVIDENCE) expect(JSON.parse(readFileSync(`evidence/rides/board_${id}.json`, 'utf8'))).toMatchObject({situation: id, checks: run.checks});
    });
  }

  // v2.6 (D-M5): S1's upper half is v2's race course, which has no fast 13–18 % drop of 120 m for RIDE §9's R1; no start on the
  // v2.6 lines passes (HANDOFF-notes/tests.md). Pinned as measured, as the D39 journeys are, until Jonathan rules (a new R1 home,
  // or R1's range re-derived for v2's paces). From v2's summit start the carve stalls at 83.7 m and leaves the 4 m bed.
  it('keeps R1 Downhill carve explicitly deferred on v2\'s course (D-M5; measured: never reaches 120 m, stalls at 83.7 m)', () => {
    const run = runSituation(deps, 'R1');
    expect(run.checks['speed at 120 m 11–13.5 (RIDE §9)']![0]).toBe(false);
    expect(run.metrics.dist.at(-1)).toBeCloseTo(83.75, 1);
    expect(run.checks['no bail']![0]).toBe(true);
  });

  it('R5 without W, and with W 0.6 s late, shows no rise', () => {
    for (const variant of ['noW', 'lateW'] as const) {
      const run = runSituation(deps, 'R5', {variant, sink: sink(`board_R5_${variant}`)});
      expect(run.failures, variant).toEqual([]);
      expect(run.metrics.events.filter(e => e.kind === 'boost'), variant).toHaveLength(0);
      expect(run.metrics.exit!.rise, variant).toBeLessThan(0.5);
    }
    const base = runSituation(deps, 'R5');
    expect(base.metrics.exit!.rise).toBeGreaterThanOrEqual(1.6);
  });
});
