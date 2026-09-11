# Hearth worksession — Fund life and Plan decisions

- **Status:** CLOSED — local implementation verified; release and live acceptance remain open
- **Opened:** 2026-09-11 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; independent read-only financial and integration reviewers
- **Repository:** dual-ai-budget-app
- **Branch:** codex/fund-life-plan
- **Baseline SHA:** 71ccc242bd44bed60ccc5eb8c8865ecd852f76c6
- **Risk:** High
- **Environment impact:** local implementation; no deployment, hosted schema, credentials or Production activation

## Household outcome

Turn the accepted four-lens Plan into useful protection, preparation, goal and everyday decisions. Connect the same evidence to Hercules, shared review, reflection and a four-destination Fund shell.

## Budget delta (5)

One scoped, dated projection distinguishes intentions, available coverage, expected inflows and accepted outcomes; no double counting or alternate financial writer.

## Engagement delta (3)

Distinct decision tools, concrete contextual lessons, resumable Sitdown and shared-life navigation in all three themes and both device/ledger experiences.

## Verified baseline and authorization

Jonathan explicitly requested implementation of the complete plan in this task. Current origin/main includes PRs #433–#436. New isolated checkout preserves existing worktrees. Personal independence and generalized custody are follow-on architecture work per the approved plan; they are not silently introduced here. Merge/deploy remain separately authorized release actions.

## Plan and acceptance

- [x] Canonical Plan projection, source/outcome matching, conservation and timing tests.
- [x] Protect, Prepare, Build, Everyday and editable scenario comparison.
- [x] Contextual Hercules, substantive education, visible reviewed actions and private preferences.
- [x] Bridge, searchable reflection, durable Sitdown and Chapter recap.
- [x] Home / Our Money / Our Path / Together composed from existing authoritative surfaces.
- [x] Three authored themes, responsive full journeys, reduced motion, keyboard and error recovery.
- [x] Focused high-risk quick gate, production build and independent review.

## Verification boundaries

Synthetic local tests and browser evidence do not prove authenticated two-partner, physical phone/VoiceOver or deployed provider behavior. Retain PR #433's open acceptance work. No exhaustive lane without explicit authorization. The Google vision document remains unchanged.

## Evidence log

Baseline: git fetch origin main; clean worktree; git worktree add -b codex/fund-life-plan … origin/main.

