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

/** Evidence files are written only on request (`RIDE_EVIDENCE=1`), so a plain test run never mutates evidence/ (review R2-18). */
const WRITE_EVIDENCE = env.RIDE_EVIDENCE === '1';
const sink = (name: string): RideLogSink | undefined => (WRITE_EVIDENCE ? {
  path: `evidence/rides/${name}.json`,
  write(path, text) { mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, text); },
} : undefined);

describe('the ride situations on the real beds (RIDE §9; each re-derived range says why in its check name or beside it in situations.ts)', () => {
  for (const id of ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'] as SituationId[]) {
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
