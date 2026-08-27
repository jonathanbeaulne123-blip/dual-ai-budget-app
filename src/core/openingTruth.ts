/**
 * Opening truth — pure draft/projection (D-129 / Opening Truth worksession).
 * Never posts money; Confirm invokes postOpeningBalances.
 */

import { isLiabilityKind, normalizeAccountKind, ACCOUNT_KIND_LABEL } from "./accountKinds.ts";
import { isValidDateKey, type DateKey } from "./calendar.ts";
import { JOINT, ValidationError, type Account, type Household, type Visibility } from "./types.ts";

export const OPENING_EQUITY_ID = "EQ-OPENING";
export const OPENING_EQUITY_NAME = "Opening equity";

export type OpeningBalanceLineDraft = {
  accountId: string;
  accountName: string;
  kind: Account["kind"];
  /** Absolute CAD cents the member typed (always ≥ 0). Zero lines are skipped. */
  amountCents: number;
  /** Asset → debit bank; liability → credit bank. */
  side: "asset" | "liability";
  visibility: Visibility;
  ownerMemberId: string | typeof JOINT;
};

export type OpeningTruthDraft = {
  asOfDate: DateKey;
  createdBy: string;
  lines: OpeningBalanceLineDraft[];
  assetCents: number;
  liabilityCents: number;
  /** Credit to Opening equity when assets exceed liabilities (or debit when debts exceed). */
  openingEquityCents: number;
  balanced: boolean;
};

export type OpeningLineInput = {
  accountId: string;
  /** Absolute cents; 0 skips the account. */
  amountCents: number;
};

function visibilityForAccount(account: Account, memberId: string): Visibility {
  if (account.ownerMemberId === JOINT) return "household";
  if (account.ownerMemberId === memberId) return "personal";
  throw new ValidationError(`${account.name} belongs to another member’s Personal ledger.`);
}

/** Accounts the current member may open: shared + own Personal. */
export function openingEligibleAccounts(household: Household, memberId: string): Account[] {
  return household.accounts
    .filter((account) => account.active)
    .filter((account) => account.ownerMemberId === JOINT || account.ownerMemberId === memberId)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function buildOpeningTruthDraft(
  household: Household,
  input: {
    asOfDate: string;
    createdBy: string;
    lines: OpeningLineInput[];
  },
): OpeningTruthDraft {
  if (!isValidDateKey(input.asOfDate)) {
    throw new ValidationError("Opening truth needs a Toronto civil date (YYYY-MM-DD).");
  }
  const member = household.members.find((row) => row.id === input.createdBy && row.active);
  if (!member) throw new ValidationError("Add yourself as a household member before opening truth.");

  const seen = new Set<string>();
  const lines: OpeningBalanceLineDraft[] = [];
  let assetCents = 0;
  let liabilityCents = 0;

  for (const row of input.lines) {
    if (!row.accountId) continue;
    if (seen.has(row.accountId)) {
      throw new ValidationError("Each account can appear once in opening truth.");
    }
    seen.add(row.accountId);
    const amountCents = Math.round(Number(row.amountCents) || 0);
    if (amountCents < 0) {
      throw new ValidationError("Opening amounts are absolute cents — use account kind for debt vs asset.");
    }
    if (amountCents === 0) continue;

    const account = household.accounts.find((item) => item.id === row.accountId && item.active);
    if (!account) throw new ValidationError("That account is missing or inactive.");
    const visibility = visibilityForAccount(account, input.createdBy);
    const kind = normalizeAccountKind(account.kind);
    const side: "asset" | "liability" = isLiabilityKind(kind) ? "liability" : "asset";
    if (side === "asset") assetCents += amountCents;
    else liabilityCents += amountCents;

    lines.push({
      accountId: account.id,
      accountName: account.name,
      kind,
      amountCents,
      side,
      visibility,
      ownerMemberId: account.ownerMemberId,
    });
  }

  if (!lines.length) {
    throw new ValidationError("Enter at least one non-zero opening balance.");
  }

  const openingEquityCents = assetCents - liabilityCents;
  return {
    asOfDate: input.asOfDate as DateKey,
    createdBy: input.createdBy,
    lines,
    assetCents,
    liabilityCents,
    openingEquityCents,
    balanced: true,
  };
}

export function openingTruthReviewSummary(draft: OpeningTruthDraft): string {
  const parts = draft.lines.map((line) => {
    const kind = ACCOUNT_KIND_LABEL[line.kind];
    const dollars = `$${(line.amountCents / 100).toFixed(2)}`;
    return `${line.accountName} (${kind}) ${dollars}`;
  });
  const equity = `Opening equity $${(Math.abs(draft.openingEquityCents) / 100).toFixed(2)}${
    draft.openingEquityCents < 0 ? " (debit)" : draft.openingEquityCents > 0 ? " (credit)" : ""
  }`;
  return `Opening as of ${draft.asOfDate}: ${parts.join("; ")}. ${equity}. Balance sheet only — not income or spend.`;
}

/** Household has no accepted money journal activity yet (opening may still run later from More). */
export function householdHasAcceptedMoney(household: Household): boolean {
  return household.transactions.some((tx) => !tx.isDuplicate);
}

export function hasPostedOpeningTruth(household: Household): boolean {
  return household.transactions.some((tx) => tx.source === "opening" && !tx.reversalOfId);
}
