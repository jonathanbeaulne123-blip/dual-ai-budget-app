/**
 * Scripted pilots for headless tests and evidence (FLIGHT.md §10 row 3, §2.6). Each helper flies the
 * pure `stepWing` with a deterministic autopilot of bar and bank inputs — the same two inputs a player has:
 * no assist, no teleport, no extra physics. Every helper returns the recorded path and the height in hand
 * at its key points.
 *
 * Height in hand is always "height above what the point needs": the gallery (25) at the Lamp, the
 * aperture's floor (110 − 9 = 101) at the Throat's mouth, the gate's centre at a course gate, the field
 * at a landing.
 */
import type {FlightEnvelope,FlightVolume,Point2,Point3} from '../../world/definition.ts';
import {windVelocity,type WindSample} from '../shared/wind.ts';
import {enterCorridor,throatGate,insideAperture,stepCorridor,type CorridorState,type ThroatGate} from './corridor.ts';
import {angleDiff} from './lift.ts';
import {GLIDER_MAX_MS,GLIDER_TRIM_MS,barTarget,sinkAt} from './polar.ts';
import {MAX_BANK,TURN_G,WING_DT,launchWing,stepWing,turnRate,type WingEnv,type WingInput,type WingPhase,type WingState} from './wing.ts';

export interface JourneyEnv extends WingEnv{envelope:Pick<FlightEnvelope,'launchPads'|'launches'|'landings'|'gates'|'volumes'|'corridors'>}
export interface PathSample{t:number;x:number;y:number;z:number;heading:number;bank:number;airspeed:number;vs:number;lift:number;phase:WingPhase|'corridor'|'level'}
export interface GateCrossing{id:string;t:number;at:Point3;lateral:number;vertical:number;inside:boolean}
export interface Journey{
  path:PathSample[];
  final:WingState;
  seconds:number;
  /** Named key points → metres above what each needs (see the file header). */
  heightInHand:Record<string,number>;
  /** Did the flight reach its goal (the field, the gate, the mouth) before touching down? */
  reached:boolean;
  gates:GateCrossing[];
  /** Named timings and measures (seconds in a thermal, the turn's radius, …). */
  measures:Record<string,number>;
  corridor?:CorridorState;
}

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const DEG=Math.PI/180;
/** Land gently: push out in the last 1.5 m (a longer push floats at 0.3 m/s sink, 27 : 1 — FLIGHT.md §2.4 bleeds sink to 0.3 and holds it). */
export const FLARE_START=1.5;

const sample=(s:WingState):PathSample=>({t:s.t,x:s.x,y:s.y,z:s.z,heading:s.heading,bank:s.bank,airspeed:s.airspeed,vs:s.vs,lift:s.lift??0,phase:s.phase});
const bearingTo=(s:{x:number;z:number},to:readonly [number,number])=>Math.atan2(to[0]-s.x,to[1]-s.z);
const distanceTo=(s:{x:number;z:number},to:readonly [number,number])=>Math.hypot(to[0]-s.x,to[1]-s.z);

/** The heading that makes the ground track run along `bearing` in this wind (a crab). */
export function trackHeading(bearing:number,airspeed:number,wind:WindSample):number{
  const [wx,wz]=windVelocity(wind),dx=Math.sin(bearing),dz=Math.cos(bearing),nx=dz,nz=-dx;
  const s=clamp(-(wx*nx+wz*nz)/Math.max(1,airspeed),-1,1),c=Math.sqrt(1-s*s);
  return Math.atan2(c*dx+s*nx,c*dz+s*nz);
}
/** Bank input that turns the wing onto `heading`, limited to `maxBankDegrees`, damped by the current turn rate. */
export function steer(state:WingState,heading:number,maxBankDegrees=45,gain=2,lead=.6):number{
  const err=angleDiff(heading,state.heading),omega=turnRate(state.bank,state.airspeed);
  const want=clamp(-gain*(err-omega*lead),-maxBankDegrees*DEG,maxBankDegrees*DEG);
  return want/MAX_BANK;
}
/** The bar whose still-air glide slope (sink / airspeed) first reaches `slope`; 0 below trim's, 1 beyond the dive's. */
export function barForSlope(slope:number):number{
  for(let bar=0;bar<=1.0001;bar+=.02){const v=barTarget(bar);if(sinkAt(v)/v>=slope)return Math.min(1,bar);}
  return 1;
}
export const TRIM_SLOPE=sinkAt(GLIDER_TRIM_MS)/GLIDER_TRIM_MS;
export const DIVE_SLOPE=sinkAt(GLIDER_MAX_MS)/GLIDER_MAX_MS;

