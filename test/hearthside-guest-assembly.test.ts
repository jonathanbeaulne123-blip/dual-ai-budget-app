import {expect,it} from 'vitest';
import {addGoal,catalogHousehold} from '../src/core/index.ts';
import {assembleHousehold} from '../src/core/sync.ts';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
import {newKittyPiece} from '../src/core/kittyStudio.ts';
import {defaultGoalEnvelope} from '../src/core/goalEnvelopes.ts';
import type {MemoryComposition} from '../src/hearthside/contracts.ts';
import type {VaultMemoryAuthorReview} from '../src/hearthside/memoryPublication.ts';
import type {GuestPrepareInput,GuestReview,GuestInvitationReview,GuestVisit} from '../src/hearthside/guestContracts.ts';
import type {VaultAuthorReview} from '../src/hearthside/vaultContracts.ts';
import {ASSEMBLY_HOUSEHOLD,createGuestAssembly,readAssembly,subjects,type Host} from './fixtures/hearthsideGuestAssemblyRuntime.ts';
const publicationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cardCode='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const grantId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const sessionId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const hosts:Host[]=['alice','bob'];
const voice=new TextEncoder().encode('OggSreviewed-synthetic-evening-song');
async function fixture(){
 const app=await createGuestAssembly();
 try{
  let h={...catalogHousehold(),householdId:ASSEMBLY_HOUSEHOLD};
  const legacy=newKittyPiece('PIECE-legacy','2026-09-12T12:00:00.000Z');
  legacy.paint.strokes=[{part:'body',tool:'brush',color:'#ab2233',size:12,opacity:1,mirror:false,pts:[.2,.2,.3,.3]}];
  h=addGoal(h,{name:'Confidential bank name',target:'98765.43',shared:true,envelope:{...defaultGoalEnvelope(),studio:{version:1,draft:legacy,fired:[],displayId:null}}}).household;
  const sharedBank=h.goals.at(-1)!.id;
  h=addGoal(h,{name:'Private bank',target:'12345.67',shared:false,ownerMemberId:'MEM-001',envelope:{...defaultGoalEnvelope(),studio:{version:1,draft:{...legacy,id:'PIECE-private'},fired:[],displayId:null}}}).household;
  const privateBank=h.goals.at(-1)!.id;
  for(const actor of hosts)await readAssembly(await app.local('import',h,actor));
  const initial=await app.snapshot(),money=await financialAuditHash(assembleHousehold(initial.shared,initial.personal));
  const design=(body:unknown,actor:Host='alice')=>app.local('design',{version:1,...body as object},actor);
  await readAssembly(await design({kind:'create',designId:'DESIGN-shared',bankId:sharedBank}));
  await readAssembly(await design({kind:'create',designId:'DESIGN-private',bankId:privateBank}));
  for(const [designId,pieceId] of [['DESIGN-private','PIECE-private']])await readAssembly(await design({kind:'operate',operation:{version:1,id:'OP-dip-'+designId,gestureId:'GESTURE-dip-'+designId,designId,pieceId,kind:'change-dip',part:'base',color:'#ffeecc',expectedEditEpoch:0,expectedFieldRevision:0}}));
  await readAssembly(await design({kind:'create',designId:'DESIGN-free',bankId:null}));
  await readAssembly(await design({kind:'operate',operation:{version:1,id:'OP-created',gestureId:'GESTURE-created',designId:'DESIGN-free',pieceId:'PIECE-free',kind:'create-piece',base:'cream'}}));
  const vault=(body:unknown,actor:Host='alice')=>app.local('vault',body,actor);
  const sha256=Buffer.from(await crypto.subtle.digest('SHA-256',voice)).toString('hex');
  await readAssembly(await vault({operation:'prepare-media',input:{id:'voice',sha256,byteLength:voice.length,contentType:'audio/ogg'}}));
  await readAssembly(await fetch(app.base+'/__assembly/upload',{method:'POST',headers:app.headers(),body:voice}));
  const candidate:MemoryComposition={version:1,id:'MEMORY-evening',revision:1,title:'The kitchen song',date:null,experienceId:null,media:[{version:1,contentId:'voice',revision:1,kind:'audio',alt:'A tune we chose to share'}],designs:[{version:1,documentId:'DESIGN-free',pieceId:'PIECE-free',revision:1}],recollections:[{memberId:'MEM-001',text:'We found a tune for the evening.'}],hideAmounts:true,approvals:[],withdrawn:false};
  async function prepareMemory(value:MemoryComposition,id='shared-memory-copy',expectedRevision=0,sourcePublicationId?:string){
   const review=await readAssembly<VaultMemoryAuthorReview>(await vault({operation:'prepare-memory',input:{id,candidate:value,expectedRevision,recipientMemberIds:['MEM-001','MEM-002'],...(sourcePublicationId?{sourcePublicationId}:{})}}));
   const bound={...value,publication:review.binding};
   await app.commit({kind:'memory.compose',expectedRevision,value:bound});return {review,bound};
  }
  async function keepMemory(review:VaultMemoryAuthorReview,bound:MemoryComposition){
   for(const actor of hosts){await readAssembly(await vault({operation:'approve',id:review.id,digest:review.digest},actor));await app.commit({kind:'memory.keep',id:bound.id,expectedRevision:bound.revision},actor);}
   await readAssembly(await vault({operation:'activate',id:review.id}));
  }
  const host=(body:unknown,actor:Host='alice')=>app.guest('host/'+ASSEMBLY_HOUSEHOLD,body,actor);
  const input=(id=publicationId):GuestPrepareInput=>({publicationId:id,title:'Our evening room',welcome:'Stay for a song.',theme:'classic',room:'theatre',mode:'anytime',items:[{kind:'piece',id:'PIECE-legacy',designId:'DESIGN-shared',revision:0,x:.2,y:.3},{kind:'piece',id:'PIECE-free',designId:'DESIGN-free',revision:1,x:.7,y:.6},{kind:'memory',id:candidate.id,revision:1,x:.4,y:.5}]});
  async function approveRoom(input:GuestPrepareInput){const review=await readAssembly<GuestReview>(await host({operation:'prepare',input}));for(const actor of hosts)await readAssembly(await host({operation:'approve',publicationId:input.publicationId,digest:review.digest},actor));return review;}
  async function invite(id=publicationId,grant=grantId,card=cardCode){
   await readAssembly(await app.guest('cards',{operation:'create',id:card,label:'Cara'},'cara'));
   const review=await readAssembly<GuestInvitationReview>(await host({operation:'prepare-invitation',publicationId:id,input:{id:grant,cardCode:card,expiresAt:Date.now()+86400000}}));
   for(const actor of hosts)await readAssembly(await host({operation:'approve-invitation',publicationId:id,id:grant,digest:review.digest},actor));
   await readAssembly(await host({operation:'activate-invitation',publicationId:id,id:grant}));
   return review;
  }
  const visit=(operation='enter',actor='cara',id=publicationId,grant=grantId)=>app.guest('visit/'+id,{operation,grantId:grant,sessionId,...(operation==='enter'?{label:'Cara'}:{})},actor);
  const media=(actor='cara',id=publicationId,grant=grantId)=>fetch(app.base+`/api/hearthside-guests/development/visit/${id}/media/media-1`,{headers:{...app.headers(actor),'X-Guest-Grant':grant}});
  return {...app,vault,design,candidate,prepareMemory,keepMemory,host,input,approveRoom,invite,visit,media,money,sharedBank};
 }catch(error){await app.dispose();throw error;}
}

