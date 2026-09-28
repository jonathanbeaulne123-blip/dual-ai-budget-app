import {isCraft,type FleetAction} from './movers/fleet/model.ts';
import {perspectiveLabel} from './runtime/perspective.ts';
import {HARBOUR_DEV} from '../flag.ts';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {HorizonRuntime,HorizonOptions,HorizonMode,HorizonMoverState} from './runtime/index.ts';
import type {ThresholdOffer} from './movers/shared/threshold.ts';
import type {ReducedMotionCut,ReducedMotionLanding} from './movers/shared/mode.ts';
import type {Host} from './world/definition.ts';
import type {HouseBodyReturn} from '../../house/navigation.ts';
import type {PlaceWalkSource} from '../scene/place.ts';
import {appCalm,appReducedMotion} from './sun/comfort.ts';
import './horizon.css';
import type {ThemeId} from '../../theme/scenes.ts';
import {HORIZON_MANIFEST} from './world/manifest.ts';
export type HorizonStageProps={fleetStorageKey?:string;onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onRuntime?:(runtime:HorizonRuntime|null)=>void;onQuickSheet?:()=>void;onJourney?:()=>void;initialBody?:HouseBodyReturn;partner?:PlaceWalkSource|null;paused?:boolean;children?:ReactNode;review?:boolean;theme?:ThemeId;
  /** The app's calm view (useComfort().quiet). Without it the stage reads html[data-quiet]. */calm?:boolean;
  /** The app's reduced-motion setting (useComfort().motion==='reduced'); html[data-motion] and the OS query are read too. */reducedMotion?:boolean;
  /** The world's sound (a deliberate gesture enables it; `comfort.sound` owns the setting). */
  sound?:{on:boolean;toggle:()=>void}};
