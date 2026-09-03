# Hearth worksession — onboarding privacy-scoped evidence

- **Status:** READY FOR PR
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/5-evidence`
- **Baseline SHA:** `5bd5da2025c5c34ad19bebdde66dd66f09666980`
- **Head SHA:** pending
- **PR or issue:** pending
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Onboarding evidence cites accepted rows without exposing one member's Personal facts to the other member or to the witness surface.

## Budget delta (5)

`+3`: cited source rows, explicit stale/conflict/tie failures, and a fail-closed privacy boundary make onboarding claims auditable without changing books.

## Engagement delta (3)

`+1`: concise evidence cards can acknowledge work already completed without adding timers, scores, or prompts.

## Verified baseline

- The clean branch begins at `origin/main@5bd5da2025c5c34ad19bebdde66dd66f09666980`, the merge of onboarding slice 4.
- Shared continuity excludes Personal account/transaction state, while an assembled local household may contain the signed-in member's Personal overlay.
- Current typed canonical facts support evidence for the handshake, household identity, Charter, accounts, opening truth, Fund, recurrences, cadence, an eventual adoption receipt, and a Ready transaction.
- Category and estimate submissions are later typed contracts, so their chapters must remain honestly empty until those records exist.

## Scope

### In scope

- Exact Evidence scope/card/result contracts and the two projector entry points.
- Household-first, self-Personal fallback evidence with a witness-only household subset.
- Current canonical chapter projections, non-empty citations, and explicit malformed/stale/conflicted/untied/privacy results.
- Twelve-chapter owner/partner privacy matrix, source, ineligibility, narrowing, and source fence tests.
- Core export and D-207.

### Out of scope

- UI, rendering, probe acceptance, progress mutation, later submission/approval schemas, model/provider calls, command execution, money behavior, schema, hosted data, Production, merge, and deployment.

## Acceptance evidence

- [x] Twelve owner/partner chapter pairs contain no partner-Personal ids.
- [x] Every accepted card has at least one source id.
- [x] Witness evidence is household-only and never widens.
- [x] Every ineligible reason is reachable and remains distinct from empty.
- [x] Source fence contains no DOM, browser global, component, or command-module import.
- [x] High quick gate passes against the complete working diff; an exact committed-head rerun is pending.

## Plan

- [x] Re-anchor from current main and inspect privacy and contribution fences.
- [x] Implement the pure evidence projector over current canonical facts.
- [x] Add the twelve-chapter privacy matrix, negative states, and D-207.
- [x] Run focused proof, build, AI verification, and the High quick gate.
- [ ] Inspect, push, open the slice PR, and stop before merge/deploy.

## Evidence log

- `git status --short --branch` was clean before this worksession was created.
- `pnpm vitest run test/onboarding-evidence.test.ts`: 19/19 passed after final review.
- `pnpm exec tsc --noEmit`: passed after final review.
- `pnpm test -- --risk=high --focus=test/onboarding-evidence.test.ts --focus-reason="Onboarding slice 5 changes the pure evidence projector and its privacy/integrity contract"`: passed against the complete working diff (`40` selected fast tests and `7` serial proof-matrix tests; `141.372s`; fingerprint `71327353a5980a0b48815e5a90fe5f7f243b89810321140307a77635ce961393`; no budget breach).
- `pnpm build`: passed (`444` modules); existing PGlite browser-external/eval and large-chunk warnings remained warnings.
- `pnpm ai:verify`: passed (`48` required files and `2` Clerk fences).
- `pnpm check:windows`: unavailable on this Mac because `pwsh` is not installed; no Windows result is claimed.
- `pnpm test:full` was not run because this High slice authorizes the risk-focused quick gate, not an exhaustive full gate.
- Exact committed-head quick-gate and PR evidence pending.

## Decisions

- Onboarding proves completion with cited rows.
- Partner-Personal facts are omitted rather than summarized; witness projection can only remove evidence.
- Later chapters remain empty until their typed source records exist.

## Remaining uncertainty

- Submission, plan-adoption, and Ready-approval records land in later slices and may extend the corresponding projectors without weakening this scope boundary.
- Exact-head CI remains pending until the PR exists.

## Handoff

Codex owns implementation and proof. Stop after the exact slice-5 PR is open and verified; merge and Development publication require a later explicit instruction.
