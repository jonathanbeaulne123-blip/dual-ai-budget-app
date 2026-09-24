# Simple View Desk — browser evidence (2026-09-24)

Branch `claude/simple-view-desk`. Captured locally with headless Chromium (Playwright, `/opt/pw-browsers`, SwiftShader WebGL) against the Vite dev server running the **presentation flags `.github/workflows/pages.yml` sets**:

```
VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 VITE_PLAN_SYSTEM_V2=1 VITE_QUEENS_NEST=1 \
VITE_FUND_MODEL_V2=1 VITE_CELLAR_V3=1 VITE_HERCULES_ACTIONS=1 VITE_HERCULES_WORKSPACE=1 \
VITE_HERCULES_CHAT=1 VITE_HERCULES_DISCOVERY=1 VITE_HERCULES_DRESSING_ROOM=1 \
pnpm exec vite --host 127.0.0.1 --port 5211 --strictPort
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-simple-view-desk.py docs/evidence/simple-view-desk
```

The Auth / Supabase / continuity / diagnostics flags from `pages.yml` were deliberately **not** set: the evidence uses the Development **demo household** ("Open the demo household table" → "I am Bianca"), which makes zero hosted calls. All figures are fictional demo data. No hosted service, secret or real household data was touched.

- **The 3D world did draw** in headless Chromium here (SwiftShader, tier `lite`, status `ready`), so the bar-over-world frames are the real island. The Desk frames are the flat tier reached by the flip (`hearth:motion=flat`), plus one run with WebGL disabled (the device tier).
- Stills use `prefers-reduced-motion: reduce` unless noted. The Desk scrolls inside its viewport-tall stage, so each Desk page has a top frame and, when the page runs on, an `-end` frame (the Desk scrolled to its bottom). Frames are viewport-sized, DPR 1.
- `captures.json` records the DOM facts read at each capture (Desk scope/page/status, world tier, which bar stood, flip edition, Everyday-figure state, pawprint, mailbox notice, slip, cracked seal, horizontal overflow). No capture had horizontal page overflow.
- Page errors during the run: none.

## Index

### The one bar and the flip button
| File | What it shows |
| --- | --- |
| `bar-over-world-390.png` | The one bar over the drawn 3D Village Square at 390 (island edition, `data-harbour-bar=island`). |
| `bar-over-world-1100.png` | Same at 1100: `[Simple view] [⌖ Village map] [Quick travel…] [↗ Look around] [◇ Journey] [+] [All tools]`. |
| `bar-island-closeup-390.png` | The island bar alone at 390: compressed icons, the Simple-view flip at the left end, pawprint on All tools. |
| `bar-island-closeup-1100.png` | The island bar alone at 1100 with labels. |
| `flip-button-everyday-figure-1100.png` | The flip button at rest wearing the Everyday figure (`data-edition-figure=known`, shows `$0` — the demo's Everyday now is a known $0.00, same as the Desk's big number; aria "Switch to the simple view"). |
| `bar-door-closeup-390.png` | The door edition of the bar over the Desk at 390: `[Harbour] [+] [All tools]` with the pawprint. |
| `bar-door-closeup-1100.png` | The door edition at 1100. |

The **pawprint** was raised in the demo (Hercules had a "Review a possible duplicate" suggestion) and is visible on All tools in every bar close-up.

