# Hearth worksession — Journey game mode (D-285)

- **Status:** OPEN (local branch; integration with D-284 pending)
- **Opened:** 2026-09-16 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (game-mode engineer; the simple view `src/path/mini/JourneyMini.tsx` is built in parallel by another engineer)
- **Repository:** dual-ai-budget-app
- **Branch:** `claude/journey-game` (from `claude/journey-simple-view` `5f03336d`: main `d7b0151b` + D-283 + `src/path/journeyFocus.ts`)
- **Baseline SHA:** `5f03336d`
- **Head SHA:** see `git log` on the branch (local, not pushed)
- **PR or issue:** none yet
- **Risk:** Medium (UI structure of the Our Path page; no money meaning)
- **Decision owner:** Jonathan
- **Environment impact:** none (local only)

## Household outcome

Our Path opens on the simple view (the minigame). "Open the world" turns the island into a full-screen game with nothing of the app around it; Minimize, Escape or the back gesture return to the app, and both views always show the same place and time.

## Budget delta (5)

+0. Presentation only: no money meaning, schema, sync or Hercules payload change; nothing posts. The page no longer builds the WebGL world on every visit, which saves battery and memory on phones.

## Engagement delta (3)

+2. Entering the island is a moment (iris, location banner, HUD), and the two views stay in step.

## Scope

### In scope

- `src/path/OurPathWorld.tsx`: the simple-view slot and `renderMini` contract, the page bar, lazy world, game mode (full screen, inert and hidden app, history entry, Escape order, focus management, iris), the HUD and settings drawer, and the shared focus sync.
- `src/path/our-path-world.css`: the slot, placeholder, page bar, game stage and HUD for the three themes, phones and desktop, reduced motion and forced colours.
- `src/path/world/pathWorld3d.ts`: additive `focusMonth(index, level)` and `monthFocusIndex`.
- Tests: `test/journey-game-mode-ui.test.ts` (new); `test/our-path-world-ui.test.ts`, `test/journey-fullscreen-ui.test.ts` and `test/path-eras-ui.test.ts` updated where the structure intentionally changed.
- Proof harness: `?chrome=1` (the App's real header and nav classes around the page), `?mini=stub` (a stand-in simple view on the shared focus), `?ambient=off`; `scripts/capture-journey-game.mjs`.

### Out of scope

- `src/path/mini/*` (D-284) and wiring it in `App.tsx` (the integrator).

## The `renderMini` contract

`renderMini?: (args: JourneyMiniSlotArgs) => ReactNode`, where `args` is `{ household, memberId, today, focus: JourneyFocusApi, onOpenWorld, compact, theme, quality, worldOpen }`. It is called for the page copy (`compact: false`, in `[data-slot="journey-mini"]`) and, while the world is open, for the corner minimap (`compact: true`, in `[data-slot="journey-mini-compact"]`, `onOpenWorld` is a no-op). The page copy stays mounted behind the open world (inert, then hidden) with `worldOpen: true`, so it can pause its own rendering. Integrator: `renderMini={(args) => <JourneyMini {...args} />}`. The slot for the compact copy is sized by `--journey-mini-compact-w` (default 116px on phones, 164px at 720–1099, clamp(170px, 19vw, 250px) above) at a 4:3 ratio.

## Acceptance evidence

- [x] tsc green: `npx tsc --noEmit -p .`
- [x] `npx vitest run test/journey-game-mode-ui.test.ts test/journey-fullscreen-ui.test.ts test/our-path-world-ui.test.ts test/path-eras-ui.test.ts test/path-era-islands.test.ts test/journey-focus.test.ts test/path-minimap.test.ts test/path-eras.test.ts test/our-path-world.test.ts test/verification-policy.test.ts`: all pass.
- [x] Browser evidence: `node scripts/capture-journey-game.mjs` → `docs/evidence/journey-simple-view/game/` (`<story>-<theme>-<width>-<step>.png` for the `well` habitat with the fictional journey and the Our Story habitat `habitat-story`, 320/390/720/1100 × Classic/Taylor/Newfoundland × page, entering, game, settings drawer, minimized) with `report.json` (no page or console errors, no horizontal overflow, nav and header hidden in game mode, page inert, no HUD target under 44px, no HUD overlaps, focus on Minimize after entering and back on Open the world after minimizing, no amounts in the HUD).

## Evidence log

- Headless Chromium (`/opt/pw-browsers/chromium-1194`, SwiftShader). Software rendering is slow and uneven, so the script freezes the iris part-way for the "entering" shot, waits for the camera to land Up close before the game shot, and runs with `ambient=off`.
- The first captures found: world level reports during the opening trip were shared as the simple view's level (fixed: a trip the page asked for reports only where it lands; the person's own drag, wheel or rail move takes over), the 720px caption squeezed between the minimap and the dock (fixed: its own row below 1100px), and 320px rail targets under 44px (fixed).

## Decisions

D-285 in `docs/DECISIONS.md`.

## Remaining uncertainty

- The App itself was not rendered: the proof wraps the page in the App's real `.app > .app-shell > .topbar / [data-app-page] .world-page / .nav` classes with the real CSS. The integrator should check the live App once (the Fund ledge, Hercules bubble and command banner are hidden by class; anything new fixed above `z-index: 1300` would show).
- iPhone: no element Fullscreen API; the takeover is CSS (`100dvh`, safe areas, page scroll locked). Not verified on a device.
- The older evidence scripts that expect the world on the page (`scripts/capture-journey-of-life-page.mjs`, `scripts/capture-path-*.mjs`) now need to open the world first; they were not updated.
- `navigator.keyboard.lock` is Chromium-only. Elsewhere, in native full screen, the browser's own Escape leaves full screen (and the world) even with a card open.

## Handoff

Next owner: the integrator. Wire `renderMini` to `JourneyMini` in `App.tsx` (`<OurPathWorld renderMini={(args) => <JourneyMini {...args} />} …>`), check the compact variant fits the corner slot, have JourneyMini pause while `worldOpen`, and verify game mode once in the real App at 390 and 1100. State: local branch only; not pushed, not merged, not deployed.
