# Horizon Drive, finished as a corridor — handoff (29 September 2026)

**Brief:** Jonathan, 29 September 2026: *"Implement: Horizon V2's Main Road — a beautiful, fully functional driving experience."*
**Design:** [docs/horizon/ROAD.md](horizon/ROAD.md), decisions D-R1 to D-R12.
**Decision entry:** the 2026-09-29 entry at the end of [DECISIONS.md](DECISIONS.md).
**Branch:** `claude/horizon-main-road`. It merges `main` at 1c436be (#574) and is pushed. See the PR for its state: not merged, not deployed, not live verified.

## The household outcome

The island's main road is now a road you can drive the whole way round, both directions, in either lane, with no stops, snags or launches. It reads as one designed corridor:
- kerbs, sidewalks and zebras where people walk;
- stone parapets and post-and-rail only where there is a drop;
- lanterns that light the road at night on the world clock;
- composed planting that changes with the setting: groves at Scholars' Crest, prairie drifts on the Flats, palms and flower beds on Long Sands, a maple avenue into the harbour.

The Journey map draws the road's bridges, covered stretches and boulevards at map scale. No board space, station or financial stop moves.

- **Budget delta (5): 0.** No money path, command, schema, sync, Auth/RLS or Hercules payload changes.
- **Engagement delta (3): +2.** The island's easiest transport is comfortable and good to look at, by day and by night.
- **Risk: High.** This changes shared land geometry, collision, navigation and night lighting.

## What changed

| Area | Where | What |
|---|---|---|
| One road definition | `land/corridor/{types,stations,reaches,guards,solids,index,plan,lights}.ts`, `plan/**` | Stations every 2 eu with context and sides. Guard runs, markings, lamps, planting and scenic stops come from those stations. The corridor's solids replace the road beds' old strips and edge pieces. Written to `WorldDefinition.corridors` (CONTRACT §4). |
| Geometry at its source (L1) | `land/beds/{build,junctions,solver,…}.ts`, `land/structures/build.ts`, `land/terrain/index.ts`, `regions/mountainV2/geography.ts` | Faired profiles; the Bight Bridge's straight frame; flush joins at laybys, pads and crossings; abutments on the Quay Bridge and the High Span; road embankments (1 : 1.5, never into a pad's footprint); footways re-synced to their hosts. |
| Integration fixes | `corridor/solids.ts`, `stations.ts`, `guards.ts`, `structures/build.ts`, `bake-entry.ts` | Junction aprons (D-R10). Bare structure edges guarded by the corridor (D-R11). A real road deck on the Bight spur trestle: a fascia board rail, and the deck carried out to the Bight walk. Guards, kerbs and fills lap onto bridge ends. Sidewalk backs slope to joining paths. Mountain v2's ground is used inside its footprint (D-R12). Collider heights follow the drawn rail. |
| Kit and art | `kit/road/**`, `runtime/corridorArt.ts`, `runtime/cards.ts` | Pavement bands, markings, kerbs, flagged walks, stone parapets, post-and-rail, road, bridge and tunnel lanterns, and stop furniture. Classic, Taylor and Newfoundland dressings. |
| Planting | `kit/plants/**`, `runtime/corridorPlanting.ts` | Mountain v2's plant archetypes plus palm, flower bed and grass tuft. Seasons follow the world clock. Lite drops items without substituting. Distance fades avoid pop. |
| Night | `runtime/roadLights.ts`, `sky/night.ts` | Lanterns switch on in sequence between sun elevations of +2° and −6°. Pool decals lie on the surface. Six shadowless point lights on full, two on lite (D-R3). Pool radius is 12 eu. |
| Review of #575 | `corridor/index.ts`, `world/build.ts` (`corridorDestinations`), `bake-entry.ts`, `journey/land/simplify.ts`, `road-audit.mjs` | The bake's plan now reads the bake's water test, the Year Walk and the published destinations, as the plan tests did (V01 and VG each gain two frontage lanterns; nothing else moves). `arcOf` uses the true segment length. The audit's slide field is named for what it holds (the closest approach to the centreline). Comment and heading fixes. |
| Inspector | `runtime/inspector.ts`, `scripts/horizon/road-inspector.mjs` | Dev-only, or `?diagnostics=1`. Shows position, the corridor station, frame ms, draw calls, lights and the last blocker. Copy writes to `inspectorLog`. |
| Journey | `src/journey/land/**` | Bridges, covered stretches and boulevards. Slim format 2. |
| Runtime mount | `runtime/index.ts` | Art and planting per resident district, hidden on the Journey map, with fog. Theme and season follow the app and the clock; road lights are rebuilt with the kit on a theme change. |

