/**
 * Every way down (FLIGHT.md §2.4, §3.4). Pure: the caller hands in narrow views of geography,
 * water, districts, the path graph and the envelope; the outcome is data. There is no crash state:
 * the worst outcome is a labelled fade to a path node.
 */
import type {FlightEnvelope,FlightVolume,Point2,Point3} from '../../world/definition.ts';

/** Mirrors `runtime/geography.ts` HORIZON_WALKABLE_DEGREES (no runtime import here; the landing test pins them equal). */
export const WALKABLE_DEGREES=40;

export type LandingKind='walkoff'|'tumble'|'fadeShore'|'fadeApron'|'deepSmall'|'deepBig';
export interface LandingNode{id:string;at:Point3;label?:string}
export interface LandingOutcome{
  kind:LandingKind;
  /** Where the rider stands afterwards (on foot). */
  at:Point3;
  /** The HUD bubble's words ("→ the square", "the Green"). */
  label:string;
  /** The path node a fade lands on (every fade has one). */
  node?:LandingNode;
  /** Seconds of wet trousers after a water fade (FLIGHT.md §13). */
  wet?:number;
  /** Echoes up the Throat after a Deep splash. */
  echoes?:number;
  /** The rule that decided it, for logs and tests. */
  rule:'field'|'walkable'|'water'|'deep'|'neighbourhood'|'unwalkable'|'boundary';
}
export interface LandingSurface{y:number;slope:number;material:string;walkable:boolean;
  /** A bed with `threshold` pace is not a landing surface. */
  pace?:string}
export interface LandingDistrict{id:string;kind:'neighbourhood'|'field'|'wild'|'offshore'|string;label?:string}
export interface LandingContext{
  surface(x:number,z:number):LandingSurface|null;
  water(x:number,z:number):{id:string;y:number}|null;
  district(x:number,z:number):LandingDistrict;
  nearestShoreNode(x:number,z:number):LandingNode|null;
  nearestApron(x:number,z:number,districtId:string):LandingNode|null;
  /** Any path node (the unwalkable-ground fade). Falls back to the shore node. */
  nearestPathNode?(x:number,z:number):LandingNode|null;
  inHostFootprint(x:number,z:number):boolean;
  envelope:Pick<FlightEnvelope,'volumes'|'landings'>;
  /** The Deep's jetty (`deepJetty`); falls back to the shore node. */
  deepJetty?:LandingNode;
}
export interface LandingContact{x:number;y:number;z:number;mode?:'glider'|'parachute'}
export interface LandingVelocity{airspeed:number;sink:number;groundSpeed?:number;
  /** Parachute only: full brakes through the last 5 m. */
  flared?:boolean}

/** A flared glider landing: airspeed ≤ 9 and sink ≤ 1.5. */
export const FLARED_AIRSPEED=9;
export const FLARED_SINK=1.5;
/** The parachute's stand-up: full brakes in the last 5 m and ground speed ≤ 3. */
export const STAND_UP_GROUND_SPEED=3;
/** The tumble finds the first walkable surface within this reach, else fades. */
export const TUMBLE_REACH=6;
export const WET_SECONDS=20;
export const FIELD_IDS=['green','reachMeadow','sands','strip'] as const;
export const LANDING_LABELS:Record<string,string>={green:'the Green',reachMeadow:'the Reach meadow',sands:'Long Sands',strip:'the strip','water.harbour':'the harbour','water.bight':'the Bight','water.deep':'the Deep'};
const isDeep=(id:string)=>id==='water.deep'||id==='deep';

function insideVolume(v:FlightVolume,x:number,z:number):boolean{
  const dx=x-v.centre[0],dz=z-v.centre[2];
  if(v.radius)return Math.hypot(dx,dz)<=v.radius;
  const c=Math.cos(v.yaw),s=Math.sin(v.yaw);
  return Math.abs(dx*c-dz*s)<=v.halfSize[0]&&Math.abs(dx*s+dz*c)<=v.halfSize[2];
}
/** The landing field (green / reachMeadow / sands / strip) under a point, if any. */
export function landingFieldAt(envelope:Pick<FlightEnvelope,'volumes'>,x:number,z:number,mode:'glider'|'parachute'='glider'):FlightVolume|null{
  return envelope.volumes?.find(v=>v.kind==='landing'&&!v.waterBodyId&&(FIELD_IDS as readonly string[]).includes(v.id)&&(!v.modes||v.modes.includes(mode))&&insideVolume(v,x,z))??null;
}

function flaredLanding(contact:LandingContact,velocity:LandingVelocity):boolean{
  if(contact.mode==='parachute')return !!velocity.flared&&(velocity.groundSpeed??Infinity)<=STAND_UP_GROUND_SPEED;
  return velocity.airspeed<=FLARED_AIRSPEED&&velocity.sink<=FLARED_SINK;
}
const fade=(kind:'fadeShore'|'fadeApron',node:LandingNode|null,fallback:Point3,label:string,rule:LandingOutcome['rule'],extra:Partial<LandingOutcome>={}):LandingOutcome=>
  ({kind,at:node?node.at:fallback,label:`→ ${node?.label??label}`,...(node?{node}:{}),rule,...extra});

