import type { Household, LedgerView } from "./types.ts";
import { shapeLedgerNames } from "./ledgerNames.ts";
import { HOUSEHOLD_FUND_NAME, shapeHouseholdFundConfig } from "./householdFund.ts";

/**
 * Customer-facing names for the two spaces and the shared money object
 * (Vision v2 §3, Decision 1 and Decision 10).
 *
 * Stored ledger names are not rewritten: snapshots that still carry the legacy
 * defaults ("Household Ledger", "{Name}'s Personal Ledger") are presented with
 * the space names instead, and any name the couple chose themselves is kept.
 * Presentation only — nothing here posts, renames stored data, or changes scope.
 */
export const MY_MONEY_LABEL = "My Money";
export const OUR_HOME_LABEL = "Our Home";
export const FUND_DEFAULT_LABEL = "The Fund";

const LEGACY_SHARED_DEFAULT = "Household Ledger";
const LEGACY_PERSONAL_SUFFIX = "'s Personal Ledger";
const LEGACY_PERSONAL_FALLBACK = "Personal Ledger";

function isLegacyPersonalDefault(name: string, memberName: string | undefined): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed === LEGACY_PERSONAL_FALLBACK) return true;
  if (memberName && trimmed === `${memberName}${LEGACY_PERSONAL_SUFFIX}`) return true;
  return trimmed.endsWith(LEGACY_PERSONAL_SUFFIX);
}

/** The label for a space in the threshold switcher and the status bar. */
export function spaceLabel(
  household: Pick<Household, "ledgerNames" | "members">,
  memberId: string,
  view: LedgerView,
): string {
  const names = shapeLedgerNames(household.ledgerNames, household.members);
  if (view === "household") {
    const shared = names.shared.trim();
    return !shared || shared === LEGACY_SHARED_DEFAULT ? OUR_HOME_LABEL : shared;
  }
  const member = household.members.find((row) => row.id === memberId);
  const personal = names.personal[memberId] ?? "";
  return isLegacyPersonalDefault(personal, member?.name) ? MY_MONEY_LABEL : personal.trim();
}

/**
 * The Fund's display name: the couple's chosen name when they set one,
 * otherwise "The Fund". Used for the household truth destination label so
 * "My Money" (a space) and "Our Money" (a tab) never sit side by side.
 */
export function fundDisplayName(household: Pick<Household, "householdFund">): string {
  const config = shapeHouseholdFundConfig(household.householdFund);
  const name = config?.name?.trim() ?? "";
  if (!name || name === HOUSEHOLD_FUND_NAME) return FUND_DEFAULT_LABEL;
  return name;
}
