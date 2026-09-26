# The Horizon — FLIGHT: the glider and the parachute

Version 1.0 · 26 September 2026 · Jonathan: "design the glider/parachute mechanics." · Grounded in `main@0f601b5` (#548: Pass 1 land, MANIFEST v1.6, scale 1.0 confirmed as D13) and `passes/02-movers.md` track **M6**.

This file decides how the two wings fly so that one M6 subagent can build them without asking. It is the M6 section of `02-movers.md` fleshed out; where the two disagree, this file wins until Jonathan changes it. Nothing here touches geography (`horizon-geo-1` stays), money, the presence wire or the Worker. Every number is in concept metres = engine units at scale 1.0; speeds in m/s.

Companion to `SCALES.md` (the sky is the "Sky" camera tier made physical), `TIME.md` (nothing in the sky reads time except the sun), `LIGHT.md` (thermals follow the real clock; night flying).

---

## 0 · What is already true (facts on main)

- `src/harbour/horizon/world/sky.ts` → `buildFlightEnvelope(field, cuts)` builds the `FlightEnvelope` from `MANIFEST.sky`: three launch pads (`threshold.crownLaunch` h 160, `threshold.prowPlatform` h 100, `threshold.lampGallery` h 25), `FlightVolume`s (two thermals with `hours`, one hard-coded ridge box on the Crown's south face `centre [1310,180,670] halfSize [200,100,45]`, two sinks, landings `green` r 60 / `reachMeadow` r 40 / `sands` r 60 / `strip` / `water.harbour` / `water.bight` / `water.deep` r 20 glider-only), twelve gates with `aperture` and `yaw`, `glider {speed 11, sink 1.2}`, and a glide proof Crown → Lamp needing 10 eu clearance.
- Thresholds for this mover exist in `WorldDefinition.thresholds`: `crownLaunch` (feet→glider, "run off"), `prowPlatform` (feet→zip, feet→glider, "clip in / run off"), `lampGallery` (feet→glider, "run off the gallery"), `deepJetty` (glider→feet, boat→feet, "flare onto the water, swim to the jetty (fade)").
- `underground.doors.throat`: mouth `[1300,300]` h 110, aperture 26 × 18, "139 m of sloping throat at 30° down to the Deep at h 40" — a straight chute running due south from the north face to the Deep's centre `[1300,420]` (139 · cos 30° = 120 m of run, 139 · sin 30° = 70 m of drop: 110 → 40 ✓).
- `runtime/geography.ts` gives a mover `surface(x,z)` (height, normal, material, slope°), `submerged`, `blocked`, `cameraBlocked`; `world/districts.ts` gives `districtAt`; `world/pathGraph.ts` gives `nearestPathNode` (the "nearest apron / shore" of every fade); `sun/solar.ts` gives `localMinutes` (the thermal clock).
- **Not on main yet:** `movers/shared/**` (mode, threshold offer, `wind.ts`, registry — integrator commit 1), any parachute data in the manifest, any wind. Reduced motion is read once at mount by `HorizonStage`; the Horizon runtime has no attach/ride hook. These are integrator asks, listed in §9.
- **Presence wire** (`src/ledgerSync/worldPresenceWire.ts`) carries `x, z, yaw, y, moving, act` with no flight act. Showing the partner's wing is a wire change (§8).

Two arithmetic facts that shape the design (all at 11 m/s trim, 1.2 m/s sink = 9.2 : 1, still air):

| Flight | Distance | Height needed | Height in hand | Verdict |
|---|---|---|---|---|
| Crown 160 → Lamp gallery 25 | 1 078 m | 118 m | 135 m (17 m spare) | reachable; the straight line clears the Bight sink by 69 m, a lazy line drifts into it; **98 s** against `journeys.targets_s` 50–90 → **D34** |
| Prow 100 → Long Sands 2 | 976 m | 106 m | 98 m | **not reachable in still air**; reachable after the Prow thermal (hours 8–18), else land at the Reach meadow (668 m, 73 m needed, 25 m spare) |
| Crown → spillway arch (gate 4, h 45) → under the High Span (gate 3, h 16) → Reach meadow | 514 + 197 + 95 m | 56 + 21 + 10 m | arrives 59 m above the arch → you must **dive** to make the gate; then 8 m to flare at the meadow | the Dam Run works as drawn |
| Lamp gallery 25 → under the Bight Bridge (gate 5, h 6) → the sandbar | 117 m + ~80 m | 13 m + 9 m | you must dive under the deck | the Lamp Hop works, ~25 s |
| Crown → gate 10 (north face, h 130) → out to sea → back into the Throat (gate 12, h 110, floor 101) | ~510 m of track incl. a 25 m-radius turn | ~58 m | **~1 m** | the Throat is *earned*: work the south-face ridge to ≥ 190 m first (≥ 35 m spare), or fly it perfectly |

---

## 1 · The two wings

**The glider is a hang glider.** A rigid triangular wing, span 10 m, keel 3.2 m; the rider prone underneath holding the base bar. It reads at any distance, banks visibly, carries the "bar" control metaphor, and its sail snaps taut on launch — that snap is the mode's one on-purpose sound. (A soft paraglider was the alternative; it turns tighter but reads as a blob from the Look camera. Jonathan may veto: **D35**.)

**The parachute is a square ram-air canopy**, 7 × 3 m, lines 5 m, rider upright under it. Reached only by jumping out of the plane. It is not a second glider: it goes down, it steers, it lands on a target.

`VehicleArt` (pass 2b) fixes the dimensions above and these anchors: glider `seat` (the hang point, prone), `cameraMount` (keel, 1.2 m aft of the hang point), `runningLights[0]` (white, keel tail), `contact` (the base bar tips and the rider's feet); parachute `seat` (harness), `cameraMount` (behind the harness), `runningLights[0]` (white, on the harness), `contact` (feet). Greybox proxies until then: a flat triangle and a flat rectangle on lines.

Each launch pad keeps a **rack** of wings (kit piece; three at the Crown, two at the Prow, two at the Lamp gallery). The wing you take is missing from the rack until you land; then it is back. No silent respawn, no wing left lying in a meadow: on landing the wing folds to a bundle over 2 s and is gone; the canopy collapses, is gathered into a bag on the rider's back over three steps, and is gone.

---

## 2 · The glider

### 2.1 Launch — "run off"
At `crownLaunch`, `prowPlatform` or `lampGallery` the threshold offer reads **Run off** (and **Clip in** beside it on the Prow deck for the zip). Accepting it puts the wing on the rider (0.6 s), faces the rider along the pad's `edge`, and hands input to the mover. The rider then *runs*: forward input (W / the Move pad pushed forward) for three steps down the graded pad; at the lip the wing lifts, the legs trail, the sail snaps — `phase: 'run' → 'flight'` at airspeed 9 m/s. Letting go before the lip stops at the lip (it is a visible lip, CONTRACT §2.4). Under reduced motion see §6.

### 2.2 The flight model — a polar, not a physics engine
The wing flies in the air mass; the ground track is air velocity + wind. State: position, `heading`, `bank`, `airspeed`, `vs` (vertical speed, up positive), `phase`. Integrated at the runtime's fixed step, deterministic, headless-testable (`stepWing(state, input, env, dt)`).

**The bar sets airspeed; the polar sets sink.**

| Bar | Input | Airspeed | Sink (still air) | Glide | Feel |
|---|---|---|---|---|---|
| pushed out full | S held / pad back | 8 | 1.3 | 6.2 : 1 | mushy, nose high — the flare, only useful near the ground |
| pushed out a little | — | 9 | 1.05 | 8.6 : 1 | **min sink** — the speed to circle in a thermal |
| **trim** | no input | **11** | **1.2** | **9.2 : 1** | best glide — the number the manifest promises |
| pulled in half | W half / pad forward half | 14 | 1.8 | 7.8 : 1 | fast cruise; used to cross sink |
| pulled in full | W held / pad forward full | 17 | 3.0 | 5.7 : 1 | the dive; makes gates under bridges, the Throat |

Between rows the polar is a smooth curve (piecewise cubic through the five points). Airspeed moves toward the bar's target at 2 m/s² (pull) / 1.5 m/s² (push). Below 7.5 m/s the wing **stalls**: the nose drops, airspeed recovers to 9 over 1.5 s, 6 m of height is lost, the bar is ignored during recovery; never a spin, never a tumble. Above 17 m/s (a 30° dive) the bar stops pulling; nothing breaks.

**Turning.** Bank input (A/D, pad left/right) moves bank toward ±50° at 60°/s and back to level at 90°/s when released; the wing rolls visibly, the rider's body shifts across the bar. Turn rate ω = 4.9 · tan(bank) / airspeed (rad/s): at 45° and 11 m/s that is 0.45 rad/s = 25°/s, a 25 m radius. Turns cost height: sink × 1/cos(bank) (× 1.41 at 45°). No rudder, no slip: turns are always coordinated. Sketch of consequences: the Throat's 26 m mouth is a straight-in approach; a 180° at 45° bank costs ~11 m; a lazy 20° bank turns at 9°/s on a 70 m radius and costs almost nothing.

**Lift and sink** (from `FlightEnvelope.volumes`, sampled at the rider):
- **Thermal** (`thermal.1` the Flats' ochre `[380,600]` r 150, hours 12–18; `thermal.2` the Prow face `[1610,850]` r 120, hours 8–18): +2.5 m/s at the core, cosine falloff to 0 at the rim, only while `solar.localMinutes/60` is inside `hours` (the *real* clock; frozen at 15:30 under reduced motion or calm, so both thermals are "on" in the frozen afternoon). Net climb at min sink ≈ +1.45 m/s: 100 m in 70 s of circling.
- **Ridge** (`ridge.crownSouth`, the box on the south face, h 80–280): +2.0 m/s while the wind is from the south (`wind.dir` within 45° of south) and the wing's heading has a component *along or into* the face (|heading − east/west| ≤ 60°, i.e. beating along the ridge, not flying away from it); full strength below h 220, fading to 0 at h 280. Ridge lift is worked by beating back and forth along the face; that is the intended way to bank height for the Throat.
- **Sink** (`sink.1` the Bight `[600,760]` r 200, `sink.2` the Notch `[1210,1010]` r 90): −1.0 m/s at the core, cosine falloff. Crossing the Bight at trim costs ~36 m extra; at 17 m/s it costs 24 m of sink but 63 m of polar — cross sink *fast*, as real pilots do.
- **Ceiling** 300 m: all lift fades linearly to 0 between h 280 and 300; the wing simply stops climbing. No wall.
- **Wind**: `WindSample {dir, speed}` from `movers/shared/wind.ts` (the constant south wind at 4 m/s until pass 2b's wind clock). Added to the ground track in full. Flying north the wing makes 15 m/s over the ground; flying south, 7. The windsock at the strip shows it.

**No collisions with people**: bodies (the partner, Hercules, walkers) are passed through; a gust card (2b) and a 0.3 s wing-wobble say so. **Structures are real**: the wing collides with terrain, buildings and bridge decks as *landings* (§2.4), never as damage; the gates' apertures are the real undersides.

### 2.3 Controls

| | Desktop | Phone / touch | Gamepad (if `getGamepads` has one) |
|---|---|---|---|
| Bar (speed) | **W** pull in, **S** push out (hold; release = trim) | **Move pad** up = pull in, down = push out | left stick Y |
| Bank | **A / D** | **Move pad** left / right | left stick X |
| Look | mouse drag (yaw ±120°, pitch), wheel = distance 6–24 | **Look pad** | right stick |
| Flare | S held in the last 8 m (same input, no extra button) | Move pad held down | left stick back |
| Money / tools | the quick layer, unchanged | the quick layer, unchanged | — |

The Horizon runtime's two 94 px pads (`.horizon-touch-controls`) are reused: in the air the Move pad *is the bar*. Jump and Enter are hidden in flight; a **Fold** bubble (land now: fade to the nearest landing, labelled, §2.4) takes Jump's place so nobody is stuck in the sky. No auto-level, no assist: the wing holds its bank and its bar until you change them; trim is the only default. Pointer/touch look never steers.

### 2.4 Landing — the flare, and every other way down
The wing is in `phase: 'flare'` whenever height above ground (terrain or water under the rider) is < 8 m. Pushing out there bleeds airspeed to 8 and sink to 0.3 over 2 s. Touchdown is the first frame the contact anchor meets a surface. The outcome is decided by *where* and *how*, never by damage:

| Where you touch | How | What happens |
|---|---|---|
| A **landing field** (`green`, `reachMeadow`, `sands`, `strip`) or any **walkable** surface (slope ≤ `HORIZON_WALKABLE_DEGREES` 40°, not a bed with `threshold` pace, not inside a host footprint) | airspeed ≤ 9 and sink ≤ 1.5 (a flared landing) | **walk-off**: feet down, two running steps, the wing folds; `glider → feet` on the spot; the wing's shadow crosses the ground first (a card) |
| same | faster or steeper | **the tumble**: a 0.8 s roll along the ground, the rider stands, dusts off (an emote), the wing folds; `glider → feet`. No damage, no message, no retry |
| **Water** other than the Deep | any | 300 ms fade to the nearest shore path node (`nearestPathNode`), on foot, wet for 20 s (a darker card on the trousers, a little thing). The harbour and the Bight are *plane* landings, not glider ones |
| **The Deep** (via the Throat only, §2.5) | flared | small splash, three echoes; `deepJetty`: fade to the jetty |
| **The Deep** | not flared | big splash, three louder echoes; same fade |
| A **neighbourhood** (any `districts` row whose kind is a neighbourhood, roofs, the square, quays, walks) | any | 300 ms fade to that neighbourhood's nearest **apron** (the threshold or path node nearest the touch point that is not inside a footprint); the wing folds there. "Fade" is the CONTRACT's word for the only permitted teleport: short, labelled by the place name in the HUD bubble ("→ the square") |
| **Unwalkable ground** (slope > 40°, the Crown's faces, cliffs) | any | the tumble down to the first walkable surface if it is within 6 m, else the 300 ms fade to the nearest path node |
| **Sea** beyond the island (the world boundary) | any | fade to the nearest shore node — the same rule as any water |
| Inside the **Throat** corridor walls / a **gate's** structure | any | not a collision: the corridor keeps the wing inside its aperture (§2.5); gates are passed through their aperture or flown around, and a wing meeting a bridge deck from above lands on it (a walkable surface if the deck is a bed; else the neighbourhood rule) |

There is **no crash state** anywhere in the mover: no health, no damage, no "try again". The worst outcome is a fade with a place name.

**The Fold bubble** (screen-space, in the quick layer's row): "Land · the Green 410 m" — the nearest landing field by straight line that is reachable at trim from here (height in hand ≥ needed + 10 m); tapping it is *not* an autopilot — it flies nothing — it is the labelled fade of rule 1 for the person who wants down now. Under reduced motion it is the only way down (§6).

### 2.5 The Throat — the dive into the mountain
Gate 12 `[1300,300]` h 110, aperture 26 wide × 18 tall, faces north; the chute descends at 30° for 139 m to the Deep's water at h 40; glider only (`modes: ['glider']`; the plane and the parachute never reach it — the plane's HUD already says "Too narrow for the plane: gliders only"; the parachute cannot be steered to 110 m over the north sea from any legal bail, and the corridor refuses it anyway).

- **Approach**: from the north, over the sea, heading within ±25° of south, inside the aperture. Entering the aperture with a heading outside that cone or a bank over 20° is a *miss*: the wing passes beside the mouth over the north face (the face is unwalkable → the tumble/fade rule), nothing else.
- **The corridor** (`phase: 'corridor'`): from the mouth to 25 m short of the water the wing follows the chute's axis; the rider keeps **bank** (±8 m of lateral freedom inside the 26 m mouth, narrowing to ±5 m as the chute narrows — kit walls) and **bar** (speed: 11 → 17 as the dive builds; pushing out holds 13). Pitch is the chute's own 30°. This is Mountain v2's corridor gravity, re-used on purpose: the sky's rule "you cannot fly a 30° tunnel at a 9 : 1 glide" is solved by the corridor, not by ignoring it. Glow-worms light the walls; the daylight behind shrinks to a coin.
- **The last 25 m** are authored as a level run over the water at h 42 → the splash. Pushing out here is the flare (small splash); not pushing out is the big splash. Either way the rider is on the water at `[1300,420±10]` and the `deepJetty` fade takes over: "flare onto the water, swim to the jetty (fade)". The splash echoes three times up the throat (audio, §5), and Sketchbook page G is captured on this frame (the reviewer's harness flies it; nothing ambient is faked).
- **Reduced motion**: the Throat is one of the landings offered at the Crown launch ("the Deep, through the Throat") and is a cut to the jetty.

### 2.6 The courses (data for pass 4; the mover only provides the gates' pass-through events)
- **Dam Run** (Crown → gate 4 spillway arch → gate 3 under the High Span → Reach meadow): 59 m to burn before the arch → pull in full from the Shoulder; under the High Span at h 16 inside 40 × 14; 95 m to the meadow with ~8 m to flare. ~75 s.
- **Throat Run** (Crown → gate 10 → the turn → gate 12 → the Deep): see §0's last row; the tactic is *ridge first*.
- **Lamp Hop** (Lamp gallery → under the Bight Bridge → the sandbar): 25 s; the only course without a dive-before-gate is *this* one's dive under the deck. The Bight water is a fade to the sandbar.
- **Ring Run** is the plane's; a glider through gate 1 or 2 (the Needle's Eye, the Stacks) is just a lantern-hunter's route.

Gate pass-through is a pure geometric test on the rider's path against `aperture` and `yaw` (`sky.ts` already stores both); the mover emits `gate(n)` events, keeps no score, reads no money.

---

## 3 · The parachute

### 3.1 Bail-out — "jump"
The parachute's only threshold is **the plane's door**, and it moves. The registry gets one *carried* threshold (`bailOut`, `plane → parachute`, action **Jump**, `at` = the plane's current xy, `height` = its altitude), the same idea as the Ferry's gangway being a pier that moves. The offer shows in the plane's HUD only when height above the ground under the plane is **≥ 60 m** (below that: no offer, the bubble reads "Too low to jump"); never inside the Throat (the plane is never there). The action is a **hold** of 0.5 s (so a stray tap over the sea does nothing). Accepting: the rider is out of the cockpit, the plane flies on.

**The plane knows the way home** (**D36**): after a bail-out the plane's one-button autopilot flies it back to where it took off — the strip on wheels, the floatplane dock on floats — lands, and is there for the next flight. No silent teleport of a vehicle, no plane lost at sea, and a lovely thing to watch from under the canopy.

### 3.2 Freefall
`phase: 'freefall'`: vertical speed builds at the runtime's g (12 m/s²) to a **cap of 30 m/s** (reached in ~2.5 s; real terminal is faster but unreadable); horizontal velocity starts as the plane's (35 m/s at most) and decays with a 0.5 s time constant; **lean** (A/D, W/S, the Move pad) adds up to 8 m/s of steer in any direction; wind acts at half strength. The rider's pose: arms out, cloth ripple (a card).

**Pull** — Space / the **Pull** bubble (screen-space, replaces Fold). Minimum canopy height is enforced by an **auto-pull at 45 m AGL** (**D37**): the chute always opens; a late pull is a louder snap and a short ride, never a crash. Bailing at 300 m gives ~8 s of freefall to the auto-pull; at 150 m, ~4 s.

### 3.3 The canopy
Opening takes 1.2 s: vertical speed goes 30 → 3 on a square-root curve, the canopy snaps (the on-purpose sound; the same family as the glider's), the camera lifts (§4).

| Toggles | Input | Forward | Sink | Note |
|---|---|---|---|---|
| up (hands up) | none | 6 | 3.0 | full drive |
| half brakes | S half / pad back half | 4 | 2.2 | |
| full brakes | S held / pad back | 2 | 1.5 | ≤ 3 s, then the canopy mushes (sink 4.0) and the brakes release themselves for 1 s |
| flare | brakes ≥ half through the last 5 m | half: 4 · full: 2 → 0 | half: 2.2 · full: 1.5 → 0.5 | the stand-up landing if the ground speed is ≤ 3 m/s (§3.4); no 3 s limit inside the last 5 m |

Turn: A/D (pad left/right) yaw at up to 40°/s (radius ~9 m at full drive; canopies turn tight); a turn adds 0.5 m/s of sink. Wind adds to the ground track in full: into the 4 m/s south wind the canopy makes 2 m/s over the ground; running with it, 10. **The Drop Zone is a wind problem**: set up downwind of the Green's target, face south, drive in. The windsock and the drifting dandelion clocks say which way. **The stand-up is a wind problem too** (ruled 26 Sep): at half brakes the canopy's 4 m/s forward cancels the 4 m/s south wind exactly, so a half-brake flare facing south touches down at 0 m/s over the ground; a full-brake flare into the same wind bleeds forward to 0 and lands at the wind's 4 m/s (a tumble), and any flare downwind lands at 6–8 m/s (a tumble). On a keyboard S is all-or-nothing (full brakes); half brakes are the Move pad pulled half back (open issue: a desktop half-brake key, `delivery/HANDOFF.md`).

No thermals or ridge lift for the canopy (it is going down); sink fields do apply (−1.0 in the Bight/Notch). Ceiling irrelevant.

### 3.4 Landing
The parachute lands wherever a glider may, by the same outcome table (§2.4) with these substitutions: "flared" = brakes **≥ 0.5 on every step of the last 5 m** *and* **|ground speed| ≤ 3 m/s** at touchdown → **stand-up** (ruled 26 Sep: into the 4 m/s south wind at half brakes the ground speed is 0 → stand-up; downwind → tumble; `test/horizonChute.test.ts` flies both) (feet down, two steps, the canopy collapses behind); otherwise the **tumble** (a roll, up, dust off). The **Drop Zone target** is ground paint inside the Green's protected centre at `sky.landings.green.xy [1040,1065]` with rings at **5 / 10 / 25 m** (bullseye, inner, outer) and "on the Green" beyond; the mover emits `touchdown{xy, groundSpeed, flared, ringIndex}`; pass 4 keeps the paper-ghost times and the dandelion-seed puff. The wing/canopy never lands on the target's paint as a prop: it is gathered (§1).

Reload mid-jump: the integrator's rule — restored on foot at the nearest threshold of the mode, which for the parachute is the plane's own threshold (the strip or the dock).

---

## 4 · Camera

Both wings use one **flight cam** in `movers/glider/camera.ts` built on `camera/obstruction.ts` (`clearFraction`, `createPullIn`) and the Horizon runtime's transition blend; it is *not* `camera/flight.ts` (that is the Look camera's between-places flight and stays as it is).

| | Glider | Corridor (Throat) | Freefall | Canopy |
|---|---|---|---|---|
| Behind / above the rider (eu) | 14 / 4.5 | 8 / 2.5, locked to the chute's axis | 6 back, 6 above, pitched 35° down the fall line | 9 / 3, pitched 20° down (the target stays in view) |
| Look point | 22 ahead along the velocity vector | the coin of daylight, then the water | the ground under the rider | 12 ahead and down |
| **Roll** | **0 — horizon-locked.** The wing banks under a level camera; the camera *leans* ≤ 8° into a turn at full tier, 0 under reduced motion | 0 | 0 | 0 |
| Yaw | follows heading through a critically damped spring, 0.35 s; lags ≤ 12° in a turn | axis | heading | heading |
| Pitch | 0.5 × the velocity vector's pitch | 30° (the chute) | fixed | fixed |
| FOV | 55° + up to 8° at 17 m/s (full tier only; lite and reduced motion: 55° fixed) | 55° | 62° | 55° |
| Ground | pull-in by `clearFraction`; never below terrain, never inside a host; 2 m minimum above any surface | inside the chute's clear volume | as glider | as glider |
| Free look | mouse/Look pad orbits ±120° yaw, −30…+45° pitch, springs back 1.5 s after release | none | none | ±90° |

**Handoffs** (the integrator's ≤ 30 eu rule, `test/horizonCameraHandoff.test.ts`): at *run off* the walk cam (9 behind, pitch −0.26) blends to the flight cam over 0.8 s starting on the first running step — both are behind the rider, ~6 eu apart; at *touchdown* the flight cam blends back to the walk cam over 0.6 s; at the *Throat mouth* the flight cam pulls in to the corridor pose over 1.0 s along the axis (never a swing); at *bail-out* the plane's chase cam (M7) hands to the freefall cam by a 0.3 s blend (both behind the same point); at *the pull* the freefall cam rises to the canopy pose over the 1.2 s opening. Every fade in §2.4 is a cut to the walk cam at the destination. Under reduced motion every blend is a cut.

---

## 5 · Sound and light

- **On purpose (one per mode)**: the **canopy snap** — the sail on launch for the glider; the pull for the parachute. Through `audio.ts` (integrator adds `snap()` beside `bell()`; same 0.7 s rate limit, silent when muted/hidden/calm).
- **Ambient, allowed** (`WorldAmbience.update` already takes speed): wind rush scaled by airspeed (quiet at 9, a roar at 17 and in freefall); the **vario** — a soft chirp every 0.6 s while net lift ≥ +0.5 m/s, pitch rising with lift; *silence* in sink is the tell; off under calm view. The Deep's **three echoes** after the splash (1.1 s apart, each softer), the Deep only. The harbour bell answering the summit bell is unchanged; a wing passing gate 6 round the Lamp does not ring anything (bells are yours to ring).
- **Night** (`LIGHT §3`): the glider's white tail light; the canopy's harness lamp; both light cards, dusk → dawn, counted against the 48-card lite cap. The island reads by its own lights — the Lamp's beam every 8 s, the strip's two lamp rows (the lit night landing), Lantern Row, the gondola cabins. The Reach meadow and the Sands are dark but still landings; nothing is pitch dark (`LIGHT §1`). No dynamic point light anywhere in the mover.
- **Thermal tells** (2b kit, no logic here): two hawks circling inside a thermal during its hours (the flock already exists; stilled under reduced motion), dust devils on the Flats' ochre at 15:00 in Classic, the windsock, dandelion clocks drifting north.

---

## 6 · Reduced motion, calm view, lite

- **Reduced motion** (`prefers-reduced-motion` or `data-motion="reduced"`, and `HorizonStage` must start reading it live, §9): the launch offer becomes a **sheet**: the landings reachable from this pad (Crown: the Green, the Reach meadow, Long Sands, the strip, "the Deep, through the Throat"; Prow: the Reach meadow, Long Sands (afternoon), the Green; Lamp gallery: the sandbar, the Flats' strip) and the **twelve Sketchbook pages** (`sky.rules`: "cuts between the twelve pages"). Choosing one is a 300 ms fade to that landing on foot, or to that page's pose in Look. The bail-out offers the same sheet (landings only). There is no flight under reduced motion; no FOV change, no lean, no blend.
- **Calm view** (`comfort.quiet` / the mountain calm flag): the sky is still and silent; the racks are full; launching behaves as under reduced motion; the sun is frozen at 15:30 (so the thermals are "on" if anything ever asks).
- **Lite tier**: the same simulation and the same numbers (a phone flies the same island); FOV fixed, camera lean off, gust and dust cards off, the wing's ground shadow off; the tail-light card kept.
- **The Reading edition (the Desk)**: nothing in the sky has a fact behind it; the Desk needs no flight page. The Sketchbook's twelve pages remain the flat way to *see* the sky.

---

## 7 · The HUD — two glass bubbles, and the quick layer

Screen-space DOM only (CONTRACT: no world text), in the glass/bubble style Jonathan set for the map's tools, descriptive icons, 44 px targets, `env(safe-area-inset-bottom)`:

1. **Height** bubble (bottom-left, above the quick layer): "62 m" above the ground under you, with a small ↑ / ↓ glyph for net lift/sink ≥ 0.5 m/s. That is the whole instrument panel; the vario is the sound.
2. **Place** bubble (bottom-right): the nearest reachable landing and its distance ("the Green · 410 m"), which is also the **Fold** control (§2.4); in freefall it is **Pull**; in a course it names the next gate ("gate 4 · the spillway arch · 120 m"). One bubble, three jobs, never two at once.

The **quick layer** (the Desk's quick-travel bar: All tools, journey map, the village-map crosshair, quick travel, the simple-view flip, the money "+") stays exactly where it is in every phase, including the corridor and freefall (`test/horizonQuickLayerModes.test.ts`). Money is one tap away at 300 m. **Nothing in the sky reads a balance**: no bubble, no gate, no landing, no course ever shows or changes a financial number (`test/horizonPastimesNoMoney.test.ts` static import fence extends to `movers/glider/**`).

---

## 8 · The partner

Today the wire carries no flight act, so the partner's ghost on the ground keeps walking while you fly; their `y` is already sent, so the dot on the guide map rises. To show the **partner's wing** — a paper cut-out glider in the Taylor dressing, a real card in Classic — and to let them **hear your snap**, the wire needs `act: 'glide' | 'chute'` and `p` as bank, and one sound event. That is a change to `worldPresenceWire.ts` / `workers/ledgerRoom.ts` and therefore a **request for a Codex trust review**, written in `HANDOFF-notes/glider.md`, not built in pass 2 (brief rule 11). Until then: no fake life — the ghost is where the wire says, on the ground.

---

## 9 · Interfaces and integrator asks

**Files M6 owns** — `src/harbour/horizon/movers/glider/`:
- `polar.ts` — `GLIDER_POLAR` (the five points), `sinkAt(airspeed)`, `CHUTE_POLAR`.
- `lift.ts` — `liftAt(envelope, wind, x, y, z, localHour): number` over `FlightVolume`s (thermal/ridge/sink/ceiling fade), pure.
- `wing.ts` — `WingState`, `WingInput {bar: -1…1, bank: -1…1}`, `stepWing(state, input, env, dt)`; phases `'run' | 'flight' | 'corridor' | 'flare' | 'touchdown' | 'fade'`.
- `chute.ts` — `ChuteState`, phases `'freefall' | 'opening' | 'canopy' | 'flare' | 'touchdown' | 'fade'`, `stepChute(...)`.
- `landing.ts` — `resolveTouchdown(geography, districts, pathGraph, envelope, contact, velocity): LandingOutcome` (the §2.4 table as data), `nearestReachableLanding(...)` for the Fold bubble.
- `corridor.ts` — the Throat: `enterCorridor(gate12, state)` (the ±25° / ≤ 20° bank cone), `stepCorridor(...)`, the 25 m level run and the splash.
- `camera.ts` — the flight cam (§4) on `obstruction.ts`.
- `controller.ts` — implements `ModeController` for `'glider'` and `'parachute'` (`enter(threshold)`, `update(dt, input)`, `exit(threshold)`, `camera()`, `sound()`, `reducedMotionCut()`), reads the Horizon runtime's `input`/`look` and the two pads.
- `hud.tsx` — the two bubbles.
- `art/proxy.ts` — greybox triangle and canopy through `VehicleArt` anchors until pass 2b.

**Integrator asks (commit 1 or the M6 seam):**
1. `movers/shared/{mode,threshold,vehicleArt,wind}.ts` and `registry.ts` as the brief lists; add `'parachute'` to `ModeId` (it is already in the brief's union) and allow a **carried threshold** (`at` supplied by a vehicle each frame) for `bailOut`.
2. A mover hook in `runtime/index.ts`: `attachMover(controller)` that lets a controller own the body's position/pose and camera pose per frame, and `detachMover(at)` that drops the body on foot at a point (the fades); `HorizonWorld.tsx` publishes the body as today (y included).
3. `HorizonStage` reads reduced motion and calm live (`matchMedia` change + `data-motion`, `comfort.quiet`) and passes both to the runtime and to `solarReviewDate`.
4. `audio.ts`: `snap()`, `splashEcho()`, `vario(lift)`; wind rush already scales with `speed`.
5. **MANIFEST v1.7, sky-only** (no `horizon-geo` bump; `make_manifest.py`): `sky.gliderPolar` (the five points), `sky.parachute {forward_ms 6, sink_ms 3, freefallCap_ms 30, autoPull_agl_m 45, minBail_agl_m 60, canopy_m [7,3]}`, `sky.corridors.throat {gate 12, to [1300,420], slope_deg 30, level_m 25, splashH 42}`, `sky.dropZone {xy [1040,1065], rings_m [5,10,25]}`, `modes` on every landing extended with `'parachute'` (`water.deep` stays glider-only), threshold `bailOut {carriedBy 'plane', modes ['plane→parachute'], action 'jump', minAgl_m 60}`, and **D34**'s journey retarget once decided. `world/sky.ts` and `definition.ts` grow the matching optional fields; `test/horizonSkyEnvelope.test.ts` is extended, not rewritten.
6. M7 (plane) exposes `bail(): {xy, h, velocity, home: 'strip' | 'floatDock'}` and accepts `flyHome(home)`; the hand-off is a `ThresholdOffer` like any other.

---

## 10 · Tests (`test/horizonGlider*.test.ts`, headless, against `HORIZON_MANIFEST` and a synthetic or the baked field)

- `horizonGliderPolar`: sink is monotone above 9; trim = 11 / 1.2 (9.17 : 1); stall below 7.5 recovers to 9 in ≤ 1.5 s losing ≤ 6 m; airspeed never exceeds 17.
- `horizonGliderLift`: thermals give +2.5 at the core only inside `hours` by `localMinutes`; ridge only with a south wind and a heading along/into the face; sinks −1.0; every volume fades to 0 by h 300; wind adds to the ground track in full.
- `horizonGliderJourneys` (still air, scripted inputs): Crown → Lamp arrives with ≥ 10 m in hand and the line clears the Bight sink; Prow → Long Sands **fails** in still air and **succeeds** at 14:00 after ≤ 60 s in the Prow thermal; Prow → Reach meadow succeeds at any hour; Dam Run passes gates 4 and 3 inside their apertures and lands on the meadow; Lamp Hop passes gate 5 and fades to the sandbar; Throat Run from the Crown with a 25 m-radius turn arrives inside the mouth's aperture (≥ 0 m in hand) and, after ridge to 190 m, with ≥ 35 m; Crown → Lamp time reported against `journeys.targets_s` (red until D34).
- `horizonGliderLanding`: every row of §2.4 with a synthetic field (walkable, 45° slope, water, a host footprint, a neighbourhood district, the boundary); no outcome is a crash; every fade lands on a path node; the Fold bubble only offers reachable fields.
- `horizonThroat`: glider admitted inside the cone, refused outside it (a miss, not a wall); parachute and plane refused; the wing stays inside the aperture along the whole chute; the level run ends on the water at `[1300,420±10]`; three echoes; `deepJetty` fade.
- `horizonChute`: bail refused < 60 m AGL; auto-pull at 45 m; opening 1.2 s to sink 3; brakes ≤ 3 s then mush; wind drift; ring index from `touchdown`; the plane returns to its `home` threshold after a bail.
- `horizonGliderCamera`: camera roll is 0 in every phase; lean ≤ 8° at full tier and 0 reduced; never below terrain or inside a host along a recorded flight; every handoff ≤ 30 eu; the corridor pose stays inside the chute's clear volume.
- `horizonGliderReducedMotion`: the launch offer lists the pad's landings and the twelve pages; the flight is a 300 ms cut; no FOV change; calm view identical.
- `horizonGliderBodies`: a body on the flight line is passed through; a gust event fires once per body.
- The registry tests from the brief cover: one active mode, threshold-only transitions (including the carried `bailOut`), the quick layer in `'glider'` and `'parachute'`, and the money import fence.

---

## 11 · Acceptance rides and evidence (Jonathan on the Mac and the iPhone; Bianca when willing)

1. **Crown → the Lamp** at trim, then again crossing the Bight fast — feel the sink.
2. **Crown → the ridge → the Throat → the Deep**, flared; and once unflared for the big splash.
3. **The Prow → the Prow thermal → Long Sands** at 15:00; the same launch at 07:00 to the Reach meadow.
4. **Lamp Hop** under the Bight Bridge to the sandbar.
5. **Bail out over the Green** from 200 m in the south wind; land in the 5 m ring once, and once tumble.
6. **A night flight** Crown → the strip's lamp rows.
7. **Reduced motion**: the Crown sheet → the Green; the bail sheet → the Sands.
8. **The Fold bubble** from 250 m over the Flats.

Evidence per the brief: harness recording + per-second step log (`position, phase, airspeed, vs, lift, bank`) for each ride in `evidence/rides/glider_*.{mp4,json}`; the twelve pages after the 2b merge with **page E** (the Crown, a wing on the rack) and **page G** (the flare onto the Deep) called out; `evidence/journeys.md` with the measured Crown → Lamp time beside D34; `evidence/rides/reduced_motion.md`.

---

## 12 · Decisions for Jonathan

| # | Decision | Claude's recommendation |
|---|---|---|
| **D34** | `journeys.targets_s["crown→lamp by glider"]` is 50–90 s; at scale 1.0 and 11 m/s the flight takes ~98 s in still air. Retarget to **70–110 s** (the scale note already says "the sky … stays long enough to feel like travel"), or raise trim to 13 m/s with sink 1.4 (same 9.2 : 1, ~83 s, everything above re-scales and the Throat gets ~15 % harder). | **Retarget to 70–110 s.** 11 m/s is a hang glider; 13 starts to feel like the plane's little brother. |
| **D35** | The glider is a hang glider (rigid wing, prone rider), the parachute a square canopy. | As designed; veto if the Grand Plan's sketches meant a paraglider. |
| **D36** | After a bail-out the plane flies itself home to its take-off threshold and lands. | Yes — the alternative is a teleported vehicle. |
| **D37** | The parachute auto-pulls at 45 m AGL (the chute always opens; no crash). | Yes; 45 m gives a 15 s canopy ride from the auto-pull, enough to steer to the outer ring. |
| **D38** | Show the partner's wing and let them hear your snap (a presence-wire change → Codex trust review). | Yes, as a pass-3 request; not in pass 2. |

---

## 13 · Little things (kept small, none of them reads money)

- The wing you took is missing from the rack until you land.
- The wing's shadow crosses the square before you do (page A, golden hour); it crosses the Drop Zone target before the canopy lands.
- Three echoes up the Throat; the third one is barely there.
- Wet trousers for 20 s after a water fade.
- The plane, flying itself home, waggles its wings once as it passes you under the canopy.
- Two hawks in every working thermal; when the thermal switches off at 18:00 they leave.
- The vario's silence in sink — the island teaches you to fly by going quiet.
- On the first flared landing on the Green the dandelion clocks lift (pass 4's puff, but the seeds are the Green's own bloom-month planting; in September they are goldenrod dust).
