# SIM track notes: the skate simulation

The sim is pure and deterministic. It reads `SkateIntent` and a `SkateField`, runs fixed `SKATE_DT` substeps, and writes `SkatePresent` plus a list of `SkateSimEvent`s. It does not import three.js, the DOM, a clock or `Math.random`.

## API (`sim/index.ts`)

```ts
createSkateSim(field, { flips, grinds, grabs }, { x, z, yaw, stance, reducedAssist?, islandObstacles?, extraSolids?, shore? }) → {
  step(intent, dt) → { present, events }   // dt is clamped to at most 0.1 s; NaN or ≤0 simulates nothing
  present(); reset(x, z, yaw); setStance(s); save(); load(saved); setMarker(); toMarker();
}
```

- **Live objects:** `present` and the `events` array are reused on every step, so copy them if you need to keep a frame. The event objects themselves are new.
- **One-shots** (`pop`, `lateFlip`, `revert`) fire on the first substep of the `step()` call. When a frame above 120 fps runs no substep, they wait for the next one. `respawn` and `marker` apply immediately. A pop pressed in the air is held for 0.1 s and fires on touchdown. A pop up to 0.09 s after rolling off an edge or a lip still counts.
- **Checkpoints:** `save()` is a `structuredClone` of plain data, and it includes pending one-shots. `load()` ignores garbage and restores the ride exactly, as the tests check.
- **Wiring:** integration passes `islandObstacles` (for example `courtObstacles(tier)`), `extraSolids` (the park's dressing, `world/dressingSolids.ts`) and `shore` (for example `holdAshore`). `extraSolids` are height-aware like `field.solids` but **soft**: running into one absorbs the speed into it and keeps `SOFT_BUMP_KEEP` (0.8) of the rest, never a wall bail and never a wallride (a hedge at the end of a line stops you; a planter or a building at > `WALL_BAIL_SPEED` still bails). `sim/fields.ts` holds analytic reference fields for tests and for PARK. `sim/testKit.ts` holds the reference catalog, the `ride()` driver and a seeded RNG.

## Conventions

- **Yaw:** increasing yaw is counter-clockwise seen from above.
- **Board angles:** `boardPitch` and `boardRoll` are three.js Euler `'YXZ'` angles for a deck whose nose points along +z. `pitch > 0` means the nose is **down**, so a 5-0 is negative, matching `GrindDef`. `roll > 0` means the deck's local +x edge (its left) is up.
- **`spinDeg`:** frontside is positive. For a regular rider rolling forward, counter-clockwise seen from above is frontside. Goofy mirrors this, and so does riding with the non-natural foot leading (fakie or switch).
- **Stance model:** `lead` says whether the nose or the tail leads the travel. `feetSwapped` says whether the natural front foot is on the tail. Fakie is tail leading with normal feet. Switch is nose leading with swapped feet. "Swapped and tail leading" is folded back into regular riding, which flips `boardYaw` by exactly π. The deck is symmetric, so draw nose and tail modulo π.
  - Landing a 180 gives fakie.
  - Rolling back down a wall flips fakie and regular.
  - A shove-it from regular lands regular. A shove-it from fakie lands switch.
- **`carve`:** positive is the toe edge, negative the heel edge, in the rider's stance.
- **`lean`:** positive is weight on the rider's front foot.
- **`balance`:** in a grind, positive means tipping to the right of travel, and the player steers left to correct. In a manual, positive means looping out the back, which bails. Going below −1 just puts the wheels down.
- **`present.trick`:** only set while the board is flipping, with u in [0, 1). A caught shove-it's half turns are already in `boardYaw`, so do not apply the overlay after the catch.
- **`present.grind`:** also covers the non-catalog ids `'rock-to-fakie'`, `'axle-stall'` and `'wallride'`. For wallrides, `faceSign` is the side the wall is on. For grinds, `faceSign` is +1 when the side the rider came from is on the right of travel.

## Grind selection (TRICKS catalog, please match this)

The rider's approach is measured in the **rider's frame**, where "nose" means the end under the front foot. The sim picks the nearest `GrindDef` by contact, `deckYaw` and `deckPitch`.

- **Truck grinds:** the deck is within about 40° of the line. With lean at 0 the contact is `both-trucks`. Leaning on the tail (below −.35) gives `back-truck`, and leaning on the nose (above +.35) gives `front-truck`.
- **Slides:** beyond about 40° the contact is `deck`, `tail` or `nose`, chosen by the same lean thresholds.
- **Signed `deckYaw`:** a positive value means the nose is on the far side, away from where the rider came from; negative, the near side. The TRICKS catalog is authoritative for which trick is which side (integration 2026-09-23): boardslide +π/2 / lipslide −π/2, feeble +.38 / smith −.38, overcrook +.38 / crooked −.38 (a crooked grind's nose pinches down the near edge), salad +.3 / suski −.3.
- **Dead zone:** angles within about 11° of the line count as parallel.
- **Unsigned catalogs:** if the catalog has no negative `deckYaw`, ids matching `lip|smith|overcrook|noseslide` are read as negative.
- **Where it lives:** the pure `selectGrind()` is exported for scoring previews.
- **Integration (2026-09-23):** the game injects TRICKS' `resolveGrind` as `catalogs.resolveGrind`; the sim hands it `{deckYawToLine: axis·over, lean, overLine, faceSide: 0, frontside, push}` and uses the id it returns (falls back to `selectGrind` when absent or unknown). Feel pass: `push` = the left stick sideways at contact toward the far side, in the front-foot end's terms at take-off (`airFF`); the stick picks the grind (NOTES-tricks.md "Grinds"). `overLine` = the board's centre had already crossed the line by > 6 cm on the substep it locked (popped over it) → noseblunt/bluntslide. All 15 catalog grinds are reachable on real park rails and ledges (`test/skate-int-grinds.test.ts`).
- **`grind-start.frontside`** (approved contract amendment): the rider's chest faced the grindable on the way in. The chest looks to the right of travel when `footSign()` is +1 (regular, natural foot leading); the grindable lies on the far side (−near). Transfers keep the first lock's value.

## Event ordering

The events of one step come in sim order:

- **Pop out of a grind:** `grind-end(exit: 'ollie')`, then `pop`.
- **Touchdown:** `grab-end`, then `flip-caught` if the flip was caught late, then `land`, then `revert` (a buffered revert), then `manual-start` (if manual is held).
- **Bail:** `grind-end('bail')`, `manual-end`, `powerslide` and `grab-end` come first, then `bail`. `BAIL_TIME` (0.8 s) later comes `recovered`; `RECOVER_TIME` (0.48 s) after that the rider is back in control.
- **Powerslide:** the `powerslide` event is emitted on **exit**, with `seconds`. If the board came round past about 110°, `revert` follows.
- **Grindables joined end to end:** `grind-end('transfer')`, then `grind-start`, with the same def. Popping from one rail onto another reads as `grind-end('ollie')` followed by a `grind-start` while still airborne.
- **Leaving a manual pad:** `manual-end`, then (air), then `land`, then `manual-start` again if manual is still held.
- **Wallride:** the `wallride` event, with `seconds`, is emitted when you leave the wall.
- **Stalls:** `lip-trick` is emitted when the stall starts.
- **Silent landings:** `land` is only emitted for popped airs, lip launches, airs of at least 0.15 s, and spins over 17°. Rolling off a curb or bumping down stairs is silent.

## What PARK should give the sim

- **Lip strips:** a strip is the last ~0.1 of the transition **surface** (arc length), not 0.1 of horizontal distance. The sim rides the strip to its outer edge and launches as it leaves.
- **`vert`:** use `vert: true` on every quarterpipe, mini-ramp and bowl coping. Use `false` on kickers, banks and table edges.
- **Walls:** a rise of more than 0.06 beyond what the slope predicts is treated as a wall.
- **Solids:** a solid only blocks below its `top`. If people can ride on top of it, the field must also report that top as surface.
- **Grindable polylines:** these are the top line, and the board's contact point sits on them (`present.y`). For coping, the sim finds the transition side by sampling the field, so `faceYaw` is optional there.

## Tuning (`sim/tuning.ts`, one commented table)

These values set the feel. At the current settings (feel pass, wave 3 — every changed constant carries its reason in `tuning.ts`):

- **Speed:** gravity is 14. Pushing tops out around 6.5 u/s (0→5 in 2 s; each stroke a surge of ~1.6 u/s), sprinting around 8, and the hard cap is 15. Paths ride like concrete; cobbles are felt (cruise 6.2, 0→5 in 2.5 s); grass and sand are a crawl you can escape.
- **Ollies:** 0.16–0.56 high. A standard pop reaches about 0.39. A pop while already rising adds its height to the launch's (`POP_ON_RISE`): Hatch airs 0.9–1.4 above the lip at 7–9 u/s.
- **Spins:** held stick spins, a centred stick stops them (`SPIN_DAMP` 5) and, after a spin, squares the board up to the nearest landing line (`SPIN_SETTLE_*`). A 180 lands from a 0.17–0.37 s hold off a flat ollie; a 360 off the Hatch at 8–9 u/s; a 540 needs a vert air.
- **Pumping:** `PUMP_GAIN` 2.2 and `PUMP_VREF` 2.8. On the Breadbin (0.85) a good pumper clears the coping by the 3rd wall and levels off ~1.1 above it; a sloppy one (~170 ms late, 70 % depth) ~0.6. It stays centred (0.003 per wall) for as long as you like.
- **Catches:** late window `CATCH_WINDOW` 0.2 × (1 − 0.7·difficulty): a kickflip may touch down at 84 % of its flip, a triple needs 92 %.
- **Landing thresholds:** clean up to 25°, sketchy to 50°, and a hard impact at 7.6 u/s along the normal (11.5 when crouched).
- **Balance:** manuals tip faster the longer you hold (`MANUAL_TIP_GROWTH`); grinds drift gently when easy and fast when hard (`GRIND_TIP`/`_DIFF`/`_GROWTH`). A person reacting in ~0.2 s holds a manual 5–10 s and a 50-50 to the end of a long rail.
- **Bails:** 0.8 s down (tumble, then lie briefly), 0.48 s to get up (integration: agrees with the look's 0.6 s get-up, control returns as the board is stamped under the feet).
- **Get up where you fell (integration, wave 3).** `recover()` first tries the bail spot: the board's footprint (centre and four points at `RADIUS`) must be flat (`GET_UP_MIN_NY` 0.93, no lip, no step over `GET_UP_STEP` 0.06), clear of solids and island obstacles (`RADIUS + 0.05`), not under/inside a rail, ledge or coping line standing more than 0.06 over it, and ashore (and a water bail never stays). If so the rider gets up there, keeping the board's heading (turned away after a wall bail), and `recovered.moved` is `false`. Otherwise the rider goes to the newest safe pose ≥ 0.8 away (then marker, then spawn) and `recovered.moved` is `true`: the camera cuts and the look lays the board at the new spot only then.

## Integration changes (2026-09-23)

- **Wheel grip.** The board's rolling axis is a tangent vector that turns with the carve. Feel pass (wave 3) replaced the 2.2 u/s switch (full grip below, free follow-travel above) with one model: the tyres cancel up to `LATERAL_GRIP` (1.5 u/s², fading out by 3) of sideways slip, so a pad's drainage fall no longer walks a pumping rider off the Breadbin (0.35 → 0.003 per wall); the rest steers the board toward the fall line (turn rate = sideways accel ÷ speed, as a tilted deck's trucks do) but never tighter than `SELF_STEER_RADIUS` (0.9), so slow at a wall's peak the board keeps its line and rolls back fakie, and at speed an angled line carves round as before. No heading jumps through a transition (≤ 3°/frame on the Hob at 0–60°, 3.5–8 u/s). The axis is re-seated keeping its heading in plan on gentle ground (a sheared pad must not bend a straight line) and by 3D projection on steep faces.
- **Vert airs (feel pass).** A square-on launch keeps only `VERT_CARRY` (0.1) of its along-coping speed and squares the board to the wall, so it comes straight back in; a line aimed across the wall (> ~12°) or carved keeps it all, and with the stick centred the board turns (`VERT_ALIGN_RATE`, not counted as spin) to meet the line it comes back down, landing fakie instead of bailing 40–80° across.
- **Pop on a rise (feel pass).** A pop while already rising (kicker/bank lip, coyote after a launch) adds `POP_ON_RISE` × its height to the launch height instead of stacking velocities: Hatch airs at 7–9 u/s are 0.9–1.4 above the lip (were 1.6–2.5).
- **Vert.** No auto-lock onto anything from a vert air unless grind assist is held (the Chimney used to catch its own coping on re-entry). A vert launch carries the board's UNROLLED heading (its Euler yaw on a near-vert face amplifies a few degrees off the fall line into tens), and the landing is judged in the unrolled landing plane. Result on the real park: Chimney air ~1.2 above the coping, back into the transition clean, fakie.
- **testKit `kick()`** now turns the board with a kicked velocity (keeping which end leads), since the wheels only roll along the board.

## Known gaps

- **No interpolation:** there is none between substeps, so a 144 Hz renderer sees 120 Hz motion. Interpolate in the renderer if needed.
- **Heightfield only:** there are no overhangs or full pipes.
- **Wallride surfaces:** wallrides only work on island obstacles, park solids and field steps more than 0.6 tall.
- **Grinds:** the grind def is fixed once locked, so there is no mid-grind switching. A spin into a grind isn't reported, because `grind-start` has no field for it.
- **Nose/tail relabel:** after a switch revert or a shove-it, `boardYaw` can jump by exactly π.
