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
