/**
 * M6 wiring (FLIGHT.md §9): registers the glider and the parachute with the Horizon runtime's movers registry,
 * builds their env from the live runtime, and puts their greybox art in the scene through `runtime.moverArt`.
 *
 * - `registerGliderModes(runtime)` → an unregister function (the stage calls it on dispose).
 * - `registerBailOutProvider(runtime, getPlane)` is M7's plug: the plane reports its door each frame; the
 *   carried `bailOut` threshold is offered (as "Jump", a 0.5 s hold) only ≥ 60 m above the ground under it.
 * - Dev only (`HARBOUR_DEV`, like `?world=horizon`): `?bail=x,z,h` starts a parachute jump from that point.
 */
import {HARBOUR_DEV} from '../../../flag.ts';
import type {HorizonRuntime} from '../../runtime/index.ts';
import {solarPosition} from '../../sun/solar.ts';
import type {Threshold} from '../../world/definition.ts';
import type {ModeController} from '../shared/mode.ts';
import {createFlightArt} from './art.ts';
import {createGliderController,createParachuteController,stillDoor,type BailSource,type FlightController} from './controller.ts';
import {createGliderEnv,type GliderEnv} from './env.ts';
import {CHUTE} from './polar.ts';
import type {PlaneDoor} from './chute.ts';

/** The slice of the runtime M6 needs (tests pass a fake). */
export type GliderRuntime=Pick<HorizonRuntime,'movers'|'world'|'geography'|'assets'|'moverArt'|'settings'|'reviewDate'|'attachMover'|'body'>;

const HOUR_REFRESH_MS=5000;
/** The thermal clock: `solar.localMinutes / 60` of the runtime's review date (frozen at 15:30 under reduced motion or calm). */
export function runtimeHour(runtime:Pick<GliderRuntime,'reviewDate'>,now:()=>number=()=>Date.now()):()=>number{
  let at=-Infinity,hour=15.5;
  return()=>{const t=now();if(t-at>=HOUR_REFRESH_MS){at=t;try{hour=solarPosition(runtime.reviewDate()).localMinutes/60;}catch{/* keep the last hour */}}return hour;};
}
export function gliderEnvFor(runtime:Pick<GliderRuntime,'world'|'geography'|'assets'|'reviewDate'>):GliderEnv{
  return createGliderEnv({world:runtime.world,geography:runtime.geography,cuts:runtime.assets.cuts},{hour:runtimeHour(runtime),clock:()=>performance.now()/1000});
}

const planes=new WeakMap<object,BailSource>();
/**
 * M7's plug (FLIGHT.md §3.1, §9 ask 6): `getPlane()` returns the plane's door (position, velocity, heading) or
 * null. The carried `bailOut` threshold follows it and is offered only at ≥ 60 m above the ground under the plane.
 */
export function registerBailOutProvider(runtime:Pick<GliderRuntime,'movers'|'world'|'geography'|'assets'|'reviewDate'>,getPlane:BailSource,env:GliderEnv=gliderEnvFor(runtime)):()=>void{
  planes.set(runtime,getPlane);
  const off=runtime.movers.carried('bailOut',()=>{
    const p=getPlane();if(!p)return null;
    return p.y-env.groundAt(p.x,p.z,p.y)>=CHUTE.minBailAgl?{at:[p.x,p.z],height:p.y}:null;
  });
  return()=>{off();if(planes.get(runtime)===getPlane)planes.delete(runtime);};
}

function withArt(runtime:Pick<GliderRuntime,'moverArt'|'settings'>,controller:FlightController){
  const art=createFlightArt(controller.id==='parachute'?'parachute':'glider','classic',runtime.settings().tier);
  runtime.moverArt(art.root,(dt,figure)=>art.update(controller.artState(),dt,figure),()=>art.dispose());
  return controller;
}

export function registerGliderModes(runtime:GliderRuntime):()=>void{
  const env=gliderEnvFor(runtime),deps={env,tier:()=>runtime.settings().tier,reducedMotion:()=>runtime.settings().reducedMotion};
  const offs=[
    runtime.movers.register('glider',()=>withArt(runtime,createGliderController(deps))),
    runtime.movers.register('parachute',()=>withArt(runtime,createParachuteController({...deps,plane:()=>planes.get(runtime)?.()??null}))),
  ];
  if(HARBOUR_DEV&&typeof location!=='undefined'){const bail=parseBailQuery(location.search);if(bail)startDevParachute(runtime,bail,env);}
  return()=>{for(const off of offs)off();};
}

/** `?bail=x,z,h` (engine units; h absolute). Null unless three finite numbers. */
export function parseBailQuery(search:string):{x:number;z:number;h:number}|null{
  const raw=new URLSearchParams(search).get('bail');if(!raw)return null;
  const [x,z,h]=raw.split(',').map(Number);
  return [x,z,h].every(v=>v!==undefined&&Number.isFinite(v))?{x:x!,z:z!,h:h!}:null;
}
/**
 * Dev-only acceptance harness: a parachute jump from a point, as if the plane's door were there (no plane yet,
 * M7). Refused under reduced motion or calm (no flight there) and below 60 m above the ground.
 */
export function startDevParachute(runtime:GliderRuntime,at:{x:number;z:number;h:number},env:GliderEnv=gliderEnvFor(runtime)):ModeController|null{
  if(!HARBOUR_DEV)return null;
  const settings=runtime.settings();if(settings.reducedMotion||settings.calm)return null;
  if(at.h-env.groundAt(at.x,at.z,at.h)<CHUTE.minBailAgl)return null;
  const door:PlaneDoor=stillDoor(at.x,at.h,at.z);
  const controller=withArt(runtime,createParachuteController({env,tier:()=>runtime.settings().tier,reducedMotion:()=>runtime.settings().reducedMotion,plane:()=>door}));
  const threshold:Threshold=runtime.world.thresholds.find(t=>t.id==='bailOut')??{id:'bailOut',at:[at.x,at.z],modes:['plane→parachute'],action:'jump',carried:'plane'};
  controller.enter({...threshold,at:[at.x,at.z],height:at.h},{x:at.x,y:at.h,z:at.z,yaw:door.heading});
  runtime.attachMover(controller);
  return controller;
}
