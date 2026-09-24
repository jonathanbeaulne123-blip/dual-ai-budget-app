import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {DISTRICTS,TRANSPORT_STOPS,MOUNTAIN_ROAD,SKILL_BRANCHES,nearestOnRoute} from '../src/harbour/mountain/definition.ts';
import {STATION_SOLIDS,DISTRICT_ART_SOLIDS,DISTRICT_FIXTURES,SUMMIT_ART_SOLIDS} from '../src/harbour/mountain/artGeometry.ts';
import {WORLD_SOLIDS} from '../src/harbour/mountain/surfaces.ts';
import {buildMountainArchitecture,buildMountainCabin,buildDestinationSilhouette} from '../src/harbour/mountain/architecture.ts';
import {buildDistrictArt} from '../src/harbour/mountain/districtArt.ts';
import {SCENE_DRESSING} from '../src/harbour/scene/place.ts';

describe('authored mountain geometry',()=>{
 it('registers every new substantial district and station prop with collision',()=>{
  expect(DISTRICT_FIXTURES.length).toBeGreaterThan(10);
  for(const solid of [...STATION_SOLIDS,...DISTRICT_ART_SOLIDS,...SUMMIT_ART_SOLIDS])expect(WORLD_SOLIDS).toContain(solid);
  for(const d of DISTRICTS.filter(d=>d.biome!=='meadow'))expect(DISTRICT_FIXTURES.some(f=>f.district===d.id)).toBe(true);
 });
 it('keeps the full existing road and shortcut cross-sections clear at body height',()=>{
  const failures:string[]=[];
  for(const route of [{id:'road',points:MOUNTAIN_ROAD,halfWidth:4.8},...SKILL_BRANCHES])for(const [i,p] of route.points.entries()){
   const a=route.points[Math.max(0,i-1)]!,b=route.points[Math.min(route.points.length-1,i+1)]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
   for(const side of [-.9,0,.9]){
    const x=p[0]-dz/l*route.halfWidth*side,z=p[2]+dx/l*route.halfWidth*side;
    for(const s of [...STATION_SOLIDS,...DISTRICT_ART_SOLIDS,...SUMMIT_ART_SOLIDS])if(x>s.min[0]-.2&&x<s.max[0]+.2&&z>s.min[2]-.2&&z<s.max[2]+.2&&p[1]+1.6>s.min[1]&&p[1]+.05<s.max[1])failures.push(`${route.id}:${i}:${s.id}`);
   }
  }expect(failures).toEqual([]);
 });
 it('leaves every supported station platform open at walking height',()=>{
  for(const stops of Object.values(TRANSPORT_STOPS))for(const stop of stops)for(const x of [-2.8,0,2.8])for(const z of [-1.8,0,1.8]){
   const at=[stop.at[0]+x,stop.at[1],stop.at[2]+z];
   expect(STATION_SOLIDS.filter(s=>at[0]!>s.min[0]&&at[0]!<s.max[0]&&at[2]!>s.min[2]&&at[2]!<s.max[2]&&at[1]!+1.8>s.min[1]&&at[1]!<s.max[1])).toEqual([]);
  }
 });
 it('keeps close planting fixture footprints clear of every branch',()=>{
  for(const f of DISTRICT_FIXTURES)for(const branch of SKILL_BRANCHES){const radius=Math.max((f.solid.max[0]-f.solid.min[0])/2,(f.solid.max[2]-f.solid.min[2])/2);expect(nearestOnRoute(f.at[0],f.at[2],branch.points).distance).toBeGreaterThan(branch.halfWidth+radius);}
 });
 it('authors all themes with bounded district draws and releases each GPU resource once',()=>{
  for(const dressing of Object.values(SCENE_DRESSING)){
   const arts=[...DISTRICTS.map(d=>buildDistrictArt(d,dressing,'lite')),buildMountainArchitecture(dressing,'lite'),buildMountainCabin(dressing,'lite','gondola'),buildMountainCabin(dressing,'lite','funicular'),...(['home','library','glasshouse','cottage'] as const).map(kind=>buildDestinationSilhouette(kind,dressing,'lite'))];
   for(const [index,art] of arts.entries()){
    const resources=new Set<THREE.BufferGeometry|THREE.Material>();let meshes=0;
    art.group.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);o.geometry.computeBoundingBox();expect(o.geometry.boundingBox?.isEmpty()).toBe(false);expect(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);}});
    expect(meshes).toBeGreaterThan(0);if(index<DISTRICTS.length)expect(meshes).toBeLessThan(32);
    let releases=0;for(const r of resources)r.addEventListener('dispose',()=>releases++);
    art.dispose();art.dispose();expect(releases).toBe(resources.size);expect(art.group.children).toHaveLength(0);
   }
  }
 });
});
