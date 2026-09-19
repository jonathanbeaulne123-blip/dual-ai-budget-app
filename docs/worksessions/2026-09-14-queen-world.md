# Hearth worksession — The Queen's world (the studio's 3D ported into Home)

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-14 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/queen-world`
- **Baseline SHA:** `2f5e9c58c601393d06b0af49417929bed6a5a7a0` (`origin/main`, #470 — the Still Queen)
- **Head SHA:** see the commit on the branch / `queen-world.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (a WebGL world behind `VITE_QUEENS_NEST`; presentation only; one cosmetic write path for the shared King design through the existing command)
- **Decision owner:** Jonathan (D-252)
- **Environment impact:** none — fictional fixtures only

## Household outcome

Home is the same still field as the Still Queen, but she and her banks are real sculptures. She is her own model — a seated vessel with a mandevilla vine — and Protect, Build and the goals inside Build are the kitty banks the couple sculpted, painted and fired in the studio, wearing exactly that. Nothing moves unless touched; she breathes slowly at rest and stops when opened. When there is no WebGL, nothing is lost: the drawn Queen and the flat twins of the banks carry every reading. The couple can dress her from Status — clay and a mark — and keep it, but no kiln exists for her: her surface says whether the evidence is fresh, and only that.

## Budget delta (5)

+0. No command, posting path, projection, schema, Auth/RLS, sync, financial hash or Hercules payload changed. `kittyNest.ts`, `householdFund.ts` and `fundPulse.ts` are consumed unchanged; `allocateNestTotal`, the four categories, the tiers and `test/kitty-nest.test.ts` are untouched (`protect` + `prepare` → Protect, `everyday` → her belly, `build` → Build, at the presentation layer). Her look is written only through the existing `saveKittyNestDesign` on the household King, after `guardQueenDesignSave` removes any kiln. Money is still touched only through the existing gallery.

## Engagement delta (3)

+2. The banks on Home are the couple's own authored pieces, fired reading fired; she is a figure with depth the couple can dress together; every state still has a legible still with no pixel of WebGL, in forced colours, with easy read and under reduced motion.

## Verified baseline

