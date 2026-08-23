import { addDays, calendarDaysBetween, formatMonthLabel, monthKeyFromDateKey, shiftMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { formatCad } from "./money.ts";
import { monthSummary, weekSummary, freshnessHours, type MonthSummary, type WeekSummary } from "./budget.ts";
import { buildMonthBoard, type BoardItem } from "./board.ts";
import { householdWallet } from "./accounts.ts";
import { claimsTraySentence, outstandingClaims, upcomingVisitProposals } from "./appointments.ts";
import type { Rhythm } from "./rhythm.ts";
import type { Goal, Household, Shift } from "./types.ts";

export type Pulse = {
  sentence: string;
  tone: "good" | "warn" | "neutral";
};

export type TipWeather = {
  fourWeekTipsCents: number;
  fourWeekHours: number;
  tipsPerHourCents: number;
  byWeekday: { weekday: string; tipsCents: number; hours: number }[];
};

export type Dashboard = {
  today: DateKey;
  monthKey: MonthKey;
  monthLabel: string;
  freshnessHours: number | null;
  stale: boolean;
  month: MonthSummary;
  week: WeekSummary;
  pulses: Pulse[];
  goals: { goal: Goal; progress: number }[];
  tipWeather: TipWeather;
  dueRecurrences: number;
  healthFindings: number;
  recent: Household["activity"];
  upcoming: BoardItem[];
  detectedBills: number;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function tipWeather(household: Household, today: DateKey): TipWeather {
  const start = offset(today, -27);
  const shifts = household.shifts.filter((shift) => shift.date >= start && shift.date <= today);
  const byWeekday = WEEKDAYS.map((weekday, index) => {
    const subset = shifts.filter((shift) => weekdayIndex(shift.date) === index);
    return {
      weekday,
      tipsCents: subset.reduce((sum, shift) => sum + shift.netTipsCents, 0),
      hours: subset.reduce((sum, shift) => sum + shift.hours, 0),
    };
  });
  const fourWeekTipsCents = shifts.reduce((sum, shift) => sum + shift.netTipsCents, 0);
  const fourWeekHours = shifts.reduce((sum, shift) => sum + shift.hours, 0);
  return {
    fourWeekTipsCents,
    fourWeekHours,
    tipsPerHourCents: fourWeekHours ? Math.round(fourWeekTipsCents / fourWeekHours) : 0,
    byWeekday,
  };
}

export function buildPulses(household: Household, today: DateKey, month: MonthSummary, week: WeekSummary, weather: TipWeather, rhythms: Rhythm[] = []): Pulse[] {
  const pulses: Pulse[] = [];
  const groceries = month.categories.find((row) => row.name.toLowerCase() === "groceries");
  if (groceries && groceries.budgetedCents > 0) {
    const remaining = groceries.budgetedCents - groceries.actualCents;
    const daysLeft = Number(month.monthKey.slice(5, 7) ? daysLeftInMonth(today) : 0);
    if (remaining >= 0) {
      pulses.push({
        sentence: `${groceries.name} has ${formatCad(remaining)} left with ${daysLeft} day${daysLeft === 1 ? "" : "s"} in ${formatMonthLabel(month.monthKey)}.`,
        tone: remaining < groceries.budgetedCents * 0.1 ? "warn" : "good",
      });
    } else {
      pulses.push({
        sentence: `${groceries.name} is ${formatCad(-remaining)} over plan this month.`,
        tone: "warn",
      });
    }
  }

  const over = month.categories.filter((row) => row.type === "expense" && row.budgetedCents > 0 && row.actualCents > row.budgetedCents);
  if (over[0]) {
    pulses.push({
      sentence: `${over[0].name} is already ${formatCad(over[0].actualCents - over[0].budgetedCents)} over its ${formatCad(over[0].budgetedCents)} plan.`,
      tone: "warn",
    });
  }

  if (week.lastWeekExpenseCents > 0) {
    const delta = week.expenseCents - week.lastWeekExpenseCents;
    pulses.push({
      sentence: delta >= 0
        ? `This week’s spending is ${formatCad(delta)} above last week.`
        : `This week’s spending is ${formatCad(-delta)} below last week.`,
      tone: delta > week.lastWeekExpenseCents * 0.2 ? "warn" : "good",
    });
  }

  const jonathan = household.members.find((member) => member.name.toLowerCase() === "jonathan");
  if (jonathan && weather.tipsPerHourCents > 0) {
    const weekShifts = household.shifts.filter((shift) => shift.memberId === jonathan.id && shift.date >= week.start && shift.date <= week.end);
    const weekTips = weekShifts.reduce((sum: number, shift: Shift) => sum + shift.netTipsCents, 0);
    const weekHours = weekShifts.reduce((sum: number, shift: Shift) => sum + shift.hours, 0);
    if (weekHours > 0) {
      const weekRate = Math.round(weekTips / weekHours);
      const delta = weekRate - weather.tipsPerHourCents;
      pulses.push({
        sentence: delta >= 0
          ? `Jonathan’s tips this week are ${formatCad(delta)}/hr above the 4-week average.`
          : `Jonathan’s tips this week are ${formatCad(-delta)}/hr below the 4-week average.`,
        tone: "neutral",
      });
    }
  }

  if (month.householdCoverageGapCents < 0) {
    pulses.push({
      sentence: `Fixed income is ${formatCad(-month.householdCoverageGapCents)} short of essential spend this month.`,
      tone: "warn",
    });
  } else if (month.incomeActualCents > 0) {
    pulses.push({
      sentence: `Essentials are covered, with ${formatCad(month.householdCoverageGapCents)} of fixed income still free.`,
      tone: "good",
    });
  }

  const dueSoon = household.recurrences
    .filter((item) => item.active && item.nextDate >= today && item.nextDate <= addDays(today, 7) && item.type === "expense")
    .sort((left, right) => left.nextDate.localeCompare(right.nextDate));
  if (dueSoon[0]) {
    const days = calendarDaysBetween(today, dueSoon[0].nextDate);
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    pulses.unshift({
      sentence: `${dueSoon[0].note || "A bill"} (${formatCad(dueSoon[0].amountCents)}) is due ${when}.`,
      tone: days <= 2 ? "warn" : "neutral",
    });
  }

  const waiting = rhythms.filter((item) => item.status === "suggested");
  if (waiting[0]) {
    pulses.push({
      sentence: `Calendar spotted ${waiting.length === 1 ? waiting[0].note : `${waiting.length} repeating bills`} in the ledger.`,
      tone: "neutral",
    });
  }

  const wallet = householdWallet(household, today);
  const hot = wallet.hottestCard;
  if (hot && hot.utilization != null && hot.utilization >= 0.8) {
    pulses.unshift({
      sentence: `${hot.account.name} is at ${Math.round(hot.utilization * 100)}% utilization. Paydown is a transfer.`,
      tone: "warn",
    });
  } else if (hot && hot.owedCents > 0 && hot.daysUntilDue <= 5) {
    pulses.unshift({
      sentence: `${hot.account.name} is due ${hot.dueDate} · minimum ${formatCad(hot.minPaymentCents)}. That's a look.`,
      tone: hot.daysUntilDue <= 2 ? "warn" : "neutral",
    });
  } else if (hot && hot.estimatedInterestCents > 0 && !hot.paidInFull) {
    pulses.push({
      sentence: `${hot.account.name} will accrue about ${formatCad(hot.estimatedInterestCents)} if the statement isn't paid in full. I don't post it.`,
      tone: "warn",
    });
  }

  const owing = outstandingClaims(household);
  if (owing[0]) {
    pulses.unshift({
      sentence: claimsTraySentence(household, today),
      tone: owing.some((claim) => claim.submittedAt) ? "neutral" : "warn",
    });
  }

  const saveFor = upcomingVisitProposals(household, today)[0];
  if (saveFor) {
    pulses.push({
      sentence: saveFor.hercules,
      tone: saveFor.nextDate <= today ? "warn" : "neutral",
    });
  }

  return pulses.slice(0, 5);
}

export function buildDashboard(household: Household, today: DateKey, now = new Date(), healthFindingCount = 0): Dashboard {
  const monthKey = monthKeyFromDateKey(today);
  const month = monthSummary(household, monthKey);
  const week = weekSummary(household, today);
  const weather = tipWeather(household, today);
  const hours = freshnessHours(household, now);
  const board = buildMonthBoard(household, monthKey, today);
  return {
    today,
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    freshnessHours: hours,
    stale: hours === null || hours > 24,
    month,
    week,
    pulses: buildPulses(household, today, month, week, weather, board.rhythms),
    goals: household.goals
      .filter((goal) => goal.status !== "retired" && !goal.retiredAt)
      .map((goal) => ({ goal, progress: goal.targetCents ? Math.min(1, goal.savedCents / goal.targetCents) : 0 })),
    tipWeather: weather,
    dueRecurrences: board.dueCount,
    healthFindings: healthFindingCount,
    recent: household.activity.slice(-8).reverse(),
    upcoming: board.upcoming,
    detectedBills: board.rhythms.filter((item) => item.status === "suggested").length,
  };
}

export function sitDownPreview(household: Household, sourceMonth: MonthKey) {
  const source = monthSummary(household, sourceMonth);
  const targetMonth = shiftMonthKey(sourceMonth, 1);
  const existing = new Set(
    household.budgetPlans.filter((plan) => plan.monthKey === targetMonth).map((plan) => plan.subcategoryId),
  );
  return {
    sourceMonth,
    targetMonth,
    rows: source.categories.map((row) => {
      const over = row.budgetedCents > 0 && row.actualCents > row.budgetedCents;
      const suggested = over ? Math.round((row.actualCents + row.budgetedCents) / 2) : row.budgetedCents || row.actualCents;
      return {
        subcategoryId: row.subcategoryId,
        name: row.name,
        type: row.type,
        lastBudgetedCents: row.budgetedCents,
        lastActualCents: row.actualCents,
        suggestedCents: suggested,
        alreadyPlanned: existing.has(row.subcategoryId),
        trimSuggested: over,
      };
    }),
  };
}

function weekdayIndex(dateKey: DateKey): number {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function offset(dateKey: DateKey, days: number): DateKey {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function daysLeftInMonth(today: DateKey): number {
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return last - day;
}
