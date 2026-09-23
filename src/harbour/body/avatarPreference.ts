import type {PlayableAvatar} from './avatarDefinition.ts';
type Reader=Pick<Storage,'getItem'>;
type Writer=Pick<Storage,'setItem'>;
/** Explicit, device-local choice. Display names never decide which person a member is. */
export function avatarPreferenceKey(environment:string,householdId:string,memberId:string):string{
  return `hearth:harbour-avatar:v1:${JSON.stringify([environment,householdId,memberId])}`;
}
export function readAvatar(storage:Reader,key:string):PlayableAvatar|null{
  try{const value=storage.getItem(key);return value==='bianca'||value==='jonathan'?value:null;}catch{return null;}
}
export function saveAvatar(storage:Writer,key:string,avatar:PlayableAvatar):void{try{storage.setItem(key,avatar);}catch{/* The character still works when local storage is unavailable. */}}
