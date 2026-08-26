import {
  addDays,
  isValidDateKey,
  monthKeyFromDateKey,
  monthStartKey,
  shiftMonthKey,
  weekBounds,
  type DateKey,
  type MonthKey,
} from "./calendar.ts";
import { accountBookBalance, creditCardView, householdWallet } from "./accounts.ts";
import { claimPublicLabel, outstandingClaims } from "./appointments.ts";
import { monthSummary } from "./budget.ts";
import { duplicateContrastPairs } from "./duplicate.ts";
import { formatCad } from "./money.ts";
import { leftoverProjection } from "./sitDown.ts";
import {
  auditOpinion,
  balanceSheet,
  cashFlowStatement,
  comparativeIncome,
  incomeStatement,
  statementOfChangesInEquity,
} from "./statements.ts";
import { accountRegister, compileHousehold, trialBalance } from "./journal.ts";
import { householdForHerculesContext } from "./visibility.ts";
import type { HerculesAskContext } from "./askBooks.ts";
import type { HerculesGroundedFact, HerculesNumberSource } from "./herculesProvenance.ts";
import type { HerculesTalk } from "./herculesTalk.ts";
import { JOINT, type Account, type Household, type Transaction } from "./types.ts";

export const HERCULES_READ_TOOL_NAMES = [
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
};

export type HerculesReadToolRun = {
  plan: HerculesReadToolPlan;
  results: HerculesReadToolResult[];
  talk: HerculesTalk;
};

