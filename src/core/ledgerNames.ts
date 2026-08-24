import type { Household, HouseholdLedgerNames, LedgerView, Member } from "./types.ts";
import { ValidationError } from "./types.ts";

const MAX_LEDGER_NAME = 80;

function requiredName(value: string, label: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new ValidationError(`${label} is required.`);
  if (cleaned.length > MAX_LEDGER_NAME) {
    throw new ValidationError(`${label} must be ${MAX_LEDGER_NAME} characters or fewer.`);
  }
  return cleaned;
}

export function shapeLedgerNames(
  names: HouseholdLedgerNames | undefined,
  members: Member[],
): HouseholdLedgerNames {
  const personal = { ...(names?.personal ?? {}) };
  for (const member of members) {
    const current = personal[member.id]?.trim();
    personal[member.id] = current || `${member.name}'s Personal Ledger`;
  }
  return {
    shared: names?.shared?.trim() || "Household Ledger",
    personal,
  };
}

export function nameHouseholdLedgers(
  household: Household,
  input: {
    householdName: string;
    sharedLedgerName: string;
    personalLedgerName: string;
    personalMemberId: string;
  },
): Household {
  const member = household.members.find((item) => item.active && item.id === input.personalMemberId);
  if (!member) throw new ValidationError("Choose who owns this Personal ledger.");
  const names = shapeLedgerNames(household.ledgerNames, household.members);
  return {
    ...household,
    name: requiredName(input.householdName, "Household name"),
    ledgerNames: {
      shared: requiredName(input.sharedLedgerName, "Shared ledger name"),
      personal: {
        ...names.personal,
        [member.id]: requiredName(input.personalLedgerName, "Personal ledger name"),
      },
    },
  };
}

export function ledgerNameForView(household: Household, memberId: string, view: LedgerView): string {
  const names = shapeLedgerNames(household.ledgerNames, household.members);
  return view === "personal"
    ? names.personal[memberId] || "Personal Ledger"
    : names.shared;
}
