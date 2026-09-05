import { addDays, monthKeyFromDateKey, shiftMonthKey, type DateKey } from "./calendar.ts";
import {
  addAccount,
  addGoal,
  bindHouseholdFundBackingAccount,
  closeBooksMonth,
  configureHouseholdFund,
  postEntry,
  recordReconciliation,
  recordHouseholdFundReconciliation,
  refreshShiftEnvelopesFromEvidence,
  refreshSevenShiftsSchedule,
  setHouseholdFundMonthPlan,
} from "./commands.ts";
import { sha256Hex } from "./commandIdentity.ts";
import { deriveDemoSeed, freshDemoSeed } from "./demoRandom.ts";
import { runHealthCheck } from "./health.ts";
import {
  executeHerculesReadToolPlan,
  HERCULES_READ_TOOL_NAMES,
  type HerculesReadToolResult,
  type HerculesReadToolName,
} from "./herculesTools.ts";
import { booksEquation, compileHousehold, trialBalance } from "./journal.ts";
import { auditOpinion, balanceSheet, bookBalanceAsOf, cashFlowStatement, closePackageText, incomeStatement } from "./statements.ts";
import { seedStressHousehold, torontoOffsetForDate, type StressNumberStyle } from "./stressSeed.ts";
import { ensureHouseholdShape, personalReplicaForMember, splitForSync } from "./sync.ts";
import type { SevenShiftsScheduledShift } from "./sevenShiftsCalendar.ts";
import type { Household, SyntheticFixtureProvenance } from "./types.ts";
import { bibleFromConfirmedShift, envelopeFromSchedule, type ShiftFieldAuthority } from "./shiftEnvelope.ts";
import { householdForHerculesContext } from "./visibility.ts";
import { withSyntheticRuntime } from "./syntheticRuntime.ts";
import { booksPresentationFloor, projectLedgerExperience } from "./ledgerExperience.ts";
import { askBooks } from "./askBooks.ts";
import { sitDownExportText, sitDownWorkbookCsv } from "./sitDown.ts";
import { booksJournalCsv, booksSqlDump } from "../ledger/export.ts";
import { formatCad } from "./money.ts";
import { completeSyntheticDemoOnboarding } from "./onboarding/lifecycle.ts";

export const DEMO_SUITE_VERSION = "2.0.0";

export const DEMO_ENGINE_NAMES = [
  "accounts-opening-cards-investments",
  "income",
  "expenses-refunds-imports-duplicates-transfers",
  "bills-recurrences-budgets",
  "shifts-schedules-settlements-evidence",
  "appointments-visits-claims",
  "goals-household-fund",
  "reconciliation-close-audit",
  "privacy-canaries-scale",
] as const;
export type DemoEngineName = (typeof DEMO_ENGINE_NAMES)[number];

export type DemoSuiteOptions = {
  today: DateKey;
  seed?: number;
  profile?: SyntheticFixtureProvenance["profile"];
  numberStyle?: StressNumberStyle;
  buildSha?: string;
};

export type DemoEngineResult = {
  name: DemoEngineName;
  achieved: boolean;
  facts: number;
  note: string;
};

export type DemoSuiteManifest = {
  kind: "hearth-demo-suite-manifest";
  version: string;
  seed: number;
  today: DateKey;
  profile: SyntheticFixtureProvenance["profile"];
  numberStyle: StressNumberStyle;
  buildSha: string;
  coverageDigest: string;
  fixtureHashSha256: string;
  engines: DemoEngineResult[];
  readToolCoverage: Record<HerculesReadToolName, DemoEngineName>;
  writeToolCoverage: Record<"transaction_write_options" | "prepare_transaction" | "confirm_transaction", string>;
  prompts: readonly string[];
  transactionCountBeforeEvidence: number;
  transactionCountAfterEvidence: number;
};

export type DemoCheck = {
  id: string;
  label: string;
  status: "pass" | "fail";
  detail: string;
};

export type DemoRunReport = {
  kind: "hearth-demo-suite-report";
  version: string;
  seed: number;
  generatedForDate: string;
  buildSha: string;
  status: "ready" | "not-ready";
  checks: DemoCheck[];
  engines: DemoEngineResult[];
  tools: Array<{ name: HerculesReadToolName; status: "ok" | "empty" | "unavailable" }>;
  counts: { transactions: number; shifts: number; schedules: number; appointments: number; claims: number; goals: number };
  fixtureHashSha256: string;
  observedFixtureHashSha256: string;
  verifiedRevision: number;
  attestationSha256: string;
};

export const HERCULES_PRO_INVESTOR_PROMPTS = [
  "Hercules, disclose whether this is synthetic, then tell our twelve-month money story using posted facts. Separate household facts from personal facts and projections.",
  "Trace last month's leftover-spend number to the statement, journal entries, and source rows. Tell me what would make you distrust it.",
  "Using only Jonathan's confirmed shifts, show the protected tip floor and a 13-week cash scenario. Explain the weighing, uncertainty, and the choice it supports.",
  "Show the next synthetic 7shifts envelope and explain why schedule and Evidence can prepare a shift but cannot post wages, tips, or money.",
  "Prepare one synthetic $42.65 grocery expense from Shared chequing for today. Show the exact ledger effect, duplicate warning, and approval boundary. Do not post it.",
  "Confirm that prepared synthetic grocery expense once. Then trace the resulting transaction and prove a second confirmation cannot silently post it again.",
] as const;

