/**
 * The glider launch pads (Jonathan, 2026-10-04: "make sure all gliders spots are accessible, if there is a model for the
 * glider have it at each glider spot").
 *
 * - `gliderPadPlacements` — where each of the three pads (the Crown deck, the Prow tower, the Lamp gallery) stands a body
 *   ready to launch (on the deck, inside the threshold's offer reach, facing the run-off), and where its parked glider stands.
 *   Pure: it reads the baked world's thresholds and launch pads and a surface query, so tests use the real bake.
 * - `gliderPadRefusal` — the one rule for when the Guide may NOT move the body to a pad (riding, the galley, the monorail…).
 * - `createGliderPads` — the parked gliders in the scene: static, non-colliding, theme-dressed, hidden while far away or while
 *   the rider is flying from that pad, the tail light lit at night; disposed with the runtime.
 */
import * as THREE from 'three';
import type {Point3,Threshold,WorldDefinition} from '../world/definition.ts';
import {padHeading} from '../movers/glider/wing.ts';
import {createParkedGlider,type ParkedGlider} from '../movers/glider/art.ts';
import {VEHICLE_DIMENSIONS,type VehicleDressing,type VehicleTier} from '../movers/shared/vehicleArt.ts';
import {OFFER_DY,OFFER_REACH,type ThresholdOffer} from '../movers/shared/threshold.ts';
import type {MoverBody} from '../movers/shared/mode.ts';

export type GliderPadId='crown'|'prow'|'lampGallery';
/** The three launch pads, in the Guide's order. `id` is the FlightEnvelope launch pad id (world/sky.ts). */
export const GLIDER_PADS:readonly {id:GliderPadId;thresholdId:string;label:string}[]=[
  {id:'crown',thresholdId:'crownLaunch',label:'The Crown'},
  {id:'prow',thresholdId:'prowPlatform',label:'The Prow'},
  {id:'lampGallery',thresholdId:'lampGallery',label:'The Lamp'},
];
/** The first-approach hint radius (3D, metres). */
export const GLIDER_PAD_HINT_RADIUS=25;
/** Beyond this (plan) distance a parked glider is not drawn at all. */
export const GLIDER_PAD_DRAW_RADIUS=700;
export const GLIDER_PAD_HINT='Glider launch — press E to run off';

export type GliderPose={x:number;y:number;z:number;yaw:number};
export interface GliderPadPlacement{id:GliderPadId;label:string;thresholdId:string;deck:number;heading:number;stand:GliderPose;prop:GliderPose}
/** The runtime's surface query (geography.surface): the highest floor at or below y. */
export type PadSurface=(x:number,z:number,y?:number)=>{y:number;slope:number}|null;

const KEEL=VEHICLE_DIMENSIONS.glider.keel,SPAN=VEHICLE_DIMENSIONS.glider.span;
/** The parked glider's plan footprint (its sail triangle, nose along `yaw`), for the clearance checks. */
export function parkedGliderFootprint(prop:Pick<GliderPose,'x'|'z'|'yaw'>):[number,number][]{
  const f:[number,number]=[Math.sin(prop.yaw),Math.cos(prop.yaw)],r:[number,number]=[Math.cos(prop.yaw),-Math.sin(prop.yaw)];
  const at=(along:number,across:number):[number,number]=>[prop.x+f[0]*along+r[0]*across,prop.z+f[1]*along+r[1]*across];
  return [at(KEEL/2,0),at(-KEEL/2,SPAN/2),at(-KEEL/2,-SPAN/2)];
}
function inTriangle(p:readonly [number,number],t:readonly [number,number][]):boolean{
  const s=(a:readonly [number,number],b:readonly [number,number])=>(p[0]-b[0])*(a[1]-b[1])-(a[0]-b[0])*(p[1]-b[1]);
  const d1=s(t[0]!,t[1]!),d2=s(t[1]!,t[2]!),d3=s(t[2]!,t[0]!);
  return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));
}
/** Plan distance from a point to the parked glider's sail (0 inside it). */
export function distanceToParkedGlider(p:readonly [number,number],prop:Pick<GliderPose,'x'|'z'|'yaw'>):number{
  const t=parkedGliderFootprint(prop);if(inTriangle(p,t))return 0;
  let best=Infinity;
  for(let i=0;i<3;i++){const a=t[i]!,b=t[(i+1)%3]!,dx=b[0]-a[0],dz=b[1]-a[1],k=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(p[0]-a[0]-dx*k,p[1]-a[1]-dz*k));}
  return best;
}

type PadWorld=Pick<WorldDefinition,'thresholds'|'sky'>;
/**
 * Where a pad stands a body ready to launch: the threshold's own point at its baked deck height (inside OFFER_REACH /
 * OFFER_DY by construction), facing the pad's outward run-off (`padHeading`, the same heading the glider's run takes when the
 * rider faces it). Needs no deck geometry, so the Guide can send the body to a pad whose chunk has not arrived yet (the
 * runtime's restore holds the body until it lands, then validates the floor).
 */
