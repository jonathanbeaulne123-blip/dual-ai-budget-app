import {canonical} from '../ledgerSync/patch.ts';
import type {Goal,Household,LedgerView} from '../core/types.ts';
import type {Receipt} from '../ledgerSync/protocol.ts';
export type BankScope={identity:string;environment:Household['environment'];householdId:string;memberId:string};
export type KittyAcceptedCommand={environment:Household['environment'];householdId:string;memberId:string;receipt:Receipt;household:Household};
export type KittyAcceptedCommandReader=(id:string,signal?:AbortSignal)=>Promise<KittyAcceptedCommand|null>;
export function validateBankReceipt(value:KittyAcceptedCommand,id:string,scope:BankScope,kind:string):void{
 const {receipt:r,household:h}=value;
 if(value.environment!==scope.environment||value.householdId!==scope.householdId||value.memberId!==scope.memberId||h.environment!==scope.environment||h.householdId!==scope.householdId||!h.members.some(m=>m.id===scope.memberId&&m.active)||r.id!==id||r.actor!==scope.memberId||r.commandKind!==kind||!Number.isSafeInteger(r.sequence)||r.sequence<0||h.revision<r.sequence)throw Error('BANK_RECEIPT_SCOPE_MISMATCH');
}
export function acceptedCreatedBank(value:KittyAcceptedCommand,id:string,scope:BankScope,view:LedgerView){
 validateBankReceipt(value,id,scope,'addGoal');const ids=value.receipt.postedIds;
 if(!Array.isArray(ids)||ids.length!==1||typeof ids[0]!=='string')throw Error('BANK_CREATION_RECEIPT_REQUIRED');
 const goal=value.household.goals.find(g=>g.id===ids[0]);
 if(!goal||(view==='household'?!goal.shared:goal.shared||goal.ownerMemberId!==scope.memberId))throw Error('BANK_CREATION_RECEIPT_REQUIRED');
 return goal!;
}

/** Only the bank meaning shown in a connection review; painting is independent. */
export function bankLinkBasis(goal:Goal):string{return canonical({id:goal.id,name:goal.name,targetCents:goal.targetCents,purpose:goal.envelope?.purpose??'',shared:goal.shared,ownerMemberId:goal.ownerMemberId,archivedAt:goal.envelope?.archivedAt??null,status:goal.status});}
