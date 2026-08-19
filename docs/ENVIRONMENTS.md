# Environments

## Development

- Local snapshot: retained outside hosted Git as `Budget_App__v 0.23  -dev- Copy.ods`
- Google Sheet: `devCopy of Budget_App__v 0.23`
- Apps Script ID: connected locally in ignored `.clasp.json`; intentionally excluded from Git
- Source status: remote development source reports `v0.0.31` and matches approved commit `0f18df3` across all eight tracked Apps Script files after the 10:31:13 PM development-only push; the manifest remains `America/Toronto`
- Runtime status: live diagnostics report v0.0.31 and `America/Toronto`. Opening Add Shift installed only Tip Tracker's two audit headers and preserved the 13 historical blank-ID rows. The settings-drift control returned a fresh `$17.60` preview with zero writes. Three controlled stable shifts then produced exactly six Raw and six Transaction rows, moving both ledgers from 42 to 48 and the source-shift batch from 13 to 16 while the manual batch remained 16. The cancel path wrote nothing, the same-member/date warning and confirmed second shift both worked, Calculation Settings snapshots are present, and the final same-row S/T/W formulas were verified. Diagnostics report three stable plus 13 historical shifts; Duplicate Review retains five rows across two keys; Data Health, summaries, Income History, and the narrow-width dialog all pass
- Current candidate: live-verified development `v0.0.31` on draft PR #16 (`issue-2-add-shift-e2e`); Gemini approved with non-blocking notes, Claude review was explicitly waived, Codex reconciled both notes, and every repository, source, and live-development gate passes. Merge approval remains pending
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
