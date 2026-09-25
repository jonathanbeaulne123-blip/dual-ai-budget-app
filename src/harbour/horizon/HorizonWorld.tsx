import {useEffect,useRef,useState} from 'react';
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
export const HORIZON_HOST_TOOLS:Readonly<Record<string,string>>={home:'conversation',bank:'loft-banks',library:'books',glasshouse:'planner',studio:'pottery',cottage:'wardrobe',boathouse:'wishes'};
export default function HorizonWorld(props:HarbourWorldProps){
  const {household,memberId,scope,route}=props,runtime=useRef<HorizonRuntime|null>(null),identity={environment:household.environment,householdId:household.householdId,memberId,scope},identityRef=useRef(identity);identityRef.current=identity;
  const [initialBody]=useState(()=>{try{return readHouseReturnOnDevice(identity,'horizon')?.body;}catch{return undefined;}});
  const share=readWorldPresenceShare(household.environment);
  const peer=useWorldFeed({environment:household.environment,householdId:household.householdId,memberId,linked:household.linked===true,view:scope,placeId:'court',softPresenceOptedOut:props.presence?.optedOut===true,share,world:HORIZON_PRESENCE_WORLD});
  useEffect(()=>publishLocalPose(()=>{const b=runtime.current?.body();return b?{target:[b.x,b.y,b.z],theta:b.yaw-Math.PI,body:{...b,world:HORIZON_PRESENCE_WORLD}}:null;}),[]);
  useEffect(()=>{const restore=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.identity===houseIdentity(identityRef.current)&&validHouseBody(detail.body)&&isSavedHorizonWorld(detail.body.world))runtime.current?.restore(detail.body);};window.addEventListener('hearth:house-return',restore);return()=>window.removeEventListener('hearth:house-return',restore);},[]);
  function onDoor(host:Host,body:ReturnType<HorizonRuntime['savedBody']>){
    try{saveHouseReturnOnDevice(identity,route,body,'horizon');saveHouseReturnOnDevice(identity,route,body);}catch{/* In-memory return remains available. */}
    const target=HORIZON_HOST_TOOLS[host.id],place=(host.toolPlaceId??host.placeIds[0]) as HarbourPlaceId,address=VILLAGE_ADDRESS[place];
    if(props.onNavigateLocation&&address)props.onNavigateLocation({...route,...address,surface:target});else if(target)props.onOpen(target);
  }
  return <HorizonStage onDoor={onDoor} initialBody={initialBody} onReady={props.onWorldReady} onRuntime={value=>{runtime.current=value;}} partner={peer.walk} paused={Boolean(route.surface&&route.surface!=='queen')} onQuickSheet={props.onQuickSheet} onJourney={props.onJourney}>{props.children}</HorizonStage>;
}
