import { addDays, monthKeyFromDateKey, shiftMonthKey, todayKey, TIMEZONE, type DateKey } from "./calendar.ts";
import { DEFAULT_SHIFT_SETTINGS } from "./shift.ts";
import { emptyHousehold, postEntry, postShift, postTransfer, addGoal, addRecurrence, setBudget, contributeToGoal, scribbleChalk, markInvestmentValue, addAppointment, postVisit, upsertWorkJob } from "./commands.ts";
import { emptyCreditDesk, shapeAccounts } from "./accountKinds.ts";
import { COMPANION, JOINT, type Category, type Household, type WorkJob } from "./types.ts";
import { jointSplit, equalSplits } from "./splits.ts";
import { shapeWorkJob } from "./work.ts";

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
  household = contributeToGoal(household, household.goals[0]!.id, 1600, { markFunded: true }).household;
  household = postTransfer(household, {
    date: today,
    amount: 1600,
    fromAccountId: "ACC-CHEQUING",
    toAccountId: "ACC-GOALS",
    note: "Sit-down jar · Emergency buffer",
    confirmDuplicate: true,
  }).household;
  household = addGoal(household, {
    name: "Bianca trip fund",
    target: 1200,
    shared: false,
    ownerMemberId: "MEM-001",
    deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 4)}-01`,
  }).household;
  household = contributeToGoal(household, household.goals[1]!.id, 340, { markFunded: true }).household;
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

  return household;
}
