import { executeHerculesReadToolPlan } from "../src/core/herculesTools.ts";
import {
  acceptPreparedHerculesProTransaction,
  herculesProSharedProjection,
  herculesProWriteAllowed,
  prepareHerculesProTransaction,
} from "../src/core/herculesProWrite.ts";
import { commandIdentityHash, financialAuditHash, findReceipt } from "../src/core/commandIdentity.ts";
import { assertAcceptableBooks } from "../src/core/commandRuntime.ts";
import { emptyPersonal, ensureHouseholdShape, personalReplicaForMember, shapeHerculesProPermissions } from "../src/core/sync.ts";

const DEFAULT_SUPABASE_URL = "https://tykhocwacaxwquhynkok.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_8UAlkucmkTyh36yQGhnUbw_Orl9GkuS";
const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_REQUEST_TTL_SECONDS = 10 * 60;
const CODE_TTL_SECONDS = 5 * 60;
const WRITE_PREVIEW_TTL_SECONDS = 10 * 60;
const memoryCodes = new Set();

const TOOL_CATALOG = [
  ["account_balance", "Read one visible account balance or list visible accounts."],
  ["find_transactions", "Find posted rows by merchant, account, category, member, period, or amount."],
  ["spending_summary", "Total expenses less refunds for a period, optionally filtered."],
  ["income_summary", "Total posted income for a period, optionally filtered."],
  ["compare_spending", "Compare spending between two periods."],
  ["bills_due", "List repeating household bills due within 1 to 90 days."],
  ["shift_summary", "Summarize posted shifts, hours, wages, tips, and paid breaks."],
  ["goal_progress", "Read visible savings-jar progress."],
  ["money_owed", "Read visible outstanding claims and receivables."],
  ["cash_position", "Read the household sit-down cash position."],
  ["budget_status", "Compare posted income and spending with the monthly plan."],
  ["category_breakdown", "Rank visible spending or income categories for a month."],
  ["credit_card_status", "Read a card balance, statement, minimum, due date, and utilization."],
  ["net_worth", "Read household assets less liabilities."],
  ["audit_health", "Read the deterministic books opinion and integrity-finding count."],
  ["duplicate_review", "List potential duplicate pairs and confidence. Never deletes rows."],
  ["balance_sheet", "Read posted assets, liabilities, net worth, and the accounting-equation check."],
  ["income_statement", "Read posted income, expenses, and net income for one month."],
  ["cash_flow_statement", "Read operating, card, debt-paydown, and investing cash activity for one month."],
  ["trial_balance", "Read recognized debit and credit balances and verify they match."],
  ["general_ledger", "Read recent recognized journal entries across the visible ledger."],
  ["account_activity", "Read a named account's debit, credit, and running-balance register."],
  ["journal_entry_detail", "Read both sides and source rows of one journal entry."],
  ["changes_in_net_worth", "Read opening net worth, posted net income, and closing net worth for one month."],
  ["period_comparison", "Compare posted income, expenses, and net income with the prior month."],
  ["explain_balance", "Explain how debits and credits produced one visible account balance."],
  ["reconciliation_status", "Read the latest bank-reconciliation result for visible accounts."],
  ["activity_since_reconciliation", "List posted account rows after its latest statement reconciliation."],
  ["uncategorized_activity", "Find posted income or expense rows with no valid category."],
  ["duplicate_exposure", "Summarize unresolved duplicate candidates and excluded duplicate rows."],
  ["missing_periods", "Find empty calendar months between the first visible post and today."],
  ["opening_balance_review", "Show the first recognized journal activity for visible accounts."],
  ["period_close_readiness", "Check whether a month has integrity, duplicate, and reconciliation blockers."],
  ["source_document_coverage", "Summarize import/source provenance attached to posted rows."],
  ["integrity_findings", "List deterministic books-health findings with source identifiers."],
  ["audit_trail", "Read the latest immutable household activity records."],
  ["budget_variance", "Compare posted category spending with the selected month's budget."],
  ["cash_runway", "Estimate days of cash runway from recent posted spending."],
  ["bill_coverage", "Compare cash-like balances with scheduled bills in a chosen horizon."],
  ["debt_projection", "Project card payoff time with a stated or current minimum payment."],
  ["credit_utilization", "Read per-card and aggregate posted balance utilization."],
  ["savings_rate", "Calculate posted monthly income retained after spending."],
  ["income_stability", "Measure variation in posted monthly income over 2 to 12 months."],
  ["spending_trend", "Show posted monthly spending totals over 2 to 12 months."],
  ["scenario_analysis", "Test a hypothetical purchase against current cash and scheduled bills."],
  ["forecast_accuracy", "Compare a month's budget forecast with posted actual results."],
  ["explain_transaction", "Explain the debit, credit, recognition, and source of one posted transaction."],
  ["explain_accounting_equation", "Explain the visible ledger's assets, liabilities, and net income equation."],
  ["explain_debit_credit", "Explain what debits and credits do to a named chart account."],
  ["explain_financial_statement", "Explain one current statement's purpose and linked headline figures."],
  ["trace_number", "Trace one transaction, account, or category figure to posted source rows."],
  ["compare_accounting_treatments", "Contrast two commonly confused household accounting treatments."],
  ["explain_variance", "Explain one category's actual-versus-budget variance for a month."],
  ["explain_transfer", "Explain both journal legs of one posted transfer transaction."],
  ["tip_oracle", "Monte Carlo tipped-income floor, mid, high, and dry-streak reserve from posted shifts. Projection only."],
  ["shift_outlook", "Estimate tip range for one upcoming shift from weekday, meal, hours, and optional weather. Projection only."],
  ["tip_schedule_sim", "Simulate the next week of tip outcomes from cadence; ranks protect-floor vs chase-spike advice."],
  ["tax_milk_plan", "Split tip income into educational tax-milk, smoothing buffer, and leftover projections. Never posts."],
  ["shift_year_simulation", "Seeded Monte Carlo for the next 6–12 months of tips and wages from posted shift history. Projection only."],
  ["explain_shift_simulation", "Teach how the shift year simulation works: method, limits, and a human next step. Never posts."],
];