/** Where the path crosses a gate's plane (normal along `yaw`), and whether it was inside the aperture. */
export function crossGate(id:string,a:PathSample,b:PathSample,centre:Point3,aperture:Point2,yaw:number):GateCrossing|null{
  const nx=Math.sin(yaw),nz=Math.cos(yaw),d0=(a.x-centre[0])*nx+(a.z-centre[2])*nz,d1=(b.x-centre[0])*nx+(b.z-centre[2])*nz;
  if(d0===d1||!((d0<0&&d1>=0)||(d0>0&&d1<=0)))return null;
  const f=d0/(d0-d1),x=a.x+(b.x-a.x)*f,y=a.y+(b.y-a.y)*f,z=a.z+(b.z-a.z)*f;
  const lateral=(x-centre[0])*Math.cos(yaw)-(z-centre[2])*Math.sin(yaw),vertical=y-centre[1];
  return{id,t:a.t+(b.t-a.t)*f,at:[x,y,z],lateral,vertical,inside:Math.abs(lateral)<=aperture[0]/2&&Math.abs(vertical)<=aperture[1]/2};
}
/** Closest horizontal approach of a path to a point. */
export function closestApproach(path:readonly PathSample[],xy:readonly [number,number]):number{
  let best=Infinity;for(const p of path)best=Math.min(best,Math.hypot(p.x-xy[0],p.z-xy[1]));return best;
}

/** A recorder over `stepWing`: stages fly until their stop condition, sharing one path. */
export class Pilot{
  state:WingState;readonly path:PathSample[];readonly env:WingEnv;readonly dt:number;
  constructor(env:WingEnv,start:WingState,dt=WING_DT){this.env=env;this.state=start;this.path=[sample(start)];this.dt=dt;}
  get down(){return this.state.phase==='touchdown';}
  /** Fly `control` until `stop` (or touchdown, or `maxSeconds`). */
  fly(control:(s:WingState)=>WingInput,stop:(s:WingState)=>boolean,maxSeconds=600):WingState{
    const t0=this.state.t;
    while(!this.down&&!stop(this.state)&&this.state.t-t0<maxSeconds){this.state=stepWing(this.state,control(this.state),this.env,this.dt);this.path.push(sample(this.state));}
    return this.state;
  }
  /** Track the ground line a → b (pure pursuit 40 m ahead) with bar `bar`; crabs into the wind. */
  line(a:readonly [number,number],b:readonly [number,number],bar:number|((s:WingState)=>number),stop:(s:WingState)=>boolean,maxBankDegrees=30,lookahead=40):WingState{
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
    return this.fly(s=>{
      const along=clamp((s.x-a[0])*ux+(s.z-a[1])*uz+lookahead,0,len+lookahead),target:[number,number]=[a[0]+ux*along,a[1]+uz*along];
      const heading=trackHeading(bearingTo(s,target),s.airspeed,this.env.wind);
      return{bar:typeof bar==='number'?bar:bar(s),bank:steer(s,heading,maxBankDegrees)};
    },stop);
  }
  /** Land: wings level, push out in the last `FLARE_START` metres. */
  land(maxSeconds=120,heading?:number):WingState{
    return this.fly(s=>({bar:s.y-this.env.ground(s.x,s.z)<FLARE_START?-1:0,bank:heading===undefined?steer(s,s.heading,0):steer(s,heading,15)}),()=>false,maxSeconds);
  }
  /**
   * Put the wing down inside a field: head for the centre at trim; over the middle with height to lose,
   * circle it (left, 20 m, min-sink bar above the flare band); below 2.5 m ease to a gentle 20° and push out in the last 1.5 m.
   */
  landOn(field:{xy:readonly [number,number];r:number},maxSeconds=240):WingState{
    const orbitR=Math.min(20,field.r/2);let final=false;
    return this.fly(s=>{
      const agl=s.y-this.env.ground(s.x,s.z),d=distanceTo(s,field.xy);
      // Below the 8 m flare band any push-out floats (sink → 0.3), so hold trim until the last 1.5 m;
      // from 2.5 m ease the bank to a gentle 20° the same way so the float curves back over the field.
      if(final||agl<2.5){final=true;return{bar:agl<FLARE_START?-1:0,bank:Math.sign(s.bank||-1)*20/50};}
      if(d>orbitR*1.5)return{bar:0,bank:steer(s,trackHeading(bearingTo(s,field.xy),s.airspeed,this.env.wind),40)};
      const dx=s.x-field.xy[0],dz=s.z-field.xy[1],n=Math.hypot(dx,dz)||1,rx=dx/n,rz=dz/n,k=clamp((n-orbitR)/orbitR,-1,1);
      const heading=trackHeading(Math.atan2(rz-rx*k,-rx-rz*k),s.airspeed,this.env.wind),feed=-Math.atan(s.airspeed*s.airspeed/(TURN_G*orbitR));
      return{bar:agl<8?0:-2/3,bank:clamp(feed-1.5*angleDiff(heading,s.heading),-45*DEG,45*DEG)/MAX_BANK};
    },()=>false,maxSeconds);
  }
}

