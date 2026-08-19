# Verified Local Baseline

Verified on 2026-08-18 before the first Git commit.

Canonical baseline commit: `5221a14` (`Establish v0.0.23 project baseline`).

## Source

| File | SHA-256 |
|---|---|
| `Code.gs` | `123BE8948944DF7C80FF5A536E68A5F986501E77FDE38F1F2FEF7A6105BB41C5` |
| `AddTransactionDialog.html` | `D44881550A004CCC1A405105F513FE01859B7270258864CDB903C798A9259972` |
| `AddCategoryDialog.html` | `3347F1EBAA5B73B7BB773DCE2182C758656D23EF905CEAA2E0D45444F53DBB2F` |
| `AddShiftDialog.html` | `31A714B1CD2AAE8898A31FAAF898494171DF3D16181F24FD81ECA572B098944C` |
| `CategorySpendingDialog.html` | `E274A7D34AAB4BC66B8B32105C04C372AC09BC3B6A75606F5D218D490508DAC3` |

`Code.gs` has 2,932 lines and declares `var APP_VERSION = 'v0.0.23';` at line 2700.

## Workbook snapshots

| File | Purpose | SHA-256 |
|---|---|---|
| `Budget_App__v 0.23.ods` | Production snapshot | `DAA062755958F677E12406DEE18B7E2529B5BB489F1874017EEE3E73F0209279` |
| `Budget_App__v 0.23  -dev- Copy.ods` | Development snapshot | `DAA062755958F677E12406DEE18B7E2529B5BB489F1874017EEE3E73F0209279` |
| `Budget_App__v 0.21.ods` | Last stable recovery snapshot | `43A4EB8DD0263608A8B20C5BF170150FAFEA7280E55722C2D81718B5ADD15B81` |

The development and production `v0.23` ODS files were byte-for-byte identical at baseline. This is expected for a newly created development copy.

## Historical record

`Project Context.txt` SHA-256: `AA6AADA2CE34879F299962CE36BA5A978719AEC8216E468CEAD8E840A62B002C`.

The file is retained for historical evidence. It includes conflicting concurrent-session history and must not override current verified code, Sheet behavior, decisions, or Jonathan's latest instructions.

## Remote development reconciliation

On 2026-08-18, the development Script ID was configured locally, Google authorization succeeded, and `clasp` cloned the remote project into an isolated temporary folder. The following remote files matched their local counterparts exactly after normalizing CRLF/LF line endings:

- `Code.js` remote to `Code.gs` local
- `AddTransactionDialog.html`
- `AddCategoryDialog.html`
- `AddShiftDialog.html`
- `CategorySpendingDialog.html`

The remote manifest specifies `America/Toronto`, empty dependencies, Stackdriver exception logging, and the V8 runtime. That manifest is now tracked as `appsscript.json`.

The local `.clasp.json` explicitly prefers `.gs` before `.js`, preventing future pulls from creating a duplicate `Code.js`. The Script ID and Google credentials remain excluded from Git.

This verifies source synchronization. The live development Sheet subsequently reported `v0.0.23`, passed all expected header and layout checks, and confirmed the current Budget month. The live check also found that the spreadsheet itself uses `America/Los_Angeles`; because `getTz_()` intentionally prefers the spreadsheet timezone, this must be corrected to the accepted `America/Toronto` project timezone.

## Remote drift observed after reconciliation

Later on 2026-08-18, a Gemini session added `Maintenance.js` directly to the development Apps Script project. A fresh isolated clone confirmed that the original `Code.js` and four dialog files still matched Git after line-ending normalization; the manifest was semantically unchanged. `Maintenance.js` was the only new source file.

That maintenance function did not apply its intended corrections because it looked for row-4 headers on row 1 and used the nonexistent Budget Plan header `Budget_Record_ID`. The local `v0.0.24` candidate now contains a reviewed `Maintenance.gs` intended to replace this drift after Jonathan approves a development-only push. Until that push is performed and verified, the live development runtime remains `v0.0.23` plus the ineffective remote maintenance file.

## Current development state after baseline reconciliation

The historical baseline above remains the recovery reference. Later on 2026-08-18, commit `003ae3c` replaced the ineffective remote maintenance file with the guarded v0.0.24 migration. That source was pushed to development only and verified against a fresh remote clone. Jonathan previewed and applied the migration successfully: 13 exact cells were corrected and the spreadsheet timezone changed to `America/Toronto`.

