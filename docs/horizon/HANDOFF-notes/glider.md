# HANDOFF-notes — M6 glider + parachute

Track M6 (`passes/02-movers.md`, `FLIGHT.md`). Requests this track cannot make itself: **land touch-ups for pass 3**
(`horizon-geo-1` stays in pass 2), **one presence-wire request for a Codex trust review** (D38), and the sim / land
questions left open. Every number below is measured on `horizon-geo-1` by the scripted pilots in
`src/harbour/horizon/movers/glider/journeys.ts` (fixed step 1/60 s), replayed over the baked heightfield
(`public/horizon/terrain/horizon-geo-1.bin`, `sampleTerrain`) — the same replays that stay recorded as `it.fails` at the
bottom of `test/horizonGliderJourneys.test.ts`. "Clearance" is the wing's height above max(terrain, sea level).
Coordinates are engine `[x, z]` (x east, z south), heights in metres.

Written 26 Sep 2026 by the M6 integrator on `claude/horizon-glider-cam` (local branch, not pushed, not merged).

---

## 1 · Land touch-up requests (pass 3, `HANDOFF-notes/land-touchup.md` when that file exists)

Each is a request, not a decision: the design lead may prefer to move a line (a pad, a gate, a landing) instead of
the ground. "Cut to 0" makes the scripted line just touch; "cut to 5" gives the 5 m a player needs to feel safe.

### L1 · The knoll on the Prow → Reach meadow line — `[1450, 872]`
- **What the wing meets:** the straight trim line from the Prow platform `[1610, 640]` h 100 to the Reach meadow
  `[1230, 1190]` is below the terrain from `[1461, 856]` to `[1419, 916]` (73 m of track, 24.0–30.6 s after launch).
  Worst at **`[1450, 872]`: path 69.3, terrain 82.7 → clearance −13.4 m**.
- **Cut needed:** the knoll's top along that line to **≤ 69.3 m (−13.4 m) for 0**, **≤ 64.3 m (−18.4 m) for 5 m**,
  tapering to nothing at `[1461, 856]` and `[1419, 916]` (terrain there 74 → 69 m against a path of 71 → 64 m).
  Alternative without land: the line bends ≥ 60 m west of the knoll (the Prow → meadow flight still arrives with
  ~20 m in hand; the design lead picks).
- **Why it matters:** FLIGHT §0 row 2's fallback ("else land at the Reach meadow, 25 m spare") is the Prow's only
  morning flight; today a straight glide flies into the hill.

