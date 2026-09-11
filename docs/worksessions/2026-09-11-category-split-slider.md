# Hearth worksession — two-category expense slider

- Status: IMPLEMENTED LOCALLY; combined quick-gate timing/harness failure remains flagged
- Owner / decision owner: Jonathan; implementer: Codex
- Repository: dual-ai-budget-app
- Branch: codex/category-split-slider
- Baseline/head: 401f98fbd4a3b973b07c5e56a22fc8f94db1b18d (fresh origin/main; initially clean)
- Risk: High (financial allocation). No PR, push, deployment, hosted mutation, schema or Production work.

## Household outcome

Divide an expense between two chosen categories using the existing SplitCut slider, with exact CAD amounts in review. Centre Shared Add between two destinations on each side, preserving DOM/keyboard order.

## Budget delta (5)

Category amounts and ownership totals conserve the accepted expense to the cent. Existing reporting reads two ordinary category rows from one confirmation. Draft/review/Confirm, duplicate confirmation, atomic persistence, scopes and retries remain authoritative.

## Engagement delta (3)

Reuse the familiar slider, keyboard shortcuts, percentage stops and existing Classic, Taylor and Newfoundland theme tokens. Keep labels readable on phone and desktop. No new art or scene remapping.

## Scope and invariants

Expense Add, category review, retained form fields, normal and potential expense posting, existing funding allocation and confirmation undo. Zero portions show in review but create no zero transactions. Income/refund/transfer/shift keep their existing single-category model. No change to cloud schemas or Transaction shape. The current command review binds both categorized rows; an older executor that ignores the optional field must fail its reviewed-fact comparison.

## Acceptance evidence (pending)

Focused math/command tests, mounted App slider-to-review-to-confirm lifecycle, duplicate refusal, member and Fund cent conservation, undo, authority replay and local browser checks across three themes. Quick High gate and build. Independent read-only review.

## Remaining uncertainty

Physical devices and authenticated cross-device acceptance are outside local synthetic proof. No release is claimed.

## Implementation details

The existing `SplitCut` supplies touch/keyboard adjustment, detents and exact percentage input. Optional scalar form fields survive the existing private entry draft and review identity. Two active distinct expense categories are required; each portion displays exact cents. Category creation remains available. Single-category presets cannot silently capture a split as an unsplit amount, so Save as preset is hidden while the split is active.

`postEntry` validates the complete expense and both portions against prior accepted rows before constructing either saved portion. Ordinary rows share an existing `sourceId` namespace (`CATEGORY-SPLIT-`); Calendar rows retain their existing plan source. Notes identify the category portion and original total. Siblings do not count as duplicate purchases; external matching entries still require duplicate approval. No new Transaction field or schema is introduced. Ownership uses bounded largest remainders, funding conserves the full reviewed allocation, and the final command retains one confirmation/undo over both rows. Funded undo uses ordinary append-only reversals. Planned purchase evidence follows both source-linked roots and their reversals.

## Verification log

- Initial focused command/App run: 24/24 tests passed, including slider keyboard movement, close/resume and one confirmation with both reviewed amounts.
- Initial High quick gate: 360/360 tests in 26 files passed; 113.516 seconds, within the five-minute target. TypeScript, AI surface and diff hygiene passed. Final refresh below includes two added tests and final UI refinements.
- Final focused category suite: 11/11 passed, including funded planned reversal/Plan evidence and Personal projection isolation.
- Production build command passed, including the Hercules Pro UI bundle. Vite bundling took 3m17s; full build took over five minutes under local contention. Existing PGlite browser-external/eval and large-chunk warnings remain visible in the build output. No deployment occurred.
- Independent read-only financial review found and helped close two issues: planned source matching only the first row, and Fund undo allowing only one row. Final review found no remaining concrete correctness defect.
- Browser setup initially failed because Vite denied binary assets outside this symlinked worktree (`pglite.data`, `pglite.wasm`, `initdb.wasm`). The reproducible local proof serves those installed binaries through Playwright routes; external requests are blocked. Earlier screenshots establish layout only, not a healthy books startup.

### Reproduce locally

Use installed dependencies; this checkout reuses its neighbouring dependency directory. Plain pnpm attempted a dependency purge and refused in the noninteractive worktree; no purge occurred. Commands use `npm_config_manage_package_manager_versions=false npm_config_verify_deps_before_run=never` plus the matching pnpm config flags.

