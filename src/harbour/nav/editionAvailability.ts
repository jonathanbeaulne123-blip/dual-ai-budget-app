import {useLayoutEffect,useSyncExternalStore} from 'react';

export type EditionAvailability = {flat:boolean; reason:null|'no-webgl'|'save-data'|'failed'};
const AVAILABLE:EditionAvailability={flat:false,reason:null};
let current=AVAILABLE;
const listeners=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
export const editionAvailability=()=>current;
export function publishEditionAvailability(next:EditionAvailability){
  if(current.flat===next.flat&&current.reason===next.reason)return;
  current=next;for(const listener of listeners)listener();
}
export function useEditionAvailability(){return useSyncExternalStore(subscribe,editionAvailability,()=>AVAILABLE);}
export function usePublishEditionAvailability(next:EditionAvailability){
  useLayoutEffect(()=>{publishEditionAvailability(next);},[next.flat,next.reason]);
  useLayoutEffect(()=>()=>publishEditionAvailability(AVAILABLE),[]);
}
export function editionUnavailableWords(reason:EditionAvailability['reason']):string|null{
  return reason==='save-data'?'Data saving is on. Every tool and destination is available in Simple view.'
    :reason==='no-webgl'?'This device cannot draw the 3D world. Every tool and destination is available here.'
    :reason==='failed'?'The 3D world could not be drawn. Every tool and destination is available here.':null;
}
