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
- Forward-only PGlite schema v10 and projection rows.
- Legacy Household budget adoption and accepted-version compatibility projection.
- Plan-specific Hercules provenance, context, read tools, planner routes and reviewed planning actions.
- PlanStudio desktop/mobile UI, three themes, Personal/Household variants, Sitdown, learning, Bridge and Hercules.
- `VITE_PLAN_SYSTEM_V2` rollback boundary, default off.

### Out of scope

- Production schema, hosted mutation, feature activation, deployment, push or merge.
- Money movement; every Plan action remains non-financial.
- A server-authored authority for persisting Hercules turns into Shared Sitdown history.
- External notifications.

## Acceptance evidence

- [x] TypeScript passes.
- [x] Production build passes.
- [x] High change-focused quick gate: 89 tests total (77 fast + 12 serial), 35.337 s, no time-budget breach.
- [x] Focused Plan/Hercules/import/PGlite suite: 52 tests pass.
- [x] Twelve Chromium theme/ledger/device cases at 390 and 1440 px: no horizontal overflow, four lenses, minimum 44 px controls, Plan-context Hercules response, visible keyboard focus, reduced motion, and zero automated WCAG 2.1 AA violations.
- [ ] Authenticated two-browser Shared Sitdown convergence and independent acknowledgement.
- [ ] Full event compaction, backup, import and restore corpus.
- [ ] Physical phone, VoiceOver and product acceptance by Jonathan and Bianca.
- [ ] Exact clean release-head exhaustive gate; requires separate authorization.

## Evidence log

- `pnpm exec vitest run test/household-fund-pglite.test.ts test/plan-system.test.ts test/hercules-actions.test.ts test/hercules-tools.test.ts test/hercules-pro.test.ts test/ledger-import-parity.test.ts --pool=forks --maxWorkers=1` → 52/52 pass.
- `pnpm test -- --risk=high --focus=test/plan-system.test.ts --focus-reason=...` → quick-gate-passed; 89 tests, 35.337 s.
- `pnpm build` → pass; Vite client and Hercules Pro UI built.
- `node test/plan-studio-layout.mjs` → 12/12 local synthetic browser cases pass. Artifacts: `.artifacts/plan-studio/` (ignored local evidence).

## Decisions

- D-239.
- A client cannot label a Shared Sitdown member turn as Hercules. Controlled Hercules response persistence stays gated instead of accepting spoofable role input.
- Personal view can read only accepted/scheduled Shared Plan versions, never Shared proposals or another member's Personal planning records.

## Remaining uncertainty

- Shared Hercules answers work as scoped reads, but Hercules-authored Shared transcript persistence still needs a trusted server response receipt.
- The contracts support reflection, coaching state and complete Bridge history, and PlanStudio exposes nudge snooze/dismiss controls. It does not yet expose every partner Bridge transition or a line-by-line reflection editor.
- Automatic scheduled-to-active state transition needs a durable authority tick rather than a display-time mutation.
- Automated accessibility passed; physical assistive technology and touch acceptance have not been performed.

## Handoff

Next owner: Jonathan for local product review. Keep the feature flag off. The next engineering slice should close controlled Shared Hercules replies, the reflection editor and partner Bridge transitions, then run authenticated two-browser and replay/restore acceptance. No release, deployment, Production schema, or activation is authorized by this worksession.
