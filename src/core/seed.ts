import { addDays, monthKeyFromDateKey, shiftMonthKey, todayKey, type DateKey } from "./calendar.ts";
import { DEFAULT_SHIFT_SETTINGS } from "./shift.ts";
import { emptyHousehold, postEntry, postShift, postTransfer, addGoal, addRecurrence, setBudget, contributeToGoal, scribbleChalk } from "./commands.ts";
import { JOINT, type Household } from "./types.ts";
import { jointSplit, equalSplits } from "./splits.ts";

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function catalogHousehold(environment: Household["environment"] = "development"): Household {
  const household = emptyHousehold(environment);
  household.members = [
    { id: "MEM-001", name: "Bianca", color: "#c45c26", active: true },
    { id: "MEM-002", name: "Jonathan", color: "#2f6b4f", active: true },
  ];
  household.accounts = [
    { id: "ACC-CHEQUING", name: "Everyday chequing", kind: "chequing", currency: "CAD", active: true, ownerMemberId: JOINT },
    { id: "ACC-VISA", name: "Visa", kind: "credit", currency: "CAD", active: true, ownerMemberId: JOINT },
    { id: "ACC-CASH", name: "Cash / tips", kind: "cash", currency: "CAD", active: true, ownerMemberId: "MEM-002" },
  ];
  const groups: Household["categories"] = [
    { id: "INCOME", parentId: null, recordType: "group", name: "Income", transactionType: "income", essential: false, incomeStability: null, active: true, sortOrder: 10 },
    { id: "CAT-HOUSING", parentId: null, recordType: "group", name: "Housing", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 20 },
    { id: "CAT-FOOD", parentId: null, recordType: "group", name: "Food", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 30 },
    { id: "CAT-TRANSPORT", parentId: null, recordType: "group", name: "Transport", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 40 },
    { id: "CAT-LIFE", parentId: null, recordType: "group", name: "Life", transactionType: "expense", essential: false, incomeStability: null, active: true, sortOrder: 50 },
    { id: "CAT-DEBT", parentId: null, recordType: "group", name: "Debt", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 60 },
  ];
  const categories: Household["categories"] = [
    { id: "SUB-INCOME-WAGES", parentId: "INCOME", recordType: "category", name: "Wages", transactionType: "income", essential: false, incomeStability: "variable", active: true, sortOrder: 11 },
    { id: "SUB-INCOME-TIPS", parentId: "INCOME", recordType: "category", name: "Tips", transactionType: "income", essential: false, incomeStability: "variable", active: true, sortOrder: 12 },
    { id: "SUB-INCOME-BIANCA", parentId: "INCOME", recordType: "category", name: "Bianca pay", transactionType: "income", essential: false, incomeStability: "fixed", active: true, sortOrder: 13 },
    { id: "SUB-HOUSING-RENT", parentId: "CAT-HOUSING", recordType: "category", name: "Rent", transactionType: "expense", essential: true, incomeStability: "fixed", active: true, sortOrder: 21 },
    { id: "SUB-HOUSING-ELECTRIC", parentId: "CAT-HOUSING", recordType: "category", name: "Electric", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 22 },
    { id: "SUB-HOUSING-GAS", parentId: "CAT-HOUSING", recordType: "category", name: "Household gas", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 23 },
    { id: "SUB-FOOD-GROCERIES", parentId: "CAT-FOOD", recordType: "category", name: "Groceries", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 31 },
    { id: "SUB-FOOD-COFFEE", parentId: "CAT-FOOD", recordType: "category", name: "Coffee & lunches", transactionType: "expense", essential: false, incomeStability: "variable", active: true, sortOrder: 32 },
    { id: "SUB-TRANSPORT-FUEL", parentId: "CAT-TRANSPORT", recordType: "category", name: "Fuel", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 41 },
    { id: "SUB-TRANSPORT-TRANSIT", parentId: "CAT-TRANSPORT", recordType: "category", name: "Transit", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 42 },
    { id: "SUB-LIFE-PHONE", parentId: "CAT-LIFE", recordType: "category", name: "Phone", transactionType: "expense", essential: true, incomeStability: "fixed", active: true, sortOrder: 51 },
    { id: "SUB-LIFE-FUN", parentId: "CAT-LIFE", recordType: "category", name: "Fun", transactionType: "expense", essential: false, incomeStability: "variable", active: true, sortOrder: 52 },
    { id: "SUB-DEBT-VISA", parentId: "CAT-DEBT", recordType: "category", name: "Card payment", transactionType: "expense", essential: true, incomeStability: "fixed", active: true, sortOrder: 61 },
  ];
  household.categories = [...groups, ...categories];
  household.shiftSettings = { ...DEFAULT_SHIFT_SETTINGS };
  return household;
}