const TOOL_PROPERTIES = {
  view: { type: "string", enum: ["personal", "household"], description: "Which ledger to inspect. Defaults to personal." },
  period: { type: "string", enum: ["this_week", "last_week", "this_month", "last_month", "last_30_days", "custom"] },
  currentPeriod: { type: "string", enum: ["this_week", "last_week", "this_month", "last_month", "last_30_days"] },
  comparisonPeriod: { type: "string", enum: ["this_week", "last_week", "this_month", "last_month", "last_30_days"] },
  from: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
  to: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
  member: { type: "string", maxLength: 80 },
  account: { type: "string", maxLength: 80 },
  category: { type: "string", maxLength: 80 },
  merchant: { type: "string", maxLength: 80 },
  goal: { type: "string", maxLength: 80 },
  type: { type: "string", enum: ["expense", "income"] },
  minimumAmountCents: { type: "integer", minimum: 0, maximum: 1000000000 },
  maximumAmountCents: { type: "integer", minimum: 0, maximum: 1000000000 },
  horizonDays: { type: "integer", minimum: 1, maximum: 90 },
  limit: { type: "integer", minimum: 1, maximum: 10 },
  entryId: { type: "string", maxLength: 100, description: "Exact journal entry ID or originating transaction ID." },
  monthlyPaymentCents: { type: "integer", minimum: 0, maximum: 1000000000, description: "Optional hypothetical monthly payment in integer CAD cents." },
  amountCents: { type: "integer", minimum: 1, maximum: 1000000000, description: "Hypothetical purchase amount in integer CAD cents." },
  months: { type: "integer", minimum: 2, maximum: 12 },
  transactionId: { type: "string", maxLength: 100, description: "Stable posted transaction ID." },
  statement: { type: "string", enum: ["balance_sheet", "income_statement", "cash_flow_statement", "trial_balance"] },
  topic: { type: "string", enum: ["card_purchase_vs_card_payment", "refund_vs_income", "transfer_vs_expense", "receivable_vs_income", "budget_vs_actual"] },
  date: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
  hours: { type: "number", minimum: 0.25, maximum: 24 },
  meal: { type: "string", enum: ["lunch", "dinner"] },
  weatherGlass: { type: "string", enum: ["clear", "rain", "snow", "night", "humid"] },
  days: { type: "integer", minimum: 3, maximum: 14 },
  tipCents: { type: "integer", minimum: 0, maximum: 1000000000 },
  shiftId: { type: "string", maxLength: 100 },
  taxRateBps: { type: "integer", minimum: 0, maximum: 5000, description: "Educational tax-milk rate in basis points. 2500 = 25%." },
  iterations: { type: "integer", minimum: 200, maximum: 5000 },
  seed: { type: "integer", minimum: 0, maximum: 1000000000 },
};

const TOOL_PROPERTY_NAMES = {
  account_balance: ["view", "account"],
  find_transactions: ["view", "period", "from", "to", "member", "account", "category", "merchant", "minimumAmountCents", "maximumAmountCents", "limit"],
  spending_summary: ["view", "period", "from", "to", "member", "account", "category", "merchant"],
  income_summary: ["view", "period", "from", "to", "member", "account", "category", "merchant"],
  compare_spending: ["view", "currentPeriod", "comparisonPeriod", "member", "category"],
  bills_due: ["view", "horizonDays"],
  shift_summary: ["view", "period", "from", "to", "member"],
  goal_progress: ["view", "goal"],
  money_owed: ["view"],
  cash_position: ["view"],
  budget_status: ["view", "period"],
  category_breakdown: ["view", "period", "type", "limit"],
  credit_card_status: ["view", "account"],
  net_worth: ["view"],
  audit_health: ["view"],
  duplicate_review: ["view", "limit"],
  balance_sheet: ["view"],
  income_statement: ["view", "period"],
  cash_flow_statement: ["view", "period"],
  trial_balance: ["view"],
  general_ledger: ["view", "period", "from", "to", "member", "account", "limit"],
  account_activity: ["view", "account", "period", "from", "to", "limit"],
  journal_entry_detail: ["view", "entryId"],
  changes_in_net_worth: ["view", "period"],
  period_comparison: ["view", "period"],
  explain_balance: ["view", "account", "period", "from", "to"],
  reconciliation_status: ["view", "account"],
  activity_since_reconciliation: ["view", "account", "limit"],
  uncategorized_activity: ["view", "period", "from", "to", "limit"],
  duplicate_exposure: ["view", "limit"],
  missing_periods: ["view", "limit"],
  opening_balance_review: ["view", "account"],
  period_close_readiness: ["view", "period"],
  source_document_coverage: ["view", "period", "from", "to"],
  integrity_findings: ["view", "limit"],
  audit_trail: ["view", "limit"],
  budget_variance: ["view", "period", "limit"],
  cash_runway: ["view", "period"],
  bill_coverage: ["view", "horizonDays"],
  debt_projection: ["view", "account", "monthlyPaymentCents"],
  credit_utilization: ["view", "account"],
  savings_rate: ["view", "period"],
  income_stability: ["view", "months"],
  spending_trend: ["view", "months"],
  scenario_analysis: ["view", "amountCents", "horizonDays"],
  forecast_accuracy: ["view", "period"],
  explain_transaction: ["view", "transactionId"],
  explain_accounting_equation: ["view"],
  explain_debit_credit: ["view", "account"],
  explain_financial_statement: ["view", "statement"],
  trace_number: ["view", "transactionId", "account", "category", "period"],
  compare_accounting_treatments: ["view", "topic"],
  explain_variance: ["view", "category", "period"],
  explain_transfer: ["view", "transactionId"],
  tip_oracle: ["view", "member", "horizonDays", "iterations", "seed"],
  shift_outlook: ["view", "member", "date", "hours", "meal", "weatherGlass"],
  tip_schedule_sim: ["view", "member", "days", "weatherGlass"],
  tax_milk_plan: ["view", "member", "tipCents", "shiftId", "taxRateBps"],
  shift_year_simulation: ["view", "member", "months", "iterations", "seed"],
  explain_shift_simulation: ["view", "member"],
};

