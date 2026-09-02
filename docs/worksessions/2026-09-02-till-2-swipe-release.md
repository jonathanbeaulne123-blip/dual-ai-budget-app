# Hearth worksession — Till Slice 2 repair and Development release

- **Status:** OPEN — POST-MERGE FORWARD REPAIR; FIRST DEPLOYMENT RELEASE-BLOCKED; CURSOR BLOCKED
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex (single writer); independent reviewers required
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/till-2-postmerge-repair`
- **Baseline SHA:** `02692d7791869057d0fc422d231751cef18ab0c6` (`origin/main`, after Register Slice 8 release)
- **Head SHA:** pending final exact-head review seal
- **PR or issue:** PR #298 merged the first pass; forward-repair PR #302 open; stale PR #295 and premature release-record PR #300 closed
- **Risk:** Release (High money/UI repair plus authorized Development merge/deploy)
- **Decision owner:** Jonathan
- **Environment impact:** Development kitchen code only

## Household outcome

The Household Fund custodian can record an ordinary shared-card purchase with amount then category, receive an accessible in-sheet recovery message if posting fails, and undo an accepted funded post through an explicit append-only reversal route. Background controls are truly inert while the sheet is open. Slice 3 receives one clean, deployed `main` baseline only after all release gates pass.

## Budget delta (5)

`+3` — a shorter ordinary Fund-purchase path preserves the command fence, balanced local acceptance, duplicate handling, and append-only correction semantics.

## Engagement delta (3)

`+3` — two focused taps, honest failure recovery, and a ten-second correction affordance reduce friction without adding a second writer or moving money.

## Verified baseline

- Current remote `main` is exactly `02692d7791869057d0fc422d231751cef18ab0c6`; the repair was rebased cleanly after the Register Slice 8 application and release-record merges.
- Historical `main@2b9f77051b4abfdddce2fd2f580e41a36a6c8772` is the PR #298 first Slice 2 merge over deployed D-197 custody and the original forward-repair base.
- PR #298's CI and Development deployment passed, but its late public review found four release blockers that green CI did not cover: reversal rows doubled reported spend; the ten-second strip was not ledger-scoped; a funded correction advertised an unusable second Undo; and document Enter overrode a focused Close button.
- The first merge remains in history and is repaired forward. It is not safe for Cursor Slice 3 and no real household write is used to test the repair.
- Cursor candidate `25ef99ef053abd56afe87dab363b873bf35f9dfd`, repaired pre-merge candidate `3ca2f5b301735a97f364a08134c81b021b258c45`, and first merge `2b9f770` are evidence only, not Slice 3 baselines.

## Scope

### In scope

- Rebase/replay Till Slice 2 onto exact current `main`
- Repair all recorded P1/P2 findings and add focused regressions
- Version and transactionally re-anchor the derived local PGlite projection
- D-198 canon and truthful Release handoff evidence
- Independent books/trust, privacy/continuity, UX/accessibility, and final release review
- User-authorized push, guarded merge, Development deployment, post-merge CI, and live no-store/asset verification

### Out of scope

- Till Slice 3 implementation, Till navigation/surface, camera, receipt, or OCR
- Hosted schema/migration, hosted household-row mutation, secrets, provider settings, bank connection, or Production continuity/data
- New financial formula, second Fund fold, second writer, or money movement

## Acceptance evidence

- [x] Rejected Swipe posts are visible and announced inside the active modal with a clear retry/correction path
- [x] Background application controls become inert while Swipe is open and restore on close
- [x] Swipe has one dialog title and an `Amount` pad label
- [x] Funded Undo routing is explicit by supported command kind, never inferred from a `FUND-EVT-` id alone; command identity persists across reload
- [x] Expense, refund, income, transfer, and reversal-of-reversal projections agree with the compiled journal and append-only direction
- [x] Transfer-pair duplicate state follows its root lineage in compiled books and cash flow
- [x] PGlite projection version 7 invalidates the pre-fix proof and performs one full rebuild from the accepted snapshot
- [x] The ten-second strip is environment/household/member scoped, hidden outside Shared, and cleared before ledger/session/environment switches
- [x] A funded correction is accepted and persisted without advertising an unsupported second Undo
- [x] Enter on focused Close and `Switch kind` disclosure controls remains native and does not advance the CAD pad
- [x] Custody, duplicates, offline local acceptance/outbox order, operating-balance invariants, and direct-debit semantics stay green
- [x] 320 / 390 / 720 / ~1100, keyboard/focus, reduced-motion, error, and offline evidence recorded
- [x] Forward-repair focused regressions and TypeScript pass
- [x] Forward-repair exact-head full Windows gates pass
- [ ] Independent High/Release reviews pass with no P0/P1/P2 release blocker
- [ ] Exact pushed head passes required PR checks and merge preconditions
- [ ] Post-merge main CI and Cloudflare deploy pass; live HTTP 200, `Cache-Control: no-store`, and Slice 2 asset markers verified

## Plan

- [x] Create isolated forward-repair branch from exact first-merge `origin/main`
- [x] Reproduce and repair all four late P1/P2 findings with focused tests
- [x] Reopen D-198 release evidence honestly; keep the first deployment release-blocked
- [ ] Run full/visual checks and independent exact-head reviews
- [ ] Push forward-repair PR, wait for all CI and public review, guarded merge, deploy, and live-check
- [ ] Close worksession and name the exact Slice 3 start SHA

## Evidence log

- 2026-09-02: `git ls-remote` confirmed `origin/main@813e2b4` and Cursor `25ef99e`; clean isolated worktree used.
- 2026-09-02: replayed `c474dca` as `2c999c5` and `a00cf80` as `064fa4c`; did not replay `8ee3f23` or stale D-197/D-198 docs.
- 2026-09-02: first repair head `eed2789` passed focused Swipe/custody, TypeScript, and responsive local-browser proof at 320/390/720/1100. Background inerting was 9/9 siblings; Escape restored focus; controls stayed at least 44 px.
- 2026-09-02: independent privacy/continuity review passed `eed2789`. Books and UX reviews found two non-corrupting P2s before push: compact history dropped funded command identity after reload, and recoverable errors used destructive danger colour. Both were repaired with persistence/legacy suppression tests and warning treatment; exact-head re-review remains required.
- 2026-09-02: repaired candidate focused Swipe/custody/history proof passed 24/24. Exact `pnpm check:windows` then passed AI surface; fast lane 224 files passed / 1 skipped and 1,547 tests passed / 2 skipped; serial books lane 18 files passed / 1 skipped and 146 tests passed / 1 skipped; 1,693 tests passed / 3 skipped total; TypeScript; 413-module production build; Hercules Pro UI; and redirect guard.
- 2026-09-02: PR #298 merged as `main@2b9f770`; main CI `33658014100` and Cloudflare deploy `33658014103` passed, and Development served Worker version `1afe500c-647b-4d3b-917f-0c39a95d2f0b`. A late public review then reproduced the four release blockers above, so this evidence is recorded as a failed first release, not acceptance.
- 2026-09-02: forward repair makes all reporting projections resolve append-only reversal lineage; scopes and switch-closes the Swipe strip; suppresses the unsupported follow-up funded Undo; and preserves focused Close Enter. Focused Swipe/statements/accounts/opening/custody/history proof passed 47/47; TypeScript passed.
- 2026-09-02: forward-repair `pnpm check:windows` passed AI surface; 224 fast files passed / 1 skipped with 1,551 tests passed / 2 skipped; 18 serial books files passed / 1 skipped with 146 tests passed / 1 skipped; 1,697 passed / 3 skipped total; TypeScript; 413-module production build; Hercules Pro UI; and redirect guard.
- 2026-09-02: anti-stale fetch found Register Slice 8 had advanced `origin/main` to `02692d7`. The repair rebased without conflict. Cross-slice focused proof passed 60/60, then the exact rebased candidate passed `pnpm check:windows`: 226 fast files passed / 1 skipped with 1,564 tests passed / 2 skipped; 18 serial books files passed / 1 skipped with 146 tests passed / 1 skipped; 1,710 passed / 3 skipped total; TypeScript; 416-module build; Hercules Pro UI; and redirect guard.
- 2026-09-02: PR #302 first head `6430f43` was cleanly based on `origin/main@02692d7`; both CI runs, Pages, and the Worker preview passed. The public code review nevertheless found one P1 before merge: a reversal-of-reversal was reinstated by reporting projections but negated twice by `compileDocument`; it also found one P2: the global CAD-pad Enter shortcut omitted the focusable `summary` used by Add's `Switch kind`. Merge stayed locked.
- 2026-09-02: the P1 repair makes compiled document/opening rows and snapshot P&L use the same root-and-parity reversal lineage as budget and statement projections; a regression checks trial balance, equation, snapshot, month summary, and the reinstatement journal line. The P2 repair yields Enter to focused `summary` elements and tests that `Switch kind` remains on the amount slide. Focused books/PGlite/statements/Swipe/Add proof passed 51/51. The full Windows gate then passed AI surface; 226 fast files passed / 1 skipped with 1,565 tests passed / 2 skipped; 18 serial books files passed / 1 skipped with 147 tests passed / 1 skipped; 1,712 passed / 3 skipped total; TypeScript; 416-module production build; Hercules Pro UI; and redirect guard. Fresh exact-head reviews and PR CI remain required before merge.
- 2026-09-02: the next independent books review stopped the push on two P1s: transfer reversals did not inherit a duplicate flag from either original pair leg, and an accepted pre-fix PGlite projection had no versioned re-anchor. `projectedCountable` now follows both the current and root transfer pair; compiler and cash flow share it. Local PGlite migration 7 nulls only the old derived projection proof, forcing the existing transactional full writer to rebuild from the accepted JSON snapshot before incremental mode resumes. The expanded six-file books/PGlite/statements/Swipe/Add gate passed 59/59. The fresh full Windows gate passed AI surface; 226 fast files passed / 1 skipped with 1,565 tests passed / 2 skipped; 18 serial books files passed / 1 skipped with 149 tests passed / 1 skipped; 1,714 passed / 3 skipped total; TypeScript; 416-module production build; Hercules Pro UI; and redirect guard. Fresh exact-head reviews remain required.

## Decisions

- D-197 remains the current-main custody prerequisite. D-198 stays the Slice 2 decision and now explicitly includes all forward-repair invariants, including compiled-journal/duplicate parity, the local projection re-anchor, and native disclosure-key ownership; no new decision id is introduced.
- PR #295 will not be merged as-is because it duplicates current-main Slice 1 and is not mergeable.
- One writer owns the repair checkout. Reviewers are read-only and receive an exact immutable head.

## Remaining uncertainty

- Forward-repair PR number, merge SHA, deployment run, Worker version, and live asset remain pending.
- Signed-in real-household posting is not required and will not be performed; test and visual evidence use synthetic/local Development state only.

## Handoff

Cursor must not start Slice 3 until this record is CLOSED and names the exact deployed `origin/main` SHA. Slice 3 must start from that SHA in a fresh clean branch, not from PR #295 or the stale Cursor head.
