import {canonical} from '../ledgerSync/patch.ts';
import {sha256String} from '../core/synchronousHash.ts';
import {decodeMemory,type MemoryComposition} from './contracts.ts';
import {encounterId} from './encounterContracts.ts';
import {VAULT_MEDIA_LIMIT,vaultAssert,vaultObject} from './vaultContracts.ts';
import type {VaultClientScope,VaultPendingUpload} from './vaultClient.ts';

export type EncounterMemoryBridge={version:1;key:string;encounterId:string;compositionDigest:string;candidate:MemoryComposition;
  manifest:VaultPendingUpload['manifest'];image:Blob};
const keyFor=(scope:VaultClientScope,id:string,digest:string)=>canonical([scope.environment,scope.householdId,scope.memberId,scope.subject,id,digest]);
export function encounterMemoryIdentity(scope:VaultClientScope,id:string,digest:string){
  encounterId(id);vaultAssert(/^[a-f0-9]{64}$/.test(digest),'ENCOUNTER_CHANGED');
  const common=sha256String(canonical([scope.environment,scope.householdId,id,digest]));
  return{memoryId:`encounter-memory-${common}`,mediaId:`encounter-image-${sha256String(canonical([common,scope.memberId,scope.subject]))}`};
}
export async function encounterImageDigest(image:Blob){
  vaultAssert(image.type==='image/png'&&image.size>8&&image.size<=VAULT_MEDIA_LIMIT,'IMAGE_UNAVAILABLE');
  const bytes=await image.arrayBuffer(),signature=new Uint8Array(bytes,0,8);
  vaultAssert(signature.every((v,i)=>v===[137,80,78,71,13,10,26,10][i]),'IMAGE_UNAVAILABLE');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
/** Explicitly chosen private PNG and the accepting author's draft. No credentials or partner text field. */
export class EncounterBridgeStore{
  private db:Promise<IDBDatabase>;private closed=false;
  constructor(factory:IDBFactory=indexedDB){
    this.db=new Promise((resolve,reject)=>{const r=factory.open('hearthside-encounter-memory-bridges-v1',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('bridges');r.onsuccess=()=>{if(this.closed)r.result.close();resolve(r.result);};
      r.onerror=r.onblocked=()=>reject(Error('PRIVATE_STORAGE_UNAVAILABLE'));});void this.db.catch(()=>{});
  }
  close(){this.closed=true;void this.db.then(db=>db.close()).catch(()=>{});}
  private live(){vaultAssert(!this.closed,'SCOPE_CHANGED');}
  private validate(scope:VaultClientScope,id:string,digest:string,value:unknown):EncounterMemoryBridge{
    vaultObject(value,['version','key','encounterId','compositionDigest','candidate','manifest','image']);
    const row=value as EncounterMemoryBridge,ids=encounterMemoryIdentity(scope,id,digest);
    vaultAssert(row?.version===1&&row.key===keyFor(scope,id,digest)&&row.encounterId===id&&row.compositionDigest===digest,'ENCOUNTER_RECOVERY_INVALID');
    const candidate=decodeMemory(row.candidate);
    vaultAssert(candidate.id===ids.memoryId&&candidate.revision===1&&candidate.approvals.length===0&&!candidate.withdrawn&&!candidate.publication&&candidate.designs.length===0&&candidate.recollections.length===1&&candidate.recollections[0]?.memberId===scope.memberId&&candidate.media.length===1&&candidate.media[0]?.contentId===ids.mediaId,'ENCOUNTER_RECOVERY_INVALID');
    vaultObject(row.manifest,['id','sha256','byteLength','contentType']);
    vaultAssert(row.manifest?.id===ids.mediaId&&row.manifest.contentType==='image/png'&&/^[a-f0-9]{64}$/.test(row.manifest.sha256)&&row.image instanceof Blob&&row.image.type==='image/png'&&row.image.size===row.manifest.byteLength&&row.image.size<=VAULT_MEDIA_LIMIT,'ENCOUNTER_RECOVERY_INVALID');
    return{version:1,key:row.key,encounterId:id,compositionDigest:digest,candidate,manifest:row.manifest,image:row.image};
  }
  async read(scope:VaultClientScope,id:string,digest:string){
    const db=await this.db;this.live();return new Promise<EncounterMemoryBridge|null>((resolve,reject)=>{const r=db.transaction('bridges','readonly').objectStore('bridges').get(keyFor(scope,id,digest));
      r.onsuccess=()=>{try{this.live();resolve(r.result!==undefined?this.validate(scope,id,digest,r.result):null);}catch(e){reject(e);}};r.onerror=()=>reject(Error('PRIVATE_STORAGE_UNAVAILABLE'));});
  }
  async reserve(scope:VaultClientScope,id:string,digest:string,candidate:MemoryComposition,image:Blob){
    const sha256=await encounterImageDigest(image),key=keyFor(scope,id,digest),ids=encounterMemoryIdentity(scope,id,digest);
    const value=this.validate(scope,id,digest,{version:1,key,encounterId:id,compositionDigest:digest,candidate,image,manifest:{id:ids.mediaId,sha256,byteLength:image.size,contentType:'image/png'}});
    const db=await this.db;this.live();return new Promise<EncounterMemoryBridge>((resolve,reject)=>{const tx=db.transaction('bridges','readwrite'),store=tx.objectStore('bridges'),r=store.get(key);let result=value,error:unknown;
      r.onsuccess=()=>{try{this.live();if(r.result!==undefined){result=this.validate(scope,id,digest,r.result);vaultAssert(result.manifest.sha256===sha256&&canonical(result.candidate)===canonical(value.candidate),'ENCOUNTER_IMAGE_REVIEW_CHANGED');}else{const count=store.count();count.onsuccess=()=>{if(count.result>=20){error=Error('PRIVATE_STORAGE_UNAVAILABLE');tx.abort();}else store.put(value,key);};}}catch(e){error=e;tx.abort();}};
      tx.oncomplete=()=>{try{this.live();resolve(result);}catch(e){reject(e);}};tx.onerror=tx.onabort=()=>reject(error??Error('PRIVATE_STORAGE_UNAVAILABLE'));});
  }
  async remove(scope:VaultClientScope,id:string,digest:string){const db=await this.db;this.live();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('bridges','readwrite');tx.objectStore('bridges').delete(keyFor(scope,id,digest));tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(Error('PRIVATE_STORAGE_UNAVAILABLE'));});}
}
