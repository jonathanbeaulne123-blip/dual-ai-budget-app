# Hearth worksession — Till Slice 2 repair and Development release

- **Status:** OPEN — LOCAL REPAIR; NOT PUSHED; NOT MERGED; NOT KITCHEN-PUBLISHED
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex (single writer); independent reviewers required
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/till-2-swipe-repair`
- **Baseline SHA:** `813e2b418f0a847122b669b96268b2390f559c9d` (`origin/main`)
- **Head SHA:** pending repair commits
- **PR or issue:** supersedes draft PR #295; new PR pending
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

- Current remote `main` is exactly `813e2b418f0a847122b669b96268b2390f559c9d` and already contains the deployed D-197 custody fence.
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

- [ ] Rejected Swipe posts are visible and announced inside the active modal with a clear retry/correction path
- [ ] Background application controls become inert while Swipe is open and restore on close
- [ ] Swipe has one dialog title and an `Amount` pad label
- [ ] Funded Undo routing is explicit by supported command kind, never inferred from a `FUND-EVT-` id alone
- [ ] Custody, duplicates, offline local acceptance/outbox order, operating-balance invariants, and direct-debit semantics stay green
- [ ] 320 / 390 / 720 / ~1100, keyboard/focus, reduced-motion, error, and offline evidence recorded
- [ ] Exact-head focused and full Windows gates pass
- [ ] Independent High/Release reviews pass with no P0/P1/P2 release blocker
- [ ] Exact pushed head passes required PR checks and merge preconditions
- [ ] Post-merge main CI and Cloudflare deploy pass; live HTTP 200, `Cache-Control: no-store`, and Slice 2 asset markers verified

## Plan

- [x] Create isolated repair branch from exact current `origin/main`
- [x] Replay only the Slice 2 application commits
- [ ] Apply P1/P2 repairs and tests
- [ ] Update D-198 canon and handoff evidence
- [ ] Run focused/full/visual checks and independent reviews
- [ ] Push, open PR, verify, guarded merge, deploy, and live-check
- [ ] Close worksession and name the exact Slice 3 start SHA

## Evidence log

- 2026-09-02: `git ls-remote` confirmed `origin/main@813e2b4` and Cursor `25ef99e`; clean isolated worktree used.
- 2026-09-02: replayed `c474dca` as `2c999c5` and `a00cf80` as `064fa4c`; did not replay `8ee3f23` or stale D-197/D-198 docs.

## Decisions

- D-197 remains the current-main custody prerequisite. Slice 2 uses the next free D-198.
- PR #295 will not be merged as-is because it duplicates current-main Slice 1 and is not mergeable.
- One writer owns the repair checkout. Reviewers are read-only and receive an exact immutable head.

## Remaining uncertainty

- Exact PR number, merge SHA, deployment run, Worker version, and live asset remain pending.
- Signed-in real-household posting is not required and will not be performed; test and visual evidence use synthetic/local Development state only.

## Handoff

Cursor must not start Slice 3 until this record is CLOSED and names the exact deployed `origin/main` SHA. Slice 3 must start from that SHA in a fresh clean branch, not from PR #295 or the stale Cursor head.
