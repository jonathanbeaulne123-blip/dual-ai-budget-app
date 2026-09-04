import { isValidDateKey } from "../calendar.ts";
import { JOINT, type Household, type Recurrence, type RecurrenceCadence } from "../types.ts";

export const ONBOARDING_RECURRENCE_MINIMUM = 2;
export const ONBOARDING_RECURRENCE_PAUSE_EVERY = 3;

const CADENCES = new Set<RecurrenceCadence>(["daily", "weekly", "biweekly", "monthly"]);
const RENT_EQUIVALENT_WORDS = /\b(rent|rental|mortgage|housing|lease|property tax|condo fee|strata fee|home loan)\b/i;

export type OnboardingRecurrenceProbe = {
  rows: Recurrence[];
  rentEquivalentId: string | null;
  complete: boolean;
  missing: Array<"rent-equivalent" | "another-recurrence">;
};

function validIso(value: string): boolean {
  return Boolean(value.trim()) && !Number.isNaN(Date.parse(value));
}

function validSharedRecurrence(household: Household, recurrence: Recurrence): boolean {
  const account = household.accounts.find((candidate) => candidate.id === recurrence.accountId);
  if (!recurrence.id.trim()
    || !recurrence.active
    || !account?.active
    || account.scope === "personal"
    || account.currency !== household.currency
    || !CADENCES.has(recurrence.cadence)
    || !isValidDateKey(recurrence.nextDate)
    || !Number.isInteger(recurrence.amountCents)
    || recurrence.amountCents <= 0
    || !validIso(recurrence.createdAt)
    || !validIso(recurrence.updatedAt)
    || recurrence.splits.length === 0
    || recurrence.splits.some((split) => !Number.isInteger(split.amountCents) || split.amountCents < 0)
    || recurrence.splits.reduce((sum, split) => sum + split.amountCents, 0) !== recurrence.amountCents
    || recurrence.splits.some((split) => split.party !== JOINT
      && !household.members.some((member) => member.active && member.id === split.party))) {
    return false;
  }

  if (recurrence.type === "transfer") {
    const destination = household.accounts.find((candidate) => candidate.id === recurrence.transferToAccountId);
    return Boolean(destination?.active
      && destination.scope !== "personal"
      && destination.currency === household.currency
      && destination.id !== account.id);
  }

  const category = household.categories.find((candidate) => candidate.id === recurrence.subcategoryId);
  return Boolean(category?.active
    && category.recordType === "category"
    && category.transactionType === recurrence.type);
}

/** A stable housing anchor: an explicit housing label, or a fixed essential in the Housing group. */
export function isRentEquivalentRecurrence(household: Household, recurrence: Recurrence): boolean {
  if (recurrence.type !== "expense") return false;
  const category = household.categories.find((candidate) => candidate.id === recurrence.subcategoryId);
  const parent = category?.parentId
    ? household.categories.find((candidate) => candidate.id === category.parentId)
    : null;
  const words = `${recurrence.note} ${category?.name ?? ""}`;
  if (RENT_EQUIVALENT_WORDS.test(words)) return true;
  return Boolean(category?.essential
    && category.incomeStability === "fixed"
    && parent?.recordType === "group"
    && /\bhousing\b/i.test(`${parent.id} ${parent.name}`));
}

/**
 * The Chapter 7 probe reads existing standing facts without adding, posting,
 * advancing, or otherwise mutating a recurrence. Duplicate ids count once.
 */
export function onboardingRecurrenceProbe(household: Household): OnboardingRecurrenceProbe {
  const byId = new Map<string, Recurrence>();
  for (const recurrence of household.recurrences) {
    if (!validSharedRecurrence(household, recurrence)) continue;
    const current = byId.get(recurrence.id);
    if (!current || recurrence.updatedAt > current.updatedAt) byId.set(recurrence.id, recurrence);
  }
  const rows = [...byId.values()]
    .sort((left, right) => left.nextDate.localeCompare(right.nextDate) || left.id.localeCompare(right.id));
  const rentEquivalentId = rows.find((row) => isRentEquivalentRecurrence(household, row))?.id ?? null;
  const hasAnother = Boolean(rentEquivalentId && rows.some((row) => row.id !== rentEquivalentId));
  const missing: OnboardingRecurrenceProbe["missing"] = [];
  if (!rentEquivalentId) missing.push("rent-equivalent");
  if (!hasAnother) missing.push("another-recurrence");
  return {
    rows,
    rentEquivalentId,
    complete: Boolean(rentEquivalentId && hasAnother && rows.length >= ONBOARDING_RECURRENCE_MINIMUM),
    missing,
  };
}

export function onboardingRecurrenceCadenceLabel(cadence: RecurrenceCadence): string {
  if (cadence === "daily") return "Daily";
  if (cadence === "weekly") return "Weekly";
  if (cadence === "biweekly") return "Every 2 weeks";
  return "Monthly";
}

export function onboardingRecurrencePauseDue(count: number): boolean {
  return count > 0 && count % ONBOARDING_RECURRENCE_PAUSE_EVERY === 0;
}
