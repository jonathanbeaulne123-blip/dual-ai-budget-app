# Worksession — The Horizon, Mountain v2 placed (pass 5, Horizon v2 segment 1)

Date: 2026-09-28 · Owner: Jonathan · Integrator: Claude (design lead) · Base: `main@9fed600` · Branch: `claude/horizon-v2-mountain` · Risk: **High** (shared geometry, navigation, presentation; no `src/core/` or money-meaning change).

Spec: `docs/horizon/passes/05-mountain-region.md` (every number and rule; this file records what was built and how it was checked). Rulings: D-M1…D-M10, `docs/horizon/DECISIONS.md` → "Mountain v2 placement rulings"; the same-day entry in `docs/DECISIONS.md` → "Horizon v2, segment 1: Mountain v2 placed".

## Authority

Jonathan, 28 September 2026: *"There is a particular charm, asset quality, and sense of composition in Mountain V2 that I want to preserve … I am comfortable bringing a slightly stripped-down version of the actual Mountain V2 into Horizon and using it as the standard we expand from … 'Stripped down' means less visual noise — not less care, weaker assets, flatter materials … Roads, mountains, trees, the dam, bridges, and the gondola … Empty space is part of the result I want … It should feel like a beautiful region that belongs in Horizon — not a legacy exhibit pasted onto it … do not interpret this as permission to turn the entire island into Mountain V2's biome … We are advancing Horizon's existing foundation to a higher visual standard — not discarding it … Build a convincing first region, then extend the standard outward … Horizon receives the full picturesque scene. Journey receives its clear, geographically accurate representation."* He ruled summit-on-summit placement (D-M1), that v2's dam holds the Fund (D-M3), and to push and merge if possible.

## Scope of this pass

