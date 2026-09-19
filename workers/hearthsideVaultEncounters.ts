import {vaultAssert,vaultDigest,vaultId,vaultInteger,vaultObject,vaultPrincipalEqual,vaultPrincipals,type VaultAudiencePolicy,type VaultPrincipal,type VaultScope} from '../src/hearthside/vaultContracts.ts';
import {encounterId,encounterText,decodeEncounterRevealBinding,type EncounterRevealBinding} from '../src/hearthside/encounterContracts.ts';
import {encounterPack} from '../src/hearthside/encounterPacks.ts';
import type {VaultStorage} from './hearthsideVaultStore.ts';
export type VaultEncounterContext={id:string;packId:string;participantMemberIds:string[];wardrobeIds:string[]};
export type EncounterPrivateAnswer={revision:number;text:string;objectId:string;wardrobeId:string|null};
export type EncounterRevealedAnswer=EncounterPrivateAnswer&{memberId:string};
type Answer=EncounterPrivateAnswer&{principal:VaultPrincipal;submitted?:boolean};
type Consent={principal:VaultPrincipal;challenge:string;revision:number;generation:number};
type Round={version:1;id:string;encounterId:string;packId:string;principals:VaultPrincipal[];generation:number;state:'active'|'revoked';answers:Answer[];consents:Consent[];reviews:Consent[];
  paused:VaultPrincipal[];reveal:{binding:EncounterRevealBinding;answers:EncounterRevealedAnswer[]}|null;receipts:{id:string;actor:VaultPrincipal;hash:string}[]};
export type EncounterPrivateView={version:1;encounterId:string;own:EncounterPrivateAnswer|null;challenge:string;choiceSubmitted:boolean;paused:boolean;withdrawn:boolean;
  reveal:{binding:EncounterRevealBinding;answers:EncounterRevealedAnswer[]}|null};
export type VaultEncounterCommand={operation:'encounter-private';input:{encounterId:string;action:'read'|'save'|'delete'|'review'|'reveal'|'pause'|'resume'|'withdraw';id?:string;expectedRevision?:number;answer?:EncounterPrivateAnswer;challenge?:string}};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const principal=(s:VaultScope):VaultPrincipal=>({memberId:s.memberId,subject:s.subject});
const keyFor=async(id:string)=>`encounter/${await vaultDigest({kind:'encounter-private-v1',id})}`;

