import { canonical } from "../ledgerSync/patch.ts";
import { countable } from "./budget.ts";
import { CURRENCY } from "./money.ts";
import { isValidDateKey, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { activeAccounts, activeCategories, parseAmount } from "./catalog.ts";
import { shapeHouseholdFundEvents } from "./householdFund.ts";
import type { Account, Environment, Household, Transaction, UndoToken } from "./types.ts";

export const SWIPE_COPY = {
  action: "I spent something",
  title: "What did you just spend?",
  success: "Posted. Nothing moved.",
  undo: "Undo",
  more: "More",
  refusal: "Only the person holding the card can post a household purchase.",
} as const;

export const SWIPE_CATEGORY_LIMIT = 6;
export const SWIPE_UNDO_MS = 10_000;
export const SWIPE_CATEGORY_CELL_PX = 72;
export const SWIPE_ACTION_HEIGHT_PX = 96;

export type ObservedSwipeCategory = {
  subcategoryId: string;
  name: string;
  useCount: number;
  lastUsedOn: DateKey;
};

export type SwipeCardResolution =
  | { kind: "ready"; accountId: string }
  | { kind: "ambiguous" };

export type SwipeUndoStrip = {
  token: UndoToken;
  environment: Environment;
  householdId: string;
  memberId: string;
};

export function swipeUndoScopeMatches(
  strip: SwipeUndoStrip,
  environment: Environment,
  householdId: string,
  memberId: string,
): boolean {
  return strip.environment === environment
    && strip.householdId === householdId
    && strip.memberId === memberId;
}

function purchaseFundedTransactionIds(household: Household): Set<string> {
  const ids = new Set<string>();
  for (const event of shapeHouseholdFundEvents(household.fundEvents)) {
    if (event.kind !== "purchase-funded") continue;
    for (const relatedId of event.relatedTransactionIds) ids.add(relatedId);
  }
  return ids;
}

function isPurchaseFundedLineage(tx: Transaction, purchaseIds: Set<string>): boolean {
  return Boolean(tx.funding && purchaseIds.has(tx.id));
}

function eligibleExpenseSubcategory(household: Household, subcategoryId: string | null | undefined) {
  if (!subcategoryId) return null;
  return activeCategories(household).find((category) => (
    category.id === subcategoryId
    && category.recordType === "category"
    && category.transactionType === "expense"
    && category.active
    && category.parentId
    && household.categories.some(parent=>parent.id===category.parentId&&parent.active&&parent.recordType==="group"&&parent.transactionType==="expense")
  )) ?? null;
}

/** Observed categories for the current Toronto month from Fund purchase-funded lineage only. */
export function observedSwipeCategories(
  household: Household,
  memberId: string,
  today: DateKey,
): ObservedSwipeCategory[] {
  const monthKey = monthKeyFromDateKey(today);
  const purchaseIds = purchaseFundedTransactionIds(household);
  const tallies = new Map<string, { name: string; useCount: number; lastUsedOn: DateKey }>();
  for (const tx of household.transactions) {
    if (!countable(tx) || tx.type !== "expense") continue;
    if (tx.createdBy !== memberId) continue;
    if (monthKeyFromDateKey(tx.date) !== monthKey) continue;
    if (!isPurchaseFundedLineage(tx, purchaseIds)) continue;
    const subcategory = eligibleExpenseSubcategory(household, tx.subcategoryId);
    if (!subcategory) continue;
    const current = tallies.get(subcategory.id);
    if (!current) {
      tallies.set(subcategory.id, { name: subcategory.name, useCount: 1, lastUsedOn: tx.date });
      continue;
    }
    current.useCount += 1;
    if (tx.date > current.lastUsedOn) current.lastUsedOn = tx.date;
  }
  return [...tallies.entries()]
    .map(([subcategoryId, row]) => ({ subcategoryId, ...row }))
    .sort((left, right) => (
      right.useCount - left.useCount
      || (right.lastUsedOn < left.lastUsedOn ? -1 : right.lastUsedOn > left.lastUsedOn ? 1 : 0)
      || (left.subcategoryId < right.subcategoryId ? -1 : left.subcategoryId > right.subcategoryId ? 1 : 0)
    ))
    .slice(0, SWIPE_CATEGORY_LIMIT);
}

export function isEligibleSwipeCard(account: Account | null | undefined): account is Account {
  return Boolean(
    account
    && account.active
    && account.currency === CURRENCY
    && account.kind === "credit"
    && account.scope !== "personal",
  );
}

function visibleSwipeCards(household: Household): Account[] {
  return activeAccounts(household).filter((account) => isEligibleSwipeCard(account));
}

/** Resolve the fast-path card without guessing among several credits or partner-Personal rooms. */
export function resolveSwipeCardAccount(household: Household, memberId: string): SwipeCardResolution {
  const visible = visibleSwipeCards(household);
  const visibleIds = new Set(visible.map((account) => account.id));
  const chosenId = household.members.find((member) => member.id === memberId)?.fundCardAccountId;
  if (chosenId && isEligibleSwipeCard(visible.find((account) => account.id === chosenId))) {
    return { kind: "ready", accountId: chosenId };
  }
  const recent = shapeHouseholdFundEvents(household.fundEvents)
    .filter((event) => event.kind === "purchase-funded" && event.createdBy === memberId)
    .sort((left, right) => (
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
    ));
  const remembered = recent.find((event) => Boolean(event.destinationAccountId && visibleIds.has(event.destinationAccountId)));
  const rememberedId = remembered?.destinationAccountId;
  if (rememberedId && isEligibleSwipeCard(visible.find((account) => account.id === rememberedId))) {
    return { kind: "ready", accountId: rememberedId };
  }
  if (visible.length === 1) return { kind: "ready", accountId: visible[0]!.id };
  return { kind: "ambiguous" };
}

export function swipeBelongsOnSharedHome(
  memberId: string,
  custodianMemberId: string | null | undefined,
): boolean {
  return Boolean(memberId && custodianMemberId && memberId === custodianMemberId);
}

export function swipeCategoryAccessibleName(amountLabel: string, categoryName: string): string {
  return `Post ${amountLabel} as ${categoryName}. This records a household purchase. Money does not move.`;
}

export function swipeMoreAccessibleName(amountLabel: string): string {
  return `Open Add with ${amountLabel}. This does not post.`;
}


export type SwipeCategoryChoice = ({kind:"observed"} & ObservedSwipeCategory) | {kind:"household-suggestion";subcategoryId:string;name:string};
/** Incoming household catalog suggestions never become fabricated personal observations. */
export function swipeCategoryChoices(household:Household,memberId:string,today:DateKey):SwipeCategoryChoice[]{
  if(!household.members.some(member=>member.id===memberId&&member.active))return [];
  const eligible=activeCategories(household).filter(category=>category.recordType==='category'&&category.transactionType==='expense'&&category.parentId&&household.categories.some(parent=>parent.id===category.parentId&&parent.active&&parent.recordType==='group'&&parent.transactionType==='expense'));
  const ids=new Set(eligible.map(category=>category.id));
  const observed=observedSwipeCategories(household,memberId,today).filter(row=>ids.has(row.subcategoryId)).map(row=>({...row,kind:'observed' as const}));
  const used=new Set(observed.map(row=>row.subcategoryId));
  const suggested=eligible.filter(category=>{if(used.has(category.id))return false;used.add(category.id);return true;}).map(category=>({kind:'household-suggestion' as const,subcategoryId:category.id,name:category.name}));
  return [...observed,...suggested].slice(0,SWIPE_CATEGORY_LIMIT);
}

/** Bind the named Post to its displayed card, category, Fund and date at queue drain. */
export function swipePurchaseReview(household:Household,memberId:string,date:DateKey,amount:string,subcategoryId:string){
  const member=household.members.find(row=>row.id===memberId&&row.active),fund=household.householdFund;
  if(!member||!fund||fund.custodianMemberId!==memberId||!isValidDateKey(date)||parseAmount(amount)<=0)throw new Error('Review this purchase from the current Shared Till.');
  const resolved=resolveSwipeCardAccount(household,memberId);if(resolved.kind!=='ready')throw new Error('Choose the card in Add.');
  const account=household.accounts.find(row=>row.id===resolved.accountId),category=eligibleExpenseSubcategory(household,subcategoryId),parent=category&&household.categories.find(row=>row.id===category.parentId&&row.active&&row.recordType==='group'&&row.transactionType==='expense');
  if(!account||!category||!parent)throw new Error('Choose a current household expense category.');
  return {accountId:account.id,fundId:fund.id,basis:canonical([household.environment,household.householdId,memberId,date,amount,account,category,parent,fund])};
}

/** Existing Post input plus a marker; wire carries no names or source snapshots. */
export function reviewedSwipeEntry(household:Household,value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_SWIPE_REVIEW');
  const input=value as Record<string,unknown>,funding=input.funding as {fundId?:unknown;fundedCents?:unknown;destinationAccountId?:unknown}|undefined;
  if(input.swipeReviewed!==true||input.type!=='expense'||input.visibility!=='household'||input.refundOfId||input.reversalOfId||!['createdBy','date','accountId','subcategoryId'].every(key=>typeof input[key]==='string'&&(input[key] as string).length<=512)||(typeof input.amount!=='string'&&typeof input.amount!=='number'))throw Error('INVALID_SWIPE_REVIEW');
  const review=swipePurchaseReview(household,input.createdBy as string,input.date as string,String(input.amount),input.subcategoryId as string);
  if(input.accountId!==review.accountId||funding?.fundId!==review.fundId||funding?.destinationAccountId!==review.accountId||funding?.fundedCents!==parseAmount(input.amount))throw Error('INVALID_SWIPE_REVIEW');
  return review;
}
