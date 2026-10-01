import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import V2 from '../src/harbour/horizon/land/mountainV2/v2-data.json';
import {fitMountainHorizonJoins} from '../src/harbour/horizon/land/mountainV2/joins';
import {baseHeight,sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography';
import {createRegionGeography,REGION_ROAD} from '../src/harbour/horizon/regions/mountainV2/geography';
import {drawnRoadFloor} from '../src/harbour/horizon/regions/mountainV2/drawnRoadFloor';
import {addFlatPad} from '../src/harbour/horizon/land/beds/profiles';
import {box,nearestOnPath,solid} from '../src/harbour/horizon/land/structures/mesh';
import {pier} from '../src/harbour/horizon/land/structures/foundations';
import {solidTopAt} from '../src/harbour/horizon/world/geometry';
import type {LandCuts,XYZ} from '../src/harbour/horizon/land/interfaces';
const bytes=readFileSync('public/horizon/terrain/horizon-geo-1.bin');
const field=decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer);
const region=createRegionGeography({horizonGround:(x,z)=>sampleTerrain(field,x,z)});
function fixture():LandCuts{
  const cuts:LandCuts={beds:[],pads:[],solids:[],mouths:[],waters:[],diagnostics:[]};
  addFlatPad(cuts,'station.jan','station',[1364,650],73.2,[36,14]);
  addFlatPad(cuts,'threshold.skateLineStarts.1','threshold',[1325,470.5],158.2,[6,5]);
  const deck=solid('crownLaunch.slab','landing','stone','floor',['crownLaunch'],'crown');box(deck,[1322,472],170,[12,8],169.4);
  const columns=solid('crownLaunch.columns','tower','stone','support',['crownLaunch'],'crown');
  for(const x of [1316.6,1327.4])for(const z of [468.6,475.4])pier(columns,[x,z],169.4,baseHeight,[.8,.8],[1.8,1.8]);
  cuts.solids.push(deck,columns);return cuts;
}
function geography(cuts:LandCuts){const g=createHorizonGeography(field,cuts);g.addDynamic(region.provider);return g;}
const cuts=fixture(),before=geography(cuts),oldDeck=JSON.stringify(cuts.solids.find(s=>s.id==='crownLaunch.slab'));
const repaired=structuredClone(cuts);fitMountainHorizonJoins(repaired,baseHeight);const g=geography(repaired);
describe('Horizon physical joins to the carried Mountain Road',()=>{
  it('removes the real 17cm summit threshold lip without changing the native floor',()=>{
    const x=1327.96,z=471.77;
    expect(before.surface(x,z,158.04)!.y).toBeCloseTo(158.2,6);
    expect(repaired.solids.some(s=>s.id==='threshold.skateLineStarts.1.slab')).toBe(false);
    const p=g.surface(x,z,158.04)!;expect(p.id).toBe('mountainV2:mountain-road');expect(p.y).toBeCloseTo(158.0313398426693,6);
    for(const direction of [-1,1]){let previous=p;for(let d=.025;d<=1;d+=.025){const q=g.surface(x+d*direction,z+d*.385*direction,previous.y)!;expect(q).not.toBeNull();expect(Math.abs(q.y-previous.y)).toBeLessThan(.006);previous=q;}}
  });
  it('replaces January\'s exposed 75cm slab edge with drawn, closed apron geometry',()=>{
    const x=1352.93;let last=g.surface(x,656.75,73.2)!;
    for(let z=656.775;z<=657.25;z+=.025){const p=g.surface(x,z,last.y)!;expect(Math.abs(p.y-last.y)).toBeLessThan(.02);last=p;}
    const apron=repaired.solids.find(s=>s.id==='station.jan.slab')!;
    expect(apron.walkable).toBe(true);expect(apron.indices.length).toBeGreaterThan(36);
    // The top and bottom use the same plan points; every border is closed.
    for(let i=0;i<apron.positions.length;i+=6){expect(apron.positions[i]).toBe(apron.positions[i+3]);expect(apron.positions[i+2]).toBe(apron.positions[i+5]);expect(apron.positions[i+4]!).toBeLessThan(apron.positions[i+1]!);}
    const edges=new Map<string,number>();for(let i=0;i<apron.indices.length;i+=3){const t=apron.indices.slice(i,i+3);for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!,key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}}
    expect([...edges.values()].every(n=>n===2)).toBe(true);
  });
  it('keeps the connected home footway traversable both ways and stays below native road paint',()=>{
    const foot=V2.nativePlanning.walks.find(p=>p.id==='path:road:hearth~apron:home')!;
    for(const reverse of [false,true]){const points=reverse?[...foot.points].reverse():foot.points;let p=g.surface(points[0]![0]!,points[0]![2]!)!;
      for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!,n=Math.ceil(Math.hypot(b[0]!-a[0]!,b[2]!-a[2]!)/.025);
        for(let k=0;k<=n;k++){const t=k/n,q=g.surface(a[0]!+t*(b[0]!-a[0]!),a[2]!+t*(b[2]!-a[2]!),p.y)!;expect(q).not.toBeNull();expect(Math.abs(q.y-p.y)).toBeLessThan(.04);expect(q.slope).toBeLessThan(30);p=q;}}
    }
    const floor=drawnRoadFloor(REGION_ROAD.landingRows!),apron=repaired.solids.find(s=>s.id==='station.jan.slab')!;
    for(let x=1343;x<=1385;x+=.5)for(let z=640;z<=660;z+=.5){const road=floor(x-1308,z-764),top=solidTopAt(apron,x,z);if(road&&top!==null&&top!==undefined)expect(top-road.y-54).toBeLessThan(.025);}
  });
  it('keeps every Crown footing beyond road +2m with a real load path below the launch',()=>{
    const road=V2.road.samples.map(s=>s.at as unknown as XYZ),columns=repaired.solids.find(s=>s.id==='crownLaunch.columns')!;
    for(let i=0;i<columns.positions.length;i+=3){const p=columns.positions,near=nearestOnPath([p[i]!,p[i+2]!],road);expect(near.distance-V2.road.samples[near.segment]!.hw).toBeGreaterThan(2);}
    const beam=repaired.solids.find(s=>s.id==='crownLaunch.roadSpan')!,ys=beam.positions.filter((_,i)=>i%3===1);
    expect(Math.max(...ys)).toBeCloseTo(169.4,8);expect(Math.min(...ys)).toBeCloseTo(168.2,8);
    expect(beam.walkable).toBe(false);expect(beam.kind).toBe('capBeam');
    expect(JSON.stringify(repaired.solids.find(s=>s.id==='crownLaunch.slab'))).toBe(oldDeck);
  });
});
