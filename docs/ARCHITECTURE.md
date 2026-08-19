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
- From v0.0.27, the full-column flag adapter holds a document-scoped lock from before the ledger extent read through the batched flag write. This serializes cooperating Apps Script recalculations; it does not lock the Google Sheets UI. Add Transaction's broader write transaction uses the same document-lock class in v0.0.29, but the duplicate refresh deliberately runs after that lock is released because Apps Script document locks are not treated as re-entrant.

## Transaction Input trust boundary

- Browser controls and dropdown filtering improve usability but are not authoritative. `addTransaction()` treats every submitted field as untrusted.
- From v0.0.28, `validateAndNormalizeTransactionInput_()` is a pure plain-data boundary for type, Toronto calendar date, whole-cent amount, active subcategory/type agreement, active member, active account, and normalized note data.
- From v0.0.29, Add Transaction performs a fast read-only preflight, then acquires one document lock and repeats the authoritative reference reads, validation, and Toronto date parsing before it reads commit state or writes.
- `planManualTransactionCommit_()` is the pure deterministic write planner. It allocates both stable IDs and captures target extents plus the manual batch's prior/new count from one serialized snapshot.
- `executeManualTransactionCommit_()` journals the batch, Raw Transactions, and Transactions stages before calling an injected Sheet adapter. Any write or verification failure rolls back the linked transaction row, raw row, and batch mutation in reverse order, then re-reads all three targets to prove the original state was restored. A rollback ambiguity or failed recovery verification fails loudly and instructs the user not to retry until the development ledger is inspected.
- The three row-level helper formulas are part of the single Transactions row append. Verification requires exactly one linked raw/transaction pair, the intended batch count, and all three formulas before the lock is released.
- Duplicate-review, Change Log, and summary follow-ups occur only after the durable commit. A duplicate-refresh failure reports that the transaction was saved and requests manual recovery; it does not return a normal submission failure that could cause a duplicate retry.
- The lock serializes cooperating Apps Script writers; it cannot block a person directly editing sheet cells. Add Shift uses its own equivalent source-plus-four-row commit boundary from v0.0.31 because its data shape differs from Add Transaction.

## Add Shift trust and commit boundary

- The Add Shift dialog never calculates financial values locally. `getShiftPreview()` and `addShift()` both call `calcShiftAmounts_()` with named-range settings read from Tip Tracker.
- The preview carries a settings fingerprint. If percentages, bar rounding, or hourly rate change before posting, the server returns a fresh preview and requires another explicit submission.
- `validateAndNormalizeShiftInput_()` treats the browser payload as untrusted: it enforces a real Toronto date, an active member, a single active CAD account, active Wages/Tips categories, nonnegative whole-cent sales/tips, and positive hours no greater than 24.
- `planShiftCommit_()` assigns one stable `SHIFT-000001`-style source ID plus two Raw and two Transaction IDs from one serialized state snapshot. Historical Tip Tracker rows remain valid with blank Shift IDs and are not rewritten.
- `executeShiftCommit_()` journals four stages: shift-batch count, Tip Tracker source row, Raw Transactions pair, and Transactions pair. Verification checks the exact financial fields and links plus all three helper formulas. Any failed or write-then-throw stage rolls back in reverse and re-reads the original state.
- `Import Batches.Record_Count` for `BATCH-SHIFT-ENTRY` intentionally counts submitted source shifts, not its two derived ledger rows. The batch notes make this semantic explicit.
- Same-member same-date entries warn and require confirmation; they are not blocked because double shifts are legitimate. The separately reviewed `Is_Duplicate` financial control remains untouched.
- Duplicate flags, Budget/Dashboard/Income History, and Change Log run only after the durable commit and lock release. A follow-up failure returns saved-with-warning so the user is not encouraged to resubmit the shift.
- Data Health Check validates every v0.0.31 stable Shift ID across Tip Tracker, Raw Transactions, and Transactions, including Wages/Tips cardinality, amounts, member, account, currency, type, and subcategory. Historical blank-ID rows are deliberately outside this new linkage rule.

## Currency authority boundary

- `Accounts.Currency` is the authoritative currency configuration. The currently supported household currency is `CAD`.
- Add Transaction and Add Shift resolve the single active account before writing and copy that account's currency into `Raw Transactions.Raw_Currency` and `Transactions.Currency`; neither writer contains a currency literal.
- A missing account, more than one active account, or a non-CAD active account is a blocking configuration error. Before multiple accounts can be active, the user interface must provide an explicit account selector as required by D-022.
- Currency is metadata in the current single-currency model. Correcting the known `USD` labels to `CAD` must never recalculate or convert an amount.
- Data Health Check validates account currency, record-to-account links, and record currency agreement so manual edits or future writers cannot silently reintroduce drift.

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
