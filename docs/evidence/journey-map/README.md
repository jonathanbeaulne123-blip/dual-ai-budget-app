# Journey map (Horizon Clock) — visual and accessibility evidence

**Tree.** Branch `claude/journey-clock` at **`9cbd510`**: the fix-pass tip `6801956` plus the grouped-money commit
`9cbd510`. Every proof-page capture, `report.json`, both axe files and the real-App pass come from that tree
(`report.json → sha`). Local only: not pushed, not merged, not deployed.

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
| `sheet-stop-{390,1100}-taylor.png` | Stop sheet for Tue 15 Sep: an overdue Groceries bill and a recorded "+$2,100.00" Bianca pay. |
| `sheet-checklist-{390,1100}-taylor.png` | Hercules's list ("This week, then 8 to check"): this week's rows with signed grouped figures. |
| `sheet-pile-week-{390,1100}-taylor.png` | Week's overdue pile: "Needs you · 8 pinned to Mon". |
| `dial-{390,1100}-taylor.png` | "+" open with the App's five record modes (purchase, shift, Mark paid, income, Move money) and the Open chips. |
| `which-one-{390,1100}-taylor.png` | A canvas tap on today's slot (4 stops) fans out "Which one?" inside the board. |
| `key-{month,year}-{390,1100}-taylor.png` | The Key at Month ($100.00 a ring) and Year ($1,000.00 a ring). |
| `reduced-motion-{month,week}-{390,1100}-newfoundland.png` | Reduced motion. Each level change is a cut (`report.json → …cuts`). |
| `keyboard-*-{390,1100}-classic.png` | Tab from the top: "i" at step 1; first mark at step 6, where Enter opens its sheet (focus on the title) and Tab moves to its close button; the slider at step 25 (390) / 22 (1100); "+" at step 26 / 23. |
| `empty-month-*`, `empty-list-*` | Brand-new household: "Nothing is on the map yet … Nothing is invented for you." |
| `loading-month-*`, `land-fail-month-*` | Flat clock and marks while the land is on its way, and after it fails, each with its note. |
| `offline-{month,list}-*` | Land requests held, then the context goes offline. Flat fallback; the purse adds "Offline · this device's copy of the books"; the list works. |
| `flat-{year,month,week}-390-taylor`, `flat-month-1100-newfoundland` | The flat tier (Simple view / no WebGL). |
| `axe-390.json`, `axe-1100.json` | axe-core 4.13.0 on `[data-journey-board]`, Month, Taylor, at rest. Tags: wcag2a/aa, 2.1 a/aa, 2.2 aa, best-practice. List-open scans are in `report.json → axe`. |
| `real-app-arrival-{390,1100}-taylor.png`, `real-app.json` | **The real App** (pages.yml flags): demo → "I am Jonathan" → Journey map. The demo uses the real clock, so the App shows October (today Mon 5 Oct). |
| `real-app-before-radius-fix-390-taylor.png` | Kept as the *before* of the radius bug (`a20f1e6`, buttons squared to 3 px). `real-app-arrival-390-taylor` is the after. Its other content is from an older tree. |

## Findings

### Fixed in this pass: money format (`9cbd510`)
Every map figure now uses Hearth's grouped CAD (`formatCadGrouped`, the "$4,716.80" the panels print). That covers the
purse ("+$2,100.00"), callouts, sheets, list strip and rows ("+$4,959.86", "$15,851.00", "$10,933.65"), Year plates
("$3,544.55", "$1,311"), Week face tags ("THU 1 · $1,850"), the Key ("$1,000.00 a ring") and the checklist.
`signedMoney` keeps its sign only where the model puts it. No "$NNNN.NN" remains in any capture.

