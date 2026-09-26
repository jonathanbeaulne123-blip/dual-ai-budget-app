# REVIEW — pass 2, track M6: the glider and the parachute

| | |
|---|---|
| Pass / track | Pass 2 (movers), M6 — glider + parachute, with the integrator seam it rides on |
| Base pin | `main@0f601b5` |
| Head reviewed | `claude/horizon-glider-cam@e4655b3` (25 commits, 57 files, +4 797 / −50) |
| Reviewer | Claude (reviewer-integrator subagent), 26 Sep 2026 |
| Read first, in order | `AGENTS.md`, `docs/AI_HANDOFF.md` (risk routing, required handoff), `docs/horizon/CONTRACT.md` §1–§2 and §6, `REVIEW-BRIEF.md`, `NOT-THIS.md`, `passes/02-movers.md` (rules 1–11, M6, Must not, Evidence required), `FLIGHT.md` (whole), then the diff and `git log --stat 0f601b5..HEAD`. `HANDOFF-notes/glider.md` was read for its requests and reconciled after the probes (§8). |
| Independence | This reviewer did not see the builders' conversations, prompts or plans. The only builder material read is what is committed on the branch. |
| Evidence | Probes `probes/W1-wind-journeys.json`, `probes/B1-bight-bridge.json`, `probes/B2-bight-bridge-solids.json`; rides `../m6/RIDES.md` + `../m6/rides/*/steplog.json` + PNGs; HUD `../m6/hud/`; performance `../m6/perf.json`; gates in `../m6/GATES.md`. |

## 1 · Verdict

The M6 code is sound and can be kept: the glider and the parachute fly on a small, pure, deterministic simulation that
obeys every CONTRACT §2 rule this reviewer could probe — the switch is always chosen (a threshold offer or a landing),
there is no wall and no crash state anywhere (17 headless flights ended in a walk-off, a tumble or a labelled cut, on
foot), the camera is horizon-locked (roll |r| < 1e-15° through ±40° of bank, `perf.json`), no mover imports the books,
no dynamic light and no world-space text were added, `src/core`, `src/ledgerSync` and `workers` are untouched (empty
`git diff --stat`), MANIFEST v1.7 regenerates byte for byte and the bake check passes. **What cannot go to Jonathan's
gate as FLIGHT §11 describes it is the sky's geography, not the mover:** two of the eight acceptance rides cannot be
captured in the build — the Throat (the north face stands 0–30 m above the aperture in front of the mouth; pass 1's own
gate proof measures the aperture 0 m tall) and the Lamp Hop (the V01 and S2 retaining walls fill the Bight Bridge's
underside from the sea to 11 m on the Lamp side of gate 5) — and in the build's own 4 m/s south wind, which FLIGHT
§0/§10 never measured, three more glides fall short (Crown → the Lamp, Prow → Reach meadow, Crown → the strip at
night). None of these is fixable inside M6 without a land change (pass 3, frozen here) or a design ruling on the
wind; both are written up for Jonathan and the next owner. Rides 3a (Prow → thermal → Long Sands), 5 (bail-out
stand-up in the bullseye and a tumble), 7 (the reduced-motion sheet → the Green) and 8 (the Fold bubble from 250 m)
completed. **Recommendation: KEEP the whole track; GO for a Mac/iPhone ride of the subset that works, NO-GO for the
Throat and the Lamp Hop until the land requests (L5, new L6) or a de-scope ruling.**

## 2 · Counts

| BLOCKER | MAJOR | MINOR | NIT |
|---:|---:|---:|---:|
| 2 | 2 | 9 | 6 |

Both BLOCKERs are "acceptance cannot be captured" (REVIEW-BRIEF §6) and are land (pass-1 geometry, frozen in pass 2):
not fixable by this reviewer under the pass's *Must not*. The two MAJORs need a design ruling or land; the reviewer
fixed what was fixable in-scope — the claims that were not true (FLIGHT.md, HANDOFF-notes) and the missing test for the
build's wind — see §9.

