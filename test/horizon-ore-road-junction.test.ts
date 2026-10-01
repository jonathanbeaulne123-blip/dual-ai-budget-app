import {describe,expect,it} from 'vitest';
import {HORIZON_MANIFEST as M} from '../src/harbour/horizon/world/manifest';
import {mountainV2Road} from '../src/harbour/horizon/land/mountainV2/beds';
import {mountainRoadSource,mountainJoinRoadTop} from '../src/harbour/horizon/land/mountainV2/roadSource';
import {buildUnderground} from '../src/harbour/horizon/land/underground/build';
import {oreCrossingTop,orePortalFrame,orePortalLintelRise,oreRoadGroundCeiling} from '../src/harbour/horizon/land/underground/oreRoad';
import {baseHeight,conserveBedFootprint,sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography';
import {createRegionGeography,mouthExclusion} from '../src/harbour/horizon/regions/mountainV2/geography';
import {solidTopAt,solidVerticalRangeAt} from '../src/harbour/horizon/world/geometry';
import {nearestOnPath,slab,solid} from '../src/harbour/horizon/land/structures/mesh';
import type {LandCuts,TerrainField,XYZ} from '../src/harbour/horizon/land/interfaces';

// The underground builder only: no full land solve, world bake or browser.
const cuts:LandCuts={beds:[mountainV2Road()],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
buildUnderground(cuts,baseHeight);
const ore=cuts.beds.find(b=>b.id==='ORE')!,end=ore.points.at(-1)!,previous=ore.points.at(-2)!;
const length=Math.hypot(end[0]-previous[0],end[2]-previous[2]),u=[(end[0]-previous[0])/length,(end[2]-previous[2])/length] as const,n=[-u[1],u[0]] as const;
const field:TerrainField={revision:'horizon-geo-1',width:2000,depth:2000,step:2000,columns:2,rows:2,heights:new Float32Array(4),surfaces:new Uint8Array(4)};
const geography=createHorizonGeography(field,cuts),region=createRegionGeography({horizonGround:()=>0,exclude:mouthExclusion(cuts.mouths)});geography.addDynamic(region.provider);
const point=(d:number,across=0):XYZ=>[end[0]+u[0]*d+n[0]*across,end[1]+(end[1]-previous[1])/length*d,end[2]+u[1]*d+n[1]*across];
const vertex=(positions:readonly number[],i:number):XYZ=>[positions[i*3]!,positions[i*3+1]!,positions[i*3+2]!];
const roadPoints=(()=>{
  const {samples}=mountainRoadSource(),out:XYZ[]=[];
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1]!,b=samples[i]!;if(a.at[0]!<1337||a.at[0]!>1364||Math.abs(a.at[1]!-67.5)>1.5)continue;
    for(let t=0;t<=1;t+=.25)for(const offset of [-4.8,-3.6,-2,0,2,3.6,4.8]){
      const x=a.at[0]!+(b.at[0]!-a.at[0]!)*t+(a.normal[0]!+(b.normal[0]!-a.normal[0]!)*t)*offset;
      const z=a.at[2]!+(b.at[2]!-a.at[2]!)*t+(a.normal[2]!+(b.normal[2]!-a.normal[2]!)*t)*offset;
      const y=mountainJoinRoadTop(x,z);if(y!==null)out.push([x,y,z]);
    }
  }
  return out;
})();

