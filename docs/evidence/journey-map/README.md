# Journey map (Horizon Clock) — visual and accessibility evidence

**Tree.** Branch `claude/journey-clock` at the commit that adds this README text. The captures are from `4d52736` plus
the Year-fit change in that same commit (`report.json → sha` prints `4d52736`, the HEAD the script read, because the
change was not committed yet). Every proof-page capture, `report.json`, both axe files and both real-App arrivals come
from that one tree. The only exception is `real-app-before-radius-fix-390-taylor.png`, kept on purpose as a *before*.
Local only: not pushed, not merged, not deployed.

**Data.** The fictional Development demo kitchen `seedDemoHousehold({ today: "2026-09-28", environment: "development" })`,
viewed by Jonathan (`MEM-002`), which is the fixture `test/journey-map-model.test.ts` uses. `empty-*` uses a brand-new
`newHouseholdTemplate("development")`. No real household data and no hosted service. Nothing is stored: view state lives
in an in-memory Storage, and actions are stubs that record their names. The dial captures pass the App's record modes
(`?modes=expense,shift,income,bill,transfer`).

**Browser.** Headless Chromium 141 (`/opt/pw-browsers/chromium-1194`) with SwiftShader software GL. This is not a phone and
not a real GPU. `hardwareConcurrency` is reported as 8 so the App's own tiering picks *lite* below 720 px and *full* at and
above. Fonts are the App's own Google Fonts link. Viewports are 320×568, 390×844, 720×900 and 1100×800, each a fresh
context at its real size, DPR 1.

**Reproduce.**
```
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/serve-journey-map-proof.mjs --capture        # ~10 min
PARTS=grid|extras|tail  WIDTHS=…  THEMES=…  OUT=…                                                 # narrower runs
node scripts/serve-journey-map-proof.mjs                                                          # interactive URL
#   ?theme ?level=year|month|week ?list=1 ?motion=reduced ?quality=flat|lite|full ?land=fail ?loading=1 ?empty=1 ?due=N
#   ?member=MEM-001 ?modes=expense,shift,income,bill,transfer
```
Real-App pass. First start the dev server with the `pages.yml` presentation flags (no Auth/Supabase flags, so the demo
stays loopback-only), then run `--real-app`:
```
VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 VITE_HEARTH_HORIZON=1 VITE_FUND_MODEL_V2=1 VITE_CELLAR_V3=1 \
VITE_HERCULES_WORKSPACE=1 VITE_PLAN_SYSTEM_V2=1 VITE_QUEENS_NEST=1 VITE_HERCULES_ACTIONS=1 VITE_HERCULES_CHAT=1 \
VITE_HERCULES_DISCOVERY=1 VITE_HERCULES_DRESSING_ROOM=1 pnpm exec vite --host 127.0.0.1 --port 5211 --strictPort
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/serve-journey-map-proof.mjs --real-app
```

`report.json` holds the facts for every capture: viewport, page overflow, stage mode and land status, level, header,
purse, bubble and callout words, sheet title, focused element, whether "+" is the topmost element at its centre, every
visible control under 44 px, and every visible word or control past the viewport edge. It also holds `axe`,
`keyboardOrder`, the reduced-motion `cuts` and the Which-one fan options.

## Files (91 PNG)