/** Explicit on purpose: adding a Hercules read without a generator is a TypeScript error. */
export const DEMO_TOOL_COVERAGE = {
  ledger_context: "accounts-opening-cards-investments",
  account_balance: "accounts-opening-cards-investments",
  find_transactions: "expenses-refunds-imports-duplicates-transfers",
  spending_summary: "expenses-refunds-imports-duplicates-transfers",
  income_summary: "income",
  compare_spending: "expenses-refunds-imports-duplicates-transfers",
  bills_due: "bills-recurrences-budgets",
  shift_summary: "shifts-schedules-settlements-evidence",
  goal_progress: "goals-household-fund",
  money_owed: "appointments-visits-claims",
  cash_position: "accounts-opening-cards-investments",
  budget_status: "bills-recurrences-budgets",
  category_breakdown: "expenses-refunds-imports-duplicates-transfers",
  credit_card_status: "accounts-opening-cards-investments",
  net_worth: "accounts-opening-cards-investments",
  audit_health: "reconciliation-close-audit",
  duplicate_review: "expenses-refunds-imports-duplicates-transfers",
  balance_sheet: "accounts-opening-cards-investments",
  income_statement: "reconciliation-close-audit",
  cash_flow_statement: "reconciliation-close-audit",
  trial_balance: "reconciliation-close-audit",
  general_ledger: "reconciliation-close-audit",
  account_activity: "accounts-opening-cards-investments",
  journal_entry_detail: "reconciliation-close-audit",
  changes_in_net_worth: "reconciliation-close-audit",
  period_comparison: "reconciliation-close-audit",
  explain_balance: "accounts-opening-cards-investments",
  reconciliation_status: "reconciliation-close-audit",
  activity_since_reconciliation: "reconciliation-close-audit",
  uncategorized_activity: "reconciliation-close-audit",
  duplicate_exposure: "expenses-refunds-imports-duplicates-transfers",
  missing_periods: "reconciliation-close-audit",
  opening_balance_review: "accounts-opening-cards-investments",
  period_close_readiness: "reconciliation-close-audit",
  source_document_coverage: "expenses-refunds-imports-duplicates-transfers",
  integrity_findings: "reconciliation-close-audit",
  audit_trail: "reconciliation-close-audit",
  budget_variance: "bills-recurrences-budgets",
  cash_runway: "bills-recurrences-budgets",
  bill_coverage: "bills-recurrences-budgets",
  debt_projection: "accounts-opening-cards-investments",
  credit_utilization: "accounts-opening-cards-investments",
  savings_rate: "income",
  income_stability: "income",
  spending_trend: "expenses-refunds-imports-duplicates-transfers",
  scenario_analysis: "bills-recurrences-budgets",
  forecast_accuracy: "bills-recurrences-budgets",
  explain_transaction: "expenses-refunds-imports-duplicates-transfers",
  explain_accounting_equation: "reconciliation-close-audit",
  explain_debit_credit: "reconciliation-close-audit",
  explain_financial_statement: "reconciliation-close-audit",
  trace_number: "reconciliation-close-audit",
  compare_accounting_treatments: "reconciliation-close-audit",
  explain_variance: "bills-recurrences-budgets",
  explain_transfer: "expenses-refunds-imports-duplicates-transfers",
  tip_oracle: "shifts-schedules-settlements-evidence",
  shift_outlook: "shifts-schedules-settlements-evidence",
  tip_schedule_sim: "shifts-schedules-settlements-evidence",
  tax_milk_plan: "shifts-schedules-settlements-evidence",
  shift_year_simulation: "shifts-schedules-settlements-evidence",
  explain_shift_simulation: "shifts-schedules-settlements-evidence",
  list_shifts: "shifts-schedules-settlements-evidence",
  cash_cinema: "bills-recurrences-budgets",
  what_if_desk: "bills-recurrences-budgets",
  year_review: "bills-recurrences-budgets",
} satisfies Record<HerculesReadToolName, DemoEngineName>;

function tinyDigest(value: number): string {
  return value.toString(16).padStart(8, "0");
}

/**
 * Remove identity/transport state that legitimately changes when a generated
 * showcase is linked or synchronized. Every generated financial, work,
 * Evidence, privacy, and kitchen fact remains in this payload.
 */
export function canonicalDemoFixturePayload(household: Household): unknown {
  const {
    householdId: _householdId,
    inviteCode: _inviteCode,
    linked: _linked,
    revision: _revision,
    baseRevision: _baseRevision,
    booksAcceptedHash: _booksAcceptedHash,
    google: _google,
    devices: _devices,
    sharing: _sharing,
    conflicts: _conflicts,
    commandReceipts: _commandReceipts,
    restorePoints: _restorePoints,
    householdOnboarding: _householdOnboarding,
    onboardingApprovals: _onboardingApprovals,
    herculesProPermissions: _herculesProPermissions,
    lastCommittedAt: _lastCommittedAt,
    members: rawMembers,
    ...generatorFacts
  } = household;
  return {
    ...generatorFacts,
    members: rawMembers.map((member) => {
      const { onboardingProgress: _onboardingProgress, ...memberFacts } = member;
      return memberFacts;
    }),
    syntheticFixture: household.syntheticFixture
      ? { ...household.syntheticFixture, fixtureHashSha256: "" }
      : null,
  };
}

export async function canonicalDemoFixtureHash(household: Household): Promise<string> {
  return sha256Hex(canonicalDemoFixturePayload(household));
}

function nextScheduleRows(household: Household, today: DateKey): SevenShiftsScheduledShift[] {
  const memberId = "MEM-002";
  const job = household.workJobs.find((row) => row.memberId === memberId && row.active);
  const role = job?.roles.find((row) => row.active);
  if (!job || !role) return [];
  return [2, 5, 8].map((offset, sequence) => {
    const date = addDays(today, offset);
    const startLocal = `${date}T17:00:00${torontoOffsetForDate(date)}`;
    const endLocal = `${date}T23:30:00${torontoOffsetForDate(date)}`;
    const suffix = tinyDigest(((household.syntheticFixture?.seed ?? 1) + sequence * 2654435761) >>> 0).repeat(2);
    return {
      id: `7SC-${suffix}`,
      memberId,
      source: "7shifts-calendar",
      provenanceId: `7shifts-calendar:${suffix}`,
      startedAt: new Date(startLocal).toISOString(),
      endedAt: new Date(endLocal).toISOString(),
      date,
      scheduledMinutes: 390,
      jobId: job.id,
      roleId: role.id,
      eventTag: sequence === 1 ? "sports" : "regular",
      staffingCount: 6 + sequence,
      staffingSource: "calendar-overlap",
      delivery: "selected-file",
      selfMatch: "personal-feed-assertion",
      notesPresent: false,
      sequence,
      sourceUpdatedAt: null,
      createdAt: `${today}T12:00:00.000Z`,
      updatedAt: `${today}T12:00:00.000Z`,
    };
  });
}