const TOOL_REQUIRED_PROPERTIES = {
  account_activity: ["account"],
  journal_entry_detail: ["entryId"],
  explain_balance: ["account"],
  activity_since_reconciliation: ["account"],
  scenario_analysis: ["amountCents"],
  explain_transaction: ["transactionId"],
  explain_debit_credit: ["account"],
  explain_financial_statement: ["statement"],
  compare_accounting_treatments: ["topic"],
  explain_variance: ["category"],
  explain_transfer: ["transactionId"],
  shift_outlook: ["hours"],
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

function originOf(request) {
  return new URL(request.url).origin;
}

function mcpResource(request) {
  return `${originOf(request)}/mcp`;
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeJson(value) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
}

function signingSecret(env) {
  const secret = String(env?.HERCULES_PRO_SIGNING_SECRET || "");
  if (secret.length < 32) throw new Error("Hercules Pro has not been connected by the household owner yet.");
  return secret;
}

async function signature(env, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

async function seal(env, claims) {
  const payload = encodeJson(claims);
  return `${payload}.${await signature(env, payload)}`;
}

async function unseal(env, token, kind) {
  const [payload, supplied, extra] = String(token || "").split(".");
  if (!payload || !supplied || extra) throw new Error("Invalid token.");
  const expected = await signature(env, payload);
  if (expected.length !== supplied.length) throw new Error("Invalid token.");
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  if (mismatch) throw new Error("Invalid token.");
  const claims = decodeJson(payload);
  if (claims.kind !== kind || Number(claims.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error("Expired token.");
  return claims;
}

async function encryptionKey(env) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signingSecret(env)));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function sealPrivate(env, claims) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(claims));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), plaintext);
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function unsealPrivate(env, token, kind) {
  const [version, encodedIv, encodedBody, extra] = String(token || "").split(".");
  if (version !== "v1" || !encodedIv || !encodedBody || extra) throw new Error("Invalid token.");
  let claims;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(encodedIv) },
      await encryptionKey(env),
      fromBase64Url(encodedBody),
    );
    claims = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Invalid token.");
  }
  if (claims.kind !== kind || Number(claims.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error("Expired token.");
  return claims;
}

function randomId() {
  return base64Url(crypto.getRandomValues(new Uint8Array(18)));
}

async function sha256Base64Url(value) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

function supabaseConfig(env) {
  return {
    url: String(env?.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ""),
    key: String(env?.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY),
  };
}

async function supabaseRequest(env, path, accessToken, init = {}) {
  const config = supabaseConfig(env);
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${accessToken || config.key}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Hearth cloud did not answer.");
  return body;
}

async function supabaseJson(env, path, accessToken) {
  return supabaseRequest(env, path, accessToken);
}

async function verifiedSupabaseUser(env, accessToken) {
  const body = await supabaseJson(env, "/auth/v1/user", accessToken);
  if (!body?.id || !body?.email) throw new Error("Continue with Google in Hearth before connecting Hercules Pro.");
  return { id: String(body.id), email: String(body.email).toLowerCase() };
}

async function verifiedMembership(env, claims) {
  const query = new URLSearchParams({
    environment: `eq.${claims.environment}`,
    household_id: `eq.${claims.householdId}`,
    member_id: `eq.${claims.memberId}`,
    auth_user_id: `eq.${claims.authUserId}`,
    active: "eq.true",
    select: "household_id,member_id,auth_user_id,role",
    limit: "1",
  });
  const rows = await supabaseJson(env, `/rest/v1/continuity_memberships?${query}`, claims.supabaseAccessToken);
  if (!Array.isArray(rows) || !rows.length) throw new Error("This Google account is no longer linked to that Hearth member.");
  return rows[0];
}

function parsePayload(row) {
  if (!row?.payload) return null;
  return typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
}

function overlayPersonal(household, personal, memberId) {
  if (!personal || personal.kind !== "personal" || personal.memberId !== memberId) return household;
  const txIds = new Set((personal.transactions || []).map((row) => row.id));
  const shiftIds = new Set((personal.shifts || []).map((row) => row.id));
  const goals = (personal.goals || []).filter((row) => !row.shared && row.ownerMemberId === memberId);
  const goalIds = new Set(goals.map((row) => row.id));
  return ensureHouseholdShape({
    ...household,
    transactions: [
      ...household.transactions.filter((row) => !((row.visibility === "personal" && row.createdBy === memberId) || txIds.has(row.id))),
      ...(personal.transactions || []).filter((row) => row.visibility === "personal" && row.createdBy === memberId),
    ],
    shifts: [
      ...household.shifts.filter((row) => !((row.visibility === "personal" && row.createdBy === memberId) || shiftIds.has(row.id))),
      ...(personal.shifts || []).filter((row) => row.visibility === "personal" && row.createdBy === memberId),
    ],
    goals: [...household.goals.filter((row) => !goalIds.has(row.id) && (row.shared || row.ownerMemberId !== memberId)), ...goals],
    goalContributions: [...household.goalContributions.filter((row) => !goalIds.has(row.goalId)), ...(personal.goalContributions || []).filter((row) => goalIds.has(row.goalId))],
    goalPurchases: [...household.goalPurchases.filter((row) => !goalIds.has(row.goalId)), ...(personal.goalPurchases || []).filter((row) => goalIds.has(row.goalId))],
    ...(personal.herculesProPermissions
      ? { herculesProPermissions: shapeHerculesProPermissions(personal.herculesProPermissions) }
      : {}),
  });
}

async function loadBooks(env, claims) {
  await verifiedMembership(env, claims);
  const sharedQuery = new URLSearchParams({
    environment: `eq.${claims.environment}`,
    household_id: `eq.${claims.householdId}`,
    select: "payload",
    limit: "1",
  });
  const personalQuery = new URLSearchParams({
    environment: `eq.${claims.environment}`,
    household_id: `eq.${claims.householdId}`,
    member_id: `eq.${claims.memberId}`,
    select: "payload",
    limit: "1",
  });
  const [sharedRows, personalRows] = await Promise.all([
    supabaseJson(env, `/rest/v1/household_snapshots?${sharedQuery}`, claims.supabaseAccessToken),
    supabaseJson(env, `/rest/v1/continuity_personal_snapshots?${personalQuery}`, claims.supabaseAccessToken),
  ]);
  const shared = parsePayload(sharedRows?.[0]);
  if (!shared) throw new Error("Hearth could not find this household's cloud ledger.");
  const personal = parsePayload(personalRows?.[0]);
  return {
    books: overlayPersonal(ensureHouseholdShape(shared), personal, claims.memberId),
    personal: personal?.kind === "personal" && personal.memberId === claims.memberId
      ? { ...personal, herculesProPermissions: shapeHerculesProPermissions(personal.herculesProPermissions) }
      : emptyPersonal(claims.memberId),
  };
}

function toolDefinitions() {
  return TOOL_CATALOG.map(([name, description]) => ({
    name,
    title: name.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
    description: `${description} Read-only; uses posted Hearth books and never changes them.`,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(TOOL_PROPERTY_NAMES[name].map((property) => [property, TOOL_PROPERTIES[property]])),
      ...(TOOL_REQUIRED_PROPERTIES[name] ? { required: TOOL_REQUIRED_PROPERTIES[name] } : {}),
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["hearth.read"] }],
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["hearth.read"] }] },
  }));
}

