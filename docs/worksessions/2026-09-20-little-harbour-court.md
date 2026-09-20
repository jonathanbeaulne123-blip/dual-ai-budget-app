# Hearth worksession — Little Harbour slice 1: the Queen's Court

- **Status:** OPEN — local branch candidate, ready for Jonathan's eye and a PR
- **Opened:** 2026-09-20 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (architect + writer A; writers B, C, D merged by the coordinator)
- **Repository:** `dual-ai-budget-app`
- **Branch:** `claude/little-harbour`
- **Baseline SHA:** `10e05ed` (origin/main, "Enable the whole-house presentation in Development")
- **Head SHA:** see `git log -1` on the branch (the evidence commit)
- **PR or issue:** none yet — not pushed
- **Risk:** Medium (presentation only; a new flag; no money meaning, writer, schema, sync, Auth/RLS or Hercules payload change)
- **Decision owner:** Jonathan
- **Environment impact:** Development only (`VITE_HEARTH_HARBOUR: "1"` in `pages.yml` next to the house flag); Production untouched

## Household outcome

You sign in and you are standing at the gate of the Queen's Court: the Queen in her own pot at the centre of a worn chessboard terrace, the Everyday number carved on the flagstone at her feet, the Rook, the Bishop and the Knight on plinths with Build, Prepare and Protect engraved, a sundial whose shadow points at the next dated commitment, a mailbox whose flag is up when she noticed something, the slip pinned beside it, Hercules asleep on the warm stone, the partner's marker at the gate when they are here. Tap a piece and you are in the Loft or the Cellar with the same money tools as today; "← Put it back in the Court" returns you. Everything grows from the same reading the house already makes. No chrome but the compass, the environment pill and the sync line.

## Budget delta (5)

**+0.** `src/harbour/**` reads existing selectors (`fundSnapshot`, `projectKittyNest`, `fundPulse`, `presenceLines`, `deriveHouseCondition`, `bubbleNotice`, `cellarJars`) through the supported-interpretation freeze and opens existing doors (`openHouseObject("loft-banks" | "cellar-bills" | …)`). It never imports commands, the kitchen, the ledger, storage, continuity or the api (`test/harbour-source-fences.test.ts`). Nothing in the Court posts, settles or moves a cent; a null figure is "—", never "$0".

## Engagement delta (3)

**+2.** The first screen is the wow the vision asked for: her court in three themes, touchable (crown, vines, hands, face, roots, pot rim), the four numbers as stone, the next date as a shadow, her notice as a flag. The quick sheet keeps every one of the sixteen tools one tap away; the reading edition keeps every door a button when WebGL is absent or refused.

## Verified baseline

Facts: `origin/main@10e05ed` renders `HouseWorld` at `src/App.tsx` (the seam now at the `HOUSE_WORLD_ENABLED&&(…)` line) for every room; the shared renderer lease is keyed on `VITE_HEARTH_HOUSE_WORLD`; the house's return records use `readHouseReturn/saveHouseReturn`; the Living Presence master and the v1 Queen ship under `public/models/`; `test/app-startup-p1.test.ts` runs the full App with every flag unset.

Inferences: the Form Core pieces (1.58–1.65 MB raw) are light enough to load after the Queen on a phone; the decimated court Queen (3.5 MB raw, 2.2 MB gz) is what the lite tier draws and it reads well at portrait distance (verified by captures, not on a real phone).

## Scope

### In scope

- `src/harbour/**` (29 files): flag, arrival rule, reading adapter + hook, door signs, assets manifest + gz-first ref-counted loader, scene contract (`Place`), quality tiers, frame policy, light rig, island ground, runtime (lease, camera, pointer routing, twins projection, suspend snapshot), the Court scene (paving, plinths, engraved plates, sundial, mailbox + slip, gate, Hercules, partner marker, props per theme), the Queen's place and touch grammar, camera poses + court camera on the island's `RoamCam` maths, the compass, the quick sheet, the twins, the reading edition, the shell.
- Four additive App seams: arrival at `locate()`, `data-harbour-court`, the lazy `HarbourWorld`/`HouseWorld` switch inside `Suspense` with the `CourtFlat` fallback, the compass + quick sheet in place of the nav (one new `quickSheetOpen` state; the household switcher and the space switch moved into nodes the sheet receives when the Court owns the route).
- `rendererOwner.ts` also keyed on `VITE_HEARTH_HARBOUR`; `pages.yml` and the whole-house review server turn the flag on; `test/verification-focus-map.json` maps `src/harbour/**`.
- Assets: `public/models/court/{knight,bishop,rook}.v1.glb` (+ `.gz`) and `public/models/mandevilla-living-presence.court.glb` (+ `.gz`), hash- and size-fenced.

### Out of scope

