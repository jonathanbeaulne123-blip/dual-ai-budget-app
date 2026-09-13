# Hearth worksession — The Still Queen (Household Home overhaul)

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-13 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/still-queen`
- **Baseline SHA:** `4b918b0db31dacaebe2001be37591032d409ccca` (`origin/main`, #469)
- **Head SHA:** see the commit on the branch / `queens-still-home.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (a rebuilt opening composition for Household Home behind `VITE_QUEENS_NEST`; no money, schema, sync, hash or Hercules payload change)
- **Decision owner:** Jonathan (D-251)
- **Environment impact:** none — fictional fixtures only

## Household outcome

Jonathan and Bianca open Our Home and see the Queen alone in a field of nothing: her, one quiet line beneath her, and — only when a real action waits — the Move at her hands. Nothing else. Her body says how the month is (posture, fullness, eyes, glaze, crown, seams, vine, buds, the stones at her feet) and carries no text. Tapping the empty field breathes two doors in — Together and Status — and they fade again. Tapping her opens her into her three banks, Protect · What Now · Build, each with a button above it that peeks; the same door again goes all the way in to the cellar or the loft, where she is gone and the stair is the way back. Healthy is quiet, enforced by composition rather than by copy.

## Budget delta (5)

+0. No command, posting path, projection, schema, Auth/RLS, sync, financial hash or Hercules payload changed. `src/core/kittyNest.ts`, `src/core/householdFund.ts` and `src/core/fundPulse.ts` are untouched and consumed as they are; `allocateNestTotal`, the four categories, the tiers and `test/kitty-nest.test.ts` are unchanged. Money is touched only through the existing `KittyBankRoom` gallery (reviewed command and Final Confirm boundary), reached from the peeks and the rooms. Amounts appear only as confirmation: inside accessible names and inside the peeks, never on her or on the stage at rest.

## Engagement delta (3)

+2. Home is empty and still; the glance costs zero taps and the one Move is visible and one act away; every state has a legible still that reads with motion off, in forced colours and with easy read; the doors are real buttons with names, a 3px ring and a findable resting state whenever motion is reduced. The three theme expressions, the mandevilla form and the Hercules sentence are not here.

## Verified baseline

Facts: `origin/main@4b918b0` cloned fresh in the cloud container; `pnpm install --frozen-lockfile` clean; `tsc --noEmit` clean before changes; Stage 1 (`src/queen/QueenHome.tsx`, `queen-home.css`, `queenPresentation.ts`, `test/queens-nest*.ts`, `test/queens-nest-layout.mjs`) present behind `queensNestEnabled()`; `test/goal-fill-ui.test.ts` red on `main` (6 of 7) and `test/plan-worlds.test.ts` red on `main` (1 of 2, "preserves the Kitty Bank room contribution review through theme changes"), both verified with the working tree stashed and both untouched here.

Inferences: the App's chrome above Home (top bar + sync line) measures about 122px and the collapsed instruments summary about 54–78px in the proof; the Queen reserves those through a measured `--queen-top` and the Stage 1 `--queen-under` constant rather than reading App internals.

## Scope

### In scope