const WRITE_INPUT_PROPERTIES = {
  view: { type: "string", enum: ["personal", "household"], description: "Exact ledger to change. Required; never inferred." },
  type: { type: "string", enum: ["expense", "income", "refund", "transfer"] },
  date: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", description: "Toronto civil posting date." },
  amountCents: { type: "integer", minimum: 1, maximum: 100000000000, description: "Exact amount in integer CAD cents." },
  accountId: { type: "string", maxLength: 100 },
  subcategoryId: { type: "string", maxLength: 100 },
  fromAccountId: { type: "string", maxLength: 100 },
  toAccountId: { type: "string", maxLength: 100 },
  note: { type: "string", maxLength: 160 },
  place: { type: "string", maxLength: 120 },
};

function hasScope(claims, scope) {
  return String(claims?.scope || "").split(/\s+/).filter(Boolean).includes(scope);
}

function normalizeRequestedScopes(value) {
  const requested = String(value || "hearth.read").split(/\s+/).filter(Boolean);
  if (!requested.includes("hearth.read") || requested.some((scope) => scope !== "hearth.read" && scope !== "hearth.write")) {
    throw new Error("Hercules Pro supports hearth.read and the optional hearth.write permission.");
  }
  return requested.includes("hearth.write") ? "hearth.read hearth.write" : "hearth.read";
}

function writeToolDefinitions(claims) {
  const options = {
    name: "transaction_write_options",
    title: "Transaction Write Options",
    description: "List the exact active Hearth account and category IDs required to prepare a transaction. Read-only; call this instead of guessing identifiers.",
    inputSchema: {
      type: "object",
      properties: { view: WRITE_INPUT_PROPERTIES.view, type: WRITE_INPUT_PROPERTIES.type },
      required: ["view", "type"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["hearth.read"] }],
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["hearth.read"] }] },
  };
  void claims;
  const writeSecurity = [{ type: "oauth2", scopes: ["hearth.read", "hearth.write"] }];
  return [options, {
    name: "prepare_transaction",
    title: "Preview a Hearth Transaction",
    description: "Validate and preview one expense, income, refund, or transfer without changing Hearth. Use only after the person asks to post. Return the exact preview and wait for explicit confirmation before calling confirm_transaction.",
    inputSchema: {
      type: "object",
      properties: WRITE_INPUT_PROPERTIES,
      required: ["view", "type", "date", "amountCents"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    securitySchemes: writeSecurity,
    _meta: { securitySchemes: writeSecurity },
  }, {
    name: "confirm_transaction",
    title: "Confirm and Post a Hearth Transaction",
    description: "Post exactly one previously prepared Hearth transaction. Consequential cloud write: call only after showing the complete preview and receiving explicit confirmation in the current ChatGPT conversation. Never use this tool to infer consent.",
    inputSchema: {
      type: "object",
      properties: {
        confirmationToken: { type: "string", minLength: 40, maxLength: 20000, description: "Opaque token returned by prepare_transaction." },
        confirmed: { type: "boolean", const: true, description: "True only after the person explicitly confirms the shown preview." },
      },
      required: ["confirmationToken", "confirmed"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    securitySchemes: writeSecurity,
    _meta: { securitySchemes: writeSecurity },
  }];
}

function allToolDefinitions(claims) {
  return [...toolDefinitions(), ...writeToolDefinitions(claims)];
}

function mcpSuccess(id, structuredContent) {
  return json({ jsonrpc: "2.0", id, result: {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: false,
  } });
}

function mcpFailure(id, error, fallback) {
  return json({ jsonrpc: "2.0", id, result: {
    content: [{ type: "text", text: error instanceof Error ? error.message : fallback }],
    isError: true,
  } });
}

function writeOptions(books, args) {
  const type = args?.type;
  const categoryType = type === "refund" ? "expense" : type;
  return {
    ledger: args?.view === "household" ? "household" : "personal",
    currency: books.currency || "CAD",
    accounts: books.accounts.filter((row) => row.active).map((row) => ({ id: row.id, name: row.name, kind: row.kind })),
    categories: type === "transfer" ? [] : books.categories
      .filter((row) => row.active && row.recordType === "category" && row.transactionType === categoryType)
      .map((row) => ({ id: row.id, name: row.name, parentId: row.parentId, transactionType: row.transactionType })),
    rules: type === "transfer"
      ? "Use two different active account IDs."
      : "Use one active accountId and one matching active subcategoryId.",
    readOnly: true,
  };
}

async function publishConfirmedTransaction(env, claims, input) {
  const result = await supabaseRequest(env, "/rest/v1/rpc/publish_hercules_confirmed_write", claims.supabaseAccessToken, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      p_household_id: claims.householdId,
      p_expected_revision: input.expectedRevision,
      p_name: input.shared.name,
      p_timezone: input.shared.timezone,
      p_currency: input.shared.currency,
      p_environment: claims.environment,
      p_invite_phrase: input.shared.inviteCode,
      p_linked: input.shared.linked === true,
      p_revision: input.shared.revision,
      p_last_committed_at: input.shared.lastCommittedAt,
      p_payload: JSON.stringify(input.shared),
      p_snapshot_hash: input.snapshotHash,
      p_ledger_view: input.view,
      p_member_id: claims.memberId,
      p_personal_payload: input.personal ? JSON.stringify(input.personal) : null,
      p_confirmation_id: input.confirmationId,
      p_identity_hash: input.identityHash,
    }),
  });
  const row = Array.isArray(result) ? result[0] : result;
  if (!row?.ok) throw new Error(row?.reason === "stale-revision"
    ? "The cloud ledger changed after the preview. Nothing was posted; prepare a fresh preview."
    : row?.reason === "write-permission-off"
      ? "Hercules Pro writing is off in Hearth. Nothing was posted."
      : row?.reason === "not-member"
        ? "This Google account is no longer linked to that Hearth member. Nothing was posted."
        : `Hearth refused the confirmed write${row?.reason ? ` (${row.reason})` : ""}. Nothing was posted.`);
  return row;
}

