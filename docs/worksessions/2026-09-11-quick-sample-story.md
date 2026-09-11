# Hearth worksession — coherent Quick sample story

- Status: COMPLETE — local implementation and scoped verification
- Opened: 2026-09-11 (America/Toronto)
- Owner and decision owner: Jonathan
- Assignee: Codex; one writer with independent read-only surface investigation
- Repository: dual-ai-budget-app
- Branch: codex/quick-sample-story
- Baseline and initial HEAD: 71ccc242bd44bed60ccc5eb8c8865ecd852f76c6 (fresh origin/main); clean isolated worktree
- Risk: High; no PR or release
- Environment impact: Development fixture generation only

## Household outcome

One reproducible household arc feeds Home, Calendar, Plan, Books, Fund and Hercules through existing accepted financial records and unposted potential expenses. Stable pay and bills, a dental setback and lower discretionary spending explain the monthly changes.

Budget delta (5): coherent dated amounts and exact reviewed totals, preserving authority, privacy and undo.
Engagement delta (3): widgets can explain connected household events rather than unrelated random rows.

## Scope and acceptance

Versioned input preserves pending legacy replay. Use the selected household/account/actor/scope only. No setup, membership, opening balance, Fund configuration/contribution, provider, schema, Production or deployment mutation. Generation remains bounded and prepared in its dedicated worker. Future pay is not promised and plans are not posted. Match existing categories, disclose omitted patterns rather than misclassify expenses.

Acceptance completed below: deterministic story and calendar edges, real widget projections, replay/undo/privacy, review/cancel/confirm, worker performance, TypeScript, High quick gate and independent read-only review. Physical devices and authenticated hosted acceptance are outside this local change.

## Implementation and review

Changed `src/core/quickSampleData.ts`, `src/QuickSamplePanel.tsx`, the existing App review copy, `test/quick-sample-data.test.ts`, `test/five-boards-entry-app.test.ts`, and `scripts/check-quick-samples.mjs`; recorded the decision in `docs/DECISIONS.md`.

Independent read-only review closed four findings: keep existing-history supplementation on legacy templates (no invented past treatment); compare real `fundEvents`; assert Fund account and category-shape values rather than plate existence; condition narrative on available categories and explicitly bind occurrence stability to the reviewed story month. Final review reported no material correctness/privacy/replay/scope finding.

## Verification receipt

All commands ran in this isolated worktree. Runtime PATH prefix: `/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`. The constrained-worktree pnpm invocation uses `--config.manage-package-manager-versions=false --config.verify-deps-before-run=never`; ordinary pnpm first refused a modules-directory replacement, without changing project dependencies.

- `pnpm <flags> test -- --risk=high --focus=test/quick-sample-data.test.ts --focus=test/five-boards-entry-app.test.ts --focus-reason='Versioned story totals, six widget projections, private replay, undo and mounted review/cancel/confirm'`: **passed 88 tests**, TypeScript, AI surface and diff check. 300.144 seconds, **time-budget-breached by 0.144 seconds**. Source fingerprint `4547e236e802776a46fd9fe8152c2d04047d0fe2622d509563877d999dc4c397`; base/HEAD `71ccc242bd44bed60ccc5eb8c8865ecd852f76c6`; dirty implementation candidate. TypeScript took 160.377 seconds. Later changes are this evidence record only.
- The story tests include exact Home/Books/month/category amounts, Calendar plans and Hercules account/calendar facts, configured Fund account/shape values with unchanged Fund events and zero fabricated claims; 3–6 month arcs; leap/year boundaries; deterministic dates; legacy supplementation; Shared/Personal authority replay and Undo; catalog omissions and Production refusal. Prior test-development runs exposed two assertion mistakes (Personal retry scope and unselected Fund account) plus a misspelled test field; corrected before the passing gate.
- `pnpm <flags> exec vite build`: passed, 697 modules, 54.01 seconds. Existing PGlite/browser-external, eval and bundle-size warnings remain. This is a Vite production bundle check, not the separate Hercules Pro UI build or exhaustive release gate.
- `HEARTH_TEST_ORIGIN=http://127.0.0.1:5195 HEARTH_ARTIFACTS_DIR=/tmp/hearth-quick-story-proof-retry node scripts/check-quick-samples.mjs`: **passed**. 18 geometry cases (Classic/Taylor/Newfoundland × Shared/Personal × 320/390/1440), no horizontal overflow; six sample-panel axe checks with no violations; keyboard review/cancel; no page errors; actual accepted 43 transactions + 46 unposted plans with matching PGlite books. Fresh browser context; external/provider/sync routes blocked.
- Largest supported populated-ledger browser worker: 2,000 existing rows → 94 new history rows + 91 plans, **11,024.1 ms**, **661 animation frames**, **16.8 ms longest frame**. Built worker separately produced 43 rows + 46 plans. Pure preview on 500 existing rows measured **1.0 ms**, preparation **1,848.3 ms** in the passing gate.
- Browser setup required a local-only Vite `server.fs.allow` for the shared dependency directory. Initial 5194 run could not load PGlite WASM and failed startup validation; the fresh 5195 run passed. No application config was changed. Local launcher: `/tmp/hearth-quick-story-vite.mjs`; detailed evidence and screenshots: `/tmp/hearth-quick-story-proof-retry/evidence.json` and sibling PNGs. The 320px Newfoundland Personal screenshot was visually inspected.

## Limits

Fund setup/contributions/reserves and approved versioned Plan records are never fabricated. The default Plan receives category actuals, and an already configured Fund receives account/shape context. Category shape needs three complete prior months (select 4–6 months); three-month samples correctly retain insufficient-history states where applicable. Widget proof uses their real projection functions; browser visual/accessibility proof covers the changed sample/review flow, not a fresh visual audit of every widget. Physical devices, live model dialogue, authenticated hosted acceptance and release certification remain unclaimed.

- Required mainline regression: `pnpm <flags> exec vitest run test/app-startup-p1.test.ts test/month-rehearsal-mainline.test.ts --maxWorkers=1` passed **82 tests** in 158.39 seconds, including the current full-App Bianca rehearsal and command-sync contract.

## Handoff

Local implementation complete; **170 passing tests** across the High quick gate and required separate mainline regression, plus browser proof and Vite build. Next owner: Jonathan for product review. Branch `codex/quick-sample-story`; no push, PR, merge, deployment, schema change, provider call or real-household write. Source candidate remains based on `71ccc24`; this final receipt is documentation only. The local browser proof exercised an existing synthetic household through the visible Confirm control, and the generator never created one.
