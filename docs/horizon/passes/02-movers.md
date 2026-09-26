# Pass 2 — Movers

Builders: **Claude subagents**, one per mover (nine), one integrator, one reviewer who has not seen the work. Runs in parallel with pass 2b (the kit). Gate: Jonathan rides each mode on his Mac and iPhone. Delivery: `~/Downloads/hearth-horizon-p2-movers/`.

---

## Purpose

Give the island its nine ways to move beyond feet (Grand Plan ch. 6): board, bicycle, gondola, Ore Line, zipline, glider (with parachute), plane, balloon, boats (with the Ferry). Each mode has its own geometry (already cut in pass 1), its own camera, its own threshold with a deliberate action, one sound you make on purpose, its reduced-motion behaviour, its night state and its acceptance ride.

Feet are Mountain v2's walk (Walk 12°, Look, Close) and are not rebuilt; the integrator keeps them working at every threshold.

## Inputs

| Input | Keys / sections |
|---|---|
| `CONTRACT.md` | §2.1, §2.3, §2.4 (you always choose the switch; no invisible walls), §2.5, §2.9 (money one tap away in every mode), §2.10 (reduced motion, calm view), §6 |
| `MANIFEST.json` | `surfaces`, `profiles`, `skate`, `roads`, `walks`, `cable`, `rail`, `water_routes`, `structures`, `underground`, `sky`, `thresholds`, `crossings`, `journeys`, `speeds_ms` |
| `LIGHT.md` | §1 (night readable), §3 (running lights, runway lamps, the Lamp), §6 (lite 48-card cap) |
| `STYLE.md` | §1.1, §1.2, §1.6, §1.11 (light cards, running-light colours), §1.12, §3.1 vehicle and station rows (art arrives from pass 2b) |
| `inputs/grand-plan.html` | ch. 6 (modes), ch. 8 (skate lines), ch. 9 (the sky), ch. 4 (Ore Line, the Throat) |
| `RIDE.md` | **M1 and M2 read it in full**: the ground kernel, the tyre step, S/A/D, the slide→boost loop, the pace table (§8.3), the five situations (§9), the consolidation table (§7) and D39–D46. Where M1 below and `RIDE.md` disagree, `RIDE.md` wins. |
| `FLIGHT.md` | M6 reads it in full (D34–D38) — *pending the FLIGHT patch; not on `main` at v1.6* |
| Code at `PIN-1` | Skate v2 `src/harbour/skate/{sim,driver,session,world/field,hud,parkScene}`; Mountain v2 `transport.ts`, `race.ts`, `audio.ts`, `body/ride.ts`, `camera/{rideCamera,flight,director,obstruction}.ts`; the Horizon `WorldDefinition` (`src/harbour/horizon/world/build.ts`) and `sky/envelope.ts` |

## Base SHA rule

- Branch `claude/horizon-movers` from `PIN-1`. Pass 2b branches from the same pin.
- No geography change in this pass (`horizon-geo-1` stays). A mover that needs the land changed writes the request in `HANDOFF-notes/<track>.md`; it goes into the pass-3 land touch-up.
- Pass 2 and pass 2b merge together into `PIN-2` through one integration branch `claude/horizon-p2-integrate`, owned by this pass's integrator.

## Rules every mover obeys

