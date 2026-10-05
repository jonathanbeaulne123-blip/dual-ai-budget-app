import {AIRCRAFT,FLIGHT_CONTROLS} from './airport/aircraft.ts';
import type {AirportAction} from './airport/campus.ts';
import type {HomeLayout} from '../../home/model.ts';
import type {HomeDisplayContent} from '../../home/displays.ts';
import KitchenHUD from './kitchen/KitchenHUD.tsx';
import type {KitchenView} from './kitchen/types.ts';
import {CRUISER_SKINS,readCruiserSkin,saveCruiserSkin,type CruiserSkin} from './movers/cruiser/tuning.ts';
import {isCraft,type FleetAction} from './movers/fleet/model.ts';
import {perspectiveLabel} from './runtime/perspective.ts';
import {HARBOUR_DEV} from '../flag.ts';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {HorizonRuntime,HorizonOptions,HorizonMode,HorizonMoverState} from './runtime/index.ts';
import {cableRidingStatus,type CableControl} from './movers/gondola/hud.ts';
import type {ThresholdOffer} from './movers/shared/threshold.ts';
import type {ReducedMotionCut,ReducedMotionLanding} from './movers/shared/mode.ts';
import type {Host} from './world/definition.ts';
import type {HouseBodyReturn} from '../../house/navigation.ts';
import type {PlaceWalkSource} from '../scene/place.ts';
import {appCalm,appReducedMotion} from './sun/comfort.ts';
import './horizon.css';
import {GLIDER_PAD_HINT} from './runtime/gliderPads.ts';
import type {ThemeId} from '../../theme/scenes.ts';
import {HORIZON_MANIFEST} from './world/manifest.ts';
import {recordDiagnostic,registerDiagnosticProvider} from '../../diagnostics/inspectorCore.ts';
import type {MonorailState} from '../mountain/monorail.ts';
import type {PlayableAvatar} from '../body/avatarDefinition.ts';
export type HorizonStageProps={homePlotId?:string;homeLayout?:HomeLayout;homeDisplays?:HomeDisplayContent[];visitHome?:boolean;onHomeVisited?:()=>void;onHomeBook?:()=>void;onHomeWorkspace?:(target:string)=>void;cruiserPreference?:string;fleetStorageKey?:string;kitchenStorageKey?:string;onDoor?:(host:Host,body:HouseBodyReturn)=>void;onReady?:()=>void;onRuntime?:(runtime:HorizonRuntime|null)=>void;onQuickSheet?:()=>void;onJourney?:()=>void;initialBody?:HouseBodyReturn;partner?:PlaceWalkSource|null;paused?:boolean;children?:ReactNode;review?:boolean;theme?:ThemeId;
  /** The app's calm view (useComfort().quiet). Without it the stage reads html[data-quiet]. */calm?:boolean;
  /** The app's reduced-motion setting (useComfort().motion==='reduced'); html[data-motion] and the OS query are read too. */reducedMotion?:boolean;
  /** The world's sound (a deliberate gesture enables it; `comfort.sound` owns the setting). */
  sound?:{on:boolean;toggle:()=>void};
  /** Inside the old app shell (the Horizon as the live world): no Horizon toolbar; the shell's own chrome leads, and
   * the stage starts walking. The mover controls (cruiser, boats, yacht, cable, parachute) stay, shown when relevant. */
  shell?:boolean;
  /** The world could not open (assets, chunk or runtime import): the host swaps in a working world. */
  onFailed?:(message:string)=>void;
  /** The mover state as the stage polls it (riding, airborne…), for the shell's own controls. */
  onMover?:(mover:HorizonMoverState|null)=>void;
  /** The old skate's HUD frames (the shell renders SkateHUD and saves progress). */
  onSkate?:HorizonOptions['onSkate'];
  onMonorail?:(state:MonorailState|null)=>void;
  avatar?:PlayableAvatar|null;onAvatarStatus?:(avatar:PlayableAvatar,status:'ready'|'error')=>void;
  /** The old skate is riding: the stage names the skate's keys instead of the walking ones (PR #571 review). */
  skating?:boolean};
