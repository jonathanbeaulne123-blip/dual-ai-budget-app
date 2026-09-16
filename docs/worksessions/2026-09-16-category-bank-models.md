# Worksession — the Queen's household in the cellar (2026-09-16, D-282)

**Ask (Jonathan):** "all the 3d models for our new categories plus a couple higher res ones for bianca pay and jonathan income jars" — thirteen kits (twelve umbrella banks and the Work duo V2).

**Choices (asked before building):**
- Where the umbrella banks stand: **cellar bill jars** (not the Add-category grid, the Our Path pennants or the Books filter this time).
- Which partner gets which pay bank: **by how they're paid** — Clink for shifts and tips, Poise for a salary.
- The pay jars' look: **frosted before pay day, then solid**, glazing up as contributions arrive.

**Checked in the kits:** every GLB is binary glTF 2.0, one unit tall on y = 0, front +Z, no required extensions, no textures. The umbrella banks are 355–398 KB; Clink 1,406,916 B and Poise 1,489,456 B match the kit manifest's SHA-256. The Home kit has no icon PNGs (not needed here).

**Built:**
1. `public/models/banks/<umbrella>.v1.glb`, `pay-clink.v2.glb`, `pay-poise.v2.glb`, each with a `.gz` copy (`gzip -9 -n`).
2. `src/queen/world/bankModels.ts` — registry, `umbrellaBankKey`, `payBankFor`, `loadBankModel` (reuses the Queen's reader and parser).
3. `src/queen/world/queenRoomWorld.ts` — `RoomVessel.model`; model templates load once; a seat is two clones (own materials clipped below the fill line; bisque clipped above); `glass` is one shared frosted material that still writes depth; loading stands nothing; failure stands the drawn vessel.
4. `src/core/queenCellar.ts` — `CellarJar.umbrellaId` on the same sorted-only terms as `umbrellaHue`.
5. `src/core/cellarIncomeJars.ts` — `payStyle` from `earningCadence` or a household-visible shift (never a private one, so both phones agree); `payCents` on a contributed jar only when that pay was shared and not hidden.
6. `QueenCellar.tsx`, `QueenCellarExtras.tsx`, `QueenCellarRail.tsx`, `queen-cellar.css` — bills and pay extras pass their model; pay extras gain `data-room-vessel` and their SVG yields in the live room.
7. `scripts/serve-bank-models-proof.mjs` — every model at bisque / half / full / glass through the real room code.

**Not changed:** jar sizes (D-265 dollar scale), words, cards, commands, the flat room, the Queen/Protect/Build models.

**Verification:** see `docs/evidence/bank-models/README.md`, `test/bank-models.test.ts`, and the cellar/Queen suites.

**Open:** on a phone the bills are small at the dollar scale, so the models read mainly when zoomed in. Real-GPU cost unmeasured.
