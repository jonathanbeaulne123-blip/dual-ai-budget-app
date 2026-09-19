# Hearth worksession — The kitty jars: dressed for their purpose, sized by hand, fired as they fill, and read on a card

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

Then, the same day: "we are going to call these cellar banks **kitty jars** from now on so we can differentiate from the loft's kitty banks. it's kind of hard to tell how full a jar is in the 3d version right now. you know how we have that fire in the kiln feature? that adds a glow and changes the look significantly? we should have the effect be the visual indicator. they start off bare and unfired. as money gets put in or they get paid they slowly get more and more glazed from the ground up. this way if a bill is 50% paid the user will tell immediately by seeing that half the body is glazed. i also think clicking on a jar needs to display more info about it."

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

### The kiln, the name, and the card (same day)

- **Kitty jars.** The cellar's banks are *kitty jars* in every word the room says: "11 kitty jars on the rail", "Break the kitty jar", the size pane ("Size of the kitty jars"), the key line, the card. The loft keeps *kitty banks*. `CellarJar` and the `queen-jar` classes already said so.
- **Fired as they fill** (`queenRoomWorld.ts`). The inner "level" mesh is gone. The body's material is the studio's two looks meeting at the fill line: below it the tint's glaze (`clearcoat 1`, roughness `0.16`), above it the chalky bisque (`bisqueHex`, roughness `0.92`, no clearcoat) — one 64×128 colour map and one 4×128 roughness/clearcoat map per fill band (the nest's eleven bands), shared by every jar at that band, the line's finish drawn over both. The head, ears, paws and tail fire only once she is full: *glazed to the crown*. A **paid** jar is fired to the crown and keeps its shard crack; a **planned** one stays frosted glass; a month on the ribbon that posted nothing stays hollow. The flat twin does the same: bisque above the line, the tint below with a sheen down its flank, `data-fired` when the head fires with her (`queen-home.css`, `queen-cellar.css`).
- **The card** (`QueenCellar.tsx`, `cellarJarFacts` and `cellarGlazeWords` in `src/core/queenCellar.ts`). A press on a jar puts it in the gate *and* opens its card in the room, in the line's place: the purpose and dressing as a kicker, the name, the one-line reading, then the facts — *Filed under*, *Its day* (day of month, days away, cadence), *The jar holds* (saved of target, or paid), *In the kiln* (bare / glazed to a mark / halfway / fired to the crown / frosted glass), *Still to go*, *Paid from* (the Fund's water landing in an account, an account, or nowhere yet), *The water after*, *The strike* (what the hammer, crack or shard means) — and *Its months* / *Open it in the banks*. The acts (hammer, pay from the water, lift out) stand once, below the card, as before. Press the jar again, × or Escape closes it and focus returns to the jar; `aria-expanded` on the jar says which is open. It scrolls inside itself on a short frame (`60cqh`) rather than pushing the room; on wide the facts stand five across.

## Verified baseline

`origin/main@0ae4490` (#482). `test/queen-cellar-layout.mjs` and `test/queen-house-layout.mjs` were green on it before this change.

## Acceptance evidence

- [x] `tsc --noEmit` clean.
- [x] `test/queen-bank-dress.test.ts` 6/6 — every purpose dressed differently, the jar bare; the flat twin draws each piece and the crown after every hat; the sculpture builds only what a form wears; the words; the scale's range, stepping and memory (including a storage that throws).
- [x] `test/queen-cellar.test.ts` 18/18 (+2: the kiln's words are marks, never figures; the card's facts for a filling, a paid and a planned jar); `test/queen-cellar-ui.test.ts` 11/11 (+1: the card opens on a press, says the facts, keeps the line and the acts once, closes on a second press or Escape with focus back on the jar; the kiln's `data-fired`, the shard fired to the crown).
- [x] `vitest run test/queen-house.test.ts test/queen-cellar-ui.test.ts test/queen-cellar.test.ts test/queens-nest-ui.test.ts test/queen-rooms.test.ts test/queen-bank-dress.test.ts` — 73/73.
- [x] `pnpm test -- --risk=medium --focus=test/queen-cellar-ui.test.ts` → `quick-gate-passed` (18 files: 17 fast / 1 serial; typescript 64 s, vitest-fast 23 s, vitest-serial 7 s; 109 s, no budget breach).
- [x] `test/queen-cellar-layout.mjs` (`composition=queen`, `bills=1`) — **26 records** (three `card-*` stills added), 320×568 / 320×700 / 390 / 720 / 1100, 3D, flat and no-WebGL, reduced motion, keyboard, axe: 0 page errors, 0 serious/critical hits, no page scroll; the dressed, fired jars at the default 140%, the `− 140% +` pane, the card opened by a press with its facts asserted and closed by × with focus back on the jar, the hammer, crack, shard, lift-out and Confirm ([evidence](../evidence/queen-cellar/)).
- [x] `test/queen-house-layout.mjs` on the actual App page — 38 records, 320/390/720/1100 × 3D / no-WebGL / reduced motion: no page scroll on any floor, the pennant and the postman's cat on the ledge, the ledge's goals fired as they fill, axe clean at 1100, 0 page errors ([evidence](../evidence/queen-house/)).
- [x] `test/goal-fill-ui.test.ts` untouched (6/7 red on `main`, as before).

## Decisions and interpretations

- **A prop per purpose, not per category.** The tint is already the category group and the finish the line; a second symbol on the same cat would have to compete with the hat. The dressing says *what kind of promise this is*; the clay says *where it is filed*.
- **Hats behind the crown.** The open slot and the lid are the two rules the rooms keep physical; a hat that covered them would trade the rule for a costume. Every hat sits back on the skull in 3D and is drawn before the slot in the twin.
- **The scale is one number, remembered per device.** It is presentation (D-256's bands hold: five sizes, never proportion), so it lives in `localStorage`, not in the household; a private window forgets it and the rail still stands.
- **The size pane is in the scrub row**, not over the rail: a pane in the rail's corner covered the month's largest bank at 1100 and half the rail at 390.
- **The kiln replaces the level, it does not add to it.** Two ways of saying "how full" on one cat would argue; the fired line is the one reading, and it is the studio's own look, so a jar in the cellar and a piece on the wheel speak the same language. A paid jar is *fired* — done — and keeps the crack that says it was broken to pay.
- **The card is in the room's flow, not a sheet over it.** A sheet covered the hammer; in flow, the rail gives a little and the acts stay where the hand knows them. On a short frame the card scrolls inside itself.
- **D-261 is taken** by `habitat-member-mapping.patch` (not yet merged); this is D-262.

## Remaining uncertainty

- At 1100×800 the month's largest jar at 140% stands up behind the glass view pills (a pane standing in the room, by design); at 225% more of the rail does. The proofs' "everything in the room" and "no page scroll" checks hold at the default.
- The 3D dressing is verified in SwiftShader stills; a phone's GPU has not drawn it, and the cellar's low light keeps the postman's cap a dark band with a peak rather than a bright hat — the flat twin reads brighter.
- At 320×700 and shorter frames the rail's headroom crops a tall cat's hat first (the existing short-frame rule); the pinch still works there, the pane is hidden with the slider.
- The loft's lidded things wear the bill's cap and envelope whatever they are (the ledge only knows open / lidded).
- Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes.
