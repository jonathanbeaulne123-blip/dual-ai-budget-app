# Hearth worksession — The journey's simple view (mini part)

- **Status:** OPEN — local branch `claude/journey-mini`; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-16 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (simple view). Game mode (D-285) is built in parallel in another worktree; the integrator mounts this component.
- **Branch / baseline:** `claude/journey-mini` from `claude/journey-simple-view` (`5f03336d`: main `d7b0151b` + D-283 + `src/path/journeyFocus.ts`)
- **Risk:** Medium. It adds new read-only UI and a renderer. There are no money, schema, sync or Hercules payload changes.
- **Decision:** D-284

## Household outcome

This is a small, delightful model of our money through time. It zooms from one day's bills, contributions and to-dos out to the whole Journey of Life:

- **Day and Week.** The Prepare / Protect / Build lanes carry their amounts. Hercules sits on today's stone.
- **Month.** The path curls into a ring that ends at the Sitdown gate.
- **Era.** The month becomes a lap on the era island, and the finish-line Kitty Banks fill.
- **Journey.** The four era islands float with bridges between them. The current island is lit, and the future ones are in fog.

"Open the world" hands the same focus to the full island.

## Budget delta (5) / Engagement delta (3)

- **Budget (+1).** The month's Fund bills and money in, and the lane trackers, can be read at a glance.
- **Engagement (+3).** The simple view is a minigame of the open world. Scroll, pinch and drag move through it, and each level has its own cards.

## What was built (`src/path/mini/`)

### `miniJourneyModel.ts`

This file is pure: it takes the household and returns data.

