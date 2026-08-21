> **Reference only — not a bible.** Snapshot of the Google Sheets / Apps Script era (`v0.0.31`, git `f2db836`, tag `sheets-v0.0.31`).
>
> Jonathan’s latest instruction, the live files in `docs/` (outside this folder), and the TypeScript app are current. Read this to see how the project moved, not as today’s product law.
>
> Apps Script source is not in the working tree. Recover it with `git show sheets-v0.0.31:Code.gs`.

# Development Live Verification — 2026-08-18

## Runtime diagnostics

Jonathan ran **Show Version & Diagnostics** in the development Google Sheet and reported:

- Runtime version: `v0.0.23`
- Spreadsheet timezone used by the tools: `America/Los_Angeles`
- Apps Script project/manifest timezone: `America/Toronto`
- `Budget!B2`: August 2026 and current
- Expected headers: pass on Transactions, Raw Transactions, Import Batches, Categories, Budget Plan, Household Members, and Accounts
- Budget/Dashboard/Income History layout anchors: pass
- Tip Tracker: configured with Floor 6%, Bar 1% rounded up to $5, CC 2%, hourly rate $17.60
- Scheduled refresh: not configured
- Last reported metrics refresh: August 18 at 11:07 AM in the spreadsheet timezone

## Timezone assessment

The diagnostic calls the project/spreadsheet mismatch harmless, but that conclusion is incorrect for this household. `getTz_()` deliberately prefers the spreadsheet timezone, so tools currently interpret dates using Los Angeles rather than Toronto. This can affect:

- What counts as today near midnight
- Calendar month keys near boundaries
- Default transaction/shift dates
- Duplicate-date comparisons
- Displayed refresh timestamps
- Later scheduled or recurring behavior

Correct the development spreadsheet timezone to `America/Toronto` before enabling the scheduled refresh. Then rerun diagnostics.

## Data Health Check findings

The live development health check reported:

- Duplicate active Cat Litter subcategories:
  - `SUB-CAT-CAT-LITTER`
  - `SUB-CAT-CAT-LITTER-2`
- Seven active subcategories with orphaned parent IDs:
  - `SUB-HOUSING-RENT`: `HOUSING` → expected `CAT-HOUSING`
  - `SUB-HOUSING-GAS`: `HOUSING` → expected `CAT-HOUSING`
  - `SUB-HOUSING-ELECTRIC`: `HOUSING` → expected `CAT-HOUSING`
  - `SUB-FOOD-GROCERIES`: `FOOD` → expected `CAT-FOOD`
  - `SUB-TRANSPORT-PRIVATE`: `TRANSPORT` → expected `CAT-TRANSPORT`
  - `SUB-TRANSPORT-PUBLIC`: `TRANSPORT` → expected `CAT-TRANSPORT`
  - `SUB-TRANSPORT-FUEL`: `TRANSPORT` → expected `CAT-TRANSPORT`

## Reference audit against the development ODS snapshot

The repeatable read-only audit in `scripts/audit-ods-references.py` found:

- `SUB-CAT-CAT-LITTER` has no references outside its Categories row.
- `SUB-CAT-CAT-LITTER-2` is referenced once: `Budget Plan!F54`, budget record `BUD-202601-034`, active, $50 for January 2026.
- No Cat Litter transaction references were found.
- Four Transactions rows contain invalid `Manual_Category_ID = HOUSING`; their formula-derived `Effective_Category_ID` is therefore also `HOUSING`:
  - `TXN-MANUAL-000001`
  - `TXN-MANUAL-000028`
  - `TXN-MANUAL-000032`
  - `TXN-MANUAL-000033`
- All four use valid `Effective_Subcategory_ID = SUB-HOUSING-ELECTRIC`, which explains why current subcategory-based budget totals can remain correct despite the broken top-level category link.

## Health-check coverage gap

`runDataHealthCheck_()` validates Transactions `Effective_Subcategory_ID` and `Member_ID`, but not `Manual_Category_ID` or `Effective_Category_ID`. That is why the four orphaned transaction category links were not reported. A future code release should add those checks.

## Recommended development-only correction order

1. Change the development spreadsheet timezone to `America/Toronto`.
2. Correct the seven Categories `Parent_Category_ID` cells.
3. Correct the four affected Transactions `Manual_Category_ID` cells from `HOUSING` to `CAT-HOUSING`; their Effective formulas should follow automatically.
4. Consolidate Cat Litter while preserving history:
   - Change `Budget Plan!F54` from `SUB-CAT-CAT-LITTER-2` to `SUB-CAT-CAT-LITTER`.
   - Set the duplicate Categories record `SUB-CAT-CAT-LITTER-2` to inactive rather than deleting it initially.
