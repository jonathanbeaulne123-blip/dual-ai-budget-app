# Hearth worksession — The Hercules habitats (two fictional years to walk around in)

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-14 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, Hercules, accessibility)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/hercules-habitats`
- **Baseline SHA:** `origin/main` after #479
- **Head SHA:** see the branch / `hercules-habitats.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (a new profile on the Demo Suite's synthetic provenance — a field that travels in the shared envelope; one id allocator moved to the runtime-aware helper; Development-only, fictional, every write through a named command)
- **Decision owner:** Jonathan (D-259)
- **Environment impact:** none in the repo — the habitats are created on the device (and, when the Demo Suite is opened signed in, as a dedicated synthetic cloud household, the way the investor showcase already is)

## Household outcome

Jonathan: "create a hercules habitat doing well and a hercules habitat doing bad household for bianca and i can use to interact with past and present data without having to create a bunch of stuff."

Two presses in the Development Demo Suite panel — **Habitat · doing well** and **Habitat · doing badly** — each create a fictional household with twelve months behind it and this month in front of it, so every room of the house has something to say: the Queen has a pulse and a Chapter, the cellar has a rail of bills and a water line, the loft has goals on its ledge, Hercules has a bill to nag about. One is a household keeping its ritual; the other is the same year gone sideways. Both are replayable from a seed and both pass the books verification.

## Budget delta (5)

+0. No money meaning changed. A habitat is `seedStressHousehold` (the Demo Suite's twelve months) with a story laid over it through the ordinary commands — `configureHouseholdFund`, `proposeHouseholdFundContribution` / `confirmHouseholdFundContribution`, `recordHouseholdFundReconciliation` (tied), `addRecurrence` / `updateRecurrence` with the Fund's `fundingDefault`, `postDueRecurrences`, `postEntry` (with Fund `funding` for the vet), `reversePostedMoney`, `addPotentialExpense`, `addGoal` / `fundGoal` / `purchaseGoal`, `foundHouseholdCharter` / `signHouseholdCharter`, `openChapter` / `recordRitualHeld` / `offerMove` / `respondToMove` / `closeChapter` / `recordWin`, `acknowledgeHouseholdPlan`, `recordReconciliation`, `closeBooksMonth`. Nothing bypasses a command; the trial balance and the accounting equation hold; the deterministic health check is clean in both. `SyntheticFixtureProvenance.profile` gains two values (`habitat-well`, `habitat-hard`) — same JSON shape, Development-only field, merged as-is by sync. `addPotentialExpense` allocates its id through `nextId` (the runtime-aware allocator every other command uses) instead of `crypto.randomUUID()`, so a showcase that plans an expense replays exactly; ids stay opaque and prefixed `PLAN-EX-`.

## Engagement delta (3)

+3. The two of them can open a lived-in house without keying in a year; and they can see the difference between doing well and doing badly in every room, not in a number.

## Scope

### In scope

- `src/core/habitat.ts` — `HabitatStory`, `HABITAT_NAMES`, `HABITAT_WORDS`, `shapeHabitat(household, { story, today, seed })` and its parts: `fundIn` (plans for four months; contributions — doing well: both, every month; doing badly: thin, then stopped), `sharedBills` (streaming, gym, transit pass added; six months of history on their days for rent, hydro, phone and the three; every bill handed to the Fund with `fundingDefault: full`; this month's rent posted on the 1st; hydro overdue in the hard story), `charterAndChapters` (the Charter; *See Our Shared Life* held and closed — established or still-forming; *Make Rent Boring* open — ritual kept four times and a Move accepted, or kept once and a Move declined), `fundOut` (a tied weekly reconciliation; or the emergency vet out of the Fund and a late, low reconciliation), `monthOnTheRail` (bills paid on their day and two planned expenses; or the streaming paid, hydro and the gym left, three crept-in subscriptions on the card, a double charge reversed, a car-repair estimate), `goalsStory` (two Build goals; the shore funded; doing well buys the pottery wheel and records a win), `closesStory` (three months closed and every shared account reconciled; or only the oldest).
- `src/core/demoSuite.ts` — `DemoSuiteProfile`; `generateDemoSuite` branches on the habitat profiles: the story instead of the investor rig (no canaries, no duplicate pair, no schedule evidence); `verifyDemoSuite` reports the investor-only checks (`shift-bible-links`, `engines`, `privacy-canaries`, `tool-run`; and `desk-seals` for the habitat doing badly, whose story is that nothing was sealed) as `skip`, not `fail`; readiness is "no fail".
- `src/core/types.ts` — the two profile values; `DemoCheck.status` gains `skip`.
- `src/App.tsx` — the guard carries a `profile`; `createOrReplayDemoSuite(seed, profile)`; two buttons under the Demo Suite panel (`data-testid="habitat-actions"`) with the two stories in words; the Confirm sheet names the habitat; the report counts gates without the skipped ones.
- `scripts/serve-queen-world-page-proof.mjs` — `?habitat=well|hard` (with `seed=` and `today=`) opens a habitat on the actual App page.
- Tests: `test/habitat.test.ts` (6), `test/habitat-layout.mjs` (12 records), the focus-map mapping appended last.
- Docs: D-259, the handoff entry, the roadmap line, this worksession, `docs/evidence/hercules-habitats/`.

### Out of scope

- A third story, a habitat for the personal ledger, or a habitat that ages with the calendar (a habitat is generated for the day it is pressed; press again for a fresh one).
- Any change to the investor showcase's own story or checks.

## Acceptance evidence

- [x] Both habitats are Development-only synthetic showcases with their own names, twelve months of transactions, and none of the investor rig (test).
- [x] Both keep a balanced trial balance and a clean deterministic health check (test).
- [x] Doing well: pulse `building`; the walk never dips under the buffer and never runs dry; rent, streaming and gym are shards on their days; no crack, no hammer; six months of rent on the ribbon; the Charter signed by both; one Chapter established and one open; a win; two months closed (test, browser).
- [x] Doing badly: pulse `needs-us`; the walk runs under the mark and dry; hydro and the gym overdue; a crack on the rail; five or more subscriptions; the vet funded from the Fund; a reversal; one Chapter still-forming and one open; fewer closed months than the other (test, browser).
- [x] Replay from the seed is byte-identical (fixture hash); the two stories hash differently; `verifyDemoSuite` on a habitat has no failing check (test).
- [x] Two buttons in the Demo Suite panel through the same guard, Confirm and persist path (test).
- [x] On the actual App page at 390×844 and 1100×800: every floor of each habitat, no page scroll, no page errors; the pulse, the rail, the water and the ledge as the story says (browser, `docs/evidence/hercules-habitats/`).

## Evidence log

- `node_modules/.bin/tsc --noEmit` — clean.
- `vitest run test/habitat.test.ts` — 6/6 (the generator is ~15 s a habitat; the file generates each story once).
- `pnpm test -- --risk=medium-high --focus=test/habitat.test.ts` → `quick-gate-passed`: 24 files / 353 tests (22 fast / 264, 2 serial / 89, including the full-App Bianca regression), typescript 48 s, 199 s of the 300 s budget, no breach; `uiProofRequired` satisfied by the browser run.
- `HEARTH_CHROMIUM=… node test/habitat-layout.mjs` — 12 records, 0 errors.
- Pre-existing on `main`, untouched: `test/demo-suite.test.ts` 2 of 9 red and `test/demo-suite-ui.test.ts` 2 of 8 red (they look for "Fresh showcase" and an older `Tab` union that `main` no longer has), `test/goal-fill-ui.test.ts` 6 of 7 red.

## Decisions and interpretations

- **A habitat is a Demo Suite profile, not a new mechanism.** The Demo Suite already creates a dedicated synthetic household, replays it from a seed, verifies it and keeps it out of Production; two more profiles ride all of that. Pressing a habitat from the ordinary Development household creates a new household; pressing it from a habitat replaces that habitat (the Demo Suite's own rule).
- **The story is told through commands only,** so the books stay balanced and the health check stays clean — the Fund's own guards shaped the story: a bill can only be handed to the Fund once the Fund covers it, a Fund-paid bill is posted by the custodian, a reconciliation ties only when the remainder is named. Doing badly is *thin contributions, then a vet bill out of the Fund*, not a hacked balance.
- **Doing badly reads `needs-us`, not `reset`.** `reset` needs plan drift the stress seed's plan lines do not produce; the top-up the Fund needs before its next obligation is the honest bad state, and the cellar's dry water says the rest.
- **Investor-only checks are skipped for a habitat, never failed.** A habitat has no canaries, no shift mail and no calculation matrix by design; `desk-seals` is skipped only for the habitat doing badly, whose story is that nothing was sealed.
- **Size bands on the habitat rail are flat** because rent (the month's largest) is twenty times a phone bill, so most jars fall in the smallest band; that is the banding rule working, not the habitat.

## Remaining uncertainty

- Generation takes ~15 s in Node and longer in a phone's browser; the Demo Suite panel already says it is "slower to generate".
- The sandbox's "Validating the local journal…" band tops every App-page still (PGlite here), as in every earlier proof.
- `test/demo-suite.test.ts` and `test/demo-suite-ui.test.ts` have pre-existing failures on `main` unrelated to this change; they would be the natural place for an independent read of the new profiles.
- Data/environment: fictional fixtures only; nothing hosted was written from here.

## Handoff

Local branch `claude/hercules-habitats` and `hercules-habitats.patch` only (one commit on `origin/main` after #479; independent of `cellar-frost.patch`, either order applies). Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan and Bianca to press both habitats in Development and walk the house; Codex for an independent read of the provenance-profile change and the `addPotentialExpense` id allocator.


## Addendum — the month's Plan in the investor showcase (2026-09-15)

CI on the pushed habitats branch (job 104213368729, `fb6a478`) ran `test/demo-suite.test.ts` because the habitats commit touched `src/core/demoSuite.ts`, and the `tool-run` check ("Hercules calculation matrix") reported all twelve `plan_*` reads unexercised: *Open a visible Plan version or your private draft for this month first.* Plan System V2 (#433) added the reads and their coverage entries but no generator ever created a Plan, so the matrix had been red on `main` since.

- `shapeDemoPlan` (investor branch only, before the prior-month close) builds Jonathan's private Household draft for the month from what the twelve months already hold — a `protect` obligation per shared expense recurrence (due dates clamped into the month), a `build` contribution to the shared Emergency buffer, a `prepare` Household Fund line at the month's Fund target, an `everyday` Groceries pool; the buffer and Groceries amounts vary with the seed — plus one private alternative ("a slower buffer"), proposes it to Shared and records his own acknowledgement. It stays `proposed` (1 of 2) on purpose: the second acknowledgement would consult `todayKey()` for active/scheduled, and the replay must not depend on the real clock.
- `verifyDemoSuite` runs `plan_scenario_compare` with the member's private preparation selected (`privatePlanPreparation`, draft and scenario ids) — the one Plan read that is defined against a private alternative; the other eleven calculate against the visible version.
- `accepts dedicated creation…` (the last red case, still red in CI after the Plan fix) expected two things the code refuses on purpose: that the legacy continuity transport (`transportRequested: true`) carries a showcase that completes onboarding v2 — `assertLegacyOnboardingCompatible` refuses it before staging, the 2026-09-08 onboarding-v2 boundary — and that an ordinary Development household with the same id is replaced in place — `commandRuntime.ts` grants the replacement exemption only to an existing fixture, and the App's `assertDemoReplacementAllowed` refuses "ordinary Development books" before Confirm. The case now asserts both refusals (nothing posted) and creates, replays, edits, replaces by fresh seed and migrates a legacy suite on the local commit path (`accepted-local`), which is where the Development App's Ledger Sync V2 path lands. No product code moved for the test.
- Result: `test/demo-suite.test.ts` 9/9 (was 7/9 on `main`); `test/habitat.test.ts` 6/6; `tsc` clean; `pnpm check` as CI runs it — see below. D-260 records both readings for Codex to confirm.
- `pnpm check` (Medium, as CI runs it) → `quick-gate-passed; time-budget-breached`: 17 files selected (14 fast / 3 serial), typescript 58 s, vitest-fast 97 s, vitest-serial 432 s in this sandbox (the Demo Suite's serial file alone generates six showcases), 597 s against the 300 s budget — the soft gate let the phase finish and every test passed; CI's own run of the same serial phase took 153 s, so the breach is this machine's, not the change's.