### The flip (backtick)
| File | What it shows |
| --- | --- |
| `flip-before-backtick-1100.png` | The Harbour at 1100, focus on the page, before pressing `` ` ``. |
| `flip-mid-transition-1100.png` | ~120 ms after the backtick with motion allowed: the Desk fading in over the swap. The page-turn leaf itself ran (a MutationObserver recorded one `data-page-turn="to-desk"` overlay) but was already gone when this SwiftShader screenshot landed, so the leaf is **not** in the frame. |
| `flip-after-backtick-1100.png` | After the backtick: the Desk (household, Today) with the door bar. |

**Reduced motion:** with `prefers-reduced-motion: reduce`, the script flipped Desk → Harbour → Desk by backtick and the observer recorded **no** page-turn overlays (`turnsUnderReduce: []`): the flip is a plain cut.

### The Desk, household (Classic) — Today, Leaving, Accounts, Calendar, Books at 320 / 390 / 720 / 1100
| Files | What they show |
| --- | --- |
| `desk-today-{320,390,720,1100}.png` + `-end` | Today: Everyday "Now" big, Prepare/Protect/Build, the three wax seals (Money in / Money out / Leftover — the Leftover seal is **cracked**, the demo month is negative), the Level, the sundial, the mailbox notice (flag up: "Checking. The Fund has not been reconciled yet."), the "Since you were here" slip, and Hercules's corner with its top suggestion and Talk button. The Sitdown dog-ear was not raised by the demo. |
| `desk-leaving-{320,390,720,1100}.png` + `-end` | Leaving: next to leave, the spoken-for bar, the next-out table, the calendar-weight rail and the bill-jar states. |
| `desk-accounts-{320,390,720,1100}.png` + `-end` | Accounts: the glance pick (Visa, owed) and the shared tiles, `accountsWidget` figures unchanged. |
| `desk-accounts-expanded-{320,390,720,1100}.png` | One tile expanded ("Benefits owing") showing its latest register row and "Fold away". |
| `desk-calendar-{320,390,720,1100}.png` + `-end` | Calendar: this-week strip with kind glyphs and the mini month grid with heat tint. |
| `desk-books-{320,390,720,1100}.png` + `-end` | Books: the Today waterline (operating, reserved, free to spend, last reconciled), Spending shape, Goals, Contributions, Record rows. |

At 320 and 390 the chip rail scrolls horizontally under the pinned "Tools" chip (Accounts is part-visible, Calendar/Books are reached by swipe, arrow keys or scrolling the rail).

### The three dressings on Today at 390
| File | What it shows |
| --- | --- |
| `dressing-classic-today-390.png` + `-end` | Classic ledger. |
| `dressing-taylor-today-390.png` + `-end` | Taylor's scrapbook page (washi tabs, handwritten kickers). |
| `dressing-newfoundland-today-390.png` + `-end` | Newfoundland fisherman's log (rope rule, typewriter subtitle). |

### The personal Desk
| File | What it shows |
| --- | --- |
| `personal-desk-today-320.png` | My Desk at 320 via the header's space switch (My Money): the personal seals and the first plate, with the personal house bar. |
| `personal-desk-today-390.png` | My Desk at 390: "Personal income this month" seal row (Money in / Money out / Leftover, all a known $0.00 in the demo) and the plates beneath. |
| `personal-desk-today-1100.png` | My Desk at 1100: seals, "How my month is running", Am I on the clock, What a shift is worth, When money lands next, My cash against my cards (the six plates run on below the fold), Hercules's corner. |
| `personal-desk-taylor-1100.png`, `personal-desk-newfoundland-1100.png` | The personal Desk in Taylor and Newfoundland at 1100 (top frame only — lightly covered). |

The personal Desk scrolls with the document rather than inside a stage, so it has no `-end` frames; the lower plates are below the fold in these frames.

### Keyboard, drawer, loading, device tier
| File | What it shows |
| --- | --- |
| `focus-chip-rail-390.png` | Keyboard focus on the chip rail: focus placed on the Today chip, then ArrowRight: Leaving is focused and selected (roving, selection follows focus) with a visible 2px solid focus ring. |
| `drawer-open-390.png` | The "Tools" chip opened the quick-sheet drawer ("All tools", `role=dialog`) with every place and tool. |
| `loading-frame-390.png` | The lightweight flat loading frame (`data-court-flat=loading`: "The Village Square is being built") that stands while the lazy world arrives after choosing a member. |
| `no-webgl-lands-on-desk-390.png` | A browser launched with WebGL/3D APIs disabled lands on the Desk by itself (tier `flat`, Desk status `flat`). |
| `defect-before-fix-header-under-status-390.png` | **Before f705cf2**: in steady state (Desk opened directly, e.g. reload with the simple view remembered) the App's Status Centre strip and Development pill floated over the Desk header, covering the Harbour flip button and the title. Fixed in f705cf2 (`.harbour-world .desk__header` clears the chrome); every other Desk frame here is after the fix. |

## Not captured, and why

- **The page-turn leaf mid-flight**: the leaf lives 500 ms and SwiftShader screenshots at 1100 take longer than that to land; its presence is proved by the observer record, not a picture. Real-phone feel of the turn is unverified.
- **The fallback state** (`status=fallback`, "The Harbour could not be drawn here" with the Harbour button disabled): not reachable from a browser. Disabling WebGL yields the **flat tier**, not a failed draw. Fallback copy is covered by unit tests only.
- **The Sitdown dog-ear** and a **non-cracked Leftover seal**: the demo month did not raise the dog-ear and its Leftover is negative, so only the cracked state is shown.
- **Live 3D world on a real device / the kitchen URL**: this is local branch evidence, not deployed or live-verified.

## Observations for review (not fixed here)

- **No-WebGL devices show a live "Simple view" flip while already on the Desk.** In `no-webgl-lands-on-desk-390.png` the bar's flip reads "Simple view $0" (edition `illustrated`, figure `known`) and the Desk header's Harbour button is enabled, because the Desk status is `flat` (tier), not `fallback`. Pressing either only rewrites `hearth:motion`; the device still cannot draw, so nothing visible changes. Consider treating the no-WebGL tier like fallback for the flip controls.
- **Personal house bar at 320/390**: the "Hercules" and "Status" items sit higher than "My house" (text-only vs icon+text) — see `personal-desk-today-320.png`. At 1100 the floating Hercules "How can I help?" bubble overlaps the left of the Status Centre strip (`personal-desk-today-1100.png`).
- The first Desk frames after entering the demo show extra space above the header: a transient App command chip sits above the stage on first entry. It is gone after a reload (the steady state).