function privateScheduleCanary(today: DateKey, seed: number): SevenShiftsScheduledShift {
  const date = addDays(today, 3);
  const suffix = tinyDigest(deriveDemoSeed(seed, "bianca-private-schedule")).repeat(2);
  const startedAt = new Date(`${date}T09:30:00${torontoOffsetForDate(date)}`).toISOString();
  const endedAt = new Date(`${date}T14:00:00${torontoOffsetForDate(date)}`).toISOString();
  return {
    id: `7SC-${suffix}`,
    memberId: "MEM-001",
    source: "7shifts-calendar",
    provenanceId: `7shifts-calendar:${suffix}`,
    startedAt,
    endedAt,
    date,
    scheduledMinutes: 270,
    jobId: null,
    roleId: null,
    eventTag: "regular",
    staffingCount: null,
    staffingSource: "unavailable",
    delivery: "selected-file",
    selfMatch: "personal-feed-assertion",
    notesPresent: false,
    sequence: 0,
    sourceUpdatedAt: null,
    createdAt: `${today}T12:00:00.000Z`,
    updatedAt: `${today}T12:00:00.000Z`,
  };
}

function sealSyntheticShiftBibles(household: Household, seed: number): Household {
  const confirmedEnvelopes: NonNullable<Household["shiftEnvelopes"]> = [];
  const shifts = household.shifts.map((shift, index) => {
    if (!shift.jobId || !shift.roleId || !shift.startedAt || !shift.endedAt) return shift;
    const suffix = tinyDigest(deriveDemoSeed(seed, `shift-bible:${index}`)).repeat(2);
    const schedule: SevenShiftsScheduledShift = {
      id: `7SC-${suffix}`,
      memberId: shift.memberId,
      source: "7shifts-calendar",
      provenanceId: `7shifts-calendar:${suffix}`,
      startedAt: new Date(shift.startedAt).toISOString(),
      endedAt: new Date(shift.endedAt).toISOString(),
      date: shift.date,
      scheduledMinutes: Math.round((Date.parse(shift.endedAt) - Date.parse(shift.startedAt)) / 60_000),
      jobId: shift.jobId,
      roleId: shift.roleId,
      eventTag: shift.eventTag ?? "regular",
      staffingCount: shift.staffingCount ?? null,
      staffingSource: shift.staffingCount == null ? "unavailable" : "calendar-overlap",
      delivery: "selected-file",
      selfMatch: "personal-feed-assertion",
      notesPresent: false,
      sequence: index,
      sourceUpdatedAt: null,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
    };
    const envelope = {
      ...envelopeFromSchedule({
        householdId: household.householdId,
        environment: household.environment,
        schedule,
        locationName: household.workJobs.find((row) => row.id === shift.jobId)?.locationName ?? "",
        timezone: household.timezone,
        observedAt: shift.updatedAt,
      }),
      actualStart: shift.startedAt,
      actualEnd: shift.endedAt,
      workedMinutes: Math.round(shift.hours * 60),
      paidBreakMinutes: Math.round((shift.paidBreakHours ?? 0) * 60),
      unpaidBreakMinutes: schedule.scheduledMinutes - Math.round(shift.hours * 60),
      approvalState: "final" as const,
      status: "worked_ready" as const,
      sourceFinality: "final" as const,
    };
    const authority: ShiftFieldAuthority[] = ["salesCents", "cashTipsCents", "cardTipsCents", "customersServed", "staffingCount"].map((field) => ({
      field,
      source: "manual",
      observedAt: shift.updatedAt,
      finality: "user_confirmed",
      presence: "present",
    }));
    const shiftBible = bibleFromConfirmedShift({
      householdId: household.householdId,
      environment: household.environment,
      shift: {
        ...shift,
        startedAt: new Date(shift.startedAt).toISOString(),
        endedAt: new Date(shift.endedAt).toISOString(),
      },
      envelope,
      draft: {
        envelopeId: envelope.id,
        scheduledStart: schedule.startedAt,
        scheduledEnd: schedule.endedAt,
        unpaidBreakMinutes: Math.max(0, envelope.unpaidBreakMinutes ?? 0),
        approvalState: "user_confirmed",
        authority,
      },
      attendance: [],
      confirmationId: `synthetic-shift-${suffix}`,
      createdAt: shift.updatedAt,
    });
    confirmedEnvelopes.push({
      ...envelope,
      status: "confirmed",
      confirmedBibleId: shiftBible.id,
      updatedAt: shiftBible.updatedAt,
    });
    return {
      ...shift,
      shiftBible,
    };
  });
  return { ...household, shifts, shiftEnvelopes: [...(household.shiftEnvelopes ?? []), ...confirmedEnvelopes] };
}

