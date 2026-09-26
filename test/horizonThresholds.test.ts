import { expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { bed, emitBedGeometry } from '../src/harbour/horizon/land/beds/profiles';
import { resolveComputedCrossings } from '../src/harbour/horizon/land/beds/junctions';
import { maxGrade, nearestOnPath } from '../src/harbour/horizon/land/structures/mesh';
import type { LandCuts } from '../src/harbour/horizon/land/interfaces';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';

it('gives every manifest threshold and at-grade crossing a graded pad and visible marker',()=>{
  const cuts=buildLandCuts(baseHeight);
  for(const row of M.thresholds){expect(cuts.pads.some(p=>p.id===`threshold.${row.id}`||p.id.startsWith(`threshold.${row.id}.`))).toBe(true);expect(row.modes.length).toBeGreaterThan(0);}
  M.crossings.forEach((c,i)=>{if(c.resolution==='threshold'&&(Array.isArray(c.at)||c.at.includes('465,700'))){expect(cuts.pads.find(p=>p.id===`crossing.${i}`)).toBeDefined();expect(cuts.solids.find(s=>s.id===`crossing.${i}.marker`)!.role).toBe('marker');}});
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
