# Hearth worksession — The Queen's creation and history

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-14 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/queen-ceremony`
- **Baseline SHA:** `76ab15b08fc1a6626a04e3363419004b3f9964ec` (`origin/main`, #472 — the Queen's charms; the charm patch handed over was already this commit, so `git am` had nothing to apply and nothing was re-applied)
- **Head SHA:** see the commit on the branch / `queen-ceremony.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (two cosmetic fields on the household King's studio draft, read by every studio piece reader; her existing `sculpt.profile` read within her bounds; a ceremony and three readings behind `VITE_QUEENS_NEST`; no money meaning touched)
- **Decision owner:** Jonathan (D-254)
- **Environment impact:** none — fictional fixtures only

## Household outcome

Before any money, the couple throws her on the wheel: one pulls the form, the other opens the rim, and she is kept. Every Chapter they close leaves a shallow ring in her, like a tree. She tips over to show their marks on her underside and the date they last worked on her. At each year's close a portrait of her goes on the Our Story shelf and never changes. Her light follows their day and their season — low and blue on a February evening, high and warm in July — without ever moving.

## Budget delta (5)

+0. No command, posting path, schema for money, Auth/RLS, sync, financial hash or Hercules payload changed. `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `allocateNestTotal`, the four categories, the tiers and `test/kitty-nest.test.ts` untouched. Conservation re-asserted with twelve closed Chapters on the household.

## Engagement delta (3)

+2. She becomes theirs from the first act (thrown, not bought), a record of every closed Chapter, a keepsake per year, and a room that changes with the day. Everything is keyboard-complete and reads in the flat path and with no WebGL.

## Verified baseline

Facts: `origin/main@76ab15b` (#472 merged); `git apply --check --reverse queen-charms.patch` exit 0 (the patch is `main`); `tsc --noEmit` clean; `test/goal-fill-ui.test.ts` red on `main` (6 of 7), untouched; no dependency added. Playwright's Chromium 1194 present in the container's cache; `playwright install` not run.

## Scope

### In scope

- `src/core/queenForm.ts` — her bounds (0.9..1.1 on the four handles), the two wheel turns (`queenWheelPull` moves belly and waist; `queenWheelRim` moves shoulder and neck), `queenRingCount` (closed Chapters, optionally up to a date), `queenRingSeats` (0.24..0.68 in v, 0.04 apart, crowding past eleven), `QueenWheelV1` and `QueenPortraitV1` shaped fail-closed, `queenPortraitDue`, `queenPortraitOf`.
- `src/core/queenLight.ts` — sun elevation from the books' civil date and the device clock at 43.7°N, quantized to the quarter hour; `level`, `warmth`, words; `queenLampShare` with a 0.62 floor.
- `src/core/types.ts` — `KittyPieceV1.wheel?`, `KittyPieceV1.portraits?`; `src/core/kittyStudio.ts` — `shapeKittyPiece` carries and validates them.
- `src/queen/world/queenCharmSurface.ts` — `QueenForm`; the skirt as radius over v (rest profile × handle multiplier × ring dips, height untouched); `queenSkirtProfilePoints` (128 samples so the lathe's uv is the base uv on every form); `queenSeamPathsFor` (seams follow the surface); `rings` refusal; every seat, settle, nudge, flat seat and flat pick take an optional form.
- `src/queen/world/queenSculpture.ts` — the lathe from the form; `setForm` rebuilds the skirt and the three seam tubes only on change and opens the shoulders with the neck; a reserved underside disc with `setMarks` (one 256px canvas texture, disposed on change and on dispose); `setTipped`; slender furled buds.
- `src/queen/world/queenCharmSet.ts` — `setForm` so charms ride the thrown surface.
- `src/queen/world/queenWorld.ts` — `form`, `tipped`, `marks`, `light` on the queen input; `setLight` scales sky and key within the floor, lifts the key with the sun, tints between #c9d6ea and #ffe2b8; stats carry the key lamp, rings and tip.
- `src/queen/world/queenAuthoring.ts` — the tenth channel; `queenForm`, `queenWheel`, `queenPortraits`; the guard clamps the profile, keeps a valid wheel, holds `context.kept` portraits immutable, refuses charms on rings via `context.rings`, drops strokes and stamps below the hem (the underside).
- `src/queen/QueenFigure.tsx` — `queenFlatVessel`, `queenFlatBand`, `queenFlatRings` from the same profile; ring arcs; the underside when tipped. `src/queen/QueenCharmGlyph.tsx` — seats on the form.
- `src/queen/QueenWheel.tsx` — the ceremony: whose turn, a range and a drag on the preview, hand over, keep; a kept record says who was signed in for each turn. `src/queen/QueenPortraits.tsx` — the shelf of flat stills.
- `src/queen/QueenHome.tsx` — the form draft while throwing, the tip (pull down 80px, ArrowDown; ArrowUp/Escape/press to right her), marks from `members` and the design's `updatedAt`, the light on a quarter-hour tick, sealing a due portrait once per mount, the three new Status sections, still words for rings, the wheel, the tip and the light. `src/queen/QueenCharmTool.tsx` — nudges settle on the form. `src/HouseholdHome.tsx` — `clock` (evidence only). `src/queen/queen-home.css`.
- `scripts/serve-household-home-proof.mjs` — `rings`, `wheel`, `portraits`, `today`, `clock`; seeded charms settle off the rings.
- Tests: `test/queen-ceremony.test.ts` (18), `test/queen-ceremony-layout.mjs` (36 records), two assertions updated in `test/queen-charms.test.ts` and one in `test/queen-world.test.ts` (ten channels; the guard reads the four handles within her bounds), `test/verification-focus-map.json`.
- Docs: D-254, roadmap line, this worksession, the handoff entry, `docs/evidence/queen-ceremony/`.

### Out of scope

- The three theme expressions, a freehand brush, sculpt dials beyond the wheel, rebuilding the vine (only the buds were made slender), a consent rule for shared authorship, wiring the wheel as Chapter 1's opening (no hook exists), an Our Story page (none exists; the shelf is a section in Status).
- Any change to `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `kittyNestDesigns.ts`, the categories, tiers or their tests.

## Acceptance evidence

- [x] A closed Chapter adds exactly one ring; an open one adds none; twelve closed give twelve; rings cannot be painted (nothing on the piece carries one; an unknown `rings` field is dropped by `shapeKittyPiece`), charmed (`rings` refusal; the guard drops a seat on a band; every keyboard seat still settles) or removed (derived from `chapters` only) — tests.
- [x] The wheel cannot produce a profile that hides a reserved channel or breaks the 40px silhouette: every corner and out-of-range input clamps to 0.9..1.1; feet, hands and fill refuse the same on every form; seams keep their rest stand-off within 0.05; her widest ≤ 1.35, her belly ≥ 0.8 — tests.
- [x] Both wheel turns are attributed (`wheel.pull.by`, `wheel.rim.by`) and the second changes a different part (the collar moves, the belly keeps the pull) — tests, browser.
- [x] The underside is not paintable (a stroke dipping below the hem is dropped; a stamp there is refused) and holds no charm seat (`feet` for every u at v ≤ 0.16) — tests.
- [x] A portrait is immutable through the guard and through a real second save; renders in both paths as a flat still (ten portraits, no canvas, no extra sculpture) — tests, browser.
- [x] The glaze axis reads fresh versus stale at the darkest and brightest half-hour of the year: the lamp share never drops under 0.62, the axis' roughness/clearcoat/env ratios are untouched by any light — test; the still says "Glazed: the evidence is fresh" at all four browser points.
- [x] Disposal returns geometry, material and texture counts to zero with twelve rings, marks and sixteen charms on her, and after a portrait's form and charms were set — tests.
- [x] No page scroll at 320×568, 390×844, 720×900, 1100×800 with sixteen charms, twelve rings, a shelf of ten and a thrown form, in 3D, flat and no-WebGL — browser.
- [x] Conservation holds with twelve closed Chapters — test.
- [x] The ceremony by keyboard alone with a ≥3px ring on the wheel, no progress bar, no step counter, no skip; 0 serious/critical axe hits — browser.

## Plan

- [x] Read the map; confirm the charm patch is `main`.
- [x] The record on the draft; the form-aware surface; rings as the tenth channel; the guard.
- [x] The sculpture (form, underside, tip), the world (light), the flat figure, the wheel, the shelf, Home.
- [x] Tests; browser evidence in three paths; quick gate; docs; patch.

## Evidence log

All commands from the branch root in the cloud container, Node 22.22.2, pnpm 10.14.0.

- `node_modules/.bin/tsc --noEmit` — clean.
- `vitest run test/queen-ceremony.test.ts` — 18/18.
- `pnpm test -- --risk=medium --focus=test/queen-ceremony.test.ts --focus-reason=…` — `quick-gate-passed`: diff-check, ai-surface, typescript (57.1s), test-discovery, vitest-fast (12 files, 161 tests), vitest-serial (proof-matrix 7); 92.9s, no breach; `uiProofRequired` met by the browser run below.
- `vitest run test/goal-fill-ui.test.ts` — 6 failed / 1 passed exactly as on `main`, untouched.
- `HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/queen-ceremony-layout.mjs` — `36 records, 0 serious/critical axe rule hits, 0 page errors`. Curated PNGs and `records.json` in `docs/evidence/queen-ceremony/`.
- Not run: `vite build` (the quick gate's typescript phase covers the types; the world code stays in the lazy `queenWorld` chunk as before).

## Performance — what was measured, and on what

SwiftShader (Chromium's CPU renderer) in the cloud container and jsdom in Node; there is no GPU and no phone here, so every number is an upper bound on CPU cost, not a GPU figure. Steady frames 1.2–1.8 ms at the full load; first frames 520–580 ms at the full load versus 342–376 ms with one ring and no charms. Node: 128-point profile with twelve rings 0.74 ms; lathe plus three seam tubes rebuilt on a wheel turn 9.1 ms (6,272 skirt vertices) — this runs per drag step while throwing and nowhere else; settling one charm off a ring 0.22 ms; a shelf of ten to markup 11.4 ms; a light reading 0.002 ms. The light re-reads on a quarter-hour timer, never on a frame; under reduced motion it is the same still state.

## Decisions and interpretations

- The thrown form is the piece's existing `sculpt.profile`, read within her own bounds; a bank's wider profile written onto her draft is clamped, not thrown. The four handles are the wheel's; nothing else on the sculpt is hers.
- Rings modulate the skirt's radius over v and never its height, so the mesh uv stays the base uv on every form and a charm's stored (u, v) is the same seat with one ring or twelve. The lathe is sampled at 128 points for that reason.
- Rings are the tenth reserved channel on the seat-centre rule the seams use: a charm's centre cannot sit on a band; it may overhang one as it may overhang the hem.
- The wheel is exposed from Status because the Chapter system has no opening hook; it is named there as the first act.
- Attribution is the signed-in member for each turn; the words hand over to the partner by name. On one device both turns can carry the same `by`, and the kept record says so.
- A portrait is a stored still: form, base and part colours, charms and the year's exact ring count (strokes are not kept); drawn flat in both paths, never a live sculpture. Sealed the first time Home opens after a year closes.
- The light is bounded (0.62 floor) and touches lamps only; the glaze axis rides material roughness, clearcoat and environment response, which the light never reaches.
- Her underside sits inside the feet channel; the paint sanitizer drops anything below the hem rather than adding an eleventh channel.

## Remaining uncertainty

- **Shared authorship is still not covered by the repo**, and the wheel makes it sharpest: an explicitly two-person act is saved on one member's word by `saveKittyNestDesign`. No consent rule was invented.
- Twelve rings read as soft ribbing on the glazed surface (depth 0.9% of the radius, half-width 0.012 in v); one ring reads as a band. Jonathan should judge the depth against the real pot.
- The flat vessel now follows the true profile; its hem is narrower than the earlier hand-drawn silhouette.
- A portrait sealed late (Home not opened for months) carries her form, clay and charms as of sealing, not as of December 31; the rings are exact.
- SwiftShader and Node timings, not a phone. Forced colours emulated only; VoiceOver and physical devices not exercised.

## Handoff

Local branch `claude/queen-ceremony` and `queen-ceremony.patch` only. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan — judge the ring depth against the pot, decide the shared-authorship question, and decide whether the wheel should become Chapter 1's opening when the Chapter system grows a hook.
