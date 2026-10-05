# Journey map (Horizon Clock) — visual and accessibility evidence

> **Stale after the fix pass (2026-10-05):** these captures are from `8009001`, before the fix pass merged (trust M1–M4,
> Week/Year rework, "not recorded on its schedule" wording). Re-capture on the current tip before using them as proof;
> see `docs/CLAUDE_JOURNEY_CLOCK.md` › Still to do.

**Tree.** Branch `claude/journey-clock`. Every proof-page capture, `report.json` and both axe files come from **`8009001`**
(the plan-of-record tree `8c8a4f4` plus two presentation-only fix commits made during this pass, `a20f1e6` and `8009001`,
listed under *Fixed during this pass*). Local only: not pushed, not merged, not deployed.

**Data.** The fictional Development demo kitchen `seedDemoHousehold({ today: "2026-09-28", environment: "development" })`,
viewed by Jonathan (`MEM-002`), which is the fixture `test/journey-map-model.test.ts` uses. `empty-*` uses a brand-new
`newHouseholdTemplate("development")`. No real household data, no hosted service, nothing stored (view state lives in an
in-memory Storage, and actions are stubs that record their names).

**Browser.** Headless Chromium 141 (`/opt/pw-browsers/chromium-1194`) with SwiftShader software GL. This is not a phone and
not a real GPU. `hardwareConcurrency` is reported as 8 so the App's own tiering picks *lite* below 720 px and *full* at and
above, as a real device would (the container has 2 cores). Fonts are the App's own Google Fonts link from `index.html`.
Viewports are 320×568, 390×844, 720×900 and 1100×800, each a fresh context at its real size, DPR 1.

**Reproduce.**
```
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/serve-journey-map-proof.mjs --capture        # all of it, ~10 min
PARTS=grid|extras|tail  WIDTHS=…  THEMES=…  OUT=…                                                 # narrower runs
node scripts/serve-journey-map-proof.mjs                                                          # interactive URL
#   ?theme=classic|taylor|newfoundland ?level=year|month|week ?list=1 ?motion=reduced ?quality=flat|lite|full
#   ?land=fail ?loading=1 ?empty=1 ?due=N ?member=MEM-001
```
Real-App pass. First start the dev server with the `pages.yml` presentation flags (no Auth/Supabase flags, so the demo
household stays loopback-only), then run `--real-app`:
```
VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 VITE_HEARTH_HORIZON=1 VITE_FUND_MODEL_V2=1 VITE_CELLAR_V3=1 \
VITE_HERCULES_WORKSPACE=1 VITE_PLAN_SYSTEM_V2=1 VITE_QUEENS_NEST=1 VITE_HERCULES_ACTIONS=1 VITE_HERCULES_CHAT=1 \
VITE_HERCULES_DISCOVERY=1 VITE_HERCULES_DRESSING_ROOM=1 pnpm exec vite --host 127.0.0.1 --port 5211 --strictPort
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/serve-journey-map-proof.mjs --real-app
```

`report.json` holds the facts for every capture: viewport, page overflow, stage mode (live/flat), land status, level, header,
purse, bubble and callout words, sheet title, focused element, whether "+" is the topmost element at its centre, every
visible control under 44 px, and every visible word or control past the viewport edge. It also holds `axe`,
`keyboardOrder`, the reduced-motion `cuts`, and the Which-one fan's options.

## Files

