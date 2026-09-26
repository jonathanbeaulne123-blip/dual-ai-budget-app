import { expect, it } from 'vitest';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { buildLandCuts } from '../src/harbour/horizon/land/beds/build';
import { padOutline,pointInPolygon } from '../src/harbour/horizon/world/geometry';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { maxGrade, nearestOnPath } from '../src/harbour/horizon/land/structures/mesh';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { buildPathGraph, walkPlan } from '../src/harbour/horizon/world/pathGraph';
import { buildCrossings } from '../src/harbour/horizon/world/crossings';
import { resolveComputedCrossings } from '../src/harbour/horizon/land/beds/junctions';

it('leaves all seven physical doorways open and connects their aprons to public paths',()=>{
  const cuts=buildLandCuts(baseHeight);resolveComputedCrossings(cuts,buildCrossings(cuts).proofs,baseHeight);const graph=buildPathGraph(cuts);
  const garden=cuts.beds.find(b=>b.id==='walk garden')!;expect(nearestOnPath([903,640],garden.points).at[1]).toBeCloseTo(36,1);
  for(const solid of cuts.solids){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(solid.positions,3));g.setIndex(solid.indices);const mesh=new Mesh(g,new MeshBasicMaterial());mesh.updateMatrixWorld();expect(new Raycaster(new Vector3(1455,12.15,1175),new Vector3(0,1,0),0,1.2).intersectObject(mesh),`${solid.id} blocks the square spawn`).toHaveLength(0);g.dispose();(mesh.material as MeshBasicMaterial).dispose();}
  for(const host of M.hosts){const p=cuts.pads.find(p=>p.id===`host.${host.id}`)!,door=p.door!,approach=cuts.beds.find(b=>b.id===p.serviceBedId)!;
    expect(nearestOnPath([door[0],door[2]],approach.points).distance).toBeLessThan(.01);expect(maxGrade(approach.points)).toBeLessThanOrEqual(.08001);
    const body=cuts.solids.find(s=>s.id===`host.${host.id}.walls`)!;const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(body.positions,3));g.setIndex(body.indices);const mesh=new Mesh(g,new MeshBasicMaterial());mesh.updateMatrixWorld();
    const normal=new Vector3(door[0]-host.xy[0]!,0,door[2]-host.xy[1]!).normalize(),origin=new Vector3(door[0],door[1]+1.25,door[2]).addScaledVector(normal,2);
    expect(new Raycaster(origin,normal.clone().negate(),0,3).intersectObject(mesh)).toHaveLength(0);
    const journey=walkPlan(graph,[1455,12,1175],door,{stepFree:true,maxSnap:1});expect(journey,host.id).not.toBeNull();expect(journey!.offBedDistance).toBeLessThan(.01);
  }
},60000);

it('keeps the Year Walk outside the rotated Library foundation and avoids a needless Glasshouse climb',()=>{
 const cuts=buildLandCuts(baseHeight),pad=cuts.pads.find(p=>p.id==='host.library')!,foundation=cuts.solids.find(s=>s.id==='host.library.slab')!,outline=padOutline(pad);
 const xs=foundation.positions.filter((_,i)=>i%3===0);expect(Math.min(...xs)).toBeCloseTo(Math.min(...outline.map(p=>p[0])),6);
 const year=cuts.beds.find(b=>b.id==='yearWalk')!;expect(year.points.some(p=>pointInPolygon(p[0],p[2],outline))).toBe(false);
 const cottage=padOutline(cuts.pads.find(p=>p.id==='host.cottage')!);expect(year.points.some(p=>pointInPolygon(p[0],p[2],cottage))).toBe(false);
 const glass=cuts.beds.find(b=>b.id==='host.glasshouse.approach')!;expect(Math.abs(glass.points[0]![1]-56)).toBeLessThan(3);
 expect(maxGrade(glass.points)).toBeLessThanOrEqual(.08001);
 expect(glass.points.some(p=>p[0]>995&&p[0]<1025&&p[2]>781&&p[2]<799)).toBe(false);
 expect(nearestOnPath([1010,810],glass.points).at[1]).toBeCloseTo(56);
});
