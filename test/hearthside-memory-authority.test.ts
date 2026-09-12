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
import type {MemoryComposition,HearthsideContentSnapshot} from '../src/hearthside/contracts.ts';
import {memoryCompositionDigest,type VaultMemoryAuthorReview} from '../src/hearthside/memoryPublication.ts';
import type {GuestSourceCapture} from '../src/hearthside/guestContracts.ts';
import {memoryReviewAlreadyAccepted} from '../src/hearthside/MemoryPublicationEntry.tsx';

it('accepts exact paired media memories through actual LedgerRoom and Vault, with isolated metadata and receipt recovery',async()=>{
  const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
    import {LedgerRoom} from './workers/ledgerRoom.ts';export {LedgerRoom};
    import {HearthsideVault} from './workers/hearthsideVault.ts';
    import {handleLedgerSync} from './workers/ledgerSync.ts';
    import {authorizeRequest} from './workers/ledgerSyncAuth.ts';
    export class TestVault extends HearthsideVault {
      constructor(ctx,env){const room=()=>env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-memory-authority'));
        super(ctx,{...env,HEARTHSIDE_VAULT_AUTHORITY:{
          policy:async(scope,input)=>{const current=await room().hearthsideContent(scope);const principals=current.memberIds.map(memberId=>({memberId,subject:'local:'+memberId}));const author=principals.find(p=>p.memberId===scope.memberId&&p.subject===scope.subject);if(!author)throw Error('FORBIDDEN');return {recipients:input.recipientMemberIds.map(id=>principals.find(p=>p.memberId===id)),approvers:input.kind==='shared-memory'?principals:[author]};},
          accept:(scope,ref)=>room().acceptVaultPublication(scope,ref),isReferenced:(scope,id)=>room().vaultMediaReferenced(scope,id)}});
      }
    }
    export default {async fetch(request,env){
      const action=new URL(request.url).pathname;
      if(!action.startsWith('/vault/')&&!action.startsWith('/guest-test/'))return handleLedgerSync(request,env);
      try{const {scope}=await authorizeRequest(request,env,'development','HH-memory-authority');const vault=env.HEARTHSIDE_VAULTS.get(env.HEARTHSIDE_VAULTS.idFromName('development/HH-memory-authority'));
        if(action.startsWith('/guest-test/')){const room=env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-memory-authority')),v=await request.json();return Response.json(action.endsWith('/capture')?await room.captureGuestSource(scope,v):await room.validateGuestSource(scope,v.proof,v.mode));}
        if(action==='/vault/command')return Response.json(await vault.commandFor(scope,await request.json(),true,'synthetic-transient-token'));
        if(action==='/vault/upload')return Response.json(await vault.uploadFor(scope,'voice',new Uint8Array(await request.arrayBuffer()),'audio/ogg'));
        if(action==='/vault/media'){const v=await request.json();return vault.mediaFor(scope,v.id,v.publicationId,v.mode??'active');}
        return new Response('',{status:404});
      }catch(error){return Response.json({code:error.message},{status:409});}
    }};
  `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],format:'esm',target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],
    durableObjects:{LEDGER_ROOMS:{className:'LedgerRoom',useSQLite:true},HEARTHSIDE_VAULTS:{className:'TestVault',useSQLite:true}},r2Buckets:['LEDGER_ARCHIVE','HEARTHSIDE_VAULT_MEDIA'],
    bindings:{HEARTHSIDE_GUESTS_ENABLED:'true',HEARTHSIDE_GUEST_PUBLICATION:'true',LEDGER_SYNC_LOCAL_AUTH:'true',HEARTHSIDE_VAULT_PUBLICATION:'true',SUPABASE_URL:'http://127.0.0.1:1',SUPABASE_PUBLISHABLE_KEY:'synthetic'}}));
  const sockets:WebSocket[]=[];
  try{
    const base=(await mf.ready).toString().replace(/\/$/,''),path='/ledger-sync/v2/development/HH-memory-authority';
    const headers=(actor='MEM-001')=>({Authorization:'Bearer local:'+actor,'Content-Type':'application/json'});
    const post=(url:string,body:unknown,actor='MEM-001')=>fetch(base+url,{method:'POST',headers:headers(actor),body:JSON.stringify(body)});
    const vault=(body:unknown,actor='MEM-001')=>post('/vault/command',body,actor);
    const h={...catalogHousehold(),householdId:'HH-memory-authority'};
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
    const voice=new TextEncoder().encode('OggSexplicitly-chosen-synthetic-voice');
    const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',voice))].map(n=>n.toString(16).padStart(2,'0')).join('');
    expect((await vault({operation:'prepare-media',input:{id:'voice',sha256,byteLength:voice.length,contentType:'audio/ogg'}})).status).toBe(200);
    expect((await fetch(base+'/vault/upload',{method:'POST',headers:headers(),body:voice})).status).toBe(200);
    const candidate:MemoryComposition={version:1,id:'MEMORY-ordinary',revision:1,title:'An ordinary evening',date:null,experienceId:null,media:[{version:1,contentId:'voice',revision:1,kind:'audio',alt:'Our little tune'}],designs:[],recollections:[{memberId:'MEM-001',text:'We found a song for the kitchen.'}],hideAmounts:true,approvals:[],withdrawn:false};
    const prepare=await vault({operation:'prepare-memory',input:{id:'memory-publication',candidate,expectedRevision:0,recipientMemberIds:['MEM-001','MEM-002']}});
    expect(prepare.status,await prepare.clone().text()).toBe(200);const review=await prepare.json() as VaultMemoryAuthorReview;
    const bound={...candidate,publication:review.binding};
    const fake={...bound,publication:{...review.binding,publicationId:'fabricated'}};
    expect(await submit(await command({kind:'memory.compose',expectedRevision:0,value:fake}))).toMatchObject({type:'error',definitive:true});
    const compose=await command({kind:'memory.compose',expectedRevision:0,value:bound});
    const accepted=await submit(compose);expect(accepted).toMatchObject({type:'ack'});
    expect(await submit(compose)).toEqual(accepted); // lost acknowledgement uses the same receipt
    const guestInput={publicationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'A chosen evening',welcome:'Come in.',theme:'classic',room:'theatre',mode:'anytime',items:[{kind:'memory',id:bound.id,revision:1,x:.4,y:.5}]};
    const guest=(value=guestInput)=>post('/guest-test/capture',value);
    const guestValid=(copy:GuestSourceCapture,mode='visit')=>post('/guest-test/validate',{proof:copy.proof,mode});
    expect((await guest()).status).not.toBe(200); // unkept media cannot be guest material
    const media=(mode='active',actor='MEM-002')=>post('/vault/media',{id:'voice',publicationId:review.id,mode},actor);
    expect((await media()).status).not.toBe(200);expect((await media('review')).status).toBe(200);
    expect(await submit(await command({kind:'memory.keep',id:bound.id,expectedRevision:1},'MEM-002'),'MEM-002')).toMatchObject({type:'error',definitive:true});
    for(const actor of ['MEM-001','MEM-002']){
      expect((await vault({operation:'approve',id:review.id,digest:review.digest},actor)).status).toBe(200);
      const keep=await command({kind:'memory.keep',id:bound.id,expectedRevision:1},actor),receipt=await submit(keep,actor);expect(receipt).toMatchObject({type:'ack'});expect(await submit(keep,actor)).toEqual(receipt);
    }
    expect((await media()).status).not.toBe(200);
    expect((await vault({operation:'activate',id:review.id})).status).toBe(200);
    expect((await vault({operation:'activate',id:review.id})).status).toBe(200);
    expect(new Uint8Array(await (await media()).arrayBuffer())).toEqual(voice);
    const guestResponse=await guest();expect(guestResponse.status,await guestResponse.clone().text()).toBe(200);
    const guestCopy=await guestResponse.json() as GuestSourceCapture;
    expect(guestCopy.arrangement.objects[0]).toMatchObject({kind:'memory',title:bound.title,media:[{id:'media-1',kind:'audio',sha256}]});
    expect(JSON.stringify(guestCopy.arrangement)).not.toMatch(/MEM-001|MEM-002|memory-publication|MEMORY-ordinary|householdId|target|balance|publicationId|providerToken/);
    expect(await (await guestValid(guestCopy,'activation')).json()).toBe(true);expect(await (await guestValid(guestCopy)).json()).toBe(true);
    expect((await guest({...guestInput,items:[{...guestInput.items[0]!,id:'private-letter'}]})).status).not.toBe(200);
    const words={...candidate,id:'MEMORY-words',media:[],title:'There was no photo'};
    expect(await submit(await command({kind:'memory.compose',expectedRevision:0,value:words}))).toMatchObject({type:'ack'});
    for(const actor of ['MEM-001','MEM-002'])expect(await submit(await command({kind:'memory.keep',id:words.id,expectedRevision:1},actor),actor)).toMatchObject({type:'ack'});
    const wordsResponse=await guest({...guestInput,items:[{...guestInput.items[0]!,id:words.id}]});expect(wordsResponse.status).toBe(200);
    const wordsCopy=await wordsResponse.json() as GuestSourceCapture;expect(wordsCopy.proof.memoryBindings).toEqual([{id:words.id,revision:1,publicationId:null}]);
    expect(await submit(await command({kind:'memory.withdraw',id:words.id,expectedRevision:1}))).toMatchObject({type:'ack'});
    expect(await (await guestValid(wordsCopy)).json()).toBe(false);

    const published=await fetch(base+path+'/hearthside-content',{headers:headers('MEM-002')});expect(published.status).toBe(200);
    const content=await published.json() as HearthsideContentSnapshot;expect(Object.keys(content).sort()).toEqual(['environment','householdId','memberIds','sequence','state','version']);
    expect(content.state.memories[0]!.approvals).toHaveLength(2);expect(JSON.stringify(content)).not.toMatch(/local:|synthetic-transient|transactions|accounts|OggS|recipientMemberIds|private-draft/);
    expect(await submit(await command({kind:'memory.withdraw',id:bound.id,expectedRevision:1}))).toMatchObject({type:'error',code:'HEARTHSIDE_REVOKE_ACCESS_FIRST'});
    const changed={...bound,revision:2,title:'Our evening song',approvals:[]};
    const prepareChanged=await vault({operation:'prepare-memory',input:{id:'memory-revision-two',candidate:changed,expectedRevision:1,recipientMemberIds:['MEM-001','MEM-002'],sourcePublicationId:review.id}});
    expect(prepareChanged.status,await prepareChanged.clone().text()).toBe(200);const revised=await prepareChanged.json() as VaultMemoryAuthorReview;
    expect(await submit(await command({kind:'memory.compose',expectedRevision:1,value:{...changed,publication:revised.binding}}))).toMatchObject({type:'ack'});
    expect(await (await guestValid(guestCopy)).json()).toBe(false);
    expect((await media()).status).not.toBe(200); // old retained bytes cannot revive a changed composition
    for(const actor of ['MEM-001','MEM-002']){
      expect((await vault({operation:'approve',id:revised.id,digest:revised.digest},actor)).status).toBe(200);
      expect(await submit(await command({kind:'memory.keep',id:bound.id,expectedRevision:2},actor),actor)).toMatchObject({type:'ack'});
    }
    expect((await vault({operation:'activate',id:revised.id})).status).toBe(200);
    expect(await (await guestValid(guestCopy)).json()).toBe(false); // newly active replacement does not reopen the original guest copy
    const freshResponse=await guest({...guestInput,items:[{...guestInput.items[0]!,revision:2}]});expect(freshResponse.status).toBe(200);const freshCopy=await freshResponse.json() as GuestSourceCapture;
    expect(await (await guestValid(freshCopy)).json()).toBe(true);
    expect((await vault({operation:'withdraw',id:revised.id})).status).toBe(200);
    expect(await (await guestValid(freshCopy)).json()).toBe(false); // deny immediately, even before canonical withdrawal

    expect(await submit(await command({kind:'memory.withdraw',id:bound.id,expectedRevision:2}))).toMatchObject({type:'ack'});
    const final=await snapshot();expect(await financialAuditHash(assembleHousehold(final.shared,final.personal))).toBe(money);
    expect(final.shared.hearthside!.memories.find(m=>m.id===bound.id)).toMatchObject({withdrawn:true,revision:3,approvals:[]});
    expect((await fetch(base+path+'/hearthside-content',{headers:headers('MEM-outsider')})).status).toBe(403);
  }finally{for(const ws of sockets)ws.close();await mf.dispose();}
},60_000);

it('recognizes accepted review retries only for the exact binding and current composition',async()=>{
  const value:MemoryComposition={version:1,id:'MEMORY-one',revision:1,title:'The quiet hour',date:null,experienceId:null,media:[],designs:[],recollections:[],hideAmounts:true,approvals:[{memberId:'MEM-001',revision:1}],withdrawn:false};
  const binding={version:1 as const,publicationId:'review-one',publicationDigest:'a'.repeat(64),memoryId:value.id,memoryRevision:1,compositionDigest:await memoryCompositionDigest(value)},bound={...value,publication:binding};
  const op={kind:'memory.keep' as const,id:value.id,expectedRevision:1};
  expect(await memoryReviewAlreadyAccepted(bound,op,binding,'MEM-001')).toBe(true);
  expect(await memoryReviewAlreadyAccepted(bound,op,binding,'MEM-002')).toBe(false);
  expect(await memoryReviewAlreadyAccepted({...bound,title:'Edited'},op,binding,'MEM-001')).toBe(false);
  expect(await memoryReviewAlreadyAccepted({...bound,withdrawn:true,revision:2},{...op,kind:'memory.withdraw'},binding,'MEM-001')).toBe(true);
});