function engineResults(household: Household): DemoEngineResult[] {
  const imported = household.transactions.filter((row) => row.source === "import").length;
  const personal = household.transactions.filter((row) => row.visibility === "personal").length;
  const refunds = household.transactions.filter((row) => row.type === "refund").length;
  const duplicateCandidates = household.transactions.filter((row) => row.potentialDuplicate || row.isDuplicate).length;
  const results: Record<DemoEngineName, DemoEngineResult> = {
    "accounts-opening-cards-investments": { name: "accounts-opening-cards-investments", achieved: household.accounts.length >= 7, facts: household.accounts.length, note: "Cash, cards, savings, and investment marks" },
    income: { name: "income", achieved: household.transactions.some((row) => row.type === "income"), facts: household.transactions.filter((row) => row.type === "income").length, note: "Salary, wages, cash tips, and card tips" },
    "expenses-refunds-imports-duplicates-transfers": { name: "expenses-refunds-imports-duplicates-transfers", achieved: imported > 0 && refunds > 0 && duplicateCandidates > 1 && household.transactions.some((row) => row.type === "transfer"), facts: household.transactions.length, note: `${imported} imports, ${refunds} refund(s), ${duplicateCandidates} duplicate candidates, plus transfers` },
    "bills-recurrences-budgets": { name: "bills-recurrences-budgets", achieved: household.recurrences.length > 0 && household.budgetPlans.length >= 12, facts: household.recurrences.length + household.budgetPlans.length, note: "Bills, payroll, savings recurrence, and monthly plans" },
    "shifts-schedules-settlements-evidence": { name: "shifts-schedules-settlements-evidence", achieved: household.shifts.length >= 90 && (household.shiftEnvelopes?.length ?? 0) > 0, facts: household.shifts.length + (household.shiftEnvelopes?.length ?? 0), note: "Confirmed shifts plus proposal-only synthetic schedule mail" },
    "appointments-visits-claims": { name: "appointments-visits-claims", achieved: household.appointments.length >= 4 && household.claims.length > 0, facts: household.appointments.length + household.claims.length, note: "Joint, quiet, companion, and member care" },
    "goals-household-fund": { name: "goals-household-fund", achieved: household.goals.length >= 3 && Boolean(household.householdFund), facts: household.goals.length + (household.fundMonthPlans?.length ?? 0), note: "Shared and personal Kitty Banks plus practice Fund plan" },
    "reconciliation-close-audit": { name: "reconciliation-close-audit", achieved: household.kitchen.books.reconciliations.length > 0 && household.kitchen.books.closedMonths.length > 0, facts: household.kitchen.books.reconciliations.length + household.kitchen.books.closedMonths.length, note: "Tied statements and a closed prior month" },
    "privacy-canaries-scale": { name: "privacy-canaries-scale", achieved: personal > 0 && household.transactions.length >= 500, facts: personal, note: "Partner-personal canaries inside a full-scale fixture" },
  };
  return DEMO_ENGINE_NAMES.map((name) => results[name]);
}