function writeTokenMatchesClaims(preview, claims) {
  return preview.environment === claims.environment
    && preview.householdId === claims.householdId
    && preview.memberId === claims.memberId
    && preview.authUserId === claims.authUserId;
}

function torontoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function unauthorized(request) {
  const resource = `${originOf(request)}/.well-known/oauth-protected-resource`;
  return json({ error: "unauthorized", error_description: "Connect the Google account you use for Hearth." }, 401, {
    "WWW-Authenticate": `Bearer resource_metadata="${resource}", scope="hearth.read"`,
  });
}

async function accessClaims(request, env) {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const claims = await unsealPrivate(env, match[1], "access");
    const resource = mcpResource(request);
    const scopes = String(claims.scope || "").split(/\s+/).filter(Boolean);
    if (claims.resource !== resource || claims.aud !== resource || !scopes.includes("hearth.read")) return null;
    return claims;
  } catch {
    return null;
  }
}

async function handleMcp(request, env) {
  const claims = await accessClaims(request, env);
  if (!claims) return unauthorized(request);
  let rpc;
  try {
    rpc = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  if (rpc.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (rpc.method === "initialize") {
    return json({ jsonrpc: "2.0", id: rpc.id, result: {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "hearth-hercules-pro", version: "0.2.0" },
      instructions: hasScope(claims, "hearth.write")
        ? "Hercules is a grounded financial teacher. Read tools never change state. For a requested transaction, call prepare_transaction, show every preview field and duplicate warning, wait for the person's explicit confirmation, then and only then call confirm_transaction. Never infer consent or prepare a delete/payment."
        : "Hercules is a read-only financial teacher. Call tools for all current numbers. Never imply a write occurred.",
    } });
  }
  if (rpc.method === "tools/list") return json({ jsonrpc: "2.0", id: rpc.id, result: { tools: allToolDefinitions(claims) } });
  if (rpc.method === "tools/call") {
    const name = String(rpc.params?.name || "");
    const args = rpc.params?.arguments && typeof rpc.params.arguments === "object" ? rpc.params.arguments : {};
    try {
      if (name === "transaction_write_options") {
        const { books } = await loadBooks(env, claims);
        return mcpSuccess(rpc.id, writeOptions(books, args));
      }
      if (name === "prepare_transaction") {
        if (!hasScope(claims, "hearth.write")) throw new Error("Reconnect Hercules Pro after enabling writing in Hearth.");
        const { books } = await loadBooks(env, claims);
        const prepared = await prepareHerculesProTransaction(books, claims.memberId, args);
        const now = Math.floor(Date.now() / 1000);
        const confirmationId = randomId();
        const confirmationToken = await sealPrivate(env, {
          kind: "write-preview",
          environment: claims.environment,
          householdId: claims.householdId,
          memberId: claims.memberId,
          authUserId: claims.authUserId,
          baseRevision: books.revision,
          confirmationId,
          input: prepared.input,
          identityHash: prepared.identityHash,
          postedIds: prepared.postedIds,
          postedTransactions: prepared.postedTransactions,
          preview: prepared.preview,
          iat: now,
          exp: now + WRITE_PREVIEW_TTL_SECONDS,
        });
        return mcpSuccess(rpc.id, {
          status: "confirmation-required",
          preview: prepared.preview,
          confirmationToken,
          expiresInSeconds: WRITE_PREVIEW_TTL_SECONDS,
          requiresExplicitConfirmation: true,
          confirmationPrompt: `Post this ${prepared.preview.amount} ${prepared.preview.type} to the ${prepared.preview.ledger} ledger on ${prepared.preview.date}?`,
          postedNothing: true,
          readOnly: true,
        });
      }
      if (name === "confirm_transaction") {
        if (!hasScope(claims, "hearth.write")) throw new Error("Reconnect Hercules Pro after enabling writing in Hearth.");
        if (args.confirmed !== true) throw new Error("Nothing was posted because explicit confirmation was not supplied.");
        const preview = await unsealPrivate(env, String(args.confirmationToken || ""), "write-preview");
        if (!writeTokenMatchesClaims(preview, claims)) throw new Error("This confirmation belongs to a different Hearth member or household.");
        const { books } = await loadBooks(env, claims);
        if (!herculesProWriteAllowed(books, preview.input.view)) {
          throw new Error(`Hercules Pro ${preview.input.view} writing was turned off in Hearth. Nothing was posted.`);
        }
        const existingReceipt = findReceipt(books, preview.confirmationId);
        if (existingReceipt) {
          if (existingReceipt.identityHash !== preview.identityHash) throw new Error("Hearth found a mismatched confirmation receipt. Nothing else was posted.");
          const posted = new Set(books.transactions.map((row) => row.id));
          const missing = preview.postedIds.filter((id) => !posted.has(id));
          if (preview.input.view === "personal" && missing.length) {
            const recovered = ensureHouseholdShape({
              ...books,
              transactions: [
                ...books.transactions,
                ...preview.postedTransactions.filter((row) => missing.includes(row.id)),
              ],
            });
            assertAcceptableBooks(recovered);
            const shared = herculesProSharedProjection(books, claims.memberId);
            await publishConfirmedTransaction(env, claims, {
              expectedRevision: preview.baseRevision,
              shared,
              personal: personalReplicaForMember(recovered, claims.memberId),
              snapshotHash: await financialAuditHash(shared),
              view: "personal",
              confirmationId: preview.confirmationId,
              identityHash: preview.identityHash,
            });
          }
          return mcpSuccess(rpc.id, {
            status: "posted-exactly-once",
            duplicateConfirmation: true,
            ledger: preview.input.view,
            transactionIds: existingReceipt.postedIds,
            revision: existingReceipt.revision,
            confirmationId: preview.confirmationId,
            postedExactlyOnce: true,
            postedNothing: false,
            readOnly: false,
          });
        }
        if (books.revision !== preview.baseRevision) {
          throw new Error("The cloud ledger changed after the preview. Nothing was posted; prepare a fresh preview.");
        }
        const generated = await prepareHerculesProTransaction(books, claims.memberId, preview.input);
        const generatedIds = new Set(generated.postedIds);
        const candidate = ensureHouseholdShape({
          ...generated.candidate,
          transactions: [
            ...generated.candidate.transactions.filter((row) => !generatedIds.has(row.id)),
            ...preview.postedTransactions,
          ],
        });
        const prepared = {
          ...generated,
          candidate,
          postedIds: preview.postedIds,
          postedTransactions: preview.postedTransactions,
          identityHash: await commandIdentityHash(books, candidate, preview.postedIds),
          preview: preview.preview,
        };
        if (prepared.identityHash !== preview.identityHash) {
          throw new Error("The exact proposed transaction no longer matches the books. Nothing was posted; prepare it again.");
        }
        const accepted = await acceptPreparedHerculesProTransaction(
          books,
          prepared,
          claims.memberId,
          preview.confirmationId,
        );
        const published = await publishConfirmedTransaction(env, claims, {
          expectedRevision: preview.baseRevision,
          shared: accepted.sharedProjection,
          personal: accepted.personalProjection,
          snapshotHash: accepted.snapshotHash,
          view: preview.input.view,
          confirmationId: preview.confirmationId,
          identityHash: preview.identityHash,
        });
        return mcpSuccess(rpc.id, {
          status: "posted-exactly-once",
          duplicateConfirmation: published.duplicate === true,
          ledger: preview.input.view,
          transactionIds: prepared.postedIds,
          revision: accepted.accepted.revision,
          confirmationId: preview.confirmationId,
          postedExactlyOnce: true,
          postedNothing: false,
          readOnly: false,
        });
      }
      if (!TOOL_CATALOG.some(([toolName]) => toolName === name)) {
        return json({ jsonrpc: "2.0", id: rpc.id, error: { code: -32602, message: "Unknown Hercules tool." } }, 400);
      }
      const { books } = await loadBooks(env, claims);
      const view = args.view === "household" ? "household" : "personal";
      const run = executeHerculesReadToolPlan(books, { calls: [{ id: String(rpc.id ?? randomId()), name, args }] }, torontoToday(), {
        memberId: claims.memberId,
        view,
      });
      const result = run.results[0];
      const structuredContent = {
        status: result?.status || "empty",
        answer: result?.sentence || run.talk.spoken,
        facts: result?.facts || [],
        ledger: view,
        householdId: claims.householdId,
        memberId: claims.memberId,
        asOf: torontoToday(),
        accountingBasis: "posted-recognized-journal",
        currency: books.currency || "CAD",
        timeZone: books.timezone || "America/Toronto",
        teachingContract: {
          order: ["direct-answer", "posted-evidence", "plain-language-lesson", "limitations", "human-next-step"],
          clickableSources: true,
          projectionFactsLabeled: true,
          writeAuthority: "none",
        },
        readOnly: true,
      };
      return mcpSuccess(rpc.id, structuredContent);
    } catch (error) {
      return mcpFailure(rpc.id, error, "Hearth could not complete that tool call.");
    }
  }
  return json({ jsonrpc: "2.0", id: rpc.id ?? null, error: { code: -32601, message: "Method not found" } }, 404);
}

async function registerClient(request, env) {
  const body = await request.json().catch(() => null);
  const redirects = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String).filter((uri) => /^https:\/\//.test(uri)).slice(0, 8) : [];
  if (!redirects.length) return json({ error: "invalid_client_metadata" }, 400);
  const now = Math.floor(Date.now() / 1000);
  const clientId = await seal(env, { kind: "client", redirectUris: redirects, clientName: String(body?.client_name || "ChatGPT"), iat: now, exp: now + 365 * 24 * 60 * 60 });
  return json({ client_id: clientId, client_id_issued_at: now, redirect_uris: redirects, token_endpoint_auth_method: "none" }, 201);
}

async function authorize(request, env) {
  const url = new URL(request.url);
  try {
    const clientId = url.searchParams.get("client_id") || "";
    const client = await unseal(env, clientId, "client");
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    if (!client.redirectUris.includes(redirectUri)) throw new Error("Redirect mismatch.");
    if (url.searchParams.get("response_type") !== "code") throw new Error("Only authorization code is supported.");
    if (url.searchParams.get("code_challenge_method") !== "S256" || !url.searchParams.get("code_challenge")) throw new Error("PKCE S256 is required.");
    const resource = url.searchParams.get("resource") || "";
    if (resource !== mcpResource(request)) throw new Error("The OAuth resource must be this Hearth MCP server.");
    const scope = normalizeRequestedScopes(url.searchParams.get("scope"));
    const now = Math.floor(Date.now() / 1000);
    const approvalRequest = await seal(env, {
      kind: "authorize",
      clientId,
      redirectUri,
      state: url.searchParams.get("state") || "",
      challenge: url.searchParams.get("code_challenge"),
      scope,
      resource,
      iat: now,
      exp: now + AUTH_REQUEST_TTL_SECONDS,
    });
    const approval = new URL("/", originOf(request));
    approval.searchParams.set("herculesProAuthorize", approvalRequest);
    return Response.redirect(approval.toString(), 302);
  } catch (error) {
    return json({ error: "invalid_request", error_description: error instanceof Error ? error.message : "Invalid authorization request." }, 400);
  }
}

async function approve(request, env) {
  const body = await request.json().catch(() => null);
  try {
    const authorization = await unseal(env, body?.authorizationRequest, "authorize");
    if (authorization.resource !== mcpResource(request)) throw new Error("The authorization request is for a different resource.");
    const authorizedScope = normalizeRequestedScopes(authorization.scope);
    if (body?.deny === true) {
      const redirect = new URL(authorization.redirectUri);
      redirect.searchParams.set("error", "access_denied");
      redirect.searchParams.set("error_description", "The person chose not to connect Hearth.");
      if (authorization.state) redirect.searchParams.set("state", authorization.state);
      return json({ ok: true, redirect: redirect.toString() });
    }
    const environment = body?.environment === "production" ? "production" : "development";
    if (environment === "production" && String(env?.HERCULES_PRO_ALLOW_PRODUCTION || "") !== "true") {
      throw new Error("Hercules Pro is Development-only until the September security cutover.");
    }
    const user = await verifiedSupabaseUser(env, String(body?.supabaseAccessToken || ""));
    const membershipClaims = {
      environment,
      householdId: String(body?.householdId || ""),
      memberId: String(body?.memberId || ""),
      authUserId: user.id,
      supabaseAccessToken: String(body?.supabaseAccessToken || ""),
      supabaseRefreshToken: String(body?.supabaseRefreshToken || ""),
    };
    if (!membershipClaims.supabaseRefreshToken) throw new Error("Reconnect Google in Hearth, then try again.");
    await verifiedMembership(env, membershipClaims);
    if (authorizedScope.includes("hearth.write")) {
      const { books } = await loadBooks(env, membershipClaims);
      if (!herculesProWriteAllowed(books, "personal") && !herculesProWriteAllowed(books, "household")) {
        throw new Error("Turn on at least one Hercules Pro writing permission in Hearth More before connecting ChatGPT with write access.");
      }
    }
    const now = Math.floor(Date.now() / 1000);
    const jti = randomId();
    const code = await sealPrivate(env, {
      kind: "code",
      ...membershipClaims,
      email: user.email,
      clientId: authorization.clientId,
      redirectUri: authorization.redirectUri,
      challenge: authorization.challenge,
      resource: authorization.resource,
      scope: authorizedScope,
      jti,
      iat: now,
      exp: now + CODE_TTL_SECONDS,
    });
    const redirect = new URL(authorization.redirectUri);
    redirect.searchParams.set("code", code);
    if (authorization.state) redirect.searchParams.set("state", authorization.state);
    return json({ ok: true, redirect: redirect.toString() });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Hercules Pro connection failed." }, 400);
  }
}

async function useCodeOnce(env, jti, exp) {
  const key = `oauth-code:${jti}`;
  if (env?.HERCULES_PRO_AUTH) {
    const used = await env.HERCULES_PRO_AUTH.get(key);
    if (used) return false;
    await env.HERCULES_PRO_AUTH.put(key, "used", { expirationTtl: Math.max(60, exp - Math.floor(Date.now() / 1000)) });
    return true;
  }
  if (memoryCodes.has(key)) return false;
  memoryCodes.add(key);
  if (memoryCodes.size > 1024) memoryCodes.delete(memoryCodes.values().next().value);
  return true;
}

async function issueTokens(env, claims, clientId) {
  const now = Math.floor(Date.now() / 1000);
  const common = {
    environment: claims.environment,
    householdId: claims.householdId,
    memberId: claims.memberId,
    authUserId: claims.authUserId,
    clientId,
    scope: normalizeRequestedScopes(claims.scope),
    resource: claims.resource,
    aud: claims.resource,
    supabaseAccessToken: claims.supabaseAccessToken,
  };
  return {
    access_token: await sealPrivate(env, { kind: "access", ...common, iat: now, exp: now + ACCESS_TTL_SECONDS }),
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: await sealPrivate(env, {
      kind: "refresh",
      ...common,
      supabaseRefreshToken: claims.supabaseRefreshToken,
      iat: now,
      exp: now + REFRESH_TTL_SECONDS,
    }),
    scope: normalizeRequestedScopes(claims.scope),
  };
}

async function refreshSupabaseTokens(env, refreshToken) {
  const config = supabaseConfig(env);
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.access_token || !body?.refresh_token) throw new Error("The Google-linked Hearth session expired. Connect Hercules Pro again.");
  return { supabaseAccessToken: body.access_token, supabaseRefreshToken: body.refresh_token };
}

