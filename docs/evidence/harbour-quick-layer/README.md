# Little Harbour · the quick layer and camera polish (W5 + W7)

Captured against the fictional loopback review house — `node scripts/serve-whole-house-review.mjs`,
then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-little-harbour-evidence.py
docs/evidence/harbour-quick-layer --quick --fictional --slice2`. Nothing here touches a hosted
service, and the household is invented. Stills are taken with `prefers-reduced-motion`, so the
camera cuts and nothing breathes; SwiftShader draws the WebGL.

Two widths: **390** (a phone) and **1440** (a desktop), classic theme.

## What to look at first

| Frame | What it shows |
| --- | --- |
| `*-26-door-signs.png` | The whole island from the gate: a sign standing on the path in front of every building. |
| `*-26b-sign-on-the-path.png` | Walked up to the Library and the Glasshouse — **the sign read from where you stand**: "The Library · Books current · checking", "The Glasshouse · Clear benches". |
| `*-27-quick-sheet.png` | The quick sheet, opened with **Space** on the stage: every tool, grouped by district. |
| `*-27b-quick-sheet-places.png` | The same sheet, scrolled to "Every place on the island" — all fifteen room × level slots, each named by the place standing there. |
| `*-28-close-mode.png` | The Court's **close hold**: the Queen framed, entered with `c` (or two taps on the open ground) and left the same way. |
| `*-29-flat-court.png` | The reading edition of the Court, carrying **the same door sign** the path carries. |
| `classic-390-07-flat-tower.png`, `classic-390-08-flat-cellar.png` | The reading editions of the Tower and the Cellar, each with its own sign and its room's own door. |

The rest are the slice-2 island walk, unchanged in kind: each place, each door open over it, the
rail's walk through the month, and a mid-travel frame of each journey.

## `report-w5-w7.json`

Per width: the door signs as their DOM twins read them, the quick sheet's whole inventory
(17 tools, 15 places, the two roomless surfaces), and the close hold's camera before, during
and after — `moved: true, returned: true` is the promise that the same gesture that came close
puts the camera back exactly where it was.

Fewer landmark twins are listed at 390 than at 1440: a twin exists only for what is in frame,
and a phone's court holds less of the island at once. The signs themselves stand on every
building at both widths.

Console: clean apart from the review server's own `WebSocket is already in CLOSING or CLOSED
state` as a browser context is torn down — the loopback LedgerRoom closing, not the app.
