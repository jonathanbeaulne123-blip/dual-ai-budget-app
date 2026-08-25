import { DEFAULT_TIMEZONE, isValidDateKey, isValidIanaTimeZone, type DateKey } from "./calendar.ts";
import { CURRENCY, parseWholeCents } from "./money.ts";
import type { Category, Household, Member, Account, Split, TransactionType } from "./types.ts";
import { JOINT, ValidationError } from "./types.ts";
import { assertSplits } from "./splits.ts";

export function requireTimezone(household: Household): void {
  if (!isValidIanaTimeZone(household.timezone)) {
    throw new ValidationError(`Household timezone must be a valid IANA zone (got ${household.timezone || "empty"}).`);
  }
}

export function requireIanaTimeZone(timeZone: string): string {
  const trimmed = timeZone.trim();
  if (!isValidIanaTimeZone(trimmed)) {
    throw new ValidationError("Choose a valid IANA timezone.");
  }
  return trimmed;
}

export function householdTimeZone(household: Pick<Household, "timezone"> | null | undefined): string {
  const zone = household?.timezone?.trim();
  return zone && isValidIanaTimeZone(zone) ? zone : DEFAULT_TIMEZONE;
}

export function activeMembers(household: Household): Member[] {
  return household.members.filter((member) => member.active);
}

export function activeAccounts(household: Household): Account[] {
  return household.accounts.filter((account) => account.active);
}

export function activeCategories(household: Household): Category[] {
  return household.categories.filter((category) => category.active);
}

export function requireAccount(household: Household, accountId: string): Account {
  const account = activeAccounts(household).find((item) => item.id === accountId);
  if (!account) throw new ValidationError("Account is no longer active — please choose again.");
  if (account.currency !== CURRENCY) {
    throw new ValidationError(`Only ${CURRENCY} accounts can be used until multi-currency is enabled.`);
  }
  return account;
}

export function requireCadAccounts(household: Household): Account[] {
  const accounts = activeAccounts(household);
  if (accounts.length === 0) throw new ValidationError("Add an active CAD account before posting.");
  const bad = accounts.filter((account) => account.currency !== CURRENCY);
  if (bad.length) throw new ValidationError("Every active account must use CAD.");
  return accounts;
}

export function requireMember(household: Household, memberId: string): Member {
  const member = activeMembers(household).find((item) => item.id === memberId);
  if (!member) throw new ValidationError("Household member is no longer active — please choose again.");
  return member;
}

export function requireParty(household: Household, party: string): void {
  if (party === JOINT) return;
  requireMember(household, party);
}

export function requireSubcategory(household: Household, subcategoryId: string, type?: "expense" | "income"): Category {
  const category = activeCategories(household).find((item) => item.id === subcategoryId && item.recordType === "category");
  if (!category) throw new ValidationError("Category is no longer active — please choose again.");
  if (type && category.transactionType !== type) {
    throw new ValidationError("Selected category does not match the transaction type — please choose again.");
  }
  if (!category.parentId) throw new ValidationError("Category configuration is incomplete — run Health Check.");
  const parent = household.categories.find((item) => item.id === category.parentId);
  if (!parent || parent.recordType !== "group" || !parent.active) {
    throw new ValidationError("Category group is missing or inactive — run Health Check.");
  }
  return category;
}

export function incomeSubcategory(household: Household, name: string): Category {
  const matches = activeCategories(household).filter(
    (category) =>
      category.recordType === "category" &&
      category.transactionType === "income" &&
      category.name.toLowerCase() === name.toLowerCase(),
  );
  if (matches.length > 1) throw new ValidationError(`More than one Income category named "${name}" exists. Run Health Check.`);
  const found = matches[0];
  if (!found) throw new ValidationError(`Income category "${name}" is missing. Add it before posting a shift.`);
  return found;
}

export function parseDate(value: string): DateKey {
  if (typeof value !== "string" || !isValidDateKey(value)) {
    throw new ValidationError("Date must be a valid Toronto calendar date in YYYY-MM-DD format.");
  }
  return value.trim();
}

export function parseAmount(value: string | number, label = "Amount"): number {
  try {
    return parseWholeCents(value, label);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error));
  }
}

export function validateOwnedAmount(splits: Split[], amountCents: number, household: Household): Split[] {
  const cleaned = assertSplits(splits, amountCents);
  for (const split of cleaned) requireParty(household, split.party);
  return cleaned;
}

export function assertType(type: string): TransactionType {
  if (type !== "expense" && type !== "income" && type !== "transfer" && type !== "refund") {
    throw new ValidationError("Transaction type must be expense, income, transfer, or refund.");
  }
  return type;
}
