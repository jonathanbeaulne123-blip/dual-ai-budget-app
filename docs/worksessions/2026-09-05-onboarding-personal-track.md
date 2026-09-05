# Hearth worksession — onboarding personal track

- **Status:** CLOSED; LOCAL QUICK-GATE + BUILD + UX VERIFIED
- **Opened:** 2026-09-05 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/26-personal`
- **Baseline SHA:** `58e90df5f40dfdba1399f6a8f35c8efe8fb62c15`
- **Head SHA:** `4495386b74da1249d3a6afc535e5ca172cad5cdc` (implementation; handoff documentation follows)
- **Implementation SHA:** `4495386b74da1249d3a6afc535e5ca172cad5cdc`
- **PR or issue:** none
- **Risk:** Low
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

After household setup, each person may receive a quiet, contextual Hercules offer for one useful Personal module. Offers never lock Hearth, gate the household, reveal partner-Personal facts, or run more than once per session and twice per household week. Each module may be opened, declined, skipped, resumed, or muted by its owner.

## Budget delta (5)

`+1` — Personal-versus-Household, account, shift, tip-oracle, and personal-plan literacy become discoverable from accepted facts without changing those facts.

## Engagement delta (3)

`+2` — Hercules offers one timely lesson instead of presenting a checklist or nagging; `Not now`, per-module skip, and a member-owned mute remain immediately available.

## Verified baseline

- `origin/main` and branch HEAD are `58e90df5f40dfdba1399f6a8f35c8efe8fb62c15`.
- Slice 25 is merged at parent `e58aafb9b414f1fd2d30b3e1a733eb4b1f7b2396`.
- `personalModules()` is empty, while Slice 3 already carries member-owned `offersMuted` and `declineCountByModule` state plus self-owned mute/skip commands.
- The current conductor shell only replaces ordinary Hercules while household setup locks him; Personal modules need an optional, non-locking entry path.

## Scope

### In scope

- Six registry rows and exact typed trigger predicates from Slice 26.
- Member-Personal offer/decline history sufficient to enforce session, weekly, and monthly caps across device merges.
- Self-owned commands for offer and decline records, reusing the existing Personal progress envelope.
- A gentle Hercules Personal-module offer and lesson state on the existing mobile focus and desktop chat surfaces.
- Individual skip/resume/out-of-order behavior, member-owned mute, copy-deck additions, focused tests, and responsive/accessibility proof.

### Out of scope

- Household locks, household final gates, money commands, posting, budgets, journals, Health formulas, provider/model calls, schema, hosted-data operations, secrets, Production, deployment, push, or merge.
- New App routes or replacement account/shift/office/chat surfaces.
- Slice 27 lifecycle behavior.

## Acceptance evidence

- [x] All six modules are valid personal, non-gating, member-skippable registry rows.
- [x] Every trigger is a pure predicate over typed state and explicit session context.
- [x] At most one offer is recorded per session and two per household week.
- [x] Two declines suppress that module for the current month without suppressing it forever.
- [x] Mute, offer, decline, skip, and completion writes are self-owned and stay in one Personal envelope.
- [x] Personal modules never appear in `householdGatesOutstanding()`.
- [x] Existing shell plus new Personal states pass focused tests, build, quick gate, and 320/390/720/1100 browser checks.

## Plan

- [x] Baseline current relevant tests.
- [x] Add the registry and pure offer policy.
- [x] Extend member-Personal progress and commands with merge-safe offer facts.
- [x] Add the optional Hercules presentation and copy.
- [x] Run focused and adjacent tests, quick gate, build, and browser proof.
- [x] Close the worksession and update the handoff.

## Evidence log

- 2026-09-05: created an isolated worktree from `origin/main@58e90df5f40dfdba1399f6a8f35c8efe8fb62c15`; baseline registry/progress/conductor/copy proof passed 71/71.
- 2026-09-05: implementation commit `4495386b74da1249d3a6afc535e5ca172cad5cdc` adds the six modules, pure trigger/offer selector, merge-safe Personal history, self-owned commands, Hercules entry, responsive shell, copy, and tests.
- 2026-09-05: focused Slice 26 plus conductor/progress/registry/copy proof passed 77/77; the complete onboarding and adjacent command suite passed 481/481 across 33 files.
- 2026-09-05: the final change-focused quick gate passed in 41.1 seconds at the repository's Medium tooling floor: diff hygiene, AI surface, TypeScript, 78 fast tests, and 7 serial PGlite proof tests.
- 2026-09-05: the production build passed with 478 Vite modules plus Hercules Pro UI. Existing PGlite browser externalization, eval, and large-chunk messages remain warnings rather than Slice 26 failures.
- 2026-09-05: actual-component Chromium verified 320/390/720/1100 px, 44 px minimum controls, controlled mobile inner scrolling without body-width overflow, keyboard focus wrap, reduced motion, saving state, all six module variants, actual mobile and desktop Hercules entry, navigation close, and same-session silence. A clean final harness load had no console warning or error.
- 2026-09-05: final privacy/trust review found no household-gate leakage, partner-Personal trigger read, cross-member write, financial writer, schema/provider/hosted/Production action, credential, or unsupported release claim.

## Decisions

- D-226 records the implemented Personal-track boundary and extends D-205's already-decided member-owned offer controls.
- Opening a target room does not silently complete a guide. The member may resume it in a later eligible session; only `Got it` records completion.
- The manual's time budgets remain guidance per Jonathan's standing instruction; complete and gentle behavior takes priority.

## Remaining uncertainty

- PowerShell is unavailable on this macOS host, so no Windows result is claimed.
- Browser and merge proofs use synthetic local Development state. No hosted two-account, exhaustive-suite, deployment, or Production claim is made.

## Handoff

Slice 26 is a verified local release candidate. Local branch only: no PR, push, merge, deployment, hosted mutation, or Production action was authorized or performed. Jonathan separately decides release; deployment remains a separate instruction.
