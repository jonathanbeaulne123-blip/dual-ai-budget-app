# Horizon movement pass — handoff (4 October 2026)

**Brief (Jonathan, 4 October 2026):** "bring back the skateboard anywhere mechanics, it was tuned perfectly · fix the walking movement · increase the speed of the vespa/motorcycle and have a shift boost option · incorporate the bike to go the speed of the vespa and have the vespa be 2x as fast by default and 3x as fast when clicking shift · make sure all glider spots are accessible, if there is a model for the glider have it at each glider spot."
**Branch:** `claude/horizon-movement-pass` (from `main` at 4f76029, #581). The four tracks were built on `claude/hmp-board`, `claude/hmp-walk`, `claude/hmp-cruiser` and `claude/hmp-glider` and merged here.
**Decision entry:** 2026-10-04 at the top of [DECISIONS.md](DECISIONS.md).

## The household outcome

On the live Horizon the four kinds of movement now behave:

- **The board.** Press B, the Board button or Guide → "Skate here" on any dry, open, walkable ground and the old Tideline board goes down there.
- **Walking.** It has weight and slides along walls. It no longer strands you on the island's cliff stairs.
- **Vespa, Harley and bicycle.** All three cruise at twice the old speed and boost to three times it while Shift is held.
- **Gliders.** Each of the three launches has a parked glider. Each can be reached from the Guide.

- **Budget delta (5): 0.** There is no change to money, commands, schema, sync, Auth/RLS or Hercules payloads.
- **Engagement delta (3): +2.** The island is quicker and more pleasant to get around, and its best views are now reachable.
- **Risk: High.** This changes the shared movement and collision code paths for every person on the live world.

## What changed

| Ask | Where | What |
|---|---|---|
| Board anywhere | `skate/world.ts`, `skate/nativeSkate.ts`, `runtime/index.ts` (`skateRefusal`, `startSkate`), `HorizonWorld.tsx`, `HorizonGuide.tsx` | **Feel.** Hosted on the Horizon geography, every patch of terrain rode as `grass` (grass roll and push grip, the slowest kind). Terrain now rides as the old island's own kinds on Mountain v2's town island and as the baked paint everywhere else (sand, paved, grass). Solid materials map timber, plaza, apron and turf correctly. The skate sim is untouched. **Refusals.** One rule, `skateRefusal()`, gates B, the button and the Guide: another ride, a home room, water, unsupported ground, ground steeper than the 40° walk limit, a wall, or ground still streaming in. The shell shows that reason; it used to always say "Park your current ride". The Guide drops "Go skate Tideline", which can no longer travel (since #578). |
| Walking | new `runtime/walkSim.ts`; `runtime/index.ts` `move`/`step` | **New module.** A pure walker on a fixed 1/60 s step. **Start and stop.** It has weight: about 0.25 s to reach walking pace and a short settle on release. Both used to be instant. **Collisions.** It slides along walls, rails, too-steep banks and the world's edge. It used to stop dead on the first blocked 0.15 m piece. **Steps and slopes.** It steps up lips and risers to 0.48 m and shows the climb eased instead of as a snap. It slows on uphill slopes. **Gait.** The figure's step follows distance walked. **Routes.** Tap-to-walk takes corners without a standing frame. A route is only given up after one second with no headway. **Stairs.** Uncut terrain drawn through the cove stair, the Bight pier stair and the Lamp Gallery stair (0.3–2 m over the treads, 45–83°) used to stall or strand the walker. Now any authored floor within 1.5 m under terrain is walked instead. **Speeds.** Unchanged: MANIFEST walk 2.4 m/s, run 5.0 m/s. |
| Vespa / motorcycle | `movers/cruiser/{tuning,sim,controller}.ts`, `HorizonStage.tsx` | **Speeds.** 32 m/s cruise, up from 16. 48 m/s while Shift, or the touch Boost toggle, is held. **Ramp.** The boost cap ramps up over 0.6 s and back over 0.8 s. **Handling.** Acceleration 12, brake 24, corner speed 10. Above cruise, steering tapers with √speed. **Camera.** It pulls back up to 1.4 m at boost. **HUD.** Shows "Boost" while boosting and plays a boost cue once per engagement. **Calm / reduced motion.** These keep cruise speed. **Streaming.** A boosted ride holds before ground that has not streamed in (`rideAheadReady`) rather than stepping into it. |
| Bicycle | `movers/bicycle/controller.ts`, `cruiser/art.ts`, `runtime/index.ts` (`toggleCruiser(kind)`, `swapWheels`), `HorizonWorld.tsx` | **Speeds.** The bicycle is now a style of the one Ride vehicle: the same sim, 32 m/s cruise and 48 m/s boost. It replaces the old board kernel and its 6 m/s pedal cap. **Model.** It has its own town-bicycle model and the HUD word "Cycling". **Getting on.** A "Bike" button sits beside "Ride" in the shell. "Bicycle" is a third choice in the style list. Changing style mid-ride swaps the vehicle where you stand, from rest. **Keys.** V gets off and R recovers, for both. |
| Glider spots | new `runtime/gliderPads.ts`; `movers/glider/art.ts` (`createParkedGlider`); `runtime/index.ts`; `HorizonGuide.tsx`; `HorizonStage.tsx`; `horizon.css` | **Guide.** "Glider launches" lists The Crown, The Prow and The Lamp. Each one stands you on that deck, inside the launch offer's reach, facing the run-off. It is refused while riding, cooking, on the monorail, seated or skating. **Parked gliders.** Each deck has a static, non-colliding glider at its launch edge, dressed for the theme and lit at night. It hides while you fly from that pad. **Desktop prompt.** A visible "Glide · E" button replaces the thin strip. **Hint.** One line appears the first time you come within 25 m of a launch. **Dead offers.** Offers for modes with no controller (the zip at the Prow, the Ore Line cart, the balloon, the ferry) no longer render buttons that do nothing. |

## Verification (exact)

- **Typecheck.** `pnpm typecheck` (tsc --noEmit) is clean on the merged branch.
- **Focused files.** These were run one at a time with `--maxWorkers=1`, synthetic and baked worlds, fictional data:
  - `horizonCruiser` 32/32
  - `horizonBicycleProfile` 3/3
  - `horizonMoverHook` 21/21
  - `horizonQuickLayerModes` 12/12
  - `horizonMoverAudio` 3/3
  - `mountain-bicycle-metadata` 5/5
  - `horizon-native-skate-anywhere` 15/15. The board goes down and rides at Tideline, the harbour square, the quay, Long Sands, the Landing, the Flats strip, the Green, the Hollow, the Notch, the Crown summit, the L01 deck and the Suspension Bridge. It refuses in water, on steep ground and off any floor.
  - `horizon-native-skate` 6/6
  - `horizon-native-skate-geometry` 5/5
  - `horizon-native-skate-world` 11/11
  - `skate-destination-readiness` 7/7
  - `skate-island-travel` 4/4
  - `horizon-guide` 3/3
  - `horizonWalkSim` 38/38. One `it.fails` is a recorded land gap, below.
  - `horizon-mountain-footway-joins` 6/6
  - `horizon-walking-ground-patch` 8/8
  - `harbour-walk-everywhere` 81/81
  - `harbour-walk-focus` 27/27
  - `horizonGliderPads` 38/38
  - `horizonGliderPadsGuide` 4/4
- **Failures that also fail on `main` at 4f76029 (pre-existing):**
  - `yachtKitchenStage`: 4 failures, `world.airportActions is not a function` in its stub.
  - `horizonMoversNoMoney`: 2 failures.
  - `skate-int-feel`: 3 failures.
  - `horizon-foot-lane-apron`: 3 failures on `main`, 2 on this branch.
- **The wider sweep** of every `test/horizon*`, `journey-*`, `skate-*`, `harbour-walk*`, `harbour-world-toggle` and `harbour-source-fences` file is reported in the PR.
- **Tests changed, with the reason written in place:**
  - `horizon-foot-lane-apron` and `horizon-mountain-footway-joins` supply walkSim's two functions to the walking code they extract.
  - `horizonMoverHook`: the hold-ahead case reads every sample.
  - `horizonBicycleProfile` and `horizonCruiser` were reworked for the new speeds.
  - `horizon-guide`: the Guide no longer offers the Tideline trip.
- **Not run:**
  - the road audit (`scripts/horizon/road-audit.mjs`) at the new cruiser speed;
  - browser or device evidence at 320 / 390 / 720 / 1100 px;
  - a blind reviewer.

## Rough areas and owed

- **Cove stair land gap.** The top tread ends about 0.6 m under the cove walk, so climbing the cove stair stops at the top. This needs a land touch-up; it is recorded as `it.fails` in `horizonWalkSim`. Walking down it works.
- **Feel of the new speeds.** A boosted cruiser at 48 m/s on Horizon Drive's tightest bends, and the camera pull, need Jonathan's on-device verdict. The road audit at 32 m/s is owed.
- **Prow access on foot.** The Prow tower is reached from the Guide entry. A ground route from town to the tower stair was not re-verified in a browser.
- **Unused bicycle kernel.** The RIDE-kernel bicycle profile (`BICYCLE_PROFILE`) still feeds the bicycle road-legality metadata and the audits, but no longer drives a ride.

## Next owner

Jonathan, on devices:
1. Try B on the beach, the Flats and the harbour square.
2. Walk up the market stair and along a rail.
3. Ride, Bike and hold Shift on Horizon Drive.
4. Use Guide → Glider launches → The Crown and press E.

Then merge.