| Files | What they show |
|---|---|
| `{year,month,week}-{320,390,720,1100}-{classic,taylor,newfoundland}.png` (36) | The matrix, with the live 3D map in every frame. |
| `list-{month,week,year}-{390,1100}-taylor.png` | List view. Strip: In / Out in the Books, To the Fund, Still to come with expected and estimate lines apart, Needs you. Then the legend, and rows with their own actions. |
| `sheet-stop-{390,1100}-taylor.png` | Stop sheet for Tue 15 Sep ("2 things on this day"): an overdue Groceries bill and a recorded "+$2,100.00" Bianca pay. |
| `sheet-checklist-{390,1100}-taylor.png` | Hercules's list ("This week, then 8 to check"): this week's rows with signed grouped figures. |
| `sheet-pile-week-{390,1100}-taylor.png` | Week's overdue pile: "Needs you · 8 pinned to Mon". |
| `dial-{390,1100}-taylor.png` | "+" open with the App's five record modes (purchase, shift, Mark paid, income, Move money) and the Open chips. |
| `which-one-{390,1100}-taylor.png` | A real press where the 44 px hit areas of Fri 25 and Sat 26 Sep overlap. "Which one?" opens inside the board with "Fri 25 Sep · Phone" and "Sat 26 Sep · Vet · Marmalade". |
| `key-{month,year}-{390,1100}-taylor.png` | The Key at Month ($100.00 a ring) and Year ($1,000.00 a ring). |
| `reduced-motion-{month,week}-{390,1100}-newfoundland.png` | Reduced motion. Each level change is a cut (`report.json → …cuts`). |
| `keyboard-*-{390,1100}-classic.png` | Tab from the top: "i" at step 1, the first mark at step 7 (390, after the purse button) / 6 (1100). Enter opens its sheet with focus on the title, and Tab moves to its close button. The slider is at step 26 / 25 and "+" at 27 / 26. |
| `empty-month-*`, `empty-list-*` | Brand-new household: "Nothing is on the map yet … Nothing is invented for you." |
| `loading-month-*`, `land-fail-month-*` | Flat clock and marks while the land is on its way ("Drawing the island…"), and after it fails ("The island could not be drawn … the clock and the list still hold every stop"). |
| `offline-{month,list}-*` | Land requests held, then the context goes offline. Flat fallback; the purse adds "Offline · this device's copy of the books"; the list works. |
| `flat-{year,month,week}-390-taylor`, `flat-month-1100-newfoundland` | The flat tier (Simple view / no WebGL). |
| `axe-390.json`, `axe-1100.json` | axe-core 4.13.0 on `[data-journey-board]`, Month, Taylor, at rest. Tags: wcag2a/aa, 2.1 a/aa, 2.2 aa, best-practice. List-open scans are in `report.json → axe`. |
| `real-app-arrival-{390,1100}-taylor.png`, `real-app.json` | **The real App** (pages.yml flags): demo → "I am Jonathan" → Journey map. The demo uses the real clock, so the App shows October (today Mon 5 Oct). |
| `real-app-before-radius-fix-390-taylor.png` | Kept as the *before* of the radius bug (`a20f1e6`, buttons squared to 3 px); `real-app-arrival-390-taylor` is the after. Its other content is from an older tree. |

## Findings

### Matches the approved prototype (`/home/claude/proto/horizon-clock-*.png`)
- **Month** (`month-390-taylor`, `month-1100-taylor`):
  - clay island in the bezel ring with honey "!" stacks on the to-check slots;
  - the bus at today, Hercules at the centre;
  - Today and "Setting aside next · Winter reserve / $300.00 · Wed 30 Sep" callouts;
  - bubble "5 things this week · Setting aside next · Winter reserve · 8 to check";
  - the dock.

  At 1100 the composition is very close to `horizon-clock-month-1100`.
- **Week** (`week-*`): the Party Board trail with face tags on the tiles ("MON 28 · TODAY", "WED 30 · $300",
  "THU 1 · $1,850", "FRI 2", "SAT 3", "SUN 4"), the orange pile with "8 !", one Today callout, and the
  "5 this week · 8 to check" pill.
