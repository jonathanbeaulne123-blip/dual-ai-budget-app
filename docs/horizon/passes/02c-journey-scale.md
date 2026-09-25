# Pass 02c — The Journey scale

Runs in parallel with 02 (movers) and 02b (kit), after pass 1's land is accepted. Claude subagents: one per track, an integrator, a reviewer who has not seen the work. Read `CONTRACT.md` (rules 15–18, §4 `journey` and `WorldOverlay`), `SCALES.md` (the whole file), `LIGHT.md`, `MANIFEST.json → journey`, `STYLE.md` §1.15 (the L0/L1 look) and the prototype in `inputs/our-path-living-world-prototype.html` (a guide to the look and the wear rules, not a spec).

## Purpose
Make the Journey map the Horizon at LOD 0–1, make it the app's home, make the zoom a change of scale on shared coordinates, and derive one `WorldOverlay` that the Journey renderer, the world renderer and the Desk all read. Keep the meaning layer (`src/core/pathSignals.ts`, `pathWorld.ts` recipes, `pathEras.ts`, `pathLand.ts`, the mini model) and retire the generated land (`src/path/grow.ts` coast/coves/noise, the era ring of islands, the harbour islet, weather-from-money).

## Inputs
- `MANIFEST.json → journey` (stations, the Year Walk, station pads, the camp, era gates, the homestead, the Kitty plaza, LOD budgets, camera tiers, the focus fields, the retired list).
- Pass 1's baked terrain at two LODs and the station/homestead pads; pass 2b's low-poly host cards, bed cards, waymarks, gates, tent, hoardings (stakes and string) and the homestead cards.
- Repo facts (verified at `main@cc1aab6`): `src/path/OurPathWorld.tsx`, `src/path/world/pathWorld3d.ts`, `src/path/mini/*`, `src/path/journeyFocus.ts`, `src/path/harbourJourney.ts`, `src/path/JourneyCloudTransition.tsx`, `src/harbour/camera/worldZoom.ts`, `src/harbour/scene/runtime.ts:964-977` (`zoomWorld`), `src/harbour/nav/arrival.ts`, `src/harbour/desk/*`, `src/house/navigation.ts`, `src/core/pathSignals.ts`, `src/core/pathWorld.ts`, `src/core/pathWeather.ts`, `src/core/houseCondition.ts`, `src/core/kittyStudio.ts`, `src/core/herculesActionPolicy.ts`.

## Base SHA rule
Branch from the pass-1 pin. Rebase before delivery. `src/core/**` is read-only for this pass except the additions named in track D (pure functions only, no commands).

