import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {chromium,type Browser} from '@playwright/test';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
let browser:Browser,worker='',proof='';
// All client/IndexedDB/socket behavior is real Chromium. Only completed WS ACK
// messages are withheld; Worker authority, event delivery and HTTP receipts are real.
const proofSource=`
import {catalogHousehold,addGoal} from './src/core/index.ts';
import {LedgerSyncClient} from './src/ledgerSync/client.ts';
import {LedgerStore} from './src/ledgerSync/localStore.ts';
import {MessageReader} from './src/ledgerSync/wire.ts';
const NativeSocket=window.WebSocket,nativeFetch=window.fetch.bind(window);
const wire={hold:true,held:[],sockets:[]};
class FilteredSocket {
 static OPEN=NativeSocket.OPEN;
 constructor(address){this.socket=new NativeSocket(address);this.socket.binaryType='arraybuffer';this.reader=new MessageReader();this.frames=[];this.tail=Promise.resolve();wire.sockets.push(this);this.socket.onopen=e=>this.onopen?.(e);this.socket.onclose=e=>this.onclose?.(e);this.socket.onerror=e=>this.onerror?.(e);this.socket.onmessage=e=>{this.tail=this.tail.then(async()=>{if(typeof e.data==='string'){this.onmessage?.(e);return;}const frame=e.data;this.frames.push(frame);const value=await this.reader.accept(frame);if(!value)return;const frames=this.frames;this.frames=[];if(value.type==='ack'&&wire.hold){wire.held.push({socket:this,frames});return;}this.deliver(frames);});};}
 get readyState(){return this.socket.readyState;}get bufferedAmount(){return this.socket.bufferedAmount;}
 send(data){this.socket.send(data);}close(){this.socket.close();}
 deliver(frames){for(const data of frames)this.onmessage?.(new MessageEvent('message',{data}));}
}
window.WebSocket=FilteredSocket;
let fault='',holdHttp=false,httpEntered=false,httpRelease=()=>{};
window.fetch=async(input,init)=>{const response=await nativeFetch(input,init);if(String(input).includes('/receipt?')&&response.ok){const body=await response.json(),r=body.receipt;
 if(fault==='actor')r.actor='MEM-002';if(fault==='id')r.id=crypto.randomUUID();if(fault==='negative')r.sequence=-1;if(fault==='fraction')r.sequence=.5;if(fault==='stale')r.sequence=0;if(fault==='ahead')r.sequence=Number.MAX_SAFE_INTEGER;if(fault==='digest')r.digest='0'.repeat(64);if(fault==='undo-actor')r.undo.actorMemberId='MEM-002';if(fault==='undo-id')r.undo.id=crypto.randomUUID();
 if(holdHttp){httpEntered=true;await new Promise(resolve=>{httpRelease=resolve;});}return Response.json(body,{status:response.status});}return response;};
const scope={environment:'development',householdId:'HH-bank-ack',memberId:'MEM-001',subject:'local:MEM-001'};
const response=await nativeFetch('/ledger-sync/v2/development/HH-bank-ack/import',{method:'POST',headers:{Authorization:'Bearer local:MEM-001','Content-Type':'application/json'},body:JSON.stringify({...catalogHousehold(),householdId:scope.householdId})});if(!response.ok)throw Error(await response.text());
let adopted,resolutions=0,rejections=0,busy=false;const statuses=[],pendingCounts=[],promises=new Map(),candidates=new Map();
const client=new LedgerSyncClient({scope,token:async()=> 'local:MEM-001',adopt:async value=>{adopted=value;},status:value=>statuses.push(value),pendingChanged:rows=>pendingCounts.push(rows.length)});await client.start();const store=await LedgerStore.open(scope);
let lastRead,abort;
window.ackProof={
 create(name='Our quiet weekend'){const id=crypto.randomUUID(),candidate=addGoal(adopted,{name,target:'120',shared:true}).household;candidates.set(id,candidate);busy=true;const promise=client.confirm(candidate,id).then(value=>{resolutions++;return value;},error=>{rejections++;throw error;}).finally(()=>{busy=false;});void promise.catch(()=>{});promises.set(id,promise);return id;},
 stats(){return {resolutions,rejections,busy,held:wire.held.length,statuses,pendingCounts,goals:adopted.goals.map(g=>({id:g.id,name:g.name})),httpEntered};},
 pending:async()=> (await store.load()).pending.map(p=>p.id),
 async read(id){const value=await client.acceptedCommand(id);return value?{id:value.receipt.id,postedIds:value.receipt.postedIds,sequence:value.receipt.sequence}:null;},
 async readHousehold(id){const value=await client.acceptedHousehold(id);return value?{householdId:value.householdId,goals:value.goals.map(g=>g.id)}:null;},
 setFault(value){fault=value;},
 releaseAcks(){wire.hold=false;for(const row of wire.held.splice(0))row.socket.deliver(row.frames);},
 async result(id){const result=await promises.get(id);return {postedIds:result.postedIds};},
 async replay(id){const result=await client.confirm(candidates.get(id),id);return {postedIds:result.postedIds};},
 startHeldRead(id){holdHttp=true;httpEntered=false;abort=new AbortController();lastRead=client.acceptedCommand(id,abort.signal);void lastRead.catch(()=>{});},
 finishHeldRead(){holdHttp=false;httpRelease();return lastRead.then(()=>null,error=>error.message);},
 abortRead(){abort.abort();},
 async destroy(){await client.destroy();},
 async close(){await client.destroy();store.close();for(const socket of wire.sockets)socket.close();}
};
`;
type Proof={create(name?:string):string;stats():{resolutions:number;rejections:number;busy:boolean;held:number;statuses:string[];pendingCounts:number[];goals:{id:string;name:string}[];httpEntered:boolean};pending():Promise<string[]>;read(id:string):Promise<{id:string;postedIds:string[];sequence:number}|null>;readHousehold(id:string):Promise<{householdId:string;goals:string[]}|null>;setFault(value:string):void;releaseAcks():void;result(id:string):Promise<{postedIds:string[]}>;replay(id:string):Promise<{postedIds:string[]}>;startHeldRead(id:string):void;finishHeldRead():Promise<string|null>;abortRead():void;destroy():Promise<void>;close():Promise<void>};
declare global{interface Window{ackProof:Proof}}
beforeAll(async()=>{
 const bundles=await Promise.all([
  build({stdin:{resolveDir:process.cwd(),contents:`export {LedgerRoom} from './workers/ledgerRoom.ts';import {handleLedgerSync} from './workers/ledgerSync.ts';export default {fetch(request,env){const path=new URL(request.url).pathname;if(path==='/')return new Response('<!doctype html><script type="module" src="/proof.js"></script>',{headers:{'Content-Type':'text/html'}});if(path==='/proof.js')return new Response(env.PROOF,{headers:{'Content-Type':'text/javascript'}});return handleLedgerSync(request,env);}};`},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'}),
  build({stdin:{resolveDir:process.cwd(),contents:proofSource},bundle:true,write:false,platform:'browser',external:['node:*'],format:'esm',target:'es2022'}),
 ]);worker=bundles[0]!.outputFiles[0]!.text;proof=bundles[1]!.outputFiles[0]!.text;browser=await chromium.launch({headless:true});
},30_000);
afterAll(async()=>{await browser?.close();});
async function fixture(){
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:worker,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true}},r2Buckets:['LEDGER_ARCHIVE'],bindings:{PROOF:proof,LEDGER_SYNC_LOCAL_AUTH:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));
 const page=await browser.newPage();
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 try {
  await page.goto((await mf.ready).toString());
  await page.waitForFunction(()=>Boolean(window.ackProof));
  expect(errors).toEqual([]);
  return {page,async dispose(){
   try {await page.evaluate(()=>window.ackProof.close());}
   finally {await page.close();await mf.dispose();}
  }};
 } catch(error) {await page.close();await mf.dispose();throw error;}
}
describe('actual pending bank confirmation recovered through authenticated HTTP receipt',()=>{
 it('releases the original promise and busy state exactly once when HTTP recovery races a late WS ACK',async()=>{
  const f=await fixture();try{
   const id=await f.page.evaluate(()=>window.ackProof.create());await f.page.waitForFunction(()=>window.ackProof.stats().held===1);
   const before=await f.page.evaluate(()=>window.ackProof.stats());expect(before.busy).toBe(true);expect(before.resolutions).toBe(0);expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([id]);
   const [one,two]=await f.page.evaluate(async id=>Promise.all([window.ackProof.read(id),window.ackProof.read(id)]),id);expect(one?.id).toBe(id);expect(two).toEqual(one);
   expect((await f.page.evaluate(()=>window.ackProof.stats())).busy).toBe(false);
   const after=await f.page.evaluate(()=>window.ackProof.stats());expect(after.resolutions).toBe(1);expect(after.rejections).toBe(0);expect(after.statuses.slice(before.statuses.length)).toEqual(['ready']);expect(after.pendingCounts.slice(before.pendingCounts.length)).toEqual([0]);expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([]);
   const accepted=await f.page.evaluate(id=>window.ackProof.result(id),id);expect(accepted.postedIds).toEqual(one!.postedIds);expect(after.goals.filter(g=>g.id===accepted.postedIds[0])).toHaveLength(1);
   await f.page.evaluate(()=>window.ackProof.releaseAcks());await f.page.waitForTimeout(50);
   expect((await f.page.evaluate(()=>window.ackProof.stats())).resolutions).toBe(1);expect((await f.page.evaluate(()=>window.ackProof.stats())).statuses).toEqual(after.statuses);
   expect(await f.page.evaluate(id=>window.ackProof.replay(id),id)).toEqual(accepted);
   const next=await f.page.evaluate(()=>window.ackProof.create('The next bank'));const result=await f.page.evaluate(id=>window.ackProof.result(id),next);expect(result.postedIds[0]).not.toBe(accepted.postedIds[0]);expect((await f.page.evaluate(()=>window.ackProof.stats())).resolutions).toBe(2);expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([]);
  }finally{await f.dispose();}
 },30_000);
 it('settles the original confirmation through the household-only reader used by native funding recovery',async()=>{
  const f=await fixture();try{
   const id=await f.page.evaluate(()=>window.ackProof.create());await f.page.waitForFunction(()=>window.ackProof.stats().held===1);
   expect((await f.page.evaluate(()=>window.ackProof.stats())).busy).toBe(true);
   const value=await f.page.evaluate(id=>window.ackProof.readHousehold(id),id);
   const accepted=await f.page.evaluate(id=>window.ackProof.result(id),id);
   expect(value?.householdId).toBe('HH-bank-ack');expect(value?.goals).toContain(accepted.postedIds[0]);
   expect((await f.page.evaluate(()=>window.ackProof.stats())).busy).toBe(false);expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([]);
   await f.page.evaluate(()=>window.ackProof.releaseAcks());await f.page.waitForTimeout(50);
   expect((await f.page.evaluate(()=>window.ackProof.stats())).resolutions).toBe(1);
  }finally{await f.dispose();}
 },30_000);
 it('treats an HTTP receipt as a read after the real WS ACK has already settled the same submission',async()=>{
  const f=await fixture();try{
   const id=await f.page.evaluate(()=>window.ackProof.create());
   await f.page.waitForFunction(()=>window.ackProof.stats().held===1);
   await f.page.evaluate(id=>window.ackProof.startHeldRead(id),id);
   await f.page.waitForFunction(()=>window.ackProof.stats().httpEntered);
   await f.page.evaluate(()=>window.ackProof.releaseAcks());
   const accepted=await f.page.evaluate(id=>window.ackProof.result(id),id);
   const settled=await f.page.evaluate(()=>window.ackProof.stats());
   expect(settled.resolutions).toBe(1);expect(settled.busy).toBe(false);
   expect(await f.page.evaluate(()=>window.ackProof.finishHeldRead())).toBeNull();
   const after=await f.page.evaluate(()=>window.ackProof.stats());
   expect(after.resolutions).toBe(1);expect(after.statuses).toEqual(settled.statuses);
   expect(after.pendingCounts).toEqual(settled.pendingCounts);
   expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([]);
   expect(await f.page.evaluate(id=>window.ackProof.replay(id),id)).toEqual(accepted);
  }finally{await f.dispose();}
 },30_000);
 it('does not settle another actor/id, an invalid or uncovered sequence, altered digest or unvalidated undo',async()=>{
  const f=await fixture();try{
   const id=await f.page.evaluate(()=>window.ackProof.create());await f.page.waitForFunction(()=>window.ackProof.stats().held===1);
   for(const fault of ['actor','id','negative','fraction','stale','digest','undo-actor','undo-id']){
    await f.page.evaluate(fault=>window.ackProof.setFault(fault),fault);await expect(f.page.evaluate(id=>window.ackProof.read(id),id)).rejects.toThrow('RECEIPT_RECOVERY_REQUIRED');expect((await f.page.evaluate(()=>window.ackProof.stats())).resolutions).toBe(0);expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([id]);
   }
   await f.page.evaluate(()=>window.ackProof.setFault('ahead'));expect(await f.page.evaluate(id=>window.ackProof.read(id),id)).toBeNull();expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([id]);
   await f.page.evaluate(()=>window.ackProof.setFault(''));await f.page.waitForFunction(()=>window.ackProof.stats().statuses.at(-1)==='saving');expect((await f.page.evaluate(id=>window.ackProof.read(id),id))?.id).toBe(id);await f.page.waitForFunction(()=>window.ackProof.stats().resolutions===1);expect((await f.page.evaluate(()=>window.ackProof.stats())).busy).toBe(false);
  }finally{await f.dispose();}
 },30_000);
 it('keeps durable pending identity and rejects delivery if the account scope closes during the HTTP read',async()=>{
  const f=await fixture();try{
   const id=await f.page.evaluate(()=>window.ackProof.create());await f.page.waitForFunction(()=>window.ackProof.stats().held===1);await f.page.evaluate(id=>window.ackProof.startHeldRead(id),id);await f.page.waitForFunction(()=>window.ackProof.stats().httpEntered);
   await f.page.evaluate(()=>window.ackProof.destroy());expect(await f.page.evaluate(()=>window.ackProof.finishHeldRead())).toBe('SCOPE_CLOSED');await expect(f.page.evaluate(id=>window.ackProof.result(id),id)).rejects.toThrow('SCOPE_CLOSED');const stats=await f.page.evaluate(()=>window.ackProof.stats());expect(stats.resolutions).toBe(0);expect(stats.rejections).toBe(1);expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([id]);
  }finally{await f.dispose();}
 },30_000);
 it('lets an aborted reader retain the original queue and then recover with a new deliberate read',async()=>{
  const f=await fixture();try{
   const id=await f.page.evaluate(()=>window.ackProof.create());await f.page.waitForFunction(()=>window.ackProof.stats().held===1);await f.page.evaluate(id=>window.ackProof.startHeldRead(id),id);await f.page.waitForFunction(()=>window.ackProof.stats().httpEntered);
   await f.page.evaluate(()=>window.ackProof.abortRead());expect(await f.page.evaluate(()=>window.ackProof.finishHeldRead())).toBe('SCOPE_CLOSED');expect((await f.page.evaluate(()=>window.ackProof.stats())).resolutions).toBe(0);expect(await f.page.evaluate(()=>window.ackProof.pending())).toEqual([id]);
   await f.page.evaluate(id=>window.ackProof.read(id),id);await f.page.waitForFunction(()=>window.ackProof.stats().resolutions===1);expect((await f.page.evaluate(()=>window.ackProof.stats())).busy).toBe(false);
  }finally{await f.dispose();}
 },30_000);
});
