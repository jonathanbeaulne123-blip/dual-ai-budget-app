import type { Currency } from "./money.ts";
import type { DateKey, MonthKey } from "./calendar.ts";
import type { SevenShiftsEvidenceBundle } from "./evidence.ts";

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
export type AccountScope = "shared" | "personal";
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

export type SavingsPurpose = "general" | "goals";

export type SavingsDesk = {
  apyBps: number;
  /** `goals` is the household sinking-fund vault. Pigs are envelopes on it, not extra bank accounts. */
  purpose: SavingsPurpose;
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
  /** Legacy accounts shape to `shared`. Personal account metadata travels only in its owner's Personal envelope. */
  scope?: AccountScope;
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

/** Optional GPS stamp on a posted row (D-126). Never posts money by itself. */
export type TransactionLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
  label?: string;
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
  /** Wall-clock instant when the member says the spend happened (ISO). Optional. */
  occurredAt?: string;
  location?: TransactionLocation;
  splits: Split[];
  transferPairId?: string;
  transferFromAccountId?: string;
  transferToAccountId?: string;
  refundOfId?: string;
  reversalOfId?: string;
  source: "manual" | "shift" | "recurring" | "import" | "visit" | "reversal";
  sourceId?: string;
  duplicateKey: string;
  potentialDuplicate: boolean;
  isDuplicate: boolean;
  reviewed: boolean;
  createdBy: string;
  visibility: Visibility;
  /** Independent of visibility. This allocates some or all of an expense/refund to the virtual Household Fund. */
  funding?: HouseholdFundTransactionFunding;
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

export type WorkTakeHomeMode = "direct" | "deductions";
export type WorkPayCadence = "weekly" | "biweekly" | "twice-monthly" | "custom";
export type WorkTipOutBasis = "total-sales" | "card-tips" | "all-tips" | "fixed-shift" | "fixed-hour" | "manual";
export type WorkTipOutTiming = "immediate" | "withheld" | "deferred";
export type WorkSalesRequirement = "off" | "optional" | "required";

export type WorkDeductionRule = {
  id: string;
  label: string;
  percent: number;
};

export type WorkRatePeriod = {
  id: string;
  effectiveDate: DateKey;
  grossHourlyRateCents: number;
  takeHomeMode: WorkTakeHomeMode;
  takeHomeHourlyRateCents: number;
  deductions: WorkDeductionRule[];
  createdAt: string;
  updatedAt: string;
};

export type WorkRole = {
  id: string;
  name: string;
  tipped: boolean;
  active: boolean;
  rates: WorkRatePeriod[];
  createdAt: string;
  updatedAt: string;
};

export type WorkTipOutRule = {
  id: string;
  label: string;
  basis: WorkTipOutBasis;
  /** Percentage for percentage bases; cents for fixed-shift/manual; cents-per-hour for fixed-hour. */
  value: number;
  roundingCents: number;
  roundingMode: "nearest" | "up" | "down";
  timing: WorkTipOutTiming;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkSalesField = {
  id: string;
  label: string;
  requirement: WorkSalesRequirement;
  createdAt: string;
  updatedAt: string;
};

export type WorkPaySchedule = {
  cadence: WorkPayCadence;
  anchorDate: DateKey;
  weekday: number;
  monthDays: number[];
  customDates: DateKey[];
  reminderTime: string;
};

export type WorkLedgerDefaults = {
  wagesVisibility: Visibility;
  cashTipsVisibility: Visibility;
  cardTipsVisibility: Visibility;
  tipOutVisibility: Visibility;
  wagesDepositAccountId: string;
  cashTipsAccountId: string;
  cardTipsDepositAccountId: string;
};

/** One employer setup. A shift selects exactly one role; changing roles requires a new shift. */
export type WorkJob = {
  id: string;
  memberId: string;
  name: string;
  color: string;
  active: boolean;
  timezone: string;
  locationName: string;
  gpsEnabled: boolean;
  /** One rounded workplace pin for historical weather. Never a per-shift GPS trail. */
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  roles: WorkRole[];
  paidBreakRate: "role" | "custom";
  paidBreakHourlyRateCents: number;
  overtimeEnabled: boolean;
  overtimeWeeklyThresholdHours: number;
  overtimeMultiplier: number;
  tipOutRules: WorkTipOutRule[];
  salesFields: WorkSalesField[];
  paySchedule: WorkPaySchedule;
  tipSchedule: WorkPaySchedule;
  tipWeekStartsOn: number;
  defaults: WorkLedgerDefaults;
  wagesReceivableAccountId: string;
  cardTipsReceivableAccountId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** Closed enum for Confirm event anomaly tags (tip covariates). Never stores coworker names. */
export const SHIFT_EVENT_TAGS = [
  "regular",
  "holiday",
  "sports",
  "festival",
  "private_party",
  "short_staffed",
  "vacation_cover",
  "illness_cover",
  "other",
] as const;
export type ShiftEventTag = (typeof SHIFT_EVENT_TAGS)[number];

export function isShiftEventTag(value: unknown): value is ShiftEventTag {
  return typeof value === "string" && (SHIFT_EVENT_TAGS as readonly string[]).includes(value);
}

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
  /** Job-based fields are optional only for legacy D-028 shifts. */
  jobId?: string;
  roleId?: string;
  startedAt?: string | null;
  endedAt?: string | null;
  grossWagesCents?: number;
  paidBreakHours?: number;
  paidBreakIncomeCents?: number;
  overtimeHours?: number;
  cardTipsAfterTipOutCents?: number;
  immediateTipOutCents?: number;
  withheldTipOutCents?: number;
  deferredTipOutCents?: number;
  deferredTipOutPaidCents?: number;
  salesByField?: Record<string, number>;
  /** Self-reported covers; required on tipped Confirm going forward. */
  customersServed?: number;
  /** Floor/section headcount only — never coworker names. */
  staffingCount?: number;
  /** Demand/anomaly tag for tip science soft priors. */
  eventTag?: ShiftEventTag;
  /** Kitchen weather glass stamp at Confirm (soft prior; not income). */
  weatherGlass?: "clear" | "rain" | "snow" | "night" | "humid";
  transactionIds?: string[];
  cashTipsTransactionId?: string;
  cardTipsTransactionId?: string;
  paidBreakTransactionId?: string;
  tipOutTransactionIds?: string[];
  wagesVisibility?: Visibility;
  cashTipsVisibility?: Visibility;
  cardTipsVisibility?: Visibility;
  tipOutVisibility?: Visibility;
  wagesDepositAccountId?: string;
  cashTipsAccountId?: string;
  cardTipsDepositAccountId?: string;
  correctedByShiftId?: string;
  correctionOfShiftId?: string;
  note?: string;
  /** HMAC digest of a 7shifts time punch. Provenance only; never a token or wage. */
  sevenShiftsPunchDigest?: string;
  /** Versioned, multi-source member evidence accepted at the work-command boundary. */
  sevenShiftsEvidenceBundle?: SevenShiftsEvidenceBundle;
  /** D-172 permanent, member-reviewed Tip Science record for this posted shift. */
  shiftBible?: import("./shiftEnvelope.ts").ShiftBible;
};

export type RecurrenceCadence = "daily" | "weekly" | "biweekly" | "monthly";
export type RecurrenceKind = "bill" | "subscription" | "paycheck" | "other";
export type RecurrenceOrigin = "manual" | "detected";
export type RecurrenceGoogleSync = Record<string, { calendarId: string; eventId: string }>;

export type Recurrence = {
  id: string;
  cadence: RecurrenceCadence;
  nextDate: DateKey;
  type: "expense" | "income" | "transfer";
  amountCents: number;
  accountId: string;
  /** Destination for transfer standing orders (chequing → savings / Goals vault). */
  transferToAccountId: string | null;
  /** When set, posting the transfer also funds this jar envelope. */
  goalId: string | null;
  subcategoryId: string;
  note: string;
  splits: Split[];
  active: boolean;
  autoPost: boolean;
  kind: RecurrenceKind;
  origin: RecurrenceOrigin;
  reminderHoursBefore: number;
  googleSync: RecurrenceGoogleSync;
  /** A planning default only. Posting still requires the ordinary transaction Confirm boundary. */
  fundingDefault?: HouseholdFundFundingDefault | null;
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

export type OpenShiftStatus = "open" | "confirming" | "cleared";

export type ShiftBreak = {
  id: string;
  kind: "paid" | "unpaid" | "custom";
  label: string;
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
};

export type OpenShift = {
  id: string;
  memberId: string;
  startedAt: string;
  endedAt: string | null;
  breaks: ShiftBreak[];
  scheduledItemId: string | null;
  sourceDeviceId: string | null;
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

export type SitDownSessionStatus = "open" | "moved" | "closed";

export type SitDownAllocationSlice = {
  id: string;
  label: string;
  kind: "account" | "goal";
  targetId: string;
  mode: "weight" | "percent" | "fixed";
  value: number;
};

export type SitDownSession = {
  id: string;
  monthKey: MonthKey;
  targetMonth: MonthKey;
  act: 1 | 2 | 3;
  leftoverCents: number;
  cashLikeCents: number;
  billsNext30Cents: number;
  minPaymentsCents: number;
  slices: SitDownAllocationSlice[];
  transferIds: string[];
  contributionIds: string[];
  budgetPosted: boolean;
  closedMonth: boolean;
  driveFileId: string | null;
  status: SitDownSessionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export type TicTacToeMark = "x" | "o" | "";
export type TicTacToeWinner = "x" | "o" | "draw" | null;

export type TicTacToeGame = {
  cells: TicTacToeMark[];
  turn: "x" | "o";
  winner: TicTacToeWinner;
  lastMemberId: string;
  updatedAt: string;
  updatedBy: string;
};

export type HangmanGame = {
  word: string;
  guessed: string[];
  turnMemberId: string;
  winnerMemberId: string | null;
  lost: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type HouseholdGames = {
  tictactoe: TicTacToeGame;
  hangman: HangmanGame;
};

export type HouseholdKitchen = {
  chalkboard: ChalkNote[];
  companion: HouseholdCompanion;
  books: HouseholdBooksDesk;
  hercules: HerculesDesk;
  /** Legacy single punch is read during migration; new writes use member-keyed openShifts. */
  openShift: OpenShift | null;
  openShifts: OpenShift[];
  games: HouseholdGames;
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

export type HouseholdLedgerNames = {
  shared: string;
  personal: Record<string, string>;
};

export type GoalStatus = "open" | "retired" | "unfunded";

export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: DateKey | null;
  /** When the household hopes to arrive at the target. Percentage says where you are; the date says whether you'll make it. */
  arrivalDate: DateKey | null;
  shared: boolean;
  ownerMemberId: string | null;
  subcategoryId: string | null;
  status: GoalStatus;
  /** True once a real vault transfer backed the envelope (D-096). Legacy envelope-only jars stay unfunded. */
  funded: boolean;
  retiredAt: string | null;
  purchaseId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoalContribution = {
  id: string;
  goalId: string;
  memberId: string;
  amountCents: number;
  date: DateKey;
  /** Transfer id that moved cash into the Goals vault for this contribution, when present. */
  transferId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdFundMode = "practice" | "connected";

export type HouseholdFundConfig = {
  id: string;
  name: string;
  custodianMemberId: string;
  mode: HouseholdFundMode;
  openedOn: DateKey;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdFundFundingDefault = {
  fundId: string;
  fundedCents: number | "full";
  destinationAccountId: string;
};

export type HouseholdFundTransactionFunding = {
  fundId: string;
  fundedCents: number;
  destinationAccountId: string;
  /** Public clearing-position id; Personal transaction ids never enter Shared. */
  positionId?: string;
  /** The backing savings account paid directly; the same Confirm must also record a settlement. */
  directDebit?: boolean;
};

export type HouseholdFundMonthPlan = {
  id: string;
  fundId: string;
  monthKey: MonthKey;
  targetCents: number;
  bufferCents: number;
  agreedByMemberIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type HouseholdFundEventKind =
  | "contribution-proposed"
  | "contribution-confirmed"
  | "purchase-funded"
  | "refund-funded"
  | "settlement-confirmed"
  | "kitty-allocated"
  | "kitty-released"
  | "reconciliation-recorded"
  | "bank-verified"
  | "reversal";

/** Immutable operational fact. Corrections append a reversal and replacement; old rows are never edited. */
export type HouseholdFundEvent = {
  id: string;
  fundId: string;
  kind: HouseholdFundEventKind;
  amountCents: number;
  date: DateKey;
  createdBy: string;
  confirmedByMemberId: string | null;
  contributorMemberId: string | null;
  destinationAccountId: string | null;
  relatedEventId: string | null;
  relatedTransactionIds: string[];
  evidenceDigests: string[];
  reconciliationTied: boolean | null;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdFundSettlementAllocation = {
  id: string;
  fundId: string;
  eventId: string;
  transactionId: string;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdFundKittyAllocation = {
  id: string;
  fundId: string;
  eventId: string;
  goalId: string;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdFundBankBinding = {
  id: string;
  fundId: string;
  memberId: string;
  provider: "manual" | "flinks";
  accountId: string;
  /** HMAC/provider-safe digest only; raw provider ids and credentials never enter the snapshot. */
  accountDigest: string | null;
  status: "manual" | "connected" | "revoked";
  createdAt: string;
  updatedAt: string;
};

export type HouseholdFundPrivateReconciliation = {
  id: string;
  fundId: string;
  memberId: string;
  date: DateKey;
  bankTotalCents: number;
  operatingFundCents: number;
  kittyCents: number;
  personalRemainderCents: number;
  differenceCents: number;
  sharedEventId: string;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdFundPrivateState = {
  bankBindings: HouseholdFundBankBinding[];
  reconciliations: HouseholdFundPrivateReconciliation[];
};

/** Soft presence of a kitchen phone that has touched the shared snapshot. Not Auth. */
export type HouseholdDevice = {
  id: string;
  label: string;
  memberId: string | null;
  environment: Environment;
  seenAt: string;
  updatedAt: string;
  active: boolean;
};

export type GoalPurchaseLine = {
  note: string;
  amountCents: number;
};

/** Itemized receipt when a full jar is actually bought. Rows stay forever (D-085). */
export type GoalPurchase = {
  id: string;
  goalId: string;
  spentCents: number;
  vaultAccountId: string;
  transactionIds: string[];
  lines: GoalPurchaseLine[];
  memberId: string;
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

export type SharingMode =
  | "local"
  | "invite-draft"
  | "publish-confirming"
  | "linked"
  | "pending-transport"
  | "synchronized"
  | "conflicted"
  | "disconnected"
  | "transport-error";

export type SharingRecord = {
  mode: SharingMode;
  linked: boolean;
  lastTransportAt: string | null;
  lastError: string | null;
  pending: boolean;
};

export type CommandReceipt = {
  confirmationId: string;
  identityHash: string;
  auditHash: string;
  /** Projection-specific hashes keep shared replay independent from member-private books. */
  scopedAuditHashes?: {
    shared: string;
    personal: string;
  };
  commandKind: string;
  postedIds: string[];
  revision: number;
  acceptedAt: string;
};

/**
 * Member-owned consent for consequential Hercules Pro tools. This travels only
 * in the member's Personal envelope; it is deliberately absent from the shared
 * household projection. Missing/legacy values mean fully disabled.
 */
export type HerculesProPermissions = {
  personalWrite: boolean;
  householdWrite: boolean;
  updatedAt: string | null;
};

export type ConflictRecord = {
  id: string;
  detectedAt: string;
  environment: Environment;
  localRevision: number;
  remoteRevision: number;
  localHash: string;
  remoteHash: string;
  localSnapshot: Household;
  remoteSnapshot: Household;
  autoMerged: boolean;
  resolved: boolean;
};

/** Durable disclosure for a generated Development-only showcase. */
export type SyntheticFixtureProvenance = {
  kind: "hearth-demo-suite";
  version: string;
  seed: number;
  generatedForDate: string;
  generatedAt: string;
  buildSha: string;
  profile: "investor" | "edge" | "scale";
  numberStyle: "realistic" | "pretty";
  coverageDigest: string;
  /** SHA-256 of generator-owned facts after continuity-only fields are removed. */
  fixtureHashSha256: string;
};

export type Household = {
  version: 1;
  householdId: string;
  inviteCode: string;
  linked: boolean;
  revision: number;
  baseRevision: number;
  booksAcceptedHash: string | null;
  tombstones: Tombstone[];
  name: string;
  ledgerNames: HouseholdLedgerNames;
  timezone: string;
  currency: Currency;
  environment: Environment;
  members: Member[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  shifts: Shift[];
  /** Sanitized member-personal published schedule projections; never worked time or money. */
  sevenShiftsSchedules?: import("./sevenShiftsCalendar.ts").SevenShiftsScheduledShift[];
  /** Active member's private workplace directory; entries are never household members. */
  coworkers?: import("./coworkers.ts").Coworker[];
  /** Private, non-financial attendance context for confirmed shifts. */
  coworkerAttendance?: import("./coworkers.ts").CoworkerAttendance[];
  /** Private published coworker schedule observations; outlook only. */
  coworkerSchedules?: import("./coworkers.ts").CoworkerSchedule[];
  /** Temporary member-personal schedule/work proposals. Never money authority. */
  shiftEnvelopes?: import("./shiftEnvelope.ts").ShiftEnvelope[];
  /** Non-work outcomes. Worked Bibles are embedded in their financial Shift. */
  shiftBibles?: import("./shiftEnvelope.ts").ShiftBible[];
  recurrences: Recurrence[];
  appointments: Appointment[];
  claims: Claim[];
  presets: Preset[];
  calendar: HouseholdCalendar;
  kitchen: HouseholdKitchen;
  google: HouseholdGoogle;
  goals: Goal[];
  goalContributions: GoalContribution[];
  goalPurchases: GoalPurchase[];
  householdFund?: HouseholdFundConfig | null;
  fundMonthPlans?: HouseholdFundMonthPlan[];
  fundEvents?: HouseholdFundEvent[];
  fundSettlementAllocations?: HouseholdFundSettlementAllocation[];
  fundKittyAllocations?: HouseholdFundKittyAllocation[];
  /** Active member overlay only. `splitForSync` removes it from Shared. */
  fundPrivate?: HouseholdFundPrivateState;
  budgetPlans: BudgetPlan[];
  sitDownSessions: SitDownSession[];
  activity: Activity[];
  devices: HouseholdDevice[];
  workJobs: WorkJob[];
  shiftSettings: ShiftSettings;
  lastCommittedAt: string | null;
  commandReceipts: CommandReceipt[];
  sharing: SharingRecord;
  conflicts: ConflictRecord[];
  /** Present only on an explicitly synthetic Development showcase. */
  syntheticFixture?: SyntheticFixtureProvenance | null;
  /** Dated shared sync tips for owner Restore (D-124). Hosted inside the household payload. */
  restorePoints?: RestorePoint[];
  /** Local/member overlay only. `splitForSync` removes it from Shared. */
  herculesProPermissions?: HerculesProPermissions;
};

export type RestorePoint = {
  id: string;
  createdAt: string;
  sourceRevision: number;
  createdByMemberId: string;
  label: string;
  sharedMoneyHash: string;
  shared: SharedEnvelope;
};

export type SharedEnvelope = {
  kind: "shared";
  revision: number;
  householdId: string;
  inviteCode: string;
  name: string;
  ledgerNames: HouseholdLedgerNames;
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
  goalPurchases: GoalPurchase[];
  householdFund?: HouseholdFundConfig | null;
  fundMonthPlans?: HouseholdFundMonthPlan[];
  fundEvents?: HouseholdFundEvent[];
  fundSettlementAllocations?: HouseholdFundSettlementAllocation[];
  fundKittyAllocations?: HouseholdFundKittyAllocation[];
  budgetPlans: BudgetPlan[];
  sitDownSessions: SitDownSession[];
  activity: Activity[];
  devices: HouseholdDevice[];
  /** Optional only for envelopes written before job-based shifts shipped. */
  workJobs?: WorkJob[];
  shiftSettings: ShiftSettings;
  lastCommittedAt: string | null;
  transactions: Transaction[];
  shifts: Shift[];
  tombstones: Tombstone[];
  /** Exactly-once receipts are shared financial facts; old envelopes may omit them. */
  commandReceipts?: CommandReceipt[];
  conflicts?: ConflictRecord[];
  /** Nested points are stripped when recording a new tip. */
  restorePoints?: RestorePoint[];
  /** Shared synthetic disclosure; contains no household facts or secrets. */
  syntheticFixture?: SyntheticFixtureProvenance | null;
};

export type PersonalEnvelope = {
  kind: "personal";
  memberId: string;
  /** Member-owned account metadata. Legacy envelopes omit this collection. */
  accounts?: Account[];
  lastCommittedAt: string | null;
  transactions: Transaction[];
  shifts: Shift[];
  sevenShiftsSchedules?: import("./sevenShiftsCalendar.ts").SevenShiftsScheduledShift[];
  coworkers?: import("./coworkers.ts").Coworker[];
  coworkerAttendance?: import("./coworkers.ts").CoworkerAttendance[];
  coworkerSchedules?: import("./coworkers.ts").CoworkerSchedule[];
  shiftEnvelopes?: import("./shiftEnvelope.ts").ShiftEnvelope[];
  shiftBibles?: import("./shiftEnvelope.ts").ShiftBible[];
  /** Member-owned non-shared goals and their money facts. Optional for old replicas. */
  goals?: Goal[];
  goalContributions?: GoalContribution[];
  goalPurchases?: GoalPurchase[];
  fundPrivate?: HouseholdFundPrivateState;
  tombstones: Tombstone[];
  herculesProPermissions?: HerculesProPermissions;
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
  /** Member who posted the Confirm — LIFO Undo is per member. */
  actorMemberId?: string;
};

export type CommitResult = {
  household: Household;
  warnings: string[];
  undo: UndoToken;
  postedIds: string[];
};
