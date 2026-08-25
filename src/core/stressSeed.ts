import { addDays, monthKeyFromDateKey, shiftMonthKey, type DateKey } from "./calendar.ts";
import {
  addAppointment,
  addGoal,
  addPreset,
  addRecurrence,
  fundGoal,
  markInvestmentValue,
  postEntry,
  postShift,
  postTransfer,
  postVisit,
  postWorkShift,
  scribbleChalk,
  setBudget,
  settleClaim,
  upsertWorkJob,
} from "./commands.ts";
import { catalogHousehold } from "./seed.ts";
import { equalSplits, jointSplit } from "./splits.ts";
import { TIMEZONE } from "./calendar.ts";
import type { Household, Transaction, WorkJob } from "./types.ts";

export type StressNumberStyle = "realistic" | "pretty";

export type StressSeedOptions = {
  today: DateKey;
  environment?: Household["environment"];
  seed?: number;
  numberStyle?: StressNumberStyle;
};

function mulberry32(seed: number): () => number {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function choose<T>(random: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]!;
}

function money(
  random: () => number,
  minimum: number,
  maximum: number,
  style: StressNumberStyle,
  prettyStep = 5,
): number {
  const raw = minimum + random() * (maximum - minimum);
  if (style === "pretty") return Math.max(prettyStep, Math.round(raw / prettyStep) * prettyStep);
  return Math.round(raw * 100) / 100;
}

function stressJob(startDate: DateKey): WorkJob {
  const at = `${startDate}T12:00:00.000Z`;
  return {
    id: "",
    memberId: "MEM-002",
    name: "Harbour Dining Room",
    color: "#2f6b4f",
    active: true,
    timezone: TIMEZONE,
    locationName: "Toronto waterfront",
    gpsEnabled: false,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [{
        id: "RATE-SERVER-BASE",
        effectiveDate: startDate,
        grossHourlyRateCents: 1825,
        takeHomeMode: "direct",
        takeHomeHourlyRateCents: 1550,
        deductions: [],
        createdAt: at,
        updatedAt: at,
      }],
      createdAt: at,
      updatedAt: at,
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [
      { id: "TIPOUT-BAR", label: "Bar", basis: "total-sales", value: 1, roundingCents: 500, roundingMode: "up", timing: "immediate", active: true, createdAt: at, updatedAt: at },
      { id: "TIPOUT-SUPPORT", label: "Support", basis: "total-sales", value: 3, roundingCents: 100, roundingMode: "nearest", timing: "withheld", active: true, createdAt: at, updatedAt: at },
      { id: "TIPOUT-KITCHEN", label: "Kitchen", basis: "fixed-shift", value: 500, roundingCents: 100, roundingMode: "nearest", timing: "deferred", active: true, createdAt: at, updatedAt: at },
    ],
    salesFields: [
      { id: "SALES-FOOD", label: "Food", requirement: "optional", createdAt: at, updatedAt: at },
      { id: "SALES-ALCOHOL", label: "Alcohol", requirement: "optional", createdAt: at, updatedAt: at },
      { id: "SALES-OTHER", label: "Other", requirement: "off", createdAt: at, updatedAt: at },
    ],
    paySchedule: { cadence: "biweekly", anchorDate: startDate, weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: startDate, weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "16:00" },
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "both",
      cashTipsVisibility: "both",
      cardTipsVisibility: "both",
      tipOutVisibility: "both",
      wagesDepositAccountId: "ACC-CHEQUING",
      cashTipsAccountId: "ACC-CASH",
      cardTipsDepositAccountId: "ACC-CHEQUING",
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "Synthetic Development job with wages, cash tips, card tips, paid breaks, sales categories, and three tip-out timings.",
    createdAt: at,
    updatedAt: at,
  };
}

function keepIdentityWhileErasing(current: Household, blank: Household): Household {
  return {
    ...blank,
    householdId: current.householdId,
    inviteCode: current.inviteCode,
    linked: current.linked,
    revision: current.revision,
    baseRevision: current.baseRevision,
    name: current.name,
    ledgerNames: current.ledgerNames,
    members: current.members,
    accounts: current.accounts,
    categories: current.categories,
    google: current.google,
    devices: current.devices,
    workJobs: current.workJobs,
    shiftSettings: current.shiftSettings,
    sharing: current.sharing,
  };
}

/**
 * Development-only destructive fixture action. It clears activity and money facts
 * while retaining the setup needed to keep testing this same household identity.
 */
