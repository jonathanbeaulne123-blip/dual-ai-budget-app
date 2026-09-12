# Kitty Bank Studio v2 — nothing is final, paint outside the lines, pieces that tell the story

- Status: IMPLEMENTED LOCALLY on `claude/kitty-studio-v2`; typecheck, kitty suites and the medium-high quick gate passed; browser evidence captured. No push, merge, deployment, schema or real-household write.
- Owner and decision owner: Jonathan (2026-09-12: "each kitty bank needs to tell a story … 3d paint jobs need to also apply to the 2d models … eyes and face features dont work good enough … need ability to stop spinning … need ability to make each feature bigger/smaller … crock a doodle style add ons … too much information to enter … need to allow to 'paint outside the lines' … a brush indicator that adapts to the size selector … users should be able to go back and repaint/refire/delete kitty banks whenever they want")
- Assignee: Claude (sole writer on this worktree). Next owner: Codex for independent audit of the envelope/sync surface.
- Repository: dual-ai-budget-app · branch `claude/kitty-studio-v2` from `main` `317a041`
- Risk: Medium-High. `GoalEnvelope.studio` gains optional fields and loses the fired-is-final guard; no journal, posting, projection, schema or PGlite change. The studio still never reads or writes money.
- Environment: local worktree, fictional `planLifeFixture` books only, headless Chromium with SwiftShader WebGL.

## Household outcome

Making a Kitty Bank is now closer to an evening at a paint-your-own-pottery table. A bank starts with two fields — a name and an amount — and everything else is folded away. In the studio the brush shows a ring the size of the mark it will make, keeps painting when the stroke runs past the edge of the clay, and starts a stroke that began off the cat the moment it arrives. Each feature has a size dial. Little pieces — hats, glasses, a purse, a suitcase, a palm, a shell — bake on wherever you tap, and the studio suggests a set that matches what the bank is for, so the kitty carries its own story. The wheel can be stopped. And nothing is final any more: a piece on the shelf goes back to the wheel, is repainted, fired again, put on display or thrown away, with the bank's name, money and history untouched.

Budget delta (5): +0 — no financial writer, projection or hash change; `savedCents` is never written and studio data stays outside `financialAuditHash`. Engagement delta (3): +3 — the two things that made people stop (a brush that only registered dead-on, and a first firing you could not undo) are gone.

## Decision reversal (needs a DECISIONS.md why-note)

**A fired Kitty Bank is no longer final.** 2026-09-11 recorded "fired pieces are immutable". Jonathan reversed it on 2026-09-12 ("nothing is final"). `assertKittyStudioTransition` is deleted; `assertGoalEnvelopeTransition` no longer guards the shelf. A refired piece keeps its id and counts `firings`. The shelf cap of six stands, and the error now tells you to take one off rather than that the shelf is full.

## What changed

### Data (`src/core/types.ts`, `src/core/kittyStudio.ts`, `src/core/commands.ts`, `src/core/goalEnvelopes.ts`)

- `KittySculptV1.features?: Partial<Record<KittyFeature, number>>` — per-feature dials (head, ears, eyes, nose, mouth, whiskers, tail), 0.5–1.8, validated and quantized; a dial at 1 is not stored, so existing pieces are byte-for-byte unchanged and read as 1 through `kittyFeature()`.
- `KittyStampV1` gains optional `part` + `u`/`v` (free placement, both or neither) and `trim` (second colour). `anchor` stays required and is kept in step with the nearest named spot, so older readers and the spoken label still work. `stampPlacement()` resolves either shape.
- New eye and mouth options: `sparkle`, `wink`, `closed`; `oh`. 20 add-on stamp kinds (`KITTY_ADDON_KINDS`) alongside the original eight marks.
- `KittyStudioV1.displayId?` chooses which piece the bank shows; `displayedKittyPiece` honours it and falls back to newest fired.
- `KittyPieceV1.firings?` counts kiln visits. `reopenKittyPiece()` and `removeKittyPiece()` are the lifecycle helpers; `saveGoalEnvelope({ fire: true })` stamps `firedAt`/`firedBy`, increments `firings` and puts the new piece on display.
- Limits: stamps 40 → 64, envelope budget 48 KB → 64 KB, stroke size 1–64 → 1–96, stamp size 0.05–0.6 → 0.04–0.75.

### One artwork table, two renderers (`src/kitty/studio/stampArt.ts`, `anchors.ts`, `silhouette.ts`)

- Every stamp and add-on is a list of sub-paths in a −1..1 box, drawn into the 3D part canvases with `Path2D` and into the flat SVG with `<path>`. Roles (`body`/`trim`/`ink`/`white`) pick colour; `stampTrim()` derives a partner colour so two-tone pieces need no second picker.
- `silhouette.ts` holds the body curve and head proportions the lathe uses, so the flat cat is a front projection of the same numbers rather than a separate drawing.

