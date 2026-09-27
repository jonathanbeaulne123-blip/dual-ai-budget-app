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
import type {ThresholdOffer} from '../shared/threshold.ts';
import {HORIZON_MANIFEST} from '../../world/manifest.ts';
import type {ModeController,ModeId} from '../shared/mode.ts';
import type {VehicleDressing} from '../shared/vehicleArt.ts';
import type {MoverDeps} from '../shared/registry.ts';
import {createFlightArt} from './art.ts';
import {createGliderController,createParachuteController,stillDoor,type BailSource,type FlightController} from './controller.ts';
import {adaptFlightController} from './adapter.ts';
import {createGliderEnv,type GliderEnv} from './env.ts';
import {CHUTE} from './polar.ts';
import type {PlaneDoor} from './chute.ts';

/** The slice of the runtime M6 needs (tests pass a fake). */
export type GliderRuntime=Pick<HorizonRuntime,'registry'|'world'|'geography'|'assets'|'moverArt'|'settings'|'reviewDate'|'attachMover'|'body'>;
type LegacyGliderRuntime={
  movers:{register(id:Exclude<ModeId,'feet'>,factory:(offer:ThresholdOffer,threshold:Threshold)=>FlightController):()=>void;carried(id:string,provider:()=>{at:readonly [number,number];height:number}|null):()=>void};
  world:GliderRuntime['world']; geography:GliderRuntime['geography']; assets:GliderRuntime['assets'];
  moverArt:GliderRuntime['moverArt']; settings:GliderRuntime['settings']; reviewDate:GliderRuntime['reviewDate'];
  attachMover:(controller:FlightController)=>unknown; body:GliderRuntime['body'];
};
type GliderRuntimeLike=GliderRuntime|LegacyGliderRuntime;
const isLegacyRuntime=(runtime:GliderRuntimeLike):runtime is LegacyGliderRuntime=>'movers' in runtime;

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
export function registerBailOutProvider(runtime:GliderRuntimeLike,getPlane:BailSource,env:GliderEnv=gliderEnvFor(runtime)):()=>void{
  planes.set(runtime,getPlane);
  const registry=isLegacyRuntime(runtime)?runtime.movers:runtime.registry;
  // The ride registry keys moving thresholds by their carrier (`plane`); the
  // legacy flight registry keyed the same provider by the row id (`bailOut`).
  const off=registry.carried(isLegacyRuntime(runtime)?'bailOut':'plane',()=>{
    const p=getPlane();if(!p)return null;
    return p.y-env.groundAt(p.x,p.z,p.y)>=CHUTE.minBailAgl?{at:[p.x,p.z],height:p.y}:null;
  });
  return()=>{off();if(planes.get(runtime)===getPlane)planes.delete(runtime);};
}

function withArt(runtime:Pick<GliderRuntime,'moverArt'|'reviewDate'> & {settings:()=>{tier:'full'|'lite';theme?:VehicleDressing}},controller:FlightController){
  // Dev only: the evidence harness reads the step log from the controller that is riding (`probe()`).
  if(HARBOUR_DEV&&typeof window!=='undefined')(window as unknown as {__horizonFlight?:FlightController}).__horizonFlight=controller;
  const settings=runtime.settings();
  const art=createFlightArt(controller.id==='parachute'?'parachute':'glider',settings.theme??'classic',settings.tier,()=>solarPosition(runtime.reviewDate()).elevation<0);
  runtime.moverArt(art.root,(dt,figure)=>art.update(controller.artState(),dt,figure),()=>art.dispose());
  return controller;
}

export function registerGliderModes(runtime:GliderRuntimeLike):()=>void{
  const env=gliderEnvFor(runtime);
  if(isLegacyRuntime(runtime)){
    const settings=()=>runtime.settings(),flightDeps=()=>({env,tier:()=>settings().tier,reducedMotion:()=>settings().reducedMotion});
    const offGlider=runtime.movers.register('glider',()=>withArt(runtime as unknown as Pick<GliderRuntime,'moverArt'|'settings'|'reviewDate'>,createGliderController(flightDeps())));
    const offParachute=runtime.movers.register('parachute',()=>withArt(runtime as unknown as Pick<GliderRuntime,'moverArt'|'settings'|'reviewDate'>,createParachuteController({...flightDeps(),plane:()=>planes.get(runtime)?.()??null})));
    if(HARBOUR_DEV&&typeof location!=='undefined'){const bail=parseBailQuery(location.search);if(bail)startDevParachute(runtime,bail,env);}
    return()=>{offGlider();offParachute();};
  }
  const flightDeps=(deps:MoverDeps)=>({env,tier:()=>deps.tier,reducedMotion:()=>deps.reducedMotion});
  runtime.registry.register('glider',deps=>adaptFlightController(withArt(runtime,createGliderController(flightDeps(deps))),deps));
  runtime.registry.register('parachute',deps=>adaptFlightController(withArt(runtime,createParachuteController({...flightDeps(deps),plane:()=>planes.get(runtime)?.()??null})),deps));
  if(HARBOUR_DEV&&typeof location!=='undefined'){const bail=parseBailQuery(location.search);if(bail)startDevParachute(runtime,bail,env);}
  return()=>{};
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
export function startDevParachute(runtime:GliderRuntimeLike,at:{x:number;z:number;h:number},env:GliderEnv=gliderEnvFor(runtime)):ModeController|FlightController|null{
  if(!HARBOUR_DEV)return null;
  const settings=runtime.settings();if(settings.reducedMotion||settings.calm)return null;
  if(at.h-env.groundAt(at.x,at.z,at.h)<CHUTE.minBailAgl)return null;
  const door:PlaneDoor=stillDoor(at.x,at.h,at.z);
  const flight=withArt(runtime,createParachuteController({env,tier:()=>runtime.settings().tier,reducedMotion:()=>runtime.settings().reducedMotion,plane:()=>door}));
  const threshold:Threshold=runtime.world.thresholds.find(t=>t.id==='bailOut')??{id:'bailOut',at:[at.x,at.z],modes:['plane→parachute'],action:'jump',carried:'plane'};
  if(isLegacyRuntime(runtime)){
    runtime.attachMover(flight);
    return flight;
  }
  const offer={id:'bailOut:plane→parachute',thresholdId:threshold.id,at:[at.x,at.h,at.z] as [number,number,number],from:'plane' as const,to:'parachute' as const,action:'Jump',label:'Jump'};
  const controller=adaptFlightController(flight,{world:runtime.world,geography:runtime.geography,manifest:HORIZON_MANIFEST,reducedMotion:settings.reducedMotion,calm:settings.calm,tier:settings.tier});
  runtime.attachMover(controller,offer);
  return controller;
}
