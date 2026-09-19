# Evidence — the Queen's household in the cellar (D-282, 2026-09-16)

Fictional books only. Both flags on (`VITE_FUND_MODEL_V2`, `VITE_CELLAR_V3`), swiftshader WebGL in headless Chromium.

## Cellar (`test/bank-models-layout.mjs`)
Proof page `composition=queen&sorted=1&bills=1&cellar3=1&today=2026-09-12`; jars zoomed three steps so the models read.
- **21 records, 0 page errors, no sideways scroll**: Classic at 320×700, 390×844 (full and reduced motion), 720×900 and 1100×800, gated on a bill (day 5), Sam's pay (day 10) and Alex's pay (day 18); Taylor and Newfoundland at all four widths (bill gate).
- Every record lists the pay jars the rail hands the room: `contribution:clink` (Sam shared a bar shift) and `income:poise` (Alex's salary), and the model files fetched (`/models/banks/*.glb.gz`).
- `*-rail.png` are crops of the rail. Bills are sized by dollars against the Fund's water (D-265), so on a phone they are small; Poise's glass (the $1,800 pay) is the large figure.
- The Taylor/Newfoundland 1100 runs were repeated on their own after a CPU-contention timeout in the parallel run; the records are from the clean runs.

## Shelf (`scripts/serve-bank-models-proof.mjs`)
The same room code with large seats: `shelf-all-states.png` shows all fourteen models as bisque (nothing in), half glazed, fully glazed and frosted glass (cut off at the bottom; `shelf-glass.png` is the glass row alone). The models' own colours appear only below the fill line; nothing on the model is re-shaped.
