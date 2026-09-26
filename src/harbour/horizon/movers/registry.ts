/**
 * The movers' registry (passes/02-movers.md, "Integrator duties"): exactly one active mode;
 * a mode starts only by accepting a `ThresholdOffer` that is valid now (CONTRACT §2.4);
 * `feet` is the runtime's own walk and has no controller. Pure: no scene or runtime import.
 */
import type {Threshold,WorldDefinition} from '../world/definition.ts';
import type {FlightModeController,ModeExit,ModeId,MoverBody} from './shared/mode.ts';
import {offersAt,thresholdTransitions,type CarriedProvider,type CarriedThreshold,type ThresholdOffer} from './shared/threshold.ts';

export type ModeFactory=(offer:ThresholdOffer,threshold:Threshold)=>FlightModeController;
/** The outcome of an accepted offer: a new controller to attach, or (for `X→feet`) where the body now stands. */
export interface AcceptResult{controller:FlightModeController|null;exit:ModeExit|null;threshold:Threshold}
export interface ModeRegistry{
  /** The one active mode; `feet` when no controller is active. */
  active():ModeId;
  controller():FlightModeController|null;
  /** Make a mode available. Returns an unregister function. */
  register(id:Exclude<ModeId,'feet'>,factory:ModeFactory):()=>void;
  /** A vehicle supplies a carried threshold's place each frame (the plane's door for `bailOut`). Returns an unregister function. */
  carried(thresholdId:string,provider:CarriedProvider):()=>void;
  /** Hold a mode back from a build (the gate's sign-off flag). A held mode offers nothing and cannot be accepted. */
  flag(id:ModeId,enabled:boolean):void;
  enabled(id:ModeId):boolean;
  /** Offers from the active mode, within reach, to modes that are registered and not held back (or to `feet`). */
  offers(body:MoverBody,reach?:number):ThresholdOffer[];
  /** Take an offer. Refused (null) unless it is one of `offers(body)` right now. */
  accept(offer:ThresholdOffer,body:MoverBody,reach?:number):AcceptResult|null;
  /** The active mode ended itself (a landing, a fade, a reduced-motion cut): back to feet. Never into another mode. */
  finish():ModeExit|null;
  /** The runtime already has the exit point (it called `exit()` itself): back to feet without calling `exit()` again. */
  release():void;
  setThresholds(thresholds:readonly Threshold[]):void;
}

export function createModeRegistry(initial:readonly Threshold[]=[]):ModeRegistry{
  let thresholds:readonly Threshold[]=initial,current:FlightModeController|null=null;
  const factories=new Map<ModeId,ModeFactory>(),providers=new Map<string,CarriedProvider>(),held=new Set<ModeId>();
  const active=():ModeId=>current?.id??'feet';
  function carriedNow():CarriedThreshold[]{
    const out:CarriedThreshold[]=[];
    for(const t of thresholds){
      if(!t.carried)continue;const provider=providers.get(t.id),at=provider?.();
      if(at&&Number.isFinite(at.at[0])&&Number.isFinite(at.at[1])&&Number.isFinite(at.height))out.push({...t,carried:t.carried,at:[at.at[0],at.at[1]],height:at.height});
    }
    return out;
  }
  const available=(to:ModeId)=>to==='feet'||(!held.has(to)&&factories.has(to));
  function offers(body:MoverBody,reach=3.6):ThresholdOffer[]{
    const from=active();
    const world={thresholds} as unknown as WorldDefinition;
    return offersAt(world,body,from,undefined,carriedNow()).filter(o=>Math.hypot(o.at[0]-body.x,o.at[2]-body.z)<=reach&&o.from===from&&available(o.to)).map(offer=>{
      const threshold=thresholds.find(t=>t.id===offer.thresholdId)!;
      const transition=thresholdTransitions(threshold).find(row=>row.from===offer.from&&row.to===offer.to);
      return transition?{...offer,action:transition.action,label:transition.action,height:offer.at[1]}:{...offer,height:offer.at[1]};
    });
  }
  return{
    active,controller:()=>current,
    register(id,factory){factories.set(id,factory);return()=>{if(factories.get(id)===factory)factories.delete(id);};},
    carried(id,provider){providers.set(id,provider);return()=>{if(providers.get(id)===provider)providers.delete(id);};},
    flag(id,enabled){if(id==='feet')return;if(enabled)held.delete(id);else held.add(id);},
    enabled:id=>id==='feet'||!held.has(id),
    offers,
    accept(offer,body,reach=3.6){
      const valid=offers(body,reach).find(o=>o.thresholdId===offer.thresholdId&&o.from===offer.from&&o.to===offer.to);if(!valid)return null;
      const threshold=thresholds.find(t=>t.id===valid.thresholdId)!,placed:Threshold=threshold.carried?{...threshold,at:[valid.at[0],valid.at[2]],height:valid.at[1]}:threshold;
      const previous=current,exit=previous?previous.exit():null;current=null;
      if(valid.to==='feet')return{controller:null,exit:exit??{at:[body.x,body.y,body.z],yaw:body.yaw},threshold:placed};
      const next=factories.get(valid.to)!(valid,placed);
      // A carried hand-off (plane → parachute) enters where the body is now: at the moving door.
      next.enter(placed,{x:body.x,y:body.y,z:body.z,yaw:body.yaw});current=next;
      return{controller:next,exit:null,threshold:placed};
    },
    finish(){if(!current)return null;const exit=current.exit();current=null;return exit;},
    release(){current=null;},
    setThresholds(next){thresholds=next;},
  };
}
