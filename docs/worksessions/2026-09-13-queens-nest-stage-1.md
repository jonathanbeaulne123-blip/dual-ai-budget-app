# Hearth worksession — The Queen's Nest, Stage 1 (Home as one body)

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-13 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/queens-nest-stage-1`
- **Baseline SHA:** `a96c1ffb0905957d20c16491846ff0ca4b9b5e3c` (`origin/main`, #467)
- **Head SHA:** see the commit on the branch / `queens-nest-stage-1.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (a new opening composition for Household Home, opt-in; no money, schema, sync, hash or Hercules payload change)
- **Decision owner:** Jonathan (D-250)
- **Environment impact:** none — fictional fixtures only; the flag is off by default

## Household outcome

Jonathan and Bianca open Our Home and see the Queen: one ceramic body whose crown says who is here, whose vine and buds say what the Chapter and the goals are doing, whose face carries the pulse, whose hands hold the one Move, whose body shows fullness, evidence freshness and mended corrections, and whose hem gathers the nearest dated obligations. Nothing scrolls; the glance costs zero taps, the Move one. When the month is not covered she is depleted and grave about the month, never disappointed in whoever is holding the phone.

## Budget delta (5)

+0. No command, posting path, projection, schema, Auth/RLS, sync, financial hash or Hercules payload changed. `src/core/kittyNest.ts`, `src/core/householdFund.ts` and `src/core/fundPulse.ts` are untouched and consumed as they are; `allocateNestTotal`, the four categories, the tiers and `test/kitty-nest.test.ts` are unchanged. The gallery door from the belly, the doors and the buds is the same `KittyBankRoom` with the same reviewed command and Final Confirm boundary. Amounts remain reachable as confirmation (accessible names, small labels, the office aside) but never open the read.

## Engagement delta (3)

+2. Home becomes one object with six regions and no tiles; every state has a legible still that reads with motion off, in forced colours and with Easy read; the Move is done in one tap from the glance; obligations and goals are real 44px targets — fewer on the phone rather than smaller. Stage 2 (cellar/loft, the opening gesture, the ribbon, the shelf), Stage 3 and Stage 4 (the three theme expressions) are not here, so the Queen ships opt-in.

## Verified baseline

Facts: `origin/main@a96c1ff` cloned fresh in the cloud container; `pnpm install --frozen-lockfile` clean; `tsc --noEmit` clean before changes; `src/HouseholdHome.tsx` composed identity · pulse · `ChapterMoment` · rehearsal · coming up · `KittyNest` · presence · Win · doors; `householdHomeV2Enabled()` gates it inside `planSystemV2Enabled()`; `test/goal-fill-ui.test.ts` is red on `main` (6 of 7) and is untouched here; `test/statements.test.ts` passes on this base (7/7), so the earlier note that it was red no longer holds at `a96c1ff`.

Inferences: the App's chrome above Home (top bar + sync line) measures about 122px and the collapsed instruments summary about 54–78px; the Queen reserves those through a measured `--queen-top` and a `--queen-under` constant rather than reading App internals.

## Scope

### In scope

- `src/core/queenPresentation.ts` — pure selectors over existing projections: `queenStill`, `queenCrown`, `queenVine`, `queenBuds`, `queenHands`, `queenBody`/`queenFullness`/`queenSeams`, `queenTrace`, `queenHem`, `queenBloom`, `queenLimits`, and the two-doors-and-a-belly mapping `queenNestPlaceFor` / `queenNestDoors`.
- `src/queen/QueenHome.tsx` + `src/queen/queen-home.css` — the body: one SVG drawing, real `<button>` regions placed in the drawing's coordinates and following the pose's scale, buds row above, hem row below, the held Move, a visible caption, office asides at ≥720px.
- `src/HouseholdHome.tsx` — `composition?: "panels" | "queen"`, default from `queensNestEnabled()`; the panel Home is byte-for-byte the same path when the flag is off; the gallery is shared by both.
- `src/core/planFeature.ts` — `queensNestEnabled(value, homeValue, planValue)`: `VITE_QUEENS_NEST=1|true` inside Plan V2 + Household Home V2. `.env.example`, `src/vite-env.d.ts`.
- Tests: `test/queens-nest.test.ts` (mapping), `test/queens-nest-ui.test.ts` (jsdom), `test/queens-nest-layout.mjs` (browser evidence); `scripts/serve-household-home-proof.mjs` gains `composition=queen&state=…&chrome=1&easy=1`; `test/verification-focus-map.json`.
- Docs: D-250, this worksession, the handoff entry, `docs/evidence/queens-nest/`.

### Out of scope

