import {canonical} from '../ledgerSync/patch.ts';
import {sha256String} from '../core/synchronousHash.ts';
import {decodeEncounterCommand,type EncounterCommand} from './encounterContracts.ts';
import type {VaultClientScope} from './vaultClient.ts';

export type EncounterSharedPending={version:1;id:string;operation:EncounterCommand};
export function decodeEncounterSharedPending(input:unknown):EncounterSharedPending{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('ENCOUNTER_RECOVERY_INVALID');
 const value=input as Record<string,unknown>;
 if(Object.keys(value).some(key=>!['version','id','operation'].includes(key))||value.version!==1||typeof value.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id))throw Error('ENCOUNTER_RECOVERY_INVALID');
 return{version:1,id:value.id,operation:decodeEncounterCommand(value.operation)};
}
const definitive=new Set(['ENCOUNTER_CHANGED','REVEAL_REQUIRED','OUTCOME_REVIEW_REQUIRED','ENCOUNTER_SCOPE_CHANGED','AUDIENCE_CHANGED','INVALID_ENCOUNTER','INVALID_ENCOUNTER_COMMAND','ENCOUNTER_PAUSED','ENCOUNTER_NOT_FOUND','WARDROBE_UNAVAILABLE','REQUEST_ID_REUSED']);
/** Shared Make drafts and command identity only. Notice answers and credentials never enter this store. */
export class EncounterSharedClient{
 private db:Promise<IDBDatabase>;private abort=new AbortController();private scopeKey:string;
 constructor(readonly scope:VaultClientScope,private token:()=>Promise<string>,private request:typeof fetch=fetch,factory:IDBFactory=indexedDB){
  if(!['development','production'].includes(scope.environment)||![scope.householdId,scope.memberId,scope.subject].every(v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\s/\u0000-\u001f]/.test(v)))throw Error('SCOPE_CHANGED');
  this.scope=Object.freeze({...scope});this.scopeKey=canonical(this.scope);this.db=new Promise((resolve,reject)=>{const r=factory.open('hearthside-encounter-shared-requests-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('pending');r.onerror=r.onblocked=()=>reject(Error('PRIVATE_STORAGE_UNAVAILABLE'));r.onsuccess=()=>{if(this.abort.signal.aborted)r.result.close();resolve(r.result);};});
  void this.db.catch(()=>{});
 }
 close(){this.abort.abort();void this.db.then(db=>db.close()).catch(()=>{});}
 private live(){if(this.abort.signal.aborted)throw Error('SCOPE_CHANGED');}
 private async mutate(change:(prior:EncounterSharedPending|null)=>EncounterSharedPending|null){
  const db=await this.db;this.live();return new Promise<EncounterSharedPending|null>((resolve,reject)=>{
   const tx=db.transaction('pending','readwrite'),store=tx.objectStore('pending'),r=store.get(this.scopeKey);let next:EncounterSharedPending|null=null,error:unknown;
   r.onsuccess=()=>{try{this.live();next=change(r.result===undefined?null:decodeEncounterSharedPending(r.result));if(next)store.put(next,this.scopeKey);else store.delete(this.scopeKey);}catch(e){error=e;tx.abort();}};
   tx.oncomplete=()=>{try{this.live();resolve(next);}catch(e){reject(e);}};tx.onerror=tx.onabort=()=>reject(error??Error('PRIVATE_STORAGE_UNAVAILABLE'));
  });
 }
 async pending(){const db=await this.db;this.live();return new Promise<EncounterSharedPending|null>((resolve,reject)=>{const r=db.transaction('pending','readonly').objectStore('pending').get(this.scopeKey);r.onsuccess=()=>{try{this.live();resolve(r.result===undefined?null:decodeEncounterSharedPending(r.result));}catch(e){reject(e);}};r.onerror=()=>reject(Error('PRIVATE_STORAGE_UNAVAILABLE'));});}
 async submit(input:EncounterCommand){
  this.live();const operation=decodeEncounterCommand(input),pending=await this.mutate(prior=>{if(prior&&canonical(prior.operation)!==canonical(operation))throw Error('PENDING_ENCOUNTER_ACTION');return prior??{version:1,id:crypto.randomUUID(),operation};});
  return this.send(pending!);
 }
 async retry(){const pending=await this.pending();if(!pending)return false;return this.send(pending);}
 private async send(pending:EncounterSharedPending){
  this.live();const token=await this.token();this.live();
  if(!token||/\s/.test(token))throw Error('UNAUTHENTICATED');
  const request=this.request;
  const response=await request(`/ledger-sync/v2/${this.scope.environment}/${this.scope.householdId}/encounter-command`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(pending),signal:this.abort.signal,cache:'no-store'});
  const raw=await response.text();this.live();if(raw.length>16384)throw Error('ENCOUNTER_RECEIPT_UNCERTAIN');let value;try{value=JSON.parse(raw);}catch{throw Error('ENCOUNTER_RECEIPT_UNCERTAIN');}
  if(!response.ok){const code=typeof value?.error==='string'&&definitive.has(value.error)?value.error:'ENCOUNTER_COMMAND_UNCERTAIN';if(definitive.has(code))await this.mutate(prior=>prior?.id===pending.id?null:prior);throw Error(code);}
  const receipt=value?.receipt;if(value?.version!==1||receipt?.id!=='HS-ENCOUNTER-'+pending.id||receipt.actor!==this.scope.memberId||receipt.digest!==sha256String(canonical(pending))||!Number.isSafeInteger(receipt.sequence)||receipt.sequence<1||!Array.isArray(receipt.postedIds)||receipt.postedIds.length!==0||receipt.commandKind!=='hearthsideEncounter')throw Error('ENCOUNTER_RECEIPT_UNCERTAIN');
  await this.mutate(prior=>prior?.id===pending.id?null:prior);this.live();return true;
 }
}
