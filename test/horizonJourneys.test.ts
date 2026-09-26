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