| Files | What they show |
|---|---|
| `{year,month,week}-{320,390,720,1100}-{classic,taylor,newfoundland}.png` (36) | The matrix: each level at each width in each theme. The live 3D map in every frame (lite under 720, full at and above). |
| `list-{month,week,year}-{390,1100}-taylor.png` | The List view at each level: the strip (In / Out in the Books, To the Fund, Still to come, Needs you), the legend, and rows with their own actions. |
| `sheet-stop-{390,1100}-taylor.png` | Stop sheet for Tue 15 Sep (a "to check" Groceries bill and a recorded Bianca pay) with its labelled actions. |
| `sheet-checklist-{390,1100}-taylor.png` | Hercules's list ("This week, then 8 to check") opened from the bubble. |
| `sheet-pile-week-{390,1100}-taylor.png` | Week: the overdue pile's sheet ("Needs you · 8 pinned to Mon"). |
| `dial-{390,1100}-taylor.png` | "+" open: three record verbs and the Open chips (Calendar, Books, Kitchen table, Simple view, All tools, Enter Horizon) over a scrim. |
| `which-one-{390,1100}-taylor.png` | A real canvas tap on today's slot, which holds 4 stops, fans out "Which one?" in date order. |
| `key-{month,year}-{390,1100}-taylor.png` | The Key at Month (a ring every $100) and Year (a ring every $1000, "bills and planned costs on the map, not all spending"). |
| `reduced-motion-{month,week}-{390,1100}-newfoundland.png` | `prefers-reduced-motion: reduce`: `journey-board--still`, and each level change is a cut (see `report.json → shots[…].cuts`). |
| `keyboard-{1-about,2-mark,2b-sheet,2c-sheet-action,3-slider,4-plus}-{390,1100}-classic.png` | Tab from the top: the header "i" (step 1), the first mark (step 6), Enter opens its sheet with focus on the title, Tab moves to the sheet's close button, then the level slider (step 26) and "+" (step 27). The full order is in `report.json → keyboardOrder`. |
| `empty-month-*.png`, `empty-list-*.png` | Brand-new household: "Nothing is on the map yet … Nothing is invented for you."; the list says the same. |
| `loading-month-{390,1100}-classic.png` | The land never arrives: the flat clock with every mark, and "Drawing the island… every stop and action is already in the list." |
| `land-fail-month-{390,1100}-classic.png` | The land load fails: the flat clock plus "The island could not be drawn on this device right now…". |
| `offline-{month,list}-{390,1100}-classic.png` | Land requests held, context set offline, then aborted (`internetdisconnected`). The board falls back to flat with the failed note; the list works offline. |
| `flat-{year,month,week}-390-taylor.png`, `flat-month-1100-newfoundland.png` | The flat tier (Simple view / no WebGL): SVG clock with the flat island, paper-disc marks, and the Week lane. |
| `axe-390.json`, `axe-1100.json` | axe-core 4.13.0 (`@axe-core/playwright`) on `[data-journey-board]` in Month, Taylor, at rest. Tags: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice. A second scan with the list open is summarised in `report.json → axe`. |
| `real-app-arrival-{390,1100}-taylor.png`, `real-app.json` | **The real App** (dev server, pages.yml flags): demo household → "I am Jonathan" → arrives on `/house/kitchen-table/above?…&surface=journey`, live map, land ready, Development label, in about 31 s. The demo is generated with the real clock, so it shows **October** and today Mon 5 Oct, not the proof page's fixed 28 Sep. |
| `real-app-before-radius-fix-390-taylor.png` | The same arrival on `8c8a4f4` before `a20f1e6`: every board button squared to 3 px by the App's theme dressing. |

## Findings

### Matches the approved prototype (`/home/claude/proto/horizon-clock-*.png`)
- **Month**: the clay island inside the bezel ring with honey "!" rings on the to-check slots, Hercules at the centre, a
  pink Today callout and a Leaving-next callout, the bubble ("5 things this week … 8 to check"), and the dock (level pull
  + Key, "+", Map/List). The composition matches at 390 and 1100 (`month-390-taylor`, `month-1100-taylor`).
- **Week**: the Party Board trail with Today, Wed 30 and Thu 1 tiles, the orange overdue pile with "!", Fri–Sun stones,
  and the "5 this week · 8 to check" pill (`week-1100-taylor` is very close to `horizon-clock-week-1100`).
- **Year**: the ring of twelve minis with the current month at the centre, honey "!" on Jun–Sep, and the Sep plate in accent.
- Phone and wide compositions differ as the prototype does: on wide the purse moves to the bottom left over the pull, and
  the bubble and Map/List float.
- All three themes have authored treatments on the map, not only the chrome: Classic is cream and terracotta,
  Taylor is blush, and Newfoundland has a painted clapboard bezel and slate sea.
- Status words come from the model (ruling 10): "Set aside in Build · not paid", "Overdue · not recorded",
  "pay expected · not in yet". Unknown amounts are not drawn as stacks. "To the Fund" is its own figure in the list strip.

### Differs from the prototype (by design, or worth a look)
1. **Callout and pill wording.** The prototype says "Setting aside next · Winter reserve" and "3 things this week". The
   build says "Leaving next · Standing · jar · Winter reserve" (truncated with "…" at every width) and "5 things this
   week", because ruling 10 makes the model the source of words and the model counts 5 stops. The long label truncates on
   every capture (`month-390-taylor`, `week-*`). This is a copy decision, not a bug.
2. **Year plates are small.** The prototype's Year has large paper plates ("Jan · nothing kept"). The build's are small
   pills without the "nothing kept" line, and the Sep plate reads "Out $1311.00 · not recorded" where the prototype has
   two lines, recorded and not recorded (`year-390-*`, `year-1100-*`).
3. **Week labels.** The prototype prints plates on the tiles ("MON 28 · TODAY", "+$2,100 pay", "$980 to the Fund"). The
   build has DOM plates beside the tiles ("Tue 29", "Wed 30 · $300.00") and no plate on today's tile. At **320 and 390**
   the Week callouts and plates stack over the trail: "Leaving next", "Today", "Fri 2", "Wed 30 · $300.00" and
   "Thu 1 · $1850.00" overlap and partly cover each other (`week-320-*`, `week-390-*`, `flat-week-390-taylor`).
   This is the most visible gap from the prototype.
4. **Month at 320×568.** The ring is about 260 px wide between the purse and the bubble. The Leaving-next callout sits
   over the top of the ring and the Today callout over its left side. Everything is readable, but the island is mostly
   covered (`month-320-*`).
