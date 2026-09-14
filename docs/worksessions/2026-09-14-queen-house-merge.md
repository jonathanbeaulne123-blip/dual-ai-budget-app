# Hearth worksession — The house, merged: kitty banks in the rooms, the bill rail in the cellar, one axis, and glass

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-14 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/queen-house-merged`
- **Baseline SHA:** `b462df06f9d56b5b8daf25ba862bf240ccf028f0` (`origin/main`, #477)
- **Head SHA:** see the branch / `queen-house-merged.patch` (three commits: the house patch, the cellar patch, the merge with the glass pass)
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (navigation across the whole shared Home; a door onto an existing money command behind Final Confirm; presentation only, behind `VITE_QUEENS_NEST`)
- **Decision owner:** Jonathan (D-256, D-257)
- **Environment impact:** none — fictional fixtures only

## Household outcome

One house. Up goes up — a swipe, a grab-and-haul, ArrowUp/ArrowDown, or the slim rail of three marks at the left edge — and each floor is a room the couple recognises: the loft's ledge with their own kitty banks on it, the hearth with her, and the cellar that opens on this month's bills as kitty banks on a rail of days, the Fund's water behind them, the hammer out only by hand. Every chip of words in the house sits on glass: a thin tint, a blur, a bright edge — a pane standing in the room, not a wall of paper in front of it. In the live cellar the panes are smoked and the words are paper, so they read on stone.

Jonathan's ask (2026-09-14): "merge these patches with your patches … mix and match to make a beautiful intuitive and complete product. my one note is ux should be more glassy and fit into the world better. no more large white in your face background to make things more visible … key things are navigation, loft, kitty banks models, navigation ux (with our glass like twist)."

## Budget delta (5)

+0. Nothing about money changed in the merge. The house patch reads only the bands `queenPresentation` already quantised; the cellar patch calls the existing `postDueRecurrences` for one recurrence behind `ConfirmSheet`; the glass pass is CSS. `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `fundWalk.ts`, `allocateNestTotal`, the categories, tiers and `test/kitty-nest.test.ts` untouched; no schema, Auth/RLS, sync, hosted-state, financial-hash or Hercules payload change.

## Engagement delta (3)

+3. Three floors that feel like one house, the couple's own cats on the ledge and the rail, one real act by hand in the cellar, and a surface that no longer shouts.

## What was merged, and how

- `claude/queen-house` (Opus, `queen-house.patch`, based on the rooms branch = `origin/main@b462df0`) applied cleanly with `git am`. Then `claude/cellar-bill-banks` merged on top. Two conflicts, both in the cellar: the months ribbon's drag handler (Opus made it let go of a vertical drag; mine made it capture only after 6px of movement so a tap reaches a jar) — **both kept**, in that order; and the one `QueenCellar` line in `QueenHome.tsx` — Opus's `QueenHouseRail` plus my household props. `test/verification-focus-map.json` and `docs/AI_HANDOFF.md` auto-merged.
- **The bill rail stands the kitty bank.** My hand-drawn jars (roof/loop/lid) were replaced by `QueenBankFlat` form "bill" — the same lidded bean cat the nest gives every bill and the 3D room sculpts — with the saved amount as its glaze; a subscription is a cooler clay, a planned expense the dotted hollow, a crack in copper across the cat is due-and-not-full, the broken cat is paid. The 3D vessel for a bill on the rail is `kind: "bill"`, lifted when held for the rehearsal. The forms, the hammer rule and the words are unchanged.
- **Glass** (`src/queen/queen-glass.css`, loaded after `queen-home.css`): one pane recipe for the room head, line, pills, scrub, acts, stair, hand, house rail, bank buttons and the peek panel — `--paper` at 30% (42% in the flat cellar), `blur(18px) saturate(1.25)`, a white hairline, an inset ink hairline, a soft lift; small labels (goal names, month labels, day ticks) are slivers. The live 3D cellar flips to smoked glass (`--ink` 44%) with paper text; the house rail smokes with it while you stand there. `@supports not (backdrop-filter)` and `prefers-reduced-transparency` raise the tint to 74–80% so the words still stand; forced colours keep Canvas/CanvasText.
- **The house rail** was a 196px pane of names at ≥720 that stood on top of the Protect bank at 720 (the cellar harness could not click through it). It is now one slim pane of three marks at the left edge on every width; at ≥720 a name comes out to the right as a glass flyout on hover or keyboard focus; the phone keeps the names for the screen reader only. The wide field gets 56px of side padding and the wide rooms 60px so nothing sits under it.
- **Rooms fit their width.** A room's grid column is `minmax(0, 1fr)` and the pills shrink with an ellipsis, so a long pill (`Fictional rent · months`) cannot push the whole column off the right edge at 390 — which it did. Phone rooms are compacted: head on one line, a bare slider, tight acts, the rail ≥112px where the frame allows.
- **Her top re-measures when chrome grows inside the shell** (`MutationObserver` now `subtree: true`): a books/sync banner that appears inside a wrapper no longer leaves her under it until a resize.
- The months pill reads `This month` / `<bill> · months` (was "This month's bills" / "… its months") so both fit a phone.

