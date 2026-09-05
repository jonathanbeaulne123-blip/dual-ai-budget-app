import { addDays, monthKeyFromDateKey, shiftMonthKey, todayKey, TIMEZONE, type DateKey } from "./calendar.ts";
import { DEFAULT_SHIFT_SETTINGS } from "./shift.ts";
import {
  addAppointment,
  addGoal,
  addRecurrence,
  allocateHouseholdFundSurplus,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  confirmHouseholdFundSettlement,
  contributeToGoal,
  emptyHousehold,
  foundHouseholdCharter,
  holdHouseholdFundContribution,
  markInvestmentValue,
  moveAskGoalClaimToNextMonth,
  postEntry,
  postShift,
  postTransfer,
  postVisit,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
  scribbleChalk,
  setBudget,
  setHouseholdFundMonthPlan,
  signHouseholdCharter,
  skipOccurrence,
  upsertWorkJob,
} from "./commands.ts";
import { HOUSEHOLD_FUND_ID, projectHouseholdFund } from "./householdFund.ts";
import { emptyCreditDesk, shapeAccounts } from "./accountKinds.ts";
import { COMPANION, JOINT, type Category, type Household, type WorkJob } from "./types.ts";
import { jointSplit, equalSplits } from "./splits.ts";
import { shapeWorkJob } from "./work.ts";
import { shiftBibleMaterialHash, type ShiftBible } from "./shiftEnvelope.ts";
import { completeSyntheticDemoOnboarding } from "./onboarding/lifecycle.ts";

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
  // Demo/catalog books stay on America/Toronto so fixtures are stable across CI zones.
  household.timezone = TIMEZONE;
  const seededAt = "2026-01-01T00:00:00.000Z";
  household.members = [
    { id: "MEM-001", name: "Bianca", color: "#c45c26", active: true, updatedAt: seededAt },
    { id: "MEM-002", name: "Jonathan", color: "#2f6b4f", active: true, updatedAt: seededAt },
  ];
  household.ledgerNames = {
    shared: "Household Ledger",
    personal: {
      "MEM-001": "Bianca's Personal Ledger",
      "MEM-002": "Jonathan's Personal Ledger",
    },
  };
  const groups = [
    { id: "INCOME", parentId: null, recordType: "group", name: "Income", transactionType: "income", essential: false, incomeStability: null, active: true, sortOrder: 10 },
    { id: "CAT-HOUSING", parentId: null, recordType: "group", name: "Housing", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 20 },
    { id: "CAT-FOOD", parentId: null, recordType: "group", name: "Food", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 30 },
    { id: "CAT-TRANSPORT", parentId: null, recordType: "group", name: "Transport", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 40 },
    { id: "CAT-LIFE", parentId: null, recordType: "group", name: "Life", transactionType: "expense", essential: false, incomeStability: null, active: true, sortOrder: 50 },
    { id: "CAT-HEALTH", parentId: null, recordType: "group", name: "Health", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 55 },
    { id: "CAT-DEBT", parentId: null, recordType: "group", name: "Debt", transactionType: "expense", essential: true, incomeStability: null, active: true, sortOrder: 60 },
  ];
  const categories = [
    { id: "SUB-INCOME-WAGES", parentId: "INCOME", recordType: "category", name: "Wages", transactionType: "income", essential: false, incomeStability: "variable", active: true, sortOrder: 11 },
    { id: "SUB-INCOME-TIPS", parentId: "INCOME", recordType: "category", name: "Tips", transactionType: "income", essential: false, incomeStability: "variable", active: true, sortOrder: 12 },
    { id: "SUB-INCOME-BIANCA", parentId: "INCOME", recordType: "category", name: "Bianca pay", transactionType: "income", essential: false, incomeStability: "fixed", active: true, sortOrder: 13 },
    { id: "SUB-INCOME-INTEREST", parentId: "INCOME", recordType: "category", name: "Interest", transactionType: "income", essential: false, incomeStability: "variable", active: true, sortOrder: 14 },
    { id: "SUB-INCOME-REWARDS", parentId: "INCOME", recordType: "category", name: "Rewards", transactionType: "income", essential: false, incomeStability: "variable", active: true, sortOrder: 15 },
    { id: "SUB-HOUSING-RENT", parentId: "CAT-HOUSING", recordType: "category", name: "Rent", transactionType: "expense", essential: true, incomeStability: "fixed", active: true, sortOrder: 21 },
    { id: "SUB-HOUSING-ELECTRIC", parentId: "CAT-HOUSING", recordType: "category", name: "Electric", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 22 },
    { id: "SUB-HOUSING-GAS", parentId: "CAT-HOUSING", recordType: "category", name: "Household gas", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 23 },
    { id: "SUB-FOOD-GROCERIES", parentId: "CAT-FOOD", recordType: "category", name: "Groceries", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 31 },
    { id: "SUB-FOOD-COFFEE", parentId: "CAT-FOOD", recordType: "category", name: "Coffee & lunches", transactionType: "expense", essential: false, incomeStability: "variable", active: true, sortOrder: 32 },
    { id: "SUB-TRANSPORT-FUEL", parentId: "CAT-TRANSPORT", recordType: "category", name: "Fuel", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 41 },
    { id: "SUB-TRANSPORT-TRANSIT", parentId: "CAT-TRANSPORT", recordType: "category", name: "Transit", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 42 },
    { id: "SUB-LIFE-PHONE", parentId: "CAT-LIFE", recordType: "category", name: "Phone", transactionType: "expense", essential: true, incomeStability: "fixed", active: true, sortOrder: 51 },
    { id: "SUB-LIFE-FUN", parentId: "CAT-LIFE", recordType: "category", name: "Fun", transactionType: "expense", essential: false, incomeStability: "variable", active: true, sortOrder: 52 },
    { id: "SUB-HEALTH-DENTAL", parentId: "CAT-HEALTH", recordType: "category", name: "Dental", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 56 },
    { id: "SUB-HEALTH-THERAPY", parentId: "CAT-HEALTH", recordType: "category", name: "Therapy", transactionType: "expense", essential: true, incomeStability: "fixed", active: true, sortOrder: 57 },
    { id: "SUB-HEALTH-VET", parentId: "CAT-HEALTH", recordType: "category", name: "Vet", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 58 },
    { id: "SUB-HEALTH-CARE", parentId: "CAT-HEALTH", recordType: "category", name: "Care", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 59 },
    { id: "SUB-DEBT-VISA", parentId: "CAT-DEBT", recordType: "category", name: "Card payment", transactionType: "expense", essential: true, incomeStability: "fixed", active: true, sortOrder: 61 },
    { id: "SUB-DEBT-INTEREST", parentId: "CAT-DEBT", recordType: "category", name: "Card interest", transactionType: "expense", essential: true, incomeStability: "variable", active: true, sortOrder: 62 },
  ];
  household.categories = [...groups, ...categories].map((row) => ({
    ...row,
    createdAt: seededAt,
    updatedAt: seededAt,
  })) as Category[];
  household.accounts = shapeAccounts([
    {
      id: "ACC-CHEQUING",
      name: "Everyday chequing",
      kind: "chequing",
      currency: "CAD",
      active: true,
      ownerMemberId: JOINT,
      institution: "TD",
      last4: "4821",
      sortOrder: 10,
    },
    {
      id: "ACC-SAVINGS",
      name: "High-interest savings",
      kind: "savings",
      currency: "CAD",
      active: true,
      ownerMemberId: JOINT,
      institution: "EQ Bank",
      last4: "1190",
      sortOrder: 20,
      savings: { apyBps: 425, purpose: "general" },
    },
    {
      id: "ACC-GOALS",
      name: "Goals savings",
      kind: "savings",
      currency: "CAD",
      active: true,
      ownerMemberId: JOINT,
      institution: "EQ Bank",
      last4: "2201",
      sortOrder: 25,
      savings: { apyBps: 425, purpose: "goals" },
    },
    {
      id: "ACC-VISA",
      name: "Visa",
      kind: "credit",
      currency: "CAD",
      active: true,
      ownerMemberId: JOINT,
      institution: "TD",
      last4: "4412",
      sortOrder: 30,
      credit: {
        ...emptyCreditDesk(),
        creditLimitCents: 500000,
        aprBps: 1999,
        statementDay: 21,
        dueDaysAfterStatement: 21,
        defaultCashbackBps: 100,
        rewardsName: "Cashback",
        rules: [{ id: "RULE-GROCERIES", label: "Groceries", subcategoryId: "SUB-FOOD-GROCERIES", bps: 300 }],
      },
    },
    {
      id: "ACC-MC",
      name: "Mastercard",
      kind: "credit",
      currency: "CAD",
      active: true,
      ownerMemberId: JOINT,
      institution: "RBC",
      last4: "7788",
      sortOrder: 40,
      credit: {
        ...emptyCreditDesk(),
        creditLimitCents: 250000,
        aprBps: 2099,
        statementDay: 14,
        dueDaysAfterStatement: 21,
        defaultCashbackBps: 50,
        rewardsName: "Points",
      },
    },
    {
      id: "ACC-CASH",
      name: "Cash / tips",
      kind: "other",
      currency: "CAD",
      active: true,
      ownerMemberId: "MEM-002",
      institution: "",
      last4: "",
      sortOrder: 50,
    },
    {
      id: "ACC-TFSA",
      name: "TFSA",
      kind: "investment",
      currency: "CAD",
      active: true,
      ownerMemberId: JOINT,
      institution: "Wealthsimple",
      last4: "",
      sortOrder: 60,
      investment: { vehicle: "tfsa", markedValueCents: null, markedAt: null },
    },
    {
      id: "ACC-CLAIMS",
      name: "Benefits owing",
      kind: "receivable",
      currency: "CAD",
      active: true,
      ownerMemberId: JOINT,
      institution: "",
      last4: "",
      sortOrder: 70,
    },
  ], seededAt);
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
  const environment = options?.environment ?? "development";
  if (environment !== "development") throw new Error("The demo kitchen is Development-only.");
  const random = mulberry32(20260821);
  let household = catalogHousehold(environment);
  household.name = "Jonathan & Bianca";

  const months: DateKey[] = [];
  let cursor = `${shiftMonthKey(monthKeyFromDateKey(today), -3)}-01`;
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
    const postScheduled = (date: DateKey, entry: Omit<Parameters<typeof postEntry>[1], "date">): void => {
      if (date > today) return;
      household = postEntry(household, { ...entry, date }).household;
    };
    postScheduled(`${monthKey}-01`, {
      type: "expense",
      amount: 1850,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Rent",
      splits: equalSplits(["MEM-001", "MEM-002"], 185000),
      confirmDuplicate: true,
    });
    postScheduled(`${monthKey}-15`, {
      type: "income",
      amount: 2100,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-BIANCA",
      note: "Bianca pay",
      splits: [{ party: "MEM-001", amountCents: 210000 }],
      confirmDuplicate: true,
    });
    postScheduled(`${monthKey}-28`, {
      type: "income",
      amount: 2100,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-BIANCA",
      note: "Bianca pay",
      splits: [{ party: "MEM-001", amountCents: 210000 }],
      confirmDuplicate: true,
    });
    postScheduled(`${monthKey}-08`, {
      type: "expense",
      amount: +(70 + random() * 40).toFixed(2),
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Hydro",
      confirmDuplicate: true,
    });
    postScheduled(`${monthKey}-12`, {
      type: "expense",
      amount: 95,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-LIFE-PHONE",
      note: "Phones",
      splits: equalSplits(["MEM-001", "MEM-002"], 9500),
      confirmDuplicate: true,
    });
    postScheduled(`${monthKey}-05`, {
      type: "expense",
      amount: 12.99,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Spotify",
      splits: [{ party: "MEM-002", amountCents: 1299 }],
      confirmDuplicate: true,
    });

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
        customersServed: 40,
        staffingCount: 4,
        eventTag: "regular",
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

    const savingsDay = addDays(start, 16);
    if (savingsDay <= today && monthKeyFromDateKey(savingsDay) === monthKey) {
      household = postTransfer(household, {
        date: savingsDay,
        amount: 250,
        fromAccountId: "ACC-CHEQUING",
        toAccountId: "ACC-SAVINGS",
        note: "To savings",
        confirmDuplicate: true,
      }).household;
    }

    const tfsaDay = addDays(start, 17);
    if (tfsaDay <= today && monthKeyFromDateKey(tfsaDay) === monthKey) {
      household = postTransfer(household, {
        date: tfsaDay,
        amount: 100,
        fromAccountId: "ACC-CHEQUING",
        toAccountId: "ACC-TFSA",
        note: "TFSA contribution",
        confirmDuplicate: true,
      }).household;
    }

    const mcDay = addDays(start, 9);
    if (mcDay <= today && monthKeyFromDateKey(mcDay) === monthKey) {
      const amount = +(22 + random() * 40).toFixed(2);
      household = postEntry(household, {
        date: mcDay,
        type: "expense",
        amount,
        accountId: "ACC-MC",
        subcategoryId: "SUB-LIFE-FUN",
        note: random() > 0.5 ? "Streaming" : "Pharmacy",
        confirmDuplicate: true,
      }).household;
    }
  }

  household = markInvestmentValue(household, {
    accountId: "ACC-TFSA",
    markedValue: 680,
    markedAt: today,
  }).household;

  const timOffsets = [2, 3, 2, 4, 2, 3, 2, 3];
  let timDay = today;
  const timDates: DateKey[] = [];
  for (const skip of timOffsets) {
    timDay = addDays(timDay, -skip);
    if (timDay <= today) timDates.push(timDay);
  }
  for (const day of [...timDates].reverse()) {
    household = postEntry(household, {
      date: day,
      type: "expense",
      amount: 2.25,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Tim Hortons",
      place: "Queen and Bathurst",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
  }

  household = addGoal(household, {
    name: "Emergency buffer",
    target: 5000,
    shared: true,
    deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 6)}-01`,
  }).household;
  household = contributeToGoal(household, household.goals.find((goal) => goal.name === "Emergency buffer")!.id, 1600, { markFunded: true }).household;
  household = postTransfer(household, {
    date: today,
    amount: 1600,
    fromAccountId: "ACC-CHEQUING",
    toAccountId: "ACC-GOALS",
    note: "Sit-down jar · Emergency buffer",
    confirmDuplicate: true,
  }).household;
  household = addGoal(household, {
    name: "Newfoundland, October",
    target: 4200,
    shared: true,
    deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 2)}-01`,
  }).household;
  household = addGoal(household, {
    name: "Hercules · vet fund",
    target: 600,
    shared: true,
    deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 8)}-01`,
  }).household;
  household = addGoal(household, {
    name: "Bianca trip fund",
    target: 1200,
    shared: false,
    ownerMemberId: "MEM-001",
    deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 4)}-01`,
  }).household;
  household = contributeToGoal(household, household.goals.find((goal) => goal.name === "Bianca trip fund")!.id, 340, { markFunded: true }).household;
  household = postTransfer(household, {
    date: today,
    amount: 340,
    fromAccountId: "ACC-CHEQUING",
    toAccountId: "ACC-GOALS",
    note: "Sit-down jar · Bianca trip fund",
    confirmDuplicate: true,
  }).household;

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
  household = scribbleChalk(household, { text: "Hercules gets a hat if rent is on time", author: "MEM-002" }).household;

  household = addAppointment(household, {
    title: "Hygienist",
    kind: "dentist",
    memberId: JOINT,
    place: "Queen West Dental",
    practitioner: "Dr. Patel",
    nextDate: `${shiftMonthKey(monthKeyFromDateKey(today), 1)}-12`,
    cadence: { kind: "monthly", interval: 6 },
    typicalCost: 248,
    typicalRecovery: 180,
    subcategoryId: "SUB-HEALTH-DENTAL",
    accountId: "ACC-VISA",
  }).household;
  household = addAppointment(household, {
    title: "Therapy",
    kind: "therapy",
    memberId: "MEM-001",
    place: "The Annex",
    practitioner: "Dr. Chen",
    sensitivity: "quiet",
    nextDate: addDays(today, 4),
    cadence: { kind: "weekly", interval: 2 },
    typicalCost: 160,
    typicalRecovery: 80,
    subcategoryId: "SUB-HEALTH-THERAPY",
    accountId: "ACC-VISA",
  }).household;
  household = addAppointment(household, {
    title: "Hercules — checkup",
    kind: "vet",
    memberId: COMPANION,
    place: "Annex Cat Clinic",
    practitioner: "Dr. Ng",
    nextDate: `${shiftMonthKey(monthKeyFromDateKey(today), 7)}-03`,
    cadence: { kind: "monthly", interval: 12 },
    typicalCost: 186,
    typicalRecovery: 0,
    subcategoryId: "SUB-HEALTH-VET",
    accountId: "ACC-VISA",
  }).household;

  const lastClean = addDays(today, -40);
  if (lastClean < today) {
    const dentist = household.appointments.find((item) => item.kind === "dentist");
    if (dentist) {
      household = postVisit(household, {
        date: lastClean,
        amount: 248,
        appointmentId: dentist.id,
        accountId: "ACC-VISA",
        expectedRecovery: 180,
        claimLabel: "Sun Life · cleaning",
        craEligible: true,
        lines: [
          { code: "01204", description: "Exam", amount: 72 },
          { code: "11101", description: "Debridement", amount: 128 },
          { code: "12111", description: "Fluoride", amount: 48 },
        ],
        confirmDuplicate: true,
        createdBy: "MEM-002",
      }).household;
    }
  }

  const demoJobAt = `${today}T12:00:00.000Z`;
  const demoWorkJob = shapeWorkJob({
    id: "",
    memberId: "MEM-002",
    name: "Demo Bistro",
    color: "#2f6b4f",
    active: true,
    timezone: TIMEZONE,
    locationName: "Toronto",
    gpsEnabled: false,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [{
        id: "RATE-SERVER",
        effectiveDate: today,
        grossHourlyRateCents: 1600,
        takeHomeMode: "direct",
        takeHomeHourlyRateCents: 1400,
        deductions: [],
        createdAt: demoJobAt,
        updatedAt: demoJobAt,
      }],
      createdAt: demoJobAt,
      updatedAt: demoJobAt,
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: false,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [],
    salesFields: [{ id: "SALES-TOTAL", label: "Sales", requirement: "optional", createdAt: demoJobAt, updatedAt: demoJobAt }],
    paySchedule: { cadence: "biweekly", anchorDate: today, weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: today, weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "16:00" },
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "personal",
      cashTipsVisibility: "personal",
      cardTipsVisibility: "personal",
      tipOutVisibility: "personal",
      wagesDepositAccountId: "ACC-CHEQUING",
      cashTipsAccountId: "ACC-CASH",
      cardTipsDepositAccountId: "ACC-CHEQUING",
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "Demo Timesheet job for Development kitchen.",
    createdAt: demoJobAt,
    updatedAt: demoJobAt,
  } satisfies WorkJob, demoJobAt);
  household = upsertWorkJob(household, { job: demoWorkJob }).household;

  const biancaDemoJob = shapeWorkJob({
    ...demoWorkJob,
    id: "",
    memberId: "MEM-001",
    name: "Demo Bistro",
    color: "#c45c26",
    roles: demoWorkJob.roles.map((role) => ({
      ...role,
      id: "ROLE-SERVER-BIANCA",
      rates: role.rates.map((rate) => ({ ...rate, id: "RATE-SERVER-BIANCA" })),
    })),
    salesFields: demoWorkJob.salesFields.map((field) => ({ ...field, id: "SALES-TOTAL-BIANCA" })),
    note: "Demo Timesheet job so Bianca can punch and scan on Shift Today.",
  } satisfies WorkJob, demoJobAt);
  household = upsertWorkJob(household, { job: biancaDemoJob }).household;

  household = seedHouseholdFund(household, today);

  // Development's random-data button is a D-172 rehearsal, not a legacy
  // bypass. Give every generated shift a sealed synthetic Bible so Tip Science
  // exercises the same durable record it uses for real confirmed shifts.
  household.shifts = household.shifts.map((shift) => {
    if (shift.shiftBible) return shift;
    const demoJob = household.workJobs.find((job) => job.memberId === shift.memberId && job.name === "Demo Bistro");
    const demoRole = demoJob?.roles.find((role) => role.active);
    if (!demoJob || !demoRole) return shift;
    const actualStart = `${shift.date}T21:00:00.000Z`;
    const actualEnd = new Date(Date.parse(actualStart) + Math.round(shift.hours * 60) * 60_000).toISOString();
    const at = shift.updatedAt ?? shift.createdAt;
    const base: Omit<ShiftBible, "materialHash"> = {
      id: `BIBLE-DEMO-${shift.id}`, version: 1, revision: 1, environment: household.environment,
      householdId: household.householdId, memberId: shift.memberId, envelopeId: `ENV-DEMO-${shift.id}`,
      outcome: "worked", jobId: demoJob.id, roleId: demoRole.id, locationName: demoJob.locationName,
      timezone: TIMEZONE, scheduledStart: actualStart, scheduledEnd: actualEnd, actualStart, actualEnd,
      workedMinutes: Math.round(shift.hours * 60), paidBreakMinutes: 0, unpaidBreakMinutes: 0,
      approvalState: "user_confirmed", scheduleDifferenceMinutes: 0, cashTipsCents: shift.cashTipsCents,
      cardTipsCents: shift.ccTipsCents, salesCents: shift.salesCents, salesByField: {},
      customersServed: shift.customersServed ?? null, staffingCount: shift.staffingCount ?? null,
      grossWagesCents: shift.wagesCents, netTipsCents: shift.netTipsCents, tipOutCents: 0, attendance: [],
      weather: null, weatherGlass: shift.weatherGlass ?? null, eventTag: shift.eventTag ?? null, contextFacts: [], revisionHistory: [],
      authority: ["workedMinutes", "cashTipsCents", "cardTipsCents", "salesCents", "customersServed", "staffingCount"].map((field) => ({
        field, source: "manual" as const, observedAt: at, finality: "user_confirmed" as const, presence: "present" as const,
      })),
      linkedShiftId: shift.id, commandConfirmationId: `demo:${shift.id}`, correctionOfBibleId: null, correctedByBibleId: null,
      confirmedAt: at, createdAt: at, updatedAt: at,
    };
    return { ...shift, jobId: demoJob.id, roleId: demoRole.id, shiftBible: { ...base, materialHash: shiftBibleMaterialHash(base) } };
  });

  return completeSyntheticDemoOnboarding(household, {
    at: `${today}T12:00:00.000Z`,
    sourceKey: `seed:${today}`,
  });
}

