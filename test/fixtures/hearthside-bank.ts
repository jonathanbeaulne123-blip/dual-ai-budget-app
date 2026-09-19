import {catalogHousehold,type Household,type CommitResult} from '../../src/core/index.ts';
import {splitForSync} from '../../src/core/sync.ts';
import {capturedIntent} from '../../src/ledgerSync/capture.ts';
import {commandFromCapture,type Scope} from '../../src/ledgerSync/protocol.ts';
import {prepareCommand,type AuthorityState} from '../../src/ledgerSync/authority.ts';
import {emptyHearthside,type SharedExperience} from '../../src/hearthside/contracts.ts';
import type {KittyAcceptedCommand} from '../../src/hearthside/bankReceipt.ts';
import type {KittyCommandOptions} from '../../src/kitty/KittyBankRoom.tsx';
export const bankExperience:SharedExperience={version:1,id:'EXP-slow',revision:1,title:'A slow weekend',intention:'Breakfast, a walk and time together.',state:'dreaming',horizon:'season',createdBy:'MEM-001',references:[]};
export class BankTestAuthority{
 h:Household;state:AuthorityState;scope:Scope;receipts=new Map<string,KittyAcceptedCommand['receipt']>();calls:{id:string;kind:string}[]=[];hideCreation=false;hideLink=false;rejectLink=false;onAccepted=()=>{};
 constructor(){this.h=catalogHousehold();this.h.hearthside={...emptyHearthside(),experiences:[structuredClone(bankExperience)]};const h=this.h,parts=splitForSync(h,'MEM-001');this.state={sequence:h.revision,shared:parts.shared,personal:new Map(h.members.map(m=>[m.id,splitForSync(h,m.id).personal]))};this.scope={environment:h.environment,householdId:h.householdId,memberId:'MEM-001',subject:'synthetic-user',role:'owner',aclEpoch:1,expires:Date.now()+60000};}
 command=async(fn:(h:Household)=>CommitResult,options?:KittyCommandOptions)=>{if(!options?.confirmationId)throw Error('CONFIRMATION_REQUIRED');const id=options.confirmationId;if(this.receipts.has(id)){options.onRecoveredConfirmation?.();return null;}const preview=fn(this.h),capture=capturedIntent(preview.household)!;const kind=capture.steps[0]!.kind;this.calls.push({id,kind});if(kind==='commitHearthside'&&this.rejectLink){options.onDefinitiveRejected?.();return null;}const command=await commandFromCapture(capture,this.scope,id),accepted=await prepareCommand(this.state,command,this.scope,()=>{});this.h=accepted.household;this.state={sequence:accepted.receipt.sequence,shared:accepted.shared,personal:new Map([...this.state.personal,[this.scope.memberId,accepted.personal]])};this.receipts.set(id,accepted.receipt);this.onAccepted();return null;};
 reader=async(id:string,signal?:AbortSignal):Promise<KittyAcceptedCommand|null>=>{if(signal?.aborted)throw Error('SCOPE_CLOSED');const receipt=this.receipts.get(id);if(!receipt||receipt.commandKind==='addGoal'&&this.hideCreation||receipt.commandKind==='hearthside'&&this.hideLink)return null;return{environment:this.h.environment,householdId:this.h.householdId,memberId:this.scope.memberId,receipt,household:this.h};};
 status=async(id:string):Promise<'accepted'|'missing'>=>this.receipts.has(id)?'accepted':'missing';
}
