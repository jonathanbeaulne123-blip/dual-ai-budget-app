// Stage A Wave 7 · R3-130 (BLOCKER): Look → Walk never stands the body in water or in the air — on the committed bake,
// all twelve pages × both tiers × calm on and off.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LandCuts, StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { createHorizonGeography, HORIZON_WALKABLE_DEGREES } from '../src/harbour/horizon/runtime/geography';
import { graphDistance, horizonWalkOut, reachableFromSquare, HORIZON_WALKOUT_DROP, HORIZON_WALKOUT_SNAP, type HorizonWalkProbe } from '../src/harbour/horizon/runtime/walkOut';
import { moverFadeMs } from '../src/harbour/horizon/runtime/moverInput';
import type { HorizonPathGraph } from '../src/harbour/horizon/world/pathGraph';

type Point3 = [number, number, number];
type World = { collision: Omit<LandCuts, 'solids' | 'diagnostics'>; geometry: { solids: StructureSolid[] }; pathGraph: HorizonPathGraph; views: { id: string; eye: Point3; target: Point3; ground?: Point3 }[] };
const world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as World;
const tiers = (['full', 'lite'] as const).map(tier => {
  const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin'), field: TerrainField = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), tier);
  return { tier, geo: createHorizonGeography(field, { ...world.collision, solids: world.geometry.solids, diagnostics: [] } as LandCuts) };
});
/** The runtime's own probe (runtime/index.ts walkProbe). */
const probeOf = (geo: ReturnType<typeof createHorizonGeography>): HorizonWalkProbe => (x, z, y) => { const at = geo.surface(x, z, y); return at && at.slope <= HORIZON_WALKABLE_DEGREES && !geo.submerged(x, z, at.y) && !geo.blocked(x, z, at.y) ? { y: at.y } : null; };
/** Look → Walk as the runtime does it: the body at the pose's eye − 1.6, then the walk-out (runtime/index.ts walkOut). */
const walkOut = (view: World['views'][number], geo: ReturnType<typeof createHorizonGeography>) => horizonWalkOut({ eye: view.eye, target: view.target, ground: view.ground }, world.pathGraph, probeOf(geo));

describe('R3-130 · Look → Walk from every page lands dry and walkable', () => {
  for (const { tier, geo } of tiers) for (const calm of [false, true]) for (const view of world.views) it(`page ${view.id} · ${tier} · calm ${calm ? 'on' : 'off'}`, () => {
    const out = walkOut(view, geo), at = geo.surface(out.x, out.z, out.y + .1);
    expect(at, 'a floor under the body').not.toBeNull();
    expect(Math.abs(at!.y - out.y)).toBeLessThan(.05);
    expect(at!.slope).toBeLessThanOrEqual(HORIZON_WALKABLE_DEGREES);
    expect(geo.submerged(out.x, out.z, out.y), 'never a submerged body').toBe(false);
    expect(geo.blocked(out.x, out.z, out.y)).toBe(false);
    expect(graphDistance(world.pathGraph, out.x, out.y, out.z), 'within walkPlan snap distance of the path graph').toBeLessThanOrEqual(HORIZON_WALKOUT_SNAP);
    expect(HORIZON_WALKOUT_SNAP).toBe(8);
    // Standing where the eye stands (drop ≤ 1.6) or moved; a move fades (300 ms) — a cut when calm (and under reduced motion).
    if (out.how === 'stand') expect(view.eye[1] - 1.6 - out.y).toBeLessThanOrEqual(HORIZON_WALKOUT_DROP);
    else { expect(moverFadeMs(false, calm)).toBe(calm ? 0 : 300); expect(moverFadeMs(true, calm)).toBe(0); }
  });
  it('page J (v2.4: on the Prow cliff, 57.8 eu from the path) walks out to its ground on the Year Walk — never the seabed at y −12 (review 3 step 3)', () => {
    const J = world.views.find(v => v.id === 'J')!;
    // v2.2 J stood 60 eu over the sea (Walk put the body on the seabed at y −12); D-D6 / v2.4 stand it on the Prow cliff.
    expect(J.eye[1] - 1.6 - (tiers[0]!.geo.surface(J.eye[0], J.eye[2], J.eye[1])?.y ?? 0)).toBeLessThanOrEqual(HORIZON_WALKOUT_DROP);
    expect(graphDistance(world.pathGraph, J.eye[0], J.eye[1] - 1.6, J.eye[2])).toBeGreaterThan(HORIZON_WALKOUT_SNAP);
    for (const { geo } of tiers) {
      const out = walkOut(J, geo);
      expect(out.how).toBe('ground'); expect([out.x, +out.y.toFixed(1), out.z]).toEqual([1607.3, 48.5, 690.9]);
      expect(out.y).toBeGreaterThan(0);
    }
  });
  it('a standing, routable page keeps the body under its eye (E on the launch deck, v2.6); D, F, G, I, J, L go to their ground points, H to the strip under its aerial eye', () => {
    const moves = Object.fromEntries(tiers.map(({ tier, geo }) => [tier, Object.fromEntries(world.views.map(v => { const o = walkOut(v, geo); return [v.id, o.how === 'stand' ? 0 : +o.moved.toFixed(1)]; }))]));
    // Measured on candidate 6's bake (plan eu from the eye; v2.4 grounds): candidate 5 moved D 49.2, E 9.1 (off the launch deck,
    // to 156.4), I 14.7, J 232.4 (from over the sea), L 32.7 to the nearest nodes. E now stays ON the Crown launch deck (170).
    // v2.6 (D-M10): F's eye is on Mountain v2's crest promenade (the region's deck): Walk goes to its ground point, L01's bay (25.3).
    // v2.6: the Crown launch deck moved to [1322,472] (clear of v2's gondola summit terminal, D-M6), so E's eye [1317.5,170,475.5]
    // now stands on the deck itself: E stays under its eye on the deck at 170 (was 'ground', moved 6.5 onto the deck).
    const expected = { A: 0, B: 0, C: 0, D: 44.2, E: 0, F: 25.3, G: 41.2, H: 0, I: 14.7, J: 57.8, K: 0, L: 9.2 };
    for (const { geo } of tiers) { expect(walkOut(world.views.find(v => v.id === 'E')!, geo)).toMatchObject({ how: 'stand', y: 170 }); expect(walkOut(world.views.find(v => v.id === 'H')!, geo).how).toBe('ground'); }
    expect(moves).toEqual({ full: expected, lite: expected });
  });
  it('the walk-out root is the square, and the square reaches most of the graph', () => {
    const reach = reachableFromSquare(world.pathGraph);
    expect(reach.size).toBeGreaterThan(world.pathGraph.nodes.length * .5);
  });
});
