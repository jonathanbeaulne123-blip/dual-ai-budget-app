import {livingEvidence} from '../../house/interpretation.ts';
import {DEFAULT_QUEEN_STYLE} from '../../house/queenStyle.ts';
import {useHomeBook} from '../../home/HomeBookContext.tsx';
import {cruiserPreferenceKey} from './movers/cruiser/tuning.ts';
import {useCallback,useEffect,useLayoutEffect,useRef,useMemo,useState} from 'react';
import {HomeBookButton} from '../../home/HomeBookContext.tsx';
import {useHarbourReading} from '../data/useHarbourReading.ts';
import {VillageHUD} from '../village/VillageHUD.tsx';
import {MineRibbon} from '../mine/MineRibbon.tsx';
import {HarbourTwins} from '../court/CourtTwins.tsx';
import type {ProjectedRect} from '../scene/runtime.ts';
import * as THREE from 'three';
import {MineLayer,type MineOpenKind} from '../mine/MineLayer.tsx';
import {emptyMineLayer,mineLayer} from '../mine/mineLayer.ts';
import {Dock} from '../glass/Dock.tsx';
import {HostPanel} from '../panels/HostPanel.tsx';
import {HarbourFlat} from '../flat/PlaceFlat.tsx';
import {WalkTogether} from '../presence/WalkTogether.tsx';
import {HARBOUR_GO_EVENT} from '../nav/QuickSheet.tsx';
import {useGlassNight} from '../bubbles/glassMode.ts';
import {EMOTE_IDS,type EmoteId} from '../body/bodyModel.ts';
import {HARBOUR_PLACE_NAMES,harbourPlaceFor} from '../flag.ts';
import {memberDisplayName} from '../../softPresence.ts';
import {type WorldPresenceShare} from '../../softPresenceWorld.ts';
import type {HorizonMoverState} from './runtime/index.ts';
import {SkateHUD} from '../skate/SkateHUD.tsx';
import {readSkateProgress,saveSkateProgress,skateProgressKey,type SkateSettings} from '../skate/session.ts';
import {SKATE_TRICK_BOOK,skateGesturePath} from '../skate/driver.ts';
import {createSkateAudio,type SkateAudio} from '../skate/audio.ts';
import type {SkateHudModel,TouchZone} from '../skate/hud/model.ts';
import type {NativeSkateFrame} from './skate/nativeSkate.ts';
import type {HarbourWorldProps} from '../HarbourWorld.tsx';
import HorizonStage from './HorizonStage.tsx';
import type {HorizonRuntime} from './runtime/index.ts';
import {publishLocalPose,useWorldFeed} from '../presence/feed.ts';
import {readWorldPresenceShare} from '../../softPresenceWorld.ts';
import {HORIZON_GEOGRAPHY,HORIZON_PRESENCE_WORLD,isSavedHorizonWorld} from '../../worldGeography.ts';
import {readHouseReturnOnDevice,saveHouseReturnOnDevice,houseIdentity,validHouseBody,type HouseBodyReturn} from '../../house/navigation.ts';
import {VILLAGE_ADDRESS} from '../village/layout.ts';
import type {HarbourPlaceId} from '../flag.ts';
import type {Host} from './world/definition.ts';
import {useComfort} from '../../theme/comfort.ts';
import {createWorldAmbience,type WorldAmbience} from '../mountain/audio.ts';
import {useAppearance} from '../../theme/ThemeProvider.tsx';
import {buildBasinReading,createBasinView} from '../mountain/basin.ts';
import {useOfferWorldActions} from '../nav/worldActions.ts';
import {HorizonGuide} from './HorizonGuide.tsx';
import {MountainPanel,type MountainAction} from '../mountain/MountainPanel.tsx';
import type {MonorailState} from '../mountain/monorail.ts';
import {avatarPreferenceKey,readAvatar,saveAvatar} from '../body/avatarPreference.ts';
import type {PlayableAvatar} from '../body/avatarDefinition.ts';
import type {FundPulseFreshness} from '../../core/fundPulse.ts';
import type {GliderPadId} from './runtime/gliderPads.ts';
export const HORIZON_HOST_TOOLS:Readonly<Record<string,string>>={home:'conversation',bank:'loft-banks',library:'books',glasshouse:'planner',studio:'pottery',cottage:'wardrobe',boathouse:'wishes'};
const TOUCH='(hover: none) and (pointer: coarse)';
const readTouch=()=>{try{return typeof window.matchMedia==='function'&&window.matchMedia(TOUCH).matches;}catch{return false;}};
const EMOTE_FACES:Readonly<Record<EmoteId,string>>=Object.freeze({wave:'👋',dance:'💃',sit:'🪑',cheer:'🙌',laugh:'😂',point:'👉'});
/**
 * Where a harbour place stands on the Horizon: its host's door step (`returnAt`) or, for the outdoor places (the
 * square, the campfire), the place's own anchor. The old app's Places, panels and room bar walk the body there.
 */
