import {ENCOUNTER_PACKS} from '../src/hearthside/encounterPacks.ts';
import {encounterCompositionDigest} from '../src/hearthside/encounterContracts.ts';
import type {EncounterPrivateView} from '../workers/hearthsideVaultEncounters.ts';
import {expect,it} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {catalogHousehold} from '../src/core/index.ts';
import {assembleHousehold} from '../src/core/sync.ts';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
import {commitHearthside,type HearthsideOperation} from '../src/hearthside/commands.ts';
import {capturedIntent,clearCapturedIntent} from '../src/ledgerSync/capture.ts';
import {commandFromCapture,type Scope,type LedgerCommand} from '../src/ledgerSync/protocol.ts';
import {MessageReader,encodeMessage} from '../src/ledgerSync/wire.ts';

it('accepts real shared encounters with fresh Vault evidence, attributable choices, exact Keeps and receipt recovery',async()=>{
  const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
    import {LedgerRoom} from './workers/ledgerRoom.ts';export {LedgerRoom};
    import {HearthsideVault} from './workers/hearthsideVault.ts';
    import {handleLedgerSync} from './workers/ledgerSync.ts';
    import {authorizeRequest} from './workers/ledgerSyncAuth.ts';
    export class TestVault extends HearthsideVault {
      constructor(ctx,env){const room=()=>env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-encounter-authority'));
        super(ctx,{...env,HEARTHSIDE_VAULT_AUTHORITY:{
          policy:async(scope,input)=>{const current=await room().hearthsideContent(scope);const principals=current.memberIds.map(memberId=>({memberId,subject:'local:'+memberId}));const author=principals.find(p=>p.memberId===scope.memberId&&p.subject===scope.subject);if(!author)throw Error('FORBIDDEN');return {recipients:input.recipientMemberIds.map(id=>principals.find(p=>p.memberId===id)),approvers:input.kind==='shared-memory'?principals:[author]};},
          accept:(scope,ref)=>room().acceptVaultPublication(scope,ref),isReferenced:(scope,id)=>room().vaultMediaReferenced(scope,id)}});
      }
    }
    export default {async fetch(request,env){
      const action=new URL(request.url).pathname;
      if(!action.startsWith('/vault/')&&!action.startsWith('/guest-test/'))return handleLedgerSync(request,env);
      try{const {scope}=await authorizeRequest(request,env,'development','HH-encounter-authority');const vault=env.HEARTHSIDE_VAULTS.get(env.HEARTHSIDE_VAULTS.idFromName('development/HH-encounter-authority'));
        if(action.startsWith('/guest-test/')){const room=env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-encounter-authority')),v=await request.json();return Response.json(action.endsWith('/capture')?await room.captureGuestSource(scope,v):await room.validateGuestSource(scope,v.proof,v.mode));}
        if(action==='/vault/command')return Response.json(await vault.commandFor(scope,await request.json(),true,'synthetic-transient-token'));
        if(action==='/vault/upload')return Response.json(await vault.uploadFor(scope,'voice',new Uint8Array(await request.arrayBuffer()),'audio/ogg'));
        if(action==='/vault/media'){const v=await request.json();return vault.mediaFor(scope,v.id,v.publicationId,v.mode??'active');}
        return new Response('',{status:404});
      }catch(error){return Response.json({code:error.message},{status:409});}
    }};
  `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],
    durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true},HEARTHSIDE_VAULTS:{className:'TestVault',useSQLite:true}},r2Buckets:['LEDGER_ARCHIVE','HEARTHSIDE_VAULT_MEDIA'],
    bindings:{HEARTHSIDE_DESIGN_WRITES:'true',HEARTHSIDE_GUESTS_ENABLED:'true',HEARTHSIDE_GUEST_PUBLICATION:'true',LEDGER_SYNC_LOCAL_AUTH:'true',HEARTHSIDE_VAULT_PUBLICATION:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));
  const sockets:WebSocket[]=[];
  try{
    const base=(await mf.ready).toString().replace(/\/$/,''),path='/ledger-sync/v2/development/HH-encounter-authority';
    const headers=(actor='MEM-001')=>({Authorization:'Bearer local:'+actor,'Content-Type':'application/json'});
    const post=(url:string,body:unknown,actor='MEM-001')=>fetch(base+url,{method:'POST',headers:headers(actor),body:JSON.stringify(body)});
    const vault=(body:unknown,actor='MEM-001')=>post('/vault/command',body,actor);
    const h={...catalogHousehold(),householdId:'HH-encounter-authority'};
    for(const actor of ['MEM-001','MEM-002'])expect((await post(path+'/import',h,actor)).status).toBe(200);
    async function snapshot(actor='MEM-001'){
      const response=await fetch(base+path+'/snapshot',{headers:headers(actor)});expect(response.status).toBe(200);
      return await response.json() as {shared:Parameters<typeof assembleHousehold>[0];personal:Parameters<typeof assembleHousehold>[1];sequence:number};
    }
    async function connect(actor:string){
      const ticket=await (await post(path+'/ticket',{},actor)).json() as {ticket:string};
      const ws=new WebSocket(base.replace(/^http/,'ws')+path+'/socket');sockets.push(ws);ws.binaryType='arraybuffer';
      const reader=new MessageReader(),messages:Record<string,any>[]=[];let tail=Promise.resolve();
      ws.addEventListener('message',e=>{tail=tail.then(async()=>{if(typeof e.data==='string'){messages.push(JSON.parse(e.data));return;}const value=await reader.accept(e.data as ArrayBuffer);ws.send(JSON.stringify({type:'credit',bytes:(e.data as ArrayBuffer).byteLength}));if(value)messages.push(value as Record<string,unknown>);});});
      async function next(types:string[]){for(let i=0;i<400;i++){await tail;const at=messages.findIndex(m=>types.includes(m.type));if(at>=0)return messages.splice(at,1)[0]!;await new Promise(r=>setTimeout(r,10));}throw Error('Missing '+types+' '+JSON.stringify(messages));}
      const send=async(value:unknown)=>{for(const frame of await encodeMessage(value))ws.send(frame);};
      await new Promise<void>((resolve,reject)=>{ws.addEventListener('open',()=>resolve(),{once:true});ws.addEventListener('error',reject,{once:true});});
      ws.send(JSON.stringify({type:'auth',ticket:ticket.ticket}));await next(['authenticated']);await send({type:'resume',sequence:0});await next(['ready']);
      return {send,next,ws};
    }
    const one=await connect('MEM-001'),two=await connect('MEM-002');
    const scope=(actor:string):Scope=>({environment:'development',householdId:h.householdId,memberId:actor,subject:'local:'+actor,role:'owner',aclEpoch:1,expires:Date.now()+60000});
    async function command(op:HearthsideOperation,actor='MEM-001'){
      const replica=await snapshot(actor),current=assembleHousehold(replica.shared,replica.personal,{linked:true});clearCapturedIntent(current);
      const result=commitHearthside(current,{version:1,id:crypto.randomUUID(),scope:{environment:'development',householdId:h.householdId,memberId:actor},operation:op});
      return commandFromCapture(capturedIntent(result.household)!,scope(actor),crypto.randomUUID());
    }
    async function submit(c:LedgerCommand,actor='MEM-001'){
      const channel=actor==='MEM-001'?one:two;await channel.send({type:'command',command:c});return channel.next(['ack','error']);
    }
    const initial=await snapshot(),money=await financialAuditHash(assembleHousehold(initial.shared,initial.personal));
    const pack=ENCOUNTER_PACKS[0]!,id='encounter-canonical';
    const current=async()=>{const r=await snapshot();return r.shared.hearthside!.encounters!.find(e=>e.id===id)!;};
    const shared=(operation:unknown,actor='MEM-001',requestId:string=crypto.randomUUID())=>post(path+'/encounter-command',{version:1,id:requestId,operation},actor);
    async function read<T>(r:Response):Promise<T>{expect(r.status,await r.clone().text()).toBe(200);return await r.json() as T;}
    const startOp={kind:'encounter.start',id,packId:pack.id,participantMemberIds:['MEM-001','MEM-002'],experienceId:null};
    const requestId=crypto.randomUUID(),receipt=await read(await shared(startOp,'MEM-001',requestId));
    expect(await read(await shared(startOp,'MEM-001',requestId))).toEqual(receipt);
    expect((await shared({...startOp,packId:ENCOUNTER_PACKS[1]!.id},'MEM-001',requestId)).status).not.toBe(200);
    expect((await shared(startOp,'MEM-outsider')).status).not.toBe(200);
    const fake={version:1,id:'reveal-fake',encounterId:id,packId:pack.id,generation:3,digest:'a'.repeat(64)};
    expect((await shared({kind:'encounter.reveal',id,expectedRevision:1,binding:fake})).status).not.toBe(200);
    const privateAction=(action:string,actor='MEM-001',extra:object={})=>vault({operation:'encounter-private',input:{encounterId:id,action,...(action==='read'?{}:{id:crypto.randomUUID()}),...extra}},actor);
    for(const actor of ['MEM-001','MEM-002'])await read(await privateAction('save',actor,{expectedRevision:0,answer:{revision:1,text:actor==='MEM-001'?'Only my private words':'Their different private words',objectId:pack.notice.objects[0]!.id,wardrobeId:null}}));
    for(const actor of ['MEM-001','MEM-002']){const own=await read<EncounterPrivateView>(await privateAction('review',actor,{expectedRevision:1}));await read(await privateAction('reveal',actor,{expectedRevision:1,challenge:own.challenge}));}
    const view=await read<EncounterPrivateView>(await privateAction('read')),binding=view.reveal!.binding;
    const revealOp={kind:'encounter.reveal' as const,id,expectedRevision:1,binding};
    // A generic captured command cannot bypass the fresh audience-aware admission path.
    expect(await submit(await command(revealOp))).toMatchObject({type:'error',code:'HEARTHSIDE_ENCOUNTER_AUTHORITY_REQUIRED'});
    await read(await shared(revealOp));
    const choice=(actor:string)=>({memberId:actor,revision:1,colourId:pack.make.colours[0]!.id,order:pack.make.items.map(i=>i.id),words:'My shared marks',drawing:[{x:.1,y:.3},{x:.6,y:.7}],wardrobeId:null});
    expect((await shared({kind:'encounter.choose',id,expectedChoiceRevision:0,choice:choice('MEM-002')})).status).not.toBe(200);
    for(const actor of ['MEM-001','MEM-002'])await read(await shared({kind:'encounter.choose',id,expectedChoiceRevision:0,choice:choice(actor)},actor));
    const digest=await encounterCompositionDigest(await current());
    for(const actor of ['MEM-001','MEM-002'])await read(await shared({kind:'encounter.keep',id,digest},actor));
    expect((await current()).keptMemberIds).toEqual(['MEM-001','MEM-002']);
    expect(JSON.stringify((await snapshot()).shared)).not.toMatch(/Only my private words|Their different private words|choiceSubmitted|challenge|local:MEM/);
    const creationId=crypto.randomUUID(),creation={kind:'encounter.create-piece',id,digest};
    const made=await read(await shared(creation,'MEM-001',creationId));expect(await read(await shared(creation,'MEM-001',creationId))).toEqual(made);
    const outcome=(await current()).outcomes[0]!;expect(outcome).toMatchObject({kind:'design',recipeDigest:digest});
    const design=await read<{document:import('../src/hearthside/design.ts').KittyDesignDocument}>(await post(path+'/design',{version:1,kind:'read',designId:outcome.designId}));
    expect(design.document.operations.map(e=>e.operation.kind)).toEqual(['create-piece','add-stamp','add-stamp','append-stroke','append-stroke']);
    expect(new Set(design.document.operations.map(e=>e.actorId))).toEqual(new Set(['MEM-001'])); // copied marks are attributed to the accepting author
    await read(await shared(creation,'MEM-002'));expect((await current()).outcomes).toHaveLength(1);
    expect((await snapshot()).shared.hearthside!.designs).toHaveLength(1);
    // A private edit invalidates evidence even while its opaque former binding remains in shared metadata.
    await read(await privateAction('save','MEM-002',{expectedRevision:1,answer:{revision:2,text:'New private version',objectId:pack.notice.objects[1]!.id,wardrobeId:null}}));
    expect((await shared({kind:'encounter.keep',id,digest})).status).not.toBe(200);
    expect((await shared({kind:'encounter.choose',id,expectedChoiceRevision:1,choice:{...choice('MEM-001'),revision:2}})).status).not.toBe(200);
    await read(await shared({kind:'encounter.pause',id}));expect((await current()).pausedMemberIds).toEqual(['MEM-001']);
    expect((await current()).keptMemberIds).toEqual(['MEM-002']);
    await read(await shared({kind:'encounter.resume',id}));
    const final=await snapshot();expect(await financialAuditHash(assembleHousehold(final.shared,final.personal))).toBe(money);
  }finally{for(const ws of sockets)ws.close();await mf.dispose();}
},60000);