### L2 · The Reach meadow is not level — field `reachMeadow` `[1230, 1190]` r 40, h 6.95
- Baked terrain inside r 40 runs **2.9 m** (at `[1270, 1194]`) to **16.5 m** (at `[1211, 1155]`). The scripted
  landing circles meet the ground at `[1211, 1161]` (terrain 16.3, 9.4 m above the field's height) and `[1240, 1173]`
  (terrain 9.2, +2.2).
- **Cut/fill needed:** grade the field to **6.95 ± 1 m inside r 40**: cut up to **9.5 m** in its north-west quadrant
  (around `[1211, 1155]`), fill up to **4 m** on its east edge (around `[1270, 1194]`). Slope ≤ 5° everywhere inside.
- **Why:** the Dam Run and the Prow's morning flight both end here; FLIGHT §2.4 wants a walk-off on a landing field.

### L3 · The Crown's south shoulder under the Dam Run — `[1300, 621]`
- **What the wing meets:** the Dam Run leaves the Crown south-east and dives for the spillway arch (gate 4). Three
  stretches are under the terrain:
  - `[1308, 450] → [1316, 477]` (28 m): worst **−3.2 m** at `[1315, 475]` (path 154.8, terrain 158.0);
  - `[1323, 490] → [1353, 549]` (66 m): worst **−5.4 m** at `[1333, 507]` (path 148.5, terrain 153.8);
  - `[1352, 570] → [1283, 693]` (142 m): worst **−18.9 m at `[1300, 621]`** (path 115.2, terrain 134.2 — the
    shoulder's 134 m knob).
- **Cut needed:** the knob at `[1300, 621]` to **≤ 115 m (−19 m) for 0**, **≤ 110 m (−24 m) for 5 m**, tapering over
  the 142 m stretch; the pad-side shoulder (z 450–549, x 1308–1353) down **3–5 m (0)** or **8–10 m (5 m)** — this is
  the same ground as L4.
- **Alternative:** the Dam Run's first leg flies round the knob to the west of x 1270 (a course-data change in
  pass 4, no land).

### L4 · The Crown's south lip and the ridge approach — `[1310, 535]`
- **What the wing meets:** a south-facing launch from the Crown pad (edge `[[1307,160,440],[1313,160,440]]`) glides at
  9.2 : 1 (2.2 m per 20 m) but the shoulder falls only **~1.4 m in the first 20 m** (159.9 → 158.6 at z 460). The
  line to the ridge box is under the terrain for **180 m, `[1310, 446]` → `[1310, 626]`**, worst **−5.5 m at
  `[1310, 535]`** (path 143.6, terrain 149.2).
- **Cut needed:** a graded south lip and run-out along x 1300–1320: **−5.5 m at z 531–538 for 0**, **−10.5 m for
  5 m**, tapering to 0 at z 446 and z 626; the first 20 m past the pad edge should fall **≥ 10 m** (the controller's
  `RUN_DROP`) if the Crown is meant to launch south at all.
- **Today (FLIGHT §2.1, current behaviour):** the controller (sim `wing.ts launchFromPad`) finds the south side does
  not drop and **always runs off north** (the north face falls 14.5 m in 20 m). The ridge and the Dam Run then start
  with a 180° turn over the north face. Nothing is broken; the Crown just has one real lip.

### L5 · The Throat's approach and its mouth — gate 12 `[1300, 300]`, aperture 26 × 18 (floor 101, top 119)
- **What the wing meets:** the north face in front of the mouth. Across the aperture's width (x 1287–1313) the
  heightfield is ~55 m at z 250–270, then climbs **98–101 m at z 275, 111–119 at z 280, 126 at z 285, 129 at z 288 and
  131 m from z 291** (the mouth mask) to the mouth plane at z 300. The Throat Run is under the terrain from
  `[1305, 275]` to `[1300, 300]` (26 m), worst **−35.3 m at `[1300, 300]`** (path 95.8, terrain 131.0).
- **The mask floor:** the mouth mask (`underground.doors.throat`, cut into the heightfield from z 291) opens at
  **floor h 110**, while the gate's aperture — the numbers the corridor admits by — has its **floor at h 101**.
  The lower 9 m of the aperture is terrain.
- **Cut needed:** a notch **26 m wide (x 1287–1313), z 270 → 300, down to h ≤ 100** (1 m under the aperture floor):
  cut **0–1 m at z 275, 11–19 m at z 280, ~26 m at z 285, ~29 m at z 288, 31 m from z 291 to z 300**; and lower the
  mouth mask's floor from **110 to ≤ 101** so the mask and the gate agree. (Or raise gate 12 to floor 110 / centre
  119 — a sky change that makes the Throat ~9 m harder; the design lead's call.)
- **Why:** with the ruling "the Throat is earned" the wing arrives 5 m under the floor from the Crown (a miss) and
  +2.6 m after the ridge (in). Both numbers assume the air in front of the mouth is open; on the baked land it is rock.
  In the browser today the controller admits the wing at the gate plane (it tries `enterCorridor` within 40 m of the
  mouth), but a wing lower than ~131 m meets the north face at z ≈ 280 before it gets there.

### Summary table

| # | Where | Worst clearance | Cut for 0 | Cut for 5 m | Or instead |
|---|---|---|---|---|---|
| L1 | knoll `[1450, 872]` on Prow → meadow | −13.4 m | 13.4 m | 18.4 m | bend the line west |
| L2 | Reach meadow r 40 around `[1230, 1190]` | field 2.9–16.5 vs 6.95 | cut 9.5 NW / fill 4 E | same | move the field |
| L3 | Crown south shoulder `[1300, 621]` | −18.9 m | 19 m | 24 m | route the Dam Run west |
| L4 | Crown south lip `[1310, 535]` | −5.5 m | 5.5 m | 10.5 m | keep north-only launches |
| L5 | Throat approach z 275–300 + mask floor | −35.3 m | notch to ≤ 100, mask 110 → 101 | same | raise gate 12 to floor 110 |
| L6 | Bight Bridge passage south of gate 5 (reviewer) | solid 0–11 m | open to ≥ 14 m | same | move gate 5 / the Lamp Hop's line |

### L6 · The Bight Bridge's underside on the Lamp side — gate 5 `[560, 1080]` h 6, 24 × 16, yaw −0.577 (added by the M6 reviewer)
- **What the wing meets:** from 8 to 28 m along gate 5's normal toward the Lamp (±12 m across), `geography.blocker`
  reports `V01.retaining.offshore@bight` and `S2.retaining.offshore@bight` solid **from the sea to 9–11 m**, and
  `bightBridge.supports@bight` at the ends, under `bightBridge.deck@bight` (underside 11.1–11.4 m). The gate's plane itself
  is clear, so pass 1's proof reads `clear: true`, but no line from the Lamp reaches it below 11 m. Gate 5's aperture
  (−2…14 m) is 2.6 m into the deck at its top. (`evidence/m6-review/probes/B2-bight-bridge-solids.json`.)
- **Request:** carry the V01 and S2 approaches over the water on piers (spans with an underside), not retaining walls to
  the seabed, for the width of gate 5's aperture and 30 m either side along its normal; keep the deck underside ≥ 14 m
  over the aperture (or lower gate 5 to fit under 11 m). Or move the Lamp Hop's gate. Gate proofs should sweep the
  passage (± 30 m along the normal), not only the plane.
- **Why:** FLIGHT §11 ride 4 (the Lamp Hop) cannot be captured; four scripted tries ended on the deck or against the
  bridge (`evidence/m6/rides/lamp_hop`).

Not a request: **Crown → the Lamp** clears the summit's south-west shoulder by **+0.3 m** at `[1303, 447]` one second
after the lip (the baked glide proof reads −0.2); Prow → thermal → Sands clears by +18.6 m. ~~The Lamp Hop clears.~~
(Reviewer, 26 Sep: the Lamp Hop clears the *heightfield* only; the bridge's approach walls block it — L6. And every
number here is still air; in the build's 4 m/s south wind Crown → the Lamp does not arrive — FLIGHT.md, reviewer's notes.)

---

## 2 · Presence-wire request — Codex trust review (D38)

**Request:** show the partner's wing and let them hear your snap (FLIGHT §8; D38 applied pending Jonathan). Not
built in pass 2 (brief rule 11: no change to `src/ledgerSync/worldPresenceWire.ts` or `workers/ledgerRoom.ts`).

- **Wire fields:** extend `act` with **`'glide' | 'chute'`**; add **`p`** = the wing's bank in radians (glide) or 0
  (chute), quantised like `yaw`; `y` is already sent. Nothing else about the flight is sent (no airspeed, no phase,
  no landing, no course or gate result).
- **One sound event:** a single `snap` event (the glider's launch, the parachute's pull), rate-limited like the bell
  (0.7 s), carrying only `{kind: 'snap'}` — the receiver plays its own `audio.snap()` at the ghost.
- **Receiver:** `horizonPartnerPose` draws the greybox wing (`VehicleArt` glider / parachute, `movers/shared/vehicleArt.ts`)
  at the ghost when `act` is `glide`/`chute`, banked by `p`; otherwise the walking ghost as today.
- **Trust notes for the reviewer:** no money, no household data, no new identifiers; payload size +1 enum value and
  +1 number; old clients must ignore unknown `act` values (the review should confirm the Worker validator's
  behaviour on an unknown enum before it ships); the event must not be replayable into a flood (reuse the bell's
  limiter server-side).

---

## 3 · Sim requests from M6-CAM and their status

| # | Request | Status |
|---|---|---|
| 1 | `WingEnv.ground(x, z, y?)` takes the rider's height (a deck above the rider is not ground) | **Done** in this branch: `stepWing` / `stepChute` pass the height at the start of the step; `env.ts` honours it; the controller's `flyingY` closure is gone. Test: `horizonGliderController.test.ts` "WingEnv.ground takes the rider's height". |
| 2 | `launchPads` edge → the wing starts at the real lip with the pad's outward heading | **Done**: `wing.ts launchFromPad` (with `padHeading`, `padLip`, moved from the controller); the controller calls it once. The scripted journeys still launch from the edge's midpoint on their own bearing (their §0 numbers are the flight model's arithmetic), unchanged. |
| 3 | The Crown's south shoulder barely drops, so the controller runs off north | **Not a sim fix** — land (L4 above). Written into FLIGHT §2.1 as current behaviour. |

## 4 · Open for the next owner

- **M7's bail provider:** `registerBailOutProvider(runtime, getPlane)` in `movers/glider/index.ts` is the plug; until
  M7 lands, the only jump is the dev `?bail=x,z,h`.
- **Courses (pass 4):** gate pass-through events for `damRun`, `throatRun`, `lampHop` (the mover emits none yet in the
  runtime; the journeys measure them headlessly).
- **Desktop half brakes:** with the flare ruling, a stand-up into the 4 m/s south wind needs half brakes (the Move pad
  half back); on a keyboard S is full brakes only, and a full-brake flare into that wind lands at 4 m/s (a tumble).
  A half-brake key (or S = half, Shift+S = full) is a design decision, not made here.
