import {expect,it} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {catalogHousehold} from '../src/core/index.ts';
import {keepWinAsMemory,type Win} from '../src/core/chapters.ts';
import {assembleHousehold} from '../src/core/sync.ts';
import {capturedIntent} from '../src/ledgerSync/capture.ts';
import {commandFromCapture,type Replica} from '../src/ledgerSync/protocol.ts';
import {intentDigest} from '../src/ledgerSync/authority.ts';
import {MessageReader,encodeMessage} from '../src/ledgerSync/wire.ts';
import {commitHearthside} from '../src/hearthside/commands.ts';
import {winAdoptionOperation} from '../src/hearthside/winMemory.ts';
it('accepts one Win memory in actual SQLite/R2, denies retired writes and replays an already accepted legacy receipt',async()=>{
 const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {LedgerRoom} from './workers/ledgerRoom.ts';import {handleLedgerSync} from './workers/ledgerSync.ts';
 export class TestRoom extends LedgerRoom {constructor(ctx,env){super(ctx,env);this.testStorage=ctx.storage;}seedReceipt(row){this.testStorage.sql.exec('INSERT INTO receipts(id,actor,digest,sequence,data) VALUES(?,?,?,?,?)',row.id,row.actor,row.digest,row.sequence,JSON.stringify(row));}}
 export default {async fetch(request,env){if(new URL(request.url).pathname==='/seed-receipt'){await env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-win-memory')).seedReceipt(await request.json());return Response.json({ok:true});}return handleLedgerSync(request,env);}};
 `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER_ROOMS:{className:'TestRoom',useSQLite:true}},r2Buckets:['LEDGER_ARCHIVE'],bindings:{LEDGER_SYNC_LOCAL_AUTH:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));let socket:WebSocket|undefined;
 try{
  const base=(await mf.ready).toString().replace(/\/$/,''),path='/ledger-sync/v2/development/HH-win-memory',headers={Authorization:'Bearer local:MEM-001','Content-Type':'application/json'};
  const post=(action:string,body:unknown)=>fetch(base+path+'/'+action,{method:'POST',headers,body:JSON.stringify(body)});
  const h={...catalogHousehold(),householdId:'HH-win-memory'};h.wins=[{version:1,id:'WIN-legacy',chapterId:null,level:'first',title:'A quiet first',evidenceRefs:[],shownAt:'2026-09-01T12:00:00.000Z',fadedAt:null,keptByMemberIds:['MEM-001','MEM-002'],authoredNote:'Author never recorded.',hideAmounts:false,updatedAt:'2026-09-01T12:00:00.000Z'} satisfies Win];
  expect((await post('import',h)).status).toBe(200);const snapshot=async()=>{const r=await (await fetch(base+path+'/snapshot',{headers})).json() as Replica;return{replica:r,household:assembleHousehold(r.shared,r.personal)};};
  let current=await snapshot();const stale=structuredClone(current.household);delete stale.hearthside;const legacyPreview=keepWinAsMemory(stale,{memberId:'MEM-001',winId:'WIN-legacy',at:'2026-09-12T12:00:00.000Z'}),legacy=await commandFromCapture(capturedIntent(legacyPreview.household)!,{environment:h.environment,householdId:h.householdId},crypto.randomUUID());
  const ticket=await (await post('ticket',{})).json() as {ticket:string};socket=new WebSocket(base.replace(/^http/,'ws')+path+'/socket');socket.binaryType='arraybuffer';const ws=socket,messages:Record<string,unknown>[]=[],reader=new MessageReader();let tail=Promise.resolve();
  ws.addEventListener('message',event=>{tail=tail.then(async()=>{if(typeof event.data==='string'){messages.push(JSON.parse(event.data));return;}const data=event.data as ArrayBuffer,value=await reader.accept(data);ws.send(JSON.stringify({type:'credit',bytes:data.byteLength}));if(value)messages.push(value as Record<string,unknown>);});});
  const next=async(type:string)=>{for(let i=0;i<300;i++){await tail;const at=messages.findIndex(m=>m.type===type);if(at>=0)return messages.splice(at,1)[0]!;if(type!=='error'&&messages.some(m=>m.type==='error'))throw Error(JSON.stringify(messages));await new Promise(r=>setTimeout(r,10));}throw Error(`Missing ${type}`);};
  await new Promise<void>((resolve,reject)=>{ws.addEventListener('open',()=>resolve(),{once:true});ws.addEventListener('error',reject,{once:true});});ws.send(JSON.stringify({type:'auth',ticket:ticket.ticket}));await next('authenticated');for(const frame of await encodeMessage({type:'resume',sequence:0}))ws.send(frame);await next('snapshot');await next('ready');
  const send=async(command:unknown)=>{for(const frame of await encodeMessage({type:'command',command}))ws.send(frame);};
  const operation=winAdoptionOperation(current.household,current.household.wins![0]!),id=crypto.randomUUID(),preview=commitHearthside(current.household,{version:1,id,scope:{environment:h.environment,householdId:h.householdId,memberId:'MEM-001'},operation}),command=await commandFromCapture(capturedIntent(preview.household)!,{environment:h.environment,householdId:h.householdId},id);
  await send(command);const ack=await next('ack');await send(command);expect(await next('ack')).toEqual(ack);current=await snapshot();expect(current.household.hearthside!.memories).toHaveLength(1);expect(current.household.hearthside!.memories[0]!.approvals).toEqual([]);
  await send(legacy);const denied=await next('error');expect(JSON.stringify(denied)).toContain('HEARTHSIDE_UPDATE_REQUIRED');
  const oldReceipt={id:legacy.id,actor:'MEM-001',digest:await intentDigest(legacy,'MEM-001'),sequence:current.replica.sequence,postedIds:[],warnings:[],undo:{id:legacy.id,label:'Historical accepted Win',postedIds:[]},commandKind:'keepWinAsMemory'};
  expect((await fetch(base+'/seed-receipt',{method:'POST',headers,body:JSON.stringify(oldReceipt)})).status).toBe(200);await send(legacy);expect(await next('ack')).toMatchObject({receipt:{id:legacy.id,actor:'MEM-001'}});expect((await snapshot()).household.hearthside!.memories).toHaveLength(1);
 }finally{socket?.close();await mf.dispose();}
},30000);
