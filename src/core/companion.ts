import { addDays, kitchenSeason, parseDateKey, type DateKey } from "./calendar.ts";
import { weekSummary } from "./budget.ts";
import { runHealthCheck } from "./health.ts";
import { formatCad } from "./money.ts";
import type { CosmeticSlot, Household, HouseholdCompanion } from "./types.ts";

export type CompanionMood = "glowing" | "content" | "restless" | "hiding";

export type CosmeticItem = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  hint: string;
};

export const COSMETICS: CosmeticItem[] = [
  { id: "toque", slot: "hat", name: "Kitchen toque", hint: "Post any spend" },
  { id: "visor", slot: "hat", name: "Bill visor", hint: "Mark a repeating bill paid" },
  { id: "chef", slot: "hat", name: "Sit-down chef hat", hint: "Finish a monthly sit-down" },
  { id: "copper", slot: "chain", name: "Copper chain", hint: "Post money on 3 different days" },
  { id: "gold", slot: "chain", name: "Gold chain", hint: "Hit a savings goal" },
  { id: "cottage", slot: "house", name: "Cottage", hint: "Health check is clean" },
  { id: "townhouse", slot: "house", name: "Townhouse", hint: "Health clean and no overdue bills" },
  { id: "patio", slot: "house", name: "July patio", hint: "Toronto summer, or any spend in June–August" },
  { id: "ruff", slot: "hat", name: "Winter ruff", hint: "Toronto winter, or any spend in November–March" },
  { id: "bell", slot: "collar", name: "Collar bell", hint: "Post a transfer (pay the Visa)" },
  { id: "yarn", slot: "collar", name: "Yarn collar", hint: "Scribble three chalkboard notes" },
  { id: "fish", slot: "collar", name: "Fish treat", hint: "Post a shift" },
];

export const COSMETIC_BY_ID = new Map(COSMETICS.map((item) => [item.id, item]));

export type CompanionView = {
  name: string;
  mood: CompanionMood;
  line: string;
  reason: string;
  equipped: HouseholdCompanion["equipped"];
  unlocked: CosmeticItem[];
  locked: CosmeticItem[];
};

function postingDates(household: Household): string[] {
  const dates = new Set<string>();
  for (const tx of household.transactions) {
    if (!tx.isDuplicate) dates.add(tx.date);
  }
  return [...dates];
}

function overdueBills(household: Household, today: DateKey) {
  return household.recurrences.filter((item) => item.active && item.type === "expense" && item.nextDate < today);
}

function paidRecurringCount(household: Household): number {
  return household.transactions.filter((tx) => tx.source === "recurring" && !tx.isDuplicate).length;
}

export function isCosmeticUnlocked(household: Household, item: CosmeticItem, today: DateKey): boolean {
  const healthClean = runHealthCheck(household).length === 0;
  if (item.id === "toque") return household.transactions.some((tx) => tx.type === "expense" && !tx.isDuplicate);
  if (item.id === "visor") return paidRecurringCount(household) > 0;
  if (item.id === "chef") return household.activity.some((row) => row.action === "Monthly Sit-Down");
  if (item.id === "copper") return postingDates(household).length >= 3;
  if (item.id === "gold") {
    return household.goals.some((goal) => goal.targetCents > 0 && goal.savedCents >= goal.targetCents);
  }
  if (item.id === "cottage") return healthClean;
  if (item.id === "townhouse") {
    return healthClean && overdueBills(household, today).length === 0 && household.recurrences.some((item) => item.active);
  }
  if (item.id === "patio") {
    return kitchenSeason(today) === "patio" || household.transactions.some((tx) => !tx.isDuplicate && [6, 7, 8].includes(parseDateKey(tx.date).month));
  }
  if (item.id === "ruff") {
    return kitchenSeason(today) === "ruff" || household.transactions.some((tx) => !tx.isDuplicate && [11, 12, 1, 2, 3].includes(parseDateKey(tx.date).month));
  }
  if (item.id === "bell") return household.transactions.some((tx) => tx.type === "transfer" && !tx.isDuplicate);
  if (item.id === "yarn") return household.activity.filter((row) => row.action === "Chalkboard").length >= 3;
  if (item.id === "fish") return household.shifts.length > 0;
  return false;
}

export function unlockedCosmetics(household: Household, today: DateKey): CosmeticItem[] {
  return COSMETICS.filter((item) => isCosmeticUnlocked(household, item, today));
}

export function companionMood(household: Household, today: DateKey, name = "Hercules"): { mood: CompanionMood; reason: string } {
  const findings = runHealthCheck(household).length;
  const overdue = overdueBills(household, today);
  const week = weekSummary(household, today);
  if (findings > 0) {
    return { mood: "hiding", reason: `The books need a look. ${name} is under the table until Health is clean.` };
  }
  if (overdue.length) {
    const first = overdue[0]!;
    return {
      mood: "restless",
      reason: `${first.note || "A bill"} was due ${first.nextDate}. ${name} will not fake a fee. Pay it, then post it.`,
    };
  }
  const nextBill = household.recurrences
    .filter((item) => item.active && item.type === "expense" && item.nextDate >= today && item.nextDate <= addDays(today, 2))
    .sort((left, right) => left.nextDate.localeCompare(right.nextDate))[0];
  if (nextBill) {
    return {
      mood: "restless",
      reason: `${nextBill.note || "A bill"} (${formatCad(nextBill.amountCents)}) is almost due.`,
    };
  }
  if (week.lastWeekExpenseCents > 0 && week.expenseCents > week.lastWeekExpenseCents * 1.2) {
    return {
      mood: "restless",
      reason: `This week is ${formatCad(week.expenseCents - week.lastWeekExpenseCents)} hotter than last week.`,
    };
  }
  if (findings === 0 && (week.lastWeekExpenseCents === 0 || week.expenseCents <= week.lastWeekExpenseCents)) {
    return { mood: "glowing", reason: "Health is clean and this week is not running hotter than last." };
  }
  return { mood: "content", reason: "Nothing is on fire. Keep the ordinary groceries coming." };
}

const LINES: Record<CompanionMood, (name: string) => string> = {
  glowing: (name) => `${name} is loafing in a sunbeam. The books look kind.`,
  content: (name) => `${name} is on the counter, waiting for the next grocery.`,
  restless: (name) => `${name} is pacing. A bill or a hot week wants a look.`,
  hiding: (name) => `${name} is under the table. No fake fees. Fix Health, then come back.`,
};

export function describeCompanion(household: Household, today: DateKey): CompanionView {
  const kitchen = household.kitchen;
  const name = kitchen?.companion.name || "Hercules";
  const { mood, reason } = companionMood(household, today, name);
  const unlocked = unlockedCosmetics(household, today);
  const unlockedIds = new Set(unlocked.map((item) => item.id));
  return {
    name,
    mood,
    line: LINES[mood](name),
    reason,
    equipped: kitchen?.companion.equipped ?? { hat: null, chain: null, house: null, collar: null },
    unlocked,
    locked: COSMETICS.filter((item) => !unlockedIds.has(item.id)),
  };
}

export function postingStreakDays(household: Household, today: DateKey): number {
  const dates = new Set(postingDates(household));
  let streak = 0;
  let cursor = today;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
