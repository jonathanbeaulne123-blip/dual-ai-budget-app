import {
  addDays,
  calendarDaysBetween,
  isValidDateKey,
  monthKeyFromDateKey,
  monthStartKey,
  shiftMonthKey,
  weekBounds,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import { accountBookBalance, creditCardView, householdWallet } from "./accounts.ts";
import { activeAccounts } from "./catalog.ts";
import { claimPublicLabel, outstandingClaims } from "./appointments.ts";
import { monthSummary } from "./budget.ts";
import { duplicateContrastPairs } from "./duplicate.ts";
import { runHealthCheck } from "./health.ts";
import { formatCad } from "./money.ts";
import { leftoverProjection } from "./sitDown.ts";
import {
  auditOpinion,
  balanceSheet,
  cashFlowStatement,
  comparativeIncome,
  incomeStatement,
  statementOfChangesInEquity,
  isMonthClosed,
  budgetVariance,
} from "./statements.ts";
import { accountRegister, booksEquation, compileHousehold, trialBalance } from "./journal.ts";
import { ledgerNameForView, shapeLedgerNames } from "./ledgerNames.ts";
import type { HerculesAskContext } from "./askBooks.ts";
import type { HerculesGroundedFact, HerculesNumberSource } from "./herculesProvenance.ts";
import type { HerculesTalk } from "./herculesTalk.ts";
import type { Account, Household, ShiftEventTag, Transaction } from "./types.ts";
import { isShiftEventTag } from "./types.ts";
import { householdForHerculesContext, householdForShiftReadTools } from "./visibility.ts";
import {
  explainShiftYearSimulation,
  listTipShifts,
  planTaxMilk,
  runShiftYearSimulation,
  runTipOracle,
  shiftOutlook,
  simulateTipSchedule,
  upcomingCadenceSchedule,
  type TipMeal,
} from "./tipScience.ts";
import { staticMacroPrior } from "./macroPriors.ts";
import {
  runCashCinema,
  runWhatIfDesk,
  runYearReview,
  type WhatIfScenario,
} from "./simReview.ts";
import type { WeatherGlass } from "./weather.ts";

export const HERCULES_READ_TOOL_NAMES = [
  "ledger_context",
  "account_balance",
  "find_transactions",
  "spending_summary",
  "income_summary",
  "compare_spending",
  "bills_due",
  "shift_summary",
  "goal_progress",
  "money_owed",
  "cash_position",
  "budget_status",
  "category_breakdown",
  "credit_card_status",
  "net_worth",
  "audit_health",
  "duplicate_review",
  "balance_sheet",
  "income_statement",
  "cash_flow_statement",
  "trial_balance",
  "general_ledger",
  "account_activity",
  "journal_entry_detail",
  "changes_in_net_worth",
  "period_comparison",
  "explain_balance",
  "reconciliation_status",
  "activity_since_reconciliation",
  "uncategorized_activity",
  "duplicate_exposure",
  "missing_periods",
  "opening_balance_review",
  "period_close_readiness",
  "source_document_coverage",
  "integrity_findings",
  "audit_trail",
  "budget_variance",
  "cash_runway",
  "bill_coverage",
  "debt_projection",
  "credit_utilization",
  "savings_rate",
  "income_stability",
  "spending_trend",
  "scenario_analysis",
  "forecast_accuracy",
  "explain_transaction",
  "explain_accounting_equation",
  "explain_debit_credit",
  "explain_financial_statement",
  "trace_number",
  "compare_accounting_treatments",
  "explain_variance",
  "explain_transfer",
  "tip_oracle",
  "shift_outlook",
  "tip_schedule_sim",
  "tax_milk_plan",
  "shift_year_simulation",
  "explain_shift_simulation",
  "list_shifts",
  "cash_cinema",
  "what_if_desk",
  "year_review",
] as const;

export type HerculesReadToolName = (typeof HERCULES_READ_TOOL_NAMES)[number];
export type HerculesPeriod = "this_week" | "last_week" | "this_month" | "last_month" | "last_30_days" | "custom";

export type HerculesReadToolCall = {
  id: string;
  name: HerculesReadToolName;
  args: Record<string, unknown>;
};

export type HerculesReadToolPlan = {
  calls: HerculesReadToolCall[];
};

export type HerculesReadToolResult = {
  callId: string;
  name: HerculesReadToolName;
  status: "ok" | "empty" | "unavailable";
  sentence: string;
  facts: HerculesGroundedFact[];
  /** Optional structured page payload for Pro (cursors, rows). */
  payload?: Record<string, unknown>;
};

export type HerculesReadToolRun = {
  plan: HerculesReadToolPlan;
  results: HerculesReadToolResult[];
  talk: HerculesTalk;
};

export const HERCULES_READ_TOOL_CATALOG: ReadonlyArray<{ name: HerculesReadToolName; description: string }> = [
  { name: "ledger_context", description: "Read the household name, every ledger name, every member, every active bank account, and category names the books use." },
  { name: "account_balance", description: "Read one visible account balance or the visible account list." },
  { name: "find_transactions", description: "Find posted rows by merchant, account, category, member, date period, or amount bounds." },
  { name: "spending_summary", description: "Total expenses less refunds for a period, optionally filtered." },
  { name: "income_summary", description: "Total posted income for a period, optionally for one member." },
  { name: "compare_spending", description: "Compare spending between two named periods." },
  { name: "bills_due", description: "List repeating household bills due within 1–90 days." },
  { name: "shift_summary", description: "Summarize posted shifts, hours, wages, tips, and paid breaks." },
  { name: "goal_progress", description: "Read visible savings-goal progress." },
  { name: "money_owed", description: "Read visible outstanding claims and receivables." },
  { name: "cash_position", description: "Read the household sit-down cash position; household ledger only." },
  { name: "budget_status", description: "Compare posted income and spending with the monthly plan." },
  { name: "category_breakdown", description: "Rank visible spending or income categories for a month." },
  { name: "credit_card_status", description: "Read one visible card's balance, statement, minimum, due date, and utilization." },
  { name: "net_worth", description: "Read household assets less liabilities; household ledger only." },
  { name: "audit_health", description: "Read the deterministic books opinion and integrity-finding count." },
  { name: "duplicate_review", description: "List visible potential-duplicate pairs and confidence; never delete either row." },
  { name: "balance_sheet", description: "Read posted assets, liabilities, equity, and the accounting-equation check." },
  { name: "income_statement", description: "Read posted income, expenses, and net income for one month." },
  { name: "cash_flow_statement", description: "Read operating, card, debt-paydown, and investing cash activity for one month." },
  { name: "trial_balance", description: "Read debit and credit balances from the recognized journal." },
  { name: "general_ledger", description: "Read recent recognized journal activity across the visible ledger." },
  { name: "account_activity", description: "Read a named account's debit, credit, and running-balance register." },
  { name: "journal_entry_detail", description: "Read both sides and source rows of one journal entry." },
  { name: "changes_in_net_worth", description: "Read opening net worth, posted net income, and closing net worth for one month." },
  { name: "period_comparison", description: "Compare posted income, expenses, and net income with the prior month." },
  { name: "explain_balance", description: "Explain how debits and credits produced one visible account balance." },
  { name: "reconciliation_status", description: "Read the latest bank-reconciliation result for visible accounts." },
  { name: "activity_since_reconciliation", description: "List posted account rows after its latest statement reconciliation." },
  { name: "uncategorized_activity", description: "Find posted income or expense rows with no valid category." },
  { name: "duplicate_exposure", description: "Summarize unresolved duplicate candidates and excluded duplicate rows." },
  { name: "missing_periods", description: "Find empty calendar months between the first visible post and today." },
  { name: "opening_balance_review", description: "Show the first recognized journal activity for visible accounts." },
  { name: "period_close_readiness", description: "Check whether a month has integrity, duplicate, and reconciliation blockers." },
  { name: "source_document_coverage", description: "Summarize import/source provenance attached to posted rows." },
  { name: "integrity_findings", description: "List deterministic books-health findings with source identifiers." },
  { name: "audit_trail", description: "Read the latest immutable household activity records." },
  { name: "budget_variance", description: "Compare posted category spending with the selected month's budget." },
  { name: "cash_runway", description: "Estimate days of cash runway from recent posted spending." },
  { name: "bill_coverage", description: "Compare cash-like balances with scheduled bills in a chosen horizon." },
  { name: "debt_projection", description: "Project card payoff time with a stated or current minimum payment." },
  { name: "credit_utilization", description: "Read per-card and aggregate posted balance utilization." },
  { name: "savings_rate", description: "Calculate posted monthly income retained after spending." },
  { name: "income_stability", description: "Measure variation in posted monthly income over 2–12 months." },
  { name: "spending_trend", description: "Show posted monthly spending totals over 2–12 months." },
  { name: "scenario_analysis", description: "Test a hypothetical purchase against current cash and scheduled bills." },
  { name: "forecast_accuracy", description: "Compare a month's budget forecast with posted actual results." },
  { name: "explain_transaction", description: "Explain the debit, credit, recognition, and source of one posted transaction." },
  { name: "explain_accounting_equation", description: "Explain the visible ledger's assets, liabilities, and net income equation." },
  { name: "explain_debit_credit", description: "Explain what debits and credits do to a named chart account." },
  { name: "explain_financial_statement", description: "Explain one current statement's purpose and linked headline figures." },
  { name: "trace_number", description: "Trace one transaction, account, or category figure to posted source rows." },
  { name: "compare_accounting_treatments", description: "Contrast two commonly confused household accounting treatments." },
  { name: "explain_variance", description: "Explain one category's actual-versus-budget variance for a month." },
  { name: "explain_transfer", description: "Explain both journal legs of one posted transfer transaction." },
  { name: "tip_oracle", description: "Monte Carlo tipped-income floor, mid, high, and dry-streak reserve from posted shifts. Projection only." },
  { name: "shift_outlook", description: "Estimate tip range for one upcoming shift from weekday, meal, hours, and optional weather. Projection only." },
  { name: "tip_schedule_sim", description: "Simulate the next days of tip outcomes from historical cadence; ranks protect-floor vs chase-spike advice. Projection only." },
  { name: "tax_milk_plan", description: "Split tip income into educational tax-milk, smoothing buffer, and leftover projections. Never posts." },
  { name: "shift_year_simulation", description: "Seeded Monte Carlo for the next 6–12 months of tips and wages from posted shift history. Projection only." },
  { name: "explain_shift_simulation", description: "Teach how the shift year simulation works: method, limits, and a human next step. Never posts." },
  { name: "list_shifts", description: "Page through posted shifts with sales, covers, staffing, tip%, and event tags. Prefer tip_oracle aggregates first." },
  { name: "cash_cinema", description: "13-week forward cash ribbon from tip floor/typical, wage pace, bills, and card mins. Projection only." },
  { name: "what_if_desk", description: "Named unposted scenario versus current cash and tip floor. Never posts." },
  { name: "year_review", description: "Posted tip months, income, spend, budget misses, and shift count for a trailing window." },
];

const TOOL_SET = new Set<string>(HERCULES_READ_TOOL_NAMES);
const PERIODS = new Set<HerculesPeriod>(["this_week", "last_week", "this_month", "last_month", "last_30_days", "custom"]);

function cleanString(value: unknown, max = 80): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, max);
  return cleaned || undefined;
}

function cleanDate(value: unknown): DateKey | undefined {
  const date = cleanString(value, 10);
  return date && isValidDateKey(date) ? date : undefined;
}

function cleanCents(value: unknown): number | undefined {
  const cents = Number(value);
  if (!Number.isFinite(cents)) return undefined;
  return Math.min(1_000_000_000, Math.max(0, Math.round(cents)));
}

function cleanPeriod(value: unknown, fallback: HerculesPeriod = "this_month"): HerculesPeriod {
  return typeof value === "string" && PERIODS.has(value as HerculesPeriod) ? value as HerculesPeriod : fallback;
}

/** Free Brain ≤10; Pro MCP default 50 / max 100. */
function toolPageLimit(context: HerculesAskContext, requested: unknown, freeDefault: number, freeMax = 10): number {
  const fallback = context.toolPageMode === "pro" ? 50 : freeDefault;
  const raw = Math.round(Number(requested));
  const value = Number.isFinite(raw) && raw > 0 ? raw : fallback;
  if (context.toolPageMode === "pro") return Math.min(100, Math.max(1, value));
  return Math.min(freeMax, Math.max(1, value));
}

function resolveMacroPrior(context: HerculesAskContext, today: DateKey) {
  if (context.macroPrior) return context.macroPrior;
  if (context.toolPageMode === "pro") return staticMacroPrior(monthKeyFromDateKey(today));
  return null;
}

function encodePageCursor(offset: number): string {
  return `o:${Math.max(0, Math.floor(offset))}`;
}

function decodePageCursor(cursor: string | undefined | null): number {
  if (!cursor) return 0;
  const match = /^o:(\d+)$/.exec(String(cursor).trim());
  if (!match) return 0;
  return Math.max(0, Number(match[1]));
}

