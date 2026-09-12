# Kitty Bank Studio — sculpt, paint, fire, grow

- Status: IMPLEMENTED LOCALLY on `claude/kitty-studio`; focused tests, build and synthetic browser evidence passed; no push, merge, deployment, schema or real-household write
- Owner and decision owner: Jonathan (2026-09-11: "turn the Kitty Bank into something truly incredible … pottery simulator … world-class paint studio … kiln … putting money in causes it to expand")
- Assignee: Claude (sole writer on this worktree). Next owner: Codex for independent audit of the envelope/sync surface and integration.
- Repository: dual-ai-budget-app · branch `claude/kitty-studio` from `origin/main` `0837f9a`
- Risk: Medium-High. The envelope shape and `saveGoalEnvelope` change (validated, capped, versioned inside `GoalEnvelope.version: 1`); no journal, posting, projection or PGlite change. The studio never reads or writes money; the growth rule composes existing readers.
- Environment: local worktree, fictional `planLifeFixture` books only, headless Chromium with SwiftShader WebGL

## Household outcome

A bank is an object Jonathan and Bianca make together: throw a silhouette on the wheel, pick a head, ears, eyes, mouth, whiskers, tail and nose, paint it freehand with 24 named glazes, stamp it, then fire it. The fired piece is final and sits on a small shelf; "Throw another" starts fresh clay for the same purpose. The sculpted cat's size follows the money actually backing the bank toward its target, in the same ten steps as the shelf, and grows with a little bounce only while a real receipt is on screen.

Budget delta (5): +0 — no financial writer, projection or hash changes; `savedCents` never written; studio data is outside `financialAuditHash` and the sync split is unchanged. Engagement delta (3): +3 — an original tactile object with a distinct vibe and controls worth returning to.

## Decisions recorded

Why-note at the top of [DECISIONS.md](../DECISIONS.md): the growth rule (backing step) supersedes "appearance never changes with money"; fired pieces are immutable; designs share through the household like `glaze`.

## What was built

### Data (`src/core/types.ts`, `src/core/kittyStudio.ts`, `src/core/goalEnvelopes.ts`, `src/core/commands.ts`, `src/core/kittyBanks.ts`)

- `GoalEnvelope.studio?: KittyStudioV1` = `{ version: 1, draft: KittyPieceV1 | null, fired: KittyPieceV1[] }` with sculpt (body/profile/head/ears/eyes/mouth/whiskers/tail/nose), paint (base, per-part dips, strokes, anchored stamps). Envelope `version` stays `1`; `goalEnvelopeVersion: 1` authority gate already covers every `saveGoalEnvelope` step (`src/ledgerSync/authority.ts:91`).
- `shapeGoalEnvelope` validates the studio strictly through `shapeKittyStudio` (enums, finite numbers, profile 0.55–1.15, ≤400 strokes, ≤6000 points, ≤40 stamps, ≤6 fired, ≤48 KB serialized, unique ids, drafts unfired, shelf fired) and throws the existing "compatible envelope reader" `ValidationError`. Points quantize to 3 decimals on save. `undefined` studio stays valid (legacy banks). `glaze` follows the displayed piece's dip when it is one of the five legacy glazes so `.kitty-seal`, the shelf and Hercules readers keep working.
- `saveGoalEnvelope` gains `fire?: boolean`: the command moves `draft → fired[]`, stamps `firedAt`/`firedBy` from the resolved actor, enforces the shelf cap, and calls `assertKittyStudioTransition`. `assertGoalEnvelopeTransition` (runtime gate) also rejects any change to a fired piece. No new command kind.
- `kittyBankBackingStep(h, goal, asOf)`: `goalRemainingClaim + goalFundReserve(...).reservedCents` over `targetCents` → `kittyBankStep` (0..10). Unreadable receipts read as 0 inside this cosmetic selector rather than throwing.

### Sculpture (`src/kitty/sculpture.ts`, `src/kitty/studio/paintCanvas.ts`, `src/kitty/KittyStage.tsx`)

