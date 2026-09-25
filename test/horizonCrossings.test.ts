import { expect, it } from 'vitest';
import { buildCrossings, computeIntersections, type Centreline } from '../src/harbour/horizon/world/crossings.ts';
import type { LandCuts, BedCut } from '../src/harbour/horizon/land/interfaces.ts';
const line = (id: string, points: Centreline['points']): Centreline => ({ id, points, clearHeight: 4, kind: 'road', structureIds: [] });
it('finds skew, endpoint and collinear crossings without exempting the Deep shared point', () => {
  const result = computeIntersections([line('ORE', [[1200, 44, 420], [1300, 44, 420], [1400, 44, 420]]), line('DEEP_RUN', [[1300, 40, 420], [1300, 30, 500]]), line('shared', [[1250, 40, 420], [1350, 40, 420]])]);
  expect(result.filter(p => p.a === 'ORE' && p.b === 'DEEP_RUN')).toHaveLength(1);
  expect(result.find(p => p.b === 'DEEP_RUN')).toMatchObject({ at: [1300, 420], heightA: 44, heightB: 40 });
  expect(result.some(p => p.overlap)).toBe(true);
});
it('does not turn an unbuilt crossing into a passing registered resolution', () => {
  const beds: BedCut[] = ['a', 'b'].map((id, i) => ({ id, kind: 'walk', profile: 'walk', surface: 'gravel', points: i ? [[5, 0, -5], [5, 0, 5]] : [[0, 0, 0], [10, 0, 0]], width: 2, shoulder: 0, blend: 0, clearHeight: 2, maxGrade: .12, terrainCut: true, structureIds: [], districtIds: [] }));
  const cuts: LandCuts = { beds, pads: [], mouths: [], waters: [], solids: [], diagnostics: [] };
  const result = buildCrossings(cuts).proofs[0]!;
  expect(result).toMatchObject({ registered: false, proposed: true, resolution: 'threshold', built: false });
  expect(result.id).toMatch(/^[a-z][a-zA-Z0-9]+$/);
});