function cleanArgs(name: HerculesReadToolName, raw: unknown, context?: HerculesAskContext): Record<string, unknown> {
  const pageContext: HerculesAskContext = context ?? { memberId: "", view: "personal", toolPageMode: "free" };
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const common = {
    period: cleanPeriod(input.period),
    from: cleanDate(input.from),
    to: cleanDate(input.to),
    member: cleanString(input.member),
    account: cleanString(input.account),
    category: cleanString(input.category),
    merchant: cleanString(input.merchant),
  };
  if (name === "find_transactions") {
    return {
      ...common,
      minimumAmountCents: cleanCents(input.minimumAmountCents),
      maximumAmountCents: cleanCents(input.maximumAmountCents),
      limit: toolPageLimit(pageContext, input.limit, 5),
      cursor: cleanString(input.cursor, 40),
    };
  }
  if (name === "bills_due") {
    return { horizonDays: Math.min(90, Math.max(1, Math.round(Number(input.horizonDays) || 14))) };
  }
  if (name === "compare_spending") {
    return {
      currentPeriod: cleanPeriod(input.currentPeriod, "this_month"),
      comparisonPeriod: cleanPeriod(input.comparisonPeriod, "last_month"),
      member: common.member,
      category: common.category,
    };
  }
  if (name === "ledger_context") return {};
  if (name === "account_balance") return { account: common.account };
  if (name === "goal_progress") return { goal: cleanString(input.goal) };
  if (name === "category_breakdown") {
    return {
      period: cleanPeriod(input.period),
      type: input.type === "income" ? "income" : "expense",
      limit: Math.min(8, Math.max(1, Math.round(Number(input.limit) || 5))),
    };
  }
  if (name === "credit_card_status") return { account: common.account };
  if (name === "budget_status") return { period: cleanPeriod(input.period) };
  if (name === "duplicate_review") return { limit: Math.min(4, Math.max(1, Math.round(Number(input.limit) || 3))) };
  if (name === "balance_sheet" || name === "trial_balance") return {};
  if (name === "income_statement" || name === "cash_flow_statement" || name === "changes_in_net_worth" || name === "period_comparison") {
    return { period: cleanPeriod(input.period) };
  }
  if (name === "general_ledger") {
    return { ...common, limit: Math.min(100, Math.max(1, Math.round(Number(input.limit) || 8))), cursor: cleanString(input.cursor, 40) };
  }
  if (name === "account_activity" || name === "explain_balance") {
    return { account: common.account, period: cleanPeriod(input.period), from: common.from, to: common.to, limit: Math.min(100, Math.max(1, Math.round(Number(input.limit) || 8))), cursor: cleanString(input.cursor, 40) };
  }
  if (name === "journal_entry_detail") return { entryId: cleanString(input.entryId, 100) };
  if (name === "reconciliation_status" || name === "opening_balance_review") return { account: common.account };
  if (name === "activity_since_reconciliation") return { account: common.account, limit: Math.min(100, Math.max(1, Math.round(Number(input.limit) || 8))), cursor: cleanString(input.cursor, 40) };
  if (name === "uncategorized_activity" || name === "source_document_coverage") return { ...common, limit: Math.min(100, Math.max(1, Math.round(Number(input.limit) || 8))), cursor: cleanString(input.cursor, 40) };
  if (name === "duplicate_exposure" || name === "integrity_findings" || name === "audit_trail" || name === "missing_periods") return { limit: Math.min(100, Math.max(1, Math.round(Number(input.limit) || 8))), cursor: cleanString(input.cursor, 40) };
  if (name === "period_close_readiness") return { period: cleanPeriod(input.period) };
  if (name === "budget_variance" || name === "savings_rate" || name === "forecast_accuracy") return { period: cleanPeriod(input.period), limit: Math.min(100, Math.max(1, Math.round(Number(input.limit) || 8))) };
  if (name === "cash_runway") return { period: cleanPeriod(input.period, "last_30_days") };
  if (name === "bill_coverage") return { horizonDays: Math.min(90, Math.max(1, Math.round(Number(input.horizonDays) || 30))) };
  if (name === "debt_projection") return { account: common.account, monthlyPaymentCents: cleanCents(input.monthlyPaymentCents) };
  if (name === "credit_utilization") return { account: common.account };
  if (name === "income_stability" || name === "spending_trend") return { months: Math.min(12, Math.max(2, Math.round(Number(input.months) || 6))) };
  if (name === "scenario_analysis") return { amountCents: cleanCents(input.amountCents), horizonDays: Math.min(90, Math.max(1, Math.round(Number(input.horizonDays) || 30))) };
  if (name === "explain_transaction" || name === "explain_transfer") return { transactionId: cleanString(input.transactionId, 100) };
  if (name === "explain_accounting_equation") return {};
  if (name === "explain_debit_credit") return { account: common.account };
  if (name === "explain_financial_statement") return { statement: cleanString(input.statement, 40) };
  if (name === "trace_number") return { transactionId: cleanString(input.transactionId, 100), account: common.account, category: common.category, period: cleanPeriod(input.period) };
  if (name === "compare_accounting_treatments") return { topic: cleanString(input.topic, 60) };
  if (name === "explain_variance") return { category: common.category, period: cleanPeriod(input.period) };
  if (name === "tip_oracle") {
    return {
      member: common.member,
      horizonDays: Math.min(62, Math.max(14, Math.round(Number(input.horizonDays) || 28))),
      iterations: Math.min(5000, Math.max(200, Math.round(Number(input.iterations) || 2000))),
      seed: Math.min(1_000_000_000, Math.max(0, Math.round(Number(input.seed) || 137))),
    };
  }
  if (name === "shift_outlook") {
    const hoursRaw = Number(input.hours);
    return {
      member: common.member,
      date: cleanDate(input.date) ?? cleanDate(input.from),
      hours: Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.min(24, Math.max(0.25, hoursRaw)) : 0,
      meal: input.meal === "lunch" || input.meal === "dinner" ? input.meal : undefined,
      weatherGlass: cleanWeatherGlass(input.weatherGlass),
      eventTag: isShiftEventTag(input.eventTag) ? input.eventTag : undefined,
      salesCents: cleanCents(input.salesCents),
      customersServed: Number.isInteger(Number(input.customersServed)) ? Math.min(5000, Math.max(0, Number(input.customersServed))) : undefined,
      staffingCount: Number.isInteger(Number(input.staffingCount)) ? Math.min(200, Math.max(1, Number(input.staffingCount))) : undefined,
    };
  }
  if (name === "tip_schedule_sim") {
    return {
      member: common.member,
      days: Math.min(14, Math.max(3, Math.round(Number(input.days) || 7))),
      weatherGlass: cleanWeatherGlass(input.weatherGlass),
      eventTag: isShiftEventTag(input.eventTag) ? input.eventTag : undefined,
    };
  }
  if (name === "tax_milk_plan") {
    return {
      member: common.member,
      tipCents: cleanCents(input.tipCents),
      shiftId: cleanString(input.shiftId, 100),
      taxRateBps: Math.min(5000, Math.max(0, Math.round(Number(input.taxRateBps) || 2500))),
    };
  }
  if (name === "shift_year_simulation") {
    return {
      member: common.member,
      months: Math.min(12, Math.max(6, Math.round(Number(input.months) || 12))),
      iterations: Math.min(2000, Math.max(200, Math.round(Number(input.iterations) || 800))),
      seed: Math.min(1_000_000_000, Math.max(0, Math.round(Number(input.seed) || 137))),
    };
  }
  if (name === "explain_shift_simulation") {
    return { member: common.member };
  }
  if (name === "list_shifts") {
    return {
      ...common,
      job: cleanString(input.job),
      eventTag: isShiftEventTag(input.eventTag) ? input.eventTag : undefined,
      tippedOnly: input.tippedOnly === true || input.tippedOnly === "true",
      limit: Math.min(100, Math.max(1, Math.round(Number(input.limit) || 50))),
      cursor: cleanString(input.cursor, 40),
    };
  }
  if (name === "cash_cinema") {
    return {
      member: common.member,
      weeks: Math.min(13, Math.max(4, Math.round(Number(input.weeks) || 13))),
    };
  }
  if (name === "what_if_desk") {
    const scenario = cleanWhatIfScenario(input.scenario);
    return {
      member: common.member,
      scenario,
      amountCents: cleanCents(input.amountCents),
    };
  }
  if (name === "year_review") {
    return {
      member: common.member,
      months: Math.min(12, Math.max(3, Math.round(Number(input.months) || 12))),
    };
  }
  if (name === "money_owed" || name === "cash_position" || name === "net_worth" || name === "audit_health") return {};
  return common;
}

function cleanWeatherGlass(value: unknown): WeatherGlass | undefined {
  return value === "clear" || value === "rain" || value === "snow" || value === "night" || value === "humid"
    ? value
    : undefined;
}

function cleanWhatIfScenario(value: unknown): WhatIfScenario | undefined {
  return value === "cut_one_dinner_shift"
    || value === "extra_card_pay"
    || value === "purchase"
    || value === "tax_milk_boost"
    ? value
    : undefined;
}

/** Untrusted model output enters here. Unknown/write-shaped calls disappear. */
export function parseHerculesReadToolPlan(value: unknown): HerculesReadToolPlan {
  let input = value;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      return { calls: [] };
    }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return { calls: [] };
  const rows = Array.isArray((input as { calls?: unknown }).calls) ? (input as { calls: unknown[] }).calls : [];
  const calls: HerculesReadToolCall[] = [];
  for (const [index, row] of rows.entries()) {
    if (calls.length >= 4) break;
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const candidate = row as { id?: unknown; name?: unknown; args?: unknown };
    if (typeof candidate.name !== "string" || !TOOL_SET.has(candidate.name)) continue;
    const name = candidate.name as HerculesReadToolName;
    calls.push({
      id: cleanString(candidate.id, 48) ?? `tool-${index + 1}`,
      name,
      args: cleanArgs(name, candidate.args),
    });
  }
  return { calls };
}

type DateRange = { start: DateKey; end: DateKey; label: string };