- **`miniJourney(household, { memberId, view?, today })`** returns:
  - `eras` (from `pathEras`): state, laps capped at 36, finish-line banks as 0–10 steps, and plans
  - `months` (with `worldIndex` / `worldId`, where `month:<i>` follows the world's `pathMonths` window), Sitdown status, and Chapter
  - `month`: this month in full
  - `fund`: the lane trackers
  - `span`
- **`miniMonth(household, key, …)`** returns:
  - days, each holding `bill` (from `monthObligations`), `contribution` (confirmed, or observed-expected via `prepareFundInflows`) and `task` items
  - Sunday-start weeks
  - totals
- **Task visibility.** Tasks are filtered with `taskVisibleTo`. The member's own private to-dos are shown and marked as private. A partner's private to-dos are never read.
- **Original `miniFund` delivery:** read Kitty Nest categories. Superseded by the September 19 reconciliation using Plan v3’s authoritative source; this historical run does not certify that change.

### `miniWorld3d.ts`

`createMiniWorld(host, { reducedMotion, quality, compact, onFrame, onLost, onSettle })` renders the model with three.js.

- **Methods:** `setScene`, `setView({ z, day }, instant)`, `nudge`, `view`, `daysPerPixel`, `resize(w, h, inset)`, `pick`, `setQuality`, `refresh`, `stats`, `dispose`.
- **Morph.** One object morphs continuously as `z` runs from 0 to 4:
  - the ribbon curls into the ring
  - the ring scales onto its lap
  - the camera keyframes blend on a log scale
  - the Journey framing is fitted with a probe camera
- **Rendering.**
  - Labels are placed through per-frame DOM anchors.
  - It renders on demand.
  - It pauses while the page is hidden or the model is off-screen.
  - It handles a lost WebGL context.
  - Palettes are authored per theme.
  - Shadows are used only at Full quality.

### `JourneyMini.tsx` and `journey-mini.css`

**Props:** `{ household, memberId, today, focus, onOpenWorld, compact?, theme?, quality?, view?, onOpenFund?, onOpenPlanner?, proofWorld? }`.

**Controls**

- A labelled zoom scale: a vertical rail on wide screens, a row on phones.
- Zoom and time:
  - A mouse-wheel notch moves one level.
  - Trackpad and pinch zoom glide, then settle on a level.
  - Dragging, or the scrubber, moves through time.
  - The arrow keys, +/− and H also work.
- "Where we are" and "List" (an outline at every level).
- Tap cards, with doors into the world.
- "Open the world".

**Layout and fallbacks**

- `compact` shows a corner minimap for game mode.
- Lite, no WebGL and forced colours all fall back to the flat SVG map (`MiniFlat.tsx`), which uses the same label buttons.
- Classic, Taylor and Newfoundland are authored themes.

**Shared focus**

- Level, date and picks go out through `focus.set(…, "mini")`.
- Changes arrive whenever `focus.source !== "mini"`.
- World ids map as follows:
  - `month:i` opens that month's card.
  - `goal:` opens the bank card.
  - `era:` and `era-home` open the era card.
  - `bill:` and `contribution:` ids (id `…@date`) and `task:` ids open that day.

## For the integrator

1. Mount `<JourneyMini household memberId today focus={api} onOpenWorld={…} quality={worldQuality} />` on the Our Path page, where `api` is the `useJourneyFocus` instance that `OurPathWorld` owns.
2. In game mode, mount `<JourneyMini … compact />` in a corner of about 180–240px. It is square, and a pick in it only moves the shared focus.
3. The world should honour `focus` whenever `source === "mini"`. For the mini-only ids `bill:<id>@<date>`, `contribution:<id>@<date>` and `task:<id>`, it should focus the month of that date.
4. `onOpenFund` / `onOpenPlanner` are optional doors from the lane card.
5. **Performance.** On the big synthetic Our Story household, the model computes in about 2.6s and each other month in about 0.5s, mostly in `projectKittyNest` and `monthObligations`. The component defers this work and shows the month skeleton first.

## Verification

- `npx tsc --noEmit -p .` passes.
- `npx vitest run test/journey-mini-model.test.ts test/journey-mini-ui.test.ts test/our-path-world-ui.test.ts test/path-minimap.test.ts` passes: 59 tests.
- `npx vitest run test/journey-mini-story.test.ts` passes: 4 tests in about 200s. This file generates Our Story in a child process.
- Browser evidence was captured with `node scripts/serve-journey-mini-proof.mjs --capture` (headless Chromium with SwiftShader) into `docs/evidence/journey-simple-view/mini/`. It has 100 captures:
  - 320 / 390 / 720 / 1100 px × 3 themes × 5 levels
  - contribution days and the morph caught halfway
  - cards, lists and keyboard focus
  - reduced motion (all cuts confirmed)
  - Lite, no WebGL, and the compact minimap on its own and inside a stand-in world
  - the plan-life household
- `report.json` records no page overflow, no console errors and no visible control under 44px (compact minimap excluded).

## Uncertainty and open points

- **Build reads $0 on Our Story.** Main's Kitty Nest attributes Fund reserves to Protect, while the banks are backed by goal claims. The tracker says what main computes until the fundModel swap.
- **Money in only exists where the Fund confirmed it.** Bills are the Fund's obligations only, so bills that are not Fund-funded do not appear.
- **Phone Week view.** The four lane labels do not always fit: lower-priority lanes hide, and the Day view and the List show all four.
- **Trackpad zoom.** The glide was tested with synthetic events. A mouse-wheel notch reliably steps one level.

## Data and environment

Only fictional Development data was used (Our Story habitat, plan-life fixture). Nothing is stored or posted, and nothing was pushed.

## Next owner

The integrator (D-285 / game mode) mounts the component and wires the world side of the shared focus.

## Integration (2026-09-17)

The two halves are one feature on `claude/journey-simple-view`; D-284 and D-285 in `docs/DECISIONS.md` carry the detail.

- **Mounted by Our Path itself.** The page copy sits in the simple-view slot, and the compact copy is the open world's corner minimap. `renderMini` still overrides for proofs and tests.
- **One staged read-model** in a worker, memoized per household revision and shared by both copies and the world's caption. The longest main-thread task on Our Story fell from about 3.0 s to about 0.19 s.
- **The two views talk both ways:** picks, levels, camera rests, landed trips and Replay all travel through `useJourneyFocus`.
- **Same words in both:** `test/journey-integrated-ui.test.ts` holds the eras, months, Chapter, "where we are" and the lane amounts to the same values.
- **Evidence:** `docs/evidence/journey-simple-view/integrated/` — 264 captures, `report.json`, `performance.json`.