/** Reduced motion is live: the app's prop (useComfort), the system setting or Hearth's own comfort choice (`data-motion`, written by `theme/comfort.ts`). */
const readReducedMotion=(props?:Pick<HorizonStageProps,'reducedMotion'>)=>props?.reducedMotion===true||appReducedMotion();
/** Calm view is the comfort module's Quiet choice: the app's prop, else `data-quiet` as applied by `applyComfort`. */
const readCalm=(props?:Pick<HorizonStageProps,'calm'>)=>props?.calm??appCalm();
/** A vehicle-to-vehicle hand-off (the plane's Jump) is a 0.5 s hold, so a stray tap does nothing (FLIGHT.md §3.1). */
const HOLD_MS=(HORIZON_MANIFEST.carriedThresholds.find(threshold=>threshold.id==='bailOut')?.hold_s??.5)*1000;
const offerKey=(o:ThresholdOffer)=>`${o.thresholdId}:${o.from}:${o.to}`;
/** A glider offer's button words (Jonathan 2026-10-04): the act ("Glide"), keyed E on desktop; the threshold's own words stay in its name. */
export const offerButtonText=(o:Pick<ThresholdOffer,'to'|'action'>)=>o.to==='glider'?'Glide':o.action;
/** The offer row is shown on a desktop (fine pointer ≥ 800 px) too when it holds a glider launch: a keyed button, not only the thin E strip. */
export const offersKeyed=(offers:readonly Pick<ThresholdOffer,'to'>[])=>offers.some(o=>o.to==='glider');