5. **Real App: the App chrome stands above the board** (ruling 11). On a phone the board starts 258 px down, under
   Hearth, Status Centre, "This phone", and Our Home / My Money. The clock is then about 210 px wide
   (`real-app-arrival-390-taylor`). At 1100 the App's resident Hercules speech bubble ("Groceries · planned needs a
   payment") overlaps Status Centre. That is the App's, not the board's (`real-app-arrival-1100-taylor`).
6. **Money format.** Amounts read "$2100.00" (the model's `formatCad`). The prototype has "$2,100.00".
7. **Sheet title focus ring.** When a sheet opens, its title takes focus and draws a heavy brown rounded outline
   (`sheet-*`, `keyboard-2b-*`). This is correct behaviour but visually loud.

### Overflow and clipping
- **No page-level horizontal overflow in any capture.** `pageOverflowX` is false in all 88.
- After the fixes, `outsideViewport` is empty everywhere except `sheet-stop-390-taylor`: the Fri 11 Sep mark button
  (44 px, decorative position) extends 13 px past the right edge behind the open sheet. This is harmless.

### Touch targets (< 44 px)
- `controlsUnder44` is empty in every capture. Every visible button and the slider is at least 44×44 (marks 44, chapter
  minis 64, "+" 72, petals 64).
- axe **target-size** flags 1 node: `#journey-mark-2026-09-28` (today's day mark). The bus "piece" mark sits on top of
  it, so only 13.5 px (390) / 20.2 px (1100) of it can be clicked, and its neighbour gap is 2–9 px. Today is still
  reachable through the piece mark, which opens today, and through the keyboard. The smallest fix is to not emit the day
  mark when the piece covers it (or offset the piece).

### axe-core 4.13.0
| Scan | Violations | Passes | Incomplete |
|---|---|---|---|
| 390 map | **1 · target-size (serious) · 1 node** (today's mark under the piece) | 22 | color-contrast 15 (text over the canvas, cannot compute), aria-valid-attr-value 1 (theme dot `aria-controls` points at a popover that is not rendered while closed) |
| 1100 map | **1 · target-size (serious) · 1 node** (same) | 22 | same |
| 390 list | 0 | 30 | — |
| 1100 list | **1 · color-contrast (serious) · 2 nodes** (Map/List options) | 30 | — |

The 1100 list contrast hit is an axe sampling artefact. axe reads the background as `#d3c7c8` (the list's 0 18 30 shadow
blended over the toggle), but the rendered colours are `#7d5b6c` on `#fffaf5`, which is **5.65:1** (sampled from the
PNG). The same toggle passes at 390 and in both map scans.

### Behaviour verified
- **Add unobstructed.** "+" is the topmost element at its centre in 81 of 88 captures. The 7 where it is not are
  intentional overlays: the open dial (its scrim, z 10, catches the tap and closes it; a real click on "+" while open
  closes the dial), and a phone sheet that covers the dock. The Confirm screens are the App's Add flow, outside this board.
- **Development label.** It is literal in the real-App pass ("Development", top right). The proof page has no App chrome.
- **Reduced motion.** Each Year/Month/Week press lands at once (slider 2 → 0 → 1 within 80 ms); `journey-board--still` is
  set and the CSS animations are off.
- **Keyboard.** Tab order is header (i, ‹, ›, theme), stage ("Our island as a clock"), then every mark in date order,
  then the level words, Key, slider, "+", Map, List. Escape on a sheet returns focus to the mark that opened it. Focus is
  visible on every stop (ring on the header button, slider and "+"; honey ring on the mark).
- **Offline, land failure, loading.** The board never blocks on 3D. The clock, marks, bubble and list are there in every
  failure state, and the list is fully usable offline.
- **Flat tier.** It draws all three levels with the SVG island.

### Fixed during this pass (visibly broken; presentation only, each in its own commit)
- **`a20f1e6`.** In the real App every board button rendered as a 3 px square: "i", ‹ ›, the theme dot, "+", Map/List and
  Key. `theme/worlds.css` sets `border-radius: var(--world-r-control)` on all buttons at 0-5-0. The board now sets that
  custom property per control (`real-app-before-radius-fix-390-taylor` shows before, `real-app-arrival-390-taylor` after).
- **`8009001`.**
  - 320 px: the theme dot was 6 px off-screen.
  - 720 px: the purse covered the first line of the bubble ("5 things this week").
  - "Which one?" ran off the top and left of the board.
  - Year plates at the edge ("Sep · 5 ! Out $1311.00 …") were cut off at 320/390.
  - "Drawing the island…" sat under the bubble.

  The `journey-board-ui`, `journey-board-app` and `journey-board-parity` tests pass (53/53) after both commits.

### Evidence gaps
- No real phone or GPU (SwiftShader only). No forced-colours, landscape-phone or 200 % zoom captures.
- No Crossroads preview: the demo has no crossroads stop.
- "Enter Horizon here" and the Horizon round trip were not exercised here (the dial chip is shown, not pressed).
- The real-App pass covers arrival only, at 390 and 1100, in Taylor.
