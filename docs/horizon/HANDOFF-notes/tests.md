# Pass 5 · T5 Test reconciliation — notes

Track T5 of `passes/05-mountain-region.md`, 28 Sep 2026. This is a working tree on `claude/horizon-v2-mountain` and nothing is
committed; the integrator commits. The bake was not re-run. `public/horizon/**` and `MANIFEST.json` were not touched. Fictional
data only. `src/core/` and money semantics were not touched.

## 0 · Status

- **The ten suites**, in one command (`--maxWorkers=1`): 10 files and 161 tests pass.
  - BoardThresholds, ModeRegistry, GliderController, BoardPace, GliderJourneys, BicycleProfile, WalkOut, SkyEnvelope,
    GliderJourneysWind, RideSituations.
- **Also re-run, one at a time, because the fixes touch them:** all green.
  - SkateLines 5 (+2 todo), BoardCamera 7, BoardLanding 8, Cruiser 23, MoverHook 20, QuickLayerModes 11, Gondola 15,
    groundKernel 20.
- **Still failing, and not T5's:** `horizonMoversNoMoney` (2) fails the same way on `main@9fed600`. `mountain-camera` (1) was
  not run.
- **tsc** (`node --max-old-space-size=5500 node_modules/typescript/bin/tsc --noEmit`): clean, no errors.

### What changed, by file

| File | Change |
|---|---|
| `src/harbour/horizon/movers/shared/ground/contact.ts` | Two fixes, both in §2. |
| `src/harbour/horizon/movers/board/situations.ts` | R0, R3 and R4 starts re-derived. R1's start is now its analogue on v2's course, and R1 is deferred. |
| 11 test files | Expectations updated. Each changed line carries a `// v2.6:` comment naming the ruling and the old value. |

Four suites now mount the Mountain v2 region provider in `beforeAll`, the way `mountHorizon` does
(`runtime/index.ts:98,135`): BoardPace, BoardThresholds, RideSituations and SkateLines. S1's upper half has no Horizon deck;
the region carries it. Without the region, these suites ride the bake's 5 m lattice instead of v2's road.

## 1 · Per test

Verdicts: **a** means the expectation moved because of a ruling. **b** means a real regression, which is fixed in code.
**b→J** means a regression that is a design consequence, deferred to Jonathan.

