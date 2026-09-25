# The Horizon — LIGHT

Version 1.2 · 25 September 2026 · Jonathan's caveat: **a day/night cycle that follows the real sun in the user's time zone. The map is designed around lighting.**

This file is read by the land pass (the terrain faces the sun), the kit pass (materials have a night state), every neighbourhood pass (each has a best hour and a night face), the movers pass (night flight, the strip's lamps) and the pastimes pass (the Lantern Hunt is a night game).

---

## 1. The sun clock

- **Source of truth**: the device clock and time zone. No network. The island sits at a fixed latitude of **44° N** (Toronto's); longitude is taken from the time zone's standard meridian so solar noon lands at about 12:00–13:00 local, DST included. Sunrise, sunset, civil twilight and the sun's azimuth/elevation come from the standard solar-position formula for that latitude and today's date. Seasons therefore have real day lengths: ~15.5 h in June, ~9 h in December.
- **Cadence**: the sun moves in steps of 60 s of real time. The sky gradient and fog interpolate continuously; the sun direction, shadows and lit-window state update on the step. Shadow crawl is not acceptable; a soft cross-fade on the step is.
- **Overrides**: the sundial in Little Harbour's square shows the real time; press and drag to scrub the day for a preview, release to snap back. Reduced motion freezes the sun at 15:30 in June light. Calm view the same. `?sun=HH:MM` and `?date=YYYY-MM-DD` parameters exist for the review harness and screenshots only (dev builds), never in production.
- **Ownership**: the solar-position function (`solar.ts`: azimuth/elevation/sunrise/sunset from date, time zone and 44° N) and the `?sun=`/`?date=` overrides are built in pass 1, because the land pass needs them for its sun map and renders. The sun clock (60 s steps, shadow re-render on step, sky/fog uniforms, light-card `on` rules, the sundial) is built in pass 2b around it.
- **The almanac** (weather) is deterministic: a seeded sequence keyed on the calendar date, so both partners see the same weather on the same day with no network. Clear 55 %, overcast 20 %, wind 12 %, drizzle 10 %, snow (Dec–Mar only) 3 %; the Wash runs for six hours after drizzle.
- **Best-hour words map to clock times** for captures: dawn = sunrise; morning = sunrise + 3 h; noon = solar noon; afternoon = noon + 3 h; golden hour = sunset − 1 h; sunset = sunset; dusk = sunset + 30 min; night = 22:00.
- **Night is readable.** Minimum ambient is set so every door, threshold and edge lip reads at 02:00 in every dressing. A paper moon with the real phase gives the ambient a direction. Nothing is ever pitch dark; the Undercroft is darker than the surface but has its own lights.
- **Nothing waits for the sun.** No pastime, view or tool is gated on the hour. The Lantern Hunt is better at night; kites fly at night; nothing is restricted to an hour.

## 2. The sun on the map (why the island is shaped this way)

Sunrise east, noon south, sunset west. The island's plan reads that path:

| Hour | Where the light is | What it does |
|---|---|---|
| Dawn | The Prow, the Needle's Eye, Little Harbour | The harbour lights first. The arch is a sunrise gate: fly through it into the sun. The square's stone goes gold; the dam across the way is still blue. |
| Morning | The Notch, Lakeside | The gorge fills with light from the east; the dam's glass face lights from the side; the Adit's timbers are warm. |
| Noon | The Green, Long Sands, the Crown's south face | Everything flat is bright; the Crown is lit on the side you see from town; the Throat on the north face is in shadow all day (a dark mouth, on purpose); the Deep's skylight shaft carries the sun in whenever it is above 20°. |
| Afternoon | The Green, the Hollow, Stillwater | The lake reflects the Crown; the orchard's rows cast lines; thermals rise over the Flats' warm rock. |
| Golden hour | The Flats, the Bight, the Flats' rim | The strip's grass goes copper; the Bight is a mirror; the Lamp is a silhouette against the west sea. |
| Dusk | Lantern Row, the Lamp, the Glasshouse | Lanterns come on along the quay in sequence, west to east; the Lamp's beam starts its sweep; the Glasshouse glows from inside. |
| Night | The seven windows, the Campfire, the Crown's observatory, the Undercroft | The island becomes its lights. Found lanterns are lit. Fireflies June to August. Aurora over the Crown in the Newfoundland dressing. Runway lamps outline the strip. |

Terrain rules derived from this:
- **South-facing slopes are warm biomes** (meadow, orchard); **north-facing are cool** (woodland, the Throat, moss, the Crown's snow lasts longest there). Codex places woodland on the north-west rise and the orchard in a south-facing bowl because the sun says so.
- **The dam faces south** so it is lit through the day and seen lit from the square.
- **The square looks north-west**, so at golden hour the dam and the Crown are lit and the square itself is in warm shade: the first screen after sign-in is at its best in the evening, when people actually open the app.
- **The Flats are west** so the sunset lands on the airstrip and the balloon.
- **The Prow is east** so dawn flights start there and the zipline drops toward the lit town.
- **Long Sands runs east–west** so its dunes throw long shadows at both ends of the day.

## 3. Lights the island owns (`WorldDefinition.lights`)

Every light is an anchor with an `on` rule; the kit pass gives it a card, the neighbourhood pass places it.

| Light | On rule | Notes |
|---|---|---|
| Lantern posts (quay, roads, walks) | civil dusk → civil dawn, in sequence along their line | Lantern Row on the quay lights west to east, one per second |
| The seven windows | dusk → 23:00, then one window per house until dawn | Warm; the Glasshouse is the brightest thing on the island at night |
| The Lamp | dusk → dawn, beam sweeps every 8 s | Visible from every neighbourhood; the Ring Run's night beacon |
| The Throat's skylight | sun shaft whenever the sun is above 20°; moon shaft on clear nights | The Deep's only daylight |
| Runway lamps | dusk → dawn | Two rows on the strip; the windsock has its own lamp |
| Milestones | never | Reflective paint catches the lantern light instead |
| Campfire | when the Chapter is open, and every night 21:00–01:00 as ambience | Fireflies Jun–Aug within 30 m |
| Crown observatory | dusk → dawn | A single warm dot on the summit, the highest light |
| Undercroft | always | Glow-worms (cool), lantern cave (warm, per found lantern), the skylight (sun by day, moon by night) |
| Found lanterns (Hunt) | dusk → dawn | Only the ones this household has found |
| Gondola cabins, the Ferry, the plane | dusk → dawn | Running lights; moving lights are what make a night island feel alive |
| Aurora | Newfoundland dressing, Nov–Mar, after 22:00, clear almanac | Never in Classic or Taylor |

## 4. Materials have a night state (`STYLE.md`)

Every card material carries a day albedo and a night response: stone goes cool and holds lantern light; glass goes to an interior glow; water goes to a moon path; snow goes blue; paper (Taylor) goes to a lamplit cream; clapboard (Newfoundland) goes to a fog-lit grey. The three dressings therefore have six palettes: day and night each.

## 5. Sketchbook pages have a best hour

`MANIFEST.json → views[*].bestHour` names it. Acceptance captures are taken at the best hour and at its opposite (noon vs. midnight) so both states are proven. Reduced motion captures at the frozen 15:30.

## 6. Performance

The sun step is the only time the shadow map re-renders. Sky, fog and lit-window state are uniforms, not geometry. Night does not add draw calls beyond the light cards; the lite tier caps visible light cards at 48 and prefers the nearest.

## 7. Little things

- The sundial in the square is real: its gnomon's shadow is the sun's.
- Sunrise and sunset ring nothing; but the harbour bell at noon does, once, softly.
- The moon's phase is real. On a full moon the Bight's sandbar shows.
- The first time the island is opened after dark, the lanterns come on one by one as you watch.