/** Reduced motion is live: the app's prop (useComfort), the system setting or Hearth's own comfort choice (`data-motion`, written by `theme/comfort.ts`). */
const readReducedMotion=(props?:Pick<HorizonStageProps,'reducedMotion'>)=>props?.reducedMotion===true||appReducedMotion();
/** Calm view is the comfort module's Quiet choice: the app's prop, else `data-quiet` as applied by `applyComfort`. */
const readCalm=(props?:Pick<HorizonStageProps,'calm'>)=>props?.calm??appCalm();
/** A vehicle-to-vehicle hand-off (the plane's Jump) is a 0.5 s hold, so a stray tap does nothing (FLIGHT.md §3.1). */
const HOLD_MS=(HORIZON_MANIFEST.carriedThresholds.find(threshold=>threshold.id==='bailOut')?.hold_s??.5)*1000;
const offerKey=(o:ThresholdOffer)=>`${o.thresholdId}:${o.from}:${o.to}`;
export const WALK_STATUS='Drag to look. Walk with W A S D, Space jumps; E opens a nearby door.';
export const RIDE_PAUSED_STATUS='The ride waits where you left it. Choose Walk to ride on.';
export function statusTextFor({riding,offerLabel,paused,flight}:{riding:boolean;offerLabel?:string|null;paused?:boolean;flight?:boolean}):string{
  if(riding)return paused?RIDE_PAUSED_STATUS:flight?'Flying. W/S set the bar, A/D bank; use the landing bubble.':'Riding. W pushes, S slides, A D steer, Space pops, E parks.';
  return offerLabel?`E · ${offerLabel}`:WALK_STATUS;
}
export default function HorizonStage(props:HorizonStageProps){
  const stage=useRef<HTMLDivElement>(null),runtime=useRef<HorizonRuntime|null>(null),latest=useRef(props);latest.current=props;
  const [status,setStatus]=useState('Loading the Horizon…'),[ready,setReady]=useState(false),[mode,setMode]=useState<HorizonMode>('look'),[page,setPage]=useState('A');
  const [reducedMotion,setReducedMotion]=useState(()=>readReducedMotion(props)),[calm,setCalm]=useState(()=>readCalm(props));
  const [offers,setOffers]=useState<ThresholdOffer[]>([]),[mover,setMover]=useState<HorizonMoverState|null>(null),[sheet,setSheet]=useState<ReducedMotionCut|null>(null),hold=useRef<number|null>(null),jumpPointer=useRef<number|null>(null);
  const [boatActions,setBoatActions]=useState<FleetAction[]>([]),[fleetState,setFleetState]=useState<ReturnType<HorizonRuntime['fleetState']>|null>(null);
  const [tier]=useState<'full'|'lite'>(()=>new URLSearchParams(location.search).get('tier')==='lite'||matchMedia('(max-width: 600px)').matches?'lite':'full');
  useEffect(()=>{const controller=new AbortController();let current:HorizonRuntime|null=null,unregister:(()=>void)|null=null;
    const options:HorizonOptions={tier,fleetStorageKey:latest.current.fleetStorageKey,theme:latest.current.theme,hideBuildings:HARBOUR_DEV&&new URLSearchParams(location.search).get('hideBuildings')==='1',signal:controller.signal,reducedMotion:readReducedMotion(latest.current),calm:readCalm(latest.current),onDoor:(h,b)=>latest.current.onDoor?.(h,b),onStatus:setStatus,initialBody:latest.current.initialBody,partner:()=>latest.current.partner??null};
    // The movers (M6: the glider and the parachute) register on the runtime as soon as it exists.
    Promise.all([import('../scene/worldMount.ts').then(m=>m.mountHorizonWorld(stage.current!,options)),import('./movers/glider/index.ts')]).then(([world,gliders])=>{
      if(controller.signal.aborted){world.dispose();return;}current=world;unregister=gliders.registerGliderModes(world);runtime.current=world;setMode(world.mode());setPage(world.shotId());setReady(true);setStatus('Drag to look. Walk with W A S D, or use the pads. Space jumps; E opens a nearby door.');latest.current.onRuntime?.(world);latest.current.onReady?.();
      if(HARBOUR_DEV)(window as unknown as {__harbour:unknown}).__harbour=world;
    }).catch(error=>{if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'The Horizon could not open.');});
    return()=>{controller.abort();unregister?.();current?.dispose();if(HARBOUR_DEV){const debug=window as unknown as {__harbour?:HorizonRuntime};if(debug.__harbour===current)delete debug.__harbour;}runtime.current=null;latest.current.onRuntime?.(null);};
  },[tier]);
  useEffect(()=>{runtime.current?.pause(props.paused===true);},[props.paused,ready]);
  // Comfort is live (CONTRACT §2.10): the app's props (useComfort), html[data-motion] / html[data-quiet] and the OS query, without a remount.
  useEffect(()=>{setReducedMotion(readReducedMotion(props));setCalm(readCalm(props));},[props.calm,props.reducedMotion]);
  useEffect(()=>{
    if(typeof MutationObserver==='undefined')return;
    const media=matchMedia('(prefers-reduced-motion: reduce)'),sync=()=>{setReducedMotion(readReducedMotion(latest.current));setCalm(readCalm(latest.current));};
    media.addEventListener?.('change',sync);const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','data-quiet']});
    return()=>{media.removeEventListener?.('change',sync);observer.disconnect();};
  },[]);
  // One path to the runtime: setComfort sets the land's motion (cuts, frozen 15:30) and the movers' registry together.
  useEffect(()=>{runtime.current?.setComfort({calm,reducedMotion});},[reducedMotion,calm,ready]);
  useEffect(()=>{
    if(!ready)return;let last='';
    const poll=window.setInterval(()=>{
      const world=runtime.current;if(!world)return;
      setBoatActions(world.fleetActions());setFleetState(world.fleetState());
      const next={offers:world.offers(),mover:world.moverState(),mode:world.mode()},hud=next.mover.hud;
      const key=JSON.stringify([next.offers.map(offerKey),next.offers.map(o=>o.action),next.mover.mode,next.mover.attached,next.mover.airborne,next.mover.stowed,next.mover.perspective,next.mode,hud&&[Math.round(hud.height??-1),Math.sign(Math.trunc((hud.lift??0)/.5)),hud.place?.label,Math.round(hud.place?.distance??0),hud.place?.action],next.mover.fade,next.mover.cut?.landings.map(landing=>landing.id)]);
      if(key===last)return;last=key;setOffers(next.offers);setMover(next.mover);setMode(next.mode);
      if(isCraft(next.mover.mode)){setStatus('W / ↑ accelerates · S / ↓ slows then reverses · A / D steer · Space brakes · E interacts · C camera.');return;}
      if(next.mover.mode==='parachute')setStatus(`${hud?.place?.label??'Airborne'}. Space opens or retracts; A/D steer, S brakes. C changes view.`);
      else if(next.mover.attached||next.offers.length>0)setStatus(statusTextFor({riding:next.mover.attached,offerLabel:next.offers[0]?.action,paused:typeof world.ridePaused==='function'&&world.ridePaused(),flight:next.mover.mode==='glider'}));
    },200);
    return()=>window.clearInterval(poll);
  },[ready]);
  useEffect(()=>{
    const release=(e:PointerEvent)=>{if(e.pointerId!==jumpPointer.current)return;jumpPointer.current=null;runtime.current?.jumpHold(false);};
    const blur=()=>{jumpPointer.current=null;runtime.current?.jumpHold(false);};
    window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);window.removeEventListener('blur',blur);blur();};
  },[]);
  useEffect(()=>()=>{if(hold.current!==null)window.clearTimeout(hold.current);},[]);
  function take(offer:ThresholdOffer){
    const result=runtime.current?.accept(offer);if(!result)return;
    if(result.cut)setSheet(result.cut);else stage.current?.focus();
  }
  function holdStart(offer:ThresholdOffer){if(hold.current!==null)window.clearTimeout(hold.current);hold.current=window.setTimeout(()=>{hold.current=null;take(offer);},HOLD_MS);}
  function holdEnd(){if(hold.current!==null){window.clearTimeout(hold.current);hold.current=null;}}
  function cut(to:{kind:'landing';landing:ReducedMotionLanding}|{kind:'view';id:string}|{kind:'stay'}){
    const world=runtime.current;setSheet(null);if(!world)return;world.cutTo(to);
    if(to.kind==='view'){setPage(to.id);setMode('look');}else setMode(world.mode());stage.current?.focus();
  }
  const sheetTitle=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{
    if(!sheet)return;
    sheetTitle.current?.focus();
    const escape=(event:KeyboardEvent)=>{if(event.key!=='Escape')return;event.preventDefault();cut({kind:'stay'});};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[sheet]);
  useEffect(()=>{if(mover?.cut&&!sheet)setSheet(mover.cut);},[mover?.cut,sheet]);
  function changeMode(next:HorizonMode){setMode(next);runtime.current?.setMode(next);stage.current?.focus();}
  function pad(event:React.PointerEvent<HTMLDivElement>,kind:'move'|'look'){
    if(event.type==='pointerup'||event.type==='pointercancel'){runtime.current?.input({forward:0,strafe:0});return;}
    if(event.type==='pointerdown')event.currentTarget.setPointerCapture(event.pointerId);
    else if(!event.currentTarget.hasPointerCapture(event.pointerId))return;
    const box=event.currentTarget.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-box.left-box.width/2)/(box.width*.36))),y=Math.max(-1,Math.min(1,(event.clientY-box.top-box.height/2)/(box.height*.36)));
    if(kind==='move')runtime.current?.input({forward:-y,strafe:x});else runtime.current?.look(-x*.08,-y*.06);
  }
  return <section className={`horizon-shell horizon-shell--${props.theme??'classic'} ${props.review?'horizon-shell--review':''}`} aria-label="Horizon land review">
    <div ref={stage} className="horizon-stage" tabIndex={props.paused?-1:0} aria-label="Horizon. Drag to look. W A S D moves, Space jumps or brakes a boat, E interacts, C changes camera." />
    {!props.paused&&ready&&mode==='walk'&&<div className="horizon-fleet" role="group" aria-label="Boating and yacht">
      <div className="horizon-fleet__heading"><strong>{mover&&isCraft(mover.mode)?mover.mode==='yacht'?'Yacht helm':mover.mode:fleetState?.swimming?'Swimming':'Offshore fleet'}</strong><button onClick={()=>{runtime.current?.cycleCamera();stage.current?.focus();}}>Camera · C</button></div>
      {mover&&isCraft(mover.mode)?<p>{(mover.hud as {pace?:string})?.pace} · {mover.mode==='yacht'?(fleetState?.vessels.find(v=>v.id==='yacht')?.anchor?'Anchor down':'Anchor raised'):'Hold W to go; S slows and reverses.'}</p>:<p>{fleetState?.swimming?'Swim with the movement pad or W A S D. The yacht ladder is at the stern.':'Kayak, dinghy and motorboat: east side of the float dock. The yacht is offshore to the southeast.'}</p>}
      <div className="horizon-fleet__actions">{boatActions.map((a,i)=><button key={a.id} onClick={()=>{runtime.current?.fleetAction(a.id);stage.current?.focus();}}>{a.label}{i===0?' · E':''}</button>)}</div>
      {fleetState?.saveFailed&&<p role="status">Boats are saved for this visit only; device storage is unavailable.</p>}
    </div>}
    {!props.paused&&<div className="horizon-offer" role="status" data-empty={mode==='walk'&&offers.length>0?undefined:'true'}><span className="horizon-offer__text">{mode==='walk'&&offers[0]?`E · ${offers[0].action}`:''}</span></div>}
    {!props.paused&&<>
      <div className="horizon-toolbar" aria-label="World controls">
        {(['walk','look','journey']as const).map(m=><button key={m} disabled={!ready} aria-pressed={mode===m} onClick={()=>changeMode(m)}>{m==='journey'?'Island':m==='walk'?'Walk':'Look'}</button>)}
        {mode==='walk'&&<button disabled={!ready} onClick={()=>{runtime.current?.cyclePerspective();stage.current?.focus();}} aria-label="Change camera perspective (C)">{perspectiveLabel(mover?.perspective??'activity')}</button>}
        <label>Page <select aria-label="Sketchbook page" value={page} disabled={!ready} onChange={e=>{setPage(e.target.value);setMode('look');runtime.current?.shot(e.target.value);}}>{'ABCDEFGHIJKL'.split('').map(p=><option key={p}>{p}</option>)}</select></label>
        {props.onQuickSheet&&<button onClick={props.onQuickSheet}>Tools</button>}
        {props.onJourney&&<button onClick={props.onJourney}>Journey</button>}
        {props.sound&&<button aria-pressed={props.sound.on} onClick={props.sound.toggle}>{props.sound.on?'Sound on':'Sound off'}</button>}
      </div>
      {ready&&mode==='walk'&&<div className="horizon-touch-controls">
        <div className="horizon-pad" role="group" aria-label={mover&&isCraft(mover.mode)?'Move pad: accelerate, reverse and steer the boat':mover?.mode==='parachute'?'Move pad: steer and brake the parachute':mover?.attached?'Move pad: push and pull the bar, lean to bank':'Move pad'} onPointerDown={e=>pad(e,'move')} onPointerMove={e=>pad(e,'move')} onPointerUp={e=>pad(e,'move')} onPointerCancel={e=>pad(e,'move')}>Move</div>
        {mover&&isCraft(mover.mode)&&<button className="horizon-jump" onPointerDown={()=>runtime.current?.jumpHold(true)} onPointerUp={()=>runtime.current?.jumpHold(false)} onPointerCancel={()=>runtime.current?.jumpHold(false)} onPointerLeave={()=>runtime.current?.jumpHold(false)}>Brake</button>}
        {(mover?.mode==='board'||mover?.mode==='bicycle'&&mover.airborne)&&<button className="horizon-jump" onPointerDown={e=>{e.preventDefault();stage.current?.focus();jumpPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);runtime.current?.jumpHold(true);}} onClick={e=>{if(e.detail===0){stage.current?.focus();runtime.current?.jump();}}}>{mover.airborne?'Open parachute':'Jump'}</button>}
        {!mover?.attached&&<><button className="horizon-jump" onClick={()=>{stage.current?.focus();runtime.current?.jump();}}>Jump</button>
        <button onClick={()=>runtime.current?.accept()}>Interact</button>
        {mover?.stowed&&<button onClick={()=>{runtime.current?.resumeEquipment();stage.current?.focus();}}>Ride {mover.stowed}</button>}</>}
        <div className="horizon-pad" role="group" aria-label="Look pad" onPointerDown={e=>pad(e,'look')} onPointerMove={e=>pad(e,'look')} onPointerUp={e=>pad(e,'look')} onPointerCancel={e=>pad(e,'look')}>Look</div>
      </div>}
      {ready&&!sheet&&offers.length>0&&<div className="horizon-offers" role="group" aria-label="Change how you travel here">
        {offers.map(offer=>{const held=offer.from!=='feet'&&offer.to!=='feet';return <button key={offerKey(offer)} className={held?'horizon-offer horizon-offer--hold':'horizon-offer'} aria-label={held?`${offer.action} (press and hold)`:offer.action}
          onClick={e=>{if(!held||e.detail===0)take(offer);}} onPointerDown={held?()=>holdStart(offer):undefined} onPointerUp={held?holdEnd:undefined} onPointerLeave={held?holdEnd:undefined} onPointerCancel={held?holdEnd:undefined}>{offer.action}</button>;})}
      </div>}
      {ready&&mover?.attached&&mover.hud?.height!==undefined&&<p className="horizon-bubble horizon-bubble-height" aria-live="off">
        <span>{Math.max(0,Math.round(mover.hud.height))} m</span>{Math.abs(mover.hud.lift??0)>=.5&&<span className="horizon-bubble-lift" aria-label={(mover.hud.lift??0)>0?'rising':'sinking'}>{(mover.hud.lift??0)>0?'↑':'↓'}</span>}
      </p>}
      {ready&&mover?.attached&&mover.hud?.place&&(()=>{const place=mover.hud.place,text=place.action==='pull'||!(place.distance>0)?place.label:`${place.label} · ${Math.round(place.distance)} m`;
        return place.action==='gate'?<p className="horizon-bubble horizon-bubble-place">{text}</p>
          :<button className="horizon-bubble horizon-bubble-place" onClick={()=>{stage.current?.focus();runtime.current?.moverAction(place.action);}} aria-label={place.action==='fold'?`Land now: ${text}`:text}>{text}</button>;})()}
      {ready&&!mover?.attached&&mover?.fade&&<p className="horizon-bubble horizon-bubble-place horizon-bubble-fade" role="status">{mover.fade}</p>}
      {sheet&&<div className="horizon-sheet" role="dialog" aria-modal="false" aria-labelledby="horizon-sheet-title">
        <h2 ref={sheetTitle} id="horizon-sheet-title" tabIndex={-1}>Where to?</h2>
        {sheet.landings.length>0&&<><h3>Land at</h3><ul>{sheet.landings.map(landing=><li key={landing.id}><button onClick={()=>cut({kind:'landing',landing})}>{landing.label}</button></li>)}</ul></>}
        <h3>Sketchbook pages</h3>
        <ul className="horizon-sheet-pages">{(runtime.current?.world.views??[]).map(view=><li key={view.id}><button onClick={()=>cut({kind:'view',id:view.id})}>{view.id}{view.label?` · ${view.label}`:''}</button></li>)}</ul>
        <button className="horizon-sheet-stay" onClick={()=>cut({kind:'stay'})}>Stay here</button>
      </div>}
      <p className="horizon-status" role="status">{status}</p>
    </>}
    {props.children}
  </section>;
}