The post-migration health check exposed 14 legacy Add Shift rows whose direct `Manual_Category_ID` was `CAT-INCOME`; their `Effective_Category_ID` cells were same-row formulas and therefore reported the same invalid value. The separate, guarded v0.0.25 follow-up was committed as `77fab39`, pushed to development only, and source-verified against a fresh remote clone. Jonathan's live preview matched the exact plan, and Apply changed only those 14 direct cells to the authoritative ID `INCOME`, preserved/recalculated the 14 formulas, refreshed the budget summary, and finished with no Data Health Check findings.

## Private GitHub migration

On 2026-08-18, Jonathan created the private repository `jonathanbeaulne123-blip/dual-ai-budget-app`. Before the first push:

- The original repository history was committed through `5cce612` and preserved on local-only branch `local/full-history-pre-github`.
- A complete bundle was created at `local-backups/dual-ai-budget-app-full-history-pre-github-2026-08-18.bundle` and passed `git bundle verify`.
- The hosted `main` history was restarted at clean root commit `61a396e` from the verified v0.0.25 working state.
- Three ODS workbooks, `Project Context.txt`, `.clasp.json`, and the recovery bundle were excluded and confirmed ignored.
- A staged credential-pattern scan found no private keys, Google API keys, GitHub tokens, or live development Script ID.

The first push created only remote branch `main`. A fresh authenticated clone matched local commit `61a396e`, contained one commit and 31 tracked code/documentation files, and contained zero forbidden local-only artifacts. GitHub is now the canonical editable remote; the pre-GitHub branch and bundle are recovery/audit artifacts and must never be pushed.

## v0.0.26 development source checkpoint

On 2026-08-18, Jonathan approved a development-only push of the Issue #8 duplicate-scaling candidate at commit `84241fe`. Before the push, an isolated `clasp clone` reported v0.0.25 and all seven remote Apps Script files matched private-GitHub `main` after line-ending normalization. The ignored development ODS recovery snapshot preserved 35 existing `Potential_Duplicate_Flag` formulas, all in the expected Transactions column.

`clasp push` then sent only the seven tracked Apps Script files to the locally linked development project. A second isolated clone reported v0.0.26; every remote source/dialog/manifest file matched commit `84241fe`, and the manifest remained `America/Toronto`. Production was not targeted or changed. Draft PR #11 and Issue #8 remain open for live development-Sheet verification and independent review.

Jonathan then completed the development-Sheet verification in the required order. Diagnostics reported v0.0.26, `America/Toronto`, the expected 31-column Transactions layout, and a valid Budget/Dashboard/Income History surface. Data Health Check was clean before the transition, proving the 35 existing formula results matched the new engine. Refresh Duplicate Flags then scanned all 35 transaction rows and reported five rows across two repeated keys; the post-refresh Data Health Check was also clean. This proves the formula-to-value transition preserved the current derived flags. Those five rows remain potential review items only: `Is_Duplicate` was not changed, so no transaction was automatically excluded from financial totals. Independent code review remains the final draft-PR gate.

Gemini's 2026-08-18 independent review accepted the O(n) matching logic and write boundary but requested changes because overlapping full-column recalculations were not serialized. Jonathan approved the targeted correction. The successor v0.0.27 candidate adds a document lock around the duplicate-flag extent read and write plus lock lifecycle/timeout tests. This is a new version because v0.0.26 is already deployed and verified in development; v0.0.27 remains local/GitHub-only until Jonathan separately approves a development push.

Jonathan then explicitly approved the v0.0.27 development-only push. A pre-push isolated clone still reported v0.0.26; all seven remote Apps Script files matched the verified v0.0.26 development commit `84241fe`, and the manifest remained `America/Toronto`. `clasp push` sent the seven tracked Apps Script files at 6:09 PM. A fresh post-push clone reported v0.0.27 and matched source commit `c367637` across all seven files, with the same Toronto manifest. Production was not targeted or changed. At that source checkpoint, live development-Sheet verification was still pending.

Jonathan completed the v0.0.27 live controls in order. Diagnostics reported v0.0.27, `America/Toronto`, the expected 31-column Transactions layout, all other required table layouts, a valid Budget/Dashboard/Income History surface, and the v0.0.27 release-history entry. The pre-refresh Data Health Check was clean. Refresh Duplicate Flags then scanned all 35 transaction rows and returned the unchanged five rows across two repeated keys while explicitly preserving `Duplicate_Key` and `Is_Duplicate`. The post-refresh Data Health Check was also clean. This executes the real document-lock path successfully and proves the stored derived flags still agree with the full-ledger engine. Automated tests cover lock contention/timeout behavior; the live control did not intentionally create concurrent user edits. Repository and development gates now pass, while the pull request remains draft pending Jonathan's merge approval.

