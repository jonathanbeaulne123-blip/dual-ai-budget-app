# Hercules Pro — calculations and features inventory

Status: living inventory for D-136 / D-137 / D-138. Count on `tools/list` is **64** when write-scope tools are listed (61 read + 3 write-path). Free in-app Hercules shares the same read catalog through `herculesTools.ts`.

**Announcement rule (D-138):** every successful MCP answer includes `usedTool` and prefixes the answer with `I used \`tool_name\`. …`. The teacher skill must name the tool in ordinary language too.

## Permissions and product surface

| Feature | Notes |
|---|---|
| Free Hercules (in-app) | Always available; same read tools; local/offline fallback |
| Hercules Pro (ChatGPT MCP) | Optional companion; OAuth links Google/Supabase member |
| Personal vs Household view | Every read takes `view`; Personal never reveals partner-personal |
| Confirmed writes (opt-in) | Off by default; `hearth.write` scope + More → permissions |
| Production gate | Refused unless `HERCULES_PRO_ALLOW_PRODUCTION=true` |
| Development-data window | Through **2026-09-30**, hosted Development information is disposable and may remain openly readable/writable to accelerate continuity work. Credentials and secrets are never disposable. See `HERCULES_PRO_PRIVACY.md` / `CLOUD_CONTINUITY.md`. |
| Currency / books civil TZ | CAD integer cents; America/Toronto |

## Write-path tools (3)

| Tool | What it calculates / does | Posts? |
|---|---|---|
| `transaction_write_options` | Lists exact active accounts/categories/types for a ledger | No |
| `prepare_transaction` | Validates one expense/income/refund/transfer; sealed preview | No |
| `confirm_transaction` | Exactly-once post after explicit preview confirmation | Yes, once |

Unsupported: delete, edit, reverse, bill/card/bank pay, settings, shifts, imports, bulk writes.

## Core ledger reads (16)

| Tool | Calculation / feature |
|---|---|
| `account_balance` | One visible account balance or account list |
| `find_transactions` | Posted rows by merchant/account/category/member/period/amount |
| `spending_summary` | Expenses less refunds for a period |
| `income_summary` | Posted income for a period |
| `compare_spending` | Spending delta between two named periods |
| `bills_due` | Repeating bills due within 1–90 days (projection cadence) |
| `shift_summary` | Posted shifts: hours, wages, tips, paid breaks |
| `goal_progress` | Savings-jar progress |
| `money_owed` | Outstanding claims / receivables |
| `cash_position` | Sit-down cash-like leftover |
| `budget_status` | Posted actuals vs monthly plan |
| `category_breakdown` | Ranked spending or income categories |
| `credit_card_status` | Balance, statement, minimum, due, utilization |
| `net_worth` | Assets − liabilities |
| `audit_health` | Deterministic books opinion + finding count |
| `duplicate_review` | Potential-duplicate pairs (never deletes) |

## Accounting statements (10)

| Tool | Calculation / feature |
|---|---|
| `balance_sheet` | Assets, liabilities, equity, equation check |
| `income_statement` | Income, expenses, net income for a month |
| `cash_flow_statement` | Operating / card / debt-paydown / investing activity |
| `trial_balance` | Debit and credit balances from recognized journal |
| `general_ledger` | Recent recognized journal activity |
| `account_activity` | Account register with running balance |
| `journal_entry_detail` | Both sides of one journal entry |
| `changes_in_net_worth` | Opening NW → net income → closing NW |
| `period_comparison` | Month vs prior month income/expense/net |
| `explain_balance` | How debits/credits produced one balance |

## Accounting controls (10)

| Tool | Calculation / feature |
|---|---|
| `reconciliation_status` | Latest bank-reconciliation result |
| `activity_since_reconciliation` | Posted rows after last statement reconcile |
| `uncategorized_activity` | Posted rows missing a valid category |
| `duplicate_exposure` | Unresolved duplicate candidates summary |
| `missing_periods` | Empty months between first post and today |
| `opening_balance_review` | First recognized activity per account |
| `period_close_readiness` | Integrity / duplicate / reconcile blockers |
| `source_document_coverage` | Import/source provenance coverage |
| `integrity_findings` | Deterministic books-health findings |
| `audit_trail` | Latest immutable household activity records |

## Forecasts and scenarios (10)

| Tool | Calculation / feature |
|---|---|
| `budget_variance` | Category actual vs budget |
| `cash_runway` | Days of cash from recent spending pace |
| `bill_coverage` | Cash-like vs scheduled bills in a horizon |
| `debt_projection` | Card payoff time at stated/min payment |
| `credit_utilization` | Per-card and aggregate utilization |
| `savings_rate` | Posted income retained after spending |
| `income_stability` | Variation in monthly income (2–12 months) |
| `spending_trend` | Monthly spending totals (2–12 months) |
| `scenario_analysis` | Hypothetical purchase vs cash + bills |
| `forecast_accuracy` | Budget forecast vs posted actuals |

## Living teacher (8)

| Tool | Calculation / feature |
|---|---|
| `explain_transaction` | Debit/credit/recognition/source of one row |
| `explain_accounting_equation` | Assets = liabilities + equity lesson |
| `explain_debit_credit` | What debits/credits do to a chart account |
| `explain_financial_statement` | Purpose + headline figures for one statement |
| `trace_number` | Trace a figure to posted source rows |
| `compare_accounting_treatments` | Contrast two confused treatments |
| `explain_variance` | One category’s actual-vs-budget story |
| `explain_transfer` | Both journal legs of a transfer |

## Shift Oracle (D-137) — 4

| Tool | Calculation / feature |
|---|---|
| `tip_oracle` | Seeded Monte Carlo tip p10 / p50 / p90 + dry-streak reserve |
| `shift_outlook` | Weekday × meal × hours tip range; optional weather glass |
| `tip_schedule_sim` | Cadence advice; totals probability-weighted by weekday frequency |
| `tax_milk_plan` | Educational tax-milk + peak buffer + leftover (never posts) |

## Sim + Review packs (D-138) — 3

| Tool | Calculation / feature |
|---|---|
| `cash_cinema` | 13-week forward cash ribbon: tip floor/typical + wages + bills + card mins |
| `what_if_desk` | Named unposted scenarios: cut dinner shift, extra card pay, purchase, tax-milk boost |
| `year_review` | Season Replay: tip months, income, spend, budget misses, shift count |

## Shared product features (not MCP tool names)

- Teaching ladder: name the tool → direct answer → evidence → lesson → limits → next step
- Typed clickable source facts (`HerculesGroundedFact`)
- Projection facts labelled separately from posted-recognized-journal
- Personal/Household membership recheck on every call
- Encrypted OAuth tokens; Supabase session refreshed server-side
- Plugin skill: `plugins/hercules-pro/skills/hearth-financial-teacher/SKILL.md`

## Kill criteria

- Treat a projection as posted income → remove or relabel the tool
- Any draft posts without Confirm / sealed preview → refuse and rip write path
- Partner-personal leakage through Household view → refuse and fix before ship
