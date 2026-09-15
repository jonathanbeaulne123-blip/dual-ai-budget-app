# Hearth worksession — The kitty banks dressed for their purpose, and sized by hand

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-15 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/cellar-bank-props`
- **Baseline SHA:** `0ae4490` (`origin/main`, #482)
- **Head SHA:** see the branch / `cellar-bank-dress.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium (presentation only, behind `VITE_QUEENS_NEST`; a per-device preference in `localStorage`; no money meaning, schema, Auth/RLS, sync, hosted state, financial hash or Hercules payload change)
- **Decision owner:** Jonathan (D-262)
- **Environment impact:** none — fictional fixtures only

## Household outcome

Every bank in the house now says what it is for before you read a word: the house bill is the postman's cat with a cap and an envelope, the recurring payment is the wind-up cat with a key in her flank, the subscription wears a bell, the appointment wears a calendar leaf, the planned expense stands under a folded paper hat, and the goal on the loft's ledge has a pennant planted beside her. The cellar's banks stand larger, and a pinch, a ctrl-scroll, the +/− pane beside the slider or the +/− keys set the size to whatever the person likes; the device remembers it.

Jonathan's ask (2026-09-15): "we need more unique shapes, hats, props, anything to make it extremely clear what purpose each bank serves. i also think we need to scale the kitty banks up a little they are too small. or users should be able to zoom in and out to toggle scale themselves." Chosen: both; I decide the prop vocabulary; everywhere a bank stands.

## Budget delta (5)

+0. Nothing about money changed. The dressing is read from the form the nest already gives a bank; the scale is a CSS custom property over bands `queenPresentation` already quantised; no command, no schema, no sync, no hash.

## Engagement delta (3)

+3. A purpose is a hat, and the rail is the size the person wants it.

## What changed

- **`src/queen/world/queenBankDress.ts`** (new, pure data): `BANK_DRESS` — one dressing per `BankForm` (hat / back / collar / foot), `BANK_DRESS_WORDS`, `bankDressPieces`. Both renderers read this one table; the jar on the months ribbon stays bare ("every jar is the same jar").
- **`queenBankSculpture.ts`**: `bankGeometry` builds only the pieces a form wears (a cap crown, band and half-disc peak; a calendar leaf with a header, a ring and a folded corner; a four-sided paper cone with a brim; a key stem, bow and bar; a collar torus and a bell; an envelope with two flaps; a pole and a triangle of cloth), all in the cat's own units so they scale with her; `buildBankVessel` seats them. Every hat is set back on the skull so the crown — the slot that accepts, the lid that refuses — stays in front. Two optional materials (`felt`, `paper`) with fallbacks; the rooms supply them.
- **`QueenBankFlat.tsx`**: the same dressing drawn in SVG, after the head and before the slot or lid; `data-dress` carries the pieces. Classes `queen-bank-flat__felt/paper/ink/brass/pole` in `queen-home.css`; a shard fades its dressing, frosted glass keeps it at three quarters.
- **`src/queen/cellarZoom.ts`** (new): `CELLAR_ZOOM` (0.75–2.25, default 1.4), `clampCellarZoom`, `stepCellarZoom` (to the next quarter mark), `readCellarZoom` / `storeCellarZoom` (try/catch around `localStorage`), `cellarCellPx`.
- **`QueenCellarRail.tsx`**: the rail sets `--cellar-zoom`; the day cell, the five size bands, the seats and the drag step follow it (`queen-cellar.css`), so the sculpture — which follows the drawn seat — grows with it. A two-finger pinch on the rail sets the scale (and never the gate), ctrl-scroll or a trackpad pinch sets it, `+`/`=`/`-`/`_` on the focused rail step it; `CellarZoomPane` (smaller · % · larger) sits in the scrub row beside the slider so it covers no bank. Each jar's `title` names its purpose and dressing; the accessible name is unchanged.
- **`QueenCellar.tsx`**: owns the scale, remembers it; the key line beneath the gate now reads "its shape and what it wears are what it is for".
- **The loft ledge** is dressed through the same sculpture and twin: a goal's pennant, a lidded thing's cap and envelope. Its widths are unchanged.

## Verified baseline

`origin/main@0ae4490` (#482). `test/queen-cellar-layout.mjs` and `test/queen-house-layout.mjs` were green on it before this change.

## Acceptance evidence

- [x] `tsc --noEmit` clean.
- [x] `test/queen-bank-dress.test.ts` 6/6 — every purpose dressed differently, the jar bare; the flat twin draws each piece and the crown after every hat; the sculpture builds only what a form wears; the words; the scale's range, stepping and memory (including a storage that throws).
- [x] `vitest run test/queen-house.test.ts test/queen-cellar-ui.test.ts test/queen-cellar.test.ts test/queens-nest-ui.test.ts test/queen-rooms.test.ts` — 64/64.
- [x] `pnpm test -- --risk=medium --focus=test/queen-bank-dress.test.ts` → `quick-gate-passed` (typescript 65 s, vitest-fast 22 s, no serial lane selected, no budget breach).
- [x] `test/queen-cellar-layout.mjs` (`composition=queen`, `bills=1`) — 23 records, 320×568 / 320×700 / 390 / 720 / 1100, 3D, flat and no-WebGL, reduced motion, keyboard, axe: 0 page errors, 0 serious/critical hits, no page scroll; the dressed jars at the default 140%, the `− 140% +` pane in the scrub row, the hammer, crack, shard, lift-out and Confirm unchanged ([evidence](../evidence/queen-cellar/)).
- [x] `test/queen-house-layout.mjs` on the actual App page — 38 records, 320/390/720/1100 × 3D / no-WebGL / reduced motion: no page scroll on any floor, the pennant and the postman's cat on the ledge, axe clean at 1100, 0 page errors ([evidence](../evidence/queen-house/)).
- [x] `test/goal-fill-ui.test.ts` untouched (6/7 red on `main`, as before).

## Decisions and interpretations

- **A prop per purpose, not per category.** The tint is already the category group and the finish the line; a second symbol on the same cat would have to compete with the hat. The dressing says *what kind of promise this is*; the clay says *where it is filed*.
- **Hats behind the crown.** The open slot and the lid are the two rules the rooms keep physical; a hat that covered them would trade the rule for a costume. Every hat sits back on the skull in 3D and is drawn before the slot in the twin.
- **The scale is one number, remembered per device.** It is presentation (D-256's bands hold: five sizes, never proportion), so it lives in `localStorage`, not in the household; a private window forgets it and the rail still stands.
- **The size pane is in the scrub row**, not over the rail: a pane in the rail's corner covered the month's largest bank at 1100 and half the rail at 390.
- **D-261 is taken** by `habitat-member-mapping.patch` (not yet merged); this is D-262.

## Remaining uncertainty

- At 1100×800 the month's largest jar at 140% stands up behind the glass view pills (a pane standing in the room, by design); at 225% more of the rail does. The proofs' "everything in the room" and "no page scroll" checks hold at the default.
- The 3D dressing is verified in SwiftShader stills; a phone's GPU has not drawn it, and the cellar's low light keeps the postman's cap a dark band with a peak rather than a bright hat — the flat twin reads brighter.
- At 320×700 and shorter frames the rail's headroom crops a tall cat's hat first (the existing short-frame rule); the pinch still works there, the pane is hidden with the slider.
- The loft's lidded things wear the bill's cap and envelope whatever they are (the ledge only knows open / lidded).
- Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes.
