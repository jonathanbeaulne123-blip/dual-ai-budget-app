import {expect,it} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {catalogHousehold,addGoal} from '../src/core/index.ts';
import {assembleHousehold} from '../src/core/sync.ts';
import {capturedIntent} from '../src/ledgerSync/capture.ts';
import {commandFromCapture,type Replica} from '../src/ledgerSync/protocol.ts';
import {MessageReader,encodeMessage} from '../src/ledgerSync/wire.ts';
import {LedgerSyncClient} from '../src/ledgerSync/client.ts';
import {commitHearthside} from '../src/hearthside/commands.ts';
import {emptyHearthside} from '../src/hearthside/contracts.ts';
import {acceptedCreatedBank,type BankScope} from '../src/hearthside/bankReceipt.ts';
import {acceptedBankLink,newBankJourney,reviewBankLink} from '../src/hearthside/bankJourney.ts';
import {bankExperience} from './fixtures/hearthside-bank.ts';
it('uses authenticated LedgerRoom receipts and covered replicas for creation/link recovery, denying another actor and an aborted reader',async()=>{
 const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`export {LedgerRoom} from './workers/ledgerRoom.ts';import {handleLedgerSync} from './workers/ledgerSync.ts';export default{fetch:(request,env)=>handleLedgerSync(request,env)};`},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true}},r2Buckets:['LEDGER_ARCHIVE'],bindings:{LEDGER_SYNC_LOCAL_AUTH:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));let socket:WebSocket|undefined;
 try{
  const base=(await mf.ready).toString().replace(/\/$/,''),path='/ledger-sync/v2/development/HH-bank-journey',headers={Authorization:'Bearer local:MEM-001','Content-Type':'application/json'},scope:BankScope={identity:'synthetic',environment:'development',householdId:'HH-bank-journey',memberId:'MEM-001'};
  const h={...catalogHousehold(),householdId:scope.householdId,hearthside:{...emptyHearthside(),experiences:[structuredClone(bankExperience)]}},post=(action:string,body:unknown)=>fetch(base+path+'/'+action,{method:'POST',headers,body:JSON.stringify(body)});
  expect((await post('import',h)).status).toBe(200);const snapshot=async()=>await(await fetch(base+path+'/snapshot',{headers})).json() as Replica;let replica=await snapshot();
  // Execute the actual read method against the actual authenticated HTTP route. The fixture
  // supplies its local replica explicitly, so a lagging replica can be proved unavailable.
  let retries=0;const reader=Object.assign(new LedgerSyncClient({scope:{...scope,subject:'local:MEM-001'},token:async()=> 'local:MEM-001',adopt:async()=>{},status:()=>{}}),{localReady:Promise.resolve(),store:{},stopped:false,options:{scope,token:async()=> 'local:MEM-001'},path:(action:string)=>base+path+'/'+action,replica,household:async(value:Replica)=>assembleHousehold(value.shared,value.personal),retryPending:()=>{retries++;}}) as LedgerSyncClient;
  const ticket=await(await post('ticket',{})).json() as {ticket:string};socket=new WebSocket(base.replace(/^http/,'ws')+path+'/socket');socket.binaryType='arraybuffer';const ws=socket,messages:Record<string,unknown>[]=[],wire=new MessageReader();let tail=Promise.resolve();
  ws.addEventListener('message',event=>{tail=tail.then(async()=>{if(typeof event.data==='string'){messages.push(JSON.parse(event.data));return;}const data=event.data as ArrayBuffer,value=await wire.accept(data);ws.send(JSON.stringify({type:'credit',bytes:data.byteLength}));if(value)messages.push(value as Record<string,unknown>);});});
  const next=async(type:string)=>{for(let i=0;i<300;i++){await tail;const at=messages.findIndex(m=>m.type===type);if(at>=0)return messages.splice(at,1)[0]!;if(messages.some(m=>m.type==='error'))throw Error(JSON.stringify(messages));await new Promise(r=>setTimeout(r,10));}throw Error(`Missing ${type}`);};
  await new Promise<void>((resolve,reject)=>{ws.addEventListener('open',()=>resolve(),{once:true});ws.addEventListener('error',reject,{once:true});});ws.send(JSON.stringify({type:'auth',ticket:ticket.ticket}));await next('authenticated');for(const frame of await encodeMessage({type:'resume',sequence:0}))ws.send(frame);await next('snapshot');await next('ready');
  const send=async(command:unknown)=>{for(const frame of await encodeMessage({type:'command',command}))ws.send(frame);};
  let current=assembleHousehold(replica.shared,replica.personal);const id=crypto.randomUUID(),preview=addGoal(current,{name:'Our slow weekend',target:'120',shared:true,ownerMemberId:null}),command=await commandFromCapture(capturedIntent(preview.household)!,scope,id);await send(command);const ack=await next('ack');
  expect(await reader.acceptedCommand(id)).toBeNull();expect(retries).toBe(1);replica=await snapshot();Object.assign(reader,{replica});const accepted=await reader.acceptedCommand(id);expect(accepted).not.toBeNull();const goal=acceptedCreatedBank(accepted!,id,scope,'household');expect(goal.id).toBe(accepted!.receipt.postedIds[0]);await send(command);expect(await next('ack')).toEqual(ack);expect((await snapshot()).shared.goals.filter(g=>g.id===goal.id)).toHaveLength(1);
  const other=Object.assign(Object.create(LedgerSyncClient.prototype),reader,{options:{scope:{...scope,memberId:'MEM-002'},token:async()=> 'local:MEM-002'}}) as LedgerSyncClient;expect(await other.acceptedCommand(id)).toBeNull();
  current=accepted!.household;const j={...newBankJourney(scope,bankExperience,`/hearthside/experiences/EXP-slow?household=${scope.householdId}&room=common&mode=present`,'hearthside-title'),bankId:goal.id,creationId:id};j.link=reviewBankLink(current,j);const linked=commitHearthside(current,{version:1,id:j.link.id,scope:{environment:scope.environment,householdId:scope.householdId,memberId:scope.memberId},operation:j.link.operation}),linkCommand=await commandFromCapture(capturedIntent(linked.household)!,scope,j.link.id);await send(linkCommand);await next('ack');Object.assign(reader,{replica:await snapshot()});const linkReceipt=await reader.acceptedCommand(j.link.id);expect(acceptedBankLink(linkReceipt!,j)).toBe(true);expect(linkReceipt!.receipt.postedIds).toEqual([]);await send(linkCommand);await next('ack');expect((await snapshot()).shared.hearthside!.experiences[0]!.references).toEqual([{kind:'bank',id:goal.id}]);
  const abort=new AbortController();abort.abort();await expect(reader.acceptedCommand(id,abort.signal)).rejects.toThrow('SCOPE_CLOSED');
 }finally{socket?.close();await mf.dispose();}
},30000);
