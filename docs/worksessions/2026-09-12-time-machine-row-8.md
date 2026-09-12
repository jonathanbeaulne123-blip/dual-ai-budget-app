# Hearth worksession — The time machine (feedback row 8)

- **Status:** OPEN
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (Cowork session)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/time-machine-row-8`
- **Baseline SHA:** `6fa38aed9e3c95d0d09ef14122a1db35c9cb2686` (main after #453, the planner)
- **Head SHA:** see Evidence log
- **PR or issue:** none yet — Jonathan's delivery bot pushes, merges and deploys
- **Risk:** High (money meaning: the Fund projector gains an observation axis; cumulative statements gain `asOf`)
- **Decision owner:** Jonathan
- **Environment impact:** none (no hosted schema, no Production, no real-household writes)

## Household outcome

Jonathan and Bianca can see any month of their life together, behind them or ahead
of them. A scrubbable ribbon of months runs across the top; each bead carries what
that month took and how it went. Tap a bead and the whole page moves with it — one
period per page, so no two figures on screen can belong to different months.

A month behind you reads as what happened: the Fund as it stood when that month
ended, what the banks did, and the things worth remembering. Now is live. A month
ahead says *expected, not posted* everywhere and offers no way to post anything.
Comparison says what changed, what's new and what stopped. The forecast comes
entirely from the reviewed Fund horizon and shows its refusals rather than drawing
a line anyway. The year shows the seasonal shape. Books gets the two free period
controls: statements and the Fund register now page, while every write stays
anchored to the real current month.

Jonathan's decisions (2026-09-12, this session): build the whole of row 8 in one
slice, and derive per-month goal history from `goalContributions` rather than
leaving banks out of v1.

## Budget delta (5)

+5, and it is mostly a correctness delta.

`projectHouseholdFund` was never an as-of function. `operatingBalanceCents`
(`householdFund.ts:534` at baseline) summed every event ever recorded with no date
filter, while the reserve (`:606`), the month plan and target (`:608`) and
contribution progress (`:621`) were all filtered to the month of `today`. Point it
at July while standing in September and `freeToSpendCents` became arithmetic across
two different months — silently, with no error. It is called from
`monthObligations.ts:121`, `Books.tsx:160`, `HouseholdFundPanel.tsx:252` and
`sharedLedgerStory.ts`.

A `FundLens` now holds the three things apart: `anchor` (where the reported month
stands), `period` (which month is reported) and `asOf` (what had happened yet).
No new money meaning was invented: the forecast is `prepareFundHorizon`, the
obligations are `monthObligations`, the walk is `fundWalk`, and the time machine
surface carries no commands at all.

## Engagement delta (3)

+3. A reason to open the app when nothing is wrong: a month you lived through,
with the bank that filled and the month you closed, rather than a report.

## Verified baseline

Facts (read in this session, at `6fa38ae`):

- `projectHouseholdFund(household, today)` mixed axes exactly as described above;
  `fundWalk` already clamps its anchor into the requested month
  (`fundWalk.ts:228`) and takes its opening balance from
  `projectHouseholdFundOperatingBalanceBefore` (`householdFund.ts:437`) — the
  correct pattern was already in the repo, the projector just did not use it.
- Flow statements are already period-exact: `monthSummary`, `incomeStatement`,
  `cashFlowStatement`, `budgetVariance` and `comparativeIncome` all take a
  `monthKey` and count only that month. **Cumulative** statements are the ones that
  could not travel: `balanceSheet`, `auditOpinion` and `workingCapital` derive their
  `asOf` from `lastEntryDate(books)`, and `statementOfChangesInEquity` read
  `balanceSheet(household).equityCents`.
- `contributionRegister(household, monthKey, today)` and
  `contributionRegisterThrough` already separate period from observation — the
  register needed no core change at all, only month state in `Books.tsx`.
- `Books.tsx` manufactured its own clock (`:149 const today = todayKey()`) and
  derived one page-wide `monthKey` from it (`:177`), which is why neither the
  statements pane nor the register could page.
- Goals had no dated reader in `goals.ts`: `savedCentsFromContributions` and
  `describeGoalContributors` sum without a date filter and `Goal.savedCents` is a
  running total. But `GoalContribution` and `GoalPurchase` both carry `date`, and
  `goalEnvelopes.ts:275` (`goalRemainingClaim`) already filters by `row.date <= asOf`
  — the shape existed, the reader did not.
- `test/goal-fill-ui.test.ts` is also red on `main` at `6fa38ae` (6 of 7 tests,
  verified in a clean worktree). It is untouched by this branch and left alone:
  it is a Fill-dialog UI failure, not a statements assertion, and guessing at it
  from here would be a change without a decision behind it.
- `test/statements.test.ts:202` has been failing on `main` since #425 rewrote
  Hercules's identity reply (`herculesTalk.ts:436`) on 2026-09-10. Verified by
  running that suite in a clean worktree at `6fa38ae` before touching anything.

Inference (not verified): the brief's counts of "~22 component call sites and six
components" that hardcode this month are off; the real numbers are 13 genuine
hardcodes of `monthKeyFromDateKey(today)` in `.tsx`, and nine components that
manufacture their own clock (four of which derive a month from it).

## Scope

### In scope

- `FundLens` (`anchor` / `period` / `asOf`), `fundLensForPeriod`, `fundLensToday`,
  `projectHouseholdFundAsOf`; `projectHouseholdFund` preserved exactly.
- Optional `asOf` on `balanceSheet`, `auditOpinion`, `workingCapital` and
  `statementOfChangesInEquity`, defaulting to today's behaviour.
- Dated goal readers: `goalSavedAsOf`, `goalMonthSeries`, `goalMonthMovements`.
- `src/core/timeMachine.ts`: month states, ribbon beads, `monthView`,
  `compareMonths`, `monthForecast`, `yearShape`, `monthMemories`,
  `thisTimeLastYear`.
- `src/timeMachine/TimeMachine.tsx` + `time-machine.css` in three authored themes;
  a new `timeMachine` tab borrowing the ledger scene; nav and + doors.
- Books: `viewMonth` paging for the statements and Fund-register panes.

### Out of scope

- Changing what **today** counts. `fundLensToday` keeps `asOf: null`, so a
  future-dated Fund event still counts in today's operating balance exactly as it
  always has. Filtering it would change a present-day figure, which is money
  meaning and Jonathan's call (see Decisions).
- A real `SceneRoute` for the time machine (the thirteen-file theme change, same
  boundary the planner drew at D-245).
- Threading `asOf` into flow statements and `monthSummary` — they are period-exact
  already, so it would be churn without a behaviour.
- Writing from the time machine. It has no commands, by design.
- `KittyBanks.tsx` still renders undated `goal.savedCents`; the dated readers exist
  for it now, but rewiring that component belongs to the Kitty Studio track.

## Acceptance evidence

- [x] A past month reconciles: July's projection equals the sum of Fund deltas
      through 2026-07-31, and its free-to-spend is arithmetic inside one month.
- [x] Today does not move: `projectHouseholdFundAsOf(h, fundLensToday(today))`
      deep-equals `projectHouseholdFund(h, today)`.
- [x] A month ahead is read from its first day, with the whole month still to come.
- [x] The surface carries no form, no money input and no Confirm on any pane, at
      every width and theme.
- [x] A month behind you shows the Fund as it stood at that month's close
      ($7,400 in August against $9,000 today, in the captured evidence).
- [x] Browser evidence: 49 captures, 0 serious/critical axe, 0 page errors, 0
      horizontal overflow.

## Evidence log

- Base: `6fa38aed9e3c95d0d09ef14122a1db35c9cb2686`. Commits: `6f72ec2` (core),
  `f627e98` (surface + Books paging), `1751a49` (evidence), `d3cfdda` (the
  pre-existing statements assertion).
- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npx vite build` — passes (16.4 s).
- `npx vitest run test/time-machine.test.ts test/time-machine-ui.test.ts` — 19 tests
  pass.
