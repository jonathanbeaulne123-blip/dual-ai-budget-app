import type {KitchenProgress,KitchenResult,KitchenState,RecipeId,ServiceId} from './types.ts';

export type KitchenStorageBackend=Pick<Storage,'getItem'|'setItem'>;
export type KitchenStorageFailure='unavailable'|'read'|'corrupt'|'write'|'invalid'|null;
export const KITCHEN_REWARDS=[
  {id:'chef-apron',label:'Chef’s apron',kind:'outfit',description:'Finish a service with a delivered dish.'},
  {id:'galley-sea-glass',label:'Sea-glass kitchen finish',kind:'finish',description:'Earn two stars at Lunch at Anchor.'},
  {id:'sunset-table',label:'Sunset table setting',kind:'table',description:'Earn two stars at Sunset Deck Service.'},
  {id:'captains-memento',label:'Captain’s service memento',kind:'display',description:'Earn three stars at Captain’s Banquet.'},
] as const;
const services:readonly ServiceId[]=['first','lunch','sunset','banquet','practice'];
const recipes:readonly RecipeId[]=['salad','bruschetta','fish','pasta','burger'];
const forbidden=new Set(['__proto__','constructor','prototype']);
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const exact=(v:Record<string,unknown>,names:readonly string[])=>Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const validId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=160&&!forbidden.has(v);
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v,(_key,value:unknown)=>{
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Non-finite kitchen state');
  return value;
})) as T;
export const freshKitchenProgress=():KitchenProgress=>({version:1,completed:{},best:{},unlocks:[]});
function validResult(v:unknown):v is KitchenResult{
  if(!object(v)||!exact(v,['id','service','players','score','served','missed','bestSequence','stars','recipes']))return false;
  return validId(v.id)&&services.includes(v.service as ServiceId)&&(v.players===1||v.players===2)&&
    ['score','served','missed','bestSequence','stars'].every(k=>integer(v[k]))&&Number(v.stars)<=3&&Number(v.bestSequence)<=Number(v.served)&&
    Array.isArray(v.recipes)&&v.recipes.every(r=>recipes.includes(r as RecipeId))&&new Set(v.recipes).size===v.recipes.length;
}
function sameResult(a:KitchenResult,b:KitchenResult){
  return a.id===b.id&&a.service===b.service&&a.players===b.players&&a.score===b.score&&a.served===b.served&&a.missed===b.missed&&a.bestSequence===b.bestSequence&&a.stars===b.stars&&a.recipes.length===b.recipes.length&&a.recipes.every((id,i)=>id===b.recipes[i]);
}
function earned(result:KitchenResult):string[]{
  const rewards:string[]=[];
  if(result.served>0)rewards.push('chef-apron');
  if(result.service==='lunch'&&result.stars>=2)rewards.push('galley-sea-glass');
  if(result.service==='sunset'&&result.stars>=2)rewards.push('sunset-table');
  if(result.service==='banquet'&&result.stars>=3)rewards.push('captains-memento');
  return rewards;
}
function addResult(progress:KitchenProgress,result:KitchenResult){
  progress.completed[result.id]=copy(result);
  const previous=progress.best[result.service];
  if(!previous||result.score>previous.score||result.score===previous.score&&result.stars>previous.stars)progress.best[result.service]=copy(result);
  progress.unlocks=[...new Set([...progress.unlocks,...earned(result)])];
}
function decodeProgress(value:unknown):KitchenProgress|null{
  if(!object(value)||!exact(value,['version','completed','best','unlocks'])||value.version!==1||!object(value.completed)||!object(value.best)||!Array.isArray(value.unlocks))return null;
  const progress=freshKitchenProgress();
  for(const [id,result] of Object.entries(value.completed)){
    if(!validId(id)||!validResult(result)||result.id!==id)return null;
    addResult(progress,result);
  }
  if(Object.keys(value.best).some(s=>!services.includes(s as ServiceId)))return null;
  for(const service of services){
    const raw=value.best[service],expected=progress.best[service];
    if(expected===undefined?raw!==undefined:!validResult(raw)||!sameResult(raw,expected))return null;
  }
  if(value.unlocks.length!==progress.unlocks.length||value.unlocks.some((id,i)=>id!==progress.unlocks[i]))return null;
  return progress;
}
type RecordV1={version:1;progress:KitchenProgress;session:unknown|null};
function sessionEnvelope(value:unknown):boolean{
  // The engine performs the full item-ownership/recipe validation atomically before
  // resuming. Storage only accepts a complete JSON snapshot envelope, never fragments.
  return value===null||object(value)&&value.version===1&&['idle','menu','ready','playing','paused','results'].includes(String(value.phase))&&
    services.includes(value.service as ServiceId)&&(value.players===1||value.players===2)&&Array.isArray(value.chefs)&&object(value.items)&&Array.isArray(value.orders)&&
    Array.isArray(value.stationIds)&&object(value.assists)&&object(value.trolley)&&object(value.fires)&&Array.isArray(value.events)&&
    ['seed','elapsed','remaining','score','served','missed','sequence','bestSequence','eventSeq','nextId','nextOrderAt','tutorial'].every(k=>typeof value[k]==='number'&&Number.isFinite(value[k]))&&
    (value.pauseReason===null||typeof value.pauseReason==='string')&&(value.result===null||validResult(value.result));
}
function decodeRecord(value:unknown):RecordV1|null{
  if(!object(value)||!exact(value,['version','progress','session'])||value.version!==1||!sessionEnvelope(value.session))return null;
  const progress=decodeProgress(value.progress);return progress?{version:1,progress,session:value.session}:null;
}
function defaultStorage():KitchenStorageBackend|null{try{return typeof localStorage==='undefined'?null:localStorage;}catch{return null;}}