### The 2D cat wears the 3D paint (`src/kitty/studio/flat.tsx`)

- Each part's underglaze is replayed with the very same `replayPart` the textures use, the front of the wrap is cropped, bisque-lifted when unfired, and clipped into the part's silhouette. Strokes, dips, stamps and add-ons all show in Simple view, shelf thumbnails and the room.
- Without a canvas (tests, very old browsers) the dips still render and stamps fall back to vector paths from the same artwork.
- Geometry rebuilt on the shared curve: body, head, ears, paws, door, tail and every face feature are placed from sculpt units, so the flat cat changes when the wheel does.

### Face, dials and the paint shell (`src/kitty/sculpture.ts`)

- **The face was sunk into the head.** Features were positioned at a fixed z that sat *inside* the head ellipsoid for most head shapes — the cause of "eyes and face features dont work good enough". `onFace(x, y)` now solves the ellipsoid for the surface z at each feature's position, so eyes, nose, mouth and whiskers seat on the clay for every head shape and every dial.
- Eyes rebuilt: sclera, iris, two catch-lights, seven expressions, bigger by default.
- Every feature dial feeds the build (head scale moves the face with it; ear cones, nose, mouth, whisker length and tail radius all scale).
- **Paint shell:** each paintable mesh gets an invisible twin pushed 0.26 units along its normals, carrying identical uv. `raycastPart(raycaster, outside)` falls through to it, so a brush that runs past the silhouette still lands. A stroke that starts off the cat begins the moment the brush arrives.

### Studio and room (`src/kitty/studio/KittyStudio.tsx`, `src/kitty/KittyStage.tsx`, `src/kitty/KittyBankRoom.tsx`)

- Brush ring: a cursor ring sized from the brush selector (`brushRingPx`), tinted with the glaze, dashed while erasing; the OS cursor is hidden while painting.
- "Turn it slowly / Stop turning" on the stage; the choice sticks for the session and overrides the bench default.
- Benches renamed Shape · Paint · Kiln. Shape leads with the chips people use, a single "bigger or smaller" dial (pick a feature, then size it) and folds throwing handles, profile sliders, nose and whiskers into "More shaping".
- Extras drawer: a story kit chosen from the bank's name, purpose and kind (Away days / The big day / Home things / On the road / Kept back), then Marks · Hats · Worn · Carried · Away days. Tap the cat to bake a piece on anywhere; tap again with it selected to move it. Keyboard path kept: a named-spot list places it and a nudge pad plus a "Move to" list adjusts it, since the canvas is aria-hidden.
- Shelf: every fired piece has "Show this one", "Repaint" and "Throw away", each behind a Confirm that says what happens to the money (nothing).
- Fewer fields: a new bank asks for a name and an amount; purpose and kind live behind "Say more (optional)". The bank details form keeps name, target and date visible and folds purpose, type and refill away (opened automatically when a purpose exists).

## Verification

- `npx tsc --noEmit` clean.
- `test/kitty-studio.test.ts`, `test/kitty-studio-ui.test.ts`, `test/kitty-envelope.test.ts`, `test/kitty-envelope-ui.test.ts`, `test/kitty-banks.test.ts` — all green, with new cases for feature dials, free-placed add-ons, the artwork table, `displayId`, and a UI walk that fires, repaints, refires (firings 2) and throws a piece off the shelf while `savedCents` stays put.
- `pnpm test -- --risk=medium-high --focus=test/kitty-studio-ui.test.ts` — quick gate passed (148s, no time-budget breach).
- Browser evidence in `docs/evidence/kitty-studio/v2-*`: Shape bench, Paint bench and Simple-view parity at 320/390/720/1100; brush ring; a stroke begun off the clay landing on it (strokes 3 → 4); 3D and flat of the same piece side by side; shelf actions, the repaint Confirm and the piece back on the wheel. Taylor's Scrapbook and Newfoundland captured at 390 and 1100 as well. No horizontal overflow at any width; no page errors.

## Uncertainty and what is not done

- Add-ons are baked decals, not modelled props: a hat sits on the surface where you put it, which is the paint-your-own-pottery reading, not a 3D hat. If Jonathan wants real geometry, that is a separate slice.
- The paint shell is a fixed 0.26 units; very concave spots (between the ears) get less slack than flat ones.
- Older clients that predate free placement will still read new pieces (anchor is always present) but will draw add-ons at the anchor rather than the exact spot.
- `firings` is a count, not a history; there is no "what did it look like last time".
- Not done: Bianca-side notification of a repaint, Hercules commentary, per-stroke pressure, dragging a placed piece with the pointer (tap-to-move covers it), export of a fired piece.
