import type {Account,Household} from './types.ts';
import {booksPresentationFloor} from './ledgerExperience.ts';
import {claimPublicLabel,claimRemainingCents} from './appointments.ts';
import {isValidDateKey} from './calendar.ts';
import {parseAmount} from './catalog.ts';
import {formatCad} from './money.ts';
import {canonical} from '../ledgerSync/patch.ts';
export type ClaimSettlementRequest={environment:Household['environment'];householdId:string;memberId:string;view:'household'|'personal';claimId:string;toAccountId:string;date:string;amountCents:number};
export type ClaimSettlementReview={kind:'ready';request:ClaimSettlementRequest;basis:string;label:string;detail:string}|{kind:'unavailable';reason:string};
const shared=(account:Account|undefined)=>!!account&&account.active&&account.scope!=='personal'&&account.currency==='CAD';
/** Read the recorded claim graph; never infer corrected counters or receive money. */
export function claimSettlementReview(h:Household,r:ClaimSettlementRequest):ClaimSettlementReview{
 const fail=(reason:string):ClaimSettlementReview=>({kind:'unavailable',reason});
 if(!r||r.environment!==h.environment||r.householdId!==h.householdId||!['household','personal'].includes(r.view)||typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!isValidDateKey(r.date)||!h.members.some(m=>m.id===r.memberId&&m.active))return fail('The ledger view changed. Open this claim again.');
 const claim=h.claims.find(c=>c.id===r.claimId);
 if(!claim||!booksPresentationFloor(h,r.memberId,r.view).claims.some(c=>c.id===claim.id))return fail('This claim is not available in this view.');
 const remaining=claimRemainingCents(claim);
 if(!Number.isSafeInteger(r.amountCents)||r.amountCents<=0||r.amountCents!==remaining||![claim.expectedCents,claim.receivedCents,claim.writtenOffCents].every(x=>Number.isSafeInteger(x)&&x>=0)||claim.receivedCents+claim.writtenOffCents>claim.expectedCents)return fail('The amount still owing changed. Open this claim again.');
 const byId=new Map(h.transactions.map(tx=>[tx.id,tx])),expense=byId.get(claim.expenseTransactionId),recovery=claim.recoveryTransactionId?byId.get(claim.recoveryTransactionId):null;
 const receivable=h.accounts.find(a=>a.id===claim.receivableAccountId),destination=h.accounts.find(a=>a.id===r.toAccountId);
 if(!shared(receivable)||!shared(destination)||receivable!.kind!=='receivable'||destination!.kind==='receivable'||destination!.id===receivable!.id)return fail('Review the receiving account. This settlement path requires active Shared CAD accounts.');
 const rootAccount=expense?h.accounts.find(a=>a.id===expense.accountId):null;
 if(!expense||expense.type!=='expense'||!shared(rootAccount??undefined)||expense.visibility==='personal'||!recovery||recovery.type!=='refund'||recovery.accountId!==receivable!.id||recovery.refundOfId!==expense.id||recovery.amountCents!==claim.expectedCents)return fail('The claim’s original expense or recovery needs review in Books.');
 const knownIds=new Set([claim.expenseTransactionId,claim.recoveryTransactionId,...claim.settleTransferIds,claim.writeOffTransactionId].filter((id):id is string=>!!id));
 const linked=h.transactions.filter(tx=>knownIds.has(tx.id)||tx.sourceId===claim.id);
 const graphIds=new Set(linked.map(tx=>tx.id));
 for(const tx of h.transactions)if(tx.transferPairId&&graphIds.has(tx.transferPairId)&&!graphIds.has(tx.id)||tx.reversalOfId&&graphIds.has(tx.reversalOfId)||tx.refundOfId&&graphIds.has(tx.refundOfId)&&tx.id!==recovery.id)return fail('A correction touches this claim. Review its history in Books first.');
 if([...knownIds].some(id=>!byId.has(id))||linked.some(tx=>tx.isDuplicate||tx.reversalOfId||tx.source==='reversal'||tx.visibility==='personal'||typeof tx.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(tx.date)||!isValidDateKey(tx.date)||tx.date>r.date||tx.currency!=='CAD'||!Number.isSafeInteger(tx.amountCents)||tx.amountCents<=0||!shared(h.accounts.find(a=>a.id===tx.accountId))))return fail('The claim’s recorded history needs review in Books.');
 const settlements=claim.settleTransferIds.map(id=>byId.get(id)!);let received=0;
 if(new Set(claim.settleTransferIds).size!==claim.settleTransferIds.length)return fail('The settlement history contains repeated entries.');
 for(const tx of settlements){const mate=tx.transferPairId?byId.get(tx.transferPairId):null;if(tx.type!=='transfer'||!mate||!claim.settleTransferIds.includes(mate.id)||mate.transferPairId!==tx.id||mate.amountCents!==tx.amountCents||mate.date!==tx.date||tx.transferFromAccountId!==receivable!.id||mate.transferFromAccountId!==receivable!.id||tx.transferToAccountId!==mate.transferToAccountId||tx.accountId===mate.accountId)return fail('A settlement pair needs review in Books.');if(tx.accountId===receivable!.id){if(mate.accountId!==tx.transferToAccountId)return fail('The receiving leg needs review in Books.');received+=tx.amountCents;}else if(tx.accountId!==tx.transferToAccountId||mate.accountId!==receivable!.id)return fail('The settlement direction needs review in Books.');}
 const writeOffs=linked.filter(tx=>tx.id!==expense.id&&tx.type==='expense'&&tx.accountId===receivable!.id&&tx.sourceId===claim.id);
 if(received!==claim.receivedCents||writeOffs.reduce((sum,tx)=>sum+tx.amountCents,0)!==claim.writtenOffCents)return fail('Claim counters and recorded history disagree. Review Books first.');
 const allowed=new Set([expense.id,recovery.id,...settlements.map(tx=>tx.id),...writeOffs.map(tx=>tx.id)]);
 if(linked.some(tx=>!allowed.has(tx.id)))return fail('This claim has additional linked entries to review in Books.');
 const closed=h.kitchen.books.closedMonths.find(p=>p.monthKey===r.date.slice(0,7));if(closed)return fail('The posting month is closed. Review Books first.');
 const appointment=claim.appointmentId?h.appointments.find(a=>a.id===claim.appointmentId):null;
 const label=claimPublicLabel(h,claim,'card'),detail=`${label}\nShared · ${r.date}\n${formatCad(r.amountCents)} from ${receivable!.name} to ${destination!.name}.\nThis records the money received as a transfer, never income. It settles the reviewed remainder.`;
 const accounts=h.accounts.filter(a=>new Set([...linked.map(tx=>tx.accountId),r.toAccountId]).has(a.id)).sort((a,b)=>a.id.localeCompare(b.id));
 return {kind:'ready',request:r,label,detail,basis:canonical([r,claim,appointment,linked.slice().sort((a,b)=>a.id.localeCompare(b.id)),accounts,closed??null])};
}
export function reviewedClaimInput(h:Household,input:unknown):Extract<ClaimSettlementReview,{kind:'ready'}>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_CLAIM_REVIEW');const i=input as Record<string,unknown>,r=i.claimReview as ClaimSettlementRequest;
 if(!r||typeof r!=='object'||r.claimId!==i.claimId||r.toAccountId!==i.toAccountId||r.date!==i.date||r.memberId!==i.createdBy||i.visibility!=='household'||i.amount===undefined||parseAmount(i.amount as string|number)!==r.amountCents)throw Error('INVALID_CLAIM_REVIEW');
 const review=claimSettlementReview(h,r);if(review.kind!=='ready')throw Error(review.reason);return review;
}
