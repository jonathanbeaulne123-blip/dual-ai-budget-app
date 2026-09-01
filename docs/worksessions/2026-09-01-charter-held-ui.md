# Hearth worksession — Charter Held UI (D-193)

- **Status:** OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/charter-held-ui-115c`
- **Baseline SHA:** `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`
- **Head SHA:** `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`
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
- `src/HouseholdFundPanel.tsx` currently folds pending from raw `contribution-proposed` / `contribution-confirmed` events and shows `Waiting for Bianca`.

Inferences:

- The existing Fund panel command path (`onCommand`) is sufficient; no core change is required if UI uses the sealed selector and commands.

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

- [ ] Open custodian view shows equal Confirm received and Hold (≥44px)
- [ ] Holding with a note shows exact calm status; Confirm stays visible
- [ ] Only holder sees Release Hold; only proposer sees Withdraw proposal
- [ ] Release returns open; withdraw leaves the waiting queue
- [ ] Confirming a held proposal uses `confirmHouseholdFundContribution` and leaves the queue
- [ ] Non-custodian cannot obtain a working Hold, including after member rerender
- [ ] 320px action row does not overflow; controls 44px
- [ ] Custody disclosure preserved; no `Waiting for Bianca`; no denied/rejected/declined
- [ ] `test/held.test.ts` remains green
- [ ] Core/PGlite/commands files untouched

## Plan

- [ ] Replace pending fold with sealed motion selector
- [ ] Equal Confirm/Hold, held copy, Release/Withdraw by exact actor
- [ ] CSS under `.household-fund-panel`
- [ ] jsdom tests
- [ ] Focused vitest, tsc, git diff --check; pnpm check if time allows
- [ ] Commit, push, close worksession

## Evidence log

- 2026-09-01: Opened on baseline `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`. Environment: none.

## Decisions

## Remaining uncertainty

## Handoff

Cursor implements the UI slice on this branch. Not shipped, not live. No merge/deploy.
