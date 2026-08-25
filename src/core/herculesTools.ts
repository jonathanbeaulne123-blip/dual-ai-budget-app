import {
  addDays,
  isValidDateKey,
  monthKeyFromDateKey,
  monthStartKey,
  shiftMonthKey,
  weekBounds,
  type DateKey,
} from "./calendar.ts";
import { accountBookBalance } from "./accounts.ts";
import { claimPublicLabel, outstandingClaims } from "./appointments.ts";
import { formatCad } from "./money.ts";
import { leftoverProjection } from "./sitDown.ts";
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
  if (name === "money_owed" || name === "cash_position") return {};
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
