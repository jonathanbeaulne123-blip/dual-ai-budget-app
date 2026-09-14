# The three worlds shared Home opens into — evidence

Chromium (SwiftShader), fictional Development books, the `composition=queen`
proof page with `chrome=1` and `motion=1`. 21 records in `records.json`,
frame cost in `frames.json`.

| Set | What it shows |
|---|---|
| `lover-*` | Taylor's shared home: the cotton-candy cloud world. |
| `row-*` | Newfoundland's shared home: Jellybean Row above the harbour. |
| `office-*` | Classic Hearth's shared home: the home office, plants and coffee. |
| `*-320x568 / 390x844 / 720x900 / 1100x800` | Every width. `overflowX` and `overflowY` are **0 in all 21 records**. |
| `*-flat` | `getContext` returns null — **no WebGL at all**. The drawn world renders in its place. |
| `*-reduced` | `prefers-reduced-motion: reduce`. The world still renders; `ambient` is `false` and the clock is never started. |

0 page errors in all 21. `flatHidden` is `true` in every live-canvas record and
`false` in every no-WebGL record: exactly one world is ever on screen.

## Frame cost (`frames.json`)

SwiftShader on a container CPU — an upper bound, not a phone. Steady frames
**3.4–9.9 ms** across all three worlds at 1100×800 and 390×844. The first frame
is 1.5–2.6 s of shader compilation, unchanged from before this work. Scenery
geometry: clouds 3, office 13, row 18 — every world shares its geometry across
instances rather than building one per object.

`ambient` reads `true` only with motion welcome and `prefers-reduced-motion`
unset; it is `false` under reduced motion and `false` with the atmosphere
paused, in all three worlds.

## One thing observed and not chased

`.queen-home[data-world]` reports `flat` while `.queen-world[data-live]` reports
`true`. This is on `main` as well — the probe was run against an unmodified
checkout and reproduces there — so the root's flat/3D mirror never flips and the
drawn *figure* stays visible under a live canvas. It is not introduced here and
was not fixed here. The drawn *world* does not depend on it: it yields to
`.queen-world[data-live="true"]` directly.
