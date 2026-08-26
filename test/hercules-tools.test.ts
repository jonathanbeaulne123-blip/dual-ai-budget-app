import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import worker from "../workers/site.js";
import { resetChatRateMemory } from "../workers/herculesGuard.js";
import {
  executeHerculesReadToolPlan,
  herculesLedgerSourcePane,
  catalogHousehold,
  parseHerculesReadToolPlan,
  planHerculesReadTools,
  postEntry,
  seedDemoHousehold,
  shouldPlanHerculesTools,
  transactionsForHerculesSource,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("Hercules read-only tool brain", () => {
  it("accepts only the fixed read catalog and four runtime-validated calls", () => {
    const plan = parseHerculesReadToolPlan({
      calls: [
        { id: "bad", name: "post_entry", args: { amount: 999 } },
        { name: "spending_summary", args: { period: "this_week", category: "groceries", sql: "DROP TABLE journal" } },
        { name: "account_balance", args: { account: "Visa", extra: "ignored" } },
        { name: "bills_due", args: { horizonDays: 9999 } },
        { name: "goal_progress", args: {} },
        { name: "money_owed", args: {} },
      ],
    });
    expect(plan.calls).toHaveLength(4);
    expect(plan.calls.map((call) => call.name)).toEqual(["spending_summary", "account_balance", "bills_due", "goal_progress"]);
    expect(plan.calls[0]?.args).not.toHaveProperty("sql");
    expect(plan.calls[2]?.args.horizonDays).toBe(90);
    expect(parseHerculesReadToolPlan("```json\n{}\n```").calls).toEqual([]);
  });

  it("executes composite questions without mutating the household and attaches exact sources", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const run = executeHerculesReadToolPlan(household, {
      calls: [
        { name: "spending_summary", args: { period: "this_month", category: "groceries" } },
        { name: "bills_due", args: { horizonDays: 30 } },
        { name: "cash_position", args: {} },
      ],
    }, today, { memberId: "MEM-001", view: "household" });
    expect(household).toEqual(before);
    expect(run.results).toHaveLength(3);
    expect(run.talk.facts?.length).toBeGreaterThan(2);
    expect(run.talk.facts?.every((item) => item.source.label)).toBe(true);
    expect(run.talk.spoken).toMatch(/spending|repeating|sit-down/i);
  });

  it("answers deeper budget, category, card, wallet, audit, and duplicate questions locally", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const money = executeHerculesReadToolPlan(household, { calls: [
      { name: "budget_status", args: { period: "current_month" } },
      { name: "category_breakdown", args: { period: "this_month", type: "expense", limit: 5 } },
      { name: "credit_card_status", args: { account: "Visa" } },
      { name: "net_worth", args: {} },
    ] }, today, { memberId: "MEM-001", view: "household" });
    const controls = executeHerculesReadToolPlan(household, { calls: [
      { name: "audit_health", args: {} },
      { name: "duplicate_review", args: { limit: 4 } },
    ] }, today, { memberId: "MEM-001", view: "household" });

    expect(household).toEqual(before);
    expect(money.results.map((result) => result.name)).toEqual([
      "budget_status", "category_breakdown", "credit_card_status", "net_worth",
    ]);
    expect(money.results[0]?.facts.some((fact) => fact.label === "Spending")).toBe(true);
    expect(money.results[1]?.facts.every((fact) => fact.source.categoryId)).toBe(true);
    expect(money.results[2]?.facts.some((fact) => fact.source.accountId)).toBe(true);
    expect(money.results[3]?.sentence).toMatch(/net worth/i);
    expect(controls.results[0]?.sentence).toMatch(/unmodified|debits|books|balance|audit/i);
    expect(controls.results[1]?.sentence).toMatch(/duplicate|review/i);

    const personalWallet = executeHerculesReadToolPlan(household, {
      calls: [{ name: "net_worth", args: {} }, { name: "audit_health", args: {} }],
    }, today, { memberId: "MEM-001", view: "personal" });
    expect(personalWallet.results.every((result) => result.facts.length === 0)).toBe(true);
    expect(personalWallet.talk.spoken).toMatch(/household ledger/i);
  });

  it("builds posted accounting statements and traces every balance back to the journal", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const before = structuredClone(household);
    const statements = executeHerculesReadToolPlan(household, { calls: [
      { name: "balance_sheet", args: {} },
      { name: "income_statement", args: { period: "this_month" } },
      { name: "cash_flow_statement", args: { period: "this_month" } },
      { name: "trial_balance", args: {} },
    ] }, today, { memberId: "MEM-001", view: "household" });
    expect(statements.results.map((result) => result.name)).toEqual([
      "balance_sheet", "income_statement", "cash_flow_statement", "trial_balance",
    ]);
    expect(statements.results[0]?.sentence).toMatch(/accounting equation (holds|does not hold)/i);
    expect(statements.results[1]?.facts.map((row) => row.label)).toEqual(["Income", "Expenses", "Net income"]);
    expect(statements.results[2]?.sentence).toMatch(/card spending.*not cash movement/i);
    expect(statements.results[3]?.sentence).toMatch(/trial balance balances/i);

    const tracing = executeHerculesReadToolPlan(household, { calls: [
      { name: "general_ledger", args: { period: "this_month", limit: 3 } },
      { name: "account_activity", args: { account: "Visa", period: "this_month" } },
      { name: "explain_balance", args: { account: "Visa", period: "this_month" } },
      { name: "period_comparison", args: { period: "this_month" } },
    ] }, today, { memberId: "MEM-001", view: "household" });
    expect(tracing.results[0]?.facts.every((row) => row.source.journalEntryId)).toBe(true);
    expect(tracing.results[1]?.facts.every((row) => row.source.journalEntryId)).toBe(true);
    expect(tracing.results[2]?.sentence).toMatch(/normal credit balance/i);
    expect(tracing.results[3]?.sentence).toMatch(/compared with/i);

    const entryId = tracing.results[0]!.facts[0]!.source.journalEntryId!;
    const detail = executeHerculesReadToolPlan(household, { calls: [
      { name: "journal_entry_detail", args: { entryId } },
      { name: "changes_in_net_worth", args: { period: "this_month" } },
    ] }, today, { memberId: "MEM-001", view: "household" });
    expect(detail.results[0]?.sentence).toMatch(/equal credits/i);
    expect(detail.results[0]?.facts.length).toBeGreaterThanOrEqual(2);
    expect(detail.results[1]?.sentence).toMatch(/roll-forward (reconciles|does not reconcile)/i);
    expect(household).toEqual(before);
  });

  it("never crosses from a personal ledger into the partner's personal rows", () => {
    let household = catalogHousehold("development");
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: 999,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "partner private canary",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: 25,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "own personal groceries",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;

    const own = executeHerculesReadToolPlan(household, {
      calls: [{ name: "spending_summary", args: { period: "this_week" } }],
    }, today, { memberId: "MEM-001", view: "personal" });
    expect(own.talk.spoken).not.toContain("$999");
    expect(own.talk.facts?.some((row) => row.value === "$25.00")).toBe(true);

    const partnerRequest = executeHerculesReadToolPlan(household, {
      calls: [{ name: "spending_summary", args: { period: "this_week", member: "Jonathan" } }],
    }, today, { memberId: "MEM-001", view: "personal" });
    expect(partnerRequest.talk.facts).toEqual([]);
    expect(partnerRequest.talk.spoken).toMatch(/cannot match member/i);
    expect(partnerRequest.talk.spoken).not.toMatch(/999|25\.00/);
  });

  it("finds exact posted rows and gives each one a transaction provenance id", () => {
    const household = seedDemoHousehold({ today, environment: "development" });
    const run = executeHerculesReadToolPlan(household, {
      calls: [{ name: "find_transactions", args: { period: "this_month", merchant: "Tim Hortons", limit: 3 } }],
    }, today, { memberId: "MEM-001", view: "household" });
    expect(run.results[0]?.facts.length).toBeGreaterThan(0);
    expect(run.results[0]?.facts.every((item) => item.source.transactionId)).toBe(true);
    expect(run.results[0]?.facts.length).toBeLessThanOrEqual(3);
    expect(herculesLedgerSourcePane(run.results[0]!.facts[0]!.source)).toBe("register");
    expect(herculesLedgerSourcePane({ route: "ledger", view: "household", label: "Open Visa", accountId: "ACC-VISA" })).toBe("wallet");
  });

  it("keeps summaries type-true and excludes incoming recurrences from bills", () => {
    let household = catalogHousehold("development");
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: 25,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "groceries",
      createdBy: "MEM-001",
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: today,
      type: "income",
      amount: 100,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      note: "pay",
      createdBy: "MEM-001",
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household.recurrences = [
      { ...seedDemoHousehold({ today, environment: "development" }).recurrences[0]!, id: "bill", type: "expense", nextDate: today, active: true },
      { ...seedDemoHousehold({ today, environment: "development" }).recurrences[0]!, id: "pay", type: "income", nextDate: today, active: true },
    ];
    household.shifts = [{
      ...seedDemoHousehold({ today, environment: "development" }).shifts[0]!,
      id: "shift-paid-break",
      date: today,
      wagesCents: 10_000,
      netTipsCents: 5_000,
      paidBreakIncomeCents: 2_000,
      visibility: "household",
    }];

    const run = executeHerculesReadToolPlan(household, { calls: [
      { name: "spending_summary", args: { period: "this_week" } },
      { name: "income_summary", args: { period: "this_week" } },
      { name: "bills_due", args: { horizonDays: 1 } },
      { name: "shift_summary", args: { period: "this_week" } },
    ] }, today, { memberId: "MEM-001", view: "household" });

    expect(run.results[0]?.sentence).toMatch(/\$25\.00 from 1 posted row/);
    expect(run.results[1]?.sentence).toMatch(/\$100\.00 from 1 posted row/);
    expect(transactionsForHerculesSource(household.transactions, run.results[0]!.facts[0]!.source).map((row) => row.type)).toEqual(["expense"]);
    expect(transactionsForHerculesSource(household.transactions, run.results[1]!.facts[0]!.source).map((row) => row.type)).toEqual(["income"]);
    expect(run.results[2]?.facts.map((row) => row.source.recurrenceId)).toEqual(["bill"]);
    expect(run.results[3]?.sentence).toContain("$150.00 of shift income");

    const amountSearch = executeHerculesReadToolPlan(household, { calls: [{
      name: "find_transactions",
      args: { period: "this_week", merchant: "pay", minimumAmountCents: 5_000 },
    }] }, today, { memberId: "MEM-001", view: "household" });
    expect(amountSearch.results[0]?.facts.map((row) => row.value)).toEqual(["$100.00"]);
  });

  it("uses the planner only for financial reads and refuses write-shaped prompts before fetch", async () => {
    expect(shouldPlanHerculesTools("why is chequing lower than last month?")).toBe(true);
    expect(shouldPlanHerculesTools("tell me a cat joke")).toBe(false);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      plan: { calls: [{ name: "compare_spending", args: { currentPeriod: "this_month", comparisonPeriod: "last_month" } }] },
    }), { headers: { "Content-Type": "application/json" } }));
    const plan = await planHerculesReadTools({ message: "why is spending higher?", page: "home", view: "household" }, { fetch: fetcher });
    expect(plan.calls[0]?.name).toBe("compare_spending");
    const refused = await planHerculesReadTools({ message: "please pay the Visa", page: "home", view: "household" }, { fetch: fetcher });
    expect(refused.calls).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("exposes a guarded Worker planner and sanitizes model tool output", async () => {
    resetChatRateMemory();
    const request = new Request("https://hearth-books.jonathan-beaulne123.workers.dev/hercules/plan", {
      method: "POST",
      headers: {
        Origin: "https://hearth-books.jonathan-beaulne123.workers.dev",
        "CF-Connecting-IP": "203.0.113.77",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "compare groceries this month with last month", page: "home", view: "household" }),
    });
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const run = vi.fn(async () => ({ response: JSON.stringify({ calls: [
      { name: "post_entry", args: { amount: 50 } },
      { name: "compare_spending", args: { currentPeriod: "this_month", comparisonPeriod: "last_month", category: "groceries", injected: "DROP TABLE" } },
    ] }) }));
    const response = await worker.fetch(request, {
      AI: {
        run,
      },
      OPENAI_API_KEY: "present-but-disabled",
      ANTHROPIC_API_KEY: "present-but-disabled",
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { plan: { calls: Array<{ name: string; args: Record<string, unknown> }> } };
    expect(body.plan.calls).toHaveLength(1);
    expect(body.plan.calls[0]?.name).toBe("compare_spending");
    expect(body.plan.calls[0]?.args).not.toHaveProperty("injected");
    expect(run).toHaveBeenCalledWith("@cf/google/gemma-4-26b-a4b-it", expect.any(Object));
    expect(upstream).not.toHaveBeenCalled();

    const source = readFileSync("workers/site.js", "utf8");
    expect(source).toContain("https://api.openai.com/v1/responses");
    expect(source).toContain("strict: true");
    expect(source).toContain("store: false");
    expect(source).toContain("HERCULES_ALLOW_PAID_PROVIDERS");
    expect(source).toContain("@cf/google/gemma-4-26b-a4b-it");
    expect(source).not.toMatch(/name:\s*["']post_entry["']/);
  });
});
