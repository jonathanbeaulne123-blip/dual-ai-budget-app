# NOTES — TRICKS track (flick-it input, catalogs, naming, scoring)

Owner files: `src/harbour/skate/tricks/**`, `src/harbour/skate/input/**`,
`test/skate-tricks.test.ts`, `test/skate-input.test.ts`. Codes only against `../contract.ts`.

## API

```ts
// tricks/catalog.ts
SKATE_FLIPS / SKATE_GRABS / SKATE_GRINDS : ReadonlyMap<string, Def>   // 22 flips, 10 grabs, 15 grinds/slides
skateCatalogs(): {flips, grinds, grabs}                                // inject into the sim exactly as is
resolveGrind({deckYawToLine, lean, overLine, faceSide, frontside}): GrindDef['id']
// tricks/score.ts
createSkateScore({stance?, catalogs?}) → {step(events, simNowSeconds): ScoreOutcome[]; line(): ScoreLine;
                                          bank(); drop(reason); reset(); setStance(); stance()}
airLabel / spinLabel / stancePrefix                                   // pure label helpers (trick book, tests)
// input/index.ts
createSkateInput({stance?, mode?: 'flick'|'easy', getGamepads?}) → {
  sample(nowMs, airborne, rolling, {landingSoon?}): SkateIntent        // once per sim step; one-shots fire once
  setStance(stance, {switch, fakie}); setMode(mode); reset(); activeDevice(); pausePressed();
  keyDown/keyUp(e) → handled?; pointerDown/Move/Up/Cancel(e); touchStart(zone,e)/touchMove/touchEnd/touchCancel;
  easyTrick(flipId|null, 'down'|'up', timeStamp, from?);             // HUD trick buttons
  boardView(); touches(); lastGesture() }                              // HUD drawing / trick-book echo
pickGrab(hand, steer, lean, facing), skateFacing(stance, riding), grabTable()
// input/flick.ts
createFlickRecogniser({digital?}) · gesturePath(flipId|null, stance, origin?) → {x,y}[] (screen, unit circle)
gestureSegments(...) · gestureSamples(flipId, opts) (plays a gesture: tests + trick-book demo) · recogniseGesture(path)
```

## Frames and mirroring (the maths)

The board stick is sampled in **screen space** (x right, y up). The recogniser works in
**stance space**: `x_stance = x_screen × facing`, where

    facing = (goofy ? −1 : +1) × (switch ? −1 : +1) × (fakie ? −1 : +1)

so `+x` always points at the rider's **toes** as the chase camera sees them (regular rolling
forward: toes to the right). Goofy mirrors once; riding switch or fakie turns the rider's chest to
the other side of the screen, so it mirrors again — gestures stay foot-relative. `y` is never
mirrored: **down = the end nearest the camera (trailing end, your normal pop foot), up = the leading
end.** A load on the nose (nollie) flips the path nose↔tail before matching (`k → (12−k) mod 8`),
which is exactly why a nollie kickflip is a flick toward tail-heel: the back foot kicks. `facing` is
latched when a load starts, so a mid-air stance change cannot scramble a gesture in progress.

`pop.from` in SkateIntent therefore means: `'tail'` = the stick-down pop (trailing end),
`'nose'` = the stick-up pop (leading end). The scorer names it `Nollie`; `switch`/`fakie` prefixes
come from the sim's pop event flags.

## The gesture grammar

```
                nose (↑)                   directions (regular, screen):
       nose-heel ↖   ↗ nose-toe                ↖ ↑ ↗
   heel ←     (centre)     → toe               ← · →
       tail-heel ↙   ↘ tail-toe                ↙ ↓ ↘
                tail (↓)                   goofy / switch / fakie: ← and → swap
```

1. **Load**: pull the stick fully toward the tail (≥ 0.7, within 38°) = crouch. Up instead = nollie load.
2. **Flick** (`⟶`): leave the load through the centre and reach the rim within **190 ms**. Where you land
   is the flip: `↑` ollie, `↖` kickflip (toward the heels), `↗` heelflip.
