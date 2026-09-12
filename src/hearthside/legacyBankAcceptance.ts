import type {CommandOutcome} from '../core/commandOutcome.ts';
import type {Household,LedgerView} from '../core/types.ts';
import {parseAmount} from '../core/catalog.ts';
import type {BankScope} from './bankReceipt.ts';
import type {BankCreationInput} from './bankCreation.ts';

/** Match App's writer selection, not whether a v2 connection happens to be open. */
export function kittyUsesLedgerReceipts(v2Enabled:boolean,household:Pick<Household,'linked'>|null,localIdentity:string|null):boolean{return v2Enabled&&Boolean(household?.linked||localIdentity);}
/** A normal legacy acceptance record, never a synthesized LedgerRoom receipt. */
export function legacyCreatedBank(h:Household,id:string,scope:BankScope,view:LedgerView,input:BankCreationInput){
 if(h.environment!==scope.environment||h.householdId!==scope.householdId||!h.members.some(m=>m.active&&m.id===scope.memberId))throw Error('BANK_RECEIPT_SCOPE_MISMATCH');
 const receipt=h.commandReceipts.find(r=>r.confirmationId===id);if(!receipt)return null;
 const goal=receipt.postedIds.length===1?h.goals.find(g=>g.id===receipt.postedIds[0]):undefined;
 // Older App writes record the undo label (the reviewed name) as commandKind.
 const legacyLabel=receipt.commandKind===input.name.trim();
 if(!goal||receipt.revision>h.revision||receipt.commandKind!=='addGoal'&&!legacyLabel||(view==='household'?!goal.shared:goal.shared||goal.ownerMemberId!==scope.memberId))throw Error('BANK_CREATION_RECEIPT_REQUIRED');
 if(legacyLabel&&(goal.name!==input.name.trim()||goal.targetCents!==parseAmount(input.target,'Target')||!input.envelope?.studio?.draft?.id||goal.envelope?.studio?.draft?.id!==input.envelope.studio.draft.id))throw Error('BANK_CREATION_RECEIPT_REQUIRED');
 return goal;
}
export function acceptedLegacyCreatedBank(raw:unknown,id:string,scope:BankScope,view:LedgerView,input:BankCreationInput){
 const value=raw as CommandOutcome|null;
 if(!value||!value.ok||!['accepted-local','pending-transport','synchronized'].includes(value.kind)||value.confirmationId!==id||!value.household)throw Error('BANK_ACCEPTANCE_NOT_CONFIRMED');
 const goal=legacyCreatedBank(value.household,id,scope,view,input);
 if(!goal||value.postedIds.length!==1||value.postedIds[0]!==goal.id||value.previous?.goals.some(g=>g.id===goal.id)&&value.duplicateOfReceiptId!==id)throw Error('BANK_CREATION_RECEIPT_REQUIRED');
 return goal;
}
