# Hearth worksession — Plan System V2 rebuild

- **Status:** ACTIVE; LOCAL GATED CANDIDATE; RELEASE ACCEPTANCE OPEN
- **Opened:** 2026-09-11 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/plan-system-rebuild`
- **Baseline SHA:** `b24dd73143b143ef96bfc856ba03cfb9272d802f`
- **Head SHA:** implementation commit recorded in the final handoff
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local code only, flag off

## Household outcome

Plan is rebuilt as one coherent monthly system without removing its top-level Personal or Household destinations. The new screen emphasizes decisions rather than category administration: four lenses, private drafts, consequences, alternatives, learning, Bridge disclosures, immutable history, the Sitdown, exact acknowledgement and a Plan-aware Hercules.

## Budget delta (5)

`+4`: the accepted Plan becomes an explicit, versioned intention layer separate from posted books. Scope-correct persistence removes Personal planning from Shared; exact digest acknowledgement removes implied partner agreement; legacy budget compatibility cannot overwrite a governed month; Fund agreement IDs no longer trust client-supplied partner IDs.

## Engagement delta (3)

`+3`: PlanStudio gives Personal and Household different voices and compositions, four tactile decision lenses, contextual learning, an eight-step couple Sitdown, Bridge review and a Hercules drawer. Classic is a planning desk/table, Taylor is a private/shared page spread, and Newfoundland is a route/waypoint system on both desktop and mobile.

## Verified baseline

The worktree was created from exact `origin/main@b24dd73143b143ef96bfc856ba03cfb9272d802f`; the user's existing dirty checkout was not modified.

## Scope

### In scope

- Plan contracts, shaping, deterministic digest and lifecycle commands.
- Personal/Shared envelope split, assembly, merging, visibility, import parity and command-event materialization.
- Forward-only PGlite schema v11 and projection rows.
- Legacy Household budget adoption and accepted-version compatibility projection.
- Plan-specific Hercules provenance, context, read tools, planner routes and reviewed planning actions.
- PlanStudio desktop/mobile UI, three themes, Personal/Household variants, Sitdown, learning, Bridge and Hercules.
- `VITE_PLAN_SYSTEM_V2` rollback boundary, default off.

### Out of scope

- Production schema, hosted mutation, feature activation, deployment, push or merge.
- Money movement; every Plan action remains non-financial.
- External notifications.

## Acceptance evidence

- [x] TypeScript passes.
- [x] Production build passes.
- [x] Change-focused quick gate: 98 tests total (86 fast + 12 serial; 7 hosted-harness tests skipped without its URL), 95.758 s, no time-budget breach.
- [x] Focused Plan/Hercules/import/PGlite suite: 61 tests pass.
- [x] Real local SQLite/Durable Object harness: 7 tests pass, including due Shared and member-Personal Plan activation as two scoped durable events.
- [x] Twelve Chromium theme/ledger/device cases at 390 and 1440 px: no horizontal overflow, four lenses, reflection and private Bridge review, minimum 44 px controls, Plan-context Hercules response, visible keyboard focus, reduced motion, and zero automated WCAG 2.1 AA violations.
- [ ] Authenticated two-browser Shared Sitdown convergence and independent acknowledgement.
- [ ] Full event compaction, backup, import and restore corpus.
- [ ] Physical phone, VoiceOver and product acceptance by Jonathan and Bianca.
- [ ] Exact clean release-head exhaustive gate; requires separate authorization.

## Evidence log

- `pnpm exec vitest run test/plan-system.test.ts test/plan-hercules-worker.test.ts test/hercules-actions.test.ts test/hercules-tools.test.ts test/hercules-pro.test.ts test/ledger-import-parity.test.ts test/household-fund-pglite.test.ts --pool=forks --maxWorkers=1 --testTimeout=30000` → 61/61 pass.
- local Wrangler `test/browser/ledger-worker.jsonc` plus `HEARTH_LEDGER_WORKER_URL=http://127.0.0.1:8791 pnpm exec vitest run test/ledger-sync-worker.test.ts ...` → 7/7 pass; the Plan clock snapshot returned revision 2 with Shared and Personal versions active.
- `pnpm test` → quick-gate-passed; 98 tests selected, 7 local-worker tests skipped in the URL-free phase, 95.758 s.
- `pnpm build` → pass; Vite client and Hercules Pro UI built.
- `node test/plan-studio-layout.mjs` → 12/12 local synthetic browser cases pass. Artifacts: `.artifacts/plan-studio/` (ignored local evidence).

## Decisions

- D-239 and D-241.
- A client cannot label a Shared Sitdown member turn as Hercules. Only the authenticated Worker may append an actor-less Hercules turn, bound to the exact member turn, Shared source revision, server receipt, response hash and provider.
- Bridge decline closes immediately when the partner supplies a reason. An author may withdraw any unaccepted proposal, including one held for the Sitdown.
- Household reflection has one Shared line-by-line outcome set and actor-bound member notes. Each partner reviews independently; editing invalidates the previous review state, and reflection never blocks the next Plan.
- Household activation jobs and derived Personal schedules wake at Toronto civil midnight. The Durable Object alarm is primary and authenticated snapshot is an idempotent backstop.
- Personal view can read only accepted/scheduled Shared Plan versions, never Shared proposals or another member's Personal planning records.

## Remaining uncertainty

- The trusted Shared Hercules route and actor/source/hash checks pass locally, but an authenticated two-browser Development session with a live provider has not been run.
- Reflection and Bridge editors are complete for this slice. Product copy, pacing and the partner handoff still need Jonathan and Bianca's hands-on review.
- Durable alarms and snapshot backstop pass the real local SQLite Worker harness. A deployed alarm firing with sleeping clients remains unverified until Development release authorization.
- Automated accessibility passed; physical assistive technology and touch acceptance have not been performed.

## Handoff

Next owner: Jonathan for local product review. Keep the feature flag off. The next acceptance slice is authenticated two-browser Shared Sitdown/Hercules convergence, alarm observation, replay/restore corpus and physical accessibility/product review. No release, deployment, Production schema, or activation is authorized by this worksession.