it('publishes actual LedgerRoom design and Vault memory copies into the guest namespace, preserving money and recipient isolation',async()=>{
 const app=await fixture();try{
  const {review,bound}=await app.prepareMemory(app.candidate);
  expect((await app.host({operation:'prepare',input:app.input()})).status).toBe(404); // actual unkept source denied
  await app.keepMemory(review,bound);
  await app.commit({kind:'furniture.save',value:{room:'theatre',furnitureId:'projector',expectedRevision:0,x:.7,y:.4}});
  expect((await app.host({operation:'prepare',input:{...app.input(),items:[{kind:'memory',id:bound.id,revision:0,x:.4,y:.5}]}})).status).toBe(400);
  const approved=await app.approveRoom(app.input()); // untouched migrated revision zero is a real source
  expect(approved.arrangement.furniture?.placements.find(p=>p.furnitureId==='projector')).toMatchObject({revision:1,x:.7,y:.4});
  expect(approved.arrangement.objects.filter(o=>o.kind==='piece').map(o=>o.displaySize)).toEqual(['standard','standard']);
  const authored=await readAssembly<{snapshot:{piece:{paint:unknown;sculpt:unknown}}}>(await app.design({kind:'snapshot',designId:'DESIGN-shared',pieceId:'PIECE-legacy',revision:0}));
  expect(approved.arrangement.objects[0]).toMatchObject({appearance:{sculpt:authored.snapshot.piece.sculpt,paint:authored.snapshot.piece.paint}});
  expect(JSON.stringify(approved.arrangement)).not.toMatch(/98765|9876543|Confidential|GOAL-|DESIGN-|PIECE-|MEMORY-|MEM-001|MEM-002|shared-memory-copy|target|balance|backing|receipt|subject|householdId|setFill|contribution/);
  const seq=(await app.snapshot()).sequence;
  const active=await readAssembly<GuestReview>(await app.host({operation:'activate',publicationId}));
  // Discarding an acknowledgement and repeating the same identity reuses real acceptance.
  expect(await readAssembly(await app.host({operation:'activate',publicationId}))).toEqual(active);
  expect((await app.snapshot()).sequence).toBe(seq); // private receipt does not create a household event
  const archive=await app.mf.getR2Bucket('LEDGER_ARCHIVE','app');
  const receipts=await archive.list({prefix:'hearthside-acceptance-v1/'});
  const accepted=await Promise.all(receipts.objects.map(async o=>await (await archive.get(o.key))!.json() as {data:{receipt:{kind:string;publicationId:string;receiptId:string}}}));
  expect(accepted.filter(r=>r.data.receipt.kind==='guest')).toHaveLength(1);
  expect(accepted.find(r=>r.data.receipt.kind==='guest')!.data.receipt).toMatchObject({publicationId,receiptId:expect.stringMatching(/^VAULT-/)});
  await app.invite();
  expect((await app.visit('enter','dan')).status).toBe(404);
  expect((await app.media('dan')).status).toBe(404);
  expect((await app.local('snapshot',undefined,'cara')).status).toBe(409);
  const entered=await readAssembly<GuestVisit>(await app.visit());
  expect(entered.arrangement).toEqual(approved.arrangement);
  expect(JSON.stringify(entered)).not.toMatch(/HH-guest|11111111|33333333|source|target|balance|memberId|receipt|synthetic.jwt/);
  const recording=await app.media();expect(recording.status).toBe(200);expect(recording.headers.get('Cache-Control')).toBe('private, no-store');expect(new Uint8Array(await recording.arrayBuffer())).toEqual(voice);
  const beforeToy=await app.snapshot();
  await readAssembly(await app.guest('visit/'+publicationId,{operation:'toy',grantId,sessionId,toy:'firefly',x:.3,y:.4},'cara'));
  expect(await app.snapshot()).toEqual(beforeToy);
  await readAssembly(await app.host({operation:'revoke-invitation',publicationId,id:grantId},'bob'));
  expect((await app.visit('pulse')).status).toBe(404);expect((await app.media()).status).toBe(404);
  expect(await readAssembly(await app.guest('street',undefined,'cara'))).toMatchObject({visits:[]});
  expect((await app.host({operation:'activate-invitation',publicationId,id:grantId})).status).toBe(409);
  const final=await app.snapshot();expect(await financialAuditHash(assembleHousehold(final.shared,final.personal))).toBe(app.money);
  expect(JSON.stringify(final)).not.toMatch(/aaaaaaaa-aaaa|recipientMemberIds|synthetic.jwt|11111111|OggS/);
 }finally{await app.dispose();}
},60_000);

