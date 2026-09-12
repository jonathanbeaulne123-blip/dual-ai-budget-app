import {canonical} from '../ledgerSync/patch.ts';
import {decodeHearthside,memoryKeptByEveryone,type HearthsideState,type MemoryComposition} from './contracts.ts';
import {encounterCompositionDigest,type EncounterCommand,type EncounterOutcome,type SharedEncounter} from './encounterContracts.ts';
import {encounterPack} from './encounterPacks.ts';
import {EncounterSharedClient} from './encounterSharedClient.ts';
import {EncounterBridgeStore,encounterImageDigest,encounterMemoryIdentity,type EncounterMemoryBridge} from './encounterEntryBridge.ts';
import {vaultAssert} from './vaultContracts.ts';
import type {HearthsideVaultClient,VaultClientScope} from './vaultClient.ts';
import type {EncounterPrivateView,EncounterRevealedAnswer} from '../../workers/hearthsideVaultEncounters.ts';

export type EncounterContent={version:1;environment:VaultClientScope['environment'];householdId:string;sequence:number;memberIds:string[];state:HearthsideState};
export type EncounterConnection={identity:string;scope:VaultClientScope;client:HearthsideVaultClient;token:()=>Promise<string>};
export type EncounterEntryCallbacks={onOpenEncounter:(id:string)=>void;onOpenPiece:(pieceId:string,designId:string)=>void;
  onMemoryDraft:(candidate:MemoryComposition)=>Promise<boolean>;onOpenMemory:(id:string)=>void};
