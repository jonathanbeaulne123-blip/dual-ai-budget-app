# Hearth worksession — The Queen's charms

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-14 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/queen-charms`
- **Baseline SHA:** `7b2678634aa2feb5c20c2911c8e1a6894fd46e20` (`origin/main`, #471 — the Queen's world)
- **Head SHA:** see the commit on the branch / `queen-charms.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (a cosmetic field on the household King's studio draft, read by every studio piece reader; a placement tool behind `VITE_QUEENS_NEST`; no money meaning touched)
- **Decision owner:** Jonathan (D-253)
- **Environment impact:** none — fictional fixtures only

## Household outcome

The couple can stick small ceramic things onto her — a sitting cat, a teapot, a paper boat — where they choose, the way a paint-your-own-pottery studio sells bisque add-ons. Six are in the bin from the first day; six more come only from what the household actually did: a travel goal filled and bought, a Ritual held ten times, a Chapter closed after a hard month, the Charter signed by both, the first Sitdown, a correction mended. Free placement plus a spin, a lean, a size and a colour means no two households' Queens look alike. A charm pressed onto her vine, crown, face, hands, seams, hem or the belly's fill window slides off to where it can sit, or does not take — no dialog, no toast. Each charm says who pressed it on. A household with no WebGL sees the same charms at the same seats on the drawn Queen.

## Budget delta (5)

+0. No command, posting path, schema for money, Auth/RLS, sync, financial hash or Hercules payload changed. `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `allocateNestTotal`, the four categories, the tiers and `test/kitty-nest.test.ts` are untouched. Charms live as an optional `charms` field on the King design's `studio.draft` — the shared Fund's existing cosmetic record — written only through the existing `saveKittyNestDesign` after `guardQueenDesignSave`. Unlocks read only `chapters`, `rituals`, `goals`, `transactions`, `sitDownSessions` and `charter` (a test asserts nothing else is touched); nothing about money in earns anything.

## Engagement delta (3)

+2. The Queen becomes a record of a real year — each earned charm is an act the couple did — and a thing no other household has. The bin, the bench and the press are real DOM controls that work without a pointer; every state keeps a legible still in the flat path, in forced colours, with easy read and under reduced motion.

## Verified baseline

Facts: `origin/main@7b26786` (#471 merged); `tsc --noEmit` clean; `test/goal-fill-ui.test.ts` red on `main` (6 of 7), untouched; `three@0.185.1` already a dependency, no dependency added (`three/examples/jsm/utils/BufferGeometryUtils.js` ships with it); `queenSculpture.ts`, `queenAuthoring.ts`, `queenWorld.ts`, `nestSculpture.ts`, `kittyStudio.ts`, `kittyNestDesigns.ts`, `chapters.ts`, `charter.ts` and the goal purchase command read and consumed as they are.

## Scope

### In scope

- `src/core/queenCharms.ts` — the record (`QueenCharmV1`: id, kind, part, u, v, spin, tilt, scale, colour, `by`), the twelve kinds with labels and earned-by reasons, the cap (16) and bounds, `queenCharmsEarned` / `queenCharmKindsEarned` (pure over existing records), `shapeQueenCharm(s)` (fail closed, quantized).
- `src/core/types.ts` — `KittyPieceV1.charms?`; `src/core/kittyStudio.ts` — `shapeKittyPiece` carries and validates it (it previously dropped unknown fields, so without this the record would not persist through sync).
- `src/queen/world/queenCharmSurface.ts` — pure surface maths shared by both paths: the skirt profile and head constants her sculpture now builds from, (part, u, v) → 3D seat and normal, the inverse, the reserved zones in surface coordinates, `queenCharmRefusal` / `queenCharmAllowed`, `queenCharmSettle` (the slide-off), keyboard seats, nudges, the flat seat and the flat pick.
- `src/queen/world/queenCharmLibrary.ts` — the twelve charms from primitives (sphere, cylinder, cone, torus, lathe, extruded shape), each merged into a body geometry and an ink accent.
- `src/queen/world/queenCharmSet.ts` — instanced meshes per kind on the body group, per-instance matrix and colour, brooch orientation (back against her, up along her surface, spin about the normal, a small lean), her glaze axis applied to them, belly-width follow, counts, disposal.
- `src/queen/world/queenSculpture.ts` — builds the skirt and head from the shared constants; `setCharms`, `pick(raycaster)`, `charmCounts`; fill and glaze reach the charms; disposal includes them.
- `src/queen/world/queenWorld.ts` — `charms` on the queen input; `pick(clientX, clientY)`; charm counts in stats. `src/queen/QueenWorld.tsx` — passes `pick` up.
- `src/queen/world/queenAuthoring.ts` — `queenSanitizeCharms`, `queenWornCharms`, and `guardQueenDesignSave(input, context?)`: unearned kinds and reserved seats dropped; told nothing about the household, only the starters survive.
- `src/queen/QueenCharmGlyph.tsx` — the flat twins (SVG silhouettes, foreshortened by how much the seat faces the room) and the bin icon. `src/queen/QueenFigure.tsx` — draws them, body charms inside the belly group so they widen with the fill.
- `src/queen/QueenCharmTool.tsx` — the bin (earned and not-yet, each named with its reason), the list of what is on her with seat words and the presser's name, the bench (Move with arrow keys, Turn, Smaller, Bigger, Lean, 24 palette swatches, Take off).
- `src/queen/QueenHome.tsx` — the draft, kept as you go (700 ms after the last press, flushed on unmount), `addCharm` (a free seat, selected), the press target over her while a charm is picked up (3D ray or flat pick, settled), Enter walks to the next free seat, a field tap puts the bin down, charm words in the still, `data-charms` / `data-charm-selected`; the existing "Keep her look" now shares the one `keepDesign` path.
- `src/queen/queen-home.css` — the target, the bin, the bench, forced colours, easy read.
- `scripts/serve-household-home-proof.mjs` — `charms=none|few|max|gallery` with the earning acts seeded through ordinary commands.
- Tests: `test/queen-charms.test.ts` (14), `test/queens-nest-ui.test.ts` (+4), `test/queen-charms-layout.mjs` (35 records), `test/verification-focus-map.json`.
- Docs: D-253, roadmap line, this worksession, the handoff entry, `docs/evidence/queen-charms/`.

### Out of scope

- Growth rings, throwing her on the wheel, maker's marks, the yearly portrait, living light, a freehand brush, sculpt dials, the three theme expressions.
- Any change to `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `kittyNestDesigns.ts`, the categories, tiers or their tests; a consent rule for shared cosmetics.

## Acceptance evidence

- [x] A charm cannot be written onto any of the nine reserved channels, each covered individually through the guard: vine, fill, eyes, crown, seams, hands and feet by seat; posture and glaze because a charm record carries no such field (extra keys are stripped) and never changes the body group's pose or the material axis (test).
- [x] Her reserved geometry, projected onto her surface, lands in a refusal — face, crown, vine, hands, every seam control point, the hem (test).
- [x] An unearned charm cannot be placed: the guard drops it with or without household context; a fixture that has done nothing gets only the starters; the bin shows it as not-yet with its reason (tests, UI test).
- [x] Every unlock derives from existing `chapters.ts`, Charter and goal records, one at a time, and the derivation reads nothing else on the household (Proxy test).
- [x] Charms round-trip through `guardQueenDesignSave` → `saveKittyNestDesign` → `queenWornCharms`, through `shapeKittyPiece`, and a `fire` / `completeSetup` write is still refused (test).
- [x] The flat path renders the same charms as the 3D path: every charm drawn at the seat its instance sits at, the flat pick and the 3D ray agree, the fill widens both (tests, browser at every width and bin).
- [x] Disposal returns geometry, material and texture counts to zero, with the charm geometries disposed (test).
- [x] The page does not scroll at 320×568, 320×700, 390×844, 720×900 and 1100×800 with the maximum of sixteen charms in the 3D, flat and no-WebGL paths (browser).
- [x] Conservation: the three banks still sum to the King to the cent; `allocateNestTotal` conserves including debt (test).
- [x] Render on demand at the cap: 0–2 frames while nothing changes; at most two draw calls per kind in use (browser).
- [x] The bench is real controls in a sensible order with a ≥3px ring; a keyboard user places (bin), moves (arrows, Enter to the next free seat), turns, sizes, recolours and removes a charm without a pointer; 0 serious/critical axe hits (browser, UI test).
- [x] A pointer press on her eye or on the fill window leaves the charm where it sat; a press near a seam slides it off (browser, tests).

## Plan

- [x] Read the foundation: her sculpture, the guard, the world, the nest props, the studio shape, the Chapter system, the Charter, the goal purchase.
- [x] The record on the draft; the surface maths and zones; the library; the instanced set; the guard.
- [x] The flat twins; the tool; the press; kept as you go.
- [x] Tests; browser evidence in three paths; quick gate; build; docs; patch.

## Evidence log

All commands from the branch root in the cloud container, Node 22.22.2, pnpm 10.14.0.

- `node_modules/.bin/tsc --noEmit` — clean.
- `vitest run test/queen-charms.test.ts test/queen-world.test.ts test/queens-nest-ui.test.ts test/queens-nest.test.ts test/kitty-studio.test.ts test/kitty-nest.test.ts test/kitty-nest-ui.test.ts test/kitty-studio-ui.test.ts test/kitty-envelope.test.ts test/kitty-banks.test.ts test/home-feedback-ui.test.ts test/vision-v2-home-ui.test.ts test/plan-worlds.test.ts` — 13 files, 136/136.
- `pnpm check` (Medium, no focus, as CI runs it) — `quick-gate-passed`: diff-check, ai-surface, typescript (74.8s), test-discovery, vitest-fast 10 files / 140 tests, vitest-serial 1 file / 7 tests; 121.4s of the 300s budget, no breach; `uiProofRequired: true`, satisfied by the browser run below.
- `vite build` — built in 24.2s; the charm world code rides in the lazy `queenWorld` chunk (18.3 kB, 7.5 kB gzip) with `BufferGeometryUtils` (1.5 kB gzip) beside the existing lazy `three` chunks. `pnpm build` in full (including the workspace Worker type-check) was not run.
- `vitest run test/goal-fill-ui.test.ts` — 6 failed / 1 passed exactly as on `main`, untouched.
- `HEARTH_CHROMIUM=… node test/queen-charms-layout.mjs` — `35 records, 0 serious/critical axe rule hits, 0 page errors`. Curated PNGs and `records.json` in `docs/evidence/queen-charms/`.

## Performance — what was measured, and on what

SwiftShader (Chromium's CPU renderer) in the cloud container; there is no GPU and no phone here, so every number is an upper bound on CPU cost, not a GPU figure. With sixteen charms of eleven kinds: 21 draw calls (an instanced body and an instanced ink mesh per kind), 21 geometries built once and kept, steady-state frames 1.6–5.1 ms, first frames 549–663 ms versus 399–549 ms with no charms; 0–2 frames in 700 ms while nothing changes. In Node: all twelve kinds build in ~62 ms (26,580 non-indexed vertices in the whole library, 120–4,128 per kind), sixteen charms lay out in ~16 ms the first time and ~0.4 ms on a re-lay, the worst-case slide search ~0.4 ms. Nothing animates; the charms have no texture; identical kinds are instanced, never duplicated.

## Decisions and interpretations

- The record rides `studio.draft.charms` on the household King design. Because `shapeKittyPiece` whitelists fields, it now carries `charms` — the one core touch beyond the new file — so the record survives sync; every other piece simply never has it.
- Coordinates are the part's own uv, exactly as free-placed stamps are stored, so the raycaster's `uv` and the flat figure read the same numbers; the sculpture now builds the skirt and the head from the constants the maths uses.
- A charm is a brooch, not a hat: its back is against her, its up is the world's up along her surface. Seen from the fixed camera a charm on a flank is foreshortened in both paths (the flat path stops at 45% so the silhouette still reads).
- Reserved zones are surface regions derived from where her reserved meshes sit, verified by projecting those meshes in a test; seams are 3D corridors around the seam paths; "the belly's fill window" is the front-centre band of the belly; the hem (her feet) is the bottom fifth of the skirt; a seat that faces away from the room does not take either, so nothing can be hidden on her back.
- The physical refusal: a pressed charm settles to the nearest allowed seat within 0.3 world units (under one charm width) or will not take at all. No words anywhere.
- Kept as you go (a short pause after the last press) rather than a Keep button, so the phone flow works: pick up in the Status sheet, close the sheet, press her, tap the field to put the bin down.
- "Earned" derivations: airplane = a goal retired with a purchase whose name the nest already reads as travel (the travel words from `nestCategoryFor`; there is no travel flag on goals — the weakest derivation here); mug = `heldOn.length >= 10`; snail = a Chapter closed as `still-forming` or `life-changed`; key = `charterIsSigned`; bell = a Chapter opened or closed at a Sitdown, or a closed `SitDownSession`; spool = any non-duplicate reversal (the same evidence a gold seam reads, in any month).
- Colours come from the existing 24-dip studio palette; a new charm takes a palette colour by turn so successive charms differ.

## Remaining uncertainty

- **Shared authorship is still not covered by the repo.** A charm is saved on one active member's word through `saveKittyNestDesign`, as her look already is. Authorship is now visible — each charm carries `by` and the list and the still say who pressed it on — but one person can still dress or undress her alone, and `by` is what the writer says it is. No consent rule was invented; Jonathan's decision.
- The guard runs in the tool; `kittyNestDesigns.ts` was left unchanged, so a caller bypassing the tool can still write a charm on a reserved zone or an unearned kind into the King's draft — the world would draw it. Enforcing the guard inside the core command would be a change to a shared command and was outside the boundaries.
- The paper-airplane derivation leans on the nest's travel words; a goal named without them ("Lisbon") earns nothing. Retiring a goal without a purchase earns nothing on purpose.
- SwiftShader timings, not a phone. At 320×568 inside the App she is ~150 px tall and sixteen charms are specks — the composition holds, but they read as texture rather than objects at that size.
- The flat figure is a stand-in for the mandevilla form and its proportions differ slightly from the sculpture's, so the same seat sits a few pixels apart between paths; the evidence script uses per-path feature spots for that reason.
- Forced colours emulated only; VoiceOver and physical devices not exercised.

## Handoff

Local branch `claude/queen-charms` and `queen-charms.patch` only. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan for the consent question and whether the guard should move into the core command; Codex for an independent read of `queenSanitizeCharms`, the zone maths and the disposal path; a phone measurement at the cap before any default-on decision.
