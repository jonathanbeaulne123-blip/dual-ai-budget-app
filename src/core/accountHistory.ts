import { captureCommand } from '../ledgerSync/capture.ts';
import { sha256String } from './synchronousHash.ts';
import { canonical } from '../ledgerSync/patch.ts';
import { isLiabilityKind } from './accountKinds.ts';
import { isValidDateKey, type DateKey } from './calendar.ts';
import { postEntry, postTransfer } from './commands.ts';
import { duplicateKey } from './duplicate.ts';
import { ensureHouseholdShape } from './sync.ts';
import { cloneHousehold } from './household.ts';
import { nextId, nowIso } from './ids.ts';
import { bookBalanceAsOf } from './statements.ts';
import { JOINT, ValidationError, type Household, type Transaction, type CommitResult } from './types.ts';

export type AccountOpeningCheckpoint = {
  id: string; accountId: string; date: DateKey; signedBalanceCents: number;
  statementClosingDate?: DateKey; statementClosingBalanceCents?: number;
  statementCoverage?: {start:string;end:string}[];
  transactionId: string | null; confirmationId: string; visibility: 'household' | 'personal';
  ownerMemberId: string | null; createdBy: string; createdAt: string; updatedAt: string; supersedesId?: string;
};
export type AccountHistoryReviewRecord = {id:string;review:AccountHistoryReview;visibility:'household'|'personal';ownerMemberId:string|null;updatedAt:string};
export type AccountHistoryApproval = {
  id: string; digest: string; memberId: string; visibility: 'household' | 'personal';
  ownerMemberId: string | null; updatedAt: string;
};
export type AccountHistoryRow = {
  sourceIdentity: string; sourceHash: string; date: string; accountId: string;
  type: 'income' | 'expense' | 'refund' | 'transfer'; amountCents: number;
  subcategoryId?: string; toAccountId?: string; note: string;
  transferGroupIdentity?: string;
  transferSources?: {accountId:string;sourceIdentity:string;sourceHash:string}[];
  decision: 'post' | 'retain'; retainedTransactionId?: string;
};
export type AccountHistoryInput = {
  createdBy: string; visibility: 'household' | 'personal';
  accounts: { accountId: string; openingDate: string; openingBalanceCents: number; closingDate: string; closingBalanceCents: number; checkpoints?:{date:string;balanceCents:number}[]; coverage?:{start:string;end:string}[] }[];
  rows: AccountHistoryRow[];
};
export type AccountHistoryReview = AccountHistoryInput & {
  version: 1; householdId: string; environment: Household['environment']; mode: 'fresh' | 'rebase';
  stateFingerprint: string; digest: string;
};
const fail = (text: string): never => { throw new ValidationError(text); };
const inScope = (a: Household['accounts'][number], visibility: 'household' | 'personal', memberId?: string) =>
  visibility === 'personal' ? a.scope === 'personal' && a.ownerMemberId === memberId : a.scope !== 'personal';
