import { ACCOUNT_KIND_LABEL, isLiabilityKind, normalizeAccountKind } from "./accountKinds.ts";
import { isValidDateKey, type DateKey } from "./calendar.ts";
import { ValidationError, type Account, type Household, type Visibility } from "./types.ts";

export const OPENING_EQUITY_ID = "EQ-OPENING";
export const OPENING_EQUITY_NAME = "Opening equity";

export type OpeningBalanceLineDraft = {
  accountId: string;
  accountName: string;
  kind: Account["kind"];
  /** Absolute CAD cents. Account kind determines whether the row is an asset or liability. */
  amountCents: number;
  side: "asset" | "liability";
  visibility: Visibility;
  ownerMemberId: Account["ownerMemberId"];
};

export type OpeningTruthDraft = {
  asOfDate: DateKey;
  createdBy: string;
  lines: OpeningBalanceLineDraft[];
  assetCents: number;
  liabilityCents: number;
  openingEquityCents: number;
  balanced: true;
};

export type OpeningLineInput = {
  accountId: string;
  /** Absolute integer CAD cents. Zero omits the line. */
  amountCents: number;
};

function visibilityForAccount(account: Account, memberId: string): Visibility {
  if (account.scope === "personal") {
    if (account.ownerMemberId !== memberId) {
      throw new ValidationError(`${account.name} belongs to another member's Personal ledger.`);
    }
    return "personal";
  }
  return "household";
}

/** Shared accounts plus the acting member's own Personal accounts. */
export function openingEligibleAccounts(household: Household, memberId: string): Account[] {
  return household.accounts
    .filter((account) => account.active)
    .filter((account) => account.scope !== "personal" || account.ownerMemberId === memberId)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export function buildOpeningTruthDraft(household: Household, input: {
  asOfDate: string;
  createdBy: string;
  lines: OpeningLineInput[];
}): OpeningTruthDraft {
  if (!isValidDateKey(input.asOfDate)) {
    throw new ValidationError("Opening truth needs a Toronto civil date (YYYY-MM-DD).");
  }
  if (household.timezone !== "America/Toronto") {
    throw new ValidationError("Opening truth uses the household's Toronto civil date.");
  }
  const member = household.members.find((row) => row.id === input.createdBy && row.active);
  if (!member) throw new ValidationError("Add yourself as an active household member before opening truth.");

  const seen = new Set<string>();
  const lines: OpeningBalanceLineDraft[] = [];
  let assetCents = 0;
  let liabilityCents = 0;

  for (const inputLine of input.lines) {
    if (!inputLine.accountId) continue;
    if (seen.has(inputLine.accountId)) throw new ValidationError("Each account can appear once in opening truth.");
    seen.add(inputLine.accountId);
    if (!Number.isInteger(inputLine.amountCents) || inputLine.amountCents < 0) {
      throw new ValidationError("Opening amounts must be absolute integer CAD cents.");
    }
    if (inputLine.amountCents === 0) continue;

    const account = household.accounts.find((row) => row.id === inputLine.accountId && row.active);
    if (!account) throw new ValidationError("That opening account is missing or inactive.");
    const visibility = visibilityForAccount(account, input.createdBy);
    const kind = normalizeAccountKind(account.kind);
    const side = isLiabilityKind(kind) ? "liability" as const : "asset" as const;
    if (side === "asset") assetCents += inputLine.amountCents;
    else liabilityCents += inputLine.amountCents;
    lines.push({
      accountId: account.id,
      accountName: account.name,
      kind,
      amountCents: inputLine.amountCents,
      side,
      visibility,
      ownerMemberId: account.ownerMemberId,
    });
  }

  if (!lines.length) throw new ValidationError("Enter at least one non-zero opening balance.");
  return {
    asOfDate: input.asOfDate as DateKey,
    createdBy: input.createdBy,
    lines,
    assetCents,
    liabilityCents,
    openingEquityCents: assetCents - liabilityCents,
    balanced: true,
  };
}

export function openingTruthReviewSummary(draft: OpeningTruthDraft): string {
  const accounts = draft.lines.map((line) =>
    `${line.accountName} (${ACCOUNT_KIND_LABEL[line.kind]}) $${(line.amountCents / 100).toFixed(2)}`,
  );
  const equitySide = draft.openingEquityCents < 0 ? " debit" : draft.openingEquityCents > 0 ? " credit" : "";
  return `Opening as of ${draft.asOfDate}: ${accounts.join("; ")}. Opening equity $${(
    Math.abs(draft.openingEquityCents) / 100
  ).toFixed(2)}${equitySide}. Balance sheet only - not income or spending.`;
}

export function householdHasAcceptedMoney(household: Household): boolean {
  return household.transactions.some((transaction) => !transaction.isDuplicate);
}

export function hasPostedOpeningTruth(household: Household): boolean {
  const reversed = new Set(household.transactions
    .filter((transaction) => transaction.source === "reversal" && transaction.reversalOfId)
    .map((transaction) => transaction.reversalOfId));
  return household.transactions.some((transaction) =>
    transaction.source === "opening"
    && !transaction.reversalOfId
    && !reversed.has(transaction.id),
  );
}

/** A fully reversed opening batch is the only accepted-money history that may be replaced. */
export function hasOnlyOpeningCorrectionHistory(household: Household): boolean {
  const openingIds = new Set(household.transactions
    .filter((transaction) => transaction.source === "opening" && !transaction.reversalOfId)
    .map((transaction) => transaction.id));
  return household.transactions.every((transaction) =>
    transaction.isDuplicate
    || transaction.source === "opening"
    || (transaction.source === "reversal" && Boolean(transaction.reversalOfId && openingIds.has(transaction.reversalOfId))),
  );
}

export function openingBatchRows(household: Household, sourceId: string) {
  return household.transactions.filter((transaction) =>
    transaction.type === "opening"
    && transaction.source === "opening"
    && transaction.sourceId === sourceId
    && !transaction.reversalOfId,
  );
}