async function token(request, env) {
  const form = new URLSearchParams(await request.text());
  try {
    const grant = form.get("grant_type");
    const clientId = form.get("client_id") || "";
    const resource = form.get("resource") || "";
    if (resource !== mcpResource(request)) throw new Error("The token request is for a different resource.");
    await unseal(env, clientId, "client");
    if (grant === "authorization_code") {
      const code = await unsealPrivate(env, form.get("code"), "code");
      if (code.clientId !== clientId || code.redirectUri !== form.get("redirect_uri") || code.resource !== resource) throw new Error("Authorization code does not match this client or resource.");
      if (await sha256Base64Url(form.get("code_verifier") || "") !== code.challenge) throw new Error("PKCE verification failed.");
      if (!await useCodeOnce(env, code.jti, code.exp)) throw new Error("Authorization code was already used.");
      return json(await issueTokens(env, code, clientId));
    }
    if (grant === "refresh_token") {
      const refresh = await unsealPrivate(env, form.get("refresh_token"), "refresh");
      if (refresh.clientId !== clientId || refresh.resource !== resource || refresh.aud !== resource) throw new Error("Refresh token does not match this client or resource.");
      const renewed = await refreshSupabaseTokens(env, refresh.supabaseRefreshToken);
      const claims = { ...refresh, ...renewed };
      await verifiedMembership(env, claims);
      return json(await issueTokens(env, claims, clientId));
    }
    throw new Error("Unsupported grant type.");
  } catch (error) {
    return json({ error: "invalid_grant", error_description: error instanceof Error ? error.message : "Token exchange failed." }, 400);
  }
}

