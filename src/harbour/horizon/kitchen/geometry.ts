import {DECK,type Point} from '../movers/fleet/layout.ts';
import {toLocal,toWorld,type Fleet} from '../movers/fleet/model.ts';
import type {ChefPose,KitchenStation} from './types.ts';

export const KITCHEN_BOARD:Point={x:-2.6,y:DECK.main,z:-10.6};
export function atKitchenBoard(fleet:Fleet,body:ChefPose):boolean {
  const p=toLocal(fleet.yacht,body);
  return Math.abs(p.y-DECK.main)<.4&&Math.hypot(p.x-KITCHEN_BOARD.x,p.z-KITCHEN_BOARD.z)<2.15&&fleet.support(body)!==null;
}
/** Kitchen movement uses the actual yacht floor and contacts, with small swept steps. */
export function kitchenWalkable(fleet:Fleet,point:Point,deck:boolean,stations:KitchenStation[]=[]):boolean {
  if(Math.abs(point.y-DECK.main)>.15||point.x< -6.55||point.x>6.55||point.z< (deck?-19.2:-12.05)||point.z> -1.55)return false;
  const p=toWorld(fleet.yacht,{...point,y:DECK.main}),floor=fleet.surface(p.x,p.z,p.y,.08);
  if(!floor||Math.abs(floor.y-p.y)>.12||fleet.contact(p.x,p.z,p.y,.27))return false;
  for(const s of stations)if(s.id.includes('deck-grill')&&Math.abs(point.x-s.at.x)<1&&Math.abs(point.z-s.at.z)<.8)return false;
  return true;
}
export function moveKitchenChef(fleet:Fleet,pose:ChefPose,x:number,z:number,seconds:number,deck:boolean,stations:KitchenStation[]):ChefPose {
  const n=Math.max(1,Math.hypot(x,z)),dx=x/n*3.2*Math.min(.1,seconds),dz=z/n*3.2*Math.min(.1,seconds);
  const out={...pose,y:DECK.main};if(Math.hypot(dx,dz)<1e-7)return out;
  out.yaw=Math.atan2(dx,dz);const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.1));
  for(let i=0;i<steps;i++){
    const next={...out,x:out.x+dx/steps,z:out.z+dz/steps};
    if(kitchenWalkable(fleet,next,deck,stations)){out.x=next.x;out.z=next.z;}
    else if(kitchenWalkable(fleet,{...out,x:next.x},deck,stations))out.x=next.x;
    else if(kitchenWalkable(fleet,{...out,z:next.z},deck,stations))out.z=next.z;
  }
  return out;
}
/** Sight is checked above worktops but below walls; hands cannot pass through the cabin. */
export function kitchenSightBlocked(fleet:Fleet,from:Point,to:Point):boolean {
  const distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/.12));
  for(let i=1;i<steps;i++){
    const p=toWorld(fleet.yacht,{x:from.x+(to.x-from.x)*i/steps,y:DECK.main+1.04,z:from.z+(to.z-from.z)*i/steps});
    if(fleet.contact(p.x,p.z,p.y,.04))return true;
  }
  return false;
}