- `createKittySculpture(piece, options)` builds a lathe body from the body preset × four profile handles, sphere/scaled head variants (heart adds lobes), cone/sphere ears (folded/tufted variants), four eye rigs (open/happy/wide/sleepy), five mouths, whisker sets, three tails, paws, brass slot, and the loved front compartment with envelopes and hinged door. Ears are cones now, not extrusions, so they carry UVs and take paint.
- Every paintable part (body, head, earL, earR, tail, paws) has a layer canvas (true colour) and a display canvas (bisque-lifted while unfired: 35% toward chalk, 25% desaturated) feeding its own `MeshPhysicalMaterial` (`roughness 0.92, clearcoat 0` unfired; `roughness 0.18, clearcoat 1, clearcoatRoughness 0.08` fired with a `RoomEnvironment` env map). API: `setSculpt, setPaint, replayPaint, paintStroke (incremental, dirty-rect re-filter), setFired, setFill, setOpen, setExpression, setIdle, setSpin, update, raycastPart, dispose`.
- Growth: resting scale `1 + step × 0.055`, applied to the cat group above a fixed turntable; the compartment rides on the sculpted belly. Step up: slot-rim pulse, damped squash-and-stretch (≈5 bounces, 900 ms), happy eyes 1.4 s, ≤12 sparkle sprites on one geometry. Step down: 500 ms ease. Reduced motion: instant scale, no particles, one-frame highlight. Idle 6 s ±1.2% breathe only while on screen and visible; the RAF loop runs only while something animates.
- `KittyStage` renders the piece (draft while in the Studio, newest fired otherwise), dollies the camera out with the step so a full bank fits, raycasts pointer painting to `{part, uv}`, converts vertical drags on the Wheel bench into handle pulls, and falls back to the flat SVG (`src/kitty/studio/flat.tsx`) in Simple view or when WebGL fails.

### Studio UI (`src/kitty/studio/`)

- `KittyStudio.tsx`: `useKittyStudio` (local draft + guarded `hearth-kitty-studio:<identity>:<goal>` session draft, undo/redo cap 60, keep/fire through `saveGoalEnvelope`, ceremony state) and `StudioBench` with three benches, segmented control and keyboard 1/2/3.
  - Wheel: spinning turntable, four labelled handles with press-and-hold Push in / Pull out pads and range sliders, chip rows with original SVG glyphs (`glyphs.tsx`) for every option, Shuffle clay, Plain lump.
  - Paint: 24-glaze palette (`palette.ts`, legacy five marked), custom hex, brush/marker/sponge/eraser with size and opacity, Mirror, Dip (whole cat or one part), stamps drawer (8 kinds, anchor list or tap the cat, arrow keys rotate/resize, `initial` takes 1–2 letters), Undo/Redo, Wash it off with inline confirm. Flat view states "Freehand painting needs the 3D view."
  - Kiln: original SVG kiln with a swinging door, glaze preview toggle, "Fire it" → `ConfirmSheet` naming the bank and stating finality → command → 3.5 s ceremony (glow, shimmer, 0→1000 °C, reveal with fired materials), skippable, instant under reduced motion; then "Throw another". Fired shelf strip renders `KittyFlat` thumbnails.
- Copy never claims money moved; every control is DOM; canvas is `aria-hidden`; 44 px targets; themes use the room's `--room*` tokens plus `--studio-bench`, `--studio-clay`, `--studio-kiln-glow`, `--studio-kiln-chamber`, `--studio-shadow` (no hex in studio CSS/TSX; the only hex lives in `palette.ts`).
- Room wiring (`KittyBankRoom.tsx`): new "Studio" folio page; a brand-new bank is created with fresh clay and opens on the Studio; the stage is sticky on wide screens; below 720 px the benches become a bottom tab bar and the stage takes 45 vh; room seals use the displayed piece's dip.
- Shelf (`src/KittyBanks.tsx` PaperBank): dip colour, ears, eyes and mouth from the displayed piece; `paper-bank`, `data-kitty-step` and D-173 geometry unchanged.

## Verification (exact commands and results)

