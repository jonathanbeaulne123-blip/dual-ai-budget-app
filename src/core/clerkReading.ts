import { householdFundContributionMotions, activeHouseholdFundEvents } from "./householdFund.ts";
import { sharedMonthCourse } from "./sharedLedgerStory.ts";
import type { DateKey } from "./calendar.ts";
import type { Household, HouseholdFundEvent, Transaction } from "./types.ts";

export type ClerkSentence = {
  id: string;
  text: string;
  transactionIds: string[];
  fundEventIds: string[];
};

export type ClerkReading = {
  since: DateKey;
  today: DateKey;
  sentences: ClerkSentence[];
  tiesToProjection: boolean;
};

function inWindow(date: DateKey, since: DateKey, today: DateKey): boolean {
  return date > since && date <= today;
}

function cad(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function rows(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sentence(
  id: string,
  text: string,
  transactions: Transaction[] = [],
  events: HouseholdFundEvent[] = [],
): ClerkSentence | null {
  const transactionIds = transactions.map((row) => row.id);
  const fundEventIds = events.map((row) => row.id);
  if (!transactionIds.length && !fundEventIds.length) return null;
  return { id, text, transactionIds, fundEventIds };
}

/**
 * A local, cited summary of rows dated after the prior stamp.
 * The return stays intentionally small: a later surface owns disclosure.
 */
export function clerkReading(household: Household, since: DateKey, today: DateKey): ClerkReading {
  const tiesToProjection = sharedMonthCourse(household, today).tiesToProjection;
  if (!tiesToProjection) return { since, today, sentences: [], tiesToProjection };

  const transactions = household.transactions.filter((row) => inWindow(row.date, since, today));
  const events = activeHouseholdFundEvents(household).filter((row) => inWindow(row.date, since, today));
  const expenses = transactions.filter((row) => row.type === "expense");
  const income = transactions.filter((row) => row.type === "income");
  const confirmations = events.filter((row) => row.kind === "contribution-confirmed");
  const waiting = householdFundContributionMotions(household)
    .filter((motion) => (
      (motion.status === "open" || motion.status === "held")
      && inWindow(motion.proposal.date, since, today)
    ))
    .map((motion) => motion.proposal);

  const candidates = [
    sentence(
      "expenses",
      `Since ${since}, ${rows(expenses.length, "expense row", "expense rows")} totalled ${cad(expenses.reduce((sum, row) => sum + row.amountCents, 0))}.`,
      expenses,
    ),
    sentence(
      "income",
      `${rows(income.length, "income row", "income rows")} totalled ${cad(income.reduce((sum, row) => sum + row.amountCents, 0))}.`,
      income,
    ),
    sentence(
      "confirmed-contributions",
      `${cad(confirmations.reduce((sum, row) => sum + row.amountCents, 0))} was confirmed into the Household Fund.`,
      [],
      confirmations,
    ),
    sentence(
      "waiting-motion",
      `${rows(waiting.length, "contribution motion is", "contribution motions are")} waiting in the record.`,
      [],
      waiting,
    ),
  ].filter((row): row is ClerkSentence => row !== null);

  return { since, today, sentences: candidates.slice(0, 4), tiesToProjection };
}