describe('Ore south portal physical road join',()=>{
  it('draws a closed graded crossing within the original road and approved 28m reach',()=>{
    const crossing=cuts.solids.find(s=>s.id==='oreStation.southPortal.crossing')!,edges=new Map<string,number>();
    const {points}=mountainRoadSource(),origin=nearestOnPath([end[0],end[2]],points).along;
    expect(crossing.indices.length).toBeGreaterThan(0);
    for(let i=0;i<crossing.positions.length;i+=6){
      const [x,y,z]=vertex(crossing.positions,i/3),road=mountainJoinRoadTop(x,z);
      expect(road).not.toBeNull();expect(y).toBeGreaterThanOrEqual(road!-1e-6);
      const at=nearestOnPath([x,z],points).along-origin;expect(at).toBeGreaterThanOrEqual(-18-1e-6);expect(at).toBeLessThanOrEqual(10+1e-6);
    }
    for(let i=0;i<crossing.indices.length;i+=3){
      for(let k=0;k<3;k++){const a=crossing.indices[i+k]!,b=crossing.indices[i+(k+1)%3]!,key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}
      const [a,b,c]=crossing.indices.slice(i,i+3).map(k=>vertex(crossing.positions,k)),u=[b![0]-a![0],b![1]-a![1],b![2]-a![2]],v=[c![0]-a![0],c![1]-a![1],c![2]-a![2]];
      const nx=u[1]!*v[2]!-u[2]!*v[1]!,ny=u[2]!*v[0]!-u[0]!*v[2]!,nz=u[0]!*v[1]!-u[1]!*v[0]!;
      if(ny>1e-8)expect(Math.hypot(nx,nz)/ny).toBeLessThanOrEqual(.12);
    }
    expect([...edges.values()].every(n=>n===2)).toBe(true);
    // Both old floor-lip witnesses are on the ordinary road lane; nearby physical
    // samples must now change with the ramp grade, not a vertical floor step.
    for(const [x,z]of [[1347.03,679.93],[1346.94,680.18]])for(const direction of [-1,1]){
      const y=mountainJoinRoadTop(x!,z!)!,a=geography.surface(x!,z!,y,.48)!,b=geography.surface(x!+direction*.025,z!,a.y,.48)!;
      expect(Math.abs(b.y-a.y)).toBeLessThan(.0031);
    }
    for(const d of [-2,-1,0])for(const across of [-.495,-.45,-.405,.405,.45,.495]){
      const [x,y,z]=point(d,across);if(mountainJoinRoadTop(x,z)===null)continue;
      const floor=geography.surface(x,z,y,.48)!;expect(y+.12-floor.y).toBeCloseTo(.005,5);
    }
  });
  it('keeps the old mixed apron cell from covering the explicit ramp with a steeper face',()=>{
    const x=1346.3333333333333,z=677.1666666666666,road=mountainJoinRoadTop(x,z)!,floor=geography.surface(x,z,road,.48)!;
    expect(floor.id).toBe('oreStation.southPortal.crossing');expect(floor.y).toBeCloseTo(oreCrossingTop(cuts,x,z),8);
    // Inspect actual highest faces across the road-side station edge, including
    // the former13.18% apron witness, not merely the named crossing solid.
    for(let x=1341;x<=1350;x+=.1)for(let z=676.9;z<=678;z+=.1){
      const road=mountainJoinRoadTop(x,z);if(road===null)continue;
      const floor=geography.surface(x,z,road,.48)!;expect(Math.tan(floor.slope*Math.PI/180)).toBeLessThanOrEqual(.12+1e-6);
    }
  });
  it('clears five metres above every sampled lane across the original 9.6m carriageway',()=>{
    expect(roadPoints.length).toBeGreaterThan(300);
    // The serialized source edge can lie sub-millimetres outside the runtime
    // triangle. Clearance is measured above the physical road top there, never
    // above the lower bank selected by a query just beyond that exact edge.
    for(const [x,y,z]of roadPoints){const floor=Math.max(y,geography.surface(x,z,y,.48)?.y??y);expect(geography.ceiling(x,z,floor)-floor).toBeGreaterThanOrEqual(5);}
  });
  it('retains the rail route and rail meshes, keeps the upper crossing, and clears the entire portal lintel',()=>{
    const expected=solid('ORE.rails','rail','rail','rail',['ORE'],'crown');
    for(let i=1;i<ore.points.length;i++)for(const offset of [-.45,.45])slab(expected,ore.points[i-1]!,ore.points[i]!,.09,.12,offset,.12);
    expect(cuts.solids.find(s=>s.id===expected.id)).toEqual(expected);
    expect(end).toEqual([M.underground.doors.southPortal.xy[0],67.5,M.underground.doors.southPortal.xy[1]]);
    const frame=orePortalFrame(cuts,ore.points),lintel=cuts.solids.find(s=>s.id==='southPortal.portal.frame')!;
    expect(frame.at[0]).toBeCloseTo(1348.1918433593717,8);expect(frame.at[2]).toBeCloseTo(674.1482871744854,8);
    expect(orePortalLintelRise(cuts,ore.points)).toBeCloseTo(.11018983033892948,10);
    for(let d=-.5;d<=.5;d+=.1)for(const across of [-1.7,0,1.7]){
      const x=frame.at[0]+u[0]*d+n[0]*across,z=frame.at[2]+u[1]*d+n[1]*across,y=frame.at[1]+(end[1]-previous[1])/length*d;
      const floor=geography.surface(x,z,y,.48)!;expect(solidVerticalRangeAt(lintel,x,z)!.bottom-floor.y).toBeGreaterThanOrEqual(3.2-1e-8);
    }
    for(let d=-28;d<=0;d+=.25)for(const across of [-1.7,0,1.7]){
      const [x,y,z]=point(d,across),floor=geography.surface(x,z,y,.48)!;expect(geography.ceiling(x,z,floor.y)-floor.y).toBeGreaterThanOrEqual(3.2-1e-7);
    }
    const [x,y,z]=point(-16);expect(solidVerticalRangeAt(cuts.solids.find(s=>s.id==='oreTunnel.roof')!,x,z)!.bottom-y).toBeCloseTo(3.2,8);
    expect(mountainJoinRoadTop(x,z)!-.28-y).toBeGreaterThan(5.5);
  });
  it('supports the fixed rails and draws a grounded retaining face without occupying the cart aperture',()=>{
    const retaining=cuts.solids.find(s=>s.id==='oreStation.southPortal.roadRetaining')!;
    expect(retaining.indices.length).toBeGreaterThan(0);
    const [x,y,z]=point(-.2,-.45),crossing=cuts.solids.find(s=>s.id==='oreStation.southPortal.crossing')!;expect(solidTopAt(crossing,x,z)).toBeCloseTo(y+.115,8);
    for(let i=0;i<retaining.positions.length;i+=24)for(let k=0;k<4;k++){
      const x=retaining.positions[i+k*3]!,z=retaining.positions[i+k*3+2]!;
      expect(retaining.positions[i+k*3+1]!).toBeLessThanOrEqual(baseHeight(x,z)-.25+1e-7);
      const dx=x-end[0],dz=z-end[2],along=dx*u[0]+dz*u[1],across=Math.abs(dx*n[0]+dz*n[1]);
      expect(along>2.6||across>2.6).toBe(true);
    }
  });
  it('cuts actual full and lite lattice triangles below the road only around the exposed south mouth',()=>{
    const beds=cuts.beds.filter(b=>['ORE','mountainV2.road'].includes(b.id));
    for(const step of [5,10]){
      const size=1400,count=size/step+1,f:TerrainField={revision:'horizon-geo-1',width:size,depth:size,step,columns:count,rows:count,heights:new Float32Array(count*count).fill(80),surfaces:new Uint8Array(count*count)};
      conserveBedFootprint(f,beds);for(let i=0;i<f.heights.length;i++)f.heights[i]=Math.round(f.heights[i]!*100)/100;
      for(const [x,y,z]of roadPoints)if(x>=1337&&x<=1353)expect(sampleTerrain(f,x,z)).toBeLessThanOrEqual(y-.07);
      // Lowering the road lattice must not create a new earth floor inside Ore's
      // covered envelope. The same cap clears the actual lining floor too.
      for(let d=-9;d<=0;d+=.5)for(const across of [-1.7,0,1.7]){const [x,y,z]=point(d,across);expect(sampleTerrain(f,x,z)).toBeLessThan(y-.02);}
      expect(sampleTerrain(f,1250,680)).toBe(80);
      const ceiling=oreRoadGroundCeiling(beds,step*Math.SQRT2);expect(ceiling(1353.6,640)).toBe(Infinity);
    }
  });
});