export function horizonPlaceTarget(world:Pick<HorizonRuntime['world'],'hosts'|'places'>,place:HarbourPlaceId):readonly [number,number,number]|null{
  const host=world.hosts.find(h=>h.placeIds.includes(place)||h.toolPlaceId===place);
  if(host?.returnAt)return host.returnAt;
  const outdoor=world.places.find(p=>p.id===place);
  return outdoor?.anchor&&'xy' in outdoor.anchor?[outdoor.anchor.xy[0],outdoor.anchor.height??0,outdoor.anchor.xy[1]]:null;
}
/** The Horizon host that stands for a harbour place (its door opens that place's tool), or null for an outdoor place. */
export function horizonHostFor(world:Pick<HorizonRuntime['world'],'hosts'>,place:string):Host|null{
  return world.hosts.find(h=>h.placeIds.includes(place)||h.toolPlaceId===place)??null;
}
/** The Horizon as the live world, worn in the old app shell (D15 follow-up, Jonathan 2026-09-29). */
export default function HorizonWorld(props:HarbourWorldProps&{onFailed?:(message:string)=>void}){
  const homeBook=useHomeBook();
  const {household,memberId,scope,route}=props,runtime=useRef<HorizonRuntime|null>(null),identity={environment:household.environment,householdId:household.householdId,memberId,scope},identityRef=useRef(identity);identityRef.current=identity;
  const appearance=useAppearance(),theme=appearance.preview??appearance.saved.theme;
  const botanical=useMemo(()=>livingEvidence(household,memberId,'personal'),[household.personalLife,household.hearthside,memberId]);
  useEffect(()=>{runtime.current?.setHomeBotanical?.(appearance.saved.queen??DEFAULT_QUEEN_STYLE,botanical);},[appearance.saved.queen,botanical]);
  const identityKey=houseIdentity(identity);
  const avatarKey=avatarPreferenceKey(household.environment,household.householdId,memberId);
  const [avatar,setAvatar]=useState<PlayableAvatar|null>(()=>readAvatar(localStorage,avatarKey));
  const avatarRef=useRef(avatar);avatarRef.current=avatar;
  const [avatarStatus,setAvatarStatus]=useState<'idle'|'loading'|'ready'|'error'>(avatar?'loading':'idle');
  useEffect(()=>{const selected=readAvatar(localStorage,avatarKey);avatarRef.current=selected;setAvatar(selected);setAvatarStatus(selected?'loading':'idle');runtime.current?.setAvatar(selected);},[avatarKey]);
  function chooseAvatar(next:PlayableAvatar){avatarRef.current=next;setAvatar(next);setAvatarStatus('loading');saveAvatar(localStorage,avatarKey,next);runtime.current?.setAvatar(next);}
  // "Enter Horizon here" (Journey Board, P2): an {x,y} location starts the body there with NO `y`, so
  // `restoreHorizonPosition` grounds it or snaps to the nearest walkable path node (the sea and the
  // yacht are never targets); a host lands on its baked `returnAt` through `runtime.arrive`, once per request.
  // Once the App has recorded the arrival (`arrived`), the request is spent for this device: a remount (Books → back to
  // the harbour) starts from the saved body, never from the board's entry point again (review MINOR 1).
  const request=props.enterHorizonRequest??null,requestRef=useRef(request);
  const onArrivedRef=useRef(props.onHorizonArrived);
  // Committed props only (PR #567 review): a discarded concurrent render never leaves a stale request in the refs.
  useLayoutEffect(()=>{requestRef.current=request;onArrivedRef.current=props.onHorizonArrived;});
  const pending=request&&!request.arrived?request:null;
  const initialBody=useMemo(():HouseBodyReturn|undefined=>pending&&'x' in pending.location?{world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:pending.location.x,z:pending.location.y,yaw:0}:readHouseReturnOnDevice(identity,'horizon')?.body,[identityKey,request?.seq]);
  const arrivedSeq=useRef<number|null>(request&&(request.arrived||'x' in request.location)?request.seq:null);
  function arriveForRequest(){
    const r=requestRef.current,world=runtime.current;if(!r||!world)return;
    if(arrivedSeq.current!==r.seq){
      arrivedSeq.current=r.seq;
      if('host' in r.location)world.arrive(r.location.host);else world.restore({world:HORIZON_PRESENCE_WORLD,geo:HORIZON_GEOGRAPHY,place:'court',x:r.location.x,z:r.location.y,yaw:0});
    }
    if(!r.arrived)onArrivedRef.current?.(r.seq);
  }
  useEffect(()=>{arriveForRequest();},[request?.seq]);
  // The share choice belongs to one environment: on a switch the new environment's own choice is read in the same render,
  // never the previous one's (PR #570 review: a "live" choice must not reach another environment's presence gate).
  const [walkShareState,setWalkShareState]=useState<{environment:string;share:WorldPresenceShare}>(()=>({environment:household.environment,share:readWorldPresenceShare(household.environment)}));
  const walkShare=walkShareState.environment===household.environment?walkShareState.share:readWorldPresenceShare(household.environment);
  const setWalkShare=useCallback((share:WorldPresenceShare)=>setWalkShareState({environment:household.environment,share}),[household.environment]);
  const peer=useWorldFeed({environment:household.environment,householdId:household.householdId,memberId,linked:household.linked===true,view:scope,placeId:'court',softPresenceOptedOut:props.presence?.optedOut===true,share:walkShare,world:HORIZON_PRESENCE_WORLD});
  // The app's comfort choices reach the world: calm view = Comfort.quiet, reduced motion = Comfort.motion (R1-16).
  // The world's sound, as the Mountain does it (HarbourWorld.tsx): off until a deliberate toggle, and never while comfort.sound is off.
  const [comfort,updateComfort]=useComfort(household.environment),audio=useRef<WorldAmbience|null>(null),[soundOn,setSoundOn]=useState(false);
  useEffect(()=>{if(!comfort.sound){audio.current?.dispose();audio.current=null;runtime.current?.setAmbience(null);setSoundOn(false);}},[comfort.sound]);
  useEffect(()=>()=>{audio.current?.dispose();audio.current=null;},[]);
  function toggleSound(){
    const next=!soundOn;updateComfort({sound:next});audio.current?.dispose();audio.current=null;
    if(next){try{audio.current=createWorldAmbience();}catch{audio.current=null;}}
    runtime.current?.setAmbience(audio.current);setSoundOn(next&&audio.current!==null);
  }
  // Mountain v2's glass dam is the one Fund picture on the island (D-M3, CONTRACT §2.2): the same BasinReading the old
  // world's dam reads, turned into a level by the same session-scaled view; the region draws it and reads nothing itself.
  const basinView=useRef(createBasinView());
  const freshness:FundPulseFreshness=props.interpretationGate?.freshness==='stale'||props.interpretationGate?.freshness==='offline'?props.interpretationGate.freshness:'current';
  const basin=useMemo(()=>props.today?buildBasinReading(household,props.today,freshness):null,[household,props.today,freshness]);
  useEffect(()=>{const v=basinView.current(basin);runtime.current?.setMountainDamWater?.(v.level,v.reserveLevel);},[basin]);
  useEffect(()=>publishLocalPose(()=>{const b=runtime.current?.body();return b?{target:[b.x,b.y,b.z],theta:b.yaw-Math.PI,body:{...b,world:HORIZON_PRESENCE_WORLD}}:null;}),[]);
  useEffect(()=>{const restore=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.identity===houseIdentity(identityRef.current)&&validHouseBody(detail.body)&&isSavedHorizonWorld(detail.body.world))runtime.current?.restore(detail.body);};window.addEventListener('hearth:house-return',restore);return()=>window.removeEventListener('hearth:house-return',restore);},[]);
  function onDoor(host:Host,body:ReturnType<HorizonRuntime['savedBody']>){
    try{saveHouseReturnOnDevice(identity,route,body,'horizon');saveHouseReturnOnDevice(identity,route,body);}catch{/* In-memory return remains available. */}
    const target=HORIZON_HOST_TOOLS[host.id],place=(host.toolPlaceId??host.placeIds[0]) as HarbourPlaceId,address=VILLAGE_ADDRESS[place];
    // PR C: a door walks you into the old world's 3D room (the shell switches there, `harbourShellFor`); its tools open
    // from the room's own objects, as they always did. Without a location seam the tool itself opens.
    if(props.onNavigateLocation&&address)props.onNavigateLocation({...route,...address,surface:undefined,object:undefined});else if(target)props.onOpen(target);
  }
  // ── The old app shell around the Horizon ──
  const space=props.space==='mine'?'mine':'ours';
  const toolOpen=Boolean(route.surface);
  const [mover,setMover]=useState<HorizonMoverState|null>(null);
  const [monorail,setMonorail]=useState<MonorailState|null>(null);
  const riding=Boolean(mover?.attached||mover?.airborne||monorail);
  const [touch]=useState(readTouch);
  const [emotesOpen,setEmotesOpen]=useState(false),[travelTo,setTravelTo]=useState<HarbourPlaceId|null>(null);
  const [guideOpen,setGuideOpen]=useState(false);
  const [worldReady,setWorldReady]=useState(false);
  const [rects,setRects]=useState<ProjectedRect[]>([]);
  useEffect(()=>{
    if(!worldReady)return;
    const point=new THREE.Vector3();
    const update=()=>{
      const world=runtime.current,stage=document.querySelector<HTMLElement>('.horizon-stage');
      if(!world?.world?.hosts||!stage)return;
      const width=stage.clientWidth,height=stage.clientHeight,next:ProjectedRect[]=[];
      world.camera.updateMatrixWorld();
      for(const host of world.world.hosts){
        const place=(host.toolPlaceId??host.placeIds[0]) as HarbourPlaceId|undefined;
        if(!place||!('xy' in host.door))continue;
        point.set(host.door.xy[0],(host.door.height??world.geography.ground(host.door.xy[0],host.door.xy[1]))+1.3,host.door.xy[1]).project(world.camera);
        if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
        const visible=point.z>=-1&&point.z<=1&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1;
        next.push({id:`visit:${place}`,kind:'anchor',group:'host',label:`Visit ${HARBOUR_PLACE_NAMES[place]}`,x:Math.max(0,Math.min(width-44,(point.x+1)*width/2-22)),y:Math.max(0,Math.min(height-44,(1-point.y)*height/2-22)),w:44,h:44,visible});
      }
      setRects(previous=>previous.length===next.length&&previous.every((rect,i)=>{const other=next[i];return other&&rect.id===other.id&&rect.visible===other.visible&&Math.abs(rect.x-other.x)<1&&Math.abs(rect.y-other.y)<1;})?previous:next);
    };
    update();const id=window.setInterval(update,250);return()=>window.clearInterval(id);
  },[worldReady]);
  const glassNight=useGlassNight();
  const {reading,statusLine}=useHarbourReading({household,memberId,today:props.today,freshness,interpretationGate:props.interpretationGate});
  const mineSource=props.mineHousehold??household;
  const mine=useMemo(()=>space==='mine'?mineLayer(mineSource,memberId,props.today):emptyMineLayer(memberId),[space,mineSource,memberId,props.today]);
  const openMine=(kind:MineOpenKind,id:string|null)=>{
    if(props.onOpenMine){props.onOpenMine(kind,id);return;}
    if(kind==='bank')props.onOpen('loft-banks',id?`bank/${id}`:undefined);
    else props.onOpen('planner');
  };
  const softPeer=useMemo(()=>props.presence?.peers?.find(p=>p.memberId!==memberId)??null,[props.presence,memberId]);
  const partnerName=useMemo(()=>{
    const walkName=peer.memberId?memberDisplayName(household.members,peer.memberId):null;
    if(softPeer)return softPeer.name;
    return walkName??props.partnerName??null;
  },[softPeer,peer.memberId,household.members,props.partnerName]);
  const here=harbourPlaceFor(route,scope,true)??'court';
  /** Walk the body to a harbour place along the Horizon's paths (All tools › Places, a panel's Visit, the room bar). */
  const lastHere=useRef(here);
  const [notice,setNotice]=useState('');
  const walkToPlace=useCallback((place:HarbourPlaceId)=>{
    const world=runtime.current;if(!world)return false;
    const at=horizonPlaceTarget(world.world,place);if(!at)return false;
    if(world.monorailState?.()){setTravelTo(null);setNotice('Step off the monorail at a platform before choosing another place.');return false;}
    // A ride owns the body (PR #570 review): refuse, and say so, rather than queue a walk the ride would never take.
    const riding=world.moverState();if(riding.attached||riding.airborne){setTravelTo(null);setNotice('Park the ride first, then choose where to go.');return false;}
    // On the board, step off first: a place chosen while skating is a walk (PR #571 review).
    if(world.skate()?.active()){world.skate()?.setAudio(null);world.stopSkate();setSkating(null);}
    world.setMode('walk');const plan=world.walkTo(at);setTravelTo(plan?place:null);setNotice(plan?'':'That path is blocked. Choose another way.');world.emote(null);return Boolean(plan);
  },[]);
  useEffect(()=>{if(!notice)return;const id=window.setTimeout(()=>setNotice(''),4000);return()=>window.clearTimeout(id);},[notice]);
  // Arrival ends "travelling" (the room bar's word for it) and makes the place the current one, as the old shell's
  // Places did by navigating there (PR #570 review). A walk the person abandons ends without moving the route.
  // Committed routes only (PR #570 review): a discarded render never leaves a stale route here.
  const routeRef=useRef(route);useLayoutEffect(()=>{routeRef.current=route;});
  useEffect(()=>{
    if(!travelTo)return;
    const id=window.setInterval(()=>{
      const world=runtime.current,b=world?.body(),at=world&&horizonPlaceTarget(world.world,travelTo);
      if(!world||!b||!at){setTravelTo(null);return;}
      if(Math.hypot(b.x-at[0],b.z-at[2])<3){
        setTravelTo(null);
        if(harbourPlaceFor(routeRef.current,scope,true)!==travelTo&&props.onNavigateLocation){lastHere.current=travelTo;props.onNavigateLocation({...routeRef.current,...VILLAGE_ADDRESS[travelTo],surface:undefined,object:undefined});}
      }else if(!world.routing())setTravelTo(null);
    },500);
    return()=>window.clearInterval(id);
  },[travelTo]); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * Quick travel (Jonathan, 2026-10-04): All tools › Places and a panel's Visit jump to the place instead of walking the
   * whole island. The same refusals as the walk (a ride, the monorail) and the same arrival: the place becomes the current
   * one at once, so the route change does not then walk there as well. The map's markers and the doors still walk.
   */
  const jumpToPlace=useCallback((place:HarbourPlaceId)=>{
    const world=runtime.current;if(!world)return false;
    const at=horizonPlaceTarget(world.world,place);if(!at)return false;
    if(world.monorailState?.()){setTravelTo(null);setNotice('Step off the monorail at a platform before choosing another place.');return false;}
    const riding=world.moverState();if(riding.attached||riding.airborne){setTravelTo(null);setNotice('Park the ride first, then choose where to go.');return false;}
    if(world.skate()?.active()){world.skate()?.setAudio(null);world.stopSkate();setSkating(null);}
    world.setMode('walk');
    const host=horizonHostFor(world.world,place),name=place==='court'?'the square':HARBOUR_PLACE_NAMES[place];
    if(!world.quickTravel(at,host?(host.facing??0)+Math.PI:undefined,`Quick travel to ${name}.`)){setTravelTo(null);setNotice('Finish what you are doing here, then choose where to go.');return false;}
    setTravelTo(null);setNotice('');world.emote(null);
    if(harbourPlaceFor(routeRef.current,scope,true)!==place&&props.onNavigateLocation){lastHere.current=place;props.onNavigateLocation({...routeRef.current,...VILLAGE_ADDRESS[place],surface:undefined,object:undefined});}
    return true;
  },[scope,props.onNavigateLocation]); // eslint-disable-line react-hooks/exhaustive-deps
  // All tools › Places (App `openPlacePanel`) and the QuickSheet dispatch this: on the Horizon it is a quick travel.
  useEffect(()=>{
    const go=(event:Event)=>{const place=(event as CustomEvent<{place?:string}>).detail?.place;if(place&&Object.hasOwn(VILLAGE_ADDRESS,place))jumpToPlace(place as HarbourPlaceId);};
    window.addEventListener(HARBOUR_GO_EVENT,go);return()=>window.removeEventListener(HARBOUR_GO_EVENT,go);
  },[jumpToPlace]);
  // A route to another harbour place (the room bar, Compass) walks there; the first route is where the saved body is.
  // Only a walk actually started moves the marker, so a place chosen while a tool was open is walked to once it closes.
  // …and one chosen before the world was ready is walked to once it is (PR #570 review).
  // A place chosen while riding waits until the ride is parked; only a walk actually started marks it handled (PR #570 review).
  useEffect(()=>{if(lastHere.current===here||toolOpen||!worldReady||riding)return;if(walkToPlace(here))lastHere.current=here;},[here,toolOpen,worldReady,riding,walkToPlace]);
  /** "Step in" on a panel: through that host's door, which opens its tool as a Horizon door always has. */
  function stepIn(place:string){const world=runtime.current,host=world&&horizonHostFor(world.world,place);if(host&&world?.enterDoor(host.id))return;if(Object.hasOwn(VILLAGE_ADDRESS,place))walkToPlace(place as HarbourPlaceId);}
  // ── The old Tideline skate, put down anywhere on the island (PR B) ── the same HUD, keys, saves and progress key.
  const [skating,setSkating]=useState<SkateHudModel|null>(null),[skateSaveFailed,setSkateSaveFailed]=useState(false),[canSkate,setCanSkate]=useState(false),[skateWhy,setSkateWhy]=useState<string|null>(null);
  const skateKey=skateProgressKey(household.environment,household.householdId,memberId),skateKeyRef=useRef(skateKey);skateKeyRef.current=skateKey;
  const skateSaved=useRef(''),skateAudio=useRef<SkateAudio|null>(null);
  const onSkate=useCallback((next:NativeSkateFrame|null)=>{
    setSkating(next?.model??null);
    if(next){const serialized=JSON.stringify(next.progress);if(serialized!==skateSaved.current){skateSaved.current=serialized;let saved=false;try{saved=saveSkateProgress(localStorage,skateKeyRef.current,next.progress);}catch{saved=false;}setSkateSaveFailed(!saved);}}
  },[]);
  const dropSkateAudio=()=>{runtime.current?.skate()?.setAudio(null);skateAudio.current?.dispose();skateAudio.current=null;};
  /** Only inside a click or key (an AudioContext needs a gesture). */
  const wantSkateAudio=(on:boolean)=>{if(!on){dropSkateAudio();return;}if(!skateAudio.current){try{skateAudio.current=createSkateAudio();}catch{skateAudio.current=null;}}runtime.current?.skate()?.setAudio(skateAudio.current);};
  useEffect(()=>()=>{skateAudio.current?.dispose();skateAudio.current=null;},[]);
  useEffect(()=>{runtime.current?.stopSkate();dropSkateAudio();setSkating(null);skateSaved.current='';setSkateSaveFailed(false);},[skateKey]); // eslint-disable-line react-hooks/exhaustive-deps
  function startSkating(){
    let progress;try{progress=readSkateProgress(localStorage,skateKey);}catch{progress=undefined;}
    const world=runtime.current;if(!world)return false;
    if(world.mode()!=='walk')world.setMode('walk');
    // The shell hides the stage's status line, so the visible phrase says why the board stayed in hand (water, a room,
    // steep or unsupported ground, ground still arriving, another ride) rather than always blaming a ride.
    if(!world.startSkate(progress)){setNotice(world.skateRefusal?.()??'Park your current ride before skating.');return false;}
    if(progress?.settings.sound)wantSkateAudio(true);
    setEmotesOpen(false);focusStage();return true;
  }
  function leaveSkating(){dropSkateAudio();runtime.current?.stopSkate();setSkating(null);focusStage();}
  const skateSettings=(patch:Partial<SkateSettings>)=>{runtime.current?.skate()?.settings(patch);if(patch.sound!==undefined)wantSkateAudio(patch.sound);};
  const skateZone=(zone:TouchZone,event:React.PointerEvent<HTMLElement>)=>{
    const input=runtime.current?.skate()?.input();if(!input)return;const e=event.nativeEvent;
    if(event.type==='pointerdown')input.touchStart(zone,e);else if(event.type==='pointermove')input.touchMove(e);else if(event.type==='pointerup')input.touchEnd(e);else input.touchCancel(e);
  };
  // Where the board can come out: polled, like the Horizon's own offers.
  useEffect(()=>{if(!worldReady)return;const id=window.setInterval(()=>{const world=runtime.current,why=world?.skateRefusal?.()??null;setSkateWhy(why);setCanSkate(Boolean(world?.hasSkate?.()&&!world.skate()?.active())&&why===null);},400);return()=>window.clearInterval(id);},[worldReady]);
  // B boards and leaves (as on the Mountain); P and Escape pause the ride and open the book.
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const k=event.key.toLowerCase(),world=runtime.current,stage=document.querySelector('.horizon-stage');
      if(!world||event.repeat||!stage||document.activeElement!==stage)return;
      const board=world.skate();
      if(k==='b'){if(board?.active())leaveSkating();else if(world.hasSkate?.())startSkating();else return;event.preventDefault();return;}
      if(board?.active()&&(k==='p'||k==='escape')){board.pause(!board.paused());event.preventDefault();}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  function focusStage(){(document.querySelector('.horizon-stage') as HTMLElement|null)?.focus({preventScroll:true});}
  function doEmote(id:EmoteId){runtime.current?.emote(id);setEmotesOpen(false);focusStage();}
  function monorailAction(action:MountainAction){
    const world=runtime.current;if(!world)return;
    if(action.kind==='monorail-select')world.monorailSelect(action.stop);
    else if(action.kind==='monorail-control')world.monorailControl(action.control,action.value);
  }
  function showGuide(){setGuideOpen(true);}
  /** The Guide's "Glider launches" (Jonathan 2026-10-04): stand on that pad's deck, ready to run off; refused (and said) while a ride, the galley or the monorail owns the body. */
  function goToGliderPad(id:string){
    setGuideOpen(false);const world=runtime.current;if(!world)return;
    // The runtime refuses while skating (step off the board first); the board session is never discarded by a Guide choice.
    const result=world.goToGliderPad(id as GliderPadId);
    if(!result.ok){setNotice(result.reason);focusStage();return;}
    setTravelTo(null);world.emote(null);setNotice('');focusStage();
  }
  const skateAvailable=worldReady&&Boolean(runtime.current?.hasSkate?.());
  useOfferWorldActions({skate:skateAvailable&&!riding&&!toolOpen?startSkating:undefined});
  // The phone branch is below 720px (AGENTS.md), so the glass is lite there.
  const lite=typeof window.matchMedia==='function'&&window.matchMedia('(max-width: 719px)').matches;
  // The emote row's 1–6 shortcuts, as on the Mountain (the row shows them).
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{const slot=EMOTE_IDS[Number(event.key)-1];if(!slot||event.repeat||event.metaKey||event.ctrlKey||event.altKey)return;const stage=document.querySelector('.horizon-stage');if(!stage||document.activeElement!==stage)return;doEmote(slot);event.preventDefault();};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const dock=props.dock&&!toolOpen?<Dock {...props.dock} calm={comfort.quiet} lite={lite} night={glassNight} cameraMoving={false} card={{...props.dock.card,onStepIn:showGuide}}/>:undefined;
  const presence=<WalkTogether environment={household.environment} share={walkShare} onShare={setWalkShare} walk={peer.walk} walkName={peer.walk?partnerName:null} worldUnavailable={peer.unavailable} soft={softPeer} here={here} placeName={HARBOUR_PLACE_NAMES[here]} softPresenceOptedOut={props.presence?.optedOut===true} onUnhide={props.onUnhide} hasPartner={Boolean(softPeer||props.partnerName||peer.memberId)}/>;
  return <section data-harbour-space={space} data-harbour-world="horizon" className={`harbour-world harbour-world--${theme} harbour-world--horizon${skating?' is-skating':''}${toolOpen?' has-open-object':''}`} data-world-status={worldReady?'ready':'loading'} data-world-scope={scope} data-harbour-place={here} data-harbour-tier={lite?'lite':'full'} data-horizon-riding={riding?'':undefined} aria-label={HARBOUR_PLACE_NAMES[here]}>
    <div className="harbour-world__stage">
      <HorizonStage shell skating={Boolean(skating)} avatar={avatar} onAvatarStatus={(loaded,status)=>{if(loaded===avatarRef.current)setAvatarStatus(status);}} onFailed={props.onFailed} onMover={setMover} onSkate={onSkate} onMonorail={setMonorail} homePlotId={homeBook?.plotId} homeLayout={homeBook?.layout??undefined} homeDisplays={homeBook?.displays} visitHome={homeBook?.pendingVisit} onHomeVisited={homeBook?.acknowledgeVisit} onHomeBook={homeBook?.open} onHomeWorkspace={target=>{const body=runtime.current?.savedBody();if(body){saveHouseReturnOnDevice(identity,route,body,'horizon');saveHouseReturnOnDevice(identity,route,body);}props.onOpen(target);}} key={identityKey} fleetStorageKey={`hearth:horizon-fleet:v1:${identityKey}`} kitchenStorageKey={`hearth:yacht-kitchen:v1:${identityKey}`} cruiserPreference={cruiserPreferenceKey(household.environment,household.householdId,memberId)} theme={theme} onDoor={onDoor} initialBody={initialBody} onReady={()=>{setWorldReady(true);arriveForRequest();props.onWorldReady?.();}} onRuntime={value=>{if(!value&&runtime.current)saveHouseReturnOnDevice(identity,route,runtime.current.savedBody(),'horizon');runtime.current=value;value?.setAmbience?.(audio.current);{const v=basinView.current(basin);value?.setMountainDamWater?.(v.level,v.reserveLevel);}value?.setHomeBotanical?.(appearance.saved.queen??DEFAULT_QUEEN_STYLE,botanical);}} sound={{on:soundOn,toggle:toggleSound}} partner={peer.walk} calm={comfort.quiet} reducedMotion={comfort.motion==='reduced'} paused={guideOpen||homeBook?.editing===true||Boolean(route.surface&&route.surface!=='queen')} />
      {!worldReady&&!toolOpen&&<HarbourFlat place={here} reading={reading} status="loading" theme={theme} overlay/>}
      {!toolOpen&&<MineRibbon space={space}/>}
      {space==='mine'&&worldReady&&!toolOpen&&<MineLayer layer={mine} place="court" rects={rects} hidden={Boolean(riding||skating)} onOpen={openMine}/>}
      {worldReady&&!toolOpen&&<HarbourTwins rects={rects} hidden={Boolean(riding||skating)} label="Horizon places" onActivate={rect=>{const place=rect.id.startsWith('visit:')?rect.id.slice(6):null;if(place&&Object.hasOwn(HARBOUR_PLACE_NAMES,place))walkToPlace(place as HarbourPlaceId);}}/>}
      {worldReady&&!toolOpen&&<VillageHUD memberId={memberId} theme={theme} calm={comfort.quiet} lite={lite} night={glassNight} alwaysShowLabels={comfort.labels} toolsOpen={props.toolsOpen} glassBetween={dock} fab={props.fab} onQuickSheet={props.onQuickSheet} place={here} travelling={travelTo} onVisit={place=>{walkToPlace(place);}} onGuide={showGuide} avatar={avatar} avatarStatus={avatarStatus} onAvatar={chooseAvatar} presence={presence}/>}
      {worldReady&&!toolOpen&&<HorizonGuide open={guideOpen} onClose={()=>{setGuideOpen(false);focusStage();}} views={runtime.current?.world?.views??[]} onView={id=>{runtime.current?.setMode('look');runtime.current?.shot(id);setGuideOpen(false);focusStage();}} onWalk={()=>{runtime.current?.setMode('walk');setGuideOpen(false);focusStage();}} onPlace={place=>{setGuideOpen(false);walkToPlace(place);}} skateAvailable={skateAvailable&&!riding} skateHere={canSkate} skateWhy={skateWhy} onSkate={()=>{if(startSkating())setGuideOpen(false);}} onRace={()=>{if(startSkating()){runtime.current?.skate()?.route('mountain-descent');setGuideOpen(false);}}} monorailAvailable={runtime.current?.hasMonorail?.()??false} onMonorail={(from,stops)=>{if(runtime.current?.monorailBoard(from)){for(const stop of stops)runtime.current?.monorailSelect(stop);setGuideOpen(false);focusStage();}}} onJourney={props.onJourney} soundOn={soundOn} onSound={toggleSound} gliderPads={runtime.current?.gliderPads?.()??[]} onGliderPad={goToGliderPad}/>}
      {monorail&&!toolOpen&&<MountainPanel open={false} monorail={monorail} partnerName={partnerName} statusLine={null} onAction={monorailAction} onOpen={props.onOpen}/>}
      {worldReady&&!toolOpen&&props.panel?.host&&<HostPanel key={props.panel.host} host={props.panel.host} reading={reading} extras={props.panel.extras} theme={theme} onClose={props.panel.onClose} onOpen={props.panel.onOpen} onRecord={props.panel.onRecord} onMarkPaid={props.panel.onMarkPaid} onTalk={props.panel.onTalk} returnFocusTo={props.panel.returnFocusTo}
        onVisit={()=>{const host=props.panel?.host;if(host&&host!=='hercules'&&Object.hasOwn(VILLAGE_ADDRESS,host))jumpToPlace(host as HarbourPlaceId);props.panel?.onClose();}}
        onStepIn={host=>{if(host!=='hercules')stepIn(host);props.panel?.onClose();}}/>}
      {worldReady&&!toolOpen&&!riding&&skateAvailable&&<SkateHUD model={skating} onStart={startSkating} onWalk={leaveSkating} onOpenFund={()=>{leaveSkating();props.onOpen('fund');}}
        onReplay={action=>runtime.current?.skate()?.replay(action)} onSettings={skateSettings} onCommand={command=>runtime.current?.skate()?.command(command)} onZonePointer={skateZone}
        gesturePath={skateGesturePath} trickBook={SKATE_TRICK_BOOK} onPause={on=>runtime.current?.skate()?.pause(on)} onRoute={id=>runtime.current?.skate()?.route(id)}
        onSpot={id=>runtime.current?.skate()?.spot(id)} onDeck={id=>runtime.current?.skate()?.deck(id)} presence={presence} onFocus={focusStage} saveFailed={skateSaveFailed}/>}
      {!route.surface&&!skating&&<div className="harbour-world__home-book" style={{position:'absolute',right:18,top:72,zIndex:12}}><HomeBookButton/></div>}
      {worldReady&&!toolOpen&&!skating&&<button type="button" className="horizon-recovery" aria-label="Reset position to safe ground" onPointerDown={event=>event.stopPropagation()} onClick={()=>{runtime.current?.retry();setEmotesOpen(false);focusStage();}}><span aria-hidden="true">↺</span> Reset position</button>}
      {worldReady&&!toolOpen&&!riding&&!skating&&<div className="harbour-moves harbour-moves--horizon" data-harbour-moves={emotesOpen?'open':'shut'}>
        {emotesOpen&&<div className="harbour-moves__emotes" role="group" aria-label="Emotes">
          {EMOTE_IDS.map((id,i)=><button key={id} type="button" className="harbour-moves__emote" data-emote={id} onPointerDown={event=>event.stopPropagation()} onClick={()=>doEmote(id)}>{EMOTE_FACES[id]}<small>{i+1}</small></button>)}
        </div>}
        <div className="harbour-moves__row">{touch&&<><button type="button" className="harbour-moves__key" onPointerDown={event=>event.stopPropagation()} onClick={()=>{runtime.current?.jump();focusStage();}}>Jump</button><button type="button" className="harbour-moves__key" onPointerDown={event=>event.stopPropagation()} onClick={()=>{runtime.current?.accept();focusStage();}}>Interact</button></>}{mover?.stowed&&<button type="button" className="harbour-moves__key" onPointerDown={event=>event.stopPropagation()} onClick={()=>{runtime.current?.resumeEquipment();focusStage();}}>Ride {mover.stowed}</button>}<button type="button" className="harbour-moves__key" aria-keyshortcuts="V" onPointerDown={event=>event.stopPropagation()} onClick={()=>{runtime.current?.toggleCruiser();focusStage();}}>Ride</button><button type="button" className="harbour-moves__key" onPointerDown={event=>event.stopPropagation()} onClick={()=>{runtime.current?.toggleCruiser('bicycle');focusStage();}}>Bike</button><button type="button" className="harbour-moves__key" aria-pressed={emotesOpen} onPointerDown={event=>event.stopPropagation()} onClick={()=>setEmotesOpen(open=>!open)}>Emote</button></div>
      </div>}
      <p className="harbour-world__phrase" role="status" aria-live="polite">{notice}</p>
      {statusLine&&<small className="harbour-world__supported" role="status">{statusLine}</small>}
      {!props.ready&&worldReady&&<small className="harbour-world__checking" role="status">Checking the books · {props.freshness}</small>}
    </div>
    {props.children}
  </section>;
}