async function handlePermissions(request, env) {
  try {
    const url = new URL(request.url);
    const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
    if (!match) return json({ ok: false, error: "Continue with Google in Hearth first." }, 401);
    const environment = url.searchParams.get("environment") === "production" ? "production" : "development";
    if (environment === "production" && String(env?.HERCULES_PRO_ALLOW_PRODUCTION || "") !== "true") {
      throw new Error("Hercules Pro is Development-only until the September security cutover.");
    }
    const user = await verifiedSupabaseUser(env, match[1]);
    const claims = {
      environment,
      householdId: String(url.searchParams.get("householdId") || ""),
      memberId: String(url.searchParams.get("memberId") || ""),
      authUserId: user.id,
      supabaseAccessToken: match[1],
    };
    await verifiedMembership(env, claims);
    const loaded = await loadBooks(env, claims);
    const current = shapeHerculesProPermissions(loaded.personal.herculesProPermissions);
    if (request.method === "GET") return json({ ok: true, permissions: current });
    if (request.method !== "PUT") return json({ ok: false, error: "Use GET or PUT." }, 405, { Allow: "GET, PUT" });
    const body = await request.json().catch(() => null);
    if (typeof body?.personalWrite !== "boolean" || typeof body?.householdWrite !== "boolean") {
      throw new Error("Both Personal and Household write choices are required.");
    }
    const permissions = shapeHerculesProPermissions({
      personalWrite: body.personalWrite,
      householdWrite: body.householdWrite,
      updatedAt: new Date().toISOString(),
    });
    const personal = { ...loaded.personal, herculesProPermissions: permissions };
    await supabaseRequest(
      env,
      "/rest/v1/continuity_personal_snapshots?on_conflict=environment,household_id,member_id",
      match[1],
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          environment,
          household_id: claims.householdId,
          member_id: claims.memberId,
          revision: loaded.books.revision,
          payload: JSON.stringify(personal),
          updated_at: permissions.updatedAt,
        }),
      },
    );
    return json({ ok: true, permissions });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Hercules Pro permissions could not be saved." }, 400);
  }
}

