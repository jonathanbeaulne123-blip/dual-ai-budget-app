# Worksession — the Garden Queen: she becomes a cat, and the studio reaches all six of her parts

**Date** 2026-09-14 · **Branch** `claude/queen-garden-cat` · **Base** `origin/main@f046195` (#474)
**Risk** Medium-High · **Budget delta (5)** +0 · **Engagement delta (3)** +2

## What Jonathan asked for

> "I want her to have this terracotta pot texture. With long flowy hair with a
> flower crown. Her hair must have the white flowers on one side and red flowers
> on the others; they can interweave on the flower crown. She must have this
> Buddha garden cat energy to her. Make sure she is a cat. Make sure she can be
> painted in the kitty bank studio like the others."

Then, against the model study: **"perfect put her in the app."**

## What changed

- **She is a cat.** Ears with an inner fold, a muzzle and cheeks, a nose, six
  whiskers, front paws folded in her lap, a tail curled round her base — in the
  3D path and in the drawn path, both.
- **All six studio parts are paintable.** `QUEEN_PAINTABLE_PARTS` is now
  `KITTY_PARTS`: `body · head · earL · earR · tail · paws`, each with its own
  canvas → texture → `MeshPhysicalMaterial`, the same pipeline a bank is painted
  through, mirroring included.
- **Her clay is terracotta.** The unpainted Queen defaults to the `terracotta`
  glaze, and a deterministic mottle-and-splatter grain is composited over
  whatever the couple painted, so the fired-earthenware read sits under their
  work rather than replacing it. The flat path carries a fixed speckle to match.
- **Her hair is the mandevilla.** Fourteen strands falling from the crown at
  varying lengths, one colour a side, meeting only in the flower crown — which
  replaces the five gold points while keeping the gold band, the points and the
  light that comes up when both partners are here.
- **Her look tool offers the six parts.** A clay dip lands on all of her or on
  one named part.

## Decisions worth naming

- **The charm surface was not touched.** Her skirt profile and head constants
  are unchanged, so every charm seat, slide and flat pick still means what it
  meant. Charms stay on `body` and `head`; paint now reaches all six.
- **No reserved channel loosened.** The paws are paintable, but her *cupped
  hands* — the Move's seat — stay reserved clay, seated above and between them
  rather than under them. The flower crown's footprint is wider and lower than
  the gold ring was, so `QUEEN_CROWN_V` (0.66) now names where her face ends and
  the garland begins: nothing seats under it.
- **`QUEEN_HEIGHT` 4.6 → 3.75.** Her hair falls rather than reaches, so the old
  height framed empty air above her head. She fills her box as before.

## Verification

`tsc` clean. `pnpm test -- --risk=medium-high --focus=test/queen-world.test.ts`
→ `quick-gate-passed`, 9 files / 134 tests, 79.7 s of a 300 s budget, no breach.
Three new tests: the cat signals and the six materials; the cupped hands above
the paws under any paint; the mandevilla's two sides and the crown's interweave.

Browser evidence at 390 and 1100 in the 3D path and at 390 with `getContext`
returning null: `docs/evidence/queen-cat/`.

Tests whose meaning changed on purpose — she has ears, a tail and paws now, so
what used to be dropped is kept: the paintable-parts list, the sanitizer's kept
parts, mirroring, and the stamp rules for `earL` / `tail` / `paws`. Her
underside, the crown seat, the eyes and the impersonating stamp kinds are still
refused, each covered individually.

## Not verified / weakest

- No phone; SwiftShader only. Frame cost was not re-measured after the geometry
  grew (fourteen strands, six paint textures instead of two).
- The full `test/queen-world-layout.mjs` suite was not re-run end to end here.
- A thin olive line crosses her lower left in the 3D frames. It is on `main`
  too; it was not introduced and not chased.
- Shared authorship is still uncovered: `saveKittyNestDesign` saves on one
  member's word, and no consent rule was invented.

Local branch and patch only — not pushed, not a PR, not merged, not deployed,
not live verified.
