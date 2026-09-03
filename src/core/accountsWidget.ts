// The accounts — one you choose at a glance, every one you're allowed to
// see on the stage, one click into its books.
//
// Scope is the whole slice. The Shared Fund surface lists Shared accounts
// only. Personal accounts remain on Personal Books, never as a row, count,
// fallback, or figure here. This module never aggregates across scopes.

import { accountBookBalance, creditCardView } from "./accounts.ts";
import { ACCOUNT_KIND_LABEL, isCreditKind, isInvestmentKind } from "./accountKinds.ts";
import { activeAccounts } from "./catalog.ts";
import { resolveSwipeCardAccount } from "./swipe.ts";
import type { DateKey } from "./calendar.ts";
import type { HearthTab } from "./hercules.ts";
import type { Account, AccountKind, Household } from "./types.ts";

/**
 * Not the account's own AccountScope. The Shared Fund surface exposes only
 * Shared accounts; Personal account rooms stay on Personal Books.
 */
export type AccountWidgetScope = "shared";

export type AccountRow = {
  accountId: string;
  name: string;
  accessibilityName: string;
  detailLabel: string | null;
  kind: AccountKind;
  scope: AccountWidgetScope;
  balanceCents: number;
  balanceLabel: "book balance" | "owed" | "cost basis";
  /** Credit cards only, 0-1. Null for every other kind. */
  utilization: number | null;
  isFundCard: boolean;
  booksTarget: { tab: HearthTab; accountId: string };
};

function visibleAccounts(household: Household): Account[] {
  return activeAccounts(household).filter((account) => account.scope !== "personal");
}

function toRow(household: Household, account: Account, today: DateKey, fundCardId: string | null): AccountRow {
  const credit = isCreditKind(account.kind);
  const investment = isInvestmentKind(account.kind);
  const creditView = credit ? creditCardView(household, account, today) : null;
  return {
    accountId: account.id,
    name: account.name,
    accessibilityName: account.name,
    detailLabel: null,
    kind: account.kind,
    scope: "shared",
    balanceCents: creditView?.owedCents ?? accountBookBalance(household, account.id, today),
    balanceLabel: credit ? "owed" : investment ? "cost basis" : "book balance",
    utilization: creditView?.utilization ?? null,
    isFundCard: fundCardId === account.id,
    booksTarget: { tab: "ledger", accountId: account.id },
  };
}

/**
 * Shared accounts only, sorted by name — never by balance, which would
 * order accounts by how much they hold or owe.
 */
export function accountRows(household: Household, memberId: string, today: DateKey): AccountRow[] {
  const fundResolution = resolveSwipeCardAccount(household, memberId);
  const fundCardId = fundResolution.kind === "ready" ? fundResolution.accountId : null;
  const rows = visibleAccounts(household)
    .map((account) => toRow(household, account, today, fundCardId))
    .sort((left, right) => left.name.localeCompare(right.name));
  const nameCounts = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const row of rows) nameCounts.set(row.name, (nameCounts.get(row.name) ?? 0) + 1);
  return rows.map((row) => {
    if ((nameCounts.get(row.name) ?? 0) <= 1) return row;
    const ordinal = (seen.get(row.name) ?? 0) + 1;
    seen.set(row.name, ordinal);
    const detailLabel = `${ACCOUNT_KIND_LABEL[row.kind]} ${ordinal}`;
    return { ...row, detailLabel, accessibilityName: `${row.name}, ${detailLabel}` };
  });
}

/**
 * The member's stored pick if it still resolves, else a starting point:
 * the Fund's unambiguous Shared backing card for the custodian, then the
 * first Shared row. A default is never a lock — setGlanceAccount changes
 * it, and it never invents an account that isn't already visible.
 */
export function chosenAccount(household: Household, memberId: string, today: DateKey): AccountRow | null {
  const rows = accountRows(household, memberId, today);
  if (rows.length === 0) return null;

  const member = household.members.find((row) => row.id === memberId);
  const stored = member?.glanceAccountId
    ? rows.find((row) => row.accountId === member.glanceAccountId)
    : null;
  if (stored) return stored;

  const isCustodian = household.householdFund?.custodianMemberId === memberId;
  if (isCustodian) {
    const resolution = resolveSwipeCardAccount(household, memberId);
    if (resolution.kind === "ready") {
      const fundCard = rows.find((row) => row.accountId === resolution.accountId);
      if (fundCard) return fundCard;
    }
  }

  return rows[0]!;
}

/** True only for an account this member is actually allowed to see. */
export function accountVisibleTo(household: Household, _memberId: string, accountId: string): boolean {
  return visibleAccounts(household).some((account) => account.id === accountId);
}
