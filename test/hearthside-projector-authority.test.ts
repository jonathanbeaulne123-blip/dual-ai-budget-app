import {expect,it} from 'vitest';
import {checkProjectorProof,projectorMemoryHash} from '../src/hearthside/projectorAuthority.ts';
import {emptyHearthside,type HearthsideContentSnapshot,type MemoryComposition} from '../src/hearthside/contracts.ts';
import type {ProjectorDownloadProof} from '../src/hearthside/projectorTypes.ts';
const memory:MemoryComposition={version:1,id:'MEMORY-test',revision:1,title:'Just our words',date:null,experienceId:null,media:[],designs:[],recollections:[{memberId:'MEM-A',text:'The ordinary bit was my favourite.'}],hideAmounts:true,approvals:[{memberId:'MEM-A',revision:1},{memberId:'MEM-B',revision:1}],withdrawn:false};
const snapshot=(m=memory):HearthsideContentSnapshot=>({version:1,environment:'development',householdId:'HH-one',sequence:5,memberIds:['MEM-A','MEM-B'],state:{...emptyHearthside(),memories:[m]}});
it('revalidates words-only films against current mutual approval and rejects changed, revoked or replaced audiences',async()=>{
 const proof:ProjectorDownloadProof={version:1,memories:[{id:memory.id,revision:1,sha256:await projectorMemoryHash(memory)}],assets:[]},signal=new AbortController().signal;
 expect(await checkProjectorProof(proof,snapshot(),signal,async()=>false)).toBe(true);
 for(const m of [{...memory,title:'Changed'},{...memory,approvals:[]},{...memory,withdrawn:true}])expect(await checkProjectorProof(proof,snapshot(m),signal,async()=>true)).toBe(false);
 expect(await checkProjectorProof(proof,{...snapshot(),memberIds:['MEM-A','MEM-C']},signal,async()=>true)).toBe(false);
 expect(await checkProjectorProof({...proof,memories:[...proof.memories,...proof.memories]},snapshot(),signal,async()=>true)).toBe(false);
});
it('binds every ordered asset to its chosen memory and checks fresh access with cancellation',async()=>{
 const ref={version:1 as const,contentId:'media-one',revision:1,kind:'image' as const,alt:'The exact caption'},m={...memory,media:[ref]},signal=new AbortController();
 const asset={key:'asset-one',memoryId:m.id,memoryRevision:1,kind:'image' as const,reference:ref,status:'available' as const,sha256:'a'.repeat(64)},proof:ProjectorDownloadProof={version:1,memories:[{id:m.id,revision:1,sha256:await projectorMemoryHash(m)}],assets:[asset]};
 expect(await checkProjectorProof(proof,snapshot(m),signal.signal,async(actual,a)=>actual.id===m.id&&a.sha256===asset.sha256)).toBe(true);
 expect(await checkProjectorProof(proof,snapshot(m),signal.signal,async()=>false)).toBe(false);
 expect(await checkProjectorProof({...proof,assets:[{...asset,reference:{...ref,alt:'Different'}}]},snapshot(m),signal.signal,async()=>true)).toBe(false);
 expect(await checkProjectorProof({...proof,assets:[asset,asset]},snapshot(m),signal.signal,async()=>true)).toBe(false);
 expect(await checkProjectorProof(proof,snapshot(m),signal.signal,async()=>{signal.abort();return true;})).toBe(false);
});
