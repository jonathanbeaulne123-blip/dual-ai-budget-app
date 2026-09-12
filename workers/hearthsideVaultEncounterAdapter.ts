import type {Scope} from '../src/ledgerSync/protocol.ts';
import {vaultAssert,vaultObject,type VaultPublicationInput,type VaultAudiencePolicy} from '../src/hearthside/vaultContracts.ts';
import {encounterId,type EncounterRevealBinding} from '../src/hearthside/encounterContracts.ts';
import {HearthsideVaultEncounters,type EncounterPrivateView,type VaultEncounterContext} from './hearthsideVaultEncounters.ts';
export interface VaultEncounterAuthority{
  context(scope:Scope,id:string):Promise<VaultEncounterContext>;
  policy(scope:Scope,input:VaultPublicationInput,authorization?:string):Promise<VaultAudiencePolicy>;
}
/** Canonical context and authenticated subjects are resolved fresh; tokens remain transient. */
export class VaultEncounterAdapter{
  constructor(private readonly records:HearthsideVaultEncounters,private readonly authority:VaultEncounterAuthority){}
  private async audience(scope:Scope,id:string,authorization?:string){
    const context=await this.authority.context(scope,id);vaultAssert(context.id===id,'ENCOUNTER_SCOPE_CHANGED');
    const policy=await this.authority.policy(scope,{id:'encounter-audience',draftId:'encounter-audience',draftRevision:1,kind:'shared-memory',releaseAt:null,recipientMemberIds:context.participantMemberIds},authorization);
    return{context,policy};
  }
  async command(scope:Scope,input:unknown,publicationEnabled:boolean,authorization?:string):Promise<EncounterPrivateView>{
    const v=vaultObject(input,['encounterId','action','id','expectedRevision','answer','challenge']);const id=encounterId(v.encounterId);
    vaultAssert(publicationEnabled||['read','delete','pause','withdraw'].includes(String(v.action)),'PUBLICATION_DISABLED');
    const before=await this.audience(scope,id,authorization),view=await this.records.command(scope,input,before.context,before.policy);
    const after=await this.audience(scope,id,authorization);
    vaultAssert(JSON.stringify(before)===JSON.stringify(after),'AUDIENCE_CHANGED');await this.records.recheck(scope,view);return view;
  }
  /** Fresh authenticated pair check for a canonical write; no private body leaves this adapter. */
  async evidence(scope:Scope,binding:EncounterRevealBinding,authorization?:string):Promise<EncounterRevealBinding>{
    const before=await this.audience(scope,binding.encounterId,authorization);
    await this.records.command(scope,{encounterId:binding.encounterId,action:'read'},before.context,before.policy);
    const evidence=await this.records.evidence(scope,binding),after=await this.audience(scope,binding.encounterId,authorization);
    vaultAssert(JSON.stringify(before)===JSON.stringify(after),'AUDIENCE_CHANGED');return evidence;
  }
  /** Runs after the durability await, immediately before a private response. */
  async recheck(scope:Scope,view:EncounterPrivateView,authorization?:string):Promise<void>{
    const latest=await this.audience(scope,view.encounterId,authorization);
    await this.records.command(scope,{encounterId:view.encounterId,action:'read'},latest.context,latest.policy);
    await this.records.recheck(scope,view);
  }
}
