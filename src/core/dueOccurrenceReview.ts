import type {Household,Account} from './types.ts';
import {canonical} from '../ledgerSync/patch.ts';
import {formatCad} from './money.ts';
export type DueOccurrenceRequest={environment:Household['environment'];householdId:string;memberId:string;view:'household'|'personal';recurrenceId:string;occurrenceDate:string;today:string};
export type DueOccurrenceReview={kind:'ready';request:DueOccurrenceRequest;basis:string;title:string;detail:string;type:'expense'|'income'|'transfer';amountCents:number;occurrenceDate:string}|{kind:'unavailable';reason:string};
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const shared=(a:Account|undefined)=>!!a&&a.active&&a.currency==='CAD'&&a.scope!=='personal';
/** Exact reviewed occurrence, without changing its schedule or any books. */
export function dueOccurrenceReview(h:Household,r:DueOccurrenceRequest):DueOccurrenceReview{
 const unavailable=(reason:string):DueOccurrenceReview=>({kind:'unavailable',reason});
 if(!r||r.environment!==h.environment||r.householdId!==h.householdId||!['household','personal'].includes(r.view)||!date(r.today)||!date(r.occurrenceDate)||!h.members.some(m=>m.id===r.memberId&&m.active))return unavailable('The ledger view changed. Open this reminder again.');
 const item=h.recurrences.find(x=>x.id===r.recurrenceId&&x.active);
 if(!item||item.nextDate!==r.occurrenceDate||item.nextDate>r.today)return unavailable('This occurrence changed or is no longer due. Review the current reminder.');
 if(!Number.isSafeInteger(item.amountCents)||item.amountCents<=0)return unavailable('This occurrence needs a valid positive amount.');
 const account=h.accounts.find(x=>x.id===item.accountId),destination=item.type==='transfer'?h.accounts.find(x=>x.id===item.transferToAccountId):null;
 if(!shared(account)||(item.type==='transfer'&&!shared(destination??undefined)))return unavailable('Review this account in Calendar. This posting path requires active Shared CAD accounts.');
 const category=item.type==='transfer'?null:h.categories.find(x=>x.id===item.subcategoryId),parent=category?h.categories.find(x=>x.id===category.parentId):null;
 if(item.type!=='transfer'&&(!category?.active||category.recordType!=='category'||category.transactionType!==item.type||!parent?.active||parent.recordType!=='group'||parent.transactionType!==item.type))return unavailable('The category changed. Review it in Calendar.');
 const goal=item.goalId?h.goals.find(x=>x.id===item.goalId):null;
 if(item.goalId&&(item.type!=='transfer'||!goal?.shared||goal.status!=='open'||goal.retiredAt||goal.purchaseId))return unavailable('Review this goal in Calendar before posting.');
 const closed=h.kitchen.books.closedMonths.find(x=>x.monthKey===item.nextDate.slice(0,7));
 if(closed)return unavailable('This occurrence belongs to closed Books. Review the closed period first.');
 const effectiveSplits=item.type==='transfer'?[{party:'joint',amountCents:item.amountCents}]:item.splits;
 const members=effectiveSplits.filter(x=>x.party!=='joint').map(x=>h.members.find(m=>m.id===x.party));
 if(members.some(x=>!x?.active))return unavailable('The split participants changed. Review this item in Calendar.');
 const funding=item.type==='expense'?item.fundingDefault:null,fund=funding?h.householdFund:null,fundDestination=funding?h.accounts.find(x=>x.id===funding.destinationAccountId):null;
 const funded=funding?.fundedCents==='full'?item.amountCents:funding?.fundedCents;
 if(funding&&(!fund||fund.id!==funding.fundId||fund.custodianMemberId!==r.memberId||!shared(fundDestination??undefined)||!Number.isSafeInteger(funded)||!funded||funded<0||funded>item.amountCents))return unavailable('Review the Fund funding and destination in Calendar.');
 const title=item.note.trim()||category?.name||'Repeating item';
 const detail=[`Shared · ${item.nextDate} · ${formatCad(item.amountCents)}`,item.type==='transfer'?`${account!.name} → ${destination!.name} · transfer, never income`:`${account!.name} · ${category!.name} · ${item.type}`,goal?`Goal: ${goal.name}`:'',funding?`Fund funding: ${formatCad(funded!)} → ${fundDestination!.name}`:'',effectiveSplits.length?`Split: ${effectiveSplits.map(x=>`${x.party==='joint'?'Joint':members.find(m=>m?.id===x.party)?.name??'Member'} ${formatCad(x.amountCents)}`).join(' · ')}`:'','Posts this occurrence once, then advances the reminder.'].filter(Boolean).join('\n');
 return {kind:'ready',request:r,title,detail,type:item.type,amountCents:item.amountCents,occurrenceDate:item.nextDate,basis:canonical([r,item,account,destination,category,parent,goal,members,fund,fundDestination,closed??null])};
}
export function reviewedDueRequest(value:unknown,recurrenceId:unknown,today:unknown,actor:unknown,allowNotDue?:unknown):DueOccurrenceRequest{
 if(!value||typeof value!=='object'||Array.isArray(value)||allowNotDue)throw Error('INVALID_DUE_REVIEW');
 const r=value as DueOccurrenceRequest;
 if(r.recurrenceId!==recurrenceId||r.today!==today||r.memberId!==actor||typeof r.householdId!=='string'||typeof r.memberId!=='string')throw Error('INVALID_DUE_REVIEW');
 return r;
}
const key=(r:DueOccurrenceRequest)=>`hearth-due-row:${canonical([r.environment,r.householdId,r.memberId,r.view,r.recurrenceId,r.occurrenceDate,r.today])}`;
export function dueOccurrenceHidden(r:DueOccurrenceRequest):boolean{try{return localStorage.getItem(key(r))==='1';}catch{return false;}}
export function hideDueOccurrence(r:DueOccurrenceRequest):void{try{localStorage.setItem(key(r),'1');}catch{/* Local preference remains optional. */}}
