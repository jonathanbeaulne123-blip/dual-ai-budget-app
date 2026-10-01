import {describe,it,expect} from 'vitest';
import {createBodyState,type BodyWorld} from '../src/harbour/body/bodyModel.ts';
import {courtObstacles,pushOut,BODY_RADIUS} from '../src/harbour/body/obstacles.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';
import {SKILL_BRANCHES} from '../src/harbour/mountain/course.ts';
const fixture:BodyWorld={groundHeightAt:()=>0,room:null,obstacles:[{kind:'box',id:'low-plinth',minX:-1,maxX:1,minZ:-1,maxZ:1,bottom:0,top:2}],support:(_x,_z,y)=>({y:y!==undefined&&y>=4?4:0,id:y!==undefined&&y>=4?'deck':'terrain',nx:0,ny:1,nz:0})};
describe('explicit-height native body placement',()=>{
 it('places on a deck above a lower plinth without horizontal displacement',()=>{const s=createBodyState(0,0,0,fixture,4);expect([s.x,s.y,s.z,s.supportId]).toEqual([0,4,0,'deck']);});
 it('preserves ground placement push-out when height is omitted or intersects the plinth',()=>{for(const y of [undefined,0]){const s=createBodyState(0,0,0,fixture,y);expect(Math.hypot(s.x,s.z)).toBeGreaterThan(1);expect(s.y).toBe(0);}});
 it('retains collision with a body-height wall beside the raised deck',()=>{const world={...fixture,obstacles:[{kind:'box' as const,id:'deck-wall',minX:-1,maxX:1,minZ:-1,maxZ:1,bottom:4,top:7}]},s=createBodyState(0,0,0,world,4);expect(Math.hypot(s.x,s.z)).toBeGreaterThan(1);});
 it('preserves the actual dam exit deck start above its native plinth',()=>{const branch=SKILL_BRANCHES.find(b=>b.id==='dam-promenade')!,p=branch.segments.find(s=>s.kind==='deck')!.points[0]!,world={groundHeightAt,obstacles:courtObstacles('full'),room:null};
   expect(pushOut(p[0],p[2],BODY_RADIUS,world.obstacles,p[1]).hit).toBeNull();
   const s=createBodyState(p[0],p[2],0,world,p[1]);expect(s.x).toBeCloseTo(p[0],8);expect(s.z).toBeCloseTo(p[2],8);expect(s.y).toBeCloseTo(p[1],6);expect(s.supportId).toBe('dam-promenade');
 });
});
