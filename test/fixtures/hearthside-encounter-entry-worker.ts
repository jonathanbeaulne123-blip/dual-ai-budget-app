/** Synthetic canonical HTTP adapter. Real LedgerRoom admission is independently covered by root integration tests. */
export const encounterEntryWorker=`
import {DurableObject} from 'cloudflare:workers';
import {HearthsideVault} from './workers/hearthsideVault.ts';
import {emptyHearthside,decodeMemory,memoryKeptByEveryone} from './src/hearthside/contracts.ts';
import {applyEncounterCommand} from './src/hearthside/encounterService.ts';
import {decodeEncounterOutcome} from './src/hearthside/encounterContracts.ts';
import {createEncounterDesign,encounterDesignIdentity} from './src/hearthside/encounterDesign.ts';
import {projectKittyDesign} from './src/hearthside/design.ts';
import {ENCOUNTER_WARDROBE} from './src/hearthside/encounterWardrobe.ts';
import {canonical} from './src/ledgerSync/patch.ts';
import {sha256String} from './src/core/synchronousHash.ts';
import {memoryCompositionDigest} from './src/hearthside/memoryPublication.ts';
const people=[{memberId:'A',subject:'11111111-1111-4111-a111-111111111111'},{memberId:'B',subject:'22222222-2222-4222-a222-222222222222'}],same=(a,b)=>canonical(a)===canonical(b);
const scoped=request=>{const token=request.headers.get('Authorization');const p=people.find(p=>token==='Bearer synthetic-'+p.memberId);if(!p)throw Error('UNAUTHENTICATED');return{...p,environment:'development',householdId:'HH-ENTRY',role:'owner',aclEpoch:1,expires:Date.now()+60000};};
export class EntryRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS fixture_state (id TEXT PRIMARY KEY, json TEXT)');this.tail=Promise.resolve();}
 read(key,fallback){const row=[...this.sql.exec('SELECT json FROM fixture_state WHERE id=?',key)][0];return row?JSON.parse(row.json):fallback;}
 write(key,value){this.sql.exec('INSERT INTO fixture_state VALUES (?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json',key,JSON.stringify(value));}
 serial(fn){const p=this.tail.then(fn);this.tail=p.catch(()=>{});return p;}
 vault(){return this.env.VAULTS.get(this.env.VAULTS.idFromName('development/HH-ENTRY'));}
 check(scope){if(!people.some(p=>p.memberId===scope.memberId&&p.subject===scope.subject))throw Error('FORBIDDEN');}
 content(scope){this.check(scope);return{version:1,environment:'development',householdId:'HH-ENTRY',sequence:this.read('sequence',0),memberIds:people.map(p=>p.memberId),state:this.read('state',emptyHearthside())};}
 vaultEncounterContext(scope,id){const e=this.content(scope).state.encounters?.find(e=>e.id===id);if(!e)throw Error('ENCOUNTER_NOT_FOUND');return{id,packId:e.packId,participantMemberIds:e.participantMemberIds,wardrobeIds:ENCOUNTER_WARDROBE.map(w=>w.id)};}
 async command(scope,input){return this.serial(async()=>{
  const state=this.content(scope).state,prior=this.read('receipt/'+input.id,null),digest=sha256String(canonical(input));
  if(prior){if(prior.digest!==digest||prior.actor!==scope.memberId)throw Error('REQUEST_ID_REUSED');return{version:1,receipt:prior};}
  const op=input.operation,e=state.encounters?.find(e=>e.id===op.id)??null;
  const binding=op.kind==='encounter.reveal'?op.binding:e?.reveal,revealEvidence=binding?await this.vault().checkEncounterRevealFor(scope,binding):undefined;
  let applied=op,outcomeEvidence,document;
  if(op.kind==='encounter.create-piece'){
   const ids=encounterDesignIdentity(scope.environment,scope.householdId,op.id,op.digest),old=e.outcomes.find(o=>o.kind==='design'&&o.id===ids.pieceId&&o.recipeDigest===op.digest);
   if(old)outcomeEvidence=old;else{document=await createEncounterDesign(e,scope,new Date().toISOString());outcomeEvidence={kind:'design',id:ids.pieceId,designId:ids.designId,revision:document.revision,recipeDigest:op.digest};}
   applied={kind:'encounter.outcome',id:op.id,digest:op.digest,outcome:outcomeEvidence};
  }else if(op.kind==='encounter.outcome'){const m=state.memories.find(m=>m.id===op.outcome.id&&m.revision===op.outcome.revision);if(!m||!memoryKeptByEveryone(m,['A','B']))throw Error('OUTCOME_REVIEW_REQUIRED');outcomeEvidence=op.outcome;}
  if(outcomeEvidence)outcomeEvidence=decodeEncounterOutcome(outcomeEvidence);
  const next=await applyEncounterCommand(e,applied,{actorId:scope.memberId,memberIds:['A','B'],experienceIds:state.experiences.map(e=>e.id),wardrobeIds:ENCOUNTER_WARDROBE.map(w=>w.id),revealEvidence,outcomeEvidence});
  state.encounters=[...(state.encounters??[]).filter(e=>e.id!==next.id),next];if(document){const view=projectKittyDesign(document);state.designs.push({version:1,designId:document.id,revision:document.revision,displayPieceId:view.pieces[0].piece.id,bankId:null,pieceIds:view.pieces.map(p=>p.piece.id)});this.write('design/'+document.id,document);}
  const sequence=this.read('sequence',0)+1,receipt={id:'HS-ENCOUNTER-'+input.id,actor:scope.memberId,digest,sequence,postedIds:[],commandKind:'hearthsideEncounter'};
  this.ctx.storage.transactionSync(()=>{this.write('state',state);this.write('sequence',sequence);this.write('receipt/'+input.id,receipt);});return{version:1,receipt};
 });}
 design(scope,id){this.check(scope);return projectKittyDesign(this.read('design/'+id,null));}
 async validateVaultMemoryCandidate(scope,raw,expected){const state=this.content(scope).state,old=state.memories.find(m=>m.id===raw.id),{publication,...plain}=raw,value=decodeMemory(plain);
  if((old?.revision??0)!==expected||value.revision!==expected+1||value.approvals.length||value.withdrawn||!same(value.recollections.filter(r=>r.memberId!==scope.memberId),old?.recollections.filter(r=>r.memberId!==scope.memberId)??[]))throw Error('MEMORY_CHANGED');return{candidate:value,compositionDigest:await memoryCompositionDigest(value)};}
 async compose(scope,value){return this.serial(async()=>{await this.validateVaultMemoryCandidate(scope,value,value.revision-1);await this.vault().checkMemoryPublicationFor(scope,value.publication,value,'compose');const state=this.content(scope).state;state.memories=[...state.memories.filter(m=>m.id!==value.id),value];this.write('state',state);this.write('sequence',this.read('sequence',0)+1);return true;});}
 async keep(scope,binding){return this.serial(async()=>{const state=this.content(scope).state,m=state.memories.find(m=>m.id===binding.memoryId);if(!m||!same(binding,m.publication))throw Error('MEMORY_CHANGED');await this.vault().checkMemoryPublicationFor(scope,binding,m,'keep');m.approvals=[...m.approvals.filter(a=>a.memberId!==scope.memberId),{memberId:scope.memberId,revision:m.revision}];this.write('state',state);this.write('sequence',this.read('sequence',0)+1);return true;});}
 async vaultMemoryAccess(scope,binding,mediaId){const m=this.content(scope).state.memories.find(m=>m.id===binding.memoryId),current=Boolean(m&&!m.withdrawn&&same(m.publication,binding)&&await memoryCompositionDigest(m)===binding.compositionDigest&&(mediaId===null||m.media.some(r=>r.contentId===mediaId)));return{current,kept:current&&memoryKeptByEveryone(m,['A','B'])};}
 async acceptVaultPublication(scope,ref){this.check(scope);if(ref.memory){const access=await this.vaultMemoryAccess(scope,ref.memory,null);if(!access.kept)throw Error('MEMORY_CHANGED');}return{...ref,receiptId:'accept-'+ref.publicationId,acceptedAt:1000};}
 vaultMediaReferenced(scope,id){return this.content(scope).state.memories.some(m=>!m.withdrawn&&m.media.some(r=>r.contentId===id));}
}
export class EntryVault extends HearthsideVault{
 constructor(ctx,env){super(ctx,{HEARTHSIDE_VAULT_MEDIA:env.MEDIA,LEDGER_ROOMS:env.ROOMS,HEARTHSIDE_VAULT_AUTHORITY:{policy:async(scope,input)=>{if(!people.some(p=>p.memberId===scope.memberId&&p.subject===scope.subject))throw Error('FORBIDDEN');return{recipients:input.recipientMemberIds.map(id=>people.find(p=>p.memberId===id)),approvers:people};},accept:(scope,ref)=>env.ROOMS.get(env.ROOMS.idFromName('development/HH-ENTRY')).acceptVaultPublication(scope,ref),isReferenced:(scope,id)=>env.ROOMS.get(env.ROOMS.idFromName('development/HH-ENTRY')).vaultMediaReferenced(scope,id)}});}
}
export default{async fetch(request,env){try{
 const scope=scoped(request),path=new URL(request.url).pathname,room=env.ROOMS.get(env.ROOMS.idFromName('development/HH-ENTRY')),vault=env.VAULTS.get(env.VAULTS.idFromName('development/HH-ENTRY'));
 if(path.endsWith('/hearthside-content'))return Response.json(await room.content(scope));
 if(path.endsWith('/encounter-command'))return Response.json(await room.command(scope,await request.json()));
 if(path==='/fixture/compose')return Response.json(await room.compose(scope,await request.json()));if(path==='/fixture/keep')return Response.json(await room.keep(scope,await request.json()));
 if(path.startsWith('/fixture/design/'))return Response.json(await room.design(scope,decodeURIComponent(path.split('/').pop())));
 if(path.includes('/media/')){const id=path.split('/').pop();if(request.method==='PUT')return Response.json(await vault.uploadFor(scope,id,new Uint8Array(await request.arrayBuffer()),request.headers.get('Content-Type')));return vault.mediaFor(scope,id,request.headers.get('X-Vault-Publication'),request.headers.get('X-Vault-Media-Mode')||'active');}
 if(path.startsWith('/api/hearthside-vault/'))return request.method==='GET'?Response.json(await vault.snapshotFor(scope)):Response.json(await vault.commandFor(scope,await request.json(),true,'transient-synthetic-token'));
 return new Response('Missing',{status:404});
 }catch(e){return Response.json({error:e.message,code:e.message},{status:409});}}};
`;
