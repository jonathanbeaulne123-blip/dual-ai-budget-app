# Our Path — fund-balance elevation plan

*Status: plan only, nothing built. 2026-09-15. Written by a read-only planning pass over current code; fictional data only.*

## 0. Headline

Most of the "asOf/period projector split" already exists: D-247 added it (`docs/DECISIONS.md` and `docs/AI_HANDOFF.md`, D-247). The 2026-09-15 Our Path worksession assumed it was still missing. What is left is one pure month-end series reader, one money-meaning answer from Jonathan, a Codex trust review, and then the island slice.

## 1. What "the Fund balance" is today

- The number is `operatingBalanceCents` from `projectHouseholdFundAsOf(household, lens)` (`src/core/householdFund.ts` ~547): the sum of `householdFundOperatingDelta` over active Fund events (~586). `contribution-confirmed` and `kitty-released` add; `settlement-confirmed` and `kitty-allocated` subtract (~430–434). It never reads the custodian's savings account balance.
- The lens is `FundLens = { anchor, period, asOf }` (~505–517). `fundLensToday(today)` (~532) returns `asOf: null`, so every event counts, including events dated in the future. `fundLensForPeriod(period, today)` clamps the anchor into the month and sets `asOf`, so a past month reads at its last day. `knownByDate` (~573) applies `asOf`.
- A balance per month already works: `timelineBeads` (`src/core/timeMachine.ts` ~107–118) gives `fundCents` per month through `fundLensForPeriod`; `test/time-machine.test.ts` ~86–97 proves July reads its own close.
- The cleanest "balance as of a date" primitive is `projectHouseholdFundOperatingBalanceBefore(h, before)` (~437–445); `fundWalk` and `prepareFundHorizon` both anchor on it.
- Loose ends in the as-of read (do not affect `operatingBalanceCents`, but a review should record them): `pendingContributionsCents` (~579) ignores `asOf`; `prepareFundObligations` passes `asOf: null` on purpose (`fundWalk.ts` ~194).
- **The open money-meaning line:** `householdFund.ts` ~533 `return { anchor: today, period: monthKeyFromDateKey(today), asOf: null }`. Whether today's balance should stop counting future-dated Fund events is recorded as open (DECISIONS D-247 row and AI_HANDOFF). Changing `asOf: null` to `asOf: today` would do it — and would move every present-day figure (`QueenHome.tsx`, `HouseholdFundPanel.tsx`, `commands.ts` rollover guard, `herculesActions.ts`, `sharedLedgerStory.ts`).
- Landmarks today do not use the Fund balance: `kittyBankBackingStep` (`src/core/kittyBanks.ts` ~52–61) is the goal's remaining claim plus `goalFundReserve(...).reservedCents`, in 0–10 steps of target; `goalFundReserve` already filters Fund events by `date <= asOf`.

## 2. What the split still needs

- One pure reader, `fundBalanceSeries(household, monthKeys, today)` → `{ monthKey, closeCents }[]`, where `closeCents = projectHouseholdFundOperatingBalanceBefore(h, addDays(min(monthEnd, today), 1))`. It must not call the full projector 36 times (that also rebuilds positions and recurrences).
- Tests in `test/time-machine.test.ts`: the series equals `timelineBeads[].fundCents` for past months; the current month equals the balance through today; reversed events are excluded; no Fund → empty series. Keep `time-machine`, `contribution-register`, fund-walk and horizon suites green. `src/core/timeMachine.ts` and `pathSignals.ts` are already in the focus map.
- D-183: `test/month-rehearsal-mainline.test.ts` has no Fund references; `test/app-startup-p1.test.ts` has seven. A read-only reader cannot change either, but run both. Any edit under `src/core/**` fires the money canary; the `fundLensToday` flip is a money change that needs the canary plus a Codex trust review.

## 3. Privacy and trust

- Fund events carry no member visibility; the Fund is a household fact and its destinations must be shared accounts (`householdFund.ts` ~888–890). `operatingBalanceCents` therefore holds no personal-scope rows.
- Where personal rows *can* leak in: position and transfer fields read raw `household.transactions` (~577). That is the same raw-vs-floor split as the Visa note ($4,716.80 on the accounts plate vs $4,646.30 on the Books floor). **The safe figure for a shared island is the operating balance only** — never free-to-spend, safe rollover, transfer due, or an account balance.
- Existing leak to fix in the same slice: `pathSignals.ts` ~164 reads raw `household.fundEvents` (includes reversed events, ignores `fundId`). Use `activeHouseholdFundEvents`, as `kittyBanks.ts` ~88 does.

## 4. Design — the smallest safe mechanic

- New score `cushion` (0–1) in `PATH_SIGNALS`. `pathMonths` sets it from month-end `closeCents`: `cushion = clamp(closeCents / reference)` with `reference` = the household's own high-water mark over the months shown; 0 when there is no Fund, the balance is ≤ 0, or the reader throws ("never punishes", as `kittyBanks.ts` ~46–50). `why.cushion` is words only ("The Fund stood fuller than most months"). A household-chosen target can replace the high-water mark later; that is a product question, not v1.
- Round to quarter steps so the shape cannot be inverted back into cents across 36 months; the high-water denominator also hides absolute size.
- Grower: a soft `lift = 0.6 * cushion` stamp at each month's spot before the final height. Landmarks: the plinth grows by the newest month's `cushion` × a small constant; the bank sculpture keeps its own `kittyBankBackingStep` scale, so goal backing and Fund cushion stay two separate readings.
- Why a score and not cents: the world code and the marks never hold a money value (nothing to leak into a label, a hash or a screenshot); the grower stays deterministic on both phones; it follows D-262 ("scores are shapes, never amounts"). A fence test asserts `src/path/**` never imports `householdFund`.
- Never show a number, and especially not at Dim: Dim is the glanceable, shared-screen setting; a CAD figure there turns the island into a balance display the Fund surfaces already own with their own review states. At Warm and above the line is words only; "Open the Fund" sends people to the real figure.

## 5. Sequence and size

- (a) **Questions for Jonathan** (blocks only the flip): should today's balance ignore future-dated Fund events? Should the elevation reference be the household's own high-water mark or a target they choose? Recommendation: leave the flip alone for elevation, because the series already clamps to `min(monthEnd, today)`; start with the high-water mark.
- (b) **Series reader PR** (small: ~40 lines source, ~60 lines tests): `fundBalanceSeries`, the reversal filter fix in `pathSignals.ts`, mapped tests, both D-183 suites, Codex trust review focused on the as-of loose ends and on confirming no personal rows can reach it.
- (c) **Island slice** (medium: ~120 lines source, ~80 lines tests), after (b) merges: the `cushion` score and its `why`, the grower lift, the plinth rise; determinism and same-island-on-both-phones tests; "no `$` or digits in cushion copy at any lantern"; the import fence; visual proof on the seed only.