- `npx vitest run test/app-startup-p1.test.ts test/month-rehearsal-mainline.test.ts
  --maxWorkers=1` — 82 tests pass in 62.6 s (required by D-183 for App route, Books
  and Fund changes).
- `pnpm test -- --risk=high --focus=test/time-machine.test.ts --focus-reason="..."`
  — **quick gate passed**, 91.7 s of a 300 s budget, no breach, 13 selected files.
  `uiProofRequired: true`.
- Browser: `HEARTH_ARTIFACTS_DIR=docs/evidence/time-machine
  HEARTH_CHROMIUM=/opt/pw-browsers/chromium node test/time-machine-layout.mjs` — 49
  captures (month / compare / ahead / year household, month personal × Classic /
  Taylor / Newfoundland × 320 / 390 / 720 / 1100 / 1440 for the month pane, 390 and
  1100 for the rest), plus a month behind, a month ahead, keyboard-only stepping,
  quiet mode and an empty personal scope. 0 horizontal overflow, 0 serious/critical
  axe, 0 page errors. Files and `records.json` in `docs/evidence/time-machine/`.
- What the browser run caught, and is fixed: absolutely positioned screen-reader
  lines escaping the ribbon's scroller and widening the document by 772px at 320;
  pine-on-paper chips at 2.4:1 (Taylor personal) and 4.4:1 (Newfoundland); an
  unlabelled focusable scroller; bead heights that made every month with a
  paycheque look the same.

