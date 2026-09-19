# The cellar and the loft in three dimensions — evidence

Chromium (SwiftShader), fictional Development books, the `composition=queen`
proof page, driven into each room by the two-tap gesture the app uses.
14 records across `records-cellar.json` and `records-loft.json`.

| Set | What it shows |
|---|---|
| `cellar-*` | A stone cellar with a barrel vault, one bulb over the gate, a shelf of dusty bottles, and the ribbon of jars on the rail. June swelled, tilted and stepped out of the rail; a dotted hole is left where its beat should have been. September is hollow — nothing has landed. |
| `loft-*` | A room under the roof with a dormer, rafters and a wooden ledge. An open-mouthed goal and a lidded bill, and the lidded one leans away. |
| `*-320x568 / 390x844 / 720x900 / 1100x800` | Every width. `overflowX` and `overflowY` are **0 in all 14**. |
| `*-flat` | `getContext` returns null — **no WebGL at all**. The drawn vessels the rooms have always had render in place of the sculptures; `world` reads `flat`. |
| `*-reduced` | `prefers-reduced-motion: reduce`. The room still renders; its dust never starts. |

`money` is **false in all 14**: no figure appears on the ribbon or on the ledge.
Figures appear only once a bank is picked up, in the in-hand panel. 0 page
errors in all 14.

## The one thing to know about the shelf

Rearranging the ledge writes **one list of design keys** on the Build plan
bank's own household design row, through `saveKittyNestDesign` and its existing
revision check. There is no proposal and no confirmation — Jonathan chose last
edit wins — so one person's rearrangement changes the ledge for both of them
the moment it saves.
