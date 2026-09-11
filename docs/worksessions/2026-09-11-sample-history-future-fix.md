# Hearth worksession — Sample dates and future expenses

- Status: VERIFIED LOCALLY — release authorized
- Opened: 2026-09-11 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex
- Repository: dual-ai-budget-app
- Branch: codex/sample-history-future-fix
- Baseline: b24dd73143b143ef96bfc856ba03cfb9272d802f
- Risk: High
- Environment impact: Development only

## Household outcome
Quick sample history follows actual dates and populates the same number of months ahead with planned Calendar expenses. Existing samples can receive plans without reposting money.

## Budget delta (5)
Prevent premature payday/expense posting; keep planned obligations separate from balances and preserve actor, scope, review and Undo boundaries.

## Engagement delta (3)
Populate upcoming widgets; clarify accumulated Wallet balances versus scoped monthly Home totals across all themes.

## Verified baseline
Screenshots show correct Shared monthly subtraction. Personal Books intentionally includes accessible Shared accounts, while Personal Home counts its own accounts. Exact live Wallet balance has not been independently reconciled. Legacy generator clamps future current-month dates onto today and creates no future plans.

## Scope and decisions
Keep the legacy command replay unchanged. Add a versioned command and worker/UI preview. Historical entries already posted stay untouched. Future-only supplements are managed through Calendar removal; history-plus-plan Undo removes only untouched unposted plans. No investor-engine change, schema change, or live household mutation.

## Acceptance evidence
- Scoped quick gate passed in 57.761 seconds: 180 tests in 9 files, TypeScript, AI surface, diff check. Command: `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/quick-sample-data.test.ts --focus=test/potential-expenses.test.ts --focus=test/ledger-experience.test.ts --focus=test/five-boards-entry-app.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Versioned sample history and Calendar plans, scoped Home and Wallet labels, and confirmation lifecycle"` (runtime Node PATH prepended).
- Initial gate attempts caught a test-only optional-field TypeScript issue and incorrect comma-delimited focus syntax; corrected before the passing gate.
- `pnpm exec vite build` passed; existing PGlite browser-external/eval and bundle-size warnings remain.
- `HEARTH_ARTIFACTS_DIR=/tmp/hearth-sample-future-proof node scripts/check-quick-samples.mjs`: all 18 theme/scope/width combinations (320, 390, 1440), six axe scans, keyboard/cancel, worker bundle, and persisted Confirm/PGlite agreement passed. Largest fixture: 2,000 existing transactions + 88 history + 84 plans; 2,760.2 ms background preparation, 165 rendering frames, max 16.8 ms frame gap. Three-month Confirm persisted 40 historical transactions and 42 planned expenses.
- Visual review found the dropdown option was clipped at mobile width; shortened to “3 months each” beneath “History + future” after the gate. Final browser verification passed again at `/tmp/hearth-sample-future-proof-final/evidence.json`: all 18 geometry cases, six axe checks, keyboard/cancel, worker and persisted books checks. Final largest worker result: 2,514.8 ms, 152 frames, max 16.8 ms gap. CI validates committed files.
- Independent read-only review by sample_totals_trace found a removed-plan retry issue; fixed and regression-tested. No other reported blockers. One writer.
- Local tests verify future-only upgrade keeps the financial audit hash unchanged, upcoming October plans reach Calendar, Personal plans remain private, V1 replay stays compatible, and whole-set Undo rejects changed/posted plans.

## Handoff
Jonathan’s earlier “push merge and deploy” authorization applies to this correction of the same feature. Codex owns PR/merge/Development release execution. No hosted household mutations, schema changes, secrets changes, Production activation or physical-device proof. Authenticated hosted flow remains unverified; local browser and authority replay proof are distinct.

Rollback: revert the correction commit and redeploy through the same Worker workflow if client startup or command compatibility fails. Existing accepted history and plans remain data; no automatic data cleanup. Keep V1 registered and ship V2 authority plus client together.
