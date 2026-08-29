import type { DateKey } from "./calendar.ts";
import { activeHouseholdFundEvents, projectHouseholdFund } from "./householdFund.ts";
import type { Account, Goal, Household, Recurrence, Transaction } from "./types.ts";

export type PersonalPosition = {
  accountId: string;
  name: string;
  kind: Account["kind"];
};

export type PersonalActivity = {
  id: string;
  date: DateKey;
  type: Transaction["type"];
  note: string;
  amountCents: number;
  visibility: Transaction["visibility"];
};

export type PersonalObligation = {
  id: string;
  kind: "goal" | "recurrence";
  name: string;
  amountCents: number;
  sharedChoice: boolean;
};

export type PersonalContributionBridge = {
  eventId: string;
  date: DateKey;
  amountCents: number;
  status: "proposed" | "confirmed";
};

export type PersonalLedgerStory = {
  headline: string;
  body: string;
  privacySeal: string;
  position: PersonalPosition[];
  activity: PersonalActivity[];
  obligations: PersonalObligation[];
  contributionBridge: PersonalContributionBridge[];
  sharedChoicesCount: number;
  privateReconciliationAvailable: boolean;
};

function ownGoals(household: Household, memberId: string): Goal[] {
  return (household.goals ?? []).filter((goal) => !goal.shared && goal.ownerMemberId === memberId && goal.status !== "retired");
}

function ownRecurrences(household: Household, memberId: string): Recurrence[] {
  return (household.recurrences ?? []).filter((row) => {
    const account = household.accounts.find((item) => item.id === row.accountId);
    return account?.scope === "personal" && account.ownerMemberId === memberId && row.active;
  });
}

export function buildPersonalLedgerStory(
  projectedPersonal: Household,
  memberId: string,
  today: DateKey,
): PersonalLedgerStory {
  const memberName = projectedPersonal.members.find((member) => member.id === memberId)?.name ?? "You";
  const activity = [...projectedPersonal.transactions]
    .filter((tx) => tx.createdBy === memberId)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8)
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type,
      note: tx.note || tx.place || tx.type,
      amountCents: tx.amountCents,
      visibility: tx.visibility,
    }));
  const events = activeHouseholdFundEvents(projectedPersonal);
  const contributionBridge = events
    .filter((event) => (
      (event.kind === "contribution-proposed" || event.kind === "contribution-confirmed")
      && event.contributorMemberId === memberId
    ))
    .map((event) => ({
      eventId: event.id,
      date: event.date,
      amountCents: event.amountCents,
      status: event.kind === "contribution-confirmed" ? "confirmed" as const : "proposed" as const,
    }));
  const obligations: PersonalObligation[] = [
    ...ownGoals(projectedPersonal, memberId).map((goal) => ({
      id: goal.id,
      kind: "goal" as const,
      name: goal.name,
      amountCents: Math.max(0, goal.targetCents - goal.savedCents),
      sharedChoice: false,
    })),
    ...ownRecurrences(projectedPersonal, memberId).map((row) => ({
      id: row.id,
      kind: "recurrence" as const,
      name: row.note || "Standing Personal item",
      amountCents: row.amountCents,
      sharedChoice: false,
    })),
  ];
  const bothChoices = activity.filter((row) => row.visibility === "both");
  return {
    headline: `${memberName}’s folio`,
    body: "This is a private money room: my accounts, my movement, my obligations, and what I chose to share. It is not the Shared household table.",
    privacySeal: "Account metadata, institution, last four digits, totals, and private Fund reconciliation stay in this member’s Personal envelope.",
    position: projectedPersonal.accounts
      .filter((account) => account.scope === "personal" && account.ownerMemberId === memberId && account.active)
      .map((account) => ({ accountId: account.id, name: account.name, kind: account.kind })),
    activity,
    obligations,
    contributionBridge,
    sharedChoicesCount: bothChoices.length,
    privateReconciliationAvailable: projectedPersonal.householdFund?.custodianMemberId === memberId
      && Boolean(projectHouseholdFund(projectedPersonal, today).configured),
  };
}
