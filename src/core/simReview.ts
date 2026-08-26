/**
 * Simulation and historical review packs for Hercules (D-138).
 * Cash Cinema, What-If Desk, and Year-in-Review — projections only; never post.
 */
import {
  addDays,
  calendarDaysBetween,
  monthKeyFromDateKey,
  shiftMonthKey,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import { accountBookBalance } from "./accounts.ts";
import { isCashLikeKind } from "./accountKinds.ts";
import { monthSummary } from "./budget.ts";
import { budgetVariance } from "./statements.ts";
import { formatCad, sumCents } from "./money.ts";
import { projectCadence } from "./recurrence.ts";
import { leftoverProjection } from "./sitDown.ts";
import { creditCardView } from "./accounts.ts";
import { runTipOracle, observeTipShifts } from "./tipScience.ts";
import { workShiftIsReversed } from "./work.ts";
import type { Household } from "./types.ts";

export type CashCinemaWeek = {
  weekStart: DateKey;
  weekEnd: DateKey;
  openingCashCents: number;
  tipFloorCents: number;
  tipTypicalCents: number;
  wagesEstimateCents: number;
  billsCents: number;
  cardMinsCents: number;
  closingCashCents: number;
  dry: boolean;
};

export type CashCinemaResult = {
  weeks: CashCinemaWeek[];
  openingCashCents: number;
  lowestCashCents: number;
  dryWeeks: number;
  assumptions: string[];
};

export type WhatIfScenario = "cut_one_dinner_shift" | "extra_card_pay" | "purchase" | "tax_milk_boost";

export type WhatIfResult = {
  scenario: WhatIfScenario;
  label: string;
  beforeCashCents: number;
  afterCashCents: number;
  beforeTipFloorCents: number;
  afterTipFloorCents: number;
  deltaCashCents: number;
  fits: boolean;
  assumptions: string[];
};

export type YearReviewResult = {
  fromMonth: MonthKey;
  toMonth: MonthKey;
  tipMonths: Array<{ month: MonthKey; tipCents: number; shifts: number }>;
  bestTipMonth: MonthKey | null;
  worstTipMonth: MonthKey | null;
  totalTipsCents: number;
  totalIncomeCents: number;
  totalSpendCents: number;
  budgetMissCount: number;
  shiftCount: number;
  assumptions: string[];
};

function outgoingBills(household: Household, start: DateKey, end: DateKey): number {
  let total = 0;
  for (const item of household.recurrences) {
    if (!item.active || item.type !== "expense") continue;
    if (item.kind !== "bill" && item.kind !== "subscription" && item.kind !== "other") continue;
    for (const date of projectCadence(item.nextDate, item.cadence, start, end)) {
      if (date >= start && date <= end) total += item.amountCents;
    }
  }
  return total;
}

function cashLike(household: Household, asOf: DateKey): number {
  return sumCents(
    household.accounts
      .filter((account) => account.active && isCashLikeKind(account.kind))
      .map((account) => Math.max(0, accountBookBalance(household, account.id, asOf))),
  );
}

function cardMins(household: Household, asOf: DateKey): number {
  return sumCents(
    household.accounts
      .filter((account) => account.active && account.kind === "credit")
      .map((account) => creditCardView(household, account, asOf).minPaymentCents),
  );
}

function weeklyWageEstimate(household: Household, memberId?: string): number {
  const shifts = household.shifts.filter((shift) => {
    if (memberId && shift.memberId !== memberId) return false;
    return !workShiftIsReversed(household, shift);
  });
  if (!shifts.length) return 0;
  const first = shifts.map((row) => row.date).sort()[0]!;
  const last = shifts.map((row) => row.date).sort().at(-1)!;
  const weeks = Math.max(1, (calendarDaysBetween(first, last) + 1) / 7);
  const wages = shifts.reduce((sum, row) => sum + row.wagesCents, 0);
  return Math.round(wages / weeks);
}

/** 13-week forward cash path using tip floor/typical, wage pace, bills, and card mins. */
export function runCashCinema(
  household: Household,
  today: DateKey,
  options?: { memberId?: string; weeks?: number },
): CashCinemaResult {
  const weekCount = Math.min(13, Math.max(4, Math.round(options?.weeks ?? 13)));
  const opening = leftoverProjection(household, today).cashLikeCents || cashLike(household, today);
  const oracle = runTipOracle(household, {
    memberId: options?.memberId,
    today,
    horizonDays: weekCount * 7,
    iterations: 800,
    seed: 211,
  });
  const tipFloorWeekly = oracle ? Math.round(oracle.p10Cents / weekCount) : 0;
  const tipTypicalWeekly = oracle ? Math.round(oracle.p50Cents / weekCount) : 0;
  const wagesWeekly = weeklyWageEstimate(household, options?.memberId);
  const weeks: CashCinemaWeek[] = [];
  let cash = opening;
  let lowest = opening;
  let dryWeeks = 0;
  for (let i = 0; i < weekCount; i += 1) {
    const weekStart = addDays(today, i * 7 + 1);
    const weekEnd = addDays(weekStart, 6);
    const bills = outgoingBills(household, weekStart, weekEnd);
    const mins = i === 0 ? cardMins(household, today) : 0; // card mins once at front; avoid weekly double-count
    const openingCash = cash;
    cash = cash + tipTypicalWeekly + wagesWeekly - bills - mins;
    const dry = cash < tipFloorWeekly; // below one week of tip floor = pressure
    if (dry) dryWeeks += 1;
    lowest = Math.min(lowest, cash);
    weeks.push({
      weekStart,
      weekEnd,
      openingCashCents: openingCash,
      tipFloorCents: tipFloorWeekly,
      tipTypicalCents: tipTypicalWeekly,
      wagesEstimateCents: wagesWeekly,
      billsCents: bills,
      cardMinsCents: mins,
      closingCashCents: cash,
      dry,
    });
  }
  return {
    weeks,
    openingCashCents: opening,
    lowestCashCents: lowest,
    dryWeeks,
    assumptions: [
      "Cash Cinema is a 13-week projection ribbon, not posted balances.",
      "Tip floor/typical come from the Shift Oracle Monte Carlo; wages use historical weekly pace.",
      "Scheduled bills are cadence projections until Confirm marks them paid.",
      "Card minimums are applied once at the start of the ribbon to avoid weekly double-counting.",
      "Dry week means closing cash falls below one week of tip-floor income — a planning flag, not an overdraft fact.",
    ],
  };
}

export function runWhatIfDesk(
  household: Household,
  today: DateKey,
  input: {
    scenario: WhatIfScenario;
    amountCents?: number;
    memberId?: string;
  },
): WhatIfResult {
  const leftover = leftoverProjection(household, today);
  const beforeCash = leftover.cashLikeCents;
  const oracle = runTipOracle(household, { memberId: input.memberId, today, horizonDays: 28, iterations: 600, seed: 89 });
  const beforeTipFloor = oracle?.p10Cents ?? 0;
  let afterCash = beforeCash;
  let afterTipFloor = beforeTipFloor;
  let label = "";
  let amount = Math.max(0, Math.round(input.amountCents ?? 0));

  if (input.scenario === "cut_one_dinner_shift") {
    const tips = observeTipShifts(household, input.memberId).filter((row) => row.meal === "dinner");
    const typical = tips.length
      ? Math.round(tips.reduce((sum, row) => sum + row.netTipsCents, 0) / tips.length)
      : 15_000;
    amount = typical;
    afterCash = beforeCash - typical;
    afterTipFloor = Math.max(0, beforeTipFloor - typical);
    label = `Cut one typical dinner shift (~${formatCad(typical)} tips)`;
  } else if (input.scenario === "extra_card_pay") {
    amount = amount || 40_000;
    afterCash = beforeCash - amount;
    label = `Extra card payment of ${formatCad(amount)}`;
  } else if (input.scenario === "purchase") {
    amount = amount || 80_000;
    afterCash = beforeCash - amount;
    label = `Hypothetical purchase of ${formatCad(amount)}`;
  } else {
    amount = amount || Math.round(beforeTipFloor * 0.25);
    // Treat the boost as cash reserved out of free cash-like leftover.
    afterCash = beforeCash - amount;
    label = `Boost tax-milk reserve by ${formatCad(amount)}`;
  }

  return {
    scenario: input.scenario,
    label,
    beforeCashCents: beforeCash,
    afterCashCents: afterCash,
    beforeTipFloorCents: beforeTipFloor,
    afterTipFloorCents: afterTipFloor,
    deltaCashCents: afterCash - beforeCash,
    fits: afterCash >= 0 && afterCash >= leftover.billsNext30Cents * 0.25,
    assumptions: [
      "What-If Desk scenarios are not posted. Convert-to-draft still requires Confirm in Hearth.",
      "Cash uses the sit-down cash-like projection; tip floor uses the Shift Oracle when available.",
      "“Fits” is a narrow leftover test against remaining cash — not permission or advice.",
    ],
  };
}

export function runYearReview(
  household: Household,
  today: DateKey,
  options?: { memberId?: string; months?: number },
): YearReviewResult {
  const months = Math.min(12, Math.max(3, Math.round(options?.months ?? 12)));
  const current = monthKeyFromDateKey(today);
  const keys = Array.from({ length: months }, (_, index) => shiftMonthKey(current, index - months + 1));
  const tipMonths = keys.map((month) => {
    const start = `${month}-01` as DateKey;
    const end = addDays(start, 32);
    const shifts = household.shifts.filter((shift) => {
      if (options?.memberId && shift.memberId !== options.memberId) return false;
      if (workShiftIsReversed(household, shift)) return false;
      return shift.date >= start && shift.date < end && shift.date.slice(0, 7) === month;
    });
    return {
      month,
      tipCents: shifts.reduce((sum, row) => sum + row.netTipsCents, 0),
      shifts: shifts.length,
    };
  });
  const ranked = [...tipMonths].sort((a, b) => b.tipCents - a.tipCents);
  const summaries = keys.map((month) => monthSummary(household, month));
  const totalIncome = summaries.reduce((sum, row) => sum + row.incomeActualCents, 0);
  const totalSpend = summaries.reduce((sum, row) => sum + row.expenseActualCents, 0);
  const budgetMissCount = keys.reduce((sum, month) => sum + budgetVariance(household, month).filter((row) => row.varianceCents < 0).length, 0);
  return {
    fromMonth: keys[0]!,
    toMonth: keys[keys.length - 1]!,
    tipMonths,
    bestTipMonth: ranked[0]?.tipCents ? ranked[0].month : null,
    worstTipMonth: ranked.at(-1)?.tipCents != null ? ranked.at(-1)!.month : null,
    totalTipsCents: tipMonths.reduce((sum, row) => sum + row.tipCents, 0),
    totalIncomeCents: totalIncome,
    totalSpendCents: totalSpend,
    budgetMissCount,
    shiftCount: tipMonths.reduce((sum, row) => sum + row.shifts, 0),
    assumptions: [
      "Year-in-Review uses posted journal and confirmed shifts only for money totals.",
      "Budget misses count categories over plan; budgets remain projections.",
      "Best/worst tip months are from posted tip history, not simulated.",
    ],
  };
}