- `src/core/queenPresentation.ts` — Stage 1 selectors kept; new pure selectors: `queenBanks` (three banks over the four categories, banks passed through, a quantized drawing share), `queenFeet` (count and nearness only), `queenLine` (Chapter · pulse word, "not yet covered" when grave), `queenRibbon` / `queenRibbons` (one jar per month for a recurring expense; the outlier is the posted month above 1.35× the median of at least three posted beats; amounts never leave the function), `queenShelf` (Build's open goals open-mouthed, bills lidded, contributions as marks).
- `src/queen/QueenHome.tsx` (rebuilt), `src/queen/QueenFigure.tsx` (her drawing and the child vessels), `src/queen/QueenCellar.tsx` (the ribbon), `src/queen/QueenLoft.tsx` (the shelf), `src/queen/queen-home.css` (rebuilt; theme-neutral tokens).
- `scripts/serve-household-home-proof.mjs` — fictional ribbon history, a lidded Build bill, an open Build goal, `reduced=1`.
- Tests: `test/queens-nest.test.ts` (mapping, 21), `test/queens-nest-ui.test.ts` (jsdom, 13), `test/queens-nest-layout.mjs` (browser evidence, 57 records).
- Docs: D-251, roadmap line, this worksession, the handoff entry, `docs/evidence/still-queen/`.

### Out of scope

- The three theme expressions (Classic Hearth, Taylor's Scrapbook, Newfoundland); the Queen's real form from the mandevilla photographs; the Hercules sentence.
- Any change to `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, the categories, tiers or their tests; any App-level wiring beyond the existing flag.
- `HouseholdHome.tsx`, `planFeature.ts`, `.env.example`, `vite-env.d.ts` are unchanged from Stage 1: the panel composition remains the fallback when `VITE_QUEENS_NEST` is off.

## Acceptance evidence

- [x] Every `FundPulseState` produces a distinct, non-empty still description; the quiet line has a distinct word per state plus a grave word (test).
- [x] `protect` + `prepare` → Protect, `everyday` → What Now (belly), `build` → Build; the four banks pass through untouched and sum to the King to the cent; `allocateNestTotal` conserves including debt (test).
- [x] No Move → empty hands: no `.queen-move`, `data-hands="empty"`, the still says her hands are empty; the rest inventory is three controls (test, browser).
- [x] Every door and bank button is a `<button>` with a non-empty accessible name, keyboard reachable: Together → her → Move → Status at rest; Protect → What now → her → Move → Build expanded; 3px visible ring (test, browser).
- [x] The page does not scroll at 320×568, 320×700, 390×844, 720×900, 1100×800 with chrome stand-ins, at rest, expanded, with a peek open and in both rooms; 0 horizontal overflow (browser).
- [x] Reduced motion: no animation or transition; doors rest findable at 0.6 with labels; the still is complete (browser). Motion: doors rest ≤ 0.1, she breathes 6s, the doors breathe in on a field tap and fade (browser).
- [x] Forced colours: doors and labels fully present with a border (browser, emulated).
- [x] Easy read enlarges the line and makes the doors findable without scrolling (browser).
- [x] 0 serious/critical axe hits across 35 rest captures; 0 page errors.

## Plan

- [x] Read canon, Stage 1, the pulse, chapters, nest, obligations, names; read the two grammar studies.
- [x] Pure selectors; figure; rooms; the home; CSS.
- [x] Mapping tests; jsdom tests; browser evidence.
- [x] Quick gate; build; docs; patch.

## Evidence log

All commands from the branch root in the cloud container, Node 22.22.2, pnpm 10.14.0.

- `node_modules/.bin/tsc --noEmit` — clean.
- `vitest run test/queens-nest.test.ts test/queens-nest-ui.test.ts` — 34/34.
- `vitest run test/kitty-nest.test.ts test/kitty-nest-ui.test.ts test/home-feedback-ui.test.ts test/vision-v2-home-ui.test.ts test/vision-v2-chapters.test.ts test/vision-v2-slice-1.test.ts test/queens-nest.test.ts test/queens-nest-ui.test.ts` — 8 files, 94/94.
- First `pnpm check` (Medium-High focus) — every phase passed except vitest-fast, where `test/plan-worlds.test.ts` failed exactly as it does on `main@4b918b0` (verified with this work stashed). GitHub's `pnpm check` on the pushed branch reproduced it. A second, stale-on-main failure surfaced in the serial lane once the gate selected the D-183 mainline suites: `test/five-boards-entry-app.test.ts` "Plan uses hero, Categories, sit-down and Kitty Banks DOM order" (both widths), also red on `origin/main`.
- Second commit repairs both tests without touching product code: `plan-worlds` opened the room through an "Enter Kitty Banks" door that #466 replaced with the nest (now: Everyday bank → the goal's own bank → Use money; the guard-dialog-through-three-themes assertions are unchanged); `five-boards-entry-app` asserted the legacy five-boards Plan, which since D-248 renders only with `VITE_PLAN_SYSTEM_V2=0`, and looked for the same retired door (now: the flag is stubbed off for those two cases, which `afterEach` already unstubs, and the fourth board is asserted to be the nest with the King's bank first).
- `pnpm check` (Medium, no focus, as CI runs it) after the repair — `quick-gate-passed`: diff-check, ai-surface, typescript (57.1s), test-discovery, vitest-fast 9 files / 99 tests, vitest-serial 6 files / 117 tests; 187.8s of the 300s budget, no breach; `uiProofRequired: true`, satisfied by the browser run below.
- `vite build` — built in 18.8s (the chunk-size warning is pre-existing). `pnpm build` in full (including the workspace Worker type-check) was not run.
- `vitest run test/goal-fill-ui.test.ts test/statements.test.ts` — goal-fill-ui 6 failed / 1 passed exactly as on `main`; statements 7/7.
- `HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/queens-nest-layout.mjs` — `57 records, 0 serious/critical axe rule hits, 0 page errors, 1 notes` (the note: at 320×568 with chrome the sheet covers all but the top of her crown). Measured `.queen-home` heights with chrome: 242 (320×568), 374 (320×700), 518 (390×844), 574 (720×900), 474 (1100×800); her height at rest 121 / 137 / 321 / 287 / 294. Curated PNGs and `records.json` in `docs/evidence/still-queen/`.

The Playwright package in `node_modules` expects a newer Chromium than `/opt/pw-browsers` holds; the existing `HEARTH_CHROMIUM` override was used, no browser was installed.

## Decisions and interpretations

- D-251. The Move at her hands opens the Together peek where its act (Done / I acknowledge this / Create our Charter / Set up the Fund / Waiting on both of us) sits beside "Not yet" — one visible step, matching the grammar study, rather than Stage 1's one-tap act on the glance.
- The glass panel slides in from the edge *opposite* its door (Protect, Together and What now from the right; Build and Status from the left) so the door you came through stays uncovered and is the same object that takes you deeper. The brief said "from the screen edge" without naming which.
- On the phone the bank buttons sit under the sheet once it is open, so the way deeper is the pull past 80px or the door repeated at the foot of the sheet (a real button, so the pull is never the only way). On the office the bank button itself, clicked again, goes in.
- Leaving a room returns to the expanded state and focuses the bank button you came through: exit and origin are one object.
- The ribbon shows one recurring household expense at a time (default: the one that broke its beat, else the most posted) with a real-button pick strip when there are several. Month labels and "usual" live in the room; the outlier carries no number.
- "A decomposed goal opens into its parts": goals have no parts in the data model, so an open-mouthed goal opens to its contributions as marks and to the existing gallery at that goal; a lidded bill leans (a pose) and refuses (a line, and a small extra lean under motion).
- The `sr-only` still describes every channel in words (pose, glaze, fullness, crown, seams, vine, buds, feet, hands); bank buttons carry their amounts as confirmation.

## Remaining uncertainty

- The `--queen-under` reservation (100px) still stands in for the App's collapsed instruments summary; the real App page was not rendered in a browser here. If that row changes height the composition leaves a gap or scrolls by the difference.
- `queenBanks().share` and `queenFullness()` are display ratios over two existing numbers (bank over King; King over its targets), quantized to ten steps — arithmetic in a selector, disclosed. `queenRibbon()` compares posted monthly amounts to their median to mark the outlier; amounts never leave the function.
- At 320×568 inside the App the field is 242px tall: she is 121px and a peek sheet covers all but her crown.
- The panel scrolls internally when a peek is taller than its frame (the page never does).
- Forced colours were emulated, not captured on a device; VoiceOver, physical devices and a real Development snapshot were not exercised; the theme expressions are not authored, so the tokens were checked only in Classic.
- The artwork remains the grammar study's stand-in geometry, not the mandevilla form.

## Handoff

Local branch `claude/still-queen` and `queens-still-home.patch` only. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to decide whether the Still Queen replaces Stage 1 behind the flag; Codex for an independent read of the new selectors (no money arithmetic beyond the disclosed display ratios, no new destination) and of the chrome-height assumption; then the theme expressions.
