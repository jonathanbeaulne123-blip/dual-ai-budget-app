import { countable } from "./budget.ts";
import { CURRENCY } from "./money.ts";
import { monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import { activeAccounts, activeCategories } from "./catalog.ts";
import { shapeHouseholdFundEvents } from "./householdFund.ts";
import type { Account, Household, Transaction } from "./types.ts";

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
  const recent = shapeHouseholdFundEvents(household.fundEvents)
    .filter((event) => event.kind === "purchase-funded" && event.createdBy === memberId)
    .sort((left, right) => (
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
    ));
  const remembered = recent.find((event) => visibleIds.has(event.destinationAccountId));
  if (remembered && isEligibleSwipeCard(visible.find((account) => account.id === remembered.destinationAccountId))) {
    return { kind: "ready", accountId: remembered.destinationAccountId };
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
