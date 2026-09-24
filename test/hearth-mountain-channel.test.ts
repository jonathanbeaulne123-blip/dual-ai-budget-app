import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {RIVER,TRANSPORT_STOPS,TOWN_RACE_ROAD,nearestOnRoute} from '../src/harbour/mountain/definition.ts';
import {townChannelHeight} from '../src/harbour/mountain/townChannel.ts';
import {createGround,groundHeightAt} from '../src/harbour/scene/ground.ts';
import {SCENE_DRESSING} from '../src/harbour/scene/place.ts';
import {HARBOUR_LANES} from '../src/harbour/village/world.ts';
import {VILLAGE_SITES} from '../src/harbour/village/layout.ts';
import {queryWorldSurface} from '../src/harbour/mountain/surfaces.ts';

describe('town channel physical and visible ground',()=>{
 it('exposes the existing river below the actual full and lite terrain triangles',()=>{
  for(const tier of ['full','lite'] as const){
   const ground=createGround(new THREE.Scene(),SCENE_DRESSING.classic,tier),ray=new THREE.Raycaster();ground.island.updateMatrixWorld(true);
   const failures:string[]=[];
   for(const [x,z] of [[-8,6],[-8,12],[8,43],[10,56],[9,64],[3,-35]]){
    const river=nearestOnRoute(x!,z!,RIVER),[cx,y,cz]=river.point;
    for(const side of [-1.5,0,1.5]){
     ray.set(new THREE.Vector3(cx+side,10,cz),new THREE.Vector3(0,-1,0));
     const terrain=ray.intersectObject(ground.island)[0];
     if(!terrain||terrain.point.y>=y+.08)failures.push(`${tier}:${cx+side},${cz} ground ${terrain?.point.y} / water ${y+.08}`);
     expect(groundHeightAt(cx+side,cz)).toBeLessThan(y+.08);
    }
   }
   ground.dispose();expect(failures).toEqual([]);
  }
 });
 it('preserves both edges and centres of unsupported village lane causeways',()=>{
  for(const lane of HARBOUR_LANES)for(let i=1;i<lane.points.length;i++){
   const a=lane.points[i-1]!,b=lane.points[i]!,dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
   for(const t of [0,.5,1])for(const side of [-.9,0,.9]){
    const x=a[0]+dx*t-dz/l*side,z=a[1]+dz*t+dx/l*side;
    expect(townChannelHeight(x,z,1.31)).toBeCloseTo(1.31,10);
   }
  }
 });
 it('preserves town room foundations and their rotated doorway aprons',()=>{
  for(const site of Object.values(VILLAGE_SITES).filter(s=>s.spot[1]>-48)){
   const [x,z]=site.spot,yaw=Math.atan2(-x,-z),c=Math.cos(yaw),s=Math.sin(yaw);
   for(const lx of [-site.half[0],0,site.half[0]])for(const lz of [-site.half[1],0,site.half[1]])expect(townChannelHeight(x+lx*c+lz*s,z+lz*c-lx*s,1.2)).toBe(1.2);
   for(const step of [0,1,2]){const lx=site.door[0],lz=site.door[1]+step;expect(townChannelHeight(x+lx*c+lz*s,z+lz*c-lx*s,1.2)).toBe(1.2);}
  }
 });
 it('retains town race and transport support heights above the cut including the finish',()=>{
  for(const p of TOWN_RACE_ROAD){const hit=queryWorldSurface({x:p[0],z:p[2],y:p[1],supportId:'town-race-road'},groundHeightAt);expect(hit.y).toBeCloseTo(p[1],6);}
  for(const [kind,stops] of Object.entries(TRANSPORT_STOPS))for(const stop of stops){const [x,y,z]=stop.at;expect(queryWorldSurface({x,z,y,supportId:`station:${kind}:${stop.id}`},groundHeightAt).y).toBeCloseTo(y,6);}
 });
});
