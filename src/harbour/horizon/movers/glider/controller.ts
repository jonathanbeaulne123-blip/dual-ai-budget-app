/**
 * The glider and parachute `ModeController`s (FLIGHT.md §2, §3, §9). They wire the pure simulation
 * (wing, corridor, chute, landing) to the runtime's mover hook: input in, body pose + camera + sound + HUD out.
 * No scene, no DOM: art is driven from `artState()` by `index.ts`, and headless tests drive these directly.
 *
 * The glider: accepting the offer puts the wing on (0.6 s) and faces the rider along the pad's edge; forward
 * input runs three steps to the lip (letting go stops there), then flight. Each frame the Throat is tried
 * within 40 m of its mouth. On touchdown `resolveTouchdown` decides: walk-off / tumble play a 0.8 s pose then
 * exit on the spot; every fade exits at once with a cut and a "→ place" label. Fold is the labelled fade to
 * the nearest reachable landing. There is no crash state.
 */
import type {FlightEnvelope,Point3,Threshold} from '../../world/definition.ts';
import type {ModeBodyPose,ModeCameraPose,ModeController,ModeExit,ModeHud,ModeInput,ReducedMotionLanding,Vec3} from '../shared/mode.ts';
import {MOVER_SOUNDS} from '../shared/mode.ts';
import {LANDING_LABELS,nearestReachableLanding,resolveTouchdown,type LandingOutcome} from './landing.ts';
import {DEEP_JETTY,corridorOutcome,enterCorridor,stepCorridor,throatGate,type CorridorState,type ThroatGate} from './corridor.ts';
import {WING_DT,launchWing,stepWing,type WingEnv,type WingState} from './wing.ts';
import {bailOut,stepChute,type ChuteState,type PlaneDoor} from './chute.ts';
import {createFlightCam,FLIGHT_CAM,walkCameraPose,type FlightCamState} from './camera.ts';
import {WALL_GRACE,type GliderEnv} from './env.ts';

export interface FlightControllerDeps{
  env:GliderEnv;
  tier?:()=>'full'|'lite';
  reducedMotion?:()=>boolean;
}
/** What the art needs each frame (index.ts → art.ts). */
export interface FlightArtState{
  kind:'glider'|'parachute';
  /** True once the controller has flown a frame (never under a reduced-motion cut). */
  flying:boolean;
  /** The controller has ended (exit() was called or it finished). */
  ended:boolean;
  stage:string;
  pose:ModeBodyPose;
  /** 0…1 of the canopy being open (parachute). */
  open:number;
  /** Seconds since touchdown (the fold / the gather), or null in the air. */
  landedFor:number|null;
  /** The exit was a fade (the wing is simply gone with the rider). */
  faded:boolean;
}
export interface FlightController extends ModeController{
  artState():FlightArtState;
  /** The simulation's current phase, for tests and the step log. */
  phase():string;
  outcome():LandingOutcome|null;
}

export const WEAR_SECONDS=.6;
export const POSE_SECONDS=.8;
/** `enterCorridor` is tried every step within this of gate 12's mouth. */
export const THROAT_TRY_RADIUS=40;
/** Seconds after the lip during which nothing under the wing can be touched (the legs trail off the lip). */
export const LIFTOFF_GRACE=.4;
const HUD_REFRESH=.25;
const DT=WING_DT;

/** Launch pad ids (sky.ts) ↔ threshold ids. */
export const PAD_THRESHOLDS:Record<string,string>={crown:'crownLaunch',prow:'prowPlatform',lampGallery:'lampGallery'};
const padFor=(envelope:FlightEnvelope,threshold:Threshold)=>envelope.launchPads?.find(p=>PAD_THRESHOLDS[p.id]===threshold.id||p.padId===`threshold.${threshold.id}`)??null;

/** A side "drops" when the ground 20 m past the lip is at least this far below the pad (a real run-off). */
export const RUN_DROP=10;
/**
 * The run-off heading: perpendicular to the pad's edge, on the side the rider faces if the ground falls away
 * there (≥ 10 m within 20 m of the lip), else the side that falls away more. The Crown's gentle south shoulder
 * therefore runs off north; the Prow's deck either way; the Lamp gallery over the sea.
 */
