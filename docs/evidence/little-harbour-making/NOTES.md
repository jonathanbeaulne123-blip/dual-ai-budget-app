# Little Harbour — the Making lawn, both buildings

Captured on `claude/harbour-making` against the fictional loopback review
server (`scripts/serve-whole-house-review.mjs`, no hosted services, no `.env`):

    node scripts/serve-whole-house-review.mjs &
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
      python3 scripts/capture-little-harbour-evidence.py \
      docs/evidence/little-harbour-making --quick --fictional
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
      python3 scripts/capture-little-harbour-evidence.py \
      docs/evidence/little-harbour-making --slice2 --quick --fictional

What the frames show:

* `classic-390-01-court.png`, `classic-1440-01-court.png`,
  `classic-1440-02-court-focus.png` — the island with **both** Making
  buildings standing: Hercules's Cottage on the east lawn at (9.8, 5.6) and
  the Kiln on the Making lawn at (10.6, -4.4). Nothing overlaps.
* `classic-390-18-cottage.png`, `classic-390-19-cottage-door-sheet.png` —
  the Cottage as a room (`making/middle`), and a station's door sheet.
* `classic-390-20-kiln.png` — the Kiln as a room (`making/above`).
* `classic-390-15-boathouse.png` — the Boathouse, unchanged, still the whole
  of `together`.

Measured runtime draw calls on the `classic-390` slice-2 pass:

    court 159  tower 36  cellar 37  kitchen 37  boathouse 26
    library 40  cottage 38  kiln 34

(The unit budget in `test/harbour-dressing.test.ts` measures the Court group
alone, in `lite`, under jsdom; that number is 90.)

Known gaps in this run, neither a product fault:

* The `classic-1440` slice-2 pass was cut short — software WebGL at 1440 in
  this container renders a desktop court slowly enough that the pass did not
  finish, so only the 390 room frames and the 1440 court frames are here.
  `report.json` is written only at the end of a complete run, so there is
  none.
* The Kiln's door-sheet leg logged a selector timeout at 390: the wheel twin
  was found and clicked, but `.app[data-harbour-door]` did not appear inside
  20s under load. The room itself drew and measured. The same run logged
  three sibling timing flakes ("no bank twin in the tower", "no jar twin in
  the cellar", "no pot twin in the glasshouse") that are unrelated to this
  work.
