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
it('carries MANIFEST v1.7 flight data: polar, parachute, the Throat corridor, the Drop Zone and parachute landings',()=>{
  const sky=buildFlightEnvelope(field,cuts);
  expect(sky.gliderPolar).toEqual([[8,1.3],[9,1.05],[11,1.2],[14,1.8],[17,3]]);
  expect(sky.gliderPolar!.find(([v])=>v===sky.glider!.speed)).toEqual([11,1.2]);
  expect(sky.parachute).toEqual({forward:6,sink:3,freefallCap:30,autoPullAgl:45,minBailAgl:60,canopy:[7,3]});
  expect(sky.corridors?.throat).toMatchObject({gateId:'throat',mouth:[1300,110,300],to:[1300,42,420],waterHeight:40,slopeDegrees:30,levelLength:25,splashHeight:42,coneDegrees:25,maxBankDegrees:20,modes:['glider']});
  const mouth=sky.volumes!.find(v=>v.id==='throat')!;expect(mouth.modes).toEqual(['glider']);expect(mouth.aperture).toEqual([26,18]);
  expect(sky.dropZone).toEqual({xy:[1040,1065],height:180,rings:[5,10,25]});
  expect(sky.landings.find(l=>l.id==='green')).toMatchObject({xy:sky.dropZone!.xy});
  for(const v of sky.volumes!.filter(v=>v.kind==='landing'))expect(v.modes!.includes('parachute')).toBe(v.id!=='water.deep');
  expect(sky.volumes!.find(v=>v.id==='strip')!.modes).toEqual(['plane','glider','parachute']);
});
it('keeps the Deep glider-only when it is a real landing',()=>{
  const deep={id:'water.deep',kind:'deep' as const,outline:[[1280,400],[1320,400],[1320,440],[1280,440]] as [number,number][],points:[],level:40,width:0,depth:8,bank:0};
  const sky=buildFlightEnvelope(field,{...cuts,waters:[deep]});
  expect(sky.volumes!.find(v=>v.id==='water.deep')!.modes).toEqual(['glider']);
});
