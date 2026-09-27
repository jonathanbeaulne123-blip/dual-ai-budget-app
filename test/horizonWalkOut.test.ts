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
  it('page J (eye 60 eu over the sea) walks out to a dry, reachable node — not the seabed at y −12 (review 3 step 3)', () => {
    const J = world.views.find(v => v.id === 'J')!;
    expect(J.eye[1] - 1.6 - (tiers[0]!.geo.surface(J.eye[0], J.eye[2], J.eye[1])?.y ?? 0)).toBeGreaterThan(60);
    for (const { geo } of tiers) {
      const out = walkOut(J, geo);
      expect(out.how).not.toBe('stand');
      expect(out.y).toBeGreaterThan(0);
      if (out.how === 'node') expect(reachableFromSquare(world.pathGraph).has(out.node!)).toBe(true);
    }
  });
  it('a standing, routable page keeps the body under its eye; D, E, I, L (eye > 8 eu from the graph) and J move', () => {
    const moves = Object.fromEntries(tiers.map(({ tier, geo }) => [tier, Object.fromEntries(world.views.map(v => { const o = walkOut(v, geo); return [v.id, o.how === 'stand' ? 0 : +o.moved.toFixed(1)]; }))]));
    // Measured on candidate 5's bake (plan eu from the eye): J from 60 eu over the sea to the Prow's path [1630, 56, 900.3].
    const expected = { A: 0, B: 0, C: 0, D: 49.2, E: 9.1, F: 0, G: 0, H: 0, I: 14.7, J: 232.4, K: 0, L: 32.7 };
    expect(moves).toEqual({ full: expected, lite: expected });
  });
  it('the walk-out root is the square, and the square reaches most of the graph', () => {
    const reach = reachableFromSquare(world.pathGraph);
    expect(reach.size).toBeGreaterThan(world.pathGraph.nodes.length * .5);
  });
});
