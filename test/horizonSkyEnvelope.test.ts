import { expect, it } from 'vitest';
import { buildFlightEnvelope } from '../src/harbour/horizon/world/sky.ts';
import type { TerrainField, LandCuts } from '../src/harbour/horizon/land/interfaces.ts';
const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 100, columns: 21, rows: 19, heights: new Float32Array(399).fill(180), surfaces: new Uint8Array(399) };
const cuts: LandCuts = { beds: [], pads: [], mouths: [], solids: [], waters: [], diagnostics: [] };
it('builds numeric gate/lift/landing volumes while retaining failed clearance probes', () => {
  const sky = buildFlightEnvelope(field, cuts);
  expect(sky.ceiling).toBe(300); expect(sky.gates).toHaveLength(12);
  expect(sky.volumes?.filter(v => v.kind === 'gate')).toHaveLength(12);
  expect(sky.volumes?.filter(v => v.kind === 'thermal')).toHaveLength(2);
  expect(sky.volumes?.filter(v => v.kind === 'sink')).toHaveLength(2);
  expect(sky.proofs?.glide.pass).toBe(false);
  expect(sky.proofs?.glide.arrivalHeight).toBeLessThan(160);
  expect(sky.proofs?.gates.find(g => g.id === 'needle')).toMatchObject({ requestedAperture: [22, 16], clear: false });
});