PR #11 was subsequently squash-merged into `main` as `7189f42`, and Issue #8 was closed. Development remains on the source- and live-verified v0.0.27 runtime; production remains untouched. Work on Issue #7 now continues as the local-only v0.0.28 candidate. It introduces a pure authoritative Transaction Input validator and moves every request/reference validation plus Toronto date parsing before the first write-capable helper. No v0.0.28 source has been pushed to Apps Script.

Gemini independently reviewed the v0.0.28 Issue #7 candidate and returned APPROVE. Commit `7b43666` incorporated the useful review follow-ups by directly testing malformed root payloads, rejecting array-shaped reference data, and exercising the Toronto parse/format path through the first write boundary. Jonathan then explicitly approved a development-only push and manually confirmed the pre-push baseline: 35 Transactions rows, 35 Raw Transactions rows, two Import Batches rows, and `BATCH-MANUAL-ENTRY` Record_Count 11. An isolated pull proved the linked remote still reported v0.0.27 and all seven files matched commit `c367637`. At 7:05:36 PM, clasp pushed exactly the seven tracked Apps Script files. A second isolated pull reported v0.0.28; all seven remote files matched commit `7b43666`, and `appsscript.json` remained `America/Toronto`. Production was not linked, targeted, or changed. Live development-Sheet verification is pending.

Jonathan then completed the v0.0.28 live verification. Diagnostics reported v0.0.28, `America/Toronto`, all expected table widths/header rows, a valid Budget/Dashboard/Income History surface, and the v0.0.28 release-history entry. The pre-test Data Health Check was clean. Add Transaction rejected amount `1.001` with the expected whole-cent error and amount `0` with the expected positive-number error. Jonathan added the planned `$0.01` controlled Expense plus one accidental but valid `$0.98` Expense; both are retained as development evidence. Counts moved exactly from 35 Transactions / 35 Raw Transactions / 2 Import Batches / manual Record_Count 11 to 37 / 37 / 2 / 13, proving two complete row pairs, reuse of the existing manual batch, and one batch-count increment per valid request. No extra rows or batch increments remain attributable to either rejected request. The post-test Data Health Check was also clean. All Issue #7 repository, independent-review, source, and live-development gates now pass; PR #12 remains draft pending Jonathan's explicit merge approval.

Jonathan explicitly approved PR #12 for merge and Issue #7 for closure. GitHub marked the PR ready and squash-merged it into `main` as `c7536da`; the `Closes #7` linkage closed Issue #7 as completed. Local `main` fast-forwarded to the same commit, and the complete merged-state syntax, migration, duplicate-scale/lock, and Transaction Input validation suites passed. Development remains the verified v0.0.28 runtime, both controlled development entries remain preserved, and production remains untouched.

Work on high-risk Issue #6 now continues on isolated branch `issue-6-transaction-atomicity` as the local-only v0.0.29 candidate. Add Transaction performs a fast read-only preflight and then repeats authoritative reference validation/date parsing under one document lock before reading commit state. A pure planner allocates both IDs and captures the manual batch's prior/new count; a guarded adapter updates the batch, appends one raw row, appends one complete transaction row containing all three helper formulas, verifies the linked pair, and reverses attempted mutations on any write or verification failure. Deterministic tests cover serialized unique IDs, every before/after-write boundary, write-then-throw recovery, incomplete rollback escalation, lock lifecycle, and post-commit retry safety. Development remains v0.0.28 and no v0.0.29 Apps Script source has been pushed.

Gemini independently reviewed PR #13's runtime commit `7d66a76` and returned `APPROVE WITH NON-BLOCKING NOTES`. Jonathan approved both follow-ups: add a test-only case proving a row inserted between planning and append triggers full recovery while preserving the unrelated row, and track repeated full-table stable-ID reads as non-blocking scalability Issue #14. Jonathan explicitly waived Claude review for this candidate. The authoritative 31-column Transactions header layout places `Effective_Category_ID` in S, `Effective_Subcategory_ID` in T, and `Duplicate_Key` in W; Y is the separately controlled `Is_Duplicate` field. Development remains v0.0.28; no live source or Sheet change was authorized by these review decisions.

Jonathan then explicitly approved a v0.0.29 development-only source push. The complete suite passed at PR head `4a4c01d`. An isolated pre-push pull proved the linked project still reported v0.0.28, retained `America/Toronto`, and matched `main` across all seven tracked files. Clasp pushed exactly those seven files at 7:59:52 PM. A separate fresh pull then reported v0.0.29 and matched commit `4a4c01d` across all seven files after line-ending normalization, with the Toronto manifest unchanged. Production was not linked, targeted, or changed.

