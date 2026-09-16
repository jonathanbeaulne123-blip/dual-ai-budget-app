## Plan Studio v3, integrated — the studio reads the money model, the cellar keeps its offers, pennants per umbrella (2026-09-16, D-281)

Branch `claude/plan-studio-v3` merges `claude/plan-v3-money`, `claude/plan-v3-studio` and `claude/plan-v3-cellar` on `main@6160fb03`, plus seventeen integration commits: seven for D-281, eight for the trust-review fixes and evidence, and two for docs. **Risk: High.** There is no new synced shape, schema or command.
- Budget (5): +1.
- Engagement (3): +1.
- Details: [the worksession](worksessions/2026-09-16-plan-studio-v3-integration.md).

**What changed:**
1. **Studio.** With `VITE_FUND_MODEL_V2` on, `src/plan-v3/model.ts` reads `fundSnapshot` for sorted households (`fundModelSnapshot`); otherwise it keeps the transitional adapter.
   - `FundProposals.tsx` wires the split (both confirm) and the Protect refill (custodian proposes, partner confirms).
   - The open Chapter reads as its calendar month, with its reminder.
2. **Cellar.** Consent stays on Bridge rows (the division and refill records can't name a goal and an occurrence without a new row kind).
   - `src/core/cellarBridge.ts` filters those rows out of the Sitdown brief, the island, the Fund pulse and presence lines, the Bridge editor, Hercules's bridge status and the studio badge.
   - The pay-hide author check sits in `setMyCellarPay` and `executeIntent`.
   - `CellarJar.umbrellaHue` is set.
3. **Resume owners.** Left as two, with the reason: the shared session versus the member-personal companion workflow. See the worksession.
4. **Slice 11.** `PathMonth.umbrellas`, the `umbrella-slots` seed and `umbrellaPieces` pennants, and a closed check-in counts as a Sitdown.
5. **Demo Plan.** `generateDemoSuite({ fundModel: 2 })` from flag-on builds files bills under Prepare; the default is byte-identical. `planLifeFixture(view, { fundModel: 2 })`.
6. **Evidence fixes.**
   - The Queen's pill no longer adds a landed contribution on top of Now.
   - The category grid takes two columns below 380px.

**Verification:**
- `npx tsc --noEmit -p .` is clean.
- **Quick gate at High** (`pnpm test -- --risk=high --focus=… --focus-reason=…`) at `5a5ce7d8`: `quick-gate-passed; time-budget-breached`.
  - 794.7 s in total: 83 files, of which serial took 552.7 s because of `demo-suite`.
  - Final run at `c39c6ce8` (clean tree, after the docs commit): `quick-gate-passed; time-budget-breached`. It took 673.9 s: 83 files, of which fast took 173.3 s and serial took 424.7 s.
- **Targeted suites** for the three tracks: 113 files, 1119 passed.
- **Failures that are not ours:**
  - 5 fail identically on a clean `6160fb03` worktree: `onboarding-categories` ×2, and `hercules-wardrobe-catalogue`, `-navigation` and `-ui`.
  - 1 was a `ledger-import-parity` timeout under load; it passes alone.
- **Browser:** `HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/plan-v3-integrated-layout.mjs` produced 87 records, 0 failures and 103 PNGs in `docs/evidence/plan-studio-v3-integrated/`.
  - Covered: the rest screen, the check-in, drawer sheets, the partner's yes, the category grid and the sorted cellar (missing subscription, pay glass).
  - Three themes × 320/390/720/1100, with reduced motion at 390/1100.

**Trust-review fixes** (`branch-trust-review.md`; every Blocker, High and Medium finding, one commit and test each: `a2cb65d5`, `aacbce63`, `3f8ba2d0`, `625413fd`, `0d9b316e`, `66558706`, `7e02a7ea`; evidence `27356ec3`):
- **B1 and H2.** The cellar roll-over is an authority-replayed command: its key leads the note, it rolls once, and both yeses are re-checked on the server.
- **H1.** `VITE_CELLAR_V3` is off by default.
- **H3.** A rule for the private `updateFundModel` step.
- **M1 and M3.** Flags off behaves as `main`: no Chapter month, no new refusals for older phones, `main`'s tool text, and the same island Sitdown counting. The Bridge mark can't be typed.
- **M2.** The split copy says a split is a record.
- **M4.** Card payments are hidden from new-spending pickers once sorted, and totals are unchanged.
- **M5.** A blocked boot says why.
- **After the fixes:**
  - Targeted suites: 118 files, 1151 passed. The same 5 pre-existing failures remain, plus a parity timeout under load; parity passes alone.
  - Evidence refreshed: 87 records, 0 failures.
  - Quick gate at High on `8fc6599f` (clean tree): `quick-gate-passed; time-budget-breached`. It took 667.2 s over 86 files.

**Defaulted, confirm:** the list is in D-281.

**Uncertainty:**
- **The resume-owner merge.** It needs a synced link field and a trust review.
- **Old pay-hide marks.** Existing marks can't prove their author.
- **Hercules context.** The cellar rows' ids remain in the companion context's `plan-bridge` reference set.
- **Review test gaps.** There is no App-level `runKitchen` boot test and no v1 byte-equal golden against `main` (M6).
- **Low findings not addressed:** L1–L5.
- **Not built.** The era islands.
- **No real device check.** No real phone and no screen reader were used.

**Environment:** fictional fixtures only. Both flags stay off by default.

**State:** not pushed, not a PR, not merged, not deployed, not live-verified.

**Next owner:**
1. Codex: trust review of D-281 and D-268–D-272, plus the resume-owner design.
2. Jonathan: turn on both flags in Development, walk a split, a refill and a check-in on two phones, and answer the defaulted lists.

## The money model — Everyday Queen, Prepare / Protect / Build, 12 umbrellas, Chapters as months (2026-09-16, D-268 – D-272)

Branch `claude/plan-v3-money` on `main@6160fb03`: nine commits, delivered locally. **Risk: High.** The change touches money meaning, adds a new synced non-money collection (`fundModelRows`), adds two command stamps (`fundModelVersion`, `chapterVersion`), and changes Hercules context.
- Budget (5): +3. Every line has one fund. Prepare fills first. Goal money is never counted toward bills. Now reconciles to the cent.
- Engagement (3): +1. The 12-tile category grid, words that match the Queen's banks, and Chapters as months.
- Details, the API and what wasn't built: [the worksession](worksessions/2026-09-16-money-model.md).

**What changed:**
- `src/core/fundRules.ts`: rules, umbrellas, `fundFor`, `allocateFunds`, and the collection.
- `src/core/fundModelCommands.ts`: the household and personal migration, overrides, `setCategoryHome`, and the division and refill proposals.
- `src/core/fundModel.ts`: the pure selectors, including `fundSnapshot`.
- `projectKittyNest` now runs in v2.
- The umbrella lock is enforced across every writer that could create a group.
- The words moved with the numbers: planGuide, workbench, adoption, drift, lessons, the Kitty Nest, the Queen and Hercules tool text.
- Chapters gained `intendedMonth`, reminders and `closeChapterAtSitdown`.
- Category UI: the add-category grid, onboarding umbrellas, and activity filters.
- `src/fundModelBoot.ts` plus the App effect and reload banner.
- Island label guard.

**Verification:**
- `npx tsc --noEmit -p .` is clean.
- Quick gate: `pnpm test -- --risk=high --focus=test/fund-model*.test.ts …` → `quick-gate-passed`.
  - 64 files: 691 passed and 7 skipped, plus 107 serial tests.
  - 203.6 s of a 300 s budget.
  - Selected tests include `app-startup-p1` and `month-rehearsal-mainline`.
  - The gate flagged `uiProofRequired: true`. No browser captures were taken in this session.
- Additional targeted runs, all green:
  - 48 `plan-*`/`queen*`/`kitty*`/`path-*`/`hercules-*` files, 477 tests.
  - `ledger-import-parity`, `category-*` and the ledger-sync set.
- `test/onboarding-categories.test.ts`: 2 tests fail identically on clean `main` (a Chapter 9 merge through the command boundary). This is pre-existing and not masked.

**Uncertainty:**
- Codex trust review is needed for the stamp matrix, the collection, the migration payload and the Hercules marker/override context.
- Once a household is sorted, or any Chapter carries a month, pre-branch clients fail closed. Both phones need the release first.
- Defaulted answers are listed in D-268 – D-272 ("defaulted, confirm").
- There is no Production revert.
- Demo-suite plans still hold Protect bill lines, so the guard refuses them.
- Visual evidence (320/390/720/1100 × three themes) for the grid, banner and reminder is still owed.

**Environment:** fictional fixtures only; nothing hosted; flag `VITE_FUND_MODEL_V2` off by default.

**State:** not pushed, not a PR, not merged, not deployed, not live-verified.

**Next owner:**
1. Codex: trust review.
2. Jonathan: answer the defaulted questions, then approve turning the flag on in Development.
3. The Studio track: consume `fundModel.ts`.
4. The Cellar track: read `umbrellaHueForCategory`, and the Q-E consent work.
## Plan Studio v3, studio track: the plan at rest, the tool drawer, one check-in (2026-09-16, D-273–D-277)

Branch `claude/plan-v3-studio` on `main@6160fb03` (#495). **Risk: Medium.** The new UI sits behind the new default-off flag `VITE_PLAN_STUDIO_V3`, so the current studio is unchanged when it is off. The check-in writes only through existing commands (`appendPlanSitdownTurn`, `acknowledgeHouseholdPlan`, `closeChapter`/`openChapter`, `addRitual`). The F2 resume-ownership merge still needs a trust review. Budget (5): +1. Engagement (3): +3. Details: [the worksession](worksessions/2026-09-16-plan-studio-v3.md).

**Examined:**
- the studio side: `PlanStudio.tsx`, `ChapterPanel.tsx`, `useDialog`;
- the money readings: `kittyNest`, `fundWalk`, `householdFund`, `planProjection`, `queenCellar`;
- the Plan and Sitdown records: `planSystem` (acknowledgement, the Sitdown session), `commands.appendPlanSitdownTurn`/`acknowledgeHouseholdPlan`, `chapters`, `sitDown`, `sitdownBrief`;
- Our Path: `pathWorld`, `pathBridges`, `src/path/**` (the tent, `PathMiniMap`, `pathSitdownClosedMonths`);
- the figures: `QueenFigure`, `queenPresentation`, `NestPortrait`/`KittyFlat`, `HerculesPortrait`;
- the three mockups and the build plan's Choices log.

**Changes:**
- `src/plan-v3/**` (new): the rest screen, the drawer, the sheets, the check-in, the adapter and the CSS.
- `PlanStudio.tsx`: a switch, plus `PlanStudioClassic` with `embeddedSection`.
- `src/path/tentContext.ts` and a one-line provider in `OurPathWorld.tsx`.
- `vite-env.d.ts`.
- `scripts/serve-plan-v3-proof.mjs`, three tests, and `docs/evidence/plan-studio-v3/`.

**Adapter shape:** `planStudioFundSnapshot(h, { memberId, view, today })` returns `{ now, undividedContributions, prepare, protect, build, flow }`, with `TODO(plan-v3 → fundModel)` marking the swap.

**Verification:**
- `tsc` is clean.
- The v3 and Plan UI suites pass 37/37.
- The Medium quick gate returned `quick-gate-passed; time-budget-breached` (354 s against 300 s, of which TypeScript took 126 s): 311 fast and 128 serial tests, including `app-startup-p1`.
- `test/plan-v3-layout.mjs` produced 52 records with 0 overflow, 0 small targets, 0 serious axe findings and 0 page errors. They cover three worlds × 320/390/720/1100 and the full two-member check-in. Lite runs 0 animations.
- Chromium here was the headless shell. No real phone was used, and no screen reader was heard.

**Uncertainty:**
- **Resume.** There are still two resume owners (the Sitdown session and `plan-guided-draft`).
- **Chapters.** Chapters are not calendar months yet (core).
- **Protect and Prepare.** Until the money track lands, Protect still holds the bills, and Prepare shows $0 beside "Bills covered".
- **Stage titles.** The old studio titles saved stages differently.
- **Unconfirmed defaults.** See the worksession's "Defaulted, confirm" list.

**Environment:** fictional books only; nothing hosted.

**State:** local branch; not pushed, not a PR, not merged, not deployed, not live-verified.

**Next owner:** Codex runs the F2 trust review and the fundModel swap after the money track merges. Jonathan then tries it on both phones with the flag on in Development.
## The cellar's pay in glass, contribution banks and missing subscriptions — Plan Studio v3, cellar track (2026-09-16, D-278–D-280)

Branch `claude/plan-v3-cellar` on `main@6160fb03` (#495), in small commits. **Risk: Medium-High.** It adds new doors onto existing commands only: `allocateHouseholdFundSurplus`, the Plan Bridge propose/decline/withdraw commands and `dismissNotice`. There is no new command, schema, sync or Hercules payload change, and everything is behind `VITE_QUEENS_NEST`.

- **Budget (5):** +1. A missed or lower subscription charge becomes a visible, agreed, one-time roll into a goal. It is capped at the safe surplus and never doubled. The pay glass never claims money exists.
- **Engagement (3):** +2.
- **Details:** [the worksession](worksessions/2026-09-16-cellar-income-missing-subs.md).

**Examined:**
- The cellar: `queenCellar.ts`, `QueenCellar.tsx`, `QueenCellarRail.tsx`, `cellarZoom.ts` (D-265).
- `fundWalk.ts`, and `householdFund.ts` (motions, rollover, kitty allocations).
- The jug and gun: `QueenLoft.tsx`, `queenGun.ts`.
- Plan Bridge commands and their readers: `fundPulse`, `sitdownBrief`, `pathBridges`.
- `recordBillPayment`, `skipOccurrence`, `pauseRecurrence`, `planSourceVisible`, `memberEarningSchedule`, `dismissNotice`.
- The migration plan §2e and review H8 / R2-M5, the BUILD-BRIEF defaults, and the Choices log.

**Changes:**
- **New pure selectors:**
  - `src/core/cellarIncomeJars.ts`: household-visible sources; own Personal rows by per-device opt-in only; shared hide/show marks.
  - `src/core/missingSubscriptions.ts`: 3-day grace; one more cycle; price change, cancelled and Personal excluded; offer, yes and roll wrappers; occurrence key refused twice.
- **Rail extras and cards:** `QueenCellarRail.tsx`, `QueenCellarExtras.tsx` (new), `QueenCellar.tsx`, `queen-cellar.css`.
- **Proof page:** seeds `cellar3=1&roll=…&member=…`.
- **Focus-map entry** appended last.
- **D-278, D-279, D-280.**

**Verification:**
- `tsc --noEmit` is clean.
- `vitest`:
  - `cellar-missing-subscriptions` 16/16
  - `cellar-income-jars` 7/7
  - `cellar-v3-ui` 6/6
  - `queen-cellar` + `queen-cellar-ui` + `queens-nest-ui` still green
  - 6 files, 82/82 in total
- **Quick gate (Medium-High, three focus files):** `quick-gate-passed`, 22 files / 271 tests, 124 s of 300 s.
- **Browser:** `test/cellar-v3-layout.mjs` → `docs/evidence/cellar-v3/`: 22 records, 0 errors, no page scroll, axe clean (Classic), three themes × 320×700/390/720/1100, partner/Confirm/rolled states, reduced motion.
- **Real phone:** not available.

**Defaulted, confirm:**
- The 3-day grace.
- "One more cycle" means until the cycle after next.
- "Less" is measured against the current usual amount; two equal lower charges mean a price change.
- A cancelled subscription is never missing.
- Consent is carried as Plan Bridge rows: the offer also shows at the Sitdown, on the island and on the crown.
- Pay sources are household-visible only.
- "Hide my pay" hides the glass only, via shared notice marks.
- "Could stand at" is that day's water plus that one pay.

**Uncertainty:**
- Codex trust and privacy review is needed (the Bridge-as-consent path, the note-key guard, the notice-key marks, the income sources).
- `dismissNotice` has no author check.
- A spent offer reads "took it back" on the island.
- The extras are drawn, not sculpted, in 3D.
- SwiftShader only.

**Environment:** fictional books only; nothing hosted.
**State:** not pushed, not a PR, not merged, not deployed, not live verified.
**Next owners:** Codex (review), then Jonathan (defaults), then the integrator (merge beside the money and studio tracks).

## The Journey of Life and the Our Story habitat (2026-09-16, D-268)

Branch `claude/journey-of-life` (one squashed commit) on `origin/main@6160fb03` (#495), delivered as a bundle and a patch; built on #494 and rebased cleanly over #495. **Risk: High.** It adds a new synced row kind (`era`) and a new capability flag (`pathEraVersion`), and changes performance (not output) in `refreshDuplicateFlags`.

**Examined:**
- The Our Path collection and its capability chain: `pathWorld.ts`, `protocol`, `authority`, `client`, `ledgerRoom`, replay authority.
- The island page and renderer.
- The habitats and the Demo Suite: `habitat.ts`, `demoSuite.ts`, `stressSeed.ts`, `demoSuiteIdentity.ts`.
- Migration 021 seat invites.

**Changes:**
- **Core:**
  - Era rows are agreement rows with words only.
  - `pathEras.ts` holds the read-model, the finish lines (survive / banks / agree) and the commands `proposePathEra`, `proposePathEraPlan` and `crossPathEra`.
  - `assertEraProposalFits` enforces the shape rules.
  - `pathMonths` accepts an era window.
  - The `pathEraVersion` guard is added.
- **Renderer:** floating era islands (past islands grown and coarse-sampled; future ones fogged with plan silhouettes; pencil for suggestions), the gate with lanterns, the home that upgrades, the Sky frame and the safe area.
- **Page:**
  - The main island grows from the current era only.
  - Marks, cards, "Cross together", the journey panel and the outline.
  - `EraPlanner`, with one save.
  - The current era's banks stand on the island first.
- **Habitat:**
  - `habitat-story` covers 25 months. It adds stress-seed options (`months`, `tipSeasons`, `fixedBills`, `sampleGoals`), whose defaults are byte-identical.
  - The fixture clock is `atSyntheticClock`.
  - A third Demo Suite button.
  - Generation and verification run in `src/demoSuite.worker.ts`.
- **Test lanes:** `habitat.test.ts` and `habitat-story.test.ts` run alone in the serial lane.

**Verification:**
- `tsc` is clean.
- **Integrated High quick gate:** `quick-gate-passed; time-budget-breached`, 1,111 s against 300 s.
  - Fast lane: 38 files, 385 tests.
  - Serial lane: 89 tests plus the isolated fixtures, including `habitat-story` 10/10 and `habitat` 6/6.
  - The breach is the two fixture generators: Our Story takes about 3 min to generate and 3.6 min to verify in Node.
- **Focused files:** `path-eras` 10, `path-eras-ui` 6, `path-era-islands` 9, `our-path-world` 20, `our-path-world-ui` 36, `path-minimap` 4, `habitat` 6, `demo-suite-seat`/`demo-suite-ui`, `test-lanes`.
- **Browser evidence** (`docs/evidence/journey-of-life/`):
  - `islands/`: the renderer on injected scenes.
  - `page/`: 49 captures across three themes at 320/390/720/1100, including no-WebGL.
  - `story/`: Our Story generated in the worker on the real component, with page responsiveness recorded in `report.json`.
  - `story-house/`: Our Story on the actual App page (Queen's Nest on) — Home, the cellar's 16 bills, the loft's ten Build banks (each a fired studio piece dressed for its purpose and sized by its goal) and the Our Path tab, at 1100 and 390.
  - In this container the App's PGlite open deadline (12 s) trips for the existing `habitat-well` too, so "Books need attention" tops those stills. This is environmental and pre-existing, not a regression; **Retry validation** is the in-app recovery.
- **Dev-server note:** on the Vite dev server, the proof must load the world module before the long generation. Otherwise the dependency optimiser leaves the dynamic import pending and the page falls back to the flat map. This was found and fixed in the proof script; production bundles are unaffected.

**Uncertainty:**
- Jonathan still needs to confirm what "without going broke" means (the recommendation was applied).
- Codex trust review is needed for `pathEraVersion`, `assertEraProposalFits`, era rows under `pathWorldChangeAuthorized`, `duplicate.ts` and `atSyntheticClock`.
- Nobody has yet invited Bianca into a generated habitat's existing seat on the live Development site.
- Generating Our Story takes minutes on a phone, so press it on the desktop.

**Environment:** fictional Development data only; nothing hosted was written.

**State:** not pushed, not a PR, not merged, not deployed, not live-verified.

**Next owner:** Jonathan (apply the patch; the delivery bot opens the PR). Then Codex for the trust review. Then press "Habitat · our story" on Development and invite Bianca.

## Our Path, next level — sturdy island, then the app comes onto it (2026-09-15, D-264)

Branch `claude/our-path-next-level` on `origin/main@fe0cb3bb` (#489), delivered as a bundle and a patch. **Risk: High** — a new per-feature capability flag on the ledger command (`pathWorldVersion`, mirroring D-245), and owner-only Personal rows (footpaths, private bridge planks) drawn on the household surface. Jonathan's two calls today: the Together tab stays its own tab and the campfire is a door to it; step 2 started with the Kitty studio. Budget (5): +0/+1 — nothing posts; the island gains doors to the Fund, Calendar, planner, Together, Charter, Time Machine, Play and the Kitty room. Engagement (3): +3. Details, orchestration log, evidence and every "one step further" idea: [the worksession](worksessions/2026-09-15-our-path-next-level.md).

**Examined:** the D-262 island (`src/path/**`, `src/core/pathWorld.ts`, `pathSignals.ts`), the D-245 guard chain (`protocol`, `authority`, `client`, `workers/ledgerRoom`), Fund projector (`householdFund.ts`, D-247), `KittyBankRoom`/`PlanStudio` source focus, `HouseholdTogether`, `sitDown.ts`/`planHerculesSessions`, `charter.ts`, `softPresence`, `monthObligations`/`fundHorizon`/`monthSpread` paydays, `tasks.ts`/`agenda.ts` evidence, `closedMonths`/`weeklyDocumentStamps`, `planBridge*`, `boardMedia`, `TimeMachine`, `QueenHome`.

**Changes (one commit per slice, merged in order):** `pathWorldVersion` guard + `docs/briefs/OUR_PATH_TRUST_BOUNDARY.md`; world sleeps through the tent, idle/offscreen pause, Full/Lite tier, light cap, lost-context rebuild; the walkers (`src/path/walk.ts`); pure read-models `src/core/pathWeather.ts`, `pathStones.ts`, `pathLand.ts`, `pathFootpaths.ts`, `pathBridges.ts`, `pathWords.ts`; Kitty studio in the landmarks (kiln, coins, deep link via `pathTentFocus`); Together on the island (Sitdown-aware fire, Charter square, decision forks, set land, both-present crackle); Calendar weather; stepping stones; bottle note; first frost; Hercules at the tent in his outfit + Play cottage; board photos on memory flags; Time Machine door (`initialPeriod`); Home window (`PathMiniMap`); private footpaths and bridges; accessibility pass; review fixes. Plans only: `docs/briefs/OUR_PATH_FUND_ELEVATION_PLAN.md`, `docs/briefs/OUR_PATH_PERSONAL_ISLAND_PRIVACY_REVIEW.md`.

**Verification:** `tsc` clean after every merge. Integrated High quick gate: 640 of 642 (229.8 s / 300 s), the two failures being `month-spread` ×2 — pre-existing on a clean `fe0cb3bb` worktree together with `copy-budget` ×2 and `sync-integrity` ×1; none masked. Island suites green (35 + 20 UI/core, 8/7/4/6/5/5 read-models, 4 minimap, 8 time-machine, 4 plan-life, 24 queens-nest, 82 app-startup-p1 D-183). axe 4.13 × 12 states: 42 serious → 0. 21 captures in `docs/evidence/our-path-world/next-level/` (three themes × 320/390/720/1100/1440, hard-story card, reduced motion, no-WebGL, outline, tent, empty): zero page errors, no overflow. Real phone: **not available** (SwiftShader only).

**Uncertainty:** Codex trust review needed for the guard and for the owner-only marks on the household island; `mergeShared` still trusts full snapshots; the Fund horizon refuses (not mists) when a bill exceeds the balance; screen readers not heard.

**Environment:** fictional habitat books only; nothing hosted. **State:** not pushed, not a PR, not merged, not deployed, not live-verified. **Next owner:** Codex (two trust reviews), then Jonathan to merge and try it on his phone on Full and Lite.

## The Queen is Jonathan's Mandevilla Queen model (2026-09-15)

Merged as #492 (D-266). Follow-up branch `claude/queen-bank-models`, one commit on `origin/main@9f18b95` (#492) (D-267): Home's Protect bank stands as Jonathan's Mandevilla Guardian and Build as the Mandevilla Mastermind, with the same never-alter rule and a silent fallback to the studio cats. Not pushed, not merged, not deployed. **Risk: Medium-Low.** Presentation only, behind `VITE_QUEENS_NEST`; one new static asset (3.2 MB, 2.4 MB gzipped) loaded by the Home 3D world.

What changed:
- `src/queen/world/queenModel.ts` loads, measures and fingerprints the model; `queenSculpture.ts` gains `setModel` / `setAwaitingModel` and stands the readings around it; `queenWorld.ts` loads it and reports `model` in stats; `QueenHome` switches the still words (`queenModelStill`) and sets `data-queen-model`.
- The model is never altered. Crown light, coins (fill and freshness), kintsugi on the planter, new growth on her vines, stones and marks carry the readings.

Details: D-266 and the [worksession](worksessions/2026-09-15-queen-mandevilla-model.md).

Verification: `tsc` clean; `test/queen-model.test.ts` 8/8; quick gate Medium `quick-gate-passed` (15 files, 178 tests, 89.8 s of 300 s); `test/queen-model-layout.mjs` 13 browser records (3 themes; 320/390/720/1100; model refused → drawn, silent), in `docs/evidence/queen-model/`. `test/queen-world-layout.mjs` times out at its first 15 s wait here on this branch **and on untouched `main`** (environmental), so it is not claimed.

Next owner: Jonathan (look at her; decide the open items in D-266), then the delivery bot. Not pushed, not merged, not deployed.

## The loft's studio cats and money gun, held saves, outside-click close, shelf-tool cards, cellar water (2026-09-15)

Branch `claude/loft-kitty-gun`, one commit on `origin/main@fe0cb3b` (#489). **Risk: Medium.** The gun is a second room-side door to the existing `allocateHouseholdFundSurplus`, and the shared `useDialog` now also closes on an outside tap.

What changed:
- The loft stands each bank's studio piece, in 3D and flat, sized by a log of its goal, and growing by the studio's ten steps.
- Rack and charm edits are held on the device and sent once: on Done, on leaving, or when the page hides or closes (`useHeldSave`).
- A tap off any pop-up closes it (`useOutsideClose`, wired into `useDialog` and the house, row, punch and ledger pop-ups). A Confirm closes as Cancel.
- The weight, the pin and the divider open explaining cards with sliders at the room's foot.
- The cellar's water is a visible, themed body.
- The money gun: the custodian picks a bill and taps banks; shots add up on the device, and **Send** posts one round behind Confirm through the rollover.
- The jug and the gun both read the command outcome before saying money moved.

Details: D-264 and the [worksession](worksessions/2026-09-15-loft-kitty-gun.md).

Verification:
- `tsc` is clean.
- The quick gate at Medium passed (23 files, 251 tests, 109 s).
- `app-startup-p1`: 82/82.
- Dialog-adjacent suites: 65/66. `ledger-story-ui` fails identically on `main`.
- New browser proof: 16 records, three worlds, 320 to 1100 px, 0 errors, axe clean.

Uncertainty:
- Going beyond the safe surplus was not built; that is Jonathan's money call.
- The loft's size now shows a goal's order of magnitude.
- The 3D path was checked in SwiftShader only, and each studio cat carries six canvases.

**Follow-up commit (D-265).**
- The cellar's water, tidemark and jars share one dollar scale, so a $1,000 jar is as tall as $1,000 of water. Jars have a 14px floor, and zoom runs to 800%.
- The loft zooms like the cellar.
- Quick gate (medium): passed, 253 tests.

Data: fictional only. Next owner: Codex trust review, then Jonathan's bot opens the PR.

## The loft's rack — shelves as weights, pins as marks, dividers as splits, and the jug that pours (2026-09-15)

Branch `claude/loft-rack`, one commit on `origin/main@0078ef8` (#488); deliverable `loft-rack.patch`. Jonathan: "more of a shelving system than just one shelf … the different shelves should act as weights … a cutoff point for funding on each shelf … split up automatically both horizontally or vertically … not with information and inputs, but through physical touch and interactivity"; to the choices offered, "3 but we can't make it rigid it needs to be adjustable". **Risk Medium-High** — a new strictly validated field (`rack`) on the synced `kittyNestDesigns` record, refused by older builds ("needs an updated Hearth"); and a room-side door to the existing money command `allocateHouseholdFundSurplus` behind the app's Confirm, custodian only. No new money writer; no money meaning, schema, Auth/RLS, sync transport, hosted state, financial hash or Hercules payload change; behind `VITE_QUEENS_NEST`. Budget (5): +1 — the month-end rollover previewed exactly before Confirm. Engagement (3): +3 — money lands where you hung the shelves.

What changed. **`src/core/queenRack.ts`** (new, pure): `QueenRackV1` — up to five shelves, each `{ id, share 1–10, cutoff 0–20 (twentieths), keys, splits? }`; `shapeQueenRack` strict; `rackFromOrder` / `rackSettled` / `rackOrder`; moves (`rackMoveKey`, `rackSetShare`, `rackSetCutoff`, `rackSlideDivider`, `rackHangShelf`, `rackTakeDown`); **`rackPour`** — by share across shelves, each capped at the room its banks have up to the mark, overflow flowing down, the last remainder staying in the Fund, dividers splitting within a shelf, exact integer cents; `pourWords` is Confirm's preview. **`kittyNestDesigns.ts`**: `rack?` allowed only on `plan:build` × `household`; saving with a rack derives the old `order`. **`QueenLoft.tsx`** rewritten around the rack: shelf rows with a post + pin (vertical slider), the ledge with seats and dividers (horizontal sliders), a brass weight on the end (horizontal slider), *Take it down*, *Hang a shelf below*; banks drag in two dimensions, Shift+Arrow moves along/up/down; the jug (safe surplus, a tilt in tenths with `aria-valuetext`, the holder's name for everyone else), the line reading the exact split while tilted, *Pour it* → `ConfirmSheet` → `onPour`; drop and slide values kept in refs so a pointer-up never reads a stale draw; only a bank, a pin, a weight or a divider carries `data-house-hold`. **`QueenHome.tsx`**: `rackSettled`, `keepRack`, `loftPour` (`projectHouseholdFund(...).safeRolloverCents`, custodian check, the command with note *Poured over the loft's rack*). **3D** (`queenRoomWorld.ts`, `QueenRoomWorld.tsx`): a plank, lip and two brackets per drawn shelf. **CSS**: the rack's brass outranks the themes' 44px button rule on purpose; cats give first as shelves are added and in short frames; at ≤359px a slimmer post and weight and a ledge that scrolls along itself; a short room hides the line's standing hint. **Proof fixture**: `loft=1` on the household-home proof.

Verification: `tsc` clean; `test/queen-rack.test.ts` 8/8; `test/queen-loft-rack-ui.test.ts` 5/5; the queen suites 86/86; `pnpm test -- --risk=medium-high --focus=test/queen-loft-rack-ui.test.ts` → `quick-gate-passed` (20 files, 107 s); `test/queen-loft-layout.mjs` (new) 18 records — every bank move, weight slide and pin drop from 320×700 up by a real pointer drag, the tilt, the exact split, Confirm opened and closed without posting, one pour posted with the jug lighter and the notice read, 0 page errors, 0 axe violations, no page scroll ([evidence](evidence/queen-loft/)); `test/queen-house-layout.mjs` on the actual App page regenerated, 38 records, the haul in and out of the loft still works ([evidence](evidence/queen-house/)). Not live verified.

Uncertainty: three or more shelves scroll inside the rack on short frames (the house never scrolls); 320×568 under the proof's stand-in chrome leaves the rack a strip, and the actual App there already stands the loft under a books banner; 3D boards verified in SwiftShader only; a rack written by this build is refused by an older build (the design rows' standing rule, first exercised by a room); the pour reads `safeRolloverCents` on `today`. Fictional fixtures only. Not pushed, not a PR, not merged, not deployed. Next owner: Jonathan to push and try hanging, dragging and tilting on his phone; Codex for an independent trust read of the pour path (`rackPour` → `allocateHouseholdFundSurplus`, exact cents, custodian, Confirm) and of the `rack` field's sync shape before this goes near Production. [Worksession](worksessions/2026-09-15-loft-rack.md).
## Our Path becomes a world that grows from the couple's months (2026-09-15)

Branch `claude/our-path-world` on `origin/main@e8e2f09`, delivered as a bundle and a patch. **Risk: High**, because the change adds a synced Shared collection (`pathWorld`). The household **Our Path** tab is now an explorable island grown from the household's shared months. Chapters, Moves, Rituals, Wins and shared Kitty Banks stand on it. Distance and a per-person lantern set how much the page shows, and a tent opens today's Our Path unchanged. Budget (5): +1. Engagement (3): +3. Details and evidence are in [the worksession](worksessions/2026-09-15-our-path-world.md) and `docs/evidence/our-path-world/`.

**Examined:**
- `App.tsx` (the Our Path branch)
- `chapters.ts` and its full sync, identity and replay wiring, used as the template
- `kittyBanks.ts`, `monthObligations.ts`, `visibility.ts`
- the queen worlds' lazy WebGL pattern
- the habitat fixtures

**Changes:**
- `src/core/pathWorld.ts`: the collection and its five commands.
- `src/core/pathSignals.ts`: the month scores.
- `src/path/*`: the grower, the three.js world and the page.
- Wiring in `types`, `sync`, `visibility`, `importParity`, `registry`, `commandIdentity`, `commandRuntime`, `materializeSnapshotFromEvents` and `continuityCommandLog`.
- `App.tsx` household branch.
- New tests and a focus-map entry.
- The fictional proof script.

**Verification:**
- `tsc` is clean.
- The quick gate at High passed (73.6 s of 300 s after the review fixes). An independent read-only review ran; its fixes are listed in the worksession.
- `app-startup-p1`, `month-rehearsal-mainline`, `five-boards-entry-app`, `plan-life-ui`, `vision-v2-chapters`, `materialize-snapshot-from-events`, `ledger-import-parity` and `continuity-command-interleaving`: 137 of 137 pass.
- The import-parity, materialize, continuity-interleaving, chapters, habitat and queens-nest suites are green.
- `copy-budget` and `sync-integrity` fail identically on the untouched baseline.
- Browser: 24 SwiftShader captures across Classic, Taylor and Newfoundland at 320 to 1440 px. All were live, with no overflow and no page errors.

**Uncertainty:**
- There is no capability guard for `pathWorld`, the same as for Chapters. An older client ignores the facts, and whether its later full-snapshot write can drop the rows needs Codex's call.
- No real-device battery measurement and no axe run.

**Environment:** fictional habitat books only; nothing hosted. **State:** not pushed, not a PR, not merged, not deployed, not live-verified.

**Next owner:** Codex, for the trust review and the guard decision. Then Jonathan merges.

## The Standing Book as a binder — dividers staggered down the fore-edge, page flags on the open section (2026-09-15)

Branch `claude/fund-book-account-stickies`, fourth commit on `main@97cd2e3` (#484). Jonathan, with two photographs: "i essentially want the widgets and tabs to work like binder in the second picture. and the sticky tabs in the first to be placed on top within the individual binder pages for example binder tab the accounts would have the stickies on top of the book linking to their own individual page." Two levels of navigation: the fore-edge becomes binder dividers — one per Fund widget on the member's rail, wide, labelled, staggered down the edge so every label reads at once — and each section's pages carry thin sticky flags along their top edge, one per item, only for the open section, each opening that item's own page inside the section. The old head strip of accounts (on the whole book, whatever divider was open) is gone; the mechanism is general. **Risk Medium** — presentation only, still behind `VITE_FUND_STANDING_BOOK`; `FundBoard`, `FundStage` and both hosts untouched; the divider tablist contract is byte-identical to `FundBoard`'s (asserted id for id, `aria-controls`, `aria-selected`, `aria-current`, `tabIndex`, on both presentations) and the Bianca pair was run anyway (below). Budget (5): +0 — no command, posting path, schema, synced row, `FundWidgetId`, `DeskPlateId`, `Household` field, route, worker or persisted value (which page is open is component state); every figure is the plate's own list (`TrackMark.cents`, the tally's count), `accountRows`', `accountRegister`'s or `categoryShape`'s, through `formatCad`; the category rule is the shape plate's own, lifted out as `categoryRowEdge` / `categoryRowAmount` / `categoryRowVerdict` / `categoryRowHasShape` / `categoryRowFigure` in `fundPlates.ts` and called by `shapePlate` itself, so there is one rule (`fund-plates.test.ts` 21/21, byte-identical output). Engagement (3): +2 — the Fund reads as one object with two levels: which section, then which page, and both levels are readable across the room.

What changed: `src/core/bookLeaf.ts` — `PAGED_SECTIONS` / `sectionIsPaged` (a section is paged by name — accounts, next-out, waiting, shape — never by the shape of its figure, so a tally that happens to count is not mistaken for pages), `figureFlags(figure)` (one flag per mark on a track, one per card in a countable pocket, none otherwise), `flagHue(index)` (position one to six in the theme's sequence, never a meaning), `OpenPage` / `openPage(remembered, section, count)` (a section opens on its first page; the remembered page counts only while the same section is open and is clamped onto the flags there are); the fence holds. `src/FundStandingBook.tsx` — `PageFlags` (its own `role="tablist" aria-label="Pages in {section}"`, one `<button role="tab">` per item with roving tabindex, `aria-controls` the room, which becomes `role="tabpanel"` labelled by the open flag; a sibling of the fore-edge, never nested; `data-account-id` kept on account flags; the flag's spoken name carries the plate's amount line, "The Fund's card" and "Needs a look"), `flagsFor(section, …)` (accounts from `accountRows` with `accountRowEdge`; shape from `categoryShape` with `categoryRowEdge`; next-out and waiting from the plate's own figure via `figureFlags`; nothing for an empty plate), `{ section, page }` state derived in the same render so a change of section lands on the first page at once and no flag from another section is ever selected, `TrackGate` taking a controlled cursor so the next-out flag and the gate are one cursor (the gate's arrows, Sooner/Later and the mark buttons move the flag; `week` keeps its own), `Pocket` drawing the open page's card out of the pocket, the item page on the walls, floor and plinth (a mark: label, its cents, "dated for day N", the gate strip beneath; a card: "Card n of N", the pocket; a category: label, month to date, the row's own verdict, its band in pencil on the right wall, the row's three-point strip on the floor or an honest "not enough history" note), a paged section with no items saying so on the wall and drawing no strip, `useShelf` (the edge-fade measure, now shared by both strips), and DOM order fore-edge → flags → page so the Tab order is the reading order on both compositions; `onSelect` fires only from a divider — a flag never asks the host to move. `src/fund-standing-book.css` — the divider (`.fund-book-mark`, same class and states): `--fund-book-slot` from the render, a per-slot cloth mixed from the theme's six-position sequence (`--fund-book-hue-1..6`: gold, chart-neutral, pine, accent, chart-plan, second — copper never among them), a paper label window with the name, the glance beneath, z-order front-first, a sheet-edge stripe (`.fund-book-mark-sheet`) running from the top of the column down to the tab so the sheets fan; on the desk a 184px column, 40px of fanned edges then one 52px tab per 60px stepping 3px further out, the dog-ear cut reaching 640px above the box so the sheet edge survives it; the flag (`.fund-book-sticky`, same class): a 44px button whose paper is only its lower 26px (the upper 18px is clear air), the rule along its top the item's state (gilt/theme edge; copper and a 9px cut for attention; the accent when open), the lower 7px translucent as the adhesive over the page; the open divider and the open flag restate their own paper because the world's `[role="tab"][aria-selected]` rule would paint them card; shut, the flags hide and the dividers stay; phone and every width under 720: the dividers one scrolling row of 116×50 index tabs with the reach lifting an attention tab, the flags one scrolling row, both with the shelf's mask fade and snap; item pages share the account spread's 22° tilt and .86 fit so a tall gate never projects past the plinth; three dressings — Classic cloth-and-gilt dividers (weave, gilt foot, gilt-framed label) with paper flags laid straight; Taylor card dividers (flat card, 12px radius, white sticker label) with washi flags (dashed tear, translucent, askew); Newfoundland oilcloth dividers (diagonal weave, pencil-ruled label, button at the spine) with pencil-marked flags in the hand — and forced colours. `src/core/fundPlates.ts` — the five `categoryRow*` exports. `test/verification-focus-map.json` — the entry's reason and `category-shape.test.ts`. Tests: `fund-standing-book.test.ts` +3 (paging by name and `figureFlags` off every primitive; `openPage` and `flagHue`; the category rule against the seeded shape plate) and the component fence rewritten for the binder (the flags' tablist, no deep link, one `onSelect`, the fore-edge contract strings, 44px on both buttons by rule, six distinct hues without copper); `fund-standing-book-dom.test.ts` — one divider per rail slot in rail order with its slot and hue; flags only for the open section and only where it has items across all ten sections on the seed plus a three-card, a forty-card and three one-reading plates by hand; two sibling tablists with one selected tab and one tab stop each; a flag opens the account's books view (cells equal to the Books page's register), a mark's page with the gate synced both ways, a category's page with its band and an honest empty for an unknown row; changing section resets to the first page and clears the old flag; each strip roves on its own; the old deep-link and `aria-pressed` cases retired.

Decisions the brief left open. **The accounts stickies now exist only where "The accounts" is on the rail** — on the seed that is Bianca's desk rail and not her phone rail, nor Jonathan's desk rail; that is the brief ("move it inside The accounts"), and the drawer puts the section on any rail the household wants. **A waiting card is numbered, not named** — the waiting plate carries a count, not the motions, and the brief forbids a new figure source, so its flags read "Card n of N" and the page says what the plate says; naming them wants the plate to carry the motions. **No `--kind-*` token is used** — none of the four lists carries a calendar kind (an account's `AccountKind` is not one, a `TrackMark` has no kind), so every flag and every divider takes its colour from position in the theme's own sequence, and a next-out mark carries no state at all rather than a borrowed one. **A flag is a tab, not a toggle** — pressing the open flag does nothing, as a divider does; the old "press again to let go" is gone with the chapter view it returned to. **The open page is not preserved across sections** — returning to a section opens its first page; remembering per section would be a small map and is easy to add if Jonathan wants it.

Verification: `pnpm exec tsc --noEmit` clean; `fund-standing-book`, `fund-standing-book-dom`, `fund-plates`, `fund-ledge`, `accounts-widget`, `category-shape` — 100/100; `pnpm test -- --risk=medium-high --focus=test/fund-standing-book-dom.test.ts --focus-reason="Direct proof for the binder dividers and page flags"` → **`quick-gate-passed`**, 9 files / 125 tests, 107.0 s of the 300 s budget, `timeBudgetBreached: false`, slowest phase TypeScript 64.5 s, the money canary pulling `command-contract`, `command-runtime` and `proof-matrix` green; `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` 83/83; `test/desk-plates.test.ts` keeps its two `main` reds. Browser stills (the untracked scratch harness over `seedDemoHousehold`, headless Chromium, reduced motion, not committed): 320/390 phone, 720/1100 desk, all three themes, level / accounts / next-out, page 4 and shut — `scrollWidth` overflow 0, zero page errors, every flag and divider ≥ 44px, the dividers stepping 3px out and 60px down on the desk, computed `mask-image` a real gradient on both phone strips at either end, Tab from the open divider landing on the open flag and from the flags into the page.

Fifth commit, on the coordinator's read of the first: **the fore-edge now copies the photograph's anatomy.** A divider is a sheet bound into the block with only its tab showing: the tab runs 12px in under the page block (`--fund-book-tuck`; the room paints above it, `z-index: 1`) so it is attached, never floating; every tab sits at the same x and differs only by its band down the edge (the 3px sideways stagger and the sheet-edge stripe are gone); flat cloth in the slot's hue with the section's name printed straight on it in the dressing's ink (paper on Classic's dark cloth and Newfoundland's oilcloth, ink on Taylor's pale card — the label chip is gone) and the glance beneath, smaller; the outer corners cut by a 5px mitre in the clip-path, `border-radius: 0`; the open divider drawn 4px further out with a ruled edge. The column now spans **every section `widgetAllowedFor` permits** — the rail's slots first in rail order (FundBoard's ids, `aria-controls`, `onSelect`, asserted id for id against the board), then the rest of the library (`data-divider="library"`, same id pattern, `aria-controls` the book's own room, opening on the book itself through `{ section, host }` state that counts only while the host's selection stands where it was) — so a phone member reaches the accounts section and an account's page (`binderDividers` in `bookLeaf.ts`; proven on the seed for Bianca's phone, `onSelect` never fired, the household untouched). The phone and every width under 720 put the dividers along the block's top edge, tucked under it the same way, and the flags along the top of the block itself (`data-fund-book-flags` reserves the room). Page memory is now deliberate: `openPage(remembered: OpenPages, section, count)` reopens a section on the page it was left on and a section never visited on its first, both clamped; the test asserts remembering across three sections. The hand font's slant no longer clips a short flag name (end padding), and Newfoundland's spine button sits in the tab's own margin on each composition. Gate re-run → `quick-gate-passed`, 107.4 s, `timeBudgetBreached: false`; six suites 102/102; D-183 pair 83/83.

Uncertainty and what is weakest: **the page block stretches to span every divider** — fifteen for the custodian, sixteen for a contributor, 44px each — so on the desk the block is ~735px tall and a short chapter leaves bare stage under the plinth (an attempt to let the floor's ruled paper fill it broke under the 42° tilt and was reverted). The tab is 150px wide, so a long glance still ellipsizes on the tab and lives whole only in its spoken name. Under 720 the dividers are a scrolling row of index tabs along the block's top, three visible at 390; that is a different composition from the photograph by design. Twelve account flags wrap to two rows on the desk and scroll on the phone; nobody has scrolled either on a real device; no axe run.

## The kitty jars: dressed for their purpose, sized by hand, fired as they fill, read on a card (2026-09-15)

Branch `claude/cellar-bank-props`, one commit on `origin/main@0ae4490` (#482); deliverable `cellar-bank-dress.patch`. Jonathan, twice the same day: "more unique shapes, hats, props, anything to make it extremely clear what purpose each bank serves … scale the kitty banks up a little … or users should be able to zoom in and out"; then "we are going to call these cellar banks kitty jars … it's kind of hard to tell how full a jar is in the 3d version … have the fire-in-the-kiln effect be the visual indicator … glazed from the ground up … clicking on a jar needs to display more info about it." **Risk Medium** — presentation behind `VITE_QUEENS_NEST`; one per-device preference in `localStorage`; two pure read-only helpers in `src/core/queenCellar.ts`; no money meaning, schema, Auth/RLS, sync, hosted state, financial hash or Hercules payload change. Budget (5): +0. Engagement (3): +3 — a purpose is a hat, how full is how fired, and a press tells the whole story.

What changed. **Dressing** — `src/queen/world/queenBankDress.ts` (new, pure data), one per `BankForm`, read by the sculpture and the flat twin: **bill** a postman's cap + an envelope; **recurring** a wind-up key in the flank; **subscription** a collar with a bell; **appointment** a calendar leaf; **planned** a folded paper hat over frosted glass; **goal** a pennant; **jar** bare; every hat behind the crown. **Kitty jars** — the cellar's words ("11 kitty jars on the rail", "Break the kitty jar", "Size of the kitty jars"); the loft keeps kitty banks. **The kiln** (`queenRoomWorld.ts`) — the inner level mesh is gone; the body's material is the studio's bisque above the fill line and its fired glaze below it (one 64×128 colour map and one 4×128 roughness/clearcoat map per fill band, eleven bands, shared per band; the line's finish over both); head, ears, paws and tail fire when full; paid jars fire to the crown and keep the shard crack; planned stay frosted; the flat twin draws bisque above, the tint below with a sheen, `data-fired` at the crown. **Size** — `src/queen/cellarZoom.ts`: 0.75–2.25, default 1.4, quarter steps; pinch on the rail, ctrl-scroll, `+`/`−` keys, the `− % +` pane in the scrub row; `--cellar-zoom` moves the cell, the bands, the seats and so the sculpture. **The card** — a press on a jar puts it in the gate and opens `.queen-jar-card` in the line's place: kicker (purpose + dressing), name, the one-line reading, `cellarJarFacts` (*Filed under · Its day · The jar holds · In the kiln · Still to go · Paid from · The water after · The strike*), *Its months* / *Open it in the banks*; acts once beneath; second press, × or Escape closes it with focus back on the jar (`aria-expanded`); in the 320×568 stand-in frame it stands over the rail. `cellarGlazeWords` says the kiln in marks, never figures.

Verification: `tsc` clean; `test/queen-bank-dress.test.ts` 6/6; `queen-cellar` 18/18 (+2), `queen-cellar-ui` 11/11 (+1), `queen-house`, `queens-nest-ui`, `queen-rooms` — 73/73; focused quick gate and both browser proofs — see the worksession; cellar proof 26 records (three `card-*` stills added), 0 errors, axe clean, no page scroll. Not live verified.

Uncertainty: 3D verified in SwiftShader stills; the fired/bisque line reads at the rail's scale, subtler on the smallest band; the cellar's low light keeps the postman's cap a dark band with a peak; at 1100×800 the room is 474px tall so the card scrolls inside itself; the loft's lidded things wear the bill's dressing and its goals now fire as they fill (the same rule, unasked but consistent). Fictional fixtures only. Not pushed, not a PR, not merged, not deployed. Next owner: Jonathan to push and try the pinch and the card on his phone; Codex for an independent read of `--cellar-zoom` under the short-frame container queries and of the kiln maps' memory (one texture pair per band, per tint and finish in use). [Worksession](worksessions/2026-09-15-cellar-bank-dress.md).

## The Standing Book's head — one sticky per shared account, the books view on the spread, the register raised as a pop-up (2026-09-15)

Branch `claude/fund-book-account-stickies`, base `main@0ae4490` (#482). Jonathan: "each account linked to the fund to show up as those little stickies tabs. clicking on this should show the books view with the option to expand into pop up books style graphs." Three states: a sticky per account on the head (the top edge — the chapter bookmarks stay on the fore-edge, two planes, no collision); picking one is a deep link into the `accounts` chapter whose spread becomes that account's books view; a control on the spread raises the register into the pop-up. **Risk Medium** — presentation only, additive, still behind `VITE_FUND_STANDING_BOOK`; `FundBoard`, `FundStage` and both hosts are untouched (the book keeps the identical props), so no host edit this time, though the Bianca pair was run anyway (below). Budget (5): +0 — no command, posting path, schema, synced row, `FundWidgetId`, `DeskPlateId`, `Household` field, route, worker or persisted value (the picked sticky is component state; the source fence still forbids `sessionStorage`/`localStorage` in the component); every figure is `accountRows`' (`balanceCents`, `balanceLabel`, `utilization`, `isFundCard`), `accountRegister`'s (`runningCents`, `recognized`) or the plate's own gauge from `creditCardView`'s utilization, formatted by `formatCad`; the sticky's state is the accounts plate's own edge test, now lifted out of `accountsPlate` as `accountRowEdge` / `accountRowAmount` / `accountRowVerdict` / `accountRowFigure` / `ACCOUNT_CARD_MARK` in `fundPlates.ts` and called by the plate itself, so there is one rule and one threshold. Engagement (3): +2 — the accounts stop being one glance behind a picker: every shared account is a tab the household can read across the room, the Fund's own card wears the gilt pin, a card past the mark or a book below zero dog-ears its sticky, and one press opens that account's lines and stands its balance up as paper.

What changed: `src/FundStandingBook.tsx` — `Stickies` (`role="group" aria-label="Accounts linked to the Fund"`, one `<button aria-pressed>` per `accountRows` row, never `role="tab"`, never `aria-selected`, never inside the tablist; label is the accessible name, the plate's amount line, "The Fund's card" and "Needs a look"), `LedgerLines` (a scroll region with a real `<table>`: date, memo, debit, credit, balance — the Books page's own columns), `RegisterPopup` (a `<button aria-expanded aria-controls>` that raises and lays; Escape on the control lays a raised pop-up and stops there so the ledge's Escape is not spent; a flat one lets Escape pass), and the account spread on the walls, floor and plinth (the running head keeps carrying the Level; the plinth carries the account's name, the Fund's-card mark and the plate's verdict). The books are compiled once per household from `booksPresentationFloor(household, memberId, "household")`, the same floor `Books.tsx` compiles for the household table, and each account is read twice from the journal as it offers itself: `accountRegister(books, id)` (the counted register the Books page prints — ink, left wall, running figure) and `accountRegister(books, id, { recognizedOnly: false })` filtered to `!recognized` (the rows the journal does not count — pencil, right wall, "excluded", no running figure). `src/core/bookLeaf.ts` gains `registerStrip(ink, pencilCount, limit = 24)`: the ink running line windowed to its newest points, then one flat pencil panel per uncounted row lying level with the last ink point, `actualCount` at the ink's end — so `concertinaPanels` folds the corner where the counted rows stop and nothing uncounted stands; the fence (no `formatCad`, `Household`, `fundWalk`, `balanceCents`, commands) holds. `src/core/fundPlates.ts` — the five exports above; `accountsPlate` now calls them and its output is byte-identical (`fund-plates.test.ts` 21/21). `src/fund-standing-book.css` — the head strip on the top edge (desk: a wrapping row over the room column, tucked 5px under the page top, stickies above the cover when shut so they read as tabs on a closed book; phone and every width under 720: one scrollable row, still 44px buttons; the cover is now confined to the room's grid area so the clasp stays visible shut), sticky states (copper top edge and a small dog-ear for attention; gilt pin for the Fund's card; lifted and ruled when pressed), the ledger as a pasted paper slip (its own paper so Newfoundland's grid does not run through the figures; tighter at <720 and the date allowed to break its year at <480 so the running figure never leaves a 320 page), the pop-up (`@keyframes fund-book-raise`, a rotateX from the floor, only under `prefers-reduced-motion: no-preference`; the existing reduce block and `data-motion="reduced"` rule zero it), an account spread on the desk tilting the floor to 22° with a smaller fit so the taller wall and stand neither project over the lines nor push the plinth out of the room, all three dressings (Classic gilt-edged cloth index tabs laid straight; Taylor washi tabs torn at the top and askew; Newfoundland masking-tape strips written in the hand with the Fund's card tied in string), and forced-colors. `test/verification-focus-map.json` adds `fundPlates.ts` and `accounts-widget.test.ts` to the Standing Book entry. Tests: 4 new in `test/fund-standing-book.test.ts` (the strip's fold and window, the row rule against the seeded plate, the component fence for the stickies) and 5 new in `test/fund-standing-book-dom.test.ts` (one sticky per shared account and none for a planted personal one, the Fund card marked, states matching the plate's test, the tablist untouched on both presentations and for a member with no Fund card; the deep link — `onSelect("accounts")`, focus, `aria-pressed`, the ink cells equal to the Books page's register row for row, the running head still the Level's, the plinth the account's, letting go and coming back; a planted duplicate lying in pencil on the right wall with "excluded" and never among the ink, one flat pencil panel and no standing one in the pop-up, the card's ruled band over the mark, a savings account with no band and an honest "nothing lies in pencil"; raise and lay through a real focused button, Escape kept to itself, landing raised under reduced motion on the phone; four Demo Bistro receivables reading "No postings yet" with no `$` on the sticky, the wall, the floor or the plinth).

Three decisions the brief did not settle. **`recognized` is "counted", not "already happened"** — in this journal it is `projectedCountable` (a duplicate, or the reversal of one), and the seed has no such row; so the corner falls where the counted rows stop and the pencil rows are the journal's uncounted lines, lying level with the last ink point because an uncounted row moves nothing, rather than a future the register does not carry. **The books are the presentation floor, not the raw household** — the Books household table compiles `booksPresentationFloor`, which drops personal-visibility rows; on the seed that is two Visa lines (one of them Jonathan's "Gym drop-in" on Bianca's screen), and a hidden screen is not a privacy boundary, so the book prints the same reading the Books page prints. **The ink is the recognized-only register, read twice** — `accountRegister`'s default running line is the number the Books page shows; `{ recognizedOnly: false }` would fold uncounted rows into the running figure and disagree with the page, so the pencil rows come from a second read and carry no running figure of their own.

Verification: `pnpm exec tsc --noEmit` clean; `pnpm exec vitest run` on `fund-standing-book`, `fund-standing-book-dom`, `fund-plates`, `fund-ledge`, `accounts-widget`, `desk-plates-dom` — 79/79; `pnpm test -- --risk=medium-high --focus=test/fund-standing-book-dom.test.ts --focus-reason="Direct proof for the account stickies and the books view"` → **`quick-gate-passed`**, 9 files / 117 tests, 105 s of the 300 s budget, `timeBudgetBreached: false`, slowest phase TypeScript 65.6 s; the money canary fired on `src/core/` and pulled `command-contract`, `command-runtime` and `proof-matrix`, all green; `uiProofRequired` printed. `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` run directly for D-183 — 83/83. `test/desk-plates.test.ts` keeps its two `main` reds (`stageFundPlate(plate)`, iPhone seals), nothing new. Browser stills (scratch harness over `seedDemoHousehold` plus one planted duplicate, headless Chromium, not committed): 320/390 phone and 720/1100 desk, all three themes, chapter, account, raised and shut — `scrollWidth` overflow 0, zero page errors, every sticky ≥ 44 px tall, 66 ink lines, 1 pencil line, 22 standing panels and 1 flat in every record.

Second commit, after the build was driven at 390 in the phone presentation: **the spread is the book's own state.** The first cut showed the account only while the host's `selected` was `accounts`, and `accounts` is not on the phone rail (nor on a contributor's desk rail), so the host guard snapped the selection back to `level` and a sticky press did nothing while `focusedAccountId` silently accumulated. Now `focusedRow` reads from `focusedAccountId` alone; `onSelect("accounts")` fires only when `accounts` is in the slots the book itself walks (the same `railFor`/`phoneRail` the host guards with), a bookmark press or the host moving the selection lets the account go, and what is pressed is always what is on the page. The fore-edge contract is unchanged (compared before and after every press). The phone head strip gets edge fades (`.fund-book-head-shelf[data-head-more]`, measured on scroll and resize) and snap alignment so a cut sticky reads as a deliberate edge with more behind it; the group's name carries the count. **The pop-up caption says what is folded on the page**: `popupCaption` names `actualCount` ("the last 23 of 66 lines the journal counts") and the pencil panels actually drawn, never the whole register; a test pins the caption to the rendered standing and flat panels for four accounts and by hand. Gate re-run → `quick-gate-passed`, 101.6 s, `timeBudgetBreached: false`, 9 files / 119 tests; D-183 pair 83/83; 390 stills in phone presentation show the press turning the spread with the tab still `level`.

Third commit, found on camera: **the head strip's fade painted nothing under Taylor or Newfoundland**, because `linear-gradient(…, var(--fund-book-stage), transparent)` put a token those dressings set to a gradient image into a colour stop, which invalidates the whole declaration. A sweep of the stylesheet found the same class at six sites — the fade, the sticky's attention dog-ear, and three from #482: the bookmark dog-ear, the cover's dog-ear (both drawn from `--fund-book-stage`, so a proud Taylor or Newfoundland book showed no folded corner at all) and the Classic spine (`--fund-book-cover` in a stop). Fixes, none theme-specific and none a literal colour: the fade is now a `mask-image` on the strip (alpha only, so it paints whatever the stage is and degrades to an un-faded strip, never to nothing); every dog-ear is a real cut — `clip-path` on the bookmark, the sticky and the proud cover, the polygon reaching past the box so the shadow and focus ring survive — with the flap painted from `--fund-book-paper-deep`/`-shade`/`-paper`, so the stage shows through whatever it is painted with; the spine mixes from a new `--fund-book-cover-tone` colour that `--fund-book-cover` defaults to. Proof is a **source-level fence** (jsdom cannot compute pseudo-element or mask styles): `test/fund-standing-book.test.ts` reads the stylesheet, derives the image-capable tokens from it (any `--fund-book-*` some rule sets to a gradient — currently stage, cover, edge, mark-bg, rulings), walks every `linear-/radial-/repeating-gradient`, `color-mix`, `rgb`/`hsl`/`oklch` call with balanced brackets and fails on any of those tokens inside one; a second case names the mask rules for start/end/both, the three cuts, the two flaps and the cover tone. Camera evidence: computed `mask-image` is a real gradient under all three themes at 390 with the strip at either end, computed `clip-path` is a polygon on the bookmark and the shut proud cover, and the Newfoundland bookmark and Taylor cover now show the folded corner they were missing. Gate re-run → `quick-gate-passed`, 105.9 s, `timeBudgetBreached: false`, 9 files / 121 tests.

Uncertainty and what is weakest: **the sticky and the last ledger line can disagree by the personal rows.** The sticky prints the accounts plate's figure (`accountRows` → `creditCardView.owedCents` / `accountBookBalance` on the raw household, personal-visibility rows included: Visa $4,716.80 owed) while the ink's last running figure is the Books table's reading (personal rows dropped: $4,646.30). That divergence predates this branch — it lives between `accountsWidget.ts` and `booksPresentationFloor` — and the book inherits it rather than hiding either number or leaking a memo; Jonathan should decide which figure the Fund surface owns. Also: with twelve shared accounts the desk head wraps to three rows of stickies; the ledger scroll region sits on a wall rotated 26° and nobody has scrolled it on a real device; the pop-up's rise is SwiftShader-proven only; no axe run. Data/environment: fictional `seedDemoHousehold` only; no hosted, schema, Production or real-household writes. Local branch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to set the flag in a Development build and press a sticky on his phone; Codex for an independent read of the floor-versus-plate figure and of `registerStrip` against the "nothing unrecognized stands" rule.

## A habitat seats you in one of its own two people (2026-09-15)

Branch `claude/habitat-member-mapping`, one commit on `origin/main@0ae4490` (#482); deliverable `habitat-member-mapping.patch`. Jonathan pressed **Habitat · doing well** on the live Development site: the page paused while the year generated, came back on his own household with the banner *"Household member is no longer active — please choose again."* **Risk Medium** — App-side only (which member id the Demo Suite creation uses); no money meaning, schema, Auth/RLS, sync or Hercules payload change. Budget (5): +0 — nothing posts; the generated books are unchanged. Engagement (3): +2 — the habitats and the investor showcase open from any household, not only one whose members happen to be `MEM-001`/`MEM-002`.

Cause: every generated showcase has the stress seed's two members, `MEM-001` Bianca and `MEM-002` Jonathan, and `createOrReplayDemoSuite` linked the Google identity, created the ledger and remembered the session with the **pressing household's** member id. In a household with its own ids (any invited or hand-made one — his current one names him "Invited person"), that id is not a member of the showcase, so `linkGoogleIdentity` → `requireMember` refused with exactly that message and nothing was created. The investor Demo Suite had the same fault; it only ever worked from a household whose ids matched the fixture's.

Fix: `demoSuiteSeatFor(current, memberId, generated)` in `src/demoSuiteIdentity.ts` picks the seat — the generated member whose name matches the pressing person's (case-insensitive), else `MEM-002`, and the seat already held when replacing an existing fixture — and `createOrReplayDemoSuite` uses it for the Google link, `persist` (so Ledger Sync V2's `createLedger` receives a member the SQL guard accepts) and `rememberSession`. The fixture's ids are untouched, so the seed replays byte-for-byte and `verifyDemoSuite` is unaffected. Bianca pressing it lands in Bianca's seat; anyone else lands in Jonathan's.

Verification: `tsc --noEmit` clean; new `test/demo-suite-seat.test.ts` 3/3 (name match with foreign ids, the invited-person fallback, the replacement seat and never-outside-the-household); `test/demo-suite-ui.test.ts` source-string expectation updated for `rememberSession({ memberId: demoMemberId, … })`, 5/7 with the two pre-existing reds untouched; focused quick gate — see the worksession line in the commit. Not tried on the live site from here (no browser to his Development ledger); the exact banner text and the `requireMember` path are what the code says.

Uncertainty: the local, no-transport path (`acceptHouseholdWrite` with `actingMemberId`) requires the acting member in **both** the previous and the candidate household, so an offline Development build without Ledger Sync V2 would still refuse a showcase from a household with foreign ids — that rule is trust code and was left alone; the live site uses Ledger Sync V2. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to push, then press a habitat from his real household and from the "Hercules Habitat" one; Codex to confirm the seat rule against the D-147 continuity identity check.

## The Standing Book — the Fund board as a book, behind a default-off flag (2026-09-15)

Branch `claude/fund-standing-book`, base `origin/main@fb6a478` (#480). Brief: the approved *Standing Book* prototype — shut, the fore-edge reports the household's state; open, a V-fold room where the gutter is a corner and the corner is today, what happened standing in ink on the left wall and what is coming lying in pencil on the right, a running head across both wall tops, a plinth at the floor's near edge, and bookmarks as the chapters. **Risk Medium** — presentation only, additive, and gated: nothing renders differently unless `VITE_FUND_STANDING_BOOK=1`, and with it on the book replaces only `FundBoard` inside `FundLedge` and `OfficeWide` with the identical props; `FundStage` is untouched. It does edit two Fund hosts, which D-183 names, so the Bianca pair was run directly (below). Budget (5): +0 — no command, posting path, schema, synced row, `FundWidgetId`, `DeskPlateId`, `Household` field, Auth/RLS, sync, hash or Hercules payload; every number on the book is a plate's own `glance`, `verdict`, `footing`, `edge` or figure from `fundPlates`, formatted by `formatCad`, and the new core file `bookLeaf.ts` is page geometry composed over `plates.ts` with no household, no cents arithmetic and a source-text fence proving it. Engagement (3): +2 — the Fund becomes an object the household can read from across the room: an all-clear book sits flush with no folded corner, one bookmark standing proud and dog-eared is the whole evening's news, and the six primitives become paper mechanisms (concertina, gate strip, wells, pocket, ribbons, ruled band) instead of six small charts.

What changed: new `src/FundStandingBook.tsx` (same props as `FundBoard`; the fore-edge is the `role="tablist"` with the same roving-tabindex arrows/Home/End, `aria-controls`, ids and `onSelect`; the room sits beside the tablist so no button nests in a tab; `BookFigureView` is an exhaustive switch over the six primitives with a `never` default; the track is the cellar's fixed-gate idiom — a focusable group, arrow keys/Home/End, a button per mark with `aria-current`, Sooner/Later buttons, and an `aria-live` line for whatever stands in the gate), new `src/fund-standing-book.css` (Classic Hearth cloth-and-gilt, Taylor's Scrapbook washi-and-rings, Newfoundland oilcloth-string-and-pencil; identical semantic positions; `--fund-book-*` locals mixed from `--paper`/`--ink`/`--line`/`--copper`/`--gold`/`--theme-*`; paired reduced-motion blocks plus the `data-motion="reduced"` attribute; two compositions — the full room at ≥720 and one wall plus the floor with real buttons to cross the corner below it), new `src/core/bookLeaf.ts` (bookmark stance from `edge`, flush fore-edge, head state words, concertina panels that stand only left of `actualCount` and invent no corner when a figure carries none, gate index and shift, well columns and water, pocket cards, ribbon heights, floor rulings), `fundStandingBookEnabled()` in `planFeature.ts` (opt-in, gated on Household Home V2), `.env.example` and `vite-env.d.ts`, the two host swaps, the focus-map mapping, and 23 new tests in `test/fund-standing-book.test.ts` and `test/fund-standing-book-dom.test.ts` (the tablist contract compared id for id against a live `FundBoard` on both presentations, keyboard roving, the running head and plinth printing the seeded Level plate's real lines, attention proud and dog-eared versus all-clear flush, nothing projected standing, the gate, reduced motion, the phone crossing, every rail slot's mechanism, and the flag off leaving the old board in the ledge).

Three decisions the brief did not settle. **The bookmarks are the member's rail, not the ten plates** — `FundBoard` walks `railFor`/`phoneRail` and looks plates up by id, so the book does the same; a slot without a plate (`swipe`) is a bookmark with a name and no glance, as on the board. **The book opens itself once on mount** (next frame; immediately and without travel under reduced motion) and a small clasp button shuts and opens it, because a book that stayed shut inside the ledge's full detent would hide every mechanism behind a tap the board never asked for. **The gauge keeps width for its share**, as `gaugeFillWidth` and the desk plate already do; the prototype's height-only rule is enforced on the concertina, the ribbons and the wells, and the band is drawn ruled with its threshold printed rather than reworked into a new geometry.

Verification: `pnpm exec tsc --noEmit` clean; `pnpm exec vitest run` on the seven neighbouring files — 81/83, the two reds being `test/desk-plates.test.ts` source-text assertions (`stageFundPlate(plate)`, `tapSeal("blotter")`) that fail identically on clean `main`; `pnpm test -- --risk=medium-high --focus=test/fund-standing-book-dom.test.ts --focus-reason="Direct proof for the new Fund presentation"` → **`quick-gate-passed`**, 14 files (13 fast / 173 tests, 1 serial / 7), 98.4 s of the 300 s budget, `timeBudgetBreached: false`, slowest phase TypeScript at 57.8 s; the money canary fired on the `src/core/` change and pulled `command-contract`, `command-runtime` and `proof-matrix`, all green; `uiProofRequired` printed. `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` run directly for D-183 — 83/83 green. Browser stills (scratch harness over `seedDemoHousehold`, not committed): 320/390/720/1100, all three themes, open and shut, `scrollWidth` overflow 0 and zero page errors in every record; the shut all-clear book is flush and the attention book dog-eared.

Uncertainty and what is weakest: **the room is CSS `preserve-3d` seen only in headless Chromium** — walls at ±26°, a 42° floor, the fold scaled to fit and clipped; no phone, no Safari, no device has shown it, and the text on the rotated walls is legible at 1100 but nobody has judged it on a real tilt. The world stylesheet styles every `[role="tab"]` at `(0,3,0)`, so the bookmark rules carry a `:root[data-theme] .fund-book …` scope to win; a future world rule at higher specificity would restyle them silently. The seeded Level walk has only two actual rows on 2026-09-12, so the concertina's standing part is one small fold in every still. No axe run in this pass. Data/environment: fictional `seedDemoHousehold` only; no hosted, schema, Production or real-household writes. Local branch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to set the flag in a Development build and look at it on his phone; Codex for an independent read of `FundStandingBook.tsx` against `FundBoard.tsx`'s contract.
## The investor Demo Suite carries the month's Plan — the Hercules calculation matrix passes (2026-09-15)

Branch `claude/hercules-habitats`, one follow-up commit; deliverable `hercules-habitats-plan.patch` (applies on the pushed habitats head). Jonathan: CI job 104213368729 on the habitats branch failed in `test/demo-suite.test.ts` — the `tool-run` check reported every `plan_*` read unexercised ("Open a visible Plan version or your private draft for this month first."); "look into `verifyDemoSuite` and `generateDemoSuite` … ensure all plan calculation tools are being properly exercised with valid plan versions and data." **Risk Medium** — Development-only synthetic generator and its verifier; no money meaning, schema, Auth/RLS, sync or Hercules payload change. Budget (5): +0 — the Plan is proposed through `savePlanDraft` / `createPlanScenario` / `proposeHouseholdPlan` / `acknowledgeHouseholdPlan`, posts nothing and stays `proposed` (one of two acknowledgements). Engagement (3): +1 — Hercules Pro's Plan reads answer in the showcase instead of asking for a Plan.

What changed (`src/core/demoSuite.ts` only): `shapeDemoPlan` in the investor branch builds Jonathan's private Household draft `PLAN-DRAFT-DEMO` for the current month — one `protect` obligation per shared expense recurrence (rent, hydro, phone; due dates clamped into the month), a `build` contribution to the shared Emergency buffer (seed-varied), a `prepare` Household Fund line at the month's Fund target, an `everyday` Groceries pool (seed-varied) — plus one private alternative ("a slower buffer", half the contribution), proposes it to Shared and records his own acknowledgement. Nothing consults the real clock (both-partner acknowledgement would set active/scheduled by `todayKey()`), so the seed replays byte-for-byte. In `verifyDemoSuite`, `plan_scenario_compare` alone runs with the member's private preparation selected (`privatePlanPreparation`, draft and scenario ids), exactly as the Plan page selects it; every other Plan read calculates against the visible Household version. The habitats are untouched (their `tool-run` is skipped by design).

Why it was red: Plan System V2 (#433) added twelve `plan_*` reads to `HERCULES_READ_TOOL_NAMES` and to `DEMO_TOOL_COVERAGE`, but no generator ever created a Plan, so the matrix has failed on `main` since; the habitats commit touched `demoSuite.ts`, which made the quick gate select the file.

Verification: `tsc --noEmit` clean; `vitest run test/demo-suite.test.ts` → **9/9** (was 7/9 on `main`): `covers every domain engine and every Hercules Pro calculation surface` passes on the Plan; `accepts dedicated creation…` was rewritten to the boundaries already in code — the legacy continuity transport (`transportRequested: true`) refuses a showcase that completes onboarding v2 (`assertLegacyOnboardingCompatible`, onboarding v2 2026-09-08: "incompatible legacy transport must refuse these writes before staging"), so the case asserts that refusal and then creates, replays, edits, replaces by fresh seed and migrates a legacy suite on the local commit path (`accepted-local`); an ordinary same-id household is never replaced in place (`commandRuntime.ts`: only an existing fixture receives the exemption; the App's `assertDemoReplacementAllowed` says the same), so that step now asserts refusal with nothing posted. `test/habitat.test.ts` 6/6; `pnpm check` as CI runs it → see the worksession addendum. Pre-existing and untouched: `demo-suite-ui.test.ts` 2/8, `goal-fill-ui.test.ts` 6/7.

Uncertainty: the test rewrite encodes two boundaries that were already in product code, but it is a trust-boundary test and no product code moved for it — Codex should confirm the reading (in particular that a Development build with `VITE_LEDGER_SYNC_V2=0`, which still uses the legacy transport under Google continuity, is meant to refuse first-time Demo Suite creation with that message). Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to push the follow-up; Codex for the trust read of the test and an independent read of the Plan lines' sources.

## The Hercules habitats — two fictional years to walk around in (2026-09-14)

Branch `claude/hercules-habitats`, one commit on `origin/main` after #479 (independent of `cellar-frost.patch`); deliverable `hercules-habitats.patch`. Jonathan: "create a hercules habitat doing well and a hercules habitat doing bad household for bianca and i can use to interact with past and present data without having to create a bunch of stuff." **Risk Medium-High** — two new values on the Demo Suite's synthetic provenance `profile` (a Development-only field in the shared envelope, same JSON shape) and one id allocator moved to the runtime-aware helper. Budget (5): +0 — every write is a named command; balanced, health-clean, Development-only, fictional. Engagement (3): +3.

What changed: new `src/core/habitat.ts` lays a story over the Demo Suite's twelve months through the ordinary commands — **doing well**: both contribute every month, the Fund reconciled and tied, every bill handed to the Fund and paid on its day for six months, the Charter signed, one Chapter established and one open with its ritual kept and a Move accepted, a goal bought and a win, three months closed; **doing badly**: thin contributions that stopped, an emergency vet out of the Fund, hydro and the gym overdue, three crept-in subscriptions on the card, a double charge reversed, a Chapter still-forming and a Move declined, nothing closed for two months. `generateDemoSuite` gains profiles `habitat-well` / `habitat-hard` (the story instead of the investor rig); `verifyDemoSuite` skips the investor-only checks for a habitat instead of failing them; the Demo Suite panel gains two buttons through the same guard, Confirm and persist path; the App-page proof gains `?habitat=`. `addPotentialExpense` now allocates its id through `nextId` so a showcase that plans an expense replays exactly.

Verification: `tsc`; `pnpm test -- --risk=medium-high --focus=test/habitat.test.ts` → `quick-gate-passed` (24 files / 353 tests incl. the full-App Bianca regression, 199 s); `test/habitat.test.ts` 6/6 — the Queen reads `building` / `needs-us`, the cellar's water stays above the mark / runs under and dry, shards / cracks, replay hash identical, `verifyDemoSuite` with no failing check; `test/habitat-layout.mjs` on the actual App page — 12 records at 390/1100, every floor of both habitats, no scroll, 0 errors ([evidence](evidence/hercules-habitats/)). Pre-existing red on `main`, untouched: `demo-suite.test.ts` 2/9, `demo-suite-ui.test.ts` 2/8, `goal-fill-ui.test.ts` 6/7.

Uncertainty: ~15 s to generate in Node, longer on a phone; the habitat doing badly reads `needs-us` rather than `reset` because the stress seed's plan lines carry no drift; the rail's size bands sit mostly in the smallest band beside a $2,375 rent. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan and Bianca to press both in Development; Codex for an independent read of the provenance profile and the id allocator. [Worksession](worksessions/2026-09-14-hercules-habitats.md) · [Evidence](evidence/hercules-habitats/).

## Each model in the cellar, unique and understandable — body, tint, finish, size (2026-09-14)

Same branch `claude/queen-house-merged`, one more commit; deliverable `queen-house-merged.patch` (re-squashed). Jonathan: "one different shaped model for each purpose … break those down into different colours and textures … differentiate by size depending on how large the due is." **Risk Medium** — presentation only. Budget (5): +0 — every axis is a band read from the recurrence's `kind`, its subcategory's group and place, and the target against the month's largest; nothing stored, nothing posted. Engagement (3): +2 — the rail reads at a glance without a single figure on it.

Seen on the deployed page, a month of planned expenses came up as grey wireframe ghosts; a planned expense is now **frosted glass** in its tint (`RoomVessel.frosted`; the flat twin a third-strength tint with a dashed edge), its own round tailless body, and the wireframe is kept for the paid shard. What changed: `BankForm` gains `recurring` (tall), `subscription` (round, wrapped tail), `appointment` (loaf), `planned` (round, frosted) (one body per purpose, in `queenBankSculpture.ts` and traced by `QueenBankFlat`); `RoomVessel` gains `form`, `tint`, `finish`; the room world builds tinted, finished clays (four canvas textures × any hue); `src/core/queenCellar.ts` gains `cellarHue`, `cellarFinish`, `cellarSize` and files each jar under its group › line; the rail draws five size bands (28–64px) and the sculpture follows the seat; the accessible name and the gate line say purpose, filing and size band in words, and the empty gate is the key. Proof seeds a gym subscription (Health), a transit pass (Transport), a phone bill (Life), a card payment (Debt) beside the rest.

Verification: `tsc`; `pnpm check` → `quick-gate-passed` (17 files / 221 tests, 99 s); `queen-cellar-layout.mjs` — 23 records, nine jars at every width with purpose and filing named, 0 axe hits, 0 errors; evidence regenerated. Uncertainty: the finish textures are SwiftShader-proven, not phone-proven; the fixture's rent is filed under Housing › Electric so rent and hydro share a finish in the stills; six group hues are a fixed palette matched by name — a household with its own group names falls back to the bare clay until a name matches. Not pushed, not a PR, not merged, not deployed, not live verified. [Worksession](worksessions/2026-09-14-queen-house-merge.md) · [Evidence](evidence/queen-cellar/).

## The house, merged — kitty banks in the rooms, the bill rail in the cellar, one axis, and glass (2026-09-14)

Branch `claude/queen-house-merged`, three commits on `origin/main@b462df0` (#477): Opus's `queen-house.patch`, the cellar bill-rail patch, and the merge with a glass pass; deliverable `queen-house-merged.patch`. Jonathan: "merge these patches with your patches … mix and match to make a beautiful intuitive and complete product. my one note is ux should be more glassy and fit into the world better. no more large white in your face background … key things are navigation, loft, kitty banks models, navigation ux (with our glass like twist)." **Risk Medium-High** — navigation under every control on Home plus a door onto a money command, both already in the incoming patches; nothing new about money here. Budget (5): +0. Engagement (3): +3.

What the merge did: two conflicts in the cellar, both kept (the ribbon lets go of a vertical drag *and* only captures after 6px, so a tap reaches a jar); the bill rail now stands **Opus's kitty bank** (`QueenBankFlat` form "bill", the same cat the room sculpts) in place of my drawn jars, glaze as the saved amount, crack and break drawn over it, `kind: "bill"` and `lifted` in 3D; new `src/queen/queen-glass.css` puts every chip on **glass** — 30% paper, 18px blur, a white hairline, a soft lift — and turns the panes **smoked with paper text in the live cellar** so they read on stone; the **house rail** became one slim pane of three marks at the left edge with glass flyout names on hover/focus at ≥720 (its wide form stood on top of the Protect bank at 720); a room's column is `minmax(0, 1fr)` so a long pill cannot push the room off the right edge at 390; phone rooms compact; her top re-measures when a banner grows inside the shell.

Verification: `tsc` clean; `pnpm check` → `quick-gate-passed` (17 files / 216 tests, 97.5 s); `vite build`; `queen-house-layout.mjs` on the actual App page — **38 records, 320/390/720/1100 × 3D / no-WebGL / reduced motion, no scroll, no figure, no pot, keyboard and haul reach every floor, axe clean on both rooms at 1100**; `queen-cellar-layout.mjs` — **23 records, 0 axe hits, 0 errors**. Both evidence folders regenerated. `goal-fill-ui.test.ts` 6/7 red as on `main`.

Uncertainty: no phone — blur over a live canvas is a GPU cost nobody has measured (`prefers-reduced-transparency` is honoured); the sandbox's "Books need attention" band tops every App-page screenshot and predates all of this; axe cannot read contrast through a canvas, so the live cellar's glass is verified by eye. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to push and to try it on his phone; Codex for the independent read of the hammer's path and of `useHouseAxis`. [Worksession](worksessions/2026-09-14-queen-house-merge.md) · [Evidence](evidence/queen-house/) · [Cellar evidence](evidence/queen-cellar/).

## The kitty banks come into the rooms, and the house gets one axis (2026-09-14)

Branch `claude/queen-house`, base `claude/queen-rooms` (itself `origin/main@1395b04` + the rooms patch); deliverable `queen-house.patch`. Jonathan's words: "port over the kitty bank models in the to replace the ceramic pots we have as placeholders. also i want / also incorporate the navigation and ux changes from this artifact. mobile should have swipe up and swipe down functionality. desktop should also have a 'grab and drag' to navigate to the loft and the cellar. the arrow keys should also work as well for both vertical and horizontal navigation", with the *Cellar and Loft* artifact as the brief. **His second sentence is cut off** — "also i want" names nothing, so three things were built and the fourth is still his to finish. **Risk Medium-High** — navigation across the whole shared home, and a gesture that now sits under every control on it. Budget (5): +0 — no command, posting path, money schema, synced-row shape, Auth/RLS, sync, financial hash or Hercules payload changed; `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `allocateNestTotal` and `test/kitty-nest.test.ts` untouched; the banks read only the bands `queenPresentation` already quantised, and the house axis reads and writes nothing at all. Engagement (3): +3 — the banks in the rooms are the couple's own cats, and the three floors are one line you can feel your way along.

The banks. New `src/queen/world/queenBankSculpture.ts` builds a bank from the Kitty Bank Studio's own silhouette — `kittyBodyPoints` for the thrown body, `KITTY_HEAD_SCALE`/`KITTY_HEAD_R` for the head, and the brass slot the studio fires on the crown — and the form a bank takes is **the tier it already had in the nest** (`nestDefaultPiece`): a bill is the bean-bodied round-eared cat with no tail, a goal is Build's pear-bodied cat with its tail wrapped round its foot, a month on the rail is the same bill cat every month. It is deliberately *not* the studio sculpture, which carries six paintable canvases, a raycast surface, a hinge and a compartment because a person is painting it; a bank on a ledge is looked at, so geometry is shared per form and the materials are plain — a room of a dozen banks is a dozen draws, not a dozen canvas textures. New `src/queen/QueenBankFlat.tsx` traces the *same points* into a path, so forced colours, a refused context and a lost one keep the cat rather than falling back to a pot — the pattern `QueenSceneryFlat` already set for the worlds. Both keep the two opposite rules physical: an open slot accepts, a lid refuses.

The house. New `src/queen/queenHouse.ts` (pure — no React, no DOM, no money) is the whole model: three floors stacked loft · hearth · cellar, `houseStep` clamped at both ends, `houseSwipe` reading a finished drag by dominance, distance or flick, and `houseOwnsEvent` deciding when something nearer the pointer has first claim. New `src/queen/useHouseAxis.ts` listens for a finger swipe, a mouse grab-and-haul and ArrowUp/ArrowDown, all meaning the same thing; while a haul is live the house follows the hand, and a stair that leads nowhere resists, so the loft's ceiling and the cellar's floor are things you can feel. New `src/queen/QueenHouseRail.tsx` is the artifact's minimap — three real buttons, `aria-current` on the one you are standing on — because the gesture must never be the only way in. Horizontal stays the room's: the ribbon runs through time, the ledge through order, and Home now runs ArrowLeft/ArrowRight across her three banks.

Four decisions worth the reader's time. **Up goes up, everywhere** — no gesture means "move the camera the other way"; a person who has to work out which thing moved has already lost the spatial memory the direction was for. **The axes separate the gestures, so almost nothing has to claim anything**: the ribbon and the ledge now both refuse a drag that leans vertical and the house refuses one that leans horizontal, which is what lets up and down stay the house's even over a ledge that fills a phone; `data-house-hold` is left for the two real exceptions. **She keeps her pull down and lets the climb up through** (`data-house-hold="down"`) — pulling her down is her documented gesture and it is in her `aria-label`, while pushing up past her is the most natural phone gesture there is and would otherwise have been dead; the trade is that reaching the cellar by swipe from the phone means starting off her, which the rail, a door and ArrowDown all still do in one action. **The seat is the drawing, not the drawing and its name** — the loft's `data-room-vessel` moved onto a span around the flat cat, because on the button it seated the sculpture a label's height too low; the pots hid that, the cats did not. And a fifth, smaller: both shelves now **end behind the banks**, because a slab running toward the lens is seen from slightly above and draws its top surface over the feet of whatever stands on it.

Verification: `tsc` clean; nine new tests in `test/queen-house.test.ts` — the pure axis, the bank metrics, and the house driven in the App (the rail, the arrow keys, a haul, and the controls that already answered an arrow being left alone) — with `queen-rooms` (6), `queens-nest-ui` (23), `queens-nest` (21), `queen-world` (17), `queen-scenery` (8), `queen-charms` (14) and `queen-ceremony` (18) green. New **committed** browser proof `test/queen-house-layout.mjs` (the rooms proof was never checked in) drives the actual App page at 320/390/720/1100 on the 3D path, with `getContext` returning null and under reduced motion, for every floor: `overflowX`/`overflowY` 0, no figure on the ribbon or the ledge, no pot left anywhere, and both the keyboard and the haul reaching the loft and coming back, with axe (wcag2a/aa, wcag21a/aa) on both rooms at 1100. `scripts/serve-queen-world-page-proof.mjs` gained an opt-in `?rooms=1`, because the proof household had no Build banks at all (its goal names fell to *everyday*) and no posted months, so the loft was bare and the ribbon empty.

Uncertainty and what is weakest: **no phone** — swipe is proven with synthetic pointer events and a mouse haul, never with a thumb, and a gesture is exactly the thing a container cannot judge. The proof page shows **"Books need attention"** in this sandbox (local PGlite does not finish opening here); it predates this change, but it eats the top of every screenshot, so read them with that band ignored. Hercules' speech bubble overlaps the rail and the room head at some widths — App chrome, positioned by the App. This sits on top of the **unmerged** `claude/queen-rooms`, which still owes the independent trust review its synced-row field needs; nothing here adds to that risk, but it does not remove it either. Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan — finish "also i want", and judge the swipe on a real phone. [Worksession](worksessions/2026-09-14-queen-house.md) · [Evidence](evidence/queen-house/).

## The cellar and the loft become 3D rooms, and the ledge gets an order (2026-09-14)

Branch `claude/queen-rooms`, base `origin/main@4155bcf` (#475); deliverable `queen-rooms.patch`. Jonathan's words: "now we need to give the cellar and the loft the same 3d treatment", with two prototypes as the brief — *The Queen's Ribbon* for the cellar and *The Hearth Shelf* for the loft. Asked, he chose to **include reordering in this pass**, and on shared authorship: **"right now just make it so last edit wins. no proposing or confirming."** That second answer closes a question open for five rounds and removes the shelf prototype's entire propose/agree/ledger apparatus, which is therefore not built. **Risk High** — a field is added to a synced household row. Budget (5): +0 — no command posts money, no posting path, transfer meaning, split, statement or financial hash changed; `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `allocateNestTotal` and `test/kitty-nest.test.ts` untouched; the new field is optional, fail-closed in the shaper, allowed only on a plan bank's row, and written only through `saveKittyNestDesign` and its existing revision check. Engagement (3): +3 — both rooms become places, and the ledge becomes something the two of them arrange.

What changed: new `src/queen/world/queenRoomWorld.ts` (the Home world's pattern applied to a room — one renderer, one scene, one still camera, sculptures placed where the DOM keeps their controls; a stone cellar with a barrel vault, a bulb over the gate and a shelf of bottles, and a loft with a dormer, rafters, a light beam and a wooden ledge; dust is the only ambient motion and reduced motion never starts it) and `src/queen/QueenRoomWorld.tsx`. `QueenCellar.tsx` is rebuilt around a **fixed gate**: the ribbon drags, scrubs and arrow-keys past it, sprocket holes and month labels ride with it, and the month that broke the beat swells, tilts and steps out of the rail leaving a dotted hole behind. `QueenLoft.tsx` is rebuilt around **arrangement as data**: left is fed first, a drag or Shift-with-an-arrow saves the order, and picking a bank up puts it *in hand* — the only place a figure appears. `queenPresentation.ts` gains `swell`/`fill` on a jar and `fullness`/`size`/`parts`/`designKey`/`place` on a shelf item, every one of them clamped **and quantised to a twentieth** so a shape cannot be read back as a dollar figure, plus `queenShelfOrder` / `queenShelfReorder`. `kittyNestDesigns.ts` gains `order?: string[]`.

Three decisions worth the reader's time. **The order lives on one row, not on each bank**: a goal bank has no design row of its own (`goal:<id>` is not an allowed `bankKey`, and goals keep their look on the goal envelope), so per-bank ranks would have needed that allowlist widened — and a goal that suddenly had a design row would start taking its *name* and *category* from it, which is a bug waiting. One list on `plan:build` avoids all of that and makes one rearrangement one save. **Pick-up is a click, not a pointerup**: the first cut handled it on pointerup, which meant Enter and Space did nothing and a keyboard user could not pick a bank up at all; pointer events now carry the drag only. **Nesting is deliberately not built** — dropping a goal inside a goal changes what a goal contains, which is money structure rather than arrangement.

Verification: `tsc` clean; `pnpm test -- --risk=high --focus=test/queen-rooms.test.ts` → `quick-gate-passed` (14 files, 186 tests — 13 fast files / 179 and 1 serial / 7 — 141 s of a 300 s budget, no breach), which at High risk pulled in `command-contract`, `command-runtime` and `proof-matrix`, the suites a synced-row change needs. The Bianca regression AGENTS.md requires for household-shape changes (`test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts`) is green at 83/83. Six new tests. Browser evidence `docs/evidence/queen-rooms/`: 14 records, both rooms, 320/390/720/1100, 3D and no-WebGL and reduced motion — `overflowX`/`overflowY` **0 in all 14**, 0 page errors in all 14, and **no figure on the ribbon or the ledge in any of them**.

Uncertainty and what is weakest: **this is High risk and it has not had the independent trust review AGENTS.md asks for** — the field is optional, fail-closed, plan-row-only and carries no money, but the review is owed before merge. No phone, SwiftShader only, and two 3D rooms on top of Home's world is more WebGL than this app has ever asked a device for; nobody has measured it on one. No axe run in this pass. Reordering **Protect** is not built — the cellar is a ribbon, not a shelf, so there is nothing there to reorder yet. And with last-write-wins, one person's rearrangement silently changes the ledge for both; that is what was chosen, and it is worth knowing that is what happens. Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Codex or Cursor for the independent read of the synced-row change; Jonathan for a phone measurement and for whether Protect should gain an order too. [Worksession](worksessions/2026-09-14-queen-rooms.md) · [Evidence](evidence/queen-rooms/).

## The cellar's bill rail — bills as jars, the hammer, the crack, the shard (2026-09-14)

Branch `claude/cellar-bill-banks`, base `origin/main@b462df0` (#477); deliverable `cellar-bill-banks.patch`. Jonathan's brainstorm — the cellar as "an incredibly intuitive way to view and manage bills, subscriptions and upcoming expenses", with the old Fund graph's information, each bill a bank that shows its category, its type, how much is saved and how much is left to be safe, and a hammer when the day comes and the bank is full — plus his three decisions: **"hammer should always be manual, unless the bill has been paid somewhere else in the app"**; a due jar that is not full **gets a crack, not a hammer** — still payable, but from the cellar's water, with the walk showing the buffer take it; an early full jar **shows no hammer**, the water just sits there. **Risk Medium-High** — a new door onto an existing money command. Budget (5): +0 — no new command, posting path, schema, Auth/RLS, sync, financial hash or Hercules payload; the hammer calls `postDueRecurrences` for one recurrence behind the app's `ConfirmSheet` and moves no bank money; `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `fundWalk.ts`, `allocateNestTotal`, the categories, tiers and `test/kitty-nest.test.ts` untouched. Engagement (3): +3.

What changed: new `src/core/queenCellar.ts` (pure selectors: jar type from the recurrence's `kind` or the bank's source; the strike rule with `payable`; this month's bill banks, open and broken, on their days; the walk day by day; the whole reading with the rehearsal hypothetical; the gate's words), new `src/queen/QueenCellarRail.tsx` (the water band and tidemark, the fixed gate, a day track hung from the gate at 44px a day, jar buttons carrying `data-room-vessel` for the 3D room, drag / arrows / Home / End, the jar glyphs — roof, loop, lid, dotted ghost, crack, shard), new `src/queen/queen-cellar.css`, and `QueenCellar.tsx` gains the bills view as the room's default with the months ribbon one step in for the jar in the gate, the gate line, the acts (hammer, crack, lift out / set back, open in the banks), the Confirm sheet and a notice. `QueenHome.tsx` changes one line. `serve-household-home-proof.mjs` gains `bills=1`. One real bug fixed on the way: both rails captured the pointer on press, which in a real browser retargets the click, so a tap on a jar never reached it — capture now waits for 6px of drag.

Three things worth knowing. **The hammer only leans where the cellar can post** — a recurring bill; a planned expense, an appointment, a task or a plan line has no single posting command, so its jar fills, cracks and shards like the rest but its act is *Open it in the banks*. **The posted date is the bill's own day**, because that is what `postDueRecurrences` does; the sheet says so and the shard lands where the jar stood. **The jar's water is the nest's number**, the bill bank's `amountCents` as `projectKittyNest` allocates it — the rail never sums money into a new figure, and the walk behind it is `fundWalkWith` unchanged.

Verification: `tsc` clean; `pnpm check` (Medium, as CI runs it) → `quick-gate-passed`, 23 files / 321 tests (17 fast / 204, 6 serial / 117), 193.6 s of the 300 s budget, `uiProofRequired` satisfied by `test/queen-cellar-layout.mjs` — **23 records, 320/390/720/1100, 3D, flat and no-WebGL, reduced motion, keyboard, axe: `overflowY` 0 everywhere, 0 page errors, 0 serious/critical axe hits**. 21 new tests (`queen-cellar.test.ts` 12, `queen-cellar-ui.test.ts` 9); `vite build` 18.7 s; `goal-fill-ui.test.ts` 6/7 red exactly as on `main`, untouched.

Uncertainty and what is weakest: the strike is **drawn flat over the 3D sculpture**, not modelled — a cracked sculpture is future form work in `queenRoomWorld.ts`, left alone here so the loft patch in flight merges beside this one. The fixture's buffer is $0, so the copper under-the-mark water and the dashed dry water are covered by selectors and CSS, not by a browser still. 320×568 with the chrome stand-ins is the same ~240px room the rooms' evidence shows cramped; the slider and sub-line give way there. No phone, SwiftShader only, a third WebGL room. Merge safety with the loft patch: all code is new files or the cellar's own, `QueenHome.tsx` is one line, the focus-map mapping is appended last, this entry, the D-256 row and the roadmap line sit below the top entries; if the loft chat also takes D-256, renumber. Data/environment: fictional fixtures only. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to push both patches; Codex for an independent read of the hammer's path (`QueenCellar.tsx` → `ConfirmSheet` → `postDueRecurrences`). [Worksession](worksessions/2026-09-14-queen-cellar.md) · [Evidence](evidence/queen-cellar/).

## Shared Home becomes three 3D worlds — the cloud world, Jellybean Row, the home office (2026-09-14)

Branch `claude/queen-worlds`, base `claude/queen-garden-cat@177d2c7` on `origin/main@f046195`; deliverable `queen-worlds.patch`. Jonathan's words: "turn each shared home screen into a 3d world. the lover inspired scene should feel like im in a cotton candy cloud world. the newfoundland should feel like st johns harbour page but for jellybean row, as well as 3d. the office page should be home office with a whole lot of plants and coffee inspiration." Asked, he chose **Classic Hearth's shared home** as the third world (the kitchen table becomes the home office, not the separate Office page), **ambient motion allowed** — which deliberately overrides "nothing moves unless touched" for the world, and for the world only — and **all three** of the harbour page's qualities for Jellybean Row: depth and layering, palette and light, level of detail. Risk Medium-High. Budget (5): +0 — no command, posting path, money schema, Auth/RLS, sync, financial hash or Hercules payload changed; `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `allocateNestTotal` and `test/kitty-nest.test.ts` untouched; the scenery reads nothing and writes nothing. Engagement (3): +3 — Home is a place the household recognises rather than a field of nothing.

Scope, exactly: shared Home resolves to three scenes and only three — `classic-home`, `lover`, `jellybean`. `queenSceneryKind` maps those and nothing else, so no other route grows a world (asserted for every theme × every other route, and for the personal view). Taylor's other eleven eras and Newfoundland's other eleven places keep the bare field.

New: `src/queen/world/queenScenery.ts` (the three worlds, one at a time, under three rules written at the top of the file — depth is three layers never a backdrop, she is the subject, motion is ambient and optional), `src/queen/QueenSceneryFlat.tsx` (the drawn twin: the same three layers, the same palette, the same three gestures in CSS), `test/queen-scenery.test.ts` (8), `docs/evidence/queen-worlds/`. Changed: `queenWorld.ts` — `setScenery(kind, paper)` and `setAmbient(on)`, and the breath loop becomes one ambient clock driving her breath and the world together, so a page with neither running asks for no frames at all; `QueenWorld.tsx` and `QueenHome.tsx` thread the scene (from `useAppearance`, falling back to the datasets the provider itself writes, so the proof harness gets its world too) and the page's own `--paper`; `queen-home.css`; `scripts/serve-household-home-proof.mjs` gains `motion=1`.

Three things the geometry taught, all in the file's comments: the world's sky ends in the page's own paper so the canvas has no visible edge; **a level camera cannot look down**, so the near layer is things that stand *up* close to the lens (the harbour page's pilings, as a kerb and two bollards) rather than a railing that turned out to sit under the ground plane; and for the same reason the harbour is a standing band behind the row rather than a plane, with depth bought by stacking. `tick(seconds)` is a pure function of the clock, so the same second is always the same frame.

Verification: `tsc` clean; `pnpm test -- --risk=medium-high --focus=test/queen-scenery.test.ts` → `quick-gate-passed` (10 files, 142 tests, 92.6 s of a 300 s budget, no breach; `uiProofRequired` met by the browser run). Browser evidence 21 records at 320/390/720/1100 × three worlds × 3D, no-WebGL and reduced motion: `overflowX`/`overflowY` **0 in all 21**, 0 page errors, exactly one world on screen in every record (`flatHidden` true under a live canvas, false without one), `ambient` true only with motion welcome and reduced motion unset. Frame cost 3.4–9.9 ms steady on SwiftShader; scenery geometry 3 / 13 / 18 shared across instances.

Uncertainty and what is weakest: **no phone** — SwiftShader on a container CPU is an upper bound, and a continuous rAF is a real battery cost that follows directly from the ambient-motion decision; it wants a device measurement before this is called done. The full `test/queen-world-layout.mjs` suite was not re-run end to end and no axe run was made in this pass (the worlds add no controls and no text, but the claim is untested here). Observed and not chased: `.queen-home[data-world]` reports `flat` while `.queen-world[data-live]` reports `true` — reproduced on an unmodified checkout, so it predates this work and the root's flat/3D mirror never flips; the drawn *figure* therefore stays visible under a live canvas. Not fixed here; the drawn *world* does not depend on it, yielding to `.queen-world[data-live="true"]` directly. Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan — judge the three worlds, and say whether the other twenty-two scenes should grow worlds too. [Worksession](worksessions/2026-09-14-queen-worlds.md) · [Evidence](evidence/queen-worlds/).

## The Garden Queen — she becomes a cat, and the studio reaches all six of her parts (2026-09-14)

Branch `claude/queen-garden-cat`, base `origin/main@f046195` (#474); deliverable `queen-garden-cat.patch`. Jonathan's words: "I want her to have this terracotta pot texture. With long flowy hair with a flower crown. Her hair must have the white flowers on one side and red flowers on the others; they can interweave on the flower crown. She must have this Buddha garden cat energy to her. Make sure she is a cat. Make sure she can be painted in the kitty bank studio like the others." Risk Medium-High. Budget (5): +0 — no command, posting path, money schema, Auth/RLS, sync, financial hash or Hercules payload changed; `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `allocateNestTotal`, the categories, the tiers and `test/kitty-nest.test.ts` untouched; her look still writes only through `guardQueenDesignSave` onto the household King's draft. Engagement (3): +2 — she is recognisably a cat and the couple can work on every part of her.

What changed: `queenAuthoring.ts` — `QUEEN_PAINTABLE_PARTS` is now `KITTY_PARTS` (`body · head · earL · earR · tail · paws`), the sanitizer keeps paint on all six and stops forcing `mirror: false` (her ears are a pair, so mirroring means something), stamps on an ear, the tail or a paw take while her underside, the crown seat, the eyes and the impersonating kinds are still refused, `QUEEN_CLAY` names the real pot's five colours, and an unpainted Queen reads `terracotta` rather than `cream`. `queenSculpture.ts` — ears with an inner fold, a muzzle and cheeks on the head's paint, a nose, six whiskers, front paws in her lap, a tail curled round her base; fourteen mandevilla strands falling from the crown at varying lengths, one colour a side; a flower crown of twelve alternating blooms and buds on the gold band, where the two colours interweave; a deterministic clay grain (mottling plus the white splatter) composited over whatever is painted; `QUEEN_HEIGHT` 4.6 → 3.75 because her hair falls rather than reaches. `queenCharmSurface.ts` — one constant, `QUEEN_CROWN_V` (0.66): the garland is wider and lower than the gold ring was, so nothing seats under it. `QueenFigure.tsx` and `queen-home.css` — the same cat and the same two-coloured hair with no WebGL at all, plus a fixed clay speckle. `QueenHome.tsx` — the clay dip lands on all of her or on one named part, and her sculpt record now agrees with her model (pointed ears, a wrapping tail, long whiskers).

No reserved channel loosened. Her paws are paintable, but her **cupped hands** — the Move's seat — stay reserved clay, seated above and between the paws rather than under them, so the seat survives any paint. Her skirt profile and head constants were **not** touched, so every charm seat, slide, refusal and flat pick still means exactly what it meant; charms remain on `body` and `head`, paint now reaches all six.

Verification: `tsc` clean; `pnpm test -- --risk=medium-high --focus=test/queen-world.test.ts` → `quick-gate-passed` (9 files, 134 tests, 79.7 s of a 300 s budget, no breach; `uiProofRequired` met by the browser run). Three new tests: the cat signals and six distinct paint materials; the cupped hands above the paws under any paint; the mandevilla's two sides and the crown's interweave. Four existing assertions changed meaning on purpose — she has ears, a tail and paws now, so what used to be dropped is kept. Browser evidence at 390 and 1100 in the 3D path and at 390 with `getContext` returning null: `docs/evidence/queen-cat/`.

Uncertainty and what is weakest: no phone — SwiftShader only, and frame cost was not re-measured after the geometry grew (fourteen strands, six paint textures instead of two); the full `test/queen-world-layout.mjs` suite was not re-run end to end; a thin olive line crosses her lower left in the 3D frames and is on `main` too, so it was not introduced and not chased; shared authorship is still uncovered — `saveKittyNestDesign` saves on one member's word and no consent rule was invented. Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan — judge her against the real pot, and rule on shared authorship. [Worksession](worksessions/2026-09-14-queen-garden-cat.md) · [Evidence](evidence/queen-cat/).

## The Queen's world page — Our Home as one fixed world (2026-09-14)

Branch `claude/queen-full-world`, base `origin/main@dfc2a28` (#473); deliverable `queen-full-world.patch`. Jonathan's words: "I want it to feel like you are in a different world when you open this page. Nothing but what you see in the screenshot should be visible." On the live page she was 29 % of a 754 px viewport with her canvas at y=565 and ~200 px of page scroll: the Stage 1 `--queen-under: 100px` stand-in was about five times short of the real top bar, sync line, household switcher, scene heading and office disclosure. Risk Medium-High; **D-255**. Budget (5): +0 — presentation and chrome gating on one route behind `VITE_QUEENS_NEST`; no command, posting path, schema, Auth/RLS, sync, financial hash or Hercules payload changed; `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts` and `test/kitty-nest.test.ts` untouched; every trust surface removed from Home is rehomed and one tap away. Engagement (3): +2 — the world is the page.

What changed: `src/App.tsx` computes `queenWorldHome` (Home · household · dashboard · Plan V2 Home · `queensNestEnabled()`), sets `data-world-home` on `.app`, and while it holds does not render the top bar, `SyncFreshnessStatus`, the household switcher, `ThemeSceneHeading` (the scrapbook card and its atmosphere button), `WorldCharm` or the Fund ledge, and renders the `HomeInstruments` block (office, seals, boards, Till door) at the Status Centre for the household space instead of under her; it passes a `QueenShell` to `HouseholdHome` → `QueenHome`. `src/queen/queen-home.css` makes `.app[data-world-home]` fixed, inset 0, overflow hidden, edge to edge, with the tabs carrying the safe-area top inset and transient banners kept compact above her. `src/queen/QueenHome.tsx` measures the chrome under her at runtime (the nav's real height with its safe-area inset → `--queen-below`; re-measured on resize, visual viewport, `ResizeObserver` and shell child changes; `data-frame-nav` / `data-frame-tabs` for evidence) — the constant remains only for the stand-alone harness. Where each removed reading now lives: **"Needs attention"** → the Status door wears it visibly (`data-attention`, a badge, the aria-label) and one tap opens the explanation (books gate reason, sync summary, integrity count or the desk sentence) with the same recovery action (`reconnect-auth` / retry) and "Sync help" (the sync line's own Status Centre route); **member · household · date** → the Status panel's "This device"; **environment pill** → the same panel with the same guarded switch, and the top bar on every other destination; **Switch household** → the same `HouseholdEntryCard` list inside the Status panel; **the office, instruments, boards, seals, story tiles, Till door** → the Status Centre (household space, world on), opened by "The office · instruments and boards" from the Status panel, and unchanged on the personal Home and in the panel composition; **the Fund ledge** → Calendar, Plan, Status Centre and Together, with The Fund a nav slot; **due repeating items** → their arrival link stays at the top of the world and the review rises as a sheet only when it is taken. Kept: the two-space tabs and the five-slot nav exactly as they were; the theme's page ground.

Measured on the ACTUAL App page (new `scripts/serve-queen-world-page-proof.mjs` + `test/queen-world-page-layout.mjs`, fictional local Development books, Taylor's Scrapbook, WebGL live): before → 320×568 38.7 % / scroll +677 px; 320×700 31.4 % / +545; 390×844 26.1 %, canvas top y=603 / +290; 720×900 24.4 % / +144; 1100×800 27.5 % / +256. After, all three themes, 3D and no-WebGL → 320×568 65.1 %; 320×700 71.7 %; 390×844 76.5 %; 720×900 78 %; 1100×800 75.3 %; figure 40 % at every width; scroll 0 everywhere; no top bar, sync line, switcher, heading, atmosphere button, office, seals, story tiles, charm or ledge; the field ends above the nav; the Status door opens the shell readings in one tap without scrolling; keyboard order tabs → Together → her → the Move → Status → nav with a visible ring and every stop on screen; The Fund, Our Path, Together and the personal Home keep the top bar and sync line and are not fixed; the office reachable from the Status door; 0 serious/critical axe, 0 page errors (50 records, `docs/evidence/queen-world-page/`).

Verification: `tsc` clean; `test/queens-nest-ui.test.ts` 23/23 (+3: no shell → field unchanged; attention on the door, one tap to explanation, action, sync help, office, switcher, environment; quiet door otherwise); `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` 83/83 (the full-App Bianca regression AGENTS.md requires for App route changes); `pnpm test -- --risk=medium-high --focus=test/queens-nest-ui.test.ts` → `quick-gate-passed` (17 files: fast 11 files / 126 tests, serial 6 files / 117 tests, including `kitty-nest` conservation and `app-startup-p1`; 180.3 s of a 300 s budget, no breach; `uiProofRequired` met by the browser run). `test/goal-fill-ui.test.ts` remains 6 failed / 1 passed exactly as on `main`, untouched. Not verified: a hosted `auth-required` sync state in a browser (no hosted ledger in the harness — jsdom covers the attention routing with a warning shell; the actual page covers it through the books gate); iOS safe-area on a device; a phone rather than SwiftShader.

Wanted but not changed: the Hercules presence dock (D-044) still sits at the bottom right of the world — the product face, and its sentence can be money-adjacent, so it stays until Jonathan says otherwise; books-validation and command banners stay above her while they last (they shrink her, never scroll the page). Nothing was dropped on the floor. Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan for the Hercules-dock decision and a phone measurement of the live page after merge; Codex for an independent read of the App gating. [Worksession](worksessions/2026-09-14-queen-world-page.md) · [Evidence](evidence/queen-world-page/).

## The Queen's creation and history — the wheel, growth rings, her marks, the yearly portrait, living light (2026-09-14)

Branch `claude/queen-ceremony`, base `origin/main@76ab15b` (#472, the Queen's charms — the charm patch was already merged as that commit, so nothing was re-applied); deliverable `queen-ceremony.patch`. Jonathan asked for five pieces of her creation and history in one pass: growth rings from closed Chapters, throwing her on the wheel together as the first act, the makers' marks on her underside, a yearly portrait on a shelf in Our Story, and light that follows the household's day and season. All cosmetic or historical, none a live reading, behind `VITE_QUEENS_NEST`, no new dependency, no money meaning touched.

Where it lives: everything rides the household King design's existing `studio.draft`. The thrown form is the piece's existing `sculpt.profile` (belly, waist, shoulder, neck) read within her own bounds 0.9..1.1 (`queenFormHandles`); `wheel` records the two attributed turns; `portraits` are stored stills; rings are not stored at all — `queenRingCount` derives them from `chapters[].closedAt`. New: `src/core/queenForm.ts` (bounds, the two turns, ring seats, portrait shape, `queenPortraitDue`/`queenPortraitOf`), `src/core/queenLight.ts` (sun elevation over the books' civil date and the device clock at America/Toronto's latitude, quantized to the quarter hour), `src/queen/QueenWheel.tsx`, `src/queen/QueenPortraits.tsx`, `test/queen-ceremony.test.ts` (18), `test/queen-ceremony-layout.mjs`, `docs/evidence/queen-ceremony/`. Changed: `queenCharmSurface.ts` now reads the skirt as radius-over-v on a form (handles × ring dips, height never changes, so uv is the base uv on every form; the lathe is sampled at 128 points; the seam paths follow the surface; `rings` is the tenth reserved channel and a seat on a band slides off), `queenSculpture.ts` (`setForm` rebuilds the lathe and the seams only when the form changes; `setTipped`; `setMarks` draws one 256px canvas texture onto a reserved underside disc; buds are slender furled spirals), `queenWorld.ts` (`setLight` scales the sky and key lamps within a 0.62 floor and lifts the key with the sun; never touches a material), `queenAuthoring.ts` (the guard clamps the profile, keeps the wheel, holds the shelf immutable against `context.kept`, refuses charms on rings via `context.rings`, drops strokes and stamps that reach the underside), `QueenFigure.tsx` (the vessel, shade and highlight are drawn from the same profile; ring arcs; the underside when tipped), `QueenHome.tsx` (form draft while throwing, ArrowDown/pull-down tip with ArrowUp/Escape/press to right her, hourly light, sealing a due portrait once per mount, the wheel, the underside and Our Story sections in Status), `kittyStudio.ts`/`types.ts` (`wheel?`, `portraits?` on `KittyPieceV1`, shaped fail-closed), `HouseholdHome.tsx` (`clock` prop, evidence only), the proof page (`rings`, `wheel`, `portraits`, `today`, `clock`).

Interpretations: the Chapter system has no opening hook, so the wheel is exposed from Status and named there as the first act, not wired as Chapter 1's opening. "Our Story" does not exist as a page in the repo (only in the vision brief), so the shelf is a section named Our Story in Status. A portrait is sealed the first time Home opens after a year closes, for the earliest unsealed year since she was made: its ring count is exact for that year, its form, clay and charms are as she stands at sealing (`at` says when). A portrait is a stored still (form, base and part colours, charms, ring count — not strokes) drawn flat in both paths, never a live sculpture; this is the honest cheap way and it is what the evidence measures. The living light is computed at Toronto's latitude because the books' civil zone is America/Toronto (D-126); the clock is the device's. The tip is a pull of 80px down on her or ArrowDown; on the phone the "Tip her over" button in Status closes the sheet so she is visible. Her underside is inside the feet channel (v below 1/6), so no eleventh channel was added for it.

Verification: `tsc` clean; 18 new focused tests; `pnpm test -- --risk=medium --focus=test/queen-ceremony.test.ts` `quick-gate-passed` (13 files, 168 tests, 92.9s, no breach; `uiProofRequired` met by the browser run). Two existing charm assertions were updated on purpose: the reserved-channel list now has ten entries, and the guard now reads a piece's four handles within her bounds (a cat's `[1, 0.92, 0.82, 0.6]` reads `[1, 0.92, 0.9, 0.9]`). Browser evidence 36 records, 0 serious/critical axe hits, 0 page errors: see `docs/evidence/queen-ceremony/README.md`. `test/goal-fill-ui.test.ts` is red on `main` (6 of 7) and was left alone. Timings are SwiftShader/Node CPU upper bounds, not a phone: steady frames 1.2–1.8 ms at twelve rings + sixteen charms + a shelf of ten; lathe rebuild on a wheel turn 9.1 ms.

Uncertainty and what is weakest: twelve rings still read as soft ribbing on the glazed surface rather than the barely-there bands a real pot would carry (depth 0.9% of the radius); one ring reads right. The wheel's second turn is attributed to whoever is signed in on the device, which on one phone is the same person as the first — the words hand over, the record cannot. Shared authorship remains uncovered by the repo: `saveKittyNestDesign` saves on one member's word; no consent rule was invented. The flat vessel now follows the true lathe profile, so its hem is narrower than the old hand-drawn silhouette (the charms were already seated on the true profile). Data/environment: fictional fixtures only, no hosted rows, no real books. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan — review the ring depth against the real pot, decide whether the wheel should open Chapter 1 once the Chapter system has an opening hook, and decide the shared-authorship question.

## The Queen's charms — small things, earned by acts, pressed on where you choose (2026-09-14)

Branch `claude/queen-charms`, base `origin/main@7b26786` (#471, the Queen's world); deliverable `queen-charms.patch`. Jonathan asked for the charm system: bisque add-ons for her, free placement so no two households' Queens look alike, physical refusal of the reserved zones, unlocks derived from what the household did, persistence on the King design's existing draft, the flat path carrying them too. Risk Medium-High; **D-253**. Budget (5): +0 — no command, posting path, money schema, Auth/RLS, sync, financial hash or Hercules payload changed; `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `allocateNestTotal`, the categories, tiers and `test/kitty-nest.test.ts` untouched; charms are an optional `charms` field on the King draft written only through `saveKittyNestDesign` after `guardQueenDesignSave`; unlocks read `chapters`, `rituals`, `goals`, `transactions`, `sitDownSessions`, `charter` and nothing else (asserted). Engagement (3): +2 — she becomes a record of a real year and a thing no other household has; the bin, bench and press work without a pointer; every state keeps a legible still in every path.

Twelve charms. Starters: sitting cat, teapot, mushroom, paper boat, small bird, die. Earned: paper airplane (a travel goal retired with a purchase, "travel" by the nest's own words), coffee mug (a Ritual held ten times), snail (a Chapter closed still-forming or life-changed), key (`charterIsSigned`), bell (a Chapter opened or closed at a Sitdown, or a closed Sitdown session), spool (a non-duplicate reversal — the seam's evidence, any month). Each charm: part + uv (as free-placed stamps), spin, lean, scale 0.7–1.5, a palette colour, `by`. Cap 16.

New: `src/core/queenCharms.ts`, `src/queen/world/queenCharmSurface.ts` (seat maths, zones, slide-off, keyboard seats, flat seat/pick), `src/queen/world/queenCharmLibrary.ts` (primitives merged per kind), `src/queen/world/queenCharmSet.ts` (instanced per kind on the body group, her glaze axis applied), `src/queen/QueenCharmGlyph.tsx`, `src/queen/QueenCharmTool.tsx`, `test/queen-charms.test.ts`, `test/queen-charms-layout.mjs`, `docs/evidence/queen-charms/`, D-253, this worksession. Changed: `src/core/types.ts` (`KittyPieceV1.charms?`), `src/core/kittyStudio.ts` (`shapeKittyPiece` carries it — it whitelists fields, so without this the record would not persist), `src/queen/world/queenAuthoring.ts` (`queenSanitizeCharms`, `queenWornCharms`, guard context), `queenSculpture.ts`, `queenWorld.ts`, `QueenWorld.tsx`, `QueenFigure.tsx`, `QueenHome.tsx`, `queen-home.css`, `scripts/serve-household-home-proof.mjs` (`charms=`), `test/queens-nest-ui.test.ts` (+4), `test/verification-focus-map.json`.

Reserved zones, how enforced: in surface coordinates derived from where her reserved meshes sit (a test projects the face, crown, vine, hands, seam paths and hem onto her surface and asserts each lands in a refusal); a press on one slides the charm to the nearest seat within 0.3 units or does not take, with no words; a seat facing away from the room does not take; the same rule in `guardQueenDesignSave`, which also drops unearned kinds (only the starters when told nothing) and strips any field a charm might smuggle (glaze, firing, posture); posture and the axis are never places. What can still reach one: a caller bypassing the tool can write a charm into the King's draft around the guard, since `kittyNestDesigns.ts` was left unchanged; the world would draw it.

Verification: `tsc` clean; 14 new focused tests; thirteen Home/nest/studio suites 136/136; `pnpm check` as CI runs it `quick-gate-passed` (11 files, 147 tests, 121.4s, no breach; `uiProofRequired` met by the browser run); `vite build` passes with the charm world code in the lazy `queenWorld` chunk. Browser evidence 35 records: every width × 3D and flat × empty / few / sixteen with 0 scroll, the same charms in the still, the drawn figure and the world, 0–2 idle frames, ≤2 draw calls per kind; the bench in 3D (1100, 390) and flat (390) with pointer press, refused presses on the eye and the fill window, keyboard order and ring, ArrowUp walking; forced colours + easy read; a no-WebGL Chromium at every width with sixteen — 0 serious/critical axe, 0 page errors. Measured on SwiftShader in the container (CPU upper bound, not a phone): steady 1.6–5.1 ms at the cap, first frames 549–663 ms versus 399–549 with none; all twelve kinds build in ~62 ms (26,580 vertices), sixteen lay out in ~16 ms then ~0.4 ms. Pre-existing and untouched: `test/goal-fill-ui.test.ts` red 6 of 7 on `main` and here.

Shared authorship: still not covered by the repo — a charm saves on one member's word, as her look does. Authorship is made visible with existing data (`by` on each charm; the list and the still say who pressed it on); no consent rule was invented. Interpretations: "travel goal closed" = retired with a purchase and named with the nest's travel words (the weakest derivation; a trip named without them earns nothing); "hard month" = still-forming or life-changed; "fill window" = the belly's front-centre band; kept as you go rather than a Keep button so the phone flow (pick up in the sheet, close it, press her) works. Wanted but not changed: nothing in the categories or the money math; the guard inside the core command and a consent rule, both flagged for Jonathan. Data/environment: fictional `planLifeFixture` households only; no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan for the consent question and the core-guard question; Codex for an independent read of `queenSanitizeCharms`, the zone maths and disposal; a phone measurement at the cap. [Worksession](worksessions/2026-09-14-queen-charms.md) · [Evidence](evidence/queen-charms/).

## The Queen's world — the studio's 3D ported into Home (2026-09-14)

Branch `claude/queen-world`, base `origin/main@2f5e9c58` (#470, the Still Queen); deliverable `queen-world.patch`. Jonathan asked for a port and an elevation: the pottery studio's three.js becomes the source of every object in a still Home world. Risk Medium-High; **D-252**. Budget (5): +0 — no command, posting path, schema, Auth/RLS, sync, financial hash or Hercules payload changed; `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `allocateNestTotal`, the categories, tiers and `test/kitty-nest.test.ts` untouched; her look is written only through the existing `saveKittyNestDesign` on the household King after `guardQueenDesignSave`. Engagement (3): +2 — the couple's authored banks are the banks on Home, fired reading fired; she can be dressed together without a kiln; every reading survives with no WebGL.

New: `src/queen/world/queenAuthoring.ts` (paintable parts, nine reserved channels, paint sanitizer, freshness-owned glaze axis, draft-first look, the guarded save, bank piece/fired/glaze, pose and the 3D still), `src/queen/world/queenSculpture.ts` (her own model with reserved geometry), `src/queen/world/queenWorld.ts` (one renderer, one scene, still camera, DOM-driven layout, render on demand, breath only at rest, disposal), `src/queen/QueenWorld.tsx` (decorative host; silent degrade), `test/queen-world.test.ts`, `test/queen-world-layout.mjs`, `docs/evidence/queen-world/`, D-252, this worksession. Changed: `src/queen/QueenHome.tsx` (world inputs, `KittyFlat` bank portraits, goal row, 3D still when live, "Her look" in Status), `src/queen/QueenFigure.tsx` (hand-drawn vessel retired), `src/queen/queen-home.css`, `src/HouseholdHome.tsx` (`world` prop), `scripts/serve-household-home-proof.mjs` (`world=`), `test/queens-nest-ui.test.ts` (+3), `test/verification-focus-map.json`. `NestProp` is out of the world; it remains in the studio.

Verification: `tsc` clean; 50 focused tests; nine Home/nest/studio suites 97/97; `pnpm check` as CI runs it `quick-gate-passed` (14 files, 197 tests, 181.1s, no breach; `uiProofRequired` met by the browser run); `vite build` passes with `three` in lazy chunks. Browser evidence 28 records: the 3D path at five viewports (rest, expanded, peek, cellar) with one canvas, the rest inventory over it, 0–2 frames while idle, the 3D still in words; keyboard order and ring over the canvas; offline matte; breath at rest under motion and none when expanded; the flat path at five viewports; a no-WebGL Chromium degrading silently — 0 scroll, 0 horizontal overflow, 0 serious/critical axe, 0 page errors. Performance measured on SwiftShader in the container (steady 1–6 ms, first frames 280–420 ms, the expand 155–217 ms), not on a phone. Pre-existing and untouched: `test/goal-fill-ui.test.ts` red 6 of 7 on `main` and here.

Reserved channels, how enforced: by geometry (each reading is its own mesh and material with no texture map; paint reaches only body and head), by the sanitizer (strokes and stamps dropped off body/head, off the head's upper third, and for crown/hat/glasses kinds), by the guard (no `fire`, no `completeSetup`, no `archived`, `firedAt` cleared, sculpt dropped) and by the axis (`queenGlazeAxis` reads freshness only). What can still reach one: the gallery's King setup ceremony can fire the King *piece* (the world ignores it for her surface); a caller bypassing the world's tool can write a fired King draft, since the core command was left unchanged.

Shared authorship: the repo's two-person patterns (Plan acknowledgement digests, Bridge proposals, contribution motions) do not extend to cosmetics; `saveKittyNestDesign` saves a household design on one active member's word. The tool makes a kept look visible (date, "both of you author her") rather than silent, and invents no consent rule — Jonathan's decision.

Wanted but not changed: nothing in the categories or money math; the King kiln in the gallery and a consent rule for shared cosmetics, both flagged for Jonathan. Data/environment: fictional `planLifeFixture` households only; no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan for the two open decisions; Codex for an independent read of the guard and the disposal path; a phone measurement before any default-on decision. [Worksession](worksessions/2026-09-14-queen-world.md) · [Evidence](evidence/queen-world/).

## The Still Queen — Household Home overhaul (2026-09-13)

Branch `claude/still-queen`, base `origin/main@4b918b0d` (#469); deliverable `queens-still-home.patch`. Jonathan asked for an overhaul, not a refinement: Household Home behind `VITE_QUEENS_NEST` rebuilt from the ground up as one figure in a field of nothing — her, one quiet line and the Move at rest; two near-invisible field doors (Together, Status) that breathe in when the empty field is tapped; tapping her expands her into Protect · What Now · Build with a button above each; peeks as a glass panel (≥720, from the edge opposite the door) or a bottom sheet (<720); the same door again, or pulling the sheet past a threshold, goes into the cellar (ribbon) or the loft (shelf), where she is gone and the stair is the way back. Risk Medium-High; **D-251**. Budget (5): +0 — no command, posting path, schema, Auth/RLS, sync, financial hash or Hercules payload changed; `kittyNest.ts`, `householdFund.ts` and `fundPulse.ts` are consumed unchanged; `allocateNestTotal`, the four categories, tiers and `test/kitty-nest.test.ts` are untouched; `protect` + `prepare` → Protect, `everyday` → What Now, `build` → Build in `queenPresentation.ts` only, banks passed through; money is still touched only through the existing `KittyBankRoom` gallery from the peeks and rooms. Engagement (3): +2 — healthy is quiet by composition; the glance costs zero taps; every state has a legible still with motion off, in forced colours and with easy read.

New: `src/queen/QueenFigure.tsx`, `src/queen/QueenCellar.tsx`, `src/queen/QueenLoft.tsx`, `docs/evidence/still-queen/`, D-251, this worksession. Rebuilt: `src/queen/QueenHome.tsx`, `src/queen/queen-home.css`, `test/queens-nest-ui.test.ts`, `test/queens-nest-layout.mjs`. Extended: `src/core/queenPresentation.ts` (`queenBanks`, `queenFeet`, `queenLine`, `queenRibbon(s)`, `queenShelf`), `test/queens-nest.test.ts`, `scripts/serve-household-home-proof.mjs` (fictional ribbon history, a lidded Build bill, an open Build goal). Unchanged from Stage 1: `HouseholdHome.tsx`, `planFeature.ts`, `.env.example`, `vite-env.d.ts` — the panel composition remains the fallback when the flag is off.

Verification: `tsc` clean; 34 focused tests; the eight Home/nest/chapter suites 94/94; `vite build` passes; `pnpm check` as CI runs it (Medium, no focus) classifies `quick-gate-passed` — 15 files, 216 tests, 187.8s, no time breach — after a second commit repaired two tests that were already red on `main@4b918b0` and only entered the selection because this change touches Home: `test/plan-worlds.test.ts` and `test/five-boards-entry-app.test.ts` both still clicked the "Enter Kitty Banks" door that #466 replaced with the nest, and the latter asserted the legacy Plan that since D-248 renders only under `VITE_PLAN_SYSTEM_V2=0`; the repairs change only how the tests reach the surface, not what they assert about money or focus. Browser evidence: 57 records across seven pulse seeds at 320×568, 320×700, 390×844, 720×900 and 1100×800 with App chrome stand-ins — 0 horizontal overflow, 0 vertical page scroll at every viewport including 320×568, 0 targets under 44px, 0 serious/critical axe hits, 0 page errors; the expand, the Protect peek and the cellar at every width; the loft by pull (390) and by the same door (1100); doors revealed by a field tap; the Move opening Together with its act; motion (6s breath, doors ≤0.1 at rest, 1.0 revealed, faded after) and reduced motion (nothing animates, doors 0.6 with labels); keyboard order Together → her → Move → Status with a 3px ring, Enter/Tab/Escape walk; forced colours (emulated); easy read. Pre-existing and untouched: `test/goal-fill-ui.test.ts` red 6 of 7 on `main` and here.

Interpretations: the Move opens the Together peek with its act beside "Not yet" (one visible step) rather than acting on the glance; panels come from the edge opposite their door so the door stays the way deeper; on the phone the door repeated at the foot of the sheet is the non-gesture way in; goals have no parts in the data model, so an open-mouthed goal opens to its contributions as marks and to the gallery; the ribbon's outlier is the posted month above 1.35× the median of at least three beats, with no number attached. Wanted but not changed: nothing in the categories or the money math — the four categories fit the three banks cleanly at the presentation layer.

Uncertainty: the 100px reservation for the App's collapsed instruments row is a stand-in, not a measurement of the real App page; `queenBanks().share`, `queenFullness()` and the ribbon's outlier are display arithmetic in selectors, disclosed; at 320×568 inside the App the sheet covers all but her crown; peeks scroll internally when taller than the frame; forced colours emulated only; the theme expressions are not authored and the artwork is the grammar study's stand-in geometry.

Data/environment: fictional `planLifeFixture` households only ("Fictional household", "Alex (fictional)", "Sam (fictional)"); no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to decide whether the Still Queen replaces Stage 1 behind the flag; Codex for an independent read of the new selectors and the chrome-height assumption; then the theme expressions. [Worksession](worksessions/2026-09-13-still-queen.md) · [Evidence](evidence/still-queen/).

## The Queen's Nest — Stage 1, Home as one body (2026-09-13)

Branch `claude/queens-nest-stage-1`, base `origin/main@a96c1ffb` (#467); deliverable `queens-nest-stage-1.patch`. Jonathan asked for a presentation recomposition: the separate Household Home panels become regions of one body, the Queen, behind the Plan V2 flag family. Risk Medium-High; **D-250**. Budget (5): +0 — no command, posting path, schema, Auth/RLS, sync, financial hash or Hercules payload changed; `kittyNest.ts`, `householdFund.ts` and `fundPulse.ts` are consumed unchanged; the four categories, tiers, `allocateNestTotal` and `test/kitty-nest.test.ts` are untouched, and the two doors plus belly are a presentation-only grouping in `src/core/queenPresentation.ts` (`protect` + `prepare` → Protect, `build` → Build, `everyday` → belly) that passes the four banks through without re-summing. Engagement (3): +2 — the glance costs zero taps, the Move one; every state has a legible still that survives reduced motion, forced colours and Easy read; negative states are aimed at the month, never a person.

New: `src/core/queenPresentation.ts`, `src/queen/QueenHome.tsx`, `src/queen/queen-home.css`, `test/queens-nest.test.ts`, `test/queens-nest-ui.test.ts`, `test/queens-nest-layout.mjs`, `docs/evidence/queens-nest/`, D-250, this worksession. Changed: `src/HouseholdHome.tsx` (`composition` prop; panel Home intact and default), `src/core/planFeature.ts` (`queensNestEnabled`, opt-in `VITE_QUEENS_NEST=1|true` inside Plan V2 + Household Home V2), `src/vite-env.d.ts`, `.env.example`, `scripts/serve-household-home-proof.mjs` (Queen seeds and chrome stand-ins), `test/verification-focus-map.json`.

Verification: `tsc` clean; 25 focused tests; the eight Home/nest/chapter suites 85/85; Medium-High quick gate passed at 89.7s with no breach (9 selected files, `uiProofRequired` met by the browser run); `vite build` passes; browser evidence 59 captures across seven pulse seeds, five viewports and three themes (token pass-through only) with 0 horizontal overflow, 0 vertical scroll at every viewport 700px or taller including App chrome stand-ins, 0 serious/critical axe hits, 0 page errors, keyboard order crown → vine → face → hands → body → belly → Protect → Build, a one-tap Move walk and a bud opening the existing gallery with focus returned. Pre-existing and untouched: `test/goal-fill-ui.test.ts` is red 6 of 7 on `main` and here; `test/statements.test.ts` passes at this base.

Uncertainty: the 100px reservation for the App's collapsed instruments row is a stand-in, not a measurement of the real App page; 320×568 scrolls 44px at the 300px floor; fullness is the shelf's existing ten-step ratio; the partner trace uses ISO civil days; the figure is the artifact's geometry, not the mandevilla form; forced colours, VoiceOver, physical devices and real Development data were not exercised. Not in this change: the cellar/loft, opening gesture, ribbon, shelf (Stage 2), the Hercules sentence (Stage 3), the three theme expressions (Stage 4), "Let it fade" and "Not now" on the glance, and the Development rehearsal entry (More keeps it).

Data/environment: fictional `planLifeFixture` households renamed "Fictional household" with "Alex (fictional)" and "Sam (fictional)"; no hosted, schema, Production or real-household writes. Local branch and patch only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to decide on landing Stage 1 opt-in; Codex for an independent read of the selector and the chrome-height assumption; then Stage 2. [Worksession](worksessions/2026-09-13-queens-nest-stage-1.md) · [Evidence](evidence/queens-nest/).

## Hercules audit expansion — authorized Development release (2026-09-12)

Jonathan explicitly requested push, merge and deployment after the local evidence and limits were reported. The candidate integrates Nesting Eggs main `49dbaf7`. [Release scope, checks and receipts](worksessions/2026-09-12-hercules-audit-release.md) supersede the earlier local-only boundary for this release. Production, schema, secrets, quota settings and household writes remain outside scope.

## Hercules audit expansion — local candidate (2026-09-12)

Branch `codex/hercules-audit-expansion`, base `1686ccc4`. Claude's downloaded journey audit informed conversation repairs, truthful take-home, scoped dynamic action discovery, reviewed hourly job setup and modern task lifecycle. High risk; Budget (5): current financial evidence and retained Confirm authority. Engagement (3): questions, useful actions and recoverable work. Focused High gate passed 472 tests across 43 files in 99.444 seconds with no budget breach; build, 13 local background-runtime cases and 96 browser matrix cases passed. Live Flash, authenticated continuity and physical-device evidence remain separate. No push, deployment, schema or provider changes. [Handoff](briefs/HERCULES_AUDIT_EXPANSION_HANDOFF.md) and [worksession](worksessions/2026-09-12-hercules-audit-expansion.md) distinguish local validation from live/physical acceptance.

## Nesting eggs + F-010 — PR #466 (2026-09-12)

[PR #466](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/466), branch `codex/nesting-eggs-f010`, integrated main `1686ccc4`. High risk. Home and Plan now open a King → Protect / Everyday / Build / Prepare → existing Goals / automatic expense nest. Jonathan chose whole Household Fund allocation, exact child-to-King conservation, automatic recurring replacements, immutable broken-pot looks, collapsed history and skippable/resumable King setup. Budget (5): preserve accepted money, scoped receipts and Final Confirm. Engagement (3): four studio depths, original modeled props and all three authored themes.

Application source `c85c5b7`: focused High gate 563/563 tests in 51 files, 83.164 seconds without a budget breach; a prior assertion-passing 465.831-second run is recorded separately. Build and 20 appointment tests pass. Browser evidence covers 180 primary and 108 active-editor cases, both spaces, three themes and six widths; actual App Home adds 21 layout/flow cases and three setup routes. Simple/3D King and Goal paint, refire, stop-spin, chapter completion, broken views and exact-door return focus pass. GitHub exposed an obsolete Home shelf selector, corrected in browser-only commit `f7f00c6` and verified locally. Independent reviews closed history/replay/privacy and studio findings.

Jonathan subsequently authorized the Development merge/deployment. Final review fixes preserve Both receipt looks, reject removed potential/deleted or ineligible task sources, and include visible financial facts in bank accessible names; 26 focused core/UI tests pass, including server admission after concurrent removal. See the worksession release follow-up and PR for the final gate/deployment result. New cosmetics use `kittyNestVersion:1`; retain compatible readers/validators after any future activation. Authenticated two-device, physical-device and exhaustive-suite evidence remain open. The [handoff](briefs/NESTING_EGGS_F010_HANDOFF.md), [worksession](worksessions/2026-09-12-nesting-eggs-f010.md) and [evidence index](evidence/nesting-eggs-f010/README.md) contain exact scope, commands, source hashes and limits. Next owner: PR reviewer, then Jonathan for a separately authorized release.

## Hercules Workspace — local implementation (2026-09-12)

Branch `codex/hercules-workspace`, baseline `origin/main@02a5539dfc4dfadf6c7cae67b98f17db278c9eaa`; D-249; High risk. Jonathan approved the full workspace implementation. Private projects, a Flash-only Agent/Workflow runtime, versioned artifacts, scoped ledger reads, Plan links and existing confirmation bridges are implemented behind disabled activation flags. Budget (5): verified resources and retained financial authority. Engagement (3): enduring conversation, broad work and three authored rooms.

Final focused gate: 493 tests across 45 files, TypeScript/AI/diff checks, 102.143 seconds with no time-budget breach. Local Agent/Workflow/R2 runtime: 12/12 cases. Themed browser matrix: 36/36 cases. Four export formats reopen locally. Production build and separate Worker type-check/bundling pass. Separate live Flash comparison, hosted/container execution, authenticated continuity and physical-device acceptance remain open. No hosted migration, infrastructure application, deployment, secret or provider activation occurred. The [durable handoff](briefs/HERCULES_WORKSPACE_HANDOFF.md) gives exact commands and remaining work; the [worksession](worksessions/2026-09-12-hercules-workspace.md) retains measured evidence and prior failures.

## The time machine — row 8, rebased over #455 (2026-09-12)

Branch `cursor/time-machine-row-8-420a`, rebase of `claude/time-machine-row-8@64bdf46b` onto `origin/main@02a5539d` (feedback rows 5–7 #455). Original cut from `main@6fa38aed` (planner #453). Jonathan chose row 8, asked for the whole product in one slice, and decided goal history should be derived from `goalContributions` rather than left out of v1. Risk High: `projectHouseholdFund` gains an observation axis and the cumulative statements gain an optional `asOf`. Budget (5): +5. Engagement (3): +3. Decision id is **D-247** because main already has D-245 (planner) and D-246 (rows 5–7).

The correctness trap, fixed: `projectHouseholdFund` summed every Fund event ever recorded for its operating balance while filtering its reserve, month plan, target and contribution progress to the month of `today`. Pointed at a past month it produced free-to-spend arithmetic across two months, silently. A `FundLens` now holds `anchor` (where the reported month stands), `period` (the month reported) and `asOf` (what had happened yet) apart, and `fundLensForPeriod` clamps the anchor into the month exactly as `fundWalk` already does — so the walk and the projection finally agree. `fundLensToday` keeps `asOf: null`; a test asserts today's reading is unchanged.

New: `src/core/timeMachine.ts`, `src/timeMachine/TimeMachine.tsx`, `src/timeMachine/time-machine.css`, `scripts/serve-time-machine-proof.mjs`, `test/time-machine.test.ts`, `test/time-machine-ui.test.ts`, `test/time-machine-layout.mjs`, `docs/evidence/time-machine/`, D-247. Changed: `householdFund.ts` (the lens and the as-of projection), `monthObligations.ts` and `fundWalk.ts` (naming the lens they already used), `statements.ts` (optional `asOf` on the cumulative statements), `goals.ts` (`goalSavedAsOf`, `goalMonthSeries`, `goalMonthMovements`), `core/index.ts`, `ledgerExperience.ts` (`timeMachine` AppTab borrows the ledger scene), `App.tsx` (time-machine room; no household-secondary bar), `Books.tsx` (`viewMonth` paging for statements and the Fund register, writes still anchored to the real month; Books is the door), `styles.css`, `test/verification-focus-map.json`, and one stale assertion in `test/statements.test.ts` that has been red on `main` since #425. `#` stays four money verbs named "Add money"; the original `+` "See a month" go-verb is not restored.

Verification from the source branch: `tsc` clean; `pnpm build` passes; 19 focused tests; the D-183 mainline suites (`app-startup-p1`, `month-rehearsal-mainline`) pass serially, 82 tests in 62.6 s; quick gate risk High passed in 91.7 s of a 300 s budget with no breach across 13 selected files, `uiProofRequired: true`; browser evidence 49 captures across three themes, five widths, four panes and both scopes with 0 horizontal overflow, 0 serious/critical axe and 0 page errors. Exact commands in [the worksession](worksessions/2026-09-12-time-machine-row-8.md). Rebase verification is recorded in [the rebase worksession](worksessions/2026-09-12-time-machine-row-8-rebase.md).

Open for Jonathan, not decided here: today's Fund balance still counts Fund events dated in the future, exactly as it always has. The honest as-of reading would filter them — a one-line change in `fundLensToday` — but it moves a present-day figure, so it is a money-meaning call. Preserved byte-for-byte.

Also pre-existing and left alone: `test/goal-fill-ui.test.ts` is red on `main` at the base SHA (6 of 7 tests), verified in a clean worktree. It is outside this branch's surface and outside the quick gate's selection.

Uncertainty: the forecast reads `$0.00 expected in` where a household's Fund is fed by confirmed contributions rather than a projected recurrence; the memory layer covers goals, Wins, Sitdowns and month closures but not the board photo or a fired kitty bank; the page borrows the ledger scene rather than owning one; `KittyBanks.tsx` still renders the undated running total, although the dated readers now exist for it. Not exercised: physical devices, VoiceOver, a real Development snapshot, and months containing a reversal or correction.

Data/environment: fictional catalog fixtures only; no hosted, schema, Production or real-household writes. Next owner: Codex for an independent trust review of the `asOf` axis; then Jonathan for the open decision and product review.

## Feedback rows 5–7 — one route, fewer words, colour that means something (2026-09-12)

Branch `cursor/feedback-rows-5-7-32f2` (rebase of `claude/feedback-rows-5-7@f4d6dc6b` onto `origin/main@6fa38aed` / planner #453). Original cut from `58cb1d75`. Head `c9410d34`. **PR #455 merged** as `02a5539d`. Decision id is **D-246** because the planner already took D-245. Jonathan chose "all of it" from the rows 5–7 plan, no Simple/Everything mode, and the "Why" aside for explanations. Risk Medium. Budget (5): +0 by design — no command, posting path, schema, sync or Hercules payload changed; money-outcome, host-vs-peer and Development-openness sentences stay visible lines; the calendar is read-path only and ink/copper stay reserved for posted/scheduled. Engagement (3): +3 — Our Home's persistent chrome drops from ~11 controls to ~7, the phone desk hides what is below the fold at rest, the Status Centre folds to what needs them, explanations whisper, and the calendar reads by kind in all three worlds.

New: `src/calendar/semantics.ts` (kind registry: glyph · word · hue · layer · stroke), `src/calendar/KindLegend.tsx` (legend = filter, `role="switch"`), `src/theme/kinds.css`, `src/theme/Whisper.tsx` + `whisper.css`, `src/theme/StatusFold.tsx` + `status-fold.css`, `src/core/terms.ts`, `scripts/copy-budget.mjs`, `scripts/serve-calendar-kinds-proof.mjs`, `test/calendar-kinds.test.ts`, `test/copy-budget.test.ts`, `test/terms.test.ts`, `test/navigation-one-route.test.ts`, `test/calendar-kinds-layout.mjs`, `docs/evidence/calendar-kinds/`, `docs/claude/FEEDBACK_ROWS_5_7_PLAN.md`. Changed: `scenes.ts` (`--kind-*` per scene, light/dark), `board.ts` and `calendar/google.ts` (`span {index,length}`; one `endDateFromGoogleEvent`), `visibility.ts` (layers from the registry), `Calendar.tsx`, `CalendarDesk.tsx`, `Appointments.tsx`, `PotentialExpenseEditor.tsx`, `styles.css` and `worlds.css` (dead kind hexes and `.dots` removed; the ink override no longer erases kind), `fabActions.ts` (four money verbs, "Add money"), `ledgerExperience.ts` (`AppTab`, `sceneTabFor`, including `planner`), `App.tsx` (secondary nav retired; planner room kept from #453; Status Centre in seven `StatusFold`s; whispers), `PhoneFold.tsx` + `office-phone.css`, `Books.tsx`, `PlanStudio.tsx`, `SitDownGuide.tsx`, `KittyBanks.tsx`, `KittyBankRoom.tsx`, `FundSourceFields.tsx`, `PlanLensWorkbench.tsx`, `GoogleBridge.tsx`, `BatchImport.tsx`, `QuickSamplePanel.tsx`, `StatementSetup.tsx`, `HerculesPro.tsx`, `SevenShiftsEvidenceCenter.tsx`, `Office.tsx`, `Pairing.tsx`, `DailyHearth.tsx`, `deferredSurfaces.tsx`, `KitchenErrorBoundary.tsx`, `MonthRehearsalPanel.tsx`, `main.tsx`; D-246.

Verification: `tsc --noEmit` clean after installing missing `pdfjs-dist` in this environment (dependency already on main). Medium quick gate passed at `c9410d34`: 35 selected files, 443 tests, 95.644 s, fingerprint `6209abd0…`, clean tree, no time-budget breach; `uiProofRequired` remains open for Status Centre and phone fold. Calendar browser evidence from the original slice is still on the branch. Copy budget allow-list 31; every `line` ≤ 90.

Uncertainty: run bars align across cells only when neighbours carry the run in the same chip row; a folded phone-desk object that must take focus opens the fold in the same tick (jsdom cannot show the one-frame `visibility:hidden`); the plan's "≥ 60% less visible prose on daily surfaces" was not met — what remains is labels, not explanations; `poets` paper is below AA for all small text, kind chips included, though none render there today; stored notes and engine strings still say "Sit-down" / "PGlite". Personal “My planner” strip and `+` “Plan the week” were dropped with row 5; Together and Hercules remain the planner doors. Data/environment: fictional catalog fixtures only; no hosted, schema, Production or real-household writes. **PR #455 merged as `02a5539d`.** Next owner for that slice: Codex to audit D-246, the span read path and the three new fences; then Bianca's read on a phone. [Worksession](worksessions/2026-09-12-feedback-rows-5-7.md) · [Rebase](worksessions/2026-09-12-feedback-rows-5-7-rebase.md).


## Vision v2 Horizon A — A2–A12 on the same branch (2026-09-12)

Source branch `claude/vision-v2-slice-1`, source base `ecf936ac`; Codex integration branch `codex/vision-v2-horizon-a-integration`, rebased cleanly over `origin/main@317a041` (#448). Jonathan: "complete A1–A12". Risk High. Budget (5): no command posts money; Chapter objects are non-financial and blanked for Hercules; leftover allocation kept its Final Confirm and moved to the Fund as "Close the month". Engagement (3): Household Home, one Sitdown with a brief and Chapter close/open, Our Path led by the Chapter, Status Centre, comfort controls, pulse-first Hercules.

New: `src/core/chapters.ts`, `src/core/sitdownBrief.ts`, `src/ChapterPanel.tsx`, `src/HouseholdHome.tsx`, `src/household-home.css`, `src/theme/comfort.ts`, `src/theme/ComfortControls.tsx`, `scripts/serve-household-home-proof.mjs`, `test/household-home-layout.mjs`, `test/vision-v2-chapters.test.ts`, `docs/evidence/household-home/`. Changed: `types.ts` (four optional Shared collections), `sync.ts`, `importParity.ts`, `visibility.ts`, `ledgerSync/registry.ts`, `core/index.ts`, `planLearning.ts`, `planFeature.ts`, `ledgerExperience.ts` (personal nav without More), `PlanStudio.tsx`, `App.tsx`, `SyncFreshnessStatus.tsx`, `Hercules.tsx`, `herculesPage.ts`, `hercules.ts`, `styles.css`; D-244 and the D-239 numbering note.

Verification: `tsc` clean; `pnpm build` passes; quick gate risk High passed (157.6 s, 41 files, 518 tests, no breach); 11-file serial sweep 167 tests; browser evidence 36 captures across three themes × four widths for Home, Our Path and Comfort with 0 overflow, 0 serious/critical axe, 0 page errors. Details and exact commands in [the worksession](worksessions/2026-09-12-vision-v2-horizon-a.md).

Codex trust review closed the Ledger sync v2 gap: Chapter/Ritual/Move/Win changes now bind command identity and the materialization hash, travel in direct and compacted events, replay in hosted order, and reject missing, malformed, cross-reference-invalid, or hash-tampered materialization. The accepted-books financial hash remains unchanged. The rebased clean candidate passed the High quick gate against `origin/main@317a041`: 41 selected test files, 519 tests, within the 300 s budget with no breach; the gate reported `uiProofRequired: true`. PR #449 merged as `a0dffc6`; post-merge CI, Hercules confirmed-actions, and Cloudflare Development deployment passed. A fresh browser-UA smoke returned HTTP 200 for the Worker and its current bundle and found the Horizon A markers. Physical devices, VoiceOver, authenticated two-browser Chapter continuity, and review on real Development data remain open. No schema or Production change was made.

## Vision v2 slice 1 — names, the Fund tab, the adaptive +, the Fund pulse (2026-09-12)

Branch `claude/vision-v2-slice-1`, base `ecf936ac` (main after #447). Jonathan accepted Vision v2 Decisions 1, 2 and 3 and asked for Horizon A to begin. Risk Medium. Budget (5): no posting path changed; the pulse is a pure projector that says "Checking" before anything else when evidence is stale, offline or untied. Engagement (3): the spaces read My Money / Our Home, the household truth tab carries the Fund's chosen name (default The Fund), Personal tabs read Calendar and Work, and the + asks "What can we do?" in Our Home with verb-first actions ordered by destination.

New: `src/core/spaceNames.ts`, `src/core/fabActions.ts`, `src/core/fundPulse.ts`, `test/vision-v2-slice-1.test.ts`, `docs/briefs/HEARTH_FUTURE_VISION_V2.md` (the plan), D-243. Changed: `FabSpeedDial` gains optional `actions`/`closedLabel`/`onGo`; `App.tsx` wiring; `.tone-go` style for navigation-only verbs; label updates in three test files. Stored ledger names and `HOUSEHOLD_FUND_NAME` are unchanged.

Verification: `tsc` clean; 23 focused tests pass; the Bianca mainline suites (`app-startup-p1` 81, `five-boards-entry-app`, `month-rehearsal-mainline`) pass serially, 98 tests in 67.9 s. Quick gate (Medium, focus `vision-v2-slice-1`) passed in 141 s with no time-budget breach across 16 selected files; `uiProofRequired` stays open. Details in [the worksession](worksessions/2026-09-12-vision-v2-slice-1.md). No browser evidence captured for the six-row household dial at 320 px; no three-theme screenshots in this session.

Uncertainty: Personal bar geometry with a centred + (3 | + | 2 vs folding Calendar vs a raised +) needs Jonathan's choice before the Status Centre slice; `fundPulse()` has no UI consumer until slice 2. Data/environment: fictional catalog fixtures only; no hosted, schema, Production or real-household writes. This session's git proxy had no push credential for the repository, so the branch is local only — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to authorize push/PR; Codex to audit D-243 and the slice-2 Household Home plan.
## Kitty Bank Studio v2 — local implementation (2026-09-12)

Branch `claude/kitty-studio-v2`, base `317a04197d5f17312eed2642b727729040772e4a`. Jonathan requested it and made two product calls in the same message: each bank should tell its story through the kitty itself, and **nothing is final** — a fired piece can be repainted, refired or thrown away whenever they like. Risk Medium-High: `GoalEnvelope.studio` gains optional fields and loses the fired-is-final guard; no journal, posting, projection, schema, Auth/RLS or PGlite change, and the studio still never reads or writes money. Budget (5): +0. Engagement (3): +3.

What is in it: feature dials for head, ears, eyes, nose, mouth, whiskers and tail; free-placed add-ons (hats, glasses, purses, suitcase, palm, shell and thirteen more) baked anywhere you tap, drawn from one artwork table shared by the 3D textures and the flat SVG; the flat cat rebuilt as a front projection of the same body curve and head proportions the lathe spins, replaying the real part textures so the 3D paint job shows in Simple view, shelf thumbnails and the room; face features seated on the head's actual surface (they had been positioned *inside* the head ellipsoid, the real cause of "eyes and face features dont work good enough"); an invisible paint shell 0.26 units outside each paintable mesh carrying the same uv, so a stroke past the edge still lands and a stroke begun off the cat starts when the brush arrives; a brush ring cursor sized from the selector; a spin stop that sticks for the session; a story kit chosen from the bank's own name and purpose; shelf actions (Show this one / Repaint / Throw away) each behind a Confirm that says no money moves; and a new-bank form cut to a name and an amount.

Verification: `tsc --noEmit` clean; the five kitty suites green (35 tests, including new cases for dials, free placement, the artwork table, `displayId` and a UI walk that fires, repaints, refires to `firings: 2` and clears the shelf with `savedCents` untouched); `pnpm test -- --risk=medium-high --focus=test/kitty-studio-ui.test.ts` quick gate passed inside budget; browser evidence at 320/390/720/1100 in `docs/evidence/kitty-studio/v2-*` with no horizontal overflow and no page errors.

Uncertainty: add-ons are baked decals rather than modelled props; the paint shell is a fixed distance, so concave spots get less slack than flat ones; clients older than free placement will draw an add-on at its nearest anchor rather than the exact spot; `firings` is a count, not a history. Not done: Bianca-side notification of a repaint, Hercules commentary, per-stroke pressure, pointer-dragging a placed piece, export of a fired piece. All three themes were captured (Classic, Taylor's Scrapbook, Newfoundland); the new controls inherit the existing room tokens rather than adding colour of their own.

Local only: no push, merge, deployment, schema, Production or real-household writes. Next owner: Codex for an independent audit of the envelope/sync surface and the removed transition guard; then Jonathan for product review.

## Kitty Banks — authorized Development release (2026-09-11)

Jonathan explicitly authorized push, merge and Development deployment after the scoped implementation and remaining limits were reported. The candidate incorporates main through #441, retaining guided Plan and category splitting. [Release scope, verification and compatible rollback](worksessions/2026-09-11-kitty-envelope-release.md). This supersedes the local-only release boundary below; it does not authorize exhaustive verification, Production, schema, or real-household writes.

## Kitty Banks — local cinematic envelope implementation (2026-09-11)

Branch `codex/kitty-envelope-app-20260911`, base `16d4710733c5e5ff1655e5a7d2bdff6c01b59ad2`, incorporating merged #433 and #437. Jonathan authorized implementation. Risk High. Budget (5): exact backing, reusable partial purchases, scope-bound receipts and correction recovery. Engagement (3): an interactive ceramic bank and folio in six authored theme/scope rooms, useful Plan rehearsals, clearer Calendar types and readable Hercules.

The dedicated room preserves the existing Plan, links future decisions to exact bank IDs, and supports create/style, funding, partial use, history, archive/restore, private scenarios, explicit paydays and contextual Hercules. Accepted funding uses existing Goals-vault transfers or Fund earmarks. General account-independent assignment, arbitrary reallocation, credit-card envelope logic and automated refill execution remain unimplemented; no claim of a complete YNAB replacement. New data requires `goalEnvelopeVersion:1`; deploy compatible authority before clients and retain receipt/validator support in rollback.

[Implementation, exact verification chronology and limits](worksessions/2026-09-11-kitty-envelope-implementation.md) · [Product destination and remaining contract work](briefs/KITTY_BANKS_CINEMATIC_ENVELOPE_APP_2026-09-11.md). Build passed. All 81 startup checks and all selected focused files have passing serial evidence; the initial concurrent quick gate failed and exceeded its five-minute budget. The synthetic browser proof covers all three themes in both scopes, 42 room geometry cases, Calendar semantics, partial purchase, archive, privacy, fallback and keyboard recovery. Physical devices, authenticated continuity, live providers and comparative product acceptance remain open.

Claude supplied one bounded sculpture module; Codex integrated it and owns the financial implementation. Two independent read-only closure reviews found no blockers in their scope. Local only: no push, merge, deployment, schema, Production or real-household writes. Next owner: Jonathan for product review; release needs its own authorization and current candidate verification.

## Hercules — authorized Development release (2026-09-10)

Jonathan authorized push, merge and Development deployment of all six local slices. The candidate now includes main's Books and potential-Calendar changes, independent presentation rollback and Calendar Move/source reconciliation. [Release scope, exact gate and compatible rollback](worksessions/2026-09-10-hercules-release.md). Verification and deployment receipts are tracked there; earlier local-only entries below remain historical evidence. Production/schema/secrets/provider settings are unchanged, and real user/device acceptance stays open.

## Hercules slice 6 — integrated local candidate (2026-09-10)

Branch `codex/hercules-integration-acceptance`, reviewed predecessor `c902c4d43e3ab744ba6c1cd36f919577ea6c52ff`. Risk High. Budget (5): truthful confirmations, private scope and current source links. Engagement (3): continued conversation, clear help and integrated wardrobe access.

Recover lost acknowledgement before retrying chat/memory/suggestions; preserve view-local session drafts without identity leakage; retain ordered correction/forget exchanges; cancel stale source replies without cancelling on ordinary chat ACKs. Calendar bill links and desktop sources now work through existing navigation. Local fallback offers specific help and simple casual continuity. Phone focus is contained and restored, with the focused rig active while ambient movement pauses. The visible desktop invitation sits above the portrait. Original assets are unchanged from slice 5.

[Exact commands, results, audit findings and limits](worksessions/2026-09-10-hercules-slice-6.md). [Reproducible runners](../scripts/companion/README.md). [Bianca acceptance packet](briefs/HERCULES_BIANCA_ACCEPTANCE.md). Local synthetic evidence only: all 327 selected tests passed in serial recovery, build and 72-case browser matrix passed. The standard concurrent quick gate failed on four test timeouts and two worker RPC timeouts after TypeScript passed; preserve this open gate before a later release. This is scoped evidence, not exhaustive release proof. No push/merge/deploy/schema/secrets/provider activation or real-household writes. Next owner: Jonathan for product review and remaining trials; independent release authorization remains necessary. Compatible presentation rollback and authenticated/physical acceptance remain release gates.

## Hercules slice 5 — complete wardrobe, locally verified

High quick gate passed 236 tests in 220.715 seconds; separate serial import parity passed 5 tests. The 36-case browser matrix, 200% text, recovery and synthetic two-member persistence passed. Full likeness/fit, physical performance, VoiceOver and authenticated two-device acceptance remain open. All 36 new pieces and 12 legacy wearables now use collection assets, shared SVG IDs, personal Wear/Save and an explicit household gallery. Receipt recovery precedes stale mutation preflight; resource revisions, tombstones, actor binding and protocol capability guards protect continuity. All three rooms retain their scene mapping. Risk High; Budget (5): no financial writer, private scope and truthful acknowledgements; Engagement (3): complete fitting, named looks and shared inspiration. Default flag off. No push/merge/deploy, hosted mutation, schema or provider activation. [Worksession](worksessions/2026-09-10-hercules-slice-5.md).

## Hercules living companion slice 4 — flagged local fitting (2026-09-10)

One complete Cozy at home look now runs in a lazy 3D room with the canonical source rig, shared skin, twelve reaction clips, physical/keyboard shelf selection, mirror/camera controls, scoped local undo/redo and matching 2D layers. Classic, Taylor and Newfoundland have Shared/Personal treatments; phone keeps the room through breakpoint changes. Asset/WebGL failure retains fitting controls; failed room chunks offer an explicit reload. GPU resources and motion loops are released on close.

Risk High. Budget (5): no financial/profile/gallery writer. Engagement (3): tangible fitting and character movement. [Source/export](../scripts/wardrobe/README.md) and [worksession/evidence](worksessions/2026-09-10-hercules-slice-4.md). Default flag remains off; likeness/fitting and physical phone are open gates. The full catalogue and acknowledged Wear/Save/share remain slice 5. Local only, no push/merge/deploy or hosted/provider changes.

## Hercules living companion slice 3 — local implementation (2026-09-10)

Useful discovery now shares one local evidence/catalogue path with typed source/navigation actions. Help has For you now, Things we can do and Continue with me; acknowledged private snooze/disable/resume settings, scope epochs, exact predecessor CAS and current-state navigation checks protect continuity. Phone and desktop use all three authored themes. Existing outfits are reachable on phone; full 3D wardrobe remains slice 4.

Risk High. Budget (5): grounded explanations and existing Confirm/source workflows. Engagement (3): useful suggestions and resumable tasks without interruptions. [Worksession/evidence](worksessions/2026-09-10-hercules-slice-3.md). No push, merge, deployment, schema, secrets or real provider-data test. Server-first compatible release and authenticated two-device proof remain separate gates.

## Hercules living companion slice 2 — local implementation (2026-09-10)

Private profile persistence now spans shaping, personal split/decode/overlay/assembly, v2 command admission, event replay and backup. Chat uses the versioned affectionate-diva brief, scoped bounded history and explicit preference controls with acknowledged receipts and Undo. Conversations remain usable while unsaved; legacy shared history stays read-only and outside active context. All three themes have authored controls in the chat and wardrobe.

Risk High. Budget (5): no financial writer or private-to-shared disclosure is added. Engagement (3): natural follow-ups, steady affection and controllable preference memory. [Worksession and verification](worksessions/2026-09-10-hercules-slice-2.md). Local implementation only; no push, merge, deployment, schema, secrets or live provider testing. Server-first compatibility rollout, physical two-device proof and the live dialogue quality rubric remain release gates. Slice 3 is useful discovery/predictive suggestions; the 3D wardrobe remains slice 4 onward.

## Hercules living companion slice 1 — local contracts (2026-09-10)

Jonathan requested slice 1 of the [finalized companion plan](briefs/HERCULES_LIVING_COMPANION_PLAN.md). Branch `codex/hercules-companion-contracts` starts at verified main `2e113f69d03872eddc22ac461378a0f3e33f6c55`. This slice adds closed executable profile/look/gallery/intent contracts, strict validators, resource preconditions, twelve capability declarations, a character brief and 24 synthetic dialogue scenarios. Production types, command registrations, Gemini prompts and UI are unchanged.

Risk Medium-High; Budget (5): grounded capabilities and exclusion of money execution; Engagement (3): coherent personality, wardrobe and member-owned continuity foundations. Independent read-only review is closed after fixing automatic-memory cancellation, versioned wear validation and opaque legacy preservation. The focused suite passed 46 tests; the repository quick gate passed 84 tests plus TypeScript/AI/diff checks in 115.907 seconds without a budget breach. [Exact evidence and build status](worksessions/2026-09-10-hercules-slice-1.md).

Next: slice 2 must deliver the complete private envelope/shape/split/overlay/actor/resources/import-parity/server-compatibility unit before writing new profile state, then connect personality and memory. Partial envelope support can lose data on an unrelated authority command. The model request context is still a declaration, and no live model-quality, retained-memory or cross-device success is claimed. No push, merge, deployment, schema or provider/data change occurred.

## Five shared boards — authorized Development release (2026-09-08)

Jonathan subsequently instructed “push merge and deploy.” The dedicated private Development photo bucket is provisioned and bound in the release candidate. [Release worksession](worksessions/2026-09-08-five-shared-boards-release.md) records the authorization, storage verification, rollout checks and rollback reference. Production activation, schema changes and destructive cleanup remain outside scope. The local implementation receipt below is historical; its no-release instruction has been superseded.

## Five shared boards — locally verified implementation (2026-09-08)

Jonathan's approved plan is implemented on `codex/hearth-five-boards`, preserving main `5778a8d`. Final product source `f64f95a`; later handoff commits are documentation only. Mobile Till-style Add, traditional Calendar default, Shared Plan ordering, Household table navigation and all five boards have authored Classic/Taylor/Newfoundland treatments. The ongoing three-theme rule is in `AGENTS.md`.

Risk High; Budget(5): clearer entry and household money navigation; Engagement(3): useful shared boards. Integration gate255tests and final focus gate110tests passed, with TypeScript/AI/diff, builds,129board/calendar/Books geometry cases,21axeviews and105entrybrowsercases. Independent financial/continuity and UX reviews are closed. [Exact acceptance receipt](worksessions/2026-09-08-five-shared-boards.md). [Durable handoff and release dependencies](briefs/FIVE_SHARED_BOARDS_HANDOFF.md).

No push/merge/deploy/schema/Production action. Dedicated Development photo storage must be provisioned separately. Photo removal clears references while prior bytes stay private until coordinated garbage collection; physical deletion is disabled. Hosted OAuth, authenticated two-device and physical-device proof remain release work. Next owner: Jonathan for local review; release requires a separate instruction.

## Three worlds — authorized Development release (2026-09-08)

Jonathan explicitly requested “push merge deploy.” Release the reviewed theme candidate `c25de23` on top of fresh mobile main `a17dc35`, preserving its delayed Count callback/receipt guards. Existing placeholder authorization and Safari/device limits remain. [Release worksession](worksessions/2026-09-08-theme-release.md) records current scope and verification; the earlier local handoff remains historical. No schema, household mutation or Production activation.

## Three worlds — completed mobile integration (2026-09-08)

Themes14313c8 and finished mobilebf33c87 are integrated in `codex/three-visual-worlds` through local mergedf5328e. Main remains6fb15c7. Jonathan authorized fictional memorabilia until his photos are available. Classic, all twelve Taylor eras and all twelve Newfoundland scenes now use the actual phone Fold, Ledge, chapters and instruments, with compact headings and Claude-refined materials. No financial or Auth writer changed. Budget(5): readability and retained drafts/authority; Engagement(3): distinct authored phone worlds and reserved keepsakes. Medium-High.

Current evidence, exact source commit lookup, Claude provenance, limits and rollback: [mobile worlds handoff](briefs/MOBILE_WORLDS_HANDOFF.md). Local synthetic proof is separate from Safari, physical-phone and authenticated account/device acceptance. No push/main merge/deploy/schema/hosted write. Next owner: Jonathan for review of this local candidate; release is separate.
## Mobile Phase 2 — authorized Development release (2026-09-08)

Jonathan explicitly requested push, merge, deploy and reversibility. PR 406 releases the complete Claude-led Phase 2 stack in one merge; pre-release source is tagged `mobile-phase2-before-20260908` at `6fb15c7`. Compatibility rollback is preserved on `codex/mobile-phase2-safe-rollback`, retaining current core/ledgerSync and Count recovery. A raw old-Worker rollback would remove required authority/privacy protections. No schema, ledger reset or Production activation.

Release-wide 573-test quick gate passed, followed by the independently audited Count stale-room receipt fix and its focused high gate. Regression reproduced before and passed after. [Release worksession](worksessions/2026-09-08-mobile-phase2-release.md). Physical acceptance limits remain recorded. Exact deployed SHA/version and live proof belong to the release receipt; do not infer deployment from this pre-merge handoff.

## Mobile Phase 2 — implementation complete locally (2026-09-08)

**Branch/base:** codex/mobile-phase2-integration; exact baseccd9304936479bf964ca8d0fe472e7a3ccdceaf5(Return PR405); HEAD is this commit. Fresh origin/main6fb15c7a98f3336862bb743b836aa96a358a35b9 remains unchanged.35 stacked draft slices; no merge/deploy/schema.

**Outcome:** Claude's A1–A5, B1–B9, C1–C12 plus independently reviewed SC01–SC06 and compatible Proof/Return are implemented. His latest style/space authority wins; G2 was explicitly waived. Earned/received/contributed stay distinct; Apron receipt never claims to reduce the current Ask. Medium-High final integration; Budget(5)+0; Engagement(3)+1.

**Proof:** Final133-test focused quick gate + TypeScript/AI/diff166.486s, no breach;570-module production build and Hercules Pro UI passed. Four browser widths and simulated native pinch1→1.6 at320/390 passed; independent final review clear. [Exact commands/fingerprint/limits](worksessions/2026-09-08-mobile-phase2-integration.md). [Full dependency-ordered PR/commit inventory](MOBILE_PHASE_2_REVIEW.md).

**Acceptance/next owner:** Jonathan. Physical/device gates remain open, including B2 G3:14 blank-entry taps against under10 target. Real QR/OAuth, camera/OCR, physical background/pinch and pre-existing sync certification are not claimed. Earlier scoped timing failures remain honestly recorded in their worksessions. Local build and labelled fictional previews are available; Google sign-in needs environment configuration in the compiled preview. Release requires separate instruction.

## Mobile Return stitch (2026-09-08)

Locally verified codex/mobile-return-stitch; baseb4146b279c70792ce6a729ec71b7897c02b9726f(Proof PR404); HEAD is this commit. Medium-High; Budget(5)+1; Engagement(3)+2. Resume lives in the single existing bar, resolves current scope/chapter and existing destination, publishes its local bookmark for repeat use. Quick gate141.909s plus four browser widths, repeat Enter/click and measured last-action clearance passed. Independent review clear. [Exact evidence/limits](worksessions/2026-09-08-mobile-return-stitch.md). Next integration; no hosted/merge/deploy.

## Mobile Proof seam (2026-09-08)

Locally verified codex/mobile-proof-seam; base3a12133b02a487e71c4cba6018f22b1ed4df3e7c(C12 PR403); HEAD is this commit. Medium-High; Budget(5)+2; Engagement(3)+1. Existing amount opens exact accepted scoped source; actual compiler links and separate reversal history, no repeated money or write.98 selected tests plus TypeScript/AI/diff152.113s; final CSS refined then four widths/200%/focus passed. Independent money/UX reviews clear. [Evidence and repaired findings](worksessions/2026-09-08-mobile-proof-seam.md). Next Return, then integration. No hosted/merge/deploy.

## Mobile C12 — visible elapsed clock (2026-09-08)

Locally verified codex/mobile-c12-visible-clock; base2d4d28e5e8075296a2775f089cea58feefa9a5eb(C11 PR402); HEAD is this commit. Medium; Budget(5)+0; Engagement(3)+1. Both hidden timers stop, return projects current wall time once. 88 selected assertions plus TypeScript/AI/diff155.287s; independent review clear. [Exact commands/fingerprint/limits](worksessions/2026-09-08-mobile-visible-clock.md). No layout or money change; no physical battery proof. Next Proof/Return additions and integration, no merge/deploy.

## Mobile C11 — Evidence beneath Jobs (2026-09-08)

Locally verified codex/mobile-c11-work-evidence; base1ee073f53f531b17039ca4a453d75266410eebb6(C10 PR401); HEAD is this commit. Medium; Budget(5)+0; Engagement(3)+1. Phone three-tab order, scoped deeper disclosure and both resize focus directions. 90-test quick gate169.828s precedes final focus repair, then two focused tests and four browser widths passed. Independent review clear. [Exact evidence/limits](worksessions/2026-09-08-mobile-work-evidence.md). Next C12; no merge/deploy/hosted proof.

## Mobile C10 — desk setup, phone Timesheet (2026-09-08)

Locally verified on codex/mobile-c10-work-handoff; base 52817e70ce34f4ee590f9d3f7da883878f81f62e (C9 PR400); HEAD is this commit. Clean ordinary Shift handoff, scope-bound explicit connection refresh and deliberate Timesheet navigation. Medium-High; Budget(5)+1; Engagement(3)+2. Quick gate passed in 153.444s, four fictional browser widths, independent source review clear. [Commands, fingerprint and limits](worksessions/2026-09-08-mobile-work-handoff.md). Next C11. No physical/hosted/full-lane/merge/deploy proof.

## Mobile C9 — flagged capture override (2026-09-08)

**Status:** Locally verified on codex/mobile-c9-camera-override; base67985a04d6d96a178ecb7efb1cb4838f0da0e475(C8,PR399). HEAD is this commit.

**Outcome/risk:** Two rejected user attempts unlock explicit capture override; all image warnings remain attached to the current draft/error review. Nested camera focus, Escape and source lifetime are guarded. Medium-High; Budget(5)+1; Engagement(3)+2.

**Proof:**127 selected tests plus TypeScript/AI/diff110.096s; seven synthetic-camera browser cases, independent review clear. [Exact evidence and repaired findings](worksessions/2026-09-08-mobile-camera-override.md).

**Next/limits:** Stacked draft PR then C10. Synthetic/local/mock proof; no physical camera, hosted OCR, exhaustive, merge/deploy/schema.

## Mobile C8 — Hercules fallback (2026-09-08)

**Status:** Locally verified on codex/mobile-c8-hercules-copy; basea4a7709a3c033c5be5cf7de9c53cc22f534ff02b(C7,PR398). HEAD is this commit.

**Outcome/risk:** Stray fallback text replaced; existing Shift oracle chips preserved. Medium; Budget(5)+0; Engagement(3)+1.

**Proof:**90 selected tests plus TypeScript/AI/diff134.521s; actual fallback four widths and phone chips verified. Independent source review clear. [Evidence](worksessions/2026-09-08-mobile-hercules-copy.md).

**Next/limits:** Stacked draft PR then C9. Local fictional/component proof; no hosted/physical/exhaustive/merge/deploy/schema.

## Mobile C7 — receipt Undo (2026-09-08)

**Status:** Locally verified on codex/mobile-c7-undo-window; baseadc44df6af82e6df6ad30032550f5b3e47b80025(C6,PR397). HEAD is this commit.

**Outcome/risk:** Claude's shrinking paper retains a stationary named44px Undo. Expiry/LIFO/purchase identity and scope survive queue; accepted delivery can finish after expiry. Global Undo remains available independently. High; Budget(5)+2; Engagement(3)+2.

**Proof:** Final High quick gate152.988s clean pass including C6's previously failing test set; four new App cases, eight browser cases, independent reviews clear. [Commands/fingerprint/limits](worksessions/2026-09-08-mobile-undo-window.md).

**Next/limits:** Stacked draft PR then C8. Local fictional/mocked transport only; no hosted/physical/exhaustive/merge/deploy/schema claim.

## Mobile C6 — truthful Till empty state (2026-09-08)

**Status:** Focused proof complete on codex/mobile-c6-till-empty; base1c724a2608f5b403c03e84d3c5159e5fd86e906f(C5,PR396). HEAD is this commit.

**Outcome/risk:** Empty copy accounts for transaction and confirmed Fund activity without changing spend. Medium; Budget(5)+1; Engagement(3)+1.

**Proof/limit:** Fourteen Till tests and eight layout cases pass; independent verifier clear. Quick gate TypeScript/AI/diff and87 assertions pass but overall gate fails121.713s on three pre-existing App toast timers after unmount. C7 must repair and rerun; no clean-gate claim. [Commands/fingerprint](worksessions/2026-09-08-mobile-till-empty.md).

**Next:** Stacked draft PR; C7 Undo/timer lifecycle. Local fictional proof only, no merge/deployment/schema.

## Mobile C5 — attached claim actions (2026-09-08)

**Status:** Locally verified on `codex/mobile-c5-claim-rows`, exact base`923ca35286724c47cb18c8ace0e0536a61f6dc6c` (C4, PR395); HEAD is the commit carrying this file.

**Outcome:** Existing claim rows reveal their own action. Named review requires the actual receiving account and exact supported remainder; source/scope guards survive queue and authority. Focus and enlarged copy remain reachable.

**Risk/deltas:** High; Budget(5)+2; Engagement(3)+2.

**Proof:** 116 selected tests plus TypeScript/AI/diff123.569s; final CSS ten browser/two native gesture cases. Independent reviews clear. [Exact commands, fingerprint, repairs and limits](worksessions/2026-09-08-mobile-claim-rows.md).

**Next/limits:** Codex opens stacked draft PR and continues C6. Fictional local/mocked App transport; no physical/hosted/exhaustive/merge/deployment/schema certification.

## Mobile C4 — inline Due occurrences (2026-09-08)

**Status:** Locally verified on `codex/mobile-c4-due-rows`; exact base`1aee199d73cea6487d709fb128d44f7e49f921a8` (C3,PR394). HEAD is the commit carrying this file.

**Outcome:** Claude’s row disclosure replaces two sheets with one inline named Confirm, displaying the exact occurrence. Local per-row deferral leaves schedule/Books unchanged; an arrival link keeps it reachable on long pages. Source/actor/date/scope meaning survives queue and authority.

**Risk/deltas:** High; Budget(5)+2; Engagement(3)+2.

**Proof:** Final quick gate151.667s, ten browser and two native touch cases, independent reviews clear. [Commands, fingerprint, corrections and limits](worksessions/2026-09-08-mobile-due-rows.md).

**Limits/next:** Fictional local proof with mocked App transport; no physical/hosted/exhaustive certification. Certain Fund/closed-period/midnight cases source-reviewed only. No merge/deploy/schema. Codex opens stacked draft PR and continues C5.

## Mobile C3 — destructive reveal (2026-09-08)

**Status:** Locally verified on `codex/mobile-c3-danger-reveal`; exact base`52f93983e7da7a003e53dba7618073409d930d09` (C2, PR393). Implementation HEAD is the commit carrying this file.

**Outcome:** Claude's phone slide reveals a separate named destructive action. Cancel stays easy to reach; long explanations scroll; current source, displayed target, auth and opening fence stale reviews. Duplicate exclusion and same-source rejection retry remain reachable.

**Risk/deltas:** Medium-High; Budget(5)+1; Engagement(3)+1.

**Proof:** TypeScript/AI/diff/focused gate, seven layout cases, native touch/cancel/scroll and thirteen B8 regression cases passed. Independent reviews repaired four real lifecycle/layout issues. [Commands, fingerprints and limits](worksessions/2026-09-08-mobile-danger-reveal.md).

**Limits/next:** Local fictional component/App proof with mocked transport; no physical/hosted/exhaustive or new legacy-writer certification. No merge/deployment/schema. Codex opens stacked draft PR and continues C4.

## Mobile C2 — honest household suggestions (2026-09-08)

**Status:** Locally verified on `codex/mobile-c2-swipe-suggestions`; exact base/pre-commit HEAD`0d8f3f2b272606b263233c305225b52e885f64b6` (C1, PR392). Implementation HEAD is the commit carrying this file. Phase2 continues.

**Outcome:** Claude's six-slot grid supports first use with clearly labelled household suggestions. Observations stay truthful. Named Post preserves its exact reviewed sources through queue and authority, and old outcomes cannot affect a newer sheet.

**Risk and Dual Course:** High; Budget(5)+2; Engagement(3)+2.

**Verification:** Final High quick gate136/136plus TypeScript/AI/diff passed53.385seconds, no five-minute breach. Six mounted App interleavings, actual command round trips and seven browser cases pass. Four base-App failures and toast regression reproduced and repaired. Independent money/UX/verifier clear. [Exact commands, failures, fingerprints and limits](worksessions/2026-09-08-mobile-swipe-suggestions.md).

**Limits and next owner:** Fictional local model/component/App/authority proof; mocked App transport, no physical/hosted/exhaustive claim. Existing unreviewed postEntry remains compatible. No merge/deployment/schema. Codex opens stacked draft PR and continues C3 destructive reveal with separate named Confirm.

## Mobile C1 — complete pad choices (2026-09-08)

**Status:** Locally verified on `codex/mobile-c1-pad-choices`; exact base/pre-commit HEAD`56d516171cdf47f5b78cc920c0de0011f2acc935` (B9, PR391). Implementation HEAD is the commit carrying this file. Phase2 continues.

**Outcome:** Every current eligible account/category is reachable from the pad. Named disclosures preserve amount and exact IDs, retain selected tail items, and reset by viewer scope/mode.

**Risk and Dual Course:** Medium; Budget(5)+1; Engagement(3)+1.

**Verification:** Medium quick gate61/61plus TypeScript/AI/diff passed95.880seconds, no five-minute breach. Seven browser cases pass; independent UX/verifier reviews clear. [Exact commands and limits](worksessions/2026-09-08-mobile-pad-choices.md).

**Limits and next owner:** Fictional local proof only; no physical, hosted or exhaustive claim. No merge/deployment/schema. Codex opens stacked draft PR and continues C2 household category suggestions.

## Mobile B9 — the Turn (2026-09-08)

**Status:** Locally verified on `codex/mobile-b9-turn`; exact base/pre-commit HEAD`9c2646547f82f89c74eb72b199f58121610f567d` (B8, PR390). Implementation HEAD is the commit carrying this handoff, resolved by Git/PR. Phase2 continues.

**Outcome:** Claude's one date read-head fits its drawing, replaces hover and selects exact prepared facts. Current Fund remains fixed; today and projected values remain separate. Live custodian Trust retains one drawing/paperbox, Reach retains its own axis, and older Course future aggregates are visibly undated.

**Risk and Dual Course:** Medium-High; Budget(5)+2; Engagement(3)+2.

**Verification:** Final quick gate139/139 plus TypeScript/AI/diff passed231.304seconds, no five-minute breach. Twenty layout/state cases and four native/sheet gesture cases pass. Independent money/UX/verifier source reviews clear. [Exact commands, fingerprint and limits](worksessions/2026-09-08-mobile-turn.md).

**Limits:** Fictional local component/model proof; older MonthSpread remains at existing hosts. No physical, authenticated full-App browser, exhaustive or hosted proof. Native user-zoom restriction remains an integration repair. No merge, deployment or schema.

**Next owner:** Codex opens the separate stacked draft PR and implements the twelve original tweaks individually.

## Mobile B8 — the Prise (2026-09-08)

**Status:** Locally verified on `codex/mobile-b8-prise`; exact base/pre-commit HEAD`10d0e8d13ee07b5e4498579e71f1813f52cec26e` (B7, PR389). Implementation HEAD is the commit carrying this handoff, resolved by Git/PR. Phase2 continues.

**Outcome:** Claude's two stuck cards reveal actual differences with fixed similarity. Scoped named Confirm describes linked recognition effects, protects auxiliary source records, binds authority generation and preserves a hashed review precondition through authoritative replay. Accessible fields, modal isolation, cancellation and focus survive review and acceptance.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+2.

**Verification:** Final High quick gate157/157 plus TypeScript/AI/diff passed56.709seconds; no five-minute breach. Thirteen actual-component browser cases and native touch proof pass. Authority round-trip and mounted App tests cover stale sources and scoped writes; generation-only failure reproduced and repaired. Independent financial/UX/verifier reviews clear. [Exact commands, failures, fingerprints and limits](worksessions/2026-09-08-mobile-prise.md).

**Limits:** Fictional local component/App/actual-authority proof, mocked App acceptance transport; no authenticated physical, exhaustive, hosted or release claim. Existing unreviewed duplicate primitive remains a separate compatibility path. No merge, deployment or schema.

**Next owner:** Codex opens the separate stacked draft PR and implements Claude's B9 Turn, fitting the month and replacing hover with one read-head.

## Mobile B7 — the Punch (2026-09-08)

**Status:** Locally verified on `codex/mobile-b7-punch`; exact base/pre-commit HEAD`b873cb8afcb3dd96c7dbac2525f2d03c3cda2958` (B6, PR388). Implementation HEAD is the commit carrying this handoff, resolved by Git/PR. Phase2 continues.

**Outcome:** Claude's tall edge reveal preserves actual clock/break readings and separates motion from named actions. Scoped timeline guards protect queued actions and conflict choices; accepted clock-out controls pay-review navigation. Hidden timers pause and keyboard focus survives accepted updates.

**Risk and Dual Course:** High; Budget(5)+1; Engagement(3)+2.

**Verification:** Final High quick gate139/139 plus TypeScript/AI/diff passed103.633seconds; no five-minute breach. Eleven actual-component browser cases and native touch proof pass. Four mounted App action cases include a reproduced/repaired confirming-discard regression. Independent financial/UX/verifier reviews clear. [Exact commands, failures, fingerprints and limits](worksessions/2026-09-08-mobile-punch.md).

**Limits:** Fictional local App/component/command proof with mocked acceptance transport; no authenticated physical, exhaustive, hosted or native Live Activity claim. No merge, deployment or schema.

**Next owner:** Codex opens the separate stacked draft PR and implements Claude's retained B8 Prise with fixed evidence and scoped Confirm.

## Mobile B6 — the Trust (2026-09-08)

**Status:** Locally verified on `codex/mobile-b6-trust`; exact base/pre-commit HEAD`58fe84fdaf679a9cf901e8d7267793fac866ef6b` (B5, PR387). Implementation HEAD is the commit carrying this handoff, resolved by Git/PR. Phase2 continues.

**Outcome:** Claude's three Trust stops preserve accepted Fund/Ask and scheduled obligations, draw only reviewed ranges, and label the last included source without implying completeness. Scoped preferences fall back visibly; stale accepted identities immediately remove old scenarios. Original typography and one drawing/paperbox remain.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+2.

**Verification:** Final High quick gate104/104 plus TypeScript/AI/diff passed90.816seconds; no five-minute breach. Fourteen browser layout/state cases, two sheet/keyboard cases and native scroll checks pass. Independent financial/UX/verifier reviews clear. [Exact commands, failures, fingerprints and limits](worksessions/2026-09-08-mobile-trust.md).

**Limits:** Fictional local component/model proof; no authenticated full-App browser, physical, exhaustive, hosted or release claim. No merge, deployment or schema. Existing user-zoom restriction remains for integration review.

**Next owner:** Codex opens the separate stacked draft PR and builds Claude's retained B7 Punch within the original instrument grammar.

## Mobile B5 — the Fill (2026-09-08)

**Status:** Locally verified on `codex/mobile-b5-fill`; exact base/pre-commit HEAD `b0c094b407e9619c7440f3c973cbbd3ccbd6b074` (B4, PR386). Implementation HEAD is the commit carrying this handoff, resolved by Git/PR. Phase2 continues.

**Outcome:** Claude's phone jar composes exact contribution drafts; recorded progress and Fund earmarks retain separate meanings. Shared/Personal funding and purchases now preserve ownership, private notes and partitioned vault cash. Reviewed source/date and accepted facts are rechecked inside queued Confirm. Desktop bank face remains.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+3.

**Verification:** High quick gate148/148 plus TypeScript/AI/diff passed98.227seconds; no five-minute breach. Eight all-CSS browser cases and native drag/cancel/page-scroll proof. Independent money/UX/verifier reviews clear; original privacy failures reproduced. Final one-sentence copy refinement has separate seven-assertion UI and eight-case browser verification; the recorded High fingerprint predates that sentence. [Exact commands, failures, fingerprints and limits](worksessions/2026-09-08-mobile-fill.md).

**Limits:** Fictional actual-component/command proof; no observed arrival-date model, authenticated full-App browser, physical, exhaustive, hosted or release claim. No merge, deployment, history rewrite or schema.

**Next owner:** Codex opens the separate stacked draft PR and builds Claude's B6 Trust. Current Fund/Ask remain accepted readings; three categorical stops include only supported sources and reviewed paired scenario bounds.

## Mobile B4 — the Weight (2026-09-08)

**Status:** Locally verified on `codex/mobile-b4-weight`; exact base/pre-commit HEAD `92e5183c31c6ba31d2dd28a8f213f2dd9c3e98de` (B3, PR385). Implementation HEAD is the commit carrying this handoff, resolved by Git/PR. Phase2 continues.

**Outcome:** Claude's phone day rail replaces the two-tap grid below720. Posted and scheduled cash use exact dated provenance; card activity and cash returned retain their separate meaning. Corrections do not silently reopen Post. Desk grid and ordinary Confirm remain. Shared mono token restores Plex Mono utility type.

**Risk and Dual Course:** High; Budget(5)+2; Engagement(3)+2.

**Verification:** Final High quick gate118/118 plus TypeScript/AI/diff passed118.615seconds. Eight Weight browser cases, twelve Reach cases and four touch/sheet cases passed with complete main CSS. Twenty-four captured original cash-flow statements unchanged. Independent source and UX reviews clear. [Exact commands, fingerprints, failures and limits](worksessions/2026-09-08-mobile-weight.md).

**Limits:** Fictional actual components/commands; no authenticated full-App browser, physical, exhaustive, hosted or release claim. No merge, deployment or schema.

**Next owner:** Codex creates the separate stacked draft PR and builds Claude's B5 Fill, preserving safe source and Confirm semantics.

## Mobile B3 — the Reach (2026-09-08)

**Status:** Locally verified on `codex/mobile-b3-reach`; exact base/pre-commit HEAD `24469bd5b206efca912c4c3ff5ff40024a4ffcc7` (SC06, PR384). Implementation HEAD is the commit carrying this handoff, resolved by Git/PR. Phase2 continues.

**Outcome:** Claude's original phone composition consumes the reviewed Fund scenario. Native effort stops select true named route families. Receipt assumptions and separately elected contributions live inside the one paperbox. Current Ask and accepted history remain unchanged; paired model paths and dated terminal deficits stay hypothetical. Unavailable or stale own sources hide private choices while retaining the Shared reading. Native page and modal scrolling are repaired.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+3.

**Verification:** Final High quick gate147/147, TypeScript/AI/diff passed124.450seconds within five minutes. Twelve browser layout/state cases, two sheet/keyboard cases and native touch page/scrim/inner-content checks passed. Independent G4 source and UX reviews clear. [Exact commands, fingerprints, earlier failures and evidence](worksessions/2026-09-08-mobile-reach.md).

**Limits:** Fictional local actual-component browser proof; no authenticated full-App browser, physical, exhaustive, hosted or release claim. Earlier446.729second gate breach and timeout recovery retained. B2 physical/blank-entry G3 and B6 G4 remain open. No merge, deployment or schema.

**Next owner:** Codex creates the separate stacked draft PR and builds Claude's B4 Weight.

## Mobile SC06 — App-issued accepted scenario source (2026-09-08)

**Status:** Locally verified on `codex/mobile-sc6-accepted-scenario-source`; exact base/current pre-commit HEAD `a13c6c4155707cb7d1f68d68bbe5c89078a49b80` (SC05, PR383). Phase2 remains in progress. Implementation HEAD is the commit carrying this handoff, resolved by Git/PR.

**Outcome:** Validated own pair completeness, bounded accepted identity and synchronous auth/room invalidation. Delayed legacy and v2 responses cannot revive previous sign-in sources. Failed navigation preserves later accepted updates. Components receive scoped props and perform no auth/storage discovery.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+1.

**Verification:** All130 selected assertions pass across the final gate and targeted recovery; TypeScript/AI/diff pass. Independent4 lifecycle regressions pass with no remaining bounded finding. Final gate181.621seconds timed out in concurrent demo entry; isolated2/2 and serial50/50 passed. Earlier352.728second gate breach retained. [Exact commands, fingerprints and failures](worksessions/2026-09-08-mobile-scenario-source.md).

**Limits:** Actual App mounted with fictional fixtures and mocked providers. Optional props do not change rendered markup/CSS. No clean quick-gate, exhaustive, hosted, physical, merge, deployment or schema claim. G4 consumer proof remains open.

**Next owner:** Codex opens the separate draft PR and integrates Claude's Reach within the original composition.

## Mobile SC05 — paired scenario composition (2026-09-08)

**Status:** Locally verified on `codex/mobile-sc5-paired-scenario`, stacked on SC04 `78b5f5e` (PR382). Phase2 remains in progress.

**Outcome:** Re-resolved source choices, conserved fixed/up-to contributions, exact estimate replacements and aligned hypothetical paths. Accepted monthly walk, current Fund and Ask are preserved; terminal deficits are separate model outputs. The46-dollar fixture yields -50500 cents from the same168500 anchor and223600 dated claims.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+2.

**Verification:** High quick gate106 assertions plus TypeScript/AI/diff passed in546.457seconds, with a five-minute TypeScript breach retained. Independent16/16 and no remaining financial/source blocker; two mutations killed. [Exact evidence](worksessions/2026-09-08-mobile-paired-scenario.md).

**Limits:** Fictional local model only; no UI, accepted write, physical, hosted, exhaustive, merge, deployment or schema claim. G4 final consumer review remains open.

**Next owner:** Codex opens the separate draft PR, then implements the App's accepted-pair source adapter before connecting Claude's Reach.

## Mobile SC04 — forecast receipt assumptions and named route families (2026-09-08)

**Status:** Implemented on `codex/mobile-sc4-forecast-availability`, stacked on SC03 `7fba9a8` (PR381). Phase2 remains in progress.

**Outcome:** Five true0–4 count families, stable named route/candidate identities, narrow own single-channel forecast receipt assumptions, unchanged net bands and old Ask routes. Selection does not elect a contribution.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+2.

**Verification:** All59 selected assertions pass across gate and targeted recovery. Independent source review found no remaining blocker. The quick gate itself failed the unchanged500ms benchmark under memory pressure; isolated rerun passed. TypeScript/AI/diff passed. Gate816.334seconds, five-minute breach retained. [Exact fingerprint, commands and results](worksessions/2026-09-08-mobile-forecast-availability.md).

**Limits:** Fictional local coherent receipts; unsupported channels refuse. No UI, complete scenario, physical, hosted, exhaustive, merge or deployment claim. No clean quick-gate claim.

**Next owner:** Codex opens the separate draft PR and proceeds to SC05 paired scenario output inside Claude's intended Reach.

## Mobile SC03 — cash capacity and explicit assumptions (2026-09-08)

**Status:** Locally verified on `codex/mobile-sc3-cash-availability`, stacked on SC02 `9c27a78` (PR380). Phase2 remains in progress.

**Outcome:** Accepted own-source/readiness contract, dedicated digests, truthful unknown availability, explicit cash assumptions and conserved fixed elections. Recorded accounts never become receipt-specific available cash. Contradicted paid counters and unsupported shift corrections refuse without changing Work or ledger semantics.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+1.

**Verification:** Final High quick gate88 assertions, TypeScript/AI/diff pass in241.261seconds, no breach. Independent20/20, no remaining blocker. A real future-shift-reversal regression failed before repair. [Exact evidence and boundaries](worksessions/2026-09-08-mobile-cash-availability.md).

**Limits:** Pure fictional local command fixtures. Cash remains a declared assumption; aggregate payment checks do not prove attribution. No UI, complete scenario, physical-device, exhaustive, hosted, merge or deployment claim. App acceptance-marker integration remains later consumer work.

**Next owner:** Codex opens the separate draft PR and continues SC04 forecast availability plus true route-count families, within Claude's original Reach.

## Mobile SC02 — canonical Fund horizon (2026-09-08)

**Status:** Locally verified on `codex/mobile-sc2-fund-horizon`, stacked on SC01 `4c070cf` (PR379). Phase2 remains in progress.

**Outcome:** Exact legacy monthly fold parity and a separate inclusive horizon with one accepted anchor, every touched month, October1 obligations once, older outstanding claims and month-specific buffers. Future facts that distort undated position/goal readers refuse explicitly.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)0.

**Verification:** High quick gate67 assertions plus TypeScript/AI/diff pass in162.870seconds, no breach. Independent final29/29, no remaining blocker. Comparator mutation was killed; future goal-progress regression failed before its repair. [Exact commands and evidence](worksessions/2026-09-08-mobile-fund-horizon.md).

**Limits:** Pure fictional local command fixtures; no UI/browser, complete scenario/source availability, physical-device, exhaustive, hosted, merge or deployment claim.

**Next owner:** Codex opens the separate draft PR then continues SC03 cash-capacity/election proof inside Claude's eventual Reach.

## Mobile SC01 — scenario request contract (2026-09-08)

**Status:** Locally verified on `codex/mobile-sc1-scenario-contract`, stacked on Count `246d4a4` (PR378). Phase2 remains in progress.

**Outcome:** Explicit fixed/up-to CAD intent, dated source allocations, exact accepted scope/basis, distinct reviewed replacement references and typed refusals. Detached request review produces no projection or posting permission. The eventual consumer remains Claude's Reach.

**Risk and Dual Course:** High; Budget(5)+3; Engagement(3)+1.

**Verification:** High quick gate68 assertions, TypeScript, AI and diff checks pass in43.095seconds; no breach. Independent trust review30/30, no SC01 blocker. [Exact commands, fingerprint and boundaries](worksessions/2026-09-08-mobile-scenario-contract.md).

**Limits:** Pure local fictional fixtures. No UI or browser surface in this slice, no network/storage/command, no complete availability/model, hosted, exhaustive, merge or deployment claim.

**Next owner:** Codex opens the separate draft PR and continues SC02 canonical horizon and shared fold, then availability and scenario composition with independent reviews.

## Mobile B2 — the Count and draft recovery (2026-09-08)

**Status:** Locally verified on `codex/mobile-b2-count`, stacked on B1 `37c0cc9` (PR377). G3 remains open. No merge or deployment.

**Outcome:** Claude's three rails and exact original hierarchy, preserved cents and captured hours, canonical take-home, own-job history and full scoped draft recovery. Confirm persists one exact command identity; authoritative receipts recover late acceptance, and uncertain transport retains the frozen draft. Attendance/source details survive both entry paths.

**Risk and Dual Course:** Medium-High; Budget(5)+2; Engagement(3)+3.

**Verification:** Final quick gate148assertions, TypeScript and AI checks passed in239.180seconds, no breach. Independent recovery recheck28/28 with no remaining blocker; final selected attendance regression passes. Chromium18cases cover four widths,200% text, history, exact typing, cancellation, focus and frozen scale. [Exact evidence and commands](worksessions/2026-09-08-mobile-count.md).

**Evidence class / limits:** Local fictional components and real commands; sync receipt API mocked in actual-client tests. Full-App startup/recovery canaries run in jsdom. Tap counts21→14blank and4→4populated exclude automated scrolling; no physical phone, human elapsed-time, authenticated browser, hosted or exhaustive proof. No under-ten blank-entry claim.

**Next owner:** Codex creates the separate draft PR with G3 explicit, then continues independent Fund-scenario and mobile slices inside Claude's original surfaces. Phase2 remains in progress.

## Mobile B1 — the Cut (2026-09-08)

**Status:** Locally verified on `codex/mobile-b1-cut`, stacked on A5 `cd97dfa` (PR376). No merge or deployment.

**Outcome:** Claude's named split divider and detents, exact canonical cents, visible remainder owner, dynamic scoped defaults and stale queued ownership refusal. Preview blocks both Confirm paths until release/cancellation. Other roster sizes retain all owners.

**Risk and Dual Course:** Medium-High; Budget(5)+2; Engagement(3)+2.

**Verification:** Pre-fix mounted one-cent regression failed; repaired focused20/20 and independent rerun pass. Final quick gate102 assertions, TypeScript and AI checks passed in161.498seconds, no budget breach. Actual Add/useDialog Chromium:20 layout cases and2 gesture cases pass. [Exact commands and evidence](worksessions/2026-09-08-mobile-cut.md).

**Evidence class:** Local fictional component browser, real command/queue fixtures and full-App jsdom startup/onboarding canaries. No authenticated full-App browser, hosted, physical-device or exhaustive proof.

**Next owner:** Codex opens B1's draft PR and continues B2 Count. Phase2 remains in progress.

## Mobile A5 — apron receipt (2026-09-08)

**Status:** Locally verified on `codex/mobile-a5-apron`, stacked on A4 `c249f37` (PR375). No merge or deployment.

**Outcome:** Claude's four-fact felt receipt, one fold slot, own contributor only, six-hour expiry and separate Current Shared Ask. Historic received/owed timing, signed card-after-withholding and all tip-out timings remain accurate after payouts.

**Risk and Dual Course:** Medium-High; Budget(5)+1; Engagement(3)+2.

**Verification:** 112 quick-gate assertions, TypeScript and AI checks passed in 139.958 seconds. Final 48-case browser layout matrix follows a CSS-only restoration of the original four-fact row. Independent trust recheck passed 7/7 and found no remaining blocker. [Exact commands, evidence and limitations](worksessions/2026-09-08-mobile-apron.md).

**Evidence class:** Local fictional component Chromium and full-App jsdom startup canaries; no native lock-screen, physical-device, authenticated full-App browser, hosted or exhaustive proof.

**Next owner:** Codex opens A5's draft PR and continues B1, Claude's Cut. Phase 2 remains in progress.

## Mobile A4 — chapter spreads (2026-09-08)

**Status:** Locally verified on `codex/mobile-a4-spread`, stacked on A3 `9014a78` (PR#374). No merge or deployment.

**Outcome:** Claude's original chapter order, shared compact Shape/Streams, own unreversed tip history, explicit scopes, keyboard/swipe paging, nested Confirm and seal focus restoration.

**Risk and Dual Course:** Medium-High; Budget(5)+2; Engagement(3)+1.

**Verification:** 114 quick-gate assertions, TypeScript and AI checks passed in 89.835 seconds, no budget breach. 88 final component layout cases and two gesture/focus cases passed after refinement; 396 earlier broad cases are classified separately. Independent UX and trust rechecks found no remaining blocker. [Exact commands, source boundaries and evidence](worksessions/2026-09-08-mobile-spread.md).

**Evidence class:** Local fictional component Chromium and full-App jsdom startup/rehearsal canaries; no hosted, physical-device, authenticated full-App browser or exhaustive proof.

**Next owner:** Codex opens the separate A4 draft PR and continues A5. Phase 2 remains in progress.

## Mobile A3 — full Ledge (2026-09-08)

**Status:** Locally verified on `codex/mobile-a3-ledge-sheet`, stacked on A2 `565efd7` (PR#373). No merge or deployment.

**Outcome:** Claude's rest/half/full sheet, six-slot phone board, shared desktop stage renderer, daily member selection memory, phone Level ruler and seven-column/seven-row week. Small viewports scroll the inner content. Explicit existing actions retain Confirm; queued callbacks now refuse changed household/member/environment/view/generation before execution.

**Risk and Dual Course:** Medium-High; Budget(5)+3; Engagement(3)+2. The queue scope repair is a correctness-required expansion from presentation work.

**Verification:**146 quick-gate assertions, TypeScript and AI checks passed in102.601 seconds, no budget breach.72 component browser cases plus drag/cancel/focus/resize checks passed. Independent UX and money rechecks found no remaining blocker. [Worksession](worksessions/2026-09-08-mobile-ledge-sheet.md).

**Evidence class:** Local fictional component Chromium, pure queue commands and full-App jsdom startup/rehearsal canaries. No hosted, physical-device, exhaustive, Production or authenticated full-App browser proof. Workspace-only entries remain existing navigation rather than invented chart models.

**Next owner:** Codex opens the separate A3 draft PR and continues the original mobile program. A3 is not completion of Phase2.

## Mobile A2 — Fund grip at rest (2026-09-07)

**Status:** Locally verified on `codex/mobile-a2-ledge-grip`, stacked on A1 `01ec730` (PR #372). No merge or deployment.

**Outcome:** Claude's labelled Household Fund grip replaces the duplicate mobile Fund card and opens the Shared register from either room. Existing navigation remains intact. Onboarding and Hercules share measured clearance; their focus/invitation modes suppress the grip.

**Risk and Dual Course:** Medium; Budget (5) +1; Engagement (3) +1.

**Verification:** Medium quick gate passed 83 assertions including startup/rehearsal canaries, TypeScript and AI surface in 124.298 seconds. Chromium passed 72 component/width/scope/state cases. Independent overlay findings were repaired and rechecked. [Worksession](worksessions/2026-09-07-mobile-ledge-grip.md).

**Evidence class:** Local synthetic component browser and quick-gate proof. No full-App browser, physical-device, hosted, exhaustive or Production evidence; no money writer/schema/deployment change.

**Next owner:** Codex creates A2's separate draft PR and builds A3's full sheet immediately, as Jonathan requested. This is not completion of the mobile program.

## Mobile A1 — Claude's fold (2026-09-07)

**Status:** Locally verified on `codex/mobile-a1-fold`, baseline `6fb15c7a98f3336862bb743b836aa96a358a35b9`; isolated slice, not merged or deployed.

**Outcome:** At most four whole Home objects above Claude's dashed crease. Own active shift and warnings outrank ordinary stories. His outlined paper seals replace the old wax gradients; enlarged text spills/reflows without clipping amounts. Add remains inert and keyboard focus survives priority changes.

**Risk and Dual Course:** Medium; Budget (5) 0, Engagement (3) +2.

**Verification:** Medium quick gate passed 58 assertions, TypeScript and AI checks in 32.645 seconds. Actual-component Chromium passed 28 width/state cases, with keyboard focus and reduced motion. Independent UX findings were fixed and rechecked. [Worksession and evidence](worksessions/2026-09-07-mobile-fold.md).

**Evidence class:** Local synthetic component and quick-gate proof. Wide widths force the phone component for stress testing; they are not full-App desktop screenshots. No physical phone, hosted recovery, exhaustive, live household or Production proof. No money or schema change.

**Next owner:** Codex prepares the separate A1 PR and proceeds to A2/A3; Jonathan waived the Ledge's fortnight build gate with “just build it.” The mobile program remains in progress.

# AI Task and Handoff Standard

## QR invitation entry (D-239) (2026-09-07)

**Status:** [PR #369](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/369), implementation `3057dce`, on `codex/qr-invite-entry`, based on `fc78635`. Risk High; Jonathan approved release, migration 021 applied and hosted guards verified. Development publication follows merge; final SHA/outcome in the PR release comment.

**Outcome:** Owners can invite Someone new without a roster prerequisite. The recipient signs in, enters their name and accepts. Inactive reservation, identity-bound redemption, replacement revocation, capacity and cancelled-flow guards remain blocking. Budget delta (5): +1; Engagement delta (3): +2.

**Verification:** High quick gate 89/89, 79.569 seconds; final focused invite/discovery/account-flow tests 12/12. TypeScript, build and AI verification pass. Independent re-review found no remaining blocker. Executable local SQL plus client discovery and React coverage; details in the [worksession](worksessions/2026-09-07-qr-invite-entry.md).

**Evidence class:** Local synthetic plus hosted migration/grant/denial checks and green candidate CI. Real camera/OAuth acceptance and exhaustive proof remain unperformed.

**Next owner:** Codex merges the approved green candidate and verifies Development publication. Jonathan can then exercise QR → Google → chosen name with the recipient; full camera/OAuth acceptance remains a separate evidence limit.


> Release update, 2026-09-07: Jonathan authorized merge and Development deployment, superseding earlier holds. F1 #362 merged as 51ab7dd; F4 #363 merged as e5df73e. F3 #364 is the final release candidate; its updated-head checks and final deployment proof remain pending at this record. Production ledger activation is unchanged.

## Onboarding F3 — Development-only rehearsal access (2026-09-07)

**Status:** Local implementation on `codex/onboarding-f3-rehearsal-environment`, based on `origin/main@44c5931`. Not merged or deployed. Risk Medium.

**Outcome:** The access wrapper now returns null outside Development before rendering its locked explainer. Home and More remain unchanged for Development households.

**Risk and Dual Course:** Medium UI behavior. Budget delta (5): 0; Engagement delta (3): +1, removing Development scaffolding copy from Production presentation. No Production setting or data is changed.

**Verification:** The new static-render assertion failed before the guard, returning the locked card instead of an empty string. Medium quick gate passed: 14 fast plus 26 serial startup assertions, 281.190 seconds. TypeScript, build including Hercules Pro UI, AI verification and diff hygiene passed. Independent review found no blocker. See worksession for exact evidence and scope.

**Evidence class:** Local synthetic component rendering only. No hosted, browser, two-device, exhaustive, or Production deployment proof.

**Next owner:** Codex verification; Jonathan release decision. Apply third, after F1 and F4. Merge and verify the authorized Development deployment after updated-head checks pass.


## Onboarding F4 — mounted App stale-seat regression (2026-09-07)

**Status:** Merged via PR #363 as `e5df73e`, after updated-head checks passed. Final combined Development deployment verification follows PR #364. Risk Medium.

**Outcome:** A mounted App with a deactivated stored session member must render its shell, avoid the identity error, and commit no onboarding-offer receipt. Storage, ledger, continuity and Google doubles remain below the real command boundary. The test directly awaits React act to avoid overlapping-act warnings.

**Risk and Dual Course:** Medium regression authority. Budget delta (5): +1; Engagement delta (3): +1. No production behavior changes.

**Verification:** The new test passes with guards present and fails with Choose an active household member when App guards are removed; both Hercules-only tests remain green. App source was restored exactly. Medium quick gate passed (1 mounted-App assertion, 92.085 seconds), including TypeScript and AI verification. Independent review found no blocker. `pnpm build` passed including Hercules Pro UI; existing PGlite externalization/eval and chunk-size warnings remain non-failing; see worksession.

**Evidence class:** Local synthetic jsdom App test. No hosted, browser, two-device, exhaustive, or Production proof.

**Next owner:** Codex finishes verification. F4 merged after F1; complete F3 and verify final Development publication.

## Onboarding F1 — Suite predecessor fence (2026-09-07)

**Status:** Merged via PR #362 as `51ab7dd`, after reviewed-head checks passed. Final combined Development deployment verification follows PR #364. Risk High.

**Outcome:** Same-household ordinary books no longer receive the whole-fixture transition exemption. Legitimate Suite-to-Suite replacement and separate-household creation retain the exemption. This narrows an exemption rather than rejecting every command solely by name.

**Risk and Dual Course:** High command-authority boundary. Budget delta (5): +3, restoring ordinary transition protection. Engagement delta (3): 0, existing legitimate demo behavior preserved.

**Verification:** The new test failed on untouched runtime: expected refusal, received accepted-local. Post-fix High quick gate passed: 55 fast plus 7 serial assertions, 202.299 seconds, fingerprint ab840cf5631e700d07a9eeb9563e2f38721db68b820d9b105623cba36310841d. TypeScript and build passed. Independent review found no functional blocker; its comment-precision correction is applied. Documentation/comment-only closure followed the gate, with AI verification and diff hygiene rechecked.

**Evidence class:** Local synthetic Development command tests only. No hosted, two-device, exhaustive, browser, or Production proof.

**Next owner:** Codex completes verification and prepares the branch/PR. Jonathan authorized release; F1 is merged. Complete F4/F3 sequence and final Development publication proof.


## Onboarding audit — entry truth, resilient rendering, and preview accessibility (D-233) (2026-09-06)

**Status:** [PR #360](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/360) is the single release-candidate PR on `codex/onboarding-audit-small-repairs`, based on `origin/main@954c484d5f804d3e69436093df0277fb244baec7`. Verified implementation commit `79907a6206698d8a2eaae7c21a42993f5d282795`; this evidence/status closure follows on the same PR. Checks are pending. Jonathan authorized merge and Development deployment; nothing is merged, deployed, or hosted-live verified yet. Risk: **Medium**.

**Outcome:** The existing standalone invitation remains the only live guided-setup entry; the Development gallery is documented and tested as read-only rather than mislabeled as the entry point. At Jonathan's direction, new-household starter categories remain intact and Chapter 9 now frames the real checkbox/addition flow as curation. Hercules and App skip member-owned onboarding presentation work when a session seat is missing or inactive, while strict core identity validation remains unchanged. `nextChapterFor` and its wrappers no longer accept an unused date. Preview chapter controls include their titles, the sample action loses its ineffective description association, and every visible preview/invitation control meets the 44 px floor.

**Risk and Dual Course:** Risk **Medium** because this changes onboarding copy, render resilience, and a public selector signature without changing financial state or command authority. Budget delta (5): `+1`, protecting strict member ownership while preventing a stale session from taking down the presentation. Engagement delta (3): `+2`, making the real entry and starter-set task honest and the chapter gallery understandable to screen-reader and touch users.

**Verification:** Baseline source inspection confirmed `d0c72e1` shipped both the inert gallery and, separately, the real standalone invitation; D-228 later widened that invitation to existing books. A throwaway mounted-component regression reproduced the inactive-member crash with `Choose an active household member.` before implementation and was replaced by permanent unknown/inactive cases. The initial actual-component Chromium pass found the disabled sample action at 20 px; after repair, 320/390/720/1100 px each reported document width equal to viewport width, minimum visible control height 44 px, no undersized controls, reduced motion active, one `Start together`, 12 titled chapter buttons, no sample `aria-describedby`, zero scoped WCAG A/AA axe violations, and zero console/page errors. The temporary harness was removed. The final Medium quick gate passed in 184.647 seconds at fingerprint `e9f7227171b23681df82af3b73e4419e98649793fba13f86b41ecc35154035e6`: 162 fast and 33 serial assertions across 14 selected files, including all 26 D-183 startup cases. `test/month-rehearsal-mainline.test.ts` passed 1/1 separately. `pnpm exec tsc --noEmit`, `pnpm build` (483 Vite modules plus Hercules Pro UI), and `pnpm ai:verify` passed. `npx tsc --noEmit` was attempted but this bundled host has no `npx`; the equivalent repository command and the build's own TypeScript pass succeeded. Existing PGlite browser-externalization/eval and large-chunk build messages remain non-failing warnings.

**Evidence class:** Local synthetic Development fixtures, mounted React tests, and actual-component headless Chromium. This is not exhaustive/release, authenticated two-device, hosted-live, deployment, or Production proof. No household data, category rows, money writer, journal/budget formula, schema/migration, hosted row, Auth/RLS rule, provider/model call, secret, Production setting/data, or Worker changed. Detailed evidence: [`worksessions/2026-09-06-onboarding-audit-small-repairs.md`](worksessions/2026-09-06-onboarding-audit-small-repairs.md). Claude review packet and paste-ready prompt: [`CLAUDE_ONBOARDING_AUDIT_SMALL_REPAIRS_REVIEW.md`](CLAUDE_ONBOARDING_AUDIT_SMALL_REPAIRS_REVIEW.md).

**Next owner:** Codex waits for PR #360's required checks, resolves only in-scope blockers, merges the exact reviewed head when green, and verifies the authorized Development deployment. Production remains untouched.

## Consistent-replica materialization and compaction repair (D-232) (2026-09-06)

**Status:** [PR #359](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/359) is the single PR on `codex/continuity-replay-repair`, based on `origin/main@9758f90`. Verified implementation commit `4e8424a`; required checks are pending. Nothing is merged, deployed, or hosted-live verified. Risk: **High**.

**Outcome:** Stable Shared + Personal pulls once again attempt command-log materialization with the already resolved member id, but only after the snapshot passes the current Google/membership binding. Signed-in restores now re-read authoritative membership on every snapshot attempt and refuse a membership that disappears during the retry loop. Compacted command envelopes deduplicate and sort their top-level posted ids while retaining every command descriptor and materialization fact, so repeated row touches reach their specific replay authority checks instead of failing as malformed.

**Risk and Dual Course:** Risk **High** because this repairs authenticated continuity binding and the ledger command-log replay path. Budget delta (5): `+4`, restoring validated command replay without weakening member authority or snapshot fallback. Engagement delta (3): `+1`, avoiding needless full-snapshot recovery and refusing a revoked session truthfully.

**Verification:** Untouched `origin/main@9758f90` reproduced all three missing-net failures: the consistent-member pull made zero command-event reads, a membership removed during retry still returned a stable replica, and `test/ask-goal-move.test.ts` returned `malformed-command-envelope` instead of its command-specific authority refusal. The first two trace to `aa6ca41`; the duplicate-id compaction defect is independently present at `85bafff`, before onboarding Slice 23. After the repair, the three focused files pass 26/26, including a valid compacted envelope whose two descriptors touch one recurrence and still apply, while the two-move authority case keeps its original `ask-goal-move-authority-mismatch` expectation. The eight-file continuity, materialization, startup, and D-183 rehearsal set passes 72/72. The final High quick gate passed 114/114 assertions in 211.268 seconds at fingerprint `867b5a780abdefb854b3ef4facfa4d9ffbcd8a534e586ff42e2848d09fca0369`, including TypeScript, AI-surface, discovery, diff, the permission matrix, and the seven-test serial trust matrix. `pnpm exec tsc --noEmit`, `pnpm build` (483 Vite modules plus Hercules Pro UI), and `pnpm ai:verify` pass. The host has no `npx`, so the equivalent `pnpm exec tsc` spelling was used. Existing PGlite browser-externalization/eval, mixed-import, and large-chunk build messages remain non-failing warnings.

**Evidence class:** Local synthetic client-side identity, REST-adapter, command-materialization, and App-startup tests. This is not exhaustive/release, hosted-row, browser, authenticated two-device, deployment, or Production proof. No schema, migration, hosted row, Auth/RLS rule, secret, provider/model call, Production setting/data, Worker, or financial formula changed. Detailed evidence: [`worksessions/2026-09-06-continuity-replay-repair.md`](worksessions/2026-09-06-continuity-replay-repair.md).

**Next owner:** Codex waits for all required PR checks, triages any in-scope blockers, and merges the exact reviewed head when green. Deployment remains unauthorized.

## Onboarding lifecycle convergence repair (D-231) (2026-09-06)

**Status:** [PR #358](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/358) is the single PR on `codex/onboarding-lifecycle-convergence`, based on `origin/main@8eff077`. Verified implementation commit `31a2a1b`; required checks are pending. Nothing is merged, deployed, or hosted-live verified. Risk: **High**.

**Outcome:** A forced unlock now wins only when its timestamp is strictly newer than the competing non-forced lifecycle fact. A newer completed record therefore survives stale forced state in either merge order, while a genuinely newer forced unlock still produces `stopped-incomplete`. Household-onboarding shaping and migration planning now share the same registry-version reader, so invalid versions consistently normalize to version 0 and request repair.

**Risk and Dual Course:** Risk **High** because this changes lifecycle convergence and recovery authority. Budget delta (5): `+2`, preserving accepted setup metadata under stale replica delivery. Engagement delta (3): `+2`, preventing completed households from relocking Hercules and reopening the Personal track incorrectly while retaining the intentional Development escape hatch.

**Verification:** Untouched `origin/main@8eff077` reproduced six failures: the older forced replica erased completion, four invalid version shapes disagreed with a `current` plan, and negative version normalization disagreed on `fromVersion`. The legitimate newer forced unlock and 17 unaffected lifecycle assertions passed before the fix. After the repair, lifecycle, onboarding-mode, and onboarding-progress pass 50/50 without fixture edits; the complete 33-file onboarding lane passes 481/481. The final High quick gate passed 88/88 assertions in 98.557 seconds at fingerprint `32c025de7fbae8f219afbb01650dd8afed85bae41cfc74d5c5b7cab81cdfc007`, including TypeScript, AI-surface, discovery, diff, and the seven-test serial trust matrix. `pnpm exec tsc --noEmit`, `pnpm build` (483 Vite modules plus Hercules Pro UI), and `pnpm ai:verify` pass. The host has no `npx`, so the equivalent `pnpm exec tsc` spelling was used. Existing PGlite browser-externalization/eval, mixed-import, and large-chunk build messages remain non-failing warnings.

**Evidence class:** Local synthetic Development fixtures and pure core convergence tests. This is not exhaustive/release, browser, authenticated two-device, hosted-live, deployment, or Production proof. No money writer, journal/budget formula, migration/schema, hosted row, Auth/RLS rule, provider/model call, secret, Production setting/data, push, merge, or deploy changed. Detailed evidence: [`worksessions/2026-09-06-onboarding-lifecycle-convergence.md`](worksessions/2026-09-06-onboarding-lifecycle-convergence.md).

**Next owner:** Codex waits for all required PR checks, triages any in-scope blockers, and merges the exact reviewed head when green. Deployment remains unauthorized.

## Onboarding finale fail-closed repair (D-230) (2026-09-06)

**Status:** [PR #357](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/357) is the single release-candidate PR on `codex/onboarding-gates-fail-closed`, based on `origin/main@157afbb69564ddaa376e3568fbbe7845b557a0da`. Verified implementation commit `b25b047affaf6f531cfb0025934831cdfae04369`; this evidence/status closure follows. Checks are pending. Nothing is merged, deployed, or hosted-live verified. Risk: **High**.

**Outcome:** The finale now evaluates all active members, treating missing or rejected Personal progress as unsatisfied instead of dropping the member. New-member catch-up is limited to genuinely absent progress; malformed or stale stored progress returns empty and requests registry repair. Ready approval reads shaped progress and rejects invalidated Chapter 12 proof.

**Risk and Dual Course:** Risk **High** because this changes setup-completion authority. Budget delta (5): `+4`, closing three paths that could authorize completion without durable valid proof. Engagement delta (3): `+1`, keeping legitimate new-member catch-up and real two-member completion intact while routing corrupt state to repair.

**Verification:** Untouched `origin/main@157afbb` failed four new assertions exactly as reported: missing/stale active-member progress returned no gates, malformed stored progress inherited completion, and invalidated Ready proof passed its direct fence. After the repair, the three focused files pass 31/31. The first complete onboarding run passed 471/472; its only failure was a second existing UI fixture that supplied Bianca's proof while leaving Jonathan undefined. Correcting that fixture to model both members' completed work produced a clean 472/472 rerun. The invalidated-Ready case was then strengthened to cross the real accepted-write boundary and passes. Temporarily restoring only the old raw-row/timestamp Ready check made that exact case fail because the write returned `ok: true`; restoring the candidate made it pass as `validation-rejected`, and the final diff check passes. The final High quick gate passed in 59.411 seconds at fingerprint `915883b94424f9f6ced91f118972f5fb8771f17952aa39d2c3a391e9a7ced635`: 66 fast assertions and the 7-test serial trust matrix, plus diff, AI-surface, TypeScript, and discovery checks. `pnpm exec tsc --noEmit`, `pnpm build` (483 Vite modules plus Hercules Pro UI), and `pnpm ai:verify` pass. The host has no `npx`, so the equivalent `pnpm exec tsc` spelling was used. Existing PGlite browser-externalization/eval and large-chunk build messages remain non-failing warnings.

**Evidence class:** Local synthetic fixtures, direct core/runtime tests, and jsdom component coverage. This is not exhaustive/release, browser, authenticated two-device, hosted-live, deployment, or Production proof. No money writer, journal/budget formula, migration/schema, hosted row, Auth/RLS rule, provider/model call, secret, Production setting/data, push, merge, or deploy changed. Detailed evidence: [`worksessions/2026-09-06-onboarding-finale-fail-closed.md`](worksessions/2026-09-06-onboarding-finale-fail-closed.md).

**Next owner:** Codex waits for PR #357's required checks and merges only the unchanged reviewed head under Jonathan's explicit authorization. Deployment remains unauthorized.

## Onboarding audit — entry and rehearsal test-net repairs (D-229) (2026-09-06)

**Status:** [PR #356](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/356) is the single release-candidate PR on `codex/onboarding-test-net-repairs`, based on `origin/main@a3b6124f1211f511453241d88c2e021255caf34c`. Verified implementation commit `e86f2f5bbdd24faec94f064e6176dfd41a8ff62c`; this evidence/status closure follows. Checks are pending. Nothing is merged, deployed, or hosted-live verified. Risk: **Medium**.

**Outcome:** The mounted onboarding entry integration test now executes the real `acceptHouseholdWrite` validators while storage, continuity, Google, and ledger adapters remain in memory. Accepted candidates are observed through persistence rather than by replacing the command boundary. A dedicated Demo Table seed case crosses that real boundary and proves an active member choice survives acceptance. The rehearsal preflight uses a stable `data-testid` for its Start control while retaining separate copy coverage. Production behavior is unchanged.

**Risk and Dual Course:** Risk **Medium** because this changes regression authority around the accepted-books boundary, with one inert DOM test hook. Budget delta (5): `+1`, making onboarding entry tests capable of catching validator refusals before merge. Engagement delta (3): `+1`, protecting the Demo Table member entry and rehearsal start flow from silent test gaps.

**Verification:** Untouched main reproduced the rehearsal defect: both preflight UI cases failed with `Missing Start our month button`. The original onboarding entry integration suite passed 4/4 while its always-accept replacement still bypassed all runtime validation. Mutation proof then removed the full PR #354 command-runtime demo exemption temporarily: the new Demo Table case failed with `ok: false` and `postedNothing: true`. Restoring the exact source made that case pass, and `git diff --exit-code -- src/core/commandRuntime.ts` confirms no mutation remains. The final entry integration suite passed 6/6, including a mounted Demo Table member selection into Home. The Medium quick gate passed in 75.879 seconds at fingerprint `c1dece9de262bf7a052000ac93e4d77d7bc6a8f9ef9b4a36e48aafa66528ee10`: 16/16 fast and 26/26 serial assertions, including `test/app-swift-demo-entry.test.ts` and D-183's `test/app-startup-p1.test.ts`. `pnpm exec tsc --noEmit`, `pnpm build` (483 Vite modules plus Hercules Pro UI), and `pnpm ai:verify` pass. Existing PGlite browser-externalization/eval and large-chunk build messages remain non-failing warnings.

**Evidence class:** Local synthetic Development fixtures, real command-runtime acceptance, mounted jsdom application paths, and static component rendering. This is not an exhaustive/release gate, browser/live UI, authenticated two-device, hosted-live, deployment, or Production proof. No money writer, journal/budget formula, schema/migration, hosted row, Auth/RLS rule, provider/model call, secret, Production setting/data, or deploy changed. Detailed evidence: [`worksessions/2026-09-06-onboarding-test-net-repairs.md`](worksessions/2026-09-06-onboarding-test-net-repairs.md).

**Next owner:** Codex waits for PR #356's required checks and merges only the unchanged reviewed head under Jonathan's explicit authorization. Deployment remains unauthorized.

## Existing-books guided onboarding adoption (D-228) (2026-09-06)

**Status:** [PR #355](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/355) is the single release-candidate PR on `codex/onboarding-existing-books-adoption`, based on `origin/main@d26f1254007e009a390c28c7f8aca6ecb920e58d`. Implementation commit `a7626d6fa1ea292487a058b1ebbf047a95b1748e`; this evidence/status closure follows. Checks are pending. Nothing is merged, manually deployed, or hosted-live verified. Risk: **High**.

**Outcome:** Every household whose accepted onboarding mode is absent or inactive can receive guided setup after its local books validate. Once both people activate the run, each member's own device adopts only accepted canonical evidence that predates activation, recording exact observation/key proof without acknowledgement or completion. Chapters 1, 2, 8, and 12 remain live. Home and More share one rehearsal access component and both explain the lock until real setup completion.

**Risk and Dual Course:** Risk **High**. Budget delta (5): `+3`, restoring a path from existing accepted books through setup to the D-183 rehearsal without changing financial meaning or Final Confirm. Engagement delta (3): `+2`, removing needless re-entry and making the setup/rehearsal path visible in both contexts.

**Verification:** Final focused lifecycle/entry/rehearsal run passes 24/24 and the mandated startup lane passes 26/26. The High quick gate passes in 107.401 seconds at fingerprint `c7a96af653e4d3f5209f17b34470d0ef50c4da812a809e88dea22ceddf165f88`: 80 fast and 33 serial assertions across eight selected files, including `test/onboarding-entry-integration.test.ts` and `test/app-startup-p1.test.ts`. `pnpm exec tsc --noEmit`, `pnpm build` (483 Vite modules plus Hercules Pro UI), and `pnpm ai:verify` pass. The host has no `npx`, so the equivalent `pnpm exec tsc` spelling was used. Local Chromium on the existing Development household showed exactly one `Start together` action and one locked rehearsal explanation after journal validation; at 390×844 it had no horizontal overflow, keyboard Tab reached the action, and the console had no errors.

**Evidence class:** Local synthetic fixtures, core commands, mounted App/component tests, and application-path Chromium. Browser use persisted only the intended offer metadata to the existing local Development household. This is not exhaustive/release, authenticated two-device, hosted-live, deployment, or Production-data proof. No money writer, journal/budget formula, migration/schema, hosted row, Auth/RLS rule, provider/model call, secret, Production setting/data, push, merge, or deploy changed. Detailed evidence: [`worksessions/2026-09-06-onboarding-existing-books-adoption.md`](worksessions/2026-09-06-onboarding-existing-books-adoption.md).

**Next owner:** Codex waits for PR #355's required checks and merges only the unchanged reviewed head under Jonathan's explicit instruction. No manual deployment is authorized.

## Onboarding audit Step 1 — seeded demo approval acceptance (D-227 why-note) (2026-09-06)

**Status:** [PR #354](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/354) remains the single PR on `codex/onboarding-demo-approval-repair`, based on `origin/main@9057d7285e449816e7e4dbd81799f48959329d4c`. Corrected implementation commit `76ea1423e5513646a96d64f9c557fed79d9acda4`, the local High gate, production build, browser use, independent review, and its PR checks pass; this evidence-only closure follows. Deployment is explicitly unauthorized. Release review is **CONDITIONAL**.

**Outcome:** The welcome Demo Table keeps its existing no-special-command App call and accepts its deterministic completed two-member onboarding proof on the first write. An explicit Demo Suite may create or replace its whole synthetic fixture while another household is open, including `preserveDemoShowcaseContinuity` output and a same-id ordinary predecessor. Repeated actions retain fresh confirmation ids.

**Authority:** `seededOnboardingApprovalsValid` requires Development, a complete accepted onboarding record, a `ready-demo-v1-<sha256>` digest, exactly two active members, exactly those two confirmed member ids, exactly two matching Ready approvals, and a satisfied row for every household chapter for both members. Demo Suite commands additionally require `syntheticFixture.kind === "hearth-demo-suite"`; replacement requires an active actor in both old and new books. Both paths require zero posted ids. Demo Table acceptance is limited to the initial absent/generic `commit`, null previous, and no fixture. Explicit ordinary proposal/Ready approvals always run `assertOnboardingApprovalTransition`. Candidate Fund, household/journal, ingest, persistence, and requested synchronization validation remain in force; Final Confirm is unchanged.

**Risk and Dual Course:** Risk **High**. Budget delta (5): `+2`, restoring validated demo acceptance without changing balances, posting, budget formulas, account semantics, or Final Confirm. Engagement delta (3): `+3`, restoring immediate access through the Demo Table and Demo Suite create/replace flows.

**Verification:** Untouched `origin/main@9057d72` was reproduced first in a throwaway test: both user-supplied calls returned `validation-rejected`, `postedNothing: true`, and `Only you can approve for yourself.` The corrected lifecycle/UI/App focus passed 18/18; the focused generated-suite runtime case passed 1/1. The final High quick gate passed in 221.446 seconds, within budget, at fingerprint `0d22a06b8ad6a84f19202ad46bb825342c09bbd2f44afbf7af6c394f770b3d77`: 49 fast assertions, the 7-test trust matrix, and all 9 serial Demo Suite cases. `pnpm exec tsc --noEmit`, `pnpm build` (482 Vite modules plus Hercules Pro UI), and `pnpm ai:verify` passed; the bundled host has no `npx` binary, so the requested `npx tsc` spelling was unavailable. Independent read-only review returned PASS with no P0-P3 findings after its separate 40/40 plus focused Suite run. Local Chromium on the exact candidate crossed the old approval boundary but encountered the existing worker-backed PGlite open/operation timeout. With only the worker selector temporarily forced to the repository's existing direct-browser PGlite fallback, the same UI opened the Demo Table, selected Jonathan, and visibly rendered Home; the diagnostic line was immediately restored and has no diff.

**Evidence class:** Local Development fixtures, real command-runtime tests, and application-path browser proof through direct PGlite. This is not worker-backed browser proof, exhaustive/release evidence, Windows, authenticated Google/Supabase, hosted-live, deployment, or Production proof. No money writer, journal/budget formula, schema, hosted row, Auth/RLS rule, secret, provider setting, Production data, or deploy changed. Detailed evidence is in [`worksessions/2026-09-06-onboarding-demo-approval-repair.md`](worksessions/2026-09-06-onboarding-demo-approval-repair.md).

**Next owner:** Jonathan decides whether to authorize the automatic Development deployment required by merge. Until then, PR #354 stays open and unmerged because `.github/workflows/pages.yml` deploys the Development Worker on every push to `main`, conflicting with the explicit no-deployment boundary.

## Onboarding Slice 27 — lifecycle and re-runs (D-227) (2026-09-05)

**Status:** Release candidate implementation and proof are complete on `onboarding/27-lifecycle`, based on `origin/main@e85599c135523034526661e0d381ebaa005fb7ee`. Jonathan authorized push, merge, and the Development Worker deployment; hosted-live proof remains part of the release run. Risk: **High**.

**Outcome:** Completed household setup is now sticky rather than a standing gate. Charter changes and stale stopped replicas cannot reopen it. A replacement member receives only a private Ch. 1, live Ch. 2, and self-owned Ch. 8 catch-up; existing members stay in ordinary Hearth. Environment mismatch starts inactive, registry drift enters repair, unknown chapter ids fail closed, and a stopped run demotes evidence that no longer matches current canonical state.

**Demo and authority:** Both demo generators stamp deterministic synthetic completion and two Ready approvals, so a demo never opens in setup. Demo creation accepts that metadata only through a narrow Development/provenance/two-seat/all-chapters/two-approval proof. Financial fixture facts remain hash-covered; portable onboarding identity is normalized with other household identity. Hercules says he never posts or confirms, and Final Confirm remains the only money boundary.

**Verification:** The 33-file onboarding suite plus demo seed passes 463/463. The isolated eight-case Demo Suite matrix passes deterministic replay, all domain/Hercules surfaces, tamper detection, privacy, environment/replacement refusal, shared merges, profiles, and Toronto DST. Actual-component Chromium at 320/390/720/1100 px passes overflow, 44 px controls, reduced motion, console/page errors, and scoped WCAG A/AA axe checks; `Not now` returns the replacement member to ordinary Hearth, and unavailable live Ch. 2 proof stays held up. Release review found and repaired an old-replica convergence edge case after a successful re-probe; its regression and the exact-head release gate pass. Clean gate and production-build evidence are in [`worksessions/2026-09-05-onboarding-lifecycle.md`](worksessions/2026-09-05-onboarding-lifecycle.md).

**Evidence class:** Synthetic local Development fixtures and local verification before release. This is not Windows, hosted two-account, or Production proof. No money writer, journal, budget formula, schema, hosted row, Auth/RLS rule, provider/model call, secret, or Production setting was touched.

**Next owner:** The release run pushes the branch, waits for required checks, merges it, waits for the `main` Development deployment, and smokes the exact hosted artifact. A separate-agent or human trust review remains desirable because only the structured release review was available here.

## Onboarding Slice 26 — opt-in Personal track (D-226) (2026-09-05)

**Status:** Local implementation is complete on `onboarding/26-personal` at `4495386b74da1249d3a6afc535e5ca172cad5cdc`, based on `origin/main@58e90df5f40dfdba1399f6a8f35c8efe8fb62c15`. Nothing is pushed, merged, deployed, or hosted-live verified. Risk: **Low**; the repository quick-gate floor ran it as Medium.

**Outcome:** Six optional Personal guides now appear contextually through ordinary Hercules after household unlock: own books, shifts, the tip oracle, a Personal plan, the desktop office, and Hercules itself. Each trigger is a pure typed-state predicate scoped to the current member. Opening a destination keeps the guide resumable; only `Got it` completes it. `Not now`, per-module skip, and a member-owned mute remain immediately available. No Personal guide locks Hearth or contributes to `householdGatesOutstanding()`.

**Privacy and frequency:** Offers, declines, skips, completion, and mute state persist only in the acting member's Personal onboarding envelope. Commands refuse cross-member writes. An append-only offer history converges across devices and enforces one offer per session, two per civil week, and per-module suppression after two declines in the same civil month without carrying an old month's count forward. Partner-Personal transactions and shifts cannot satisfy the viewer's triggers.

**Verification:** The complete 33-file onboarding/command suite passes 481/481. The final change-focused quick gate passes TypeScript, AI-surface and diff checks, 78 fast tests, and 7 serial PGlite proof tests in 41.1 seconds. The production build passes with 478 Vite modules plus Hercules Pro UI; existing PGlite browser-externalization, eval, and large-chunk messages remain warnings. Live actual-component Chromium verified the mobile Hercules entry, same-session silence after navigation, desktop bubble entry, all six variants, saving state, focus wrapping, reduced motion, and 44 px minimum controls at 320/390/720/1100 px. At 320 and 390 px the focus shell uses its existing controlled inner scroll; there is no body-width overflow. No console warning or error remained on the clean final harness load.

**Evidence class:** Synthetic local Development fixtures, focused and adjacent tests, change-focused quick gate, local build, and actual-component browser proof. PowerShell is unavailable on this macOS host. This is not exhaustive-suite, Windows, hosted two-account, deployment, or Production proof. No transaction writer, journal, budget, schema, hosted row, Auth/RLS, secret, provider/model call, Production setting, push, merge, or deploy was touched.

**Next owner:** Jonathan separately decides whether to push and merge. Deployment requires another explicit instruction. Slice 27 may build lifecycle and new-member behavior on this Personal track.

## Onboarding Slice 25 — Chapter 12 Ready and unlock (D-225) (2026-09-05)

**Status:** Local implementation is complete on `onboarding/25-ch12-ready` at `c1664bf5f59089b4ff26cc96f257b60cfb76d743`, based on `origin/main@146dc1a7160d163ea911321aa2034cf4324c44d8`. Nothing is pushed, merged, deployed, or hosted-live verified. Risk: **High**.

**Outcome:** Chapter 12 closes on a dedicated Books and Health finale. A member can use privacy-safe accepted transaction evidence or a discarded `$45` correction Practice. The screen shows the twelve-item household gate checklist, current Books/Health truth, each member's own exact-digest Ready action, a named waiting state, interrupted-completion repair, and an honest post-unlock summary plus optional Personal-track offer. Contract: [`briefs/ONBOARDING_SLICE_25_CH12_READY_CONTRACT_2026-09-05.md`](briefs/ONBOARDING_SLICE_25_CH12_READY_CONTRACT_2026-09-05.md).

**Authority, privacy, and recovery:** Practice remains outside every accepted financial projection and can only become an unconfirmed real draft. Ready approvals are self-owned and Shared; Chapter 12 progress is member-Personal. Completion requires all gates and both current approvals for one deterministic digest over the shared setup facts. `completeHouseholdOnboarding` changes metadata only, and accepted complete state converges forward over an interrupted active replica. No financial writer, proposal/adoption formula, schema, hosted record, provider, Auth/RLS, or Production setting changes.

**Verification:** Focused Slice 25 proof passes 30/30 and the complete onboarding suite passes 438/438. The High quick gate passes in under 40 seconds with 120 fast and 7 serial PGlite proof tests, TypeScript, AI-surface, discovery, and diff checks. The production build passes with 477 Vite modules plus Hercules Pro UI. Actual-component Chromium at 320/390/720/1100 px has no overflow, undersized control, console/page error, or scoped WCAG A/AA axe finding; keyboard/focus, reduced motion, busy, Practice-empty, waiting, completion, failure, and offline states pass. Screenshots were visually inspected. Full evidence is in [`worksessions/2026-09-05-onboarding-ready-unlock.md`](worksessions/2026-09-05-onboarding-ready-unlock.md).

**Evidence class:** Synthetic local Development fixtures and local verification. This is not exhaustive-suite, Windows, hosted two-account, deployment, or Production proof. No hosted row, schema, secret, provider, Production setting, push, merge, or deploy was touched.

**Next owner:** Jonathan separately decides whether to push and merge. Deployment requires another explicit instruction.

## Onboarding Slice 24 — Chapter 11 first plan (D-224) (2026-09-05)

**Status:** Release candidate implementation and proof are complete on
`onboarding/24-ch11-plan` at implementation commit
`5730361d5ff214202c55eff5a951cc70a43d3006`, rebased onto
`origin/main@6056cceedebb9a4611e7f5c70c45c1105e562e4d`. Jonathan authorized
push and merge; deployment and hosted-live verification remain separate. Risk:
**Medium**.

**Outcome:** Chapter 11 opens a dedicated calm Plan surface. It shows both
authored monthly estimate sets without comparing members, the exact eligible
recurrence occurrences and floor, accepted run-rate evidence or its honest
absence, each frozen basis, every proposed amount, and the total. With no
accepted capacity fact, it says so rather than inventing one. Each member edits
and approves only for themselves; a changed estimate or current plan snapshot
retires prior approval authority. A separate Adopt action appears only after
both current-version approvals. Contract:
[`briefs/ONBOARDING_SLICE_24_CH11_CONTRACT_2026-09-05.md`](briefs/ONBOARDING_SLICE_24_CH11_CONTRACT_2026-09-05.md).

**Authority, evidence, and recovery:** Adoption still invokes D-223's atomic
command and remains the only plan-write boundary. Completion requires the
current Toronto civil month's exact receipt plus unchanged active posted plan
rows; direct acknowledgement derives that month at the command boundary.
Receipt evidence is labelled as receipt provenance. A known pre-acceptance
rejection may offer ordinary retry and says nothing changed; an
accepted-but-unsaved result says recovery is required and cannot offer another
adoption. No transaction, journal row, transfer, Fund event, Personal fact,
provider/model call, schema, or hosted record is added.

**Verification:** Slice component proof passes 16/16; independent review ran
six files at 96/96 and reports no remaining P0-P2 finding. The final 27-file
onboarding suite passes 426/426. The exact clean implementation SHA passes
the Medium quick gate in 122.1 seconds: 119 fast plus 7 serial PGlite proof
tests, TypeScript, AI-surface, discovery, and diff hygiene. The production build
passes at 475 Vite modules plus Hercules Pro UI. Actual-component Chromium at
320, 390, 720, and 1100 px has no overflow, undersized control, console/page
error, or scoped axe WCAG A/AA violation; keyboard edit and associated invalid
input recovery pass. Mobile and desktop screenshots were visually inspected.

**Evidence class:** Synthetic local Development fixtures, focused/adjacent
tests, exact clean-head Medium gate, local build, actual-component browser
proof, and independent review. This is not full-suite, Windows, hosted
two-account, deployment, or Production proof. PowerShell is unavailable on
this macOS host, so no Windows result is claimed. No hosted row, schema, secret,
provider, Production setting, or deploy was touched.

**Release decision:** Jonathan authorized push and merge on 2026-09-05. Do not
deploy without a separate explicit instruction.
## D-212 explicit cloud-repair opener retirement (2026-09-05)

**Status:** Active Release-risk repair on `codex/pglite-explicit-repair-cancel`,
rebased onto `origin/main@146dc1a7160d163ea911321aa2034cf4324c44d8` at
runtime implementation commit `4dfde475809efa072531961ec8d1287d01e1e76a`.
Development still serves `main@6056cceedebb9a4611e7f5c70c45c1105e562e4d`.
The implementation is committed locally with a **CONDITIONAL** release review.
No new PR is open, and nothing from this repair is merged or deployed.
Production continuity remains off.

**Observed failure:** Jonathan's phone committed a Shared `postEntry` as hosted
revision 26 at `2026-09-05T06:15:15.57714Z`, but the Mac stayed on revision 25.
The fresh Mac page owned only one worker/client lock set and timed out while that
worker never completed PGlite readiness. IndexedDB itself opened normally, so
this is unfinished local-engine initialization rather than proof of corruption.

**Repair and boundaries:** Routine twelve-second timeouts keep reusing one raw
opener. The explicit authenticated cloud restore can now retire this page's
exact opener, including a handle that arrives after cancellation, then close it
before one replacement opens. A per-environment barrier spans restart,
transactional full projection replacement, and inspection; routine opens wait,
matching repairs coalesce, and recovery interruption is typed
`local-engine-busy`. Repair does not delete IndexedDB. App adoption runs on the
write queue and rechecks household, member, environment, scope generation,
outbox generation, and conflicts before replacement and adoption. Shared plus
the signed-in member's Personal envelope still pass isolated PGlite validation
first. No financial command, formula, cloud transport, schema, hosted row,
secret, provider, or Production setting changes.

**Risk and Dual Course:** Risk **Release**. Budget delta (5): `+5`, restoring
the accepted-books gate between cloud commit and receiver paint. Engagement
delta (3): `+1`, replacing a dead-end browser repair loop with a bounded member
action. Books still win: revision 26 is durable cloud evidence, not a successful
latency sample, until the Mac accepts and paints it.

**Verification so far:** The expanded `test/books.test.ts` passes **43/43**,
covering retained routine opener semantics, late-handle disposal,
close-before-replacement, typed concurrent inspection, repair exclusion,
matching-repair coalescing, and reset cancellation. The focused authenticated
restore test passes, including failed-rebuild no-save behavior and repair before
save. The Release quick gate passed **161/161** selected tests plus AI surface,
TypeScript, discovery, and diff hygiene; its serial lane crossed the five-minute
soft budget, so the recorded classification is `quick-gate-passed;
time-budget-breached`. The production build passed at 473 Vite modules plus
Hercules Pro UI and the redirect guard. Independent re-review reports **PASS,
no remaining P1/P2 release blocker**. The exhaustive full gate was not run
because Jonathan did not explicitly request it for this exact SHA; PR CI and
live Development proof remain required.

**Next action:** Finish exact-tree release verification and review, then open a
PR. Jonathan must separately authorize that PR's merge and Development-only
deployment. After deployment, the Mac restore needs action-time confirmation
before replacing its disposable local projection; then repeat a fresh calibrated
phone-to-Mac witness. No sub-one-second claim exists yet.
## Onboarding Slice 22 — self-owned exact-digest approvals (D-222) (2026-09-04)

**Status:** Local implementation and proof are complete on
`onboarding/22-approvals` at implementation commit
`e84b72506b992ec4d2d5c2b111f1b308082fa11c`, based on
`origin/main@e49e3ec10e89d2e64225fb472067a31743f51b29`. Nothing is pushed,
merged, deployed, or hosted-live verified. Risk: **High**.

**Outcome:** Each active member may append only their own proposal or Ready
approval for one exact digest. Both approval requires exactly two active seats
on that same household, scope, and digest. Older records remain auditable but
cannot authorize changed meaning. Contract:
[`briefs/ONBOARDING_SLICE_22_APPROVALS_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_22_APPROVALS_CONTRACT_2026-09-04.md).

**Authority, privacy, and money boundary:** Direct commands, accepted-write
validation, and command-event replay bind the actor, command kind, household,
and posted approval id. Approvals travel only through Shared continuity and
contain no Personal source facts. Chat text cannot approve. Fund-configuration
consent remains separate. The slice changes no budget plan, transaction,
journal row, Fund event, accepted financial hash, provider, or model state.

**Verification:** Focused proof passes 14/14. Approval, adjacent onboarding,
and continuity suites pass 164/164; the High quick gate passes TypeScript,
AI-surface verification, diff hygiene, fast tests, and serial PGlite proof. The
production build passes at 471 Vite modules plus Hercules Pro UI. Independent
High-risk review drove adversarial activity, replay, compacted-provenance,
identity, and malformed-envelope repairs, then reported no remaining P0-P2
finding. No component or CSS changed, so
there is no browser UX surface in this slice. `pnpm check:windows` depends on a
PowerShell-capable host; no Windows result is claimed here.

**Evidence class:** Synthetic local Development fixtures, focused/adjacent
tests, exact clean-head quick-gate, local build, and independent review. This is
not a full-suite, Windows, hosted two-account, deployment, or Production claim.
No hosted row, schema, secret, provider, or Production setting was read or
changed.

**Next owner:** Jonathan separately decides whether to push or open a PR.

## Onboarding Slice 20 — Chapter 10 first estimates (D-220) (2026-09-04)

**Status:** Local implementation and proof are complete at
`1429142beb8fd33089d2e68100f0bda708ad0488` on
`onboarding/20-ch10-estimates`, based on unchanged
`origin/main@8b035ffaaf75f60dcebfc9cf1b08a448f69d1ba9`. Nothing is pushed,
merged, deployed, or hosted-live verified. Risk: **Medium**.

**Outcome:** Each person gives a private first monthly guess for every accepted
household category. Blank is preserved as not estimated and zero remains
`$0.00`. One submission waits without revealing the other. Both current
submissions reveal two author-labelled lists without a total, ratio, ranking,
or comparison. Contract:
[`briefs/ONBOARDING_SLICE_20_CH10_ESTIMATES_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_20_CH10_ESTIMATES_CONTRACT_2026-09-04.md).

**Authority, privacy, and money boundary:** Drafts are keyed to the household
and active member and remain component-local until Submit. Each estimate
submission stores the exact accepted category-id set reviewed, so offline clock
skew cannot make an old set current. Direct command, accepted-write validation,
and command-event replay fail closed on pending/mismatched scopes. The chapter
creates no budget plan, transaction, journal entry, Fund event, contribution,
commitment, or approval.

**Verification:** 142 focused and adjacent tests pass, including clock
skew, pending-category race, forged replay, member-switch draft isolation,
field-specific invalid-input recovery, convergence, evidence, and no-money
cases, plus forged accepted-write rejection. The exact clean implementation SHA
passed the Medium quick gate in 53.3 seconds: 69 fast plus 7 serial PGlite proof
tests, TypeScript, AI-surface, and diff hygiene. `pnpm ai:verify` and the
469-module production build also pass. Actual-component browser proof covers
draft, invalid, waiting, changed-set, and
two-author reveal states at 320, 390, 720, and 1100 px: no horizontal overflow,
48 px controls, keyboard-only Submit, field focus recovery, reduced motion,
clean console, and zero scoped axe WCAG A/AA violations. `pnpm check:windows`
could not start because this macOS host has no `pwsh`; no Windows result is
claimed. An independent read-only audit's four scope, replay, draft-isolation,
and invalid-field findings are fixed and covered by the 142-test adjacent suite.

**Evidence class:** Synthetic local Development fixtures, focused/adjacent
tests, local build, and actual-component local browser proof. This is not a
full-suite, Windows, hosted two-account, deployment, or Production claim. No
hosted row, schema, secret, provider, or Production setting was read or changed.

**Next owner:** Jonathan separately decides whether to push or open a PR.

## Onboarding Slice 19 — Chapter 9 category selection (D-219) (2026-09-04)

**Status:** Local implementation and proof are complete at
`0d21cc41b0d745c0cf20d126473cca44d16bedbc` on
`onboarding/19-ch9-categories`, based on
`origin/main@f5ef04722830b5661c4f312da6e5ca5b5f5f84b6`; not pushed, merged,
deployed, or hosted-live verified. Risk: **Medium**.

**Outcome:** Each person privately chooses what the household plan should cover.
One submitted list waits without revealing the other. Both current lists reveal
one deterministic household set and the authored lists without comparison.
Submitted ideas remain staged until a reviewed merge creates each accepted
canonical category once. Contract:
[`briefs/ONBOARDING_SLICE_19_CH9_CATEGORIES_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_19_CH9_CATEGORIES_CONTRACT_2026-09-04.md).

**Authority, privacy, and money boundary:** Drafts stay in component state.
Proposal and merge facts are Shared only at explicit commands and are bound to
the active actor, household, and current submissions. Same-name/different-id
alternatives require an explicit choice. Newly canonical categories travel with
the merge event. No estimate, budget amount, transaction, journal entry, Fund
event, contribution, or approval is created.

**Verification:** 122 focused and adjacent tests pass, including the
Slice 19 private/wait/reveal/conflict/merge, accepted-command, command-event, and
no-journal cases. Actual-component browser proof covers draft, waiting, review,
and done at 320, 390, 720, and 1100 px: no horizontal overflow, controls are at
least 46 px, reduced motion removes transitions, keyboard Enter adds an idea,
Submit reaches the waiting state, and scoped axe scans report no violations.
Temporary QA files were removed. The exact clean implementation SHA passed the
Medium quick gate in 25.4 seconds: 85 fast plus 7 serial PGlite proof tests,
TypeScript, AI-surface, and diff hygiene, with no five-minute breach. The
production build passed at 467 Vite modules plus Hercules Pro UI; `pnpm
ai:verify` passed 48 required files and both Clerk fences. `pnpm check:windows`
could not start because this macOS host has no `pwsh`, so no Windows result is
claimed.

**Evidence class:** This is focused/adjacent tests, exact clean-head Medium
quick-gate, local production build, and actual-component local browser proof.
It is not a full-suite, Windows, hosted two-account, deployment, or Production
claim. All exercised records were synthetic local Development fixtures; no
hosted row, schema, secret, provider, or Production setting was read or changed.

**Next owner:** Jonathan separately decides whether to push or open a PR.
## D-212 browser-books handoff repair (2026-09-04)

**Status:** Local High-risk repair, exact-code quick gate, and production build
pass at `5f95f088d4899cbaee193c76e132c0bf3a28d6c9` on
`codex/pglite-sync-stall-repair`, based on
`origin/main@8b035ffaaf75f60dcebfc9cf1b08a448f69d1ba9`; not pushed, merged,
deployed, or live-retested. The failed live sample was Development only.

**Observed failure:** In a calibrated phone-to-Mac witness, the phone's Shared
command committed as hosted revision 25 and its Realtime event reached the Mac.
The Mac remained on revision 24 with no PGlite acceptance or paint. Its renderer
held eleven `pglite-tab-close` locks and logged repeated indeterminate leader
changes after overlapping open retries.

**Repair:** One environment now retains one raw browser-books opening across
caller deadlines. A retry gets a new bounded wait on that same opener rather
than another worker. A leader change reuses PGliteWorker's reconnecting client
and inspects the exact candidate receipt. Operation-timeout retirement is
idempotent and environment-serialized, and a replacement open waits for close.
Any worker handle that fails migration or activation also closes exactly once
before its rejected opening permits a retry.
Explicit local wipe refuses while an opener is busy. IndexedDB and the accepted
snapshot are never cleared by timeout.

**Risk and Dual Course:** Risk **High** because this is the accepted-books
projection used by inbound Shared commands. Budget delta (5): `+4` — removes a
false-live path between cloud commit and accepted local books. Engagement delta
(3): `0` — no visible feature was added. Books win: a command still cannot paint
or be counted as latency evidence until PGlite and the active UI accept it.

**Verification:** The exact-code High-risk quick gate passed in 138.3 seconds
with 31 fast command-contract/runtime tests, 46 serial books/proof tests,
TypeScript, AI-surface verification, test discovery, and diff hygiene. A direct
focused run also passed 45/45 books and deadline tests. Regression cases prove
single-opener reuse after a deadline, failed-initialization close-before-retry,
operation-timeout close-before-reopen ordering, idempotent retirement, and
same-client leader-change inspection. No time-budget breach occurred.
The exact-code production build passed TypeScript, 467 transformed modules, Hercules Pro
UI, and the deployment redirect sanitizer; only the repository's existing
PGlite/browser-external and chunk-size warnings were emitted.

**Boundary and next action:** No financial command/formula, cloud request,
schema, hosted row, secret, provider setting, Production continuity, or local
replacement changed. Production remains off. Independent review remains, then
Jonathan must separately authorize this new PR's merge and Development
deployment before the physical Mac/phone witness can be repeated.

## Onboarding Slice 18 — submission contract (D-218) (2026-09-04)

**Status:** Local implementation and proof complete at
`f400132e388e2eceb8d7348275808659d8b43c16` on
`onboarding/18-submissions`, based on unchanged
`origin/main@1d4998379875bde84229f194b85242b815218940`; not pushed, merged,
deployed, or hosted-live verified. Risk: **High**.

**Outcome:** Each active member may explicitly submit only their own category
choices and estimate cents. Replacement retains linked history; two replicas
converge deterministically; member estimates remain separate; zero and missing
remain different facts.

**Authority, privacy, and money boundary:** Drafts are not stored in the
Household. Published records carry only ids and integer cents. Partner-Personal
source facts cannot enter the command shape. Submission creates no transaction,
journal entry, Fund event, budget, contribution claim, or approval. Command-event
materialization is bound to the active submitting member and exact household.
Contract: [`briefs/ONBOARDING_SLICE_18_SUBMISSIONS_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_18_SUBMISSIONS_CONTRACT_2026-09-04.md).

**Verification:** The focused and adjacent suite passes 53/53, including 13/13
Slice 18 contract tests. The explicit High-risk quick gate passes 67 fast plus
7 serial PGlite proof tests in 46.4 seconds, with TypeScript, AI-surface, diff
hygiene, and no time-budget breach. The production build passes at 465 modules
plus Hercules Pro UI; `pnpm ai:verify` passes 48 required files and two Clerk
fences. An independent High-risk trust review reports no remaining local
correctness or security blocker. `pnpm check:windows` cannot run because this
macOS host has no `pwsh`, so no Windows result is claimed. No UI or CSS changed,
so there is no rendered browser surface in this slice.

**Commands and evidence class:**
`pnpm test -- --risk=high --focus=test/onboarding-submissions.test.ts
--focus-reason="proves self-only explicit submit, bounded Shared payloads,
append-only convergence, event replay, and no money mutation"`, `pnpm build`,
and `pnpm ai:verify` passed; `pnpm check:windows` reached only the missing-host
tool gap above. This is quick-gate plus local-build evidence, not a full-suite,
Windows, hosted two-account, deployment, or Production claim. All exercised
records were synthetic local Development fixtures; no hosted row or schema was
read or changed.

**Next owner:** Jonathan separately decides whether to push or open a PR.

## Onboarding Slice 17 — Chapter 8 earning cadence (D-217) (2026-09-04)

**Status:** Local implementation, production build, and live UX pass complete on
`onboarding/17-ch8-cadence` from
`origin/main@bf19a85341d6135b36c27349d64207706eaad603`; not pushed, merged,
deployed, or hosted-live verified. Risk: **Medium**.

**Outcome:** Each active member supplies only their own earning timing. Weekly,
biweekly, twice-monthly, monthly, and no-fixed-rhythm answers are all valid.
One member's record cannot satisfy another's probe, and an irregular answer
never becomes a guessed payday or contribution.

**Implementation:** A small member-owned Shared cadence fact is shaped and
merged through existing continuity. Hercules routes Chapter 8 to the existing
Shift surface for one five-choice question, conditional timing details, a
plain-language preview, and explicit save. Acknowledgement re-projects current
self evidence. Contract:
[`briefs/ONBOARDING_SLICE_17_CH8_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_17_CH8_CONTRACT_2026-09-04.md).

**Privacy and money boundary:** Employer, role, rate, deductions, landing
account, shift details, and amounts remain Personal and deferred. Detail skip
does not create a job, income row, account, transaction, journal entry, or
assumed contribution. Evidence contains only the member name and cadence. The
current cloud-ledger authority boundary is unchanged.

**UX and accessibility:** Live actual-component proof covered pending, busy,
saved, selected, and irregular states at 320, 390, 720, and 1100 px in day and
night themes. There was no horizontal overflow; controls were at least 49 px;
keyboard focus was visible; Enter saved; reduced motion removed transitions;
and the browser console stayed clean. The pass clarified that irregular leaves
paydays open instead of implying Hearth would place one. Temporary QA files
were removed.

**Verification:** After rebasing onto the cloud-authority release, the final
focused and adjacent suite passed **285/285**. The exact clean-head Medium quick
gate passed **105 fast + 7 serial tests** with TypeScript, AI-surface, and diff
hygiene. The production build passed Vite (**464 modules**)
and Hercules Pro UI; only the existing PGlite browser-external/eval and chunk
warnings appeared. The optional Windows script could not run because this macOS
host has no `pwsh`; no Windows result is claimed.

**Next owner:** Review this local branch, then Jonathan may separately authorize
push/PR/merge. Hosted two-device continuity remains release evidence.

## Onboarding Slice 16 — Chapter 7 regular money (D-216) (2026-09-04)

**Status:** Local implementation, production build, and live UX pass complete
on `onboarding/16-ch7-recurrences` from
`origin/main@912ac532c4e9f2fe1d21e6b37f1e51294ee4fa03`; not pushed, merged,
deployed, or hosted-live verified. The repository classifies the diff as
**Medium** risk.

**Outcome:** Chapter 7 recognizes a valid active Shared rent-or-housing
equivalent plus one other distinct valid Shared recurrence. Existing rows count
once; Personal, paused, malformed, wrong-currency, orphaned, and invalid-split
rows fail closed. Evidence cites each accepted label, cadence, CAD amount, and
next date.

**Implementation:** Hercules routes both members to the existing Calendar Bills
pane. Bianca leads; Jonathan remains named as a contributor who may add a known
item and acknowledge his own progress. The live surface distinguishes reminder,
standing fact, and posted occurrence. While Chapter 7 is current it hides Mark
paid, bulk posting, Skip once, save-and-post, and the automatic due preview;
the confirmation hard-forces `postFirst` false. Ordinary recurrence behavior is
unchanged outside onboarding. Contract:
[`briefs/ONBOARDING_SLICE_16_CH7_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_16_CH7_CONTRACT_2026-09-04.md).

**Money and privacy boundary:** The chapter projector is pure and cannot import
`postOneRecurrence`, browser state, or a component. Acknowledging existing
evidence produces no posted id, recurrence row, transaction, next-date advance,
or compiled-journal delta. Personal recurrence data neither counts nor appears
in household evidence. The existing online-required Shared acceptance boundary
is unchanged.

**UX and accessibility:** The actual-component browser pass covered pending,
accepted, three-item pause, conductor, and contributor states at 320, 390, 720,
and 1100 px. No width overflow occurred; routed controls are at least 44 px;
focus begins on the Hercules line; the action loop is Next → add → stop → Next;
and reduced motion removes transitions and animations. The pass repaired small
touch targets, contradictory empty-state copy, a distracting due warning, and
an occurrence-advancing Skip control. Temporary browser fixtures were removed.

**Boundary:** No recurrence arithmetic, obligation fold, posting command,
second Calendar/form, schema, hosted row, Auth/RLS, provider, secret,
Production, push, merge, or deployment. The six-minute estimate remains honest
guidance, with a calm pause after every third qualifying recurrence.

**Verification:** The focused Slice 16 and adjacent suite passed **99/99**. The
final Medium quick gate passed **78 fast + 7 serial tests** with TypeScript,
AI-surface, and diff hygiene. The production build passed Vite (**461 modules**)
and Hercules Pro UI; only the repository's existing PGlite browser-external,
eval, and chunk-size warnings appeared.

**Next owner:** Review this local branch, then Jonathan may separately
authorize push/PR/merge. Hosted two-device continuity proof remains a release
check.

## Onboarding Slice 15 — Chapter 6 Household Fund (D-215) (2026-09-04)

**Status:** Local implementation, production build, and live UX pass complete
on `onboarding/15-ch6-fund` from
`main@cd4c660a0aebc0bc71cc8f88f9dc2c4bd862ab44`; not pushed, merged,
deployed, or hosted-live verified. Risk: **High** because this adds shared
consent and convergence metadata beside the Fund without changing money.

**Outcome:** Chapter 6 completes only when the existing Fund is valid and both
active members approve the same exact configuration revision. One approval is
pending; mixed revisions are stale; Charter/Fund custody disagreement is
blocked. Evidence cites the custodian, privacy-safe backing description,
active Shared operating accounts, fixed custody rules, and approval dates.

**Implementation:** `configureHouseholdFund` seeds the custodian's approval;
the new self-owned `approveHouseholdFundConfiguration` command records the
other member's reviewed consent. Approvals merge independently across replicas
and never advance the terms revision. Hercules routes to the existing Books
Fund panel, where the review and 44 px approval control live; chat cannot
approve. The non-custodian stays an actor through approval and Next. Contract:
[`briefs/ONBOARDING_SLICE_15_CH6_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_15_CH6_CONTRACT_2026-09-04.md).

**Money and privacy boundary:** Approval creates no transaction or Fund event,
and `projectHouseholdFund` plus the accepted-books financial hash are identical
before and after. The backing account's id, name, suffix, institution, balance,
provider, and reconciliation detail remain Personal and never enter Shared
evidence. The existing online-required Shared acceptance boundary remains in
force; no Chapter 6 offline bypass was added.

**UX and accessibility:** The live actual-component pass covered empty,
one-approval, stale, complete, and custody-conflict states at 320, 390, 720,
and 1100 px. No width overflow occurred; Slice 15 controls remained at least
44 px; Tab stayed inside the onboarding focus surface; Enter routed focus to
the Fund. The pass caught and repaired a post-approval witness dead end. The
existing reduced-motion rule still removes onboarding transitions.

**Boundary:** No new Fund form, money movement, journal row, Fund projection,
bank feed, schema, hosted row, Auth/RLS, provider, secret, Production, push,
merge, or deployment. Browser fixtures were temporary and removed.

**Verification:** The focused Slice 15 suite passed **9/9**. The exact final
High quick gate passed **132 fast + 7 serial tests** in **182.9 seconds**. One
prior cold PGlite proof-matrix attempt exceeded its fixed 15-second host limit;
the prescribed isolated 30-second rerun passed 7/7, and the unchanged exact
gate then passed on the warmed runtime. The production build passed TypeScript,
Vite (**460 modules**), Hercules Pro UI, and the redirect sanitizer; only the
repository's existing PGlite and chunk-size warnings appeared.

**Next owner:** Review this local branch, then Jonathan may separately
authorize push/PR/merge. Hosted two-device/cloud-ack proof remains a release
check.

## Onboarding Slice 14 — Chapter 5 opening truth (D-213) (2026-09-04)

**Status:** Local implementation, production build, and live UX pass complete
on `onboarding/14-ch5-opening` from
`origin/main@97b1119ec9447d24490623418462b5aa4a388d1b`; not pushed, merged,
deployed, or hosted-live verified. Risk: **High** because onboarding now proves
an accepted opening-money fact without changing the financial command.

**Outcome:** Chapter 5 completes only from one receipt-tied opening batch whose
live rows cover every active Shared account. Its evidence names the covered
accounts, Toronto civil date, and balanced Opening equity. Partial coverage
stays pending; ordinary accepted money without a live opening fails closed and
routes to the existing correction/review surface.

**Implementation:** The existing `OpeningTruthCard` now has a Shared-only mode,
coverage progress, review/change focus, pause, honest balance-sheet copy, and
exact confirmation-id handoff into accepted persistence. Hercules routes to
that real Books form or to All activity for correction. The acknowledgement
command re-projects current evidence. `src/core/openingTruth.ts` is
byte-identical to the base. Contract:
[`briefs/ONBOARDING_SLICE_14_CH5_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_14_CH5_CONTRACT_2026-09-04.md).

**UX and accessibility:** Live fictional Development journeys covered task,
entry, complete review/change, partial, and stale states at 320 and 1100 px
plus a 550 px 200%-equivalent reflow. The browser pass caught and repaired a
40/42 px cascade regression; final inputs and actions are 44–48 px, focus
moves with the review state, and no viewport has horizontal overflow.

**Boundary:** D-183's one reversible opening batch remains authoritative. No
history reconstruction, fabricated income/spending, partial completion,
second opening, new correction model, schema, hosted row, Auth/RLS, provider,
secret, Production, push, merge, or deployment. Browser fixtures were
temporary and removed.

**Verification:** The exact final focused suite passed **141/141**. The quick
gate passed AI-surface, TypeScript, diff hygiene, **137 fast + 7 serial tests**
in **163.5 seconds** on the clean rebased commit. The production build passed TypeScript, Vite (**460
modules**), Hercules Pro UI, and the redirect sanitizer; only the repository's
existing PGlite/chunk-size warnings were emitted.

**Next owner:** Review this local branch, then Jonathan may separately
authorize push/PR/merge. Hosted two-device/cloud-ack proof remains a later
release check.

## Onboarding Slice 13 — Chapter 4 accounts (D-211) (2026-09-04)

**Status:** Local implementation, production build, and live UX pass complete
on `onboarding/13-ch4-accounts` from
`origin/main@eb479f9e8abb67d8b49eb8b8b0e520eafc5d276d`; not pushed, merged,
deployed, or hosted-live verified. Risk: **Medium-High** because account scope,
privacy projection, and onboarding completion change without money authority.

**Outcome:** Chapter 4 now completes only from cited Shared accounts plus one
resolvable Shared credit card for the Fund. The custodian chooses when several
cards exist; Hearth never guesses. Personal accounts remain owner-only and
optional. Skipping that optional step records a Personal progress fact, adds
nothing, and never weakens the Shared gate.

**Implementation:** The Chapter 4 resolver no longer falls back to Personal
evidence. A separate owner-only projector supports the soft Personal step,
while a privacy refusal reveals nothing when only a partner-Personal card has
the needed shape. The acknowledgement command re-projects current household
evidence. Hercules routes directly to Personal Books with the existing account
editor expanded, and the editor makes the Shared Fund-card default explicit
while saying it neither opens accounts nor moves money. Contract:
[`briefs/ONBOARDING_SLICE_13_CH4_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_13_CH4_CONTRACT_2026-09-04.md).

**UX and accessibility:** Live fictional Development journeys covered empty,
Personal-choice, accepted, privacy-blocked, and account-editor states at 320,
390, 720, and 1100 CSS px plus a 550 px 200%-equivalent reflow. The browser
pass caught and repaired 37 px legacy account chips; final routed controls are
44–49 px. There was no horizontal overflow. Primary-action contrast measured
6.16:1. Keyboard wrapping, forced-colors focus/rail, reduced motion, explicit
`aria-pressed` Fund selection, skip recovery, and privacy copy passed.

**Boundary:** The new Fund-card preference is member-owned Personal continuity
and is stripped from Shared; the independent glance preference is unchanged.
D-208 remains authoritative: offline Shared additions refuse
before accepted evidence rather than becoming locally queued completion. No
bank feed, issued card, financial movement, Shared Fund/account field, schema,
hosted row, Auth/RLS, provider, secret, Production, push, merge, or deploy.
Browser fixtures were temporary and removed.

**Verification:** The exact final focused suite passed **180/180**. The
Medium-High quick gate passed AI-surface, TypeScript, diff hygiene, **201 fast
+ 7 serial tests** in **under two minutes**. The production build passed TypeScript,
Vite (**457 modules**), Hercules Pro UI, and the redirect sanitizer; only the
repository's existing PGlite/chunk-size warnings were emitted.

**Next owner:** Review this local branch, then Jonathan may separately
authorize push/PR/merge. Hosted two-device/cloud-ack proof remains a later
release check.

## Readiness 5 preflight repair — local books and proof clock (D-212) (2026-09-04)

**Status:** **LOCAL RELEASE REVIEW PASS** on exact code head `587f14cee4cdf045e2be798c9c0e075195bb9fd5`, rebased onto clean current `origin/main@46ec4982fa5214aabdc69decc2adcf65cc1fe7c0`. The clean Release quick gate passed 16 files / 141 tests plus TypeScript, AI-surface, and diff hygiene in 163.463 seconds; the current-main production build passed 459 modules plus Hercules Pro UI; the new Pairing control passed semantic 320/390/720/1100 px coverage. PR, merge, deploy, and physical two-device witness remain pending. Risk: **Release**. Development only.

**Outcome:** a stalled browser PGlite worker cannot leave Hearth indefinitely validating. After twelve seconds the attempt and worker retire into an explicit retry/recovery state while the accepted snapshot and IndexedDB remain untouched. Signed-in Development devices can copy one D-210 clock-calibration row through an authenticated exact-membership Worker route; output contains only a hashed device id and timing fields.

**Boundary:** no automatic local-books deletion/replacement, financial command/formula change, schema, hosted household row, secret, provider, bank, Production continuity, raw identity, or ledger fact. The clean two-device rerun and release receipts remain pending until the candidate passes review and deploys.

## Onboarding Slice 12 — Chapter 3 Charter (D-210) (2026-09-04)

**Status:** Local implementation and live UX pass complete on
`onboarding/12-ch3-charter` from `origin/main@0c458c8`; not pushed, merged,
deployed, or hosted-live verified. Risk: **Medium-High** because shared consent
and replica convergence change, while money and command authority do not.

**Outcome:** Chapter 3 opens the existing Charter founding conversation or
document with a specific action, then completes only after both people have
signed the latest terms and the viewer explicitly presses Next. Someone who
has signed waits quietly. An amendment makes old signatures stale; each person
may re-sign only their own line, and an older replica cannot erase that newer
consent.

**Implementation:** Current consent is derived from existing normalized
timestamps (`signedAt >= termsUpdatedAt`) without a new model field. The
Charter projector cites purpose, custodian, split, ceiling, cadence, and both
signature dates. The acknowledgement command re-projects that typed evidence,
so visiting the route or chat text cannot complete the chapter. Hercules
closes before navigation, the existing founding/document styling remains the
authority, and plate 13's 44 px mobile return bar carries the scoped, timer-free
instruction until the chapter moves on. Contract:
[`briefs/ONBOARDING_SLICE_12_CH3_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_12_CH3_CONTRACT_2026-09-04.md).

**UX and accessibility:** Live synthetic Development journeys covered missing,
unsigned, one-signed waiting, stale, re-sign, accepted evidence, and founding
without signing at 320, 390, 720, and 1100 CSS px. The browser pass caught and
removed a premature “Good place to stop” opening; it now appears only once the
final sitting evidence is ready. Keyboard focus visibly reaches the primary
action, action/sign targets measure 48/44 px, primary-action contrast measured
6.16:1, the return bar is exactly 44 px with no dismiss control, and the 1100
px layout reflows at an equivalent 200% viewport without horizontal overflow.
Forced-colors and reduced-motion treatments were inspected in the scoped CSS;
the browser controller did not expose media emulation.

**Boundary:** No Charter redesign, signature-revision field, schema, hosted
row, Auth/RLS, provider, secret, money/Fund behavior, Production, push, merge,
or deployment change. Browser fixtures were synthetic and temporary; no
household data or QA route remains in the tree.

**Next owner:** Review this local branch, then Jonathan may separately
authorize push/PR/merge. Hosted two-device consent remains a later release
proof, not a claim of this local slice.

## Onboarding Slice 11 — Chapter 2 live household scope (D-209) (2026-09-04)

**Status:** Local implementation and repair on `onboarding/11-ch2-household`,
rebased onto `origin/main@e109708`; not pushed, merged, or deployed.
Risk: **Medium-High** because the slice reads privacy-sensitive live Auth and
membership authority but posts no money and changes no Auth/RLS policy.

**Outcome:** Chapter 2 accepts only a live exact selected household with the
current authenticated member and exactly the two expected active seats. A
multi-household person passes after an exact scope is selected; Hearth never
chooses the first membership. Cached/offline identity remains readable but
pending. Probe success enables Next and never auto-advances.

**Implementation:** `src/onboardingHouseholdScope.ts` performs guarded live I/O
and emits a sanitized transient observation. Pure
`src/core/onboarding/householdScope.ts` and `evidence.ts` validate and project
it without browser/network imports. Next uses
`recordObservedChapterCompletion`, which re-projects against the current
Household and writes only the actor's Personal onboarding progress. Ordinary
acknowledgement is refused for auto-completable chapters. Repaired contract:
[`briefs/ONBOARDING_SLICE_11_CH2_CONTRACT_2026-09-04.md`](briefs/ONBOARDING_SLICE_11_CH2_CONTRACT_2026-09-04.md).

**Review repair:** Hosted continuity membership, not the local Google bridge,
now resolves the current member. Checking stays neutral. Unknown RPC/network
failures become an honest retryable state instead of false missing-Auth or
missing-partner copy. Revoked current access no longer names the partner.
Chapter 2 evidence is labelled as live household access, with dedicated calm
offline and multi-household copy. The actual component passed live browser QA
at 320, 390, 720, and 1100 CSS px, keyboard forward/reverse wrapping, 44 px
touch targets, zero horizontal overflow, forced colors, reduced motion, and
contrast checks.

**Boundary:** No Auth/session/roster cache on Household or Member; no App,
Pairing, schema, RLS, hosted row, secret, provider, money command, Production,
push, merge, or deployment change. No signed-in hosted two-browser proof is
claimed.

## Single-run pull-request CI (D-202 why-note) (2026-09-03)

**Status:** Local implementation on `codex/ci-single-pr-run` from clean `origin/main@f5a3cab8746d60131568768801d8145cd17f9a9b`; not pushed, merged, deployed, or released. Risk: **Medium** because CI verification scheduling changes without runtime behavior.

**Outcome:** A pull request runs the five-minute quick gate through `pull_request`; pushing the same agent branch no longer launches a duplicate copy. Accepted work still gets an independent `main` push gate. Budget `+1` assurance throughput / `0` runtime; Engagement `0`.

**Verification:** Focused policy contracts passed **18/18**. The Medium quick gate selected the policy and lane contracts and passed **19/19** plus TypeScript, AI-surface verification, and diff hygiene in **21.322s** with no SLA breach. No full suite or build ran.

**Boundary:** Workflow configuration, policy contracts, validator, and canon only. Test selection, financial/privacy canaries, manual full-suite authority, household data, hosted state, secrets, Production, and runtime behavior are unchanged.

## Five-minute verification gate (D-202) (2026-09-03)

**Status:** Local implementation on `codex/five-minute-verification`, refreshed onto clean current `origin/main@7dd1f96729fc9ec4fe6bb74a1daeacbf413b700a`; not pushed, merged, deployed, or released. Risk: **Medium** because verification reliability protects every later trust boundary without changing runtime behavior.

**Household outcome:** Routine Medium, Medium-High, and High-risk work receives current, change-focused evidence in a five-minute target instead of waiting about thirty minutes for unrelated exhaustive coverage. Full-suite evidence remains available only after Jonathan explicitly requests it for an exact High/Release-risk SHA.

**Dual Course:** Budget `+1` assurance / `0` runtime; Engagement `0`.

**Implementation:** `pnpm test` and `pnpm check` now run the quick coordinator; D-170's complete lane coordinator is callable only inside guarded `test:full` / `check:full`, with no raw package entry. The selector fingerprints the complete change, runs but does not over-credit changed tests, accepts related tests, checked-in mappings, explicit reasoned focus, and command/privacy canaries, bounds broad transitive graphs, preserves four-worker ordinary tests and serial selected PGlite tests, emits structured pass/failure timing, and keeps browser proof explicit. Automatic CI is quick-only. The separate manual workflow binds the repository owner, approval environment, exact clean SHA, High/Release risk, reason, and an owner-authored same-repository record whose body names full verification and that SHA. Canon, skills, and an always-applied Cursor rule use the same boundary.

**Verification:** Focused policy/lane contracts **19/19**; TypeScript, AI-surface, and diff hygiene passed. Medium **19.722s**; Medium-High **19.078s**; High with a real protected serial books canary **22.965s**. All were `quick-gate-passed`, below the 300s SLA, with TypeScript the slowest phase. Missing authorization and the direct coordinator refused before exhaustive work. Independent review drove and then cleared enforcement repairs; no exhaustive suite or build ran because this Medium-risk slice has no authorization for them.

**Data/environment:** Repository tooling, tests, CI configuration, and documentation only. No household data, hosted row, schema, secret, provider, Production, push, merge, deploy, or runtime behavior is in scope.

**Residual/rollback:** Configure Jonathan as required reviewer for the GitHub `full-verification` environment before the first authorized remote full run. The workflow also enforces owner authorship and record content in code. Revert the one local commit to roll back; there is no runtime or hosted recovery.

## Till Slice 4 member-owned landing preference (2026-09-02)

**Status:** **CLOSED; MERGED #306; DEVELOPMENT KITCHEN PUBLISHED; LIVE VERIFIED.** Exact reviewed head `4992a0caa02a6e3ce725229b0d0a42ef69deada9` fast-forwarded to `main` from `origin/main@08e3a4b306533518405cdb866f13e71550447624`. PR CI `33698007625`, push CI `33697952990`, PR Cloudflare `33698007768`, post-merge main CI `33698860263`, and production-path Cloudflare Workers `33698859862` passed. D-200. Development kitchen only; not Production continuity.

**Household outcome:** the configured Fund custodian calmly defaults to Till and everyone else to the full desk, but each person can explicitly choose and reverse only their own default. The choice is Personal, never an assignment or permission tier. `see everything` stays a permanent non-writing peek back to the desk.

**Dual Course:** Budget `+1`; Engagement `+2`. No amount, Fund event, journal row, command authority, or accepted-books rule changes.

**What changed:** `LandingSurface`; member and Personal-envelope shape; default resolver; self-owned `setLandingSurface`; Personal split/overlay/assembly/merge; focused command, continuity, source-fence, and Till-door tests. `src/core/sync.ts` is a correctness-required expansion beyond the packet's file list because current canon puts member-Personal state in `PersonalEnvelope` rather than Shared `members`.

**Verification:** final focused Slice 4/continuity/Till/visibility proof **39/39**; expanded core/continuity/storage proof **99/99**; TypeScript and diff hygiene passed. The final Windows-native full gate passed AI surface verification, **1,745 tests** with three intentional skips, and a **418-module** production build. Independent complete-diff re-verification passed after its actor-bypass and equal-clock convergence findings were fixed.

**Release proof:** Worker version `558f1e53-a269-4db1-8d0e-2c8062dbc6c3`; live `GET https://hearth-books.jonathan-beaulne123.workers.dev/` returned HTTP 200 with `Cache-Control: no-store`; served `/assets/index-JsW2hVnK.js` contains `landingSurface`, `landingSurfaceUpdatedAt`, `desk`, `till`, and the existing `see everything` door. The workflow pins `VITE_PRODUCTION_CONTINUITY: "0"`.

**Boundaries:** local source/docs and fictional catalog/Development tests only. No settings UI, automatic startup route, Till/Swipe/Ask/Fund arithmetic, PGlite or hosted schema, hosted row, Auth/RLS, secret, provider, bank, deployment, real household data, or Production change.

**Next owner:** Jonathan may hard-refresh the Development kitchen. No hosted household row, schema, secret, provider, bank connection, or Production data changed.

## Till Slice 3 custodian surface (2026-09-02)

**Status:** **CLOSED; MERGED #304; DEVELOPMENT KITCHEN PUBLISHED; LIVE HTTP VERIFIED.** Exact head `300235628885d9f21b1680089174301aa3665141` merged as `main@300235628885d9f21b1680089174301aa3665141` from sealed `origin/main@6f5dd56516d31c3f1892f4833a7e71ff31857142`. Ancestry: PR #302 `777dbcd`, Slice 1 `e426a45`, and `a2a55c6` are ancestors. Risk: **High**. D-199. Jonathan authorized merge and Development kitchen publish when finished. Not Production. Stop before Slice 4.

**Household outcome:** the Till is a reachable Shared presentation: Swipe first, real contribution conversation next when the current actor can act, `Nothing has moved.`, one current-month spend sentence from `monthSummary`, and a real `see everything` door back to Shared Home. Shared Home stays the initial surface. The Till cannot grant or remove a command right.

**Dual Course:** Budget `+2`; Engagement `+3`. Truth wins over brevity. Confirm remains the only contribution balance change; Hold stays record-only.

**What changed:** `src/Till.tsx` + `src/till.css`; `tillActionableMotions` over the existing motion fold; `FundContributionMotionCard` shared from the Fund panel; LedgerTab `till` with `#till`/`#home` fallback; the temporary Home `I spent something` control moved onto Till; quiet Home door `Till`. Hercules presence maps Till → Home so Slice 3 does not invent companion copy. No `landingSurface`. No command/Fund arithmetic, schema, Auth, Worker, or Production change.

**Justified expansions:** Cloud Agent branch `cursor/till-3-surface-0c3a` instead of packet `till/3-surface`. Hercules tab mapping rather than expanding `HearthTab`.

**Verification:**
- Focused `pnpm exec vitest run test/till.test.ts test/swipe.test.ts test/ledger-experience.test.ts --maxWorkers=1`: **3 files / 45 passed** at application SHA `5567f30`; `3002356` added Confirm-click and scoped-spend proofs
- Bianca Month `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts`: **12 passed**
- `pnpm check` on `5567f30`: AI surface 41 required files; fast lane **227 passed / 1 skipped files, 1,582 passed / 2 skipped tests**; serial books **18 passed / 1 skipped files, 154 passed / 1 skipped tests**; **1,736 passed / 3 intentional skips total**; TypeScript; Vite **418-module** production build; Hercules Pro UI; no `dist/_redirects`; `git diff --check` clean
- Playwright against local Vite, fictional Development demo as Bianca, reduced motion: 320 / 390 / 720 / ~1100, no body overflow, `see everything` is a focused `#home` link, Swipe sheet opens from Till and Escape returns, door back to Shared Home. Artifacts: `/opt/cursor/artifacts/till-surface-320.png`, `till-surface-390.png`, `till-surface-720.png`, `till-surface-1100.png`, `till-home-390.png`, `till-swipe-sheet-390.png`, `till-slice-3-walkthrough.mp4`
- Independent books audit: **PASS WITH NOTES** (no P0–P2; P3 route-contract omitted release/withdraw — repaired; P3 Confirm click-through — added)
- Independent privacy audit: **PASS WITH NOTES** (no P0–P2; P3 Till trusts the caller clone — App already passes `experience.scopedHousehold`; added scoped spend test)
- Independent verifier at `5567f30`: surface claims proven; parent later recorded `pnpm check`, visual 320/390/720/~1100, and the audit follow-up
- UX auditor unavailable (model spend limit). Parent visual proof stands.
- Exact-head PR CI [`33687055693`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33687055693) and [`33687059654`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33687059654) passed
- Post-merge Cloudflare Workers [`33689372692`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33689372692) passed; Worker version `a52acc66-b218-4c73-8d9a-2142b4a5a680`
- Live `GET https://hearth-books.jonathan-beaulne123.workers.dev/` → **HTTP/2 200**, `cache-control: no-store`; `/assets/index-Bfi0OGDI.js` contains `I spent something`, `Waiting on you`, `Nothing has moved.`, `The house has spent`, `see everything`, `data-till`; `/assets/index-N-WQUmzo.css` contains `.till`
- Post-merge main CI [`33689372691`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33689372691) started at merge

**Boundaries:** fictional Development/demo fixtures only. No hosted row, schema, secret, provider, bank, Production data, or Production-continuity change.

**Next owner:** Stop before Slice 4. Hard-refresh the Development kitchen. Not Production.

## Till Slice 2 two-tap Swipe repair and Development release (2026-09-02)

**Status:** **CLOSED; MERGED #302; DEVELOPMENT KITCHEN PUBLISHED; LIVE HTTP VERIFIED.** Exact repaired application `70f1245569da1abad53bf8690027f6eca215707d` merged as `main@777dbcd1196670dbe7c2576fff8b0526cad27093`. Historical `main@2b9f77051b4abfdddce2fd2f580e41a36a6c8772` is PR #298's failed first release and is not a Slice 3 baseline. PR #302's successive reviews found and stopped journal parity, disclosure-key ownership, transfer duplicate lineage, local PGlite re-anchoring, intermediate-lineage counting, receipt-gated migration recovery, and stale numeric-view defects before the accepted merge. Risk: **Release**.

**Household outcome:** the configured Fund custodian records an ordinary shared-card purchase with amount then an observed category. A rejected command remains visibly and accessibly recoverable inside the active sheet. The modal removes the background from interaction, and the ten-second correction preserves append-only Fund history.

**Dual Course:** Budget `+3`; Engagement `+3`. The fast path remains App presentation over ordinary `postEntry`, D-197 custody, PGlite validation, durable device persistence/outbox, and later transport. It adds no account, balance, formula, money movement, or posting authority.

**Repair gates closed in source:** rejected posts use a Swipe-scoped `role=alert` with retry/More guidance and a non-destructive warning treatment; the modal ref moved to the outer overlay so `useDialog` can inert App siblings; the duplicate CAD-pad title is now `Amount`; Hercules pauses and the overlay sits above its pill; funded Undo is bounded to explicit `postEntry` and `postHouseholdFundDirectDebit` command kinds with one current transaction and a current Fund fact. Compact history preserves that identity across reload and suppresses legacy funded rows that cannot choose a safe correction. The forward repair makes reporting, cash-flow, card status, Ask/Hercules summaries and cash runway, member year review, CRA medical eligibility, snapshot P&L, subsequent-events counts, and the compiled journal follow the same reversal direction and requires every resolved lineage row and each resolved transfer-pair leg to remain countable, including intermediate corrections and reinstatement. Local PGlite projection version 7 invalidates only the derived projection proof; an existing replica is rebuilt transactionally only after the cached snapshot matches its accepted receipt. The ten-second strip is bound to one environment/household/member and closes during a ledger switch; an unusable second Undo is suppressed after the append-only funded correction; and focused Close and `summary` disclosure controls own Enter. Unknown funded command shapes refuse rather than guessing from `FUND-EVT-`.

**Verification:** the forward repair's focused Swipe/statements/accounts/opening/custody/history suite passed **47/47**; after integrating Register Slice 8, the focused cross-slice suite passed **60/60**. The journal/disclosure repair passed **51/51**; the transfer-duplicate and PGlite-v7 set passed **59/59**. Head `02bf62c` passed **61/61** focused and its exact PR CI, Pages, and Worker preview. Public review then found the receipt-recovery P1 and subsequent-events P2, and bounded sweeps found the related card-view, Ask/Hercules, cash-runway, member-year-review, and CRA-medical projection defects. Exact candidate `70f1245569da1abad53bf8690027f6eca215707d` passed the expanded **ten-file / 129-test** focused set, including cross-member corrections. Its fresh `pnpm check:windows` passed AI surface; **226 fast files passed / 1 skipped with 1,571 tests passed / 2 skipped**; **18 serial books files passed / 1 skipped with 154 tests passed / 1 skipped**; **1,725 passed / 3 intentional skips total**; TypeScript; a **416-module** production build; Hercules Pro UI; and redirect guard. Three independent exact-SHA reviews found no P0-P2 release blocker. The requested public GitHub review did not return before the bounded release wait and is recorded as unavailable, not approval. Exact-head PR CI runs [`33676032472`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33676032472) and [`33676028686`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33676028686), Cloudflare preview [`33676032581`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33676032581), and Pages passed. PR #302 merged as `777dbcd1196670dbe7c2576fff8b0526cad27093`; post-merge main CI [`33678815287`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33678815287) and Cloudflare [`33678815283`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33678815283) passed. Worker version `b8d934ef-b4a5-424f-aa2e-c657854c7488` serves HTTP 200 with `Cache-Control: no-store`; live JS `/assets/index-C6pIYlu1.js` contains the Swipe title, exact custody refusal, and `Nothing was posted.` recovery marker. Worksession: [`worksessions/2026-09-02-till-2-swipe-release.md`](worksessions/2026-09-02-till-2-swipe-release.md).

**Boundaries:** source, tests, canon, fictional/local Development visual fixtures, the local PGlite projection-version marker, and authorized Development Worker assets only. No hosted schema, hosted household row, secret, provider, bank connection, Production data, or Production-continuity setting.

**Next owner:** Cursor may begin Slice 3 only after fetching a clean current `origin/main` that contains this release record and proving deployed Slice 2 application merge `777dbcd1196670dbe7c2576fff8b0526cad27093` is its ancestor. Never start from PR #295, `25ef99e`, `3ca2f5b`, or the release-blocked first merge `2b9f770`.

## Register slice 8 integrated release (2026-09-02)

**Status:** **CLOSED; MERGED #299; KITCHEN PUBLISHED; LIVE HTTP VERIFIED.** [#299](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/299) merged as `347e4ff0ce31cd5959e5a24b511c14fd1d34a791`, superseding unmounted draft [#285](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/285). Risk **High**. Development only; not Production.

**Household outcome:** the Household table now has a Register room, and the wide Month Spread says `Open the register`. It renders only the conserved `contributionRegister` projection: monthly obligations, confirmed Fund-source order, carried cents, and honest unfunded tails. Personal Books does not offer or mount it.

**Dual Course:** Budget `+3`; Engagement `+2`. Books win: no allocator, writer, Fund event, balance, contribution, recurrence, schema, or hosted row changes. Forced-colors mode distinguishes carried/hers/his/unfunded without color alone. The drawing remains pointer-scrollable on narrow screens, while the complete semantic fact list is the keyboard and screen-reader path; the drawing creates no misleading or quiet tab stop.

**Verification:** Register/contribution 26/26; combined Month Spread/privacy/placement work exposed and repaired a one-shot navigation effect-order defect; focused placement/view rerun 13/13. Three independent feature-head reviews and the final post-rebase exact-SHA review passed with no P0/P1/P2 after repairing legend spacing and a misleading keyboard scroll target. The canonical current-main Windows gate passed **1,706 tests with three intentional skips**, TypeScript, Vite's **416-module** build, Hercules Pro UI, and redirect guard. Local browser proof at 320/390/720/1100 px found one Shared Register, no body overflow, an exact working Month Spread route, honest fail-closed copy for an unconfigured Fund, and no console errors. Exact-head PR CI [`33659646340`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33659646340) and Cloudflare preview [`33659646250`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33659646250) passed. Post-merge main CI [`33660752312`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33660752312) and D-041 Cloudflare [`33660752817`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33660752817) passed with `VITE_PRODUCTION_CONTINUITY=0`; Worker version `87b740c9-3af7-4ee7-96e1-f41f76efa9ee`. Live kitchen returned HTTP 200 and `Cache-Control: no-store`; `Books-zKkvo2sl.js`, `Books-Dkup-FAr.css`, and `Office-hcpC2ocS.js` contain the Register room, fail-closed copy, and exact `Open the register` route. Worksession: [`worksessions/2026-09-02-register-8-release.md`](worksessions/2026-09-02-register-8-release.md).

**Boundaries:** source, tests, docs, and Development assets only. No Supabase/schema/Auth/RLS, hosted household row, secret, provider, Production data, or Production-continuity change.

## Register slice 10 — the metronome (2026-09-02)

**Status:** Release candidate on `cursor/register-10-metronome-115c`; ready PR [#294](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/294). **Not merged, not kitchen-published, not live.** Risk **High** (Fund-month drawing on Shared Home). Isolated from Register slice 8 (#285). Current `origin/main@5828d9f156ef3cefe9a9a46a9341e0627651c22a` is integrated; fetch the PR head for the exact candidate.

**Household outcome:** Bianca's projected paydays appear as regular felt ticks below the Course axis. Ticks carry no amount. Jonathan's confirmed contributions keep their existing marks. The contrast is the information.

**Budget delta (5):** `+3`. **Engagement delta (3):** `+2`. Books win: no assumed paycheck CAD, no Course scale change, ticks from the custodian's `paySchedule` only.

**What changed:** `paydayTicks` + `PaydayTick` (date only) in `monthSpread.ts`; Course axis ticks in `MonthSpread.tsx`; `--ms-tick: var(--felt)` in `month-spread.css`; `OfficeWide` passes `booksHousehold` (justified host wire). First `payday` label sits in a Chip **above** the axis so it does not collide with day numbers or clip the viewBox. Focused tests in `test/month-spread.test.ts`. Worksession: [`worksessions/2026-09-02-register-10-metronome.md`](worksessions/2026-09-02-register-10-metronome.md). ChatGPT packet: [`briefs/CHATGPT_REGISTER_SLICE_10_METRONOME_REVIEW_MERGE_2026-09-02.md`](briefs/CHATGPT_REGISTER_SLICE_10_METRONOME_REVIEW_MERGE_2026-09-02.md).

**Verification:**
- Focused `pnpm exec vitest run test/month-spread.test.ts`: **40 passed** (includes divergent `tipSchedule` exclusion)
- Bianca Month `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts`: **10 passed**
- Local `pnpm check` on `843a21e`: **exit 0**. `ai:verify` 41 files; fast lane **220 passed / 1 skipped files, 1,511 passed / 2 skipped tests**; books lane **18 passed / 1 skipped files, 146 passed / 1 skipped tests**; Vite production build 404 modules + Hercules Pro UI
- GitHub `test` on exact head `843a21eff4b25d295d96a5305aafd64d2247760c`: push run `33597093965` success; PR run `33597098018` success. Workers preview is not the kitchen URL
- Release integration after Till Slice 1: focused cross-slice suite **75 passed**; `pnpm check:windows` **exit 0** with AI surface, fast lane **1,532 passed / 2 skipped**, serial books lane **146 passed / 1 skipped**, TypeScript, production build, Hercules Pro UI, and redirect guard green. Remote checks on the new PR head remain the merge gate.
- Independent books at `843a21e`: **PASS WITH NOTES** (no P0/P1; P2 tipSchedule fence was missing, now added). Privacy: **PASS WITH NOTES** (`household?: Household` is a future leak, not a current disclosure). Verifier: **PASS WITH NOTES** (claims match source; draft #294 isolated from #285). UX auditor could not run (third-party usage limit); parent visual proof at 320 / 390 / 720 / ~1100, empty, night, reduced-motion, Course crops.

**Data/environment:** Local fictional Development only. No hosted row, schema, secret, Production, or deploy.

**Next owner:** Codex completes the authorized push, exact-head review, merge, Development kitchen deployment, and live verification. Do not stack #285. Do not touch Production data.

## Till Slice 1 custody fence and Cursor Slices 2/3 packet (2026-09-02)

**Status:** Merged via [#296](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/296) onto `main` as `9c49e6fd1998e9687820c8eedea4f6a7b062805a` (2026-09-02T07:17:36Z). Main CI [`33602847175`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33602847175) and D-041 Cloudflare Workers [`33602847156`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33602847156) passed with `VITE_PRODUCTION_CONTINUITY=0`. Worker `hearth-books` version `3f8852fe-2949-487d-923b-a80da37a0068` serves the verified no-store bundle. **Development kitchen only; not Production.** Cursor's complete sequential contract is [`briefs/CURSOR_TILL_SLICES_2_3_HANDOFF_2026-09-02.md`](briefs/CURSOR_TILL_SLICES_2_3_HANDOFF_2026-09-02.md). Risk: **High**.

**Household outcome:** only the configured Household Fund custodian can create a `purchase-funded` household purchase. The refusal happens before any household clone or mutation with exact copy `Only the person holding the card can post a household purchase.` Non-custodians retain contribution proposals, shift posting, refund-funded corrections, reads, annotations, and motions.

**Dual Course:** Budget `+5`; Engagement `0`. Books won: the immutable Fund event kind determines authority. Ordinary refunds and funded-purchase reversals remain `refund-funded`; reversing a refund restores `purchase-funded` and crosses the custody fence again. No UI was added in Slice 1.

**Implementation:** D-197 classifies Fund direction once in `postEntry`, calls the existing custodian guard before clone/mutation for `purchase-funded`, and preserves the helper's generic copy for all existing operations. The synthetic seed and only affected Fund-backed purchase fixtures now use the configured custodian; money amounts and expected accounting figures are unchanged, while deterministic hashes were re-frozen for truthful actor attribution.

**Verification:** the focused custody suite passed **1 file / 6 tests**. The exact current-main candidate then passed `pnpm check:windows`: AI-surface verification; **223 fast files / 1 skipped, 1,525 tests / 2 skipped**; **18 serial books files / 1 skipped, 146 tests / 1 skipped**; **1,671 tests passed / 3 intentionally skipped total**; TypeScript; a **410-module** production build; Hercules Pro UI build; and redirect guard. Earlier focused Fund/continuity/PGlite/rehearsal proof and independent books/trust audit found no P0-P2 defect. Both exact-PR-head CI runs passed before merge. Post-merge main CI and Cloudflare deployment passed. Live `GET https://hearth-books.jonathan-beaulne123.workers.dev/` returned **HTTP 200** with `Cache-Control: no-store`; `/assets/index-Ds-S26uS.js` contains the exact custody refusal.

**Boundaries:** source, fictional catalog/Development fixtures, documentation, and Development Worker assets only. No real household/workbook/chat data, hosted row, schema, Supabase/Auth/RLS, secret, provider, bank connection, Production data, or Production-continuity setting changed. Gemini CLI was unavailable; independent read-only books/trust and packet audits were used instead.

**Next owner:** Cursor may begin only Till Slice 2 from the packet's sealed `b520ff954cd2fafb4a15f6ee6f6d1bb26cf9be09` prerequisite, must stop after returning its exact head, and may begin Slice 3 only from the separately accepted Slice 2 lineage. This release grants no push, merge, deploy, hosted-data, or Production authority for either later slice.

## Clerk Slice 4 weekly document (2026-09-02)

**Status:** Merged via [#293](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/293) onto `main` as `97e1ae9df92f5af04ef6717b48c580829756656c` (2026-09-02T06:12:12Z). Main CI [`33597829546`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33597829546) success. D-041 Cloudflare Workers [`33597829535`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33597829535) success (`VITE_PRODUCTION_CONTINUITY=0`). Worker `hearth-books` version `b9b79e02-143d-4c06-ae08-72bb14d36ce0`. Live kitchen HTTP verified. **Not Production. Not called shipped for Production.** Risk: **High**.

**Household outcome:** Jonathan and Bianca can open one calm weekly household document at different times. It reads the cited Clerk record, shows the conserved month register, puts the household Ask beside a read-only other door, and lists existing motions. Either person may stamp only their own line; one stamp completes the weekly and the other line remains blank without a reminder. Routes stay with the unique active non-custodian. The desk Ask `Raise it` Confirm from #292 remains on wide Shared Home only; the weekly page does not gain a `place` or goal-move control.

**Dual Course:** Budget `+3`; Engagement `+3`. Books won: monthly `SitDownSession.act` is unchanged, the weekly other door has no `place` control, stamps are acknowledgement-only `WSTAMP-` facts, and partner-work routes never enter the non-owner projection.

**Architecture:** `weeklyDocument` is a viewer projection over sealed Clerk, register, Ask, alternatives, routes, Fund/Charter motions, and Gate A stamps. `WeeklyDocument` is a sibling of `SitDownGuide` on the Office postcard with local act state `0|1|2|3`. `cadence: "none"` offers nothing; weekly follows `cadenceWeekday`; biweekly/monthly withhold. `askRoutes` runs only for the unique active non-custodian. `commitHousehold` passes `actingMemberId`. D-196. Worksession: [`worksessions/2026-09-02-clerk-weekly-document.md`](worksessions/2026-09-02-clerk-weekly-document.md).

**Verification:**
- Focused weekly on the implementation branch: `pnpm exec vitest run test/weekly-document.test.ts test/weekly-document-ui.test.ts --maxWorkers=1` — **2 files / 14 tests passed**
- Packet regression including Bianca startup before merge: **13 files / 101 tests passed**
- Independent read-only books audit: **PASS**; privacy audit: **PASS**; UX P1 live-region/figure clamp repaired at `c02232d`
- Visual proof (fictional Development catalog, branch): 320/390/720/1100, both viewers, keyboard focus, reduced motion, loading/error/offline, cadence none
- Merge: fast-forward `origin/main` `7101dce` → `97e1ae9`; PR #293 MERGED
- Main CI `33597829546` / job `test` `100144792101`: **success** (completed 2026-09-02T06:20:41Z)
- D-041 `33597829535` / job `pages` `100144792093`: **success**; uploaded `hearth-books`; Current Version ID `b9b79e02-143d-4c06-ae08-72bb14d36ce0`
- Live `GET https://hearth-books.jonathan-beaulne123.workers.dev/` → **HTTP/2 200**, `cache-control: no-store`
- Live `/assets/index-B6_CDc3Y.js` (1,432,591 bytes) contains `weeklyDocument` and `stampWeeklyDocument`
- Live `/assets/Office-P5Sguoc5.js` (140,724 bytes) contains `This week's page`, `This is another way the month could look`, `does not move a goal`, `weekly-document`, `weekly-stamp-link`
- Live `/assets/Office-C3dOKSHl.css` (8,363 bytes) contains `.weekly-document`, `.weekly-stamp-link`, `outline:2px solid var(--pine)`, `outline-offset:2px`, and reduced-motion `transition:none`

**Boundaries:** No hosted schema/row, secret, provider, or Production mutation. Hosted RPC still does not inspect stamp JSON. Kitchen postcard does not pass loading/error/offline; those surfaces exist on the component. Signed-in live Office interaction was not exercised against hosted household data.

**Next owner:** Jonathan, to open the Development kitchen on the Charter weekly weekday. Hosted RPC stamp-JSON inspection remains a later packet. Production continuity stays off.

## Register slice 9 Ask confirmation (2026-09-02)

**Status:** Merged via [#292](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/292) onto `main` as `7101dce`. Kitchen live for that merge is a separate D-041 evidence step. Risk: **High**.

**Household outcome:** Jonathan's wide Shared Home shows the existing Fund Ask and other door. `Raise it` opens a small, focused confirmation whose canonical action says `Move Halifax to next month`. Confirming advances only the exact Halifax shared monthly standing-order date; no cash, journal row, Fund event, contribution, balance, or saved amount moves. Bianca's default custodian surface does not receive the panel or command.

**Dual Course:** Budget `+3`; Engagement `+2`. Books won: the UI carries the exact recurrence id and claim date from the existing obligation/register fold; the command reprojects the current Ask and refuses stale, mismatched, retired, non-monthly, non-goal, inactive, or custodian requests before mutation.

## Cursor Clerk Slice 4 weekly packet (consumed) (2026-09-02)

**Status:** Consumed by Slice 4; merged via [#293](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/293) as `main@97e1ae9`. Packet: [`briefs/CURSOR_CLERK_SLICE_4_WEEKLY_HANDOFF_2026-09-02.md`](briefs/CURSOR_CLERK_SLICE_4_WEEKLY_HANDOFF_2026-09-02.md). Core seal remains the #291 stamp merge.

## Clerk Slices 2 + 3 corrected release candidate (2026-09-01)

**Status:** Corrected combined candidate on `codex/clerk-2-3-release`, integrated with current `origin/main@e7d98389be1a4ad831d4d83204061a68955df232` at `008310113e392827718e9013f92d3c4c499b5e15`; this evidence record follows. Source Slice 2 [PR #287](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/287) is integrated. Independent review found two P2 defects, repaired at `4624c31`; exact-head PR review then found a third P2 for long unbroken imported labels, repaired with `overflow-wrap: anywhere` and a regression fixture. Jonathan authorized push, merge, and Development kitchen deployment after exact-candidate verification. Risk: **Medium**.

**Household outcome:** Jonathan or Bianca can focus or tap any Clerk sentence and reveal, directly beneath it, the exact accepted transaction and Household Fund event rows that support that sentence. The explanation stays calm, compact, keyboard- and screen-reader-complete, and never hides the record behind a modal.

**Dual Course:** Slice 2 Budget `+1` / Engagement `+2`; Slice 3 Budget `+1` / Engagement `0`. Books won: a sentence is withheld unless every cited ID resolves in the supplied household, and the source/build fences reject advice, work instructions, and money-writing paths.

**Architecture:** `ClerkReading` remains a display-only leaf over the sealed Slice 1 record. Optional `onOpenRecord` is a passed callback. Same-day duplicates are distinguished by label, Toronto civil date, exact CAD amount, and stable row ID. `scripts/verify-ai-surface.mjs` scans every Clerk-owned source for proposal/work language and money-writer reachability. No `App.tsx` placement.

**Verification:**
- Combined focused Clerk suite: **3 files / 19 tests**
- `pnpm ai:verify`: **41 required files / 2 Clerk source fences**
- `pnpm exec tsc --noEmit`: passed
- Full Windows fast lane: **217 passed / 1 skipped files; 1,482 passed / 2 skipped tests**
- Full serial books lane: **18 passed / 1 skipped files; 145 passed / 1 skipped tests**, including a green dated Demo Suite
- Rendered 320/390/720/1100 proof: no horizontal overflow, all visible controls at least 44px, four unique exact-row names, unsupported sentence absent, ready/integrity/withheld/empty states present
- Direct Vite/Hercules builds, redirect guard, diff hygiene, and secret-path scan passed. Exact follow-up GitHub CI remains the final release check.

**Boundaries:** Local fictional/catalog fixtures only. Zero model, command, network, storage, hosted-row, schema, secret, Production-continuity, or household-data changes. The component performs zero fetches, so offline equals online.

**Next owner:** Codex re-fetches current `main`, pins and pushes the combined SHA, waits for exact-head CI, merges, then verifies the D-041 main deployment and live HTTP separately. `App.tsx` placement remains a later slice, so this release publishes the reviewed leaf and fences without exposing a new kitchen control.
## Charter Slice 5 Held UI (2026-09-01)

**Status:** Merged via [#286](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/286) onto `main` as `e7d98389be1a4ad831d4d83204061a68955df232`. Merge is proven; D-041 kitchen deployment and live behavior are not proven by that merge. Risk: **High** (consent presentation beside Confirm). Environment: client presentation only.

**Household outcome:** Bianca can pause Jonathan's contribution proposal for a calm conversation without rejecting it or moving money. The proposal stays visible and confirmable. The exact holder releases; the exact proposer withdraws.

**Dual Course:** Budget `+3`; Engagement `+2`. Books won: the UI uses the sealed D-193 selector and commands only. Hold/release still do not change Fund projection or journal. Confirm remains the only contribution balance increase. No second motion fold. Proposed/held/released/withdrawn Fund-book rows print `record only`, not CAD.

**What changed:** `src/HouseholdFundPanel.tsx` waiting queue is `householdFundContributionMotions` filtered to `open` | `held`. Eligible custodian gets equal-weight **Confirm received** and **Hold**. Held uses exact `HOUSEHOLD_FUND_HOLD_COPY.status`. Exact holder **Release Hold**; exact proposer **Withdraw proposal**. Removed `Waiting for Bianca`. Hold composer focuses the note and exposes `aria-controls`. Smallest CSS under `.household-fund-panel`. Tests in `test/held-ui.test.ts`. Worksession: [`worksessions/2026-09-01-charter-held-ui.md`](worksessions/2026-09-01-charter-held-ui.md).

**Verification:**
- Focused `pnpm exec vitest run test/held.test.ts test/household-fund-ui.test.ts test/held-ui.test.ts`: **3 files passed, 22 tests passed**.
- `pnpm exec tsc --noEmit` passed. `git diff --check` passed.
- Independent UX/books/trust review on `39d799f`; this follow-up lands the books P1 (`record only`) and UX P2 focus/`aria-controls`.
- Component harness screenshots at 320/390/720/~1100 for open, held, released, withdrawn.
- Core `src/core/householdFund.ts`, `src/core/commands.ts`, PGlite, continuity, schema, workers, App.tsx, Office, Charter amendment authoring, and Register slice 8 were not edited.

**Post-merge follow-up:** `codex/held-audit-office-truth` routes Audit Office pending actions/counts through `householdFundContributionMotions`, removes withdrawn proposals from the confirm queue, gives Held/released/withdrawn records human labels, and prints proposed/Held/released/withdrawn weekly lineage as `record only`. Worksession: [`worksessions/2026-09-01-held-audit-office-truth.md`](worksessions/2026-09-01-held-audit-office-truth.md).

**Boundaries:** Local fictional/catalog verification only. No hosted schema/row, Supabase, Auth/RLS, secret, provider, bank action, real household data, Production, or deploy.

**Next owner:** Complete the bounded Audit Office follow-up verification/merge. Kitchen live remains a separate D-041 evidence step; do not infer it from either merge.
## Charter Slice 5 Held core (2026-09-01)

**Status:** Core and architecture are implemented on branch `codex/charter-slice-5` at code commit `a7729362e469136636f438313215a3b03ccc570d`, rebased onto clean `origin/main@2879af2153affca10709608acbbd6c6e1b202af2` in [PR #283](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/283). Final High-risk release review passed on the code-equivalent pre-evidence tree; Jonathan explicitly authorized push, merge, and Development kitchen deployment on 2026-09-01. Fresh rebased GitHub and live receipts remain pending at this recorded point. Cursor owns the separate UI/UX implementation from [`briefs/CURSOR_CHARTER_HELD_UI_HANDOFF_2026-09-01.md`](briefs/CURSOR_CHARTER_HELD_UI_HANDOFF_2026-09-01.md).

**Household outcome:** The Fund custodian can Hold another member's open contribution proposal for a conversation without rejecting it or moving money. The exact holder can release, the exact proposer can withdraw, and a held proposal remains confirmable.

**Dual Course:** Budget `+3`; Engagement `+2`. Books won: Hold/release create no journal line or balance effect, withdrawal closes only an unconfirmed pending proposal, and confirmation remains the only contribution balance increase.

**Architecture:** D-193 adds immutable Shared `contribution-held`, `contribution-hold-released`, and `contribution-withdrawn` facts; one UI-facing `householdFundContributionMotions` fold; three authority-checked commands; ingest-time lineage validation; compacted command replay/audit retention; and a local PGlite v5→v6 constraint upgrade. No hosted migration or second money writer exists.

**Verification:** Focused core/continuity/PGlite proof passed **62/62**. The complete local proof passed AI-policy checks, **228 files / 1,571 tests**, the repository's **2 files / 3 tests intentionally skipped**, TypeScript, Vite production build, Hercules Pro UI, and redirect guard. Diff hygiene and staged secret scan passed. Existing PGlite browser-external/eval, large-chunk, and React test `act(...)` warnings remained non-failing.

**Boundaries:** Local fictional/catalog data only in verification. No React/CSS UI, browser acceptance proof, hosted schema/row, Supabase, Auth/RLS, secret, provider, bank action, real household data, or Production household mutation. The authorized Development client release makes the local on-device v5→v6 constraint upgrade available; it does not apply a hosted migration.

**Next owner:** Codex completes and records the authorized GitHub/Development publication. Cursor then implements and proves the existing Fund-panel interaction without changing core semantics; that UI head requires its own independent High-risk review.

## Test runner lanes (D-170) (2026-09-01)

**Status:** Release candidate on `codex/test-runner-lanes`; no deployment. Risk: **Medium** because verification reliability protects the books boundary.

**Household outcome:** The full local verification gate keeps direct PGlite/PostgreSQL-WASM tests serial but gives other Vitest files a bounded four-worker lane. The coordinator always runs the serial books lane, even when unrelated fast-lane failures occur, and returns failure if either lane fails.

**Budget delta (5):** `+1` — faster trustworthy feedback makes ledger and continuity regressions cheaper to catch; no financial rule or command behavior changed.

**Engagement delta (3):** `0` — no household-facing interaction changed.

**What changed:** `pnpm test` now invokes a Windows-safe Node coordinator. `test:fast` runs with four workers and excludes exactly the direct `src/ledger/engine.ts` importers on current `main`; `test:books` runs that exact set with one worker. `test/test-lanes.test.ts` recursively detects direct engine references and fails if either lane's membership or worker cap drifts, including an extra fast-lane exclusion. Direct `vitest run` remains conservative and serial.

**Data/environment:** Local configuration, synthetic tests, and documentation only. No household data, Supabase/hosted row, schema, secret, Production, deployment, or browser interaction.

**Next owner:** Jonathan's authorized merge decision; deployment is intentionally out of scope because this is developer test tooling only.

## Charter founding conversation and document page (2026-09-01)

**Status:** Independently reviewed, rebased, and merged in stack order: founding PR [#271](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/271) as `4074e657c94d68a4c2ad8cd67a269b8541b7ec90`, then document PR [#275](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/275) as `main@86da91c2fc16912c2f56dcf62d2dd53e2a8429be`. D-041 Cloudflare Workers Action [`33486435990`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33486435990) succeeded and published Worker version `33ce5c14-612c-4c79-87c3-d39219656c84`; the later release-record Action [`33488671926`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33488671926) published Worker version `1eb0b4b6-109f-4e70-b0a9-ed5e945ef541`. **Kitchen live HTTP is verified** at `https://hearth-books.jonathan-beaulne123.workers.dev/`: HTTP `200`, `Cache-Control: no-store`, and the served `index-0symyTI8.js` contained the founding and Charter-page markers at verification. The earlier `NXDOMAIN` finding came from a stale hostname that omitted the hyphen in `jonathan-beaulne123`, not from a disabled Worker route. This is Development kitchen publication, not Production continuity or Production household data.

**Household outcome:** An empty shared household can found its Charter through five quiet questions without creating an account or moving money; once founded, More opens the paper agreement with equal signature lines and only the viewer's own blank line offers Sign.

**Dual Course:** founding Budget `+2` / Engagement `+3`; document Budget `+1` / Engagement `+3`. Books won: Charter writes remain non-financial, TXN/SHF still require CAD accounts, unsigned is valid, remainder stays authored rather than computed, and the page adds no nag, badge, or partner-directed prompt.

**Verification:** Slice 3 rebased head `7a1e6175210eaa83b65778109925113f8addf805` passed PR CI `33484036459`: `221` files passed / `2` skipped, `1,523` tests passed / `3` skipped, TypeScript and both builds green. Slice 4 rebased head `e8f6a94fe643922ae7a5a8908c1ba88882ecd195` passed focused `66/66` and PR CI `33485352450`: `223` files passed / `2` skipped, `1,534` tests passed / `3` skipped, TypeScript and both builds green. Final-main CI [`33486436015`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33486436015) passed the same `1,534` / `3` gate. No P0/P1/P2 review finding remained. CI is recorded separately from the D-041 publish because merged, published, and live are distinct states.

**Boundaries:** No hosted schema, secret, provider setting, Supabase row, real household row, Production flag, or Production continuity was touched. The only environment action was the authorized D-041 Worker publication from `main`.

## D-189 Charter integrity repair (2026-09-01)

**Status:** Merged through [#274](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/274) as `main@450be34b6bc84f5bf5e203154c864cccba198eb5` and published to the Development kitchen. Main CI `33478168942` and Cloudflare Workers `33478168914` passed; Worker version `ae1df573-e6f9-43a2-af78-c67c03d0318e` is live. No hosted row, schema, secret, Production-continuity, or household-data action.

**Household outcome:** The Charter refuses a later Fund setup with a different custodian, retains independently created signatures/permissions/amendments across device convergence, and changes ceiling units only through one amendment carrying its typed value.

**Budget delta (5):** `+4` — closes silent agreement loss, custody disagreement, and unit reinterpretation without changing money.

**Engagement delta (3):** `0` — trust repair only; Charter UI slices remain separate.

**Implementation:** `HouseholdCharter.termsUpdatedAt` separates scalar-term authority from routine record activity. `mergeHouseholdCharters` merges member signatures and stable-id subrecords, replays resolved amendments deterministically, and applies Fund custody as the final invariant. `proposeCharterCeilingAmendment` carries kind plus integer cents/tenths atomically. `configureHouseholdFund` checks an existing Charter before mutation.

**Verification:** Current-main focused Charter/commands/materialization/outbox/CAS plus new-neighbour proof passed `100/100`. The exact-worktree Windows gate passed: AI-surface verification, `218` test files passed / `2` skipped, `1,499` tests passed / `3` skipped, TypeScript, Vite production build, and Hercules Pro UI build. Two independent final exact-diff audits and the PR code review found no P0–P3. PR CI `33477214483`, preview deploy `33477214530`, main CI `33478168942`, and production Worker publish `33478168914` passed. Live HTML returned `200` with `no-store`, and the served bundle contained the Charter integrity markers.

**Boundaries:** No money command or accounting formula changed. No UI, Supabase, migration, hosted data, provider, Production flag, or secret changed. The only environment action was publishing the reviewed client/Worker bundle to the Development kitchen under D-041.

## Charter page and empty signature line (2026-09-01)

**Status:** Draft PR [#275](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/275) on `cursor/charter-page-021f`, stacked on slice 3 draft [#271](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/271). **Not merged, not kitchen-published, not live.** Risk **High** (presentation). Sign/revoke reuse existing Charter commands. No Production household mutation, hosted schema, or secrets.

**Household outcome:** The household charter reads as a paper document. An unsigned line is the same rule and name as a signed one, with nothing added. The viewer may sign only their own line. The other person's blank line is silent.

**Budget delta (5):** `+1` — display of the existing Charter record. No posting, no second envelope.

**Engagement delta (3):** `+3` — the agreement is visible, patient, and never accusing.

**If they conflicted:** books won. No badge, nag, streak, or nav count on an unsigned line. More card no longer says to sign. Held amendments never read as a refusal.

**What changed:** `charterView.ts` (`SIGNATURE_VIEW`, `signatureLines`); `Charter` overlay; More → the charter opens the page when founded. Worksession: [`worksessions/2026-09-01-charter-page.md`](worksessions/2026-09-01-charter-page.md).

**Verification:**
- Focused page + founding + record + commands + Bianca `app-startup-p1` + `month-rehearsal-mainline`: **39 passed**.
- `pnpm check` on `53c0bcc`: AI surface verified; **1486 passed / 3 skipped**; `tsc` + Vite + Hercules Pro UI green. Follow-up commit is touch-target + More copy + docs.
- Independent books audit: **PASS**. Independent UX audit: **PASS WITH NOTES**; P1 sign/revoke `min-width: 44px` fixed after the audit.
- Browser, fictional Development demo: More → the charter document; Jonathan signed only his line (`1 Sept 2026`); Bianca unsigned with no pending copy; close; viewports 320 / 390 / 720 / ~1100.

**Uncertainty:** Stacked on unmerged slice 3. Dark/forced-colors not verified. App More wiring is not jsdom-covered. `origin/main` has moved to `450be34` (#274 integrity). GPT merge packet requires rebase before land.

**Data and environment disclosure:**
- Development impact: none (branch/PR only)
- Production impact: none
- Network calls or data sent: GitHub push of this branch
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none (Worker preview is not the kitchen URL)
- Real household or partner-personal data used: none (fictional Development / catalog)

**Next owner:** Jonathan asked GPT to review and merge slices 3 and 4. Paste-ready packet: [`briefs/CHATGPT_CHARTER_3_4_REVIEW_MERGE.md`](briefs/CHATGPT_CHARTER_3_4_REVIEW_MERGE.md). Rebase onto current `origin/main` (`450be34`, includes #274 charter integrity) before merge. Merging `main` queues D-041 kitchen publish. Do not apply schema or touch Production.

## Charter founding conversation (2026-09-01)

**Status:** Draft PR [#271](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/271) on `cursor/charter-founding-flow-021f` at `7042d7eca20affd6d58ed2face1dab38fce587da`. Base Charter slice 2 sealed `origin/main@effd7b3` (local branch). **Not merged, not kitchen-published, not live.** Risk **High** (presentation). Writes only through existing Charter commands. No Production household mutation, hosted schema, or secrets.

**Household outcome:** From an empty household (members, no accounts/Fund/books), Shared Home opens a five-question founding conversation. Skip is a peer of Next. One person can found alone, then Sign it or Later. Catalog/demo kitchens stay on the office until More → the charter. Founding no longer requires a CAD account; posting still does.

**Budget delta (5):** `+2` — founding records the Charter; it does not post money or create a second envelope.

**Engagement delta (3):** `+3` — empty house opens on paper questions instead of an unexplained desk.

**If they conflicted:** books won. No ledger dollar figure in the flow. Kitchen-local Charter writes skip `requireCadAccounts`; TXN/SHF still require an active CAD account. Permissions grant only when the founder can give away their own confirm. Unsigned remains valid.

**What changed:** `commitCharterFounding`; `CharterFounding` takeover + More → the charter; `commit()` posting gate; focus trap / inert shell / heading announcement. Worksession: [`worksessions/2026-09-01-charter-founding-flow.md`](worksessions/2026-09-01-charter-founding-flow.md).

**Verification:**
- Focused founding + Charter record/commands + Bianca `app-startup-p1` + `month-rehearsal-mainline` on this tree: **34 passed**.
- `pnpm check` on `7042d7e` (pre-docs): AI surface verified; **1481 passed / 3 skipped**; `tsc --noEmit` + Vite **388 modules**; Hercules Pro UI green. Pre-existing 3 skipped unchanged.
- Independent books audit: first FAIL (P1 empty persist); re-audit **PASS** after `isLedgerWrite` gate.
- Independent UX audit: **PASS WITH NOTES**, then inert shell / heading focus / no nested headings in follow-up commits.
- Browser, fictional Development demo: More → the charter through five questions, Later, Escape does not dismiss; close screen at 320 / 390 / 720 / ~1100.

**Uncertainty:** Charter page is slice 4. Dark/forced-colors not verified. Empty-house auto-open is unit-tested; App wiring is not jsdom-covered.

**Data and environment disclosure:**
- Development impact: none (branch/PR only; Worker preview of a branch is not the kitchen URL)
- Production impact: none
- Network calls or data sent: GitHub push of this branch
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none (fictional Development / catalog)

**Next owner:** Jonathan asked GPT to review and merge with slice 4. Packet: [`briefs/CHATGPT_CHARTER_3_4_REVIEW_MERGE.md`](briefs/CHATGPT_CHARTER_3_4_REVIEW_MERGE.md). Rebase onto `origin/main@450be34` (#274) before merge. Kitchen publish follows merge to `main` (D-041).

## D-189 interrupted local PGlite recovery (2026-08-31)

**Status:** Local High-risk release candidate on `codex/pglite-interrupted-recovery` from clean `origin/main@87acccd4f358286693f7a65172aec39d6ca4adbc`. No push, PR, merge, deploy, cloud reset, hosted row, schema, secret, or Production action.

**Household outcome:** A saved household with an exact accepted financial receipt can reconstruct an absent/interrupted on-device PGlite projection and reopen Confirm only after the rebuilt journal passes the same hash/balance inspection. Missing or altered receipts and genuine mismatches remain blocked. The Development reset button no longer falsely says `Starting over…` merely because books validation is blocked.

**Budget delta (5):** `+4` — receipt-proved local books recovery without weakening the write gate.

**Engagement delta (3):** `0` — trust infrastructure; no companion behavior is appropriate while books authority is being repaired.

**Verification:** focused startup/readiness/reset plus real PGlite suites passed **33/33** across the first run; the final startup/readiness/reset rerun passed **12/12**, including exact rebuild options and the Retry-validation path. The exact final tree's complete suite passed **1,453/1,453** with **3** intentional skips after adding the bundled Python and Git Unix tools to this Windows shell. `pnpm ai:verify`, TypeScript, the production Vite build, the Hercules Pro UI build, and `git diff --check` passed. Two independent read-only reviews found no P0/P1 blocker; their notes are recorded in the worksession.

**Environment/data:** local synthetic tests only. Development and Production use the same receipt-gated local recovery logic, but Production continuity remains off and untouched. Google identity and Household/Personal scopes do not change. No peer device is required; outbox/offline/hosted behavior is unchanged.

**Worksession:** [`worksessions/2026-08-31-pglite-interrupted-recovery.md`](worksessions/2026-08-31-pglite-interrupted-recovery.md)

## Glance plates, seal lists, scrolling month sheet (2026-08-31)

**Status:** Merged [#265](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/265) as `main@7d01b62`. Kitchen Cloudflare Workers [`33460617226`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33460617226) **success**. Worker version `0a9ceae5-6227-409c-8121-dc964631b1e5`. Live `index-Cdc4gCTV.js` → lazy `Office-BC-mxQLw.js` with `desk-plate`, `aria-expanded`, “Income this month”, “Expenses this month”, `month-posted-list`, leftover-spend footing, and no `selectPlate` / `plate-on-stage`. CSS `index-CEcjvoXs.css` has `--stories-open-height: calc(680px + 2.2rem)`, `.desk-plate.is-open`, collapsed `min-height:80px`. HTML `Cache-Control: no-store`. **Merged and kitchen-published.** Risk was **High** presentation, then Release because Jonathan ordered merge/deploy. No Production household mutation, hosted schema, or secrets.

**Household outcome:** On wide Shared and Personal Home, the six left stories sit as short glance lines and grow in the mosaic for the drawing, footing, and Cabinet handle. They no longer replace the month sheet. Money in opens this month’s posted income rows. Money out opens this month’s posted expense rows. Leftover spend still goes to Plan. The centre stage is a six-open-card height with inner vertical scroll. iPhone `OfficePhone` still sends the two money seals to the blotter.

**Budget delta (5):** `+3` — glance lines and the two lists are the posted month, not a second Fund story.

**Engagement delta (3):** `+3` — less wall of text; one tap to the matching list; the month sheet no longer eats the whole desk.

**If they conflicted:** books won. Lists are display only. Refunds stay in `partitionLedger` `other`, not expenses. Shared lists use the floor’s visible `household`, not partner-personal rooms. No `goal.savedCents` writes. Phone seals stay on the blotter.

**What changed:** `DeskPlateModel.glance`; plates grow via `openPlateIds` instead of staging; `monthPostedRows`; Money in/out → `MonthPostedList`; leftover spend still `onGo("plan")`; `--stories-open-height` plus stage `overflow-y: auto`; a second tap on an open money seal closes the list. Integrated `origin/main@d29d2d6` (D-187/D-188) before publish. Worksession: [`worksessions/2026-08-31-desk-glance-seals.md`](worksessions/2026-08-31-desk-glance-seals.md).

**Verification:**
- Focused `test/desk-plates.test.ts` + `test/desk-plates-dom.test.ts` + Bianca `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` on `7d01b62`: **30 passed**.
- `pnpm check` on `7d01b62`: **1449 passed / 3 skipped / 0 failed**; TypeScript clean; Vite 384 modules; Hercules Pro UI green.
- Independent UX audit: keep; seal `aria-pressed` now toggles off on a second click.
- Browser, fictional Development demo (pre-merge): 1100 open plate with Month Spread still centre; Money in posted list; 720 stacked open plate; 390 phone still has wax seals and phone story tiles (not desk-plate Cabinets); leftover spend → Plan.
- Live kitchen HTML after merge deploy: `https://hearth-books.jonathan-beaulne123.workers.dev/` serves `Office-BC-mxQLw.js` with glance expand and this-month posted lists.

**Uncertainty:** Live forced-colors / reduced-motion DevTools. Phone blotter body is below the story strip, so a seal click can look like a no-op until you scroll. Video review noted possible plate-footing overlap while shrinking toward phone; `OfficePhone` does not render `DeskPlate`. Main CI `33460617301` was still running at kitchen-proof time.

**Data and environment disclosure:**
- Development impact: kitchen URL published via D-041 `wrangler deploy`
- Production impact: none (no Production household mutation, schema, or secrets)
- Network calls or data sent: GitHub push of `main`; Cloudflare `wrangler deploy` via Actions
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: Cloudflare Workers `33460617226` success; Worker `0a9ceae5-6227-409c-8121-dc964631b1e5`; no schema apply, no secrets change
- Real household or partner-personal data used: none (fictional Development demo)

**Next owner:** Jonathan. Hard-refresh the kitchen URL on wide Paper office Home. Leftover spend still Plan. Phone seals still blotter. **Merged and kitchen-published.** Not Production.

## D-187 founding-household rehearsal preflight (2026-08-31)

**Status:** Release-ready Development candidate on `codex/founding-household-preflight`, rebased onto exact `origin/main@2690c577aaad3c0b03f01ab33c403ef07c8fe65c`. Jonathan authorized rebase, merge, and deploy on 2026-08-31. The real rehearsal has not started, and Production remains out of scope.

**Household outcome:** Jonathan and Bianca cannot start or replay `Our month` until the current browser has downloaded a private Development backup, selected it again, proven it is the exact current balanced snapshot, and recorded the four named-human preparation acknowledgements. A changed household revision closes the gate again.

**Dual Course:** Budget `+4` through exact recovery-before-start and visible stop conditions. Engagement `+2` through one calm preparation card inside the existing D-183 Month surface. Confirm, PGlite acceptance, money meaning, and the four-week workflow are unchanged.

**What changed:** `verifyCurrentHouseholdRecovery` reuses the ordinary import validator, requires matching Development wrapper/embedded environments and household id, compares the financial audit hash, and compares a canonical full-snapshot SHA-256. It returns metadata only and performs no persistence or transport. `RehearsalPreflight` holds the proof and acknowledgements in React session state, announces download/error/status changes, and gates initial Start plus both replay routes. An interactive jsdom test proves upload-before-download stays blocked, fresh download/reselection plus all checks unlocks Start, revision change relocks it, and a mismatched wrapper error is announced.

**Verification:** exact rebased runtime candidate `6372c8d` is runtime/test-tree identical to fully checked candidate `5db7140ee53298efc1de9413f99779a9f77eec5a`, which passed AI-surface verification, **214 passed / 2 skipped files and 1,442 passed / 3 skipped tests**, TypeScript, the Vite Production build, Hercules Pro UI build, and redirect guard. The combined D-187, D-186 sync, QR/Auth/storage, startup, and Shared Home integration proof passed **16 files / 131 tests**. Independent trust/release, UX/accessibility, and verification re-reviews report no remaining P0–P2. Existing React `act`, PGlite browser-external/eval, and chunk-size warnings remain non-failing and unchanged.

**Environment/data disclosure:** local Development code and fictional tests only. The feature handles a user-selected private household export in browser memory, then discards it; it does not commit the file, send it to an AI/model, upload it, persist it, invoke continuity, access Supabase, alter schema/secrets/providers, touch Production, or create real rehearsal evidence.

**Open gates:** real separate Google identities, Household access/device inventory, the deployed build receipt, Personal isolation, the actual private backup file, weekly cadence, and stop agreement remain named-human Development evidence. Programs 1–6 and their elapsed-time gates remain open.

**Worksession:** [`worksessions/2026-08-31-founding-household-preflight.md`](worksessions/2026-08-31-founding-household-preflight.md)

## Desk plates — Shared and Personal Home mosaic (2026-08-31)

**Status:** Merged [#260](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/260) as `main@c75d72e`. Kitchen Cloudflare Workers [`33447063786`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33447063786) **success**. Worker version `e57b4a67-fbbb-45a2-b57c-043cda197101`. Live `index-BZnOtUHs.js` → lazy `Office-C6krQOJZ.js` with `desk-plate`, “What is due next”, “What the cards are doing”, `scope!=="personal"`, and Standing. CSS `index-D8gcAel_.css` has `.desk-plate-handle`. HTML `Cache-Control: no-store`. **Merged and kitchen-published.** Risk was **High** presentation, then Release because Jonathan ordered merge/deploy. No Production household mutation, hosted schema, or secrets. Migration 018 was already on `main` from #263; this session did not apply schema.

**Household outcome:** The six wide Home mosaic tiles on each floor are desk plates: a household question, a verdict sentence, one of six primitives, a footing, and a cabinet handle. Single click puts the plate on the stage in place of the Month Spread. Double-click and the handle open the existing instrument. Close returns to the Spread. Display only.

**Budget delta (5):** `+3` — mosaic answers household questions from existing selectors instead of repeating the Spread.

**Engagement delta (3):** `+3` — laptop open-to desk is a 2×3 instrument strip.

**If they conflicted:** books won. Shared plates never reintroduce `now` / `attention` / `change`. Pair uses one scale. Empty states are prose. Cabinet handle stays wherever double-click exists. No `goal.savedCents` writes. iPhone mosaic untouched. Shared `cards` never names a `scope === "personal"` card.

**What changed:** `src/core/plates.ts`, `src/core/deskPlates.ts`, `src/DeskPlates.tsx`, `src/desk-plates.css`; OfficeWide mosaic wiring; Shared Home mosaic column 460px below 1200px while F-4 still drops the Kitty shelf under the stage; ≥1200 uses `1.15fr | 1.75fr | 0.72fr`. Follow-up: `aria-current` on the plate, partner-personal card fence, merge of `origin/main` through D-186. Worksession: [`worksessions/2026-08-31-desk-plates.md`](worksessions/2026-08-31-desk-plates.md).

**Verification:**
- Focused `test/desk-plates.test.ts` **21 passed** (includes Bianca private Amex canary) plus `test/desk-plates-dom.test.ts` **1 passed**. After D-186 merge: plates + Bianca `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` **27 passed**; `tsc --noEmit` green.
- `pnpm check` on `7044423` (D-185 integrated, pre-D-186): **1425 passed / 3 skipped**; Vite 385 modules + Hercules Pro UI green.
- Independent UX audit: **PASS WITH NOTES** after F-1 / N-1 / N-2 repairs.
- Independent trust review: **FAIL** on personal-card leak before merge; fenced `account.scope !== "personal"`; canary green.
- Browser on fictional Development demo: click / close / handle / double-click / keyboard / Personal floor; viewports 320 / 390 / 720 / 1100 / 1440.
- Live kitchen HTML after merge deploy: `https://hearth-books.jonathan-beaulne123.workers.dev/` serves `Office-C6krQOJZ.js` with plate kickers and the personal-scope fence.

**Uncertainty:** Forced-colors and reduced-motion CSS exist; live Chrome Rendering emulation was not completed. `paperHomeMosaic` still encodes old story tile ids for Classic/helper tests; OfficeWide no longer calls it. Empty mosaic plates still echo the same sentence in verdict and `.desk-plate-empty`.

**Data and environment disclosure:**
- Development impact: kitchen URL published via D-041 `wrangler deploy`
- Production impact: none (no Production household mutation, schema, or secrets)
- Network calls or data sent: GitHub push of `main`; Cloudflare `wrangler deploy` via Actions
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: kitchen SPA only; no schema apply; no secrets changed
- Real household or partner-personal data used: none (fictional Development demo seed; privacy canary is synthetic)

**Next owner:** Jonathan. Hard-refresh `https://hearth-books.jonathan-beaulne123.workers.dev/` on a wide Paper office Home. Classic desk still needs Drawer → Paper office. iPhone Home is unchanged.

## D-185 gap-closing evidence foundation (2026-08-31)

**Status:** Local Release-risk candidate on `codex/gap-closing-foundation`, rebased onto `origin/main@aa56f373ab62dbfec1dfa744e6c8b3606caee4c7`. **Not pushed, merged, deployed, or presented as Production evidence.**

**Household outcome:** Jonathan and Bianca get a fail-closed five-dimension release gate plus repeatable browser evidence for the public roadmap task/recovery journeys. Roadmap tabs now activate with Enter and Space as well as arrow/Home/End keys. The public-only collector covers 320/390/430/720/1100 px, screenshots, redacted console/page errors, all-origin network failures, timeouts, overflow, actual keyboard focus order and tab-panel semantics, full axe findings, measured 200% text growth/content bounds, and normal-versus-reduced motion behavior.

**Budget delta (5):** `+3` through evidence that refuses to call a money/privacy/recovery claim complete when artifacts are stale, mismatched, synthetic, local-only, or missing human acceptance. **Engagement delta (3):** `+2` through real-browser keyboard, focus, responsive, zoom, and reduced-motion proof. No money meaning, posting, continuity, Auth, or hosted authority changed.

**What changed:** D-185/P0-03 evidence contracts and evaluator were reconciled onto current main; browser collection uses Playwright plus axe and writes only ignored, hash-linked local artifacts; the public-roadmap tablist explicitly accepts Enter/Space; and `check:windows` discovers the bundled Bash, real Python, Node, and pnpm runtimes without weakening `pnpm check`. Browser reports are permanently `claimable: false`; exact clean deployment, live-origin evidence, privacy review, hands-on review, and a named human remain required for any literal `5/5`.

**Verification:** focused gate/collector/roadmap tests passed **3 files / 30 tests**, including deliberate redaction, private/cross-origin refusal, and reduced-motion red fixtures. The latest runtime-bearing exact tip passed AI-surface verification, **210 passed / 2 skipped files and 1,403 passed / 3 skipped tests**, TypeScript, the 383-module Vite production build, Hercules Pro UI build, and the no-`dist/_redirects` guard. Its ignored browser report passed **10/10** public-roadmap task/recovery runs over all five widths with zero serious/critical axe findings, console/page errors, all-origin network failures, timeouts, overflow failures, focus-order failures, text-resize failures, or reduced-motion failures and remains `claimable: false`. The implementation content is now `110337c` after the final clean rebase over the upstream documentation-only closeout; the exact final branch SHA and repeated focused/browser receipts are reported in the external handoff because a commit cannot contain its own SHA. Existing React act, PGlite browser-external/eval, and chunk-size warnings remain unchanged.

**Data and environment disclosure:** local static synthetic/public-roadmap content only. No real household amounts, descriptions, identities, partner-personal data, credentials, model input, MCP household access, hosted rows, schema, secrets, provider settings, Production, push, merge, or deploy action. Browser artifacts remain ignored under `artifacts/browser-evidence/`.

**Open gates:** Program 0's local evidence foundation is closed. Program 1–6 still require elapsed Jonathan/Bianca rehearsal, two-device evidence, access/security work, Production approval, and later design-partner consent; none is implied by this packet.

**Worksession:** [`worksessions/2026-08-31-gap-closing-evidence-foundation.md`](worksessions/2026-08-31-gap-closing-evidence-foundation.md)

## D-186 automatic last-entry-wins reconciliation (2026-08-31)

**Status:** Release review **PASS** on runtime candidate `aa774baed47183dd4ca4a3ee66a21d0a1c0c9447`, rebased onto `origin/main@201a449cb99251c8a66eb3b282d950305752d1f1`. Jonathan authorized commit, push, merge, and Development kitchen publication on 2026-08-31. Live household use, schema, hosted rows, secrets, and Production are not authorized.

**Household outcome:** the “Two versions need review” snapshot chooser is removed. Distinct entries from both phones remain; the later accepted same-id entry wins automatically; old saved conflicts and blocked retries self-heal in the background. Accepted reversals stay immutable.

**Budget delta (5):** `+4` — no whole-ledger discard decision, while PGlite, double-entry, scope, audit hash, idempotency, and reversal history stay authoritative. **Engagement delta (3):** `+3` — ordinary recovery is quiet and a sharing delay remains a non-blocking Retry/background state.

**What changed:** ordered command replay now applies later same-id facts; snapshot recovery uses existing record-level recency and an explicit canonical tie-break; persisted conflicts are upgraded; old conflict-blocked outbox rows retry; the modal and its review copy are gone. Worksession: [`worksessions/2026-08-31-last-entry-wins-sync.md`](worksessions/2026-08-31-last-entry-wins-sync.md).

**Verification:** current-main focused sync/accounting/recovery gate **78 passed**. Exact `pnpm check` passed: AI surface verified, **1,410 passed / 3 skipped / 0 failed**, TypeScript clean, kitchen production build complete, Hercules Pro UI build complete, and no-redirect guard passed. Independent exact-head verifier passed 12 focused files / 119 tests plus TypeScript; independent money/trust review and release review both returned **PASS; no P0/P1**. `git diff --check` passed. Existing Vite/PGlite bundle warnings and React test `act(...)` warnings remain non-failing and outside this packet.

**Next owner:** Codex completes the authorized current-main release and exact Development verification. A live signed-in two-device rehearsal remains a separate evidence gate.

## The Month Spread — Shared Home centre (2026-08-31)

**Status:** Merged [#259](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/259) as `main@d648258`. Canon record `main@ed852a8`. Kitchen deploys Cloudflare Workers [`33432365828`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33432365828) (merge) and [`33432832963`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33432832963) (docs record) both **success**. Current Worker version `2488cac3-f052-48a9-8200-65d5ee848f4b`. Live bundle still `Office-BBr3Ic0W.js` with Standing bars and “A proposal is not on the bar.” **Merged and kitchen-published.** Risk was **High** (presentation plus F-2/F-3). No Production household mutation, hosted schema, or secrets.

**Household outcome:** Shared Home's centre is the month as one sheet — Standing, Course, Docket. Standing names each person's confirmed Fund contributions this month (demo Bianca `$1,600.00`, Jonathan `$1,660.00`). Seals, mosaic, Kitty Banks, FAB, and Add slideshow stay.

**Budget delta (5):** `+3` Spread / `+1` bars. **Engagement delta (3):** `+3` / `+1`. Books won: proposals off the bar; both fills pine; Course from `booksHousehold`; Docket never posts.

**What changed:** `sharedMonthCourse` plus Month Spread; F-1 Kitty rollover as a claim; F-2 reconciliation covering `date`; F-3 monthly target = this month's confirmed contributions; Standing `contributionsByMember` paper bars; Course compiled from accepted books. Integrated `origin/main` through D-184 before merge. Worksession: [`worksessions/2026-08-31-month-spread.md`](worksessions/2026-08-31-month-spread.md).

**Verification:**
- Focused `test/month-spread.test.ts`: **33 passed**. After integrating `main@1650910`, focused Spread+Add **60 passed**; `pnpm check` **1377 passed / 3 skipped**.
- Kitchen HTML `https://hearth-books.jonathan-beaulne123.workers.dev/` after the docs-record deploy still serves `index-DQXFR0dT.js` → lazy `Office-BBr3Ic0W.js` with `ms-contrib`, `I · Standing`, `II · Course`, `III · Docket`, and “A proposal is not on the bar.” CSS `index-CsctdKPv.css` has `ms-contrib`. HTML `Cache-Control: no-store`.
- Pre-merge Paper office demo: Bianca `$1,600.00`, Jonathan `$1,660.00`; Fund free-to-spend `$2,018.60` ≠ leftover-spend `$498.64`.
- Books **PASS WITH NOTES**; UX `role="group"` **PASS**; security review no medium+ findings.

**Environment/data:** fictional Development demo seed for local proof. Kitchen publish is D-041 `wrangler deploy` of the SPA. No Production household rows, schema, or secrets changed.

**Next owner:** Jonathan. Open the live kitchen on a wide Paper office Home and confirm Standing bars. Classic desk still needs Drawer → Paper office. iPhone Home is unchanged.

## D-181 Add slideshow + FAB onto current main (2026-08-31)

**Status:** Integration `3b0598c` on `cursor/add-slideshow-main-aef7` (plus unused-`shiftStep` follow-up). Base `origin/main@683910bc19f067ed5a9f4adee394f6026cda0899`. Jonathan ordered **merge, push, and deploy**. Risk: **Release**. Kitchen-desk D-173 already shipped via #252.

**Household outcome:** Live kitchen `+` opens Shift / Income / Expense / Transfer. Add is unique cashpad prompt slideshows. Confirm still posts. Slideshow never `postEntry`.

**Budget delta (5):** `+3` — calmer posting; accepted-books account tiles; Confirm remains the write.

**Engagement delta (3):** `+3` — unique ceremonies instead of one dense sheet.

**If they conflicted:** books win. Cut flourish before auto-posting or hiding Confirm. Pictures stay on this phone.

**What changed:** Merged `#244` unique commits onto current `main`. Kept `main` D-165–D-180 (Shared Money stays D-174). Renumbered Add slideshow **D-181**. Shift jobs panel uses D-175 deferred surfaces. Clocked hours use D-178 `ShiftElapsedHint`. CadPad keeps `emptyDisplay` and giant Enter. D-175 startup tests walk to `[data-add-confirm]`.

**Verification:**
- Focused: `pnpm exec vitest run test/add-slideshow.test.ts test/add-slideshow-ui.test.ts test/household-fund-ui.test.ts test/ledger-story-ui.test.ts test/fab-speed-dial.test.ts test/app-kitchen-boot.test.ts test/app-startup-p1.test.ts` → pass.
- Full `pnpm test` at `3b0598c` (before unused-`shiftStep` tsc fix): **1297 passed / 3 skipped**.
- `pnpm ai:verify` + `tsc --noEmit` + Vite production build (373 modules) + Hercules Pro UI after removing unused `shiftStep`.
- Independent books **PASS** (no P0/P1; P3 hours emptyDisplay closed). Privacy **no P0/P1**. Trust P0 (startup Post selector) closed by walking to Confirm.

**Data and environment disclosure:**
- Development impact: kitchen URL after D-041 deploy
- Production impact: none (no Production household mutation, schema, or secrets)
- Network calls or data sent: GitHub fetch/push; Cloudflare `wrangler deploy` via Actions on `main`
- MCP access: none for household data
- Hosted rows/schema/secrets: none until the authorized kitchen deploy
- Real household or partner-personal data used: none

**Next owner:** this session merges to `main` and verifies `https://hearth-books.jonathan-beaulne123.workers.dev/`.

**Worksession:** [`worksessions/2026-08-31-merge-deploy-add-slideshow.md`](worksessions/2026-08-31-merge-deploy-add-slideshow.md)

## D-180 ledger-native sync pilot (2026-08-31)

**Status:** Development release merged through [PR #256](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/256) as exact `main@e9c5127594a9fd4e6d8b203f19db57cc4b31390a` and deployed by successful Cloudflare run [`33403561188`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561188). **Not activated for daily use or proven through the live matrix or fourteen-day rehearsal.** The implementation was built from freshly fetched `origin/main@2a984fd3346dc0b57d0e7b6a17702c18b82596d3`; the original dirty `codex/roadmap-site` checkout remained untouched.

**Household outcome:** Jonathan and Bianca get a bounded Development rehearsal of command-normal two-device books: durable offline acceptance, immediate partner updates, explicit same-fact review, truthful freshness/fallback states, session/device revocation, and privacy-safe diagnostic evidence. Production continuity remains off.

**Dual Course:** Budget `+2 x 5 = +10` through no-silent-loss offline/concurrent/replacement-device recovery. Engagement `+2 x 3 = +6` through immediate partner activity and calm, truthful status.

**What changed:** the Pages build now requires Auth, Development Realtime, and command log on, requires Production continuity off, and enables a Development-only local diagnostic. The diagnostic retains at most 500 constrained records (enough for a multi-phase 100-event run), hashes identifiers, summarizes receiving-device latency, and refuses Production; it contains no money, merchants, notes, emails, tokens, or raw ids. Command replay still auto-converges disjoint additive facts and dedupes events, but true same-fact/reversal divergence now preserves both versions and opens the existing explicit resolution sheet. The Pairing Advanced surface can copy the sanitized diagnostic. Canon and the live/rehearsal runbook are in [`SYNC_PILOT.md`](SYNC_PILOT.md).

**Hosted inventory and release:** read-only provider inspection on 2026-08-31 found migrations 001–017 and Realtime publication entries for `continuity_command_events`, `continuity_personal_snapshots`, and `household_snapshots`. The approved branch head `0f54fa28e59db6997fa7c96bceb8a51f242c51d3` passed PR CI/deploy checks, merged as exact `main@e9c5127594a9fd4e6d8b203f19db57cc4b31390a`, and deployed successfully. Live assets contain the diagnostic action, command-Realtime marker, Production refusal, and offline-cache warning. No schema, hosted household row, provider setting, Production state, secret, or daily-use setting changed.

**Verification:** pre-change continuity baseline passed 22 files / 186 tests. Current-diff sync/Auth/recovery/books/UI proof passed **30 files / 265 tests**; the final Production/privacy repair gate passed **10 files / 86 tests**, and the representative remote-hash conflict/realtime gate passed **5 files / 47 tests**. After current main gained the Google Auth containment release, the rebased Auth/session/sync interaction gate passed **15 files / 137 tests** and exact `pnpm test` passed **1,289 tests / 3 skipped** across 194 passed / 2 skipped files. `pnpm ai:verify` (41 required files), `tsc --noEmit`, pilot-flagged production build (368 modules plus Hercules Pro UI), and `git diff --check` passed. Semantic access/diagnostic UI passed at 320/390/720/1100 px; a local browser spot-check copied the sanitized zero-sample bundle. Independent books and trust reviews passed with no open P0–P2; release re-review passed its 39-test code surface. Exact-merge main CI run [`33403561215`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561215) and Cloudflare run [`33403561188`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561188) both passed. Live two-device proof remains required before a pilot-success claim.

**Open pilot gate:** run the full two-account matrix with at least 100 new Shared event samples at `<=500 ms p95`, then complete the fourteen-day disposable Development rehearsal. Do not claim “Docs-like Development sync proven for Jonathan and Bianca” before every exit criterion passes. On money loss, duplicate, invalid books, privacy/cross-environment leak, or false Synced state, stop sharing and preserve replicas/outboxes.

**Worksession:** [`worksessions/2026-08-31-google-docs-sync-pilot.md`](worksessions/2026-08-31-google-docs-sync-pilot.md)


## SF-02 Shared Money membership and device access (2026-08-30)

**Status:** Release candidate on `codex/shared-money-program` from exact SF-01 `eceb5ebaeb3db8d8494c0870579cc463859e8619`. Migration **017 is applied to disposable Development** and the hosted authority smoke passed. Merge/deploy and live-client verification remain in progress. Risk: **Release**.

**Household outcome:** Jonathan and Bianca can be independently authenticated equal co-owners, inspect sanitized Auth access, remove devices, leave safely, and recover without turning soft presence or a UI filter into authority.

**Budget delta (5):** `+2` through explicit membership/session authority and former-member replay denial. **Engagement delta (3):** `+1` through a calm access and recovery surface. No financial posting, rail, bank, provider, or notification authority changed.

**What changed:** D-176; local migration 017; co-owner/member invitations; Supabase JWT `session_id` capture; live-session plus non-revoked-device membership gates; RPC-only device registration/list/revoke; metadata-only access audit; ordinary-member revoke; voluntary leave/last-owner protection; Auth phone identity lock; explicit offline/rejoin consequences; tests and canonical evidence.

**Verification:** final focused SF-02/Auth gate passed **6 files / 59 tests**; `tsc --noEmit`, Vite production build (359 modules), Hercules Pro UI build, no-`dist/_redirects`, and diff check passed. Migration 017 was applied from SHA-256 `6fd14ecde4755e346d8c46f510ea787d2f99a3a49bd98101f1ab66ce5b8839c1`. A transactional hosted smoke using two distinct existing Google principals passed invite/replay/replacement, RLS isolation, session registration/revoke, member revoke, Personal-seat reuse denial, last-owner/leave, sanitized audit, and anonymous/private-schema denial, then rolled back. Security Advisor reported 0 errors; its 18 warnings are the intentional guarded `SECURITY DEFINER` RPC surface. Exact evidence is recorded in [`worksessions/2026-08-30-shared-money-sf02.md`](worksessions/2026-08-30-shared-money-sf02.md).

**Environment/data:** the shared Supabase project had 2 Development and 0 Production households at apply. The schema apply was project-wide, but no Production household data existed or changed. The smoke used synthetic rows inside one transaction and ended with `ROLLBACK`; postflight counts were 0 synthetic households, 0 registered sessions, and 0 audit events.

**Open Release gate:** merge/deploy plus live-origin Google configuration and signed-in access-panel verification. Semantic access-panel coverage passed at 320/390/720/1100 px; rendered browser, keyboard, and screen-reader proof remains narrower than the hosted authority proof.

**Next owner:** Codex for the already-authorized merge, deploy, and live-origin smoke. After that gate, the next feature packet is SF-03.

**Worksession:** [`worksessions/2026-08-30-shared-money-sf02.md`](worksessions/2026-08-30-shared-money-sf02.md)

## SF-01 Shared Money baseline reconciliation (2026-08-30)

**Status:** Implemented locally on `codex/shared-money-program` against exact `origin/main@9376c30ba5db55c920d15ce3feacb65dedae5733`. **Not pushed, merged, deployed, activated, or live.** Risk: **High** (truth/governance; no financial behavior change).

**Household outcome:** every Shared Money prerequisite now has one Development-versus-Production truth row, end-to-end trace, owner, rollback, proof, and explicit unknowns. This prevents future AIs from mistaking a flag, migration file, virtual Fund, or roadmap decision for a working bank capability.

**Budget delta (5):** `+1` through reconciled money-authority and continuity truth. **Engagement delta (3):** `0`; no household interaction changed.

**What changed:** added [`SHARED_MONEY_BASELINE.md`](SHARED_MONEY_BASELINE.md) and [`shared-money-baseline.json`](shared-money-baseline.json); corrected stale continuity, membership, import, Fund/provider, roadmap, and policy-comment claims; added contradiction tests for D-161, D-162, D-172, D-174, environments, flags, and baseline completeness. D-172 remains current financial-write law; D-161 remains virtual; D-162 Fund-specific connected evidence remains read-only and Release-gated.

**Verification:** SF-01 focused **2 files / 7 tests** passed; after fixing one aggregate-discovered doc-contract wording mismatch, affected focused proof passed **3 files / 15 tests**. AI surface, `tsc --noEmit`, Vite production build (359 modules), Hercules Pro UI build, no-`_redirects`, and `git diff --check` passed. Full `pnpm check` is **not green** on Windows: `test/api.test.ts` invokes unavailable `bash` (`spawnSync bash ENOENT`). Its first run also caught the now-repaired wording mismatch; aggregate was not rerun after that narrow fix. The literal `pnpm build` wrapper likewise starts with Unix `rm`; its equivalent build steps passed.

**Environment/data:** documentation, one code comment, and tests only. No network call, live-data read, provider, schema, secret, Production, bank, household-data, push, merge, or deploy action.

**Next owner:** run SF-02 from the reconciled baseline. Jonathan approval remains required before push/PR and separately before any external mutation.

**Worksession:** [`worksessions/2026-08-29-shared-money-program.md`](worksessions/2026-08-29-shared-money-program.md)

## D-174 Shared Money program canon (2026-08-29)

**Status:** Local SF-00 implementation and focused verification on `codex/shared-money-program`, rebased without conflict onto exact `origin/main@54096553825bdaa331dca26c2dc963d754e1c583`. **Not pushed, merged, deployed, activated, or live.** Risk: **Release** (company direction; documentation/test slice has no runtime authority).

**Household outcome:** Hearth now has one execution index for becoming a partner-backed Canadian joint-account company for Jonathan and Bianca while preserving private personal accounts and current Confirm law.

**Budget delta (5):** actual `0`; program potential `+5`. **Engagement delta (3):** actual `0`; program potential `+2`. Books win: D-172 remains current law, D-161 remains virtual, and D-162 Fund-specific connected evidence remains read-only/Release-gated.

**What changed:** D-174, canonical phases and exit gates, SF-00 through SF-05 packets, worksession, roadmap/index pointers, and structural safety tests. No runtime code, schema, provider, secret, bank credential, money movement, Production, or real household data.

**Verification:** focused structural test 3/3; AI surface and `git diff --check` passed. A proper isolated offline dependency install succeeded. Real `pnpm check` ran for 248 seconds and is **not green**: the Windows Bash/Python sanitizer harness failed in `test/api.test.ts`, and the unchanged Hercules Pro Personal-shift fixture persistently returned `empty` rather than `ok`. The latter reproduced in isolation while SF-00 passed beside it. The earlier junction-caused `miniflare` condition disappeared and the Evidence local harness passed. Current-baseline `tsc --noEmit`, Vite production build, Hercules Pro UI build, and `_redirects` absence passed.

**Next owner:** independent SF-00 verification, then the AI assigned SF-01. Jonathan approval is required before push/PR and separately before any external mutation.

**Worksession:** [`worksessions/2026-08-29-shared-money-program.md`](worksessions/2026-08-29-shared-money-program.md)

## Kitchen desk + current main integration (D-164–D-173) (2026-08-29)

**Status:** Integrated and independently verified locally on `codex/kitchen-desk-integration` from exact `origin/main@4b2f40064b526541ef7a20d6e99fc99ca5647baa` plus UX head `ed708dc358ed808fbc5a9ec89b6c95bdb9a55a60`. Merge commit `f1daa78bfc1bfc7df3967b597f7af9e3675ff352`; verified implementation `ca8c84a108f9310a3426cf122c51258009963213`. **Not pushed, merged, deployed, or live.** Risk: **High**.

**Household outcome:** Shared Home remains the composed cream-paper desk with seals, mosaic, stage, and Kitty Banks. Personal Books remains the serious accepted-books account floor. Current-main Shift mail, attendance, Evidence, confirmed Bibles, boot recovery, and concrete companion labels stay in the same organism. Shift mail sits below Tip climate and posted cash/card/wage bubbles; it does not become Home furniture.

**Budget delta (5):** `+5` — accepted-books CAD, posted in/out leftover, partner-personal denial, visible Confirm, and D-172 collection-only automation survive one integrated kitchen.

**Engagement delta (3):** `+2` — current-main Shift instruments inherit the existing paper grammar without a new skin or iPhone redesign.

**If they conflicted:** books won. The integration preserved current-main boot/privacy/Confirm boundaries, PR #244's Home/Books/Kitty grammar, and moved only the Shift notebook and the tablet breakpoint needed to satisfy the locked layout.

**What changed:**
- Merged the exact UX lineage into a fresh current-main branch without rebasing or force-pushing PR #244.
- Kept D-165 Evidence Queue through D-172 Shift-envelope law and renumbered the kitchen-desk law to D-173.
- Combined `projectLedgerExperience`, Personal Books floor, accepted-snapshot export/writes, Kitty Banks, desk seals, Calendar kind colour, Hercules leftover fence, current-main coworker disclosure, D-167 ErrorBoundary/identity defense, Shift envelopes/attendance/Evidence/Bibles, and concrete capture labels.
- Placed Shift mail after Tip climate and posted cash/card/wage bubbles. No Evidence/coworker/envelope surface was added to Shared Home or Personal Books.
- Initial books/privacy review found that Personal Audit, Ask, and downloads still compiled the accepted household. The repair adds one adversarially tested `booksPresentationFloor`: Shared gets household/both only; Personal gets household/both plus the signed-in member's rooms. All Books read/export surfaces use it; accepted books remain write-only authority. Device-wide Power SQL is withheld from scoped floors.
- Books re-review then caught Import Confirm building from the presentation clone, which could discard hidden regular reconciliation rows. `BatchImportCard` now separates `household` (scoped review) from `writeHousehold` (accepted command source), with Shared and Personal regression proof that partner reconciliation survives Confirm.
- UX review's only P2 is closed with a scoped 44 px minimum touch target for Shift tabs.
- Fixed a merge-exposed specificity bug so Shared Home stacks at 720–899 px and becomes three columns only at `>=900px`.

**Verification so far:**
- Integrated focused gate before final placement: 10 files / 67 tests passed.
- Post-placement/breakpoint gate: 10 relevant files / 67 tests passed plus `test/ledger-story-ui.test.ts` 6/6 after the new breakpoint assertion. React test-environment `act(...)` warnings remain non-failing baseline noise.
- Full `pnpm check`: AI surface passed; aggregate tests reached **1176 passed / 2 skipped / 2 failed**. `test/api.test.ts` failed because Windows lacked `bash`; with Git Bash plus the bundled Python exposed, it passed **8/8**. `test/hercules-rig.test.ts` sampled the same walk angle twice, then passed **10/10** on isolated rerun; its test and engine blobs are byte-identical to `origin/main`.
- Windows-equivalent build gate: `tsc --noEmit`, Vite build, Hercules Pro UI build, and no `dist/_redirects` all passed.
- Browser proof with fictional Development demo only: 1100 px three-column desk; 720 px stacked `seals → mosaic → stage → banks`; 390/320 px `OfficePhone`; no horizontal overflow; correct three seal labels; Personal Books accepted-position hero; Shift mail after posted bubbles; keyboard focus ring 2 px pine on a 52×69 px control; zero console errors.

**Data and environment disclosure:**
- Development impact: local synthetic/demo browser state only.
- Production impact: none.
- Network calls or data sent: package install/download resolution and localhost only; no provider, Supabase, Gmail, 7shifts, or household-data call.
- MCP access: local in-app browser only; no household connector or database MCP.
- Hosted rows / schema / secrets / deployments: none.
- Real household or partner-personal data used: none.

**Verification:** Books, privacy, UX, and trust report no open P0–P2 on the verified implementation. The verifier found no P0–P2 and classified only its missing-`bash` runner as conditional; the final aggregate with Git Bash and bundled Python exposed closes that environment condition: 175 files passed / 1 skipped, 1182 tests passed / 2 skipped, plus TypeScript, Vite, Hercules Pro UI, and `_redirects` absence.

**Next owner:** Jonathan for the push/draft-PR decision. Codex did not push, merge, deploy, or call this live.

**Worksession:** [`worksessions/2026-08-29-kitchen-desk-main-integration.md`](worksessions/2026-08-29-kitchen-desk-main-integration.md)

## Blank kitchen when loading a household (D-167) (2026-08-28)

**Status:** Draft PR [#238](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/238) on `cursor/blank-household-google-boot-b30c` at `529b983`. **Not merged, not D-041 kitchen-live.** Risk: **Medium** (kitchen boot / Google identity / ErrorBoundary; no money write, schema, secrets, or Production). Jonathan later said the blank is **fixed**.

**Household outcome:** Welcome still works. Opening a household must show the kitchen, not a blank `#root`. If a remaining kitchen throw escapes, paper recovery offers Reload, Sign out of Google, or Open welcome. Nothing is posted.

**Budget delta (5):** `+5` — a blank kitchen after household open makes the books unusable.

**Engagement delta (3):** `+1` — paper recovery if another throw escapes.

**If they conflicted:** books win. Recovery never `postEntry`. Invalid Tip Tracker settings still fail at Confirm. Preview zeros on invalid present settings instead of painting catalog CAD.

**What changed:**
- PR **#235** (already on `origin/main` / live kitchen) moved the Evidence automation `useEffect` above `if (booting)` — that was the hook-count crash that only ran after household+session.
- This PR adds defense: `continuityIdentityFromGoogle` (no `googleSession?.identity.email` throw), GIS tokens without identity are skipped, missing `shiftSettings` default on shape, kitchen preview uses `previewShiftAmounts`, App-level `KitchenErrorBoundary`, continuity replay returns when identity is missing.

**Verification:**
- Focused `test/app-kitchen-boot.test.ts` (6 tests) green.
- `pnpm check` at `529b983` → **1044 passed / 2 skipped**, `tsc` + Vite build green.
- Independent books-auditor: **PASS WITH NOTES** (preview must not paint catalog CAD for invalid present settings — zeros now).
- Independent privacy-auditor: **PASS WITH NOTES** (replay no longer sends empty identity).
- Independent UX-auditor: **Dual Course PASS** (Sign out now also clears member session so recovery cannot loop).
- Independent verifier: **CONDITIONAL** until this handoff and worksession close (addressed here).
- Local Vite `127.0.0.1:5173`: demo household → “I am Jonathan” → kitchen at 390px, not blank. Broken GIS token without identity + reload still showed kitchen. 720px kitchen still painted.
- Live kitchen `hearth-books.jonathan-beaulne123.workers.dev` (PR #235 bundle): household Home painted, not `#root` empty. Jonathan: “its fixed.”

**Data and environment disclosure:**
- Development impact: none (client boot/recovery only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for this packet
- Hosted rows/schema/secrets/deployments: none. No merge, no D-041 publish.
- Real household or partner-personal data used: none. Fictional Development demo catalog. Live screenshots are the public kitchen URL with fake `#access_token=not.a.jwt`, not a data source.

**Remaining uncertainty:** Live blank was the #235 hook-order crash. This PR’s ErrorBoundary / identity / shift defaults are **not** kitchen-live until merge + D-041. Localhost also logged `Maximum update depth exceeded` in `engine.ts` and Hercules rig `403` — kitchen still painted; those are separate. Calculator pad still uses strict `calcShiftAmounts`; invalid present settings would hit the new boundary, not a silent post.

**Next owner:** Jonathan — the blank household open is fixed on live (#235). Review whether to merge [#238](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/238) as extra boot hardening. Do not merge or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-blank-household-boot.md`](worksessions/2026-08-28-blank-household-boot.md)

## D-164 Kitchen notes (Kitty Banks, sit-down charts, Home desk) (2026-08-29)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7` @ `dc00c39`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode financial presentation).

**Household outcome:** Shared Home is six glance tiles plus a notebook (no Month blotter hero). Shared Now is **Kitty Banks** — existing shared goals that receive Fund surplus (D-161), not a new envelope. Plan Goals is replaced by Kitty Banks on Shared and Personal. Sit-down cycles paper charts; leftover assignment stays on Shared. Calendar cells show titles. Personal nav keeps Books. Home can scroll. Hercules uses a cream bubble and does not dump chips over the mosaic. Shift saucers expand into posted cash/card/wage totals.

**Budget delta (5):** `+3` — honest Shared vs Personal banks, $0 plan remove, posted shift earnings.

**Engagement delta (3):** `+3` — Home desk, paper banks, sit-down charts, cream talk.

**If they conflicted:** books and the mosaic win. Hercules chips and the grounded-fact grid no longer cover Home. Leftover Confirm stays household-only. No new Fund formulas. Widgets still never `postEntry`.

**What changed:**
- Shared wide Home: `is-shared-home` two-column mosaic | notebook; blotter lives in More on this desk.
- Shared Now tile/notebook: Kitty Banks fill bars + CAD; Attention and Change stay story panels. Change tile says **Fund kitty**, not “Kitty Banks.”
- Plan: one `KittyBanks` surface (visibility via `goalVisibleInView` when `memberId` is passed). Door card “Open Fund kitty” and `Goals` vault removed. Contribution amount is per bank.
- Sit-down: `sitDownInfographicDeck` carousel; Shared leftover CAD comes from books `leftoverProjection`; Personal gets folio charts + muted leftover-on-Shared line. Chart dots are 44×44.
- Plan amounts are borderless; × removes a $0 plan (`setBudget` `allowZero`).
- Calendar: full-width board, titles in cells, item list below.
- Home `>=720px`: `overflow-y: auto`; window shrinks on short `dvh`.
- Personal nav: Home · Cal · Shift · + · Plan · Books · More.
- Hercules overlay: opaque cream bubble; closed = spoken + ok; chips only after How can I help.
- Personal leftover CAD: gated on help chips, Plan overlay, typed Ask, `planHerculesTurn`, and Books Ask (`askHercules(..., { memberId, view })`). Parks-in copy is Kitty Banks.
- Shift: 28 posted cups plus week/month/year cash tips, card tips, and wages.

**Verification:**
- Focused leftover/kitchen tests green (`test/ask-books.test.ts`, `test/hercules.test.ts`, `test/sitdown.test.ts`, `test/kitty-banks.test.ts`, `test/ledger-story-ui.test.ts`, plus Plan/Shift/nav fences).
- `pnpm check` at `1e3d31b` and `dc00c39` → **1109 passed / 2 skipped**, `ai:verify` + `tsc --noEmit` + Vite build green.
- Visual, fictional Development demo kitchen as Jonathan: Shared Home ~1100 six tiles + Kitty Banks notebook; Shared Plan leftover paper + Kitty Banks + ×; Calendar cell titles; Personal 7-button nav; Shift posted cash/card/wages; OfficePhone 390 structure unchanged. Walkthrough video `kitchen_shared_personal_walkthrough.mp4` (41s).
- Independent books/privacy/UX/verifier on `1e3d31b`. Privacy P1 (Books Ask leftover CAD) closed in `dc00c39`. Verifier PASS on leftover-CAD checklist at `1e3d31b`.

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Demo seed has few `scope: personal` accounts, so Personal folio/wallet charts may be thin. Plan Kitty **Fund bank** still posts via `fundGoal` without a Confirm sheet (books auditor P1; not expanded here). Afford/food Ask can still recite cash-like CAD on Personal (not leftover assignment). Personal `sitDownPostcard` / “we closed” can still name leftover cents. iPhone `OfficePhone` structure is unchanged. Do not rebase onto later `main` unless asked.

**Next owner:** Jonathan — review Shared Home, Plan Kitty Banks, Calendar, Shift earnings, and Personal Books nav on a laptop width. Do not merge, rebase, or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-shared-ledger-story-implementation.md`](worksessions/2026-08-28-shared-ledger-story-implementation.md)

## D-164 Shared Household table (not Books) (2026-08-28)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7` @ `2033d28`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode financial presentation).

**Household outcome:** Shared keeps a deep **Household table** room (Fund, cash, cards, activity, import). It does not keep a Shared “Books / household story / double-entry / net worth / P&L” landing. Personal still opens **My books** on position. Audit (journal, trial, statements, rec, close) stays on Shared behind a closed disclosure.

**Budget delta (5):** `+3` — same journal; Shared opening is operating cash/Fund, not household net worth or income vs expenses.

**Engagement delta (3):** `+2` — Shared page job matches the kitchen table; Audit remains one tap away.

**If they conflicted:** books win. Trial-off still opens Audit and banners. No new Fund formulas. Wallet still lists investments as D-047 accounts; they are not kitchen-table tiles.

**What changed:**
- Shared hero: Fund operating or household cash. Copy states this is not net worth or a P&L.
- On-the-table strip: Fund, chequing, goal savings, cards. Investments stay in Wallet / Audit.
- Shared Audit office is a collapsed `<details>` (journal, trial, statements, rec, close, chart, ask). Personal Audit stays open.
- More door and command palette: “Household table” / “Open the household table”. Home story trust button matches.
- PGlite / hosted storage notes move into Shared Audit, not the table opening.

**Verification:**
- Focused `test/ledger-story-ui.test.ts` and `test/accounts.test.ts` green, including goals-only table strip and honest Personal copy fences.
- `pnpm check` at `53799f9` and `2033d28` → **1102 passed / 2 skipped**, `ai:verify` + `tsc --noEmit` + Vite build green. A parallel `e91bb68` run had two unrelated flakes (`hercules-rig` walk tick, `stress-seed` 15s timeout); both passed on rerun.
- Visual, fictional Development demo as Jonathan: Shared Household table hero **$12,234.19** cash (not $13,789.50 net worth); On the table Goal savings **$1,940.00** (pigs vault, not $3,440 with HIS); Audit Trial in balance; Personal My books **$13,789.50** with accepted-books copy.

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Wallet pane on Shared still shows investments (Accounts Floor). Shared table CAD still compiles from the scoped presentation clone (pre-existing D-164); Audit compiles accepted books. Personal hero is still accepted `booksEquation` with honest copy. Shared Import still receives `booksHousehold` for Confirm writes. Demo has no personal-scope accounts.

**Next owner:** Jonathan — independent ChatGPT review using [`briefs/CHATGPT_D164_INDEPENDENT_REVIEW_2026-08-29.md`](briefs/CHATGPT_D164_INDEPENDENT_REVIEW_2026-08-29.md). Model: **GPT-5 Pro**. Do not merge, rebase, or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-shared-ledger-story-implementation.md`](worksessions/2026-08-28-shared-ledger-story-implementation.md)

## D-164 Shared kitchen composition (2026-08-28)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode privacy and financial presentation).

**Household outcome:** Shared Ledger is the household table: Fund, calendar, plan, and story-in-the-notebook. Personal Ledger keeps Shift and a private folio. Shared Books is a deep Fund/journal/Audit room, not a net-worth landing. Kitty Banks stays D-161 (surplus into existing shared goals); the Plan Goals vault is not deleted.

**Budget delta (5):** `+4` — same books, clearer Shared vs Personal jobs, Fund-first Shared Books, sit-down leftover graph, editable Plan categories via `setBudget` / `addCategory`.

**Engagement delta (3):** `+3` — laptop-width desk, story tiles on the mosaic, Calendar as the board, nav that matches the job.

**If they conflicted:** books win. No new Fund formulas. Trial off still surfaces. Posted category actuals stay when a plan is zeroed. iPhone `OfficePhone` structure unchanged.

**What changed:**
- Wide Home: story/folio live in OfficeWide mosaic + notebook; no stacked “Also on this desk” room. Laptop `>=1100px` uses three desk columns and a wider `.app`.
- Shared primary nav: Home · Cal · + · Plan · More. Personal keeps Shift. Books is More → Journal and Fund.
- Shared Books opens on Fund operating / household cash, not net worth, trial-in-balance, or P&L stats. Audit panes remain.
- Calendar hero facts move onto the month board. Purpose banner only on Plan and More.
- Plan left column: sit-down + Kitty door + Goals. Categories add/adjust/zero on the right.
- Sit-down Act 1 tiles collapse; leftover gets paper bars.
- Goals vault stays on Plan. Kitty Banks is the existing Fund surplus path, not a new product.

**Verification:**
- Focused `test/ledger-story-ui.test.ts`, `test/office-wide.test.ts`, `test/ledger-experience.test.ts`, `test/ledger-story-dom.test.ts`, `test/household-fund-ui.test.ts`, `test/kitchen.test.ts` green.
- `pnpm check` at `ad48fad` → **1102 passed / 2 skipped**, `ai:verify` + `tsc --noEmit` + Vite build green.
- Visual, fictional Development demo kitchen on localhost as Jonathan: Shared Home mosaic + notebook (no stacked story room); Shared nav Home/Cal/+/Plan/More; More → Journal and Fund opens household cash (Fund not set up), not net worth; Calendar week facts on the month card; Plan leftover bars + Kitty Banks door + editable categories; Personal Plan nav includes Shift; OfficePhone at 390/320 keeps seals + stories.

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Demo seed has no `scope: personal` accounts, so Personal Books compile empty by design. Kitty Banks does not yet replace the Goals card. Home `overflow: hidden` at `>=720px` may clip tall sill/window chrome. Personal Plan still lists household category rows (Rent, Bianca pay) because month summary is not a Personal-only budget projector. Calendar day copy “inon the board” is fixed in the follow-up commit. Independent books/privacy/UX auditors were launched on this pass; treat their notes as review, not merge authority.

**Next owner:** Jonathan — review Shared Home, Books-from-More, Calendar, Plan on a laptop width. Do not merge, rebase, or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-shared-ledger-story-implementation.md`](worksessions/2026-08-28-shared-ledger-story-implementation.md)

## D-164 Shared Story and Personal Folio (2026-08-28)

**Status:** Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) on `cursor/shared-ledger-story-aef7` @ `dd4fe43`. **Not merged, not deployed, not live.** Risk: **High** (ledger-mode privacy and financial presentation).

**Household outcome:** Opening Shared Ledger feels like sitting down at the household table: what is true together, what changed, what needs a person, what is next, and why the view is trustworthy. Opening Personal Ledger feels like a private folio, not Shared with a filter. Desktop and iPad share one story/folio system at `>=720px`. iPhone keeps `OfficePhone` structure plus a purpose banner.

**Budget delta (5):** `+4` — mode-safe projectors, Fund flow matching D-161, authority in the journey, route-wide Personal denial, persist/compile on the accepted snapshot.

**Engagement delta (3):** `+3` — cooperative weekly/monthly paper story instead of disconnected Fund forms.

**If they conflicted:** books win. No new Fund formulas, event kinds, or command authority. iPhone structural redesign refused. Ranking/spend comparison refused. Presentation clones cannot overwrite partner Personal rows or choose leftover / Fund CAD.

**What changed:**
- `projectLedgerExperience` / `ledgerRouteContract` at the app boundary. Scoped household is read-only presentation. `booksHousehold` is the accepted snapshot.
- Shared Story (now / flow / attention / change / next / trust) and Personal Folio at `>=720px`. Fund commands stay behind progressive disclosure. Phone gets `LedgerPurposeBanner` heading; purpose copy hides below 720px.
- `restoreAcceptedSnapshot` plus Books/Goals/Add writers so Shared `addGoal` and Personal close/rec cannot drop the other scope’s rows. Personal presentation txs compile only against remaining accounts.
- Home sit-down / lock, Shared Story Fund CAD, phone Fund glance, Fund pane, and Books journal/trial/statements compile from `booksHousehold`. Register/wallet stay scoped. Add pickers fail closed when experience is not ok. Office lamp uses redacted `integrityFindings`.
- Shared Confirm “Mark due paid” posts only the due ids the current view showed (`postDueRecurrences(..., ids)`). A hidden Personal-scope standing order can no longer throw and void visible household posts. Personal Rec no longer defaults to a Shared chart account.
- Fund pane label is **Fund free-to-spend**. Unconfigured copy uses `LEDGER_CUSTODY_DISCLOSURE` plus setup, without replacing that sentence. Story deficit figures use `--danger`.

**Verification:**
- Focused `test/ledger-experience.test.ts`, `test/ledger-story-ui.test.ts`, `test/ledger-story-dom.test.ts`, `test/shared-ledger-story.test.ts` green, including Visa owed $70.50 / sit-down preview on accepted vs scoped, Fund reserve on personal-scope recurrences, and Shared due Confirm posting only visible ids.
- `pnpm check` at `dd4fe43` → **1100 passed / 2 skipped**, `ai:verify` + build green.
- Visual, fictional Development demo kitchen on localhost as Jonathan: Shared Home 1280 (Fund free-to-spend + Bianca custody), unconfigured Books Fund pane (same custody sentence), phone 320 purpose heading without the long purpose paragraph.

**Data and environment disclosure:**
- Development impact: none (local/synthetic demo kitchen only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none for household data
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo/synthetic Development only.

**Remaining uncertainty:** Demo seed has no `scope: personal` accounts, so Personal Books compile empty by design. Demo Visa can be paid off so owed may be $0 even when personal-visibility lines exist; the $70.50 owed proof uses a catalog fixture. Ask SQL / Import mapping / close-pack export still run on accepted books (bank truth; Dual Course). Shared Books can still list Personal-scope backing **names** (not last4) because journal compiles accepted books. 820/1024/1440 stills were not captured as separate files.

**Next owner:** Jonathan — click the trycloudflare URL in the latest agent reply (this branch’s Vite, not the live kitchen). Then: Open the demo kitchen table → I am Jonathan. On Cursor Desktop, the same kitchen is `http://127.0.0.1:5173/` while this agent tab is active. Do not merge or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-shared-ledger-story-implementation.md`](worksessions/2026-08-28-shared-ledger-story-implementation.md)

## Closeable kitchen notices with 1–2 fix steps (2026-08-28)

**Status:** Draft PR [#232](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/232) on `cursor/closeable-kitchen-notices-560d`. **Not merged, not deployed, not live.** Risk: **Low–Medium** (copy/UX; no money write, Auth, or schema).

**Household outcome:** The Import line “This Google account is not linked to that Hearth member.” means this Google session is signed in, but it is not the hosted membership row for the person currently on this kitchen. Bank connect stays refuse-closed. Kitchen errors now show as a small closeable chip (same size language as the sync chip): one problem, 1–2 fix steps, optional Open More / Reload, and ×.

**Budget delta (5):** `+1` — can act on a blocked bank connect or books copy.

**Engagement delta (3):** `+1` — not a wall of red.

**If they conflicted:** books win; notices never `postEntry`. Google mismatch still refuses Flinks. A missing PGlite receipt still does not ingest.

**What changed:** `humanizeKitchenNotice` maps engine/worker strings. `KitchenNotice` is a compact chip. Wired on Books status, Flinks/7shifts errors, App/welcome/Add, and other `.danger` paragraphs. Engine/worker copy is unchanged.

**Verification:**
- Focused `test/kitchen-notice.test.ts` + `test/flinks-connect-ui.test.ts` green.
- `pnpm check` at `6c58daa` → **980 passed / 2 skipped**, build green. Follow-up commit threads `onGoMore` into BatchImport review notices.
- Independent `hearth-ux-auditor`: Dual Course pass (conditional); asked for `onGoMore` on BatchImport slots — wired.
- Independent `books-auditor`: PASS — fail-closed membership and receipt checks unchanged.
- Visual, fictional Development demo kitchen on localhost: Import → Connect bank with Flinks shows “Sign in with Google before connecting a bank” chip with Open More and ×. Dismiss hides it. Open More goes to More.

**Data and environment disclosure:**
- Development impact: none (UI copy only)
- Production impact: none
- Network calls or data sent: none new
- MCP access: none
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo kitchen only. Live kitchen screenshot was the prompt, not a data source.

**Remaining uncertainty:** Live kitchen still shows the old walls until merge + D-041 deploy. Linking Google in More is the real fix for the membership mismatch. Demo localhost showed the sign-in-first Flinks chip (no Google session), not the membership-mismatch string.

**Next owner:** Jonathan — review [#232](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/232). Do not merge or deploy unless you ask.

**Worksession:** [`worksessions/2026-08-28-closeable-kitchen-notices.md`](worksessions/2026-08-28-closeable-kitchen-notices.md)

## Kitchen queue handler so D-156 can publish (D-041) (2026-08-28)

**Status:** Merged to `main` at `d067e56` (PR #228). Kitchen **deploy failed** Cloudflare Workers `33184620358` and Workers Builds `d6a7492e` with API **11001** (queue handler missing). Fix is on `cursor/fix-kitchen-queue-handler-560d`. Risk: **Medium** (Worker deploy path; no money, Auth, or schema).

**Household outcome:** Unblock the already-approved kitchen publish of the wide paper office (fat nav + live chalkboard). Live kitchen still serves `index-BRjIx46v.js` (early D-156 from #229) until this handler lands.

**Budget delta (5):** `+0` — plumbing only; the paper-office budget delta is unchanged.

**Engagement delta (3):** `+0` — same.

**If they conflicted:** books win; the handler only `ack()`s. It never `postEntry`, never fetches household rows, never talks to a model.

**What changed:** `workers/site.js` exports a no-op `queue`. `wrangler.jsonc` still has **no** `queues` consumers. D-041 why-note records 11001.

**Verification:** focused `test/api.test.ts` (queue acks; no consumer binding) + worker tests green. `pnpm check` next. Then merge to `main` and confirm Cloudflare Workers Deploy green. Live HTML must serve a bundle containing `hearth-notebook-whisper` / live chalkboard, not only `office-wide`.

**Data and environment disclosure:**
- Development impact: none
- Production impact: none (kitchen Worker publish only; no Production household mutation)
- Network calls or data sent: none new
- MCP access: Cloudflare Workers Builds logs (read-only)
- Hosted rows/schema/secrets: none. No Queue consumer added.
- Real household or partner-personal data used: none

**Remaining uncertainty:** Cloudflare may still have a leftover consumer registration on `hearth-books`. Dashboard cleanup (`wrangler queues consumer remove`) is Jonathan's if 11001 returns. Workers Builds still runs `versions upload` (preview), not kitchen `wrangler deploy`.

**Next owner:** Merge this fix to `main` (Jonathan already approved kitchen publish), then hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/

**Worksession:** [`worksessions/2026-08-28-wide-paper-office.md`](worksessions/2026-08-28-wide-paper-office.md)

## Keep chalkboard; restore screenshot nav (D-156) (2026-08-28)

**Status:** Merged to `main` (`d067e56`) via [#228](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/228). **Not kitchen-live** — deploy `33184620358` failed 11001. Risk: **Medium** (UX Dual Course; no money, Auth, or schema).

**Household outcome:** Laptop Home matches the attached paper-office screenshot: fat bottom nav (Home / Cal / Shift / plus / Plan / Books / More), POST / DUE / HEALTH seals, Today's stories, month blotter. The compact chip-strip nav is gone. Notes still open a live chalkboard in the notebook. Google welcome/sign-in files were not touched.

**Budget delta (5):** `+2` — glanceable month net / wallet / bills / Health stay.

**Engagement delta (3):** `+1` — chalkboard stays; nav goes back to the screenshot bar.

**If they conflicted:** books win; widgets never `postEntry`; plus FAB stays the Add door.

**What changed:** Withdrew `WideMiniBrowser` and `.app.is-wide` hiding of `.nav`. Restored **More on this desk**. Kept live chalkboard (`bare` notebook, letter eraser, auto-save stamps).

**Verification:** focused office-wide / desktop-office / chalk-letters tests; then `pnpm check`. Visual: 1100 fat nav + seals; Notes chalkboard; 390 same Draft C nav.

**Data and environment disclosure:**
- Development impact: none
- Production impact: none
- Network calls or data sent: none new
- MCP access: none
- Hosted rows/schema/secrets/deployments: none
- Real household or partner-personal data used: none. Demo kitchen only.

**Remaining uncertainty:** Saved x/y desks still open Classic. This branch never carried a Google sign-in diff, so nothing Google was reverted here.

**Next owner:** Jonathan — confirm laptop Home matches the screenshot (fat bar + plus, no chip strip), then Notes chalkboard, then Google welcome still as you left it.

**Worksession:** [`worksessions/2026-08-28-wide-paper-office.md`](worksessions/2026-08-28-wide-paper-office.md)

## Laptop nav in the smaller widgets column (D-156) (2026-08-28)

**Status:** Draft PR [#228](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/228) on `cursor/wide-paper-office-560d`. Head after this packet. Base `origin/main` `54c74dc`. **Not merged, not deployed, not live.** Risk: **Medium** (UX Dual Course; no money, Auth, or schema).

**Household outcome:** On a laptop, Home / Cal / Shift / Post / Plan / Books / More live in the **left mosaic column** under Today's stories, with leftover desk chips (Notes, Outfits, …). The fat phone nav and plus FAB are hidden at ≥720px. Single click previews in the notebook; double-click or Shift+Enter opens the page. Phone `<720px` keeps Draft C bottom nav.

**Budget delta (5):** `+2` — glanceable month net / wallet / bills / Health unchanged; nav move is engagement.

**Engagement delta (3):** `+2` — nav sits with the small widgets instead of a second bottom bar.

**If they conflicted:** widgets still never `postEntry`; Post is a small chip, not a covering FAB.

**What changed:** `WideMiniBrowser` moved into `office-wide-widgets` (left column). Unique `desk-` chip ids. Shift+Enter opens the full page. Live chalkboard still fills the notebook. Fat `.nav` stays phone-only.

**Verification:**
- Focused `test/office-wide.test.ts` + `test/desktop-office.test.ts` green (chips under mosaic; unique ids).
- `pnpm check` at `0978af9` → **969 passed / 2 skipped**, build green. Follow-up commit is unique ids + keyboard Shift+Enter + Add freeze on the widget column.
- Visual, fictional Development demo kitchen only: Paper office at ~1100 — chips wrap under Today's stories in the left column; Cal preview in the right notebook; no fat bottom nav. Phone ~390 keeps Home/Cal/Shift/+ /Plan/Books/More.
- Read-only UX auditor: household job met; keyboard double-click gap addressed with Shift+Enter; remaining gaps 720 wrap, 280ms click wait.

**Data and environment disclosure:**
- Development impact: none (layout `localStorage` cosmetics).
- Production impact: none.
- Network calls or data sent: none new.
- MCP access: none.
- Hosted rows/schema/secrets/deployments: none.
- Real household or partner-personal data used: none. Demo kitchen only.

**Remaining uncertainty:** Saved x/y desks still open Classic (chip strip above the canvas). Fresh desks open paper. 720–899px stacks to one column so chips wrap under the mosaic. Branch is behind later Toast OCR work on `main`.

**Next owner:** Jonathan — review laptop ~1100: chips should sit under Today's stories on the left, fat bar gone. Then phone 390 still has the seven-column nav. Do not merge until that looks right.

**Worksession:** [`worksessions/2026-08-28-wide-paper-office.md`](worksessions/2026-08-28-wide-paper-office.md)

## Wide paper office (D-156) (2026-08-28)

**Status:** Draft PR [#228](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/228) on `cursor/wide-paper-office-560d` (`afdff22`). Implementation `e16e873`; this handoff commit follows. Base `origin/main` `54c74dc`. **Not merged, not deployed, not live.** Risk: **Medium** (UX Dual Course; no money, Auth, or schema).

**Household outcome:** On a laptop, Home feels like the phone kitchen — wax seals, paper stories, cream/pine/copper, Fraunces money — but it is a **two-column room**, not a stretched 2×2. A large month-net blotter and journal-true in/out bars use the extra space. The notebook stays open beside stories. Classic free-move desk remains behind Cabinets. Phone `<720px` stays Draft C. Milk/Confirm still post.

**Budget delta (5):** `+2` — month net, wallet, bills, and Health become glanceable on a laptop without a new figure.

**Engagement delta (3):** `+2` — the kitchen feels special at width; Hercules still wanders.

**If they conflicted:** no invented CAD; tip spark is copper-badged **Projection**; widgets still never `postEntry`; if Post were covered, furniture would shrink. Kill criterion was **not** triggered.

**What changed:** `OfficeWide` is the default wide Home. Cabinets **Paper office** / **Classic desk**. App column `min(1120px, 100%)`. Paper bars/spark from `monthSummary` / `tipWeather`. Light two-column CSS on Shift, Books wallet, Calendar, Plan. D-156 in living canon. Add-state CSS polish: freeze hero, dim notebook, pin focus ring.

**Verification:**
- `pnpm check` → **967 passed / 2 skipped**, build green (this SHA).
- Focused `test/office-wide.test.ts` (mosaic ids, demo-household cents, fresh paper / saved-x/y classic).
- Warmth fence: `1120px`, refuses `1280px`, Cabinets copy.
- Read-only UX auditor: Dual Course pass; three CSS polish items landed in `e16e873`.
- Independent verifier: claims 1–8 pass against `66cff63`; claim 9 (`pnpm check` 967/2) re-run here and green.
- Visual, fictional Development demo kitchen only (`pnpm dev` → `http://localhost:5173`, Open the demo kitchen table): 320 / 390 Draft C; 720 OfficeWide (stacks under 900px); ~1100 two-column paper office; Classic toggle; Post/Add uncovered; Shift climate beside punch.

**Data and environment disclosure:**
- Development impact: none (layout `localStorage` cosmetics).
- Production impact: none.
- Network calls or data sent: none new.
- MCP access: none.
- Hosted rows/schema/secrets/deployments: none.
- Real household or partner-personal data used: none. Demo kitchen only.

**Remaining uncertainty:** Existing wide layouts with saved x/y keep Classic so a customized desk is not silently replaced. Fresh desks open paper. Two-column breathing room is the ~1100 face; 720–899px is still OfficeWide but stacked. Branch is behind current `main` by later Toast OCR work — rebase is Jonathan’s call, not this packet.

**Next owner:** Jonathan — review laptop Home at ~1100px, then phone at 390. Do not merge until you are happy with the composed room. Do not treat as shipped or live.

**Worksession:** [`worksessions/2026-08-28-wide-paper-office.md`](worksessions/2026-08-28-wide-paper-office.md)

## Merge and deploy what is safe (2026-08-28)

**Status:** Merged via [#229](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/229) onto `main` (`58b8bcd`). Kitchen Worker **live** via Cloudflare Workers run `33146400613` (Deploy green). Bundle `index-Bi_R2L6I.js` contains `office-wide`. Risk: **Medium**. Not Production household data.

**Household outcome:** Laptop Home is the composed paper office (D-156). 7shifts stays inert. Conflicting High/draft PRs stay unmerged.

**Budget delta (5):** `+1` — laptop Home glance without new figures.

**Engagement delta (3):** `+1` — composed wide paper office on the kitchen.

**Safe / live:** `main@58b8bcd` deploy `33146400613`. Live 7shifts status still `available: false`, Production locked.

**Held (not safe):**
- D-155 enablement — setup `33116671903` failed Cloudflare API `7403`. `#214` superseded by `#220`/`#222`.
- `#218` opening truth — High, CONFLICTING, draft.
- `#216` onboarding, `#207` computer office, `#206` tenant journal, `#203` button inventory — CONFLICTING drafts.

**Verification:** `pnpm check` **967 passed / 2 skipped**; `#229` CI `test` green; visual 1100/720/390/320 on demo Development; live JS includes `office-wide` / `Today's stories`.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ on a laptop (~1100px) and a phone (390). Grant the GitHub Cloudflare token D1 access before any 7shifts enablement.

## Tip-sheet transcript-first rethink (D-152) (2026-08-28)

**Status:** Merged via [#227](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/227) onto `main` (`74abbaf`). Kitchen Worker **live** via Cloudflare Workers run `33131628794` (Deploy green). Risk: **Medium**. Not Production household data.

**Household outcome:** Tip-sheet camera drafts Confirm with labeled Toast totals instead of blank/wrong fields. PDF conversion is **not** used (vision APIs are image-only).

**Budget delta (5):** `+2` — labeled OCR wins; invent-nothing still never posts.

**Engagement delta (3):** `+1` — clearer, more usable drafts after Clear Capture.

**What changed:** Transcript-first prompt; coerce `shift-report` from tip-sheet hint + Toast OCR; field-level POS merge; tip-sheet contrast + high-quality JPEG prep; **Auto = free Workers AI first**, paid only when draft still weak.

**Cost:** Default **Auto** avoids paid tokens when free Workers AI + POS parser draft enough. OpenAI chip still costs ~$0.02–0.04 when forced or when Auto falls back.

**Verification:** `pnpm check` → **959 passed / 2 skipped**. Deploy `33131628794` success.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development, leave provider on **Auto**, tip sheet scan → Confirm review. Do not treat as Production household data.

## OpenAI tip-sheet 503 fix (D-152) (2026-08-27)

**Status:** Merged via [#226](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/226) onto `main` (`4ea186f`). Kitchen Worker **live** via Cloudflare Workers run `33128613418` (Deploy green). Risk: **Medium**. Not Production household data.

**Household outcome:** Choosing OpenAI for tip-sheet scan drafts Confirm again instead of failing with “OpenAI could not read that tip sheet.”

**Budget delta (5):** `+1` — paid vision path works for dense slips again.

**Engagement delta (3):** `+1` — provider chip matches real behavior.

**Root cause:** OpenAI `strict: true` rejected `shiftDraft` (properties without matching `required`). Schema now null-unions every tip field under `required`; `scanOpenAI` retries `json_object` / plain JSON if strict is refused.

**Verification:** `pnpm check` → **955 passed / 2 skipped**. Deploy `33128613418` success.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development, Shift tip sheet → OpenAI → retake. Confirm still posts. Do not treat as Production household data.

## Tip-sheet provider choice + clarity-gated camera (D-152) (2026-08-27)

**Status:** Merged via [#225](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/225) onto `main` (`94f8cd0`). Kitchen Worker **live** via Cloudflare Workers run `33124596368` (Deploy green). Risk: **Medium**. Not Production household data.

**Household outcome:** On Shift tip-sheet scan, choose **Auto / Workers AI / OpenAI / Anthropic**. Live camera capture stays locked until the slip looks sharp and readable (QR-scanner style). Choose-photo applies the same clarity check.

**Budget delta (5):** `+1` — fewer unusable OCR drafts; invent-nothing boundary unchanged.

**Engagement delta (3):** `+2` — clearer camera UX and explicit provider control for dense tip sheets.

**What changed:** Provider chips + local preference; `/documents/scan` honors forced provider without silent fall-through; `DocumentCamera` live clarity meter; Choose-photo clarity gate; D-152 why-note.

**Verification:** `pnpm check` → **954 passed / 2 skipped**. Deploy `33124596368` success. Live bundle contains `Take tip sheet photo`, `Vision provider`, `Waiting for clear tip sheet`, `doc-camera-overlay`. Forced-provider probe returns provider-specific 503 (image not saved); foreign origin still 403.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development pill, Shift tip sheet → try providers; confirm Capture stays disabled until clear. Do not treat as Production household data.

## 7shifts Evidence Mesh and automation (D-158/D-159) (2026-08-28)

**Status:** [PR #231](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/231) merged at `main@e342ae9`; post-merge CI and Cloudflare Worker deployment passed. The dedicated Development D1, private R2, Queue/DLQ, `EVIDENCE_KEK_V1`, and migrations 0001/0002 are live and empty. Worker version `9a1606cd-a49c-4bef-9da5-c75468e62f5a` is inert with every Evidence and 7shifts activation flag false. No email route, distribution, activation, real evidence, or Production action.

**Household outcome:** Shift → Evidence can accept explicit member files/screens, saved/private ICS, rotated forwarded-mail evidence, and paired browser/iPhone captures into an encrypted personal vault. Unified bundles retain every attributed observation and conflict. Automation is off by default; an exact member/job opt-in can post eligible evidence through ordinary `postWorkShift`/PGlite/continuity and reconcile a complete payroll week through exact reversals plus chronological replacements.

**Budget delta (5):** `+5`. **Engagement delta (3):** `+3`. **Risk:** Release.

**Hard boundaries:** D-158 storage is separate D1/private R2/Queue and default-disabled. Raw evidence never enters household snapshots, command events, PGlite, Hercules, or generic model payloads. Schedules/email/models never post. Deterministic command ids and receipts supply retry recovery. Closed/settled variance is review-only until a separately approved mapping. Production is refused.

**Verification:** reconciled Toast OCR + Evidence/accounting/Hercules focus passed 16 files / 93 tests, and the dedicated disabled-queue/CORS regressions passed separately. TypeScript, AI verify, production build, local D1 migration execution, Worker dry run, and diff check passed. The full suite is 1018 passed / 2 skipped / 2 unchanged-baseline failures. Remote D1 reports no pending migrations and zero evidence items, bundles, jobs, bytes, objects, puts, or gets; R2 has no public URL or custom domain. Live `/work/evidence/status` and `/work/7shifts/status` both report unavailable/disabled and Production refused. iOS XCTest and physical-device proof remain macOS/TestFlight gates.

**Canon:** [`SEVEN_SHIFTS_EVIDENCE.md`](SEVEN_SHIFTS_EVIDENCE.md) · [`worksessions/2026-08-28-seven-shifts-evidence-mesh.md`](worksessions/2026-08-28-seven-shifts-evidence-mesh.md)

## Native 7shifts Timesheet inbox (D-155) (2026-08-27)

**Status:** Release branch `codex/d152-shifts-release`, based on current `main`; user-authorized two-stage Development release in progress. Risk: **Release**. Production provider access remains refused.

**Household outcome:** Connect 7shifts under Shift → Jobs. Pull a clocked punch into the existing Timesheet review on Shift → Today or Add. Hours, paid breaks, role, and clock times are drafts; cash/card tips stay blank. Only Confirm can post through `postWorkShift`.

**Budget delta (5):** `+3` — less transcription without changing Hearth-owned rates, tip amounts, or the accounting boundary.

**Engagement delta (3):** `+2` — the restaurant clock and Co-workers roster now meet the first-class Shift tab.

**Safety:** Development only; Auth membership before D1/provider access; AES-GCM token storage; HMAC stable identities; strict response allowlists; 7shifts wage/tip/email fields discarded; provider labels sanitized; API version `2026-01-01`; scope changes cancel provider/camera work and clear pending Confirm state.

**Release plan:** Merge/deploy inert with `SEVENSHIFTS_ENABLED=false`; verify status; apply D1 migration 0002 and put both required secrets; then merge the minimal enablement flag/secret-validation change and verify active status plus fail-closed routes.

**Remaining uncertainty:** A real Harbour Developer Tools token is required for the final provider/company smoke. Stop before Confirm during that smoke so no household money is changed.

**Worksession:** [`worksessions/2026-08-27-seven-shifts-inbox.md`](worksessions/2026-08-27-seven-shifts-inbox.md)

## Shift Today camera (D-152 on D-153) (2026-08-27)

**Status:** Merged via [#217](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/217) onto `main` (`048e619`). Kitchen Worker **live** version `c942e55b-a53d-403e-9ab1-3c17c1f9957d` (bundle `index-Ce4ACG2v.js`). Risk: **Medium**. Not Production household data.

**Household outcome:** On Shift → Today, photograph a tip sheet (or pick a photo). The scan drafts Confirm on this page. Confirm still posts. Home Timesheet / Add camera stays.

**Budget delta (5):** `+1`

**Engagement delta (3):** `+2`

**What changed:** Shared `ShiftReportScanBar`. Clock out on Shift clocks out without opening Add. Already off stays on Today. Same `scanShiftReportFile` / `documentHint: shift-report`. Demo kitchen job for Bianca (MEM-001). BatchImport copy points at Shift → Today. Worker prompt names Shift → Today. Same-day Confirm retry stays on `postWorkShift` even if Add is still on the expense pad; the duplicate banner stays on Shift Today.

**Verification:** `pnpm check` → **895 passed / 2 skipped**. GitHub Actions Cloudflare Workers `33111839360` Deploy green. Live HTML serves `index-Ce4ACG2v.js` containing `Take shift-report photo`, `Choose tip sheet photo`, `Optional camera draft`, Bianca demo job note. Browser smoke: Development, demo kitchen, Bianca then Jonathan, Shift → Already off? → camera chips. No Confirm / no journal post.

**Data/environment:** Client/docs. Kitchen publish is GitHub `main` → Cloudflare Workers. Scan still POSTs image bytes like receipts. No schema, secrets, Production rows.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development pill, demo kitchen, Shift → Already off? Photograph a tip sheet if you want. Confirm still posts. Do not treat this as Production household data.

## Shift tab (D-153) (2026-08-27)

**Status:** Merged via [#213](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/213) onto `main` (`1e12d32`). Kitchen Worker **live** version `5b2b2b47-d996-427c-b3bf-61a845ee9bcf` (bundle `index-CTPtvBuT.js`). Risk: **Medium**. Numbered **D-153** because `main` already used **D-152** for tip covariates (#208).

**Household outcome:** Bianca and Jonathan open **Shift** from the phone bar. Punch, last shifts, Jobs, compressed report, and Hercules Shift Oracle glances live there. Add stays centered. Confirm still posts. The tab never writes money.

**Budget delta (5):** `+1`

**Engagement delta (3):** `+2`

**What changed:** Nav is `Home · Cal · Shift · [+] · Plan · Books · More`. `WorkShiftPage` hosts Today / Report / Jobs. More no longer mounts Jobs / history / report. Home Timesheet stays. Projections are copper-badged and never post. Rebased onto #208 camera/covariate Confirm path (Add still hosts scan + `WorkShiftFlow`).

**Verification:** `pnpm check` after merging `origin/main`: **887 passed / 2 skipped**. GitHub Actions Cloudflare Workers `33106260692` Deploy green. Live HTML serves `index-CTPtvBuT.js` containing `shift-page`, `Tip climate`, `Floor lamp`, `Protect floor`.

**Data/environment:** Client/docs. Kitchen publish is GitHub `main` → Cloudflare Workers. No schema, secrets, or Production household mutation.

**Remaining uncertainty:** Future climate days cannot show real rain without a multi-day forecast. Today's rain drop uses cached Open-Meteo / fallback.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , Development pill, open Shift. Demo kitchen is fine. Do not treat this as Production household data.

## Tip covariates + Hercules tip science + Pro paged reads (D-152) (2026-08-27)

**Status:** Merging via [PR #208](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/208) onto `main` (Jonathan approved push/merge/deploy). Risk: **Medium–High**. Kitchen publish follows GitHub `main` → Cloudflare Workers.

**Base SHA:** `ef3274a` · **Head SHA:** merge-base-resolved (see tip).

**Household outcome:** End-of-night Confirm captures sales, customers served, floor headcount, and event tags so tip projections get better; Hercules (free + Pro) uses those covariates; Pro can page long shift/ledger history; Timesheet can photograph a tip sheet and draft Confirm without posting.

**Budget delta (5):** `+2` — richer covariates improve tip projections without posting money; OCR stays proposal-only.

**Engagement delta (3):** `+2` — Confirm + optional camera draft + Pro long-history paging.

**What changed:**
- Shift / `postWorkShift` / legacy `postShift`: `customersServed`, `staffingCount`, `eventTag`, optional `weatherGlass`; tipped Confirm requires covers/staffing (+ sales when sales fields exist).
- `WorkShiftFlow` Sales & tips step + legacy ceremony fields; stress seed synthesizes covers/staffing/events.
- `tipScience` observations + soft sales/covers/staffing/event/macro factors on outlook/oracle/year-sim.
- Hercules: tip tools consume covariates; new `list_shifts`; Pro `toolPageMode` page size 50/100 + cursors; free ≤10.
- Worker `/macro/priors` soft Ontario/Canada prior (fail soft); shift-report OCR via shared `/documents/scan` + `documentHint` → Confirm draft only; OCR notes dropped (Worker + `workShiftDraftFromVision`); BatchImport rejects shift-report rows.
- Single-field sales jobs map camera sales into that pad; multi-field jobs leave sales blank with an honest banner (no invented Food/Alcohol/Other split).
- D-152 recorded.

**Verification:** Focused `test/shift-report-draft.test.ts` + `test/document-scan-worker.test.ts` (shift-report sanitize + hint) pass; prior tip-covariates suite green; full `pnpm check` → **873 pass** / 2 skipped. Independent books auditor **PASS WITH NOTES** (Confirm-only; sales multi-field note addressed). Independent privacy auditor **PASS WITH NOTES** (OCR note residual fixed; warnings may still echo names on-device only; third-party vision transit inherent).

**Uncertainty:** Live StatsCan fetch not wired; OCR quality depends on model vision; Cloud UI smoke of Timesheet Confirm may need a Development household (welcome-demo path was previously blocked).

**Data/environment:** Development client/Worker code only. No schema, secrets, Production, or household wipe. Scan POSTs image bytes like receipts; macro endpoint sends region key only.

**Next owner:** After kitchen deploy — hard-refresh; Development smoke of Timesheet → Already off? → Take shift-report photo → Confirm.

## Supabase Preview history matches 016 (D-151) (2026-08-27)

**Status:** Branch `cursor/supabase-preview-016-history-5958`. Risk: **Low** (migration *history* metadata only; money meaning unchanged). Hosted `supabase_migrations.schema_migrations` version retagged `20260827072847` → `016`. Function not re-applied. No household rows.

**Household outcome:** GitHub Supabase Preview can see the same 016 file the kitchen already uses. Start from scratch is unchanged.

**Budget delta (5):** `0`

**Engagement delta (3):** `0` — CI honesty, not an interactable.

**What changed:** MCP apply had stored a 14-digit timestamp; local file is `016_reset_development_households.sql`. Preview looks up remote versions in that folder. History now uses `016`. Filename contract locked in `test/supabase-connection.test.ts`.

**Verification:** Hosted `list_migrations` now ends at `016` / `reset_development_households`. No `20260827072847` row. Focused `pnpm exec vitest run test/supabase-connection.test.ts` → **8 passed**.

**Data/environment:** Development project `tykhocwacaxwquhynkok` history table only. No Production. No Start from scratch invocation.

**Next owner:** Merge this PR so GitHub re-runs Supabase Preview on `main`.

## First-create retry is not another phone (D-149) (2026-08-27)

**Status:** Merged via #210 onto `main` (`48b1716`). Kitchen Worker version `cc694eee-3462-4fff-8f71-8675e8ad2ecf` verified (`index-DTnHo7tC.js`). Risk: **High**. No schema apply.

**Household outcome:** Starting a household alone does not show “Another phone posted a newer household snapshot.” After create, retries CAS from the hosted revision when that revision is a positive integer.

**Budget delta (5):** `+2` — the only copy of the books can reach the cloud.

**Engagement delta (3):** `+2` — Health/More stop blaming a partner who is not there.

**What changed:** `pushSupabaseHousehold` treats `household-already-exists` by reading the hosted snapshot and calling `publish_continuity_snapshot` with that revision when local is same or ahead. Unreadable or non-positive hosted revision stays pending (`missing-snapshot`), not another-phone. Genuinely newer hosted tips still conflict.

**Verification:** Focused 27 tests pass. Full `pnpm test` **875 passed / 2 skipped**. GitHub `main` CI SUCCESS after merge. Live bundle contains `Sharing continues from the hosted books`. Independent reviews at `2ad4411`: books / privacy / trust **PASS WITH NOTES**. Verifier on `824ba66`: **PASS WITH NOTES**.

**Data/environment:** Development kitchen deploy from GitHub `main` (Cloudflare Workers workflow `33092467819`). No hosted SQL, secrets, or Production.

**Next owner:** Jonathan — hard-refresh https://hearth-books.jonathan-beaulne123.workers.dev/ , open More, tap Retry now on the waiting-to-share household.

**Named open risk (October):** this retry compares revision numbers only. A local-ahead snapshot that is not a descendant of the hosted tip can still CAS-advance. `canAbsorbDisjointSharedMoney` is the later guard; not in this packet.

## Invite owner first create (D-149 / D-123) (2026-08-27)

**Status:** Merged via #209 onto `main` (`4009b6c`). Kitchen Worker version `10b7de13-7c05-4c5d-a8ab-fc0942e375c3` verified. Risk: **High**. Follow-up false-conflict fix merged #210 (Worker `cc694eee`).

**Household outcome:** The person who starts a household can send a Google invite. Command-log must not skip `hearth_create_household` on the first cloud write.

**Budget delta (5):** `+2` — partner invite is the door to shared books.

**Engagement delta (3):** `+2` — Invite waits for share instead of a false “only the owner” warning.

**What changed:** `shouldUseCommandLogFlush` returns false when `expectedRevision === 0`, so the first write uses `pushSupabaseHousehold` → `hearth_create_household` (owner membership). Invite Issue stays disabled while sharing (`syncState === "syncing"` or `sharing.mode === "pending-transport"`). Compacted later writes keep `expectedRevision === 0` and still create.

**Verification:** Focused `pnpm exec vitest run test/continuity-command-outbox.test.ts test/auth-invite-chrome.test.ts` → 26 pass. Full `pnpm check` on `f5c6649` → `pnpm ai:verify` green; **868 passed / 2 skipped**; `pnpm build` green. Independent reviews: privacy **PASS WITH NOTES** (P3 proof gaps; compact-0 test added after); trust **PASS WITH NOTES** (P1 handoff filled here; P2 pending-transport gate added); books **PASS WITH NOTES** (assert 012 on first-create); UX **PASS WITH NOTES** (live region always in DOM).

**Data/environment:** Development client/docs only. No hosted SQL, secrets, Production rows, or deploy. Fictional Development fixtures in tests.

**Next owner:** Live on the kitchen after #209. Follow-up: first-create retry false conflict on `cursor/first-create-false-conflict-5958`.

## Start from scratch — Development household reset (D-151) (2026-08-27)

**Status:** Merged via #201 onto `main` (`ef3274a`). Risk: **High** (hosted Development delete/leave; Production blocked). Migration **016 applied** 2026-08-27. RPC **not** invoked during apply.

**Household outcome:** One Confirm deletes every disposable Development household this Google account owns, leaves member-only seats, clears this phone’s Development copies, and opens Create household while Google stays signed in.

**Budget delta (5):** `+2` — leftover test ledgers cannot be mistaken for September books.

**Engagement delta (3):** `+2` — one Confirm instead of tapping Delete on every household.

**What changed:** `hearth_reset_development_households` (016) is live; **Start from scratch** is on the Development welcome home and the first card in More.

**Verification:** 016 metadata apply (Production 0→0, Development 7→7, anon EXECUTE false). Kitchen bundle includes Start from scratch after merge/deploy.

**Data/environment:** Hosted Development schema (016). No household wipe, secrets, or Production rows during apply.

**Next owner:** Jonathan — hard-refresh live kitchen → Development pill → **Start from scratch** (welcome or More) when wiping leftover test households.

## T3-S4 scale envelope (2026-08-27)

**Status:** Branch `cursor/t3-s4-scale-envelope-403c` (draft PR). Risk: **Medium** (policy + scheduling honesty; no money meaning change).

**Household outcome:** Named 2–9 / 10–49 / 50–100 poll bands with Realtime primary; D-121 chat limits untouched; explicit refusal to claim 100-person Production on poll alone.

**Budget delta (5):** `+1` — calmer REST under larger N when Realtime is down.

**Engagement delta (3):** `0` — honesty/docs; no new interactable.

**What changed:** `continuityLivePull.ts` (`SCALE_PULL_BANDS`, `scaleEnvelopeClaim`, `activeMemberCountHint`); App recomputes band each poll tick; `SYNC_ARCHITECTURE` scale table + load-test notes; live-pull tests.

**Verification:** `pnpm exec vitest run test/live-pull-dual-use.test.ts test/continuity-resume.test.ts` → 22 pass; full `pnpm check` → 857 pass.

**Data/environment:** Development client/docs only. No schema, secrets, Production, or D-121 retune.

**Next owner:** Jonathan — review/merge; no 100-person load harness in this slice.

## T3-S3 background sync polish (2026-08-27)

**Status:** Merged via #204 onto `main`; kitchen deploy Version `1fa56e20-4d07-4cbf-95e4-6e9774db3017` verified (Offline badge strings live). Risk: **Low**.

**Household outcome:** Returning to the kitchen resumes share without double focus+visibility churn; Realtime flaps back off the REST poll instead of heartbeat-spamming; Offline badge says when share will resume.

**Budget delta (5):** `+1` — calmer reconnect preserves outbox/poll honesty without changing command posting.

**Engagement delta (3):** `+1` — less sync noise when flipping apps; clearer Offline chrome.

**What changed:** `src/continuityResume.ts` (coalesce + reconnect poll backoff); App continuity loop uses resume gate; offline freshness copy; soft-presence comment (no focus heartbeat); tests.

**Verification:** `pnpm check` green on PR; live bundle contains `Offline · will sync when you're back`.

**Data/environment:** Development client only. No schema, secrets, Production.

**Next owner:** Optional tab-hide/show + airplane-mode smoke.

## T3-S2 soft presence (2026-08-27)

**Status:** Merged via #202 onto `main` and kitchen deploy verified. Risk: **Low–Medium** (privacy UX).

**Household outcome:** Calm “Bianca is in the kitchen” chrome for signed-in partners. Optional Realtime presence when Development Realtime is on; D-100 devices remain the durable fallback. Opt-out: “Hide that I'm in the kitchen.”

**Budget delta (5):** `0` — presence never posts money or carries personal ledger rows.

**Engagement delta (3):** `+2` — soft shared kitchen presence without surveillance ranking.

**What changed:** `softPresence.ts`, `softPresenceRealtime.ts`, `SoftPresenceStatus.tsx`; App stamp/share/track wiring (signed-in + throttle + opt-out); Pairing opt-out + member names; conflict merge uses `mergeDevices`; tests.

**Verification:** `pnpm exec vitest run test/soft-presence.test.ts test/soft-presence-realtime.test.ts`; privacy-auditor **PASS WITH NOTES** (Dev presence topics not membership-private — accepted until private channels; opt-out now flushes inactive device row).

**Data/environment:** Development client only. Presence payload is memberId/deviceId/seenAt. No schema, secrets, Production, or deploy.

**Next owner:** Optional two-phone smoke with Realtime on; confirm opt-out hides self.

## T3-S1 optimistic command chrome (2026-08-27)

**Status:** Merged via #200 onto `main`. Risk: **Medium** (UX only; CommandOutcome unchanged).

**Household outcome:** Linked Development confirms feel instant: Saving → This phone → Cloud → Household progress rail; success toast still waits for PGlite accept; background flush upgrades chip to Up to date.

**Budget delta (5):** `+1` — honest progressive sync chrome reduces false “posted to cloud” belief.

**Engagement delta (3):** `+2` — confirm path feels responsive without celebrating before books accept.

**What changed:** `commandProgress.ts`, `CommandProgressStatus.tsx`, `App.tsx` commit/flush wiring, styles, `test/command-progress.test.ts`.

**Verification:** `pnpm exec vitest run test/command-progress.test.ts test/command-surface.test.ts` → 12 pass; `pnpm check` green.

**Data/environment:** Development client only. No schema, secrets, Production, or deploy.

**Next owner:** Done on main — optional manual confirm smoke.

## G6 Tier 1 proof gaps — Migration 012 harness (2026-08-27)

**Status:** Merged via #197 onto `main`. Risk: **High** (hosted continuity transport proof; no money meaning change).

**Household outcome:** T1-S5 two-client harness exercises the same Auth + Migration 012 atomic publish path production uses, and inbound Realtime pulls accept through `acceptHouseholdWrite` like `App.tsx`.

**Budget delta (5):** `+2` — proof that shared CAS and personal envelope commit atomically in tests before T2 planning continues.

**Engagement delta (3):** `+1` — partner visibility harness now matches live transport semantics.

**What changed:** `src/ledger/continuityCasHarness.ts` (in-memory 012 CAS + fetch stub); `continuityTwoClientHarness.ts` Auth config, 012 stub, `acceptHouseholdWrite` on pull; `test/continuity-cas-harness.test.ts`; `scripts/smoke-continuity-cas.mjs` + `pnpm books:smoke:012`; G6 worksession doc update. Includes cherry-picked T6 build fix (`setShowConflictSheet` removal fallout from #194).

**Verification:** `pnpm exec vitest run test/continuity-cas-harness.test.ts test/continuity-two-browser-proof.test.ts` → 13 pass; full `pnpm check` green. P1-4 confirmed live Jonathan SQL Editor 2026-08-27.

**Data/environment:** In-memory Vitest + optional live Development smoke (JWT required). No schema apply, secrets, Production, or deploy.

**Next owner:** Optional `SUPABASE_ACCESS_TOKEN=… pnpm books:smoke:012` on Development.

## Auto-resolve sync conflicts — no blocking modal (2026-08-27)

**Status:** Branch `cursor/auto-sync-conflict-resolve-12ce`, draft PR. Risk: **Medium** (sync UX + conflict resolution policy).

**Household outcome:** Sync divergences resolve behind the scenes. The “Two versions need review” sheet is gone; when share hiccups, users see **Retry now** / background sharing chrome only (T1-S6 freshness UI continues separately).

**Budget delta (5):** `+2` — automatic conflict resolution preserves local books, absorbs disjoint shared money, and never silent-LWW on command-log replay.

**Engagement delta (3):** `+2` — removes blocking conflict modal; sync feels continuous.

**What changed:** `autoResolveSharedConflict` in `src/core/conflict.ts`; wired through `api.ts`, `commandRuntime.ts`, `App.tsx` replay loop; `ConflictResolution` modal removed; `commandSurface` maps conflicts to Retry; command-log materialization defers same-id conflicts without overwrite.

**Verification:** `pnpm test` 822 pass; `pnpm check` green.

**Data/environment:** Development client only. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — review/merge PR; optional two-phone smoke on Development kitchen.

After a long thread, [WORKING_MEMORY.md](WORKING_MEMORY.md) recaps *this chat*. GitHub remains the full project context (D-095): [DECISIONS.md](DECISIONS.md), merged PRs, living specs, [nostalgia/](nostalgia/), [reference/](reference/). Do not treat unfinished chat as `main`. Do not skip GitHub history.

Cloud-continuity canon is [CLOUD_CONTINUITY.md](CLOUD_CONTINUITY.md): Google sign-in must reveal personal and household ledgers from any device, no peer device is the host, data through 2026-09-30 is disposable/open Development data, and the security cutover is mandatory before meaningful October data.

## Hercules Pro shift cloud sync after Reload (2026-08-27)

**Status:** Branch `cursor/hercules-pro-shift-cloud-sync-403c` (draft PR). Risk: **Medium** (continuity flush path + Pro diagnostics; no money meaning change).

**Household outcome:** Development Reload force-flushes harbour tip shifts into the hosted shared snapshot so Hercules Pro can read the same shift counts as Work report / free Hercules. Empty Pro answers include an explicit cloud snapshot check.

**Budget delta (5):** `+1` — Pro shift facts depend on the same posted shared ledger the books already show.

**Engagement delta (3):** `+1` — Pro stop saying “0 shifts” when the phone Work report is full after Reload.

**What changed:** `commitHousehold` / `persist` gain `forceFlush`; stress Reload awaits outbox flush and surfaces pending/conflict; `shift_summary` default period `this_month`; Pro Worker appends cloud shift counts on empty diagnostics; regression that shared projection keeps harbour shifts and matches Work report.

**Verification:** `pnpm exec vitest run test/stress-seed.test.ts test/hercules-pro.test.ts` → 17 pass. Demo script: shared cloud shifts == local; `shift_summary` matches `workReportFacts` this-month count.

**Data/environment:** Development client + Worker text only. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — merge, deploy Worker + app, Reload Development → wait until sync quiet / Retry now if pending → ask Pro “how many shifts this month.”

## Hercules rig engine — Worker route, MCP dispatch, furniture macros (2026-08-26)

**Status:** Branch `cursor/hercules-rig-engine-90cc`, PR #167. Risk: **Low** (presentation-only; no money, no ledger reads).

**Household outcome:** Remote agents and Hercules Pro can puppeteer the live kitchen cat part-by-part (head, tail, each leg). Desk instruments trigger layered rig macros when expanded on Home. Fly auto-deposit (PR #163) remains separate.

**Budget delta (5):** `0` — rig never posts money or reads books.

**Engagement delta (3):** `+2` — AI-controllable animation + furniture-reactive cat.

**What changed:** `src/herculesRig/` engine (parts, clips, validate, transport, macros); `HerculesFigure` inline transforms; Worker `POST /hercules/rig` + `GET /hercules/rig/poll` with KV/memory queue; MCP `hercules_rig_dispatch`; client poller in `HerculesRigProvider`; `HerculesOfficeRigBridge` on widget expand; [HERCULES_RIG.md](HERCULES_RIG.md).

**Verification:** `test/hercules-rig.test.ts` (10), `test/hercules-rig-validate.test.ts` (3), `test/hercules-rig-worker.test.ts` (2), `test/hercules-pro.test.ts` rig tool count (68 tools, 67 read-only) — all green. Full `pnpm test`: 675 pass; 2 pre-existing `batch-import-ui` SubtleCrypto failures unchanged on `main`.

**Data/environment:** Development client + Worker routes. No schema, secrets, Production, or deploy.

**Next owner:** Jonathan — review/merge PR #167; optional live deploy smoke of `/hercules/rig` + `hearthRig().sessionId()` + MCP dispatch.

**PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/167

## Phase 0 secure Flinks Connect inbox (D-148, 2026-08-26)

**Status:** Merged via #161 onto `main@efac0d2`. Risk: **High** (hosted Worker + bank evidence boundary).

**Household outcome:** Flinks supplies read-only bank evidence to the import inbox on Development. Connect uses Supabase bearer + membership scope, encrypted D1 state, iframe origin validation, HMAC-redacted inbox payloads, and DeleteCard disconnect. PR #160 `/flinks/sync` and browser LoginId storage are retired. Account-scoped category autofill from PR #160 remains in `prepareImportRows`. Final Confirm still posts money.

**Budget delta (5):** `+2` — secure bank evidence path without weakening Confirm or posting authority.

**Engagement delta (3):** `+2` — Import from Flinks returns on Batch Import with Connect + one-tap import after link.

**What changed:** `workers/flinks.js` (`/bank/flinks/*`), D1 migration, `FlinksConnectPanel`, `flinksClient`, `parseFlinksInbox`, Batch Import wiring, vite proxy, wrangler D1 binding. Minor fix: `documentScanner` SubtleCrypto digest for jsdom receipt tests.

**Verification:** Corrected Flinks + import triage + Batch Import UI 51/51. Full serial suite reached 686 pass / 2 skipped with one unrelated 30-second stress-fixture timeout; that complete stress file passed 7/7 with a 90-second allowance. TypeScript + production build, Wrangler dry run/startup profile, and non-traffic Cloudflare version `1d296d03-7776-4d72-add1-217dc718e377` are green. Live combined `main@10f466a` reports `sandbox-configured`; unauthenticated member access returns JSON `401`; legacy `/flinks/sync` returns `410`; the live bundle contains the Connect/fetch controls.

**Privacy review:** PASS WITH NOTES — Development scaffold only. Exact member scope, ownership-bound encrypted state, iframe origin/window and callback state, selected CAD accounts, bounded responses, provider-delete retry state, stable HMAC identifiers, and Final Confirm were rechecked. Server-side loginId attestation remains a Production follow-up.

**Data/environment:** Development only; Production activation is refused. No Supabase schema apply or secret values committed. D1 `hearth-flinks-development` is bound and migrated; five legacy PR #160 demo rows were preserved in a renamed legacy table. All five required Flinks values are secret bindings on the live Worker.

**Worksession:** [`worksessions/2026-08-26-flinks-connect-sandbox.md`](worksessions/2026-08-26-flinks-connect-sandbox.md), [`worksessions/2026-08-26-flinks-development-scaffold.md`](worksessions/2026-08-26-flinks-development-scaffold.md)

**Next owner:** Jonathan — live Flinks Connect smoke on deployed Development after merge.


## Phase 0 optional-publish demotion + hosted honesty (D-147, 2026-08-26)

**Status:** Implementation merged via #157 onto `main@2ee381e` (`ca70ce1`). Follow-up draft PR #158 realigns continuity tests that still assumed legacy GET-compare-POST. Risk: **High** (product) / **Medium** (follow-up tests).

**Household outcome:** Ordinary use never needs **Publish to the cloud**. Auth-off legacy publish is Advanced recovery only. Automatic continuity refuses a racy legacy upsert when CAS is missing, and Personal-scope failure after Shared CAS stays pending in the outbox.

**Budget delta (5):** `+3` — remove false Publish authority; fail closed on partial hosted writes.

**Engagement delta (3):** `+1` — Invite chrome matches the Google door.

**What changed:** `commandRuntime` transports only on `transportRequested`; Pairing demotes Publish; `supabase` Personal-fail honesty + refuse-legacy; `continuity` flush treats `pushed.error` as pending; Hercules concurrent rate tests + [HERCULES_KV_BINDING.md](HERCULES_KV_BINDING.md); [GITHUB_BRANCH_PROTECTION.md](GITHUB_BRANCH_PROTECTION.md); [WORKING_MEMORY.md](WORKING_MEMORY.md) reconciled.

**Verification:** Full `pnpm check` on the implementation branch → 658 pass / 2 pre-existing `batch-import-ui` SubtleCrypto fails. Follow-up #158: continuity/proof/live-pull/production/auth-membership 43/43 green after rebase onto post-#157 `main`. Privacy/books/UX auditors: PASS WITH NOTES.

**Data/environment:** Development client + Worker guard + docs. No schema migrate, secrets, Production, Cloudflare KV create, or GitHub ruleset apply (Jonathan).

**Worksession:** [`worksessions/2026-08-26-phase0-remaining.md`](worksessions/2026-08-26-phase0-remaining.md)

**PRs:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/157 (merged) · https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/158 (follow-up tests)

**Next owner:** Jonathan — merge #158 so main CI matches refuse-legacy; create `HERCULES_RATE` KV + deploy; apply branch ruleset; Create/invite smoke and two-browser E2E remain separate.

## Phase 0 evidence + membership tuple + hash acceptance (D-146, 2026-08-26)

**Status:** Merged via #156 onto `main@391e3af`. Risk: **High**.

**Household outcome:** Sheets-era issues/PRs have retained evidence; automatic continuity boundaries validate environment + Google membership; pulled/merged money cannot become active books on entry-count alone — PGlite and `financialAuditHash` must agree.

**Budget delta (5):** `+3` — fail-closed identity and books acceptance on discovery/pull/persist/outbox/switch.

**Engagement delta (3):** `0` — safety and tracker hygiene.

**Verification:** Focused `environment-isolation` + `hosted-transport` + `command-runtime` green; `tsc --noEmit` green; full `pnpm test` on branch.

**Worksession:** [`worksessions/2026-08-26-phase0-evidence-isolation-hash.md`](worksessions/2026-08-26-phase0-evidence-isolation-hash.md)

**Next owner:** Jonathan — review PR; remaining Phase 0: optional-publish removal, full atomic hosted stack, Hercules KV, branch protection, WORKING_MEMORY canon drift.

## Scheme A naming clarity (D-144, 2026-08-26)

**Status:** Merged via #154 onto `main`. Risk: **Medium**.

**Household outcome:** All chrome the household sees uses plain Scheme A labels (Groceries, Goals, Health, Sit-down, Shifts, Goals savings, Mark purchased). Only Hercules AI talk and Hercules Pro may use cat/kitchen metaphors, and those lines gloss the human money meaning.

**Budget delta (5):** `+2` — money controls stop sharing colliding metaphors.

**Engagement delta (3):** `+1` — Hercules keeps personality in AI/Pro only.

**Verification:** Focused naming/hercules/office tests green; `tsc` green; `pnpm build` green; `pnpm check` blocked only by pre-existing `batch-import-ui` SubtleCrypto failures on `main`. Phone CDP proof: seals Post/Due/Health; story Goals; Pad chips Groceries/Coffee; account Goals savings.

**Data/environment:** Development demo only; no schema/secrets/Production/deploy.

**Next owner:** Jonathan — naming is on `main`; no further action unless chrome regressions appear.

## Slim continuity outbox + gzip payloads (D-145, 2026-08-26)

**Status:** Merged via #155 onto `main`. Risk: **High**.

**Household outcome:** Large Development books can share without blowing browser `localStorage` quota. The durable outbox stores a slim tip pointer; flush publishes the live accepted household. Personal cloud envelopes may gzip; shared CAS snapshots stay plain JSON for live 006 SQL guards; legacy plain JSON still pulls.

**Budget delta (5):** `+3` — continuity transport reliability; prevents share stalls that diverge two phones’ books.

**Engagement delta (3):** `+1` — Retry/share stays honest under stress fixtures.

**What changed:** `src/ledger/snapshotPayload.ts` codec; shared CAS payloads stay plain JSON (006 SQL guards); personal envelopes may gzip; `continuity.ts` IDB-first slim durable outbox + tipRevision-aware live resolve; D-145 in decisions + continuity canon.

**Verification:** Focused vitest green; size demo fat outbox ~93KB → slim ~427B; personal gzip ~10.6% wire; books/privacy auditors passed on the PR.

**Data/environment:** Development client transport encoding only; no schema migrate, secrets, Production, or real household data.

**Worksession:** [`worksessions/2026-08-26-outbox-compress.md`](worksessions/2026-08-26-outbox-compress.md)

**PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/155

**Next owner:** Jonathan — after deploy, on the quota desktop tap **Retry now**; confirm banner clears and Bianca’s entry count / Assets converge.

## Auth membership continuity authority (D-143, 2026-08-26)

**Status:** Merged via #152 onto `main`. Live Create/invite smoke still open. Risk: **High**.

**Household outcome:** Automatic cloud share requires a Google continuity identity that matches an active household member. `linked` alone no longer publishes. Phrase remains Advanced recovery routing. Live anon REST stays denied; migration 010 bind RPC is live.

**Budget delta (5):** `+3` — membership is the only automatic write authority.

**Engagement delta (3):** `+1` — Continue with Google / Auth invites stay the normal door.

**Verification:** Focused vitest + `VITE_SUPABASE_LIVE=1` anon denial matrix. Signed-in Create/invite redeem still needs Jonathan.

**Worksession:** [`worksessions/2026-08-26-auth-membership-authority.md`](worksessions/2026-08-26-auth-membership-authority.md)

**Next owner:** Jonathan — Continue with Google Create/open, issue QR invite, redeem on a second session; Cursor continues S5 canon after smoke.

## Continuity outbox quota + Retry now (2026-08-26)

**Status:** Branch `cursor/fix-outbox-quota-retry-129b`; PR pending. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** When the phone's browser storage is full, Hearth still keeps the share queue in memory (and IndexedDB when possible), shows a clear message instead of a raw `setItem` quota error, and **Retry now** can push the live books to the cloud — including when the durable outbox was emptied by quota.

**Budget delta (5):** `+2` — share path must work so Pro and other devices see posted shifts/journals; books stay local-first and Confirm remains the write boundary.

**Engagement delta (3):** `+1` — Retry now is honest and usable; no cryptic Storage exception in the banner.

**What changed:** `continuity.ts` memory+IDB outbox resilience, `humanizeContinuityError`, flush seeds `liveHousehold` on forced Retry; banner action is Retry now; `App.retryShareNow` no longer marks synced when nothing flushed.

**Verification:** `pnpm exec vitest run test/continuity.test.ts test/command-surface.test.ts` (+ related share tests).

**Data/environment:** Development code only; no schema/secrets/Production.

**Next owner:** Jonathan — on the phone showing the quota banner, tap **Retry now** after Google sign-in; confirm chip clears and Pro can read shifts after sync.

## Hercules read-only reconnect fallback (D-137 follow-up, 2026-08-26)

**Status:** Branch `codex/hercules-readonly-reconnect`; focused tests and TypeScript green, deployment/live proof pending. Risk: **Medium**.

**Household outcome:** A broad ChatGPT reconnect no longer blocks Hercules when writing is off. OAuth narrows `hearth.read hearth.write` to `hearth.read`; it does not change either member-owned write opt-in.

**Verification:** Rebased over #147; `test/hercules-pro.test.ts` + `test/continuity.test.ts` 19/19 and `tsc --noEmit` green. The branch corrects #147's stale `WorkPaySchedule` test fixture without changing runtime continuity. PR/main CI, Worker deploy, reconnect, and resumed PiP smoke remain.

**Worksession:** [`worksessions/2026-08-26-hercules-readonly-reconnect.md`](worksessions/2026-08-26-hercules-readonly-reconnect.md)

## Hercules Pro shift read repair (2026-08-26)

**Status:** Branch `cursor/fix-pro-shift-read-129b`; PR pending. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** Hercules Pro can read the connected member's posted shift history from hosted snapshots the same way in-app Hercules can, including personal-envelope shifts and legacy household-stamped own shifts when ChatGPT uses the default Personal ledger.

**Budget delta (5):** `+1` — shared cloud overlay now matches the phone; shift/oracle read tools include the worker's own posted rows in Personal view without crossing partner-personal boundaries.

**Engagement delta (3):** `+1` — Pro tip/shift tools (`shift_summary`, Shift Oracle, sim/review packs) return facts instead of empty answers when cloud continuity has synced shifts.

**What changed:** `overlayPersonalReplica` / `personalEnvelopeFromPayload` moved to `sync.ts` and wired through `supabase.ts` + `herculesPro.js`; `householdForShiftReadTools` scopes shift reads; tests in `visibility.test.ts` and `hercules-pro.test.ts`.

**Verification:** `pnpm exec vitest run test/visibility.test.ts test/hercules-pro.test.ts test/hercules-tools.test.ts` green (29 tests). Full `pnpm test`: 624/626 green; 2× pre-existing `batch-import-ui` SubtleCrypto failures on `main`.

**Uncertainty:** Live ChatGPT smoke against a signed-in Development household with synced personal shifts not run in this VM. Jonathan's 2026-08-26 check showed `shift_summary` 0 on both Personal and Household — that matches **empty hosted snapshots**, not a period-filter bug. In-app Hercules reads local PGlite; Pro reads cloud only until sync completes.

**Data/environment:** Development code only; synthetic fixtures; no schema, secrets, Production, or deploy.

**Next owner:** Jonathan — on the phone with shifts: confirm Google sign-in, wait for sync (no pending/error chip), optionally More → Reload random data (keep identity) to seed stress shifts, then re-ask Pro. After merge+deploy, `cloudBooks.memberShiftCount` in shift tool responses shows hosted shift totals explicitly. Review PR.

## Hercules PiP auto-load (D-139 follow-up, 2026-08-26)

**Status:** Branch `codex/hercules-pip-autoload`; locally verified, deployment and connected-ChatGPT proof pending. Risk: **Medium**.

**Household outcome:** On the first user turn of a new Hercules Pro conversation, `summon_hercules` is the required first tool. Resource v3 requests picture-in-picture as soon as the optional ChatGPT bridge appears, while the animated inline card remains the fallback when the host declines or lacks PiP.

**Boundaries:** A blank chat cannot invoke an MCP tool before the person sends a message, and ChatGPT retains final display control. No accounting calculation, OAuth scope, write authority, schema, secret, Production data, or household row changed.

**Verification:** Rebased over the merged Pro synced-shift repair (`e768a6d`); focused 3 files / 22 tests, full 89 files / 627 tests, TypeScript, production build, Wrangler dry run, and diff check are green. Connector v3 and new-chat first-turn behavior remain to be verified after merge/deploy.

**Worksession:** [`worksessions/2026-08-26-hercules-pip-autoload.md`](worksessions/2026-08-26-hercules-pip-autoload.md)

## Hercules companion load repair (D-139, 2026-08-26)

**Status:** **Complete.** [PR #143](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/143) merged as `cb77cad`; main Worker deployment succeeded; connector refreshed to resource v2; live ChatGPT rendered the 3D model and reported `Hercules is listening`. Risk: **Medium**.

**Household outcome:** ChatGPT can fetch the animated companion across its sandbox boundary. A missing module, WebGL failure, or stuck GLB now resolves to the static Hercules mark instead of permanent `Waking Hercules…`.

**Boundaries:** Exact public JS/GLB/SVG assets only; URI v2 is the ChatGPT cache boundary. No ledger facts, OAuth, command authority, schema, secret, Production data, or household row changes.

**Verification:** 89 test files / 622 tests, TypeScript, production build, Wrangler dry run, PR/main CI, connector template v2, and live inline 3D card all green. Picture-in-picture is host-controlled; verified inline remains the fallback surface.

**Worksession:** [`worksessions/2026-08-26-hercules-companion-load-fix.md`](worksessions/2026-08-26-hercules-companion-load-fix.md)

## Stress reload weighted shifts (D-138, 2026-08-25)

**Status:** Follow-up branch `cursor/pro-legible-reload-85bf` (continuity preserve on Reload for Hercules Pro). Stress trends merged via PR #136; this packet keeps Google identity so Pro can read Reload fixtures. Not merged, not deployed. Risk: **Medium**.

**Household outcome:** More → Reload random data fills twelve months of complete Harbour Dining Room shifts with weather notes, Toronto GPS stamps, and weekday/season/weather-weighted tips so Hercules Pro can analyze realistic trends.

**Budget delta (5):** `+1` — same `postWorkShift` / settlement commands; every sales, tip, break, clock, and destination field filled; optional location/`occurredAt` stamps on work-shift rows.

**Engagement delta (3):** `+2` — reload fixture carries analyzable tip weather/location/weekday trends for Hercules Pro testing.

**Worksession:** [`worksessions/2026-08-25-stress-shift-trends.md`](worksessions/2026-08-25-stress-shift-trends.md)

**Verification:**
- `pnpm exec vitest run test/stress-seed.test.ts test/work-jobs.test.ts test/timezone-location.test.ts` → focused green (includes continuity-preserve Reload proof)
- `pnpm ai:verify` + `tsc --noEmit` + `vite build` green (re-run after continuity fix)
- Trend proof (seed `424242`): Fri/Sat tip/hr 1552¢ > Mon–Wed 1177¢; clearish 1557¢ > rainy 1020¢; 177 job-based shifts with Harbourfront stamps
- Full `pnpm check` fails 2× `batch-import-ui` SubtleCrypto digests on **this branch and `main`** (pre-existing; unrelated)
- Books auditor: PASS
- After merge with `main`: Pro `tools/list` expects companion + catalog + write (**64**)
- Continuity: Reload with `preserveFrom` keeps householdId / linked / Google links; tip shifts follow signed-in `tipMemberId`

**Pro fixture path:** Development → Google Create → Reload random data (keeps identity) → sync → Connect Hercules Pro → tip_oracle / shift_year_simulation. See `docs/HERCULES_PRO.md`.

**Data/environment:** Synthetic Development fixtures; no hosted schema, secrets, Production mutation, or peer-device requirement. Reload UI itself remains available when the env pill is Production (pre-existing).

**Next owner:** Jonathan: Development Google Create → Reload → sync → Connect Pro; smoke tip_oracle / year sim. Review this follow-up PR. Do not merge/deploy without approval.

## Shift year simulation + sandbox gate (D-140, 2026-08-25)

**Status:** **Merged** to `main` as [`6baf033`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/6baf033) via [PR #138](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/138). Not deployed/live-verified. Risk: **Medium**.

**Household outcome:** Hercules (free + Pro) can build a reproducible next-year tips+wages simulation from posted shifts and teach how it works. Python sandbox is designed as a later High-risk gate, not built.

**Budget delta (5):** `+2` — deterministic year Monte Carlo of tips and wages; never posts.

**Engagement delta (3):** `+2` — teachable year simulation for Pro and free Hercules.

**Worksession:** [`worksessions/2026-08-25-shift-year-simulation.md`](worksessions/2026-08-25-shift-year-simulation.md)

**What changed:** `runShiftYearSimulation` / `explainShiftYearSimulation` in `tipScience.ts`; tools `shift_year_simulation` + `explain_shift_simulation` on free Hercules (Worker planner + on-device) and Pro MCP; D-140 + sandbox gate in `HERCULES_PRO.md`; Pro `tools/list` = companion + catalog + write (64).

**Verification:** focused tip-science / hercules-tools / hercules-pro green on the packet; CI green before merge.

**Data/environment:** Development code only; fictional demo/stress data in tests; no schema, secrets, Production, or deploy.

**Next owner:** ChatGPT Pro smoke when convenient; Worker deploy remains separately gated.

## Environment isolation Phase 0 (2026-08-25)

**Status:** Merged to `main`. Follow-up branch `cursor/legacy-pull-env-bind-f375` closes the leftover legacy `readRemoteSnapshot` environment query filter and adds two-client clock-skew / partial-failure proofs.

**Budget delta (5):** `+2` (original) / follow-up `+1` — legacy pull scoped to env+household; fault harness covers clock skew + mid-publish failure recovery.

**Engagement delta (3):** `0`

**Verification:** focused vitest on `supabase` + `hosted-cas-two-client`; then `pnpm check`.

**Next owner:** Review follow-up PR; two-phone Auth smoke still needs devices.

## App Store sync UX P0+P1 (2026-08-25)

**Status:** **Merged** to `main` as [`3dcb12f`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/3dcb12f) via [PR #114](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/114). Not deployed/live-verified yet. Risk: **High**.

**What was examined:** Conflict sheet, Undo persistence, Sign out wipe, Pairing Invite/Advanced, command Retry, Restore tip host/privacy, personal live-pull.

**Verified findings:** Shared-only conflict impact; Undo scoped env+household+member (last 20); Sign out clears Auth/Google/session/undo/outbox/sync-anchor/pending invite + local household; restore tips strip Personal; Retry force-flushes outbox.

**Changes:** See PR #114 diff (`ConflictResolution`, `undoHistory`, `Pairing`, `App`, `restorePoints`, `continuity`, `supabase` personal pull).

**Budget delta (5):** `+3` — conflict impact honesty; durable Undo on this phone; Restore blast-radius + tip host + Personal strip; Retry flush; personal live-pull; complete Sign out local wipe.

**Engagement delta (3):** `+2` — Pairing Invite/Advanced; clearer sync chrome; Sign out clarity.

**Worksession:** [`worksessions/2026-08-25-appstore-sync-ux.md`](worksessions/2026-08-25-appstore-sync-ux.md)

**Verification:** focused vitest + `pnpm check` passed on packet. UI smoke on local Vite demo (Invite/Advanced, Recent copy, Sign out confirm). Two-phone Auth smoke still needs Jonathan/Bianca devices.

**Remaining uncertainty / decision needed:** Confirm worksession defaults if any are wrong. Two-phone Auth smoke on live Dev.

**Data/environment:** Development client only; disposable Dev data; no hosted schema/secrets/Production mutation; no peer device required online for Sign out.

**Next owner:** Two-phone smoke on live Dev; verify Workers deploy from `main` CI green.

## Combined undo + restore engine (2026-08-25)

**Status:** Branch `cursor/undo-restore-engine-f375` (not merged). Confirmation-scoped LIFO **Undo** (partner stays, auto CAS) + owner **Restore points** (D-124 shape in household payload). Dev last-sync whole-snapshot Undo retired.

**Budget delta (5):** `+3` — safe dual-use Undo; owner Restore; refuse while conflicted.

**Engagement delta (3):** `+1` — Undo vs Restore labels; Recent LIFO of my ledger writes.

**Worksession:** [`worksessions/2026-08-25-undo-restore-engine.md`](worksessions/2026-08-25-undo-restore-engine.md)

**Next owner:** Review PR; smoke Undo with partner post present; smoke owner Restore after sync.

## Live pull dual-use (2026-08-25)

**Status:** Merged via PR #109.

## Risk routing

| Risk | Examples | Default routing |
|---|---|---|
| Low | Copy, styling, docs | One implementer |
| Medium | Dialog, pure calculation, cosmetics that cannot post | Implementer plus a targeted review |
| Medium-High | Cross-layer financial evidence/proposals or privacy-sensitive shaping that cannot itself post | Implementer plus targeted domain review |
| High | Financial math, migrations, splits, account kinds, statement figures | Implementer plus independent review |
| Release | Switching daily use, hosted schema, auth/RLS | All reviewers, Jonathan approves |

## Hercules living teacher (D-132)

**Status:** implemented on `codex/hercules-living-teacher`; independent privacy/numeric review required before merge. No deploy, schema, hosted row, secret, or Production mutation.

**History finding:** `38af6ef`/`1055d56` are the compact floating-bubble lineage. `6e8e40d` added strong per-message widget snippets while ordinary chat stayed as plain transcript rows. D-132 adapts that per-message visual language without reverting grounded chat, request identity, or model safeguards.

**Budget delta (5): +2** — typed clickable book-source records; explicit Household versus Personal question projection; partner-personal refusal before aggregation/model transport; grounded food/spend/income/shift answers.

**Engagement delta (3): +3** — restored turn bubbles, legitimacy cards, teacher copy, and desktop fly/litter play. Fly piles are session-only and disappear on reload; mobile/reduced motion renders no fly.

**Next owner:** independent review of provenance routing, shared-member aggregation, personal-ledger refusals, and desktop/mobile visual behavior. Do not deploy from this branch.

## Hercules Sim + Review packs (D-142)

**Status:** Draft PR [#140](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/140) on `cursor/hercules-sim-review-packs-129b` (rebased onto `main` after D-138–D-141 landed). Not merged; not deployed; no schema/secrets/Production mutation.

**Baseline:** rebased onto current `main`. Worksession: [`worksessions/2026-08-26-hercules-sim-review-packs.md`](worksessions/2026-08-26-hercules-sim-review-packs.md). Decision renumbered **D-142** because `main` already used D-138–D-141.

**What landed:** `simReview.ts` with Cash Cinema, What-If Desk, Year-in-Review; three shared read tools; Pro MCP `usedTool` + answer prefix; full inventory [`HERCULES_PRO_CAPABILITIES.md`](HERCULES_PRO_CAPABILITIES.md); teacher skill names the tool. Pro `tools/list` is now **67** (companion + 63 reads + 3 write-path).

**Budget delta (5):** `+3`

**Engagement delta (3):** `+2`

**Verification:** focused `sim-review` + `hercules-pro` after conflict resolution; CI pending on merge commit.

**Next owner:** Independent trust review of forecast math + announcement contract; Jonathan merge decision. Do not deploy from this branch.

## Hercules Shift Oracle (D-137)

**Status:** Core Oracle **merged** to `main` via [#133](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/133). Schedule-weighting **merged** via [#137](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/137). Not deployed; no schema/secrets/Production mutation.

**Baseline:** Strategy 3 implementation from `main@6e2baea` lineage. Worksession: [`worksessions/2026-08-25-hercules-shift-oracle.md`](worksessions/2026-08-25-hercules-shift-oracle.md).

**What landed on main (#133):** deterministic `tipScience.ts` with seeded Monte Carlo tip floors, weather/season-adjusted outlook, cadence schedule sim, educational tax-milk/buffer; four shared read tools for free Hercules + Pro (`tip_oracle`, `shift_outlook`, `tip_schedule_sim`, `tax_milk_plan`); Bernoulli day cadence from today; order-stable observations.

**Follow-up (#137):** probability-weight `tip_schedule_sim` totals by weekday frequency; Pro `tools/list` count was 61 before D-138.

**Budget delta (5):** `+3` (merged) / follow-up `+1`

**Engagement delta (3):** `+2` (merged) / follow-up `0`

**Verification:** tip-science + hercules-pro focused suites green on follow-up; full check on this agent VM also hits 2 unrelated `batch-import-ui` SubtleCrypto failures.

**Next owner:** Development smoke in ChatGPT Pro + in-app Ask after D-138; do not deploy without approval.

## Hercules Brain v2 typed reads + free depth (D-133/D-135)

**Status:** implemented on `codex/hercules-brain-v2-tools`; no deploy, schema, hosted row, secret, or Production mutation. Built on the D-132 living-teacher branch so the result cards use its typed provenance UI.

**Shape:** `/hercules/plan` may select at most four of sixteen fixed read-only tools. Provider output is sanitized on the Worker and phone. The phone executes against `householdForHerculesContext`; Personal never widens to a partner and Household never exposes personal-only rows. There is no SQL, code, mutation, or Confirm capability. Planner failure preserves the existing chat/local fallback.

**Spend posture:** Workers AI is first for planning, grounded voice, and selected-image scanning. Gemma 4 is tried before Llama 3.1. OpenAI/Anthropic are inert unless `HERCULES_ALLOW_PAID_PROVIDERS=true`; checked-in Development configuration is `false`, including when provider secrets happen to exist. No Worker was deployed in this slice.

**Budget delta (5): +3** — grounded balances, searches, summaries, bills, shifts, goals, obligations, cash position, budget variance, categories, cards, net worth, audit health, and duplicate review compose without granting model write authority.

**Engagement delta (3): +3** — Hercules can answer broader natural-language financial questions, then gives the deterministic result a short grounded cat-voice pass while every shown amount remains a tappable legitimacy card.

**Next owner:** review catalog arithmetic/scope, provider plan parsing, and source routing; then smoke the four prompts in `docs/HERCULES.md`. Do not deploy from this branch.

Dual Course (D-048): if Course A (books, weight 5) and Course B (engagement, weight 3) disagree, the books win. A companion change that can touch CAD meaning is High, not Medium.

## Required handoff

Status, what was examined, verified findings, changes, verification, remaining uncertainty, decision needed. For continuity work also state the Google identity and ledger scopes, whether any peer device must remain online, offline/outbox behavior, hosted mutations, environment, schema, and whether data was disposable Development data.

Also name:

- **Budget delta (5)** — which posting, rec, sit-down, account-literacy, split-honesty, Health, or statement primitive moved.
- **Engagement delta (3)** — which Hercules line, unlock, chalkboard, wallet tile, ceremony, or Ask chip moved.

If either delta is “none,” say why Dual Course still holds (for example GitHub 2FA is Course A with no mascot on purpose).

Read [nostalgia/](nostalgia/) and [reference/](reference/) to understand past decisions. Do not cite them as the next build plan.

Sheets-era handoff notes (museum): [reference/sheets-era/AI_HANDOFF.md](reference/sheets-era/AI_HANDOFF.md).

## Development continuity slices (D-114 and D-117, PRs #72–#75)

**Status:** exact Google-subject Development discovery, PGlite acceptance, a durable compacting local outbox, launch/focus/reconnect replay, multi-household device replicas, an explicit ledger switcher, and member-only personal device replicas are implemented. Migration 003 is applied: D-117 server-filtered membership discovery and hosted member-personal payloads are live in Development; missing tables retain the D-114 fallback. Inherited broad grants were removed and verified as exactly `SELECT`/`INSERT`/`UPDATE` for `anon` and `authenticated`. No hosted rows, deployment, Production data, or secrets were changed.

**Still required:** two-browser end-to-end proof, Supabase Auth-bound membership, and the late-September deny-by-default RLS cutover. Migration 002 is live in Development; its forward concurrency repair is unapplied migration 005.

**Budget delta (5):** `+4` — accepted offline commands survive reconnection, pulled snapshots pass PGlite, stale remote revisions retain both sides, and locally switching households no longer overwrites a different ledger.

**Engagement delta (3):** `0` — account continuity is trust infrastructure; Hercules and office chrome were intentionally unchanged.

## Command states Slice A+B (D-119, PR #76 merged)

**Status:** Merged to `main` as [PR #76](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/76). Claude authored the UX/copy spec; Cursor Cloud Agent (GPT) implemented parallel Slice A (Add/Confirm a11y) and Slice B (command chrome, sync anchor, conflict choose) plus `App.tsx` integration. Jonathan resolved eight product defaults on 2026-08-24. Worksessions: [`2026-08-24-command-states-slice-ab.md`](worksessions/2026-08-24-command-states-slice-ab.md).

**Budget delta (5):** `+2` — command UI derives from `CommandOutcome`; Development undo/reverse restores last sync anchor; in-app conflict choose without silent LWW.

**Engagement delta (3):** `+1` — accessible Add sheet, honest chip/banner/toast copy; Hercules preset prompt unchanged.

**Still required:** two-device conflict choose proof; Production reversal semantics stay on D-085 until Jonathan approves D-124 build (or an interim Production D-119 approval).

## More → Recent changes copy (D-119 tighten) + D-124 accepted

**Status:** Copy tighten on `cursor/recent-changes-copy-4ffb`. Development empty state and header pill match last-sync undo; older rows say **synced**; Production empty state stays honest LIFO until D-124 ships. Button label remains **Undo**. Pure helpers in `src/recentChangesCopy.ts`.

**Budget delta (5):** `0` — wording only; restore semantics unchanged this pass.

**Engagement delta (3):** `+1` — More card no longer contradicts the toast / D-119 behavior.

**D-124 accepted (not built):** dated hosted restore points, last 30 days, visible to everyone, restore owner-only, Dev+Production together. Next build is a separate PR after Auth/RLS sequencing Jonathan chooses.

## Office chalkboard / Home themes / Hercules snippets (D-120, PR #80)

**Status:** Merged via [PR #80](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/80) and follow-up [PR #82](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/82). Desk tool button is **Home theme** (was Look).

**Budget delta (5):** `0` — chalk Save/delete never posts; bought removed from Office and legacy `DailyHearth` chalk UI.

**Engagement delta (3):** `+2` — weather chip on chalkboard band; Home theme paper stocks (pink/gold/slate; cream unchanged); Hercules widget-anchored snippet stack with placeholder prompts.

**Still required after merge:** Jonathan visual pass at 390/720+; replace Hercules placeholder copy when ready.

## Member-scoped AI disclosure (D-115)

**Status:** Merged to `main` via [PR #83](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/83). `householdForAiDisclosure` strips partner personal txs/shifts/goals/memories; `composeHerculesChatRequest` rebuilds briefing, notices, ledger, and memories from that slice. Canaries in `test/ai-disclosure.test.ts`.

**Budget delta (5):** `+1` — partner personal money cannot leak into model aggregates (Course A privacy of the books).

**Engagement delta (3):** `+1` — Hercules model-first chat can keep growing without partner-personal disclosure.

**D-116 complete in code:** each in-flight model reply is bound to its request id, environment, household id, and member id. A context switch clears the old busy state and reloads the active ledger's chat; the delayed answer is neither displayed nor recorded. Newer requests also supersede older responses. Proof: `test/hercules-reply-context.test.ts`. The phone remains the only payload composer.

## Hosted snapshot CAS + outbox ack (D-122)

**Status:** Applied to Development on 2026-08-25 (Jonathan SQL-editor paste of fixed `002_snapshot_cas.sql`). Live smoke `pnpm books:smoke:cas` **4/4**: first publish, duplicate ack, stale conflict, advance 1→2. Disposable smoke household `HH-cas-smoke-mt7xsikl`. Client + outbox work already on `main` via [PR #84](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/84) / [#86](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/86). Production schema **not** applied.

**Budget delta (5):** `+3` — live atomic hosted CAS is on for Development.

**Engagement delta (3):** `0`.

**Still required:** two-browser E2E on real devices; Auth/RLS cutover before October; Production apply is a separate approval.

**Risk:** High residual until Auth/RLS; open Development RLS unchanged through 2026-09-30.

## D-191 live command latency repair (2026-09-01)

**Status:** exact rebased High-risk candidate `351983fa225fdeeac9f23f54498ee78c4574a03d` over `origin/main@450be34b6bc84f5bf5e203154c864cccba198eb5` passed focused 64/64, full gate 1,510 passed / 3 skipped, production build, and independent books/trust plus continuity release review. Jonathan authorized push, fast-forward merge, and Development deployment on 2026-09-01. At this record, no push, merge, deployment, hosted mutation, or Production change had occurred.

**Household outcome:** command-event and snapshot-recovery acceptance now share one receiver coordinator. Snapshot echoes coalesce for 300 ms and, on expiry, check the committed command log before full recovery can occupy PGlite. Only an exact locally accepted hosted revision suppresses recovery, while missing/unknown/hidden/invalid/conflicted/gap paths retain the full pull/reconcile/PGlite route.

**Budget delta (5):** `+4`. **Engagement delta (3):** `+1`.

**Still required:** exact-tree full gate, independent books/trust and continuity verification, then separately approved release and a fresh deployed two-account 100-sample p95 run. The historical `<=500 ms` smoke is not evidence for this local repair.

## D-192 Realtime terminal-channel self-heal (2026-09-01)

**Status:** exact application commit `f3ca474` on `codex/realtime-self-heal`, cleanly rebased over `origin/main@8ae8071f16b945fe2a174a4df52e62054e1b63f3`; work originally opened from `8def9bd`, passed its final full application gate as `d477c27` over `86da91c`, then took a documentation-only Charter release advance. Jonathan authorized push, merge, and Development deployment; at this record it is committed locally, not yet pushed, merged, deployed, or live-proven.

**Household outcome:** a visible signed-in Development kitchen that loses its Supabase Realtime socket now recreates one authenticated membership-checked channel instead of remaining indefinitely on backed-off polling. Successful resubscription catches up committed command rows through the ordinary coordinator/PGlite acceptance path before the snapshot fail-safe.

**Budget delta (5):** `+4`. **Engagement delta (3):** `+1`.

**What changed:** worker-backed heartbeat configuration where supported; heartbeat and terminal-channel failure signals; one reconnect timer with 1/2/5/10-second bounded backoff; a 5-second `SUBSCRIBED` acknowledgement deadline; focus/visibility/online acceleration; stale-generation/disposal guards; command-log-first reconnect and unhealthy-poll catch-up; privacy-safe reconnect lifecycle phases. Development/Auth/hosted eligibility is required before the healer starts, and lost eligibility stops automatic retry. Poll fallback, Auth/RLS membership, financial command meaning, PGlite acceptance, and Production refusal remain intact.

**Verification:** the source diagnostic had `realtimeStatus: CLOSED`, zero Realtime receives, 27 poll fallbacks, and 4.5–5.0-second snapshot acceptance after poll scheduling, while the posting device reached cloud acknowledgement in 880 ms. On fully tested application commit `d477c27` over `86da91c`, the combined sync/Charter/Fund interaction gate passed 110 tests plus TypeScript and diff checks. Full application tests passed 1,549 / 3 skipped across 224 passed / 2 skipped files; AI-surface verification passed 41 required files. The exact equivalent TypeScript, Vite production build (396 modules), Hercules Pro UI, and no-`dist/_redirects` checks passed. Final `f3ca474` changes the application SHA only because the new base added Charter release documentation; the application diff is unchanged. Independent books/trust review passed; latency review passed with no code blocker after the release record correction; hygiene/privacy found no P0–P3 issue.

**Environment/data disclosure:** Development client code and synthetic local tests only. No hosted query was executed for this repair; no schema, migration, RLS, provider setting, secret, hosted row, Production-continuity flag, financial fact, or real household record changed. Google identity and Shared/Personal scope rules are unchanged. Offline writes remain durable in the existing outbox and no peer device becomes a host.

**Still required:** a separate release decision, then a fresh deployed signed-in two-device 100-sample run before claiming `<=500 ms p95`. Browser-level App lifecycle integration remains a non-blocking P2 proof gap; the pure lifecycle/policy units and reviewer-run focused suites pass.

## D-195 continuity Auth reconnect (2026-09-01)

**Status:** exact rebased application `a7bd6b8`, release-tooling correction `0520c1e`, and schedule-preservation repair `72bba7d` over `origin/main@8fb0a5f` are committed and fully verified on `codex/auth-reconnect-repair`. Clerk remains canonical D-194. Jonathan authorized push, merge, and Development deployment; the replacement push, merge/deploy, and live proof remain pending.

**Household outcome:** a Development household whose secure Supabase/Google session is missing or whose expired refresh is refused no longer appears to be checking the cloud every four seconds. The shared freshness row says **Google sign-in needed** and shows **Continue with Google**. The local accepted replica remains readable; no outbox item or household is removed. The user chooses a Google account, then the existing Auth membership and PGlite-gated continuity lifecycle resumes after OAuth return.

**Budget delta (5):** `+4` — honest, recoverable authenticated continuity for accepted Shared/Personal books without a new writer. **Engagement delta (3):** `+1` — one calm visible recovery action replaces an indefinite false fallback label.

**What changed:** a pure Development eligibility rule distinguishes Auth loss from transport choice, so polling-only and Realtime builds recover the same way; freshness has an `auth-required` mode and visible action; App observes same-window Supabase session save/clear plus cross-window storage changes, including the keyless event emitted by `localStorage.clear()`; the same-window event contains only the environment, never token or identity; OAuth starts only from the explicit button and forces account selection. Missing, refresh-refused, remove-item, and full-storage-clear sessions have App-shell regressions. Offline copy remains primary, and local-only, Auth-disabled, hosted-disabled, and Production states cannot offer the action.

**Verification:** the exact rebased release tree through `72bba7d` passed `pnpm check:windows`: fast lane **1,456 passed / 2 skipped** across 214 passed / 1 skipped files; serial books lane **145 passed / 1 skipped** across 18 passed / 1 skipped files; total **1,601 passed / 3 skipped**. AI-surface verification, deployment sanitizer, TypeScript, the **400-module** Vite production build, Hercules Pro UI, and no `dist/_redirects` all passed. The post-rebase Clerk/Auth/schedule interaction gate passed 38/38. `git diff --check` is clean apart from non-mutating Windows line-ending warnings. GitHub's first pushed candidate inherited a `demo-suite` timeout from `main` under four-worker contention; the guarded serial lane closed that host issue. The next exact remote run exposed that refreshing one member's schedule discarded another member's Personal shift envelope and aged status against wall clock. `mergeScheduleEnvelopes` now preserves untouched members and derives status from the authenticated observation time; the regression and formerly failing demo assertion pass. Rebase integration preserves Clerk D-194, immediate local sign-out, and stale-refresh cancellation while D-195 supersedes the earlier automatic refresh-refusal redirect: only the visible account-chooser action opens OAuth.

**Continuity and privacy boundary:** existing Google OAuth scopes are unchanged. Supabase Auth membership remains the automatic cloud authority; Shared and Personal filtering, RLS, registered-device checks, command-log recovery, one receiver coordinator, PGlite acceptance, durable outbox, and polling fail-safe are unchanged. No peer device must stay online. Offline writes remain local/outboxed. Development client and local synthetic tests only: no Supabase query, hosted mutation, schema/migration/RLS, secret, provider, Production flag/data, or real household entry changed.

**Still required:** complete the authorized replacement push, merge, and Development deployment. A deployed signed-in account chooser/reconnect smoke and fresh two-device 100-sample timing run remain necessary before any live OAuth or `<=500 ms p95` claim.

## Auth + membership RLS cutover (D-123)

**Status:** Migration **006 applied** on live shared project (Jonathan paste). Anon REST denial verified. Kitchen Auth door reaches Google OAuth. Docs record of apply: open PR #104. Invite chrome: branch `cursor/auth-invite-chrome-f375`.

**Budget delta (5):** `+4` — deny-by-default membership door is live for Development data on the shared project.

**Engagement delta (3):** `+1` (invite chrome in flight)

**Next owner:** Jonathan — signed-in Create/open/`HH-591c6905afd19707` sync smoke; then email/QR issue+redeem. Rollback only via explicit order and `docs/sql/009_rollback_006.sql`.

**Risk:** Release residual until signed-in smoke and invite redeem. Do not enable `VITE_PRODUCTION_CONTINUITY` casually.

**Environment / data disclosure:** Live applies: 002/004/005/007/008/006. Disposable Development data. No Production continuity client flag.

## Trust-foundation worksession (2026-08-24, local branch)

**Status:** Merged through [PR #71](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/71). Independent books/privacy/verifier review ran before merge. Auth/RLS remains a do-not-apply packet with synthetic tests. Conflict bundles export both sides without merging. `pnpm check` and `pnpm ai:verify` exist. No hosted schema was applied by that PR.

**Budget delta (5):** Money Confirm now goes through `acceptHouseholdWrite`: validate → balanced journal → PGlite ingest → persist → optional linked transport. Failures restore the previous household. If persist fails and books restore also fails, the outcome is `recovery-available` with both posting flags false. Linked writes compare revision; stale writes keep both sides. Claims and sit-down money block auto-merge. Hearth Pass overlay refuses a different shared journal. Unlinked/demo/empty/Pass households make zero household REST calls. WelcomeJoin applies a Pass without probing hosted books.

**Engagement delta (3):** none by design. Claude gets `src/claude/commandContract.ts` adapters/fixtures; OfficePhone/Hercules chrome were not edited.

**Still required:** atomic hosted CAS/journal authority and an explicit Jonathan migration decision. Do not apply `002_snapshot_cas.sql` or Auth/RLS, deploy, contact the household project, or delete hosted rows without that approval.

## Bianca Month-One rehearsal (D-183) (2026-08-28; mainline catch-up 2026-08-31)

**Status:** Development code release complete at `main@4af04130507291c8805102dcd1d4b73dd8cdfc0a`; Cloudflare Workers run [`33425439223`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33425439223) passed and the live no-store bundle contains the D-183 rehearsal markers. Bianca Month remains a mainline projection, not a trial fork: the current App integration test opens the current Add slideshow, and rehearsal progress materializes through the D-180 command-event path. No hosted schema/data, provider, secret, Production, scaling, shift-intake, or real household entry changed. This is code availability, not authenticated two-phone proof, daily-use approval, server authority, or launch approval.

**Household outcome:** Bianca and Jonathan rehearse four Toronto weeks using real Development Confirms, see `Tied` or `Needs attention` before exact proof, record where Bianca pauses or distrusts a number, acknowledge independently, and decide together whether Hearth is wanted next month.

**Budget delta (5):** `+5` — opening truth, exact journal/equation checkpoints, accepted receipt gates, correction by reversal, reconciliation, and close.

**Engagement delta (3):** `+3` — ten-minute weekly continuation, deterministic Hercules narration, ordinary playtest card, humane return/friction choices, and joint approval.

**Verification:** exact `main@4af0413` release preflight passed `pnpm check`: AI surface, **1,335 passed / 3 skipped / 0 failed** across 205 passed / 2 skipped files, TypeScript, Vite production, Hercules Pro UI, and no-`dist/_redirects`. Responsive local browser proof at 320/390/720/1100 px found no horizontal overflow or console warnings/errors and retained ordinary Hearth navigation and preview-only gating. Exact September 2026 golden assertions still cover every cent, journal/trial/equation, Fund projection, receipt identity, and financial/checkpoint hash. Independent UI release review passed; books/trust review conditionally passed for Development code availability while retaining the server-authority boundary below. Cloudflare run `33425439223` passed; live HTTP 200/no-store proof found the D-183 command and Start/Resume markers. Local and hosted-bundle evidence is never authenticated two-phone continuity evidence.

**Next owner:** Jonathan and Bianca — conduct the four-week Development rehearsal and separately authorize two-authenticated-phone continuity/joint-signoff proof when ready. Gemini review still requires Jonathan's explicit external-transmission approval. Jonathan remains the only owner who may approve any launch/Production step.

**Trust boundary:** current client replay rejects wrong-kind, Personal-scope, changed-participant, nonparticipant, and SHA-mismatched rehearsal materialization, including compacted events. The SHA is client-generated tamper detection, not server authority; a malicious authenticated-participant client remains unproven until Jonathan separately authorizes a server transition validator or signing boundary.

## Onboarding Slice 21 — deterministic first-plan proposal (D-221) (2026-09-04)

- Branch `onboarding/21-proposal` starts from clean merged Slice 20
  `origin/main@5941d50f395ccbc7ed13c8fdfd5463b0a906628b`.
- Local implementation commit: `bbb93f7`.
- `buildProposal` consumes the accepted two-member category set, current estimate
  submissions, valid Shared recurrence facts, and one carried `houseRunRate`
  reading. It emits category-id-ordered integer-cent rows and never writes money.
- Both guesses use a half-up mean, one uses that answer, and none begins at zero.
  Valid recurring obligations and eligible observed history are upward bounds only.
- The proposal carries both estimate submission ids/revisions plus the merged
  category list so `proposalDigest` can reproduce the accepted source without
  rereading a changed household.
- The current repo has no accepted capacity fact. `capacityCents` and
  `capacitySourceRevision` therefore remain `null`; the digest accepts a future
  pair only together and changes when either changes.
- Focused proof is 13/13 and the proposal plus adjacent estimate/category/
  recurrence/run-rate suite is 61/61. The High quick gate passed 44 fast plus 7
  serial tests; the production build passed 470 modules and Hercules Pro UI.
- Independent review found four boundary gaps, all repaired: direct digest
  formula validation, exact two-seat provenance, maximum-cent averaging, and
  collision-resistant approval identity. Re-review found no P0-P2 blocker and
  matched SHA-256 boundary and Unicode cases to Node crypto.
- No component or CSS changed, so there is no browser UX surface in this slice.
  Approval UI and atomic plan adoption belong to Slices 22–24.
- No push, PR, merge, deploy, hosted mutation, schema, secret, or Production work
  has been authorized.

## Onboarding Slice 23 — atomic budget-plan adoption (D-223) (2026-09-05)

- Branch `onboarding/23-adoption` starts from clean merged Slice 22
  `origin/main@85bafffc4d39668fc1aed1dd0c90a080cfb58ea4`; implementation commit
  `119c30b0d6776dce6b9796d9c596f3a864dcb7d1` is local only.
- `adoptFirstBudget` rebuilds the current month proposal and requires the same
  active actor plus both active seats' approvals for its exact digest before it
  changes any plan row.
- One cloned batch updates existing plan identities and creates every missing
  row. The accepted boundary rejects stale, partial, unrelated, malformed, or
  forged batches before persistence; the compiled journal stays deep-equal.
- `ONB-ADOPT-{month}-{digest}` is both adoption identity and confirmation id.
  Ambiguous/post-commit Retry returns the same receipt and revision.
- Proposal approvals bind the exact current plan snapshot with browser-safe
  SHA-256, so later edits cannot hide behind equal or skewed device clocks.
- Changed plan rows travel as bounded Shared command materialization with actor,
  proposal, approval, hash, complete-row validation, and a per-command compacted
  receipt hash covering identity, audit, revision, and accepted time.
- **Budget delta (5): `+4`.** The agreed first monthly plan now has an atomic,
  exactly-once acceptance and continuity boundary.
- **Engagement delta (3): `+1`.** Slice 24 can present one calm Adopt/Retry state;
  no rendered surface changes in this slice.
- Verification is complete: focused Slice 23 proof passed 14/14; the eight-file
  adjacent set passed 95/95; the final High quick gate passed TypeScript,
  AI-surface verification, diff hygiene, and 75/75 selected fast plus serial
  PGlite tests in 32.810 s; the production build passed at 473 modules plus
  Hercules Pro UI. Independent
  High-risk review reported no P0-P3 finding. The first broad adjacent run's one
  existing slow Personal-cloud-refusal timeout passed alone immediately and is
  retained as host-timing uncertainty. PowerShell was unavailable, so no
  Windows result is claimed. No component or CSS changed; Slice 24 owns browser
  UX proof. Mixed historical bundles that cannot prove an earlier audit state
  fail closed to full-snapshot recovery.
- No push, PR, merge, deploy, hosted mutation, schema, secret, provider, Personal
  payload, journal/transfer behavior, or Production work has been authorized.


## 2026-09-10 — Hercules conversational application implementation checkpoint (OPEN)

- Branch: `codex/hercules-conversational-app`; base/head `2db3da9fd3bff0c23beb78ceaf73295b19f2e34e`; uncommitted isolated worktree `.codex-work/hercules-conversational-app`.
- Risk: High. Budget delta (5): confirmed domain commands and duplicate/unknown receipt protection. Engagement delta (3): plain guided entry and visible compact composer.
- Delivered code: 80 named adapters, shared capability awareness, private review/claim/recovery lifecycle, explicit sequential checklist, native event model, actual bill payment evidence, appointment/claim paths and named companion/wardrobe/gallery paths. Only the app's review and Final Confirm can execute a prepared action.
- Whole-app scope is incomplete. Required next work and invariants are in [the implementation packet](briefs/HERCULES_CONVERSATIONAL_APP_IMPLEMENTATION.md); command and dedicated-surface gaps remain explicit in [coverage](HERCULES_CAPABILITY_COVERAGE.md).
- Local evidence: 18 synthetic theme/viewport checks passed; latest focused chat/recovery 30/30 and adapter/provider 25/25 passed. Additional native, Fund, companion, appointment and wardrobe continuity scenarios passed at the snapshots recorded in [the worksession](worksessions/2026-09-10-hercules-conversational-app.md).
- High gate is not complete: the first run failed one subsequently repaired assertion after passing TypeScript; the expanded run was stopped after more than 35 minutes in TypeScript and used a superseded source fingerprint. Both breached the five-minute target. Re-run the focused High gate on a stable final source tree before acceptance.
- Authenticated devices, live-model dialogue, Google event operations, full scope parity, physical keyboard/VoiceOver and real 200% browser zoom remain unverified. Chat actions are off by default with separate client/server gates. External calendar writing is not implemented or enabled. No release or hosted change occurred.
