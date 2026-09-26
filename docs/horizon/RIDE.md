# The Horizon — RIDE: one board, one motion model

Version 1.0 · 26 September 2026 · Jonathan: "a unified board-physics and powerslide/boost system … one cohesive physics system in which ordinary riding, steering, braking, powersliding, drifting, and boosting feel like connected expressions of the same movement." · Grounded in `main@0f601b5` (#548: Pass 1 land, MANIFEST v1.6, scale 1.0 as D13) and `passes/02-movers.md` track **M1** (with **M2** as its first reuse).

This file is the movement foundation of pass 2. It is **part of track M1** (and M2 through the bicycle), not a replacement for the brief: it fleshes out the M1 bullets of `02-movers.md`, and where a bullet and this file differ, this file is the fuller statement until Jonathan changes it. It refines the approved **D7** (four skate lines with surface-driven pace) and keeps — re-mechanised, not overturned — `skate.rules` ("board never past a threshold"), `NOT-THIS.md` line 42 ("a slope term; assist only in the Tideline park") and the pass-2 Must-not "let the board or bicycle leave its beds" (§6.5). It is a plan, not a build: nothing here is implemented. Nothing here touches geography (`horizon-geo-1` stays), money, the presence wire or the Worker. Units are concept metres = engine units at scale 1.0 (the Skate v2 "u" is the same unit); speeds in m/s, accelerations in m/s², angles in degrees unless marked rad.

Companion to `FLIGHT.md` (the sky is the other physical mover; the same integrator hooks), `TIME.md` (nothing on the board reads time), `LIGHT.md` (the board has no lamp), `SCALES.md` (the board lives at the world scale only).

---

## 0 · What is already true (facts on main)

- **Skate v2** (`src/harbour/skate/sim/index.ts`, 1 776 lines; `sim/tuning.ts`) is the only board code. Fixed substep `SKATE_DT = 1/120` with an accumulator and a 0.1 s clamp (`contract.ts:18`, `sim/index.ts:1707-1716`); no RNG; frame-rate identity is tested at 30/60/120/144 fps (`test/skate-sim-ride.test.ts:357-366`). **Keep all of that.**
- Its ground model is *not* one model. Velocity is a 3D vector; heading is derived from it; board yaw has five writers per substep (steering rotation, wheel self-steer, the no-grip follow, `slideAngle` offsets, `canonical()` flips — `sim/index.ts:620-630, 749, 760, 770, 248`) and the rig adds a sixth for the slide (`look/boardRig.ts:359-365`). Speed magnitude is written five times per ground step (decel/push, pump, gravity, an energy re-derivation clamped 0.5–2×, a hard clamp — `:589, :596, :636, :696-699, :710`). There are four speed caps (`MAX_SPEED` 15; `PUSH_CAP` 6.8 / `SPRINT_CAP` 8.4; travel literals 11/14 applied twice; the grind's own re-clamp at `:1329`) and a fifth unconnected number, `MANIFEST.speeds_ms.board` 7.0.
- **The carve is kinematic**: A/D rotate the velocity vector losslessly at `ω = carve·v/(0.75 + 0.3·v)` (`:612-624`); a separate `LATERAL_GRIP` 1.5 cancels sideways velocity up to that rate and fades out by 3 (`:740`); a separate `SELF_STEER_RADIUS` 0.9 turns the board under gravity (`:742`). No slip angle exists on the ground.
- **The powerslide is a brake with a yaw decoration**: C / LT, or S + |steer| > .35 above 3 m/s, adds a scalar scrub 2.2–7.5 m/s² and swings the board toward 90–180° *visually* (`slideAngle`) while the velocity keeps its direction, still steered at ×0.3 (`:548-560, 616, 764-770`). It ends at 0.6 m/s (C) or 3 m/s (S), then `BRAKE_DECEL` 5.5 takes over. Revert (X, `doRevert` `:805`) shares the same `slideAngle` channel.
- **Travel assist** cuts gravity to 0.16 g outside `trickZoneAt`/`raceCorridorAt`, both Mountain-bound (`:517-518`; `driver.ts:87-89`), adds a second continuous push model and caps (`:583-586`), an uphill-start override that zeroes velocity (`:539-542`) and a second landing rule (`:1126-1138`). `NOT-THIS.md:42` already names this: "No downhill on the board (travel assist everywhere). Instead: a slope term; assist only in the Tideline park."
- **There is no boost anywhere** in the sim, tuning, input or docs.
- The Horizon runtime has **no board mode** (`runtime/index.ts:23`: `'walk'|'look'|'journey'`), no `movers/shared/**`, no registry (`movers/README.md` is one line). The walker moves at `speeds_ms.walk/run` with no acceleration, clamps dt at 0.05, uses g 12 for its jump (`:120-121`), probes `geography.surface(x,z,y,.48)` every 0.2 m and refuses slopes over `HORIZON_WALKABLE_DEGREES` 40 (`geography.ts:6-8`).
- **Pace is reachable but not queried.** On a skate deck `geography.surface().material` is the manifest segment surface id, and the bed carries the design lead's **segment pace** beside it (`surfaceSegments[*].{surface, pace}`, `land/beds/build.ts:63-64`, `beds/profiles.ts:15`) — which is not always the surface's default (S2's ochre rim is `fast` but its Wash bowl `flow`; S3's paved market stair is `flow`). Terrain always reports `'grass'`; pads report `'stone'`; roads and walks report their own bed surface. Skate v2's `SurfaceKind` (`grass|path|sand|cobble|concrete|wood|metal`) is a different vocabulary. Skate beds are not in the path graph (`world/pathGraph.ts:15`).
- **Thresholds exist**: `skateLineStarts.1–4` (feet→board, "pick up"), `stairTop`, `quayWest`, `landingQuay` (board→feet, "park"), and every threshold crossing as `crossing.<i>` with `board→feet` (`world/build.ts:41-53`); pads 6 × 5 with a 2 × 0.6 marker.
- `journeys["crown→quay on the board (S1)"]` estimates **139 s** from `971 m / 7.0 m/s` against `targets_s [70,130]` (`pathGraph.ts:68`), and `build.ts:71` records the conflict. The estimate is a flat-speed formula on a line that drops 154 → 3 m; §5 shows real gravity puts S1 inside its target.
- **Decisions**: `docs/DECISIONS.md` holds D1–D33 on main; the FLIGHT patch (`~/Downloads/hearth-horizon-flight`, not yet merged) adds D34–D38. This file numbers from **D39** so the two patches never collide.

---

## 1 · The ride we want

The board should feel playful, flowing and expressive, most of all going downhill: carve a slope, turn sideways to hold your speed, hold a slide round a bend, straighten, and release into a burst. Some of the rhythm of snowboarding, none of its feel: this is rolling contact — wheels that grip until they don't, a readable relationship with the ground, a clear difference between a carve and a slide.

Three turns, one model. The handling — not the animation — tells them apart:

| Turn | What you do | What the wheels do | What it costs |
|---|---|---|---|
| **Carve** | A / D | grip holds; the board tracks where it points | almost nothing; a carve is how you keep speed |
| **Slide** (powerslide) | S, shaped by A / D | the wheels break loose on purpose; the board turns across the direction you are still travelling | speed, in proportion to how far across you turn — the slide *is* the brake |
| **Twist** (the committed rotation) | keep pushing into the slide past broadside | the board goes all the way round; grip returns with the tail leading | more speed than a slide, and you are riding fakie |

A beginner can slow down (S) and make a turn (A / D) in the first minute. Getting better means linking carves, choosing the slide angle that holds the speed you want, catching the board with countersteer, committing to a twist when the bend asks for it, and pumping out of a clean exit for the boost.

Approachable first, rewarding to learn, understandable rather than simulated — but internally consistent: one set of forces acts on one velocity in one frame, whatever the rider is doing.

---

## 2 · One motion model: the ground kernel

One authority owns movement: a **ground kernel** in `src/harbour/horizon/movers/shared/ground/` that any wheeled or sliding mover runs with its own profile. The board is its first client, the bicycle its second (M2), pass 4's ice skates its third. Components (legs, air, rails, pose, camera, sound) read the kernel's state and hand impulses back through named seams; none of them writes velocity or heading directly.

### 2.1 State

```
GroundState {
  p: XYZ                 // position (contact point under the board's centre)
  v: XYZ                 // world velocity
  heading: rad           // the board's long axis (nose direction when lead = +1)
  yawRate: rad/s         // integrated angular state — rotation has momentum
  grip: 0..1             // 1 = rolling grip, 0 = a full slide; moves continuously
  lead: ±1               // nose or tail leading (fakie = -1); flips only through a twist or an air
  contact: { on: bool, n: XYZ, material, pace, slope°, kind: 'ground'|'rail'|'wall'|'air' }
  legs: { stroke, crouch, charge }   // §4
}
```

Derived every step, never stored: speed `s = |v_t|` (tangent-plane speed), travel direction `t̂`, and the **slip angle** `β` = signed angle from the board axis (`lead`-corrected) to `t̂`. `β` is the one number that unifies carve, slide and twist: a carve is |β| < ~8°, a slide is anything larger with `grip` low, a twist is β passing 90°.

### 2.2 Step

- Fixed step **1/120 s** with an accumulator; dt clamped at 0.1 s per frame (Skate v2's scheme, kept). The Horizon tick's 0.05 clamp applies to the walker only; the kernel keeps its own so a 30 fps phone and a 120 Hz Mac produce identical rides.
- Order inside a step, always: (1) sample contact under the board, (2) input → torques and leg impulses, (3) forces in the tangent plane, (4) the tyre (grip) step, (5) integrate `v` and `p`, (6) integrate `yawRate` and `heading`, (7) collide and resolve contact (landing, lip, rail lock), (8) emit events. No component re-enters the step.
- Input is latched from the render frame into the fixed step (as today) **and** recorded per fixed step into the ride log (§9). No `performance.now()` inside the kernel.
- No RNG. Wobble (manual, grind) stays a deterministic sine of the step count.

### 2.3 Contact — three points, one query

The kernel samples the Horizon `geography.surface(x, z, y, step)` at **three points**: the centre and the two trucks (±`wheelbase/2` along the heading; board wheelbase 0.44, from `boardGeometry.ts` halfLength 0.33 less the truck inset). It reads `y`, the normal, `material` and `slope`, and asks the world one more thing the runtime does not answer today: **which bed segment is under the wheels** (`bedAt(x, z) → { bed, segment }`, the integrator's ask §11.9, from `WorldDefinition.beds[*].surfaceSegments`). From those: **pace** is the segment's own `pace` on a bed (the design lead's word for that stretch) and `threshold` on any pad, and one of the kernel's contact classes off them — `offbed` (terrain, any bed the profile does not list) or `rail`; **grip** and **push grip** come from `MANIFEST.surfaces[material]` (§8.3). From the three heights: the contact normal (centre), the board **pitch** (front truck − rear truck) and a **lip test**: a truck whose ground is more than `stepMax` (board 0.12) above the centre is a wall for the wheels — a kerb (0.15), a stair riser (0.17), a rail bar — you see it, you ollie it or you stop against it; a truck whose ground is more than `stepMax` *below* is a drop-off (§6.2). Terrain (`'grass'`) and beds the profile does not list are `offbed` contact (§6.5); a pad (`'stone'`, found through `bedAt`) is legal ground at threshold pace for every mover. Water is `submerged()` → the fade back to the bed (§6.4). Nothing about the ground is guessed from a heightmap the board owns; Skate v2's `world/field.ts` survives only for the Tideline park's pads, aprons and fillets, served *through* the same `surface()` shape (§7).

### 2.4 Forces (tangent plane, every step, in this order)

1. **Gravity**: `g · (down projected onto the tangent plane)`. **Real everywhere** — the slope term the deck asks for. One `g` for every Horizon mover, **12** (the walker's, the glider's; D40). Downhill accelerates, uphill slows, a bank pulls you to its inside; nothing else reads the slope.
2. **Rolling resistance** `roll[pace]` (m/s², opposing `t̂`): fast 0.12, flow 0.25, slow 0.6, threshold 1.8, skate (pass 4's ice) 0.03; the kernel's `offbed` class 6.0 (the wheels dig in and stall, §6.5). This is *the whole meaning of pace*: no speed caps, no multipliers, no "slow zone" — cobbles slow you because they roll badly, a plaza brings you to walking pace because it is a plaza.
3. **Drag** `drag · s²` with `drag` 0.0092. Drag, not a clamp, sets the top speed: on S1's 15 % paved drops the board settles at ~13.4 m/s, on the steepest bed the land pass allows (18 %) at 14.8 (§5). `MAX_SPEED` 15 stays only as a NaN-style safety and is never reached by tuning.
4. **Legs** (§4): the push stroke, the pump, the boost — one seam, one sign convention (along the board axis, `lead`-corrected).
5. **The tyre step** (§3): the only lateral force there is.
6. **Scrub**: while sliding, the tyre step removes lateral velocity at the kinetic grip; that removal *is* the slide's braking. There is no separate brake force at speed (§3.4).

Then `v` is projected onto the new tangent plane on a slope change with the energy correction Skate v2 already uses (`sim/index.ts:693-699`; the 0.5–2× clamp kept as a guard, never as a tuning), `p += v·dt`, and the crest rule (§6.2) decides airborne.

---

## 3 · Steering, grip and the slide — S, A and D

### 3.1 A / D steer the board, not the velocity

A / D (the Move pad's x on touch, left stick x on a pad) apply a **yaw torque** to `heading`; the velocity follows only through grip. Commanded yaw rate `ω_cmd = steer · s / R(s)` with `R(s) = max(1.0 + 0.9·s, s² / (0.9·G))` — the first term is the board's own law (tight at walking pace: 3.7 m at 3 m/s; 7.3 m at 7), the second is the grip cap of §3.2, which binds above 7.5 m/s on paved ground (8.9 m at 8 m/s, 13.9 at 10, 20 at 12, 27 at 14) (the cap is the board's own and never scales with the surface, §3.2; on cobbles the wheels' *grip* is lower, so the same steering outruns them from ~5.5 m/s and skitters). Today's kinematic radius is 0.75 + 0.3·s (3.75 m at 10 m/s); this is a deliberate change (§7): a carve at speed is wide because the wheels say so. `yawRate` moves toward `ω_cmd` with a rate limit `yawResponse` 14 rad/s² (a quick but visibly *rolling-in* lean, not a snap) and a damping `yawDamping` 3.5 /s when the stick is centred. Below 0.7 m/s the same torque pivots the board in place (a slow rate ∝ (1 − s/0.7)), so stationary riders can face where they like.

### 3.2 The tyre step — one rule for carve, slide and everything between

Each step, split `v` into along-board `v_lon` and across-board `v_lat`. Grip is the lateral acceleration the wheels can supply:

```
G = surfaceGrip[material] · lerp(slideGrip, rollGrip, gripState)      // board: rollGrip 8.0, slideGrip 4.5
Δv_lat = -sign(v_lat) · min(|v_lat| / dt, G) · dt
```

- **Carve**: the steering asks for lateral acceleration `s·ω`. While `s·ω ≤ G` the wheels cancel `v_lat` fully every step and the board tracks its heading: |β| stays under a few degrees, speed is conserved (a carve costs only `roll` and `drag`). A / D alone are **capped at 0.9 G** on the board's own grip (`steerLimit`) so a beginner cannot spin out by steering — on paved ground. The cap does *not* scale with surface: on cobbles (grip 0.7, G 5.6) or gravel (0.6) a hard carve above ~5.5 m/s asks for more than the wheels have and skitters into a small slide. The surface teaches.
- **Break loose**: when the demand exceeds G — because S dropped `gripState`, because the surface is loose, or because you landed sideways — the wheels can only take G off `v_lat` per second. The rest stays: the board is now travelling across itself. That is the slide. Nothing switches; the same equation just has a remainder.
- **Scrub**: removing `v_lat` at the kinetic grip shortens `v` as it turns it toward the board axis; the deceleration is `G·sin β` — **broadside scrubs hardest (4.5), a 45° slide 3.2, a 25° slide 1.9, a 15° slide 1.2**. The slide angle is the brake pedal.

### 3.3 S — enter, hold, release

**S = "break the wheels loose"** (Move pad down; B on a pad, with LT as a duplicate for people who reach for a trigger). C and X are removed (D39).

- **Entry** (s ≥ `slideEntrySpeed` 2.5): the kernel drops `gripState` toward 0 at `kickOut` 8 /s (loose in ~0.15 s) and applies one **kick-out impulse** to `yawRate` (`kickYaw` 2.2 rad/s) **in the same sense as the turn — nose in, tail out**: with A / D held, toward that side; with the stick centred, the sense of the current `yawRate` if the board is already turning, else the rider's heelside (stance). The board swings across the travel line; momentum carries the rider on. Entering from a carve is the natural way in (the kick adds to the rotation you already have); entering from straight gives a stand-up speed check.
- **Hold** (S held): `gripState` stays at 0; the board rotates under the sum of the steering torque (§3.1, now on loose wheels so it turns easily), the kick's momentum, and the **self-aligning torque** `−align · G/rollGrip · sin(2β)` (`align` 6 rad/s²): the wheels pull the board toward the *nearer* of straight and fakie-straight. **With the stick centred, holding S holds the slide**: the rider's back foot keeps the board at `holdAngle` 40° (a torque toward 40° that exactly balances the aligning torque there — the brief's "holding S maintains the slide"), so a beginner who holds S on a descent keeps scrubbing at 40° (§5.2) until they let go or stop. A / D shape everything from there: push *into* the rotation to deepen β past 40°, or steer *against* it to countersteer toward alignment. Broadside (90°) is the unstable balance point — holding it is skill; below it the board wants to straighten, above it the board wants to come round (the twist). Yaw rate is clamped at `yawMax` 4 rad/s (230°/s) so there is no uncontrollable spin; there is no auto-straighten.
- **Countersteer assist** (`catch` 1.5): a steering torque *toward* alignment is multiplied by 1.5 while sliding. Catching the board is meant to be easy; the assist never acts when the stick is centred, so a released board still drifts back on its own time.
- **Release** (S up): the hold torque ends; `gripState` recovers toward 1 at `bite · cos²β` (`bite` 5 /s): fast when the board is nearly aligned (~0.3 s), slow while it is still across (a board released at 70° keeps sliding until the aligning torque — or your countersteer — brings it toward straight, then it bites). The transition from slide to rolling is continuous and *controllable*: countersteer to bite sooner, hold the angle to bite later. **Nothing snaps back on release.**
- **Low speed** (s < 2.5): S is the **foot brake**: `footBrake` 4.0 m/s² opposing `t̂`, no kick-out, to a stop. One key, one meaning ("S sheds speed"); which mechanism is the board's choice, and the difference is obvious under the wheels.

### 3.4 Braking with no acceleration afterwards

Slowing down is what S does; the boost is never a consequence of S alone (§4.3). A rider who slides to scrub speed and then straightens simply *rides on slower*, exactly as they asked. Someone who slides to a stop stops. The old `BRAKE_DECEL` system, the C-slide/S-slide split and the 0.6 / 3.0 exit thresholds are gone; a slide ends when `gripState` returns or the board stops.

### 3.5 The twist

Push into the slide past 90° and the self-aligning torque changes sides: the board comes round to 180°, `lead` flips, `β` re-centres, and grip returns with the tail leading — the 180° powerslide, riding fakie, no revert key. The twist costs more speed than a slide (you were broadside on the way) and is worth it when the bend is tighter than a slide can take, or for style. A pop while sliding takes the rotation into the air (`yawRate` becomes air spin; the air system is unchanged). Revert (X) is removed (D39): landing from an air and twisting is the same S-and-steer.

---

## 4 · The legs: push, pump, boost — one energy input

The rider's legs are the only thing that ever *adds* energy on the ground. Three uses, one seam (`legs.impulse(along)`), one key: **W** (Move pad up; A on a pad).

### 4.1 Push (the flat)
Skate v2's stroke stays, with its numbers moved into the profile: period 0.46 s (0.38 with Shift / R3), kick window 0.14–0.44 of the stroke, acceleration `pushAccel` 13 (16 sprinting) × `(1 − s/pushCap)^0.8`, `pushCap` **7.0** (= `speeds_ms.board`; the manifest's number becomes the board's cruise, one number instead of five), sprint 8.4. `pushGrip[pace]` scales the kick (flow 0.9, slow 0.8, threshold 0.5, off the bed 0). Pushing is blocked while sliding, in a manual, crouched past 0.5, or on ground steeper than 35° (`pushSlopeMax`). The travel-mode second push model (the continuous 5.5·(1 − v/11) floor) and its caps 11/14 are removed; uphill you push like anyone else (§5.3).

### 4.2 Pump (transitions)
Unchanged mechanism: crouch → extend on curved ground adds energy ∝ curvature (`pumpGain` 2.2, saturating at `pumpVref` 2.8). It lives in the legs seam now, so a pump and a boost are visibly the same motion of the same rider.

### 4.3 Boost — the pump out of a slide

**What earns it.** While sliding (`gripState` < 0.3) at speed (s ≥ `chargeMinSpeed` 3.0), after a **set delay** of 0.35 s of continuous slide, `legs.charge` rises at `(sin β / sin 45°) · min(1, s/6) / chargeTime` (`chargeTime` 1.2 s) to a cap of 1: **full after 1.55 s** (0.35 + 1.2) of a 45° slide at 6 m/s or more; a 25° speed check earns at about half that rate; broadside fills faster (1.2 s) but costs far more speed; and because the rate scales with speed below 6 m/s, a slide that bleeds you under 6 fills more slowly as it goes. Physically: the rider is crouched and loaded through the whole slide. That crouch is **pose only** — the legs' `charge` never feeds the pump (§4.2, which reads the player's crouch input on curved ground) nor the landing's crouched-impact allowance (§6.3), so there is no second, hidden boost.

**How you know.** Three tells, none of them text: the rider's crouch deepens with the charge; the wheel screech's pitch rises with it and goes *bright* when full; and the one glass bubble (§10.4) fills as an arc. Nothing shows a number.

**How it releases.** When grip returns (`gripState` crosses 0.7 rising) with a **clean exit** — |β| < `cleanExitDeg` 25 (or within 25° of fakie-straight after a twist) and s ≥ 3 — the charge is *available* for `releaseWindow` 0.5 s. **Pressing W inside the window releases it**: an along-board acceleration of `boostPeak · charge / boostTime` for `boostTime` 0.6 s (`boostPeak` 2.5 m/s at full charge), through the same velocity, subject to the same drag and grip. If W is not pressed the charge ebbs over 1 s and nothing happens. The boost is an opportunity, never an obligation, and never a surprise: the same key that pushes on the flat pumps out of the corner.

**What it will not do.**
- Tap-farming: a slide shorter than the 0.35 s set delay earns nothing.
- Stationary or crawling slides: nothing below 3 m/s, and the charge rate scales with speed up to 6 m/s.
- Spinning in place: impossible — you cannot slide without speed, and yaw is capped.
- Chaining: a boost cannot be re-earned until `gripState` has been above 0.7 for 0.4 s, and every charge costs a slide. On the flat from 10 m/s (roll and drag included, the s/6 factor biting as you slow) a 45° slide held 1.55 s sheds ~5.9 m/s and gives back ~2.2; a 0.6 s speed check at 25° sheds ~1.8 and gives back 0.3. **Slide-then-boost is never a net gain on the flat**; a line that brakes only where it must and carves the rest is faster than any slide chain. Downhill, where bends make you slide anyway, the boost pays back a well-taken corner — that is the rhythm: build speed, choose a line, enter, control the angle, straighten, release.
- Ordinary braking never reads as a failed trick: a slide that ends in a stop, or a charge nobody claims, simply lets the arc empty; there is no failure state, no message, no sound of loss.

---

## 5 · Downhill — the proving ground

### 5.1 The forces at play
With g 12, real grades and the pace table, the board's *natural* speeds (drag-limited, no input) are:

| Grade | gravity | fast (paved, ochre, packed earth) | flow (banked turf, apron, boardwalk) | slow (cobble, gravel, sand) |
|---|---|---|---|---|
| 4 % | 0.48 | 6.3 m/s | 5.0 | rolls to a stop |
| 8 % | 0.96 | 9.5 | 8.8 | 6.2 |
| 12 % | 1.43 | 11.9 | 11.3 | 9.5 |
| 15 % (S1's average) | 1.78 | **13.4** | 12.9 | 11.3 |
| 18 % (`skateMain.grade_max_pct`) | 2.13 | 14.8 | 14.3 | 12.9 |

You *feel* the difference between a steep section (the board runs away toward 13–15), a banked sweep (a hair slower, but you can carve it), scrubbing sideways (§5.2) and flatter ground (a fast quay at 4 % settles under 7, the reed chicane's cobbles pull you toward 6). Nothing clamps: the 15 safety is above every row.

### 5.2 The slide as speed control
Net deceleration at **10 m/s** on paved ground — scrub `G·sin β` plus rolling resistance and drag (1.04 together at that speed) against gravity on the grade (positive = slowing):

| Slide angle | scrub | net on 8 % | net on 15 % | net on 18 % |
|---|---|---|---|---|
| none (rolling) | 0 | +0.1 (holding) | −0.7 (gaining) | −1.1 |
| 15° | 1.2 | +1.3 | **+0.4 — near enough holds** | +0.1 |
| 25° | 1.9 | +2.0 | +1.2 | +0.8 |
| 35° | 2.6 | +2.7 | +1.8 | +1.5 |
| 40° (the S hold) | 2.9 | +3.0 | **+2.1** | +1.8 |
| 45° | 3.2 | +3.3 | +2.4 | +2.1 |
| 90° | 4.5 | +4.6 | +3.8 | +3.4 |

So on S1 a shallow 15° lean-slide carries you across the slope at the speed you have; 25° sheds about a metre per second each second; the S hold at 40° sheds two; broadside is the emergency stop. Slower, the scrub is the same but drag is less — the slide bites harder relative to gravity as you slow, which is why a slide always *can* stop you. The slide provides meaningful control on every grade the land pass allows — and only through the same lateral force that makes the carve. Loose surfaces scrub less (grip × 0.6–0.7) and roll worse; on the Reach's cobbles you slow by rolling and slide less.

One consequence worth saying plainly: **a slide turns the velocity more slowly than a carve at the limit** (4.5 m/s² of lateral force against 7.2), so sliding is never the faster way round a bend. It is the way to shed speed *while* turning when you arrive faster than the bend can be carved. The fast line brakes before the bend and carves it; the *fun* line slides through it and takes the boost.

### 5.3 Uphill, low speed, transitions, uneven ground
- **Uphill**: gravity opposes; the push stroke works against it. On a 10 % climb (1.2 m/s² of gravity) the stroke holds ~5 m/s; on 18 % ~3.5. Fakie pushes push along `t̂` as today (`sim/index.ts:532`). Rolling back down when you stop is real: turn across the slope (a carve at low speed pivots) or foot-brake (S).
- **Low speed** (< 0.7): pivot steering; S foot-brakes; W pushes. Nothing else changes; there is no "idle mode".
- **Slope transitions**: a dip or a bank re-projects `v` with the energy correction (§2.4); a crest that falls away faster than the ride line makes the board **airborne** with its velocity intact (§6.2). No transition resets speed or direction; the only speed a transition takes is what a landing takes (§6.3).
- **Uneven ground**: the three-point contact gives the board pitch and catches lips. Bumps under `stepMax` (0.12) are ridden through (the trucks' ground line); anything taller is an edge you can see. Banked turf (18° in the land data) leans the contact normal so gravity's tangent pulls to the inside — the bank *is* the lateral force, which is why a carve on the Shoulder sweep feels held while the same carve on the flat Crown drop needs the wheels.

### 5.4 S1 by the numbers
A 1-D estimate with the pace table, bends every ~120 m taken with a 45° slide down to a corner speed, and the boost released on each clean exit: **83–88 s** at corner speeds of 8–11 m/s; 84–94 s with no boost. Inside `time_target_s [70,130]` either way; the boost is worth 1–6 s over the line. The manifest's 139 s is the flat-speed formula, not a fact about the line (D44).

---

## 6 · Everything else on the board, in the same model

### 6.1 Air, tricks, grinds, manuals, wallrides — components on the kernel
Skate v2's air (pop, spin, settle, flips, grabs), grinds and slides (15), lip stalls, wallride and manual **stay** — as contact states of the kernel, not as separate motion models:
- **Air**: `contact.kind = 'air'`; ballistics at g 12; `yawRate` becomes spin on take-off and comes back as `yawRate` on landing. The pop's height stays in metres (`√(2gh)` with h 0.16–0.56, plus up to 1.1 for a held Space charge), so jumps are the same height at g 12; airs off transitions are ~17 % higher than today's g 14 (retuned in the park tests, D40). The vert deck pull and the grind/wall magnet stay as *air* assists (they never act on the ground).
- **Rail** (`'rail'`): velocity constrained to the rail tangent; the profile's `railFriction` (0.55; 1.5 for a boardslide) and the same gravity tangent along the rail; lock keeps `|v·tangent|` with **no injected minimum** (today's 0.5 floor goes); exit hands `v` back with the rail's kick (0.25–1.3 sideways, unchanged). Grind selection, balance, wobble, tips: unchanged.
- **Wall** (`'wall'`): unchanged numbers, expressed as a contact state.
- **Manual**: a balance state *on* ground contact; `manualDrag` 0.25 added to roll; steering × 0.7; unchanged balance.
- Scoring (`tricks/score.ts`) reads events only and is untouched.

### 6.2 Crests and drop-offs
Where the ground under the leading truck falls more than `stepMax` below the ride line, the board is airborne with its velocity intact (today's rule, `sim/index.ts:680-690`). Stair noses, kerb edges, ledge lips: the same. No impulse is added.

### 6.3 Landing — one rule
Touchdown removes the normal component of `v`; speed keeps `clamp(1 − 0.05·max(0, impact − 3)·(crouched ? 0.6 : 1), 0.45, 1)` (Skate v2's impact rule; "crouched" is the player's crouch input, never the charge). **The angle is not a separate rule any more**: a sideways landing simply lands with `gripState` set from the touchdown angle (`gripState = cos²β`) — nearly straight lands gripped; 45° across lands in a slide that the tyre step then resolves, scrubbing and turning the board toward its travel exactly as a slide would, with the twist available past 90°. A landing bails only on hard impact (7.6 m/s of normal speed, 11.5 crouched), never on angle. The travel-mode landing (× 0.94, erase fakie) is gone.

### 6.4 Solids, water, bails
- **Solids**: the kernel removes the into-component of `v` (one restitution rule, not five); a wall met faster than `wallBail` 4.2 is a bail (unchanged). Soft dressings stop the board the same way (the "soft ×0.8" special case goes).
- **Water**: not a bail. `submerged()` under the board → the brief's **300 ms fade**, and it fades you **back onto the board, stopped, at the nearest point of the bed you left** (never onto your feet: a mode ends only at a threshold, CONTRACT §2.4). Wet trousers for 20 s (the FLIGHT little thing, shared).
- **Bails** (hard impact, wall bail): Skate v2's bail/recover (0.8 s + 0.48 s) unchanged; recovery places the rider on the board at a stop, gripped, `charge` 0.

### 6.5 Beds, thresholds, the edge of the bed
The board is **bed-bound** — the Must-not "let the board or bicycle leave its beds" stands — and the binding is physical and visible, never a wall:

- **Legal ground** is the profile's `beds` list: for the board the skate beds S1–S4 (deck *and* gravel shoulders), the Tideline park, and every threshold pad; for the bicycle roads, spurs and trails. Everything else — terrain, walks, stairs, plazas off S3, the other mover's beds, roads for the board — is the kernel's `offbed` contact class.
- **Off the bed the wheels dig in**: `offbed` is roll 6.0 with `pushGrip` 0 — a board length at walking pace, ~3 m from 6 m/s, ~8 m from full speed; the rider's foot is down, the pace bubble says so ("off the line"). After 0.6 s at a standstill off the bed (or at once in water) the **300 ms fade back onto the bed** puts you on the board, stopped, at the nearest point of the bed you left. The same permitted teleport the CONTRACT gives water, extended to the bed's edge (D43). You cannot be stranded, you cannot ride Lantern Row, and nothing invisible stopped you: you rolled onto grass and grass does not roll.
- **Run-outs are for braking; pads are threshold pace.** Pass 1 cuts a 25 m run-out before every door and threshold (`01-land.md`, `skateMain.runout_m`); it is `slow` paving (roll 0.6) — room to brake, not a brake — and **S is the brake**: the 40° hold sheds ~4 m/s² there, so from 10 m/s you are at walking pace inside 12 m. Every threshold pad carries pace `threshold` (roll 1.8, `pushGrip` 0.5): its 6 m stop any board arriving under ~4.6 m/s and bring 7 m/s to a walk. That is how "`threshold` pace brings the board to walking pace and offers `park`" (the M1 brief) is *made* rather than enforced. A rider who never touches S overruns the pad onto `offbed`, digs in within a few metres, and is faded back to the pad — the world's polite "you missed the stop". `skate.rules` "board never past a threshold" is kept twice over: the bed geometry stops at every board→feet pad (P17, `test/horizonBoardThresholds.test.ts`), and beyond the pad is `offbed`.
- **At-grade crossings where the line continues** (S4 × VBS `[874,941]`, S4 × VG `[973,538]`, S2 × the Bight pier walk `[509,896]`, S4 × the garden walk `[893,600]` "boards to the rail side at walking pace"): the pad is threshold pace and the far side of it is the line again, so a rider who has braked crosses at walking pace with the kerb gap, as the crossing notes say; one who arrives fast is slowed hard by the pad (7 m/s → ~2.5) and carries on; the offer to park is there, the choice is yours. Pushing across a pad cannot exceed ~2 m/s (`pushGrip` 0.5 against roll 1.8).
- **Pick up** at `skateLineStarts.1–4` (feet→board, the offer by proximity, the action yours: E / the Enter bubble — a pad is never within a door's 2.4 m reach because every door has its own 25 m run-out), **park** at every board→feet threshold (the same action). The kernel's `enter(threshold)` places the board under the rider at the pad, stopped, facing along the bed; `exit(threshold)` drops the rider on foot where the board stopped. Parking mid-bed is not offered (CONTRACT §2.4); the board slows on its own where the land makes it and the pad is where you step off.
- **Threshold pace mid-line** (`plaza`, S3's square): roll 1.8 brings 7 m/s to walking pace in ~3 s / 15 m — the square's 12 m "continuous floor" segment does it on its own; the cobbled edge lane is the ride-through.
- **The race (S1)**: the countdown freezes the kernel (unchanged); 17 gates and Retry-in-every-state stay with `race.ts` (integrator). The finish line ends the race; **there is no automatic run-out brake** (D43) — the run-out is slow paving, the rider's S is the brake, `landingQuay`'s pad is the stop and the park.

---

## 7 · Consolidation — what changes in the existing mechanics

| Today (file:line) | Decision | In the model |
|---|---|---|
| Travel assist: gravity 0.16 g outside trick zones (`sim/index.ts:517-518`), `complexPhysicsAt` / `slopeGravityAt` / `raceCorridorAt` (`driver.ts:87-89`) | **Remove** | real gravity everywhere; assist = the Tideline park's *forgiving landings only* (`landing.forgiveness` in the park's profile overlay, §8.1) |
| Second push model + travel caps 11/14 (`:577-586`), uphill-start override (`:539-542`) | **Remove** | one stroke, `pushCap` 7.0, real uphill |
| Travel landing (`:1126-1138`) | **Remove** | one landing rule (§6.3) |
| `BRAKE_DECEL` 5.5 as a speed-regime brake (`:561`) | **Replace** | S = slide at speed, foot brake 4.0 below 2.5 m/s |
| Brake + steer auto-slide, C / LT slide, the 0.6 / 3.0 exit split (`:548-554`) | **Replace** | S is the slide; one exit (grip returns) |
| Kinematic carve rotating `v` (`:620-624`) | **Replace** | yaw torque on `heading`; `v` follows through grip |
| `LATERAL_GRIP` cancel (`:740`) + `SELF_STEER_RADIUS` gravity steer (`:742`) | **Merge** | the tyre step (§3.2) + self-aligning torque (§3.3) |
| `slideAngle`, `POWERSLIDE_ROT/OVER_RATE/SCRUB_*`, `SlideS` (`:764-775`, `tuning.ts`) | **Replace** | β is emergent; scrub is the tyre step |
| Revert (X, `doRevert` `:805`, `REVERT_*`) | **Remove** | the twist (§3.5) |
| Four speed caps (`MAX_SPEED`, `PUSH_CAP`, travel 11/14, the grind's re-clamp) | **Merge** | drag sets top speed; `pushCap` is the legs; `MAX_SPEED` 15 a safety only |
| Five collision restitutions (`:487-497, :657-658, :1618`) | **Merge** | remove into-component; wall bail over 4.2; water = fade |
| Run-out auto-brake `RUNOUT_DECEL` + 9 s (`:155, :563`; `driver.ts:91, 303-308`) | **Remove** | the run-out is paving; S is the brake; the race ends at the line |
| Grind's 1-D speed with a 0.5 minimum and its own cap (`:1301, :1327-1329`) | **Merge** | rail contact state; no injected speed |
| Three pop buffers (`popBufferMs` 140, `POP_BUFFER` .1, `POP_COYOTE` .09) | **Merge** | one 0.12 s buffer + 0.09 s coyote |
| W / S doubling as lean ±1 on keyboard (`input/index.ts:227-229`) | **Remove** | lean comes from the physics (§10.1); the manual's balance reads the stick / arrows, not W/S |
| `Math.pow`-free `ease()`, fixed step, accumulator, frame-rate identity test | **Keep** | the kernel's spine |
| Pop, air spin/settle, flips, grabs, grinds, wallride, stall, manual, bail/recover, trick catalog and scoring | **Keep** | contact states and components on the kernel |
| Skate cam springs, look-ahead, FOV-by-speed (`camera/skateCamera.ts`) | **Keep, minus roll** | roll 0 at every tier (§10.2); yaw follows *velocity*, not heading |
| Rig's own carve roll, slide yaw overlay, manual pitch ×2, grind pitch ×2 (`look/boardRig.ts:339-343, 359-365, 357, 380`) | **Remove the doubles** | the rig reads the kernel's heading, pitch and roll once |
| Landing angle rules `LAND_CLEAN_DEG` 25 / `LAND_SKETCHY_DEG` 50 / `LAND_SKETCHY_KEEP` .62 (`sim/index.ts:1163-1176`) | **Remove** | a sideways landing is a slide (§6.3) |
| **Values that change** (declared, not hidden): carve radius law 0.75 + 0.3·s → max(1 + 0.9·s, s²/0.9 G) (3.75 m → 13.9 m at 10 m/s); drag 0.0045 → 0.0092; `GRAVITY` 14 → 12; grass `PUSH_GRIP` .62 → off-bed 0; `PUSH_CAP` 6.8 → 7.0; brake 5.5 → foot brake 4.0 below 2.5 m/s; pop buffers 140 ms + 0.1 s → 0.12 s | **Change** | each with its reason above; the Tideline park's feel changes with them (wider carves at speed, higher airs, real gravity on the aprons) and its tests are retuned in the same PR (D40) |
| `WALLRIDE_GRAVITY` .35 (`tuning.ts`) | **Keep** | a multiplier on the one `g` inside the wall component, not a second gravity |
| Skate v2's reduced-motion allowances (manual tip × 1.25, catch window × 0.7; `sim/index.ts:781, 1143, 1214, 1342`) | **Keep** | they live in the air/rail/manual components; the *ground* physics is identical under reduced motion |
| Skate v2 `SurfaceKind` (7 kinds, `ROLL`, `PUSH_GRIP`) | **Replace** | the bed segment's pace → `roll`; the manifest surface id → `grip`, `pushGrip` (§8.3); the park's `concrete/wood/metal` map to `paved/boardwalk/rail` |
| `world/field.ts` (park pads, aprons, fillets) | **Keep, behind `surface()`** | the park is served through the same three-point query |
| `createSkateDriver` hard-bound to the Mountain field and `SKATE_ROUTES` (`driver.ts:97, 189`; `park.ts:27`) | **Replace** | `BoardController` implements `ModeController`; the Mountain race becomes S1's `race.ts` data |

Fewer rules, better transitions, more expressive control: after this table the ground has **one** velocity writer (the kernel step), **one** heading writer (yaw integration), **one** lateral force (the tyre step), **one** energy input (the legs), **one** landing, **one** collision response.

---

## 8 · Profiles and tuning

### 8.1 Shared vs board
`GroundProfile` is what a mover hands the kernel. The kernel knows nothing about boards; the board, the bicycle and the skates are profiles plus their own components.

```
GroundProfile {
  beds:    BedKind[]                                           // the ground this mover's wheels roll on; all else is offbed
  contact: { wheelbase, stepMax, width }
  roll:    { fast, flow, slow, threshold, skate, offbed }      // rolling resistance by pace (MANIFEST.paces) + the offbed class
  drag
  grip:    { roll, slide, steerLimit, kickOut, kickYaw, holdAngle, bite, align, catch, slideEntrySpeed }
  steer:   { radius0, radiusV, yawResponse, yawDamping, yawMax, pivotSpeed }
  legs:    { pushAccel, pushCap, sprintAccel, sprintCap, period, sprintPeriod, pushSlopeMax,
             pumpGain, pumpVref, footBrake, brakeSpeedMax,
             chargeMinSpeed, setDelay, chargeTime, cleanExitDeg, releaseWindow, boostPeak, boostTime, boostCooldown }
  landing: { impactLoss, hardImpact, hardImpactCrouched, forgiveness }
}
```

About fifty fields. **Eight of them are knobs** (§8.2); the rest are fixed by this document at the values it gives and change only by a decision, the same way the manifest's numbers do. A builder who finds one of the fixed values wrong reports it in `HANDOFF.md → Conflicts`.

| | Board (M1) | Bicycle (M2) | Ice skates (pass 4) |
|---|---|---|---|
| beds | skate beds (deck + shoulders), the Tideline park; pads are legal for everyone | roads, spurs, trails (walkPlan's grade filter stays); pads | `stillwater` ice |
| contact | wheelbase 0.44, stepMax 0.12 | 1.05, 0.10 (a kerb stops a bike too) | 0.30, 0.04 |
| grip.roll / slide | 8.0 / 4.5 | 6.0 / 4.8 (a skid, not a drift: S tails out ≤ 20°) | 1.6 / 1.2 |
| grip.holdAngle / kickYaw / yawMax | 40° / 2.2 / 4 | 20° / 0.4 / 2 (no twist) | 60° / 1.5 / 4 (the hockey stop) |
| steer.radius0 / radiusV | 1.0 / 0.9 | 2.0 / 1.4 | 1.2 / 1.0 |
| legs.push | stroke 13 / cap 7.0 | continuous pedal 2.5 / cap 6.0 (`speeds_ms.bicycle`), bell on purpose | stroke 6 / cap 5 |
| legs.boost | 2.5 | 0 (no boost on a bike) | 0 |
| legs.footBrake / brakeSpeedMax | 4.0 below 2.5 m/s | 4.0 at **any** speed (both brakes: S is brakes plus a ≤ 20° skid) | 3.0 below 2.5 |
| pop | yes (Space) | none | none |

The bicycle inherits nothing of the board's feel: no kick-out to speak of, no twist, no charge. It gets the board's *understanding* of ground, grip, gravity and steering for free, through the same tests.

### 8.2 The eight knobs (what changing each feels like)
Every number above has one job. A tuner touches these eight; the rest follow:

| Knob | Lives in | Turn it up and… | Turn it down and… |
|---|---|---|---|
| **grip** (`grip.roll`) | grip | carves hold tighter at speed; the surface cap bites later; sliding needs S more | fast carves skitter; the board feels loose everywhere (that is what cobbles do) |
| **slide** (`grip.slide`) | grip | slides scrub harder and end sooner; broadside stops you fast | slides go longer and shed less; downhill control weakens (below ~2.5 a 45° slide at speed no longer beats a 15 % grade) |
| **steering** (`steer.radius0/V`) | steer | wider, calmer turns; less pivot at low speed | twitchy; more lateral demand, so more accidental skitter on loose ground |
| **spin** (`steer.yawResponse/Damping/Max`) | steer | the board rolls into turns faster and carries more rotation into a twist | lazier, safer; twists need commitment; less momentum to catch |
| **catch** (`grip.catch`) | grip | countersteer saves anything; slides feel forgiving | catching a deep slide is real work; broadside holds are hard |
| **bite** (`grip.bite`) | grip | grip returns fast on release; snappier exits, boosts come sooner | long, buttery exits; the board keeps drifting after you let go |
| **kick** (`grip.kickYaw/kickOut`) | grip | S throws the tail out big and instantly (arcade) | S is a subtle unweight; entering a slide needs steering |
| **legs** (`legs.boostPeak`, `chargeTime`) | legs | bigger, quicker boosts (never beyond the slide's cost — check §4.3's table) | the boost is a pat on the back |

Surfaces are the ninth control and belong to the design lead in the manifest (§8.3), not to a tuner.

### 8.3 Paces and surfaces (MANIFEST v1.7)

Two tables, because the deck already separates them: the **segment's pace** is the design lead's word for a stretch of line (it may differ from the surface's default: S2's Wash bowl is `flow` on ochre, S3's market stair `flow` on paving), and the **surface** is what the wheels touch.

`MANIFEST.paces` (new; rolling resistance and push grip by pace):

| pace | roll | pushGrip | meaning |
|---|---|---|---|
| fast | 0.12 | 1.0 | open line |
| flow | 0.25 | 0.9 | banked or boarded ground that wants a carve |
| slow | 0.6 | 0.8 | a neighbourhood, a chicane |
| threshold | 1.8 | 0.5 | every pad and the square: stops a board arriving under ~4.6 m/s in a pad's 6 m |
| skate | 0.03 | — | pass 4's ice; the skates' pace |
| n/a | — | — | not a bed for this mover (`duff`); the kernel's `offbed` class applies: roll 6.0, pushGrip 0 |

`MANIFEST.surfaces[*]` gains `grip` (lateral, a multiplier on the profile's grip):

| surface | default pace | grip | note |
|---|---|---|---|
| paved | fast | 1.0 | |
| packedEarth | fast | 0.95 | |
| ochre | fast | 0.85 | the Flats' dust: fast and a little loose |
| apron | flow | 1.0 | the dam's concrete |
| bankedTurf | flow | 1.1 | the bank holds you |
| boardwalk | flow | 0.9 | hums; damp planks slide |
| cobble | slow | 0.7 | chatter; skitters |
| gravel | slow | 0.6 | the skate beds' shoulders |
| sand | slow | 0.5 | |
| plaza | threshold | 1.0 | |
| snow (Dec–Mar) | slow | 0.4 | pass 4 places it; the board reads only what is under its wheels |
| ice (Jan–Feb) | skate | 0.2 | pass 4's skates; a board that meets ice is in a slide it did not ask for |
| duff | n/a | — | never a bed |
| *(kernel classes, not manifest ids)* `offbed` (terrain `'grass'`, any bed not in the profile) | — | 0.6 | roll 6.0; the dig-in and the fade back (§6.5). Pads (`'stone'`) are *not* offbed: `threshold` for every mover |
| *(kernel class)* `rail` | — | — | the rail component's own friction (0.55 / 1.5) |

Design-lead edit through `make_manifest.py`; not a geometry bump. `skate.park.note` changes from "travel assist on" to "forgiving landings" (D40). `test/horizonBoardPace.test.ts` proves every surface id and every segment pace resolves to one row, that pads resolve to `threshold`, and that terrain resolves to `offbed`.

---

## 9 · Reproducible, comparable

- **Determinism**: same start pose, same terrain revision, same input log → the same ride to 1e-6, at any frame rate. The existing identity test is generalised to the kernel (`test/groundKernel.test.ts`), and the Horizon runtime's board ride records a **ride log** per fixed step: `{step, input {steer, push, slide, pop}, p, v, heading, yawRate, grip, β, s, pace, charge, event?}` (JSON, `evidence/rides/*.json`). The same log *replays* in the harness (`__harbour.replay(log)`) for the eye. The race ghost (`skate/replay.ts`, positions only) becomes a *view* of the same log — one recording, two readers, no second format.
- **Five situations** (`test/horizonRideSituations.test.ts`, headless on the baked S1/S2 beds; also a synthetic slope harness at 0 / 8 / 15 / 18 % and −8 % for the pure numbers). Each is a scripted input log with a start pose; each asserts ranges derived from §3–§5 (re-derived whenever a fixed value changes) and writes its trace:

| # | Situation | Where | Input script | Asserts |
|---|---|---|---|---|
| R1 | **Downhill carve** | S1 Crown drop, first 150 m, from `skateLineStarts.1` | no S; alternating A / D holds of 1.2 s | speed rises monotonically to 11–13.5 by 120 m; |β| < 8° throughout; lateral acceleration never above 0.9 G; no bail; heading change per carve 20–35° |
| R2 | **Sustained slide** | S2 the Wash bowl, the bend at `[465,700]` (flow, ochre) | enter at 10 m/s; S held 2.0 s, stick centred | β reaches 35–45° within 0.4 s and stays within ±6° of 40° for the hold (the S hold); speed sheds 5–7 m/s on the bowl's grade; charge reaches ≥ 0.8 by 1.8 s; no twist |
| R3 | **Direction change** | S1 Shoulder sweep switchback (15 %) | 9 m/s; S + A 1.6 s, release, A 0.5 s, then S + D 1.2 s | two slides of opposite sign; between them grip ≥ 0.7 for ≥ 0.3 s and the turn reverses; the sum of |Δheading| over the three phases 80–140°; speed never below 2 m/s and never reset; no bail |
| R4 | **Straightening recovery** | S1 Notch shelf (fast, paved) | 13 m/s; S + D 0.5 s to β ≈ 60°, release S, countersteer A 0.5 s | β returns under 10° in 0.5–1.0 s; grip crosses 0.7 once (no oscillation); speed loss 2–3.5; no twist, no bail |
| R5 | **Boost exit** | S1 Quay finish (fast, paved, ~4 %) | 11 m/s; S + A held 1.6 s (β settles 50–60°; charge ≥ 0.85), release, A 0.3 s, W at grip 0.7 + 0.1 s | clean exit flagged; boost fires; peak speed 1.6–2.4 above the exit speed within 0.7 s; the same script **without W** shows no rise; the same script with W 0.6 s late shows no rise |

A sixth, **R0 the twist** (S2 Wash rim, hold S + D past 90°), proves `lead` flips once, grip returns fakie, and the boost exit is still clean at fakie-straight.

These are handling checks, not a product: no UI beyond the harness's replay, no scores.

---

## 10 · What the rider sees, hears and holds

### 10.1 Pose and board (read-only)
The rider **leans** by the lateral acceleration the wheels are actually delivering (`a_lat / g` → hip and shoulder angle, ≤ 32°); the board **rolls** by the truck geometry (`steer` → deck tilt ≤ 12°) and **pitches** by the kernel's contact pitch; the **crouch** is the player's crouch (push stroke, pump, Space charge) *plus*, in pose only, the slide's charge — the deeper the crouch, the fuller the charge (never fed back into the pump or the landing, §4.3). In a slide the back foot pushes the tail out and the front shoulder opens across the travel line by β. Nothing in the pose is a second physics; a lean that is not in the forces does not exist (today's rig doubles go, §7).

### 10.2 Camera
`camera/skateCamera.ts` stays (near 2.5 / 0.52, far 3.35 / 0.95, springs 11 / 7 / 4.2 / 3.2 / 3) with two changes: **roll is 0 at every tier** — the brief's rule 7 requires it under reduced motion; this file extends it to all riding because a rolling camera hides which way the board is pointing, the one thing a slide must show — and the camera's yaw target follows the **velocity direction**, not the board's heading. That second choice is what makes a slide readable: the world keeps flowing straight past while the board turns across the screen. FOV 54 → 72 by speed at full tier (`fastSpeed` 11; race 15 — allowed by rule 7 as written, which scopes the no-FOV rule to reduced motion); a +4° kick over 0.3 s on a boost release (full tier only). Reduced motion, calm view and lite: FOV fixed at 54, no kick, dolly halved. Handoffs: pick up blends walk cam → skate cam over 0.8 s (both behind the rider, < 30 eu); park blends back over 0.6 s; every fade is a cut. Horizon in frame on the Crown drop (brief) is a framing check, not a camera mode.

### 10.3 Sound
- **On purpose (the one sound)**: the **wheels' slide** — urethane on the surface, from a chirp at a speed check to a scream broadside, pitch rising with the charge, bright when full. The brief's "the wheels, by surface" is the ambient: paved roll, cobble chatter, boardwalk hum, ochre hiss, scaled by speed through `WorldAmbience.update`.
- The boost release: the wheels bite (a short "grip" note) then the roll pitch climbs.
- Calm view: silent. Reduced motion: unchanged sound.

### 10.4 The HUD — one glass bubble, and the quick layer
Screen-space DOM only, Jonathan's glass/bubble style, descriptive icon, 44 px, `env(safe-area-inset-bottom)`:

- **Pace** bubble (bottom-right): normally the surface under the wheels as a word and its icon ("fast · paved", "flow · boardwalk", "slow · cobbles", "threshold · the square"); **during a slide** it becomes the charge arc filling around the icon; **in the release window** it shows the push glyph (W / the pad's up) for 0.5 s; at a threshold pad it is the offer ("Park" / "Pick up"). One bubble, four jobs, never two at once. In the S1 race the existing race HUD (gates, countdown) stays where it is.
- **Nothing shows a number** — no speedometer, no charge percentage. Speed is the camera and the sound.
- The **quick layer** stays in every phase (`test/horizonQuickLayerModes.test.ts`, the integrator's test from the brief); money one tap away at 14 m/s. **Nothing on the board reads a balance**: the static import fence the brief gives pass 4 (`horizonPastimesNoMoney`) is written by the integrator in pass 2 and covers `movers/board/**` and `movers/shared/ground/**` from the first commit.

### 10.5 Controls

| | Desktop | Phone / touch | Gamepad |
|---|---|---|---|
| Push / pump / boost | **W** (hold to stroke; tap in the window to release the boost) | Move pad **up** | **A** |
| Slide / foot brake | **S** | Move pad **down** | **B** (LT duplicate) |
| Steer | **A / D** | Move pad **left / right** | left stick x |
| Pop | **Space** (hold to charge) | Jump bubble | X |
| Sprint | Shift | — | R3 |
| Tricks in the air | arrows / IJKL as today | flick pad as today | right stick as today |
| Pick up / park | **E** at a pad | the Enter bubble | Y |
| Look | mouse drag | Look pad | right stick (on the ground) |

Removed: C (slide), X (revert), the touch left-stick brake threshold as a separate zone (the Move pad's y is push / slide, nothing else), W/S as lean. Manual balance takes the arrows / the flick pad's y (as `ArrowDown` already does today), on every input kind. E is the walker's door key too: no clash, because a pad sits at least a run-out away from any door. The Horizon runtime's two 94 px pads are reused; the board hides nothing the walker shows.

### 10.6 Reduced motion, calm view, lite, the Desk
- **Reduced motion**: playable, identical *ground* physics (the air, rail and manual components keep their existing reduced-motion allowances, §7); no FOV change, no kick, no camera lean, no dust or streak cards; the charge arc still fills (it is information, not motion).
- **Calm view**: as reduced motion for the camera (FOV fixed, no kick), and the island still and silent; the board rides silently; no cards.
- **Lite**: the same simulation and numbers (a phone rides the same island); FOV fixed; cards off.
- **The Desk / Reading edition**: nothing on the board has a fact behind it; the Desk needs no board page.

### 10.7 Night and the partner
No lamp (brief); lines read by lantern pools and edge lips. The presence wire already accepts `act: 'skate'` (`worldPresenceWire.ts:72,128`) though the Horizon publishes no `act` today. Brief rule 11 is plain: broadcasting a mode is a wire change, so **both** publishing `act: 'skate'` from the Horizon and carrying the slide angle (`p` as β) are written as one Codex trust-review request in `HANDOFF-notes/board.md` (D46), not built in pass 2. Until then the partner's ghost walks where the wire says.

---

## 11 · Interfaces, files, integrator asks

**M1 owns** (`02-movers.md` track table, amended): `src/harbour/horizon/movers/shared/ground/**` (the kernel — M1 writes it; the integrator reviews the interface on commit 1; M2 consumes it through `GroundProfile` and requests changes in `HANDOFF-notes/bicycle.md`), `src/harbour/horizon/movers/board/**`, `src/harbour/skate/sim/**` (retired piece by piece into the kernel and the board's components), `src/harbour/skate/world/field*` (the park, behind `surface()`).

- `movers/shared/ground/kernel.ts` — `GroundState`, `GroundProfile`, `stepGround(state, input, contactQuery, profile, dt)` (pure; the 1/120 accumulator lives in `controller.ts`), events `slideStart`, `slideEnd`, `twist`, `boostReady`, `boost`, `lip`, `airborne`, `land`, `bail`.
- `movers/shared/ground/tyre.ts` — the tyre step (§3.2), self-aligning torque, kick-out, bite; pure.
- `movers/shared/ground/legs.ts` — stroke, pump, charge, release; pure.
- `movers/shared/ground/contact.ts` — the three-point query over `HorizonGeography` (`surface`, `submerged`, `blocker`), the pace lookup, the lip and drop-off tests; the Tideline park's `field.ts` adapted to the same `surface()` shape.
- `movers/shared/ground/log.ts` — the ride log and its replay.
- `movers/board/profile.ts` — the board's `GroundProfile` and the park overlay (`landing.forgiveness`).
- `movers/board/controller.ts` — `ModeController` for `'board'`: `enter(threshold)`, `update(dt, input)`, `exit(threshold)`, `camera()`, `sound()`, `reducedMotionCut()` (the board has none: it is playable); owns the accumulator; composes kernel + air + rail + wall + manual + tricks.
- `movers/board/{air,rail,wall,manual}.ts` — Skate v2's components moved, each reading/writing the kernel only through `contact.kind` transitions and `legs.impulse`.
- `movers/board/hud.tsx` — the pace bubble.
- `movers/board/art/proxy.ts` — greybox deck through `VehicleArt` (dimensions from `boardGeometry.ts`: 0.66 × 0.31, deck top 0.11) until pass 2b.

**Integrator asks (commit 1 or the M1 seam):**
1. `movers/shared/{mode,threshold,vehicleArt,wind}.ts` and `registry.ts` as the brief lists; `'board'` and `'bicycle'` in `ModeId` (already in the union).
2. The mover hook in `runtime/index.ts`: `attachMover(controller)` / `detachMover(at)` — the same ask as `FLIGHT.md §9.2` (pending the FLIGHT patch; the ask stands on its own here); the walker stops stepping while a mover owns the body; the body's `y` is published as today.
3. `HorizonStage` reads reduced motion and calm live (`FLIGHT.md §9.3`, same note).
4. `audio.ts`: `slide(intensity, pitch)` (continuous), `bite()`, and the surface roll loop through `WorldAmbience.update` (speed already flows).
5. **MANIFEST v1.7, data only** (no `horizon-geo` bump): `paces` (new) and `surfaces[*].grip` per §8.3; `skate.park.note` → "forgiving landings" (D40); every threshold pad tagged pace `threshold` and every 25 m run-out `slow` in the bed data (`surfaceSegments`, pads); `journeys` rows for movers gain `measured: 'ride-log'` so `measureJourneys` reports the headless ride time instead of `length/speed` for the board (D44); `speeds_ms.board` stays 7.0 as the *cruise* the push holds. The FLIGHT patch's sky fields (`FLIGHT.md §9.5`, pending) land in the same version.
6. `race.ts`: S1's 17 gates as data on the Horizon bed (the Mountain course's gate records re-based), Retry-in-every-state kept, the run-out brake removed from the driver (D43).
7. One `g` constant exported from `runtime/geography.ts` (12) used by the walker, the kernel and the wings (D40).
8. The walkable-slope conflict (40° code vs 38° manifest, `build.ts:76`) is not the board's to solve; the kernel reads `pushSlopeMax` from its profile.
9. `geography.bedAt(x, z) → { bed, segment } | null` over `WorldDefinition.beds[*].surfaceSegments` (a lookup the runtime does not offer today), so the kernel can read the segment's pace and the profile's `beds` test without owning bed data.

---

## 12 · Tests

**New** (`test/`, headless, against `HORIZON_MANIFEST` and the baked field or a synthetic one):
- `groundKernel.test.ts` — frame-rate identity (30/60/120/144) on a scripted ride; determinism across two runs; NaN guard; the step order.
- `groundTyre.test.ts` — carve conserves speed under the grip limit; demand over grip leaves a remainder (β grows); scrub = `G·sin β` ± 3 %; the steer cap 0.9 G never exceeded by A/D alone on grip 1.0; loose surfaces skitter at speed; self-aligning torque returns β < 8° from 45° in 0.5–1.2 s with no input; 90° is unstable; past 90° `lead` flips once.
- `groundSlide.test.ts` — S at 2.4 m/s foot-brakes (no kick); at 2.6 it kicks; kick sense by stick / by yawRate / by stance (nose in, tail out); S held with the stick centred settles at 40° ± 3° and stays there on a 15 % synthetic slope until released; countersteer assist only when the torque points home; bite ∝ cos²β; no snap on release (grip never jumps > 0.15 per step); yawRate ≤ 4.
- `groundLegs.test.ts` — stroke numbers (Skate v2's promises: 8–10 strokes in 4 s, cruise 5.5–7.0, coast loses < 0.6 in 1 s); no charge under 0.35 s or under 3 m/s; charge reaches 1 at 1.55 s of a 45° slide at ≥ 6 m/s and never sooner than 1.2 s broadside; release only in the window and only on W; late W does nothing; dirty exit (β > 25°) no release; cooldown 0.4 s; **flat slide-then-boost never gains**.
- `horizonBoardPace.test.ts` (brief) — every surface id and every segment pace → one row of §8.3; terrain → `offbed`; every pad and the S3 square segment → `threshold`.
- `horizonBoardThresholds.test.ts` (brief) — no bed passes a threshold; pick up and park only at pads; every pad is threshold pace and stops a board arriving at 4.5 m/s inside its 6 m; from 10 m/s with S held from the run-out's start the board is at walking pace before the pad; without S it overruns, digs in within 10 m and is faded back to the pad, stopped, on the board; no invisible collider anywhere on a line (P19).
- `horizonSkateLines.test.ts` (brief) — a headless rider completes S1–S4 start → end on bed with no required jump; S1 in `time_target_s`; the ride log is written.
- `horizonRideSituations.test.ts` — R0–R5 (§9).
- `horizonBoardLanding.test.ts` — sideways landings become slides, not bails; hard impact bails; water is a fade back onto the board at the nearest bed point.
- `horizonBoardCamera.test.ts` — roll 0 in every phase; yaw follows velocity (a 60° slide moves the board on screen, not the world); handoffs ≤ 30 eu; FOV fixed under reduced motion.

**Changed** (Skate v2 tests whose promises this file rewrites; each is edited in the same PR that retires its subject, never deleted silently): `skate-sim-ride.test.ts` brake (S from 6.5 m/s: a slide at the 40° hold, then the foot brake; stop in ≤ 3 s), powerslide angle 1.2–1.9 rad → β 35–45° with S alone / up to 90° with the stick, revert cases → twist cases, the wall/shore restitution cases (water = fade back), the carve-radius ratio (the *shape* is kept — R grows with speed — but the values change, §7); `groundLegs` replaces the push/coast promises at `pushCap` 7.0; `skate-island-travel.test.ts` (travel assist) → **deleted**, replaced by `horizonSkateLines`; `skate-int-feel.test.ts` park numbers retuned for g 12 (apex heights +17 %); `skate-input*.test.ts` map (C, X, W/S-lean removed).

**Kept green**: everything under `horizon*.test.ts` on main; the frame-rate identity test (moved); the trick, grind, look and HUD suites (their subjects are untouched).

After each section: `pnpm exec vitest run test/<name>.test.ts --maxWorkers=1` and `tsc`. Final SHA only: `pnpm build`, then `pnpm test -- --risk=high --focus=harbour --focus-reason="horizon p2 M1: ground kernel, board, slide and boost"` within five minutes.

---

## 13 · Acceptance rides (Jonathan on the Mac and the iPhone; Bianca when willing)

1. **S1 top to bottom without S** — feel the board run away on the Crown drop and the Shoulder's bank hold a carve.
2. **S1 with S** — hold 25° across the Notch shelf and watch the speed sit; go to 45° and feel it bleed; broadside once to stop.
3. **The Wash bowl** — one long held slide round the bend, straighten, W: the boost onto the Bight Bridge.
4. **A twist** on the Strip rim; ride fakie to the bowl.
5. **S3 into the square** — the plaza brings you to walking pace with no wall; park at `quayWest`; walk back up and pick up again at `skateLineStarts.3` (the upper-street spur end, `[1480,1060]`).
6. **The S1 race** with Retry during the countdown and at gate 0; finish; ride the 25 m run-out; park at `landingQuay`.
7. **Off the bed** on the Green: the wheels dig in, the fade brings you back to the line, stopped.
8. **Reduced motion**: rides 1–3 again; no FOV, no kick, the arc still fills.
9. **Bicycle** (M2): square → Library; S skids the rear ≤ 20°; no boost.

Evidence per the brief: `evidence/rides/board_<ride>.{mp4,json}` (the ride log is the `.json`), `evidence/journeys.md` with the measured S1 time beside D44, the twelve pages after the 2b merge (page C's skate shelf and page I's Reach boardwalk called out), `evidence/rides/reduced_motion.md`.

---

## 14 · Decisions for Jonathan

| # | Decision | Claude's recommendation |
|---|---|---|
| **D39** | **S is the slide.** One key sheds speed: a powerslide at speed, a foot brake below 2.5 m/s. C (slide), X (revert) and the brake-plus-steer auto-slide are removed; the twist replaces the revert. | Yes — the brief's "S enters a powerslide and slows the rider" made into one physical control. |
| **D40** | **One gravity (12) and one ground kernel** for every wheeled or sliding mover (board, bicycle, pass 4's skates), with real gravity everywhere; travel assist retired; the Tideline park keeps only forgiving landings. The park's feel changes (wider carves at speed, transition airs ~17 % higher, real gravity on the aprons) and its feel tests are retuned in the same PR. | Yes. The alternative — the board on 14 and everything else on 12 — is the kind of split this plan exists to end. If the park's exact feel is precious, g 14 for all movers is the fallback (the walker's jump at its fixed 4.2 m/s launch then drops from 0.74 m to 0.63 m unless its launch is retuned). |
| **D41** | **The boost is the pump**: earned by a held, fast, controlled slide (set delay 0.35 s, ≥ 3 m/s, full after 1.55 s at 45°), released only by **W** in a 0.5 s window after a clean exit, +2.5 m/s at full charge over 0.6 s; never automatic, never a net gain on the flat. | Yes — an opportunity, not an obligation; the same key that pushes. |
| **D42** | **Pace is physics** (refines the approved D7): MANIFEST v1.7 gains `paces` (rolling resistance and push grip by pace) and `surfaces[*].grip` (§8.3); no speed caps, no zones; the plaza's, the run-outs' and the pads' threshold pace is rolling resistance 1.8. Top speed comes from drag (~13.4 m/s on S1's paved 15 %). | Yes; the design lead edits the manifest, builders never tune surfaces in code. |
| **D43** | **The bed's edge is physical, not a wall**: the board is bed-bound by the profile's `beds`; off the bed the wheels dig in (roll 6.0) and a 300 ms fade returns the board, stopped, to the bed it left — the CONTRACT's water fade extended to the edge; water itself is the same fade. Every pad is threshold pace (stops a board under ~4.6 m/s; a faster rider overruns, digs in and is faded back to the pad), the 25 m run-outs are slow paving where S is the brake, so "board never past a threshold" is made by the ground. No run-out auto-brake: the S1 race ends at the line, the rider brakes, `landingQuay` is the park. | Yes — "no invisible walls" taken literally, and nobody stranded on the Green. |
| **D44** | **`journeys` for movers are measured from the ride log**, not `length/speed`; the S1 estimate (139 s) is replaced by the headless ride (~83–88 s), inside `targets_s [70,130]`; no retarget. | Yes. |
| **D45** | **The bicycle is a profile** of the same kernel (grip 6/4.8, pedal 2.5 to 6.0, brakes at any speed plus a ≤ 20° skid, no boost, bell), not a second sim; pass 4's ice skates likewise. | Yes — the brief already says "reuses M1's sim"; this makes it true. |
| **D46** | **The partner on a board**: publishing `act: 'skate'` from the Horizon and carrying the slide angle (`p` as β) are one presence-wire change → Codex trust review, a pass-3 request. | Yes, as a pass-3 request; not in pass 2 (brief rule 11). |

Still to settle by play (not decisions, tunings — §8.2's knobs, with the five situations as the ruler): **grip 8 vs 11** (8 is a longboard's honest cornering — a 17 m radius at 11 m/s; 11 leans arcade and lets S1's bends be carved faster; the one knob most likely to move), the kick size (2.2 rad/s may be arcade-big on a Mac and right on a phone), the S hold at 40° (35° if beginners feel it too sharp), the steer cap 0.9 G (0.8 if beginners still skitter), `bite` 5 vs 3 (butter vs snap), `boostPeak` 2.5 vs 3.0 (the ride-1-vs-ride-3 comparison decides), and whether the bicycle's S should tail out at all.

---

## 15 · Little things (kept small, none of them reads money)

Every one of these tells the rider what the physics just did; none is a mechanic.
- The wheel screech goes bright the moment the charge is full — you learn the timing by ear before you ever look at the arc.
- The dust behind a slide (2b card) is the surface's colour: ochre on the Flats, grey on the apron, none on the boardwalk (a wet hiss instead).
- A slide leaves its two scrub marks on the ground for you to look back at (a ground-paint card, your own device only, gone in 30 s; off under reduced motion).
- The heron lifts when a board passes the Reach segment (already in `STYLE §1.9`).
- When the wheels dig in off the bed the pace bubble reads "off the line" with the smallest shrug of an icon, and the fade brings you back.
- Wet trousers after a water fade, 20 s, shared with the wings.
- Cobbles chatter the camera not at all — but they chatter the *bubble* by a pixel.