export function runHeading(edge:readonly Point3[],bodyYaw:number,groundAt:(x:number,z:number,y:number)=>number):number{
  const a=edge[0]!,b=edge.at(-1)!,ex=b[0]-a[0],ez=b[2]-a[2],cx=(a[0]+b[0])/2,cz=(a[2]+b[2])/2,h=(a[1]+b[1])/2;
  const n1=Math.atan2(ez,-ex),n2=Math.atan2(-ez,ex);
  const facing=(n:number)=>Math.cos(n-bodyYaw),first=facing(n1)>=facing(n2)?n1:n2,other=first===n1?n2:n1;
  const drop=(n:number)=>h-groundAt(cx+Math.sin(n)*20,cz+Math.cos(n)*20,h+.5);
  return drop(first)>=RUN_DROP||drop(first)>=drop(other)?first:other;
}

/** The pad's visible lip: the first point past the edge line (≤ 8 m) where the ground falls away by ≥ 0.75 m. */
export function lipOffset(edge:readonly Point3[],heading:number,groundAt:(x:number,z:number,y:number)=>number):number{
  const a=edge[0]!,b=edge.at(-1)!,cx=(a[0]+b[0])/2,cz=(a[2]+b[2])/2,h=(a[1]+b[1])/2;
  for(let s=0;s<=8;s+=.25)if(groundAt(cx+Math.sin(heading)*s,cz+Math.cos(heading)*s,h+.5)<h-.75)return s;
  return 0;
}

/** FLIGHT.md §6: the landings each pad offers under reduced motion (and calm view). */
export function padLandings(padId:string,env:Pick<GliderEnv,'envelope'|'shoreNode'>):ReducedMotionLanding[]{
  const field=(id:string,label=LANDING_LABELS[id]??id):ReducedMotionLanding|null=>{
    const l=env.envelope.landings.find(l=>l.id===id);if(!l||'empty' in l)return null;
    return{id,label,xy:[l.xy[0],l.xy[1]],...(l.height!==undefined?{height:l.height}:{})};
  };
  const deep:ReducedMotionLanding={id:'deep',label:'the Deep, through the Throat',xy:[DEEP_JETTY.at[0],DEEP_JETTY.at[2]],height:DEEP_JETTY.at[1]};
  const sandbar=():ReducedMotionLanding|null=>{const n=env.shoreNode(600,1030);return n?{id:'sandbar',label:'the sandbar',xy:[n.at[0],n.at[2]],height:n.at[1]}:null;};
  const list:(ReducedMotionLanding|null)[]=padId==='crown'?[field('green'),field('reachMeadow'),field('sands'),field('strip'),deep]
    :padId==='prow'?[field('reachMeadow'),field('sands','Long Sands (afternoon)'),field('green')]
    :padId==='lampGallery'?[sandbar(),field('strip',"the Flats' strip")]
    :[field('green'),field('reachMeadow'),field('sands')];
  return list.filter((l):l is ReducedMotionLanding=>l!==null);
}

/** The Fold bubble's target: the nearest reachable field, else the path node below (nobody is stuck in the sky). */
function foldTarget(env:GliderEnv,at:{x:number;y:number;z:number},mode:'glider'|'parachute'):{label:string;distance:number;at:Point3}|null{
  const reach=nearestReachableLanding(env.envelope,at,mode);
  if(reach){const l=env.envelope.landings.find(l=>l.id===reach.id),h=l&&!('empty' in l)?l.height:undefined;
    return{label:reach.label,distance:reach.distance,at:[reach.xy[0],h??env.groundAt(reach.xy[0],reach.xy[1],at.y),reach.xy[1]]};}
  const node=env.pathNode(at.x,at.z);
  return node?{label:node.label??'the path',distance:Math.hypot(node.at[0]-at.x,node.at[2]-at.z),at:node.at}:null;
}
const fadeKinds=new Set(['fadeShore','fadeApron','deepSmall','deepBig']);