5. Refresh Budget Summary.
6. Rerun Show Version & Diagnostics and Data Health Check.
7. Only after the corrected development checks pass, enable the four-hour scheduled refresh.

No live data corrections were made during this verification.

## Subsequent ineffective maintenance attempt

A later Gemini session added `Maintenance.js` directly to the development Apps Script project. The function completed without making the intended edits because it searched row 1 for headers while every affected table uses row 4. Its missing-header helper returned column `0` instead of throwing, so record IDs evaluated as undefined and the loops silently skipped every target. It also searched Budget Plan for nonexistent header `Budget_Record_ID` instead of `Budget_ID` and contained no timezone correction.

The unchanged Data Health Check results after that attempt confirm that no intended data corrections were applied. The original `Code.js` and dialog sources remained equal to the Git v0.0.23 baseline; the additional remote `Maintenance.js` created source drift.

## Local v0.0.24 candidate

The reviewed local candidate replaces that maintenance file with a development-only preview/apply migration, adds fail-fast validation and rollback behavior, corrects diagnostics' timezone assessment, and expands Data Health Check to cover Transactions `Manual_Category_ID` and `Effective_Category_ID`. The exact proposed changes and execution gate are recorded in `docs/V0.0.24_DATA_INTEGRITY_RELEASE.md`.

At that point in the verification timeline, this candidate had not yet been pushed or executed live. The subsequent deployment result is recorded below.

## v0.0.24 deployment and execution result

The local v0.0.24 source was committed as `003ae3c`, pushed to the development Apps Script project only, and verified against a fresh remote clone after line-ending normalization. Jonathan then ran the guarded workflow in the development Sheet:

- Preview reported the exact 13 expected cells and `America/Los_Angeles` → `America/Toronto`.
- Apply wrote and verified all 13 cells.
- The spreadsheet timezone changed to `America/Toronto`.
- Budget summary refresh completed.
- Data Health Check then reported two grouped findings representing the same 14 legacy Add Shift rows: invalid `Manual_Category_ID` and formula-derived invalid `Effective_Category_ID`.

## Follow-up legacy income-ID audit

The development ODS snapshot contains exactly 14 direct legacy `Manual_Category_ID = CAT-INCOME` cells on `TXN-SHIFT-000006` through `TXN-SHIFT-000019`. They occupy `Transactions!Q10:Q23`. Their `Effective_Category_ID` cells at `Transactions!S10:S23` are formulas of the same-row form `IF(Qrow<>"", Qrow, Nrow)`, so they mirror the invalid manual ID.

The authoritative active Income top-level `Category_ID` is `INCOME`, as already established in v0.0.19. The safe correction is therefore 14 direct writes from `CAT-INCOME` to `INCOME` in `Q10:Q23`, while preserving and verifying—not replacing—the 14 formulas in `S10:S23`. No amounts, dates, tips, wages, or subcategories are part of the correction.

The guarded implementation and exact execution plan are recorded in `docs/V0.0.25_LEGACY_INCOME_RELEASE.md`.

## v0.0.25 source deployment verification

The v0.0.25 source was committed as `77fab39` and pushed to the configured development Script ID only at 4:02 PM on 2026-08-18. `clasp` reported exactly seven pushed files: two server sources, four dialogs, and the manifest.

A fresh clone performed from an isolated temporary directory verified:

- Local `Code.gs` equals remote `Code.js` after line-ending normalization.
- Local `Maintenance.gs` equals remote `Maintenance.js` after line-ending normalization.
- All four dialogs match exactly after line-ending normalization.
- The remote and local manifests are semantically equal.
- Remote `APP_VERSION` is `v0.0.25`.

This verifies source deployment only. No v0.0.25 data cell has been changed yet; the live preview/apply gate remains pending.

## v0.0.25 live execution result

Jonathan ran the v0.0.25 preview in the development Sheet. It matched the audited plan exactly:

- Spreadsheet: `devCopy of Budget_App__v 0.23`
- Timezone: `America/Toronto`
- 14 direct changes at `Transactions!Q10:Q23`, covering `TXN-SHIFT-000006` through `TXN-SHIFT-000019`
- Every direct value: `CAT-INCOME` → `INCOME`
- 14 formula-derived cells at `Transactions!S10:S23` verified as connected to their same-row Q cells and explicitly marked never to be overwritten
- No transaction amounts, dates, tips, wages, or subcategories in scope

Jonathan then ran Apply. The tool reported:

- 14 direct `Manual_Category_ID` corrections written and verified
- 14 `Effective_Category_ID` formulas preserved and recalculated to `INCOME`
- Budget summary refreshed successfully
- Data Health Check reports no issues

This closes the v0.0.25 development migration. Production was not changed.
