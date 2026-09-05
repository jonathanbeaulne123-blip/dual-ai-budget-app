# Hearth worksession — self-owned onboarding approvals

- **Status:** CLOSED; LOCAL HIGH-GATE + BUILD VERIFIED
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/22-approvals`
- **Baseline SHA:** `e49e3ec10e89d2e64225fb472067a31743f51b29`
- **Implementation SHA:** `e84b72506b992ec4d2d5c2b111f1b308082fa11c`
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; synthetic local Development fixtures only

## Household outcome

Each active household member can approve only for themselves. The two people
must independently approve the same exact proposal or Ready digest; editing the
meaning creates a different digest and leaves old approval history visible but
unable to authorize the new version.

## Budget delta (5)

`+2` — exact-digest, two-seat approval creates a reviewable authorization seam
for later first-plan adoption without changing a plan or the books.

## Engagement delta (3)

`+1` — both people get equal agency and can approve asynchronously across
devices. This core contract adds no rendered surface.

## Verified baseline

- Fresh isolated worktree started from clean
  `origin/main@e49e3ec10e89d2e64225fb472067a31743f51b29`, after Slice 21 merged
  in PR #343.
- The no-diff High quick gate passed diff hygiene, AI-surface verification, and
  TypeScript with no selected test file.
- The repository manual is newer than the Downloads packet. Its Slice 22
  offline-merge rule required Shared sync and command-event replay wiring that
  the dated Modify list did not name; the list now records the narrow files the
  implementation actually needs.

## Scope

### In scope

- Immutable self-owned approval records for `proposal` and `ready` scopes.
- Exact household, active-member, scope, and digest lookup.
- Exactly-two-seat authorization.
- Deterministic Shared-envelope merge and compacted command-event replay.
- Accepted-write actor, command, posted-id, and single-change validation.
- Stale-history, collision, malformed-input, and no-money proof.

### Out of scope

- Approval UI, proposal editing, plan adoption, accepted budget writes,
  transactions, journal rows, Fund events or configuration consent, Personal
  payloads, schema, hosted rows, Auth/RLS, providers, model calls, secrets,
  Production, push, PR, merge, deployment, or hosted-live proof.

## Acceptance evidence

- [x] A member cannot approve, replace, remove, or impersonate the other member.
- [x] Old digests remain auditable and cannot authorize a current digest.
- [x] Proposal and Ready authority remain separate; Fund consent is excluded.
- [x] Two offline approvals converge without loss or order dependence.
- [x] Same-id divergent history and malformed replay fail closed.
- [x] Chat text cannot create an approval.
- [x] Journal, plans, Fund configuration, and accepted financial hash are unchanged.
- [x] High quick gate, production build, AI verification, and independent review are green.

## Plan

- [x] Verify current main, Slice 22 contract, and no-diff baseline.
- [x] Implement the append-only core record and two self-owned commands.
- [x] Wire bounded Shared continuity, accepted-write validation, and replay.
- [x] Add focused and adjacent authority, convergence, stale, and no-money tests.
- [x] Run final exact-head gates, review the diff, and close the handoff.

## Evidence log

- Focused Slice 22 proof passed 14/14 tests.
- Approval plus adjacent onboarding and continuity suites passed 164/164.
- The dirty-tree High quick gate passed 68 fast plus 7 serial PGlite tests in
  44.4 seconds, with TypeScript, AI-surface verification, and diff hygiene.
- Production build passed TypeScript, 471 Vite modules, Hercules Pro UI, and
  the no-`dist/_redirects` fence. Only existing PGlite browser-external/eval,
  dynamic-import, and large-chunk warnings appeared.
- No component or stylesheet changed. There is no rendered browser surface in
  Slice 22, so viewport or live-browser UX proof is not applicable.
- Independent High-risk review found activity-field smuggling, replay-conflict,
  compacted-provenance, freshness, identity-copy, and malformed-envelope gaps.
  Every finding was repaired with adversarial coverage; final re-review reports
  no remaining P0-P2 finding.

## Decisions

- D-222: onboarding approvals are immutable, self-owned, and exact-digest bound.
- `bothApproved` requires exactly two active member ids, each represented for
  the same household, scope, and digest.
- Approval materialization is part of command identity and continuity, but not
  the accepted financial audit hash.

## Remaining uncertainty

- Approval presentation belongs to Slice 24 and plan adoption belongs to Slice 23.
- Hosted two-account delivery is release evidence and is not authorized here.
- Windows proof depends on a host with PowerShell.

## Handoff

Local implementation and proof are complete. Push, PR, merge, deployment,
hosted mutation, and Production remain separate decisions.