function activeOpeningRows(h: Household, accountId: string) {
  const account = h.accounts.find(a => a.id === accountId);
  // Opening coverage is scoped evidence. A private row (including a private
  // reversal reference) must never alter the Shared completion fact.
  const scoped = h.transactions.filter(t => t.accountId === accountId && (account?.scope === 'personal'
    ? t.visibility === 'personal' && t.createdBy === account.ownerMemberId
    : t.visibility !== 'personal'));
  const reversed = new Set(scoped.filter(t => t.reversalOfId).map(t => t.reversalOfId));
  return scoped.filter(t => t.type === 'opening' && t.source === 'opening' && !t.reversalOfId && !t.isDuplicate && !reversed.has(t.id));
}
/** Positive is an asset; negative is a debt, independently of the account's usual side. */
export function economicAccountBalanceAsOf(h: Household, accountId: string, date: string): number {
  const a = h.accounts.find(a => a.id === accountId)!;
  return bookBalanceAsOf(h, accountId, date as DateKey) * (isLiabilityKind(a.kind) ? -1 : 1);
}
export function acceptedAccountOpeningCoverage(h: Household, scope: { visibility: 'household' | 'personal'; memberId?: string }) {
  const checkpoints: AccountOpeningCheckpoint[] = [], missingAccountIds: string[] = [];
  for (const a of h.accounts.filter(a => a.active && inScope(a, scope.visibility, scope.memberId))) {
    const candidates = (h.accountOpeningCheckpoints ?? []).filter(c => c.accountId === a.id && c.visibility === scope.visibility && (scope.visibility !== 'personal' || c.ownerMemberId === scope.memberId));
    const superseded = new Set(candidates.map(c => c.supersedesId));
    const live = activeOpeningRows(h, a.id);
    const cp = candidates.find(c => !superseded.has(c.id) && (c.transactionId === null ? c.signedBalanceCents === 0 : live.some(t => t.id === c.transactionId)));
    if (cp) checkpoints.push(cp);
    else if (live.length === 1) {
      const t = live[0]!;
      checkpoints.push({ id: `legacy:${t.id}`, accountId: a.id, date: t.date,
        signedBalanceCents: t.openingSignedBalanceCents ?? t.amountCents * (isLiabilityKind(a.kind) ? -1 : 1),
        transactionId: t.id, confirmationId: t.sourceId!, visibility: scope.visibility,
        ownerMemberId: scope.visibility === 'personal' ? a.ownerMemberId : null,
        createdBy: t.createdBy, createdAt: t.createdAt, updatedAt: t.updatedAt });
    } else missingAccountIds.push(a.id);
  }
  return { complete: checkpoints.length > 0 && missingAccountIds.length === 0, missingAccountIds, checkpoints };
}
function requireDate(h: Household, date: string) {
  if (!isValidDateKey(date)) fail('Choose a valid Toronto civil date.');
  if (h.kitchen.books.closedMonths.some(p => p.monthKey === date.slice(0, 7))) fail(`${date.slice(0, 7)} is closed. Reopen that month from Books before reviewing history.`);
}
function inputOnly(r: AccountHistoryInput): AccountHistoryInput {
  return { createdBy: r.createdBy, visibility: r.visibility, accounts: structuredClone(r.accounts), rows: structuredClone(r.rows) };
}
function ownsSource(t: Transaction, source: {accountId:string;sourceIdentity:string}) {
  return t.accountId === source.accountId && (t.importSourceIdentity === source.sourceIdentity || t.source === 'import' && t.sourceId === source.sourceIdentity);
}
function retainedSources(h: Household, row: AccountHistoryRow) {
  const retained = h.transactions.find(t => t.id === row.retainedTransactionId)!;
  const sources = row.transferSources ?? [{accountId:row.accountId,sourceIdentity:row.sourceIdentity,sourceHash:row.sourceHash}];
  return sources.map(source => {
    const transaction = source.accountId === retained.accountId ? retained : h.transactions.find(t => t.id === retained.transferPairId);
    if (!transaction || transaction.accountId !== source.accountId || transaction.isDuplicate || transaction.reversalOfId || h.transactions.some(t => t.reversalOfId === transaction.id)
      || transaction !== retained && (transaction.transferPairId !== retained.id || transaction.type !== 'transfer' || transaction.date !== retained.date || transaction.amountCents !== retained.amountCents || transaction.currency !== retained.currency || transaction.visibility !== retained.visibility || transaction.transferFromAccountId !== row.accountId || transaction.transferToAccountId !== row.toAccountId)) fail('The retained transfer pair no longer matches the reviewed source rows.');
    if (h.transactions.some(t => ownsSource(t, source) && t.id !== transaction!.id)) fail('The source identity belongs to a different accepted transaction.');
    if (transaction!.importSourceIdentity && transaction!.importSourceIdentity !== source.sourceIdentity) fail('This retained transaction already has different source provenance.');
    return {transaction:transaction!,source};
  });
}
export function accountHistoryState(h: Household, input: AccountHistoryInput): string {
  const ids = new Set(input.accounts.map(a => a.accountId));
  return sha256String(canonical({ householdId: h.householdId, environment: h.environment,
    members: h.members.map(m => ({ id: m.id, active: m.active })),
    accounts: h.accounts.filter(a => ids.has(a.id)),
    transactions: h.transactions.filter(t => ids.has(t.accountId) || (t.transferFromAccountId && ids.has(t.transferFromAccountId)) || (t.transferToAccountId && ids.has(t.transferToAccountId))),
    checkpoints: (h.accountOpeningCheckpoints ?? []).filter(c => ids.has(c.accountId)),
    categories: h.categories, closed: h.kitchen.books.closedMonths }));
}
function validate(h: Household, input: AccountHistoryInput) {
  if (h.environment !== 'development' || h.timezone !== 'America/Toronto') fail('Statement setup is available in Toronto Development books only.');
  if (!h.members.some(m => m.active && m.id === input.createdBy)) fail('Choose your active member identity.');
  if (!['personal', 'household'].includes(input.visibility)) fail('Choose Shared or your own Personal books.');
  if (!input.accounts.length || input.accounts.length > 50 || input.rows.length > 500) fail('Review 1–50 accounts and at most 500 statement rows at a time. No rows have been posted.');
  const ids = new Set<string>();
  for (const c of input.accounts) {
    if (ids.has(c.accountId)) fail('Review each account only once.'); ids.add(c.accountId);
    const a = h.accounts.find(a => a.id === c.accountId);
    if (!a || !a.active || a.currency !== 'CAD' || !inScope(a, input.visibility, input.createdBy)) fail('An account is missing, inactive, or outside the selected books.');
    requireDate(h, c.openingDate); requireDate(h, c.closingDate);
    if (c.openingDate > c.closingDate || !Number.isSafeInteger(c.openingBalanceCents) || !Number.isSafeInteger(c.closingBalanceCents)) fail('Review the statement dates and signed integer-cent balances.');
    for(const point of c.checkpoints??[]){requireDate(h,point.date);if(point.date<c.openingDate||point.date>c.closingDate||!Number.isSafeInteger(point.balanceCents))fail('Review each intermediate statement checkpoint.');}
    for(const span of c.coverage??[]){if(!isValidDateKey(span.start)||!isValidDateKey(span.end)||span.start>span.end||span.start<=c.openingDate||span.end>c.closingDate)fail('Statement coverage must fall strictly after the opening cutoff through closing.');}
    const openings = activeOpeningRows(h, c.accountId);
    if (openings.length > 1) fail('Multiple live openings need review before correcting history.');
    for (const t of openings) { requireDate(h, t.date); if (c.openingDate > t.date) fail('A replacement opening must be on or before the existing opening date.'); }
    if (!openings.length && !acceptedAccountOpeningCoverage(h, {visibility:input.visibility,memberId:input.createdBy}).checkpoints.some(p=>p.accountId===c.accountId) && h.transactions.some(t=>t.accountId===c.accountId&&!t.isDuplicate)) fail('Existing activity has no confirmed opening checkpoint. Review opening lineage first.');
  }
  const sourceKeys = new Set<string>();
  const transferKeys = new Set<string>();
  for (const r of input.rows) {
    if (!ids.has(r.accountId) || !r.sourceIdentity.trim() || !r.sourceHash.trim() || r.sourceIdentity.length > 300) fail('Every row needs its source identity and a reviewed account.');
    for (const source of r.transferSources ?? [r]) {
      const key = canonical([source.accountId,source.sourceIdentity]);
      if (sourceKeys.has(key)) fail('The same source row appears twice. Review duplicates.'); sourceKeys.add(key);
    }
    requireDate(h, r.date);
    const c = input.accounts.find(a => a.accountId === r.accountId)!;
    if (r.date <= c.openingDate || r.date > c.closingDate || !Number.isSafeInteger(r.amountCents) || r.amountCents <= 0) fail('Import only positive-cent movements strictly after the opening cutoff and through the closing checkpoint.');
    if (!['income','expense','refund','transfer'].includes(r.type) || !['post','retain'].includes(r.decision)) fail('Resolve every transaction type and duplicate decision.');
    if (r.type === 'transfer') {
      if (!r.toAccountId || r.toAccountId === r.accountId || !ids.has(r.toAccountId)) fail('Include both tracked transfer accounts and their checkpoints in this review.');
      const other = input.accounts.find(a=>a.accountId===r.toAccountId)!;
      if (r.date <= other.openingDate || r.date > other.closingDate) fail('The transfer must fall within both account review periods.');
      const transferKey = canonical([r.accountId,r.toAccountId,r.date,r.amountCents,r.transferGroupIdentity??null]);
      if(r.transferSources){
        if(r.transferSources.length!==2||new Set(r.transferSources.map(s=>s.accountId)).size!==2||r.transferSources.some(s=>![r.accountId,r.toAccountId].includes(s.accountId)||!s.sourceIdentity.trim()||s.sourceIdentity.length>300||!s.sourceHash.trim()))fail("Review one source identity for each transfer account.");
        const primary=r.transferSources.find(s=>s.accountId===r.accountId)!;
        if(primary.sourceIdentity!==r.sourceIdentity||primary.sourceHash!==r.sourceHash)fail('The outgoing transfer source must match its reviewed row.');
        for(const source of r.transferSources)if(h.transactions.some(t=>ownsSource(t,source))&&r.decision==='post')fail("A transfer source identity is already accepted. Retain the canonical transfer.");
      }
      if (r.decision === 'post' && transferKeys.has(transferKey)) fail('Two transfer legs must resolve to one canonical transfer.');
      if (r.decision === 'post') transferKeys.add(transferKey);
    } else {
      if(r.transferSources)fail('Only a transfer may include paired source identities.');
      if (!r.subcategoryId) fail('Choose a category for every imported income, expense, or refund.');
    }
    const accepted = h.transactions.filter(t => t.accountId === r.accountId && (t.importSourceIdentity === r.sourceIdentity || t.source === 'import' && t.sourceId === r.sourceIdentity));
    if (r.decision === 'post' && accepted.length) fail('This source identity is already accepted. Retain its existing row.');
    if (r.decision === 'retain') {
      const t = h.transactions.find(t => t.id === r.retainedTransactionId);
      if (!t || t.isDuplicate || t.reversalOfId || h.transactions.some(x=>x.reversalOfId===t.id) || t.accountId !== r.accountId || t.date !== r.date || t.amountCents !== r.amountCents || t.type !== r.type || (r.type === 'transfer' && (t.transferFromAccountId !== r.accountId || t.transferToAccountId !== r.toAccountId)) || (r.type !== 'transfer' && t.subcategoryId !== r.subcategoryId)) fail('The retained transaction does not match the reviewed source row.');
      if (accepted.some(x=>x.id!==t!.id)) fail('The source identity belongs to a different accepted transaction.');
      retainedSources(h,r);
    }
  }
}
function result(before: Household, next: Household, kind: string, postedIds: string[]): CommitResult {
  next.lastCommittedAt = nowIso();
  return {household:next,postedIds,warnings:[],undo:{id:`HISTORY-${next.lastCommittedAt}`,label:kind,snapshot:before,postedIds,commandKind:kind}};
}
function appendOpening(h: Household, input: AccountHistoryInput, c: AccountHistoryInput['accounts'][number], confirmationId: string, postedIds: string[], prior?: AccountOpeningCheckpoint) {
  const at = nowIso(), a = h.accounts.find(a=>a.id===c.accountId)!;
  let transactionId: string|null = null;
  if (c.openingBalanceCents !== 0) {
    transactionId = nextId('TXN-OP-',h.transactions.map(t=>t.id));
    const amountCents = Math.abs(c.openingBalanceCents);
    const t: Transaction = {id:transactionId,date:c.openingDate as DateKey,type:'opening',amountCents,currency:'CAD',accountId:a.id,categoryId:null,subcategoryId:null,note:`Opening - ${a.name}`,place:'',splits:[{party:a.ownerMemberId===JOINT?JOINT:a.ownerMemberId,amountCents}],source:'opening',sourceId:confirmationId,duplicateKey:'',potentialDuplicate:false,isDuplicate:false,reviewed:true,createdBy:input.createdBy,visibility:input.visibility,createdAt:at,updatedAt:at,openingSignedBalanceCents:c.openingBalanceCents,historyCorrectionId:confirmationId};
    t.duplicateKey=duplicateKey(t);h.transactions.push(t);postedIds.push(t.id);
  }
  h.accountOpeningCheckpoints ??= [];
  h.accountOpeningCheckpoints.push({id:`OPEN-CHECKPOINT:${confirmationId}:${a.id}`,accountId:a.id,date:c.openingDate as DateKey,signedBalanceCents:c.openingBalanceCents,statementClosingDate:c.closingDate as DateKey,statementClosingBalanceCents:c.closingBalanceCents,statementCoverage:c.coverage??[],transactionId,confirmationId,visibility:input.visibility,ownerMemberId:input.visibility==='personal'?input.createdBy:null,createdBy:input.createdBy,createdAt:at,updatedAt:at,...(prior?{supersedesId:prior.id}:{})});
}
function build(h: Household, input: AccountHistoryInput, confirmationId: string): CommitResult {
  let next = cloneHousehold(h); const postedIds: string[] = [];
  const coverage = acceptedAccountOpeningCoverage(h,{visibility:input.visibility,memberId:input.createdBy});
  for (const c of input.accounts) {
    const prior = coverage.checkpoints.find(p=>p.accountId===c.accountId);
    for (const original of activeOpeningRows(h,c.accountId)) {
      const at=nowIso(),reversal:Transaction={...original,id:nextId('TXN-OP-',next.transactions.map(t=>t.id)),source:'reversal',sourceId:confirmationId,reversalOfId:original.id,note:`History correction of ${original.id}`,createdBy:input.createdBy,createdAt:at,updatedAt:at,historyCorrectionId:confirmationId};
      next.transactions.push(reversal);postedIds.push(reversal.id);
    }
    appendOpening(next,input,c,confirmationId,postedIds,prior);
  }
  for (const r of input.rows) {
    if (r.decision==='retain') {
      // Remember reviewed provenance even for matched legacy rows; money is unchanged.
      for (const {transaction,source} of retainedSources(next,r)) {
        transaction.importSourceIdentity=source.sourceIdentity;transaction.importSourceHash=source.sourceHash;
        transaction.updatedAt=nowIso();
      }
      continue;
    }
    const posted = r.type==='transfer' ? postTransfer(next,{date:r.date,amount:r.amountCents/100,fromAccountId:r.accountId,toAccountId:r.toAccountId!,createdBy:input.createdBy,visibility:input.visibility,source:'import',sourceId:r.sourceIdentity,note:r.note,confirmDuplicate:true})
      : postEntry(next,{date:r.date,type:r.type,amount:r.amountCents/100,accountId:r.accountId,subcategoryId:r.subcategoryId!,createdBy:input.createdBy,visibility:input.visibility,source:'import',sourceId:r.sourceIdentity,note:r.note,confirmDuplicate:true});
    next=posted.household;postedIds.push(...posted.postedIds);
    for(const t of next.transactions.filter(t=>posted.postedIds.includes(t.id))){const source=r.transferSources?.find(s=>s.accountId===t.accountId);t.importSourceIdentity=source?.sourceIdentity??r.sourceIdentity;t.importSourceHash=source?.sourceHash??r.sourceHash;t.historyCorrectionId=confirmationId;}
  }
  for (const c of input.accounts) {
    const prior=coverage.checkpoints.find(p=>p.accountId===c.accountId);
    if (prior && economicAccountBalanceAsOf(next,c.accountId,prior.date)!==economicAccountBalanceAsOf(h,c.accountId,prior.date)) fail('The old opening checkpoint would change. Review the earlier opening and backfilled history.');
    for(const point of c.checkpoints??[])if(economicAccountBalanceAsOf(next,c.accountId,point.date)!==point.balanceCents)fail('History does not reconcile to an intermediate statement checkpoint. Nothing was posted.');
    if (economicAccountBalanceAsOf(next,c.accountId,c.closingDate)!==c.closingBalanceCents) fail('The reviewed history does not reconcile to the statement closing balance. No money was posted.');
  }
  return result(h,next,'acceptReviewedAccountHistory',postedIds);
}
export function prepareAccountHistoryReview(h: Household, input: AccountHistoryInput): AccountHistoryReview {
  const request=inputOnly(input);validate(h,request);build(h,request,'history-preview');
  const coverage=acceptedAccountOpeningCoverage(h,{visibility:input.visibility,memberId:input.createdBy});
  const mode=coverage.checkpoints.some(c=>request.accounts.some(a=>a.accountId===c.accountId))?'rebase':'fresh';
  const base={...request,version:1 as const,householdId:h.householdId,environment:h.environment,mode:mode as 'fresh'|'rebase',stateFingerprint:accountHistoryState(h,request)};
  const review={...base,digest:sha256String(canonical(base))};
  if (canonical([review]).length > 100 * 1024) fail("This review exceeds the safe command size. Review fewer statement rows; none were posted.");
  return review;
}
function currentReview(h: Household, r: AccountHistoryReview): AccountHistoryReview {
  if(r.version!==1||r.householdId!==h.householdId||r.environment!==h.environment)fail('The ledger changed. Review history again.');
  const current=prepareAccountHistoryReview(h,r);
  if(current.digest!==r.digest||current.stateFingerprint!==r.stateFingerprint)fail('Review changed. Your draft is preserved; review the current books before confirming.');
  return current;
}
export const approveAccountHistoryReview=captureCommand('approveAccountHistoryReview',function(h:Household,input:{createdBy:string;review:AccountHistoryReview}):CommitResult{
  const review=currentReview(h,input.review);
  if(!h.members.some(m=>m.active&&m.id===input.createdBy)||review.visibility==='personal'&&input.createdBy!==review.createdBy)fail('Only the account owner can approve Personal history.');
  const next=cloneHousehold(h),at=nowIso();next.accountHistoryApprovals??=[];
  if(!next.accountHistoryApprovals.some(a=>a.digest===review.digest&&a.memberId===input.createdBy))next.accountHistoryApprovals.push({id:nextId('HISTORY-APPROVAL-',next.accountHistoryApprovals.map(a=>a.id)),digest:review.digest,memberId:input.createdBy,visibility:review.visibility,ownerMemberId:review.visibility==='personal'?review.createdBy:null,updatedAt:at});
  return result(h,next,'approveAccountHistoryReview',[]);
});
export const acceptReviewedAccountHistory=captureCommand('acceptReviewedAccountHistory',function(h:Household,input:{createdBy:string;review:AccountHistoryReview;confirmationId:string}):CommitResult{
  if(!input.confirmationId?.trim()||input.confirmationId.length>120)fail('Use one stable Confirm identity for this review.');
  if(input.createdBy!==input.review.createdBy)fail('The confirming identity changed. Review history again.');
  const existing=(h.accountOpeningCheckpoints??[]).filter(c=>c.confirmationId===input.confirmationId);
  if(existing.length){
    const receipt=h.accountHistoryApprovals?.find(a=>a.id===`HISTORY-ACCEPTED:${input.confirmationId}`);
    if(!receipt||receipt.digest!==input.review.digest||receipt.memberId!==input.createdBy)fail('This Confirm identity already belongs to another history review.');
    return result(h,cloneHousehold(h),'acceptReviewedAccountHistory',h.transactions.filter(t=>t.historyCorrectionId===input.confirmationId).map(t=>t.id));
  }
  const review=currentReview(h,input.review);
  if(review.mode==='rebase'&&review.visibility==='household'){
    const members=h.members.filter(m=>m.active);
    if(members.length!==2||members.some(m=>!h.accountHistoryApprovals?.some(a=>a.memberId===m.id&&a.digest===review.digest)))fail('Both members must approve this exact Shared history correction.');
  }
  const accepted=build(h,review,input.confirmationId);
  accepted.household.accountHistoryApprovals??=[];
  accepted.household.accountHistoryApprovals.push({id:`HISTORY-ACCEPTED:${input.confirmationId}`,digest:review.digest,memberId:input.createdBy,visibility:review.visibility,ownerMemberId:review.visibility==='personal'?input.createdBy:null,updatedAt:nowIso()});
  return accepted;
});