export async function handleHerculesPro(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/.well-known/oauth-protected-resource" || url.pathname === "/.well-known/oauth-protected-resource/mcp") {
    return json({
      resource: `${url.origin}/mcp`,
      authorization_servers: [url.origin],
      scopes_supported: ["hearth.read", "hearth.write"],
      bearer_methods_supported: ["header"],
      resource_name: "Hercules Pro Hearth books",
      resource_documentation: "https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/blob/main/docs/HERCULES_PRO.md",
      resource_policy_uri: "https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/blob/main/docs/HERCULES_PRO_PRIVACY.md",
      resource_tos_uri: "https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/blob/main/docs/HERCULES_PRO_TERMS.md",
    });
  }
  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return json({
      issuer: url.origin,
      authorization_endpoint: `${url.origin}/oauth/authorize`,
      token_endpoint: `${url.origin}/oauth/token`,
      registration_endpoint: `${url.origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["hearth.read", "hearth.write"],
    });
  }
  if (url.pathname === "/hercules-pro/permissions") return handlePermissions(request, env);
  if (url.pathname === "/oauth/register" && request.method === "POST") return registerClient(request, env);
  if (url.pathname === "/oauth/authorize" && request.method === "GET") return authorize(request, env);
  if (url.pathname === "/oauth/approve" && request.method === "POST") return approve(request, env);
  if (url.pathname === "/oauth/token" && request.method === "POST") return token(request, env);
  if (url.pathname === "/mcp" && request.method === "POST") return handleMcp(request, env);
  if (url.pathname === "/mcp") {
    const claims = await accessClaims(request, env);
    return claims ? new Response(null, { status: 405, headers: { Allow: "POST" } }) : unauthorized(request);
  }
  return null;
}

export const herculesProTest = { seal, unseal, sealPrivate, unsealPrivate, sha256Base64Url, toolDefinitions, overlayPersonal };