function periodRange(today: DateKey, period: HerculesPeriod, args: Record<string, unknown>): DateRange {
  if (period === "custom") {
    const from = cleanDate(args.from);
    const to = cleanDate(args.to);
    if (from && to) return from <= to ? { start: from, end: to, label: `${from} to ${to}` } : { start: to, end: from, label: `${to} to ${from}` };
  }
  if (period === "this_week") {
    const range = weekBounds(today);
    return { start: range.start, end: range.end, label: "this week" };
  }
  if (period === "last_week") {
    const current = weekBounds(today);
    return { start: addDays(current.start, -7), end: addDays(current.end, -7), label: "last week" };
  }
  if (period === "last_30_days") return { start: addDays(today, -29), end: today, label: "the last 30 days" };
  const month = monthKeyFromDateKey(today);
  const target = period === "last_month" ? shiftMonthKey(month, -1) : month;
  const start = monthStartKey(target);
  return { start, end: addDays(monthStartKey(shiftMonthKey(target, 1)), -1), label: period === "last_month" ? "last month" : "this month" };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fuzzy<T>(rows: T[], query: string | undefined, label: (row: T) => string): T | undefined {
  if (!query) return undefined;
  const needle = normalize(query);
  if (!needle) return undefined;
  return rows.find((row) => normalize(label(row)) === needle)
    ?? rows.find((row) => normalize(label(row)).includes(needle) || needle.includes(normalize(label(row))));
}

function herculesAccounts(household: Household): Account[] {
  return activeAccounts(household);
}

function herculesChartAccounts(household: Household, books: ReturnType<typeof compileHousehold>) {
  const bankIds = new Set(herculesAccounts(household).map((account) => account.id));
  return books.chart.filter((account) => account.source !== "bank" || bankIds.has(account.id));
}

function accountLabel(household: Household, accountId: string | null | undefined): string {
  if (!accountId) return "Unknown account";
  return household.accounts.find((account) => account.id === accountId)?.name ?? accountId;
}

function categoryLabel(household: Household, categoryId: string | null | undefined): string {
  if (!categoryId) return "Uncategorized";
  const category = household.categories.find((item) => item.id === categoryId);
  if (!category) return categoryId;
  if (category.recordType === "category" && category.parentId) {
    const parent = household.categories.find((item) => item.id === category.parentId);
    return parent ? `${parent.name} · ${category.name}` : category.name;
  }
  return category.name;
}

function chartAccountLabel(chart: Map<string, { name: string }>, accountId: string): string {
  return chart.get(accountId)?.name ?? accountId;
}

function journalEntryLabel(entry: { date: string; memo?: string | null }): string {
  const memo = entry.memo?.trim();
  return memo ? `${entry.date} · ${memo}` : `${entry.date} journal entry`;
}

function resolveMember(household: Household, query: string | undefined, context: HerculesAskContext) {
  if (!query) return undefined;
  if (normalize(query) === "me") {
    return household.members.find((member) => member.id === context.memberId);
  }
  return fuzzy(household.members.filter((member) => member.active), query, (member) => member.name);
}

function resolveFilters(household: Household, args: Record<string, unknown>, context: HerculesAskContext) {
  const accountQuery = cleanString(args.account);
  const categoryQuery = cleanString(args.category);
  const memberQuery = cleanString(args.member);
  const account = fuzzy(herculesAccounts(household), accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`);
  const category = fuzzy(household.categories.filter((row) => row.recordType === "category" && row.active), categoryQuery, (row) => row.name);
  const member = resolveMember(household, memberQuery, context);
  const missing = [
    accountQuery && !account ? `account “${accountQuery}”` : "",
    categoryQuery && !category ? `category “${categoryQuery}”` : "",
    memberQuery && !member ? `member “${memberQuery}”` : "",
  ].filter(Boolean);
  return { account, category, member, merchant: cleanString(args.merchant), missing };
}

function toolSource(context: HerculesAskContext, label: string, detail: Partial<HerculesNumberSource> = {}): HerculesNumberSource {
  return { route: "ledger", view: context.view, label, ...detail };
}

function fact(call: HerculesReadToolCall, index: number, label: string, value: string, source: HerculesNumberSource, basis: "journal" | "projection" = "journal"): HerculesGroundedFact {
  return { id: `${call.id}:${index}:${label}`, label, value, source, basis };
}

function empty(call: HerculesReadToolCall, sentence: string): HerculesReadToolResult {
  return { callId: call.id, name: call.name, status: "empty", sentence, facts: [] };
}

function statementMonth(today: DateKey, args: Record<string, unknown>): MonthKey {
  return cleanPeriod(args.period) === "last_month"
    ? shiftMonthKey(monthKeyFromDateKey(today), -1)
    : monthKeyFromDateKey(today);
}

function journalSource(
  context: HerculesAskContext,
  entry: ReturnType<typeof compileHousehold>["entries"][number],
  detail: Partial<HerculesNumberSource> = {},
): HerculesNumberSource {
  return toolSource(context, `Open ${journalEntryLabel(entry)}`, {
    journalEntryId: entry.id,
    transactionId: entry.originTransactionIds[0],
    from: entry.date,
    to: entry.date,
    ...detail,
  });
}

function executeCall(household: Household, call: HerculesReadToolCall, today: DateKey, context: HerculesAskContext): HerculesReadToolResult {
  if (call.name === "ledger_context") {
    const member = household.members.find((row) => row.id === context.memberId && row.active);
    const names = shapeLedgerNames(household.ledgerNames, household.members);
    const activeLedger = ledgerNameForView(household, context.memberId, context.view);
    const accounts = herculesAccounts(household);
    const members = household.members.filter((row) => row.active);
    const categories = household.categories.filter((row) => row.active && row.recordType === "category");
    const source = toolSource(context, "Ledger context");
    const facts = [
      fact(call, 0, "Household name", household.name, source),
      fact(call, 1, "Shared ledger name", names.shared, source),
      fact(call, 2, "Active ledger name", activeLedger, source),
      fact(call, 3, "Connected member", member?.name ?? context.memberId, source),
      ...members.map((row, index) => fact(call, 4 + index, row.name, names.personal[row.id] ?? "Personal Ledger", source)),
      ...accounts.map((account, index) => fact(
        call,
        20 + index,
        account.name,
        `${account.kind}${account.institution ? ` · ${account.institution}` : ""}${account.last4 ? ` ···${account.last4}` : ""} · ${formatCad(accountBookBalance(household, account.id, today))}`,
        toolSource(context, `Open ${account.name}`, { accountId: account.id, surface: "accounts", to: today }),
      )),
      ...categories.slice(0, 12).map((category, index) => fact(
        call,
        40 + index,
        categoryLabel(household, category.id),
        category.transactionType,
        toolSource(context, `Open ${category.name}`, { categoryId: category.id }),
      )),
    ];
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Household “${household.name}” · active ledger “${activeLedger}” · ${members.length} member${members.length === 1 ? "" : "s"} · ${accounts.length} active account${accounts.length === 1 ? "" : "s"} · ${categories.length} active categories.`,
      facts,
    };
  }

  if (call.name === "account_balance") {
    const accounts = herculesAccounts(household);
    const accountQuery = cleanString(call.args.account);
    const target = fuzzy(accounts, accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`);
    if (accountQuery && !target) return empty(call, `I cannot match visible account “${accountQuery}” in this ledger.`);
    const rows = target ? [target] : accounts;
    if (!rows.length) return empty(call, "I cannot see an account in this ledger.");
    const facts = rows.map((account, index) => fact(call, index, account.name, formatCad(accountBookBalance(household, account.id, today)), toolSource(context, `Open ${account.name}`, { accountId: account.id, surface: "accounts", to: today })));
    return { callId: call.id, name: call.name, status: "ok", sentence: target ? `${target.name} is ${facts[0]!.value} on the visible books.` : `I found ${facts.length} visible account balances.`, facts };
  }

  if (call.name === "find_transactions") {
    const query = matchingTransactionsAt(household, call.args, context, today);
    if (query.filters.missing.length) return empty(call, `I cannot match ${query.filters.missing.join(" or ")} in this ledger.`);
    const limit = toolPageLimit(context, call.args.limit, 5);
    const sorted = [...query.rows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const offset = decodePageCursor(cleanString(call.args.cursor, 40));
    const rows = sorted.slice(offset, offset + limit);
    if (!rows.length) return empty(call, `I found no matching posted rows ${query.range.label}.`);
    const facts = rows.map((tx, index) => fact(
      call,
      index,
      `${tx.date} · ${tx.place || tx.note || tx.type} · ${accountLabel(household, tx.accountId)} · ${categoryLabel(household, tx.subcategoryId)}`,
      formatCad(tx.amountCents),
      toolSource(context, "Open this posted row", { transactionId: tx.id, accountId: tx.accountId, categoryId: tx.subcategoryId ?? undefined, memberId: tx.createdBy, from: tx.date, to: tx.date }),
    ));
    const nextOffset = offset + rows.length;
    const nextCursor = nextOffset < sorted.length ? encodePageCursor(nextOffset) : null;
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `I found ${query.rows.length} matching posted row${query.rows.length === 1 ? "" : "s"} ${query.range.label}; showing ${facts.length}${nextCursor ? " (more available via cursor)" : ""}.`,
      facts,
      payload: { nextCursor, totalMatched: sorted.length, limit },
    };
  }

  if (call.name === "spending_summary" || call.name === "income_summary") {
    const query = matchingTransactionsAt(household, call.args, context, today);
    if (query.filters.missing.length) return empty(call, `I cannot match ${query.filters.missing.join(" or ")} in this ledger.`);
    const rows = query.rows.filter((tx) => call.name === "income_summary"
      ? tx.type === "income"
      : tx.type === "expense" || tx.type === "refund");
    const cents = rows.reduce((sum, tx) => {
      if (call.name === "income_summary") return sum + (tx.type === "income" ? tx.amountCents : 0);
      if (tx.type === "expense") return sum + tx.amountCents;
      if (tx.type === "refund") return sum - tx.amountCents;
      return sum;
    }, 0);
    const label = call.name === "income_summary" ? `Income · ${query.range.label}` : `Spending · ${query.range.label}`;
    const source = toolSource(context, `Open ${label.toLowerCase()} rows`, {
      accountId: query.filters.account?.id,
      categoryId: query.filters.category?.id,
      memberId: query.filters.member?.id,
      transactionTypes: call.name === "income_summary" ? ["income"] : ["expense", "refund"],
      from: query.range.start,
      to: query.range.end,
    });
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: `${label} is ${formatCad(cents)} from ${rows.length} posted row${rows.length === 1 ? "" : "s"}.`, facts: [fact(call, 0, label, formatCad(cents), source)] };
  }

  if (call.name === "compare_spending") {
    const currentPeriod = cleanPeriod(call.args.currentPeriod, "this_month");
    const comparisonPeriod = cleanPeriod(call.args.comparisonPeriod, "last_month");
    const current = matchingTransactionsAt(household, { ...call.args, period: currentPeriod }, context, today);
    const comparison = matchingTransactionsAt(household, { ...call.args, period: comparisonPeriod }, context, today);
    if (current.filters.missing.length) return empty(call, `I cannot match ${current.filters.missing.join(" or ")} in this ledger.`);
    const total = (rows: Transaction[]) => rows.reduce((sum, tx) => sum + (tx.type === "expense" ? tx.amountCents : tx.type === "refund" ? -tx.amountCents : 0), 0);
    const currentCents = total(current.rows);
    const comparisonCents = total(comparison.rows);
    const delta = currentCents - comparisonCents;
    const detail = { categoryId: current.filters.category?.id, memberId: current.filters.member?.id, transactionTypes: ["expense", "refund"] as Transaction["type"][] };
    const facts = [
      fact(call, 0, current.range.label, formatCad(currentCents), toolSource(context, `Open ${current.range.label}`, { ...detail, from: current.range.start, to: current.range.end })),
      fact(call, 1, comparison.range.label, formatCad(comparisonCents), toolSource(context, `Open ${comparison.range.label}`, { ...detail, from: comparison.range.start, to: comparison.range.end })),
      fact(call, 2, "Difference", formatCad(Math.abs(delta)), toolSource(context, "Open the current comparison rows", { ...detail, from: current.range.start, to: current.range.end }), "projection"),
    ];
    const direction = delta === 0 ? "the same as" : delta > 0 ? "above" : "below";
    return { callId: call.id, name: call.name, status: "ok", sentence: `${current.range.label} is ${formatCad(Math.abs(delta))} ${direction} ${comparison.range.label}.`, facts };
  }

  if (call.name === "bills_due") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "Shared bills live in the Household ledger. Switch there and ask again.", facts: [] };
    const horizon = Math.min(90, Math.max(1, Number(call.args.horizonDays) || 14));
    const end = addDays(today, horizon);
    const rows = household.recurrences.filter((row) => row.active && row.type === "expense" && row.nextDate >= today && row.nextDate <= end).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    if (!rows.length) return empty(call, `No repeating bills are due in the next ${horizon} days.`);
    const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
    const totalSource: HerculesNumberSource = { route: "calendar", view: context.view, surface: "calendar", from: today, to: end, label: "Open scheduled bills" };
    const facts = [
      fact(call, 0, "Scheduled bills total", formatCad(totalCents), totalSource, "projection"),
      ...rows.slice(0, 7).map((row, index) => fact(call, index + 1, `${row.nextDate} · ${row.note || "Repeating item"}`, formatCad(row.amountCents), { route: "calendar", view: context.view, surface: "calendar", recurrenceId: row.id, from: row.nextDate, to: row.nextDate, label: "Open this repeating item" }, "projection")),
    ];
    return { callId: call.id, name: call.name, status: "ok", sentence: `${rows.length} repeating item${rows.length === 1 ? " is" : "s are"} due in the next ${horizon} days, totaling ${formatCad(totalCents)}.`, facts };
  }

  if (call.name === "shift_summary") {
    const period = cleanPeriod(call.args.period, "this_month");
    const range = periodRange(today, period, call.args);
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const visibleShifts = household.shifts.filter((shift) => !member || shift.memberId === member.id);
    const rows = visibleShifts.filter((shift) => shift.date >= range.start && shift.date <= range.end);
    const hours = rows.reduce((sum, row) => sum + row.hours, 0);
    // D-127 stores paid-break income inside wagesCents while retaining the
    // component separately for reporting; adding it again would double count.
    const income = rows.reduce((sum, row) => sum + row.wagesCents + row.netTipsCents, 0);
    const sales = rows.reduce((sum, row) => sum + (row.salesCents || 0), 0);
    const covers = rows.reduce((sum, row) => sum + (row.customersServed || 0), 0);
    const staffing = rows.reduce((sum, row) => sum + (row.staffingCount || 0), 0);
    const source: HerculesNumberSource = { route: "home", view: context.view, surface: "timesheet", memberId: member?.id, from: range.start, to: range.end, label: "Open the timesheet" };
    const subject = member?.name ?? (context.view === "household" ? "The household" : "You");
    if (!rows.length && visibleShifts.length > 0) {
      return {
        callId: call.id,
        name: call.name,
        status: "empty",
        sentence: `${subject} has ${visibleShifts.length} posted shift${visibleShifts.length === 1 ? "" : "s"} in this cloud ledger, but none ${range.label}. Try another period or custom from/to dates.`,
        facts: [fact(call, 0, "Posted shifts in ledger", String(visibleShifts.length), source), fact(call, 1, "Shifts in period", "0", source)],
      };
    }
    if (!rows.length) {
      const cloudHint = context.view === "personal"
        ? " Hercules Pro reads your hosted cloud ledger, not the phone directly. If shifts appear in Hearth on your phone, open Hearth, confirm Google sign-in for this member, wait until sync finishes, then ask again."
        : " Hercules Pro reads hosted household snapshots. If shifts appear on your phone, sync from Hearth first, then ask again.";
      return {
        callId: call.id,
        name: call.name,
        status: "empty",
        sentence: `I found 0 posted shifts in this ${context.view} cloud ledger${range.label ? ` for ${range.label}` : ""}.${cloudHint}`,
        facts: [fact(call, 0, "Posted shifts in ledger", "0", source)],
      };
    }
    return { callId: call.id, name: call.name, status: "ok", sentence: `${subject} has ${rows.length} posted shift${rows.length === 1 ? "" : "s"}, ${hours.toFixed(1)} hours, and ${formatCad(income)} of shift income ${range.label}. Sales ${formatCad(sales)} · covers ${covers || "—"} · floor headcount sum ${staffing || "—"}.`, facts: [fact(call, 0, "Shift income", formatCad(income), source), fact(call, 1, "Hours", hours.toFixed(1), source), fact(call, 2, "Shifts", String(rows.length), source), fact(call, 3, "Sales", formatCad(sales), source), fact(call, 4, "Customers served", covers ? String(covers) : "not stamped", source)] };
  }

  if (call.name === "goal_progress") {
    const target = fuzzy(household.goals, cleanString(call.args.goal), (row) => row.name);
    const goalQuery = cleanString(call.args.goal);
    if (goalQuery && !target) return empty(call, `I cannot match visible goal “${goalQuery}” in this ledger.`);
    const rows = target ? [target] : household.goals.slice(0, 8);
    if (!rows.length) return empty(call, "No visible savings goals are on these books.");
    const facts = rows.map((goal, index) => fact(call, index, goal.name, `${formatCad(goal.savedCents)} / ${formatCad(goal.targetCents)}`, { route: "plan", view: context.view, surface: "jars", goalId: goal.id, label: `Open ${goal.name}` }));
    return { callId: call.id, name: call.name, status: "ok", sentence: target ? `${target.name} is ${target.targetCents ? Math.round((target.savedCents / target.targetCents) * 100) : 0}% funded.` : `I found ${rows.length} visible savings goals.`, facts };
  }

  if (call.name === "money_owed") {
    const rows = outstandingClaims(household);
    if (!rows.length) return empty(call, "Nothing visible is outstanding. The claims tray is empty.");
    const facts = rows.slice(0, 8).map((claim, index) => fact(call, index, claimPublicLabel(household, claim, "hercules"), formatCad(claim.expectedCents - claim.receivedCents - claim.writtenOffCents), { route: "calendar", view: context.view, surface: "claims", claimId: claim.id, label: "Open this claim" }));
    return { callId: call.id, name: call.name, status: "ok", sentence: `${rows.length} visible claim${rows.length === 1 ? " is" : "s are"} still outstanding. Settlement is a transfer.`, facts };
  }

  if (call.name === "cash_position") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "The shared cash-position calculation lives in the Household ledger.", facts: [] };
    const row = leftoverProjection(household, today);
    const source: HerculesNumberSource = { route: "plan", view: context.view, surface: "postcard", label: "Open the sit-down cash calculation" };
    return { callId: call.id, name: call.name, status: "ok", sentence: row.leftoverCents ? `The sit-down calculation leaves ${formatCad(row.leftoverCents)} after bills and minimums.` : `The sit-down calculation leaves no money to move. ${row.formula}`, facts: [fact(call, 0, "Cash-like", formatCad(row.cashLikeCents), source), fact(call, 1, "Bills next 30 days", formatCad(row.billsNext30Cents), source, "projection"), fact(call, 2, "Card minimums", formatCad(row.minPaymentsCents), source, "projection"), fact(call, 3, "Leftover", formatCad(row.leftoverCents), source, "projection")] };
  }

  if (call.name === "budget_status" || call.name === "category_breakdown") {
    const requested = cleanPeriod(call.args.period);
    const monthKey = requested === "last_month"
      ? shiftMonthKey(monthKeyFromDateKey(today), -1)
      : monthKeyFromDateKey(today);
    const summary = monthSummary(household, monthKey);
    const start = monthStartKey(monthKey);
    const end = addDays(monthStartKey(shiftMonthKey(monthKey, 1)), -1);
    if (call.name === "budget_status") {
      const source: HerculesNumberSource = { route: "plan", view: context.view, surface: "postcard", from: start, to: end, label: `Open the ${monthKey} plan` };
      const variance = summary.netActualCents - summary.netBudgetedCents;
      return {
        callId: call.id,
        name: call.name,
        status: "ok",
        sentence: `${monthKey} has ${formatCad(summary.incomeActualCents)} income and ${formatCad(summary.expenseActualCents)} spending. Net is ${formatCad(summary.netActualCents)}, ${formatCad(Math.abs(variance))} ${variance >= 0 ? "ahead of" : "behind"} plan.`,
        facts: [
          fact(call, 0, "Income", formatCad(summary.incomeActualCents), source),
          fact(call, 1, "Spending", formatCad(summary.expenseActualCents), source),
          fact(call, 2, "Actual net", formatCad(summary.netActualCents), source),
          fact(call, 3, "Planned net", formatCad(summary.netBudgetedCents), source, "projection"),
        ],
      };
    }
    const kind = call.args.type === "income" ? "income" : "expense";
    const limit = Math.min(8, Math.max(1, Number(call.args.limit) || 5));
    const rows = summary.categories
      .filter((row) => row.type === kind && row.actualCents !== 0)
      .sort((left, right) => Math.abs(right.actualCents) - Math.abs(left.actualCents))
      .slice(0, limit);
    if (!rows.length) return empty(call, `No posted ${kind} categories appear in ${monthKey}.`);
    const facts = rows.map((row, index) => fact(call, index, row.name, formatCad(row.actualCents), toolSource(context, `Open ${row.name} rows`, { categoryId: row.subcategoryId, transactionTypes: kind === "income" ? ["income"] : ["expense", "refund"], from: start, to: end })));
    return { callId: call.id, name: call.name, status: "ok", sentence: `The largest ${kind} categories in ${monthKey} are ${rows.map((row) => `${row.name} ${formatCad(row.actualCents)}`).join(", ")}.`, facts };
  }

  if (call.name === "credit_card_status") {
    const cards = herculesAccounts(household).filter((account) => account.kind === "credit");
    const accountQuery = cleanString(call.args.account);
    const target = fuzzy(cards, accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`) ?? (!accountQuery && cards.length === 1 ? cards[0] : undefined);
    if (!target) return empty(call, accountQuery ? `I cannot match visible card “${accountQuery}” in this ledger.` : "Name the card you want me to inspect.");
    const card = creditCardView(household, target, today);
    const source = toolSource(context, `Open ${target.name}`, { accountId: target.id, surface: "accounts", to: today });
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: card.hercules,
      facts: [
        fact(call, 0, "Current balance", formatCad(card.owedCents), source),
        fact(call, 1, "Statement balance", formatCad(card.statementBalanceCents), source),
        fact(call, 2, `Minimum · due ${card.dueDate}`, formatCad(card.minPaymentCents), source, "projection"),
        ...(card.utilization == null ? [] : [fact(call, 3, "Utilization", `${Math.round(card.utilization * 100)}%`, source, "projection")]),
      ],
    };
  }

  if (call.name === "net_worth") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "The complete book net worth lives in the Household ledger.", facts: [] };
    const wallet = householdWallet(household, today);
    const source: HerculesNumberSource = { route: "ledger", view: context.view, label: "Open the household wallet" };
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Book net worth is ${formatCad(wallet.netWorthCents)}: ${formatCad(wallet.cashCents)} cash-like, ${formatCad(wallet.investedCostCents)} invested at book cost, ${formatCad(wallet.receivableCents)} owed to us, less ${formatCad(wallet.owedCents)} on cards.`,
      facts: [
        fact(call, 0, "Book net worth", formatCad(wallet.netWorthCents), source),
        fact(call, 1, "Cash-like", formatCad(wallet.cashCents), source),
        fact(call, 2, "Investment book cost", formatCad(wallet.investedCostCents), source),
        fact(call, 3, "Cards owed", formatCad(wallet.owedCents), source),
      ],
    };
  }

  if (call.name === "audit_health") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "The complete audit opinion lives in the Household ledger.", facts: [] };
    const opinion = auditOpinion(household);
    const source: HerculesNumberSource = { route: "ledger", view: context.view, label: "Open the Audit Office" };
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: opinion.hercules,
      facts: [
        fact(call, 0, "Audit opinion", opinion.kind, source),
        fact(call, 1, "Health findings", String(opinion.healthFindings), source),
        fact(call, 2, "Trial balance", opinion.trialInBalance ? "balanced" : "not balanced", source),
      ],
    };
  }

  if (call.name === "duplicate_review") {
    const limit = Math.min(4, Math.max(1, Number(call.args.limit) || 3));
    const pairs = duplicateContrastPairs(household.transactions).slice(0, limit);
    if (!pairs.length) return empty(call, "No visible potential-duplicate pairs need review.");
    const facts = pairs.flatMap((pair, index) => [
      fact(call, index * 2, `${pair.confidence}% · ${pair.left.date} · ${pair.left.place || pair.left.note || "First row"}`, formatCad(pair.left.amountCents), toolSource(context, "Open the first candidate", { transactionId: pair.left.id, from: pair.left.date, to: pair.left.date })),
      fact(call, index * 2 + 1, `${pair.confidence}% · ${pair.right.date} · ${pair.right.place || pair.right.note || "Second row"}`, formatCad(pair.right.amountCents), toolSource(context, "Open the second candidate", { transactionId: pair.right.id, from: pair.right.date, to: pair.right.date })),
    ]);
    return { callId: call.id, name: call.name, status: "ok", sentence: `${pairs.length} potential-duplicate pair${pairs.length === 1 ? " needs" : "s need"} a human decision. I will not remove either row.`, facts };
  }

  if (call.name === "balance_sheet") {
    const sheet = balanceSheet(household);
    const source = toolSource(context, "Open the balance sheet", { to: sheet.asOf ?? today });
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `As of ${sheet.asOf ?? "the empty ledger"}, posted assets are ${formatCad(sheet.assetCents)}, liabilities are ${formatCad(sheet.liabilityCents)}, and net worth is ${formatCad(sheet.equityCents)}. The accounting equation ${sheet.holds ? "holds" : "does not hold"}.`,
      facts: [
        fact(call, 0, "Assets", formatCad(sheet.assetCents), source),
        fact(call, 1, "Liabilities", formatCad(sheet.liabilityCents), source),
        fact(call, 2, "Net worth", formatCad(sheet.equityCents), source),
        fact(call, 3, "Equation", sheet.holds ? "balanced" : "not balanced", source),
      ],
    };
  }

  if (call.name === "income_statement") {
    const month = statementMonth(today, call.args);
    const statement = incomeStatement(household, month);
    const from = `${month}-01` as DateKey;
    const to = addDays(monthStartKey(shiftMonthKey(month, 1)), -1);
    const source = toolSource(context, `Open posted ${month} activity`, { from, to });
    return {
      callId: call.id,
      name: call.name,
      status: statement.income.length || statement.expenses.length ? "ok" : "empty",
      sentence: `${month} posted income is ${formatCad(statement.incomeCents)}, expenses are ${formatCad(statement.expenseCents)}, and net income is ${formatCad(statement.netCents)}.`,
      facts: [
        fact(call, 0, "Income", formatCad(statement.incomeCents), { ...source, transactionTypes: ["income"] }),
        fact(call, 1, "Expenses", formatCad(statement.expenseCents), { ...source, transactionTypes: ["expense", "refund"] }),
        fact(call, 2, "Net income", formatCad(statement.netCents), source),
      ],
    };
  }

  if (call.name === "cash_flow_statement") {
    const month = statementMonth(today, call.args);
    const statement = cashFlowStatement(household, month);
    const source = toolSource(context, `Open ${month} cash-flow rows`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `${month} net cash movement is ${formatCad(statement.netCashCents)}: ${formatCad(statement.operatingInCents)} operating in, ${formatCad(statement.operatingOutCents)} operating out, ${formatCad(statement.debtPaydownCents)} debt paydown, and ${formatCad(statement.investingOutCents - statement.investingInCents)} net invested. Card spending of ${formatCad(statement.cardSpendCents)} is shown separately because it was not cash movement.`,
      facts: [
        fact(call, 0, "Net cash movement", formatCad(statement.netCashCents), source),
        fact(call, 1, "Operating cash in", formatCad(statement.operatingInCents), source),
        fact(call, 2, "Operating cash out", formatCad(statement.operatingOutCents), source),
        fact(call, 3, "Debt paydown", formatCad(statement.debtPaydownCents), source),
        fact(call, 4, "Net invested", formatCad(statement.investingOutCents - statement.investingInCents), source),
        fact(call, 5, "Non-cash card spending", formatCad(statement.cardSpendCents), source),
      ],
    };
  }

  if (call.name === "trial_balance") {
    const books = compileHousehold(household);
    const trial = trialBalance(books, { recognizedOnly: true });
    const visibleIds = new Set(herculesChartAccounts(household, books).map((row) => row.id));
    const rows = trial.rows.filter((row) => visibleIds.has(row.id) && (row.displayDebitCents || row.displayCreditCents)).slice(0, 8);
    const facts = rows.map((row, index) => fact(
      call,
      index,
      `${row.name}`,
      row.displayDebitCents ? `${formatCad(row.displayDebitCents)} debit` : `${formatCad(row.displayCreditCents)} credit`,
      toolSource(context, `Open ${row.name}`, { accountId: row.bankAccountId, categoryId: row.categoryId }),
    ));
    return {
      callId: call.id,
      name: call.name,
      status: rows.length ? "ok" : "empty",
      sentence: `Recognized debit balances total ${formatCad(trial.totalDebitCents)} and credit balances total ${formatCad(trial.totalCreditCents)}. The trial balance ${trial.inBalance ? "balances" : "does not balance"}.`,
      facts: [
        fact(call, 20, "Total debits", formatCad(trial.totalDebitCents), toolSource(context, "Open the trial balance")),
        fact(call, 21, "Total credits", formatCad(trial.totalCreditCents), toolSource(context, "Open the trial balance")),
        ...facts,
      ],
    };
  }

  if (call.name === "general_ledger") {
    const books = compileHousehold(household);
    const range = periodRange(today, cleanPeriod(call.args.period), call.args);
    const accountQuery = cleanString(call.args.account);
    const account = fuzzy(herculesChartAccounts(household, books), accountQuery, (row) => row.name);
    if (accountQuery && !account) return empty(call, `I cannot match journal account “${accountQuery}” in this ledger.`);
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const limit = toolPageLimit(context, call.args.limit, 8);
    const rows = books.entries.filter((entry) => entry.recognized && entry.date >= range.start && entry.date <= range.end
      && (!account || entry.lines.some((line) => line.accountId === account.id))
      && (!member || entry.createdBy === member.id || entry.lines.some((line) => line.partyId === member.id)))
      .slice(-limit).reverse();
    if (!rows.length) return empty(call, `No recognized journal entries match ${range.label}.`);
    const facts = rows.map((entry, index) => fact(call, index, `${entry.date} · ${entry.memo}`, formatCad(entry.lines.reduce((sum, line) => sum + line.debitCents, 0)), journalSource(context, entry, { accountId: account?.bankAccountId, categoryId: account?.categoryId })));
    return { callId: call.id, name: call.name, status: "ok", sentence: `I found ${rows.length} recognized journal entr${rows.length === 1 ? "y" : "ies"} ${range.label}. Each amount is the entry's total debits, matched by equal credits.`, facts };
  }

  if (call.name === "account_activity" || call.name === "explain_balance") {
    const books = compileHousehold(household);
    const accountQuery = cleanString(call.args.account);
    const account = fuzzy(herculesChartAccounts(household, books), accountQuery, (row) => row.name);
    if (!account) return empty(call, accountQuery ? `I cannot match account “${accountQuery}” in this ledger.` : "Name the account you want me to trace.");
    const range = periodRange(today, cleanPeriod(call.args.period), call.args);
    const fullRegister = accountRegister(books, account.id, { recognizedOnly: true });
    const openingRows = fullRegister.filter((row) => row.date < range.start);
    const opening = openingRows.at(-1)?.runningCents ?? 0;
    const rows = fullRegister.filter((row) => row.date >= range.start && row.date <= range.end);
    const ending = rows.at(-1)?.runningCents ?? opening;
    const debits = rows.reduce((sum, row) => sum + row.debitCents, 0);
    const credits = rows.reduce((sum, row) => sum + row.creditCents, 0);
    const source = toolSource(context, `Open ${account.name}`, { accountId: account.bankAccountId, categoryId: account.categoryId, from: range.start, to: range.end });
    if (call.name === "explain_balance") {
      const normal = account.normalBalance;
      return {
        callId: call.id,
        name: call.name,
        status: "ok",
        sentence: `${account.name} has a normal ${normal} balance. It opened ${range.label} at ${formatCad(opening)}, had ${formatCad(debits)} of debits and ${formatCad(credits)} of credits, and ended at ${formatCad(ending)}. ${normal === "debit" ? "Debits increase it and credits decrease it." : "Credits increase it and debits decrease it."}`,
        facts: [fact(call, 0, "Opening balance", formatCad(opening), source), fact(call, 1, "Debits", formatCad(debits), source), fact(call, 2, "Credits", formatCad(credits), source), fact(call, 3, "Ending balance", formatCad(ending), source)],
      };
    }
    const limit = toolPageLimit(context, call.args.limit, 8);
    const facts = rows.slice(-limit).reverse().map((row, index) => fact(call, index, `${row.date} · ${row.memo}`, `${row.debitCents ? `${formatCad(row.debitCents)} debit` : `${formatCad(row.creditCents)} credit`} · balance ${formatCad(row.runningCents)}`, { ...source, journalEntryId: row.entryId, from: row.date, to: row.date, label: `Open journal entry ${row.entryId}` }));
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: `${account.name} moved from ${formatCad(opening)} to ${formatCad(ending)} ${range.label} across ${rows.length} journal line${rows.length === 1 ? "" : "s"}.`, facts };
  }

  if (call.name === "journal_entry_detail") {
    const entryId = cleanString(call.args.entryId);
    if (!entryId) return empty(call, "Give me the journal entry ID you want to inspect.");
    const books = compileHousehold(household);
    const entry = books.entries.find((row) => row.id.toLowerCase() === entryId.toLowerCase() || row.originTransactionIds.some((id) => id.toLowerCase() === entryId.toLowerCase()));
    if (!entry) return empty(call, `I cannot find journal entry “${entryId}” in this ledger.`);
    const chart = new Map(books.chart.map((row) => [row.id, row]));
    const facts = entry.lines.map((line, index) => fact(call, index, chartAccountLabel(chart, line.accountId), line.debitCents ? `${formatCad(line.debitCents)} debit` : `${formatCad(line.creditCents)} credit`, journalSource(context, entry, { accountId: chart.get(line.accountId)?.bankAccountId, categoryId: chart.get(line.accountId)?.categoryId })));
    const total = entry.lines.reduce((sum, line) => sum + line.debitCents, 0);
    return { callId: call.id, name: call.name, status: "ok", sentence: `${journalEntryLabel(entry)} posts ${formatCad(total)} of debits and equal credits across ${entry.lines.length} lines. Source: ${entry.source}; recognized: ${entry.recognized ? "yes" : "no"}.`, facts };
  }

  if (call.name === "changes_in_net_worth") {
    const month = statementMonth(today, call.args);
    const movement = statementOfChangesInEquity(household, month);
    const source = toolSource(context, `Open ${month} posted activity`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
    return { callId: call.id, name: call.name, status: "ok", sentence: `${month} opened with ${formatCad(movement.openingCents)} of accumulated posted net income, added ${formatCad(movement.netIncomeCents)}, and closed at ${formatCad(movement.closingCents)}. The roll-forward ${movement.rolls ? "reconciles" : "does not reconcile"}.`, facts: [fact(call, 0, "Opening", formatCad(movement.openingCents), source), fact(call, 1, "Net income", formatCad(movement.netIncomeCents), source), fact(call, 2, "Closing", formatCad(movement.closingCents), source)] };
  }

  if (call.name === "period_comparison") {
    const month = statementMonth(today, call.args);
    const comparison = comparativeIncome(household, month);
    const currentSource = toolSource(context, `Open ${comparison.monthKey}`, { from: `${comparison.monthKey}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(comparison.monthKey, 1)), -1) });
    const priorSource = toolSource(context, `Open ${comparison.priorKey}`, { from: `${comparison.priorKey}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(comparison.priorKey, 1)), -1) });
    return { callId: call.id, name: call.name, status: "ok", sentence: `Compared with ${comparison.priorKey}, ${comparison.monthKey} income changed by ${formatCad(comparison.incomeDeltaCents)}, expenses by ${formatCad(comparison.expenseDeltaCents)}, and net income by ${formatCad(comparison.netDeltaCents)}.`, facts: [fact(call, 0, `${comparison.monthKey} net`, formatCad(comparison.current.netCents), currentSource), fact(call, 1, `${comparison.priorKey} net`, formatCad(comparison.prior.netCents), priorSource), fact(call, 2, "Net change", formatCad(comparison.netDeltaCents), currentSource)] };
  }

  if (call.name === "reconciliation_status") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "Bank-reconciliation controls live in the Household ledger.", facts: [] };
    const accounts = herculesAccounts(household);
    const accountQuery = cleanString(call.args.account);
    const target = fuzzy(accounts, accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`);
    if (accountQuery && !target) return empty(call, `I cannot match visible account “${accountQuery}” in this ledger.`);
    const selected = target ? [target] : accounts;
    const facts = selected.slice(0, 8).map((account, index) => {
      const rec = [...(household.kitchen.books?.reconciliations ?? [])].reverse().find((row) => row.accountId === account.id);
      const value = rec ? `${rec.status} · difference ${formatCad(rec.differenceCents)}` : "never reconciled";
      return fact(call, index, account.name, value, toolSource(context, `Open ${account.name} reconciliation`, { accountId: account.id, to: rec?.statementDate }));
    });
    const tied = facts.filter((row) => row.value.startsWith("tied")).length;
    return { callId: call.id, name: call.name, status: facts.length ? "ok" : "empty", sentence: `${tied} of ${facts.length} visible account${facts.length === 1 ? "" : "s"} most recently tied to a statement. A missing reconciliation is reported as missing, never assumed.`, facts };
  }

  if (call.name === "activity_since_reconciliation") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "Bank-reconciliation controls live in the Household ledger.", facts: [] };
    const accountQuery = cleanString(call.args.account);
    const account = fuzzy(herculesAccounts(household), accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`);
    if (!account) return empty(call, accountQuery ? `I cannot match visible account “${accountQuery}” in this ledger.` : "Name the account whose post-reconciliation activity you want.");
    const rec = [...(household.kitchen.books?.reconciliations ?? [])].reverse().find((row) => row.accountId === account.id);
    if (!rec) return empty(call, `${account.name} has no saved reconciliation. Reconcile a statement before asking what came after it.`);
    const rows = household.transactions.filter((tx) => !tx.isDuplicate && tx.accountId === account.id && tx.date > rec.statementDate && tx.date <= today).sort((a, b) => b.date.localeCompare(a.date));
    const limit = toolPageLimit(context, call.args.limit, 8);
    const facts = rows.slice(0, limit).map((tx, index) => fact(call, index, `${tx.date} · ${tx.place || tx.note || tx.type}`, formatCad(tx.amountCents), toolSource(context, "Open this post-reconciliation row", { transactionId: tx.id, accountId: account.id, from: tx.date, to: tx.date })));
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: `${account.name} has ${rows.length} posted row${rows.length === 1 ? "" : "s"} after the ${rec.statementDate} reconciliation. These are newer rows, not automatically errors.`, facts };
  }

  if (call.name === "uncategorized_activity") {
    const query = matchingTransactionsAt(household, call.args, context, today);
    const known = new Set(household.categories.filter((row) => row.recordType === "category").map((row) => row.id));
    const rows = query.rows.filter((tx) => tx.type !== "transfer" && (!tx.subcategoryId || !known.has(tx.subcategoryId)));
    const limit = toolPageLimit(context, call.args.limit, 8);
    const facts = rows.slice(0, limit).map((tx, index) => fact(call, index, `${tx.date} · ${tx.place || tx.note || tx.type}`, formatCad(tx.amountCents), toolSource(context, "Open this uncategorized row", { transactionId: tx.id, accountId: tx.accountId, from: tx.date, to: tx.date })));
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: rows.length ? `${rows.length} posted row${rows.length === 1 ? " needs" : "s need"} a valid category ${query.range.label}.` : `Every posted income and expense row has a valid category ${query.range.label}.`, facts };
  }

  if (call.name === "duplicate_exposure") {
    const pairs = duplicateContrastPairs(household.transactions);
    const excluded = household.transactions.filter((tx) => tx.isDuplicate);
    const excludedCents = excluded.reduce((sum, tx) => sum + tx.amountCents, 0);
    const limit = toolPageLimit(context, call.args.limit, 8);
    const facts = [
      fact(call, 0, "Unresolved candidate pairs", String(pairs.length), toolSource(context, "Open duplicate review"), "projection"),
      fact(call, 1, "Excluded duplicate rows", String(excluded.length), toolSource(context, "Open excluded duplicate rows")),
      fact(call, 2, "Excluded row face value", formatCad(excludedCents), toolSource(context, "Open excluded duplicate rows")),
      ...pairs.slice(0, Math.max(0, limit - 3)).map((pair, index) => fact(call, index + 3, `${pair.confidence}% · ${pair.left.date} / ${pair.right.date}`, formatCad(pair.left.amountCents), toolSource(context, "Open the duplicate candidates", { transactionId: pair.left.id, from: pair.left.date, to: pair.right.date }), "projection")),
    ];
    return { callId: call.id, name: call.name, status: pairs.length || excluded.length ? "ok" : "empty", sentence: `${pairs.length} unresolved candidate pair${pairs.length === 1 ? "" : "s"}; ${excluded.length} row${excluded.length === 1 ? " is" : "s are"} already excluded from recognized books. Candidate confidence is a review signal, not a deletion.`, facts };
  }

  if (call.name === "missing_periods") {
    const postedMonths = new Set(household.transactions.filter((tx) => !tx.isDuplicate).map((tx) => monthKeyFromDateKey(tx.date)));
    const first = [...postedMonths].sort()[0];
    if (!first) return empty(call, "This ledger has no recognized transaction month yet.");
    const current = monthKeyFromDateKey(today);
    const missing: MonthKey[] = [];
    let cursor = first;
    for (let steps = 0; steps < 120 && cursor <= current; steps += 1) {
      if (!postedMonths.has(cursor)) missing.push(cursor);
      cursor = shiftMonthKey(cursor, 1);
    }
    const limit = toolPageLimit(context, call.args.limit, 8);
    const facts = missing.slice(-limit).map((month, index) => fact(call, index, month, "no recognized rows", toolSource(context, `Open ${month}`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) })));
    return { callId: call.id, name: call.name, status: missing.length ? "ok" : "empty", sentence: missing.length ? `${missing.length} empty calendar month${missing.length === 1 ? " appears" : "s appear"} between the first visible post and today. Empty can be legitimate; it is a completeness question.` : "Every calendar month from the first visible post through today has at least one recognized row.", facts };
  }

  if (call.name === "opening_balance_review") {
    const books = compileHousehold(household);
    const accountQuery = cleanString(call.args.account);
    const visible = herculesChartAccounts(household, books).filter((row) => row.source === "bank");
    const target = fuzzy(visible, accountQuery, (row) => row.name);
    if (accountQuery && !target) return empty(call, `I cannot match visible account “${accountQuery}” in this ledger.`);
    const rows = (target ? [target] : visible).slice(0, 8);
    const facts = rows.map((account, index) => {
      const register = accountRegister(books, account.id, { recognizedOnly: true });
      const first = register[0];
      return fact(call, index, account.name, first ? `${first.date} · ${formatCad(first.runningCents)}` : "no recognized activity", toolSource(context, `Open ${account.name}`, { accountId: account.bankAccountId, from: first?.date, to: first?.date }));
    });
    return { callId: call.id, name: call.name, status: facts.length ? "ok" : "empty", sentence: `I reviewed the first recognized journal activity for ${facts.length} account${facts.length === 1 ? "" : "s"}. Hearth currently derives opening position from posted history; it does not silently invent a separate opening balance.`, facts };
  }

  if (call.name === "period_close_readiness") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "The formal close checklist lives in the Household ledger.", facts: [] };
    const month = statementMonth(today, call.args);
    const end = addDays(monthStartKey(shiftMonthKey(month, 1)), -1);
    const findings = runHealthCheck(household);
    const pairs = duplicateContrastPairs(household.transactions).filter((pair) => monthKeyFromDateKey(pair.left.date) === month || monthKeyFromDateKey(pair.right.date) === month);
    const accounts = herculesAccounts(household);
    const unreconciled = accounts.filter((account) => !(household.kitchen.books?.reconciliations ?? []).some((row) => row.accountId === account.id && row.status === "tied" && row.statementDate >= end));
    const closed = isMonthClosed(household, month);
    const blockers = findings.length + pairs.length + unreconciled.length;
    const source = toolSource(context, `Open the ${month} close checklist`, { from: `${month}-01` as DateKey, to: end });
    return { callId: call.id, name: call.name, status: blockers ? "ok" : "empty", sentence: `${month} is ${closed ? "already closed" : blockers ? `not close-ready: ${findings.length} health finding${findings.length === 1 ? "" : "s"}, ${pairs.length} duplicate candidate pair${pairs.length === 1 ? "" : "s"}, and ${unreconciled.length} account${unreconciled.length === 1 ? "" : "s"} without a tied month-end statement` : "ready for a human to close"}. Closing remains a separate confirmed action in Hearth.`, facts: [fact(call, 0, "Health findings", String(findings.length), source), fact(call, 1, "Duplicate candidates", String(pairs.length), source, "projection"), fact(call, 2, "Accounts missing month-end tie", String(unreconciled.length), source), fact(call, 3, "Closed", closed ? "yes" : "no", source)] };
  }

  if (call.name === "source_document_coverage") {
    const query = matchingTransactionsAt(household, call.args, context, today);
    const rows = query.rows.filter((tx) => tx.type !== "transfer");
    const imported = rows.filter((tx) => tx.source === "import");
    const linked = imported.filter((tx) => Boolean(tx.sourceId));
    const manual = rows.filter((tx) => tx.source === "manual");
    const source = toolSource(context, `Open ${query.range.label} source rows`, { from: query.range.start, to: query.range.end });
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: `${query.range.label}, ${linked.length} of ${imported.length} imported row${imported.length === 1 ? " has" : "s have"} a source identifier; ${manual.length} row${manual.length === 1 ? " was" : "s were"} entered manually. A source ID proves provenance linkage, not that an image is archived.`, facts: [fact(call, 0, "Posted rows", String(rows.length), source), fact(call, 1, "Imported rows", String(imported.length), source), fact(call, 2, "Imports with source ID", String(linked.length), source), fact(call, 3, "Manual rows", String(manual.length), source)] };
  }

  if (call.name === "integrity_findings") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "The complete integrity review lives in the Household ledger.", facts: [] };
    const rows = runHealthCheck(household);
    const limit = toolPageLimit(context, call.args.limit, 8);
    const facts = rows.slice(0, limit).map((row, index) => fact(call, index, row.section, row.message, toolSource(context, "Open Health", { transactionId: row.id?.startsWith("TX-") ? row.id : undefined, accountId: row.id?.startsWith("ACC-") ? row.id : undefined })));
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: rows.length ? `Health found ${rows.length} deterministic integrity finding${rows.length === 1 ? "" : "s"}; here are ${facts.length}.` : "Health found no deterministic integrity findings.", facts };
  }

  if (call.name === "audit_trail") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "The household activity trail lives in the Household ledger.", facts: [] };
    const limit = toolPageLimit(context, call.args.limit, 8);
    const rows = [...household.activity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
    const facts = rows.map((row, index) => fact(call, index, `${row.at.slice(0, 10)} · ${row.action}`, row.summary, { route: "more", view: context.view, label: "Open household activity" }));
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: rows.length ? `Here are the latest ${rows.length} household activity record${rows.length === 1 ? "" : "s"}. They describe committed actions; they do not authorize a new one.` : "The household activity trail is empty.", facts };
  }

  if (call.name === "budget_variance") {
    const month = statementMonth(today, call.args);
    const rows = budgetVariance(household, month);
    const limit = toolPageLimit(context, call.args.limit, 8);
    const source = toolSource(context, `Open the ${month} budget`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
    const facts = rows.slice(0, limit).map((row, index) => fact(call, index, row.name, `${formatCad(row.actualCents)} actual · ${formatCad(row.budgetedCents)} budget · ${formatCad(row.varianceCents)} remaining`, { ...source, categoryId: row.id }, "projection"));
    const over = rows.filter((row) => row.varianceCents < 0);
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: `${month} has ${over.length} category budget${over.length === 1 ? "" : "s"} over plan. Budget is a forecast; actuals are posted journal facts.`, facts };
  }

  if (call.name === "cash_runway") {
    const query = matchingTransactionsAt(household, { period: call.args.period ?? "last_30_days" }, context, today);
    const spending = query.rows.reduce((sum, tx) => sum + (tx.type === "expense" ? tx.amountCents : tx.type === "refund" ? -tx.amountCents : 0), 0);
    const days = Math.max(1, calendarDaysBetween(query.range.start, query.range.end) + 1);
    const daily = Math.max(0, Math.round(spending / days));
    const cash = herculesAccounts(household).filter((account) => account.kind === "chequing" || account.kind === "savings").reduce((sum, account) => sum + Math.max(0, accountBookBalance(household, account.id, today)), 0);
    const runway = daily > 0 ? Math.floor(cash / daily) : null;
    const source = toolSource(context, `Open ${query.range.label} spending`, { from: query.range.start, to: query.range.end });
    return { callId: call.id, name: call.name, status: "ok", sentence: runway == null ? `Recent net spending is zero, so a cash-runway day count is not meaningful. Cash-like balances are ${formatCad(cash)}.` : `At ${query.range.label}'s posted net-spending pace of ${formatCad(daily)} per day, the estimated cash runway from ${formatCad(cash)} of cash-like balances is about ${runway} days. This is a straight-line estimate, not a promise.`, facts: [fact(call, 0, "Cash-like", formatCad(cash), source), fact(call, 1, "Observed daily spending", formatCad(daily), source, "projection"), fact(call, 2, "Estimated runway", runway == null ? "not meaningful" : `${runway} days`, source, "projection")] };
  }

  if (call.name === "bill_coverage") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "Shared scheduled-bill coverage lives in the Household ledger.", facts: [] };
    const horizon = Math.min(90, Math.max(1, Number(call.args.horizonDays) || 30));
    const end = addDays(today, horizon);
    const bills = household.recurrences.filter((row) => row.active && row.type === "expense" && row.nextDate >= today && row.nextDate <= end).reduce((sum, row) => sum + row.amountCents, 0);
    const cash = herculesAccounts(household).filter((account) => account.kind === "chequing" || account.kind === "savings").reduce((sum, account) => sum + Math.max(0, accountBookBalance(household, account.id, today)), 0);
    const remaining = cash - bills;
    const source: HerculesNumberSource = { route: "calendar", view: context.view, surface: "calendar", from: today, to: end, label: "Open scheduled bills" };
    return { callId: call.id, name: call.name, status: "ok", sentence: `${formatCad(cash)} of posted cash-like balances ${remaining >= 0 ? "covers" : "does not cover"} ${formatCad(bills)} of scheduled bills in the next ${horizon} days, leaving ${formatCad(remaining)} before other spending. Scheduled bills are projections until confirmed paid.`, facts: [fact(call, 0, "Cash-like", formatCad(cash), source), fact(call, 1, "Scheduled bills", formatCad(bills), source, "projection"), fact(call, 2, "Coverage after bills", formatCad(remaining), source, "projection")] };
  }

  if (call.name === "debt_projection") {
    const cards = herculesAccounts(household).filter((account) => account.kind === "credit");
    const accountQuery = cleanString(call.args.account);
    const card = fuzzy(cards, accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`) ?? (!accountQuery && cards.length === 1 ? cards[0] : undefined);
    if (!card) return empty(call, accountQuery ? `I cannot match visible card “${accountQuery}” in this ledger.` : "Name the card whose payoff you want to project.");
    const view = creditCardView(household, card, today);
    const payment = cleanCents(call.args.monthlyPaymentCents) || view.minPaymentCents;
    const monthlyRate = (card.credit?.aprBps ?? 0) / 10_000 / 12;
    let balance = Math.max(0, view.owedCents);
    let interest = 0;
    let months = 0;
    let stalls = false;
    while (balance > 0 && months < 600) {
      const charge = Math.round(balance * monthlyRate);
      if (payment <= charge) { stalls = true; break; }
      interest += charge;
      balance = Math.max(0, balance + charge - payment);
      months += 1;
    }
    const source = toolSource(context, `Open ${card.name}`, { accountId: card.id, to: today });
    const sentence = stalls ? `${card.name}'s ${formatCad(payment)} monthly payment does not exceed the first month's estimated interest under the current APR assumption.` : `${card.name} would take about ${months} month${months === 1 ? "" : "s"} to repay with ${formatCad(payment)} monthly payments and no new charges, adding about ${formatCad(interest)} interest. This is a simplified projection, not a lender quote.`;
    return { callId: call.id, name: call.name, status: "ok", sentence, facts: [fact(call, 0, "Current posted balance", formatCad(view.owedCents), source), fact(call, 1, "Assumed monthly payment", formatCad(payment), source, "projection"), fact(call, 2, "Projected payoff", stalls ? "payment too low" : `${months} months`, source, "projection"), fact(call, 3, "Projected interest", formatCad(interest), source, "projection")] };
  }

  if (call.name === "credit_utilization") {
    const cards = herculesAccounts(household).filter((account) => account.kind === "credit");
    const accountQuery = cleanString(call.args.account);
    const target = fuzzy(cards, accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`);
    if (accountQuery && !target) return empty(call, `I cannot match visible card “${accountQuery}” in this ledger.`);
    const selected = target ? [target] : cards;
    if (!selected.length) return empty(call, "No visible credit card has utilization terms.");
    const views = selected.map((card) => ({ card, view: creditCardView(household, card, today) }));
    const balance = views.reduce((sum, row) => sum + row.view.owedCents, 0);
    const limit = views.reduce((sum, row) => sum + (row.card.credit?.creditLimitCents ?? 0), 0);
    const facts = views.map((row, index) => fact(call, index, row.card.name, row.view.utilization == null ? "limit unavailable" : `${Math.round(row.view.utilization * 100)}%`, toolSource(context, `Open ${row.card.name}`, { accountId: row.card.id, to: today }), "projection"));
    return { callId: call.id, name: call.name, status: "ok", sentence: `Visible card balances total ${formatCad(balance)} against ${formatCad(limit)} of recorded limits: ${limit ? Math.round((balance / limit) * 100) : 0}% aggregate utilization. Posted balance is fact; utilization is a ratio and may differ from bureau reporting.`, facts: [fact(call, 20, "Aggregate utilization", limit ? `${Math.round((balance / limit) * 100)}%` : "not available", toolSource(context, "Open visible cards"), "projection"), ...facts] };
  }

  if (call.name === "savings_rate") {
    const month = statementMonth(today, call.args);
    const summary = monthSummary(household, month);
    const retained = summary.incomeActualCents - summary.expenseActualCents;
    const rate = summary.incomeActualCents > 0 ? retained / summary.incomeActualCents : null;
    const source = toolSource(context, `Open ${month} activity`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
    return { callId: call.id, name: call.name, status: "ok", sentence: rate == null ? `${month} has no posted income, so a savings rate is not meaningful.` : `${month} retained ${formatCad(retained)} after posted spending, a ${Math.round(rate * 100)}% savings rate. Transfers between accounts do not count as income or spending.`, facts: [fact(call, 0, "Posted income", formatCad(summary.incomeActualCents), source), fact(call, 1, "Posted spending", formatCad(summary.expenseActualCents), source), fact(call, 2, "Retained", formatCad(retained), source), fact(call, 3, "Savings rate", rate == null ? "not meaningful" : `${Math.round(rate * 100)}%`, source, "projection")] };
  }

  if (call.name === "income_stability" || call.name === "spending_trend") {
    const months = Math.min(12, Math.max(2, Number(call.args.months) || 6));
    const current = monthKeyFromDateKey(today);
    const rows = Array.from({ length: months }, (_, index) => shiftMonthKey(current, index - months + 1)).map((month) => {
      const summary = monthSummary(household, month);
      return { month, income: summary.incomeActualCents, spending: summary.expenseActualCents };
    });
    const sourceFor = (month: MonthKey) => toolSource(context, `Open ${month}`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
    if (call.name === "spending_trend") {
      const first = rows[0]!.spending;
      const last = rows.at(-1)!.spending;
      const facts = rows.map((row, index) => fact(call, index, row.month, formatCad(row.spending), sourceFor(row.month)));
      return { callId: call.id, name: call.name, status: "ok", sentence: `Posted monthly spending moved from ${formatCad(first)} to ${formatCad(last)} across ${months} months, a change of ${formatCad(last - first)}. This is history, not a forecast.`, facts };
    }
    const values = rows.map((row) => row.income);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
    const variation = average > 0 ? deviation / average : null;
    const facts = rows.map((row, index) => fact(call, index, row.month, formatCad(row.income), sourceFor(row.month)));
    return { callId: call.id, name: call.name, status: "ok", sentence: variation == null ? `No average posted income exists across these ${months} months.` : `Average posted monthly income is ${formatCad(Math.round(average))}; month-to-month variation is about ${Math.round(variation * 100)}% across ${months} months. Lower variation is steadier, not guaranteed.`, facts: [fact(call, 20, "Average income", formatCad(Math.round(average)), toolSource(context, "Open income history"), "projection"), fact(call, 21, "Variation", variation == null ? "not meaningful" : `${Math.round(variation * 100)}%`, toolSource(context, "Open income history"), "projection"), ...facts] };
  }

  if (call.name === "scenario_analysis") {
    if (context.view !== "household") return { callId: call.id, name: call.name, status: "unavailable", sentence: "The shared affordability scenario uses Household cash and bills. Switch there and ask again.", facts: [] };
    const amount = cleanCents(call.args.amountCents);
    if (!amount) return empty(call, "Give me the hypothetical purchase amount in integer CAD cents.");
    const horizon = Math.min(90, Math.max(1, Number(call.args.horizonDays) || 30));
    const end = addDays(today, horizon);
    const cash = herculesAccounts(household).filter((account) => account.kind === "chequing" || account.kind === "savings").reduce((sum, account) => sum + Math.max(0, accountBookBalance(household, account.id, today)), 0);
    const bills = household.recurrences.filter((row) => row.active && row.type === "expense" && row.nextDate >= today && row.nextDate <= end).reduce((sum, row) => sum + row.amountCents, 0);
    const after = cash - bills - amount;
    const source = toolSource(context, "Open the affordability inputs", { from: today, to: end });
    return { callId: call.id, name: call.name, status: "ok", sentence: `A hypothetical ${formatCad(amount)} purchase would leave ${formatCad(after)} after current cash-like balances and ${formatCad(bills)} of scheduled bills through ${end}, before groceries, surprises, and new income. ${after >= 0 ? "It fits this narrow cash test" : "It does not fit this narrow cash test"}; that is not a guarantee or permission to spend.`, facts: [fact(call, 0, "Current cash-like", formatCad(cash), source), fact(call, 1, "Scheduled bills", formatCad(bills), source, "projection"), fact(call, 2, "Hypothetical purchase", formatCad(amount), source, "projection"), fact(call, 3, "After scenario", formatCad(after), source, "projection")] };
  }

  if (call.name === "forecast_accuracy") {
    const month = statementMonth(today, call.args);
    const summary = monthSummary(household, month);
    const incomeError = summary.incomeActualCents - summary.incomeBudgetedCents;
    const expenseError = summary.expenseActualCents - summary.expenseBudgetedCents;
    const source = toolSource(context, `Open the ${month} plan and actuals`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
    return { callId: call.id, name: call.name, status: "ok", sentence: `${month}'s budget forecast missed posted income by ${formatCad(incomeError)} and spending by ${formatCad(expenseError)}. Positive means actual was higher. This measures the saved budget, not scheduled-bill prediction quality.`, facts: [fact(call, 0, "Income forecast error", formatCad(incomeError), source, "projection"), fact(call, 1, "Spending forecast error", formatCad(expenseError), source, "projection"), fact(call, 2, "Actual net", formatCad(summary.netActualCents), source), fact(call, 3, "Budgeted net", formatCad(summary.netBudgetedCents), source, "projection")] };
  }

  if (call.name === "explain_transaction") {
    const transactionId = cleanString(call.args.transactionId);
    if (!transactionId) return empty(call, "Give me the posted transaction ID you want explained.");
    const tx = household.transactions.find((row) => row.id.toLowerCase() === transactionId.toLowerCase());
    if (!tx) return empty(call, `I cannot find visible transaction “${transactionId}”.`);
    const books = compileHousehold(household);
    const entry = books.entries.find((row) => row.originTransactionIds.includes(tx.id));
    if (!entry) return empty(call, `${tx.id} is visible but has no compiled journal entry. Health should inspect it.`);
    const chart = new Map(books.chart.map((row) => [row.id, row]));
    const facts = entry.lines.map((line, index) => fact(call, index, chartAccountLabel(chart, line.accountId), formatCad(line.debitCents || line.creditCents), journalSource(context, entry, { accountId: chart.get(line.accountId)?.bankAccountId, categoryId: chart.get(line.accountId)?.categoryId })));
    return { callId: call.id, name: call.name, status: "ok", sentence: `${tx.date} ${tx.place || tx.note || tx.type} on ${accountLabel(household, tx.accountId)} is a ${tx.type} for ${formatCad(tx.amountCents)}. ${journalEntryLabel(entry)} posts equal debits and credits across ${entry.lines.length} lines and is ${entry.recognized ? "recognized" : "excluded from recognized books"}.`, facts };
  }

  if (call.name === "explain_accounting_equation") {
    const equation = booksEquation(compileHousehold(household));
    const source = toolSource(context, "Open the accounting equation", { to: today });
    return { callId: call.id, name: call.name, status: "ok", sentence: `Posted assets of ${formatCad(equation.assetCents)} less liabilities of ${formatCad(equation.liabilityCents)} equal net worth of ${formatCad(equation.netWorthCents)}. Opening equity of ${formatCad(equation.openingEquityCents)} plus net income of ${formatCad(equation.netIncomeCents)} ${equation.holds ? "matches" : "does not match"} that net worth; every recognized entry still has equal debits and credits.`, facts: [fact(call, 0, "Assets", formatCad(equation.assetCents), source), fact(call, 1, "Liabilities", formatCad(equation.liabilityCents), source), fact(call, 2, "Net worth", formatCad(equation.netWorthCents), source), fact(call, 3, "Opening equity", formatCad(equation.openingEquityCents), source), fact(call, 4, "Income", formatCad(equation.incomeCents), source), fact(call, 5, "Expenses", formatCad(equation.expenseCents), source), fact(call, 6, "Net income", formatCad(equation.netIncomeCents), source)] };
  }

  if (call.name === "explain_debit_credit") {
    const accountQuery = cleanString(call.args.account);
    if (!accountQuery) return empty(call, "Name the bank, liability, income, or expense account you want explained.");
    const books = compileHousehold(household);
    const account = fuzzy(herculesChartAccounts(household, books), accountQuery, (row) => row.name);
    if (!account) return empty(call, `I cannot match chart account “${accountQuery}” in this ledger.`);
    const trial = trialBalance(books, { recognizedOnly: true }).rows.find((row) => row.id === account.id);
    const balance = trial ? (account.normalBalance === "debit" ? trial.netCents : -trial.netCents) : 0;
    const increase = account.normalBalance === "debit" ? "debits increase it; credits decrease it" : "credits increase it; debits decrease it";
    const source = toolSource(context, `Open ${account.name}`, { accountId: account.bankAccountId, categoryId: account.categoryId });
    return { callId: call.id, name: call.name, status: "ok", sentence: `${account.name} is a ${account.accountType} account with a normal ${account.normalBalance} balance: ${increase}. Its recognized normal-balance amount is ${formatCad(balance)}. “Debit” and “credit” mean left and right journal sides, not good and bad.`, facts: [fact(call, 0, `${account.name} balance`, formatCad(balance), source), fact(call, 1, "Normal side", account.normalBalance, source)] };
  }

  if (call.name === "explain_financial_statement") {
    const statement = cleanString(call.args.statement)?.toLowerCase().replace(/[\s-]+/g, "_");
    if (!statement) return empty(call, "Choose balance_sheet, income_statement, cash_flow_statement, or trial_balance.");
    if (statement === "balance_sheet") {
      const sheet = balanceSheet(household);
      const source = toolSource(context, "Open the balance sheet", { to: sheet.asOf ?? today });
      return { callId: call.id, name: call.name, status: "ok", sentence: `A balance sheet is the financial position at a point in time: what the ledger controls, what it owes, and the remainder. Here, assets are ${formatCad(sheet.assetCents)}, liabilities are ${formatCad(sheet.liabilityCents)}, and net worth is ${formatCad(sheet.equityCents)}.`, facts: [fact(call, 0, "Assets", formatCad(sheet.assetCents), source), fact(call, 1, "Liabilities", formatCad(sheet.liabilityCents), source), fact(call, 2, "Net worth", formatCad(sheet.equityCents), source)] };
    }
    if (statement === "income_statement") {
      const month = monthKeyFromDateKey(today);
      const row = incomeStatement(household, month);
      const source = toolSource(context, `Open ${month} income statement`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
      return { callId: call.id, name: call.name, status: "ok", sentence: `An income statement measures performance across a period: income minus expenses. ${month} has ${formatCad(row.incomeCents)} income, ${formatCad(row.expenseCents)} expenses, and ${formatCad(row.netCents)} net income.`, facts: [fact(call, 0, "Income", formatCad(row.incomeCents), source), fact(call, 1, "Expenses", formatCad(row.expenseCents), source), fact(call, 2, "Net income", formatCad(row.netCents), source)] };
    }
    if (statement === "cash_flow_statement") {
      const month = monthKeyFromDateKey(today);
      const row = cashFlowStatement(household, month);
      const source = toolSource(context, `Open ${month} cash flow`, { from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
      return { callId: call.id, name: call.name, status: "ok", sentence: `A cash-flow statement explains cash movement, not profit. ${month} net cash movement is ${formatCad(row.netCashCents)}; card spending of ${formatCad(row.cardSpendCents)} is separate because charging a card does not move cash that day.`, facts: [fact(call, 0, "Net cash movement", formatCad(row.netCashCents), source), fact(call, 1, "Non-cash card spending", formatCad(row.cardSpendCents), source)] };
    }
    if (statement === "trial_balance") {
      const row = trialBalance(compileHousehold(household), { recognizedOnly: true });
      const source = toolSource(context, "Open the trial balance");
      return { callId: call.id, name: call.name, status: "ok", sentence: `A trial balance lists each chart account's ending debit or credit balance and tests total debits against total credits. Here both totals are ${formatCad(row.totalDebitCents)} and the trial ${row.inBalance ? "balances" : "does not balance"}.`, facts: [fact(call, 0, "Total debits", formatCad(row.totalDebitCents), source), fact(call, 1, "Total credits", formatCad(row.totalCreditCents), source)] };
    }
    return empty(call, `“${statement}” is not a supported statement. Choose balance_sheet, income_statement, cash_flow_statement, or trial_balance.`);
  }

  if (call.name === "trace_number") {
    const transactionId = cleanString(call.args.transactionId);
    if (transactionId) {
      const tx = household.transactions.find((row) => row.id.toLowerCase() === transactionId.toLowerCase());
      if (!tx) return empty(call, `I cannot find visible transaction “${transactionId}”.`);
      return { callId: call.id, name: call.name, status: "ok", sentence: `${tx.id} is a ${tx.type} posted on ${tx.date} for ${formatCad(tx.amountCents)} from ${tx.source}${tx.sourceId ? ` source ${tx.sourceId}` : " without a separate source ID"}.`, facts: [fact(call, 0, `${tx.date} · ${tx.place || tx.note || tx.type}`, formatCad(tx.amountCents), toolSource(context, "Open this posted row", { transactionId: tx.id, accountId: tx.accountId, categoryId: tx.subcategoryId ?? undefined, from: tx.date, to: tx.date }))] };
    }
    const accountQuery = cleanString(call.args.account);
    if (accountQuery) {
      const account = fuzzy(herculesAccounts(household), accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`);
      if (!account) return empty(call, `I cannot match visible account “${accountQuery}”.`);
      const balance = accountBookBalance(household, account.id, today);
      return { callId: call.id, name: call.name, status: "ok", sentence: `${account.name}'s ${formatCad(balance)} comes from the recognized journal lines posted to that account through ${today}.`, facts: [fact(call, 0, account.name, formatCad(balance), toolSource(context, `Open ${account.name}`, { accountId: account.id, to: today }))] };
    }
    const categoryQuery = cleanString(call.args.category);
    if (categoryQuery) {
      const category = fuzzy(household.categories.filter((row) => row.recordType === "category"), categoryQuery, (row) => row.name);
      if (!category) return empty(call, `I cannot match visible category “${categoryQuery}”.`);
      const month = statementMonth(today, call.args);
      const summary = monthSummary(household, month).categories.find((row) => row.subcategoryId === category.id);
      const value = summary?.actualCents ?? 0;
      const source = toolSource(context, `Open ${category.name} rows`, { categoryId: category.id, from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
      return { callId: call.id, name: call.name, status: summary ? "ok" : "empty", sentence: `${category.name}'s ${month} posted actual is ${formatCad(value)}, traced to recognized rows carrying category ID ${category.id}.`, facts: [fact(call, 0, category.name, formatCad(value), source)] };
    }
    return empty(call, "Trace one stable transaction ID, account name, or category name.");
  }

  if (call.name === "compare_accounting_treatments") {
    const topic = cleanString(call.args.topic)?.toLowerCase().replace(/[\s-]+/g, "_");
    const lessons: Record<string, string> = {
      card_purchase_vs_card_payment: "A card purchase is an expense: debit the expense and credit the card liability. Paying the card is a transfer: debit the liability and credit cash. Recording both as expenses double-counts spending.",
      refund_vs_income: "A refund reverses prior spending: debit the receiving account and credit the expense category. Income credits an income account. Calling a refund income overstates both revenue and the original expense.",
      transfer_vs_expense: "A transfer moves value between balance-sheet accounts and does not change net income. An expense reduces net income because it debits an expense account.",
      receivable_vs_income: "A receivable is an asset representing money already owed. Collecting it swaps receivable for cash; it is not new income unless the earning event was never recognized before.",
      budget_vs_actual: "A budget is a plan and stays projection basis. An actual is a confirmed journal fact. Variance compares them without converting the plan into a post.",
    };
    const lesson = topic ? lessons[topic] : undefined;
    if (!lesson) return empty(call, "Choose card_purchase_vs_card_payment, refund_vs_income, transfer_vs_expense, receivable_vs_income, or budget_vs_actual.");
    return { callId: call.id, name: call.name, status: "ok", sentence: lesson, facts: [] };
  }

  if (call.name === "explain_variance") {
    const categoryQuery = cleanString(call.args.category);
    if (!categoryQuery) return empty(call, "Name the budget category whose variance you want explained.");
    const month = statementMonth(today, call.args);
    const row = budgetVariance(household, month).find((item) => normalize(item.name).includes(normalize(categoryQuery)) || normalize(categoryQuery).includes(normalize(item.name)));
    if (!row) return empty(call, `I cannot match budget category “${categoryQuery}” in ${month}.`);
    const source = toolSource(context, `Open ${row.name} in the ${month} plan`, { categoryId: row.id, from: `${month}-01` as DateKey, to: addDays(monthStartKey(shiftMonthKey(month, 1)), -1) });
    return { callId: call.id, name: call.name, status: "ok", sentence: `${row.name} budgeted ${formatCad(row.budgetedCents)} and posted ${formatCad(row.actualCents)} in ${month}. The ${formatCad(Math.abs(row.varianceCents))} variance is ${row.varianceCents >= 0 ? "unspent plan" : "over plan"}. It does not create or move money.`, facts: [fact(call, 0, "Budget", formatCad(row.budgetedCents), source, "projection"), fact(call, 1, "Actual", formatCad(row.actualCents), source), fact(call, 2, "Variance", formatCad(row.varianceCents), source, "projection")] };
  }

  if (call.name === "explain_transfer") {
    const transactionId = cleanString(call.args.transactionId);
    if (!transactionId) return empty(call, "Give me either transaction ID from the posted transfer.");
    const tx = household.transactions.find((row) => row.id.toLowerCase() === transactionId.toLowerCase());
    if (!tx || tx.type !== "transfer") return empty(call, `“${transactionId}” is not a visible transfer transaction.`);
    const books = compileHousehold(household);
    const entry = books.entries.find((row) => row.originTransactionIds.includes(tx.id));
    if (!entry) return empty(call, `${tx.id} has no compiled transfer journal entry.`);
    const chart = new Map(books.chart.map((row) => [row.id, row]));
    const facts = entry.lines.map((line, index) => fact(call, index, chartAccountLabel(chart, line.accountId), formatCad(line.debitCents || line.creditCents), journalSource(context, entry, { accountId: chart.get(line.accountId)?.bankAccountId })));
    return { callId: call.id, name: call.name, status: "ok", sentence: `${journalEntryLabel(entry)} moves ${formatCad(tx.amountCents)} from ${accountLabel(household, tx.transferFromAccountId)} to ${accountLabel(household, tx.transferToAccountId)} with equal debit and credit legs. It changes where value sits, not income, expenses, or net worth.`, facts };
  }

  if (call.name === "tip_oracle") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const macroPrior = resolveMacroPrior(context, today);
    const oracle = runTipOracle(household, {
      memberId,
      today,
      horizonDays: Number(call.args.horizonDays) || 28,
      iterations: Number(call.args.iterations) || 2000,
      seed: Number(call.args.seed) || 137,
      macroPrior,
    });
    if (!oracle) return empty(call, "I need at least four posted tip shifts before the Shift Oracle can simulate a floor.");
    const source = tipOracleSource(context, memberId);
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Across ${oracle.iterations} seeded simulations of the next ${oracle.horizonDays} days from ${oracle.sampleShifts} posted shifts, tip income lands near ${formatCad(oracle.p50Cents)} (p50), with a safe floor of ${formatCad(oracle.p10Cents)} and an upside near ${formatCad(oracle.p90Cents)}. Dry-streak reserve about ${formatCad(oracle.emergencyReserveCents)} after ${oracle.longestDryWeeks} weak week${oracle.longestDryWeeks === 1 ? "" : "s"}. These are projections, not posted income. ${oracle.assumptions[0]}`,
      facts: [
        fact(call, 0, "Safe tip floor (p10)", formatCad(oracle.p10Cents), source, "projection"),
        fact(call, 1, "Typical tips (p50)", formatCad(oracle.p50Cents), source, "projection"),
        fact(call, 2, "Upside tips (p90)", formatCad(oracle.p90Cents), source, "projection"),
        fact(call, 3, "Dry-streak reserve", formatCad(oracle.emergencyReserveCents), source, "projection"),
        fact(call, 4, "Sample shifts", String(oracle.sampleShifts), source, "projection"),
      ],
    };
  }

  if (call.name === "shift_outlook") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const requestedDate = cleanDate(call.args.date);
    const scheduled = (household.sevenShiftsSchedules ?? [])
      .filter((row) => row.memberId === memberId && row.date >= today && (!requestedDate || row.date === requestedDate))
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))[0];
    const date = requestedDate ?? scheduled?.date ?? addDays(today, 1);
    const hours = Number(call.args.hours) || (scheduled ? scheduled.scheduledMinutes / 60 : 0);
    if (!(hours > 0)) return empty(call, "Tell me the shift length, or save your personal 7shifts calendar so I can read the published schedule.");
    const macroPrior = resolveMacroPrior(context, today);
    const outlook = shiftOutlook(household, {
      date,
      hours,
      meal: call.args.meal as TipMeal | undefined,
      weatherGlass: call.args.weatherGlass as WeatherGlass | undefined,
      eventTag: isShiftEventTag(call.args.eventTag) ? call.args.eventTag as ShiftEventTag : scheduled?.eventTag,
      salesCents: cleanCents(call.args.salesCents),
      customersServed: Number.isInteger(Number(call.args.customersServed)) ? Number(call.args.customersServed) : undefined,
      staffingCount: Number.isInteger(Number(call.args.staffingCount)) ? Number(call.args.staffingCount) : scheduled?.staffingCount ?? undefined,
      memberId,
      macroPrior,
    });
    if (!outlook) return empty(call, "I need posted tip history before I can estimate tonight.");
    const source = tipOracleSource(context, memberId, date);
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `For a ${outlook.hours.toFixed(2)}h ${outlook.meal} on ${outlook.date}${scheduled ? " from your saved published 7shifts schedule" : ""}, I expect about ${formatCad(outlook.expectedTipCents)} net tips (${formatCad(outlook.lowTipCents)}–${formatCad(outlook.highTipCents)}) from ${outlook.similarShifts} similar posted shift${outlook.similarShifts === 1 ? "" : "s"}, combined soft factor ${((outlook.weatherFactor * outlook.eventFactor * outlook.covariateFactor * outlook.macroFactor)).toFixed(3)}. Projection only — Confirm still posts the real shift.`,
      facts: [
        fact(call, 0, "Expected tips", formatCad(outlook.expectedTipCents), source, "projection"),
        fact(call, 1, "Low tips (p10)", formatCad(outlook.lowTipCents), source, "projection"),
        fact(call, 2, "High tips (p90)", formatCad(outlook.highTipCents), source, "projection"),
        fact(call, 3, "Tip per hour", formatCad(outlook.tipPerHourCents), source, "projection"),
        fact(call, 4, "Macro factor", outlook.macroFactor.toFixed(3), source, "projection"),
      ],
    };
  }

  if (call.name === "tip_schedule_sim") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const days = Number(call.args.days) || 7;
    const weatherGlass = call.args.weatherGlass as WeatherGlass | undefined;
    const eventTag = isShiftEventTag(call.args.eventTag) ? call.args.eventTag as ShiftEventTag : undefined;
    const macroPrior = resolveMacroPrior(context, today);
    const schedule = upcomingCadenceSchedule(household, today, { memberId, days }).map((slot) => ({
      ...slot,
      ...(weatherGlass ? { weatherGlass } : {}),
      ...(eventTag ? { eventTag } : {}),
    }));
    const sim = simulateTipSchedule(household, schedule, { memberId, macroPrior });
    if (!sim) return empty(call, "I need posted tip cadence before I can simulate the next shifts.");
    const source = tipOracleSource(context, memberId);
    const headline = sim.rows.slice(0, 3).map((row) => `${row.date} ${row.recommendation}`).join("; ");
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Next ${sim.rows.length} likely cadence day${sim.rows.length === 1 ? "" : "s"} project about ${formatCad(sim.totalExpectedCents)} tips after weighting by how often those weekdays historically happen (${formatCad(sim.totalLowCents)}–${formatCad(sim.totalHighCents)}). Advice ranks: ${headline || "neutral"}. This never books or declines a shift.`,
      facts: [
        fact(call, 0, "Expected schedule tips", formatCad(sim.totalExpectedCents), source, "projection"),
        fact(call, 1, "Floor schedule tips", formatCad(sim.totalLowCents), source, "projection"),
        fact(call, 2, "Upside schedule tips", formatCad(sim.totalHighCents), source, "projection"),
        ...sim.rows.slice(0, 4).map((row, index) => fact(call, index + 3, `${row.date} ${row.meal}`, `${formatCad(row.expectedTipCents)} · ${row.recommendation}`, tipOracleSource(context, memberId, row.date), "projection")),
      ],
    };
  }

  if (call.name === "tax_milk_plan") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const plan = planTaxMilk(household, {
      memberId,
      tipCents: cleanCents(call.args.tipCents),
      shiftId: cleanString(call.args.shiftId, 100),
      taxRateBps: Number(call.args.taxRateBps) || 2500,
    });
    if (plan && "error" in plan) return empty(call, plan.error);
    if (!plan) return empty(call, "Give me a tip amount, a shift id, or post a tip shift first.");
    const source = tipOracleSource(context, memberId);
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Of ${formatCad(plan.tipCents)} tips, set aside about ${formatCad(plan.taxMilkCents)} tax milk — educational tip tax set-aside${plan.peak ? ` and ${formatCad(plan.bufferCents)} smoothing buffer` : ""}, leaving ${formatCad(plan.leftoverCents)} free. Educational rate ${(plan.taxRateBps / 100).toFixed(0)}% — not a filed return. Transfer drafts still need Confirm.`,
      facts: [
        fact(call, 0, "Tip base", formatCad(plan.tipCents), source, "projection"),
        fact(call, 1, "Tax milk (tip tax set-aside)", formatCad(plan.taxMilkCents), source, "projection"),
        fact(call, 2, "Smoothing buffer", formatCad(plan.bufferCents), source, "projection"),
        fact(call, 3, "Leftover after set-asides", formatCad(plan.leftoverCents), source, "projection"),
      ],
    };
  }

  if (call.name === "shift_year_simulation") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const macroPrior = resolveMacroPrior(context, today);
    const sim = runShiftYearSimulation(household, {
      memberId,
      today,
      months: Number(call.args.months) || 12,
      iterations: Number(call.args.iterations) || 800,
      seed: Number(call.args.seed) || 137,
      macroPrior,
    });
    if (!sim) return empty(call, "I need at least four posted tip shifts before I can simulate a year of tips and wages.");
    const source = tipOracleSource(context, memberId);
    const monthFacts = sim.byMonth.slice(0, 4).map((row, index) => fact(
      call,
      index + 5,
      `${row.monthKey} mid`,
      `${formatCad(row.tipsP50Cents)} tips · ${formatCad(row.wagesP50Cents)} wages`,
      tipOracleSource(context, memberId, `${row.monthKey}-01` as DateKey),
      "projection",
    ));
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Across ${sim.iterations} seeded simulations of the next ${sim.months} months from ${sim.sampleShifts} posted shifts, tip+wage income lands near ${formatCad(sim.totalP50Cents)} (p50), with a floor of ${formatCad(sim.totalP10Cents)} and upside near ${formatCad(sim.totalP90Cents)} — about ${formatCad(sim.tipsP50Cents)} tips and ${formatCad(sim.wagesP50Cents)} wages at the midpoint. These are projections, not posted income. ${sim.assumptions[0]}`,
      facts: [
        fact(call, 0, "Year tip+wage mid (p50)", formatCad(sim.totalP50Cents), source, "projection"),
        fact(call, 1, "Year tip+wage floor (p10)", formatCad(sim.totalP10Cents), source, "projection"),
        fact(call, 2, "Year tips mid (p50)", formatCad(sim.tipsP50Cents), source, "projection"),
        fact(call, 3, "Year wages mid (p50)", formatCad(sim.wagesP50Cents), source, "projection"),
        fact(call, 4, "Sample shifts", String(sim.sampleShifts), source, "projection"),
        ...monthFacts,
      ],
    };
  }

  if (call.name === "list_shifts") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const period = cleanPeriod(call.args.period, "last_30_days");
    const range = periodRange(today, period, call.args);
    const jobQuery = cleanString(call.args.job);
    const job = jobQuery
      ? (household.workJobs ?? []).find((row) => row.id === jobQuery || row.name.toLowerCase().includes(jobQuery.toLowerCase()))
      : undefined;
    if (jobQuery && !job) return empty(call, `I cannot match job “${jobQuery}” in this ledger.`);
    const limit = toolPageLimit(context, call.args.limit, 10);
    const page = listTipShifts(household, {
      memberId,
      from: range.start,
      to: range.end,
      jobId: job?.id,
      eventTag: isShiftEventTag(call.args.eventTag) ? call.args.eventTag as ShiftEventTag : undefined,
      tippedOnly: call.args.tippedOnly === true,
      limit,
      cursor: cleanString(call.args.cursor, 40),
    });
    if (!page.rows.length) return empty(call, `I found 0 posted shifts ${range.label}.`);
    const facts = page.rows.slice(0, Math.min(8, page.rows.length)).map((row, index) => fact(
      call,
      index,
      `${row.date} · ${row.meal} · ${row.eventTag}`,
      `${formatCad(row.netTipsCents)} tips · ${formatCad(row.salesCents)} sales · ${row.customersServed ?? "—"} covers · ${row.staffingCount ?? "—"} staff`,
      tipOracleSource(context, memberId, row.date),
    ));
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Showing ${page.rows.length} of ${page.totalMatched} posted shift${page.totalMatched === 1 ? "" : "s"} ${range.label}${page.nextCursor ? `; nextCursor ${page.nextCursor}` : " (end of list)"}. Prefer tip_oracle aggregates before paging the full history. Headcount only — never coworker names.`,
      facts,
      payload: {
        rows: page.rows,
        nextCursor: page.nextCursor,
        totalMatched: page.totalMatched,
        limit,
      },
    };
  }

  if (call.name === "explain_shift_simulation") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const lesson = explainShiftYearSimulation(household, { memberId });
    if (!lesson) return empty(call, "I need at least four posted tip shifts before I can teach the year simulation.");
    const source = tipOracleSource(context, memberId);
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `The year sim fits ${lesson.sampleShifts} posted shifts, then Monte Carlo-resamples tip/hour and wage/hour by weekday and meal for 6–12 months. ${lesson.method[0]} Limitation: ${lesson.limitations[0]} A Python sandbox is gated for later open-ended science; this engine stays deterministic TypeScript. Next: ${lesson.humanNextStep}`,
      facts: [
        fact(call, 0, "Sample shifts", String(lesson.sampleShifts), source, "projection"),
        fact(call, 1, "Method", lesson.method[1] ?? lesson.method[0]!, source, "projection"),
        fact(call, 2, "Limitation", lesson.limitations[0]!, source, "projection"),
        fact(call, 3, "Sandbox gate", lesson.limitations.find((line) => /Python sandbox/i.test(line)) ?? lesson.limitations[3]!, source, "projection"),
        fact(call, 4, "Human next step", lesson.humanNextStep, source, "projection"),
      ],
    };
  }

  if (call.name === "cash_cinema") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const cinema = runCashCinema(household, today, {
      memberId,
      weeks: Number(call.args.weeks) || 13,
    });
    const source = tipOracleSource(context, memberId);
    const firstDry = cinema.weeks.find((week) => week.dry);
    const assumptionTail = cinema.assumptions.slice(0, 3).join(" ");
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Cash Cinema opens at ${formatCad(cinema.openingCashCents)} and projects a low near ${formatCad(cinema.lowestCashCents)} over ${cinema.weeks.length} weeks (oracle horizon ${cinema.oracleHorizonDays} days), with ${cinema.dryWeeks} pressure week${cinema.dryWeeks === 1 ? "" : "s"}${firstDry ? ` (first around ${firstDry.weekStart})` : ""}. ${assumptionTail}`,
      facts: [
        fact(call, 0, "Opening cash", formatCad(cinema.openingCashCents), source, "projection"),
        fact(call, 1, "Lowest cash", formatCad(cinema.lowestCashCents), source, "projection"),
        fact(call, 2, "Dry weeks", String(cinema.dryWeeks), source, "projection"),
        fact(call, 3, "Weekly tip typical", formatCad(cinema.weeks[0]?.tipTypicalCents ?? 0), source, "projection"),
        fact(call, 4, "Oracle horizon days", String(cinema.oracleHorizonDays), source, "projection"),
        ...cinema.weeks.slice(0, 3).map((week, index) => fact(
          call,
          index + 5,
          `Week of ${week.weekStart}`,
          `${formatCad(week.closingCashCents)}${week.dry ? " · pressure" : ""}`,
          tipOracleSource(context, memberId, week.weekStart),
          "projection",
        )),
      ],
    };
  }

  if (call.name === "what_if_desk") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const scenario = cleanWhatIfScenario(call.args.scenario);
    if (!scenario) {
      return empty(call, "Choose cut_one_dinner_shift, extra_card_pay, purchase, or tax_milk_boost.");
    }
    const memberId = tipOracleMemberId(context, member?.id);
    const desk = runWhatIfDesk(household, today, {
      scenario,
      amountCents: cleanCents(call.args.amountCents),
      memberId,
    });
    if ("error" in desk) return empty(call, desk.error);
    const source = tipOracleSource(context, memberId);
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `${desk.label}: cash moves from ${formatCad(desk.beforeCashCents)} to ${formatCad(desk.afterCashCents)} (${formatCad(desk.deltaCashCents)}). Tip-floor window ${formatCad(desk.beforeTipFloorCents)} → ${formatCad(desk.afterTipFloorCents)}. ${desk.fits ? "It still clears a narrow leftover test." : "It fails the narrow leftover test."} ${desk.assumptions.slice(0, 2).join(" ")}`,
      facts: [
        fact(call, 0, "Before cash", formatCad(desk.beforeCashCents), source, "projection"),
        fact(call, 1, "After cash", formatCad(desk.afterCashCents), source, "projection"),
        fact(call, 2, "Cash delta", formatCad(desk.deltaCashCents), source, "projection"),
        fact(call, 3, "Fits leftover test", desk.fits ? "yes" : "no", source, "projection"),
      ],
    };
  }

  if (call.name === "year_review") {
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const memberId = tipOracleMemberId(context, member?.id);
    const review = runYearReview(household, today, {
      memberId,
      months: Number(call.args.months) || 12,
    });
    const source = tipOracleSource(context, memberId);
    return {
      callId: call.id,
      name: call.name,
      status: "ok",
      sentence: `Season Replay ${review.fromMonth}–${review.toMonth}${review.memberScoped ? " (member-scoped)" : ""}: ${formatCad(review.totalTipsCents)} tips across ${review.shiftCount} shift${review.shiftCount === 1 ? "" : "s"}, ${formatCad(review.totalIncomeCents)} income, ${formatCad(review.totalSpendCents)} spend, and ${review.budgetMissCount} budget miss${review.budgetMissCount === 1 ? "" : "es"}. Best tip month ${review.bestTipMonth ?? "n/a"}; softest ${review.worstTipMonth ?? "n/a"}. ${review.assumptions[0]} ${review.assumptions[1]}`,
      facts: [
        fact(call, 0, "Total tips", formatCad(review.totalTipsCents), source),
        fact(call, 1, "Total income", formatCad(review.totalIncomeCents), source),
        fact(call, 2, "Total spend", formatCad(review.totalSpendCents), source),
        fact(call, 3, "Budget misses", String(review.budgetMissCount), source, "projection"),
        fact(call, 4, "Shifts", String(review.shiftCount), source),
      ],
    };
  }

  return { callId: call.id, name: call.name, status: "unavailable", sentence: "That read-only tool is unavailable.", facts: [] };
}

