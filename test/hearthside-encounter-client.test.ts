import {expect,it} from 'vitest';
import {sendEncounterPrivate,type EncounterDeviceStore,type EncounterDeviceRecord,type EncounterPrivateInput} from '../src/hearthside/encounterClient.ts';
import {vaultDigest} from '../src/hearthside/vaultContracts.ts';
import type {VaultClientScope} from '../src/hearthside/vaultClient.ts';
const scope:VaultClientScope={environment:'development',householdId:'HH-TEST',memberId:'A',subject:'account-A'};
function fixture(){const rows=new Map<string,EncounterDeviceRecord>();let ids=0;const key=(s:VaultClientScope,id:string)=>JSON.stringify([s.environment,s.householdId,s.memberId,s.subject,id]);
  const read=(s:VaultClientScope,id:string)=>rows.get(key(s,id))??{key:key(s,id),draft:null,pending:null};
  const store:EncounterDeviceStore={read:async(s,id)=>read(s,id),draft:async(s,id,draft)=>{rows.set(key(s,id),{...read(s,id),draft});},make:async(s,id,make)=>{rows.set(key(s,id),{...read(s,id),make});},
    reserve:async(s,input)=>{const r=read(s,input.encounterId),digest=await vaultDigest(input);if(r.pending&&r.pending.digest!==digest)throw Error('PENDING_ENCOUNTER_ACTION');const pending=r.pending??{id:'request-'+(++ids),input,digest};rows.set(r.key,{...r,pending});return pending;},
    settle:async(s,id,request)=>{const r=read(s,id);if(r.pending?.id===request)rows.set(r.key,{...r,pending:null});}};return{rows,store};}
const input:EncounterPrivateInput={encounterId:'encounter-one',action:'save',expectedRevision:0,answer:{revision:1,text:'Private words',objectId:'window',wardrobeId:null}};
it('reserves private identity before network, retries uncertain acceptance and never crosses an account',async()=>{
  const {store}=fixture(),calls:any[]=[];let lose=true;const client={command:async(value:unknown)=>{expect((await store.read(scope,input.encounterId)).pending).not.toBeNull();calls.push(value);if(lose){lose=false;throw Error('Lost acknowledgement');}return{version:1,encounterId:input.encounterId};}};
  await expect(sendEncounterPrivate(client as any,store,scope,input)).rejects.toThrow('Lost acknowledgement');
  await expect(sendEncounterPrivate(client as any,store,scope,{...input,action:'pause',answer:undefined,expectedRevision:undefined})).rejects.toThrow('PENDING_ENCOUNTER_ACTION');
  await sendEncounterPrivate(client as any,store,scope,input);expect(calls).toHaveLength(2);expect(calls[0].input.id).toBe(calls[1].input.id);expect((await store.read(scope,input.encounterId)).pending).toBeNull();
  await store.draft(scope,input.encounterId,{text:'Only me',objectId:'window',wardrobeId:null});expect((await store.read({...scope,subject:'other-account'},input.encounterId)).draft).toBeNull();
});
it('retains unknown failures, settles definite version rejection and does not send when storage fails',async()=>{
  const {store}=fixture();let calls=0;const reject={command:async()=>{calls++;throw Error('ANSWER_CHANGED');}};
  await expect(sendEncounterPrivate(reject as any,store,scope,input)).rejects.toThrow('ANSWER_CHANGED');expect((await store.read(scope,input.encounterId)).pending).toBeNull();
  const failed={...store,reserve:async()=>{throw Error('PRIVATE_STORAGE_UNAVAILABLE');}};await expect(sendEncounterPrivate(reject as any,failed,scope,input)).rejects.toThrow('PRIVATE_STORAGE_UNAVAILABLE');expect(calls).toBe(1);
});