- Study, Kitchen, Making, Together as harbour places (the compass sends them to Codex's rooms).
- Walk mode, Bloom V2 vines history, the decimated Queen on the full tier (the master stays), the cistern water level, Bianca's live figure walking.
- Personal scope (keeps `HouseWorld` untouched).
- Any money meaning, command, schema, sync, Auth/RLS or Hercules payload.

## Acceptance evidence

- [x] Flag unset: `test/app-startup-p1.test.ts` 83/83 green; `HouseWorld` path byte-identical.
- [x] Flag set: `vite build` succeeds; `HarbourWorld`, `runtime`, `CourtScene` are lazy chunks.
- [x] Captures at 320/390/720/1100/1440 × classic/taylor/newfoundland × {arrival, keyboard focus, piece tap → Loft/Cellar with door strip, her portrait with the phrase, quick sheet, reading edition} — `docs/evidence/little-harbour/` (91 files, `report.json` carries tier, draw calls, twin labels, console errors: none).
- [ ] Jonathan's own eye on a real phone and a real desktop (SwiftShader stills are not a device).
- [ ] Trust review of the App seams by a second reader before merge.

## Plan

- [x] Step 0 flag, arrival, seams, reading edition v0
- [x] Step 1 reading adapter, hook, door signs (B)
- [x] Step 2 assets manifest, loader, fence, decimated Queen (C)
- [x] Step 3 scene contract, quality, frame policy, light rig, ground, runtime (A)
- [x] Step 4 dressing, engraved plates, sundial, mailbox, pieces, CourtScene (D)
- [x] Step 5 queenPlace, queenTouch (B)
- [x] Step 6 camera poses, court camera (C)
- [x] Step 7 shell, twins, reading edition, css (A) + reconciliation of B/C/D on one contract
- [x] Step 8 compass, quick sheet, App swap (D)
- [x] Step 9 source fences, focus map, review-server flag, evidence, this note, D-287

## Evidence log

All on `claude/little-harbour`, Linux container, `pnpm 10`, `node_modules` from the frozen lockfile, fictional Development data only.

- `pnpm exec tsc --noEmit -p tsconfig.json` → exit 0 (≈57 s).
- `pnpm exec vitest run test/harbour-*.test.ts test/house-*.test.ts test/whole-house-navigation.test.ts test/queen-model.test.ts test/renderer-owner.test.ts test/journey-roam-camera.test.ts` → 24 files, 209 tests passed (before the pose retune); `test/harbour-*.test.ts` after the retune → 11 files, 123 tests passed.
- `pnpm exec vitest run test/app-startup-p1.test.ts` → 83 passed.
- `VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 pnpm exec vite build` → exit 0 (`HarbourWorld-*.js` 25 kB, `CourtScene-*.js` 25 kB, `runtime-*.js` 16 kB, plus the chunk-size warning main already has).
- `node scripts/serve-whole-house-review.mjs` + `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-little-harbour-evidence.py docs/evidence/little-harbour` (chromium, `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist`, `prefers-reduced-motion: reduce` for stills). Every combination reached `data-world-status="ready"` with the Queen's six twins present; draw calls 110–173; zero console errors.
- Three visual passes were needed: (1) the first desktop diorama looked down on the court with the gate arch and sundial looming in front of her — retuned to a real three-quarter (`theta 0.5, phi 1.04`, the target a little right and in front of her, `r` fit to the plinths with a floor of 11.5); (2) the retune first came in too close (the Rook cut at the right edge) — the fit dropped its shoulder subtraction; (3) a 720-wide portrait tablet was a small, cut court — a column (aspect < 1.05) now takes the phone framing at `r 9.5`. Her phrase moved left of the desktop compass pill.

## Decisions

D-287 (below in `docs/DECISIONS.md`): the harbour owns a route by room, not by replacing the house; one flag that requires the house flag; the Court is the first screen once per tab per house identity; money code untouched; one read model; the Queen by tier (master on full, decimated court copy on lite, v1 as the fallback); the three pieces are the Form Core kit as supplied.

## Remaining uncertainty

- SwiftShader stills at DPR 1 are not a phone. Real-device feel (breathing at 20 fps, drag orbit, pinch, the spark) is unmeasured; the tier on Jonathan's Mac will be `full` (the 12.9 MB master), which the captures did not exercise (headless reports ≤ 4 cores → `lite`).
- The touch grammar's actions are wired but only the tap/portrait path has capture evidence; the strokes, spin, distance, weeks window and growth lens ran in jsdom (runtime routing tests) and by hand in the shell code, not under a browser pointer.
- On a phone the Rook and Knight are one swipe away (C's finding: the plinths cannot fit a portrait column at any legal distance); their twins exist only when in frame, so the quick sheet is their keyboard path. The Bishop peeks at the bottom-left of the phone frame.
- The due-reminders guard renders its panel below the stage on the Court as it does on Home today; that is the App's existing behaviour, not the Court's.
- The full quick gate (`pnpm test -- --risk=medium --focus=…`) was not run end to end; the selected files, tsc and the build were.

## Handoff

Next owner: Jonathan. State: **local only** on `claude/little-harbour` — not pushed, no PR, not merged, not deployed, not live verified. Push, open the PR for a second reader's trust review of the four App seams and the fences, and look at `docs/evidence/little-harbour/` before pulling a real phone out.
