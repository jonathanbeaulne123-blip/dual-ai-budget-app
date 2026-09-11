# Hearth worksession — Hercules dressing room: themed rooms, navigation, more outfits

- **Status:** OPEN — local branch, committed, not pushed, not PR'd, not merged, not deployed
- **Opened:** 2026-09-11 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (Fable 5.1), one writer in an isolated worktree
- **Repository:** dual-ai-budget-app
- **Branch:** `claude/hercules-room`
- **Baseline SHA:** `0837f9a4e0da068104428579d72a15629fb7b5b4` (origin/main, "Keep Hercules Easy Read inside the scrolling conversation (#444)")
- **Head SHA:** see the final commit of this branch (four commits: rooms, navigation, collections + tail slot, evidence + docs)
- **PR or issue:** none yet
- **Risk:** Medium (cosmetics that cannot post) with one **Medium-High** edge: `COMPANION_SLOTS` / `LookV1.selections` gain an optional `tail` slot — a hosted-sync-visible companion payload shape. Needs independent trust review before merge.
- **Decision owner:** Jonathan
- **Environment impact:** none (no schema, hosted row, secret, Worker, provider or Production change; feature stays behind `VITE_HERCULES_DRESSING_ROOM`)

## Household outcome

Hercules's dressing room now belongs to whichever world Jonathan or Bianca chose. Classic Hearth is a warm study, Taylor's Scrapbook a cottage attic with a string of blank photo cards, Newfoundland a harbour music room with jellybean clapboard and a porthole; dark scenes get a lamp instead of a light room. The wardrobe grew from 48 to 66 pieces across nine collections plus a tail slot, and a 66-piece wardrobe is navigable: wearing-now chips, slot tabs, prev/next, search, colour-first, recently worn, keyboard shortcuts and a look strip. Below 720px the room is a phone composition with a bottom-sheet drawer; at or above 720px it is a three-column office that fits the viewport.

## Budget delta (5)

**0.** No posting, reconciliation, sit-down, Health, statement, account or split primitive moved. Cosmetics still never post money; `commitCompanion` remains the only writer and `look.*` steps are unchanged. Dual Course holds because nothing here touches Course A; the room is pure Course B and stays behind its flag.

## Engagement delta (3)

**+3.** The dressing room feels authored per theme and per lighting; three new collections (Hearth after dark, Garden Sunday, Snow day) and a tail slot; navigation that makes trying on pieces fast on phone and desktop. No unlock, streak, shame or pay mechanic — every piece remains available for play.

## Verified baseline (facts vs inferences)

Facts, read from code before writing:

- The room lives in `src/wardrobe/` (not `Hercules.tsx`). `wardrobe.css` had a parallel hardcoded `--fitting-*` hex palette per `[data-fitting-theme]`, `Georgia, serif` fonts, and a `max-width:900px` stacked layout — **the brief's "no media queries" claim was inaccurate**; there was a 900px stack, but no phone composition, no bottom sheet, and no 720px breakpoint (the repo's mobile/wide contract).
- `scene.ts` built the 3D room from a hardcoded palette table and recreated the whole scene on `[attempt, theme, view, flat]`.
- `ThemeProvider` writes `data-theme`, `data-scene`, `data-material`, `data-scene-lighting`, `data-atmosphere`, `data-world-page` and ~35 tokens (`sceneTokens`) onto `<html>` in a layout effect; `useAppearance().scene` exposes `dark`, `palette`, `theme`. Dark scenes: `reputation` (Taylor ledger) and `george-street` (Newfoundland shift).
- The exported rig has `rig_tail_01..10` and `rig_frontAnkle_L/R` bones (`hercules-cozy.v1.glb`); `rig_tail_04` world position ≈ (−0.062, 0.201, −0.324), tail fur cross-section radius ≈ 0.02–0.046.
- `decodeLook` rejects unknown selection keys (`UNEXPECTED_FIELD`), so a new slot must be added to `COMPANION_SLOTS` to be storable.
- `test/appearance.test.ts` "keeps authored text and primary-action pairs readable in every scene" fails on the baseline (`poets` muted contrast 3.22 < 4.5) — untouched by this branch (`src/theme/scenes.ts` and the test are identical to origin/main).

