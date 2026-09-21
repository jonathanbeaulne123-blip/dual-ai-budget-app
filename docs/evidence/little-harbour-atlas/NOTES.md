# Little Harbour — the Atlas, up the kitchen stair

Captured on `claude/harbour-atlas` (on top of `claude/harbour-making`) against
the fictional loopback review server (`scripts/serve-whole-house-review.mjs`,
no hosted services, no `.env`), on the free default port 4186 — the script was
not edited for a port:

    node scripts/serve-whole-house-review.mjs &
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
      python3 scripts/capture-little-harbour-evidence.py \
      docs/evidence/little-harbour-atlas --quick --fictional --slice2 --theme=classic

What the frames show:

* `classic-390-22-atlas.png`, `classic-1440-22-atlas.png` — the room itself.
  The oak atlas stand under its hanging lamp with the household's own island
  on it: the sea ring, the sand collar at the waterline, the earth narrowing
  away beneath it and the turf crowning the whole of it. The era plaque on its
  brass easel, turned to the door and carved in two lines — this review house
  has never opened the Journey, so it reads **"No era yet / The island is
  waiting to be named"**, which is a state and not a fault. The dormer looks
  out over the harbour to the real island. On the far table, the next era
  under its own weather with the card **"Across the bridge / Unplanned"**.
  With no era running there is no roof on the crown, no gate, no month stones
  and no plank across — the room says exactly as much as the journey does.
* `classic-390-23-atlas-door-sheet.png`,
  `classic-1440-23-atlas-door-sheet.png` — the island tapped. The real Our
  Path world opens as the surface in front ("Where we are going", the stepping
  stones, Day · Week · Month · Era · Journey), the room becomes the band above
  it, and **"Put it back"** comes back into the Atlas. That is the whole
  contract of this room: it is a map, and its objects are doors.
* Every other frame is the rest of the island and its rooms on this branch,
  unchanged — the Court, the Tower, the Cellar and its rail, the Glasshouse,
  the Kitchen, the Boathouse, the Library, the Cottage, the Kiln, the two
  mid-travel frames and the two reading editions.

Measured runtime draw calls for the Atlas: **31 at 390**, **42 at 1440**. The
room's own group is 38 meshes with an era running, six of them instanced runs
(the month stones, the lit and unlit lanterns, the trees, the rafters, the
floor joints) — well inside the harbour's 120-mesh budget, which
`test/harbour-rooms.test.ts` asserts with the ring and the gate both over
their caps.

Two gaps, both pre-existing and both named by the run itself:

* `no bank twin in the tower`, `no jar twin in the cellar`, `no pot twin in
  the glasshouse` — the fictional review household has no goal banks, no bill
  jars and no tasks, so those three rooms have nothing of that name to tap.
  Nothing to do with this branch; the same three lines are in the Making run's
  report.
* The review household has no eras either, so the Atlas is captured in its
  **empty** state. The era's roof, the ring of month stones, the gate with its
  lanterns and the plank across the bridge are covered by the truth table in
  `test/harbour-rooms.test.ts` rather than by a frame. A habitat with a
  journey on it would show them.