it('invalidates exact guest review after real furniture edits, then closes visits and copied media on Vault withdrawal',async()=>{
 const app=await fixture();try{
  const {review,bound}=await app.prepareMemory(app.candidate);await app.keepMemory(review,bound);
  await app.approveRoom(app.input());
  await app.commit({kind:'furniture.save',value:{room:'theatre',furnitureId:'chair-left',expectedRevision:0,x:.6,y:.6}});
  expect((await app.host({operation:'activate',publicationId})).status).toBe(404);
  const next='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const fresh=await app.approveRoom({...app.input(next),theme:'taylor'});
  await readAssembly(await app.host({operation:'activate',publicationId:next}));await app.invite(next);
  const visit=()=>app.visit('enter','cara',next),media=()=>app.media('cara',next);
  const entered=await readAssembly<GuestVisit>(await visit());expect(entered.arrangement).toEqual(fresh.arrangement);
  await app.commit({kind:'furniture.save',value:{room:'theatre',furnitureId:'chair-left',expectedRevision:1,x:.8,y:.7}});
  expect((await readAssembly<GuestVisit>(await visit())).arrangement).toEqual(entered.arrangement); // approved detached arrangement remains exact
  expect((await media()).status).toBe(200);
  await readAssembly(await app.vault({operation:'withdraw',id:review.id}));
  // Guest's physically retained bytes remain in R2 but no longer grant media access.
  const copies=await app.mf.getR2Bucket('HEARTHSIDE_GUEST_MEDIA','app');expect(await copies.get(`guest-copy-v1/development/${next}/media-1`)).not.toBeNull();
  expect((await visit()).status).toBe(404);expect((await media()).status).toBe(404);
  expect((await app.host({operation:'activate',publicationId:next})).status).toBe(404);
  await app.commit({kind:'memory.withdraw',id:bound.id,expectedRevision:1});
  await readAssembly(await app.host({operation:'revoke',publicationId:next}));
  expect((await app.host({operation:'activate',publicationId:next})).status).toBe(404);
  const final=await app.snapshot();expect(await financialAuditHash(assembleHousehold(final.shared,final.personal))).toBe(app.money);
 }finally{await app.dispose();}
},60_000);

