import {parseAmount} from '../core/catalog.ts';
import {addGoal} from '../core/commands.ts';
import {defaultGoalEnvelope,shapeGoalEnvelope} from '../core/goalEnvelopes.ts';
import {newKittyPiece} from '../core/kittyStudio.ts';
import {canonical} from '../ledgerSync/patch.ts';
import {vaultObject,vaultAssert} from './vaultContracts.ts';
import type {BankScope} from './bankReceipt.ts';
export type BankCreationContext={id:string;experienceId:string;experienceRevision:number;name:string;purpose:string};
export type BankCreationInput=Parameters<typeof addGoal>[1];
export type BankCreationReview={version:1;scope:BankScope;context:BankCreationContext|null;confirmationId:string;input:BankCreationInput;attempted:boolean;authority?:'ledger-v2'|'legacy'};
export type BankCreationStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export const bankCreationKey=(scope:BankScope,context?:BankCreationContext)=>`hearth:bank-create:${JSON.stringify([scope.identity,scope.environment,scope.householdId,scope.memberId,context?.id??null])}`;
export function newBankEnvelope(purpose='') {return {...defaultGoalEnvelope(),purpose,studio:{version:1 as const,draft:newKittyPiece(crypto.randomUUID().slice(0,8),new Date().toISOString(),'cream'),fired:[]}};}
export function decodeBankCreationReview(raw:unknown,scope:BankScope,context?:BankCreationContext):BankCreationReview{
 const r=vaultObject(raw,['version','scope','context','confirmationId','input','attempted','authority']);
 vaultAssert(r.version===1&&canonical(r.scope)===canonical(scope)&&canonical(r.context)===canonical(context??null)&&typeof r.confirmationId==='string'&&/^[0-9a-f-]{36}$/i.test(r.confirmationId)&&typeof r.attempted==='boolean','BANK_REVIEW_SCOPE_MISMATCH');
 vaultAssert(r.authority===undefined||r.authority==='ledger-v2'||r.authority==='legacy','BANK_REVIEW_INVALID');
 const i=vaultObject(r.input,['name','target','shared','ownerMemberId','envelope']),envelope=shapeGoalEnvelope(i.envelope);
 vaultAssert(typeof i.name==='string'&&i.name.trim().length>0&&i.name.length<=100&&typeof i.target==='string'&&i.target.length<=30&&parseAmount(i.target,'Target')>0&&typeof i.shared==='boolean'&&(i.shared?i.ownerMemberId===null:i.ownerMemberId===scope.memberId)&&envelope&&!envelope.designRef&&envelope.archivedAt===null&&canonical(envelope)===canonical(i.envelope),'BANK_REVIEW_INVALID');
 return {version:1,scope,context:context??null,confirmationId:r.confirmationId,input:{name:i.name,target:i.target,shared:i.shared,ownerMemberId:i.ownerMemberId as string|null,envelope},attempted:r.attempted,...(r.authority?{authority:r.authority as 'ledger-v2'|'legacy'}:{})};
}
export function readBankCreation(storage:BankCreationStorage,scope:BankScope,context?:BankCreationContext):BankCreationReview|null{
 const raw=storage.getItem(bankCreationKey(scope,context));if(raw===null)return null;if(raw.length>128*1024)throw Error('BANK_REVIEW_INVALID');return decodeBankCreationReview(JSON.parse(raw),scope,context);
}
export function saveBankCreation(storage:BankCreationStorage,review:BankCreationReview):void{
 const value=decodeBankCreationReview(review,review.scope,review.context??undefined);storage.setItem(bankCreationKey(review.scope,review.context??undefined),JSON.stringify(value));
}