| Suite | Test | Verdict | What changed | Old → new | file:line |
|---|---|---|---|---|---|
| BoardThresholds | picks the board up at skateLineStarts.1 | a | The rider now stands at v2's start gate (D-M5). | [1310,154,500] → [1325,158.2,470.5] | `test/horizonBoardThresholds.test.ts:68` |
| BoardThresholds | every board→feet pad is threshold pace | **b** | See §2.1. `crossing.walkFootQuay.g1.1` sampled `slow`, because the `gondolaBase` pad (feet→cable) 2.4 m away hid it. Fixed in `contact.ts`; the test is unchanged. | slow → threshold | `contact.ts:197` |
| BoardThresholds | P19 blockers on S1 | a | S1 is 434 m longer to the Notch. The flyover is retired (D-M5). With the region mounted, v2's `library-balcony` solid is a new blocker (§3). | apronBridge 878/880 → 1312/1314; reach 1252 → 1686; s1Flyover 534 → gone; +library-balcony 614/616 | `:299`, `:302` |
| ModeRegistry | offers the pick-up at skateLineStarts.1 | a | v2's start gate (D-M5). | at [1310,154,500] → [1325,158.2,470.5] | `test/horizonModeRegistry.test.ts:47` |
| ModeRegistry | accepts skateLineStarts.1 and rides a board | a | The pad is at v2's start gate. | [1310,500] → [1325,470.5] | `:171`, `:177` |
| GliderController | run-off side at crownLaunch | a (flag, §4.3) | At the moved launch, 20 m toward v2's crest (−z) is only 9.9 m below the deck, under RUN_DROP 10. Both facings now run off +z. | facing π → π becomes π → 0 | `test/horizonGliderController.test.ts:52` |
| GliderController | launchFromPad heading at the Crown | a | Same cause. | heading = facing → heading 0 | `:74` |
| BoardPace | S1 at 8 % | a | 8 % is now v2's Alpine bends (flow). The test now mounts the region, so the material reads `paved`, not grass. | fast/roll 0.12 → flow/roll 0.25, pushGrip 0.9 | `test/horizonBoardPace.test.ts:111` |
| BoardPace | every slice's pace at its middle | **b** | See §2.2. 353 of S1's 529 polyline segments read the wrong slice's pace. Fixed in `contact.ts`. S1's middle is now the arc middle. The drawn-material mismatch that is left is a land defect, pinned in the test (§3.1). | S1.1 read fast (should be flow) → all 13 correct | `contact.ts:142–171,269`; test `:120`, `:126` |
| BoardPace | bicycle offbed on S1 | a | S1's upper half runs on v2's road (D-M5), so the bicycle is legal there. The skate-only check moves to 90 %, on the Notch shelf. | 8 % offbed → legal on `mountainV2.road`; 90 % offbed | `:181` |
| BicycleProfile | a walk and S1 are offbed | a | The same cause. The check moves to 1500 m. | 60 m → 1500 m | `test/horizonBicycleProfile.test.ts:98` |
| RideSituations | R0 The twist | a | The Crown drop is gone. Re-derived at 1522 m, on the lower run of the Notch shelf (fast, paved). | 140 m [1304.98,639.05] → 1522 m [1223,1147.15] | `situations.ts:417` |
| RideSituations | R1 Downhill carve | **b→J** | No start on v2.6's S1 has a fast 13–18 % drop of 120 m. See §4.1. | pass → deferred (stalls at 83.7 m) | `situations.ts:439`; `test/horizonRideSituations.test.ts:52` |
| RideSituations | R3 Direction change | a | The Shoulder sweep is gone. Re-derived on v2's Meadow sweep at 350 m, with the region mounted. Every 10 m step from 330 to 370 m passes. | 230 m → 350 m [1250.33,527.19] | `situations.ts:498` |
| RideSituations | R4 Straightening recovery | a | Re-derived on the lower run of the Notch shelf, at 1560 m. Every 5 m step from 1550 to 1570 m passes. | 650 m → 1560 m [1234.95,1183.02] | `situations.ts:524` |
| WalkOut | E stands on the launch deck | a | The deck moved to [1322,472] (D-M6), and E's eye [1317.5,170,475.5] is now over it. | how 'ground', moved 6.5 → 'stand', 0 | `test/horizonWalkOut.test.ts:54` |
| SkyEnvelope | seats the Crown launch on the lookout deck | a | The fixture deck is re-centred on the launch. | x 1295–1315 × z 472–492 → x 1312–1332 × z 462–482 | `test/horizonSkyEnvelope.test.ts:28` |
| GliderJourneys (10) | Crown → Lamp, the Dam Run, the Throat (×4), 3 terrain reports | a | The launch moved to [1322,472] (D-M6). Every journey that arrived still arrives. See §4. | table below | `test/horizonGliderJourneys.test.ts:28–163` |
| GliderJourneysWind (3) | Crown → Lamp ×2, Crown → strip | a | The same cause. | −0.1 → −1.2; 14.3 → 11.8 | `test/horizonGliderJourneysWind.test.ts:28–38` |
| SkateLines (not in the list) | S1 start → end | a | This suite broke after the §2.2 fix, run without the region. It now mounts the region. S1 then rides end to end with 5 land-defect stops and no rider stops. | 15 legs (bake-only, old slicing) → 6 legs | `test/horizonSkateLines.test.ts:21` |

## 2 · Regressions fixed (code)

### 2.1 · A pick-up pad for another mode hid a park pad (`contact.ts padAt`)

- **Where:** at v2's Waterfront platform.
  - `threshold.gondolaBase` has modes feet→cable, which makes it a pick-up.
  - The new `crossing.walkFootQuay.g1.1` is a board→feet park pad.
  - The two 6 × 5 pads overlap, 2.4 m apart.
- **What went wrong:** the gondola slab is the surface there, so its pad wins on height. A board rolling onto the park pad then
  read the walk's `slow`, not `threshold`.