Facts: `origin/main@2f5e9c5` (the Still Queen merged as #470); `tsc --noEmit` clean; `test/goal-fill-ui.test.ts` red on `main` (6 of 7), untouched; `three@0.185.1` already a dependency, no dependency added; `KittyStage`, `sculpture.ts`, `nestSculpture.ts`, `studio/flat.tsx`, `paintCanvas.ts`, `nestAppearance.ts` read and consumed as they are.

## Scope

### In scope

- `src/queen/world/queenAuthoring.ts` — pure: the paintable parts (body, head), the nine reserved channels, `queenSanitizePaint` / `queenStampAllowed` (strokes and stamps only on body and head; no stamp on the head's upper third where the eyes, brow and crown sit; no crown, hat or glasses kind anywhere on her), `queenGlazeAxis` (freshness → the fired/unfired material numbers; `firedAt` ignored), `queenLook` (draft-first), `guardQueenDesignSave` (refuses `fire`, `completeSetup`, `archived`, any bank but the household King; drops `firedAt`/`firedBy`; sanitizes), `queenBankPiece` / `queenBankFired` / `queenBankGlaze`, `queenPose`, `queenWorldStill`.
- `src/queen/world/queenSculpture.ts` — her model: lathe skirt and belly (paintable body), head (paintable), reserved clay shoulders and hands, face (closed arcs / open whites and pupils with gaze, brow, three mouths), crown with a point light, three gold seams, the vine with five leaves and four buds, four stones at her feet. `setPose`, `setFill`, `setGlaze`, `setCrown`, `setSeams`, `setVine`, `setFeet`, `setPaint`, `setBreath`, `dispose`; no `setFired`.
- `src/queen/world/queenWorld.ts` — one renderer (alpha, antialias, low-power, `preserveDrawingBuffer`, pixel ratio ≤ 1.5, no shadow maps), one scene, `PerspectiveCamera(34)` fixed; the banks as `createKittySculpture` pieces (`setSpin(0)`, `setIdle(false)`, `setOpen(false)`), rebuilt only when the piece, its paint or its firing changes and disposed when they leave; DOM-driven `layout()` placing every sculpture on its control's rect on the z = 0 plane, rendering only when a rect actually moved; `invalidate()` coalescing to one frame; a breath loop only while asked and only under motion; context loss → `onLost`; full disposal.
- `src/queen/QueenWorld.tsx` — the decorative host: dynamic import, forced colours or `world="flat"` → nothing rendered; a failed constructor or a lost context → silent flat; `ResizeObserver` and a short settle loop through the expand transition.
- `src/queen/QueenHome.tsx` — world inputs from the same selectors; `data-world`; `BankPortrait` (the studio's `KittyFlat` twin with `data-world-bank` and `data-fired`) replacing the hand-drawn vessel; a goal row under Build when expanded; the Build door names its goals; the 3D still in words when live; "Her look" in the Status peek (five clays, a mark on the belly, Keep / Undo, kept-date line). `src/queen/QueenFigure.tsx` — `QueenBankVessel` retired. `src/HouseholdHome.tsx` — `world` prop. `src/queen/queen-home.css` — the host, the yield rules, portraits, the look tool.
- `scripts/serve-household-home-proof.mjs` — `world=auto|flat|3d`. `test/verification-focus-map.json` — the world mapping.
- Tests: `test/queen-world.test.ts` (13), `test/queens-nest-ui.test.ts` (+3), `test/queen-world-layout.mjs` (28 records).
- Docs: D-252, roadmap line, this worksession, the handoff entry, `docs/evidence/queen-world/`.

### Out of scope

- A freehand brush on her, sculpt dials for her, props beyond a belly mark; the full `KittyStudio` bench for her (the tool here is deliberately small so the reserved channels can be enforced in code).
- Any change to `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `kittyNestDesigns.ts`, the categories, tiers or their tests; the three theme expressions; the mandevilla form from photographs.

## Acceptance evidence

- [x] Every pulse state produces a distinct, non-empty still description in both the flat (`queenStill().description`) and the 3D (`queenWorldStill`) path (test); the DOM still switches to the 3D words only when the world is live (test, browser).
- [x] A bank with no WebGL renders its full reading: the studio's flat twin, `data-fired`, amounts and goal names in the door's accessible name; jsdom (no WebGL) and a Chromium with `--disable-3d-apis` both degrade silently with no note (test, browser).
- [x] Fired versus unfired resolves to different material parameters (`createNestSculptedProp` `.23/1` vs `.86/0`; `QUEEN_GLAZE_AXIS`) (test).
- [x] Conservation: the three banks pass the four categories through and sum to the King to the cent; `allocateNestTotal` conserves including debt (test).
- [x] Disposal: every geometry, material and texture is disposed, counts return to zero, the group is emptied (test); the world disposes banks, environment, renderer and forces context loss (code).
- [x] The page does not scroll at 320×568, 320×700, 390×844, 720×900, 1100×800 in the 3D path (rest, expanded, peek, cellar), the flat path and the no-WebGL path (browser).
- [x] No studio operation can obscure, recolour or remove a reserved channel: the vine, crown, eyes and brow, seams, hands, feet and glaze axis are each covered individually — reserved meshes never share the paintable materials or carry a map, keep their colours under a paint that tries every part, stay visible under a false-crown stamp; the axis ignores `firedAt` (test).
- [x] The Queen cannot be fired by any path through the world's tool: `fire`, `completeSetup` and `archived` throw; a fired draft is kept wet; her sculpture has no `setFired`; the Status tool has no kiln control (test).
- [x] Render on demand: 0–2 frames while nothing changes; the breath runs only at rest under motion and stops when expanded (browser).
- [x] Keyboard order and a 3px ring over the canvas identical to the flat path (browser). 0 serious/critical axe hits; 0 page errors (browser).

## Plan

- [x] Read the studio: stage, sculpture, nest props, flat twin, paint canvas, designs and their command.
- [x] Authoring guard; her model; the world; the host; Home integration; the look tool.
- [x] Mapping tests; jsdom tests; browser evidence in both paths and with no WebGL.
- [x] Quick gate; build; docs; patch.

## Evidence log

All commands from the branch root in the cloud container, Node 22.22.2, pnpm 10.14.0.

- `node_modules/.bin/tsc --noEmit` — clean.
- `vitest run test/queen-world.test.ts test/queens-nest-ui.test.ts test/queens-nest.test.ts` — 50/50.
- `vitest run test/kitty-nest.test.ts test/kitty-nest-ui.test.ts test/home-feedback-ui.test.ts test/vision-v2-home-ui.test.ts test/queens-nest.test.ts test/queens-nest-ui.test.ts test/queen-world.test.ts test/plan-worlds.test.ts test/kitty-studio.test.ts` — 9 files, 97/97.
- `pnpm check` (Medium, no focus, as CI runs it) — `quick-gate-passed`: diff-check, ai-surface, typescript (56.7s), test-discovery, vitest-fast 9 files / 87 tests, vitest-serial 5 files / 110 tests; 181.1s of the 300s budget, no breach; `uiProofRequired: true`, satisfied by the browser run below.
- `vite build` — built in 18.0s; `three` stays in its own lazy chunks (`three.module` 90 kB gzip, `three.core` 103 kB gzip) loaded only when the world mounts. `pnpm build` in full (including the workspace Worker type-check) was not run.
- `vitest run test/goal-fill-ui.test.ts` — 6 failed / 1 passed exactly as on `main`, untouched.
- `HEARTH_CHROMIUM=… node test/queen-world-layout.mjs` — `28 records, 0 serious/critical axe rule hits, 0 page errors`. Curated PNGs and `records.json` in `docs/evidence/queen-world/`.

## Performance — what was measured, and on what

Measured inside the evidence run on SwiftShader (Chromium's CPU renderer in the cloud container; there is no GPU and no phone here), 390×844 unless noted: steady-state frames 1–6 ms; first frames 280–420 ms while shaders compile; the expand's first frame 155–217 ms because three kitty sculptures (each with six canvas textures) compile at once; the breath loop at ~10 frames/s in software, stopped entirely when expanded, when a peek is open, in a room, under reduced motion or when the tab is hidden; 0–2 frames in 700 ms while nothing changes. One canvas, pixel ratio ≤ 1.5, no shadow maps, sculptures rebuilt only on a piece/paint/firing change and disposed when they leave. What a mid-range phone does with this was not measured; the numbers above are an upper bound on CPU cost, not a GPU figure.

## Decisions and interpretations

- Base: `origin/main` after #470, so the world lives inside the Still Queen rather than re-implementing it.
- Her look lives on the household King design's `studio.draft` — the shared Fund's existing cosmetic record — read draft-first so that a King piece the couple fired in the gallery's setup ceremony is still shown but never as fired.
- Reduced motion keeps the 3D path (still, no breath); forced colours take the flat path; a failed or lost context takes the flat path silently. `world=flat` exists for evidence and as an escape hatch; no user-facing toggle was added.
- The "her look" tool is deliberately small (clay, one belly mark): the reserved channels are enforced in `guardQueenDesignSave` and by her geometry, not by a warning. The full studio bench (freehand brush, stamps anywhere, props) for her is future work that must route through the same guard.
- Panels, doors, the expand, rooms and the Move are unchanged from the Still Queen; the canvas sits behind them with `pointer-events: none`.

## Remaining uncertainty

- **Shared authorship is not covered by the repo.** `saveKittyNestDesign` saves a household design on one active member's word; the household commands that need two people (Plan acknowledgement digests, Bridge proposals, contribution motions) are money- or plan-shaped and do not extend to cosmetics. The tool therefore does not let one person restyle her *silently* — a kept look shows its date in Status and says both author her — but it does let one person restyle her alone. No consent rule was invented.
- **The King can still be fired in the gallery.** The nest's King setup ceremony fires the King piece (`completeSetup` requires it). The world ignores `firedAt` for her surface and its own tool refuses the kiln, so her reading is intact, but a fired King piece exists as data. Retiring that ceremony is a product decision, not taken here.
- `guardQueenDesignSave` is enforced in the world's tool, not in `kittyNestDesigns.ts`; a caller that bypasses the tool can still write a fired King draft. Changing the core command was outside the boundaries.
- SwiftShader timings, not a phone. Paint textures on her (two canvases) are the same 512² size the studio uses.
- The `--queen-under` chrome reservation from Stage 1 still stands in for the real App page.
- The artwork remains a stand-in for the mandevilla form.

## Handoff

Local branch `claude/queen-world` and `queen-world.patch` only. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to decide on the shared-authorship rule and the King kiln; Codex for an independent read of `guardQueenDesignSave` and the disposal path; a phone measurement before any default-on decision.
