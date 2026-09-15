# The kitty banks in the rooms, and the house on one axis — evidence

Regenerated 2026-09-14 after the merge with the cellar bill rail and the glass pass (`docs/worksessions/2026-09-14-queen-house-merge.md`): the cellar floor now opens on the bill rail, the house rail is one slim pane of three marks with names on hover/focus at ≥720, and every chip is glass.

Chromium (SwiftShader), fictional Development books, the `composition=queen`
proof page with `?rooms=1`. **38 records** in `records.json`: 36 measurements
(3 floors × 4 widths × 3 paths) and 2 axe runs. Produced by
`test/queen-house-layout.mjs`, which is committed — the previous room proof was
not, and could not be re-run.

| Set | What it shows |
|---|---|
| `cellar-*` | Six kitty banks on the rail — the same bill cat every month, bean-bodied with round ears and a lid. June swelled, tilted and stepped out of the rail, with a dotted hole where its beat should have been. |
| `loft-*` | Two banks on the ledge: an open-mouthed goal (pear body, pointed ears, the brass slot open on her crown) and a lidded bill leaning away (bean body, round ears, a plate and a knob over the slot). |
| `home-*` | The hearth, with the house rail beside her. |
| `*-320x568 / 390x844 / 720x900 / 1100x800` | Every width. `overflowX` and `overflowY` are **0 in all 36**. |
| `*-flat` | `getContext` returns null — **no WebGL at all**. The drawn cat renders in place of the sculpture; `pots` is **0 in all 36**, on both paths. |
| `*-reduced` | `prefers-reduced-motion: reduce`. The rooms render, the dust never starts, and the house still travels — the gesture works, the house just does not slide under the hand. |

`money` is **false in all 36**: no figure appears on the ribbon or on the ledge.
Figures appear only once a bank is in hand. **0 page errors in all 36.** Axe
(wcag2a, wcag2aa, wcag21a, wcag21aa) on both rooms at 1100×800: **no violations**.

## What each record asserts

Beyond the table above, every one of the 36 asserted that the house is standing
on the floor the rail names, that the rail carries three stops with exactly one
marked `aria-current`, and that a room that should hold banks holds them
(`seats`: 13 in the cellar — twelve months and the outlier's ghost — 2 on the
ledge). Each of the twelve browsers then travelled the house three ways:

- **the rail**, clicking each floor;
- **the arrow keys**, climbing from the hearth to the loft, being refused at the
  ceiling, and descending past the hearth into the cellar;
- **a grab-and-haul with the mouse**, which is the gesture a finger makes: up
  from the field to the loft, and down again from inside the loft.

## Two things to read past

- **"Books need attention"** sits across the top of every screenshot. Local
  PGlite does not finish opening in this sandbox. It predates this change and is
  not caused by it, but it eats roughly a fifth of the shorter viewports.
- **Hercules' speech bubble** overlaps the rail and the room head at some
  widths. The App positions it; the house does not.

## What is not proved here

A swipe, by a thumb, on a phone. Every gesture above was made by a mouse or a
synthetic pointer event on a container CPU. That is the weakest claim in this
pass and it wants a device.

## Regenerated 2026-09-15 — the ledge's banks dressed

Same 38 records, 0 page errors, axe clean at 1100, after `cellar-bank-dress.patch`:
on the loft's ledge a goal plants a pennant beside her and a lidded thing wears
the postman's cap with an envelope on its paws (`queenBankDress.ts`), in the
sculpture and in the drawn twin; the cellar floor shows the dressed jars at the
rail's default scale.