## Decisions

1. **D-246** — `asOf` and `period` are separate arguments through the Fund
   projector; `fundLensForPeriod` clamps the anchor into the month the way
   `fundWalk` already does. The time machine is a read-only surface.
2. **For Jonathan, unresolved:** should today's Fund balance stop counting
   Fund events dated in the future? Today it counts them (`asOf: null`), and this
   branch preserves that exactly. The honest as-of reading would filter them; it is
   a one-line change (`fundLensToday` returning `asOf: today`) and a money-meaning
   decision, so it is left to you. Nothing in the repo forbids a future-dated
   confirmation: `commands.ts:8141` takes the date from the input.
3. Books pages what is **read**, never what is **written**. Budget edits,
   reconciliation and close stay anchored to the real current month, and a past
   month's budget rows lose their edit trigger.

## Remaining uncertainty

- The forecast shows `$0.00 expected in` on fictional data because the Fund is fed
  by confirmed contributions rather than a projected income recurrence. That is
  honest, but a household with a regular contribution rhythm may expect to see it;
  whether observed contribution estimates should appear in the Fund horizon is a
  money-meaning question, not a UI one.
- `monthMemories` reads goals, Wins, Sitdowns and month closures. The brief also
  wanted the board photo and the fired kitty bank; both depend on the Kitty and
  Together tracks and are not wired here.
- The page borrows the ledger scene. It is authored in all three themes in its own
  stylesheet, but it does not own scene artwork, and the standard's "recognize the
  scene from the middle of the page" test is met by the page's own material, not by
  a scene of its own.
- Not exercised: physical devices, VoiceOver, a real Development snapshot, and
  months containing a reversal or a correction.

## Handoff

Local branch only. This session's git proxy has no push credential for the
repository, so: **not pushed, not a PR, not merged, not deployed, not live
verified.** Delivered as a git bundle plus patches in `~/Downloads` for Jonathan's
delivery bot.

Next owner: Codex, for an independent trust review of the `asOf` axis — in
particular that `projectHouseholdFundAsOf` with `fundLensToday` is byte-identical to
the old projector at every call site, and that filtering transactions by `asOf`
inside the projection cannot drop an outstanding position that a present-day
surface still needs. Then Jonathan, for decision 2 above and product review.
