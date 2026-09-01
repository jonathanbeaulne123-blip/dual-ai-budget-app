# Hearth worksession — Charter Held UI (D-193)

- **Status:** CLOSED ON BRANCH; DRAFT PR; NOT MERGED; NOT DEPLOYED; NOT LIVE
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/charter-held-ui-115c`
- **Baseline SHA:** `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`
- **Head SHA:** `e800cede3c9cf249b27b6bfafbf84a01a5f1b629`
- **PR or issue:** draft [#286](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/286)
- **Risk:** High (consent presentation beside Confirm)
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Bianca can pause Jonathan's contribution proposal for a calm conversation without rejecting it or moving money. The proposal stays visible and confirmable. The exact holder releases; the exact proposer withdraws.

## Budget delta (5)

`+3` — the screen exposes existing append-only Hold/release/withdraw authority without inventing a balance effect. Confirm remains the only contribution increase.

## Engagement delta (3)

`+2` — Hold is a legible, reversible conversation state instead of silence or refusal.

## If they conflicted

Books win. Hold never looks like posted money, denial, or a second envelope. Confirm is the money boundary.

## Verified baseline

Facts:

- Worktree `/tmp/hearth-charter-held-ui` on `cursor/charter-held-ui-115c` from `origin/main@ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082` (merged D-193 core via #283).
- Sealed exports live on `src/core/index.ts`: `householdFundContributionMotions`, `HOUSEHOLD_FUND_HOLD_COPY`, `holdHouseholdFundContribution`, `releaseHouseholdFundHold`, `withdrawHouseholdFundContribution`, `confirmHouseholdFundContribution`.
- Core/PGlite/commands, App, Office, Charter amendment authoring, and Register slice 8 were not edited. `git diff origin/main -- src/core/householdFund.ts src/core/commands.ts src/App.tsx src/Charter.tsx src/core/contributionRegister.ts` is empty.

## Scope

### In scope

- `src/HouseholdFundPanel.tsx` waiting queue from `householdFundContributionMotions`
- Smallest `.household-fund-panel` CSS for 44px equal Confirm/Hold/Release/Withdraw
- `test/held-ui.test.ts` behavioral proof
- Worksession, `docs/AI_HANDOFF.md` status block, D-193 why-note

### Out of scope

- Register slice 8 files
- `src/core/householdFund.ts`, `src/core/commands.ts`, PGlite, continuity, schema, workers
- `App.tsx`, Office, `Charter.tsx` amendment authoring
- Audit Office / `sharedLedgerStory` second fold (reachable stale confirm after withdraw is a follow-up packet)
- Any financial writer
- Merge, deploy, hosted schema, secrets, Production

## Acceptance evidence

- [x] Open custodian view shows equal Confirm received and Hold (≥44px)
- [x] Holding with a note shows exact calm status; Confirm stays visible; projection/journal unchanged
- [x] Only holder sees Release Hold; only proposer sees Withdraw proposal
- [x] Release returns open; withdraw leaves the waiting queue
- [x] Confirming a held proposal uses `confirmHouseholdFundContribution` and leaves the queue
- [x] Non-custodian cannot obtain a working Hold, including after member rerender
- [x] 320px action row `flex-wrap: wrap`; controls 44px via minHeight/minWidth
- [x] Custody disclosure preserved; no `Waiting for Bianca`; no denied/rejected/declined
- [x] Hold/release/withdraw print as `record only` in Fund books, not CAD
- [x] Hold composer receives focus and `aria-controls`
- [x] `test/held.test.ts` remains green (5/5)
- [x] Core/PGlite/commands files untouched
- [x] Component visual proof at 320/390/720/~1100 (not kitchen)

## Plan

- [x] Replace pending fold with sealed motion selector
- [x] Equal Confirm/Hold, held copy, Release/Withdraw by exact actor
- [x] CSS under `.household-fund-panel`
- [x] jsdom tests
- [x] Focused vitest, tsc, git diff --check
- [x] Independent High-risk UX/books/trust review
- [x] Draft PR #286
- [x] Commit, push, close worksession

## Evidence log

- 2026-09-01: Opened on baseline `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`. Environment: none.
- Focused: `pnpm exec vitest run test/held.test.ts test/household-fund-ui.test.ts test/held-ui.test.ts` → **3 files / 22 tests passed** (`held-ui` 12, `held` 5, `household-fund-ui` 5).
- `pnpm exec tsc --noEmit` passed. `git diff --check` passed.
- Independent reviews on `39d799f`: UX merge-ready as draft (P2 focus/`aria-controls` now landed); books FAIL P1 Fund-books CAD (now `record only`); trust PASS on money/authority, with Audit Office second-fold notes left as a follow-up.
- Component harness screenshots at 320/390/720/1100 for open, held (Bianca/Jonathan), released, withdrawn.
- Commits: `c1d3908` UI/CSS/tests/docs; `4daf3fa` source-fence call-site count; `39d799f` verification/closeout; this follow-up for books/a11y.
- Pushed `origin/cursor/charter-held-ui-115c`. Draft PR #286. No merge, no deploy.

## Decisions

UI uses one sealed `householdFundContributionMotions` fold. Hold is outline/ghost equal to pine Confirm. Held copy is exactly `HOUSEHOLD_FUND_HOLD_COPY.status`. Commands go only through `onCommand`. Proposed/held/released/withdrawn Fund-book rows are `record only`.

## Remaining uncertainty

- Audit Office `sharedActionQueue` / `weekEventLabel` still treat a withdrawn motion as a pending confirm and print raw `contribution-held` beside CAD. Out of this packet; next owner should route those surfaces through `householdFundContributionMotions`.
- `pnpm check` books lane failure in `demo-suite.test.ts` is unrelated and still fails on retry.
- App Books wiring of the panel was not jsdom-covered beyond the existing source fence.

## Handoff

Independent High-risk UX/books review of draft [#286](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/286) using [`docs/briefs/CHARTER_SLICE_5_HELD_UI_RETURN_HANDOFF_2026-09-01.md`](../briefs/CHARTER_SLICE_5_HELD_UI_RETURN_HANDOFF_2026-09-01.md). Not shipped, not live. Jonathan decides merge. Do not deploy.
