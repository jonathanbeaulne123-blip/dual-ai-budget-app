import {expect} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {assembleHousehold} from '../../src/core/sync.ts';
import {commitHearthside,type HearthsideOperation} from '../../src/hearthside/commands.ts';
import {capturedIntent,clearCapturedIntent} from '../../src/ledgerSync/capture.ts';
import {commandFromCapture,type Scope,type LedgerCommand} from '../../src/ledgerSync/protocol.ts';
import {MessageReader,encodeMessage} from '../../src/ledgerSync/wire.ts';
export const ASSEMBLY_HOUSEHOLD='HH-guest-assembly';
export const subjects={alice:'11111111-1111-4111-a111-111111111111',bob:'22222222-2222-4222-a222-222222222222'};
export type Host=keyof typeof subjects;
export const member=(actor:Host)=>actor==='alice'?'MEM-001':'MEM-002';
export async function readAssembly<T>(response:{status:number;text():Promise<string>}):Promise<T>{const text=await response.text();expect(response.status,text).toBe(200);return JSON.parse(text) as T;}
export async function createGuestAssembly(){
 const bundle=await build({entryPoints:['test/fixtures/hearthsideGuestAssemblyWorker.mjs'],bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{
  name:'app',modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],
  durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true},HEARTHSIDE_VAULTS:{className:'AssemblyVault',useSQLite:true},HEARTHSIDE_GUEST_ROOMS:{className:'HearthsideGuestRoom',useSQLite:true},HEARTHSIDE_GUEST_CARDS:{className:'HearthsideGuestCard',useSQLite:true},HEARTHSIDE_GUEST_INDEXES:{className:'HearthsideGuestIndex',useSQLite:true},CONTROL:{className:'SyntheticGuestControl',useSQLite:true}},
  r2Buckets:['LEDGER_ARCHIVE','HEARTHSIDE_VAULT_MEDIA','HEARTHSIDE_GUEST_ARCHIVE','HEARTHSIDE_GUEST_MEDIA'],serviceBindings:{HEARTHSIDE_GUEST_CONTROL_PLANE:'control'},
  bindings:{HEARTHSIDE_GUESTS_ENABLED:'true',HEARTHSIDE_GUEST_PUBLICATION:'true',LEDGER_SYNC_LOCAL_AUTH:'true',HEARTHSIDE_DESIGN_WRITES:'true',HEARTHSIDE_VAULT_PUBLICATION:'true',SUPABASE_URL:'https://synthetic.test',SUPABASE_PUBLISHABLE_KEY:'synthetic',HEARTHSIDE_GUEST_AUTHORITY_KEY:'34'.repeat(32),HEARTHSIDE_GUEST_AUTHORITY_KEY_ID:'synthetic-assembly-key'}
 },{name:'control',modules:true,script:`export default {async fetch(request,env){try{return Response.json(await env.CONTROL.get(env.CONTROL.idFromName('control')).authority(request.headers.get('Authorization').slice(7),await request.json()));}catch{return new Response('',{status:403});}}};`,compatibilityDate:'2026-08-27',durableObjects:{CONTROL:{className:'SyntheticGuestControl',scriptName:'app',useSQLite:true}}}]}));
 const base=(await mf.ready).toString().replace(/\/$/,''),sockets:WebSocket[]=[],channels=new Map<Host,Awaited<ReturnType<typeof connect>>>();
 const headers=(actor='alice')=>({Authorization:`Bearer ${actor}.synthetic.jwt`,'Content-Type':'application/json'});
 const request=(path:string,body?:unknown,actor='alice')=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:headers(actor),...(body===undefined?{}:{body:JSON.stringify(body)})});
 const local=(path:string,body?:unknown,actor='alice')=>request('/__assembly/'+path,body,actor);
 const guest=(path:string,body?:unknown,actor='alice')=>request('/api/hearthside-guests/development/'+path,body,actor);
 async function snapshot(actor:Host='alice'){return readAssembly<{shared:Parameters<typeof assembleHousehold>[0];personal:Parameters<typeof assembleHousehold>[1];sequence:number}>(await local('snapshot',undefined,actor));}
 async function connect(actor:Host){
  const ticket=await readAssembly<{ticket:string}>(await local('ticket',{},actor));
  // Browsers do not attach bearer headers on WebSocket. Ticket handles socket auth.
  // The fixture router accepts a queryless synthetic identity header via Miniflare
  // dispatchFetch; the actual LedgerRoom socket authenticates the one-use ticket.
  const response=await mf.dispatchFetch('http://localhost/__assembly/socket',{headers:{...headers(actor),Upgrade:'websocket'}});
  const socket=response.webSocket!;expect(response.status).toBe(101);socket.accept();sockets.push(socket as unknown as WebSocket);
  const reader=new MessageReader(),messages:Record<string,any>[]=[];let tail=Promise.resolve();
  socket.addEventListener('message',e=>{tail=tail.then(async()=>{if(typeof e.data==='string'){messages.push(JSON.parse(e.data));return;}const value=await reader.accept(e.data as ArrayBuffer);socket.send(JSON.stringify({type:'credit',bytes:(e.data as ArrayBuffer).byteLength}));if(value)messages.push(value as Record<string,unknown>);});});
  async function next(types:string[]){for(let i=0;i<400;i++){await tail;const at=messages.findIndex(m=>types.includes(m.type));if(at>=0)return messages.splice(at,1)[0]!;await new Promise(r=>setTimeout(r,10));}throw Error('Missing '+types+' '+JSON.stringify(messages));}
  const send=async(value:unknown)=>{for(const frame of await encodeMessage(value))socket.send(frame);};
  socket.send(JSON.stringify({type:'auth',ticket:ticket.ticket}));await next(['authenticated']);await send({type:'resume',sequence:0});await next(['ready']);return {send,next};
 }
 async function command(op:HearthsideOperation,actor:Host='alice'){
  const replica=await snapshot(actor),current=assembleHousehold(replica.shared,replica.personal,{linked:true});clearCapturedIntent(current);
  const result=commitHearthside(current,{version:1,id:crypto.randomUUID(),scope:{environment:'development',householdId:ASSEMBLY_HOUSEHOLD,memberId:member(actor)},operation:op});
  const scope:Scope={environment:'development',householdId:ASSEMBLY_HOUSEHOLD,memberId:member(actor),subject:subjects[actor],role:'member',aclEpoch:1,expires:Date.now()+60000};
  return commandFromCapture(capturedIntent(result.household)!,scope,crypto.randomUUID());
 }
 async function submit(c:LedgerCommand,actor:Host='alice'){let channel=channels.get(actor);if(!channel){channel=await connect(actor);channels.set(actor,channel);}await channel.send({type:'command',command:c});return channel.next(['ack','error']);}
 const commit=async(op:HearthsideOperation,actor:Host='alice')=>{const c=await command(op,actor),ack=await submit(c,actor);expect(ack).toMatchObject({type:'ack'});return {c,ack};};
 return {mf,base,headers,request,local,guest,snapshot,command,submit,commit,dispose:async()=>{for(const s of sockets)s.close();await mf.dispose();}};
}