type GliderStage='wear'|'run'|'flight'|'corridor'|'pose'|'done';
export function createGliderController(deps:FlightControllerDeps):FlightController{
  const {env}=deps,tier=deps.tier??(()=>'full' as const),reduced=deps.reducedMotion??(()=>false),gate:ThroatGate=throatGate(env.envelope);
  const cam=createFlightCam();
  let stage:GliderStage='wear',wing:WingState=launchWing([[0,0,0],[0,0,0]],0),corridor:CorridorState|null=null,padId='crown',wear=WEAR_SECONDS,acc=0,poseT=0,launchedAt=Infinity;
  let sound:string|null=null,outcome:LandingOutcome|null=null,exitAt:ModeExit|null=null,flying=false,ended=false,runStarted=false,hudT=Infinity,place:ModeHud['place'];
  let flyingY=0;
  const moving=()=>stage!=='pose'&&stage!=='done';
  const live=env.wingEnv(()=>flyingY,{walls:()=>wing.t-launchedAt>WALL_GRACE});
  // At the lip the wing lifts: the pad's own floor (which runs a few metres past the edge line) cannot catch it.
  const wingEnv:WingEnv={get wind(){return live.wind;},lift:live.lift,ground(x,z){const g=live.ground(x,z);return wing.t-launchedAt<LIFTOFF_GRACE?Math.min(g,flyingY-.05):g;}};
  const finish=(o:LandingOutcome,yaw:number)=>{
    outcome=o;
    if(fadeKinds.has(o.kind)){stage='done';exitAt={at:o.at,yaw,cut:true,label:o.label};}
    else{stage='pose';poseT=0;exitAt={at:o.at,yaw};cam.hold(cam.pose());}
  };
  function touchdown(){
    const t=wing.touch??{airspeed:wing.airspeed,sink:-wing.vs,groundSpeed:wing.airspeed};
    finish(resolveTouchdown(env.landingContext(wing.y),{x:wing.x,y:wing.y,z:wing.z,mode:'glider'},{airspeed:t.airspeed,sink:t.sink,groundSpeed:t.groundSpeed}),wing.heading);
  }
  function fold(){
    if(stage==='wear'||stage==='run'){stage='done';exitAt={at:[wing.x,wing.y,wing.z],yaw:wing.heading};outcome=null;return;}
    if(stage!=='flight')return;
    const target=foldTarget(env,wing,'glider');
    if(!target)return;
    finish({kind:'fadeApron',at:target.at,label:`→ ${target.label}`,rule:'field'},wing.heading);
  }
  function step(input:ModeInput){
    if(stage==='wear'){wear-=DT;if(wear<=0)stage='run';return;}
    if(stage==='run'){
      const before=wing.run??0;wing=stepWing(wing,{bar:input.bar,bank:0},wingEnv,DT);
      if(!runStarted&&(wing.run??0)>before){runStarted=true;cam.hold(null);cam.blendFrom(FLIGHT_CAM.blend.runOff,reduced());}
      if(wing.phase==='flight'){stage='flight';launchedAt=wing.t;sound=MOVER_SOUNDS.snap;}
      return;
    }
    if(stage==='flight'){
      flyingY=wing.y;wing=stepWing(wing,{bar:input.bar,bank:input.bank},wingEnv,DT);
      if(Math.hypot(wing.x-gate.mouth[0],wing.z-gate.mouth[2])<=THROAT_TRY_RADIUS){
        const c=enterCorridor(gate,wing,'glider');
        if(c){corridor=c;stage='corridor';cam.blendFrom(FLIGHT_CAM.blend.mouth,reduced());return;}
      }
      if(wing.phase==='touchdown')touchdown();
      return;
    }
    if(stage==='corridor'&&corridor){
      corridor=stepCorridor(corridor,{bar:input.bar,bank:input.bank},DT);
      if(corridor.phase==='touchdown'){const o=corridorOutcome(corridor);if(o){sound=MOVER_SOUNDS.splashEcho;finish(o,corridor.heading);}}
    }
  }
  const rider=():Vec3=>stage==='corridor'&&corridor?[corridor.x,corridor.y,corridor.z]:[wing.x,wing.y,wing.z];
  function camState():FlightCamState{
    if(stage==='corridor'&&corridor){
      const level=corridor.phase!=='corridor',slope=level?0:corridor.gate.slopeDegrees*Math.PI/180,h=corridor.speed*Math.cos(slope);
      return{kind:'corridor',rider:rider(),heading:corridor.heading,bank:corridor.bank,velocity:[Math.sin(corridor.heading)*h,-corridor.speed*Math.sin(slope),Math.cos(corridor.heading)*h],airspeed:corridor.speed,axis:{yaw:corridor.heading,slope,floor:corridor.gate.waterHeight}};
    }
    const [vx,vz]=wing.ground??[Math.sin(wing.heading)*wing.airspeed,Math.cos(wing.heading)*wing.airspeed];
    return{kind:'glider',rider:rider(),heading:wing.heading,bank:wing.bank,velocity:[vx,wing.vs,vz],airspeed:wing.airspeed};
  }
  let lastCamera:ModeCameraPose=walkCameraPose({x:0,y:0,z:0,yaw:0});
  const controller:FlightController={
    id:'glider',
    enter(threshold,body){
      const pad=padFor(env.envelope,threshold);
      padId=pad?.id??Object.entries(PAD_THRESHOLDS).find(([,t])=>t===threshold.id)?.[0]??threshold.id;
      const h=threshold.height??body.y,edge:Point3[]=pad?.edge??[[threshold.at[0]-3,h,threshold.at[1]],[threshold.at[0]+3,h,threshold.at[1]]];
      // Three steps down the graded pad to its visible lip (the edge line runs through the pad's marker).
      const heading=runHeading(edge,body.yaw,env.groundAt),lip=lipOffset(edge,heading,env.groundAt),dx=Math.sin(heading)*lip,dz=Math.cos(heading)*lip;
      wing=launchWing(edge.map(p=>[p[0]+dx,p[1],p[2]+dz] as Point3),heading,{run:true});
      stage='wear';wear=WEAR_SECONDS;acc=0;poseT=0;corridor=null;outcome=null;exitAt=null;sound=null;flying=false;ended=false;runStarted=false;launchedAt=Infinity;hudT=Infinity;
      cam.reset(wing.heading);
      // The walk cam holds until the first running step, then blends 0.8 s to the flight cam.
      lastCamera=walkCameraPose(body);cam.hold(lastCamera);
    },
    update(dt,input){
      sound=null;flying=true;
      if(input.fold)fold();
      if(stage==='pose'){poseT+=dt;return;}
      if(stage==='done')return;
      acc+=Math.min(.25,Math.max(0,dt));
      while(acc>=DT-1e-9&&moving()){step(input);acc-=DT;}
      // Held on the walk pose until the first running step (then the 0.8 s blend), and on the ground after touchdown.
      lastCamera=cam.update(camState(),{dt,tier:tier(),reducedMotion:reduced(),look:input.look,ground:env.groundAt,blocked:env.cameraBlocked,solid:env.solidAt});
      hudT+=dt;
    },
    exit(){ended=true;return exitAt??{at:[wing.x,wing.y,wing.z],yaw:wing.heading};},
    bodyPose():ModeBodyPose{
      if(stage==='pose'&&outcome){
        const tumble=outcome.kind==='tumble',k=Math.min(1,poseT/POSE_SECONDS);
        return{x:outcome.at[0],y:outcome.at[1],z:outcome.at[2],yaw:wing.heading,pitch:tumble?-2*Math.PI*k:0,bank:0};
      }
      if(stage==='corridor'&&corridor)return{x:corridor.x,y:corridor.y,z:corridor.z,yaw:corridor.heading,pitch:corridor.phase==='corridor'?-corridor.gate.slopeDegrees*Math.PI/180:0,bank:corridor.bank};
      const flightPitch=stage==='flight'?Math.atan2(wing.vs,Math.max(1,wing.airspeed)):0;
      return{x:wing.x,y:wing.y,z:wing.z,yaw:wing.heading,pitch:flightPitch,bank:stage==='flight'?wing.bank:0};
    },
    camera:()=>lastCamera,
    sound:()=>sound,
    reducedMotionCut:()=>({landings:padLandings(padId,env)}),
    hud():ModeHud{
      if(stage==='wear'||stage==='run')return{place:{label:'Step back',distance:0,action:'fold'}};
      if(stage==='corridor'&&corridor)return{height:corridor.y-corridor.gate.waterHeight,lift:0};
      if(stage!=='flight')return{};
      if(hudT>=HUD_REFRESH){hudT=0;const t=foldTarget(env,wing,'glider');place=t?{label:t.label,distance:t.distance,action:'fold'}:undefined;}
      return{height:wing.y-env.groundAt(wing.x,wing.z,wing.y),lift:wing.lift??0,...(place?{place}:{})};
    },
    finished:()=>stage==='done'||(stage==='pose'&&poseT>=POSE_SECONDS),
    phase:()=>stage==='corridor'&&corridor?corridor.phase==='corridor'?'corridor':corridor.phase:stage==='flight'?wing.phase:stage,
    outcome:()=>outcome,
    artState:()=>({kind:'glider',flying,ended,stage,pose:controller.bodyPose(),open:1,landedFor:stage==='pose'?poseT:stage==='done'?poseT:null,faded:stage==='done'&&!!exitAt?.cut}),
  };
  return controller;
}

