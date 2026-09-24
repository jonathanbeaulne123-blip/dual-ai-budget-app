/**
 * Tap-to-walk planning across the whole world.
 *
 * Near and on the town island a tap is the obstacle-aware straight walk it has
 * always been (`pathfinder.ts`). Anywhere a straight line is not enough — onto
 * the mountain, between districts, from a deck to the ground — the plan walks
 * the pedestrian network (`geography.ts` `walkGraph`: road, paths, stairs,
 * lanes, stations), entering and leaving it by short obstacle-aware walks.
 * Pure: no three.js, no DOM, no clock.
 */
import {findPath,type PathPoint,type PathWorld} from './pathfinder.ts';
import {nearestWalkNodes,walkGraphRoute,type WalkNode} from './geography.ts';

export type RoutePoint={x:number;z:number;y?:number};
export type WalkPlan={points:RoutePoint[];length:number;viaNetwork:boolean};

/** A route longer than this is walked at a run: time-to-place matters at mountain scale. */
export const RUN_ROUTE_LENGTH=40;
/** The follower steers at a point this far along the route (more at a run): corners are rounded, never stopped at. */
export const ROUTE_LOOKAHEAD=1.4, ROUTE_LOOKAHEAD_RUN=2.2;

const onIsland=(p:{x:number;z:number})=>p.z>-40&&Math.hypot(p.x,p.z)<76;
const polylineLength=(pts:readonly RoutePoint[])=>pts.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-pts[i]!.x,p.z-pts[i]!.z),0);

/** Enter/leave the network at the nearest node a short obstacle-aware walk reaches. */
function access(at:RoutePoint,world:PathWorld,y:number|undefined,toward:boolean):{node:WalkNode;walk:PathPoint[]}|null{
  for(const node of nearestWalkNodes(at.x,at.z,y,8)){
    if(Math.hypot(node.x-at.x,node.z-at.z)>60)break;
    const walk=toward?findPath(at,{x:node.x,z:node.z},world):findPath({x:node.x,z:node.z},at,world);
    if(walk)return {node,walk};
  }
  return null;
}

/**
 * Plan a walk from where the body stands to a tapped point. `to.y` is the
 * tapped height: a deck and the ground under it are different destinations.
 */
export function planWalk(from:RoutePoint,to:RoutePoint,world:PathWorld):WalkPlan|null{
  const straight=Math.hypot(to.x-from.x,to.z-from.z);
  const local=()=>{const walk=findPath({x:from.x,z:from.z},{x:to.x,z:to.z},world);return walk?{points:[{x:from.x,z:from.z},...walk],viaNetwork:false}:null;};
  // The island keeps its direct tap-to-go; so does any short hop with nothing in the way on the same level.
  if(world.room||onIsland(from)&&onIsland(to)){const l=local();return l&&{...l,length:polylineLength(l.points)};}
  const sameLevel=to.y===undefined||from.y===undefined||Math.abs(to.y-from.y)<1.2;
  if(straight<12&&sameLevel){const l=local();if(l)return {...l,length:polylineLength(l.points)};}
  const start=access(from,world,from.y,true),end=access(to,world,to.y,false);
  if(!start||!end)return null;
  const nodes=start.node.id===end.node.id?[start.node]:walkGraphRoute(start.node.id,end.node.id);
  if(!nodes)return null;
  const points:RoutePoint[]=[{x:from.x,z:from.z,...(from.y===undefined?{}:{y:from.y})}];
  const push=(p:RoutePoint)=>{const last=points[points.length-1]!;if(Math.hypot(p.x-last.x,p.z-last.z)>.05)points.push(p);};
  for(const p of start.walk)push(p);
  for(const n of nodes)push({x:n.x,z:n.z,y:n.y});
  for(const p of end.walk)push(p);
  push({x:to.x,z:to.z,...(to.y===undefined?{}:{y:to.y})});
  return {points,length:polylineLength(points),viaNetwork:true};
}

/**
 * Follow a planned route smoothly: where along it the body has got to
 * (monotone — it never walks backwards along its own plan) and the point it
 * should steer at, a lookahead further on. Pure state, stepped every frame.
 */
export type RouteFollow={points:readonly RoutePoint[];cum:readonly number[];length:number;s:number;run:boolean};
export function followRoute(plan:WalkPlan,run=plan.length>RUN_ROUTE_LENGTH):RouteFollow{
  const cum=[0];for(let i=1;i<plan.points.length;i++)cum.push(cum[i-1]!+Math.hypot(plan.points[i]!.x-plan.points[i-1]!.x,plan.points[i]!.z-plan.points[i-1]!.z));
  return {points:plan.points,cum,length:plan.length,s:0,run};
}
export function pointAlong(f:RouteFollow,s:number):RoutePoint{
  const at=Math.max(0,Math.min(f.length,s));let i=1;
  while(i<f.points.length-1&&f.cum[i]!<at)i++;
  const a=f.points[i-1]!,b=f.points[i]!,seg=f.cum[i]!-f.cum[i-1]!,t=seg>1e-9?(at-f.cum[i-1]!)/seg:1;
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
}
/** Advance along the route from where the body stands; returns the steering point and whether it is the final one. */
export function steer(f:RouteFollow,x:number,z:number):{target:RoutePoint;final:boolean;off:number}{
  // Project the body onto the next few units of the route, never behind where it had got to.
  let best=f.s,bestD=Infinity;
  for(let i=1;i<f.points.length;i++){
    if(f.cum[i]!<f.s-.01)continue;if(f.cum[i-1]!>f.s+12)break;
    const a=f.points[i-1]!,b=f.points[i]!,dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l)):0;
    const d=Math.hypot(a.x+dx*t-x,a.z+dz*t-z),s=f.cum[i-1]!+Math.sqrt(l)*t;
    if(s>=f.s-.01&&d<bestD){bestD=d;best=s;}
  }
  f.s=Math.max(f.s,best);
  const ahead=f.run?ROUTE_LOOKAHEAD_RUN:ROUTE_LOOKAHEAD;
  if(f.length-f.s<=ahead)return {target:f.points[f.points.length-1]!,final:true,off:bestD};
  return {target:pointAlong(f,f.s+ahead),final:false,off:bestD};
}
