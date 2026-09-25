import { expect, it } from 'vitest';
import { buildViews, projectSubject } from '../src/harbour/horizon/world/views.ts';
import { HORIZON_MANIFEST } from '../src/harbour/horizon/world/manifest.ts';
import type { LandCuts, TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 100, columns: 21, rows: 19, heights: new Float32Array(399).fill(10), surfaces: new Uint8Array(399) };
const cuts: LandCuts = { beds: [], pads: [], mouths: [], solids: [], waters: [], diagnostics: [] };
it('keeps twelve immutable camera xy/FOV/radii and the specified flight eye height', () => {
  const views = buildViews(field, cuts); expect(views).toHaveLength(12);
  for (const v of views) { const m = HORIZON_MANIFEST.views.find(p => p.id === v.id)!; expect([v.eye[0], v.eye[2]]).toEqual(m.xy); expect([v.target[0], v.target[2]]).toEqual(m.target); expect(v.fovDegrees).toBe(m.fov_deg); expect(v.radius).toBe(m.radius_eu); expect(v.eye[1]).toBeCloseTo(v.id === 'J' ? 60 : v.floor! + 1.6); }
});
it('projects forward subjects and exposes a missing or out-of-frame subject as failure', () => {
  expect(projectSubject([0, 0, 0], [0, 0, -10], [0, 0, -20], 55).ndc).toEqual([0, 0]);
  expect(Math.abs(projectSubject([0, 0, 0], [0, 0, -10], [100, 0, -20], 55).ndc[0])).toBeGreaterThan(1);
  const views = buildViews(field, cuts); expect(views.find(v => v.id === 'J')?.proof?.horizonInFrame).toBe(false);
  expect(views.find(v => v.id === 'C')?.proof?.pass).toBe(false);
});
