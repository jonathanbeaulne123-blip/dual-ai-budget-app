# The loft's rack — evidence

Chromium (SwiftShader for the 3D path; `--disable-3d-apis` for the no-WebGL
path), fictional Development books on the `composition=queen` proof page with
`loft=1` (three fictional Build goals — *the trip to the shore* $2000, *the
porch renovation* $900, *the wedding weekend* $3200 — and the lidded
*Fictional date night*; the Fund reconciled at $4000 with $2800 safe to pour,
Alex (fictional) its custodian), driven into the loft by the app's own two-tap
gesture. Produced by `test/queen-loft-layout.mjs`; 18 records in
`records.json`, **0 page errors, 0 axe violations of any impact inside the
room, `overflowY` 0 everywhere**. Every bank move, weight slide and pin drop
from 320×700 up was made **by hand** — a real pointer drag — with the keyboard
as the fallback the proof records if a hand cannot land (`movedBy`, `slidBy`
in the records say which; all read `drag`).

| Set | What it shows |
|---|---|
| `one-*` (320×568, 320×700, 390×844, 720×900, 1100×800) | A household that never hung a shelf: the one board from the old order, its brass weight reading *5 of 5*, its pin *to the crown*, a divider between each pair of banks, the dotted peg *Hang a shelf below*, the jug *$2800.00 safe to pour* with its tilt at rest. No figure on the ledge, the weight, the pin or the sub line (`ledgeMoney` false). The rack fits without scrolling from 390 up. |
| `two-*` (320×700, 390, 720, 1100) | A second shelf hung (*5 of 9* / *4 of 9* — a new shelf hangs one lighter than the lightest); the wedding **dragged** down onto it (the top shelf closes the gap); the lower shelf's weight **dragged** two notches right (*5 of 11* / *6 of 11* — the lower shelf now outweighs the top); the top pin dropped two notches (*18 of 20*), the first divider slid (*trip 2, renovation 1*). In 3D each board is a plank with a lip and two brackets under the drawn shelf; the pins, weights and dividers stay drawn — they are the controls. |
| `two-320x568` | The compromised stand-in frame (the room is about 240px): the rack is a strip that scrolls inside itself; the house does not scroll. The hand-work is proved from 320×700 up; on the actual App page at this size the loft stands under a books banner (see `../queen-house/loft-320x568.png`). |
| `tilt-*` (320×700, 390, 1100) | Two shelves 5:1, the wedding alone below; the jug tilted to half (*50% of the safe surplus, $1400.00*). The line reads the pour as it would land, exact in cents: *"The jug tilts. $1166.67 to the top shelf (… $583.34, … $583.33); $233.33 to the bottom shelf (Fictional wedding weekend $233.33)."* — the lidded date night takes nothing. *Pour it* appears only once the jug tilts. |
| `confirm-*` | *Pour it* opens the app's Confirm sheet (*"Pour $1400.00 of the Fund's surplus over the rack"*, the split carried in). Escape closes it; the jug still says $2800 — nothing was poured. |
| `poured-1100x800` | Confirmed once on the proof page's in-memory books: `allocateHouseholdFundSurplus` posts the three allocations; the jug reads *$1400.00 safe to pour*; the notice *"$1400.00 poured. The banks fire as they fill."*; the jug stands upright again. |
| `keyboard-focus-390x844` | Flat. The first bank takes focus with a visible ring; Shift+ArrowRight moves it along the shelf; the weight takes focus and End takes it to *10 of 10*; the ring is visible on the brass. Axe on `.queen-room--loft`: no violations. |
| `reduced-3d-390x844` | `prefers-reduced-motion` + the comfort attribute, two shelves: the room renders in 3D; the shelves, the weights and the jug's tilt have no transition (`0s`). |
| `no-webgl-*` (390, 1100) | `--disable-3d-apis`: the room reads `flat`, four drawn kitty banks stand on two drawn ledges with the same pins, weights and dividers, and the same two-shelf reading holds after a Shift+ArrowDown. |
