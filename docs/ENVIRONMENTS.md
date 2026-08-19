# Environments

## Development

- Local snapshot: retained outside hosted Git as `Budget_App__v 0.23  -dev- Copy.ods`
- Google Sheet: `devCopy of Budget_App__v 0.23`
- Apps Script ID: connected locally in ignored `.clasp.json`; intentionally excluded from Git
- Source status: remote development source reports `v0.0.30` and matches approved commit `edb3d25` across all seven tracked Apps Script files after the 9:13:42 PM source-only push; the manifest remains `America/Toronto`
- Runtime status: live diagnostics report v0.0.30 and `America/Toronto`. The guarded correction changed exactly one Accounts cell, 39 Raw Transactions cells, and 39 Transactions cells to CAD; it verified that protected financial data did not change and its built-in post-migration Data Health Check was clean. A repeat preview validates all 79 cells as CAD with zero pending writes. Controlled Add Transaction/Add Shift behavior and the final standalone health check remain pending
- Current candidate: `v0.0.30` on draft PR #15 (`issue-10-cad-currency`); repository, Gemini review, development-source, diagnostics, migration, idempotence, and post-migration health gates pass, Jonathan explicitly waived Claude review, and controlled new-record behavior/final health verification remain pending
- Spreadsheet and Apps Script timezones: `America/Toronto`
- Git branch: feature branches or local worktrees, merged into `main` after verification
- Allowed: reversible test data, refactors, diagnostics, visual experiments, and automated checks

The live development Sheet should display a conspicuous `DEVELOPMENT` marker and use a distinct title/theme so it cannot be mistaken for production.

## Production

- Local snapshot: retained outside hosted Git as `Budget_App__v 0.23.ods`
- Google Sheet: exact title/ID intentionally not stored yet
- Apps Script: must not be linked in the repository root
- Allowed changes: release candidates explicitly approved by Jonathan

## Stable recovery

- Local-only `Budget_App__v 0.21.ods` is the last stable tested recovery build identified by Jonathan.

## GitHub

- Account owner: `jonathanbeaulne123-blip`
- Private repository: `https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app`
- Hosted content: code, tests, current documentation, issue/PR history, and releases
- Excluded content: Sheet exports, ODS workbooks, historical chats, credentials, `.clasp.json`, and household data
- Canonical branch: `main`
- Clean hosted baseline: `61a396e` (`Establish private GitHub project baseline`)
- Verification: fresh private clone matched local `main`; one hosted branch, one baseline commit, 31 tracked files, zero forbidden artifacts
- Local-only recovery: the full pre-GitHub Git history and workbook files; never push the archive branch or Git bundle

## Environment verification

Before any live operation, verify:

1. Sheet title and visible environment marker
2. Spreadsheet ID
3. Apps Script ID
4. `APP_VERSION`
5. Git commit/release candidate
6. Diagnostics and Data Health Check result

If any identifier conflicts, stop before writing.
