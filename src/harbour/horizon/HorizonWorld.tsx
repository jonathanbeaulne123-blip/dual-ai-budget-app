import {livingEvidence} from '../../house/interpretation.ts';
import {DEFAULT_QUEEN_STYLE} from '../../house/queenStyle.ts';
import {useHomeBook} from '../../home/HomeBookContext.tsx';
import {cruiserPreferenceKey} from './movers/cruiser/tuning.ts';
import {useEffect,useLayoutEffect,useRef,useMemo,useState} from 'react';
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
import type {FundPulseFreshness} from '../../core/fundPulse.ts';
export const HORIZON_HOST_TOOLS:Readonly<Record<string,string>>={home:'conversation',bank:'loft-banks',library:'books',glasshouse:'planner',studio:'pottery',cottage:'wardrobe',boathouse:'wishes'};
export default function HorizonWorld(props:HarbourWorldProps){
  const homeBook=useHomeBook();
  const {household,memberId,scope,route}=props,runtime=useRef<HorizonRuntime|null>(null),identity={environment:household.environment,householdId:household.householdId,memberId,scope},identityRef=useRef(identity);identityRef.current=identity;
  const appearance=useAppearance(),theme=appearance.preview??appearance.saved.theme;
  const botanical=useMemo(()=>livingEvidence(household,memberId,'personal'),[household.personalLife,household.hearthside,memberId]);
  useEffect(()=>{runtime.current?.setHomeBotanical?.(appearance.saved.queen??DEFAULT_QUEEN_STYLE,botanical);},[appearance.saved.queen,botanical]);
  const identityKey=houseIdentity(identity);
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
  const share=readWorldPresenceShare(household.environment);
  const peer=useWorldFeed({environment:household.environment,householdId:household.householdId,memberId,linked:household.linked===true,view:scope,placeId:'court',softPresenceOptedOut:props.presence?.optedOut===true,share,world:HORIZON_PRESENCE_WORLD});
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
    if(props.onNavigateLocation&&address)props.onNavigateLocation({...route,...address,surface:target,object:undefined});else if(target)props.onOpen(target);
  }
  return <HorizonStage homePlotId={homeBook?.plotId} homeLayout={homeBook?.layout??undefined} homeDisplays={homeBook?.displays} visitHome={homeBook?.pendingVisit} onHomeVisited={homeBook?.acknowledgeVisit} onHomeBook={homeBook?.open} onHomeWorkspace={target=>{const body=runtime.current?.savedBody();if(body){saveHouseReturnOnDevice(identity,route,body,'horizon');saveHouseReturnOnDevice(identity,route,body);}props.onOpen(target);}} key={identityKey} fleetStorageKey={`hearth:horizon-fleet:v1:${identityKey}`} kitchenStorageKey={`hearth:yacht-kitchen:v1:${identityKey}`} cruiserPreference={cruiserPreferenceKey(household.environment,household.householdId,memberId)} theme={theme} onDoor={onDoor} initialBody={initialBody} onReady={()=>{arriveForRequest();props.onWorldReady?.();}} onRuntime={value=>{if(!value&&runtime.current)saveHouseReturnOnDevice(identity,route,runtime.current.savedBody(),'horizon');runtime.current=value;value?.setAmbience?.(audio.current);{const v=basinView.current(basin);value?.setMountainDamWater?.(v.level,v.reserveLevel);}value?.setHomeBotanical?.(appearance.saved.queen??DEFAULT_QUEEN_STYLE,botanical);}} sound={{on:soundOn,toggle:toggleSound}} partner={peer.walk} calm={comfort.quiet} reducedMotion={comfort.motion==='reduced'} paused={homeBook?.editing===true||Boolean(route.surface&&route.surface!=='queen')} onQuickSheet={props.onQuickSheet} onJourney={props.onJourney}>{props.children}</HorizonStage>;
}