function pad(env:JourneyEnv,id:string):readonly Point3[]{
  const p=env.envelope.launchPads?.find(p=>p.id===id);if(p)return p.edge;
  const l=env.envelope.launches.find(l=>l.id===id);
  if(!l||'empty' in l)throw new Error(`No launch ${id}`);
  return[[l.xy[0]-3,l.height??0,l.xy[1]],[l.xy[0]+3,l.height??0,l.xy[1]]];
}
function landing(env:JourneyEnv,id:string):{xy:readonly [number,number];h:number;r:number}{
  const l=env.envelope.landings.find(l=>l.id===id),v=env.envelope.volumes?.find(v=>v.id===id);
  if(!l||'empty' in l)throw new Error(`No landing ${id}`);
  return{xy:l.xy,h:l.height??env.ground(l.xy[0],l.xy[1]),r:v?.radius??Math.max(v?.halfSize[0]??40,v?.halfSize[2]??40)};
}
function gateVolume(env:JourneyEnv,id:string):FlightVolume{
  const v=env.envelope.volumes?.find(v=>v.id===id&&v.kind==='gate');if(!v)throw new Error(`No gate ${id}`);return v;
}
const launchXY=(edge:readonly Point3[]):[number,number]=>[(edge[0]![0]+edge.at(-1)![0])/2,(edge[0]![2]+edge.at(-1)![2])/2];
function result(p:Pilot,heightInHand:Record<string,number>,reached:boolean,gates:GateCrossing[]=[],measures:Record<string,number>={},corridor?:CorridorState):Journey{
  return{path:p.path,final:p.state,seconds:p.state.t,heightInHand,reached,gates,measures,...(corridor?{corridor}:{})};
}

/**
 * Launch (or continue from `from`) and fly the straight ground line to `to` at a fixed bar.
 * Stops at `to` (reached) or on touchdown. `heightInHand.arrival` = height at `to` − `arriveHeight`
 * (default: the ground there); on a touchdown short of `to` it is minus the height the flight lacked
 * (distance left × the trim slope).
 */
export function flyStraight(env:JourneyEnv,from:WingState|string,to:readonly [number,number],bar=0,options:{arriveHeight?:number;stopWithin?:number}={}):Journey{
  const edge=typeof from==='string'?pad(env,from):null,xy=edge?launchXY(edge):null;
  const start=edge&&xy?launchWing(edge,bearingTo({x:xy[0],z:xy[1]},to)):from as WingState;
  const p=new Pilot(env,start),a:[number,number]=[start.x,start.z],within=options.stopWithin??0;
  const len=distanceTo(start,to),ux=(to[0]-a[0])/len,uz=(to[1]-a[1])/len;
  const passed=(s:WingState)=>(s.x-to[0])*ux+(s.z-to[1])*uz>=0||distanceTo(s,to)<=within;
  p.line(a,to,bar,passed);
  const ref=options.arriveHeight??env.ground(to[0],to[1]),reached=!p.down;
  const inHand=reached?p.state.y-ref:-(distanceTo(p.state,to)-within)*TRIM_SLOPE;
  return result(p,{arrival:inHand},reached,[],{distanceLeft:reached?0:distanceTo(p.state,to)-within});
}