export const submitAccountHistoryReview=captureCommand('submitAccountHistoryReview',function(h:Household,input:{createdBy:string;review:AccountHistoryReview}):CommitResult{
  const review=currentReview(h,input.review);
  if(input.createdBy!==review.createdBy)fail('Only the author may share this reviewed history.');
  const next=cloneHousehold(h);next.accountHistoryReviews??=[];
  if(!next.accountHistoryReviews.some(r=>r.id===review.digest))next.accountHistoryReviews.push({id:review.digest,review,visibility:review.visibility,ownerMemberId:review.visibility==='personal'?review.createdBy:null,updatedAt:nowIso()});
  return result(h,next,'submitAccountHistoryReview',[]);
});
export function pendingAccountHistoryReviews(h:Household,scope:{visibility:'household'|'personal';memberId?:string}):AccountHistoryReviewRecord[]{
  return (h.accountHistoryReviews??[]).filter(record=>record.visibility===scope.visibility&&(record.visibility!=='personal'||record.ownerMemberId===scope.memberId)&&!h.accountHistoryApprovals?.some(a=>a.id.startsWith('HISTORY-ACCEPTED:')&&a.digest===record.review.digest)&&accountHistoryState(h,record.review)===record.review.stateFingerprint);
}
/** Local acceptance has the same reviewed command boundary as remote replay. */
export function assertAccountHistoryTransition(before: Household, candidate: Household, commandKind: string|undefined, actor: string|undefined, commandArgs?: unknown[]) {
  const protectedFacts=(h:Household)=>({reviews:h.accountHistoryReviews??[],checkpoints:h.accountOpeningCheckpoints??[],approvals:h.accountHistoryApprovals??[],rows:h.transactions.filter(t=>t.historyCorrectionId||t.openingSignedBalanceCents!==undefined||t.importSourceIdentity)});
  if(canonical(protectedFacts(before))===canonical(protectedFacts(candidate)))return;
  if(!actor||!commandArgs||!['acceptReviewedAccountHistory','approveAccountHistoryReview','submitAccountHistoryReview'].includes(commandKind??''))fail('Account history changes require their reviewed command. Reload this client before changing opening lineage.');
  const args=commandArgs![0] as {createdBy:string;review:AccountHistoryReview;confirmationId:string};
  if(args.createdBy!==actor)fail('Only the acting member may confirm or approve account history.');
  const expected=commandKind==='acceptReviewedAccountHistory'?acceptReviewedAccountHistory(before,args):commandKind==='approveAccountHistoryReview'?approveAccountHistoryReview(before,args):submitAccountHistoryReview(before,args);
  // Public command replay allocates fresh IDs. Match only new rows by the reviewed order;
  // existing row identities and all references must remain exact.
  const remap=new Map<string,string>();
  for(const field of ['transactions','accountHistoryApprovals'] as const){
    const oldIds=new Set((before[field]??[]).map(r=>r.id));
    const expectedRows=(expected.household[field]??[]).filter(r=>!oldIds.has(r.id));
    const actualRows=(candidate[field]??[]).filter(r=>!oldIds.has(r.id));
    if(expectedRows.length!==actualRows.length)fail('Account history row count differs from the reviewed command.');
    expectedRows.forEach((row,i)=>remap.set(row.id,actualRows[i]!.id));
  }
  const normalize=(value:unknown,mapIds:boolean):unknown=>typeof value==='string'&&mapIds?(remap.get(value)??value):Array.isArray(value)?value.map(v=>normalize(v,mapIds)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['createdAt','updatedAt','lastCommittedAt'].includes(k)).map(([k,v])=>[k,normalize(v,mapIds)])):value;
  const normalizedExpected=ensureHouseholdShape(expected.household);
  if(canonical(normalize(protectedFacts(normalizedExpected),true))!==canonical(normalize(protectedFacts(candidate),false))||canonical(normalize(normalizedExpected.transactions,true))!==canonical(normalize(candidate.transactions,false)))fail('Account history facts differ from the reviewed command. Nothing was posted.');
}