/** Four synthetic months of command-authored Fund and Charter history. */
function seedHouseholdFund(input: Household, today: DateKey): Household {
  const BIANCA = "MEM-001";
  const JONATHAN = "MEM-002";
  const sharedGoals = input.goals.filter((goal) => goal.shared && goal.status !== "retired");
  const sharedGoalId = sharedGoals[0]?.id;
  if (!sharedGoalId) return input;

  const finalMonth = monthKeyFromDateKey(today);
  const months = [-3, -2, -1, 0].map((offset) => shiftMonthKey(finalMonth, offset));
  const [firstMonth, secondMonth, thirdMonth] = months;
  if (!firstMonth || !secondMonth || !thirdMonth) return input;
  const on = (key: string, dayOfMonth: number): DateKey => `${key}-${String(dayOfMonth).padStart(2, "0")}`;
  const past = (date: DateKey): boolean => date <= today;

  let household = configureHouseholdFund(input, {
    custodianMemberId: BIANCA,
    openedOn: on(firstMonth, 1),
    createdBy: BIANCA,
  }).household;
  household = foundHouseholdCharter(household, {
    memberId: JONATHAN,
    custodianMemberId: BIANCA,
    purpose: "Keep the household steady without overwork.",
    splitRule: "remainder",
    splitNote: "Bianca's pay covers what it covers. Jonathan closes the rest.",
    ceilingKind: "hours-per-week",
    ceilingValue: 24,
    cadence: "weekly",
    cadenceWeekday: 0,
    clauses: [{ heading: "Bills", body: "The Fund covers agreed household bills." }],
    date: on(firstMonth, 1),
  }).household;
  household = signHouseholdCharter(household, {
    memberId: BIANCA,
    at: `${on(firstMonth, 1)}T12:00:00-04:00`,
  }).household;

  const contribute = (contributorMemberId: string, amount: number, date: DateKey) => {
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: contributorMemberId,
      contributorMemberId,
      amount,
      date,
    });
    household = proposal.household;
    household = confirmHouseholdFundContribution(household, {
      memberId: BIANCA,
      proposalEventId: proposal.postedIds[0]!,
    }).household;
  };

  const buy = (amount: number, date: DateKey, note: string, subcategoryId = "SUB-HOUSING-ELECTRIC"): string => {
    const posted = postEntry(household, {
      date,
      type: "expense",
      amount,
      accountId: "ACC-VISA",
      subcategoryId,
      note,
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
      funding: { fundId: HOUSEHOLD_FUND_ID, fundedCents: Math.round(amount * 100), destinationAccountId: "ACC-VISA" },
    });
    household = posted.household;
    return posted.postedIds.find((id) => id.startsWith("TXN-"))!;
  };

  const settle = (amount: number, date: DateKey) => {
    household = confirmHouseholdFundSettlement(household, {
      memberId: BIANCA,
      amount,
      destinationAccountId: "ACC-VISA",
      date,
    }).household;
  };

  // This one standing bill crosses all four months and makes the discovery arc
  // comparable without inventing a second register formula.
  household = addRecurrence(household, {
    cadence: "monthly",
    nextDate: on(firstMonth, 15),
    type: "expense",
    amount: 520,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-HEALTH-CARE",
    note: "Groceries · planned",
    fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
  }).household;

  // Month one: rough. Confirmed sources cover what was bought, but not the next
  // grocery run. A real Ask remains.
  contribute(BIANCA, 600, on(firstMonth, 2));
  contribute(JONATHAN, 200, on(firstMonth, 6));

  // Plans stay visible before their due dates. Add the final-month obligations
  // while the first confirmed sources make the real command preflight honest;
  // no future contribution or purchase is posted to make planning possible.
  for (const row of [
    { day: 20, amount: 92, note: "Internet", subcategoryId: "SUB-HEALTH-CARE" },
    { day: 22, amount: 74, note: "Gas", subcategoryId: "SUB-HEALTH-CARE" },
    { day: 25, amount: 110, note: "Phone", subcategoryId: "SUB-HEALTH-CARE" },
    { day: 26, amount: 215, note: "Vet · Marmalade", subcategoryId: "SUB-HEALTH-CARE" },
  ]) {
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: on(finalMonth, row.day),
      type: "expense",
      amount: row.amount,
      accountId: "ACC-VISA",
      subcategoryId: row.subcategoryId,
      note: row.note,
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }).household;
  }
  buy(800, on(firstMonth, 8), "Household catch-up");
  settle(800, on(firstMonth, 10));

  // Record one real goal deferral through the Ask command. Its recurrence is then
  // skipped beyond the four-month fixture so it does not alter September's locked table.
  const deferredGoal = addGoal(household, {
    name: "Porch table",
    target: 600,
    shared: true,
    ownerMemberId: BIANCA,
  });
  household = deferredGoal.household;
  const deferredClaim = addRecurrence(household, {
    cadence: "monthly",
    nextDate: on(firstMonth, 28),
    type: "transfer",
    amount: 180,
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: deferredGoal.postedIds[0]!,
    note: "Standing · jar · Porch table",
  });
  household = deferredClaim.household;
  household = moveAskGoalClaimToNextMonth(household, {
    today: on(firstMonth, 12),
    memberId: JONATHAN,
    goalId: deferredGoal.postedIds[0]!,
    recurrenceId: deferredClaim.postedIds[0]!,
    claimDate: on(firstMonth, 28),
  }).household;
  for (let skipped = 0; skipped < 3; skipped += 1) {
    household = skipOccurrence(household, deferredClaim.postedIds[0]!).household;
  }

  // Month two: still rough. Jonathan's extra proposal is held for conversation
  // and remains invisible to the conserved register.
  contribute(BIANCA, 820, on(secondMonth, 2));
  contribute(JONATHAN, 180, on(secondMonth, 7));
  const heldProposal = proposeHouseholdFundContribution(household, {
    memberId: JONATHAN,
    contributorMemberId: JONATHAN,
    amount: 275,
    date: on(secondMonth, 9),
    note: "Check the overtime week together",
  });
  household = heldProposal.household;
  household = holdHouseholdFundContribution(household, {
    memberId: BIANCA,
    proposalEventId: heldProposal.postedIds[0]!,
    note: "Hold until the schedule is certain",
    date: on(secondMonth, 10),
  }).household;
  buy(1000, on(secondMonth, 11), "Shared catch-up");
  settle(1000, on(secondMonth, 20));

  // Month three: the household covers both the posted purchase and the planned
  // grocery run. Moving $280 to Kitty leaves the exact $240 September carry.
  contribute(BIANCA, 980, on(thirdMonth, 2));
  contribute(JONATHAN, 270, on(thirdMonth, 7));
  buy(730, on(thirdMonth, 9), "Shared essentials");
  settle(730, on(thirdMonth, 20));
  household = allocateHouseholdFundSurplus(household, {
    memberId: BIANCA,
    date: on(thirdMonth, 25),
    allocations: sharedGoals.length >= 3
      ? [
        { goalId: sharedGoals[0]!.id, amount: 160 },
        { goalId: sharedGoals[1]!.id, amount: 80 },
        { goalId: sharedGoals[2]!.id, amount: 40 },
      ]
      : [{ goalId: sharedGoalId, amount: 280 }],
    note: "Covered month rollover",
  }).household;

  // Final month: the current canonical Register & Ask Slice 2 scenario exactly.
  if (past(on(finalMonth, 4))) contribute(BIANCA, 980, on(finalMonth, 4));
  if (past(on(finalMonth, 6))) contribute(JONATHAN, 310, on(finalMonth, 6));
  if (past(on(finalMonth, 11))) contribute(JONATHAN, 225, on(finalMonth, 11));
  if (past(on(finalMonth, 18))) contribute(BIANCA, 980, on(finalMonth, 18));
  if (past(on(finalMonth, 4))) buy(128, on(finalMonth, 4), "Hydro", "SUB-DEBT-INTEREST");
  if (past(on(finalMonth, 5))) buy(1450, on(finalMonth, 5), "Rent · our share", "SUB-HOUSING-RENT");
  if (past(on(finalMonth, 10))) buy(186, on(finalMonth, 10), "Insurance", "SUB-DEBT-INTEREST");

  // A same-month returned synthetic purchase keeps the demo's refund surfaces
  // alive without adding a net Register obligation or changing September cents.
  const returnedId = past(on(finalMonth, 12))
    ? buy(10, on(finalMonth, 12), "Demo return", "SUB-DEBT-INTEREST")
    : null;
  if (returnedId && past(on(finalMonth, 13))) {
    household = postEntry(household, {
      date: on(finalMonth, 13),
      type: "refund",
      amount: 10,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-DEBT-INTEREST",
      refundOfId: returnedId,
      note: "Demo return refunded",
      createdBy: BIANCA,
      visibility: "household",
      confirmDuplicate: true,
    }).household;
  }

  if (past(on(finalMonth, 18))) {
    household = allocateHouseholdFundSurplus(household, {
      memberId: BIANCA,
      date: on(finalMonth, 18),
      allocations: sharedGoals.length >= 3
        ? [
          { goalId: sharedGoals[0]!.id, amount: 60 },
          { goalId: sharedGoals[1]!.id, amount: 40 },
          { goalId: sharedGoals[2]!.id, amount: 20 },
        ]
        : [{ goalId: sharedGoalId, amount: 120 }],
      note: "Settled-month rollover",
    }).household;
  }
  const reserve = addGoal(household, {
    name: "Winter reserve",
    target: 300,
    shared: true,
    ownerMemberId: BIANCA,
  });
  household = addRecurrence(reserve.household, {
    cadence: "monthly",
    nextDate: on(finalMonth, 30),
    type: "transfer",
    amount: 300,
    accountId: "ACC-CHEQUING",
    transferToAccountId: "ACC-GOALS",
    goalId: reserve.postedIds[0]!,
    note: "Standing · jar · Winter reserve",
  }).household;

  household = setHouseholdFundMonthPlan(household, {
    memberId: BIANCA,
    monthKey: finalMonth,
    target: 3400,
    buffer: 1500,
  }).household;
  const reconciledOn = addDays(today, -4);
  household = recordHouseholdFundReconciliation(household, {
    memberId: BIANCA,
    date: reconciledOn,
    bankTotal: (projectedTotal(household, reconciledOn) / 100).toFixed(2),
    note: "Weekly shared check",
  }).household;

  return household;
}

/** Operating plus Kitty, so the seeded reconciliation ties by construction. */
function projectedTotal(household: Household, date: DateKey): number {
  const projection = projectHouseholdFund(household, date);
  return projection.operatingBalanceCents + projection.kittyCents;
}