/**
 * FLIGHT.md §2.4's table, in its order of precedence:
 * water (the Deep: small/big splash + jetty; any other water or the sea: shore fade, wet) →
 * a landing field or walkable ground (flared: walk-off; else the tumble) — a host footprint or a
 * neighbourhood district is the apron fade instead → unwalkable ground (tumble within 6 m, else a path fade) →
 * outside the world: the shore fade.
 */
export function resolveTouchdown(ctx:LandingContext,contact:LandingContact,velocity:LandingVelocity):LandingOutcome{
  const {x,z}=contact,mode=contact.mode??'glider',here:Point3=[x,contact.y,z];
  const surface=ctx.surface(x,z),water=ctx.water(x,z);
  if(water&&(!surface||water.y>=surface.y-1e-6)){
    if(isDeep(water.id)){
      const node=ctx.deepJetty??ctx.nearestShoreNode(x,z),small=flaredLanding(contact,velocity);
      return{kind:small?'deepSmall':'deepBig',at:node?.at??here,label:`→ ${node?.label??'the jetty'}`,...(node?{node}:{}),echoes:3,rule:'deep'};
    }
    return fade('fadeShore',ctx.nearestShoreNode(x,z),here,'the shore','water',{wet:WET_SECONDS});
  }
  if(!surface)return fade('fadeShore',ctx.nearestShoreNode(x,z),here,'the shore','boundary',{wet:WET_SECONDS});
  const field=landingFieldAt(ctx.envelope,x,z,mode),footprint=ctx.inHostFootprint(x,z),district=ctx.district(x,z);
  const on:Point3=[x,surface.y,z];
  if(field&&!footprint){
    const label=LANDING_LABELS[field.id]??field.id;
    return flaredLanding(contact,velocity)?{kind:'walkoff',at:on,label,rule:'field'}:{kind:'tumble',at:on,label,rule:'field'};
  }
  if(footprint||district.kind==='neighbourhood'){
    const node=ctx.nearestApron(x,z,district.id);
    return fade('fadeApron',node,on,district.label??district.id,'neighbourhood');
  }
  const walkable=(s:LandingSurface)=>s.walkable&&s.slope<=WALKABLE_DEGREES&&s.pace!=='threshold';
  if(walkable(surface))return flaredLanding(contact,velocity)?{kind:'walkoff',at:on,label:'',rule:'walkable'}:{kind:'tumble',at:on,label:'',rule:'walkable'};
  // Unwalkable: roll down to the first walkable surface within 6 m (lowest first), else fade to a path node.
  let best:Point3|null=null;
  for(const r of [1.5,3,4.5,TUMBLE_REACH])for(let i=0;i<16;i++){
    const a=i*Math.PI/8,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,s=ctx.surface(px,pz);
    if(!s||!walkable(s)||ctx.inHostFootprint(px,pz)||ctx.water(px,pz))continue;
    if(s.y<=surface.y+.01&&(!best||s.y<best[1]))best=[px,s.y,pz];
  }
  if(best)return{kind:'tumble',at:best,label:'',rule:'unwalkable'};
  const node=ctx.nearestPathNode?.(x,z)??ctx.nearestShoreNode(x,z);
  return fade('fadeApron',node,on,'the path','unwalkable');
}

export interface ReachableLanding{id:string;label:string;xy:Point2;distance:number}
/** Best glide at trim (11 / 1.2). */
export const TRIM_GLIDE=11/1.2;
/** The Fold bubble's margin: height in hand must beat the need by this much. */
export const FOLD_MARGIN=10;
/**
 * The Fold bubble (FLIGHT.md §2.4): the nearest landing field by straight line that is reachable at trim
 * from here — height in hand ≥ distance / 9.17 + 10 m. Water landings are not offered. Null if none.
 */
export function nearestReachableLanding(envelope:Pick<FlightEnvelope,'landings'|'volumes'>,state:{x:number;y:number;z:number},mode:'glider'|'parachute'='glider'):ReachableLanding|null{
  let best:ReachableLanding|null=null;
  for(const landing of envelope.landings){
    if('empty' in landing||!(FIELD_IDS as readonly string[]).includes(landing.id))continue;
    const volume=envelope.volumes?.find(v=>v.id===landing.id);
    if(volume?.modes&&!volume.modes.includes(mode))continue;
    const distance=Math.hypot(landing.xy[0]-state.x,landing.xy[1]-state.z),inHand=state.y-(landing.height??0);
    if(inHand<distance/TRIM_GLIDE+FOLD_MARGIN)continue;
    if(!best||distance<best.distance)best={id:landing.id,label:LANDING_LABELS[landing.id]??landing.id,xy:[landing.xy[0],landing.xy[1]],distance};
  }
  return best;
}
