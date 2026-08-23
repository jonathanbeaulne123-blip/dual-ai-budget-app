import type { Currency } from "./money.ts";
import type { DateKey, MonthKey } from "./calendar.ts";

export type Environment = "development" | "production";
export type TransactionType = "expense" | "income" | "transfer" | "refund";
export type IncomeStability = "fixed" | "variable";
export type PartyId = string; // member id or "joint"
export const JOINT = "joint" as const;
/** Recurring companion costs (vet) sit on the household ledger, not a person. */
export const COMPANION = "companion" as const;
export type Visibility = "household" | "personal" | "both";
export type LedgerView = "household" | "personal";
export type Tombstone = { id: string; deletedAt: string };

export type Member = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  updatedAt: string;
};

export type AccountKind = "chequing" | "savings" | "credit" | "investment" | "other" | "receivable";
export type InvestmentVehicle = "tfsa" | "rrsp" | "fhsa" | "non-registered" | "crypto" | "other";

export type CreditRewardRule = {
  id: string;
  label: string;
  subcategoryId: string | null;
  bps: number;
};

export type CreditCardDesk = {
  creditLimitCents: number;
  aprBps: number;
  statementDay: number;
  dueDaysAfterStatement: number;
  minPaymentBps: number;
  minPaymentFloorCents: number;
  rewardsName: string;
  defaultCashbackBps: number;
  rules: CreditRewardRule[];
};

export type SavingsDesk = {
  apyBps: number;
};

export type InvestmentDesk = {
  vehicle: InvestmentVehicle;
  markedValueCents: number | null;
  markedAt: DateKey | null;
};

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  currency: Currency;
  active: boolean;
  ownerMemberId: string | typeof JOINT;
  institution: string;
  last4: string;
  sortOrder: number;
  credit: CreditCardDesk | null;
  savings: SavingsDesk | null;
  investment: InvestmentDesk | null;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  parentId: string | null;
  recordType: "group" | "category";
  name: string;
  transactionType: "expense" | "income";
  essential: boolean;
  incomeStability: IncomeStability | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Split = {
  party: PartyId;
  amountCents: number;
};

export type Transaction = {
  id: string;
  date: DateKey;
  type: TransactionType;
  amountCents: number;
  currency: Currency;
  accountId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  note: string;
  place: string;
  splits: Split[];
  transferPairId?: string;
  transferFromAccountId?: string;
  transferToAccountId?: string;
  refundOfId?: string;
  source: "manual" | "shift" | "recurring" | "import" | "visit";
  sourceId?: string;
  duplicateKey: string;
  potentialDuplicate: boolean;
  isDuplicate: boolean;
  reviewed: boolean;
  createdBy: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
};

export type ShiftSettings = {
  floorPct: number;
  barPct: number;
  barRoundCents: number;
  ccPct: number;
  hourlyRateCents: number;
};

export type Shift = {
  id: string;
  date: DateKey;
  memberId: string;
  accountId: string;
  salesCents: number;
  cashTipsCents: number;
  ccTipsCents: number;
  hours: number;
  floorTipOutCents: number;
  barTipOutCents: number;
  ccTipOutCents: number;
  netTipsCents: number;
  wagesCents: number;
  settings: ShiftSettings;
  settingsFingerprint: string;
  wagesTransactionId: string;
  tipsTransactionId: string;
  createdBy: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
};

export type RecurrenceCadence = "weekly" | "biweekly" | "monthly";
export type RecurrenceKind = "bill" | "subscription" | "paycheck" | "other";
export type RecurrenceOrigin = "manual" | "detected";
export type RecurrenceGoogleSync = Record<string, { calendarId: string; eventId: string }>;

