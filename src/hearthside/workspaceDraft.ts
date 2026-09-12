import {readEntryLocal as readSession,writeEntryLocal as writeSession,clearEntryLocal as clearSession} from '../entryDraft.ts';
/** Only Hearthside worktable keys persist across restarts; existing Workspace draft policy is unchanged. */
const persistent=(key:string)=>key.startsWith('hearthside-worktable:')||key.startsWith('hearthside-workspace:')||/^[a-f0-9]{64}:publication$/.test(key);
export function readEntryLocal<T>(key:string):T|null {
  if(!persistent(key))return readSession<T>(key);
  if(readSession(key+':volatile-persistent'))return readSession<T>(key);
  try{const raw=localStorage.getItem(key);if(!raw||raw.length>2_100_000)return null;return JSON.parse(raw) as T;}catch{return readSession<T>(key);}
}
export function writeEntryLocal(key:string,value:unknown):boolean {
  if(!persistent(key))return writeSession(key,value);
  try{const text=JSON.stringify(value);if(text.length>2_100_000)return false;localStorage.setItem(key,text);clearSession(key+':volatile-persistent');return true;}catch{writeSession(key,value);writeSession(key+':volatile-persistent',true);return false;}
}
export function clearEntryLocal(key:string):void{clearSession(key);clearSession(key+':volatile-persistent');if(persistent(key))try{localStorage.removeItem(key);}catch{/* The caller retains the current in-memory work. */}}
