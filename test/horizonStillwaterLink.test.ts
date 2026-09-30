import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BedCut, LandCuts } from '../src/harbour/horizon/land/interfaces';
import { arcLengths, pointAt } from '../src/harbour/mountain/math';
import { buildStillwaterLink, buildStillwaterProfile, STILLWATER_ROAD_ID, STILLWATER_TUNNEL_ID, STILLWATER_SECTION } from '../src/harbour/horizon/land/mountainV2/stillwater';
import { isCorridorRoad } from '../src/harbour/horizon/land/corridor/reaches';
import { detectStructureOwnership } from '../src/harbour/horizon/land/corridor/stations';
import { buildWorldLines } from '../src/harbour/horizon/world/build';
import { segmentIntersections, solidTopAt, solidVerticalRangeAt } from '../src/harbour/horizon/world/geometry';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain';
import { nearestOnPath } from '../src/harbour/horizon/land/structures/mesh';

// The published map beds omit shoulders; use the bake's collision beds so the whole
// Year Walk section participates in the junction test (5.2 m path + two 1.2 m shoulders).
const world=JSON.parse(readFileSync(new URL('../public/horizon/world/horizon-geo-1.json',import.meta.url),'utf8')) as {collision:{beds:BedCut[]}};
const bytes=readFileSync(new URL('../public/horizon/terrain/horizon-geo-1.bin',import.meta.url));
const terrain=decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer);
const ground=(x:number,z:number)=>sampleTerrain(terrain,x,z);
const fixture=():LandCuts=>({beds:structuredClone(world.collision.beds.filter(b=>b.id!==STILLWATER_ROAD_ID)),pads:[],mouths:[],solids:[],waters:[],diagnostics:[]});

describe('Stillwater mountain entrance',()=>{
  it('connects the actual mountain and Green Road, retaining every original route point with no grade over 10%',()=>{
    const cuts=fixture(),original=cuts.beds.map(b=>({id:b.id,points:structuredClone(b.points)})),profile=buildStillwaterProfile(cuts.beds);
    buildStillwaterLink(cuts,ground);
    const road=cuts.beds.find(b=>b.id===STILLWATER_ROAD_ID)!;
    expect(isCorridorRoad(road)).toBe(true);
    expect(road.points[0]).toEqual(cuts.beds.find(b=>b.id==='mountainV2.road')!.points[0]);
    expect(road.points.at(-1)).toEqual(profile.descent.at(-1));
    const s=arcLengths(road.points,true);expect(s.at(-1)).toBeGreaterThan(335);expect(s.at(-1)).toBeLessThan(350);
    for(let i=1;i<road.points.length;i++)expect(Math.abs(road.points[i]![1]-road.points[i-1]![1])/(s[i]!-s[i-1]!)).toBeLessThanOrEqual(.100001);
    for(const before of original)expect(cuts.beds.find(b=>b.id===before.id)!.points).toEqual(before.points);
    expect(buildWorldLines(cuts).find(l=>l.id===road.id)?.points).toEqual(road.points);
  });
  it('keeps the complete Year Walk section flush until it clears the road and shoulder, then passes above the tube',()=>{
    const cuts=fixture(),p=buildStillwaterProfile(cuts.beds),year=cuts.beds.find(b=>b.id==='yearWalk')!;
    let checked=0,above=0;
    for(let i=1;i<year.points.length;i++){
      const a=year.points[i-1]!,b=year.points[i]!;
      if(Math.min(a[0],b[0])<1100||Math.max(a[0],b[0])>1180||Math.min(a[2],b[2])<710||Math.max(a[2],b[2])>745)continue;
      const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),n=Math.ceil(length*2);
      for(let k=0;k<=n;k++)for(const lateral of [-year.width/2-year.shoulder,-year.width/2,0,year.width/2,year.width/2+year.shoulder]){
        const t=k/n,x=a[0]+t*dx-dz/length*lateral,z=a[2]+t*dz+dx/length*lateral,y=a[1]+t*(b[1]-a[1]),road=nearestOnPath([x,z],p.points);
        if(road.distance>STILLWATER_SECTION.road/2+STILLWATER_SECTION.shoulder)continue;
        expect(Math.abs(road.at[1]-y)).toBeLessThan(.02);checked++;
      }
    }
    expect(checked).toBeGreaterThan(30);
    for(let i=1;i<p.descent.length;i++)for(let j=1;j<year.points.length;j++)for(const hit of segmentIntersections(p.descent[i-1]!,p.descent[i]!,year.points[j-1]!,year.points[j]!)){
      const a=p.descent[i-1]!,b=p.descent[i]!,c=year.points[j-1]!,d=year.points[j]!,roadY=a[1]+hit.t*(b[1]-a[1]),walkY=c[1]+hit.u*(d[1]-c[1]);
      if(Math.abs(walkY-roadY)>1){expect(walkY-roadY).toBeGreaterThan(STILLWATER_SECTION.clear+STILLWATER_SECTION.roof+2);above++;}
    }
    expect(above).toBe(1);
  });
  it('has continuous collision floor/headroom across the tube and correctly owned portal aprons',()=>{
    const cuts=fixture(),p=buildStillwaterProfile(cuts.beds);buildStillwaterLink(cuts,ground);
    const floor=cuts.solids.find(s=>s.id===`${STILLWATER_TUNNEL_ID}.floor`)!,roof=cuts.solids.find(s=>s.id===`${STILLWATER_TUNNEL_ID}.roof`)!,apron=cuts.solids.find(s=>s.id===`${STILLWATER_TUNNEL_ID}.apron`)!;
    const arcs=arcLengths(p.tunnelPoints,true),length=arcs.at(-1)!;
    expect(length).toBeGreaterThan(103);expect(length).toBeLessThan(105);
    const stations=[...arcs.slice(1,-1),...Array.from({length:Math.floor(length)-1},(_,i)=>i+1)];
    for(const s of stations){
      const q=pointAt(p.tunnelPoints,arcs,s),a=pointAt(p.tunnelPoints,arcs,s-.25),b=pointAt(p.tunnelPoints,arcs,s+.25),dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);
      for(const lateral of [-4,0,4]){const x=q[0]-dz/len*lateral,z=q[2]+dx/len*lateral,top=solidTopAt(floor,x,z),ceiling=solidVerticalRangeAt(roof,x,z)?.bottom;
        expect(top).not.toBeNull();expect(ceiling).toBeDefined();expect(Math.abs(top!-q[1])).toBeLessThan(.02);expect(ceiling!-top!).toBeGreaterThanOrEqual(5.35);}
    }
    const road=cuts.beds.find(b=>b.id===STILLWATER_ROAD_ID)!,owned=detectStructureOwnership(cuts),mid=pointAt(p.tunnelPoints,arcs,length/2);
    expect(owned(road,mid)).toBe(STILLWATER_TUNNEL_ID);
    expect(apron.indices.length).toBeGreaterThan(0);
    expect(cuts.mouths.filter(m=>m.id.startsWith(STILLWATER_TUNNEL_ID))).toHaveLength(2);
    expect(road.terrainExclusions?.some(e=>Math.hypot(mid[0]-e.at[0],mid[2]-e.at[1])<e.radius&&!e.openSpan)).toBe(true);
  });
});