Inferences: the `--desk` token equals the scene paper, so the room mixes the authored wood toward it rather than using it raw; `--brass` equals the accent, so brass is a 30% mix toward the theme accent and lifted for dark scenes.

## Scope

### In scope

1. Token-derived room CSS, computed-token 3D palette with authored fallback, one authored 3D set per theme with light/dark treatment, per-theme copy, phone composition (<720) and viewport-fitting office (≥720).
2. Wearing strip, slot tabs, prev/next + `[`/`]`, `Shift+S`, `F`, `Backspace`, `/`, search with live count, collection chips, Recently worn, Colour first, look strip.
3. Three new collections (18 pieces), four colours, new `tail` slot in 2D and 3D, regenerated packs and thumbnails, deliberate test-count updates.
4. Evidence runner, screenshots, docs.

### Out of scope

Per-scene set dressing for all 24 scenes (Jonathan chose one room per theme id); `paws` slot (no paw-anchored authoring attempted; `rig_frontAnkle_*` exists so it is feasible later); physical-phone performance; owner likeness/fit acceptance; merge, deploy, exhaustive gates.

## Changes

- `src/wardrobe/wardrobe.css` — rewritten on tokens; no hex/rgb literals; `[data-fitting-view=personal]` tint via `--theme-second`; `[data-fitting-lighting=dark]`; phone block at `max-width:719px` with `.fitting-sheet`; 720–1000 and ≥1600 adjustments; reduced-motion block.
- `src/wardrobe/roomPalette.ts` (new) — `parseCssColour` (hex/rgb; `color-mix`/`var` → null), `roomPalette` (tokens → scene palette → theme defaults), `mixHex`, `luminance`.
- `src/wardrobe/room.ts` (new) — `createRoom(scene, palette)` per theme with `apply(palette)` re-tint and lighting, `dispose()`.
- `src/wardrobe/scene.ts` — uses `createRoom`; new `setRoom(palette)`; furniture uses room materials; scene no longer recreated on view change.
- `src/wardrobe/HerculesDressingRoom.tsx` — rewritten: palette state read after commit (`readSceneTokens`) and on scene change; `roomCopy` per theme × view × dark; navigation state; keyboard shortcuts; phone bottom sheet with `data-dialog-escape-boundary` so Escape closes the sheet first; secondary actions move into the sheet on phone.
- `src/wardrobe/navigation.ts` (new) — pure helpers (search, cycle, colour index, recents, typing guard).
- `src/core/herculesCompanionContracts.ts` — `COMPANION_SLOTS` += `"tail"` (additive). **Trust-review edge.**
- `src/wardrobe/pieces.ts`, `catalogue.ts`, `glyphs.ts`, `lookTools.ts`, `FittingFigure.tsx`, `src/HerculesFigure.tsx` (`tailLayer` prop) — new collections, colours, shapes, tail layer, shuffle over every slot, `check-sleeve` gate for the new sleeved garments, `yarn` glyph made distinct from `ribbon`.
- `scripts/wardrobe/collections.mjs` — iterates `COLLECTIONS`; 3D recipes for 18 shapes; tail slot bound to `rig_tail_04`.
- `public/hercules-wardrobe/` — `night/garden/snow.v1.glb(.gz)`, 18 new SVGs, `collections.json` (10 packs; six earlier packs byte-identical, entries carried forward), regenerated thumbnails.
- `scripts/wardrobe/proof/room-harness.tsx`, `room-evidence.mjs` (new) — fictional evidence harness/runner.
- Tests: `test/hercules-wardrobe-room.test.ts` (new), `test/hercules-wardrobe-navigation.test.ts` (new), `test/hercules-wardrobe-catalogue.test.ts` (counts 36→54 new, 48→66 total, 9 collections, 10 packs, tail binding/proximity, new-garment layering raycasts, rigid anchors, additive-slot decode), `test/hercules-wardrobe-ui.test.ts` (collection chips instead of `<select>`; `setRoom` on view change; `.herc-tail` anchor).
- Docs: `docs/HERCULES.md`, `scripts/wardrobe/README.md`, this worksession, `docs/evidence/hercules-room/`.

## Evidence log (verbatim, this worktree, Node 22 / pnpm 10)