/** What the plane hands the parachute at the door (M7's `bail()`), or a dev jump from a point. */
export type BailSource=()=>PlaneDoor|null;
type ChuteStage='freefall'|'opening'|'canopy'|'pose'|'done';
export interface ParachuteDeps extends FlightControllerDeps{
  /** The plane's door at the moment of the jump; absent → a still jump from the body. */
  plane?:BailSource;
}
export function createParachuteController(deps:ParachuteDeps):FlightController{
  const {env}=deps,tier=deps.tier??(()=>'full' as const),reduced=deps.reducedMotion??(()=>false),cam=createFlightCam();
  let chute:ChuteState|null=null,stage:ChuteStage='freefall',acc=0,poseT=0,sound:string|null=null,outcome:LandingOutcome|null=null,exitAt:ModeExit|null=null;
  let flying=false,ended=false,hudT=Infinity,place:ModeHud['place'],y=0,lastCamera:ModeCameraPose=walkCameraPose({x:0,y:0,z:0,yaw:0});
  const chuteEnv=env.chuteEnv(()=>y);
  const moving=()=>stage!=='pose'&&stage!=='done';
  const finish=(o:LandingOutcome,yaw:number)=>{
    outcome=o;
    if(fadeKinds.has(o.kind)){stage='done';exitAt={at:o.at,yaw,cut:true,label:o.label};}
    else{stage='pose';poseT=0;exitAt={at:o.at,yaw};cam.hold(cam.pose());}
  };
  function camYaw(){return cam.memory()?.yaw??chute?.heading??0;}
  function step(input:ModeInput){
    if(!chute)return;
    // The Move pad leans in the camera's frame: forward along its yaw, right = (−cos, sin) in engine axes.
    const cy=camYaw(),f=input.forward,s=input.strafe,lean:[number,number]=[Math.sin(cy)*f-Math.cos(cy)*s,Math.cos(cy)*f+Math.sin(cy)*s];
    y=chute.y;const before=chute.phase;
    chute=stepChute(chute,{lean,pull:input.pull,brake:Math.max(0,-input.bar),yaw:input.bank},chuteEnv,DT);
    if(chute.snapped&&before==='freefall'){sound=MOVER_SOUNDS.snap;cam.blendFrom(FLIGHT_CAM.blend.pull,reduced());}
    stage=chute.phase==='freefall'?'freefall':chute.phase==='opening'?'opening':'canopy';
    if(chute.phase==='touchdown'&&chute.touchdown){
      const t=chute.touchdown;
      finish(resolveTouchdown(env.landingContext(chute.y),{x:chute.x,y:chute.y,z:chute.z,mode:'parachute'},{airspeed:t.groundSpeed,sink:-chute.vy,groundSpeed:t.groundSpeed,flared:t.flared}),chute.heading);
    }
  }
  function fold(){
    if(!chute||stage!=='canopy')return;
    const target=foldTarget(env,chute,'parachute');if(target)finish({kind:'fadeApron',at:target.at,label:`→ ${target.label}`,rule:'field'},chute.heading);
  }
  function camState():FlightCamState{
    const c=chute!;
    return{kind:stage==='freefall'?'freefall':'canopy',rider:[c.x,c.y,c.z],heading:c.heading,bank:0,velocity:[c.vx,c.vy,c.vz],airspeed:Math.hypot(c.vx,c.vz)};
  }
  const controller:FlightController={
    id:'parachute',
    enter(threshold,body){
      const door=deps.plane?.()??{x:threshold.at[0]??body.x,y:threshold.height??body.y,z:threshold.at[1]??body.z,vx:0,vz:0,heading:body.yaw};
      const at={x:Number.isFinite(door.x)?door.x:body.x,y:Number.isFinite(door.y)?door.y:body.y,z:Number.isFinite(door.z)?door.z:body.z};
      y=at.y;chute=bailOut({...door,...at},at.y-env.groundAt(at.x,at.z,at.y));
      stage=chute?'freefall':'done';acc=0;poseT=0;outcome=null;sound=null;flying=false;ended=false;hudT=Infinity;
      exitAt=chute?null:{at:[body.x,body.y,body.z],yaw:body.yaw};
      cam.reset(chute?.heading??body.yaw);
      // The plane's chase cam (M7) hands over by a 0.3 s blend; from a point it starts on the freefall cam.
      lastCamera=walkCameraPose(body);
    },
    update(dt,input){
      sound=null;flying=true;
      if(input.fold)fold();
      if(stage==='pose'){poseT+=dt;return;}
      if(stage==='done'||!chute)return;
      acc+=Math.min(.25,Math.max(0,dt));
      while(acc>=DT-1e-9&&moving()){step(input);acc-=DT;}
      if(chute&&moving())lastCamera=cam.update(camState(),{dt,tier:tier(),reducedMotion:reduced(),look:input.look,ground:env.groundAt,blocked:env.cameraBlocked,solid:env.solidAt});
      hudT+=dt;
    },
    exit(){ended=true;return exitAt??(chute?{at:[chute.x,chute.y,chute.z],yaw:chute.heading}:{at:[0,0,0],yaw:0});},
    bodyPose():ModeBodyPose{
      if(stage==='pose'&&outcome){const tumble=outcome.kind==='tumble',k=Math.min(1,poseT/POSE_SECONDS);return{x:outcome.at[0],y:outcome.at[1],z:outcome.at[2],yaw:chute?.heading??0,pitch:tumble?-2*Math.PI*k:0,bank:0};}
      const c=chute;return c?{x:c.x,y:c.y,z:c.z,yaw:c.heading,pitch:0,bank:0}:{x:0,y:0,z:0,yaw:0};
    },
    camera:()=>lastCamera,
    sound:()=>sound,
    reducedMotionCut:()=>({landings:padLandings('parachute',env)}),
    hud():ModeHud{
      if(!chute||stage==='pose'||stage==='done')return{};
      const height=chute.y-env.groundAt(chute.x,chute.z,chute.y);
      if(stage==='freefall')return{height,place:{label:'Pull',distance:0,action:'pull'}};
      if(stage==='canopy'&&hudT>=HUD_REFRESH){hudT=0;const t=foldTarget(env,chute,'parachute');place=t?{label:t.label,distance:t.distance,action:'fold'}:undefined;}
      return{height,...(stage==='canopy'&&place?{place}:{})};
    },
    finished:()=>stage==='done'||(stage==='pose'&&poseT>=POSE_SECONDS),
    phase:()=>stage==='pose'||stage==='done'?stage:chute?.phase??stage,
    outcome:()=>outcome,
    artState:()=>({kind:'parachute',flying,ended,stage,pose:controller.bodyPose(),open:!chute?0:stage==='freefall'?0:stage==='opening'?Math.min(1,(chute.openT??0)/1.2):1,landedFor:stage==='pose'||stage==='done'?poseT:null,faded:stage==='done'&&!!exitAt?.cut}),
  };
  return controller;
}

/** A plane door at rest (for the dev jump and tests): no carried velocity, facing south, into the south wind. */
export function stillDoor(x:number,y:number,z:number,heading=0):PlaneDoor{return{x,y,z,vx:0,vz:0,heading};}