/** Validate persisted signed/zero lineage even during a reload or imported replica. */
export function assertAccountOpeningIntegrity(h:Household):void{
  const checkpoints=h.accountOpeningCheckpoints??[],ids=new Set<string>();
  for(const cp of checkpoints){
    const account=h.accounts.find(a=>a.id===cp.accountId);
    if(!['household','personal'].includes(cp.visibility)||ids.has(cp.id)||!cp.id||!cp.confirmationId||!isValidDateKey(cp.date)||!Number.isSafeInteger(cp.signedBalanceCents)||!account||!inScope(account,cp.visibility,cp.ownerMemberId??undefined)||cp.visibility==='personal'&&cp.ownerMemberId!==cp.createdBy)fail('An opening checkpoint needs recovery; its scope or lineage is invalid.');
    ids.add(cp.id);
    if(cp.transactionId===null){if(cp.signedBalanceCents!==0)fail('Only an explicit zero opening may omit its journal row.');}
    else{
      const tx=h.transactions.find(t=>t.id===cp.transactionId);
      if(!tx||tx.accountId!==cp.accountId||tx.type!=='opening'||tx.source!=='opening'||tx.date!==cp.date||tx.sourceId!==cp.confirmationId||tx.visibility!==cp.visibility||tx.createdBy!==cp.createdBy||(tx.openingSignedBalanceCents??tx.amountCents*(isLiabilityKind(account!.kind)?-1:1))!==cp.signedBalanceCents)fail('An opening checkpoint no longer matches its accepted journal row.');
    }
    if(cp.supersedesId){
      const predecessor=checkpoints.find(p=>p.id===cp.supersedesId);
      const legacy=cp.supersedesId.startsWith('legacy:')?h.transactions.find(t=>`legacy:${t.id}`===cp.supersedesId&&t.type==='opening'&&t.accountId===cp.accountId):undefined;
      if((!predecessor&&!legacy)||predecessor&&predecessor.accountId!==cp.accountId||cp.supersedesId===cp.id)fail('An opening checkpoint has broken predecessor lineage.');
      if(checkpoints.some(other=>other.id!==cp.id&&other.supersedesId===cp.supersedesId))fail('An opening checkpoint has competing corrections.');
    }
  }
  for(const cp of checkpoints){const visited=new Set<string>();let cursor:AccountOpeningCheckpoint|undefined=cp;while(cursor){if(visited.has(cursor.id))fail('Opening lineage contains a cycle.');visited.add(cursor.id);cursor=checkpoints.find(p=>p.id===cursor?.supersedesId);}}
  const superseded=new Set(checkpoints.map(c=>c.supersedesId));
  for(const cp of checkpoints.filter(c=>!superseded.has(c.id))){const live=activeOpeningRows(h,cp.accountId);if(cp.transactionId===null?live.length!==0:live.length!==1||live[0]?.id!==cp.transactionId)fail('The current opening checkpoint and live opening rows disagree.');}
  for(const tx of h.transactions)if(tx.openingSignedBalanceCents!==undefined&&(tx.type!=='opening'||!Number.isSafeInteger(tx.openingSignedBalanceCents)||Math.abs(tx.openingSignedBalanceCents)!==tx.amountCents))fail('Invalid signed opening representation. Reload a compatible client.');
}
