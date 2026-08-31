# Hearth worksession — Last-entry-wins sync

- **Status:** RELEASE REVIEW PASS — Development publication in progress
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/last-entry-wins`
- **Baseline SHA:** `b44396912823b62c4f6bde025f7e0699651f330d`
- **Reviewed runtime SHA:** `aa774baed47183dd4ca4a3ee66a21d0a1c0c9447`
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development code only; no hosted mutation

## Household outcome

Two valid device histories reconcile in the background. The later accepted version of one entry wins deterministically, distinct entries remain, and no person is asked to choose between a phone and cloud snapshot.

## Budget delta (5)

`+4`: removes a whole-ledger discard decision from ordinary synchronization while retaining command idempotency, PGlite acceptance, double-entry validation, Personal scope, and an auditable command order.

## Engagement delta (3)

`+3`: removes the blocking “Two versions need review” sheet. Healthy reconciliation is quiet; transport failure remains a non-blocking background retry state.

## Verified baseline

- Current clean baseline is `origin/main@b44396912823b62c4f6bde025f7e0699651f330d`.
- The live screenshot shows the legacy whole-snapshot conflict chooser.
- Command events are already ordered by hosted `result_revision`, then `created_at`, then event id.
- Disjoint financial rows already converge; same-id divergence still records an unresolved conflict.
- Snapshot merge code already supports record-level last-write-wins by `updatedAt`, but the conflict path does not use it.
- Persisted conflict records and conflict-blocked outbox rows can survive refresh.

## Scope

### In scope

- Later ordered command event wins for the same financial row id.
- Snapshot recovery merges financial rows record-by-record and uses the caller’s canonical later side as the deterministic tie-break.
- Persisted conflicts self-resolve and conflict-blocked outbox work resumes automatically.
- Remove the conflict chooser from the app and its review copy.
- Focused convergence, accounting, duplicate, Personal-scope, and old-conflict recovery tests.

### Out of scope

- Production continuity enablement, schema changes, hosted-row mutation, Production deployment, or secrets.
- Literal character-by-character co-editing.
- Removing exports, command receipts, reversal history, tombstones, or PGlite validation.
- Changing Confirm authority or allowing Realtime/Hercules to create money.

## Acceptance evidence

- [x] Two disjoint entries from different devices both remain.
- [x] Later ordered same-id event wins without an unresolved conflict.
- [x] Duplicate delivery still applies once.
- [x] Partner Personal events remain hidden.
- [x] A persisted conflict record resolves without rendering a chooser.
- [x] A recovered pending household recreates a missing durable outbox automatically.
- [x] Reconciled candidates pass current books/PGlite gates.
- [x] Reversals, tombstones, and append-only Fund/goal facts cannot be rewritten by delayed same-id events.
- [x] Focused tests, `pnpm check`, and independent High-risk review passed.

## Plan

- [x] Implement deterministic record-level reconciliation.
- [x] Remove blocking conflict UI and stale review actions.
- [x] Update living canon and decision record.
- [x] Run focused and full verification.
- [x] Rebase onto current main and repeat exact-head verification.
- [x] Obtain independent money/trust and end-to-end release review PASS.
- [ ] Push, merge, publish the Development kitchen, and verify the exact live asset.

## Evidence log

- Clean worktree created from freshly fetched `origin/main`; the dirty `codex/roadmap-site` checkout was not modified.
- Jonathan explicitly authorized release after the local verified handoff. This authorizes commit, push, merge, and Development kitchen publication only; schema, hosted-row, secret, and Production changes remain out of scope.
- Release fetch found `origin/main@201a449cb99251c8a66eb3b282d950305752d1f1`, 13 commits ahead of the verified baseline. Current main owns D-185 for the P0-03 evidence gate; this packet was renumbered D-186 during the clean rebase.
- Pre-rebase focused gate: 12 files, 124 tests passed; TypeScript clean.
- Current-main focused gate: 7 files, 78 tests passed.
- Exact rebased `pnpm check`: AI surface verified; 211 test files passed / 2 skipped; 1,410 tests passed / 3 skipped / 0 failed; TypeScript, kitchen production build, Hercules Pro UI build, and no-redirect guard passed.
- Independent exact-head verifier: PASS, no P0/P1; 12 focused files / 119 tests, TypeScript, and `git diff --check` passed. Independent exact-head money/trust audit: PASS, no P0/P1.
- Release review: PASS on runtime candidate `aa774baed47183dd4ca4a3ee66a21d0a1c0c9447` against `origin/main@201a449cb99251c8a66eb3b282d950305752d1f1`. No secret, schema, hosted-row, or Production-continuity file changed.

## Decisions

- Jonathan’s 2026-08-31 instruction supersedes D-180’s explicit same-fact review rule: normal collaboration must not ask a household member to choose a whole snapshot.
- Canonical command order is hosted revision order. Snapshot recovery uses existing row `updatedAt` ordering with an explicit later-side tie-break, then re-enters the normal PGlite acceptance and hosted CAS boundary.

## Remaining uncertainty

- Live two-device proof remains separate from local deterministic proof; the D-180 100-event and fourteen-day Development rehearsal are still open.

## Handoff

Local implementation, current-main verification, independent review, and release review are complete. Jonathan authorized push, merge, and Development kitchen publication. Live signed-in two-device use remains a separate evidence gate.