### Matches the approved prototype (`/home/claude/proto/horizon-clock-*.png`)
- **Month** (`month-390-taylor`, `month-1100-taylor`):
  - clay island in the bezel ring with honey "!" stacks on the to-check slots;
  - the bus at today, Hercules at the centre;
  - Today and **"Setting aside next · Winter reserve / $300.00 · Wed 30 Sep"** callouts (now the prototype's words);
  - bubble "5 things this week · Setting aside next · Winter reserve · 8 to check";
  - the dock.

  At 1100 the composition is very close to `horizon-clock-month-1100`.
- **Week** (`week-390-taylor`, `week-1100-taylor`): the Party Board trail with face tags *on the tiles* as in the
  prototype ("MON 28 · TODAY", "WED 30 · $300", "THU 1 · $1,850", "FRI 2", "SAT 3", "SUN 4"), the orange pile with "8 !",
  one Today callout, and the "5 this week · 8 to check" pill. This is the prototype's Week, and 1100 is near-identical.
- **Year** (`year-390-taylor`, `year-1100-taylor`):
  - title "2026 · the year · September";
  - a caption ("Each stack = bills on the map that month · ring = $1,000 · not all spending · ● recorded ○ not recorded");
  - prototype-style two-line plates, e.g. "Jan / nothing on the map", "Aug · 1 to check / ● $248 ○ $520";
  - the Sep plate in accent ("Sep · 5 to check / $1,311 not recorded").
- **Three authored themes**: Classic (cream bezel, terracotta), Taylor (blush), Newfoundland (painted clapboard bezel,
  slate sea, navy controls).
- **Phone vs wide**: on phones the purse sits under the header; on wide it sits at the bottom left over the pull, and the
  bubble and Map/List float, as in the prototype.

### Differs from the prototype / worth a look
1. **Phone purse is tall.** With the trust note ("A pay is already recorded today · check the Books before recording this
   one") it runs 4–5 lines. At 390 it takes about 90 px; at 320 Week about 110 px (`month-390-*`, `week-320-*`). The
   prototype's purse is 2 lines.
2. **320×568 is cramped.**
   - Year: plates overlap; Jan is under Dec and the caption, and Jul is hidden behind Aug/Jun (`year-320-*`).
   - Week: the island shows between a large purse and the dock; tags sit close together but are readable (`week-320-*`).
   - Month: both callouts sit over the island (`month-320-*`).
3. **Year at 390 and above**: plates sit beside or over the minis, so Dec/Feb/Mar/Apr/May partly cover their minis.
   They are readable but busier than the prototype's spacing.
4. **Real App, phone** (`real-app-arrival-390-taylor`): arrival now scrolls the App chrome away (scrollY 258), so the
   board is the full 844 px and the clock is about 360 px wide. Two side effects:
   - the App's floating **Mountain/Horizon toggle sits over the header month title** ("October" is hidden behind it);
   - the **Development label scrolls out of view** on arrival. It is literal in the chrome above, but not on screen.
5. **Real App, wide** (`real-app-arrival-1100-taylor`): the board stays below the chrome (top 244 px, board 560 px tall,
   no scroll), so the clock is small (about 210 px). The App's resident Hercules bubble also overlaps Status Centre.
6. `sheet-stop-390-taylor`: the "Setting aside next" callout runs 4 px off the left edge behind the open sheet. This is cosmetic.

### Overflow
- No page-level horizontal overflow in any of the 88 proof captures or the 2 real-App captures.
- `outsideViewport` is empty everywhere except `sheet-stop-390-taylor` (finding 6, plus a 44 px mark behind the sheet).

### Touch targets
- Every non-mark control is at least 44×44: header buttons, pull words, Key, slider, "+" (72), Map/List, petals, chips,
  sheet actions and rows.
- **Day marks are now sized to their spacing** (fix pass, `1f8d071`) and go as small as **24×24** in crowded stretches:
  - 320 Month: 13 marks, 24–37 px;
  - 320 Week: 6 marks at 24 px;
  - 390 Month: 4 marks, 25–36 px;
  - 390 Week: 4 marks, 24–30 px;
  - 720 / 1100: 2 marks, 31–35 px.

  All meet WCAG 2.2 AA target-size (24 px, which axe passes) but not Hearth's own 44 px floor. Every day is also reachable
  through the keyboard (arrow keys) and the list.

### axe-core 4.13.0
| Scan | Violations | Passes | Incomplete |
|---|---|---|---|
| 390 map | **0** | 22 | color-contrast 18 (text over the canvas, cannot compute), aria-valid-attr-value 1 (theme dot `aria-controls` points at a popover not rendered while closed) |
| 1100 map | **0** | 22 | same |
| 390 list | **0** | 30 | — |
| 1100 list | **0** | 30 | — |

The previous pass's target-size violation (today's day mark under the bus) and the list-toggle contrast artefact are both gone.

### Behaviour verified
- **Add unobstructed.** "+" is topmost at its centre in every capture except intentional overlays: the open dial (its
  scrim closes it) and phone sheets over the dock.
- **Development label.** Literal in the real App's chrome (finding 4: scrolled out of view on phone arrival).
- **Reduced motion.** Year/Month/Week land within 80 ms (slider 2 → 0 → 1), `journey-board--still`.
- **Keyboard.** Header (i, ‹, ›, theme) → stage → marks in date order → level words, Key, slider → "+" → Map/List.
  Escape returns focus to the opening mark. Focus is visible at every stop.
- **Failure states.** Offline, land-fail and loading keep the clock, marks, bubble and list. Budgeting never waits on 3D.

### Evidence gaps
- No real phone or GPU. No forced-colours, landscape-phone or 200 % zoom captures.
- No Crossroads preview: the demo has none.
- The Horizon round trip and "Enter Horizon here" were not pressed.
- The real-App pass is arrival only, Taylor, at 390 and 1100.
