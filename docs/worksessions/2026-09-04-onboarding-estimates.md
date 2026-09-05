# Hearth worksession — Onboarding Chapter 10 estimates

- **Status:** OPEN
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/20-ch10-estimates`
- **Baseline SHA:** `8b035ffaaf75f60dcebfc9cf1b08a448f69d1ba9`
- **Head SHA:** `8b035ffaaf75f60dcebfc9cf1b08a448f69d1ba9`
- **PR or issue:** none; local implementation only
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Each person privately gives a first monthly guess for the accepted household
categories. Blank and zero remain visibly different. Nothing is shared until
Submit; after both submit, the two authored lists are shown without totals,
ratios, ranking, or comparison.

## Budget delta (5)

Improves the first-plan input by preserving author, category, integer cents,
and an explicit missing answer without creating a budget or posting money.

## Engagement delta (3)

Makes the first plan feel forgiving: one calm card, reassuring language, clear
blank-versus-zero treatment, patient waiting, and a non-competitive reveal.

## Verified baseline

- `origin/main`, branch base, and `HEAD` are the same merged Slice 19 SHA:
  `8b035ffaaf75f60dcebfc9cf1b08a448f69d1ba9`.
- The worktree was clean before implementation.
- The no-diff Medium quick gate passed in 70.4 seconds. It ran diff hygiene,
  AI-surface verification, and TypeScript; no tests were selected because the
  branch had no changed files.
- Slice 18 already supplies self-owned explicit estimate submissions,
  replacement history, Shared convergence, and command-event replay.
- Slice 19 supplies the accepted deterministic category set and Plan focus
  pattern. Chapter 10 evidence is still intentionally empty and no Chapter 10
  surface is wired.

## Scope

### In scope

- A pure Chapter 10 estimate-state projector tied to the current accepted
  category set.
- Household evidence after both current submissions only.
- A private local draft, explicit Submit, patient waiting state, and authored
  reveal on the existing Plan route.
- Missing-versus-zero, stale-set, continuity, privacy, source-fence, responsive,
  keyboard, and accessibility proof.
- Copy-deck, conductor-route, canon, and handoff updates required by the slice.

### Out of scope

- Budget proposal math, run-rate logic, approvals, plan adoption, postings,
  contributions, ratios, ownership, ranking, provider/model calls, schema,
  hosted rows, secrets, Production, deployment, push, or merge.

## Acceptance evidence

- [ ] Required reassurance copy is byte-exact.
- [ ] Drafts remain component-local until explicit Submit.
- [ ] Blank and zero produce different stored and rendered states.
- [ ] One submission waits without revealing the partner's numbers.
- [ ] Both submissions reveal author-labelled rows without comparison or totals.
- [ ] Estimates tied to an older category set do not complete the probe.
- [ ] Shared merge and command-event replay retain zero and missing distinctly.
- [ ] No journal, budget plan, Fund event, contribution, or approval changes.
- [ ] Medium quick gate, build, AI verification, Windows attempt, and live browser
  proof at 320 / 390 / 720 / 1100 are recorded.

## Plan

- [ ] Add the pure estimate state and evidence projection.
- [ ] Build and route the existing-Plan Chapter 10 surface.
- [ ] Add focused command, continuity, privacy, UI, and source-fence tests.
- [ ] Run focused/adjacent checks and repair findings.
- [ ] Commit the implementation, run exact-clean-head proof, and close handoff.

## Evidence log

Evidence will be recorded against exact branch SHAs; no Slice 19 proof is reused.

## Decisions

An explicit submission is the record that every category in the then-current
accepted set was reviewed. An absent estimate row therefore means deliberately
missing, while an included zero-cent row means an answered `$0.00`. The record
carries the exact sorted accepted category ids: identity, not a device clock,
decides whether the estimate still covers the current set.

## Remaining uncertainty

Browser and Windows proof remain open. No hosted two-account continuity run is
authorized or required for this local Medium slice.

## Handoff

Codex owns implementation and local proof. Jonathan separately decides whether
to push, open a PR, merge, deploy, or run hosted evidence.
