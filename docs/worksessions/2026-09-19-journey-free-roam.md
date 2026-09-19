# Hearth worksession — Free roam in the journey's open world (D-286)

- **Status:** OPEN (local branch; not pushed, not merged, not deployed)
- **Opened:** 2026-09-19 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX systems)
- **Repository:** dual-ai-budget-app
- **Branch:** `claude/journey-free-roam`
- **Baseline SHA:** `4de2b28e` (`main`, D-284/D-285 merged)
- **Head SHA:** see `git log` on the branch (local only)
- **PR or issue:** none
- **Risk:** Medium (camera and HUD of the open world; no money meaning, schema, sync or Hercules payload change)
- **Decision owner:** Jonathan
- **Environment impact:** none (local only; fictional habitats in every test and screenshot)

## Household outcome

Jonathan (2026-09-19): "I love it, it's been merged — the journey map is beautiful, fast and fun to use. Now I want a free roam cam in journey mode: a way to explore the world. This will give it an open world feeling. One can unlatch the camera from their avatars and explore their island as they wish."

In the full-screen open world the camera can now be taken off the two of you and flown anywhere on the island and out over the era islands, and handed back whenever you want to be with them again.

## Budget delta (5)

+0. Presentation only. No money meaning, calculation, writer, schema, sync or Hercules payload change; nothing posts. The camera draws only while it is moving, so a free camera at rest costs no more than a latched one.

## Engagement delta (3)

+2. The island stops being a diorama you orbit and becomes a place you walk through, and the corner radar makes wandering safe because the way back is always on screen.

## Verified baseline

Facts, read from the code at `4de2b28e`:

- `src/path/world/pathWorld3d.ts` holds one orbit camera, `cam = {tx, tz, r, theta, phi}`, placed each frame by `place()`. Its target is clamped to `eraExtent + 20` (or 84 with no journey) and its radius to `14 … maxRadius()`.
- A single-pointer drag orbits; Shift or the right button pans; two fingers pinch; the wheel zooms. A press that travels under 6px is a pick.
- `flyTo` is the only way the camera travels; `focus`, `focusMonth` and `setLevel` all use it. `onView` reports the grown month nearest the camera 360ms after a gesture rests; `onLevel` reports the distance band.
- The loop is render-on-demand: `invalidate()` asks for a frame, `frame()` stops asking once nothing is moving, and `halt()` stops it for a hidden tab, a scrolled-away host or `sleep()`.
- `OurPathWorld.tsx` owns `useJourneyFocus(today)` and pushes it into the world; `guardTrip` holds reports back while a trip the page asked for is in the air.
- Per-device preferences are plain `localStorage` keys read and written inside `try`/`catch` (`hearth:pathWorld:lantern`, `:quality`, `:mine:<memberId>`).

Inference: the latched camera's `place()` adds a lean of up to 0.35 rad as it comes in close, so a free camera that used `cam.phi` raw would jump on unlatching. Confirmed by reading `place()` and fixed by adopting the effective tilt.

## Scope

### In scope

- `src/path/world/roamCamera.ts` (new): the pure maths — bounds, view-relative movement, exact damping, flick, reduced motion, the eye that clears the ground, the facing a minimap needs.
- `src/path/world/pathWorld3d.ts`: the free camera, its pointer and keyboard gestures, the per-frame step, `setRoam` / `roaming` / `roamTo` / `roamView`, `onRoam` / `onRoamView` / `onRoamHome` / `onRoamToggle`, and `PathRoamView`.
- `src/path/OurPathWorld.tsx`: the HUD control, the state chip, the first-time hint, the live announcements, the latching rules, the focusable canvas wrapper.
- `src/path/PathRoamRadar.tsx` (new) and `src/path/our-path-world.css`: the corner radar and every new style, in the three themes, at 320/390/720/1100, reduced motion and forced colours.
- Tests: `test/journey-roam-camera.test.ts`, `test/journey-free-roam-ui.test.ts`.
- Evidence: `scripts/capture-journey-free-roam.mjs` → `docs/evidence/journey-free-roam/`.

### Out of scope

- The simple view's own camera (`src/path/mini/*`). It is a tabletop model of a whole level, not a place to walk; it keeps its scale, scrubber and keys.
- The flat / no-WebGL fallback. It has no camera at all; its outline says so.
- Money, schema, sync, Hercules payloads, hosted data, Production.