export type EncounterMemoryInput={encounterId:string;compositionDigest:string;title:string;image:Blob;answers:EncounterRevealedAnswer[]};
/** Couples UI orchestration. The fresh reader is the current authenticated LedgerSyncClient.hearthsideContent. */
export class EncounterEntryController{
  readonly shared:EncounterSharedClient;readonly bridges:EncounterBridgeStore;
  private abort=new AbortController();private current:EncounterContent|null=null;
  constructor(readonly connection:EncounterConnection,private readContent:(signal:AbortSignal)=>Promise<EncounterContent>,
    private callbacks:EncounterEntryCallbacks,request:typeof fetch=fetch,factory:IDBFactory=indexedDB){
    this.shared=new EncounterSharedClient(connection.scope,connection.token,request,factory);this.bridges=new EncounterBridgeStore(factory);
  }
  close(){this.abort.abort();this.shared.close();this.bridges.close();}
  private live(){vaultAssert(!this.abort.signal.aborted,'SCOPE_CHANGED');}
  async refresh(){
    this.live();const content=await this.readContent(this.abort.signal);this.live();const s=this.connection.scope;
    vaultAssert(content.version===1&&content.environment===s.environment&&content.householdId===s.householdId&&Number.isSafeInteger(content.sequence)&&content.sequence>=0&&Array.isArray(content.memberIds)&&content.memberIds.length===2&&new Set(content.memberIds).size===2&&content.memberIds.includes(s.memberId),'ENCOUNTER_SCOPE_CHANGED');
    const next={...content,memberIds:[...content.memberIds].sort(),state:decodeHearthside(content.state)};
    vaultAssert(!this.current||canonical(this.current.memberIds)===canonical(next.memberIds),'AUDIENCE_CHANGED');
    if(!this.current||next.sequence>=this.current.sequence)this.current=next;
    return this.current;
  }
  async start(packId:string){
    encounterPack(packId);const fresh=await this.refresh(),prior=await this.shared.pending();this.live();
    const operation:EncounterCommand=prior?.operation.kind==='encounter.start'&&prior.operation.packId===packId?prior.operation:
      {kind:'encounter.start',id:`encounter-${crypto.randomUUID()}`,packId,participantMemberIds:fresh.memberIds,experienceId:null};
    await this.submit(operation);this.live();this.callbacks.onOpenEncounter(operation.id);
  }
  async submit(operation:EncounterCommand){
    await this.refresh();this.live();await this.shared.submit(operation);await this.refresh();this.live();return true;
  }
  async retry(){
    await this.refresh();const pending=await this.shared.pending();this.live();if(!pending)return false;
    await this.shared.retry();const content=await this.refresh();this.live();
    if(pending.operation.kind==='encounter.start')this.callbacks.onOpenEncounter(pending.operation.id);
    if(pending.operation.kind==='encounter.create-piece')this.openAcceptedPiece(content,pending.operation.id,pending.operation.digest);
    return true;
  }
  private encounter(content:EncounterContent,id:string){
    const e=content.state.encounters?.find(e=>e.id===id);vaultAssert(e&&canonical(e.participantMemberIds)===canonical(content.memberIds),'ENCOUNTER_NOT_FOUND');return e;
  }
  private async reviewed(id:string,digest:string){
    const content=await this.refresh(),encounter=this.encounter(content,id);
    vaultAssert(encounter.keptMemberIds.length===2&&encounter.pausedMemberIds.length===0&&await encounterCompositionDigest(encounter)===digest,'ENCOUNTER_CHANGED');this.live();
    const view=await this.connection.client.command({operation:'encounter-private',input:{encounterId:id,action:'read'}}) as EncounterPrivateView;this.live();
    vaultAssert(view.version===1&&view.encounterId===id&&!view.withdrawn&&!view.paused&&view.reveal&&canonical(view.reveal.binding)===canonical(encounter.reveal)&&view.reveal.answers.length===2&&new Set(view.reveal.answers.map(a=>a.memberId)).size===2&&view.reveal.answers.every(a=>content.memberIds.includes(a.memberId)),'REVEAL_REQUIRED');
    return{content,encounter,answers:view.reveal.answers};
  }
  private openAcceptedPiece(content:EncounterContent,id:string,digest:string){
    const e=this.encounter(content,id),outcome=e.outcomes.find(o=>o.kind==='design'&&o.recipeDigest===digest);
    vaultAssert(outcome?.designId&&content.state.designs.some(d=>d.designId===outcome.designId&&d.pieceIds.includes(outcome.id)&&d.revision>=outcome.revision),'OUTCOME_REVIEW_REQUIRED');
    this.live();this.callbacks.onOpenPiece(outcome.id,outcome.designId);
  }
  async studio(id:string,digest:string){
    const {encounter}=await this.reviewed(id,digest);vaultAssert(encounterPack(encounter.packId).keep.medium==='studio','INVALID_ENCOUNTER');
    await this.shared.submit({kind:'encounter.create-piece',id,digest});const content=await this.refresh();this.openAcceptedPiece(content,id,digest);
  }
  async memory(input:EncounterMemoryInput){
    const {content,encounter,answers}=await this.reviewed(input.encounterId,input.compositionDigest);
    vaultAssert(encounterPack(encounter.packId).keep.medium==='memory'&&canonical(answers)===canonical(input.answers)&&input.title===encounterPack(encounter.packId).keep.label,'ENCOUNTER_CHANGED');
    const scope=this.connection.scope,ids=encounterMemoryIdentity(scope,encounter.id,input.compositionDigest),existing=content.state.memories.find(m=>m.id===ids.memoryId);
    if(existing){vaultAssert(!existing.withdrawn,'MEMORY_WITHDRAWN');this.live();this.callbacks.onOpenMemory(existing.id);return;}
    const own=answers.find(a=>a.memberId===scope.memberId);vaultAssert(own,'REVEAL_REQUIRED');
    const candidate:MemoryComposition={version:1,id:ids.memoryId,revision:1,title:input.title,date:null,experienceId:encounter.experienceId,
      media:[{version:1,contentId:ids.mediaId,revision:1,kind:'image',alt:`${input.title} — the composition and words we both reviewed`}],designs:[],
      recollections:[{memberId:scope.memberId,text:own.text}],hideAmounts:true,approvals:[],withdrawn:false};
    const bridge=await this.bridges.reserve(scope,encounter.id,input.compositionDigest,candidate,input.image);this.live();await this.resumeMemory(bridge);
  }
  async resumeMemory(bridge:EncounterMemoryBridge){
    const {content,answers}=await this.reviewed(bridge.encounterId,bridge.compositionDigest),scope=this.connection.scope;
    const stored=await this.bridges.read(scope,bridge.encounterId,bridge.compositionDigest);this.live();
    vaultAssert(stored&&stored.manifest.sha256===await encounterImageDigest(stored.image)&&stored.candidate.recollections[0]?.text===answers.find(a=>a.memberId===scope.memberId)?.text,'ENCOUNTER_RECOVERY_INVALID');
    this.live();
    const existing=content.state.memories.find(m=>m.id===stored.candidate.id);
    if(existing){vaultAssert(!existing.withdrawn,'MEMORY_WITHDRAWN');this.callbacks.onOpenMemory(existing.id);return;}
    await this.connection.client.queueMedia(stored.manifest,stored.image);this.live();await this.connection.client.resumeUploads([stored.manifest.id]);this.live();
    // Upload completion is not publication permission; recheck both authorities before opening the review.
    const latest=await this.reviewed(stored.encounterId,stored.compositionDigest);this.live();
    const accepted=latest.content.state.memories.find(m=>m.id===stored.candidate.id);
    if(accepted){vaultAssert(!accepted.withdrawn,'MEMORY_WITHDRAWN');this.callbacks.onOpenMemory(accepted.id);return;}
    vaultAssert(await this.callbacks.onMemoryDraft(structuredClone(stored.candidate)),'MEMORY_DRAFT_ALREADY_OPEN');this.live();
  }
  async discardBridge(bridge:EncounterMemoryBridge){
    this.live();await this.connection.client.removeQueuedMedia([bridge.manifest.id]);this.live();
    await this.bridges.remove(this.connection.scope,bridge.encounterId,bridge.compositionDigest);
  }
  async linkMemory(id:string,digest:string){
    const {content}=await this.reviewed(id,digest),ids=encounterMemoryIdentity(this.connection.scope,id,digest),memory=content.state.memories.find(m=>m.id===ids.memoryId);
    vaultAssert(memory&&memoryKeptByEveryone(memory,content.memberIds),'OUTCOME_REVIEW_REQUIRED');
    const outcome:EncounterOutcome={kind:'memory',id:memory.id,revision:memory.revision,recipeDigest:digest};
    await this.shared.submit({kind:'encounter.outcome',id,digest,outcome});await this.refresh();this.live();
  }
  async bridgeFor(encounter:SharedEncounter){const digest=await encounterCompositionDigest(encounter);this.live();return this.bridges.read(this.connection.scope,encounter.id,digest);}
}