## Verified baseline

`origin/main@b462df0` (#477). Both incoming patches' own evidence stands (`docs/evidence/queen-house/`, `docs/evidence/queen-cellar/`), regenerated here after the merge.

## Acceptance evidence

- [x] `tsc --noEmit` clean on the merge.
- [x] `vitest run test/queen-house.test.ts test/queen-cellar-ui.test.ts test/queen-cellar.test.ts test/queens-nest-ui.test.ts test/queen-rooms.test.ts` — 5 files, 59/59.
- [x] `pnpm check` (Medium, as CI runs it) → `quick-gate-passed`: 17 files / 216 tests (16 fast / 209, 1 serial / 7), typescript 56.9s, 97.5s of the 300s budget; `uiProofRequired: true`, satisfied by the two browser runs below.
- [x] `vite build` — 18.4s.
- [x] `test/queen-house-layout.mjs` on the **actual App page**, 320/390/720/1100 × 3D / no-WebGL / reduced motion — 38 records: no page scroll on any floor, no figure on the ribbon or the ledge, no pot anywhere, the drawn cat on the flat path, three stops on the rail with exactly one `aria-current`, ArrowUp/ArrowDown and a mouse haul reaching the loft and the cellar and back, axe (wcag2a/aa, 21a/aa) clean on both rooms at 1100, 0 page errors.
- [x] `test/queen-cellar-layout.mjs` (the `composition=queen` proof with `bills=1`) — 23 records, 320×568/320×700/390/720/1100, 3D, flat and no-WebGL, reduced motion, keyboard, axe: no page scroll, 0 errors, 0 serious/critical axe hits; the hammer, the crack, the shard, the lift-out rehearsal, the Confirm sheet, the break on the proof page's in-memory books.
- [x] `test/goal-fill-ui.test.ts` — 6/7 red exactly as on `main`, untouched.

## Decisions and interpretations

- **Kitty banks over jars, everywhere.** Opus's bank models are the better idea: one silhouette, three renderers. The cellar's type shapes (roof, loop, lid) were mine and they went; the type is now a tint and words, the strike stays drawn over the cat in both paths (the crack and the hammer are not modelled in 3D — future form work in `queenRoomWorld.ts`).
- **Glass, not paper, and the cellar goes dark.** A light pane on dark stone with grey words is what Jonathan called "large white in your face"; a smoked pane with paper words on the live cellar is the same pane the other way round. The flat cellar keeps the light pane because its own background is light.
- **The rail is marks, not a menu.** The floor names are one hover or Tab away at ≥720 and read by the screen reader on the phone; the filled mark says where you are. It covers nothing at any width.
- **Both drag rules stand.** A vertical drag on the ribbon or the ledge belongs to the house (Opus); a press on the ribbon is not a drag until it has moved (mine) — without the second, tapping a jar in a real browser never reached the jar.
- **No renumbering was needed:** the house patch carried no DECISIONS row; the cellar is D-256 and this merge is D-257.

## Remaining uncertainty

- **No phone.** The swipe, the haul and the glass blur are proven in SwiftShader; blur over a live WebGL canvas costs GPU on a mid-range phone and nobody has measured it. `prefers-reduced-transparency` is honoured if the person sets it.
- The sandbox's "Books need attention" band sits at the top of every App-page screenshot (local PGlite does not finish opening here); it predates all three patches. Hercules' bubble overlaps the rail at some widths — App chrome.
- Contrast on glass is by construction (blur + tint + ink or paper), verified by eye at every width and by axe where it can compute it; axe cannot see through a canvas, so a colour-contrast miss on the live cellar would not be reported.
- The 320×568 chrome-stand-in frame remains the compromised one (rooms' evidence).
- Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes.

## Handoff

Local branch `claude/queen-house-merged` and `queen-house-merged.patch` only (three commits on `origin/main@b462df0`). Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to push and to try the swipe and the glass on his phone; Codex for the independent read of the hammer's path and of `useHouseAxis` sitting under every control on Home.
