import { addDays, type DateKey } from "./calendar.ts";
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
  { id: "specs", slot: "hat", name: "Audit spectacles", hint: "Tie a bank rec — statement matches the books" },
  { id: "copper", slot: "chain", name: "Copper chain", hint: "Post money on 3 different days" },
  { id: "gold", slot: "chain", name: "Gold chain", hint: "Hit a savings goal" },
  { id: "cottage", slot: "house", name: "Cottage", hint: "Health check is clean" },
  { id: "townhouse", slot: "house", name: "Townhouse", hint: "Health clean and no overdue bills" },
  { id: "patio", slot: "house", name: "July patio", hint: "Toronto summer, or any spend in June–August" },
  { id: "ruff", slot: "hat", name: "Winter ruff", hint: "Toronto winter, or any spend in November–March" },
  { id: "bell", slot: "collar", name: "Collar bell", hint: "Post a transfer (pay the Visa)" },
  { id: "clip", slot: "collar", name: "Card clip", hint: "Open a second credit card" },
  { id: "yarn", slot: "collar", name: "Yarn collar", hint: "Scribble three chalkboard notes" },
  { id: "fish", slot: "collar", name: "Fish treat", hint: "Post a shift" },
  { id: "tooth", slot: "collar", name: "Tooth charm", hint: "Post a visit to the books" },
  { id: "ink", slot: "collar", name: "Green-ink stamp", hint: "Close a month — the control environment, not a tattoo" },
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

function cosmeticUnlocked(_household:Household,_item:CosmeticItem,_today:DateKey,_healthClean:()=>boolean):boolean{return true;}

export function isCosmeticUnlocked(household: Household, item: CosmeticItem, today: DateKey): boolean {
  return cosmeticUnlocked(household, item, today, () => runHealthCheck(household).length === 0);
}

export function unlockedCosmetics(household: Household, today: DateKey): CosmeticItem[] {
  let clean: boolean | undefined;
  return COSMETICS.filter((item) => cosmeticUnlocked(household, item, today, () => (clean ??= runHealthCheck(household).length === 0)));
}

export function companionMood(household: Household, today: DateKey, name = "Hercules"): { mood: CompanionMood; reason: string } {
  const findings = runHealthCheck(household).length;
  const overdue = overdueBills(household, today);
  const week = weekSummary(household, today);
  if (findings > 0) {
    return { mood: "content", reason: `The books need a look. ${name} is right here with you; we can work through them one step at a time.` };
  }
  if (overdue.length) {
    const first = overdue[0]!;
    return {
      mood: "restless",
      reason: `${first.note || "A bill"} was due ${first.nextDate}. ${name} can help you look at what is due, one step at a time.`,
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
  restless: (name) => `${name} is keeping you company. A bill or a change in spending may need a look.`,
  hiding: (name) => `${name} is close by. We can take the next step together.`,
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