Jonathan completed the v0.0.29 live development verification. Diagnostics reported v0.0.29, `America/Toronto`, every expected table width/header row, a valid Budget/Dashboard/Income History surface, and the v0.0.29 release entry; the pre-test Data Health Check was clean. Two near-simultaneous controlled Groceries expenses of `$0.02` and `$0.03` both saved. Transactions and Raw Transactions each moved from 37 to 39 rows, Import Batches remained at two rows, and `BATCH-MANUAL-ENTRY` moved from Record_Count 13 to 15. The resulting transaction/raw ID pairs were unique and linked. Transactions rows 42 and 43 each retained the generated `Effective_Category_ID`, `Effective_Subcategory_ID`, and `Duplicate_Key` formulas with correct same-row references in S, T, and W. Refresh Duplicate Flags then scanned all 39 transaction rows and returned the unchanged five rows across two repeated keys without changing `Duplicate_Key` or `Is_Duplicate`; the final Data Health Check was clean. The complete repository suite also remained green. All Issue #6 repository, independent-review, source, and live-development gates passed before merge approval.

Jonathan then explicitly approved PR #13 for merge and Issue #6 for closure. GitHub squash-merged the candidate into `main` as `e79f8b2`, and the `Closes #6` linkage closed Issue #6. Local `main` advanced to the same commit with the complete suite green. Development remains the verified v0.0.29 runtime and production remains untouched.

Work on high-risk Issue #10 now continues on isolated branch `issue-10-cad-currency` as the v0.0.30 candidate on draft PR #15. Direct inspection of the retained development snapshot found one active account, 35 Raw Transactions rows, and 35 Transactions rows labeled `USD`; Jonathan confirmed every value is actually CAD and no amount conversion is permitted. The candidate makes `Accounts.Currency` authoritative, requires a single active CAD account in both Add Transaction and Add Shift, copies that currency into both record layers, expands Data Health Check to detect currency/account drift, and provides a guarded development-only migration that discovers the live row extent by stable IDs. The migration previews every cell, locks and rebuilds the plan before writing, verifies non-currency row fingerprints, supports a repeat-safe no-op, and proves rollback after simulated failures. Repository checks pass. Development Apps Script remains v0.0.29; no v0.0.30 source or Sheet change has been authorized.

Gemini independently reviewed the v0.0.30 code, mocks, tests, and release plan and returned `APPROVE`. It confirmed account-derived currency propagation, fail-fast account guards, the three-column migration boundary, zero amount conversion or financial refresh, rollback behavior, and Data Health coverage. Its only finding was a non-blocking P3 observation that the one-time migration performs individual `setValue()` calls; it recommended no code change for the expected approximately 79 development cells. The cited 30-second value governs lock acquisition rather than migration execution, so it does not create the described automatic rollback deadline. Jonathan explicitly waived Claude review for Issue #10. The remaining gate is Jonathan's separate approval for a v0.0.30 development-only source push and the documented live verification sequence.

Jonathan explicitly approved the v0.0.30 development-only source push. The complete suite passed at approved commit `edb3d25`. A fresh isolated pre-push clone proved that the linked project still reported v0.0.29, retained `America/Toronto`, and matched merged `main` commit `e79f8b2` across all seven tracked Apps Script files. Clasp pushed exactly those seven files at 9:13:42 PM. A second fresh isolated clone then reported v0.0.30, retained the Toronto manifest, and matched `edb3d25` across all seven files after line-ending normalization. No migration function ran, no Sheet cell changed, and production was not linked, targeted, or changed. The read-only preview, guarded Apply, and live behavior verification remain pending.

Jonathan completed the initial v0.0.30 live gates. Version & Diagnostics reported v0.0.30, `America/Toronto`, every expected table width/header row, the v0.0.30 release entry, and a valid Budget/Dashboard/Income History surface. The pre-migration Data Health Check found exactly three expected currency findings: one USD account (`ACC-LEGACY-001`), 39 USD Raw Transactions, and 39 USD Transactions. The read-only preview then validated exactly 79 pending label changes: `Accounts!F5`, `Raw Transactions!P5:P43`, and `Transactions!J5:J43`. Every ledger row had a unique stable ID and resolved to the legacy account, every current value was the allowed pre-migration `USD`, and the preview proposed only `CAD` replacements. No migration function has run yet. The exact preview therefore passes and the guarded Apply gate is ready.