/** Crown launch → the Lamp gallery (h 25) on the straight line at trim. */
export function flyCrownToLamp(env:JourneyEnv):Journey{
  const lamp=env.envelope.launches.find(l=>l.id==='lampGallery');
  if(!lamp||'empty' in lamp)throw new Error('No lamp gallery');
  return flyStraight(env,'crown',lamp.xy,0,{arriveHeight:lamp.height??25});
}

/**
 * Circle a thermal's core (left-hand, `radius` m) at min-sink bar until `until(state)` or `maxSeconds`.
 * The orbit is flown as a ground track, so wind drift is crabbed out.
 */
function orbit(p:Pilot,core:readonly [number,number],radius:number,until:(s:WingState)=>boolean,maxSeconds:number):number{
  const t0=p.state.t,bar=-2/3;
  p.fly(s=>{
    const dx=s.x-core[0],dz=s.z-core[1],d=Math.hypot(dx,dz)||1,rx=dx/d,rz=dz/d;
    // Left-hand orbit: the centre lies on the rider's left, so the track is (rz, −rx), pulled toward the radius.
    const k=clamp((d-radius)/radius,-1,1),tx=rz-rx*k,tz=-rx-rz*k;
    const heading=trackHeading(Math.atan2(tx,tz),s.airspeed,p.env.wind),feed=-Math.atan(s.airspeed*s.airspeed/(TURN_G*radius));
    const err=angleDiff(heading,s.heading),want=clamp(feed*(d<radius*1.6?1:0)-1.5*err,-45*DEG,45*DEG);
    return{bar,bank:want/MAX_BANK};
  },s=>until(s),maxSeconds);
  return p.state.t-t0;
}

/**
 * The Prow → Long Sands (FLIGHT.md §0 row 2). `thermal: true` detours to the Prow thermal's core, circles
 * until the Sands are in reach at trim with 10 m to spare (or 60 s), then glides to the field.
 * `heightInHand.arrival` is measured at the field's edge (radius 60) above the field.
 */
export function flyProwToSands(env:JourneyEnv,options:{thermal?:boolean;maxThermalSeconds?:number}={}):Journey{
  const sands=landing(env,'sands'),edge=pad(env,'prow'),from=launchXY(edge);
  if(!options.thermal)return flyStraight(env,launchWing(edge,bearingTo({x:from[0],z:from[1]},sands.xy)),sands.xy,0,{arriveHeight:sands.h,stopWithin:sands.r});
  const thermal=env.envelope.volumes?.find(v=>v.id==='thermal.2')??env.envelope.volumes?.find(v=>v.kind==='thermal');
  if(!thermal)throw new Error('No Prow thermal');
  const core:[number,number]=[thermal.centre[0],thermal.centre[2]],p=new Pilot(env,launchWing(edge,bearingTo({x:from[0],z:from[1]},core)));
  p.line(from,core,0,s=>distanceTo(s,core)<=25);
  const enter=p.state.t,needed=(s:WingState)=>sands.h+(distanceTo(s,sands.xy)-sands.r)/(GLIDER_TRIM_MS/sinkAt(GLIDER_TRIM_MS))+10;
  const inThermal=p.down?0:orbit(p,core,25,s=>s.y>=needed(s),options.maxThermalSeconds??60);
  const leave=p.state.t,start:[number,number]=[p.state.x,p.state.z];
  p.line(start,sands.xy,0,s=>distanceTo(s,sands.xy)<=sands.r);
  const reached=!p.down;
  return result(p,{arrival:reached?p.state.y-sands.h:-(distanceTo(p.state,sands.xy)-sands.r)*TRIM_SLOPE,leaveThermal:p.path.find(q=>q.t>=leave)!.y},reached,[],{secondsInThermal:inThermal,enterThermal:enter});
}

