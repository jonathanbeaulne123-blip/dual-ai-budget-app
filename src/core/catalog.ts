import { TIMEZONE, isValidDateKey, isValidIanaTimeZone, type DateKey } from "./calendar.ts";
import { CURRENCY, parseWholeCents } from "./money.ts";
import type { Category, Household, Member, Account, Split, TransactionType } from "./types.ts";
import { JOINT, ValidationError } from "./types.ts";
import { assertSplits } from "./splits.ts";

/** Books civil zone is America/Toronto (D-126 Q2 C). Phone display zones live in phone prefs. */
export function requireTimezone(household: Household): void {
  if (household.timezone !== TIMEZONE) {
    throw new ValidationError(`Household books timezone must be ${TIMEZONE} (got ${household.timezone || "empty"}).`);
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
  return household?.timezone === TIMEZONE ? TIMEZONE : TIMEZONE;
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

function normalizeCatalogRef(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findAccountByRef(household: Household, ref: string): Account {
  const trimmed = ref.trim();
  if (!trimmed) throw new ValidationError("Choose an account.");
  const accounts = activeAccounts(household);
  const exact = accounts.find((item) => item.id === trimmed);
  if (exact) return requireAccount(household, exact.id);
  const needle = normalizeCatalogRef(trimmed);
  const matches = accounts.filter((account) => {
    const hay = normalizeCatalogRef(`${account.name} ${account.institution} ${account.last4}`);
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
  if (matches.length === 1) return requireAccount(household, matches[0]!.id);
  if (matches.length > 1) throw new ValidationError(`More than one account matches “${trimmed}”. Name the exact account.`);
  throw new ValidationError(`Account “${trimmed}” is not active in Hearth.`);
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

export function findSubcategoryByRef(household: Household, ref: string, type: "expense" | "income"): Category {
  const trimmed = ref.trim();
  if (!trimmed) throw new ValidationError("Choose a category.");
  const categories = activeCategories(household).filter(
    (item) => item.recordType === "category" && item.transactionType === type,
  );
  const exact = categories.find((item) => item.id === trimmed);
  if (exact) return requireSubcategory(household, exact.id, type);
  const needle = normalizeCatalogRef(trimmed);
  const matches = categories.filter((category) => {
    const parent = household.categories.find((item) => item.id === category.parentId);
    const hay = normalizeCatalogRef(`${parent?.name ?? ""} ${category.name}`);
    const nameOnly = normalizeCatalogRef(category.name);
    return nameOnly === needle || hay === needle || nameOnly.includes(needle) || needle.includes(nameOnly) || hay.includes(needle);
  });
  if (matches.length === 1) return requireSubcategory(household, matches[0]!.id, type);
  if (matches.length > 1) throw new ValidationError(`More than one ${type} category matches “${trimmed}”. Name the exact category.`);
  throw new ValidationError(`${type === "expense" ? "Expense" : "Income"} category “${trimmed}” is not active in Hearth.`);
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