3. **Sweep** (`~`): roll round the rim instead of cutting through. The side you roll round is the shove
   direction (heel side = backside, toe side = frontside); where you stop is the flip:
   stop on the near diagonal = varial, on `↑` = shove-it, carry on to the far diagonal = hardflip / inward.
4. **Circle**: a whole lap back to the tail, then a flick — the lap is the 360 shove, the flick picks the flip.
5. **Again**: snap back to the tail and flick again = double (twice more = triple); up–down–up = impossible.

```
 kickflip          pop shove-it          360 flip                  impossible
  ↖ . .             ↖ ↑ .                 ↖ ↑ ↗   (lap ↓↙←↖↑↗→↘↓,     . ↑ .   ↓ ⟶ ↑ ⟶ ↓ ⟶ ↑
  . · .             ← · .                 ← · →    then flick ↖)      . · .
  . ↓ .             ↙ ↓ .                 ↙ ↓ ↘                        . ↓ .
```

### Full table (stance-normalised; regular screen arrows — mirror ← → for goofy/switch/fakie)

`⟶` = flick through the centre, `~` = roll round the rim. The same data is `FlipTrickDef.gesture`
(catalog.ts); `gesturePath()` draws it; `buildFlickTable()` refuses collisions at load.

| id                   | name                   | regular stick (screen)                          |
|----------------------|------------------------|-------------------------------------------------|
| (ollie, flipId null) | Ollie                  | ↓ ⟶ ↑                                           |
| kickflip             | Kickflip               | ↓ ⟶ ↖                                           |
| heelflip             | Heelflip               | ↓ ⟶ ↗                                           |
| double-kickflip      | Double Kickflip        | ↓ ⟶ ↖ ⟶ ↓ ⟶ ↖                                   |
| double-heelflip      | Double Heelflip        | ↓ ⟶ ↗ ⟶ ↓ ⟶ ↗                                   |
| triple-kickflip      | Triple Kickflip        | ↓ ⟶ ↖ ⟶ ↓ ⟶ ↖ ⟶ ↓ ⟶ ↖                           |
| triple-heelflip      | Triple Heelflip        | ↓ ⟶ ↗ ⟶ ↓ ⟶ ↗ ⟶ ↓ ⟶ ↗                           |
| pop-shove-it         | Pop Shove-it           | ↓ ~↙ ~← ~↖ ~↑                                   |
| fs-shove-it          | Frontside Shove-it     | ↓ ~↘ ~→ ~↗ ~↑                                   |
| varial-kickflip      | Varial Kickflip        | ↓ ~↙ ~← ~↖                                      |
| varial-heelflip      | Varial Heelflip        | ↓ ~↘ ~→ ~↗                                      |
| inward-heelflip      | Inward Heelflip        | ↓ ~↙ ~← ~↖ ~↑ ~↗                                |
| hardflip             | Hardflip               | ↓ ~↘ ~→ ~↗ ~↑ ~↖                                |
| 360-shove-it         | 360 Shove-it           | ↓ ~↙ ~← ~↖ ~↑ ~↗ ~→ ~↘ ~↓ ⟶ ↑                   |
| fs-360-shove-it      | Frontside 360 Shove-it | ↓ ~↘ ~→ ~↗ ~↑ ~↖ ~← ~↙ ~↓ ⟶ ↑                   |
| 360-flip             | 360 Flip               | ↓ ~↙ ~← ~↖ ~↑ ~↗ ~→ ~↘ ~↓ ⟶ ↖                   |
| 360-inward-heelflip  | 360 Inward Heelflip    | ↓ ~↙ ~← ~↖ ~↑ ~↗ ~→ ~↘ ~↓ ⟶ ↗                   |
| laser-flip           | Laser Flip             | ↓ ~↘ ~→ ~↗ ~↑ ~↖ ~← ~↙ ~↓ ⟶ ↗                   |
| 360-hardflip         | 360 Hardflip           | ↓ ~↘ ~→ ~↗ ~↑ ~↖ ~← ~↙ ~↓ ⟶ ↖                   |
| impossible           | Impossible             | ↓ ⟶ ↑ ⟶ ↓ ⟶ ↑                                   |
| dolphin-flip         | Dolphin Flip           | ↓ ⟶ ↑ ⟶ ↓ ⟶ ↖                                   |
| nightmare-flip       | Nightmare Flip         | ↓ ~↙ ~← ~↖ ⟶ ↓ ⟶ ↖                              |
| daydream-flip        | Daydream Flip          | ↓ ~↘ ~→ ~↗ ⟶ ↓ ⟶ ↗                              |

