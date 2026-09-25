# The Horizon — SCALES: the Journey map and the living world

Version 1.0 · 25 September 2026 · Jonathan's brief: "Connect the Journey Map and the Living World" (verbatim in `inputs/journey-brief.txt`) · Grounded in the repo at `main@cc1aab6` (#543 "Seamless cloud zoom") · Visual and rule reference: Jonathan's "Our Path — Living World" prototype (`inputs/our-path-living-world-prototype.html`), which he says should guide the final product without swaying the design

This file defines the relationship between the Journey map (the everyday budgeting interface) and the detailed world (the same place, explorable). It refines CONTRACT §4, LIGHT §2, the pass briefs and the Grand Plan where they assumed the square was the first screen. Read it after CONTRACT and before any pass that touches the Journey, the first screen, the zoom or the world overlay.

The sentence that governs everything here: **the Journey map is not a menu leading to the app; it is the app at its most useful scale, and the world is that same experience when you step inside.**

---

## 0. What exists today (facts, so the proposals are honest)

| Thing | Today (file) | Keep / change |
|---|---|---|
| Journey geography | A *generated* island per era: months on a golden-angle spiral (`src/path/grow.ts:47-52`, slot = ordinal % 120, appending never moves a month), coastline radius from month count, coves/meadows/dry patches/creeks/frost *grown* from 18 month-scores (`src/core/pathSignals.ts`, `pathWorld.ts` recipes). Deterministic, grown on read, nothing stored (`grow.ts:5-11`). | **Change the geography, keep the meaning layer.** The Horizon is the geography; the month-scores and recipes keep their semantics but paint *beds on fixed sites* instead of growing land (§3). |
| Eras | past/current/future/sketched (`src/core/pathEras.ts`); past eras are separate islands at 0.42 scale on a ring; future eras rock islets; gate lanterns from finish rules. | **Keep eras; change their geometry** to gates on the Year Walk (§3.4). Finish rules untouched (D-268 stays Jonathan's call). |
| Simple view ("mini") | Day/Week stepping-stone path with Prepare/Protect/Build lanes, month ring, Sitdown gate; a date cursor with five levels; WebGL with SVG fallback (`src/path/mini/*`). | **Keep as the timeline strip** docked to the map (§4.2); its SVG twin stays the flat equivalent. |
| Weather from money | Future bills → clouds, a big bill → storm, paydays → sunrise, Fund below cushion → mist (`src/core/pathWeather.ts`). | **Retire on the Horizon** (D18). It contradicts CONTRACT §2.2 and LIGHT (real sun, calendar almanac). The information moves to explicit markers on the timeline strip and the calendar (§5). |
| House condition | settled / growing / wilting / weathered from Fund coverage, shown as moss or words (`src/core/houseCondition.ts`). | **Keep the words; confine the visual to the household's own things** (the camp, the beds), never the island (D19). |
| Kitty Banks | Sculptures with step 0–10 on the Journey island; coins fly on step change. | **Keep; relocate** to the Fund bank's plaza in Little Harbour, ≤ 6 (§5). |
| Corrections | Map derived purely from current state; reversals/refunds re-attributed to the original receipt's month (`pathSignals.ts:60-105`); reopening a month removes its kerb. | **Keep derive-on-read as the law** (§6). Add the "what changed" explanation (§6.3). |
| The zoom | A 520 ms cloud crossfade over a route swap (`src/path/JourneyCloudTransition.tsx`); Harbour unmounts; only the anchor month's date carries across; only the current month may zoom in (`harbourJourney.ts:18-31`). | **Keep as the fallback** (reduced motion, slow load, no WebGL); **build the continuous zoom** on shared coordinates (§2). |
| First screen | The Court (`harbour/nav/arrival.ts:49-56`); the Desk when flat. | **Change: the Journey map is home** (§1). The square is one zoom away and is where "step in" lands from the default framing. |
| Tools from the world | `TARGET_NAMES` → `HOUSE_TARGET_PLACES` → a tool over the world with "Put it back"; QuickSheet lists all tools; the Harbour bar. | **Keep**; add the compact panel tier (§4). |
| Money boundary | Only `captureCommand` in `src/core/commands.ts` writes; path/era commands post nothing; reads declare "never writes". | **Unchanged**, and made a static test (§6.4). |
| The Living World prototype (not in the repo) | A low-poly island with named sites that keep their identity while their *geometry* changes: the kitchen garden matures with qualifying food weeks (trailing 24, one credit per week); "a place in the making" becomes "the ready pavilion" at 100 % backed ("fully backed is not bought or experienced"); the timber crossing loses planks under confirmed strain and is repaired on the same site; stages Healthy → Strained (3 consecutive eligible strain days) → Damaged (28) → Recovering (2 clear days: plants first, then timber, then stone); clearance < 0.25 × daily need with no arrears; incomplete evidence freezes wear and repair; corrections replay; every site answers "why is this here"; the home anchor never wears; "water, not punishment"; "income is not a beauty score"; same seed + same history = same world. | **Adopt its principles for the household's own sites (§3.3b) and its look for L0/L1 (STYLE §1.15).** Its coast erosion is not adopted (CONTRACT §2.2). Its calibration numbers are proposed product settings, Jonathan's call (D24). |

---

## 1. The Journey map is home

- **Sign-in lands on the Journey map**, low-poly Horizon, at *Region* level, framed from the south-east so Little Harbour and the square are nearest the camera and the Crown stands behind: the same composition as Sketchbook page A, seen from above. The current month's **camp** (§3.2) is lit wherever it is on the island; the **camp card** (§4.1) is docked at the bottom.
- From this view a person can do everything the Desk's Today page does now, plus every tool: check what is leaving and when, record a purchase, open a book, move a bill, talk to Hercules, see what changed since last time. Nothing ordinary requires stepping in.
- Stepping in is one gesture away (zoom past *Up close*, or "Step in") and is a change of scale, not a screen change (§2). Stepping out returns to the same place at the same period.
- The flat/Reading edition remains the Desk; its Today page and the Journey's SVG twin (`MiniFlat`) read the same overlay (§7). Access to the finances never depends on WebGL, motion or a gesture.

Refinements this makes to earlier decisions: D2's "the square is the first screen" becomes "the square is the first *world* screen"; pass 03's Little Harbour brief and LIGHT §2's line about golden hour now describe the map's default framing *and* the world arrival; pass 00's WorldDefinition loader gains the overlay (§3.1); the Grand Plan's Chapter 3 is amended.

---

## 2. One place at two scales

### 2.1 Shared coordinates
Both renderers draw **the same WorldDefinition v3** in the same coordinate space (CONTRACT §3): same origin, same north, same `scale.factor`. The Journey map is the Horizon at **LOD 0**; the detailed world is LOD 2–3 with streaming. There is no second island, no second grid, no second map data. `grow.ts`'s coastline, coves and noise are not carried over.

### 2.2 Levels of detail (what each tier draws)
| Tier | Draws | Budget (full / lite) |
|---|---|---|
| **L0 Sky** (whole island) | Heightfield decimated to ≤ 1/8, coast simplified to ≤ 400 vertices, water as flat cards, roads and the Year Walk as ribbons, districts as soft tints with labels, the seven hosts as landmark cards, stations as bed clusters (beds beyond three years collapse to one stack card), the Lamp, the Crown, the dam. Real sun and sky (LIGHT). | ≤ 40 k tris, ≤ 60 draw calls / ≤ 25 k, ≤ 40 |
| **L1 Region** (a neighbourhood) | L0 plus every bed as its own card, station waymarks, kitty sculptures, gates, the camp tent, the bigger structures (bridges, towers, dam) as single cards. | ≤ 80 k / ≤ 45 k |
| **L2 Stop** (a station or a host) | The detailed world's district at its lite tier, streamed. | CONTRACT §6 |
| **L3 Up close** | The detailed world, full tier where the device allows. | CONTRACT §6 |

L0 and L1 are built from the same baked terrain asset as the world (pass 1 bakes both LODs; `GEOGRAPHY_REVISION` keys both) and from the same kit (pass 2b supplies the low-poly variants of the host cards, bed cards, waymarks and gates).

### 2.3 The camera is one controller
- One orbit controller with a target on the terrain and radii per tier: Sky ≈ the island's diagonal, Region ≈ 250 eu, Stop ≈ 80 eu, Up close ≈ 25 eu; below Up close the target snaps to the nearest apron or bed and the controller hands to the world's Look camera, then Walk (Mountain v2's `director.ts`). Zooming out reverses the same path; `entersJourneyFromZoom` (`worldZoom.ts`) becomes a tier change, not a route swap.
- Landmark positions, orientation and selection survive the change of scale because they are the same objects: what you tapped at Region is what you are standing beside at Up close.
- The cloud crossfade (#543) stays for: reduced motion, no WebGL, and any tier load that exceeds 400 ms (the cover hides the pop; the reveal waits for readiness as it does now).
- Alignment rule: the world's arrival shots (page A and the door-facing arrivals) are the *end states* of a zoom-in, so the zoom lands on them exactly; the town-arrival signature shot is the Little Harbour zoom's last frame.

### 2.4 What stays open and simple
No filler. The map at L0 shows the island the Grand Plan drew and nothing more: seven hosts, twelve stations, the reserves as hoardings, the Lamp. Every feature reaches the map through a host, a station, the timeline strip or the quick layer, never through a new building.

---

## 3. One authoritative household state → one shared world model → two visual representations

### 3.1 The model
```
HouseholdState + History  ──(derived on read, pure)──►  WorldOverlay  ──►  Journey renderer (L0–L1)
        │                                                    │            ──►  World renderer (L2–L3)
        │                                                    └──────────►  Desk / MiniFlat (text and SVG)
        └── WorldDefinition v3 (authored, versioned)  ── the ground everything stands on
```
- **WorldDefinition v3** (CONTRACT §4) is the stable geography: coast, terrain, water, roads, hosts, neighbourhoods, structures, reserves, the sky, the Undercroft, and now the **Year Walk with its twelve stations** (§3.2).
- **WorldOverlay** is a pure function of household state and history, recomputed on every change exactly as the Journey is today (`grow.ts` principle: "nothing about the land is stored or synced"). It contains: beds (one per month of history, with their cards), the camp, era gates, kitty sculpture steps, plan signposts, stamped-week lanterns, kept-memory flags, the household's found lanterns (the Hunt), the condition words, and the timeline strip's data. It never contains geometry that moves the ground.
- Both renderers and the flat edition read the same overlay. They can summarize differently (L0 shows a bed's dominant card; L3 shows the bed's twelve plants), but they never disagree on what exists, where it is, what state it is in, or why.
- Presence and the partner: the overlay is per household; both partners see the same beds because the same facts derive them. Nothing is counterfeited (CONTRACT §2.3).

### 3.2 Stable geography: the Year Walk and its twelve stations (new, in `MANIFEST.json → journey`)
A trail through all seven neighbourhoods in calendar order, one **station** per month, placed where the island's real season is strongest (LIGHT and the bloom calendar decide):

| Month | Station | Where | Why there |
|---|---|---|---|
| Jan | the Shoulder | [1330,640] | snow, sledding, the summit walk |
| Feb | Lakeside | [1255,860] | ice on Stillwater, the skipping shelf |
| Mar | Scholars' floor | [700,470] | the woodland floor thaws first; bloodroot |
| Apr | the Green (west) | [860,980] | first grass; dandelions; kites nearby |
| May | the Hollow (west rows) | [960,640] | apple blossom |
| Jun | Long Sands | [950,1445] | lupines; the Campfire is here |
| Jul | the Flats | [380,800] | coneflower, thermals, the strip |
| Aug | the Reach | [1230,1290] | monarchs, Joe-Pye, the boardwalk |
| Sep | the Hollow (east rows) | [1040,650] | apples |
| Oct | the north pass | [800,300] | maples red |
| Nov | the Prow | [1570,940] | the first storms, the Lamp's beam |
| Dec | Little Harbour | [1475,1230] | Lantern Row, the Chapter at home |

- Each station is a **garden of beds**: one bed per month-year (3 × 2 concept metres), laid in an authored order (row one faces the sun; ten beds per row; a second row after ten years), plus a waymark post carrying the month's name and the year count. Beds are never taller than a bench, so stations inside protected or scenic land are allowed.
- **Identity rule** (kept from today): `site(monthOrdinal) = station(month) + bed(yearIndex)`. Appending history never moves an existing bed. Extending history backwards (importing older months) fills earlier beds at their own station; nothing regenerates.
- The Year Walk is a **bed in pass 1** (profile `walk`, reusing existing walks and trails where they coincide; link segments authored). Stations get graded pads in pass 1 and their bed cards in pass 2b.
- **The camp** stands on *today's stone* on the current month's stretch (see `TIME.md` §1.3: the Year Walk is a road of day-stones; a month is the stretch to its station). The station's bed forms as the month is walked and is edged at the Chapter close, when the camp walks on. The camp card (§4.1) reads from today's stone. In June the camp is at the Campfire, which is where the Chapter closes; in other months the Chapter still closes at the Campfire (C02, unchanged) and the closed month's bed receives its cards.

### 3.3 Evolving geography (the household's, additive, slow)
- Beds fill month by month. A bed's **cards** are the month's summary in the kit's language, from the same 18 scores and recipes that exist today, translated from land brushes to bed plantings: bloom meadow → the bed blooms; fertile soil → dark earth and seedlings; dry patch → bare earth with a mulch; grove → a sapling that becomes the station's tree after three consecutive months; monument → a small stone; lanterns → a lantern per stamped week (≤ 5, as today); bench → a bench; pond → a birdbath; ribbon tree → ribbons on the station's tree; loop → a hoop; rows → rows; star → a star on the waymark; eternal fire → the Campfire's ring keeps a coal. Cove, wider road, café lights, storm creek and frost are retired or re-expressed (D20 lists which).
- **Era gates**: an era's end places a gate (two posts and a lantern) on the Year Walk at the bed where it ended; the gate's lantern follows the finish rules as today. The walk ahead of the current bed is **unbuilt**: stakes and string, the same language as the reserves, so the future reads as "not yet" rather than as land that doesn't exist.
- **Kitty sculptures** stand on the Fund bank's plaza (≤ 6, step 0–10, coins fly on a step change as now). **Plan signposts** (agreed decisions, today's road forks) stand at the station of the month they were agreed. **Kept memories** fly as flags at their month's bed. **Found lanterns** hang in the Lantern Cave and are lit at night (pastimes).
- Households become distinct through their beds, their gates, their sculptures, their flags and their found lanterns, on an island that is the same for everyone. No transaction rearranges anything larger than one bed.

### 3.3b The homestead: the household's own sites (from the prototype)
Time lives on the Year Walk; the household's *everyday life* lives at the **homestead**, the land around Our home in Little Harbour (its garden, the yard, the lane down to the quay, the household's own footbridge over the town channel, and the Boathouse dock). The homestead is where the prototype's category sites stand, on authored pads inside the harbour district, each with a stable id and a "why is this here":
- **The kitchen garden** (food): maturity none → trace → cluster → established → district from qualifying weeks in the trailing 24, one credit per week (repeated purchases in a week add nothing).
- **The landing** (income): cargo on the Boathouse dock when income arrives; never a beauty score.
- **The workbench** (making): the kiln's shelf and fired pieces as today; cosmetic only.
- **A place in the making → the ready pavilion** (a goal): stakes and string while backing; a finished pavilion at 100 % backed; a *memory* only when the kept memory exists. Fully backed is not bought or experienced.
- **The reserve basin** is `L01` (already the island's only instrument); using the buffer shows as water in the basin, never as damage.
- **The timber crossing**: the household's footbridge on the lane; the one site where physical wear shows (§5, condition row).
- **The home anchor** (the house itself) never wears, never moves.
The homestead's pads are cut in pass 1 (Little Harbour's slope), its cards built in pass 2b, its logic in pass 02c. On the Journey map it is the most detailed square metre of the island, which is right: it is where people look every day.

### 3.4 Changing detail (fast, reversible, explicit)
- The **timeline strip** (§4.2): the current stretch drawn straight, from the one day ledger (`TIME.md` §1.4–1.5); levels day/week/month/year/era.
- The **camp card**: Everyday now, Prepare/Protect/Build, what is leaving and when, what changed since last visit, Hercules's corner, the condition words.
- Amounts, dates and labels are always text. The world complements them; it never replaces them.

---

## 4. Interactions: four tiers, chosen by the task

### 4.1 Tier 0, glance (no tap): the camp card and the map itself
- The camp card is docked at the bottom of the map at Sky and Region (collapsible to one line; remembered per viewer). It is the Desk's Today page, re-cut for the map: **Everyday · now** big, Prepare/Protect/Build, the month's three wax seals, "since you were here", the Level, Hercules's corner. Same read models, same words.
- On the map: hosts show a one-word state label at Region (the bank: "Fund · checking" or the accepted balance; the Kitchen: "Plan open"; the Boathouse: "2 wishes"); stations show the month name and year count; the camp shows the month. Nothing on the map is a number you have to infer from a tree.

### 4.2 Tier 1, on-map direct actions (spatial where it improves understanding)
- **The timeline strip**: today's mini view docked along the bottom edge above the camp card; drag it to move the date cursor (day/week/month); the map follows (the camp marker slides along the Year Walk to the shown month; later beds turn to sketch). It is the "flows with purchases and time" surface, kept explicit.
- **Move a scheduled bill**: drag its marker on the strip to another day → a confirm sheet → the existing command. Spatial, because a bill's place in the month is what you are reasoning about.
- **Tap a bed**: its month card (the month's summary in words and amounts, and "what changed here", §6.3).
- **Tap a host**: its compact panel (tier 2). **Tap the camp**: the full camp card. **Tap Hercules** (he wanders the map too): his corner opens as a bubble (tier 2), never a transition.

### 4.3 Tier 2, compact location-linked panels
A panel anchored to the thing you tapped, one screen-third at most, with the two or three things you most likely want and one button to the full tool:
- **Fund bank**: accepted balance and as-of; the last three moves; "Record" and "Open the bank".
- **Our home**: Kitchen (plan: this month's recipe card, "Open the Plan"), Loft (Kitty Banks with steps, "Open the banks"), Cellar (the next three bills, "Open the Cellar"), Atlas (this era, "Open the Atlas").
- **Library**: the Standing Book's headline and "Open the books". **Glasshouse**: pots by state, "Open the planner". **Studio**: the shelf, "Open the studio" (the world). **Cottage**: Hercules's looks, "Visit" (the world). **Boathouse**: wishes, memories, letters counts, "Open".
- Hercules's brief conversation is a tier-2 bubble. Entering the Pottery Studio, the Cottage, the Campfire ritual and the Atlas nook are world experiences (tier 3/4) by design; their panels say so.

### 4.4 Tier 3, working surfaces, and tier 4, deep tools
- Tier 3: a sheet over the map (the map dims, stays where it was): Books, Calendar, the Planner, the Kitchen wizard, the Plan Studio. The sheet has a "Put it back" that returns to the exact map state.
- Tier 4: full-screen tools and the detailed world itself ("Step in"). Today's `houseTargetRoute`/"Put it back" continuity applies.
- **Persistent access** (the quick layer, unchanged in spirit): the bar carries Record, Calendar, Books, All tools, the Illustrated/Reading flip, and "Step in / Step out". Nothing else surrounds the map.
- **Rule of thumb** written into the brief: inspect or change one thing → tier 1 or 2; review a period or a ledger → tier 3; make something, meet someone, close a chapter → tier 4.
- First visit: the camp card's first line explains itself ("This is your month. Tap the island to look around; pinch to step in."); an outline pulse on the camp, once. Daily return: the map opens where you left it (§7), the strip on today.

---

## 5. Meaningful, traceable, reversible world changes

**Existing behaviour is marked (E); proposals (P).** Every row: what the Journey map communicates, how the world expresses the same change, when it becomes visible.

| Change | Journey map (L0–L1) | Detailed world (L2–L3) | Visible when |
|---|---|---|---|
| A purchase is recorded | (E) the month's scores recompute; (P) the current bed's dominant card may change; the strip's day marker gains the entry; the camp card's Everyday updates; amounts explicit | (P) the same bed at the camp gains or changes one plant card; the world's bank plaque and the Fund basin (`BasinReading`) update as they do now | on the next render after the command's `CommandOutcome` (immediately); the change is listed under "what changed here" |
| Income arrives | (E) payday marker; (P) on the strip as a sunrise marker, not in the sky (D18) | (P) a pennant raised on the camp's waymark for that day | immediately |
| Goal progress | (E) kitty sculpture step 0–10; coins fly; (P) at the bank plaza | (E/P) the Loft's Kitty Banks remain the truth; the plaza sculptures are their reading | immediately; step changes only on confirmed contributions (E) |
| A plan is agreed / completed | (E) agreed decisions → forks; (P) a signpost at the month's station; the Kitchen's compact panel says so | (P) the same signpost at the station; the Glasshouse pot goes to bloom (E, planner state) | immediately |
| The month closes (Chapter / books) | (E) together +0.3, learning, kerb; (P) the bed's cards are settled, the waymark's year count ticks, the camp moves to the next station | (P) the Campfire's ring keeps a coal; the closed bed's plants settle; the next station's tent goes up | on close (E); moving the camp is a 1-second card animation, a cut under reduced motion |
| Time passes | (E) months append; (P) the walk ahead loses one stake; the real sun and season move (LIGHT) | (P) the same; bloom by date | daily; the sun every 60 s |
| An era ends | (E) finish rules; (P) a gate on the Year Walk with its lantern | (P) the same gate, walkable through | on the era command |
| Condition (settled/growing/wilting/weathered; the prototype's Healthy/Strained/Damaged/Recovering) | (E) words; (P) the words on the camp card, and physical wear **only on the homestead's timber and plants**: the timber crossing loses planks, the garden wilts, the fence sags; repaired on the same site, plants first, then timber, then stone (D19, D24) | (P) the same crossing, the same missing planks, walkable with care; never moss, erosion or weather on the island | only on eligible evidence (Fund reading current, reconciled, bank-checked, as today); three consecutive eligible strain days before any plank goes; incomplete evidence freezes wear and repair ("uncertainty is not failure") |
| A wish, a memory, a letter | (E) counts in the Boathouse projection; flags for kept memories | (P) the flag at the bed; the Boathouse stations as now | immediately |
| A pottery piece is fired | (E) kiln warm 30 days; `fired` on the piece | (E) the shelf; (P) the kiln's smoke card | immediately; never a currency or unlock (E, kept) |

Rules that stay explicit in the brief: planned is not purchased (a plan shows a signpost, never a plant); scheduled is not paid (a bill on the strip is a marker until posted); preparation is not a memory (a memory flag needs a kept memory object); Hercules keeps `herculesActionPolicy` and `postedExactlyOnce`; no rule here assigns a judgment to spending (a bare-earth bed is a summary of essentials share, with its number on the card, as today's dry patch is).

---

## 6. Corrections and provenance

### 6.1 The law: derive on read
The overlay is a pure function of state and history, recomputed on every change, never appended. Editing, deleting, refunding or reclassifying a transaction changes the *inputs*; the bed re-derives. Reversals and refunds re-attribute to the original month, as today (`pathSignals.ts:60-105`); reopening a month removes its closed state, as today. Returning to the app after a sync produces the same overlay as the last device because the same facts produce it; while sync is not current the "Supported as of …" interpretation applies (E) and beds after the supported month show as sketch with the label.

### 6.2 What is cached and why it cannot go stale
Only derived render caches keyed on content (as the past-era cache and the mini loader are today). Nothing about the land is stored. The Hunt's found lanterns and the viewer's map position are household and viewer state respectively, not world state.

### 6.3 "What changed here" (P)
Every overlay derivation carries the ids of the facts that produced each bed card, sculpture step, signpost and gate (the `postedIds`/entry ids and command outcomes). Tapping a bed, a sculpture or the camp's "since you were here" opens a plain list: *June: 3 essentials entries (amounts), 1 reversal on the 14th re-attributed, the Chapter closed on the 30th.* It is a read of the receipt log, not a new record, and it is the answer to "why did this change" without cluttering the map.

### 6.4 Never a financial event (test)
A static test in pass 02c: no module under `src/path/**`, `src/harbour/journey/**` or the overlay imports a `captureCommand`; the overlay module exports only pure functions; the map's tier-1 actions call existing commands through the same `KitchenCommand` path as the Desk. Opening a tool, viewing a bed, entering the world and stepping out post nothing (they already declare this; the test enforces it).

---

## 7. Continuity

- **One focus state** (today's `journeyFocus`, extended): `{ target xy, tier, radius, heading, period (day/week/month/era) and date, selected object, active filters, unsent draft }`. Tools open over it; "Put it back" restores it exactly; the world's Walk position is a separate saved body (Mountain v2, `geo`-keyed) that the focus points at when you step out.
- **Opening a tool never moves the map.** Calendar, a book, a plan, Hercules and the Studio return to the same target, tier, period and selection.
- **Entering the world from another time**: the detailed world always shows *now* (the real sun, today's beds). Stepping in from a past month lands at that month's bed with a banner "June 2026's bed, in today's world"; the strip stays on June; nothing pretends the world is in the past. A future "season replay" (the sun and bloom of a chosen date, finances untouched) is listed as an open question (D22), not promised.
- **Input**: touch (pinch, drag, tap), mouse (wheel, drag, click), keyboard (+/−, arrows, H/Home for today, Enter, Escape, the existing free-roam keys); every gesture has a button or key twin. Screen readers get the same marks as real buttons (as `pathWorld3d` does today).
- **Reduced motion**: the zoom is a cloud cut; the camp moves by cut; the strip snaps; the meaning is identical.
- **Flat**: the Desk is the map-first design's readable equivalent; its Today page is the camp card; `MiniFlat` draws the Year Walk and beds from the same overlay in SVG; every tool is reachable from the Desk's drawer. No finance depends on the 3D scene.

---

## 8. Alternatives considered

| Approach | Why not |
|---|---|
| A. Keep the grown Journey island as a separate island offshore of the Horizon | Two islands; the zoom becomes a flight between them; the brief says "not a different island". |
| B. Paint the whole Horizon with the current month's condition, history on a slider only | Loses history as place; every transaction recolours the island; violates "no transaction rearranges the island". |
| C. Generate the Horizon's land from the household (today's `grow.ts` at island scale) | Discards the authored world; every household gets a different island; the deck's geometry work is void. |
| **D. Authored island + the Year Walk of beds (recommended)** | Stable geography stays authored; history is additive and addressable; households are distinct in their beds, gates, sculptures and lanterns; the identity rule and derive-on-read carry over unchanged. |

---

## 9. Open questions (decisions D18–D25; D27–D33 in `TIME.md`)
- **D18** Retire weather-from-money on the Horizon (bills → clouds, storm, mist, payday sunrise) in favour of the strip's explicit markers, because the sun and the almanac are real now.
- **D19** Condition: explicit words on the camp card; physical wear only on the homestead's own timber and plants (the timber crossing, the garden, the fence), never on the island, the hosts or the sky; the home anchor never wears.
- **D24** The prototype's calibration as product settings: stage gates at 3 / 7 / 14 / 28 confirmed strain days; clearance below 0.25 × daily need with no material arrears; repairs after two clear days; one growth credit per category per week over a trailing 24 weeks. These assign meaning to money and are Jonathan's to confirm, change or refuse.
- **D20** Brush translation table (§3.3): which of cove, wider road, café lights, storm creek, frost are re-expressed as bed cards and which retire.
- **D21** The twelve station sites as listed in §3.2 (the seasonal placement), or fewer stations with more beds each.
- **D22** Season replay (sun and bloom of a chosen date, finances untouched): later, or never.
- **D23** The Atlas nook's island model becomes the Horizon at L0 on the kitchen table (same asset), and the Journey's "harbour islet" retires.
- **D25** The homestead's site list (§3.3b) and its place in Little Harbour's slope (the yard behind Our home, the lane to the quay, the footbridge over the town channel).
