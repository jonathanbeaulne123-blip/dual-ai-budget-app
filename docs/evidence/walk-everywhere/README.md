# Walk everywhere — the character, indoors

The body shipped Court-only. Everywhere else W A S D fell through to a camera
pan that slid the look-at target while the stage's own label promised a walk.
These are photographs of the gap closed: the same character, on **each place's
own floor**, in three of the kinds of place it could not stand in.

Captured on the loopback review server (`scripts/serve-whole-house-review.mjs`,
fictional household, no hosted service) with
`scripts/capture-walk-everywhere.py`. SwiftShader draws every pixel on the CPU
in this container, so one screenshot takes the better part of a minute and the
walk carries on underneath it — every filename carries where the body had got
to, read from `data-body-at`, so the frames are labelled by the body and not by
the clock.

## What each sequence is

| Frames | Place | Route | Kind of ground | Key held | Walked |
| --- | --- | --- | --- | --- | --- |
| `cellar-1440-*`, `cellar-390-*` | The Cellar | `home / below` | an **unplaced room** — under the Court's own floor, flat at y = 0 | W | 1.88 / 1.88 units |
| `library-1440-*`, `library-390-*` | The Library | `study / middle` | a **placed room** — standing where the Court stood its hall, floor lifted to `placementLift` ≈ 0.287 | W | 1.88 / 2.00 units |
| `campfire-1440-*`, `campfire-390-*` | The Campfire | `making / below` | **outdoors** — the shore's swept apron over the island's own profile | D | 1.76 / 1.88 units |

`00-standing` is the place as it has always opened, with a person standing in
it and the Look camera still holding the view. `01`/`02-walking` are mid-stride
with the follow camera driving (`data-harbour-body` goes `standing` →
`following` on the first step). `03-stopped` is the key released.

Three GIFs — `cellar-1440.gif`, `library-1440.gif`, `campfire-1440.gif` — are
those four frames in order: a walk across a room, and a walk across the shore.

At the Campfire the key is **D**, not W: W is "away from the eye" in every
place, and at the fire that is straight into the ring of stones, which the ring
quite properly refuses. So the shore is walked across rather than into.

## The numbers, while walking

Read off the host element on painted frames (`walk-everywhere-report.json` has
every sample).

| Sequence | Tier | Body step | Render | Draw calls |
| --- | --- | --- | --- | --- |
| cellar 1440 | full | 0.087–0.129 ms | 23–38 ms | 93–116 |
| library 1440 | full | 0.062–0.108 ms | 16–25 ms | 146–197 |
| campfire 1440 | full | 0.045–0.112 ms | 18–31 ms | 49–61 |
| cellar 390 | lite | 0.069–0.082 ms | 15–26 ms | 48–53 |
| library 390 | lite | 0.052–0.127 ms | 13–24 ms | 113–162 |
| campfire 390 | lite | 0.066–0.080 ms | 13–23 ms | 32–52 |

One step of the walk costs about a tenth of a millisecond indoors — the same
order as it costs on the island. The rooms did not get more expensive; they got
a person in them.

## One capture-side workaround, and it is not the product's

The shell warms all eleven place chunks at idle
(`HarbourWorld.tsx`, "Warm the other places of the room"). On this box eleven
concurrent Vite **dev** module graphs never land, so the chunk the route
actually wants never arrives either and the runtime stays in the Court while
the React shell already says "the Cellar". Reproduced on unmodified
`origin/main` at 752257f2, so it predates this work: it is dev-server
saturation, not a product fault, and a built page has its chunks prebuilt.

The capture stubs `requestIdleCallback` so the warm pass never starts and the
route's own chunk is the only request in flight. Nothing else about the page is
changed, and every navigation in these captures still goes through the app's
own quick-sheet route event.