export const HERCULES_READ_TOOL_CATALOG: ReadonlyArray<{ name: HerculesReadToolName; description: string }> = [
  { name: "account_balance", description: "Read one visible account balance or the visible account list." },
  { name: "find_transactions", description: "Find posted rows by merchant, account, category, member, date period, or amount bounds." },
  { name: "spending_summary", description: "Total expenses less refunds for a period, optionally filtered." },
  { name: "income_summary", description: "Total posted income for a period, optionally for one member." },
  { name: "compare_spending", description: "Compare spending between two named periods." },
  { name: "bills_due", description: "List repeating household bills due within 1–90 days." },
  { name: "shift_summary", description: "Summarize posted shifts, hours, wages, tips, and paid breaks." },
  { name: "goal_progress", description: "Read visible savings-jar progress." },
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

function cleanArgs(name: HerculesReadToolName, raw: unknown): Record<string, unknown> {
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
      limit: Math.min(10, Math.max(1, Math.round(Number(input.limit) || 5))),
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
    return { ...common, limit: Math.min(10, Math.max(1, Math.round(Number(input.limit) || 8))) };
  }
  if (name === "account_activity" || name === "explain_balance") {
    return { account: common.account, period: cleanPeriod(input.period), from: common.from, to: common.to, limit: Math.min(10, Math.max(1, Math.round(Number(input.limit) || 8))) };
  }
  if (name === "journal_entry_detail") return { entryId: cleanString(input.entryId, 100) };
  if (name === "money_owed" || name === "cash_position" || name === "net_worth" || name === "audit_health") return {};
  return common;
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

function visibleAccounts(household: Household, context: HerculesAskContext): Account[] {
  const referenced = new Set<string>();
  for (const tx of household.transactions) {
    referenced.add(tx.accountId);
    if (tx.transferFromAccountId) referenced.add(tx.transferFromAccountId);
    if (tx.transferToAccountId) referenced.add(tx.transferToAccountId);
  }
  return household.accounts.filter((account) => {
    if (!account.active) return false;
    if (context.view === "personal") return account.ownerMemberId === context.memberId || account.ownerMemberId === JOINT || referenced.has(account.id);
    return account.ownerMemberId === JOINT || referenced.has(account.id);
  });
}

function resolveMember(household: Household, query: string | undefined, context: HerculesAskContext) {
  if (!query) return undefined;
  if (context.view === "personal") {
    const self = household.members.find((member) => member.id === context.memberId);
    return self && (normalize(query) === "me" || normalize(self.name).includes(normalize(query))) ? self : undefined;
  }
  return fuzzy(household.members.filter((member) => member.active), query, (member) => member.name);
}

function resolveFilters(household: Household, args: Record<string, unknown>, context: HerculesAskContext) {
  const accountQuery = cleanString(args.account);
  const categoryQuery = cleanString(args.category);
  const memberQuery = cleanString(args.member);
  const account = fuzzy(visibleAccounts(household, context), accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`);
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
  return toolSource(context, `Open journal entry ${entry.id}`, {
    journalEntryId: entry.id,
    transactionId: entry.originTransactionIds[0],
    from: entry.date,
    to: entry.date,
    ...detail,
  });
}

function executeCall(household: Household, call: HerculesReadToolCall, today: DateKey, context: HerculesAskContext): HerculesReadToolResult {
  if (call.name === "account_balance") {
    const accounts = visibleAccounts(household, context);
    const accountQuery = cleanString(call.args.account);
    const target = fuzzy(accounts, accountQuery, (row) => `${row.name} ${row.institution} ${row.last4}`);
    if (accountQuery && !target) return empty(call, `I cannot match visible account “${accountQuery}” in this ledger.`);
    const rows = target ? [target] : accounts.slice(0, 8);
    if (!rows.length) return empty(call, "I cannot see an account in this ledger.");
    const facts = rows.map((account, index) => fact(call, index, account.name, formatCad(accountBookBalance(household, account.id, today)), toolSource(context, `Open ${account.name}`, { accountId: account.id, surface: "accounts", to: today })));
    return { callId: call.id, name: call.name, status: "ok", sentence: target ? `${target.name} is ${facts[0]!.value} on the visible books.` : `I found ${facts.length} visible account balances.`, facts };
  }

  if (call.name === "find_transactions") {
    const query = matchingTransactionsAt(household, call.args, context, today);
    if (query.filters.missing.length) return empty(call, `I cannot match ${query.filters.missing.join(" or ")} in this ledger.`);
    const limit = Math.min(10, Math.max(1, Number(call.args.limit) || 5));
    const rows = [...query.rows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    if (!rows.length) return empty(call, `I found no matching posted rows ${query.range.label}.`);
    const facts = rows.map((tx, index) => fact(call, index, `${tx.date} · ${tx.place || tx.note || tx.type}`, formatCad(tx.amountCents), toolSource(context, "Open this posted row", { transactionId: tx.id, accountId: tx.accountId, categoryId: tx.subcategoryId ?? undefined, memberId: tx.createdBy, from: tx.date, to: tx.date })));
    return { callId: call.id, name: call.name, status: "ok", sentence: `I found ${query.rows.length} matching posted row${query.rows.length === 1 ? "" : "s"} ${query.range.label}; here are ${facts.length}.`, facts };
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
    const facts = rows.slice(0, 8).map((row, index) => fact(call, index, `${row.nextDate} · ${row.note || "Repeating item"}`, formatCad(row.amountCents), { route: "calendar", view: context.view, surface: "calendar", recurrenceId: row.id, from: row.nextDate, to: row.nextDate, label: "Open this repeating item" }));
    return { callId: call.id, name: call.name, status: "ok", sentence: `${rows.length} repeating item${rows.length === 1 ? " is" : "s are"} due in the next ${horizon} days.`, facts };
  }

  if (call.name === "shift_summary") {
    const period = cleanPeriod(call.args.period, "this_week");
    const range = periodRange(today, period, call.args);
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const rows = household.shifts.filter((shift) => shift.date >= range.start && shift.date <= range.end && (!member || shift.memberId === member.id));
    const hours = rows.reduce((sum, row) => sum + row.hours, 0);
    // D-127 stores paid-break income inside wagesCents while retaining the
    // component separately for reporting; adding it again would double count.
    const income = rows.reduce((sum, row) => sum + row.wagesCents + row.netTipsCents, 0);
    const source: HerculesNumberSource = { route: "home", view: context.view, surface: "timesheet", memberId: member?.id, from: range.start, to: range.end, label: "Open the timesheet" };
    return { callId: call.id, name: call.name, status: rows.length ? "ok" : "empty", sentence: `${member?.name ?? (context.view === "household" ? "The household" : "You")} has ${rows.length} posted shift${rows.length === 1 ? "" : "s"}, ${hours.toFixed(1)} hours, and ${formatCad(income)} of shift income ${range.label}.`, facts: [fact(call, 0, "Shift income", formatCad(income), source), fact(call, 1, "Hours", hours.toFixed(1), source), fact(call, 2, "Shifts", String(rows.length), source)] };
  }

  if (call.name === "goal_progress") {
    const target = fuzzy(household.goals, cleanString(call.args.goal), (row) => row.name);
    const goalQuery = cleanString(call.args.goal);
    if (goalQuery && !target) return empty(call, `I cannot match visible jar “${goalQuery}” in this ledger.`);
    const rows = target ? [target] : household.goals.slice(0, 8);
    if (!rows.length) return empty(call, "No visible savings jars are on these books.");
    const facts = rows.map((goal, index) => fact(call, index, goal.name, `${formatCad(goal.savedCents)} / ${formatCad(goal.targetCents)}`, { route: "plan", view: context.view, surface: "jars", goalId: goal.id, label: `Open ${goal.name}` }));
    return { callId: call.id, name: call.name, status: "ok", sentence: target ? `${target.name} is ${target.targetCents ? Math.round((target.savedCents / target.targetCents) * 100) : 0}% funded.` : `I found ${rows.length} visible savings jars.`, facts };
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
    const cards = visibleAccounts(household, context).filter((account) => account.kind === "credit");
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
    const rows = trial.rows.filter((row) => row.displayDebitCents || row.displayCreditCents).slice(0, 8);
    const facts = rows.map((row, index) => fact(
      call,
      index,
      `${row.code} · ${row.name}`,
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
    const account = fuzzy(books.chart, accountQuery, (row) => `${row.code} ${row.name}`);
    if (accountQuery && !account) return empty(call, `I cannot match journal account “${accountQuery}” in this ledger.`);
    const memberQuery = cleanString(call.args.member);
    const member = resolveMember(household, memberQuery, context);
    if (memberQuery && !member) return empty(call, `I cannot match member “${memberQuery}” in this ledger.`);
    const limit = Math.min(10, Math.max(1, Number(call.args.limit) || 8));
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
    const account = fuzzy(books.chart, accountQuery, (row) => `${row.code} ${row.name}`);
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
    const limit = Math.min(10, Math.max(1, Number(call.args.limit) || 8));
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
    const facts = entry.lines.map((line, index) => fact(call, index, `${chart.get(line.accountId)?.code ?? line.accountId} · ${chart.get(line.accountId)?.name ?? line.accountId}`, line.debitCents ? `${formatCad(line.debitCents)} debit` : `${formatCad(line.creditCents)} credit`, journalSource(context, entry, { accountId: chart.get(line.accountId)?.bankAccountId, categoryId: chart.get(line.accountId)?.categoryId })));
    const total = entry.lines.reduce((sum, line) => sum + line.debitCents, 0);
    return { callId: call.id, name: call.name, status: "ok", sentence: `${entry.id} on ${entry.date} posts ${formatCad(total)} of debits and equal credits across ${entry.lines.length} lines. Source: ${entry.source}; recognized: ${entry.recognized ? "yes" : "no"}.`, facts };
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

  return { callId: call.id, name: call.name, status: "unavailable", sentence: "That read-only tool is unavailable.", facts: [] };
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

export function executeHerculesReadToolPlan(
  household: Household,
  rawPlan: unknown,
  today: DateKey,
  context: HerculesAskContext,
): HerculesReadToolRun {
  const plan = parseHerculesReadToolPlan(rawPlan);
  const scoped = householdForHerculesContext(household, context.memberId, context.view);
  const results = plan.calls.map((call) => executeCall(scoped, call, today, context));
  const facts = results.flatMap((result) => result.facts).slice(0, 8);
  const sentence = results.length
    ? clipSentence(results.map((result) => result.sentence).join(" "))
    : "I need a clearer books question. Try an account, period, category, bill, shift, jar, or claim.";
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