export async function generateDemoSuite(options: DemoSuiteOptions): Promise<{ household: Household; manifest: DemoSuiteManifest }> {
  const seed = options.seed ?? freshDemoSeed();
  const profile = options.profile ?? "investor";
  const numberStyle = options.numberStyle ?? "realistic";
  const generatedAt = `${options.today}T12:00:00.000Z`;
  const coverageDigest = (await sha256Hex({ version: DEMO_SUITE_VERSION, tools: DEMO_TOOL_COVERAGE })).slice(0, 16);
  const generated = withSyntheticRuntime(seed, generatedAt, () => {
  let household = seedStressHousehold({
    today: options.today,
    environment: "development",
    seed: deriveDemoSeed(seed, `profile:${profile}`),
    numberStyle,
  });
  const provenance: SyntheticFixtureProvenance = {
    kind: "hearth-demo-suite",
    version: DEMO_SUITE_VERSION,
    seed,
    generatedForDate: options.today,
    generatedAt,
    buildSha: options.buildSha ?? "local-development",
    profile,
    numberStyle,
    coverageDigest,
    fixtureHashSha256: "",
  };
  household = { ...household, syntheticFixture: provenance, name: "Jonathan & Bianca · Synthetic Demo" };

  // Named cross-domain privacy canaries make partner-personal leakage measurable.
  household = addAccount(household, {
    name: "Bianca Private Canary Vault",
    kind: "savings",
    ownerMemberId: "MEM-001",
    scope: "personal",
    institution: "Synthetic Canary Credit Union",
    last4: "9174",
    apyPercent: 2.35,
  }).household;
  const privateAccount = household.accounts.find((row) => row.name === "Bianca Private Canary Vault")!;
  household = postEntry(household, {
    date: addDays(options.today, -13),
    type: "income",
    amount: 731.29,
    accountId: privateAccount.id,
    subcategoryId: "SUB-INCOME-BIANCA",
    note: "BIANCA_PRIVATE_CANARY_TRANSACTION",
    place: "Synthetic Canary Credit Union",
    createdBy: "MEM-001",
    visibility: "personal",
    splits: [{ party: "MEM-001", amountCents: 73_129 }],
    confirmDuplicate: true,
  }).household;
  household = addGoal(household, {
    name: "BIANCA_PRIVATE_CANARY_GOAL",
    target: 2_913.47,
    deadline: `${shiftMonthKey(monthKeyFromDateKey(options.today), 7)}-01`,
    shared: false,
    ownerMemberId: "MEM-001",
  }).household;
  const originalExpense = household.transactions.find((row) => row.type === "expense" && row.visibility !== "personal")!;
  household = postEntry(household, {
    date: addDays(options.today, -9),
    type: "refund",
    amount: Math.min(18.37, originalExpense.amountCents / 100),
    accountId: originalExpense.accountId,
    subcategoryId: originalExpense.subcategoryId!,
    note: "Synthetic partial refund",
    place: originalExpense.place,
    refundOfId: originalExpense.id,
    createdBy: "MEM-002",
    visibility: "household",
    confirmDuplicate: true,
  }).household;
  const duplicateInput = {
    date: addDays(options.today, -6),
    type: "expense" as const,
    amount: 27.43,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "Synthetic duplicate review pair",
    place: "Demo Market",
    createdBy: "MEM-002",
    visibility: "household" as const,
    confirmDuplicate: true,
  };
  household = postEntry(household, duplicateInput).household;
  household = postEntry(household, duplicateInput).household;

  // Schedule and Evidence use their real non-money command paths. Transaction count must not move.
  const transactionCountBeforeEvidence = household.transactions.length;
  const schedules = nextScheduleRows(household, options.today);
  household = refreshSevenShiftsSchedule(household, {
    memberId: "MEM-002",
    schedules,
    confirmedPersonalFeed: true,
    createdBy: "MEM-002",
  }).household;
  household = refreshSevenShiftsSchedule(household, {
    memberId: "MEM-001",
    schedules: [privateScheduleCanary(options.today, seed)],
    confirmedPersonalFeed: true,
    createdBy: "MEM-001",
  }).household;
  const evidenceSchedule = schedules[0];
  if (evidenceSchedule?.jobId && evidenceSchedule.roleId) {
    const digest = tinyDigest(deriveDemoSeed(seed, "worked-evidence")).repeat(8);
    household = refreshShiftEnvelopesFromEvidence(household, {
      memberId: "MEM-002",
      createdBy: "MEM-002",
      proposals: [{
        canonicalShiftKey: `s7shift_${digest}`,
        kind: "worked-shift",
        jobId: evidenceSchedule.jobId,
        roleId: evidenceSchedule.roleId,
        date: evidenceSchedule.date,
        startedAt: evidenceSchedule.startedAt,
        endedAt: evidenceSchedule.endedAt,
        workedMinutes: evidenceSchedule.scheduledMinutes,
        paidBreakMinutes: 0,
        unpaidBreakMinutes: 0,
        observedAt: `${options.today}T12:00:00.000Z`,
        finality: "approved",
        source: "seven_shifts_timesheet",
      }],
    }).household;
  }
  const transactionCountAfterEvidence = household.transactions.length;
  household = sealSyntheticShiftBibles(household, seed);

  household = configureHouseholdFund(household, {
    custodianMemberId: "MEM-001",
    openedOn: `${shiftMonthKey(monthKeyFromDateKey(options.today), -2)}-01`,
    createdBy: "MEM-001",
    name: "Synthetic Household Fund",
  }).household;
  household = setHouseholdFundMonthPlan(household, {
    memberId: "MEM-001",
    monthKey: monthKeyFromDateKey(options.today),
    target: 3200 + (seed % 9) * 50,
    buffer: 400 + (seed % 5) * 25,
    agreedByMemberIds: ["MEM-001", "MEM-002"],
  }).household;
  household = bindHouseholdFundBackingAccount(household, {
    memberId: "MEM-001",
    accountId: privateAccount.id,
    provider: "manual",
  }).household;
  household = recordHouseholdFundReconciliation(household, {
    memberId: "MEM-001",
    date: options.today,
    bankTotal: 731.29,
    note: "Synthetic weekly reconciliation",
  }).household;

  const priorMonth = shiftMonthKey(monthKeyFromDateKey(options.today), -1);
  const statementDate = addDays(`${monthKeyFromDateKey(options.today)}-01` as DateKey, -1);
  for (const account of household.accounts.filter((row) => row.active && row.kind !== "investment" && row.scope !== "personal")) {
    household = recordReconciliation(household, {
      accountId: account.id,
      statementDate,
      statementAmount: bookBalanceAsOf(household, account.id, statementDate) / 100,
      createdBy: "MEM-001",
    }).household;
  }
  household = closeBooksMonth(household, { monthKey: priorMonth, createdBy: "MEM-001" }).household;
  household = ensureHouseholdShape({ ...household, syntheticFixture: provenance });
  household = completeSyntheticDemoOnboarding(household, {
    at: generatedAt,
    sourceKey: `suite:${DEMO_SUITE_VERSION}:${seed}:${options.today}:${profile}:${numberStyle}:${provenance.buildSha}`,
  });

  const manifest: DemoSuiteManifest = {
    kind: "hearth-demo-suite-manifest",
    version: DEMO_SUITE_VERSION,
    seed,
    today: options.today,
    profile,
    numberStyle,
    buildSha: provenance.buildSha,
    coverageDigest,
    fixtureHashSha256: "",
    engines: engineResults(household),
    readToolCoverage: DEMO_TOOL_COVERAGE,
    writeToolCoverage: {
      transaction_write_options: "Shows allowed synthetic transaction fields; never posts.",
      prepare_transaction: "Prepares the finale and displays the exact journal effect; never posts.",
      confirm_transaction: "Requires the ordinary visible Confirm and idempotency boundary.",
    },
    prompts: HERCULES_PRO_INVESTOR_PROMPTS,
    transactionCountBeforeEvidence,
    transactionCountAfterEvidence,
  };
  return { household, manifest };
  });
  const fixtureHashSha256 = await canonicalDemoFixtureHash(generated.household);
  return {
    household: {
      ...generated.household,
      syntheticFixture: generated.household.syntheticFixture
        ? { ...generated.household.syntheticFixture, fixtureHashSha256 }
        : null,
    },
    manifest: { ...generated.manifest, fixtureHashSha256 },
  };
}