/** Prow → the Reach meadow at trim; lands (flared) on the field. */
export function flyProwToMeadow(env:JourneyEnv):Journey{
  const meadow=landing(env,'reachMeadow'),edge=pad(env,'prow'),from=launchXY(edge),p=new Pilot(env,launchWing(edge,bearingTo({x:from[0],z:from[1]},meadow.xy)));
  p.line(from,meadow.xy,0,s=>distanceTo(s,meadow.xy)<=meadow.r);
  const reached=!p.down,arrival=reached?p.state.y-meadow.h:-(distanceTo(p.state,meadow.xy)-meadow.r)*TRIM_SLOPE;
  if(reached)p.landOn(meadow);
  return result(p,{arrival},reached&&distanceTo(p.state,meadow.xy)<=meadow.r,[],{touchdownFromMeadow:distanceTo(p.state,meadow.xy)});
}

/**
 * Hold a glide path to arrive at `to` at height `h`: trim when the path is shallow, a partial pull
 * when steeper, full bar plus ±60° weaves (S-turns, 6 s each) when even the dive is too shallow.
 * Stops on crossing the plane through `to` perpendicular to the leg.
 */
function glidePath(p:Pilot,from:readonly [number,number],to:readonly [number,number],h:number,maxBankDegrees=45):WingState{
  const len=distanceTo({x:from[0],z:from[1]},to),ux=(to[0]-from[0])/len,uz=(to[1]-from[1])/len;
  let weave=1,since=0;
  return p.fly(s=>{
    const d=Math.max(1,distanceTo(s,to)),slope=(s.y-h)/d;
    let bar=slope<=TRIM_SLOPE?0:barForSlope(slope),offset=0;
    since+=p.dt;if(since>6){since=0;weave=-weave;}
    if(slope>DIVE_SLOPE*1.02&&d>60){bar=1;offset=weave*60*DEG;}
    const heading=trackHeading(bearingTo(s,to)+offset,s.airspeed,p.env.wind);
    return{bar,bank:steer(s,heading,maxBankDegrees)};
  },s=>(s.x-to[0])*ux+(s.z-to[1])*uz>=0);
}

/**
 * The Dam Run (FLIGHT.md §2.6): Crown → gate 4 (the spillway arch, h 45) → gate 3 (under the High Span,
 * h 16, 40 × 14) → the Reach meadow. Gate 4 has no measured aperture: it is judged at ±6 m × ±6 m.
 * Each gate's plane is taken perpendicular to the leg that arrives at it.
 */
export function flyDamRun(env:JourneyEnv,options:{gate4Aperture?:Point2}={}):Journey{
  const g4=gateVolume(env,'damArch'),g3=gateVolume(env,'highSpan'),meadow=landing(env,'reachMeadow'),edge=pad(env,'crown'),from=launchXY(edge);
  const at4:[number,number]=[g4.centre[0],g4.centre[2]],at3:[number,number]=[g3.centre[0],g3.centre[2]];
  const p=new Pilot(env,launchWing(edge,bearingTo({x:from[0],z:from[1]},at4))),gates:GateCrossing[]=[];
  const record=(id:string,centre:Point3,aperture:Point2,a:readonly [number,number],b:readonly [number,number],fromIndex:number)=>{
    const yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);
    for(let i=Math.max(1,fromIndex);i<p.path.length;i++){const c=crossGate(id,p.path[i-1]!,p.path[i]!,centre,aperture,yaw);if(c){gates.push(c);return;}}
  };
  // Aim 4 m above the arch (inside ±6): arriving at the dive's 17 m/s costs height on the leg to gate 3.
  let mark=p.path.length;glidePath(p,from,at4,g4.centre[1]+4);record('damArch',g4.centre,options.gate4Aperture??[12,12],from,at4,mark-1);
  const h4=p.state.y-g4.centre[1];
  // Aim 6 m above gate 3's centre: the dive from gate 4 bleeds off slowly (1.5 m/s²) and costs height on the way.
  mark=p.path.length;if(!p.down)glidePath(p,at4,at3,g3.centre[1]+6,30);
  // Fly a little past the plane so the crossing is bracketed.
  if(!p.down)p.fly(()=>({bar:0,bank:0}),s=>distanceTo(s,at3)>2,1);
  record('highSpan',g3.centre,g3.aperture??[40,14],at4,at3,mark-1);
  const h3=gates.find(g=>g.id==='highSpan')?.vertical??NaN;
  if(!p.down)p.landOn(meadow);
  const onField=distanceTo(p.state,meadow.xy)<=meadow.r;
  return result(p,{gate4:h4,gate3:h3,landing:p.state.y-meadow.h},onField&&gates.length===2&&gates.every(g=>g.inside),gates,{touchdownFromMeadow:distanceTo(p.state,meadow.xy)});
}