- **Fix:** a pick-up pad that this profile cannot take (not in `ownPickups`) now ranks after every other pad on the same spot.
  Where it stands alone, nothing changes.

### 2.2 · S1's authored slices were read as equal index slices (`contact.ts segmentOf`)

- **The cause:**
  - T1 authors S1's `surfaceSegments` `from`/`to` as **arc fractions**, taken from v2's segment starts (`build.ts s1OnMountain`,
    the same parameter the terrain's `progress` uses).
  - The contact sliced every bed into equal index slices. That was harmless while every bed's slices were uniform: S2–S4 still
    are, and differ at 1–4 polyline segments each.
  - On S1, 353 of 529 polyline segments read the wrong slice. For example, the Library balcony (slow) read fast, and the Notch
    shelf read the Reach's slow.
- **The fix:**
  - A bed whose slices are not uniform is looked up by arc fraction (`q < to`).
  - Uniform beds keep the old rule, so their behaviour is unchanged.
  - The deck solid's slab name (`S1.surface.k`) still overrules the slice, but on authored beds only within 2 m of a join. The
    land still names the slabs wrongly (§3.1), and this keeps working once the land fixes it.

### 2.3 · S1 on v2's course, with the region mounted: no integration gap

- **Sampling:** every 2 m along S1's 1712 m, the board contact over the Horizon geography plus the region provider is
  `legal: true` at every sample.
  - v2's road reads `paved`, and its bridge decks read `boardwalk`, at v2's slice pace.
  - No `offbed` anywhere.
- **Without the region** (the bake alone), S1's upper half is illegal at 260–300, 500–530 and 890–900 m (bridges and cuttings),
  because the bake has no deck there. The runtime always mounts the region.

## 3 · Written up for the land (T1) and the region (T2)

1. **The land names S1's slabs by equal index slices.** (`land/beds/profiles.ts:122` emitBedGeometry: `segments[floor((i-1)/(n-1)*len)]`.)
   - It should slice by `surfaceSegments[k].from/to` as arc fractions, the way the terrain's `progress` does.
   - On S1's Horizon half, the drawn slab shows the wrong slice's surface:
     - on the Notch shelf, slice 10 is drawn `cobble` where it should be `paved`;
     - on the Reach boardwalk, slice 11 is drawn `paved` where it should be `cobble`.
   - Grip follows the drawn material.
   - Pinned in `horizonBoardPace` as `{'S1.10':'cobble','S1.11':'paved'}`. A land fix empties that table.
2. **v2's `library-balcony` solid stands in S1's clearance** at 614–616 m, in the Library balcony slice.
   - It is a region solid (`regions/mountainV2/geography.ts REGION_SOLIDS`).
   - The headless rider bails on it at 613.8 m, 0.19 m off the centreline.
   - For T2: trim the box to the balcony, or leave it out of the solids the way the district fixtures are.
3. **The region's lawn over S1's Foot-terrace deck.** At 950–980, 1040, 1060 and 1100 m, the region's ground (`island` / `foot`)
   stands a few centimetres over the Horizon's S1 slab.
   - The contact reads material `grass`, so grip is 0.6 instead of 1.0.
   - The pace is still correct and the sample is legal.
   - For T2: yield the ground to a Horizon deck there, or add the S1 slab to the region's decks.
4. **SkateLines S1 stops, with the region mounted** (6 legs):
   - `mountainV2:library-balcony` at 613.8 m
   - `apronBridge.rails@lakeside` at 1270.4 and 1276.4 m
   - `apronBridge.rails@notch` at 1312.9 m
   - `highSpan.shelf.rail@notch` at 1440.7 m

   The `it.todo` list in that file still names the v2.5 defects (dam apron, S1 retaining walls). It is informational, and T1
   should refresh it.
5. **S1's time target.**
   - The moving time is 291.9 s over 1712 m (across 6 legs), reported against `skate.S1.time_target_s` [70,130].
   - The target is stale. `journeys` carries [150,200] for S1 after T1's edit.
   - D44 is Jonathan's.

## 4 · Glider journeys: margins, before (`main@9fed600`, launch [1305,482]) and after (v2.6, launch [1322,472])

The flights use the flat-ground convention (`horizonGliderJourneys.test.ts` header). Only the launch moved. The "over bake"
rows replay the same paths over the baked terrain, which is v2's ground inside the footprint.

| Journey | main | v2.6 | Arrives? |
|---|---|---|---|
| Crown → Lamp, still air (in hand; time) | +30.9 m; 95.2 s | +28.8 m; 96.9 s | yes → yes |
| Crown → Lamp, closest to the Bight sink | 277.3 m | 278.7 m | — |
| Crown → Lamp over bake (clearance) | +12.3 m at [1290,496] | +14.0 m at [1313,480] | clears |
| Crown → Lamp, 4 m/s south wind (D39, deferred) | −0.1 m; 132.95 s | −1.2 m; 135.25 s | `reached` yes → yes, no margin (still deferred) |
| Crown → strip, still air / wind | +32.1 / +14.3 m | +30.2 / +11.8 m | yes → yes |
| Throat Run from the Crown (mouth; gate 10) | −9.9 m; +0.2 m (inside) | −8.8 m; +1.2 m (inside ±8) | miss → miss (as ruled: the ridge earns it) |
| Throat after ridge 190 m | −6.9 m | −7.3 m | miss → miss |
| Throat after ridge 210 m (seconds beating; mouth) | 129.5 s; +12.7 m | 132.1 s; +12.5 m | yes → yes |
| Throat from 190 m over the Crown | +10.5 m | +11.6 m | inside the aperture |
| Ridge approach over bake | +11.1 m at [1307,548] | +11.8 m at [1322,480] | clears |
| Throat approach over bake (land request) | −29.9 m | −28.8 m | unchanged class |
| Dam Run (gate 3; gate 4; touchdown from the meadow) | +2.0; +5.6; 17.3 m | +1.3; +3.9; 21.4 m | yes → yes (inside the 40 m field) |
| Dam Run over bake (land request) | −5.3 m | −6.1 m | unchanged class |
| Prow → Sands, still air, 07:00 and 14:00 | +3.5 m | +3.5 m | yes |
| Prow → thermal → Sands, 14:00 | +24.7 m | +24.7 m | yes |
| Prow → Reach meadow | +23.1 m (over bake −5.3) | identical | yes |
| Prow → Sands / meadow in wind (D39, deferred) | −2.6 / −7.1 m | identical | no → no |
| Lamp Hop | 13.5 s | 13.5 s | yes |

**No journey that arrived now fails.** Crown → Lamp in the wind was already deferred at −0.1 m, and is now −1.2 m.

## 5 · For Jonathan

1. **R1 Downhill carve has no home on v2.6** (D-M5 consequence).
   - RIDE §9's R1 needs a fast, paved, 13–18 % run of at least 120 m from 3 m/s.
   - v2's course is flow and slow bends at 10–15 %. Its steepest fast stretch, the Notch shelf, is about 95 m, then flat.
   - The best analogue is v2's summit start, 6 m below the start gate. From there the carve stalls at 83.7 m and leaves the 4 m
     bed.
   - The starts searched on S1 were 120–170, 310–360, 1150–1190, 1330–1360 and 1505–1530 m. None passes.
   - The test is pinned as measured, the way the D39 journeys are.
   - Your options: give R1 a new home (another line, or a v2 descent), or re-derive R1's range for v2's paces.
2. **The Crown is no longer a two-way launch.**
   - From [1322,472], the crest side falls 9.9 m in 20 m against RUN_DROP 10 (9.1 m on the region's ground).
   - So every run-off goes +z, over the south-west face.
   - Accept this, or move the deck or RUN_DROP. The tests pin the one-way behaviour.
3. **The Dam Run still threads a "dam arch" gate.** The dam is retired (D-M3), but `sky.courses.damRun` still names `damArch`.
   The flight passes through the gate, but no arch is drawn there any more.
4. **Crown → Lamp in the shipped wind** (D39): the margin is now −1.2 m, from −0.1 m.
