import {useEffect,useRef,useMemo,useState} from 'react';
import type {HarbourWorldProps} from '../HarbourWorld.tsx';
import HorizonStage from './HorizonStage.tsx';
import type {HorizonRuntime} from './runtime/index.ts';
import {publishLocalPose,useWorldFeed} from '../presence/feed.ts';
import {readWorldPresenceShare} from '../../softPresenceWorld.ts';
import {HORIZON_PRESENCE_WORLD,isSavedHorizonWorld} from '../../worldGeography.ts';
import {readHouseReturnOnDevice,saveHouseReturnOnDevice,houseIdentity,validHouseBody} from '../../house/navigation.ts';
import {VILLAGE_ADDRESS} from '../village/layout.ts';
import type {HarbourPlaceId} from '../flag.ts';
import type {Host} from './world/definition.ts';
import {useComfort} from '../../theme/comfort.ts';
import {createWorldAmbience,type WorldAmbience} from '../mountain/audio.ts';
import {useAppearance} from '../../theme/ThemeProvider.tsx';
export const HORIZON_HOST_TOOLS:Readonly<Record<string,string>>={home:'conversation',bank:'loft-banks',library:'books',glasshouse:'planner',studio:'pottery',cottage:'wardrobe',boathouse:'wishes'};
export default function HorizonWorld(props:HarbourWorldProps){
  const {household,memberId,scope,route}=props,runtime=useRef<HorizonRuntime|null>(null),identity={environment:household.environment,householdId:household.householdId,memberId,scope},identityRef=useRef(identity);identityRef.current=identity;
  const appearance=useAppearance(),theme=appearance.preview??appearance.saved.theme;
  const identityKey=houseIdentity(identity);
  const initialBody=useMemo(()=>readHouseReturnOnDevice(identity,'horizon')?.body,[identityKey]);
  const share=readWorldPresenceShare(household.environment);
  const peer=useWorldFeed({environment:household.environment,householdId:household.householdId,memberId,linked:household.linked===true,view:scope,placeId:'court',softPresenceOptedOut:props.presence?.optedOut===true,share,world:HORIZON_PRESENCE_WORLD});
  // The world's sound, as the Mountain does it (HarbourWorld.tsx): off until a deliberate toggle, and never while comfort.sound is off.
  const [comfort,updateComfort]=useComfort(household.environment),audio=useRef<WorldAmbience|null>(null),[soundOn,setSoundOn]=useState(false);
  useEffect(()=>{if(!comfort.sound){audio.current?.dispose();audio.current=null;runtime.current?.setAmbience(null);setSoundOn(false);}},[comfort.sound]);
  useEffect(()=>()=>{audio.current?.dispose();audio.current=null;},[]);
  function toggleSound(){
    const next=!soundOn;updateComfort({sound:next});audio.current?.dispose();audio.current=null;
    if(next){try{audio.current=createWorldAmbience();}catch{audio.current=null;}}
    runtime.current?.setAmbience(audio.current);setSoundOn(next&&audio.current!==null);
  }
  useEffect(()=>publishLocalPose(()=>{const b=runtime.current?.body();return b?{target:[b.x,b.y,b.z],theta:b.yaw-Math.PI,body:{...b,world:HORIZON_PRESENCE_WORLD}}:null;}),[]);
  useEffect(()=>{const restore=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.identity===houseIdentity(identityRef.current)&&validHouseBody(detail.body)&&isSavedHorizonWorld(detail.body.world))runtime.current?.restore(detail.body);};window.addEventListener('hearth:house-return',restore);return()=>window.removeEventListener('hearth:house-return',restore);},[]);
  function onDoor(host:Host,body:ReturnType<HorizonRuntime['savedBody']>){
    try{saveHouseReturnOnDevice(identity,route,body,'horizon');saveHouseReturnOnDevice(identity,route,body);}catch{/* In-memory return remains available. */}
    const target=HORIZON_HOST_TOOLS[host.id],place=(host.toolPlaceId??host.placeIds[0]) as HarbourPlaceId,address=VILLAGE_ADDRESS[place];
    if(props.onNavigateLocation&&address)props.onNavigateLocation({...route,...address,surface:target,object:undefined});else if(target)props.onOpen(target);
  }
  return <HorizonStage key={identityKey} theme={theme} onDoor={onDoor} initialBody={initialBody} onReady={props.onWorldReady} onRuntime={value=>{if(!value&&runtime.current)saveHouseReturnOnDevice(identity,route,runtime.current.savedBody(),'horizon');runtime.current=value;value?.setAmbience?.(audio.current);}} sound={{on:soundOn,toggle:toggleSound}} partner={peer.walk} paused={Boolean(route.surface&&route.surface!=='queen')} onQuickSheet={props.onQuickSheet} onJourney={props.onJourney}>{props.children}</HorizonStage>;
}
