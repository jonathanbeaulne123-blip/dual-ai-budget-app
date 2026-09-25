import {expect,it} from 'vitest';
import {SKILL_BRANCHES,nearestOnRoute} from '../src/harbour/mountain/definition.ts';
import {createSkateSim} from '../src/harbour/skate/sim/index.ts';
import {skateField,skateSimOptions,SKATE_CATALOGS} from '../src/harbour/skate/driver.ts';
import {courtObstacles} from '../src/harbour/body/obstacles.ts';
import {kick,intent} from '../src/harbour/skate/sim/testKit.ts';
it('rides the neighbourhood awning at race speed with full-tier solids',()=>{
 const branch=SKILL_BRANCHES.find(b=>b.id==='hearth-awning')!,route=branch.points,field=skateField(),a=route[0]!,b=route[1]!,yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);
 for(const speed of [8,12]){
 const sim=createSkateSim(field,SKATE_CATALOGS,{x:a[0],z:a[2],y:a[1],yaw,stance:'regular',...skateSimOptions(courtObstacles('full'),field)});kick(sim,{vx:Math.sin(yaw)*speed,vz:Math.cos(yaw)*speed});
 let index=0,bails=0,arrived=false;
 for(let tick=0;tick<60*15;tick++){
 const p=sim.present(),projection=nearestOnRoute(p.x,p.z,route);index=Math.max(index,projection.index);
 if(index>=route.length-3){arrived=true;break;}
 let aim=index,ahead=0;while(aim<route.length-1&&ahead<Math.max(2,p.speed*.35)){const a=route[aim]!,b=route[++aim]!;ahead+=Math.hypot(b[0]-a[0],b[2]-a[2]);}
 const target=route[aim]!,error=Math.atan2(Math.sin(Math.atan2(target[0]-p.x,target[2]-p.z)-p.boardYaw),Math.cos(Math.atan2(target[0]-p.x,target[2]-p.z)-p.boardYaw));
 const r=sim.step(intent({push:p.speed<3,steer:p.phase==='air'?0:Math.max(-1,Math.min(1,-error*2.2))}),1/60);bails+=r.events.filter(e=>e.kind==='bail').length
 }
 expect({speed,bails,arrived}).toEqual({speed,bails:0,arrived:true});
 }
});