## What free roam is

**Two modes.** *Latched* is today's camera: it follows the two of you, and a focus from either view flies it. *Free roam* hands it over. Taking it keeps the exact view on screen — the free camera adopts the lean the latched one was already applying — and widens the ring it may travel in from `eraExtent + 20` to `eraExtent + 70`, so the future era islands are reachable and not only visible.

**The controls.**

| | |
| --- | --- |
| Drag | glide, with a little inertia and damping |
| Right-drag, Shift-drag, two-finger twist, `Q` `E` | look around |
| Pinch, wheel | zoom |
| `W` `A` `S` `D`, arrow keys | move relative to where you are looking |
| `R` `F` (or `+` `−`) | rise toward overhead, fall toward the horizon |
| `Shift` | hurry |
| `Space`, `Home`, Where we are, Return to us, the control | back to the two of you, latched |
| `C` | hand the camera over and take it back |

Keys act while the canvas wrapper holds focus; it is `role="application"`, `tabindex="0"`, named with the mode and its keys, and shows a ring around the whole island. Taking the camera from the HUD moves focus there.

**Frame-rate independence.** Every axis is integrated with the exact solution of `v' = -k(v - target)`, so one step of a second and sixty steps of a sixtieth land in the same place. Speed scales with distance (close in it creeps, far out it covers ground), a diagonal is no faster than a straight line, and a frame gap is capped at 50ms so a stalled tab cannot teleport the camera.

**Bounds.** The target may not leave its ring, and speed into the ring is dropped so it does not buzz along it. The eye never sinks under the sea, the island or an era island: it clears whatever is under *it* as well as what is under the target.

**Reduced motion.** No inertia at all. The camera moves exactly while a key is held and stops the instant it is let go; a released drag leaves nothing behind.

**Latching rules.** A drag takes the camera with one quiet line. A pick from either view is a request: it still travels, and the camera stays free when it lands. Replay, the slider and a date change never yank a free camera — the map's month still moves, and the camera keeps reporting where it rests (`onView`), so the simple view and the caption follow it. Where we are, Space, Home, the chip and the control all latch and fly home, and minimizing latches too, so the world always opens with the two of you.

**Performance.** Still render-on-demand. A free camera at rest asks for no frames; a held key or a glide asks until it settles. `halt()` releases every held key and stops the glide, so sleeping, minimizing, a hidden tab, a scrolled-away host or a lost context cannot carry the camera away or wake a loop.

## Acceptance evidence

- [x] `npx tsc --noEmit -p .` — no new errors (12 pre-existing failures in `src/hearthside/*` and `src/wardrobe/*` from uninstalled optional packages `@capacitor/core`, `@hearth/browser-ar`, `manifold-3d`).
- [x] `npx vitest run test/journey-roam-camera.test.ts` — 30 pure camera tests.
- [x] `npx vitest run test/journey-free-roam-ui.test.ts` — 16 tests.
- [x] Existing suites green: `test/our-path-world-ui.test.ts`, `test/our-path-world.test.ts`, `test/journey-game-mode-ui.test.ts`, `test/journey-integrated-ui.test.ts`, `test/journey-fullscreen-ui.test.ts`, `test/journey-mini-ui.test.ts`, `test/journey-mini-model.test.ts`, `test/journey-mini-story.test.ts`, `test/journey-focus.test.ts`, `test/journey-loader-recovery.test.ts`, `test/path-minimap.test.ts`, `test/path-bridges.test.ts`, `test/path-era-islands.test.ts`, `test/path-eras-ui.test.ts`, `test/path-eras.test.ts`, `test/path-footpaths.test.ts`, `test/path-land.test.ts`, `test/path-stones.test.ts`, `test/path-umbrella-pieces.test.ts`, `test/path-weather.test.ts`, `test/path-words.test.ts`, `test/habitat.test.ts`, `test/habitat-story.test.ts`.
- [x] Quick gate: `pnpm test -- --risk=medium-high --focus=test/journey-free-roam-ui.test.ts --focus-reason="free roam camera in game mode"`.
- [x] Browser evidence: `node scripts/capture-journey-free-roam.mjs` → `docs/evidence/journey-free-roam/` with `report.json`.

## Evidence log

