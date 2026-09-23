# Skate v2 · LOOK track notes

## API

```ts
import { createSkaterLook, poseFromLegacyAct } from '../skate/look/index.ts';
const look = createSkaterLook({ figure, deckId, tier, catalogs, theme, stance?, scale?, canvas? });
world.add(look.root);                       // root sits at identity in world space
look.update(present, events, dt, reduced);  // every frame while skating (events: SkateSimEvent[] | null)
look.setDeck(id); look.setStance(s | null); look.setTheme(t); look.setFigure(f); look.celebrate(0..1);
look.release();   // unmount: figure back to its old parent, straight hinges
look.dispose();   // also releases
```

- `catalogs`: `{ flips, grabs, grinds }` as records, maps or arrays of the contract defs (or a `LookDefs`
  lookup). Unknown ids fall back to built-in shapes in `catalogs.ts` (`FALLBACK_*`).
- While it holds the figure, the look **owns `figure.group`'s transform and calls `figure.pose`** itself.
  The walker must stop writing `figure.group.position`/`rotation` and must not call `figure.pose` while
  skating. `release()` restores the transform the figure had when it was adopted.
- `celebrate(strength)` is for banked lines (the look never sees `ScoreOutcome`).
- Partner/presence: `poseFromLegacyAct(act, p, out?, moving?)` turns the wire's `'skate-kickflip'` + progress
  into a `SkatePresent`; set `x,y,z,heading,boardYaw` on it and call `look.update(present, null, dt, reduced)`
  (`null` events = infer pops from take-offs). Use `scale` for the smaller partner.
- `createSkateboard(deckId, { tier, canvas })` keeps the v1 `group / setDeck / pose / dispose` API.

## Conventions the look assumes (integration: please verify against SIM)

- `present.x/y/z` is the board's rest-frame origin: on the ground (or the grindable's top line) midway
  between the wheel contacts. The rider's soles stand at `DECK_TOP` (0.11) above it — v1's walker put the
  figure at +0.13, so v1 riders float 0.02 over the new deck until integration.
- Ride frame = `Ry(boardYaw)·Rx(boardPitch)·Rz(boardRoll)` in three.js signs (rotation.x > 0 tips the nose
  down; v1 and `GrindDef.deckPitch` use the same sign). In bail/recover only `boardYaw` is used.
- Flip signs: `roll +` dips the toe edge first (kickflip), `yaw +` swings the tail to the heel side
  (backside shove-it), `pitch +` scoops the tail up over the back foot (impossible).
- `yawFlip` (integration 2026-09-23) is the physical board's yaw minus the sim's labelled `boardYaw`: when a
  trick ends it absorbs exactly what the overlay was showing, and every exact-π jump of `present.boardYaw`
  (the sim relabels nose/tail at a shove-it's catch and again when it canonicalises on landing) is cancelled.
  The drawn board turns once, continuously, and never snaps (`test/skate-int-look.test.ts`).
- Verified against the sim: `present.y` is the ground/rail-top origin, soles stand DECK_TOP above it (the walker
  no longer adds v1's +0.13); `'YXZ'` with pitch > 0 = nose down and roll > 0 = +x rail up agree.
- Grinds: the look overlays `GrindDef.deckYaw` relative to `heading` **only if** `boardYaw` has not already been
  turned that way (it picks the nearest of ±deckYaw, +π); it always overlays `deckPitch` about the contact
  truck, and lowers the board so the contact sits on `present.y`. `boardPitch` should be the rail's slope only.
- Powerslide: if SIM does not swing `boardYaw` off `heading`, the look swings the board ~75°.
- `switch` swaps which foot is at the nose; `fakie` only changes the head's look direction.

## Tuning (all in one place)

- `riderPose.ts` `STANCE` (feet from `boardRig.ts` `SHOE`: front z 0.2 angled 0.66 rad up the board, back z −0.205
  across the tail at 0.14; hips 0.855 of the straight leg and opened 0.62 rad toward the nose; knees turned in
  0.5 / 0.62; crouch 0.6, tuck 0.86), `PUSH` (plant at 0.12 of `pushPhase`, lift at 0.58, sweep z 0.12 → −0.34
  beside the toe edge, hips 0.8 → 0.62), and `STIFF` (spring ω per channel).
- `boardRig.ts` `RIG` (tail snap 0.42 rad; lift 0.11 from 0.03 s over 0.13 s, back down in the last 0.3 of
  clearance; flip turns over u 0.1..0.88 as a smoothstep, so it is fastest mid-air and square before the catch;
  soles ride `flipMargin` 0.02 above the highest part of the spinning board inside each shoe's footprint;
  get-up 0.9 s).
- `fx.ts` `FX_BUDGET` / `FX_PALETTE`.

## Wave 3 conventions (rider polish, 2026-09-23)

- **Board size**: 0.66 × 0.31, trucks at ±0.218 and wide (wheels to the rails). Heights unchanged: DECK_TOP 0.11,
  so every seat and the sim contract hold. Nothing outside `look/` reads `BOARD`.
- **Ankle yaw**: `SkateLimbPose.footYaw` (figure.ts skate hook only; walking/emotes still zero every ankle). The
  ankle is solved as a full orientation, so the shoe sits where the stance says while the knee points elsewhere.
- **Authored heads**: the playable avatars' faces are baked into the coat mesh, so `body-head` never showed.
  `headTwist.ts` gives the adopted surface its own material copy with a neck twist driven by the pose's head
  yaw/pitch; `release()` hands the original materials back (the walker and the partner never see the patch).
- **Get-up clock**: the sim's recover is 0.35 s and may respawn the rider at a safe spot ≥ 0.8 away. The board
  rig runs its own 0.9 s get-up (`BoardRigPose.getUp`) through the idle/roll that follows (×3 if they push off);
  on a respawn the board is laid grip-up beside the rider at the new spot, then stamped up onto the feet.
- **Grabs**: the chest stays up and the board is pulled to the hand (pull up to 0.24 up, 0.18 across, 0.2 along)
  so short arms (Bianca) still reach; the style tweak grows after 0.3 s of holding.

## Tiers

- **full**: 30×8 deck loft, lathed 14-segment wheels, grip texture with grain + cut-out (256×512), graphic
  256×512, brass bolts; FX pools 48 sparks / 64 flecks / 40 confetti / 28 chalk / 12 speed streaks.
- **lite**: 14×4 loft, 8-segment cylinder wheels, flat grip colour, graphic 128×256, no bolts; FX
  20 / 28 / 16 / 10 / 0 (no speed streaks).
- No DOM / no 2D context: flat colours, never throws.

## Wants a browser eye

The impossible's wrap (fake: board swings out to the toe side), smith/feeble roll direction vs the ledge face.
Judged in the Skate Lab in wave 3: stance, flips, push, grabs, bail/get-up, grinds (`test/skate-look-craft.test.ts`
pins the numbers).