/**
 * The Lamp Hop (FLIGHT.md §2.6): off the Lamp gallery, dive under the Bight Bridge (gate 5, h 6), then glide
 * on over the Bight's water until the wing touches it (the Bight is a fade to the sandbar).
 */
export function flyLampHop(env:JourneyEnv,options:{throughHeight?:number}={}):Journey{
  const g5=gateVolume(env,'bightBridge'),edge=pad(env,'lampGallery'),from=launchXY(edge),at5:[number,number]=[g5.centre[0],g5.centre[2]];
  const p=new Pilot(env,launchWing(edge,bearingTo({x:from[0],z:from[1]},at5))),target=options.throughHeight??g5.centre[1]+2;
  glidePath(p,from,at5,target,20);
  const yaw=Math.atan2(at5[0]-from[0],at5[1]-from[1]),gates:GateCrossing[]=[];
  if(!p.down)p.fly(s=>({bar:0,bank:steer(s,yaw,10)}),s=>distanceTo(s,at5)>2,1);
  for(let i=1;i<p.path.length;i++){const c=crossGate('bightBridge',p.path[i-1]!,p.path[i]!,g5.centre,g5.aperture??[24,16],yaw);if(c){gates.push(c);break;}}
  const h5=gates[0]?.vertical??NaN;
  if(!p.down)p.fly(s=>({bar:0,bank:steer(s,yaw,10)}),()=>false,60);
  return result(p,{gate5:h5},gates.length===1&&gates[0]!.inside&&p.down,gates,{hopLength:distanceTo(p.state,from)});
}

/**
 * Work the Crown's south-face ridge (FLIGHT.md §2.2): beat east–west along the box, turning away from the
 * face, until `targetHeight`. Starts from `from` or a south-facing Crown launch.
 */
export function workRidge(env:JourneyEnv,targetHeight:number,options:{from?:WingState;maxSeconds?:number}={}):Journey{
  const ridge=env.envelope.volumes?.find(v=>v.kind==='ridge');if(!ridge)throw new Error('No ridge');
  const edge=pad(env,'crown'),start=options.from??launchWing(edge,0),p=new Pilot(env,start);
  const z=ridge.centre[2]-ridge.halfSize[2]*.1,ends:[number,number][]=[[ridge.centre[0]-ridge.halfSize[0]*.8,z],[ridge.centre[0]+ridge.halfSize[0]*.8,z]];
  const entry:[number,number]=[ridge.centre[0],z];
  p.line([p.state.x,p.state.z],entry,0,s=>Math.abs(s.z-z)<5);
  const reach=p.state.t;let leg=1;
  const deadline=reach+(options.maxSeconds??600);
  while(!p.down&&p.state.y<targetHeight&&p.state.t<deadline){
    const to=ends[leg]!;
    p.fly(s=>({bar:0,bank:steer(s,trackHeading(bearingTo(s,to),s.airspeed,env.wind),45)}),s=>s.y>=targetHeight||distanceTo(s,to)<25,deadline-p.state.t);
    leg=1-leg;
  }
  return result(p,{top:p.state.y},p.state.y>=targetHeight,[],{secondsOnRidge:p.state.t-reach});
}