## 3 · Findings (most severe first)

| Id | Sev | Aud. | Where | Failure (observed vs expected) | Evidence | Fix direction | Keep / re-author |
|---|---|---|---|---|---|---|---|
| R6-01 | BLOCKER | 3, 5 | `[1300,270–300]`, gate 12; `underground.doors.throat`; `movers/glider/corridor.ts` (correct) | The Throat cannot be entered in the build. Across the aperture (x 1287–1313) the heightfield is 87.5 m at z 275, **118.8** at 280, 124.7 at 285, **130.6** at 290, 131 at 300 (mask from z 291, floor 110); gate 12's aperture is **101–119** at z 300. A wing inside the aperture at the mouth plane must have passed through rock ≤ 12 m earlier; from ≥ 131 m at z 290 no polar can drop to ≤ 119 by z 297. pass-1's own `sky.proofs.gates.throat` reads `measuredAperture [25, 0]`, `clear: false`. FLIGHT §11 ride 2 (and page G) cannot be captured; FLIGHT §2.5 is unreachable. | `../m6/RIDES.md` row 2; `.p3` north-face line; `public/horizon/world/horizon-geo-1.json` → `sky.proofs.gates`; HANDOFF-notes L5 (−35.3 m) | Land, pass 3: L5's notch (26 m wide, z 270→300, ≤ 100 m) and the mask floor 110 → ≤ 101. Until then take the Throat off Jonathan's pass-2 ride list (or Jonathan de-scopes it from the gate). No sky-only fix exists (raising gate 12 still leaves 131 m at z 290). | KEEP (`corridor.ts` is right; the place is the defect) |
| R6-02 | BLOCKER | 2, 3 | Bight Bridge approach, gate 5 `[560,1080]` h 6, 24 × 16, yaw −0.577; solids `V01.retaining.offshore@bight`, `S2.retaining.offshore@bight`, `bightBridge.deck@bight` | The Lamp Hop cannot be captured. Between the Lamp and gate 5's plane (8–28 m along its normal, ±12 m across) the geography is solid **from the sea to 11 m** — the V01 road's and the S2 skate line's offshore retaining walls — under a deck whose underside is 11.1–11.4 m. Gate 5's pass-1 proof (`clear: true`, measured `[24,16]`) tests only its own plane. The aperture's top 2.6 m are deck. Four scripted tries ended on the deck (tumble, y 12) or against the bridge (fade → Bight Shore); none can pass below 11 m. FLIGHT §0 row 4 and §11 ride 4, and HANDOFF-notes "the Lamp Hop clears", are not true in the build. | `probes/B2-bight-bridge-solids.json`, `probes/B1-bight-bridge.json`; `../m6/rides/lamp_hop`, `.lamp_hop_try3` | Land, pass 3: new request **L6** (added to HANDOFF-notes): open the Bight Bridge's underside on the Lamp side (the V01/S2 offshore approach as spans on piers, not retaining walls to the seabed) or move gate 5 / the Lamp Hop's line; gate proofs should sweep the whole passage, not the plane. | KEEP (mover); the place is the defect |
| R6-03 | MAJOR | 4, 5 | `movers/shared/wind.ts` `constantWind()`; `movers/glider/env.ts:95`; `journeys.ts`; `test/horizonGliderJourneys.test.ts`; FLIGHT §0, §10, §12 D34 | The sky's journeys are measured in still air; the build never flies still air (`constantWind()` = 4 m/s from the south, everywhere, always, FLIGHT §2.2). In it, on flat ground with the ideal straight line: Crown → the Lamp **−1.1 m, not reached** (still air +17.3 m, 98.1 s); Prow → thermal (≤ 60 s) → Sands **−6.4 m**; Prow → Reach meadow **−5.5 m**; Crown → the strip **+1.4 m** (still +21.3). Live: ride 1 lands in the Bight 203 m short (7.58 m/s over the ground crabbing into the wind), 1b 217 m short; the night ride aimed at the runway's middle fell 55 m short (a line to its north end lands — the builders' untracked browser run, §8). `journeys.targets_s["crown→lamp by glider"]` 70–110 (D34, "measured 98.1 s") is not met in the build: the flight does not arrive. A MANIFEST target and a FLIGHT claim are not true as built. | `probes/W1-wind-journeys.json`; `../m6/rides/crown_lamp_trim`, `crown_lamp_fast`, `night_crown_strip`, `prow_meadow_*` | A design ruling for Jonathan (proposed **D39**): (a) calm (0 m/s) placeholder wind until pass 2b's wind clock — but the ridge lift and the parachute's ruled stand-up both depend on the 4 m/s south wind and must be re-read; or (b) keep 4 m/s and retarget D34 / the §11 rides to what the wind allows (Crown → the Lamp is not a trim glide in it). Either way the journeys test flies the build's wind (done here, §9). | KEEP-FIX (`journeys.ts` / tests: fly the build's wind) |
| R6-04 | MAJOR | 3, 5 | `movers/glider/wing.ts` `padHeading` (correct); Crown pad `[1310,440]` h 160; ridge box `[1310,180,670]` ± `[200,100,45]` | The ridge — FLIGHT §2.2's "intended way to bank height for the Throat" — cannot be reached from the only launch that serves it. The Crown always runs off north (its south shoulder falls 1.4 m in 20 m; disclosed FLIGHT §2.1); turning back costs ~11 m and the summit, west and east flanks stand 110–157 m while the box's usable floor is the south face at ~110 m. Live: rounding west toward the box the wing met the west flank at `[1154,113,486]`, 37.8 s after launch (a tumble, correctly). The Prow launches at 100 m beside terrain 82–109 m at the box's east end. | `../m6/rides/crown_ridge_throat`; HANDOFF-notes L3/L4; `it.fails` "Crown → ridge" | Land, pass 3 (L4: a graded south lip at the Crown, ≥ 10 m in 20 m) — or move the ridge volume to a face the Crown's north lip can reach. | KEEP |
| R6-05 | MINOR | 4 | `movers/glider/env.ts:175` (walls), `:191` (`solidAt`), `camera.ts:153` | The builders' hot spot, measured: right after the lip ~8.3 `geography.blocked` calls per rendered frame cost **2.6 ms/frame (full) and 2.1 ms (lite)** on this container (0.26–0.31 ms/call near the pad's railings, 0.004 ms/call once clear); the mover's whole step is 0.38 ms mean / 8.4 ms max near the Crown, 0.11 ms descending. Transient (the first seconds near structures), inside CONTRACT §6's draw-call and residency budgets (34/32 calls, 4/3 resident), but ~15 % of a 60 fps frame while it lasts and unmeasured on a phone. | `../m6/perf.json` | Skip the wall/solid tests when the rider's cell holds no structure triangle (cache per 8 m cell), or test walls only along the travel direction; measure on the iPhone in Jonathan's ride. | KEEP-FIX |
| R6-06 | MINOR | 5 | `movers/glider/art.ts:46` | The white tail-light card (glider) and harness card (parachute) are always visible; FLIGHT §5 / LIGHT §3: light cards dusk → dawn, counted against the lite 48-card cap. Visible at noon in every ride PNG. | `../m6/rides/*/t*.png` | Show the card only when the runtime's sun says night (the runtime's `night` flag already drives the local lights). | KEEP-FIX |
| R6-07 | MINOR | 5 | `runtime/index.ts:180` | While a mover is attached the ambience is updated with speed 0: FLIGHT §5's wind rush "scaled by airspeed (quiet at 9, a roar at 17 and in freefall)" never plays. The vario, snap and echoes are wired. | code | Pass the mover's airspeed (`probe().airspeed` / `hud`) to `ambience.update`. | KEEP-FIX |
| R6-08 | MINOR | 3 | `HorizonStage.tsx:99` | The reduced-motion sheet (`role="dialog"`, `aria-modal="false"`) takes no focus: the "Run off" button that had it is unmounted, so focus falls to `<body>`; no Escape (only "Stay here"). A keyboard or screen-reader user must hunt for the sheet. | `../m6/hud/hud.json` (`focus` rows) | Focus the first landing on open; Escape = Stay here; return focus to the stage after the cut. | KEEP-FIX |
| R6-09 | MINOR | 3 | `HorizonStage.tsx:30` | The status line keeps "Space jumps; E opens a nearby door" in flight, where Jump and Enter are hidden and Space pulls (FLIGHT §2.3). | every ride PNG | Mode-aware status copy (in flight: "W/S the bar, A/D bank, the right bubble lands you"). | KEEP-FIX |
| R6-10 | MINOR | 5 | `sky.proofs.gates.bightBridge` (pass 1), gate 5 | Gate proofs measure only the gate's plane (see R6-02): `bightBridge` reads `clear: true` while its approach is walled. The same blind spot can hide other gates' passages (the pass-4 courses read these gates). | `probes/B2` | Sweep each gate's aperture ± 30 m along its normal in the proof. | — (pass 1/3) |
| R6-11 | MINOR | 3 | `runtime/index.ts` `setReducedMotion`; FLIGHT §6 | Turning reduced motion on mid-flight keeps flying (blends become cuts, FOV fixes, lean off); FLIGHT §6 says there is no flight under reduced motion. | code | On `setReducedMotion(true)` while a flight is attached, offer the sheet (landings) as the Fold does. | KEEP-FIX |
| R6-12 | MINOR | 3 | FLIGHT §3.1; `movers/glider/index.ts` provider | "Too low to jump" (the bubble below 60 m AGL) is not shown: the provider returns null and nothing is said. It belongs to the plane's HUD (M7). | code | M7 shows it from the same provider's `minAgl`. | — (M7) |
| R6-13 | MINOR | 5 | FLIGHT §12 D37 | "45 m gives a 15 s canopy ride": the 1.2 s opening from 30 m/s costs ~15 m, so the canopy is open at ~30 m AGL (≈ 14 s including the flare's slower sink). Measured in `chute_autopull`. | `../m6/rides/chute_autopull` | Reword D37's rationale (or pull at 60 m for a real 15 s). | — |
| R6-20 | MINOR | 3 | `horizon.css` `.horizon-sheet` | The reduced-motion sheet is 392 px wide at a 390 px viewport (`width: min(420px, calc(100% − 32px))` with 16 px padding and a border, content-box): it sits 1 px off both edges and the page scrolls 1 px sideways (`scrollWidth − clientWidth = 1`); the same at 320. | `../m6/hud/hud.json` (sheet rows), `../m6/hud/390_*_reduced-motion-sheet.png` | `box-sizing: border-box` on the sheet. | KEEP-FIX |
| R6-14 | NIT | 3 | `env.ts:76`, `AREA_LABELS` | Labels mix "The Flats" / "The Hollow" (neighbourhood labels) with "the Hollow" (area labels) in the same bubble. | `../m6/rides/*/steplog.json` `place` | One case. | — |
| R6-15 | NIT | 3 | `HorizonStage.tsx` offers | Keyboard activation of a hold offer (the plane's Jump) takes it at once (`e.detail===0`); defensible for accessibility; say so in the handoff. | code | — | — |
| R6-16 | NIT | 5 | `horizon.css` | The HUD glass has no dark treatment (nor has the rest of the Horizon chrome); identical in light and dark captures. | `../m6/hud/*_dark_*` | With the kit's dressings. | — |
| R6-17 | NIT | 4 | `test/horizonGliderLanding.test.ts:69` | The title says "stand-up only with full brakes"; the ruled rule (and the test body) is ≥ half brakes. | code | Retitle. | — |
| R6-18 | NIT | 4 | `wing.ts:153` | The stall (< 7.5 m/s) is unreachable in play: the bar's floor is 8, the flare's 8. Harmless; tested directly. | code | — | — |
| R6-19 | NIT | 4 | `HorizonStage.tsx:18` | `HOLD_MS` is hard-coded while the manifest carries `carriedThresholds.bailOut.hold_s`. | code | Read the manifest. | — |

## 4 · Hard-rule and brief checks (all probed; pass unless a finding is named)

| Rule / check | Result | How |
|---|---|---|
| CONTRACT §2.4 you always choose the switch | pass | only `accept(offer)` attaches (registry refuses anything not offered now; `horizonModeRegistry`); the run-off needs held forward input (13–31 s of real W in every ride); every end is a landing, Fold or a cut; `shot`, `setMode`, `enterDoor` refuse while riding |
| §2.4 no invisible walls | pass | the ceiling fades lift (no wall); the world boundary is a shore fade (`prow_thermal_overshoot_boundary`, z 1832); structures are met as landings (R6-02's tumbles are on the visible deck); terrain is visible terrain |
| §2.3 no fake life | pass | the partner ghost is untouched; the wire carries no flight act; D38 is a written request only |
| §2.1 play earns nothing; nothing in the sky reads a balance | pass | `test/horizonGliderNoMoney.test.ts` (static fence over every import under `movers/**`); grep of the diff: no money word in the HUD |
| §2.9 money one tap away (the quick layer stays) | pass | `test/horizonQuickLayerModes.test.ts` (same toolbar node through launch, flight, corridor, freefall, fade); rides: toolbar present in every PNG (the review page has no Tools/Journey props; the App passes them) |
| §2.10 reduced motion = cuts; calm the same | pass (R6-08, R6-11) | ride 7: sheet, cut on foot, no blend, no wing; FOV 55 fixed; lean 0; dev jump refused |
| no world-space text; no dynamic lights | pass | diff grep: no `*Light`, `TextGeometry`, `CanvasTexture`, sprites; the tail light is a `MeshBasicMaterial` card (R6-06 for its hours). (The runtime's pre-existing pass-1 `localLights` — 6/4 `PointLight`s near threshold lamps at night — are not M6's and were not changed.) |
| presence wire, `src/core`, Worker untouched | pass | `git diff --stat 0f601b5..HEAD -- src/core src/ledgerSync workers` → empty |
| camera roll invariant (FLIGHT §4) | pass | `ModeCameraPose.roll: 0` by type; the runtime sets `up (0,1,0)` + `lookAt`; measured roll ≤ 6e-16° with bank −33.5…+40° at both tiers (`perf.json`) |
| the outcome table (§2.4) | pass | seen live: walk-off (Sands, the Green), tumble (flank, deck, Green), shore fade (Bight ×4, boundary), apron fade (the Prow, the Flats, the Landing), Fold cut; the Deep rows only headless (`horizonThroat`, `horizonGliderController`) |
| the Throat cone | pass (unreachable, R6-01) | `enterCorridor`: glider only, heading within ±25° of the axis, \|bank\| ≤ 20°, inside the aperture ± 3 m of the plane; tried within 40 m; else `null` (a miss, not a wall) |
| the carried `bailOut` | pass | manifest `carriedThresholds` → `WorldDefinition.thresholds` with `carried: 'plane'`, `at [NaN,NaN]` (baked as `null`), no pad/lamp; offered only through a provider and only ≥ 60 m AGL; a 0.5 s hold in the HUD; plane → parachute accept enters at the moving door (`horizonModeRegistry`) |
| MANIFEST v1.7 regeneration | pass | `python3 docs/horizon/make_manifest.py` in a temp dir → `cmp` identical to `src/harbour/horizon/world/MANIFEST.json` (v1.7); `docs/horizon/MANIFEST.md` is a pointer to it; `node scripts/horizon/bake-terrain.mjs --check` passes (terrain `.bin` unchanged, sha `d5c8ad20…`, world JSON 32 505 806 B / gz 7 667 687 B match the committed files) |
| CONTRACT §6 in flight | pass (R6-05) | 34 / 32 draw calls, 83 k / 39 k triangles, 4 / 3 districts resident (full / lite); frame rate not measurable headlessly (SwiftShader: 2.0 s / 0.5 s per frame) |

## 5 · Probes

The land probes P01–P32 were not re-run: this track changes no geography (the terrain asset is byte-identical, the bake
check passes, solids unchanged — only the sky's fields, the thresholds list and the envelope were added). Pass-2 probes:

| Id | Probe | Value | Threshold | Result |
|---|---|---|---|---|
| M6-P1 | MANIFEST regeneration | byte-identical | identical | pass |
| M6-P2 | `bake-terrain --check` | pass, 29 s | pass | pass |
| M6-P3 | `src/core`, `src/ledgerSync`, `workers` diff | empty | empty | pass |
| M6-P4 | camera roll in a banked real-time flight | ≤ 6e-16° | 0 | pass |
| M6-P5 | W1 journeys in the build's wind | Crown→Lamp −1.1, Prow→Sands −6.4, Prow→meadow −5.5, Crown→strip +1.4 m | ≥ 0 (FLIGHT §10) | **fail** (R6-03) |
| M6-P6 | the Throat's approach, x 1300, z 270→300 | terrain 56 → 131 m vs aperture 101–119 | aperture open | **fail** (R6-01) |
| M6-P7 | B1/B2 the Bight Bridge passage | solid 0–11 m at 8–28 m along gate 5's normal | open ≤ 14 m | **fail** (R6-02) |
| M6-P8 | `blocked` cost near a pad | 2.6 / 2.1 ms per frame (full / lite) for ~1–2 s | — (no budget line) | note (R6-05) |
| M6-P9 | HUD: offer row, bubbles, fade label at 320/390/720/1100, light/dark; sheet at 390/1100 | offer 58 px tall, height bubble 69 × 62, place bubble 172 × 44, no target < 44 px, no overflow in flight; "→ the Green" shown at 320/390 (at 720/1100 one SwiftShader frame outlasted the label's 2.5 s — not a defect); sheet: focus on `<body>`, 1 px overflow at 390 | 44 px targets, no overflow | pass with R6-08, R6-16, R6-20 |
| M6-P10 | reduced-motion cut | on foot at the Green, no blend, walk mode | a cut | pass |

## 6 · Pages

Not captured in this review: the twelve pages (with page E, a wing on the rack, and page G, the flare onto the Deep)
are FLIGHT §11 evidence **after the 2b merge**; page G cannot exist until R6-01 is fixed.

## 7 · Keep / re-author

| Module | Verdict | Findings |
|---|---|---|
| `movers/shared/{mode,threshold,vehicleArt,wind}.ts`, `movers/registry.ts` | KEEP | — |
| `runtime/moverHook.ts`, mover wiring in `runtime/index.ts` | KEEP-FIX | R6-07, R6-11 |
| `HorizonStage.tsx`, `horizon.css` (offers, bubbles, sheet) | KEEP-FIX | R6-08, R6-09, R6-15, R6-16, R6-19, R6-20 |
| `movers/glider/{polar,lift,wing,chute,corridor,landing}.ts` | KEEP | R6-18 |
| `movers/glider/env.ts` | KEEP-FIX | R6-05, R6-14 |
| `movers/glider/{controller,camera,index}.ts` | KEEP | — |
| `movers/glider/art.ts` | KEEP-FIX | R6-06 |
| `movers/glider/journeys.ts` + journeys test | KEEP-FIX | R6-03 (fly the build's wind; done in §9) |
| `mountain/audio.ts` (`snap`, `splashEcho`, `vario`) | KEEP | — |
| MANIFEST v1.7 (`make_manifest.py`, `sky.ts`, `definition.ts`, `build.ts`, `manifest.ts`) | KEEP | — |
| The sky's geography (the Throat's approach, the Bight Bridge passage, the Crown's lips) | RE-AUTHOR in pass 3 (land) | R6-01, R6-02, R6-04 — not M6's modules |

## 8 · Reconciliation (claims read after the findings were drafted)

| Claim (where) | True? |
|---|---|
| FLIGHT §0 row 1 / §10 / D34: Crown → Lamp arrives with 17 m spare, "measured 98.1 s" | **true in still air only**; false in the build's wind (R6-03). Reproduced 98.1 s / +17.3 m in still air (W1). |
| FLIGHT §0 row 4 / HANDOFF-notes "the Lamp Hop clears" | **not true** in the build (R6-02): the flat-ground sim has no bridge |
| FLIGHT §2.5 / DECISIONS "the Throat is earned" (+2.6 m after the ridge, +24.8 m from 190 m) | true of the flat-ground sim; **not flyable** in the build (R6-01, R6-04) — HANDOFF-notes L5 says so honestly |
| HANDOFF-notes L5 numbers (north face 98–131 m, mask floor 110 vs aperture floor 101) | **true** (reviewer's line: 87.5/118.8/124.7/130.6/131 at z 275/280/285/290/300) |
| HANDOFF-notes L1 (knoll at `[1450,872]`, −13.4 m) | **true**, and worse in the wind: the live straight line met it at `[1458,55,874]` |
| HANDOFF-notes "Prow → thermal → Sands clears by +18.6 m" | true; **completed live** (walk-off on the Sands at 324.8 s after climbing to 200 m) |
| HANDOFF-notes sim requests 1 and 2 done | **true** (tests pass; the controller uses `launchFromPad`) |
| FLIGHT §2.1 "the Crown always runs off north" | **true** (every Crown ride; W1 `crownLaunchHeading` = π facing either way) |
| FLIGHT §3.3 ruling: half-brake flare into the south wind stands up, full-brake tumbles | **true** (live: 0 m/s → walk-off 1.5 m from the target; 4 m/s → tumble) |
| FLIGHT §12 D37 "45 m gives a 15 s canopy ride" | approximately (≈ 14 s; R6-13) |
| Builders' untracked browser evidence left in the worktree (`evidence-glider/`, `delivery/`; not on the branch, read after drafting) | consistent on rides 2, 3, 5, 7: the Throat and the ridge not flyable, the Sands walk-off, the stand-up (0.6 m) and tumble, the sheet. It reports the Lamp Hop "through gate 5 inside the aperture, 5.6 m above its centre" — i.e. at 11.6 m, over the deck and the V01 bed (≥ 11 m), not under the bridge: consistent with R6-02. It lands the night ride by aiming at the strip's north end (the reviewer's centre line fell short). It lands ride 1 ~130 m short (the reviewer's 203 m: a different line). Copied into the delivery as `evidence/builders-untracked/`. |
| "geography.blocked ~0.5 ms/call near pads" | measured 0.26–0.31 ms/call in the first real frames off the Crown pad (R6-05) |
| DECISIONS D34–D38 applied pending Jonathan | true as recorded; D34's evidence is still-air (R6-03) |

## 9 · Fixes made by the reviewer (after this report was drafted)

No BLOCKER or MAJOR above can be fixed inside M6: R6-01, R6-02 and R6-04 are land (pass 3; the pass forbids geography,
beds and structures), and R6-03 needs Jonathan's ruling on the wind. What was fixable in-scope — the claims that were
not true, and the missing test — was fixed in separate commits:

1. **docs(horizon): M6 review reconciliation** — FLIGHT.md gains a reviewer's section (the build's wind numbers, the
   Lamp Hop's walls, the Throat's rock, the D39 question); HANDOFF-notes/glider.md gains land request **L6** (the Bight
   Bridge passage) and corrects "the Lamp Hop clears".
2. **test(horizon): the journeys in the build's wind** — `test/horizonGliderJourneysWind.test.ts` flies the §10 pilots
   in `SOUTH_WIND` and pins the measured numbers (the unreachable ones as `it.fails`, the same convention the builders
   used for terrain), so the gap stays visible until D39 is ruled.

No source file under `src/` was changed by the reviewer.
