import {expect,it} from 'vitest';
import {HearthsideDesignClient} from '../src/hearthside/designClient.ts';
import {acceptKittyDesignOperation,createKittyDesignDocument} from '../src/hearthside/design.ts';
import {KittyDesignError,type KittyDesignOperation} from '../src/hearthside/designContracts.ts';
import {KeyboardStrokeDraftStore} from '../src/hearthside/keyboardStrokeDraft.ts';
const scope={environment:'development' as const,householdId:'HH-client',ownerMemberId:null};
const storage=()=>{const map=new Map<string,string>();return {getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);},removeItem:(key:string)=>{map.delete(key);},clear:()=>map.clear(),key:(i:number)=>[...map.keys()][i]??null,get length(){return map.size;}};};
function setup(){
  let document=createKittyDesignDocument('DESIGN-client',scope),lost=false,calls=0;
  const retained=storage();
  const transport:typeof fetch=async(_url,init)=>{
    calls++;const request=JSON.parse(init!.body as string);
    const response=(receipt:unknown)=>Response.json({version:1,...(request.knownRevision===undefined?{document}:{delta:{designId:document.id,baseRevision:request.knownRevision,revision:document.revision,entries:document.operations.slice(request.knownRevision)}}),receipt,sequence:document.revision});
    if(request.kind==='read'||request.kind==='create')return response(null);
    try{
      const accepted=acceptKittyDesignOperation(document,request.operation,{environment:scope.environment,householdId:scope.householdId,actorId:'MEM-001',order:document.revision+1,acceptedAt:'2026-09-12T12:00:00.000Z'});document=accepted.document;
      if(lost){lost=false;throw new TypeError('lost acknowledgement');}
      return response(accepted.receipt);
    }catch(error){if(error instanceof KittyDesignError)return Response.json({error:error.code},{status:409});throw error;}
  };
  const client=(identity='account-one')=>new HearthsideDesignClient({...scope,memberId:'MEM-001',identity,token:async()=> 'synthetic',fetch:transport,storage:retained});
  return {client,retained,lose:()=>{lost=true;},document:()=>document,calls:()=>calls};
}
const create:KittyDesignOperation={version:1,id:'OP-create',designId:'DESIGN-client',pieceId:'PIECE-client',gestureId:'GESTURE-create',kind:'create-piece',base:'cream'};
const stroke=(id:string,epoch=0):KittyDesignOperation=>({version:1,id,designId:'DESIGN-client',pieceId:'PIECE-client',gestureId:`GESTURE-${id}`,kind:'append-stroke',expectedEditEpoch:epoch,surfaceRevision:0,stroke:{part:'body',tool:'brush',color:'#bb2233',size:12,opacity:1,mirror:false,pts:[.2,.2,.3,.3]}});
it('retains a lost acknowledgement under its original identity across reload, without a second gesture',async()=>{
  const server=setup(),first=server.client();await first.enqueue({version:1,kind:'operate',operation:create});
  server.lose();expect(await first.enqueue({version:1,kind:'operate',operation:stroke('OP-mark')})).toBe(false);
  expect(first.pending[0]?.status).toBe('uncertain');expect(server.document().operations).toHaveLength(2);first.close();
  const reloaded=server.client();expect(reloaded.pending[0]?.id).toBe('OP-mark');await reloaded.retry();
  expect(reloaded.pending).toEqual([]);expect(server.document().operations).toHaveLength(2);expect(reloaded.receipts.get('OP-mark')?.actorId).toBe('MEM-001');reloaded.close();
});
it('classifies a stale creative epoch as a retained rejection, allowing the author to discard it and continue',async()=>{
  const server=setup(),client=server.client();await client.enqueue({version:1,kind:'operate',operation:create});
  expect(await client.enqueue({version:1,kind:'operate',operation:stroke('OP-stale',99)})).toBe(false);
  expect(client.pending[0]?.status).toBe('rejected');
  expect(await client.enqueue({version:1,kind:'operate',operation:stroke('OP-next')})).toBe(false);
  expect(client.pending.map(row=>row.status)).toEqual(['rejected','queued']);
  await client.discardRejected('OP-stale');expect(client.pending).toEqual([]);
  expect(server.document().operations.map(e=>e.operation.id)).toEqual(['OP-create','OP-next']);client.close();
});
it('partitions retained work by identity and refuses network admission without a durable local request',async()=>{
  const server=setup(),client=server.client();await client.enqueue({version:1,kind:'operate',operation:create});server.lose();await client.enqueue({version:1,kind:'operate',operation:stroke('OP-private-draft')});
  const other=server.client('another-account');expect(other.pending).toEqual([]);
  const before=server.calls();server.retained.setItem=()=>{throw Error('quota');};
  await expect(other.enqueue({version:1,kind:'operate',operation:stroke('OP-no-storage')})).rejects.toThrow('cannot safely retain');expect(server.calls()).toBe(before);client.close();other.close();
});
it('requires an exact receipt and accepted operation before removing a private request',async()=>{
  const retained=storage(),document=createKittyDesignDocument('DESIGN-client',scope);
  const client=new HearthsideDesignClient({...scope,memberId:'MEM-001',identity:'test',storage:retained,token:async()=> 'synthetic',fetch:async()=>Response.json({version:1,document,receipt:null})});
  expect(await client.enqueue({version:1,kind:'operate',operation:create})).toBe(false);expect(client.pending[0]?.status).toBe('uncertain');client.close();
});

