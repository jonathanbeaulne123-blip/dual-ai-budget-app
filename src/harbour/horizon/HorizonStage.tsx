import {HARBOUR_DEV} from '../flag.ts';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {HorizonRuntime,HorizonOptions,HorizonMode} from './runtime/index.ts';
import type {MoverHud} from './movers/shared/mode.ts';
import type {ThresholdOffer} from './movers/shared/threshold.ts';
import {offerBubbleText,paceWord,RIDING_STATUS,type PaceWord} from './runtime/moverInput.ts';
import type {Host} from './world/definition.ts';
import type {HouseBodyReturn} from '../../house/navigation.ts';
import type {PlaceWalkSource} from '../scene/place.ts';
import './horizon.css';
export type HorizonStageProps={onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onRuntime?:(runtime:HorizonRuntime|null)=>void;onQuickSheet?:()=>void;onJourney?:()=>void;initialBody?:HouseBodyReturn;partner?:PlaceWalkSource|null;paused?:boolean;children?:ReactNode;review?:boolean;calm?:boolean};
const reducedNow=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced';
/** Small descriptive icons, one per pace word (24 × 24, currentColor). */
function PaceIcon({word}:{word:PaceWord}){
  const common={fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <svg className="horizon-bubble__icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
    {word==='fast'&&<path {...common} d="M5 7l5 5-5 5M12 7l5 5-5 5"/>}
    {word==='flow'&&<path {...common} d="M3 14c3-4 6-4 9 0s6 4 9 0"/>}
    {word==='slow'&&<g fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></g>}
    {word==='threshold'&&<path {...common} d="M4 18h16M7 18V9M17 18V9M7 9h10"/>}
    {word==='offline'&&<path {...common} d="M4 18c2-3 3-6 4-9M10 18c1-3 2-6 2-10M16 18c1-3 2-5 4-8"/>}
  </svg>;
}
const ARC_R=26,ARC_C=2*Math.PI*ARC_R;
/** One glass bubble, four jobs, never two at once: pace word, slide charge arc, push glyph, offer. */
/** What the pace bubble's live region says: the pace word only (R2-15), so it speaks when the word changes, not every push window or surface. */
export const PACE_SPOKEN:Record<PaceWord,string>={fast:'Fast',flow:'Flowing',slow:'Slow',threshold:'At a threshold',offline:'Off the line'};
function PaceBubble({hud,touch}:{hud:MoverHud;touch:boolean}){
  const word=paceWord(hud),arc=Math.max(0,Math.min(1,hud.arc||0));
  const offer=(hud.glyph==='park'||hud.glyph==='pickup')&&hud.label;
  const glyph=hud.glyph==='push'?(touch?'↑':'W'):offer?hud.label:null;
  return <div className="horizon-bubble" role="status" data-pace={word} data-glyph={hud.glyph??'none'}>
    <span className="horizon-sr">{PACE_SPOKEN[word]}</span>
    <svg className="horizon-bubble__arc" viewBox="0 0 60 60" aria-hidden="true" focusable="false">
      <circle className="horizon-bubble__track" cx="30" cy="30" r={ARC_R}/>
      <circle className="horizon-bubble__fill" cx="30" cy="30" r={ARC_R} strokeDasharray={`${ARC_C*arc} ${ARC_C}`} transform="rotate(-90 30 30)"/>
    </svg>
    <PaceIcon word={word}/>
    <span className="horizon-bubble__text" aria-hidden="true">{glyph??hud.pace??hud.label??word}</span>
  </div>;
}
export const RIDING_LABEL='Horizon. Riding. W pushes, S slides, A D steer, Space pops, E parks.';
export const RIDE_PAUSED_LABEL='Horizon. The ride waits where you left it. Choose Walk to ride on.';
export const WALK_STATUS='Drag to look. Walk with W A S D, or use the pads. Space jumps; E opens a nearby door.';
export const RIDE_PAUSED_STATUS='The ride waits where you left it. Choose Walk to ride on.';
/**
 * The stage's `role="status"` line. While riding, the runtime's own `onStatus` calls already say the
 * right thing (RIDING_STATUS at pick-up / resume, the paused text on Look / Island / a page) — this
 * only covers the on-foot line, which used to be set once at mount and never moved when a pick-up/park
 * offer came into or out of reach: it now names the offer ("E · Pick up the board") in reach, and falls
 * back to the plain walk/door text otherwise.
 */
export function statusTextFor({riding,offerLabel,paused}:{riding:boolean;offerLabel?:string|null;paused?:boolean}):string{
  if(riding)return paused?RIDE_PAUSED_STATUS:RIDING_STATUS;
  return offerLabel?`E · ${offerLabel}`:WALK_STATUS;
}
export default function HorizonStage(props:HorizonStageProps){
  const stage=useRef<HTMLDivElement>(null),runtime=useRef<HorizonRuntime|null>(null),latest=useRef(props);latest.current=props;
  const [status,setStatus]=useState('Loading the Horizon…'),[ready,setReady]=useState(false),[mode,setMode]=useState<HorizonMode>('look'),[page,setPage]=useState('A');
  const [offer,setOffer]=useState<ThresholdOffer|null>(null),[hud,setHud]=useState<MoverHud|null>(null),[reduced,setReduced]=useState(reducedNow);
  const [touch]=useState(()=>matchMedia('(pointer: coarse)').matches);
  const riding=hud!==null,ridingHere=riding&&mode==='walk';   // a ride paused under Look / Island keeps its HUD but shows none
  const [tier]=useState<'full'|'lite'>(()=>new URLSearchParams(location.search).get('tier')==='lite'||matchMedia('(max-width: 600px)').matches?'lite':'full');
  useEffect(()=>{const controller=new AbortController();let current:HorizonRuntime|null=null;
    const options:HorizonOptions={tier,hideBuildings:HARBOUR_DEV&&new URLSearchParams(location.search).get('hideBuildings')==='1',signal:controller.signal,reducedMotion:reducedNow(),calm:latest.current.calm===true,onOffer:setOffer,onMoverHud:setHud,onDoor:(h,b)=>latest.current.onDoor?.(h,b),onStatus:setStatus,initialBody:latest.current.initialBody,partner:()=>latest.current.partner??null};
    import('../scene/worldMount.ts').then(m=>m.mountHorizonWorld(stage.current!,options)).then(world=>{
      if(controller.signal.aborted){world.dispose();return;}current=world;runtime.current=world;setMode(world.mode());setPage(world.shotId());setReady(true);setStatus(WALK_STATUS);latest.current.onRuntime?.(world);latest.current.onReady?.();
      if(HARBOUR_DEV)(window as unknown as {__harbour:unknown}).__harbour=world;
    }).catch(error=>{if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'The Horizon could not open.');});
    return()=>{controller.abort();current?.dispose();if(HARBOUR_DEV){const debug=window as unknown as {__harbour?:HorizonRuntime};if(debug.__harbour===current)delete debug.__harbour;}runtime.current=null;latest.current.onRuntime?.(null);};
  },[tier]);
  useEffect(()=>{runtime.current?.pause(props.paused===true);},[props.paused,ready]);
  // Reduced motion and calm are read live (RIDE §11 ask 3): the OS setting and Hearth's data-motion comfort flag.
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(reducedNow());media.addEventListener('change',update);const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});return()=>{media.removeEventListener('change',update);observer.disconnect();};},[]);
  useEffect(()=>{runtime.current?.setReducedMotion(reduced);},[reduced,ready]);
  useEffect(()=>{runtime.current?.setCalm(props.calm===true);},[props.calm,ready]);
  // The on-foot status line (riding/paused status text is the runtime's own onStatus calls): names a
  // pick-up/park offer as it comes into or out of reach, only when it actually changes.
  useEffect(()=>{if(!ready||riding)return;setStatus(statusTextFor({riding:false,offerLabel:offer?offer.label:null}));},[ready,riding,offer]);
  function changeMode(next:HorizonMode){setMode(next);runtime.current?.setMode(next);stage.current?.focus();}
  function pad(event:React.PointerEvent<HTMLDivElement>,kind:'move'|'look'){
    if(event.type==='pointerup'||event.type==='pointercancel'){runtime.current?.input({forward:0,strafe:0});return;}
    if(event.type==='pointerdown')event.currentTarget.setPointerCapture(event.pointerId);
    else if(!event.currentTarget.hasPointerCapture(event.pointerId))return;
    const box=event.currentTarget.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-box.left-box.width/2)/(box.width*.36))),y=Math.max(-1,Math.min(1,(event.clientY-box.top-box.height/2)/(box.height*.36)));
    if(kind==='move')runtime.current?.input({forward:-y,strafe:x});else runtime.current?.look(-x*.08,-y*.06);
  }
  function jumpBubble(event:React.PointerEvent<HTMLButtonElement>){if(!riding)return;if(event.type==='pointerdown'){event.currentTarget.setPointerCapture(event.pointerId);runtime.current?.jumpHold(true);}else runtime.current?.jumpHold(false);}
  return <section className={`horizon-shell ${props.review?'horizon-shell--review':''}`} aria-label="Horizon land review" data-riding={riding?'true':undefined}>
    <div ref={stage} className="horizon-stage" tabIndex={props.paused?-1:0} aria-label={ridingHere?RIDING_LABEL:riding?RIDE_PAUSED_LABEL:`Horizon. Drag to look. W A S D walks, Space jumps, E ${offer?offer.label.toLowerCase():'opens a nearby door'}.`} />
    {!props.paused&&ridingHere&&hud&&<PaceBubble hud={hud} touch={touch}/>}
    {/* R2-03: the offer on a fine-pointer desktop, where the touch controls (and the Enter bubble) are hidden. Always mounted so the live region announces. */}
    {!props.paused&&<div className="horizon-offer" role="status" data-empty={offer&&mode==='walk'?undefined:'true'}><span className="horizon-offer__text">{mode==='walk'?offerBubbleText(offer):''}</span></div>}
    {!props.paused&&<>
      <div className="horizon-toolbar" aria-label="World controls">
        {(['walk','look','journey']as const).map(m=><button key={m} disabled={!ready} aria-pressed={mode===m} onClick={()=>changeMode(m)}>{m==='journey'?'Island':m==='walk'?'Walk':'Look'}</button>)}
        <label>Page <select aria-label="Sketchbook page" value={page} disabled={!ready} onChange={e=>{setPage(e.target.value);setMode('look');runtime.current?.shot(e.target.value);}}>{'ABCDEFGHIJKL'.split('').map(p=><option key={p}>{p}</option>)}</select></label>
        {props.onQuickSheet&&<button onClick={props.onQuickSheet}>Tools</button>}
        {props.onJourney&&<button onClick={props.onJourney}>Journey</button>}
      </div>
      {ready&&mode==='walk'&&<div className="horizon-touch-controls">
        <div className="horizon-pad" role="group" aria-label="Move pad" onPointerDown={e=>pad(e,'move')} onPointerMove={e=>pad(e,'move')} onPointerUp={e=>pad(e,'move')} onPointerCancel={e=>pad(e,'move')}>Move</div>
        <button className="horizon-jump" onClick={()=>{if(!riding)runtime.current?.jump();}} onPointerDown={jumpBubble} onPointerUp={jumpBubble} onPointerCancel={jumpBubble} aria-label={riding?'Jump (hold to charge the pop)':'Jump'}>Jump</button>
        <button onClick={()=>runtime.current?.accept()}>{offer?offer.label:'Enter'}</button>
        <div className="horizon-pad" role="group" aria-label="Look pad" onPointerDown={e=>pad(e,'look')} onPointerMove={e=>pad(e,'look')} onPointerUp={e=>pad(e,'look')} onPointerCancel={e=>pad(e,'look')}>Look</div>
      </div>}
      <p className="horizon-status" role="status">{status}</p>
    </>}
    {props.children}
  </section>;
}
