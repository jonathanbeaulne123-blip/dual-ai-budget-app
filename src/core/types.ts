import type { Currency } from "./money.ts";
import type { DateKey, MonthKey } from "./calendar.ts";

export type Environment = "development" | "production";
export type TransactionType = "expense" | "income" | "transfer" | "refund";
export type IncomeStability = "fixed" | "variable";
export type PartyId = string; // member id or "joint"
export const JOINT = "joint" as const;
export type Visibility = "household" | "personal" | "both";
export type LedgerView = "household" | "personal";
export type Tombstone = { id: string; deletedAt: string };

export type Member = {
  id: string;
  name: string;
  color: string;
  active: boolean;
};

export type Account = {
  id: string;
  name: string;
  kind: "chequing" | "savings" | "credit" | "cash";
  currency: Currency;
  active: boolean;
  ownerMemberId: string | typeof JOINT;
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
  source: "manual" | "shift" | "recurring" | "import";
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

export type Recurrence = {
  id: string;
  cadence: "weekly" | "biweekly" | "monthly";
  nextDate: DateKey;
  type: "expense" | "income";
  amountCents: number;
  accountId: string;
  subcategoryId: string;
  note: string;
  splits: Split[];
  active: boolean;
  autoPost: boolean;
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
};

export type BudgetPlan = {
  id: string;
  monthKey: MonthKey;
  subcategoryId: string;
  amountCents: number;
  essential: boolean;
  incomeStability: IncomeStability | null;
  active: boolean;
};

export type Activity = {
  id: string;
  at: string;
  action: string;
  summary: string;
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
  goals: Goal[];
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
  goals: Goal[];
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
  readonly code: "duplicate" | "sameShiftDay" | "settingsChanged";
  readonly matches: Transaction[];
  readonly preview?: unknown;

  constructor(code: "duplicate" | "sameShiftDay" | "settingsChanged", message: string, matches: Transaction[] = [], preview?: unknown) {
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