export function eraseDevelopmentData(current: Household): Household {
  if (current.environment !== "development") throw new Error("Erase data is available only in Development.");
  return keepIdentityWhileErasing(current, catalogHousehold("development"));
}

function postImportedExpense(
  household: Household,
  input: {
    date: DateKey;
    amount: number;
    accountId: string;
    subcategoryId: string;
    note: string;
    place: string;
    sourceId: string;
  },
): Household {
  return postEntry(household, {
    ...input,
    type: "expense",
    source: "import",
    confirmDuplicate: true,
  }).household;
}

/** A dense but valid twelve-month household for Development and visual demos. */
export function seedStressHousehold(options: StressSeedOptions): Household {
  const style = options.numberStyle ?? "realistic";
  const random = mulberry32(options.seed ?? 20260825);
  const today = options.today;
  let household = catalogHousehold(options.environment ?? "development");
  household.name = style === "pretty" ? "The Pretty Numbers Household" : "The Stress-Test Household";
  household.ledgerNames = {
    shared: style === "pretty" ? "Showcase Household Books" : "Stress-Test Household Books",
    personal: {
      "MEM-001": "Bianca's Test Books",
      "MEM-002": "Jonathan's Test Books",
    },
  };

  const firstMonth = shiftMonthKey(monthKeyFromDateKey(today), -11);
  const firstDate = `${firstMonth}-01` as DateKey;
  household = upsertWorkJob(household, { job: stressJob(firstDate) }).household;
  const job = household.workJobs.find((row) => row.name === "Harbour Dining Room")!;
  const role = job.roles[0]!;
  const annualTarget = money(random, 92_000, 116_000, style, 5_000);
  const salaryPay = money(random, annualTarget * 0.72 / 24, annualTarget * 0.76 / 24, style, 25);
  const groceries = ["No Frills", "Farm Boy", "Metro", "FreshCo", "Loblaws"] as const;
  const cafes = ["Tim Hortons", "Balzac's Coffee", "Pilot Coffee", "Demo Cafe", "Second Cup"] as const;
  const dining = ["Harbour Bistro", "Pho House", "Pizza Libretto", "Sushi Corner", "Parkdale Diner"] as const;
  const fuel = ["Esso", "Shell", "Petro-Canada", "Canadian Tire Gas+"] as const;

  for (let monthOffset = 0; monthOffset < 12; monthOffset += 1) {
    const month = shiftMonthKey(firstMonth, monthOffset);
    const monthStart = `${month}-01` as DateKey;
    const withinToday = (day: DateKey) => day <= today;

    const budgetRows = [
      ["SUB-INCOME-BIANCA", salaryPay * 2],
      ["SUB-INCOME-WAGES", money(random, 900, 1_500, style, 50)],
      ["SUB-INCOME-TIPS", money(random, 1_100, 1_900, style, 50)],
      ["SUB-HOUSING-RENT", style === "pretty" ? 2_400 : 2_375],
      ["SUB-HOUSING-ELECTRIC", money(random, 85, 150, style, 5)],
      ["SUB-HOUSING-GAS", money(random, 45, 105, style, 5)],
      ["SUB-FOOD-GROCERIES", money(random, 700, 1_050, style, 25)],
      ["SUB-FOOD-COFFEE", money(random, 180, 325, style, 25)],
      ["SUB-TRANSPORT-FUEL", money(random, 220, 380, style, 25)],
      ["SUB-LIFE-PHONE", style === "pretty" ? 100 : 96.42],
      ["SUB-LIFE-FUN", money(random, 450, 850, style, 25)],
    ] as const;
    for (const [subcategoryId, amount] of budgetRows) {
      household = setBudget(household, { monthKey: month, subcategoryId, amount }).household;
    }

    for (const day of [7, 22]) {
      const date = `${month}-${String(day).padStart(2, "0")}` as DateKey;
      if (!withinToday(date)) continue;
      household = postEntry(household, {
        date,
        type: "income",
        amount: salaryPay,
        accountId: "ACC-CHEQUING",
        subcategoryId: "SUB-INCOME-BIANCA",
        note: "Bianca payroll deposit",
        place: "Northern Design Studio",
        splits: [{ party: "MEM-001", amountCents: Math.round(salaryPay * 100) }],
        confirmDuplicate: true,
        source: monthOffset % 3 === 0 ? "import" : "manual",
        sourceId: monthOffset % 3 === 0 ? `ofx:004:0000004821:PAY-${month}-${day}` : undefined,
      }).household;
    }

    const fixedExpenses = [
      { day: 1, amount: style === "pretty" ? 2_400 : 2_375, accountId: "ACC-CHEQUING", category: "SUB-HOUSING-RENT", note: "Rent", place: "Property manager" },
      { day: 5, amount: style === "pretty" ? 15 : 12.99, accountId: "ACC-VISA", category: "SUB-LIFE-FUN", note: "Music subscription", place: "Spotify" },
      { day: 8, amount: money(random, 82, 148, style, 5), accountId: "ACC-CHEQUING", category: "SUB-HOUSING-ELECTRIC", note: "Hydro bill", place: "Toronto Hydro" },
      { day: 11, amount: money(random, 48, 102, style, 5), accountId: "ACC-CHEQUING", category: "SUB-HOUSING-GAS", note: "Gas bill", place: "Enbridge Gas" },
      { day: 14, amount: style === "pretty" ? 100 : 96.42, accountId: "ACC-CHEQUING", category: "SUB-LIFE-PHONE", note: "Mobile phones", place: "Freedom Mobile" },
    ];
    for (const item of fixedExpenses) {
      const date = `${month}-${String(item.day).padStart(2, "0")}` as DateKey;
      if (!withinToday(date)) continue;
      household = postEntry(household, {
        date,
        type: "expense",
        amount: item.amount,
        accountId: item.accountId,
        subcategoryId: item.category,
        note: item.note,
        place: item.place,
        splits: item.note === "Rent" || item.note === "Mobile phones"
          ? equalSplits(["MEM-001", "MEM-002"], Math.round(item.amount * 100))
          : jointSplit(Math.round(item.amount * 100)),
        confirmDuplicate: true,
      }).household;
    }

    for (let week = 0; week < 4; week += 1) {
      const date = addDays(monthStart, 3 + week * 7);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const merchant = choose(random, groceries);
      const amount = money(random, 105, 218, style, 5);
      const accountId = week % 3 === 0 ? "ACC-MC" : "ACC-VISA";
      const sourceId = `ofx:${accountId === "ACC-VISA" ? "0000000000004412" : "0000000000007788"}:GROC-${month}-${week + 1}`;
      household = week % 2 === 0
        ? postImportedExpense(household, { date, amount, accountId, subcategoryId: "SUB-FOOD-GROCERIES", note: `${merchant} groceries`, place: merchant, sourceId })
        : postEntry(household, { date, type: "expense", amount, accountId, subcategoryId: "SUB-FOOD-GROCERIES", note: `${merchant} groceries`, place: merchant, confirmDuplicate: true }).household;
    }

    for (let index = 0; index < 4; index += 1) {
      const date = addDays(monthStart, 2 + index * 6);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const merchant = choose(random, cafes);
      household = postEntry(household, {
        date,
        type: "expense",
        amount: money(random, 4.25, 24.85, style, 5),
        accountId: index % 3 === 0 ? "ACC-MC" : "ACC-VISA",
        subcategoryId: "SUB-FOOD-COFFEE",
        note: index % 2 ? "Lunch" : "Coffee",
        place: merchant,
        createdBy: index % 2 ? "MEM-001" : "MEM-002",
        visibility: index === 3 ? "personal" : "household",
        confirmDuplicate: true,
      }).household;
    }

    for (let index = 0; index < 2; index += 1) {
      const date = addDays(monthStart, 12 + index * 11);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const merchant = choose(random, dining);
      household = postEntry(household, {
        date,
        type: "expense",
        amount: money(random, 42, 148, style, 5),
        accountId: index ? "ACC-MC" : "ACC-VISA",
        subcategoryId: "SUB-LIFE-FUN",
        note: "Dinner out",
        place: merchant,
        confirmDuplicate: true,
      }).household;
    }

    for (let index = 0; index < 2; index += 1) {
      const date = addDays(monthStart, 9 + index * 14);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const merchant = choose(random, fuel);
      household = postEntry(household, {
        date,
        type: "expense",
        amount: money(random, 58, 112, style, 5),
        accountId: "ACC-VISA",
        subcategoryId: "SUB-TRANSPORT-FUEL",
        note: "Fuel",
        place: merchant,
        confirmDuplicate: true,
      }).household;
    }

    const shiftOffsets = [2, 5, 9, 12, 16, 19, 23, 26];
    for (const [shiftIndex, offset] of shiftOffsets.entries()) {
      const date = addDays(monthStart, offset);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const hours = style === "pretty" ? choose(random, [5, 6, 7, 8] as const) : Math.round((5 + random() * 3.2) * 4) / 4;
      const sales = money(random, 850, 1_850, style, 25);
      const cashTips = money(random, 35, 92, style, 5);
      const cardTips = money(random, 95, 235, style, 5);
      if (monthOffset >= 10) {
        household = postWorkShift(household, {
          date,
          memberId: "MEM-002",
          jobId: job.id,
          roleId: role.id,
          workedHours: hours,
          paidBreakHours: shiftIndex % 4 === 0 ? 0.5 : 0,
          salesByField: { "SALES-FOOD": Math.round(sales * 0.68), "SALES-ALCOHOL": Math.round(sales * 0.32) },
          cashTips,
          cardTips,
          cashTipsAccountId: "ACC-CASH",
          startedAt: `${date}T17:00:00-04:00`,
          endedAt: `${date}T${String(Math.min(23, 17 + Math.ceil(hours))).padStart(2, "0")}:00:00-04:00`,
          note: shiftIndex % 3 === 0 ? "Patio section" : "Dining room",
          confirmDuplicate: true,
          createdBy: "MEM-002",
        }).household;
      } else {
        household = postShift(household, {
          date,
          memberId: "MEM-002",
          accountId: "ACC-CASH",
          sales,
          cashTips,
          ccTips: cardTips,
          hours,
          confirmDuplicate: true,
          createdBy: "MEM-002",
          visibility: shiftIndex % 4 === 0 ? "personal" : "both",
        }).household;
      }
    }

    const paymentDate = addDays(monthStart, 24);
    if (monthKeyFromDateKey(paymentDate) === month && withinToday(paymentDate)) {
      household = postTransfer(household, { date: paymentDate, amount: money(random, 1_250, 2_250, style, 50), fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-VISA", note: "Visa statement payment", confirmDuplicate: true }).household;
      household = postTransfer(household, { date: paymentDate, amount: money(random, 350, 900, style, 50), fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-MC", note: "Mastercard statement payment", confirmDuplicate: true }).household;
    }
    const savingsDate = addDays(monthStart, 17);
    if (monthKeyFromDateKey(savingsDate) === month && withinToday(savingsDate)) {
      household = postTransfer(household, { date: savingsDate, amount: money(random, 250, 650, style, 50), fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-SAVINGS", note: "Automatic savings", confirmDuplicate: true }).household;
    }
  }

  household = addGoal(household, { name: "Emergency buffer", target: style === "pretty" ? 10_000 : 9_750, deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 8)}-01`, shared: true }).household;
  household = fundGoal(household, { goalId: household.goals[0]!.id, amount: style === "pretty" ? 3_000 : money(random, 2_400, 3_800, style, 50), fromAccountId: "ACC-CHEQUING", date: today, createdBy: "MEM-001" }).household;
  household = addGoal(household, { name: "Weekend in Montréal", target: style === "pretty" ? 2_000 : 2_350, deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 5)}-01`, shared: true }).household;
  household = fundGoal(household, { goalId: household.goals[1]!.id, amount: style === "pretty" ? 750 : money(random, 575, 925, style, 25), fromAccountId: "ACC-CHEQUING", date: today, createdBy: "MEM-002" }).household;
  household = addGoal(household, { name: "Bianca's pottery wheel", target: style === "pretty" ? 1_500 : 1_675, deadline: `${shiftMonthKey(monthKeyFromDateKey(today), 6)}-01`, shared: false, ownerMemberId: "MEM-001" }).household;

  household = addRecurrence(household, { cadence: "monthly", nextDate: `${shiftMonthKey(monthKeyFromDateKey(today), 1)}-01`, type: "expense", amount: style === "pretty" ? 2_400 : 2_375, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-RENT", note: "Rent", splits: equalSplits(["MEM-001", "MEM-002"], (style === "pretty" ? 240_000 : 237_500)) }).household;
  household = addRecurrence(household, { cadence: "monthly", nextDate: addDays(today, 5), type: "expense", amount: style === "pretty" ? 125 : 118.42, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Toronto Hydro" }).household;
  household = addRecurrence(household, { cadence: "monthly", nextDate: addDays(today, 9), type: "expense", amount: style === "pretty" ? 100 : 96.42, accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-PHONE", note: "Freedom Mobile" }).household;
  household = addRecurrence(household, { cadence: "biweekly", nextDate: addDays(today, 3), type: "income", amount: salaryPay, accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-BIANCA", note: "Bianca payroll deposit", splits: [{ party: "MEM-001", amountCents: Math.round(salaryPay * 100) }] }).household;
  household = addRecurrence(household, { cadence: "monthly", nextDate: addDays(today, 12), type: "transfer", amount: style === "pretty" ? 500 : 425, accountId: "ACC-CHEQUING", transferToAccountId: "ACC-SAVINGS", note: "Automatic savings" }).household;

  household = addAppointment(household, { title: "Dental cleaning", kind: "dentist", memberId: "joint", place: "Queen West Dental", practitioner: "Dr. Patel", nextDate: addDays(today, 38), cadence: { kind: "monthly", interval: 6 }, typicalCost: 268, typicalRecovery: 200, subcategoryId: "SUB-HEALTH-DENTAL", accountId: "ACC-VISA" }).household;
  household = addAppointment(household, { title: "Therapy", kind: "therapy", memberId: "MEM-001", place: "The Annex", practitioner: "Dr. Chen", sensitivity: "quiet", nextDate: addDays(today, 6), cadence: { kind: "weekly", interval: 2 }, typicalCost: 165, typicalRecovery: 80, subcategoryId: "SUB-HEALTH-THERAPY", accountId: "ACC-VISA" }).household;
  household = addAppointment(household, { title: "Hercules annual exam", kind: "vet", memberId: "companion", place: "Annex Cat Clinic", practitioner: "Dr. Ng", nextDate: addDays(today, 84), cadence: { kind: "monthly", interval: 12 }, typicalCost: 215, typicalRecovery: 0, subcategoryId: "SUB-HEALTH-VET", accountId: "ACC-MC" }).household;
  household = addAppointment(household, { title: "Eye exam", kind: "optometrist", memberId: "MEM-002", place: "College Optical", practitioner: "Dr. Singh", nextDate: addDays(today, 21), cadence: { kind: "monthly", interval: 24 }, typicalCost: 145, typicalRecovery: 110, subcategoryId: "SUB-HEALTH-CARE", accountId: "ACC-VISA" }).household;

  const dental = household.appointments.find((item) => item.kind === "dentist")!;
  household = postVisit(household, { date: addDays(today, -120), amount: 268, appointmentId: dental.id, accountId: "ACC-VISA", expectedRecovery: 200, claimLabel: "Sun Life dental claim", craEligible: true, lines: [{ code: "01204", description: "Exam", amount: 82 }, { code: "11101", description: "Cleaning", amount: 138 }, { code: "12111", description: "Fluoride", amount: 48 }], confirmDuplicate: true, createdBy: "MEM-002" }).household;
  const firstClaim = household.claims.at(-1);
  if (firstClaim) household = settleClaim(household, { claimId: firstClaim.id, amount: 150, toAccountId: "ACC-CHEQUING", date: addDays(today, -82), confirmDuplicate: true, createdBy: "MEM-002" }).household;
  const therapy = household.appointments.find((item) => item.kind === "therapy")!;
  household = postVisit(household, { date: addDays(today, -18), amount: 165, appointmentId: therapy.id, accountId: "ACC-VISA", expectedRecovery: 80, claimLabel: "Wellness benefit", confirmDuplicate: true, createdBy: "MEM-001", visibility: "personal" }).household;
  const vet = household.appointments.find((item) => item.kind === "vet")!;
  household = postVisit(household, { date: addDays(today, -55), amount: 215, appointmentId: vet.id, accountId: "ACC-MC", expectedRecovery: 0, note: "Hercules annual exam", place: "Annex Cat Clinic", confirmDuplicate: true, createdBy: "MEM-002" }).household;

  household = addPreset(household, { type: "expense", amount: 0, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", note: "Weekly groceries", place: "No Frills", splits: jointSplit(0), visibility: "household" }).household;
  household = addPreset(household, { type: "expense", amount: style === "pretty" ? 10 : 6.25, accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-COFFEE", note: "Coffee", place: "Tim Hortons", splits: [{ party: "MEM-002", amountCents: (style === "pretty" ? 1_000 : 625) }], visibility: "both" }).household;
  household = markInvestmentValue(household, { accountId: "ACC-TFSA", markedValue: style === "pretty" ? 12_500 : money(random, 11_400, 13_600, style, 50), markedAt: today }).household;
  household = scribbleChalk(household, { text: "Synthetic Development household — safe to erase", author: "MEM-001" }).household;
  household = scribbleChalk(household, { text: style === "pretty" ? "Pretty numbers are rounded on purpose" : "Try imports, shifts, claims, bills, jars, and Calendar", author: "MEM-002" }).household;
  return household;
}

export function stressHouseholdAnnualIncome(household: Household): number {
  return household.transactions
    .filter((transaction: Transaction) => transaction.type === "income" && !transaction.isDuplicate)
    .reduce((sum, transaction) => sum + transaction.amountCents, 0) / 100;
}
