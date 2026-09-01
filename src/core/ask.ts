import {
  formatMonthLabel,
  monthEndKey,
  monthKeyFromDateKey,
  parseDateKey,
  type DateKey,
} from "./calendar.ts";
import {
  contributionRegister,
  contributionRegisterThrough,
  type ContributionRegister,
} from "./contributionRegister.ts";
import { houseRunRate, type RunRateConfidence } from "./houseRunRate.ts";
import { shapeHouseholdFundConfig } from "./householdFund.ts";
import { formatCad } from "./money.ts";
import type { Household } from "./types.ts";
import { nextWorkScheduleDate } from "./workSettlement.ts";

export type AskHorizon = "month" | "payday";

export type HouseholdAsk = {
  horizon: AskHorizon;
  throughDate: DateKey;
  askCents: number;
  register: ContributionRegister;
  confidence: RunRateConfidence;
  copy: string;
};

export type AskAlternative = {
  goalId: string;
  label: string;
  claimCents: number;
  askIfDeferredCents: number;
  copy: string;
};

const GOAL_CLAIM_PREFIX = "goal-claim:";

function goalClaimIdentity(obligationId: string, date: DateKey): string | null {
  const suffix = `:${date}`;
  if (!obligationId.startsWith(GOAL_CLAIM_PREFIX) || !obligationId.endsWith(suffix)) return null;
  const goalId = obligationId.slice(GOAL_CLAIM_PREFIX.length, -suffix.length);
  return goalId || null;
}

function goalClaimLabel(label: string): string {
  return label.replace(/ · goal claim$/, "");
}

/** Offer proposal-only goal deferrals from the exact register attached to an Ask. */
export function askAlternatives(ask: HouseholdAsk): AskAlternative[] {
  const registerAskCents = ask.register.unfundedCents;
  if (!ask.register.tiesToProjection
    || !Number.isSafeInteger(ask.askCents)
    || ask.askCents < 0
    || ask.askCents !== registerAskCents) return [];
  return ask.register.rows
    .flatMap((row): AskAlternative[] => {
      const goalId = goalClaimIdentity(row.obligationId, row.date);
      if (!goalId || row.unfundedCents <= 0) return [];
      const label = goalClaimLabel(row.label);
      const askIfDeferredCents = Math.max(0, registerAskCents - row.amountCents);
      return [{
        goalId,
        label,
        claimCents: row.amountCents,
        askIfDeferredCents,
        copy: `Or move ${label} to next month, and the ask is ${formatCad(askIfDeferredCents)}.`,
      }];
    })
    .sort((left, right) => right.claimCents - left.claimCents
      || left.label.localeCompare(right.label)
      || left.goalId.localeCompare(right.goalId));
}

/** Earliest active-work payday for a member, projected from timing only. */
export function nextPaydayDate(household: Household, memberId: string, today: DateKey): DateKey | null {
  return (household.workJobs ?? [])
    .filter((job) => job.active && job.memberId === memberId)
    .map((job) => ({ id: job.id, date: nextWorkScheduleDate(job.paySchedule, today) }))
    .filter((row): row is { id: string; date: DateKey } => Boolean(row.date))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))[0]?.date ?? null;
}

function ordinal(day: number): string {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${day}th`;
  const suffix = day % 10 === 1 ? "st" : day % 10 === 2 ? "nd" : day % 10 === 3 ? "rd" : "th";
  return `${day}${suffix}`;
}

function monthName(monthKey: string): string {
  return formatMonthLabel(monthKey).split(" ")[0]!;
}

function askCopy(
  horizon: AskHorizon,
  throughDate: DateKey,
  askCents: number,
  confidence: RunRateConfidence,
  weeksWatched: number,
  monthKey: string,
): string {
  const month = monthName(monthKey);
  const caveat = ` — though I've only watched ${weeksWatched} weeks of this house.`;
  if (horizon === "payday") {
    const secondary = `${formatCad(askCents)} of that lands before the ${ordinal(parseDateKey(throughDate).day)}`;
    return confidence === "watching" ? `${secondary}${caveat}` : `${secondary}.`;
  }
  if (askCents === 0) return `${month} is covered.`;
  return confidence === "watching"
    ? `${month} still needs ${formatCad(askCents)}${caveat}`
    : `${month} still needs ${formatCad(askCents)}.`;
}

/** Say the register's unfunded tail at the primary month or secondary payday horizon. */
export function householdAsk(
  household: Household,
  today: DateKey,
  horizon: AskHorizon = "month",
): HouseholdAsk {
  const monthKey = monthKeyFromDateKey(today);
  const runRate = houseRunRate(household, today);
  const monthThroughDate = monthEndKey(monthKey);
  const monthRegister = contributionRegister(household, monthKey, today);
  const fund = shapeHouseholdFundConfig(household.householdFund);
  const payday = horizon === "payday" && fund
    ? nextPaydayDate(household, fund.custodianMemberId, today)
    : null;

  const effectiveHorizon: AskHorizon = payday ? "payday" : "month";
  const throughDate = payday ?? monthThroughDate;
  const register = payday
    ? contributionRegisterThrough(household, monthKey, today, payday)
    : monthRegister;
  const askCents = register.unfundedCents;

  return {
    horizon: effectiveHorizon,
    throughDate,
    askCents,
    register,
    confidence: runRate.confidence,
    copy: askCopy(effectiveHorizon, throughDate, askCents, runRate.confidence, runRate.weeksWatched, monthKey),
  };
}