## Tracks
| Track | Owns | Must not touch |
|---|---|---|
| **A · Overlay** | `src/core/worldOverlay/**` (new): `deriveWorldOverlay(household, history, worldDef, asOf)` pure; beds from `pathMonths` scores + recipes translated to bed cards (`SCALES.md` §3.3, D20 table); camp; era gates; kitty steps; signposts; flags; homestead state (maturities, cargo, pavilion, crossing wear stage with the prototype's gates as `PROPOSED_SETTINGS`, evidence freeze); condition words; timeline data; `provenance` (fact ids per visible thing). Content-keyed memo like today's era cache. | any `captureCommand`; `src/core/commands.ts` |
| **B · Journey renderer** | `src/path/world/**` re-based on the Horizon: L0/L1 tiers from the baked terrain, the same `WorldDefinition`, the low-poly kit; marks as real buttons at per-frame anchors (keep); camera tiers Sky/Region/Stop/Up close on one orbit controller; the camp lit; the walk ahead as stakes; the Replay slider moves the camp and sketches later beds; Bare terrain / Calm view / Labels toggles (from the prototype and today's calm view); the timeline strip docked (today's mini view, unchanged data). | the world renderer's streaming; `src/harbour/mountain/**` |
| **C · The zoom** | `src/harbour/camera/worldZoom.ts`, `src/harbour/scene/runtime.ts` (zoom sections only), `src/path/JourneyCloudTransition.tsx`, `src/path/harbourJourney.ts`, `App.tsx` (the `journeyCloud` call sites only): the tier change on shared coordinates; the handoff below Up close to Look then Walk and back; the cloud kept as the fallback (reduced motion, no WebGL, tier load > 400 ms); the "current month only" guard becomes "the world shows now; a past month lands at its bed with a banner". | any camera pose in `mountainPoses.ts` other than the arrival shots' end states |
| **D · Home and interactions** | `src/harbour/nav/arrival.ts` (sign-in lands on the Journey at Region, framed from the south-east), the camp card (the Desk's Today read models re-cut), host state labels, compact panels (tier 2, `SCALES.md` §4.3), the strip's drag-to-reschedule (confirm sheet → the existing command through `KitchenCommand`), "what changed here" (a read of provenance + the receipt log), Hercules's bubble, first-visit hint, the bar (Record, Calendar, Books, All tools, edition flip, Step in/out). | tool internals; the Desk pages (they read the overlay; that change belongs to the Desk owner and is one small PR) |
| **E · Flat and access** | `MiniFlat` draws the Year Walk and beds from the overlay in SVG; the Desk's Today page reads the overlay's camp; keyboard and screen-reader parity for every mark and tier; reduced-motion paths. | 3D code |
| **Integrator** | wiring, `journeyFocus` extension (target, tier, radius, heading, period + date, selection, filters, draft), route/return continuity, tests, HANDOFF. | — |
| **Reviewer** | `REVIEW-BRIEF.md` method against this brief; has not seen the work. | — |

## Must produce
- Sign-in → the Journey map at Region, south-east framing, the camp lit, the camp card docked, the strip on today. From it, without stepping in: record a purchase, move a bill, open every tool, see what changed since last visit, talk to Hercules.
- The map is the Horizon: coast, terrain, water, roads, the Year Walk, districts, hosts, stations and the homestead at their manifest coordinates. No second island. Same north, same scale.
- Zoom in past Up close lands in the world at the corresponding place (the square from the default framing; the bed from a station), on the arrival shot; zoom out returns to the same place and period. Continuous where possible; cloud fallback where not.
- Beds for every month of history at `station(month) + bed(yearIndex)`; the camp at the current month; era gates; stakes and string ahead; kitty sculptures at the plaza; signposts; flags.
- The homestead with its sites, maturities, cargo, the pavilion's three states, the crossing's wear stages under eligible evidence with the proposed gates as settings, and "why is this here" on every site.
- Corrections: edit, delete, refund, reclassify, reopen a month, then reload and resync → the same overlay, no duplicate or stale mark; "what changed here" lists the facts.
- Continuity: opening and closing any tool from the map restores target, tier, period, selection, filters and draft; "Put it back" from the world returns to the map state it left.
- The flat path: the Desk's Today page and `MiniFlat` show the same camp, beds and homestead state as the map; every tool reachable without WebGL.
- Weather-from-money removed from the Horizon (D18): the strip carries bills, paydays and the Fund's horizon explicitly.

## Must not
- Store any world state (beds, wear, maturities). Everything derives.
- Import a `captureCommand` anywhere under the overlay or the Journey renderer (static test).
- Create a financial event from opening, viewing, zooming or stepping in.
- Put moss, erosion, weather or a tint on the island, the hosts or the sky for a financial reason.
- Assign a judgment: bed cards summarize shares and counts with their numbers on the card; no "good month" / "bad month" words anywhere.
- Add a building, a district or a landmark to give a feature a destination.

## Tests to add
- `test/world-overlay.test.ts`: purity (same inputs → same overlay), identity (append a month → no existing bed moves), corrections (the six cases above), provenance (every card has ≥ 1 fact id), evidence freeze, the gate thresholds as settings.
- `test/journey-horizon.test.ts`: every station, homestead site and host on the map is within 1 eu of its manifest position; L0/L1 budgets; the camp on the current month; stakes ahead.
- `test/journey-zoom.test.ts`: tier handoff radii; the world lands on the arrival shot; out and back restores focus; past-month entry shows the banner; cloud fallback under reduced motion and slow load.
- `test/journey-home.test.ts`: sign-in route; camp card content equals the Desk's Today read models; every tool opens from the map and restores focus on return; the strip's drag posts through `KitchenCommand` only after confirm.
- Static: no `captureCommand` import under `src/core/worldOverlay/**`, `src/path/**`.

## Evidence required
- Captures at 1440 × 900 and 390 × 844: the home view at golden hour and at night; Region on each of the seven neighbourhoods; a station with three years of beds; the homestead in Healthy, Strained, Damaged and Recovering (fictional household); the zoom as a 12-frame strip from Sky to the square; the same from a station to its bed; the flat Today page beside the map's camp card showing the same numbers.
- A screen recording of: sign-in → record a purchase → move a bill → open Books → put it back → step in → step out.
- Reduced-motion recording of the same.

## Gate
Jonathan on both devices (the home view is the product's first impression); Claude's reviewer on the overlay's purity and the money boundary; Codex trust review only if the Desk PR or any `src/core` addition touches a command (it must not).

## Delivery
Bundle + patches + HANDOFF + FINISH-PROMPT + TEST-PLAN + evidence to `~/Downloads/horizon-02c-journey-scale/`. `docs/DECISIONS.md` entries for D18–D25 as answered.


## Added for TIME.md
- Track B also renders the **stretch of day-stones** (stones, flagstones with lantern posts, the camp on today's stone, explicit markers from the day ledger: slips, pennants, stakes, chairs, the ajar gate) and the **unbuilt next stretch** as stakes and string; the strip is the same stretch flattened (data from pass 02d's ledger; if 02d lands later, B reads `miniJourneyModel` and switches).
- The Replay slider, the month ring, the Sitdown gate scene and the era ring are removed; walking the strip/stones is replay; `journeyFocus` levels become day/week/month/year/era.
- Evidence adds: the same day on a stone, on the strip and on the Calendar grid, side by side.
