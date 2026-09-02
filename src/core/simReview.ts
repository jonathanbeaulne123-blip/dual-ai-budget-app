/**
 * Simulation and historical review packs for Hercules (D-142).
 * Cash Cinema, What-If Desk, and Year-in-Review — projections only; never post.
 */
import {
  addDays,
  calendarDaysBetween,
  monthKeyFromDateKey,
  monthStartKey,
  shiftMonthKey,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import { accountBookBalance, creditCardView } from "./accounts.ts";
import { isCashLikeKind } from "./accountKinds.ts";
import { monthSummary, projectedExpenseEffect, projectedIncomeEffect, transactionProjection } from "./budget.ts";
import { budgetVariance } from "./statements.ts";
import { formatCad, sumCents } from "./money.ts";
import { projectCadence } from "./recurrence.ts";
import { leftoverProjection } from "./sitDown.ts";
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
  oracleHorizonDays: number;
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
  memberScoped: boolean;
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

/** Month income/spend on full correction lineage; optional original-member filter. */
function monthPostedActuals(
  household: Household,
  month: MonthKey,
  memberId?: string,
): { incomeCents: number; spendCents: number } {
  if (!memberId) {
    const summary = monthSummary(household, month);
    return { incomeCents: summary.incomeActualCents, spendCents: summary.expenseActualCents };
  }
  const start = monthStartKey(month);
  const end = addDays(monthStartKey(shiftMonthKey(month, 1)), -1);
  const transactionById = new Map(household.transactions.map((tx) => [tx.id, tx]));
  let incomeCents = 0;
  let spendCents = 0;
  for (const tx of household.transactions) {
    if (tx.date < start || tx.date > end) continue;
    if (transactionProjection(tx, transactionById).root.createdBy !== memberId) continue;
    incomeCents += projectedIncomeEffect(tx, transactionById);
    spendCents += projectedExpenseEffect(tx, transactionById);
  }
  return { incomeCents, spendCents };
}

/** 13-week forward cash path using tip floor/typical, wage pace, bills, and card mins. */
export function runCashCinema(
  household: Household,
  today: DateKey,
  options?: { memberId?: string; weeks?: number },
): CashCinemaResult {
  const weekCount = Math.min(13, Math.max(4, Math.round(options?.weeks ?? 13)));
  const leftover = leftoverProjection(household, today);
  // Prefer sit-down cash-like leftover (may be 0); fall back only when leftover is unavailable.
  const opening = leftover.cashLikeCents ?? cashLike(household, today);
  const oracle = runTipOracle(household, {
    memberId: options?.memberId,
    today,
    horizonDays: weekCount * 7,
    iterations: 800,
    seed: 211,
  });
  // Oracle clamps horizon (currently ≤62 days). Scale weekly tip from the oracle's actual horizon.
  const oracleHorizonDays = oracle?.horizonDays ?? weekCount * 7;
  const tipFloorWeekly = oracle ? Math.round((oracle.p10Cents * 7) / oracleHorizonDays) : 0;
  const tipTypicalWeekly = oracle ? Math.round((oracle.p50Cents * 7) / oracleHorizonDays) : 0;
  const wagesWeekly = weeklyWageEstimate(household, options?.memberId);
  const weeks: CashCinemaWeek[] = [];
  let cash = opening;
  let lowest = opening;
  let dryWeeks = 0;
  for (let i = 0; i < weekCount; i += 1) {
    const weekStart = addDays(today, i * 7);
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
    oracleHorizonDays,
    assumptions: [
      "Cash Cinema is a forward projection ribbon, not posted balances.",
      `Tip floor/typical are weekly rates from a ${oracleHorizonDays}-day Shift Oracle Monte Carlo (oracle may clamp the requested horizon).`,
      "Wages use historical weekly pace across confirmed non-reversed shifts.",
      "Scheduled bills are cadence projections until Confirm marks them paid.",
      "Card minimums are applied once in week 1 to avoid weekly double-counting.",
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
): WhatIfResult | { error: string } {
  const leftover = leftoverProjection(household, today);
  const beforeCash = leftover.cashLikeCents;
  const oracle = runTipOracle(household, { memberId: input.memberId, today, horizonDays: 28, iterations: 600, seed: 89 });
  const beforeTipFloor = oracle?.p10Cents ?? 0;
  let afterCash = beforeCash;
  let afterTipFloor = beforeTipFloor;
  let label = "";
  let amount = Math.max(0, Math.round(input.amountCents ?? 0));
  const assumptions = [
    "What-If Desk scenarios are not posted. Any real draft still requires Confirm in Hearth.",
    "Cash uses the sit-down cash-like projection; tip floor uses the Shift Oracle when available.",
    "“Fits” is a narrow leftover test against remaining cash — not permission or advice.",
  ];

  if (input.scenario === "cut_one_dinner_shift") {
    const tips = observeTipShifts(household, input.memberId).filter((row) => row.meal === "dinner");
    if (!tips.length) {
      return { error: "I need posted dinner tip shifts before I can cut one from the What-If Desk." };
    }
    const typical = Math.round(tips.reduce((sum, row) => sum + row.netTipsCents, 0) / tips.length);
    amount = typical;
    afterCash = beforeCash - typical;
    // Illustrative one-shift haircut on the 28-day tip-floor window — not a re-simulated oracle.
    afterTipFloor = Math.max(0, beforeTipFloor - typical);
    label = `Cut one typical dinner shift (~${formatCad(typical)} tips)`;
    assumptions.push("Tip-floor change is an illustrative one-shift haircut on the 28-day oracle floor, not a fresh Monte Carlo.");
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
    fits: afterCash >= 0 && afterCash * 4 >= leftover.billsNext30Cents,
    assumptions,
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
  const hasTips = tipMonths.some((row) => row.tipCents > 0);
  const actuals = keys.map((month) => monthPostedActuals(household, month, options?.memberId));
  const totalIncome = actuals.reduce((sum, row) => sum + row.incomeCents, 0);
  const totalSpend = actuals.reduce((sum, row) => sum + row.spendCents, 0);
  const budgetMissCount = keys.reduce((sum, month) => sum + budgetVariance(household, month).filter((row) => row.varianceCents < 0).length, 0);
  return {
    fromMonth: keys[0]!,
    toMonth: keys[keys.length - 1]!,
    tipMonths,
    bestTipMonth: hasTips && ranked[0] && ranked[0].tipCents > 0 ? ranked[0].month : null,
    worstTipMonth: hasTips ? ranked.at(-1)!.month : null,
    totalTipsCents: tipMonths.reduce((sum, row) => sum + row.tipCents, 0),
    totalIncomeCents: totalIncome,
    totalSpendCents: totalSpend,
    budgetMissCount,
    shiftCount: tipMonths.reduce((sum, row) => sum + row.shifts, 0),
    memberScoped: Boolean(options?.memberId),
    assumptions: [
      "Tips and shift counts use confirmed non-reversed shifts only.",
      options?.memberId
        ? "Income and spend use full correction lineage attributed to that original member."
        : "Income and spend use the same month category actuals as the budget tools (monthSummary).",
      "Budget misses count categories over plan; budgets remain projections.",
    ],
  };
}
