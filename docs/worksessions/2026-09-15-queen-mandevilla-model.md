# Hearth worksession: the Queen becomes Jonathan's Mandevilla Queen model

- **Status:** OPEN. Local branch and patch only: not pushed, not a PR, not merged, not deployed, not live verified.
- **Opened:** 2026-09-15 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/queen-mandevilla-model`
- **Baseline SHA:** `25deb6d` (`origin/main`, #491)
- **Risk:** Medium-Low. Presentation only, behind `VITE_QUEENS_NEST`. One new static asset.
- **Decision owner:** Jonathan (D-266)
- **Environment impact:** none. Fictional fixtures only.

## Household outcome

Jonathan (2026-09-15), with `Mandevilla_Queen.glb` attached: "i want this to be the model for the queen kitty banks."

Clarified:

- **Where:** the Queen on Home. Protect, Build, the loft and the cellar keep the couple's studio cats.
- **Live parts:** "do not change the way the model looks only incorporate the current features around this current model."

## Budget delta (5)

+0. No command, projection, schema, sync or payload change. No money is read by any new code.

## Engagement delta (3)

+2. Home's centrepiece is now the household's own sculpt, and every reading she carried is still visible.

## What changed

- `public/models/queen/mandevilla-queen.v1.glb`: the supplied file, byte for byte (SHA-256 `4954397c…d301`). The `.gz` beside it is a transfer copy only.
- `src/queen/world/queenModel.ts` (new):
  - `readQueenModel` prefers the `.gz` copy and inflates it only when it really is gzip.
  - `parseQueenModel` / `loadQueenModel` load the file.
  - `queenModelAnchors` measures the crown, the saucer, the planter's profile and the seats on her vines from her named parts.
  - `queenModelResources` lists what must be disposed.
  - `queenModelLook` fingerprints how she looks.
- `src/queen/world/queenSculpture.ts`:
  - `setModel(model | null)` fits the model to `QUEEN_HEIGHT` with its base on the floor, and hides the drawn figure: body, head, ears, tail, paws, hands, shoulders, face, vine and the crown's blooms, ring and points.
  - `setAwaitingModel` draws nothing of her while the file is on its way.
  - Around her, driven by the existing setters:
    - `setCrown` → the crown light, moved onto her vine crown;
    - `setFill` → 0–10 brass coins beside the planter;
    - `setGlaze` → polished or dull coins;
    - `setSeams` → up to three kintsugi cracks on the planter;
    - `setVine` → young leaves (acts) and pink-tipped buds (goals in motion) on her vines;
    - `setFeet`, `setMarks`, `setTipped`, `setBreath` as before.
  - Charms are kept (`setCharms`) but not laid while the model stands, and `pick` returns null so the flat pick seats them.
- `src/queen/world/queenWorld.ts`: loads the model (injectable `loadModel`, `onModel`), falls back to the drawn figure on failure, and adds `model` to the stats.
- `src/queen/QueenWorld.tsx`: `onModel` prop.
- `src/queen/QueenHome.tsx`: `data-queen-model`, and `queenModelStill` in place of `queenWorldStill` when the model stands. The charm sentence says the charms are kept for her drawn figure.
- `src/queen/world/queenAuthoring.ts`: `queenModelStill`.
- Tests: `test/queen-model.test.ts` (8), `test/queen-model-layout.mjs` (browser), plus the focus map.

## Out of scope

- The flat (no-WebGL, forced-colours) Queen: still the drawn SVG.
- Protect, Build, loft and cellar banks.
- Paint, charms, form and rings on the model. Her face does not move.

## Acceptance evidence

- [x] The shipped file is the supplied file (SHA-256), and the `.gz` inflates to it (test).
- [x] No reading changes her look: fingerprint identical after paint, glaze, fill, crown, seams, vine, feet, pose, charms, form, marks, tipping and breath; every node still visible (test).
- [x] Every reading is visible around her: coin count, coin roughness, crown light, seam count, leaf and bud counts, stones (test).
- [x] Awaiting → nothing drawn; failed → drawn figure, seams restored (test). A refused model in the browser → `data-queen-model="drawn"`, no note, no page error.
- [x] Disposal returns counts to zero with the model attached (test).
- [x] No page scroll at 320×568, 390×844, 720×900, 1100×800 (Classic, needs-us and building) and at 390 and 1100 (Taylor, Newfoundland). Zero page errors. Evidence: `docs/evidence/queen-model/`.

## Verification

- `tsc --noEmit` clean.
- `pnpm test -- --risk=medium --focus=test/queen-model.test.ts`: `quick-gate-passed`, 15 files, 178 tests, 89.8 s of 300 s.
- `HEARTH_CHROMIUM=… node test/queen-model-layout.mjs`: 13 records, ok.
- `test/queen-world-layout.mjs` times out at its first 15 s wait in this sandbox on this branch **and on untouched `main`**, so no result is claimed for it.

## Uncertainty and open items for Jonathan

1. Should the couple's paint or charms ever reach the model? Today they are saved and shown only on the drawn figure.
2. The flat fallback still draws the old Queen. A still render of the model could replace it.
3. The model adds 3.2 MB (2.4 MB gzipped) to the first 3D Home load. It is fetched once and then cached by the browser. There is no immutable cache header, because `/models/` is outside `/assets/`.
4. Her coin slot faces away from the room (the model's back). The fill reads through the coin stack instead.
5. D-266 was free on `main@25deb6d`. Unmerged patches from other chats may also claim it.