The installed workspace runtime was placed on PATH. Existing dependencies were reused from the adjacent Plan worktree; no dependency reinstall or lockfile change was made. In this constrained checkout, pnpm needs `--config.manage-package-manager-versions=false --config.verify-deps-before-run=never` (and corresponding inherited `npm_config_` values).

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/plan-projection.test.ts --focus-reason="Conserved Plan decisions, private coaching, exact agreement and full App navigation/recovery"
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
VITE_PLAN_SYSTEM_V2=1 VITE_HERCULES_ACTIONS=1 VITE_HERCULES_CHAT=1 pnpm exec vite build
node scripts/build-hercules-pro-ui.mjs
node test/plan-studio-layout.mjs
```

- Standard production build: **PASS**, including TypeScript, Vite and Hercules packaging. Vite reports PGlite Node-module/eval externalization and large-chunk warnings; no performance or dependency-warning closure is claimed.
- Browser: **PASS**, 12/12 actual-component fictional journeys; 48 lens-level axe scans with zero violations; keyboard focus and 44 px controls; 320/720/1100/1920 boundary overflow checks. The compatible old runner now invokes the self-contained current journey.
- Initial quick runs found stale Shared “More” navigation expectations and older Books source-copy fences. The tests now exercise Settings & more and Together, and retain the books writer/scope assertions. The second run exceeded the five-minute soft budget (380.8 seconds, slowest phase TypeScript). Final rerun recorded below.
- Financial final delta rereview: **PASS**, three independently rerun conservation regressions; no remaining material finding in the bounded review.
- Education primary sources checked 2026-09-11; links and scope are in the packet.
- Local logs: `.artifacts/fund-life-quick-complete.log`, `.artifacts/fund-life-build.log`, `.artifacts/fund-life-enabled-build-final.log`, `.artifacts/plan-life-browser-final.log`, `.artifacts/plan-life/report.json`. Screenshots and logs are ignored fictional evidence, not committed household data.


## Changed surfaces

- `src/core/planProjection.ts`, `planLearning.ts`, `planSystem.ts`, `fundHorizon.ts`: canonical consequences, signed evidence, reserve backing, exact schedules, contextual lessons and additive contracts.
- `src/PlanStudio.tsx`, `PlanLensWorkbench.tsx`, `PlanBridgeEditor.tsx`, `PlanReflectionEditor.tsx`, `plan-studio.css`: four decision journeys, alternatives, exact review, search, private preparation and durable Sitdown stages.
- `src/Hercules.tsx`, `HerculesActionPanel.tsx`, Plan read/action/context/provenance/catalogue modules: one contextual conversation, editable actions and explicit private preferences.
- `src/HouseholdLife.tsx`, `App.tsx`, `ledgerExperience.ts`, `sharedBoards.ts`: active-Plan Home, four Shared destinations and accepted next steps on the existing boards.
- `src/core/commands.ts`, `src/ledgerSync/{protocol,authority,client}.ts`, `workers/{ledgerRoom.ts,site.js}`: actor/version guards, continuity capability negotiation and bounded Shared reply context.
- New projection/contract/UI/browser tests and fixture; existing App navigation tests updated to the intentional Shared shell labels. Test mapping preserves the protected App and Bianca canaries.
- D-242, roadmap, docs index and generated Hercules inventory updated. [Durable implementation packet](../briefs/HOUSEHOLD_FUND_LIFE_PLAN_IMPLEMENTATION.md).

## Independent review

The financial reviewer reproduced and root fixed transfer-leg reuse, current-versus-historical reserve backing, overdue/payment-template and installment timing, future accepted Personal cash and Calendar attribution. The final bounded rereview reports no remaining material defect and independently passes the three future-payment conservation regressions.

The privacy/integration reviewer verified owner-only preferences, omission from partner/Shared reads and envelopes, owner roundtrip, foreign actor/stale write rejection and Shared Worker context. A broad preference matcher was narrowed so “forget that preference” retains the existing conversational-memory path. Root added a routing regression.

## Remaining uncertainty

Live authentication/provider, full replay/restore, physical accessibility and independent product comprehension remain acceptance gates, as described in the packet. Supported local fixtures do not establish those results. Current unsupported evidence states return review requirements rather than confident allowances. Personal identity, generalized custody and new debt amortization are not introduced.

## Final local result and handoff

- **High-risk quick gate PASS:** 36 files, 418 tests (278 fast + 140 serial); AI-surface and TypeScript pass. Final elapsed 171.7 seconds; within the five-minute target. Earlier 380.8-second breach remains recorded above. This is the change-focused gate, not an exhaustive certification.
- **Enabled build PASS:** `VITE_PLAN_SYSTEM_V2=1`, `VITE_HERCULES_ACTIONS=1`, `VITE_HERCULES_CHAT=1`; Vite and Hercules packaging complete; no `dist/_redirects`. Final Vite phase 23.24 seconds. No deployment was performed.
- **Browser PASS:** 12 combinations / 48 lens accessibility scans; actual components and fictional data. The final App-only Ask navigation correction is independently covered by the passing mounted App test, which verifies the selected Shift Ask panel and no ledger save.
- **Review PASS within scope:** financial conservation and private/shared context reviewers; material findings resolved. Diff whitespace and new documentation links checked.
- Tested working-change fingerprint: `f776bfa082c886a6dde7d119c2ea808149bd116f68b5f1862d7a28d43a1f06be` against base `71ccc242bd44bed60ccc5eb8c8865ecd852f76c6`. Only evidence documentation was finalized afterward.
- **Go:** local implementation review. **Not claimed:** deployment, two-authenticated-partner acceptance or Production readiness. No hosted schema, external document, real household data or credentials were changed.
- **Next owner:** Jonathan for product/release decisions; the next integrator verifies the branch against current main and preserves PR #433's named live acceptance gates. Release authorization remains separate from this local implementation.
