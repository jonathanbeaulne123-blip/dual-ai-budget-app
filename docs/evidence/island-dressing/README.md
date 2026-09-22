# Island dressing — the clearings, and the doors

Two visible defects on the Court's island, both found by the lane that stood
the buildings in real positions (PR #520). Captured against
`scripts/serve-whole-house-review.mjs` (loopback, fictional household,
SwiftShader), `prefers-reduced-motion: reduce`, classic theme, at 1440×900 and
390×844. `before-*` is unmodified `origin/main` @ `752257f2` in its own
worktree; `after-*` is `claude/island-dressing`. **Same camera, same seed,
same household on both sides** — every pair differs only by the two fixes.

## Defect 1 — trees grew through the buildings

`scene/ground.ts` sowed its tree ring at radius 13–15.4 and its shrubs at
10.6–12.4 from a fixed LCG (`seed = 0x7a11`, four draws per plant). The
buildings' shells stand at radius 11.3–12.8 and the **placed interiors** —
about four times their shell — reach out to 16.5. Nothing told the planting
they were there, so two conifers stood inside the Kiln and two inside the
Library's hall.

`scene/planting.ts` is new and is now the only place a plant's position is
decided. It carries a keep-out list — each shell's footprint, each placed
interior's rotated footprint, and a doorway for every one of them — and a
plant whose draw lands in a clearing keeps its drawn radius, size and spin and
**steps sideways along the ring** until it finds open ground. Nothing is
dropped, so the counts do not change:

| | trees (full) | trees (lite) | shrubs |
|---|---|---|---|
| before | 18 | 14 | 16 |
| after | **18** | **14** | **16** |
| in a building before (canopy) | 6 | 3 | 8 / 7 |
| in a building after | **0** | **0** | **0** |
| unchanged, bit for bit | 10 of 18 | 10 of 14 | 8 of 16 |

The plants that moved are the ones that were standing in a wall, plus two
(full) and one (lite) displaced by their sliding neighbour. Nearest-neighbour
spacing goes from 3.62 to 1.90 units at full and 4.82 to 1.81 at lite — closer,
because plants bunch at a clearing's edge, but never interpenetrating: a plant
may not land inside another's canopy.

**Renderer and collision now read one plan.** `body/obstacles.ts` used to
replant the ring from a hand-kept copy of the same loop; its whole change is
one import and a two-line `treeRingObstacles`. `planting.ts` imports nothing
at all, so `obstacles.ts` stays free of three.js and there is no import cycle.

## Defect 2 — four doors faced the sea

The Library, the Kitchen's cottage, the Kiln and the Boathouse were yawed with
`atan2(-x, -z) + π`. A shell's door is modelled on its +z face and
`atan2(-x, -z)` is the yaw that turns +z toward the origin, so the `+ π` turned
all four doors **away** from the Court — while two of the comments beside them
said "face the door toward the Court" and only Hercules's Cottage actually did.
The door signs (`plate.mesh.rotation.y = Math.atan2(-x, -z)`) were already
right, which is how it reads from the terrace: the sign faces you and the door
is round the back.

`PLACE_PLACEMENTS` (`scene/place.ts`) copies these expressions verbatim, so the
Library's and the Kiln's placements lose the `+ π` with them. Half a turn
leaves a rectangle where it was, so **no footprint moved**; what moved is each
room's door and what stands at each end of it:

| | door before | door after | interior footprint |
|---|---|---|---|
| library | (−7.55, −13.84), island r 15.77 | **(−1.85, −9.36), r 9.54** | unchanged |
| kiln | (12.46, −7.28), r 14.43 | **(8.74, −1.52), r 8.87** | unchanged |
| cottage | (6.80, 5.90), r 9.01 | (6.80, 5.90), r 9.01 | unchanged |

All three doorways now sit at island radius 8.9–9.5, beside the Cottage's,
which was always correct — and on the terrace's own edge, which is where you
walk up to them from. Neither new doorway lands inside another building's
footprint.

**The Library / Glasshouse overlap is unchanged: 2.17 u² before and after.**
The Library's room spans island radius 9.12→16.51 either way, because a
rectangle turned by π occupies exactly the same ground. The yaw fix neither
improves nor worsens the interiors-are-4×-their-shells decision the product
owner holds open; nothing here was scaled.

The Campfire keeps its `+ π`. It has no door, and its path of months is meant
to run away from the Court toward the water.

## The stills

Every name exists as `before-` and `after-`, at `1440` and `390`.

- `00-island-above` — from over the gate, looking down the island. Before:
  five blank walls. After: five amber doors and lit windows turned inward, and
  a clearing round each building in the tree ring.
- `01-kiln-shell` — the Kiln from the Court side, interiors let go. Before: a
  blank wall, the bottle kiln's throat pointing at you, and a conifer standing
  against the roofline. After: the door and the firemouth's glow facing you,
  and the ground behind the building clear.
- `02-kiln-room` — the same spot with the Kiln's interior resident, which is
  the footprint the conifers were inside.
- `03-south-lawn` — the Library, the Glasshouse and the Boathouse together.
  Before: the Library's blank east wall with a conifer against it. After: the
  Library's tall door and the Boathouse's, both facing the Court, with the
  trees gathered in the open ground between them.
- `04-kitchen-cottage` — the Kitchen's cottage on the west lawn, its lit
  window and door turned to the Court.

`before-report.json` / `after-report.json` carry each frame's camera pose,
which interiors were resident, the draw-call count and any console errors
(none beyond SwiftShader's own ReadPixels notes and the review server's
websocket chatter).

## Checks

`pnpm typecheck` clean. `npx vitest run test/harbour-*.test.ts
test/world-*.test.ts test/house-*.test.ts --maxWorkers=1` — 38 files, 546
tests, all passing, including `harbour-body.test.ts`'s existing
tree-ring-versus-`InstancedMesh` test, `harbour-world-space.test.ts`'s
placement-versus-`CourtScene.ts` regex test, and the new
`harbour-island-dressing.test.ts` (13 tests). `vite build` passes.