**In:** placing Mountain v2 (`src/harbour/mountain/**`, `hearth-mountain-2`) on the Horizon 1:1 under one translation (summit on the Crown summit `[1310,470]` h 158); the land override and manifest v2.6 edits inside its footprint; the region's own ground/scene/geography/graph in native space; the gondola as a `ModeController` on v2's line; the deck (this file's tracks, `docs/horizon/**`, `docs/DECISIONS.md`).

**Out:** D-M6b (a Little Harbour → v2-quay lower gondola leg); an art redesign of v2 itself; anything beyond the brief §4 drawn list.

## Tracks and what each produced

| Track | Owns | What it produced |
|---|---|---|
| **T1 Land** | `src/harbour/horizon/land/**`, `MANIFEST.json`, `scripts/horizon/**`, `public/horizon/**`, the land/terrain/beds/structures/water/thresholds/crossings/views/journeys/walk-out test suites | `HANDOFF-notes/land.md` was not written by the time this file went in; the canonical `MANIFEST.json` (v2.5 → v2.6) itself shows the work done: the `regions` key, `retired_v2_6` (every retired id's old value, `{value, why}`), `roads.V03` (327 m, portals and levels solved), `structures.mountainRoadTunnel`/`.mountainRoadCanalBridge`/`.s1InflowBridge`/`.inflowFootbridge`, `skate.S1` re-based on v2's course (1,712 m, 143 pts), `cable.G1` and the gondola stations moved onto v2's line, `rail.ORE`'s South Portal dropped to v2 ground (h 67.5), `walks.crown` re-laid on v2's road verge, `journey.stations`/`journey.yearWalk` re-posed, `places.L01` moved to v2's dam crest. <!-- integrator fills from HANDOFF-notes/land.md once written: the re-bake conflict count before/after and the land suite results --> |
| **T2 Region** | `src/harbour/horizon/regions/mountainV2/**` (except `placement.ts`), the runtime seams (`index`, `cards`, `geography`, `cableLayer`), `world/{definition,build}.ts` region fields, `test/horizonMountainRegion*.test.ts` | Per `HANDOFF-notes/region.md`: `regions/mountainV2/{index,geography,ground,scene,graph,rides}.ts` (the brief's `MountainV2Region` interface, ground lattice/paint via `buildLattice`/`groundMasks`/`paintGround`, the stripped-down scene per §4's drawn list, `MOUNTAIN_PATH_GRAPH` as an `ExtraPathGraph`); `runtime/{cards,geography,index}.ts` gain a terrain-cell filter, a `DynamicGeography` ground owner, and region placement/mount/release; `world/{definition,build,pathGraph}.ts` gain `regions`/`RegionPlacement`/`withExtraGraph`. Budget measured over CONTRACT §6: full tier 478,969 triangles / 121 draw calls, lite 216,519 / 92 — 3.2–3.6× one district's budget, so the region counts as its own residency unit (it spans roughly four districts' footprint); reasons and cheaper options if wanted are in the notes. The seam continuity probe is written but **skips** until T1's re-bake carries `world.regions`. `test/horizonMountainRegion.test.ts`: 10 passed / 1 skipped. The Fund reading is not yet wired end to end: the runtime exposes `api.setMountainDamWater(level, reserve)` but nothing calls it from `BasinReading` yet (§6 of the notes) — until then the dam shows frosted glass. |
| **T3 Rides** | `movers/gondola/**`, the mode/registry alias rows, `runtime/moverInput.ts` registry rows, `test/horizonGondola*.test.ts` | Per `HANDOFF-notes/rides.md`: `movers/gondola/{route,regionAdapter,controller,hud,index}.ts` — a `'gondola'`/`'funicular'` `ModeController` on v2's own `createRide`/`createRideCamera` in native space, offset out; boarding by threshold offer at both platforms (gondola quay/summit, four funicular stations); Space toggles the gondola seat, E skips to the far platform; reduced motion / calm both cut to the far platform and park the cabins; the fence test finds no `src/core`/`src/ledgerSync`/`workers` import reachable from `movers/gondola/index.ts`. Ride times (v2's own profile): gondola quay↔summit 62.1 s; funicular town→hearth 16.0 s, hearth→library 18.2 s, library→reservoir 21.2 s. `test/horizonGondola.test.ts`: 15/15 passed. D-M6b (the Little Harbour → v2-quay lower leg) is confirmed not built. Left open: the world's own ride buttons are not ported (the HUD covers the same actions); `runtime/index.ts` still owes the wiring calls listed in the notes §3 (`connectCableRegion`, the HUD mount, `poseRider` for the two new modes, and the `horizonModeRegistry` expected-list update). |
| **T4 Deck and Journey** (this track) | `docs/horizon/**` (except `HANDOFF-notes/{land,region,rides}.md`), `docs/DECISIONS.md`, this worksession | D-M1…D-M10 recorded in `docs/horizon/DECISIONS.md`; the same-day entry in `docs/DECISIONS.md`; `CONTRACT.md` §1 and §4 (`regions[]`, `src/harbour/mountain/**` fixed); `STYLE.md` §2.7 amended (v2's kit as the Crown footprint's built shapes, v2's own tree planting, the §4 drawn/not-drawn list replacing "only three built shapes" inside the footprint); `README.md` §2 and §4 (pass 5 added) and the "v2.6 (Mountain v2 placed)" delta section, compiled directly from the canonical `MANIFEST.json`; `make_manifest.py` mirrored to T1's actual edits — **verified byte-exact**: run in an isolated temp directory against a copy of the script, `diff` of its output against `src/harbour/horizon/world/MANIFEST.json` is empty; the brief's §6 status line |
| **Integrator** | `placement.ts`, wiring conflicts, the re-bake commit, evidence runs, the PR | <!-- integrator fills: final SHA, PR number, gate result --> |

`src/harbour/horizon/regions/mountainV2/placement.ts` is the shared interface every track reads: `MOUNTAIN_V2_OFFSET = {x:1308, y:54, z:764}` (native → horizon), the native bounds, grid bounds, the massif/island/summit lines, the feather, and `insideMountainV2`. Nothing in v2's data is transformed; every v2 builder runs in native space and its output is parented under a host group at the offset.

## Verification

As each HANDOFF-notes file reports it (per-track focused runs, this container, `pnpm exec vitest run <file> --maxWorkers=1` one at a time):

- **T2** (`HANDOFF-notes/region.md` §Verification): `horizonMountainRegion` 10 passed / 1 skipped (seam probe, until the re-bake); `horizonStreaming` 31; `horizonRuntimeGeometry` 7; `mountain-landscape` 4; `horizonWalkOut` 51; `horizonCards` 7; `horizonComfort` 4; `horizonRenderWork` 10; `horizonTerrainAsset` 7; `harbour-source-fences` 9. `tsc` clean for T2's own files; remaining project errors are T1's in-progress `land/**` and `test/horizonLandforms.test.ts`. `test/horizonMoversNoMoney.test.ts` fails on two pre-existing lines outside T2 (`movers/shared/vehicleArt.ts cameraMount`, `movers/glider/index.ts Date.now`/`performance.now`), named so they are not mistaken for a T2 defect.
- **T3** (`HANDOFF-notes/rides.md` §1): `test/horizonGondola.test.ts` — 15/15 passed, ~0.3 s. The same two `horizonMoversNoMoney` failures are named again as pre-existing at base `9fed600`, unrelated to `movers/gondola/**`.
- **T4** (this track): `make_manifest.py` v2.6 patch run in an isolated temp copy; `diff` of its `MANIFEST.json` output against the committed `src/harbour/horizon/world/MANIFEST.json` — **empty** (byte-exact).
- **T1**: <!-- integrator fills from HANDOFF-notes/land.md once written: ground-override/re-bake report and the land suite results -->

Not yet run by any track and still owed before acceptance: `tsc --noEmit` project-wide at 0 errors, `pnpm horizon:check`, `pnpm build`, the change-focused quick gate (`pnpm test -- --risk=high --focus=<area> --focus-reason="pass 5: Mountain v2 placed on the Horizon"`), and the capture set (pages A, E, F, a scenic view from v2's Foot up the gorge, page B from the Lamp, the three seams, before/after against candidate 6) plus the walks and rides listed in the brief's §5 acceptance. <!-- integrator fills these and the gate result -->.

## Dual Course

Budget delta (5): **+0** — no money path changes. `L01` moves with the dam onto v2's crest plaques and still reads `BasinReading` only; nothing else on the mountain reads or posts money (`MountainPanel`, `mountainTravel` and the old district bar are not ported).

Engagement delta (3): **+2** — the beautiful, quality-preserved Mountain v2 is now a real part of the Horizon, stripped of clutter but not of care, with the gondola, the dam, the road and the bridges usable in place.

## Uncertainty

- D-M6b (the Little Harbour → v2-quay lower gondola leg) is an open follow-up decision, not built here.
- `regions[]` (CONTRACT §4) is a new WorldDefinition field with one region so far (`mountainV2`); T2 measured it at 3.2–3.6× a single district's triangle budget (478,969 full / 216,519 lite), so it is treated as its own residency unit, not folded into the crown district — this is v2's own authored density (250–560 k on its native island), not a leak, and T2 lists cheaper options if the integrator wants them later.
- `make_manifest.py` **mirrors the built manifest exactly** for v2.6 (verified byte-exact against the canonical file in an isolated run) — no residual diff to record.
- The seam continuity probe (`test/horizonMountainRegion.test.ts`) is written but skips until T1's re-bake actually carries `world.regions`; V03's road-foot join is currently a 58 m `fallback` (not yet a seam) because V03 is not baked yet, per T2's notes §8.
- The Fund reading is not fully wired: T2's `api.setMountainDamWater(level, reserve)` exists but nothing calls it from a `BasinReading` yet, so the dam currently shows frosted glass rather than the live level (T2 notes §6; the caller belongs in `HorizonWorld.tsx`, not `runtime/index.ts`, per the movers' money-import fence).
- T3 flags remaining wiring the integrator owes in `runtime/index.ts`/`HorizonStage.tsx`: `connectCableRegion`, the cable HUD mount, `poseRider` seating for the two new modes, and updating `horizonModeRegistry`'s expected mover list to include `funicular`/`gondola`.
- No physical-device (Mac/iPhone) acceptance is claimed here; the captures are still to be run, and even once run are headless builder evidence per `CONTRACT.md` §2.21, which still requires real-device evidence before this counts as accepted.
- T1's own account (`HANDOFF-notes/land.md`) was not written when this file went in; its conflict counts and suite results are still owed. <!-- integrator fills once available -->
- <!-- integrator fills: any other conflict or gap HANDOFF-notes/land.md reports -->

## Next owner

Jonathan, by eye, on the captures (no pin is produced by this pass; `PIN-1` stays open). If accepted, segment 2 extends the standard outward one coherent region at a time, per his direction.

<!-- integrator fills: SHA, PR, gate result -->