function tipOracleMemberId(context: HerculesAskContext, explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (context.view === "personal") return context.memberId;
  return undefined;
}

function tipOracleSource(context: HerculesAskContext, memberId?: string, date?: DateKey): HerculesNumberSource {
  return {
    route: "home",
    view: context.view,
    surface: "timesheet",
    label: "Open the timesheet",
    memberId,
    from: date,
    to: date,
  };
}

function matchingTransactionsAt(household: Household, args: Record<string, unknown>, context: HerculesAskContext, today: DateKey) {
  const range = periodRange(today, cleanPeriod(args.period), args);
  const filters = resolveFilters(household, args, context);
  const merchant = normalize(filters.merchant ?? "");
  const minimumAmountCents = cleanCents(args.minimumAmountCents);
  const maximumAmountCents = cleanCents(args.maximumAmountCents);
  const rows = household.transactions.filter((tx) => {
    if (tx.isDuplicate || tx.date < range.start || tx.date > range.end) return false;
    if (filters.account && tx.accountId !== filters.account.id) return false;
    if (filters.category && tx.subcategoryId !== filters.category.id) return false;
    if (filters.member && tx.createdBy !== filters.member.id) return false;
    if (merchant && !normalize(`${tx.place} ${tx.note}`).includes(merchant)) return false;
    if (minimumAmountCents !== undefined && tx.amountCents < minimumAmountCents) return false;
    if (maximumAmountCents !== undefined && tx.amountCents > maximumAmountCents) return false;
    return true;
  });
  return { rows, range, filters };
}