export function gliderPadStand(world:PadWorld,id:GliderPadId,ground:(x:number,z:number,y:number)=>number):{pad:typeof GLIDER_PADS[number];stand:GliderPose;heading:number}|null{
  const pad=GLIDER_PADS.find(p=>p.id===id),t=pad&&world.thresholds.find(row=>row.id===pad.thresholdId),launch=pad&&world.sky?.launchPads?.find(p=>p.id===pad.id);
  if(!pad||!t||!launch)return null;
  const h=t.height??launch.edge[0]![1],heading=padHeading(launch.edge as Point3[],0,ground);
  return{pad,heading,stand:{x:t.at[0],y:h,z:t.at[1],yaw:heading}};
}
/** The stair ends (plan) a parked glider keeps clear of: the deck's way up. */
export function stairEnds(beds:readonly {kind:string;points:readonly (readonly number[])[]}[]):[number,number][]{
  return beds.filter(b=>b.kind==='stair'&&b.points.length>1).flatMap(b=>[b.points[0]!,b.points.at(-1)!]).map(p=>[p[0]!,p[2]!] as [number,number]);
}
/**
 * The full placement once the deck is resident: the stand (above) on its floor, and the parked glider on the same deck,
 * nose along the run-off, beside the stand and clear of it and of the deck's stair ends (`clear`): the first candidate whose
 * hang point, nose and both base-bar ends all have the deck under them. Null when the deck is not under the stand.
 */
export function gliderPadPlacement(world:PadWorld,id:GliderPadId,surface:PadSurface,ground:(x:number,z:number)=>number,clear:readonly (readonly [number,number])[]=[]):GliderPadPlacement|null{
  const groundAt=(gx:number,gz:number,gy:number)=>surface(gx,gz,gy)?.y??ground(gx,gz);
  const base=gliderPadStand(world,id,groundAt);if(!base)return null;
  const {pad,heading,stand}=base,{x,z}=stand,floor=surface(x,z,stand.y+.5);
  if(!floor||Math.abs(floor.y-stand.y)>OFFER_DY)return null;
  const deck=floor.y,onDeck=(px:number,pz:number)=>{const s=surface(px,pz,deck+.5);return s!==null&&Math.abs(s.y-deck)<.05;};
  const f=[Math.sin(heading),Math.cos(heading)] as const,r=[Math.cos(heading),-Math.sin(heading)] as const;
  let prop:GliderPose|null=null;
  // Beside the stand first (across the run-off, so the rider runs past it), then behind it.
  candidates:for(const [along,across] of [[-.5,3.4],[-.5,-3.4],[-1,2.8],[-1,-2.8],[-3.2,0],[-2.6,1.5],[-2.6,-1.5],[-2.2,0]] as const){
    const px=x+f[0]*along+r[0]*across,pz=z+f[1]*along+r[1]*across,yaw=heading;
    for(const [a,c] of [[0,0],[KEEL/2,0],[.3,.7],[.3,-.7]] as const)if(!onDeck(px+f[0]*a+r[0]*c,pz+f[1]*a+r[1]*c))continue candidates;
    if(distanceToParkedGlider([x,z],{x:px,z:pz,yaw})<1.2)continue;
    if(clear.some(p=>Math.hypot(p[0]-x,p[1]-z)<12&&distanceToParkedGlider(p,{x:px,z:pz,yaw})<1))continue;
    prop={x:px,y:deck,z:pz,yaw};break;
  }
  // No clear spot on the deck: behind the stand (still non-colliding, never in the offer's way).
  prop??={x:x-f[0]*2.2,y:surface(x-f[0]*2.2,z-f[1]*2.2,deck+.5)?.y??deck,z:z-f[1]*2.2,yaw:heading};
  return{id:pad.id,label:pad.label,thresholdId:pad.thresholdId,deck,heading,stand:{...stand,y:deck},prop};
}
export function gliderPadPlacements(world:PadWorld,surface:PadSurface,ground:(x:number,z:number)=>number,clear:readonly (readonly [number,number])[]=[]):GliderPadPlacement[]{
  return GLIDER_PADS.map(p=>gliderPadPlacement(world,p.id,surface,ground,clear)).filter((p):p is GliderPadPlacement=>p!==null);
}
/** The stand is inside the threshold's offer reach (the same rule as `offersAt`). */
export function standOffers(p:GliderPadPlacement,t:Pick<Threshold,'at'|'height'>):boolean{
  return Math.hypot(p.stand.x-t.at[0],p.stand.z-t.at[1])<=OFFER_REACH&&Math.abs(p.stand.y-(t.height??p.deck))<=OFFER_DY;
}