- The cellar and loft rooms, the opening gesture, the ribbon and the shelf (Stage 2); the Hercules sentence (Stage 3); Classic / Taylor / Newfoundland expressions (Stage 4). The Queen's real form from the mandevilla photographs.
- Any change to `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, the categories, tiers or their tests.
- App-level wiring beyond the flag: the App still renders `HouseholdHome` exactly as before.

## Acceptance evidence

- [x] Every `FundPulseState` produces a distinct, non-empty still description (test).
- [x] `protect` + `prepare` → Protect door; `build` → Build door; `everyday` → belly; the four banks pass through untouched and sum to the King to the cent; `allocateNestTotal` conserves including debt (test).
- [x] No Move → `{ kind: "empty" }`, no `.queen-move`, no held object; the hands region says "empty" and opens Our Path (test, browser).
- [x] Every region is a `<button>` with a non-empty accessible name, keyboard reachable in reading order crown → vine → face → hands → body → belly → Protect → Build, with a visible ≥3px focus ring (test, browser).
- [x] Routing uses only today's destinations: crown → Together, vine/hands → Our Path, body → the Fund, face → `fundPulse().destination`, stones → Calendar, belly/doors/buds → the existing gallery with focus returning to the region (test, browser).
- [x] Home does not scroll at 320×700, 390×844, 720×900, 1100×800 with chrome stand-ins; 0 horizontal overflow everywhere; 320×568 scrolls 44px at the 300px floor (browser).
- [x] Reduced motion: no animation or transition; the still is complete (browser). Forced-colours rules authored; not captured.
- [x] Easy read enlarges words (12.5 → 16px) and targets (Move 58px) without scrolling (browser).
- [x] 0 serious/critical axe hits across 55 captures; 0 page errors.

## Plan

- [x] Read canon, current Home, pulse, chapters, nest, obligations, names; read the grammar artifact.
- [x] Pure selectors; flag; component; CSS; HouseholdHome branch.
- [x] Mapping tests; jsdom tests; browser evidence with pulse seeds.
- [x] Quick gate; build; docs; patch.

## Evidence log

All commands from the branch root in the cloud container, Node 22.22.2, pnpm 10.14.0.

- `node_modules/.bin/tsc --noEmit` — clean.
- `vitest run test/queens-nest.test.ts test/queens-nest-ui.test.ts` — 25/25.
- `vitest run test/kitty-nest.test.ts test/kitty-nest-ui.test.ts test/home-feedback-ui.test.ts test/vision-v2-home-ui.test.ts test/vision-v2-chapters.test.ts test/vision-v2-slice-1.test.ts test/queens-nest.test.ts test/queens-nest-ui.test.ts` — 8 files, 85/85 (jsdom prints its usual `HTMLCanvasElement.getContext` not-implemented notices from `KittyFlat`).
- `pnpm check -- --risk=medium-high --focus=test/queens-nest-ui.test.ts --focus-reason="Queen composition regions, routing, one-tap Move, gallery door and flag fallback"` — quick-gate-passed, 89.7s of the 300s budget, no breach; phases diff-check, ai-surface, typescript, test-discovery, vitest-fast (8 files, 89 tests), vitest-serial (`proof-matrix` 7 tests); `uiProofRequired: true`, satisfied by the browser run below.
- `vite build` — built in 19.3s (the chunk-size warning is pre-existing). `pnpm build` in full (including the workspace Worker type-check) was not run.
- `vitest run test/statements.test.ts test/goal-fill-ui.test.ts` — statements 7/7 green; goal-fill-ui 6 failed / 1 passed exactly as on `main`, untouched.
- `HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome HEARTH_ARTIFACTS_DIR=… node test/queens-nest-layout.mjs` — `59 captures, 0 serious/critical axe rule hits, 0 page errors, 11 notes` (the eleven notes are the 320×568 floor). Measured `.queen-home` heights: 300 (320×568), 374 (320×700), 518 (390×844), 574 (720×900), 474 (1100×800). Keyboard walk: bud, bud, crown, vine, face, hands, body, belly, Protect, Build, Move, stone. One-tap walk: Done → I acknowledge this → Done → empty hands. Curated PNGs and `records.json` in `docs/evidence/queens-nest/`.

The Playwright package in `node_modules` expects a newer Chromium than `/opt/pw-browsers` holds; the existing `HEARTH_CHROMIUM` override in the proof scripts was used, no browser was installed.

## Decisions

- D-250 (opt-in flag; presentation-only mapping of four categories to two doors and a belly; negative stills aimed at the month).
- The flag defaults **off**: Stage 1 is the body only, without rooms or theme expressions, so the approved Home stays the default until Jonathan chooses otherwise. `VITE_QUEENS_NEST=1` turns it on inside the Plan V2 family.
- Two body regions rather than one: the upper body ("what is held") opens the Fund; the belly ("What Now") opens the Everyday bank. Protect and Build are quiet labelled doors at her sides that open the existing gallery at `plan:protect` and `plan:build`; Prepare is reachable one step deeper in that gallery until Stage 2's cellar holds both.
- The Move is held out as one control: on the phone a pill under the figure, in the office a pill over her hands. The verb is Done, I acknowledge this, Create our Charter / Set up the Fund (the shared-life setup Move), or Waiting on both of us (not actionable; opens Our Path). "Not now" is not on the glance; Our Path keeps it.
- A recent Win is a gold bloom in the buds row whose one tap keeps it as a Memory; "Let it fade" is not on the glance in this composition.
- The Development-only rehearsal entry is not rendered in the Queen composition; More keeps it.
- Reading order is top to bottom in the DOM with explicit z-index for stacking, so screen readers meet the crown first.

## Remaining uncertainty

- The `--queen-under` reservation (100px) stands in for the App's collapsed instruments summary and its own bottom padding; the real App page was not rendered in a browser here. If that row changes height the composition either leaves a gap or scrolls by the difference.
- 320×568 (an old iPhone SE) scrolls 44px because the composition refuses to go under 300px.
- Fullness is `amountCents / targetCents` quantized to ten steps exactly as `NestPortrait` already does; with no targets it reads "holding". That is a display ratio over two existing numbers, not a new money figure, but it is arithmetic in the selector.
- `queenTrace` reads partner-created transactions and goal contributions within the last two civil days by ISO `createdAt`; a touch late in the Toronto evening can read as the next UTC day.
- The gaze offsets, brow and mouth are drawn by hand in the artifact's geometry; the real form from the mandevilla photographs will replace them.
- Forced-colours rules are authored but were not captured; VoiceOver, physical devices and a real Development snapshot were not exercised.

## Handoff

Local branch `claude/queens-nest-stage-1` and `queens-nest-stage-1.patch` only. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to decide whether Stage 1 lands opt-in as is; Codex for an independent read of `queenPresentation.ts` (no money arithmetic beyond the fullness ratio, no new destination) and of the App-chrome height assumption; then Stage 2.