function toolArgs(name: HerculesReadToolName, household: Household, today: DateKey): Record<string, unknown> {
  const month = monthKeyFromDateKey(today);
  const tx = household.transactions.find((row) => row.type === "expense" && !row.isDuplicate) ?? household.transactions[0];
  const transfer = household.transactions.find((row) => row.type === "transfer");
  const entryId = compileHousehold(household).entries.find((row) => row.recognized)?.id;
  if (["account_balance", "account_activity", "explain_balance", "reconciliation_status", "activity_since_reconciliation", "credit_card_status", "debt_projection"].includes(name)) return { account: name.includes("credit") || name === "debt_projection" ? "Visa" : "Chequing" };
  if (["spending_summary", "income_summary", "compare_spending", "category_breakdown", "general_ledger", "period_comparison", "spending_trend", "income_stability", "savings_rate", "year_review"].includes(name)) return { period: "last_30_days", months: 12 };
  if (["budget_status", "budget_variance", "forecast_accuracy", "period_close_readiness", "income_statement", "cash_flow_statement", "changes_in_net_worth", "explain_variance"].includes(name)) return { month, category: "Groceries" };
  if (name === "find_transactions" || name === "trace_number") return { merchant: tx?.place, transactionId: tx?.id };
  if (name === "explain_transaction") return { transactionId: tx?.id };
  if (name === "explain_transfer") return { transactionId: transfer?.id };
  if (name === "journal_entry_detail") return { entryId };
  if (name === "explain_debit_credit") return { account: "Chequing" };
  if (name === "explain_financial_statement") return { statement: "income_statement", month };
  if (name === "compare_accounting_treatments") return { topic: "card_purchase_vs_card_payment" };
  if (name === "scenario_analysis") return { amountCents: 425000, name: "Synthetic appliance" };
  if (name === "what_if_desk") return { scenario: "purchase", amountCents: 425000 };
  if (name === "bills_due" || name === "bill_coverage") return { days: 60 };
  if (name === "goal_progress") return { goal: "Emergency buffer" };
  if (name === "list_shifts") return { member: "Jonathan", limit: 20 };
  if (name === "shift_outlook") return { member: "Jonathan", date: addDays(today, 5), meal: "dinner", hours: 7 };
  if (name === "tip_schedule_sim") return { member: "Jonathan", days: 14 };
  if (name === "shift_year_simulation" || name === "explain_shift_simulation") return { member: "Jonathan", months: 12, seed: household.syntheticFixture?.seed };
  return {};
}