## Verification (exact)

- `pnpm typecheck`: clean.
- `pnpm horizon:check`: byte-exact after `pnpm horizon:bake`, about 125 s.
- **Driver's-eye audit** (`node scripts/horizon/road-audit.mjs --out docs/horizon/evidence/road/audit-after --title after`, 62 s). It uses the real `stepCruiser` on every corridor road, both directions, centre and keep-right lanes. Result: **0 restarts, 0 BLOCKER / 23 MAJOR / 85 MINOR**, against 41 / 298 / 584 before.
  - Horizon Drive has 3 MAJOR, V03 has 1, VG has 0.
  - None of the 23 is in the lanes. They are:
    - walk and pad joins at the verge;
    - the spurs' 12.0 % and 12.01 % grades;
    - the Bight spur trestle's south end, where it meets S4 at 3 eu off the centreline;
    - a Glasshouse-steps retaining wall at the Glasshouse spur's edge.
- **Suites:** every `horizon*`, `journey-*`, `harbour-world-toggle`, `harbour-source-fences` and `harbour-walk*` file, run one file at a time with `--maxWorkers=1` at 3267392: **102 files, 1343 passed, 2 failed**. The 2 failures are `horizonMoversNoMoney`, which fails the same way on the pre-branch baseline `857b059`, so they are pre-existing.
  - After the #575 review fixes (rebaked, `horizon:check` byte-exact, audit unchanged at 0 / 23 / 85 with 0 restarts), the same 102 files: 1342 passed, 3 failed. Two are the same pre-existing `horizonMoversNoMoney` failures. The third was one `journey-fullscreen-ui` test, which waits on a 2 s wall clock; it passed 3 of 3 re-runs on its own.
  - The Journey land captures were re-run for all three themes and now include the Long Sands region and stop poses (`docs/horizon/evidence/road/journey/after-*-sands-*.png`).
- **Captures:** `docs/horizon/evidence/road/after/` and `LOOK.md`: 36 SwiftShader captures covering the day, night, boulevard, mountain and coastal views, rides in 3 cameras with 2 skins, and 2 aerials. `docs/horizon/evidence/road/inspector/`: five inspector snapshots, plus the overlay at 390 and 320.
- **Independent review:** a blind reviewer returned 1 BLOCKER (captures not yet committed), 3 MAJOR and 6 MINOR.
  - Fixed: the captures, M1 (collider heights, with a new baked test), minors 1, 2 and 4, and the decision entry.
  - Listed as owed to Jonathan: M2 and M3.
- **Not run:** the quick gate, and the full or exhaustive gates. No device, phone or frame-rate evidence. Visible widths 320, 390, 720 and 1100: the only UI change is the dev-only inspector overlay, captured at 390 and 320. The world is a canvas.
- **Data and environment:** fictional Development data only, no secrets, headless SwiftShader.

## Rough areas, stated plainly

- **Quay Bridge south approach:** 16 eu of road is unpainted by pool decals, between the approach lanterns and the first bridge lantern. A junction mouth, a crossing, S3's separated lane and the abutment leave no legal lantern spot. The point lights still light it. This is a named exception in `horizonCorridorPlan.test.ts`.
- **Tideline Park:** the park sits 2.3 eu below the Drive. Its frontage is a kerb over a grassed bank with a 0.46 eu step. A flush frontage needs the park regraded, which is owed.
- **No planted median on Long Sands:** the Drive's 10 eu section has no room without narrowing the lanes.
- **The Crown Lookout** is proposed, not built: it needs a graded pad, which is owed. The Long Sands Shore stop is built, but it is 108 eu from the Year Walk, so it has no path joining the walk as ROAD §4.7 asks.
- **Year Walk threshold markers** in the lane (a yellow stud) are pre-existing. Replacing them with zebras would be tidier.
- **Per-district draw-call budget** (ROAD §8) is proven on fixtures only.

## Owed to Jonathan

- D-R3: road lamps use a bounded pool of shadowless point lights.
- D-R4: palms only on Long Sands and Tideline.
- Page L's Boathouse: an authored-view change, or a shorter Quay abutment.
- The Tideline Park frontage.
- The Crown Lookout landing.
- Whether lamp posts should get colliders.
- A device ride.

## Next owner

Jonathan rules on the owed list and does a device ride. Then a PIN-1 review of the land. Codex, as integrator, merges after his word.