Jonathan ran the guarded v0.0.30 Apply with the exact confirmation phrase. It changed and verified exactly 79 currency metadata cells: one Accounts cell, 39 Raw Transactions cells, and 39 Transactions cells. The result explicitly confirmed that no amounts, dates, categories, owners, tips, wages, formulas, duplicate decisions, or financial calculations changed, and its built-in post-migration Data Health Check returned no issues. A repeat read-only preview then validated all 79 cells as `CAD` and reported zero pending changes, proving repeat-safe idempotence. The separately requested third output was another copy of the zero-pending preview rather than a standalone health dialog; this is not a migration blocker because Apply invoked the same health engine successfully. Controlled Add Transaction/Add Shift currency propagation and the final standalone health/duplicate checks remain pending.

Jonathan completed the v0.0.30 controlled writer verification. Add Transaction saved a `$0.04` Groceries expense, and Add Shift saved a 0.25-hour shift with `$0.00` sales, `$0.01` cash tips, `$4.40` wages, and `$0.01` net tips after zero tip-out. Transactions and Raw Transactions each moved exactly from 39 to 42 rows, proving one manual row pair plus the shift's two row pairs. Jonathan confirmed every value in `Raw Transactions!P` and `Transactions!J`, including the three new rows, is CAD. Duplicate Review scanned all 42 Transactions rows and retained the unchanged five rows across two repeated keys without altering `Duplicate_Key` or `Is_Duplicate`. The final standalone Data Health Check found no issues across Accounts, both ledger layers, Categories, Household Members, Budget Plan, Budget, and Dashboard. All Issue #10 repository, independent-review, source, migration, idempotence, writer, duplicate, and health gates passed before merge approval; production remained untouched.

Jonathan then explicitly approved PR #15 for merge and Issue #10 for closure. GitHub squash-merged the candidate into `main` as `de9a2b9`, and the issue closed through the pull request linkage. Development remains the live-verified v0.0.30 runtime with 42 Transactions and 42 Raw Transactions; production remains untouched.

Work on high-risk Issue #2 now continues on isolated branch `issue-2-add-shift-e2e` and draft PR #16 as the local/GitHub-only v0.0.31 candidate. Commit `c4c0a4c` moves Add Shift into `ShiftWorkflow.gs`, replaces duplicated browser/server math with one pure settings-driven cent-rounded calculation, adds settings-drift review, strict server validation, stable Shift IDs, same-member duplicate confirmation, and one locked recoverable commit spanning Tip Tracker, the shift batch, two raw rows, and one Wages plus one Tips transaction. Data Health Check and diagnostics understand the new stable links while preserving historical blank-ID rows. Automated tests cover settings changes, validation, deterministic planning, every before/after-write rollback boundary, incomplete recovery escalation, post-commit warning behavior, mobile dialog wiring, and source-to-ledger health. Development remains v0.0.30; no v0.0.31 source or Sheet change has been approved.

Gemini independently reviewed the v0.0.31 candidate and returned `APPROVE WITH NON-BLOCKING NOTES`. It confirmed the shared calculation, cent rounding, settings fingerprint, stable linked cardinality, locked rollback boundary, and mobile-ready dialog. Its P3 setup-concurrency observation was accepted: first-use Tip Tracker and Wages/Tips provisioning now runs under one document lock, with contention tests. Its missing intersection test was also added: after a duplicate warning, changing Tip Tracker settings before confirmed resubmission returns the refreshed settings preview and does not reread commit state or write. Jonathan explicitly waived Claude review for Issue #2. The complete repository suite passes after reconciliation, there is no unresolved model disagreement, and development remains v0.0.30 pending Jonathan's separate v0.0.31 development-only push approval.

Jonathan explicitly approved the v0.0.31 development-only source push. The pre-push packaging check caught that the new `ShiftWorkflow.gs` module was not yet whitelisted by `.claspignore`; no remote write had occurred. Commit `0f18df3` added the missing whitelist entry plus a syntax-suite guard requiring every root server module, dialog, and manifest file to remain deployable. The complete suite and `clasp status` then proved an eight-file package. A fresh isolated pre-push pull reported v0.0.30, retained `America/Toronto`, contained the expected seven-file baseline, and matched merged `main` commit `de9a2b9`. At 10:31:13 PM, clasp pushed exactly the eight approved v0.0.31 files to development. A separate fresh pull reported v0.0.31, matched commit `0f18df3` across all eight files after line-ending normalization, and retained the Toronto manifest. No migration or live-Sheet control ran, and production was not linked, targeted, or changed. Live development verification remains pending.
