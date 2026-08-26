import { addDays, kitchenSeason, monthKeyFromDateKey, shiftMonthKey, weekdaySunday0, type DateKey } from "./calendar.ts";
import {
  addAppointment,
  addGoal,
  addPreset,
  addRecurrence,
  fundGoal,
  markInvestmentValue,
  payDeferredWorkTipOut,
  postEntry,
  postTransfer,
  postVisit,
  postWorkShift,
  scribbleChalk,
  setBudget,
  settleClaim,
  settleWorkReceivable,
  upsertWorkJob,
} from "./commands.ts";
import { catalogHousehold } from "./seed.ts";
import { equalSplits, jointSplit } from "./splits.ts";
import { TIMEZONE } from "./calendar.ts";
import { workScheduleMatches } from "./workSettlement.ts";
import { bookBalanceAsOf } from "./statements.ts";
import type { Household, Transaction, TransactionLocation, WorkJob } from "./types.ts";
import type { WeatherGlass } from "./weather.ts";

export type StressNumberStyle = "realistic" | "pretty";

export type StressSeedOptions = {
  today: DateKey;
  environment?: Household["environment"];
  seed?: number;
  numberStyle?: StressNumberStyle;
  /**
   * When set (Reload on an existing Development household), keep Google continuity
   * identity so Hercules Pro can still read the fixture after sync.
   */
  preserveFrom?: Household;
  /** Member who receives harbour tip shifts (default MEM-002 / Jonathan). */
  tipMemberId?: string;
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

/** Real Toronto harbourfront pin used for Harbour Dining Room stamps. */
const HARBOUR = { latitude: 43.6408, longitude: -79.3771, label: "Harbourfront Centre, Toronto" } as const;

const PLACE_PINS = {
  "No Frills": { latitude: 43.6445, longitude: -79.4198, label: "No Frills Queen West" },
  "Farm Boy": { latitude: 43.6709, longitude: -79.3868, label: "Farm Boy Yorkville" },
  "Metro": { latitude: 43.6486, longitude: -79.3802, label: "Metro Front Street" },
  "FreshCo": { latitude: 43.6592, longitude: -79.4371, label: "FreshCo Bloor West" },
  "Loblaws": { latitude: 43.6702, longitude: -79.3861, label: "Loblaws Yorkville" },
  "Tim Hortons": { latitude: 43.6487, longitude: -79.3774, label: "Tim Hortons Bay & Wellington" },
  "Balzac's Coffee": { latitude: 43.6489, longitude: -79.3807, label: "Balzac's Distillery" },
  "Pilot Coffee": { latitude: 43.6482, longitude: -79.3795, label: "Pilot Coffee Adelaide" },
  "Demo Cafe": { latitude: 43.6465, longitude: -79.3912, label: "Demo Cafe King West" },
  "Second Cup": { latitude: 43.6629, longitude: -79.3957, label: "Second Cup College" },
  "Harbour Bistro": { latitude: 43.6405, longitude: -79.3782, label: "Harbour Bistro" },
  "Pho House": { latitude: 43.6542, longitude: -79.4008, label: "Pho House Spadina" },
  "Pizza Libretto": { latitude: 43.6491, longitude: -79.4204, label: "Pizza Libretto Ossington" },
  "Sushi Corner": { latitude: 43.6558, longitude: -79.3842, label: "Sushi Corner Yonge" },
  "Parkdale Diner": { latitude: 43.6372, longitude: -79.4335, label: "Parkdale Diner" },
  "Esso": { latitude: 43.6418, longitude: -79.4195, label: "Esso Queen West" },
  "Shell": { latitude: 43.6584, longitude: -79.3821, label: "Shell Bloor & Yonge" },
  "Petro-Canada": { latitude: 43.6481, longitude: -79.4022, label: "Petro-Canada Bathurst" },
  "Canadian Tire Gas+": { latitude: 43.6688, longitude: -79.3735, label: "Canadian Tire Gas+ Davenport" },
  "Property manager": { latitude: 43.6512, longitude: -79.3832, label: "Property office Bay Street" },
  "Toronto Hydro": { latitude: 43.6535, longitude: -79.3838, label: "Toronto Hydro" },
  "Enbridge Gas": { latitude: 43.6484, longitude: -79.3812, label: "Enbridge customer centre" },
  "Freedom Mobile": { latitude: 43.6548, longitude: -79.3806, label: "Freedom Mobile Eaton Centre" },
  "Spotify": { latitude: 43.6532, longitude: -79.3832, label: "Online · Toronto" },
  "Northern Design Studio": { latitude: 43.6495, longitude: -79.3778, label: "Northern Design Studio" },
  "Queen West Dental": { latitude: 43.6458, longitude: -79.4112, label: "Queen West Dental" },
  "The Annex": { latitude: 43.6698, longitude: -79.4028, label: "The Annex" },
  "Annex Cat Clinic": { latitude: 43.6712, longitude: -79.4085, label: "Annex Cat Clinic" },
  "College Optical": { latitude: 43.6614, longitude: -79.3836, label: "College Optical" },
} as const;

/** Weekday tip multipliers for a tipped Toronto dining room (Sun=0 … Sat=6). */
const WEEKDAY_TIP_WEIGHT = [0.72, 0.78, 0.88, 0.94, 1.05, 1.38, 1.48] as const;

type StressWeather = {
  glass: WeatherGlass;
  celsius: number;
  word: string;
  tipWeight: number;
  section: "Patio section" | "Dining room" | "Bar rail" | "Private dining";
};

function jitter(random: () => number, base: number, spread: number): number {
  return Math.round((base + (random() - 0.5) * spread) * 1e5) / 1e5;
}

function stampAt(
  random: () => number,
  pin: { latitude: number; longitude: number; label: string },
  capturedAt: string,
  spread = 0.0012,
): TransactionLocation {
  return {
    latitude: jitter(random, pin.latitude, spread),
    longitude: jitter(random, pin.longitude, spread),
    accuracyMeters: Math.round(8 + random() * 24),
    capturedAt,
    label: pin.label,
  };
}

function placePin(place: string): { latitude: number; longitude: number; label: string } {
  return PLACE_PINS[place as keyof typeof PLACE_PINS] ?? { latitude: 43.6532, longitude: -79.3832, label: place };
}

function pickStressWeather(random: () => number, date: DateKey, hour: number): StressWeather {
  const season = kitchenSeason(date);
  const month = Number(date.slice(5, 7));
  const night = hour >= 20 || hour < 6;
  const roll = random();
  if (season === "ruff") {
    if (roll < 0.28) {
      return { glass: "snow", celsius: Math.round(-12 + random() * 10), word: "snowy", tipWeight: 0.62, section: "Dining room" };
    }
    if (roll < 0.48) {
      return { glass: "rain", celsius: Math.round(-2 + random() * 8), word: "raining", tipWeight: 0.7, section: "Dining room" };
    }
    if (night) {
      return { glass: "night", celsius: Math.round(-8 + random() * 10), word: "clear night", tipWeight: 0.85, section: "Bar rail" };
    }
    return { glass: "clear", celsius: Math.round(-4 + random() * 12), word: "clear", tipWeight: 0.92, section: "Dining room" };
  }
  if (season === "patio") {
    if (roll < 0.18) {
      return { glass: "rain", celsius: Math.round(16 + random() * 8), word: "raining", tipWeight: 0.68, section: "Dining room" };
    }
    if (roll < 0.55) {
      return { glass: "humid", celsius: Math.round(24 + random() * 8), word: "humid", tipWeight: 1.22, section: "Patio section" };
    }
    if (night) {
      return { glass: "night", celsius: Math.round(18 + random() * 6), word: "warm night", tipWeight: 1.18, section: "Patio section" };
    }
    return { glass: "clear", celsius: Math.round(22 + random() * 8), word: "sunny", tipWeight: 1.28, section: "Patio section" };
  }
  // Shoulder months (Apr–May, Sep–Oct)
  if (roll < 0.22) {
    return { glass: "rain", celsius: Math.round(6 + random() * 10), word: "raining", tipWeight: 0.74, section: "Dining room" };
  }
  if (month === 9 || month === 10) {
    if (night) return { glass: "night", celsius: Math.round(8 + random() * 8), word: "cool night", tipWeight: 0.96, section: "Private dining" };
    return { glass: "clear", celsius: Math.round(12 + random() * 10), word: "clear", tipWeight: 1.05, section: "Dining room" };
  }
  if (night) return { glass: "night", celsius: Math.round(4 + random() * 8), word: "cool night", tipWeight: 0.9, section: "Bar rail" };
  return { glass: "clear", celsius: Math.round(8 + random() * 12), word: "clear", tipWeight: 1.02, section: "Dining room" };
}

function stressJob(startDate: DateKey, memberId: string): WorkJob {
  const at = `${startDate}T12:00:00.000Z`;
  return {
    id: "",
    memberId,
    name: "Harbour Dining Room",
    color: "#2f6b4f",
    active: true,
    timezone: TIMEZONE,
    locationName: "Toronto waterfront",
    gpsEnabled: true,
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
      { id: "SALES-OTHER", label: "Other", requirement: "optional", createdAt: at, updatedAt: at },
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
    note: "Synthetic Development job with wages, cash tips, card tips, paid breaks, sales categories, GPS stamps, and three tip-out timings.",
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
    occurredAt?: string;
    location?: TransactionLocation;
  },
): Household {
  return postEntry(household, {
    ...input,
    type: "expense",
    source: "import",
    confirmDuplicate: true,
  }).household;
}

function spendStamp(
  random: () => number,
  date: DateKey,
  place: string,
  hour = 12,
): { occurredAt: string; location: TransactionLocation } {
  const minute = Math.floor(random() * 50);
  const occurredAt = `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`;
  return {
    occurredAt,
    location: stampAt(random, placePin(place), new Date(occurredAt).toISOString()),
  };
}

/**
 * Keep Google/membership/revision identity while replacing activity with stress books.
 * Accounts/categories/jobs come from the stress fixture (catalog IDs); continuity fields
 * stay on the live household so Pro OAuth and hosted snapshots still match.
 */
export function preserveContinuityForStressSeed(current: Household, stress: Household): Household {
  if (current.environment !== "development") {
    throw new Error("Preserving continuity on Reload is available only in Development.");
  }
  return {
    ...stress,
    householdId: current.householdId,
    inviteCode: current.inviteCode,
    linked: current.linked,
    revision: current.revision,
    baseRevision: current.baseRevision,
    members: current.members,
    google: current.google,
    devices: current.devices,
    sharing: current.sharing,
  };
}

/** A dense but valid twelve-month household for Development and visual demos. */
export function seedStressHousehold(options: StressSeedOptions): Household {
  const style = options.numberStyle ?? "realistic";
  const random = mulberry32(options.seed ?? 20260825);
  const today = options.today;
  const tipMemberId = options.tipMemberId
    || options.preserveFrom?.members.find((member) => member.active && member.id === "MEM-002")?.id
    || options.preserveFrom?.members.find((member) => member.active)?.id
    || "MEM-002";
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
  household = upsertWorkJob(household, { job: stressJob(firstDate, tipMemberId) }).household;
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
      const stamp = spendStamp(random, date, "Northern Design Studio", 9);
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
        ...stamp,
      }).household;
    }

    const fixedExpenses = [
      { day: 1, amount: style === "pretty" ? 2_400 : 2_375, accountId: "ACC-CHEQUING", category: "SUB-HOUSING-RENT", note: "Rent", place: "Property manager", hour: 10 },
      { day: 5, amount: style === "pretty" ? 15 : 12.99, accountId: "ACC-VISA", category: "SUB-LIFE-FUN", note: "Music subscription", place: "Spotify", hour: 8 },
      { day: 8, amount: money(random, 82, 148, style, 5), accountId: "ACC-CHEQUING", category: "SUB-HOUSING-ELECTRIC", note: "Hydro bill", place: "Toronto Hydro", hour: 11 },
      { day: 11, amount: money(random, 48, 102, style, 5), accountId: "ACC-CHEQUING", category: "SUB-HOUSING-GAS", note: "Gas bill", place: "Enbridge Gas", hour: 11 },
      { day: 14, amount: style === "pretty" ? 100 : 96.42, accountId: "ACC-CHEQUING", category: "SUB-LIFE-PHONE", note: "Mobile phones", place: "Freedom Mobile", hour: 12 },
    ];
    for (const item of fixedExpenses) {
      const date = `${month}-${String(item.day).padStart(2, "0")}` as DateKey;
      if (!withinToday(date)) continue;
      const stamp = spendStamp(random, date, item.place, item.hour);
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
        ...stamp,
      }).household;
    }

    for (let week = 0; week < 4; week += 1) {
      const date = addDays(monthStart, 3 + week * 7);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const merchant = choose(random, groceries);
      const amount = money(random, 105, 218, style, 5);
      const accountId = week % 3 === 0 ? "ACC-MC" : "ACC-VISA";
      const sourceId = `ofx:${accountId === "ACC-VISA" ? "0000000000004412" : "0000000000007788"}:GROC-${month}-${week + 1}`;
      const stamp = spendStamp(random, date, merchant, 17);
      household = week % 2 === 0
        ? postImportedExpense(household, { date, amount, accountId, subcategoryId: "SUB-FOOD-GROCERIES", note: `${merchant} groceries`, place: merchant, sourceId, ...stamp })
        : postEntry(household, { date, type: "expense", amount, accountId, subcategoryId: "SUB-FOOD-GROCERIES", note: `${merchant} groceries`, place: merchant, confirmDuplicate: true, ...stamp }).household;
    }

    for (let index = 0; index < 4; index += 1) {
      const date = addDays(monthStart, 2 + index * 6);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const merchant = choose(random, cafes);
      const stamp = spendStamp(random, date, merchant, 8 + index);
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
        ...stamp,
      }).household;
    }

    for (let index = 0; index < 2; index += 1) {
      const date = addDays(monthStart, 12 + index * 11);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const merchant = choose(random, dining);
      const stamp = spendStamp(random, date, merchant, 19);
      household = postEntry(household, {
        date,
        type: "expense",
        amount: money(random, 42, 148, style, 5),
        accountId: index ? "ACC-MC" : "ACC-VISA",
        subcategoryId: "SUB-LIFE-FUN",
        note: "Dinner out",
        place: merchant,
        confirmDuplicate: true,
        ...stamp,
      }).household;
    }

    for (let index = 0; index < 2; index += 1) {
      const date = addDays(monthStart, 9 + index * 14);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const merchant = choose(random, fuel);
      const stamp = spendStamp(random, date, merchant, 18);
      household = postEntry(household, {
        date,
        type: "expense",
        amount: money(random, 58, 112, style, 5),
        accountId: "ACC-VISA",
        subcategoryId: "SUB-TRANSPORT-FUEL",
        note: "Fuel",
        place: merchant,
        confirmDuplicate: true,
        ...stamp,
      }).household;
    }

    // Dinner and lunch shifts weighted toward Fri/Sat; skip quiet Mondays often.
    const shiftOffsets = [1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24, 26, 27];
    for (const [shiftIndex, offset] of shiftOffsets.entries()) {
      const date = addDays(monthStart, offset);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      const weekday = weekdaySunday0(date);
      // Servers rarely work Monday lunch; skip ~55% of Mondays.
      if (weekday === 1 && random() < 0.55) continue;
      // Prefer dinner service; occasional lunch on weekends.
      const dinner = weekday === 0 || weekday === 6 ? random() > 0.25 : random() > 0.18;
      const startHour = dinner ? (weekday >= 5 ? 16 : 17) : 11;
      const baseHours = dinner
        ? (weekday >= 5 ? 7 + random() * 2.5 : 5.5 + random() * 2)
        : 4 + random() * 1.5;
      const hours = style === "pretty"
        ? choose(random, dinner ? [6, 7, 8, 8.5] as const : [4, 5, 5.5, 6] as const)
        : Math.round(baseHours * 4) / 4;
      const weather = pickStressWeather(random, date, startHour);
      const weekdayWeight = WEEKDAY_TIP_WEIGHT[weekday] ?? 1;
      const seasonBoost = kitchenSeason(date) === "patio" ? 1.12 : kitchenSeason(date) === "ruff" ? 0.9 : 1;
      const demand = weekdayWeight * weather.tipWeight * seasonBoost;
      const salesBase = dinner ? money(random, 980, 1_720, style, 25) : money(random, 420, 780, style, 25);
      const salesRounded = style === "pretty"
        ? Math.max(25, Math.round((salesBase * demand) / 25) * 25)
        : Math.round(salesBase * demand * 100) / 100;
      const foodShare = weather.section === "Bar rail" ? 0.42 : 0.62;
      const alcoholShare = weather.section === "Bar rail" ? 0.5 : 0.3;
      const otherShare = Math.max(0, 1 - foodShare - alcoholShare);
      const includeOther = otherShare > 0.05 && random() > 0.35;
      const food = Math.round(salesRounded * foodShare);
      const alcohol = Math.round(salesRounded * (includeOther ? alcoholShare : alcoholShare + otherShare));
      const other = includeOther ? Math.max(0, Math.round(salesRounded - food - alcohol)) : 0;
      const tipPool = money(random, 95, 210, style, 5) * demand;
      const cashTips = style === "pretty"
        ? Math.max(5, Math.round((tipPool * (0.22 + random() * 0.12)) / 5) * 5)
        : Math.round(tipPool * (0.22 + random() * 0.12) * 100) / 100;
      const cardTips = style === "pretty"
        ? Math.max(5, Math.round((tipPool - cashTips) / 5) * 5)
        : Math.round(Math.max(15, tipPool - cashTips) * 100) / 100;
      const paidBreakHours = hours >= 6 && shiftIndex % 3 === 0 ? 0.5 : hours >= 8 && random() > 0.4 ? 0.5 : 0;
      const endHour = Math.min(23, startHour + Math.ceil(hours + paidBreakHours));
      const startMinute = dinner ? choose(random, [0, 15, 30] as const) : choose(random, [0, 30] as const);
      const startedAt = `${date}T${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}:00-04:00`;
      const endedAt = `${date}T${String(endHour).padStart(2, "0")}:${String(choose(random, [0, 15, 30, 45] as const)).padStart(2, "0")}:00-04:00`;
      const note = `${weather.word} · ${weather.celsius}°C · ${weather.section}`;
      const location = stampAt(random, HARBOUR, new Date(startedAt).toISOString(), 0.0008);
      household = postWorkShift(household, {
        date,
        memberId: tipMemberId,
        jobId: job.id,
        roleId: role.id,
        workedHours: hours,
        paidBreakHours,
        salesByField: {
          "SALES-FOOD": food,
          "SALES-ALCOHOL": alcohol,
          ...(other > 0 ? { "SALES-OTHER": other } : {}),
        },
        cashTips,
        cardTips,
        cashTipsAccountId: "ACC-CASH",
        wagesDepositAccountId: "ACC-CHEQUING",
        cardTipsDepositAccountId: "ACC-CHEQUING",
        wagesVisibility: "both",
        cashTipsVisibility: "both",
        cardTipsVisibility: "both",
        tipOutVisibility: "both",
        startedAt,
        endedAt,
        note,
        occurredAt: startedAt,
        location,
        confirmDuplicate: true,
        createdBy: tipMemberId,
      }).household;
    }

    // Settle wages on the biweekly schedule and tip envelopes weekly when money is owed.
    for (let day = 0; day < 31; day += 1) {
      const date = addDays(monthStart, day);
      if (monthKeyFromDateKey(date) !== month || !withinToday(date)) continue;
      if (workScheduleMatches(job.paySchedule, date)) {
        const owed = Math.max(0, bookBalanceAsOf(household, job.wagesReceivableAccountId, date));
        if (owed >= 2_500) {
          const dollars = owed / 100;
          household = settleWorkReceivable(household, {
            jobId: job.id,
            kind: "wages",
            date,
            amount: style === "pretty" ? Math.max(25, Math.floor(dollars / 25) * 25) : dollars,
            accountId: "ACC-CHEQUING",
            createdBy: tipMemberId,
          }).household;
        }
      }
      if (workScheduleMatches(job.tipSchedule, date)) {
        const owed = Math.max(0, bookBalanceAsOf(household, job.cardTipsReceivableAccountId, date));
        if (owed >= 1_500) {
          const dollars = owed / 100;
          household = settleWorkReceivable(household, {
            jobId: job.id,
            kind: "card-tips",
            date,
            amount: style === "pretty" ? Math.max(5, Math.floor(dollars / 5) * 5) : dollars,
            accountId: "ACC-CHEQUING",
            createdBy: tipMemberId,
          }).household;
        }
        const deferredUnpaid = household.shifts
          .filter((shift) => shift.jobId === job.id && shift.memberId === tipMemberId)
          .reduce((sum, shift) => sum + Math.max(0, (shift.deferredTipOutCents ?? 0) - (shift.deferredTipOutPaidCents ?? 0)), 0);
        if (deferredUnpaid >= 1_000 && random() > 0.35) {
          const dollars = deferredUnpaid / 100;
          household = payDeferredWorkTipOut(household, {
            jobId: job.id,
            date,
            amount: style === "pretty" ? Math.max(5, Math.floor(dollars / 5) * 5) : dollars,
            accountId: "ACC-CASH",
            createdBy: tipMemberId,
          }).household;
        }
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
  household = scribbleChalk(household, {
    text: style === "pretty"
      ? "Pretty numbers; weather-weighted harbour shifts for Hercules Pro"
      : "Reload data: weather, location, and full shift forms for Hercules Pro",
    author: tipMemberId,
  }).household;

  if (options.preserveFrom) {
    return preserveContinuityForStressSeed(options.preserveFrom, household);
  }
  return household;
}

export function stressHouseholdAnnualIncome(household: Household): number {
  return household.transactions
    .filter((transaction: Transaction) => transaction.type === "income" && !transaction.isDuplicate)
    .reduce((sum, transaction) => sum + transaction.amountCents, 0) / 100;
}
