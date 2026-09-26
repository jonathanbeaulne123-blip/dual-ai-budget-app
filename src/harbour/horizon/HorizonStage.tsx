import {HARBOUR_DEV} from '../flag.ts';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {HorizonRuntime,HorizonOptions,HorizonMode,HorizonMoverState} from './runtime/index.ts';
import type {ThresholdOffer} from './movers/shared/threshold.ts';
import type {ReducedMotionCut,ReducedMotionLanding} from './movers/shared/mode.ts';
import type {Host} from './world/definition.ts';
import type {HouseBodyReturn} from '../../house/navigation.ts';
import type {PlaceWalkSource} from '../scene/place.ts';
import './horizon.css';
export type HorizonStageProps={onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onRuntime?:(runtime:HorizonRuntime|null)=>void;onQuickSheet?:()=>void;onJourney?:()=>void;initialBody?:HouseBodyReturn;partner?:PlaceWalkSource|null;paused?:boolean;children?:ReactNode;review?:boolean};
/** Reduced motion is live: the system setting or Hearth's own comfort choice (`data-motion`, written by `theme/comfort.ts`). */
const readReducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';
/** Calm view is the comfort module's Quiet choice, applied as `data-quiet` by `applyComfort`. */
const readCalm=()=>document.documentElement.dataset.quiet==='true';
/** A vehicle-to-vehicle hand-off (the plane's Jump) is a 0.5 s hold, so a stray tap does nothing (FLIGHT.md §3.1). */
const HOLD_MS=500;
const offerKey=(o:ThresholdOffer)=>`${o.thresholdId}:${o.from}:${o.to}`;
export default function HorizonStage(props:HorizonStageProps){
  const stage=useRef<HTMLDivElement>(null),runtime=useRef<HorizonRuntime|null>(null),latest=useRef(props);latest.current=props;
  const [status,setStatus]=useState('Loading the Horizon…'),[ready,setReady]=useState(false),[mode,setMode]=useState<HorizonMode>('look'),[page,setPage]=useState('A');
  const [reducedMotion,setReducedMotion]=useState(readReducedMotion),[calm,setCalm]=useState(readCalm);
  const [offers,setOffers]=useState<ThresholdOffer[]>([]),[mover,setMover]=useState<HorizonMoverState|null>(null),[sheet,setSheet]=useState<ReducedMotionCut|null>(null),hold=useRef<number|null>(null);
  const [tier]=useState<'full'|'lite'>(()=>new URLSearchParams(location.search).get('tier')==='lite'||matchMedia('(max-width: 600px)').matches?'lite':'full');
  useEffect(()=>{const controller=new AbortController();let current:HorizonRuntime|null=null;
    const options:HorizonOptions={tier,hideBuildings:HARBOUR_DEV&&new URLSearchParams(location.search).get('hideBuildings')==='1',signal:controller.signal,reducedMotion:readReducedMotion(),onDoor:(h,b)=>latest.current.onDoor?.(h,b),onStatus:setStatus,initialBody:latest.current.initialBody,partner:()=>latest.current.partner??null};
    import('../scene/worldMount.ts').then(m=>m.mountHorizonWorld(stage.current!,options)).then(world=>{
      if(controller.signal.aborted){world.dispose();return;}current=world;runtime.current=world;setMode(world.mode());setPage(world.shotId());setReady(true);setStatus('Drag to look. Walk with W A S D, or use the pads. Space jumps; E opens a nearby door.');latest.current.onRuntime?.(world);latest.current.onReady?.();
      if(HARBOUR_DEV)(window as unknown as {__harbour:unknown}).__harbour=world;
    }).catch(error=>{if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'The Horizon could not open.');});
    return()=>{controller.abort();current?.dispose();if(HARBOUR_DEV){const debug=window as unknown as {__harbour?:HorizonRuntime};if(debug.__harbour===current)delete debug.__harbour;}runtime.current=null;latest.current.onRuntime?.(null);};
  },[tier]);
  useEffect(()=>{runtime.current?.pause(props.paused===true);},[props.paused,ready]);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)'),sync=()=>{setReducedMotion(readReducedMotion());setCalm(readCalm());};
    media.addEventListener('change',sync);const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','data-quiet']});
    return()=>{media.removeEventListener('change',sync);observer.disconnect();};
  },[]);
  // Both reach the runtime, which also passes them to solarReviewDate (the sun freezes at 15:30).
  useEffect(()=>{runtime.current?.setReducedMotion(reducedMotion);runtime.current?.setCalm(calm);},[reducedMotion,calm,ready]);
  useEffect(()=>{
    if(!ready)return;let last='';
    const poll=window.setInterval(()=>{
      const world=runtime.current;if(!world)return;
      const next={offers:world.offers(),mover:world.moverState(),mode:world.mode()},hud=next.mover.hud;
      const key=JSON.stringify([next.offers.map(offerKey),next.offers.map(o=>o.action),next.mover.mode,next.mover.attached,next.mode,hud&&[Math.round(hud.height??-1),Math.sign(Math.trunc((hud.lift??0)/.5)),hud.place?.label,Math.round(hud.place?.distance??0),hud.place?.action]]);
      if(key===last)return;last=key;setOffers(next.offers);setMover(next.mover);setMode(next.mode);
    },200);
    return()=>window.clearInterval(poll);
  },[ready]);
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
  function changeMode(next:HorizonMode){setMode(next);runtime.current?.setMode(next);stage.current?.focus();}
  function pad(event:React.PointerEvent<HTMLDivElement>,kind:'move'|'look'){
    if(event.type==='pointerup'||event.type==='pointercancel'){runtime.current?.input({forward:0,strafe:0});return;}
    if(event.type==='pointerdown')event.currentTarget.setPointerCapture(event.pointerId);
    else if(!event.currentTarget.hasPointerCapture(event.pointerId))return;
    const box=event.currentTarget.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-box.left-box.width/2)/(box.width*.36))),y=Math.max(-1,Math.min(1,(event.clientY-box.top-box.height/2)/(box.height*.36)));
    if(kind==='move')runtime.current?.input({forward:-y,strafe:x});else runtime.current?.look(-x*.08,-y*.06);
  }
  return <section className={`horizon-shell ${props.review?'horizon-shell--review':''}`} aria-label="Horizon land review">
    <div ref={stage} className="horizon-stage" tabIndex={props.paused?-1:0} aria-label="Horizon. Drag to look. W A S D walks, Space jumps, E opens a nearby door." />
    {!props.paused&&<>
      <div className="horizon-toolbar" aria-label="World controls">
        {(['walk','look','journey']as const).map(m=><button key={m} disabled={!ready} aria-pressed={mode===m} onClick={()=>changeMode(m)}>{m==='journey'?'Island':m==='walk'?'Walk':'Look'}</button>)}
        <label>Page <select aria-label="Sketchbook page" value={page} disabled={!ready} onChange={e=>{setPage(e.target.value);setMode('look');runtime.current?.shot(e.target.value);}}>{'ABCDEFGHIJKL'.split('').map(p=><option key={p}>{p}</option>)}</select></label>
        {props.onQuickSheet&&<button onClick={props.onQuickSheet}>Tools</button>}
        {props.onJourney&&<button onClick={props.onJourney}>Journey</button>}
      </div>
      {ready&&mode==='walk'&&<div className="horizon-touch-controls">
        <div className="horizon-pad" role="group" aria-label={mover?.attached?'Move pad: push and pull the bar, lean to bank':'Move pad'} onPointerDown={e=>pad(e,'move')} onPointerMove={e=>pad(e,'move')} onPointerUp={e=>pad(e,'move')} onPointerCancel={e=>pad(e,'move')}>Move</div>
        {!mover?.attached&&<><button className="horizon-jump" onClick={()=>runtime.current?.jump()}>Jump</button>
        <button onClick={()=>runtime.current?.enterDoor()}>Enter</button></>}
        <div className="horizon-pad" role="group" aria-label="Look pad" onPointerDown={e=>pad(e,'look')} onPointerMove={e=>pad(e,'look')} onPointerUp={e=>pad(e,'look')} onPointerCancel={e=>pad(e,'look')}>Look</div>
      </div>}
      {ready&&!sheet&&offers.length>0&&<div className="horizon-offers" role="group" aria-label="Change how you travel here">
        {offers.map(offer=>{const held=offer.from!=='feet'&&offer.to!=='feet';return <button key={offerKey(offer)} className={held?'horizon-offer horizon-offer--hold':'horizon-offer'} aria-label={held?`${offer.action} (press and hold)`:offer.action}
          onClick={e=>{if(!held||e.detail===0)take(offer);}} onPointerDown={held?()=>holdStart(offer):undefined} onPointerUp={held?holdEnd:undefined} onPointerLeave={held?holdEnd:undefined} onPointerCancel={held?holdEnd:undefined}>{offer.action}</button>;})}
      </div>}
      {ready&&mover?.attached&&mover.hud?.height!==undefined&&<p className="horizon-bubble horizon-bubble-height" aria-live="off">
        <span>{Math.max(0,Math.round(mover.hud.height))} m</span>{Math.abs(mover.hud.lift??0)>=.5&&<span className="horizon-bubble-lift" aria-label={(mover.hud.lift??0)>0?'rising':'sinking'}>{(mover.hud.lift??0)>0?'↑':'↓'}</span>}
      </p>}
      {ready&&mover?.attached&&mover.hud?.place&&(()=>{const place=mover.hud.place,text=place.action==='pull'?place.label:`${place.label} · ${Math.round(place.distance)} m`;
        return place.action==='gate'?<p className="horizon-bubble horizon-bubble-place">{text}</p>
          :<button className="horizon-bubble horizon-bubble-place" onClick={()=>runtime.current?.moverAction(place.action)} aria-label={place.action==='fold'?`Land now: ${text}`:text}>{text}</button>;})()}
      {sheet&&<div className="horizon-sheet" role="dialog" aria-modal="false" aria-labelledby="horizon-sheet-title">
        <h2 id="horizon-sheet-title">Where to?</h2>
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
