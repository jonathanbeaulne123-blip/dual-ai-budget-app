# Worksession — The Onboarding Update

- **Opened:** 2026-08-25, America/Toronto
- **Status:** ACTIVE — Parts 1–2 planned; foundation implementation not started
- **Baseline:** `main@9f50aae` (PR #101 merged)
- **Branch:** `codex/onboarding-planning`
- **Owner:** Codex planning/integration; Jonathan product decisions; Cursor remains on migrations
- **Risk:** High — future opening balances and guided commands touch financial meaning; Parts 1–2 are documentation/review only
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

## Decision locked — D-128

Jonathan approved the recommended scenario rule: real stated balances use real commands and Confirm; demonstration transactions/shifts stay in a visibly temporary Practice kitchen and are discarded unless Bianca explicitly copies one into a real draft. Copying never posts—the ordinary review and Confirm boundary still applies. Practice state never enters journals, continuity snapshots, reports, streaks, or accepted-money progress.

## Part 2 locked — D-129

The complete phone/desktop motion and interaction contract is in [ONBOARDING_PART2_STORYBOARD.md](../ONBOARDING_PART2_STORYBOARD.md). It locks automatic first-entry start, one persistent Skip action, More replay, full control locking, deliberate Hercules routes, simulated camera focus/background blur, Pokémon-rhythm typed dialogue, Practice transaction/correction/four-hour shift, editable tone variants, silent animation, device-specific location lessons, and the Ready for September finale.

Jonathan explicitly requires full onboarding animation without a reduced-motion substitute. The motion is client-side and consumes no service quota. Record the accessibility exception truthfully; do not weaken the rest of Hearth's existing reduced-motion behavior.

Implementation split: Cursor owns the declarative foundation under the exact [Slice A prompt](../briefs/CURSOR_ONBOARDING_FOUNDATION_PROMPT.md); Codex owns real opening truth, Practice/financial scenario wiring, and approved phone/Office choreography; Cursor returns as an independent multi-model hardening reviewer.

## Verification

- Local browser inspection at 390 × 844 plus the wide Office surface.
- Static interface scan: 309 literal button elements across 41 TSX files; no obvious inert button path.
- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec vitest run --maxWorkers=1 --testTimeout=15000` — 62 files, 447 tests passed.
- The default parallel `pnpm test` run caused existing long PGlite/scale tests to exceed their time limits on this machine; the isolated serial gate completed cleanly.
- `git diff --check` — clean.

## Next action

Part 2 is complete as planning. Share the D-128/D-129 planning branch, then send Cursor the bounded Slice A foundation prompt. Do not let foundation work absorb opening-truth commands, Practice scenario wiring, migration files, providers, or final Hercules choreography.
