# Hearth worksession — Till Slice 2 repair and Development release

- **Status:** CLOSED ON RELEASE-SEAL MERGE — APPLICATION MERGED AND DEVELOPMENT KITCHEN PUBLISHED
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex (single writer); independent reviewers required
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/till-2-swipe-repair`; release record `codex/till-2-release-seal`
- **Baseline SHA:** `813e2b418f0a847122b669b96268b2390f559c9d` (`origin/main`)
- **Head SHA:** reviewed application `3ca2f5b301735a97f364a08134c81b021b258c45`; application merge `2b9f77051b4abfdddce2fd2f580e41a36a6c8772`
- **PR or issue:** application [#298](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/298); release seal [#300](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/300); supersedes closed draft #295
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

- The reviewed baseline was exact `main@813e2b418f0a847122b669b96268b2390f559c9d`, already containing the deployed D-197 custody fence.
- Cursor candidate `25ef99ef053abd56afe87dab363b873bf35f9dfd` is on stale ancestry and PR #295 is draft/dirty; it is evidence and source material, not an integration base.
- Only Cursor's Slice 2 application commits were replayed onto current `main`; its duplicated Slice 1 and stale decision/release records were not replayed.
- Review found four repair gates: in-sheet rejected-post recovery; effective background inerting; one accessible amount label; and command-kind-bounded funded Undo semantics.

## Scope

### In scope

- Rebase/replay Till Slice 2 onto exact current `main`
- Repair all recorded P1/P2 findings and add focused regressions
- D-198 canon and truthful Release handoff evidence
- Independent books/trust, privacy/continuity, UX/accessibility, and final release review
- User-authorized push, guarded merge, Development deployment, post-merge CI, and live no-store/asset verification

### Out of scope

- Till Slice 3 implementation, Till navigation/surface, camera, receipt, or OCR
- Schema, migration, hosted household-row mutation, secrets, provider settings, bank connection, or Production continuity/data
- New financial formula, second Fund fold, second writer, or money movement

## Acceptance evidence

- [x] Rejected Swipe posts are visible and announced inside the active modal with a clear retry/correction path
- [x] Background application controls become inert while Swipe is open and restore on close
- [x] Swipe has one dialog title and an `Amount` pad label
- [x] Funded Undo routing is explicit by supported command kind, never inferred from a `FUND-EVT-` id alone; command identity persists across reload
- [x] Custody, duplicates, offline local acceptance/outbox order, operating-balance invariants, and direct-debit semantics stay green
- [x] 320 / 390 / 720 / ~1100, keyboard/focus, reduced-motion, error, and offline evidence recorded
- [x] Exact-head focused and full Windows gates pass
- [x] Independent High/Release reviews pass with no P0/P1/P2 release blocker
- [x] Exact pushed head passes required PR checks and merge preconditions
- [x] Post-merge main CI and Cloudflare deploy pass; live HTTP 200, `Cache-Control: no-store`, and Slice 2 asset markers verified

## Plan

- [x] Create isolated repair branch from exact current `origin/main`
- [x] Replay only the Slice 2 application commits
- [x] Apply P1/P2 repairs and tests
- [x] Update D-198 canon and handoff evidence
- [x] Run focused/full/visual checks and independent reviews
- [x] Push, open PR, verify, guarded merge, deploy, and live-check
- [x] Close worksession; the coordinator names the exact release-seal merge SHA for Slice 3

## Evidence log

- 2026-09-02: `git ls-remote` confirmed `origin/main@813e2b4` and Cursor `25ef99e`; clean isolated worktree used.
- 2026-09-02: replayed `c474dca` as `2c999c5` and `a00cf80` as `064fa4c`; did not replay `8ee3f23` or stale D-197/D-198 docs.
- 2026-09-02: first repair head `eed2789` passed focused Swipe/custody, TypeScript, and responsive local-browser proof at 320/390/720/1100. Background inerting was 9/9 siblings; Escape restored focus; controls stayed at least 44 px.
- 2026-09-02: independent privacy/continuity review passed `eed2789`. Books and UX reviews found two non-corrupting P2s before push: compact history dropped funded command identity after reload, and recoverable errors used destructive danger colour. Both were repaired with persistence/legacy suppression tests and warning treatment; exact-head re-review remains required.
- 2026-09-02: repaired candidate focused Swipe/custody/history proof passed 24/24. Exact `pnpm check:windows` then passed AI surface; fast lane 224 files passed / 1 skipped and 1,547 tests passed / 2 skipped; serial books lane 18 files passed / 1 skipped and 146 tests passed / 1 skipped; 1,693 tests passed / 3 skipped total; TypeScript; 413-module production build; Hercules Pro UI; and redirect guard.
- 2026-09-02: exact candidate `3ca2f5b` passed independent books/trust, privacy/continuity, and UX/accessibility re-review with no P0-P2. PR-head CI `33656791208` and `33656829180` passed; PR #298 met the exact-head/base/clean/check guards and merged as `main@2b9f77051b4abfdddce2fd2f580e41a36a6c8772`.
- 2026-09-02: post-merge main CI `33658014100` and Cloudflare run `33658014103` passed. Worker version `1afe500c-647b-4d3b-917f-0c39a95d2f0b` serves HTTP 200 with `Cache-Control: no-store`; `index-CO1eGR2Y.js` contains the title, accepted-strip, in-dialog error, and funded-Undo refusal markers.

## Decisions

- D-197 remains the current-main custody prerequisite. Slice 2 uses the next free D-198.
- PR #295 will not be merged as-is because it duplicates current-main Slice 1 and is not mergeable.
- One writer owns the repair checkout. Reviewers are read-only and receive an exact immutable head.

## Remaining uncertainty

- No release-blocking uncertainty remains. Signed-in real-household posting was not required and was not performed; test and visual evidence used synthetic/local Development state only.
- The release-seal merge adds documentation only. The coordinator must report its exact final `origin/main` SHA before Cursor starts Slice 3.

## Handoff

Cursor may begin only Till Slice 3 after release-seal PR #300 containing this CLOSED record merges. Start from the exact current `origin/main` merge SHA reported by the coordinator in a fresh clean branch, and assert application merge `2b9f77051b4abfdddce2fd2f580e41a36a6c8772` is its ancestor. Do not start from PR #295, `25ef99e`, or `2b9f770` alone.