const MONTHLY: { subcategoryId: string; amount: number }[] = [
  { subcategoryId: "SUB-INCOME-BIANCA", amount: 4200 },
  { subcategoryId: "SUB-HOUSING-RENT", amount: 1850 },
  { subcategoryId: "SUB-HOUSING-ELECTRIC", amount: 90 },
  { subcategoryId: "SUB-HOUSING-GAS", amount: 70 },
  { subcategoryId: "SUB-FOOD-GROCERIES", amount: 650 },
  { subcategoryId: "SUB-FOOD-COFFEE", amount: 120 },
  { subcategoryId: "SUB-TRANSPORT-FUEL", amount: 180 },
  { subcategoryId: "SUB-TRANSPORT-TRANSIT", amount: 40 },
  { subcategoryId: "SUB-LIFE-PHONE", amount: 95 },
  { subcategoryId: "SUB-LIFE-FUN", amount: 200 },
];

export function seedDemoHousehold(options?: { today?: DateKey; environment?: Household["environment"] }): Household {
  const today = options?.today ?? todayKey();
  const random = mulberry32(20260821);
  let household = catalogHousehold(options?.environment ?? "development");
  household.name = "Jonathan & Bianca";

  const months: DateKey[] = [];
  let cursor = `${shiftMonthKey(monthKeyFromDateKey(today), -5)}-01`;
  while (monthKeyFromDateKey(cursor) <= monthKeyFromDateKey(today)) {
    months.push(cursor);
    cursor = `${shiftMonthKey(monthKeyFromDateKey(cursor), 1)}-01`;
  }

  for (const start of months) {
    const monthKey = monthKeyFromDateKey(start);
    for (const row of MONTHLY) {
      household = setBudget(household, { monthKey, subcategoryId: row.subcategoryId, amount: row.amount }).household;
    }
    household = setBudget(household, { monthKey, subcategoryId: "SUB-INCOME-WAGES", amount: 900 }).household;
    household = setBudget(household, { monthKey, subcategoryId: "SUB-INCOME-TIPS", amount: 700 }).household;
  }

  for (const start of months) {
    const monthKey = monthKeyFromDateKey(start);
    household = postEntry(household, {
      date: `${monthKey}-01`,
      type: "expense",
      amount: 1850,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Rent",
      splits: equalSplits(["MEM-001", "MEM-002"], 185000),
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: `${monthKey}-15`,
      type: "income",
      amount: 2100,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-BIANCA",
      note: "Bianca pay",
      splits: [{ party: "MEM-001", amountCents: 210000 }],
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: `${monthKey}-28`,
      type: "income",
      amount: 2100,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-BIANCA",
      note: "Bianca pay",
      splits: [{ party: "MEM-001", amountCents: 210000 }],
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: `${monthKey}-08`,
      type: "expense",
      amount: +(70 + random() * 40).toFixed(2),
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Hydro",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: `${monthKey}-12`,
      type: "expense",
      amount: 95,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-LIFE-PHONE",
      note: "Phones",
      splits: equalSplits(["MEM-001", "MEM-002"], 9500),
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: `${monthKey}-05`,
      type: "expense",
      amount: 12.99,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Spotify",
      splits: [{ party: "MEM-002", amountCents: 1299 }],
      confirmDuplicate: true,
    }).household;

    for (let week = 0; week < 4; week += 1) {
      const groceryDay = addDays(start, 3 + week * 7);
      if (monthKeyFromDateKey(groceryDay) !== monthKey) continue;
      if (groceryDay > today) continue;
      const amount = +(95 + random() * 70).toFixed(2);
      household = postEntry(household, {
        date: groceryDay,
        type: "expense",
        amount,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: week % 2 === 0 ? "No Frills" : "Farm Boy",
        splits: random() > 0.3 ? jointSplit(Math.round(amount * 100)) : equalSplits(["MEM-001", "MEM-002"], Math.round(amount * 100)),
        confirmDuplicate: true,
      }).household;
    }

    for (let i = 0; i < 5; i += 1) {
      const day = addDays(start, 2 + i * 5);
      if (monthKeyFromDateKey(day) !== monthKey || day > today) continue;
      const amount = +(8 + random() * 18).toFixed(2);
      household = postEntry(household, {
        date: day,
        type: "expense",
        amount,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-COFFEE",
        note: random() > 0.5 ? "Coffee" : "Lunch",
        splits: [{ party: random() > 0.5 ? "MEM-001" : "MEM-002", amountCents: Math.round(amount * 100) }],
        confirmDuplicate: true,
      }).household;
    }

    const fuelDay = addDays(start, 10);
    if (fuelDay <= today && monthKeyFromDateKey(fuelDay) === monthKey) {
      const fuelAmount = +(55 + random() * 30).toFixed(2);
      household = postEntry(household, {
        date: fuelDay,
        type: "expense",
        amount: fuelAmount,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-TRANSPORT-FUEL",
        note: "Fuel",
        splits: [{ party: "MEM-002", amountCents: Math.round(Number(fuelAmount) * 100) }],
        confirmDuplicate: true,
      }).household;
    }

    const funDay = addDays(start, 18);
    if (funDay <= today && monthKeyFromDateKey(funDay) === monthKey) {
      const amount = +(40 + random() * 80).toFixed(2);
      household = postEntry(household, {
        date: funDay,
        type: "expense",
        amount,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-LIFE-FUN",
        note: random() > 0.5 ? "Dinner out" : "Movie",
        confirmDuplicate: true,
      }).household;
    }

    for (const offset of [4, 6, 11, 13, 18, 20, 25]) {
      const day = addDays(start, offset);
      if (day > today || monthKeyFromDateKey(day) !== monthKey) continue;
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 1) continue;
      household = postShift(household, {
        date: day,
        memberId: "MEM-002",
        accountId: "ACC-CASH",
        sales: +(800 + random() * 700).toFixed(2),
        cashTips: +(40 + random() * 50).toFixed(2),
        ccTips: +(60 + random() * 90).toFixed(2),
        hours: +(4 + random() * 3).toFixed(2),
        confirmDuplicate: true,
      }).household;
    }

    const visaPayment = addDays(start, 20);
    if (visaPayment <= today && monthKeyFromDateKey(visaPayment) === monthKey) {
      household = postTransfer(household, {
        date: visaPayment,
        amount: +(900 + random() * 400).toFixed(2),
        fromAccountId: "ACC-CHEQUING",
        toAccountId: "ACC-VISA",
        note: "Visa payment",
        confirmDuplicate: true,
      }).household;
    }
  }

  household = addGoal(household, {
    name: "Emergency buffer",
    target: 5000,
    shared: true,
    deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 6)}-01`,
  }).household;
  household = contributeToGoal(household, household.goals[0]!.id, 1600).household;
  household = addGoal(household, {
    name: "Bianca trip fund",
    target: 1200,
    shared: false,
    ownerMemberId: "MEM-001",
    deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 4)}-01`,
  }).household;
  household = contributeToGoal(household, household.goals[1]!.id, 340).household;

  household = addRecurrence(household, {
    cadence: "monthly",
    nextDate: `${shiftMonthKey(monthKeyFromDateKey(today), 1)}-01`,
    type: "expense",
    amount: 1850,
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-HOUSING-RENT",
    note: "Rent",
    splits: equalSplits(["MEM-001", "MEM-002"], 185000),
  }).household;
  household = addRecurrence(household, {
    cadence: "biweekly",
    nextDate: today,
    type: "income",
    amount: 2100,
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-INCOME-BIANCA",
    note: "Bianca pay",
    splits: [{ party: "MEM-001", amountCents: 210000 }],
  }).household;

  household = postEntry(household, {
    date: today,
    type: "expense",
    amount: 42,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-LIFE-FUN",
    note: "Haircut",
    place: "Personal",
    splits: [{ party: "MEM-001", amountCents: 4200 }],
    createdBy: "MEM-001",
    visibility: "personal",
    confirmDuplicate: true,
  }).household;
  household = postEntry(household, {
    date: today,
    type: "expense",
    amount: 28.5,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-LIFE-FUN",
    note: "Gym drop-in",
    place: "Personal",
    splits: [{ party: "MEM-002", amountCents: 2850 }],
    createdBy: "MEM-002",
    visibility: "personal",
    confirmDuplicate: true,
  }).household;
  household = postEntry(household, {
    date: today,
    type: "expense",
    amount: 18,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-COFFEE",
    note: "Saturday coffee",
    place: "Both ledgers",
    splits: [{ party: "MEM-001", amountCents: 1800 }],
    createdBy: "MEM-001",
    visibility: "both",
    confirmDuplicate: true,
  }).household;

  household = scribbleChalk(household, { text: "Leftover chili — do not order in", author: "MEM-001" }).household;
  household = scribbleChalk(household, { text: "Ember gets a hat if rent is on time", author: "MEM-002" }).household;

  return household;
}
