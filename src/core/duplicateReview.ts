import { isMonthClosed } from "./statements.ts";
import { canonical } from "../ledgerSync/patch.ts";
import { booksPresentationFloor } from "./ledgerExperience.ts";
import { projectedCountable } from "./budget.ts";
import { workShiftTransactionIds } from "./work.ts";
import type { Environment, Household, LedgerView, Transaction } from "./types.ts";

export type DuplicateReviewRequest = Readonly<{
  environment: Environment; householdId: string; memberId: string; view: LedgerView;
  targetId: string; isDuplicate: boolean; comparisonIds: readonly string[];
}>;
export type DuplicateReview = {kind:"unavailable";reason:string} | {
  kind:"ready";basis:string;request:DuplicateReviewRequest;target:Transaction;
  changes:readonly {id:string;date:string;wasCounted:boolean;willCount:boolean}[];
  targetWillCount:boolean;
};
const refuse=(reason:string):DuplicateReview=>({kind:"unavailable",reason});
const links=(tx:Transaction)=>[tx.transferPairId,tx.reversalOfId,tx.refundOfId].filter((id):id is string=>!!id);

/** Review recognition effects without mutating flags or auxiliary source records. */
export function prepareDuplicateReview(h:Household,request:DuplicateReviewRequest):DuplicateReview {
  if(h.environment!==request.environment || h.householdId!==request.householdId || !h.members.some(m=>m.id===request.memberId&&m.active)) return refuse("These entries belong to another ledger or member.");
  const byId=new Map(h.transactions.map(tx=>[tx.id,tx]));
  if(byId.size!==h.transactions.length)return refuse("The source IDs need review before changing recognition.");
  const visible=new Map(booksPresentationFloor(h,request.memberId,request.view).transactions.map(tx=>[tx.id,tx]));
  const ids=[...new Set([request.targetId,...request.comparisonIds])];
  if(ids.some(id=>!visible.has(id)))return refuse("An original entry is unavailable in this view. Review its source first.");
  const target=byId.get(request.targetId)!;
  if(target.isDuplicate===request.isDuplicate)return refuse(`This entry is already ${request.isDuplicate?"flagged as excluded":"unflagged"}. Review the current entries.`);
  const neighbors=new Map<string,Set<string>>();
  const connect=(a:string,b:string)=>{if(!neighbors.has(a))neighbors.set(a,new Set());neighbors.get(a)!.add(b);};
  for(const tx of h.transactions)for(const id of links(tx)){connect(tx.id,id);connect(id,tx.id);}
  const related=new Set<string>([request.targetId]),queue=[request.targetId];
  for(let i=0;i<queue.length;i++)for(const id of neighbors.get(queue[i]!)??[]){if(!related.has(id)){related.add(id);queue.push(id);}}
  if([...related].some(id=>!byId.has(id)))return refuse("A linked source is missing. Review the original records before changing recognition.");
  if([...related].some(id=>!visible.has(id)))return refuse("Linked records are outside this view. Review them in their own ledger first.");
  const graph=[...related].sort().map(id=>byId.get(id)!);
  for(const tx of graph){
    if(tx.type==="transfer" || tx.transferPairId){
      const pair=tx.transferPairId ? byId.get(tx.transferPairId) : undefined;
      if(tx.type!=="transfer" || !pair || pair.type!=="transfer" || pair.transferPairId!==tx.id
        || pair.amountCents!==tx.amountCents || pair.date!==tx.date
        || pair.transferFromAccountId!==tx.transferFromAccountId || pair.transferToAccountId!==tx.transferToAccountId
        || !tx.transferFromAccountId || !tx.transferToAccountId
        || !h.accounts.some(a=>a.id===tx.transferFromAccountId) || !h.accounts.some(a=>a.id===tx.transferToAccountId)
        || ![tx.transferFromAccountId,tx.transferToAccountId].includes(tx.accountId)
        || ![tx.transferFromAccountId,tx.transferToAccountId].includes(pair.accountId) || tx.accountId===pair.accountId)
        return refuse("The transfer links need review before changing recognition.");
    }
    let row:Transaction|undefined=tx;const seen=new Set<string>();
    while(row){if(seen.has(row.id))return refuse("The correction links need review before changing recognition.");seen.add(row.id);row=row.reversalOfId?byId.get(row.reversalOfId):undefined;}
  }
  const touches=(id:string|null|undefined)=>!!id&&related.has(id);
  if(graph.some(tx=>tx.funding) || (h.fundEvents??[]).some(e=>e.relatedTransactionIds.some(touches)) || (h.fundSettlementAllocations??[]).some(a=>touches(a.transactionId))) return refuse("These entries are linked to the Fund. Review the Fund correction; a duplicate flag cannot correct its accepted events.");
  const accounts=h.accounts.filter(a=>graph.some(tx=>[tx.accountId,tx.transferFromAccountId,tx.transferToAccountId].includes(a.id)));
  if((h.goalContributions??[]).some(c=>touches(c.transferId)) || (h.goalPurchases??[]).some(p=>p.transactionIds.some(touches)) || accounts.some(a=>a.savings?.purpose==="goals"||a.id==="ACC-GOALS")) return refuse("These entries are linked to a goal. Review the goal funding or purchase; a duplicate flag cannot correct its progress.");
  if(graph.some(tx=>tx.source==="shift"||tx.subcategoryId==="SUB-WORK-TIP-OUTS") || h.shifts.some(s=>workShiftTransactionIds(s).some(touches)))return refuse("These entries are linked to Work. Review the shift or tip-out payment; a duplicate flag cannot correct its receipt.");
  if(graph.some(tx=>tx.source==="visit") || accounts.some(a=>a.kind==="receivable") || h.claims.some(c=>[c.expenseTransactionId,c.recoveryTransactionId,c.writeOffTransactionId,...c.settleTransferIds].some(touches)))return refuse("These entries are linked to a visit or claim. Review that source; a duplicate flag cannot correct its status.");
  const changed=new Map(byId);changed.set(target.id,{...target,isDuplicate:request.isDuplicate});
  const changes=graph.flatMap(tx=>{const wasCounted=projectedCountable(tx,byId),willCount=projectedCountable(changed.get(tx.id)!,changed);return wasCounted===willCount?[]:[{id:tx.id,date:tx.date,wasCounted,willCount}];});
  if ([target.date,...changes.map(row=>row.date)].some(date=>isMonthClosed(h,date.slice(0,7)))) return refuse("This change reaches a closed month. Reopen it in Books before changing inclusion.");
  const evidence=ids.sort().map(id=>visible.get(id)!);
  const ordered=<T extends {id:string}>(rows:T[])=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
  const basis=canonical([{...request,comparisonIds:[...request.comparisonIds].sort()},graph,evidence,ordered(accounts),ordered(h.accounts.filter(a=>evidence.some(tx=>tx.accountId===a.id))),ordered(h.members.filter(m=>m.id===request.memberId||[...graph,...evidence].some(tx=>tx.createdBy===m.id))),ordered(h.categories.filter(c=>[...graph,...evidence].some(tx=>tx.categoryId===c.id||tx.subcategoryId===c.id)))]);
  return {kind:"ready",basis,request:{...request,comparisonIds:[...request.comparisonIds]},target:{...target},changes,targetWillCount:projectedCountable(changed.get(target.id)!,changed)};
}

/** The reviewed wire form contains identifiers only; private comparison facts stay behind resource hashes. */
export function reviewedDuplicateRequest(value:unknown,targetId:unknown,isDuplicate:unknown):DuplicateReviewRequest {
  const raw=value as {request?:DuplicateReviewRequest}|null;
  const r=raw?.request;
  const id=(v:unknown)=>typeof v==="string"&&v.length>0&&v.length<=512;
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||!r||typeof r!=="object"||Array.isArray(r)
    || !["development","production"].includes(r.environment) || !["household","personal"].includes(r.view)
    || !id(r.householdId)||!id(r.memberId)||!id(r.targetId)||typeof r.isDuplicate!=="boolean"
    || !Array.isArray(r.comparisonIds)||r.comparisonIds.length>64||!r.comparisonIds.every(id)
    || targetId!==r.targetId||isDuplicate!==r.isDuplicate)throw Error("INVALID_DUPLICATE_REVIEW");
  return r;
}
