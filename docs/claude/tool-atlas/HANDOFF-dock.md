# HANDOFF — Track B1: the dock (strip band, three-line camp card, day ledger)

Branch `claude/tool-atlas-dock` in `/home/claude/jonathanbeaulne123-blip/wt-dock`, from `main@4e0234a3`. Local commits only: nothing has been pushed, merged or deployed.
Risk: **Medium**. The change is read-only UI over existing selectors: no command, schema, sync or money-meaning change.

## What I built

| File | What it is |
|---|---|
| `src/harbour/glass/dayLedger.ts` | A **pure** read model (CONTRACT rule 19). `dayLedger({household, memberId, space, today, from, to})` returns, for each day: **coins** (posted entries), **slips** (unpaid bills: name, amount, pot, recurrence id, overdue), **pennants** (paydays), the **flagstone** (the Sunday that ends each week), the **Sitdown** flag (the Charter's weekly cadence), the Chapter's **station gate**, plus `coveredTo`, `chapterClose` and `sitdownWeekday`. It also exports `stripLedger`, `stripRange`, `leavingNext`, `dayMarkers` and `viewForSpace`/`spaceForView`. It reads only the Calendar pipeline (`calendarPresentation → buildMonthBoard → calendarWeight`, the same pipeline as the Desk's `readRail`), `isOutgoingBill`, `paydayTicks`, `fundSnapshot` (for the pot), `openChapterFor`/`chapterReminder`/`pendingChapterClosure` and `monthForecast` (the Fund horizon). It has no storage and no memo. |
| `src/harbour/glass/stripKeys.ts` | The strip's keyboard model, as a pure function. |
| `src/harbour/glass/campCardModel.ts` | The card's read, pure. It reuses `todayModel` (`readSnapshot`, `deskPots`, `readSeals`, `readWalk`, `readHercules`, `readSitdown`), `personalModel.readPersonalToday`, `presenceLines` and `shiftPostingStreak`. It exports `readLine3`, `readNeeds`, `readSince`, `readCardLeaving` and `readHerculesLine`. |
| `src/harbour/glass/copy.ts` | Every word on the dock (`WORDS`, `dayName`, `longDay`…), in one table. |
| `src/harbour/glass/StripBand.tsx` | The 40 px band. It is **one** Tab stop (a `grid` with `aria-activedescendant`) and **one** tap target on the phone. The "‹ August" and "September ›" tabs are pointer targets; keyboard users reach the same months with PgUp/PgDn. The silhouettes are inline SVG shapes (pennant, slip, chairs, coin, gate, and a diamond for today). |
| `src/harbour/glass/CampCard.tsx` | The three 44 px lines and the grab handle, plus the full card. The `dock` variant has one `h1`, one Tab stop and rows that rove with ↑/↓/Home/End. The `page` variant (the Desk) uses normal tab order and `h2`/`h3`. It has one `role="status"`, empty at load: it says "Showing Mine" when the pill changes and announces "Since you were here" at most once every 30 s. |
| `src/harbour/glass/CardParts.tsx`, `Markers.tsx` | The pot, seal and plate pieces (the Desk's markup and hooks), and the SVG silhouettes. |
| `src/harbour/glass/Dock.tsx` | The strip and the card together on the glass. The root has `data-camera-deadzone` and `touch-action: manipulation`. Nothing in it calls `preventDefault` or captures the pointer. Its props are `night`, `calm` and `lite`. |
| `src/harbour/glass/glass.css` | The glass: `.80` day and `.82` night with `blur(10px)`, ink by dressing, and secondary text `#5A4A3C`. It goes solid (`#F6F0E4`, no blur, a 1 px `#8A7A69` outline) under reduced transparency, reduced motion, more contrast, forced colours, `[data-calm]` and `[data-lite]`. Focus is a two-tone ring drawn with `outline`. The layout is 216 px on the phone, a 300 px right column in landscape and a 360 px bottom-left column on desktop. |
| `src/harbour/desk/DeskToday.tsx` | This is now **the same `CampCard`** (the `page` variant, open) over the same `stripLedger` → `campCardModel`. |
| `src/harbour/desk/todayModel.ts` | The Hercules door words now use the Atlas vocabulary: "Open the Cellar", "Open the kitchen table", "Open Status in Settings". |

## Wiring App.tsx needs (the integrator)

```tsx
import { Dock } from "./harbour/glass/Dock.tsx";
import { stripLedger, spaceForView, viewForSpace } from "./harbour/glass/dayLedger.ts";
import { campCardModel } from "./harbour/glass/campCardModel.ts";

const space = spaceForView(view);                                  // "household" → "ours", "personal" → "mine"
const [stripMonth, setStripMonth] = useState(monthKeyFromDateKey(today));
const [cardOpen, setCardOpen] = useState(false);
const nowLedger = useMemo(() => stripLedger({ household, memberId, space, today }), [household, memberId, space, today]);
const stripShown = useMemo(() => stripMonth === monthKeyFromDateKey(today) ? nowLedger
  : stripLedger({ household, memberId, space, today, month: stripMonth }), [nowLedger, stripMonth, ...]);
// The CARD always reads the current month (nowLedger), even while the strip looks back at August.
const card = useMemo(() => campCardModel({ household, memberId, space, today, ledger: nowLedger, reading, since, firstVisit, keyboard }), [...]);

<Dock night={sceneIsNight} calm={comfort.quiet} lite={tier !== "full" || saveData || frameBudgetMissed}
  strip={{ ledger: stripShown,
    onOpenCalendar: date => openCalendarSheet(date),        // Calendar sheet at that day's week
    onOpenSitdown: date => openWeeklySitdown(date),        // the weekly Sitdown ("two chairs"); today: openHouseObject("plan-studio")
    onMonthBack: () => setStripMonth(m => shiftMonthKey(m, -1)),
    onMonthForward: () => setStripMonth(m => shiftMonthKey(m, 1)),
    onMonth: setStripMonth,
    perDayHits: viewportWidth >= 1100 }}
  card={{ model: card, space, onSpaceChange: s => setView(viewForSpace(s)),   // the App's own view switch; closes nothing
    expanded: cardOpen, onExpandedChange: setCardOpen,
    onOpenBank: () => openHouseObject("queen"),            // the Fund bank panel
    onOpenCellar: () => openHouseObject("cellar-bills"),   // the Cellar panel
    onOpenCalendar: date => openCalendarSheet(date),       // Mine's "Leaving next"
    onOpen: (target, object) => openHouseObject(target, object), // targets used: plan-studio, queen, books, shift, loft-banks(+"bank/plan:protect"), cellar-bills, more, wardrobe, hercules
    onRecord: () => openRecordFlow("shift", { ledger: "personal" }), // D1: Shift defaults to Mine (track B2's dial / existing Add)
    onTalk: openHerculesPanel, onOpenBooks: openBooksSheet,
    onStepIn: stepInAtCamp, onWhatChanged: () => openBooks("activity") }} />
```

- `since` is this viewer's last visit, as an ISO instant. Keep it per viewer, for example `hearth:dock:lastSeen:<memberId>`. Read it before you write the new value; without it, line 3 falls back to the partner's plan agreements. `firstVisit` is true when no such record exists. `keyboard` means the last input was a key.
- The orbit controller must ignore any `pointerdown` that starts inside `[data-camera-deadzone]`. The Record and All tools bubbles sit at `bottom: calc(216px + 12px)` on the phone. The open card is not modal; decide whether the map goes `inert` while it is open.
- `DeskPageProps` has no space switch, no Step in and no Record. On the Desk: the header keeps the pill; Step in goes to `onOpen("journey")`; What changed goes to `onOpen("books")`; Shift goes to `onOpen("shift")`. Add props to `DeskPageProps` if you want these routed exactly as on the island.

## Commands called

None. The dock only calls navigation callbacks, and money still moves only through the existing Add flows and Final Confirm. `glass-day-ledger` asserts that nothing in `glass/` imports `core/commands.ts`, the index, the kitchen, the ledger, supabase or the App, and that nothing touches storage or `fetch`.

## Tests

- **New files, 54 tests, all passing:**
  - `glass-day-ledger` (14): range; coins match `readRail` coin for coin; slips, pennants, chairs, gate, Covered to; unknown member; purity; the import fence.
  - `glass-strip-band` (11): the keys of §4.1; one Tab stop; stone names; distinct shapes; one tap versus per-day; no `preventDefault`.
  - `glass-camp-card` (15): line 3 priority; since, first visit, keyboard and quiet; the pill and "Showing Mine"; roving; full card; Escape; the 30 s throttle; Mine.
  - `glass-dock` (10): the dead zone; 2 of the 5 home stops; no `preventDefault`; the CSS fallbacks, tints, dressings, focus ring and sizes; no `#8A7A69` as text.
  - `glass-vocabulary-fence` (4): retired words; Record, jar and pot rules; the brief's sentences verbatim.
- **Existing tests updated because Today changed shape:**
  - `desk-shell`: the sundial test now checks line 2.
  - `desk-unknown`: the name is now the visible label, not "Everyday, now:".
  - `desk-little-things`: the dog-ear is now Needs you.
  - `desk-today-harvest`: the post section now covers Needs you, Since you were here and no reading.
  - `harbour-source-fences`: `glass` is allowed as a harbour directory.
- **All glass and Desk suites together: 138 of 138 pass.** That covers desk-shell, unknown, little-things, harvest, personal, personal-app, routing, plates-dom, leaving, calendar-books, desk-source-fences and harbour-source-fences.
- **`terms.test` and `copy-budget` still fail, but not because of this work.** The failures name `App.tsx` and `DeskAccounts.tsx`, and none name `glass/` or `DeskToday`.
- **tsc:** see the result at the end of this file.

## The three dressings

`glass.css` styles:
- **Classic** is the default: porcelain `#2E241B` with a chalk edge.
- **Taylor** is `:root[data-theme="taylor"]`: vellum `#49323D`, a washi corner `#e8a6bd`, a dashed deckle edge, and a lamplit cream `#f3e3c8` at `.82` for night.
- **Newfoundland** is `:root[data-theme="newfoundland"]`: `#273E41`, a 1.5 px `#f5f3ea` white frame, Figtree caps on the pill and tabs, and `.84` at night.

Night is `[data-night]` or `:root[data-scene-lighting="dark"]`. On the Desk, the card's `desk-*` pieces keep the Desk's own `desk-dressings.css`.

## Uncertainty and deviations (please read)

- **"Covered to" comes from the Fund horizon (`monthForecast`).** The demo horizon refuses ("Repeated goal claims exceed the remaining target"), so the demo shows no "Covered to" rather than a guess. The Prepare pot's "Bills covered through …" line is a different figure (`fundSnapshot`) and stays where it was.
- **Money uses the existing `engravedCents`/`formatCad`,** which prints `$1284.50` rather than the brief's `$1,284.50`. I did not add a second formatter.
- **"Leaving next" reads the strip's slips** (the calendar board's bills), so the card and the band always agree (A6). The Desk's Leaving page reads the Fund's `nextOut`, so a card-paid bill can differ between the two.
- **The sundial, the dog-ear and the mailbox are gone from Today.** They fold into line 2, Needs you (a Campfire Chapter, a Fund pulse) and Hercules's line. `DeskPersonalToday.tsx` is now unused; it is not my file, so I left it for you to delete. `readPost` is still exported and tested.
- **Mine's line 1 is "On the clock"**, because the brief does not name line 1 for Mine. Needs you checks, in order: presence waiting on me, then the Campfire, then the Fund pulse.
- **The first-visit keyboard sentence keeps "Drag…"** because that is the brief's literal text; this is in tension with A27.
- **Two targets are drawn smaller than 44 px.** The handle is drawn at 32 px and its hit box reaches 12 px into the safe inset. The pill options are drawn at 38 px with a 3 px hit extension on each side. Check both on a device.
- **Two things are not built.** The Newfoundland `feDisplacementMap` ripple (the frame is static) and the "What changed here" receipt list (SCALES §6.3); that button is just a callback.
- **No browser or screen-reader pass.** There are no 320, 390, 720 or 1100 px screenshots in this track; the integrator's evidence pass owns that.
- **Commit trailers use this session's attribution line** (Claude Opus 5.5), not the brief's "Fable 5.1".

**Budget delta (5):** +2. Zero-tap Leaving next and an explicit day ledger mean one read of every day for the strip, the card and the Desk, with no new money meaning.
**Engagement delta (3):** +2. The camp card's Since you were here, Needs you and "Shift tonight? Record it here." give a reason to open home that comes from real household acts.

## tsc

`node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit` (the `pnpm typecheck` command) exited 0 at the final commit tree, including every new test file.