function clipSentence(value: string, max = 260): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 80 ? space : max - 1)}…`;
}

const SHIFT_READ_TOOLS = new Set<HerculesReadToolName>([
  "shift_summary",
  "tip_oracle",
  "shift_outlook",
  "tip_schedule_sim",
  "tax_milk_plan",
  "shift_year_simulation",
  "explain_shift_simulation",
  "list_shifts",
]);

function scopeHouseholdForTool(household: Household, call: HerculesReadToolCall, context: HerculesAskContext): Household {
  if (SHIFT_READ_TOOLS.has(call.name)) {
    return householdForShiftReadTools(
      household,
      context.memberId,
      context.view,
      cleanString(call.args.member),
    );
  }
  return householdForHerculesContext(household, context.memberId, context.view);
}

export function executeHerculesReadToolPlan(
  household: Household,
  rawPlan: unknown,
  today: DateKey,
  context: HerculesAskContext,
): HerculesReadToolRun {
  const plan = parseHerculesReadToolPlan(rawPlan);
  const results = plan.calls.map((call) => executeCall(scopeHouseholdForTool(household, call, context), call, today, context));
  const facts = results.flatMap((result) => result.facts).slice(0, 8);
  const sentence = results.length
    ? clipSentence(results.map((result) => result.sentence).join(" "))
    : "I need a clearer books question. Try an account, period, category, bill, shift, goal, or claim.";
  return {
    plan,
    results,
    talk: {
      spoken: sentence,
      lesson: results.length ? "Read-only investigation. Tap a number to inspect the posted source." : null,
      fact: facts[0] ? { label: facts[0].label, value: facts[0].value, source: facts[0].source } : null,
      facts,
      replies: ["Show me the rows", "Compare another period", "We good?"],
      pose: facts.length ? "perch" : "loaf",
      topic: "tool",
      attention: false,
    },
  };
}