/** Private records use the existing durable Vault journal; no shared metadata contains these answers. */
export class HearthsideVaultEncounters{
  constructor(private readonly storage:VaultStorage,private readonly check:(scope:VaultScope)=>void){}
  private async current(scope:VaultScope,context:VaultEncounterContext,policy:VaultAudiencePolicy):Promise<Round>{
    this.check(scope);encounterId(context.id);const pack=encounterPack(context.packId),principals=vaultPrincipals(policy.approvers);
    vaultAssert(principals.length===2&&same(principals,vaultPrincipals(policy.recipients))&&same(principals.map(p=>p.memberId).sort(),[...context.participantMemberIds].sort())&&principals.some(p=>vaultPrincipalEqual(p,scope)),'AUDIENCE_CHANGED');
    const key=await keyFor(context.id);this.check(scope);let row=this.storage.get<Round>(key);
    if(!row){row={version:1,id:key.split('/')[1]!,encounterId:context.id,packId:pack.id,principals,generation:1,state:'active',answers:[],consents:[],reviews:[],paused:[],reveal:null,receipts:[]};this.storage.put(key,row);}
    vaultAssert(row.encounterId===context.id&&row.packId===pack.id&&same(row.principals,principals),'AUDIENCE_CHANGED');return row;
  }
  private async view(scope:VaultScope,row:Round):Promise<EncounterPrivateView>{
    const own=row.answers.find(a=>vaultPrincipalEqual(a.principal,scope)),review=row.reviews.find(r=>vaultPrincipalEqual(r.principal,scope)),challenge=review?.challenge??'';this.check(scope);
    return{version:1,encounterId:row.encounterId,own:own?{revision:own.revision,text:own.text,objectId:own.objectId,wardrobeId:own.wardrobeId}:null,challenge,
      choiceSubmitted:own?.submitted===true,paused:row.paused.some(p=>vaultPrincipalEqual(p,scope)),withdrawn:row.state==='revoked',
      reveal:row.state==='active'?row.reveal:null};
  }
  async command(scope:VaultScope,input:unknown,context:VaultEncounterContext,policy:VaultAudiencePolicy):Promise<EncounterPrivateView>{
    const v=vaultObject(input,['encounterId','action','id','expectedRevision','answer','challenge']);vaultAssert(v.encounterId===context.id,'ENCOUNTER_SCOPE_CHANGED');
    vaultAssert(['read','save','delete','review','reveal','pause','resume','withdraw'].includes(String(v.action)),'INVALID_ENCOUNTER_COMMAND');
    const initial=await this.current(scope,context,policy),key=`encounter/${initial.id}`;
    if(v.action==='read'){vaultObject(input,['encounterId','action']);return this.view(scope,initial);}
    const commandId=vaultId(v.id),requestHash=await vaultDigest(input);this.check(scope);
    let row=this.storage.get<Round>(key)!;const prior=row.receipts.find(r=>r.id===commandId&&vaultPrincipalEqual(r.actor,scope));
    if(prior){vaultAssert(vaultPrincipalEqual(prior.actor,scope)&&prior.hash===requestHash,'COMMAND_ID_REUSED');return this.view(scope,row);}
    vaultAssert(row.state==='active','ENCOUNTER_WITHDRAWN');vaultAssert(row.receipts.length<256||['delete','pause','withdraw'].includes(String(v.action)),'ENCOUNTER_HISTORY_FULL');
    const actor=principal(scope),next=structuredClone(row),own=next.answers.find(a=>vaultPrincipalEqual(a.principal,scope));
    const changed=()=>{next.generation++;next.consents=[];next.reveal=null;};
    switch(v.action){
      case 'save':{
        vaultObject(input,['encounterId','action','id','expectedRevision','answer']);
        vaultAssert(!next.paused.some(p=>vaultPrincipalEqual(p,scope)),'ENCOUNTER_PAUSED');
        const expected=vaultInteger(v.expectedRevision),a=vaultObject(v.answer,['revision','text','objectId','wardrobeId']);
        vaultAssert((own?.revision??0)===expected&&vaultInteger(a.revision,1)===expected+1,'ANSWER_CHANGED');
        const pack=encounterPack(row.packId),objectId=encounterId(a.objectId),text=encounterText(a.text,4000);
        vaultAssert(text.trim().length>0&&pack.notice.objects.some(o=>o.id===objectId),'INVALID_ENCOUNTER');
        const wardrobeId=a.wardrobeId===null?null:encounterId(a.wardrobeId);vaultAssert((pack.mechanic==='mummers'||wardrobeId===null)&&(!wardrobeId||context.wardrobeIds.includes(wardrobeId)),'INVALID_ENCOUNTER');
        next.answers=[...next.answers.filter(a=>!vaultPrincipalEqual(a.principal,scope)),{principal:actor,revision:expected+1,text,objectId,wardrobeId}].sort((a,b)=>a.principal.memberId.localeCompare(b.principal.memberId));changed();break;
      }
      case 'delete':vaultObject(input,['encounterId','action','id','expectedRevision']);vaultAssert(own&&own.revision===vaultInteger(v.expectedRevision,1),'ANSWER_CHANGED');next.answers=next.answers.filter(a=>!vaultPrincipalEqual(a.principal,scope));changed();break;
      case 'pause':case 'resume':{
        vaultObject(input,['encounterId','action','id']);if(v.action==='pause'&&next.paused.some(p=>vaultPrincipalEqual(p,scope)))return this.view(scope,row);
        next.paused=next.paused.filter(p=>!vaultPrincipalEqual(p,scope));if(v.action==='pause'){next.paused.push(actor);if(own)own.submitted=false;}next.paused.sort((a,b)=>a.memberId.localeCompare(b.memberId));changed();break;
      }
      case 'withdraw':vaultObject(input,['encounterId','action','id']);next.state='revoked';next.answers=[];next.consents=[];next.reviews=[];next.reveal=null;break;
      case 'review':{
        vaultObject(input,['encounterId','action','id','expectedRevision']);vaultAssert(own&&own.revision===vaultInteger(v.expectedRevision,1)&&!next.paused.some(p=>vaultPrincipalEqual(p,scope)),'ANSWER_CHANGED');
        // Random author-only tokens reveal no deterministic answer-state hash.
        // Other members' saves never change this token in an ordinary read.
        next.reviews=[...next.reviews.filter(r=>!vaultPrincipalEqual(r.principal,scope)),{principal:actor,challenge:crypto.randomUUID(),revision:own.revision,generation:next.generation}];break;
      }
      case 'reveal':{
        vaultObject(input,['encounterId','action','id','challenge','expectedRevision']);
        vaultAssert(own&&own.revision===vaultInteger(v.expectedRevision,1)&&!next.paused.some(p=>vaultPrincipalEqual(p,scope)),'ANSWER_CHANGED');
        const review=next.reviews.find(r=>vaultPrincipalEqual(r.principal,scope));vaultAssert(review&&v.challenge===review.challenge&&review.generation===next.generation&&review.revision===own.revision,'ANSWER_CHANGED');
        own.submitted=true;
        next.consents=[...next.consents.filter(c=>!vaultPrincipalEqual(c.principal,scope)),review];
        if(next.answers.length===2&&next.paused.length===0&&next.principals.every(p=>next.consents.some(c=>vaultPrincipalEqual(c.principal,p)&&c.generation===next.generation&&c.revision===next.answers.find(a=>vaultPrincipalEqual(a.principal,p))?.revision))){
          const answers=next.answers.map(a=>({memberId:a.principal.memberId,revision:a.revision,text:a.text,objectId:a.objectId,wardrobeId:a.wardrobeId}));
          const digest=await vaultDigest({version:1,encounterId:next.encounterId,packId:next.packId,generation:next.generation,answers,principals:next.principals});
          next.reveal={binding:{version:1,id:`reveal-${digest}`,encounterId:next.encounterId,packId:next.packId,generation:next.generation,digest},answers};
        }break;
      }
    }
    this.check(scope);
    // Hashing yields. A concurrent save or withdrawal must invalidate this review.
    this.storage.transaction(()=>{const latest=this.storage.get<Round>(key)!;vaultAssert(same(latest,row),'ANSWER_CHANGED');next.receipts.push({id:commandId,actor,hash:requestHash});this.storage.put(key,next);});
    return this.view(scope,next);
  }
  /** Trusted local evidence only, safe while the canonical writer is waiting. */
  async evidence(scope:VaultScope,raw:EncounterRevealBinding):Promise<EncounterRevealBinding>{
    const binding=decodeEncounterRevealBinding(raw),key=await keyFor(binding.encounterId);this.check(scope);const row=this.storage.get<Round>(key);
    vaultAssert(row&&row.state==='active'&&row.principals.some(p=>vaultPrincipalEqual(p,scope))&&row.reveal&&same(row.reveal.binding,binding),'REVEAL_REQUIRED');return binding;
  }
  async recheck(scope:VaultScope,view:EncounterPrivateView):Promise<void>{
    const row=this.storage.get<Round>(await keyFor(view.encounterId));this.check(scope);vaultAssert(row&&row.principals.some(p=>vaultPrincipalEqual(p,scope)),'ENCOUNTER_NOT_FOUND');
    // Never return a cached revealed body after an interleaved private edit/revoke.
    if(view.reveal)vaultAssert(row.state==='active'&&same(row.reveal,view.reveal),'ANSWER_CHANGED');
  }
}
