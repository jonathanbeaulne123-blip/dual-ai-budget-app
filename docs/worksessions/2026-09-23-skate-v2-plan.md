# Tideline Skate Club v2 — from "a board you can stand on" to a real skate game

- **Opened:** 2026-09-23 · **Owner:** Jonathan · **Orchestrator:** Claude (subagents build)
- **Base:** main @ 4ffe88fb (#528 Tideline Skate Club v1, Codex) · **Plan branch:** `claude/skate-v2` (506ae8b3) · **Integration branch:** `claude/skate-v2-int`
- **Status:** integrated and verified **locally** on `claude/skate-v2-int` (waves 1–3 merged, cross-track follow-ups closed). Not pushed, no PR, not merged, not deployed, not live verified. Decision: [D-296](../DECISIONS.md).
- **Budget delta (5):** 0 — recreational, device-local progress only; no ledger, no hosted writes, no money semantics.
- **Engagement delta (3):** +3 intended — a skate game worth opening between sit-downs, shared with Bianca through the existing presence lane. Not yet played by humans (see limits).
- **Risk:** Medium-High (shared renderer lease and walker frame, key routing next to the Hearth tools, presence mapping, device storage migration). No money meaning, calculation, writer, schema, sync, Auth/RLS or Hercules payload change.

## The brief (Jonathan's words)

> Take what Codex did with the skateboard update and turn it into something incredible. Movement/jumping/tricks all need to be fully fleshed out. Take it from a bad Roblox game to a proper Skate 3 game with our art style.

## Why v1 reads as "bad Roblox"

- Tricks are single key presses; the board spins rigidly about one axis and snaps back. No pop, no flick, no catch.
- The board is stacked boxes; the rider has no knees, a fixed sideways carriage and no weight.
- Physics is a heightfield with a scalar speed: no real transitions, no vert, no pumping, no powerslide, one grind (50-50), landing = "is the yaw within 0.75 rad".
- Three ramp shapes on flat pads; no stairs, handrails, ledges, bowls, gaps.
- Camera is the walking follow cam with a longer radius.

## What "Skate 3 with our art style" means here

**Feel (the Skate 3 part)** — analogue **flick-it**: left stick rides (carve, lean), right stick does the board (pull back to crouch, flick to pop, the path of the flick picks the trick). Momentum you can feel: pushing, pumping transitions, carving, powersliding, rolling fakie up a quarterpipe and back in. Airs where the board visibly leaves the feet, flips under you and gets **caught**. Grinds and slides chosen by **how you approach** (angle, lean, which truck). Bails that look like bails. A low, wide chase camera that sells speed.

**Look (the Hearth part)** — the island is a *model village on a kitchen table*, cut paper and painted wood under raking light (see `claude/POPUP-BEACONS-AND-RULE.md` beacons: Lantern Row, Year in the Round). The park is a *crafted object*: painted-card concrete, pencil-line coping, stacked shadows, each theme (Classic / Taylor / Newfoundland) authored. No generic grey concrete, no downloaded assets, no copyrighted game content — an original game with its own names.

## Architecture

`src/harbour/skate/contract.ts` is the only thing tracks share. Dependency injection everywhere so tracks build and test in isolation:

```
input/  (gestures → SkateIntent)      tricks/ (catalogs, naming, scoring)
            \                             /  (FlipTrickDef/GrindDef/GrabDef maps injected)
             →  sim/ (SkateIntent + SkateField → SkatePresent + SkateSimEvent[])
                         ↑                         ↓
                  world/ (SkateField, park meshes)  look/ (board, rider pose, FX)  camera/  hud/ audio/ session
```

## Tracks and file ownership (wave 1, parallel)

| Track | Owns (create/modify only these) | Delivers |
|---|---|---|
| **SIM** | `src/harbour/skate/sim/**`, `test/skate-sim*.test.ts` | `createSkateSim(field, catalogs, opts)` with `step(intent, dt) → {present, events}`; transitions/vert/pump/carve/powerslide/stance/switch/fakie/nollie, catch-window landings, 3D grind/slide/stall engine, manuals, reverts, wallride (stretch), bails + recover |
| **TRICKS** | `src/harbour/skate/tricks/**`, `src/harbour/skate/input/**`, `test/skate-tricks*.test.ts`, `test/skate-input*.test.ts` | Flip/grab/grind catalogs; flick-it gesture recogniser; keyboard, pointer-drag, touch pads, Gamepad API sources → `SkateIntent`; trick-name composer ("Switch Backside 180 Kickflip"); combo/scoring engine over `SkateSimEvent` |
| **PARK** | `src/harbour/skate/world/**`, `src/harbour/skate/park.ts`, `src/harbour/skate/parkScene.ts`, `test/skate-world*.test.ts` | `createSkateField(ground)` (analytic surfaces with normals + lips), grindables, solids, spots/routes; the rebuilt Tideline park + street spots; themed meshes built from the same profiles |
| **LOOK** | `src/harbour/skate/look/**`, `src/harbour/skate/board.ts`, `src/harbour/body/figure.ts` (skate pose hook + knees only), `test/skate-look*.test.ts` | New board model; rider pose solver from `SkatePresent` (knees, crouch, pop, flick-foot, catch, grabs, grind stances, manual, powerslide, bail tumble, landing compression); flip-overlay from `FlipTrickDef`; FX (grind sparks, wheel chalk, landing puff, paper confetti on big banks, speed streaks) |
| **SHOW** | `src/harbour/skate/camera/**`, `src/harbour/skate/hud/**`, `src/harbour/skate/SkateHUD.tsx`, `src/harbour/skate/skate.css`, `src/harbour/skate/audio.ts`, `src/harbour/skate/session.ts`, `test/skate-show*.test.ts` | Skate chase camera module; HUD redesign (ticker, combo, balance, touch pads layout slots, controller glyphs, trick book); synthesized audio v2; challenges (Own the Spot per spot, S.K.A.T.E. letters, line goals), progress v2 with v1 migration |

Nobody in wave 1 touches `rider.ts`, `skateModel.ts`, `walker.ts`, `runtime.ts`, `HarbourWorld.tsx`, presence or workers — that is wave 2 (INTEGRATE).

## Rules for every track

- Node/pnpm are installed; each track works in its own git worktree off `claude/skate-v2`, commits on its own branch `claude/skate-v2-<track>`.
- The machine has 2 CPUs and 7 GB RAM shared by five tracks: **do not** run `pnpm typecheck`, `pnpm build`, the quick gate, or a browser in wave 1. Run your own vitest files (`pnpm exec vitest run test/skate-<track>*.test.ts --maxWorkers=1`) and a scoped `tsc --noEmit` over your folder.
- Pure, deterministic, allocation-light hot paths (this runs on phones at 60 fps inside the shared leased renderer). No `Math.random` in sim/scoring; seeded RNG where needed.
- Existing repo style: dense TypeScript, `.ts` import extensions, THREE from `three`, dispose everything you create.
- Accessibility: reduced motion is honoured (camera shake/FOV kick/confetti quiet down; riding still works); every control reachable by keyboard; touch targets ≥ 44 px.
- Write a short `NOTES-<track>.md` in `src/harbour/skate/<your folder>/` listing the API, tuning constants and anything integration must know.

## Wave 2 — integration (2026-09-23, branch `claude/skate-v2-int`)

Merged sim → tricks → park → look → show (no conflicts), then made them agree, each seam proven by a test:

| Seam | What changed | Proof |
|---|---|---|
| Grind naming | Contract: optional `frontside` on `grind-start` (sim sets it: chest faces the grindable). Sim takes TRICKS' `resolveGrind` injected in its catalogs; `overLine` = popped past the line. TRICKS catalog is authoritative for side (crooked −, overcrook +). | `test/skate-int-grinds.test.ts`: all 15 ids on a real rail and a real ledge; frontside mirrored for goofy; "Backside Smith Grind" |
| Lips / vert | Park: every coping lip is `vert`. Sim: no auto-lock from vert airs; vert launch carries the unrolled heading; landings judged in the unrolled plane; wheel grip below 2.2 u/s so a wall's peak can't swing the board. | `test/skate-int-park.test.ts`: Chimney air > 0.8 over coping, lands back in clean & fakie; Hatch kicker; Kettle drop-in; Breadbin pumping climbs into airs; stall keeps the line |
| Solids / shore | `skateSimOptions(obstacles)` merges the island obstacles and `holdAshore`. | same file: buildings, sea |
| Shove-it render | Look: `yawFlip` absorbs the overlay at trick end and cancels the sim's exact-π relabels. | `test/skate-int-look.test.ts`: pop/fs shove-it, 360 flip, varial, kickflip continuous in both stances; heights; pitch/roll signs |
| Input | Driver syncs stance/switch/fakie each frame, `landingSoon`, `performance.now()`, reset on pause/blur/tool; keys/mouse drag/touch zones/gamepad/Start routed; context menu suppressed while skating; long frames don't make gestures stale. | `test/harbour-skate-model.test.ts` |
| Show | Skate chase camera drives the camera on skate frames (no orbit while skating: mouse drag is the board stick); HUD model built ≤ 20 Hz and throttled; real hints and trick book; audio created in the gesture; confetti on banked lines. | browser smoke |
| Presence | Wire act mapped from the v2 present onto the existing `skate-*` acts (no wire/worker change); partner drawn by the v2 look. | `test/harbour-skate-presence.test.ts` |

v1 (`rider.ts`, `skateModel.ts`, `hud/legacy.ts`, park ramp shims) is deleted; `skate/driver.ts` replaces it. Browser smoke (headless SwiftShader, ~1–3 fps): board down, push, ollie and kickflip (easy keys — the flick timing can't survive 1 fps event delivery), Tideline via the book, pause/resume, walk away, Taylor and Newfoundland: `docs/evidence/skate-v2/`. No console errors.

## Wave 3 — polish tracks (2026-09-23, four branches from 275e6fdb)

Four tracks on disjoint files, each judged in the Skate Lab; merged into `claude/skate-v2-int` without conflicts (rider → feel → parkart → hud).

| Track (branch) | What it built |
|---|---|
| **RIDER** (`claude/skate-v2-w3-rider`, look) | A skater's stance (deeper knees, ankle yaw so the shoe sits on the bolts while the knee points elsewhere), a bigger board (0.66 × 0.31, wide trucks), tight flips that wrap the real shoe, a head that turns with the line, grab reach for shorter avatars, a readable bail and get-up, brighter grind sparks. `test/skate-look-craft.test.ts` pins the numbers. |
| **FEEL** (`claude/skate-v2-w3-feel`, sim + input) | Flick-it at human speed, tuned against a seeded human model (keys 70 % → 99.9 % intended trick, gamepad 78 % → 99.4 %, mouse 67 % → 98 %); pop on the flick; flip upgrades mid-air (kickflip → double keeps its turns); grinds picked by the board's angle and the left stick at contact, as in Skate; one wheel model at every speed with tyre grip on cross-slopes; punchy pushes, fast paths and cobbles, controllable spins, fairer catches, livelier manuals and grinds, quicker get-ups; feel tests on the real park. |
| **PARKART** (`claude/skate-v2-w3-parkart`, world) | Poured slabs, pencil joints, contact shade and edge dressing (hedges, picket flats, bleachers, lanterns, masts, pots, crate, rope posts) in all three themes; a lighter lite tier; dressing footprints (`SkatePark.dressing`) for integration. |
| **HUD** (`claude/skate-v2-w3-hud`, show) | Nothing on the rider: ride card, hints column, radar and a lower-left ticker on wide stages, one top band on phones, thumb clusters above the app bar on touch; a Skate-feel chase camera (low, 2.5 back, swings side-on up walls, occlusion crane); audio mix; the pause book on phones; focus hand-back; the cat at the park edge. |

### Cross-track follow-ups closed in integration

| Follow-up | What changed | Proof |
|---|---|---|
| Mid-air flip upgrade (FEEL rescales `u` when `present.trick.flipId` changes) | Look: `FlipCarry` carries the turns the board has made into the new trick and decays with its ease, instead of ending the trick; a flip read after a catch starts square. | `test/skate-int-look.test.ts` (kickflip → double continuity, no pop) |
| Bail / get-up agreement | Sim `recover()` gets up **at the heap** when its footprint is flat, clear, off rails/ledges/coping and ashore; it relocates (newest safe pose ≥ 0.8 away) only otherwise, and says so with `recovered.moved`. Look get-up 0.9 → 0.6 s and sim `RECOVER_TIME` 0.25 → 0.48 so control returns as the board is stamped under the feet; the look lays the board at a new spot and the camera cuts **only** on `moved`. A bail reads: tumble (0.8 s, lie briefly) → get up where you fell. | `test/skate-int-bail.test.ts` (in place on flat; rail, step edge, ramp face relocate; camera cut only on relocation); lab `bail` (`recovered moved:false`) |
| Grind-picking hints | `skateHints()` adds an air hint on every device (W A S D / the left stick as you land on the rail picks the grind); `SKATE_GRIND_HOW` gives each of the 15 grinds its pick in the Trick book, under a `grindsNote`. | `test/harbour-skate-model.test.ts`, `test/skate-show-hud.test.ts`; smoke still `final-03` |
| Dressing colliders | `world/dressingSolids.ts` turns the 121 dressing pieces (same in every theme and tier) into height-aware sim solids; `buildSkatePark` registers them for its field and `skateSimOptions` hands them to the sim (`extraSolids`); `ensureSkateDressing` for tests and the headless lab. They are **soft**: bump and stop, never a wall bail or a wallride (the lab `line` rolls off Tideline's end into the Northlight-end hedge at ~4.3 u/s; as a hard solid that was a bail). | `test/skate-int-dressing.test.ts` (starts, route checkpoints and segments clear; a rider stops at a hedge it would otherwise cross; soft vs hard); lab `line` passes with them |
| Drainage tilt | Documented, geometry unchanged: pads follow the island's fall and features are sheared onto them; the sim compensates (tyre grip, unrolled vert launch/landing). A truly level transition would be a pad with `maxSlope: 0`. | NOTES-park "Drainage tilt" |
| Found by the whole-app smoke | Space while skating opened All tools, the stage blur paused the ride and the HUD's pause book took the keyboard out of the sheet. The book now takes focus only when no other dialog holds it. | `test/skate-show-hud.test.ts` (fails without the fix); smoke `space-opens-tools-and-pauses` |

## Controls (flick-it; `input/NOTES-tricks.md` is the full table)

| Action | Keyboard | Mouse | Touch | Gamepad |
|---|---|---|---|---|
| Board down / walk | B | "Skate the island" · book "Put the board away" | same | — |
| Ride: carve / lean | A D / W S | — | left floating stick | left stick |
| Push (tap = one stroke) · sprint | W · Shift | — | Push | A · R3 |
| Brake / powerslide | S / C | — | Brake | B / LT |
| Board stick: crouch, pop, flips | ← ↑ → ↓ or J I L K (↓ then ↑ = ollie; ↓ then ↖ = kickflip in regular) | hold left button + drag | Flick pad | right stick |
| Grab front / back | Q / E | right button | Grab ◂ / ▸ | LB / RB |
| Pick a grind | W A S D as you land on it (board along = grind, swung across = slide) | keys | left stick | left stick |
| Grind assist (hold) | G | — | — | RT |
| Manual / nose manual | M / N | gentle drag | gentle tilt | gentle tilt, D-pad |
| Revert · retry · marker | X · R · T | — | Retry | X · Y · Back |
| Pause (the book) | P / Esc | Book | Book | Start |
| All Hearth tools | Space (pauses the ride) | Compass | Compass | — |

**Easy keys** (Settings → Controls, accessibility): J ollie, O nollie, F kickflip, H heelflip, V pop shove-it, Y varial kickflip, U 360 flip — hold to crouch, release to pop. The Trick book draws every flick for the rider's stance.

## Skate Lab

A deterministic, frame-stepped rig for looking at and tuning the ride. Dev only: served at `/__skate-lab` by `scripts/skate-lab.mjs` (its own loopback Vite server) and by the `__review` preview. Nothing under `src/` imports it, and it is not in the build (`test/skate-lab.test.ts` fences both, including a scan of `dist/` when one exists).

- **Parts** (all real): `buildSkatePark` on the one field, the island ground and light rig, the theme's dressing (classic, taylor or newfoundland; full or lite tier), `createSkaterLook` on the Jonathan or Bianca playable figure (or `default`), the real skate chase camera, and optionally the real `SkateHUD`. The ride is the real driver (sim, flick-it input, scorer, session). Time only moves when you step it, and the page renders only in `snap()`, so SwiftShader is fine at 480×300.
- **Files:**
  - `test/browser/skateLabCore.ts`: the headless core (timeline, virtual gamepad, trace).
  - `test/browser/skateLab.ts`: the page and `window.skateLab`.
  - `test/browser/skateLabScenarios.ts`: the named scenarios and still cameras.
  - `scripts/skate-lab.mjs`: the CLI.
- **`window.skateLab`:**
  - `await load({spot | x,z,yaw | local:[lx,lz,deg], speed, theme, tier, avatar, stance, controls, hud, width, height})`
  - `script([...])`. Each entry is at frame `at` after the call. Entry kinds:
    - `intent` (a raw `SkateIntent` for `for` frames; one-shots fire on the first frame only);
    - `key`/`down`, or `tap` (keyboard through the real input);
    - `pad` (virtual gamepad: sticks and standard buttons);
    - `flick: id|null` (plays a flick-it gesture on the right stick through the real recogniser);
    - `auto: 'grind'|'manual'|'nose'` (a scripted thumb that balances);
    - `place: {…sim fields}` (test shortcut, e.g. `boardYaw:'@+90'`);
    - `command`.
  - `step(frames, dt=1/60)` and `advanceTo(frame)`.
  - `await snap()` returns a PNG data URL of the canvas. With `hud`, the CLI screenshots the stage instead.
  - `present()`, `events()`, `trace()` and `kinds()`.
  - `camera('chase'|'side'|'orbit'|'fixed', params)`: `side` locks the view heading when set; `orbit` takes `{yawDeg, pitchDeg, dist, target?}`.
  - `pose(partialPresent, settle=45)` freezes any `SkatePresent` for pose inspection.
  - `begin(name, overrides)`, `still(theme, tier, i)` and `compose(images, labels, cols, title)`.
- **CLI**
  - `node scripts/skate-lab.mjs list`
  - `node scripts/skate-lab.mjs all stills --out /home/claude/lab-out/run1` writes a filmstrip `<name>.png` (12 frames, 4 across, each frame labelled with its phase and speed) and a trace `<name>.json` (present and events for every frame) per scenario, plus `stills.png`. Stills are theme × tier × three fixed cameras.
  - Options: `--size 480x300`, `--cols 4`, `--theme`, `--tier`, `--avatar jonathan|bianca|default`, `--stance goofy`, `--hud` (use `--size 960x600` to judge the HUD), `--port`, `--chromium <path>` (or `SKATE_LAB_CHROMIUM`; defaults to the preinstalled headless shell). A full run takes about 1 minute.
- **Scenarios**, each with an event expectation checked headless by `test/skate-lab.test.ts`: push-away, ollie, kickflip, heelflip, pop-shuvit (the flip tricks are driven by flick-it on the virtual stick), 360-flip (off the Hatch, with a crouched landing), fs-180, indy-kicker, grind-5050 / grind-boardslide (Rolling Pin), grind-smith (Breadboard ledge), manual, bowl (Kettle drop-in), vert-air (Chimney), powerslide (round to fakie), bail (and get up), and line (50-50, roll out, kickflip, manual).
- **Tuning loop:** change a constant, then run `pnpm exec vitest run test/skate-lab.test.ts` (seconds; tells you whether the tricks still happen), then run the CLI for the affected scenarios and compare the filmstrips with the baseline. Same inputs, same frames: filmstrips are directly comparable across runs.
