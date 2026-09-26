# M6 acceptance rides, headless (FLIGHT.md §11)

Reviewer-integrator, 26 Sep 2026, branch `claude/horizon-glider-cam` (base `main@0f601b5`, head `e4655b3` when flown).
Every ride is a step log (`rides/<ride>/steplog.json`: one row per simulated second — position, phase, airspeed, vs,
lift, bank, heading, AGL, ground speed, the pilot's bar/bank, the place bubble) plus a PNG every ~5 simulated seconds,
the PNG at the lip, and `after.png` once the runtime has put the rider back on foot.

## How the rides were flown (read this before the numbers)

- **Harness:** `/horizon-review.html?world=horizon` on `pnpm exec vite --host 127.0.0.1 --port 5199` (the dev review page:
  no household, no accounts, no money; fictional/dev only). Headless Chromium with SwiftShader (CPU WebGL) on a 2-core
  container. Scripts: `scripts/rides.mjs` (driver) and `scripts/pilot.js` (in-page pilot).
- **The switch is taken as a player takes it:** the body is placed on the pad by `__harbour.restore`, the offer is taken
  by clicking its screen-space button ("Run off"), and the run-off is **real keyboard input** — W held through the
  runtime's own key handler until the lip (13–31 s of wall time per launch on SwiftShader).
- **The flight is flown through the live controller's own `update(1/60, input)`** with the runtime paused, by an in-page
  pilot that has only a player's inputs (bar, bank; for the canopy brakes = bar pushed out, yaw = bank, pull) and reads
  only the controller's `probe()`/`hud()`. Reason: SwiftShader draws ~1 frame/s and the runtime caps a frame at 0.05 s of
  simulation, so a real-time ride would take ~20× its length. Every ~5 simulated seconds the runtime is un-paused with the
  same input for three rendered frames and a PNG is taken; touchdown, `exit()`, the fade/cut and the detach to feet are
  the runtime's own (un-paused). What this bypasses: the keyboard→bar mapping during flight (proven separately by the
  run-off, by `perf.json`'s real-time banked frames through `input()`, and by `test/horizonQuickLayerModes.test.ts`).
- **The pilot is a script, not a person.** Where a ride did not complete, the step log shows why; where the pilot's own
  flying was the cause (the Lamp Hop's dog-legs, the first Sands landing) that is said. The wind is the build's own:
  `constantWind()` = 4 m/s from the south everywhere, always (FLIGHT §2.2) — FLIGHT §0/§10's numbers are still air.
- The Crown **always runs off north** (FLIGHT §2.1, `wing.ts padHeading`: the south shoulder falls 1.4 m in 20 m), so
  every Crown ride starts with a turn.

## Results

| # | Ride (FLIGHT §11) | Flown | Result | Key numbers |
|---|---|---|---|---|
| 1 | Crown → the Lamp at trim (`crown_lamp_trim`, `&sun=11:00`) | yes | **not completed** — into the Bight 203 m short of the gallery; fade → Bight Shore | lip at 0.9 s after 13.2 s of W; north launch, round the summit west (lowest 5.9 m AGL at `[1118,462]`, t 36); SW leg at 11 m/s makes **7.58 m/s over the ground** crabbing into the south wind; water at `[666,0,1036]` t **132.5 s**; body after `[735,1,961]` |
| 1b | the same, crossing the Bight fast (`crown_lamp_fast`, bar ½ from `[779,857]`) | yes | **not completed** — water at `[663,0,1020]` t 123.3 s; fade → Bight Shore | 14 m/s, sink 1.8, 10.5 m/s over the ground across the Bight; 217 m short |
| 2 | Crown → the ridge → the Throat → the Deep, flared and unflared (`crown_ridge_throat`) | attempted | **not flyable in the build** — the ridge is below the Crown launch's reach and the Throat's mouth is behind rock | the wing, rounding west for the ridge box (z 625–715, floor h 80), met the west flank at `[1154,113,486]` t 37.8 s → tumble (no crash); north face across the aperture: 118.8 m at z 280, 124.7 at 285, 130.6 at 290, 131 at 300 vs aperture 101–119 at z 300 (pass-1 proof `sky.proofs.gates.throat.measuredAperture` = `[25, 0]`, `clear: false`). The corridor (chute, level run, small/big splash, three echoes, jetty) is proven only headlessly (`test/horizonThroat.test.ts`, `horizonGliderController.test.ts`) |
| 3a | the Prow → the Prow thermal → Long Sands at 15:00 (`prow_thermal_sands`) | yes | **completed — walk-off on Long Sands** | thermal core reached at 82 m (t 26.6); circled 82 → 200 m in 121 s (net +0.97 m/s drifting in the wind; FLIGHT's still-air +1.45); glide 200 → 96 m over the field; spiral down; flared touchdown `[1039,0.4,1484]` at 8 m/s, sink 0.3, t **324.8 s** |
| 3a′ | first attempt (`prow_thermal_overshoot_boundary`) | yes | evidence of the boundary row | the pilot's naive landing flew wings-level past the Sands out to sea; at z 1832 (beyond the 1800 extent) the boundary rule faded the rider to the shore ("→ the Landing") — no wall, no crash |
| 3b | the Prow at 07:00 → the Reach meadow (`prow_meadow_direct`, `prow_meadow_0700`) | yes (2 lines) | **not completed** — both lines meet the hill | straight line: the knoll at `[1458,55,874]` t 38 s (HANDOFF-notes L1, worse in the wind) → fade → the Prow; bent west: the hill at `[1474,70,780]` t 25.7 s → fade → the Prow. Flat-ground probe W1: −5.5 m in the south wind even without the knoll |
| 4 | the Lamp Hop under the Bight Bridge (`lamp_hop`; tries in `.lamp_hop_try3`) | yes (4 tries) | **not completed** | the deck's underside is **11.4 m** at `[556,1088]` (gate 5's aperture is centred at 6, 16 tall: its top 2.6 m are deck). A straight dive from the gallery (24.4 m) with the 4 m/s tailwind reaches the deck at 12.8 m → tumble onto the deck `[556,12,1088]`; a turn to lose height drifts north onto the deck (`[523,12,1078]`, tumble); a south-first line hits the bridge west of the gate (`[507,12,1070]`, fade → Bight Shore). A human might thread it; the scripted pilot did not |
| 5 | bail out over the Green from 200 m (`&bail=1040,1000,200`): stand-up (`chute_standup`) | yes | **completed — stand-up in the bullseye** | hand pull at 149 m AGL (t 2.2), canopy open at 156 m (t 3.45); into the wind at half brakes the ground speed is 0 (hover); flare at half brakes; walk-off **1.5 m** from the target (ring 0) at t 53.9 s, 0 m/s over the ground |
| 5b | the tumble (`chute_tumble`) | yes | **completed — tumble in the outer ring** | hand pull; full-brake flare into the wind → forward 2 → 0 leaves the wind's **4 m/s** → tumble 17.2 m from the target (ring 2), t 56.5 s |
| 5c | no pull (`chute_autopull`) | yes | auto-pull works; tumble off the rings | auto-pull at 45 m AGL; the 1.2 s opening costs ~15 m, so the canopy is fully open at ~30 m (≈ 14 s of canopy, not FLIGHT §12's "15 s"); full-brake flare → tumble 77 m north of the target |
| 6 | night flight Crown → the strip's lamp rows at 02:00 (`night_crown_strip`) | yes | **not completed** — 55 m east of the runway centreline, below it | the tail-light card is visible (`t0*.png`); touchdown `[491,27,665]` t 106.8 s in the Flats neighbourhood → fade → "The Flats" `[464,38,600]`. Flat-ground probe W1: +1.4 m in hand on the ideal straight line (still air +21.3). The reviewer's pilot aimed at the runway's middle; the builders' untracked browser run (not on the branch) aimed at its north end and walked off on the strip at ~105 s — the ride is completable, with little margin |
| 7 | reduced motion (`reduced_motion`, `reducedMotion: 'reduce'`) | yes | **completed** (the Crown sheet); the bail sheet **not reachable** | "Run off" → the sheet: the Green, the Reach meadow, Long Sands, the strip, "the Deep, through the Throat", the twelve pages, Stay here; no wing drawn, nothing attached; "the Green" → a cut to `[1040,18.3,1065]` on foot, walk mode, no blend. The bail sheet needs the plane (M7); the dev jump is refused under reduced motion by design |
| 8 | the Fold bubble from over the Flats (`fold_flats`, 15:00) | yes | **completed** | Crown → the Flats thermal (arrived 43 m, t 108); climbed to **250 m** in 194 s; the place bubble read "the strip · 137 m" (aria "Land now: the strip · 137 m"), the height bubble "216 m ↑"; one click → a cut to the strip `[435,38,690]` on foot. The "→ the strip" label was not caught on screen (SwiftShader: one frame outlasted its 2.5 s); the HUD run at lite widths shows it (`hud/`) |

**Tally:** completed 3a, 5, 5b, 7 (Crown sheet), 8; not completed 1, 1b, 3b, 4, 6 (all short of height or into terrain
in the build's 4 m/s south wind); not flyable 2 (the ridge and the Throat), 7's bail sheet (no plane).
In none of the 17 flights (including the superseded tries in `.lamp_hop_try3` and `.prow_thermal_sands_try2` — the
latter touched down 4 m outside the Sands' 60 m circle and was faded to the neighbourhood's apron, "→ The Landing & Long
Sands") was there a crash state, a wall, a stuck rider, an uncaught page error or a mode change without a threshold or a
landing (the only console errors: an unexplained dev-server 404 on some first page loads, not reproduced with URL logging): every flight ended in a walk-off, a tumble or a labelled fade/cut, on foot.

## Probe W1 — the journeys in the build's wind (`../m6-review/probes/W1-wind-journeys.json`)

The §10 pilots (`journeys.ts`), same flat-ground convention as `test/horizonGliderJourneys.test.ts`, still air vs the
build's 4 m/s south wind:

| Journey | Still air (the test) | South 4 m/s (the build) |
|---|---|---|
| Crown → the Lamp gallery (straight line, ideal launch) | reached, **+17.3 m**, 98.1 s | **not reached, −1.1 m**, 136.7 s |
| Crown → the strip | reached, +21.3 m, 79.2 s | reached, **+1.4 m**, 94.7 s |
| Prow → thermal (≤ 60 s) → Long Sands at 15:00 | reached, +19.4 m | **not reached, −6.4 m** |
| Prow → Reach meadow at 07:00 | reached, +24.5 m | **not reached, −5.5 m** |

## Not flown, and why

- The Throat corridor and splash (ride 2): the north face stands 0–30 m above the aperture in front of the mouth
  (HANDOFF-notes L5; pass-1's own gate proof measures the aperture 0 m tall). Land, pass 3.
- The ridge (ride 2's tactic): from the Crown's only lip (north) the ridge box is reached below the terrain.
- The bail sheet under reduced motion (ride 7b): the jump needs the plane (M7).
- Twelve Sketchbook pages with page E/G called out (FLIGHT §11 evidence): after the 2b merge.
- Mac and iPhone: this is headless evidence only (CONTRACT §2.21). Jonathan's rides are in `TEST-PLAN.md`.
