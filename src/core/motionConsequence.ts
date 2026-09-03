import type { DateKey, MonthKey } from "./calendar.ts";
import { fundWalk, fundWalkWith } from "./fundWalk.ts";
import { householdFundContributionMotions } from "./householdFund.ts";
import { formatCad } from "./money.ts";
import type { Household } from "./types.ts";

/**
 * What confirming a raised contribution would actually do — before anyone
 * confirms it. A preview, never an approval: this module reads the walk
 * twice (once as-is, once with the motion hypothetically confirmed) and
 * never calls a command. Nothing here writes.
 */

export type MotionConsequence = {
  eventId: string;
  balanceAfterCents: number;
  dryDateBefore: DateKey | null;
  dryDateAfter: DateKey | null;
  shortfallBeforeCents: number;
  shortfallAfterCents: number;
  copy: string;
};

function ordinal(date: DateKey): string {
  const day = Number(date.slice(8, 10));
  const rest = day % 100;
  const suffix = rest >= 11 && rest <= 13 ? "th"
    : day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

function consequenceCopy(input: {
  balanceAfterCents: number;
  dryDateBefore: DateKey | null;
  dryDateAfter: DateKey | null;
  shortfallBeforeCents: number;
  shortfallAfterCents: number;
}): string {
  const balance = formatCad(input.balanceAfterCents);
  if (input.dryDateBefore && input.dryDateAfter && input.dryDateBefore !== input.dryDateAfter) {
    return `Confirming this puts the Fund at ${balance} and moves the dry date from the `
      + `${ordinal(input.dryDateBefore)} to the ${ordinal(input.dryDateAfter)}. It would leave the month `
      + `${formatCad(input.shortfallAfterCents)} short instead of ${formatCad(input.shortfallBeforeCents)}.`;
  }
  if (input.dryDateBefore && !input.dryDateAfter) {
    return `Confirming this puts the Fund at ${balance} and clears the month.`;
  }
  return `Confirming this puts the Fund at ${balance}. It doesn't change what the month needs.`;
}

/**
 * `null` for anything that isn't an open or held contribution proposal —
 * a confirmed or withdrawn motion has nothing left to preview, and an
 * unknown id was never a motion at all.
 */
export function motionConsequence(
  household: Household,
  monthKey: MonthKey,
  today: DateKey,
  eventId: string,
): MotionConsequence | null {
  const motion = householdFundContributionMotions(household).find((row) => row.proposal.id === eventId);
  if (!motion || (motion.status !== "open" && motion.status !== "held")) return null;

  const before = fundWalk(household, monthKey, today);
  const after = fundWalkWith(household, monthKey, today, { confirmEventIds: [eventId] });
  const balanceAfterCents = after.todayBalanceCents;
  const dryDateBefore = before.dryDate;
  const dryDateAfter = after.dryDate;
  const shortfallBeforeCents = before.shortfallCents;
  const shortfallAfterCents = after.shortfallCents;

  return {
    eventId,
    balanceAfterCents,
    dryDateBefore,
    dryDateAfter,
    shortfallBeforeCents,
    shortfallAfterCents,
    copy: consequenceCopy({ balanceAfterCents, dryDateBefore, dryDateAfter, shortfallBeforeCents, shortfallAfterCents }),
  };
}
