# Worksession — the kitty banks come into the rooms, and the house gets one axis

**Date** 2026-09-14 · **Branch** `claude/queen-house` · **Base** `claude/queen-rooms`
(which is `origin/main@1395b04` + the rooms patch) · **Risk** Medium-High (UI and
navigation across the whole shared home; no money, no synced-row shape change) ·
**Budget delta (5)** +0 · **Engagement delta (3)** +3

## What Jonathan asked for

> "port over the kitty bank models in the to replace the ceramic pots we have as
> placeholders. also i want
>
> also incorporate the navigation and ux changes from this artifact. mobile
> should have swipe up and swipe down functionality. desktop should also have a
> 'grab and drag' to navigate to the loft and the cellar. the arrow keys should
> also work as well for both vertical and horizontal navigation."

with the *Cellar and Loft* artifact as the brief. **His second sentence is cut
off mid-thought** — "also i want" names nothing. Three things were built; the
fourth is still his to finish.

## What changed

### The banks are cats now

- **`queenBankSculpture.ts`** (new) builds a bank from the Kitty Bank Studio's
  own silhouette: `kittyBodyPoints` for the thrown body, `KITTY_HEAD_SCALE` and
  `KITTY_HEAD_R` for the head, and the brass slot the studio fires on the crown.
  The form a bank takes is the **tier it already had in the nest**
  (`nestDefaultPiece`): a bill is the bean-bodied round-eared cat with no tail,
  a goal is Build's pear-bodied cat with its tail wrapped round its foot, and a
  month on the cellar's rail is the same bill cat every month.
- It is **not** the studio sculpture. That one carries six paintable canvases, a
  raycast surface, a hinge and a compartment because a person is painting it. A
  bank on a ledge is looked at, so this shares geometry per form and uses plain
  materials: a room of a dozen banks is a dozen draws.
- **`QueenBankFlat.tsx`** (new) traces the *same points* into a path, so the
  drawn path — forced colours, no WebGL, a lost context — keeps the cat instead
  of falling back to a pot. Same pattern as `QueenSceneryFlat` for the worlds.
- Both keep the two opposite rules physical: **an open slot accepts**, **a lid
  refuses**.

### The house has one axis, and up goes up

- **`queenHouse.ts`** (new, pure) is the whole model: three floors stacked
  loft · hearth · cellar, `houseStep` clamped at both ends, `houseSwipe` reading
  a finished drag, and `houseOwnsEvent` deciding when something nearer the
  pointer has first claim. No React, no DOM, no money.
- **`useHouseAxis.ts`** (new) listens: a finger swipe, a mouse grab-and-haul, and
  ArrowUp/ArrowDown. All three mean the same thing. While a haul is live the
  house follows the hand, and **a stair that leads nowhere resists** — the loft's
  ceiling and the cellar's floor are things you can feel.
- **`QueenHouseRail.tsx`** (new) is the artifact's minimap: three real buttons,
  one per floor, `aria-current` on the one you are standing on. The gesture is
  never the only way in.
- **Horizontal stays the room's**: the cellar's ribbon runs through time, the
  loft's ledge through order, and Home now runs ArrowLeft/ArrowRight across her
  three banks.

## Decisions worth naming

- **Up goes up, everywhere.** No gesture means "move the camera the other way".
  A person who has to work out which thing moved has already lost the spatial
  memory the direction was for.
- **The axes separate the gestures; almost nothing has to claim anything.** The
  ribbon and the ledge both now refuse a drag that leans vertical, and the house
  refuses one that leans horizontal, so up and down stay the house's *even over
  a ledge that fills a phone*. `data-house-hold` is left for the two real
  exceptions: form controls, and her.
- **She keeps her pull down and lets the climb up through.** Pulling her down is
  her documented gesture (it is in her `aria-label`), so `data-house-hold="down"`
  keeps only that direction. Pushing up past her reaches the loft, which is the
  most natural phone gesture there is and would otherwise have been dead.
  *Trade:* reaching the cellar by swipe from the phone means starting the drag
  off her — the rail, a door, or ArrowDown all still do it in one action.
- **The seat is the drawing, not the drawing and its name.** The loft's
  `data-room-vessel` moved onto a span around the flat cat; it used to sit on the
  whole button, so the sculpture was seated a label's height too low. The pots
  hid it; the cats did not.
- **Shelves end behind the banks.** The cellar rail and the loft ledge ran
  toward the lens past z = 0, and a slab seen from slightly above draws its top
  surface over the feet of whatever stands on it. Both now stop behind.

## Verification

`tsc` clean. `test/queen-house.test.ts` (9) — the pure axis, the bank metrics,
and the house driven in the App: the rail, the arrow keys, a haul, and the
controls that already answered an arrow being left alone. Existing suites green:
`queen-rooms` (6), `queens-nest-ui` (23), `queens-nest` (21), `queen-world` (17),
`queen-scenery` (8), `queen-charms` (14), `queen-ceremony` (18).

`test/queen-house-layout.mjs` (new, committed — the previous room proof was never
checked in) drives the **actual App page** at 320×568, 390×844, 720×900 and
1100×800, on the 3D path, with `getContext` returning null, and under reduced
motion: every floor, `overflowX`/`overflowY` 0, no figure on the ribbon or the
ledge, no pot left anywhere, and the keyboard and the haul both reaching the
loft and coming back. Axe (wcag2a/aa, wcag21a/aa) on both rooms at 1100.

`scripts/serve-queen-world-page-proof.mjs` gained `?rooms=1`: the proof household
had no Build banks at all (its goal names fell to *everyday*) and no posted months,
so the loft was bare and the ribbon empty. Opt-in, so no other proof moves.

## Known, not fixed

- The proof page shows **"Books need attention"** in this sandbox — local PGlite
  does not finish opening here. It predates this change and eats the top of every
  screenshot.
- Hercules' speech bubble overlaps the rail and the room head at some widths.
  App chrome, positioned by the App, not by the house.
- **No measurement on a real phone.** Swipe is proven with synthetic pointer
  events and a mouse haul, not with a thumb.

## Next

Jonathan to finish "also i want". Then: a phone pass on the swipe, and whether
the cellar deserves the same by-swipe reach from Home that the loft now has.