- `pnpm exec tsc --noEmit` → clean (no output).
- `VITE_HERCULES_DRESSING_ROOM=1 pnpm exec vite build` → `✓ 716 modules transformed.` … `✓ built in 24.15s` (existing chunk-size warning only).
- `pnpm exec vitest run test/hercules-wardrobe.test.ts test/hercules-wardrobe-catalogue.test.ts test/hercules-wardrobe-continuity.test.ts test/hercules-wardrobe-ui.test.ts test/hercules-wardrobe-navigation.test.ts test/hercules-wardrobe-room.test.ts test/hercules-companion-actions.test.ts test/hercules-companion-assets.test.ts test/hercules-companion-continuity.test.ts test/hercules-companion-profile.test.ts test/appearance.test.ts test/appearance-provider.test.ts test/appearance-companion.test.ts test/appearance-account.test.ts test/mobile-appearance.test.ts test/page-worlds.test.ts test/hercules-rig.test.ts test/hercules-rig-chat-triggers.test.ts` → `Test Files 1 failed | 17 passed (18)`, `Tests 1 failed | 172 passed (173)`, `Duration 34.32s`. The one failure is the pre-existing baseline failure named above (`poets muted: expected 3.218… to be greater than or equal to 4.5`), in a file this branch does not touch. Every wardrobe/companion/rig/page-worlds/provider suite passed.
- `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/wardrobe/proof/room-evidence.mjs` → 24 cells (classic light household/personal, taylor light `lover` + dark `reputation`, newfoundland light `jellybean` + dark `george-street` personal; 320/390/720/1100) all `3d ok 0 axe` — WebGL rendered through swiftshader, no horizontal overflow, zero axe violations (wcag2a/2aa/21aa), no page errors. Checks: phone sheet `sheetOpenAfterTab:"true" → sheetOpenAfterEscape:"false"`, room still open; keyboard order from Close → wearing chips → ‹ › → slot tabs, `outlineStyle:"solid"` on the focused control. Report: `docs/evidence/hercules-room/report.json`; 30 PNGs alongside (fictional `catalogHousehold()` fixture only).
- Quick gate (`pnpm test -- --risk=medium --focus=…`) was **not** run in this session (the brief scoped verification to tsc, vite build and the focused vitest suites); `pnpm test:full` / `check:full` deliberately not run.

## Decisions

- Theming depth per Jonathan: one authored room per theme id + dark handling, not 24 set dressings.
- Breakpoint moved from the old 900px stack to the repo's 720px contract so phone/wide match every other page.
- Tail slot chosen over paws: the tail bone chain is exported and a ribbon/bell reads from the back and side; paws would need four anchors and would fight the strut clip.
- The three new packs were generated with the same exporter; the six earlier packs were kept byte-identical (the exporter's float formatting drifted in the last digit on this Node build, so re-exporting them would have been binary churn with no content change).
- `yarn` and `ribbon` legacy glyphs shared one drawing; `yarn` now has its own so the "distinct artwork" assertion is honest.

## Remaining uncertainty

- **Trust review needed** for the additive `tail` slot in `LookV1.selections` (hosted-visible companion payload). Old looks decode unchanged; `favouriteOutfits` preference ids are untouched; look ids/`LookV1` version unchanged.
- Owner fit/likeness review of the 18 new 3D garments (straw-hat brim, robe drape, goggles, tail pieces) is still human work; automated tests only prove binding, bounds, layering and clearance.
- The dark-scene 3D balance (lamp warmth vs ambient) was tuned by screenshot on swiftshader, not on a phone GPU.
- The pre-existing `appearance.test.ts` `poets` contrast failure is not addressed here (different owner/page).
- Physical midrange-phone performance for the larger rooms (more meshes, one PointLight + SpotLight in dark scenes) is unmeasured.

## Data / environment disclosure

Fictional data only (`catalogHousehold()` fixture, synthetic member `MEM-001`). Local worktree; no push; no hosted, Supabase, Worker, secret, schema or Production interaction; no provider calls.

## Handoff

**Next owner: Codex** — integrate: rebase if main moved, run the Medium quick gate with `--focus=test/hercules-wardrobe-catalogue.test.ts --focus=test/hercules-wardrobe-navigation.test.ts --focus=test/hercules-wardrobe-room.test.ts`, request the independent trust review for the `tail` slot contract widening, then Jonathan's product look at `docs/evidence/hercules-room/`. State: **local, committed on `claude/hercules-room`**; not pushed, no PR, not merged, not deployed, not live-verified.