export async function verifyDemoSuite(household: Household, manifest?: DemoSuiteManifest): Promise<DemoRunReport> {
  const fixture = household.syntheticFixture?.kind === "hearth-demo-suite" ? household.syntheticFixture : null;
  const replay = fixture
    ? await generateDemoSuite({
        today: fixture.generatedForDate as DateKey,
        seed: fixture.seed,
        profile: fixture.profile,
        numberStyle: fixture.numberStyle,
        buildSha: fixture.buildSha,
      })
    : null;
  manifest ??= replay?.manifest;
  if (!manifest) throw new Error("Demo Suite verification requires synthetic fixture provenance.");
  const observedFixtureHashSha256 = await canonicalDemoFixtureHash(household);
  const checks: DemoCheck[] = [];
  const check = (id: string, label: string, pass: boolean, detail: string) => checks.push({ id, label, status: pass ? "pass" : "fail", detail });
  check("development", "Development-only", household.environment === "development", household.environment);
  check("provenance", "Synthetic disclosure", household.syntheticFixture?.kind === "hearth-demo-suite", household.syntheticFixture ? `seed ${household.syntheticFixture.seed}` : "missing");
  const replayMatches = Boolean(fixture
    && replay
    && fixture.seed === manifest.seed
    && fixture.version === manifest.version
    && fixture.generatedForDate === manifest.today
    && fixture.profile === manifest.profile
    && fixture.numberStyle === manifest.numberStyle
    && fixture.buildSha === manifest.buildSha
    && fixture.coverageDigest === manifest.coverageDigest
    && fixture.fixtureHashSha256 === manifest.fixtureHashSha256
    && replay.manifest.fixtureHashSha256 === manifest.fixtureHashSha256
    && observedFixtureHashSha256 === manifest.fixtureHashSha256);
  check(
    "replay",
    "Exact generated facts replay",
    replayMatches,
    replayMatches
      ? `${manifest.fixtureHashSha256.slice(0, 16)}… matches seed ${manifest.seed}, ${manifest.profile}/${manifest.numberStyle}, and generator ${manifest.version}`
      : `Expected ${manifest.fixtureHashSha256.slice(0, 16)}…; loaded ${observedFixtureHashSha256.slice(0, 16)}…; replayed ${replay?.manifest.fixtureHashSha256.slice(0, 16) ?? "unavailable"}…`,
  );
  check("evidence", "Schedule and Evidence remain non-money", manifest.transactionCountBeforeEvidence === manifest.transactionCountAfterEvidence, `${manifest.transactionCountBeforeEvidence} transactions before and after`);
  const workedBibles = household.shifts.flatMap((shift) => shift.shiftBible?.outcome === "worked" ? [{ shift, bible: shift.shiftBible }] : []);
  const bibleEnvelopeLinks = workedBibles.filter(({ shift, bible }) => {
    const matches = (household.shiftEnvelopes ?? []).filter((row) => row.id === bible.envelopeId && row.memberId === shift.memberId);
    return matches.length === 1 && matches[0]!.status === "confirmed" && matches[0]!.confirmedBibleId === bible.id;
  });
  check("shift-bible-links", "Worked Shift Bibles resolve to confirmed mail", workedBibles.length >= 4 && bibleEnvelopeLinks.length === workedBibles.length, `${bibleEnvelopeLinks.length}/${workedBibles.length} Bibles have exactly one matching confirmed envelope`);
  const books = compileHousehold(household);
  const trial = trialBalance(books, { recognizedOnly: true });
  const equation = booksEquation(books);
  check("trial", "Trial balance", trial.inBalance, `${trial.totalDebitCents} debits / ${trial.totalCreditCents} credits`);
  check("equation", "Accounting equation", equation.holds, `${equation.netWorthCents} net worth / ${equation.netIncomeCents} retained income`);
  const findings = runHealthCheck(household);
  check("health", "Deterministic health", findings.length === 0, findings.length ? `${findings.length} finding(s)` : "clean");
  try {
    const { ingestBooks, openMemoryBooks } = await import("../ledger/engine.ts");
    const db = await openMemoryBooks();
    try {
      const status = await ingestBooks(db, household, books);
      check("pglite", "PGlite projection", status.ok, status.ok ? `${status.entryCount} journal entries ingested` : status.error || "ingest failed");
    } finally {
      await db.close();
    }
  } catch (caught) {
    check("pglite", "PGlite projection", false, caught instanceof Error ? caught.message : String(caught));
  }
  check("engines", "All domain engines achieved", manifest.engines.every((row) => row.achieved), `${manifest.engines.filter((row) => row.achieved).length}/${manifest.engines.length}`);
  check("catalog", "Every Hercules read has a generator", Object.keys(manifest.readToolCoverage).length === HERCULES_READ_TOOL_NAMES.length && HERCULES_READ_TOOL_NAMES.every((name) => Boolean(manifest.readToolCoverage[name])), `${Object.keys(manifest.readToolCoverage).length}/${HERCULES_READ_TOOL_NAMES.length}`);

  const shared = splitForSync(household, "MEM-002").shared;
  const jonathanReplica = personalReplicaForMember(household, "MEM-002");
  const jonathanHousehold = householdForHerculesContext(household, "MEM-002", "household");
  const jonathanPersonal = householdForHerculesContext(household, "MEM-002", "personal");
  const jonathanExport = projectLedgerExperience(household, "MEM-002", "personal", manifest.today);
  const jonathanBooks = booksPresentationFloor(household, "MEM-002", "personal");
  const biancaPrivateTransactions = household.transactions.filter((row) => row.note === "BIANCA_PRIVATE_CANARY_TRANSACTION");
  const biancaPrivateAccounts = household.accounts.filter((row) => row.name === "Bianca Private Canary Vault");
  const biancaPrivateGoals = household.goals.filter((row) => row.name === "BIANCA_PRIVATE_CANARY_GOAL");
  const biancaPrivateSchedules = (household.sevenShiftsSchedules ?? []).filter((row) => row.memberId === "MEM-001");
  const biancaPrivateEnvelopes = (household.shiftEnvelopes ?? []).filter((row) => row.memberId === "MEM-001");
  const biancaPrivateBibles = (household.shiftBibles ?? []).filter((row) => row.memberId === "MEM-001");
  const biancaPrivateFund = [
    ...(household.fundPrivate?.bankBindings ?? []).filter((row) => row.memberId === "MEM-001"),
    ...(household.fundPrivate?.reconciliations ?? []).filter((row) => row.memberId === "MEM-001"),
  ];
  const canaryTokens = [...new Set([
    ...biancaPrivateTransactions.flatMap((row) => [row.id, row.note, row.place]),
    ...biancaPrivateAccounts.flatMap((row) => [row.id, row.name, row.institution, row.last4]),
    ...biancaPrivateGoals.flatMap((row) => [row.id, row.name]),
    ...biancaPrivateSchedules.flatMap((row) => [row.id, row.provenanceId]),
    ...biancaPrivateEnvelopes.flatMap((row) => [row.id, row.canonicalShiftKey]),
    ...biancaPrivateBibles.map((row) => row.id),
    ...biancaPrivateFund.map((row) => row.id),
  ].filter((value) => value.length >= 4))];
  const leakedCanaries = (value: unknown) => {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return canaryTokens.filter((token) => text.includes(token));
  };
  const canaryFamilies = [
    biancaPrivateTransactions,
    biancaPrivateAccounts,
    biancaPrivateGoals,
    biancaPrivateSchedules,
    biancaPrivateEnvelopes,
    biancaPrivateFund,
  ];
  check("privacy-canaries", "Partner-personal canary families", canaryFamilies.every((rows) => rows.length > 0), `${canaryFamilies.filter((rows) => rows.length > 0).length}/${canaryFamilies.length} required private families generated`);
  const syncLeaks = [...leakedCanaries(shared), ...leakedCanaries(jonathanReplica)];
  check("privacy-sync", "Shared and partner sync envelopes", syncLeaks.length === 0, syncLeaks.length ? `Leaked: ${syncLeaks.slice(0, 4).join(", ")}` : `${canaryTokens.length} account, goal, row, schedule, Evidence, and Fund tokens denied`);
  const askAnswer = askBooks(jonathanPersonal, "What needs attention?", manifest.today, { memberId: "MEM-002", view: "personal" });
  const herculesLeaks = [...leakedCanaries(jonathanHousehold), ...leakedCanaries(jonathanPersonal), ...leakedCanaries(askAnswer)];
  check("privacy-hercules", "Hercules and Ask Books scope", herculesLeaks.length === 0, herculesLeaks.length ? `Leaked: ${herculesLeaks.slice(0, 4).join(", ")}` : "No partner-private canary reached either Hercules context or Ask Books answer");
  const booksLeaks = [...leakedCanaries(jonathanBooks), ...leakedCanaries(compileHousehold(jonathanBooks))];
  check("privacy-books", "Personal Books audit floor", booksLeaks.length === 0, booksLeaks.length ? `Leaked: ${booksLeaks.slice(0, 4).join(", ")}` : "Audit, journal, trial, statements, and account rooms use the member-scoped floor");

  const floorBooks = compileHousehold(jonathanBooks);
  const floorTrial = trialBalance(floorBooks, { recognizedOnly: true });
  const month = monthKeyFromDateKey(manifest.today);
  const closeMonth = shiftMonthKey(month, -1);
  const jsonExport = jonathanExport.ok ? JSON.stringify(jonathanExport.exportHousehold) : "export unavailable";
  const csvExport = booksJournalCsv(floorBooks, floorTrial);
  const sqlExport = booksSqlDump(floorBooks);
  const closeExport = closePackageText(jonathanBooks, closeMonth, manifest.today);
  const sitDownCsv = sitDownWorkbookCsv(jonathanBooks, closeMonth);
  const sitDownText = sitDownExportText(jonathanBooks, closeMonth, manifest.today);
  const downloadLeaks = [jsonExport, csvExport, sqlExport, closeExport, sitDownCsv, sitDownText].flatMap(leakedCanaries);
  check("privacy-downloads", "All Personal Books downloads", jonathanExport.ok && downloadLeaks.length === 0, downloadLeaks.length ? `Leaked: ${downloadLeaks.slice(0, 4).join(", ")}` : "JSON, journal CSV, SQL, close package, and sit-down exports exclude partner-private canaries");

  const opinion = auditOpinion(household);
  const sheet = balanceSheet(household);
  const income = incomeStatement(household, month);
  const cash = cashFlowStatement(household, month);
  check("statements", "Statements and Audit office", opinion.kind === "unmodified" && sheet.holds && Number.isInteger(income.netCents) && Number.isInteger(cash.netCashCents), `${opinion.kind} opinion · balance sheet ${sheet.holds ? "holds" : "off"}`);
  check("desk-seals", "Reconciliation and close seals", household.kitchen.books.reconciliations.some((row) => row.status === "tied") && household.kitchen.books.closedMonths.some((row) => row.monthKey === closeMonth), `${household.kitchen.books.reconciliations.filter((row) => row.status === "tied").length} tied statement(s) · ${closeMonth} closed`);
  check("download-contracts", "CSV, SQL, close, and sit-down artifacts", csvExport.includes("TOTAL") && sqlExport.includes("COMMIT;") && closeExport.includes("AUDIT OPINION") && sitDownCsv.includes("leftover_cents") && sitDownText.includes("SIT-DOWN LEFTOVER"), "All six read-only export families rendered from the scoped books");

  const plan = {
    calls: HERCULES_READ_TOOL_NAMES.map((name, index) => ({ id: `demo-${index + 1}`, name, args: toolArgs(name, household, manifest.today) })),
  };
  const tools: DemoRunReport["tools"] = [];
  const rawTools: HerculesReadToolResult[] = [];
  for (const call of plan.calls) {
    const personalTool = DEMO_TOOL_COVERAGE[call.name] === "shifts-schedules-settlements-evidence";
    const run = executeHerculesReadToolPlan(
      household,
      { calls: [call] },
      manifest.today,
      { memberId: "MEM-002", view: personalTool ? "personal" : "household", toolPageMode: "pro" },
    );
    rawTools.push(...run.results);
    tools.push(...run.results.map((row) => ({ name: row.name, status: row.status })));
  }
  const meaningfulEmpty = new Set<HerculesReadToolName>(["uncategorized_activity", "missing_periods", "integrity_findings"]);
  const exercised = rawTools.filter((row) => row.status === "ok" || (row.status === "empty" && meaningfulEmpty.has(row.name) && row.sentence.length > 0));
  const unexercised = rawTools.filter((row) => !exercised.includes(row));
  check("tool-run", "Hercules calculation matrix", tools.length === HERCULES_READ_TOOL_NAMES.length && exercised.length === tools.length, unexercised.length ? `Unexercised: ${unexercised.map((row) => `${row.name}:${row.sentence}`).join(" | ")}` : `${exercised.length}/${tools.length} produced a calculation or an explicitly expected clean-zero result`);
  const incomeTool = rawTools.find((row) => row.name === "income_statement");
  const trialTool = rawTools.find((row) => row.name === "trial_balance");
  const toolIncome = incomeStatement(jonathanHousehold, month);
  const toolTrial = trialBalance(compileHousehold(jonathanHousehold), { recognizedOnly: true });
  const surfaceParity = Boolean(incomeTool?.sentence.includes(formatCad(toolIncome.incomeCents))
    && incomeTool.sentence.includes(formatCad(toolIncome.expenseCents))
    && trialTool?.sentence.includes(formatCad(toolTrial.totalDebitCents))
    && trialTool.sentence.includes(formatCad(toolTrial.totalCreditCents)));
  check("surface-parity", "Journal, statements, and Hercules agree", surfaceParity, surfaceParity ? "Current-month income/expense and trial totals match across calculation surfaces" : `Income tool: ${incomeTool?.sentence ?? "missing"} · Trial tool: ${trialTool?.sentence ?? "missing"}`);

  const reportWithoutHash = {
    kind: "hearth-demo-suite-report" as const,
    version: manifest.version,
    seed: manifest.seed,
    generatedForDate: manifest.today,
    buildSha: manifest.buildSha,
    status: checks.every((row) => row.status === "pass") ? "ready" as const : "not-ready" as const,
    checks,
    engines: manifest.engines,
    tools,
    counts: {
      transactions: household.transactions.length,
      shifts: household.shifts.length,
      schedules: household.sevenShiftsSchedules?.length ?? 0,
      appointments: household.appointments.length,
      claims: household.claims.length,
      goals: household.goals.length,
    },
    fixtureHashSha256: manifest.fixtureHashSha256,
    observedFixtureHashSha256,
    verifiedRevision: household.revision,
  };
  return { ...reportWithoutHash, attestationSha256: await sha256Hex(reportWithoutHash) };
}

