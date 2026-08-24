import { inInclusiveRange, monthEndKey, monthKeyFromDateKey, weekBounds, lastWeekBounds, daysInMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { sumCents } from "./money.ts";
import { JOINT, type Household, type Transaction } from "./types.ts";

export function countable(tx: Transaction): boolean {
  return !tx.isDuplicate;
}

export function signedAmount(tx: Transaction): number {
  const sign = tx.reversalOfId ? -1 : 1;
  if (tx.type === "income") return sign * tx.amountCents;
  if (tx.type === "expense") return sign * -tx.amountCents;
  if (tx.type === "refund") return sign * tx.amountCents;
  return 0;
}

export function expenseEffect(tx: Transaction): number {
  if (!countable(tx)) return 0;
  const sign = tx.reversalOfId ? -1 : 1;
  if (tx.type === "expense") return sign * tx.amountCents;
  if (tx.type === "refund") return sign * -tx.amountCents;
  return 0;
}

export function incomeEffect(tx: Transaction): number {
  if (!countable(tx) || tx.type !== "income") return 0;
  return (tx.reversalOfId ? -1 : 1) * tx.amountCents;
}

export type CategoryActual = {
  subcategoryId: string;
  categoryId: string;
  name: string;
  groupName: string;
  type: "expense" | "income";
  essential: boolean;
  incomeStability: "fixed" | "variable" | null;
  budgetedCents: number;
  actualCents: number;
};

export type MonthSummary = {
  monthKey: MonthKey;
  incomeBudgetedCents: number;
  incomeActualCents: number;
  expenseBudgetedCents: number;
  expenseActualCents: number;
  essentialBudgetedCents: number;
  essentialActualCents: number;
  fixedIncomeActualCents: number;
  variableIncomeActualCents: number;
  netBudgetedCents: number;
  netActualCents: number;
  savingsRate: number;
  householdCoverageGapCents: number;
  categories: CategoryActual[];
};

export function monthSummary(household: Household, monthKey: MonthKey): MonthSummary {
  const start = `${monthKey}-01`;
  const end = monthEndKey(monthKey);
  const inMonth = (tx: Transaction) => inInclusiveRange(tx.date, start, end);
  const plans = household.budgetPlans.filter((plan) => plan.active && plan.monthKey === monthKey);
  const categories: CategoryActual[] = household.categories
    .filter((category) => category.recordType === "category" && category.active)
    .map((category) => {
      const parent = household.categories.find((item) => item.id === category.parentId);
      const budgetedCents = sumCents(
        plans.filter((plan) => plan.subcategoryId === category.id).map((plan) => plan.amountCents),
      );
      const actualCents = household.transactions.filter(inMonth).reduce((total, tx) => {
        if (tx.subcategoryId !== category.id) return total;
        if (category.transactionType === "expense") return total + expenseEffect(tx);
        return total + incomeEffect(tx);
      }, 0);
      return {
        subcategoryId: category.id,
        categoryId: category.parentId ?? category.id,
        name: category.name,
        groupName: parent?.name ?? "",
        type: category.transactionType,
        essential: category.essential,
        incomeStability: category.incomeStability,
        budgetedCents,
        actualCents,
      };
    });

  const income = categories.filter((row) => row.type === "income");
  const expense = categories.filter((row) => row.type === "expense");
  const incomeActualCents = sumCents(income.map((row) => row.actualCents));
  const expenseActualCents = sumCents(expense.map((row) => row.actualCents));
  const incomeBudgetedCents = sumCents(income.map((row) => row.budgetedCents));
  const expenseBudgetedCents = sumCents(expense.map((row) => row.budgetedCents));
  const essential = expense.filter((row) => row.essential);
  const fixedIncomeActualCents = sumCents(income.filter((row) => row.incomeStability === "fixed").map((row) => row.actualCents));
  const variableIncomeActualCents = sumCents(income.filter((row) => row.incomeStability === "variable").map((row) => row.actualCents));
  const essentialActualCents = sumCents(essential.map((row) => row.actualCents));
  const netActualCents = incomeActualCents - expenseActualCents;
  return {
    monthKey,
    incomeBudgetedCents,
    incomeActualCents,
    expenseBudgetedCents,
    expenseActualCents,
    essentialBudgetedCents: sumCents(essential.map((row) => row.budgetedCents)),
    essentialActualCents,
    fixedIncomeActualCents,
    variableIncomeActualCents,
    netBudgetedCents: incomeBudgetedCents - expenseBudgetedCents,
    netActualCents,
    savingsRate: incomeActualCents ? netActualCents / incomeActualCents : 0,
    householdCoverageGapCents: fixedIncomeActualCents - essentialActualCents,
    categories,
  };
}

export type WeekSummary = {
  start: DateKey;
  end: DateKey;
  expenseCents: number;
  incomeCents: number;
  lastWeekExpenseCents: number;
  essentialCents: number;
  discretionaryCents: number;
  byParty: { party: string; name: string; amountCents: number }[];
  movers: { name: string; actualCents: number; avgCents: number; diffCents: number; hot: boolean }[];
  biggest: { id: string; name: string; amountCents: number; date: DateKey; note: string } | null;
  needsReview: number;
  pace: { name: string; mtdCents: number; budgetedCents: number; projectedCents: number; over: boolean }[];
};

export function weekSummary(household: Household, today: DateKey): WeekSummary {
  const week = weekBounds(today);
  const last = lastWeekBounds(today);
  const monthKey = monthKeyFromDateKey(today);
  const month = monthSummary(household, monthKey);
  const daysElapsed = Number(today.slice(8, 10));
  const days = daysInMonthKey(monthKey);

  const weekTx = household.transactions.filter((tx) => inInclusiveRange(tx.date, week.start, week.end));
  const lastTx = household.transactions.filter((tx) => inInclusiveRange(tx.date, last.start, last.end));
  const fourWeekStart = offsetDays(week.start, -28);

  const expenseCents = sumCents(weekTx.map(expenseEffect));
  const incomeCents = sumCents(weekTx.map(incomeEffect));
  const lastWeekExpenseCents = sumCents(lastTx.map(expenseEffect));

  const catById = new Map(household.categories.map((category) => [category.id, category]));
  let essentialCents = 0;
  let discretionaryCents = 0;
  const weekBySub = new Map<string, number>();
  const trailingBySub = new Map<string, number>();
  for (const tx of weekTx) {
    const amount = expenseEffect(tx);
    if (!amount || !tx.subcategoryId) continue;
    weekBySub.set(tx.subcategoryId, (weekBySub.get(tx.subcategoryId) ?? 0) + amount);
    const category = catById.get(tx.subcategoryId);
    if (category?.essential) essentialCents += amount;
    else discretionaryCents += amount;
  }
  for (const tx of household.transactions) {
    if (tx.date < fourWeekStart || tx.date >= week.start) continue;
    const amount = expenseEffect(tx);
    if (!amount || !tx.subcategoryId) continue;
    trailingBySub.set(tx.subcategoryId, (trailingBySub.get(tx.subcategoryId) ?? 0) + amount);
  }

  const partyTotals = new Map<string, number>();
  for (const tx of weekTx) {
    const amount = expenseEffect(tx);
    if (!amount) continue;
    for (const split of tx.splits) {
      partyTotals.set(split.party, (partyTotals.get(split.party) ?? 0) + split.amountCents);
    }
  }

  const moverKeys = new Set([...weekBySub.keys(), ...trailingBySub.keys()]);
  const movers = [...moverKeys]
    .map((id) => {
      const actualCents = weekBySub.get(id) ?? 0;
      const avgCents = Math.round((trailingBySub.get(id) ?? 0) / 4);
      return {
        name: catById.get(id)?.name ?? id,
        actualCents,
        avgCents,
        diffCents: actualCents - avgCents,
        hot: avgCents > 0 && actualCents >= avgCents * 1.25,
      };
    })
    .sort((a, b) => Math.abs(b.diffCents) - Math.abs(a.diffCents))
    .slice(0, 4);

  let biggest: WeekSummary["biggest"] = null;
  for (const tx of weekTx) {
    const amount = expenseEffect(tx);
    if (!amount) continue;
    if (!biggest || amount > biggest.amountCents) {
      biggest = {
        id: tx.id,
        name: catById.get(tx.subcategoryId ?? "")?.name ?? "Uncategorized",
        amountCents: amount,
        date: tx.date,
        note: tx.note,
      };
    }
  }

  const memberName = (party: string) => {
    if (party === JOINT) return "Joint / Shared";
    return household.members.find((member) => member.id === party)?.name ?? party;
  };

  const fluctuatingEssentials = month.categories.filter(
    (row) => row.type === "expense" && row.essential && row.incomeStability === "variable" && row.budgetedCents > 0,
  );
  const mtdEnd = today;
  const mtdStart = `${monthKey}-01`;
  const pace = fluctuatingEssentials.map((row) => {
    const mtdCents = household.transactions
      .filter((tx) => tx.subcategoryId === row.subcategoryId && inInclusiveRange(tx.date, mtdStart, mtdEnd))
      .reduce((total, tx) => total + expenseEffect(tx), 0);
    const projectedCents = daysElapsed > 0 ? Math.round((mtdCents / daysElapsed) * days) : mtdCents;
    return {
      name: row.name,
      mtdCents,
      budgetedCents: row.budgetedCents,
      projectedCents,
      over: projectedCents > row.budgetedCents,
    };
  });

  return {
    start: week.start,
    end: week.end,
    expenseCents,
    incomeCents,
    lastWeekExpenseCents,
    essentialCents,
    discretionaryCents,
    byParty: [...partyTotals.entries()]
      .map(([party, amountCents]) => ({ party, name: memberName(party), amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents),
    movers,
    biggest,
    needsReview: weekTx.filter((tx) => !tx.reviewed || tx.potentialDuplicate).length
      + household.transactions.filter((tx) => tx.potentialDuplicate && !tx.isDuplicate).length,
    pace,
  };
}

function offsetDays(dateKey: DateKey, days: number): DateKey {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function freshnessHours(household: Household, now = new Date()): number | null {
  if (!household.lastCommittedAt) return null;
  return (now.getTime() - new Date(household.lastCommittedAt).getTime()) / 3600000;
}
