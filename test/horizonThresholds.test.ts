import { expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { bed, emitBedGeometry } from '../src/harbour/horizon/land/beds/profiles';
import { resolveComputedCrossings } from '../src/harbour/horizon/land/beds/junctions';
import { maxGrade, nearestOnPath } from '../src/harbour/horizon/land/structures/mesh';
import type { LandCuts } from '../src/harbour/horizon/land/interfaces';
import { registerRowKey } from '../src/harbour/horizon/world/crossings';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

it('gives every manifest threshold and at-grade crossing a graded pad and visible marker',()=>{
  const cuts=buildLandCuts(baseHeight);
  for(const row of M.thresholds){expect(cuts.pads.some(p=>p.id===`threshold.${row.id}`||p.id.startsWith(`threshold.${row.id}.`))).toBe(true);expect(row.modes.length).toBeGreaterThan(0);}
  M.crossings.forEach((c,i)=>{if(c.resolution==='threshold'&&(Array.isArray(c.at)||c.at.includes('465,700'))){expect(cuts.pads.find(p=>p.id===registerRowKey(i))).toBeDefined();expect(cuts.solids.find(s=>s.id===`${registerRowKey(i)}.marker`)!.role).toBe('marker');}});
},60000);

it('regrades feasible junctions within fixed endpoint limits and cuts real kerb gaps',()=>{
  const cuts:LandCuts={beds:[bed('east','road',[[-40,0,0],[0,0,0],[40,0,0]]),bed('north','road',[[0,2,-40],[0,2,0],[0,2,40]])],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  cuts.beds.forEach(b=>emitBedGeometry(b,cuts,()=>0));
  resolveComputedCrossings(cuts,[{id:'testJoin',a:'east',b:'north',at:[0,0],heightA:0,heightB:2,resolution:'threshold',requiredClearance:.5}],()=>0);
  const north=cuts.beds.find(b=>b.id==='north')!;expect(north.points[0]![1]).toBe(2);expect(north.points.at(-1)![1]).toBe(2);expect(nearestOnPath([0,0],north.points).at[1]).toBeCloseTo(0,5);expect(maxGrade(north.points)).toBeLessThanOrEqual(.12001);
  expect(cuts.pads.some(p=>p.id==='crossing.testJoin')).toBe(true);
  for(const edge of cuts.solids.filter(s=>s.kind==='kerb')){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(edge.positions,3));g.setIndex(edge.indices);const mesh=new Mesh(g,new MeshBasicMaterial());mesh.updateMatrixWorld();expect(new Raycaster(new Vector3(-6,.08,0),new Vector3(1,0,0),0,12).intersectObject(mesh)).toHaveLength(0);expect(new Raycaster(new Vector3(0,.08,-6),new Vector3(0,0,1),0,12).intersectObject(mesh)).toHaveLength(0);}
});

it('does not put a dry threshold slab into an unresolved rail and water intersection',()=>{
  const cuts:LandCuts={beds:[bed('ORE','rail',[[-10,40,0],[10,40,0]],false),bed('DEEP_RUN','cave',[[0,40,-10],[0,40,10]],false)],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  resolveComputedCrossings(cuts,[{id:'wetRail',a:'ORE',b:'DEEP_RUN',at:[0,0],heightA:40,heightB:40,resolution:'threshold',requiredClearance:.5}],()=>80);
  expect(cuts.pads).toHaveLength(0);expect(cuts.solids).toHaveLength(0);expect(cuts.diagnostics.some(d=>d.id==='junction.wetRail'&&d.severity==='conflict')).toBe(true);
});

it('keeps internal cave junctions out of the surface terrain cut',()=>{
  const cuts:LandCuts={beds:[bed('underground.west','cave',[[-10,42,0],[10,42,0]],false),bed('underground.north','cave',[[0,42,-10],[0,42,10]],false)],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  resolveComputedCrossings(cuts,[{id:'roomJoin',a:'underground.west',b:'underground.north',at:[0,0],heightA:42,heightB:42,resolution:'threshold',requiredClearance:.5}],()=>120);
  expect(cuts.pads.find(p=>p.id==='crossing.roomJoin')?.underground).toBe(true);
});

// G2 (Stage A): the junction resolver never trades a guard or a walker's grade for a pad.
import { solidVerticalRangeAt } from '../src/harbour/horizon/world/geometry';
const walk=(id:string,points:[number,number,number][])=>bed(id,'walk',points);
it('opens a junction only across the joining route\'s mouth: guards over a drop stay, no flat slab on the beds',()=>{
  // A walk on a 4 eu embankment (drop 4 both sides) with a level walk joining it at grade from +z.
  const high=walk('high',[[-40,4,0],[0,4,0],[40,4,0]]),join=walk('join',[[0,4,0],[0,4,15],[0,4,30]]);
  const cuts:LandCuts={beds:[high,join],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  cuts.beds.forEach(b=>emitBedGeometry(b,cuts,()=>0));
  resolveComputedCrossings(cuts,[{id:'tee',a:'high',b:'join',at:[0,0],heightA:4,heightB:4,resolution:'threshold',requiredClearance:.5}],()=>0);
  const pad=cuts.pads.find(p=>p.id==='crossing.tee')!;expect(pad.deck).toBe(true);expect(cuts.solids.some(s=>s.id==='crossing.tee.slab')).toBe(false);
  const rail=(x:number,z:number)=>cuts.solids.filter(s=>s.kind==='parapet'&&s.bedIds.includes('high')).some(s=>{const r=solidVerticalRangeAt(s,x,z);return !!r&&r.top>4.8;});
  const edge=high.width/2;
  expect(rail(0,edge)).toBe(false);          // the mouth where the join walks in is open
  for(const x of [4,6,8,12])expect(rail(x,edge),`guard at x=${x}`).toBe(true); // the old 8 m circle stripped these
  expect(rail(0,-edge)).toBe(true);          // the far side over the drop keeps its guard
});
it('never generates a deck across a foot route, nor turns a registered at-grade row into an over/under',()=>{
  const upper=walk('upper',[[-10,6,0],[10,6,0]]),lower=walk('lower',[[0,0,-10],[0,0,10]]); // too short to regrade to one height
  const cuts:LandCuts={beds:[upper,lower],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  cuts.beds.forEach(b=>emitBedGeometry(b,cuts,()=>0));
  resolveComputedCrossings(cuts,[{id:'feet',a:'upper',b:'lower',at:[0,0],heightA:6,heightB:0,resolution:'over',requiredClearance:2.4},{id:'registered',a:'upper',b:'lower',at:[0,0],heightA:6,heightB:0,resolution:'threshold',requiredClearance:.5}],()=>0);
  expect(cuts.solids.some(s=>s.id.endsWith('.deck'))).toBe(false);
  expect(cuts.diagnostics.find(d=>d.id==='junction.feet')?.severity).toBe('conflict');
  expect(cuts.diagnostics.find(d=>d.id==='junction.registered')?.message).toMatch(/incompatible heights/);
});
it('reports an at-grade junction on a bridge deck instead of paving it and cutting its parapets',()=>{
  const deckRoad=bed('deckRoad','road',[[-40,9,0],[40,9,0]]),lane=walk('lane',[[0,9,-3],[0,9,30]]);deckRoad.terrainExclusions=[{at:[0,0],radius:45,openSpan:true}];
  const cuts:LandCuts={beds:[deckRoad,lane],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  resolveComputedCrossings(cuts,[{id:'onDeck',a:'deckRoad',b:'lane',at:[0,0],heightA:9,heightB:9,resolution:'threshold',requiredClearance:.5}],()=>0);
  expect(cuts.pads).toHaveLength(0);expect(cuts.diagnostics.find(d=>d.id==='junction.onDeck')?.message).toMatch(/bridge deck/);
});