export function assertDemoReplacementAllowed(current: Household): void {
  if (current.environment !== "development") throw new Error("Demo Suite is Development-only.");
  if (current.transactions.length > 0 && current.syntheticFixture?.kind !== "hearth-demo-suite") {
    throw new Error("Demo Suite will not replace ordinary Development books. Create or open its dedicated synthetic household.");
  }
}

export function preserveDemoShowcaseContinuity(current: Household, generated: Household): Household {
  assertDemoReplacementAllowed(current);
  const preserved = {
    ...generated,
    householdId: current.householdId,
    inviteCode: current.inviteCode,
    linked: current.linked,
    revision: current.revision,
    baseRevision: current.baseRevision,
    google: current.google,
    devices: current.devices,
    sharing: current.sharing,
  };
  return completeSyntheticDemoOnboarding(preserved, {
    at: generated.householdOnboarding?.completedAt ?? generated.syntheticFixture?.generatedAt ?? `${generated.syntheticFixture?.generatedForDate ?? "1970-01-01"}T12:00:00.000Z`,
    sourceKey: `preserved:${generated.syntheticFixture?.version ?? "seed"}:${generated.syntheticFixture?.seed ?? 0}:${generated.syntheticFixture?.generatedForDate ?? "unknown"}`,
  });
}