it('denies private letters and designs and never reopens an old visit when a revised memory is mutually kept',async()=>{
 const app=await fixture();try{
  await readAssembly(await app.vault({operation:'save-draft',input:{id:'private-draft',expectedRevision:0,content:{title:'For you alone',text:'These words stay recipient only.',mediaIds:['voice']}}}));
  const letter=await readAssembly<VaultAuthorReview>(await app.vault({operation:'prepare-publication',input:{id:'private-letter',draftId:'private-draft',draftRevision:1,kind:'letter',recipientMemberIds:['MEM-002'],releaseAt:null}}));
  await readAssembly(await app.vault({operation:'approve',id:letter.id,digest:letter.digest}));await readAssembly(await app.vault({operation:'activate',id:letter.id}));
  for(const item of [{kind:'memory',id:'private-letter',revision:1},{kind:'piece',id:'PIECE-private',designId:'DESIGN-private',revision:1}])expect((await app.host({operation:'prepare',input:{...app.input(),items:[{...item,x:.4,y:.5}]}})).status).toBe(404);
  const {review,bound}=await app.prepareMemory(app.candidate);await app.keepMemory(review,bound);
  await app.approveRoom({...app.input(),theme:'newfoundland'});await readAssembly(await app.host({operation:'activate',publicationId}));await app.invite();await readAssembly(await app.visit());
  const changed={...bound,revision:2,title:'Our revised kitchen song',approvals:[]};
  const revised=await app.prepareMemory(changed,'memory-revised',1,review.id);
  expect((await app.visit('pulse')).status).toBe(404);expect((await app.media()).status).toBe(404);
  await app.keepMemory(revised.review,revised.bound);
  expect((await app.visit()).status).toBe(404);expect((await app.media()).status).toBe(404);
  const next='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const input={...app.input(next),items:app.input(next).items.map(i=>i.kind==='memory'?{...i,revision:2}:i)};
  await app.approveRoom(input);await readAssembly(await app.host({operation:'activate',publicationId:next}));
  const nextGrant='ffffffff-ffff-4fff-8fff-ffffffffffff',nextCard='99999999-9999-4999-8999-999999999999';await app.invite(next,nextGrant,nextCard);
  await readAssembly(await app.visit('enter','cara',next,nextGrant));
  // The same visible member id with a changed authenticated principal invalidates old consent.
  await readAssembly(await app.local('control',{key:'roster',value:[{memberId:'MEM-001',subject:subjects.alice},{memberId:'MEM-002',subject:'44444444-4444-4444-a444-444444444444'}]}));
  expect((await app.visit('pulse','cara',next,nextGrant)).status).toBe(404);expect((await app.media('cara',next,nextGrant)).status).toBe(404);
 }finally{await app.dispose();}
},60_000);