Unambiguous by construction: every transition is either a 45° rim step or a ≥ 135° flick (tested), no
two paths are equal, and a gesture completes on **release** (stick back in the centre and still for
24 ms, or an explicit button/finger/key release), a **dwell** on a nose-side sector, or a timeout — so a
longer gesture is never pre-empted by its own prefix while you are still moving. A thumb that
overshoots keeps the longest trick it already made (flick ↖ then drift to ← = kickflip).

Integration 2026-09-23: a completed gesture is stale after `max(staleMs, 1.5 × the last frame gap)`, so a flick
that finished inside a long frame (a slow phone, a hitch) still pops instead of vanishing.

### Feel pass (wave 3, 2026-09-23): flick-it at human speed

Tuned against a seeded human model (`test/skate-input-human-model.ts`, held by
`test/skate-input-human.test.ts`): 60 Hz frames with jitter and the odd 33 ms frame, both stances,
tail and nose loads; keys that overlap −30…+60 ms and chord up to 45 ms apart, rolls 40–110 ms a
step; thumbs that curve (bow ±0.25), aim ±12° (triangular), overshoot to the gate and sag to 0.82
on the rim, 60–200 ms flicks; mouse drags that run 1.1–1.8× past the rim, aim ±20°.

| intended / wrong (80 tries × 23 tricks) | before | after |
|---|---|---|
| keyboard | 70 % / 30 % | 99.9 % / 0.1 % |
| gamepad stick | 78 % / 21 % | 99.4 % / 0.3 % |
| mouse drag | 67 % / 31 % | 98 % / 1.8 % |

