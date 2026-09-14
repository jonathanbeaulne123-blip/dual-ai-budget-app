# Hearth worksession — The Queen's world page (Our Home as one fixed world)

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-14 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/queen-full-world`
- **Baseline SHA:** `dfc2a28` (`origin/main`, #473 — the Queen's creation and history)
- **Head SHA:** see the commit on the branch / `queen-full-world.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (App-level layout and chrome gating on one route behind `VITE_QUEENS_NEST`; presentation only; trust surfaces rehomed, none removed)
- **Decision owner:** Jonathan (D-255)
- **Environment impact:** none — fictional fixtures only

## Household outcome

Opening Our Home with the Queen's Nest on is opening a world: the two-space tabs, her field with the quiet line and her doors, the five-slot nav — nothing else, at every width, with no page scroll. On the live page she had been squeezed into the bottom quarter under 565 px of chrome; on the actual App page she is now three quarters of the viewport and her figure is 40 % of it. Nothing that said something true went away: "Needs attention" now sits on her Status door and opens its explanation and recovery in one tap; the household, the date, the revision, the environment switch, the household switcher and the office door are behind the same door.

## Budget delta (5)

+0. No command, posting path, projection, schema, Auth/RLS, sync, financial hash or Hercules payload changed. `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts` and `test/kitty-nest.test.ts` untouched; conservation still holds (`kitty-nest` 20/20 in the gate). Every trust surface removed from Home is rehomed and one tap away.

## Engagement delta (3)

+2. The world is the page on every width; the glance is her, not a stack of cards above her.

## Verified baseline

