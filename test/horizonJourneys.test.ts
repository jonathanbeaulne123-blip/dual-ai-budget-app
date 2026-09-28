import { expect, it } from 'vitest';
import { buildPathGraph, walkPlan, yearWalkStretch } from '../src/harbour/horizon/world/pathGraph.ts';
import { length3 } from '../src/harbour/horizon/world/geometry.ts';
import type { BedCut, LandCuts } from '../src/harbour/horizon/land/interfaces.ts';
function cuts(beds: BedCut[]): LandCuts { return { beds, pads: [], mouths: [], waters: [], solids: [], diagnostics: [] }; }
function bed(id: string, points: BedCut['points'], kind: BedCut['kind'] = 'walk'): BedCut { return { id, kind, points, profile: 'walk', surface: 'gravel', width: 2, clearHeight: 2, maxGrade: .12, terrainCut: true, structureIds: [], districtIds: [], shoulder: 0, blend: 0 }; }
it('routes through measured intersections and keeps overhead roads disconnected', () => {
  const graph = buildPathGraph(cuts([bed('east', [[0, 0, 0], [100, 0, 0]]), bed('north', [[50, 0, 0], [50, 0, 50]]), bed('bridge', [[75, 20, -10], [75, 20, 10]])]));
  const plan = walkPlan(graph, [0, 0, 0], [50, 0, 50], { speed: 2, stepFree: true });
  expect(plan?.length).toBeCloseTo(100); expect(plan?.seconds).toBeCloseTo(50);
  expect(walkPlan(graph, [0, 0, 0], [75, 20, 10], { maxSnap: 1 })).toBeNull();
});
it('does not silently use stairs when a step-free route is requested', () => {
  const graph = buildPathGraph(cuts([bed('walk', [[0, 0, 0], [10, 0, 0]]), bed('stair', [[10, 0, 0], [20, 5, 0]], 'stair'), bed('top', [[20, 5, 0], [30, 5, 0]])]));
  expect(walkPlan(graph, [0, 0, 0], [30, 5, 0], { stepFree: true, maxSnap: 1 })).toBeNull();
  expect(walkPlan(graph, [0, 0, 0], [30, 5, 0], { stepFree: false, maxSnap: 1 })).not.toBeNull();
});
it('measures the year walk wrap without replacing it by straight-line station distances', () => {
  const points: BedCut['points'] = [[0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10], [0, 0, 0]];
  expect(length3(yearWalkStretch(points, [0, 5], [5, 0]))).toBeCloseTo(10);
});
it('builds no path edge through a wall the runtime body stops at, and joins only lips within the 0.48 eu step', () => {
  const c = cuts([bed('lane', [[0, 0, 0], [20, 0, 0], [40, 0, 0]])]);
  // A 1.2 eu wall across the lane at x 19.8-20.2.
  const p = [19.8, 20.2], z = [-3, 3], y = [0, 1.2], positions: number[] = [];
  for (const yy of y) for (const [xx, zz] of [[p[0], z[0]], [p[1], z[0]], [p[1], z[1]], [p[0], z[1]]]) positions.push(xx!, yy!, zz!);
  c.solids.push({ id: 'wall', kind: 'retainingWall', positions, indices: [0, 1, 2], surface: 'rock', districtId: 'harbour', bedIds: [], walkable: false, role: 'wall' });
  const graph = buildPathGraph(c);
  expect(graph.blocked?.some(b => b.solid === 'wall')).toBe(true);
  expect(walkPlan(graph, [0, 0, 0], [40, 0, 0], { maxSnap: 1 })).toBeNull();
  // Two beds meeting 0.49 eu apart are an edge, not a step.
  const lip = buildPathGraph(cuts([bed('a', [[0, 0, 0], [10, 0, 0]]), bed('b', [[5, .49, -5], [5, .49, 5]])]));
  expect(lip.edges.some(e => e.id.startsWith('lip:'))).toBe(false);
});
it('R3-119: joins a bed that ends on another bed\'s surface (a tee), and keeps the open run of a bed walled at one end', () => {
  // A stair whose foot lands on the side of a walk (never crossing its centreline) is one tee lip away from it.
  const tee = buildPathGraph(cuts([bed('walk', [[0, 0, 0], [40, 0, 0]]), bed('stair', [[20, 0, 1.2], [20, 6, 21.2]], 'stair')]));
  expect(tee.edges.filter(e => e.id.startsWith('tee:'))).toHaveLength(1);
  expect(walkPlan(tee, [0, 0, 0], [20, 6, 21.2], { maxSnap: 1 })).not.toBeNull();
  expect(walkPlan(tee, [0, 0, 0], [20, 6, 21.2], { stepFree: true, maxSnap: 1 })).toBeNull();
  // An end 1.2 eu above the walk is not a tee (a lip the body cannot climb).
  expect(buildPathGraph(cuts([bed('walk', [[0, 0, 0], [40, 0, 0]]), bed('high', [[20, 1.2, 1.2], [20, 1.2, 21.2]])])).edges.some(e => e.id.startsWith('tee:'))).toBe(false);
  // A two-point jetty walled at its far end keeps the run up to the wall (it used to leave the graph altogether).
  const c = cuts([bed('quay', [[0, 0, 0], [40, 0, 0]]), bed('jetty', [[20, 0, 0], [20, 0, 20]], 'boardwalk')]), positions: number[] = [];
  for (const yy of [0, 1.2]) for (const [xx, zz] of [[17, 19.8], [23, 19.8], [23, 20.4], [17, 20.4]]) positions.push(xx!, yy!, zz!);
  c.solids.push({ id: 'slab', kind: 'pad', positions, indices: [0, 1, 2], surface: 'stone', districtId: 'harbour', bedIds: [], walkable: true, role: 'wall' });
  const graph = buildPathGraph(c), jetty = graph.edges.filter(e => e.bedId === 'jetty');
  expect(jetty).toHaveLength(1); expect(jetty[0]!.length).toBeGreaterThan(19); expect(jetty[0]!.length).toBeLessThan(20);
  expect(walkPlan(graph, [0, 0, 0], [20, 0, 19], { maxSnap: 1 })).not.toBeNull();
});