What changed, and why:
- **Pop on the flick (keys and gamepad).** A flick that lands on a nose-side sector and spells a whole
  trick pops *now* (`popOnFlick`), not on the release: keys were popping 180 ms after ↑ (however long the
  finger stayed down); now ≈ 35 ms (the chord window). If the gesture goes on (a double, an impossible,
  a corner corrected a beat late) its longer reading is emitted again; airborne by then, it reaches the sim
  as a `lateFlip` that the sim and the scorer treat as the **popped trick read further on** (sim
  `upgrades()`, scorer `isUpgrade`): within `FLIP_CORRECT_TIME` (0.15 s) of the last reading while still
  turning, or whenever its gesture carries on from the popped one (kickflip → double → triple; ollie →
  impossible/dolphin). The board keeps its turns (u rescaled by roll). Mouse and touch still pop on release
  (a drag's first touch of the rim is too often off by a sector).
- **Sweeps need the rim.** A move off a load or a flick end counts as a rim step only at ≥ `rimIn` (0.78);
  between rimOut and rimIn the thumb holds its sector (an established sweep of ≥ 2 steps may sag to rimOut,
  and its last sector still counts if it is let go at ≥ 0.4). A curved flick no longer reads as a varial.
- **Nicks and corners.** A 1–2 step nick along the rim before a centre flick is dropped (was 1). A flick
  never lands on a tail diagonal (→ the tail) or, off the tail, on a side (→ that side's nose corner); one
  from a tail diagonal after a circle completes the circle first. `repairFlicks()`: when a whole path means
  nothing, 2–3-step rim runs from the tail to a nose corner (or back) are straightened into the flicks they
  were, fewest first, latest first.
- **Rest means still.** A slow flick sweeping through the middle is not a release: the rest timer restarts
  while the stick moves more than 0.07 a sample.
- **Snap backs.** Re-armed on the tail (a double's snap back, by flick or round the rim), leaving it has
  the re-arm window, not the sweep step limit; a snap back that lands beside the tail is corrected to it.
- **Keys** (`keyboard.ts`): ↑ after ↓ (or ↓ after ↑, while it is still down or within 35 ms of letting go)
  is a flick, and a side key held from more than 60 ms before it drops out (↖ then ↓ is ↓, not ↙). A roll
  never skips a sector (one key at a time), so a two-sector jump off the tail or a tail diagonal is a flick
  (↓ held, ← then ↑ a beat apart = kickflip, not varial). On keys a varial is ↓, ↓←, ←, ←↑.
- **Dwell** 90 → 180 ms (sticks), 140 → 220 ms (keys), 260 ms (mouse): pops no longer wait on it, and
  doubles need the time. **Easy keys** are unchanged: one press, hold = crouch, release = pop.

### Timing and thresholds (`FLICK_TUNING`)

| | analogue | digital (keys) |
|---|---|---|
| pop on the flick (`popOnFlick`) | gamepad yes · mouse/touch no | yes |
| flick: leave load → rim | ≤ 190 ms | ≤ 260 ms |
| rim step (45°) | ≤ 140 ms (slower = wandering, dropped) | ≤ 240 ms |
| dwell to complete on the rim | 180 ms (mouse 260) | 220 ms |
| rest to complete (release) | 24 ms still (+40 ms grace if no samples) | 12 ms |
| settle a sloppy landing (±45°, nose side or back to the tail) | 70 ms | 90 ms |
| re-arm after snapping back to the tail | 240 ms | 340 ms |

Rim in/out 0.78/0.64 · load in/out 0.70/0.56 · short flick (sprang back before a poll saw the rim) ≥ 0.6 ·
strength = flick speed (45 ms → 1.0, 190 ms → 0.35; keys: load hold time).
**Manual**: gentle tilt 0.2–0.6 toward tail/nose (±42°) held 110 ms (exit hysteresis 0.12–0.68) →
`manual`/`nose-manual`, reported while rolling or airborne (so you can land into one). Loading out of an
established (≥ 310 ms) manual keeps it until the pop; a normal pull-back through the zone never starts one.
**Airborne**: a completed flip = `lateFlip`; an ollie gesture, or any flick with `landingSoon`, is buffered
140 ms and fires as `pop` on the first grounded step (once).

## Controls

| action | keyboard | mouse | touch (zones) | gamepad (standard) |
|---|---|---|---|---|
| ride: carve / lean | A D / W S | — (keys) | `left` floating stick (56 px) | left stick |
| push (tap = one stroke) | W | — | `push` | A |
| brake / powerslide | S / C | — | `brake` | B / LT |
| board stick (flick-it) | ← ↑ → ↓ or J I L K | hold LMB + drag (90 px) | `right` flick pad (64 px) | right stick |
| grab front / back hand | Q / E (+ WASD picks grab) | RMB = back hand | `grab-front` / `grab-back` | LB / RB |
| manual / nose manual | M / N (or gentle tilt) | gentle drag | gentle tilt | gentle tilt, D-pad ↓ / ↑ |
| grind assist (hold) | G | — | — | RT |
| revert · respawn · marker | X · R · T | — | HUD buttons | X · Y · Back |
| sprint | Shift | — | — | R3 |
| pause | (world: P / Esc) | — | — | Start → `pausePressed()` |

Keyboard digital stick: keys pressed within 30 ms land together (↑+← = ↖ in one frame); releasing all
keys holds the last direction 55 ms (so ↓ … ↑ is still a flick); releasing a chord within 25 ms is one
release; opposite keys: last pressed wins; **roll** across neighbours (↓, ↓←, ←, ←↑, ↑) to sweep.
**Easy keys** (`mode:'easy'`, accessibility): J ollie, O nollie (hold O + a flip key = nollie flip),
F kickflip, H heelflip, V pop shove-it, Y varial kickflip, U 360 flip — hold = crouch, release = pop,
press in the air = late flip. IJKL are off in easy mode (arrows still flick). `easyTrick()` gives the
HUD the same for touch buttons.

Grabs (hand + left-stick direction, stance-normalised; neutral in brackets):

| | nose | nose-toe | toe | tail-toe | tail | tail-heel | heel | nose-heel |
|---|---|---|---|---|---|---|---|---|
| back hand [indy] | crail | indy | indy | tail grab | tail grab | roastbeef | stalefish | stalefish |
| front hand [melon] | nose grab | japan | mute | mute | method | method | melon | nose grab |

## Grinds

`GrindDef.deckYaw` is signed: + = the board's leading end points to the **far** side (over the line),
− = back to the **near**/approach side; π/2 = slides. `deckPitch` + = nose down. Pairs:
crooked (−) / overcrook (+), smith (−, nose dips down the near side) / feeble (+, front truck over the far
side), suski (−) / salad (+) (both nose up, deep tail lean), lipslide (−π/2, tail went over) /
boardslide (+π/2, nose went over). `resolveGrind` rules: |yaw| < 0.2 → 50-50 / 5-0 (lean ≤ −0.3) /
nosegrind (lean ≥ 0.3); |yaw| ≥ 1.0 → nose/tail slide by lean (±0.45), blunt when `overLine`, else
board/lip by side; between → crooked/overcrook (nose lean), suski/salad (lean ≤ −0.7), else
smith/feeble. Side comes from `faceSide` when non-zero (+1 = leading end points at the ledge/coping face
= near), otherwise from the sign of `deckYawToLine` (a nose angle beyond ±90° is folded onto the tail).

## Naming and scoring (`score.ts`)

`[Switch] [Fakie] [Nollie] [Frontside|Backside 180/360/540] <Flip> [<Grab> (1.2s)] [Late <Flip>] [Revert]`;
plain pops are Ollie / Nollie / Fakie Ollie / Switch Ollie; `X to Manual`, `A to B` grind transfers,
`Rock to Fakie`, `Gap` (≥ 2.5 units), `Powerslide`, `Wallride`, `Air`.
Points = base (def points; ollie 60) × catch quality (0.6–1) × spin (+120 per 180, ×1.25 per 180 on flips)
× stance (switch 1.3, fakie 1.1, nollie 1.2) + grabs (× hold time) + air time/height, × clean landing
(0.75–1); grinds by time, distance and difficulty. Repeat in a line ×0.5ⁿ (floor 0.1). Multiplier =
distinct trick labels (cap 10). Line open while air/grind/manual or ≤ 1.5 s since the last trick → banks;
a `bail` event loses it (`{kind:'lost', points, reason}`).

## What other tracks must know

- **SIM**: call `sample()` once per fixed step. `pop` / `lateFlip` / `revert` / `respawn` / `marker` are one-shots;
  hold a `pop` a few steps yourself if it arrives mid-landing. Treat `pop.from` as trailing ('tail') vs leading
  ('nose') end. Please add `frontside?: boolean` to the `grind-start` event (sim-owned field) — the scorer
  reads it for "Backside Smith Grind"; without it the side word is omitted. `resolveGrind()` is available.
  `crouch` stays up through the flick until the pop; `manual` is also reported airborne (land into manual).
- **LOOK**: flip sign conventions are in catalog.ts's header (yaw + = backside, pitch + = impossible wrap).
- **SHOW (HUD)**: draw the trick book from `gesturePath()`/`gestureSegments()` (screen space, pass the
  rider's stance), animate demos with `gestureSamples()`, show the live thumb with `boardView()` and
  `touches()`, label buttons with the Controls table. Touch zones: 'left' | 'right' | 'push' |
  'grab-front' | 'grab-back' | 'brake' (≥ 44 px). `easyTrick()` for accessibility buttons.
- **INTEGRATION**: route keys through `input.keyDown/keyUp` (returns true → `preventDefault`). HarbourWorld's
  `acceptsSkateKey` list must grow to: w a s d shift arrows i j k l q e c g m n x r t (+ f h v y u o in easy
  mode). Space, B, P and Escape stay with the world. E and 1–6 are emotes only while walking — E is the back-hand
  grab while skating. Call `setStance(present.stance,{switch,fakie})` each step; pass
  `landingSoon = airborne && clearance < ~0.15 && vy < 0`; call `reset()` on pause, blur, tool open and leaving
  the board; poll `pausePressed()` each frame. Suppress `contextmenu` on the stage while skating (RMB grab) and
  use pointer capture for the drag. Pass `performance.now()` to `sample()` — event `timeStamp`s share that clock.