/** One identity-scoped, recreational save. setItem replaces progress and session
 * together, so a repeated result screen cannot grant rewards twice after reload. */
export function createKitchenStorage(key:string,storage:KitchenStorageBackend|null=defaultStorage()){
  let record:RecordV1={version:1,progress:freshKitchenProgress(),session:null},failure:KitchenStorageFailure=null;
  function load(){
    if(!storage){failure='unavailable';return;}
    try{
      const raw=storage.getItem(key);if(raw===null)return;
      let parsed:unknown;try{parsed=JSON.parse(raw);}catch{failure='corrupt';return;}
      const next=decodeRecord(parsed);if(!next){failure='corrupt';return;}
      record=next;
    }catch{failure='read';}
  }
  load();
  function write(next:RecordV1):boolean{
    // Keep an in-memory whole save when the browser denies storage. A later retry
    // writes the same complete record; its result IDs remain idempotent meanwhile.
    record=next;
    if(!storage){failure='unavailable';return false;}
    try{storage.setItem(key,JSON.stringify(next));failure=null;return true;}catch{failure='write';return false;}
  }
  return {
    loadProgress:():KitchenProgress=>copy(record.progress),
    /** The caller must use engine.restore() and resume only on its true result. */
    loadSession:():unknown|null=>copy(record.session),
    saveSession(state:KitchenState|null):boolean{
      if(!sessionEnvelope(state)){failure='invalid';return false;}
      try{return write({...record,session:copy(state)});}catch{failure='invalid';return false;}
    },
    complete(result:KitchenResult):KitchenProgress{
      if(!validResult(result)){failure='invalid';return copy(record.progress);}
      const previous=record.progress.completed[result.id];
      if(previous){
        if(!sameResult(previous,result)){failure='invalid';return copy(record.progress);}
        if(failure==='write'||failure==='unavailable')write(record);
        return copy(record.progress);
      }
      const next=copy(record);addResult(next.progress,result);
      // A completed result and the removal of its unfinished kitchen are one write.
      next.session=null;write(next);return copy(record.progress);
    },
    failed:()=>failure!==null,
    status:():KitchenStorageFailure=>failure,
  };
}