export interface ThroatRunOptions{
  /** Continue from here (e.g. after `workRidge`); default: a north-facing Crown launch. */
  from?:WingState;
  /** Metres flown out past gate 10 before the turn (default 60). */
  outbound?:number;
  /** Radius of the 180° turn (default 25). */
  turnRadius?:number;
  /** Bank limit of the S-turn back onto the axis (default 20°). */
  sBankDegrees?:number;
  gate?:ThroatGate;
  /** Fly the corridor to the splash, bar pushed out in the level run when true. */
  flare?:boolean;
}
/**
 * The Throat Run (FLIGHT.md §0 last row, §2.5): Crown → gate 10 (north face, h 130) → `outbound` m out to
 * sea → a 180° right turn of `turnRadius` → an S-turn back onto the chute's axis → gate 12's mouth.
 * `heightInHand.mouth` is the height at the mouth plane above the aperture's floor (101).
 */
export function flyThroatRun(env:JourneyEnv,options:ThroatRunOptions={}):Journey{
  const gate=options.gate??throatGate(env.envelope);
  const g10=gateVolume(env,'northFace'),at10:[number,number]=[g10.centre[0],g10.centre[2]],edge=pad(env,'crown'),from=options.from??launchWing(edge,Math.PI);
  const p=new Pilot(env,from),gates:GateCrossing[]=[],measures:Record<string,number>={};
  // 1. To gate 10, and through it.
  const a:[number,number]=[p.state.x,p.state.z];
  p.line(a,at10,0,s=>s.z<=at10[1]);
  const yaw10=Math.atan2(at10[0]-a[0],at10[1]-a[1]);
  for(let i=1;i<p.path.length;i++){const c=crossGate('northFace',p.path[i-1]!,p.path[i]!,g10.centre,g10.aperture??[24,16],yaw10);if(c)gates.push(c);}
  const h10=p.state.y-g10.centre[1];
  // 2. Out to sea.
  const outbound=options.outbound??60,outTo:[number,number]=[at10[0],at10[1]-outbound];
  if(!p.down)p.line(at10,[outTo[0],outTo[1]-200],0,s=>s.z<=outTo[1]);
  // 3. The 180° right turn at the radius's bank (heading north → east → south).
  const radius=options.turnRadius??25,turnStart=p.state.t,x0=p.state.x;let radiusSeen=0,n=0;
  if(!p.down)p.fly(s=>{
    const bank=Math.atan(s.airspeed*s.airspeed/(TURN_G*radius));
    if(Math.abs(s.bank-bank)<1*DEG){radiusSeen+=Math.abs(s.airspeed/turnRate(s.bank,s.airspeed));n++;}
    return{bar:0,bank:bank/MAX_BANK};
  },s=>Math.abs(angleDiff(s.heading,0))<=.2&&s.t-turnStart>1,30);
  measures.turnRadius=n?radiusSeen/n:NaN;measures.turnSeconds=p.state.t-turnStart;measures.turnOffset=p.state.x-x0;
  // 4. The S-turn back onto the axis, then straight at the mouth.
  const axisX=gate.mouth[0],sBank=options.sBankDegrees??20;
  let admitted=null as CorridorState|null,mouth=null as WingState|null;
  if(!p.down)p.fly(s=>{
    const target:[number,number]=[axisX,Math.min(gate.mouth[2],s.z+70)];
    return{bar:0,bank:steer(s,trackHeading(bearingTo(s,target),s.airspeed,env.wind),sBank,2.5)};
  },s=>{
    if(s.z>=gate.mouth[2]-3&&!mouth){admitted=enterCorridor(gate,s,'glider');if(admitted||s.z>=gate.mouth[2]){mouth=s;return true;}}
    return false;
  },120);
  const at=mouth as WingState|null;
  const inHand=at?at.y-(gate.mouth[1]-gate.aperture[1]/2):-Infinity;
  measures.mouthLateral=at?at.x-axisX:NaN;measures.mouthHeading=at?at.heading:NaN;measures.mouthBank=at?at.bank:NaN;
  measures.insideAperture=at&&insideAperture(gate,at)?1:0;
  // 5. Down the chute to the splash.
  let corridor:CorridorState|undefined=admitted??undefined;
  if(corridor){const bar=options.flare?-1:0;while(corridor.phase!=='touchdown'&&corridor.t<(admitted as CorridorState).t+60)corridor=stepCorridor(corridor,{bar,bank:0},p.dt);}
  return result(p,{gate10:h10,mouth:inHand},!!admitted,gates,measures,corridor);
}
