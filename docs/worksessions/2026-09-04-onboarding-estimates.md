# Hearth worksession — Onboarding Chapter 10 estimates

- **Status:** CLOSED; LOCAL IMPLEMENTATION AND PROOF COMPLETE
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/20-ch10-estimates`
- **Baseline SHA:** `8b035ffaaf75f60dcebfc9cf1b08a448f69d1ba9`
- **Implementation SHA:** `1429142beb8fd33089d2e68100f0bda708ad0488`
- **PR or issue:** none; local implementation only
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none; synthetic local Development fixtures only

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

- [x] Required reassurance copy is byte-exact.
- [x] Drafts remain component-local until explicit Submit.
- [x] Blank and zero produce different stored and rendered states.
- [x] One submission waits without revealing the partner's numbers.
- [x] Both submissions reveal author-labelled rows without comparison or totals.
- [x] Estimates tied to an older category set do not complete the probe.
- [x] Shared merge and command-event replay retain zero and missing distinctly.
- [x] No journal, budget plan, Fund event, contribution, or approval changes.
- [x] Medium quick gate, build, AI verification, Windows attempt, and live browser
  proof at 320 / 390 / 720 / 1100 are recorded.

## Plan

- [x] Add the pure estimate state and evidence projection.
- [x] Build and route the existing-Plan Chapter 10 surface.
- [x] Add focused command, continuity, privacy, UI, and source-fence tests.
- [x] Run focused/adjacent checks and repair findings.
- [x] Commit the implementation, run exact-clean-head proof, and close handoff.

## Evidence log

- Focused and adjacent estimate/copy/submission/category/evidence/conductor/runtime
  proof passed 142/142 tests, including 20 Slice 20 contract and UI tests.
- An independent read-only audit found four release-blocking edge cases. The
  repair binds estimate records to exact category ids instead of clocks, rejects
  pending-category and forged replay/accepted-write scopes, destroys a draft on
  member/household scope change, and focuses/describes the invalid money field.
  Regression tests cover every finding.
- Exact clean implementation SHA `1429142` passed the Medium quick gate in
  53.3 seconds: 69 fast plus 7 serial PGlite proof tests, TypeScript,
  AI-surface, and diff hygiene. Fingerprint
  `6e10e2e212ee3445aa4c93d6e2d864cdb005e4a583e29816267f19b3ad8aa3a0`;
  the five-minute budget was not breached and the gate correctly required
  separate UI proof.
- Production `pnpm build` passed TypeScript, 469 Vite modules, Hercules Pro UI,
  and the no-`dist/_redirects` fence. Only the existing PGlite browser-external,
  eval, dynamic-import, and large-chunk warnings appeared.
- `pnpm ai:verify` passed 48 required files and both Clerk fences.
- `pnpm check:windows` could not start because this macOS host has no `pwsh`;
  no Windows result is claimed.
- Actual-component browser proof covered draft, invalid entry, waiting,
  category-set-changed, and two-author reveal states at 320, 390, 720, and
  1100 px. No horizontal overflow occurred; inputs were 48 px and Submit was
  49 px; keyboard-only Submit reached the private waiting state; invalid input
  focused and described its own field; reduced motion removed all animations
  and transitions; scoped axe WCAG A/AA scans reported zero violations at every
  width; and the clean proof tab logged no console warnings or errors. The first
  320 px visual inspection found and repaired a heading collision. Temporary QA
  files, tab, viewport override, and Vite server were removed.

## Decisions

An explicit submission is the record that every category in the then-current
accepted set was reviewed. An absent estimate row therefore means deliberately
missing, while an included zero-cent row means an answered `$0.00`. The record
carries the exact sorted accepted category ids: identity, not a device clock,
decides whether the estimate still covers the current set.

## Remaining uncertainty

The Windows lane remains unproved on this macOS host. A hosted two-account
delivery run is release evidence and was neither authorized nor required for
this local Medium slice.

## Handoff

Local implementation and proof are complete at `1429142`. Jonathan separately
decides whether to push or open a PR. Merge, deployment, hosted mutation, and
Production remain separate decisions.