Headless Chromium at `/opt/pw-browsers/chromium` with `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist --enable-unsafe-swiftshader`, on the real Our Path page through `scripts/serve-our-path-world-proof.mjs` with fictional habitats and a fictional Journey of Life (`?eras=demo`). 320/390/720/1100 × Classic / Taylor's Scrapbook / Newfoundland, plus a reduced-motion pass at 390.

`<theme>-<width>-<step>.png`:

1. `1-latched` — the world as it opens, the camera on the two of you, Free roam unpressed.
2. `2-taken` — the unlatch moment: "You've taken the camera · Return to us". `takenBy` in `report.json` says whether the drag itself or the control was captured (see the note below).
3. `3-hint` — the first-time hint, every control listed, with Got it.
4. `4-roam-island` — roaming across the island: the camera dropped toward the horizon and glided, land running to a horizon with the era islands and their bridge beyond.
5. `5-roam-future-islands` — out over the future era islands, which only the roam ring reaches.
6. `6-radar-cone` — the corner radar on its own: the land as circles, the two of you as their own mark, the camera and the wedge it sees. `<theme>-<width>-radar.json` records the exact `roamView`.
7. `7-keyboard-roaming` — keyboard roaming with the canvas wrapper focused; `<theme>-<width>-keyboard.json` records how far Shift+W moved the camera and how far E turned it.
8. `8-reduced-roaming` (390) — reduced motion; `<theme>-390-reduced.json` records the drift after the key is released (0 means no inertia).
9. `9-relatched` — Return to us: latched again, flown home, the chip and the radar gone.

Every row records `pageErrors`, `consoleErrors`, `overflow`, `smallTargets`, `hudOverlaps`, `offscreen`, the mode, the chip, the announcement and the radar's transform.

What the captures found and fixed, in order:

- Unlatching moved the picture, because the latched camera's close-range lean was dropped. Fixed: taking the camera adopts that lean; handing it back removes it again.
- A trip the free camera was asked to make never reported itself, so the radar froze mid-flight. Fixed: a flying free camera reports every frame.
- The radar's first view arrived before its SVG existed, so the camera's mark sat in the corner until the next move. Fixed: the first view is drawn from state; every one after it only moves the mark.
- The corner map carried its old `grid-area: mini` into the new column it shares with the radar and was pushed diagonally out of place. Fixed.
- On phones the first-time hint sat across the state chip. Fixed: it drops below it.
- The radar was too faint to read at phone size. Fixed: drawn to the land rather than the whole ring, stronger land, sea and marks, a larger disc.

Environment notes, honestly:

- Software WebGL draws about two frames a second on this page, and a frame advances at most 50ms of camera time, so a held key covers roughly a thirtieth of the ground it would on a real device. The keyboard step therefore holds keys for several seconds and records the measured displacement in `<theme>-<width>-keyboard.json` rather than relying on the picture alone. Gestures (drag, right-drag, pinch, wheel) change the camera on the pointer event itself and are unaffected.
- For the same reason the quiet "You've taken the camera" line can expire before a screenshot lands. The script checks, and if it has, latches and unlatches once from the control so the moment is still captured; `takenBy` records which.
- `smallTargets` covers the HUD's own controls and the radar. The compact simple view's own zoom chips inside the corner map are 30px by D-284's design (36px on coarse pointers); they are counted separately as `miniChipTargets` rather than hidden.

## Decisions

D-286 in `docs/DECISIONS.md` (prose entry and table row).

## Remaining uncertainty

- Not measured on a real phone. The Lite tier was exercised at 320/390 in software rendering only; the free camera adds one `stepRoam` call and two ground samples per frame, and no frames at all while it rests, so the cost should be below the noise, but that is reasoning, not measurement.
- `C` is not checked against other Our Path shortcuts on a live App page; it only acts while the canvas wrapper holds focus, so a text field elsewhere cannot swallow it, but a future world-level shortcut could collide.
- Two-finger twist is implemented but was not exercised by a real touch device; the capture uses mouse gestures.
- The flat / no-WebGL fallback has no free roam by design. Its outline says so; a person who only ever sees the flat map never learns the feature exists.
- Not pushed, no PR, not merged, not deployed, not live verified.

## Handoff

`docs/AI_HANDOFF.md`, entry dated 2026-09-19.