it('retains Personal audience on standalone create and accepts only an owner-bound document',async()=>{
  const retained=storage(),document=createKittyDesignDocument('DESIGN-personal-free',{...scope,ownerMemberId:'MEM-001'});let sent:unknown;
  const client=new HearthsideDesignClient({...scope,memberId:'MEM-001',identity:'personal-create',storage:retained,token:async()=> 'synthetic',fetch:async(_url,init)=>{sent=JSON.parse(init!.body as string);return Response.json({version:1,document,receipt:null,sequence:1});}});
  expect(await client.enqueue({version:1,kind:'create',designId:document.id,bankId:null,audience:'personal'})).toBe(true);
  expect(sent).toMatchObject({version:1,kind:'create',designId:document.id,bankId:null,audience:'personal'});
  expect(client.documents.get(document.id)?.scope.ownerMemberId).toBe('MEM-001');client.close();
});

it('resumes an accepted delta from the retained revision without reloading the whole history',async()=>{
  const server=setup(),a=server.client(),b=server.client('same-member-second-device');
  await a.enqueue({version:1,kind:'operate',operation:create});await b.load('DESIGN-client');
  await a.enqueue({version:1,kind:'operate',operation:stroke('OP-a')});await b.enqueue({version:1,kind:'operate',operation:stroke('OP-b')});
  expect(b.documents.get('DESIGN-client')?.revision).toBe(3);
  await a.load('DESIGN-client',3);expect(a.documents.get('DESIGN-client')).toEqual(b.documents.get('DESIGN-client'));
  expect(Object.isFrozen(a.documents.get('DESIGN-client'))).toBe(true);a.close();b.close();
});

it('reviews a rejected mark on the current piece, preserves its original mapping and atomically retains the replacement across lost acknowledgement',async()=>{
 const server=setup(),a=server.client(),b=server.client('second-device');
 await a.enqueue({version:1,kind:'operate',operation:create});await b.load('DESIGN-client');
 await b.enqueue({version:1,kind:'operate',operation:stroke('OP-other-device')});
 expect(await a.enqueue({version:1,kind:'operate',operation:stroke('OP-stale-review',99)})).toBe(false);
 const review=await a.reviewRejected('OP-stale-review');expect(review.baseRevision).toBe(2);
 expect(review.current.paint.strokes).toHaveLength(1);expect(review.proposed.paint.strokes).toHaveLength(2);
 expect(review.operation).toMatchObject({kind:'append-stroke',expectedEditEpoch:0,surfaceRevision:0});
 const original=JSON.stringify(a.pending);server.retained.setItem=()=>{throw Error('quota');};
 await expect(a.reapplyRejected('OP-stale-review',review)).rejects.toThrow('cannot safely retain');expect(JSON.stringify(a.pending)).toBe(original);
 a.close();b.close();
 const second=setup(),c=second.client();await c.enqueue({version:1,kind:'operate',operation:create});await c.enqueue({version:1,kind:'operate',operation:stroke('OP-rejected',99)});
 const next=await c.reviewRejected('OP-rejected');second.lose();expect(await c.reapplyRejected('OP-rejected',next)).toBe(false);
 expect(c.pending[0]?.id).toBe(next.operation.id);expect(c.pending[0]?.status).toBe('uncertain');c.close();
 const d=second.client();await d.retry();expect(d.pending).toEqual([]);expect(second.document().operations).toHaveLength(2);expect(second.document().operations[1]?.operation.id).toBe(next.operation.id);d.close();
});

it('retains unfinished keyboard paint by exact scope, preserving first-point style and removing only the line moved to the durable queue',()=>{
 const saved=storage(),scope={identity:'one',environment:'development',householdId:'HH-keyboard',memberId:'MEM-001',designId:'DESIGN-line',pieceId:'PIECE-line'},store=new KeyboardStrokeDraftStore(saved,scope);
 const operation=stroke('OP-draft');if(operation.kind!=='append-stroke')throw Error('fixture');
 const draft={stroke:operation.stroke,expectedEditEpoch:3,surfaceRevision:2};store.save(draft);
 expect(new KeyboardStrokeDraftStore(saved,scope).read()).toEqual(draft);
 for(const override of [{identity:'two'},{memberId:'MEM-002'},{environment:'production'},{householdId:'HH-other'},{pieceId:'PIECE-other'}])expect(new KeyboardStrokeDraftStore(saved,{...scope,...override}).read()).toBeNull();
 const longer={...draft,stroke:{...draft.stroke,pts:[...draft.stroke.pts,.4,.4]}};store.save(longer);store.clearIf(draft);expect(store.read()).toEqual(longer);
 store.clearIf(longer);expect(store.read()).toBeNull();
 store.save(draft);saved.setItem=()=>{throw Error('quota');};expect(()=>store.save(longer)).toThrow('quota');expect(store.read()).toEqual(draft);
});