```
pnpm exec tsc --noEmit                      → clean
pnpm exec vite build                        → ✓ built (sculpture chunk 10.80 kB / 4.87 kB gzip; three in separate chunks)
pnpm exec vitest run test/kitty-banks.test.ts test/kitty-envelope.test.ts test/kitty-envelope-ui.test.ts test/kitty-studio.test.ts test/kitty-studio-ui.test.ts test/plan-worlds.test.ts test/ledger-story-ui.test.ts test/desk-plates.test.ts test/five-boards-entry-app.test.ts --maxWorkers=2 --testTimeout=30000
  → 78 passed, 2 failed (test/desk-plates.test.ts: "stages a Fund plate on a single click…" and "leaves iPhone seals on the blotter")
  → the same 2 desk-plates assertions fail identically on the untouched base (verified by stashing this branch's changes); they are source-text guards on OfficeWide/OfficePhone unrelated to this work
```

New tests: `test/kitty-studio.test.ts` (shape/caps/quantization/legacy glaze sync, shared-half round trip, audit hash unchanged, fire through the command, immutability, shelf cap, legacy envelope loads, backing step grows/slims, palette uniqueness, no-hex guard) and `test/kitty-studio-ui.test.ts` (jsdom: throw → wheel chips → shortcut 2 → dip → undo/redo → keep → kiln → Confirm → fire → skip → throw another; stamps by anchor with keyboard rotation; wash). `test/kitty-envelope.test.ts` gained one proof (studio in the shared half, hash unchanged, fired immutability). No existing assertion was changed.

Browser evidence (`docs/evidence/kitty-studio/`, fictional `planLifeFixture` data, headless Chromium + SwiftShader so real WebGL rendered): Studio wheel at 320/390/720/1100 in Classic, Taylor's Scrapbook and Newfoundland; Paint bench at 390/1100; Kiln unfired / glaze preview / firing / revealed; fired piece on display; reduced-motion instant fire (Taylor Personal); Simple view for a legacy bank and the paint limit copy. No horizontal overflow at any width (`scrollWidth === innerWidth`), no page errors. `scripts/fixtures/kitty-studio/paint-probe.mjs` drew a real pointer stroke on the 3D cat (stroke count rose 3 → 4), placed a stamp by tapping, kept the clay through the command, then a fictional deposit raised the backing step and the mid-bounce squash and resting size were captured.

Capture commands: `pnpm exec vite --port 5199` then `scripts/fixtures/kitty-studio/shot.mjs` / `paint-probe.mjs` (see the env parameters at the top of each script).

## Uncertainty and limits

- SwiftShader rendering is slow (hundreds of ms per frame), so the growth bounce and kiln ramp were verified structurally and in stills, not at 60 fps; physical-device frame rate, touch painting and Safari WebGL remain untested.
- Stamps on the 3D cat use fixed uv anchors; on unusual profiles a stamp can sit slightly off the visual centre of a part. The flat SVG places stamps at approximate 2D positions.
- Heart head and folded/tufted ears are coarse in 3D; the flat cat is deliberately schematic.
- The legacy "Try a glaze" buttons remain on the other folio pages; with a fired piece whose dip is a legacy glaze the displayed piece wins, by design.
- The pre-existing desk-plates failures and jsdom `getContext` noise from `ChalkboardDesk` are unrelated and untouched.
- Not run: `pnpm test` quick gate, `test:full`, `check:full`, startup canaries.

## Deliberately deferred

Bianca-side notification of a new fired piece; Hercules commentary on the sculpture; texture-baked screenshots (thumbnails use the flat SVG on purpose); per-stroke pressure; stamp drag placement (anchors + arrow keys cover it); export/share of a fired piece.

## Data and environment disclosure

Fictional fixtures only. No hosted Supabase, Cloudflare, Production, schema, secrets or real household data were read or written. Work is on the local worktree `/home/claude/wt-kitty`, branch `claude/kitty-studio`, not pushed.

## Next owner

Codex: independent read-only audit of `shapeKittyStudio` caps, `saveGoalEnvelope fire`, transition guards, sync/authority coverage and integration with the Plan room; then Jonathan for product review (see open questions in the handoff message).
