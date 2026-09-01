import type {
  CharterCeilingKind,
  CharterSplitRule,
  CommitResult,
  Household,
  HouseholdCharter,
} from "./types.ts";
import { foundHouseholdCharter, grantCharterPermission } from "./commands.ts";
import type { DateKey } from "./calendar.ts";

export const CHARTER_FOUNDING_QUESTION_COUNT = 5;
export const CHARTER_FOUNDING_PURPOSE_MAX = 240;
export const CHARTER_FOUNDING_NOTE_MAX = 240;
export const CHARTER_FOUNDING_PERMISSION_MAX = 90;
export const CHARTER_FOUNDING_COUNTER_AT = 200;

export const CHARTER_FOUNDING_COPY = {
  q1: "What is this money for?",
  q1Sub: "One or two sentences. It goes at the top of the page and it settles most arguments before they start.",
  q2: "How do we decide who puts in what?",
  q2Sub: "There's no wrong answer. You can change it later, together.",
  even: "Evenly",
  evenBody: "We each put in half of what the house costs.",
  proportional: "By what we each earn",
  proportionalBody: "We each put in a share that matches our income.",
  remainder: "One of us covers what's left",
  remainderBody: "Bianca's pay covers what it covers. Jonathan closes the rest by picking up shifts.",
  ownWords: "in your own words",
  q3: "What needs both of us, and what can either of us just do?",
  q4: "When do we sit down?",
  weekly: "Weekly",
  biweekly: "Every other week",
  monthly: "Monthly",
  cadenceNone: "We don't yet",
  q5: "How much work is too much?",
  q5Sub: "If closing a month would take more than this, Hearth stops offering shifts and offers to move a goal instead.",
  hours: "Hours a week",
  dollars: "Dollars a month",
  ceilingNone: "No ceiling yet",
  close: "That's your charter.",
  closeSub: "You can sign it now or later. It works either way.",
  sign: "Sign it",
  later: "Later",
  skip: "decide this later",
  next: "Next",
  add: "+ add",
} as const;

export const CHARTER_FOUNDING_SPLIT_CARDS: Array<{
  rule: CharterSplitRule;
  heading: string;
  body: string;
}> = [
  { rule: "even", heading: CHARTER_FOUNDING_COPY.even, body: CHARTER_FOUNDING_COPY.evenBody },
  { rule: "proportional", heading: CHARTER_FOUNDING_COPY.proportional, body: CHARTER_FOUNDING_COPY.proportionalBody },
  { rule: "remainder", heading: CHARTER_FOUNDING_COPY.remainder, body: CHARTER_FOUNDING_COPY.remainderBody },
];

export type CharterFoundingDraft = {
  purpose: string;
  splitRule: CharterSplitRule | null;
  splitNote: string;
  permissionLabels: string[];
  cadence: HouseholdCharter["cadence"] | null;
  cadenceWeekday: number;
  ceilingKind: CharterCeilingKind | null;
  ceilingHours: string;
  ceilingDollars: string;
  step: number;
};

export function defaultCharterPermissionLabel(household: Household): string {
  const bianca = household.members.find((member) => member.name.toLowerCase() === "bianca");
  const name = bianca?.name ?? household.members[0]?.name ?? "Bianca";
  return `${name} can spend from the Fund on anything we've already agreed is a household bill.`;
}

export function emptyCharterFoundingDraft(household: Household): CharterFoundingDraft {
  return {
    purpose: "",
    splitRule: null,
    splitNote: "",
    permissionLabels: [defaultCharterPermissionLabel(household)],
    cadence: null,
    cadenceWeekday: 0,
    ceilingKind: null,
    ceilingHours: "",
    ceilingDollars: "",
    step: 0,
  };
}

export function householdNeedsCharterFounding(household: Household): boolean {
  return !household.charter
    && !household.householdFund
    && household.transactions.length === 0
    && (household.fundEvents ?? []).length === 0
    && household.accounts.length === 0
    && household.members.some((member) => member.active !== false);
}

export function defaultCharterCustodianMemberId(household: Household): string {
  const fundCustodian = household.householdFund?.custodianMemberId;
  if (fundCustodian && household.members.some((member) => member.id === fundCustodian)) return fundCustodian;
  const bianca = household.members.find((member) => member.active !== false && member.name.toLowerCase() === "bianca");
  if (bianca) return bianca.id;
  const first = household.members.find((member) => member.active !== false);
  if (!first) throw new Error("A household member is required to found the charter.");
  return first.id;
}

export function skipCharterFoundingStep(draft: CharterFoundingDraft, step: number): CharterFoundingDraft {
  if (step === 0) return { ...draft, purpose: "", step: 1 };
  if (step === 1) return { ...draft, splitRule: "remainder", splitNote: "", step: 2 };
  if (step === 2) return { ...draft, permissionLabels: [], step: 3 };
  if (step === 3) return { ...draft, cadence: "none", cadenceWeekday: 0, step: 4 };
  if (step === 4) return { ...draft, ceilingKind: "none", ceilingHours: "", ceilingDollars: "", step: 5 };
  return { ...draft, step: Math.min(draft.step + 1, 5) };
}

export function resolvedCharterFoundingCeiling(draft: CharterFoundingDraft): {
  ceilingKind: CharterCeilingKind;
  ceilingValue?: string;
} {
  if (draft.ceilingKind === "hours-per-week" && draft.ceilingHours.trim()) {
    return { ceilingKind: "hours-per-week", ceilingValue: draft.ceilingHours.trim() };
  }
  if (draft.ceilingKind === "amount-per-month" && draft.ceilingDollars.trim()) {
    return { ceilingKind: "amount-per-month", ceilingValue: draft.ceilingDollars.trim() };
  }
  return { ceilingKind: "none" };
}

export function permissionActorMemberId(
  household: Household,
  founderId: string,
  label: string,
): string | null {
  const haystack = label.toLowerCase();
  const named = household.members.find((member) => (
    member.id !== founderId
    && member.active !== false
    && haystack.includes(member.name.toLowerCase())
  ));
  if (named) return named.id;
  return household.members.find((member) => member.id !== founderId && member.active !== false)?.id ?? null;
}

export function commitCharterFounding(
  household: Household,
  input: { memberId: string; today: DateKey; draft: CharterFoundingDraft },
): CommitResult {
  const ceiling = resolvedCharterFoundingCeiling(input.draft);
  const cadence = input.draft.cadence ?? "none";
  let result = foundHouseholdCharter(household, {
    memberId: input.memberId,
    custodianMemberId: defaultCharterCustodianMemberId(household),
    purpose: input.draft.purpose,
    splitRule: input.draft.splitRule ?? "remainder",
    splitNote: input.draft.splitNote,
    ceilingKind: ceiling.ceilingKind,
    ceilingValue: ceiling.ceilingValue,
    cadence,
    cadenceWeekday: cadence === "weekly" || cadence === "biweekly" ? input.draft.cadenceWeekday : undefined,
    date: input.today,
  });
  for (const label of input.draft.permissionLabels.map((row) => row.trim()).filter(Boolean)) {
    const actorMemberId = permissionActorMemberId(result.household, input.memberId, label);
    if (!actorMemberId) continue;
    result = grantCharterPermission(result.household, {
      memberId: input.memberId,
      actorMemberId,
      label,
    });
  }
  return result;
}
