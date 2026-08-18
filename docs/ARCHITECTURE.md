# Architecture

## Current system

The product currently consists of:

- A Google Sheets workbook containing the canonical transaction ledger, configuration tables, calculated views, and dashboards.
- A bound Google Apps Script project containing menu tools, dialogs, data entry, recomputation, diagnostics, release notes, and data-health logic.
- Local ODS exports used as recovery and offline inspection snapshots.
- This Git repository containing the canonical source code, tests, architecture, decisions, prompts, and release preparation.

## Environment flow

```text
Git feature work
      |
      v
Development Apps Script + Development Sheet
      |
      | verified release candidate + Jonathan approval
      v
Production Apps Script + Production Sheet
```

The repository root will eventually link only to the development Apps Script project. Production deployment must be a separate, explicit release operation.

## Application layers

1. **Ledger and configuration data** — Transactions, Categories, Members, Accounts, Budget Plan, recurring definitions, categorization rules, and future goal/scenario tables.
2. **Pure calculations** — Budget, dashboard, income-history, forecasting, goal progress, and insight calculations using plain inputs and outputs.
3. **Sheet adapters** — Read and write Sheets in batches and map headers/IDs to application data.
4. **User interfaces** — Apps Script dialogs and Sheet dashboards now; mobile-friendly web views later.
5. **Diagnostics and release controls** — Health checks, data dictionary, freshness, tests, release notes, and environment/version markers.

## Data-model rules

- Keep one canonical Transactions ledger.
- Represent transfers with an explicit transaction type and exclude them from both income and expense totals.
- Represent variable ownership with a Transaction Splits child table rather than a fixed number of owner columns.
- Represent forecast assumptions and scenarios as data tables rather than hardcoded branches.
- Keep stable IDs independent of display names.
- Resolve refunds, reimbursements, credit-card payments, and other proposed zero-sum activity through explicit transaction semantics rather than a catch-all category.
- Keep recurring definitions separate from posted transactions.
- Record all dates and month keys using the spreadsheet time zone `America/Toronto`.

## Duplicate review boundary

- `Duplicate_Key` is the deterministic transaction fingerprint and remains independent of duplicate-review decisions.
- `Potential_Duplicate_Flag` is a derived review aid. From v0.0.26 onward it is recomputed from the real ledger extent by a pure O(n) grouping function plus one batched column read/write; it is not a per-row range formula.
- `Is_Duplicate` is the separately reviewed financial control. Only this field determines whether Budget, Dashboard, and Income History calculations exclude a transaction.
- Add Transaction, Add Shift, and direct edits to duplicate-key inputs refresh potential flags. A manual refresh provides recovery after bulk or external operations.
- Duplicate matching is exact and case-insensitive after `Duplicate_Key` generation; it does not use spreadsheet wildcard criteria.

## Goals and privacy

Shared goals may appear on both dashboards. A hidden tab is not a security boundary: any editor can unhide or inspect it. If personal goals must be genuinely private, they require separate access-controlled storage or the future application's authorization layer.

## Forecasting direction

Forecasting should support multiple horizons and named scenarios. Inputs may include:

- Trailing averages
- Same period from the prior year
- Recurring transactions
- Fixed and variable income assumptions
- User overrides
- Confidence or data-quality indicators

The initial implementation should remain deterministic and explainable.

## Bank import boundary

Preserve Raw Transactions, Import Batches, Accounts, categorization rules, and deduplication concepts so later Canadian-bank CSV/API adapters can feed the same normalization path. Do not build six bank integrations before core entry, calculation, and reconciliation flows are stable.

## Future application migration

The database migration should occur only after Jonathan and Bianca have stress-tested the Sheets version and are satisfied with its features, insights, and usefulness. Pure calculation functions and stable data contracts should be portable to the future backend.
