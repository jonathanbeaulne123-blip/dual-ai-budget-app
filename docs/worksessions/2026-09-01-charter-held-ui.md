# Hearth worksession — Charter Held UI (D-193)

- **Status:** CLOSED; BRANCH ONLY; NOT A PR; NOT MERGED; NOT DEPLOYED; NOT LIVE
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/charter-held-ui-115c`
- **Baseline SHA:** `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`
- **Head SHA:** `4daf3fadc5412aa729cde139f908f0dd4a38791b`
- **PR or issue:** branch only; not a PR, not merged, not deployed
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
- [x] `test/held.test.ts` remains green (5/5)
- [x] Core/PGlite/commands files untouched

## Plan

- [x] Replace pending fold with sealed motion selector
- [x] Equal Confirm/Hold, held copy, Release/Withdraw by exact actor
- [x] CSS under `.household-fund-panel`
- [x] jsdom tests
- [x] Focused vitest, tsc, git diff --check
- [x] Commit, push, close worksession

## Evidence log

- 2026-09-01: Opened on baseline `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`. Environment: none.
- Focused: `pnpm exec vitest run test/held.test.ts test/household-fund-ui.test.ts test/held-ui.test.ts` → **3 files / 19 tests passed** (`held-ui` 9, `held` 5, `household-fund-ui` 5).
- `pnpm exec tsc --noEmit` passed. `git diff --check` passed.
- `pnpm check`: `ai:verify` passed. Fast lane **214 files passed / 1 skipped**, **1453 tests passed / 2 skipped**. Books lane **1 failed** in pre-existing `test/demo-suite.test.ts` (`shiftEnvelopes` status `"upcoming"` false for seed 10101 / today `2026-08-29`). That file does not import this UI. Build did not run because the books lane failed. Not caused by this slice.
- Commits: `c1d3908` UI/CSS/tests/docs; `4daf3fa` source-fence call-site count.
- Pushed `origin/cursor/charter-held-ui-115c`. No merge, no deploy.

## Decisions

UI uses one sealed `householdFundContributionMotions` fold. Hold is outline/ghost equal to pine Confirm. Held copy is exactly `HOUSEHOLD_FUND_HOLD_COPY.status`. Commands go only through `onCommand`.

## Remaining uncertainty

- Browser/keyboard/forced-colors at 320/390/720/1100 not exercised in a real browser in this environment; jsdom covers interaction and 44px/wrap CSS.
- `pnpm check` books lane failure in `demo-suite.test.ts` is unrelated and still fails on retry; it needs a separate owner if it is now red on this calendar/SHA.
- App Books wiring of the panel was not jsdom-covered beyond the existing source fence.

## Handoff

Independent High-risk UX/books review of branch `cursor/charter-held-ui-115c` at `4daf3fadc5412aa729cde139f908f0dd4a38791b`. Not shipped, not live. Jonathan decides PR/merge. Do not deploy.
