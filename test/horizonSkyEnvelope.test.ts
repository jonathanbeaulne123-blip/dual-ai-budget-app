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
  expect(sky.volumes?.find(v=>v.id==='needle')?.yaw).toBe(Math.PI/2);
});
it('defines Harbour landing on the actual sea beside the floatplane dock and measures its wet footprint',()=>{
  const sea={id:'water.sea',kind:'sea' as const,outline:[[0,0],[2000,0],[2000,1800],[0,1800]] as const,points:[],level:0,width:0,depth:12,bank:0},waterCuts={...cuts,waters:[{...sea,outline:[...sea.outline]}]};
  const sky=buildFlightEnvelope({...field,heights:new Float32Array(399).fill(-12)},waterCuts),landing=sky.volumes!.find(v=>v.id==='water.harbour');
  expect(landing).toMatchObject({waterBodyId:'water.sea',centre:[1600,2,1275],radius:60});expect(sky.proofs!.landings.find(v=>v.id==='water.harbour')!.clear).toBe(true);
  const blocked=buildFlightEnvelope(field,waterCuts);expect(blocked.proofs!.landings.find(v=>v.id==='water.harbour')!.obstructionIds).toContain('terrain inside water landing field');
});
