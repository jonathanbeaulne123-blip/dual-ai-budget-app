import type {VaultClientScope,HearthsideVaultClient} from './vaultClient.ts';
import {vaultAssert,vaultDigest} from './vaultContracts.ts';
import type {EncounterPrivateAnswer,EncounterPrivateView} from '../../workers/hearthsideVaultEncounters.ts';
import type {EncounterChoice} from './encounterContracts.ts';
export type EncounterClient=Pick<HearthsideVaultClient,'command'>;
export type EncounterPrivateInput={encounterId:string;action:'save'|'delete'|'review'|'reveal'|'pause'|'resume'|'withdraw';expectedRevision?:number;answer?:EncounterPrivateAnswer;challenge?:string};
export type EncounterDeviceDraft={text:string;objectId:string;wardrobeId:string|null};
export type EncounterPending={id:string;digest:string;input:EncounterPrivateInput};
export type EncounterDeviceRecord={key:string;draft:EncounterDeviceDraft|null;pending:EncounterPending|null;make?:{baseRevision:number;choice:EncounterChoice}|null};
const keyFor=(scope:VaultClientScope,id:string)=>JSON.stringify([scope.environment,scope.householdId,scope.memberId,scope.subject,id]);
export interface EncounterDeviceStore{
  read(scope:VaultClientScope,id:string):Promise<EncounterDeviceRecord>;
  draft(scope:VaultClientScope,id:string,draft:EncounterDeviceDraft|null):Promise<void>;
  make(scope:VaultClientScope,id:string,value:NonNullable<EncounterDeviceRecord['make']>|null):Promise<void>;
  reserve(scope:VaultClientScope,input:EncounterPrivateInput):Promise<EncounterPending>;
  settle(scope:VaultClientScope,id:string,requestId:string):Promise<void>;
  close?():Promise<void>;
}
/** One pending command per private occurrence; no lost-ACK identity is evicted to make room. */
export class IndexedDbEncounterStore implements EncounterDeviceStore{
  private connection:Promise<IDBDatabase>|null=null;
  constructor(private readonly factory:IDBFactory=indexedDB){}
  private db(){return this.connection??=new Promise<IDBDatabase>((resolve,reject)=>{let failed=false;const request=this.factory.open('hearth-private-encounters-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('occurrences',{keyPath:'key'});
    request.onsuccess=()=>{if(failed)request.result.close();else resolve(request.result);};request.onerror=request.onblocked=()=>{failed=true;reject(Error('PRIVATE_STORAGE_UNAVAILABLE'));};});}
  async read(scope:VaultClientScope,id:string):Promise<EncounterDeviceRecord>{const db=await this.db(),key=keyFor(scope,id);return new Promise((resolve,reject)=>{const r=db.transaction('occurrences','readonly').objectStore('occurrences').get(key);r.onsuccess=()=>resolve(r.result??{key,draft:null,pending:null});r.onerror=()=>reject(Error('PRIVATE_STORAGE_UNAVAILABLE'));});}
  private async update(scope:VaultClientScope,id:string,change:(record:EncounterDeviceRecord)=>EncounterDeviceRecord):Promise<EncounterDeviceRecord>{const db=await this.db(),key=keyFor(scope,id);return new Promise((resolve,reject)=>{
    const tx=db.transaction('occurrences','readwrite'),store=tx.objectStore('occurrences');let result:EncounterDeviceRecord,error:unknown;
    const request=store.get(key);request.onsuccess=()=>{try{result=change(request.result??{key,draft:null,pending:null});if(result.draft===null&&result.pending===null&&!result.make)store.delete(key);else store.put(result);}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(error??Error('PRIVATE_STORAGE_UNAVAILABLE'));});}
  async draft(scope:VaultClientScope,id:string,draft:EncounterDeviceDraft|null){await this.update(scope,id,r=>({...r,draft}));}
  async make(scope:VaultClientScope,id:string,make:NonNullable<EncounterDeviceRecord['make']>|null){await this.update(scope,id,r=>({...r,make}));}
  async reserve(scope:VaultClientScope,input:EncounterPrivateInput){const digest=await vaultDigest(input);const record=await this.update(scope,input.encounterId,r=>{
    vaultAssert(!r.pending||r.pending.digest===digest,'PENDING_ENCOUNTER_ACTION');return{...r,pending:r.pending??{id:`encounter-${crypto.randomUUID()}`,digest,input:structuredClone(input)}};});return record.pending!;}
  async settle(scope:VaultClientScope,id:string,requestId:string){await this.update(scope,id,r=>r.pending?.id===requestId?{...r,pending:null}:r);}
  async close(){try{(await this.connection)?.close();}catch{/* No live connection. */}}
}
export async function sendEncounterPrivate(client:EncounterClient,store:EncounterDeviceStore,scope:VaultClientScope,input:EncounterPrivateInput):Promise<EncounterPrivateView>{
  const pending=await store.reserve(scope,input);
  try{
    const view=await client.command({operation:'encounter-private',input:{...pending.input,id:pending.id}}) as EncounterPrivateView;
    vaultAssert(view.version===1&&view.encounterId===input.encounterId,'INVALID_ENCOUNTER');
    await store.settle(scope,input.encounterId,pending.id);return view;
  }catch(error){
    // These are definite service rejections. Unknown transport/archive failures
    // retain the exact pending request, including through reload/account changes.
    if(error instanceof Error&&/^(ANSWER_CHANGED|ENCOUNTER_WITHDRAWN|ENCOUNTER_PAUSED|INVALID_ENCOUNTER|AUDIENCE_CHANGED|FORBIDDEN)$/.test(error.message))await store.settle(scope,input.encounterId,pending.id);
    throw error;
  }
}