export type Recurrence = {
  id: string;
  cadence: RecurrenceCadence;
  nextDate: DateKey;
  type: "expense" | "income";
  amountCents: number;
  accountId: string;
  subcategoryId: string;
  note: string;
  splits: Split[];
  active: boolean;
  autoPost: boolean;
  kind: RecurrenceKind;
  origin: RecurrenceOrigin;
  reminderHoursBefore: number;
  googleSync: RecurrenceGoogleSync;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdCalendar = {
  dismissedRhythmKeys: string[];
  /** On-device Hercules notices the household hid. Union-merged like rhythms (D-057). */
  dismissedNoticeKeys: string[];
};

export type PresetOrigin = "manual" | "detected";

/** Frozen Add template. Shared catalog row. Never posts money by itself (D-058). */
export type Preset = {
  id: string;
  type: "expense" | "income";
  /** 0 means the CAD pad still fills the amount. */
  amountCents: number;
  accountId: string;
  subcategoryId: string;
  note: string;
  place: string;
  splits: Split[];
  visibility: Visibility;
  sortOrder: number;
  origin: PresetOrigin;
  detectionKey: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentKind = "dentist" | "doctor" | "therapy" | "optometrist" | "physio" | "vet" | "spa" | "other";
export type AppointmentSensitivity = "household" | "quiet";
export type AppointmentCoverage = "ohip" | "private" | "none";
export type AppointmentMemberId = string | typeof JOINT | typeof COMPANION;

export type AppointmentCadence =
  | { kind: "weekly"; interval: number }
  | { kind: "monthly"; interval: number }
  | { kind: "days"; interval: number }
  | { kind: "nthWeekday"; weekday: number; nth: number; intervalMonths: number }
  | { kind: "once" };

export type BillLine = {
  id: string;
  code: string;
  description: string;
  amountCents: number;
};

export type Appointment = {
  id: string;
  title: string;
  kind: AppointmentKind;
  memberId: AppointmentMemberId;
  place: string;
  practitioner: string;
  sensitivity: AppointmentSensitivity;
  coverage: AppointmentCoverage;
  nextDate: DateKey;
  cadence: AppointmentCadence;
  typicalCostCents: number;
  typicalRecoveryCents: number;
  subcategoryId: string;
  accountId: string;
  lastVisitDate: DateKey | null;
  lastPostedTransactionId: string | null;
  savingGoalId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClaimKind = "insurance" | "employer" | "person" | "tax" | "other";
export type ClaimStatus = "pending" | "submitted" | "settled" | "short" | "denied";

export type Claim = {
  id: string;
  kind: ClaimKind;
  label: string;
  appointmentId: string | null;
  expenseTransactionId: string;
  recoveryTransactionId: string | null;
  settleTransferIds: string[];
  writeOffTransactionId: string | null;
  expectedCents: number;
  receivedCents: number;
  writtenOffCents: number;
  receivableAccountId: string;
  status: ClaimStatus;
  submittedAt: string | null;
  settledAt: string | null;
  craEligible: boolean;
  lines: BillLine[];
  createdAt: string;
  updatedAt: string;
};

export type CosmeticSlot = "hat" | "chain" | "house" | "collar";

export type ChalkPoint = {
  x: number;
  y: number;
};

export type ChalkStroke = {
  points: ChalkPoint[];
};

export type ChalkInk = {
  w: number;
  h: number;
  strokes: ChalkStroke[];
};

export type ChalkNote = {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  ink?: ChalkInk | null;
};

export type OpenShiftStatus = "open" | "cleared";

export type OpenShift = {
  memberId: string;
  startedAt: string;
  updatedAt: string;
  status: OpenShiftStatus;
};

export type CompanionCosmetics = {
  hat: string | null;
  chain: string | null;
  house: string | null;
  collar: string | null;
};

export type CompanionSpecies = "maine-coon" | "ember";

export type HouseholdCompanion = {
  name: string;
  species: CompanionSpecies;
  equipped: CompanionCosmetics;
  updatedAt: string;
};

export type AccountReconciliation = {
  id: string;
  accountId: string;
  statementDate: DateKey;
  statementCents: number;
  bookCents: number;
  differenceCents: number;
  status: "tied" | "open";
  createdAt: string;
  createdBy: string;
};

export type ClosedPeriod = {
  id: string;
  monthKey: MonthKey;
  closedAt: string;
  closedBy: string;
};

export type HouseholdBooksDesk = {
  reconciliations: AccountReconciliation[];
  closedMonths: ClosedPeriod[];
};

export type HerculesChatRole = "user" | "hercules";
export type HerculesTalkSource = "journal" | "memory" | "local" | "ai";
export type HerculesMemoryKind = "note" | "payday" | "bill" | "habit" | "preference";

export type HerculesLedgerTurn = {
  id: string;
  role: HerculesChatRole;
  text: string;
  source: HerculesTalkSource;
  createdAt: string;
  createdBy: string;
};

export type HerculesMemory = {
  id: string;
  kind: HerculesMemoryKind;
  text: string;
  label: string;
  sourceTurnId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type HerculesDesk = {
  chats: HerculesLedgerTurn[];
  memories: HerculesMemory[];
};

export type HouseholdKitchen = {
  chalkboard: ChalkNote[];
  companion: HouseholdCompanion;
  books: HouseholdBooksDesk;
  hercules: HerculesDesk;
  openShift: OpenShift | null;
};

export type GoogleService = "identity" | "calendar" | "drive" | "contacts" | "gmail" | "sheets";

export type GoogleBridgeLink = {
  memberId: string;
  email: string;
  subject: string;
  displayName: string;
  linkedAt: string;
  lastConfirmedAt: string;
  grantedScopes: string[];
  updatedAt: string;
  active: boolean;
};

export type HouseholdGoogle = {
  links: GoogleBridgeLink[];
  enabledServices: GoogleService[];
  updatedAt: string;
};

export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: DateKey | null;
  shared: boolean;
  ownerMemberId: string | null;
  subcategoryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoalContribution = {
  id: string;
  goalId: string;
  memberId: string;
  amountCents: number;
  date: DateKey;
  createdAt: string;
  updatedAt: string;
};

export type BudgetPlan = {
  id: string;
  monthKey: MonthKey;
  subcategoryId: string;
  amountCents: number;
  essential: boolean;
  incomeStability: IncomeStability | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Activity = {
  id: string;
  at: string;
  action: string;
  summary: string;
  updatedAt: string;
};

export type Household = {
  version: 1;
  householdId: string;
  inviteCode: string;
  linked: boolean;
  revision: number;
  tombstones: Tombstone[];
  name: string;
  timezone: "America/Toronto";
  currency: Currency;
  environment: Environment;
  members: Member[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  shifts: Shift[];
  recurrences: Recurrence[];
  appointments: Appointment[];
  claims: Claim[];
  presets: Preset[];
  calendar: HouseholdCalendar;
  kitchen: HouseholdKitchen;
  google: HouseholdGoogle;
  goals: Goal[];
  goalContributions: GoalContribution[];
  budgetPlans: BudgetPlan[];
  activity: Activity[];
  shiftSettings: ShiftSettings;
  lastCommittedAt: string | null;
};

export type SharedEnvelope = {
  kind: "shared";
  revision: number;
  householdId: string;
  inviteCode: string;
  name: string;
  timezone: Household["timezone"];
  currency: Currency;
  environment: Environment;
  members: Member[];
  accounts: Account[];
  categories: Category[];
  recurrences: Recurrence[];
  appointments: Appointment[];
  claims: Claim[];
  presets: Preset[];
  calendar: HouseholdCalendar;
  kitchen: HouseholdKitchen;
  google: HouseholdGoogle;
  goals: Goal[];
  goalContributions: GoalContribution[];
  budgetPlans: BudgetPlan[];
  activity: Activity[];
  shiftSettings: ShiftSettings;
  lastCommittedAt: string | null;
  transactions: Transaction[];
  shifts: Shift[];
  tombstones: Tombstone[];
};

export type PersonalEnvelope = {
  kind: "personal";
  memberId: string;
  lastCommittedAt: string | null;
  transactions: Transaction[];
  shifts: Shift[];
  tombstones: Tombstone[];
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NeedsConfirmationError extends Error {
  readonly code: "duplicate" | "sameShiftDay" | "settingsChanged" | "closedMonth";
  readonly matches: Transaction[];
  readonly preview?: unknown;

  constructor(code: "duplicate" | "sameShiftDay" | "settingsChanged" | "closedMonth", message: string, matches: Transaction[] = [], preview?: unknown) {
    super(message);
    this.name = "NeedsConfirmationError";
    this.code = code;
    this.matches = matches;
    this.preview = preview;
  }
}

export type UndoToken = {
  id: string;
  label: string;
  snapshot: Household;
  postedIds: string[];
};

export type CommitResult = {
  household: Household;
  warnings: string[];
  undo: UndoToken;
  postedIds: string[];
};
