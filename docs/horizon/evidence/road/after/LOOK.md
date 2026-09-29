# Horizon Drive, after the road-main pass — what the captures show

Headless Chromium with SwiftShader on the review harness (`scripts/horizon/capture-road.mjs`, the same poses as `../before/`). This is **not device evidence**: frame times are software rendering, and colours are SwiftShader's. The date is 21 June 2026, by day at 13:00 and by night at 22:30. Driver poses use the cruiser rider's eye: 1.9 eu over the surface, 2 eu into the right-hand lane, looking 40 eu ahead.

The captures come from three runs:

| Run | Files | Contents |
|---|---|---|
| First | `after_01…23`, 13:00 | All 23 driver poses. The page lost its stage about 10 minutes in, so this run's night, ride and aerial captures failed. |
| Night | `after-n_06…10`, 22:30 | The five night poses, in a fresh page. |
| Rides and aerials | `after-r_01…06` | Rides and aerials, in a fresh page. |

Manifests are `captures.json`, `captures-night.json` and `captures-ride.json`. Each run logged one HTTP 404 for an unrelated asset; `../before/` logged the same.

## The corridor by setting (brief §4)

**Developed: Harbour Gate, the town and the Quay** (`01`, `02`, `17`, `after-r_03`, `after-n_10`)
- Kerbs and flagged sidewalks run continuously, with dropped kerbs at the upper-street mouth and crossings.
- Street lanterns stand behind the kerb.
- Post-and-rail stands where the harbour embankment drops, beyond the sidewalk rather than across it.
- Zebras mark the crossings.

**Mountain and forest: Prow Cliff Drive, the NE corner, the north ridge, V03** (`06`, `07`, `08`, `18`–`20`, `after-r_06`)
- There is no urban dressing. The Year Walk footway runs beside the road, stone parapets stand only where the drop needs them, and the landscape carries the view.

**Coastal: Crown Coast, West Rise, Flats Coast, the south shore** (`09`–`11`, `15`)
- These stay open to the water.
- Low prairie beds are set in groups with gaps.
- There are no lamps except at junctions and bridge approaches.

**Boulevard: Long Sands** (`15`)
- The resort boulevard has palm groves on the shore side and flower beds on the land-side verge.
- Kerbs run both sides, with lanterns staggered about every 14 eu (about 28 eu per side).
- There is no planted median. The Drive's 10 eu section has no room for one without narrowing the lanes, which the brief forbids.

**Structures: the Prow gallery, the Bight Bridge, the Quay Bridge, the High Span, the canal bridge** (`03`, `04`, `12`–`14`, `16`, `20`, `22`)
- Each structure owns its deck and rail.
- The Bight Bridge's lanterns all stand on the Year Walk side's rail.
- The corridor's guards run onto each bridge's first station with no gap.

## Night (brief §7) — `after-n_06…10`

- Lamps are lit on the world clock, and each lamp's pool decal lies on the road surface.
- Kerbs, rail tops and markings carry the night chalk, so the road reads edge to edge.
- Pools overlap along lit runs, so light and dark do not alternate.
- The six shadowless point lights around the rider add real light on the road.
- The Quay Bridge's south approach (`after-n_09`) is lit up to the zebra crossing. A 16 eu unpainted stretch between the approach lanterns and the first bridge lantern is a named exception in the plan test (see the handoff).

## Cameras and skins (brief §9) — `after-r_01…04`

- These cover the activity, first-person and floating cameras, with the Vespa and Harley skins, on a live ride with the real controller.
- The rider went 65.9 eu at up to 12.8 m/s with 0 contacts (`captures-ride.json`).
- No camera controller was added.
- Lamp posts and rails stay outside the forward view.

## What is still rough (seen here)

- **Year Walk threshold markers** (a yellow stud and a dark bar at night) sit in the lane at Year Walk crossings (`after-r_02`, `after-n_09`, `after-n_10`). These are the existing threshold markers, not part of the road kit. Replacing them with the zebra where a crossing is marked would be tidier.
- **Pencil slab joints** read as thin dark lines across the carriageway, as on Mountain v2's road. This is a matter of taste.
- **The overview's far tiles** (`after-r_05`) are the existing coarse district cards. They are not road work.
