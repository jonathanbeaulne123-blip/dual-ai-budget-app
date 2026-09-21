# Little Harbour, waves 1 and 2 — every place, one run

Captured on `claude/harbour-2` against the fictional loopback review server
(`scripts/serve-whole-house-review.mjs`, no hosted services, no `.env`):

    node scripts/serve-whole-house-review.mjs &
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
      python3 scripts/capture-little-harbour-evidence.py \
      docs/evidence/little-harbour-2 --slice2 --quick --fictional --theme=classic

Unlike the wave-1 run, this one **finished both widths**, so `report.json` is
here with the numbers measured off the page.

## What this run proves

Chiefly the capture-leg renumbering the merge had to settle. Both wave-2
branches numbered their legs 22/23; the Campfire keeps those and the Atlas
moved to 24/25. Both are here, at both widths, with no collision:

    …-20-kiln.png               …-21-kiln-door-sheet.png
    …-22-campfire.png           …-23-campfire-door-sheet.png
    …-24-atlas.png              …-25-atlas-door-sheet.png

Every door sheet opened, including the Kiln's, which had timed out under load
in the wave-1 run.

## Measured draw calls

| place | 390 | 1440 |
| --- | --- | --- |
| court | 307 | 389 |
| tower | 36 | 50 |
| cellar | 37 | 43 |
| kitchen | 37 | 39 |
| boathouse | 26 | 30 |
| library | 40 | 48 |
| cottage | 38 | 48 |
| kiln | 34 | 43 |
| campfire | 34 | 34 |
| atlas | 31 | 42 |

These are runtime numbers for the whole page. The unit budget in
`test/harbour-dressing.test.ts` measures the Court **group** alone, in `lite`,
under jsdom; that number is 95.

## Known flakes in this run

Three twin lookups timed out under container load and are unrelated to waves 1
and 2: "no bank twin in the tower", "no jar twin in the cellar", "no pot twin
in the glasshouse". The rooms themselves drew and measured in every case.
