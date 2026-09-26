import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {env} from 'node:process';
import {beforeAll, describe, expect, it} from 'vitest';
import {parseHorizonDefinition} from '../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest.ts';
import type {MoverDeps} from '../src/harbour/horizon/movers/shared/registry.ts';
import {groundGuard} from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import {bedPath, lineLegSteps, type LineId, type LineLegs} from '../src/harbour/horizon/movers/board/situations.ts';

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
/** Each line's run, kept for the tests below that report on it (never read back from a file: review R2-13). */
const runs = new Map<LineId, LineLegs>();

/**
 * Rides a line leg by leg, handing the event loop back between legs: a whole line is up to a minute of synchronous
 * kernel stepping since the wheel footprint (kernel fix round 2), and a worker blocked that long misses vitest's RPC.
 */
async function rideLine(id: LineId): Promise<LineLegs> {
  const legs = lineLegSteps(deps, id);
  for (;;) {
    const next = legs.next();
    if (next.done) return next.value;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/** Rounds positions and velocities for the evidence file (1e-7: the replay's 1e-6 identity still holds); inputs stay exact. */
const round = (key: string, value: unknown) => (typeof value === 'number' && key !== 'steer' && key !== 'crouch' ? Math.round(value * 1e7) / 1e7 : value);
function evidence(id: LineId, run: LineLegs, rows: boolean): void {
  if (!WRITE_EVIDENCE) return;
  mkdirSync('evidence/rides', {recursive: true});
  const payload = {
    line: id, completed: run.completed, time_s: run.time, legs: run.legs.length,
    note: 'Headless line rider (situations.ts runLine). Legs restart past land defects (stops); time sums the moving legs only.',
    stops: run.stops,
    rides: run.legs.map(l => ({reason: l.reason, time: l.time, distance: l.distance, ...(rows ? {log: l.log} : {start: l.log[0], end: l.log[l.log.length - 1]})})),
  };
  writeFileSync(`evidence/rides/board_${id}.json`, JSON.stringify(payload, round));
}

/**
 * S1–S4 start → end (RIDE §12 horizonSkateLines). The baked geometry (horizon-geo-1) has land defects on every
 * line — retaining walls across S1's switchbacks, deck wedge gaps at bends, crossing pads raised above the deck,
 * S2's bridge lane under the Bight, deck/bridge junctions — listed with coordinates in HANDOFF-notes/board.md.
 * The rider carries the board past each one (a leg per defect) and the test holds it to: every stop is a land
 * defect the classifier can name (never the rider's own mistake), the rider is on the bed everywhere else, and
 * the line is covered start to end.
 */
describe('the headless rider rides S1–S4 (RIDE §12)', () => {
  for (const id of ['S1', 'S2', 'S3', 'S4'] as LineId[]) {
    it(`${id} start → end`, async () => {
      const run = await rideLine(id);
      runs.set(id, run);
      evidence(id, run, id === 'S1');
      expect(run.completed).toBe(true);
      expect(run.stops.filter(s => s.kind === 'rider')).toEqual([]);
      run.legs.forEach((leg, i) => {
        const stop = run.stops[i];
        // Off the bed or a bail only where a leg ended at a land defect.
        if (!stop) {
          expect(leg.log.every(r => r.pace !== 'offbed'), `${id} leg ${i} (the last)`).toBe(true);
          expect(leg.bails, `${id} leg ${i}`).toBe(0);
        } else {
          expect(stop.kind, `${id} leg ${i}`).not.toBe('rider');
          expect(leg.bails, `${id} leg ${i}`).toBeLessThanOrEqual(1);
        }
      });
      // Covered: the last leg reaches the end of the bed.
      const path = bedPath(deps.world.beds.find(b => b.id === id)!), last = run.legs[run.legs.length - 1]!;
      expect(last.completed ? last.distance : run.stops[run.stops.length - 1]!.d).toBeGreaterThan(path.length - 6);
    }, 240000);
  }

  // The land defects that stop the S1 end-to-end ride today (horizon-geo-1, fix round 2, on the kernel's wheel footprint;
  // plan metres along S1 as the rider meets them; `step` = a lip or deck wedge gap the kernel stops at, `wall` = a solid
  // across the deck). Not land: 166 m was a 1–2 cm slab seam (review R2-05/R2-07); the footprint rolls over it. The
  // open wedge gaps at 188, 197 and 421 m no longer stop the rider (the board flies them now) but are still land defects.
  it.todo('S1 end to end with no land-defect stop — waits on the land track to clear: ' + [
    '493, 498, 522, 535, 559 m wall S1.retaining.lakeside@lakeside', '531 m step S1.surface.2.lakeside@lakeside (deck wedge gap)',
    '601, 607, 613, 618, 624 m wall S1.retaining.lakeside@lakeside', '792 m wall S1.retaining.lakeside@lakeside',
    '807, 821 m wall S1.retaining.notch@lakeside', '841 m wall apronBridge.rails@lakeside', '846 m wall dam.apron@lakeside',
    '879 m wall apronBridge.rails@notch', '1007, 1024 m wall S1.retaining.notch@notch', '1123, 1168 m step (terrain over the deck)',
    '1186 m wall yearWalk.retaining.reach@reach',
  ].join('; '));
  it.todo('S2–S4 end to end with no land-defect stop — waits on the land track (the stops are in evidence/rides/board_S2…S4.json and HANDOFF-notes/board.md)');

  it('S1\'s moving time is reported against the manifest target (P24: reported, not failed; D44: no retarget)', async () => {
    // The time of this run's own S1 ride (the S1 test above; ridden here when this test runs alone).
    const run = runs.get('S1') ?? await rideLine('S1');
    const built = bedPath(deps.world.beds.find(b => b.id === 'S1')!).length, [lo, hi] = M.skate.S1.time_target_s as [number, number];
    // time_target_s [70, 130] was set for the drawn 971 m; the land pass built S1 longer. D44 is Jonathan's decision:
    // the time is reported against the manifest's own target, never a rescaled one, and a miss is reported, not failed.
    const note = `S1 moving time ${run.time.toFixed(1)} s over the built ${built.toFixed(0)} m (drawn ${M.skate.S1.length_m} m, ${run.legs.length} legs across land defects): `
      + (run.time > hi ? `misses the manifest target [${lo}, ${hi}] s by ${(run.time - hi).toFixed(1)} s (D44, Jonathan's decision)`
        : run.time < lo ? `under the manifest target [${lo}, ${hi}] s by ${(lo - run.time).toFixed(1)} s` : `inside the manifest target [${lo}, ${hi}] s`);
    console.info(note);
    expect(Number.isFinite(run.time) && run.time > 0, note).toBe(true);
    expect(run.legs.every(l => l.log.length > 0), note).toBe(true);
  }, 240000);
});