- `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/category-split.test.ts --focus=test/five-boards-entry-app.test.ts --focus=test/split-cut.test.ts --focus=test/potential-expenses.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus=test/app-startup-p1.test.ts --focus-reason="Final category and ownership conservation, duplicate refusal, Fund undo, Personal privacy, Plan evidence and mounted entry recovery"`
- `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build`
- `VITE_LEDGER_SYNC_V2=0 VITE_GOOGLE_CLIENT_ID= node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5191`
- `node scripts/prove-category-split.mjs` and `PROOF_VIEW=personal node scripts/prove-category-split.mjs`. The synthetic fixture mounts the ordinary App with ThemeProvider and all production styles. Proof does not post money.

Browser artifacts are local under `artifacts/category-split/`. This is scoped local proof; authenticated two-device replay, physical devices and deployment remain unverified. Decision owner for any release: Jonathan.

## Final browser evidence

36/36 cases passed: Shared and Personal × Classic, Taylor, Newfoundland × 320, 390, 720, 1100, 1440, 1920px. No page errors after correcting the test binary routes, no sheet overflow, and all slider handles met 44×44px. Shared Add was centred with zero measured offset; Personal remained centred within 0.016px. Each case exercised both category selectors, Home/PageUp keyboard adjustment, exact $39.00/$91.01 review from a $130.01 total, close and retained reopen. Representative 390/1440 screenshots and complete result JSON are retained under `artifacts/category-split/`.

Independent screenshot review found no category-control clipping or layout defect. The synthetic fixture can display a background Books attention state, so these browser results establish layout and draft interaction only; accepted posting is covered by command, mounted-App, authority and PGlite tests, not this browser capture. Physical touch, VoiceOver, enlarged-text testing, live authenticated two-device use and real household acceptance are not claimed.

The final quick-gate rerun exceeded its five-minute target during TypeScript under local contention. Keep that timing failure distinct from the earlier 113.516-second passing gate; final completion is recorded below when available. Production bundle creation passed. No publication or deployment was performed.

## Final gate result

The final High quick gate completed with `quick-gate-failed; time-budget-breached` after 1,831.226 seconds (30m31s). TypeScript passed in 797.362 seconds. All 227 fast tests passed; 121 of 135 serial tests passed. The new category integration test passed. In the existing sample-data test, the 30-second timeout was exceeded; the remaining entry-file cases then reported overlapping React `act()` calls / empty mounts. The other four serial files passed, including 81 App startup regressions. Preserve this failed combined run as an open timing/harness gate; do not substitute the earlier passing run for it. Raw compact gate evidence: `artifacts/category-split/quick-gate.json`. An isolated unchanged entry-file recheck follows.

## Isolated recovery and handoff

The unchanged entry file passed all 15 tests on an isolated rerun using the same 30-second timeout: `node node_modules/vitest/vitest.mjs run test/five-boards-entry-app.test.ts --maxWorkers=1 --testTimeout=30000`. Total duration 161.39 seconds; test execution 124.171 seconds. No application or test change was needed after the combined failure. All 362 selected tests have therefore passed across the final combined run and isolated recovery, but the combined quick gate itself remains failed and over budget. Do not call it a clean combined pass or full-suite/release proof.

Implementation is complete locally on `codex/category-split-slider`, with a clean diff-hygiene check. The branch is uncommitted and unpublished; no push, PR, merge, deployment, hosted write or schema change occurred. Next owner: Jonathan for review. Before any separately authorized release, establish a stable combined gate/CI result and recheck current main. No further feature work is pending for the two requested tweaks.

## Authorized Development release

Jonathan explicitly requested “push merge and deploy” on 2026-09-11 after the limitations above were reported. Scope is this category allocation and Shared Add change, Development only. Rebased onto `4e4afa3aaf040331c8f1cc9c432720e98c8f99f3`; only the decision-log insertion conflicted and both entries were retained. Independent final read-only review found no new financial, Confirm, Undo or artifact privacy blocker. A fresh High focused gate and exact-head GitHub checks are required before merge; historical failed local evidence remains above. Exhaustive verification and physical/authenticated two-device acceptance remain absent. No schema or secret changes are included.
