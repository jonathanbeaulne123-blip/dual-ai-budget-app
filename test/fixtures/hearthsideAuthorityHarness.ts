import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {catalogHousehold} from '../../src/core/index.ts';
import {assembleHousehold} from '../../src/core/sync.ts';
import {commitHearthside,type HearthsideOperation} from '../../src/hearthside/commands.ts';
import {capturedIntent,clearCapturedIntent} from '../../src/ledgerSync/capture.ts';
import {commandFromCapture,type Scope,type LedgerCommand} from '../../src/ledgerSync/protocol.ts';
import {MessageReader,encodeMessage} from '../../src/ledgerSync/wire.ts';

/** Real Worker, LedgerRoom, SQLite, R2 and WebSocket admission. Only identity is synthetic. */
export async function hearthsideAuthorityHarness(householdId:string,options:{workspaceCopies?:boolean;guestCatalogue?:boolean}={}){
 const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
  export {LedgerRoom} from './workers/ledgerRoom.ts';
  import {handleLedgerSync} from './workers/ledgerSync.ts';
  import {authorizeRequest} from './workers/ledgerSyncAuth.ts';
  ${options.workspaceCopies?`import {HerculesSharedWorkspace} from './workers/workspace/shared.ts';export {HerculesSharedWorkspace};import {getAgentByName} from 'agents';`:''}
  export default {async fetch(request,env){
   ${options.workspaceCopies?`if(new URL(request.url).pathname.endsWith('/workspace-copy-test')){try{const {scope}=await authorizeRequest(request,env,'development','${householdId}'),body=await request.json(),room=env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/${householdId}')),shared=await getAgentByName(env.HERCULES_SHARED_WORKSPACES,'development/${householdId}');
    const result=body.kind==='prepare'?await shared.prepareExperience(scope,body.copy):body.kind==='accept'?await room.workspaceAcceptArtifact(scope,body.publication):body.kind==='activate'?await shared.activateExperience(scope,body.id,body.receipt):body.kind==='revoke'?await shared.revokeExperience(scope,body.id):body.kind==='withdraw'?await room.workspaceWithdrawArtifact(scope,body.publication):await shared.experienceCopiesFor(scope,body.experienceId);return Response.json(result??null);}catch(e){return Response.json({error:e.message},{status:409});}}`:''}
   ${options.guestCatalogue?`if(new URL(request.url).pathname.endsWith('/guest-source-test')){try{const {scope}=await authorizeRequest(request,env,'development','${householdId}'),body=await request.json(),room=env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/${householdId}'));return Response.json(body.kind==='capture'?await room.captureGuestSource(scope,body.input):await room.validateGuestSource(scope,body.proof,body.mode));}catch(e){return Response.json({error:e.message},{status:409});}}`:''}
   return handleLedgerSync(request,env);
  }};
 `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],alias:{path:'node:path'},format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],
  durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true},...(options.workspaceCopies?{HERCULES_SHARED_WORKSPACES:{className:'HerculesSharedWorkspace',useSQLite:true}}:{})},r2Buckets:['LEDGER_ARCHIVE','HERCULES_FILES'],bindings:{HEARTHSIDE_GUESTS_ENABLED:'true',HEARTHSIDE_GUEST_PUBLICATION:'true',HERCULES_WORKSPACE_ENABLED:'true',LEDGER_SYNC_LOCAL_AUTH:'true',HEARTHSIDE_DESIGN_WRITES:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));
 const base=(await mf.ready).toString().replace(/\/$/,''),path='/ledger-sync/v2/development/'+householdId,sockets:WebSocket[]=[];
 const headers=(actor='MEM-001')=>({Authorization:'Bearer local:'+actor,'Content-Type':'application/json'});
 const post=(suffix:string,body:unknown,actor='MEM-001')=>fetch(base+path+'/'+suffix,{method:'POST',headers:headers(actor),body:JSON.stringify(body)});
 const initial={...catalogHousehold(),householdId};
 for(const actor of ['MEM-001','MEM-002']){const r=await post('import',initial,actor);if(!r.ok)throw Error(await r.text());}
 async function snapshot(actor='MEM-001'){
  const response=await fetch(base+path+'/snapshot',{headers:headers(actor)});if(!response.ok)throw Error(await response.text());
  return await response.json() as {shared:Parameters<typeof assembleHousehold>[0];personal:Parameters<typeof assembleHousehold>[1];sequence:number};
 }
 async function connect(actor:string){
  const ticket=await (await post('ticket',{},actor)).json() as {ticket:string};
  const ws=new WebSocket(base.replace(/^http/,'ws')+path+'/socket');sockets.push(ws);ws.binaryType='arraybuffer';
  const reader=new MessageReader(),messages:Record<string,unknown>[]=[];let tail=Promise.resolve();
  ws.addEventListener('message',e=>{tail=tail.then(async()=>{
   if(typeof e.data==='string'){messages.push(JSON.parse(e.data));return;}
   const value=await reader.accept(e.data as ArrayBuffer);ws.send(JSON.stringify({type:'credit',bytes:(e.data as ArrayBuffer).byteLength}));if(value)messages.push(value as Record<string,unknown>);
  });});
  async function next(types:string[]){for(let i=0;i<400;i++){await tail;const at=messages.findIndex(m=>types.includes(String(m.type)));if(at>=0)return messages.splice(at,1)[0]!;await new Promise(r=>setTimeout(r,10));}throw Error('Missing '+types+' '+JSON.stringify(messages));}
  const send=async(value:unknown)=>{for(const frame of await encodeMessage(value))ws.send(frame);};
  await new Promise<void>((resolve,reject)=>{ws.addEventListener('open',()=>resolve(),{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.send(JSON.stringify({type:'auth',ticket:ticket.ticket}));await next(['authenticated']);await send({type:'resume',sequence:0});await next(['ready']);
  return {send,next};
 }
 const channels=new Map<string,Awaited<ReturnType<typeof connect>>>();
 async function command(operation:HearthsideOperation,actor='MEM-001'){
  const replica=await snapshot(actor),current=assembleHousehold(replica.shared,replica.personal,{linked:true});clearCapturedIntent(current);
  const result=commitHearthside(current,{version:1,id:crypto.randomUUID(),scope:{environment:'development',householdId,memberId:actor},operation});
  const scope:Scope={environment:'development',householdId,memberId:actor,subject:'local:'+actor,role:'owner',aclEpoch:1,expires:Date.now()+60000};
  return commandFromCapture(capturedIntent(result.household)!,scope,crypto.randomUUID());
 }
 async function send(command:LedgerCommand,actor='MEM-001'){
  let channel=channels.get(actor);if(!channel){channel=await connect(actor);channels.set(actor,channel);}
  await channel.send({type:'command',command});return channel.next(['ack','error']);
 }
 return {initial,post,snapshot,command,send,submit:async(operation:HearthsideOperation,actor='MEM-001')=>send(await command(operation,actor),actor),
  household:async(actor='MEM-001')=>{const r=await snapshot(actor);return assembleHousehold(r.shared,r.personal,{linked:true});},
  dispose:async()=>{for(const ws of sockets)ws.close();await mf.dispose();}};
}
