import { daysInMonthKey, shiftMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { catalogHousehold } from "./seed.ts";
import { postEntry, setBudget } from "./commands.ts";
import { jointSplit } from "./splits.ts";
import type { Household } from "./types.ts";

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXPENSE_POOL = [
  "SUB-FOOD-GROCERIES",
  "SUB-FOOD-COFFEE",
  "SUB-TRANSPORT-FUEL",
  "SUB-TRANSPORT-TRANSIT",
  "SUB-LIFE-FUN",
  "SUB-HOUSING-ELECTRIC",
  "SUB-LIFE-PHONE",
];

export function buildScaleFixture(options: {
  months?: number;
  transactionsPerMonth?: number;
  endMonth?: MonthKey;
  seed?: number;
} = {}): Household {
  const months = options.months ?? 12;
  const perMonth = options.transactionsPerMonth ?? 500;
  const endMonth = options.endMonth ?? "2026-08";
  const random = mulberry32(options.seed ?? 7);
  let household = catalogHousehold("development");
  const startMonth = shiftMonthKey(endMonth, -(months - 1));

  for (let i = 0; i < months; i += 1) {
    const monthKey = shiftMonthKey(startMonth, i);
    const days = daysInMonthKey(monthKey);
    household = setBudget(household, { monthKey, subcategoryId: "SUB-FOOD-GROCERIES", amount: 650 }).household;
    household = setBudget(household, { monthKey, subcategoryId: "SUB-HOUSING-RENT", amount: 1850 }).household;
    household = postEntry(household, {
      date: `${monthKey}-01`,
      type: "expense",
      amount: 1850,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Rent",
      confirmDuplicate: true,
    }).household;
    const remaining = perMonth - 1;
    for (let n = 0; n < remaining; n += 1) {
      const day = 1 + Math.floor(random() * days);
      const date = `${monthKey}-${String(day).padStart(2, "0")}` as DateKey;
      const subcategoryId = EXPENSE_POOL[Math.floor(random() * EXPENSE_POOL.length)]!;
      const amount = +(4 + random() * 90).toFixed(2);
      household = postEntry(household, {
        date,
        type: "expense",
        amount,
        accountId: random() > 0.3 ? "ACC-VISA" : "ACC-CHEQUING",
        subcategoryId,
        note: `Load ${monthKey} #${n}`,
        splits: jointSplit(Math.round(amount * 100)),
        confirmDuplicate: true,
      }).household;
    }
  }
  return household;
}
