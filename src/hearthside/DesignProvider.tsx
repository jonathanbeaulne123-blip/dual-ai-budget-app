import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import type { Goal, Household } from '../core/types.ts';
import type { LedgerSyncClient } from '../ledgerSync/client.ts';
import { displayedKittyPiece } from '../core/kittyStudio.ts';
import { displayedKittyDesignPiece } from './design.ts';
import { HearthsideDesignClient } from './designClient.ts';
import { KittyFlat } from '../kitty/studio/flat.tsx';

const Context=createContext<HearthsideDesignClient|null>(null);
export function HearthsideDesignClientProvider({client,children}:{client:HearthsideDesignClient|null;children:ReactNode}){return <Context.Provider value={client}>{children}</Context.Provider>;}
const emptySubscribe=()=>()=>{};const emptySnapshot=()=>0;
export function HearthsideDesignProvider(props:{household:Household;memberId:string;identity:string;source:()=>LedgerSyncClient|null;children:ReactNode}) {
  return <DesignProviderScope key={JSON.stringify([props.household.environment,props.household.householdId,props.memberId,props.identity])} {...props}/>;
}
function DesignProviderScope(props:Parameters<typeof HearthsideDesignProvider>[0]) {
  const source=useRef(props.source);source.current=props.source;
  const [client,setClient]=useState<HearthsideDesignClient|null>(null);
  useEffect(()=>{const next=new HearthsideDesignClient({environment:props.household.environment,householdId:props.household.householdId,memberId:props.memberId,identity:props.identity,token:async()=>{
    const live=source.current();
    if(!live||live.options.scope.environment!==props.household.environment||live.options.scope.householdId!==props.household.householdId||live.options.scope.memberId!==props.memberId)throw Error('CREATIVE_CONNECTION_UNAVAILABLE');
    return live.options.token();
  }});setClient(next);return ()=>next.close();},[]);
  return <Context.Provider value={client}>{props.children}</Context.Provider>;
}
export function useDesignClient(){const client=useContext(Context);useSyncExternalStore(client?.subscribe??emptySubscribe,client?.snapshot??emptySnapshot,emptySnapshot);return client;}
export function useCanonicalKitty(goal:Goal){
  const client=useDesignClient(),reference=goal.envelope?.designRef;
  useEffect(()=>{if(reference&&client)void client.load(reference.designId,reference.revision);},[client,reference?.designId,reference?.revision]);
  const cached=reference?client?.documents.get(reference.designId):null;
  const document=reference&&cached&&cached.revision>=reference.revision?cached:null;
  return {client,document,piece:reference?document?displayedKittyDesignPiece(document):null:displayedKittyPiece(goal.envelope?.studio),loading:Boolean(reference&&!document),error:reference?client?.errors.get(reference.designId)??(!client?'Connect to load this artwork.':''):''};
}
export function CanonicalKittyFlat({goal,...props}:{goal:Goal}&Omit<ComponentProps<typeof KittyFlat>,'piece'|'glaze'>){
  const {piece,loading,error}=useCanonicalKitty(goal);
  if(loading)return <span className="hearthside-art-loading" role="status">{error?'Artwork unavailable':'Opening your artwork…'}</span>;
  return <KittyFlat {...props} piece={piece} glaze={goal.envelope?.glaze}/>;
}
