# Tideline Skate Club v2 — from "a board you can stand on" to a real skate game

- **Opened:** 2026-09-23 · **Owner:** Jonathan · **Orchestrator:** Claude (subagents build)
- **Base:** main @ 4ffe88fb (#528 Tideline Skate Club v1, Codex) · **Branch:** `claude/skate-v2`
- **Budget delta:** 0 — recreational, device-local progress only; no ledger, no hosted writes, no money semantics.

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
