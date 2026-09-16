# Hearth worksession: Plan Studio v3, integration of the money, studio and cellar tracks

- **Status:** OPEN. Local branch only: not pushed, not a PR, not merged, not deployed, not live verified.
- **Opened:** 2026-09-16 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (integration engineer)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/plan-studio-v3` (worktree `wt-int`). It merges `claude/plan-v3-money`, `claude/plan-v3-studio` and `claude/plan-v3-cellar` on `main@6160fb03`, and was brought up to date with **`main@d7b0151b`** (#497, the Journey of Life) by a merge commit (`5f1e06f6`).
- **Head SHA:** see `git log --oneline 556d4bd1..claude/plan-studio-v3` (integration commits on top of the three track merges: seven for D-282, eight for the trust-review fixes and evidence, two for the trust-review docs, then the `main@d7b0151b` merge, the renumbering, three for Our Story and the guard composition, and the docs; `git log --oneline origin/main..claude/plan-studio-v3` lists every commit the bundle carries).
- **Risk:** High. The studio now reads money meaning from the money model, the cellar's consent rows are filtered out of shared surfaces, the authority gains one author check, and Our Path grows new pieces. There is no new synced shape, no schema change and no new command.
- **Decision owner:** Jonathan (D-282)
- **Environment impact:** none. Fictional fixtures and proof pages only. `VITE_PLAN_STUDIO_V3` and `VITE_FUND_MODEL_V2` both stay off by default.

## Household outcome

With both flags on, the plan at rest shows the money model's own figures:

- Now is the Everyday remainder.
- Prepare holds the bills.
- Protect is the agreed cushion.
- Build holds the goals.

A contribution that landed reads "not divided yet" until one partner proposes Hercules's split and the other says yes. The custodian can suggest lending part of Protect to Everyday or Build for the month, and the partner confirms. The open Chapter is named by its calendar month and reminds the couple, without closing itself, once that month has ended.

The cellar's roll-over offers stay in the cellar. Only you can hide your own pay. Bill jars carry their umbrella's colour. On Our Path, the first plan agreed the new way seeds a ring of twelve pennants, one per part of life, and a closed check-in counts as that month's Sitdown.

## Budget delta (5)

+1. The split and the refill are now doable in the studio, and nothing is double-counted: a landed contribution is never added on top of Now. The Prepare line names the first bill it can't cover.

## Engagement delta (3)

+1. Pennants per umbrella on the island, and a Chapter that reads as a month.

## Verified baseline

- Read first:
  - `/home/claude/plan-studio/BUILD-BRIEF.md` and the Choices log in `plan-studio-v3-build-plan.md`.
  - The migration plan (Slice 11 row).
  - The three track worksessions and their `AI_HANDOFF` entries.
- `main@6160fb03` has pre-existing failures, each reproduced in a temporary detached worktree at `6160fb03` that was removed afterwards:
  - `test/onboarding-categories.test.ts`: 2 failures, "accepts the staged Submit…" and "replays the reviewed merge…".
  - `test/hercules-wardrobe-catalogue.test.ts`, `hercules-wardrobe-navigation.test.ts` and `hercules-wardrobe-ui.test.ts`: 3 failures (72 pieces where 54 are expected, then its knock-ons).
  - The failures are identical on this branch.
- `test/ledger-import-parity.test.ts` timed out once under a 4-worker run. It passes alone.

## What changed, in order

### 1. The studio reads `fundSnapshot` (commit `40255a58`)

- **`src/plan-v3/model.ts`**
  - **`fundModelSnapshot`** maps `fundSnapshot` onto the studio's shape.
    - **Figures.** Now, Prepare, Protect and Build are the snapshot's own. Prepare's rows are its bills, plus the nest's other Prepare lines. Build's rows are its goals.
    - **Lines.** Prepare reads "Short $X for <bill>, <day>" or "Bills covered all <Month>". Protect reads "of $X cushion" (the buffer). Build counts its goals.
    - **Undivided contributions.** They come from the snapshot. Each carries Hercules's draft (`proposedDivision`), or the open proposal's split, plus who hasn't agreed yet and the proposal's id and revision.
    - **Flow.** It keeps the Fund walk's day-by-day balances. A contribution's `split` is its confirmed division.
    - **Open refills** are exposed as `refills`, and the snapshot carries `mode: 2`.
    - **Unsorted households.** A household the money model hasn't sorted reads the transitional adapter unchanged.
  - **`defaultFundSnapshotSource()`** picks `fundModelSnapshot` only when `clientFundModelVersion() === 2` (`VITE_FUND_MODEL_V2=1`). Otherwise it keeps `planStudioFundSnapshot`, which is the fallback.
  - **`model.chapter`** now carries `monthKey`, `monthLabel` and `reminder`, through `chapterMonth` and `chapterReminder`, for sorted households only (the same gate the Chapter moment uses).
- **`src/plan-v3/FundProposals.tsx`** (new)
  - **`DivideCard`:**
    - Anyone can propose while nothing is proposed yet.
    - The proposer can take it back.
    - The partner can say "Yes, divide it this way" or "Not this split".
    - Confirmation words show only after the command is accepted.
  - **`RefillPanel`:**
    - The custodian suggests an amount to Everyday or Build.
    - The partner answers "Yes, lend it" or "Not now".
    - The proposer can take it back.
    - The words say "a plan, not a bank move".
  - Both use only `proposeFundDivision`, `agreeFundDivision`, `declineFundDivision`, `proposeProtectRefill`, `agreeProtectRefill`, `declineProtectRefill` and `withdrawFundProposal`.
- **Where the cards show**
  - The rest screen shows `DivideCard` when `mode === 2`. Otherwise it shows the old read-only moment, so the flag-off UI test is unchanged.
  - The Protect fund sheet and the check-in's Protect top-up step show `RefillPanel`.
  - The check-in's Coming in step shows `DivideCard`.
  - The island card and Looking back show the Chapter's month and reminder.
- **The Chapter's Sitdown step** already calls `closeChapterAtSitdown` for sorted households, through `ChapterClose`. There is no automatic close.

### 2. The cellar (commit `0bb4b73a`)

- **Consent stays on Bridge rows, filtered out of shared surfaces.**
  - **Why not the money track's proposals.** Its records are `division` (keyed to one contribution event) and `refill` (fund-level, no goal, no occurrence key). The row shape validator only allows fixed keys (`onlyKeys`). Saying "roll $X into goal bank Y for occurrence Z" would need a new row kind, which is a new synced shape. So the cellar keeps its Plan Bridge rows.
  - **The filter.** `src/core/cellarBridge.ts` (`isCellarBridgeRow`, `sharedBridgeDecisions`) recognises them. These surfaces now leave them out:
    - `sitdownBrief` (the Sitdown)
    - `pathBridges` (the island; no more "took it back")
    - `fundPulse`'s awaiting counts and `presenceLines` (the crown)
    - `PlanBridgeEditor` (the Bridge section and the Letter tray)
    - Hercules's `plan_bridge_status`
    - the studio badge
  - **Not filtered.** `herculesCompanionContext` still lists the row ids as allowed `plan-bridge` references (ids only).
- **Author check on the pay-jar hide.**
  - `setMyCellarPay` (`src/core/cellarIncomeJars.ts`) refuses a mark for another member on the phone.
  - `executeIntent` (`src/ledgerSync/registry.ts`) refuses a `dismissNotice` whose key is `cellar-pay:<member>:…` from any other actor (`ACTOR_MISMATCH`).
  - The card only offers the choice on your own glass. Both the hide and show paths go through the wrapper.
- **Umbrella hues.** `CellarJar.umbrellaHue` is `umbrellaHueForCategory` for sorted households, otherwise null. The rail's flat banks and the 3D sculptures prefer it over the name-read hue.

### 3. One resume owner: left as is, with the reason

The two owners can't merge without a new synced shape or a privacy change:

- **The Shared Sitdown session.** It lives in `household.planHerculesSessions[]`: shared, `stage` 0–7, written by `appendPlanSitdownTurn` with `expectedUpdatedAt`, and resumable by either partner.
- **The Hercules guided draft.** It lives in `companionProfile.workflows[]`, the row with `id === "task-${view}"` and `value.actionId === "plan-guided-draft"`. That is the **member-personal envelope** (`persistenceScope: "member-personal"`), revisioned by the companion ops in `herculesCompanion.ts` and `herculesExecution.ts`. Its `values` hold the member's private draft answers (up to 60 fields).

Why neither can own the other:

- Moving the draft answers into the shared session would publish private answers.
- Letting the private workflow own the stage means the partner can't resume.
- A link field (a session id on the workflow, or a workflow pointer on the session) is a new synced shape in one of two validated contracts (`decodeCompanionWorkflow` uses fixed keys; the plan session is shaped in `planSystem`).

So the v3 check-in resumes only from the Shared Sitdown session, and the old studio's "Continue planning with Hercules" still resumes the private draft. This needs Jonathan's call and a Codex trust review. The smallest safe design is a shared `checkInStage` on the session, plus the private draft reading it.

### 4. Slice 11: Our Path pieces per umbrella (commit `cd81b063`)

- **`pathMonths`** (`src/core/pathSignals.ts`)
  - **Umbrella shape.** For sorted households it adds `umbrellas`: a 0–1 shape per spending umbrella, computed as `0.3 + 2 × share` of the month's shared spending, keyed by umbrella id. It never carries an amount, and the reason reads "Spending under <Umbrella>".
  - **Seed tag.** It tags `umbrella-slots` in the month of the first household plan agreed under the money model (`umbrellaSeedMonth`: an active, scheduled or superseded household version activated or created at or after the marker's `migratedAt`). The month is clamped into the island's months.
  - **The check-in counts, once sorted.** For sorted households only (review M3), a closed Shared Sitdown session (the check-in) counts as that month's Sitdown for Together and Firsts. Closing a Chapter already fed Learning and Together.
- **`growIsland`** (`src/path/grow.ts`)
  - `umbrellaPieces` places a ring of twelve slots, radius 6.5, around the seed month's spot.
  - A pennant (`kind: "umbrella"`, with `umbrellaId`, `hue` and `n`) rises the first month, from the seed on, that its umbrella shows. It grows with every such month.
  - Existing pieces are unchanged; a test compares them with and without the pennants.
- **Rendering and names.**
  - `pathWorld3d` draws a post and a pennant in the umbrella's hue, and the pennant sways only through the scene's tickers.
  - Our Path names the piece "<Umbrella> pennant".
- **Scope.** Nothing new is stored or synced. The era model in the journey plan (`pathWorldVersion` 2) is not built.

### 5. Fictional seeds (commit `5a5ce7d8`)

- **The demo Plan.**
  - `generateDemoSuite` takes `fundModel?: 1 | 2`. The default, 1, is byte-identical: the replay test still compares a generation with its replay, and no pinned hash exists.
  - With 2, the investor Plan's bill lines use `lens: "prepare"`.
  - The App passes `fundModel: 2` only on a `VITE_FUND_MODEL_V2` build, in both the create call and the `regenerateDemoSuite` command args, and the authority replays whatever those args carry.
- **The habitats** carry no Plan and already sort. This is tested.
- **The fixture.** `planLifeFixture(view, { fundModel: 2 })` files the fictional rent under Prepare. The default is unchanged.

### 6–7. Gate and browser evidence (commit `4cbabd34` + this docs commit)

- **Harness.** `scripts/serve-plan-v3-integrated-proof.mjs` turns both flags on and sorts fictional books in the page. Its states are `sorted`, `proposed`, `divided` and `agreed`, and it also serves the category form.
- **Cellar proof.** `serve-household-home-proof.mjs` gains `sorted=1` and `{ fundModel: true }`.
- **Evidence script.** `test/plan-v3-integrated-layout.mjs` writes to `docs/evidence/plan-studio-v3-integrated/`.
- **Fixes found by the evidence:**
  - Under the money model, the Queen's pill read "+$4,000 not divided yet" beside a Now that already counted it. It now reads "$4,000 landed · not divided yet".
  - At 320px, and in Newfoundland's type, the category grid broke "Transport" mid-word and spilled the fund words. The grid now takes two columns, and the funds one, below 380px.

### 8. Trust-review fixes (`/home/claude/plan-studio/review/branch-trust-review.md`)

Every Blocker, High and Medium finding is fixed. Each fix has its own commit and test.

- **B1, the double roll (`a2cb65d5`).**
  - The rollover note now starts with `[cellar-roll:<recurrence>:<date>]`, so the 180-character limit can't cut the key off. `rolledFor` matches `[key]`.
  - `rollMissingSubscription` is now a captured command. It is registered in `executeIntent` and bound to the actor, so the authority replays it and re-reads "only once" on its own books.
  - A bare `allocateHouseholdFundSurplus` whose note carries a `cellar-roll:` key is refused.
  - Tests: a 200-character name rolls once; a second authority replay is refused.
- **H2, consent only on the phone (same commit).** The authority replay re-derives the stage, so a roll needs both the custodian's open offer and the partner's identical open row. The test replays a roll nobody agreed to, and it is refused.
- **H1, cellar live on merge (`aacbce63`).**
  - `VITE_CELLAR_V3`, off by default, gates `useCellarExtras`: the reads, the extra jars, the cards and the auto-withdraw effect.
  - `VITE_QUEENS_NEST` alone leaves the cellar as it was.
  - The proofs opt in with `{ cellarV3: true }`.
  - Test: with the flag off and a spent offer waiting, no extra jar is drawn and no command is sent.
- **H3, the private step always refused (`3f8ba2d0`).**
  - `fundModelPersonalUpdateAllowed` (`src/fundModelPersonalRule.ts`) is wired into `assertMemberPersonalUpdate` for `updateFundModel`. The Shared envelope must stay byte-equal, and only the member's own Personal money-model rows, designs and Plan drafts may change.
  - `commitFundModel` no longer stamps `lastCommittedAt` on a personal result; that stamp alone broke the rule.
  - Test: the boot's personal step and a private override pass; a Shared change or another private change does not.
- **M5, the silent boot (same commit).**
  - `fundModelBootNotice` shows the plan guard's words as a notice.
  - A lost "already sorted" race clears its error.
- **M1 and M3, flags-off drift (`625413fd`).**
  - `openChapter` writes `intendedMonth` only for a sorted household, or when a month is asked for.
  - `CHAPTER_MONTH_COMMAND_KINDS` is now only `closeChapterAtSitdown`, so an older phone's `openChapter` is judged by the data.
  - The island counts a closed check-in only once sorted.
  - Hercules's Plan tool text is `main`'s again, in both the app catalog and the Worker.
  - `test/plan-v3-flags-off.test.ts` checks that the flags are off, no month is written, an older phone (no stamps) opens and closes a Chapter, the tool text is `main`'s, and the island's Sitdown counting is unchanged.
- **M3, the Bridge filter (`0d9b316e`).**
  - Cellar labels now start with U+2063, and the filter requires it.
  - `savePlanBridgeDraft` and Hercules's Bridge action strip it, so a person's typed "Roll … — from the cellar" stays an ordinary, visible offer.
- **M2, split copy (`66558706`).** The reviewed plan keeps a division a record ("the Now figure itself is unchanged"), so the words changed rather than the numbers:
  - The suggestion has no "+".
  - A note says the funds still fill Prepare, then Protect, then Build.
  - A confirmation reads "Marked divided".
  - The test checks that the snapshot figures are the same before and after both confirm.
- **M4, card payments (`7e02a7ea`).**
  - Per Jonathan ("use the app's existing transfer/debt logic"), sorted households no longer see Moving-money lines, including the legacy card line, in the Add, Repeating or planned-expense pickers. A line already on a form stays.
  - Our Path umbrella shares ignore those lines.
  - Spending totals are unchanged. The Moving money rule now says new card payments are recorded as a transfer and that older lines still count in totals.
- **M6, test gaps.** Covered above: authority-level roll tests, the two-client stamp case (the older phone), and the personal rule. Two gaps remain, listed under Remaining gaps.
- **Evidence.** The integrated captures were refreshed (`27356ec3`).

### 9. Up to date with `main@d7b0151b` (#497, the Journey of Life)

- **Merge (`5f1e06f6`).** A merge commit, not a rebase, because the bundle is already out. Every conflict was resolved by keeping both sides:
  - **Version stamps.** `protocol`, `client`, `authority` and `workers/ledgerRoom` carry main's `pathEraVersion` beside `fundModelVersion` and `chapterVersion`. Each guard stays its own line, so an older client is refused only for the feature the household uses. `test/plan-v3-flags-off.test.ts` checks both directions: a household with eras refuses only a client missing `pathEraVersion`, and a sorted household refuses only a client missing `fundModelVersion: 2`.
  - **Registry.** The era commands sit beside the money-model commands, `closeChapterAtSitdown` and `rollMissingSubscription`.
  - **App.** Uses `generateDemoSuiteOffThread`, which passes our `fundModel` option through the worker unchanged.
  - **`OurPathWorld`.** Main's room head ("Plan our journey") now wraps our tent link.
  - **Decisions and handoff.** Both sides' entries are kept.
  - **Auto-merged files.** `pathWorld.ts`, `pathWorld3d.ts`, `pathSignals.ts`, `demoSuite.ts` and `types.ts`. The era islands, fog, gate, home upgrade and `EraPlanner` sit beside the umbrella pennants and the sorted-only "a closed check-in is the month's Sitdown" signal. The journey suites pass: `path-eras`, `path-era-islands` and `path-eras-ui`.
- **Renumbering (`2d14b68f`).** Main took D-268, so this branch's D-268…D-281 became D-269…D-282. Only this branch's lines changed; main's Journey of Life references keep D-268. Commit subjects keep the old numbers.
- **Our Story, flags off (`f7d536ce`).** Generating `habitat-story` (seed 41) with our flags off was not byte-identical to main at first: every shaped household gained an empty `fundModelRows: []`. Empty money-model rows now join no household or envelope shape, while an emptied list still overwrites the old one. Both trees now give fixture hash `f8ba4485…`. `test/plan-v3-flags-off.test.ts` covers the shape.
- **Our Story, `VITE_FUND_MODEL_V2` on (`f7d536ce`, `92d10315`).**
  - **Sorting.** The story's plans carry no Protect bill lines, so the guard passes and the migration sorts it. Its bills show in Prepare, and the funds add up to the King.
  - **Coverage fix.** Its bills are card-paid, so Prepare has no Fund-backed bills. `fundSnapshot` still called "Cloud storage" short by $4 beside $14,965 of Now. Coverage now reads only the month's Fund-backed occurrences (`prepare.fundBills`), and the studio says "Paid outside the Fund this month".
  - **New test.** `test/habitat-story-fund-model.test.ts` (serial, isolated) checks the sort, the eras and months, the selectors, and a render of the Plan Studio v3 and the cellar v3.
- **Evidence.** Eight new captures:
  - The story studio at classic 390 and 720, taylor 1100 and newfoundland 320, plus the Prepare sheet.
  - The story cellar at classic 390, newfoundland 1100 and taylor 320.
  - All pass with no overflow and no axe findings.
  - The story cellar's own rail still reads "Cracked … $0.00 saved of $3.99" for a card-paid subscription. That is the cellar's existing rail, unchanged from `main`, and listed under the remaining gaps.

## Acceptance evidence

**Type check.** `npx tsc --noEmit -p .` is clean at every commit.

**New tests:**
- `test/plan-v3-fund-model.test.ts` (8), which covers:
  - the flag switch
  - mapping to the cent
  - the short line
  - undivided contributions with the draft split
  - the unsorted fallback
  - the Chapter month and reminder, never closed
  - jsdom: propose, then the partner confirms, and nothing posts
  - jsdom: the custodian's refill, confirmed by the partner, and nothing posts
- `test/cellar-integration.test.ts` (6), which covers:
  - recognising the cellar's rows
  - the Sitdown, island, pulse, presence and badge all unchanged
  - no "took it back" after a withdrawal
  - the phone and authority author checks
  - the umbrella hue
- `test/path-umbrella-pieces.test.ts` (4), which covers:
  - no shapes on v1
  - seeding only by a plan agreed after the migration
  - no amounts
  - existing pieces unchanged
  - a closed check-in and Chapter feed the month
- Trust-review tests:
  - `test/cellar-integration.test.ts` (+3: long name, authority roll-once, authority consent and forged note)
  - `test/cellar-v3-ui.test.ts` (+1: flag off)
  - `test/fund-model-personal-boot.test.ts` (4)
  - `test/plan-v3-flags-off.test.ts` (5)
  - `test/fund-model-card-payments.test.ts` (3)
  - `test/fund-model-chapters.test.ts` (sorted-only months)
  - `test/plan-v3-fund-model.test.ts` (split words, figures unchanged)
- `test/fund-model-demo-seeds.test.ts` (3), which covers:
  - the investor v1 default is unchanged and still refused
  - v2 migrates, conserves and replays exactly
  - the habitat migrates
  - `planLifeFixture` v2 migrates

**Quick gate:** `pnpm test -- --risk=high --focus=… --focus-reason="D-282 integration…"`.
- At `5a5ce7d8` (clean tree): **`quick-gate-passed; time-budget-breached`**. It took 794.7 s against a 300 s budget; the serial phase took 552.7 s, because `demo-suite` generates many fixtures.
  - diff-check, ai-surface and TypeScript (59 s) passed.
  - 83 test files were selected, including `app-startup-p1`, `month-rehearsal-mainline`, `demo-suite`, `habitat`, `ledger-sync-*`, every `plan-*`, `queen*`, `path-*` and `fund-model*` file, and the workspace set.
  - `uiProofRequired: true` is answered by the browser run below.
- At `c39c6ce8` (clean tree, after the docs commit): **`quick-gate-passed; time-budget-breached`**. It took 673.9 s; the same 83 files were selected, fast took 173.3 s and serial took 424.7 s.

- At `8fc6599f` (clean tree, after the trust-review fixes): **`quick-gate-passed; time-budget-breached`**. It took 667.2 s over 86 files; fast took 170.4 s and serial took 414.7 s.

**After the `main@d7b0151b` merge:**
- **Targeted suites** (122 files: every track, plus `path-eras*`, `our-path-*` and `demo-suite-ui`): 1190 passed, 7 failed.
  - 6 failures are pre-existing on `main@d7b0151b`: `onboarding-categories` ×2, `hercules-wardrobe-*` ×3 and `sync-integrity` ×1. All were reproduced in a temporary `d7b0151b` worktree.
  - The 7th was the `ledger-import-parity` timeout under load; that suite passes alone.
- **Our Story fixture hash** with the flags off is identical to main (`f8ba4485…`).
- **`test/habitat-story-fund-model.test.ts`:** 4/4.
- **High quick gate** at `8761878f` (clean tree, base `d7b0151b`): `quick-gate-passed; time-budget-breached`. It took 1553 s over 93 files: fast took 118.9 s and serial took 1320.4 s. The serial lane includes `habitat-story` 10/10, `habitat-story-fund-model` 4/4, `habitat` 6/6 and `fund-model-demo-seeds` 3/3.

**Targeted suites after the trust-review fixes** (118 files): 1151 passed, 6 failed and 7 skipped. The failures are the same 5 pre-existing ones, plus the `ledger-import-parity` timeout under load; that suite passes alone (5/5).

**Targeted suites for all three tracks, before the fixes** (113 files: `plan-`, `queen`, `kitty`, `path-`, `hercules-`, `fund-model`, `cellar-`, `chapter`, `sitdown`, `category-`, `our-path`, `ledger-sync`, `ledger-import-parity`, `app-startup-p1`, `month-rehearsal-mainline`, `onboarding-categories`):
- 1119 passed, 6 failed and 7 skipped.
- 5 of the failures are the pre-existing ones above.
- The 6th was a `ledger-import-parity` timeout under load; that suite passes alone.

**Browser evidence:** `HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/plan-v3-integrated-layout.mjs` produced **87 records, 0 failures** and 103 PNGs.

- **Rest (sorted):**
  - Three themes × 320/390/720/1100.
  - Each capture asserts the split card, "Bills covered", the August reminder, and no "+$4,000".
  - Overflow, our own targets of at least 44px, and axe (serious or critical) all pass.
- **The partner's yes to the split:**
  - At 390 and 1100.
  - At 390 it also shows the moment gone after the yes.
- **Drawer sheets:**
  - The Protect sheet with a refill waiting (custodian) and the Letter tray: three themes at 390 and 1100, opened by keyboard.
  - The partner's Protect sheet at 320/390/1100: "Yes, lend it", then "Agreed by both of you".
- **The check-in:**
  - Looking back, with the reminder.
  - Coming in, with the split. At 390 the split is proposed.
  - Protect top-up, with the refill form.
  - Captured for Classic at 320/390/720/1100, and for Taylor and Newfoundland at 390.
- **Reduced motion, at 390 and 1100:**
  - Lite is on by default.
  - The rest screen and the check-in run 0 animations.
- **The category grid:**
  - Three themes × four widths.
  - 12 tiles, no Protect fund, and no words spilling out of their tiles.
- **The sorted cellar:**
  - Three themes × 320×700, 390×844, 720×900 and 1100×800, in the flat world.
  - The bill jars carry umbrella hex tints, and the rail shows no figures.
  - The missing video club card, and the glass pay card with "Hide my pay from the jars".
  - Axe passes in Classic, and the page doesn't scroll.
  - Under reduced motion the sparks don't animate (390 and 1100).
- Headless Chromium with SwiftShader. No real phone and no screen reader.

## Decisions (D-282), defaulted, confirm

- Under the money model, a landed contribution counts in the funds already, so the pill reads "landed · not divided yet".
- Anyone may propose Hercules's split. The rest screen offers the draft as-is; editing the split is left to a later tool.
- Only the custodian sees the refill form, which accepts a free amount to Everyday or Build. The command caps meaning; the panel adds no cap.
- The Chapter month and reminder show only for sorted households.
- Cellar consent stays on Bridge rows and is hidden from shared surfaces. It is not moved to `fundModelRows`, because that would need a new row kind.
- Pennant slots are seeded by the first household plan agreed after the migration, clamped to the current month. A pennant rises the first month its umbrella shows spending.
- A closed check-in counts as a Sitdown for Together and Firsts, for sorted households only.
- Cellar v3 needs `VITE_CELLAR_V3` (default off).
- A split is a shared record: the words say the funds still fill in order.
- Sorted households record card payments as transfers. Moving-money lines are hidden from new-spending pickers, and spending totals are unchanged.
- Chapter months are written only for sorted households.
- The demo Plan files bills under Prepare only for `VITE_FUND_MODEL_V2` builds.
- The category grid uses two columns below 380px.

## Remaining gaps

- **Two resume owners** (step 3): needs Jonathan's call and a Codex trust review.
- **No App-level boot test.** Nothing drives the fund-model boot through `runKitchen` (review M6). The rule is tested as a pure function over the real command results.
- **No v1 golden against `main`.** There is still no byte-equal comparison of the nest, Queen or cellar against `main` (review M6); `test/plan-v3-flags-off.test.ts` covers the listed behaviours only.
- **Low findings not addressed:**
  - L1: a goal design's fund is dropped (latent).
  - L2: the strict shaper throws on a newer marker.
  - L3: the snapshot has no restore path, and a rollback server has no guard.
  - L4: the pay-hide ordering relies on each phone's clock.
  - L5: cellar Bridge ids remain in Hercules context.
- **The cellar rail's own short reading.** For a card-paid bill (Our Story), the rail still reads "Cracked … $0.00 saved". This is main's cellar rail logic; it is not changed here.
- **`sync-integrity`** fails on `main@d7b0151b` as well (other member's personal rows in a full-snapshot reconcile). This is not caused by this branch, but it deserves a look before merge.
- **Pay-hide marks.** Marks written before this change, or replayed from an older client, can't prove their author on the read side. The authority now refuses new foreign marks.
- **Cellar rows in Hercules context.** They still appear as allowed `plan-bridge` reference ids in `herculesCompanionContext`, and remain in the raw synced Bridge collection.
- **The era model.** Its islands (`pathWorldVersion` 2) are not built.
- **Money track items still open:** the Q3 Prepare figure and Knight home; the Codex trust review of D-269–D-273; no Production revert.
- **Studio track items still open:** personal pause isn't saved; old studio stage titles differ from v3's.
- **Cellar track items still open:** the privacy review (H8 / R2-M5); the per-pay-date publication isn't built.
- **Quick gate time.** It breaches its 300 s budget whenever `demo-suite` is selected.

## Handoff

- **Next owner: Codex.** Trust review of:
  - D-282 (the author check, the Bridge filter, the demo `fundModel` argument through `regenerateDemoSuite`)
  - the money track's D-269–D-273
  - the resume-owner question
- **Then Jonathan:**
  - turn on both flags in Development
  - walk a split, a refill and a check-in on both phones
  - answer the defaulted lists
- **State:** local branch `claude/plan-studio-v3` only. Not pushed, not a PR, not merged, not deployed.