Facts: `origin/main@dfc2a28` (#473); `tsc --noEmit` clean; `test/goal-fill-ui.test.ts` red on `main` (6 of 7), untouched. The actual App page under `VITE_QUEENS_NEST=1` (new harness `scripts/serve-queen-world-page-proof.mjs`, Taylor's Scrapbook, 3D live), **before** this change: 320×568 → composition 38.7 %, scroll +677 px; 320×700 → 31.4 %, +545 px; 390×844 → 26.1 %, canvas top y=603, +290 px; 720×900 → 24.4 %, +144 px; 1100×800 → 27.5 %, +256 px — with the top bar, sync line, switcher, scene heading, atmosphere button, office disclosure, scene charm and (below 720) the Fund ledge, (at ≥720) the wax seals all on Home. This matches Jonathan's live measurement (29 %, y=565, ~200 px at 754 px) and shows the stand-in harness (`serve-household-home-proof.mjs?chrome=1`) had hidden it.

## Scope

### In scope

- `src/App.tsx` — `queenWorldHome` (Home · household · dashboard · `householdHomeV2Enabled()` · `queensNestEnabled()`); `data-world-home` on `.app`; the top bar, `SyncFreshnessStatus`, the household switcher, `ThemeSceneHeading`, `WorldCharm` and the Fund ledge not rendered on the world; the `HomeInstruments` block (office, Till door, seals, boards) rendered at the Status Centre for the household space while the world is on; a `QueenShell` built from the same values the removed surfaces read; `moreFocusTarget: "office"`; the due-reminders review hidden behind its arrival link on the world (`dueSheetOpen`), inline everywhere else; `data-app-page` on the page wrapper.
- `src/queen/QueenHome.tsx` — `QueenShell` type; the Status door wears `data-attention` and a visible badge; a "This device" section in the Status panel (attention + action, who, when, books/revision/updated, environment + switch, the switcher, Sync help, the office door); runtime measurement of the nav under her (`--queen-below`, `data-frame-nav`, `data-frame-tabs`) with resize, visual-viewport, `ResizeObserver` and shell `MutationObserver` re-measurement.
- `src/queen/queen-home.css` — the world-home frame (`.app[data-world-home]` fixed, inset 0, overflow hidden; the tabs with the safe-area top inset; compact transient banners), the badge, the shell section, the due sheet over the world.
- `src/HouseholdHome.tsx` — forwards `shell`.
- `scripts/serve-queen-world-page-proof.mjs` — the ACTUAL App booted with a fictional local Development household (accepted-books receipt seeded so the PGlite gate settles; `replicas=1` for the switcher; `queen=0` for the panel fallback).
- `test/queen-world-page-layout.mjs` — browser evidence on the actual page: five viewports × three themes × (3D, no-WebGL); chrome inventory; no scroll; ≥ 55 % composition and ≈ 40 % figure; the two tabs and five nav slots; field bottom above the nav; the Status door one tap with the shell readings; keyboard tabs → doors → Move → nav with visible focus; every other destination and the personal Home keep the shell; the office reachable from the Status door; axe. `HEARTH_PROOF_MODE=before` records without asserting.
- `test/queens-nest-ui.test.ts` (+3): no shell → field unchanged; attention on the door, one tap to explanation, action, sync help, office, switcher, environment; quiet door when nothing needs attention.
- `test/verification-focus-map.json`, the stand-in harness header note, D-255, the roadmap line, this worksession, the handoff, `docs/evidence/queen-world-page/`.

### Out of scope

- The three theme expressions as artwork, the mandevilla form, her model; `queenWorld.ts`, `queenSculpture.ts`, `queenAuthoring.ts`, `queenCharmSurface.ts` untouched.
- The Hercules presence dock (D-044) — still on the world; flagged, not removed.
- The reference app's palette.

## Acceptance evidence

- [x] Home does not scroll at 320×568, 320×700, 390×844, 720×900, 1100×800 (`scrollHeight <= clientHeight`) on the actual App page, three themes, 3D and no-WebGL (browser, 30 records).
- [x] None of top bar, sync line, switcher, scene heading, atmosphere button, office disclosure, wax seals, story tiles, scene charm, Fund ledge on Home (browser).
- [x] The Fund, Our Path, Together and the personal Home keep the top bar and sync line and are not fixed (browser).
- [x] Composition 65.1 % (320×568), 71.7 % (320×700), 76.5 % (390×844), 78 % (720×900), 75.3 % (1100×800); her figure 40 % at every width (browser).
- [x] The Status door wears "Needs attention" and opens its explanation and recovery in one tap (jsdom, with a warning shell); the door is one tap to the shell readings on the actual page (browser).
- [x] Two tabs and five nav slots present, labelled, keyboard reachable; order tabs → Together door → her → the Move → Status door → nav, visible focus, every stop on screen (browser).
- [x] All three themes render the world (browser). Conservation: `kitty-nest` untouched and green in the gate.
- [x] The office (with the Till door) reachable from the Status door at the Status Centre (browser); the personal Home still renders it inline.

## Evidence log

All commands from the branch root in the cloud container, Node 22.22.2, pnpm 10.14.0, `HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

- `npx tsc --noEmit -p tsconfig.json` — clean.
- `HEARTH_PROOF_MODE=before HEARTH_PROOF_THEMES=taylor node test/queen-world-page-layout.mjs` — 10 records (before), `docs/evidence/queen-world-page/before/`.
- `node test/queen-world-page-layout.mjs` — 50 records, 0 errors, 0 serious/critical axe, `docs/evidence/queen-world-page/after/`.
- `vitest run test/queens-nest-ui.test.ts` — 23/23.
- `vitest run test/app-startup-p1.test.ts test/month-rehearsal-mainline.test.ts --maxWorkers=1 --testTimeout=30000` — 83/83 (the full-App Bianca regression and the command-sync contract, as AGENTS.md requires for App route changes).
- `pnpm test -- --risk=medium-high --focus=test/queens-nest-ui.test.ts --focus-reason=…` — `quick-gate-passed`: diff-check, ai-surface, typescript 52.8 s, test-discovery, vitest-fast 11 files / 126 tests, vitest-serial 6 files / 117 tests; 180.3 s of 300 s, no breach.
- `vitest run test/goal-fill-ui.test.ts` — 6 failed / 1 passed exactly as on `main`, untouched.

## Decisions and interpretations

- The frame is the App surface (`.app[data-world-home]`), not the Queen: fixed, inset 0, overflow hidden, so a transient banner above her (books validation, a sync banner, "Changes needing review") pushes her down inside the frame and can never scroll the page. Her height formula is unchanged; both its terms are now measured.
- "Nothing deleted without a home": the sync line's `onOpenDetails` route (Status Centre, sync help) and its action (`reconnect-auth` / retry) are the same functions, passed through the shell. The environment pill's switch is the same `setGuard`. The switcher is the same `HouseholdEntryCard` list. The office block is the same JSX rendered at the Status Centre.
- The due-reminders review (`DuePreviewSheet`) was inline below Home; on the world it would have been clipped. It keeps its arrival link at the top of the world and rises as a fixed sheet only when the link is taken; on every other page it is unchanged.
- The tabs keep `spaceLabel` — "Our Home" / "My Money" in the fixture, "My Personal Ledger" on Jonathan's household — untouched.

## Remaining uncertainty

- **The Hercules presence dock** (the cat and its sentence, D-044) still sits at the bottom right of the world. It is the product face and its nudge can be money-adjacent ("Phones needs a payment update"), so it was not removed. It is not in the screenshot inventory — Jonathan decides.
- A "Needs attention" driven by a live sync state was exercised in jsdom with a warning shell and on the actual page through the books gate; a hosted `auth-required` state was not driven in a browser here (no hosted ledger in the harness).
- iOS safe-area insets are read through `env()` on the nav and re-measured; not verified on a device.
- SwiftShader, not a phone.

## Handoff

Local branch `claude/queen-full-world` and `queen-full-world.patch` only. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan for the Hercules-dock decision and a phone measurement of the live page after merge; Codex for an independent read of the App gating (nothing renders behind `queenWorldHome` that should not).