- **Year** (`year-*`): title "2026 · the year · September", the caption ("Each stack = bills on the map that month ·
  ring = $1,000 · not all spending · ● recorded ○ not recorded"), and two-line plates ("Aug · 1 to check /
  ● $248 ○ $520"), with the open month in accent ("Sep · 5 to check / $1,311 not recorded"). Under 360 px the plates
  are one line ("Sep · 5") and only the open month prints its figures.
- **Three authored themes**: Classic (cream bezel, terracotta), Taylor (blush), Newfoundland (painted clapboard bezel,
  slate sea, navy controls).
- **Phone vs wide**: on phones the purse sits under the header as two lines ("Everyday $0.00" and "+$2,100.00 Bianca
  pay expected today"). Its "›" opens "The purse · today", which holds the full expected and already-recorded words.
  On wide the full purse sits at the bottom left over the pull, and the bubble and Map/List float.
- **Money format**: every map figure is Hearth's grouped CAD ("+$2,100.00", "$3,544.55", "$1,000.00 a ring"). Signs
  come from the model only.

### Year framing
- The Year camera fits the ring of twelve minis *and their plates* into the free area between the header row (with
  the purse and caption) and the dock, at every size. It projects the minis (bezel and stack) through the same camera
  and bisects for the nearest distance that fits.
- A tall phone keeps its 66° look-down, and wide keeps the prototype's 50°. On a short phone (320×568) the free area is
  flatter than that ellipse, so the camera looks from lower down (never under 34°) and the ring uses the width.
- Measured on all three themes at 320×568, 390×844, 720×900 and 1100×800: no plate under the header, caption, purse or
  dock; no two plates touching (a phone plate that would touch its neighbour steps out along its lean); none off
  screen. `test/journey-map-board.test.ts` checks the fit with three.js's own projection.

### Real App (`real-app-arrival-{390,1100}-taylor`, `real-app.json`)
- **Arrival** scrolls the App chrome away on every width (scrollY 258 / 244). The board starts at 64 px, just below the
  floating Mountain/Horizon toggle (`toggleClear: true`), and fills the rest of the viewport (780 / 736 px).
- **"+"** is unobstructed. No page overflow and no page errors.
- The App's floating wide Hercules rests while the board stands (the board's scene draws its own). Without that, it
  stood over the board's "i".

### Overflow
- No page-level horizontal overflow in any of the 88 proof captures or the 2 real-App captures.
- `outsideViewport` is empty everywhere except `sheet-stop-390-taylor`. There, one day mark behind the open sheet
  (Fri 11 Sep, 44 px at the ring's right edge) reaches 14 px past the screen. It is covered by the sheet and reachable
  by keyboard and in the list.

### Touch targets
- `controlsUnder44` is empty in all 88 captures. Every control is at least 44×44: header buttons, the purse button,
  day marks at every width, pull words, Key, slider, "+" (72), Map/List, petals, chips, sheet actions and rows.
- A crowded day mark draws a smaller disc inside its 44 px hit area. Where two hit areas overlap, a press asks "Which
  one?" and never guesses the topmost; a keyboard press selects directly.

### axe-core 4.13.0
| Scan | Violations | Passes | Incomplete |
|---|---|---|---|
| 390 map | **0** | 22 | color-contrast 16 (text over the canvas, which axe cannot compute), aria-valid-attr-value 1 (the theme dot's `aria-controls` points at a popover not rendered while closed) |
| 1100 map | **0** | 22 | color-contrast 18, aria-valid-attr-value 1 (same causes) |
| 390 list | **0** | 30 | — |
| 1100 list | **0** | 30 | — |

The list scans now wait for the Map/List toggle's 0.12 s background transition to settle. A scan taken mid-transition
under SwiftShader read the half-blended background as a 1.95:1 contrast failure. At rest the pressed option is paper
on ink.

### Behaviour verified
- **Add unobstructed.** "+" is topmost at its centre in every capture except intentional overlays: the open dial (its
  scrim closes it) and phone sheets over the dock.
- **Development label.** Literal in the real App's chrome, a scroll above the board after arrival.
- **Reduced motion.** Year/Month/Week land within 80 ms (slider 2 → 0 → 1), `journey-board--still`.
- **Keyboard.** Header (i, ‹, ›, theme) → purse (phone) → stage → marks in date order → level words, Key, slider → "+" →
  Map/List. Escape returns focus to the opening mark. Focus is visible at every stop.
- **Failure states.** Offline, land-fail and loading keep the clock, marks, bubble and list. Budgeting never waits on 3D.

### Still worth a look
1. **320×568 Month**: both callouts sit over the island, and the bubble covers the front of the ring
   (`month-320-*`). They are readable, but crowded.
2. **Development label off screen after arrival** (both widths). Whether the App header belongs above the map is
   Jonathan's decision (A9).

### Evidence gaps
- No real phone or GPU. No forced-colours, landscape-phone or 200 % zoom captures.
- No Crossroads preview: the demo has none.
- The Horizon round trip and "Enter Horizon here" were not pressed.
- The real-App pass is arrival only, Taylor, at 390 and 1100.