1. **The switch is chosen.** A mode starts and ends only at a `WorldDefinition.thresholds` entry, by the named action (`park`, `pick up`, `board by offer`, `sit, lever`, `clip in`, `run off`, `climb in`, `step in`, `untie`, and for the Ferry: walking onto its deck across the gangway). No silent mode change; no teleport except a labelled skip or a reduced-motion cut.
2. **No invisible walls.** A mover's limit is a visible lip, a slope it cannot climb, or water it fades back from (300 ms fade to the nearest dock, apron or shore, never a dead stop).
3. **The rider is in the vehicle.** Seated, clipped or standing in it, visible from the ride camera; never floating beside it.
4. **Money one tap away.** The quick layer (the Desk's quick-travel bar) stays visible and working in every mode, underground, in the air and on the water.
5. **No collisions with people.** Movers pass through bodies; a gust or a ripple says so.
6. **Art is the kit's.** Each mover renders a greybox proxy through `VehicleArt` (below) until pass 2b's piece lands; dimensions and anchors are fixed by the interface, never by the proxy.
7. **Reduced motion.** Passive rides (gondola, Ore Line, zipline, Ferry, the balloon's climb, the plane's one-button ring) become a 300 ms fade cut to the far threshold. Free flight (glider, plane) becomes cuts between the twelve pages (`sky.rules`). User-driven modes (board, bicycle, rowing) stay playable with no camera shake, roll, bob or FOV change.
8. **Calm view.** The island is still, silent and lit: ambient vehicles (gondola cabins, the Ferry) rest at their stations; no mover audio; rides behave as under reduced motion.
9. **Night.** Every vehicle's running lights come from `STYLE §1.11` (port `#e0463a`, starboard `#3fb07a`, white `#f6f4ea`) as light-card anchors, on dusk → dawn (`LIGHT §3`). No dynamic point lights.
10. **Play earns nothing.** No mover reads, displays or changes any financial state. The S1 race keeps its existing "Open the Fund" door at the finish, unchanged.
11. **Presence.** No change to `src/ledgerSync/worldPresenceWire.ts` or `workers/ledgerRoom.ts` in this pass. Broadcasting a mode or a sound to a partner is a wire change: write it as a request for a Codex trust review, do not build it.

## Shared interfaces (integrator, commit 1)

| File | Contents |
|---|---|
| `src/harbour/horizon/movers/shared/mode.ts` | `ModeId` union (`feet`, `board`, `bicycle`, `gondola`, `cart`, `zip`, `glider`, `parachute`, `plane`, `balloon`, `row`, `canoe`, `dinghy`, `ferry`); `ModeController` interface: `enter(threshold)`, `update(dt, input)`, `exit(threshold)`, `camera()`, `sound()`, `reducedMotionCut()` |
| `src/harbour/horizon/movers/shared/threshold.ts` | `ThresholdOffer`: threshold id, from → to modes, action label, visible marker anchor |
| `src/harbour/horizon/movers/shared/vehicleArt.ts` | `VehicleArt`: `build(dressing, tier)`; anchors `seat[]`, `cameraMount`, `runningLights[]`, `contact`; fixed dimensions per vehicle (pass 2b implements) |
| `src/harbour/horizon/movers/shared/wind.ts` | `WindSample { dir, speed }` read-only interface (pass 2b's wind clock implements it; until then a constant south wind at 4 m/s) |
| `src/harbour/horizon/movers/registry.ts` | one active mode; transitions only through `ThresholdOffer` |
| `src/harbour/horizon/movers/shared/ground/**` | **The ground kernel** (`RIDE.md §2, §11`): `GroundState`, `GroundProfile`, `stepGround`, the tyre step, the legs, the three-point contact, the ride log. Written by **M1** (its first client), interface reviewed by the integrator on commit 1, consumed by M2 through a `GroundProfile`; M2 requests kernel changes in `HANDOFF-notes/bicycle.md`, never edits it. |

## Tracks

| Track | Mover | Owns | Must not touch |
|---|---|---|---|
| M1 | Board | `src/harbour/horizon/movers/shared/ground/**` (the kernel), `src/harbour/horizon/movers/board/**`, `src/harbour/skate/sim/**` (retired into the kernel and the board's components), `src/harbour/skate/world/field*` (the park, behind `surface()`) | every other mover folder; the other seam files |
| M2 | Bicycle | `src/harbour/horizon/movers/bicycle/**` (a `GroundProfile` of M1's kernel, `RIDE.md §8.1`; kernel changes are requested from M1) | `src/harbour/skate/**`, `movers/shared/ground/**` |
| M3 | Gondola | `src/harbour/horizon/movers/gondola/**` | `transport.ts` (integrator) |
| M4 | Ore Line | `src/harbour/horizon/movers/oreLine/**` | `transport.ts` (integrator) |
| M5 | Zipline | `src/harbour/horizon/movers/zip/**` | `body/ride.ts` (integrator) |
| M6 | Glider + parachute | `src/harbour/horizon/movers/glider/**` | `camera/flight.ts` (integrator), `sky/envelope.ts` (read only) |
| M7 | Plane | `src/harbour/horizon/movers/plane/**`, `src/harbour/horizon/world/lights/strip.ts` (runway and windsock lamp anchors) | `camera/flight.ts`, other `world/lights/*` |
| M8 | Balloon | `src/harbour/horizon/movers/balloon/**` | `camera/director.ts` (integrator) |
| M9 | Boats + Ferry | `src/harbour/horizon/movers/boats/**`, `src/harbour/horizon/movers/ferry/**`, `src/harbour/horizon/world/lights/ferry.ts` | other `world/lights/*` |
| I | Integrator | `movers/shared/**`, `movers/registry.ts`, `src/harbour/scene/runtime.ts`, `src/harbour/HarbourWorld.tsx`, Mountain v2 `transport.ts`, `race.ts`, `audio.ts`, `body/ride.ts`, `camera/{rideCamera,flight,director}.ts`, the quick layer, `src/house/navigation.ts` | `src/core/**`, the presence wire, the Worker, pass 2b's folders |
| R | Reviewer | `evidence/review/**` only | everything else |

All tracks: must not touch `src/core/**`, `src/harbour/data/reading.ts`, `src/harbour/village/layout.ts`, `src/harbour/court/dressing.ts`, `src/harbour/horizon/land/**`, `src/harbour/horizon/kit/**`, `src/harbour/horizon/sun/**`, the Desk.

On commit 1 the integrator generalises `transport.ts` to a line-driven ride API (`createRide(lineId, stations, speedProfile, attachment)`) and `body/ride.ts` to a seat/clip attachment, so that M3, M4 and M5 write only inside their folders.

---

## M1 — Board

**Read `RIDE.md` in full; it is this section fleshed out and it wins over the bullets below.** M1 builds the ground kernel first (`RIDE.md §2–§4`, `§11`), then the board on it; Skate v2's ground model is retired by the consolidation table (`RIDE.md §7`), its air, rails, wallride, manual and tricks are kept as components.

- **Uses:** `skate.S1`–`S4` beds and segment `surface` ids; `skate.park`; `skate.rules`; `beds[*].surfaceSegments[*].pace` and (MANIFEST v1.7) `paces`, `surfaces[*].grip`; thresholds `skateLineStarts.1–4`, `stairTop`, `quayWest`, `landingQuay` and every `crossing.<i>` with `board→feet`; `skate.S1.gates` 17, the S1 finish at `structures.landingQuay` (`[1270,1330]`), `skate.S1.time_target_s`; the separated lanes on the Quay Bridge (S3) and the Bight Bridge (S2), the Dune Culvert (S4).
- **One motion model:** the ground kernel (`movers/shared/ground/`) owns velocity, heading, yaw rate, grip and contact; fixed step 1/120 with an accumulator; three-point contact on `geography.surface()`; forces in one order: gravity (real, g 12, everywhere — travel assist is retired, `NOT-THIS.md` line 42), rolling resistance by pace, drag, the legs, the tyre step. No other file writes velocity or heading.
- **Pace is physics:** the bed *segment's* pace (`surfaceSegments[*].pace`, the design lead's word) sets rolling resistance and push grip (`MANIFEST.paces`: fast 0.12 / flow 0.25 / slow 0.6 / threshold 1.8; v1.7), the surface id sets grip (`surfaces[*].grip`), `RIDE.md §8.3`. No caps, no zones. Every threshold pad is `threshold` pace (its 6 m stop a board arriving under ~4.6 m/s), the 25 m run-outs are slow paving where S is the brake, and the pad offers `park`; beyond a board→feet pad, and off any bed the profile lists, the wheels dig in (`offbed`, roll 6.0) and a 300 ms fade returns the board to the bed it left, stopped — the board is bed-bound with no invisible wall (`CONTRACT §2.4`, D43). At-grade crossings where a line continues (S4 × VBS, S4 × VG, S2 × the pier walk, S4 × the garden walk) are crossed at walking pace with the kerb gap.
- **Steering, slide, twist (D39):** A / D yaw the board; velocity follows through grip; a carve is grip within its limit (0.9 G, so the radius at speed is the wheels' — 13.9 m at 10 m/s on paving), a slide is the remainder. **S** breaks the wheels loose at ≥ 2.5 m/s (kick-out nose-in tail-out, grip → slide grip) and foot-brakes below it; **S held with the stick centred holds a 40° slide** (2 m/s² of net braking on S1's 15 %); A / D deepen, countersteer (assist × 1.5) or commit past 90° into the twist (lead flips, no revert key); grip returns continuously (`bite · cos²β`), never a snap. C and X are removed.
- **Boost (D41):** the pump out of a slide — charged by a held, fast, controlled slide (set delay 0.35 s, ≥ 3 m/s, full after 1.55 s at 45°), released only by **W** in the 0.5 s window after a clean exit (|β| < 25°), +2.5 m/s over 0.6 s at full charge; never automatic, never a net gain on the flat; the charge crouch is pose only (it never feeds the pump or the landing); ordinary braking never reads as a failed trick.
- **Gravity:** real everywhere (g 12, D40); downhill runs toward the drag-set terminal (~13.4 m/s on S1's paved 15 %, 14.8 on an 18 % bed); uphill you push. The Tideline park keeps only forgiving landings (`landing.forgiveness` in the park overlay; `skate.park.note` changes accordingly, v1.7).
- **Spots:** rails, kerbs, walls, bollards, stairs and bank lips from pass 1's beds only; no required jump; every spot has its ground line. Kerbs (0.15) and risers (0.17) are lips for the wheels (`stepMax` 0.12): ollie or stop, visibly.
- **Race:** S1 with its 17 gates and Mountain v2 race scaffolding (`race.ts`, integrator) re-based on the Horizon bed; finish at the Landing quay with its 25 m run-out, kerb-separated from V01; Retry restarts in every state (A4). **No run-out auto-brake** (D43): the rider brakes; `landingQuay` is the park.
- **Landing:** one rule — impact keeps speed by Skate v2's impact curve; a sideways landing lands *in a slide* (`grip = cos²β`) that the tyre step resolves; a bail only on hard impact (7.6 / 11.5 crouched). Water is the 300 ms fade back onto the board at the nearest bed point, never a bail and never onto feet.
- **Camera:** Skate v2 skate cam with **roll 0 at every tier** (rule 7 extended to all riding so the board's heading is always legible) and the yaw target on the velocity direction (a slide moves the board across the screen, not the world); FOV by speed at full tier only (fixed under reduced motion and calm view); race shots from `race.ts`. Horizon always in frame on the Crown drop. Handoffs ≤ 30 eu.
- **Threshold:** pick up at `skateLineStarts.1–4`; park at `stairTop`, `quayWest`, `landingQuay` and every threshold a line meets (the `threshold` rows of `crossings`: S2's dismount at `[660,1170]`, S2 × the Wash bed (the Wash Run closes at its marker for six hours after drizzle), S2 × the Bight pier walk, S4 × VBS `[874,941]`, S4 × VG `[973,538]`, S4 on the Hollow Bridge at walking pace, S3 × the town quay at `quayWest`). S2's label is "the Wash Run". The action is E / the Enter bubble; `enter(threshold)` places the board stopped and facing along the bed; `exit(threshold)` drops the rider on foot.
- **Controls:** W push / pump / boost, S slide / foot brake, A / D steer, Space pop, Shift sprint; Move pad up / down / left / right; pad A / B (LT) / left stick / X / R3 (`RIDE.md §10.5`). W and S no longer double as lean.
- **Sound:** the wheels — the **slide screech** is the on-purpose sound (pitch rises with the charge, bright when full); roll by surface (paved roll, cobble chatter, boardwalk hum, ochre hiss) is the ambient.
- **HUD:** one glass **pace** bubble (the surface's pace word and icon; the charge arc during a slide; the push glyph in the release window; the offer at a pad). No numbers. The quick layer in every phase.
- **Reduced motion / calm:** playable, identical physics; no shake, roll, FOV change or cards; calm view silent. Lite: same numbers, FOV fixed.
- **Night:** no lamp; lines read by lantern pools and edge lips.
- **Presence:** publishing `act: 'skate'` and the slide angle are one wire-change request in `HANDOFF-notes/board.md` (rule 11, D46); nothing is broadcast in pass 2.
- **Profiles:** the board's `GroundProfile` (`RIDE.md §8.1`) and the eight knobs (`§8.2`); surfaces are the design lead's (`§8.3`, MANIFEST v1.7).
- **Reproducibility:** the ride log per fixed step (`§9`); the five situations R1–R5 (+ R0 the twist) as headless tests and harness replays.
- **Tests:** `test/groundKernel.test.ts`, `test/groundTyre.test.ts`, `test/groundSlide.test.ts`, `test/groundLegs.test.ts`, `test/horizonBoardPace.test.ts` (every surface id → its manifest row), `test/horizonBoardThresholds.test.ts` (no line passes a threshold without `park`; off-bed bog), `test/horizonSkateLines.test.ts` (headless rider completes S1–S4 start → end on bed with no required jump; S1 in `time_target_s`; ride log written), `test/horizonRideSituations.test.ts` (R0–R5), `test/horizonBoardLanding.test.ts`, `test/horizonBoardCamera.test.ts`. Skate v2 suites edited or deleted as `RIDE.md §12` lists (`skate-island-travel` deleted; `skate-int-feel` retuned for g 12).
- **Acceptance ride:** `RIDE.md §13` rides 1–8 on Mac and iPhone, full and lite; S1 race with Retry during countdown and at gate 0.

## M2 — Bicycle

- **Uses:** `roads.V01`, `VG`, `V02`, `VBS`, `roads.spurs`, beds with `profiles.trail.modes` containing `bicycle`; `speeds_ms.bicycle`; threshold `upperStreetSpur`; racks beside every threshold (`STYLE §3.1`).
- **Sim:** a `GroundProfile` of M1's ground kernel (`RIDE.md §8.1`, D45): pedal 2.5 to `speeds_ms.bicycle` 6.0 (continuous, no stroke), grip 6.0 / 4.8, **S is both brakes at any speed (4.0 m/s²) plus a rear-wheel skid that tails out ≤ 20°**, wider steering (radius 2.0 + 1.4·s), no kick-out to speak of, no twist, no pop, no boost; a kerb stops a bike (`stepMax` 0.10); its `beds` are roads, spurs and trails, so a walk or a skate bed is `offbed` and the fade returns it (the "refuses walks" test is this rule). The bicycle inherits the board's understanding of ground, grip, gravity and steering through the same kernel tests, and none of its feel.
- **Beds:** roads and trails only; never a walk, a skate line, a stair or a plaza. The Crown Road turning circle is the wheels' end.
- **Camera:** follow with look-ahead along the bed's tangent; horizon in frame.
- **Threshold:** mount and dismount at a rack; `upperStreetSpur` wheels → feet (`park`).
- **Sound:** the bell (on purpose); tyres by surface.
- **Reduced motion / calm:** playable; no bob.
- **Night:** no lamp (`LIGHT §3` lists none).
- **Tests:** `test/horizonBicycleBeds.test.ts` (a walk, a skate bed or a stair is `offbed` and the fade returns the bike; roads and trails are legal); `test/horizonBicycleProfile.test.ts` (S never exceeds 20° of slip; brakes act at any speed; no charge ever; pedal settles near 5.5 on the flat and ~4 on 10 %); journey `square→library by bicycle` measured from the ride log against `journeys.targets_s` (D44).
- **Acceptance ride:** square → Library timed; one lap of Horizon Drive timed; Crown Road to the turning circle.

## M3 — Gondola

- **Uses:** `cable.G1` (`from`, `to`, `fromH`, `toH`, `towers` `[1450,958]`, `[1420,825]`, `[1390,693]`, `clear_eu` 8, `length_m`, `speed`), `profiles.cable` (`towerSpacing_m` 120–200), `structures.gondolaStations`, thresholds `gondolaBase`, `gondolaTop`, crossings `G1 × V01`, `G1 × Crown Road`, `G1 × ORE`, `ZIP × G1` (the zip passes 10.7 m above at `[1442,921]`).
- **Route:** Mountain v2's gondola re-routed to G1 through the integrator's ride API; towers on pass 1's footings; the cable sags between towers (catenary, lowest point between towers, never above the chord); ≥ 8 m clear over every bed.
- **Boarding:** walk onto the platform; accept "Ride ↑" (or "Ride ↓"); the rider is seated in the cabin. Skip cuts to the far platform.
- **Camera:** ride cam: the town falls away, then the whole island; horizon in frame throughout.
- **Sound:** the gondola's bell on departure.
- **Reduced motion / calm:** fade cut to the far platform; calm view: cabins rest at the stations.
- **Night:** cabins' running lights and a dim interior, dusk → dawn.
- **Tests:** `test/horizonGondola.test.ts` (sag below chord between every tower pair; clearance; boarding requires accept; skip lands on the far platform; progress monotonic).
- **Acceptance ride:** square → summit by gondola + walk, timed against `journeys.targets_s`; both directions.

## M4 — Ore Line

- **Uses:** `rail.ORE` (`pts`, `length_m`, `stations`, `drop` with `fall_m` 28 and `siding`, `splash`), `profiles.rail`, `speeds_ms.cart`, threshold `adit` ("sit, lever"), threshold `southPortal` ("climb out") at the South Portal `[1345,680]`, 29 m from Crown Road's turning circle and linked to it by a path; `crossings` ORE × Crown Road is `n/a` (no crossing); the tunnel passes under the Crown walk and G1.
- **Ride:** Mountain v2's funicular re-skinned as the mine cart through the ride API; two riders seated; one lever. Progress is monotonic: the cart never reverses on the line.
- **The drop:** optional. Before the drop a points lever offers the drop or the siding (the quiet way round). The drop falls `fall_m` and runs the splash section through the Deep (spray cards, then the Deep's reveal).
- **Camera:** cart cam low behind the riders; the Deep's reveal as an authored shot.
- **Sound:** the lever's clunk (on purpose); wheels on rail.
- **Reduced motion / calm:** the drop becomes a fade (Grand Plan ch. 4); the whole ride becomes a fade cut.
- **Night:** headlamp (running light); the Undercroft's own lights are always on.
- **Tests:** `test/horizonOreLine.test.ts` (monotonic progress; siding bypasses the drop; the drop only by choice; both stations reached; journey time against `journeys` → `adit→south portal by cart` at the factor in use).
- **Acceptance ride:** Adit → South Portal with the drop; South Portal → Adit by the siding.

## M5 — Zipline

- **Uses:** `cable.ZIP` (`from` `[1610,640]` at `fromH` 100, `to` `[1130,1440]` at `toH` 12, `sag_pct` 1, `length_m` 933, `speed`, `minClearAboveRoof_eu` 12), `structures.zipPlatforms` (the Prow tower's deck, shared with the glider launch; the landing tower on the dune crest, deck `h` 12, with a stair and a ramp to the sand), thresholds `prowPlatform` (`clip in`) and `zipLanding` (unclip on the landing tower), crossings `ZIP × town` (≥ 12 eu above every roof, sag included), `ZIP × G1` `[1442,921]`, `ZIP × V01`, `ZIP × VG`, `ZIP × S3` (the Town Weave boardwalk passes beneath the landing tower).
- **Ride:** the ride attachment (`body/ride.ts`, integrator) on a trolley under a sagging cable; the rider hangs visibly below it; lands on the landing tower's deck (`h` 12) against its buffer, then takes the stair or the ramp to the sand.
- **Clearance:** the sagged cable is checked against every roof, bed and the G1 cable; a failure is a conflict for the design lead, not a reason to raise the cable silently.
- **Camera:** chase cam behind and above the rider; the lit town below.
- **Sound:** the whir.
- **Reduced motion / calm:** fade cut to the landing platform.
- **Night:** platform lamps (anchors).
- **Tests:** `test/horizonZip.test.ts` (clip required; sag below chord at 1 %; roof clearance along the whole cable against `hosts[*].roofH_eu`; ≥ 8 m over G1 at the crossing; lands on the landing tower's deck; the rider never passes over a skater on S3).
- **Acceptance ride:** the Prow → Long Sands, timed.

## M6 — Glider and parachute

> **Design:** `FLIGHT.md` (26 Sep) fleshes this section out — the polar, controls, lift, the landing-outcome table, the Throat corridor, the parachute's carried threshold and canopy, camera numbers, tests and decisions D34–D38. Where the two disagree, `FLIGHT.md` wins.

- **Uses:** `sky.launches` (`crown`, `prow`, `lampGallery`), `sky.lift` (thermals by `hours`, ridge, sink), `sky.landings`, `sky.glider` (`speed_ms` 11, `sink_ms` 1.2, `flare`), `sky.gates` n 12 (the Throat), `underground.doors.throat` (`mouth_m`; a diving entry of 139 m sloping at 30° down to the Deep at `h` 40), `sky.courses` (`damRun`, `throatRun`, `lampHop`), `sky.ceiling_m`, thresholds `crownLaunch`, `prowPlatform` (`run off`), `lampGallery` (`run off the gallery`), `deepJetty` (glider → feet).
- **Launch:** run off the edge (deliberate); or bail out of the plane into the parachute.
- **Flight:** glide at `speed_ms` with `sink_ms`; thermals only in their `hours` by the real sun clock; ridge lift along the Crown's south face in a south wind; sink over the Bight and the Notch. Wind from `movers/shared/wind.ts`.
- **Landing:** flare to land on the Green (target, `sky.landings.green` `[1040,1065]`), the Reach meadow (`reachMeadow` `[1230,1190]`, the Dam Run's end), Long Sands, the Flats strip. Water that is not the Deep fades you to the nearest shore. A neighbourhood fades you to its nearest apron. Ground contact elsewhere: a soft landing if walkable, else a fade to the nearest apron. Never a crash.
- **The Throat:** glider only; enter the mouth, dive down the sloping throat, flare over the Deep and land on the water; the fade to the jetty is `thresholds.deepJetty`; the splash echoes three times up the throat.
- **Parachute:** from the plane's bail-out; steerable; lands anywhere a glider may; the Drop Zone target on the Green is paint on the turf (pass 4 plays it).
- **Camera:** flight cam, horizon-locked.
- **Sound:** the canopy snap on launch.
- **Reduced motion / calm:** launching offers the landings and the twelve pages; the flight is a cut.
- **Night:** white tail light; the island by its lights; nothing pitch dark.
- **Tests:** `test/horizonGlider.test.ts` (Crown → Lamp in still air inside `journeys.targets_s`; the Throat admits the glider only; water fade; neighbourhood fade; thermals honour `hours`; pass-through bodies).
- **Acceptance ride:** Crown → the Lamp; Crown → the Throat → the Deep; the Prow → Long Sands; bail out from the plane onto the Green target.

## M7 — Plane

- **Uses:** `structures.strip` (`from`, `to`, `width_m` 30, `hangar`, `windsock`, `runwayLamps`), `structures.floatplaneDock`, `sky.plane` (`speed_ms` 35, `stall_ms` 18, `floats`, `wheels`, `swapAt`, `oneButtonRing`, `cannot`), `sky.ceiling_m` 300, `sky.landings.water`, thresholds `strip`, `floatDock` (`climb in`), `sky.gates` 1–11.
- **Flight:** throttle and stick; stall below `stall_ms`; the ceiling holds the plane under 300 m (climb fades out, no wall). The one-button "fly the ring" is an autopilot tour of Horizon Drive's loop that any input cancels.
- **Wheels and floats:** swap only at the hangar; wheels land on the strip only; floats land on the Bight or the harbour and tie up at the floatplane dock.
- **Cannot:** enter the Throat (the flight HUD says "Too narrow for the plane: gliders only"; screen-space text, never world text); land on a neighbourhood (a go-around prompt, then a fade to the strip); collide with a person.
- **Camera:** chase or cockpit, player's choice.
- **Sound:** the engine note.
- **Night flight (`LIGHT §3`):** running lights and cockpit glow; runway lamps in two rows, 0.35 eu every 12 eu on both edges, lit dusk → dawn from the threshold end; the windsock's red lamp; the Lamp's beam sweeping every 8 s as the night beacon. M7 authors the runway and windsock lamp anchors in `world/lights/strip.ts`; pass 2b supplies the cards. Beyond 120 eu the runway rows collapse to one dotted strip card each (lite cap 48).
- **Reduced motion / calm:** take-off, the ring and landing become cuts between the twelve pages.
- **Tests:** `test/horizonPlane.test.ts` (stall; ceiling; Throat refused; neighbourhood landing refused; wheels only on the strip, floats only on water; ring lap against `journeys.targets_s`).
- **Acceptance ride:** take off from the strip; one-button ring; swap to floats; land on the Bight; tie up at the floatplane dock; a night landing on the strip.

## M8 — Balloon

- **Uses:** `sky.balloon` (`xy` `[520,470]`, `mooringH` 40, `tether_m` 250), `structures.strip.balloonMooring`, threshold `balloon` (`step in`), `sky.ceiling_m`.
- **Ride:** step in; it climbs on its tether to `tether_m` (capped at the ceiling); at the top the Look camera's controls apply: the balloon is the Look camera made physical, and the guide map is what it sees. Ride it back down to step out at the mooring. "Step out at the top" is not built until the design lead defines it.
- **Camera:** the Look camera from the basket.
- **Sound:** the burner.
- **Reduced motion / calm:** a cut to the top; the Look camera still.
- **Night:** burner glow while rising (`STYLE §3.1`).
- **Tests:** `test/horizonBalloon.test.ts` (step-in required; rises to the capped tether; returns to the mooring; no drift off the tether).
- **Acceptance ride:** up at sunset with page H's subjects in view; down.

## M9 — Boats and the Ferry

- **Uses:** `water_routes.ROW` (`area`, `docks`), `water_routes.FERRY` (`pts`, `piers`, `headway_s` 370, `hulls` 2, `boarding`, `slowsAt`), `water_routes.RIVER_RUN`, `water_routes.DEEP_RUN`, `underground.doors.seaDoor`, `speeds_ms.ferry`, `speeds_ms.row`, thresholds `boathouseDock` (`untie`), `ferryPiers`, `bightShoreJetty`, `lampDock`, `seaDoorJetty`, `deepJetty`, `damPortage`.
- **Boats:** rowboat and canoe on the Bight, the harbour, the coast to the Sea Door, the river below the Notch and the Deep (`ROW.area`); dinghy on the Bight. Untie at any dock, tie up at any dock. The canoe runs downstream with the current; the dam is a portage (a threshold and a cut), never a waterfall ride. Leaving the ROW area fades you back to the nearest dock.
- **The Sea Door:** the Sea Passage (`underground.doors.seaDoor.passage`, 504 m, glow-worm lit) runs from the Deep down the Steps (three 12 m chutes in its first 120 m, ridden like a flume; `water_routes.DEEP_RUN.drop`) and then level to the Sea Door `[1690,770]`. Going in from the sea, boats carry up past the Steps (a portage threshold for pass 1 to propose); under reduced motion the Steps are a cut. The Sea Door jetty `[1705,775]` (`structures.jetties.seaDoor`, `thresholds.seaDoorJetty`) is also the Ferry's pier; the Sea Stair climbs from it to the Prow walk, and the Ferry is its step-free way back.
- **The Ferry:** two hulls run `FERRY.pts` in the manifest's order (clockwise with north up: west along Long Sands, into the Bight under the Bight Bridge and back out, round the Lamp and the Wreck, up the west coast, along the north, down the Prow, home), stopping 20 s at each of the five `piers` (the Bight pier at `[560,890]`, reached on foot by `walks.bightPier`; the Scholars' cove pier by `walks.coveWalk`), departures `headway_s` 370 apart; it doubles back at the Bight pier and slows at the Wreck without stopping. Boarding is walking onto its deck across the gangway while it is docked (the deliberate action; the offer appears by proximity, `CONTRACT §2.4`); leaving is walking off at a pier. Passengers ride on deck.
- **Camera:** low water cam for boats; a deck cam on the Ferry.
- **Sound:** the oars (on purpose); the Ferry's horn at each pier.
- **Reduced motion / calm:** rowing playable, no bob; a Ferry ride is a cut pier to pier; calm view: the Ferry rests at the landing pier.
- **Night:** a lantern on the bow of any boat out at night; the Ferry's running lights and lit wheelhouse (anchors in `world/lights/ferry.ts`).
- **Tests:** `test/horizonBoats.test.ts` (untie and tie at every dock; ROW-area fade; canoe portage at the dam; the Deep reachable by the Sea Door through the Sea Passage), `test/horizonFerry.test.ts` (pier order; two hulls; headway; 20 s dwell; passes under the Bight Bridge twice per lap; boarding only across the gangway while docked).
- **Acceptance ride:** row the Boathouse → the Bight pier; the Sea Door → the Deep jetty; one full Ferry loop timed; canoe the lake inlet `[1160,740]` → the harbour (the River Run's start; the Cup's outflow is scenery); the Deep → the Sea Door down the Steps.

---

## Integrator duties

- Registry: exactly one active mode; transitions only through `ThresholdOffer`; every threshold in `WorldDefinition.thresholds` wired to its modes.
- Camera director: handoffs between mode cameras never swing more than 30 eu; a longer handoff is a cut (the dissection's 190 u whip). No camera below ground; the Look camera respects terrain (`camera/obstruction.ts`).
- Saved positions: a reload mid-ride restores the body at the nearest threshold of that mode, on foot.
- Audio: one on-purpose sound per mode through `audio.ts`; calm view silences all.
- Quick layer in every mode; a test proves it.
- Streaming: at 35 m/s the plane crosses districts fast; streaming prefetches along the heading, ≤ 1 district built per frame, residency within `CONTRACT §6`.
- The mover hook (`attachMover` / `detachMover`, `RIDE.md §11`; the same ask as `FLIGHT.md §9.2`, pending); `geography.bedAt(x, z)` (`RIDE.md §11.9`); one exported `g` (12) from `runtime/geography.ts` for the walker, the ground kernel and the wings (D40); `HorizonStage` reads reduced motion and calm live.
- `race.ts` re-based on the S1 bed (17 gates, Retry in every state); the run-out auto-brake removed (D43).
- MANIFEST v1.7 (design lead, `make_manifest.py`): `paces` and `surfaces[*].grip` (`RIDE.md §8.3`), pads tagged `threshold`, `skate.park.note`, `journeys` rows for movers marked `measured: 'ride-log'` (D44), the FLIGHT sky fields (`FLIGHT.md §9.5`, pending). No `horizon-geo` bump.
- Merge with pass 2b into `PIN-2`: swap every greybox proxy for the kit's `VehicleArt`.

## Must produce

- [ ] Nine movers, each meeting its section above, ridden end to end.
- [ ] Every threshold in `WorldDefinition.thresholds` working with its action.
- [ ] Runway and windsock lamp anchors; Ferry running-light anchors.
- [ ] Quick layer visible in every mode; money one tap away.
- [ ] Reduced motion and calm view behaviour per rule 7 and 8 for every mode.
- [ ] Journey timings re-measured with real movers against `journeys.targets_s`.
- [ ] The ground kernel with its determinism test; the board and the bicycle as its profiles; the ride logs for R0–R5 and every acceptance ride.

## Must not

- Change geography, beds, structures or the heightfield.
- Add a dynamic point light, world-space text, or a floating prop.
- Change the presence wire, the Worker, money, schema, auth, sync or deploy.
- Board anyone by a form, a menu or a teleport; the ride is taken at the threshold.
- Let the board or bicycle leave its beds (off the bed the wheels dig in and the fade returns it — never an invisible wall, never a bog you push out of); let the plane enter the Throat or land on a neighbourhood.
- Add a second velocity, heading or grip writer beside the ground kernel; add a speed cap or a zone where a surface row would do; add a trick or subsystem the brief does not list.
- Reverse a ride mid-line; bow a cable upward; float a rider beside a vehicle.
- Use real household data.

## Tests to add

The per-mover tests above, plus `test/horizonModeRegistry.test.ts` (one mode; threshold-only transitions), `test/horizonQuickLayerModes.test.ts` (quick layer present in all fourteen `ModeId`s), `test/horizonReducedMotionModes.test.ts` (every passive ride and free flight becomes a cut), `test/horizonCameraHandoff.test.ts` (no handoff swing > 30 eu).

After each section: `pnpm exec vitest run test/<name>.test.ts --maxWorkers=1` and `tsc`. Final SHA only: `pnpm build`, then `pnpm test -- --risk=high --focus=harbour --focus-reason="horizon p2: nine movers, thresholds, ride cameras"` within five minutes.

## Evidence required

| Evidence | File |
|---|---|
| Each acceptance ride above: a harness recording and a step log (position, mode, surface, speed per second; for the board and bicycle the kernel's ride log per fixed step, `RIDE.md §9`) | `evidence/rides/<mover>_<ride>.mp4`, `.json` |
| Journey timings with real movers vs `journeys.targets_s` | `evidence/journeys.md` |
| Night: the strip's two lamp rows, the gondola cabins, the Ferry, the plane's running lights, at 02:00 | `evidence/pages/night_<subject>_<full\|lite>.png` |
| Reduced motion: every passive ride and flight shown as a cut | `evidence/rides/reduced_motion.md` |
| Performance during a plane ring at full and lite | `evidence/perf/plane_ring.json` |
| The twelve pages at `bestHour` and `also`, three dressings, full and lite, captured on the integration branch after the merge with pass 2b (`CONTRACT §7`), each with a one-line verdict | `evidence/pages/<page>_<hh-mm>_<dressing>_<full\|lite>.png` |
| Reviewer's report | `evidence/review/REVIEW.md` |

## Gate

Jonathan rides each mode on his Mac and his iPhone from `TEST-PLAN.md` (Grand Plan: "each mode by two people on two devices"; Bianca is the second person when she is willing). Sign-off per mode; a mode that fails is held back from `PIN-2` by the integrator's registry flag, never shipped half-working.

## Delivery

`~/Downloads/hearth-horizon-p2-movers/`: `p2-movers.bundle` (`PIN-1..claude/horizon-movers`), `patches/`, `HANDOFF.md`, `FINISH-PROMPT.md`, `TEST-PLAN.md`, `evidence/`. Claude does not push; Jonathan pushes, opens the PR with pass 2b's, requests trust review only if a request note exists, merges, records `PIN-2`.

## Reconciled to MANIFEST v1.1 (reviewer)

- M1: the S1 finish moved from the town quay (`skate.S1.finish`, stale in v1.1 at `[1420,1270]`) to the Landing quay `[1270,1330]` on the west bank; `landingQuay` threshold and the register's `threshold` rows added; separated lanes and the Dune Culvert named.
- M4: the "Crown station proposed in pass 1" is the South Portal (`thresholds.southPortal`); ORE × Crown Road is a `threshold`, not `under`; acceptance ride renamed.
- M5: `zipLanding` threshold and the ZIP × G1 separation added.
- M6: `shaft_to_deep_m` (not in v1.1) replaced by the Throat as a diving entry; `lampGallery`, `deepJetty`, `sky.courses` cited; gate index written as `n 12`.
- M8: tether 300 → 250; mooring position cited.
- M9: headway 240 → 300; two hulls, 20 s dwell, clockwise route, the Bight in-and-out; the Sea Door as a boat passage to the Deep (no "steps up"); the dock thresholds now in the manifest listed; "board by proximity" worded as CONTRACT §2.4 (offer by proximity, action is the gangway).

### v1.2 deltas (reviewer, MANIFEST v1.2)

- M1: S1 finish on the Reach islet; S2 renamed the Wash Run; the v1.2 threshold rows (S2 dismount `[660,1170]`, Wash-bed closure, S4 × VBS `[874,941]`, S4 × VG `[973,538]`, S3 × town quay).
- M3: G1 towers, `clear_eu`, and its crossings.
- M4: South Portal `[1345,680]`, 29 m from the circle; ORE × Crown Road is n/a; journey key `adit→south portal by cart`.
- M5: top h 100, landing tower `[1130,1440]` deck h 12, sag 1 %, clearance in eu, ZIP × G1 `[1442,921]`.
- M6: Green landing moved to `[1040,1065]`; the Reach meadow landing added.
- M9: headway 300 → 370; the Sea Passage's Steps and Sea Stair; the Sea Door pier = jetty `[1705,775]`; Bight pier `[560,890]` and the pier walks; the canoe acceptance starts at the lake inlet.
- M5 ride: lands on the landing tower's deck, not on the sand.
- M6: the Throat 139 m at 30°.

### RIDE deltas (design lead, 26 Sep)

- Inputs: `RIDE.md` (M1, M2) and `FLIGHT.md` (M6) added; `inputs/grand-plan.txt` corrected to `.html`.
- Shared interfaces: `movers/shared/ground/**` (the ground kernel) added, written by M1, consumed by M2 through a `GroundProfile`.
- M1 rewritten on `RIDE.md`: one motion model, pace as physics, S / A / D, the twist, the pump-boost, no run-out auto-brake, water as a fade, sideways landings as slides, roll-free camera on the velocity direction, the pace bubble, the ride log and situations R0–R5, the new test list.
- M2: a profile of the kernel, not a params object of the Skate v2 sim; `horizonBicycleProfile` test; journeys from the ride log.
- Integrator: the mover hook, one `g`, `race.ts` re-based and the run-out brake removed, MANIFEST v1.7 (surfaces, journeys, sky).
- Decisions D39–D46 recorded in `docs/DECISIONS.md`.