/** The old shell's words for the stage while skating (HarbourWorld.tsx). */
export const SKATE_STAGE_WORDS='Skate the Harbour. W pushes, A turns left, D turns right, S brakes. Hold Space and release to jump farther. Press and hold Space again in the air to drift toward a nearby rail or wall ride surface. In the air after a Space jump, the arrows do board tricks; tap W for a backflip, S for a frontflip, and hold A or D to spin. Hold the down arrow and flick up to ollie, flick to a corner to flip. Q and E grab, G locks onto rails, M manuals, R returns to your marker, P pauses, B walks.';
export const WALK_STATUS='Drag to look. Walk with W A S D, Space jumps; E opens a nearby door.';
export const RIDE_PAUSED_STATUS='The ride waits where you left it. Choose Walk to ride on.';
export function statusTextFor({riding,offerLabel,paused,flight,cable}:{riding:boolean;offerLabel?:string|null;paused?:boolean;flight?:boolean;cable?:'gondola'|'funicular'|null}):string{
  if(riding&&cable)return cableRidingStatus(cable);
  if(riding)return paused?RIDE_PAUSED_STATUS:flight?'Flying. W/S set the bar, A/D bank; use the landing bubble.':'Riding. W pushes, S slides, A D steer, Space pops, E parks.';
  return offerLabel?`E · ${offerLabel}`:WALK_STATUS;
}
function cruiserStorage(){try{return window.localStorage;}catch{return null;}}
export default function HorizonStage(props:HorizonStageProps){
  const stage=useRef<HTMLDivElement>(null),runtime=useRef<HorizonRuntime|null>(null),latest=useRef(props);latest.current=props;
  const skinKey=props.cruiserPreference??'hearth:horizon-cruiser:review:v1';
  const [airportActions,setAirportActions]=useState<AirportAction[]>([]),[airportState,setAirportState]=useState<ReturnType<HorizonRuntime['airportState']>|null>(null);
  const [homeActions,setHomeActions]=useState<{id:string;label:string;target?:string}[]>([]);
  const [skin,setSkin]=useState<CruiserSkin>(()=>{const storage=cruiserStorage();return storage?readCruiserSkin(storage,skinKey):'vespa';}),[skinSaveFailed,setSkinSaveFailed]=useState(false);
  const [status,setStatus]=useState('Loading the Horizon…'),[ready,setReady]=useState(false),[mode,setMode]=useState<HorizonMode>('look'),[page,setPage]=useState('A');
  const [reducedMotion,setReducedMotion]=useState(()=>readReducedMotion(props)),[calm,setCalm]=useState(()=>readCalm(props));
  const [offers,setOffers]=useState<ThresholdOffer[]>([]),[mover,setMover]=useState<HorizonMoverState|null>(null),[sheet,setSheet]=useState<ReducedMotionCut|null>(null),hold=useRef<number|null>(null),jumpPointer=useRef<number|null>(null);
  const [kitchen,setKitchen]=useState<KitchenView|null>(null),kitchenSnapshot=useRef('');
  const kitchenActive=Boolean(kitchen&&kitchen.state.phase!=='idle');
  // PR #566 Codex: the cable ride's Skip and Sit buttons (runtime.cableControls), for touch riders and keyboard/screen-reader users.
  const [cable,setCable]=useState<CableControl[]>([]);
  // Jonathan 2026-10-04: the first time this visit the walker comes within ~25 m of a glider launch, one line says so.
  const [padHint,setPadHint]=useState<string|null>(null),hintedPads=useRef(new Set<string>()),padHintTimer=useRef<number|null>(null);
  useEffect(()=>()=>{if(padHintTimer.current!==null)window.clearTimeout(padHintTimer.current);},[]);
  const [boatActions,setBoatActions]=useState<FleetAction[]>([]),[fleetState,setFleetState]=useState<ReturnType<HorizonRuntime['fleetState']>|null>(null);
  const [tier]=useState<'full'|'lite'>(()=>new URLSearchParams(location.search).get('tier')==='lite'||matchMedia('(max-width: 600px)').matches?'lite':'full');
  useEffect(()=>{const controller=new AbortController();let current:HorizonRuntime|null=null,unregister:(()=>void)|null=null,unregisterDiagnostics:(()=>void)|null=null;
    const options:HorizonOptions={homePlotId:latest.current.homePlotId,homeLayout:latest.current.homeLayout,onHomeBook:()=>latest.current.onHomeBook?.(),onHomeWorkspace:t=>latest.current.onHomeWorkspace?.(t),tier,cruiserSkin:skin,fleetStorageKey:latest.current.fleetStorageKey,kitchenStorageKey:latest.current.kitchenStorageKey,theme:latest.current.theme,hideBuildings:HARBOUR_DEV&&new URLSearchParams(location.search).get('hideBuildings')==='1',signal:controller.signal,reducedMotion:readReducedMotion(latest.current),calm:readCalm(latest.current),onDoor:(h,b)=>latest.current.onDoor?.(h,b),onStatus:setStatus,initialBody:latest.current.initialBody,partner:()=>latest.current.partner??null,onSkate:frame=>latest.current.onSkate?.(frame),onMonorail:state=>latest.current.onMonorail?.(state),avatar:latest.current.avatar,onAvatarStatus:(avatar,status)=>latest.current.onAvatarStatus?.(avatar,status)};
    // The movers (M6: the glider and the parachute) register on the runtime as soon as it exists.
    // The world is owned the moment it exists, so the effect's cleanup disposes it even if the glider import then fails (PR #570 review).
    import('../scene/worldMount.ts').then(m=>m.mountHorizonWorld(stage.current!,options)).then(async world=>{
      if(controller.signal.aborted){world.dispose();return;}current=world;
      const gliders=await import('./movers/glider/index.ts');if(controller.signal.aborted)return;
      unregister=gliders.registerGliderModes(world);runtime.current=world;setMode(world.mode());setPage(world.shotId());setReady(true);setStatus('Drag to look. Walk with W A S D, or use the pads. Space jumps; E opens a nearby door.');if(latest.current.shell&&world.mode()!=='walk'){world.setMode('walk');setMode('walk');}latest.current.onRuntime?.(world);latest.current.onReady?.();
      let lastFrame=-1;unregisterDiagnostics=registerDiagnosticProvider({read:()=>{const d=world.inspectorRead(),idle=d.frame===lastFrame||d.rendering.hidden||d.rendering.paused;lastFrame=d.frame;return{scene:'horizon',view:d.mode,activity:d.movement.state,worldRevision:d.worldRevision,renderedRevision:d.loadedRevision,player:d.body,camera:{x:d.camera.eye[0],y:d.camera.eye[1],z:d.camera.eye[2],target:d.camera.target,mode:d.camera.mode,owner:d.camera.owner,transitioning:d.camera.transitioning},location:d.region??`Page ${d.shot}`,movement:d.movement,interaction:d.interaction,context:{page:d.shot,region:d.region,coordinateConvention:'X east / Y up / Z north; world units',grounded:d.movement.grounded,...d.details},rendering:d.rendering,frame:d.frame,frameMs:idle?null:d.frameMs,frameTimes:idle?[]:d.recentFrames,drawCalls:d.drawCalls,triangles:d.triangles,idle,paused:d.rendering.paused};},inspect:(x,y)=>world.inspectorHit(x,y),visuals:()=>world.inspectorVisuals()});recordDiagnostic('scene','enter Horizon','accepted',world.mode());
      if(HARBOUR_DEV)(window as unknown as {__harbour:unknown}).__harbour=world;
    }).catch(error=>{if(controller.signal.aborted)return;const message=error instanceof Error?error.message:'The Horizon could not open.';setStatus(message);latest.current.onFailed?.(message);});
    return()=>{controller.abort();unregisterDiagnostics?.();unregister?.();current?.dispose();if(HARBOUR_DEV){const debug=window as unknown as {__harbour?:HorizonRuntime};if(debug.__harbour===current)delete debug.__harbour;}runtime.current=null;latest.current.onRuntime?.(null);};
  },[tier]);
  useEffect(()=>{runtime.current?.setHome(props.homeLayout,props.homeDisplays,props.homePlotId);},[props.homeLayout,props.homeDisplays,props.homePlotId,ready]);
  useEffect(()=>{if(ready&&props.visitHome&&runtime.current?.visitHome()){latest.current.onHomeVisited?.();setMode('walk');}},[ready,props.visitHome,props.homePlotId]);
  useEffect(()=>{runtime.current?.setKitchenSound?.(props.sound?.on===true);},[props.sound?.on,ready]);
  useEffect(()=>{runtime.current?.setCruiserTheme?.(props.theme??'classic');},[props.theme,ready]);
  useEffect(()=>{runtime.current?.pause(props.paused===true);},[props.paused,ready]);
  useEffect(()=>{runtime.current?.setTheme(props.theme??'classic');},[props.theme,ready]);
  // The toolbar can wrap onto several rows as tools, camera controls or larger text appear.
  useEffect(()=>{
    const shell=stage.current?.parentElement,bar=shell?.querySelector('.horizon-top-controls');if(!shell||!bar)return;
    const place=()=>shell.style.setProperty('--horizon-toolbar-bottom',`${bar.getBoundingClientRect().bottom-shell.getBoundingClientRect().top+12}px`);
    place();const observer=new ResizeObserver(place);observer.observe(bar);return()=>observer.disconnect();
  },[ready,mode,props.paused]);
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
    if(!ready)return;let last='',lastFleet='',lastHome='',lastAirport='';
    const poll=window.setInterval(()=>{
      const world=runtime.current;if(!world)return;const airActions=world.airportActions(),airState=world.airportState(),airKey=JSON.stringify([airActions,airState.selected,airState.power,airState.speed,airState.grounded,airState.disabled,airState.saveFailed]);if(airKey!==lastAirport){lastAirport=airKey;setAirportActions(airActions);setAirportState(airState);}const actionsHome=world.homeActions?.()??[],homeKey=JSON.stringify(actionsHome);if(homeKey!==lastHome){lastHome=homeKey;setHomeActions(actionsHome);}
      const kitchenView=world.kitchenView?.();if(kitchenView){const k=JSON.stringify(kitchenView);if(k!==kitchenSnapshot.current){kitchenSnapshot.current=k;setKitchen(kitchenView);}}
      const pad=latest.current.paused?null:world.gliderPadNear?.()??null;
      if(pad&&!hintedPads.current.has(pad)){hintedPads.current.add(pad);setPadHint(GLIDER_PAD_HINT);if(padHintTimer.current!==null)window.clearTimeout(padHintTimer.current);padHintTimer.current=window.setTimeout(()=>{padHintTimer.current=null;setPadHint(null);},7000);}
      const next={offers:world.offers(),mover:world.moverState(),mode:world.mode(),cable:world.cableControls?.()??[]},hud=next.mover.hud;
      if(next.mode==='walk'&&!latest.current.paused&&(!next.mover.attached||isCraft(next.mover.mode))){
        const actions=world.fleetActions(),state=world.fleetState();
        // Only rendered fleet values own React updates; vessel poses stay in the runtime.
        const fleetKey=JSON.stringify([actions.map(a=>[a.id,a.label]),state.swimming,state.saveFailed,state.vessels.find(v=>v.id==='yacht')?.anchor]);
        if(fleetKey!==lastFleet){lastFleet=fleetKey;setBoatActions(actions);setFleetState(state);}
      }
      const key=JSON.stringify([next.offers.map(offerKey),next.offers.map(o=>o.action),next.mover.mode,next.mover.attached,next.mover.airborne,next.mover.stowed,next.mover.perspective,next.mode,hud&&['pace' in hud?hud.pace:null,Math.round(hud.height??-1),Math.sign(Math.trunc((hud.lift??0)/.5)),hud.place?.label,Math.round(hud.place?.distance??0),hud.place?.action],next.mover.fade,next.mover.cut?.landings.map(landing=>landing.id),next.cable]);
      if(key===last)return;last=key;setOffers(next.offers);setMover(next.mover);latest.current.onMover?.(next.mover);setMode(next.mode);setCable(next.cable);
      if(isCraft(next.mover.mode)){setStatus(world.ridePaused?.()?RIDE_PAUSED_STATUS:'W / ↑ accelerates · S / ↓ slows then reverses · A / D steer · Space brakes · E interacts · C camera.');return;}
      if(next.mover.mode==='plane')setStatus(world.ridePaused?.()?RIDE_PAUSED_STATUS:FLIGHT_CONTROLS);
      else if(next.mover.mode==='parachute')setStatus(`${hud?.place?.label??'Airborne'}. Space opens or retracts; A/D steer, S brakes. C changes view.`);
      else if(next.mover.mode==='cruiser')setStatus(world.ridePaused?.()?RIDE_PAUSED_STATUS:'W / ↑ accelerates · S / ↓ brakes; release and press again to reverse · A / D steer · Space hops; press again airborne for parachute · V gets off · C changes view · R recovers.');
      else if(next.mover.attached||next.offers.length>0)setStatus(statusTextFor({riding:next.mover.attached,offerLabel:next.offers[0]?.action,paused:typeof world.ridePaused==='function'&&world.ridePaused(),flight:next.mover.mode==='glider',cable:next.mover.mode==='gondola'||next.mover.mode==='funicular'?next.mover.mode:null}));
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
    if(event.type==='pointerup'||event.type==='pointercancel'||event.type==='lostpointercapture'){if(kind==='move')runtime.current?.input({forward:0,strafe:0});return;}
    if(event.type==='pointerdown'){event.preventDefault();stage.current?.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);}
    else if(!event.currentTarget.hasPointerCapture(event.pointerId))return;
    const box=event.currentTarget.getBoundingClientRect(),x=Math.max(-1,Math.min(1,(event.clientX-box.left-box.width/2)/(box.width*.36))),y=Math.max(-1,Math.min(1,(event.clientY-box.top-box.height/2)/(box.height*.36)));
    if(kind==='move')runtime.current?.input({forward:-y,strafe:x});else runtime.current?.look(-x*.08,-y*.06);
  }
  return <section className={`horizon-shell horizon-shell--${props.theme??'classic'} ${props.review?'horizon-shell--review':''} ${kitchenActive?'horizon-shell--kitchen':''} ${props.shell?'horizon-shell--in-shell':''}`} aria-label={props.shell?'The Horizon':'Horizon land review'}>
    <div ref={stage} className="horizon-stage" tabIndex={props.paused?-1:0} aria-label={mover?.mode==='plane'?FLIGHT_CONTROLS:props.skating?SKATE_STAGE_WORDS:kitchenActive?"Yacht Kitchen. WASD or arrows moves, E picks up and places, F prepares, R tosses, Q changes ingredient, Escape pauses, C changes the solo camera.":mover?.mode==='cruiser'?"Cruiser. W accelerates, S brakes; release and press S again to reverse. A D steer. Space hops; press again airborne to open the parachute. V gets off, C changes view, R recovers. Drag to look.":"Horizon. Drag to look. W A S D moves, Space jumps or brakes a boat, E interacts, C changes view. V rides the cruiser."} />
    {!kitchenActive&&!props.paused&&ready&&mode==='walk'&&(airportActions.length>0||mover?.mode==='plane')&&<div className="horizon-airport" role="group" aria-label="Airport and aircraft">
      <strong>{airportState?.selected?AIRCRAFT[airportState.selected].name:'Horizon Airport'}</strong>
      {airportState?.selected&&<><p>{airportState.speed} km/h · Power {airportState.power}% · {airportState.disabled?'Stopped — recovery available':airportState.grounded?'On the ground':'In flight'}</p>
        <div className="horizon-airport__power">{([[0,'Idle'],[.13,'Taxi'],[.8,'Flight']] as const).map(([value,label])=><button key={label} onClick={()=>{runtime.current?.airportPower(value);stage.current?.focus();}}>{label}</button>)}
        <label>Power <input aria-label="Aircraft power" type="range" min="0" max="100" step="1" value={airportState.power} onChange={e=>runtime.current?.airportPower(Number(e.target.value)/100)}/></label></div>
        <p>A/D turn · S climbs · W descends · C view</p>
        <button onClick={()=>{runtime.current?.airportPower(0);runtime.current?.airportBrake(true);stage.current?.focus();}}>Stop / ground brake</button>
        {!airportState.grounded&&<button onClick={()=>{runtime.current?.jump();stage.current?.focus();}}>Leave & open parachute</button>}
      </>}
      {airportActions.map(a=><button key={a.id} onClick={()=>{runtime.current?.airportAction(a.id);stage.current?.focus();}}>{a.label}</button>)}
      {airportState?.saveFailed&&<p role="status">Aircraft positions could not be saved on this device.</p>}
    </div>}
    {!kitchenActive&&!props.paused&&ready&&mode==='walk'&&(!mover?.attached||isCraft(mover.mode))&&(!props.shell||boatActions.length>0||Boolean(mover&&isCraft(mover.mode))||fleetState?.swimming===true)&&<div className="horizon-fleet" role="group" aria-label="Boating and yacht">
      <div className="horizon-fleet__heading"><strong>{mover&&isCraft(mover.mode)?mover.mode==='yacht'?'Yacht helm':mover.mode:fleetState?.swimming?'Swimming':'Offshore fleet'}</strong><button onClick={()=>{runtime.current?.cycleCamera();stage.current?.focus();}}>Camera · C</button></div>
      {mover&&isCraft(mover.mode)?<p>{(mover.hud as {pace?:string})?.pace} · {mover.mode==='yacht'?(fleetState?.vessels.find(v=>v.id==='yacht')?.anchor?'Anchor down':'Anchor raised'):'Hold W to go; S slows and reverses.'}</p>:<p>{fleetState?.swimming?'Swim with the movement pad or W A S D. The yacht ladder is at the stern.':'Kayak, dinghy and motorboat: east side of the float dock. The yacht is offshore to the southeast.'}</p>}
      <div className="horizon-fleet__actions">{boatActions.map((a,i)=><button key={a.id} onClick={()=>{runtime.current?.fleetAction(a.id);stage.current?.focus();}}>{a.label}{i===0?' · E':''}</button>)}</div>
      {fleetState?.saveFailed&&<p role="status">Boats are saved for this visit only; device storage is unavailable.</p>}
    </div>}
    {/* A glider launch has its own keyed button on desktop (the offer row below); the strip then stays empty rather than repeat it. */}
    {!kitchenActive&&!props.paused&&<div className="horizon-offer" role="status" data-empty={mode==='walk'&&offers.length>0&&!offersKeyed(offers)?undefined:'true'}><span className="horizon-offer__text">{mode==='walk'&&offers[0]&&!offersKeyed(offers)?`E · ${offers[0].action}`:''}</span></div>}
    {!kitchenActive&&!props.paused&&ready&&padHint&&mode==='walk'&&<p className="horizon-glider-hint" role="status">{padHint}</p>}
    {!props.paused&&<>
      <div className="horizon-top-controls">
      {!props.shell&&<div className="horizon-toolbar" aria-label="World controls">
        {props.onHomeBook&&<button onClick={props.onHomeBook}>Renovation book</button>}
        {props.homeLayout&&<button disabled={!ready} onClick={()=>runtime.current?.visitHome()}>Visit my homestead</button>}
        {homeActions.map(a=><button key={a.id} onClick={()=>runtime.current?.activateHome(a.id)}>{a.label}</button>)}
        {!kitchenActive&&(['walk','look','journey']as const).map(m=><button key={m} disabled={!ready} aria-pressed={mode===m} onClick={()=>changeMode(m)}>{m==='journey'?'Island':m==='walk'?'Walk':'Look'}</button>)}
        {!kitchenActive&&mode==='walk'&&<button disabled={!ready} onClick={()=>{runtime.current?.cyclePerspective();stage.current?.focus();}} aria-label="Change camera perspective (C)">{perspectiveLabel(mover?.perspective??'activity')}</button>}
        {!kitchenActive&&<label>Page <select aria-label="Sketchbook page" value={page} disabled={!ready} onChange={e=>{setPage(e.target.value);setMode('look');runtime.current?.shot(e.target.value);}}>{'ABCDEFGHIJKL'.split('').map(p=><option key={p}>{p}</option>)}<option value="airport">Airport</option></select></label>}
        {props.onQuickSheet&&<button onClick={props.onQuickSheet}>Tools</button>}
        {props.onJourney&&<button onClick={props.onJourney}>Journey</button>}
        {props.sound&&<button aria-pressed={props.sound.on} onClick={()=>{runtime.current?.setKitchenSound?.(!props.sound!.on,true);props.sound!.toggle();}}>{props.sound.on?'Sound on':'Sound off'}</button>}
      </div>}
      {!kitchenActive&&ready&&!sheet&&mover?.mode!=='plane'&&(!props.shell||mover?.mode==='cruiser')&&<div className="horizon-cruiser-controls" role="group" aria-label="Island cruiser">
        <button disabled={Boolean(mover?.attached&&mover.mode!=='cruiser')} aria-pressed={mover?.mode==='cruiser'} onClick={()=>{runtime.current?.toggleCruiser();stage.current?.focus();}}>{mover?.mode==='cruiser'?'Get off':'Ride'} <span aria-hidden="true">V</span></button>
        {(!props.shell||mover?.mode==='cruiser')&&<label>Style <select aria-label="Cruiser style" value={skin} onChange={event=>{const next=event.target.value as CruiserSkin;setSkin(next);runtime.current?.setCruiserSkin(next);const storage=cruiserStorage();setSkinSaveFailed(!storage||!saveCruiserSkin(storage,skinKey,next));}}>{Object.entries(CRUISER_SKINS).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
        {mover?.mode==='cruiser'&&<><button onClick={()=>{runtime.current?.recoverCruiser();stage.current?.focus();}}>Recover <span aria-hidden="true">R</span></button><output aria-label="Cruiser speed">{(mover.hud as {pace?:string})?.pace??'0 km/h'}</output></>}
        {skinSaveFailed&&<span role="status">Style saved for this visit only.</span>}
      </div>}
      {/* PR #566 Codex: Skip (E) and Sit (Space, a toggle) as real buttons while riding the gondola or the funicular; the cruiser group's dressings. */}
      {!kitchenActive&&ready&&!sheet&&mode==='walk'&&mover?.attached&&(mover.mode==='gondola'||mover.mode==='funicular')&&cable.length>0&&<div className="horizon-cruiser-controls horizon-cable-controls" role="group" aria-label={mover.mode==='gondola'?'Gondola ride':'Funicular ride'}>
        {cable.map(c=><button key={c.id} aria-keyshortcuts={c.key} aria-pressed={c.id==='seat'?c.pressed===true:undefined} onClick={()=>{runtime.current?.moverAction(c.id);stage.current?.focus();}}>{c.id==='seat'?'Sit':c.label} <span aria-hidden="true">{c.key}</span></button>)}
      </div>}
      </div>
      {!kitchenActive&&ready&&mode==='walk'&&(!props.shell||Boolean(mover?.attached||mover?.airborne))&&<div className="horizon-touch-controls">
        <div className="horizon-pad" role="group" aria-label={mover?.mode==='plane'?'Flight pad: pull down to climb, push up to descend, left and right to turn':mover?.mode==='cruiser'?'Ride pad: up accelerates, down brakes, left and right steer':mover&&isCraft(mover.mode)?'Move pad: accelerate, reverse and steer the boat':mover?.mode==='parachute'?'Move pad: steer and brake the parachute':mover?.attached?'Move pad: push and pull the bar, lean to bank':'Move pad'} onPointerDown={e=>pad(e,'move')} onPointerMove={e=>pad(e,'move')} onPointerUp={e=>pad(e,'move')} onPointerCancel={e=>pad(e,'move')} onLostPointerCapture={e=>pad(e,'move')}>{mover?.mode==='cruiser'?'Ride':'Move'}</div>
        {mover?.mode==='cruiser'&&<button className="horizon-jump" onPointerDown={e=>e.preventDefault()} onClick={()=>{stage.current?.focus();runtime.current?.jump();}}>{mover.airborne?'Open parachute':'Hop'}</button>}
        {mover&&isCraft(mover.mode)&&<button className="horizon-jump" onPointerDown={e=>{e.preventDefault();stage.current?.focus();jumpPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);runtime.current?.jumpHold(true);}} onClick={e=>{if(e.detail===0){stage.current?.focus();runtime.current?.jumpHold(true);window.setTimeout(()=>runtime.current?.jumpHold(false),150);}}}>Brake</button>}
        {(mover?.mode==='board'||mover?.mode==='bicycle'&&mover.airborne)&&<button className="horizon-jump" onPointerDown={e=>{e.preventDefault();stage.current?.focus();jumpPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);runtime.current?.jumpHold(true);}} onClick={e=>{if(e.detail===0){stage.current?.focus();runtime.current?.jump();}}}>{mover.airborne?'Open parachute':'Jump'}</button>}
        {!mover?.attached&&<><button className="horizon-jump" onClick={()=>{stage.current?.focus();runtime.current?.jump();}}>Jump</button>
        <button onClick={()=>runtime.current?.accept()}>Interact</button>
        {mover?.stowed&&<button onClick={()=>{runtime.current?.resumeEquipment();stage.current?.focus();}}>Ride {mover.stowed}</button>}</>}
        <div className="horizon-pad" role="group" aria-label="Look pad" onPointerDown={e=>pad(e,'look')} onPointerMove={e=>pad(e,'look')} onPointerUp={e=>pad(e,'look')} onPointerCancel={e=>pad(e,'look')}>Look</div>
      </div>}
      {!kitchenActive&&ready&&!sheet&&offers.length>0&&<div className={offersKeyed(offers)?'horizon-offers horizon-offers--keyed':'horizon-offers'} role="group" aria-label="Change how you travel here">
        {offers.map((offer,i)=>{const held=offer.from!=='feet'&&offer.to!=='feet',text=offerButtonText(offer),name=offer.to==='glider'?`${text}: ${offer.action}`:offer.action;return <button key={offerKey(offer)} className={held?'horizon-offer horizon-offer--hold':'horizon-offer'} aria-label={held?`${name} (press and hold)`:name} aria-keyshortcuts={i===0&&!held?'E':undefined}
          onClick={e=>{if(!held||e.detail===0)take(offer);}} onPointerDown={held?()=>holdStart(offer):undefined} onPointerUp={held?holdEnd:undefined} onPointerLeave={held?holdEnd:undefined} onPointerCancel={held?holdEnd:undefined}>{text}{i===0&&!held&&<kbd className="horizon-offer__key" aria-hidden="true">E</kbd>}</button>;})}
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
    <div hidden={props.paused===true}>{ready&&kitchen&&<KitchenHUD view={kitchen} theme={props.theme??'classic'} reducedMotion={reducedMotion} onCommand={command=>{const previous=runtime.current?.kitchenView()?.state.phase;runtime.current?.kitchenCommand(command);const next=runtime.current?.kitchenView()??null;recordDiagnostic('kitchen',command.type,next?.state.phase===previous?'received':'state changed',next?.state.phase);kitchenSnapshot.current=JSON.stringify(next);setKitchen(next);if(command.type==='exit'||next?.state.phase==='playing'&&previous!=='playing')stage.current?.focus({preventScroll:true});}} onInput={(chef,value)=>runtime.current?.kitchenInput(chef,value)}/>}</div>
    {props.children}
  </section>;
}
