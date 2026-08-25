# Worksession — The Onboarding Update

- **Opened:** 2026-08-25, America/Toronto
- **Status:** ACTIVE — Part 1 planning and review
- **Baseline:** `main@44156f9` (PR #100 merged)
- **Branch:** `codex/onboarding-planning`
- **Owner:** Codex planning/integration; Jonathan product decisions; Cursor remains on migrations
- **Risk:** High — future opening balances and guided commands touch financial meaning; this Part 1 change is documentation/review only
- **Environment:** local Development inspection only
- **Hosted mutations:** none
- **Schema/migrations/Auth/RLS/Production/deploy:** explicitly out of scope

## Household outcome

Bianca can enter the household with Google, optionally follow Hercules through a modular phone/desktop tutorial, bring accounts to a truthful current starting point, practice or perform approved real workflows, and finish ready for the September trial.

## Four parts

1. Planning and comprehensive interface review.
2. Animation and interaction storyboards.
3. Modular onboarding/progress/scenario foundation.
4. Animation, interaction, command integration, and release proof.

## Part 1 work completed so far

- Verified PR #100 is merged and used it as the baseline.
- Audited phone Home, Calendar, Appointments, Bills, Google, Plan, Books, More, and Add as Jonathan and Bianca.
- Audited the wide Office control surface and all source button families.
- Counted 309 literal button elements across 41 TSX files and grouped repeated controls into tutorial decisions.
- Verified no obvious inert literal button; separated wired from onboarding-ready.
- Identified opening truth as missing, current first-run lesson persistence as device-local/flat, stale cloud copy, incomplete Google suite surfaces, and one Google-reminder enabled-state issue.
- Reviewed existing Hercules motion, page/instrument copy, Office intent routing, and reduced-motion fences.
- Researched Apple, YNAB, Finch, Actual Budget, Duolingo, and W3C guidance.
- Drafted the control disposition matrix, Bianca chapter map, Hercules scripts, extensible architecture direction, and acceptance gates in [`docs/ONBOARDING_UPDATE.md`](../ONBOARDING_UPDATE.md).

## Dual Course

- **Budget delta (5): +5 planned** — truthful opening balances, account literacy, Confirm, correction, transfer meaning, work income, Calendar settlement, Health, and continuity become one learnable first-month path.
- **Engagement delta (3): +3 planned** — Hercules becomes an intentional guide using existing presence, perches, gestures, page truth, and optional delight instead of a detached help centre.

No runtime delta is claimed in Part 1 because no product code or books changed.

## Decision needed

Approve the recommended scenario rule: real stated balances use real commands and Confirm; demonstration transactions/shifts stay in a visibly temporary Practice kitchen unless Bianca explicitly converts one to a real draft.

## Verification

- Local browser inspection at 390 × 844 plus the wide Office surface.
- Static interface scan: 309 literal button elements across 41 TSX files; no obvious inert button path.
- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec vitest run --maxWorkers=1 --testTimeout=15000` — 62 files, 447 tests passed.
- The default parallel `pnpm test` run caused existing long PGlite/scale tests to exceed their time limits on this machine; the isolated serial gate completed cleanly.
- `git diff --check` — clean.

## Next action after approval

Start Part 2 with paired phone/desktop storyboards, animation state diagrams, target/focus behavior, skip/resume/replay flows, and reduced-motion equivalents. Do not implement onboarding runtime or money commands during Part 2.