/**
 * The walking offers a rider can actually take (runtime `travelOffers`): the plane's own doors aside, only offers this registry
 * can accept now. A mode with no registered controller (zip, cart, balloon, ferry…) stays in the world's thresholds for when
 * its controller lands, but never renders a button that does nothing — on the Prow only the glider's "run off" remains.
 */
export function liveTravelOffers(registry:{offers(body:MoverBody):ThresholdOffer[];canAccept(offer:ThresholdOffer):boolean},body:MoverBody):ThresholdOffer[]{
  return registry.offers(body).filter(o=>o.to!=='plane'&&o.from!=='plane'&&registry.canAccept(o));
}

export type GliderPadState={riding:boolean;airborne:boolean;kitchen:boolean;monorail:boolean;seated:boolean;sitting:boolean;skating:boolean};
/** Why the Guide may not take the body to a launch pad now (null: it may). One rule for the runtime and its tests. */
export function gliderPadRefusal(s:GliderPadState):string|null{
  if(s.riding||s.airborne)return'Park the ride first, then choose a glider launch.';
  if(s.kitchen)return'Leave the galley first, then choose a glider launch.';
  if(s.monorail)return'Step off the monorail at a platform before choosing a glider launch.';
  if(s.seated||s.sitting)return'Stand up first, then choose a glider launch.';
  if(s.skating)return'Step off the board first, then choose a glider launch.';
  return null;
}
/** The nearest pad within `radius` (3D) of the body, or null. */
export function gliderPadNear<T extends {stand:{x:number;y:number;z:number}}>(placements:readonly T[],body:{x:number;y:number;z:number},radius=GLIDER_PAD_HINT_RADIUS):T|null{
  let best:T|null=null,d=radius;
  for(const p of placements){const next=Math.hypot(p.stand.x-body.x,p.stand.y-body.y,p.stand.z-body.z);if(next<=d){d=next;best=p;}}
  return best;
}

export interface GliderPads{
  /** The placements computed so far (a pad's is computed once its deck is resident). */
  placements():GliderPadPlacement[];
  /** Once per frame: show what is near, resident and not being flown; cheap (three distances, a visibility flip on change). */
  update(body:{x:number;z:number},flyingFrom:string|null,visible:boolean,resident:(x:number,z:number)=>boolean,night:boolean):void;
  setTheme(theme:VehicleDressing):void;
  dispose():void;
}
/**
 * The parked gliders. `place(id)` computes a pad's placement (null until its deck is resident); each pad's prop is built the
 * first time its deck is resident and near, then only shown or hidden.
 */
export function createGliderPads(scene:THREE.Object3D,world:PadWorld,place:(id:GliderPadId)=>GliderPadPlacement|null,options:{theme:VehicleDressing;tier:VehicleTier}):GliderPads{
  let theme=options.theme;
  const pads=GLIDER_PADS.map(pad=>{const t=world.thresholds.find(row=>row.id===pad.thresholdId);return{pad,at:t?[t.at[0],t.at[1]] as const:null,place:null as GliderPadPlacement|null,tried:-Infinity,art:null as ParkedGlider|null,shown:false,night:false};});
  const make=(p:typeof pads[number])=>{if(!p.place)return;const art=createParkedGlider(theme,options.tier),{prop}=p.place;art.root.position.set(prop.x,prop.y,prop.z);art.root.rotation.y=prop.yaw;art.root.visible=false;art.root.updateMatrix();art.root.userData.gliderPad=p.pad.id;scene.add(art.root);p.art=art;p.shown=false;p.night=false;};
  const drop=(p:typeof pads[number])=>{if(!p.art)return;p.art.root.removeFromParent();p.art.dispose();p.art=null;p.shown=false;};
  return{
    placements:()=>pads.flatMap(p=>p.place?[p.place]:[]),
    update(body,flyingFrom,visible,resident,night){
      for(const p of pads){
        if(!p.at)continue;
        const near=visible&&Math.hypot(p.at[0]-body.x,p.at[1]-body.z)<=GLIDER_PAD_DRAW_RADIUS;
        // A resident deck that still gives no placement (its region not drawn yet) is retried every 2 s, not every frame.
        if(near&&!p.place&&resident(p.at[0],p.at[1])){const now=Date.now();if(now-p.tried>=2000){p.tried=now;p.place=place(p.pad.id);make(p);}}
        if(!p.art)continue;
        const show=near&&flyingFrom!==p.pad.thresholdId&&resident(p.at[0],p.at[1]);
        if(show!==p.shown){p.shown=show;p.art.root.visible=show;}
        if(show&&night!==p.night){p.night=night;p.art.setNight(night);}
      }
    },
    setTheme(next){if(next===theme)return;theme=next;for(const p of pads){drop(p);make(p);}},
    dispose(){for(const p of pads)drop(p);},
  };
}
